#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-medium-runtime-approved-gate-runner-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(scriptName, args) {
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

const runnerPath = join(smokeRoot, "teacher-reviewed-tlcl-approved-runner-target.mjs");
writeFileSync(
  runnerPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "writeFileSync(outputPath, JSON.stringify({ ok: true, proof: 'tlcl approved gate controlled route' }, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);
const reviewedCommandPath = join(smokeRoot, "reviewed-command-manifest.json");
writeJson(reviewedCommandPath, {
  format: "transparent_ai_reviewed_cli_command_manifest_v1",
  teacherReviewed: true,
  commandKind: "node-script",
  scriptSourceFile: runnerPath,
  expectedScriptSha256: sha256(runnerPath),
  targetOutputFileName: "tlcl-approved-gate-output.json"
});
const adapterReceiptPath = join(smokeRoot, "existing-cli-or-script-execution-receipt.json");
const adapterRunnerPath = join(smokeRoot, "run-existing-cli-or-script.mjs");
writeFileSync(
  adapterRunnerPath,
  [
    "import { createHash } from 'node:crypto';",
    "import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';",
    "import { dirname, join } from 'node:path';",
    "import { spawnSync } from 'node:child_process';",
    `const receiptPath = ${JSON.stringify(adapterReceiptPath)};`,
    "function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] || '' : ''; }",
    "function hasFlag(name) { return process.argv.includes(name); }",
    "function sha256(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }",
    "const reviewedCommand = argValue('--reviewed-command');",
    "const execute = hasFlag('--execute');",
    "const teacherConfirmed = hasFlag('--teacher-confirmed');",
    "const receipt = { format: 'transparent_ai_existing_software_execution_receipt_v1', adapterId: 'existing-cli-or-script', mode: 'dry_run', teacherConfirmed, execute, commandExecuted: false, reviewedCommandPath: reviewedCommand, cliOutputPath: '', status: 'dry_run_no_command_executed', locks: { accepted: false, ruleEnabled: false, packagingGated: true, nativeUniversalExecution: false } };",
    "if (teacherConfirmed && execute) {",
    "  try {",
    "    const command = JSON.parse(readFileSync(reviewedCommand, 'utf8').replace(/^\\uFEFF/, ''));",
    "    if (command.teacherReviewed !== true) throw new Error('command_teacherReviewed_must_be_true');",
    "    if (command.commandKind !== 'node-script') throw new Error('only_node_script_commandKind_supported');",
    "    if (!command.scriptSourceFile || !existsSync(command.scriptSourceFile)) throw new Error('script_source_missing');",
    "    const scriptHash = sha256(command.scriptSourceFile);",
    "    if (scriptHash !== String(command.expectedScriptSha256).toLowerCase()) throw new Error('expected_script_sha256_mismatch');",
    "    const outputDir = join(dirname(receiptPath), 'cli-output');",
    "    mkdirSync(outputDir, { recursive: true });",
    "    const outputPath = join(outputDir, command.targetOutputFileName);",
    "    const run = spawnSync(process.execPath, [command.scriptSourceFile, outputPath], { encoding: 'utf8', timeout: 60000 });",
    "    if (run.status !== 0) throw new Error(`reviewed_node_script_failed_exit_${run.status}`);",
    "    receipt.commandExecuted = true;",
    "    receipt.cliOutputPath = outputPath;",
    "    receipt.status = 'teacher_confirmed_cli_script_executed';",
    "    receipt.mode = 'teacher_confirmed_execute';",
    "    receipt.outputSha256 = sha256(outputPath);",
    "  } catch (error) {",
    "    receipt.status = `blocked_reviewed_command_invalid:${error.message}`;",
    "  }",
    "}",
    "writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\\n', 'utf8');",
    "console.log(JSON.stringify(receipt, null, 2));"
  ].join("\n"),
  "utf8"
);
const adapterPackagePath = join(smokeRoot, "adapter-package.json");
writeJson(adapterPackagePath, {
  format: "transparent_ai_execution_adapter_package_v1",
  runnerEntries: [{ adapterId: "existing-cli-or-script", runnerPath: adapterRunnerPath, receiptPath: adapterReceiptPath }]
});
const actionPlanPath = join(smokeRoot, "action-plan.json");
writeJson(actionPlanPath, { format: "transparent_ai_execution_action_plan_v1", teacherReviewed: true });
const queuePath = join(smokeRoot, "execution-pilot-queue.json");
writeJson(queuePath, {
  format: "transparent_ai_all_software_execution_pilot_queue_v1",
  pilots: [
    {
      pilotId: "tlcl-approved-runner-pilot-001",
      software: "TLCL approved runner reviewed CLI software",
      routeMode: "existing-cli-or-script",
      primaryAdapterId: "existing-cli-or-script",
      adapterPackagePath,
      actionPlanPath,
      status: "dry_run_runner_ready_for_teacher_review"
    }
  ]
});
const selectorPath = join(smokeRoot, "real-local-execution-pilot-selector.json");
writeJson(selectorPath, {
  ok: true,
  format: "transparent_ai_real_local_execution_pilot_selector_v1",
  selectorId: "tlcl-approved-runner-selector",
  sourceEvidence: { executionPilotQueuePath: queuePath },
  numberedCandidates: [
    {
      number: 1,
      pilotId: "tlcl-approved-runner-pilot-001",
      software: "TLCL approved runner reviewed CLI software",
      routeMode: "existing-cli-or-script",
      primaryAdapterId: "existing-cli-or-script",
      adapterPackagePath,
      actionPlanPath,
      score: 200
    }
  ],
  selectedCandidate: {
    number: 1,
    pilotId: "tlcl-approved-runner-pilot-001",
    software: "TLCL approved runner reviewed CLI software",
    routeMode: "existing-cli-or-script",
    primaryAdapterId: "existing-cli-or-script",
    adapterPackagePath,
    actionPlanPath,
    score: 200
  },
  locks: { reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true }
});
const readyValidationPath = join(smokeRoot, "ready-tlcl-post-run-validation.json");
writeJson(readyValidationPath, {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_validation_v1",
  validationId: "ready-tlcl-approved-runner-validation",
  status: "ready_for_execution_approval_gate_planning",
  decision: "dry_run_matched_expected",
  readyForExecutionApprovalGatePlanning: true,
  forbiddenDecisionUsed: false,
  blockers: [],
  executionApprovalGateCreated: false,
  targetSoftwareCommandsExecuted: false,
  executionApprovalGatePlanningHandoff: {
    kind: "execution_approval_gate_planning_handoff",
    executesNow: false,
    sourceRunId: "tlcl-approved-runner-run",
    routeIndex: 1,
    handoffItemId: "tlcl-approved-runner-handoff",
    reviewedCommandTemplate: "node teacher-reviewed-tlcl-approved-runner-target.mjs <output>",
    requiredBeforeGate: ["teacher provides explicit execute approval text", "retained rollback point is confirmed again"],
    blockedUntil: "separate execution approval gate is created and reviewed"
  },
  locks: { reviewOnly: true, validationOnly: true, accepted: false, ruleEnabled: false, packagingGated: true }
});

const readyPrep = runNode("run-tlcl-medium-runtime-execution-approval-gate-prep-runner.mjs", [
  "--validation",
  readyValidationPath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-pilot-id",
  "tlcl-approved-runner-pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-confirmation",
  "teacher confirmed all-software execution pilot",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready-prep")
]);
const commandBuilder = runNode("create-tlcl-medium-runtime-approved-gate-command-builder.mjs", [
  "--goal",
  "Build TLCL command builder for approved runner smoke.",
  "--prep",
  readyPrep.packetPath,
  "--output-dir",
  join(smokeRoot, "command-builder")
]);

const noFlag = runNode("run-tlcl-medium-runtime-approved-gate-runner.mjs", [
  "--goal",
  "Block TLCL approved gate runner without execute flag.",
  "--builder",
  commandBuilder.wrapperPath,
  "--teacher-confirmation",
  "teacher confirmed approved execution gate runner",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "no-flag")
]);
const noFlagPacket = readJson(noFlag.packetPath);

