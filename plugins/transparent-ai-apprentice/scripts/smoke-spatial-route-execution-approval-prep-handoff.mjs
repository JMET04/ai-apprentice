#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "spatial-route-execution-approval-prep-handoff", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(name, payload) {
  const path = join(smokeRoot, name);
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return path;
}

const readyRouteBridge = {
  format: "transparent_ai_spatial_software_execution_route_bridge_v1",
  routeId: "smoke-spatial-route",
  status: "spatial_target_bound_to_execution_routes_waiting_for_dry_run_review",
  goal: "Move the teacher-marked 3D depth sketch target inside generic engineering software.",
  software: "generic engineering software",
  selectedTarget: {
    format: "transparent_ai_selected_spatial_execution_target_v1",
    selectedNumber: 2,
    selectedPoint: { x: 0.72, y: 0.41, zHint: 0.38, coordinateSource: "transparent_overlay_depth_target" },
    locks: { accepted: false, ruleEnabled: false, packagingGated: true }
  },
  routeCandidates: [
    {
      adapterId: "existing-windows-ui-automation",
      label: "reviewed target window route",
      score: 84,
      requiredEvidenceBeforeDryRun: ["teacher-confirmed numbered spatial target"],
      blockersBeforeExecute: ["no real execution until approval gate review"]
    }
  ],
  nextExecutionGateHandoff: {
    format: "transparent_ai_spatial_route_to_execution_approval_handoff_v1",
    status: "ready_for_real_local_execution_approval_gate_prep_after_route_review",
    readyForExecutionApprovalGatePrep: true,
    selectedNumber: 2,
    nextGate: "create_real_local_execution_approval_gate",
    prerequisiteGate: "create_real_local_execution_pilot_selector",
    nextGateAfterReadyGate: "create_all_software_execution_approved_gate_command_builder",
    finalRunnerGate: "run_all_software_execution_approved_gate_runner"
  },
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    routeBridgeDoesNotCreateApprovalGate: true,
    routeBridgeDoesNotRunApprovedGateRunner: true,
    routeBridgeDoesNotInvokeAdapter: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  }
};
const readyBridgePath = writeJson("ready-spatial-route-bridge.json", readyRouteBridge);

const blockedBridgePath = writeJson("blocked-spatial-route-bridge.json", {
  ...readyRouteBridge,
  routeId: "blocked-spatial-route",
  nextExecutionGateHandoff: {
    ...readyRouteBridge.nextExecutionGateHandoff,
    readyForExecutionApprovalGatePrep: false,
    status: "blocked_missing_detail_logic_before_execution_approval_gate"
  }
});

const queuePath = writeJson("execution-pilot-queue.json", {
  format: "transparent_ai_all_software_execution_pilot_queue_v1",
  queueId: "smoke-queue",
  pilots: [
    {
      pilotId: "pilot-001",
      software: "generic engineering software",
      routeMode: "teacher_reviewed_window_ui",
      primaryAdapterId: "existing-windows-ui-automation",
      status: "dry_run_reviewed"
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    softwareActionsExecuted: false
  }
});

const selectorPath = writeJson("pilot-selector.json", {
  format: "transparent_ai_real_local_execution_pilot_selector_v1",
  selectorId: "smoke-selector",
  numberedCandidates: [
    {
      number: 1,
      pilotId: "pilot-001",
      software: "generic engineering software",
      routeMode: "teacher_reviewed_window_ui",
      primaryAdapterId: "existing-windows-ui-automation"
    }
  ],
  selectedCandidate: {
    number: 1,
    pilotId: "pilot-001",
    software: "generic engineering software",
    routeMode: "teacher_reviewed_window_ui",
    primaryAdapterId: "existing-windows-ui-automation"
  },
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    softwareActionsExecuted: false
  }
});

const unselectedSelectorPath = writeJson("pilot-selector-unselected.json", {
  format: "transparent_ai_real_local_execution_pilot_selector_v1",
  selectorId: "smoke-selector-unselected",
  numberedCandidates: [
    {
      number: 1,
      pilotId: "pilot-001",
      software: "generic engineering software",
      routeMode: "teacher_reviewed_window_ui",
      primaryAdapterId: "existing-windows-ui-automation"
    }
  ],
  selectedCandidate: null,
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    softwareActionsExecuted: false
  }
});

