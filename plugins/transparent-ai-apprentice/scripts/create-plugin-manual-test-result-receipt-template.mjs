#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readText(path) {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, "utf8");
  return path;
}

function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const defaultReadinessPath = join(pluginRoot, "artifacts", "manual-test-readiness", "manual-test-readiness-pack.json");
const readinessPackPath = resolve(argValue("--readiness", defaultReadinessPath));
const outputRoot = resolve(argValue("--out-dir", join(pluginRoot, "artifacts", "manual-test-result-receipt")));

if (!existsSync(readinessPackPath)) {
  throw new Error(`Manual test readiness pack not found: ${readinessPackPath}`);
}

const readinessText = readText(readinessPackPath);
const readiness = JSON.parse(readinessText);
const allowedStatuses = ["not_run_yet", "matched_expected", "blocker_found", "needs_follow_up"];
const forbiddenTransitions = [
  "accepted",
  "product_accepted",
  "technology_accepted",
  "release_ready",
  "enable_rule",
  "rule_enabled",
  "write_memory",
  "memory_written",
  "unlock_packaging",
  "execute_now",
  "claim_complete"
];

const scenarioReceipts = (readiness.scenarios || []).map((scenario) => ({
  scenarioId: scenario.id,
  title: scenario.title,
  command: scenario.command,
  expectedEvidence: scenario.expectedEvidence,
  observedStatus: "not_run_yet",
  observedEvidencePaths: [],
  observedNotes: "",
  blockerQuestions: [],
  nextReviewNotes: "",
  testerInitials: "",
  testedAt: "",
  ruleEnabled: false,
  accepted: false,
  productAcceptanceClaimed: false,
  packagingGated: true
}));

const template = {
  responseMode: "transparent_ai_apprentice_manual_test_result_receipt_template_v1",
  generatedAt: new Date().toISOString(),
  sourceReadinessPackPath: readinessPackPath,
  sourceReadinessPackHash: sha256Text(readinessText),
  defaultDecision: "needs_teacher_review",
  allowedStatuses,
  forbiddenTransitions,
  safetyBoundary: {
    reviewOnly: true,
    invokesModels: false,
    executesTargetSoftware: false,
    writesMemory: false,
    enablesRules: false,
    unlocksPackaging: false,
    claimsProductAcceptance: false,
    claimsCompletion: false
  },
  instructions: [
    "Fill one row per scenario after human testing.",
    "Use matched_expected only when the observed evidence supports every pass criterion for that scenario.",
    "Use blocker_found when a stop condition or unexpected behavior is observed.",
    "Do not use this receipt to accept the product, enable rules, write memory, unlock packaging, or claim completion."
  ],
  scenarioReceipts,
  reviewerSummary: {
    overallDecision: "needs_teacher_review",
    readyForFollowUpPlanning: false,
    productAcceptanceClaimed: false,
    notes: ""
  }
};

const templatePath = join(outputRoot, "manual-test-result-receipt-template.json");
const markdownPath = join(outputRoot, "MANUAL_TEST_RESULT_RECEIPT_TEMPLATE.md");
const htmlPath = join(outputRoot, "manual-test-result-receipt-template.html");

const markdown = [
  "# Manual Test Result Receipt Template",
  "",
  `Generated: ${template.generatedAt}`,
  `Source readiness pack: ${readinessPackPath}`,
  `Allowed statuses: ${allowedStatuses.join(", ")}`,
  "",
  "## Boundary",
  "",
  "- Product acceptance claimed: false",
  "- Executes target software: false",
  "- Writes memory: false",
  "- Enables rules: false",
  "- Unlocks packaging: false",
  "- Claims completion: false",
  "",
  "## Scenario Rows",
  "",
  ...scenarioReceipts.flatMap((row) => [
    `### ${row.title}`,
    "",
    `- Scenario id: \`${row.scenarioId}\``,
    `- Command: \`${row.command}\``,
    `- Default status: \`${row.observedStatus}\``,
    `- Expected evidence: \`${row.expectedEvidence}\``,
    ""
  ]),
  "## Next Action",
  "",
  "Copy the JSON template, fill observedStatus, evidence paths, notes, and blockers, then validate it with `validate-plugin-manual-test-result-receipt.mjs`.",
  ""
].join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Manual Test Result Receipt Template</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #18212b; line-height: 1.45; }
    code { background: #f3f5f7; padding: 2px 5px; border-radius: 4px; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th, td { border: 1px solid #d8dee4; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f6f8fa; }
    .boundary { background: #f8fafc; padding: 12px 14px; border-left: 4px solid #5b6b7a; }
  </style>
</head>
<body>
  <h1>Manual Test Result Receipt Template</h1>
  <div class="boundary">This template is review-only. It cannot accept the product, enable rules, write memory, unlock packaging, execute target software, or claim completion.</div>
  <p><strong>Allowed statuses:</strong> ${htmlEscape(allowedStatuses.join(", "))}</p>
  <table>
    <thead><tr><th>Scenario</th><th>Command</th><th>Expected Evidence</th><th>Default Status</th></tr></thead>
    <tbody>
      ${scenarioReceipts
        .map(
          (row) =>
            `<tr><td>${htmlEscape(row.title)}</td><td><code>${htmlEscape(row.command)}</code></td><td><code>${htmlEscape(row.expectedEvidence)}</code></td><td><code>${htmlEscape(row.observedStatus)}</code></td></tr>`
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>
`;

writeJson(templatePath, template);
writeText(markdownPath, markdown);
writeText(htmlPath, html);

console.log(
  JSON.stringify(
    {
      responseMode: "transparent_ai_apprentice_manual_test_result_receipt_template_result_v1",
      status: "ready_for_manual_test_result_collection",
      generatedAt: template.generatedAt,
      templatePath,
      markdownPath,
      htmlPath,
      scenarioCount: scenarioReceipts.length,
      allowedStatuses,
      nextAction: "Fill the receipt template after human testing, then validate it before any follow-up planning."
    },
    null,
    2
  )
);
