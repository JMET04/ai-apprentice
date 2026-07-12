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
    "plugins/transparent-ai-apprentice/scripts/create-current-goal-low-token-ready-row-teacher-batch.mjs",
    "--goal",
    "Smoke first ready low-token row teacher batch.",
    "--batch-size",
    "10"
  ],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  fail("ready-row teacher batch generator failed");
}

const parsed = JSON.parse(result.stdout);
if (!existsSync(parsed.batchPath)) fail("batch json was not created");
if (!existsSync(parsed.receiptTemplatePath)) fail("receipt template was not created");
if (!existsSync(parsed.htmlPath)) fail("html was not created");
if (!existsSync(parsed.readmePath)) fail("readme was not created");

const batch = JSON.parse(readFileSync(parsed.batchPath, "utf8"));
const receipt = JSON.parse(readFileSync(parsed.receiptTemplatePath, "utf8"));
if (batch.format !== "transparent_ai_current_goal_low_token_ready_row_teacher_batch_v1") {
  fail("unexpected batch format");
}
if (receipt.format !== "transparent_ai_current_goal_low_token_ready_row_teacher_batch_receipt_v1") {
  fail("unexpected receipt format");
}
if (batch.locks.reviewOnly !== true) fail("batch must be review-only");
if (batch.locks.logContentsRead !== false) fail("batch must not read logs");
if (batch.locks.screenshotsCaptured !== false) fail("batch must not capture screenshots");
if (batch.locks.softwareActionsExecuted !== false) fail("batch must not execute software");
if (batch.locks.allSoftwareCoverageComplete !== false) fail("batch must not claim coverage completion");
if (batch.locks.goalComplete !== false) fail("batch must not claim goal completion");
if (batch.readyRows.length !== 10) fail(`expected 10 ready rows, got ${batch.readyRows.length}`);
if (receipt.rowDecisions.length !== batch.readyRows.length) fail("receipt row count mismatch");
if (receipt.rowDecisions.some((row) => row.teacherDecision !== "needs_teacher_review")) {
  fail("receipt defaults must require teacher review");
}
if (!batch.nextValidationCommand.includes("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs")) {
  fail("missing waiting-row receipt validation command");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      batchPath: parsed.batchPath,
      status: batch.status,
      readyRows: batch.readyRows.length,
      firstSoftware: batch.readyRows[0]?.software || "",
      goalComplete: batch.locks.goalComplete
    },
    null,
    2
  )
);
