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

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "coverage-enrollment-follow-up-handoff-item-runner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "coverage-enrollment-follow-up-handoff-item-runner"
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

function explicitTeacherConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed coverage enrollment follow-up item",
    "teacher approved coverage enrollment follow-up item",
    "teacher confirmed one coverage enrollment follow-up",
    "run one reviewed enrollment follow-up handoff",
    "i confirm coverage enrollment follow-up item",
    "确认运行一个低token覆盖补证项",
    "确认推进一个覆盖补证项",
    "允许推进一个 coverage enrollment follow-up"
  ].some((marker) => text.includes(marker));
}

function commandPlaceholders(item) {
  return Array.from(new Set(`${item.command || ""} ${JSON.stringify(item.arguments || {})}`.match(/<[^<>]+>/g) || []));
}

function commandSafety(item) {
  const lower = `${String(item.command || "")} ${JSON.stringify(item.arguments || {})}`.toLowerCase();
  const forbiddenMarkers = [
    "--execute",
    "-execute",
    " execute-mode ",
    "capture_screenshot",
    "capture-screenshot",
    "register-scheduledtask",
    "schtasks /create",
    "write_memory",
    "claim_complete",
    "native_universal_execution",
    "unlock_packaging"
  ];
  const matchedForbiddenMarkers = forbiddenMarkers.filter((marker) => lower.includes(marker));
  return { safe: matchedForbiddenMarkers.length === 0, matchedForbiddenMarkers };
}

function selectQueueItem(queue) {
  const items = Array.isArray(queue.queueItems) ? queue.queueItems : [];
  const itemId = argValue("--item-id", "");
  const itemNumber = argValue("--item-number", argValue("--number", ""));
  if (itemId) return items.find((item) => String(item.id || "") === itemId) || null;
  if (itemNumber) return items.find((item) => String(item.number || "") === itemNumber) || null;
  return (
    items.find(
      (item) =>
        item.kind === "reviewed_low_token_batch_command" &&
        item.status === "ready_for_manual_review_handoff" &&
        item.safeForManualReviewHandoff === true &&
        commandPlaceholders(item).length === 0
    ) || null
  );
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
    queueItemRunnerDoesNotRunArbitraryCommandString: true,
    queueItemRunnerUsesStructuredArgumentsOnly: true,
    queueItemRunnerConsumesOneHandoffItem: true,
    queueItemRunnerDoesNotRegisterSchedule: true,
    queueItemRunnerDoesNotCaptureScreenshots: true,
    queueItemRunnerDoesNotExecuteTargetSoftware: true,
    queueItemRunnerDoesNotWriteMemory: true,
    scheduledTaskInstalled: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false,
    ...overrides
  };
}

function firstReadyFollowUpId(item) {
  const ids = Array.isArray(item?.readyFollowUpIds) ? item.readyFollowUpIds.filter(Boolean) : [];
  return String(argValue("--follow-up-id", ids[0] || "") || "");
}

