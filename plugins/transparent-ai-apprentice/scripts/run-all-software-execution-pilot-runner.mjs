#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "execution-pilot-runner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-pilot-runner"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  if (!input) throw new Error(`${label} is required`);
  const text = String(input).trim();
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function explicitTeacherConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed all-software execution pilot",
    "teacher confirmed execution pilot",
    "i confirm all-software execution pilot",
    "approve controlled execution pilot",
    "allow controlled execution pilot",
    "确认全软件执行试点",
    "确认执行试点",
    "允许受控执行试点",
    "我确认执行试点"
  ].some((marker) => text.includes(marker));
}

function selectPilot(queue, pilotId, pilotIndex) {
  const pilots = Array.isArray(queue.pilots) ? queue.pilots : [];
  if (!pilots.length) throw new Error("execution pilot queue has no pilots");
  if (pilotId) {
    const pilot = pilots.find((item) => item.pilotId === pilotId);
    if (!pilot) throw new Error(`pilot not found: ${pilotId}`);
    return pilot;
  }
  const index = Math.max(0, Number(pilotIndex || 1) - 1);
  if (!pilots[index]) throw new Error(`pilot index not found: ${pilotIndex || 1}`);
  return pilots[index];
}

function runnerArgsFor(entry, options) {
  const executeArgs = [];
  const isPowerShellRunner = extname(entry.runnerPath).toLowerCase() === ".ps1";
  if (options.execute) {
    if (isPowerShellRunner) executeArgs.push("-TeacherConfirmed", "-Execute");
    else executeArgs.push("--teacher-confirmed", "--execute");
  }

  if (entry.adapterId === "existing-cli-or-script" && options.reviewedCommand) {
    executeArgs.push(isPowerShellRunner ? "-ReviewedCommand" : "--reviewed-command", options.reviewedCommand);
  }
  if (entry.adapterId === "existing-windows-ui-automation" && options.targetWindowTitle) {
    executeArgs.push(isPowerShellRunner ? "-TargetWindowTitle" : "--target-window-title", options.targetWindowTitle);
  }
  if (entry.adapterId === "existing-browser-automation" && options.reviewedBrowserTarget) {
    executeArgs.push("--reviewed-browser-target", options.reviewedBrowserTarget);
  }
  if (entry.adapterId === "existing-application-api" && options.reviewedApiRequest) {
    executeArgs.push("--reviewed-api-request", options.reviewedApiRequest);
  }
  if (entry.adapterId === "existing-file-import-export" && options.reviewedMapping) {
    executeArgs.push("--reviewed-mapping", options.reviewedMapping);
  }
  return executeArgs;
}

function runAdapterRunner(entry, args, cwd) {
  const runnerPath = resolve(entry.runnerPath);
  if (!existsSync(runnerPath)) throw new Error(`runner missing: ${runnerPath}`);
  if (extname(runnerPath).toLowerCase() === ".ps1") {
    return spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", runnerPath, ...args], {
      cwd,
      encoding: "utf8",
      timeout: 180000
    });
  }
  return spawnSync(process.execPath, [runnerPath, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 180000
  });
}

function receiptLooksExecuted(receipt) {
  return Boolean(
    receipt?.commandExecuted ||
      receipt?.apiRequestSent ||
      receipt?.filesWrittenForImport ||
      receipt?.browserDomOperationApplied ||
      receipt?.browserCdpOperationApplied ||
      receipt?.uiEventsSent ||
      Number(receipt?.executedActionIds?.length ?? 0) > 0
  );
}

function resultStatus(receipt, executeRequested) {
  const status = String(receipt?.status || "unknown");
  if (status.startsWith("blocked_")) return "blocked_by_adapter_runner";
  if (!executeRequested) return "dry_run_verified_no_route_action";
  if (receiptLooksExecuted(receipt)) return "teacher_confirmed_route_action_completed_waiting_for_teacher_review";
  return "execute_requested_but_no_route_action_waiting_for_teacher_review";
}

function maybePreflightPath(entry) {
  if (entry.adapterId !== "existing-windows-ui-automation") return "";
  const candidate = join(dirname(entry.receiptPath), "existing-windows-ui-automation-preflight.json");
  return existsSync(candidate) ? candidate : "";
}

