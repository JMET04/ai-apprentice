#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
    String(value || "original-goal-low-token-blocked-waiting-row-evidence-plan-receipt")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "original-goal-low-token-blocked-waiting-row-evidence-plan-receipt"
  );
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    receiptBuilderOnly: true,
    commandTemplateOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotReadLogs: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotRunMetadataGate: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotRegisterSchedule: true,
    builderDoesNotWriteMemory: true,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

const goal = argValue("--goal", "Build a teacher receipt for blocked low-token waiting-row evidence acquisition.");
const planInput = readJsonInput(
  argValue("--plan", argValue("--evidence-plan", "")),
  "--plan",
  "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    argValue(
      "--output-dir",
      join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-builders")
    )
  )
);
const plan = planInput.value;
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(plan.planId || goal)}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "teacher-low-token-blocked-waiting-row-evidence-plan-receipt-template.json");
const readmePath = join(builderDir, "ORIGINAL_GOAL_LOW_TOKEN_BLOCKED_WAITING_ROW_EVIDENCE_PLAN_RECEIPT_BUILDER_START_HERE.md");
const htmlPath = join(builderDir, "original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-builder.html");

const receiptRows = (plan.actionRows || []).map((row) => ({
  rowId: row.rowId,
  ledgerNumber: row.ledgerNumber || "",
  software: row.software || "",
  missingEvidenceKinds: row.missingEvidenceKinds || [],
  sourceCoverageContractStatus: row.coverageContractReview?.status || "",
  sourceCoverageContractAllowsMetadataGateReview: row.coverageContractReview?.allowsMetadataGateReview === true,
  sourceCoverageContractMissingRequirements: row.coverageContractReview?.missingRequirements || [],
  sourceLowTokenRouteGap: row.lowTokenRouteGap || {},
  teacherDecision: "evidence_collected_return_to_cockpit_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "evidence_collected_return_to_cockpit_review",
    "blocked_needs_more_low_token_evidence",
    "teacher_excluded_from_monitoring",
    "correction_to_high_reasoning_repair"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "run_metadata_gate_now",
    "read_logs_now",
    "read_full_logs",
    "capture_screenshot_now",
    "execute_now",
    "write_memory",
    "register_schedule",
    "unlock_packaging",
    "claim_complete"
  ],
  logSourceOrFallbackReviewed: false,
  compactWatchEvidenceReviewed: false,
  teacherReviewCompleted: false,
  sourceRouteOrFallbackSummary: "",
  compactEvidenceSummary: "",
  reviewedEvidencePathOrSignal: "",
  reviewerNote: ""
}));

const receiptTemplate = {
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_v1",
  builderId,
  sourcePlanPath: planInput.path,
  planId: plan.planId || "",
  teacherDecision: receiptRows.length ? "evidence_collected_return_to_cockpit_review" : "acknowledge_no_blocked_rows",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "evidence_collected_return_to_cockpit_review",
    "acknowledge_no_blocked_rows",
    "blocked",
    "correction_to_high_reasoning_repair"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "run_metadata_gate_now",
    "read_logs_now",
    "read_full_logs",
    "capture_screenshot_now",
    "execute_now",
    "write_memory",
    "register_schedule",
    "unlock_packaging",
    "claim_complete"
  ],
  blockedShortcutsReviewed: false,
  noFullLogReadConfirmed: false,
  noScreenshotConfirmed: false,
  noSoftwareExecutionConfirmed: false,
  rollbackRetained: false,
  receiptRows,
  teacherNote: "",
  locks: locks()
};

const nextValidationCommand = commandLine("validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs", [
  ["--plan", planInput.path || "<original-goal-low-token-blocked-waiting-row-evidence-plan.json>"],
  ["--receipt", "<teacher-filled-low-token-blocked-waiting-row-evidence-plan-receipt.json>"],
  ["--output-dir", join(builderDir, "receipt-validation")]
]);
const builder = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "blocked_waiting_row_evidence_plan_receipt_builder_ready_for_teacher_use",
  sourcePlanPath: planInput.path,
  planId: plan.planId || "",
  planStatus: plan.status || "",
  actionRowCount: receiptRows.length,
  receiptTemplatePath,
  nextValidationCommand,
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath,
    sourcePlan: planInput.path
  },
  locks: locks()
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Blocked Waiting Row Evidence Plan Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Action rows: ${builder.actionRowCount}`,
    "",
    "Fill the receipt after the teacher reviews log-source/fallback evidence, compact watch evidence, or explicit exclusion for each blocked waiting row.",
    "",
    "Safety boundary:",
    "- This builder is review-only.",
    "- It does not validate the receipt, run metadata gates, read logs, read full logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "",
    "Next validation command:",
    builder.nextValidationCommand
  ].join("\n"),
  "utf8"
);

const rows = receiptRows
  .map(
    (row) =>
      `<tr><td>${htmlEscape(row.rowId)}</td><td>${htmlEscape(row.software)}</td><td>${htmlEscape(
        row.missingEvidenceKinds.join(", ")
      )}</td></tr>`
  )
  .join("\n");
writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>Blocked Waiting Row Evidence Receipt Builder</title><style>body{font-family:Arial,sans-serif;margin:24px;line-height:1.4}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;vertical-align:top}code,pre{background:#f5f5f5;padding:2px 4px}pre{white-space:pre-wrap}</style></head><body><h1>Blocked Waiting Row Evidence Receipt Builder</h1><p>Status: <code>${htmlEscape(builder.status)}</code></p><table><thead><tr><th>Row</th><th>Software</th><th>Missing evidence</th></tr></thead><tbody>${rows || "<tr><td colspan=\"3\">No blocked rows.</td></tr>"}</tbody></table><h2>Validation Command</h2><pre>${htmlEscape(nextValidationCommand)}</pre></body></html>\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_builder_result_v1",
      status: builder.status,
      builderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      actionRowCount: receiptRows.length,
      nextValidationCommand,
      locks: builder.locks
    },
    null,
    2
  )
);
