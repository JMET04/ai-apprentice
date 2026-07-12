#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-manual-next-gate-preparation-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-manual-next-gate-preparation-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(resolve(text)), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sameJson(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["manual_next_gate_prepared_for_separate_use", "prepared_for_manual_use", "ready_for_separate_manual_use"].includes(decision)) {
    return "manual_next_gate_prepared_for_separate_use";
  }
  if (["needs_more_result_evidence", "needs_more_evidence", "blocked_needs_more_evidence"].includes(decision)) {
    return "needs_more_result_evidence";
  }
  if (["correction_to_high_reasoning_repair", "teacher_correction", "repair_logic_contract"].includes(decision)) {
    return "correction_to_high_reasoning_repair";
  }
  if (
    [
      "execute_now",
      "run_next_gate",
      "accepted",
      "enable_rule",
      "write_memory",
      "unlock_packaging",
      "claim_complete",
      "invoke_model",
      "fetch_rag"
    ].includes(decision)
  ) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    validatorDoesNotExecuteNextGateTool: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    nextGateToolInvoked: false,
    targetSoftwareCommandsExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const builderInput = readJsonInput(argValue("--builder", argValue("--preparation-builder", "")), "--builder");
const receiptInput = readJsonInput(argValue("--receipt", argValue("--teacher-receipt", "")), "--receipt");
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-manual-next-gate-preparation-validations"))
  )
);
mkdirSync(outputRoot, { recursive: true });

const builder = builderInput.value;
const receipt = receiptInput.value;
const preparation = builder?.preparation || null;
const decision = normalizeDecision(receipt?.teacherDecision);
const forbiddenDecisions = new Set([
  "execute_now",
  "run_next_gate",
  "accepted",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_complete",
  "invoke_model",
  "fetch_rag"
]);
const allowedDecisions = new Set([
  "manual_next_gate_prepared_for_separate_use",
  "needs_more_result_evidence",
  "correction_to_high_reasoning_repair",
  "needs_teacher_review"
]);
const blockerRows = [];
function block(code, message) {
  blockerRows.push({ code, message });
}

if (!builder) block("builder_missing", "A manual next-gate preparation builder is required.");
if (!receipt) block("receipt_missing", "A manual next-gate preparation receipt is required.");
if (
  builder &&
  ![
    "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_builder_v1",
    "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_builder_result_v1"
  ].includes(builder.format)
) {
  block("builder_format_invalid", "Builder must be a TLCL manual next-gate preparation builder packet or result.");
}
if (receipt && receipt.format !== "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_receipt_v1") {
  block("receipt_format_invalid", "Receipt must be transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_receipt_v1.");
}
if (builder?.ok !== true) block("builder_not_ok", "Builder must have ok=true.");
if (builder && builder.status !== "manual_next_gate_preparation_builder_waiting_for_teacher_review") {
  block("builder_status_not_ready", "Builder status is not waiting for teacher review.");
}
if (!preparation) block("preparation_missing", "Builder must contain preparation.");
if (builder?.locks?.builderDoesNotExecuteNextGateTool !== true) {
  block("source_builder_lock_missing", "Source builder must prove it did not execute the next-gate tool.");
}
if (receipt?.sourceValidationId !== builder?.sourceValidationId) {
  block("source_validation_id_mismatch", "Receipt sourceValidationId must match builder.sourceValidationId.");
}
if (receipt?.selectedNextGate !== preparation?.selectedNextGate) block("selected_next_gate_mismatch", "Receipt selectedNextGate must match preparation.");
if (receipt?.reviewedNextTool !== preparation?.nextTool) block("reviewed_next_tool_mismatch", "Receipt reviewedNextTool must match preparation.nextTool.");
if (receipt?.reviewedCommandTemplate !== preparation?.commandTemplate) {
  block("reviewed_command_template_mismatch", "Receipt reviewedCommandTemplate must match preparation.commandTemplate.");
}
if (!sameJson(receipt?.requiredInputs || [], preparation?.requiredInputs || [])) {
  block("required_inputs_mismatch", "Receipt requiredInputs must match preparation.requiredInputs.");
}
if (receipt?.expectedOutputFormat !== preparation?.expectedOutputFormat) {
  block("expected_output_format_mismatch", "Receipt expectedOutputFormat must match preparation.expectedOutputFormat.");
}
if (!sameJson(receipt?.resultEvidencePaths || [], preparation?.resultEvidencePaths || [])) {
  block("result_evidence_paths_mismatch", "Receipt resultEvidencePaths must match preparation.resultEvidencePaths.");
}
if (receipt?.confirmedRollbackPoint !== preparation?.confirmedRollbackPoint) {
  block("rollback_point_mismatch", "Receipt confirmedRollbackPoint must match preparation.confirmedRollbackPoint.");
}
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt?.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt?.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt?.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");