function controlledRouteSummary(receipt) {
  return {
    adapterId: receipt?.adapterId || "",
    status: receipt?.status || "",
    commandExecuted: Boolean(receipt?.commandExecuted),
    apiRequestSent: Boolean(receipt?.apiRequestSent),
    filesWrittenForImport: Boolean(receipt?.filesWrittenForImport),
    browserDomOperationApplied: Boolean(receipt?.browserDomOperationApplied),
    browserCdpOperationApplied: Boolean(receipt?.browserCdpOperationApplied),
    uiEventsSent: Boolean(receipt?.uiEventsSent),
    cliOutputPath: receipt?.cliOutputPath || "",
    responseBodyPath: receipt?.responseBodyPath || "",
    preparedImportFilePath: receipt?.preparedImportFilePath || "",
    browserDomOutputPath: receipt?.browserDomOutputPath || "",
    cdpResponsePath: receipt?.cdpResponsePath || ""
  };
}

function writeBlocked(outDir, reason, context) {
  const locks = {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    teacherConfirmationRequired: true
  };
  const payload = {
    format: "transparent_ai_all_software_execution_pilot_runner_v1",
    status: "blocked_before_adapter_runner",
    reason,
    createdAt: new Date().toISOString(),
    ...context,
    runnerInvoked: false,
    didVerifyOutcome: false,
    didCreatePostActionCheckpoint: false,
    controlledRouteActionExecuted: false,
    locks
  };
  const runnerPath = join(outDir, "all-software-execution-pilot-runner.json");
  const receiptPath = join(outDir, "all-software-execution-pilot-runner-receipt.json");
  writeFileSync(runnerPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        format: "transparent_ai_all_software_execution_pilot_runner_receipt_v1",
        status: payload.status,
        reason,
        controlledRouteActionExecuted: false,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        locks
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return { runnerPath, receiptPath, payload };
}

const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue");
const queue = queueInput.value;
const pilot = selectPilot(queue, argValue("--pilot-id", ""), argValue("--pilot-index", "1"));
const adapterId = argValue("--adapter-id", pilot.primaryAdapterId || "");
const executeRequested = hasFlag("--execute");
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--confirmation", ""));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-pilot-runs")));
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${pilot.pilotId}-${pilot.software}`)}`;
const runDir = join(outputRoot, runId);
mkdirSync(runDir, { recursive: true });

const context = {
  runId,
  queuePath: queueInput.path,
  pilotId: pilot.pilotId,
  software: pilot.software,
  adapterId,
  executeRequested
};

if (!pilot.adapterPackagePath || !existsSync(pilot.adapterPackagePath)) {
  const blocked = writeBlocked(runDir, "pilot is missing an existing execution adapter package; recreate the queue with createAdapterPackages=true", context);
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_all_software_execution_pilot_runner_result_v1", status: blocked.payload.status, runPath: blocked.runnerPath, receiptPath: blocked.receiptPath }, null, 2));
  process.exit(0);
}

const executionPackage = readJson(pilot.adapterPackagePath);
const runnerEntries = Array.isArray(executionPackage.runnerEntries) ? executionPackage.runnerEntries : [];
const entry = runnerEntries.find((item) => item.adapterId === adapterId) || runnerEntries[0];
if (!entry) throw new Error("adapter package has no runner entries");

if (executeRequested && !explicitTeacherConfirmation(teacherConfirmation)) {
  const blocked = writeBlocked(runDir, "execute mode requires explicit teacher confirmation for the all-software execution pilot", {
    ...context,
    adapterId: entry.adapterId,
    executionPackagePath: pilot.adapterPackagePath
  });
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_all_software_execution_pilot_runner_result_v1", status: blocked.payload.status, runPath: blocked.runnerPath, receiptPath: blocked.receiptPath }, null, 2));
  process.exit(0);
}

if (executeRequested && entry.routeReadiness?.executeBlocker) {
  const blocked = writeBlocked(runDir, `route readiness blocked execute mode: ${entry.routeReadiness.executeBlocker}`, {
    ...context,
    adapterId: entry.adapterId,
    executionPackagePath: pilot.adapterPackagePath,
    executeBlocker: entry.routeReadiness.executeBlocker
  });
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_all_software_execution_pilot_runner_result_v1", status: blocked.payload.status, runPath: blocked.runnerPath, receiptPath: blocked.receiptPath }, null, 2));
  process.exit(0);
}

