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
    "plugins/transparent-ai-apprentice/scripts/create-current-goal-low-token-coverage-teacher-console.mjs",
    "--goal",
    "Smoke all-software low-token coverage teacher console."
  ],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  fail("teacher console generator failed");
}

const parsed = JSON.parse(result.stdout);
if (!existsSync(parsed.consolePath)) fail("console json was not created");
if (!existsSync(parsed.htmlPath)) fail("console html was not created");
if (!existsSync(parsed.readmePath)) fail("console readme was not created");

const consoleArtifact = JSON.parse(readFileSync(parsed.consolePath, "utf8"));
if (consoleArtifact.format !== "transparent_ai_current_goal_low_token_coverage_teacher_console_v1") {
  fail("unexpected console format");
}
if (consoleArtifact.status !== "low_token_coverage_teacher_console_ready_for_teacher_receipts_not_completion") {
  fail(`unexpected console status: ${consoleArtifact.status}`);
}
if (consoleArtifact.coverageTotals.readyRowsWaitingForReceipt !== 10) fail("ready row count mismatch");
if (consoleArtifact.coverageTotals.blockedRowsCoveredByRecoveryBatches !== 178) fail("blocked row coverage mismatch");
if (consoleArtifact.coverageTotals.combinedRowsRoutedForTeacherReview !== 188) fail("combined routed rows mismatch");
if (consoleArtifact.coverageTotals.completionClaimAllowed !== false) fail("console must not allow completion claim");
if (consoleArtifact.locks.reviewOnly !== true) fail("console must be review-only");
if (consoleArtifact.locks.consoleDoesNotFillReceipts !== true) fail("console must not fill receipts");
if (consoleArtifact.locks.observerQueueMutated !== false) fail("console must not mutate observer queue");
if (consoleArtifact.locks.logContentsRead !== false) fail("console must not read logs");
if (consoleArtifact.locks.screenshotsCaptured !== false) fail("console must not capture screenshots");
if (consoleArtifact.locks.softwareActionsExecuted !== false) fail("console must not execute software");
if (consoleArtifact.locks.goalComplete !== false) fail("console must not claim goal completion");

console.log(
  JSON.stringify(
    {
      ok: true,
      consolePath: parsed.consolePath,
      status: consoleArtifact.status,
      coverageTotals: consoleArtifact.coverageTotals
    },
    null,
    2
  )
);
