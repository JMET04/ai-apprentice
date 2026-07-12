#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-medium-runtime-dry-run-route-review-receipt-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = [], expectFailure = false) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (!expectFailure && result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  if (expectFailure && result.status === 0) throw new Error(`${script} should have failed`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : { status: result.status, stderr: result.stderr };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const statusRefresh = runNode("scripts/create-tlcl-status-refresh.mjs", [
  "--goal",
  "smoke-tlcl-medium-runtime-dry-run-route-review-receipt",
  "--out-dir",
  join(smokeRoot, "status")
]);
const validationReportPath = writeJson(join(smokeRoot, "passing-validation-report.json"), {
  validation_id: "val.smoke.route.review",
  artifact_id: "artifact.smoke.route.review",
  rule_package_id: "ruleset.smoke.route.review",
  status: "pass",
  delivery_allowed: true,
  created_at: new Date().toISOString(),
  summary: { pass: 1, fail: 0, unknown: 0, skipped: 0, error: 0 },
  results: [
    {
      rule_id: "rule.smoke.route.review",
      rule_version: "0.1.0",
      lifecycle: "active",
      severity: "blocking",
      status: "pass",
      validator: "expression",
      message: "passed",
      artifact_id: "artifact.smoke.route.review"
    }
  ],
  hashes: { artifact_hash: "sha256:route-review", rule_package_hash: "sha256:rules" }
});
const runtimeGate = runNode("scripts/create-tlcl-runtime-gate.mjs", [
  "--goal",
  "allow-medium-route-review",
  "--status-refresh",
  statusRefresh.refreshPath,
  "--validation-report",
  validationReportPath,
  "--out-dir",
  join(smokeRoot, "runtime-gate")
]);
const spatialRoutePath = writeJson(join(smokeRoot, "spatial-route-bridge.json"), {
  format: "transparent_ai_spatial_software_execution_route_bridge_v1",
  status: "spatial_target_bound_to_execution_routes_waiting_for_dry_run_review",
  selectedTarget: { selectedTargetOnly: true, selectedNumber: 2 },
  detailLogicGate: { ready: true, missingDetailLogicCount: 0 },
  routeCandidates: [
    {
      adapterId: "existing-cli-or-script",
      label: "reviewed CLI dry-run route",
      dryRunHandoff: { tool: "create_existing_software_execution_adapter", arguments: { preferredAdapter: "existing-cli-or-script" } },
      requiredEvidenceBeforeDryRun: ["teacher-confirmed numbered spatial target"],
      blockersBeforeExecute: ["execute only after separate approval gate"]
    }
  ],
  locks: { softwareActionsExecuted: false, packagingGated: true }
});
const prepResult = runNode("scripts/create-tlcl-medium-runtime-dry-run-prep.mjs", [
  "--goal",
  "medium runtime route review receipt smoke",
  "--runtime-gate",
  runtimeGate.gatePath,
  "--spatial-route-bridge",
  spatialRoutePath,
  "--out-dir",
  join(smokeRoot, "prep")
]);
const prepBuilder = runNode("scripts/create-tlcl-medium-runtime-dry-run-prep-review-receipt-builder.mjs", [
  "--goal",
  "teacher reviews medium dry-run prep before route handoff",
  "--prep",
  prepResult.prepPath,
  "--out-dir",
  join(smokeRoot, "prep-builder")
]);
const prepReceiptPath = writeJson(join(smokeRoot, "prep-approve-receipt.json"), {
  ...readJson(prepBuilder.receiptTemplatePath),
  teacherDecision: "teacher_reviewed_route_ready_for_dry_run",
  selectedRouteIndex: 1,
  routeEvidenceReviewed: true,
  selectedTargetReviewed: true,
  logicContractReviewed: true,
  blockedActionsConfirmed: true,
  teacherNote: "route evidence and target were reviewed"
});
const prepValidation = runNode("scripts/validate-tlcl-medium-runtime-dry-run-prep-review-receipt.mjs", [
  "--prep",
  prepResult.prepPath,
  "--receipt",
  prepReceiptPath,
  "--out-dir",
  join(smokeRoot, "prep-validation")
]);
const routeHandoff = runNode("scripts/create-tlcl-medium-runtime-dry-run-route-review-handoff.mjs", [
  "--goal",
  "create route review handoff for receipt smoke",
  "--validation",
  prepValidation.validationPath,
  "--prep",
  prepResult.prepPath,
  "--out-dir",
  join(smokeRoot, "route-handoff")
]);
const routeBuilder = runNode("scripts/create-tlcl-medium-runtime-dry-run-route-review-receipt-builder.mjs", [
  "--goal",
  "teacher reviews TLCL route handoff before dry-run-only runner",
  "--handoff",
  routeHandoff.handoffPath,
  "--out-dir",
  join(smokeRoot, "route-builder")
]);
const routeTemplate = readJson(routeBuilder.receiptTemplatePath);
const approveReceiptPath = writeJson(join(smokeRoot, "route-approve-receipt.json"), {
  ...routeTemplate,
  teacherDecision: "route_reviewed_ready_for_dry_run_only_runner",
  selectedHandoffItemId: "tlcl_dry_run_route_review_001",
  selectedRouteIndex: 1,
  handoffEvidenceReviewed: true,
  commandTemplateReviewed: true,
  retainedRollbackPointConfirmed: true,
  dryRunOnlyConfirmed: true,
  blockedActionsConfirmed: true,
  teacherNote: "route handoff reviewed; only a later dry-run-only runner may be prepared"
});
const correctionReceiptPath = writeJson(join(smokeRoot, "route-correction-receipt.json"), {
  ...routeTemplate,
  teacherDecision: "correction_to_senior_compile",
  selectedRouteIndex: 0,
  blockedActionsConfirmed: true,
  teacherCorrection: "The command template still misses a required rollback marker."
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "route-forbidden-receipt.json"), {
  ...routeTemplate,
  teacherDecision: "execute_now",
  selectedRouteIndex: 1,
  blockedActionsConfirmed: true
});

