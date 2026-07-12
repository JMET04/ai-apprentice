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
const root = mkdtempSync(join(tmpdir(), "ta-final-convergence-readiness-"));
const indexPath = join(root, "current-goal-final-review-index.json");
const evidencePath = join(root, "evidence.json");
writeJson(evidencePath, { ok: true });

const ids = [
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

writeJson(indexPath, {
  format: "transparent_ai_current_goal_final_review_index_v1",
  status: "waiting_for_teacher_final_review_across_open_lanes",
  summary: { totalLanes: 10, readyLanes: 4, blockedLanes: 6, finalGoalCompletionAllowed: false },
  lanes: ids.map((id) => ({
    id,
    status: id === "explicit_final_teacher_acceptance" ? "blocked_before_goal_completion_claim" : "ready_or_blocked",
    ready: ["completion_blocker_matrix_present", "real_local_non_cad_solidworks_scope_evidence", "transparent_2d_perspective_3d_sketch_implementation", "rule_dsl_validation_report_delivery_gate_audit"].includes(id),
    blocker: id === "explicit_final_teacher_acceptance" ? "missing final teacher acceptance" : "",
    reviewEvidence:
      id === "explicit_final_teacher_acceptance"
        ? { exists: false, path: "", format: "", status: "" }
        : {
            exists: true,
            path: evidencePath,
            format: `format_${id}`,
            status: id.includes("low_token")
              ? "low_token_coverage_convergence_ready_for_teacher_review_not_completion"
              : id.includes("operational")
                ? "operational_convergence_ready_for_teacher_review_not_unattended_completion"
                : id.includes("spatial") || id.includes("sketch")
                  ? "spatial_convergence_ready_for_teacher_review_not_execution"
                  : id.includes("voice")
                    ? "voice_text_numbered_execution_convergence_ready_for_teacher_review_not_execution"
                    : "ready_for_final_teacher_acceptance_review"
          }
  })),
  locks: { goalComplete: false }
});

const result = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-current-goal-final-convergence-readiness-gate.mjs"),
  "--final-review-index",
  indexPath,
  "--output-dir",
  join(root, "gate")
]);
const gate = readJson(result.gatePath);
const receipt = readJson(result.receiptTemplatePath);
const gateDirName = basename(dirname(result.gatePath));

assert(gate.format === "transparent_ai_current_goal_final_convergence_readiness_gate_v1", "bad gate format");
assert(!/[.\s]$/.test(gateDirName), "gate directory must not end with a Windows-hostile dot or space");
assert(gate.status === "convergence_evidence_ready_for_final_teacher_review_not_completion", "gate should be review-ready but not complete");
assert(gate.summary.totalLanes === 10, "lane count missing");
assert(gate.summary.reviewEvidenceReadyLanes === 9, "review evidence ready count should be 9");
assert(gate.summary.missingReviewEvidenceLanes === 1, "missing review evidence should be final acceptance only");
assert(gate.summary.completionReadyLanes === 0, "completion ready lanes must stay zero");
assert(gate.summary.finalGoalCompletionAllowed === false, "completion must remain false");
assert(gate.lanes.find((lane) => lane.laneId === "explicit_final_teacher_acceptance").reviewEvidenceReady === false, "final acceptance must stay missing");
assert(gate.locks.gateDoesNotRunCommands === true, "run lock missing");
assert(gate.locks.goalComplete === false, "goal completion lock missing");
assert(receipt.teacherDecision === "needs_teacher_review", "receipt default must wait");
assert(receipt.forbiddenTeacherDecisions.includes("claim_complete"), "claim complete forbidden missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_current_goal_final_convergence_readiness_gate_smoke_v1",
      gate: result.gatePath,
      receiptTemplate: result.receiptTemplatePath,
      summary: gate.summary,
      locks: gate.locks
    },
    null,
    2
  )
);
