#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-compact-evidence-request-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-compact-evidence-request-receipt-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `\uFEFF${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
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

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function locks() {
  return {
    reviewOnly: true,
    receiptBuilderOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotWriteReceipt: true,
    browserCanCopyGeneratedReceipt: true,
    browserCanDownloadGeneratedReceipt: true,
    browserCanBulkConfirmEligibleRows: true,
    browserCanResetRowsToNeedsTeacherReview: true,
    builderUsesSafeTextRendering: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotRunMetadataCollection: true,
    builderDoesNotRunWatchCycle: true,
    builderDoesNotReadLogs: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotRegisterSchedule: true,
    builderDoesNotWriteMemory: true,
    selectedRouteIsNotCoverage: true,
    compactEvidenceNotCollectedYet: true,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Low-Token Compact Evidence Request Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Source request pack: ${builder.paths.sourceRequestPack}`,
    "",
    "Use the HTML page to generate a teacher-filled receipt for compact metadata evidence requests.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder packet: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    "",
    "Safety boundary:",
    "- This builder only creates JSON in the browser after teacher interaction.",
    "- The generator script does not save the generated teacher receipt.",
    "- It does not validate receipts, run metadata collection, run watch cycles, read logs, read full logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, or claim completion.",
    "- Any generated receipt must still pass validate-original-goal-low-token-compact-evidence-request-receipt.mjs before a separate runner can be considered."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder, requestPack, receiptTemplate) {
  const data = {
    builder,
    requestRows: builder.reviewRows,
    receiptTemplate
  };
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Compact Evidence Request Receipt Builder</title>
  <style>
    :root { color: #18212b; background: #f6f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 25px; margin: 0 0 8px; letter-spacing: 0; }
    .panel, table { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; box-shadow: 0 1px 2px rgba(16,32,56,.06); }
    .panel { padding: 14px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; }
    button { min-height: 32px; border: 1px solid #8795a7; border-radius: 6px; background: #fff; padding: 0 10px; cursor: pointer; }
    button.primary { background: #174d89; border-color: #174d89; color: #fff; }
    label { display: inline-flex; align-items: center; gap: 6px; margin-right: 12px; }
    textarea, input[type="text"] { width: 100%; box-sizing: border-box; border: 1px solid #c8d2df; border-radius: 6px; padding: 7px; font: inherit; }
    textarea { min-height: 150px; font-family: Consolas, monospace; font-size: 12px; }
    code { background: #edf2f7; border-radius: 5px; padding: 2px 5px; word-break: break-all; }
    .muted { color: #586779; }
  </style>
</head>
<body>
<main>
  <h1>Compact Evidence Request Receipt Builder</h1>
  <section class="panel">
    <p id="status"></p>
    <p class="muted">This page generates receipt JSON only. It does not run metadata collection, read logs, capture screenshots, execute software, register schedules, write memory, or claim coverage.</p>
    <label><input id="rollbackRetained" type="checkbox"> Retained rollback point confirmed</label>
    <label><input id="noFullLog" type="checkbox" checked> No full log read</label>
    <label><input id="noScreenshot" type="checkbox" checked> No screenshots</label>
    <label><input id="noExecution" type="checkbox" checked> No software execution</label>
    <p><input id="teacherNote" type="text" placeholder="Optional teacher note or retained rollback point label"></p>
    <p>
      <button id="confirmEligible" class="primary">Confirm eligible metadata requests</button>
      <button id="resetRows">Reset rows</button>
      <button id="generate">Generate JSON</button>
      <button id="copy">Copy JSON</button>
      <button id="download">Download JSON</button>
    </p>
  </section>
  <section class="panel">
    <table>
      <thead><tr><th>Use</th><th>#</th><th>Software</th><th>Mode</th><th>Route</th><th>Boundary</th><th>Note</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
  </section>
  <section class="panel">
    <textarea id="output" spellcheck="false"></textarea>
    <p class="muted">Validate the downloaded or copied JSON with: <code id="validationCommand"></code></p>
  </section>
</main>
<script>
const DATA = ${jsonForScript(data)};
const state = new Map();
const output = document.getElementById("output");
function appendText(parent, text) {
  parent.appendChild(document.createTextNode(text == null ? "" : String(text)));
}
function buildRows() {
  const tbody = document.getElementById("rows");
  tbody.textContent = "";
  for (const row of DATA.requestRows) {
    state.set(row.rowId, { selected: false, note: "" });
    const tr = document.createElement("tr");
    const use = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.disabled = !row.readyForTeacherConfirmedCompactEvidenceRequest;
    checkbox.addEventListener("change", () => state.get(row.rowId).selected = checkbox.checked);
    use.appendChild(checkbox);
    const cells = [
      row.ledgerNumber,
      row.software,
      row.evidenceMode,
      row.routeId,
      row.collectionBoundary
    ].map((value) => {
      const td = document.createElement("td");
      appendText(td, value);
      return td;
    });
    const note = document.createElement("td");
    const noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.placeholder = "row note";
    noteInput.addEventListener("input", () => state.get(row.rowId).note = noteInput.value);
    note.appendChild(noteInput);
    tr.append(use, ...cells, note);
    tbody.appendChild(tr);
  }
}
function receipt() {
  const base = structuredClone(DATA.receiptTemplate);
  base.rollbackRetained = document.getElementById("rollbackRetained").checked;
  base.noFullLogReadConfirmed = document.getElementById("noFullLog").checked;
  base.noScreenshotConfirmed = document.getElementById("noScreenshot").checked;
  base.noSoftwareExecutionConfirmed = document.getElementById("noExecution").checked;
  base.teacherDecision = "needs_teacher_review";
  base.teacherNote = document.getElementById("teacherNote").value;
  base.requestRows = DATA.requestRows.map((row) => {
    const rowState = state.get(row.rowId) || { selected: false, note: "" };
    const decision = rowState.selected ? "compact_metadata_request_confirmed" : "needs_teacher_review";
    if (rowState.selected) base.teacherDecision = "compact_metadata_request_confirmed";
    return {
      rowId: row.rowId,
      ledgerNumber: row.ledgerNumber,
      software: row.software,
      routeId: row.routeId,
      evidenceMode: row.evidenceMode,
      teacherDecision: decision,
      allowedTeacherDecisions: DATA.receiptTemplate.requestRows.find((source) => source.rowId === row.rowId)?.allowedTeacherDecisions || [],
      reviewedCompactEvidenceRequest: rowState.selected,
      compactEvidenceCollected: false,
      teacherNote: rowState.note || base.teacherNote || "",
      blockers: row.blockers || []
    };
  });
  return base;
}
function renderReceipt() {
  output.value = JSON.stringify(receipt(), null, 2);
}
document.getElementById("status").textContent = DATA.builder.status + " | rows=" + DATA.builder.counts.reviewRows + " | eligible=" + DATA.builder.counts.eligibleRows;
document.getElementById("validationCommand").textContent = DATA.builder.nextValidationCommand;
document.getElementById("confirmEligible").addEventListener("click", () => {
  for (const row of DATA.requestRows) {
    if (row.readyForTeacherConfirmedCompactEvidenceRequest) state.get(row.rowId).selected = true;
  }
  buildRows();
  for (const input of document.querySelectorAll("#rows input[type=checkbox]")) {
    if (!input.disabled) input.checked = true;
  }
  for (const row of DATA.requestRows) {
    if (row.readyForTeacherConfirmedCompactEvidenceRequest) state.get(row.rowId).selected = true;
  }
  renderReceipt();
});
document.getElementById("resetRows").addEventListener("click", () => {
  for (const value of state.values()) { value.selected = false; value.note = ""; }
  buildRows();
  renderReceipt();
});
document.getElementById("generate").addEventListener("click", renderReceipt);
document.getElementById("copy").addEventListener("click", async () => {
  renderReceipt();
  await navigator.clipboard.writeText(output.value);
});
document.getElementById("download").addEventListener("click", () => {
  renderReceipt();
  const blob = new Blob([output.value], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "teacher-filled-low-token-compact-evidence-request-receipt.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
buildRows();
renderReceipt();
</script>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build a teacher receipt for low-token compact evidence requests.");
const requestInput = readJsonInput(
  argValue("--request-pack", argValue("--pack", "")),
  "--request-pack",
  "transparent_ai_original_goal_low_token_compact_evidence_request_pack_v1"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-compact-evidence-request-receipt-builders")
  )
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const requestPack = requestInput.value;
const lockState = locks();
const builderPath = join(builderDir, "original-goal-low-token-compact-evidence-request-receipt-builder.json");
const htmlPath = join(builderDir, "original-goal-low-token-compact-evidence-request-receipt-builder.html");
const receiptTemplatePath = join(builderDir, "teacher-low-token-compact-evidence-request-receipt-template.json");
const readmePath = join(builderDir, "ORIGINAL_GOAL_LOW_TOKEN_COMPACT_EVIDENCE_REQUEST_RECEIPT_BUILDER_START_HERE.md");

const reviewRows = (requestPack.requestRows || []).map((row) => ({
  rowId: row.rowId || "",
  ledgerNumber: row.ledgerNumber || "",
  software: row.software || "",
  routeId: row.routeId || "",
  routeKind: row.routeKind || "",
  evidenceMode: row.evidenceMode || "",
  collectionBoundary: row.collectionBoundary || "",
  readyForTeacherConfirmedCompactEvidenceRequest: row.readyForTeacherConfirmedCompactEvidenceRequest === true,
  blockers: Array.isArray(row.blockers) ? row.blockers : [],
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "compact_metadata_request_confirmed",
    "blocked_needs_manual_teacher_marker",
    "teacher_excluded_from_monitoring",
    "correction_to_high_reasoning_repair"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "run_metadata_gate_now",
    "run_watch_cycle_now",
    "read_logs_now",
    "read_full_logs",
    "capture_screenshot_now",
    "execute_now",
    "write_memory",
    "register_schedule",
    "unlock_packaging",
    "claim_complete"
  ]
}));
const receiptTemplate = {
  format: "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_v1",
  receiptFor: "original_goal_low_token_compact_evidence_request_pack",
  sourceRequestPackPath: requestInput.path,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "compact_metadata_request_confirmed",
    "blocked_needs_manual_teacher_marker",
    "teacher_excluded_from_monitoring",
    "correction_to_high_reasoning_repair"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "run_metadata_gate_now",
    "run_watch_cycle_now",
    "read_logs_now",
    "read_full_logs",
    "capture_screenshot_now",
    "execute_now",
    "write_memory",
    "register_schedule",
    "unlock_packaging",
    "claim_complete"
  ],
  rollbackRetained: false,
  noFullLogReadConfirmed: true,
  noScreenshotConfirmed: true,
  noSoftwareExecutionConfirmed: true,
  teacherNote: "",
  requestRows: reviewRows.map((row) => ({
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber,
    software: row.software,
    routeId: row.routeId,
    evidenceMode: row.evidenceMode,
    teacherDecision: "needs_teacher_review",
    allowedTeacherDecisions: row.allowedTeacherDecisions,
    reviewedCompactEvidenceRequest: false,
    compactEvidenceCollected: false,
    teacherNote: "",
    blockers: row.blockers
  })),
  locks: lockState
};
const builder = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "low_token_compact_evidence_request_receipt_builder_ready_for_teacher_use",
  sourceRequestPackStatus: requestPack.status || "",
  counts: {
    reviewRows: reviewRows.length,
    eligibleRows: reviewRows.filter((row) => row.readyForTeacherConfirmedCompactEvidenceRequest).length,
    blockedRows: reviewRows.filter((row) => !row.readyForTeacherConfirmedCompactEvidenceRequest).length
  },
  reviewRows,
  nextValidationCommand: commandLine("validate-original-goal-low-token-compact-evidence-request-receipt.mjs", [
    ["--request-pack", requestInput.path],
    ["--receipt", "<teacher-filled-low-token-compact-evidence-request-receipt.json>"],
    ["--output-dir", join(builderDir, "compact-evidence-request-receipt-validation")]
  ]),
  paths: {
    builder: builderPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceRequestPack: requestInput.path
  },
  blockedActions: [
    "run_metadata_collection_from_receipt_builder",
    "run_watch_cycle_from_receipt_builder",
    "read_logs_from_receipt_builder",
    "read_full_logs_from_receipt_builder",
    "capture_screenshot_from_receipt_builder",
    "execute_target_software_from_receipt_builder",
    "register_schedule_from_receipt_builder",
    "write_memory_from_receipt_builder",
    "claim_all_software_coverage_complete_from_receipt_builder"
  ],
  locks: lockState,
  executeNow: false,
  goalComplete: false
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeReadme(readmePath, builder);
writeHtml(htmlPath, builder, requestPack, receiptTemplate);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_builder_result_v1",
      builderPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      status: builder.status,
      counts: builder.counts,
      locks: builder.locks,
      executeNow: false,
      goalComplete: false
    },
    null,
    2
  )
);
