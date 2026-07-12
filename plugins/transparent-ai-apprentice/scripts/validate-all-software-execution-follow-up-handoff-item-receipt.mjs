#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "execution-handoff-item-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-handoff-item-receipt-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonOptional(path) {
  if (!path || !existsSync(path)) return null;
  return readJson(path);
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["dry_run_matched_expected", "matched_expected", "ready_for_execute_gate", "ready_for_execution_approval_gate"].includes(text)) {
    return "dry_run_matched_expected";
  }
  if (["dry_run_mismatch_blocked", "mismatch_blocked", "blocked", "blocked_needs_more_evidence"].includes(text)) {
    return "dry_run_mismatch_blocked";
  }
  if (["accepted", "execute_now", "run_execute_mode", "write_memory", "claim_complete", "native_universal_execution", "unlock_packaging"].includes(text)) {
    return text;
  }
  return "needs_teacher_review";
}

function flagName(key) {
  return `--${String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase()}`;
}

function quoteArg(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '\\"')}"`;
}

function commandLine(scriptName, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${scriptName}`];
  for (const [key, value] of args) {
    if (value === false || value === null || value === undefined || value === "") continue;
    if (value === true) parts.push(flagName(key));
    else parts.push(flagName(key), quoteArg(value));
  }
  return parts.join(" ");
}

function routeEvidenceArg(adapterId, selectedArgs = {}) {
  if (adapterId === "existing-cli-or-script") {
    return ["reviewed-command", selectedArgs.reviewedCommand || "<reviewed-existing-cli-command-manifest.json>"];
  }
  if (adapterId === "existing-application-api") {
    return ["reviewed-api-request", selectedArgs.reviewedApiRequest || "<reviewed-application-api-request.json>"];
  }
  if (adapterId === "existing-file-import-export") {
    return ["reviewed-mapping", selectedArgs.reviewedMapping || "<reviewed-file-import-export-mapping.json>"];
  }
  if (adapterId === "existing-browser-automation") {
    return ["reviewed-browser-target", selectedArgs.reviewedBrowserTarget || "<reviewed-browser-target.json>"];
  }
  return ["target-window-title", selectedArgs.targetWindowTitle || "<visible-target-window-title>"];
}

function writeReadme(path, validation) {
  const lines = [
    "# Execution Follow-Up Handoff Item Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Selected row: ${validation.selected?.rowId || ""}`,
    "",
    "Review result:",
    `- ${validation.reviewRow.status}: ${validation.reviewRow.reason}`,
    "",
    "Prepared next commands:",
    ...validation.nextReviewCommands.map((command, index) => `${index + 1}. ${command.label}: ${command.command}`),
    "",
    "Safety boundary:",
    "- This validation does not create an approval gate.",
    "- It does not invoke runners, execute target software, send UI events, read logs, capture screenshots, register schedules, write memory, enable rules, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate teacher review for one dry-run execution handoff item.");
