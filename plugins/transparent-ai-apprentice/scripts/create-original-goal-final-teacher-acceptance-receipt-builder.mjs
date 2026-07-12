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
    String(value || "original-goal-final-teacher-acceptance-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-final-teacher-acceptance-receipt-builder"
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
    builderDoesNotWriteTeacherFilledReceipt: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotRunFinalGate: true,
    builderDoesNotRunCommands: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotReadLogs: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotSendUiEvents: true,
    builderDoesNotWriteMemory: true,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Final Teacher Acceptance Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Final gate: ${builder.paths.sourceFinalCompletionGate}`,
    "",
    "Use the HTML page only after all objective evidence lanes have been reviewed. The page can generate, copy, or download a teacher-filled final acceptance receipt JSON in the browser.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- The default receipt decision is needs_teacher_review.",
    "- The browser generator does not write the generated receipt to disk unless the teacher explicitly downloads it.",
    "- This builder does not validate receipts, run the final gate, run commands, register tasks, capture screenshots, execute target software, write memory, enable rules, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const laneRows = builder.reviewRows
    .map(
      (row) => `<article class="row" data-lane-id="${htmlEscape(row.id)}">
        <header>
          <strong>${htmlEscape(row.id)}</strong>
          <span>${htmlEscape(row.status)}</span>
        </header>
        <p>${htmlEscape(row.requirement)}</p>
        <p>Evidence: <code>${htmlEscape(row.evidence)}</code></p>
        ${row.blocker ? `<p>Blocker: <code>${htmlEscape(row.blocker)}</code></p>` : ""}
        ${row.sourcePath ? `<p><a href="${htmlEscape(fileHref(row.sourcePath))}">${htmlEscape(basename(row.sourcePath))}</a></p>` : ""}
        <label class="inline"><input type="checkbox" data-field="teacherConfirmed" ${row.ready ? "" : "disabled"}> Teacher confirms this lane</label>
        <label>Teacher note <input data-field="teacherNote" placeholder="What did the teacher verify for this lane?"></label>
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
  <title>Original Goal Final Teacher Acceptance Receipt Builder</title>
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
    textarea { min-height: 250px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Final Teacher Acceptance Receipt Builder</h1>
  <section class="panel">
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Gate blockers:</strong> ${htmlEscape(builder.sourceGateBlockers.join(", ") || "none")}</p>
    <p class="lock">This page creates a teacher-filled JSON receipt only. It does not validate, run the final gate, execute software, capture screenshots, write memory, unlock packaging, or claim completion.</p>
    <label>Teacher decision
      <select id="teacherDecision">
        <option value="needs_teacher_review">needs_teacher_review</option>
        <option value="accept_full_original_goal_completion">accept_full_original_goal_completion</option>
        <option value="blocked_needs_more_evidence">blocked_needs_more_evidence</option>
      </select>
    </label>
    <label class="inline"><input id="teacherConfirmedFullScope" type="checkbox"> Teacher confirms the full original scope was reviewed</label>
    <label class="inline"><input id="reviewedEvidenceBundle" type="checkbox"> Teacher reviewed the complete evidence bundle</label>
    <label class="inline"><input id="acceptsRemainingBoundaries" type="checkbox"> Teacher accepts the honest remaining boundaries in the evidence</label>
    <label class="inline"><input id="forbiddenAutomationRequested" type="checkbox"> Forbidden automation was requested</label>
    <label>Teacher summary note <input id="teacherSummaryNote" placeholder="Final review note"></label>
    <p><strong>Next validation command:</strong> <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
  </section>
  <h2>Evidence Lanes</h2>
  <section class="grid">${laneRows}</section>
  <h2>Receipt JSON</h2>
  <section class="panel">
    <p><button id="generate">Generate Receipt JSON</button> <button id="copy" class="secondary">Copy</button> <button id="download" class="secondary">Download Receipt JSON</button></p>
    <textarea id="output"></textarea>
  </section>
</main>
<script>
const builder = ${jsonForScript(builder)};
function laneReceipts() {
  return Array.from(document.querySelectorAll("[data-lane-id]")).map((node) => ({
    laneId: node.dataset.laneId,
    teacherConfirmed: Boolean(node.querySelector('[data-field="teacherConfirmed"]')?.checked),
    teacherNote: node.querySelector('[data-field="teacherNote"]')?.value || ""
  }));
}
function generateReceipt() {
  return {
    format: "transparent_ai_original_goal_final_teacher_acceptance_receipt_v1",
    builderId: builder.builderId,
    sourceFinalCompletionGate: builder.paths.sourceFinalCompletionGate,
    teacherDecision: document.getElementById("teacherDecision").value,
    teacherConfirmedFullScope: document.getElementById("teacherConfirmedFullScope").checked,
    reviewedEvidenceBundle: document.getElementById("reviewedEvidenceBundle").checked,
    acceptsRemainingBoundaries: document.getElementById("acceptsRemainingBoundaries").checked,
    forbiddenAutomationRequested: document.getElementById("forbiddenAutomationRequested").checked,
    teacherSummaryNote: document.getElementById("teacherSummaryNote").value || "",
    evidenceLaneReviews: laneReceipts(),
    locks: builder.locks
  };
}
function render() {
  document.getElementById("output").value = JSON.stringify(generateReceipt(), null, 2);
}
document.getElementById("generate").addEventListener("click", render);
document.getElementById("copy").addEventListener("click", async () => {
  render();
  await navigator.clipboard.writeText(document.getElementById("output").value);
});
document.getElementById("download").addEventListener("click", () => {
  render();
  const blob = new Blob([document.getElementById("output").value + "\\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "original-goal-final-teacher-acceptance-receipt.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
render();
</script>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Create original-goal final teacher acceptance receipt builder.");
const finalGateInput = readJsonInput(
  argValue("--final-completion-gate", argValue("--gate", "")),
  "--final-completion-gate",
  "transparent_ai_original_goal_final_completion_gate_v1"
);
if (!finalGateInput.value) throw new Error("--final-completion-gate is required");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-final-teacher-acceptance-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const finalGate = finalGateInput.value;
const lanes = Array.isArray(finalGate.lanes) ? finalGate.lanes : [];
const nonTeacherBlockers = (finalGate.blockers || []).filter((id) => id !== "explicit_final_teacher_acceptance");
const readyForTeacherAcceptanceReceipt =
  finalGate.status === "blocked_before_original_goal_completion_claim" &&
  lanes.length > 0 &&
  nonTeacherBlockers.length === 0 &&
  (finalGate.blockers || []).includes("explicit_final_teacher_acceptance");
const reviewRows = lanes.map((row) => ({
  id: row.id,
  requirement: row.requirement || "",
  status: row.status || "",
  ready: row.id === "explicit_final_teacher_acceptance" ? true : row.ready === true,
  evidence: row.evidence || "",
  blocker: row.id === "explicit_final_teacher_acceptance" ? "" : row.blocker || "",
  sourcePath: row.sourcePath || ""
}));
const receiptTemplate = {
  format: "transparent_ai_original_goal_final_teacher_acceptance_receipt_v1",
  builderId,
  sourceFinalCompletionGate: finalGateInput.path,
  teacherDecision: "needs_teacher_review",
  teacherConfirmedFullScope: false,
  reviewedEvidenceBundle: false,
  acceptsRemainingBoundaries: false,
  forbiddenAutomationRequested: false,
  teacherSummaryNote: "",
  evidenceLaneReviews: reviewRows.map((row) => ({
    laneId: row.id,
    teacherConfirmed: false,
    teacherNote: ""
  })),
  locks: locks()
};
const builderPath = join(builderDir, "original-goal-final-teacher-acceptance-receipt-builder.json");
const htmlPath = join(builderDir, "original-goal-final-teacher-acceptance-receipt-builder.html");
const receiptTemplatePath = join(builderDir, "original-goal-final-teacher-acceptance-receipt-template.json");
const readmePath = join(builderDir, "ORIGINAL_GOAL_FINAL_TEACHER_ACCEPTANCE_RECEIPT_BUILDER_START_HERE.md");
const nextValidationCommand = commandLine("validate-original-goal-final-teacher-acceptance-receipt.mjs", [
  ["--final-completion-gate", finalGateInput.path],
  ["--receipt", "<teacher-downloaded-final-acceptance-receipt.json>"],
  ["--output-dir", join(builderDir, "validated-final-teacher-acceptance")]
]);
const builder = {
  ok: true,
  format: "transparent_ai_original_goal_final_teacher_acceptance_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: readyForTeacherAcceptanceReceipt
    ? "ready_for_teacher_final_acceptance_receipt"
    : "blocked_until_only_final_teacher_acceptance_remains",
  readyForTeacherAcceptanceReceipt,
  sourceGateStatus: finalGate.status || "",
  sourceGateBlockers: finalGate.blockers || [],
  reviewRows,
  receiptTemplate,
  nextValidationCommand,
  paths: {
    sourceFinalCompletionGate: finalGateInput.path,
    builder: builderPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath
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
      format: "transparent_ai_original_goal_final_teacher_acceptance_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      readyForTeacherAcceptanceReceipt,
      builderPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      nextValidationCommand,
      locks: builder.locks
    },
    null,
    2
  )
);
