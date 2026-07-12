#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "spatial-route-pilot-selection-receipt")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "spatial-route-pilot-selection-receipt"
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

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    teacherConfirmationRequired: true,
    selectedPilotRequired: true,
    receiptRequiredBeforeSelectionReuse: true,
    selectionReceiptDoesNotCreateApprovalGate: true,
    selectionReceiptDoesNotRunApprovalGatePrepRunner: true,
    selectionReceiptDoesNotRunApprovedGateRunner: true,
    selectionReceiptDoesNotInvokeAdapter: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false,
    privateChainOfThoughtExposed: false
  };
}

function commandText(scriptName, args) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map((part) => {
      const text = String(part);
      return /\s|["]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
    })
    .join(" ");
}

function candidateByReceipt(candidates, receipt) {
  const selectedPilotId = String(receipt?.selectedPilotId || "").trim();
  const selectedPilotNumber = receipt?.selectedPilotNumber || receipt?.selectedNumber || 0;
  if (selectedPilotId) return candidates.find((candidate) => candidate.pilotId === selectedPilotId) || null;
  if (selectedPilotNumber) {
    return candidates.find((candidate) => Number(candidate.number) === Number(selectedPilotNumber)) || null;
  }
  return null;
}

function reviewedEvidence(receipt, adapterId) {
  const kind = String(receipt?.reviewedEvidenceKind || "").trim();
  const value = String(receipt?.reviewedEvidenceValue || "").trim();
  const byKind = {
    reviewed_command: "--reviewed-command",
    command: "--reviewed-command",
    reviewed_api_request: "--reviewed-api-request",
    api: "--reviewed-api-request",
    api_request: "--reviewed-api-request",
    reviewed_mapping: "--reviewed-mapping",
    mapping: "--reviewed-mapping",
    reviewed_browser_target: "--reviewed-browser-target",
    browser: "--reviewed-browser-target",
    target_window_title: "--target-window-title",
    window: "--target-window-title"
  };
  if (kind && byKind[kind]) return { arg: byKind[kind], value };
  if (adapterId === "existing-cli-or-script") return { arg: "--reviewed-command", value };
  if (adapterId === "existing-application-api") return { arg: "--reviewed-api-request", value };
  if (adapterId === "existing-file-import-export") return { arg: "--reviewed-mapping", value };
  if (adapterId === "existing-browser-automation") return { arg: "--reviewed-browser-target", value };
  return { arg: "--target-window-title", value };
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function spatialEvidenceReview(receipt, prep) {
  const validationPath = firstNonEmpty(
    receipt?.spatialEvidenceValidationPath,
    receipt?.spatialIntentEvidenceReceiptValidationPath,
    receipt?.transparentSketchOverlayPacketValidationPath,
    receipt?.transparentSketchDepthRehearsalReviewReceiptValidationPath,
    prep?.source?.spatialEvidenceValidationPath,
    prep?.source?.spatialIntentEvidenceReceiptValidationPath,
    prep?.source?.transparentSketchOverlayPacketValidationPath,
    prep?.source?.transparentSketchDepthRehearsalReviewReceiptValidationPath
  );
  const reviewNote = firstNonEmpty(receipt?.spatialEvidenceReviewNote, receipt?.teacherSpatialEvidenceReviewNote);
  const teacherReviewedSpatialEvidence = receipt?.teacherReviewedSpatialEvidence === true;
  const confirmed2DPosition = receipt?.confirmed2DPosition === true || receipt?.confirmed2DPositionRelation === true;
  const confirmedPerspectiveRelation =
    receipt?.confirmedPerspectiveRelation === true || receipt?.confirmedPerspective === true;
  const confirmed3DDepthRelation = receipt?.confirmed3DDepthRelation === true || receipt?.confirmed3DDepth === true;
  const confirmedDetailLogicReady =
    receipt?.confirmedDetailLogicReady === true || receipt?.confirmedUniversalDetailLogicReady === true;
  return {
    teacherReviewedSpatialEvidence,
    validationPath,
    reviewNote,
    confirmed2DPosition,
    confirmedPerspectiveRelation,
    confirmed3DDepthRelation,
    confirmedDetailLogicReady,
    ready:
      teacherReviewedSpatialEvidence &&
      Boolean(validationPath || reviewNote) &&
      confirmed2DPosition &&
      confirmedPerspectiveRelation &&
      confirmed3DDepthRelation &&
      confirmedDetailLogicReady
  };
}

function explicitTeacherConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed all-software execution pilot",
    "teacher confirmed execution pilot",
    "approve controlled execution pilot",
    "allow controlled execution pilot",
    "i confirm all-software execution pilot",
    "i approve controlled execution pilot"
  ].some((marker) => text.includes(marker));
}

