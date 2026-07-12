#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-provider-role-use-plan")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-provider-role-use-plan"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function addBlocker(blockers, blocker) {
  if (!blockers.includes(blocker)) blockers.push(blocker);
}

function locks(providerRoleUseAllowed = false) {
  return {
    reviewOnly: true,
    roleUsePlanOnly: true,
    providerRoleUseAllowed,
    providerMayBypassTlcl: false,
    providerMayExecuteTargetSoftware: false,
    providerMayWriteMemory: false,
    providerMayUnlockPackaging: false,
    providerMayClaimAcceptance: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    packagingUnlocked: false,
    completionClaim: false
  };
}

function roleGateFor(role) {
  if (role === "senior_reasoning_compile") {
    return {
      nextGate: "high_reasoning_contract_compile_or_repair_review",
      allowedRuntimeBoundary:
        "May prepare disabled Rule Cards, Rule DSL proposals, repair plans, and validator regression packages only after current TLCL evidence is attached.",
      forbiddenRuntimeBoundary:
        "May not self-approve, enable rules, execute target software, write long-term memory, unlock packaging, or claim technology acceptance."
    };
  }
  if (role === "medium_reasoning_runtime") {
    return {
      nextGate: "tlcl_runtime_gate_before_medium_runtime",
      allowedRuntimeBoundary:
        "May enter only TLCL runtime gates that have current status evidence, deterministic validation evidence, teacher review, and retained rollback.",
      forbiddenRuntimeBoundary:
        "May not change active rules, bypass validators, infer missing contract logic, execute target software without an approval gate, or treat corrections as already repaired."
    };
  }
  if (role === "low_reasoning_tool") {
    return {
      nextGate: "fixed_transform_input_schema_gate",
      allowedRuntimeBoundary:
        "May perform fixed transforms only when inputs match schema, expected fields are present, and failures return unknown_blocked.",
      forbiddenRuntimeBoundary:
        "May not infer new rules, make judgment calls, approve risky actions, or override medium or senior reasoning."
    };
  }
  return {
    nextGate: "teacher_review_for_unknown_provider_role",
    allowedRuntimeBoundary: "Unknown roles require another teacher review before any TLCL use.",
    forbiddenRuntimeBoundary: "Unknown roles may not enter runtime, memory, packaging, or acceptance paths."
  };
}

function statusRefreshSupportsRole(statusRefresh, role) {
  const tiers = statusRefresh?.reasoningTierContract?.tiers;
  return Array.isArray(tiers) && tiers.some((tier) => tier.id === role);
}

const goal = argValue("--goal", "Create TLCL capability provider role use plan");
const activationValidationArg = argValue(
  "--activation-validation",
  argValue("--validation", argValue("--activation", ""))
);
const statusRefreshArg = argValue("--status-refresh", argValue("--status", ""));
const requestedRoleArg = argValue("--requested-role", argValue("--role", ""));
const useIntent = argValue("--use-intent", "prepare role-scoped TLCL provider use for the next gate");
const outRoot = resolve(
  argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-capability-provider-role-use-plans"))
);

const blockers = [];
const activationValidationPath = activationValidationArg ? resolve(activationValidationArg) : "";
const statusRefreshPath = statusRefreshArg ? resolve(statusRefreshArg) : "";
let activationValidation = null;
let statusRefresh = null;

if (!activationValidationArg || !existsSync(activationValidationPath)) {
  addBlocker(blockers, "missing_activation_validation");
} else {
  activationValidation = readJson(activationValidationPath);
  if (activationValidation.format !== "transparent_ai_tlcl_capability_provider_activation_validation_v1") {
    addBlocker(blockers, "invalid_activation_validation_format");
  }
  if (activationValidation.status !== "tlcl_capability_provider_role_approved_waiting_for_gated_use") {
    addBlocker(blockers, "activation_validation_not_role_approved");
  }
  if (activationValidation.providerEnabledForTlclRole !== true) {
    addBlocker(blockers, "provider_not_enabled_for_tlcl_role");
  }
  if (activationValidation.locks?.providerMayBypassTlcl !== false) {
    addBlocker(blockers, "activation_validation_bypass_lock_missing");
  }
}

if (!statusRefreshArg || !existsSync(statusRefreshPath)) {
  addBlocker(blockers, "missing_status_refresh");
} else {
  statusRefresh = readJson(statusRefreshPath);
  if (statusRefresh.format !== "transparent_ai_tlcl_status_refresh_v1") {
    addBlocker(blockers, "invalid_status_refresh_format");
  }
  if (statusRefresh.status !== "ready_for_teacher_review") {
    addBlocker(blockers, "status_refresh_not_ready_for_teacher_review");
  }
  if (
    statusRefresh.locks?.noSoftwareExecution !== true ||
    statusRefresh.locks?.noRuleEnablement !== true ||
    statusRefresh.locks?.noMemoryWrite !== true ||
    statusRefresh.locks?.noPackagingUnlock !== true
  ) {
    addBlocker(blockers, "status_refresh_locks_not_preserved");
  }
}

