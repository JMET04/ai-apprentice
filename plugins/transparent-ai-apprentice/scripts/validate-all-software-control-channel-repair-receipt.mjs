#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-control-channel-repair-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-control-channel-repair-receipt-validation"
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
  if (["teacher_reviewed_prepare_control_profile", "ready_for_control_profile_review"].includes(text)) {
    return "teacher_reviewed_prepare_control_profile";
  }
  if (["teacher_reviewed_prepare_read_only_probe", "ready_for_read_only_probe_review"].includes(text)) {
    return "teacher_reviewed_prepare_read_only_probe";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
  if (["accepted", "execute_now", "run_probe_now", "run_execute_mode", "memory_enabled", "claim_complete", "native_universal_execution"].includes(text)) return text;
  return "needs_teacher_review";
}

function evidenceReferencesFor(item, receiptRow) {
  return {
    sourceRowId: item?.sourceRowId || receiptRow.sourceRowId || "",
    sourceFollowUpBatch: item?.sourceFollowUpBatch || "",
    evidencePath: item?.evidencePath || receiptRow.evidencePath || "",
    probePlanPath: item?.probePlanPath || receiptRow.probePlanPath || "",
    probeResultTemplatePath: item?.probeResultTemplatePath || receiptRow.probeResultTemplatePath || "",
    teacherReadmePath: item?.teacherReadmePath || receiptRow.teacherReadmePath || "",
    nextProfileRequestPath: item?.nextProfileRequestPath || receiptRow.nextProfileRequestPath || "",
    actionLogicSourceStatus: item?.actionLogicSourceStatus || receiptRow.actionLogicSourceStatus || ""
  };
}

function hasConcreteEvidenceReference(references) {
  return Boolean(
    references.evidencePath ||
      references.probePlanPath ||
      references.probeResultTemplatePath ||
      references.teacherReadmePath ||
      references.nextProfileRequestPath
  );
}

