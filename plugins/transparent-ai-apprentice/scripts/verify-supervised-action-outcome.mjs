#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function multiArg(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return String(value || "supervised-action-outcome")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "supervised-action-outcome";
}

function readJsonInput(value, label, optional = false) {
  if (!value) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8").replace(/^\uFEFF/, "")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function receiptStatus(value) {
  return String(value?.status || "unknown");
}

function isExistingExecutionReceipt(receipt) {
  return receipt?.format === "transparent_ai_existing_software_execution_receipt_v1";
}

function receiptWasDryRunWithoutEvents(receipt) {
  const status = receiptStatus(receipt);
  return (
    status === "dry_run" ||
    status.startsWith("dry_run_no_") ||
    (isExistingExecutionReceipt(receipt) && receipt.mode === "dry_run")
  );
}

function receiptWasBlockedBeforeEvents(receipt) {
  const status = receiptStatus(receipt);
  return status === "blocked_by_preflight" || status.startsWith("blocked_");
}

function normalizeExecutedActionIds(receipt) {
  return Array.isArray(receipt?.executedActionIds) ? receipt.executedActionIds.map(String) : [];
}

function outcomeStatus(receipt, metadataGateResult, teacherMarkers) {
  const status = receiptStatus(receipt);
  if (receiptWasDryRunWithoutEvents(receipt)) {
    return isExistingExecutionReceipt(receipt) ? "existing_execution_dry_run_verified_no_events" : "dry_run_verified_no_ui_events";
  }
  if (receiptWasBlockedBeforeEvents(receipt)) {
    return isExistingExecutionReceipt(receipt) ? "blocked_before_existing_execution" : "blocked_before_ui_events";
  }
  if (status === "not_run_yet" || status === "unknown") return "receipt_waiting_for_runner";
  const changed = Number(metadataGateResult?.changedLogMetadata ?? 0) > 0;
  const markerPresent = teacherMarkers.length > 0;
  if (changed) return "post_action_metadata_changed_waiting_for_teacher_review";
  if (markerPresent) return "teacher_marker_waiting_for_visual_review";
  return "execution_receipt_waiting_for_teacher_review";
}

function nextTeacherActionFor(status) {
  if (status === "existing_execution_dry_run_verified_no_events") {
    return "Review the existing-route dry-run receipt, runner target, and route-specific inputs before teacher-confirmed execution.";
  }
  if (status === "blocked_before_existing_execution") {
    return "Fix the reviewed route input, target, command, endpoint, file mapping, or active-window blocker before any existing-route execution.";
  }
  if (status === "dry_run_verified_no_ui_events") {
    return "Review the dry-run preflight and action coordinates; run the supervised runner only after teacher confirmation.";
  }
  if (status === "blocked_before_ui_events") {
    return "Fix the active-window, coordinate, or teacher-confirmation blocker before any UI events are allowed.";
  }
  if (status === "post_action_metadata_changed_waiting_for_teacher_review") {
    return "Review the changed metadata and narrowed queue; read only changed tails or inspect a triggered screenshot if metadata is ambiguous.";
  }
  if (status === "teacher_marker_waiting_for_visual_review") {
    return "Use the teacher marker to decide whether one reviewed screenshot is needed before learning.";
  }
  if (status === "receipt_waiting_for_runner") {
    return "Run the supervised action runner in dry-run mode first so it writes a receipt and preflight.";
  }
  return "Ask the teacher whether the visible result matched the overlay intent before saving any reusable rule.";
}

const receiptInput = readJsonInput(argValue("--receipt", argValue("--execution-receipt", "")), "--receipt");
const planInput = readJsonInput(argValue("--plan", argValue("--action-plan", "")), "--plan", true);
const preflightInput = readJsonInput(argValue("--preflight", ""), "--preflight", true);
const queueInputRaw = argValue("--queue", argValue("--queue-path", ""));
const queueInput = queueInputRaw ? readJsonInput(queueInputRaw, "--queue", true) : { value: null, path: "" };
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "supervised-action-outcome-verifications")));
const state = argValue("--state", "");
const stateDir = argValue("--state-dir", join(outputRoot, "_metadata-state"));
const teacherMarkers = multiArg("--teacher-marker");
const maxItems = argValue("--max-items", "12");
const maxLogsPerItem = argValue("--max-logs-per-item", "8");

