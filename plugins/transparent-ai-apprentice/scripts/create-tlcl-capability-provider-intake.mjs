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

function hasFlag(name) {
  return process.argv.includes(name);
}

function slug(value) {
  return (
    String(value || "tlcl-capability-provider-intake")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-capability-provider-intake"
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

const allowedProviderKinds = new Set(["strong_foundation_model", "distilled_skill", "open_source_model", "local_tool"]);
const allowedRoles = new Set(["senior_reasoning_compile", "medium_reasoning_runtime", "low_reasoning_tool"]);

const goal = argValue("--goal", "tlcl-capability-provider-intake");
const statusRefreshPath = argValue("--status-refresh", "");
const providerName = argValue("--provider-name", "unnamed-provider");
const providerKind = argValue("--provider-kind", "distilled_skill");
const requestedRole = argValue("--requested-role", "low_reasoning_tool");
const capabilitySummary = argValue("--capability-summary", "");
const sourceRef = argValue("--source-ref", "");
const outRoot = resolve(argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-capability-provider-intakes")));
const intakeDir = join(outRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(providerName)}`);
const intakePath = join(intakeDir, "tlcl-capability-provider-intake.json");

const claims = {
  claimsSelfApproval: hasFlag("--claims-self-approval"),
  claimsContractBypass: hasFlag("--claims-contract-bypass"),
  claimsCanEnableRules: hasFlag("--claims-can-enable-rules"),
  claimsCanExecuteWithoutGate: hasFlag("--claims-can-execute-without-gate"),
  claimsCanWriteMemoryWithoutTeacherReview: hasFlag("--claims-can-write-memory-without-teacher-review"),
  claimsCanUnlockPackaging: hasFlag("--claims-can-unlock-packaging")
};

const blockers = [];
const evidence = {
  statusRefreshPath: statusRefreshPath ? resolve(statusRefreshPath) : "",
  hashes: {}
};

let statusRefresh = null;
let marketResponsePolicy = null;

if (!statusRefreshPath || !existsSync(resolve(statusRefreshPath))) {
  addBlocker(blockers, "missing_tlcl_status_refresh");
} else {
  statusRefresh = readJson(statusRefreshPath);
  evidence.hashes.statusRefreshHash = sha256Object(statusRefresh);
  marketResponsePolicy = statusRefresh.marketResponsePolicy || null;
  if (statusRefresh.format !== "transparent_ai_tlcl_status_refresh_v1") addBlocker(blockers, "invalid_tlcl_status_refresh_format");
  if (statusRefresh.status !== "ready_for_teacher_review") addBlocker(blockers, "tlcl_status_refresh_not_ready_for_review");
  if (!marketResponsePolicy || marketResponsePolicy.format !== "transparent_ai_tlcl_market_response_policy_v1") {
    addBlocker(blockers, "missing_tlcl_market_response_policy");
  }
}

if (!allowedProviderKinds.has(providerKind)) addBlocker(blockers, "unsupported_provider_kind");
if (!allowedRoles.has(requestedRole)) addBlocker(blockers, "unsupported_requested_provider_role");
if (!providerName.trim()) addBlocker(blockers, "missing_provider_name");
if (!capabilitySummary.trim()) addBlocker(blockers, "missing_capability_summary_for_teacher_review");

if (marketResponsePolicy) {
  if (!Array.isArray(marketResponsePolicy.providerRoles) || !marketResponsePolicy.providerRoles.includes(requestedRole)) {
    addBlocker(blockers, "requested_role_not_allowed_by_market_response_policy");
  }
  const wrappers = new Set(marketResponsePolicy.requiredWrappers || []);
  for (const wrapper of ["Rule DSL", "deterministic validators", "approval gates", "rollback points", "teacher-reviewed evidence"]) {
    if (!wrappers.has(wrapper)) addBlocker(blockers, `missing_required_wrapper_${slug(wrapper)}`);
  }
}

if (claims.claimsSelfApproval) addBlocker(blockers, "provider_claims_self_approval");
if (claims.claimsContractBypass) addBlocker(blockers, "provider_claims_contract_bypass");
if (claims.claimsCanEnableRules) addBlocker(blockers, "provider_claims_rule_enablement");
if (claims.claimsCanExecuteWithoutGate) addBlocker(blockers, "provider_claims_target_execution_without_gate");
if (claims.claimsCanWriteMemoryWithoutTeacherReview) addBlocker(blockers, "provider_claims_memory_write_without_teacher_review");
if (claims.claimsCanUnlockPackaging) addBlocker(blockers, "provider_claims_packaging_unlock");

const status = blockers.length
  ? "blocked_before_tlcl_capability_provider_teacher_review"
  : "tlcl_capability_provider_candidate_waiting_for_teacher_review";

const providerIntake = {
  format: "transparent_ai_tlcl_capability_provider_intake_v1",
  intakeId: `tlcl-capability-provider-intake.${new Date().toISOString().replace(/[:.]/g, "-")}`,
  goal,
  createdAt: new Date().toISOString(),
  status,
  provider: {
    name: providerName,
    kind: providerKind,
    requestedRole,
    capabilitySummary,
    sourceRef
  },
  claims,
  blockers,
  decision: {
    mayEnterTeacherReview: blockers.length === 0,
    mayBeUsedAsSeniorCompiler: false,
    mayBeUsedAsMediumRuntime: false,
    mayBeUsedAsLowReasoningTool: false,
    mayEnableRules: false,
    mayExecuteTargetSoftware: false,
    mayWriteMemory: false,
    mayUnlockPackaging: false,
    mayClaimAcceptance: false
  },
  requiredTeacherReview: {
    reviewPrompt:
      "Decide whether this provider should remain a candidate for the requested TLCL role, be rejected, or be sent back for more evidence.",
    allowedDecisions: ["needs_more_evidence", "candidate_for_role_review", "rejected"],
    forbiddenDecisions: ["accepted", "enabled", "packaging_unlocked", "execution_allowed"]
  },
  nextActions:
    blockers.length === 0
      ? [
          "Teacher reviews provider capability evidence and role fit.",
          "If retained, create a separate qualification test packet before any runtime use.",
          "Keep provider disabled until Rule DSL, validators, approval gates, rollback points, and teacher receipts cover its role."
        ]
      : [
          "Do not send this provider into role qualification.",
          "Fix or reject the blocked provider claim before another intake.",
          "Do not use the provider for execution, memory, rule enablement, acceptance, or packaging."
        ],
  evidence,
  locks: {
    reviewOnly: true,
    providerEnabled: false,
    ruleEnabled: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    accepted: false,
    packagingGated: true,
    packagingUnlocked: false,
    completionClaim: false
  },
  paths: {
    intake: intakePath
  }
};

writeJson(intakePath, providerIntake);
console.log(
  JSON.stringify(
    {
      status,
      intakePath,
      blockers,
      mayEnterTeacherReview: providerIntake.decision.mayEnterTeacherReview
    },
    null,
    2
  )
);
