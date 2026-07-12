#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return (
    String(value || "all-software-execution-capability-convergence-audit")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-execution-capability-convergence-audit"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function normalizeSupervisor(input, index) {
  const parsed = readJsonInput(input, `--supervisor[${index}]`);
  if (parsed.value.format !== "transparent_ai_all_software_execution_capability_supervisor_v1") {
    throw new Error("Expected transparent_ai_all_software_execution_capability_supervisor_v1");
  }
  return parsed;
}

function normalizeReconciliation(input, index) {
  const parsed = readJsonInput(input, `--reconciliation[${index}]`);
  if (parsed.value.format !== "transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_v1") {
    throw new Error("Expected transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_v1");
  }
  return parsed;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fileContentsRead: false,
    uiEventsSent: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    scheduledTaskInstalled: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    teacherCompletionReviewRequired: true
  };
}

function latestMatrixFrom(supervisors, fallbackPath) {
  for (const supervisor of [...supervisors].reverse()) {
    for (const round of [...(supervisor.value.rounds || [])].reverse()) {
      if (round.nextMatrixPath && existsSync(round.nextMatrixPath)) return resolve(round.nextMatrixPath);
    }
  }
  return fallbackPath;
}

function stageCounts(matrix) {
  const rows = Array.isArray(matrix.rows) ? matrix.rows : [];
  return {
    totalRows: rows.length,
    dryRunPilotPackageReady: rows.filter((row) => row.executionCapabilityStage === "dry_run_pilot_package_ready").length,
    controlRouteReviewableBeforePilot: rows.filter((row) => row.executionCapabilityStage === "control_route_reviewable_before_pilot").length,
    observationReadyControlEvidenceMissing: rows.filter((row) => row.executionCapabilityStage === "observation_ready_control_evidence_missing").length,
    needsTeacherSignalOrControlEvidence: rows.filter((row) => row.executionCapabilityStage === "needs_teacher_signal_or_control_evidence").length,
    routeConfirmationRows: rows.filter((row) => row.nextActionLane === "confirm_numbered_target_or_exact_route").length,
    visualTargetConfirmationRows: rows.filter((row) => row.nextActionLane === "confirm_visible_window_and_numbered_target").length,
    dryRunPilotRows: rows.filter((row) => row.nextActionLane === "review_and_run_one_dry_run_pilot").length,
    logicSourceContractReadyForReview: rows.filter((row) => row.actionLogicSourceStatus === "logic_source_contract_ready_for_review").length,
    actionLogicSourceMissing: rows.filter((row) => row.actionLogicSourceStatus !== "logic_source_contract_ready_for_review").length
  };
}

function supervisorRows(supervisors) {
  return supervisors.map((supervisor, index) => {
    const counts = supervisor.value.counts || {};
    const rounds = Array.isArray(supervisor.value.rounds) ? supervisor.value.rounds : [];
    return {
      supervisorIndex: index + 1,
      supervisorPath: supervisor.path,
      status: supervisor.value.status || "",
      teacherReviewed: supervisor.value.teacherReviewed === true,
      roundsAttempted: counts.roundsAttempted || rounds.length,
      followUpBatches: counts.followUpBatches || 0,
      reconciliations: counts.reconciliations || 0,
      selectedRows: counts.selectedRows || 0,
      dryRunRunnerInvocations: counts.dryRunRunnerInvocations || 0,
      routeConfirmationRequests: counts.routeConfirmationRequests || 0,
      controlChannelProbePackages: counts.controlChannelProbePackages || 0,
      latestNextMatrixPath: latestMatrixFrom([supervisor], ""),
      nextAction:
        supervisor.value.teacherReviewed === true
          ? "review_latest_matrix_and_remaining_lanes"
          : "teacher_review_required_before_reconciliation_or_next_matrix"
    };
  });
}

