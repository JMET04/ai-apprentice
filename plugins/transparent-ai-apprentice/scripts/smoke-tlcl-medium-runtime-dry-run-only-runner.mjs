#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-medium-runtime-dry-run-only-runner-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return JSON.parse(result.stdout);
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

function activationValidation(role, providerName) {
  return {
    format: "transparent_ai_tlcl_capability_provider_activation_validation_v1",
    status: "tlcl_capability_provider_role_approved_waiting_for_gated_use",
    providerRole: role,
    providerEnabledForTlclRole: true,
    locks: {
      providerMayBypassTlcl: false,
      providerMayExecuteTargetSoftware: false,
      providerMayWriteMemory: false,
      providerMayUnlockPackaging: false,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      packagingUnlocked: false
    },
    providerCapabilityCard: {
      format: "transparent_ai_tlcl_capability_provider_card_v1",
      provider: {
        name: providerName,
        kind: "strong_foundation_model",
        requestedRole: role,
        capabilitySummary: "Smoke provider card for dry-run-only runner role trace validation."
      },
      providerRole: role,
      providerQualifiedForTlclRole: true,
      providerEnabledForTlclRole: true,
      roleScopedAllowedUse: ["prepare only TLCL-gated medium-runtime work after runtime gates"],
      forbiddenUse: ["self approval", "contract bypass", "ungated target software execution", "memory writes", "packaging unlock"]
    }
  };
}

