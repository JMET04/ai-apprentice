#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "coverage-enrollment-follow-up-handoff-queue")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "coverage-enrollment-follow-up-handoff-queue"
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

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function commandPlaceholders(command) {
  return Array.from(new Set(String(command || "").match(/<[^<>]+>/g) || []));
}

function commandSafety(command) {
  const lower = String(command || "").toLowerCase();
  const forbiddenMarkers = [
    "--execute",
    "-execute",
    " execute-mode ",
    " run_execute_mode ",
    "capture_screenshot",
    "capture-screenshot",
    "register-scheduledtask",
    "schtasks /create",
    "write_memory",
    "claim_complete",
    "native_universal_execution",
    "unlock_packaging"
  ];
  const matchedForbiddenMarkers = forbiddenMarkers.filter((marker) => lower.includes(marker));
  return {
    safeForManualReviewHandoff: matchedForbiddenMarkers.length === 0,
    matchedForbiddenMarkers
  };
}

function classifyCommand(command) {
  const text = String(command || "");
  if (!text) return "missing_handoff_target";
  if (text.includes("run-all-software-coverage-enrollment-follow-up-batch.mjs")) {
    return "reviewed_low_token_batch_command";
  }
  if (text.includes("reconcile-all-software-coverage-enrollment-follow-up-batch.mjs")) {
    return "post_batch_reconciliation_command";
  }
  if (text.includes("validate-") || text.includes("validate_")) return "downstream_receipt_validation";
  if (existsSync(text)) return "open_review_entry";
  return "manual_review_command";
}

function writeReadme(path, queue) {
  const lines = [
    "# Coverage Enrollment Follow-Up Handoff Queue",
    "",
    `Status: ${queue.status}`,
    `Decision: ${queue.queueDecision}`,
    `Queue items: ${queue.counts.queueItems}`,
    `Review scope: ${queue.reviewScope?.scopeKind || "unspecified"}`,
    `Batch scope: ${queue.reviewBatchScope?.mode || "unspecified"} (${queue.reviewBatchScope?.includedRows ?? 0} of ${queue.reviewBatchScope?.totalFollowUpRows ?? 0} rows)`,
    queue.reviewBatchScope?.omittedRows
      ? `Omitted rows still waiting for later review: ${queue.reviewBatchScope.omittedRows}`
      : "",
    "",
    "This queue turns a validated coverage-enrollment follow-up receipt into manual next steps.",
    "",
    "Safety boundary:",
    "- This queue does not run the enrollment follow-up batch.",
    "- It does not read logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "- Batch commands stay manual and are blocked if unsafe execute/screenshot/schedule/memory markers are present.",
    "",
    "Items:"
  ];
  for (const item of queue.queueItems) {
    lines.push(
      `${item.number}. ${item.kind}: ${item.label}`,
      `   Command: ${item.command || item.openPath || "none"}`,
      `   Status: ${item.status}`,
      `   Placeholders: ${item.placeholders.length ? item.placeholders.join(", ") : "none"}`
    );
  }
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Create a manual handoff queue from coverage enrollment follow-up validation.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--receipt-validation", "")),
  "--validation",
  "transparent_ai_all_software_coverage_enrollment_follow_up_receipt_validation_v1"
);
if (!validationInput.value) throw new Error("--validation is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-handoff-queues")
  )
);
mkdirSync(outputRoot, { recursive: true });
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const queueDir = join(outputRoot, queueId);
mkdirSync(queueDir, { recursive: true });

