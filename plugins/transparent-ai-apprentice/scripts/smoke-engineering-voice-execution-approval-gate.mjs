#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const sourceServerScript = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const serverScript = existsSync(sourceServerScript) ? sourceServerScript : packagedServerScript;
const serverCwd = existsSync(sourceServerScript) ? repoRoot : resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "engineering-voice-execution-approval-gate-smoke", String(Date.now()));
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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: serverCwd,
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let nextId = 1;
  const pending = new Map();
  let stdoutBuffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });
  function rpc(method, params = {}) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolvePromise, rejectPromise) => pending.set(id, { resolve: resolvePromise, reject: rejectPromise }));
  }
  async function stop() {
    child.kill();
    await new Promise((resolvePromise) => child.once("exit", resolvePromise));
  }
  return { rpc, stop };
}

async function callAdvancedVoiceExecutionApprovalGate({ confirmation, targetValidation, executionPackage, reviewedCommand, rollbackPoint }) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_engineering_voice_execution_approval_gate",
      arguments: {
        goal,
        software,
        confirmation,
        targetConfirmationValidation: targetValidation,
        executionPackage,
        adapterId: "existing-cli-or-script",
        reviewedCommand,
        teacherConfirmation: "teacher confirmed engineering voice execution",
        rollbackPointCreated: true,
        rollbackPoint,
        outputDir: join(smokeRoot, "mcp-ready-gate")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const goal = "Let a non-expert voice command prepare a reviewed engineering measurement on a numbered target.";
const software = "Engineering voice approval smoke app";
const command = "Prepare a reviewed measurement at target number one.";

const loop = runNodeScript("run-engineering-voice-command-control-loop.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--command",
  command,
  "--voice-transcript",
  command,
  "--candidate",
  "reviewed-measurement-target|reviewed measurement target|0.74|0.26|0.1|voice command points to this candidate",
  "--candidate",
  "nearby-property-panel|nearby property panel|0.24|0.44|0|alternate target if the first location is wrong",
  "--selected-number",
  "1",
  "--teacher-confirmed-number",
  "--preferred-adapter",
  "existing-cli-or-script",
  "--no-port-scan",
  "--max-files",
  "12",
  "--max-depth",
  "1",
  "--max-registry-items",
  "0",
  "--output-dir",
  join(smokeRoot, "voice-loop")
]);

const loopPacket = readJson(loop.controlLoopPath);
const confirmationReceipt = readJson(loop.confirmationResult);
const executionPackage = readJson(loopPacket.generated.existingExecutionPackage);
const runner = executionPackage.runnerEntries.find((entry) => entry.adapterId === "existing-cli-or-script") || executionPackage.runnerEntries[0];
if (!runner?.runnerPath) throw new Error("voice loop did not create a runner entry");

const targetValidation = runNodeScript("validate-engineering-command-target-confirmation-receipt.mjs", [
  "--receipt",
  loop.confirmationResult,
  "--output-dir",
  join(smokeRoot, "target-confirmation-validation")
]);
const targetValidationPacket = readJson(targetValidation.validationPath);

const blocked = runNodeScript("create-engineering-voice-execution-approval-gate.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--confirmation",
  loop.confirmationResult,
  "--execution-package",
  loopPacket.generated.existingExecutionPackage,
  "--adapter-id",
  "existing-cli-or-script",
  "--output-dir",
  join(smokeRoot, "blocked-gate")
]);
const blockedPacket = readJson(blocked.gatePath);

