#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "engineering-command-target-confirmation-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "engineering-command-target-confirmation-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function readOptionalJson(path) {
  if (!path || !existsSync(path)) return null;
  return readJson(path);
}

function samePath(left, right) {
  if (!left || !right) return false;
  return resolve(left).toLowerCase() === resolve(right).toLowerCase();
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRunActionKit: true,
    validationDoesNotRunExecutionAdapter: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotSendUiEvents: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotWriteMemory: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Engineering Command Target Confirmation Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Selected number: ${validation.selectedCandidateNumber}`,
    `Ready for execution approval gate: ${validation.readyForExecutionApprovalGate}`,
    "",
    "Checks:",
    ...validation.checks.map((check) => `- ${check.name}: ${check.pass ? "pass" : "fail"}`),
    "",
    "Safety boundary:",
    "- This validates the numbered target confirmation only.",
    "- It does not create action kits, run adapters, execute target software, send UI events, capture screenshots, write memory, enable rules, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--confirmation", "")),
  "--receipt",
  "transparent_ai_engineering_command_target_confirmation_receipt_v1"
);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "engineering-command-target-confirmation-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify("engineering command target confirmation")}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const receipt = receiptInput.value;
const selectedNumber = Number(receipt.selectedCandidateNumber);
const overlay = readOptionalJson(receipt.narrowedOverlayPacket);
const supervisedRequest = readOptionalJson(receipt.supervisedActionBridgeRequest);
const adapterRequest = readOptionalJson(receipt.existingExecutionAdapterRequest);
const locksIn = receipt.locks || {};

const checks = [
  {
    name: "receipt narrows exactly one numbered candidate",
    pass:
      receipt.status === "teacher_confirmed_single_target_ready_for_supervised_dry_run" &&
      Number.isInteger(selectedNumber) &&
      selectedNumber >= 1 &&
      receipt.selectedCandidate?.number === selectedNumber &&
      receipt.candidateCountBeforeConfirmation >= 1 &&
      receipt.evidence?.selectedTargetOnly === true
  },
  {
    name: "narrowed overlay packet exists and binds the same selected number",
    pass:
      Boolean(overlay) &&
      overlay.format === "transparent_ai_sketch_overlay_packet_v1" &&
      overlay.overlayMode === "voice_text_confirmed_single_target" &&
      overlay.coordinateSpace?.selectedTargetOnly === true &&
      overlay.coordinateSpace?.targetNumberConfirmedByTeacher === selectedNumber &&
      Array.isArray(overlay.anchors) &&
      overlay.anchors.length === 1 &&
      overlay.anchors[0]?.selectedOnly === true &&
      overlay.anchors[0]?.number === selectedNumber &&
      Array.isArray(overlay.strokes) &&
      overlay.strokes.length === 1 &&
      overlay.strokes[0]?.selectedOnly === true
  },
  {
    name: "supervised action request exists and remains dry-run first",
    pass:
      Boolean(supervisedRequest) &&
      supervisedRequest.format === "transparent_ai_confirmed_engineering_target_supervised_action_request_v1" &&
      supervisedRequest.selectedCandidateNumber === selectedNumber &&
      supervisedRequest.selectedTargetOnly === true &&
      supervisedRequest.executionMode === "dry_run_first" &&
      supervisedRequest.softwareActionsExecuted === false
  },
  {
    name: "existing execution adapter request exists and remains dry-run route selection",
    pass:
      Boolean(adapterRequest) &&
      adapterRequest.format === "transparent_ai_confirmed_engineering_target_existing_execution_adapter_request_v1" &&
      adapterRequest.selectedCandidateNumber === selectedNumber &&
      adapterRequest.selectedTargetOnly === true &&
      adapterRequest.executionMode === "dry_run_first_route_selection" &&
      adapterRequest.softwareActionsExecuted === false
  },
  {
    name: "receipt safety locks keep execution memory rules packaging and universal claims closed",
    pass:
      locksIn.reviewOnly === true &&
      locksIn.accepted === false &&
      locksIn.ruleEnabled === false &&
      locksIn.packagingGated === true &&
      locksIn.teacherTargetNumberConfirmed === true &&
      locksIn.teacherExecutionConfirmationRequired === true &&
      locksIn.softwareActionsExecuted === false &&
      locksIn.nativeUniversalExecution === false &&
      locksIn.fullContinuousRecording === false
  },
  {
    name: "referenced paths match the generated receipt",
    pass:
      samePath(receipt.narrowedOverlayPacket, overlay ? receipt.narrowedOverlayPacket : "") &&
      samePath(receipt.supervisedActionBridgeRequest, supervisedRequest ? receipt.supervisedActionBridgeRequest : "") &&
      samePath(receipt.existingExecutionAdapterRequest, adapterRequest ? receipt.existingExecutionAdapterRequest : "")
  }
];

const failedChecks = checks.filter((check) => !check.pass);
const readyForExecutionApprovalGate = failedChecks.length === 0;
const validationPath = join(validationDir, "engineering-command-target-confirmation-validation.json");
const readmePath = join(validationDir, "ENGINEERING_COMMAND_TARGET_CONFIRMATION_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format: "transparent_ai_engineering_command_target_confirmation_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status: readyForExecutionApprovalGate
    ? "ready_for_execution_approval_gate_not_execution"
    : "blocked_invalid_command_target_confirmation_receipt",
  receiptPath: receiptInput.path,
  selectedCandidateNumber: selectedNumber,
  readyForExecutionApprovalGate,
  checks,
  failedChecks: failedChecks.map((check) => check.name),
  sourceEvidence: {
    narrowedOverlayPacket: receipt.narrowedOverlayPacket || "",
    supervisedActionBridgeRequest: receipt.supervisedActionBridgeRequest || "",
    existingExecutionAdapterRequest: receipt.existingExecutionAdapterRequest || "",
    originalConfirmation: receipt.evidence?.originalConfirmation || ""
  },
  nextAllowedActions: readyForExecutionApprovalGate
    ? ["prepare_engineering_voice_execution_approval_gate", "keep_execute_mode_blocked_until_teacher_confirmation_and_rollback"]
    : ["repair_numbered_target_confirmation_receipt"],
  blockedActions: [
    "execute_voice_command_from_unvalidated_target_receipt",
    "use_unselected_candidate_targets",
    "send_ui_events",
    "capture_screenshots",
    "write_memory",
    "enable_rules",
    "unlock_packaging",
    "claim_voice_control_complete"
  ],
  locks: locks()
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(JSON.stringify({
  ok: true,
  format: validation.format,
  validationId,
  validationPath,
  teacherReadme: readmePath,
  status: validation.status,
  selectedCandidateNumber: selectedNumber,
  readyForExecutionApprovalGate,
  failedChecks: validation.failedChecks,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  ruleEnabled: false,
  packagingGated: true,
  nativeUniversalExecution: false
}, null, 2));

if (!readyForExecutionApprovalGate) process.exitCode = 1;
