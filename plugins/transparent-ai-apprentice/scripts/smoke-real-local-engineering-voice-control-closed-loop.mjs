#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-engineering-voice-control-closed-loop-smoke", String(Date.now()));
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
  if (extension === ".ps1") {
    return runPowerShell(["-File", runnerPath]);
  }
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
  "Find a real local software candidate for engineering voice control closed-loop smoke.",
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
const goal = `Let a non-expert use voice or typed text to control ${software} after numbered target confirmation.`;
const voiceTranscript = "Please select the upper right visible region and prepare a reviewed measurement there.";
const command = "Select the upper right visible region and prepare a reviewed measurement.";

const voiceSession = runNodeScript("create-engineering-voice-control-session.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--process-name",
  processName,
  "--window-title",
  windowTitle,
  "--voice-transcript",
  voiceTranscript,
  "--command",
  command,
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
  "existing-windows-ui-automation",
  "--create-adapter-selection",
  ...(installPath ? ["--install-path", installPath] : []),
  "--output-dir",
  join(smokeRoot, "voice-session")
]);

const session = readJson(voiceSession.sessionPath);
const targetConfirmation = readJson(voiceSession.targetConfirmation);
const probePlan = readJson(session.generated.softwareControlChannelProbe.probePlan);
const controlProfile = readJson(voiceSession.softwareControlChannelProfile);

const confirmed = runNodeScript("confirm-engineering-command-target.mjs", [
  "--confirmation",
  voiceSession.targetConfirmation,
  "--selected-number",
  "1",
  "--goal",
  goal,
  "--software",
  software,
  "--process-name",
  processName,
  "--window-title",
  windowTitle,
  "--create-action-kit",
  "--create-execution-adapter",
  "--preferred-adapter",
  "existing-windows-ui-automation",
  "--capability-profile",
  voiceSession.softwareControlChannelProfile,
  "--output-dir",
  join(smokeRoot, "confirmed-target"),
  "--action-output-dir",
  join(smokeRoot, "confirmed-target", "supervised-action-kits"),
  "--execution-adapter-output-dir",
  join(smokeRoot, "confirmed-target", "execution-adapter-selections")
]);

const confirmationReceipt = readJson(confirmed.receipt);
const executionPackage = readJson(confirmed.existingExecutionPackage);
const firstRunner = Array.isArray(executionPackage.runnerEntries) ? executionPackage.runnerEntries[0] : null;
if (!firstRunner?.runnerPath || !firstRunner?.receiptPath) throw new Error("Confirmed target did not create a dry-run runner entry.");

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
  confirmed.existingExecutionPackage,
  "--output-dir",
  join(smokeRoot, "post-action-checkpoint")
]);
const checkpointJson = readJson(checkpoint.checkpointPath);

