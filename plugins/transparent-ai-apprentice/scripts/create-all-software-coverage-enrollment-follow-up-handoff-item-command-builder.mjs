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
    String(value || "coverage-enrollment-follow-up-handoff-item-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "coverage-enrollment-follow-up-handoff-item-command-builder"
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

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
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

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotRunHandoffItem: true,
    builderDoesNotInvokeRunner: true,
    builderDoesNotReadLogs: true,
    builderDoesNotOpenGui: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    commandsExecuted: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function queueItems(queue) {
  return Array.isArray(queue?.queueItems) ? queue.queueItems : [];
}

function commandPlaceholders(item) {
  return Array.from(new Set(`${item.command || ""} ${JSON.stringify(item.arguments || {})}`.match(/<[^<>]+>/g) || []));
}

function normalizedItems(queue) {
  const items = queueItems(queue).filter((item) => item.kind === "reviewed_low_token_batch_command");
  if (!items.length) {
    return [
      {
        id: "placeholder_coverage_enrollment_follow_up_item_001",
        number: 1,
        label: "Placeholder item until a validated coverage enrollment follow-up handoff queue is selected",
        kind: "placeholder",
        status: "waiting_for_handoff_queue",
        readyFollowUpIds: [],
        placeholders: ["<coverage-enrollment-follow-up-handoff-queue.json>"],
        safeForManualReviewHandoff: false,
        matchedForbiddenMarkers: []
      }
    ];
  }
  return items.map((item, index) => ({
    id: item.id || `coverage_enrollment_follow_up_item_${String(index + 1).padStart(3, "0")}`,
    number: item.number || index + 1,
    label: item.label || item.tool || `Coverage enrollment follow-up item ${index + 1}`,
    kind: item.kind || "",
    status: item.status || "",
    readyFollowUpIds: Array.isArray(item.readyFollowUpIds) ? item.readyFollowUpIds : [],
    placeholders: commandPlaceholders(item),
    safeForManualReviewHandoff: item.safeForManualReviewHandoff === true,
    matchedForbiddenMarkers: Array.isArray(item.matchedForbiddenMarkers) ? item.matchedForbiddenMarkers : []
  }));
}

function writeReadme(path, builder) {
  const lines = [
    "# Coverage Enrollment Follow-Up Handoff Item Command Builder",
    "",
    `Status: ${builder.status}`,
    `Queue: ${builder.paths.sourceQueue || "<queue path not loaded yet>"}`,
    `Ready batch items: ${builder.counts.readyBatchItems}`,
    "",
    "Use the HTML page to pick exactly one teacher-reviewed coverage enrollment follow-up item, add the retained rollback point, and copy the generated single-item runner command.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    "",
    "Safety boundary:",
    "- This builder only creates command text and a run-request JSON in the browser.",
    "- It does not run the command, read logs, open GUI files, register tasks, launch runners, execute target software, capture screenshots, write memory, accept coverage, unlock packaging, or claim completion.",
    "- The generated command invokes the structured single-item runner; it does not execute the queue display command string."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const rows = builder.items
    .map(
      (item) => `<tr>
        <td><input type="radio" name="item" value="${htmlEscape(item.number)}" ${item.number === 1 ? "checked" : ""}></td>
        <td>${htmlEscape(item.number)}</td>
        <td>${htmlEscape(item.status)}</td>
        <td>${htmlEscape(item.label)}</td>
        <td><code>${htmlEscape(item.readyFollowUpIds.join(", "))}</code></td>
        <td><code>${htmlEscape(item.placeholders.join(", "))}</code></td>
        <td>${item.safeForManualReviewHandoff ? "yes" : "no"}</td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Coverage Enrollment Follow-Up Handoff Item Command Builder</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1240px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.5; }
    .panel { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; padding: 14px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    label { display: block; margin: 10px 0; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 8px; font: 14px "Segoe UI", Arial, sans-serif; }
    input[type="radio"] { width: 18px; height: 18px; }
    textarea { min-height: 190px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Coverage Enrollment Follow-Up Handoff Item Command Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Queue:</strong> ${builder.paths.sourceQueue ? `<a href="${htmlEscape(fileHref(builder.paths.sourceQueue))}">${htmlEscape(builder.paths.sourceQueue)}</a>` : "<code>choose a queue path when generating this builder</code>"}</p>
    <p class="lock">This page only generates command text. It does not run commands, read logs, register tasks, capture screenshots, write memory, execute target software, unlock packaging, or claim completion.</p>
    <section class="panel">
      <label>Queue path
        <input id="queuePath" value="${htmlEscape(builder.paths.sourceQueue || "<coverage-enrollment-follow-up-handoff-queue.json>")}">
      </label>
      <label>Teacher confirmation
        <input id="teacherConfirmation" value="teacher confirmed coverage enrollment follow-up item">
      </label>
      <label>Retained rollback point
        <input id="rollbackPoint" value="<retained-rollback-point-path-or-label>">
      </label>
      <div class="controls">
        <button id="generateCommand">Generate single-item runner command</button>
        <button id="copyCommand" class="secondary">Copy command</button>
        <button id="downloadRequest" class="secondary">Download run request JSON</button>
      </div>
      <textarea id="output" spellcheck="false"></textarea>
    </section>
    <table>
      <thead><tr><th>Pick</th><th>#</th><th>Status</th><th>Label</th><th>Ready Follow-Up IDs</th><th>Placeholders</th><th>Safe</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const output = document.getElementById("output");
    function selectedNumber() {
      return document.querySelector('input[name="item"]:checked')?.value || "1";
    }
    function makeCommand() {
      const queuePath = document.getElementById("queuePath").value.trim();
      const confirmation = document.getElementById("teacherConfirmation").value.trim();
      const rollbackPoint = document.getElementById("rollbackPoint").value.trim();
      const request = {
        format: "transparent_ai_coverage_enrollment_follow_up_handoff_item_run_request_v1",
        generatedBy: "coverage_enrollment_follow_up_handoff_item_command_builder",
        queuePath,
        itemNumber: selectedNumber(),
        runReviewedHandoff: true,
        allowRunner: true,
        teacherConfirmation: confirmation,
        rollbackPointCreated: true,
        rollbackPoint,
        locks: builder.locks
      };
      const q = (value) => '"' + String(value || "").replaceAll('"', '\\\\"') + '"';
      request.command = [
        "node plugins\\\\transparent-ai-apprentice\\\\scripts\\\\run-all-software-coverage-enrollment-follow-up-handoff-queue-item.mjs",
        "--queue", q(queuePath),
        "--item-number", q(request.itemNumber),
        "--run-reviewed-handoff", q("true"),
        "--allow-runner", q("true"),
        "--teacher-confirmation", q(confirmation),
        "--rollback-point-created", q("true"),
        "--rollback-point", q(rollbackPoint)
      ].join(" ");
      output.value = request.command + "\\n\\n" + JSON.stringify(request, null, 2);
      return request;
    }
    document.getElementById("generateCommand").addEventListener("click", makeCommand);
    document.getElementById("copyCommand").addEventListener("click", async () => {
      const request = makeCommand();
      if (navigator.clipboard) await navigator.clipboard.writeText(request.command);
    });
    document.getElementById("downloadRequest").addEventListener("click", () => {
      const request = makeCommand();
      const blob = new Blob([JSON.stringify(request, null, 2) + "\\n"], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "coverage-enrollment-follow-up-handoff-item-run-request.json";
      link.click();
      URL.revokeObjectURL(link.href);
    });
    makeCommand();
  </script>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build a teacher-facing command page for one coverage enrollment follow-up handoff item.");
const queueInput = readJsonInput(
  argValue("--queue", argValue("--handoff-queue", "")),
  "--queue",
  "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_v1"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "coverage-enrollment-follow-up-handoff-item-command-builders")
  )
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const queue = queueInput.value;
const builderPath = join(builderDir, "coverage-enrollment-follow-up-handoff-item-command-builder.json");
const htmlPath = join(builderDir, "coverage-enrollment-follow-up-handoff-item-command-builder.html");
const readmePath = join(builderDir, "COVERAGE_ENROLLMENT_FOLLOW_UP_HANDOFF_ITEM_COMMAND_BUILDER_START_HERE.md");
const items = normalizedItems(queue);
const builderLocks = locks();
const readyBatchItems = items.filter(
  (item) =>
    item.kind === "reviewed_low_token_batch_command" &&
    item.status === "ready_for_manual_review_handoff" &&
    item.safeForManualReviewHandoff === true &&
    item.placeholders.length === 0
);
const builder = {
  ok: true,
  format: "transparent_ai_coverage_enrollment_follow_up_handoff_item_command_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: queue ? "waiting_for_teacher_single_coverage_enrollment_follow_up_item_command_generation" : "waiting_for_handoff_queue_path",
  queueSupported: Boolean(queue),
  sourceQueueStatus: queue?.status || "",
  sourceQueueDecision: queue?.queueDecision || "",
  counts: {
    queueItems: items.length,
    readyBatchItems: readyBatchItems.length,
    placeholderItems: items.filter((item) => item.placeholders.length > 0).length,
    unsafeItems: items.filter((item) => item.safeForManualReviewHandoff === false).length
  },
  items,
  commandTemplate: commandLine("run-all-software-coverage-enrollment-follow-up-handoff-queue-item.mjs", [
    ["--queue", queueInput.path || "<coverage-enrollment-follow-up-handoff-queue.json>"],
    ["--item-number", "<teacher-reviewed-item-number>"],
    ["--run-reviewed-handoff", "true"],
    ["--allow-runner", "true"],
    ["--teacher-confirmation", "<teacher-confirmed-coverage-enrollment-follow-up-item-text>"],
    ["--rollback-point-created", "true"],
    ["--rollback-point", "<retained-rollback-point-path-or-label>"]
  ]),
  blockedActions: [
    "execute_queue_display_command_string",
    "invoke_enrollment_follow_up_runner_without_teacher_confirmation",
    "invoke_multi_item_enrollment_follow_up_from_command_builder",
    "read_logs_from_command_builder",
    "capture_screenshot_from_command_builder",
    "register_schedule_from_command_builder",
    "execute_target_software_from_command_builder",
    "write_memory_from_command_builder",
    "claim_all_software_coverage_complete_from_command_builder"
  ],
  locks: builderLocks,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    sourceQueue: queueInput.path
  }
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeHtml(htmlPath, builder);
console.log(JSON.stringify(builder, null, 2));
