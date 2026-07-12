#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-execution-approved-gate-runner-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const goal = "Execute one ready approval gate through the existing all-software pilot runner.";
const executionPackageDir = join(smokeRoot, "existing-execution-package");
mkdirSync(executionPackageDir, { recursive: true });
const adapterReceiptPath = join(executionPackageDir, "existing-cli-or-script-execution-receipt.json");
const adapterRunnerPath = join(executionPackageDir, "run-existing-cli-or-script.mjs");
writeFileSync(
  adapterRunnerPath,
  [
    "import { createHash } from 'node:crypto';",
    "import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';",
    "import { dirname, join } from 'node:path';",
    "import { spawnSync } from 'node:child_process';",
    `const receiptPath = ${JSON.stringify(adapterReceiptPath)};`,
    `const executionPackagePath = ${JSON.stringify(join(executionPackageDir, "execution-package.json"))};`,
    "function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] || '' : ''; }",
    "function hasFlag(name) { return process.argv.includes(name); }",
    "function sha256(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }",
    "const reviewedCommand = argValue('--reviewed-command');",
    "const execute = hasFlag('--execute');",
    "const teacherConfirmed = hasFlag('--teacher-confirmed');",
    "const receipt = {",
    "  format: 'transparent_ai_existing_software_execution_receipt_v1',",
    "  adapterId: 'existing-cli-or-script',",
    "  executionPackagePath,",
    "  mode: teacherConfirmed && execute ? 'execute_requested' : 'dry_run',",
    "  teacherConfirmed,",
    "  execute,",
    "  commandExecuted: false,",
    "  reviewedCommandPath: reviewedCommand,",
    "  cliOutputPath: '',",
    "  scriptSha256: '',",
    "  outputSha256: '',",
    "  exitCode: null,",
    "  status: 'dry_run_no_command_executed',",
    "  locks: { accepted: false, ruleEnabled: false, technologyAccepted: false, packagingGated: true, nativeUniversalExecution: false }",
    "};",
    "if (teacherConfirmed && execute) {",
    "  try {",
    "    if (!reviewedCommand || !existsSync(reviewedCommand)) throw new Error('reviewed_command_manifest_missing');",
    "    const command = JSON.parse(readFileSync(reviewedCommand, 'utf8').replace(/^\\uFEFF/, ''));",
    "    if (command.teacherReviewed !== true) throw new Error('command_teacherReviewed_must_be_true');",
    "    if (command.commandKind !== 'node-script') throw new Error('only_node_script_commandKind_supported');",
    "    if (!command.scriptSourceFile || !existsSync(command.scriptSourceFile)) throw new Error('script_source_missing');",
    "    if (!command.expectedScriptSha256) throw new Error('expectedScriptSha256_required');",
    "    const scriptHash = sha256(command.scriptSourceFile);",
    "    if (scriptHash !== String(command.expectedScriptSha256).toLowerCase()) throw new Error('expected_script_sha256_mismatch');",
    "    const targetName = String(command.targetOutputFileName || '');",
    "    if (!targetName || targetName.includes('/') || targetName.includes('\\\\')) throw new Error('targetOutputFileName_must_be_plain_file_name');",
    "    const outputDir = join(dirname(receiptPath), 'cli-output');",
    "    mkdirSync(outputDir, { recursive: true });",
    "    const outputPath = join(outputDir, targetName);",
    "    const run = spawnSync(process.execPath, [command.scriptSourceFile, outputPath], { encoding: 'utf8', timeout: 60000 });",
    "    receipt.exitCode = run.status;",
    "    if (run.status !== 0) throw new Error(`reviewed_node_script_failed_exit_${run.status}`);",
    "    if (!existsSync(outputPath)) throw new Error('expected_cli_output_missing');",
    "    receipt.commandExecuted = true;",
    "    receipt.cliOutputPath = outputPath;",
    "    receipt.scriptSha256 = scriptHash;",
    "    receipt.outputSha256 = sha256(outputPath);",
    "    receipt.status = 'teacher_confirmed_cli_script_executed';",
    "    receipt.mode = 'teacher_confirmed_execute';",
    "  } catch (error) {",
    "    receipt.status = `blocked_reviewed_command_invalid:${error.message}`;",
    "    receipt.commandExecuted = false;",
    "  }",
    "}",
    "writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\\n', 'utf8');",
    "console.log(JSON.stringify(receipt, null, 2));"
  ].join("\n"),
  "utf8"
);

const adapterPackagePath = join(executionPackageDir, "execution-package.json");
writeJson(adapterPackagePath, {
  format: "transparent_ai_execution_adapter_package_v1",
  runnerEntries: [
    {
      adapterId: "existing-cli-or-script",
      runnerPath: adapterRunnerPath,
      receiptPath: adapterReceiptPath
    }
  ]
});

const actionPlanPath = join(smokeRoot, "pilot-action-plan.json");
writeJson(actionPlanPath, {
  format: "transparent_ai_execution_action_plan_v1",
  software: "Node.js approved gate controlled route proof",
  routeMode: "structured_route_dry_run_pilot",
  actions: []
});

