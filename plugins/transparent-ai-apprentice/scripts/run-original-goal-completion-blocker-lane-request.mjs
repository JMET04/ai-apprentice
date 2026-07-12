#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");

const allowedRunnableScripts = new Map([
  ["create-original-goal-current-status-refresh.mjs", "create-original-goal-current-status-refresh.mjs"],
  ["create-original-goal-low-token-coverage-evidence-dossier.mjs", "create-original-goal-low-token-coverage-evidence-dossier.mjs"],
  ["create-rollback-point.mjs", "create-rollback-point.mjs"],
  ["verify-all-software-recurring-monitor-registration-status.mjs", "verify-all-software-recurring-monitor-registration-status.mjs"],
  ["create-rag-delivery-gate-audit-trail.mjs", join("knowledge", "create-rag-delivery-gate-audit-trail.mjs")]
]);

const allowedPreparedOnlyScripts = new Set([
  "confirm-engineering-command-target.mjs",
  "validate-spatial-intent-evidence-receipt.mjs"
]);

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "original-goal-completion-blocker-lane-request-run")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-completion-blocker-lane-request-run"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  return parsed;
}

function tokenize(command) {
  const tokens = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(String(command || "")))) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

function placeholders(value) {
  const text = String(value || "");
  return Array.from(new Set([...(text.match(/<[^<>]+>/g) || []), ...(text.match(/__[A-Z0-9_]+__/g) || [])]));
}

function explicitTeacherConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed completion blocker lane",
    "teacher approved completion blocker lane",
    "run one reviewed completion blocker lane",
    "i confirm completion blocker lane",
    "confirm completion blocker lane request",
    "\u786e\u8ba4\u63a8\u8fdb\u4e00\u4e2a\u5b8c\u6210\u963b\u585e\u8f66\u9053",
    "\u786e\u8ba4 completion blocker lane"
  ].some((marker) => text.includes(marker));
}

function commandSafety(command) {
  const lower = String(command || "").toLowerCase();
  const forbiddenMarkers = [
    "--execute-approved-gate",
    "--execute-approved-registration",
    "--allow-system-change",
    "--allow-runner-trigger",
    "register-scheduledtask",
    "schtasks /create",
    "capture-triggered-visual-check.mjs",
    "run-all-software-execution-approved-gate-runner.mjs",
    "run-all-software-operational-learning-registration-approved-runner.mjs",
    "run-all-software-operational-learning-post-registration-output-witness-runner.mjs",
    "write_memory",
    "enable_memory",
    "claim_complete",
    "native_universal_execution",
    "unlock_packaging"
  ];
  const matchedForbiddenMarkers = forbiddenMarkers.filter((marker) => lower.includes(marker));
  return {
    safe: matchedForbiddenMarkers.length === 0,
    matchedForbiddenMarkers
  };
}

function scriptFromCommand(command) {
  const tokens = tokenize(command);
  const scriptIndex = tokens.findIndex((token) => basename(token).endsWith(".mjs"));
  const scriptName = scriptIndex >= 0 ? basename(tokens[scriptIndex]) : "";
  return {
    tokens,
    scriptIndex,
    scriptName,
    rawArgs: scriptIndex >= 0 ? tokens.slice(scriptIndex + 1) : []
  };
}

function replacementMap(request) {
  const replacements = new Map();
  const raw = request?.replacements && typeof request.replacements === "object" ? request.replacements : {};
  for (const [key, value] of Object.entries(raw)) {
    replacements.set(String(key), String(value));
    if (!String(key).startsWith("<")) replacements.set(`<${key}>`, String(value));
  }
  return replacements;
}

function replacePlaceholdersInToken(token, replacements) {
  let result = token;
  const unresolved = [];
  for (const placeholder of placeholders(token)) {
    const replacement = replacements.get(placeholder);
    if (!replacement || replacement.includes("<") || replacement.includes(">")) {
      unresolved.push(placeholder);
      continue;
    }
    result = result.replaceAll(placeholder, replacement);
  }
  return { value: result, unresolved };
}

