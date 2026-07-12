#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "execution-follow-up-handoff-item")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-follow-up-handoff-item"
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

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function commandPlaceholders(command, args = {}) {
  return Array.from(new Set(`${command || ""} ${JSON.stringify(args || {})}`.match(/<[^<>]+>/g) || []));
}

function commandSafety(commandLine, args = {}) {
  const lower = `${String(commandLine || "")} ${JSON.stringify(args || {})}`.toLowerCase();
  const forbiddenMarkers = [
    "--execute",
    "-execute",
    " execute-mode ",
    " run_execute_mode ",
    "\"execute\":true",
    "\"execute\": true",
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

function selectQueueItem(queue, selectors = {}) {
  const items = Array.isArray(queue.queueItems) ? queue.queueItems : [];
  if (selectors.itemId) return items.find((item) => String(item.id || "") === selectors.itemId) || null;
  if (selectors.rowId) return items.find((item) => String(item.rowId || "") === selectors.rowId) || null;
  if (selectors.itemNumber) return items.find((item) => String(item.number || "") === selectors.itemNumber) || null;
  return (
    items.find(
      (item) =>
        item.kind === "reviewed_dry_run_runner_command" &&
        item.status === "ready_for_manual_review_handoff" &&
        item.safeForManualReviewHandoff === true &&
        commandPlaceholders(item.command, item.arguments).length === 0
    ) || null
  );
}

function dashFlag(key) {
  return `--${String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase()}`;
}

function pushOptional(args, key, value) {
  if (value === undefined || value === null || value === "" || value === false) return;
  if (Array.isArray(value)) {
    for (const item of value) pushOptional(args, key, item);
    return;
  }
  args.push(dashFlag(key), String(value));
}

function buildRunnerArgs(item, runDir) {
  const input = item.arguments || {};
  const pilotQueue = input.queue || input.queuePath || input.executionPilotQueue || input.executionPilotQueuePath || "";
  const runnerArgs = ["--queue", pilotQueue, "--output-dir", join(runDir, "pilot-runner")];
  pushOptional(runnerArgs, "pilotId", input.pilotId || input.pilot_id);
  pushOptional(runnerArgs, "pilotIndex", input.pilotIndex || input.pilot_index || (!input.pilotId ? "1" : ""));
  pushOptional(runnerArgs, "adapterId", input.adapterId || input.adapter_id);
  pushOptional(runnerArgs, "maxItems", input.maxItems);
  pushOptional(runnerArgs, "maxLogsPerItem", input.maxLogsPerItem);
  pushOptional(runnerArgs, "teacherMarker", input.teacherMarker || input.teacherMarkers);
  pushOptional(runnerArgs, "reviewedCommand", input.reviewedCommand);
  pushOptional(runnerArgs, "reviewedApiRequest", input.reviewedApiRequest);
  pushOptional(runnerArgs, "reviewedMapping", input.reviewedMapping);
  pushOptional(runnerArgs, "reviewedBrowserTarget", input.reviewedBrowserTarget);
  pushOptional(runnerArgs, "targetWindowTitle", input.targetWindowTitle);
  return { pilotQueue, runnerArgs };
}

function baseLocks(overrides = {}) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    dryRunOnly: true,
    executeModeBlocked: true,
    queueItemRunnerDoesNotPassExecuteFlag: true,
    queueItemRunnerDoesNotExecuteTargetSoftware: true,
    queueItemRunnerDoesNotSendUiEvents: true,
    queueItemRunnerDoesNotReadLogs: true,
    queueItemRunnerDoesNotCaptureScreenshots: true,
    queueItemRunnerDoesNotRegisterSchedule: true,
    queueItemRunnerDoesNotWriteMemory: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false,
    ...overrides
  };
}

