#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-teacher-action-router-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-teacher-action-router-receipt-validation"
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
  if (["ready_for_downstream_validation", "ready_for_follow_up", "teacher_reviewed_continue"].includes(text)) {
    return "ready_for_downstream_validation";
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
  const value = String(command || "");
  const lower = value.toLowerCase();
  const forbiddenMarkers = [
    "--teacher-reviewed",
    "--teacher-confirmed",
    "--execute",
    "-teacherconfirmed",
    "-execute",
    " execute-mode ",
    " run_execute_mode ",
    "register-scheduledtask",
    "schtasks /create"
  ];
  const matchedForbiddenMarkers = forbiddenMarkers.filter((marker) => lower.includes(marker));
  return {
    safeForReviewHandoff: matchedForbiddenMarkers.length === 0,
    matchedForbiddenMarkers,
    reason: matchedForbiddenMarkers.length
      ? "handoff contains direct teacher-reviewed, execute, registration, or system-change markers"
      : "handoff is an open/review/validation step"
  };
}

function handoffFor(row) {
  const validationCommand = row.validationCommand || "";
  return {
    id: `router_handoff_${row.id}`,
    label: validationCommand
      ? `Validate downstream receipt for ${row.reviewEntryId || row.id}`
      : `Open review entry for ${row.reviewEntryId || row.id}`,
    command: validationCommand || row.openPath || "",
    openPath: row.openPath || "",
    executesNow: false,
    sourceRouteRowId: row.id,
    reviewEntryId: row.reviewEntryId || "",
    lane: row.lane || ""
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Original Goal Teacher Action Router Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.id}: ${row.status}`),
    "",
    "Next review handoffs:",
    ...validation.nextReviewHandoffs.map((handoff, index) => `${index + 1}. ${handoff.label}: ${handoff.command}`),
    "",
    "Safety boundary:",
    "- This validation does not execute generated commands.",
    "- It does not register scheduled tasks, launch runners, execute target software, capture screenshots, write memory, enable rules, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate original-goal teacher action router receipt.");
const routerInput = readJsonInput(
  argValue("--router", argValue("--teacher-action-router", "")),
  "--router",
  "transparent_ai_original_goal_teacher_action_router_v1"
);
if (!routerInput.value) throw new Error("--router is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_teacher_action_router_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-teacher-action-router-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const router = routerInput.value;
const receipt = receiptInput.value;
const routeRows = new Map((router.routeRows || []).map((row) => [row.id, row]));
const forbidden = new Set([
  "accepted",
  "execute_now",
  "register_now",
  "run_execute_mode",
  "memory_enabled",
  "claim_complete",
  "native_universal_execution",
  "unlock_packaging",
  ...(router.blockedActions || []),
  ...(receipt.blockedActions || [])
]);

const validationRows = (receipt.rowDecisions || []).map((receiptRow) => {
  const routeRow = routeRows.get(receiptRow.id);
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const openPathExists = routeRow?.openPath ? existsSync(routeRow.openPath) : false;
  const openPathReady = routeRow?.openPath ? openPathExists : true;
  const handoff = routeRow ? handoffFor(routeRow) : null;
  const handoffSafety = commandSafety(handoff?.command || "");
  const unsafeHandoff = Boolean(handoff?.command) && !handoffSafety.safeForReviewHandoff;
  const canAdvance =
    Boolean(routeRow) &&
    decision === "ready_for_downstream_validation" &&
    evidenceReviewed &&
    openPathReady &&
    !forbiddenDecision &&
    !unsafeHandoff;
  return {
    id: receiptRow.id,
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    evidenceReviewed,
    observedEvidencePath: receiptRow.observedEvidencePath || "",
    routeRowFound: Boolean(routeRow),
    lane: routeRow?.lane || "unknown",
    reviewEntryId: routeRow?.reviewEntryId || "unknown",
    openPath: routeRow?.openPath || "",
    openPathExists,
    status: !routeRow
      ? "unknown_router_row"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : unsafeHandoff
          ? "blocked_for_unsafe_downstream_command"
          : decision === "blocked_needs_more_evidence"
            ? "blocked_needs_more_evidence"
            : decision === "teacher_reviewed_opened"
              ? "teacher_reviewed_opened_waiting_for_downstream_validation_decision"
              : canAdvance
                ? "ready_for_downstream_validation"
                : decision === "ready_for_downstream_validation" && !openPathReady
                  ? "blocked_for_missing_openable_entry"
                  : "needs_teacher_review",
    canAdvance,
    nextReviewHandoff: canAdvance ? handoff : null,
    handoffSafety
  };
});

const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const unsafeHandoffUsed = validationRows.some((row) => row.status === "blocked_for_unsafe_downstream_command");
const readyRows = validationRows.filter((row) => row.canAdvance);
const blockedRows = validationRows.filter((row) => row.status.startsWith("blocked_"));
const waitingRows = validationRows.filter((row) => !row.canAdvance && !row.status.startsWith("blocked_"));
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : unsafeHandoffUsed
    ? "blocked_for_unsafe_downstream_command"
    : readyRows.length > 0 && waitingRows.length === 0 && blockedRows.length === 0
      ? "all_rows_ready_for_downstream_validation"
      : readyRows.length > 0
        ? "some_rows_ready_for_downstream_validation"
        : "needs_teacher_review";
const status = forbiddenDecisionUsed || unsafeHandoffUsed
  ? "blocked"
  : readyRows.length > 0
    ? "validated_with_review_handoffs"
    : "waiting_for_teacher_router_review";
const nextReviewHandoffs = readyRows.map((row) => row.nextReviewHandoff);
const validationPath = join(validationDir, "original-goal-teacher-action-router-receipt-validation.json");
const readmePath = join(validationDir, "ORIGINAL_GOAL_TEACHER_ACTION_ROUTER_RECEIPT_VALIDATION_START_HERE.md");
const locks = {
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

const validation = {
  ok: true,
  format: "transparent_ai_original_goal_teacher_action_router_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  sourceEvidence: {
    router: routerInput.path,
    receipt: receiptInput.path,
    routerId: router.routerId || "",
    receiptRouterId: receipt.routerId || ""
  },
  counts: {
    receiptRows: validationRows.length,
    readyRows: readyRows.length,
    waitingRows: waitingRows.length,
    blockedRows: blockedRows.length,
    nextReviewHandoffs: nextReviewHandoffs.length
  },
  forbiddenDecisionUsed,
  unsafeHandoffUsed,
  validationRows,
  nextReviewHandoffs,
  blockedActions: [
    "execute_router_handoff_from_validation",
    "register_scheduled_task_from_validation",
    "launch_runner_from_validation",
    "execute_target_software_from_validation",
    "capture_screenshot_from_validation",
    "write_memory_from_validation",
    "claim_goal_complete_from_validation"
  ],
  locks,
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
      format: "transparent_ai_original_goal_teacher_action_router_receipt_validation_result_v1",
      validationPath,
      readmePath,
      status,
      validationDecision,
      readyRows: readyRows.length,
      nextReviewHandoffs: nextReviewHandoffs.length,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed || unsafeHandoffUsed) process.exit(1);