function requestPlaceholderBlockers(request, command) {
  const blockers = [];
  const declaredMissingInputs = Array.isArray(request?.missingInputs) ? request.missingInputs.filter(Boolean) : [];
  const commandPlaceholders = placeholders(command);
  if (request?.placeholderReplacementRequired === true) blockers.push("request_placeholder_replacement_required");
  if (request?.hasPlaceholders === true) blockers.push("request_declares_unresolved_placeholders");
  if (declaredMissingInputs.length) blockers.push("request_missing_inputs_not_resolved");
  if (commandPlaceholders.length) blockers.push("request_command_contains_unresolved_placeholders");
  return Array.from(new Set(blockers));
}

function structuredArgs(command, request, runDir) {
  const parsed = scriptFromCommand(command);
  if (!parsed.scriptName) return { ok: false, reason: "script_not_found", ...parsed, args: [] };
  const replacements = replacementMap(request);
  const args = [];
  const unresolved = [];
  for (const token of parsed.rawArgs) {
    const replaced = replacePlaceholdersInToken(token, replacements);
    args.push(replaced.value);
    unresolved.push(...replaced.unresolved);
  }
  if (unresolved.length) {
    return {
      ok: false,
      reason: "unresolved_placeholders",
      ...parsed,
      args,
      unresolved: Array.from(new Set(unresolved))
    };
  }
  if (!args.includes("--output-dir")) {
    args.push("--output-dir", join(runDir, "lane-generated-evidence"));
  }
  return { ok: true, ...parsed, args, unresolved: [] };
}

function argAfter(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || "" : "";
}

function missingOrPlaceholderPath(value) {
  return !value || placeholders(value).length > 0 || !existsSync(value);
}

function scriptSpecificBlockers(structured, request) {
  const blockers = [];
  if (structured.scriptName === "verify-all-software-recurring-monitor-registration-status.mjs") {
    const runnerValue = argAfter(structured.args, "--registration-runner");
    if (!runnerValue || placeholders(runnerValue).length) {
      blockers.push("missing_registration_runner_for_recurring_monitor_status_verifier");
    }
  }
  if (structured.scriptName === "create-rag-delivery-gate-audit-trail.mjs") {
    const deliveryGate = argAfter(structured.args, "--delivery-gate");
    const rollbackPoint = argAfter(structured.args, "--rollback-point");
    if (request?.lane && request.lane !== "rule_dsl_delivery_gate_audit") {
      blockers.push("rag_delivery_gate_audit_runner_requires_rule_dsl_delivery_gate_audit_lane");
    }
    if (missingOrPlaceholderPath(deliveryGate)) {
      blockers.push("missing_rag_delivery_gate_for_rule_dsl_audit_runner");
    }
    if (missingOrPlaceholderPath(rollbackPoint)) {
      blockers.push("missing_retained_rollback_point_for_rule_dsl_audit_runner");
    }
    if (!structured.args.includes("--teacher-reviewed")) {
      blockers.push("missing_teacher_reviewed_flag_for_rule_dsl_audit_runner");
    }
  }
  return blockers;
}

function baseLocks(overrides = {}) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    teacherConfirmationRequired: true,
    rollbackPointRequired: true,
    laneRunnerConsumesOneRequest: true,
    laneRunnerDoesNotRunArbitraryCommandString: true,
    laneRunnerUsesStructuredArgumentsOnly: true,
    laneRunnerWhitelistOnly: true,
    laneRunnerDoesNotOpenGui: true,
    laneRunnerDoesNotRegisterSchedule: true,
    laneRunnerDoesNotCaptureScreenshots: true,
    laneRunnerDoesNotExecuteTargetSoftware: true,
    laneRunnerDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    commandsExecuted: false,
    safeScriptInvoked: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false,
    ...overrides
  };
}

function selectedSummary(request, structured, safety) {
  return {
    lane: request.lane || "",
    itemNumber: request.itemNumber || "",
    status: request.status || "",
    nextSafeAction: request.nextSafeAction || "",
    scriptName: structured.scriptName || "",
    placeholders: placeholders(request.command || request.commandTemplate || ""),
    unresolved: structured.unresolved || [],
    matchedForbiddenMarkers: safety.matchedForbiddenMarkers,
    evidenceLinks: Array.isArray(request.evidenceLinks) ? request.evidenceLinks : [],
    blockedClaims: Array.isArray(request.blockedClaims) ? request.blockedClaims : []
  };
}

