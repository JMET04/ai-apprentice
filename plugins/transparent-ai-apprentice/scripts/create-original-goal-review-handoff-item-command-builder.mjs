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
    String(value || "original-goal-review-handoff-item-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-review-handoff-item-command-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
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

function queueKind(queue) {
  if (queue?.format === "transparent_ai_original_goal_teacher_action_router_handoff_queue_v1") return "teacher_action_router";
  if (queue?.format === "transparent_ai_goal_teacher_review_cockpit_handoff_queue_v1") return "teacher_review_cockpit";
  if (queue?.format === "transparent_ai_original_goal_remaining_gates_receipt_validation_v1") return "remaining_gates_validation";
  if (queue?.format === "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_validation_v1") {
    return "proof_gap_teacher_queue_receipt_validation";
  }
  if (queue?.format === "transparent_ai_original_goal_next_confirmation_pack_receipt_validation_v1") {
    return "next_confirmation_pack_validation";
  }
  if (!queue) return "queue_not_loaded_yet";
  return "unsupported";
}

function queueItems(queue) {
  if (Array.isArray(queue?.queueItems)) return queue.queueItems;
  if (Array.isArray(queue?.nextReviewQueue)) return queue.nextReviewQueue;
  return [];
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
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function normalizedItems(queue) {
  const items = queueItems(queue);
  if (!items.length) {
    return [
      {
        id: "placeholder_item_001",
        order: 1,
        number: 1,
        label: "Placeholder item until a teacher-reviewed handoff queue is selected",
        sourceKind: "placeholder",
        handoffKind: "placeholder",
        status: "waiting_for_queue_path",
        openPath: "",
        command: "",
        missingInputs: ["<teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json>"]
      }
    ];
  }
  return items.map((item, index) => ({
    id: item.id || item.sourceItemId || `handoff_item_${String(index + 1).padStart(3, "0")}`,
    order: item.order || item.number || index + 1,
    number: item.number || item.order || index + 1,
    label: item.label || item.teacherQuestion || item.reviewEntryId || item.sourceItemId || item.routeId || `Handoff item ${index + 1}`,
    sourceKind: item.sourceKind || "",
    handoffKind: item.handoffKind || (item.verificationCommandTemplate ? "manual_next_review_route" : ""),
    status: item.status || "",
    openPath: item.openPath || item.observedEvidencePath || "",
    command: item.command || "",
    verificationCommandTemplate: item.verificationCommandTemplate || "",
    missingInputs: Array.isArray(item.missingInputs)
      ? item.missingInputs
      : Array.isArray(item.commandPlaceholders)
        ? item.commandPlaceholders
        : []
  }));
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Review Handoff Item Command Builder",
    "",
    `Status: ${builder.status}`,
    `Queue kind: ${builder.queueKind}`,
    `Queue: ${builder.paths.sourceQueue || "<queue path not loaded yet>"}`,
    "",
    "Use the HTML page to pick exactly one reviewed queue item, fill any downstream receipt path if needed, add the retained rollback point, and copy the generated runner command.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    "",
    "Safety boundary:",
    "- This builder only creates command text and a run-request JSON in the browser.",
    "- It does not run the command, open GUI files, register tasks, launch runners, execute target software, capture screenshots, write memory, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const rows = builder.items
    .map(
      (item) => `<tr>
        <td><input type="radio" name="item" value="${htmlEscape(item.number)}" ${item.order === 1 ? "checked" : ""}></td>
        <td>${htmlEscape(item.number)}</td>
        <td>${htmlEscape(item.status)}</td>
        <td>${htmlEscape(item.handoffKind)}</td>
        <td>${htmlEscape(item.label)}</td>
        <td>${item.openPath ? `<a href="${htmlEscape(fileHref(item.openPath))}">${htmlEscape(basename(item.openPath))}</a>` : ""}</td>
        <td><code>${htmlEscape(item.missingInputs.join(", "))}</code></td>
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
  <title>Original Goal Review Handoff Item Command Builder</title>
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
    <h1>Original Goal Review Handoff Item Command Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Queue kind:</strong> <code>${htmlEscape(builder.queueKind)}</code></p>
    <p><strong>Queue:</strong> ${builder.paths.sourceQueue ? `<a href="${htmlEscape(fileHref(builder.paths.sourceQueue))}">${htmlEscape(builder.paths.sourceQueue)}</a>` : "<code>choose a queue path when generating this builder</code>"}</p>
    <p class="lock">This page only generates command text. It does not run the command, open GUI files, register tasks, launch runners, execute target software, capture screenshots, write memory, unlock packaging, or claim completion.</p>
    <section class="panel">
      <label>Queue path
        <input id="queuePath" value="${htmlEscape(builder.paths.sourceQueue || "<teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json>")}">
      </label>
      <label>Downstream receipt path, if this item requires one
        <input id="receiptPath" value="<teacher-filled-downstream-receipt-if-needed.json>">
      </label>
      <label>Teacher confirmation
        <input id="teacherConfirmation" value="teacher confirmed original goal review handoff item">
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
      <thead><tr><th>Pick</th><th>#</th><th>Status</th><th>Kind</th><th>Label</th><th>Open</th><th>Missing Inputs</th></tr></thead>
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
      const receiptPath = document.getElementById("receiptPath").value.trim();
      const confirmation = document.getElementById("teacherConfirmation").value.trim();
      const rollbackPoint = document.getElementById("rollbackPoint").value.trim();
      const request = {
        format: "transparent_ai_original_goal_review_handoff_item_run_request_v1",
        generatedBy: "original_goal_review_handoff_item_command_builder",
        queuePath,
        itemNumber: selectedNumber(),
        receiptPath,
        runReviewedHandoff: true,
        allowRunner: true,
        teacherConfirmation: confirmation,
        rollbackPointCreated: true,
        rollbackPoint,
        locks: builder.locks
      };
      const q = (value) => '"' + String(value || "").replaceAll('"', '\\\\"') + '"';
      request.command = [
        "node plugins\\\\transparent-ai-apprentice\\\\scripts\\\\run-original-goal-review-handoff-queue-item.mjs",
        "--queue", q(queuePath),
        "--item-number", q(request.itemNumber),
        "--receipt", q(receiptPath),
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
      link.download = "original-goal-review-handoff-item-run-request.json";
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

const goal = argValue("--goal", "Build a teacher-facing command page for one original-goal review handoff item.");
const queueInput = readJsonInput(argValue("--queue", argValue("--handoff-queue", "")), "--queue");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-review-handoff-item-command-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const queue = queueInput.value;
const builderPath = join(builderDir, "original-goal-review-handoff-item-command-builder.json");
const htmlPath = join(builderDir, "original-goal-review-handoff-item-command-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_REVIEW_HANDOFF_ITEM_COMMAND_BUILDER_START_HERE.md");
const builderLocks = locks();
const items = normalizedItems(queue);
const kind = queueKind(queue);
const builder = {
  ok: true,
  format: "transparent_ai_original_goal_review_handoff_item_command_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: queue ? "waiting_for_teacher_single_handoff_item_command_generation" : "waiting_for_teacher_handoff_queue_path",
  queueKind: kind,
  queueSupported: [
    "teacher_action_router",
    "teacher_review_cockpit",
    "remaining_gates_validation",
    "proof_gap_teacher_queue_receipt_validation",
    "next_confirmation_pack_validation"
  ].includes(kind),
  counts: {
    queueItems: items.length,
    missingInputItems: items.filter((item) => item.missingInputs.length > 0).length
  },
  items,
  commandTemplate: commandLine("run-original-goal-review-handoff-queue-item.mjs", [
    ["--queue", queueInput.path || "<teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json>"],
    ["--item-number", "<teacher-reviewed-item-number>"],
    ["--receipt", "<teacher-filled-downstream-receipt-if-needed.json>"],
    ["--run-reviewed-handoff", "true"],
    ["--allow-runner", "true"],
    ["--teacher-confirmation", "<teacher-confirmed-original-goal-review-handoff-item-text>"],
    ["--rollback-point-created", "true"],
    ["--rollback-point", "<retained-rollback-point-path-or-label>"]
  ]),
  blockedActions: [
    "execute_command_from_command_builder",
    "open_gui_from_command_builder",
    "register_schedule_from_command_builder",
    "launch_runner_from_command_builder",
    "execute_target_software_from_command_builder",
    "capture_screenshot_from_command_builder",
    "write_memory_from_command_builder",
    "claim_goal_complete_from_command_builder"
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

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_review_handoff_item_command_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      status: builder.status,
      queueKind: builder.queueKind,
      queueItems: builder.counts.queueItems,
      locks: builderLocks
    },
    null,
    2
  )
);
