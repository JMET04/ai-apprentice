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
    String(value || "original-goal-next-confirmation-pack-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-next-confirmation-pack-receipt-builder"
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
    builderDoesNotReadLogs: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotRegisterSchedule: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotTreatRagAsAuthority: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullLogsRead: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildReviewRows(pack) {
  return (pack.confirmationItems || []).map((item, index) => ({
    id: item.itemId || `confirmation_item_${index + 1}`,
    order: item.order || index + 1,
    title: item.title || item.itemId || `Confirmation item ${index + 1}`,
    whyItMatters: item.whyItMatters || "",
    openPath: item.openPath || "",
    openPathExists: item.openPath ? existsSync(item.openPath) : false,
    validationCommand: item.validationCommand || "",
    receiptTemplate: item.receiptTemplate || "",
    teacherDecisionDefault: item.teacherDecisionDefault || "needs_teacher_review",
    allowedTeacherDecisions: unique([
      "needs_teacher_review",
      "teacher_reviewed_opened",
      "ready_for_source_receipt_validation",
      ...(item.allowedTeacherDecisions || []),
      "blocked_needs_more_evidence"
    ]),
    stopIf: item.stopIf || []
  }));
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Next Confirmation Pack Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Pack: ${builder.paths.sourcePack}`,
    "",
    "Use this HTML page after the teacher reviews the next-confirmation pack. It generates a teacher-filled receipt JSON in the browser.",
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
    "- It does not read logs, run commands, register schedules, launch runners, execute target software, capture screenshots, write memory, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const rows = builder.reviewRows
    .map((row) => {
      const options = row.allowedTeacherDecisions
        .map(
          (decision) =>
            `<option value="${htmlEscape(decision)}" ${decision === row.teacherDecisionDefault ? "selected" : ""}>${htmlEscape(decision)}</option>`
        )
        .join("\n");
      const stopIf = row.stopIf.length
        ? `<p><strong>Stop if:</strong> ${htmlEscape(row.stopIf.join("; "))}</p>`
        : "";
      return `<article class="row" data-item-id="${htmlEscape(row.id)}">
        <header>
          <strong>${htmlEscape(row.order)}. ${htmlEscape(row.title)}</strong>
          <span>${htmlEscape(row.openPathExists ? "openable" : "needs path review")}</span>
        </header>
        <p>${htmlEscape(row.whyItMatters || "Review this confirmation item before selecting any downstream receipt validation.")}</p>
        ${stopIf}
        <p>${row.openPath ? `<a href="${htmlEscape(fileHref(row.openPath))}">${htmlEscape(basename(row.openPath))}</a>` : ""}</p>
        <label>Teacher decision
          <select data-field="teacherDecision">${options}</select>
        </label>
        <label class="inline"><input type="checkbox" data-field="reviewedOpenPath"> Reviewed linked page or source evidence</label>
        <label class="inline"><input type="checkbox" data-field="reviewedValidationCommand"> Reviewed validation command</label>
        <label>Teacher note
          <input data-field="teacherNote" placeholder="What did the teacher actually verify?">
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
  <title>Original Goal Next Confirmation Pack Receipt Builder</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.5; }
    .panel, .row { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; padding: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
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
    <h1>Original Goal Next Confirmation Pack Receipt Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Receipt template:</strong> <a href="${htmlEscape(fileHref(builder.paths.receiptTemplate))}">${htmlEscape(builder.paths.receiptTemplate)}</a></p>
    <p><strong>Validation command:</strong> <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    <p class="lock">This builder only creates receipt JSON in your browser. It does not save files automatically, validate, run commands, read logs, capture screenshots, register schedules, launch runners, write memory, execute target software, unlock packaging, or claim completion.</p>
    <section class="panel">
      <h2>Generate Teacher Receipt JSON</h2>
      <div class="controls">
        <button id="copyTemplate">Copy blank template</button>
        <button id="generateReceipt">Generate reviewed receipt JSON</button>
        <button id="downloadReceipt" class="secondary">Download receipt JSON</button>
        <button id="copyValidation" class="secondary">Copy validation command</button>
      </div>
      <textarea id="output" spellcheck="false"></textarea>
    </section>
    <h2>Confirmation Items</h2>
    <section class="grid">${rows}</section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const output = document.getElementById("output");
    function copyText(text) {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      output.value = text;
    }
    function cardFor(id) {
      return Array.from(document.querySelectorAll("[data-item-id]")).find((card) => card.dataset.itemId === id);
    }
    function reviewedReceipt() {
      const receipt = JSON.parse(JSON.stringify(builder.receiptTemplate));
      for (const row of receipt.itemDecisions) {
        const card = cardFor(row.itemId);
        if (!card) continue;
        row.teacherDecision = card.querySelector('[data-field="teacherDecision"]').value;
        row.reviewedOpenPath = card.querySelector('[data-field="reviewedOpenPath"]').checked;
        row.reviewedValidationCommand = card.querySelector('[data-field="reviewedValidationCommand"]').checked;
        row.teacherNote = card.querySelector('[data-field="teacherNote"]').value.trim();
      }
      receipt.generatedBy = "original_goal_next_confirmation_pack_browser_receipt_builder";
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
      link.download = "teacher-filled-next-confirmation-pack-receipt.json";
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

const goal = argValue("--goal", "Build a teacher receipt template for the original-goal next confirmation pack.");
const packInput = readJsonInput(
  argValue("--pack", argValue("--confirmation-pack", "")),
  "--pack",
  "transparent_ai_original_goal_next_confirmation_pack_v1"
);
if (!packInput.value) throw new Error("--pack is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-next-confirmation-pack-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const pack = packInput.value;
const builderPath = join(builderDir, "original-goal-next-confirmation-pack-receipt-builder.json");
const htmlPath = join(builderDir, "original-goal-next-confirmation-pack-receipt-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_NEXT_CONFIRMATION_PACK_RECEIPT_BUILDER_START_HERE.md");
const receiptTemplatePath = join(builderDir, "teacher-next-confirmation-pack-receipt-template.json");
const reviewRows = buildReviewRows(pack);
const builderLocks = locks();
const receiptTemplate = {
  ...(pack.receiptTemplate || {}),
  format: "transparent_ai_original_goal_next_confirmation_pack_receipt_v1",
  packId: pack.packId || "",
  decision: "needs_teacher_review",
  itemDecisions: reviewRows.map((row) => ({
    itemId: row.id,
    teacherDecision: "needs_teacher_review",
    reviewedOpenPath: false,
    reviewedValidationCommand: false,
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
    "unlock_packaging",
    ...(pack.blockedActions || [])
  ],
  locks: builderLocks
};

const builder = {
  ok: true,
  format: "transparent_ai_original_goal_next_confirmation_pack_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_next_confirmation_pack_receipt",
  sourcePackStatus: pack.status || "",
  counts: {
    reviewRows: reviewRows.length,
    openableRows: reviewRows.filter((row) => row.openPathExists).length,
    itemsWithValidationCommand: reviewRows.filter((row) => row.validationCommand).length
  },
  reviewRows,
  receiptTemplate,
  browserReceiptBuilder: {
    outputFormat: "transparent_ai_original_goal_next_confirmation_pack_receipt_v1",
    generatesReceiptJsonInBrowser: true,
    downloadsReceiptJsonOnly: true,
    doesNotWriteReceiptToDisk: true,
    doesNotValidateReceipt: true,
    doesNotRunCommands: true
  },
  nextValidationCommand: commandLine("validate-original-goal-next-confirmation-pack-receipt.mjs", [
    ["--pack", packInput.path || "<original-goal-next-confirmation-pack.json>"],
    ["--receipt", "<teacher-filled-next-confirmation-pack-receipt.json>"]
  ]),
  blockedActions: receiptTemplate.blockedActions,
  locks: builderLocks,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourcePack: packInput.path
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
      format: "transparent_ai_original_goal_next_confirmation_pack_receipt_builder_result_v1",
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
