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
    String(value || "original-goal-remaining-gates-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-remaining-gates-receipt-builder"
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

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
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
    builderDoesNotWriteReceipt: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotRunCommands: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotWriteMemory: true,
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
}

function gateGroupRows(packet) {
  return (packet.gateGroups || []).map((row, index) => ({
    id: `gate_group_${slugify(row.lane || index + 1)}`,
    sourceKind: "gate_group",
    order: index + 1,
    label: row.lane || `Gate group ${index + 1}`,
    lane: row.lane || "",
    status: row.firstStatus || "",
    nextAction: row.firstNextAction || "",
    openPath: packet.sourceEvidence?.gapActionBoard || "",
    command: packet.sourceEvidence?.gapActionBoard || "",
    defaultDecision: "needs_teacher_review"
  }));
}

function routeRows(packet) {
  return (packet.shortestTeacherRoute || []).map((row, index) => ({
    id: `teacher_route_${String(row.order || index + 1).padStart(3, "0")}`,
    sourceKind: "teacher_route",
    order: row.order || index + 1,
    label: row.reviewEntryId || row.lane || `Teacher route ${index + 1}`,
    lane: row.lane || "",
    status: "waiting_for_teacher_route_review",
    nextAction: row.teacherInstruction || "",
    openPath: row.openPath || "",
    command: row.validationCommand || row.openPath || "",
    defaultDecision: "needs_teacher_review",
    sourceRouteRowId: row.id || "",
    reviewEntryId: row.reviewEntryId || ""
  }));
}

