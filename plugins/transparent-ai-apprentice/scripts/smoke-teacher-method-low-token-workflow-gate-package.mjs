#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`command failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-teacher-method-gate-"));
const profilePath = join(root, "old-teacher-profile.json");
const currentProfilePath = join(root, "current-teacher-profile.json");
const contractPath = join(root, "teacher-method-contract.json");
const requestPackPath = join(root, "compact-request-pack.json");
const ragQueuePath = join(root, "rag-intake.json");
const runtimeGatePath = join(root, "tlcl-runtime-gate.json");
const refreshPath = join(root, "original-goal-current-status-refresh.json");
const outDir = join(root, "out");

writeJson(profilePath, {
  format: "transparent_ai_teacher_learning_method_profile_v1",
  goal: "用语音教助手处理退款工单",
  preferredTeachingModes: [{ mode: "ordered_steps" }],
  lowTokenRoute: { strategy: "teacher_method_first_then_cheapest_evidence" },
  locks: { reviewOnly: true }
});

writeJson(currentProfilePath, {
  format: "transparent_ai_teacher_learning_method_profile_v1",
  goal:
    "All software can learn from low-token log metadata, adapt to teacher methods, use transparent sketch overlays, understand 2D perspective 3D depth demonstrations, and execute only after confirmation.",
  preferredTeachingModes: [{ mode: "transparent_overlay_sketch" }, { mode: "software_log_deltas" }],
  lowTokenRoute: { strategy: "teacher_method_first_then_cheapest_evidence" },
  locks: { reviewOnly: true, fullContinuousRecording: false, nativeUniversalExecution: false }
});

writeJson(contractPath, {
  format: "transparent_ai_teacher_method_execution_learning_contract_v1",
  status: "ready_for_teacher_method_execution_learning_contract_review",
  goal:
    "All software can learn from low-token log metadata, adapt to teacher methods, use transparent sketch overlays, understand 2D perspective 3D depth demonstrations, and execute only after confirmation.",
  teacherReviewedMethod: true,
  coverage: {
    everyTeacherModeHasRoute: true,
    lowTokenMetadataFirst: true,
    transparentOverlaySpatialIntent: true,
    highToMediumModelTierPolicy: true
  },
  modelTierPolicy: {
    highReasoningUseCases: ["extract reusable logic from teacher correction"],
    mediumReasoningUseCases: ["run already reviewed deterministic workflow"],
    downgradeCondition: "Only after teacher-reviewed contract, active rule package, rollback point, and execution adapter dry-run are all present.",
    escalationCondition: "Any teacher correction returns to high reasoning before execution."
  },
  locks: { reviewOnly: true, goalComplete: false }
});

writeJson(requestPackPath, {
  format: "transparent_ai_original_goal_low_token_compact_evidence_request_pack_v1",
  status: "waiting_for_teacher_compact_evidence_request_review",
  locks: { requestDoesNotRunWatchCycle: true, goalComplete: false }
});

writeJson(ragQueuePath, {
  format: "transparent_ai_rag_research_intake_queue_v1",
  status: "waiting_for_teacher_rag_source_review",
  locks: { reviewOnly: true, goalComplete: false }
});

writeJson(runtimeGatePath, {
  format: "transparent_ai_tlcl_runtime_gate_v1",
  decision: "medium_runtime_allowed",
  runtimePermission: {
    canPrepareReviewedDryRun: true,
    canExecuteTargetSoftware: false,
    canEnableRules: false,
    canWriteMemory: false,
    canClaimCompletion: false
  },
  locks: { reviewOnly: true, noSoftwareExecution: true, noCompletionClaim: true }
});

writeJson(refreshPath, {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  paths: {
    teacherLearningMethodProfile: profilePath,
    teacherMethodExecutionLearningContract: contractPath,
    originalGoalLowTokenCompactEvidenceRequestPack: requestPackPath,
    ragResearchIntakeQueue: ragQueuePath
  }
});

const result = run([
  "plugins/transparent-ai-apprentice/scripts/create-teacher-method-low-token-workflow-gate-package.mjs",
  "--refresh",
  refreshPath,
  "--output-dir",
  outDir
]);
const packet = JSON.parse(readFileSync(result.packagePath, "utf8"));
const readyResult = run([
  "plugins/transparent-ai-apprentice/scripts/create-teacher-method-low-token-workflow-gate-package.mjs",
  "--refresh",
  refreshPath,
  "--profile",
  currentProfilePath,
  "--runtime-gate",
  runtimeGatePath,
  "--output-dir",
  join(root, "ready-out")
]);
const readyPacket = JSON.parse(readFileSync(readyResult.packagePath, "utf8"));
const checks = [
  {
    name: "Gate package combines teacher method, low-token, RAG, and runtime gates",
    pass:
      packet.format === "transparent_ai_teacher_method_low_token_workflow_gate_package_v1" &&
      packet.gates.length === 6 &&
      packet.gates.some((row) => row.id === "reasoning_tier_policy")
  },
  {
    name: "Old teacher profile blocks current all-software workflow reuse",
    pass:
      packet.status === "blocked_before_medium_runtime_reuse" &&
      packet.readyForMediumRuntimeReuse === false &&
      packet.firstBlocker.id === "teacher_method_profile" &&
      packet.firstBlocker.status === "profile_exists_but_goal_mismatch"
  },
  {
    name: "Model tier policy is recognized as ready without enabling runtime",
    pass:
      packet.gates.find((row) => row.id === "reasoning_tier_policy")?.ready === true &&
      packet.modelTierPolicySummary.ready === true
  },
  {
    name: "Current profile plus TLCL runtime gate opens only medium reviewed dry-run reuse",
    pass:
      readyPacket.status === "ready_for_medium_runtime_reuse_review" &&
      readyPacket.readyForMediumRuntimeReuse === true &&
      readyPacket.gates.every((row) => row.ready === true) &&
      readyPacket.locks.packageDoesNotExecuteSoftware === true &&
      readyPacket.locks.packageDoesNotEnableRules === true &&
      readyPacket.locks.goalComplete === false
  },
  {
    name: "All commands are templates only and locks remain closed",
    pass:
      packet.nextCommands.length === 3 &&
      packet.nextCommands.every((entry) => entry.allowedInThisPackage === false) &&
      packet.locks.packageDoesNotRunLowTokenCycle === true &&
      packet.locks.packageDoesNotExecuteSoftware === true &&
      packet.locks.goalComplete === false
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_teacher_method_low_token_workflow_gate_package_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        package: result.packagePath,
        readyPackage: readyResult.packagePath,
        readme: result.readmePath,
        html: result.htmlPath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