function buildBatchArgs(item, runDir) {
  const input = item.arguments || {};
  const plan = input.plan || input.followUpPlan || input.sourceFollowUpPlan || "";
  const followUpId = firstReadyFollowUpId(item);
  const args = [
    "--goal",
    "Advance one teacher-confirmed coverage enrollment follow-up handoff item.",
    "--plan",
    plan,
    "--teacher-reviewed",
    "--follow-up-id",
    followUpId,
    "--max-items",
    "1",
    "--max-queue-items",
    String(Math.max(1, Number(input.maxQueueItems || 1))),
    "--max-logs-per-item",
    String(Math.max(1, Number(input.maxLogsPerItem || 1))),
    "--max-tail-lines",
    String(Math.max(1, Number(input.maxTailLines || 16))),
    "--max-tail-bytes",
    String(Math.max(1024, Number(input.maxTailBytes || 1024))),
    "--output-dir",
    join(runDir, "coverage-enrollment-follow-up-batch")
  ];
  if (input.allowBoundedTail === true) args.push("--allow-bounded-tail");
  return { plan, followUpId, args };
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: resolve(__dirname, "..", "..", ".."),
    encoding: "utf8",
    timeout: Math.max(120000, Number(argValue("--child-timeout-ms", "240000"))),
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

function writeReadme(path, payload, receiptPath) {
  const lines = [
    "# Coverage Enrollment Follow-Up Handoff Queue Item Runner",
    "",
    `Status: ${payload.status}`,
    `Selected item: ${payload.selectedItem?.number || "none"} ${payload.selectedItem?.id || ""}`.trim(),
    `Runner invoked: ${payload.runnerInvoked}`,
    "",
    "Safety boundary:",
    "- This wrapper consumes one handoff queue item only.",
    "- It does not execute the queue command string; it reconstructs arguments for the existing batch runner.",
    "- It requires explicit teacher confirmation and rollback evidence before invoking the batch runner.",
    "- It does not register schedules, capture screenshots, execute target software, write memory, enable rules, unlock packaging, or claim all-software coverage completion.",
    "",
    "Review order:",
    `1. ${basename(path)} - this handoff item run packet.`,
    `2. ${basename(receiptPath)} - this handoff item receipt.`,
    payload.generatedEvidence?.batchPath
      ? `3. ${basename(payload.generatedEvidence.batchPath)} - one-row coverage enrollment follow-up batch.`
      : "3. No batch result was produced."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeOutput(runDir, payload) {
  const runPath = join(runDir, "all-software-coverage-enrollment-follow-up-handoff-queue-item-run.json");
  const receiptPath = join(runDir, "all-software-coverage-enrollment-follow-up-handoff-queue-item-run-receipt.json");
  const readmePath = join(runDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_HANDOFF_QUEUE_ITEM_RUN_START_HERE.md");
  const receipt = {
    format: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_item_run_receipt_v1",
    runId: payload.runId,
    status: payload.status,
    runnerInvoked: payload.runnerInvoked,
    batchPath: payload.generatedEvidence?.batchPath || "",
    reviewScope: payload.reviewScope || null,
    selectedItem: payload.selectedItem,
    teacherConfirmed: payload.teacherConfirmed,
    rollbackPointCreated: payload.rollbackPointCreated,
    scheduledTaskInstalled: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false,
    locks: payload.locks
  };
  writeFileSync(runPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  writeReadme(readmePath, payload, receiptPath);
  return { runPath, receiptPath, readmePath, receipt };
}

function blockedPayload(runId, runDir, reason, queueInput, queue, item, extra = {}) {
  return {
    ok: true,
    format: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_item_run_v1",
    runId,
    createdAt: new Date().toISOString(),
    status: "blocked_before_coverage_enrollment_follow_up_handoff_runner",
    blockReason: reason,
    queuePath: queueInput.path,
    sourceQueueStatus: queue?.status || "",
    sourceQueueDecision: queue?.queueDecision || "",
    selectedItem: item
      ? {
          number: item.number || "",
          id: item.id || "",
          kind: item.kind || "",
          status: item.status || "",
          readyFollowUpIds: item.readyFollowUpIds || [],
          placeholders: commandPlaceholders(item),
          matchedForbiddenMarkers: commandSafety(item).matchedForbiddenMarkers
        }
      : null,
    teacherConfirmed: extra.teacherConfirmed || false,
    rollbackPointCreated: extra.rollbackPointCreated || false,
    runnerInvoked: false,
    generatedEvidence: {},
    blockedTransitions: [
      "invoke_enrollment_follow_up_batch_without_reviewed_handoff_item",
      "execute_queue_command_string",
      "invoke_multi_item_enrollment_follow_up_from_single_item_runner",
      "register_schedule_from_enrollment_follow_up_item_runner",
      "capture_screenshot_from_enrollment_follow_up_item_runner",
      "execute_target_software_from_enrollment_follow_up_item_runner",
      "write_memory_from_enrollment_follow_up_item_runner",
      "claim_all_software_coverage_complete_from_item_runner"
    ],
    paths: { runDir },
    locks: baseLocks({ runnerInvoked: false }),
    ...extra
  };
}

const goal = argValue("--goal", "Run one teacher-confirmed coverage enrollment follow-up handoff queue item.");
const queueInput = readJsonInput(
  argValue("--queue", argValue("--handoff-queue", "")),
  "--queue",
  "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_v1"
);
const queue = queueInput.value;
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-handoff-item-runs")
  )
);
mkdirSync(outputRoot, { recursive: true });
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const runDir = join(outputRoot, runId);
mkdirSync(runDir, { recursive: true });

const item = selectQueueItem(queue);
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--teacher-reviewed-confirmation", ""));
const teacherConfirmed = explicitTeacherConfirmation(teacherConfirmation);
const rollbackPoint = argValue("--rollback-point", argValue("--rollback", ""));
const rollbackPointCreated = hasFlag("--rollback-point-created") || Boolean(rollbackPoint);
const runReviewedHandoff = hasFlag("--run-reviewed-handoff") || hasFlag("--execute-reviewed-handoff");
const allowRunner = hasFlag("--allow-runner");

const blockers = [];
if (!item) blockers.push("reviewed_ready_handoff_item_not_found");
if (queue.status !== "ready_for_manual_review") blockers.push("source_queue_not_ready_for_manual_review");
if (queue.queueDecision !== "manual_low_token_batch_handoffs_ready") blockers.push("source_queue_decision_not_ready_for_manual_handoff");
if (item) {
  if (item.kind !== "reviewed_low_token_batch_command") blockers.push("selected_item_is_not_enrollment_follow_up_handoff");
  if (item.status !== "ready_for_manual_review_handoff") blockers.push("selected_item_not_ready_for_manual_review_handoff");
  if (item.safeForManualReviewHandoff !== true) blockers.push("selected_item_not_marked_safe_for_manual_review_handoff");
  if (commandPlaceholders(item).length) blockers.push("selected_item_has_unresolved_placeholders");
  if (!commandSafety(item).safe) blockers.push("selected_item_has_unsafe_command_markers");
  const { plan, followUpId } = buildBatchArgs(item, runDir);
  if (!plan) blockers.push("selected_item_missing_structured_plan_argument");
  if (!followUpId) blockers.push("selected_item_missing_ready_follow_up_id");
}
if (!runReviewedHandoff) blockers.push("missing_run_reviewed_handoff_flag");
if (!allowRunner) blockers.push("missing_allow_runner_flag");
if (!teacherConfirmed) blockers.push("missing_teacher_coverage_enrollment_follow_up_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed_for_coverage_enrollment_follow_up_item");

if (blockers.length) {
  const payload = blockedPayload(runId, runDir, blockers, queueInput, queue, item, {
    teacherConfirmed,
    rollbackPointCreated,
    rollbackPoint,
    requestedRunReviewedHandoff: runReviewedHandoff,
    allowRunner
  });
  const paths = writeOutput(runDir, payload);
  console.log(
    JSON.stringify(
      {
        ok: true,
        format: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_item_run_result_v1",
        status: payload.status,
        blockReason: blockers,
        runPath: paths.runPath,
        receiptPath: paths.receiptPath,
        readmePath: paths.readmePath,
        runnerInvoked: false,
        locks: payload.locks
      },
      null,
      2
    )
  );
  process.exit(0);
}

const { plan, followUpId, args: batchArgs } = buildBatchArgs(item, runDir);
const batchResult = runNodeScript("run-all-software-coverage-enrollment-follow-up-batch.mjs", batchArgs);
const batch =
  batchResult.batchPath && existsSync(batchResult.batchPath) ? readJson(batchResult.batchPath) : null;
const runResults = Array.isArray(batch?.runResults) ? batch.runResults : [];
const locks = baseLocks({
  runnerInvoked: true,
  enrollmentFollowUpBatchInvoked: true,
  queueItemRunnerDoesNotRegisterSchedule: batch?.locks?.scheduledTaskInstalled === false,
  queueItemRunnerDoesNotCaptureScreenshots: batch?.locks?.screenshotsCaptured === false,
  queueItemRunnerDoesNotExecuteTargetSoftware: batch?.locks?.softwareActionsExecuted === false,
  queueItemRunnerDoesNotWriteMemory: batch?.locks?.memoryWritten === false,
  allSoftwareCoverageComplete: false
});
const payload = {
  ok: true,
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_item_run_v1",
  runId,
  createdAt: new Date().toISOString(),
  goal,
  status: "reviewed_coverage_enrollment_follow_up_handoff_item_advanced",
  queuePath: queueInput.path,
  sourceQueueStatus: queue.status || "",
  sourceQueueDecision: queue.queueDecision || "",
  reviewScope: queue.reviewScope || null,
  selectedItem: {
    number: item.number || "",
    id: item.id || "",
    kind: item.kind || "",
    status: item.status || "",
    readyFollowUpIds: item.readyFollowUpIds || [],
    selectedFollowUpId: followUpId,
    reviewScope: item.reviewScope || queue.reviewScope || null,
    commandUsedForDisplayOnly: item.command || "",
    structuredArgumentsUsed: { ...(item.arguments || {}), plan, followUpId, maxItems: 1 }
  },
  teacherConfirmed,
  rollbackPointCreated,
  rollbackPoint,
  runnerInvoked: true,
  generatedEvidence: {
    batchPath: batchResult.batchPath || "",
    batchReceiptPath: batchResult.receiptPath || "",
    batchReadmePath: batchResult.readmePath || "",
    selectedItemCount: batch?.selectedItemCount || 0,
    ranToolCount: batch?.ranToolCount || 0,
    runResultStatuses: runResults.map((row) => row.status)
  },
  blockedTransitions: [
    "execute_queue_command_string",
    "invoke_more_than_one_follow_up_from_single_item_runner",
    "register_schedule_from_enrollment_follow_up_item_runner",
    "capture_screenshot_from_enrollment_follow_up_item_runner",
    "execute_target_software_from_enrollment_follow_up_item_runner",
    "write_memory_from_enrollment_follow_up_item_runner",
    "claim_all_software_coverage_complete_from_item_runner"
  ],
  paths: { runDir },
  locks
};
const paths = writeOutput(runDir, payload);
console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_item_run_result_v1",
      status: payload.status,
      runPath: paths.runPath,
      receiptPath: paths.receiptPath,
      readmePath: paths.readmePath,
      batchPath: batchResult.batchPath || "",
      batchReceiptPath: batchResult.receiptPath || "",
      runnerInvoked: true,
      selectedFollowUpId: followUpId,
      ranToolCount: payload.generatedEvidence.ranToolCount,
      locks
    },
    null,
    2
  )
);
