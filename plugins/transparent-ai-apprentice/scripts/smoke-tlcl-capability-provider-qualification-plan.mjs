#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-capability-provider-qualification-plan-smoke", String(Date.now()));

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const statusRefresh = runNode("scripts/create-tlcl-status-refresh.mjs", [
  "--goal",
  "smoke-tlcl-capability-provider-qualification-plan",
  "--out-dir",
  smokeRoot
]);

const seniorIntake = runNode("scripts/create-tlcl-capability-provider-intake.mjs", [
  "--status-refresh",
  statusRefresh.refreshPath,
  "--provider-name",
  "qualification-strong-model",
  "--provider-kind",
  "strong_foundation_model",
  "--requested-role",
  "senior_reasoning_compile",
  "--capability-summary",
  "Compiles teacher corrections into disabled Rule Cards.",
  "--source-ref",
  "smoke-model-card",
  "--out-dir",
  smokeRoot
]);

const lowToolIntake = runNode("scripts/create-tlcl-capability-provider-intake.mjs", [
  "--status-refresh",
  statusRefresh.refreshPath,
  "--provider-name",
  "qualification-distilled-skill",
  "--provider-kind",
  "distilled_skill",
  "--requested-role",
  "low_reasoning_tool",
  "--capability-summary",
  "Fills templates from fixed fields.",
  "--source-ref",
  "smoke-skill-card",
  "--out-dir",
  smokeRoot
]);

const unsafeIntake = runNode("scripts/create-tlcl-capability-provider-intake.mjs", [
  "--status-refresh",
  statusRefresh.refreshPath,
  "--provider-name",
  "qualification-unsafe-skill",
  "--provider-kind",
  "distilled_skill",
  "--requested-role",
  "medium_reasoning_runtime",
  "--capability-summary",
  "Claims direct execution.",
  "--claims-can-execute-without-gate",
  "--out-dir",
  smokeRoot
]);

const seniorPlan = runNode("scripts/create-tlcl-capability-provider-qualification-plan.mjs", [
  "--intake",
  seniorIntake.intakePath,
  "--teacher-reviewed-candidate",
  "--teacher-review-note",
  "Teacher keeps this strong model as a senior compiler candidate for qualification planning.",
  "--out-dir",
  smokeRoot
]);
const seniorPlanPacket = readJson(seniorPlan.planPath);

const lowToolPlan = runNode("scripts/create-tlcl-capability-provider-qualification-plan.mjs", [
  "--intake",
  lowToolIntake.intakePath,
  "--teacher-reviewed-candidate",
  "--teacher-review-note",
  "Teacher keeps this distilled skill as a low reasoning tool candidate for qualification planning.",
  "--out-dir",
  smokeRoot
]);
const lowToolPlanPacket = readJson(lowToolPlan.planPath);

const missingTeacherPlan = runNode("scripts/create-tlcl-capability-provider-qualification-plan.mjs", [
  "--intake",
  lowToolIntake.intakePath,
  "--out-dir",
  smokeRoot
]);
const missingTeacherPacket = readJson(missingTeacherPlan.planPath);

const blockedIntakePlan = runNode("scripts/create-tlcl-capability-provider-qualification-plan.mjs", [
  "--intake",
  unsafeIntake.intakePath,
  "--teacher-reviewed-candidate",
  "--teacher-review-note",
  "Teacher accidentally tries to qualify unsafe intake.",
  "--out-dir",
  smokeRoot
]);
const blockedIntakePacket = readJson(blockedIntakePlan.planPath);

const checks = [
  check(
    "Senior provider qualification plan creates review-only compiler tests",
    seniorPlan.status === "tlcl_capability_provider_qualification_plan_waiting_for_test_review" &&
      seniorPlan.testCaseCount === 2 &&
      seniorPlanPacket.provider.requestedRole === "senior_reasoning_compile" &&
      seniorPlanPacket.qualificationPlan.testCases.some((item) => item.id === "senior_compile.teacher_correction_to_disabled_rule_card") &&
      seniorPlanPacket.qualificationPlan.requiredValidators.includes("policy_gate") &&
      seniorPlanPacket.locks.providerEnabled === false &&
      seniorPlanPacket.locks.targetSoftwareCommandsExecuted === false,
    seniorPlan.planPath
  ),
  check(
    "Distilled skill qualification plan creates only fixed-transform tests",
    lowToolPlan.status === "tlcl_capability_provider_qualification_plan_waiting_for_test_review" &&
      lowToolPlanPacket.provider.kind === "distilled_skill" &&
      lowToolPlanPacket.provider.requestedRole === "low_reasoning_tool" &&
      lowToolPlanPacket.qualificationPlan.testCases.some((item) => item.id === "low_tool.fixed_transform_no_inference") &&
      lowToolPlanPacket.qualificationPlan.testCases.some((item) => item.id === "low_tool.missing_field_to_unknown") &&
      lowToolPlanPacket.locks.ruleEnabled === false &&
      lowToolPlanPacket.locks.accepted === false,
    lowToolPlan.planPath
  ),
  check(
    "Qualification plan requires teacher-reviewed candidate evidence",
    missingTeacherPlan.status === "blocked_before_tlcl_capability_provider_qualification_plan" &&
      missingTeacherPacket.blockers.includes("missing_teacher_reviewed_candidate_flag") &&
      missingTeacherPacket.blockers.includes("missing_teacher_review_note") &&
      missingTeacherPacket.qualificationPlan.testCases.length === 0 &&
      missingTeacherPacket.locks.providerEnabled === false,
    missingTeacherPacket.blockers.join(",")
  ),
  check(
    "Blocked provider intake cannot create qualification tests",
    blockedIntakePlan.status === "blocked_before_tlcl_capability_provider_qualification_plan" &&
      blockedIntakePacket.blockers.includes("provider_intake_not_candidate_for_teacher_review") &&
      blockedIntakePacket.qualificationPlan.testCases.length === 0 &&
      blockedIntakePacket.locks.memoryWritten === false &&
      blockedIntakePacket.locks.packagingGated === true,
    blockedIntakePacket.blockers.join(",")
  ),
  check(
    "Qualification plan preserves comparison baselines and no-action locks",
    seniorPlanPacket.evidence.hashes.intakeHash?.startsWith("sha256:") &&
      seniorPlanPacket.qualificationPlan.comparisonBaselines.includes("distilled_skill_or_low_cost_model_direct") &&
      seniorPlanPacket.qualificationPlan.comparisonBaselines.includes("tlcl_contract_pipeline") &&
      seniorPlanPacket.locks.reviewOnly === true &&
      seniorPlanPacket.locks.completionClaim === false,
    seniorPlan.planPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_capability_provider_qualification_plan_smoke_v1",
  smokeRoot,
  seniorPlanPath: seniorPlan.planPath,
  lowToolPlanPath: lowToolPlan.planPath,
  missingTeacherPlanPath: missingTeacherPlan.planPath,
  blockedIntakePlanPath: blockedIntakePlan.planPath,
  passed,
  total: checks.length,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
