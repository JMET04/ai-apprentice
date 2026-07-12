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
    String(value || "completion-blocker-lane-request-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "completion-blocker-lane-request-receipt-builder"
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
    builderDoesNotRunCommands: true,
    builderDoesNotInvokeLaneRunner: true,
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
    "# Completion Blocker Lane Request Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Lane: ${builder.request.lane}`,
    `Request: ${builder.paths.sourceRequest}`,
    "",
    "Use the receipt template to record a real teacher decision before the safe lane runner is invoked.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder writes only review packets and a blank receipt template.",
    "- It does not validate receipts, run the lane runner, execute commands, capture screenshots, execute target software, write memory, accept technology, unlock packaging, or claim completion."
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
  <title>Completion Blocker Lane Request Receipt Builder</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1040px; margin: 0 auto; padding: 28px; }
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
    <h1>Completion Blocker Lane Request Receipt Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Lane:</strong> ${htmlEscape(builder.request.lane)}</p>
    <p><strong>Request:</strong> <a href="${htmlEscape(fileHref(builder.paths.sourceRequest))}">${htmlEscape(builder.paths.sourceRequest)}</a></p>
    <p><strong>Receipt template:</strong> <a href="${htmlEscape(fileHref(builder.paths.receiptTemplate))}">${htmlEscape(builder.paths.receiptTemplate)}</a></p>
    <p><strong>Validation command:</strong> <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    <p class="lock">Review-only. This page does not validate, run commands, invoke runners, capture screenshots, execute target software, write memory, unlock packaging, or claim completion.</p>
    <section class="panel">
      <h2>Teacher receipt fields</h2>
      <p>Set <code>teacherDecision</code> to <code>ready_for_safe_lane_runner</code> only after checking the request, rollback evidence, and any missing inputs.</p>
      <pre>${htmlEscape(JSON.stringify(builder.receiptTemplate, null, 2))}</pre>
    </section>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build a teacher receipt for one completion-blocker lane request.");
const requestInput = readJsonInput(
  argValue("--request", argValue("--lane-request", "")),
  "--request",
  "transparent_ai_original_goal_completion_blocker_lane_command_request_v1"
);
if (!requestInput.value) throw new Error("--request is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-lane-request-receipt-builders")
  )
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const request = requestInput.value;
const builderPath = join(builderDir, "completion-blocker-lane-request-receipt-builder.json");
const htmlPath = join(builderDir, "completion-blocker-lane-request-receipt-builder.html");
const readmePath = join(builderDir, "COMPLETION_BLOCKER_LANE_REQUEST_RECEIPT_BUILDER_START_HERE.md");
const receiptTemplatePath = join(builderDir, "completion-blocker-lane-request-receipt-template.json");
const reviewLocks = locks();
const receiptTemplate = {
  format: "transparent_ai_original_goal_completion_blocker_lane_request_receipt_v1",
  sourceRequest: requestInput.path,
  lane: request.lane || "",
  itemNumber: request.itemNumber ?? null,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "blocked_needs_more_evidence",
    "ready_for_safe_lane_runner"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "execute_now",
    "register_now",
    "run_execute_mode",
    "capture_screenshot_now",
    "memory_enabled",
    "claim_complete",
    "native_universal_execution",
    "unlock_packaging"
  ],
  evidenceReviewed: false,
  missingInputsResolved: Array.isArray(request.missingInputs) ? request.missingInputs.length === 0 : false,
  rollbackPointRetained: false,
  teacherConfirmation: "",
  observedEvidencePath: "",
  blockerQuestion: "",
  nextReviewNote: "",
  locks: reviewLocks
};
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");

const nextValidationCommand = commandLine("validate-original-goal-completion-blocker-lane-request-receipt.mjs", [
  ["--request", requestInput.path],
  ["--receipt", "<teacher-filled-completion-blocker-lane-request-receipt.json>"]
]);
const builder = {
  ok: true,
  format: "transparent_ai_original_goal_completion_blocker_lane_request_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_completion_blocker_lane_request_receipt",
  request: {
    lane: request.lane || "",
    itemNumber: request.itemNumber ?? null,
    status: request.status || "",
    gated: request.gated === true,
    missingInputs: Array.isArray(request.missingInputs) ? request.missingInputs : []
  },
  receiptTemplate,
  nextValidationCommand,
  locks: reviewLocks,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceRequest: requestInput.path
  }
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeHtml(htmlPath, builder);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_completion_blocker_lane_request_receipt_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      status: builder.status,
      lane: builder.request.lane,
      nextValidationCommand,
      locks: reviewLocks
    },
    null,
    2
  )
);
