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
    String(value || "original-goal-proof-gap-teacher-queue-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-proof-gap-teacher-queue-receipt-builder"
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
    builderDoesNotEnableRules: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function rowNeedsTarget(row) {
  return row.phase === "transparent_overlay_spatial_depth" || row.phase === "teacher_confirmed_target_software_execution";
}

function rowNeedsRollback(row) {
  return row.routeId === "teacher_confirmed_registration_route" || row.phase === "teacher_confirmed_target_software_execution";
}

function rowKey(row) {
  return [row.itemNumber, row.routeId, row.requirementId].map((part) => String(part ?? "")).join("::");
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Proof Gap Teacher Queue Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Queue: ${builder.paths.sourceQueue}`,
    ...(builder.paths.evidencePrefill ? [`Evidence prefill: ${builder.paths.evidencePrefill}`] : []),
    "",
    "Use this HTML page after the teacher reviews the proof-gap teacher queue. The page can generate, copy, or download a teacher-filled receipt JSON in the browser.",
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
    "- It does not run commands, register tasks, launch runners, execute target software, capture screenshots, read full logs, write memory, enable rules, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const rows = builder.reviewRows
    .map((row) => {
      const links = row.evidence
        .map((entry) =>
          entry.exists
            ? `<a href="${htmlEscape(fileHref(entry.value))}">${htmlEscape(entry.label || basename(entry.value))}</a>`
            : `<code>${htmlEscape(entry.value || entry.label || "")}</code>`
        )
        .join("<br>");
      const candidateLinks = (row.candidateEvidence || [])
        .map((entry) =>
          entry.exists
            ? `<a href="${htmlEscape(fileHref(entry.value))}">${htmlEscape(entry.label || basename(entry.value))}</a>`
            : `<code>${htmlEscape(entry.value || entry.label || "")}</code>`
        )
        .join("<br>");
      const candidateButton = row.candidateObservedEvidencePath
        ? `<button type="button" class="secondary use-candidate" data-candidate-path="${htmlEscape(row.candidateObservedEvidencePath)}">Use candidate path after teacher review</button>`
        : "";
      return `<article class="row" data-item-number="${htmlEscape(row.itemNumber)}">
        <header>
          <strong>${htmlEscape(row.itemNumber)}. ${htmlEscape(row.routeId)}</strong>
          <span>${htmlEscape(row.phase)}</span>
        </header>
        <p>${htmlEscape(row.teacherQuestion || row.teacherAction || "Review this proof-gap route.")}</p>
        <p>Required: ${htmlEscape(row.requiredTeacherInputs.join(", ") || "teacher evidence")}</p>
        <p>${links}</p>
        ${
          row.candidateObservedEvidencePath
            ? `<div class="candidate">
          <strong>Candidate evidence only:</strong>
          <p><code>${htmlEscape(row.candidateObservedEvidencePath)}</code></p>
          ${candidateLinks ? `<p>${candidateLinks}</p>` : ""}
          <p class="lock">${htmlEscape((row.teacherStillMustConfirm || []).join("; "))}</p>
          ${candidateButton}
        </div>`
            : ""
        }
        <label>Decision
          <select data-field="decision">
            <option value="needs_teacher_evidence">needs_teacher_evidence</option>
            <option value="teacher_evidence_attached">teacher_evidence_attached</option>
            <option value="blocked">blocked</option>
          </select>
        </label>
        <label>Observed evidence path
          <input data-field="observedEvidencePath" placeholder="Path to reviewed evidence or receipt">
        </label>
        <label>Teacher confirmation text
          <input data-field="teacherConfirmationText" placeholder="What did the teacher explicitly confirm?">
        </label>
        <label>Selected numbered target
          <input data-field="selectedNumberedTarget" value="${row.needsNumberedTarget ? "" : "not_applicable"}">
        </label>
        <label>Retained rollback point
          <input data-field="retainedRollbackPoint" value="${row.needsRollbackPoint ? "" : "not_applicable"}">
        </label>
        <label>Teacher notes
          <input data-field="teacherNotes" placeholder="Blockers, corrections, or follow-up notes">
        </label>
      </article>`;
    })
    .join("\n");

  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Proof Gap Teacher Queue Receipt Builder</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1220px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.5; }
    .panel, .row { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; padding: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
    .row header { display: flex; justify-content: space-between; gap: 8px; align-items: start; }
    .row header span { color: #586579; font-size: 12px; }
    .candidate { border-left: 4px solid #d69e2e; background: #fffaf0; padding: 10px; margin: 10px 0; }
    label { display: block; margin: 8px 0; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 8px; font: 14px "Segoe UI", Arial, sans-serif; }
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
    <h1>Original Goal Proof Gap Teacher Queue Receipt Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Queue:</strong> <a href="${htmlEscape(fileHref(builder.paths.sourceQueue))}">${htmlEscape(builder.paths.sourceQueue)}</a></p>
    <p><strong>Validation command:</strong> <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    <p class="lock">This builder only creates receipt JSON in your browser. It does not save files automatically, validate, execute, register, capture screenshots, read full logs, write memory, enable rules, accept technology, unlock packaging, or claim completion.</p>
    <section class="panel">
      <h2>Generate Teacher-Filled Receipt JSON</h2>
      <div class="controls">
        <button id="copyTemplate">Copy blank template</button>
        <button id="generateReceipt">Generate reviewed receipt JSON</button>
        <button id="downloadReceipt" class="secondary">Download receipt JSON</button>
        <button id="copyValidation" class="secondary">Copy validation command</button>
      </div>
      <textarea id="output" spellcheck="false"></textarea>
    </section>
    <h2>Proof Gap Rows</h2>
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
      for (const row of receipt.rows) {
        const card = document.querySelector('[data-item-number="' + CSS.escape(String(row.itemNumber)) + '"]');
        if (!card) continue;
        row.decision = card.querySelector('[data-field="decision"]').value;
        row.observedEvidencePath = card.querySelector('[data-field="observedEvidencePath"]').value.trim();
        row.teacherConfirmationText = card.querySelector('[data-field="teacherConfirmationText"]').value.trim();
        row.selectedNumberedTarget = card.querySelector('[data-field="selectedNumberedTarget"]').value.trim();
        row.retainedRollbackPoint = card.querySelector('[data-field="retainedRollbackPoint"]').value.trim();
        row.teacherNotes = card.querySelector('[data-field="teacherNotes"]').value.trim();
      }
      receipt.generatedBy = "original_goal_proof_gap_teacher_queue_browser_receipt_builder";
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
      link.download = "teacher-filled-original-goal-proof-gap-teacher-queue-receipt.json";
      link.click();
      URL.revokeObjectURL(url);
    }
    document.getElementById("copyTemplate").addEventListener("click", () => copyText(JSON.stringify(builder.receiptTemplate, null, 2)));
    document.getElementById("generateReceipt").addEventListener("click", renderReceipt);
    document.getElementById("downloadReceipt").addEventListener("click", downloadReceipt);
    document.getElementById("copyValidation").addEventListener("click", () => copyText(builder.nextValidationCommand));
    for (const button of document.querySelectorAll(".use-candidate")) {
      button.addEventListener("click", () => {
        const card = button.closest(".row");
        const input = card && card.querySelector('[data-field="observedEvidencePath"]');
        if (input) input.value = button.dataset.candidatePath || "";
        renderReceipt();
      });
    }
    renderReceipt();
  </script>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build a teacher receipt browser for original-goal proof gap queue.");
const queueInput = readJsonInput(
  argValue("--queue", argValue("--teacher-queue", "")),
  "--queue",
  "transparent_ai_original_goal_proof_gap_teacher_queue_v1"
);
if (!queueInput.value) throw new Error("--queue is required");
const prefillInput = readJsonInput(
  argValue("--prefill", argValue("--evidence-prefill", "")),
  "--prefill",
  "transparent_ai_original_goal_proof_gap_evidence_prefill_v1"
);

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-proof-gap-teacher-queue-receipt-builders")
  )
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const queue = queueInput.value;
const evidencePrefill = prefillInput.value;
const prefillRowsByKey = new Map((evidencePrefill?.rows || []).map((row) => [rowKey(row), row]));
const builderPath = join(builderDir, "original-goal-proof-gap-teacher-queue-receipt-builder.json");
const htmlPath = join(builderDir, "original-goal-proof-gap-teacher-queue-receipt-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_PROOF_GAP_TEACHER_QUEUE_RECEIPT_BUILDER_START_HERE.md");
const receiptTemplatePath = join(builderDir, "teacher-original-goal-proof-gap-teacher-queue-receipt-template.json");
const builderLocks = locks();
const reviewRows = (queue.queueItems || []).map((row) => {
  const prefillRow = prefillRowsByKey.get(rowKey(row)) || null;
  return {
    ...row,
    needsNumberedTarget: rowNeedsTarget(row),
    needsRollbackPoint: rowNeedsRollback(row),
    candidateEvidence: prefillRow?.candidateEvidence || [],
    primaryCandidateEvidence: prefillRow?.primaryCandidateEvidence || null,
    candidateObservedEvidencePath: prefillRow?.candidateObservedEvidencePath || "",
    candidateEvidenceExists: prefillRow?.primaryCandidateEvidence?.exists === true,
    candidateEvidenceKey: prefillRow?.primaryCandidateEvidence?.key || "",
    teacherStillMustConfirm: prefillRow?.teacherStillMustConfirm || [],
    allowedTeacherDecisions: ["needs_teacher_evidence", "teacher_evidence_attached", "blocked"],
    blockedTeacherDecisions: [
      "accepted",
      "rule_enabled",
      "technology_accepted",
      "goal_complete",
      "execute_now",
      "register_now",
      "launch_runner",
      "capture_screenshot",
      "write_memory",
      "unlock_packaging"
    ]
  };
});
const receiptTemplate = {
  ...(queue.paths?.receiptTemplate && existsSync(queue.paths.receiptTemplate) ? readJson(queue.paths.receiptTemplate) : {}),
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_v1",
  sourceQueue: queueInput.path,
  builderId,
  defaultDecision: "needs_teacher_evidence",
  allowedDecisions: ["needs_teacher_evidence", "teacher_evidence_attached", "blocked"],
  forbiddenDecisions: ["accepted", "rule_enabled", "technology_accepted", "goal_complete"],
  rows: reviewRows.map((row) => ({
    itemNumber: row.itemNumber,
    routeId: row.routeId,
    requirementId: row.requirementId,
    decision: "needs_teacher_evidence",
    allowedDecisions: ["needs_teacher_evidence", "teacher_evidence_attached", "blocked"],
    observedEvidencePath: "",
    teacherConfirmationText: "",
    selectedNumberedTarget: row.needsNumberedTarget ? "" : "not_applicable",
    retainedRollbackPoint: row.needsRollbackPoint ? "" : "not_applicable",
    teacherNotes: "",
    candidateObservedEvidencePath: row.candidateObservedEvidencePath || "",
    candidateEvidenceKey: row.candidateEvidenceKey || "",
    mustNotClaimAcceptance: true,
    mustNotRunAutomatically: true
  })),
  locks: builderLocks
};
const nextValidationCommand =
  queue.paths?.receiptValidationCommandTemplate ||
  `node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-proof-gap-teacher-queue-receipt.mjs --queue "${queueInput.path || "<original-goal-proof-gap-teacher-queue.json>"}" --receipt "<teacher-filled-original-goal-proof-gap-teacher-queue-receipt.json>"`;

const builder = {
  ok: true,
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_to_fill_proof_gap_queue_receipt",
  sourceQueueStatus: queue.status || "",
  counts: {
    reviewRows: reviewRows.length,
    highRiskGatedRows: reviewRows.filter((row) => (row.highRiskMarkers || []).length > 0).length,
    rowsNeedingNumberedTarget: reviewRows.filter((row) => row.needsNumberedTarget).length,
    rowsNeedingRollback: reviewRows.filter((row) => row.needsRollbackPoint).length,
    rowsWithCandidatePrefill: reviewRows.filter((row) => row.candidateObservedEvidencePath).length,
    rowsWithExistingCandidateEvidence: reviewRows.filter((row) => row.candidateEvidenceExists).length
  },
  reviewRows,
  receiptTemplate,
  browserReceiptBuilder: {
    outputFormat: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_v1",
    generatesReceiptJsonInBrowser: true,
    downloadsReceiptJsonOnly: true,
    doesNotWriteReceiptToDisk: true,
    doesNotValidateReceipt: true,
    doesNotRunCommands: true
  },
  nextValidationCommand,
  locks: builderLocks,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceQueue: queueInput.path
  },
  ...(prefillInput.path ? { evidencePrefillSummary: evidencePrefill?.nextProofGapEvidencePrefillSummary || null } : {})
};
if (prefillInput.path) builder.paths.evidencePrefill = prefillInput.path;

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeHtml(htmlPath, builder);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      nextValidationCommand,
      status: builder.status,
      counts: builder.counts,
      locks: builderLocks
    },
    null,
    2
  )
);
