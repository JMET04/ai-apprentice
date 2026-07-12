#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hashText, writeJson } from "./knowledge/knowledge-core.mjs";

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function slug(value) {
  return (
    String(value || "real-case-confirmed-outcome-validation-report-review")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "real-case-confirmed-outcome-validation-report-review"
  );
}

function locks() {
  return {
    reviewOnly: true,
    receiptBuilderOnly: true,
    deliveryAllowedEvidenceOnly: true,
    lifecyclePromotionExecuted: false,
    activeRulePackageCompiled: false,
    ruleEnabled: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    targetSoftwareCommandsExecuted: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const packetPath = resolve(argValue("--report-packet", argValue("--validation-report-packet", "")));
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-validation-report-review-receipt-builders"))
);
if (!packetPath) {
  throw new Error(
    "Usage: node create-real-case-confirmed-outcome-validation-report-review-receipt-builder.mjs --report-packet <real-case-disabled-package-validation-report-packet.json> [--out-dir <dir>]"
  );
}
if (!existsSync(packetPath)) throw new Error(`REAL_CASE_VALIDATION_REPORT_PACKET_NOT_FOUND: ${packetPath}`);

const packet = readJson(packetPath);
if (packet.format !== "transparent_ai_real_case_confirmed_outcome_disabled_package_validation_report_v1") {
  throw new Error("Expected transparent_ai_real_case_confirmed_outcome_disabled_package_validation_report_v1.");
}
if (
  packet.status !== "ready_for_teacher_confirmed_outcome_validation_report_review" ||
  packet.summary?.disabledRuleCount !== packet.summary?.lifecycleSkippedRows ||
  packet.summary?.validatorRowsEvaluated !== 0 ||
  packet.summary?.deliveryAllowed !== true ||
  packet.locks?.ruleEnabled !== false ||
  packet.locks?.activeRulePackageCompiled !== false ||
  packet.locks?.targetSoftwareCommandsExecuted !== false ||
  packet.locks?.packagingUnlocked !== false ||
  packet.nextReview?.deliveryAllowedIsEvidenceOnly !== true
) {
  throw new Error("Validation report packet must be locked, skipped-only, and evidence-only before report review.");
}
if (packet.confirmedOutcomeBranch !== true) {
  throw new Error("CONFIRMED_OUTCOME_VALIDATION_REPORT_REVIEW_PACKET_BRANCH_MISSING");
}
if (packet.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  throw new Error("CONFIRMED_OUTCOME_VALIDATION_REPORT_REVIEW_PACKET_SOURCE_FORMAT_MISMATCH");
}
if (!packet.sourceConfirmedOutcomeReviewId || !packet.sourceConfirmedOutcomeSourceRunId || !packet.sourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_VALIDATION_REPORT_REVIEW_PACKET_SOURCE_IDS_MISSING");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(packet.caseType || packet.reportId)}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "real-case-confirmed-outcome-validation-report-review-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "real-case-confirmed-outcome-validation-report-review-receipt-template.json");
const readmePath = join(builderDir, "REAL_CASE_CONFIRMED_OUTCOME_VALIDATION_REPORT_REVIEW_START_HERE.md");
const htmlPath = join(builderDir, "real-case-confirmed-outcome-validation-report-review.html");
const builderLocks = locks();
const sourceContext = {
  confirmedOutcomeBranch: true,
  sourceReviewFormat: packet.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: packet.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: packet.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: packet.sourceRunId
};

const receiptTemplate = {
  format: "transparent_ai_real_case_confirmed_outcome_validation_report_review_receipt_v1",
  sourceReportId: packet.reportId,
  sourceReportPacketPath: packetPath,
  sourceReportPacketHash: hashText(JSON.stringify(packet)),
  ...sourceContext,
  validationReportPath: packet.validationReportPath,
  compiledRulePackagePath: packet.compiledRulePackagePath,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "report_confirms_disabled_evidence",
    "report_mismatch_repair",
    "request_more_evidence",
    "blocked",
    "needs_teacher_review"
  ],
  forbiddenTeacherDecisions: [
    "accepted",
    "enable_rule",
    "promote_rule",
    "compile_active_package",
    "execute_software",
    "write_memory",
    "fetch_rag",
    "unlock_packaging",
    "claim_complete"
  ],
  reportReviewed: false,
  lifecycleSkippedRowsReviewed: false,
  deliveryAllowedEvidenceOnlyConfirmed: false,
  rollbackRetained: Boolean(packet.rollbackPoint),
  teacherConfirmedNoExecution: false,
  blockedActionsConfirmed: true,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true,
  locks: builderLocks
};

