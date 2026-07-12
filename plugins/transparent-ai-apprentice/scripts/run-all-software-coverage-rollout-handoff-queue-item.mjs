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
    String(value || "coverage-rollout-handoff-item-runner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "coverage-rollout-handoff-item-runner"
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
    "teacher confirmed coverage rollout handoff item",
    "teacher approved coverage rollout handoff item",
    "teacher confirmed one coverage rollout batch",
    "run one reviewed coverage rollout handoff",
    "i confirm coverage rollout handoff item",
    "\u786e\u8ba4\u63a8\u8fdb\u4e00\u4e2a\u8986\u76d6\u961f\u5217\u9879",
    "\u786e\u8ba4\u8fd0\u884c\u4e00\u4e2a\u5df2\u5ba1\u6838\u8986\u76d6\u6279\u6b21",
    "\u5141\u8bb8\u63a8\u8fdb\u4e00\u4e2a coverage rollout handoff"
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
  return {
    safe: matchedForbiddenMarkers.length === 0,
    matchedForbiddenMarkers
  };
}

function selectQueueItem(queue) {
  const items = Array.isArray(queue.queueItems) ? queue.queueItems : [];
  const itemId = argValue("--item-id", "");
  const itemNumber = argValue("--item-number", argValue("--number", ""));
  const batchId = argValue("--batch-id", argValue("--batch", ""));
  if (itemId) return items.find((item) => String(item.id || "") === itemId) || null;
  if (itemNumber) return items.find((item) => String(item.number || "") === itemNumber) || null;
  if (batchId) return items.find((item) => String(item.batchId || item.arguments?.startBatch || item.arguments?.batch || "") === batchId) || null;
  return (
    items.find(
      (item) =>
        ["reviewed_coverage_rollout_supervisor_command", "reviewed_coverage_rollout_batch_command"].includes(item.kind) &&
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

function buildSupervisorArgs(item, runDir) {
  const input = item.arguments || {};
  const plan = input.plan || input.planPath || input.coverageExpansionPlan || input.expansionPlan || "";
  const maxBatches = Math.max(1, Number(input.maxBatches || 1));
  const args = [
    "--goal",
    "Advance one teacher-confirmed coverage rollout handoff item.",
    "--plan",
    plan,
    "--start-batch",
    String(input.startBatch || input.batch || item.batchId || "batch-001"),
    "--max-batches",
    String(maxBatches),
    "--output-dir",
    join(runDir, "coverage-rollout-supervisor")
  ];
  if (input.teacherReviewed === true) args.push("--teacher-reviewed");
  if (input.runsPerBatch || input.runs) args.push("--runs-per-batch", String(input.runsPerBatch || input.runs));
  if (input.maxItems) args.push("--max-items", String(input.maxItems));
  if (input.maxLearningItems) args.push("--max-learning-items", String(input.maxLearningItems));
  return { plan, maxBatches, args };
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: resolve(__dirname, "..", "..", ".."),
    encoding: "utf8",
    timeout: Math.max(120000, Number(argValue("--child-timeout-ms", "240000"))),
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

function writeReadme(path, payload, receiptPath) {
  const lines = [
    "# Coverage Rollout Handoff Queue Item Runner",
    "",
    `Status: ${payload.status}`,
    `Selected item: ${payload.selectedItem?.number || "none"} ${payload.selectedItem?.id || ""}`.trim(),
    `Runner invoked: ${payload.runnerInvoked}`,
    "",
    "Safety boundary:",
    "- This wrapper consumes one handoff queue item only.",
    "- It does not execute the queue command string; it reconstructs arguments for the existing supervisor.",
    "- It requires explicit teacher confirmation and rollback evidence before invoking the supervisor.",
    "- It does not register schedules, capture screenshots, execute target software, write memory, enable rules, unlock packaging, or claim all-software coverage completion.",
    "",
    "Review order:",
    `1. ${basename(path)} - this handoff item run packet.`,
    `2. ${basename(receiptPath)} - this handoff item receipt.`,
    payload.generatedEvidence?.supervisorPath
      ? `3. ${basename(payload.generatedEvidence.supervisorPath)} - bounded coverage rollout supervisor result.`
      : "3. No supervisor result was produced."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeOutput(runDir, payload) {
  const runPath = join(runDir, "all-software-coverage-rollout-handoff-queue-item-run.json");
  const receiptPath = join(runDir, "all-software-coverage-rollout-handoff-queue-item-run-receipt.json");
  const readmePath = join(runDir, "ALL_SOFTWARE_COVERAGE_ROLLOUT_HANDOFF_QUEUE_ITEM_RUN_START_HERE.md");
  const receipt = {
    format: "transparent_ai_all_software_coverage_rollout_handoff_queue_item_run_receipt_v1",
    runId: payload.runId,
    status: payload.status,
    runnerInvoked: payload.runnerInvoked,
    supervisorPath: payload.generatedEvidence?.supervisorPath || "",
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
    format: "transparent_ai_all_software_coverage_rollout_handoff_queue_item_run_v1",
    runId,
    createdAt: new Date().toISOString(),
    status: "blocked_before_coverage_rollout_handoff_runner",
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
          batchId: item.batchId || item.arguments?.startBatch || "",
          placeholders: commandPlaceholders(item),
          matchedForbiddenMarkers: commandSafety(item).matchedForbiddenMarkers
        }
      : null,
    teacherConfirmed: extra.teacherConfirmed || false,
    rollbackPointCreated: extra.rollbackPointCreated || false,
    runnerInvoked: false,
    generatedEvidence: {},
    blockedTransitions: [
      "invoke_rollout_supervisor_without_reviewed_handoff_item",
      "execute_queue_command_string",
      "invoke_multi_batch_rollout_from_single_item_runner",
      "register_schedule_from_coverage_rollout_item_runner",
      "capture_screenshot_from_coverage_rollout_item_runner",
      "execute_target_software_from_coverage_rollout_item_runner",
      "write_memory_from_coverage_rollout_item_runner",
      "claim_all_software_coverage_complete_from_item_runner"
    ],
    paths: { runDir },
    locks: baseLocks({ runnerInvoked: false }),
    ...extra
  };
}

const goal = argValue("--goal", "Run one teacher-confirmed coverage rollout handoff queue item.");
const queueInput = readJsonInput(
  argValue("--queue", argValue("--handoff-queue", "")),
  "--queue",
  "transparent_ai_all_software_coverage_rollout_handoff_queue_v1"
);
const queue = queueInput.value;
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-rollout-handoff-item-runs"))
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
const allowRunner = hasFlag("--allow-runner") || hasFlag("--allow-system-change");

const blockers = [];
if (!item) blockers.push("reviewed_ready_handoff_item_not_found");
if (queue.status !== "ready_for_manual_review") blockers.push("source_queue_not_ready_for_manual_review");
if (queue.queueDecision !== "manual_coverage_rollout_handoffs_ready") blockers.push("source_queue_decision_not_ready_for_manual_handoff");
if (item) {
  if (!["reviewed_coverage_rollout_supervisor_command", "reviewed_coverage_rollout_batch_command"].includes(item.kind)) {
    blockers.push("selected_item_is_not_coverage_rollout_handoff");
  }
  if (item.status !== "ready_for_manual_review_handoff") blockers.push("selected_item_not_ready_for_manual_review_handoff");
  if (item.safeForManualReviewHandoff !== true) blockers.push("selected_item_not_marked_safe_for_manual_review_handoff");
  if (commandPlaceholders(item).length) blockers.push("selected_item_has_unresolved_placeholders");
  if (!commandSafety(item).safe) blockers.push("selected_item_has_unsafe_command_markers");
  const { plan, maxBatches } = buildSupervisorArgs(item, runDir);
  if (!plan) blockers.push("selected_item_missing_structured_plan_argument");
  if (maxBatches !== 1) blockers.push("single_item_runner_refuses_multi_batch_handoff");
}
if (!runReviewedHandoff) blockers.push("missing_run_reviewed_handoff_flag");
if (!allowRunner) blockers.push("missing_allow_runner_flag");
if (!teacherConfirmed) blockers.push("missing_teacher_coverage_rollout_handoff_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed_for_coverage_rollout_handoff_item");

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
        format: "transparent_ai_all_software_coverage_rollout_handoff_queue_item_run_result_v1",
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

const { args: supervisorArgs } = buildSupervisorArgs(item, runDir);
const supervisorResult = runNodeScript("run-all-software-coverage-rollout-supervisor.mjs", supervisorArgs);
const supervisor = supervisorResult.supervisorPath && existsSync(supervisorResult.supervisorPath)
  ? readJson(supervisorResult.supervisorPath)
  : null;
const locks = baseLocks({
  runnerInvoked: true,
  rolloutSupervisorInvoked: true,
  queueItemRunnerDoesNotRegisterSchedule: supervisor?.locks?.scheduledTaskInstalled === false,
  queueItemRunnerDoesNotCaptureScreenshots: supervisor?.locks?.screenshotsCaptured === false,
  queueItemRunnerDoesNotExecuteTargetSoftware: supervisor?.locks?.softwareActionsExecuted === false,
  queueItemRunnerDoesNotWriteMemory: supervisor?.locks?.memoryWritten === false,
  allSoftwareCoverageComplete: false
});
const payload = {
  ok: true,
  format: "transparent_ai_all_software_coverage_rollout_handoff_queue_item_run_v1",
  runId,
  createdAt: new Date().toISOString(),
  goal,
  status: "reviewed_coverage_rollout_handoff_item_advanced",
  queuePath: queueInput.path,
  sourceQueueStatus: queue.status,
  sourceQueueDecision: queue.queueDecision,
  selectedItem: {
    number: item.number || "",
    id: item.id || "",
    kind: item.kind || "",
    status: item.status || "",
    batchId: item.batchId || item.arguments?.startBatch || "",
    commandUsedForDisplayOnly: item.command || "",
    structuredArgumentsUsed: item.arguments || {}
  },
  teacherConfirmed,
  teacherConfirmation,
  rollbackPointCreated,
  rollbackPoint,
  requestedRunReviewedHandoff: runReviewedHandoff,
  allowRunner,
  runnerInvoked: true,
  supervisorResult,
  supervisorSummary: supervisor
    ? {
        status: supervisor.status || "",
        selectedBatches: supervisor.selectedBatches || [],
        completedBatchPackets: supervisor.completedBatchPackets || 0,
        auditPackets: Array.isArray(supervisor.auditPackets) ? supervisor.auditPackets.length : supervisor.auditPackets || 0,
        compactLearningEvents: supervisor.counts?.compactLearningEvents || 0,
        allSoftwareCoverageComplete: false
      }
    : null,
  generatedEvidence: {
    supervisorPath: supervisorResult.supervisorPath || "",
    supervisorReceiptPath: supervisorResult.receiptPath || "",
    supervisorReadmePath: supervisorResult.readmePath || ""
  },
  nextReviewActions: [
    "Open the supervisor readme and verify the selected batch and post-batch audit.",
    "Create or refresh coverage convergence audit before considering the next handoff item.",
    "Keep all-software coverage incomplete until every in-scope batch is reviewed and confirmed."
  ],
  blockedTransitions: [
    "execute_queue_command_string",
    "invoke_additional_handoff_items_without_teacher_confirmation",
    "register_schedule_from_coverage_rollout_item_runner",
    "capture_screenshot_from_coverage_rollout_item_runner",
    "execute_target_software_from_coverage_rollout_item_runner",
    "write_memory_from_coverage_rollout_item_runner",
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
      format: "transparent_ai_all_software_coverage_rollout_handoff_queue_item_run_result_v1",
      status: payload.status,
      runPath: paths.runPath,
      receiptPath: paths.receiptPath,
      readmePath: paths.readmePath,
      supervisorPath: supervisorResult.supervisorPath || "",
      runnerInvoked: true,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      memoryWritten: false,
      nativeUniversalExecution: false,
      allSoftwareCoverageComplete: false,
      locks
    },
    null,
    2
  )
);
