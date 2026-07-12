#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
  return String(value || "all-software-coverage-enrollment-follow-up-batch")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-coverage-enrollment-follow-up-batch";
}

function readJsonInput(input, label) {
  if (!input) throw new Error(`${label} is required`);
  const text = String(input).trim();
  if (existsSync(text)) return { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function runNodeScript(scriptName, args, timeout = 180000) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    allSoftwareCoverageComplete: false,
    teacherAcceptanceRequired: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    screenshotsCapturedByThisTool: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    scheduledTaskInstalled: false,
    nativeUniversalExecution: false
  };
}

function realPath(value) {
  const text = String(value || "").trim();
  return text && !text.includes("<") && existsSync(text) ? resolve(text) : "";
}

function writeNarrowedQueueForItem(queuePath, item, batchDir) {
  const target = String(item.arguments?.item || "").trim();
  if (!target) return { queuePath, narrowed: false, matchedCount: null };
  const queue = JSON.parse(readFileSync(queuePath, "utf8").replace(/^\uFEFF/, ""));
  const rows = Array.isArray(queue.queue) ? queue.queue : [];
  const software = String(item.software || "").trim();
  const processName = String(item.processName || "").trim();
  let matched = rows.filter(
    (row) =>
      (software && String(row.software || "") === software) ||
      (processName && String(row.processName || "") === processName)
  );
  if (matched.length === 0) {
    matched = rows.filter((row) => String(row.queueItemId || "") === target || String(row.item || "") === target);
  }
  const narrowedQueue = {
    ...queue,
    queueId: `${queue.queueId || "software-observer-queue"}-${item.followUpId}`,
    sourceQueueId: queue.queueId || "",
    sourceQueuePath: queuePath,
    narrowedBy: "coverage_enrollment_follow_up_item",
    narrowedFor: {
      followUpId: item.followUpId,
      ledgerNumber: item.ledgerNumber || "",
      software,
      processName,
      requestedItem: target,
      matchedCount: matched.length
    },
    queue: matched,
    locks: {
      ...(queue.locks || {}),
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      fullContinuousRecording: false,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      nativeUniversalExecution: false
    }
  };
  const narrowedDir = join(batchDir, "narrowed-queues", item.followUpId);
  mkdirSync(narrowedDir, { recursive: true });
  const narrowedPath = join(narrowedDir, "software-observer-queue.json");
  writeFileSync(narrowedPath, `${JSON.stringify(narrowedQueue, null, 2)}\n`, "utf8");
  return { queuePath: narrowedPath, narrowed: true, matchedCount: matched.length };
}

function selectedItems(plan, maxItems, followUpId = "") {
  const items = Array.isArray(plan.followUpItems) ? plan.followUpItems : [];
  const selected = followUpId ? items.filter((item) => String(item.followUpId || "") === String(followUpId)) : items;
  return selected
    .filter((item) => item.route !== "preserve_teacher_exclusion" && item.route !== "teacher_review_coverage_receipt")
    .slice(0, maxItems);
}

function dryRunResult(item, reason) {
  return {
    followUpId: item.followUpId,
    software: item.software,
    route: item.route,
    tool: item.tool,
    status: "dry_run_only",
    reason,
    ranTool: false,
    evidencePath: "",
    locks: locks()
  };
}

