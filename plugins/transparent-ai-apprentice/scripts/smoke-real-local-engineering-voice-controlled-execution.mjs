#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-engineering-voice-controlled-execution-smoke", String(Date.now()));
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

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runRunner(runnerPath, extraArgs = []) {
  const extension = extname(runnerPath).toLowerCase();
  if (extension === ".ps1") return runPowerShell(["-File", runnerPath, ...extraArgs], repoRoot);
  if (extension === ".mjs" || extension === ".js") {
    return spawnSync(process.execPath, [runnerPath, ...extraArgs], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 120000
    });
  }
  throw new Error(`Unsupported runner type: ${runnerPath}`);
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Find a real local software candidate for engineering voice controlled execution smoke.",
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

const software = String(candidate.software || candidate.processName || "real local engineering software");
const processName = String(candidate.processName || "");
const windowTitle = String(candidate.windowTitle || "");
const installPath = String(candidate.installPath || candidate.executablePath || "");
const goal = `Let a non-expert use voice or typed text to mark a numbered target in ${software}, confirm the number, then run a teacher-reviewed controlled command.`;
const voiceTranscript = "Mark the upper right candidate as number one and prepare the reviewed command there.";
const command = "Mark the upper right candidate as number one and prepare the reviewed command there.";

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
  "upper-right-reviewed-command-target|upper right reviewed command target|0.78|0.22|0.1|teacher voice command points to this visible engineering target",
  "--candidate",
  "left-side-tool-or-feature-panel|left-side tool or feature panel|0.2|0.42|0|alternative route if the intended target is a tool panel",
  "--no-port-scan",
  "--max-files",
  "24",
  "--max-depth",
  "1",
  "--max-registry-items",
  "0",
  "--preferred-adapter",
  "existing-cli-or-script",
  "--create-adapter-selection",
  ...(installPath ? ["--install-path", installPath] : []),
  "--output-dir",
  join(smokeRoot, "voice-session")
]);

const session = readJson(voiceSession.sessionPath);
const targetConfirmation = readJson(voiceSession.targetConfirmation);
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
  "existing-cli-or-script",
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
const cliRunner = Array.isArray(executionPackage.runnerEntries)
  ? executionPackage.runnerEntries.find((entry) => entry.adapterId === "existing-cli-or-script")
  : null;
if (!cliRunner?.runnerPath || !cliRunner?.receiptPath) {
  throw new Error("Confirmed target did not create the controlled CLI/script runner.");
}

const dryRun = runRunner(cliRunner.runnerPath);
if (dryRun.status !== 0) throw new Error(dryRun.stderr || dryRun.stdout || "controlled CLI dry-run failed");
const dryRunReceipt = readJson(cliRunner.receiptPath);

