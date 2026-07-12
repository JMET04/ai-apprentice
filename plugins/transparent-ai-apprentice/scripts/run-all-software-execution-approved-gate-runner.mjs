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
    String(value || "all-software-execution-approved-gate-runner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-execution-approved-gate-runner"
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

function explicitFinalConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed approved execution gate runner",
    "teacher confirmed approved gate runner",
    "approve approved execution gate runner",
    "i confirm approved execution gate runner",
    "teacher confirmed all-software execution pilot"
  ].some((marker) => text.includes(marker));
}

function hasPlaceholder(value) {
  const text = String(value || "");
  return /^<[^>]+>$/.test(text.trim()) || text.includes("<") || text.includes(">") || text.includes("__");
}

function gateArgsAreUsable(args) {
  if (!Array.isArray(args) || !args.length) return false;
  return args.every((item) => !hasPlaceholder(item));
}

function removeOutputDirArgs(args) {
  const clean = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--output-dir") {
      index += 1;
      continue;
    }
    clean.push(args[index]);
  }
  return clean;
}

function readOptionalJson(path) {
  if (!path || !existsSync(path)) return null;
  return readJson(path);
}

function runPilotRunner(args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, "run-all-software-execution-pilot-runner.mjs"), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) {
    return {
      ok: false,
      error: result.stderr || result.stdout || "run-all-software-execution-pilot-runner.mjs failed"
    };
  }
  return { ok: true, result: JSON.parse(result.stdout) };
}

function writeReadme(path, packet) {
  const lines = [
    "# All-Software Execution Approved Gate Runner",
    "",
    `Status: ${packet.status}`,
    `Gate status: ${packet.approvalGateStatus}`,
    `Runner invoked: ${packet.runnerInvoked ? "yes" : "no"}`,
    `Controlled route action executed: ${packet.controlledRouteActionExecuted ? "yes" : "no"}`,
    "",
    "This packet consumes one ready real-local execution approval gate and invokes the existing pilot runner only when final teacher confirmation and rollback evidence are present.",
    "",
    "Review order:",
    "1. Confirm the approval gate is ready and references the intended single pilot.",
    "2. Confirm the exact generated runner request was used with a controlled output directory.",
    "3. Inspect the pilot runner receipt, adapter receipt, outcome verification, and post-action checkpoint.",
    "4. Do not write memory or claim broad software coverage until the teacher reviews the controlled route result.",
    "",
    "Blocking reasons:"
  ];
  for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  if (!packet.blockers.length) lines.push("- none");
  lines.push(
    "",
    "Boundary: this runner can execute one approved controlled route. It still does not capture screenshots, write memory, enable rules, unlock packaging, prove native universal execution, or prove all-software completion."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writePacket(runDir, packet) {
  const packetPath = join(runDir, "all-software-execution-approved-gate-runner.json");
  const receiptPath = join(runDir, "all-software-execution-approved-gate-runner-receipt.json");
  const readmePath = join(runDir, "ALL_SOFTWARE_EXECUTION_APPROVED_GATE_RUNNER_START_HERE.md");
  packet.paths.packet = packetPath;
  packet.paths.receipt = receiptPath;
  packet.paths.readme = readmePath;
  const receipt = {
    ok: true,
    format: "transparent_ai_all_software_execution_approved_gate_runner_receipt_v1",
    approvedRunId: packet.approvedRunId,
    status: packet.status,
    approvalGateStatus: packet.approvalGateStatus,
    runnerInvoked: packet.runnerInvoked,
    controlledRouteActionExecuted: packet.controlledRouteActionExecuted,
    targetSoftwareCommandsExecuted: packet.targetSoftwareCommandsExecuted,
    uiEventsSent: packet.uiEventsSent,
    pilotRunnerReceiptPath: packet.generatedEvidence.pilotRunnerReceiptPath,
    adapterReceiptPath: packet.generatedEvidence.adapterReceiptPath,
    outcomeVerificationPath: packet.generatedEvidence.outcomeVerificationPath,
    postActionCheckpointPath: packet.generatedEvidence.postActionCheckpointPath,
    blockers: packet.blockers,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false,
    locks: packet.locks
  };
  writeReadme(readmePath, packet);
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return { packetPath, receiptPath, readmePath };
}

const goal = argValue("--goal", argValue("--task", "Run one teacher-approved real-local execution gate request."));
const gateInput = readJsonInput(
  argValue("--gate", argValue("--approval-gate", "")),
  "--gate",
  "transparent_ai_real_local_execution_approval_gate_v1"
);
if (!gateInput.value) throw new Error("--gate is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-approved-gate-runs"))
);
const approvedRunId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const runDir = join(outputRoot, approvedRunId);
mkdirSync(runDir, { recursive: true });

