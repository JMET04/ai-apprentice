#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-execution-gap-review-cockpit-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-execution-gap-review-cockpit-receipt-validation"
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

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_ready_for_control_and_logic_receipts", "teacher_reviewed_combined_execution_gap"].includes(text)) {
    return "teacher_ready_for_control_and_logic_receipts";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
  if (
    [
      "accepted",
      "execute_now",
      "run_probe_now",
      "run_execute_mode",
      "create_control_profile_now",
      "memory_enabled",
      "claim_complete",
      "native_universal_execution",
      "allow_medium_runtime_without_contract"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function allChecklistTrue(checklist = {}) {
  const required = [
    "controlChannelEvidenceReviewed",
    "actionIntentReviewed",
    "targetBindingReviewed",
    "dataToActionLogicReviewed",
    "dataRelationshipMapReviewed",
    "geometryAnglePositionDepthReviewed",
    "targetSelectionLogicReviewed",
    "rollbackPolicyReviewed",
    "outcomeVerifierReviewed",
    "reasoningTierBoundaryReviewed"
  ];
  return required.every((field) => checklist[field] === true);
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRunControlValidator: true,
    validationDoesNotRunActionLogicValidator: true,
    validationDoesNotRunProbe: true,
    validationDoesNotCreateProfile: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotInvokeRunner: true,
    validationDoesNotEnableRules: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotAllowMediumRuntime: true,
    probeRan: false,
    controlProfileCreated: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Execution Gap Review Cockpit Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Rows ready for downstream receipt validation: ${validation.counts.rowsReadyForDownstreamReceiptValidation}`,
    "",
    "This validation bridges the combined teacher cockpit into two existing machine-checkable receipt paths.",
    "",
    `- Control-channel receipt draft: ${validation.paths.controlChannelReceiptDraft}`,
    `- Action-logic receipt draft: ${validation.paths.actionLogicReceiptDraft}`,
    `- Control-channel validation command: ${validation.nextValidationCommands.controlChannel || ""}`,
    `- Action-logic validation command: ${validation.nextValidationCommands.actionLogic || ""}`,
    "",
    "Safety boundary:",
    "- This script does not run the downstream validators.",
    "- It does not run probes, create profiles, execute target software, send UI events, capture screenshots, write memory, enable rules, or claim native universal execution.",
    "- A medium-runtime execution path remains blocked until both downstream validations pass and the later execution approval gate is teacher-confirmed with a retained rollback point."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate teacher-filled execution gap review cockpit receipt.");
const cockpitInput = readJsonInput(
  argValue("--cockpit", ""),
  "--cockpit",
  "transparent_ai_all_software_execution_gap_review_cockpit_v1"
);
if (!cockpitInput.value) throw new Error("--cockpit is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_execution_gap_review_cockpit_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-gap-review-cockpit-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const cockpit = cockpitInput.value;
const receipt = receiptInput.value;
const controlBuilderPath = cockpit.paths?.sourceControlChannelBuilder || "";
const actionPackagePath = cockpit.paths?.sourceActionLogicPackage || "";
const controlBuilder = controlBuilderPath && existsSync(controlBuilderPath) ? readJson(controlBuilderPath) : {};
const actionPackage = actionPackagePath && existsSync(actionPackagePath) ? readJson(actionPackagePath) : {};
const sourceRepairQueue = controlBuilder.paths?.sourceRepairQueue || "";
const cockpitRows = new Map((cockpit.reviewRows || []).map((row) => [row.rowId, row]));
const forbidden = new Set([
  "accepted",
  "execute_now",
  "run_probe_now",
  "run_execute_mode",
  "create_control_profile_now",
  "memory_enabled",
  "claim_complete",
  "native_universal_execution",
  "allow_medium_runtime_without_contract"
]);

const validationRows = (receipt.rowDecisions || []).map((receiptRow) => {
  const cockpitRow = cockpitRows.get(receiptRow.rowId);
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const checklistReady = allChecklistTrue(receiptRow.checklist || {});
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const hasBothReviews =
    cockpitRow?.controlChannelReview?.present === true && cockpitRow?.actionLogicReview?.present === true;
  const ready =
    Boolean(cockpitRow) &&
    hasBothReviews &&
    decision === "teacher_ready_for_control_and_logic_receipts" &&
    checklistReady &&
    evidenceReviewed &&
    !forbiddenDecision;
  return {
    rowId: receiptRow.rowId,
    sourceRowId: cockpitRow?.sourceRowId || receiptRow.sourceRowId || "",
    software: cockpitRow?.software || receiptRow.software || "",
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    evidenceReviewed,
    checklistReady,
    hasControlChannelReview: cockpitRow?.controlChannelReview?.present === true,
    hasActionLogicReview: cockpitRow?.actionLogicReview?.present === true,
    status: !cockpitRow
      ? "unknown_cockpit_row"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : ready
          ? "ready_for_downstream_control_and_logic_receipt_validation"
          : decision === "blocked_needs_more_evidence"
            ? "blocked_needs_more_evidence"
            : "needs_teacher_combined_execution_gap_review",
    canPrepareDownstreamReceipts: ready,
    missing: [
      ...(cockpitRow ? [] : ["known_cockpit_row"]),
      ...(hasBothReviews ? [] : ["control_channel_and_action_logic_reviews"]),
      ...(evidenceReviewed ? [] : ["evidence_reviewed"]),
      ...(checklistReady ? [] : ["combined_teacher_checklist"]),
      ...(decision === "teacher_ready_for_control_and_logic_receipts" ? [] : ["teacher_ready_decision"])
    ],
    blockedTransitions: [
      "execute_target_software_from_cockpit_validation",
      "run_probe_from_cockpit_validation",
      "create_control_profile_from_cockpit_validation",
      "enable_rule_from_cockpit_validation",
      "write_memory_from_cockpit_validation",
      "allow_medium_runtime_from_cockpit_validation",
      "claim_goal_complete_from_cockpit_validation"
    ]
  };
});

const readyRows = validationRows.filter((row) => row.canPrepareDownstreamReceipts);
const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const waitingRows = validationRows.filter((row) => !row.canPrepareDownstreamReceipts && row.status !== "blocked_for_forbidden_decision");
const lockState = locks();
const controlReceiptPath = join(validationDir, "derived-control-channel-repair-review-receipt.json");
const actionLogicReceiptPath = join(validationDir, "derived-action-logic-source-contract-receipt.json");
const validationPath = join(validationDir, "all-software-execution-gap-review-cockpit-receipt-validation.json");
const readmePath = join(validationDir, "ALL_SOFTWARE_EXECUTION_GAP_REVIEW_COCKPIT_RECEIPT_VALIDATION_START_HERE.md");

const controlReceipt = {
  format: "transparent_ai_all_software_control_channel_repair_review_receipt_v1",
  templateOnly: false,
  defaultDecision: "needs_teacher_review",
  builderId: controlBuilder.builderId || "",
  sourceRepairQueue,
  decision: readyRows.length > 0 && waitingRows.length === 0 ? "teacher_reviewed_prepare_control_channel_receipts" : "needs_teacher_review",
  itemDecisions: (cockpit.reviewRows || [])
    .filter((row) => row.controlChannelReview?.present === true)
    .map((row) => {
      const validationRow = validationRows.find((candidate) => candidate.rowId === row.rowId);
      const ready = validationRow?.canPrepareDownstreamReceipts === true;
      const nextTool = String(row.controlChannelReview?.nextTool || "").toLowerCase();
      return {
        itemId: row.controlChannelReview.itemId || "",
        software: row.software,
        sourceRowId: row.sourceRowId,
        evidencePath: row.controlChannelReview.evidencePath || "",
        probePlanPath: row.controlChannelReview.probePlanPath || "",
        probeResultTemplatePath: row.controlChannelReview.probeResultTemplatePath || "",
        teacherReadmePath: row.controlChannelReview.teacherReadmePath || "",
        nextProfileRequestPath: row.controlChannelReview.nextProfileRequestPath || "",
        actionLogicSourceStatus: row.controlChannelReview.actionLogicSourceStatus || row.actionLogicReview?.currentStatus || "",
        teacherDecision: ready
          ? nextTool.includes("probe")
            ? "teacher_reviewed_prepare_read_only_probe"
            : "teacher_reviewed_prepare_control_profile"
          : validationRow?.status === "blocked_needs_more_evidence"
            ? "blocked_needs_more_evidence"
            : "needs_teacher_review",
        evidenceReviewed: ready,
        teacherNote: validationRow?.status || ""
      };
    }),
  sourceCockpitValidation: validationPath,
  blockedTeacherDecisions: [
    "accepted",
    "execute_now",
    "run_probe_now",
    "run_execute_mode",
    "memory_enabled",
    "claim_complete",
    "native_universal_execution"
  ],
  locks: lockState
};

const actionLogicReceipt = {
  format: "transparent_ai_all_software_action_logic_source_contract_receipt_v1",
  packageId: actionPackage.packageId || "",
  decision: readyRows.length > 0 && waitingRows.length === 0 ? "teacher_confirmed_logic_contract" : "needs_teacher_review",
  rowDecisions: (cockpit.reviewRows || [])
    .filter((row) => row.actionLogicReview?.present === true)
    .map((row) => {
      const receiptRow = (receipt.rowDecisions || []).find((candidate) => candidate.rowId === row.rowId) || {};
      const validationRow = validationRows.find((candidate) => candidate.rowId === row.rowId);
      const ready = validationRow?.canPrepareDownstreamReceipts === true;
      const checklist = receiptRow.checklist || {};
      return {
        rowId: row.actionLogicReview.rowId || row.sourceRowId || "",
        software: row.software,
        teacherDecision: ready
          ? "teacher_confirmed_logic_contract"
          : validationRow?.status === "blocked_needs_more_evidence"
            ? "blocked_needs_more_evidence"
            : "needs_teacher_review",
        evidenceReviewed: ready,
        actionIntentReviewed: ready && checklist.actionIntentReviewed === true,
        targetBindingReviewed: ready && checklist.targetBindingReviewed === true,
        dataToActionLogicReviewed: ready && checklist.dataToActionLogicReviewed === true,
        dataRelationshipsReviewed: ready && checklist.dataRelationshipMapReviewed === true,
        geometryRelationshipsReviewed: ready && checklist.geometryAnglePositionDepthReviewed === true,
        targetSelectionLogicReviewed: ready && checklist.targetSelectionLogicReviewed === true,
        uncertaintyBlockersReviewed: ready,
        executionBoundaryReviewed: ready,
        rollbackPolicyReviewed: ready && checklist.rollbackPolicyReviewed === true,
        rollbackPointReviewed: ready && checklist.rollbackPolicyReviewed === true,
        outcomeVerifierReviewed: ready && checklist.outcomeVerifierReviewed === true,
        validationEvidencePlanReviewed: ready,
        ragEvidenceRoleReviewedAsEvidenceOnly: ready,
        reasoningTierBoundaryReviewed: ready && checklist.reasoningTierBoundaryReviewed === true,
        providerRoleUsePlanTraceReviewed: ready,
        correctedContract: receiptRow.teacherCorrectedActionLogicContract || row.actionLogicReview.draftContract || {},
        teacherNote: receiptRow.teacherNote || validationRow?.status || ""
      };
    }),
  sourceCockpitValidation: validationPath,
  locks: lockState
};

const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyRows.length > 0 && waitingRows.length === 0
    ? "ready_for_downstream_control_and_logic_receipt_validation"
    : readyRows.length > 0
      ? "partially_ready_for_downstream_control_and_logic_receipt_validation"
      : "needs_teacher_review";
const status = forbiddenDecisionUsed
  ? "blocked"
  : readyRows.length > 0
    ? "validated_with_downstream_receipt_drafts"
    : "waiting_for_teacher_execution_gap_review";
const nextValidationCommands = {
  controlChannel:
    readyRows.length > 0 && sourceRepairQueue
      ? commandLine("validate-all-software-control-channel-repair-receipt.mjs", [
          ["--repair-queue", sourceRepairQueue],
          ["--receipt", controlReceiptPath],
          ["--output-dir", join(validationDir, "control-channel-repair-validation")]
        ])
      : "",
  actionLogic:
    readyRows.length > 0 && actionPackagePath
      ? commandLine("validate-all-software-action-logic-source-contract-receipt.mjs", [
          ["--package", actionPackagePath],
          ["--receipt", actionLogicReceiptPath],
          ["--output-dir", join(validationDir, "action-logic-source-validation")]
        ])
      : ""
};

const validation = {
  ok: !forbiddenDecisionUsed,
  format: "transparent_ai_all_software_execution_gap_review_cockpit_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed,
  counts: {
    receiptRows: (receipt.rowDecisions || []).length,
    rowsReadyForDownstreamReceiptValidation: readyRows.length,
    rowsWaitingForTeacherReview: waitingRows.length
  },
  validationRows,
  nextValidationCommands,
  blockedTransitions: [
    "run_downstream_validators_automatically",
    "execute_target_software_from_cockpit_validation",
    "run_probe_from_cockpit_validation",
    "create_control_profile_from_cockpit_validation",
    "enable_rule_from_cockpit_validation",
    "write_memory_from_cockpit_validation",
    "allow_medium_runtime_from_cockpit_validation",
    "claim_goal_complete_from_cockpit_validation"
  ],
  paths: {
    validation: validationPath,
    readme: readmePath,
    sourceCockpit: cockpitInput.path,
    sourceReceipt: receiptInput.path,
    sourceControlChannelBuilder: controlBuilderPath,
    sourceRepairQueue,
    sourceActionLogicPackage: actionPackagePath,
    controlChannelReceiptDraft: controlReceiptPath,
    actionLogicReceiptDraft: actionLogicReceiptPath
  },
  locks: lockState
};

writeFileSync(controlReceiptPath, `${JSON.stringify(controlReceipt, null, 2)}\n`, "utf8");
writeFileSync(actionLogicReceiptPath, `${JSON.stringify(actionLogicReceipt, null, 2)}\n`, "utf8");
writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: !forbiddenDecisionUsed,
      format: "transparent_ai_all_software_execution_gap_review_cockpit_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      readyRowCount: readyRows.length,
      waitingRowCount: waitingRows.length,
      forbiddenDecisionUsed,
      validationPath,
      controlChannelReceiptDraftPath: controlReceiptPath,
      actionLogicReceiptDraftPath: actionLogicReceiptPath,
      readmePath,
      nextValidationCommands,
      locks: lockState
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