const rollbackPath = join(smokeRoot, "retained-rollback-point");
mkdirSync(rollbackPath, { recursive: true });
const spatialEvidenceValidationPath = writeJson("spatial-evidence-validation.json", {
  format: "transparent_ai_spatial_intent_evidence_receipt_validation_v1",
  status: "ready_for_numbered_spatial_target_confirmation",
  has2D: true,
  hasPerspective: true,
  has3DDepth: true,
  detailLogicReady: true,
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true
});

const blocked = runNode("create-spatial-route-execution-approval-prep-handoff.mjs", [
  "--route-bridge",
  blockedBridgePath,
  "--queue",
  queuePath,
  "--output-dir",
  join(smokeRoot, "blocked")
]);
const blockedPacket = readJson(blocked.packetPath);

const waiting = runNode("create-spatial-route-execution-approval-prep-handoff.mjs", [
  "--route-bridge",
  readyBridgePath,
  "--queue",
  queuePath,
  "--output-dir",
  join(smokeRoot, "waiting")
]);
const waitingPacket = readJson(waiting.packetPath);

const unselected = runNode("create-spatial-route-execution-approval-prep-handoff.mjs", [
  "--route-bridge",
  readyBridgePath,
  "--selector",
  unselectedSelectorPath,
  "--queue",
  queuePath,
  "--output-dir",
  join(smokeRoot, "unselected")
]);
const unselectedPacket = readJson(unselected.packetPath);

const missingSpatialEvidence = runNode("create-spatial-route-execution-approval-prep-handoff.mjs", [
  "--route-bridge",
  readyBridgePath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-number",
  "1",
  "--adapter-id",
  "existing-windows-ui-automation",
  "--target-window-title",
  "Transparent AI Apprentice Smoke Target",
  "--teacher-confirmation",
  "teacher confirmed all-software execution pilot",
  "--rollback-point",
  rollbackPath,
  "--output-dir",
  join(smokeRoot, "missing-spatial-evidence")
]);
const missingSpatialEvidencePacket = readJson(missingSpatialEvidence.packetPath);
const missingSpatialApprovalCommand = missingSpatialEvidencePacket.nextCommands.find(
  (command) => command.tool === "create_real_local_execution_approval_gate"
);

const ready = runNode("create-spatial-route-execution-approval-prep-handoff.mjs", [
  "--route-bridge",
  readyBridgePath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-number",
  "1",
  "--adapter-id",
  "existing-windows-ui-automation",
  "--target-window-title",
  "Transparent AI Apprentice Smoke Target",
  "--spatial-evidence-validation",
  spatialEvidenceValidationPath,
  "--spatial-readiness-confirmed",
  "--teacher-confirmation",
  "teacher confirmed all-software execution pilot",
  "--rollback-point",
  rollbackPath,
  "--output-dir",
  join(smokeRoot, "ready")
]);
const readyPacket = readJson(ready.packetPath);
const readyReceipt = readJson(ready.receiptPath);

const approvalCommand = readyPacket.nextCommands.find((command) => command.tool === "create_real_local_execution_approval_gate");
const waitingApprovalCommand = waitingPacket.nextCommands.find((command) => command.tool === "create_real_local_execution_approval_gate");
const unselectedApprovalCommand = unselectedPacket.nextCommands.find((command) => command.tool === "create_real_local_execution_approval_gate");
const selectorCommand = waitingPacket.nextCommands.find((command) => command.tool === "create_real_local_execution_pilot_selector");
const prepRunnerCommand = readyPacket.nextCommands.find((command) => command.tool === "run_all_software_execution_approval_gate_prep_runner");

