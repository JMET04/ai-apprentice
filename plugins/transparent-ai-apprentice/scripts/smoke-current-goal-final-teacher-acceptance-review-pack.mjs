#!/usr/bin/env node
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function run(args, expectSuccess = true) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (expectSuccess && result.status !== 0) {
    throw new Error(`Command failed: ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  }
  if (!expectSuccess && result.status === 0) {
    throw new Error(`Command unexpectedly succeeded: ${args.join(" ")}\n${result.stdout}`);
  }
  return result;
}

const root = mkdtempSync(join(tmpdir(), "ta-final-teacher-acceptance-"));
const laneIds = [
  "completion_blocker_matrix_present",
  "all_software_low_token_coverage_final_review",
  "real_local_non_cad_solidworks_scope_evidence",
  "teacher_method_adaptation_reuse_result_proof",
  "unattended_all_software_operational_evidence",
  "transparent_2d_perspective_3d_sketch_implementation",
  "teacher_validated_spatial_intent_and_detail_logic",
  "voice_text_numbered_execution_capability_convergence",
  "rule_dsl_validation_report_delivery_gate_audit",
  "explicit_final_teacher_acceptance"
];
const gatePath = join(root, "current-goal-final-convergence-readiness-gate.json");
writeJson(gatePath, {
  ok: true,
  format: "transparent_ai_current_goal_final_convergence_readiness_gate_v1",
  status: "convergence_evidence_ready_for_final_teacher_review_not_completion",
  summary: {
    totalLanes: laneIds.length,
    reviewEvidenceReadyLanes: laneIds.length - 1,
    missingReviewEvidenceLanes: 1,
    completionReadyLanes: 0,
    finalTeacherAcceptanceReady: false,
    finalGoalCompletionAllowed: false
  },
  lanes: laneIds.map((laneId) => ({
    laneId,
    finalGateStatus: laneId === "explicit_final_teacher_acceptance" ? "blocked_before_goal_completion_claim" : "ready_for_final_teacher_acceptance_review",
    evidencePath: "",
    evidenceFormat: laneId === "explicit_final_teacher_acceptance" ? "" : "fixture_evidence_v1",
    evidenceStatus: laneId === "explicit_final_teacher_acceptance" ? "" : "ready_for_final_teacher_acceptance_review",
    evidenceExists: laneId !== "explicit_final_teacher_acceptance",
    reviewEvidenceReady: laneId !== "explicit_final_teacher_acceptance",
    completionReady: false,
    blocker:
      laneId === "explicit_final_teacher_acceptance"
        ? "Final teacher acceptance receipt is still missing."
        : "Evidence is ready for teacher review."
  })),
  locks: { goalComplete: false }
});

const packResult = JSON.parse(
  run([
    "plugins/transparent-ai-apprentice/scripts/create-current-goal-final-teacher-acceptance-review-pack.mjs",
    "--final-convergence-readiness-gate",
    gatePath,
    "--output-dir",
    join(root, "packs")
  ]).stdout
);
assert(packResult.readyForTeacherFinalAcceptanceReview === true, "pack should be ready for final teacher review");
const pack = readJson(packResult.packPath);
assert(pack.format === "transparent_ai_current_goal_final_teacher_acceptance_review_pack_v1", "pack format mismatch");
assert(pack.receiptTemplate.teacherDecision === "needs_teacher_review", "template must not accept by default");
assert(pack.locks.goalComplete === false, "pack must not claim completion");

const defaultValidation = JSON.parse(
  run([
    "plugins/transparent-ai-apprentice/scripts/validate-current-goal-final-teacher-acceptance-receipt.mjs",
    "--final-convergence-readiness-gate",
    gatePath,
    "--receipt",
    packResult.receiptTemplatePath,
    "--output-dir",
    join(root, "default-validation")
  ]).stdout
);
assert(defaultValidation.readyForFinalCompletionGate === false, "default receipt must not validate ready");
assert(defaultValidation.status === "blocked_before_final_completion_gate", "default validation should stay blocked");

const acceptedReceiptPath = join(root, "accepted-current-goal-final-teacher-receipt.json");
const acceptedReceipt = {
  ...pack.receiptTemplate,
  teacherDecision: "accept_full_original_goal_completion",
  teacherConfirmedFullOriginalScope: true,
  teacherReviewedEveryEvidenceLane: true,
  teacherAcceptsReviewOnlyBoundary: true,
  teacherAcceptsRemainingCompletionBoundary: true,
  forbiddenAutomationRequested: false,
  teacherSummaryNote: "Fixture teacher acceptance.",
  laneReviews: pack.receiptTemplate.laneReviews.map((row) => ({
    ...row,
    teacherReviewed: true,
    teacherDecision: "confirmed",
    teacherNote: "Fixture lane reviewed."
  }))
};
writeJson(acceptedReceiptPath, acceptedReceipt);
const acceptedValidation = JSON.parse(
  run([
    "plugins/transparent-ai-apprentice/scripts/validate-current-goal-final-teacher-acceptance-receipt.mjs",
    "--final-convergence-readiness-gate",
    gatePath,
    "--receipt",
    acceptedReceiptPath,
    "--output-dir",
    join(root, "accepted-validation")
  ]).stdout
);
assert(acceptedValidation.readyForFinalCompletionGate === true, "accepted receipt should validate ready");
const legacyValidation = readJson(acceptedValidation.legacyValidationPath);
assert(
  legacyValidation.format === "transparent_ai_original_goal_final_teacher_acceptance_receipt_validation_v1" &&
    legacyValidation.status === "validated_ready_for_final_completion_gate" &&
    legacyValidation.validationDecision === "teacher_acceptance_ready_for_final_completion_gate",
  "legacy validation must match final completion gate contract"
);

const forbiddenReceiptPath = join(root, "forbidden-current-goal-final-teacher-receipt.json");
writeJson(forbiddenReceiptPath, { ...acceptedReceipt, teacherDecision: "execute_now" });
run(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-current-goal-final-teacher-acceptance-receipt.mjs",
    "--final-convergence-readiness-gate",
    gatePath,
    "--receipt",
    forbiddenReceiptPath,
    "--output-dir",
    join(root, "forbidden-validation")
  ],
  false
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_final_teacher_acceptance_review_pack_smoke_v1",
      packStatus: packResult.status,
      defaultValidationStatus: defaultValidation.status,
      acceptedValidationStatus: acceptedValidation.status
    },
    null,
    2
  )
);
