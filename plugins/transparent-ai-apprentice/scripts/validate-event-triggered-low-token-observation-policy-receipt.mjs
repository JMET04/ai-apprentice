#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "event-triggered-low-token-observation-policy-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "event-triggered-low-token-observation-policy-receipt-validation"
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

function quote(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, quote(value));
  }
  return parts.join(" ");
}

function placeholders(value) {
  const matches = String(value ?? "").match(/<[^<>]+>|__[A-Z0-9_]+__/g);
  return matches ? [...new Set(matches)] : [];
}

function resolvedText(value) {
  const text = String(value ?? "").trim();
  return text && placeholders(text).length === 0 ? text : "";
}

function visualQueuePathFromPolicy(policy) {
  const direct = resolvedText(policy?.sourceEvidence?.visualCheckQueuePath);
  if (direct) return direct;
  const budgetPlanPath = resolvedText(policy?.sourceEvidence?.budgetPlanPath);
  if (!budgetPlanPath || !existsSync(budgetPlanPath)) return "";
  try {
    return resolvedText(readJson(budgetPlanPath)?.sourceEvidence?.visualCheckQueuePath);
  } catch {
    return "";
  }
}

function visualRequestPathFor(source, policy) {
  const candidates = [source?.evidencePath, policy?.sourceEvidence?.visualCheckQueuePath, visualQueuePathFromPolicy(policy)]
    .map(resolvedText)
    .filter(Boolean);
  return candidates.find((path) => existsSync(path)) || candidates[0] || "";
}

