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
    String(value || "goal-teacher-review-cockpit-handoff-queue")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "goal-teacher-review-cockpit-handoff-queue"
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
    safeForManualReviewHandoff: matchedForbiddenMarkers.length === 0,
    matchedForbiddenMarkers
  };
}

function classifyCommand(command) {
  const text = String(command || "");
  if (!text) return "missing_handoff_target";
  if (text.includes("validate-") || text.includes("validate_")) return "downstream_receipt_validation";
  if (existsSync(text)) return "open_review_entry";
  return "manual_review_command";
}

function writeReadme(path, queue) {
  const lines = [
    "# Goal Teacher Review Cockpit Handoff Queue",
    "",
    `Status: ${queue.status}`,
    `Decision: ${queue.queueDecision}`,
    `Queue items: ${queue.counts.queueItems}`,
    "",
    "This queue translates a validated teacher review cockpit receipt into manual next steps.",
    "",
    "Safety boundary:",
    "- It does not execute commands.",
    "- It does not validate downstream receipts.",
    "- It does not register scheduled tasks, launch runners, execute target software, capture screenshots, write memory, enable rules, accept technology, unlock packaging, or claim completion.",
    "",
    "Queue:",
    ...queue.queueItems.map(
      (item) =>
        `- ${item.id}: ${item.status}; kind=${item.handoffKind}; placeholders=${item.missingInputs.length}; command=${item.command || ""}`
    )
  ];
  if (!queue.queueItems.length) lines.push("- none");
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, queue) {
  const rows = queue.queueItems
    .map((item) => {
      const fileLink = item.commandLooksLikeFile
        ? `<a href="${htmlEscape(fileHref(item.command))}">${htmlEscape(basename(item.command))}</a>`
        : "";
      return `<tr>
        <td>${item.order}</td>
        <td>${htmlEscape(item.handoffKind)}</td>
        <td>${htmlEscape(item.status)}</td>
        <td>${htmlEscape(item.sourceItemId)}</td>
        <td>${fileLink}</td>
        <td><code>${htmlEscape(item.command || "")}</code></td>
        <td>${htmlEscape(item.missingInputs.join(", "))}</td>
      </tr>`;
    })
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Goal Teacher Review Cockpit Handoff Queue</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1220px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Goal Teacher Review Cockpit Handoff Queue</h1>
    <p><strong>Status:</strong> ${htmlEscape(queue.status)}</p>
    <p><strong>Decision:</strong> ${htmlEscape(queue.queueDecision)}</p>
    <p class="lock">Manual review queue only. It does not execute commands, validate downstream receipts, register tasks, launch runners, capture screenshots, write memory, accept technology, unlock packaging, or claim completion.</p>
    <table>
      <thead><tr><th>Order</th><th>Kind</th><th>Status</th><th>Source Item</th><th>Open</th><th>Command</th><th>Missing Inputs</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Create a manual next-step queue from a validated goal teacher review cockpit receipt.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--receipt-validation", "")),
  "--validation",
  "transparent_ai_goal_teacher_review_cockpit_receipt_validation_v1"
);
if (!validationInput.value) throw new Error("--validation is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "goal-teacher-review-cockpit-handoff-queues"))
);
mkdirSync(outputRoot, { recursive: true });
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const queueDir = join(outputRoot, queueId);
mkdirSync(queueDir, { recursive: true });

