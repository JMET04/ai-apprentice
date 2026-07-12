#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRuleCard } from "./rules/rule-dsl-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function slug(value) {
  return (
    String(value || "tlcl-reusable-workflow-repair-draft-package")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-repair-draft-package"
  );
}

function locks(ragInformedRepairReuse = false) {
  return {
    reviewOnly: true,
    repairDraftOnly: true,
    ruleLifecycle: "draft_disabled",
    supportsRagInformedRepairReuseInvocation: true,
    highReasoningCompileRequired: true,
    mediumRuntimeContinuationBlocked: true,
    deterministicValidationRequired: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotCaptureScreenshots: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false,
    ...(ragInformedRepairReuse
      ? {
          ragEvidenceNonAuthoritative: true,
          doesNotTreatRagAsAuthority: true
        }
      : {})
  };
}

function safeId(value) {
  return (
    String(value || "repair")
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "repair"
  );
}

function providerRoleUsePlanTraceFromIntake(intake) {
  return (
    intake.repairContext?.providerRoleUsePlanTrace ||
    intake.sourceEvidence?.providerRoleUsePlanTrace ||
    intake.providerRoleUsePlanTrace ||
    {}
  );
}

function reasoningBudgetGovernorReviewTraceFromIntake(intake) {
  return (
    intake.repairContext?.reasoningBudgetGovernorReviewTrace ||
    intake.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    intake.reasoningBudgetGovernorReviewTrace ||
    {}
  );
}

const goal = argValue("--goal", "Create a draft-disabled repair package for one TLCL reusable workflow repair intake.");
const intakeInput = readJsonInput(
  argValue("--intake", argValue("--repair-intake", "")),
  "--intake",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-repair-draft-packages"))
);
const intake = intakeInput.value;
const blockers = [];
const ragInformedRepairReuse =
  intake.ragInformedRepairReuse === true ||
  intake.sourceEvidence?.ragInformedRepairReuse === true ||
  intake.repairContext?.ragInformedRepairReuse === true;
if (intake.status !== "reusable_workflow_high_reasoning_repair_intake_ready") blockers.push("repair_intake_not_ready");
if (intake.readyForHighReasoningCompile !== true) blockers.push("repair_intake_missing_high_reasoning_compile_ready_flag");
if (intake.locks?.mediumRuntimeContinuationBlocked !== true) blockers.push("medium_runtime_continuation_lock_missing");
if (!String(intake.repairContext?.teacherCorrection || intake.repairContext?.observedIssue || "").trim()) {
  blockers.push("repair_context_missing_teacher_correction_or_observed_issue");
}
if (ragInformedRepairReuse) {
  if (
    intake.ragEvidenceTreatedAsAuthority === true ||
    intake.sourceEvidence?.ragEvidenceTreatedAsAuthority === true ||
    intake.repairContext?.ragEvidenceTreatedAsAuthority === true
  ) {
    blockers.push("rag_informed_repair_draft_treats_rag_as_authority");
  }
  if (
    intake.ragEvidenceNonAuthoritative !== true &&
    intake.sourceEvidence?.ragEvidenceNonAuthoritative !== true &&
    intake.repairContext?.ragEvidenceNonAuthoritative !== true
  ) {
    blockers.push("rag_informed_repair_draft_non_authority_flag_missing");
  }
  if (intake.locks?.ragEvidenceNonAuthoritative !== true || intake.locks?.doesNotTreatRagAsAuthority !== true) {
    blockers.push("rag_informed_repair_draft_non_authority_lock_missing");
  }
}

