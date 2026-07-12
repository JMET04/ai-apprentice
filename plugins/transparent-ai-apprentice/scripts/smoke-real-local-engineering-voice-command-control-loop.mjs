#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-engineering-voice-command-control-loop-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowerShell(args, cwd = smokeRoot) {
  return spawnSync("powershell", ["-ExecutionPolicy", "Bypass", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runDryRunRunner(runnerPath) {
  const extension = extname(runnerPath).toLowerCase();
  if (extension === ".ps1") return runPowerShell(["-File", runnerPath], repoRoot);
  if (extension === ".mjs" || extension === ".js") {
    return spawnSync(process.execPath, [runnerPath], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 120000
    });
  }
  throw new Error(`Unsupported runner type for dry-run smoke: ${runnerPath}`);
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Find a real local software candidate for the one-command engineering voice control loop.",
  "--max-processes",
  "6",
  "--max-installed",
  "6",
  "--max-log-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "inventory-kit")
]);

const inventoryPath = join(smokeRoot, "real-local-software-observer-inventory.json");
const inventoryProbe = runPowerShell([
  "-File",
  inventoryKit.readOnlyProbe,
  "-OutputPath",
  inventoryPath,
  "-MaxProcesses",
  "6",
  "-MaxInstalled",
  "6",
  "-MaxLogFilesPerCandidate",
  "1"
]);
const inventory = existsSync(inventoryPath) ? readJson(inventoryPath) : null;
const candidate = Array.isArray(inventory?.softwareCandidates) && inventory.softwareCandidates.length > 0
  ? inventory.softwareCandidates.find((row) => row.windowTitle || row.processName) || inventory.softwareCandidates[0]
  : null;
if (!candidate) throw new Error("Real local inventory returned no software candidates.");

const software = String(candidate.software || candidate.processName || "real local software");
const processName = String(candidate.processName || "");
const windowTitle = String(candidate.windowTitle || "");
const installPath = String(candidate.installPath || candidate.executablePath || "");
const goal = `Let a non-expert control ${software} by voice or text through a numbered target confirmation loop.`;
const command = "Select the upper right visible region and prepare a reviewed measurement there.";
const voiceTranscript = "Please select the upper right visible region and prepare a reviewed measurement there.";
const commonArgs = [
  "--goal",
  goal,
  "--software",
  software,
  "--process-name",
  processName,
  "--window-title",
  windowTitle,
  "--command",
  command,
  "--voice-transcript",
  voiceTranscript,
  "--candidate",
  "visible-upper-right-region|upper right visible region|0.76|0.24|0.1|voice command points to the upper right region",
  "--candidate",
  "nearby-tool-or-property-panel|nearby tool or property panel|0.18|0.38|0|alternative control area if geometry target is wrong",
  "--no-port-scan",
  "--max-files",
  "24",
  "--max-depth",
  "1",
  "--max-registry-items",
  "0",
  "--preferred-adapter",
  "existing-windows-ui-automation"
];
if (installPath) commonArgs.push("--install-path", installPath);

const waiting = runNodeScript("run-engineering-voice-command-control-loop.mjs", [
  ...commonArgs,
  "--output-dir",
  join(smokeRoot, "waiting")
]);
const waitingLoop = readJson(waiting.controlLoopPath);
const targetConfirmation = readJson(waiting.targetConfirmation);

const confirmed = runNodeScript("run-engineering-voice-command-control-loop.mjs", [
  ...commonArgs,
  "--selected-number",
  "1",
  "--teacher-confirmed-number",
  "--output-dir",
  join(smokeRoot, "confirmed")
]);
const confirmedLoop = readJson(confirmed.controlLoopPath);
const controlLoopReceipt = readJson(confirmed.receiptPath);
const confirmationReceipt = readJson(confirmed.confirmationResult);
const executionPackage = readJson(confirmedLoop.generated.existingExecutionPackage);
const firstRunner = Array.isArray(executionPackage.runnerEntries) ? executionPackage.runnerEntries[0] : null;
if (!firstRunner?.runnerPath || !firstRunner?.receiptPath) throw new Error("Confirmed loop did not create a dry-run runner entry.");

const dryRun = runDryRunRunner(firstRunner.runnerPath);
if (dryRun.status !== 0) throw new Error(dryRun.stderr || dryRun.stdout || "dry-run runner failed");
const dryRunReceipt = readJson(firstRunner.receiptPath);

