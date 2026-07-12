#!/usr/bin/env node
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
    String(value || "tlcl-status-refresh")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-status-refresh"
  );
}

function readText(relativePath) {
  const fullPath = join(pluginRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

function fileStatus(relativePath, requiredPhrases = []) {
  const fullPath = join(pluginRoot, relativePath);
  const text = existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
  const missingPhrases = requiredPhrases.filter((phrase) => !text.includes(phrase));
  return {
    path: fullPath,
    exists: existsSync(fullPath),
    requiredPhrases,
    missingPhrases,
    ready: existsSync(fullPath) && missingPhrases.length === 0
  };
}

const goal = argValue("--goal", "tlcl-status-refresh");
const outputRoot = resolve(argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-status-refreshes")));
const refreshId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const refreshDir = join(outputRoot, refreshId);
mkdirSync(refreshDir, { recursive: true });

const fullTargetText = readText("FULL_TARGET_DIRECTION_AND_TASK_LIST.md");
const tlclDirectionText = readText("TLCL_OVERALL_DIRECTION.md");
const readmeText = readText("README.md");

const marketResponsePolicy = {
  format: "transparent_ai_tlcl_market_response_policy_v1",
  purpose:
    "Treat distilled skills, open-source models, and stronger Claude/GPT/Gemini-class releases as replaceable capability providers inside the TLCL lifecycle, not as authority to bypass contracts.",
  providerRoles: ["senior_reasoning_compile", "medium_reasoning_runtime", "low_reasoning_tool"],
  requiredWrappers: [
    "Rule DSL",
    "deterministic validators",
    "approval gates",
    "rollback points",
    "audit receipts",
    "teacher-reviewed evidence"
  ],
  comparisonPlan: [
    "strong_model_direct",
    "distilled_skill_or_low_cost_model_direct",
    "medium_reasoning_without_contract",
    "tlcl_contract_pipeline"
  ],
  locks: {
    distilledSkillMayBypassContractLifecycle: false,
    strongerModelMaySelfApprove: false,
    providerMayEnableRules: false,
    providerMayExecuteTargetSoftwareWithoutGate: false,
    providerMayWriteMemoryWithoutTeacherReview: false,
    providerMayUnlockPackaging: false
  }
};

const reasoningTierContract = {
  format: "transparent_ai_reasoning_tier_contract_v1",
  purpose:
    "Use the highest reasoning tier to learn and compile complete normative logic, the medium reasoning tier to execute confirmed workflows, low reasoning/tool layers for fixed transforms, deterministic validators for judgment, and escalation back to senior reasoning when users correct, validators fail/unknown, or evidence conflicts.",
  tiers: [
    {
      id: "senior_reasoning_compile",
      role: "Learn from human teaching, RAG evidence, corrections, standards, and failures; compile Rule Cards, Rule DSL, workflows, tests, failure policies, and repair plans.",
      allowed_work: [
        "read standards",
        "understand teacher corrections",
        "draft disabled Rule Cards",
        "compile TLCL contracts",
        "repair failed logic"
      ],
      forbidden_work: ["self-approve delivery", "bypass teacher review", "execute target software without gates"]
    },
    {
      id: "medium_reasoning_runtime",
      role: "Execute already reviewed workflow contracts with enough reasoning to follow context, explain steps, and request escalation when the contract is insufficient.",
      allowed_work: ["run reviewed workflows", "prepare dry-run outputs", "explain contract-bound execution", "request escalation"],
      forbidden_work: ["change active rules", "ignore validators", "treat new teacher corrections as already approved"]
    },
    {
      id: "low_reasoning_tool",
      role: "Run fixed low-cost transforms such as field extraction, formatting, metadata checks, deterministic retrieval, and template filling.",
      allowed_work: ["field extraction", "format conversion", "metadata delta checks", "bounded retrieval", "template generation"],
      forbidden_work: ["infer new rules", "approve risky actions", "override medium or senior decisions"]
    },
    {
      id: "deterministic_validator",
      role: "Judge contract outputs with pass/fail/unknown/error and block delivery on active blocking fail, unknown, or validator error.",
      allowed_work: ["evaluate Rule Packages", "produce Validation Reports", "block delivery gates"],
      forbidden_work: ["invent missing evidence", "convert unknown to pass"]
    },
    {
      id: "human_teacher_review",
      role: "Own review, responsibility confirmation, corrections, rollback confirmation, and approval decisions.",
      allowed_work: ["approve rules", "correct outputs", "confirm numbered targets", "retain or confirm rollback points"],
      forbidden_work: []
    }
  ],
  routing_policy: {
    compile_tier: "senior_reasoning_compile",
    default_runtime_tier: "medium_reasoning_runtime",
    fixed_transform_tier: "low_reasoning_tool",
    validation_authority: "deterministic_validator",
    approval_authority: "human_teacher_review"
  },
  escalation_policy: {
    escalates_to: "senior_reasoning_compile",
    triggers: [
      "teacher_correction",
      "validator_unknown",
      "validator_error",
      "blocking_failure",
      "conflicting_rules",
      "missing_evidence",
      "high_risk_action",
      "teacher_disagreement"
    ],
    consequence:
      "Return to senior reasoning for contract repair; do not enable rules, execute software, write memory, or claim acceptance until teacher review and validators pass."
  },
  locks: {
    modelMaySelfApprove: false,
    runtimeMayEnableRules: false,
    runtimeMayBypassValidator: false,
    runtimeMayBypassTeacherReview: false
  }
};

const chain = [
  fileStatus("schemas/artifact-envelope.schema.json", ["Artifact Envelope"]),
  fileStatus("schemas/rule-card.schema.json", ["Rule Card"]),
  fileStatus("schemas/rule-package.schema.json", ["Rule Package"]),
  fileStatus("schemas/validation-report.schema.json", ["delivery_allowed"]),
  fileStatus("schemas/reasoning-tier-contract.schema.json", [
    "transparent_ai_reasoning_tier_contract_v1",
    "medium_reasoning_runtime"
  ]),
  fileStatus("scripts/rules/compile-rule-package.mjs", ["rule-package.json", "compile-report.json"]),
  fileStatus("scripts/rules/evaluate-rule-package.mjs", ["delivery_allowed", "unknown"]),
  fileStatus("scripts/validators/registry.mjs", ["json_schema", "expression", "topology", "geometry", "policy_gate"]),
  fileStatus("FULL_TARGET_DIRECTION_AND_TASK_LIST.md", [
    "Senior Model Compiler / Medium Runtime",
    "Medium Reasoning Runtime",
    "Low Reasoning Tool Layer",
    "RAG",
    "TLCL"
  ]),
  fileStatus("TLCL_OVERALL_DIRECTION.md", ["Teachable Logic Contract Layer", "Medium Reasoning Runtime", "Claude, GPT, Gemini"]),
  fileStatus("README.md", ["Overall Direction: TLCL", "RAG is scoped as an evidence layer", "create-tlcl-status-refresh"])
];

const requiredConcepts = [
  {
    id: "highest_reasoning_compile_medium_runtime",
    ready:
      (fullTargetText.includes("Medium Reasoning Runtime") &&
        fullTargetText.includes("Low Reasoning Tool Layer") &&
        fullTargetText.includes("Senior Model Rule Compiler")) ||
      tlclDirectionText.includes("Medium Reasoning Runtime"),
    evidence: "Senior compile and medium runtime split is present in the contract/status direction."
  },
  {
    id: "correction_returns_to_senior",
    ready:
      reasoningTierContract.escalation_policy.triggers.includes("teacher_correction") &&
      reasoningTierContract.escalation_policy.escalates_to === "senior_reasoning_compile",
    evidence: "Teacher correction escalates back to senior reasoning compile."
  },
  {
    id: "rag_external_knowledge_retriever",
    ready:
      readmeText.includes("external knowledge-base retriever") ||
      (fullTargetText.includes("RAG") && fullTargetText.includes("Rule DSL")),
    evidence: "RAG is documented as an external knowledge retriever and evidence layer."
  },
  {
    id: "foundation_model_response",
    ready:
      tlclDirectionText.includes("not competing with Claude, GPT, Gemini") &&
      tlclDirectionText.includes("trusted delivery layer"),
    evidence: "The strategy benefits from stronger foundation models instead of competing with them."
  },
  {
    id: "skill_distillation_response",
    ready:
      fullTargetText.includes("蒸馏 skill") &&
      fullTargetText.includes("可替换的 senior compiler、medium runtime 或 low reasoning tool 候选") &&
      tlclDirectionText.includes("Distilled skills and stronger model releases are handled as replaceable capability providers") &&
      tlclDirectionText.includes("cannot bypass the contract lifecycle") &&
      marketResponsePolicy.locks.distilledSkillMayBypassContractLifecycle === false,
    evidence:
      "Distilled skills and stronger models are tracked as replaceable providers that must remain inside the TLCL contract lifecycle."
  }
];

const gaps = [
  ...chain
    .filter((item) => !item.ready)
    .map((item) => ({ type: "missing_or_incomplete_chain_file", path: item.path, missingPhrases: item.missingPhrases })),
  ...requiredConcepts
    .filter((item) => !item.ready)
    .map((item) => ({ type: "missing_required_concept", id: item.id, evidence: item.evidence }))
];

const refresh = {
  format: "transparent_ai_tlcl_status_refresh_v1",
  refreshId,
  goal,
  createdAt: new Date().toISOString(),
  paths: {
    refresh: join(refreshDir, "tlcl-status-refresh.json"),
    readme: join(refreshDir, "TLCL_STATUS_REFRESH_START_HERE.md"),
    reasoningTierContract: join(refreshDir, "reasoning-tier-contract.json")
  },
  status: gaps.length === 0 ? "ready_for_teacher_review" : "needs_follow_up",
  completionClaim: false,
  reasoningTierContract,
  marketResponsePolicy,
  tlclChain: chain,
  requiredConcepts,
  gaps,
  nextActions: [
    gaps.length === 0
      ? "Teacher can review the TLCL status refresh and confirm whether to start wiring the shortest contract path into implementation work."
      : "Close missing TLCL chain or model-tier concept gaps before claiming the direction is ready.",
    "Keep packaging/engineering drawing validation as a later verification scenario after the TLCL skeleton is usable.",
    "Do not delete rollback points until teacher confirms this direction."
  ],
  locks: {
    reviewOnly: true,
    noSoftwareExecution: true,
    noMemoryWrite: true,
    noRuleEnablement: true,
    noPackagingUnlock: true,
    noCompletionClaim: true
  }
};

writeFileSync(refresh.paths.reasoningTierContract, JSON.stringify(reasoningTierContract, null, 2), "utf8");
writeFileSync(refresh.paths.refresh, JSON.stringify(refresh, null, 2), "utf8");
writeFileSync(
  refresh.paths.readme,
  [
    "# TLCL Status Refresh",
    "",
    `- Refresh: ${refresh.paths.refresh}`,
    `- Reasoning tier contract: ${refresh.paths.reasoningTierContract}`,
    `- Status: ${refresh.status}`,
    `- Completion claim: ${refresh.completionClaim}`,
    "",
    "## Model Tier Contract",
    "",
    "- Senior reasoning compile: learn, compile, repair.",
    "- Medium reasoning runtime: execute reviewed workflows under contract.",
    "- Low reasoning/tool layer: fixed transforms and metadata work.",
    "- Deterministic validators judge pass/fail/unknown/error.",
    "- Human teacher owns approval and responsibility.",
    "",
    "## Locks",
    "",
    "- No target software execution.",
    "- No rule enablement.",
    "- No memory write.",
    "- No packaging unlock.",
    "- No completion claim.",
    "",
    "## Next Actions",
    "",
    ...refresh.nextActions.map((item) => `- ${item}`)
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      status: refresh.status,
      refreshId,
      refreshPath: refresh.paths.refresh,
      reasoningTierContractPath: refresh.paths.reasoningTierContract,
      readmePath: refresh.paths.readme,
      gaps: gaps.length
    },
    null,
    2
  )
);
