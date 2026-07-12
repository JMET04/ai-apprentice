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
    String(value || "confirmed-outcome-rule-dsl-review")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "confirmed-outcome-rule-dsl-review"
  );
}

function locks() {
  return {
    reviewOnly: true,
    receiptBuilderOnly: true,
    draftRulesRemainDisabled: true,
    activeRulePackageCompiled: false,
    disabledRulePackageCompiled: false,
    sourceRuleFilesModified: false,
    productionRuleRegistryMutated: false,
    ruleEnabled: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    ragEvidenceTreatedAsAuthority: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

const packagePath = resolve(argValue("--package", argValue("--preparation-package", "")));
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-rule-dsl-review-receipt-builders")
  )
);

if (!packagePath) {
  throw new Error(
    "Usage: node create-real-case-confirmed-outcome-rule-dsl-review-receipt-builder.mjs --package <confirmed-outcome-rule-dsl-draft-preparation-package.json> [--out-dir <dir>]"
  );
}
if (!existsSync(packagePath)) throw new Error(`CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREPARATION_PACKAGE_NOT_FOUND: ${packagePath}`);

const prep = readJson(packagePath);
if (prep.format !== "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_preparation_package_v1") {
  throw new Error("Expected transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_preparation_package_v1.");
}
if (
  prep.status !== "confirmed_outcome_rule_dsl_draft_preparation_waiting_for_teacher_rule_review" ||
  prep.proposedLifecycle !== "draft_disabled" ||
  prep.locks?.ruleEnabled !== false ||
  prep.locks?.productionRuleRegistryMutated !== false ||
  prep.locks?.targetSoftwareCommandsExecuted !== false ||
  prep.locks?.rulePackageCompiled !== false
) {
  throw new Error("Confirmed outcome draft preparation package must be ready for review and locked.");
}
if (prep.confirmedOutcomeBranch !== true || prep.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_REVIEW_BUILDER_SOURCE_PACKAGE_NOT_CONFIRMED_OUTCOME");
}
if (!prep.sourceConfirmedOutcomeReviewId || !prep.sourceConfirmedOutcomeSourceRunId || !prep.sourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_REVIEW_BUILDER_SOURCE_PACKAGE_SOURCE_IDS_MISSING");
}
for (const row of prep.candidateRows || []) {
  if (row.sourceReviewFormat !== prep.sourceReviewFormat) {
    throw new Error(`CONFIRMED_OUTCOME_RULE_DSL_REVIEW_BUILDER_ROW_SOURCE_REVIEW_FORMAT_MISMATCH:${row.ruleId}`);
  }
  if (row.sourceConfirmedOutcomeReviewId !== prep.sourceConfirmedOutcomeReviewId) {
    throw new Error(`CONFIRMED_OUTCOME_RULE_DSL_REVIEW_BUILDER_ROW_CONFIRMED_OUTCOME_REVIEW_ID_MISMATCH:${row.ruleId}`);
  }
  if (row.sourceConfirmedOutcomeSourceRunId !== prep.sourceConfirmedOutcomeSourceRunId) {
    throw new Error(`CONFIRMED_OUTCOME_RULE_DSL_REVIEW_BUILDER_ROW_CONFIRMED_OUTCOME_SOURCE_RUN_ID_MISMATCH:${row.ruleId}`);
  }
  if (row.sourceRunId !== prep.sourceRunId) {
    throw new Error(`CONFIRMED_OUTCOME_RULE_DSL_REVIEW_BUILDER_ROW_SOURCE_RUN_ID_MISMATCH:${row.ruleId}`);
  }
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(prep.packageId)}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "real-case-confirmed-outcome-rule-dsl-review-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "real-case-confirmed-outcome-rule-dsl-review-receipt-template.json");
const readmePath = join(builderDir, "REAL_CASE_CONFIRMED_OUTCOME_RULE_DSL_REVIEW_RECEIPT_START_HERE.md");
const htmlPath = join(builderDir, "real-case-confirmed-outcome-rule-dsl-review-receipt.html");
const builderLocks = locks();

