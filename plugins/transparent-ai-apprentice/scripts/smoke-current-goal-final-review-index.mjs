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

function packet(root, fileName, format, status) {
  const path = join(root, fileName);
  writeJson(path, {
    format,
    status,
    paths: {
      readme: join(root, `${fileName}.md`),
      html: join(root, `${fileName}.html`),
      receiptTemplate: join(root, `${fileName}.receipt.json`)
    },
    locks: {
      goalComplete: false,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false
    }
  });
  return path;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const root = mkdtempSync(join(tmpdir(), "ta-current-goal-final-review-index-"));
const finalGatePath = join(root, "original-goal-final-completion-gate.json");
const integratedGatePath = join(root, "current-goal-integrated-evidence-gate.json");
writeJson(finalGatePath, {
  format: "transparent_ai_original_goal_final_completion_gate_v1",
  status: "blocked_before_original_goal_completion_claim",
  lanes: [
    { id: "completion_blocker_matrix_present", status: "ready_for_final_teacher_acceptance_review", ready: true },
    { id: "all_software_low_token_coverage_final_review", status: "blocked_before_goal_completion_claim", ready: false, blocker: "needs coverage review" },
    { id: "real_local_non_cad_solidworks_scope_evidence", status: "ready_for_final_teacher_acceptance_review", ready: true },
    { id: "teacher_method_adaptation_reuse_result_proof", status: "blocked_before_goal_completion_claim", ready: false, blocker: "needs method proof" },
    { id: "unattended_all_software_operational_evidence", status: "blocked_before_goal_completion_claim", ready: false, blocker: "needs operational proof" },
    { id: "transparent_2d_perspective_3d_sketch_implementation", status: "ready_for_final_teacher_acceptance_review", ready: true },
    { id: "teacher_validated_spatial_intent_and_detail_logic", status: "blocked_before_goal_completion_claim", ready: false, blocker: "needs spatial review" },
    { id: "voice_text_numbered_execution_capability_convergence", status: "blocked_before_goal_completion_claim", ready: false, blocker: "needs voice convergence" },
    { id: "rule_dsl_validation_report_delivery_gate_audit", status: "ready_for_final_teacher_acceptance_review", ready: true },
    { id: "explicit_final_teacher_acceptance", status: "blocked_before_goal_completion_claim", ready: false, blocker: "needs final acceptance" }
  ]
});
writeJson(integratedGatePath, {
  format: "transparent_ai_current_goal_integrated_evidence_gate_v1",
  status: "current_goal_not_complete",
  locks: { goalComplete: false }
});
const lowTokenPath = packet(root, "low-token-coverage-final-review-pack.json", "transparent_ai_low_token_coverage_final_review_pack_v1", "waiting_for_teacher_low_token_coverage_final_review_not_completion");
const lowTokenAuditPath = packet(root, "low-token-coverage-convergence-audit.json", "transparent_ai_low_token_coverage_convergence_audit_v1", "low_token_coverage_convergence_ready_for_teacher_review_not_completion");
const methodPath = packet(root, "teacher-method-final-review-pack.json", "transparent_ai_teacher_method_final_review_pack_v1", "waiting_for_teacher_review_before_contract_or_medium_runtime_reuse");
const methodAuditPath = packet(root, "teacher-method-convergence-audit.json", "transparent_ai_teacher_method_convergence_audit_v1", "teacher_method_convergence_ready_for_teacher_review_not_medium_runtime_reuse");
const operationalPath = packet(root, "operational-final-review-pack.json", "transparent_ai_operational_final_review_pack_v1", "waiting_for_teacher_operational_review_before_unattended_completion");
const operationalAuditPath = packet(root, "operational-convergence-audit.json", "transparent_ai_operational_convergence_audit_v1", "operational_convergence_ready_for_teacher_review_not_unattended_completion");
const spatialPath = packet(root, "spatial-final-review-pack.json", "transparent_ai_spatial_final_review_pack_v1", "waiting_for_teacher_spatial_detail_logic_review_before_execution");
const spatialAuditPath = packet(root, "spatial-convergence-audit.json", "transparent_ai_spatial_convergence_audit_v1", "spatial_convergence_ready_for_teacher_review_not_execution");
const physicalGroundingPath = packet(root, "physical-world-spatial-grounding-pack.json", "transparent_ai_physical_world_spatial_grounding_pack_v1", "source_project_grounding_ready_for_transparent_overlay_review");
const voicePath = packet(root, "engineering-voice-control-session.json", "transparent_ai_engineering_voice_control_session_v1", "implementation_review_ready_waiting_for_teacher_number");
const voiceAuditPath = packet(root, "voice-numbered-execution-convergence-audit.json", "transparent_ai_voice_numbered_execution_convergence_audit_v1", "voice_text_numbered_execution_convergence_ready_for_teacher_review_not_execution");

const result = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-current-goal-final-review-index.mjs"),
  "--final-completion-gate",
  finalGatePath,
  "--integrated-evidence-gate",
  integratedGatePath,
  "--low-token-final-review-pack",
  lowTokenPath,
  "--low-token-coverage-convergence-audit",
  lowTokenAuditPath,
  "--teacher-method-final-review-pack",
  methodPath,
  "--teacher-method-convergence-audit",
  methodAuditPath,
  "--operational-final-review-pack",
  operationalPath,
  "--operational-convergence-audit",
  operationalAuditPath,
  "--spatial-final-review-pack",
  spatialPath,
  "--spatial-convergence-audit",
  spatialAuditPath,
  "--physical-world-spatial-grounding-pack",
  physicalGroundingPath,
  "--voice-control-session",
  voicePath,
  "--voice-numbered-convergence-audit",
  voiceAuditPath,
  "--output-dir",
  join(root, "index")
]);
const index = readJson(result.indexPath);
const receipt = readJson(result.receiptTemplatePath);
const indexDirName = basename(dirname(result.indexPath));

