#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
const root = mkdtempSync(join(tmpdir(), "ta-operational-final-review-pack-"));
const statusConsolePath = join(root, "all-software-operational-status-console.json");
const unattendedAuditPath = join(root, "all-software-unattended-learning-audit.json");
const finalGatePath = join(root, "original-goal-final-completion-gate.json");

writeJson(statusConsolePath, {
  format: "transparent_ai_all_software_operational_status_console_v1",
  status: "all_software_status_waiting_for_registration_or_manual_runner_evidence",
  lanes: [
    {
      id: "operational_learning",
      status: "not_operationally_proven",
      detail: "registered recurring monitor evidence is missing"
    },
    {
      id: "low_token_output_review",
      status: "reviewed_output_present",
      detail: "reviewedRuns=1; compactLearningEvents=8"
    },
    {
      id: "automatic_learning_activation_path",
      status: "activation_receipt_validation_waiting_for_teacher_confirmations",
      detail: "validationDecision=needs_teacher_review; missing=6"
    },
    {
      id: "non_expert_engineering_voice_control",
      status: "voice_text_numbered_control_ready_for_teacher_review",
      detail: "voice/text workbench exists and keeps software execution locked"
    }
  ],
  nextSafeActions: [],
  blockedClaims: ["claim_goal_complete", "register_or_start_recurring_monitor_from_status_console"],
  completionBoundary: {
    goalComplete: false,
    allSoftwareCoverageComplete: false,
    nativeUniversalExecutionComplete: false
  },
  locks: {
    reviewOnly: true,
    registerTaskCalled: false,
    logContentsRead: false,
    softwareActionsExecuted: false,
    longTermMemoryWritten: false,
    goalComplete: false
  }
});
writeJson(unattendedAuditPath, {
  format: "transparent_ai_all_software_unattended_learning_audit_v1",
  status: "unattended_learning_not_ready_remaining_gaps",
  unattendedAllAppMonitoringComplete: false,
  evidenceCounts: {
    reviewedRunCount: 1,
    compactLearningEvents: 8,
    teacherReviewItems: 1,
    replayItems: 1,
    readyForFollowUpItems: 0
  },
  remainingGaps: [
    {
      kind: "approval_gate_not_ready",
      detail: "Approval gate still blocks registration."
    },
    {
      kind: "scheduled_task_not_registered_or_not_matching",
      detail: "Registration status is verified_not_registered_yet."
    }
  ],
  locks: {
    auditDoesNotChangeSystem: true,
    scheduledTaskRegistered: false,
    logContentsRead: false,
    softwareActionsExecuted: false,
    unattendedAllAppMonitoringComplete: false
  }
});
writeJson(finalGatePath, {
  format: "transparent_ai_original_goal_final_completion_gate_v1",
  lanes: [
    {
      id: "unattended_all_software_operational_evidence",
      status: "blocked_before_goal_completion_claim",
      ready: false,
      evidence: "status=unattended_learning_not_ready_remaining_gaps; gaps=2"
    }
  ]
});

const result = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-operational-final-review-pack.mjs"),
  "--status-console",
  statusConsolePath,
  "--unattended-audit",
  unattendedAuditPath,
  "--final-completion-gate",
  finalGatePath,
  "--output-dir",
  join(root, "review-pack")
]);
const pack = readJson(result.packPath);
const receipt = readJson(result.receiptTemplatePath);

assert(pack.format === "transparent_ai_operational_final_review_pack_v1", "bad pack format");
assert(pack.status === "waiting_for_teacher_operational_review_before_unattended_completion", "pack should wait for review");
assert(pack.operationalSummary.reviewedRunCount === 1, "reviewed run count missing");
assert(pack.operationalSummary.compactLearningEvents === 8, "compact event count missing");
assert(pack.operationalSummary.remainingGapCount === 2, "gap count missing");
assert(pack.completionBoundary.unattendedAllAppMonitoringComplete === false, "unattended completion must stay false");
assert(pack.completionBoundary.finalGoalCompletionAllowed === false, "final completion must stay false");
assert(pack.locks.packDoesNotRegisterTask === true, "registration lock missing");
assert(pack.locks.packDoesNotReadLogs === true, "log read lock missing");
assert(pack.locks.packDoesNotExecuteTargetSoftware === true, "execution lock missing");
assert(pack.locks.packDoesNotWriteMemory === true, "memory lock missing");
assert(receipt.teacherDecision === "needs_teacher_review", "receipt must wait for teacher");
assert(receipt.forbiddenTeacherDecisions.includes("register_now"), "registration must be forbidden");
assert(receipt.forbiddenTeacherDecisions.includes("claim_complete"), "claim complete must be forbidden");

const unsafeConsolePath = join(root, "unsafe-status-console.json");
writeJson(unsafeConsolePath, {
  ...readJson(statusConsolePath),
  locks: {
    reviewOnly: true,
    registerTaskCalled: true,
    logContentsRead: false
  }
});
const blockedResult = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-operational-final-review-pack.mjs"),
  "--status-console",
  unsafeConsolePath,
  "--unattended-audit",
  unattendedAuditPath,
  "--final-completion-gate",
  finalGatePath,
  "--output-dir",
  join(root, "blocked-review-pack")
]);
const blockedPack = readJson(blockedResult.packPath);
assert(blockedPack.status === "blocked_waiting_for_valid_operational_review_inputs", "unsafe console should block");
assert(blockedPack.blockers.includes("status_console_register_task_lock_missing"), "missing register lock blocker");
assert(blockedPack.locks.goalComplete === false, "blocked pack must not complete goal");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_operational_final_review_pack_smoke_v1",
      pack: result.packPath,
      receiptTemplate: result.receiptTemplatePath,
      blockedPack: blockedResult.packPath,
      operationalSummary: pack.operationalSummary,
      locks: pack.locks
    },
    null,
    2
  )
);
