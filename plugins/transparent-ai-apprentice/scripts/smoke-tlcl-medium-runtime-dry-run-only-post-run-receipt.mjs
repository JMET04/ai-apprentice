#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-medium-runtime-dry-run-only-post-run-receipt-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = [], expectFailure = false) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (!expectFailure && result.status !== 0) throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
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
  "smoke-tlcl-medium-runtime-dry-run-only-post-run-receipt",
  "--out-dir",
  join(smokeRoot, "status")
]);
const validationReportPath = writeJson(join(smokeRoot, "passing-validation-report.json"), {
  validation_id: "val.smoke.post.run",
  artifact_id: "artifact.smoke.post.run",
  rule_package_id: "ruleset.smoke.post.run",
  status: "pass",
  delivery_allowed: true,
  created_at: new Date().toISOString(),
  summary: { pass: 1, fail: 0, unknown: 0, skipped: 0, error: 0 },
  results: [
    {
      rule_id: "rule.smoke.post.run",
      rule_version: "0.1.0",
      lifecycle: "active",
      severity: "blocking",
      status: "pass",
      validator: "expression",
      message: "passed",
      artifact_id: "artifact.smoke.post.run"
    }
  ],
  hashes: { artifact_hash: "sha256:post-run", rule_package_hash: "sha256:rules" }
});
const runtimeGate = runNode("scripts/create-tlcl-runtime-gate.mjs", [
  "--goal",
  "allow-medium-post-run-review",
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
const prep = runNode("scripts/create-tlcl-medium-runtime-dry-run-prep.mjs", [
  "--runtime-gate",
  runtimeGate.gatePath,
  "--spatial-route-bridge",
  spatialRoutePath,
  "--out-dir",
  join(smokeRoot, "prep")
]);
const prepBuilder = runNode("scripts/create-tlcl-medium-runtime-dry-run-prep-review-receipt-builder.mjs", [
  "--prep",
  prep.prepPath,
  "--out-dir",
  join(smokeRoot, "prep-builder")
]);
const prepReceiptPath = writeJson(join(smokeRoot, "prep-receipt.json"), {
  ...readJson(prepBuilder.receiptTemplatePath),
  teacherDecision: "teacher_reviewed_route_ready_for_dry_run",
  selectedRouteIndex: 1,
  routeEvidenceReviewed: true,
  selectedTargetReviewed: true,
  logicContractReviewed: true,
  blockedActionsConfirmed: true
});
const prepValidation = runNode("scripts/validate-tlcl-medium-runtime-dry-run-prep-review-receipt.mjs", [
  "--prep",
  prep.prepPath,
  "--receipt",
  prepReceiptPath,
  "--out-dir",
  join(smokeRoot, "prep-validation")
]);
const routeHandoff = runNode("scripts/create-tlcl-medium-runtime-dry-run-route-review-handoff.mjs", [
  "--validation",
  prepValidation.validationPath,
  "--prep",
  prep.prepPath,
  "--out-dir",
  join(smokeRoot, "route-handoff")
]);
const routeBuilder = runNode("scripts/create-tlcl-medium-runtime-dry-run-route-review-receipt-builder.mjs", [
  "--handoff",
  routeHandoff.handoffPath,
  "--out-dir",
  join(smokeRoot, "route-builder")
]);
const routeReceiptPath = writeJson(join(smokeRoot, "route-receipt.json"), {
  ...readJson(routeBuilder.receiptTemplatePath),
  teacherDecision: "route_reviewed_ready_for_dry_run_only_runner",
  selectedHandoffItemId: "tlcl_dry_run_route_review_001",
  selectedRouteIndex: 1,
  handoffEvidenceReviewed: true,
  commandTemplateReviewed: true,
  retainedRollbackPointConfirmed: true,
  dryRunOnlyConfirmed: true,
  blockedActionsConfirmed: true
});
const routeValidation = runNode("scripts/validate-tlcl-medium-runtime-dry-run-route-review-receipt.mjs", [
  "--handoff",
  routeHandoff.handoffPath,
  "--receipt",
  routeReceiptPath,
  "--out-dir",
  join(smokeRoot, "route-validation")
]);
const dryRun = runNode("scripts/run-tlcl-medium-runtime-dry-run-only-runner.mjs", [
  "--validation",
  routeValidation.validationPath,
  "--out-dir",
  join(smokeRoot, "dry-run")
]);
const builder = runNode("scripts/create-tlcl-medium-runtime-dry-run-only-post-run-receipt-builder.mjs", [
  "--run",
  dryRun.runPath,
  "--out-dir",
  join(smokeRoot, "post-run-builder")
]);
const template = readJson(builder.receiptTemplatePath);
const matchedReceiptPath = writeJson(join(smokeRoot, "matched-receipt.json"), {
  ...template,
  teacherDecision: "dry_run_matched_expected",
  dryRunEvidenceReviewed: true,
  commandTemplateReviewed: true,
  noExecutionLocksReviewed: true,
  rollbackPointStillRetained: true,
  teacherMatchedExpected: true,
  blockedActionsConfirmed: true,
  teacherNote: "The dry-run-only evidence matches the intended route."
});
const mismatchReceiptPath = writeJson(join(smokeRoot, "mismatch-receipt.json"), {
  ...template,
  teacherDecision: "dry_run_mismatch_blocked",
  blockedActionsConfirmed: true,
  teacherNote: "The dry-run-only evidence does not match."
});
const correctionReceiptPath = writeJson(join(smokeRoot, "correction-receipt.json"), {
  ...template,
  teacherDecision: "correction_to_senior_compile",
  blockedActionsConfirmed: true,
  teacherCorrection: "The dry-run evidence misses a required constraint."
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-receipt.json"), {
  ...template,
  teacherDecision: "execute_now",
  blockedActionsConfirmed: true
});

const matchedValidation = runNode("scripts/validate-tlcl-medium-runtime-dry-run-only-post-run-receipt.mjs", [
  "--run",
  dryRun.runPath,
  "--receipt",
  matchedReceiptPath,
  "--out-dir",
  join(smokeRoot, "post-run-validation")
]);
const mismatchValidation = runNode("scripts/validate-tlcl-medium-runtime-dry-run-only-post-run-receipt.mjs", [
  "--run",
  dryRun.runPath,
  "--receipt",
  mismatchReceiptPath,
  "--out-dir",
  join(smokeRoot, "post-run-validation")
]);
const correctionValidation = runNode("scripts/validate-tlcl-medium-runtime-dry-run-only-post-run-receipt.mjs", [
  "--run",
  dryRun.runPath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  join(smokeRoot, "post-run-validation")
]);
const forbiddenValidation = runNode(
  "scripts/validate-tlcl-medium-runtime-dry-run-only-post-run-receipt.mjs",
  ["--run", dryRun.runPath, "--receipt", forbiddenReceiptPath, "--out-dir", join(smokeRoot, "post-run-validation")],
  true
);

const checks = [
  check(
    "TLCL post-run receipt builder creates a teacher template without creating approval gates",
    builder.format === "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_builder_result_v1" &&
      builder.executionApprovalGateCreated === false &&
      builder.targetSoftwareCommandsExecuted === false &&
      builder.ruleEnabled === false,
    builder.builderPath
  ),
  check(
    "Matched TLCL post-run receipt validates only execution approval gate planning",
    matchedValidation.status === "ready_for_execution_approval_gate_planning" &&
      matchedValidation.readyForExecutionApprovalGatePlanning === true &&
      matchedValidation.executionApprovalGateCreated === false &&
      matchedValidation.targetSoftwareCommandsExecuted === false &&
      matchedValidation.ruleEnabled === false,
    matchedValidation.validationPath
  ),
  check(
    "Mismatch TLCL post-run receipt remains blocked without approval planning",
    mismatchValidation.status === "blocked_by_teacher_dry_run_mismatch" &&
      mismatchValidation.mismatchBlocked === true &&
      mismatchValidation.readyForExecutionApprovalGatePlanning === false,
    mismatchValidation.validationPath
  ),
  check(
    "Correction TLCL post-run receipt escalates back to senior compile",
    correctionValidation.status === "escalate_to_senior_compile" &&
      correctionValidation.escalateToSeniorCompile === true &&
      correctionValidation.readyForExecutionApprovalGatePlanning === false,
    correctionValidation.validationPath
  ),
  check(
    "Forbidden TLCL post-run receipt decisions are fail-closed",
    forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.status === "blocked_for_forbidden_decision" &&
      forbiddenValidation.targetSoftwareCommandsExecuted === false,
    forbiddenValidation.validationPath || "forbidden validation"
  )
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_smoke_v1",
  smokeRoot,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