assert(index.format === "transparent_ai_current_goal_final_review_index_v1", "bad index format");
assert(!/[.\s]$/.test(indexDirName), "index directory must not end with a Windows-hostile dot or space");
assert(index.status === "waiting_for_teacher_final_review_across_open_lanes", "index should wait for review");
assert(index.summary.totalLanes === 10, "lane count missing");
assert(index.summary.readyLanes === 4, "ready lane count missing");
assert(index.summary.blockedLanes === 6, "blocked lane count missing");
assert(index.summary.finalGoalCompletionAllowed === false, "final completion must stay false");
assert(index.evidence.lowTokenCoverageFinalReviewPack.exists === true, "low token pack missing");
assert(index.evidence.lowTokenCoverageConvergenceAudit.exists === true, "low token convergence audit missing");
assert(index.evidence.teacherMethodFinalReviewPack.exists === true, "method pack missing");
assert(index.evidence.teacherMethodConvergenceAudit.exists === true, "teacher method convergence audit missing");
assert(index.evidence.operationalFinalReviewPack.exists === true, "operational pack missing");
assert(index.evidence.operationalConvergenceAudit.exists === true, "operational convergence audit missing");
assert(index.evidence.spatialFinalReviewPack.exists === true, "spatial pack missing");
assert(index.evidence.spatialConvergenceAudit.exists === true, "spatial convergence audit missing");
assert(index.evidence.physicalWorldSpatialGroundingPack.exists === true, "physical grounding pack missing");
assert(
  index.primaryOpenOrder.some(
    (item) => item.label === "Physical World Spatial Grounding" && item.path === physicalGroundingPath
  ),
  "physical grounding should be directly visible in primary open order"
);
assert(index.evidence.voiceNumberedConvergenceAudit.exists === true, "voice convergence audit missing");
assert(
  index.lanes.find((lane) => lane.id === "all_software_low_token_coverage_final_review").reviewEvidence.path === lowTokenAuditPath,
  "low token lane should point to convergence audit when available"
);
assert(
  index.lanes.find((lane) => lane.id === "voice_text_numbered_execution_capability_convergence").reviewEvidence.path === voiceAuditPath,
  "voice convergence lane should point to audit when available"
);
assert(
  index.lanes.find((lane) => lane.id === "teacher_method_adaptation_reuse_result_proof").reviewEvidence.path === methodAuditPath,
  "teacher method lane should point to convergence audit when available"
);
assert(
  index.lanes.find((lane) => lane.id === "unattended_all_software_operational_evidence").reviewEvidence.path === operationalAuditPath,
  "operational lane should point to convergence audit when available"
);
assert(
  index.lanes.find((lane) => lane.id === "teacher_validated_spatial_intent_and_detail_logic").reviewEvidence.path === spatialAuditPath,
  "spatial teacher validation lane should point to convergence audit when available"
);
assert(
  index.lanes.find((lane) => lane.id === "transparent_2d_perspective_3d_sketch_implementation").reviewEvidence.path === spatialAuditPath,
  "2D/3D sketch lane should point to convergence audit when available"
);
assert(index.locks.indexDoesNotRunCommands === true, "run lock missing");
assert(index.locks.goalComplete === false, "goal completion lock missing");
assert(receipt.teacherDecision === "needs_teacher_review", "receipt default must wait");
assert(receipt.forbiddenTeacherDecisions.includes("claim_complete"), "claim complete forbidden missing");
assert(receipt.forbiddenTeacherDecisions.includes("execute_target_software"), "execute forbidden missing");

const missingResult = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-current-goal-final-review-index.mjs"),
  "--final-completion-gate",
  finalGatePath,
  "--integrated-evidence-gate",
  integratedGatePath,
  "--low-token-final-review-pack",
  lowTokenPath,
  "--teacher-method-final-review-pack",
  methodPath,
  "--operational-final-review-pack",
  operationalPath,
  "--spatial-final-review-pack",
  join(root, "missing-spatial-pack.json"),
  "--output-dir",
  join(root, "missing-index")
]);
const missingIndex = readJson(missingResult.indexPath);
assert(missingIndex.status === "blocked_waiting_for_review_pack_index_inputs", "missing pack should block");
assert(missingIndex.blockers.includes("spatialFinalReviewPack_missing"), "missing spatial blocker absent");
assert(missingIndex.locks.goalComplete === false, "blocked index must not complete");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_current_goal_final_review_index_smoke_v1",
      index: result.indexPath,
      receiptTemplate: result.receiptTemplatePath,
      missingIndex: missingResult.indexPath,
      summary: index.summary,
      locks: index.locks
    },
    null,
    2
  )
);
