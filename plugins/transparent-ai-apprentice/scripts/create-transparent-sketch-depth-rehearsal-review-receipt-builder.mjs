#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "transparent-sketch-depth-rehearsal-review-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "transparent-sketch-depth-rehearsal-review-receipt-builder"
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
    builderDoesNotRunRouteBridge: true,
    builderDoesNotRunTargetConfirmation: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotSendUiEvents: true,
    builderDoesNotWriteMemory: true,
    teacherAcceptanceRequired: true,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function requirementId(name, index) {
  const text = String(name || `check-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return text || `check_${index + 1}`;
}

function writeReadme(path, builder) {
  const lines = [
    "# Transparent Sketch Depth Rehearsal Review Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Goal: ${builder.goal}`,
    `Source rehearsal: ${builder.paths.sourceRehearsal}`,
    "",
    "Use the HTML page to generate a teacher-filled receipt after reviewing the transparent sketch 2D, perspective, and 3D depth rehearsal.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder packet: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder only creates JSON in the browser.",
    "- It does not save the generated receipt.",
    "- It does not validate the receipt.",
    "- It does not run target confirmation, route bridging, screenshots, target software, UI events, memory writes, rule enablement, technology acceptance, or packaging."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher review receipt for transparent sketch depth rehearsal.");
const rehearsalInput = readJsonInput(
  argValue("--rehearsal", argValue("--depth-rehearsal", "")),
  "--rehearsal",
  "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1"
);
if (!rehearsalInput.value) throw new Error("--rehearsal is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "transparent-sketch-depth-rehearsal-review-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const rehearsal = rehearsalInput.value;
const lockState = locks();
const htmlPath = join(builderDir, "transparent-sketch-depth-rehearsal-review-receipt-builder.html");
const builderPath = join(builderDir, "transparent-sketch-depth-rehearsal-review-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "teacher-transparent-sketch-depth-rehearsal-review-receipt-template.json");
const readmePath = join(builderDir, "TRANSPARENT_SKETCH_DEPTH_REHEARSAL_REVIEW_RECEIPT_BUILDER_START_HERE.md");

const reviewRows = (rehearsal.checks || []).map((check, index) => ({
  rowNumber: index + 1,
  requirementId: requirementId(check.name, index),
  requirement: check.name || `Rehearsal check ${index + 1}`,
  rehearsalPass: check.pass === true,
  evidence: check.evidence || "",
  teacherQuestion:
    index === 0
      ? "Does the transparent mask evidence actually show 2D position, perspective cues, and 3D depth hints?"
      : index === 1
        ? "Did the interpreter derive the intended position, perspective, and depth relationships correctly?"
        : index === 2
          ? "Are the consequential sketch details logicized instead of merely visually similar?"
          : index === 3
            ? "Are the numbered targets the right confirmation choices before any software action?"
            : index === 4
              ? "Does the selected target or waiting gate prevent multi-target execution?"
              : "Do the locked gates prevent screenshots, software execution, memory writes, rules, packaging, and native-control claims?",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_confirms_understanding",
    "teacher_marks_ambiguous",
    "teacher_requests_correction",
    "blocked_needs_more_evidence"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "execute_now",
    "run_now",
    "capture_screenshot",
    "send_ui_events",
    "write_memory",
    "enable_rule",
    "claim_depth_mastered",
    "native_universal_execution",
    "unlock_packaging"
  ],
  locks: lockState
}));

const receiptTemplate = {
  format: "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_v1",
  builderId,
  sourceRehearsal: rehearsalInput.path,
  decision: "needs_teacher_review",
  depthRehearsalAccepted: false,
  readyForExecution: false,
  selectedNumberStillRequired: rehearsal.teacherConfirmedNumber !== true,
  rowDecisions: reviewRows.map((row) => ({
    rowNumber: row.rowNumber,
    requirementId: row.requirementId,
    teacherDecision: row.rehearsalPass ? "teacher_confirms_understanding" : "blocked_needs_more_evidence",
    evidenceReviewed: false,
    correctionRequest: "",
    teacherNote: ""
  })),
  locks: lockState
};

const nextValidationCommand = `node plugins\\transparent-ai-apprentice\\scripts\\validate-transparent-sketch-depth-rehearsal-review-receipt.mjs --builder "${builderPath}" --receipt "<teacher-filled-transparent-sketch-depth-rehearsal-review-receipt.json>" --output-dir "${join(builderDir, "validation")}"`;

const builder = {
  ok: true,
  format: "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_depth_rehearsal_review_receipt",
  goal,
  sourceRehearsalStatus: rehearsal.status || "",
  sourceSelectedNumber: rehearsal.selectedNumber || 0,
  sourceTeacherConfirmedNumber: rehearsal.teacherConfirmedNumber === true,
  reviewRows,
  nextValidationCommand,
  paths: {
    sourceRehearsal: rehearsalInput.path,
    sourceRehearsalHtml: rehearsal.paths?.html || "",
    builder: builderPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath
  },
  locks: lockState
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);

const rowsHtml = reviewRows
  .map(
    (row) =>
      `<tr><td>${row.rowNumber}</td><td>${htmlEscape(row.rehearsalPass ? "pass" : "fail")}</td><td>${htmlEscape(row.requirement)}</td><td>${htmlEscape(row.teacherQuestion)}</td><td><code>${htmlEscape(row.evidence)}</code></td></tr>`
  )
  .join("\n");
const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Transparent Sketch Depth Rehearsal Review Receipt Builder</title>
  <style>
    body { margin: 0; font: 14px/1.45 system-ui, sans-serif; color: #17202a; background: #f7f9fb; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #d6dde5; }
    th, td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid #e3e8ef; }
    textarea { width: 100%; min-height: 300px; font: 12px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; }
    button { border: 1px solid #6b7785; background: white; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
    code { background: #edf1f5; padding: 1px 4px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Transparent Sketch Depth Rehearsal Review Receipt Builder</h1>
    <p>Status: <strong>${htmlEscape(builder.status)}</strong></p>
    <p>Source rehearsal: <code>${htmlEscape(builder.paths.sourceRehearsal)}</code></p>
    <p>Next validation command: <code>${htmlEscape(nextValidationCommand)}</code></p>
    <h2>Teacher Review Rows</h2>
    <table>
      <thead><tr><th>#</th><th>Rehearsal</th><th>Requirement</th><th>Teacher question</th><th>Evidence</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <h2>Receipt JSON</h2>
    <textarea id="receipt">${htmlEscape(JSON.stringify(receiptTemplate, null, 2))}</textarea>
    <p><button id="download">Download receipt JSON</button></p>
    <p>This builder does not validate, execute software, capture screenshots, send UI events, write memory, enable rules, accept technology, claim native universal execution, or unlock packaging.</p>
  </main>
  <script>
    const receipt = ${jsonForScript(receiptTemplate)};
    document.getElementById("download").addEventListener("click", () => {
      const blob = new Blob([document.getElementById("receipt").value + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "teacher-transparent-sketch-depth-rehearsal-review-receipt.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  </script>
</body>
</html>`;
writeFileSync(htmlPath, html, "utf8");

console.log(JSON.stringify(builder, null, 2));