function writeReadme(path, validation) {
  const lines = [
    "# All-Software Control Channel Repair Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.itemId}: ${row.status}`),
    "",
    "Prepared next review commands:",
    ...validation.nextReviewCommands.map((command, index) => `${index + 1}. ${command.itemId}: ${command.tool} ${JSON.stringify(command.arguments)}`),
    "",
    "Safety boundary:",
    "- This validation does not run control-channel probes or profiles.",
    "- It does not execute target software, send UI events, capture screenshots, write memory, enable rules, or claim native control."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate all-software control-channel repair teacher receipt.");
const queueInput = readJsonInput(
  argValue("--repair-queue", argValue("--queue", "")),
  "--repair-queue",
  "transparent_ai_all_software_control_channel_repair_queue_v1"
);
if (!queueInput.value) throw new Error("--repair-queue is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_control_channel_repair_review_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-control-channel-repair-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const queue = queueInput.value;
const receipt = receiptInput.value;
const queueItems = new Map((queue.items || []).map((item) => [item.itemId, item]));
const forbidden = new Set(["accepted", "execute_now", "run_probe_now", "run_execute_mode", "memory_enabled", "claim_complete", "native_universal_execution"]);

const validationRows = (receipt.itemDecisions || []).map((receiptRow) => {
  const item = queueItems.get(receiptRow.itemId);
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const evidenceReferences = evidenceReferencesFor(item, receiptRow);
  const forbiddenDecision = forbidden.has(decision);
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const canPrepareProfileReview =
    Boolean(item) && decision === "teacher_reviewed_prepare_control_profile" && evidenceReviewed && !forbiddenDecision;
  const canPrepareProbeReview =
    Boolean(item) && decision === "teacher_reviewed_prepare_read_only_probe" && evidenceReviewed && !forbiddenDecision;
  const tool = canPrepareProbeReview ? "create_software_control_channel_probe" : "create_software_control_channel_profile";
  return {
    itemId: receiptRow.itemId,
    software: item?.software || receiptRow.software || "",
    queueStatus: item?.status || "unknown",
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    evidenceReviewed,
    evidenceReferences,
    evidenceReferencePresent: hasConcreteEvidenceReference(evidenceReferences),
    status: !item
      ? "unknown_queue_item"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : canPrepareProfileReview
          ? "ready_for_control_profile_review"
          : canPrepareProbeReview
            ? "ready_for_read_only_probe_review"
            : decision === "blocked_needs_more_evidence"
              ? "blocked_needs_more_evidence"
              : "needs_teacher_review_or_evidence",
    canPrepareReview: canPrepareProfileReview || canPrepareProbeReview,
    nextReviewCommand:
      canPrepareProfileReview || canPrepareProbeReview
        ? {
            itemId: receiptRow.itemId,
            tool,
            arguments: {
              goal,
              software: item.software,
              sourceRowId: evidenceReferences.sourceRowId,
              evidenceReferences,
              probePlanPath: evidenceReferences.probePlanPath,
              probeResultTemplatePath: evidenceReferences.probeResultTemplatePath,
              teacherReadmePath: evidenceReferences.teacherReadmePath,
              nextProfileRequestPath: evidenceReferences.nextProfileRequestPath,
              requiresTeacherCompletedProbeResultBeforeProfileTrust: Boolean(evidenceReferences.probeResultTemplatePath),
              reviewInstruction:
                "Use these paths as teacher-reviewed evidence references only. A probe result template is not a completed probe result, and this validation does not run probes or create profiles.",
              reviewOnly: true,
              execute: false
            },
            executesNow: false,
            blockedUntil: "teacher explicitly runs a separate review-only command"
          }
        : null
  };
});

const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const readyRows = validationRows.filter((row) => row.canPrepareReview);
const waitingRows = validationRows.filter((row) => !row.canPrepareReview && row.status !== "blocked_for_forbidden_decision");
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyRows.length > 0 && waitingRows.length === 0
    ? "all_rows_ready_for_control_channel_review"
    : readyRows.length > 0
      ? "some_rows_ready_for_control_channel_review"
      : "needs_teacher_review";
const status = forbiddenDecisionUsed ? "blocked" : readyRows.length > 0 ? "validated_with_ready_control_channel_review_rows" : "waiting_for_teacher_control_channel_repair_review";
const nextReviewCommands = readyRows.map((row) => row.nextReviewCommand);
const validationPath = join(validationDir, "all-software-control-channel-repair-receipt-validation.json");
const receiptPath = join(validationDir, "all-software-control-channel-repair-receipt-validation-receipt.json");
const readmePath = join(validationDir, "ALL_SOFTWARE_CONTROL_CHANNEL_REPAIR_RECEIPT_VALIDATION_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  validationDoesNotRunProbe: true,
  validationDoesNotCreateProfile: true,
  validationDoesNotExecuteTargetSoftware: true,
  validationDoesNotSendUiEvents: true,
  validationDoesNotCaptureScreenshots: true,
  validationDoesNotWriteMemory: true,
  probeRan: false,
  controlProfileCreated: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareControlComplete: false,
  goalComplete: false
};
const validation = {
  ok: true,
  format: "transparent_ai_all_software_control_channel_repair_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed,
  readyRowCount: readyRows.length,
  waitingRowCount: waitingRows.length,
  validationRows,
  nextReviewCommands,
  blockedTransitions: [
    "run_probe_from_validation",
    "create_profile_from_validation",
    "execute_target_software_from_validation",
    "send_ui_events_from_validation",
    "write_memory_from_validation",
    "claim_native_control_from_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceRepairQueue: queueInput.path,
    sourceReceipt: receiptInput.path
  },
  locks
};
const validationReceipt = {
  format: "transparent_ai_all_software_control_channel_repair_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  readyRowCount: readyRows.length,
  forbiddenDecisionUsed,
  probeRan: false,
  controlProfileCreated: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  goalComplete: false,
  locks
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_control_channel_repair_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      readyRowCount: readyRows.length,
      waitingRowCount: waitingRows.length,
      forbiddenDecisionUsed,
      validationPath,
      receiptPath,
      readmePath,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
