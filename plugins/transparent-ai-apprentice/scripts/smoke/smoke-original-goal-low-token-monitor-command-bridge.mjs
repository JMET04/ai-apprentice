#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "low-token-monitor-command-bridge", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const auditResult = runNodeScript("create-original-goal-objective-fulfillment-audit.mjs", [
  "--output-dir",
  join(smokeRoot, "audit")
]);
const queueResult = runNodeScript("create-original-goal-objective-fulfillment-next-step-queue.mjs", [
  "--audit",
  auditResult.auditPath,
  "--output-dir",
  join(smokeRoot, "queue")
]);
const bridgeResult = runNodeScript("create-original-goal-low-token-monitor-command-bridge.mjs", [
  "--queue",
  queueResult.queuePath,
  "--output-dir",
  join(smokeRoot, "bridge")
]);
const bridge = readJson(bridgeResult.bridgePath);

const routeIds = bridge.recommendedRouteOrder.map((route) => route.routeId);
const coverageRoute = bridge.recommendedRouteOrder.find((route) => route.routeId === "existing_low_token_coverage_review");
const teacherConfirmationRoute = bridge.recommendedRouteOrder.find(
  (route) => route.routeId === "existing_recurring_monitor_teacher_confirmation"
);
const checks = [
  {
    name: "Low-token monitor command bridge maps all-software learning to existing monitor gates",
    pass:
      bridge.format === "transparent_ai_original_goal_low_token_monitor_command_bridge_v1" &&
      bridge.lowTokenObjective.requirementId === "all_software_low_token_learning" &&
      routeIds.includes("existing_low_token_coverage_review") &&
      routeIds.includes("existing_recurring_monitor_teacher_confirmation") &&
      routeIds.includes("existing_recurring_monitor_registration_runner_template") &&
      routeIds.includes("existing_recurring_monitor_status_verifier") &&
      routeIds.includes("existing_recurring_monitor_run_output_audit"),
    evidence: routeIds
  },
  {
    name: "Low-token monitor command bridge is evidence-aware about existing coverage artifacts",
    pass:
      bridge.evidenceContext?.sourceRefreshPath &&
      bridge.evidenceContext?.allRowsHaveReviewableSourceRoute === true &&
      bridge.evidenceContext?.logSourceMissingRows === 0 &&
      bridge.evidenceContext?.coverageArtifactsReady === true &&
      bridge.evidenceContext?.readinessPackageReady === true &&
      bridge.recommendedTeacherRouteId === "existing_low_token_coverage_review" &&
      coverageRoute?.routeStatus === "ready_for_teacher_coverage_review_receipt" &&
      coverageRoute?.evidenceAlreadyAvailable?.coverageEvidenceDossierPath &&
      coverageRoute?.evidenceAlreadyAvailable?.waitingRowCockpitPath &&
      !coverageRoute.missingBeforeUse.includes("current coverage dossier or cockpit evidence") &&
      teacherConfirmationRoute?.routeStatus === "ready_after_teacher_coverage_review_and_retained_rollback" &&
      teacherConfirmationRoute?.evidenceAlreadyAvailable?.readinessPackagePath &&
      !teacherConfirmationRoute.missingBeforeUse.includes("readiness package"),
    evidence: {
      evidenceContext: bridge.evidenceContext,
      coverageRoute,
      teacherConfirmationRoute,
      nextEvidenceAwareAction: bridge.nextEvidenceAwareAction
    }
  },
  {
    name: "Low-token monitor command bridge preserves coverage, teacher confirmation, rollback, status, and run-output evidence",
    pass:
      bridge.missingBeforeCompletion.includes("full reviewed software coverage or explicit teacher exclusions") &&
      bridge.missingBeforeCompletion.includes("teacher confirmation receipt for recurring monitor registration") &&
      bridge.missingBeforeCompletion.includes("retained rollback point for monitor registration and later runner use") &&
      bridge.missingBeforeCompletion.includes("read-only registration status verification") &&
      bridge.missingBeforeCompletion.includes("recurring monitor run-output audit"),
    evidence: bridge.missingBeforeCompletion
  },
  {
    name: "Low-token monitor command bridge is no-op and cannot register, read logs, screenshot, or write memory",
    pass:
      bridge.completionAllowed === false &&
      bridge.locks.bridgeDoesNotRunCommands === true &&
      bridge.locks.bridgeDoesNotRegisterTask === true &&
      bridge.locks.bridgeDoesNotReadLogs === true &&
      bridge.locks.bridgeDoesNotReadFullLogs === true &&
      bridge.locks.bridgeDoesNotCaptureScreenshots === true &&
      bridge.locks.bridgeDoesNotWriteMemory === true &&
      bridge.locks.goalComplete === false &&
      bridge.blockedActions.includes("register_task_from_low_token_bridge") &&
      bridge.blockedActions.includes("read_full_logs_from_low_token_bridge"),
    evidence: bridge.locks
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_low_token_monitor_command_bridge_smoke_v1",
      smokeRoot,
      bridgePath: bridgeResult.bridgePath,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
