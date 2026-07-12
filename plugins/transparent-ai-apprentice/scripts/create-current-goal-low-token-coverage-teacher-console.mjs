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

function visitFiles(root, fileName) {
  const resolvedRoot = resolve(root);
  if (!existsSync(resolvedRoot)) return [];
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(resolvedRoot);
  return found;
}

function newestFile(root, fileName) {
  return visitFiles(root, fileName).sort((a, b) => b.time - a.time)[0]?.path || "";
}

function newestRollbackPoint(root) {
  return newestFile(join(root, ".transparent-apprentice", "rollback-points"), "rollback-point.json");
}

function slugify(value) {
  return (
    String(value || "low-token-coverage-teacher-console")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 84) || "low-token-coverage-teacher-console"
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
    consoleDoesNotFillReceipts: true,
    consoleDoesNotBindQueue: true,
    consoleDoesNotRunObserver: true,
    consoleDoesNotRunMetadataGate: true,
    consoleDoesNotReadLogs: true,
    consoleDoesNotReadFullLogs: true,
    consoleDoesNotCaptureScreenshots: true,
    consoleDoesNotExecuteTargetSoftware: true,
    consoleDoesNotRegisterSchedule: true,
    consoleDoesNotWriteMemory: true,
    consoleDoesNotDeleteRollbackPoint: true,
    observerQueueMutated: false,
    metadataGateRunnerInvoked: false,
    logContentsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    memoryWritten: false,
    allSoftwareCoverageComplete: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function laneById(gate, id) {
  return (Array.isArray(gate?.lanes) ? gate.lanes : []).find((lane) => lane?.id === id) || null;
}

function evidenceLinkRows(map) {
  return Object.entries(map)
    .map(
      ([key, value]) =>
        `<tr><td><code>${htmlEscape(key)}</code></td><td><a href="${htmlEscape(fileHref(value))}">${htmlEscape(value || "missing")}</a></td></tr>`
    )
    .join("\n");
}

function writeHtml(path, consoleArtifact) {
  const blockedRows = consoleArtifact.blockedBatchIndex.batchRows
    .map(
      (row) => `<tr><td>${htmlEscape(row.skipBlockedRows)}</td><td>${htmlEscape(row.rows)}</td><td>${htmlEscape(row.startLedgerNumber)}-${htmlEscape(row.endLedgerNumber)}</td><td>${htmlEscape(row.firstSoftware)}</td><td>${htmlEscape(row.lastSoftware)}</td></tr>`
    )
    .join("\n");
  const stepRows = consoleArtifact.teacherActionSequence
    .map(
      (step) => `<tr><td><code>${htmlEscape(step.id)}</code></td><td>${htmlEscape(step.action)}</td><td>${htmlEscape(step.continueCondition)}</td><td>${htmlEscape(step.stopCondition)}</td></tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>All-Software Low-Token Teacher Console</title>
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
  <h1>All-Software Low-Token Teacher Console</h1>
  <section>
    <p>Status: <code>${htmlEscape(consoleArtifact.status)}</code></p>
    <p>Final lane ready: <code>${htmlEscape(consoleArtifact.finalLane.ready)}</code></p>
    <p class="lock">Review-only. This console does not fill receipts, bind queues, run observers, read logs, capture screenshots, execute software, write memory, delete rollback points, or claim completion.</p>
  </section>
  <section>
    <h2>Coverage State</h2>
    <table><tbody>
      <tr><th>Total software rows</th><td>${htmlEscape(consoleArtifact.coverageTotals.totalRows)}</td></tr>
      <tr><th>Ready rows waiting for teacher receipt</th><td>${htmlEscape(consoleArtifact.coverageTotals.readyRowsWaitingForReceipt)}</td></tr>
      <tr><th>Blocked rows covered by recovery batches</th><td>${htmlEscape(consoleArtifact.coverageTotals.blockedRowsCoveredByRecoveryBatches)}</td></tr>
      <tr><th>Blocked batch coverage complete for review</th><td>${htmlEscape(consoleArtifact.coverageTotals.blockedBatchCoverageCompleteForReview)}</td></tr>
    </tbody></table>
  </section>
  <section>
    <h2>Blocked Recovery Batches</h2>
    <table><thead><tr><th>Skip</th><th>Rows</th><th>Ledger Range</th><th>First</th><th>Last</th></tr></thead><tbody>${blockedRows}</tbody></table>
  </section>
  <section>
    <h2>Teacher Action Sequence</h2>
    <table><thead><tr><th>Step</th><th>Action</th><th>Continue</th><th>Stop</th></tr></thead><tbody>${stepRows}</tbody></table>
  </section>
  <section>
    <h2>Source Evidence</h2>
    <table><thead><tr><th>Source</th><th>Path</th></tr></thead><tbody>${evidenceLinkRows(consoleArtifact.sourceEvidence)}</tbody></table>
  </section>
</main>
</body>
</html>
`,
    "utf8"
  );
}

function writeReadme(path, consoleArtifact) {
  const lines = [
    "# All-Software Low-Token Teacher Console",
    "",
    `Status: ${consoleArtifact.status}`,
    `Total rows: ${consoleArtifact.coverageTotals.totalRows}`,
    `Ready rows waiting for receipt: ${consoleArtifact.coverageTotals.readyRowsWaitingForReceipt}`,
    `Blocked rows covered by recovery batches: ${consoleArtifact.coverageTotals.blockedRowsCoveredByRecoveryBatches}`,
    "",
    "This console is a review-only entrypoint for all-software low-token coverage. It does not fill receipts, bind queues, run observers, read logs, capture screenshots, execute target software, write memory, delete rollback points, or claim completion.",
    "",
    "## Teacher Sequence",
    "",
    ...consoleArtifact.teacherActionSequence.map((step, index) => `${index + 1}. ${step.action}`),
    "",
    "## Final Gate Boundary",
    "",
    consoleArtifact.finalLane.blocker || "Final low-token lane is still not complete."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const repoRoot = process.cwd();
const goal = argValue("--goal", "Create all-software low-token coverage teacher console.");
const finalGatePath = resolve(
  argValue(
    "--final-completion-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-final-completion-gates"), "original-goal-final-completion-gate.json")
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
const blockedIndexPath = resolve(
  argValue(
    "--blocked-row-index",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-blocked-row-recovery-batch-indexes"), "current-goal-low-token-blocked-row-recovery-batch-index.json")
  )
);
const rollbackPath = resolve(argValue("--rollback-point", newestRollbackPoint(repoRoot)));
const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-low-token-coverage-teacher-consoles"))
);
mkdirSync(outputRoot, { recursive: true });

const finalGate = existsSync(finalGatePath) ? readJson(finalGatePath) : null;
const coverageBridge = existsSync(coverageBridgePath) ? readJson(coverageBridgePath) : null;
const readyBatch = existsSync(readyBatchPath) ? readJson(readyBatchPath) : null;
const blockedIndex = existsSync(blockedIndexPath) ? readJson(blockedIndexPath) : null;
const rollback = existsSync(rollbackPath) ? readJson(rollbackPath) : null;
const lowTokenLane = laneById(finalGate, "all_software_low_token_coverage_final_review");

const blockers = [];
if (!finalGate) blockers.push("final_completion_gate_missing");
if (!lowTokenLane) blockers.push("all_software_low_token_final_lane_missing");
if (!coverageBridge) blockers.push("coverage_final_review_bridge_missing");
if (!readyBatch) blockers.push("ready_row_teacher_batch_missing");
if (!blockedIndex) blockers.push("blocked_row_recovery_batch_index_missing");
if (!rollback) blockers.push("rollback_point_missing");
if (blockedIndex && blockedIndex.coverageCompleteForReview !== true) blockers.push("blocked_recovery_batches_do_not_cover_all_blocked_rows");
if (readyBatch && readyBatch.readyRows?.length <= 0) blockers.push("ready_row_batch_empty");

const totalRows = Number(coverageBridge?.coverageCounts?.ledgerRows || 0);
const readyRows = Number(readyBatch?.readyRows?.length || 0);
const blockedRows = Number(blockedIndex?.totalRowsInLatestBatches || 0);
const consoleStatus = blockers.length
  ? "low_token_coverage_teacher_console_needs_source_evidence"
  : "low_token_coverage_teacher_console_ready_for_teacher_receipts_not_completion";
const consoleId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const consoleDir = join(outputRoot, consoleId);
mkdirSync(consoleDir, { recursive: true });
const consolePath = join(consoleDir, "current-goal-low-token-coverage-teacher-console.json");
const htmlPath = join(consoleDir, "current-goal-low-token-coverage-teacher-console.html");
const readmePath = join(consoleDir, "CURRENT_GOAL_LOW_TOKEN_COVERAGE_TEACHER_CONSOLE.md");

const consoleArtifact = {
  ok: blockers.length === 0,
  format: "transparent_ai_current_goal_low_token_coverage_teacher_console_v1",
  consoleId,
  createdAt: new Date().toISOString(),
  goal,
  status: consoleStatus,
  blockers,
  finalLane: {
    id: lowTokenLane?.id || "all_software_low_token_coverage_final_review",
    ready: lowTokenLane?.ready === true,
    blocker: lowTokenLane?.blocker || "",
    sourcePath: lowTokenLane?.sourcePath || ""
  },
  coverageTotals: {
    totalRows,
    readyRowsWaitingForReceipt: readyRows,
    blockedRowsCoveredByRecoveryBatches: blockedRows,
    combinedRowsRoutedForTeacherReview: readyRows + blockedRows,
    blockedBatchCoverageCompleteForReview: blockedIndex?.coverageCompleteForReview === true,
    completionClaimAllowed: false
  },
  readyBatch: {
    status: readyBatch?.status || "",
    rows: readyRows,
    firstSoftware: readyBatch?.readyRows?.[0]?.software || "",
    receiptTemplate: readyBatch?.paths?.receiptTemplate || ""
  },
  blockedBatchIndex: {
    status: blockedIndex?.status || "",
    expectedBlockedRows: blockedIndex?.expectedBlockedRows || 0,
    totalRowsInLatestBatches: blockedIndex?.totalRowsInLatestBatches || 0,
    actualSkips: blockedIndex?.actualSkips || [],
    batchRows: blockedIndex?.batchRows || []
  },
  teacherActionSequence: [
    {
      id: "review_ready_rows",
      action: "Fill the ready-row teacher receipt for the 10 metadata-gate-ready rows.",
      continueCondition: "Every row is marked ready, blocked with evidence need, excluded/private, or left for review.",
      stopCondition: "Any row attempts to run metadata gate, read logs, capture screenshots, execute software, write memory, or claim completion."
    },
    {
      id: "review_blocked_recovery_batches",
      action: "Review the 8 blocked-row recovery batches covering 178 rows and choose bind queue, request compact evidence, exclude/private, or keep blocked.",
      continueCondition: "Every blocked row has a teacher route decision or an explicit missing-evidence note.",
      stopCondition: "Any batch silently drops a software row or mutates observer queue without a separate teacher-approved tool."
    },
    {
      id: "rerun_existing_validators",
      action: "After teacher receipts are filled, rerun the existing waiting-row receipt validators and the low-token coverage completion gate.",
      continueCondition: "Completion gate reaches coverage_evidence_ready_for_final_teacher_review_not_completion.",
      stopCondition: "Any validator tries to claim original goal completion before operational evidence, teacher acceptance, and other final lanes are ready."
    }
  ],
  sourceEvidence: {
    finalCompletionGate: existsSync(finalGatePath) ? finalGatePath : "",
    coverageFinalReviewBridge: existsSync(coverageBridgePath) ? coverageBridgePath : "",
    readyRowTeacherBatch: existsSync(readyBatchPath) ? readyBatchPath : "",
    readyRowReceiptTemplate: readyBatch?.paths?.receiptTemplate || "",
    blockedRowRecoveryBatchIndex: existsSync(blockedIndexPath) ? blockedIndexPath : "",
    rollbackPoint: existsSync(rollbackPath) ? rollbackPath : ""
  },
  paths: {
    console: consolePath,
    html: htmlPath,
    readme: readmePath
  },
  locks: locks()
};

writeJson(consolePath, consoleArtifact);
writeHtml(htmlPath, consoleArtifact);
writeReadme(readmePath, consoleArtifact);

console.log(
  JSON.stringify(
    {
      ok: true,
      consolePath,
      htmlPath,
      readmePath,
      status: consoleArtifact.status,
      blockers: consoleArtifact.blockers,
      coverageTotals: consoleArtifact.coverageTotals
    },
    null,
    2
  )
);
