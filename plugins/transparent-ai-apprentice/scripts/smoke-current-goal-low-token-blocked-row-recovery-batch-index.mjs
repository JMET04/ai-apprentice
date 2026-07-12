#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    "plugins/transparent-ai-apprentice/scripts/create-current-goal-low-token-blocked-row-recovery-batch-index.mjs",
    "--goal",
    "Smoke blocked low-token row recovery batch index."
  ],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  fail("batch index generator failed");
}

const parsed = JSON.parse(result.stdout);
if (!existsSync(parsed.indexPath)) fail("index json was not created");
const index = JSON.parse(readFileSync(parsed.indexPath, "utf8"));
if (index.format !== "transparent_ai_current_goal_low_token_blocked_row_recovery_batch_index_v1") {
  fail("unexpected index format");
}
if (index.expectedBlockedRows !== 178) fail(`expected 178 blocked rows, got ${index.expectedBlockedRows}`);
if (index.totalRowsInLatestBatches !== 178) fail(`expected indexed rows to total 178, got ${index.totalRowsInLatestBatches}`);
if (index.missingSkips.length !== 0) fail("missing one or more expected batch skips");
if (index.coverageCompleteForReview !== true) fail("batch index does not cover all blocked rows for review");
if (index.locks.reviewOnly !== true) fail("index must be review-only");
if (index.locks.observerQueueMutated !== false) fail("index must not mutate queue");
if (index.locks.goalComplete !== false) fail("index must not claim goal completion");

console.log(
  JSON.stringify(
    {
      ok: true,
      indexPath: parsed.indexPath,
      status: index.status,
      expectedBlockedRows: index.expectedBlockedRows,
      totalRowsInLatestBatches: index.totalRowsInLatestBatches,
      actualSkips: index.actualSkips
    },
    null,
    2
  )
);