if (decision === "manual_next_gate_prepared_for_separate_use") {
  if (receipt?.selectedGateReviewed !== true) block("selected_gate_not_reviewed", "Teacher must review the selected next gate.");
  if (receipt?.commandTemplateReviewed !== true) block("command_template_not_reviewed", "Teacher must review the command template.");
  if (receipt?.requiredInputsReviewed !== true) block("required_inputs_not_reviewed", "Teacher must review required inputs.");
  if (receipt?.rollbackPointRetained !== true) block("rollback_point_not_retained", "Teacher must confirm the rollback point is retained.");
  if (receipt?.teacherConfirmedSeparateManualUse !== true) {
    block("separate_manual_use_not_confirmed", "Teacher must confirm the next gate is a separate manual use.");
  }
}
if (decision === "correction_to_high_reasoning_repair" && !String(receipt?.teacherNotes || "").trim()) {
  block("high_reasoning_repair_note_missing", "Correction to high reasoning repair requires teacherNotes.");
}
if (decision === "needs_more_result_evidence" && !String(receipt?.teacherNotes || "").trim()) {
  block("more_evidence_note_missing", "Needs-more-evidence decision requires teacherNotes.");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForSeparateManualNextGateUse =
  decision === "manual_next_gate_prepared_for_separate_use" && blockerRows.length === 0;
const correctionToHighReasoningRepair = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const needsMoreResultEvidence = decision === "needs_more_result_evidence" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_manual_next_gate_preparation_decision"
  : readyForSeparateManualNextGateUse
    ? "manual_next_gate_prepared_waiting_for_separate_manual_use"
    : correctionToHighReasoningRepair
      ? "correction_to_high_reasoning_repair_required"
      : needsMoreResultEvidence
        ? "needs_more_result_evidence_before_manual_next_gate_use"
        : "needs_teacher_review_before_manual_next_gate_use";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(preparation?.selectedNextGate || decision)}`;
const validationDir = join(outputRoot, validationId);
const validationPath = join(validationDir, "tlcl-manual-next-gate-preparation-validation.json");
const receiptRecordPath = join(validationDir, "tlcl-manual-next-gate-preparation-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_MANUAL_NEXT_GATE_PREPARATION_VALIDATION_START_HERE.md");
const validationLocks = locks();

const manualNextGatePreparation = readyForSeparateManualNextGateUse
  ? {
      format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_v1",
      selectedNextGate: preparation.selectedNextGate,
      nextTool: preparation.nextTool,
      commandTemplate: preparation.commandTemplate,
      requiredInputs: preparation.requiredInputs,
      expectedOutputFormat: preparation.expectedOutputFormat,
      roleBoundary: preparation.roleBoundary,
      resultEvidencePaths: preparation.resultEvidencePaths,
      confirmedRollbackPoint: preparation.confirmedRollbackPoint,
      instruction:
        "Use this only as a separate manual next-gate handoff. This validation did not run the next gate or call any model/RAG/memory/rule/package operation.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt?.teacherNotes || ""
    }
  : null;

const resultValidation = {
  ok: !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  selectedNextGate: preparation?.selectedNextGate || "",
  readyForSeparateManualNextGateUse,
  correctionToHighReasoningRepair,
  needsMoreResultEvidence,
  forbiddenDecisionUsed,
  blockers: blockerRows,
  sourceEvidence: {
    builderPath: builderInput.path,
    receiptPath: receiptInput.path,
    sourceValidationId: builder?.sourceValidationId || ""
  },
  manualNextGatePreparation,
  highReasoningRepairHandoff:
    correctionToHighReasoningRepair && !forbiddenDecisionUsed
      ? {
          route: "high_reasoning_logic_contract_repair_after_manual_next_gate_preparation",
          selectedNextGate: "correction_to_high_reasoning_repair",
          resultEvidencePaths: preparation?.resultEvidencePaths || [],
          confirmedRollbackPoint: preparation?.confirmedRollbackPoint || "",
          teacherNotes: receipt?.teacherNotes || "",
          instruction: "Return to the high-reasoning compile layer before preparing or using the next gate.",
          executeNow: false,
          reviewOnly: true
        }
      : null,
  blockedActions: [
    "execute_next_gate_tool_from_manual_next_gate_preparation_validation",
    "auto_run_command_from_manual_next_gate_preparation_validation",
    "invoke_model_from_manual_next_gate_preparation_validation",
    "fetch_rag_from_manual_next_gate_preparation_validation",
    "write_memory_from_manual_next_gate_preparation_validation",
    "enable_rule_from_manual_next_gate_preparation_validation",
    "unlock_packaging_from_manual_next_gate_preparation_validation",
    "claim_completion_from_manual_next_gate_preparation_validation"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    receipt: receiptRecordPath,
    readme: readmePath,
    sourceBuilder: builderInput.path,
    sourceReceipt: receiptInput.path
  }
};
const validationReceipt = {
  format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_validation_receipt_v1",
  validationId,
  status,
  decision,
  selectedNextGate: preparation?.selectedNextGate || "",
  readyForSeparateManualNextGateUse,
  correctionToHighReasoningRepair,
  needsMoreResultEvidence,
  forbiddenDecisionUsed,
  blockers: blockerRows,
  nextGateToolInvoked: false,
  targetSoftwareCommandsExecuted: false,
  modelInvoked: false,
  ragFetched: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: validationLocks
};

writeJson(validationPath, resultValidation);
writeJson(receiptRecordPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Manual Next Gate Preparation Validation",
    "",
    `- Status: ${status}`,
    `- Decision: ${decision}`,
    `- Selected next gate: ${preparation?.selectedNextGate || "<none>"}`,
    `- Ready for separate manual next-gate use: ${readyForSeparateManualNextGateUse}`,
    "",
    "This validation only checks teacher review of a manual next-gate preparation packet. It does not run the next gate, auto-run commands, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockerRows.length ? blockerRows.map((row) => `- ${row.code}: ${row.message}`) : ["- none"])
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: !forbiddenDecisionUsed,
      format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_validation_result_v1",
      validationId,
      status,
      decision,
      selectedNextGate: preparation?.selectedNextGate || "",
      readyForSeparateManualNextGateUse,
      correctionToHighReasoningRepair,
      needsMoreResultEvidence,
      forbiddenDecisionUsed,
      blockers: blockerRows,
      validationPath,
      receiptPath: receiptRecordPath,
      readmePath,
      manualNextGatePreparation,
      highReasoningRepairHandoff: resultValidation.highReasoningRepairHandoff,
      locks: validationLocks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
