#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "execution-gap-matrix-reconciliation-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-gap-matrix-reconciliation-receipt-validation"
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
  if (["teacher_confirmed_matrix_reconciliation", "ready_for_next_matrix_generation", "regenerate_next_matrix"].includes(text)) {
    return "teacher_confirmed_matrix_reconciliation";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
  if (
    [
      "accepted",
      "execute_now",
      "run_execute_mode",
      "write_memory",
      "enable_rule",
      "allow_medium_runtime",
      "claim_complete",
      "native_universal_execution",
      "unlock_packaging"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function commandLine(scriptName, args = []) {
  const rendered = args.map((arg) => `"${String(arg).replace(/"/g, '\\"')}"`).join(" ");
  return `node plugins\\transparent-ai-apprentice\\scripts\\${scriptName} ${rendered}`;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotGenerateMatrix: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotEnableRules: true,
    validationDoesNotAllowMediumRuntime: true,
    matrixRegenerated: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Execution Gap Matrix Reconciliation Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Review row:",
    `- ${validation.reviewRow.status}: ${validation.reviewRow.reason}`,
    "",
    "Prepared next commands:",
    ...validation.nextReviewCommands.map((command, index) => `${index + 1}. ${command.label}: ${command.command}`),
    "",
    "Safety boundary:",
    "- This validator does not regenerate the matrix.",
    "- It only prepares a teacher-reviewed next command.",
    "- It does not execute target software, send UI events, read logs, capture screenshots, write memory, enable rules, allow medium runtime, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate teacher receipt for execution-gap matrix reconciliation.");
const packageInput = readJsonInput(
  argValue("--package", argValue("--reconciliation-package", "")),
  "--package",
  "transparent_ai_all_software_execution_gap_matrix_reconciliation_package_v1"
);
if (!packageInput.value) throw new Error("--package is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_execution_gap_matrix_reconciliation_teacher_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-gap-matrix-reconciliation-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const pkg = packageInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisions = new Set([
  "accepted",
  "execute_now",
  "run_execute_mode",
  "write_memory",
  "enable_rule",
  "allow_medium_runtime",
  "claim_complete",
  "native_universal_execution",
  "unlock_packaging"
]);
const forbiddenDecision = forbiddenDecisions.has(decision);
const requiredFlags = [
  receipt.packageReviewed,
  receipt.downstreamSummaryReviewed,
  receipt.controlValidationReviewedAsEvidenceOnly,
  receipt.actionLogicPatchReviewed,
  receipt.currentMatrixReviewed,
  receipt.nextMatrixCommandReviewed,
  receipt.executionBoundaryReviewed,
  receipt.rollbackPointRetained,
  receipt.teacherConfirmedRegenerateNextMatrix
];
const packageReady =
  pkg.status === "ready_for_teacher_matrix_reconciliation_review" &&
  pkg.reconciliationDecision === "ready_for_teacher_reviewed_next_matrix_generation" &&
  Number(pkg.counts?.readyForReconciliation || 0) === 1 &&
  Number(pkg.counts?.controlReadyRows || 0) > 0 &&
  Number(pkg.counts?.actionLogicReadyPatchRows || 0) > 0 &&
  Boolean(pkg.sourceEvidence?.downstreamSummary) &&
  Boolean(pkg.sourceEvidence?.actionLogicValidation) &&
  Boolean(pkg.sourceEvidence?.currentMatrix) &&
  Boolean(pkg.plannedCommands?.nextMatrixCommand);
const allFlagsReviewed = requiredFlags.every(Boolean);
let rowStatus = "needs_teacher_review";
let reason = "teacher has not confirmed matrix reconciliation";
if (forbiddenDecision) {
  rowStatus = "blocked_for_forbidden_decision";
  reason = "receipt used a forbidden decision that would cross execute, memory, rule, medium-runtime, packaging, or completion boundaries";
} else if (decision === "blocked_needs_more_evidence") {
  rowStatus = "blocked_needs_more_evidence";
  reason = "teacher requested more evidence before matrix reconciliation";
} else if (decision === "teacher_confirmed_matrix_reconciliation" && !packageReady) {
  rowStatus = "package_not_ready_for_matrix_reconciliation";
  reason = "package is missing ready downstream summary, action-logic patch, current matrix, or next matrix command evidence";
} else if (decision === "teacher_confirmed_matrix_reconciliation" && !allFlagsReviewed) {
  rowStatus = "missing_required_teacher_review_flags";
  reason = "teacher confirmation is missing one or more required review flags";
} else if (decision === "teacher_confirmed_matrix_reconciliation") {
  rowStatus = "ready_for_teacher_reviewed_next_matrix_generation";
  reason = "teacher reviewed downstream evidence, current matrix, command, execution boundary, and retained rollback point";
}

const nextMatrixCommand =
  rowStatus === "ready_for_teacher_reviewed_next_matrix_generation"
    ? commandLine("create-all-software-execution-gap-matrix-reconciliation-package.mjs", [
        "--downstream-summary",
        pkg.sourceEvidence.downstreamSummary,
        "--matrix",
        pkg.sourceEvidence.currentMatrix,
        "--teacher-reviewed-reconciliation",
        "--output-dir",
        join(validationDir, "teacher-reviewed-matrix-reconciliation")
      ])
    : "";
const nextReviewCommands = nextMatrixCommand
  ? [
      {
        label: "Generate next review-only execution capability matrix package",
        tool: "create_all_software_execution_gap_matrix_reconciliation_package",
        command: nextMatrixCommand,
        blockedUntil: "teacher runs this explicit command after preserving rollback point; generated matrix still requires review before execution gates",
        executesTargetSoftware: false,
        writesMemory: false,
        enablesRules: false
      }
    ]
  : [];
const validationDecision = forbiddenDecision
  ? "blocked_for_forbidden_decision"
  : rowStatus === "ready_for_teacher_reviewed_next_matrix_generation"
    ? "ready_for_teacher_reviewed_next_matrix_generation"
    : rowStatus === "blocked_needs_more_evidence"
      ? "blocked_needs_more_evidence"
      : "needs_teacher_review";
const status =
  rowStatus === "ready_for_teacher_reviewed_next_matrix_generation"
    ? "validated_ready_for_next_matrix_generation_command"
    : rowStatus.includes("blocked")
      ? "blocked"
      : "waiting_for_teacher_review";
const lockState = locks();
const validationPath = join(validationDir, "all-software-execution-gap-matrix-reconciliation-receipt-validation.json");
const receiptPath = join(validationDir, "all-software-execution-gap-matrix-reconciliation-receipt-validation-receipt.json");
const readmePath = join(validationDir, "ALL_SOFTWARE_EXECUTION_GAP_MATRIX_RECONCILIATION_RECEIPT_VALIDATION_START_HERE.md");
const validation = {
  ok: !forbiddenDecision,
  format: "transparent_ai_all_software_execution_gap_matrix_reconciliation_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed: forbiddenDecision,
  reviewRow: {
    packageId: pkg.packageId || "",
    receiptDecision: receipt.teacherDecision || "",
    normalizedDecision: decision,
    packageReady,
    allFlagsReviewed,
    status: rowStatus,
    reason,
    missing: [
      ...(packageReady ? [] : ["ready_reconciliation_package_evidence"]),
      ...(receipt.packageReviewed ? [] : ["package_reviewed"]),
      ...(receipt.downstreamSummaryReviewed ? [] : ["downstream_summary_reviewed"]),
      ...(receipt.controlValidationReviewedAsEvidenceOnly ? [] : ["control_validation_evidence_only_reviewed"]),
      ...(receipt.actionLogicPatchReviewed ? [] : ["action_logic_patch_reviewed"]),
      ...(receipt.currentMatrixReviewed ? [] : ["current_matrix_reviewed"]),
      ...(receipt.nextMatrixCommandReviewed ? [] : ["next_matrix_command_reviewed"]),
      ...(receipt.executionBoundaryReviewed ? [] : ["execution_boundary_reviewed"]),
      ...(receipt.rollbackPointRetained ? [] : ["rollback_point_retained"]),
      ...(receipt.teacherConfirmedRegenerateNextMatrix ? [] : ["teacher_confirmed_regenerate_next_matrix"])
    ]
  },
  nextReviewCommands,
  blockedTransitions: [
    "generate_matrix_from_validation_without_teacher_command",
    "execute_target_software_from_validation",
    "send_ui_events_from_validation",
    "read_logs_from_validation",
    "capture_screenshot_from_validation",
    "write_memory_from_validation",
    "enable_rule_from_validation",
    "allow_medium_runtime_from_validation",
    "claim_all_software_execution_complete_from_validation",
    "claim_native_universal_execution_from_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourcePackage: packageInput.path,
    sourceTeacherReceipt: receiptInput.path,
    downstreamSummary: pkg.sourceEvidence?.downstreamSummary || "",
    currentMatrix: pkg.sourceEvidence?.currentMatrix || ""
  },
  locks: lockState
};
const validationReceipt = {
  format: "transparent_ai_all_software_execution_gap_matrix_reconciliation_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  reviewRowStatus: rowStatus,
  nextReviewCommandCount: nextReviewCommands.length,
  matrixGenerated: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false,
  locks: lockState
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: !forbiddenDecision,
      format: "transparent_ai_all_software_execution_gap_matrix_reconciliation_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      reviewRowStatus: rowStatus,
      validationPath,
      receiptPath,
      readmePath,
      nextReviewCommandCount: nextReviewCommands.length,
      matrixGenerated: false,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false,
      locks: lockState
    },
    null,
    2
  )
);

if (forbiddenDecision) process.exit(1);