const queuePath = join(smokeRoot, "all-software-execution-pilot-queue.json");
writeJson(queuePath, {
  format: "transparent_ai_all_software_execution_pilot_queue_v1",
  goal,
  pilots: [
    {
      pilotId: "pilot-001",
      software: "Node.js approved gate controlled route proof",
      routeMode: "structured_route_dry_run_pilot",
      primaryAdapterId: "existing-cli-or-script",
      adapterPackagePath,
      actionPlanPath,
      status: "dry_run_runner_ready_for_teacher_review"
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false
  }
});

const selector = runNode("create-real-local-execution-pilot-selector.mjs", [
  "--goal",
  goal,
  "--queue",
  queuePath,
  "--selected-number",
  "1",
  "--output-dir",
  join(smokeRoot, "selector")
]);

const reviewedScriptPath = join(smokeRoot, "reviewed-approved-gate-cli-route.mjs");
writeFileSync(
  reviewedScriptPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "writeFileSync(outputPath, JSON.stringify({ ok: true, proof: 'approved gate controlled route', createdAt: new Date().toISOString() }, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);

const reviewedCommandPath = join(smokeRoot, "reviewed-command-manifest.json");
writeJson(reviewedCommandPath, {
  format: "transparent_ai_reviewed_cli_command_manifest_v1",
  teacherReviewed: true,
  commandKind: "node-script",
  scriptSourceFile: reviewedScriptPath,
  expectedScriptSha256: sha256(reviewedScriptPath),
  targetOutputFileName: "approved-gate-controlled-output.json"
});

const readyGate = runNode("create-real-local-execution-approval-gate.mjs", [
  "--goal",
  goal,
  "--selector",
  selector.selectorPath,
  "--queue",
  queuePath,
  "--selected-number",
  "1",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-confirmation",
  "teacher confirmed all-software execution pilot",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready-gate")
]);

const blockedGate = runNode("create-real-local-execution-approval-gate.mjs", [
  "--goal",
  "Blocked gate for approved runner smoke.",
  "--selector",
  selector.selectorPath,
  "--queue",
  queuePath,
  "--selected-number",
  "1",
  "--output-dir",
  join(smokeRoot, "blocked-gate")
]);

const noFlag = runNode("run-all-software-execution-approved-gate-runner.mjs", [
  "--goal",
  goal,
  "--gate",
  readyGate.gatePath,
  "--teacher-confirmation",
  "teacher confirmed approved execution gate runner",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "no-flag")
]);
const noFlagPacket = readJson(noFlag.packetPath);

const nonReady = runNode("run-all-software-execution-approved-gate-runner.mjs", [
  "--goal",
  goal,
  "--gate",
  blockedGate.gatePath,
  "--execute-approved-gate",
  "--teacher-confirmation",
  "teacher confirmed approved execution gate runner",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "non-ready")
]);
const nonReadyPacket = readJson(nonReady.packetPath);

const readyRun = runNode("run-all-software-execution-approved-gate-runner.mjs", [
  "--goal",
  goal,
  "--gate",
  readyGate.gatePath,
  "--execute-approved-gate",
  "--teacher-confirmation",
  "teacher confirmed approved execution gate runner",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready-run")
]);
const readyPacket = readJson(readyRun.packetPath);
const readyReceipt = readJson(readyRun.receiptPath);
const adapterReceipt = readJson(readyRun.adapterReceiptPath);
const controlledOutput = adapterReceipt.cliOutputPath && existsSync(adapterReceipt.cliOutputPath) ? readJson(adapterReceipt.cliOutputPath) : null;

const checks = [
  {
    name: "Approved gate runner blocks without final execute flag",
    pass:
      noFlag.status === "blocked_before_approved_gate_runner" &&
      noFlag.runnerInvoked === false &&
      noFlagPacket.blockers.includes("missing_execute_approved_gate_flag"),
    evidence: noFlagPacket.blockers.join(",")
  },
  {
    name: "Approved gate runner blocks non-ready approval gates before runner invocation",
    pass:
      nonReady.status === "blocked_before_approved_gate_runner" &&
      nonReady.runnerInvoked === false &&
      nonReadyPacket.blockers.includes("approval_gate_not_ready_for_execute_runner_request"),
    evidence: nonReadyPacket.blockers.join(",")
  },
  {
    name: "Ready approval gate invokes exactly one existing pilot runner execute request",
    pass:
      readyRun.status === "approved_gate_controlled_route_completed_waiting_for_teacher_review" &&
      readyRun.runnerInvoked === true &&
      readyRun.controlledRouteActionExecuted === true &&
      readyRun.targetSoftwareCommandsExecuted === true &&
      readyPacket.sourceEvidence.generatedRunnerRequest?.args?.includes("--execute"),
    evidence: readyRun.pilotRunnerPath
  },
  {
    name: "Approved gate runner produces adapter receipt, outcome verification, and post-action checkpoint",
    pass:
      adapterReceipt.status === "teacher_confirmed_cli_script_executed" &&
      adapterReceipt.commandExecuted === true &&
      controlledOutput?.proof === "approved gate controlled route" &&
      existsSync(readyRun.outcomeVerificationPath) &&
      existsSync(readyRun.postActionCheckpointPath),
    evidence: `${readyRun.adapterReceiptPath}; ${readyRun.outcomeVerificationPath}; ${readyRun.postActionCheckpointPath}`
  },
  {
    name: "Approved gate runner keeps screenshots memory rules packaging and universal completion locked",
    pass:
      readyReceipt.screenshotsCaptured === false &&
      readyReceipt.memoryWritten === false &&
      readyReceipt.accepted === false &&
      readyReceipt.ruleEnabled === false &&
      readyReceipt.packagingGated === true &&
      readyReceipt.nativeUniversalExecution === false &&
      readyReceipt.allSoftwareExecutionComplete === false &&
      readyReceipt.goalComplete === false,
    evidence: JSON.stringify(readyReceipt.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_all_software_execution_approved_gate_runner_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  readyGatePath: readyGate.gatePath,
  noFlagPacketPath: noFlag.packetPath,
  nonReadyPacketPath: nonReady.packetPath,
  readyPacketPath: readyRun.packetPath,
  controlledOutputPath: adapterReceipt.cliOutputPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