const validation = validationInput.value;
const queuePath = join(queueDir, "all-software-coverage-enrollment-follow-up-handoff-queue.json");
const htmlPath = join(queueDir, "all-software-coverage-enrollment-follow-up-handoff-queue.html");
const readmePath = join(queueDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_HANDOFF_QUEUE_START_HERE.md");

const sourceReadme = validation.paths?.readme || "";
const commands = Array.isArray(validation.nextBatchReviewCommands) ? validation.nextBatchReviewCommands : [];
const reviewScope = validation.reviewScope || null;
const reviewBatchScope = validation.reviewBatchScope || null;
const queueItems = [];

if (sourceReadme) {
  queueItems.push({
    number: queueItems.length + 1,
    id: "open_validation_readme",
    kind: existsSync(sourceReadme) ? "open_review_entry" : "missing_handoff_target",
    label: "Open coverage enrollment follow-up validation README before any reviewed batch command",
    openPath: sourceReadme,
    openUrl: existsSync(sourceReadme) ? fileHref(sourceReadme) : "",
    command: sourceReadme,
    placeholders: [],
    status: existsSync(sourceReadme) ? "ready_for_manual_review" : "missing_validation_readme",
    safeForManualReviewHandoff: existsSync(sourceReadme),
    matchedForbiddenMarkers: []
  });
}

for (const command of commands) {
  const commandLine = command.commandLine || "";
  const safety = commandSafety(commandLine);
  const placeholders = commandPlaceholders(commandLine);
  queueItems.push({
    number: queueItems.length + 1,
    id: `coverage_follow_up_batch_${queueItems.length + 1}`,
    kind: classifyCommand(commandLine),
    label: command.tool || "run_all_software_coverage_enrollment_follow_up_batch",
    command: commandLine,
    arguments: command.arguments || {},
    reviewScope,
    readyFollowUpIds: command.readyFollowUpIds || [],
    placeholders,
    status: !safety.safeForManualReviewHandoff
      ? "blocked_unsafe_command_marker"
      : placeholders.length
        ? "waiting_for_teacher_placeholder_resolution"
        : "ready_for_manual_review_handoff",
    safeForManualReviewHandoff: safety.safeForManualReviewHandoff,
    matchedForbiddenMarkers: safety.matchedForbiddenMarkers,
    executesNow: false,
    blockedUntil: command.blockedUntil || "teacher explicitly runs the reviewed enrollment follow-up batch command"
  });
}

const unsafeItems = queueItems.filter((item) => item.safeForManualReviewHandoff === false);
const placeholderItems = queueItems.filter((item) => item.placeholders.length > 0);
const readyItems = queueItems.filter(
  (item) => item.safeForManualReviewHandoff && item.placeholders.length === 0 && item.kind !== "missing_handoff_target"
);
const batchHandoffItems = queueItems.filter((item) => item.kind === "reviewed_low_token_batch_command");
const readyBatchHandoffItems = batchHandoffItems.filter(
  (item) => item.safeForManualReviewHandoff && item.placeholders.length === 0
);
const queueDecision = unsafeItems.length
  ? "blocked_until_unsafe_handoffs_are_removed"
  : readyBatchHandoffItems.length
    ? "manual_low_token_batch_handoffs_ready"
    : placeholderItems.length && batchHandoffItems.length
      ? "waiting_for_teacher_placeholder_resolution"
      : "waiting_for_teacher_enrollment_follow_up_review";
const status = unsafeItems.length ? "blocked" : readyBatchHandoffItems.length ? "ready_for_manual_review" : "waiting_for_teacher_review";
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  queueDoesNotRunBatch: true,
  queueDoesNotReadLogs: true,
  queueDoesNotCaptureScreenshots: true,
  queueDoesNotExecuteTargetSoftware: true,
  queueDoesNotRegisterSchedule: true,
  queueDoesNotWriteMemory: true,
  batchRunnerInvoked: false,
  allSoftwareCoverageComplete: false,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  logContentsRead: false,
  fileContentsRead: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  scheduledTaskInstalled: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  goalComplete: false
};
const queue = {
  ok: true,
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_v1",
  queueId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  queueDecision,
  sourceValidation: validationInput.path,
  sourceValidationDecision: validation.validationDecision || "",
  reviewScope,
  reviewBatchScope,
  counts: {
    queueItems: queueItems.length,
    readyItems: readyBatchHandoffItems.length,
    placeholderItems: placeholderItems.length,
    unsafeItems: unsafeItems.length,
    readyFollowUpRows: validation.readyRowCount || 0,
    waitingFollowUpRows: validation.waitingRowCount || 0,
    omittedFollowUpRows: validation.omittedRowCount || reviewBatchScope?.omittedRows || 0
  },
  queueItems,
  nextTeacherActions: readyBatchHandoffItems.length
    ? [
        "Open the validation README first.",
        "Resolve placeholders if any remain.",
        "Run at most one reviewed low-token batch handoff manually, then reconcile its receipt before claiming progress."
      ]
    : [
        "Return to the coverage enrollment follow-up receipt builder.",
        "Ask the teacher to review at least one follow-up row.",
        "Validate the teacher-filled receipt again before creating a new handoff queue."
      ],
  blockedTransitions: [
    "run_enrollment_follow_up_batch_from_queue",
    "allow_bounded_tail_from_queue",
    "capture_screenshot_from_queue",
    "execute_target_software_from_queue",
    "register_schedule_from_queue",
    "write_memory_from_queue",
    "claim_all_software_coverage_complete_from_queue"
  ],
  paths: {
    queue: queuePath,
    html: htmlPath,
    readme: readmePath,
    sourceValidation: validationInput.path
  },
  locks
};

