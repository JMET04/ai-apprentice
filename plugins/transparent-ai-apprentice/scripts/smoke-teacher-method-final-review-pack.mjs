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

function runNode(repoRoot, args, expectSuccess = true) {
  const result = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: "utf8" });
  if (expectSuccess && result.status !== 0) throw new Error(result.stderr || result.stdout || "command failed");
  if (!expectSuccess && result.status === 0) throw new Error("command should have failed");
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: result.stdout.trim() ? JSON.parse(result.stdout) : null
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const root = mkdtempSync(join(tmpdir(), "ta-teacher-method-final-review-pack-"));
const profilePath = join(root, "teacher-learning-method-profile.json");
const profileReadmePath = join(root, "TEACHER_METHOD_PROFILE_START_HERE.md");
const handoffPath = join(root, "current-goal-teacher-method-adaptation-handoff.json");
const integratedGatePath = join(root, "current-goal-integrated-evidence-gate.json");
const finalGatePath = join(root, "original-goal-final-completion-gate.json");
const modes = [
  "transparent_overlay_sketch",
  "software_log_deltas",
  "before_after_examples",
  "spatial_intent_review",
  "ordered_steps",
  "correction_first",
  "voice_explanation",
  "silent_workalong_until_trigger",
  "triggered_screenshot"
];

writeFileSync(profileReadmePath, "# Teacher Method Profile\n", "utf8");
writeJson(profilePath, {
  format: "transparent_ai_teacher_learning_method_profile_v1",
  preferredTeachingModes: modes.map((mode) => ({ mode, confidence: 0.9, recommendedTool: `tool_for_${mode}` })),
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});
writeJson(handoffPath, {
  format: "transparent_ai_current_goal_teacher_method_adaptation_handoff_v1",
  status: "waiting_for_teacher_method_review_before_contract_or_medium_runtime_reuse",
  paths: {
    teacherLearningMethodProfile: profilePath,
    teacherLearningMethodReadme: profileReadmePath
  },
  nextCommands: [
    {
      id: "create_teacher_method_execution_learning_contract_after_review",
      purpose: "After teacher review.",
      command:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-teacher-method-execution-learning-contract.mjs --profile "<profile>" --rollback-point "<retained-rollback-point>" --teacher-reviewed-method --output-dir artifacts\\current-goal-teacher-method-execution-learning-contracts'
    },
    {
      id: "prove_teacher_method_reuse_result_after_later_run",
      purpose: "After later reuse run.",
      command:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-teacher-method-reuse-result-proof-builder.mjs --contract-receipt-validation "<validation>" --contract "<contract>" --output-dir artifacts\\current-goal-teacher-method-reuse-result-proof-builders'
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    mediumRuntimeReuseEnabled: false,
    goalComplete: false
  }
});
writeJson(integratedGatePath, {
  format: "transparent_ai_current_goal_integrated_evidence_gate_v1",
  status: "current_goal_not_complete_waiting_for_teacher_evidence_and_real_software_run",
  requirements: [
    {
      id: "teacher_method_adaptation",
      status: "partial_review_ready",
      evidenceSummary: {
        supportedMethodLaneCount: 9,
        inferredTeacherModes: modes
      },
      nextActionCommand:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-teacher-method-execution-learning-contract.mjs --profile "<profile>" --rollback-point "<retained-rollback-point>" --teacher-reviewed-method --output-dir artifacts\\current-goal-teacher-method-execution-learning-contracts',
      implementationEvidenceProven: true,
      completionProven: false
    },
    {
      id: "high_to_medium_reasoning_cost_control",
      status: "policy_review_ready",
      evidenceSummary: {
        mediumRuntimeReuseEnabled: false,
        downgradeAllowedOnlyAfter:
          "teacher-reviewed method contract, low-token evidence gate, spatial logic contract, retained rollback, and dry-run validation all pass"
      },
      nextActionCommand:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-teacher-method-low-token-workflow-gate-package.mjs --contract "<teacher-method-contract>" --output-dir artifacts\\current-goal-teacher-method-low-token-workflow-gates',
      implementationEvidenceProven: true,
      completionProven: false
    }
  ]
});
writeJson(finalGatePath, {
  format: "transparent_ai_original_goal_final_completion_gate_v1",
  status: "blocked_before_original_goal_completion_claim",
  lanes: [
    {
      id: "teacher_method_adaptation_reuse_result_proof",
      status: "blocked_before_goal_completion_claim",
      ready: false,
      evidence:
        "contractStatus=missing; reuseStatus=missing; integratedMethodStatus=partial_review_ready; supportedMethodLaneCount=9; integratedReasoningStatus=policy_review_ready; integratedMediumRuntimeReuseEnabled=false"
    }
  ]
});

const result = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-teacher-method-final-review-pack.mjs"),
  "--handoff",
  handoffPath,
  "--integrated-evidence-gate",
  integratedGatePath,
  "--final-completion-gate",
  finalGatePath,
  "--output-dir",
  join(root, "review-pack")
]).json;
const pack = readJson(result.packPath);
const receipt = readJson(result.receiptTemplatePath);