function runItem(item, options) {
  if (!options.teacherReviewed) {
    return dryRunResult(item, "blocked_until_teacher_review");
  }
  if (item.tool === "watch_log_source_metadata_deltas") {
    const queuePath = realPath(item.arguments?.queue);
    if (!queuePath) return dryRunResult(item, "missing_reviewed_queue_path_for_metadata_gate");
    const narrowedQueue = writeNarrowedQueueForItem(queuePath, item, options.batchDir);
    const result = runNodeScript("watch-log-source-metadata-deltas.mjs", [
      "--queue",
      narrowedQueue.queuePath,
      "--max-items",
      String(options.maxQueueItems),
      "--max-logs-per-item",
      String(options.maxLogsPerItem),
      "--state-dir",
      join(options.batchDir, "metadata-state"),
      "--output-dir",
      join(options.batchDir, "metadata-deltas", item.followUpId)
    ]);
    return {
      followUpId: item.followUpId,
      software: item.software,
      route: item.route,
      tool: item.tool,
      status: "metadata_gate_ran",
      ranTool: true,
      narrowedQueuePath: narrowedQueue.narrowed ? narrowedQueue.queuePath : "",
      narrowedQueueMatchedCount: narrowedQueue.matchedCount,
      evidencePath: result.gatePath || result.receiptPath || "",
      result,
      locks: locks()
    };
  }
  if (item.tool === "create_software_observer_queue") {
    const inventoryPath = realPath(item.arguments?.inventory);
    if (!inventoryPath) return dryRunResult(item, "missing_reviewed_inventory_path_for_queue_creation");
    const result = runNodeScript("create-software-observer-queue.mjs", [
      "--inventory",
      inventoryPath,
      "--max-candidates",
      String(options.maxQueueItems),
      "--max-files-per-candidate",
      String(options.maxLogsPerItem),
      "--output-dir",
      join(options.batchDir, "promoted-observer-queue", item.followUpId)
    ]);
    return {
      followUpId: item.followUpId,
      software: item.software,
      route: item.route,
      tool: item.tool,
      status: "observer_queue_created",
      ranTool: true,
      evidencePath: result.queuePath || "",
      result,
      locks: locks()
    };
  }
  if (item.fallbackTool === "run_software_observer_queue_item" && options.allowBoundedTail) {
    const queuePath = realPath(item.arguments?.queue);
    if (!queuePath) return dryRunResult(item, "missing_reviewed_queue_path_for_bounded_tail_fallback");
    const result = runNodeScript("run-software-observer-queue-item.mjs", [
      "--queue",
      queuePath,
      "--software",
      item.software || "",
      "--max-tail-lines",
      String(options.maxTailLines),
      "--max-tail-bytes",
      String(options.maxTailBytes),
      "--output-dir",
      join(options.batchDir, "queue-item-runs", item.followUpId)
    ]);
    return {
      followUpId: item.followUpId,
      software: item.software,
      route: item.route,
      tool: "run_software_observer_queue_item",
      status: "bounded_tail_queue_item_ran",
      ranTool: true,
      evidencePath: result.observationPath || result.receiptPath || "",
      result,
      locks: {
        ...locks(),
        logContentsRead: "bounded_tail_only",
        fullLogsRead: false,
        rawFullLogsRetained: false
      }
    };
  }
  if (item.tool === "teach_apprentice" || item.route === "ask_teacher_for_signal_or_exclusion") {
    return {
      followUpId: item.followUpId,
      software: item.software,
      route: item.route,
      tool: item.tool,
      status: "teacher_signal_question_prepared",
      ranTool: false,
      evidencePath: "",
      question: item.arguments?.message || "Please provide a low-token signal or explicit exclusion for this software.",
      locks: locks()
    };
  }
  return dryRunResult(item, "route_preserved_for_manual_review");
}

const planInput = readJsonInput(argValue("--plan", argValue("--follow-up-plan", "")), "--plan");
const plan = planInput.value;
if (plan.format !== "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1") {
  throw new Error("Expected transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1");
}
const reviewScope = plan.reviewScope || null;