const runnerArgs = runnerArgsFor(entry, {
  execute: executeRequested,
  reviewedCommand: argValue("--reviewed-command", ""),
  reviewedApiRequest: argValue("--reviewed-api-request", ""),
  reviewedMapping: argValue("--reviewed-mapping", ""),
  reviewedBrowserTarget: argValue("--reviewed-browser-target", ""),
  targetWindowTitle: argValue("--target-window-title", "")
});
const receiptMtimeBefore = entry.receiptPath && existsSync(entry.receiptPath) ? statSync(entry.receiptPath).mtimeMs : 0;
const runnerResult = runAdapterRunner(entry, runnerArgs, runDir);
const receiptExistsAfter = existsSync(entry.receiptPath);
const receiptMtimeAfter = receiptExistsAfter ? statSync(entry.receiptPath).mtimeMs : 0;
const adapterRunnerError = runnerResult.error?.message || "";
const adapterProcessFailed = Boolean(adapterRunnerError) || (runnerResult.status !== 0 && runnerResult.status !== null);
const staleReceiptAfterRunner = receiptExistsAfter && receiptMtimeBefore > 0 && receiptMtimeAfter <= receiptMtimeBefore;
if ((adapterProcessFailed || runnerResult.status === null || staleReceiptAfterRunner) && (!receiptExistsAfter || staleReceiptAfterRunner)) {
  const blocked = writeBlocked(
    runDir,
    `adapter runner process failed before writing a fresh receipt: ${adapterRunnerError || runnerResult.stderr || runnerResult.stdout || `exit_status_${runnerResult.status}`}`,
    {
      ...context,
      adapterId: entry.adapterId,
      executionPackagePath: pilot.adapterPackagePath,
      adapterRunnerExitStatus: runnerResult.status,
      adapterRunnerError
    }
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        format: "transparent_ai_all_software_execution_pilot_runner_result_v1",
        status: blocked.payload.status,
        runPath: blocked.runnerPath,
        receiptPath: blocked.receiptPath,
        controlledRouteActionExecuted: false,
        adapterRunnerExitStatus: runnerResult.status
      },
      null,
      2
    )
  );
  process.exit(0);
}
if (!receiptExistsAfter) {
  throw new Error(runnerResult.stderr || runnerResult.stdout || `adapter runner did not write receipt: ${entry.receiptPath}`);
}

const receipt = readJson(entry.receiptPath);
const preflightPath = maybePreflightPath(entry);
const outcomeArgs = ["--receipt", entry.receiptPath, "--plan", pilot.actionPlanPath, "--output-dir", join(runDir, "outcome-verification")];
if (preflightPath) outcomeArgs.push("--preflight", preflightPath);
if (queueInput.path) outcomeArgs.push("--queue", queueInput.path);
if (argValue("--state", "")) outcomeArgs.push("--state", argValue("--state", ""));
if (argValue("--state-dir", "")) outcomeArgs.push("--state-dir", argValue("--state-dir", ""));
if (argValue("--max-items", "")) outcomeArgs.push("--max-items", argValue("--max-items", ""));
if (argValue("--max-logs-per-item", "")) outcomeArgs.push("--max-logs-per-item", argValue("--max-logs-per-item", ""));
for (const marker of argValues("--teacher-marker")) outcomeArgs.push("--teacher-marker", marker);
const outcome = runNodeScript("verify-supervised-action-outcome.mjs", outcomeArgs);

const checkpointArgs = [
  "--goal",
  queue.goal || "Run all-software execution pilot with low-token outcome evidence.",
  "--software",
  pilot.software,
  "--receipt",
  entry.receiptPath,
  "--path",
  dirname(entry.receiptPath),
  "--output-dir",
  join(runDir, "post-action-checkpoint")
];
if (queueInput.path) checkpointArgs.push("--queue", queueInput.path);
for (const marker of argValues("--teacher-marker")) checkpointArgs.push("--teacher-marker", marker);
const checkpoint = runNodeScript("create-post-action-evidence-checkpoint.mjs", checkpointArgs);