const reviewedScriptPath = join(smokeRoot, "teacher-reviewed-engineering-command.mjs");
writeFileSync(
  reviewedScriptPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "if (!outputPath) process.exit(2);",
    "writeFileSync(outputPath, JSON.stringify({",
    "  ok: true,",
    "  route: 'existing-cli-or-script',",
    "  action: 'teacher-reviewed-engineering-voice-controlled-command',",
    "  targetNumberConfirmedByTeacher: 1,",
    "  controlledOutputOnly: true",
    "}, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);

const targetOutputFileName = "teacher-reviewed-engineering-command-output.json";
const reviewedCommandPath = join(smokeRoot, "reviewed-engineering-cli-command.json");
writeFileSync(
  reviewedCommandPath,
  JSON.stringify(
    {
      format: "transparent_ai_reviewed_cli_command_manifest_v1",
      teacherReviewed: true,
      commandKind: "node-script",
      scriptSourceFile: reviewedScriptPath,
      targetOutputFileName,
      expectedScriptSha256: sha256(reviewedScriptPath),
      rollbackRequired: true,
      sourceVoiceOrTextTargetConfirmation: confirmed.receipt,
      selectedCandidateNumber: 1
    },
    null,
    2
  ),
  "utf8"
);

const executionPackageDir = dirname(cliRunner.runnerPath);
const expectedOutputPath = join(executionPackageDir, "cli-output", targetOutputFileName);
const dryRunOutputAbsent = !existsSync(expectedOutputPath);
const before = runNodeScript("create-post-action-evidence-checkpoint.mjs", [
  "--phase",
  "before",
  "--goal",
  goal,
  "--software",
  software,
  "--file",
  expectedOutputPath,
  "--output-dir",
  join(smokeRoot, "post-action-before")
]);

const executeRun = runRunner(cliRunner.runnerPath, ["-TeacherConfirmed", "-Execute", "-ReviewedCommand", reviewedCommandPath]);
if (executeRun.status !== 0) throw new Error(executeRun.stderr || executeRun.stdout || "controlled CLI execute failed");
const executeReceipt = readJson(cliRunner.receiptPath);
const cliOutput = executeReceipt.cliOutputPath ? readJson(executeReceipt.cliOutputPath) : null;

const outcome = runNodeScript("verify-supervised-action-outcome.mjs", [
  "--receipt",
  cliRunner.receiptPath,
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
  cliRunner.receiptPath,
  "--before-state",
  before.statePath,
  "--file",
  expectedOutputPath,
  "--output-dir",
  join(smokeRoot, "post-action-after")
]);
const checkpointJson = readJson(checkpoint.checkpointPath);

const outputInsidePackage =
  Boolean(executeReceipt.cliOutputPath) &&
  resolve(executeReceipt.cliOutputPath).startsWith(resolve(executionPackageDir));

const checks = [
  {
    name: "Real local software candidate is selected before voice controlled execution",
    pass:
      inventoryProbe.status === 0 &&
      inventory?.format === "transparent_ai_software_observer_inventory_v1" &&
      Array.isArray(inventory.softwareCandidates) &&
      inventory.softwareCandidates.length > 0 &&
      session.format === "transparent_ai_engineering_voice_control_session_v1" &&
      session.software === software,
    evidence: `software=${software}; inventory=${inventoryPath}; session=${voiceSession.sessionPath}`
  },
  {
    name: "Voice or typed engineering command marks numbered possible positions for teacher confirmation",
    pass:
      targetConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      targetConfirmation.candidates.length === 2 &&
      targetConfirmation.candidates.every((row) => Number.isInteger(row.number)) &&
      session.locks.numberedTargetConfirmationRequired === true &&
      session.generated.engineeringCommandConfirmationKit.nextConfirmationBridge === "confirm_engineering_command_target",
    evidence: voiceSession.targetConfirmation
  },
  {
    name: "Teacher-confirmed number narrows to one target before any controlled execution",
    pass:
      confirmationReceipt.format === "transparent_ai_engineering_command_target_confirmation_receipt_v1" &&
      confirmationReceipt.selectedCandidateNumber === 1 &&
      confirmationReceipt.evidence.selectedTargetOnly === true &&
      confirmationReceipt.evidence.narrowedOverlayAnchorCount === 1 &&
      cliRunner.adapterId === "existing-cli-or-script" &&
      cliRunner.routeReadiness.readyForExecution === true,
    evidence: confirmed.receipt
  },
  {
    name: "Dry-run controlled execution route writes no output and executes no command",
    pass:
      dryRunReceipt.format === "transparent_ai_existing_software_execution_receipt_v1" &&
      dryRunReceipt.adapterId === "existing-cli-or-script" &&
      dryRunReceipt.mode === "dry_run" &&
      dryRunReceipt.status === "dry_run_no_command_executed" &&
      dryRunReceipt.commandExecuted === false &&
      dryRunOutputAbsent &&
      dryRunReceipt.locks.nativeUniversalExecution === false,
    evidence: cliRunner.receiptPath
  },
  {
    name: "Teacher-confirmed controlled CLI route writes only inside the execution package",
    pass:
      executeReceipt.format === "transparent_ai_existing_software_execution_receipt_v1" &&
      executeReceipt.status === "teacher_confirmed_cli_script_executed" &&
      executeReceipt.commandExecuted === true &&
      executeReceipt.teacherConfirmed === true &&
      executeReceipt.execute === true &&
      outputInsidePackage &&
      existsSync(executeReceipt.cliOutputPath) &&
      cliOutput?.action === "teacher-reviewed-engineering-voice-controlled-command" &&
      cliOutput?.targetNumberConfirmedByTeacher === 1 &&
      executeReceipt.locks.accepted === false &&
      executeReceipt.locks.packagingGated === true,
    evidence: executeReceipt.cliOutputPath
  },
  {
    name: "Controlled execution receipt flows into outcome verification and post-action checkpoint",
    pass:
      outcomeVerification.format === "transparent_ai_supervised_action_outcome_verification_v1" &&
      outcomeVerification.receiptFamily === "existing_software_execution" &&
      outcomeVerification.result.status === "execution_receipt_waiting_for_teacher_review" &&
      outcomeVerification.result.outcomeAccepted === false &&
      checkpointJson.format === "transparent_ai_post_action_low_token_evidence_checkpoint_v1" &&
      checkpointJson.result.status === "post_action_changed_waiting_for_teacher_review" &&
      checkpointJson.stateComparison.changedItemCount >= 1 &&
      checkpointJson.locks.screenshotsCaptured === false &&
      checkpointJson.locks.memoryWritten === false,
    evidence: `${outcome.verificationPath}; ${checkpoint.checkpointPath}`
  },
  {
    name: "Voice controlled execution keeps autonomous native control, screenshots, memory, acceptance, and packaging locked",
    pass:
      controlProfile.format === "transparent_ai_software_control_channel_profile_v1" &&
      controlProfile.recommendedRoute.dryRunFirst === true &&
      session.locks.fullContinuousRecording === false &&
      session.locks.screenshotsCaptured === false &&
      session.locks.nativeUniversalExecution === false &&
      executeReceipt.locks.nativeUniversalExecution === false &&
      outcomeVerification.locks.nativeUniversalExecution === false &&
      checkpointJson.locks.nativeUniversalExecution === false &&
      checkpointJson.locks.ruleEnabled === false &&
      checkpointJson.locks.packagingGated === true,
    evidence: JSON.stringify({ sessionLocks: session.locks, receiptLocks: executeReceipt.locks })
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_engineering_voice_controlled_execution_smoke_v1",
  smokeRoot,
  realLocalSoftware: { software, processName, windowTitle },
  paths: {
    inventory: inventoryPath,
    session: voiceSession.sessionPath,
    targetConfirmation: voiceSession.targetConfirmation,
    confirmedTargetReceipt: confirmed.receipt,
    executionPackage: confirmed.existingExecutionPackage,
    dryRunReceipt: cliRunner.receiptPath,
    reviewedCommand: reviewedCommandPath,
    executeReceipt: cliRunner.receiptPath,
    controlledOutput: executeReceipt.cliOutputPath,
    outcomeVerification: outcome.verificationPath,
    postActionBeforeState: before.statePath,
    postActionCheckpoint: checkpoint.checkpointPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