const builder = {
  ok: true,
  format: "transparent_ai_real_case_confirmed_outcome_validation_report_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  sourceReportPacketPath: packetPath,
  sourceReportPacketHash: receiptTemplate.sourceReportPacketHash,
  ...sourceContext,
  caseType: packet.caseType || "",
  summary: packet.summary,
  receiptTemplate,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-real-case-confirmed-outcome-validation-report-review-receipt.mjs --report-packet "' +
    packetPath +
    '" --receipt "<teacher-filled-real-case-confirmed-outcome-validation-report-review-receipt.json>"',
  blockedActions: [
    "promote_rule_from_report_review",
    "compile_active_package_from_report_review",
    "enable_rule_from_report_review",
    "execute_software_from_report_review",
    "write_memory_from_report_review",
    "unlock_packaging_from_report_review",
    "claim_completion_from_report_review"
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
    "# Real Case Confirmed Outcome Validation Report Review",
    "",
    `Case type: ${packet.caseType || ""}`,
    `Disabled rules: ${packet.summary?.disabledRuleCount ?? 0}`,
    `Lifecycle skipped rows: ${packet.summary?.lifecycleSkippedRows ?? 0}`,
    "",
    "Review the report as evidence only. Confirming it can prepare a separate lifecycle-candidate handoff, but this step cannot promote rules, compile active packages, execute software, or unlock packaging.",
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
  <title>Real Case Confirmed Outcome Validation Report Review</title>
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
    <h1>Real Case Confirmed Outcome Validation Report Review</h1>
    <p>Report packet: <a href="${htmlEscape(pathToFileURL(packetPath).href)}">${htmlEscape(packetPath)}</a></p>
    <p>Validation report: <a href="${htmlEscape(pathToFileURL(packet.validationReportPath).href)}">${htmlEscape(packet.validationReportPath)}</a></p>
    <section>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="report_confirms_disabled_evidence">report_confirms_disabled_evidence</option>
          <option value="report_mismatch_repair">report_mismatch_repair</option>
          <option value="request_more_evidence">request_more_evidence</option>
          <option value="blocked">blocked</option>
        </select>
      </label>
      <label><input id="reportReviewed" type="checkbox"> Report reviewed</label>
      <label><input id="skippedReviewed" type="checkbox"> Lifecycle skipped rows reviewed</label>
      <label><input id="evidenceOnly" type="checkbox"> delivery_allowed is evidence only</label>
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
      return {
        ...template,
        teacherDecision: document.getElementById("decision").value,
        reportReviewed: document.getElementById("reportReviewed").checked,
        lifecycleSkippedRowsReviewed: document.getElementById("skippedReviewed").checked,
        deliveryAllowedEvidenceOnlyConfirmed: document.getElementById("evidenceOnly").checked,
        rollbackRetained: document.getElementById("rollback").checked,
        teacherConfirmedNoExecution: document.getElementById("noExecution").checked,
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
      format: "transparent_ai_real_case_confirmed_outcome_validation_report_review_receipt_builder_result_v1",
      builderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      ...sourceContext,
      summary: packet.summary,
      executeNow: false,
      locks: builderLocks
    },
    null,
    2
  )
);