function reconciliationRows(reconciliations) {
  return reconciliations.map((reconciliation, index) => {
    const counts = reconciliation.value.counts || {};
    const sourceEvidence = reconciliation.value.sourceEvidence || {};
    return {
      reconciliationIndex: index + 1,
      reconciliationPath: reconciliation.path,
      status: reconciliation.value.status || "",
      followUpBatchPath: sourceEvidence.followUpBatchPath || "",
      matrixPath: sourceEvidence.matrixPath || "",
      followUpTeacherReviewed: sourceEvidence.followUpTeacherReviewed === true,
      reconciledRows: counts.reconciledRows || 0,
      rowsReadyForNextMatrix: counts.rowsReadyForNextMatrix || 0,
      dryRunPilotReceipts: counts.dryRunPilotReceipts || 0,
      controlChannelProbePackages: counts.controlChannelProbePackages || 0,
      routeConfirmationRequests: counts.routeConfirmationRequests || 0,
      visualTargetConfirmationRequests: counts.visualTargetConfirmationRequests || 0,
      teacherSignalQuestions: counts.teacherSignalQuestions || 0,
      nextAction:
        sourceEvidence.followUpTeacherReviewed === true
          ? "review_reconciled_next_matrix_inputs"
          : "teacher_review_required_before_reconciled_rows_affect_next_matrix"
    };
  });
}

function writeReadme(path, audit) {
  const lines = [
    "# All-Software Execution Capability Convergence Audit",
    "",
    `Status: ${audit.status}`,
    `Initial matrix: ${audit.sourceEvidence.initialMatrixPath}`,
    `Latest matrix: ${audit.sourceEvidence.latestMatrixPath}`,
    `Supervisors audited: ${audit.counts.supervisorsAudited}`,
    `External reconciliations audited: ${audit.counts.externalReconciliationsAudited}`,
    `Remaining review gaps: ${audit.remainingReviewGaps.length}`,
    "",
    "What this audit does:",
    "- Aggregates execution capability supervisors and their latest generated matrix.",
    "- Optionally includes standalone follow-up reconciliation packets when a prior agent generated them outside a supervisor round.",
    "- Identifies remaining execution lanes, route-confirmation gaps, and teacher-signal gaps.",
    "- Prepares the next safest reviewed command.",
    "- Does not capture screenshots, read logs, send UI events, execute target software commands, write memory, or claim completion.",
    "",
    "Remaining gaps:",
    ...audit.remainingReviewGaps.map((gap, index) => `${index + 1}. ${gap.kind}: ${gap.detail}`),
    "",
    "Next command:",
    audit.nextCommand
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const initialMatrixInput = readJsonInput(argValue("--matrix", argValue("--matrix-path", "")), "--matrix");
if (initialMatrixInput.value.format !== "transparent_ai_all_software_execution_capability_matrix_v1") {
  throw new Error("Expected transparent_ai_all_software_execution_capability_matrix_v1");
}
const supervisorInputs = [...argValues("--supervisor"), ...argValues("--supervisor-path")];
const supervisors = supervisorInputs.map(normalizeSupervisor);
const reconciliationInputs = [...argValues("--reconciliation"), ...argValues("--reconciliation-path")];
const reconciliations = reconciliationInputs.map(normalizeReconciliation);
const goal = argValue("--goal", "Audit convergence of all-software execution capability matrix supervisors.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-capability-convergence-audits"))
);
mkdirSync(outputRoot, { recursive: true });
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });

