#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "completion-blocker-lane-run-review-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "completion-blocker-lane-run-review-receipt-builder"
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

function q(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, q(value));
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
    builderDoesNotValidateReceipt: true,
    builderDoesNotRerunLane: true,
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
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, builder) {
  const lines = [
    "# Completion Blocker Lane Run Review Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Lane: ${builder.runSummary.lane}`,
    `Run status: ${builder.runSummary.status}`,
    "",
    "Use the receipt template to record whether the teacher accepts this lane run as useful review evidence or wants it preserved as a blocker.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder writes only review packets and a blank receipt template.",
    "- It does not rerun the lane, execute commands, register tasks, launch runners, capture screenshots, execute target software, write memory, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Completion Blocker Lane Run Review</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.5; }
    .panel { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; padding: 14px; margin: 14px 0; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    pre { white-space: pre-wrap; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; padding: 12px; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Completion Blocker Lane Run Review</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Lane:</strong> ${htmlEscape(builder.runSummary.lane)}</p>
    <p><strong>Run status:</strong> ${htmlEscape(builder.runSummary.status)}</p>
    <p><strong>Run packet:</strong> <a href="${htmlEscape(fileHref(builder.paths.sourceRun))}">${htmlEscape(builder.paths.sourceRun)}</a></p>
    <p><strong>Run receipt:</strong> <a href="${htmlEscape(fileHref(builder.paths.sourceRunReceipt))}">${htmlEscape(builder.paths.sourceRunReceipt)}</a></p>
    <p><strong>Receipt template:</strong> <a href="${htmlEscape(fileHref(builder.paths.receiptTemplate))}">${htmlEscape(builder.paths.receiptTemplate)}</a></p>
    <p><strong>Validation command:</strong> <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    <p class="lock">Review-only. This page does not rerun the lane, execute commands, launch software, capture screenshots, write memory, unlock packaging, or claim completion.</p>
    <section class="panel">
      <h2>Run evidence</h2>
      <pre>${htmlEscape(JSON.stringify(builder.runSummary, null, 2))}</pre>
    </section>
    <section class="panel">
      <h2>Teacher receipt template</h2>
      <pre>${htmlEscape(JSON.stringify(builder.receiptTemplate, null, 2))}</pre>
    </section>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build a teacher receipt for one completion-blocker lane run.");
const runInput = readJsonInput(
  argValue("--run", argValue("--lane-run", "")),
  "--run",
  "transparent_ai_original_goal_completion_blocker_lane_request_run_v1"
);
if (!runInput.value) throw new Error("--run is required");
const runReceiptInput = readJsonInput(
  argValue("--run-receipt", argValue("--receipt", "")),
  "--run-receipt",
  "transparent_ai_original_goal_completion_blocker_lane_request_run_receipt_v1"
);

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-lane-run-review-receipt-builders")
  )
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const run = runInput.value;
const runReceipt = runReceiptInput.value || {};
const builderPath = join(builderDir, "completion-blocker-lane-run-review-receipt-builder.json");
const htmlPath = join(builderDir, "completion-blocker-lane-run-review-receipt-builder.html");
const readmePath = join(builderDir, "COMPLETION_BLOCKER_LANE_RUN_REVIEW_RECEIPT_BUILDER_START_HERE.md");
const receiptTemplatePath = join(builderDir, "completion-blocker-lane-run-review-receipt-template.json");
const runSummary = {
  lane: run.selectedLane?.lane || runReceipt.selectedLane?.lane || "",
  status: run.status || runReceipt.status || "",
  safeScriptInvoked: run.safeScriptInvoked === true || runReceipt.safeScriptInvoked === true,
  teacherConfirmed: run.teacherConfirmed === true || runReceipt.teacherConfirmed === true,
  rollbackPointCreated: run.rollbackPointCreated === true || runReceipt.rollbackPointCreated === true,
  childFormat: run.generatedEvidence?.childFormat || "",
  childStatus: run.generatedEvidence?.childStatus || "",
  childPath: run.generatedEvidence?.childPath || "",
  safeScriptResultPath: run.generatedEvidence?.safeScriptResultPath || runReceipt.safeScriptResultPath || "",
  blockedReason: run.blockReason || "",
  goalComplete: run.goalComplete === true || run.locks?.goalComplete === true || runReceipt.goalComplete === true
};
const receiptTemplate = {
  format: "transparent_ai_original_goal_completion_blocker_lane_run_review_receipt_v1",
  builderId,
  sourceRun: runInput.path,
  sourceRunReceipt: runReceiptInput.path || run.receiptPath || "",
  lane: runSummary.lane,
  runStatus: runSummary.status,
  teacherDecision: "needs_teacher_review",
  evidenceReviewed: false,
  runOutcomeMatchesExpectedLane: false,
  rollbackPointStillRetained: false,
  preserveBlockerIfMismatch: true,
  teacherConfirmation: "",
  teacherNotes: ""
};
const reviewLocks = locks();
const nextValidationCommand = commandLine("validate-original-goal-completion-blocker-lane-run-review-receipt.mjs", [
  ["--builder", builderPath],
  ["--receipt", "<teacher-filled-completion-blocker-lane-run-review-receipt.json>"],
  ["--output-dir", join(builderDir, "completion-blocker-lane-run-review-receipt-validation")]
]);
const builder = {
  ok: true,
  format: "transparent_ai_original_goal_completion_blocker_lane_run_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_to_review_completion_blocker_lane_run",
  runSummary,
  receiptTemplate,
  nextValidationCommand,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceRun: runInput.path,
    sourceRunReceipt: runReceiptInput.path || ""
  },
  locks: reviewLocks
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeHtml(htmlPath, builder);
writeReadme(readmePath, builder);
console.log(JSON.stringify(builder, null, 2));
