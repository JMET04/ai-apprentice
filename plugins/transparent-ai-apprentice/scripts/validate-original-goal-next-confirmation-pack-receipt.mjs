#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-next-confirmation-pack-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-next-confirmation-pack-receipt-validation"
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
  if (["ready_for_follow_up", "ready_for_source_receipt_validation", "teacher_reviewed_continue"].includes(text)) {
    return "ready_for_source_receipt_validation";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked", "keep_blocked"].includes(text)) {
    return "blocked_needs_more_evidence";
  }
  if (
    [
      "accepted",
      "execute_now",
      "register_now",
      "run_execute_mode",
      "memory_enabled",
      "claim_complete",
      "native_universal_execution",
      "unlock_packaging",
      "run_compact_evidence_without_teacher_receipt",
      "inspect_chat_contents",
      "control_remote_software_without_teacher_route",
      "use_placeholder_overlay_packet",
      "execute_spatial_target_without_numbered_confirmation",
      "allow_medium_runtime_without_logic_contract",
      "register_recurring_monitor_without_teacher_gate",
      "claim_original_goal_complete"
    ].includes(text)
  ) {
    return text;
  }
  return text || "needs_teacher_review";
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
    "allow-system-change",
    "run-confirmed-low-token-compact-evidence-collection"
  ];
  const matchedForbiddenMarkers = forbiddenMarkers.filter((marker) => lower.includes(marker));
  return {
    safeForReviewHandoff: matchedForbiddenMarkers.length === 0,
    matchedForbiddenMarkers,
    reason: matchedForbiddenMarkers.length
      ? "handoff contains direct teacher-reviewed, execute, registration, or system-change markers"
      : "handoff is an open/review/source-receipt validation step"
  };
}

function commandPlaceholders(value) {
  return Array.from(new Set(String(value || "").match(/<[^<>]+>/g) || []));
}

