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
    String(value || "execution-follow-up-handoff-queue")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-follow-up-handoff-queue"
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

function commandPlaceholders(command, args = {}) {
  return Array.from(new Set(`${command || ""} ${JSON.stringify(args || {})}`.match(/<[^<>]+>/g) || []));
}

function flagName(key) {
  return `--${String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase()}`;
}

function quoteArg(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '\\"')}"`;
}

function commandLineFor(command) {
  if (command.commandLine) return command.commandLine;
  const tool = command.tool || "";
  const args = command.arguments || {};
  const scriptByTool = {
    run_all_software_execution_pilot_runner: "run-all-software-execution-pilot-runner.mjs",
    run_all_software_execution_pilot_batch: "run-all-software-execution-pilot-batch.mjs"
  };
  const script = scriptByTool[tool] || "";
  if (!script) return "";
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [key, value] of Object.entries(args)) {
    if (value === false || value === null || value === undefined || value === "") continue;
    if (value === true) {
      parts.push(flagName(key));
    } else if (Array.isArray(value)) {
      for (const item of value) parts.push(flagName(key), quoteArg(item));
    } else {
      parts.push(flagName(key), quoteArg(value));
    }
  }
  return parts.join(" ");
}

function commandSafety(commandLine, args = {}) {
  const lower = `${String(commandLine || "")} ${JSON.stringify(args || {})}`.toLowerCase();
  const forbiddenMarkers = [
    "--execute",
    "-execute",
    " execute-mode ",
    " run_execute_mode ",
    "\"execute\":true",
    "\"execute\": true",
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
  const tool = String(command.tool || "");
  const text = String(command.commandLine || "");
  if (tool === "run_all_software_execution_pilot_runner" || text.includes("run-all-software-execution-pilot-runner.mjs")) {
    return "reviewed_dry_run_runner_command";
  }
  if (tool === "run_all_software_execution_pilot_batch" || text.includes("run-all-software-execution-pilot-batch.mjs")) {
    return "reviewed_dry_run_batch_command";
  }
  if (text.includes("reconcile-all-software-execution-capability-matrix-follow-up-batch.mjs")) {
    return "post_runner_reconciliation_command";
  }
  if (text.includes("validate-") || text.includes("validate_")) return "downstream_receipt_validation";
  return tool || text ? "manual_review_command" : "missing_handoff_target";
}

function writeReadme(path, queue) {
  const lines = [
    "# Execution Follow-Up Handoff Queue",
    "",
    `Status: ${queue.status}`,
    `Decision: ${queue.queueDecision}`,
    `Queue items: ${queue.counts.queueItems}`,
    "",
    "This queue turns a validated execution follow-up receipt into manual dry-run review steps.",
    "",
    "Safety boundary:",
    "- This queue does not invoke execution pilot runners.",
    "- It does not execute target software, send UI events, read logs, capture screenshots, register schedules, write memory, accept rules, unlock packaging, or claim completion.",
    "- Runner commands stay manual and are blocked if unsafe execute/screenshot/schedule/memory markers are present.",
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

const goal = argValue("--goal", "Create a manual handoff queue from execution follow-up validation.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--receipt-validation", "")),
  "--validation",
  "transparent_ai_all_software_execution_follow_up_receipt_validation_v1"
);
if (!validationInput.value) throw new Error("--validation is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-follow-up-handoff-queues"))
);
mkdirSync(outputRoot, { recursive: true });
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const queueDir = join(outputRoot, queueId);
mkdirSync(queueDir, { recursive: true });

const validation = validationInput.value;
const queuePath = join(queueDir, "all-software-execution-follow-up-handoff-queue.json");
const htmlPath = join(queueDir, "all-software-execution-follow-up-handoff-queue.html");
const readmePath = join(queueDir, "ALL_SOFTWARE_EXECUTION_FOLLOW_UP_HANDOFF_QUEUE_START_HERE.md");

const queueItems = [];
const sourceReadme = validation.paths?.readme || "";
if (sourceReadme) {
  queueItems.push({
    number: queueItems.length + 1,
    id: "open_validation_readme",
    kind: existsSync(sourceReadme) ? "open_review_entry" : "missing_handoff_target",
    label: "Open execution follow-up validation README before any dry-run runner review command",
    openPath: sourceReadme,
    openUrl: existsSync(sourceReadme) ? fileHref(sourceReadme) : "",
    command: sourceReadme,
    placeholders: [],
    status: existsSync(sourceReadme) ? "ready_for_manual_review" : "missing_validation_readme",
    safeForManualReviewHandoff: existsSync(sourceReadme),
    matchedForbiddenMarkers: [],
    invokesRunnerNow: false
  });
}