const controlledRoute = controlledRouteSummary(receipt);
const controlledRouteActionExecuted = receiptLooksExecuted(receipt);
const status = resultStatus(receipt, executeRequested);
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  teacherConfirmationRequired: true,
  dryRunFirst: true
};
const payloadPath = join(runDir, "all-software-execution-pilot-runner.json");
const runnerReceiptPath = join(runDir, "all-software-execution-pilot-runner-receipt.json");
const readmePath = join(runDir, "ALL_SOFTWARE_EXECUTION_PILOT_RUNNER_START_HERE.md");
const payload = {
  format: "transparent_ai_all_software_execution_pilot_runner_v1",
  runId,
  createdAt: new Date().toISOString(),
  status,
  queuePath: queueInput.path,
  pilotId: pilot.pilotId,
  software: pilot.software,
  adapterId: entry.adapterId,
  executeRequested,
  teacherConfirmationMatched: executeRequested ? explicitTeacherConfirmation(teacherConfirmation) : false,
  runnerInvoked: true,
  runnerExitStatus: runnerResult.status,
  runnerStdoutPreview: String(runnerResult.stdout || "").slice(0, 800),
  runnerStderrPreview: String(runnerResult.stderr || "").slice(0, 800),
  controlledRouteActionExecuted,
  controlledRoute,
  sourceEvidence: {
    executionPilotQueuePath: queueInput.path,
    pilotActionPlanPath: pilot.actionPlanPath,
    adapterSelectionPath: pilot.adapterSelectionPath,
    adapterPackagePath: pilot.adapterPackagePath,
    runnerPath: entry.runnerPath
  },
  generatedEvidence: {
    adapterReceiptPath: entry.receiptPath,
    preflightPath,
    outcomeVerificationPath: outcome.verificationPath,
    outcomeReceiptPath: outcome.receiptPath,
    postActionCheckpointPath: checkpoint.checkpointPath,
    postActionCheckpointReceiptPath: checkpoint.receiptPath,
    readmePath
  },
  nextTeacherActions: [
    "Review the adapter receipt and confirm whether the controlled route result matches the teacher intent.",
    "Use the low-token outcome verification and post-action checkpoint before requesting any screenshot.",
    "If the pilot is correct, repeat the same queue runner on another reviewed software row instead of claiming universal execution.",
    "If the pilot is wrong, correct the command/API/mapping/target before saving any rule."
  ],
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason:
      "This runner proves one teacher-reviewed pilot route at a time. It does not prove universal native execution across every installed application."
  },
  locks
};

const runnerReceipt = {
  format: "transparent_ai_all_software_execution_pilot_runner_receipt_v1",
  runId,
  status,
  adapterId: entry.adapterId,
  adapterReceiptStatus: receipt.status || "unknown",
  outcomeStatus: outcome.status || "unknown",
  checkpointStatus: checkpoint.status || "unknown",
  controlledRouteActionExecuted,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  locks
};

writeFileSync(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
writeFileSync(runnerReceiptPath, `${JSON.stringify(runnerReceipt, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# All-Software Execution Pilot Runner",
    "",
    `Software: ${pilot.software}`,
    `Pilot: ${pilot.pilotId}`,
    `Adapter: ${entry.adapterId}`,
    `Status: ${status}`,
    "",
    "Review order:",
    `1. ${basename(entry.receiptPath)} - adapter runner receipt.`,
    outcome.verificationPath ? `2. ${basename(outcome.verificationPath)} - low-token outcome verification.` : "2. Outcome verification was not produced.",
    checkpoint.checkpointPath ? `3. ${basename(checkpoint.checkpointPath)} - post-action checkpoint before screenshots or learning.` : "3. Post-action checkpoint was not produced.",
    "",
    "Locked boundary: accepted=false, ruleEnabled=false, packagingGated=true, screenshotsCaptured=false, fullContinuousRecording=false, memoryWritten=false, nativeUniversalExecution=false, allSoftwareExecutionComplete=false."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_pilot_runner_result_v1",
      status,
      runId,
      runDir,
      runPath: payloadPath,
      receiptPath: runnerReceiptPath,
      adapterReceiptPath: entry.receiptPath,
      outcomeVerificationPath: outcome.verificationPath,
      postActionCheckpointPath: checkpoint.checkpointPath,
      pilotId: pilot.pilotId,
      software: pilot.software,
      adapterId: entry.adapterId,
      executeRequested,
      controlledRouteActionExecuted,
      screenshotsCaptured: false,
      fullContinuousRecording: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false
    },
    null,
    2
  )
);
