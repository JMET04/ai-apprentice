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
    "plugins/transparent-ai-apprentice/scripts/create-current-goal-low-token-blocked-row-recovery-batch.mjs",
    "--goal",
    "Smoke blocked low-token row recovery batch.",
    "--batch-size",
    "25",
    "--skip-blocked-rows",
    "25"
  ],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  fail("blocked-row recovery batch generator failed");
}

const parsed = JSON.parse(result.stdout);
if (!existsSync(parsed.batchPath)) fail("batch json was not created");
if (!existsSync(parsed.receiptTemplatePath)) fail("receipt template was not created");
if (!existsSync(parsed.htmlPath)) fail("html was not created");
if (!existsSync(parsed.readmePath)) fail("readme was not created");

const batch = JSON.parse(readFileSync(parsed.batchPath, "utf8"));
const receipt = JSON.parse(readFileSync(parsed.receiptTemplatePath, "utf8"));
if (batch.format !== "transparent_ai_current_goal_low_token_blocked_row_recovery_batch_v1") {
  fail("unexpected batch format");
}
if (receipt.format !== "transparent_ai_current_goal_low_token_blocked_row_recovery_batch_receipt_v1") {
  fail("unexpected receipt format");
}
if (batch.locks.reviewOnly !== true) fail("batch must be review-only");
if (batch.locks.observerQueueMutated !== false) fail("batch must not mutate observer queue");
if (batch.locks.logContentsRead !== false) fail("batch must not read logs");
if (batch.locks.screenshotsCaptured !== false) fail("batch must not capture screenshots");
if (batch.locks.softwareActionsExecuted !== false) fail("batch must not execute software");
if (batch.locks.allSoftwareCoverageComplete !== false) fail("batch must not claim coverage completion");
if (batch.locks.goalComplete !== false) fail("batch must not claim goal completion");
if (batch.blockedRows.length !== 25) fail(`expected 25 blocked rows, got ${batch.blockedRows.length}`);
if (batch.skipBlockedRows !== 25) fail("expected smoke to cover second blocked-row page");
if (batch.blockedRows[0]?.ledgerNumber === 11) fail("pagination did not advance past the first blocked row");
if (batch.batchRange?.startIndexZeroBased !== 25) fail("batch range did not record the skip");
if (receipt.rowDecisions.length !== batch.blockedRows.length) fail("receipt row count mismatch");
if (receipt.rowDecisions.some((row) => row.teacherDecision !== "needs_teacher_review")) {
  fail("receipt defaults must require teacher review");
}
if (!batch.routeCounts.teacher_bind_observer_queue_or_exclude) {
  fail("expected queue-binding recovery route for blocked rows");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      batchPath: parsed.batchPath,
      status: batch.status,
      rows: batch.blockedRows.length,
      routeCounts: batch.routeCounts,
      firstSoftware: batch.blockedRows[0]?.software || ""
    },
    null,
    2
  )
);