writeReadme(readmePath, queue);
writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Coverage Enrollment Follow-Up Handoff Queue</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    .panel, .item { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .grid { display: grid; gap: 14px; margin-top: 16px; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .danger { background: #fff1f0; color: #a4382b; }
  </style>
</head>
<body>
  <main>
    <h1>Coverage Enrollment Follow-Up Handoff Queue</h1>
    <p>${htmlEscape(goal)}</p>
    <section class="panel">
      <p><span class="badge">${htmlEscape(status)}</span> <span class="badge">${htmlEscape(queueDecision)}</span></p>
      <p>Review scope: <code>${htmlEscape(reviewScope?.scopeKind || "unspecified")}</code></p>
      <p>Batch scope: <code>${htmlEscape(reviewBatchScope?.mode || "unspecified")}</code> (${htmlEscape(reviewBatchScope?.includedRows ?? 0)} of ${htmlEscape(reviewBatchScope?.totalFollowUpRows ?? 0)} rows)</p>
      ${
        reviewBatchScope?.omittedRows
          ? `<p>${htmlEscape(reviewBatchScope.omittedRows)} omitted rows remain waiting for later teacher review.</p>`
          : ""
      }
      <p>This page lists manual next steps only. It does not run the batch, read logs, screenshot, execute software, install schedules, write memory, or claim completion.</p>
    </section>
    <section class="grid">
      ${queueItems
        .map(
          (item) => `<article class="item">
        <h2>${item.number}. ${htmlEscape(item.label)}</h2>
        <p><span class="badge ${item.safeForManualReviewHandoff ? "" : "danger"}">${htmlEscape(item.status)}</span></p>
        <p>Kind: <code>${htmlEscape(item.kind)}</code></p>
        ${
          item.openUrl
            ? `<p><a href="${htmlEscape(item.openUrl)}">Open review file</a></p>`
            : `<p>Command: <code>${htmlEscape(item.command || "")}</code></p>`
        }
        <p>Placeholders: <code>${htmlEscape(item.placeholders.length ? item.placeholders.join(", ") : "none")}</code></p>
        <p>Forbidden markers: <code>${htmlEscape(item.matchedForbiddenMarkers.length ? item.matchedForbiddenMarkers.join(", ") : "none")}</code></p>
      </article>`
        )
        .join("\n")}
    </section>
  </main>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_result_v1",
      status,
      queueDecision,
      queuePath,
      htmlPath,
      readmePath,
      readyItems: readyItems.length,
      placeholderItems: placeholderItems.length,
      unsafeItems: unsafeItems.length,
      reviewScope,
      reviewBatchScope,
      batchRunnerInvoked: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false,
      allSoftwareCoverageComplete: false,
      locks
    },
    null,
    2
  )
);
