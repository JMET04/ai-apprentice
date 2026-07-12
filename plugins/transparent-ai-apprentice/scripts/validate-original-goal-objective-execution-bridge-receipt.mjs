#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "objective-execution-bridge-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "objective-execution-bridge-receipt-validation"
  );
}

function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_selects_route", "select_route", "route_selected"].includes(text)) return "teacher_selects_route";
  if (["teacher_requests_more_evidence", "request_more_evidence", "more_evidence"].includes(text)) {
    return "teacher_requests_more_evidence";
  }
  if (["teacher_requests_high_reasoning_repair", "high_reasoning_repair", "repair"].includes(text)) {
    return "teacher_requests_high_reasoning_repair";
  }
  if (
    [
      "execute_now",
      "register_now",
      "launch_runner",
      "send_ui_events",
      "write_memory",
      "enable_rule",
      "unlock_packaging",
      "accepted",
      "claim_complete"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function locks({ routeReady = false } = {}) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationOnly: true,
    routeSelectedForLaterGate: routeReady,
    validationDoesNotRunCommands: true,
    validationDoesNotRegisterTask: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotSendUiEvents: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotReadLogs: true,
    validationDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function routeCommand(route, receipt) {
  const command = route?.startCommand || "";
  const note = [
    `teacherSelectedNumberedTarget=${receipt.teacherSelectedNumberedTarget || ""}`,
    `retainedRollbackPoint=${receipt.retainedRollbackPoint || ""}`,
    `adapterEvidencePath=${receipt.adapterEvidencePath || ""}`,
    `postActionEvidencePlan=${receipt.postActionEvidencePlan || ""}`
  ].join("; ");
  return `${command}\n# Teacher route-selection evidence: ${note}`;
}

function writeReadme(path, validation) {
  const lines = [
    "# Original Goal Objective Execution Bridge Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.teacherDecision}`,
    "",
    "Selected route handoff:",
    validation.selectedRouteHandoff ? validation.selectedRouteHandoff.commandTemplate : "(none)",
    "",
    "Blockers:",
    ...(validation.blockers.length ? validation.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "Safety boundary:",
    "- This validation only checks the teacher route-selection receipt.",
    "- It does not run commands, register tasks, launch runners, execute target software, send UI events, capture screenshots, read logs, write memory, enable rules, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const bridgeInput = readJsonInput(
  argValue("--bridge", argValue("--execution-bridge", "")),
  "--bridge",
  "transparent_ai_original_goal_objective_execution_bridge_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_objective_execution_bridge_receipt_v1"
);
const bridge = bridgeInput.value;
const receipt = receiptInput.value;
const bridgeHash = sha256Text(JSON.stringify(bridge));
const routes = new Map((bridge.recommendedRouteOrder || []).map((route) => [route.routeId, route]));
const decision = normalizeDecision(receipt.teacherDecision);
const forbidden = new Set([
  "execute_now",
  "register_now",
  "launch_runner",
  "send_ui_events",
  "write_memory",
  "enable_rule",
  "unlock_packaging",
  "accepted",
  "claim_complete"
]);
const blockers = [];
function block(code) {
  blockers.push(code);
}

if (receipt.sourceBridgeId !== bridge.bridgeId) block("source_bridge_id_mismatch");
if (receipt.sourceBridgeHash !== bridgeHash) block("source_bridge_hash_mismatch");
if (receipt.executeNow !== false) block("receipt_execute_now_forbidden");
if (receipt.reviewOnly !== true) block("receipt_review_only_missing");
if (forbidden.has(decision)) block("forbidden_teacher_decision");

const selectedRoute = routes.get(receipt.selectedRouteId || "");
if (decision === "teacher_selects_route") {
  if (!receipt.routeReviewed) block("route_not_reviewed");
  if (!selectedRoute) block("selected_route_not_found");
  if (!String(receipt.teacherSelectedNumberedTarget || "").trim()) block("teacher_selected_numbered_target_required");
  if (!String(receipt.retainedRollbackPoint || "").trim()) block("retained_rollback_point_required");
  if (!String(receipt.adapterEvidencePath || "").trim()) block("adapter_evidence_path_required");
  if (!String(receipt.postActionEvidencePlan || "").trim()) block("post_action_evidence_plan_required");
}
if (
  (decision === "teacher_requests_more_evidence" || decision === "teacher_requests_high_reasoning_repair") &&
  !String(receipt.teacherNotes || "").trim()
) {
  block("teacher_notes_required_for_non_route_decision");
}

const routeReady = decision === "teacher_selects_route" && blockers.length === 0;
const needsMoreEvidence = decision === "teacher_requests_more_evidence" && blockers.length === 0;
const routesToRepair = decision === "teacher_requests_high_reasoning_repair" && blockers.length === 0;
const status = forbidden.has(decision)
  ? "blocked_for_forbidden_objective_execution_bridge_decision"
  : routeReady
    ? "objective_execution_bridge_route_selected_for_later_controlled_gate"
    : needsMoreEvidence
      ? "objective_execution_bridge_waiting_for_more_evidence"
      : routesToRepair
        ? "objective_execution_bridge_routes_to_high_reasoning_repair"
        : "objective_execution_bridge_needs_teacher_review";

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-objective-execution-bridge-receipt-validations"))
);
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(receipt.selectedRouteId || decision)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });
const validationPath = join(validationDir, "original-goal-objective-execution-bridge-receipt-validation.json");
const readmePath = join(validationDir, "ORIGINAL_GOAL_OBJECTIVE_EXECUTION_BRIDGE_RECEIPT_VALIDATION_START_HERE.md");
const selectedRouteHandoff = routeReady
  ? {
      format: "transparent_ai_original_goal_objective_execution_bridge_selected_route_handoff_v1",
      selectedRouteId: receipt.selectedRouteId,
      sourceBridgePath: bridgeInput.path,
      routeWhenToUse: selectedRoute.whenToUse,
      downstreamEvidence: selectedRoute.downstreamEvidence,
      commandTemplate: routeCommand(selectedRoute, receipt),
      teacherSelectedNumberedTarget: receipt.teacherSelectedNumberedTarget,
      retainedRollbackPoint: receipt.retainedRollbackPoint,
      adapterEvidencePath: receipt.adapterEvidencePath,
      postActionEvidencePlan: receipt.postActionEvidencePlan,
      executeNow: false,
      requiresSeparateTeacherApprovedGate: true
    }
  : null;
const validation = {
  ok: !forbidden.has(decision) && blockers.length === 0,
  format: "transparent_ai_original_goal_objective_execution_bridge_receipt_validation_v1",
  validationId,
  status,
  teacherDecision: decision,
  sourceBridgePath: bridgeInput.path,
  sourceReceiptPath: receiptInput.path,
  selectedRouteId: receipt.selectedRouteId || "",
  routeReadyForLaterGate: routeReady,
  selectedRouteHandoff,
  moreEvidenceHandoff: needsMoreEvidence
    ? { status: "request_more_evidence", teacherNotes: receipt.teacherNotes, executeNow: false, reviewOnly: true }
    : null,
  highReasoningRepairHandoff: routesToRepair
    ? { status: "route_to_high_reasoning_repair", teacherNotes: receipt.teacherNotes, executeNow: false, reviewOnly: true }
    : null,
  blockers,
  blockedActions: [
    "execute_target_software_from_execution_bridge_receipt_validation",
    "register_task_from_execution_bridge_receipt_validation",
    "launch_runner_from_execution_bridge_receipt_validation",
    "send_ui_events_from_execution_bridge_receipt_validation",
    "capture_screenshot_from_execution_bridge_receipt_validation",
    "read_logs_from_execution_bridge_receipt_validation",
    "write_memory_from_execution_bridge_receipt_validation",
    "enable_rule_from_execution_bridge_receipt_validation",
    "claim_goal_complete_from_execution_bridge_receipt_validation"
  ],
  locks: locks({ routeReady })
};
writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format: "transparent_ai_original_goal_objective_execution_bridge_receipt_validation_result_v1",
      validationPath,
      readmePath,
      status: validation.status,
      routeReadyForLaterGate: validation.routeReadyForLaterGate,
      blockers
    },
    null,
    2
  )
);
if (!validation.ok) process.exit(1);
