#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { hashText, writeJson } from "./knowledge/knowledge-core.mjs";

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

function slug(value) {
  return (
    String(value || "confirmed-outcome-rule-dsl-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "confirmed-outcome-rule-dsl-review-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["logic_matches", "matches_intended_logic", "ready_for_disabled_package_planning"].includes(decision)) return "logic_matches";
  if (["logic_mismatch_repair", "mismatch", "repair"].includes(decision)) return "logic_mismatch_repair";
  if (["request_more_evidence", "needs_more_evidence", "more_evidence"].includes(decision)) return "request_more_evidence";
  if (
    [
      "accepted",
      "enable_rule",
      "compile_active_package",
      "mutate_rule_registry",
      "execute_software",
      "write_memory",
      "fetch_rag",
      "unlock_packaging",
      "claim_complete"
    ].includes(decision)
  ) {
    return decision;
  }
  if (decision === "blocked") return "blocked";
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    validatorDoesNotCompileActivePackage: true,
    validatorDoesNotCompileDisabledPackage: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotMutateRegistry: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotUnlockPackaging: true,
    draftRulesRemainDisabled: true,
    activeRulePackageCompiled: false,
    disabledRulePackageCompiled: false,
    sourceRuleFilesModified: false,
    productionRuleRegistryMutated: false,
    ruleEnabled: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    ragEvidenceTreatedAsAuthority: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

const prepInput = readJsonInput(
  argValue("--package", argValue("--preparation-package", "")),
  "--package",
  "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_preparation_package_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_receipt_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-rule-dsl-review-validations")
  )
);

