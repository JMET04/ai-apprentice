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
const root = mkdtempSync(join(tmpdir(), "ta-teacher-method-convergence-"));
const finalReviewPackPath = join(root, "teacher-method-final-review-pack.json");
const handoffPath = join(root, "current-goal-teacher-method-adaptation-handoff.json");
const contractReceiptValidationPath = join(root, "teacher-method-execution-learning-contract-receipt-validation.json");
const reuseProofBuilderPath = join(root, "teacher-method-reuse-result-proof-builder.json");
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
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  mediumRuntimeReuseEnabled: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  goalComplete: false
};
const lanes = modes.map((mode) => ({
  id: mode,
  route: `route_${mode}`,
  lowTokenEvidence: `evidence_${mode}`,
  inferredInCurrentProfile: true,
  currentProfileRouteSuggested: true
}));

writeJson(finalReviewPackPath, {
  format: "transparent_ai_teacher_method_final_review_pack_v1",
  status: "waiting_for_teacher_review_before_contract_or_medium_runtime_reuse",
  teacherMethodModes: modes,
  locks
});
writeJson(handoffPath, {
  format: "transparent_ai_current_goal_teacher_method_adaptation_handoff_v1",
  status: "waiting_for_teacher_method_review_before_contract_or_medium_runtime_reuse",
  inferredTeacherModes: modes,
  supportedMethodLanes: lanes,
  reasoningTierPolicy: {
    highReasoningUseCases: [
      "extract reusable logic from teacher corrections",
      "repair any failed medium-runtime reuse",
      "decide whether missing evidence blocks execution"
    ],
    mediumReasoningUseCases: ["apply an already teacher-reviewed workflow", "prepare deterministic evidence requests"],
    downgradeAllowedOnlyAfter: "teacher-reviewed method contract, low-token evidence gate, spatial logic contract, retained rollback, and dry-run validation all pass",
    escalationBackToHighReasoningWhen: "teacher correction, missing logic source, ambiguous overlay/spatial intent, failed validator, or unexpected software evidence appears"
  },
  locks,
  goalComplete: false
});
writeJson(contractReceiptValidationPath, {
  format: "transparent_ai_teacher_method_execution_learning_contract_receipt_validation_v1",
  status: "teacher_method_contract_receipt_needs_teacher_review",
  readyForReuseResultProof: false,
  locks
});
writeJson(reuseProofBuilderPath, {
  format: "transparent_ai_teacher_method_reuse_result_proof_builder_v1",
  status: "waiting_for_confirmed_teacher_method_contract_receipt_validation",
  readyForTeacherReuseResultReceipt: false,
  locks
});

const result = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-teacher-method-convergence-audit.mjs"),
  "--final-review-pack",
  finalReviewPackPath,
  "--teacher-method-handoff",
  handoffPath,
  "--contract-receipt-validation",
  contractReceiptValidationPath,
  "--reuse-proof-builder",
  reuseProofBuilderPath,
  "--output-dir",
  join(root, "audit")
]);
const audit = readJson(result.auditPath);
const receipt = readJson(result.receiptTemplatePath);
const auditDirName = basename(dirname(result.auditPath));

assert(audit.format === "transparent_ai_teacher_method_convergence_audit_v1", "bad audit format");
assert(!/[.\s]$/.test(auditDirName), "audit directory must not end with a Windows-hostile dot or space");
assert(audit.status === "teacher_method_convergence_ready_for_teacher_review_not_medium_runtime_reuse", "audit should be review-ready");
assert(audit.summary.totalChecks === 10, "check count changed unexpectedly");
assert(audit.summary.passedChecks === 10, "all checks should pass");
assert(audit.summary.methodModeCount === 9, "method mode count missing");
assert(audit.summary.supportedMethodLaneCount === 9, "supported method lane count missing");
assert(audit.summary.reuseProofCompleted === false, "reuse proof should not be completed");
assert(audit.summary.finalGoalCompletionAllowed === false, "completion must remain false");
assert(audit.reasoningTierPolicy.mediumRuntimeReuseEnabled === false, "medium runtime must remain locked");
assert(audit.locks.highReasoningRepairRequiredOnFailure === true, "high reasoning repair lock missing");
assert(audit.locks.goalComplete === false, "goal completion lock missing");
assert(receipt.teacherDecision === "needs_teacher_review", "receipt default must wait");
assert(receipt.forbiddenTeacherDecisions.includes("enable_medium_runtime_reuse"), "medium reuse forbidden missing");
assert(receipt.forbiddenTeacherDecisions.includes("claim_complete"), "claim complete forbidden missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_teacher_method_convergence_audit_smoke_v1",
      audit: result.auditPath,
      receiptTemplate: result.receiptTemplatePath,
      summary: audit.summary,
      locks: audit.locks
    },
    null,
    2
  )
);
