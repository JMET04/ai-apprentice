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
    String(value || "tlcl-medium-runtime-approved-gate-runner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "tlcl-medium-runtime-approved-gate-runner"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
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
    "i confirm approved execution gate runner"
  ].some((marker) => text.includes(marker));
}

function runApprovedGateRunner(args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, "run-all-software-execution-approved-gate-runner.mjs"), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) return { ok: false, error: result.stderr || result.stdout || "approved gate runner failed" };
  return { ok: true, result: JSON.parse(result.stdout) };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function locks() {
  return {
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    tlclWrapperRequiresReadyCommandBuilder: true,
    finalTeacherConfirmationRequired: true,
    rollbackPointRequired: true,
    oneApprovedGateOnly: true,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function providerRoleUsePlanTraceFromBuilder(builder) {
  return builder?.sourceEvidence?.providerRoleUsePlanTrace || {};
}

const goal = argValue("--goal", argValue("--task", "Run one TLCL teacher-approved execution gate request."));
const builderInput = readJsonInput(
  argValue("--builder", argValue("--tlcl-command-builder", "")),
  "--builder",
  "transparent_ai_tlcl_medium_runtime_approved_gate_command_builder_v1"
);
if (!builderInput.value) throw new Error("--builder is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-approved-gate-runs"))
);
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const runDir = join(outputRoot, runId);
mkdirSync(runDir, { recursive: true });

const builder = builderInput.value;
const approvalGatePath = argValue("--gate", builder.sourceEvidence?.approvalGatePath || "");
const executeApprovedGate = hasFlag("--execute-approved-gate");
const finalConfirmation = explicitFinalConfirmation(argValue("--teacher-confirmation", argValue("--confirmation", "")));
const rollbackPointCreated = hasFlag("--rollback-point-created");
const blockers = [];
if (builder.status !== "tlcl_approved_gate_command_builder_ready_for_teacher_final_confirmation") {
  blockers.push("tlcl_command_builder_not_ready_for_final_confirmation");
}
if (builder.existingCommandBuilderInvoked !== true) blockers.push("existing_command_builder_not_invoked");
if (builder.existingCommandBuilderStatus !== "approval_gate_command_builder_ready_for_teacher_final_confirmation") {
  blockers.push("existing_command_builder_not_ready_for_final_confirmation");
}
if (builder.locks?.wrapperDoesNotRunApprovedGate !== true) blockers.push("tlcl_command_builder_execution_lock_missing");
if (!approvalGatePath || !existsSync(approvalGatePath)) blockers.push("approval_gate_path_missing");
if (!executeApprovedGate) blockers.push("missing_execute_approved_gate_flag");
if (!finalConfirmation) blockers.push("missing_final_teacher_tlcl_approved_gate_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed_for_tlcl_approved_gate_run");

let runnerInvoked = false;
let runnerResult = null;
const existingRunnerOutputRoot = join(process.cwd(), ".ta", "agr", runId.slice(0, 24));
if (blockers.length === 0) {
  runnerInvoked = true;
  const run = runApprovedGateRunner(
    [
      "--goal",
      goal,
      "--gate",
      approvalGatePath,
      "--execute-approved-gate",
      "--teacher-confirmation",
      argValue("--teacher-confirmation", argValue("--confirmation", "")),
      "--rollback-point-created",
      "--output-dir",
      existingRunnerOutputRoot
    ],
    process.cwd()
  );
  if (!run.ok) {
    blockers.push(`approved_gate_runner_failed: ${run.error}`);
  } else {
    runnerResult = run.result;
  }
}

const controlledRouteActionExecuted = runnerResult?.controlledRouteActionExecuted === true;
const status =
  blockers.length > 0 && !runnerInvoked
    ? "blocked_before_tlcl_approved_gate_runner"
    : controlledRouteActionExecuted
      ? "tlcl_approved_gate_controlled_route_completed_waiting_for_teacher_review"
      : runnerInvoked
        ? "tlcl_approved_gate_runner_invoked_waiting_for_teacher_review"
        : "blocked";