const validation = validationInput.value;
const queuePath = join(queueDir, "goal-teacher-review-cockpit-handoff-queue.json");
const htmlPath = join(queueDir, "goal-teacher-review-cockpit-handoff-queue.html");
const readmePath = join(queueDir, "GOAL_TEACHER_REVIEW_COCKPIT_HANDOFF_QUEUE_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  queueDoesNotExecuteCommands: true,
  queueDoesNotValidateDownstreamReceipts: true,
  queueDoesNotRegisterTask: true,
  queueDoesNotLaunchRunner: true,
  queueDoesNotExecuteTargetSoftware: true,
  queueDoesNotCaptureScreenshots: true,
  queueDoesNotWriteMemory: true,
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

const sourceCommands = Array.isArray(validation.nextSafeCommands) ? validation.nextSafeCommands : [];
const validationForbidden = validation.forbiddenDecisionUsed === true || String(validation.status || "").toLowerCase() === "blocked";
const queueItems = sourceCommands.map((commandRow, index) => {
  const command = String(commandRow.command || "");
  const missingInputs = commandPlaceholders(command);
  const safety = commandSafety(command);
  const handoffKind = classifyCommand(command);
  const commandLooksLikeFile = command ? existsSync(command) : false;
  const blocked = validationForbidden || !safety.safeForManualReviewHandoff || handoffKind === "missing_handoff_target";
  return {
    id: `cockpit_handoff_queue_${String(index + 1).padStart(3, "0")}`,
    order: index + 1,
    sourceCommandId: commandRow.id || "",
    sourceItemId: commandRow.itemId || "",
    title: commandRow.title || "",
    handoffKind,
    command,
    commandLooksLikeFile,
    missingInputs,
    safety,
    commandExecutableNow: false,
    executesNow: false,
    status: blocked
      ? "blocked_for_unsafe_or_missing_handoff"
      : missingInputs.length
        ? "waiting_for_teacher_downstream_receipt_or_placeholder_replacement"
        : "ready_for_manual_review_handoff",
    teacherAction:
      missingInputs.length > 0
        ? "Fill the missing downstream receipt or replace placeholders, then run the downstream validator manually if still safe."
        : commandLooksLikeFile
          ? "Open the review file and continue teacher review manually."
          : "Review the downstream validation command manually; do not execute from this queue.",
    blockedActions: [
      "execute_command_from_cockpit_handoff_queue",
      "auto_run_downstream_validator_from_cockpit_handoff_queue",
      "register_task_from_cockpit_handoff_queue",
      "launch_runner_from_cockpit_handoff_queue",
      "execute_target_software_from_cockpit_handoff_queue",
      "write_memory_from_cockpit_handoff_queue",
      "claim_goal_complete_from_cockpit_handoff_queue"
    ]
  };
});

const blockedCount = queueItems.filter((item) => item.status === "blocked_for_unsafe_or_missing_handoff").length;
const placeholderCount = queueItems.filter((item) => item.missingInputs.length > 0).length;
const readyManualCount = queueItems.filter((item) => item.status === "ready_for_manual_review_handoff").length;
const queueDecision =
  blockedCount > 0
    ? "blocked_until_unsafe_handoffs_are_removed"
    : queueItems.length === 0
      ? "waiting_for_validated_cockpit_receipt_commands"
      : placeholderCount > 0
        ? "waiting_for_teacher_downstream_receipts"
        : "ready_for_manual_review_handoff";
const status =
  blockedCount > 0
    ? "blocked"
    : queueItems.length === 0
      ? "waiting_for_validated_cockpit_receipt"
      : placeholderCount > 0
        ? "waiting_for_teacher_downstream_receipts"
        : "ready_for_manual_review_handoff";

const queue = {
  ok: true,
  format: "transparent_ai_goal_teacher_review_cockpit_handoff_queue_v1",
  queueId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  queueDecision,
  sourceEvidence: {
    validation: validationInput.path,
    validationId: validation.validationId || "",
    validationDecision: validation.validationDecision || "",
    cockpit: validation.paths?.sourceCockpit || "",
    receipt: validation.paths?.sourceReceipt || ""
  },
  counts: {
    queueItems: queueItems.length,
    readyManualCount,
    placeholderCount,
    blockedCount
  },
  queueItems,
  blockedActions: [
    "execute_cockpit_handoff_queue",
    "auto_run_downstream_validation_queue",
    "register_scheduled_task_from_cockpit_handoff_queue",
    "launch_runner_from_cockpit_handoff_queue",
    "execute_target_software_from_cockpit_handoff_queue",
    "capture_screenshot_from_cockpit_handoff_queue",
    "write_memory_from_cockpit_handoff_queue",
    "claim_goal_complete_from_cockpit_handoff_queue"
  ],
  locks,
  paths: {
    queue: queuePath,
    html: htmlPath,
    readme: readmePath
  }
};

writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
writeReadme(readmePath, queue);
writeHtml(htmlPath, queue);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_goal_teacher_review_cockpit_handoff_queue_result_v1",
      queuePath,
      htmlPath,
      readmePath,
      status,
      queueDecision,
      queueItems: queueItems.length,
      locks
    },
    null,
    2
  )
);