const prep = prepInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbidden = new Set([
  "accepted",
  "enable_rule",
  "compile_active_package",
  "mutate_rule_registry",
  "execute_software",
  "write_memory",
  "fetch_rag",
  "unlock_packaging",
  "claim_complete"
]);
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (prep.status !== "confirmed_outcome_rule_dsl_draft_preparation_waiting_for_teacher_rule_review") {
  block("source_package_not_waiting_for_teacher_rule_review", "Source package must be waiting for teacher rule review.");
}
if (prep.proposedLifecycle !== "draft_disabled") block("source_package_not_draft_disabled", "Source package must propose draft_disabled lifecycle.");
if (prep.locks?.ruleEnabled !== false || prep.locks?.productionRuleRegistryMutated !== false || prep.locks?.rulePackageCompiled !== false) {
  block("source_package_locks_not_closed", "Source package must keep rule enablement, registry mutation, and package compilation locked.");
}
if (prep.confirmedOutcomeBranch !== true) {
  block("source_package_confirmed_outcome_branch_missing", "Source package must preserve confirmedOutcomeBranch=true.");
}
if (prep.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  block("source_package_review_format_mismatch", "Source package must preserve the confirmed-outcome source review format.");
}
if (!prep.sourceConfirmedOutcomeReviewId) {
  block("source_package_confirmed_outcome_review_id_missing", "Source package must preserve the original confirmed-outcome review id.");
}
if (!prep.sourceConfirmedOutcomeSourceRunId) {
  block("source_package_confirmed_outcome_source_run_id_missing", "Source package must preserve the original confirmed-outcome source run id.");
}
if (!prep.sourceRunId) {
  block("source_package_run_id_missing", "Source package must preserve the confirmed-outcome run id.");
}
if (receipt.sourcePackageId !== prep.packageId) block("source_package_id_mismatch", "Receipt sourcePackageId must match packageId.");
if (receipt.sourcePackageHash !== hashText(JSON.stringify(prep))) {
  block("source_package_hash_mismatch", "Receipt sourcePackageHash must match the preparation package.");
}
if (receipt.confirmedOutcomeBranch !== true) {
  block("receipt_confirmed_outcome_branch_missing", "Receipt must preserve confirmedOutcomeBranch=true from the source package.");
}
if (receipt.sourceReviewFormat !== prep.sourceReviewFormat) {
  block("receipt_source_review_format_mismatch", "Receipt sourceReviewFormat must match the source package.");
}
if (receipt.sourceConfirmedOutcomeReviewId !== prep.sourceConfirmedOutcomeReviewId) {
  block("receipt_confirmed_outcome_review_id_mismatch", "Receipt sourceConfirmedOutcomeReviewId must match the source package.");
}
if (receipt.sourceConfirmedOutcomeSourceRunId !== prep.sourceConfirmedOutcomeSourceRunId) {
  block(
    "receipt_confirmed_outcome_source_run_id_mismatch",
    "Receipt sourceConfirmedOutcomeSourceRunId must match the source package."
  );
}
if (receipt.sourceRunId !== prep.sourceRunId) {
  block("receipt_source_run_id_mismatch", "Receipt sourceRunId must match the source package.");
}
if (receipt.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");
if (forbidden.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);

const candidateRows = Array.isArray(prep.candidateRows) ? prep.candidateRows : [];
const receiptRows = Array.isArray(receipt.reviewedCandidateRows) ? receipt.reviewedCandidateRows : [];
const receiptByRuleId = new Map(receiptRows.map((row) => [row.ruleId, row]));
for (const candidate of candidateRows) {
  const row = receiptByRuleId.get(candidate.ruleId);
  if (!row) {
    block(`missing_candidate_review:${candidate.ruleId}`, `Missing candidate review row: ${candidate.ruleId}`);
    continue;
  }
  if (row.candidateRuleHash !== candidate.ruleHash) block(`candidate_hash_mismatch:${candidate.ruleId}`, `Candidate hash mismatch: ${candidate.ruleId}`);
  if (row.lifecycle !== "draft_disabled" || candidate.lifecycle !== "draft_disabled") {
    block(`candidate_lifecycle_not_draft_disabled:${candidate.ruleId}`, `Candidate must remain draft_disabled: ${candidate.ruleId}`);
  }
  if (candidate.dslValidationOk !== true || row.dslValidationOk !== true) {
    block(`candidate_dsl_validation_not_ok:${candidate.ruleId}`, `Candidate DSL validation must be ok: ${candidate.ruleId}`);
  }
  if (candidate.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
    block(`candidate_source_review_format_mismatch:${candidate.ruleId}`, `Candidate must preserve confirmed-outcome source review format: ${candidate.ruleId}`);
  }
  if (!candidate.sourceConfirmedOutcomeReviewId) {
    block(`candidate_confirmed_outcome_review_id_missing:${candidate.ruleId}`, `Candidate must preserve confirmed-outcome review id: ${candidate.ruleId}`);
  }
  if (!candidate.sourceConfirmedOutcomeSourceRunId) {
    block(
      `candidate_confirmed_outcome_source_run_id_missing:${candidate.ruleId}`,
      `Candidate must preserve confirmed-outcome source run id: ${candidate.ruleId}`
    );
  }
  if (!candidate.sourceRunId) {
    block(`candidate_source_run_id_missing:${candidate.ruleId}`, `Candidate must preserve confirmed-outcome run id: ${candidate.ruleId}`);
  }
  if (row.sourceReviewFormat !== candidate.sourceReviewFormat) {
    block(`candidate_receipt_source_review_format_mismatch:${candidate.ruleId}`, `Receipt row sourceReviewFormat must match candidate: ${candidate.ruleId}`);
  }
  if (row.sourceConfirmedOutcomeReviewId !== candidate.sourceConfirmedOutcomeReviewId) {
    block(`candidate_receipt_confirmed_outcome_review_id_mismatch:${candidate.ruleId}`, `Receipt row confirmed-outcome review id must match candidate: ${candidate.ruleId}`);
  }
  if (row.sourceConfirmedOutcomeSourceRunId !== candidate.sourceConfirmedOutcomeSourceRunId) {
    block(
      `candidate_receipt_confirmed_outcome_source_run_id_mismatch:${candidate.ruleId}`,
      `Receipt row confirmed-outcome source run id must match candidate: ${candidate.ruleId}`
    );
  }
  if (row.sourceRunId !== candidate.sourceRunId) {
    block(`candidate_receipt_source_run_id_mismatch:${candidate.ruleId}`, `Receipt row sourceRunId must match candidate: ${candidate.ruleId}`);
  }
  if (row.controlledOutputSha256 && candidate.controlledOutputSha256 && row.controlledOutputSha256 !== candidate.controlledOutputSha256) {
    block(`controlled_output_hash_mismatch:${candidate.ruleId}`, `Controlled output hash mismatch: ${candidate.ruleId}`);
  }
  if (decision === "logic_matches") {
    if (row.teacherReviewed !== true) block(`candidate_not_teacher_reviewed:${candidate.ruleId}`, `Teacher must review candidate: ${candidate.ruleId}`);
    if (row.evidenceReviewed !== true) block(`candidate_evidence_not_reviewed:${candidate.ruleId}`, `Teacher must review evidence refs: ${candidate.ruleId}`);
    if (row.lifecycleConfirmedDraftDisabled !== true) {
      block(`candidate_lifecycle_not_confirmed:${candidate.ruleId}`, `Teacher must confirm draft_disabled lifecycle: ${candidate.ruleId}`);
    }
    if (row.controlledOutputHashReviewed !== true) {
      block(`controlled_output_hash_not_reviewed:${candidate.ruleId}`, `Teacher must review controlled output hash: ${candidate.ruleId}`);
    }
    if (row.logicFitDecision !== "matches_intended_logic") {
      block(`candidate_logic_fit_not_confirmed:${candidate.ruleId}`, `Teacher must confirm logic fit: ${candidate.ruleId}`);
    }
  }
}

if (decision === "logic_matches") {
  if (receipt.rollbackRetained !== true) block("rollback_not_retained", "Teacher must confirm rollback is retained.");
  if (receipt.teacherConfirmedNoExecution !== true) block("no_execution_not_confirmed", "Teacher must confirm no execution now.");
  if (receipt.teacherConfirmedNoRegistryMutation !== true) block("no_registry_mutation_not_confirmed", "Teacher must confirm no registry mutation.");
  if (receipt.teacherConfirmedNoRuleEnablement !== true) block("no_rule_enablement_not_confirmed", "Teacher must confirm no rule enablement.");
  if (receipt.teacherConfirmedNoRagAuthority !== true) block("no_rag_authority_not_confirmed", "Teacher must confirm no RAG authority.");
}
if (decision === "logic_mismatch_repair" && !String(receipt.teacherNotes || "").trim()) {
  block("repair_note_missing", "Logic mismatch repair requires teacherNotes.");
}
if (decision === "request_more_evidence" && !String(receipt.teacherNotes || "").trim()) {
  block("evidence_request_note_missing", "Request more evidence requires teacherNotes.");
}

const forbiddenDecisionUsed = forbidden.has(decision);
const readyForDisabledPackagePlanning = decision === "logic_matches" && blockers.length === 0;
const routesToHighReasoningRepair = decision === "logic_mismatch_repair" && !forbiddenDecisionUsed && blockers.length === 0;
const routesToMoreEvidence = decision === "request_more_evidence" && !forbiddenDecisionUsed && blockers.length === 0;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_confirmed_outcome_rule_dsl_review_decision"
  : readyForDisabledPackagePlanning
    ? "confirmed_outcome_rule_dsl_review_ready_for_disabled_package_planning"
    : routesToHighReasoningRepair
      ? "confirmed_outcome_rule_dsl_review_routes_to_high_reasoning_repair"
      : routesToMoreEvidence
        ? "confirmed_outcome_rule_dsl_review_waiting_for_more_evidence"
        : "confirmed_outcome_rule_dsl_review_needs_teacher_review";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "real-case-confirmed-outcome-rule-dsl-review-validation.json");