function writeReadme(path, payload, receiptPath) {
  const lines = [
    "# Execution Follow-Up Handoff Queue Item Runner",
    "",
    `Status: ${payload.status}`,
    `Selected item: ${payload.selectedItem?.number || "none"} ${payload.selectedItem?.id || ""}`.trim(),
    `Runner invoked: ${payload.runnerInvoked}`,
    "",
    "Safety boundary:",
    "- This wrapper only invokes the existing pilot runner in dry-run mode.",
    "- It never passes --execute, never sends UI events, never captures screenshots, never registers schedules, never writes memory, and never claims universal execution.",
    "- Teacher review is still required before any execute request, rule save, or packaging step.",
    "",
    "Review order:",
    `1. ${basename(path)} - this handoff item run packet.`,
    `2. ${basename(receiptPath)} - this handoff item receipt.`,
    payload.generatedEvidence?.pilotRunnerRunPath
      ? `3. ${basename(payload.generatedEvidence.pilotRunnerRunPath)} - dry-run pilot runner result.`
      : "3. No pilot runner result was produced.",
    payload.generatedEvidence?.pilotRunnerReceiptPath
      ? `4. ${basename(payload.generatedEvidence.pilotRunnerReceiptPath)} - dry-run pilot runner receipt.`
      : "4. No pilot runner receipt was produced.",
    "",
    "Locked boundary: accepted=false, ruleEnabled=false, packagingGated=true, targetSoftwareCommandsExecuted=false, screenshotsCaptured=false, memoryWritten=false, nativeUniversalExecution=false, goalComplete=false."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeOutput(runDir, payload) {
  const runPath = join(runDir, "all-software-execution-follow-up-handoff-queue-item-run.json");
  const receiptPath = join(runDir, "all-software-execution-follow-up-handoff-queue-item-run-receipt.json");
  const readmePath = join(runDir, "ALL_SOFTWARE_EXECUTION_FOLLOW_UP_HANDOFF_QUEUE_ITEM_RUN_START_HERE.md");
  const receipt = {
    format: "transparent_ai_all_software_execution_follow_up_handoff_queue_item_run_receipt_v1",
    runId: payload.runId,
    status: payload.status,
    runnerInvoked: payload.runnerInvoked,
    dryRunOnly: true,
    executeRequested: false,
    pilotRunnerStatus: payload.pilotRunnerResult?.status || "",
    pilotRunnerReceiptPath: payload.generatedEvidence?.pilotRunnerReceiptPath || "",
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false,
    locks: payload.locks
  };
  writeFileSync(runPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  writeReadme(readmePath, payload, receiptPath);
  return { runPath, receiptPath, readmePath, receipt };
}

function blockedPayload(runId, runDir, reason, queueInput, queue, item, extra = {}) {
  const locks = baseLocks({ runnerInvoked: false });
  return {
    ok: true,
    format: "transparent_ai_all_software_execution_follow_up_handoff_queue_item_run_v1",
    runId,
    createdAt: new Date().toISOString(),
    status: "blocked_before_pilot_runner",
    blockReason: reason,
    queuePath: queueInput.path,
    sourceQueueStatus: queue?.status || "",
    sourceQueueDecision: queue?.queueDecision || "",
    selectedItem: item
      ? {
          number: item.number || "",
          id: item.id || "",
          rowId: item.rowId || "",
          kind: item.kind || "",
          status: item.status || "",
          command: item.command || "",
          placeholders: commandPlaceholders(item.command, item.arguments),
          matchedForbiddenMarkers: commandSafety(item.command, item.arguments).matchedForbiddenMarkers
        }
      : null,
    runnerInvoked: false,
    executeRequested: false,
    blockedTransitions: [
      "invoke_pilot_runner_with_unreviewed_handoff_item",
      "pass_execute_flag_to_pilot_runner",
      "execute_target_software_from_handoff_item_runner",
      "send_ui_events_from_handoff_item_runner",
      "read_logs_from_handoff_item_runner",
      "capture_screenshot_from_handoff_item_runner",
      "register_schedule_from_handoff_item_runner",
      "write_memory_from_handoff_item_runner",
      "claim_native_universal_execution_from_handoff_item_runner",
      "claim_goal_complete_from_handoff_item_runner"
    ],
    paths: {
      runDir,
      queue: queueInput.path
    },
    generatedEvidence: {},
    locks,
    ...extra
  };
}

const goal = argValue("--goal", "Run one execution follow-up handoff queue item through the dry-run pilot runner.");
const queueInput = readJsonInput(
  argValue("--queue", argValue("--handoff-queue", "")),
  "--queue",
  "transparent_ai_all_software_execution_follow_up_handoff_queue_v1"
);
if (!queueInput.value) throw new Error("--queue is required");

const queue = queueInput.value;
const item = selectQueueItem(queue, {
  itemId: argValue("--item-id", ""),
  rowId: argValue("--row-id", ""),
  itemNumber: argValue("--item-number", "")
});

const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, ".transparent-apprentice", "all-software-execution-follow-up-handoff-item-runs"))
);
mkdirSync(outputRoot, { recursive: true });
const itemSlug = item ? `${item.number || "item"}-${item.rowId || item.id || item.kind || "handoff"}` : "missing-item";
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(itemSlug)}`;
const runDir = join(outputRoot, runId);
mkdirSync(runDir, { recursive: true });

let payload;
if (!item) {
  payload = blockedPayload(runId, runDir, "selected handoff queue item was not found", queueInput, queue, null);
} else {
  const placeholders = commandPlaceholders(item.command, item.arguments);
  const safety = commandSafety(item.command, item.arguments);
  const args = item.arguments || {};
  const stateArgsPresent = Boolean(args.state || args.stateDir || args.state_dir);
  const { pilotQueue, runnerArgs } = buildRunnerArgs(item, runDir);
  const pilotQueuePath = pilotQueue ? resolve(pilotQueue) : "";

  if (item.kind !== "reviewed_dry_run_runner_command") {
    payload = blockedPayload(runId, runDir, "selected queue item is not a reviewed dry-run runner command", queueInput, queue, item);
  } else if (item.status !== "ready_for_manual_review_handoff" || item.safeForManualReviewHandoff !== true) {
    payload = blockedPayload(runId, runDir, "selected runner item is not ready for manual review handoff", queueInput, queue, item);
  } else if (placeholders.length) {
    payload = blockedPayload(runId, runDir, "selected runner item still has unresolved placeholders", queueInput, queue, item, {
      unresolvedPlaceholders: placeholders
    });
  } else if (!safety.safe) {
    payload = blockedPayload(runId, runDir, "selected runner item contains unsafe command markers", queueInput, queue, item, {
      matchedForbiddenMarkers: safety.matchedForbiddenMarkers
    });
  } else if (args.execute === true || String(args.execute).toLowerCase() === "true") {
    payload = blockedPayload(runId, runDir, "selected runner item requested execute mode", queueInput, queue, item);
  } else if (stateArgsPresent) {
    payload = blockedPayload(runId, runDir, "state/state-dir log inputs require a separate low-token log review gate before this dry-run runner wrapper", queueInput, queue, item);
  } else if (!pilotQueue) {
    payload = blockedPayload(runId, runDir, "selected runner item is missing arguments.queue", queueInput, queue, item);
  } else if (!existsSync(pilotQueuePath)) {
    payload = blockedPayload(runId, runDir, "selected runner item queue path does not exist", queueInput, queue, item, {
      pilotQueue
    });
  } else {
    const runnerPath = join(pluginRoot, "scripts", "run-all-software-execution-pilot-runner.mjs");
    const runnerResult = spawnSync(process.execPath, [runnerPath, ...runnerArgs], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 180000
    });
    const parsedRunner = runnerResult.stdout?.trim().startsWith("{") ? JSON.parse(runnerResult.stdout) : null;
    if (runnerResult.status !== 0) {
      payload = blockedPayload(runId, runDir, "dry-run pilot runner failed before review evidence could be completed", queueInput, queue, item, {
        runnerInvoked: true,
        runnerExitStatus: runnerResult.status,
        runnerStdoutPreview: String(runnerResult.stdout || "").slice(0, 1200),
        runnerStderrPreview: String(runnerResult.stderr || "").slice(0, 1200),
        locks: baseLocks({ runnerInvoked: true })
      });
    } else {
      const runnerReceipt = readJsonOptional(parsedRunner?.receiptPath);
      const locks = baseLocks({
        runnerInvoked: true,
        queueItemRunnerInvokedExistingPilotRunner: true,
        pilotRunnerDryRunCompleted: true
      });
      payload = {
        ok: true,
        format: "transparent_ai_all_software_execution_follow_up_handoff_queue_item_run_v1",
        runId,
        createdAt: new Date().toISOString(),
        goal,
        status: "dry_run_pilot_runner_completed_waiting_for_teacher_review",
        queuePath: queueInput.path,
        sourceQueueStatus: queue.status || "",
        sourceQueueDecision: queue.queueDecision || "",
        selectedItem: {
          number: item.number || "",
          id: item.id || "",
          rowId: item.rowId || "",
          kind: item.kind || "",
          status: item.status || "",
          command: item.command || "",
          arguments: item.arguments || {},
          placeholders,
          matchedForbiddenMarkers: safety.matchedForbiddenMarkers
        },
        runnerInvoked: true,
        executeRequested: false,
        runnerExitStatus: runnerResult.status,
        runnerStdoutPreview: String(runnerResult.stdout || "").slice(0, 1200),
        runnerStderrPreview: String(runnerResult.stderr || "").slice(0, 1200),
        pilotRunnerResult: parsedRunner,
        pilotRunnerReceiptStatus: runnerReceipt?.status || "",
        sourceEvidence: {
          handoffQueuePath: queueInput.path,
          sourceValidation: queue.sourceValidation || "",
          executionPilotQueuePath: pilotQueuePath,
          selectedCommand: item.command || ""
        },
        generatedEvidence: {
          pilotRunnerRunPath: parsedRunner?.runPath || "",
          pilotRunnerReceiptPath: parsedRunner?.receiptPath || "",
          adapterReceiptPath: parsedRunner?.adapterReceiptPath || "",
          outcomeVerificationPath: parsedRunner?.outcomeVerificationPath || "",
          postActionCheckpointPath: parsedRunner?.postActionCheckpointPath || ""
        },
        nextTeacherActions: [
          "Review this handoff item receipt and the dry-run pilot runner receipt.",
          "Confirm whether the selected pilot, adapter, and dry-run evidence match the teacher intent.",
          "If correct, choose another reviewed dry-run handoff item; do not claim universal execution from one item.",
          "If wrong, correct the source execution follow-up receipt and rebuild the handoff queue."
        ],
        blockedTransitions: [
          "pass_execute_flag_to_pilot_runner",
          "execute_target_software_from_handoff_item_runner",
          "send_ui_events_from_handoff_item_runner",
          "read_logs_from_handoff_item_runner",
          "capture_screenshot_from_handoff_item_runner",
          "register_schedule_from_handoff_item_runner",
          "write_memory_from_handoff_item_runner",
          "claim_native_universal_execution_from_handoff_item_runner",
          "claim_goal_complete_from_handoff_item_runner"
        ],
        paths: {
          runDir,
          queue: queueInput.path,
          queueUrl: fileHref(queueInput.path)
        },
        completionBoundary: {
          allSoftwareExecutionComplete: false,
          nativeUniversalExecution: false,
          reason:
            "This wrapper consumes one reviewed dry-run handoff item and invokes one existing pilot runner in dry-run mode only. It does not execute target software or prove universal native execution."
        },
        locks
      };
    }
  }
}

const output = writeOutput(runDir, payload);
console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_follow_up_handoff_queue_item_run_result_v1",
      status: payload.status,
      runId,
      runDir,
      runPath: output.runPath,
      receiptPath: output.receiptPath,
      readmePath: output.readmePath,
      runnerInvoked: payload.runnerInvoked,
      pilotRunnerRunPath: payload.generatedEvidence?.pilotRunnerRunPath || "",
      pilotRunnerReceiptPath: payload.generatedEvidence?.pilotRunnerReceiptPath || "",
      executeRequested: false,
      targetSoftwareCommandsExecuted: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false,
      locks: output.receipt.locks
    },
    null,
    2
  )
);