function lowTokenRows(packet) {
  return (packet.nextLowTokenActions || []).map((row, index) => ({
    id: `low_token_action_${slugify(row.id || index + 1)}`,
    sourceKind: "low_token_action",
    order: index + 1,
    label: row.id || `Low-token action ${index + 1}`,
    lane: row.route || "",
    status: row.status || "",
    nextAction: row.nextInstruction || row.reason || "",
    openPath: row.evidencePath || "",
    command: row.evidencePath || row.nextTool || "",
    defaultDecision: "needs_teacher_review",
    estimatedTokenCost: row.estimatedTokenCost ?? null,
    screenshotCostClass: row.screenshotCostClass || "",
    software: row.software || ""
  }));
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Remaining Gates Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Packet: ${builder.paths.sourcePacket}`,
    "",
    "Use this HTML page after the teacher reviews the low-token remaining-gates packet. The page can generate, copy, or download a teacher-filled receipt JSON in the browser.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder writes only review packets, a blank receipt template, and a browser receipt generator.",
    "- The browser generator does not write the generated receipt to disk unless the teacher explicitly downloads it.",
    "- It does not validate receipts.",
    "- It does not run commands, register tasks, launch runners, execute target software, capture screenshots, write memory, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const rows = builder.reviewRows
    .map(
      (row) => `<article class="row" data-row-id="${htmlEscape(row.id)}">
        <header>
          <strong>${htmlEscape(row.order)}. ${htmlEscape(row.label)}</strong>
          <span>${htmlEscape(row.sourceKind)}</span>
        </header>
        <p>${htmlEscape(row.nextAction || "Review this row before selecting a downstream queue decision.")}</p>
        <p>Status: <code>${htmlEscape(row.status)}</code></p>
        <p>${row.openPath ? `<a href="${htmlEscape(fileHref(row.openPath))}">${htmlEscape(basename(row.openPath))}</a>` : ""}</p>
        <label>Teacher decision
          <select data-field="teacherDecision">
            <option value="needs_teacher_review">needs_teacher_review</option>
            <option value="teacher_reviewed_opened">teacher_reviewed_opened</option>
            <option value="ready_for_next_review_queue">ready_for_next_review_queue</option>
            <option value="blocked_needs_more_evidence">blocked_needs_more_evidence</option>
          </select>
        </label>
        <label class="inline"><input type="checkbox" data-field="evidenceReviewed"> Evidence reviewed</label>
        <label>Observed evidence path
          <input data-field="observedEvidencePath" value="${htmlEscape(row.openPath || "")}">
        </label>
        <label>Teacher note
          <input data-field="teacherNote" placeholder="What did the teacher actually verify?">
        </label>
      </article>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Remaining Gates Receipt Builder</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.5; }
    .panel, .row { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; padding: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
    .row header { display: flex; justify-content: space-between; gap: 8px; align-items: start; }
    .row header span { color: #586579; font-size: 12px; }
    label { display: block; margin: 8px 0; }
    label.inline { display: flex; align-items: center; gap: 6px; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 8px; font: 14px "Segoe UI", Arial, sans-serif; }
    input[type="checkbox"] { width: 18px; height: 18px; }
    textarea { min-height: 240px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    .lock { color: #4d5b70; font-size: 13px; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  </style>
</head>
<body>
  <main>
    <h1>Original Goal Remaining Gates Receipt Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Receipt template:</strong> <a href="${htmlEscape(fileHref(builder.paths.receiptTemplate))}">${htmlEscape(builder.paths.receiptTemplate)}</a></p>
    <p><strong>Validation command:</strong> <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    <p class="lock">This builder only creates receipt JSON in your browser. It does not save files automatically, validate, execute, register, capture screenshots, write memory, accept technology, unlock packaging, or claim completion.</p>
    <section class="panel">
      <h2>Generate Reviewed Receipt JSON</h2>
      <div class="controls">
        <button id="copyTemplate">Copy blank template</button>
        <button id="generateReceipt">Generate reviewed receipt JSON</button>
        <button id="downloadReceipt" class="secondary">Download receipt JSON</button>
        <button id="copyValidation" class="secondary">Copy validation command</button>
      </div>
      <textarea id="output" spellcheck="false"></textarea>
    </section>
    <h2>Rows To Review</h2>
    <section class="grid">${rows}</section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const output = document.getElementById("output");
    function copyText(text) {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      output.value = text;
    }
    function reviewedReceipt() {
      const receipt = JSON.parse(JSON.stringify(builder.receiptTemplate));
      for (const row of receipt.rowDecisions) {
        const card = document.querySelector('[data-row-id="' + CSS.escape(row.id) + '"]');
        if (!card) continue;
        row.teacherDecision = card.querySelector('[data-field="teacherDecision"]').value;
        row.evidenceReviewed = card.querySelector('[data-field="evidenceReviewed"]').checked;
        row.observedEvidencePath = card.querySelector('[data-field="observedEvidencePath"]').value.trim();
        row.teacherNote = card.querySelector('[data-field="teacherNote"]').value.trim();
      }
      receipt.generatedBy = "original_goal_remaining_gates_browser_receipt_builder";
      receipt.builderLocks = builder.locks;
      return receipt;
    }
    function renderReceipt() {
      output.value = JSON.stringify(reviewedReceipt(), null, 2);
    }
    function downloadReceipt() {
      renderReceipt();
      const blob = new Blob([output.value + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "teacher-filled-remaining-gates-receipt.json";
      link.click();
      URL.revokeObjectURL(url);
    }
    document.getElementById("copyTemplate").addEventListener("click", () => {
      copyText(JSON.stringify(builder.receiptTemplate, null, 2));
    });
    document.getElementById("generateReceipt").addEventListener("click", renderReceipt);
    document.getElementById("downloadReceipt").addEventListener("click", downloadReceipt);
    document.getElementById("copyValidation").addEventListener("click", () => {
      copyText(builder.nextValidationCommand);
    });
    renderReceipt();
  </script>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build a teacher receipt template for the original-goal remaining gates packet.");
const packetInput = readJsonInput(
  argValue("--packet", argValue("--remaining-gates-packet", "")),
  "--packet",
  "transparent_ai_original_goal_remaining_gates_packet_v1"
);
if (!packetInput.value) throw new Error("--packet is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-remaining-gates-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const packet = packetInput.value;
const builderPath = join(builderDir, "original-goal-remaining-gates-receipt-builder.json");
const htmlPath = join(builderDir, "original-goal-remaining-gates-receipt-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_REMAINING_GATES_RECEIPT_BUILDER_START_HERE.md");
const receiptTemplatePath = join(builderDir, "teacher-remaining-gates-receipt-template.json");
const reviewRows = [...gateGroupRows(packet), ...routeRows(packet), ...lowTokenRows(packet)].map((row, index) => ({
  ...row,
  order: index + 1,
  openPathExists: row.openPath ? existsSync(row.openPath) : false,
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_reviewed_opened",
    "ready_for_next_review_queue",
    "blocked_needs_more_evidence"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "execute_now",
    "register_now",
    "run_execute_mode",
    "memory_enabled",
    "claim_complete",
    "native_universal_execution",
    "unlock_packaging"
  ]
}));
const builderLocks = locks();

const receiptTemplate = {
  format: "transparent_ai_original_goal_remaining_gates_receipt_v1",
  packetId: packet.packetId || "",
  builderId,
  defaultDecision: "needs_teacher_review",
  teacherInstruction:
    "Mark only the rows the teacher actually reviewed. Use ready_for_next_review_queue only after evidenceReviewed=true and a concrete observed evidence path or note is present.",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_reviewed_opened",
    "ready_for_next_review_queue",
    "blocked_needs_more_evidence"
  ],
  rowDecisions: reviewRows.map((row) => ({
    id: row.id,
    sourceKind: row.sourceKind,
    label: row.label,
    teacherDecision: "needs_teacher_review",
    evidenceReviewed: false,
    observedEvidencePath: "",
    teacherNote: ""
  })),
  blockedActions: [
    "accepted",
    "execute_now",
    "register_now",
    "run_execute_mode",
    "memory_enabled",
    "claim_complete",
    "native_universal_execution",
    "unlock_packaging"
  ],
  locks: builderLocks
};

const builder = {
  ok: true,
  format: "transparent_ai_original_goal_remaining_gates_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_remaining_gates_receipt",
  sourcePacketStatus: packet.status || "",
  sourceCompletionDecision: packet.completionBoundary?.completionDecision || "",
  counts: {
    reviewRows: reviewRows.length,
    gateGroupRows: reviewRows.filter((row) => row.sourceKind === "gate_group").length,
    teacherRouteRows: reviewRows.filter((row) => row.sourceKind === "teacher_route").length,
    lowTokenActionRows: reviewRows.filter((row) => row.sourceKind === "low_token_action").length,
    openableRows: reviewRows.filter((row) => row.openPathExists).length
  },
  reviewRows,
  receiptTemplate,
  browserReceiptBuilder: {
    outputFormat: "transparent_ai_original_goal_remaining_gates_receipt_v1",
    generatesReceiptJsonInBrowser: true,
    downloadsReceiptJsonOnly: true,
    doesNotWriteReceiptToDisk: true,
    doesNotValidateReceipt: true,
    doesNotRunCommands: true
  },
  nextValidationCommand: commandLine("validate-original-goal-remaining-gates-receipt.mjs", [
    ["--packet", packetInput.path || "<original-goal-remaining-gates-packet.json>"],
    ["--receipt", "<teacher-filled-remaining-gates-receipt.json>"]
  ]),
  blockedActions: receiptTemplate.blockedActions,
  locks: builderLocks,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourcePacket: packetInput.path
  }
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeHtml(htmlPath, builder);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_remaining_gates_receipt_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      nextValidationCommand: builder.nextValidationCommand,
      status: builder.status,
      counts: builder.counts,
      reviewRows: reviewRows.length,
      locks: builderLocks
    },
    null,
    2
  )
);