const receiptRecordPath = join(validationDir, "real-case-confirmed-outcome-rule-dsl-review-receipt.json");
const readmePath = join(validationDir, "REAL_CASE_CONFIRMED_OUTCOME_RULE_DSL_REVIEW_VALIDATION_START_HERE.md");
const validationLocks = locks();
const sourceContext = {
  confirmedOutcomeBranch: prep.confirmedOutcomeBranch === true,
  sourceReviewFormat: prep.sourceReviewFormat || "",
  sourceConfirmedOutcomeReviewId: prep.sourceConfirmedOutcomeReviewId || "",
  sourceConfirmedOutcomeSourceRunId: prep.sourceConfirmedOutcomeSourceRunId || "",
  sourceRunId: prep.sourceRunId || ""
};
const disabledPackagePlanningHandoff = readyForDisabledPackagePlanning
  ? {
      format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_disabled_package_planning_handoff_v1",
      confirmedOutcomeBranch: sourceContext.confirmedOutcomeBranch,
      sourceReviewFormat: sourceContext.sourceReviewFormat,
      sourceConfirmedOutcomeReviewId: sourceContext.sourceConfirmedOutcomeReviewId,
      sourceConfirmedOutcomeSourceRunId: sourceContext.sourceConfirmedOutcomeSourceRunId,
      sourceRunId: sourceContext.sourceRunId,
      packageId: prep.packageId,
      sourceLifecycleGatePath: prep.sourceLifecycleGatePath || "",
      sourceRuleDraftPackagePath: prepInput.path,
      sourceRuleDraftPackageHash: hashText(JSON.stringify(prep)),
      ruleDir: prep.paths?.ruleDir || "",
      rulePaths: candidateRows.map((row) => row.rulePath),
      ruleHashes: Object.fromEntries(candidateRows.map((row) => [row.ruleId, row.ruleHash])),
      controlledOutputHashes: Object.fromEntries(candidateRows.map((row) => [row.ruleId, row.controlledOutputSha256 || ""])),
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\rules\\compile-rule-package.mjs --rules "' +
        (prep.paths?.ruleDir || "<draft-disabled-rule-cards-dir>") +
        '" --package-id "' +
        `${prep.packageId}.disabled_review` +
        '"',
      activePromotionAllowed: false,
      productionRegistryMutationAllowed: false,
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;
const highReasoningRepairHandoff = routesToHighReasoningRepair
  ? {
      format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_high_reasoning_repair_handoff_v1",
      confirmedOutcomeBranch: sourceContext.confirmedOutcomeBranch,
      sourceReviewFormat: sourceContext.sourceReviewFormat,
      sourceConfirmedOutcomeReviewId: sourceContext.sourceConfirmedOutcomeReviewId,
      sourceConfirmedOutcomeSourceRunId: sourceContext.sourceConfirmedOutcomeSourceRunId,
      sourceRunId: sourceContext.sourceRunId,
      packageId: prep.packageId,
      sourceRuleDraftPackagePath: prepInput.path,
      teacherNotes: receipt.teacherNotes || "",
      ruleRows: receiptRows,
      requiredReasoningTier: "high",
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;
const moreEvidenceHandoff = routesToMoreEvidence
  ? {
      format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_more_evidence_handoff_v1",
      confirmedOutcomeBranch: sourceContext.confirmedOutcomeBranch,
      sourceReviewFormat: sourceContext.sourceReviewFormat,
      sourceConfirmedOutcomeReviewId: sourceContext.sourceConfirmedOutcomeReviewId,
      sourceConfirmedOutcomeSourceRunId: sourceContext.sourceConfirmedOutcomeSourceRunId,
      sourceRunId: sourceContext.sourceRunId,
      packageId: prep.packageId,
      teacherNotes: receipt.teacherNotes || "",
      requestedEvidenceKinds: ["controlled_output", "rule_activation_candidate", "feature_to_data_relationship", "lifecycle_gate", "rollback_point"],
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;

const result = {
  ok: !forbiddenDecisionUsed && blockers.length === 0,
  format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  confirmedOutcomeBranch: sourceContext.confirmedOutcomeBranch,
  sourceReviewFormat: sourceContext.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: sourceContext.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: sourceContext.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: sourceContext.sourceRunId,
  readyForDisabledPackagePlanning,
  routesToHighReasoningRepair,
  routesToMoreEvidence,
  forbiddenDecisionUsed,
  blockers,
  disabledPackagePlanningHandoff,
  highReasoningRepairHandoff,
  moreEvidenceHandoff,
  blockedActions: [
    "compile_active_rule_package_from_confirmed_outcome_review",
    "enable_rule_from_confirmed_outcome_review",
    "mutate_production_rule_registry_from_confirmed_outcome_review",
    "execute_software_from_confirmed_outcome_review",
    "fetch_rag_from_confirmed_outcome_review",
    "write_memory_from_confirmed_outcome_review",
    "unlock_packaging_from_confirmed_outcome_review",
    "claim_completion_from_confirmed_outcome_review"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    receiptRecord: receiptRecordPath,
    readme: readmePath,
    sourcePackage: prepInput.path,
    sourceReceipt: receiptInput.path
  }
};

mkdirSync(dirname(validationPath), { recursive: true });
writeJson(validationPath, result);
writeJson(receiptRecordPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Real Case Confirmed Outcome Rule DSL Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation prepares only the selected manual next route. It does not compile packages, enable rules, mutate the registry, execute software, fetch RAG, write memory, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((row) => `- ${row.code}: ${row.message}`) : ["- none"])
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: result.ok,
      format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_validation_result_v1",
      status,
      validationPath,
      receiptRecordPath,
      readmePath,
      confirmedOutcomeBranch: sourceContext.confirmedOutcomeBranch,
      sourceReviewFormat: sourceContext.sourceReviewFormat,
      sourceConfirmedOutcomeReviewId: sourceContext.sourceConfirmedOutcomeReviewId,
      sourceConfirmedOutcomeSourceRunId: sourceContext.sourceConfirmedOutcomeSourceRunId,
      sourceRunId: sourceContext.sourceRunId,
      readyForDisabledPackagePlanning,
      disabledPackagePlanningHandoff,
      highReasoningRepairHandoff,
      moreEvidenceHandoff,
      blockers,
      executeNow: false,
      locks: validationLocks
    },
    null,
    2
  )
);
