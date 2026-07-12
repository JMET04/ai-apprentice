#!/usr/bin/env node
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
    String(value || "spatial-route-execution-approval-prep-handoff")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "spatial-route-execution-approval-prep-handoff"
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
  if (optional) return { value: { reference: text }, path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function maybePath(input) {
  const text = String(input || "").trim();
  if (!text) return "";
  return existsSync(text) ? resolve(text) : text;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    teacherConfirmationRequired: true,
    selectorRequiredBeforeApprovalGate: true,
    dryRunEvidenceRequiredBeforeExecute: true,
    handoffDoesNotRunSelector: true,
    handoffDoesNotCreateApprovalGate: true,
    handoffDoesNotRunApprovalGatePrepRunner: true,
    handoffDoesNotRunApprovedGateRunner: true,
    handoffDoesNotInvokeAdapter: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    outcomeAccepted: false,
    goalComplete: false,
    privateChainOfThoughtExposed: false
  };
}

function findSelectedCandidate(selector, selectedNumber, selectedPilotId) {
  const candidates = Array.isArray(selector?.numberedCandidates) ? selector.numberedCandidates : [];
  if (selectedPilotId) return candidates.find((candidate) => candidate.pilotId === selectedPilotId) || null;
  if (selectedNumber) return candidates.find((candidate) => Number(candidate.number) === Number(selectedNumber)) || null;
  return selector?.selectedCandidate || null;
}

function reviewedEvidenceArg(adapterId) {
  if (adapterId === "existing-cli-or-script") return { arg: "--reviewed-command", value: argValue("--reviewed-command", "") };
  if (adapterId === "existing-application-api") return { arg: "--reviewed-api-request", value: argValue("--reviewed-api-request", "") };
  if (adapterId === "existing-file-import-export") return { arg: "--reviewed-mapping", value: argValue("--reviewed-mapping", "") };
  if (adapterId === "existing-browser-automation") return { arg: "--reviewed-browser-target", value: argValue("--reviewed-browser-target", "") };
  return { arg: "--target-window-title", value: argValue("--target-window-title", "") };
}

function explicitTeacherConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed all-software execution pilot",
    "teacher confirmed execution pilot",
    "approve controlled execution pilot",
    "allow controlled execution pilot",
    "i confirm all-software execution pilot",
    "i approve controlled execution pilot",
    "确认执行试点",
    "允许受控执行试点",
    "确认全软件执行试点"
  ].some((marker) => text.includes(marker.toLowerCase()));
}

function commandText(scriptName, args) {
  const parts = ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args];
  return parts
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map((part) => {
      const text = String(part);
      return /\s|["]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
    })
    .join(" ");
}

function selectorCommand({ queuePath, goal, outputDir }) {
  const args = ["--goal", goal];
  if (queuePath) {
    args.push("--queue", queuePath);
  } else {
    args.push(
      "--max-processes",
      "8",
      "--max-installed",
      "8",
      "--max-software",
      "8",
      "--max-pilots",
      "3",
      "--max-candidates",
      "6",
      "--max-log-files-per-candidate",
      "1"
    );
  }
  args.push("--output-dir", outputDir);
  return {
    tool: "create_real_local_execution_pilot_selector",
    script: "create-real-local-execution-pilot-selector.mjs",
    ready: true,
    command: commandText("create-real-local-execution-pilot-selector.mjs", args),
    blocker: "",
    mode: queuePath ? "from_existing_pilot_queue" : "bounded_read_only_readiness_then_selector"
  };
}