const outcome = runNodeScript("verify-supervised-action-outcome.mjs", [
  "--receipt",
  firstRunner.receiptPath,
  "--output-dir",
  join(smokeRoot, "outcome-verification")
]);
const outcomeVerification = readJson(outcome.verificationPath);

const checkpoint = runNodeScript("create-post-action-evidence-checkpoint.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--receipt",
  firstRunner.receiptPath,
  "--watch-path",
  confirmedLoop.generated.existingExecutionPackage,
  "--output-dir",
  join(smokeRoot, "post-action-checkpoint")
]);
const checkpointJson = readJson(checkpoint.checkpointPath);

const checks = [
  {
    name: "Real local software candidate feeds the one-command voice control loop",
    pass:
      inventoryProbe.status === 0 &&
      inventory?.format === "transparent_ai_software_observer_inventory_v1" &&
      Array.isArray(inventory.softwareCandidates) &&
      inventory.softwareCandidates.length > 0 &&
      waitingLoop.format === "transparent_ai_engineering_voice_command_control_loop_v1" &&
      waitingLoop.software === software &&
      waitingLoop.voiceTranscriptProvided === true,
    evidence: `software=${software}; inventory=${inventoryPath}; loop=${waiting.controlLoopPath}`
  },
  {
    name: "Real local loop waits at numbered candidates before execution planning",
    pass:
      waiting.status === "waiting_for_numbered_target_confirmation" &&
      targetConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      targetConfirmation.candidates.length === 2 &&
      waitingLoop.selectedCandidateNumber === null &&
      waitingLoop.locks.softwareActionsExecuted === false &&
      waitingLoop.locks.targetSoftwareCommandsExecuted === false &&
      waitingLoop.locks.uiEventsSent === false,
    evidence: waiting.targetConfirmation
  },
  {
    name: "Teacher-confirmed real local number creates one selected dry-run package",
    pass:
      confirmed.status === "number_confirmed_dry_run_execution_package_ready" &&
      confirmedLoop.selectedCandidateNumber === 1 &&
      confirmationReceipt.format === "transparent_ai_engineering_command_target_confirmation_receipt_v1" &&
      confirmationReceipt.selectedCandidateNumber === 1 &&
      confirmationReceipt.evidence.selectedTargetOnly === true &&
      confirmationReceipt.evidence.narrowedOverlayAnchorCount === 1 &&
      executionPackage.format === "transparent_ai_existing_software_execution_package_v1" &&
      firstRunner.defaultMode === "dry_run",
    evidence: confirmed.controlLoopPath
  },
  {
    name: "Dry-run runner and outcome verifier stay locked for the real local candidate",
    pass:
      dryRunReceipt.format === "transparent_ai_existing_software_execution_receipt_v1" &&
      dryRunReceipt.status === "dry_run_no_ui_events" &&
      dryRunReceipt.mode === "dry_run" &&
      dryRunReceipt.execute === false &&
      dryRunReceipt.uiEventsSent === false &&
      outcomeVerification.format === "transparent_ai_supervised_action_outcome_verification_v1" &&
      outcomeVerification.executionReceipt?.status === "dry_run_no_ui_events" &&
      outcomeVerification.executionReceipt?.uiEventsSent === false &&
      outcomeVerification.result?.status === "existing_execution_dry_run_verified_no_events",
    evidence: firstRunner.receiptPath
  },
  {
    name: "Post-action checkpoint uses cheap evidence before screenshots or learning",
    pass:
      checkpointJson.format === "transparent_ai_post_action_low_token_evidence_checkpoint_v1" &&
      checkpointJson.locks.screenshotsCaptured === false &&
      checkpointJson.locks.memoryWritten === false &&
      checkpointJson.locks.nativeUniversalExecution === false &&
      controlLoopReceipt.locks.fullContinuousRecording === false &&
      controlLoopReceipt.locks.storesAudio === false,
    evidence: checkpoint.checkpointPath
  },
  {
    name: "Real local one-command loop keeps broad completion honest",
    pass:
      confirmedLoop.locks.nativeUniversalExecution === false &&
      confirmedLoop.locks.accepted === false &&
      confirmedLoop.locks.ruleEnabled === false &&
      confirmedLoop.locks.packagingGated === true &&
      confirmedLoop.blockedActions.includes("claim_universal_native_execution_or_goal_completion"),
    evidence: JSON.stringify(confirmedLoop.locks)
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_engineering_voice_command_control_loop_smoke_v1",
  smokeRoot,
  software,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
