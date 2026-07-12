#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-status-refresh-smoke", String(Date.now()));

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

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const result = runNode("scripts/create-tlcl-status-refresh.mjs", [
  "--goal",
  "smoke-tlcl-status-refresh",
  "--out-dir",
  smokeRoot
]);
const refresh = readJson(result.refreshPath);
const contract = readJson(result.reasoningTierContractPath);

const checks = [
  check("TLCL status refresh writes machine-readable packet", refresh.format === "transparent_ai_tlcl_status_refresh_v1", result.refreshPath),
  check("Reasoning tier contract uses highest tier for compile", contract.routing_policy.compile_tier === "senior_reasoning_compile", result.reasoningTierContractPath),
  check("Reasoning tier contract uses medium tier for default runtime", contract.routing_policy.default_runtime_tier === "medium_reasoning_runtime", result.reasoningTierContractPath),
  check("Teacher correction escalates back to senior reasoning", contract.escalation_policy.triggers.includes("teacher_correction") && contract.escalation_policy.escalates_to === "senior_reasoning_compile", result.reasoningTierContractPath),
  check("Validator remains judgment authority", contract.routing_policy.validation_authority === "deterministic_validator", result.reasoningTierContractPath),
  check("Runtime cannot enable rules or bypass teacher review", contract.locks.runtimeMayEnableRules === false && contract.locks.runtimeMayBypassTeacherReview === false, result.reasoningTierContractPath),
  check("RAG direction is tracked as external evidence layer", refresh.requiredConcepts.some((item) => item.id === "rag_external_knowledge_retriever" && item.ready), result.refreshPath),
  check("Foundation model response strategy is tracked", refresh.requiredConcepts.some((item) => item.id === "foundation_model_response" && item.ready), result.refreshPath),
  check("Skill distillation response strategy is tracked", refresh.requiredConcepts.some((item) => item.id === "skill_distillation_response" && item.ready), result.refreshPath),
  check(
    "Market response treats distilled skills and stronger models as wrapped providers",
    refresh.marketResponsePolicy?.format === "transparent_ai_tlcl_market_response_policy_v1" &&
      refresh.marketResponsePolicy.providerRoles.includes("senior_reasoning_compile") &&
      refresh.marketResponsePolicy.providerRoles.includes("medium_reasoning_runtime") &&
      refresh.marketResponsePolicy.providerRoles.includes("low_reasoning_tool") &&
      refresh.marketResponsePolicy.requiredWrappers.includes("Rule DSL") &&
      refresh.marketResponsePolicy.requiredWrappers.includes("deterministic validators") &&
      refresh.marketResponsePolicy.requiredWrappers.includes("approval gates") &&
      refresh.marketResponsePolicy.requiredWrappers.includes("rollback points") &&
      refresh.marketResponsePolicy.comparisonPlan.includes("distilled_skill_or_low_cost_model_direct") &&
      refresh.marketResponsePolicy.comparisonPlan.includes("tlcl_contract_pipeline"),
    result.refreshPath
  ),
  check(
    "Market response forbids provider bypass of TLCL lifecycle",
    refresh.marketResponsePolicy?.locks?.distilledSkillMayBypassContractLifecycle === false &&
      refresh.marketResponsePolicy.locks.strongerModelMaySelfApprove === false &&
      refresh.marketResponsePolicy.locks.providerMayEnableRules === false &&
      refresh.marketResponsePolicy.locks.providerMayExecuteTargetSoftwareWithoutGate === false &&
      refresh.marketResponsePolicy.locks.providerMayWriteMemoryWithoutTeacherReview === false &&
      refresh.marketResponsePolicy.locks.providerMayUnlockPackaging === false,
    result.refreshPath
  ),
  check("TLCL status refresh is review-only and does not claim completion", refresh.locks.reviewOnly === true && refresh.completionClaim === false && refresh.locks.noCompletionClaim === true, result.refreshPath)
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_status_refresh_smoke_v1",
  smokeRoot,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
