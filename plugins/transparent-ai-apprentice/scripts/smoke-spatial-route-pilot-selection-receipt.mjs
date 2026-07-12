#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "spatial-route-pilot-selection-receipt", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function writeJson(name, value) {
  const path = join(smokeRoot, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function runNode(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

const routeBridgePath = writeJson("route-bridge.json", {
  format: "transparent_ai_spatial_software_execution_route_bridge_v1",
  selectedTarget: { selectedNumber: 2 },
  locks: { accepted: false, ruleEnabled: false, packagingGated: true }
});
const queuePath = writeJson("pilot-queue.json", {
  format: "transparent_ai_all_software_execution_pilot_queue_v1",
  pilots: [],
  locks: { accepted: false, ruleEnabled: false, packagingGated: true }
});
const selectorPath = writeJson("selector.json", {
  format: "transparent_ai_real_local_execution_pilot_selector_v1",
  numberedCandidates: [
    {
      number: 1,
      pilotId: "pilot-api",
      software: "API App",
      primaryAdapterId: "existing-application-api",
      routeMode: "structured_route_dry_run_pilot"
    },
    {
      number: 2,
      pilotId: "pilot-ui",
      software: "UI App",
      primaryAdapterId: "existing-windows-ui-automation",
      routeMode: "supervised_ui_fallback_dry_run_pilot"
    }
  ],
  selectedCandidate: null,
  locks: { accepted: false, ruleEnabled: false, packagingGated: true }
});
const prepPath = writeJson("prep-handoff.json", {
  format: "transparent_ai_spatial_route_execution_approval_prep_handoff_v1",
  status: "waiting_for_teacher_approval_gate_inputs",
  goal: "Smoke spatial route pilot selection.",
  source: {
    routeBridgePath,
    selectorPath,
    queuePath,
    routeHandoffReady: true
  },
  selected: {
    spatialSelectedNumber: 2,
    selectedPilotNumber: 0,
    selectedPilotId: "",
    adapterId: ""
  },
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false
  }
});

const templateResult = runNode("create-spatial-route-pilot-selection-receipt.mjs", [
  "--prep-handoff",
  prepPath,
  "--output-dir",
  join(smokeRoot, "template")
]);
const templatePacket = readJson(templateResult.packetPath);
const templateReceipt = readJson(templateResult.receiptTemplatePath);
const spatialEvidenceReview = {
  teacherReviewedSpatialEvidence: true,
  spatialEvidenceValidationPath: "teacher-reviewed-spatial-intent-evidence-receipt-validation.json",
  confirmed2DPosition: true,
  confirmedPerspectiveRelation: true,
  confirmed3DDepthRelation: true,
  confirmedDetailLogicReady: true
};

const selectedReceiptPath = writeJson("selected-receipt.json", {
  ...templateReceipt,
  decision: "selected_for_approval_prep",
  teacherReviewedNumberedCandidates: true,
  selectedPilotNumber: 1,
  selectedPilotId: "pilot-api",
  selectedSoftware: "API App",
  teacherSelectionReason: "Use the structured API route first.",
  ...spatialEvidenceReview,
  noExecutionBoundaryReviewed: true,
  confirmBuilderDidNotRunApprovalGate: true,
  confirmNoSoftwareExecution: true
});
const selectedResult = runNode("create-spatial-route-pilot-selection-receipt.mjs", [
  "--prep-handoff",
  prepPath,
  "--receipt",
  selectedReceiptPath,
  "--output-dir",
  join(smokeRoot, "selected")
]);
const selectedPacket = readJson(selectedResult.packetPath);

const missingSpatialEvidenceReceiptPath = writeJson("missing-spatial-evidence-receipt.json", {
  ...templateReceipt,
  decision: "selected_for_approval_prep",
  teacherReviewedNumberedCandidates: true,
  selectedPilotNumber: 1,
  selectedPilotId: "pilot-api",
  selectedSoftware: "API App",
  noExecutionBoundaryReviewed: true,
  confirmBuilderDidNotRunApprovalGate: true,
  confirmNoSoftwareExecution: true
});
const missingSpatialEvidenceResult = runNode("create-spatial-route-pilot-selection-receipt.mjs", [
  "--prep-handoff",
  prepPath,
  "--receipt",
  missingSpatialEvidenceReceiptPath,
  "--output-dir",
  join(smokeRoot, "missing-spatial-evidence")
]);

const fullReceiptPath = writeJson("full-receipt.json", {
  ...templateReceipt,
  decision: "selected_for_approval_prep",
  teacherReviewedNumberedCandidates: true,
  selectedPilotNumber: 1,
  selectedPilotId: "pilot-api",
  selectedSoftware: "API App",
  ...spatialEvidenceReview,
  reviewedEvidenceKind: "reviewed_api_request",
  reviewedEvidenceValue: "{\"method\":\"POST\",\"path\":\"/dry-run\"}",
  explicitTeacherConfirmation: "teacher confirmed all-software execution pilot",
  rollbackPointPath: join(smokeRoot, "rollback-point"),
  rollbackPointCreated: true,
  noExecutionBoundaryReviewed: true,
  confirmBuilderDidNotRunApprovalGate: true,
  confirmNoSoftwareExecution: true
});
mkdirSync(join(smokeRoot, "rollback-point"), { recursive: true });
const fullResult = runNode("create-spatial-route-pilot-selection-receipt.mjs", [
  "--prep-handoff",
  prepPath,
  "--receipt",
  fullReceiptPath,
  "--output-dir",
  join(smokeRoot, "full")
]);
const fullPacket = readJson(fullResult.packetPath);

const forbiddenReceiptPath = writeJson("forbidden-receipt.json", {
  ...templateReceipt,
  decision: "selected_for_approval_prep",
  teacherReviewedNumberedCandidates: true,
  selectedPilotNumber: 1,
  selectedPilotId: "pilot-api",
  noExecutionBoundaryReviewed: true,
  confirmBuilderDidNotRunApprovalGate: true,
  confirmNoSoftwareExecution: true,
  executeNow: true
});
const forbiddenResult = runNode("create-spatial-route-pilot-selection-receipt.mjs", [
  "--prep-handoff",
  prepPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden")
]);

const checks = [
  {
    name: "Spatial route pilot selection receipt builds a teacher choice template",
    pass:
      templateResult.status === "waiting_for_teacher_pilot_selection_receipt" &&
      templatePacket.format === "transparent_ai_spatial_route_pilot_selection_receipt_package_v1" &&
      templatePacket.spatialSelectedNumber === 2 &&
      templatePacket.numberedCandidates.length === 2 &&
      templateReceipt.format === "transparent_ai_spatial_route_pilot_selection_review_receipt_v1" &&
      templateReceipt.decision === "needs_teacher_review" &&
      templatePacket.locks.softwareActionsExecuted === false,
    evidence: templateResult.packetPath
  },
  {
    name: "Spatial route pilot selection receipt validates one explicit pilot without auto-selecting",
    pass:
      selectedResult.status === "teacher_pilot_selection_validated_for_approval_prep_handoff" &&
      selectedResult.selectedPilotNumber === 1 &&
      selectedResult.spatialEvidenceReviewReady === true &&
      selectedPacket.selectedCandidate.pilotId === "pilot-api" &&
      selectedPacket.validation.approvalInputsReady === false &&
      selectedPacket.validation.spatialEvidenceReviewReady === true &&
      selectedPacket.nextCommands[0].ready === true &&
      selectedPacket.nextCommands[0].command.includes("--selected-number 1") &&
      selectedPacket.nextCommands[0].command.includes("--spatial-evidence-validation") &&
      selectedPacket.nextCommands[0].command.includes("--spatial-readiness-confirmed") &&
      !selectedPacket.nextCommands[0].command.includes("--selected-number 2"),
    evidence: selectedPacket.nextCommands[0].command
  },
  {
    name: "Spatial route pilot selection receipt blocks approval-prep before teacher-reviewed 2D/perspective/3D spatial evidence",
    pass:
      missingSpatialEvidenceResult.status === "blocked_invalid_teacher_pilot_selection_receipt" &&
      missingSpatialEvidenceResult.nextCommandReady === false &&
      missingSpatialEvidenceResult.blockers.includes("teacher_reviewed_spatial_evidence_required") &&
      missingSpatialEvidenceResult.blockers.includes("confirmed_2d_position_required") &&
      missingSpatialEvidenceResult.blockers.includes("confirmed_perspective_relation_required") &&
      missingSpatialEvidenceResult.blockers.includes("confirmed_3d_depth_relation_required") &&
      missingSpatialEvidenceResult.blockers.includes("confirmed_detail_logic_ready_required"),
    evidence: missingSpatialEvidenceResult.blockers.join(",")
  },
  {
    name: "Spatial route pilot selection receipt can carry exact route evidence toward approval-prep",
    pass:
      fullResult.approvalInputsReady === true &&
      fullResult.spatialEvidenceReviewReady === true &&
      fullPacket.validation.teacherConfirmationMatched === true &&
      fullPacket.validation.rollbackReady === true &&
      fullPacket.validation.spatialEvidenceReviewReady === true &&
      fullPacket.nextCommands[0].command.includes("--reviewed-api-request") &&
      fullPacket.nextCommands[0].command.includes("--spatial-readiness-confirmed") &&
      fullPacket.nextCommands[0].command.includes("--teacher-confirmation") &&
      fullPacket.nextCommands[0].command.includes("--rollback-point"),
    evidence: fullPacket.nextCommands[0].command
  },
  {
    name: "Spatial route pilot selection receipt blocks forbidden execute requests",
    pass:
      forbiddenResult.status === "blocked_invalid_teacher_pilot_selection_receipt" &&
      forbiddenResult.nextCommandReady === false &&
      forbiddenResult.blockers.includes("forbidden_executeNow"),
    evidence: forbiddenResult.blockers.join(",")
  },
  {
    name: "Spatial route pilot selection receipt never executes software screenshots memory or completion",
    pass:
      selectedResult.softwareActionsExecuted === false &&
      selectedResult.targetSoftwareCommandsExecuted === false &&
      selectedResult.screenshotsCaptured === false &&
      selectedResult.memoryWritten === false &&
      selectedResult.accepted === false &&
      selectedResult.ruleEnabled === false &&
      selectedResult.packagingGated === true &&
      selectedResult.nativeUniversalExecution === false &&
      selectedResult.allSoftwareExecutionComplete === false &&
      selectedResult.goalComplete === false,
    evidence: selectedResult.packetPath
  }
];

const failed = checks.filter((check) => !check.pass);
const result = {
  ok: failed.length === 0,
  format: "transparent_ai_spatial_route_pilot_selection_receipt_smoke_v1",
  smokeRoot,
  checks,
  packets: {
    template: templateResult.packetPath,
    selected: selectedResult.packetPath,
    missingSpatialEvidence: missingSpatialEvidenceResult.packetPath,
    full: fullResult.packetPath,
    forbidden: forbiddenResult.packetPath
  }
};

console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exit(1);
if (!existsSync(templateResult.packetPath) || !existsSync(selectedResult.packetPath)) process.exit(1);