const gate = gateInput.value;
const generatedRequest = gate.generatedRunnerRequest || {};
const generatedArgs = Array.isArray(generatedRequest.args) ? generatedRequest.args : [];
const gateReady =
  gate.status === "ready_for_teacher_confirmed_execute_runner_request" &&
  gate.readyForExecuteRequest === true &&
  generatedRequest.tool === "run_all_software_execution_pilot_runner" &&
  generatedRequest.script === "run-all-software-execution-pilot-runner.mjs" &&
  generatedArgs.includes("--execute");
const finalConfirmation = explicitFinalConfirmation(argValue("--teacher-confirmation", argValue("--confirmation", "")));
const executeApprovedGate = hasFlag("--execute-approved-gate");
const blockers = [];
if (!gateReady) blockers.push("approval_gate_not_ready_for_execute_runner_request");
if (!gateArgsAreUsable(generatedArgs)) blockers.push("approval_gate_generated_runner_args_missing_or_contain_placeholders");
if (!executeApprovedGate) blockers.push("missing_execute_approved_gate_flag");
if (!finalConfirmation) blockers.push("missing_final_teacher_approved_gate_confirmation");
if (!hasFlag("--rollback-point-created")) blockers.push("rollback_point_not_confirmed_for_approved_gate_run");

let runnerInvoked = false;
let runnerResult = null;
let runnerPacket = null;
let runnerReceipt = null;
let adapterReceipt = null;
let controlledRouteActionExecuted = false;
let uiEventsSent = false;
let targetSoftwareCommandsExecuted = false;
if (blockers.length === 0) {
  const pilotRunOutputDir = join(outputRoot, `${approvedRunId.slice(0, 24)}-pilot-run`);
  const runnerArgs = [
    ...removeOutputDirArgs(generatedArgs),
    "--output-dir",
    pilotRunOutputDir
  ];
  runnerInvoked = true;
  const run = runPilotRunner(runnerArgs, process.cwd());
  if (!run.ok) {
    blockers.push(`pilot_runner_failed: ${run.error}`);
  } else {
    runnerResult = run.result;
    runnerPacket = readOptionalJson(runnerResult.runPath);
    runnerReceipt = readOptionalJson(runnerResult.receiptPath);
    adapterReceipt = readOptionalJson(runnerResult.adapterReceiptPath);
    controlledRouteActionExecuted = runnerResult.controlledRouteActionExecuted === true;
    uiEventsSent = Boolean(adapterReceipt?.uiEventsSent || runnerPacket?.controlledRoute?.uiEventsSent);
    targetSoftwareCommandsExecuted = controlledRouteActionExecuted;
  }
}

const status =
  blockers.length > 0 && !runnerInvoked
    ? "blocked_before_approved_gate_runner"
    : controlledRouteActionExecuted
      ? "approved_gate_controlled_route_completed_waiting_for_teacher_review"
      : runnerInvoked
        ? "approved_gate_runner_invoked_waiting_for_teacher_review"
        : "blocked";
