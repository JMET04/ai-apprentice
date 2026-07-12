#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "execution-gap-matrix-reconciliation-reviewed-runner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-gap-matrix-reconciliation-reviewed-runner"
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

function explicitConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed execution-gap matrix reconciliation runner",
    "teacher confirmed matrix reconciliation runner",
    "teacher confirmed next matrix generation",
    "teacher approved next review-only matrix generation",
    "i confirm execution-gap matrix reconciliation runner",
    "confirm regenerate next review-only matrix"
  ].some((marker) => text.includes(marker));
}

function realPath(value) {
  const text = String(value || "").trim();
  return text && !text.includes("<") && existsSync(text) ? resolve(text) : "";
}

function runPackageScript(args) {
  const result = spawnSync(
    process.execPath,
    [join(__dirname, "create-all-software-execution-gap-matrix-reconciliation-package.mjs"), ...args],
    {
      cwd: resolve(__dirname, "..", "..", ".."),
      encoding: "utf8",
      timeout: 240000
    }
  );
  if (result.status !== 0) {
    return { ok: false, error: result.stderr || result.stdout || "matrix reconciliation package generation failed" };
  }
  return { ok: true, result: JSON.parse(result.stdout) };
}

function locks(extra = {}) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    runnerRequiresValidatedReceipt: true,
    runnerRequiresTeacherConfirmation: true,
    runnerRequiresRollbackPoint: true,
    runnerDoesNotRunArbitraryShellCommand: true,
    runnerDoesNotExecuteTargetSoftware: true,
    runnerDoesNotWriteMemory: true,
    runnerDoesNotEnableRules: true,
    runnerDoesNotAllowMediumRuntime: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fileContentsRead: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false,
    ...extra
  };
}

function writeReadme(path, packet) {
  const lines = [
    "# Execution Gap Matrix Reconciliation Reviewed Runner",
    "",
    `Status: ${packet.status}`,
    `Validation: ${packet.sourceEvidence.validationPath}`,
    `Runner invoked: ${packet.runnerInvoked ? "yes" : "no"}`,
    `Next matrix generated: ${packet.generatedEvidence.nextMatrixPath || "no"}`,
    "",
    "This runner consumes a validated teacher receipt and invokes only the fixed matrix reconciliation package generator.",
    "",
    "Blockers:",
    ...(packet.blockers.length ? packet.blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    "Safety boundary:",
    "- It does not execute target software.",
    "- It does not run probes, send UI events, read logs, capture screenshots, write memory, enable rules, allow medium runtime, unlock packaging, or claim completion.",
    "- The generated matrix remains review-only and still requires later execution gates."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Run reviewed execution-gap matrix reconciliation after validated teacher receipt.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--receipt-validation", "")),
  "--validation",
  "transparent_ai_all_software_execution_gap_matrix_reconciliation_receipt_validation_v1"
);
if (!validationInput.value) throw new Error("--validation is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-gap-matrix-reconciliation-reviewed-runs"))
);
mkdirSync(outputRoot, { recursive: true });
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const runDir = join(outputRoot, runId);
mkdirSync(runDir, { recursive: true });

const validation = validationInput.value;
const packagePath = realPath(validation.paths?.sourcePackage);
const pkg = packagePath ? readJson(packagePath) : null;
const runReviewedMatrixGeneration = hasFlag("--run-reviewed-matrix-generation") || hasFlag("--run-reviewed-reconciliation");
const allowRunner = hasFlag("--allow-runner");
const teacherConfirmation = explicitConfirmation(argValue("--teacher-confirmation", argValue("--confirmation", "")));
const rollbackPoint = argValue("--rollback-point", argValue("--rollback", ""));
const rollbackPointCreated = hasFlag("--rollback-point-created") || Boolean(rollbackPoint);
const blockers = [];

if (validation.status !== "validated_ready_for_next_matrix_generation_command") blockers.push("validation_status_not_ready");
if (validation.validationDecision !== "ready_for_teacher_reviewed_next_matrix_generation") {
  blockers.push("validation_decision_not_ready_for_next_matrix_generation");
}
if (validation.reviewRow?.status !== "ready_for_teacher_reviewed_next_matrix_generation") {
  blockers.push("validation_review_row_not_ready");
}
if (!Array.isArray(validation.nextReviewCommands) || validation.nextReviewCommands.length !== 1) {
  blockers.push("validation_must_prepare_exactly_one_next_matrix_command");
}
if (!packagePath || !pkg) blockers.push("source_reconciliation_package_missing");
if (pkg && pkg.format !== "transparent_ai_all_software_execution_gap_matrix_reconciliation_package_v1") {
  blockers.push("source_reconciliation_package_format_mismatch");
}
if (!realPath(pkg?.sourceEvidence?.downstreamSummary)) blockers.push("source_downstream_summary_missing");
if (!realPath(pkg?.sourceEvidence?.currentMatrix)) blockers.push("source_current_matrix_missing");
if (!runReviewedMatrixGeneration) blockers.push("missing_run_reviewed_matrix_generation_flag");
if (!allowRunner) blockers.push("missing_allow_runner_flag");
if (!teacherConfirmation) blockers.push("missing_teacher_matrix_reconciliation_runner_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed");

