#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function q(value) {
  const text = String(value ?? "");
  return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function commandText(scriptName, args = []) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map(q)
    .join(" ");
}

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function link(label, path) {
  return path && existsSync(path)
    ? `<a href="${htmlEscape(pathToFileURL(path).href)}">${htmlEscape(label)}</a>`
    : `<span>${htmlEscape(label)}: ${htmlEscape(path || "missing")}</span>`;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    routerDoesNotRunNextManualCommand: true,
    routerDoesNotRunHandoffItem: true,
    routerDoesNotReadLogs: true,
    routerDoesNotReadFullLogs: true,
    routerDoesNotCaptureScreenshots: true,
    routerDoesNotRecordScreen: true,
    routerDoesNotRegisterMonitor: true,
    routerDoesNotLaunchRunner: true,
    routerDoesNotExecuteTargetSoftware: true,
    routerDoesNotWriteMemory: true,
    routerDoesNotEnableRules: true,
    routerDoesNotDowngradeRuntime: true,
    routerDoesNotDeleteRollbackPoints: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeHtml(path, router) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Original Goal Proof Gap Receipt Intake Router</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #17202a; background: #f7f8fa; }
    main { max-width: 1120px; margin: 0 auto; }
    section { background: white; border: 1px solid #d9dee7; border-radius: 8px; padding: 18px; margin: 14px 0; }
    code, pre { background: #f0f3f7; border-radius: 6px; }
    pre { padding: 10px; overflow-x: auto; white-space: pre-wrap; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #9fb3c8; border-radius: 999px; background: #edf5ff; }
    .locked { color: #8a2f18; font-weight: 700; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Proof Gap Receipt Intake Router</h1>
  <p class="status">${htmlEscape(router.status)}</p>
  <section>
    <h2>Boundary</h2>
    <p class="locked">This router only validates the teacher-filled proof gap receipt and, when ready rows exist, creates a copy-only handoff builder page. It does not run that handoff, read logs, capture screenshots, register monitors, launch runners, execute target software, write memory, delete rollback points, or claim completion.</p>
  </section>
  <section>
    <h2>Inputs And Outputs</h2>
    <p>${link("Proof gap queue", router.paths.queue)}</p>
    <p>${router.receiptPath ? link("Teacher receipt", router.receiptPath) : "Teacher receipt: missing"}</p>
    <p>${router.paths.validation ? link("Receipt validation", router.paths.validation) : "Receipt validation: not generated"}</p>
    <p>${router.paths.handoffBuilderHtml ? link("Handoff builder", router.paths.handoffBuilderHtml) : "Handoff builder: not generated"}</p>
  </section>
  <section>
    <h2>Next Manual Command</h2>
    <pre>${htmlEscape(router.nextManualCommand || "")}</pre>
  </section>
  <section>
    <h2>Blockers</h2>
    <pre>${htmlEscape(JSON.stringify(router.blockers, null, 2))}</pre>
  </section>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, router) {
  const lines = [
    "# Original Goal Proof Gap Receipt Intake Router",
    "",
    `Status: ${router.status}`,
    "",
    "This one-step router validates a teacher-filled proof gap receipt and creates a copy-only handoff builder when the receipt validation has ready rows.",
    "",
    "## Files",
    "",
    `- Router JSON: ${router.paths.router}`,
    `- Router HTML: ${router.paths.html}`,
    `- Proof gap queue: ${router.paths.queue}`,
    `- Receipt: ${router.receiptPath || "missing"}`,
    `- Validation: ${router.paths.validation || "not generated"}`,
    `- Handoff builder: ${router.paths.handoffBuilder || "not generated"}`,
    "",
    "## Next manual command",
    "",
    router.nextManualCommand || "",
    "",
    "## Blockers",
    "",
    ...router.blockers.map((item) => `- ${item}`),
    "",
    "## Locks",
    "",
    "- Does not run the next manual command or handoff item.",
    "- Does not read logs, capture screenshots, register monitors, launch runners, execute target software, write memory, delete rollback points, or claim completion.",
    ""
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const queuePath = resolve(argValue("--queue", argValue("--proof-gap-teacher-queue", "")));
const receiptPathRaw = argValue("--receipt", "");
const receiptPath = receiptPathRaw ? resolve(receiptPathRaw) : "";
const outputRoot = resolve(argValue("--output-dir", join("artifacts", "original-goal-proof-gap-receipt-intake-routers")));
mkdirSync(outputRoot, { recursive: true });

if (!queuePath || !existsSync(queuePath)) throw new Error("--queue is required and must point to a proof gap teacher queue JSON");

const routerPath = join(outputRoot, "original-goal-proof-gap-receipt-intake-router.json");
const htmlPath = join(outputRoot, "original-goal-proof-gap-receipt-intake-router.html");
const readmePath = join(outputRoot, "ORIGINAL_GOAL_PROOF_GAP_RECEIPT_INTAKE_ROUTER.md");
const lockState = locks();
const blockers = [];
let validationResult = null;
let validation = null;
let handoffBuilderResult = null;

if (!receiptPath) {
  blockers.push("proof_gap_teacher_receipt_missing");
} else if (!existsSync(receiptPath)) {
  blockers.push("proof_gap_teacher_receipt_file_missing");
} else {
  validationResult = runNodeScript("validate-original-goal-proof-gap-teacher-queue-receipt.mjs", [
    "--queue",
    queuePath,
    "--receipt",
    receiptPath,
    "--output-dir",
    join(outputRoot, "receipt-validation")
  ]);
  validation = readJson(validationResult.validationPath);
  if (validation.ok !== true) blockers.push("proof_gap_receipt_validation_failed");
  if ((validation.counts?.readyRows || 0) <= 0) blockers.push("proof_gap_receipt_validation_has_no_ready_rows");
  if ((validation.counts?.nextReviewQueue || 0) <= 0) blockers.push("proof_gap_receipt_validation_has_no_next_review_queue");
}

if (validation?.ok === true && (validation.counts?.nextReviewQueue || 0) > 0) {
  handoffBuilderResult = runNodeScript("create-original-goal-review-handoff-item-command-builder.mjs", [
    "--queue",
    validationResult.validationPath,
    "--output-dir",
    join(outputRoot, "handoff-builder")
  ]);
}

const uniqueBlockers = [...new Set(blockers)];
const readyForManualHandoffBuilder = uniqueBlockers.length === 0 && Boolean(handoffBuilderResult?.builderPath);
const nextManualCommand = readyForManualHandoffBuilder
  ? commandText("run-original-goal-review-handoff-queue-item.mjs", [
      "--queue",
      validationResult.validationPath,
      "--item-number",
      "<teacher-reviewed-next-review-item-number>",
      "--receipt",
      "<teacher-filled-downstream-receipt-if-needed.json>",
      "--run-reviewed-handoff",
      "true",
      "--allow-runner",
      "true",
      "--teacher-confirmation",
      "<teacher-confirmed-original-goal-review-handoff-item-text>",
      "--rollback-point-created",
      "true",
      "--rollback-point",
      "<retained-rollback-point-path-or-label>",
      "--output-dir",
      join("artifacts", "original-goal-review-handoff-item-runs")
    ])
  : "";
const status = readyForManualHandoffBuilder
  ? "ready_for_manual_proof_gap_handoff_builder_review_only"
  : receiptPath
    ? "blocked_waiting_for_ready_teacher_proof_gap_receipt"
    : "blocked_waiting_for_teacher_proof_gap_receipt";

const router = {
  ok: true,
  format: "transparent_ai_original_goal_proof_gap_receipt_intake_router_v1",
  createdAt: new Date().toISOString(),
  status,
  queuePath,
  receiptPath,
  validationStatus: validation?.status || "",
  validationDecision: validation?.validationDecision || "",
  readyForManualHandoffBuilder,
  readyRows: validation?.counts?.readyRows ?? 0,
  nextReviewQueue: validation?.counts?.nextReviewQueue ?? 0,
  nextManualCommand,
  blockers: uniqueBlockers,
  paths: {
    router: routerPath,
    html: htmlPath,
    readme: readmePath,
    queue: queuePath,
    validation: validationResult?.validationPath || "",
    validationReadme: validationResult?.readmePath || "",
    handoffBuilder: handoffBuilderResult?.builderPath || "",
    handoffBuilderHtml: handoffBuilderResult?.htmlPath || "",
    handoffBuilderReadme: handoffBuilderResult?.readmePath || ""
  },
  blockedActions: [
    "run_next_manual_command_from_router",
    "run_handoff_item_from_router",
    "read_logs_from_router",
    "read_full_logs_from_router",
    "capture_screenshots_from_router",
    "record_screen_from_router",
    "register_monitor_from_router",
    "launch_runner_from_router",
    "execute_target_software_from_router",
    "write_memory_from_router",
    "enable_rules_from_router",
    "downgrade_to_medium_runtime_from_router",
    "delete_rollback_points_from_router",
    "claim_goal_complete_from_router"
  ],
  locks: lockState,
  goalComplete: false
};

writeFileSync(routerPath, `${JSON.stringify(router, null, 2)}\n`, "utf8");
writeHtml(htmlPath, router);
writeReadme(readmePath, router);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_receipt_intake_router_result_v1",
      status,
      routerPath,
      htmlPath,
      readmePath,
      readyForManualHandoffBuilder,
      readyRows: router.readyRows,
      nextReviewQueue: router.nextReviewQueue,
      blockerCount: uniqueBlockers.length,
      handoffBuilderPath: router.paths.handoffBuilder,
      locks: lockState
    },
    null,
    2
  )
);