const checks = [
  {
    name: "Real local software candidate feeds the voice/text control session",
    pass:
      inventoryProbe.status === 0 &&
      inventory?.format === "transparent_ai_software_observer_inventory_v1" &&
      Array.isArray(inventory.softwareCandidates) &&
      inventory.softwareCandidates.length > 0 &&
      session.format === "transparent_ai_engineering_voice_control_session_v1" &&
      session.software === software &&
      session.voiceTranscriptProvided === true,
    evidence: `software=${software}; inventory=${inventoryPath}; session=${voiceSession.sessionPath}`
  },
  {
    name: "Voice or typed instruction produces numbered target candidates before execution",
    pass:
      targetConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      targetConfirmation.candidates.length === 2 &&
      targetConfirmation.candidates.every((candidateRow) => Number.isInteger(candidateRow.number)) &&
      session.generated.engineeringCommandConfirmationKit.nextConfirmationBridge === "confirm_engineering_command_target" &&
      session.locks.numberedTargetConfirmationRequired === true,
    evidence: voiceSession.targetConfirmation
  },
  {
    name: "Session reuses a review-only probe package and control-channel profile instead of direct native control",
    pass:
      probePlan.format === "transparent_ai_software_control_channel_probe_plan_v1" &&
      session.generated.softwareControlChannelProbe.didRunReadOnlyProbe === false &&
      controlProfile.format === "transparent_ai_software_control_channel_profile_v1" &&
      controlProfile.recommendedRoute.dryRunFirst === true &&
      controlProfile.lowTokenPolicy.preferReceiptsBeforeScreenshots === true &&
      controlProfile.locks.nativeUniversalExecution === false,
    evidence: voiceSession.softwareControlChannelProfile
  },
  {
    name: "Teacher-confirmed number narrows voice command to one selected target",
    pass:
      confirmationReceipt.format === "transparent_ai_engineering_command_target_confirmation_receipt_v1" &&
      confirmationReceipt.selectedCandidateNumber === 1 &&
      confirmationReceipt.evidence.selectedTargetOnly === true &&
      confirmationReceipt.evidence.narrowedOverlayAnchorCount === 1 &&
      confirmationReceipt.evidence.existingExecutionAdapterSelectionCreated === true,
    evidence: confirmed.receipt
  },
  {
    name: "Confirmed target creates an existing execution package with dry-run runner",
    pass:
      executionPackage.format === "transparent_ai_existing_software_execution_package_v1" &&
      executionPackage.locks.dryRunDefault === true &&
      executionPackage.runnerEntries.length > 0 &&
      firstRunner.defaultMode === "dry_run" &&
      firstRunner.teacherConfirmationRequired === true &&
      firstRunner.executeFlagRequired === true,
    evidence: confirmed.existingExecutionPackage
  },
  {
    name: "Dry-run runner writes a no-event receipt before any engineering software action",
    pass:
      dryRunReceipt.format === "transparent_ai_existing_software_execution_receipt_v1" &&
      dryRunReceipt.mode === "dry_run" &&
      String(dryRunReceipt.status || "").startsWith("dry_run") &&
      dryRunReceipt.teacherConfirmed === false &&
      dryRunReceipt.execute === false &&
      dryRunReceipt.uiEventsSent === false &&
      Array.isArray(dryRunReceipt.executedActionIds) &&
      dryRunReceipt.executedActionIds.length === 0 &&
      dryRunReceipt.locks.ruleEnabled === false &&
      dryRunReceipt.locks.nativeUniversalExecution === false,
    evidence: firstRunner.receiptPath
  },
  {
    name: "Dry-run receipt flows into outcome verification and post-action checkpoint",
    pass:
      outcomeVerification.format === "transparent_ai_supervised_action_outcome_verification_v1" &&
      outcomeVerification.receiptFamily === "existing_software_execution" &&
      outcomeVerification.result.status === "existing_execution_dry_run_verified_no_events" &&
      outcomeVerification.result.outcomeAccepted === false &&
      checkpointJson.format === "transparent_ai_post_action_low_token_evidence_checkpoint_v1" &&
      checkpointJson.result.status === "dry_run_checkpoint_verified_no_software_events" &&
      checkpointJson.locks.screenshotsCaptured === false,
    evidence: `${outcome.verificationPath}; ${checkpoint.checkpointPath}`
  },
  {
    name: "Voice-control closed loop keeps recording, screenshots, memory, acceptance, packaging, and native execution locked",
    pass:
      session.locks.fullContinuousRecording === false &&
      session.locks.screenshotsCaptured === false &&
      session.locks.softwareActionsExecuted === false &&
      session.locks.targetSoftwareCommandsExecuted === false &&
      session.locks.nativeUniversalExecution === false &&
      dryRunReceipt.locks.accepted === false &&
      dryRunReceipt.locks.ruleEnabled === false &&
      dryRunReceipt.locks.packagingGated === true &&
      outcomeVerification.locks.nativeUniversalExecution === false &&
      checkpointJson.locks.memoryWritten === false &&
      checkpointJson.locks.nativeUniversalExecution === false,
    evidence: JSON.stringify(session.locks)
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_engineering_voice_control_closed_loop_smoke_v1",
  smokeRoot,
  realLocalSoftware: { software, processName, windowTitle },
  paths: {
    inventory: inventoryPath,
    session: voiceSession.sessionPath,
    targetConfirmation: voiceSession.targetConfirmation,
    confirmedTargetReceipt: confirmed.receipt,
    executionPackage: confirmed.existingExecutionPackage,
    dryRunReceipt: firstRunner.receiptPath,
    outcomeVerification: outcome.verificationPath,
    postActionCheckpoint: checkpoint.checkpointPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
