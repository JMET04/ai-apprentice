#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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

function slugify(value) {
  return (
    String(value || "low-token-blocked-row-recovery-batch-index")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 84) || "low-token-blocked-row-recovery-batch-index"
  );
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    indexDoesNotBindQueue: true,
    indexDoesNotRunObserver: true,
    indexDoesNotRunMetadataGate: true,
    indexDoesNotReadLogs: true,
    indexDoesNotCaptureScreenshots: true,
    indexDoesNotExecuteTargetSoftware: true,
    indexDoesNotWriteMemory: true,
    observerQueueMutated: false,
    logContentsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    memoryWritten: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

const repoRoot = process.cwd();
const goal = argValue("--goal", "Index current goal blocked low-token row recovery batches.");
const cockpitPath = resolve(
  argValue(
    "--waiting-row-cockpit",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-waiting-row-cockpits"), "original-goal-low-token-coverage-waiting-row-cockpit.json")
  )
);
const batchRoot = resolve(
  argValue("--batch-root", join(repoRoot, "artifacts", "current-goal-low-token-blocked-row-recovery-batches"))
);
const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-low-token-blocked-row-recovery-batch-indexes"))
);
mkdirSync(outputRoot, { recursive: true });

const cockpit = existsSync(cockpitPath) ? readJson(cockpitPath) : null;
const expectedBlockedRows = (Array.isArray(cockpit?.reviewRows) ? cockpit.reviewRows : []).filter(
  (row) => row?.reviewStatus === "blocked_needs_more_low_token_evidence"
).length;
const batchFiles = visitFiles(batchRoot, "current-goal-low-token-blocked-row-recovery-batch.json")
  .map((file) => {
    const json = readJson(file.path);
    return { ...file, json };
  })
  .filter((file) => file.json?.format === "transparent_ai_current_goal_low_token_blocked_row_recovery_batch_v1");

const latestBySkip = new Map();
for (const file of batchFiles) {
  const skip = Number(file.json.skipBlockedRows || 0);
  const previous = latestBySkip.get(skip);
  if (!previous || file.time > previous.time) latestBySkip.set(skip, file);
}

const batchRows = [...latestBySkip.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([skip, file]) => ({
    skipBlockedRows: skip,
    rows: Array.isArray(file.json.blockedRows) ? file.json.blockedRows.length : 0,
    startLedgerNumber: file.json.blockedRows?.[0]?.ledgerNumber || null,
    endLedgerNumber: file.json.blockedRows?.[file.json.blockedRows.length - 1]?.ledgerNumber || null,
    firstSoftware: file.json.blockedRows?.[0]?.software || "",
    lastSoftware: file.json.blockedRows?.[file.json.blockedRows.length - 1]?.software || "",
    routeCounts: file.json.routeCounts || {},
    path: file.path,
    reviewOnly: file.json.locks?.reviewOnly === true,
    queueMutated: file.json.locks?.observerQueueMutated === true,
    goalComplete: file.json.locks?.goalComplete === true
  }));

const totalRows = batchRows.reduce((sum, row) => sum + row.rows, 0);
const expectedSkips = [];
for (let skip = 0; skip < expectedBlockedRows; skip += 25) expectedSkips.push(skip);
const actualSkips = batchRows.map((row) => row.skipBlockedRows);
const missingSkips = expectedSkips.filter((skip) => !actualSkips.includes(skip));
const unsafeRows = batchRows.filter((row) => !row.reviewOnly || row.queueMutated || row.goalComplete);
const coverageCompleteForReview =
  expectedBlockedRows > 0 &&
  totalRows === expectedBlockedRows &&
  missingSkips.length === 0 &&
  unsafeRows.length === 0;

const indexId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const indexDir = join(outputRoot, indexId);
mkdirSync(indexDir, { recursive: true });
const indexPath = join(indexDir, "current-goal-low-token-blocked-row-recovery-batch-index.json");
const index = {
  ok: true,
  format: "transparent_ai_current_goal_low_token_blocked_row_recovery_batch_index_v1",
  indexId,
  createdAt: new Date().toISOString(),
  goal,
  status: coverageCompleteForReview
    ? "low_token_blocked_row_recovery_batches_cover_all_blocked_rows_for_teacher_review"
    : "low_token_blocked_row_recovery_batches_incomplete",
  expectedBlockedRows,
  totalRowsInLatestBatches: totalRows,
  expectedSkips,
  actualSkips,
  missingSkips,
  unsafeBatchCount: unsafeRows.length,
  coverageCompleteForReview,
  sourceEvidence: {
    waitingRowCockpit: existsSync(cockpitPath) ? cockpitPath : "",
    batchRoot
  },
  batchRows,
  locks: locks(),
  paths: {
    index: indexPath
  }
};
writeJson(indexPath, index);

console.log(
  JSON.stringify(
    {
      ok: true,
      indexPath,
      status: index.status,
      expectedBlockedRows,
      totalRowsInLatestBatches: totalRows,
      expectedSkips,
      actualSkips,
      missingSkips,
      coverageCompleteForReview
    },
    null,
    2
  )
);
