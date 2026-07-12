#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-proof-gap-teacher-queue-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-proof-gap-teacher-queue-receipt-validation"
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

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value ?? "").trim();
}

function normalizeDecision(value) {
  const decision = text(value || "needs_teacher_evidence").toLowerCase();
  if (["teacher_evidence_attached", "evidence_attached", "ready_for_follow_up"].includes(decision)) {
    return "teacher_evidence_attached";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(decision)) return "blocked";
  if (
    [
      "accepted",
      "rule_enabled",
      "technology_accepted",
      "goal_complete",
      "execute_now",
      "register_now",
      "launch_runner",
      "capture_screenshot",
      "write_memory",
      "unlock_packaging"
    ].includes(decision)
  ) {
    return decision;
  }
  return "needs_teacher_evidence";
}

function commandPlaceholders(value) {
  return Array.from(new Set(String(value || "").match(/<[^<>]+>/g) || []));
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRunCommands: true,
    validationDoesNotRegisterTask: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotEnableRules: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function evidenceOk(row, item) {
  const observedEvidence = text(row.observedEvidencePath);
  const teacherConfirmation = text(row.teacherConfirmationText);
  const notes = text(row.teacherNotes);
  const hasBasicEvidence = Boolean(observedEvidence || teacherConfirmation || notes);
  const targetNeeded = item.phase === "transparent_overlay_spatial_depth" || item.phase === "teacher_confirmed_target_software_execution";
  const rollbackNeeded =
    row.requiresRetainedRollbackPoint === true ||
    item.routeId === "teacher_confirmed_registration_route" ||
    item.phase === "teacher_confirmed_target_software_execution";
  const teacherConfirmationNeeded = item.blockedUntilTeacher === true || array(item.highRiskMarkers).length > 0;
  const selectedTargetOk = !targetNeeded || text(row.selectedNumberedTarget);
  const rollbackOk = !rollbackNeeded || text(row.retainedRollbackPoint);
  const teacherConfirmationOk = !teacherConfirmationNeeded || teacherConfirmation;
  return {
    hasBasicEvidence,
    targetNeeded,
    selectedTargetOk,
    rollbackNeeded,
    rollbackOk,
    teacherConfirmationNeeded,
    teacherConfirmationOk,
    ok: hasBasicEvidence && selectedTargetOk && rollbackOk && teacherConfirmationOk
  };
}

function nextReviewItem(item, receiptRow, validationRow, index) {
  return {
    order: index + 1,
    itemNumber: item.itemNumber,
    phase: item.phase,
    routeId: item.routeId,
    requirementId: item.requirementId,
    teacherQuestion: item.teacherQuestion,
    verificationCommandTemplate: item.verificationCommandTemplate || "",
    commandPlaceholders: commandPlaceholders(item.verificationCommandTemplate),
    observedEvidencePath: receiptRow.observedEvidencePath || "",
    selectedNumberedTarget: receiptRow.selectedNumberedTarget || "",
    retainedRollbackPoint: receiptRow.retainedRollbackPoint || "",
    teacherConfirmationText: receiptRow.teacherConfirmationText || "",
    teacherNotes: receiptRow.teacherNotes || "",
    status: "ready_for_manual_next_review_route",
    canRunAutomatically: false,
    blockedActions: validationRow.blockedActions
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Original Goal Proof Gap Teacher Queue Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Ready rows: ${validation.counts.readyRows}/${validation.counts.receiptRows}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row) => `- ${row.itemNumber}. ${row.routeId}: ${row.status}`),
    "",
    "Next review queue:",
    ...validation.nextReviewQueue.map(
      (row) => `- ${row.order}. ${row.phase}: ${row.routeId}; ${row.verificationCommandTemplate || "(open evidence)"}`
    ),
    "",
    "Safety boundary:",
    "- This validation does not execute generated commands.",
    "- It does not register scheduled tasks, launch runners, execute target software, capture screenshots, read full logs, write memory, enable rules, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate original-goal proof gap teacher queue receipt.");
