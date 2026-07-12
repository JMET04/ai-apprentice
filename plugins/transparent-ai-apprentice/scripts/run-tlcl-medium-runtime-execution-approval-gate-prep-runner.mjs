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
    String(value || "tlcl-medium-runtime-execution-approval-gate-prep-runner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "tlcl-medium-runtime-execution-approval-gate-prep-runner"
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

function isPlaceholder(value) {
  const text = String(value || "").trim();
  return /^<[^>]+>$/.test(text) || /^__[^_]+__/.test(text) || text.includes("<") || text.includes(">");
}

function pathOrJsonUsable(value) {
  const text = String(value || "").trim();
  if (!text || isPlaceholder(text)) return false;
  if (text.startsWith("{")) return true;
  return existsSync(text);
}

function reviewedPathUsable(value) {
  const text = String(value || "").trim();
  if (!text || isPlaceholder(text)) return false;
  return existsSync(text);
}

function explicitTeacherConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed tlcl execution approval gate",
    "teacher confirmed tlcl execution pilot",
    "approve tlcl controlled execution pilot",
    "allow tlcl controlled execution pilot",
    "teacher confirmed all-software execution pilot",
    "teacher confirmed execution pilot",
    "approve controlled execution pilot",
    "allow controlled execution pilot",
    "i confirm tlcl execution pilot",
    "i approve tlcl controlled execution pilot"
  ].some((marker) => text.includes(marker));
}

function routeEvidence(adapterId) {
  if (adapterId === "existing-cli-or-script") {
    return {
      arg: "--reviewed-command",
      value: argValue("--reviewed-command", ""),
      blocker: "missing_reviewed_command_manifest"
    };
  }
  if (adapterId === "existing-application-api") {
    return {
      arg: "--reviewed-api-request",
      value: argValue("--reviewed-api-request", ""),
      blocker: "missing_reviewed_api_request"
    };
  }
  if (adapterId === "existing-file-import-export") {
    return {
      arg: "--reviewed-mapping",
      value: argValue("--reviewed-mapping", ""),
      blocker: "missing_reviewed_file_mapping"
    };
  }
  if (adapterId === "existing-browser-automation") {
    return {
      arg: "--reviewed-browser-target",
      value: argValue("--reviewed-browser-target", ""),
      blocker: "missing_reviewed_browser_target"
    };
  }
  return {
    arg: "--target-window-title",
    value: argValue("--target-window-title", ""),
    blocker: "missing_target_window_title"
  };
}

function providerRoleUsePlanTraceFromValidation(validation) {
  return (
    validation?.executionApprovalGatePlanningHandoff?.providerRoleUsePlanTrace ||
    validation?.sourceEvidence?.providerRoleUsePlanTrace ||
    {}
  );
}

function runApprovalGate(args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, "create-real-local-execution-approval-gate.mjs"), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) {
    return {
      ok: false,
      error: result.stderr || result.stdout || "create-real-local-execution-approval-gate.mjs failed"
    };
  }
  return { ok: true, result: JSON.parse(result.stdout) };
}