const readyRun = runNode("run-tlcl-medium-runtime-approved-gate-runner.mjs", [
  "--goal",
  "Run one TLCL approved controlled route.",
  "--builder",
  commandBuilder.wrapperPath,
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
    name: "TLCL approved gate runner blocks without final execute flag",
    pass:
      noFlag.status === "blocked_before_tlcl_approved_gate_runner" &&
      noFlag.runnerInvoked === false &&
      noFlagPacket.blockers.includes("missing_execute_approved_gate_flag"),
    evidence: noFlagPacket.blockers.join(",")
  },
  {
    name: "Ready TLCL approved gate runner invokes exactly one existing approved-gate runner",
    pass:
      readyRun.status === "tlcl_approved_gate_controlled_route_completed_waiting_for_teacher_review" &&
      readyRun.runnerInvoked === true &&
      readyRun.controlledRouteActionExecuted === true &&
      readyRun.targetSoftwareCommandsExecuted === true &&
      readyPacket.generatedEvidence.existingRunnerResult?.format ===
        "transparent_ai_all_software_execution_approved_gate_runner_result_v1",
    evidence: readyRun.existingRunnerPacketPath
  },
  {
    name: "TLCL approved gate runner produces adapter receipt outcome verification and checkpoint",
    pass:
      adapterReceipt.status === "teacher_confirmed_cli_script_executed" &&
      adapterReceipt.commandExecuted === true &&
      controlledOutput?.proof === "tlcl approved gate controlled route" &&
      existsSync(readyRun.outcomeVerificationPath) &&
      existsSync(readyRun.postActionCheckpointPath),
    evidence: `${readyRun.adapterReceiptPath}; ${readyRun.outcomeVerificationPath}; ${readyRun.postActionCheckpointPath}`
  },
  {
    name: "TLCL approved gate runner keeps memory rules packaging and universal completion locked",
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
  smoke: "transparent_ai_tlcl_medium_runtime_approved_gate_runner_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  commandBuilderPath: commandBuilder.wrapperPath,
  noFlagPacketPath: noFlag.packetPath,
  readyPacketPath: readyRun.packetPath,
  controlledOutputPath: adapterReceipt.cliOutputPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
