#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
    String(value || "tlcl-rag-informed-high-reasoning-repair-intake")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-informed-high-reasoning-repair-intake"
  );
}

function lockedReviewState() {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    highReasoningRepairIntakeOnly: true,
    tlclStateUnmodified: true,
    ragDoesNotAuthorizeExecution: true,
    ragDoesNotEnableRules: true,
    ragDoesNotWriteMemory: true,
    ragDoesNotUnlockPackaging: true,
    doesNotRepairAutomatically: true,
    doesNotRunWorkflow: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotFetchExternalSources: true,
    doesNotCaptureScreenshots: true,
    doesNotClaimCompletion: true,
    mediumRuntimeContinuationAllowed: false,
    mediumRuntimeContinuationBlocked: true,
    accepted: false,
    ruleEnabled: false,
    memoryWritten: false,
    packagingGated: true,
    packagingUnlocked: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function rowQuestion(row) {
  const hint = String(row.logicExtractionHint || "").trim();
  const source = row.sourceId || "reviewed RAG source";
  return [
    `Does ${source} change an existing TLCL contract field, validator expectation, workflow fingerprint, or teacher question?`,
    hint ? `Which explicit data relationship must be extracted from: ${hint}` : "Which explicit data relationship is missing or ambiguous?",
    "What deterministic validator would fail if this logic is wrong in the next medium-runtime run?"
  ];
}

const goal = argValue(
  "--goal",
  "Create a RAG-informed high-reasoning repair intake from one TLCL RAG evidence attachment."
);
const attachmentInput = readJsonInput(
  argValue("--attachment", argValue("--tlcl-rag-attachment", "")),
  "--attachment",
  "transparent_ai_tlcl_rag_evidence_attachment_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-informed-high-reasoning-repair-intakes"))
);
const attachment = attachmentInput.value;
const blockers = [];
const locks = attachment.locks || {};

if (attachment.status !== "tlcl_rag_evidence_attached_waiting_for_high_reasoning_review") {
  blockers.push("attachment_not_waiting_for_high_reasoning_review");
}
if (locks.reviewOnly !== true) blockers.push("attachment_review_only_lock_missing");
if (locks.evidenceOnly !== true) blockers.push("attachment_evidence_only_lock_missing");
if (locks.attachmentOnly !== true) blockers.push("attachment_only_lock_missing");
if (locks.tlclStateUnmodified !== true) blockers.push("tlcl_state_unmodified_lock_missing");
if (locks.ragDoesNotAuthorizeExecution !== true) blockers.push("rag_authorization_lock_missing");
if (locks.ragDoesNotEnableRules !== true || locks.ruleEnabled !== false) blockers.push("rag_rule_enablement_lock_missing");
if (locks.ragDoesNotWriteMemory !== true || locks.memoryWritten !== false) blockers.push("rag_memory_lock_missing");
if (locks.ragDoesNotUnlockPackaging !== true || locks.packagingUnlocked !== false) {
  blockers.push("rag_packaging_unlock_lock_missing");
}
if (locks.doesNotExecuteTargetSoftware !== true) blockers.push("target_software_execution_lock_missing");
if (locks.goalComplete !== false) blockers.push("goal_completion_lock_missing");
if (attachment.highReasoningReviewHandoff?.mediumRuntimeContinuationAllowed !== false) {
  blockers.push("medium_runtime_continuation_not_blocked");
}
if (!Array.isArray(attachment.approvedDraftRefs) || attachment.approvedDraftRefs.length === 0) {
  blockers.push("attachment_has_no_teacher_reviewed_rag_draft_refs");
}
if (!attachment.sourceEvidence?.tlclPacketHash || !attachment.sourceEvidence?.ragValidationHash) {
  blockers.push("attachment_source_hashes_missing");
}
if (attachment.sourceEvidence?.tlclPacketPath === "" && attachment.sourceEvidence?.ragValidationPath === "") {
  blockers.push("attachment_source_paths_or_hashes_insufficient");
}

const intakeId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const intakeDir = join(outRoot, intakeId);
const intakePath = join(intakeDir, "tlcl-rag-informed-high-reasoning-repair-intake.json");
const receiptPath = join(intakeDir, "tlcl-rag-informed-high-reasoning-repair-intake-receipt.json");
const readmePath = join(intakeDir, "TLCL_RAG_INFORMED_HIGH_REASONING_REPAIR_INTAKE_START_HERE.md");
const promptPath = join(intakeDir, "high-reasoning-repair-intake-prompt.md");
const status = blockers.length
  ? "blocked_before_tlcl_rag_informed_high_reasoning_repair_intake"
  : "tlcl_rag_informed_high_reasoning_repair_intake_waiting_for_teacher_review";
const evidenceReviewRows = (attachment.approvedDraftRefs || []).map((row, index) => ({
  rowId: `rag-evidence-review-${String(index + 1).padStart(3, "0")}`,
  sourceId: row.sourceId || "",
  retrievalPath: row.retrievalPath || "",
  rulePath: row.rulePath || "",
  ruleLifecycle: row.ruleLifecycle || "draft_disabled",
  logicExtractionHint: row.logicExtractionHint || "",
  logicFitDecision: row.logicFitDecision || "",
  evidenceRefs: row.evidenceRefs || [],
  reviewerNote: row.reviewerNote || "",
  repairQuestions: rowQuestion(row)
}));
const highReasoningRepairTasks = blockers.length
  ? []
  : [
      "Compare every reviewed RAG evidence row against the current TLCL packet and identify only explicit logic deltas.",
      "Draft disabled Rule Card, Rule DSL, validator, workflow fingerprint, or teacher-question repairs without enabling them.",
      "For every proposed repair, cite the reviewed evidence row and state the deterministic validator that would catch a wrong implementation.",
      "Separate reusable logic from one-off task data so medium-reasoning execution can later run the confirmed workflow cheaply.",
      "Return unclear evidence as teacher questions instead of guessing, executing software, writing memory, or continuing medium runtime."
    ];