const draftId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const draftDir = join(outRoot, draftId);
const rulesDir = join(draftDir, "draft-disabled-rules");
const compiledDir = join(draftDir, "compiled-disabled-rule-package");
const packagePath = join(draftDir, "tlcl-reusable-workflow-high-reasoning-repair-draft-package.json");
const receiptPath = join(draftDir, "tlcl-reusable-workflow-high-reasoning-repair-draft-package-receipt.json");
const readmePath = join(draftDir, "TLCL_REUSABLE_WORKFLOW_HIGH_REASONING_REPAIR_DRAFT_PACKAGE_START_HERE.md");
const repairContext = intake.repairContext || {};
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromIntake(intake);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromIntake(intake);
const evidenceRefs = Array.from(new Set([intakeInput.path, ...(repairContext.evidenceToInspect || [])].filter(Boolean)));
const ruleId = `tlcl.reusable_workflow.repair.${safeId(intake.intakeId || draftId)}`;
const rule = {
  dsl_version: "0.1",
  rule_id: ruleId,
  title: "Draft repair guard for failed TLCL reusable workflow invocation",
  domain: "transparent_ai_apprentice_tlcl",
  lifecycle: "draft_disabled",
  severity: "blocking",
  owner: {
    teacher_id: "teacher",
    reviewer_id: null,
    approved_at: null
  },
  source: {
    type: ragInformedRepairReuse ? "rag_informed_teacher_correction_repair_intake" : "teacher_correction_repair_intake",
    evidence_refs: evidenceRefs,
    natural_language: [
      repairContext.teacherCorrection || "",
      repairContext.observedIssue || "",
      `Affected logic fields: ${(repairContext.affectedLogicFields || []).join(", ") || "unspecified"}`,
      providerRoleUsePlanTrace.providerRoleUsePlanHash
        ? `Provider role-use plan hash: ${providerRoleUsePlanTrace.providerRoleUsePlanHash}`
        : "",
      reasoningBudgetGovernorReviewTrace.validationHash
        ? `Reasoning budget governor review validation hash: ${reasoningBudgetGovernorReviewTrace.validationHash}`
        : "",
      ragInformedRepairReuse ? "RAG evidence is evidence-only and non-authoritative; teacher correction controls the repair." : ""
    ]
      .filter(Boolean)
      .join("\n")
  },
  scope: {
    artifact_types: ["tlcl_reusable_workflow_invocation"],
    applies_when: {
      workflowFingerprint: intake.sourceEvidence?.workflowFingerprint || "",
      runtimeTransition: repairContext.runtimeTransition || ""
    }
  },
  inputs_required: ["teacher_correction", "evidence_paths", "affected_logic_fields", "repaired_validator_plan"],
  constraint: {
    type: "policy_gate",
    gate: "block_medium_runtime_reuse_until_repaired_rule_dsl_and_validators_pass",
    proposedRepairFields: repairContext.affectedLogicFields || [],
    workflowFingerprint: intake.sourceEvidence?.workflowFingerprint || ""
  },
  failure: {
    message: "Reusable workflow invocation must not continue until high-reasoning repair is validated.",
    action: "reject_delivery",
    remediation_hint: "Repair Rule Card, Rule DSL, validators, route binding, workflow fingerprint, or command template before retry."
  },
  audit: {
    created_by: "high_reasoning_repair_draft_package_builder",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rule_version: "0.1.0"
  }
};
const ruleValidation = validateRuleCard(rule);
if (!ruleValidation.ok) blockers.push(...ruleValidation.errors.map((error) => `draft_rule_validation_failed:${error.error_code}:${error.path}`));

let compileResult = null;
let compiledRulePackagePath = "";
let compileReportPath = "";
let lockPath = "";
const status = blockers.length
  ? "blocked_before_reusable_workflow_repair_draft_package"
  : "reusable_workflow_high_reasoning_repair_draft_package_ready_for_teacher_review";