const queueInput = readJsonInput(
  argValue("--queue", argValue("--teacher-queue", "")),
  "--queue",
  "transparent_ai_original_goal_proof_gap_teacher_queue_v1"
);
if (!queueInput.value) throw new Error("--queue is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-proof-gap-teacher-queue-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const queue = queueInput.value;
const receipt = receiptInput.value;
const queueByNumber = new Map(array(queue.queueItems).map((item) => [Number(item.itemNumber), item]));
const queueByRoute = new Map(array(queue.queueItems).map((item) => [String(item.routeId), item]));
const forbiddenDecisions = new Set([
  "accepted",
  "rule_enabled",
  "technology_accepted",
  "goal_complete",
  "execute_now",
  "register_now",
  "launch_runner",
  "capture_screenshot",
  "write_memory",
  "unlock_packaging",
  ...array(receipt.forbiddenDecisions)
]);

const validationRows = array(receipt.rows).map((receiptRow) => {
  const item = queueByNumber.get(Number(receiptRow.itemNumber)) || queueByRoute.get(String(receiptRow.routeId));
  const decision = normalizeDecision(receiptRow.decision);
  const forbiddenDecision = forbiddenDecisions.has(decision);
  const evidence = item ? evidenceOk(receiptRow, item) : { ok: false };
  const ready = Boolean(item) && decision === "teacher_evidence_attached" && evidence.ok && !forbiddenDecision;
  const blockedActions = [
    "run_verification_command_from_teacher_queue_validation",
    "register_schedule_from_teacher_queue_validation",
    "launch_runner_from_teacher_queue_validation",
    "execute_target_software_from_teacher_queue_validation",
    "capture_screenshot_from_teacher_queue_validation",
    "read_full_logs_from_teacher_queue_validation",
    "write_memory_from_teacher_queue_validation",
    "claim_goal_complete_from_teacher_queue_validation"
  ];
  return {
    itemNumber: receiptRow.itemNumber,
    routeId: receiptRow.routeId || item?.routeId || "",
    requirementId: receiptRow.requirementId || item?.requirementId || "",
    phase: item?.phase || "",
    normalizedDecision: decision,
    forbiddenDecision,
    rowFound: Boolean(item),
    evidence,
    observedEvidencePath: receiptRow.observedEvidencePath || "",
    selectedNumberedTarget: receiptRow.selectedNumberedTarget || "",
    retainedRollbackPoint: receiptRow.retainedRollbackPoint || "",
    teacherConfirmationText: receiptRow.teacherConfirmationText || "",
    teacherNotes: receiptRow.teacherNotes || "",
    status: !item
      ? "unknown_teacher_queue_item"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : decision === "blocked"
          ? "blocked_by_teacher"
          : decision !== "teacher_evidence_attached"
            ? "needs_teacher_evidence"
            : evidence.ok
              ? "ready_for_manual_next_review_route"
              : "blocked_for_missing_required_teacher_evidence",
    ready,
    blockedActions
  };
});

const readyRows = validationRows.filter((row) => row.ready);
const blockedRows = validationRows.filter((row) => row.status.startsWith("blocked_"));
const waitingRows = validationRows.filter((row) => !row.ready && !row.status.startsWith("blocked_"));
const nextReviewQueue = readyRows.map((row, index) => {
  const item = queueByNumber.get(Number(row.itemNumber)) || queueByRoute.get(String(row.routeId));
  const receiptRow = array(receipt.rows).find(
    (candidate) => Number(candidate.itemNumber) === Number(row.itemNumber) || candidate.routeId === row.routeId
  );
  return nextReviewItem(item, receiptRow || {}, row, index);
});

const forbiddenDecisionUsed = validationRows.some((row) => row.forbiddenDecision);
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyRows.length > 0 && waitingRows.length === 0 && blockedRows.length === 0
    ? "all_rows_ready_for_manual_next_review"
    : readyRows.length > 0
      ? "some_rows_ready_for_manual_next_review"
      : blockedRows.length > 0
        ? "blocked_or_waiting_for_teacher_evidence"
        : "needs_teacher_evidence";
const status = forbiddenDecisionUsed
  ? "blocked"
  : readyRows.length > 0
    ? "validated_with_manual_next_review_queue"
    : "waiting_for_teacher_evidence";

const validationPath = join(validationDir, "original-goal-proof-gap-teacher-queue-receipt-validation.json");
const readmePath = join(validationDir, "ORIGINAL_GOAL_PROOF_GAP_TEACHER_QUEUE_RECEIPT_VALIDATION_START_HERE.md");
const lockState = locks();
const validation = {
  ok: !forbiddenDecisionUsed,
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  sourceEvidence: {
    queue: queueInput.path,
    receipt: receiptInput.path,
    closurePack: queue.sourceEvidence?.closurePack || "",
    proofLedger: queue.sourceEvidence?.proofLedger || ""
  },
  counts: {
    receiptRows: validationRows.length,
    readyRows: readyRows.length,
    waitingRows: waitingRows.length,
    blockedRows: blockedRows.length,
    nextReviewQueue: nextReviewQueue.length
  },
  validationRows,
  nextReviewQueue,
  completionBoundary: {
    completionAllowed: false,
    reason: "Validated rows may enter manual next-review routes only. This validator does not run commands or prove the original goal complete."
  },
  locks: lockState,
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
      ok: validation.ok,
      format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_validation_result_v1",
      validationPath,
      readmePath,
      status,
      validationDecision,
      readyRows: readyRows.length,
      nextReviewQueue: nextReviewQueue.length,
      locks: lockState
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