function writeReadme(path, packet) {
  const lines = [
    "# Spatial Route Pilot Selection Receipt",
    "",
    `Status: ${packet.status}`,
    `Goal: ${packet.goal}`,
    "",
    "This package lets the teacher choose one real-local software pilot after a transparent 2D/perspective/3D sketch route has selected a spatial target.",
    "",
    "Review order:",
    "1. Confirm the spatial target number is the intended sketch target.",
    "2. Confirm the teacher-reviewed spatial evidence preserves 2D position, perspective relation, 3D depth, and detail logic.",
    "3. Pick exactly one real-local pilot candidate number.",
    "4. Fill the receipt template and confirm no execution happened in this selection step.",
    "5. Validate the receipt to produce only the next approval-prep handoff command.",
    "",
    "Candidates:"
  ];
  for (const candidate of packet.numberedCandidates) {
    lines.push(`- ${candidate.number}. ${candidate.software} (${candidate.pilotId}, ${candidate.primaryAdapterId || "adapter TBD"})`);
  }
  lines.push(
    "",
    "Locked boundary: accepted=false, ruleEnabled=false, packagingGated=true, softwareActionsExecuted=false, targetSoftwareCommandsExecuted=false, screenshotsCaptured=false, memoryWritten=false, nativeUniversalExecution=false, allSoftwareExecutionComplete=false."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  const candidates = packet.numberedCandidates
    .map(
      (candidate) =>
        `<li><strong>${candidate.number}. ${candidate.software}</strong> <code>${candidate.pilotId}</code> <code>${candidate.primaryAdapterId || "adapter TBD"}</code></li>`
    )
    .join("");
  writeFileSync(
    path,
    `<!doctype html><meta charset="utf-8"><title>Spatial Route Pilot Selection Receipt</title><body><h1>Spatial Route Pilot Selection Receipt</h1><p>Status: <code>${packet.status}</code></p><p>Spatial target number: <code>${packet.spatialSelectedNumber}</code></p><ol>${candidates}</ol><p>Locked: no execution, no screenshots, no memory, no acceptance.</p></body>\n`,
    "utf8"
  );
}

const goal = argValue("--goal", argValue("--task", "Choose one real-local pilot for a teacher-confirmed spatial sketch route."));
const prepInput = readJsonInput(argValue("--prep-handoff", argValue("--handoff", "")), "--prep-handoff");
const prep = prepInput.value;
if (prep?.format !== "transparent_ai_spatial_route_execution_approval_prep_handoff_v1") {
  throw new Error("prep handoff must be transparent_ai_spatial_route_execution_approval_prep_handoff_v1");
}

const selectorInput = readJsonInput(
  argValue("--selector", argValue("--selector-path", prep?.source?.selectorPath || "")),
  "--selector"
);
const selector = selectorInput.value;
if (selector?.format !== "transparent_ai_real_local_execution_pilot_selector_v1") {
  throw new Error("selector must be transparent_ai_real_local_execution_pilot_selector_v1");
}

const receiptInput = readJsonInput(argValue("--receipt", ""), "--receipt", true);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "spatial-route-pilot-selection-receipts"))
);
const receiptPackageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const receiptDir = join(outputRoot, receiptPackageId);
mkdirSync(receiptDir, { recursive: true });

const candidates = Array.isArray(selector.numberedCandidates) ? selector.numberedCandidates : [];
const selectedCandidate = receiptInput.value ? candidateByReceipt(candidates, receiptInput.value) : null;
const adapterId = selectedCandidate?.primaryAdapterId || selectedCandidate?.adapterId || "";
const evidence = reviewedEvidence(receiptInput.value, adapterId);
const spatialReview = spatialEvidenceReview(receiptInput.value, prep);
const teacherConfirmation = String(receiptInput.value?.explicitTeacherConfirmation || receiptInput.value?.teacherConfirmation || "").trim();
const rollbackPoint = String(receiptInput.value?.rollbackPointPath || receiptInput.value?.rollbackPoint || "").trim();
const rollbackReady = receiptInput.value?.rollbackPointCreated === true || Boolean(rollbackPoint);
const teacherConfirmationMatched = explicitTeacherConfirmation(teacherConfirmation);

