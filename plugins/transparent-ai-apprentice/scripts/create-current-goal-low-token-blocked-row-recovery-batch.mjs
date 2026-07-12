#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function newestFile(root, fileName) {
  const resolvedRoot = resolve(root);
  if (!existsSync(resolvedRoot)) return "";
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(resolvedRoot);
  return found.sort((a, b) => b.time - a.time)[0]?.path || "";
}

function newestRollbackPoint(root) {
  return newestFile(join(root, ".transparent-apprentice", "rollback-points"), "rollback-point.json");
}

function slugify(value) {
  return (
    String(value || "low-token-blocked-row-recovery-batch")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 84) || "low-token-blocked-row-recovery-batch"
  );
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    batchDoesNotBindQueue: true,
    batchDoesNotRunObserver: true,
    batchDoesNotRunMetadataGate: true,
    batchDoesNotReadLogs: true,
    batchDoesNotReadFullLogs: true,
    batchDoesNotCaptureScreenshots: true,
    batchDoesNotExecuteTargetSoftware: true,
    batchDoesNotRegisterSchedule: true,
    batchDoesNotWriteMemory: true,
    batchDoesNotDeleteRollbackPoint: true,
    fullContinuousRecording: false,
    observerQueueMutated: false,
    metadataGateRunnerInvoked: false,
    boundedTailReadInvoked: false,
    logContentsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    allSoftwareCoverageComplete: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function recoveryRoute(row) {
  const blockers = new Set([...(row.blockers || []), ...(row.proofSnapshotReview?.blockers || [])]);
  const missingQueue = blockers.has("missing_matching_observer_queue_row") || row.proofSnapshotReview?.queueItemMatched === false;
  const missingEvidence = blockers.has("missing_watch_or_compact_learning_evidence");
  if (missingQueue) return "teacher_bind_observer_queue_or_exclude";
  if (missingEvidence) return "teacher_request_compact_watch_evidence";
  return "teacher_review_or_exclude";
}

function routeTool(route) {
  if (route === "teacher_bind_observer_queue_or_exclude") return "create-all-software-observer-reviewed-queue-from-receipt.mjs";
  if (route === "teacher_request_compact_watch_evidence") return "run-all-software-low-token-learning-cycle.mjs";
  return "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs";
}