function approvalGateCommand({
  selectorPath,
  queuePath,
  selectedNumber,
  selectedPilotId,
  adapterId,
  teacherConfirmation,
  rollbackReady,
  evidence,
  spatialEvidenceReviewReady,
  outputDir,
  goal
}) {
  const args = ["--selector", selectorPath || "<transparent_ai_real_local_execution_pilot_selector_v1 path>"];
  if (queuePath) args.push("--queue", queuePath);
  if (selectedPilotId) args.push("--selected-pilot-id", selectedPilotId);
  else if (selectedNumber) args.push("--selected-number", String(selectedNumber));
  if (adapterId) args.push("--adapter-id", adapterId);
  if (evidence.value) args.push(evidence.arg, evidence.value);
  if (teacherConfirmation) args.push("--teacher-confirmation", teacherConfirmation);
  if (rollbackReady) args.push("--rollback-point-created");
  args.push("--goal", goal, "--output-dir", outputDir);
  return {
    tool: "create_real_local_execution_approval_gate",
    script: "create-real-local-execution-approval-gate.mjs",
    ready: Boolean(
      selectorPath &&
        queuePath &&
        (selectedPilotId || selectedNumber) &&
        adapterId &&
        evidence.value &&
        spatialEvidenceReviewReady &&
        teacherConfirmation &&
        rollbackReady
    ),
    command: commandText("create-real-local-execution-approval-gate.mjs", args)
  };
}