function allowedAdvanceDecision(item, decision) {
  const itemAllowed = new Set((item.allowedTeacherDecisions || []).map((value) => normalizeDecision(value)));
  const genericAllowed = new Set(["ready_for_source_receipt_validation", "teacher_reviewed_opened"]);
  if (genericAllowed.has(decision)) return true;
  if (!itemAllowed.has(decision)) return false;
  return !decision.includes("blocked") && !decision.includes("keep_blocked") && !decision.includes("request_");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotReadLogs: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteCommands: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotRegisterSchedule: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotEnableRules: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotTreatRagAsAuthority: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    fullLogsRead: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function queueItemFor(item, receiptRow) {
  const command = item.validationCommand || item.openPath || "";
  const safety = commandSafety(command);
  return {
    id: `next_confirmation_${item.itemId}`,
    sourceItemId: item.itemId,
    label: item.title || item.itemId,
    order: item.order || 0,
    handoffKind: item.validationCommand ? "source_receipt_validation" : "open_review_entry",
    openPath: item.openPath || "",
    openPathExists: item.openPath ? existsSync(item.openPath) : false,
    command,
    missingInputs: commandPlaceholders(command),
    commandExecutableNow: false,
    executesNow: false,
    status: safety.safeForReviewHandoff
      ? "ready_for_manual_source_receipt_validation"
      : "blocked_for_unsafe_validation_command",
    teacherDecision: receiptRow.teacherDecision || "",
    teacherNote: receiptRow.teacherNote || "",
    safety,
    blockedActions: [
      "execute_next_confirmation_pack_validation_command",
      "register_schedule_from_next_confirmation_pack_validation",
      "launch_runner_from_next_confirmation_pack_validation",
      "execute_target_software_from_next_confirmation_pack_validation",
      "capture_screenshot_from_next_confirmation_pack_validation",
      "write_memory_from_next_confirmation_pack_validation",
      "claim_goal_complete_from_next_confirmation_pack_validation"
    ]
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Original Goal Next Confirmation Pack Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.itemId}: ${row.status}`),
    "",
    "Next review queue:",
    ...validation.nextReviewQueue.map((item, index) => `${index + 1}. ${item.label}: ${item.command || item.openPath || "(open source packet)"}`),
    "",
    "Safety boundary:",
    "- This validation does not execute commands.",
    "- It does not read logs, capture screenshots, register schedules, launch runners, execute target software, write memory, enable rules, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate original-goal next confirmation pack teacher receipt.");
const packInput = readJsonInput(
  argValue("--pack", argValue("--confirmation-pack", "")),
  "--pack",
  "transparent_ai_original_goal_next_confirmation_pack_v1"
);
if (!packInput.value) throw new Error("--pack is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_next_confirmation_pack_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-next-confirmation-pack-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const pack = packInput.value;
const receipt = receiptInput.value;
const itemById = new Map((pack.confirmationItems || []).map((item) => [item.itemId, item]));
const forbidden = new Set([
  "accepted",
  "execute_now",
  "register_now",
  "run_execute_mode",
  "memory_enabled",
  "claim_complete",
  "native_universal_execution",
  "unlock_packaging",
  ...(pack.blockedActions || []),
  ...(receipt.blockedActions || [])
].map((value) => normalizeDecision(value)));

const receiptRows = Array.isArray(receipt.itemDecisions) ? receipt.itemDecisions : [];
const validationRows = receiptRows.map((receiptRow) => {
  const item = itemById.get(receiptRow.itemId);
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const topDecision = normalizeDecision(receipt.decision);
  const forbiddenDecision = forbidden.has(decision) || forbidden.has(topDecision);
  const reviewedOpenPath = receiptRow.reviewedOpenPath === true;
  const reviewedValidationCommand = receiptRow.reviewedValidationCommand === true;
  const openPathExists = item?.openPath ? existsSync(item.openPath) : false;
  const openPathReady = item?.openPath ? openPathExists : true;
  const canConsiderAdvance =
    Boolean(item) &&
    allowedAdvanceDecision(item, decision) &&
    reviewedOpenPath &&
    reviewedValidationCommand &&
    openPathReady &&
    !forbiddenDecision;
  const queueItem = canConsiderAdvance ? queueItemFor(item, receiptRow) : null;
  const unsafeQueueItem = Boolean(queueItem) && !queueItem.safety.safeForReviewHandoff;
  const canAdvance = canConsiderAdvance && !unsafeQueueItem;
  return {
    itemId: receiptRow.itemId,
    title: item?.title || "",
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    reviewedOpenPath,
    reviewedValidationCommand,
    itemFound: Boolean(item),
    openPath: item?.openPath || "",
    openPathExists,
    validationCommand: item?.validationCommand || "",
    allowedTeacherDecisions: item?.allowedTeacherDecisions || [],
    status: !item
      ? "unknown_confirmation_item"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : unsafeQueueItem
          ? "blocked_for_unsafe_next_review_queue_item"
          : decision === "blocked_needs_more_evidence" || decision === "keep_blocked"
            ? "blocked_needs_more_evidence"
            : decision === "teacher_reviewed_opened"
              ? "teacher_reviewed_opened_waiting_for_source_receipt_decision"
              : canAdvance
                ? "ready_for_source_receipt_validation"
                : allowedAdvanceDecision(item, decision) && (!reviewedOpenPath || !reviewedValidationCommand)
                  ? "blocked_for_missing_teacher_review_flags"
                  : allowedAdvanceDecision(item, decision) && !openPathReady
                    ? "blocked_for_missing_openable_entry"
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
      ? "all_items_ready_for_source_receipt_validation"
      : readyRows.length > 0
        ? "some_items_ready_for_source_receipt_validation"
        : "needs_teacher_review";
const status = forbiddenDecisionUsed || unsafeQueueItemUsed
  ? "blocked"
  : readyRows.length > 0
    ? "validated_with_next_confirmation_review_queue"
    : "waiting_for_teacher_next_confirmation_review";
const validationPath = join(validationDir, "original-goal-next-confirmation-pack-receipt-validation.json");
const readmePath = join(validationDir, "ORIGINAL_GOAL_NEXT_CONFIRMATION_PACK_RECEIPT_VALIDATION_START_HERE.md");
const validationLocks = locks();

const validation = {
  ok: true,
  format: "transparent_ai_original_goal_next_confirmation_pack_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  sourceEvidence: {
    pack: packInput.path,
    receipt: receiptInput.path,
    packId: pack.packId || "",
    receiptPackId: receipt.packId || ""
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
    "execute_next_confirmation_pack_next_review_queue",
    "read_full_logs_from_next_confirmation_pack_validation",
    "capture_screenshots_from_next_confirmation_pack_validation",
    "register_schedule_from_next_confirmation_pack_validation",
    "launch_runner_from_next_confirmation_pack_validation",
    "execute_target_software_from_next_confirmation_pack_validation",
    "write_memory_from_next_confirmation_pack_validation",
    "claim_goal_complete_from_next_confirmation_pack_validation"
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
      format: "transparent_ai_original_goal_next_confirmation_pack_receipt_validation_result_v1",
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
