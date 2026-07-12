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
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    nativeUniversalExecution: false,
    softwareActionsExecuted: false,
    scheduledTaskRegistered: false,
    memoryEnabled: false,
    teacherConfirmationRequired: true,
    builderDoesNotReadLogs: true,
    builderDoesNotTailLogs: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotCreateQueue: true,
    builderDoesNotInitializeWatchBaseline: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotWriteMemory: true,
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

function compactCandidate(candidate, index) {
  const logFiles = Array.isArray(candidate.candidateLogFiles) ? candidate.candidateLogFiles : [];
  return {
    rowNumber: index + 1,
    rowId: candidateId(candidate, index),
    software: candidate.software || candidate.processName || "unknown",
    processName: candidate.processName || "",
    windowTitle: candidate.windowTitle || "",
    installPath: candidate.installPath || "",
    logMetadataCount: logFiles.length,
    candidateLogRoots: Array.isArray(candidate.candidateLogRoots) ? candidate.candidateLogRoots.slice(0, 8) : [],
    sampleLogMetadata: logFiles.slice(0, 3).map((item) => ({
      path: item.path || "",
      bytes: item.bytes ?? null,
      lastWriteTimeUtc: item.lastWriteTimeUtc || "",
      lowTokenUse: item.lowTokenUse || "metadata_first_then_tail_on_trigger"
    })),
    windowsEventLogs: Array.isArray(candidate.windowsEventLogs) ? candidate.windowsEventLogs : [],
    confidence: candidate.confidence ?? null,
    reason: candidate.reason || ""
  };
}

function buildReceiptTemplate(rows, builderId) {
  return {
    format: "transparent_ai_all_software_observer_inventory_review_receipt_v1",
    builderId,
    status: "waiting_for_teacher_inventory_review",
    teacherConfirmationText: "",
    teacherConfirmedPrivateAppsExcluded: false,
    teacherConfirmedReadOnlyObservationOnly: false,
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
    nextReviewedObservationCommandTemplate: commandText("start-teach-execute-reviewed-observation.mjs", [
      "--goal",
      "Run teacher-confirmed read-only all-software observation after excluding private software.",
      "--software",
      "all local software",
      "--teacher-confirmation",
      "<teacher-confirmed-read-only-observation-and-private-app-exclusion-text>",
      "--exclude",
      "<private-or-out-of-scope-software-name>",
      "--priority-software",
      "<teacher-priority-software-name>",
      "--output-dir",
      join("artifacts", "current-goal-teach-execute-reviewed-observations")
    ]),
    nextReviewedQueueBridgeCommandTemplate: commandText("create-all-software-observer-reviewed-queue-from-receipt.mjs", [
      "--inventory",
      "<software-observer-inventory.json>",
      "--receipt",
      "<teacher-filled-all-software-observer-inventory-review-receipt.json>",
      "--output-dir",
      join("artifacts", "current-goal-all-software-observer-reviewed-queues")
    ]),
    locks: locks()
  };
}

