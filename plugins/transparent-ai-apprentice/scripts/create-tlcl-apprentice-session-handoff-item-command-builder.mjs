#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-apprentice-session-handoff-item-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-apprentice-session-handoff-item-command-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function quote(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    builderDoesNotExecuteQueueItem: true,
    builderDoesNotAutoRunNextCall: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    ruleEnabledByBuilder: false,
    targetSoftwareCommandsExecuted: false,
    goalComplete: false
  };
}

function queueItems(queue) {
  if (Array.isArray(queue?.queueItems)) return queue.queueItems;
  return [];
}

function normalizeItems(queue) {
  const items = queueItems(queue);
  if (!items.length) {
    return [
      {
        id: "tlcl_handoff_placeholder_001",
        order: 1,
        status: "waiting_for_handoff_queue_path",
        selectedRoute: "",
        commandKind: "",
        commandTemplate: "",
        nextCall: null,
        handoffInputs: {},
        warnings: [],
        placeholders: ["<tlcl-apprentice-session-launcher-handoff-queue.json>"],
        teacherAction: "Provide a TLCL apprentice session handoff queue path before generating a continuation request.",
        executesNow: false
      }
    ];
  }
  return items.map((item, index) => ({
    id: item.id || `tlcl_handoff_item_${String(index + 1).padStart(3, "0")}`,
    order: item.order || index + 1,
    status: item.status || "",
    selectedRoute: item.selectedRoute || "",
    commandKind: item.commandKind || "",
    commandTemplate: item.commandTemplate || "",
    nextCall: item.nextCall || null,
    handoffInputs: item.handoffInputs || {},
    warnings: Array.isArray(item.warnings) ? item.warnings : [],
    placeholders: Array.isArray(item.placeholders) ? item.placeholders : [],
    teacherAction: item.teacherAction || "Review the queue item manually before continuing.",
    executesNow: false
  }));
}

const goal = argValue("--goal", "Build a teacher-facing command page for one TLCL apprentice session handoff queue item.");
const queueInput = readJsonInput(argValue("--queue", argValue("--handoff-queue", "")), "--queue");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-apprentice-session-handoff-item-command-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const queue = queueInput.value;
const queueFormat = queue?.format || "queue_not_loaded_yet";
const supportedQueue = queueFormat === "transparent_ai_tlcl_apprentice_session_launcher_handoff_queue_v1";
if (queue && !supportedQueue) throw new Error("queue must be transparent_ai_tlcl_apprentice_session_launcher_handoff_queue_v1");

