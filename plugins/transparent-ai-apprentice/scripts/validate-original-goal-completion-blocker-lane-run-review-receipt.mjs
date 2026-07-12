#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "completion-blocker-lane-run-review-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "completion-blocker-lane-run-review-receipt-validation"
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

function q(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, q(value));
  }
  return parts.join(" ");
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["lane_run_reviewed", "reviewed_lane_run", "teacher_reviewed_lane_run"].includes(text)) {
    return "lane_run_reviewed";
  }
  if (["ready_for_next_status_refresh", "refresh_current_status", "continue_review"].includes(text)) {
    return "ready_for_next_status_refresh";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) {
    return "blocked_needs_more_evidence";
  }
  if (
    [
      "accepted",
      "execute_now",
      "register_now",
      "run_execute_mode",
      "capture_screenshot_now",
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

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRerunLane: true,
    validationDoesNotRunCommands: true,
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
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Completion Blocker Lane Run Review Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Lane: ${validation.lane}`,
    "",
    "Validation checks:",
    ...validation.validationRows.map((row) => `- ${row.name}: ${row.status}`),
    "",
    validation.nextStatusRefreshCommand
      ? `Next review-only status refresh command: ${validation.nextStatusRefreshCommand}`
      : "Next review-only status refresh command: <not generated>",
    "",
    "Safety boundary:",
    "- This validator only checks the teacher review receipt for one lane run.",
    "- It does not rerun the lane, execute commands, register tasks, launch runners, execute target software, capture screenshots, write memory, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate one completion-blocker lane run teacher review receipt.");
const builderInput = readJsonInput(
  argValue("--builder", argValue("--run-review-builder", "")),
  "--builder",
  "transparent_ai_original_goal_completion_blocker_lane_run_review_receipt_builder_v1"
);
if (!builderInput.value) throw new Error("--builder is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_completion_blocker_lane_run_review_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-lane-run-review-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const builder = builderInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecision = [
  "accepted",
  "execute_now",
  "register_now",
  "run_execute_mode",
  "capture_screenshot_now",
  "memory_enabled",
  "claim_complete",
  "native_universal_execution",
  "unlock_packaging"
].includes(decision);
const laneMatches = String(receipt.lane || "") === String(builder.runSummary?.lane || "");
const runStatusMatches = String(receipt.runStatus || "") === String(builder.runSummary?.status || "");
const evidenceReviewed = receipt.evidenceReviewed === true;
const outcomeMatches = receipt.runOutcomeMatchesExpectedLane === true;
const rollbackRetained = receipt.rollbackPointStillRetained === true;
const preserveBlockerIfMismatch = receipt.preserveBlockerIfMismatch !== false;
const teacherConfirmation = String(receipt.teacherConfirmation || "").trim();
const positiveDecision = ["lane_run_reviewed", "ready_for_next_status_refresh"].includes(decision);
const reviewed =
  !forbiddenDecision &&
  positiveDecision &&
  laneMatches &&
  runStatusMatches &&
  evidenceReviewed &&
  outcomeMatches &&
  rollbackRetained &&
  preserveBlockerIfMismatch &&
  teacherConfirmation;

const validationRows = [
  { name: "decision", status: forbiddenDecision ? "blocked_for_forbidden_decision" : decision },
  { name: "lane_matches_builder", status: laneMatches ? "matched" : "blocked_for_lane_mismatch" },
  { name: "run_status_matches_builder", status: runStatusMatches ? "matched" : "blocked_for_run_status_mismatch" },
  { name: "evidence_reviewed", status: evidenceReviewed ? "reviewed" : "needs_teacher_review" },
  { name: "run_outcome_matches_expected_lane", status: outcomeMatches ? "matched" : "blocked_for_unmatched_outcome" },
  { name: "rollback_point_still_retained", status: rollbackRetained ? "retained" : "blocked_for_missing_rollback" },
  { name: "preserve_blocker_if_mismatch", status: preserveBlockerIfMismatch ? "preserved" : "blocked_for_unlocked_mismatch" },
  { name: "teacher_confirmation", status: teacherConfirmation ? "present" : "blocked_for_missing_confirmation" }
];
const validationDecision = forbiddenDecision
  ? "blocked_for_forbidden_decision"
  : reviewed
    ? "completion_blocker_lane_run_reviewed_for_next_status_refresh"
    : decision === "blocked_needs_more_evidence"
      ? "blocked_needs_more_evidence"
      : "needs_teacher_review_or_missing_evidence";
const nextStatusRefreshCommand = reviewed
  ? commandLine("create-original-goal-current-status-refresh.mjs", [
      ["--goal", argValue("--refresh-goal", builder.goal || goal)]
    ])
  : "";
const validationPath = join(validationDir, "completion-blocker-lane-run-review-receipt-validation.json");
const readmePath = join(validationDir, "COMPLETION_BLOCKER_LANE_RUN_REVIEW_RECEIPT_VALIDATION_START_HERE.md");
const reviewLocks = locks();
const validation = {
  ok: true,
  format: "transparent_ai_original_goal_completion_blocker_lane_run_review_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status: reviewed
    ? "completion_blocker_lane_run_reviewed_waiting_for_current_status_refresh"
    : "blocked_until_teacher_reviews_completion_blocker_lane_run",
  validationDecision,
  lane: builder.runSummary?.lane || "",
  sourceBuilder: builderInput.path,
  sourceReceipt: receiptInput.path,
  validationRows,
  nextStatusRefreshCommand,
  blockedTransitions: [
    "rerun_completion_blocker_lane_from_validation",
    "register_schedule_from_lane_run_review",
    "launch_runner_from_lane_run_review",
    "execute_target_software_from_lane_run_review",
    "capture_screenshot_from_lane_run_review",
    "write_memory_from_lane_run_review",
    "claim_goal_complete_from_lane_run_review",
    "unlock_packaging_from_lane_run_review"
  ],
  paths: {
    validation: validationPath,
    readme: readmePath,
    validationDir
  },
  locks: reviewLocks
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);
console.log(JSON.stringify(validation, null, 2));

if (forbiddenDecision) process.exit(1);
