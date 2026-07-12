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
    "plugins/transparent-ai-apprentice/scripts/create-current-goal-low-token-coverage-final-review-bridge.mjs",
    "--goal",
    "Smoke current low-token coverage final review bridge."
  ],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  fail("bridge generator failed");
}

const parsed = JSON.parse(result.stdout);
if (!existsSync(parsed.bridgePath)) fail("bridge json was not created");
if (!existsSync(parsed.htmlPath)) fail("bridge html was not created");
if (!existsSync(parsed.readmePath)) fail("bridge readme was not created");

const bridge = JSON.parse(readFileSync(parsed.bridgePath, "utf8"));
if (bridge.format !== "transparent_ai_current_goal_low_token_coverage_final_review_bridge_v1") {
  fail("unexpected bridge format");
}
if (bridge.locks.reviewOnly !== true) fail("bridge must remain review-only");
if (bridge.locks.ruleEnabled !== false) fail("bridge must not enable rules");
if (bridge.locks.allSoftwareCoverageComplete !== false) fail("bridge must not claim coverage completion");
if (bridge.locks.goalComplete !== false) fail("bridge must not claim goal completion");
if (bridge.locks.logContentsRead !== false) fail("bridge must not read logs");
if (bridge.locks.screenshotsCaptured !== false) fail("bridge must not capture screenshots");
if (bridge.finalLane.id !== "all_software_low_token_coverage_final_review") {
  fail("bridge is not bound to low-token final lane");
}
if (bridge.coverageCounts.logSourceDiscoveryRows <= 0) fail("log-source discovery rows are missing");
if (bridge.coverageCounts.ledgerRows <= 0) fail("coverage ledger rows are missing");
if (bridge.coverageCounts.logSourceDiscoveryReadyForCoverage !== true) fail("log-source discovery is not ready for coverage");
if (!bridge.sourceEvidence.waitingRowCockpit) fail("waiting-row cockpit source missing");
if (!bridge.sourceEvidence.rollbackPoint) fail("rollback point source missing");
if (!bridge.nextCommands.validateCompletionGateAfterReceipt.includes("validate-original-goal-low-token-coverage-completion-gate.mjs")) {
  fail("missing completion-gate validation command");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      bridgePath: parsed.bridgePath,
      status: bridge.status,
      blockers: bridge.blockers.length,
      ledgerRows: bridge.coverageCounts.ledgerRows,
      readyRows: bridge.cockpitSummary.readyForTeacherConfirmedMetadataGateRows,
      blockedRows: bridge.cockpitSummary.blockedRows
    },
    null,
    2
  )
);
