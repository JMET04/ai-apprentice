#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-medium-runtime-dry-run-prep-smoke", String(Date.now()));
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
        capabilitySummary: "Smoke provider card for medium dry-run prep role-use trace validation."
      },
      providerRole: role,
      providerQualifiedForTlclRole: true,
      providerEnabledForTlclRole: true,
      roleScopedAllowedUse: ["prepare only TLCL-gated medium-runtime work after runtime gates"],
      stillRequires: [
        "TLCL status refresh or current contract evidence",
        "deterministic validators for the specific workflow",
        "runtime gate before medium-runtime work",
        "teacher-reviewed approval gate before target software execution",
        "retained rollback before any system change"
      ],
      forbiddenUse: [
        "self approval",
        "contract bypass",
        "ungated target software execution",
        "memory writes without teacher review",
        "packaging unlock"
      ]
    }
  };
}

const statusRefresh = runNode("scripts/create-tlcl-status-refresh.mjs", [
  "--goal",
  "smoke-tlcl-medium-runtime-dry-run-prep",
  "--out-dir",
  join(smokeRoot, "status")
]);
const validationReportPath = writeJson(join(smokeRoot, "passing-validation-report.json"), {
  validation_id: "val.smoke.medium.prep",
  artifact_id: "artifact.smoke.medium.prep",
  rule_package_id: "ruleset.smoke.medium.prep",
  status: "pass",
  delivery_allowed: true,
  created_at: new Date().toISOString(),
  summary: { pass: 1, fail: 0, unknown: 0, skipped: 0, error: 0 },
  results: [
    {
      rule_id: "rule.smoke.medium.prep",
      rule_version: "0.1.0",
      lifecycle: "active",
      severity: "blocking",
      status: "pass",
      validator: "expression",
      message: "passed",
      artifact_id: "artifact.smoke.medium.prep"
    }
  ],
  hashes: { artifact_hash: "sha256:medium-prep", rule_package_hash: "sha256:rules" }
});
const mediumActivationPath = writeJson(
  join(smokeRoot, "medium-runtime-provider-activation-validation.json"),
  activationValidation("medium_reasoning_runtime", "medium-prep-provider-trace")
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
  "allow-medium-dry-run-prep",
  "--status-refresh",
  statusRefresh.refreshPath,
  "--validation-report",
  validationReportPath,
  "--provider-role-use-plan",
  mediumRoleUse.planPath,
  "--out-dir",
  join(smokeRoot, "runtime-gate")
]);
const blockedGate = runNode("scripts/create-tlcl-runtime-gate.mjs", [
  "--goal",
  "teacher-correction-blocks-medium-prep",
  "--status-refresh",
  statusRefresh.refreshPath,
  "--validation-report",
  validationReportPath,
  "--teacher-correction",
  "Wrong numbered target; repair the contract before another dry-run.",
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
const knowledgeBridgePath = writeJson(join(smokeRoot, "knowledge-spatial-bridge.json"), {
  format: "transparent_ai_knowledge_augmented_spatial_execution_bridge_v1",
  status: "ready_for_teacher_reviewed_dry_run_route",
  counts: { routeCandidates: 1, reviewRows: 1, rulesEnabled: 0, softwareActionsExecuted: 0 },
  reviewRows: [
    {
      retrievedChunkRefs: ["chunk.manual.001"],
      nextAllowedAction: "teacher_review_then_dry_run_route_only",
      blockedUntilTeacherReview: ["execute_software", "enable_rule", "write_memory"]
    }
  ],
  locks: { softwareActionsExecuted: false, packagingGated: true }
});

const readyResult = runNode("scripts/create-tlcl-medium-runtime-dry-run-prep.mjs", [
  "--goal",
  "medium runtime prepares reviewed dry-run only",
  "--software",
  "example CAD",
  "--runtime-gate",
  runtimeGate.gatePath,
  "--spatial-route-bridge",
  spatialRoutePath,
  "--knowledge-augmented-spatial-bridge",
  knowledgeBridgePath,
  "--out-dir",
  join(smokeRoot, "prep")
]);
const missingRouteResult = runNode("scripts/create-tlcl-medium-runtime-dry-run-prep.mjs", [
  "--goal",
  "medium runtime waits for route evidence",
  "--runtime-gate",
  runtimeGate.gatePath,
  "--out-dir",
  join(smokeRoot, "prep")
]);
const blockedResult = runNode("scripts/create-tlcl-medium-runtime-dry-run-prep.mjs", [
  "--goal",
  "blocked runtime cannot prep dry-run",
  "--runtime-gate",
  blockedGate.gatePath,
  "--spatial-route-bridge",
  spatialRoutePath,
  "--out-dir",
  join(smokeRoot, "prep")
]);

const readyPacket = readJson(readyResult.prepPath);
const runtimeGatePacket = readJson(runtimeGate.gatePath);
const missingRoutePacket = readJson(missingRouteResult.prepPath);
const blockedPacket = readJson(blockedResult.prepPath);

const checks = [
  check(
    "TLCL medium runtime dry-run prep accepts only allowed runtime gate plus route evidence",
    readyPacket.format === "transparent_ai_tlcl_medium_runtime_dry_run_prep_v1" &&
      readyPacket.status === "medium_runtime_dry_run_prep_ready_for_teacher_review" &&
      readyPacket.dryRunPreparation.canPrepareDryRun === true &&
      readyPacket.dryRunPreparation.routeCandidateCount === 1 &&
      readyPacket.dryRunPreparation.knowledgeReviewRowCount === 1,
    readyResult.prepPath
  ),
  check(
    "Medium runtime dry-run prep inherits accepted provider role-use plan hash from runtime gate",
    readyPacket.sourceEvidence.providerRoleUsePlan.accepted === true &&
      readyPacket.sourceEvidence.providerRoleUsePlan.providerRole === "medium_reasoning_runtime" &&
      readyPacket.sourceEvidence.providerRoleUsePlan.providerRoleUsePlanHash ===
        runtimeGatePacket.evidence.hashes.providerRoleUsePlanHash &&
      readyPacket.dryRunPreparation.providerRoleUsePlanAccepted === true &&
      readyPacket.dryRunPreparation.providerRoleUsePlanHash === runtimeGatePacket.evidence.hashes.providerRoleUsePlanHash,
    readyResult.prepPath
  ),
  check(
    "Medium runtime dry-run prep cannot execute software or enable rules",
    readyPacket.dryRunPreparation.canExecuteTargetSoftware === false &&
      readyPacket.locks.noSoftwareExecution === true &&
      readyPacket.locks.noRuleEnablement === true &&
      readyPacket.locks.noMemoryWrite === true &&
      readyPacket.locks.noCompletionClaim === true,
    readyResult.prepPath
  ),
  check(
    "Medium runtime dry-run prep waits when teacher-confirmed route evidence is missing",
    missingRoutePacket.status === "waiting_for_teacher_confirmed_route_evidence" &&
      missingRoutePacket.escalationPacket.triggers.includes("missing_teacher_confirmed_dry_run_route_evidence") &&
      missingRoutePacket.dryRunPreparation.canPrepareDryRun === false,
    missingRouteResult.prepPath
  ),
  check(
    "Teacher correction or blocked TLCL gate returns dry-run prep to senior compile",
    blockedPacket.status === "blocked_escalate_to_senior_compile" &&
      blockedPacket.escalationPacket.triggers.includes("tlcl_runtime_gate_not_medium_runtime_allowed") &&
      blockedPacket.dryRunPreparation.canPrepareDryRun === false,
    blockedResult.prepPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_dry_run_prep_smoke_v1",
  smokeRoot,
  providerRoleUsePlanPath: mediumRoleUse.planPath,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
