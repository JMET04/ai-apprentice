#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-action-logic-source-contract-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-action-logic-source-contract-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_confirmed_logic_contract", "teacher_reviewed_logic_contract", "ready_for_logic_source_patch"].includes(text)) {
    return "teacher_confirmed_logic_contract";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
  if (
    [
      "accepted",
      "execute_now",
      "run_execute_mode",
      "memory_enabled",
      "claim_complete",
      "treat_rag_as_authority",
      "allow_medium_runtime_without_contract"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function textIncludes(value, needles = []) {
  const lower = String(value || "").toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotExecuteSoftware: true,
    validationDoesNotInvokeRunner: true,
    validationDoesNotEnableRules: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotTreatRagAsAuthority: true,
    mediumRuntimeStillRequiresMatrixAndTeacherGate: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# All-Software Action Logic Source Contract Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Ready patch rows: ${validation.readyPatchRowCount}`,
    "",
    "This validation can only emit matrix patch rows. It cannot execute software, invoke runners, enable rules, write memory, or authorize medium-runtime execution by itself.",
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.rowId}: ${row.status}`),
    "",
    validation.readyPatchRowCount
      ? `Matrix patch path: ${validation.paths.matrixPatch}`
      : "No matrix patch rows are ready yet."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate teacher-filled action logic source contracts.");
const packageInput = readJsonInput(
  argValue("--package", argValue("--contract-package", "")),
  "--package",
  "transparent_ai_all_software_action_logic_source_contract_package_v1"
);
if (!packageInput.value) throw new Error("--package is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_action_logic_source_contract_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-action-logic-source-contract-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const pkg = packageInput.value;
const receipt = receiptInput.value;
const packageRows = new Map((pkg.contractRows || []).map((row) => [row.rowId, row]));
const forbidden = new Set([
  "accepted",
  "execute_now",
  "run_execute_mode",
  "memory_enabled",
  "claim_complete",
  "treat_rag_as_authority",
  "allow_medium_runtime_without_contract"
]);

const validationRows = (receipt.rowDecisions || []).map((receiptRow) => {
  const packageRow = packageRows.get(receiptRow.rowId);
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const contract = receiptRow.correctedContract || {};
  const requiredFlags = [
    receiptRow.evidenceReviewed,
    receiptRow.actionIntentReviewed,
    receiptRow.targetBindingReviewed,
    receiptRow.dataToActionLogicReviewed,
    receiptRow.dataRelationshipsReviewed,
    receiptRow.geometryRelationshipsReviewed,
    receiptRow.targetSelectionLogicReviewed,
    receiptRow.uncertaintyBlockersReviewed,
    receiptRow.executionBoundaryReviewed,
    receiptRow.rollbackPolicyReviewed,
    receiptRow.rollbackPointReviewed,
    receiptRow.outcomeVerifierReviewed,
    receiptRow.validationEvidencePlanReviewed,
    receiptRow.ragEvidenceRoleReviewedAsEvidenceOnly,
    receiptRow.reasoningTierBoundaryReviewed,
    receiptRow.providerRoleUsePlanTraceReviewed
  ];
  const ragEvidenceOnly = String(contract.ragEvidenceRole || "") === "evidence_only_not_authority";
  const rollbackMentionsRetainedPoint =
    textIncludes(contract.rollbackPolicy, ["rollback", "restore", "checkpoint"]) &&
    textIncludes(contract.rollbackPolicy, ["retain", "retained", "point", "snapshot"]);
  const uncertaintyBlocksExecution = textIncludes(contract.uncertaintyAndBlockers, ["block", "stop", "unknown", "missing"]);
  const reasoningTierBoundaryReady =
    textIncludes(contract.reasoningTierBoundary, ["high", "highest", "repair", "compile"]) &&
    textIncludes(contract.reasoningTierBoundary, ["medium", "execute", "runtime"]) &&
    textIncludes(contract.mediumRuntimeReuseConditions, ["gate", "teacher", "validation", "matrix"]);
  const requiredTextReady =
    hasText(contract.actionIntent) &&
    hasText(contract.targetBinding) &&
    hasText(contract.dataToActionLogic) &&
    hasText(contract.dataRelationshipMap) &&
    hasText(contract.geometryRelationshipLogic) &&
    hasText(contract.targetSelectionLogic) &&
    hasText(contract.uncertaintyAndBlockers) &&
    hasText(contract.rollbackPolicy) &&
    hasText(contract.outcomeVerifier) &&
    hasText(contract.validationEvidencePlan) &&
    hasText(contract.reasoningTierBoundary) &&
    hasText(contract.mediumRuntimeReuseConditions) &&
    ragEvidenceOnly &&
    rollbackMentionsRetainedPoint &&
    uncertaintyBlocksExecution &&
    reasoningTierBoundaryReady;
  const ready =
    Boolean(packageRow) &&
    decision === "teacher_confirmed_logic_contract" &&
    !forbiddenDecision &&
    requiredFlags.every(Boolean) &&
    requiredTextReady;
  return {
    rowId: receiptRow.rowId,
    software: packageRow?.software || receiptRow.software || "",
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    status: !packageRow
      ? "unknown_contract_row"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : ready
          ? "ready_for_execution_matrix_logic_source_patch"
          : decision === "blocked_needs_more_evidence"
            ? "blocked_needs_more_evidence"
            : "needs_teacher_logic_source_review",
    canPatchMatrix: ready,
    missing: [
      ...(requiredFlags.every(Boolean) ? [] : ["teacher_review_flags"]),
      ...(requiredTextReady ? [] : ["complete_action_logic_contract_text"]),
      ...(hasText(contract.dataRelationshipMap) ? [] : ["data_relationship_map"]),
      ...(hasText(contract.geometryRelationshipLogic) ? [] : ["geometry_angle_position_relationships"]),
      ...(hasText(contract.targetSelectionLogic) ? [] : ["target_selection_logic"]),
      ...(uncertaintyBlocksExecution ? [] : ["uncertainty_blockers_must_stop_unknowns"]),
      ...(rollbackMentionsRetainedPoint ? [] : ["retained_rollback_point_policy"]),
      ...(hasText(contract.validationEvidencePlan) ? [] : ["validation_evidence_plan"]),
      ...(ragEvidenceOnly ? [] : ["rag_evidence_must_remain_non_authoritative"]),
      ...(reasoningTierBoundaryReady ? [] : ["high_medium_reasoning_boundary"])
    ],
    actionLogicSourceContract: ready
      ? {
          format: "transparent_ai_action_logic_source_contract_v1",
          rowId: receiptRow.rowId,
          software: packageRow.software,
          actionIntent: String(contract.actionIntent).trim(),
          targetBinding: String(contract.targetBinding).trim(),
          dataToActionLogic: String(contract.dataToActionLogic).trim(),
          dataRelationshipMap: String(contract.dataRelationshipMap).trim(),
          geometryRelationshipLogic: String(contract.geometryRelationshipLogic).trim(),
          targetSelectionLogic: String(contract.targetSelectionLogic).trim(),
          uncertaintyAndBlockers: String(contract.uncertaintyAndBlockers).trim(),
          controlRouteEvidence: String(contract.controlRouteEvidence || "").trim(),
          rollbackPolicy: String(contract.rollbackPolicy).trim(),
          outcomeVerifier: String(contract.outcomeVerifier).trim(),
          validationEvidencePlan: String(contract.validationEvidencePlan).trim(),
          ragEvidenceRole: "evidence_only_not_authority",
          reasoningTierBoundary: String(contract.reasoningTierBoundary).trim(),
          mediumRuntimeReuseConditions: String(contract.mediumRuntimeReuseConditions).trim(),
          providerRoleUsePlanTrace: String(contract.providerRoleUsePlanTrace || "").trim(),
          highReasoningCompiled: true,
          mediumRuntimeAllowed: false,
          mediumRuntimeBlockedUntil: "execution capability matrix is regenerated and teacher approval gate passes",
          accepted: false,
          ruleEnabled: false,
          packagingGated: true
        }
      : null
  };
});

const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const readyRows = validationRows.filter((row) => row.canPatchMatrix);
const lockState = locks();
const matrixPatchRows = readyRows.map((row) => ({
  rowId: row.rowId,
  software: row.software,
  actionLogicSourceStatus: "logic_source_contract_ready_for_review",
  actionLogicSourceContract: row.actionLogicSourceContract,
  logicSourceRequiredBeforeExecution: true,
  missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
  accepted: false,
  ruleEnabled: false,
  packagingGated: true
}));

const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyRows.length > 0
    ? "ready_for_execution_matrix_logic_source_patch"
    : "needs_teacher_review";
const status = forbiddenDecisionUsed
  ? "blocked"
  : readyRows.length > 0
    ? "validated_with_reviewed_logic_source_patch_rows"
    : "waiting_for_teacher_action_logic_source_review";

const validationPath = join(validationDir, "all-software-action-logic-source-contract-validation.json");
const matrixPatchPath = join(validationDir, "all-software-action-logic-source-contract-matrix-patch.json");
const receiptPath = join(validationDir, "all-software-action-logic-source-contract-validation-receipt.json");
const readmePath = join(validationDir, "ALL_SOFTWARE_ACTION_LOGIC_SOURCE_CONTRACT_VALIDATION_START_HERE.md");

const validation = {
  ok: !forbiddenDecisionUsed,
  format: "transparent_ai_all_software_action_logic_source_contract_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed,
  readyPatchRowCount: matrixPatchRows.length,
  validationRows,
  matrixPatch: {
    format: "transparent_ai_all_software_action_logic_source_contract_matrix_patch_v1",
    validationId,
    sourcePackage: packageInput.path,
    sourceReceipt: receiptInput.path,
    rows: matrixPatchRows,
    locks: lockState
  },
  blockedTransitions: [
    "execute_target_software_from_logic_source_validation",
    "invoke_runner_from_logic_source_validation",
    "enable_rule_from_logic_source_validation",
    "write_memory_from_logic_source_validation",
    "allow_medium_runtime_without_execution_gate",
    "claim_goal_complete_from_logic_source_validation"
  ],
  paths: {
    validation: validationPath,
    matrixPatch: matrixPatchPath,
    receipt: receiptPath,
    readme: readmePath,
    sourcePackage: packageInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: lockState
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(matrixPatchPath, `${JSON.stringify(validation.matrixPatch, null, 2)}\n`, "utf8");
writeFileSync(
  receiptPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_action_logic_source_contract_validation_receipt_v1",
      validationId,
      status,
      validationDecision,
      readyPatchRowCount: matrixPatchRows.length,
      forbiddenDecisionUsed,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      goalComplete: false,
      locks: lockState
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: !forbiddenDecisionUsed,
      format: "transparent_ai_all_software_action_logic_source_contract_validation_result_v1",
      validationId,
      status,
      validationDecision,
      readyPatchRowCount: matrixPatchRows.length,
      forbiddenDecisionUsed,
      validationPath,
      matrixPatchPath,
      receiptPath,
      readmePath,
      locks: lockState
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
