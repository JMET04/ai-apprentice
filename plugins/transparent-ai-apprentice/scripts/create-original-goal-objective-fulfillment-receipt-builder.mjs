#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-objective-fulfillment-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-objective-fulfillment-receipt-builder"
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

function latestAuditPath() {
  const root = join(process.cwd(), ".transparent-apprentice", "original-goal-objective-fulfillment-audits");
  if (!existsSync(root)) throw new Error("No objective fulfillment audit directory found; run audit:plugin-original-goal-objective-fulfillment first.");
  const latest = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name))
    .filter((dir) => existsSync(join(dir, "original-goal-objective-fulfillment-audit.json")))
    .sort()
    .at(-1);
  if (!latest) throw new Error("No original-goal-objective-fulfillment-audit.json found.");
  return join(latest, "original-goal-objective-fulfillment-audit.json");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotRunCommands: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotReadLogs: true,
    builderDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function reviewRows(audit) {
  return (audit.requirements || []).map((row, index) => ({
    id: row.id,
    order: index + 1,
    requested: row.requested || "",
    currentStatus: row.status || "",
    provenNow: row.provenNow === true,
    missingBeforeCompletion: row.missingBeforeCompletion || [],
    defaultDecision: "needs_teacher_review",
    allowedDecisions: ["needs_teacher_review", "teacher_confirms_audit_status", "teacher_requests_correction", "teacher_selects_next_lane"],
    blockedDecisions: ["accepted", "claim_complete", "execute_now", "register_now", "write_memory", "enable_rule", "unlock_packaging"]
  }));
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Objective Fulfillment Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Audit: ${builder.paths.sourceAudit}`,
    "",
    "The teacher uses this receipt to confirm the current completion audit, request correction, or choose exactly one next lane.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder does not validate the receipt.",
    "- It does not run commands, register tasks, launch runners, execute target software, capture screenshots, read logs, write memory, enable rules, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const rows = builder.reviewRows
    .map(
      (row) => `<article class="row" data-row-id="${htmlEscape(row.id)}">
        <header><strong>${row.order}. ${htmlEscape(row.id)}</strong><span>${htmlEscape(row.currentStatus)}</span></header>
        <p>${htmlEscape(row.requested)}</p>
        <p>Proven now: <code>${htmlEscape(row.provenNow)}</code></p>
        <p>Missing: ${htmlEscape(row.missingBeforeCompletion.join("; ") || "none")}</p>
        <label>Teacher decision
          <select data-field="teacherDecision">
            <option value="needs_teacher_review">needs_teacher_review</option>
            <option value="teacher_confirms_audit_status">teacher_confirms_audit_status</option>
            <option value="teacher_requests_correction">teacher_requests_correction</option>
            <option value="teacher_selects_next_lane">teacher_selects_next_lane</option>
          </select>
        </label>
        <label class="inline"><input type="checkbox" data-field="auditRowReviewed"> Audit row reviewed</label>
        <label>Teacher note <input data-field="teacherNote"></label>
        <label>Correction request <input data-field="correctionRequest"></label>
      </article>`
    )
    .join("\n");
  const payload = JSON.stringify(builder.receiptTemplate).replace(/</g, "\\u003c");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Objective Fulfillment Receipt Builder</title>
  <style>
    body { margin: 0; font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    .row, .panel { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; margin: 12px 0; }
    .row header { display: flex; justify-content: space-between; gap: 12px; }
    label { display: block; margin: 8px 0; }
    .inline { display: flex; align-items: center; gap: 8px; }
    input, select, textarea { box-sizing: border-box; width: 100%; border: 1px solid #cfd8e5; border-radius: 6px; padding: 8px; }
    input[type="checkbox"] { width: 18px; height: 18px; }
    textarea { min-height: 220px; font: 13px Consolas, monospace; }
    button { min-height: 36px; border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; padding: 0 12px; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Objective Fulfillment Receipt Builder</h1>
  <p>Status: <code>${htmlEscape(builder.status)}</code></p>
  <p>Source audit: <a href="${htmlEscape(fileHref(builder.paths.sourceAudit))}">${htmlEscape(basename(builder.paths.sourceAudit))}</a></p>
  <section>${rows}</section>
  <section class="panel">
    <button id="build">Build receipt JSON</button>
    <textarea id="receipt"></textarea>
  </section>
</main>
<script>
const template = ${payload};
function bool(node) { return Boolean(node && node.checked); }
function val(root, name) { const node = root.querySelector('[data-field="' + name + '"]'); return node ? (node.type === 'checkbox' ? bool(node) : node.value) : ""; }
function build() {
  const rows = Array.from(document.querySelectorAll(".row")).map((root) => ({
    id: root.dataset.rowId,
    teacherDecision: val(root, "teacherDecision"),
    auditRowReviewed: val(root, "auditRowReviewed"),
    teacherNote: val(root, "teacherNote"),
    correctionRequest: val(root, "correctionRequest")
  }));
  document.getElementById("receipt").value = JSON.stringify({ ...template, rowDecisions: rows }, null, 2);
}
document.getElementById("build").addEventListener("click", build);
build();
</script>
</body>
</html>`,
    "utf8"
  );
}

const auditInput = readJsonInput(
  argValue("--audit", argValue("--objective-audit", "")),
  "--audit",
  "transparent_ai_original_goal_objective_fulfillment_audit_v1"
);
const auditPath = auditInput.path || latestAuditPath();
const audit = auditInput.value || readJson(auditPath);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-objective-fulfillment-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(audit.auditId || "objective-fulfillment")}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const builderPath = join(builderDir, "original-goal-objective-fulfillment-receipt-builder.json");
const htmlPath = join(builderDir, "original-goal-objective-fulfillment-receipt-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_OBJECTIVE_FULFILLMENT_RECEIPT_BUILDER_START_HERE.md");
const receiptTemplatePath = join(builderDir, "teacher-objective-fulfillment-receipt-template.json");
const nextValidationCommand = commandLine("validate-original-goal-objective-fulfillment-receipt.mjs", [
  ["--audit", auditPath],
  ["--receipt", "<teacher-filled-objective-fulfillment-receipt.json>"]
]);
const rows = reviewRows(audit);
const receiptTemplate = {
  format: "transparent_ai_original_goal_objective_fulfillment_receipt_v1",
  sourceAuditId: audit.auditId || "",
  sourceAuditPath: auditPath,
  defaultDecision: "needs_teacher_review",
  rowDecisions: rows.map((row) => ({
    id: row.id,
    teacherDecision: row.defaultDecision,
    auditRowReviewed: false,
    teacherNote: "",
    correctionRequest: ""
  })),
  locks: locks()
};
const builder = {
  ok: true,
  format: "transparent_ai_original_goal_objective_fulfillment_receipt_builder_v1",
  builderId,
  status: "waiting_for_teacher_objective_fulfillment_receipt",
  sourceAuditStatus: audit.status,
  completionAllowed: audit.completionAllowed === true,
  reviewRows: rows,
  receiptTemplate,
  nextValidationCommand,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceAudit: auditPath
  },
  locks: locks()
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeHtml(htmlPath, builder);
writeReadme(readmePath, builder);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_objective_fulfillment_receipt_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      nextValidationCommand,
      status: builder.status
    },
    null,
    2
  )
);
