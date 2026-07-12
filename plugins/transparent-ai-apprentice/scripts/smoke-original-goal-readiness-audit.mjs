#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "original-goal-readiness-audit-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runAudit() {
  const result = spawnSync(
    process.execPath,
    [
      join(pluginRoot, "scripts", "create-original-goal-readiness-audit.mjs"),
      "--goal",
      "Verify all-software low-token log learning, teacher-method adaptation, transparent overlay, 2D/3D spatial interpretation, voice/text numbered control, and supervised execution boundaries.",
      "--output-dir",
      smokeRoot
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 120000
    }
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "readiness audit failed");
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const result = runAudit();
const audit = readJson(result.auditPath);
const readme = readFileSync(result.readmePath, "utf8");
const requirementIds = audit.requirements.map((item) => item.id);

const checks = [
  {
    name: "Original goal audit runs current goal coverage and verifier commands",
    pass:
      result.format === "transparent_ai_original_goal_readiness_audit_result_v1" &&
      audit.format === "transparent_ai_original_goal_readiness_audit_v1" &&
      audit.commandResults.goalCoverage.status === "passed" &&
      audit.commandResults.goalCoverage.passed === audit.commandResults.goalCoverage.total &&
      audit.commandResults.goalCoverage.passed >= 13 &&
      audit.commandResults.verifier.status === "passed" &&
      audit.commandResults.verifier.passed === audit.commandResults.verifier.total &&
      audit.commandResults.verifier.passed >= 111,
    evidence: JSON.stringify(audit.commandResults)
  },
  {
    name: "Audit covers all user objective clauses without narrowing to CAD or SolidWorks",
    pass:
      requirementIds.includes("all_software_low_token_log_learning") &&
      requirementIds.includes("all_software_unattended_learning_audit") &&
      requirementIds.includes("all_software_operational_learning_workbench") &&
      requirementIds.includes("all_software_operational_learning_trial") &&
      requirementIds.includes("all_software_operational_learning_activation_gate") &&
      requirementIds.includes("all_software_operational_learning_activation_dry_run_rehearsal") &&
      requirementIds.includes("all_software_operational_learning_registration_execute_gate") &&
      requirementIds.includes("all_software_operational_learning_registration_approved_runner") &&
      requirementIds.includes("all_software_operational_learning_post_activation_witness") &&
      requirementIds.includes("all_software_operational_status_console") &&
      requirementIds.includes("teacher_method_adaptation") &&
      requirementIds.includes("transparent_drawing_mask") &&
      requirementIds.includes("perspective_position_depth_understanding") &&
      requirementIds.includes("universal_detail_logic_before_similarity") &&
      requirementIds.includes("software_execution_from_teacher_intent") &&
      requirementIds.includes("voice_text_engineering_control") &&
      audit.requirements.find((item) => item.id === "all_software_unattended_learning_audit")?.evidenceSummary.includes("completion-boundary report") &&
      audit.requirements.find((item) => item.id === "all_software_operational_learning_workbench")?.evidenceSummary.includes("one start-here guide") &&
      audit.requirements.find((item) => item.id === "all_software_operational_learning_trial")?.evidenceSummary.includes("manual") &&
      audit.requirements.find((item) => item.id === "all_software_operational_learning_activation_gate")?.evidenceSummary.includes("dry-run registration") &&
      audit.requirements
        .find((item) => item.id === "all_software_operational_learning_activation_dry_run_rehearsal")
        ?.evidenceSummary.includes("invokes it without an execute flag") &&
      audit.requirements
        .find((item) => item.id === "all_software_operational_learning_registration_execute_gate")
        ?.evidenceSummary.includes("prepares the real register and rollback") &&
      audit.requirements
        .find((item) => item.id === "all_software_operational_learning_registration_approved_runner")
        ?.evidenceSummary.includes("status verifier") &&
      audit.requirements
        .find((item) => item.id === "all_software_operational_learning_registration_approved_runner")
        ?.proofSignals.includes("transparent_ai_all_software_operational_learning_registration_approved_runner_v1") &&
      audit.requirements
        .find((item) => item.id === "all_software_operational_learning_post_activation_witness")
        ?.evidenceSummary.includes("recurring run-output audit") &&
      audit.requirements
        .find((item) => item.id === "all_software_operational_status_console")
        ?.evidenceSummary.includes("evidence lanes") &&
      audit.requirements
        .find((item) => item.id === "universal_detail_logic_before_similarity")
        ?.evidenceSummary.includes("block appearance-only copying") &&
      audit.requirements
        .find((item) => item.id === "universal_detail_logic_before_similarity")
        ?.proofSignals.includes("transparent_ai_parametric_drawing_logic_receipt_validation_v1") &&
      audit.requirements.find((item) => item.id === "all_software_low_token_log_learning")?.evidenceSummary.includes("all-software inventory"),
    evidence: requirementIds.join(",")
  },
  {
    name: "Audit explicitly keeps broad completion unclaimed where evidence is still bounded",
    pass:
      audit.completionDecision ===
        "not_complete_full_objective_because_universal_native_control_and_unattended_all_app_coverage_are_not_proven" &&
      audit.requirements.some((item) => item.notProven.some((gap) => gap.includes("Not every installed app"))) &&
      audit.requirements.some((item) => item.notProven.some((gap) => gap.includes("Universal native semantic control"))) &&
      audit.reviewLocks.accepted === false &&
      audit.reviewLocks.packagingGated === true,
    evidence: audit.completionDecision
  },
  {
    name: "Audit writes a teacher-readable start-here report with next best work",
    pass:
      existsSync(result.readmePath) &&
      readme.includes("Original Goal Readiness Audit") &&
      readme.includes("Next Best Work") &&
      readme.includes("all_software_low_token_log_learning") &&
      readme.includes("all_software_unattended_learning_audit") &&
      readme.includes("all_software_operational_learning_workbench") &&
      readme.includes("all_software_operational_learning_trial") &&
      readme.includes("all_software_operational_learning_activation_gate") &&
      readme.includes("all_software_operational_learning_activation_dry_run_rehearsal") &&
      readme.includes("ALL_SOFTWARE_OPERATIONAL_LEARNING_ACTIVATION_DRY_RUN_REHEARSAL_START_HERE.md") &&
      readme.includes("all_software_operational_learning_registration_execute_gate") &&
      readme.includes("ALL_SOFTWARE_OPERATIONAL_LEARNING_REGISTRATION_EXECUTE_GATE_START_HERE.md") &&
      readme.includes("all_software_operational_learning_registration_approved_runner") &&
      readme.includes("smoke:plugin-all-software-operational-learning-registration-approved-runner") &&
      readme.includes("all_software_operational_learning_post_registration_output_witness_runner") &&
      readme.includes("smoke:plugin-all-software-operational-learning-post-registration-output-witness-runner") &&
      readme.includes("all_software_operational_learning_post_activation_witness") &&
      readme.includes("ALL_SOFTWARE_OPERATIONAL_LEARNING_POST_ACTIVATION_WITNESS_START_HERE.md") &&
      readme.includes("all_software_operational_status_console") &&
      readme.includes("ALL_SOFTWARE_OPERATIONAL_STATUS_CONSOLE_START_HERE.md") &&
      readme.includes("universal_detail_logic_before_similarity") &&
      readme.includes("validate_parametric_drawing_logic_receipt") &&
      readme.includes("smoke:plugin-parametric-drawing-logic-receipt-validation") &&
      readme.includes("voice_text_engineering_control"),
    evidence: result.readmePath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_original_goal_readiness_audit_smoke_v1",
  smokeRoot,
  auditPath: result.auditPath,
  readmePath: result.readmePath,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