const latestMatrixPath = latestMatrixFrom(supervisors, initialMatrixInput.path);
const latestMatrix = latestMatrixPath && existsSync(latestMatrixPath) ? readJson(latestMatrixPath) : initialMatrixInput.value;
const initialCounts = stageCounts(initialMatrixInput.value);
const latestCounts = stageCounts(latestMatrix);
const supervisorSummary = supervisorRows(supervisors);
const reconciliationSummary = reconciliationRows(reconciliations);
const totals = supervisorSummary.reduce(
  (acc, row) => {
    acc.roundsAttempted += row.roundsAttempted;
    acc.followUpBatches += row.followUpBatches;
    acc.reconciliations += row.reconciliations;
    acc.selectedRows += row.selectedRows;
    acc.dryRunRunnerInvocations += row.dryRunRunnerInvocations;
    acc.routeConfirmationRequests += row.routeConfirmationRequests;
    acc.controlChannelProbePackages += row.controlChannelProbePackages;
    return acc;
  },
  {
    roundsAttempted: 0,
    followUpBatches: 0,
    reconciliations: 0,
    selectedRows: 0,
    dryRunRunnerInvocations: 0,
    routeConfirmationRequests: 0,
    controlChannelProbePackages: 0
  }
);
const externalReconciliationTotals = reconciliationSummary.reduce(
  (acc, row) => {
    acc.reconciledRows += row.reconciledRows;
    acc.rowsReadyForNextMatrix += row.rowsReadyForNextMatrix;
    acc.dryRunPilotReceipts += row.dryRunPilotReceipts;
    acc.controlChannelProbePackages += row.controlChannelProbePackages;
    acc.routeConfirmationRequests += row.routeConfirmationRequests;
    acc.visualTargetConfirmationRequests += row.visualTargetConfirmationRequests;
    acc.teacherSignalQuestions += row.teacherSignalQuestions;
    return acc;
  },
  {
    reconciledRows: 0,
    rowsReadyForNextMatrix: 0,
    dryRunPilotReceipts: 0,
    controlChannelProbePackages: 0,
    routeConfirmationRequests: 0,
    visualTargetConfirmationRequests: 0,
    teacherSignalQuestions: 0
  }
);

const remainingReviewGaps = [];
if (supervisors.length === 0) {
  remainingReviewGaps.push({ kind: "missing_supervisor", detail: "No execution capability supervisor packets were provided." });
}
if (latestCounts.needsTeacherSignalOrControlEvidence > 0) {
  remainingReviewGaps.push({
    kind: "teacher_signal_or_control_evidence_missing",
    detail: `${latestCounts.needsTeacherSignalOrControlEvidence} latest matrix rows still need teacher signal or control-channel evidence.`
  });
}
if (latestCounts.observationReadyControlEvidenceMissing > 0) {
  remainingReviewGaps.push({
    kind: "control_channel_evidence_missing",
    detail: `${latestCounts.observationReadyControlEvidenceMissing} latest matrix rows have low-token observation but no reviewed control route.`
  });
}
if (latestCounts.actionLogicSourceMissing > 0) {
  remainingReviewGaps.push({
    kind: "action_logic_source_missing",
    detail: `${latestCounts.actionLogicSourceMissing} latest matrix rows still lack an action-level logic-source contract, so execution must remain blocked.`
  });
}
if (latestCounts.routeConfirmationRows + latestCounts.visualTargetConfirmationRows > 0) {
  remainingReviewGaps.push({
    kind: "target_or_route_confirmation_missing",
    detail: `${latestCounts.routeConfirmationRows + latestCounts.visualTargetConfirmationRows} latest matrix rows still need exact route or numbered target confirmation.`
  });
}
if (totals.dryRunRunnerInvocations < latestCounts.dryRunPilotRows) {
  remainingReviewGaps.push({
    kind: "dry_run_receipts_missing",
    detail: `${latestCounts.dryRunPilotRows} rows are dry-run-pilot candidates but only ${totals.dryRunRunnerInvocations} dry-run runner invocations are aggregated.`
  });
}
const unreviewedReconciliations = reconciliationSummary.filter((row) => row.followUpTeacherReviewed !== true);
if (unreviewedReconciliations.length > 0) {
  remainingReviewGaps.push({
    kind: "reconciliation_teacher_review_missing",
    detail: `${unreviewedReconciliations.length} external reconciliation packet(s) are present but still waiting for teacher review before they can affect the next matrix.`
  });
}

