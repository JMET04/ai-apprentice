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

function readJsonInput(input, label, expectedFormat = "", required = true) {
  const text = String(input || "").trim();
  if (!text && !required) return { value: null, path: "" };
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed && !required) return { value: null, path: text };
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
    String(value || "original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt"
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
    receiptDraftOnly: true,
    commandTemplateOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotValidateCockpitReceipt: true,
    builderDoesNotRunMetadataGate: true,
    builderDoesNotReadLogs: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotRegisterSchedule: true,
    builderDoesNotWriteMemory: true,
    metadataGateRunnerInvoked: false,
    boundedTailReadInvoked: false,
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

const goal = argValue("--goal", "Build a waiting-row cockpit receipt draft from validated blocked waiting-row evidence.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--evidence-plan-receipt-validation", "")),
  "--validation",
  "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_validation_v1"
);
const validation = validationInput.value;
const cockpitInput = readJsonInput(
  argValue("--cockpit", validation.sourceEvidence?.sourceCockpit || ""),
  "--cockpit",
  "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1",
  false
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue(
      "--out-dir",
      join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builders")
    )
  )
);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const builderDir = join(outputRoot, builderId);
const builderPath = join(builderDir, "original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.json");
const receiptDraftPath = join(builderDir, "teacher-low-token-waiting-row-cockpit-receipt-from-evidence-plan-return-draft.json");
const htmlPath = join(builderDir, "original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_LOW_TOKEN_EVIDENCE_RETURN_COCKPIT_RECEIPT_BUILDER_START_HERE.md");
const lockState = locks();
const readyValidation =
  validation.ok === true &&
  validation.status === "evidence_plan_receipt_ready_to_return_to_waiting_row_cockpit" &&
  (validation.counts?.invalidRows || 0) === 0;
const cockpit = cockpitInput.value;
const blockedReasons = [];
if (!readyValidation) blockedReasons.push("evidence_plan_receipt_validation_not_ready");
if (!cockpit) blockedReasons.push("source_cockpit_missing_or_unreadable");
const readyRowIds = new Set(
  (validation.validationRows || [])
    .filter((row) => row.readyToReturnToCockpitReview === true)
    .map((row) => String(row.rowId))
);
const rowDecisions = (cockpit?.reviewRows || []).map((row) => {
  const readyFromEvidenceReturn = readyValidation && readyRowIds.has(String(row.rowId));
  return {
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber || "",
    software: row.software || "",
    teacherDecision: readyFromEvidenceReturn ? "teacher_ready_for_metadata_gate_receipt" : "needs_teacher_review",
    evidenceReviewed: readyFromEvidenceReturn,
    allowMetadataGatePreparation: readyFromEvidenceReturn,
    evidencePlanReceiptValidationPath: validationInput.path,
    evidencePlanReturnValidated: readyFromEvidenceReturn,
    reviewerNote: readyFromEvidenceReturn
      ? "Drafted from a validated blocked waiting-row evidence-plan receipt. Teacher must review this cockpit receipt before validation."
      : "No validated evidence-plan return was found for this row; keep it in teacher review."
  };
});
const nextValidationCommand =
  blockedReasons.length === 0
    ? commandLine("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
        ["--cockpit", cockpitInput.path || validation.sourceEvidence?.sourceCockpit || "<original-goal-low-token-coverage-waiting-row-cockpit.json>"],
        ["--receipt", receiptDraftPath],
        ["--output-dir", join(builderDir, "waiting-row-cockpit-receipt-validation")]
      ])
    : "";