const reviewedScriptPath = join(smokeRoot, "teacher-reviewed-voice-command.mjs");
writeFileSync(
  reviewedScriptPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "if (!outputPath) process.exit(2);",
    "writeFileSync(outputPath, JSON.stringify({",
    "  ok: true,",
    "  route: 'existing-cli-or-script',",
    "  action: 'teacher-reviewed-engineering-voice-approval-gate-command',",
    "  selectedCandidateNumber: 1,",
    "  controlledOutputOnly: true",
    "}, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);

const reviewedCommandPath = join(smokeRoot, "reviewed-voice-command.json");
const rollbackPointPath = join(smokeRoot, "retained-rollback-point-before-voice-execute");
mkdirSync(rollbackPointPath, { recursive: true });
writeFileSync(
  reviewedCommandPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_reviewed_cli_command_manifest_v1",
      teacherReviewed: true,
      commandKind: "node-script",
      scriptSourceFile: reviewedScriptPath,
      targetOutputFileName: "teacher-reviewed-voice-command-output.json",
      expectedScriptSha256: sha256(reviewedScriptPath),
      rollbackRequired: true,
      sourceVoiceOrTextTargetConfirmation: loop.confirmationResult,
      selectedCandidateNumber: 1
    },
    null,
    2
  )}\n`,
  "utf8"
);

const ready = runNodeScript("create-engineering-voice-execution-approval-gate.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--confirmation",
  loop.confirmationResult,
  "--target-confirmation-validation",
  targetValidation.validationPath,
  "--execution-package",
  loopPacket.generated.existingExecutionPackage,
  "--adapter-id",
  "existing-cli-or-script",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-confirmation",
  "teacher confirmed engineering voice execution",
  "--rollback-point-created",
  "--rollback-point",
  rollbackPointPath,
  "--output-dir",
  join(smokeRoot, "ready-gate")
]);
const readyPacket = readJson(ready.gatePath);
const readyReceipt = readJson(ready.receiptPath);
const mcpReady = await callAdvancedVoiceExecutionApprovalGate({
  confirmation: loop.confirmationResult,
  targetValidation: targetValidation.validationPath,
  executionPackage: loopPacket.generated.existingExecutionPackage,
  reviewedCommand: reviewedCommandPath,
  rollbackPoint: rollbackPointPath
});
const mcpReadyPacket = readJson(mcpReady.result.gatePath);
const advancedNames = mcpReady.list.tools.map((tool) => tool.name);
const expectedOutputPath = join(dirname(runner.runnerPath), "cli-output", "teacher-reviewed-voice-command-output.json");

const checks = [
  {
    name: "Voice/text command is narrowed to one numbered target before approval",
    pass:
      loop.status === "number_confirmed_dry_run_execution_package_ready" &&
      confirmationReceipt.format === "transparent_ai_engineering_command_target_confirmation_receipt_v1" &&
      confirmationReceipt.selectedCandidateNumber === 1 &&
      confirmationReceipt.evidence.selectedTargetOnly === true &&
      targetValidationPacket.format === "transparent_ai_engineering_command_target_confirmation_receipt_validation_v1" &&
      targetValidationPacket.status === "ready_for_execution_approval_gate_not_execution" &&
      targetValidationPacket.readyForExecutionApprovalGate === true &&
      executionPackage.format === "transparent_ai_existing_software_execution_package_v1",
    evidence: targetValidation.validationPath
  },
  {
    name: "Approval gate blocks voice execute request without target validation route evidence and rollback point",
    pass:
      blocked.status === "blocked_before_voice_execute_runner_request" &&
      blockedPacket.blockers.includes("missing_explicit_teacher_voice_execute_confirmation") &&
      blockedPacket.blockers.includes("missing_target_confirmation_receipt_validation") &&
      blockedPacket.blockers.includes("missing_reviewed_command_manifest") &&
      blockedPacket.blockers.includes("rollback_point_not_confirmed_for_voice_execute_attempt") &&
      blockedPacket.blockers.includes("rollback_point_path_missing_for_voice_execute_attempt") &&
      blockedPacket.locks.approvalGateDoesNotRunRunner === true,
    evidence: blocked.gatePath
  },
  {
    name: "Approval gate validates reviewed command evidence, teacher confirmation, and rollback marker",
    pass:
      ready.status === "ready_for_teacher_confirmed_voice_execute_runner_request" &&
      readyPacket.readyForExecuteRequest === true &&
      readyPacket.teacherConfirmationMatched === true &&
      readyPacket.rollbackPointCreated === true &&
      readyPacket.rollbackPointPath === resolve(rollbackPointPath) &&
      readyPacket.rollbackPointExists === true &&
      readyPacket.rollbackPointRetained === true &&
      readyPacket.targetConfirmationValidation.valid === true &&
      readyPacket.evidenceChecks[0]?.valid === true &&
      readyPacket.blockers.length === 0,
    evidence: ready.gatePath
  },
  {
    name: "Approval gate produces a runner request but does not execute voice command",
    pass:
      readyPacket.generatedRunnerRequest?.runnerPath === resolve(runner.runnerPath) &&
      readyPacket.generatedRunnerRequest?.args.includes("-TeacherConfirmed") &&
      readyPacket.generatedRunnerRequest?.args.includes("-Execute") &&
      readyPacket.generatedRunnerRequest?.args.includes("-ReviewedCommand") &&
      !existsSync(expectedOutputPath) &&
      readyReceipt.softwareActionsExecuted === false &&
      readyReceipt.targetSoftwareCommandsExecuted === false &&
      readyReceipt.uiEventsSent === false,
    evidence: JSON.stringify(readyPacket.generatedRunnerRequest)
  },
  {
    name: "MCP advanced mode runs voice execution approval gate with a retained rollback path",
    pass:
      mcpReady.list.mode === "advanced" &&
      advancedNames.includes("create_engineering_voice_execution_approval_gate") &&
      mcpReady.result.format === "transparent_ai_engineering_voice_execution_approval_gate_result_v1" &&
      mcpReady.result.status === "ready_for_teacher_confirmed_voice_execute_runner_request" &&
      mcpReady.result.readyForExecuteRequest === true &&
      mcpReady.result.rollbackPointPath === resolve(rollbackPointPath) &&
      mcpReadyPacket.rollbackPointRetained === true &&
      mcpReadyPacket.generatedRunnerRequest?.runnerPath === resolve(runner.runnerPath) &&
      mcpReady.result.softwareActionsExecuted === false &&
      mcpReady.result.targetSoftwareCommandsExecuted === false &&
      mcpReady.result.uiEventsSent === false,
    evidence: mcpReady.result.gatePath
  },
  {
    name: "Voice approval gate keeps recording, screenshots, memory, acceptance, packaging, and native execution locked",
    pass:
      readyPacket.locks.fullContinuousRecording === false &&
      readyPacket.locks.storesAudio === false &&
      readyPacket.locks.screenshotsCaptured === false &&
      readyPacket.locks.memoryWritten === false &&
      readyPacket.locks.accepted === false &&
      readyPacket.locks.ruleEnabled === false &&
      readyPacket.locks.packagingGated === true &&
      readyPacket.locks.nativeUniversalExecution === false,
    evidence: JSON.stringify(readyPacket.locks)
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_engineering_voice_execution_approval_gate_smoke_v1",
  smokeRoot,
  paths: {
    loop: loop.controlLoopPath,
    confirmation: loop.confirmationResult,
    executionPackage: loopPacket.generated.existingExecutionPackage,
    targetConfirmationValidation: targetValidation.validationPath,
    blockedGate: blocked.gatePath,
    readyGate: ready.gatePath,
    reviewedCommand: reviewedCommandPath,
    mcpReadyGate: mcpReady.result.gatePath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