const commands = Array.isArray(validation.nextDryRunReviewCommands) ? validation.nextDryRunReviewCommands : [];
for (const command of commands) {
  const commandLine = commandLineFor(command);
  const args = command.arguments || {};
  const safety = commandSafety(commandLine, args);
  const placeholders = commandPlaceholders(commandLine, args);
  queueItems.push({
    number: queueItems.length + 1,
    id: `execution_follow_up_dry_run_${queueItems.length + 1}`,
    kind: classifyCommand({ ...command, commandLine }),
    label: command.tool || "run_all_software_execution_pilot_runner",
    rowId: command.rowId || "",
    command: commandLine,
    arguments: args,
    placeholders,
    status: !safety.safeForManualReviewHandoff
      ? "blocked_unsafe_command_marker"
      : placeholders.length
        ? "waiting_for_teacher_placeholder_resolution"
        : "ready_for_manual_review_handoff",
    safeForManualReviewHandoff: safety.safeForManualReviewHandoff,
    matchedForbiddenMarkers: safety.matchedForbiddenMarkers,
    invokesRunnerNow: false,
    executesTargetSoftwareNow: false,
    blockedUntil: command.blockedUntil || "teacher explicitly runs one dry-run-only runner review command"
  });
}

const unsafeItems = queueItems.filter((item) => item.safeForManualReviewHandoff === false);
const placeholderItems = queueItems.filter((item) => item.placeholders.length > 0);
const dryRunHandoffItems = queueItems.filter(
  (item) => item.kind === "reviewed_dry_run_runner_command" || item.kind === "reviewed_dry_run_batch_command"
);
const readyDryRunHandoffItems = dryRunHandoffItems.filter(
  (item) => item.safeForManualReviewHandoff && item.placeholders.length === 0
);
const queueDecision = unsafeItems.length
  ? "blocked_until_unsafe_handoffs_are_removed"
  : readyDryRunHandoffItems.length
    ? "manual_dry_run_runner_handoffs_ready"
    : placeholderItems.length && dryRunHandoffItems.length
      ? "waiting_for_teacher_placeholder_resolution"
      : "waiting_for_teacher_execution_follow_up_review";
const status = unsafeItems.length ? "blocked" : readyDryRunHandoffItems.length ? "ready_for_manual_review" : "waiting_for_teacher_review";
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  queueDoesNotInvokeRunner: true,
  queueDoesNotExecuteTargetSoftware: true,
  queueDoesNotSendUiEvents: true,
  queueDoesNotReadLogs: true,
  queueDoesNotCaptureScreenshots: true,
  queueDoesNotRegisterSchedule: true,
  queueDoesNotWriteMemory: true,
  dryRunRunnerInvoked: false,
  runnerInvoked: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false
};
const queue = {
  ok: true,
  format: "transparent_ai_all_software_execution_follow_up_handoff_queue_v1",
  queueId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  queueDecision,
  sourceValidation: validationInput.path,
  sourceValidationDecision: validation.validationDecision || "",
  counts: {
    queueItems: queueItems.length,
    readyItems: readyDryRunHandoffItems.length,
    placeholderItems: placeholderItems.length,
    unsafeItems: unsafeItems.length,
    readyDryRunRows: validation.readyRowCount || 0
  },
  queueItems,
  nextTeacherActions: readyDryRunHandoffItems.length
    ? [
        "Open the validation README first.",
        "Resolve placeholders if any remain.",
        "Run at most one dry-run-only runner handoff manually, then review the runner receipt before any execute request."
      ]
    : [
        "Return to the execution follow-up receipt builder.",
        "Ask the teacher to review one prepared dry-run row.",
        "Validate the teacher-filled receipt again before creating a new handoff queue."
      ],
  blockedTransitions: [
    "invoke_runner_from_queue",
    "execute_target_software_from_queue",
    "send_ui_events_from_queue",
    "read_logs_from_queue",
    "capture_screenshot_from_queue",
    "register_schedule_from_queue",
    "write_memory_from_queue",
    "claim_all_software_execution_complete_from_queue",
    "claim_native_universal_execution_from_queue"
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
  <title>Execution Follow-Up Handoff Queue</title>
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
    <h1>Execution Follow-Up Handoff Queue</h1>
    <p>${htmlEscape(goal)}</p>
    <section class="panel">
      <p><span class="badge">${htmlEscape(status)}</span> <span class="badge">${htmlEscape(queueDecision)}</span></p>
      <p>This page lists manual next steps only. It does not invoke runners, execute target software, send UI events, read logs, screenshot, install schedules, write memory, or claim completion.</p>
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
      format: "transparent_ai_all_software_execution_follow_up_handoff_queue_result_v1",
      status,
      queueDecision,
      queuePath,
      htmlPath,
      readmePath,
      readyItems: readyDryRunHandoffItems.length,
      placeholderItems: placeholderItems.length,
      unsafeItems: unsafeItems.length,
      dryRunRunnerInvoked: false,
      runnerInvoked: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      locks
    },
    null,
    2
  )
);