function writeReadme(path, packet) {
  const lines = [
    "# TLCL Medium Runtime Execution Approval Gate Prep Runner",
    "",
    `Status: ${packet.status}`,
    `Post-run validation status: ${packet.postRunValidationStatus}`,
    `Approval gate invoked: ${packet.approvalGateInvoked ? "yes" : "no"}`,
    `Ready for execute request: ${packet.readyForExecuteRequest ? "yes" : "no"}`,
    "",
    "This packet bridges a matched TLCL dry-run-only post-run validation into the existing real-local execution approval gate.",
    "",
    "Review order:",
    "1. Confirm the TLCL post-run validation is ready for execution approval gate planning.",
    "2. Confirm the selected pilot, adapter, selector, queue, and reviewed route evidence match the teacher intent.",
    "3. Confirm explicit teacher execute approval text and a retained rollback point for this exact attempt.",
    "4. Review the generated approval gate packet before any supervised execute runner request.",
    "",
    "Blocking reasons:"
  ];
  for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  if (!packet.blockers.length) lines.push("- none");
  lines.push(
    "",
    "Locked boundary: this TLCL prep runner may create an approval gate packet, but it does not invoke the execution runner, execute target software, send UI events, capture screenshots, write memory, enable rules, unlock packaging, or claim completion."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writePacket(prepDir, packet) {
  const packetPath = join(prepDir, "tlcl-medium-runtime-execution-approval-gate-prep-runner.json");
  const receiptPath = join(prepDir, "tlcl-medium-runtime-execution-approval-gate-prep-runner-receipt.json");
  const readmePath = join(prepDir, "TLCL_MEDIUM_RUNTIME_EXECUTION_APPROVAL_GATE_PREP_RUNNER_START_HERE.md");
  packet.paths.packet = packetPath;
  packet.paths.receipt = receiptPath;
  packet.paths.readme = readmePath;
  const receipt = {
    ok: true,
    format: "transparent_ai_tlcl_medium_runtime_execution_approval_gate_prep_runner_receipt_v1",
    prepId: packet.prepId,
    status: packet.status,
    postRunValidationStatus: packet.postRunValidationStatus,
    validationReady: packet.validationReady,
    approvalGateInvoked: packet.approvalGateInvoked,
    approvalGateStatus: packet.approvalGateStatus,
    readyForExecuteRequest: packet.readyForExecuteRequest,
    approvalGatePath: packet.generatedEvidence.approvalGatePath,
    approvalGateReceiptPath: packet.generatedEvidence.approvalGateReceiptPath,
    blockers: packet.blockers,
    approvalGateDoesNotRunRunner: true,
    prepRunnerDoesNotInvokeExecutionRunner: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    goalComplete: false,
    locks: packet.locks
  };
  writeReadme(readmePath, packet);
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return { packetPath, receiptPath, readmePath };
}

const goal = argValue("--goal", argValue("--task", "Prepare a TLCL execution approval gate after matched dry-run evidence."));
const validationInput = readJsonInput(
  argValue("--validation", argValue("--post-run-validation", "")),
  "--validation",
  "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_validation_v1"
);
if (!validationInput.value) throw new Error("--validation is required");

const validation = validationInput.value;
const handoff = validation.executionApprovalGatePlanningHandoff || {};
const selectedPilotId = argValue("--selected-pilot-id", argValue("--pilot-id", ""));
const selectedNumber = argValue("--selected-number", argValue("--number", ""));
const adapterId = argValue("--adapter-id", "");
const selector = argValue("--selector", argValue("--selector-path", ""));
const queue = argValue("--queue", argValue("--queue-path", ""));
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--confirmation", ""));
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-execution-approval-gate-prep-runners"))
);
const prepId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const prepDir = join(outputRoot, prepId);
mkdirSync(prepDir, { recursive: true });

const route = routeEvidence(adapterId);
const validationReady =
  validation.status === "ready_for_execution_approval_gate_planning" &&
  validation.readyForExecutionApprovalGatePlanning === true &&
  validation.forbiddenDecisionUsed === false &&
  validation.executionApprovalGateCreated !== true &&
  validation.targetSoftwareCommandsExecuted !== true &&
  handoff.kind === "execution_approval_gate_planning_handoff" &&
  handoff.executesNow === false;
const blockers = [];
if (!validationReady) blockers.push("post_run_validation_not_ready_for_execution_approval_gate_planning");
if (!selectedPilotId && !selectedNumber) blockers.push("missing_selected_pilot_or_candidate_number");
if (!adapterId) blockers.push("missing_adapter_id");
if (!pathOrJsonUsable(selector)) blockers.push("missing_or_placeholder_real_local_execution_pilot_selector");
if (!pathOrJsonUsable(queue)) blockers.push("missing_or_placeholder_execution_pilot_queue");
if (route.arg === "--target-window-title") {
  if (!route.value || isPlaceholder(route.value)) blockers.push(route.blocker);
} else if (!reviewedPathUsable(route.value)) {
  blockers.push(route.value && isPlaceholder(route.value) ? `placeholder_${route.blocker}` : route.blocker);
}
if (!explicitTeacherConfirmation(teacherConfirmation)) blockers.push("missing_explicit_teacher_execute_confirmation");
if (!hasFlag("--rollback-point-created")) blockers.push("rollback_point_not_confirmed_for_this_execute_attempt");

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  prepRunnerDoesNotInvokeExecutionRunner: true,
  prepRunnerDoesNotExecuteTargetSoftware: true,
  prepRunnerDoesNotSendUiEvents: true,
  prepRunnerDoesNotCaptureScreenshots: true,
  prepRunnerDoesNotWriteMemory: true,
  approvalGateDoesNotRunRunner: true,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  goalComplete: false
};