const approveValidation = runNode("scripts/validate-tlcl-medium-runtime-dry-run-route-review-receipt.mjs", [
  "--handoff",
  routeHandoff.handoffPath,
  "--receipt",
  approveReceiptPath,
  "--out-dir",
  join(smokeRoot, "route-validation")
]);
const correctionValidation = runNode("scripts/validate-tlcl-medium-runtime-dry-run-route-review-receipt.mjs", [
  "--handoff",
  routeHandoff.handoffPath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  join(smokeRoot, "route-validation")
]);
const forbiddenValidation = runNode(
  "scripts/validate-tlcl-medium-runtime-dry-run-route-review-receipt.mjs",
  ["--handoff", routeHandoff.handoffPath, "--receipt", forbiddenReceiptPath, "--out-dir", join(smokeRoot, "route-validation")],
  true
);

const checks = [
  check(
    "TLCL route review receipt builder creates a teacher template without dry-run execution",
    routeBuilder.format === "transparent_ai_tlcl_medium_runtime_dry_run_route_review_receipt_builder_result_v1" &&
      routeBuilder.handoffItemCount === 1 &&
      routeBuilder.dryRunExecuted === false &&
      routeBuilder.runnerExecuted === false &&
      routeBuilder.targetSoftwareCommandsExecuted === false &&
      routeBuilder.ruleEnabled === false,
    routeBuilder.builderPath
  ),
  check(
    "Teacher-approved route review validates only a separate dry-run-only runner template",
    approveValidation.status === "ready_for_separate_dry_run_only_runner" &&
      approveValidation.readyForDryRunOnlyRunner === true &&
      approveValidation.dryRunExecuted === false &&
      approveValidation.runnerExecuted === false &&
      approveValidation.targetSoftwareCommandsExecuted === false &&
      approveValidation.ruleEnabled === false,
    approveValidation.validationPath
  ),
  check(
    "Teacher correction from route review escalates back to senior compile",
    correctionValidation.status === "escalate_to_senior_compile" &&
      correctionValidation.escalateToSeniorCompile === true &&
      correctionValidation.readyForDryRunOnlyRunner === false,
    correctionValidation.validationPath
  ),
  check(
    "Forbidden execute decisions are blocked by TLCL route review validation",
    forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.status === "blocked_for_forbidden_decision" &&
      forbiddenValidation.targetSoftwareCommandsExecuted === false,
    forbiddenValidation.validationPath || "forbidden validation output"
  )
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_dry_run_route_review_receipt_smoke_v1",
  smokeRoot,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
