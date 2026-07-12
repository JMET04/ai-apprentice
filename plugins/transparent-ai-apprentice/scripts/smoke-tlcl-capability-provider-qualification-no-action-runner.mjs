#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "tlcl-capability-provider-qualification-no-action-runner-smoke",
  String(Date.now())
);

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
  "smoke-tlcl-capability-provider-qualification-no-action-runner",
  "--out-dir",
  smokeRoot
]);
const intake = runNode("scripts/create-tlcl-capability-provider-intake.mjs", [
  "--status-refresh",
  statusRefresh.refreshPath,
  "--provider-name",
  "no-action-runner-distilled-skill",
  "--provider-kind",
  "distilled_skill",
  "--requested-role",
  "low_reasoning_tool",
  "--capability-summary",
  "Fills fixed templates from reviewed fields.",
  "--source-ref",
  "smoke-skill",
  "--out-dir",
  smokeRoot
]);
const plan = runNode("scripts/create-tlcl-capability-provider-qualification-plan.mjs", [
  "--intake",
  intake.intakePath,
  "--teacher-reviewed-candidate",
  "--teacher-review-note",
  "Teacher keeps this skill candidate for no-action qualification run preparation.",
  "--out-dir",
  smokeRoot
]);

const run = runNode("scripts/run-tlcl-capability-provider-qualification-no-action-runner.mjs", [
  "--plan",
  plan.planPath,
  "--teacher-reviewed-test-plan",
  "--teacher-review-note",
  "Teacher reviewed the test plan and wants result templates only.",
  "--out-dir",
  smokeRoot
]);
const runPacket = readJson(run.runPath);
const resultTemplate = readJson(run.resultTemplatePath);

const missingTeacher = runNode("scripts/run-tlcl-capability-provider-qualification-no-action-runner.mjs", [
  "--plan",
  plan.planPath,
  "--out-dir",
  smokeRoot
]);
const missingTeacherPacket = readJson(missingTeacher.runPath);

const blockedPlan = runNode("scripts/create-tlcl-capability-provider-qualification-plan.mjs", [
  "--intake",
  intake.intakePath,
  "--out-dir",
  smokeRoot
]);
const blockedRun = runNode("scripts/run-tlcl-capability-provider-qualification-no-action-runner.mjs", [
  "--plan",
  blockedPlan.planPath,
  "--teacher-reviewed-test-plan",
  "--teacher-review-note",
  "Teacher tries to run a blocked plan.",
  "--out-dir",
  smokeRoot
]);
const blockedRunPacket = readJson(blockedRun.runPath);

const checks = [
  check(
    "Qualification no-action runner creates result template without invoking provider",
    run.status === "tlcl_capability_provider_qualification_no_action_run_waiting_for_result_receipts" &&
      run.rowCount === 2 &&
      runPacket.locks.providerInvoked === false &&
      runPacket.locks.providerEnabled === false &&
      runPacket.locks.targetSoftwareCommandsExecuted === false &&
      runPacket.qualificationRows.every((row) => row.providerInvocationStatus === "not_invoked") &&
      resultTemplate.format === "transparent_ai_tlcl_capability_provider_qualification_result_template_v1",
    run.runPath
  ),
  check(
    "Qualification result template defaults to not-run review states",
    resultTemplate.defaultDecision === "needs_result_review" &&
      resultTemplate.rows.length === 2 &&
      resultTemplate.rows.every((row) => row.resultStatus === "not_run_yet") &&
      resultTemplate.forbiddenOverallDecisions.includes("accepted") &&
      resultTemplate.forbiddenOverallDecisions.includes("enabled"),
    run.resultTemplatePath
  ),
  check(
    "Qualification no-action runner requires teacher-reviewed test plan evidence",
    missingTeacher.status === "blocked_before_tlcl_capability_provider_qualification_no_action_run" &&
      missingTeacherPacket.blockers.includes("missing_teacher_reviewed_test_plan_flag") &&
      missingTeacherPacket.blockers.includes("missing_teacher_review_note") &&
      missingTeacherPacket.qualificationRows.length === 0 &&
      missingTeacherPacket.locks.providerInvoked === false,
    missingTeacherPacket.blockers.join(",")
  ),
  check(
    "Blocked qualification plan cannot be converted into run rows",
    blockedRun.status === "blocked_before_tlcl_capability_provider_qualification_no_action_run" &&
      blockedRunPacket.blockers.includes("qualification_plan_not_waiting_for_test_review") &&
      blockedRunPacket.qualificationRows.length === 0 &&
      blockedRunPacket.locks.memoryWritten === false &&
      blockedRunPacket.locks.packagingGated === true,
    blockedRunPacket.blockers.join(",")
  ),
  check(
    "Qualification no-action runner preserves hash evidence and blocked transitions",
    runPacket.evidence.hashes.planHash?.startsWith("sha256:") &&
      runPacket.qualificationRows.every((row) => row.blockedTransitions.includes("execute_target_software")) &&
      runPacket.qualificationRows.every((row) => row.blockedTransitions.includes("unlock_packaging")) &&
      resultTemplate.sourceRunHash?.startsWith("sha256:") &&
      resultTemplate.locks.completionClaim === false,
    run.runPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_capability_provider_qualification_no_action_runner_smoke_v1",
  smokeRoot,
  runPath: run.runPath,
  resultTemplatePath: run.resultTemplatePath,
  missingTeacherRunPath: missingTeacher.runPath,
  blockedRunPath: blockedRun.runPath,
  passed,
  total: checks.length,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
