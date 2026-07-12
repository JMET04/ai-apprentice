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
    String(value || "original-goal-teacher-action-router-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-teacher-action-router-receipt-builder"
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

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function routeKind(row = {}) {
  const lane = String(row.lane || "");
  const review = String(row.reviewEntryId || "");
  if (review.includes("activation") || lane.includes("activation")) return "activation_receipt_validation";
  if (review.includes("spatial") || lane.includes("transparent_spatial")) return "spatial_intent_receipt_validation";
  if (review.includes("coverage") || lane.includes("coverage")) return "coverage_receipt_validation";
  if (review.includes("action_logic_source_contract")) return "action_logic_source_contract_validation";
  if (review.includes("execution") || lane.includes("execution")) return "execution_receipt_validation";
  if (lane.includes("low_token")) return "low_token_review";
  return "review_entrypoint";
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Teacher Action Router Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Router: ${builder.paths.sourceRouter}`,
    "",
    "Use the receipt template to record which router rows the teacher actually reviewed.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder writes only review packets and a blank receipt template.",
    "- It does not validate receipts.",
    "- It does not run commands, launch runners, register tasks, execute target software, capture screenshots, write memory, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const rows = builder.reviewRows
    .map(
      (row) => `<tr>
        <td>${row.order}</td>
        <td>${htmlEscape(row.routeKind)}</td>
        <td>${htmlEscape(row.reviewEntryId)}</td>
        <td>${htmlEscape(row.teacherInstruction)}</td>
        <td>${row.openPath ? `<a href="${htmlEscape(fileHref(row.openPath))}">${htmlEscape(basename(row.openPath))}</a>` : ""}</td>
        <td>${htmlEscape(row.defaultDecision)}</td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Teacher Action Router Receipt Builder</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Original Goal Teacher Action Router Receipt Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Receipt template:</strong> <a href="${htmlEscape(fileHref(builder.paths.receiptTemplate))}">${htmlEscape(builder.paths.receiptTemplate)}</a></p>
    <p><strong>Validation command:</strong> <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    <p class="lock">This builder only prepares a receipt template. It does not validate, execute, register, capture screenshots, write memory, accept technology, unlock packaging, or claim completion.</p>
    <table>
      <thead><tr><th>Order</th><th>Kind</th><th>Review Entry</th><th>Teacher Instruction</th><th>Open</th><th>Default Decision</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build a teacher receipt template for the original-goal action router.");
const routerInput = readJsonInput(
  argValue("--router", argValue("--teacher-action-router", "")),
  "--router",
  "transparent_ai_original_goal_teacher_action_router_v1"
);
if (!routerInput.value) throw new Error("--router is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-teacher-action-router-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const router = routerInput.value;
const builderPath = join(builderDir, "original-goal-teacher-action-router-receipt-builder.json");
const htmlPath = join(builderDir, "original-goal-teacher-action-router-receipt-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_TEACHER_ACTION_ROUTER_RECEIPT_BUILDER_START_HERE.md");
const receiptTemplatePath = join(builderDir, "teacher-action-router-receipt-template.json");
const locks = {
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
  builderDoesNotWriteMemory: true,
  scheduledTaskRegistered: false,
  runnerLaunched: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  goalComplete: false
};

const reviewRows = (router.routeRows || []).map((row) => ({
  id: row.id,
  order: row.order,
  source: row.source || "",
  lane: row.lane || "",
  reviewEntryId: row.reviewEntryId || "",
  routeKind: routeKind(row),
  openPath: row.openPath || "",
  openPathExists: row.openPath ? existsSync(row.openPath) : false,
  validationCommand: row.validationCommand || "",
  teacherInstruction: row.teacherInstruction || "",
  doneCondition: row.doneCondition || "",
  stopCondition: row.stopCondition || "",
  defaultDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_reviewed_opened",
    "ready_for_downstream_validation",
    "blocked_needs_more_evidence"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "execute_now",
    "register_now",
    "run_execute_mode",
    "memory_enabled",
    "claim_complete",
    "native_universal_execution",
    "unlock_packaging"
  ]
}));

const receiptTemplate = {
  format: "transparent_ai_original_goal_teacher_action_router_receipt_v1",
  routerId: router.routerId || "",
  builderId,
  defaultDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_reviewed_opened",
    "ready_for_downstream_validation",
    "blocked_needs_more_evidence"
  ],
  rowDecisions: reviewRows.map((row) => ({
    id: row.id,
    routeKind: row.routeKind,
    reviewEntryId: row.reviewEntryId,
    teacherDecision: "needs_teacher_review",
    evidenceReviewed: false,
    observedEvidencePath: "",
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
    "unlock_packaging"
  ],
  locks
};

const builder = {
  ok: true,
  format: "transparent_ai_original_goal_teacher_action_router_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_router_receipt",
  sourceRouterStatus: router.status || "",
  counts: {
    reviewRows: reviewRows.length,
    openableRows: reviewRows.filter((row) => row.openPathExists).length
  },
  reviewRows,
  nextValidationCommand: commandLine("validate-original-goal-teacher-action-router-receipt.mjs", [
    ["--router", routerInput.path || "<original-goal-teacher-action-router.json>"],
    ["--receipt", "<teacher-filled-action-router-receipt.json>"]
  ]),
  blockedActions: receiptTemplate.blockedActions,
  locks,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceRouter: routerInput.path
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
      format: "transparent_ai_original_goal_teacher_action_router_receipt_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      nextValidationCommand: builder.nextValidationCommand,
      status: builder.status,
      reviewRows: reviewRows.length,
      locks
    },
    null,
    2
  )
);