function visualRequestBlockers(source, row, policy, visualRow) {
  if (!visualRow) return [];
  const blockers = [];
  const requestId = String(row.approvedVisualCheckRequestId || "").trim();
  const requestIdPlaceholders = placeholders(requestId);
  const requestPathRaw = source?.evidencePath || policy?.sourceEvidence?.visualCheckQueuePath || visualQueuePathFromPolicy(policy) || "";
  const requestPath = visualRequestPathFor(source, policy);
  const requestPathPlaceholders = placeholders(requestPathRaw);
  if (!requestId) blockers.push("missing_approved_visual_check_request_id");
  if (requestIdPlaceholders.length) blockers.push("approved_visual_check_request_id_contains_placeholder");
  if (!String(requestPathRaw || "").trim()) blockers.push("missing_visual_check_request_or_queue_path");
  if (requestPathPlaceholders.length) blockers.push("visual_check_request_path_contains_placeholder");
  if (requestPath && !existsSync(requestPath)) blockers.push("visual_check_request_path_not_found");
  return blockers;
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["confirmed", "confirm", "teacher_confirms_policy"].includes(text)) return "teacher_confirms_policy";
  if (["lower_token", "teacher_requests_lower_token_cost", "too_many_tokens"].includes(text)) return "teacher_requests_lower_token_cost";
  if (["visual_too_expensive", "teacher_marks_visual_trigger_too_expensive", "no_screenshot"].includes(text)) {
    return "teacher_marks_visual_trigger_too_expensive";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked";
  if (
    [
      "accepted",
      "execute_now",
      "run_now",
      "capture_now",
      "capture_screenshot",
      "write_memory",
      "enable_rule",
      "unlock_packaging",
      "claim_goal_complete",
      "read_full_logs",
      "send_ui_events",
      "register_schedule",
      "continuous_recording",
      "native_universal_execution"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotRunBudgetPlan: true,
    validationDoesNotRunCapture: true,
    validationDoesNotRunLearningHandoff: true,
    validationDoesNotRunVoiceWorkbench: true,
    validationDoesNotExecuteSoftware: true,
    validationDoesNotSendUiEvents: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotEnableRules: true,
    validationDoesNotUnlockPackaging: true,
    captureInvoked: false,
    learningHandoffInvoked: false,
    voiceWorkbenchInvoked: false,
    budgetPlanInvoked: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    fullLogsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false,
    teacherConfirmationRequiredBeforeCapture: true,
    teacherConfirmationRequiredBeforeExecution: true,
    rollbackPointReviewedRequiredBeforeFollowUp: true
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Event Triggered Low Token Observation Policy Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Confirmed rows: ${validation.confirmedRowCount}/${validation.totalRows}`,
    `Lower-token rows: ${validation.lowerTokenRowCount}`,
    `Visual-too-expensive rows: ${validation.visualTooExpensiveRowCount}`,
    "",
    "Follow-up queue:",
    ...validation.followUpQueue.map((row) => `- ${row.itemId}: ${row.route}; ${row.commandTemplate || row.nextInstruction}`),
    "",
    "Safety boundary:",
    "- This validation does not run the budget plan, capture screenshots, read full logs, execute software, send UI events, write memory, enable rules, unlock packaging, or claim goal completion.",
    "- A confirmed visual row only prepares separate teacher-reviewed command templates for one capture, learning handoff, and voice/text numbered-target workbench; it does not run them."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate event-triggered low-token observation policy receipt.");
const policyInput = readJsonInput(
  argValue("--policy", argValue("--builder", "")),
  "--policy",
  "transparent_ai_event_triggered_low_token_observation_policy_v1"
);
if (!policyInput.value) throw new Error("--policy is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_event_triggered_low_token_observation_policy_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "event-triggered-low-token-observation-policy-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const policy = policyInput.value;
const receipt = receiptInput.value;
if (receipt.policyId && receipt.policyId !== policy.policyId) {
  throw new Error("--receipt policyId does not match --policy policyId");
}

const sourceRows = new Map((policy.triggerRows || []).map((row) => [row.rowId, row]));
const forbidden = new Set([
  "accepted",
  "execute_now",
  "run_now",
  "capture_now",
  "capture_screenshot",
  "write_memory",
  "enable_rule",
  "unlock_packaging",
  "claim_goal_complete",
  "read_full_logs",
  "send_ui_events",
  "register_schedule",
  "continuous_recording",
  "native_universal_execution"
]);

const receiptRows = Array.isArray(receipt.rowReceipts) ? receipt.rowReceipts : [];
const rollbackPointReviewed = receipt.rollbackPointReviewed === true;
const rollbackPointPath = resolvedText(receipt.rollbackPointPath || "");
const validationRows = receiptRows.map((row) => {
  const source = sourceRows.get(row.rowId);
  const decision = normalizeDecision(row.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const locksClosed =
    row.locks?.captureNow === false &&
    row.locks?.executeNow === false &&
    row.locks?.writeMemoryNow === false &&
    row.locks?.ruleEnabled !== true;
  const visualRow = Number(source?.maxScreenshots || 0) > 0;
  const approvedVisualCheckRequestId = row.approvedVisualCheckRequestId || "";
  const visualBlockers = visualRequestBlockers(source, row, policy, visualRow);
  const visualCheckRequestPath = visualRow ? visualRequestPathFor(source, policy) : "";
  const confirmed =
    Boolean(source) &&
    decision === "teacher_confirms_policy" &&
    rollbackPointReviewed &&
    locksClosed &&
    !forbiddenDecision &&
    visualBlockers.length === 0;
  const status = !source
    ? "unknown_policy_row"
    : forbiddenDecision
      ? "blocked_forbidden_teacher_decision"
      : !locksClosed
      ? "blocked_row_locks_not_closed"
      : decision === "teacher_confirms_policy"
        ? !rollbackPointReviewed
          ? "blocked_rollback_point_not_reviewed"
          : visualBlockers.length
            ? "blocked_visual_check_request_placeholder_or_missing_path"
            : "teacher_confirmed_policy_row_review_only"
          : decision === "teacher_requests_lower_token_cost"
            ? "teacher_requests_lower_token_cost"
            : decision === "teacher_marks_visual_trigger_too_expensive"
              ? visualRow
                ? "teacher_rejected_visual_cost_for_row"
                : "teacher_rejected_visual_cost_on_non_visual_row"
              : decision === "blocked"
                ? "blocked_by_teacher"
                : "needs_teacher_review";
  return {
    rowId: row.rowId || "",
    sourceActionId: source?.sourceActionId || "",
    software: source?.software || "",
    sourceRoute: source?.route || "",
    visualRow,
    maxScreenshots: source?.maxScreenshots ?? 0,
    teacherDecision: decision,
    teacherNote: row.teacherNote || "",
    lowerTokenAlternative: row.lowerTokenAlternative || "",
    approvedVisualCheckRequestId,
    visualCheckRequestPath,
    visualRequestPlaceholderBlockers: visualBlockers,
    visualRequestReadyForCapture: visualRow ? visualBlockers.length === 0 : false,
    rollbackPointReviewed,
    rollbackPointPath,
    forbiddenDecision,
    locksClosed,
    confirmed,
    status
  };
});

const unknownRows = validationRows.filter((row) => row.status === "unknown_policy_row").length;
const forbiddenRows = validationRows.filter((row) => row.forbiddenDecision || row.status === "blocked_row_locks_not_closed").length;
const confirmedRows = validationRows.filter((row) => row.status === "teacher_confirmed_policy_row_review_only");
const lowerTokenRows = validationRows.filter((row) => row.status === "teacher_requests_lower_token_cost");
const visualTooExpensiveRows = validationRows.filter((row) => row.status === "teacher_rejected_visual_cost_for_row");
const blockedRows = validationRows.filter((row) => row.status === "blocked_by_teacher");
const visualRequestBlockedRows = validationRows.filter((row) => row.status === "blocked_visual_check_request_placeholder_or_missing_path");
const rollbackBlockedRows = validationRows.filter((row) => row.status === "blocked_rollback_point_not_reviewed");
const needsReviewRows = validationRows.filter((row) => row.status === "needs_teacher_review");
const expectedRowCount = policy.triggerRows?.length || 0;
const allRowsPresent = validationRows.length === expectedRowCount;
const allConfirmed = allRowsPresent && expectedRowCount > 0 && confirmedRows.length === expectedRowCount;

const followUpQueue = [];
for (const row of confirmedRows) {
  if (row.visualRow) {
    const captureCommand = commandLine("capture-triggered-visual-check.mjs", [
      ["--request", row.visualCheckRequestPath],
      ["--selected-request-id", row.approvedVisualCheckRequestId],
      ["--teacher-confirmed", "true"]
    ]);
    followUpQueue.push({
      itemId: `${row.rowId}-visual-capture-review`,
      rowId: row.rowId,
      route: "prepare_teacher_confirmed_single_visual_check_command",
      commandTemplate: captureCommand,
      commandPlaceholders: placeholders(captureCommand),
      approvedVisualCheckRequestId: row.approvedVisualCheckRequestId,
      visualCheckRequestPath: row.visualCheckRequestPath,
      readyForCaptureCommand: true,
      postCaptureLearningHandoffCommandTemplate:
        "node plugins\\transparent-ai-apprentice\\scripts\\create-triggered-visual-evidence-learning-handoff.mjs --capture-receipt \"<triggered-visual-check-capture-receipt.json>\" --request \"<teacher-reviewed-triggered-visual-check-request-or-queue.json>\" --goal \"Teach from the compact trigger evidence plus one teacher-confirmed visual check.\"",
      postCaptureLearningHandoffStatus: "waiting_for_real_capture_receipt_path",
      postLearningHandoffVoiceControlWorkbenchCommandTemplate:
        policy.nextTriggeredVisualVoiceControlWorkbenchCommandTemplate ||
        "node plugins\\transparent-ai-apprentice\\scripts\\create-triggered-visual-evidence-voice-control-workbench.mjs --handoff \"<triggered-visual-evidence-learning-handoff.json>\" --software \"<teacher-reviewed-software>\" --command \"<teacher voice transcript or typed command>\"",
      postLearningHandoffVoiceControlWorkbenchStatus: "waiting_for_real_triggered_visual_learning_handoff_and_numbered_target_review",
      nextInstruction:
        "Only after the teacher confirms this specific request, capture or copy at most one bounded visual evidence file; then create the learning handoff and, if action is needed, the voice/text numbered-target workbench. This validation has not run any of those steps.",
      locks: locks()
    });
  } else {
    followUpQueue.push({
      itemId: `${row.rowId}-compact-review`,
      rowId: row.rowId,
      route: "review_compact_evidence_without_visual_tokens",
      commandTemplate: "",
      nextInstruction: "Review the compact evidence or bounded tail referenced by the policy row before memory or rule extraction.",
      locks: locks()
    });
  }
}
for (const row of visualRequestBlockedRows) {
  followUpQueue.push({
    itemId: `${row.rowId}-visual-request-placeholder-blocked`,
    rowId: row.rowId,
    route: "waiting_for_teacher_visual_check_request_placeholder_replacement",
    commandTemplate: "",
    commandPlaceholders: [],
    approvedVisualCheckRequestId: row.approvedVisualCheckRequestId,
    visualCheckRequestPath: row.visualCheckRequestPath,
    placeholderBlockers: row.visualRequestPlaceholderBlockers,
    readyForCaptureCommand: false,
    nextInstruction:
      "Replace the approved visual request id and request-or-queue path with real teacher-reviewed values before preparing any screenshot capture command.",
    locks: locks()
  });
}
for (const row of lowerTokenRows) {
  followUpQueue.push({
    itemId: `${row.rowId}-lower-token-replan`,
    rowId: row.rowId,
    route: "regenerate_lower_token_budget_plan",
    commandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\create-low-token-trigger-budget-plan.mjs --learning-cycle \"<latest-low-token-learning-cycle.json>\" --visual-check-queue \"<latest-visual-check-queue.json>\" --token-budget \"4\"",
    nextInstruction: row.lowerTokenAlternative || "Regenerate the budget plan with a smaller token budget before any visual check.",
    locks: locks()
  });
}
for (const row of visualTooExpensiveRows) {
  followUpQueue.push({
    itemId: `${row.rowId}-visual-too-expensive`,
    rowId: row.rowId,
    route: "defer_visual_check_and_request_more_compact_evidence",
    commandTemplate: "",
    nextInstruction: "Do not capture this visual check. Ask for cheaper log/state evidence, a teacher marker, or a lower-token budget plan.",
    locks: locks()
  });
}

const validationDecision =
  forbiddenRows > 0 || unknownRows > 0
    ? "blocked_invalid_policy_receipt"
    : visualRequestBlockedRows.length > 0
      ? "blocked_visual_check_request_placeholder_or_missing_path"
    : rollbackBlockedRows.length > 0
      ? "blocked_rollback_point_not_reviewed"
    : allConfirmed
      ? "teacher_confirmed_event_trigger_policy_review_only"
      : lowerTokenRows.length > 0 || visualTooExpensiveRows.length > 0
        ? "teacher_requested_lower_token_policy_follow_up"
        : blockedRows.length > 0
          ? "blocked_by_teacher"
          : needsReviewRows.length > 0 || !allRowsPresent
            ? "needs_teacher_review"
            : "needs_teacher_review";

const validationPath = join(validationDir, "event-triggered-low-token-observation-policy-receipt-validation.json");
const followUpQueuePath = join(validationDir, "event-triggered-low-token-observation-policy-follow-up-queue.json");
const readmePath = join(validationDir, "EVENT_TRIGGERED_LOW_TOKEN_OBSERVATION_POLICY_RECEIPT_VALIDATION_START_HERE.md");
const validationReceiptPath = join(validationDir, "event-triggered-low-token-observation-policy-validation-receipt.json");
const lockState = locks();
const validation = {
  ok: forbiddenRows === 0 && unknownRows === 0 && visualRequestBlockedRows.length === 0 && rollbackBlockedRows.length === 0,
  format: "transparent_ai_event_triggered_low_token_observation_policy_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status:
    validationDecision === "teacher_confirmed_event_trigger_policy_review_only"
      ? "teacher_confirmed_policy_waiting_for_review_only_follow_up"
      : validationDecision,
  validationDecision,
  policyPath: policyInput.path,
  receiptPath: receiptInput.path,
  totalRows: expectedRowCount,
  receiptRows: validationRows.length,
  allRowsPresent,
  confirmedRowCount: confirmedRows.length,
  lowerTokenRowCount: lowerTokenRows.length,
  visualTooExpensiveRowCount: visualTooExpensiveRows.length,
  visualRequestBlockedRowCount: visualRequestBlockedRows.length,
  rollbackBlockedRowCount: rollbackBlockedRows.length,
  rollbackPointReviewed,
  rollbackPointPath,
  forbiddenRowCount: forbiddenRows,
  unknownRowCount: unknownRows,
  followUpQueuePath,
  followUpQueue,
  validationRows,
  locks: lockState
};

const followUpQueuePacket = {
  ok: true,
  format: "transparent_ai_event_triggered_low_token_observation_policy_follow_up_queue_v1",
  validationId,
  sourceValidationPath: validationPath,
  status: followUpQueue.length ? "waiting_for_teacher_reviewed_follow_up" : "no_follow_up_ready",
  items: followUpQueue,
  blockedActions: [
    "capture_without_teacher_confirmed_follow_up_item",
    "capture_with_placeholder_visual_request_id_or_path",
    "execute_from_policy_validation",
    "read_full_logs_from_policy_validation",
    "write_memory_from_policy_validation",
    "enable_rule_from_policy_validation",
    "create_voice_workbench_without_triggered_visual_handoff",
    "execute_from_voice_without_numbered_target_confirmation",
    "claim_goal_complete_from_policy_validation"
  ],
  locks: lockState
};

const validationReceipt = {
  format: "transparent_ai_event_triggered_low_token_observation_policy_validation_receipt_v1",
  validationId,
  validationPath,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "ready_for_follow_up", "blocked"],
  forbiddenDecisions: [
    "accepted",
    "capture_now",
    "capture_screenshot",
    "execute_now",
    "run_now",
    "read_full_logs",
    "send_ui_events",
    "register_schedule",
    "create_voice_workbench_now",
    "execute_from_voice_without_numbered_target_confirmation",
    "write_memory",
    "enable_rule",
    "unlock_packaging",
    "native_universal_execution",
    "claim_goal_complete"
  ],
  teacherDecision: "needs_teacher_review",
  teacherNote: "",
  locks: lockState
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(followUpQueuePath, `${JSON.stringify(followUpQueuePacket, null, 2)}\n`, "utf8");
writeFileSync(validationReceiptPath, `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format: "transparent_ai_event_triggered_low_token_observation_policy_receipt_validation_result_v1",
      validationPath,
      followUpQueuePath,
      readmePath,
      validationReceiptPath,
      status: validation.status,
      validationDecision,
      confirmedRowCount: validation.confirmedRowCount,
      lowerTokenRowCount: validation.lowerTokenRowCount,
      visualTooExpensiveRowCount: validation.visualTooExpensiveRowCount,
      followUpItemCount: followUpQueue.length,
      locks: lockState
    },
    null,
    2
  )
);

if (!validation.ok) process.exit(1);