const providerCapabilityCard = activationValidation?.providerCapabilityCard || null;
if (!providerCapabilityCard) {
  addBlocker(blockers, "missing_provider_capability_card");
} else {
  if (providerCapabilityCard.format !== "transparent_ai_tlcl_capability_provider_card_v1") {
    addBlocker(blockers, "invalid_provider_capability_card_format");
  }
  if (providerCapabilityCard.providerQualifiedForTlclRole !== true) {
    addBlocker(blockers, "provider_card_not_qualified_for_role");
  }
  if (providerCapabilityCard.providerEnabledForTlclRole !== true) {
    addBlocker(blockers, "provider_card_not_enabled_for_role");
  }
  if (Array.isArray(providerCapabilityCard.forbiddenUse) && providerCapabilityCard.forbiddenUse.includes("contract bypass") === false) {
    addBlocker(blockers, "provider_card_missing_contract_bypass_forbidden_use");
  }
}

const providerRole = providerCapabilityCard?.providerRole || activationValidation?.providerRole || "unknown_role";
const requestedRole = requestedRoleArg || providerRole;
const roleMatches = providerRole === requestedRole;
if (!roleMatches) addBlocker(blockers, "requested_role_does_not_match_provider_card_role");
if (statusRefresh && !statusRefreshSupportsRole(statusRefresh, providerRole)) addBlocker(blockers, "status_refresh_missing_provider_role_tier");

const gate = roleGateFor(providerRole);
const providerRoleUseAllowed = blockers.length === 0;
const roleMismatch =
  blockers.includes("requested_role_does_not_match_provider_card_role") &&
  Boolean(providerCapabilityCard) &&
  !blockers.includes("invalid_activation_validation_format");
const status = providerRoleUseAllowed
  ? "tlcl_capability_provider_role_use_ready_for_runtime_gate"
  : roleMismatch
    ? "tlcl_capability_provider_role_use_blocked_role_mismatch"
    : "blocked_before_tlcl_capability_provider_role_use_plan";

const planDir = join(outRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`);
const planPath = join(planDir, "tlcl-capability-provider-role-use-plan.json");
const readmePath = join(planDir, "TLCL_CAPABILITY_PROVIDER_ROLE_USE_PLAN_START_HERE.md");
const activationValidationHash = activationValidation ? sha256Object(activationValidation) : "";
const statusRefreshHash = statusRefresh ? sha256Object(statusRefresh) : "";

const highReasoningRepairHandoff = !providerRoleUseAllowed
  ? {
      kind: "high_reasoning_provider_role_use_repair_handoff",
      transition: roleMismatch
        ? "provider_role_use_mismatch_to_high_reasoning_repair"
        : "provider_role_use_blocked_to_high_reasoning_repair",
      providerRole,
      requestedRole,
      blockers,
      evidenceToInspect: [activationValidationPath, statusRefreshPath].filter(Boolean),
      repairTasks: [
        "Inspect the activation validation, provider card, and current TLCL status refresh.",
        "Repair the provider role boundary, missing status evidence, or activation review before retrying role-use planning.",
        "Do not pass this provider to runtime, memory, packaging, or acceptance paths until a new role-use plan passes."
      ]
    }
  : null;

const plan = {
  ok: true,
  format: "transparent_ai_tlcl_capability_provider_role_use_plan_v1",
  planId: `tlcl-capability-provider-role-use-plan.${new Date().toISOString().replace(/[:.]/g, "-")}`,
  createdAt: new Date().toISOString(),
  goal,
  status,
  providerRoleUseAllowed,
  providerRole,
  requestedRole,
  roleMatches,
  useIntent,
  provider: providerCapabilityCard?.provider || activationValidation?.provider || {},
  providerUseScope: providerRoleUseAllowed ? providerCapabilityCard.roleScopedAllowedUse || [] : [],
  roleGate: gate,
  requiredBeforeUse: providerRoleUseAllowed
    ? [
        ...(providerCapabilityCard.stillRequires || []),
        "this role use plan must feed the next TLCL gate",
        "next gate must re-check deterministic validation evidence and rollback retention",
        "teacher correction must return to senior reasoning compile repair"
      ]
    : [],
  forbiddenUse: [
    ...(providerCapabilityCard?.forbiddenUse || []),
    "cross-role provider use",
    "provider self-approval",
    "runtime execution from role-use plan alone"
  ],
  blockers,
  locks: locks(providerRoleUseAllowed),
  highReasoningRepairHandoff,
  source: {
    activationValidationPath,
    activationValidationHash,
    statusRefreshPath,
    statusRefreshHash
  },
  outputs: {
    planPath,
    readmePath
  }
};

const readme = `# TLCL Capability Provider Role Use Plan

Status: ${status}

This packet decides whether a teacher-approved capability provider card can be passed to the next TLCL gate for its exact role.

- Provider role: ${providerRole}
- Requested role: ${requestedRole}
- Role use allowed: ${providerRoleUseAllowed}
- Next gate: ${gate.nextGate}
- Target software executed: false
- Memory written: false
- Packaging unlocked: false
- Acceptance claimed: false

## Evidence

- Activation validation: ${activationValidationPath || "missing"}
- Status refresh: ${statusRefreshPath || "missing"}

## Blockers

${blockers.length ? blockers.map((blocker) => `- ${blocker}`).join("\n") : "- none"}
`;

writeJson(planPath, plan);
writeFileSync(readmePath, readme, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_capability_provider_role_use_plan_result_v1",
      status,
      providerRoleUseAllowed,
      providerRole,
      requestedRole,
      roleMatches,
      blockers,
      nextGate: gate.nextGate,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      accepted: false,
      packagingUnlocked: false,
      planPath,
      readmePath
    },
    null,
    2
  )
);