function writeHtml(path, builder) {
  const rowsJson = JSON.stringify(builder.reviewRows);
  const rowHtml = builder.reviewRows
    .map(
      (row) => `<tr data-row="${htmlEscape(row.rowId)}" data-has-logs="${row.logMetadataCount > 0 ? "true" : "false"}" data-search="${htmlEscape(
        [row.software, row.processName, row.windowTitle, row.installPath, row.reason, row.candidateLogRoots.join(" ")].join(" ")
      )}">
        <td>${row.rowNumber}</td>
        <td><strong>${htmlEscape(row.software)}</strong><br><small>${htmlEscape(row.processName || row.installPath || "")}</small></td>
        <td>${htmlEscape(String(row.logMetadataCount))}<br><small>${htmlEscape(row.reason)}</small></td>
        <td>
          <select class="decision">
            <option value="needs_teacher_source">needs teacher source</option>
            <option value="priority_observe">priority observe</option>
            <option value="observe_later">observe later</option>
            <option value="exclude_private_or_out_of_scope">exclude private/out of scope</option>
            <option value="blocked">blocked</option>
          </select>
        </td>
        <td>
          <select class="teaching-style">
            <option value="ask_teacher_when_ambiguous">ask teacher when ambiguous</option>
            <option value="silent_work_along_from_deltas">silent work-along from deltas</option>
            <option value="step_narration">step narration</option>
            <option value="before_after_examples">before/after examples</option>
            <option value="transparent_overlay_annotations">transparent overlay annotations</option>
            <option value="voice_or_text_instruction">voice/text instruction</option>
            <option value="manual_teacher_markers">manual teacher markers</option>
          </select>
        </td>
        <td><input class="source-hint" placeholder="log path, event source, marker, or exclusion reason"></td>
        <td><input class="note" placeholder="teacher note"></td>
      </tr>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>All Software Inventory Review Builder</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 20px; color: #18212f; background: #f7f8fa; }
    main { max-width: 1280px; margin: 0 auto; }
    section { background: white; border: 1px solid #d9dee7; border-radius: 8px; padding: 16px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; background: white; }
    th, td { border-bottom: 1px solid #e4e8f0; padding: 8px; vertical-align: top; text-align: left; }
    th { position: sticky; top: 0; background: #eef3f8; z-index: 1; }
    input, select, textarea { width: 100%; box-sizing: border-box; }
    textarea { min-height: 180px; font-family: Consolas, monospace; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; }
    .filters { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; align-items: end; }
    button { border: 1px solid #9fb3c8; background: #f4f8fc; border-radius: 6px; padding: 8px 10px; cursor: pointer; }
    .lock { color: #8a2f18; font-weight: 700; }
    .muted { color: #59677a; }
    .summary { display: flex; gap: 14px; flex-wrap: wrap; font-size: 13px; color: #3b4a5d; }
    tr[hidden] { display: none; }
  </style>
</head>
<body>
<main>
  <h1>All Software Inventory Review Builder</h1>
  <p class="muted">Candidates: ${htmlEscape(builder.counts.reviewRows)}. Inventory source: ${htmlEscape(builder.inventoryPath)}</p>
  <section>
    <h2>Boundary</h2>
    <p class="lock">This page only builds a teacher review receipt. It does not read logs, tail logs, capture screenshots, create queues, initialize watch baselines, execute software, write memory, enable rules, or claim completion.</p>
  </section>
  <section>
    <h2>Teacher Confirmation</h2>
    <label>Confirmation text <input id="confirmation" placeholder="Teacher confirms private apps are excluded and only read-only observation may proceed"></label>
    <p><label><input id="privateExcluded" type="checkbox"> Teacher confirms private/out-of-scope apps are excluded before queue/watch</label></p>
    <p><label><input id="readOnlyOnly" type="checkbox"> Teacher confirms this is read-only observation only</label></p>
  </section>
  <section>
    <h2>Filter And Batch</h2>
    <div class="filters">
      <label>Search <input id="searchText" placeholder="software, process, path, reason"></label>
      <label>Decision
        <select id="decisionFilter">
          <option value="">all decisions</option>
          <option value="needs_teacher_source">needs teacher source</option>
          <option value="priority_observe">priority observe</option>
          <option value="observe_later">observe later</option>
          <option value="exclude_private_or_out_of_scope">exclude private/out of scope</option>
          <option value="blocked">blocked</option>
        </select>
      </label>
      <label>Teaching style
        <select id="styleFilter">
          <option value="">all styles</option>
          <option value="ask_teacher_when_ambiguous">ask teacher when ambiguous</option>
          <option value="silent_work_along_from_deltas">silent work-along from deltas</option>
          <option value="step_narration">step narration</option>
          <option value="before_after_examples">before/after examples</option>
          <option value="transparent_overlay_annotations">transparent overlay annotations</option>
          <option value="voice_or_text_instruction">voice/text instruction</option>
          <option value="manual_teacher_markers">manual teacher markers</option>
        </select>
      </label>
      <label>Signals
        <select id="logFilter">
          <option value="">all signal rows</option>
          <option value="has_logs">has log metadata</option>
          <option value="no_logs">no log metadata</option>
        </select>
      </label>
    </div>
    <p class="summary">
      <span>Visible: <strong id="visibleCount">0</strong> / <strong id="totalCount">0</strong></span>
      <span>Priority: <strong id="priorityCount">0</strong></span>
      <span>Observe later: <strong id="observeLaterCount">0</strong></span>
      <span>Excluded: <strong id="excludedCount">0</strong></span>
      <span>Needs source: <strong id="needsSourceCount">0</strong></span>
      <span>Blocked: <strong id="blockedCount">0</strong></span>
    </p>
    <div class="toolbar">
      <button data-bulk="priority_observe">Mark filtered priority</button>
      <button data-bulk="observe_later">Mark filtered observe later</button>
      <button data-bulk="needs_teacher_source">Mark filtered need source</button>
      <button data-bulk="exclude_private_or_out_of_scope">Mark filtered excluded</button>
      <button data-bulk="blocked">Mark filtered blocked</button>
      <button id="clearFilters">Clear filters</button>
      <button id="build">Build receipt JSON</button>
      <button id="copyReceipt">Copy receipt JSON</button>
      <button id="downloadReceipt">Download receipt JSON</button>
    </div>
  </section>
  <section>
    <h2>Rows</h2>
    <table>
      <thead><tr><th>#</th><th>Software</th><th>Signals</th><th>Decision</th><th>Teaching Style</th><th>Source / Reason</th><th>Note</th></tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
  </section>
  <section>
    <h2>Receipt JSON</h2>
    <label>Receipt filename <input id="receiptFileName" value="teacher-filled-all-software-observer-inventory-review-receipt.json"></label>
    <textarea id="receipt" spellcheck="false"></textarea>
  </section>
  <section>
    <h2>Next Bridge Command</h2>
    <textarea id="bridgeCommand" spellcheck="false" readonly></textarea>
  </section>
</main>
<script>
const rows = ${rowsJson};
const baseReceipt = ${JSON.stringify(builder.receiptTemplate)};
const bridgeTemplate = ${JSON.stringify(builder.nextReviewedQueueBridgeCommandTemplate)};
function rowMatchesFilters(tr) {
  const searchText = document.getElementById("searchText").value.trim().toLowerCase();
  const decisionFilter = document.getElementById("decisionFilter").value;
  const styleFilter = document.getElementById("styleFilter").value;
  const logFilter = document.getElementById("logFilter").value;
  const decision = tr.querySelector(".decision").value;
  const style = tr.querySelector(".teaching-style").value;
  const hasLogs = tr.dataset.hasLogs === "true";
  const searchable = (tr.dataset.search || "").toLowerCase();
  if (searchText && !searchable.includes(searchText)) return false;
  if (decisionFilter && decision !== decisionFilter) return false;
  if (styleFilter && style !== styleFilter) return false;
  if (logFilter === "has_logs" && !hasLogs) return false;
  if (logFilter === "no_logs" && hasLogs) return false;
  return true;
}
function applyFilters() {
  let visible = 0;
  const rows = Array.from(document.querySelectorAll("tr[data-row]"));
  rows.forEach(tr => {
    const matched = rowMatchesFilters(tr);
    tr.hidden = !matched;
    if (matched) visible += 1;
  });
  document.getElementById("visibleCount").textContent = String(visible);
  document.getElementById("totalCount").textContent = String(rows.length);
}
function currentReceipt() {
  const byId = new Map(rows.map(row => [row.rowId, row]));
  const receiptRows = Array.from(document.querySelectorAll("tr[data-row]")).map(tr => {
    const row = byId.get(tr.dataset.row);
    const decision = tr.querySelector(".decision").value;
    return {
      rowNumber: row.rowNumber,
      rowId: row.rowId,
      software: row.software,
      decision,
      teachingStyle: tr.querySelector(".teaching-style").value,
      teacherLogSourceHint: tr.querySelector(".source-hint").value.trim(),
      teacherNote: tr.querySelector(".note").value.trim(),
      approvedForReviewedObservation: decision === "priority_observe" || decision === "observe_later"
    };
  });
  return {
    ...baseReceipt,
    generatedAt: new Date().toISOString(),
    teacherConfirmationText: document.getElementById("confirmation").value.trim(),
    teacherConfirmedPrivateAppsExcluded: document.getElementById("privateExcluded").checked,
    teacherConfirmedReadOnlyObservationOnly: document.getElementById("readOnlyOnly").checked,
    rows: receiptRows,
    summary: {
      totalRows: receiptRows.length,
      excludedRows: receiptRows.filter(row => row.decision === "exclude_private_or_out_of_scope").length,
      priorityRows: receiptRows.filter(row => row.decision === "priority_observe").length,
      observeLaterRows: receiptRows.filter(row => row.decision === "observe_later").length,
      needsTeacherSourceRows: receiptRows.filter(row => row.decision === "needs_teacher_source").length,
      blockedRows: receiptRows.filter(row => row.decision === "blocked").length
    }
  };
}
function render() {
  applyFilters();
  const receiptText = JSON.stringify(currentReceipt(), null, 2);
  document.getElementById("receipt").value = receiptText;
  const fileName = document.getElementById("receiptFileName").value.trim() || "teacher-filled-all-software-observer-inventory-review-receipt.json";
  document.getElementById("bridgeCommand").value = bridgeTemplate.replace("<teacher-filled-all-software-observer-inventory-review-receipt.json>", fileName);
  const receipt = JSON.parse(receiptText);
  document.getElementById("priorityCount").textContent = String(receipt.summary.priorityRows);
  document.getElementById("observeLaterCount").textContent = String(receipt.summary.observeLaterRows);
  document.getElementById("excludedCount").textContent = String(receipt.summary.excludedRows);
  document.getElementById("needsSourceCount").textContent = String(receipt.summary.needsTeacherSourceRows);
  document.getElementById("blockedCount").textContent = String(receipt.summary.blockedRows);
}
async function copyReceipt() {
  render();
  const text = document.getElementById("receipt").value;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  document.getElementById("receipt").select();
  document.execCommand("copy");
}
function downloadReceipt() {
  render();
  const fileName = document.getElementById("receiptFileName").value.trim() || "teacher-filled-all-software-observer-inventory-review-receipt.json";
  const blob = new Blob([document.getElementById("receipt").value + "\\n"], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}
document.querySelectorAll("[data-bulk]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("tr[data-row]").forEach(tr => {
      if (!tr.hidden) tr.querySelector(".decision").value = button.dataset.bulk;
    });
    render();
  });
});
document.getElementById("clearFilters").addEventListener("click", () => {
  document.getElementById("searchText").value = "";
  document.getElementById("decisionFilter").value = "";
  document.getElementById("styleFilter").value = "";
  document.getElementById("logFilter").value = "";
  render();
});
document.getElementById("build").addEventListener("click", render);
document.getElementById("copyReceipt").addEventListener("click", copyReceipt);
document.getElementById("downloadReceipt").addEventListener("click", downloadReceipt);
document.addEventListener("input", render);
document.addEventListener("change", render);
render();
</script>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, builder) {
  writeFileSync(
    path,
    [
      "# All Software Inventory Review Builder",
      "",
      `Status: ${builder.status}`,
      "",
      "Open the HTML, search/filter the software rows, use filtered batch actions for private/out-of-scope software or priority software, choose teaching styles, then download or copy the generated receipt JSON.",
      "",
      "This builder is review-only. It does not read logs, capture screenshots, create queues, initialize watch baselines, execute software, write memory, enable rules, or claim completion.",
      "",
      `- Builder JSON: ${builder.paths.builder}`,
      `- Builder HTML: ${builder.paths.html}`,
      `- Receipt template: ${builder.paths.receiptTemplate}`,
      `- Inventory: ${builder.inventoryPath}`,
      `- Next bridge command: ${builder.nextReviewedQueueBridgeCommandTemplate}`,
      ""
    ].join("\n"),
    "utf8"
  );
}

const inventoryPath = resolve(argValue("--inventory", argValue("--inventory-path", "")));
const bootstrapPath = argValue("--bootstrap", "");
const outputRoot = resolve(
  argValue("--output-dir", join("artifacts", "current-goal-all-software-observer-inventory-review-builders"))
);
const maxRows = Number(argValue("--max-rows", "240"));

if (!inventoryPath || !existsSync(inventoryPath)) {
  throw new Error("--inventory is required and must point to software-observer-inventory.json");
}

mkdirSync(outputRoot, { recursive: true });
const inventory = readJson(inventoryPath);
const candidates = Array.isArray(inventory.softwareCandidates) ? inventory.softwareCandidates : [];
const reviewRows = candidates.slice(0, maxRows).map(compactCandidate);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-all-software-inventory-review`;
const builderPath = join(outputRoot, "all-software-observer-inventory-review-builder.json");
const htmlPath = join(outputRoot, "all-software-observer-inventory-review-builder.html");
const receiptTemplatePath = join(outputRoot, "teacher-all-software-observer-inventory-review-receipt-template.json");
const readmePath = join(outputRoot, "ALL_SOFTWARE_OBSERVER_INVENTORY_REVIEW_BUILDER.md");
const receiptTemplate = buildReceiptTemplate(reviewRows, builderId);

  const builder = {
  ok: true,
  format: "transparent_ai_all_software_observer_inventory_review_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_inventory_review_receipt",
  inventoryPath,
  bootstrapPath: bootstrapPath ? resolve(bootstrapPath) : "",
  sourceInventoryFormat: inventory.format || "",
  sourceInventoryLogContentsRead: inventory.discoveryScope?.logContentsRead === true,
  sourceInventoryFullContinuousRecording: inventory.discoveryScope?.fullContinuousRecording === true,
  sourceInventoryNativeUniversalExecution: inventory.discoveryScope?.nativeUniversalExecution === true,
  counts: {
    inventoryCandidates: candidates.length,
    reviewRows: reviewRows.length,
    rowsWithLogMetadata: reviewRows.filter((row) => row.logMetadataCount > 0).length
  },
  reviewRows,
  receiptTemplate,
  nextReviewedObservationCommandTemplate: receiptTemplate.nextReviewedObservationCommandTemplate,
  nextReviewedQueueBridgeCommandTemplate: receiptTemplate.nextReviewedQueueBridgeCommandTemplate.replace(
    "<software-observer-inventory.json>",
    inventoryPath
  ),
  paths: {
    builder: builderPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    inventory: inventoryPath,
    bootstrap: bootstrapPath ? resolve(bootstrapPath) : ""
  },
  links: {
    html: pathToFileURL(htmlPath).href,
    receiptTemplate: pathToFileURL(receiptTemplatePath).href
  },
  locks: locks(),
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
      format: "transparent_ai_all_software_observer_inventory_review_builder_result_v1",
      status: builder.status,
      builderPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      inventoryPath,
      counts: builder.counts,
      logsRead: false,
      screenshotsCaptured: false,
      queueCreated: false,
      watchBaselineInitialized: false,
      softwareActionsExecuted: false,
      memoryWritten: false,
      goalComplete: false
    },
    null,
    2
  )
);