const validationBlockers = [];
const forbiddenFlags = [
  "accepted",
  "executeNow",
  "runApprovalGateNow",
  "runApprovedGateRunnerNow",
  "softwareActionsExecuted",
  "targetSoftwareCommandsExecuted",
  "uiEventsSent",
  "screenshotsCaptured",
  "writeMemory",
  "memoryWritten",
  "ruleEnabled",
  "technologyAccepted",
  "packagingUnlocked",
  "nativeUniversalExecution",
  "allSoftwareExecutionComplete",
  "goalComplete"
];
if (receiptInput.value) {
  if (receiptInput.value.format !== "transparent_ai_spatial_route_pilot_selection_review_receipt_v1") {
    validationBlockers.push("receipt_format_invalid");
  }
  if (!["selected_for_approval_prep", "needs_different_pilot", "blocked", "needs_teacher_review"].includes(receiptInput.value.decision)) {
    validationBlockers.push("receipt_decision_invalid");
  }
  for (const flag of forbiddenFlags) {
    if (receiptInput.value[flag] === true) validationBlockers.push(`forbidden_${flag}`);
  }
  if (receiptInput.value.decision === "selected_for_approval_prep") {
    if (receiptInput.value.teacherReviewedNumberedCandidates !== true) validationBlockers.push("teacher_must_review_numbered_candidates");
    if (!selectedCandidate) validationBlockers.push("selected_pilot_candidate_not_found");
    if (receiptInput.value.noExecutionBoundaryReviewed !== true) validationBlockers.push("no_execution_boundary_review_required");
    if (receiptInput.value.confirmBuilderDidNotRunApprovalGate !== true) validationBlockers.push("must_confirm_no_approval_gate_was_created");
    if (receiptInput.value.confirmNoSoftwareExecution !== true) validationBlockers.push("must_confirm_no_software_execution");
    if (spatialReview.teacherReviewedSpatialEvidence !== true) validationBlockers.push("teacher_reviewed_spatial_evidence_required");
    if (!spatialReview.validationPath && !spatialReview.reviewNote) {
      validationBlockers.push("spatial_evidence_validation_path_or_review_note_required");
    }
    if (spatialReview.confirmed2DPosition !== true) validationBlockers.push("confirmed_2d_position_required");
    if (spatialReview.confirmedPerspectiveRelation !== true) validationBlockers.push("confirmed_perspective_relation_required");
    if (spatialReview.confirmed3DDepthRelation !== true) validationBlockers.push("confirmed_3d_depth_relation_required");
    if (spatialReview.confirmedDetailLogicReady !== true) validationBlockers.push("confirmed_detail_logic_ready_required");
  }
}

const approvalInputsReady =
  receiptInput.value?.decision === "selected_for_approval_prep" &&
  validationBlockers.length === 0 &&
  Boolean(selectedCandidate) &&
  Boolean(adapterId) &&
  Boolean(evidence.value) &&
  spatialReview.ready &&
  teacherConfirmationMatched &&
  rollbackReady;

const status = !receiptInput.value
  ? "waiting_for_teacher_pilot_selection_receipt"
  : validationBlockers.length
    ? "blocked_invalid_teacher_pilot_selection_receipt"
    : receiptInput.value.decision === "blocked"
      ? "blocked_by_teacher"
      : receiptInput.value.decision === "needs_different_pilot" || receiptInput.value.decision === "needs_teacher_review"
        ? "waiting_for_teacher_to_choose_numbered_real_local_pilot"
        : "teacher_pilot_selection_validated_for_approval_prep_handoff";

const prepArgs = [
  "--goal",
  goal,
  "--route-bridge",
  prep.source?.routeBridgePath || "<transparent_ai_spatial_software_execution_route_bridge_v1 path>",
  "--selector",
  selectorInput.path || prep.source?.selectorPath || "<transparent_ai_real_local_execution_pilot_selector_v1 path>"
];
if (prep.source?.queuePath) prepArgs.push("--queue", prep.source.queuePath);
if (selectedCandidate?.number) prepArgs.push("--selected-number", String(selectedCandidate.number));
if (selectedCandidate?.pilotId) prepArgs.push("--selected-pilot-id", selectedCandidate.pilotId);
if (adapterId) prepArgs.push("--adapter-id", adapterId);
if (evidence.value) prepArgs.push(evidence.arg, evidence.value);
if (spatialReview.validationPath) prepArgs.push("--spatial-evidence-validation", spatialReview.validationPath);
if (spatialReview.reviewNote) prepArgs.push("--spatial-evidence-review-note", spatialReview.reviewNote);
if (spatialReview.ready) prepArgs.push("--spatial-readiness-confirmed");
if (teacherConfirmation) prepArgs.push("--teacher-confirmation", teacherConfirmation);
if (rollbackPoint) prepArgs.push("--rollback-point", rollbackPoint);
else if (receiptInput.value?.rollbackPointCreated === true) prepArgs.push("--rollback-point-created");
prepArgs.push("--output-dir", join(receiptDir, "next-gate-output", "approval-prep-handoff"));