const checks = [
  {
    name: "Spatial route approval prep handoff blocks when the spatial route handoff is not ready",
    pass:
      blocked.status === "blocked_before_spatial_route_review" &&
      blockedPacket.blockers.includes("spatial_route_not_ready_for_execution_approval_gate_prep") &&
      blockedReceiptLocks(blockedPacket),
    evidence: blocked.blockers.join(",")
  },
  {
    name: "Spatial route approval prep handoff waits for pilot selector before approval gate",
    pass:
      waiting.status === "waiting_for_real_local_pilot_selector" &&
      selectorCommand?.ready === true &&
      selectorCommand?.command.includes("create-real-local-execution-pilot-selector.mjs") &&
      waitingPacket.selected.spatialSelectedNumber === 2 &&
      waitingPacket.selected.selectedPilotNumber === 0 &&
      !waitingApprovalCommand?.command.includes("--selected-number 2") &&
      waitingPacket.readiness.canRunPilotSelectorCommandAfterTeacherReview === true &&
      waitingPacket.readiness.canCreateApprovalGateAfterTeacherReview === false,
    evidence: selectorCommand?.command || ""
  },
  {
    name: "Spatial route approval prep handoff refuses to auto-select the first pilot candidate",
    pass:
      unselected.status === "waiting_for_teacher_approval_gate_inputs" &&
      unselectedPacket.blockers.includes("missing_teacher_selected_pilot") &&
      unselectedPacket.selected.spatialSelectedNumber === 2 &&
      unselectedPacket.selected.selectedPilotNumber === 0 &&
      unselectedPacket.selected.selectedPilotId === "" &&
      unselectedPacket.selected.adapterId === "" &&
      unselectedPacket.readiness.canCreateApprovalGateAfterTeacherReview === false &&
      unselectedApprovalCommand?.ready === false &&
      !unselectedApprovalCommand?.command.includes("--selected-number 1") &&
      !unselectedApprovalCommand?.command.includes("--selected-pilot-id pilot-001"),
    evidence: unselectedPacket.blockers.join(",")
  },
  {
    name: "Spatial route approval prep handoff blocks approval gate without teacher-reviewed 2D/perspective/3D spatial evidence",
    pass:
      missingSpatialEvidence.status === "waiting_for_teacher_approval_gate_inputs" &&
      missingSpatialEvidencePacket.blockers.includes("missing_teacher_reviewed_2d_perspective_3d_spatial_evidence") &&
      missingSpatialEvidencePacket.readiness.spatialEvidenceReviewReady === false &&
      missingSpatialApprovalCommand?.ready === false,
    evidence: missingSpatialEvidencePacket.blockers.join(",")
  },
  {
    name: "Spatial route approval prep handoff produces approval gate command only after selector, queue, spatial evidence, route evidence, rollback, and teacher confirmation",
    pass:
      ready.status === "approval_gate_command_ready_for_teacher_review" &&
      readyPacket.readiness.canCreateApprovalGateAfterTeacherReview === true &&
      readyPacket.readiness.spatialEvidenceReviewReady === true &&
      approvalCommand?.ready === true &&
      approvalCommand.command.includes("create-real-local-execution-approval-gate.mjs") &&
      approvalCommand.command.includes("--rollback-point-created") &&
      readyPacket.selected.teacherConfirmationMatched === true &&
      readyPacket.selected.rollbackPointCreated === true,
    evidence: approvalCommand?.command || ""
  },
  {
    name: "Spatial handoff never runs prep runner, approved runner, adapter, screenshots, memory, or completion",
    pass:
      prepRunnerCommand?.ready === false &&
      prepRunnerCommand?.blocker.includes("spatial_route_bridge_is_not") &&
      readyReceipt.handoffDoesNotCreateApprovalGate === true &&
      readyReceipt.handoffDoesNotRunApprovalGatePrepRunner === true &&
      readyReceipt.handoffDoesNotRunApprovedGateRunner === true &&
      readyReceipt.handoffDoesNotInvokeAdapter === true &&
      readyReceipt.softwareActionsExecuted === false &&
      readyReceipt.targetSoftwareCommandsExecuted === false &&
      readyReceipt.screenshotsCaptured === false &&
      readyReceipt.memoryWritten === false &&
      readyReceipt.goalComplete === false,
    evidence: ready.receiptPath
  }
];

function blockedReceiptLocks(packet) {
  return (
    packet.locks.handoffDoesNotRunSelector === true &&
    packet.locks.handoffDoesNotCreateApprovalGate === true &&
    packet.locks.handoffDoesNotRunApprovedGateRunner === true &&
    packet.locks.handoffDoesNotInvokeAdapter === true &&
    packet.locks.goalComplete === false
  );
}

const failed = checks.filter((check) => !check.pass);
const result = {
  ok: failed.length === 0,
  format: "transparent_ai_spatial_route_execution_approval_prep_handoff_smoke_v1",
  smokeRoot,
  checks,
  packets: {
    blocked: blocked.packetPath,
    waiting: waiting.packetPath,
    missingSpatialEvidence: missingSpatialEvidence.packetPath,
    ready: ready.packetPath,
    readyReceipt: ready.receiptPath
  }
};

if (failed.length) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
