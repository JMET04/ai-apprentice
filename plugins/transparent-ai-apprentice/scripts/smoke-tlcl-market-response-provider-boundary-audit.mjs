#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");

function readPlugin(relativePath) {
  return readFileSync(join(pluginRoot, relativePath), "utf8");
}

function readRepo(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function hasAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

const checks = [];

function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

const docs = {
  readme: readPlugin("README.md"),
  direction: readPlugin("TLCL_OVERALL_DIRECTION.md"),
  taskList: readPlugin("FULL_TARGET_DIRECTION_AND_TASK_LIST.md"),
  package: readRepo("package.json")
};

check(
  "market response docs treat strong models and distilled skills as replaceable providers",
  hasAll(docs.readme, [
    "stronger models, open-source models, distilled skills, and local tools",
    "smoke:plugin-tlcl-market-response-provider-boundary-audit",
    "stronger model or distilled skill can bypass"
  ]) &&
    hasAll(docs.direction, [
      "Distilled skills and stronger model releases are handled as replaceable capability providers",
      "Claude, GPT, Gemini, or open-source models",
      "cannot bypass the contract lifecycle"
    ]) &&
    hasAll(docs.taskList, [
      "蒸馏 skill",
      "Claude/GPT/Gemini",
      "Rule DSL、验证器、回滚点、老师验收、证据链和工作执照"
    ]),
  {
    files: ["README.md", "TLCL_OVERALL_DIRECTION.md", "FULL_TARGET_DIRECTION_AND_TASK_LIST.md"]
  }
);

const providerScripts = [
  {
    name: "provider intake",
    path: "scripts/create-tlcl-capability-provider-intake.mjs",
    tokens: [
      "strong_foundation_model",
      "distilled_skill",
      "open_source_model",
      "local_tool",
      "senior_reasoning_compile",
      "medium_reasoning_runtime",
      "low_reasoning_tool",
      "provider_claims_self_approval",
      "provider_claims_contract_bypass",
      "provider_claims_target_execution_without_gate",
      "provider_claims_memory_write_without_teacher_review",
      "provider_claims_packaging_unlock",
      "Rule DSL",
      "deterministic validators",
      "approval gates",
      "rollback points",
      "teacher-reviewed evidence"
    ]
  },
  {
    name: "qualification plan",
    path: "scripts/create-tlcl-capability-provider-qualification-plan.mjs",
    tokens: [
      "senior_compile.teacher_correction_to_disabled_rule_card",
      "medium_runtime.teacher_correction_escalates",
      "fixed_transform",
      "missing_teacher_reviewed_candidate_flag",
      "distilled_skill_or_low_cost_model_direct",
      "validator_result_receipt",
      "rollback_retention_receipt"
    ]
  },
  {
    name: "no-action qualification runner",
    path: "scripts/run-tlcl-capability-provider-qualification-no-action-runner.mjs",
    tokens: [
      "missing_teacher_reviewed_test_plan_flag",
      "providerInvocationStatus",
      "not_invoked",
      "providerInvoked",
      "providerEnabled",
      "execute_target_software",
      "write_memory",
      "unlock_packaging"
    ]
  },
  {
    name: "qualification result receipt validation",
    path: "scripts/validate-tlcl-capability-provider-qualification-result-receipt.mjs",
    tokens: [
      "matched_expected",
      "mismatch_blocked",
      "unknown_blocked",
      "Return the mismatch or unknown evidence to the teacher and senior compile layer.",
      "Create a later validator-review or teacher-approval gate before any provider enablement."
    ]
  },
  {
    name: "activation review candidate",
    path: "scripts/create-tlcl-capability-provider-activation-review-candidate-builder.mjs",
    tokens: [
      "tlcl_capability_provider_activation_review_candidate_ready_for_teacher_approval",
      "teacherDecision",
      "needs_teacher_review",
      "teacherApprovedProviderForTlclRole",
      "unlock_packaging",
      "bypass_contract",
      "Approval does not execute target software, write memory, unlock packaging, bypass TLCL, or claim acceptance."
    ]
  },
  {
    name: "activation review receipt validation",
    path: "scripts/validate-tlcl-capability-provider-activation-review-receipt.mjs",
    tokens: [
      "approve_provider_for_tlcl_role",
      "correction_to_high_reasoning_repair",
      "runtimeGateStillRequiredConfirmed",
      "teacher_provider_role_approval_missing",
      "providerCapabilityCard",
      "self approval",
      "contract bypass",
      "memory writes without teacher review"
    ]
  },
  {
    name: "role-use planner",
    path: "scripts/create-tlcl-capability-provider-role-use-planner.mjs",
    tokens: [
      "tlcl_capability_provider_role_use_ready_for_runtime_gate",
      "requested_role_does_not_match_provider_card_role",
      "provider_card_missing_contract_bypass_forbidden_use",
      "provider_role_use_mismatch_to_high_reasoning_repair",
      "teacher correction must return to senior reasoning compile repair",
      "provider self-approval",
      "providerMayExecuteTargetSoftware",
      "providerMayWriteMemory",
      "providerMayBypassTlcl"
    ]
  },
  {
    name: "runtime gate",
    path: "scripts/create-tlcl-runtime-gate.mjs",
    tokens: [
      "provider_role_use_plan_not_medium_runtime",
      "invalid_provider_role_use_plan",
      "providerRoleUsePlanHash",
      "providerMayExecuteTargetSoftware",
      "providerMayWriteMemory",
      "providerMayBypassTlcl",
      "medium_runtime_allowed",
      "escalate_to_senior_compile"
    ]
  }
];

const providerResults = providerScripts.map((item) => {
  const absolutePath = join(pluginRoot, item.path);
  const exists = existsSync(absolutePath);
  const text = exists ? readPlugin(item.path) : "";
  const missingTokens = exists ? item.tokens.filter((token) => !text.includes(token)) : item.tokens;
  check(`provider boundary script: ${item.name}`, exists && missingTokens.length === 0, {
    file: item.path,
    missingTokens
  });
  return { name: item.name, file: item.path, exists, missingTokens };
});

const schemaChecks = [
  {
    name: "reasoning tier contract schema",
    path: "schemas/reasoning-tier-contract.schema.json",
    tokens: [
      "senior_reasoning_compile",
      "medium_reasoning_runtime",
      "low_reasoning_tool",
      "deterministic_validator",
      "human_teacher_review",
      "modelMaySelfApprove",
      "runtimeMayEnableRules",
      "runtimeMayBypassValidator",
      "runtimeMayBypassTeacherReview"
    ]
  },
  {
    name: "TLCL runtime gate schema",
    path: "schemas/tlcl-runtime-gate.schema.json",
    tokens: [
      "medium_runtime_allowed",
      "escalate_to_senior_compile",
      "senior_reasoning_compile",
      "medium_reasoning_runtime",
      "deterministic_validator",
      "human_teacher_review",
      "canExecuteTargetSoftware",
      "canEnableRules",
      "canWriteMemory",
      "canClaimCompletion"
    ]
  }
];

for (const item of schemaChecks) {
  const text = readPlugin(item.path);
  const missingTokens = item.tokens.filter((token) => !text.includes(token));
  check(`schema enforces market response boundary: ${item.name}`, missingTokens.length === 0, {
    file: item.path,
    missingTokens
  });
}

const smokeChecks = [
  {
    name: "provider intake smoke covers distilled and strong providers",
    path: "scripts/smoke-tlcl-capability-provider-intake.mjs",
    tokens: [
      "Distilled skill enters only teacher-review provider intake",
      "Strong model enters only senior-compiler candidate review",
      "Provider bypass claims block intake before teacher review",
      "Capability provider intake preserves market response wrappers and no-action locks"
    ]
  },
  {
    name: "provider qualification no-action smoke blocks real invocation",
    path: "scripts/smoke-tlcl-capability-provider-qualification-no-action-runner.mjs",
    tokens: [
      "Qualification no-action runner creates result template without invoking provider",
      "Qualification no-action runner requires teacher-reviewed test plan evidence",
      "Blocked qualification plan cannot be converted into run rows"
    ]
  },
  {
    name: "provider activation smoke gates teacher approval",
    path: "scripts/smoke-tlcl-capability-provider-activation-review.mjs",
    tokens: [
      "Teacher activation approval issues only a TLCL role-scoped provider card",
      "Teacher correction routes provider activation back to high reasoning repair",
      "Forbidden provider activation decision fails closed"
    ]
  },
  {
    name: "provider role-use smoke gates exact role use",
    path: "scripts/smoke-tlcl-capability-provider-role-use-planner.mjs",
    tokens: [
      "Approved provider card becomes only a role-use plan for the next TLCL runtime gate",
      "Requested role mismatch is blocked and routed to high reasoning repair",
      "Invalid activation source fails closed before provider role use"
    ]
  },
  {
    name: "runtime gate provider smoke blocks wrong role and hashes evidence",
    path: "scripts/smoke-tlcl-runtime-gate-provider-role-plan.mjs",
    tokens: [
      "Medium provider role-use plan is accepted by runtime gate",
      "Low-reasoning tool role-use plan cannot enter medium runtime gate",
      "Invalid provider role-use source fails closed before runtime",
      "Provider role-use evidence is hashed into the runtime gate"
    ]
  }
];

for (const item of smokeChecks) {
  const text = readPlugin(item.path);
  const missingTokens = item.tokens.filter((token) => !text.includes(token));
  check(item.name, missingTokens.length === 0, { file: item.path, missingTokens });
}

check(
  "npm script exposes market response provider boundary audit",
  hasAll(docs.package, [
    "smoke:plugin-tlcl-market-response-provider-boundary-audit",
    "smoke-tlcl-market-response-provider-boundary-audit.mjs"
  ]),
  { packagePath: join(repoRoot, "package.json") }
);

const passed = checks.filter((item) => item.passed).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_market_response_provider_boundary_audit_smoke_v1",
  passed,
  total: checks.length,
  providerScripts: providerResults,
  checks
};

console.log(JSON.stringify(result, null, 2));

if (result.status !== "passed") {
  process.exit(1);
}
