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
    String(value || "tlcl-rag-informed-high-reasoning-repair-draft-package")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-informed-high-reasoning-repair-draft-package"
  );
}

function safeId(value) {
  return (
    String(value || "rag_repair")
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "rag_repair"
  );
}

function locks() {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    repairDraftOnly: true,
    ruleLifecycle: "draft_disabled",
    ragEvidenceRequired: true,
    highReasoningCompileRequired: true,
    mediumRuntimeContinuationBlocked: true,
    deterministicValidationRequired: true,
    doesNotRunWorkflow: true,
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
    packagingUnlocked: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function buildRule(intake, row, draftId) {
  const evidenceRefs = Array.from(
    new Set(
      [
        intake.sourceEvidence?.attachmentPath,
        row.retrievalPath,
        row.rulePath,
        ...(Array.isArray(row.evidenceRefs) ? row.evidenceRefs : [])
      ].filter(Boolean)
    )
  );
  const rowKey = safeId(row.rowId || row.sourceId || draftId);
  return {
    dsl_version: "0.1",
    rule_id: `tlcl.rag_informed_repair.${rowKey}`,
    title: `Draft RAG-informed TLCL repair guard for ${row.sourceId || row.rowId || "reviewed evidence"}`,
    domain: "transparent_ai_apprentice_tlcl",
    lifecycle: "draft_disabled",
    severity: "blocking",
    owner: {
      teacher_id: "teacher",
      reviewer_id: null,
      approved_at: null
    },
    source: {
      type: "rag_evidence_high_reasoning_repair_intake",
      evidence_refs: evidenceRefs,
      natural_language: [
        row.logicExtractionHint || "",
        row.reviewerNote || "",
        `Teacher questions: ${(row.repairQuestions || []).join(" | ") || "none"}`
      ]
        .filter(Boolean)
        .join("\n")
    },
    scope: {
      artifact_types: ["tlcl_contract", "rule_dsl", "validator", "workflow_fingerprint"],
      applies_when: {
        intakeId: intake.intakeId || "",
        sourceId: row.sourceId || "",
        logicFitDecision: row.logicFitDecision || ""
      }
    },
    inputs_required: [
      "reviewed_rag_evidence_row",
      "logic_extraction_hint",
      "teacher_question_resolution",
      "deterministic_validator_plan"
    ],
    constraint: {
      type: "policy_gate",
      gate: "block_medium_runtime_until_rag_informed_repair_is_teacher_reviewed_and_validated",
      evidenceRowId: row.rowId || "",
      sourceId: row.sourceId || "",
      logicExtractionHint: row.logicExtractionHint || "",
      proposedRepairTargets: [
        "tlcl_contract_field",
        "rule_dsl_clause",
        "validator_expectation",
        "workflow_fingerprint",
        "teacher_question"
      ]
    },
    failure: {
      message: "RAG-informed TLCL repair evidence must remain draft_disabled until teacher review and deterministic validation pass.",
      action: "reject_delivery",
      remediation_hint:
        "Resolve teacher questions, cite reviewed evidence, validate the Rule DSL, and rebuild the relevant TLCL gates before medium runtime can retry."
    },
    audit: {
      created_by: "tlcl_rag_informed_high_reasoning_repair_draft_package_builder",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rule_version: "0.1.0"
    }
  };
}

const goal = argValue("--goal", "Create a draft-disabled RAG-informed high-reasoning TLCL repair package.");
const intakeInput = readJsonInput(
  argValue("--intake", argValue("--repair-intake", "")),
  "--intake",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_intake_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-informed-high-reasoning-repair-draft-packages"))
);
const intake = intakeInput.value;
const blockers = [];
if (intake.status !== "tlcl_rag_informed_high_reasoning_repair_intake_waiting_for_teacher_review") {
  blockers.push("rag_informed_repair_intake_not_waiting_for_teacher_review");
}
if (intake.readyForTeacherReview !== true) blockers.push("rag_informed_repair_intake_missing_teacher_review_ready_flag");
if (intake.readyForMediumRuntime !== false) blockers.push("rag_informed_repair_intake_medium_runtime_must_be_false");
if (intake.locks?.reviewOnly !== true) blockers.push("review_only_lock_missing");
if (intake.locks?.evidenceOnly !== true) blockers.push("evidence_only_lock_missing");
if (intake.locks?.highReasoningRepairIntakeOnly !== true) blockers.push("high_reasoning_repair_intake_lock_missing");
if (intake.locks?.mediumRuntimeContinuationBlocked !== true) blockers.push("medium_runtime_continuation_lock_missing");
if (intake.locks?.ragDoesNotAuthorizeExecution !== true) blockers.push("rag_authorization_lock_missing");
if (intake.locks?.ruleEnabled !== false) blockers.push("rule_enablement_lock_missing");
if (intake.locks?.memoryWritten !== false) blockers.push("memory_lock_missing");
if (intake.locks?.packagingUnlocked !== false) blockers.push("packaging_unlock_lock_missing");
if (intake.locks?.goalComplete !== false) blockers.push("goal_completion_lock_missing");
if (!Array.isArray(intake.evidenceReviewRows) || intake.evidenceReviewRows.length === 0) {
  blockers.push("rag_informed_repair_intake_has_no_evidence_review_rows");
}
if (!Array.isArray(intake.highReasoningRepairTasks) || intake.highReasoningRepairTasks.length === 0) {
  blockers.push("rag_informed_repair_intake_has_no_high_reasoning_repair_tasks");
}
if (!Array.isArray(intake.teacherQuestions) || intake.teacherQuestions.length === 0) {
  blockers.push("rag_informed_repair_intake_has_no_teacher_questions");
}

const draftId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const draftDir = join(outRoot, draftId);
const rulesDir = join(draftDir, "draft-disabled-rag-informed-rules");
const compiledDir = join(draftDir, "compiled-disabled-rag-informed-rule-package");
const draftPackagePath = join(draftDir, "tlcl-rag-informed-high-reasoning-repair-draft-package.json");
const receiptPath = join(draftDir, "tlcl-rag-informed-high-reasoning-repair-draft-package-receipt.json");
const readmePath = join(draftDir, "TLCL_RAG_INFORMED_HIGH_REASONING_REPAIR_DRAFT_PACKAGE_START_HERE.md");
let compiledRulePackagePath = "";
let compileReportPath = "";
let lockPath = "";
const draftRules = [];

if (!blockers.length) {
  for (const row of intake.evidenceReviewRows) {
    const rule = buildRule(intake, row, draftId);
    const ruleValidation = validateRuleCard(rule);
    if (!ruleValidation.ok) {
      blockers.push(...ruleValidation.errors.map((error) => `draft_rule_validation_failed:${error.error_code}:${error.path}`));
      continue;
    }
    const rulePath = join(rulesDir, `${safeId(rule.rule_id)}.json`);
    writeJson(rulePath, rule);
    draftRules.push({
      ruleId: rule.rule_id,
      lifecycle: "draft_disabled",
      sourceEvidenceRowId: row.rowId || "",
      sourceId: row.sourceId || "",
      logicExtractionHint: row.logicExtractionHint || "",
      evidenceRefs: rule.source.evidence_refs,
      teacherQuestions: row.repairQuestions || [],
      proposedRepairTargets: rule.constraint.proposedRepairTargets,
      rulePath,
      ruleHash: sha256Object(rule)
    });
  }
}

if (!blockers.length) {
  const compileRun = spawnSync(
    process.execPath,
    [
      join(pluginRoot, "scripts", "rules", "compile-rule-package.mjs"),
      "--rules",
      rulesDir,
      "--package-id",
      `tlcl.rag_informed_repair_package.${safeId(draftId)}`,
      "--out-dir",
      compiledDir
    ],
    { cwd: repoRoot, encoding: "utf8", timeout: 300000 }
  );
  if (compileRun.status !== 0) {
    blockers.push(`disabled_rag_informed_rule_package_compile_failed:${compileRun.stderr || compileRun.stdout}`);
  } else {
    const compileResult = JSON.parse(compileRun.stdout);
    compiledRulePackagePath = compileResult.packagePath || "";
    compileReportPath = compileResult.compileReportPath || "";
    lockPath = compileResult.lockPath || "";
  }
}

const finalStatus = blockers.length
  ? "blocked_before_tlcl_rag_informed_high_reasoning_repair_draft_package"
  : "tlcl_rag_informed_high_reasoning_repair_draft_package_ready_for_teacher_review";
const deterministicValidationPlan = {
  requiredBeforeMediumRuntimeRetry: true,
  validationInputs: [
    "compiled draft_disabled Rule Package",
    "RAG evidence attachment hash",
    "teacher question receipt",
    "TLCL validator expectations",
    "workflow fingerprint review"
  ],
  validatorExpectations: [
    "Every repair clause cites at least one reviewed RAG evidence row.",
    "Every uncertain logic item remains a teacher question until reviewed.",
    "No draft_disabled rule can become active without explicit teacher approval and deterministic validation.",
    "Medium runtime remains blocked until fresh approval gate and outcome review complete."
  ],
  forbiddenShortcuts: [
    "enable_rule_from_rag_informed_draft_package",
    "write_memory_from_rag_informed_draft_package",
    "execute_target_software_from_rag_informed_draft_package",
    "treat_rag_as_authority_from_draft_package",
    "reuse_medium_runtime_without_teacher_review"
  ]
};
const draftPackage = {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_package_v1",
  draftId,
  createdAt: new Date().toISOString(),
  goal,
  status: finalStatus,
  sourceEvidence: {
    intakePath: intakeInput.path,
    intakeHash: sha256Object(intake),
    attachmentPath: intake.sourceEvidence?.attachmentPath || "",
    attachmentHash: intake.sourceEvidence?.attachmentHash || "",
    tlclPacketHash: intake.sourceEvidence?.tlclPacketHash || "",
    ragValidationHash: intake.sourceEvidence?.ragValidationHash || ""
  },
  draftDisabledRules: blockers.length ? [] : draftRules,
  compiledRulePackagePath,
  compileReportPath,
  lockPath,
  teacherQuestionHandoff: intake.teacherQuestions || [],
  highReasoningRepairTasks: intake.highReasoningRepairTasks || [],
  deterministicValidationPlan,
  mediumRuntimeRetryGate: {
    blockedUntilTeacherReviewedRepair: true,
    requiresDisabledRuleDraft: true,
    requiresDeterministicValidation: true,
    requiresWorkflowFingerprintReview: true,
    requiresFreshMediumRuntimeApprovalGate: true,
    readyForMediumRuntime: false
  },
  forbiddenTransitions: [
    "execute_target_software_from_rag_informed_draft_package",
    "continue_medium_runtime_from_rag_informed_draft_package",
    "enable_rule_from_rag_informed_draft_package",
    "write_memory_from_rag_informed_draft_package",
    "unlock_packaging_from_rag_informed_draft_package",
    "claim_completion_from_rag_informed_draft_package",
    "treat_rag_as_authority_from_draft_package"
  ],
  blockers,
  paths: {
    draftPackage: draftPackagePath,
    receipt: receiptPath,
    readme: readmePath,
    rulesDir,
    compiledRulePackage: compiledRulePackagePath,
    compileReport: compileReportPath,
    lock: lockPath
  },
  locks: locks()
};
const receipt = {
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_package_receipt_v1",
  draftId,
  status: finalStatus,
  draftDisabledRuleCount: draftPackage.draftDisabledRules.length,
  compiledDisabledRulePackage: Boolean(compiledRulePackagePath),
  readyForMediumRuntime: false,
  activeRulePackageCompiled: false,
  targetSoftwareCommandsExecuted: false,
  mediumRuntimeContinued: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  packagingUnlocked: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false,
  locks: locks()
};

writeJson(draftPackagePath, draftPackage);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL RAG-Informed High-Reasoning Repair Draft Package",
    "",
    `Status: ${finalStatus}`,
    "",
    "This package compiles reviewed RAG evidence into draft_disabled TLCL repair rules for teacher review.",
    "It does not activate rules, run software, continue medium runtime, write memory, unlock packaging, treat RAG as authority, or claim completion.",
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
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_package_result_v1",
      draftId,
      status: finalStatus,
      draftPackagePath,
      receiptPath,
      readmePath,
      compiledRulePackagePath,
      compileReportPath,
      lockPath,
      draftDisabledRuleCount: draftPackage.draftDisabledRules.length,
      teacherQuestionCount: draftPackage.teacherQuestionHandoff.length,
      blockerCount: blockers.length,
      readyForMediumRuntime: false,
      activeRulePackageCompiled: false,
      targetSoftwareCommandsExecuted: false,
      mediumRuntimeContinued: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      packagingUnlocked: false,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    },
    null,
    2
  )
);
