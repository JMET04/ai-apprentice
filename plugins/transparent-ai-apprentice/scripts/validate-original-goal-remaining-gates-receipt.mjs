#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-remaining-gates-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-remaining-gates-receipt-validation"
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

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_reviewed_opened", "reviewed_opened"].includes(text)) return "teacher_reviewed_opened";
  if (["ready_for_next_review_queue", "ready_for_follow_up", "teacher_reviewed_continue"].includes(text)) {
    return "ready_for_next_review_queue";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
  if (
    [
      "accepted",
      "execute_now",
      "register_now",
      "run_execute_mode",
      "memory_enabled",
      "claim_complete",
      "native_universal_execution",
      "unlock_packaging"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function commandSafety(command) {
  const lower = String(command || "").toLowerCase();
  const forbiddenMarkers = [
    "--teacher-reviewed",
    "--teacher-confirmed",
    "--execute",
    "-teacherconfirmed",
    "-execute",
    " execute-mode ",
    " run_execute_mode ",
    "register-scheduledtask",
    "schtasks /create",
    "allow-system-change"
  ];
  const matchedForbiddenMarkers = forbiddenMarkers.filter((marker) => lower.includes(marker));
  return {
    safeForReviewQueue: matchedForbiddenMarkers.length === 0,
    matchedForbiddenMarkers,
    reason: matchedForbiddenMarkers.length
      ? "handoff contains direct teacher-reviewed, execute, registration, or system-change markers"
      : "handoff is an open, review, placeholder, or validation-preparation step"
  };
}

function commandPlaceholders(value) {
  return Array.from(new Set(String(value || "").match(/<[^<>]+>/g) || []));
}

function classifyHandoff(command, openPath) {
  const text = String(command || "");
  if (text.includes("validate-") || text.includes("validate_")) return "downstream_receipt_validation";
  if (openPath || (text && existsSync(text))) return "open_review_entry";
  if (text) return "manual_review_command";
  return "missing_handoff_target";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotExecuteCommands: true,
    validationDoesNotRegisterTask: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotReadFullLogs: true,
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

function reviewRows(packet) {
  const gateRows = (packet.gateGroups || []).map((row, index) => ({
    id: `gate_group_${slugify(row.lane || index + 1)}`,
    sourceKind: "gate_group",
    label: row.lane || `Gate group ${index + 1}`,
    lane: row.lane || "",
    openPath: packet.sourceEvidence?.gapActionBoard || "",
    command: packet.sourceEvidence?.gapActionBoard || "",
    nextAction: row.firstNextAction || ""
  }));
  const routeRows = (packet.shortestTeacherRoute || []).map((row, index) => ({
    id: `teacher_route_${String(row.order || index + 1).padStart(3, "0")}`,
    sourceKind: "teacher_route",
    label: row.reviewEntryId || row.lane || `Teacher route ${index + 1}`,
    lane: row.lane || "",
    openPath: row.openPath || "",
    command: row.validationCommand || row.openPath || "",
    nextAction: row.teacherInstruction || "",
    sourceRouteRowId: row.id || "",
    reviewEntryId: row.reviewEntryId || ""
  }));
  const lowTokenRows = (packet.nextLowTokenActions || []).map((row, index) => ({
    id: `low_token_action_${slugify(row.id || index + 1)}`,
    sourceKind: "low_token_action",
    label: row.id || `Low-token action ${index + 1}`,
    lane: row.route || "",
    openPath: row.evidencePath || "",
    command: row.evidencePath || row.nextTool || "",
    nextAction: row.nextInstruction || row.reason || "",
    software: row.software || "",
    estimatedTokenCost: row.estimatedTokenCost ?? null,
    screenshotCostClass: row.screenshotCostClass || ""
  }));
  return new Map([...gateRows, ...routeRows, ...lowTokenRows].map((row) => [row.id, row]));
}

function queueItemFor(row, receiptRow) {
  const command = row.command || row.openPath || "";
  const safety = commandSafety(command);
  const missingInputs = commandPlaceholders(command);
  const handoffKind = classifyHandoff(command, row.openPath || "");
  return {
    id: `remaining_gate_next_${row.id}`,
    sourceItemId: row.id,
    sourceReceiptRowId: receiptRow.id,
    sourceKind: row.sourceKind,
    label: row.label,
    lane: row.lane,
    reviewEntryId: row.reviewEntryId || "",
    sourceRouteRowId: row.sourceRouteRowId || "",
    handoffKind,
    openPath: row.openPath || "",
    openPathExists: row.openPath ? existsSync(row.openPath) : false,
    command,
    missingInputs,
    commandExecutableNow: false,
    executesNow: false,
    status:
      !safety.safeForReviewQueue || handoffKind === "missing_handoff_target"
        ? "blocked_for_unsafe_or_missing_handoff"
        : missingInputs.length
          ? "waiting_for_teacher_downstream_receipt_or_placeholder_replacement"
          : "ready_for_manual_review_handoff",
    teacherAction:
      row.sourceKind === "low_token_action"
        ? "Review the compact low-token evidence first; request one visual check only through the separate teacher-confirmed visual capture command if needed."
        : row.sourceKind === "teacher_route"
          ? "Continue through the existing teacher action router row and fill the downstream receipt before any validator or runner."
          : "Open the gap action board and review the grouped remaining gate rows before choosing a downstream route.",
    teacherNote: receiptRow.teacherNote || "",
    observedEvidencePath: receiptRow.observedEvidencePath || "",
    safety,
    blockedActions: [
      "execute_command_from_remaining_gates_validation",
      "register_task_from_remaining_gates_validation",
      "launch_runner_from_remaining_gates_validation",
      "execute_target_software_from_remaining_gates_validation",
      "capture_screenshot_from_remaining_gates_validation",
      "write_memory_from_remaining_gates_validation",
      "claim_goal_complete_from_remaining_gates_validation"
    ]
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Original Goal Remaining Gates Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.id}: ${row.status}`),
    "",
    "Next review queue:",
    ...validation.nextReviewQueue.map((item, index) => `${index + 1}. ${item.label}: ${item.command || item.openPath || "(open source packet)"}`),
    "",
    "Safety boundary:",
    "- This validation does not execute generated commands.",
    "- It does not register scheduled tasks, launch runners, execute target software, capture screenshots, write memory, enable rules, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate original-goal remaining gates teacher receipt.");
const packetInput = readJsonInput(
  argValue("--packet", argValue("--remaining-gates-packet", "")),
  "--packet",
  "transparent_ai_original_goal_remaining_gates_packet_v1"
);
if (!packetInput.value) throw new Error("--packet is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_remaining_gates_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-remaining-gates-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const packet = packetInput.value;
const receipt = receiptInput.value;
const rows = reviewRows(packet);
const forbidden = new Set([
  "accepted",
  "execute_now",
  "register_now",
  "run_execute_mode",
  "memory_enabled",
  "claim_complete",
  "native_universal_execution",
  "unlock_packaging",
  ...(packet.blockedActions || []),
  ...(receipt.blockedActions || [])
]);

const validationRows = (receipt.rowDecisions || []).map((receiptRow) => {
  const row = rows.get(receiptRow.id);
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const hasObservedEvidence = Boolean(String(receiptRow.observedEvidencePath || receiptRow.teacherNote || "").trim());
  const queueItem = row ? queueItemFor(row, receiptRow) : null;
  const unsafeQueueItem = Boolean(queueItem?.command) && !queueItem.safety.safeForReviewQueue;
  const canAdvance =
    Boolean(row) &&
    decision === "ready_for_next_review_queue" &&
    evidenceReviewed &&
    hasObservedEvidence &&
    !forbiddenDecision &&
    !unsafeQueueItem;
  return {
    id: receiptRow.id,
    sourceKind: row?.sourceKind || receiptRow.sourceKind || "unknown",
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    evidenceReviewed,
    hasObservedEvidence,
    observedEvidencePath: receiptRow.observedEvidencePath || "",
    teacherNote: receiptRow.teacherNote || "",
    rowFound: Boolean(row),
    lane: row?.lane || "",
    openPath: row?.openPath || "",
    openPathExists: row?.openPath ? existsSync(row.openPath) : false,
    status: !row
      ? "unknown_remaining_gate_row"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : unsafeQueueItem
          ? "blocked_for_unsafe_next_review_queue_item"
          : decision === "blocked_needs_more_evidence"
            ? "blocked_needs_more_evidence"
            : decision === "teacher_reviewed_opened"
              ? "teacher_reviewed_opened_waiting_for_next_queue_decision"
              : canAdvance
                ? "ready_for_next_review_queue"
                : decision === "ready_for_next_review_queue" && !hasObservedEvidence
                  ? "blocked_for_missing_observed_evidence"
                  : "needs_teacher_review",
    canAdvance,
    nextReviewQueueItem: canAdvance ? queueItem : null,
    queueSafety: queueItem?.safety || commandSafety("")
  };
});

const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const unsafeQueueItemUsed = validationRows.some((row) => row.status === "blocked_for_unsafe_next_review_queue_item");
const readyRows = validationRows.filter((row) => row.canAdvance);
const blockedRows = validationRows.filter((row) => row.status.startsWith("blocked_"));
const waitingRows = validationRows.filter((row) => !row.canAdvance && !row.status.startsWith("blocked_"));
const nextReviewQueue = readyRows.map((row, index) => ({
  order: index + 1,
  number: index + 1,
  ...row.nextReviewQueueItem
}));
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : unsafeQueueItemUsed
    ? "blocked_for_unsafe_next_review_queue_item"
    : readyRows.length > 0 && waitingRows.length === 0 && blockedRows.length === 0
      ? "all_rows_ready_for_next_review_queue"
      : readyRows.length > 0
        ? "some_rows_ready_for_next_review_queue"
        : "needs_teacher_review";
const status = forbiddenDecisionUsed || unsafeQueueItemUsed
  ? "blocked"
  : readyRows.length > 0
    ? "validated_with_next_review_queue"
    : "waiting_for_teacher_remaining_gates_review";
const validationPath = join(validationDir, "original-goal-remaining-gates-receipt-validation.json");
const readmePath = join(validationDir, "ORIGINAL_GOAL_REMAINING_GATES_RECEIPT_VALIDATION_START_HERE.md");
const validationLocks = locks();

const validation = {
  ok: true,
  format: "transparent_ai_original_goal_remaining_gates_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  sourceEvidence: {
    packet: packetInput.path,
    receipt: receiptInput.path,
    packetId: packet.packetId || "",
    receiptPacketId: receipt.packetId || ""
  },
  counts: {
    receiptRows: validationRows.length,
    readyRows: readyRows.length,
    waitingRows: waitingRows.length,
    blockedRows: blockedRows.length,
    nextReviewQueue: nextReviewQueue.length
  },
  forbiddenDecisionUsed,
  unsafeQueueItemUsed,
  validationRows,
  nextReviewQueue,
  blockedActions: [
    "execute_remaining_gates_next_review_queue",
    "register_scheduled_task_from_remaining_gates_validation",
    "launch_runner_from_remaining_gates_validation",
    "execute_target_software_from_remaining_gates_validation",
    "capture_screenshot_from_remaining_gates_validation",
    "write_memory_from_remaining_gates_validation",
    "claim_goal_complete_from_remaining_gates_validation"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    readme: readmePath
  }
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_remaining_gates_receipt_validation_result_v1",
      validationPath,
      readmePath,
      status,
      validationDecision,
      readyRows: readyRows.length,
      nextReviewQueue: nextReviewQueue.length,
      locks: validationLocks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed || unsafeQueueItemUsed) process.exit(1);