const statusRefresh = runNode("scripts/create-tlcl-status-refresh.mjs", [
  "--goal",
  "smoke-tlcl-medium-runtime-dry-run-only-runner",
  "--out-dir",
  join(smokeRoot, "status")
]);
const validationReportPath = writeJson(join(smokeRoot, "passing-validation-report.json"), {
  validation_id: "val.smoke.dry.run.only",
  artifact_id: "artifact.smoke.dry.run.only",
  rule_package_id: "ruleset.smoke.dry.run.only",
  status: "pass",
  delivery_allowed: true,
  created_at: new Date().toISOString(),
  summary: { pass: 1, fail: 0, unknown: 0, skipped: 0, error: 0 },
  results: [
    {
      rule_id: "rule.smoke.dry.run.only",
      rule_version: "0.1.0",
      lifecycle: "active",
      severity: "blocking",
      status: "pass",
      validator: "expression",
      message: "passed",
      artifact_id: "artifact.smoke.dry.run.only"
    }
  ],
  hashes: { artifact_hash: "sha256:dry-run-only", rule_package_hash: "sha256:rules" }
});
const mediumActivationPath = writeJson(
  join(smokeRoot, "medium-runtime-provider-activation-validation.json"),
  activationValidation("medium_reasoning_runtime", "dry-run-only-provider-trace")
);
const mediumRoleUse = runNode("scripts/create-tlcl-capability-provider-role-use-planner.mjs", [
  "--activation-validation",
  mediumActivationPath,
  "--status-refresh",
  statusRefresh.refreshPath,
  "--requested-role",
  "medium_reasoning_runtime",
  "--out-dir",
  join(smokeRoot, "provider-role-use")
]);
const runtimeGate = runNode("scripts/create-tlcl-runtime-gate.mjs", [
  "--goal",
  "allow-medium-dry-run-only-runner",
  "--status-refresh",
  statusRefresh.refreshPath,
  "--validation-report",
  validationReportPath,
  "--provider-role-use-plan",
  mediumRoleUse.planPath,
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
  "medium runtime dry-run-only runner smoke",
  "--runtime-gate",
  runtimeGate.gatePath,
  "--spatial-route-bridge",
  spatialRoutePath,
  "--out-dir",
  join(smokeRoot, "prep")
]);
const prepBuilder = runNode("scripts/create-tlcl-medium-runtime-dry-run-prep-review-receipt-builder.mjs", [
  "--goal",
  "teacher reviews medium dry-run prep before runner smoke",
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
  blockedActionsConfirmed: true
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
  "create route review handoff before runner smoke",
  "--validation",
  prepValidation.validationPath,
  "--prep",
  prepResult.prepPath,
  "--out-dir",
  join(smokeRoot, "route-handoff")
]);
const routeBuilder = runNode("scripts/create-tlcl-medium-runtime-dry-run-route-review-receipt-builder.mjs", [
  "--goal",
  "teacher reviews route handoff before runner smoke",
  "--handoff",
  routeHandoff.handoffPath,
  "--out-dir",
  join(smokeRoot, "route-builder")
]);
const routeReceiptPath = writeJson(join(smokeRoot, "route-approve-receipt.json"), {
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
const readyRun = runNode("scripts/run-tlcl-medium-runtime-dry-run-only-runner.mjs", [
  "--validation",
  routeValidation.validationPath,
  "--out-dir",
  join(smokeRoot, "runner")
]);
const prepPacket = readJson(prepResult.prepPath);
const routeHandoffPacket = readJson(routeHandoff.handoffPath);
const routeValidationPacket = readJson(routeValidation.validationPath);
const readyPacket = readJson(readyRun.runPath);
const readyReceipt = readJson(readyRun.receiptPath);
const blockedValidationPath = writeJson(join(smokeRoot, "blocked-route-validation.json"), {
  ...readJson(routeValidation.validationPath),
  status: "needs_teacher_review_or_more_route_evidence",
  readyForDryRunOnlyRunner: false
});
const blockedRun = runNode("scripts/run-tlcl-medium-runtime-dry-run-only-runner.mjs", [
  "--validation",
  blockedValidationPath,
  "--out-dir",
  join(smokeRoot, "blocked-runner")
]);

const checks = [
  check(
    "TLCL dry-run-only runner records evidence from a ready route review validation",
    readyRun.format === "transparent_ai_tlcl_medium_runtime_dry_run_only_runner_result_v1" &&
      readyRun.status === "dry_run_only_runner_completed_waiting_for_teacher_review" &&
      readyRun.dryRunExecuted === true &&
      readyRun.runnerExecuted === true &&
      readyRun.adapterInvoked === false &&
      readyRun.targetSoftwareCommandsExecuted === false,
    readyRun.runPath
  ),
  check(
    "TLCL dry-run-only runner preserves provider role-use trace from prep through route review",
    prepPacket.sourceEvidence.providerRoleUsePlan.providerRoleUsePlanHash.startsWith("sha256:") &&
      prepPacket.sourceEvidence.providerRoleUsePlan.providerRoleUsePlanHash ===
      routeHandoffPacket.sourceEvidence.providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      routeHandoffPacket.sourceEvidence.providerRoleUsePlanTrace.providerRoleUsePlanHash ===
        routeValidationPacket.sourceEvidence.providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      routeValidationPacket.sourceEvidence.providerRoleUsePlanTrace.providerRoleUsePlanHash ===
        readyPacket.sourceEvidence.providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyPacket.simulatedDryRunEvidence.providerRoleUsePlanTrace.providerRoleUsePlanHash ===
        prepPacket.sourceEvidence.providerRoleUsePlan.providerRoleUsePlanHash,
    readyRun.runPath
  ),
  check(
    "TLCL dry-run-only runner packet preserves no-execution locks",
    readyPacket.format === "transparent_ai_tlcl_medium_runtime_dry_run_only_run_v1" &&
      readyPacket.simulatedDryRunEvidence.adapterInvoked === false &&
      readyPacket.simulatedDryRunEvidence.targetSoftwareCommandsExecuted === false &&
      readyPacket.locks.doesNotInvokeAdapter === true &&
      readyPacket.locks.noTargetSoftwareCommands === true,
    readyRun.runPath
  ),
  check(
    "TLCL dry-run-only runner receipt keeps memory, rules, packaging, and completion locked",
    readyReceipt.format === "transparent_ai_tlcl_medium_runtime_dry_run_only_run_receipt_v1" &&
      readyReceipt.memoryWritten === false &&
      readyReceipt.ruleEnabled === false &&
      readyReceipt.packagingGated === true &&
      readyReceipt.accepted === false,
    readyRun.receiptPath
  ),
  check(
    "TLCL dry-run-only runner blocks unready route review validation",
    blockedRun.status === "blocked_before_dry_run_only_runner" &&
      blockedRun.dryRunExecuted === false &&
      blockedRun.runnerExecuted === false &&
      blockedRun.targetSoftwareCommandsExecuted === false,
    blockedRun.receiptPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_dry_run_only_runner_smoke_v1",
  smokeRoot,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