let approvalGateInvoked = false;
let approvalGateResult = null;
let approvalGateStatus = "";
let readyForExecuteRequest = false;
if (blockers.length === 0) {
  const gateArgs = [
    "--goal",
    goal,
    "--selector",
    selector,
    "--queue",
    queue,
    "--adapter-id",
    adapterId,
    "--teacher-confirmation",
    teacherConfirmation,
    "--rollback-point-created",
    "--output-dir",
    join(prepDir, "execution-approval-gate")
  ];
  if (selectedPilotId) gateArgs.push("--selected-pilot-id", selectedPilotId);
  else gateArgs.push("--selected-number", selectedNumber);
  gateArgs.push(route.arg, route.value);
  approvalGateInvoked = true;
  const gate = runApprovalGate(gateArgs, process.cwd());
  if (!gate.ok) {
    blockers.push(`approval_gate_failed: ${gate.error}`);
    approvalGateStatus = "approval_gate_failed";
  } else {
    approvalGateResult = gate.result;
    approvalGateStatus = approvalGateResult.status || "";
    readyForExecuteRequest = approvalGateResult.readyForExecuteRequest === true;
    if (!readyForExecuteRequest) {
      for (const blocker of approvalGateResult.blockers || []) blockers.push(`approval_gate_blocker: ${blocker}`);
    }
  }
}

const status =
  blockers.length > 0 && !approvalGateInvoked
    ? "blocked_before_execution_approval_gate"
    : readyForExecuteRequest
      ? "execution_approval_gate_prepared_waiting_for_teacher_execute_review"
      : "execution_approval_gate_prepared_but_blocked";
const packet = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_execution_approval_gate_prep_runner_v1",
  prepId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  postRunValidationStatus: validation.status || "",
  validationReady,
  sourceHandoff: handoff,
  selected: {
    pilotId: selectedPilotId,
    selectedNumber,
    adapterId
  },
  sourceEvidence: {
    postRunValidationPath: validationInput.path,
    providerRoleUsePlanTrace: providerRoleUsePlanTraceFromValidation(validation),
    selectorPath: selector,
    executionPilotQueuePath: queue,
    reviewedCommand: argValue("--reviewed-command", ""),
    reviewedApiRequest: argValue("--reviewed-api-request", ""),
    reviewedMapping: argValue("--reviewed-mapping", ""),
    reviewedBrowserTarget: argValue("--reviewed-browser-target", ""),
    targetWindowTitle: argValue("--target-window-title", ""),
    approvalGateScript: join(__dirname, "create-real-local-execution-approval-gate.mjs")
  },
  approvalGateInvoked,
  approvalGateStatus,
  readyForExecuteRequest,
  generatedEvidence: {
    approvalGatePath: approvalGateResult?.gatePath || "",
    approvalGateReceiptPath: approvalGateResult?.receiptPath || "",
    approvalGateReadmePath: approvalGateResult?.readmePath || "",
    approvalGateResult
  },
  blockers,
  nextTeacherActions: readyForExecuteRequest
    ? [
        "Review the generated real-local execution approval gate packet.",
        "Confirm the generated runner request is still the intended single supervised execute attempt.",
        "Only then decide whether to run a separate approved execution runner request."
      ]
    : [
        "Resolve every blocker before creating or using an approval gate.",
        "Replace placeholders with reviewed selector, queue, route evidence, teacher confirmation, and rollback evidence.",
        "Return to senior compile if the post-run validation no longer matches the intended TLCL route."
      ],
  blockedTransitions: [
    "invoke_execution_runner_from_tlcl_prep_runner",
    "execute_target_software_from_tlcl_prep_runner",
    "send_ui_events_from_tlcl_prep_runner",
    "capture_screenshot_from_tlcl_prep_runner",
    "write_memory_from_tlcl_prep_runner",
    "enable_rule_from_tlcl_prep_runner",
    "unlock_packaging_from_tlcl_prep_runner",
    "claim_completion_from_tlcl_prep_runner"
  ],
  completionBoundary: {
    goalComplete: false,
    reason:
      "This TLCL prep runner only prepares one approval gate packet for one reviewed local execution route. It does not run target software or complete the apprentice capability."
  },
  paths: {},
  locks
};
const paths = writePacket(prepDir, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_medium_runtime_execution_approval_gate_prep_runner_result_v1",
      prepId,
      status,
      validationReady,
      approvalGateInvoked,
      approvalGateStatus,
      readyForExecuteRequest,
      packetPath: paths.packetPath,
      receiptPath: paths.receiptPath,
      readmePath: paths.readmePath,
      approvalGatePath: approvalGateResult?.gatePath || "",
      approvalGateReceiptPath: approvalGateResult?.receiptPath || "",
      approvalGateReadmePath: approvalGateResult?.readmePath || "",
      blockers,
      prepRunnerDoesNotInvokeExecutionRunner: true,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      goalComplete: false,
      locks
    },
    null,
    2
  )
);