let packageResult = null;
let generatedPackage = null;
if (blockers.length === 0) {
  const run = runPackageScript([
    "--goal",
    goal,
    "--downstream-summary",
    realPath(pkg.sourceEvidence.downstreamSummary),
    "--matrix",
    realPath(pkg.sourceEvidence.currentMatrix),
    "--teacher-reviewed-reconciliation",
    "--output-dir",
    join(runDir, "teacher-reviewed-matrix-reconciliation")
  ]);
  if (!run.ok) {
    blockers.push(`matrix_reconciliation_package_generation_failed: ${run.error}`);
  } else {
    packageResult = run.result;
    generatedPackage = packageResult.packagePath && existsSync(packageResult.packagePath) ? readJson(packageResult.packagePath) : null;
    if (!generatedPackage?.generated?.nextMatrixPath || !existsSync(generatedPackage.generated.nextMatrixPath)) {
      blockers.push("generated_next_matrix_missing");
    }
  }
}

const runnerInvoked = Boolean(packageResult);
const nextMatrixPath = generatedPackage?.generated?.nextMatrixPath || "";
const status =
  blockers.length > 0 && !runnerInvoked
    ? "blocked_before_reviewed_matrix_generation"
    : nextMatrixPath
      ? "reviewed_next_matrix_generated_waiting_for_teacher_matrix_review"
      : runnerInvoked
        ? "reviewed_matrix_generation_invoked_but_incomplete"
        : "blocked";
const lockState = locks({
  runnerInvoked,
  matrixGenerated: Boolean(nextMatrixPath)
});
const packetPath = join(runDir, "all-software-execution-gap-matrix-reconciliation-reviewed-runner.json");
const receiptPath = join(runDir, "all-software-execution-gap-matrix-reconciliation-reviewed-runner-receipt.json");
const readmePath = join(runDir, "ALL_SOFTWARE_EXECUTION_GAP_MATRIX_RECONCILIATION_REVIEWED_RUNNER_START_HERE.md");
const packet = {
  ok: true,
  format: "transparent_ai_all_software_execution_gap_matrix_reconciliation_reviewed_runner_v1",
  runId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceEvidence: {
    validationPath: validationInput.path,
    sourcePackagePath: packagePath,
    downstreamSummary: pkg?.sourceEvidence?.downstreamSummary || "",
    currentMatrix: pkg?.sourceEvidence?.currentMatrix || ""
  },
  runReviewedMatrixGeneration,
  allowRunner,
  teacherConfirmationMatched: teacherConfirmation,
  rollbackPointCreated,
  rollbackPoint,
  runnerInvoked,
  generatedEvidence: {
    reconciliationPackagePath: packageResult?.packagePath || "",
    reconciliationReceiptPath: packageResult?.receiptPath || "",
    reconciliationReadmePath: packageResult?.readmePath || "",
    reconciliationHtmlPath: packageResult?.htmlPath || "",
    nextMatrixPath,
    nextMatrixReceiptPath: generatedPackage?.generated?.nextMatrixReceiptPath || "",
    nextMatrixEvidenceChainLedgerPath: generatedPackage?.generated?.nextMatrixEvidenceChainLedgerPath || ""
  },
  blockers,
  nextTeacherActions: nextMatrixPath
    ? [
        "Review the regenerated execution capability matrix and evidence-chain ledger.",
        "Do not execute target software from this matrix; route rows through the existing dry-run and execution approval gates.",
        "If the matrix is wrong, correct the teacher receipt or action-logic patch before any downstream execution."
      ]
    : [
        "Resolve blockers before generating a teacher-reviewed next matrix.",
        "Use a validated receipt, explicit runner flag, explicit teacher confirmation, and retained rollback point."
      ],
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason:
      "This runner only regenerates a review-only execution capability matrix. It does not execute software or prove all-app coverage."
  },
  locks: lockState,
  paths: {
    packet: packetPath,
    receipt: receiptPath,
    readme: readmePath
  }
};
const receipt = {
  ok: true,
  format: "transparent_ai_all_software_execution_gap_matrix_reconciliation_reviewed_runner_receipt_v1",
  runId,
  status,
  runnerInvoked,
  matrixGenerated: Boolean(nextMatrixPath),
  nextMatrixPath,
  blockers,
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

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_gap_matrix_reconciliation_reviewed_runner_result_v1",
      runId,
      status,
      packetPath,
      receiptPath,
      readmePath,
      runnerInvoked,
      matrixGenerated: Boolean(nextMatrixPath),
      nextMatrixPath,
      blockers,
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
