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
    String(value || "real-case-rule-dsl-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "real-case-rule-dsl-review-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["logic_matches", "matches_intended_logic", "ready_for_disabled_package_planning"].includes(decision)) return "logic_matches";
  if (["logic_mismatch_repair", "mismatch", "repair"].includes(decision)) return "logic_mismatch_repair";
  if (["request_more_evidence", "needs_more_evidence", "more_evidence"].includes(decision)) return "request_more_evidence";
  if (["accepted", "enable_rule", "compile_active_package", "execute_software", "write_memory", "fetch_rag", "unlock_packaging", "claim_complete"].includes(decision)) return decision;
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
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotUnlockPackaging: true,
    activeRulePackageCompiled: false,
    disabledRulePackageCompiled: false,
    ruleEnabled: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const prepInput = readJsonInput(argValue("--package", argValue("--preparation-package", "")), "--package", "transparent_ai_real_case_rule_dsl_preparation_package_v1");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_real_case_rule_dsl_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-rule-dsl-review-validations"))
);
const prep = prepInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbidden = new Set(["accepted", "enable_rule", "compile_active_package", "execute_software", "write_memory", "fetch_rag", "unlock_packaging", "claim_complete"]);
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (receipt.sourcePackageId !== prep.packageId) block("source_package_id_mismatch", "Receipt sourcePackageId must match packageId.");
if (receipt.sourcePackageHash !== hashText(JSON.stringify(prep))) block("source_package_hash_mismatch", "Receipt sourcePackageHash must match the preparation package.");
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
  if (decision === "logic_matches") {
    if (row.teacherReviewed !== true) block(`candidate_not_teacher_reviewed:${candidate.ruleId}`, `Teacher must review candidate: ${candidate.ruleId}`);
    if (row.evidenceReviewed !== true) block(`candidate_evidence_not_reviewed:${candidate.ruleId}`, `Teacher must review evidence refs: ${candidate.ruleId}`);
    if (row.lifecycleConfirmedDraftDisabled !== true) {
      block(`candidate_lifecycle_not_confirmed:${candidate.ruleId}`, `Teacher must confirm draft_disabled lifecycle: ${candidate.ruleId}`);
    }
    if (row.logicFitDecision !== "matches_intended_logic") {
      block(`candidate_logic_fit_not_confirmed:${candidate.ruleId}`, `Teacher must confirm logic fit: ${candidate.ruleId}`);
    }
  }
}

if (decision === "logic_matches") {
  if (receipt.rollbackRetained !== true) block("rollback_not_retained", "Teacher must confirm rollback is retained.");
  if (receipt.teacherConfirmedNoExecution !== true) block("no_execution_not_confirmed", "Teacher must confirm no execution now.");
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
  ? "blocked_for_forbidden_real_case_rule_dsl_review_decision"
  : readyForDisabledPackagePlanning
    ? "real_case_rule_dsl_review_ready_for_disabled_package_planning"
    : routesToHighReasoningRepair
      ? "real_case_rule_dsl_review_routes_to_high_reasoning_repair"
      : routesToMoreEvidence
        ? "real_case_rule_dsl_review_waiting_for_more_evidence"
        : "real_case_rule_dsl_review_needs_teacher_review";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "real-case-rule-dsl-review-validation.json");
const receiptRecordPath = join(validationDir, "real-case-rule-dsl-review-receipt.json");
const readmePath = join(validationDir, "REAL_CASE_RULE_DSL_REVIEW_VALIDATION_START_HERE.md");
const validationLocks = locks();
const disabledPackagePlanningHandoff = readyForDisabledPackagePlanning
  ? {
      format: "transparent_ai_real_case_rule_dsl_disabled_package_planning_handoff_v1",
      packageId: prep.packageId,
      caseType: prep.caseType,
      ruleDir: prep.paths?.ruleDir || "",
      rulePaths: candidateRows.map((row) => row.rulePath),
      ruleHashes: Object.fromEntries(candidateRows.map((row) => [row.ruleId, row.ruleHash])),
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\rules\\compile-rule-package.mjs --rules "' +
        (prep.paths?.ruleDir || "<draft-disabled-rule-cards-dir>") +
        '" --package-id "' +
        `${prep.packageId}.disabled_review` +
        '"',
      activePromotionAllowed: false,
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;
const highReasoningRepairHandoff = routesToHighReasoningRepair
  ? {
      format: "transparent_ai_real_case_rule_dsl_high_reasoning_repair_handoff_v1",
      packageId: prep.packageId,
      teacherNotes: receipt.teacherNotes || "",
      ruleRows: receiptRows,
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;
const moreEvidenceHandoff = routesToMoreEvidence
  ? {
      format: "transparent_ai_real_case_rule_dsl_more_evidence_handoff_v1",
      packageId: prep.packageId,
      teacherNotes: receipt.teacherNotes || "",
      requestedEvidenceKinds: ["source_artifact", "feature_to_data_relationship", "dimension_or_angle_formula", "knowledge_source", "rollback_point"],
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;

const result = {
  ok: !forbiddenDecisionUsed && blockers.length === 0,
  format: "transparent_ai_real_case_rule_dsl_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForDisabledPackagePlanning,
  routesToHighReasoningRepair,
  routesToMoreEvidence,
  forbiddenDecisionUsed,
  blockers,
  disabledPackagePlanningHandoff,
  highReasoningRepairHandoff,
  moreEvidenceHandoff,
  blockedActions: [
    "compile_active_rule_package_from_real_case_review",
    "enable_rule_from_real_case_review",
    "execute_software_from_real_case_review",
    "fetch_rag_from_real_case_review",
    "write_memory_from_real_case_review",
    "unlock_packaging_from_real_case_review",
    "claim_completion_from_real_case_review"
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
    "# Real Case Rule DSL Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation prepares only the selected manual next route. It does not compile active packages, enable rules, execute software, fetch RAG, write memory, unlock packaging, or claim completion.",
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
      format: "transparent_ai_real_case_rule_dsl_review_validation_result_v1",
      status,
      validationPath,
      receiptRecordPath,
      readmePath,
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
