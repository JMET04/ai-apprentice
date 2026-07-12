#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");

const allowedValidationScripts = new Set([
  "validate-all-software-action-logic-source-contract-receipt.mjs",
  "validate-all-software-control-channel-repair-receipt.mjs",
  "validate-all-software-coverage-enrollment-follow-up-receipt.mjs",
  "validate-all-software-coverage-rollout-receipt.mjs",
  "validate-all-software-execution-follow-up-handoff-item-receipt.mjs",
  "validate-all-software-execution-follow-up-receipt.mjs",
  "validate-all-software-operational-activation-review-receipt.mjs",
  "validate-all-software-operational-post-activation-witness-receipt.mjs",
  "validate-goal-teacher-review-cockpit-receipt.mjs",
  "validate-original-goal-gap-action-board-receipt.mjs",
  "validate-original-goal-low-token-compact-evidence-request-receipt.mjs",
  "validate-original-goal-low-token-fallback-route-manual-review-patch.mjs",
  "validate-original-goal-remaining-gates-receipt.mjs",
  "validate-original-goal-teacher-action-router-receipt.mjs",
  "validate-parametric-drawing-logic-receipt.mjs",
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
    String(value || "original-goal-review-handoff-item-runner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-review-handoff-item-runner"
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

function commandPlaceholders(value) {
  return Array.from(new Set(String(value || "").match(/<[^<>]+>/g) || []));
}

function explicitTeacherConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed original goal review handoff item",
    "teacher approved original goal review handoff item",
    "teacher confirmed review handoff item",
    "run one reviewed original goal handoff",
    "i confirm original goal review handoff item",
    "\u786e\u8ba4\u63a8\u8fdb\u4e00\u4e2a\u539f\u76ee\u6807\u8bc4\u5ba1\u961f\u5217\u9879",
    "\u786e\u8ba4\u8fd0\u884c\u4e00\u4e2a\u8bc4\u5ba1 handoff",
    "\u5141\u8bb8\u63a8\u8fdb\u4e00\u4e2a\u5df2\u5ba1\u6838\u8bc4\u5ba1\u9879"
  ].some((marker) => text.includes(marker));
}

function commandSafety(command) {
  const lower = String(command || "").toLowerCase();
  const forbiddenMarkers = [
    "--execute",
    "-execute",
    " execute-mode ",
    " run_execute_mode ",
    "--teacher-reviewed",
    "--teacher-confirmed",
    "register-scheduledtask",
    "schtasks /create",
    "capture_screenshot",
    "capture-screenshot",
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

function selectQueueItem(queue) {
  const items = Array.isArray(queue.queueItems)
    ? queue.queueItems
    : Array.isArray(queue.nextReviewQueue)
      ? queue.nextReviewQueue
      : [];
  const itemId = argValue("--item-id", argValue("--row-id", ""));
  const itemNumber = argValue("--item-number", argValue("--number", ""));
  if (itemId) return items.find((item) => String(item.id || "") === itemId || String(item.sourceItemId || "") === itemId) || null;
  if (itemNumber) return items.find((item) => String(item.order || item.number || "") === String(itemNumber)) || null;
  return (
    items.find((item) =>
      [
        "ready_for_manual_review_handoff",
        "ready_for_manual_downstream_validation_handoff",
        "ready_for_manual_source_receipt_validation",
        "ready_for_next_review_queue",
        "ready_for_manual_next_review_route",
        "waiting_for_teacher_downstream_receipt_or_placeholder_replacement"
      ].includes(
        item.status
      )
    ) || null
  );
}

function queueKind(queue) {
  if (queue?.format === "transparent_ai_all_software_execution_gap_review_cockpit_handoff_queue_v1") {
    return "execution_gap_review_cockpit";
  }
  if (queue?.format === "transparent_ai_original_goal_teacher_action_router_handoff_queue_v1") {
    return "teacher_action_router";
  }
  if (queue?.format === "transparent_ai_goal_teacher_review_cockpit_handoff_queue_v1") {
    return "teacher_review_cockpit";
  }
  if (queue?.format === "transparent_ai_original_goal_remaining_gates_receipt_validation_v1") {
    return "remaining_gates_validation";
  }
  if (queue?.format === "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_validation_v1") {
    return "proof_gap_teacher_queue_receipt_validation";
  }
  if (queue?.format === "transparent_ai_original_goal_next_confirmation_pack_receipt_validation_v1") {
    return "next_confirmation_pack_validation";
  }
  return "unsupported";
}

function findValidationScript(command) {
  const tokens = tokenize(command);
  const scriptToken = tokens.find((token) => basename(token).startsWith("validate-") && basename(token).endsWith(".mjs"));
  const scriptName = scriptToken ? basename(scriptToken) : "";
  return {
    tokens,
    scriptName,
    allowed: allowedValidationScripts.has(scriptName)
  };
}

function replacePlaceholderToken(token, replacements) {
  const placeholders = commandPlaceholders(token);
  let result = token;
  for (const placeholder of placeholders) {
    const replacement = replacements.get(placeholder) || "";
    if (!replacement) return { ok: false, value: token, unresolved: placeholder };
    result = result.replaceAll(placeholder, replacement);
  }
  return { ok: true, value: result, unresolved: "" };
}

function structuredArgsForValidation(command, runDir) {
  const { tokens, scriptName, allowed } = findValidationScript(command);
  if (!scriptName || !allowed) {
    return { ok: false, reason: scriptName ? "validation_script_not_whitelisted" : "validation_script_not_found", scriptName, args: [] };
  }
  const scriptIndex = tokens.findIndex((token) => basename(token) === scriptName);
  const rawArgs = tokens.slice(scriptIndex + 1);
  const receipt = argValue("--receipt", argValue("--teacher-receipt", ""));
  const replacements = new Map();
  for (const placeholder of commandPlaceholders(command)) {
    const lowerPlaceholder = placeholder.toLowerCase();
    if ((lowerPlaceholder.includes("receipt") || lowerPlaceholder.includes("patch")) && receipt) {
      replacements.set(placeholder, resolve(receipt));
    }
  }
  const args = [];
  const unresolved = [];
  for (const token of rawArgs) {
    const replaced = replacePlaceholderToken(token, replacements);
    if (!replaced.ok) unresolved.push(replaced.unresolved);
    args.push(replaced.value);
  }
  if (unresolved.length) {
    return { ok: false, reason: "unresolved_placeholders", scriptName, args, unresolved: Array.from(new Set(unresolved)) };
  }
  if (!args.includes("--output-dir")) {
    args.push("--output-dir", join(runDir, "downstream-validation"));
  }
  return { ok: true, scriptName, args, unresolved: [] };
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
    reviewHandoffItemRunnerDoesNotRunArbitraryCommandString: true,
    reviewHandoffItemRunnerUsesStructuredArgumentsOnly: true,
    reviewHandoffItemRunnerConsumesOneHandoffItem: true,
    reviewHandoffItemRunnerWhitelistOnly: true,
    reviewHandoffItemRunnerDoesNotOpenGui: true,
    reviewHandoffItemRunnerDoesNotRegisterSchedule: true,
    reviewHandoffItemRunnerDoesNotCaptureScreenshots: true,
    reviewHandoffItemRunnerDoesNotExecuteTargetSoftware: true,
    reviewHandoffItemRunnerDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    commandsExecuted: false,
    validationScriptInvoked: false,
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

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: Math.max(60000, Number(argValue("--child-timeout-ms", "180000"))),
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

function writeReadme(path, payload, receiptPath) {
  const lines = [
    "# Original Goal Review Handoff Queue Item Runner",
    "",
    `Status: ${payload.status}`,
    `Queue kind: ${payload.queueKind || "unknown"}`,
    `Selected item: ${payload.selectedItem?.id || "none"}`,
    `Validation invoked: ${payload.validationScriptInvoked}`,
    "",
    "Safety boundary:",
    "- This wrapper consumes one teacher-reviewed handoff queue item only.",
    "- It does not execute the queue command string; it reconstructs structured arguments for an allowlisted validation script.",
    "- It does not open GUI files; open-review entries are emitted as review-ready evidence.",
    "- It requires teacher confirmation and rollback evidence before invoking any downstream validation.",
    "- It does not register schedules, launch runners, capture screenshots, execute target software, send UI events, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Review order:",
    `1. ${basename(path)} - item run packet.`,
    `2. ${basename(receiptPath)} - item run receipt.`,
    payload.generatedEvidence?.downstreamValidationPath
      ? `3. ${basename(payload.generatedEvidence.downstreamValidationPath)} - downstream validation result.`
      : "3. No downstream validation result was produced."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeOutput(runDir, payload) {
  const runPath = join(runDir, "original-goal-review-handoff-queue-item-run.json");
  const receiptPath = join(runDir, "original-goal-review-handoff-queue-item-run-receipt.json");
  const readmePath = join(runDir, "ORIGINAL_GOAL_REVIEW_HANDOFF_QUEUE_ITEM_RUN_START_HERE.md");
  const receipt = {
    format: "transparent_ai_original_goal_review_handoff_queue_item_run_receipt_v1",
    runId: payload.runId,
    status: payload.status,
    queueKind: payload.queueKind,
    selectedItem: payload.selectedItem,
    teacherConfirmed: payload.teacherConfirmed,
    rollbackPointCreated: payload.rollbackPointCreated,
    validationScriptInvoked: payload.validationScriptInvoked,
    downstreamValidationPath: payload.generatedEvidence?.downstreamValidationPath || "",
    openReviewPath: payload.generatedEvidence?.openReviewPath || "",
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

function selectedSummary(item) {
  if (!item) return null;
  const command = String(item.command || item.openPath || item.observedEvidencePath || "");
  return {
    id: item.id || "",
    order: item.order || item.number || "",
    status: item.status || "",
    handoffKind: item.handoffKind || "",
    sourceItemId: item.sourceItemId || "",
    sourceReceiptRowId: item.sourceReceiptRowId || "",
    sourceKind: item.sourceKind || "",
    reviewEntryId: item.reviewEntryId || "",
    commandUsedForClassificationOnly: command,
    verificationCommandTemplate: item.verificationCommandTemplate || "",
    placeholders: commandPlaceholders(command),
    matchedForbiddenMarkers: commandSafety(command).matchedForbiddenMarkers
  };
}

function blockedPayload(runId, runDir, reason, queueInput, queue, item, extra = {}) {
  return {
    ok: true,
    format: "transparent_ai_original_goal_review_handoff_queue_item_run_v1",
    runId,
    createdAt: new Date().toISOString(),
    status: "blocked_before_original_goal_review_handoff_runner",
    blockReason: reason,
    queueKind: queueKind(queue),
    queuePath: queueInput.path,
    sourceQueueStatus: queue?.status || "",
    sourceQueueDecision: queue?.queueDecision || queue?.validationDecision || "",
    selectedItem: selectedSummary(item),
    teacherConfirmed: extra.teacherConfirmed || false,
    rollbackPointCreated: extra.rollbackPointCreated || false,
    validationScriptInvoked: false,
    generatedEvidence: {},
    blockedTransitions: [
      "execute_queue_command_string",
      "invoke_unreviewed_original_goal_handoff_item",
      "run_non_whitelisted_script_from_handoff_item",
      "open_gui_from_handoff_item_runner",
      "register_schedule_from_handoff_item_runner",
      "capture_screenshot_from_handoff_item_runner",
      "execute_target_software_from_handoff_item_runner",
      "write_memory_from_handoff_item_runner",
      "claim_goal_complete_from_handoff_item_runner"
    ],
    paths: { runDir },
    locks: baseLocks(),
    ...extra
  };
}

const goal = argValue("--goal", "Run one teacher-confirmed original-goal review handoff queue item.");
const queueInput = readJsonInput(argValue("--queue", argValue("--handoff-queue", "")), "--queue");
const queue = queueInput.value;
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-review-handoff-item-runs"))
);
mkdirSync(outputRoot, { recursive: true });
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const runDir = join(outputRoot, runId);
mkdirSync(runDir, { recursive: true });

const kind = queueKind(queue);
const item = selectQueueItem(queue);
const command = String(item?.command || item?.openPath || item?.observedEvidencePath || "");
const safety = commandSafety(command);
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--teacher-reviewed-confirmation", ""));
const teacherConfirmed = explicitTeacherConfirmation(teacherConfirmation);
const rollbackPoint = argValue("--rollback-point", argValue("--rollback", ""));
const rollbackPointCreated = hasFlag("--rollback-point-created") || Boolean(rollbackPoint);
const runReviewedHandoff = hasFlag("--run-reviewed-handoff") || hasFlag("--execute-reviewed-handoff");
const allowRunner = hasFlag("--allow-runner");
const structuredValidation = structuredArgsForValidation(command, runDir);

const blockers = [];
if (kind === "unsupported") blockers.push("unsupported_handoff_queue_format");
if (!item) blockers.push("reviewed_handoff_item_not_found");
if (
  item &&
  ![
        "ready_for_manual_review_handoff",
        "ready_for_manual_downstream_validation_handoff",
        "ready_for_manual_source_receipt_validation",
        "ready_for_next_review_queue",
        "ready_for_manual_next_review_route",
        "waiting_for_teacher_downstream_receipt_or_placeholder_replacement"
  ].includes(item.status)
) {
  blockers.push("selected_item_not_ready_for_review_handoff");
}
if (item && item.handoffKind === "missing_handoff_target") blockers.push("selected_item_missing_handoff_target");
if (item && !safety.safe) blockers.push("selected_item_has_unsafe_command_markers");
const selectedItemIsValidation =
  item &&
  [
    "downstream_receipt_validation",
    "control_channel_receipt_validation",
    "action_logic_receipt_validation",
    "source_receipt_validation"
  ].includes(item.handoffKind);
if (selectedItemIsValidation && !structuredValidation.ok) {
  blockers.push(structuredValidation.reason);
}
if (!runReviewedHandoff) blockers.push("missing_run_reviewed_handoff_flag");
if (!allowRunner) blockers.push("missing_allow_runner_flag");
if (!teacherConfirmed) blockers.push("missing_teacher_original_goal_review_handoff_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed_for_original_goal_review_handoff_item");

if (blockers.length) {
  const payload = blockedPayload(runId, runDir, blockers, queueInput, queue, item, {
    teacherConfirmed,
    teacherConfirmation,
    rollbackPointCreated,
    rollbackPoint,
    requestedRunReviewedHandoff: runReviewedHandoff,
    allowRunner,
    structuredValidation
  });
  const paths = writeOutput(runDir, payload);
  console.log(
    JSON.stringify(
      {
        ok: true,
        format: "transparent_ai_original_goal_review_handoff_queue_item_run_result_v1",
        status: payload.status,
        blockReason: blockers,
        runPath: paths.runPath,
        receiptPath: paths.receiptPath,
        readmePath: paths.readmePath,
        validationScriptInvoked: false,
        locks: payload.locks
      },
      null,
      2
    )
  );
  process.exit(0);
}

let downstreamResult = null;
let validationScriptInvoked = false;
let status = "review_entry_ready_to_open";
const generatedEvidence = {};
if (selectedItemIsValidation) {
  downstreamResult = runNodeScript(structuredValidation.scriptName, structuredValidation.args);
  validationScriptInvoked = true;
  status = "reviewed_downstream_validation_completed";
  generatedEvidence.downstreamValidationResult = downstreamResult;
  generatedEvidence.downstreamValidationPath =
    downstreamResult.validationPath || downstreamResult.auditPath || downstreamResult.resultPath || downstreamResult.receiptPath || "";
  generatedEvidence.downstreamReadmePath = downstreamResult.readmePath || "";
} else {
  generatedEvidence.openReviewPath = item.openPath || item.observedEvidencePath || (existsSync(command) ? resolve(command) : "");
  generatedEvidence.openReviewPathExists = generatedEvidence.openReviewPath ? existsSync(generatedEvidence.openReviewPath) : false;
  generatedEvidence.verificationCommandTemplateForSeparateGate = item.verificationCommandTemplate || "";
}

const locks = baseLocks({
  validationScriptInvoked,
  commandsExecuted: false,
  runnerLaunched: false,
  scheduledTaskRegistered: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  memoryWritten: false,
  goalComplete: false
});
const payload = {
  ok: true,
  format: "transparent_ai_original_goal_review_handoff_queue_item_run_v1",
  runId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  queueKind: kind,
  queuePath: queueInput.path,
  sourceQueueStatus: queue.status || "",
  sourceQueueDecision: queue.queueDecision || queue.validationDecision || "",
  selectedItem: {
    ...selectedSummary(item),
    structuredValidationScript: selectedItemIsValidation ? structuredValidation.scriptName : "",
    structuredValidationArgs: selectedItemIsValidation ? structuredValidation.args : []
  },
  teacherConfirmed,
  teacherConfirmation,
  rollbackPointCreated,
  rollbackPoint,
  requestedRunReviewedHandoff: runReviewedHandoff,
  allowRunner,
  validationScriptInvoked,
  generatedEvidence,
  nextReviewActions: [
    "Review the item run receipt before following any generated downstream command.",
    "If downstream validation produced another handoff queue, run only one reviewed item at a time.",
    "Keep execution, screenshots, memory, packaging, native-universal control, and goal completion locked until separate gates prove them."
  ],
  blockedTransitions: [
    "execute_queue_command_string",
    "run_non_whitelisted_script_from_handoff_item",
    "open_gui_from_handoff_item_runner",
    "register_schedule_from_handoff_item_runner",
    "launch_runner_from_handoff_item_runner",
    "capture_screenshot_from_handoff_item_runner",
    "execute_target_software_from_handoff_item_runner",
    "write_memory_from_handoff_item_runner",
    "claim_goal_complete_from_handoff_item_runner"
  ],
  paths: { runDir },
  locks
};
const paths = writeOutput(runDir, payload);
console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_review_handoff_queue_item_run_result_v1",
      status,
      runPath: paths.runPath,
      receiptPath: paths.receiptPath,
      readmePath: paths.readmePath,
      validationScriptInvoked,
      downstreamValidationPath: generatedEvidence.downstreamValidationPath || "",
      openReviewPath: generatedEvidence.openReviewPath || "",
      locks
    },
    null,
    2
  )
);
