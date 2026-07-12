#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-runtime-gate-provider-role-plan-smoke", String(Date.now()));
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
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
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
        kind: role === "medium_reasoning_runtime" ? "strong_foundation_model" : "distilled_skill",
        requestedRole: role,
        capabilitySummary: "Smoke provider card for role-scoped runtime gate validation."
      },
      providerRole: role,
      providerQualifiedForTlclRole: true,
      providerEnabledForTlclRole: true,
      roleScopedAllowedUse:
        role === "medium_reasoning_runtime"
          ? ["prepare or run only TLCL-gated medium-runtime work after runtime gates"]
          : ["perform fixed transforms and metadata work under checked inputs"],
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

const status = runNode("scripts/create-tlcl-status-refresh.mjs", [
  "--goal",
  "smoke-tlcl-runtime-gate-provider-role-plan",
  "--out-dir",
  join(smokeRoot, "status")
]);

const passingReportPath = writeJson(join(smokeRoot, "passing-validation-report.json"), {
  validation_id: "val.smoke.provider.plan.pass",
  artifact_id: "artifact.smoke.provider.plan",
  rule_package_id: "ruleset.smoke.provider.plan",
  status: "pass",
  delivery_allowed: true,
  created_at: new Date().toISOString(),
  summary: { pass: 1, fail: 0, unknown: 0, skipped: 0, error: 0 },
  results: [
    {
      rule_id: "rule.smoke.provider.plan.active",
      rule_version: "0.1.0",
      lifecycle: "active",
      severity: "blocking",
      status: "pass",
      validator: "expression",
      message: "passed",
      artifact_id: "artifact.smoke.provider.plan"
    }
  ],
  hashes: { artifact_hash: "sha256:provider-plan-pass", rule_package_hash: "sha256:rules" }
});

const mediumActivationPath = writeJson(
  join(smokeRoot, "medium-runtime-activation-validation.json"),
  activationValidation("medium_reasoning_runtime", "provider-plan-medium-runtime")
);
const lowActivationPath = writeJson(
  join(smokeRoot, "low-tool-activation-validation.json"),
  activationValidation("low_reasoning_tool", "provider-plan-low-tool")
);

const mediumRoleUse = runNode("scripts/create-tlcl-capability-provider-role-use-planner.mjs", [
  "--activation-validation",
  mediumActivationPath,
  "--status-refresh",
  status.refreshPath,
  "--requested-role",
  "medium_reasoning_runtime",
  "--out-dir",
  join(smokeRoot, "role-use")
]);
const lowRoleUse = runNode("scripts/create-tlcl-capability-provider-role-use-planner.mjs", [
  "--activation-validation",
  lowActivationPath,
  "--status-refresh",
  status.refreshPath,
  "--requested-role",
  "low_reasoning_tool",
  "--out-dir",
  join(smokeRoot, "role-use")
]);

const allowed = runNode("scripts/create-tlcl-runtime-gate.mjs", [
  "--goal",
  "provider-scoped-medium-runtime-allowed",
  "--status-refresh",
  status.refreshPath,
  "--validation-report",
  passingReportPath,
  "--provider-role-use-plan",
  mediumRoleUse.planPath,
  "--out-dir",
  join(smokeRoot, "gates")
]);
const wrongRoleBlocked = runNode("scripts/create-tlcl-runtime-gate.mjs", [
  "--goal",
  "low-tool-plan-cannot-enter-medium-runtime",
  "--status-refresh",
  status.refreshPath,
  "--validation-report",
  passingReportPath,
  "--provider-role-use-plan",
  lowRoleUse.planPath,
  "--out-dir",
  join(smokeRoot, "gates")
]);
const invalidPlanBlocked = runNode("scripts/create-tlcl-runtime-gate.mjs", [
  "--goal",
  "invalid-provider-plan-cannot-enter-runtime",
  "--status-refresh",
  status.refreshPath,
  "--validation-report",
  passingReportPath,
  "--provider-role-use-plan",
  passingReportPath,
  "--out-dir",
  join(smokeRoot, "gates")
]);

const allowedGate = readJson(allowed.gatePath);
const wrongRoleGate = readJson(wrongRoleBlocked.gatePath);
const invalidPlanGate = readJson(invalidPlanBlocked.gatePath);

const checks = [
  check(
    "Provider role plan mismatch escalates to senior compile",
    wrongRoleBlocked.status === "escalate_to_senior_compile" &&
      invalidPlanBlocked.status === "escalate_to_senior_compile",
    `${wrongRoleBlocked.gatePath}; ${invalidPlanBlocked.gatePath}`
  ),
  check(
    "Medium provider role-use plan is accepted by runtime gate",
    allowed.status === "medium_runtime_allowed" &&
      allowed.providerRoleUsePlanAccepted === true &&
      allowedGate.runtimePermission.providerRole === "medium_reasoning_runtime" &&
      allowedGate.runtimePermission.canPrepareReviewedDryRun === true,
    allowed.gatePath
  ),
  check(
    "Runtime gate preserves no execution no memory no packaging locks with provider plan",
    allowedGate.runtimePermission.canExecuteTargetSoftware === false &&
      allowedGate.runtimePermission.canWriteMemory === false &&
      allowedGate.locks.noPackagingUnlock === true,
    allowed.gatePath
  ),
  check(
    "Low-reasoning tool role-use plan cannot enter medium runtime gate",
    wrongRoleBlocked.status === "escalate_to_senior_compile" &&
      wrongRoleBlocked.triggers.includes("provider_role_use_plan_not_medium_runtime") &&
      wrongRoleGate.runtimePermission.providerRoleUsePlanAccepted === false,
    wrongRoleBlocked.gatePath
  ),
  check(
    "Invalid provider role-use source fails closed before runtime",
    invalidPlanBlocked.status === "escalate_to_senior_compile" &&
      invalidPlanBlocked.triggers.includes("invalid_provider_role_use_plan") &&
      invalidPlanGate.runtimePermission.canPrepareReviewedDryRun === false,
    invalidPlanBlocked.gatePath
  ),
  check(
    "Provider role-use evidence is hashed into the runtime gate",
    typeof allowedGate.evidence.hashes.providerRoleUsePlanHash === "string" &&
      allowedGate.evidence.hashes.providerRoleUsePlanHash.startsWith("sha256:"),
    allowed.gatePath
  )
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_runtime_gate_provider_role_plan_smoke_v1",
  smokeRoot,
  mediumRoleUsePlanPath: mediumRoleUse.planPath,
  lowRoleUsePlanPath: lowRoleUse.planPath,
  allowedGatePath: allowed.gatePath,
  wrongRoleGatePath: wrongRoleBlocked.gatePath,
  invalidPlanGatePath: invalidPlanBlocked.gatePath,
  passed,
  total: checks.length,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