const builderPath = join(builderDir, "tlcl-apprentice-session-handoff-item-command-builder.json");
const htmlPath = join(builderDir, "tlcl-apprentice-session-handoff-item-command-builder.html");
const readmePath = join(builderDir, "TLCL_APPRENTICE_SESSION_HANDOFF_ITEM_COMMAND_BUILDER_START_HERE.md");
const items = normalizeItems(queue);
const builderLocks = locks();
const builder = {
  ok: true,
  format: "transparent_ai_tlcl_apprentice_session_handoff_item_command_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: queue ? "waiting_for_teacher_single_handoff_item_review" : "waiting_for_tlcl_handoff_queue_path",
  queueFormat,
  queueSupported: supportedQueue,
  counts: {
    queueItems: items.length,
    waitingItems: items.filter((item) => String(item.status).includes("waiting")).length,
    readyItems: items.filter((item) => String(item.status).includes("ready")).length,
    placeholderItems: items.filter((item) => item.placeholders.length > 0).length
  },
  items,
  continuationRequestTemplate: {
    format: "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_v1",
    queuePath: queueInput.path || "<tlcl-apprentice-session-launcher-handoff-queue.json>",
    itemNumber: "<teacher-reviewed-item-number>",
    teacherConfirmation: "<teacher-confirmed-tlcl-handoff-item>",
    retainedRollbackPoint: "<retained-rollback-point-path-or-label>",
    executeNow: false,
    reviewOnly: true
  },
  blockedActions: [
    "execute_handoff_item_from_builder",
    "auto_run_next_call_from_builder",
    "invoke_model_from_builder",
    "fetch_rag_from_builder",
    "write_memory_from_builder",
    "enable_rule_from_builder",
    "unlock_packaging_from_builder",
    "claim_completion_from_builder"
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
writeFileSync(
  readmePath,
  [
    "# TLCL Apprentice Session Handoff Item Command Builder",
    "",
    `- Status: ${builder.status}`,
    `- Queue format: ${builder.queueFormat}`,
    `- Queue: ${queueInput.path || "<queue path not loaded yet>"}`,
    `- Builder HTML: ${htmlPath}`,
    "",
    "This builder creates copyable continuation request text for exactly one TLCL handoff queue item.",
    "",
    "Safety boundary:",
    "- It does not execute the queue item.",
    "- It does not auto-run nextCall, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n") + "\n",
  "utf8"
);

const rows = items
  .map(
    (item) => `<tr>
      <td><input type="radio" name="item" value="${item.order}" ${item.order === 1 ? "checked" : ""}></td>
      <td>${item.order}</td>
      <td>${htmlEscape(item.status)}</td>
      <td>${htmlEscape(item.selectedRoute)}</td>
      <td>${htmlEscape(item.commandKind)}</td>
      <td>${htmlEscape(item.placeholders.join(", ") || "none")}</td>
      <td>${htmlEscape(item.teacherAction)}</td>
    </tr>`
  )
  .join("\n");

writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TLCL Handoff Item Command Builder</title>
  <style>
    :root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; background: #f6f8fb; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1160px; margin: 0 auto; padding: 22px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d7dee9; border-radius: 8px; padding: 16px; margin-top: 12px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); }
    label { display: block; margin: 8px 0; }
    input[type="text"], textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px; font: 13px "Segoe UI", Arial, sans-serif; }
    input[type="radio"] { width: 18px; height: 18px; }
    textarea { min-height: 190px; font-family: Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 8px 12px; cursor: pointer; margin: 6px 6px 0 0; }
    button.secondary { background: #fff; color: #174d89; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { padding: 9px; border-bottom: 1px solid #e6edf6; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; }
    code { word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Apprentice Session Handoff Item Command Builder</h1>
    <p>This page creates a continuation request for one reviewed handoff queue item only. It does not execute nextCall, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.</p>
    <section class="panel">
      <p>Status: <code>${htmlEscape(builder.status)}</code></p>
      <p>Queue: ${queueInput.path ? `<a href="${htmlEscape(pathToFileURL(queueInput.path).href)}">${htmlEscape(queueInput.path)}</a>` : "<code>&lt;queue path not loaded yet&gt;</code>"}</p>
      <label>Queue path
        <input id="queuePath" type="text" value="${htmlEscape(queueInput.path || "<tlcl-apprentice-session-launcher-handoff-queue.json>")}">
      </label>
      <label>Teacher confirmation
        <input id="teacherConfirmation" type="text" value="teacher reviewed TLCL handoff queue item">
      </label>
      <label>Retained rollback point
        <input id="rollbackPoint" type="text" value="<retained-rollback-point-path-or-label>">
      </label>
      <button id="generateRequest">Generate continuation request</button>
      <button id="copyRequest" class="secondary">Copy request JSON</button>
      <button id="copyNextCall" class="secondary">Copy selected nextCall</button>
      <textarea id="requestJson" spellcheck="false"></textarea>
    </section>
    <section class="panel">
      <table>
        <thead><tr><th>Pick</th><th>#</th><th>Status</th><th>Route</th><th>Command</th><th>Placeholders</th><th>Teacher Action</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const output = document.getElementById("requestJson");
    function selectedItem() {
      const selected = Number(document.querySelector('input[name="item"]:checked')?.value || 1);
      return builder.items.find((item) => Number(item.order) === selected) || builder.items[0];
    }
    function request() {
      const item = selectedItem();
      return {
        format: "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_v1",
        queuePath: document.getElementById("queuePath").value,
        itemNumber: item.order,
        itemId: item.id,
        selectedRoute: item.selectedRoute,
        commandTemplate: item.commandTemplate,
        nextCall: item.nextCall,
        handoffInputs: item.handoffInputs,
        teacherConfirmation: document.getElementById("teacherConfirmation").value,
        retainedRollbackPoint: document.getElementById("rollbackPoint").value,
        executeNow: false,
        reviewOnly: true,
        locks: builder.locks
      };
    }
    function render() {
      const value = request();
      output.value = JSON.stringify(value, null, 2);
      return value;
    }
    document.getElementById("generateRequest").addEventListener("click", render);
    document.getElementById("copyRequest").addEventListener("click", async () => {
      await navigator.clipboard.writeText(JSON.stringify(render(), null, 2));
    });
    document.getElementById("copyNextCall").addEventListener("click", async () => {
      await navigator.clipboard.writeText(JSON.stringify(render().nextCall, null, 2));
    });
    render();
  </script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_apprentice_session_handoff_item_command_builder_result_v1",
      status: builder.status,
      queueFormat: builder.queueFormat,
      queueSupported: builder.queueSupported,
      queueItems: builder.counts.queueItems,
      builderPath,
      htmlPath,
      readmePath,
      locks: builderLocks
    },
    null,
    2
  )
);
