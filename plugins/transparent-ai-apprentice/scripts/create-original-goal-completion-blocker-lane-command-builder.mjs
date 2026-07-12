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
    String(value || "original-goal-completion-blocker-lane-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-completion-blocker-lane-command-builder"
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

function array(value) {
  return Array.isArray(value) ? value : [];
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

function commandPlaceholders(command) {
  const text = String(command || "");
  return Array.from(new Set([...(text.match(/<[^<>]+>/g) || []), ...(text.match(/__[A-Z0-9_]+__/g) || [])]));
}

function queueItems(queue) {
  return array(queue?.queueItems);
}

function recommendedGoalLane(items) {
  const priorityLanes = [
    "all_software_low_token_coverage_evidence",
    "teacher_reviewed_triggered_visual_evidence_path",
    "transparent_sketch_spatial_intent_teacher_export",
    "voice_text_numbered_confirmation_supervised_execution_gate",
    "unattended_operational_monitor_evidence",
    "universal_native_execution_control_channel"
  ];
  for (const lane of priorityLanes) {
    const found = items.find((item) => item.lane === lane);
    if (found) return found;
  }
  return items[0] || null;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotRunCommands: true,
    builderDoesNotValidateReceipts: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRules: true,
    generatedCommandStillRequiresTeacherReview: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    commandsExecuted: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
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
        id: "placeholder_completion_blocker_lane_001",
        number: 1,
        order: 1,
        lane: "waiting_for_completion_blocker_next_step_queue",
        status: "waiting_for_queue_path",
        nextSafeAction: "Load an original-goal completion blocker next-step queue first.",
        commandTemplate: "",
        missingInputs: ["<original-goal-completion-blocker-next-step-queue.json>"],
        evidenceLinks: [],
        blockedClaims: []
      }
    ];
  }
  return items.map((item, index) => {
    const commandTemplate = item.commandTemplate || "";
    const missingInputs = Array.from(new Set([...array(item.missingInputs), ...commandPlaceholders(commandTemplate)]));
    const hasPlaceholders = missingInputs.length > 0;
    const currentStatus = item.status || "";
    const status =
      hasPlaceholders && currentStatus === "ready_for_review_only_manual_follow_up"
        ? "waiting_for_placeholder_replacement"
        : currentStatus;
    return {
      id: item.id || item.sourceRowId || `completion_blocker_lane_${String(index + 1).padStart(3, "0")}`,
      number: item.number || item.order || index + 1,
      order: item.order || item.number || index + 1,
      lane: item.lane || "",
      status,
      priority: item.priority ?? 99,
      requirement: item.requirement || "",
      currentEvidence: item.currentEvidence || "",
      missingProof: item.missingProof || "",
      nextSafeAction: item.nextSafeAction || "",
      commandTemplate,
      commandRisk: { ...(item.commandRisk || {}), hasPlaceholders, placeholders: missingInputs },
      missingInputs,
      evidenceLinks: array(item.evidenceLinks),
      blockedClaims: array(item.blockedClaims)
    };
  });
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Completion Blocker Lane Command Builder",
    "",
    `Status: ${builder.status}`,
    `Queue: ${builder.paths.sourceQueue || "<queue path not loaded yet>"}`,
    `Items: ${builder.counts.queueItems}`,
    `Offline request packets: ${builder.counts.offlineRequestPackets}`,
    `Recommended goal-progress lane: ${builder.recommendedGoalLane || ""}`,
    "",
    "Use the HTML page to choose one completion-blocker lane, review evidence links, and generate a teacher-reviewed command/request packet.",
    "",
    "Offline packet handoff:",
    `- Request packet directory: ${builder.paths.requestPacketsDir || "<not generated>"}`,
    "- Each lane has a request JSON, a command snippet, and a receipt-builder command template.",
    "- Use the request JSON with create-original-goal-completion-blocker-lane-request-receipt-builder.mjs before any runner is considered.",
    "",
    "Safety boundary:",
    "- This builder only creates command text and request JSON.",
    "- It does not run commands, validate receipts, register tasks, launch runners, execute target software, capture screenshots, read full logs, write memory, enable rules, unlock packaging, or claim completion.",
    "- Gated lanes still require separate teacher receipts, placeholder replacement, and rollback evidence before any downstream runner."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const rows = builder.items
    .map((item) => {
      const links = item.evidenceLinks
        .map((link) => {
          if (link.kind === "existing_file") {
            return `<a href="${htmlEscape(fileHref(link.value))}">${htmlEscape(link.basename || basename(link.value))}</a>`;
          }
          return `<code>${htmlEscape(link.value || "")}</code>`;
        })
        .join("<br>");
      return `<tr>
        <td><input type="radio" name="lane" value="${htmlEscape(item.number)}" ${item.defaultSelected ? "checked" : ""}></td>
        <td>${htmlEscape(item.number)}</td>
        <td>${htmlEscape(item.lane)}</td>
        <td>${htmlEscape(item.status)}</td>
        <td>${htmlEscape(item.nextSafeAction)}</td>
        <td>${links}</td>
        <td><code>${htmlEscape(item.missingInputs.join(", "))}</code></td>
        <td>${item.requestPath ? `<a href="${htmlEscape(fileHref(item.requestPath))}">${htmlEscape(basename(item.requestPath))}</a>` : ""}<br><code>${htmlEscape(item.receiptBuilderCommand || "")}</code></td>
      </tr>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Completion Blocker Lane Command Builder</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1260px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.5; }
    .panel { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; padding: 14px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    label { display: block; margin: 10px 0; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 8px; font: 14px "Segoe UI", Arial, sans-serif; }
    input[type="radio"] { width: 18px; height: 18px; }
    textarea { min-height: 240px; font: 13px Consolas, monospace; }
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
    <h1>Original Goal Completion Blocker Lane Command Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Recommended goal-progress lane:</strong> <code>${htmlEscape(builder.recommendedGoalLane || "")}</code></p>
    <p><strong>Priority reason:</strong> ${htmlEscape(builder.priorityReason || "")}</p>
    <p><strong>Queue:</strong> ${builder.paths.sourceQueue ? `<a href="${htmlEscape(fileHref(builder.paths.sourceQueue))}">${htmlEscape(builder.paths.sourceQueue)}</a>` : "<code>choose a completion-blocker next-step queue path when generating this builder</code>"}</p>
    <p class="lock">This page only generates command text and request JSON. It does not run commands, validate receipts, register tasks, launch runners, capture screenshots, write memory, execute target software, unlock packaging, or claim completion.</p>
    <section class="panel">
      <label>Queue path
        <input id="queuePath" value="${htmlEscape(builder.paths.sourceQueue || "<original-goal-completion-blocker-next-step-queue.json>")}">
      </label>
      <label>Teacher confirmation note
        <input id="teacherNote" value="teacher reviewed this completion blocker lane and wants the next review-only step">
      </label>
      <label>Retained rollback point
        <input id="rollbackPoint" value="<retained-rollback-point-path-or-label>">
      </label>
      <label>Replacement JSON for missing inputs, optional
        <textarea id="replacementJson" spellcheck="false">{
  "example": "replace placeholder values before downstream use"
}</textarea>
      </label>
      <div class="controls">
        <button id="generateCommand">Generate lane command/request</button>
        <button id="copyCommand" class="secondary">Copy command</button>
        <button id="downloadRequest" class="secondary">Download lane request JSON</button>
      </div>
      <textarea id="output" spellcheck="false"></textarea>
    </section>
    <table>
      <thead><tr><th>Pick</th><th>#</th><th>Lane</th><th>Status</th><th>Next Safe Action</th><th>Evidence</th><th>Missing Inputs</th><th>Offline Request</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const output = document.getElementById("output");
    function selectedItem() {
      const number = Number(document.querySelector('input[name="lane"]:checked')?.value || 1);
      return builder.items.find((item) => Number(item.number) === number) || builder.items[0];
    }
    function makeRequest() {
      const item = selectedItem();
      let replacements = {};
      try { replacements = JSON.parse(document.getElementById("replacementJson").value || "{}"); }
      catch { replacements = { parseError: "replacementJson is not valid JSON" }; }
      const request = {
        format: "transparent_ai_original_goal_completion_blocker_lane_command_request_v1",
        generatedBy: "original_goal_completion_blocker_lane_command_builder",
        queuePath: document.getElementById("queuePath").value.trim(),
        recommendedGoalLane: builder.recommendedGoalLane,
        goalProgressLane: item.lane === builder.recommendedGoalLane,
        priorityReason: builder.priorityReason,
        lane: item.lane,
        itemNumber: item.number,
        status: item.status,
        nextSafeAction: item.nextSafeAction,
        commandTemplate: item.commandTemplate,
        missingInputs: item.missingInputs,
        replacements,
        teacherNote: document.getElementById("teacherNote").value.trim(),
        rollbackPoint: document.getElementById("rollbackPoint").value.trim(),
        gated: String(item.status || "").includes("gated"),
        evidenceLinks: item.evidenceLinks,
        blockedClaims: item.blockedClaims,
        locks: builder.locks
      };
      const rendered = item.commandTemplate || "# No command template for this lane yet; open linked evidence and continue review.";
      request.command = rendered;
      output.value = rendered + "\\n\\n" + JSON.stringify(request, null, 2);
      return request;
    }
    document.getElementById("generateCommand").addEventListener("click", makeRequest);
    document.getElementById("copyCommand").addEventListener("click", async () => {
      const request = makeRequest();
      if (navigator.clipboard) await navigator.clipboard.writeText(request.command);
    });
    document.getElementById("downloadRequest").addEventListener("click", () => {
      const request = makeRequest();
      const blob = new Blob([JSON.stringify(request, null, 2) + "\\n"], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "original-goal-completion-blocker-lane-command-request.json";
      link.click();
      URL.revokeObjectURL(link.href);
    });
    makeRequest();
  </script>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function buildLaneRequest({ item, queuePath, locks: builderLocks, recommendedLane = "", priorityReason = "" }) {
  const request = {
    format: "transparent_ai_original_goal_completion_blocker_lane_command_request_v1",
    generatedBy: "original_goal_completion_blocker_lane_command_builder",
    generatedMode: "offline_request_packet",
    queuePath,
    recommendedGoalLane: recommendedLane,
    goalProgressLane: item.lane === recommendedLane,
    priorityReason,
    lane: item.lane,
    itemNumber: item.number,
    status: item.status,
    nextSafeAction: item.nextSafeAction,
    commandTemplate: item.commandTemplate,
    missingInputs: item.missingInputs,
    hasPlaceholders: item.missingInputs.length > 0,
    placeholderReplacementRequired: item.missingInputs.length > 0,
    replacements: {},
    teacherNote: "teacher must review this completion blocker lane before any downstream use",
    rollbackPoint: "<retained-rollback-point-path-or-label>",
    gated: String(item.status || "").includes("gated"),
    evidenceLinks: item.evidenceLinks,
    blockedClaims: item.blockedClaims,
    locks: builderLocks
  };
  request.command = item.commandTemplate || "# No command template for this lane yet; open linked evidence and continue review.";
  return request;
}

function writeOfflineLanePackets({ items, queuePath, packetDir, locks: builderLocks, recommendedLane = "", priorityReason = "" }) {
  mkdirSync(packetDir, { recursive: true });
  return items.map((item) => {
    const packetSlug = `${String(item.order || item.number || 0).padStart(2, "0")}-${slugify(item.lane || item.id)}`;
    const requestPath = join(packetDir, `${packetSlug}-lane-request.json`);
    const commandPath = join(packetDir, `${packetSlug}-command.txt`);
    const request = buildLaneRequest({ item, queuePath, locks: builderLocks, recommendedLane, priorityReason });
    const receiptBuilderCommand = commandLine("create-original-goal-completion-blocker-lane-request-receipt-builder.mjs", [
      ["--request", requestPath],
      ["--output-dir", join(packetDir, `${packetSlug}-receipt-builder`)]
    ]);
    request.nextReceiptBuilderCommand = receiptBuilderCommand;
    writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, "utf8");
    writeFileSync(
      commandPath,
      [
        request.command,
        "",
        "# Next review-only receipt-builder command:",
        receiptBuilderCommand,
        ""
      ].join("\n"),
      "utf8"
    );
    return {
      ...item,
      goalProgressLane: item.lane === recommendedLane,
      requestPath,
      commandSnippetPath: commandPath,
      receiptBuilderCommand
    };
  });
}

const goal = argValue("--goal", "Build a teacher-facing command page for one original-goal completion blocker lane.");
const queueInput = readJsonInput(argValue("--queue", argValue("--next-step-queue", "")), "--queue");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-lane-command-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const queue = queueInput.value;
if (queue && queue.format !== "transparent_ai_original_goal_completion_blocker_next_step_queue_v1") {
  throw new Error("--queue must be transparent_ai_original_goal_completion_blocker_next_step_queue_v1");
}

const builderPath = join(builderDir, "original-goal-completion-blocker-lane-command-builder.json");
const htmlPath = join(builderDir, "original-goal-completion-blocker-lane-command-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_COMPLETION_BLOCKER_LANE_COMMAND_BUILDER_START_HERE.md");
const requestPacketsDir = join(builderDir, "offline-lane-request-packets");
const builderLocks = locks();
const normalizedQueueItems = normalizedItems(queue);
const recommendedItem = recommendedGoalLane(normalizedQueueItems);
const selectedLane = recommendedItem?.lane || "";
const priorityReason = selectedLane
  ? "Default to the lane that most directly advances the original objective while preserving rollback and teacher gates."
  : "No queue lane was available; load a completion blocker next-step queue first.";
const items = writeOfflineLanePackets({
  items: normalizedQueueItems.map((item) => ({
    ...item,
    defaultSelected: item.lane === selectedLane
  })),
  queuePath: queueInput.path,
  packetDir: requestPacketsDir,
  locks: builderLocks,
  recommendedLane: selectedLane,
  priorityReason
});
const builder = {
  ok: true,
  format: "transparent_ai_original_goal_completion_blocker_lane_command_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: queue ? "waiting_for_teacher_single_completion_blocker_lane_command_generation" : "waiting_for_completion_blocker_next_step_queue_path",
  queueSupported: Boolean(queue),
  recommendedGoalLane: selectedLane,
  priorityReason,
  counts: {
    queueItems: items.length,
    gatedItems: items.filter((item) => String(item.status || "").includes("gated")).length,
    missingInputItems: items.filter((item) => item.missingInputs.length > 0).length,
    goalProgressLanePackets: items.filter((item) => item.goalProgressLane).length,
    offlineRequestPackets: items.filter((item) => item.requestPath).length,
    offlineCommandSnippets: items.filter((item) => item.commandSnippetPath).length
  },
  items,
  blockedActions: [
    "execute_command_from_completion_blocker_lane_command_builder",
    "validate_receipt_from_completion_blocker_lane_command_builder",
    "register_task_from_completion_blocker_lane_command_builder",
    "launch_runner_from_completion_blocker_lane_command_builder",
    "execute_target_software_from_completion_blocker_lane_command_builder",
    "capture_screenshot_from_completion_blocker_lane_command_builder",
    "write_memory_from_completion_blocker_lane_command_builder",
    "claim_goal_complete_from_completion_blocker_lane_command_builder"
  ],
  locks: builderLocks,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    requestPacketsDir,
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
      format: "transparent_ai_original_goal_completion_blocker_lane_command_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      status: builder.status,
      queueItems: builder.counts.queueItems,
      gatedItems: builder.counts.gatedItems,
      requestPacketsDir,
      offlineRequestPackets: builder.counts.offlineRequestPackets,
      locks: builderLocks
    },
    null,
    2
  )
);