mkdirSync(outputRoot, { recursive: true });
const receipt = receiptInput.value;
const plan = planInput.value;
const preflight = preflightInput.value;
const verificationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(receipt.kitId || basename(receiptInput.path || "receipt"))}`;
const verificationDir = join(outputRoot, verificationId);
mkdirSync(verificationDir, { recursive: true });

let metadataGateResult = null;
if (queueInput.value) {
  const args = ["--queue", queueInput.path || JSON.stringify(queueInput.value), "--output-dir", join(verificationDir, "metadata-gate"), "--state-dir", stateDir, "--max-items", maxItems, "--max-logs-per-item", maxLogsPerItem];
  if (state) args.push("--state", state);
  for (const marker of teacherMarkers) args.push("--teacher-marker", marker);
  metadataGateResult = runNodeScript("watch-log-source-metadata-deltas.mjs", args);
}

const status = outcomeStatus(receipt, metadataGateResult, teacherMarkers);
const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  logContentsRead: false,
  fullLogsRead: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true
};

const verificationPath = join(verificationDir, "supervised-action-outcome-verification.json");
const receiptPath = join(verificationDir, "supervised-action-outcome-verification-receipt.json");

const verification = {
  format: "transparent_ai_supervised_action_outcome_verification_v1",
  verificationId,
  createdAt: new Date().toISOString(),
  lowTokenStrategy:
    "Verify supervised or existing-route software action results from runner receipt, preflight, optional metadata-only log deltas, file/event markers, and teacher review before screenshots or memory writes.",
  receiptFamily: isExistingExecutionReceipt(receipt) ? "existing_software_execution" : "supervised_ui_action",
  sourceEvidence: {
    executionReceiptPath: receiptInput.path,
    actionPlanPath: planInput.path || receipt.planPath || "",
    preflightPath: preflightInput.path || receipt.preflightPath || "",
    queuePath: queueInput.path || "",
    teacherMarkers
  },
  executionReceipt: {
    format: receipt.format || "unknown",
    adapterId: receipt.adapterId || "",
    mode: receipt.mode || "",
    status: receiptStatus(receipt),
    reason: receipt.reason || "",
    teacherConfirmed: Boolean(receipt.teacherConfirmed),
    executeSwitchPresent: Boolean(receipt.executeSwitchPresent || receipt.execute),
    uiEventsSent: receipt.uiEventsSent ?? null,
    browserAutomationAttempted: receipt.browserAutomationAttempted ?? null,
    commandExecuted: receipt.commandExecuted ?? null,
    apiRequestSent: receipt.apiRequestSent ?? null,
    filesWrittenForImport: receipt.filesWrittenForImport ?? null,
    preflightStatus: receipt.preflightStatus || preflight?.status || "unknown",
    activeWindowTitleMatched: receipt.activeWindowTitleMatched ?? preflight?.activeWindowTitleMatched ?? null,
    coordinateBoundsOk: receipt.coordinateBoundsOk ?? preflight?.coordinateBoundsOk ?? null,
    plannedActionCount: receipt.plannedActionCount ?? plan?.actions?.length ?? 0,
    executedActionIds: normalizeExecutedActionIds(receipt)
  },
  metadataGate: metadataGateResult
    ? {
        status: metadataGateResult.status,
        gatePath: metadataGateResult.gatePath,
        receiptPath: metadataGateResult.receiptPath,
        statePath: metadataGateResult.statePath,
        narrowedQueuePath: metadataGateResult.narrowedQueuePath,
        baselineWasPresent: metadataGateResult.baselineWasPresent,
        scannedLogMetadata: metadataGateResult.scannedLogMetadata,
        changedLogMetadata: metadataGateResult.changedLogMetadata,
        logContentsRead: false,
        screenshotsCaptured: false,
        fullContinuousRecording: false
      }
    : null,
  result: {
    status,
    outcomeAccepted: false,
    canSaveRule: false,
    canUnlockPackaging: false,
    teacherReviewRequired: true,
    screenshotRecommended:
      status === "teacher_marker_waiting_for_visual_review" ||
      (status === "execution_receipt_waiting_for_teacher_review" && normalizeExecutedActionIds(receipt).length > 0),
    nextTeacherAction: nextTeacherActionFor(status)
  },
  nextCalls: [
    metadataGateResult?.narrowedQueuePath
      ? {
          tool: "run_software_observer_watch_cycle",
          when: "Only if the teacher wants bounded tail evidence for changed logs after reviewing metadata.",
          arguments: { queue: metadataGateResult.narrowedQueuePath, maxTailLines: 80, maxTailBytes: 65536 }
        }
      : null,
    {
      tool: "teach_apprentice",
      when: "Only after the teacher confirms the visible outcome and provides any correction or boundary.",
      arguments: {
        message: "Teacher-reviewed supervised action outcome verification plus correction or approval.",
        file: verificationPath
      }
    },
    {
      tool: "correct_last_result",
      when: "If the visible result did not match the teacher overlay intent.",
      arguments: { correction: "Teacher explains how the action/result differed from intent." }
    }
  ].filter(Boolean),
  locks
};

const verificationReceipt = {
  format: "transparent_ai_supervised_action_outcome_verification_receipt_v1",
  verificationId,
  status,
  verificationPath,
  sourceExecutionReceipt: receiptInput.path,
  sourcePreflight: preflightInput.path || receipt.preflightPath || "",
  metadataGateStatus: metadataGateResult?.status || "not_run",
  narrowedQueuePath: metadataGateResult?.narrowedQueuePath || "",
  executedActionIds: normalizeExecutedActionIds(receipt),
  outcomeAccepted: false,
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  logContentsRead: false,
  fullLogsRead: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true,
  nextTeacherAction: verification.result.nextTeacherAction
};

writeFileSync(verificationPath, JSON.stringify(verification, null, 2), "utf8");
writeFileSync(receiptPath, JSON.stringify(verificationReceipt, null, 2), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_supervised_action_outcome_verification_result_v1",
  status,
  verificationId,
  verificationPath,
  receiptPath,
  metadataGateStatus: verificationReceipt.metadataGateStatus,
  narrowedQueuePath: verificationReceipt.narrowedQueuePath,
  outcomeAccepted: false,
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  logContentsRead: false,
  fullLogsRead: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  nativeUniversalExecution: false
}, null, 2));
