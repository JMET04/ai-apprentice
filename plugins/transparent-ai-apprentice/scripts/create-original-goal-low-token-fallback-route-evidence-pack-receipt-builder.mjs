#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function slug(value) {
  return (
    String(value || "original-goal-low-token-fallback-route-evidence-pack-receipt")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "original-goal-low-token-fallback-route-evidence-pack-receipt"
  );
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
    receiptBuilderOnly: true,
    commandTemplateOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotSelectRoute: true,
    builderDoesNotRunMetadataProbe: true,
    builderDoesNotReadLogs: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotRegisterSchedule: true,
    builderDoesNotWriteMemory: true,
    routeSelectionIsNotCoverage: true,
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

const goal = argValue("--goal", "Build a teacher receipt for low-token fallback route selection.");
const packInput = readJsonInput(
  argValue("--pack", argValue("--fallback-route-evidence-pack", "")),
  "--pack",
  "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_v1"
);
const outputRoot = resolve(
  argValue(
    "--out-dir",
    argValue(
      "--output-dir",
      join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-fallback-route-evidence-pack-receipt-builders")
    )
  )
);

const pack = packInput.value;
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(pack.packId || goal)}`;
const builderDir = join(outputRoot, builderId);
const builderPath = join(builderDir, "original-goal-low-token-fallback-route-evidence-pack-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "teacher-low-token-fallback-route-evidence-pack-receipt-template.json");
const htmlPath = join(builderDir, "original-goal-low-token-fallback-route-evidence-pack-receipt-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_LOW_TOKEN_FALLBACK_ROUTE_EVIDENCE_PACK_RECEIPT_BUILDER_START_HERE.md");

const receiptRows = (pack.rows || []).map((row) => ({
  rowId: row.rowId,
  ledgerNumber: row.ledgerNumber || "",
  software: row.software || "",
  category: row.category || "",
  allowedRouteIds: (row.candidateRoutes || []).map((route) => route.routeId),
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "select_candidate_route", "mark_out_of_scope", "request_new_route"],
  blockedTeacherDecisions: [
    "accepted",
    "read_logs_now",
    "read_full_logs",
    "capture_screenshot_now",
    "execute_now",
    "register_monitor_now",
    "write_memory_now",
    "claim_all_software_coverage_complete",
    "claim_goal_complete"
  ],
  selectedRouteId: "",
  routeEvidenceReviewed: false,
  privacyBoundaryReviewed: false,
  noContentReadConfirmed: false,
  routeSelectionNote: "",
  reviewedEvidencePathOrSignal: ""
}));

const routeRowsForHtml = (pack.rows || []).map((row) => ({
  rowId: row.rowId,
  ledgerNumber: row.ledgerNumber || "",
  software: row.software || "",
  category: row.category || "",
  candidateRoutes: (row.candidateRoutes || []).map((route) => ({
    routeId: route.routeId || "",
    routeKind: route.routeKind || "",
    evidenceToReview: route.evidenceToReview || route.summary || route.description || "",
    tokenPolicy: route.tokenPolicy || "",
    teacherDecisionNeeded: route.teacherDecisionNeeded || "",
    reviewOnly: route.reviewOnly !== false
  }))
}));

const receiptTemplate = {
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_v1",
  templateOnly: true,
  builderId,
  sourcePackPath: packInput.path,
  packId: pack.packId || "",
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "routes_selected_for_follow_up", "blocked", "request_new_routes"],
  blockedTeacherDecisions: [
    "accepted",
    "read_logs_now",
    "read_full_logs",
    "capture_screenshot_now",
    "execute_now",
    "register_monitor_now",
    "write_memory_now",
    "claim_all_software_coverage_complete",
    "claim_goal_complete"
  ],
  routeSelectionIsNotCoverage: true,
  blockedShortcutsReviewed: false,
  noFullLogReadConfirmed: false,
  noScreenshotConfirmed: false,
  noSoftwareExecutionConfirmed: false,
  noMemoryWriteConfirmed: false,
  receiptRows,
  teacherNote: "",
  locks: locks()
};

const nextValidationCommand = commandLine("validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs", [
  ["--pack", packInput.path || "<original-goal-low-token-fallback-route-evidence-pack.json>"],
  ["--receipt", "<teacher-filled-low-token-fallback-route-evidence-pack-receipt.json>"],
  ["--output-dir", join(builderDir, "receipt-validation")]
]);

const builder = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "fallback_route_evidence_pack_receipt_builder_ready_for_teacher_route_selection",
  interactiveWorkbench: true,
  sourcePackPath: packInput.path,
  packId: pack.packId || "",
  rowCount: receiptRows.length,
  candidateRouteCount: receiptRows.reduce((sum, row) => sum + row.allowedRouteIds.length, 0),
  routeRows: routeRowsForHtml,
  receiptTemplatePath,
  nextValidationCommand,
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    html: htmlPath,
    readme: readmePath,
    sourcePack: packInput.path
  },
  locks: locks()
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Fallback Route Evidence Pack Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Rows: ${builder.rowCount}`,
    `Candidate routes: ${builder.candidateRouteCount}`,
    "",
    "Fill the receipt after the teacher selects one reviewed fallback route, marks a software row out of scope, or requests a new route.",
    "",
    "Safety boundary:",
    "- This builder is review-only.",
    "- It does not select routes, run metadata probes, read logs, capture screenshots, execute software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "- A selected route is still not coverage; it is only the next reviewed evidence path.",
    "",
    "Next validation command:",
    builder.nextValidationCommand
  ].join("\n"),
  "utf8"
);