if (!blockers.length) {
  const rulePath = join(rulesDir, `${safeId(ruleId)}.json`);
  writeJson(rulePath, rule);
  const compileRun = spawnSync(
    process.execPath,
    [
      join(pluginRoot, "scripts", "rules", "compile-rule-package.mjs"),
      "--rules",
      rulesDir,
      "--package-id",
      `tlcl.reusable_workflow.repair_package.${safeId(draftId)}`,
      "--out-dir",
      compiledDir
    ],
    { cwd: repoRoot, encoding: "utf8", timeout: 300000 }
  );
  if (compileRun.status !== 0) {
    blockers.push(`disabled_rule_package_compile_failed:${compileRun.stderr || compileRun.stdout}`);
  } else {
    compileResult = JSON.parse(compileRun.stdout);
    compiledRulePackagePath = compileResult.packagePath || "";
    compileReportPath = compileResult.compileReportPath || "";
    lockPath = compileResult.lockPath || "";
  }
}
const finalStatus = blockers.length
  ? "blocked_before_reusable_workflow_repair_draft_package"
  : "reusable_workflow_high_reasoning_repair_draft_package_ready_for_teacher_review";
const regressionValidationPlan = {
  requiredBeforeMediumRuntimeRetry: true,
  steps: [
    "Teacher reviews the draft_disabled repair rule and affected logic fields.",
    "Run deterministic Rule DSL validation and disabled Rule Package compilation.",
    "Rebuild or invalidate the workflow fingerprint if repaired logic changes route semantics.",
    "Re-enter reusable workflow invocation planning, approval gate prep, approved-gate runner, and fresh outcome review."
  ],
  forbiddenShortcuts: [
    "enable_rule_from_draft_package",
    "write_memory_from_draft_package",
    "execute_target_software_from_draft_package",
    "reuse_medium_runtime_without_revalidation",
    ...(ragInformedRepairReuse ? ["treat_rag_as_authority_from_draft_package"] : [])
  ]
};
const draftPackage = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_package_v1",
  draftId,
  createdAt: new Date().toISOString(),
  goal,
  status: finalStatus,
  sourceEvidence: {
    repairIntakePath: intakeInput.path,
    repairIntakeHash: sha256Object(intake),
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    ragInformedRepairReuse,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: ragInformedRepairReuse
  },
  draftDisabledRules: blockers.length
    ? []
    : [
        {
          ruleId,
          lifecycle: "draft_disabled",
          rulePath: join(rulesDir, `${safeId(ruleId)}.json`),
          ruleHash: sha256Object(rule),
          teacherCorrection: repairContext.teacherCorrection || "",
          affectedLogicFields: repairContext.affectedLogicFields || []
        }
      ],
  compiledRulePackagePath,
  compileReportPath,
  lockPath,
  regressionValidationPlan,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  workflowRepairProposal: {
    workflowFingerprint: intake.sourceEvidence?.workflowFingerprint || "",
    mayNeedFingerprintChange: true,
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    proposedRepairTargets: repairContext.affectedLogicFields || [],
    mediumRuntimeRetryBlocked: true
  },
  blockers,
  paths: {
    draftPackage: packagePath,
    receipt: receiptPath,
    readme: readmePath,
    rulesDir,
    compiledRulePackage: compiledRulePackagePath,
    compileReport: compileReportPath,
    lock: lockPath
  },
  locks: locks(ragInformedRepairReuse)
};
const receipt = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_package_receipt_v1",
  draftId,
  status: finalStatus,
  draftDisabledRuleCount: draftPackage.draftDisabledRules.length,
  compiledDisabledRulePackage: Boolean(compiledRulePackagePath),
  activeRulePackageCompiled: false,
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  locks: locks(ragInformedRepairReuse)
};

writeJson(packagePath, draftPackage);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Reusable Workflow High-Reasoning Repair Draft Package",
    "",
    `Status: ${finalStatus}`,
    "",
    "This package converts a high-reasoning repair intake into draft_disabled repair logic and a disabled Rule Package for teacher review.",
    "It does not activate rules, write memory, run target software, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"])
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_package_result_v1",
      draftId,
      status: finalStatus,
      draftPackagePath: packagePath,
      receiptPath,
      readmePath,
      compiledRulePackagePath,
      compileReportPath,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      draftDisabledRuleCount: draftPackage.draftDisabledRules.length,
      blockerCount: blockers.length,
      activeRulePackageCompiled: false,
      approvedGateRunnerInvoked: false,
      targetSoftwareCommandsExecuted: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    },
    null,
    2
  )
);
