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
    timeout: 180000
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
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    goalComplete: false
  };
}

function writeHtml(path, router) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Current Goal Teacher Trial Intake Router</title>
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
  <h1>Current Goal Teacher Trial Intake Router</h1>
  <p class="status">${htmlEscape(router.status)}</p>
  <section>
    <h2>Boundary</h2>
    <p class="locked">This router only validates the teacher receipt, refreshes preflight evidence checks, and returns a next manual command. It does not run that command, read logs, capture screenshots, execute target software, write memory, enable rules, downgrade runtime, delete rollback points, or claim completion.</p>
  </section>
  <section>
    <h2>Inputs And Outputs</h2>
    <p>${link("Launchpad", router.paths.launchpad)}</p>
    <p>${router.receiptPath ? link("Teacher receipt", router.receiptPath) : "Teacher receipt: missing"}</p>
    <p>${router.paths.validation ? link("Receipt validation", router.paths.validation) : "Receipt validation: not generated"}</p>
    <p>${router.paths.preflight ? link("Preflight", router.paths.preflight) : "Preflight: not generated"}</p>
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
    "# Current Goal Teacher Trial Intake Router",
    "",
    `Status: ${router.status}`,
    "",
    "This one-step router validates a teacher-filled trial receipt, regenerates the preflight, and returns only the next manual command when the evidence is ready.",
    "",
    "## Files",
    "",
    `- Router JSON: ${router.paths.router}`,
    `- Router HTML: ${router.paths.html}`,
    `- Launchpad: ${router.paths.launchpad}`,
    `- Receipt: ${router.receiptPath || "missing"}`,
    `- Validation: ${router.paths.validation || "not generated"}`,
    `- Preflight: ${router.paths.preflight || "not generated"}`,
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
    "- Does not run the next manual command.",
    "- Does not read logs, capture screenshots, execute target software, write memory, enable rules, downgrade runtime, delete rollback points, or claim completion.",
    ""
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const launchpadPath = resolve(argValue("--launchpad", join("artifacts", "current-goal-start-here", "current-goal-start-here.json")));
const receiptPathRaw = argValue("--receipt", "");
const receiptPath = receiptPathRaw ? resolve(receiptPathRaw) : "";
const outputRoot = resolve(argValue("--output-dir", join("artifacts", "current-goal-teacher-trial-intake-routers")));
mkdirSync(outputRoot, { recursive: true });

const launchpad = readJson(launchpadPath);
const routerPath = join(outputRoot, "current-goal-teacher-trial-intake-router.json");
const htmlPath = join(outputRoot, "current-goal-teacher-trial-intake-router.html");
const readmePath = join(outputRoot, "CURRENT_GOAL_TEACHER_TRIAL_INTAKE_ROUTER.md");
const lockState = locks();
const blockers = [];
let validationResult = null;
let validation = null;
let preflightResult = null;
let preflight = null;

if (!receiptPath) {
  blockers.push("teacher_trial_receipt_missing");
} else if (!existsSync(receiptPath)) {
  blockers.push("teacher_trial_receipt_file_missing");
} else {
  validationResult = runNodeScript("validate-current-goal-teacher-trial-workbench-receipt.mjs", [
    "--workbench",
    launchpad.paths?.teacherTrialWorkbench || "",
    "--receipt",
    receiptPath,
    "--output-dir",
    join(outputRoot, "receipt-validation")
  ]);
  validation = readJson(validationResult.validationPath);
  if (validation.ok !== true) {
    blockers.push(...(validation.reasons || ["receipt_validation_blocked"]));
  }
}

preflightResult = runNodeScript("create-current-goal-teacher-trial-preflight.mjs", [
  "--launchpad",
  launchpadPath,
  ...(receiptPath ? ["--receipt", receiptPath] : []),
  "--output-dir",
  join(outputRoot, "preflight")
]);
preflight = readJson(preflightResult.preflightPath);
if (preflight.readyForNextManualGate !== true) {
  blockers.push(...(preflight.blockers || ["preflight_blocked"]));
}

const uniqueBlockers = [...new Set(blockers)];
const readyForNextManualCommand =
  uniqueBlockers.length === 0 &&
  validation?.readyForNextManualCommand === true &&
  preflight?.readyForNextManualGate === true;
const nextManualCommand = readyForNextManualCommand ? preflight.nextManualCommand || validation.nextManualCommand || "" : "";
const status = readyForNextManualCommand
  ? "ready_for_next_manual_command_review_only"
  : receiptPath
    ? "blocked_waiting_for_teacher_evidence_or_valid_receipt"
    : "blocked_waiting_for_teacher_trial_receipt";

const router = {
  ok: true,
  format: "transparent_ai_current_goal_teacher_trial_intake_router_v1",
  createdAt: new Date().toISOString(),
  status,
  launchpadPath,
  receiptPath,
  validationStatus: validation?.status || "",
  preflightStatus: preflight?.status || "",
  readyForNextManualCommand,
  nextManualCommand,
  validationNextManualCommand: validation?.nextManualCommand || "",
  preflightNextManualCommand: preflight?.nextManualCommand || "",
  blockers: uniqueBlockers,
  paths: {
    router: routerPath,
    html: htmlPath,
    readme: readmePath,
    launchpad: launchpadPath,
    validation: validationResult?.validationPath || "",
    preflight: preflightResult?.preflightPath || ""
  },
  blockedActions: [
    "run_next_manual_command_from_router",
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
      format: "transparent_ai_current_goal_teacher_trial_intake_router_result_v1",
      status,
      routerPath,
      htmlPath,
      readmePath,
      readyForNextManualCommand,
      nextManualCommand,
      blockerCount: uniqueBlockers.length,
      locks: lockState
    },
    null,
    2
  )
);