const teacherQuestions = evidenceReviewRows.flatMap((row) => row.repairQuestions.map((question) => ({
  evidenceRowId: row.rowId,
  sourceId: row.sourceId,
  question
})));
const forbiddenTransitions = [
  "execute_target_software_from_rag_informed_repair_intake",
  "continue_medium_runtime_from_rag_informed_repair_intake",
  "enable_rule_from_rag_informed_repair_intake",
  "write_memory_from_rag_informed_repair_intake",
  "unlock_packaging_from_rag_informed_repair_intake",
  "claim_completion_from_rag_informed_repair_intake",
  "bypass_teacher_review_from_rag_informed_repair_intake",
  "treat_rag_as_authority_from_rag_informed_repair_intake"
];
const optimizedPrompt = [
  "# RAG-Informed High-Reasoning Repair Intake Prompt",
  "",
  "Role: highest-reasoning TLCL contract compiler.",
  "",
  "Objective: use reviewed RAG evidence only as cited evidence to propose disabled logic-contract repairs. Do not execute target software, enable rules, write memory, unlock packaging, claim completion, or continue medium-runtime execution.",
  "",
  "Required reasoning surface:",
  "- Extract explicit data logic from each reviewed evidence row, including dimensions, angles, line relationships, tolerances, formulas, constraints, and exception conditions when present.",
  "- Map each extracted logic item to a TLCL contract field, Rule DSL clause, validator expectation, workflow fingerprint, or teacher question.",
  "- Mark uncertain or underspecified evidence as a teacher question, not as an executable rule.",
  "- Keep all proposed rules draft_disabled until teacher review and deterministic validation pass.",
  "",
  "Evidence rows to inspect:",
  ...(evidenceReviewRows.length
    ? evidenceReviewRows.map((row) => `- ${row.rowId}: ${row.sourceId} :: ${row.logicExtractionHint || "no hint"}`)
    : ["- none"]),
  "",
  "Forbidden transitions:",
  ...forbiddenTransitions.map((item) => `- ${item}`)
].join("\n");
const intake = {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_intake_v1",
  intakeId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  readyForTeacherReview: blockers.length === 0,
  readyForMediumRuntime: false,
  sourceEvidence: {
    attachmentPath: attachmentInput.path,
    attachmentHash: sha256Object(attachment),
    tlclPacketPath: attachment.sourceEvidence?.tlclPacketPath || "",
    tlclPacketHash: attachment.sourceEvidence?.tlclPacketHash || "",
    ragValidationPath: attachment.sourceEvidence?.ragValidationPath || "",
    ragValidationHash: attachment.sourceEvidence?.ragValidationHash || "",
    approvedDisabledDraftCount: attachment.approvedDisabledDraftCount || evidenceReviewRows.length
  },
  evidenceReviewRows,
  teacherQuestions,
  highReasoningRepairTasks,
  mediumRuntimeRetryGate: {
    blockedUntilTeacherReviewedRepair: true,
    requiresDisabledRuleDraft: true,
    requiresDeterministicValidation: true,
    requiresWorkflowFingerprintReview: true,
    requiresRollbackPoint: true,
    requiresFreshMediumRuntimeApprovalGate: true,
    readyForMediumRuntime: false
  },
  forbiddenTransitions,
  blockers,
  paths: {
    intake: intakePath,
    receipt: receiptPath,
    readme: readmePath,
    prompt: promptPath
  },
  locks: lockedReviewState()
};
const receipt = {
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_intake_receipt_v1",
  intakeId,
  status,
  readyForTeacherReview: intake.readyForTeacherReview,
  readyForMediumRuntime: false,
  blockerCount: blockers.length,
  evidenceReviewRowCount: evidenceReviewRows.length,
  teacherQuestionCount: teacherQuestions.length,
  highReasoningRepairTaskCount: highReasoningRepairTasks.length,
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
  locks: lockedReviewState()
};

writeJson(intakePath, intake);
writeJson(receiptPath, receipt);
writeFileSync(promptPath, `${optimizedPrompt}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# TLCL RAG-Informed High-Reasoning Repair Intake",
    "",
    `Status: ${status}`,
    "",
    "This intake turns a reviewed TLCL RAG evidence attachment into teacher-reviewable high-reasoning contract repair work.",
    "It does not execute software, continue medium runtime, enable rules, write memory, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_intake_result_v1",
      intakeId,
      status,
      readyForTeacherReview: intake.readyForTeacherReview,
      readyForMediumRuntime: false,
      intakePath,
      receiptPath,
      readmePath,
      promptPath,
      blockerCount: blockers.length,
      evidenceReviewRowCount: evidenceReviewRows.length,
      teacherQuestionCount: teacherQuestions.length,
      highReasoningRepairTaskCount: highReasoningRepairTasks.length,
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