const runInput = readJsonInput(
  argValue("--run", argValue("--item-run", "")),
  "--run",
  "transparent_ai_all_software_execution_follow_up_handoff_queue_item_run_v1"
);
if (!runInput.value) throw new Error("--run is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_execution_follow_up_handoff_item_review_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-handoff-item-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const run = runInput.value;
const receipt = receiptInput.value;
const selectedArgs = run.selectedItem?.arguments || {};
const pilotRunnerReceipt = readJsonOptional(run.generatedEvidence?.pilotRunnerReceiptPath);
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecision = ["accepted", "execute_now", "run_execute_mode", "write_memory", "claim_complete", "native_universal_execution", "unlock_packaging"].includes(decision);
const allEvidenceReviewed =
  receipt.evidenceReviewed === true &&
  receipt.pilotRunnerReceiptReviewed === true &&
  receipt.outcomeVerificationReviewed === true &&
  receipt.postActionCheckpointReviewed === true;
const dryRunEvidencePresent =
  run.runnerInvoked === true &&
  run.executeRequested !== true &&
  run.status === "dry_run_pilot_runner_completed_waiting_for_teacher_review" &&
  Boolean(run.generatedEvidence?.pilotRunnerReceiptPath) &&
  Boolean(run.generatedEvidence?.outcomeVerificationPath) &&
  Boolean(run.generatedEvidence?.postActionCheckpointPath) &&
  pilotRunnerReceipt?.format === "transparent_ai_all_software_execution_pilot_runner_receipt_v1";
const matchedExpected = decision === "dry_run_matched_expected" && receipt.teacherMatchedExpected === true;

let rowStatus = "needs_teacher_review";
let reason = "teacher has not marked this dry-run handoff item as matched or blocked";
if (forbiddenDecision) {
  rowStatus = "blocked_for_forbidden_decision";
  reason = "receipt used a forbidden decision that would cross execute, memory, packaging, or completion boundaries";
} else if (decision === "dry_run_mismatch_blocked") {
  rowStatus = "dry_run_mismatch_blocked";
  reason = "teacher marked the dry-run result as mismatched or blocked";
} else if (matchedExpected && !allEvidenceReviewed) {
  rowStatus = "missing_required_review_evidence";
  reason = "teacher marked match but did not confirm every required review artifact";
} else if (matchedExpected && !dryRunEvidencePresent) {
  rowStatus = "missing_dry_run_runner_evidence";
  reason = "the item run does not contain complete dry-run runner receipt, outcome verification, and checkpoint evidence";
} else if (matchedExpected) {
  rowStatus = "ready_for_execution_approval_gate_planning";
  reason = "teacher reviewed all dry-run evidence and marked the route as matching expected intent";
}

const adapterId = run.pilotRunnerResult?.adapterId || selectedArgs.adapterId || "";
const routeArg = routeEvidenceArg(adapterId, selectedArgs);
const approvalGateCommand =
  rowStatus === "ready_for_execution_approval_gate_planning"
    ? commandLine("create-real-local-execution-approval-gate.mjs", [
        ["goal", "Prepare execute approval gate after matched dry-run handoff item"],
        ["selector", "<real-local-execution-pilot-selector.json>"],
        ["queue", run.sourceEvidence?.executionPilotQueuePath || selectedArgs.queue || "<execution-pilot-queue.json>"],
        ["selected-pilot-id", run.pilotRunnerResult?.pilotId || selectedArgs.pilotId || "<pilot-id>"],
        ["adapter-id", adapterId || "<adapter-id>"],
        [routeArg[0], routeArg[1]],
        ["teacher-confirmation", "<teacher-confirmed-execution-pilot-text>"],
        ["rollback-point-created", true],
        ["output-dir", join(validationDir, "execution-approval-gate")]
      ])
    : "";

const nextReviewCommands = approvalGateCommand
  ? [
      {
        label: "Prepare execution approval gate from matched dry-run evidence",
        tool: "create_real_local_execution_approval_gate",
        command: approvalGateCommand,
        blockedUntil:
          "teacher provides selector, exact reviewed route evidence, execute confirmation text, and a rollback point for this execute attempt",
        executesNow: false
      }
    ]
  : [];
const validationDecision = forbiddenDecision
  ? "blocked_for_forbidden_decision"
  : rowStatus === "ready_for_execution_approval_gate_planning"
    ? "ready_for_execution_approval_gate_planning"
    : rowStatus === "dry_run_mismatch_blocked"
      ? "blocked_by_teacher_mismatch"
      : "needs_teacher_review";
const status = rowStatus === "ready_for_execution_approval_gate_planning" ? "validated_ready_for_next_gate_review" : forbiddenDecision || rowStatus.includes("blocked") ? "blocked" : "waiting_for_teacher_review";

const validationPath = join(validationDir, "all-software-execution-handoff-item-receipt-validation.json");
const receiptPath = join(validationDir, "all-software-execution-handoff-item-receipt-validation-receipt.json");
const readmePath = join(validationDir, "ALL_SOFTWARE_EXECUTION_HANDOFF_ITEM_RECEIPT_VALIDATION_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  validationDoesNotCreateApprovalGate: true,
  validationDoesNotInvokeRunner: true,
  validationDoesNotExecuteTargetSoftware: true,
  validationDoesNotSendUiEvents: true,
  validationDoesNotReadLogs: true,
  validationDoesNotCaptureScreenshots: true,
  validationDoesNotRegisterSchedule: true,
  validationDoesNotWriteMemory: true,
  approvalGateCreated: false,
  dryRunRunnerInvoked: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false
};
const validation = {
  ok: true,
  format: "transparent_ai_all_software_execution_follow_up_handoff_item_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed: forbiddenDecision,
  selected: {
    rowId: run.selectedItem?.rowId || "",
    pilotId: run.pilotRunnerResult?.pilotId || selectedArgs.pilotId || "",
    adapterId,
    software: run.pilotRunnerResult?.software || ""
  },
  reviewRow: {
    itemRunId: run.runId,
    receiptDecision: receipt.teacherDecision || "",
    normalizedDecision: decision,
    allEvidenceReviewed,
    teacherMatchedExpected: receipt.teacherMatchedExpected === true,
    dryRunEvidencePresent,
    pilotRunnerReceiptStatus: pilotRunnerReceipt?.status || "",
    status: rowStatus,
    reason
  },
  nextReviewCommands,
  blockedTransitions: [
    "create_approval_gate_from_validation",
    "invoke_runner_from_validation",
    "execute_target_software_from_validation",
    "send_ui_events_from_validation",
    "read_logs_from_validation",
    "capture_screenshot_from_validation",
    "register_schedule_from_validation",
    "write_memory_from_validation",
    "claim_all_software_execution_complete_from_validation",
    "claim_native_universal_execution_from_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceItemRun: runInput.path,
    sourceTeacherReceipt: receiptInput.path,
    pilotRunnerReceipt: run.generatedEvidence?.pilotRunnerReceiptPath || "",
    outcomeVerification: run.generatedEvidence?.outcomeVerificationPath || "",
    postActionCheckpoint: run.generatedEvidence?.postActionCheckpointPath || ""
  },
  locks
};
const validationReceipt = {
  format: "transparent_ai_all_software_execution_follow_up_handoff_item_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  reviewRowStatus: rowStatus,
  nextReviewCommandCount: nextReviewCommands.length,
  approvalGateCreated: false,
  dryRunRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false,
  locks
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_follow_up_handoff_item_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      reviewRowStatus: rowStatus,
      validationPath,
      receiptPath,
      readmePath,
      nextReviewCommandCount: nextReviewCommands.length,
      approvalGateCreated: false,
      dryRunRunnerInvoked: false,
      targetSoftwareCommandsExecuted: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecision) process.exit(1);
