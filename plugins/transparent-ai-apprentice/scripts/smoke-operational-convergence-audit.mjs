#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNode(repoRoot, args) {
  const result = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "command failed");
  return JSON.parse(result.stdout);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const root = mkdtempSync(join(tmpdir(), "ta-operational-convergence-"));
const finalReviewPackPath = join(root, "operational-final-review-pack.json");
const statusConsolePath = join(root, "all-software-operational-status-console.json");
const registrationStatusPath = join(root, "recurring-monitor-registration-status.json");
const runOutputAuditPath = join(root, "recurring-monitor-run-output-audit.json");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  runnerLaunched: false,
  logContentsRead: false,
  fullLogsRead: false,
  screenshotsCaptured: false,
  scheduledTaskInstalled: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  unattendedAllAppMonitoringComplete: false,
  goalComplete: false
};

writeJson(finalReviewPackPath, {
  format: "transparent_ai_operational_final_review_pack_v1",
  status: "waiting_for_teacher_operational_review_before_unattended_completion",
  operationalSummary: {
    reviewedRunCount: 1,
    compactLearningEvents: 8,
    teacherReviewItems: 1,
    replayItems: 1,
    remainingGapCount: 4,
    unattendedAllAppMonitoringComplete: false
  },
  remainingGaps: [{ kind: "approval_gate_not_ready" }, { kind: "registration_runner_not_ready" }],
  locks
});
writeJson(statusConsolePath, {
  format: "transparent_ai_all_software_operational_status_console_v1",
  status: "all_software_status_waiting_for_registration_or_manual_runner_evidence",
  lanes: Array.from({ length: 10 }, (_, i) => ({ id: `lane-${i + 1}` })),
  operationalProof: {
    taskRegistered: false,
    reviewedOutputReady: true,
    teacherReviewReady: true,
    replayReady: true,
    unattendedReady: false
  },
  locks
});
writeJson(registrationStatusPath, {
  format: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
  status: "verified_not_registered_yet",
  taskRegistered: false,
  scheduledTaskInstalled: false,
  locks
});
writeJson(runOutputAuditPath, {
  format: "transparent_ai_all_software_recurring_monitor_run_output_audit_v1",
  status: "learning_events_waiting_for_teacher_review",
  reviewedRunCount: 1,
  totals: { compactLearningEvents: 8 },
  locks
});

const result = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-operational-convergence-audit.mjs"),
  "--operational-final-review-pack",
  finalReviewPackPath,
  "--status-console",
  statusConsolePath,
  "--registration-status",
  registrationStatusPath,
  "--run-output-audit",
  runOutputAuditPath,
  "--output-dir",
  join(root, "audit")
]);
const audit = readJson(result.auditPath);
const receipt = readJson(result.receiptTemplatePath);
const auditDirName = basename(dirname(result.auditPath));

assert(audit.format === "transparent_ai_operational_convergence_audit_v1", "bad audit format");
assert(!/[.\s]$/.test(auditDirName), "audit directory must not end with a Windows-hostile dot or space");
assert(audit.status === "operational_convergence_ready_for_teacher_review_not_unattended_completion", "audit should be review-ready");
assert(audit.summary.totalChecks === 11, "check count changed unexpectedly");
assert(audit.summary.passedChecks === 11, "all checks should pass");
assert(audit.summary.unattendedReady === false, "unattended completion must remain false");
assert(audit.operational.statusLaneCount === 10, "status lanes missing");
assert(audit.operational.reviewedRunCount === 1, "reviewed run missing");
assert(audit.operational.compactLearningEvents === 8, "compact events missing");
assert(audit.operational.taskRegistered === false, "task must not be registered by audit");
assert(audit.locks.auditDoesNotRegisterTask === true, "registration lock missing");
assert(audit.locks.goalComplete === false, "goal completion lock missing");
assert(receipt.teacherDecision === "needs_teacher_review", "receipt default must wait");
assert(receipt.forbiddenTeacherDecisions.includes("register_task_now"), "register forbidden missing");
assert(receipt.forbiddenTeacherDecisions.includes("claim_complete"), "claim complete forbidden missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_operational_convergence_audit_smoke_v1",
      audit: result.auditPath,
      receiptTemplate: result.receiptTemplatePath,
      summary: audit.summary,
      operational: audit.operational,
      locks: audit.locks
    },
    null,
    2
  )
);
