#!/usr/bin/env node
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

function slug(value) {
  return (
    String(value || "real-case-pilot-intake-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "real-case-pilot-intake-receipt-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["pilot_route_selected_for_manual_preparation", "select_route", "prepare_manual_route"].includes(decision)) {
    return "pilot_route_selected_for_manual_preparation";
  }
  if (["provide_missing_case_evidence", "needs_more_case_evidence", "needs_more_evidence"].includes(decision)) {
    return "provide_missing_case_evidence";
  }
  if (["correction_to_high_reasoning_repair", "teacher_correction", "repair_logic_contract"].includes(decision)) {
    return "correction_to_high_reasoning_repair";
  }
  if (
    [
      "execute_now",
      "accepted",
      "run_next_tool",
      "invoke_model",
      "fetch_rag",
      "enable_rule",
      "write_memory",
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
    validatorDoesNotRunNextTool: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotCaptureScreenshot: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    nextToolExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    ruleEnabled: false,
    accepted: false,
    packagingUnlocked: false,
    goalComplete: false
  };
}

const intakeInput = readJsonInput(argValue("--intake", ""), "--intake", "transparent_ai_real_case_pilot_intake_v1");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_real_case_pilot_intake_receipt_v1"
);
const outRoot = resolve(argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-pilot-intake-validations")));
const intake = intakeInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const routeById = new Map((intake.recommendedRoutes || []).map((route) => [route.route, route]));
const selectedRoute = routeById.get(receipt.selectedRoute) || null;
const forbiddenDecisions = new Set([
  "execute_now",
  "accepted",
  "run_next_tool",
  "invoke_model",
  "fetch_rag",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_complete"
]);
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (receipt.sourceIntakeId !== intake.intakeId) block("source_intake_id_mismatch", "Receipt sourceIntakeId must match intake.intakeId.");
if (receipt.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);

const receiptRows = Array.isArray(receipt.reviewedEvidenceRows) ? receipt.reviewedEvidenceRows : [];
const rowById = new Map(receiptRows.map((row) => [row.id, row]));
for (const row of intake.evidenceRows || []) {
  const receiptRow = rowById.get(row.id);
  if (!receiptRow) block(`missing_evidence_review_row:${row.id}`, `Missing evidence review row: ${row.id}`);
  if (row.required && receiptRow?.present !== true && !String(receiptRow?.suppliedValue || "").trim()) {
    block(`required_case_evidence_missing:${row.id}`, `Required evidence missing: ${row.id}`);
  }
  if (row.required && receiptRow?.teacherReviewed !== true && decision === "pilot_route_selected_for_manual_preparation") {
    block(`required_case_evidence_not_reviewed:${row.id}`, `Required evidence not teacher-reviewed: ${row.id}`);
  }
}

if (decision === "pilot_route_selected_for_manual_preparation") {
  if (!selectedRoute) block("selected_route_not_allowed", "Selected route must be one of intake.recommendedRoutes.");
  if (receipt.selectedRouteReviewed !== true) block("selected_route_not_reviewed", "Teacher must review selected route.");
  if (receipt.teacherConfirmedNoExecution !== true) block("no_execution_not_confirmed", "Teacher must confirm no execution now.");
  if (receipt.rollbackRetained !== true) block("rollback_not_retained", "Teacher must confirm retained rollback point.");
}

if (decision === "correction_to_high_reasoning_repair" && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_correction_note_missing", "Correction to high reasoning repair requires teacherNotes.");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForManualPreparation =
  decision === "pilot_route_selected_for_manual_preparation" && selectedRoute && blockers.length === 0;
const readyForEvidenceCollection = decision === "provide_missing_case_evidence" && !forbiddenDecisionUsed;
const routesToHighReasoningCorrection = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_real_case_pilot_intake_decision"
  : readyForManualPreparation
    ? "real_case_pilot_intake_ready_for_manual_route_preparation"
    : readyForEvidenceCollection
      ? "real_case_pilot_intake_waiting_for_missing_evidence_collection"
      : routesToHighReasoningCorrection
        ? "real_case_pilot_intake_routes_to_high_reasoning_correction"
        : "real_case_pilot_intake_needs_teacher_review";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(receipt.selectedRoute || decision)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "real-case-pilot-intake-receipt-validation.json");
const receiptRecordPath = join(validationDir, "real-case-pilot-intake-receipt.json");
const readmePath = join(validationDir, "REAL_CASE_PILOT_INTAKE_RECEIPT_VALIDATION_START_HERE.md");
const validationLocks = locks();
const manualPreparationHandoff = readyForManualPreparation
  ? {
      format: "transparent_ai_real_case_pilot_manual_preparation_handoff_v1",
      caseType: intake.caseType,
      selectedRoute: receipt.selectedRoute,
      nextTool: selectedRoute.nextTool,
      commandTemplate: selectedRoute.commandTemplate,
      goal: intake.goal,
      software: intake.software,
      artifacts: intake.artifacts,
      knowledgeSources: intake.knowledgeSources,
      constraints: intake.constraints,
      rollbackPoint: intake.rollbackPoint,
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;
const missingEvidenceHandoff = readyForEvidenceCollection
  ? {
      format: "transparent_ai_real_case_pilot_missing_evidence_handoff_v1",
      missingRequiredEvidence: intake.missingRequiredEvidence || [],
      instruction: "Collect or clarify the missing real-case artifacts, logic constraints, knowledge sources, target software, or rollback evidence, then rerun create-real-case-pilot-intake.mjs.",
      executeNow: false,
      reviewOnly: true
    }
  : null;
const highReasoningCorrectionHandoff = routesToHighReasoningCorrection
  ? {
      format: "transparent_ai_real_case_pilot_high_reasoning_correction_handoff_v1",
      route: "high_reasoning_logic_contract_repair_before_real_case_pilot",
      teacherNotes: receipt.teacherNotes || "",
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;

const result = {
  ok: !forbiddenDecisionUsed,
  format: "transparent_ai_real_case_pilot_intake_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  selectedRoute: receipt.selectedRoute || "",
  readyForManualPreparation,
  readyForEvidenceCollection,
  routesToHighReasoningCorrection,
  forbiddenDecisionUsed,
  blockers,
  manualPreparationHandoff,
  missingEvidenceHandoff,
  highReasoningCorrectionHandoff,
  blockedActions: [
    "run_next_tool_from_real_case_intake_validation",
    "invoke_model_from_real_case_intake_validation",
    "fetch_rag_from_real_case_intake_validation",
    "execute_software_from_real_case_intake_validation",
    "capture_screenshot_from_real_case_intake_validation",
    "write_memory_from_real_case_intake_validation",
    "enable_rule_from_real_case_intake_validation",
    "unlock_packaging_from_real_case_intake_validation",
    "claim_completion_from_real_case_intake_validation"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    receiptRecord: receiptRecordPath,
    readme: readmePath,
    sourceIntake: intakeInput.path,
    sourceReceipt: receiptInput.path
  }
};

writeJson(validationPath, result);
writeJson(receiptRecordPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Real Case Pilot Intake Receipt Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    `Selected route: ${receipt.selectedRoute || ""}`,
    "",
    "This validation prepares a manual route handoff only. It does not run tools, invoke models, fetch RAG, execute software, capture screenshots, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((row) => `- ${row.code}: ${row.message}`) : ["- none"])
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_real_case_pilot_intake_receipt_validation_result_v1",
      status,
      ok: result.ok,
      validationPath,
      receiptRecordPath,
      readmePath,
      selectedRoute: result.selectedRoute,
      readyForManualPreparation,
      manualPreparationHandoff,
      missingEvidenceHandoff,
      highReasoningCorrectionHandoff,
      blockers,
      executeNow: false,
      locks: validationLocks
    },
    null,
    2
  )
);
