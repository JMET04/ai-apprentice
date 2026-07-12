#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function q(value) {
  const text = String(value ?? "");
  return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function commandText(scriptName, args = []) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map(q)
    .join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotReadLogs: true,
    builderDoesNotTailLogs: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotCreateQueue: true,
    builderDoesNotInitializeWatchBaseline: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotDeleteRollbackPoints: true,
    fullContinuousRecording: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function candidateId(candidate, index) {
  return String(candidate.software || candidate.processName || `candidate-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || `candidate-${index + 1}`;
}

function scoreCandidate(candidate) {
  const logFiles = Array.isArray(candidate.candidateLogFiles) ? candidate.candidateLogFiles.length : 0;
  const roots = Array.isArray(candidate.candidateLogRoots) ? candidate.candidateLogRoots.length : 0;
  const events = Array.isArray(candidate.windowsEventLogs) ? candidate.windowsEventLogs.length : 0;
  const active = candidate.processName || candidate.windowTitle ? 2 : 0;
  return logFiles * 6 + roots * 3 + events + active + Number(candidate.confidence || 0);
}

function compactCandidate(candidate, originalIndex) {
  const logFiles = Array.isArray(candidate.candidateLogFiles) ? candidate.candidateLogFiles : [];
  return {
    rowNumber: originalIndex + 1,
    rowId: candidateId(candidate, originalIndex),
    software: candidate.software || candidate.processName || "unknown",
    processName: candidate.processName || "",
    windowTitle: candidate.windowTitle || "",
    installPath: candidate.installPath || "",
    reason: candidate.reason || "",
    score: scoreCandidate(candidate),
    logMetadataCount: logFiles.length,
    candidateLogRoots: Array.isArray(candidate.candidateLogRoots) ? candidate.candidateLogRoots.slice(0, 5) : [],
    sampleLogMetadata: logFiles.slice(0, 2).map((item) => ({
      path: item.path || "",
      bytes: item.bytes ?? null,
      lastWriteTimeUtc: item.lastWriteTimeUtc || "",
      lowTokenUse: item.lowTokenUse || "metadata_first_then_tail_on_trigger"
    })),
    windowsEventLogs: Array.isArray(candidate.windowsEventLogs) ? candidate.windowsEventLogs : []
  };
}

function selectBatch(candidates, batchSize) {
  return candidates
    .map((candidate, index) => ({ candidate, index, score: scoreCandidate(candidate) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, batchSize)
    .map((item) => compactCandidate(item.candidate, item.index));
}

function buildReceiptTemplate(rows, builderId, inventoryPath) {
  return {
    format: "transparent_ai_all_software_observer_inventory_review_receipt_v1",
    builderId,
    status: "waiting_for_teacher_inventory_batch_review",
    teacherConfirmationText: "",
    teacherConfirmedPrivateAppsExcluded: false,
    teacherConfirmedReadOnlyObservationOnly: false,
    batchOnly: true,
    batchPolicy: "Only reviewed rows enter the bridge; missing inventory rows are ignored and cannot enter the queue.",
    defaultScreenshotPolicy: "only_after_log_event_file_delta_or_teacher_marker_is_ambiguous",
    allowedDecisions: ["exclude_private_or_out_of_scope", "priority_observe", "observe_later", "needs_teacher_source", "blocked"],
    blockedDecisions: ["accepted", "enable_memory", "native_universal_execution", "continuous_recording", "execute_software"],
    rows: rows.map((row) => ({
      rowNumber: row.rowNumber,
      rowId: row.rowId,
      software: row.software,
      decision: "needs_teacher_source",
      teachingStyle: "ask_teacher_when_ambiguous",
      teacherLogSourceHint: "",
      teacherNote: "",
      approvedForReviewedObservation: false
    })),
    nextReviewedQueueBridgeCommandTemplate: commandText("create-all-software-observer-reviewed-queue-from-receipt.mjs", [
      "--inventory",
      inventoryPath,
      "--receipt",
      "<teacher-filled-all-software-inventory-batch-review-receipt.json>",
      "--output-dir",
      join("artifacts", "current-goal-all-software-observer-reviewed-queues")
    ]),
    locks: locks()
  };
}

function writeHtml(path, builder) {
  const rows = builder.reviewRows
    .map(
      (row) => `<article class="row" data-row="${htmlEscape(row.rowId)}">
        <h3>${htmlEscape(row.rowNumber)}. ${htmlEscape(row.software)}</h3>
        <p><strong>Process:</strong> ${htmlEscape(row.processName || "unknown")}</p>
        <p><strong>Signals:</strong> score ${htmlEscape(row.score)}; log metadata ${htmlEscape(row.logMetadataCount)}; event logs ${htmlEscape(row.windowsEventLogs.join(", ") || "none")}</p>
        <p><strong>Roots:</strong> <code>${htmlEscape(row.candidateLogRoots.join("; ") || "none")}</code></p>
        <label>Decision
          <select class="decision">
            <option value="needs_teacher_source">needs_teacher_source</option>
            <option value="priority_observe">priority_observe</option>
            <option value="observe_later">observe_later</option>
            <option value="exclude_private_or_out_of_scope">exclude_private_or_out_of_scope</option>
            <option value="blocked">blocked</option>
          </select>
        </label>
        <label>Teaching style
          <select class="teachingStyle">
            <option value="ask_teacher_when_ambiguous">ask_teacher_when_ambiguous</option>
            <option value="silent_work_along_from_deltas">silent_work_along_from_deltas</option>
            <option value="step_narration">step_narration</option>
            <option value="before_after_examples">before_after_examples</option>
            <option value="transparent_overlay_annotations">transparent_overlay_annotations</option>
            <option value="voice_or_text_instruction">voice_or_text_instruction</option>
            <option value="manual_teacher_markers">manual_teacher_markers</option>
          </select>
        </label>
        <label>Teacher log/source hint <input class="sourceHint" placeholder="log source, marker, or reason"></label>
        <label>Teacher note <input class="teacherNote" placeholder="private exclusion reason, priority reason, or blocker"></label>
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
  <title>All Software Inventory Batch Review Builder</title>
  <style>
    body { margin: 0; background: #f7f8fb; color: #18212f; font-family: "Segoe UI", Arial, sans-serif; }
    main { max-width: 1040px; margin: 0 auto; padding: 28px; }
    section, .row { background: #fff; border: 1px solid #d8e0eb; border-radius: 8px; padding: 16px; margin: 12px 0; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    label { display: block; margin: 10px 0; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; font: 14px "Segoe UI", Arial, sans-serif; }
    textarea { min-height: 240px; font-family: Consolas, monospace; }
    button { border: 1px solid #1f5f8b; background: #1f5f8b; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #1f5f8b; }
    .controls { display: flex; gap: 8px; flex-wrap: wrap; }
    .lock { color: #7a2d12; font-weight: 700; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
  </style>
</head>
<body>
<main>
  <h1>All Software Inventory Batch Review Builder</h1>
  <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
  <p><strong>Batch:</strong> ${htmlEscape(builder.counts.reviewRows)} selected from ${htmlEscape(builder.counts.inventoryCandidates)} local candidates.</p>
  <p class="lock">Review only. This page does not read logs, capture screenshots, create queues, execute software, write memory, delete rollback points, or claim completion.</p>
  <section>
    <h2>Teacher Confirmation</h2>
    <label>Confirmation text <input id="confirmation" placeholder="Teacher confirms private apps are excluded and observation is read-only"></label>
    <p><label><input id="privateExcluded" type="checkbox"> Private/out-of-scope apps are excluded for this batch</label></p>
    <p><label><input id="readOnlyOnly" type="checkbox"> This batch is read-only observation only</label></p>
    <div class="controls">
      <button id="markPriority">Mark all visible as priority</button>
      <button id="markLater" class="secondary">Mark all visible as observe later</button>
      <button id="markExcluded" class="secondary">Mark all visible excluded</button>
      <button id="build">Build receipt JSON</button>
      <button id="download" class="secondary">Download receipt JSON</button>
      <button id="copyBridge" class="secondary">Copy bridge command</button>
    </div>
  </section>
  <section>${rows}</section>
  <section>
    <h2>Receipt JSON</h2>
    <textarea id="receipt" spellcheck="false"></textarea>
  </section>
  <section>
    <h2>Next Bridge Command</h2>
    <textarea id="bridgeCommand" spellcheck="false" readonly></textarea>
  </section>
</main>
<script>
const builder = ${JSON.stringify(builder).replace(/</g, "\\u003c")};
function buildReceipt() {
  const receipt = JSON.parse(JSON.stringify(builder.receiptTemplate));
  receipt.generatedBy = "all_software_inventory_batch_review_builder";
  receipt.generatedAt = new Date().toISOString();
  receipt.teacherConfirmationText = document.getElementById("confirmation").value.trim();
  receipt.teacherConfirmedPrivateAppsExcluded = document.getElementById("privateExcluded").checked;
  receipt.teacherConfirmedReadOnlyObservationOnly = document.getElementById("readOnlyOnly").checked;
  receipt.rows = receipt.rows.map(row => {
    const card = document.querySelector('[data-row="' + CSS.escape(row.rowId) + '"]');
    const decision = card.querySelector(".decision").value;
    return {
      ...row,
      decision,
      teachingStyle: card.querySelector(".teachingStyle").value,
      teacherLogSourceHint: card.querySelector(".sourceHint").value.trim(),
      teacherNote: card.querySelector(".teacherNote").value.trim(),
      approvedForReviewedObservation: decision === "priority_observe" || decision === "observe_later"
    };
  });
  return receipt;
}
function render() {
  document.getElementById("receipt").value = JSON.stringify(buildReceipt(), null, 2);
  document.getElementById("bridgeCommand").value = builder.nextReviewedQueueBridgeCommand;
}
function setAll(decision) {
  for (const select of document.querySelectorAll(".decision")) select.value = decision;
  render();
}
document.getElementById("markPriority").addEventListener("click", () => setAll("priority_observe"));
document.getElementById("markLater").addEventListener("click", () => setAll("observe_later"));
document.getElementById("markExcluded").addEventListener("click", () => setAll("exclude_private_or_out_of_scope"));
document.getElementById("build").addEventListener("click", render);
document.getElementById("download").addEventListener("click", () => {
  render();
  const blob = new Blob([document.getElementById("receipt").value + "\\n"], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "teacher-filled-all-software-inventory-batch-review-receipt.json";
  link.click();
  URL.revokeObjectURL(link.href);
});
document.getElementById("copyBridge").addEventListener("click", () => {
  render();
  if (navigator.clipboard) navigator.clipboard.writeText(builder.nextReviewedQueueBridgeCommand);
});
document.addEventListener("input", render);
document.addEventListener("change", render);
render();
</script>
</body>
</html>
`,
    "utf8"
  );
}

function writeReadme(path, builder) {
  writeFileSync(
    path,
    [
      "# All Software Inventory Batch Review Builder",
      "",
      `Status: ${builder.status}`,
      "",
      "This builder selects a small high-signal batch from the all-software inventory so the teacher can approve a first low-token reviewed queue without reviewing every local candidate at once.",
      "",
      `- Builder HTML: ${builder.paths.html}`,
      `- Receipt template: ${builder.paths.receiptTemplate}`,
      `- Inventory: ${builder.paths.inventory}`,
      `- Next bridge command: ${builder.nextReviewedQueueBridgeCommand}`,
      "",
      "Boundary: review-only; no log contents, screenshots, queues, watch baselines, software actions, memory writes, rollback deletion, or completion claims."
    ].join("\n"),
    "utf8"
  );
}

const inventoryPath = resolve(argValue("--inventory", ""));
if (!inventoryPath || !existsSync(inventoryPath)) throw new Error("--inventory is required");
const outputRoot = resolve(
  argValue("--output-dir", join("artifacts", "current-goal-all-software-observer-inventory-batch-review-builders"))
);
const batchSize = Math.max(1, Number(argValue("--batch-size", "12")));
mkdirSync(outputRoot, { recursive: true });

const inventory = readJson(inventoryPath);
const candidates = Array.isArray(inventory.softwareCandidates) ? inventory.softwareCandidates : [];
const reviewRows = selectBatch(candidates, batchSize);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-all-software-inventory-batch-review`;
const builderPath = join(outputRoot, "all-software-observer-inventory-batch-review-builder.json");
const htmlPath = join(outputRoot, "all-software-observer-inventory-batch-review-builder.html");
const receiptTemplatePath = join(outputRoot, "teacher-all-software-observer-inventory-batch-review-receipt-template.json");
const readmePath = join(outputRoot, "ALL_SOFTWARE_OBSERVER_INVENTORY_BATCH_REVIEW_BUILDER.md");
const receiptTemplate = buildReceiptTemplate(reviewRows, builderId, inventoryPath);
const nextReviewedQueueBridgeCommand = receiptTemplate.nextReviewedQueueBridgeCommandTemplate;
const lockState = locks();
const builder = {
  ok: true,
  format: "transparent_ai_all_software_observer_inventory_batch_review_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_inventory_batch_review_receipt",
  inventoryPath,
  selectionPolicy: "highest_signal_first_batch",
  counts: {
    inventoryCandidates: candidates.length,
    reviewRows: reviewRows.length,
    rowsWithLogMetadata: reviewRows.filter((row) => row.logMetadataCount > 0).length
  },
  reviewRows,
  receiptTemplate,
  nextReviewedQueueBridgeCommand,
  paths: {
    builder: builderPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    inventory: inventoryPath
  },
  links: {
    html: pathToFileURL(htmlPath).href,
    receiptTemplate: pathToFileURL(receiptTemplatePath).href
  },
  locks: lockState,
  goalComplete: false
};

writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeHtml(htmlPath, builder);
writeReadme(readmePath, builder);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_observer_inventory_batch_review_builder_result_v1",
      status: builder.status,
      builderPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      counts: builder.counts,
      logsRead: false,
      screenshotsCaptured: false,
      queueCreated: false,
      softwareActionsExecuted: false,
      memoryWritten: false,
      goalComplete: false
    },
    null,
    2
  )
);