assert(pack.format === "transparent_ai_teacher_method_final_review_pack_v1", "bad pack format");
assert(pack.status === "waiting_for_teacher_review_before_contract_or_medium_runtime_reuse", "pack should wait for review");
assert(pack.teacherMethodModes.length === 9, "expected nine teacher method modes");
assert(pack.sourceEvidence.integratedSupportedMethodLaneCount === 9, "integrated lane count missing");
assert(pack.sourceEvidence.integratedMediumRuntimeReuseEnabled === false, "medium runtime reuse must stay locked");
assert(receipt.format === "transparent_ai_teacher_method_final_review_receipt_template_v1", "bad receipt format");
assert(receipt.teacherDecision === "needs_teacher_review", "default teacher decision must wait");
assert(receipt.forbiddenTeacherDecisions.includes("accepted"), "accepted must be forbidden");
assert(receipt.forbiddenTeacherDecisions.includes("medium_runtime_reuse_approved"), "medium runtime approval must be forbidden");
assert(pack.locks.packDoesNotRunCommands === true, "pack command lock missing");
assert(pack.locks.packDoesNotCreateTeacherReviewedContract === true, "contract creation lock missing");
assert(pack.locks.mediumRuntimeReuseEnabled === false, "medium runtime reuse lock missing");
assert(pack.completionBoundary.finalGoalCompletionAllowed === false, "completion must remain blocked");

const postReviewCommand = pack.nextReviewCommands.find((command) => command.id === "post_teacher_review_create_method_contract");
assert(postReviewCommand.requiresRealTeacherReview === true, "post-review command must require teacher review");
assert(postReviewCommand.command.includes("--teacher-reviewed-method"), "post-review command should carry the explicit teacher-review flag");
const unsafeCommands = pack.nextReviewCommands.filter(
  (command) => command.id !== "post_teacher_review_create_method_contract" && command.command.includes("--teacher-reviewed-method")
);
assert(unsafeCommands.length === 0, "--teacher-reviewed-method must not appear outside the post-review command");

const blockedIntegratedGatePath = join(root, "blocked-integrated-gate.json");
writeJson(blockedIntegratedGatePath, {
  ...readJson(integratedGatePath),
  requirements: [
    {
      id: "teacher_method_adaptation",
      status: "missing",
      evidenceSummary: { supportedMethodLaneCount: 0 }
    },
    {
      id: "high_to_medium_reasoning_cost_control",
      status: "policy_review_ready",
      evidenceSummary: { mediumRuntimeReuseEnabled: false }
    }
  ]
});
const blockedResult = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-teacher-method-final-review-pack.mjs"),
  "--handoff",
  handoffPath,
  "--integrated-evidence-gate",
  blockedIntegratedGatePath,
  "--final-completion-gate",
  finalGatePath,
  "--output-dir",
  join(root, "blocked-review-pack")
]).json;
const blockedPack = readJson(blockedResult.packPath);
assert(blockedPack.status === "blocked_waiting_for_current_teacher_method_review_inputs", "blocked input should block pack");
assert(
  blockedPack.blockers.includes("integrated_teacher_method_requirement_not_partial_review_ready"),
  "missing integrated method blocker"
);
assert(blockedPack.locks.goalComplete === false, "blocked pack must not complete goal");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_teacher_method_final_review_pack_smoke_v1",
      pack: result.packPath,
      receiptTemplate: result.receiptTemplatePath,
      blockedPack: blockedResult.packPath,
      teacherMethodModeCount: pack.teacherMethodModes.length,
      postReviewFlagScoped: true,
      locks: pack.locks
    },
    null,
    2
  )
);
