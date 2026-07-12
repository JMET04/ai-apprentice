#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "completion-blocker-lane-request-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "completion-blocker-lane-request-receipt-validation"
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

function placeholders(value) {
  const text = String(value || "");
  return Array.from(new Set([...(text.match(/<[^<>]+>/g) || []), ...(text.match(/__[A-Z0-9_]+__/g) || [])]));
}

function requestPlaceholderBlockers(request) {
  const command = String(request?.command || request?.commandTemplate || "");
  const declaredMissingInputs = Array.isArray(request?.missingInputs) ? request.missingInputs.filter(Boolean) : [];
  const commandPlaceholders = placeholders(command);
  const blockers = [];
  if (request?.placeholderReplacementRequired === true) blockers.push("request_placeholder_replacement_required");
  if (request?.hasPlaceholders === true) blockers.push("request_declares_unresolved_placeholders");
  if (declaredMissingInputs.length) blockers.push("request_missing_inputs_not_resolved");
  if (commandPlaceholders.length) blockers.push("request_command_contains_unresolved_placeholders");
  return Array.from(new Set(blockers));
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["ready_for_safe_lane_runner", "ready_for_runner", "teacher_confirmed_safe_lane"].includes(text)) {
    return "ready_for_safe_lane_runner";
  }
  if (["blocked", "blocked_needs_more_evidence", "needs_more_evidence"].includes(text)) {
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
    validationDoesNotRunLaneRunner: true,
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
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Completion Blocker Lane Request Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Lane: ${validation.lane}`,
    "",
    "Validation checks:",
    ...validation.validationRows.map((row) => `- ${row.name}: ${row.status}`),
    "",
    validation.nextRunnerCommand
      ? `Next safe runner command template: ${validation.nextRunnerCommand}`
      : "Next safe runner command template: <not generated>",
    "",
    "Safety boundary:",
    "- This validator only checks the teacher receipt and prepares a runner command template.",
    "- It does not run the lane runner, execute commands, register tasks, launch runners, execute target software, capture screenshots, write memory, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate one completion-blocker lane request teacher receipt.");
const requestInput = readJsonInput(
  argValue("--request", argValue("--lane-request", "")),
  "--request",
  "transparent_ai_original_goal_completion_blocker_lane_command_request_v1"
);
if (!requestInput.value) throw new Error("--request is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_completion_blocker_lane_request_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-lane-request-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const request = requestInput.value;
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
const laneMatches = String(receipt.lane || "") === String(request.lane || "");
const itemMatches =
  receipt.itemNumber === undefined ||
  receipt.itemNumber === null ||
  Number(receipt.itemNumber) === Number(request.itemNumber ?? receipt.itemNumber);
const evidenceReviewed = receipt.evidenceReviewed === true;
const placeholderBlockers = requestPlaceholderBlockers(request);
const missingInputsResolved =
  placeholderBlockers.length === 0 &&
  (receipt.missingInputsResolved === true ||
    (Array.isArray(request.missingInputs) && request.missingInputs.length === 0));
const rollbackPointRetained = receipt.rollbackPointRetained === true && Boolean(request.rollbackPoint || receipt.rollbackPoint);
const teacherConfirmation = String(receipt.teacherConfirmation || request.teacherNote || "").trim();
const gatedRequest = request.gated === true || String(request.status || "").includes("gated");
const runnable =
  !forbiddenDecision &&
  decision === "ready_for_safe_lane_runner" &&
  laneMatches &&
  itemMatches &&
  evidenceReviewed &&
  missingInputsResolved &&
  rollbackPointRetained &&
  teacherConfirmation &&
  !gatedRequest;

const validationRows = [
  { name: "decision", status: forbiddenDecision ? "blocked_for_forbidden_decision" : decision },
  { name: "lane_matches_request", status: laneMatches ? "matched" : "blocked_for_lane_mismatch" },
  { name: "item_matches_request", status: itemMatches ? "matched" : "blocked_for_item_mismatch" },
  { name: "evidence_reviewed", status: evidenceReviewed ? "reviewed" : "needs_teacher_review" },
  {
    name: "request_placeholders_resolved",
    status: placeholderBlockers.length ? `blocked:${placeholderBlockers.join(",")}` : "resolved"
  },
  { name: "missing_inputs_resolved", status: missingInputsResolved ? "resolved" : "blocked_for_missing_inputs" },
  { name: "rollback_point_retained", status: rollbackPointRetained ? "retained" : "blocked_for_missing_rollback" },
  { name: "teacher_confirmation", status: teacherConfirmation ? "present" : "blocked_for_missing_confirmation" },
  { name: "gated_request", status: gatedRequest ? "blocked_for_gated_lane" : "not_gated" }
];
const validationDecision = forbiddenDecision
  ? "blocked_for_forbidden_decision"
  : runnable
    ? "ready_for_safe_lane_runner_command"
    : decision === "blocked_needs_more_evidence"
      ? "blocked_needs_more_evidence"
      : "needs_teacher_review_or_missing_evidence";
const nextRunnerCommand = runnable
  ? commandLine("run-original-goal-completion-blocker-lane-request.mjs", [
      ["--request", requestInput.path],
      ["--run-reviewed-lane", "true"],
      ["--allow-safe-lane-runner", "true"],
      ["--teacher-confirmation", teacherConfirmation],
      ["--rollback-point-created", "true"],
      ["--rollback-point", request.rollbackPoint || receipt.rollbackPoint],
      ["--output-dir", join(validationDir, "completion-blocker-lane-request-run")]
    ])
  : "";
const reviewLocks = locks();
const validationPath = join(validationDir, "completion-blocker-lane-request-receipt-validation.json");
const readmePath = join(validationDir, "COMPLETION_BLOCKER_LANE_REQUEST_RECEIPT_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format: "transparent_ai_original_goal_completion_blocker_lane_request_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status: validationDecision,
  validationDecision,
  lane: request.lane || "",
  requestPath: requestInput.path,
  receiptPath: receiptInput.path,
  validationRows,
  nextRunnerCommand,
  blockedActions: [
    "run_lane_runner_from_receipt_validation",
    "execute_target_software_from_receipt_validation",
    "capture_screenshot_from_receipt_validation",
    "write_memory_from_receipt_validation",
    "claim_goal_complete_from_receipt_validation"
  ],
  locks: reviewLocks,
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
      format: "transparent_ai_original_goal_completion_blocker_lane_request_receipt_validation_result_v1",
      validationPath,
      readmePath,
      status: validation.status,
      validationDecision,
      nextRunnerCommandReady: Boolean(nextRunnerCommand),
      nextRunnerCommand,
      locks: reviewLocks
    },
    null,
    2
  )
);

if (forbiddenDecision) process.exit(1);