function prepRunnerCommand({ validationPath, selectorPath, queuePath, selectedNumber, selectedPilotId, adapterId, teacherConfirmation, rollbackReady, evidence, outputDir, goal }) {
  const args = ["--validation", validationPath || "<transparent_ai_all_software_execution_follow_up_handoff_item_receipt_validation_v1 path>"];
  if (selectorPath) args.push("--selector", selectorPath);
  if (queuePath) args.push("--queue", queuePath);
  if (selectedPilotId) args.push("--selected-pilot-id", selectedPilotId);
  else if (selectedNumber) args.push("--selected-number", String(selectedNumber));
  if (adapterId) args.push("--adapter-id", adapterId);
  if (evidence.value) args.push(evidence.arg, evidence.value);
  if (teacherConfirmation) args.push("--teacher-confirmation", teacherConfirmation);
  if (rollbackReady) args.push("--rollback-point-created");
  args.push("--goal", goal, "--output-dir", outputDir);
  return {
    tool: "run_all_software_execution_approval_gate_prep_runner",
    script: "run-all-software-execution-approval-gate-prep-runner.mjs",
    ready: false,
    command: commandText("run-all-software-execution-approval-gate-prep-runner.mjs", args),
    blocker:
      "spatial_route_bridge_is_not_a_transparent_ai_all_software_execution_follow_up_handoff_item_receipt_validation_v1"
  };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function writeHtml(path, packet) {
  const rows = packet.blockers.map((blocker) => `<li>${htmlEscape(blocker)}</li>`).join("") || "<li>none</li>";
  const commands = packet.nextCommands
    .map(
      (command) =>
        `<section><h2>${htmlEscape(command.tool)}</h2><p>Ready: ${command.ready ? "yes" : "no"}</p><pre>${htmlEscape(command.command)}</pre><p>${htmlEscape(command.blocker || "")}</p></section>`
    )
    .join("");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Spatial Route Execution Approval Prep Handoff</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #1f2937; line-height: 1.5; }
    h1 { font-size: 24px; }
    h2 { font-size: 18px; margin-top: 24px; }
    pre { background: #f3f4f6; border: 1px solid #d1d5db; padding: 12px; overflow: auto; }
    .lock { color: #7c2d12; font-weight: 700; }
  </style>
</head>
<body>
  <h1>Spatial Route Execution Approval Prep Handoff</h1>
  <p>Status: <strong>${htmlEscape(packet.status)}</strong></p>
  <p>Goal: ${htmlEscape(packet.goal)}</p>
  <p class="lock">Review-only: this handoff does not run selector, create approval gate, invoke adapters, capture screenshots, write memory, or claim completion.</p>
  <h2>Blockers</h2>
  <ul>${rows}</ul>
  <h2>Next Commands</h2>
  ${commands}
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, packet) {
  const lines = [
    "# Spatial Route Execution Approval Prep Handoff",
    "",
    `Status: ${packet.status}`,
    `Goal: ${packet.goal}`,
    "",
    "This handoff bridges a teacher-confirmed transparent sketch spatial route into the existing real-local pilot selector and approval gate review path.",
    "",
    "Review order:",
    "1. Confirm the spatial route bridge selected exactly one numbered 2D/perspective/3D target and has detail logic ready.",
    "2. Confirm a teacher-reviewed spatial evidence validation or review note preserves 2D position, perspective relation, 3D depth, and detail logic.",
    "3. Run the real-local pilot selector if no selector packet has been reviewed.",
    "4. Select one pilot/adapter and provide exact reviewed route evidence plus a retained rollback point.",
    "5. Create the real-local execution approval gate for teacher review.",
    "6. Only after that separate gate is ready may an approved-gate runner be prepared.",
    "",
    "Blocked transitions:"
  ];
  for (const blocked of packet.blockedTransitions) lines.push(`- ${blocked}`);
  lines.push("", "Next commands:");
  for (const command of packet.nextCommands) {
    lines.push("", `## ${command.tool}`, `Ready: ${command.ready ? "yes" : "no"}`, command.command);
    if (command.blocker) lines.push(`Blocker: ${command.blocker}`);
  }
  lines.push(
    "",
    "Locked boundary: accepted=false, ruleEnabled=false, packagingGated=true, softwareActionsExecuted=false, targetSoftwareCommandsExecuted=false, screenshotsCaptured=false, memoryWritten=false, nativeUniversalExecution=false, goalComplete=false."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  argValue("--task", "Prepare a teacher-reviewed approval handoff from a transparent sketch spatial route.")
);
const routeBridgeInput = readJsonInput(argValue("--route-bridge", argValue("--spatial-route-bridge", "")), "--route-bridge");
const selectorInput = readJsonInput(argValue("--selector", argValue("--selector-path", "")), "--selector", true);
const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue", true);
const validationInput = readJsonInput(argValue("--validation", argValue("--receipt-validation", "")), "--validation", true);
const selectedNumberArg = argValue("--selected-number", argValue("--number", ""));
const selectedPilotIdArg = argValue("--selected-pilot-id", argValue("--pilot-id", ""));
const adapterIdArg = argValue("--adapter-id", "");
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--confirmation", ""));
const rollbackPoint = maybePath(argValue("--rollback-point", ""));
const rollbackReady = hasFlag("--rollback-point-created") || Boolean(rollbackPoint);
const spatialEvidenceValidationPath = maybePath(
  argValue("--spatial-evidence-validation", argValue("--spatial-intent-evidence-receipt-validation", ""))
);
const spatialEvidenceReviewNote = argValue("--spatial-evidence-review-note", "");
const spatialReadinessConfirmed =
  hasFlag("--spatial-readiness-confirmed") || hasFlag("--teacher-reviewed-spatial-evidence");
const spatialEvidenceReviewReady = spatialReadinessConfirmed && Boolean(spatialEvidenceValidationPath || spatialEvidenceReviewNote);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "spatial-route-execution-approval-prep-handoffs"))
);

const bridge = routeBridgeInput.value;
const handoff = bridge?.nextExecutionGateHandoff || {};
const selector = selectorInput.value;
const queue = queueInput.value;
const spatialSelectedNumber = handoff.selectedNumber || bridge?.selectedTarget?.selectedNumber || 0;
const selectedPilotNumber = selectedNumberArg || selector?.selectedCandidate?.number || "";
const selectedCandidate = selector ? findSelectedCandidate(selector, selectedPilotNumber, selectedPilotIdArg) : null;
const selectedPilotId = selectedPilotIdArg || selectedCandidate?.pilotId || "";
const adapterId =
  adapterIdArg ||
  selectedCandidate?.primaryAdapterId ||
  selectedCandidate?.adapterId ||
  (!selector ? bridge?.routeCandidates?.[0]?.adapterId : "") ||
  "";
const evidence = reviewedEvidenceArg(adapterId);
const evidenceReady = Boolean(evidence.value);
const teacherConfirmationMatched = explicitTeacherConfirmation(teacherConfirmation);
const routeHandoffReady =
  bridge?.format === "transparent_ai_spatial_software_execution_route_bridge_v1" &&
  handoff?.format === "transparent_ai_spatial_route_to_execution_approval_handoff_v1" &&
  handoff.readyForExecutionApprovalGatePrep === true;

const blockers = [];
if (bridge?.format !== "transparent_ai_spatial_software_execution_route_bridge_v1") {
  blockers.push("route_bridge_must_be_transparent_ai_spatial_software_execution_route_bridge_v1");
}
if (handoff?.format !== "transparent_ai_spatial_route_to_execution_approval_handoff_v1") {
  blockers.push("missing_transparent_ai_spatial_route_to_execution_approval_handoff_v1");
}
if (handoff.readyForExecutionApprovalGatePrep !== true) blockers.push("spatial_route_not_ready_for_execution_approval_gate_prep");
if (!selectorInput.path && !selector) blockers.push("waiting_for_real_local_pilot_selector");
if (selector && !queueInput.path && !queue) blockers.push("missing_real_local_execution_pilot_queue");
if (selector && !selectedPilotId && !selectedPilotNumber) blockers.push("missing_teacher_selected_pilot");
if (selector && !adapterId) blockers.push("missing_adapter_id_for_selected_pilot");
if (selector && !evidenceReady) blockers.push(evidence.arg === "--target-window-title" ? "missing_target_window_title" : `missing_${evidence.arg.replace(/^--/, "").replace(/-/g, "_")}`);
if (selector && !spatialEvidenceReviewReady) blockers.push("missing_teacher_reviewed_2d_perspective_3d_spatial_evidence");
if (selector && !teacherConfirmationMatched) blockers.push("missing_explicit_teacher_execute_confirmation");
if (selector && !rollbackReady) blockers.push("rollback_point_not_confirmed_for_this_execute_attempt");

const approvalInputsReady =
  routeHandoffReady &&
  Boolean(selector) &&
  Boolean(queue) &&
  Boolean(selectedPilotId || selectedPilotNumber) &&
  Boolean(adapterId) &&
  evidenceReady &&
  spatialEvidenceReviewReady &&
  teacherConfirmationMatched &&
  rollbackReady;

const status = !routeHandoffReady
  ? "blocked_before_spatial_route_review"
  : !selector
    ? "waiting_for_real_local_pilot_selector"
    : approvalInputsReady
      ? "approval_gate_command_ready_for_teacher_review"
      : "waiting_for_teacher_approval_gate_inputs";

mkdirSync(outputRoot, { recursive: true });
const handoffId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const handoffDir = join(outputRoot, handoffId);
mkdirSync(handoffDir, { recursive: true });

const packetPath = join(handoffDir, "spatial-route-execution-approval-prep-handoff.json");
const receiptPath = join(handoffDir, "spatial-route-execution-approval-prep-handoff-receipt.json");
const htmlPath = join(handoffDir, "spatial-route-execution-approval-prep-handoff.html");
const readmePath = join(handoffDir, "SPATIAL_ROUTE_EXECUTION_APPROVAL_PREP_HANDOFF_START_HERE.md");

const commandOutputDir = join(handoffDir, "next-gate-output");
const nextCommands = [
  selectorCommand({
    queuePath: queueInput.path,
    goal,
    outputDir: join(commandOutputDir, "pilot-selector")
  }),
  approvalGateCommand({
    selectorPath: selectorInput.path,
    queuePath: queueInput.path,
    selectedNumber: selectedPilotNumber,
    selectedPilotId,
    adapterId,
    teacherConfirmation,
    rollbackReady,
    evidence,
    spatialEvidenceReviewReady,
    outputDir: join(commandOutputDir, "approval-gate"),
    goal
  }),
  prepRunnerCommand({
    validationPath: validationInput.path,
    selectorPath: selectorInput.path,
    queuePath: queueInput.path,
    selectedNumber: selectedPilotNumber,
    selectedPilotId,
    adapterId,
    teacherConfirmation,
    rollbackReady,
    evidence,
    outputDir: join(commandOutputDir, "prep-runner"),
    goal
  })
];
const pilotSelectorCommandReady = nextCommands.find((command) => command.tool === "create_real_local_execution_pilot_selector")?.ready === true;

const packet = {
  format: "transparent_ai_spatial_route_execution_approval_prep_handoff_v1",
  handoffId,
  createdAt: new Date().toISOString(),
  status,
  goal,
  source: {
    routeBridgePath: routeBridgeInput.path,
    routeBridgeFormat: bridge?.format || "",
    sourceHandoffFormat: handoff?.format || "",
    routeHandoffReady,
    selectorPath: selectorInput.path,
    selectorFormat: selector?.format || "",
    queuePath: queueInput.path,
    queueFormat: queue?.format || "",
    validationPath: validationInput.path,
    validationFormat: validationInput.value?.format || "",
    spatialEvidenceValidationPath,
    spatialEvidenceReviewNote,
    spatialReadinessConfirmed
  },
  selected: {
    spatialSelectedNumber: spatialSelectedNumber ? Number(spatialSelectedNumber) : 0,
    selectedPilotNumber: selectedPilotNumber ? Number(selectedPilotNumber) : 0,
    selectedPilotId,
    adapterId,
    software: selectedCandidate?.software || bridge.software || "",
    reviewedEvidenceArg: evidence.arg,
    reviewedEvidenceValue: evidence.value || "",
    spatialEvidenceReviewReady,
    spatialEvidenceValidationPath,
    spatialEvidenceReviewNote,
    teacherConfirmationMatched,
    rollbackPointPath: rollbackPoint,
    rollbackPointCreated: rollbackReady
  },
  readiness: {
    approvalInputsReady,
    spatialEvidenceReviewReady,
    canRunPilotSelectorCommandAfterTeacherReview: routeHandoffReady && pilotSelectorCommandReady,
    canCreateApprovalGateAfterTeacherReview: approvalInputsReady,
    canRunApprovalGatePrepRunnerFromThisHandoff: false,
    reasonPrepRunnerBlocked:
      "run_all_software_execution_approval_gate_prep_runner requires transparent_ai_all_software_execution_follow_up_handoff_item_receipt_validation_v1; this packet starts from a spatial route bridge."
  },
  blockers,
  nextCommands,
  blockedTransitions: [
    "skip_real_local_execution_pilot_selector",
    "create_real_local_execution_approval_gate_without_teacher_reviewed_selector",
    "run_all_software_execution_approval_gate_prep_runner_from_spatial_handoff_without_follow_up_validation",
    "run_all_software_execution_approved_gate_runner_from_spatial_handoff",
    "execute_target_software_from_spatial_handoff",
    "invoke_adapter_or_send_ui_events_from_spatial_handoff",
    "capture_screenshot_before_teacher_confirmed_visual_check",
    "write_memory_before_post_action_checkpoint",
    "enable_rule_or_unlock_packaging_from_spatial_handoff",
    "claim_goal_complete_from_spatial_handoff"
  ],
  locks: locks(),
  paths: {
    packet: packetPath,
    receipt: receiptPath,
    html: htmlPath,
    readme: readmePath
  }
};

const receipt = {
  ok: true,
  format: "transparent_ai_spatial_route_execution_approval_prep_handoff_receipt_v1",
  handoffId,
  status,
  approvalInputsReady,
  routeHandoffReady,
  blockers,
  nextGate: approvalInputsReady ? "create_real_local_execution_approval_gate" : "create_real_local_execution_pilot_selector",
  handoffDoesNotRunSelector: true,
  handoffDoesNotCreateApprovalGate: true,
  handoffDoesNotRunApprovalGatePrepRunner: true,
  handoffDoesNotRunApprovedGateRunner: true,
  handoffDoesNotInvokeAdapter: true,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  goalComplete: false,
  paths: packet.paths
};

writeReadme(readmePath, packet);
writeHtml(htmlPath, packet);
writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_route_execution_approval_prep_handoff_result_v1",
      status,
      handoffId,
      packetPath,
      receiptPath,
      htmlPath,
      readmePath,
      approvalInputsReady,
      blockers,
      locks: packet.locks
    },
    null,
    2
  )
);
