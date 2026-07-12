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
    String(value || "execution-capability-matrix-follow-up-reconciliation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-capability-matrix-follow-up-reconciliation"
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

function runNodeScript(scriptName, args, timeout = 240000) {
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

function commandLine(scriptName, args) {
  const rendered = args.map((arg) => `"${String(arg).replace(/"/g, '\\"')}"`).join(" ");
  return `node plugins/transparent-ai-apprentice/scripts/${scriptName} ${rendered}`;
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
    uiEventsSent: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fileContentsRead: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    allSoftwareExecutionComplete: false,
    teacherAcceptanceRequired: true,
    ...extra
  };
}

function rowEvidenceKind(row) {
  if (row.runnerResult?.receiptPath || row.evidencePath?.includes("pilot-runner")) return "dry_run_pilot_receipt";
  if (row.probeResult?.probePlan || row.evidencePath?.includes("control-channel")) return "control_channel_probe_package";
  if (row.nextCall?.tool === "create_all_software_execution_pilot_queue") return "route_confirmation_request";
  if (row.nextCall?.tool === "create_visual_engineering_target_confirmation_kit") return "visual_target_confirmation_request";
  if (row.nextCall?.tool === "teach_apprentice") return "teacher_signal_question";
  return "review_only_handoff";
}

function nextLaneAfter(row) {
  const kind = rowEvidenceKind(row);
  if (kind === "dry_run_pilot_receipt") return "review_dry_run_receipt_then_decide_execute_gate_or_more_evidence";
  if (kind === "control_channel_probe_package") return "review_probe_result_then_rerun_control_channel_profile";
  if (kind === "route_confirmation_request") return "confirm_one_numbered_target_or_exact_structured_route";
  if (kind === "visual_target_confirmation_request") return "supply_one_teacher_reviewed_visual_evidence_file";
  if (kind === "teacher_signal_question") return "teacher_provides_signal_or_exclusion";
  return "review_handoff";
}

function buildRows(batch) {
  return (Array.isArray(batch.rowResults) ? batch.rowResults : []).map((row) => ({
    rowId: row.rowId || "",
    software: row.software || "",
    processName: row.processName || "",
    windowTitle: row.windowTitle || "",
    sourceLane: row.lane || "",
    sourceStatus: row.status || "",
    evidenceKind: rowEvidenceKind(row),
    evidencePath: realPath(row.evidencePath) || realPath(row.runnerResult?.receiptPath) || realPath(row.probeResult?.probePlan),
    runnerReceiptPath: realPath(row.runnerResult?.receiptPath),
    outcomeVerificationPath: realPath(row.runnerResult?.outcomeVerificationPath),
    postActionCheckpointPath: realPath(row.runnerResult?.postActionCheckpointPath),
    probePlanPath: realPath(row.probeResult?.probePlan),
    nextLane: nextLaneAfter(row),
    nextCalls: nextCallsFor(row),
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }));
}

function nextCallsFor(row) {
  const kind = rowEvidenceKind(row);
  if (kind === "dry_run_pilot_receipt") return ["verify_supervised_action_outcome", "create_post_action_evidence_checkpoint", "create_real_local_execution_approval_gate"];
  if (kind === "control_channel_probe_package") return ["create_software_control_channel_profile", "create_all_software_control_channel_coverage_audit"];
  if (kind === "route_confirmation_request") return ["confirm_engineering_command_target", "create_all_software_execution_pilot_queue"];
  if (kind === "visual_target_confirmation_request") return ["create_visual_engineering_target_confirmation_kit", "confirm_engineering_command_target"];
  if (kind === "teacher_signal_question") return ["teach_apprentice"];
  return ["teach_apprentice"];
}

function writeReadme(path, reconciliation) {
  const lines = [
    "# All-Software Execution Capability Matrix Follow-Up Reconciliation",
    "",
    `Status: ${reconciliation.status}`,
    `Follow-up batch: ${reconciliation.sourceEvidence.followUpBatchPath}`,
    `Rows reconciled: ${reconciliation.counts.reconciledRows}`,
    "",
    "What this does:",
    "- Turns follow-up batch row evidence into explicit next matrix lanes.",
    "- Prepares the next coverage, pilot queue, and matrix commands.",
    "- Optionally reruns only those safe generation tools after teacher review.",
    "- Does not capture screenshots, read logs, send UI events, execute target software commands, write memory, or claim completion.",
    "",
    "Next row review:",
    ...reconciliation.rows.map(
      (row, index) => `${index + 1}. ${row.software} / ${row.evidenceKind} / ${row.nextLane} / ${row.evidencePath || row.nextCalls.join(",")}`
    ),
    "",
    "Prepared commands:",
    reconciliation.plannedCommands.nextCoverageAuditCommand || "(missing source coverage input)",
    reconciliation.plannedCommands.nextPilotQueueCommand || "(missing source coverage input)",
    reconciliation.plannedCommands.nextMatrixCommand || "(missing matrix input)"
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const followUpInput = readJsonInput(argValue("--follow-up-batch", argValue("--batch", "")), "--follow-up-batch");
const followUpBatch = followUpInput.value;
if (followUpBatch.format !== "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1") {
  throw new Error("--follow-up-batch must be transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1");
}

const matrixInput = readJsonInput(argValue("--matrix", argValue("--matrix-path", followUpBatch.matrixPath || "")), "--matrix", true);
const coverageAuditPath =
  realPath(argValue("--coverage-audit", argValue("--control-channel-coverage-audit", ""))) ||
  realPath(matrixInput.value?.sourceEvidence?.coverageAuditPath);
const inventoryPath = realPath(argValue("--inventory", argValue("--inventory-path", ""))) || realPath(matrixInput.value?.sourceEvidence?.inventoryPath);
const pilotQueuePath = realPath(argValue("--pilot-queue", argValue("--execution-pilot-queue", ""))) || realPath(followUpBatch.pilotQueuePath);
const maxRows = Math.max(1, Number(argValue("--max-rows", "80")));
const teacherReviewedRerun = hasFlag("--teacher-reviewed-rerun") || hasFlag("--rerun-reviewed");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-capability-matrix-follow-up-reconciliations"))
);

mkdirSync(outputRoot, { recursive: true });
const reconciliationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(followUpBatch.goal || followUpBatch.batchId)}`;
const reconciliationDir = join(outputRoot, reconciliationId);
mkdirSync(reconciliationDir, { recursive: true });

const rows = buildRows(followUpBatch);
const counts = {
  reconciledRows: rows.length,
  dryRunPilotReceipts: rows.filter((row) => row.evidenceKind === "dry_run_pilot_receipt").length,
  controlChannelProbePackages: rows.filter((row) => row.evidenceKind === "control_channel_probe_package").length,
  routeConfirmationRequests: rows.filter((row) => row.evidenceKind === "route_confirmation_request").length,
  visualTargetConfirmationRequests: rows.filter((row) => row.evidenceKind === "visual_target_confirmation_request").length,
  teacherSignalQuestions: rows.filter((row) => row.evidenceKind === "teacher_signal_question").length,
  rowsReadyForNextMatrix: rows.filter((row) => row.evidenceKind === "dry_run_pilot_receipt" || row.evidenceKind === "control_channel_probe_package").length
};

const coverageArgs = coverageAuditPath
  ? [
      "--goal",
      followUpBatch.goal || "Reconcile execution matrix follow-up evidence into next control-channel coverage.",
      "--inventory",
      inventoryPath || "<inventory path>",
      "--max-software",
      String(maxRows),
      "--create-profiles",
      "--output-dir",
      join(reconciliationDir, "next-control-channel-coverage")
    ]
  : [];
if (coverageArgs.length && inventoryPath) coverageArgs.splice(4, 0);
const pilotQueueArgs = coverageAuditPath
  ? [
      "--goal",
      followUpBatch.goal || "Create the next execution pilot queue after matrix follow-up reconciliation.",
      "--coverage-audit",
      "<next or reviewed coverage audit path>",
      "--max-pilots",
      String(Math.max(1, Math.min(6, maxRows))),
      "--create-adapter-packages",
      "--output-dir",
      join(reconciliationDir, "next-execution-pilot-queue")
    ]
  : [];
const matrixArgs = [
  "--goal",
  followUpBatch.goal || "Create the next execution capability matrix after follow-up reconciliation.",
  "--output-dir",
  join(reconciliationDir, "next-execution-capability-matrix")
];
if (inventoryPath) matrixArgs.push("--inventory", inventoryPath);
if (coverageAuditPath) matrixArgs.push("--coverage-audit", "<next or reviewed coverage audit path>");
if (pilotQueuePath) matrixArgs.push("--pilot-queue", "<next or reviewed pilot queue path>");

let nextCoverageAudit = null;
let nextPilotQueue = null;
let nextMatrix = null;
let status = followUpBatch.teacherReviewed ? "ready_for_teacher_reviewed_next_matrix_rerun" : "waiting_for_follow_up_teacher_review";
let blockedReason = "";

if (teacherReviewedRerun) {
  if (followUpBatch.teacherReviewed !== true) {
    status = "blocked_unreviewed_follow_up_batch_cannot_rerun";
    blockedReason = "The follow-up batch itself was not teacher-reviewed.";
  } else if (!inventoryPath || !coverageAuditPath) {
    status = "missing_source_paths_for_rerun";
    blockedReason = "Inventory and coverage audit paths are required to rerun the next coverage, pilot queue, and matrix chain.";
  } else {
    const nextCoverageArgs = coverageArgs.map((arg) => (arg === "<inventory path>" ? inventoryPath : arg));
    nextCoverageAudit = runNodeScript("create-all-software-control-channel-coverage-audit.mjs", nextCoverageArgs);
    const nextPilotArgs = pilotQueueArgs.map((arg) => (arg === "<next or reviewed coverage audit path>" ? nextCoverageAudit.auditPath : arg));
    nextPilotQueue = runNodeScript("create-all-software-execution-pilot-queue.mjs", nextPilotArgs);
    const nextMatrixArgs = matrixArgs.map((arg) => {
      if (arg === "<next or reviewed coverage audit path>") return nextCoverageAudit.auditPath;
      if (arg === "<next or reviewed pilot queue path>") return nextPilotQueue.queuePath;
      return arg;
    });
    nextMatrix = runNodeScript("create-all-software-execution-capability-matrix.mjs", nextMatrixArgs);
    status = "reconciled_next_execution_matrix_ready_for_review";
  }
}

const plannedCommands = {
  nextCoverageAuditCommand:
    coverageArgs.length && inventoryPath
      ? commandLine("create-all-software-control-channel-coverage-audit.mjs", coverageArgs.map((arg) => (arg === "<inventory path>" ? inventoryPath : arg)))
      : "",
  nextPilotQueueCommand:
    pilotQueueArgs.length
      ? commandLine("create-all-software-execution-pilot-queue.mjs", pilotQueueArgs)
      : "",
  nextMatrixCommand: commandLine("create-all-software-execution-capability-matrix.mjs", matrixArgs)
};

const lockState = locks();
const reconciliationPath = join(reconciliationDir, "all-software-execution-capability-matrix-follow-up-reconciliation.json");
const receiptPath = join(reconciliationDir, "all-software-execution-capability-matrix-follow-up-reconciliation-receipt.json");
const readmePath = join(reconciliationDir, "ALL_SOFTWARE_EXECUTION_CAPABILITY_MATRIX_FOLLOW_UP_RECONCILIATION_START_HERE.md");

const reconciliation = {
  ok: true,
  format: "transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_v1",
  reconciliationId,
  createdAt: new Date().toISOString(),
  status,
  blockedReason,
  sourceEvidence: {
    followUpBatchPath: followUpInput.path,
    followUpBatchFormat: followUpBatch.format,
    matrixPath: matrixInput.path,
    matrixFormat: matrixInput.value?.format || "",
    inventoryPath,
    coverageAuditPath,
    pilotQueuePath,
    followUpTeacherReviewed: followUpBatch.teacherReviewed === true
  },
  counts,
  rows,
  plannedCommands,
  generated: {
    nextCoverageAuditPath: nextCoverageAudit?.auditPath || "",
    nextCoverageAuditReceiptPath: nextCoverageAudit?.receiptPath || "",
    nextPilotQueuePath: nextPilotQueue?.queuePath || "",
    nextPilotQueueReceiptPath: nextPilotQueue?.receiptPath || "",
    nextMatrixPath: nextMatrix?.matrixPath || "",
    nextMatrixReceiptPath: nextMatrix?.receiptPath || ""
  },
  nextTeacherActions: [
    "Review dry-run pilot receipts and probe packages before accepting any route.",
    "For route confirmation rows, confirm exactly one numbered target or exact structured route.",
    "For probe package rows, run or review the read-only probe result before rerunning control-channel coverage.",
    "Rerun the capability matrix only after teacher-reviewed evidence improves."
  ],
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason:
      "This reconciliation loops follow-up evidence into the next reviewed matrix pass. It does not prove every installed app has route evidence or execution receipts."
  },
  locks: lockState
};

writeFileSync(reconciliationPath, `${JSON.stringify(reconciliation, null, 2)}\n`, "utf8");
writeReadme(readmePath, reconciliation);
writeFileSync(
  receiptPath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_receipt_v1",
      reconciliationId,
      status,
      blockedReason,
      reconciliationPath,
      readmePath,
      counts,
      generated: reconciliation.generated,
      accepted: false,
      ruleEnabled: false,
      technologyAccepted: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      locks: lockState
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_result_v1",
      status,
      reconciliationPath,
      receiptPath,
      readmePath,
      counts,
      generated: reconciliation.generated,
      locks: lockState
    },
    null,
    2
  )
);