function writeHtml(path, batch) {
  const rows = batch.blockedRows
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.ledgerNumber)}</td>
        <td>${htmlEscape(row.software)}</td>
        <td>${htmlEscape(row.processName)}</td>
        <td><code>${htmlEscape(row.recommendedRecoveryRoute)}</code></td>
        <td>${htmlEscape(row.missingRequirements.join(", "))}</td>
        <td>${htmlEscape(row.reuseExistingTool)}</td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Low-Token Blocked Row Recovery Batch</title>
  <style>
    body { margin: 0; font: 14px/1.45 Segoe UI, Arial, sans-serif; color: #182433; background: #f6f8fb; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    section { background: #fff; border: 1px solid #d8e2ec; border-radius: 8px; padding: 16px; margin: 12px 0; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border-top: 1px solid #e5ebf2; padding: 8px; text-align: left; vertical-align: top; }
    pre, code { background: #edf3f8; border-radius: 5px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; }
    .lock { color: #8a3b00; font-weight: 700; }
  </style>
</head>
<body>
<main>
  <h1>Low-Token Blocked Row Recovery Batch</h1>
  <section>
    <p>Status: <code>${htmlEscape(batch.status)}</code></p>
    <p>Blocked rows in batch: <code>${htmlEscape(batch.blockedRows.length)}</code></p>
    <p class="lock">Review-only. No queue mutation, observer run, metadata gate run, log read, screenshot, software execution, memory write, or completion claim.</p>
    <p>Receipt template: <a href="${htmlEscape(fileHref(batch.paths.receiptTemplate))}">${htmlEscape(batch.paths.receiptTemplate)}</a></p>
  </section>
  <section>
    <h2>Recovery Rows</h2>
    <table>
      <thead><tr><th>#</th><th>Software</th><th>Process</th><th>Recommended Route</th><th>Missing Requirements</th><th>Reuse Tool</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
</main>
</body>
</html>
`,
    "utf8"
  );
}

function writeReadme(path, batch) {
  const lines = [
    "# Current Goal Low-Token Blocked Row Recovery Batch",
    "",
    `Status: ${batch.status}`,
    `Rows in batch: ${batch.blockedRows.length}`,
    "",
    "This batch turns blocked all-software low-token coverage rows into teacher decisions.",
    "It is review-only: it does not bind queues, run observers, read logs, capture screenshots, execute target software, write memory, delete rollback points, or claim completion.",
    "",
    "## Teacher Choices Per Row",
    "",
    "- `teacher_bind_observer_queue`: allow a later separate queue-binding tool to add this row to the reviewed observer queue.",
    "- `teacher_request_compact_watch_evidence`: request a later compact low-token watch or learning-cycle pass.",
    "- `teacher_excluded_or_private`: exclude or mark private with a reason.",
    "- `blocked_needs_more_low_token_evidence`: keep blocked and state what evidence is missing.",
    "- `needs_teacher_review`: leave unchanged.",
    "",
    "Rows:",
    ...batch.blockedRows.map((row) => `${row.ledgerNumber}. ${row.software}: ${row.recommendedRecoveryRoute}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const repoRoot = process.cwd();
const goal = argValue("--goal", "Build blocked low-token row recovery batch.");
const batchSize = Math.max(1, Number(argValue("--batch-size", "25")) || 25);
const skipBlockedRows = Math.max(0, Number(argValue("--skip-blocked-rows", "0")) || 0);
const cockpitPath = resolve(
  argValue(
    "--waiting-row-cockpit",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-waiting-row-cockpits"), "original-goal-low-token-coverage-waiting-row-cockpit.json")
  )
);
const coverageBridgePath = resolve(
  argValue(
    "--coverage-bridge",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-final-review-bridges"), "current-goal-low-token-coverage-final-review-bridge.json")
  )
);
const readyBatchPath = resolve(
  argValue(
    "--ready-row-batch",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-ready-row-teacher-batches"), "current-goal-low-token-ready-row-teacher-batch.json")
  )
);
const rollbackPath = resolve(argValue("--rollback-point", newestRollbackPoint(repoRoot)));
const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-low-token-blocked-row-recovery-batches"))
);
mkdirSync(outputRoot, { recursive: true });

const cockpit = existsSync(cockpitPath) ? readJson(cockpitPath) : null;
const coverageBridge = existsSync(coverageBridgePath) ? readJson(coverageBridgePath) : null;
const readyBatch = existsSync(readyBatchPath) ? readJson(readyBatchPath) : null;
const rollback = existsSync(rollbackPath) ? readJson(rollbackPath) : null;
const blockedRows = (Array.isArray(cockpit?.reviewRows) ? cockpit.reviewRows : [])
  .filter((row) => row?.reviewStatus === "blocked_needs_more_low_token_evidence")
  .slice(skipBlockedRows, skipBlockedRows + batchSize)
  .map((row) => {
    const route = recoveryRoute(row);
    return {
      rowId: row.rowId,
      ledgerNumber: row.ledgerNumber,
      software: row.software || "",
      processName: row.processName || "",
      reviewStatus: row.reviewStatus || "",
      recommendedRecoveryRoute: route,
      reuseExistingTool: routeTool(route),
      coverageContractStatus: row.coverageContractReview?.status || "",
      missingRequirements: row.coverageContractReview?.missingRequirements || [],
      proofSnapshotBlockers: row.proofSnapshotReview?.blockers || [],
      cockpitBlockers: row.blockers || [],
      queueItemMatched: row.proofSnapshotReview?.queueItemMatched === true,
      lowTokenEvidenceKinds: row.proofSnapshotReview?.lowTokenEvidenceKinds || [],
      logSourceDiscoveryStatus: row.logSourceLedgerReview?.discoveryStatus || "",
      defaultTeacherDecision: "needs_teacher_review",
      allowedTeacherDecisions: [
        "needs_teacher_review",
        "teacher_bind_observer_queue",
        "teacher_request_compact_watch_evidence",
        "teacher_excluded_or_private",
        "blocked_needs_more_low_token_evidence"
      ],
      blockedTeacherDecisions: [
        "accepted",
        "bind_queue_now",
        "run_observer_now",
        "run_metadata_gate_now",
        "read_logs_now",
        "read_full_logs",
        "capture_screenshot_now",
        "execute_now",
        "write_memory",
        "claim_complete"
      ]
    };
  });

const blockers = [];
if (!cockpit) blockers.push("waiting_row_cockpit_missing");
if (!coverageBridge) blockers.push("coverage_final_review_bridge_missing");
if (!readyBatch) blockers.push("ready_row_teacher_batch_missing");
if (!rollback) blockers.push("rollback_point_missing");
if (blockedRows.length === 0) blockers.push("no_blocked_rows_found");

const batchId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const batchDir = join(outputRoot, batchId);
mkdirSync(batchDir, { recursive: true });
const batchPath = join(batchDir, "current-goal-low-token-blocked-row-recovery-batch.json");
const receiptTemplatePath = join(batchDir, "current-goal-low-token-blocked-row-recovery-batch-receipt-template.json");
const htmlPath = join(batchDir, "current-goal-low-token-blocked-row-recovery-batch.html");
const readmePath = join(batchDir, "CURRENT_GOAL_LOW_TOKEN_BLOCKED_ROW_RECOVERY_BATCH.md");

const receiptTemplate = {
  format: "transparent_ai_current_goal_low_token_blocked_row_recovery_batch_receipt_v1",
  batchId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["teacher_batch_reviewed", "blocked", "needs_teacher_review"],
  forbiddenTeacherDecisions: [
    "accepted",
    "bind_queue_now",
    "run_observer_now",
    "run_metadata_gate_now",
    "read_logs_now",
    "read_full_logs",
    "capture_screenshot_now",
    "execute_now",
    "write_memory",
    "claim_complete"
  ],
  rowDecisions: blockedRows.map((row) => ({
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber,
    software: row.software,
    teacherDecision: "needs_teacher_review",
    allowedTeacherDecisions: row.allowedTeacherDecisions,
    recommendedRecoveryRoute: row.recommendedRecoveryRoute,
    teacherEvidenceNote: "",
    keepRollbackPoint: true
  })),
  locks: locks()
};

const status = blockers.length
  ? "low_token_blocked_row_recovery_batch_needs_source_evidence"
  : "low_token_blocked_row_recovery_batch_waiting_for_teacher_receipt";
const routeCounts = blockedRows.reduce((acc, row) => {
  acc[row.recommendedRecoveryRoute] = (acc[row.recommendedRecoveryRoute] || 0) + 1;
  return acc;
}, {});
const batch = {
  ok: blockers.length === 0,
  format: "transparent_ai_current_goal_low_token_blocked_row_recovery_batch_v1",
  batchId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  blockers,
  batchSize,
  skipBlockedRows,
  batchRange: {
    startIndexZeroBased: skipBlockedRows,
    endIndexExclusive: skipBlockedRows + blockedRows.length,
    hasMoreBlockedRowsAfterBatch:
      (Array.isArray(cockpit?.reviewRows) ? cockpit.reviewRows : []).filter(
        (row) => row?.reviewStatus === "blocked_needs_more_low_token_evidence"
      ).length > skipBlockedRows + blockedRows.length
  },
  sourceEvidence: {
    waitingRowCockpit: existsSync(cockpitPath) ? cockpitPath : "",
    coverageFinalReviewBridge: existsSync(coverageBridgePath) ? coverageBridgePath : "",
    readyRowTeacherBatch: existsSync(readyBatchPath) ? readyBatchPath : "",
    rollbackPoint: existsSync(rollbackPath) ? rollbackPath : ""
  },
  cockpitCounts: cockpit?.counts || {},
  coverageBridgeStatus: coverageBridge?.status || "",
  readyBatchStatus: readyBatch?.status || "",
  rollbackStatus: rollback?.status || "",
  routeCounts,
  blockedRows,
  paths: {
    batch: batchPath,
    receiptTemplate: receiptTemplatePath,
    html: htmlPath,
    readme: readmePath
  },
  locks: locks()
};

writeJson(batchPath, batch);
writeJson(receiptTemplatePath, receiptTemplate);
writeHtml(htmlPath, batch);
writeReadme(readmePath, batch);

console.log(
  JSON.stringify(
    {
      ok: true,
      batchPath,
      receiptTemplatePath,
      htmlPath,
      readmePath,
      status: batch.status,
      blockers: batch.blockers,
      rows: batch.blockedRows.length,
      skipBlockedRows: batch.skipBlockedRows,
      batchRange: batch.batchRange,
      routeCounts: batch.routeCounts,
      firstSoftware: batch.blockedRows[0]?.software || ""
    },
    null,
    2
  )
);
