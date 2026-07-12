#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRepoRoot = resolve(pluginRoot, "..", "..");
const runsFromSourceTree = existsSync(join(sourceRepoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs"));
const repoRoot = runsFromSourceTree ? sourceRepoRoot : resolve(process.cwd());

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

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function quotePath(path) {
  return `"${String(path).replaceAll('"', '\\"')}"`;
}

function runScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`${scriptName} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

const goal = argValue("--goal", "one-pass human manual plugin test session");
const outputRoot = resolve(argValue("--out-dir", join(pluginRoot, "artifacts", "manual-test-session")));
const readinessDir = join(outputRoot, "readiness");
const receiptTemplateDir = join(outputRoot, "result-receipt-template");
const validationDir = join(outputRoot, "result-validation");

const readinessResult = runScript("create-plugin-manual-test-readiness-pack.mjs", [
  "--goal",
  goal,
  "--out-dir",
  readinessDir
]);
const receiptTemplateResult = runScript("create-plugin-manual-test-result-receipt-template.mjs", [
  "--readiness",
  readinessResult.packPath,
  "--out-dir",
  receiptTemplateDir
]);

const readiness = readJson(readinessResult.packPath);
const receiptTemplate = readJson(receiptTemplateResult.templatePath);
const fillableReceiptPath = writeJson(join(outputRoot, "manual-test-result-receipt-to-fill.json"), receiptTemplate);
const validationCommand = [
  "node",
  quotePath(join(pluginRoot, "scripts", "validate-plugin-manual-test-result-receipt.mjs")),
  "--readiness",
  quotePath(readinessResult.packPath),
  "--receipt",
  quotePath(fillableReceiptPath),
  "--out-dir",
  quotePath(validationDir)
].join(" ");

const scenarioBriefs = (readiness.scenarios || []).map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  command: scenario.command,
  expectedEvidence: scenario.expectedEvidence,
  manualAction: scenario.manualAction,
  passCriteria: scenario.passCriteria || [],
  stopConditions: scenario.stopConditions || []
}));

const testerFlow = [
  {
    step: "prepare",
    action: "Read the start-here page and run the fast setup checks before a human tester begins.",
    evidencePath: readinessResult.markdownPath,
    command: "npm run smoke:plugin-manual-test-session-packet"
  },
  {
    step: "exercise_scenarios",
    action: "Run the listed scenario commands, then perform the manual action for each row.",
    evidencePath: readinessResult.packPath,
    command: (readiness.commandSequence || []).join(" && ")
  },
  {
    step: "record_results",
    action: "Fill observedStatus, observedEvidencePaths, notes, blockers, tester initials, and testedAt in the receipt copy.",
    evidencePath: fillableReceiptPath,
    command: "edit the receipt JSON; do not mark acceptance or enable rules"
  },
  {
    step: "validate_return",
    action: "Validate the filled receipt to create a blocker/follow-up queue before any follow-up planning.",
    evidencePath: join(validationDir, "manual-test-result-validation.json"),
    command: validationCommand
  }
];

const commandSequence = [
  "npm run smoke:plugin-health-index",
  "npm run smoke:plugin-tool-surface",
  "npm run smoke:plugin-manual-test-readiness",
  "npm run build:plugin-manual-test-result-receipt-template",
  "npm run smoke:plugin-manual-test-result-receipt",
  "npm run build:plugin-manual-test-session-packet"
];

const safetyBoundary = {
  reviewOnly: true,
  invokesModels: false,
  executesTargetSoftware: false,
  writesMemory: false,
  enablesRules: false,
  unlocksPackaging: false,
  claimsProductAcceptance: false,
  claimsCompletion: false
};

const checks = [
  {
    name: "Session packet builds readiness and result receipt artifacts together",
    pass:
      readiness.responseMode === "transparent_ai_apprentice_manual_test_readiness_pack_v1" &&
      readiness.status === "ready_for_human_manual_testing" &&
      receiptTemplate.responseMode === "transparent_ai_apprentice_manual_test_result_receipt_template_v1",
    evidence: `readiness=${readiness.status}; receiptRows=${receiptTemplate.scenarioReceipts?.length || 0}`
  },
  {
    name: "Scenario and receipt rows stay aligned",
    pass: scenarioBriefs.length > 0 && scenarioBriefs.length === (receiptTemplate.scenarioReceipts || []).length,
    evidence: `scenarios=${scenarioBriefs.length}; receipts=${receiptTemplate.scenarioReceipts?.length || 0}`
  },
  {
    name: "Tester flow includes preparation, scenario exercise, result recording, and validation",
    pass:
      testerFlow.some((item) => item.step === "prepare") &&
      testerFlow.some((item) => item.step === "exercise_scenarios") &&
      testerFlow.some((item) => item.step === "record_results") &&
      testerFlow.some((item) => item.step === "validate_return"),
    evidence: testerFlow.map((item) => item.step).join(",")
  },
  {
    name: "Manual test session keeps product locks closed",
    pass:
      safetyBoundary.reviewOnly === true &&
      safetyBoundary.invokesModels === false &&
      safetyBoundary.executesTargetSoftware === false &&
      safetyBoundary.writesMemory === false &&
      safetyBoundary.enablesRules === false &&
      safetyBoundary.unlocksPackaging === false &&
      safetyBoundary.claimsProductAcceptance === false &&
      safetyBoundary.claimsCompletion === false,
    evidence: JSON.stringify(safetyBoundary)
  }
];

const passed = checks.filter((check) => check.pass).length;
const status = passed === checks.length ? "ready_for_human_manual_test_session" : "needs_manual_test_session_follow_up";
const sessionPacketPath = join(outputRoot, "manual-test-session-packet.json");
const markdownPath = join(outputRoot, "MANUAL_TEST_SESSION_START_HERE.md");
const htmlPath = join(outputRoot, "manual-test-session.html");

const packet = {
  responseMode: "transparent_ai_apprentice_manual_test_session_packet_v1",
  status,
  generatedAt: new Date().toISOString(),
  goal,
  plugin: readiness.plugin,
  safetyBoundary,
  sessionPaths: {
    sessionPacketPath,
    startHereMarkdownPath: markdownPath,
    startHereHtmlPath: htmlPath,
    readinessPackPath: readinessResult.packPath,
    readinessMarkdownPath: readinessResult.markdownPath,
    readinessHtmlPath: readinessResult.htmlPath,
    receiptTemplatePath: receiptTemplateResult.templatePath,
    receiptTemplateMarkdownPath: receiptTemplateResult.markdownPath,
    receiptTemplateHtmlPath: receiptTemplateResult.htmlPath,
    fillableReceiptPath,
    validationOutputDir: validationDir
  },
  manualTestStatus: {
    readyForHumanTesting: status === "ready_for_human_manual_test_session",
    productAcceptanceClaimed: false,
    recommendedNextPhase: "human_exploratory_and_scenario_testing",
    notYetReadyFor: ["production release", "technology acceptance", "packaging unlock", "unsupervised execution"]
  },
  commandSequence,
  testerFlow,
  scenarios: scenarioBriefs,
  checks,
  nextAction:
    status === "ready_for_human_manual_test_session"
      ? "Give MANUAL_TEST_SESSION_START_HERE.md and manual-test-result-receipt-to-fill.json to the tester, then validate the returned receipt."
      : "Fix failed session-packet checks before handing this to a human tester."
};

const markdown = [
  "# Manual Test Session",
  "",
  `Generated: ${packet.generatedAt}`,
  `Status: ${packet.status}`,
  "",
  "## Start Here",
  "",
  `- Readiness guide: \`${readinessResult.markdownPath}\``,
  `- Fillable result receipt: \`${fillableReceiptPath}\``,
  `- Validation output directory: \`${validationDir}\``,
  "",
  "## Boundary",
  "",
  "- Review only: true",
  "- Product acceptance claimed: false",
  "- Executes target software: false",
  "- Writes memory: false",
  "- Enables rules: false",
  "- Unlocks packaging: false",
  "- Claims completion: false",
  "",
  "## Fast Commands",
  "",
  ...commandSequence.map((command) => `- \`${command}\``),
  "",
  "## Tester Flow",
  "",
  ...testerFlow.flatMap((item, index) => [
    `${index + 1}. ${item.step}`,
    `   - Action: ${item.action}`,
    `   - Evidence: \`${item.evidencePath}\``,
    `   - Command: \`${item.command}\``,
    ""
  ]),
  "## Scenarios",
  "",
  ...scenarioBriefs.flatMap((scenario) => [
    `### ${scenario.title}`,
    "",
    `- Scenario id: \`${scenario.id}\``,
    `- Command: \`${scenario.command}\``,
    `- Manual action: ${scenario.manualAction}`,
    `- Expected evidence: \`${scenario.expectedEvidence}\``,
    ""
  ]),
  "## Return Command",
  "",
  `\`${validationCommand}\``,
  "",
  "## Next Action",
  "",
  packet.nextAction,
  ""
].join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Manual Test Session</title>
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
  <h1>Manual Test Session</h1>
  <p><strong>Status:</strong> <code>${htmlEscape(packet.status)}</code></p>
  <div class="boundary">This packet is review-only. It cannot accept the product, enable rules, write memory, unlock packaging, execute target software, or claim completion.</div>
  <h2>Start Here</h2>
  <ul>
    <li>Readiness guide: <code>${htmlEscape(readinessResult.markdownPath)}</code></li>
    <li>Fillable result receipt: <code>${htmlEscape(fillableReceiptPath)}</code></li>
    <li>Validation output: <code>${htmlEscape(validationDir)}</code></li>
  </ul>
  <h2>Tester Flow</h2>
  <table>
    <thead><tr><th>Step</th><th>Action</th><th>Evidence</th><th>Command</th></tr></thead>
    <tbody>
      ${testerFlow
        .map(
          (item) =>
            `<tr><td>${htmlEscape(item.step)}</td><td>${htmlEscape(item.action)}</td><td><code>${htmlEscape(item.evidencePath)}</code></td><td><code>${htmlEscape(item.command)}</code></td></tr>`
        )
        .join("")}
    </tbody>
  </table>
  <h2>Scenarios</h2>
  <table>
    <thead><tr><th>Scenario</th><th>Command</th><th>Manual Action</th></tr></thead>
    <tbody>
      ${scenarioBriefs
        .map(
          (scenario) =>
            `<tr><td>${htmlEscape(scenario.title)}</td><td><code>${htmlEscape(scenario.command)}</code></td><td>${htmlEscape(scenario.manualAction)}</td></tr>`
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>
`;

writeJson(sessionPacketPath, packet);
writeText(markdownPath, markdown);
writeText(htmlPath, html);

console.log(
  JSON.stringify(
    {
      responseMode: "transparent_ai_apprentice_manual_test_session_packet_result_v1",
      status,
      generatedAt: packet.generatedAt,
      sessionPacketPath,
      markdownPath,
      htmlPath,
      readinessPackPath: readinessResult.packPath,
      receiptTemplatePath: receiptTemplateResult.templatePath,
      fillableReceiptPath,
      validationCommand,
      scenarioCount: scenarioBriefs.length,
      nextAction: packet.nextAction
    },
    null,
    2
  )
);