const receiptTemplate = {
  format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_receipt_v1",
  sourcePackageId: prep.packageId,
  sourcePackagePath: packagePath,
  sourcePackageHash: hashText(JSON.stringify(prep)),
  confirmedOutcomeBranch: prep.confirmedOutcomeBranch === true,
  sourceReviewFormat: prep.sourceReviewFormat || "",
  sourceConfirmedOutcomeReviewId: prep.sourceConfirmedOutcomeReviewId || "",
  sourceConfirmedOutcomeSourceRunId: prep.sourceConfirmedOutcomeSourceRunId || "",
  sourceRunId: prep.sourceRunId || "",
  sourceLifecycleGatePath: prep.sourceLifecycleGatePath || "",
  sourceLifecycleGateHash: prep.sourceLifecycleGateHash || "",
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["logic_matches", "logic_mismatch_repair", "request_more_evidence", "blocked", "needs_teacher_review"],
  forbiddenTeacherDecisions: [
    "accepted",
    "enable_rule",
    "compile_active_package",
    "mutate_rule_registry",
    "execute_software",
    "write_memory",
    "fetch_rag",
    "unlock_packaging",
    "claim_complete"
  ],
  rollbackRetained: false,
  teacherConfirmedNoExecution: false,
  teacherConfirmedNoRegistryMutation: false,
  teacherConfirmedNoRuleEnablement: false,
  teacherConfirmedNoRagAuthority: false,
  blockedActionsConfirmed: true,
  reviewedCandidateRows: (prep.candidateRows || []).map((row) => ({
    ruleId: row.ruleId,
    rulePath: row.rulePath,
    candidateRuleHash: row.ruleHash,
    lifecycle: row.lifecycle,
    dslValidationOk: row.dslValidationOk,
    sourceReviewFormat: row.sourceReviewFormat || "",
    sourceConfirmedOutcomeReviewId: row.sourceConfirmedOutcomeReviewId || "",
    sourceConfirmedOutcomeSourceRunId: row.sourceConfirmedOutcomeSourceRunId || "",
    sourceRunId: row.sourceRunId || "",
    controlledOutputSha256: row.controlledOutputSha256 || "",
    logicFitDecision: "needs_teacher_review",
    allowedLogicFitDecisions: ["matches_intended_logic", "logic_mismatch_repair", "needs_more_evidence", "needs_teacher_review"],
    teacherReviewed: false,
    evidenceReviewed: false,
    lifecycleConfirmedDraftDisabled: false,
    controlledOutputHashReviewed: false,
    reviewerNote: ""
  })),
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true,
  locks: builderLocks
};

const builder = {
  ok: true,
  format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  sourcePackagePath: packagePath,
  sourcePackageHash: receiptTemplate.sourcePackageHash,
  confirmedOutcomeBranch: receiptTemplate.confirmedOutcomeBranch,
  sourceReviewFormat: receiptTemplate.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: receiptTemplate.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: receiptTemplate.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: receiptTemplate.sourceRunId,
  packageId: prep.packageId,
  proposedLifecycle: prep.proposedLifecycle,
  candidateRuleCount: prep.candidateRuleCount,
  receiptTemplate,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs --package "' +
    packagePath +
    '" --receipt "<teacher-filled-confirmed-outcome-rule-dsl-review-receipt.json>"',
  blockedActions: [
    "compile_active_rule_package_from_confirmed_outcome_review_builder",
    "enable_rule_from_confirmed_outcome_review_builder",
    "mutate_production_rule_registry_from_confirmed_outcome_review_builder",
    "execute_software_from_confirmed_outcome_review_builder",
    "fetch_rag_from_confirmed_outcome_review_builder",
    "write_memory_from_confirmed_outcome_review_builder",
    "unlock_packaging_from_confirmed_outcome_review_builder",
    "claim_completion_from_confirmed_outcome_review_builder"
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
    "# Real Case Confirmed Outcome Rule DSL Review Receipt",
    "",
    `Candidate draft-disabled rules: ${prep.candidateRuleCount || 0}`,
    `Package: ${packagePath}`,
    "",
    "Review each candidate rule and choose one route: logic matches, logic mismatch repair, request more evidence, blocked, or needs teacher review.",
    "",
    "This builder does not compile packages, enable rules, mutate the production rule registry, execute software, fetch RAG, write memory, unlock packaging, or claim completion.",
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
  <title>Confirmed Outcome Rule DSL Review Receipt</title>
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
    <h1>Confirmed Outcome Rule DSL Review Receipt</h1>
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
      <label><input id="noRegistry" type="checkbox"> Confirm no registry mutation</label>
      <label><input id="noEnable" type="checkbox"> Confirm no rule enablement</label>
      <label><input id="noRag" type="checkbox"> Confirm no RAG authority</label>
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
        teacherConfirmedNoRegistryMutation: document.getElementById("noRegistry").checked,
        teacherConfirmedNoRuleEnablement: document.getElementById("noEnable").checked,
        teacherConfirmedNoRagAuthority: document.getElementById("noRag").checked,
        reviewedCandidateRows: template.reviewedCandidateRows.map((row) => ({
          ...row,
          logicFitDecision: logicFit,
          teacherReviewed: decision !== "needs_teacher_review",
          evidenceReviewed: decision === "logic_matches",
          lifecycleConfirmedDraftDisabled: decision === "logic_matches",
          controlledOutputHashReviewed: decision === "logic_matches",
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
      format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_receipt_builder_result_v1",
      builderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      candidateRuleCount: prep.candidateRuleCount || 0,
      confirmedOutcomeBranch: receiptTemplate.confirmedOutcomeBranch,
      sourceReviewFormat: receiptTemplate.sourceReviewFormat,
      sourceConfirmedOutcomeReviewId: receiptTemplate.sourceConfirmedOutcomeReviewId,
      sourceConfirmedOutcomeSourceRunId: receiptTemplate.sourceConfirmedOutcomeSourceRunId,
      sourceRunId: receiptTemplate.sourceRunId,
      executeNow: false,
      locks: builderLocks
    },
    null,
    2
  )
);
