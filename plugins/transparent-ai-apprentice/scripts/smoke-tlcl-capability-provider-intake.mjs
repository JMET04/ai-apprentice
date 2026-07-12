#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-capability-provider-intake-smoke", String(Date.now()));

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
  "smoke-tlcl-capability-provider-intake",
  "--out-dir",
  smokeRoot
]);

const distilled = runNode("scripts/create-tlcl-capability-provider-intake.mjs", [
  "--status-refresh",
  statusRefresh.refreshPath,
  "--provider-name",
  "example-distilled-drafting-skill",
  "--provider-kind",
  "distilled_skill",
  "--requested-role",
  "low_reasoning_tool",
  "--capability-summary",
  "Extracts fields and fills templates under deterministic TLCL wrappers.",
  "--source-ref",
  "local-demo-skill",
  "--out-dir",
  smokeRoot
]);
const distilledPacket = readJson(distilled.intakePath);

const strongModel = runNode("scripts/create-tlcl-capability-provider-intake.mjs", [
  "--status-refresh",
  statusRefresh.refreshPath,
  "--provider-name",
  "example-strong-reasoning-model",
  "--provider-kind",
  "strong_foundation_model",
  "--requested-role",
  "senior_reasoning_compile",
  "--capability-summary",
  "Compiles teacher corrections into disabled Rule Cards and regression tests.",
  "--source-ref",
  "model-card-demo",
  "--out-dir",
  smokeRoot
]);
const strongPacket = readJson(strongModel.intakePath);

const bypass = runNode("scripts/create-tlcl-capability-provider-intake.mjs", [
  "--status-refresh",
  statusRefresh.refreshPath,
  "--provider-name",
  "unsafe-autonomous-provider",
  "--provider-kind",
  "distilled_skill",
  "--requested-role",
  "medium_reasoning_runtime",
  "--capability-summary",
  "Claims it can execute and save work without teacher gates.",
  "--claims-self-approval",
  "--claims-contract-bypass",
  "--claims-can-execute-without-gate",
  "--claims-can-write-memory-without-teacher-review",
  "--claims-can-unlock-packaging",
  "--out-dir",
  smokeRoot
]);
const bypassPacket = readJson(bypass.intakePath);

const invalidRole = runNode("scripts/create-tlcl-capability-provider-intake.mjs", [
  "--status-refresh",
  statusRefresh.refreshPath,
  "--provider-name",
  "invalid-role-provider",
  "--provider-kind",
  "open_source_model",
  "--requested-role",
  "unbounded_autonomous_agent",
  "--capability-summary",
  "Requests a role outside TLCL.",
  "--out-dir",
  smokeRoot
]);
const invalidRolePacket = readJson(invalidRole.intakePath);

const checks = [
  check(
    "Distilled skill enters only teacher-review provider intake",
    distilled.status === "tlcl_capability_provider_candidate_waiting_for_teacher_review" &&
      distilled.mayEnterTeacherReview === true &&
      distilledPacket.provider.kind === "distilled_skill" &&
      distilledPacket.provider.requestedRole === "low_reasoning_tool" &&
      distilledPacket.decision.mayBeUsedAsLowReasoningTool === false &&
      distilledPacket.locks.providerEnabled === false &&
      distilledPacket.locks.targetSoftwareCommandsExecuted === false,
    distilled.intakePath
  ),
  check(
    "Strong model enters only senior-compiler candidate review",
    strongModel.status === "tlcl_capability_provider_candidate_waiting_for_teacher_review" &&
      strongPacket.provider.kind === "strong_foundation_model" &&
      strongPacket.provider.requestedRole === "senior_reasoning_compile" &&
      strongPacket.decision.mayBeUsedAsSeniorCompiler === false &&
      strongPacket.locks.ruleEnabled === false &&
      strongPacket.locks.accepted === false,
    strongModel.intakePath
  ),
  check(
    "Provider bypass claims block intake before teacher review",
    bypass.status === "blocked_before_tlcl_capability_provider_teacher_review" &&
      bypassPacket.blockers.includes("provider_claims_self_approval") &&
      bypassPacket.blockers.includes("provider_claims_contract_bypass") &&
      bypassPacket.blockers.includes("provider_claims_target_execution_without_gate") &&
      bypassPacket.blockers.includes("provider_claims_memory_write_without_teacher_review") &&
      bypassPacket.blockers.includes("provider_claims_packaging_unlock") &&
      bypassPacket.decision.mayEnterTeacherReview === false &&
      bypassPacket.locks.providerEnabled === false,
    bypassPacket.blockers.join(",")
  ),
  check(
    "Unsupported provider role is blocked",
    invalidRole.status === "blocked_before_tlcl_capability_provider_teacher_review" &&
      invalidRolePacket.blockers.includes("unsupported_requested_provider_role") &&
      invalidRolePacket.decision.mayExecuteTargetSoftware === false &&
      invalidRolePacket.locks.memoryWritten === false,
    invalidRolePacket.blockers.join(",")
  ),
  check(
    "Capability provider intake preserves market response wrappers and no-action locks",
    distilledPacket.evidence.hashes.statusRefreshHash?.startsWith("sha256:") &&
      distilledPacket.requiredTeacherReview.forbiddenDecisions.includes("accepted") &&
      distilledPacket.requiredTeacherReview.forbiddenDecisions.includes("execution_allowed") &&
      distilledPacket.locks.reviewOnly === true &&
      distilledPacket.locks.packagingGated === true &&
      distilledPacket.locks.completionClaim === false,
    distilled.intakePath
  )
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_capability_provider_intake_smoke_v1",
  smokeRoot,
  statusRefreshPath: statusRefresh.refreshPath,
  distilledIntakePath: distilled.intakePath,
  strongModelIntakePath: strongModel.intakePath,
  bypassIntakePath: bypass.intakePath,
  invalidRoleIntakePath: invalidRole.intakePath,
  passed,
  total: checks.length,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
