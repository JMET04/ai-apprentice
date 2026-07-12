#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hashText, writeJson } from "./knowledge/knowledge-core.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value) {
  return (
    String(value || "real-case-rule-dsl-review")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "real-case-rule-dsl-review"
  );
}

function locks() {
  return {
    reviewOnly: true,
    receiptBuilderOnly: true,
    activeRulePackageCompiled: false,
    disabledRulePackageCompiled: false,
    ruleEnabled: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const packagePath = resolve(argValue("--package", argValue("--preparation-package", "")));
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-rule-dsl-review-receipt-builders"))
);

if (!packagePath) {
  throw new Error(
    "Usage: node create-real-case-rule-dsl-review-receipt-builder.mjs --package <real-case-rule-dsl-preparation-package.json> [--out-dir <dir>]"
  );
}
if (!existsSync(packagePath)) throw new Error(`REAL_CASE_RULE_DSL_PREPARATION_PACKAGE_NOT_FOUND: ${packagePath}`);

const prep = readJson(packagePath);
if (prep.format !== "transparent_ai_real_case_rule_dsl_preparation_package_v1") {
  throw new Error("Expected transparent_ai_real_case_rule_dsl_preparation_package_v1.");
}
if (
  prep.status !== "real_case_rule_dsl_preparation_waiting_for_teacher_rule_review" ||
  prep.locks?.ruleEnabled !== false ||
  prep.locks?.targetSoftwareCommandsExecuted !== false ||
  prep.locks?.activeRulePackageCompiled !== false
) {
  throw new Error("Preparation package must be ready for review and locked against active rule/execution paths.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(prep.caseType || prep.packageId)}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "real-case-rule-dsl-review-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "real-case-rule-dsl-review-receipt-template.json");
const readmePath = join(builderDir, "REAL_CASE_RULE_DSL_REVIEW_RECEIPT_START_HERE.md");
const htmlPath = join(builderDir, "real-case-rule-dsl-review-receipt.html");
const builderLocks = locks();

const receiptTemplate = {
  format: "transparent_ai_real_case_rule_dsl_review_receipt_v1",
  sourcePackageId: prep.packageId,
  sourcePackagePath: packagePath,
  sourcePackageHash: hashText(JSON.stringify(prep)),
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["logic_matches", "logic_mismatch_repair", "request_more_evidence", "blocked", "needs_teacher_review"],
  forbiddenTeacherDecisions: [
    "accepted",
    "enable_rule",
    "compile_active_package",
    "execute_software",
    "write_memory",
    "fetch_rag",
    "unlock_packaging",
    "claim_complete"
  ],
  rollbackRetained: Boolean(prep.rollbackPoint),
  teacherConfirmedNoExecution: false,
  blockedActionsConfirmed: true,
  reviewedCandidateRows: (prep.candidateRows || []).map((row) => ({
    ruleId: row.ruleId,
    rulePath: row.rulePath,
    candidateRuleHash: row.ruleHash,
    lifecycle: row.lifecycle,
    dslValidationOk: row.dslValidationOk,
    logicFitDecision: "needs_teacher_review",
    allowedLogicFitDecisions: ["matches_intended_logic", "logic_mismatch_repair", "needs_more_evidence", "needs_teacher_review"],
    teacherReviewed: false,
    evidenceReviewed: false,
    lifecycleConfirmedDraftDisabled: false,
    reviewerNote: ""
  })),
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true,
  locks: builderLocks
};

const builder = {
  ok: true,
  format: "transparent_ai_real_case_rule_dsl_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  sourcePackagePath: packagePath,
  sourcePackageHash: receiptTemplate.sourcePackageHash,
  packageId: prep.packageId,
  caseType: prep.caseType,
  candidateRuleCount: prep.candidateRuleCount,
  receiptTemplate,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-real-case-rule-dsl-review-receipt.mjs --package "' +
    packagePath +
    '" --receipt "<teacher-filled-real-case-rule-dsl-review-receipt.json>"',
  blockedActions: [
    "compile_active_rule_package_from_review_builder",
    "enable_rule_from_review_builder",
    "execute_software_from_review_builder",
    "fetch_rag_from_review_builder",
    "write_memory_from_review_builder",
    "unlock_packaging_from_review_builder",
    "claim_completion_from_review_builder"
  ],
  locks: builderLocks,
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  }
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# Real Case Rule DSL Review Receipt",
    "",
    `Case type: ${prep.caseType || ""}`,
    `Candidate draft-disabled rules: ${prep.candidateRuleCount || 0}`,
    "",
    "Review each candidate rule and choose one route: logic matches, logic mismatch repair, request more evidence, blocked, or needs teacher review.",
    "",
    "This builder does not compile active packages, enable rules, execute software, fetch RAG, write memory, unlock packaging, or claim completion.",
    "",
    "## Next validation command",
    "```powershell",
    builder.nextValidationCommand,
    "```"
  ].join("\n") + "\n",
  "utf8"
);

writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Real Case Rule DSL Review Receipt</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; background: #f7f9fc; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 22px; }
    h1 { font-size: 25px; margin: 0 0 8px; letter-spacing: 0; }
    section { background: #fff; border: 1px solid #d8e0ec; border-radius: 8px; padding: 15px; margin-top: 12px; }
    label { display: block; margin-top: 10px; }
    input, select, textarea, button { font: inherit; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; }
    textarea { min-height: 220px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 8px 12px; cursor: pointer; margin-top: 8px; }
    code, a { word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>Real Case Rule DSL Review Receipt</h1>
    <p>Candidate rules: <code>${htmlEscape(prep.candidateRuleCount || 0)}</code></p>
    <p>Package: <a href="${htmlEscape(pathToFileURL(packagePath).href)}">${htmlEscape(packagePath)}</a></p>
    <section>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="logic_matches">logic_matches</option>
          <option value="logic_mismatch_repair">logic_mismatch_repair</option>
          <option value="request_more_evidence">request_more_evidence</option>
          <option value="blocked">blocked</option>
        </select>
      </label>
      <label><input id="rollback" type="checkbox"> Rollback retained</label>
      <label><input id="noExecution" type="checkbox"> Confirm no execution now</label>
      <label>Teacher notes<input id="notes" type="text"></label>
      <button id="generate">Generate Receipt JSON</button>
      <textarea id="receiptJson" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const template = ${jsonForScript(receiptTemplate)};
    const receiptEl = document.getElementById("receiptJson");
    function buildReceipt() {
      const decision = document.getElementById("decision").value;
      const logicFit = decision === "logic_matches" ? "matches_intended_logic" : decision === "logic_mismatch_repair" ? "logic_mismatch_repair" : decision === "request_more_evidence" ? "needs_more_evidence" : "needs_teacher_review";
      return {
        ...template,
        teacherDecision: decision,
        rollbackRetained: document.getElementById("rollback").checked,
        teacherConfirmedNoExecution: document.getElementById("noExecution").checked,
        reviewedCandidateRows: template.reviewedCandidateRows.map((row) => ({
          ...row,
          logicFitDecision: logicFit,
          teacherReviewed: decision !== "needs_teacher_review",
          evidenceReviewed: decision === "logic_matches",
          lifecycleConfirmedDraftDisabled: decision === "logic_matches",
          reviewerNote: document.getElementById("notes").value
        })),
        teacherNotes: document.getElementById("notes").value
      };
    }
    function render() { receiptEl.value = JSON.stringify(buildReceipt(), null, 2); }
    document.getElementById("generate").addEventListener("click", render);
    render();
  </script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_case_rule_dsl_review_receipt_builder_result_v1",
      builderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      candidateRuleCount: prep.candidateRuleCount || 0,
      executeNow: false,
      locks: builderLocks
    },
    null,
    2
  )
);
