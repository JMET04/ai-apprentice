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

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "teach-execute-supervised-execution")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "teach-execute-supervised-execution";
}

function readJsonInput(input, label, optional = false) {
  if (!input) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  const text = String(input).trim();
  if (existsSync(text)) return { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  if (optional) return { value: null, path: "" };
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

function confirmationLooksExplicit(value) {
  const text = String(value || "").toLowerCase();
  return (
    hasFlag("--teacher-confirmed") ||
    [
      "teacher confirmed supervised execution",
      "i confirm supervised execution",
      "allow supervised execution",
      "approve supervised execution",
      "teacher confirmed execution gate",
      "confirm execution gate",
      "allow execution dry run",
      "confirm supervised dry run",
      "\u6211\u786e\u8ba4\u76d1\u7763\u6267\u884c",
      "\u786e\u8ba4\u76d1\u7763\u6267\u884c",
      "\u5141\u8bb8\u76d1\u7763\u6267\u884c",
      "\u540c\u610f\u6267\u884c\u95f8\u95e8",
      "\u786e\u8ba4\u6267\u884c\u95f8\u95e8"
    ].some((marker) => text.includes(marker))
  );
}

function spatialReadinessLooksConfirmed(value) {
  const text = String(value || "").toLowerCase();
  return (
    hasFlag("--spatial-readiness-confirmed") ||
    [
      "teacher confirmed spatial execution readiness",
      "spatial execution readiness confirmed",
      "i confirm spatial readiness",
      "confirm spatial readiness",
      "confirm position perspective depth",
      "position perspective and depth are correct",
      "\u6211\u786e\u8ba4\u7a7a\u95f4\u6267\u884c\u7406\u89e3",
      "\u786e\u8ba4\u7a7a\u95f4\u6267\u884c\u7406\u89e3",
      "\u786e\u8ba4\u4f4d\u7f6e\u900f\u89c6\u6df1\u5ea6",
      "\u4f4d\u7f6e\u900f\u89c6\u6df1\u5ea6\u6b63\u786e"
    ].some((marker) => text.includes(marker))
  );
}

function locks({ executed = false, executeRequested = false } = {}) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    memoryEnabled: false,
    nativeUniversalExecution: false,
    softwareActionsExecuted: executed,
    teacherConfirmationRequired: true,
    targetWindowTitleRequiredForExecute: true,
    spatialReadinessConfirmationRequiredForExecute: true,
    dryRunOnly: !executeRequested,
    privateChainOfThoughtExposed: false
  };
}

function defaultOutputRoot() {
  const cwd = resolve(process.cwd());
  const lower = cwd.toLowerCase();
  if (lower.includes(`${join(".codex", "plugins", "cache").toLowerCase()}`)) {
    return join(process.env.TEMP || process.env.TMP || cwd, "transparent-ai-apprentice-cache-smoke", "teach-execute-supervised-executions");
  }
  return join(cwd, ".transparent-apprentice", "teach-execute-supervised-executions");
}

function evidencePath(rehearsal, key) {
  return rehearsal?.generatedEvidence?.[key] || "";
}

