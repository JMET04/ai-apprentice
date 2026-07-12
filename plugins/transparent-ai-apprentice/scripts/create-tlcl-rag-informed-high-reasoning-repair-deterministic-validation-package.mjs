#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { evaluateRulePackage } from "./rules/evaluate-rule-package.mjs";

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
    String(value || "tlcl-rag-informed-deterministic-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-informed-deterministic-validation"
  );
}

function locks() {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    deterministicValidationOnly: true,
    ruleLifecycle: "draft_disabled",
    ragEvidenceNonAuthoritative: true,
    mediumRuntimeContinuationBlocked: true,
    workflowFingerprintReviewStillRequired: true,
    approvalGateRebuildStillRequired: true,
    freshOutcomeReviewStillRequired: true,
    doesNotRunMediumRuntime: true,
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

const goal = argValue("--goal", "Create deterministic validation for one reviewed RAG-informed TLCL repair draft.");
const reviewInput = readJsonInput(
  argValue("--review-validation", argValue("--validation", argValue("--draft-review-validation", ""))),
  "--review-validation",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_review_validation_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-informed-deterministic-validations"))
);
const review = reviewInput.value;
const blockers = [];
if (review.status !== "rag_informed_repair_draft_ready_for_deterministic_validation") {
  blockers.push("rag_informed_repair_draft_review_not_ready_for_deterministic_validation");
}
if (review.readyForDeterministicValidation !== true) blockers.push("deterministic_validation_ready_flag_missing");
if (review.readyForMediumRuntime !== false) blockers.push("medium_runtime_ready_flag_must_be_false");
if (review.locks?.mediumRuntimeContinuationBlocked !== true) blockers.push("medium_runtime_continuation_lock_missing");
if (review.locks?.ragEvidenceNonAuthoritative !== true) blockers.push("rag_non_authority_lock_missing");
if (review.locks?.doesNotEnableRules !== true || review.locks?.ruleEnabled !== false) blockers.push("rule_enablement_lock_missing");
if (review.locks?.doesNotWriteMemory !== true) blockers.push("memory_lock_missing");

const handoff = review.deterministicValidationHandoff || {};
const draftPackagePathRaw = String(handoff.draftPackagePath || review.sourceEvidence?.draftPackagePath || "").trim();
const draftPackagePath = draftPackagePathRaw ? resolve(draftPackagePathRaw) : "";
if (!handoff || handoff.kind !== "rag_informed_repair_draft_deterministic_validation_handoff") {
  blockers.push("deterministic_validation_handoff_missing");
}
if (!draftPackagePath || !existsSync(draftPackagePath)) blockers.push("draft_package_path_missing_or_not_found");

let draftPackage = null;
let compiledRulePackage = null;
let attachment = null;
let compiledRulePackagePath = "";
let attachmentPath = "";
if (!blockers.includes("draft_package_path_missing_or_not_found")) {
  draftPackage = readJson(draftPackagePath);
  if (draftPackage.format !== "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_package_v1") {
    blockers.push("draft_package_format_mismatch");
  }
  if (draftPackage.status !== "tlcl_rag_informed_high_reasoning_repair_draft_package_ready_for_teacher_review") {
    blockers.push("draft_package_not_ready_for_teacher_review");
  }
  if (draftPackage.locks?.ruleLifecycle !== "draft_disabled") blockers.push("draft_package_lifecycle_lock_missing");
  if (draftPackage.locks?.evidenceOnly !== true) blockers.push("draft_package_evidence_only_lock_missing");
  if (draftPackage.locks?.mediumRuntimeContinuationBlocked !== true) blockers.push("draft_package_medium_runtime_lock_missing");
  compiledRulePackagePath = resolve(String(handoff.compiledRulePackagePath || draftPackage.compiledRulePackagePath || ""));
  if (!compiledRulePackagePath || !existsSync(compiledRulePackagePath)) blockers.push("compiled_disabled_rule_package_missing_or_not_found");
  attachmentPath = resolve(String(handoff.attachmentPath || draftPackage.sourceEvidence?.attachmentPath || ""));
  if (!attachmentPath || !existsSync(attachmentPath)) blockers.push("rag_attachment_missing_or_not_found");
}
if (compiledRulePackagePath && existsSync(compiledRulePackagePath)) {
  compiledRulePackage = readJson(compiledRulePackagePath);
  const rules = Array.isArray(compiledRulePackage.rules) ? compiledRulePackage.rules : [];
  if (!rules.length) blockers.push("compiled_rule_package_has_no_rules");
  if (rules.some((rule) => rule.lifecycle === "active")) blockers.push("compiled_rule_package_contains_active_rule");
  if (rules.some((rule) => rule.lifecycle !== "draft_disabled")) blockers.push("compiled_rule_package_contains_non_draft_disabled_rule");
}
if (attachmentPath && existsSync(attachmentPath)) {
  attachment = readJson(attachmentPath);
  if (attachment.format !== "transparent_ai_tlcl_rag_evidence_attachment_v1") blockers.push("rag_attachment_format_mismatch");
  if (attachment.locks?.ragDoesNotAuthorizeExecution !== true) blockers.push("rag_attachment_authorization_lock_missing");
  if (attachment.locks?.ragDoesNotEnableRules !== true) blockers.push("rag_attachment_rule_lock_missing");
  if (attachment.locks?.ragDoesNotWriteMemory !== true) blockers.push("rag_attachment_memory_lock_missing");
}
if (draftPackage) {
  const draftRules = Array.isArray(draftPackage.draftDisabledRules) ? draftPackage.draftDisabledRules : [];
  if (!draftRules.length) blockers.push("draft_package_has_no_draft_disabled_rules");
  if (draftRules.some((rule) => !Array.isArray(rule.evidenceRefs) || rule.evidenceRefs.length === 0)) {
    blockers.push("draft_rule_missing_reviewed_rag_evidence_refs");
  }
  if (!Array.isArray(draftPackage.teacherQuestionHandoff) || draftPackage.teacherQuestionHandoff.length === 0) {
    blockers.push("teacher_questions_missing_from_draft_package");
  }
  if (!Array.isArray(draftPackage.deterministicValidationPlan?.validatorExpectations) ||
      draftPackage.deterministicValidationPlan.validatorExpectations.length === 0) {
    blockers.push("deterministic_validator_expectations_missing");
  }
}

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const artifactPath = join(validationDir, "tlcl-rag-informed-deterministic-validation-artifact.json");
const validationReportPath = join(validationDir, "tlcl-rag-informed-deterministic-validation-report.json");
const packetPath = join(validationDir, "tlcl-rag-informed-deterministic-validation-package.json");
const receiptPath = join(validationDir, "tlcl-rag-informed-deterministic-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_RAG_INFORMED_DETERMINISTIC_VALIDATION_START_HERE.md");
const artifact = {
  artifact_id: `${validationId}.artifact`,
  artifact_type: "tlcl_rag_informed_repair_draft",
  schema_version: "0.1",
  units: "review_only_deterministic_validation",
  created_at: new Date().toISOString(),
  source_refs: [reviewInput.path, draftPackagePath, attachmentPath].filter(Boolean),
  context: {
    review_only: true,
    rag_evidence_non_authoritative: true,
    teacher_review_validation_path: reviewInput.path,
    draft_package_path: draftPackagePath,
    attachment_path: attachmentPath,
    teacher_question_count: draftPackage?.teacherQuestionHandoff?.length || 0,
    evidence_bound_rule_count: draftPackage?.draftDisabledRules?.length || 0,
    medium_runtime_retry_blocked: true,
    approval: { teacher_confirmed: false }
  },
  objects: []
};
writeJson(artifactPath, artifact);

let validationReport = null;
if (!blockers.length) {
  validationReport = await evaluateRulePackage({
    rulesPath: compiledRulePackagePath,
    artifactPath,
    outPath: validationReportPath
  });
  const rules = compiledRulePackage.rules || [];
  const skippedRows = (validationReport.results || []).filter((row) => row.status === "skipped" && row.validator === "lifecycle-gate");
  const nonSkippedRuleRows = (validationReport.results || []).filter((row) => row.rule_id !== "artifact-envelope" && row.status !== "skipped");
  if (skippedRows.length !== rules.length) blockers.push("draft_disabled_rules_must_appear_as_lifecycle_skipped_rows");
  if (nonSkippedRuleRows.length) blockers.push("draft_disabled_rules_must_not_evaluate_active_validators");
  if (validationReport.delivery_allowed !== true) blockers.push("disabled_rule_validation_report_must_not_block_delivery");
}

const finalStatus = blockers.length
  ? "blocked_before_rag_informed_deterministic_validation"
  : "rag_informed_deterministic_validation_ready_for_fingerprint_review";
const validationPackage = {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_deterministic_validation_package_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status: finalStatus,
  deterministicValidationRun: blockers.length === 0,
  readyForWorkflowFingerprintReview: blockers.length === 0,
  readyForMediumRuntime: false,
  mediumRuntimeRetryAllowed: false,
  ruleActivationAllowed: false,
  sourceEvidence: {
    repairDraftReviewValidationPath: reviewInput.path,
    repairDraftReviewValidationHash: sha256Object(review),
    draftPackagePath,
    draftPackageHash: draftPackage ? sha256Object(draftPackage) : "",
    compiledRulePackagePath,
    compiledRulePackageHash: compiledRulePackage ? sha256Object(compiledRulePackage) : "",
    attachmentPath,
    attachmentHash: attachment ? sha256Object(attachment) : ""
  },
  validationSummary: validationReport
    ? {
        validationReportStatus: validationReport.status,
        deliveryAllowed: validationReport.delivery_allowed,
        disabledRuleCount: (compiledRulePackage.rules || []).length,
        lifecycleSkippedRows: (validationReport.results || []).filter((row) => row.status === "skipped" && row.validator === "lifecycle-gate").length,
        activeRuleRowsEvaluated: (validationReport.results || []).filter((row) => row.lifecycle === "active").length,
        nonSkippedRuleRows: (validationReport.results || []).filter((row) => row.rule_id !== "artifact-envelope" && row.status !== "skipped").length,
        teacherQuestionCount: draftPackage?.teacherQuestionHandoff?.length || 0,
        evidenceBoundRuleCount: draftPackage?.draftDisabledRules?.length || 0
      }
    : null,
  nextReview: {
    instruction: "Review this deterministic validation package before workflow fingerprint review, approval-gate rebuild, or medium-runtime retry.",
    mayRunMediumRuntime: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteTargetSoftware: false,
    mayUnlockPackaging: false,
    mayTreatRagAsAuthority: false,
    nextAllowedReview: "workflow_fingerprint_review",
    requiredBeforeMediumRuntimeRetry: [
      "teacher reviews deterministic validation report",
      "workflow fingerprint review confirms repaired TLCL route semantics",
      "approval gate is rebuilt from reviewed repaired workflow evidence",
      "fresh outcome review is required after any later medium-runtime run"
    ]
  },
  blockers,
  paths: {
    package: packetPath,
    receipt: receiptPath,
    readme: readmePath,
    artifact: artifactPath,
    validationReport: validationReport ? validationReportPath : "",
    sourceReviewValidation: reviewInput.path,
    sourceDraftPackage: draftPackagePath,
    compiledRulePackage: compiledRulePackagePath,
    sourceAttachment: attachmentPath
  },
  locks: locks()
};
const receipt = {
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_deterministic_validation_receipt_v1",
  validationId,
  status: finalStatus,
  deterministicValidationRun: blockers.length === 0,
  readyForWorkflowFingerprintReview: blockers.length === 0,
  readyForMediumRuntime: false,
  mediumRuntimeRetryAllowed: false,
  approvedGateRunnerInvoked: false,
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

writeJson(packetPath, validationPackage);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL RAG-Informed Deterministic Validation",
    "",
    `Status: ${finalStatus}`,
    "",
    "This package runs deterministic Rule DSL validation for a teacher-reviewed RAG-informed draft_disabled repair package.",
    "It does not enable rules, run medium runtime, execute target software, write memory, unlock packaging, treat RAG as authority, or claim completion.",
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
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_deterministic_validation_package_result_v1",
      validationId,
      status: finalStatus,
      deterministicValidationRun: blockers.length === 0,
      readyForWorkflowFingerprintReview: blockers.length === 0,
      readyForMediumRuntime: false,
      validationPackagePath: packetPath,
      receiptPath,
      readmePath,
      validationReportPath: validationReport ? validationReportPath : "",
      blockerCount: blockers.length,
      mediumRuntimeRetryAllowed: false,
      approvedGateRunnerInvoked: false,
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