const packetPath = join(runDir, "tlcl-medium-runtime-approved-gate-runner.json");
const receiptPath = join(runDir, "tlcl-medium-runtime-approved-gate-runner-receipt.json");
const readmePath = join(runDir, "TLCL_MEDIUM_RUNTIME_APPROVED_GATE_RUNNER_START_HERE.md");
const packet = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_approved_gate_runner_v1",
  runId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceEvidence: {
    tlclCommandBuilderPath: builderInput.path,
    approvalGatePath,
    providerRoleUsePlanTrace: providerRoleUsePlanTraceFromBuilder(builder),
    existingApprovedGateRunnerScript: join(__dirname, "run-all-software-execution-approved-gate-runner.mjs"),
    existingApprovedGateRunnerOutputRoot: existingRunnerOutputRoot
  },
  executeApprovedGate,
  finalConfirmationMatched: finalConfirmation,
  rollbackPointCreated,
  runnerInvoked,
  controlledRouteActionExecuted,
  targetSoftwareCommandsExecuted: runnerResult?.targetSoftwareCommandsExecuted === true,
  uiEventsSent: runnerResult?.uiEventsSent === true,
  generatedEvidence: {
    existingRunnerResult: runnerResult,
    existingRunnerPacketPath: runnerResult?.packetPath || "",
    existingRunnerReceiptPath: runnerResult?.receiptPath || "",
    pilotRunnerPath: runnerResult?.pilotRunnerPath || "",
    adapterReceiptPath: runnerResult?.adapterReceiptPath || "",
    outcomeVerificationPath: runnerResult?.outcomeVerificationPath || "",
    postActionCheckpointPath: runnerResult?.postActionCheckpointPath || ""
  },
  blockers,
  nextTeacherActions: controlledRouteActionExecuted
    ? [
        "Review the existing approved-gate runner packet, receipt, adapter receipt, outcome verification, and post-action checkpoint.",
        "Decide whether this one controlled route matched the TLCL contract.",
        "If wrong, return correction to senior compile before memory or rule enablement."
      ]
    : [
        "Resolve every blocker before invoking the TLCL approved gate runner.",
        "Use only a TLCL ready command builder with final teacher confirmation and rollback evidence."
      ],
  completionBoundary: {
    goalComplete: false,
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason: "This wrapper can execute only one teacher-approved TLCL controlled route. It does not prove universal execution or complete the apprentice."
  },
  paths: {
    packet: packetPath,
    receipt: receiptPath,
    readme: readmePath
  },
  locks: locks()
};
const receipt = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_approved_gate_runner_receipt_v1",
  runId,
  status,
  runnerInvoked,
  controlledRouteActionExecuted,
  targetSoftwareCommandsExecuted: packet.targetSoftwareCommandsExecuted,
  uiEventsSent: packet.uiEventsSent,
  existingRunnerReceiptPath: packet.generatedEvidence.existingRunnerReceiptPath,
  adapterReceiptPath: packet.generatedEvidence.adapterReceiptPath,
  outcomeVerificationPath: packet.generatedEvidence.outcomeVerificationPath,
  postActionCheckpointPath: packet.generatedEvidence.postActionCheckpointPath,
  blockers,
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
  locks: locks()
};

writeJson(packetPath, packet);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Approved Gate Runner",
    "",
    `Status: ${status}`,
    `Runner invoked: ${runnerInvoked ? "yes" : "no"}`,
    `Controlled route action executed: ${controlledRouteActionExecuted ? "yes" : "no"}`,
    "",
    "This wrapper invokes the existing approved-gate runner only for one TLCL ready command builder with final teacher confirmation and rollback evidence.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    "Boundary: it can execute one controlled route, but it does not write memory, enable rules, unlock packaging, claim universal execution, or complete the apprentice."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_medium_runtime_approved_gate_runner_result_v1",
      runId,
      status,
      packetPath,
      receiptPath,
      readmePath,
      approvalGatePath,
      runnerInvoked,
      controlledRouteActionExecuted,
      targetSoftwareCommandsExecuted: packet.targetSoftwareCommandsExecuted,
      uiEventsSent: packet.uiEventsSent,
      existingRunnerPacketPath: packet.generatedEvidence.existingRunnerPacketPath,
      existingRunnerReceiptPath: packet.generatedEvidence.existingRunnerReceiptPath,
      adapterReceiptPath: packet.generatedEvidence.adapterReceiptPath,
      outcomeVerificationPath: packet.generatedEvidence.outcomeVerificationPath,
      postActionCheckpointPath: packet.generatedEvidence.postActionCheckpointPath,
      blockers,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false,
      locks: locks()
    },
    null,
    2
  )
);