function readJsonPath(path, optional = false) {
  if (!path || !existsSync(path)) {
    if (optional) return null;
    throw new Error(`Expected JSON evidence path does not exist: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writePacket(outDir, payload, receipt) {
  const packetPath = join(outDir, "teach-execute-supervised-execution.json");
  const receiptPath = join(outDir, "teach-execute-supervised-execution-receipt.json");
  const readmePath = join(outDir, "TEACH_EXECUTE_SUPERVISED_EXECUTION_START_HERE.md");
  writeFileSync(packetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  writeFileSync(
    readmePath,
    [
      "# Teach Execute Supervised Execution Gate",
      "",
      `Status: ${payload.status}`,
      "",
      payload.reason || "Review the execution gate packet, runner receipt, preflight, and low-token outcome verification.",
      "",
      "This packet is the gate after action rehearsal. It does not approve memory, accept the technology, unlock packaging, or expose private chain-of-thought.",
      "",
      "Review order:",
      payload.generatedEvidence?.supervisedActionPlan ? `1. ${basename(payload.generatedEvidence.supervisedActionPlan)} - reviewed action plan from the rehearsal.` : "1. Action plan evidence was not available.",
      payload.generatedEvidence?.spatialExecutionReadiness ? `2. ${basename(payload.generatedEvidence.spatialExecutionReadiness)} - teacher-reviewed position, perspective, and depth readiness.` : "2. Spatial execution readiness evidence was not available.",
      payload.generatedEvidence?.executionPreflight ? `3. ${basename(payload.generatedEvidence.executionPreflight)} - target window and coordinate preflight.` : "3. Execution preflight is missing or was not run.",
      payload.generatedEvidence?.executionReceipt ? `4. ${basename(payload.generatedEvidence.executionReceipt)} - runner receipt.` : "4. Runner receipt is missing or was not run.",
      payload.generatedEvidence?.outcomeVerification ? `5. ${basename(payload.generatedEvidence.outcomeVerification)} - low-token outcome verification.` : "5. Outcome verification is missing or was not run.",
      "",
      "Locked defaults: accepted=false, ruleEnabled=false, packagingGated=true, fullContinuousRecording=false, screenshotsCaptured=false, rawFullLogsRetained=false, nativeUniversalExecution=false."
    ].join("\n"),
    "utf8"
  );
  return { packetPath, receiptPath, readmePath };
}

function writeBlocked(outDir, status, reason, context) {
  const gateLocks = locks({ executeRequested: context.executeRequested });
  const payload = {
    format: "transparent_ai_teach_execute_supervised_execution_v1",
    executionGateId: context.executionGateId,
    createdAt: new Date().toISOString(),
    status,
    reason,
    goal: context.goal,
    software: context.software,
    executeRequested: context.executeRequested,
    actionRehearsalPath: context.actionRehearsalPath,
    didRunRunner: false,
    didVerifyOutcome: false,
    softwareActionsExecuted: false,
    nextTeacherAction: reason,
    generatedEvidence: {
      supervisedActionPlan: context.supervisedActionPlan || "",
      spatialExecutionReadiness: context.spatialExecutionReadiness || "",
      supervisedRunner: context.supervisedRunner || "",
      executionPreflight: "",
      executionReceipt: "",
      outcomeVerification: "",
      receipt: ""
    },
    locks: gateLocks
  };
  const receipt = {
    format: "transparent_ai_teach_execute_supervised_execution_receipt_v1",
    executionGateId: context.executionGateId,
    status,
    reason,
    executeRequested: context.executeRequested,
    softwareActionsExecuted: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    locks: gateLocks
  };
  const paths = writePacket(outDir, payload, receipt);
  return { ...paths, payload };
}

const rehearsalInput = argValue("--action-rehearsal", argValue("--rehearsal", argValue("--rehearsal-path", "")));
const confirmation = argValue("--teacher-confirmation", argValue("--confirmation", ""));
const spatialReadinessConfirmation = argValue("--spatial-readiness-confirmation", "");
const executeRequested = hasFlag("--execute");
const targetWindowTitle = argValue("--target-window-title", argValue("--window-title", ""));
const outputRoot = resolve(argValue("--output-dir", defaultOutputRoot()));
const teacherMarkers = argValues("--teacher-marker");
const state = argValue("--state", "");
const stateDir = argValue("--state-dir", "");
const maxItems = argValue("--max-items", "");
const maxLogsPerItem = argValue("--max-logs-per-item", "");

mkdirSync(outputRoot, { recursive: true });
const rehearsalInputResult = readJsonInput(rehearsalInput, "--action-rehearsal", true);
const rehearsal = rehearsalInputResult.value;
const goal = argValue("--goal", rehearsal?.goal || "Run the supervised execution gate after teacher-reviewed action rehearsal.");
const software = argValue("--software", rehearsal?.software || "target software");
const executionGateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const gateDir = join(outputRoot, executionGateId);
mkdirSync(gateDir, { recursive: true });

const context = {
  executionGateId,
  goal,
  software,
  executeRequested,
  actionRehearsalPath: rehearsalInputResult.path,
  supervisedActionPlan: evidencePath(rehearsal, "supervisedActionPlan"),
  spatialExecutionReadiness: evidencePath(rehearsal, "spatialExecutionReadiness"),
  supervisedRunner: evidencePath(rehearsal, "supervisedRunner")
};

if (!confirmationLooksExplicit(confirmation)) {
  const blocked = writeBlocked(
    gateDir,
    "blocked_waiting_for_teacher_supervised_execution_confirmation",
    "Explicit teacher confirmation is required before the action rehearsal can enter the supervised execution gate.",
    context
  );
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_teach_execute_supervised_execution_result_v1", status: blocked.payload.status, executionGateId, executionPath: blocked.packetPath, receiptPath: blocked.receiptPath, readme: blocked.readmePath, softwareActionsExecuted: false, reviewLocks: blocked.payload.locks }, null, 2));
  process.exit(0);
}

if (!rehearsal || rehearsal.format !== "transparent_ai_teach_execute_action_rehearsal_v1") {
  const blocked = writeBlocked(
    gateDir,
    "blocked_missing_action_rehearsal",
    "A transparent_ai_teach_execute_action_rehearsal_v1 packet is required before supervised execution.",
    context
  );
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_teach_execute_supervised_execution_result_v1", status: blocked.payload.status, executionGateId, executionPath: blocked.packetPath, receiptPath: blocked.receiptPath, readme: blocked.readmePath, softwareActionsExecuted: false, reviewLocks: blocked.payload.locks }, null, 2));
  process.exit(0);
}

if (rehearsal.softwareActionsExecuted === true || rehearsal?.locks?.softwareActionsExecuted === true) {
  const blocked = writeBlocked(
    gateDir,
    "blocked_rehearsal_already_claims_execution",
    "The source action rehearsal must be a dry-run rehearsal with softwareActionsExecuted=false before this gate can run.",
    context
  );
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_teach_execute_supervised_execution_result_v1", status: blocked.payload.status, executionGateId, executionPath: blocked.packetPath, receiptPath: blocked.receiptPath, readme: blocked.readmePath, softwareActionsExecuted: false, reviewLocks: blocked.payload.locks }, null, 2));
  process.exit(0);
}

const actionPlanPath = evidencePath(rehearsal, "supervisedActionPlan");
const spatialExecutionReadinessPath = evidencePath(rehearsal, "spatialExecutionReadiness");
const runnerPath = evidencePath(rehearsal, "supervisedRunner");
const rehearsalDryRunReceiptPath = evidencePath(rehearsal, "supervisedDryRunReceipt");
const queuePath = rehearsal?.sourceEvidence?.observerQueuePath || "";
const actionPlan = readJsonPath(actionPlanPath, true);
const spatialExecutionReadiness = readJsonPath(spatialExecutionReadinessPath, true);
const bakedWindowTitle = String(actionPlan?.targetSoftware?.windowTitle || "").trim();

if (!actionPlanPath || !runnerPath || !existsSync(actionPlanPath) || !existsSync(runnerPath)) {
  const blocked = writeBlocked(
    gateDir,
    "blocked_missing_rehearsal_runner_evidence",
    "The action rehearsal must include existing supervisedActionPlan and supervisedRunner evidence paths.",
    { ...context, supervisedActionPlan: actionPlanPath, spatialExecutionReadiness: spatialExecutionReadinessPath, supervisedRunner: runnerPath }
  );
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_teach_execute_supervised_execution_result_v1", status: blocked.payload.status, executionGateId, executionPath: blocked.packetPath, receiptPath: blocked.receiptPath, readme: blocked.readmePath, softwareActionsExecuted: false, reviewLocks: blocked.payload.locks }, null, 2));
  process.exit(0);
}

if (executeRequested && !targetWindowTitle.trim()) {
  const blocked = writeBlocked(
    gateDir,
    "blocked_missing_target_window_title",
    "The --execute path requires --target-window-title so the teacher confirms the visible target window before any UI events.",
    { ...context, supervisedActionPlan: actionPlanPath, spatialExecutionReadiness: spatialExecutionReadinessPath, supervisedRunner: runnerPath }
  );
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_teach_execute_supervised_execution_result_v1", status: blocked.payload.status, executionGateId, executionPath: blocked.packetPath, receiptPath: blocked.receiptPath, readme: blocked.readmePath, softwareActionsExecuted: false, reviewLocks: blocked.payload.locks }, null, 2));
  process.exit(0);
}

if (executeRequested && !bakedWindowTitle) {
  const blocked = writeBlocked(
    gateDir,
    "blocked_target_window_title_not_baked_into_plan",
    "The --execute path requires the target window title to already be baked into the reviewed supervised action plan. Regenerate the action rehearsal with --window-title first.",
    { ...context, supervisedActionPlan: actionPlanPath, spatialExecutionReadiness: spatialExecutionReadinessPath, supervisedRunner: runnerPath }
  );
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_teach_execute_supervised_execution_result_v1", status: blocked.payload.status, executionGateId, executionPath: blocked.packetPath, receiptPath: blocked.receiptPath, readme: blocked.readmePath, softwareActionsExecuted: false, reviewLocks: blocked.payload.locks }, null, 2));
  process.exit(0);
}

if (executeRequested && !bakedWindowTitle.toLowerCase().includes(targetWindowTitle.toLowerCase()) && !targetWindowTitle.toLowerCase().includes(bakedWindowTitle.toLowerCase())) {
  const blocked = writeBlocked(
    gateDir,
    "blocked_target_window_title_mismatch",
    "The requested target window title does not match the title baked into the reviewed action plan.",
    { ...context, supervisedActionPlan: actionPlanPath, spatialExecutionReadiness: spatialExecutionReadinessPath, supervisedRunner: runnerPath }
  );
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_teach_execute_supervised_execution_result_v1", status: blocked.payload.status, executionGateId, executionPath: blocked.packetPath, receiptPath: blocked.receiptPath, readme: blocked.readmePath, softwareActionsExecuted: false, reviewLocks: blocked.payload.locks }, null, 2));
  process.exit(0);
}

if (executeRequested && (!spatialExecutionReadinessPath || !spatialExecutionReadiness || spatialExecutionReadiness.format !== "transparent_ai_spatial_execution_readiness_v1")) {
  const blocked = writeBlocked(
    gateDir,
    "blocked_missing_spatial_execution_readiness",
    "The --execute path requires the action rehearsal's spatial-execution-readiness.json before any UI events.",
    { ...context, supervisedActionPlan: actionPlanPath, spatialExecutionReadiness: spatialExecutionReadinessPath, supervisedRunner: runnerPath }
  );
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_teach_execute_supervised_execution_result_v1", status: blocked.payload.status, executionGateId, executionPath: blocked.packetPath, receiptPath: blocked.receiptPath, readme: blocked.readmePath, softwareActionsExecuted: false, reviewLocks: blocked.payload.locks }, null, 2));
  process.exit(0);
}

if (executeRequested && !spatialReadinessLooksConfirmed(`${confirmation}\n${spatialReadinessConfirmation}`)) {
  const blocked = writeBlocked(
    gateDir,
    "blocked_spatial_execution_readiness_not_confirmed",
    "The --execute path requires explicit teacher confirmation that the spatial execution readiness preserves position, perspective, and depth.",
    { ...context, supervisedActionPlan: actionPlanPath, spatialExecutionReadiness: spatialExecutionReadinessPath, supervisedRunner: runnerPath }
  );
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_teach_execute_supervised_execution_result_v1", status: blocked.payload.status, executionGateId, executionPath: blocked.packetPath, receiptPath: blocked.receiptPath, readme: blocked.readmePath, softwareActionsExecuted: false, reviewLocks: blocked.payload.locks }, null, 2));
  process.exit(0);
}

const runnerArgs = ["-ExecutionPolicy", "Bypass", "-File", runnerPath];
if (executeRequested) runnerArgs.push("-TeacherConfirmed", "-Execute");
const runnerResult = spawnSync("powershell", runnerArgs, {
  cwd: gateDir,
  encoding: "utf8"
});

const executionReceiptPath = evidencePath(rehearsal, "supervisedDryRunReceipt");
const executionPreflightPath = evidencePath(rehearsal, "supervisedPreflight");
const executionReceipt = readJsonPath(executionReceiptPath, true);
const preflight = readJsonPath(executionPreflightPath, true);
if (!executionReceipt) {
  const blocked = writeBlocked(
    gateDir,
    "blocked_runner_failed_without_receipt",
    runnerResult.stderr || runnerResult.stdout || "The supervised runner did not write an execution receipt.",
    { ...context, supervisedActionPlan: actionPlanPath, spatialExecutionReadiness: spatialExecutionReadinessPath, supervisedRunner: runnerPath }
  );
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_teach_execute_supervised_execution_result_v1", status: blocked.payload.status, executionGateId, executionPath: blocked.packetPath, receiptPath: blocked.receiptPath, readme: blocked.readmePath, softwareActionsExecuted: false, reviewLocks: blocked.payload.locks }, null, 2));
  process.exit(0);
}

const outcomeArgs = ["--receipt", executionReceiptPath, "--plan", actionPlanPath, "--preflight", executionPreflightPath, "--output-dir", join(gateDir, "outcome-verification")];
if (queuePath && existsSync(queuePath)) outcomeArgs.push("--queue", queuePath);
if (state) outcomeArgs.push("--state", state);
if (stateDir) outcomeArgs.push("--state-dir", stateDir);
if (maxItems) outcomeArgs.push("--max-items", maxItems);
if (maxLogsPerItem) outcomeArgs.push("--max-logs-per-item", maxLogsPerItem);
for (const marker of teacherMarkers) outcomeArgs.push("--teacher-marker", marker);
const outcome = runNodeScript("verify-supervised-action-outcome.mjs", outcomeArgs);

const executed = executionReceipt.status === "executed_under_teacher_supervision" && Array.isArray(executionReceipt.executedActionIds) && executionReceipt.executedActionIds.length > 0;
const status = executed
  ? "executed_under_teacher_supervision_waiting_for_outcome_review"
  : executeRequested && executionReceipt.status === "blocked_by_preflight"
    ? "blocked_by_runner_preflight"
    : "dry_run_verified_no_ui_events";
const gateLocks = locks({ executed, executeRequested });
const executionPath = join(gateDir, "teach-execute-supervised-execution.json");
const receiptPath = join(gateDir, "teach-execute-supervised-execution-receipt.json");
const readmePath = join(gateDir, "TEACH_EXECUTE_SUPERVISED_EXECUTION_START_HERE.md");

const payload = {
  format: "transparent_ai_teach_execute_supervised_execution_v1",
  executionGateId,
  createdAt: new Date().toISOString(),
  status,
  reason: executed
    ? "The generated supervised runner reported teacher-confirmed execution; outcome remains waiting for teacher review."
    : executeRequested
      ? "The generated supervised runner was invoked through the execution gate and blocked before UI events unless preflight allowed it."
      : "Teacher confirmed the execution gate, but --execute was absent, so the generated runner stayed in dry-run mode.",
  goal,
  software,
  actionRehearsalPath: rehearsalInputResult.path,
  executeRequested,
  targetWindowTitleRequested: targetWindowTitle,
  bakedWindowTitle,
  runnerExitStatus: runnerResult.status,
  runnerStdoutPreview: String(runnerResult.stdout || "").slice(0, 800),
  runnerStderrPreview: String(runnerResult.stderr || "").slice(0, 800),
  didRunRunner: true,
  didVerifyOutcome: true,
  softwareActionsExecuted: executed,
  sourceEvidence: {
    actionRehearsalPath: rehearsalInputResult.path,
    rehearsalDryRunReceipt: rehearsalDryRunReceiptPath,
    spatialExecutionReadiness: spatialExecutionReadinessPath,
    observerQueuePath: queuePath
  },
  generatedEvidence: {
    supervisedActionPlan: actionPlanPath,
    spatialExecutionReadiness: spatialExecutionReadinessPath,
    supervisedRunner: runnerPath,
    executionPreflight: executionPreflightPath,
    executionReceipt: executionReceiptPath,
    outcomeVerification: outcome.verificationPath,
    outcomeReceipt: outcome.receiptPath,
    readme: readmePath,
    receipt: receiptPath
  },
  counts: {
    actionCount: actionPlan?.actions?.length ?? 0,
    actionKinds: Array.isArray(actionPlan?.actions) ? [...new Set(actionPlan.actions.map((action) => action.kind))] : [],
    runnerReceiptStatus: executionReceipt.status || "unknown",
    preflightStatus: preflight?.status || "unknown",
    outcomeStatus: outcome.status || "unknown",
    executedActionIds: Array.isArray(executionReceipt.executedActionIds) ? executionReceipt.executedActionIds : []
  },
  spatialExecutionReadinessReview: {
    path: spatialExecutionReadinessPath,
    format: spatialExecutionReadiness?.format || "",
    supports2DPosition: spatialExecutionReadiness?.supports2DPosition === true,
    supportsPerspectiveRelationships: spatialExecutionReadiness?.supportsPerspectiveRelationships === true,
    supports3DDepthHints: spatialExecutionReadiness?.supports3DDepthHints === true,
    requiredForExecute: true,
    teacherConfirmedForExecute: executeRequested ? spatialReadinessLooksConfirmed(`${confirmation}\n${spatialReadinessConfirmation}`) : false
  },
  lowTokenPolicy: {
    runnerReceiptBeforeScreenshots: true,
    preflightBeforeScreenshots: true,
    metadataDeltaBeforeScreenshots: true,
    teacherMarkerBeforeScreenshots: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false
  },
  nextTeacherActions: executed
    ? [
        "Review the generated runner receipt and outcome verification.",
        "Confirm whether the visible result matched the teacher overlay intent.",
        "If ambiguous, inspect metadata deltas or one teacher-triggered screenshot before saving any rule.",
        "If incorrect, use correct_last_result with the visible mismatch."
      ]
    : [
        "Review the dry-run receipt and active-window preflight.",
        "Review spatial-execution-readiness.json and confirm position, perspective, and depth before --execute.",
        "Regenerate the action rehearsal with a target window title before any real execution.",
        "Only use --execute after the teacher confirms visible target window, spatial readiness, coordinate mapping, and action order.",
        "Keep learning memory and packaging locked until outcome review."
      ],
  locks: gateLocks
};
const receipt = {
  format: "transparent_ai_teach_execute_supervised_execution_receipt_v1",
  executionGateId,
  status,
  executeRequested,
  runnerReceiptStatus: executionReceipt.status || "unknown",
  preflightStatus: preflight?.status || "unknown",
  outcomeStatus: outcome.status || "unknown",
  softwareActionsExecuted: executed,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  generatedEvidence: payload.generatedEvidence,
  spatialExecutionReadinessReview: payload.spatialExecutionReadinessReview,
  locks: gateLocks
};

writeFileSync(executionPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Teach Execute Supervised Execution Gate",
    "",
    `Goal: ${goal}`,
    `Software: ${software}`,
    `Status: ${status}`,
    "",
    executeRequested
      ? "The teacher-confirmed execution gate invoked the generated supervised runner with execution intent, but the runner still enforces active-window and coordinate preflight before UI events."
      : "The teacher-confirmed execution gate invoked the generated supervised runner in dry-run mode only. No UI events were sent.",
    "",
    "Review order:",
    `1. ${basename(actionPlanPath)} - reviewed action plan from the action rehearsal.`,
    spatialExecutionReadinessPath ? `2. ${basename(spatialExecutionReadinessPath)} - position, perspective, and depth readiness before execution.` : "2. Spatial execution readiness evidence was not available.",
    `3. ${basename(executionPreflightPath)} - active-window, switch, and coordinate preflight.`,
    `4. ${basename(executionReceiptPath)} - runner receipt.`,
    `5. ${basename(outcome.verificationPath)} - low-token outcome verification before screenshots or memory.`,
    "",
    "Locked defaults: accepted=false, ruleEnabled=false, packagingGated=true, fullContinuousRecording=false, screenshotsCaptured=false, rawFullLogsRetained=false, nativeUniversalExecution=false."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_teach_execute_supervised_execution_result_v1",
      executionGateId,
      status,
      executionDir: gateDir,
      executionPath,
      receiptPath,
      readme: readmePath,
      supervisedActionPlan: actionPlanPath,
      spatialExecutionReadiness: spatialExecutionReadinessPath,
      supervisedRunner: runnerPath,
      executionPreflight: executionPreflightPath,
      executionReceipt: executionReceiptPath,
      outcomeVerification: outcome.verificationPath,
      outcomeReceipt: outcome.receiptPath,
      executeRequested,
      runnerReceiptStatus: executionReceipt.status || "unknown",
      preflightStatus: preflight?.status || "unknown",
      outcomeStatus: outcome.status || "unknown",
      spatialExecutionReadinessConfirmedForExecute: payload.spatialExecutionReadinessReview.teacherConfirmedForExecute,
      didRunRunner: true,
      didVerifyOutcome: true,
      softwareActionsExecuted: executed,
      screenshotsCaptured: false,
      fullContinuousRecording: false,
      rawFullLogsRetained: false,
      memoryEnabled: false,
      nativeUniversalExecution: false,
      reviewLocks: gateLocks
    },
    null,
    2
  )
);