const executionConvergedForTeacherReview =
  latestCounts.totalRows > 0 &&
  remainingReviewGaps.length === 0 &&
  (totals.reconciliations > 0 || reconciliationSummary.some((row) => row.followUpTeacherReviewed === true)) &&
  supervisors.some((supervisor) => supervisor.value.teacherReviewed === true);
const status = executionConvergedForTeacherReview
  ? "bounded_execution_capability_ready_for_teacher_completion_review"
  : "execution_capability_still_has_remaining_lanes_or_review_gaps";
const nextCommand = remainingReviewGaps.some((gap) => gap.kind === "missing_supervisor")
  ? `node plugins/transparent-ai-apprentice/scripts/run-all-software-execution-capability-supervisor.mjs --matrix "${initialMatrixInput.path || "<matrix json>"}" --max-rounds 2 --max-rows 4 --teacher-reviewed`
  : remainingReviewGaps.length > 0
    ? "Review latest matrix gaps, confirm exact routes or numbered targets, then rerun a bounded execution capability supervisor pass."
    : "Review every dry-run receipt, route confirmation, and teacher exclusion before any completion claim.";

const auditPath = join(auditDir, "all-software-execution-capability-convergence-audit.json");
const receiptPath = join(auditDir, "all-software-execution-capability-convergence-audit-receipt.json");
const readmePath = join(auditDir, "ALL_SOFTWARE_EXECUTION_CAPABILITY_CONVERGENCE_AUDIT_START_HERE.md");
const lockState = locks();

const audit = {
  ok: true,
  format: "transparent_ai_all_software_execution_capability_convergence_audit_v1",
  auditId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceEvidence: {
    initialMatrixPath: initialMatrixInput.path,
    latestMatrixPath,
    supervisorPaths: supervisors.map((supervisor) => supervisor.path),
    reconciliationPaths: reconciliations.map((reconciliation) => reconciliation.path)
  },
  counts: {
    supervisorsAudited: supervisors.length,
    externalReconciliationsAudited: reconciliations.length,
    ...totals,
    externalReconciliationTotals,
    initialMatrix: initialCounts,
    latestMatrix: latestCounts,
    remainingReviewGaps: remainingReviewGaps.length
  },
  supervisorSummary,
  reconciliationSummary,
  remainingReviewGaps,
  executionConvergedForTeacherReview,
  allSoftwareExecutionComplete: false,
  nativeUniversalExecution: false,
  nextCommand,
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason: executionConvergedForTeacherReview
      ? "The bounded sampled execution matrix has enough evidence for teacher completion review, but full all-software/native execution acceptance is still unproven."
      : "Some latest matrix rows still need route confirmation, control-channel evidence, dry-run receipts, teacher signals, or exclusions.",
    stillNeeded: [
      "teacher reviews latest matrix and supervisor receipts",
      "remaining rows receive exact route, numbered target, dry-run receipt, or teacher-approved exclusion",
      "execute-mode routes pass separate approval gates",
      "unattended all-app monitoring and universal native semantic control remain separately unproven"
    ]
  },
  locks: lockState
};

const receipt = {
  ok: true,
  format: "transparent_ai_all_software_execution_capability_convergence_audit_receipt_v1",
  auditId,
  status,
  auditPath,
  readmePath,
  supervisorsAudited: supervisors.length,
  externalReconciliationsAudited: reconciliations.length,
  remainingReviewGaps: remainingReviewGaps.length,
  executionConvergedForTeacherReview,
  allSoftwareExecutionComplete: false,
  nativeUniversalExecution: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  logContentsRead: false,
  fileContentsRead: false,
  uiEventsSent: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  scheduledTaskInstalled: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: lockState
};

writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, audit);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_capability_convergence_audit_result_v1",
      auditId,
      status,
      auditPath,
      receiptPath,
      readmePath,
      counts: audit.counts,
      remainingReviewGaps: remainingReviewGaps.length,
      executionConvergedForTeacherReview,
      allSoftwareExecutionComplete: false,
      locks: lockState
    },
    null,
    2
  )
);