const receiptDraft = {
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_v1",
  cockpitId: cockpit?.cockpitId || "",
  decision: "needs_teacher_review",
  defaultDecision: "needs_teacher_review",
  draftSource: "validated_blocked_waiting_row_evidence_plan_receipt",
  evidencePlanReceiptValidationPath: validationInput.path,
  sourceEvidence: {
    cockpit: cockpitInput.path || validation.sourceEvidence?.sourceCockpit || "",
    evidencePlanReceiptValidation: validationInput.path
  },
  rowDecisions,
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
  locks: lockState
};
const receiptDraftReady = cockpit && blockedReasons.length === 0;
if (receiptDraftReady) writeJson(receiptDraftPath, receiptDraft);
const builder = {
  ok: blockedReasons.length === 0,
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_return_cockpit_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status:
    blockedReasons.length === 0
      ? "return_cockpit_receipt_draft_ready_for_teacher_review"
      : "blocked_until_evidence_plan_validation_and_source_cockpit_are_ready",
  sourceEvidence: {
    validation: validationInput.path,
    cockpit: cockpitInput.path || validation.sourceEvidence?.sourceCockpit || ""
  },
  counts: {
    cockpitRows: cockpit?.reviewRows?.length || 0,
    readyEvidenceReturnRows: readyRowIds.size,
    draftedReadyRows: rowDecisions.filter((row) => row.evidencePlanReturnValidated).length,
    blockedReasons: blockedReasons.length
  },
  blockedReasons,
  receiptDraftPath: receiptDraftReady ? receiptDraftPath : "",
  nextValidationCommand,
  nextSafeCommand: nextValidationCommand
    ? {
        tool: "validate_original_goal_low_token_coverage_waiting_row_cockpit_receipt",
        commandLine: nextValidationCommand,
        executeNow: false,
        blockedUntil: "teacher reviews the generated waiting-row cockpit receipt draft"
      }
    : null,
  blockedTransitions: [
    "auto_accept_generated_cockpit_receipt",
    "run_metadata_gate_from_return_cockpit_receipt_builder",
    "read_logs_from_return_cockpit_receipt_builder",
    "read_full_logs_from_return_cockpit_receipt_builder",
    "capture_screenshot_from_return_cockpit_receipt_builder",
    "execute_target_software_from_return_cockpit_receipt_builder",
    "register_schedule_from_return_cockpit_receipt_builder",
    "write_memory_from_return_cockpit_receipt_builder",
    "claim_all_software_coverage_complete_from_return_cockpit_receipt_builder",
    "claim_original_goal_complete_from_return_cockpit_receipt_builder"
  ],
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    goalComplete: false,
    reason:
      "This builder only drafts a teacher-review cockpit receipt from validated blocked-row evidence. It never validates the receipt or runs metadata gates."
  },
  paths: {
    builder: builderPath,
    receiptDraft: receiptDraftReady ? receiptDraftPath : "",
    html: htmlPath,
    readme: readmePath
  },
  locks: lockState
};
writeJson(builderPath, builder);
const rowsHtml = rowDecisions
  .map(
    (row) =>
      `<tr><td>${htmlEscape(row.rowId)}</td><td>${htmlEscape(row.software)}</td><td>${htmlEscape(
        row.teacherDecision
      )}</td><td>${htmlEscape(row.evidencePlanReturnValidated)}</td><td>${htmlEscape(row.reviewerNote)}</td></tr>`
  )
  .join("\n");
writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>Evidence Return Cockpit Receipt Builder</title><style>body{font-family:Arial,sans-serif;margin:24px;line-height:1.4}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;vertical-align:top}code{background:#f5f5f5;padding:2px 4px}</style></head><body><h1>Evidence Return Cockpit Receipt Builder</h1><p>Status: <code>${htmlEscape(builder.status)}</code></p><p>Next validation command: <code>${htmlEscape(nextValidationCommand)}</code></p><table><thead><tr><th>Row</th><th>Software</th><th>Draft decision</th><th>Evidence return</th><th>Note</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>\n`,
  "utf8"
);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Evidence Return Cockpit Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Draft ready rows: ${builder.counts.draftedReadyRows}/${builder.counts.cockpitRows}`,
    "",
    "This builder creates only a teacher-review draft receipt for the waiting-row cockpit.",
    "It does not validate the receipt, run metadata gates, read logs, read full logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "",
    "Next validation command:",
    nextValidationCommand || "- none"
  ].join("\n"),
  "utf8"
);
console.log(
  JSON.stringify(
    {
      ok: builder.ok,
      format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_return_cockpit_receipt_builder_result_v1",
      status: builder.status,
      builderPath,
      receiptDraftPath: builder.receiptDraftPath,
      htmlPath,
      readmePath,
      counts: builder.counts,
      nextValidationCommand,
      nextSafeCommand: builder.nextSafeCommand,
      executeNow: false,
      locks: lockState
    },
    null,
    2
  )
);
if (!builder.ok) process.exit(1);
