#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "coverage-rollout-handoff-queue")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "coverage-rollout-handoff-queue"
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
  if (text.includes("run-all-software-coverage-rollout-supervisor.mjs")) {
    return "reviewed_coverage_rollout_supervisor_command";
  }
  if (text.includes("run-all-software-coverage-rollout-batch.mjs")) {
    return "reviewed_coverage_rollout_batch_command";
  }
  if (text.includes("create-all-software-coverage-convergence-audit.mjs")) {
    return "post_rollout_convergence_audit_command";
  }
  if (text.includes("validate-") || text.includes("validate_")) return "downstream_receipt_validation";
  if (existsSync(text)) return "open_review_entry";
  return "manual_review_command";
}

function writeReadme(path, queue) {
  const lines = [
    "# All-Software Coverage Rollout Handoff Queue",
    "",
    `Status: ${queue.status}`,
    `Decision: ${queue.queueDecision}`,
    `Queue items: ${queue.counts.queueItems}`,
    "",
    "This queue turns a validated coverage rollout receipt into manual next steps.",
    "",
    "Safety boundary:",
    "- This queue does not run the coverage rollout supervisor or batch runner.",
    "- It does not read logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "- Rollout commands stay manual and are blocked if unsafe execute/screenshot/schedule/memory markers are present.",
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

const goal = argValue("--goal", "Create a manual handoff queue from coverage rollout validation.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--receipt-validation", "")),
  "--validation",
  "transparent_ai_all_software_coverage_rollout_receipt_validation_v1"
);
if (!validationInput.value) throw new Error("--validation is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-rollout-handoff-queues"))
);
mkdirSync(outputRoot, { recursive: true });
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const queueDir = join(outputRoot, queueId);
mkdirSync(queueDir, { recursive: true });

const validation = validationInput.value;
const queuePath = join(queueDir, "all-software-coverage-rollout-handoff-queue.json");
const htmlPath = join(queueDir, "all-software-coverage-rollout-handoff-queue.html");
const readmePath = join(queueDir, "ALL_SOFTWARE_COVERAGE_ROLLOUT_HANDOFF_QUEUE_START_HERE.md");

const sourceReadme = validation.paths?.readme || "";
const commands = Array.isArray(validation.nextReviewCommands) ? validation.nextReviewCommands : [];
const queueItems = [];

if (sourceReadme) {
  queueItems.push({
    number: queueItems.length + 1,
    id: "open_validation_readme",
    kind: existsSync(sourceReadme) ? "open_review_entry" : "missing_handoff_target",
    label: "Open coverage rollout validation README before any reviewed rollout command",
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
    id: `coverage_rollout_handoff_${queueItems.length + 1}`,
    kind: classifyCommand(commandLine),
    label: command.tool || "run_all_software_coverage_rollout_supervisor",
    command: commandLine,
    arguments: command.arguments || {},
    batchId: command.batchId || command.arguments?.startBatch || command.arguments?.batch || "",
    placeholders,
    status: !safety.safeForManualReviewHandoff
      ? "blocked_unsafe_command_marker"
      : placeholders.length
        ? "waiting_for_teacher_placeholder_resolution"
        : "ready_for_manual_review_handoff",
    safeForManualReviewHandoff: safety.safeForManualReviewHandoff,
    matchedForbiddenMarkers: safety.matchedForbiddenMarkers,
    executesNow: false,
    blockedUntil: command.blockedUntil || "teacher explicitly runs the reviewed coverage rollout command"
  });
}

const unsafeItems = queueItems.filter((item) => item.safeForManualReviewHandoff === false);
const placeholderItems = queueItems.filter((item) => item.placeholders.length > 0);
const rolloutHandoffItems = queueItems.filter((item) =>
  ["reviewed_coverage_rollout_supervisor_command", "reviewed_coverage_rollout_batch_command"].includes(item.kind)
);
const readyRolloutHandoffItems = rolloutHandoffItems.filter(
  (item) => item.safeForManualReviewHandoff && item.placeholders.length === 0
);
const readyItems = queueItems.filter(
  (item) => item.safeForManualReviewHandoff && item.placeholders.length === 0 && item.kind !== "missing_handoff_target"
);
const queueDecision = unsafeItems.length
  ? "blocked_until_unsafe_handoffs_are_removed"
  : readyRolloutHandoffItems.length
    ? "manual_coverage_rollout_handoffs_ready"
    : placeholderItems.length && rolloutHandoffItems.length
      ? "waiting_for_teacher_placeholder_resolution"
      : "waiting_for_teacher_coverage_rollout_review";
const status = unsafeItems.length ? "blocked" : readyRolloutHandoffItems.length ? "ready_for_manual_review" : "waiting_for_teacher_review";
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  queueDoesNotRunRolloutSupervisor: true,
  queueDoesNotRunCoverageRunner: true,
  queueDoesNotReadLogs: true,
  queueDoesNotCaptureScreenshots: true,
  queueDoesNotExecuteTargetSoftware: true,
  queueDoesNotRegisterSchedule: true,
  queueDoesNotWriteMemory: true,
  rolloutSupervisorInvoked: false,
  coverageRunnerInvoked: false,
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
  format: "transparent_ai_all_software_coverage_rollout_handoff_queue_v1",
  queueId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  queueDecision,
  sourceValidation: validationInput.path,
  sourceValidationDecision: validation.validationDecision || "",
  counts: {
    queueItems: queueItems.length,
    readyItems: readyRolloutHandoffItems.length,
    placeholderItems: placeholderItems.length,
    unsafeItems: unsafeItems.length,
    readyRolloutRows: validation.readyRowCount || 0
  },
  queueItems,
  nextTeacherActions: readyRolloutHandoffItems.length
    ? [
        "Open the validation README first.",
        "Run at most one reviewed coverage rollout handoff manually.",
        "Create or refresh the coverage convergence audit before claiming broader coverage."
      ]
    : [
        "Return to the coverage rollout receipt builder.",
        "Ask the teacher to review at least one rollout batch.",
        "Validate the teacher-filled receipt again before creating a new handoff queue."
      ],
  blockedTransitions: [
    "run_coverage_rollout_supervisor_from_queue",
    "run_coverage_rollout_batch_from_queue",
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
  <title>All-Software Coverage Rollout Handoff Queue</title>
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
    <h1>All-Software Coverage Rollout Handoff Queue</h1>
    <p>${htmlEscape(goal)}</p>
    <section class="panel">
      <p><span class="badge">${htmlEscape(status)}</span> <span class="badge">${htmlEscape(queueDecision)}</span></p>
      <p>This page lists manual next steps only. It does not run coverage rollout, read logs, screenshot, execute software, install schedules, write memory, or claim completion.</p>
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
      format: "transparent_ai_all_software_coverage_rollout_handoff_queue_result_v1",
      status,
      queueDecision,
      queuePath,
      htmlPath,
      readmePath,
      readyItems: readyItems.length,
      placeholderItems: placeholderItems.length,
      unsafeItems: unsafeItems.length,
      rolloutSupervisorInvoked: false,
      coverageRunnerInvoked: false,
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