const packetPath = join(receiptDir, "spatial-route-pilot-selection-receipt-package.json");
const receiptTemplatePath = join(receiptDir, "spatial-route-pilot-selection-review-receipt-template.json");
const validationPath = join(receiptDir, "spatial-route-pilot-selection-receipt-validation.json");
const readmePath = join(receiptDir, "SPATIAL_ROUTE_PILOT_SELECTION_RECEIPT_START_HERE.md");
const htmlPath = join(receiptDir, "spatial-route-pilot-selection-receipt.html");

const packet = {
  ok: true,
  format: "transparent_ai_spatial_route_pilot_selection_receipt_package_v1",
  receiptPackageId,
  createdAt: new Date().toISOString(),
  status,
  goal,
  source: {
    prepHandoffPath: prepInput.path,
    prepHandoffFormat: prep.format,
    routeBridgePath: prep.source?.routeBridgePath || "",
    selectorPath: selectorInput.path || prep.source?.selectorPath || "",
    selectorFormat: selector.format,
    queuePath: prep.source?.queuePath || ""
  },
  spatialSelectedNumber: Number(prep.selected?.spatialSelectedNumber || 0),
  numberedCandidates: candidates,
  selectedCandidate: selectedCandidate || null,
  validation: {
    receiptPath: receiptInput.path,
    blockers: validationBlockers,
    approvalInputsReady,
    teacherConfirmationMatched,
    rollbackReady,
    spatialEvidenceReviewReady: spatialReview.ready,
    spatialEvidenceReview: spatialReview,
    reviewedEvidenceArg: evidence.arg,
    reviewedEvidenceValuePresent: Boolean(evidence.value)
  },
  nextCommands: [
    {
      tool: "create_spatial_route_execution_approval_prep_handoff",
      script: "create-spatial-route-execution-approval-prep-handoff.mjs",
      ready: receiptInput.value?.decision === "selected_for_approval_prep" && validationBlockers.length === 0,
      command: commandText("create-spatial-route-execution-approval-prep-handoff.mjs", prepArgs),
      note:
        "This command regenerates only the spatial approval-prep handoff with the teacher-selected pilot. It does not create an approval gate or execute software."
    }
  ],
  blockedTransitions: [
    "auto_select_first_pilot_candidate",
    "reuse_spatial_selected_number_as_pilot_number",
    "create_real_local_execution_approval_gate_without_teacher_selection_receipt",
    "run_all_software_execution_approval_gate_prep_runner_from_selection_receipt",
    "run_all_software_execution_approved_gate_runner_from_selection_receipt",
    "execute_target_software_from_selection_receipt",
    "capture_screenshot_from_selection_receipt",
    "write_memory_from_selection_receipt",
    "claim_goal_complete_from_selection_receipt"
  ],
  locks: locks()
};

const receiptTemplate = {
  format: "transparent_ai_spatial_route_pilot_selection_review_receipt_v1",
  sourcePackagePath: packetPath,
  decision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "selected_for_approval_prep", "needs_different_pilot", "blocked"],
  teacherReviewedNumberedCandidates: false,
  selectedPilotNumber: 0,
  selectedPilotId: "",
  selectedSoftware: "",
  teacherSelectionReason: "",
  teacherReviewedSpatialEvidence: false,
  spatialEvidenceValidationPath: "",
  spatialEvidenceReviewNote: "",
  confirmed2DPosition: false,
  confirmedPerspectiveRelation: false,
  confirmed3DDepthRelation: false,
  confirmedDetailLogicReady: false,
  reviewedEvidenceKind: "",
  reviewedEvidenceValue: "",
  explicitTeacherConfirmation: "",
  rollbackPointPath: "",
  rollbackPointCreated: false,
  noExecutionBoundaryReviewed: false,
  confirmBuilderDidNotRunApprovalGate: false,
  confirmNoSoftwareExecution: false,
  teacherNotes: "",
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false
};

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(validationPath, `${JSON.stringify(packet.validation, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);
writeHtml(htmlPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_route_pilot_selection_receipt_result_v1",
      status,
      packetPath,
      receiptTemplatePath,
      validationPath,
      readmePath,
      htmlPath,
      selectedPilotId: selectedCandidate?.pilotId || "",
      selectedPilotNumber: selectedCandidate?.number || 0,
      approvalInputsReady,
      spatialEvidenceReviewReady: spatialReview.ready,
      blockers: validationBlockers,
      nextCommandReady: packet.nextCommands[0].ready,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    },
    null,
    2
  )
);