const locks = {
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  approvedGateRunnerRequiresReadyGate: true,
  finalTeacherConfirmationRequired: true,
  rollbackPointRequired: true,
  onePilotOnly: true,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false
};
const packet = {
  ok: true,
  format: "transparent_ai_all_software_execution_approved_gate_runner_v1",
  approvedRunId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  approvalGateStatus: gate.status || "",
  selected: gate.selected || null,
  sourceEvidence: {
    approvalGatePath: gateInput.path,
    executionPilotQueuePath: gate.sourceEvidence?.executionPilotQueuePath || "",
    pilotActionPlanPath: gate.sourceEvidence?.pilotActionPlanPath || "",
    adapterPackagePath: gate.sourceEvidence?.adapterPackagePath || "",
    runnerPath: gate.sourceEvidence?.runnerPath || "",
    generatedRunnerRequest: generatedRequest
  },
  gateReady,
  executeApprovedGate,
  finalConfirmationMatched: finalConfirmation,
  rollbackPointCreated: hasFlag("--rollback-point-created"),
  runnerInvoked,
  controlledRouteActionExecuted,
  targetSoftwareCommandsExecuted,
  uiEventsSent,
  generatedEvidence: {
    pilotRunnerPath: runnerResult?.runPath || "",
    pilotRunnerReceiptPath: runnerResult?.receiptPath || "",
    adapterReceiptPath: runnerResult?.adapterReceiptPath || "",
    outcomeVerificationPath: runnerResult?.outcomeVerificationPath || "",
    postActionCheckpointPath: runnerResult?.postActionCheckpointPath || "",
    runnerResult,
    adapterReceiptSummary: adapterReceipt
      ? {
          status: adapterReceipt.status || "",
          commandExecuted: Boolean(adapterReceipt.commandExecuted),
          apiRequestSent: Boolean(adapterReceipt.apiRequestSent),
          filesWrittenForImport: Boolean(adapterReceipt.filesWrittenForImport),
          browserDomOperationApplied: Boolean(adapterReceipt.browserDomOperationApplied),
          browserCdpOperationApplied: Boolean(adapterReceipt.browserCdpOperationApplied),
          uiEventsSent: Boolean(adapterReceipt.uiEventsSent),
          cliOutputPath: adapterReceipt.cliOutputPath || ""
        }
      : null,
    runnerReceipt
  },
  blockers,
  nextTeacherActions: controlledRouteActionExecuted
    ? [
        "Review the pilot runner receipt, adapter receipt, outcome verification, and post-action checkpoint.",
        "Confirm whether this one controlled route matches the teacher intent.",
        "If correct, continue with another reviewed software row instead of claiming universal execution.",
        "If incorrect, correct the route evidence before any memory or rule save."
      ]
    : [
        "Resolve every blocker before invoking the approved gate runner.",
        "Use only a ready real-local execution approval gate with final teacher confirmation and rollback evidence.",
        "Do not manually copy or mutate generated runner arguments outside the approval gate."
      ],
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason:
      "This approved gate runner can execute only one teacher-approved controlled route. It does not prove universal native execution or all-software completion."
  },
  paths: {},
  locks
};
const paths = writePacket(runDir, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_approved_gate_runner_result_v1",
      approvedRunId,
      status,
      packetPath: paths.packetPath,
      receiptPath: paths.receiptPath,
      readmePath: paths.readmePath,
      approvalGatePath: gateInput.path,
      runnerInvoked,
      controlledRouteActionExecuted,
      targetSoftwareCommandsExecuted,
      uiEventsSent,
      pilotRunnerPath: runnerResult?.runPath || "",
      pilotRunnerReceiptPath: runnerResult?.receiptPath || "",
      adapterReceiptPath: runnerResult?.adapterReceiptPath || "",
      outcomeVerificationPath: runnerResult?.outcomeVerificationPath || "",
      postActionCheckpointPath: runnerResult?.postActionCheckpointPath || "",
      blockers,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false,
      locks
    },
    null,
    2
  )
);
