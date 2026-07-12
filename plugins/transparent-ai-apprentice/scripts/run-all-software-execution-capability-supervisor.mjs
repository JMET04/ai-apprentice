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
    String(value || "all-software-execution-capability-supervisor")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-execution-capability-supervisor"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, optional = false) {
  const text = String(input || "").trim();
  if (!text) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  if (optional) return { value: null, path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function runNodeScript(scriptName, args, timeout = 300000) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function realPath(value) {
  const text = String(value || "").trim();
  return text && !text.includes("<") && existsSync(text) ? resolve(text) : "";
}

function locks(extra = {}) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    screenshotsCaptured: false,
    screenshotsCapturedByThisTool: false,
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
    teacherReviewRequiredBetweenRounds: true,
    dryRunFirst: true,
    ...extra
  };
}

function writeReadme(path, supervisor) {
  const lines = [
    "# All-Software Execution Capability Supervisor",
    "",
    `Status: ${supervisor.status}`,
    `Goal: ${supervisor.goal}`,
    `Rounds attempted: ${supervisor.counts.roundsAttempted}`,
    `Follow-up batches: ${supervisor.counts.followUpBatches}`,
    `Reconciliations: ${supervisor.counts.reconciliations}`,
    "",
    "What this does:",
    "- Reuses the existing execution capability matrix follow-up batch runner.",
    "- Reuses the existing follow-up reconciliation tool to create the next safe matrix pass.",
    "- Stops at teacher review when the supervisor is not explicitly teacher-reviewed.",
    "- Keeps every round bounded by max rounds and max rows.",
    "- Does not capture screenshots, read logs, send UI events, execute target software commands, write memory, or claim universal native execution.",
    "",
    "Round summary:",
    ...supervisor.rounds.map(
      (round) =>
        `${round.round}. ${round.status} / follow-up=${round.followUpBatchPath || ""} / reconciliation=${round.reconciliationPath || ""} / nextMatrix=${round.nextMatrixPath || ""}`
    ),
    "",
    "Next teacher actions:",
    ...supervisor.nextTeacherActions.map((item, index) => `${index + 1}. ${item}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const matrixInput = readJsonInput(argValue("--matrix", argValue("--matrix-path", "")), "--matrix");
if (matrixInput.value.format !== "transparent_ai_all_software_execution_capability_matrix_v1") {
  throw new Error("--matrix must be transparent_ai_all_software_execution_capability_matrix_v1");
}

const goal = argValue(
  "--goal",
  matrixInput.value.goal || "Advance all-software execution capability evidence through bounded reviewed rounds."
);
const teacherReviewed = hasFlag("--teacher-reviewed") || hasFlag("--teacher-confirmed");
const maxRounds = Math.max(1, Number(argValue("--max-rounds", argValue("--rounds", "2"))));
const maxRows = Math.max(1, Number(argValue("--max-rows", "4")));
const startRow = Math.max(1, Number(argValue("--start-row", argValue("--start-index", "1"))));
const laneFilter = argValue("--lane-filter", argValue("--next-action-lane", ""));
const actionLogicSourceStatus = argValue("--action-logic-source-status", argValue("--logic-source-status", ""));
let currentMatrixPath = matrixInput.path;
let currentMatrix = matrixInput.value;
let currentInventoryPath =
  realPath(argValue("--inventory", argValue("--inventory-path", ""))) || realPath(currentMatrix.sourceEvidence?.inventoryPath);
let currentCoverageAuditPath =
  realPath(argValue("--coverage-audit", argValue("--control-channel-coverage-audit", ""))) ||
  realPath(currentMatrix.sourceEvidence?.coverageAuditPath);
let currentPilotQueuePath =
  realPath(argValue("--pilot-queue", argValue("--execution-pilot-queue", ""))) ||
  realPath(currentMatrix.sourceEvidence?.pilotQueuePath);

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-capability-supervisors"))
);
mkdirSync(outputRoot, { recursive: true });
const supervisorId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const supervisorDir = join(outputRoot, supervisorId);
mkdirSync(supervisorDir, { recursive: true });

const rounds = [];
let status = teacherReviewed ? "reviewed_rounds_completed_waiting_for_teacher_matrix_review" : "prepared_waiting_for_teacher_review";
let blockedReason = "";

for (let round = 1; round <= maxRounds; round += 1) {
  const roundDir = join(supervisorDir, `round-${String(round).padStart(2, "0")}`);
  mkdirSync(roundDir, { recursive: true });
  const followArgs = [
    "--matrix",
    currentMatrixPath || JSON.stringify(currentMatrix),
    "--max-rows",
    String(maxRows),
    "--start-row",
    String(startRow),
    "--output-dir",
    join(roundDir, "follow-up")
  ];
  if (laneFilter) followArgs.push("--lane-filter", laneFilter);
  if (actionLogicSourceStatus) followArgs.push("--action-logic-source-status", actionLogicSourceStatus);
  if (currentPilotQueuePath) followArgs.push("--pilot-queue", currentPilotQueuePath);
  if (teacherReviewed) followArgs.push("--teacher-reviewed");
  const followUp = runNodeScript("run-all-software-execution-capability-matrix-follow-up-batch.mjs", followArgs);
  const followUpPacket = readJson(followUp.batchPath);

  const roundPacket = {
    round,
    status: teacherReviewed ? "follow_up_batch_reviewed" : "follow_up_batch_prepared_waiting_for_teacher_review",
    matrixPath: currentMatrixPath,
    followUpBatchPath: followUp.batchPath,
    followUpReceiptPath: followUp.receiptPath,
    followUpStatus: followUp.status,
    followUpCounts: followUpPacket.counts || followUp.counts || {},
    reconciliationPath: "",
    reconciliationReceiptPath: "",
    reconciliationStatus: "",
    nextCoverageAuditPath: "",
    nextPilotQueuePath: "",
    nextMatrixPath: "",
    stoppedBeforeReconciliation: !teacherReviewed,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  };

  if (!teacherReviewed) {
    rounds.push(roundPacket);
    status = "prepared_follow_up_waiting_for_teacher_review";
    blockedReason = "teacherReviewed=false; supervisor stopped before reconciliation or next matrix generation.";
    break;
  }

  const reconciliationArgs = [
    "--follow-up-batch",
    followUp.batchPath,
    "--matrix",
    currentMatrixPath || JSON.stringify(currentMatrix),
    "--teacher-reviewed-rerun",
    "--max-rows",
    String(maxRows),
    "--output-dir",
    join(roundDir, "reconciliation")
  ];
  if (currentInventoryPath) reconciliationArgs.push("--inventory", currentInventoryPath);
  if (currentCoverageAuditPath) reconciliationArgs.push("--coverage-audit", currentCoverageAuditPath);
  if (currentPilotQueuePath) reconciliationArgs.push("--pilot-queue", currentPilotQueuePath);
  const reconciliation = runNodeScript(
    "reconcile-all-software-execution-capability-matrix-follow-up-batch.mjs",
    reconciliationArgs
  );
  const reconciliationPacket = readJson(reconciliation.reconciliationPath);
  roundPacket.status = reconciliationPacket.status;
  roundPacket.reconciliationPath = reconciliation.reconciliationPath;
  roundPacket.reconciliationReceiptPath = reconciliation.receiptPath;
  roundPacket.reconciliationStatus = reconciliationPacket.status;
  roundPacket.nextCoverageAuditPath = reconciliationPacket.generated?.nextCoverageAuditPath || "";
  roundPacket.nextPilotQueuePath = reconciliationPacket.generated?.nextPilotQueuePath || "";
  roundPacket.nextMatrixPath = reconciliationPacket.generated?.nextMatrixPath || "";
  roundPacket.stoppedBeforeReconciliation = false;
  rounds.push(roundPacket);

  if (!roundPacket.nextMatrixPath || !existsSync(roundPacket.nextMatrixPath)) {
    status = "stopped_no_next_matrix_generated";
    blockedReason = reconciliationPacket.blockedReason || "The reconciliation did not generate a next execution capability matrix.";
    break;
  }

  currentMatrixPath = roundPacket.nextMatrixPath;
  currentMatrix = readJson(currentMatrixPath);
  currentCoverageAuditPath = realPath(roundPacket.nextCoverageAuditPath) || currentCoverageAuditPath;
  currentPilotQueuePath = realPath(roundPacket.nextPilotQueuePath) || currentPilotQueuePath;
}

const totals = rounds.reduce(
  (acc, round) => {
    const counts = round.followUpCounts || {};
    acc.selectedRows += counts.selectedRows || 0;
    acc.dryRunRunnerInvocations += counts.dryRunRunnerInvocations || 0;
    acc.routeConfirmationRequests += counts.routeConfirmationRequests || 0;
    acc.controlChannelProbePackages += counts.controlChannelProbePackages || 0;
    return acc;
  },
  {
    selectedRows: 0,
    dryRunRunnerInvocations: 0,
    routeConfirmationRequests: 0,
    controlChannelProbePackages: 0
  }
);

const lockState = locks();
const supervisorPath = join(supervisorDir, "all-software-execution-capability-supervisor.json");
const receiptPath = join(supervisorDir, "all-software-execution-capability-supervisor-receipt.json");
const readmePath = join(supervisorDir, "ALL_SOFTWARE_EXECUTION_CAPABILITY_SUPERVISOR_START_HERE.md");

const supervisor = {
  ok: true,
  format: "transparent_ai_all_software_execution_capability_supervisor_v1",
  supervisorId,
  createdAt: new Date().toISOString(),
  status,
  blockedReason,
  goal,
  sourceEvidence: {
    initialMatrixPath: matrixInput.path,
    initialMatrixFormat: matrixInput.value.format,
    initialInventoryPath: currentInventoryPath,
    initialCoverageAuditPath:
      realPath(argValue("--coverage-audit", argValue("--control-channel-coverage-audit", ""))) ||
      realPath(matrixInput.value.sourceEvidence?.coverageAuditPath),
    initialPilotQueuePath:
      realPath(argValue("--pilot-queue", argValue("--execution-pilot-queue", ""))) ||
      realPath(matrixInput.value.sourceEvidence?.pilotQueuePath)
  },
  teacherReviewed,
  maxRounds,
  maxRows,
  rounds,
  counts: {
    roundsAttempted: rounds.length,
    followUpBatches: rounds.filter((round) => round.followUpBatchPath).length,
    reconciliations: rounds.filter((round) => round.reconciliationPath).length,
    ...totals
  },
  nextTeacherActions: [
    "Review each follow-up batch row and any dry-run pilot receipt before widening.",
    "Confirm exactly one numbered target or exact structured route for route-confirmation rows.",
    "Review generated control-channel probe evidence before accepting a route.",
    "Only after teacher review should another supervisor pass or execute approval gate be considered."
  ],
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason:
      "This supervisor advances bounded execution capability evidence through existing review-only tools. It is not proof that every installed app has native semantic execution coverage."
  },
  locks: lockState
};

const receipt = {
  ok: true,
  format: "transparent_ai_all_software_execution_capability_supervisor_receipt_v1",
  supervisorId,
  status,
  blockedReason,
  supervisorPath,
  readmePath,
  teacherReviewed,
  counts: supervisor.counts,
  rounds: rounds.map((round) => ({
    round: round.round,
    status: round.status,
    followUpBatchPath: round.followUpBatchPath,
    reconciliationPath: round.reconciliationPath,
    nextMatrixPath: round.nextMatrixPath
  })),
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  logContentsRead: false,
  fileContentsRead: false,
  uiEventsSent: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  locks: lockState
};

writeFileSync(supervisorPath, `${JSON.stringify(supervisor, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, supervisor);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_capability_supervisor_result_v1",
      status,
      blockedReason,
      supervisorPath,
      receiptPath,
      readmePath,
      counts: supervisor.counts,
      lastMatrixPath: rounds.at(-1)?.nextMatrixPath || currentMatrixPath,
      locks: lockState
    },
    null,
    2
  )
);