const teacherReviewed = hasFlag("--teacher-reviewed") || hasFlag("--teacher-confirmed");
const allowBoundedTail = hasFlag("--allow-bounded-tail");
const followUpId = argValue("--follow-up-id", argValue("--item-id", ""));
const maxItems = Math.max(1, Number(argValue("--max-items", "8")));
const maxQueueItems = Math.max(1, Number(argValue("--max-queue-items", "8")));
const maxLogsPerItem = Math.max(1, Number(argValue("--max-logs-per-item", "4")));
const maxTailLines = Math.max(1, Number(argValue("--max-tail-lines", "40")));
const maxTailBytes = Math.max(1024, Number(argValue("--max-tail-bytes", "32768")));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-batches")));
mkdirSync(outputRoot, { recursive: true });
const batchId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(plan.goal || plan.planId)}`;
const batchDir = join(outputRoot, batchId);
mkdirSync(batchDir, { recursive: true });

const items = selectedItems(plan, maxItems, followUpId);
const runResults = items.map((item) =>
  runItem(item, {
    teacherReviewed,
    allowBoundedTail,
    maxQueueItems,
    maxLogsPerItem,
    maxTailLines,
    maxTailBytes,
    batchDir
  })
);
const ranToolCount = runResults.filter((item) => item.ranTool).length;
const routeCounts = runResults.reduce((counts, item) => {
  counts[item.status] = (counts[item.status] || 0) + 1;
  return counts;
}, {});

const batchPath = join(batchDir, "all-software-coverage-enrollment-follow-up-batch-run.json");
const receiptPath = join(batchDir, "all-software-coverage-enrollment-follow-up-batch-receipt.json");
const readmePath = join(batchDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_BATCH_START_HERE.md");

const batch = {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1",
  batchId,
  createdAt: new Date().toISOString(),
  sourcePlanPath: planInput.path,
  sourcePlanId: plan.planId || "",
  reviewScope,
  teacherReviewed,
  allowBoundedTail,
  selectedFollowUpId: followUpId,
  selectedItemCount: items.length,
  ranToolCount,
  routeCounts,
  runResults,
  nextRecommendedCommand: plan.nextLedgerCommand || "",
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    reason: "This batch runs or stages only selected low-token follow-up actions. It does not prove every installed app is covered.",
    stillNeeded: [
      "review the batch receipt with the teacher",
      "rerun coverage audit and enrollment ledger with new evidence",
      "record teacher exclusions for private or out-of-scope software",
      "continue batches until no in-scope row is waiting for evidence",
      "keep native semantic execution as a separate proof requirement"
    ]
  },
  locks: {
    ...locks(),
    logContentsRead: allowBoundedTail && ranToolCount > 0 ? "bounded_tail_only_when_explicitly_allowed" : false
  }
};

const receipt = {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_batch_receipt_v1",
  batchId,
  batchPath,
  sourcePlanPath: planInput.path,
  reviewScope,
  teacherReviewed,
  allowBoundedTail,
  selectedItemCount: items.length,
  ranToolCount,
  routeCounts,
  allSoftwareCoverageComplete: false,
  screenshotsCaptured: false,
  screenshotsCapturedByThisTool: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  logContentsRead: allowBoundedTail && ranToolCount > 0 ? "bounded_tail_only_when_explicitly_allowed" : false,
  fullLogsRead: false,
  fileContentsRead: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  scheduledTaskInstalled: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: batch.locks
};

writeFileSync(batchPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# All-Software Coverage Enrollment Follow-Up Batch",
    "",
    `Plan: ${planInput.path}`,
    `Teacher reviewed: ${teacherReviewed}`,
    `Allowed bounded tail reads: ${allowBoundedTail}`,
    "",
    "This batch advances selected enrollment follow-up rows with low-token actions only.",
    "",
    "It does not claim all-software completion. Review the receipt, then rerun the coverage audit and enrollment ledger.",
    "",
    "Important locks:",
    "",
    "- No screenshots are captured.",
    "- No target software commands are executed.",
    "- No memory, rules, schedules, or packaging are enabled.",
    "- Full logs are never read or retained.",
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_batch_result_v1",
      batchId,
      status: teacherReviewed ? "reviewed_low_token_batch_completed" : "waiting_for_teacher_review",
      batchPath,
      receiptPath,
      readmePath,
      selectedItemCount: items.length,
      ranToolCount,
      allSoftwareCoverageComplete: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false
    },
    null,
    2
  )
);
