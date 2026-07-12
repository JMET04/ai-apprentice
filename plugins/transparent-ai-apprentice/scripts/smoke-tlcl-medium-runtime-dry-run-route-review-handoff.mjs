#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-medium-runtime-dry-run-route-review-handoff-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const readyValidationPath = writeJson(join(smokeRoot, "ready-validation.json"), {
  format: "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_validation_v1",
  status: "ready_for_separate_dry_run_route_review",
  decision: "teacher_reviewed_route_ready_for_dry_run",
  readyForDryRunRouteReview: true,
  escalateToSeniorCompile: false,
  forbiddenDecisionUsed: false,
  blockers: [],
  nextDryRunRouteReview: {
    routeIndex: 1,
    adapterId: "existing-cli-or-script",
    dryRunHandoff: { tool: "create_existing_software_execution_adapter", arguments: { preferredAdapter: "existing-cli-or-script" } },
    executesNow: false
  },
  locks: { noSoftwareExecution: true, noRuleEnablement: true, noMemoryWrite: true }
});
const correctionValidationPath = writeJson(join(smokeRoot, "correction-validation.json"), {
  format: "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_validation_v1",
  status: "escalate_to_senior_compile",
  decision: "correction_to_senior_compile",
  readyForDryRunRouteReview: false,
  escalateToSeniorCompile: true,
  forbiddenDecisionUsed: false,
  blockers: [],
  seniorCompileEscalation: {
    teacherCorrection: "The route ignores the required dimension relationship.",
    repairTasks: ["Repair the Rule Card and deterministic validator evidence."]
  },
  locks: { noSoftwareExecution: true, noRuleEnablement: true, noMemoryWrite: true }
});
const forbiddenValidationPath = writeJson(join(smokeRoot, "forbidden-validation.json"), {
  format: "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_validation_v1",
  status: "blocked_for_forbidden_decision",
  decision: "execute_now",
  readyForDryRunRouteReview: false,
  escalateToSeniorCompile: false,
  forbiddenDecisionUsed: true,
  blockers: ["forbidden_teacher_decision"],
  locks: { noSoftwareExecution: true, noRuleEnablement: true, noMemoryWrite: true }
});

const ready = runNode("scripts/create-tlcl-medium-runtime-dry-run-route-review-handoff.mjs", [
  "--validation",
  readyValidationPath,
  "--out-dir",
  join(smokeRoot, "handoffs")
]);
const correction = runNode("scripts/create-tlcl-medium-runtime-dry-run-route-review-handoff.mjs", [
  "--validation",
  correctionValidationPath,
  "--out-dir",
  join(smokeRoot, "handoffs")
]);
const forbidden = runNode("scripts/create-tlcl-medium-runtime-dry-run-route-review-handoff.mjs", [
  "--validation",
  forbiddenValidationPath,
  "--out-dir",
  join(smokeRoot, "handoffs")
]);

const checks = [
  check(
    "TLCL dry-run route review handoff creates one non-executing handoff item",
    ready.status === "dry_run_route_review_handoff_ready" &&
      ready.handoffItemCount === 1 &&
      ready.dryRunExecuted === false &&
      ready.targetSoftwareCommandsExecuted === false &&
      ready.ruleEnabled === false,
    ready.handoffPath
  ),
  check(
    "TLCL dry-run route review handoff can carry senior compile repairs",
    correction.status === "senior_compile_repair_handoff_ready" &&
      correction.seniorCompileHandoffReady === true &&
      correction.handoffItemCount === 0,
    correction.handoffPath
  ),
  check(
    "TLCL dry-run route review handoff preserves forbidden-decision blocking",
    forbidden.status === "blocked_for_forbidden_decision" &&
      forbidden.handoffItemCount === 0 &&
      forbidden.targetSoftwareCommandsExecuted === false,
    forbidden.handoffPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_dry_run_route_review_handoff_smoke_v1",
  smokeRoot,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