function writeReadme(path, payload, receiptPath) {
  const lines = [
    "# Original Goal Completion Blocker Lane Request Runner",
    "",
    `Status: ${payload.status}`,
    `Lane: ${payload.selectedLane?.lane || ""}`,
    `Script: ${payload.selectedLane?.scriptName || ""}`,
    `Safe script invoked: ${payload.safeScriptInvoked}`,
    "",
    "Safety boundary:",
    "- This wrapper consumes one teacher-reviewed completion-blocker lane request.",
    "- It does not execute arbitrary command text; it reconstructs structured arguments for a tiny allowlist.",
    "- Gated lanes, unresolved placeholders, screenshots, execute runners, schedule registration, memory writes, packaging unlocks, and completion claims stay blocked.",
    "- It requires teacher confirmation and retained rollback evidence before invoking an allowlisted safe script.",
    "",
    "Review order:",
    `1. ${basename(path)} - lane run packet.`,
    `2. ${basename(receiptPath)} - lane run receipt.`,
    payload.generatedEvidence?.safeScriptResultPath
      ? `3. ${basename(payload.generatedEvidence.safeScriptResultPath)} - child safe-script result.`
      : "3. No child script was invoked."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeOutput(runDir, payload) {
  const runPath = join(runDir, "original-goal-completion-blocker-lane-request-run.json");
  const receiptPath = join(runDir, "original-goal-completion-blocker-lane-request-run-receipt.json");
  const readmePath = join(runDir, "ORIGINAL_GOAL_COMPLETION_BLOCKER_LANE_REQUEST_RUN_START_HERE.md");
  const receipt = {
    format: "transparent_ai_original_goal_completion_blocker_lane_request_run_receipt_v1",
    runId: payload.runId,
    status: payload.status,
    selectedLane: payload.selectedLane,
    teacherConfirmed: payload.teacherConfirmed,
    rollbackPointCreated: payload.rollbackPointCreated,
    safeScriptInvoked: payload.safeScriptInvoked,
    safeScriptResultPath: payload.generatedEvidence?.safeScriptResultPath || "",
    commandsExecuted: false,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    goalComplete: false,
    locks: payload.locks
  };
  writeFileSync(runPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  writeReadme(readmePath, payload, receiptPath);
  return { runPath, receiptPath, readmePath, receipt };
}

function blockedPayload(runId, runDir, reason, requestInput, request, structured, safety, extra = {}) {
  return {
    ok: true,
    format: "transparent_ai_original_goal_completion_blocker_lane_request_run_v1",
    runId,
    createdAt: new Date().toISOString(),
    status: "blocked_before_completion_blocker_lane_runner",
    blockReason: reason,
    requestPath: requestInput.path,
    selectedLane: selectedSummary(request, structured, safety),
    safeScriptInvoked: false,
    generatedEvidence: {},
    blockedTransitions: [
      "execute_unreviewed_completion_blocker_lane",
      "execute_arbitrary_command_string_from_lane_request",
      "invoke_gated_completion_blocker_lane_without_receipt",
      "register_schedule_from_completion_blocker_lane_runner",
      "capture_screenshot_from_completion_blocker_lane_runner",
      "execute_target_software_from_completion_blocker_lane_runner",
      "write_memory_from_completion_blocker_lane_runner",
      "claim_goal_complete_from_completion_blocker_lane_runner"
    ],
    paths: { runDir },
    locks: baseLocks(),
    ...extra
  };
}

function runSafeScript(scriptName, args) {
  const scriptRelativePath = allowedRunnableScripts.get(scriptName);
  if (!scriptRelativePath) throw new Error(`SCRIPT_NOT_ALLOWLISTED: ${scriptName}`);
  const result = spawnSync(process.execPath, [join(__dirname, scriptRelativePath), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: Math.max(60000, Number(argValue("--child-timeout-ms", "180000"))),
    maxBuffer: 40 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  try {
    return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
  } catch {
    return { ok: true, rawStdout: result.stdout };
  }
}

const goal = argValue("--goal", "Run one teacher-confirmed completion blocker lane request.");
const requestInput = readJsonInput(argValue("--request", argValue("--lane-request", "")), "--request");
const request = requestInput.value;
if (request.format !== "transparent_ai_original_goal_completion_blocker_lane_command_request_v1") {
  throw new Error("--request must be transparent_ai_original_goal_completion_blocker_lane_command_request_v1");
}

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-lane-request-runs"))
);
mkdirSync(outputRoot, { recursive: true });
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const runDir = join(outputRoot, runId);
mkdirSync(runDir, { recursive: true });

const command = String(request.command || request.commandTemplate || "");
const structured = structuredArgs(command, request, runDir);
const safety = commandSafety(command);
const placeholderBlockers = requestPlaceholderBlockers(request, command);
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--teacher-reviewed-confirmation", ""));
const teacherConfirmed = explicitTeacherConfirmation(teacherConfirmation);
const rollbackPoint = argValue("--rollback-point", argValue("--rollback", ""));
const rollbackPointCreated = hasFlag("--rollback-point-created") || Boolean(rollbackPoint);
const runReviewedLane = hasFlag("--run-reviewed-lane") || hasFlag("--execute-reviewed-lane");
const allowSafeLaneRunner = hasFlag("--allow-safe-lane-runner") || hasFlag("--allow-runner");
const isGated = request.gated === true || String(request.status || "").includes("gated");
const scriptRunnable = allowedRunnableScripts.has(structured.scriptName || "");
const scriptPreparedOnly = allowedPreparedOnlyScripts.has(structured.scriptName || "");

const blockers = [];
if (!structured.ok) blockers.push(structured.reason);
blockers.push(...placeholderBlockers);
if (isGated) blockers.push("selected_completion_blocker_lane_is_gated_until_teacher_receipt_and_rollback");
if (!safety.safe) blockers.push("selected_completion_blocker_lane_has_unsafe_command_markers");
if (structured.scriptName && !scriptRunnable && !scriptPreparedOnly) blockers.push("completion_blocker_lane_script_not_whitelisted");
if (scriptPreparedOnly) blockers.push("selected_completion_blocker_lane_prepares_review_only_next_step_not_runner_invocation");
blockers.push(...scriptSpecificBlockers(structured, request));
if (!runReviewedLane) blockers.push("missing_run_reviewed_lane_flag");
if (!allowSafeLaneRunner) blockers.push("missing_allow_safe_lane_runner_flag");
if (!teacherConfirmed) blockers.push("missing_teacher_completion_blocker_lane_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed_for_completion_blocker_lane");

if (blockers.length) {
  const payload = blockedPayload(runId, runDir, blockers, requestInput, request, structured, safety, {
    teacherConfirmed,
    teacherConfirmation,
    rollbackPointCreated,
    rollbackPoint,
    requestedRunReviewedLane: runReviewedLane,
    allowSafeLaneRunner,
    structuredArgs: structured
  });
  const paths = writeOutput(runDir, payload);
  console.log(JSON.stringify({ ...payload, ...paths }, null, 2));
  process.exit(0);
}

const childResult = runSafeScript(structured.scriptName, structured.args);
const safeScriptResultPath = join(runDir, "safe-script-result.json");
writeFileSync(safeScriptResultPath, `${JSON.stringify(childResult, null, 2)}\n`, "utf8");

const payload = {
  ok: true,
  format: "transparent_ai_original_goal_completion_blocker_lane_request_run_v1",
  runId,
  createdAt: new Date().toISOString(),
  status: "completed_review_only_completion_blocker_lane_safe_step",
  requestPath: requestInput.path,
  selectedLane: selectedSummary(request, structured, safety),
  teacherConfirmed,
  teacherConfirmation,
  rollbackPointCreated,
  rollbackPoint,
  requestedRunReviewedLane: runReviewedLane,
  allowSafeLaneRunner,
  safeScriptInvoked: true,
  generatedEvidence: {
    safeScriptResultPath,
    childFormat: childResult.format || "",
    childStatus: childResult.status || "",
    childPath:
      childResult.refreshPath ||
      childResult.dossierPath ||
      childResult.statusPath ||
      childResult.manifestPath ||
      childResult.auditPath ||
      childResult.htmlPath ||
      childResult.readmePath ||
      childResult.outputPath ||
      ""
  },
  blockedTransitions: [
    "execute_arbitrary_command_string_from_lane_request",
    "register_schedule_from_completion_blocker_lane_runner",
    "capture_screenshot_from_completion_blocker_lane_runner",
    "execute_target_software_from_completion_blocker_lane_runner",
    "write_memory_from_completion_blocker_lane_runner",
    "claim_goal_complete_from_completion_blocker_lane_runner"
  ],
  paths: { runDir },
  locks: baseLocks({ safeScriptInvoked: true })
};
const paths = writeOutput(runDir, payload);
console.log(JSON.stringify({ ...payload, ...paths }, null, 2));