const rows = routeRowsForHtml
  .map(
    (row) =>
      `<tr><td>${htmlEscape(row.rowId)}</td><td>${htmlEscape(row.software)}</td><td>${htmlEscape(
        row.category
      )}</td><td>${htmlEscape(row.candidateRoutes.map((route) => route.routeId).join(", "))}</td></tr>`
  )
  .join("\n");
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fallback Route Receipt Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 18px 0 10px; }
    .panel, table { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .panel { padding: 16px; margin: 14px 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
    .row-card { border: 1px solid #d8dee8; border-radius: 8px; padding: 12px; background: #fff; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { text-align: left; vertical-align: top; padding: 10px; border-bottom: 1px solid #e6ebf2; }
    th { background: #eef3f8; }
    label { display: block; margin: 8px 0; font-weight: 600; }
    input[type="text"], select { min-height: 34px; width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 4px 8px; }
    input[type="checkbox"] { margin-right: 6px; }
    textarea { width: 100%; min-height: 340px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; margin: 0 6px 6px 0; }
    button.secondary { background: #fff; color: #174d89; }
    code, pre { background: #eef2f7; border-radius: 4px; }
    code { padding: 2px 5px; word-break: break-all; }
    pre { padding: 12px; overflow: auto; max-height: 440px; white-space: pre-wrap; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #586579; font-size: 13px; }
    .route-box { border: 1px solid #e1e7ef; border-radius: 6px; padding: 8px; margin: 8px 0; background: #fbfdff; }
    .route-id { font: 12px Consolas, monospace; color: #174d89; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Fallback Route Receipt Builder</h1>
  <p><span class="badge">review only</span></p>
  <section class="panel">
    <p><strong>Status:</strong> <code>${htmlEscape(builder.status)}</code></p>
    <p><strong>Rows:</strong> ${htmlEscape(builder.rowCount)}; candidate routes: ${htmlEscape(builder.candidateRouteCount)}</p>
    <p class="muted">This page only builds a teacher-filled JSON receipt. It does not read logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.</p>
  </section>
  <section class="panel">
    <h2>Validation Command</h2>
    <pre>${htmlEscape(nextValidationCommand)}</pre>
  </section>
  <section class="panel">
    <h2>Generate Receipt JSON</h2>
    <label for="decision">Overall teacher decision</label>
    <select id="decision">
      <option value="needs_teacher_review">needs_teacher_review</option>
      <option value="routes_selected_for_follow_up">routes_selected_for_follow_up</option>
      <option value="blocked">blocked</option>
      <option value="request_new_routes">request_new_routes</option>
    </select>
    <label><input id="blockedShortcutsReviewed" type="checkbox">Blocked shortcut decisions reviewed</label>
    <label><input id="noFullLogReadConfirmed" type="checkbox">No full logs were read</label>
    <label><input id="noScreenshotConfirmed" type="checkbox">No screenshots were captured</label>
    <label><input id="noSoftwareExecutionConfirmed" type="checkbox">No target software was executed</label>
    <label><input id="noMemoryWriteConfirmed" type="checkbox">No long-term memory was written</label>
    <label for="teacherNote">Teacher note</label>
    <input id="teacherNote" type="text" placeholder="teacher reviewed route choices; selected routes are follow-up evidence only">
    <p>
      <button id="markReviewed" class="secondary">Mark All Selected Routes Reviewed</button>
      <button id="generate">Generate Receipt JSON</button>
      <button id="copy" class="secondary">Copy JSON</button>
    </p>
    <div id="rows" class="grid"></div>
    <textarea id="receipt" spellcheck="false"></textarea>
  </section>
  <h2>Rows</h2>
  <table>
    <thead><tr><th>Row</th><th>Software</th><th>Category</th><th>Allowed Route IDs</th></tr></thead>
    <tbody>${rows || "<tr><td colspan=\"4\">No rows.</td></tr>"}</tbody>
  </table>
  <section class="panel">
    <h2>Receipt Template</h2>
    <pre>${htmlEscape(JSON.stringify(receiptTemplate, null, 2))}</pre>
  </section>
</main>
<script>
  const builder = ${jsonForScript(builder)};
  const receiptTemplate = ${jsonForScript(receiptTemplate)};
  const rowsEl = document.getElementById("rows");
  const receiptEl = document.getElementById("receipt");

  function routeSummary(route) {
    const parts = [];
    if (route.routeKind) parts.push("kind: " + route.routeKind);
    if (route.tokenPolicy) parts.push("token: " + route.tokenPolicy);
    if (route.teacherDecisionNeeded) parts.push("teacher: " + route.teacherDecisionNeeded);
    return parts.join(" | ");
  }

  function routeOptionLabel(route) {
    return route.routeId + (route.routeKind ? " (" + route.routeKind + ")" : "");
  }

  for (const row of builder.routeRows) {
    const card = document.createElement("article");
    card.className = "row-card";
    const routeOptions = row.candidateRoutes
      .map((route) => '<option value="' + route.routeId + '">' + routeOptionLabel(route) + '</option>')
      .join("");
    const routeBoxes = row.candidateRoutes
      .map((route) => '<div class="route-box"><div class="route-id">' + route.routeId + '</div><div class="muted">' + routeSummary(route) + '</div><p>' + (route.evidenceToReview || "") + '</p></div>')
      .join("");
    card.innerHTML =
      '<strong>' + row.ledgerNumber + '. ' + row.software + '</strong>' +
      '<p class="muted">' + row.category + '</p>' +
      routeBoxes +
      '<label>Row decision</label>' +
      '<select data-field="teacherDecision" data-row-id="' + row.rowId + '">' +
      '<option value="needs_teacher_review">needs_teacher_review</option>' +
      '<option value="select_candidate_route">select_candidate_route</option>' +
      '<option value="mark_out_of_scope">mark_out_of_scope</option>' +
      '<option value="request_new_route">request_new_route</option>' +
      '</select>' +
      '<label>Selected route</label>' +
      '<select data-field="selectedRouteId" data-row-id="' + row.rowId + '"><option value=""></option>' + routeOptions + '</select>' +
      '<label><input data-field="routeEvidenceReviewed" data-row-id="' + row.rowId + '" type="checkbox">Route evidence reviewed</label>' +
      '<label><input data-field="privacyBoundaryReviewed" data-row-id="' + row.rowId + '" type="checkbox">Privacy boundary reviewed</label>' +
      '<label><input data-field="noContentReadConfirmed" data-row-id="' + row.rowId + '" type="checkbox">No content was read</label>' +
      '<label>Reviewed evidence path or signal</label>' +
      '<input data-field="reviewedEvidencePathOrSignal" data-row-id="' + row.rowId + '" type="text">' +
      '<label>Route selection note</label>' +
      '<input data-field="routeSelectionNote" data-row-id="' + row.rowId + '" type="text">';
    rowsEl.appendChild(card);
  }

  function valueForRow(rowId, field) {
    const el = document.querySelector('[data-row-id="' + rowId + '"][data-field="' + field + '"]');
    if (!el) return "";
    return el.type === "checkbox" ? el.checked : el.value;
  }

  function setValueForRow(rowId, field, value) {
    const el = document.querySelector('[data-row-id="' + rowId + '"][data-field="' + field + '"]');
    if (!el) return;
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = value;
  }

  function buildReceipt() {
    const receipt = JSON.parse(JSON.stringify(receiptTemplate));
    receipt.templateOnly = false;
    receipt.teacherDecision = document.getElementById("decision").value;
    receipt.blockedShortcutsReviewed = document.getElementById("blockedShortcutsReviewed").checked;
    receipt.noFullLogReadConfirmed = document.getElementById("noFullLogReadConfirmed").checked;
    receipt.noScreenshotConfirmed = document.getElementById("noScreenshotConfirmed").checked;
    receipt.noSoftwareExecutionConfirmed = document.getElementById("noSoftwareExecutionConfirmed").checked;
    receipt.noMemoryWriteConfirmed = document.getElementById("noMemoryWriteConfirmed").checked;
    receipt.teacherNote = document.getElementById("teacherNote").value;
    receipt.receiptRows = receipt.receiptRows.map((row) => ({
      ...row,
      teacherDecision: valueForRow(row.rowId, "teacherDecision"),
      selectedRouteId: valueForRow(row.rowId, "selectedRouteId"),
      routeEvidenceReviewed: valueForRow(row.rowId, "routeEvidenceReviewed"),
      privacyBoundaryReviewed: valueForRow(row.rowId, "privacyBoundaryReviewed"),
      noContentReadConfirmed: valueForRow(row.rowId, "noContentReadConfirmed"),
      reviewedEvidencePathOrSignal: valueForRow(row.rowId, "reviewedEvidencePathOrSignal"),
      routeSelectionNote: valueForRow(row.rowId, "routeSelectionNote")
    }));
    receipt.locks = receiptTemplate.locks;
    receipt.routeSelectionIsNotCoverage = true;
    return receipt;
  }

  function render() {
    receiptEl.value = JSON.stringify(buildReceipt(), null, 2);
  }

  function markAllReviewed() {
    document.getElementById("decision").value = "routes_selected_for_follow_up";
    document.getElementById("blockedShortcutsReviewed").checked = true;
    document.getElementById("noFullLogReadConfirmed").checked = true;
    document.getElementById("noScreenshotConfirmed").checked = true;
    document.getElementById("noSoftwareExecutionConfirmed").checked = true;
    document.getElementById("noMemoryWriteConfirmed").checked = true;
    for (const row of builder.routeRows) {
      const route = row.candidateRoutes[0];
      if (!route) {
        setValueForRow(row.rowId, "teacherDecision", "request_new_route");
        continue;
      }
      setValueForRow(row.rowId, "teacherDecision", "select_candidate_route");
      setValueForRow(row.rowId, "selectedRouteId", route.routeId);
      setValueForRow(row.rowId, "routeEvidenceReviewed", true);
      setValueForRow(row.rowId, "privacyBoundaryReviewed", true);
      setValueForRow(row.rowId, "noContentReadConfirmed", true);
      setValueForRow(row.rowId, "reviewedEvidencePathOrSignal", route.evidenceToReview || route.routeId);
      setValueForRow(row.rowId, "routeSelectionNote", "Teacher selected fallback route " + route.routeId + "; route selection is follow-up evidence only.");
    }
    render();
  }

  document.getElementById("markReviewed").addEventListener("click", markAllReviewed);
  document.getElementById("generate").addEventListener("click", render);
  document.getElementById("copy").addEventListener("click", async () => {
    render();
    await navigator.clipboard.writeText(receiptEl.value);
  });
  document.addEventListener("change", render);
  document.addEventListener("input", render);
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
      format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_builder_result_v1",
      status: builder.status,
      builderPath,
      receiptTemplatePath,
      htmlPath,
      readmePath,
      rowCount: builder.rowCount,
      candidateRouteCount: builder.candidateRouteCount,
      nextValidationCommand,
      locks: builder.locks
    },
    null,
    2
  )
);
