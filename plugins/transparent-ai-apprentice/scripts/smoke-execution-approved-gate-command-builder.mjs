#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "execution-approved-gate-command-builder-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
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

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const readyGatePath = join(smokeRoot, "ready-real-local-execution-approval-gate.json");
writeJson(readyGatePath, {
  format: "transparent_ai_real_local_execution_approval_gate_v1",
  status: "ready_for_teacher_confirmed_execute_runner_request",
  readyForExecuteRequest: true,
  selectedPilotId: "pilot-001",
  selectedAdapterId: "existing-cli-or-script",
  software: "SmokeCAD",
  generatedRunnerRequest: {
    tool: "run_all_software_execution_pilot_runner",
    script: "run-all-software-execution-pilot-runner.mjs",
    args: [
      "--queue",
      join(smokeRoot, "all-software-execution-pilot-queue.json"),
      "--pilot-id",
      "pilot-001",
      "--adapter-id",
      "existing-cli-or-script",
      "--execute",
      "--teacher-confirmed",
      "--reviewed-command",
      join(smokeRoot, "reviewed-command-manifest.json")
    ]
  },
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const builderResult = runNode("create-all-software-execution-approved-gate-command-builder.mjs", [
  "--goal",
  "Build a teacher-facing approved execution gate command.",
  "--gate",
  readyGatePath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.paths.builder);
const html = readFileSync(builderResult.paths.html, "utf8");
const readme = readFileSync(builderResult.paths.readme, "utf8");

const placeholderResult = runNode("create-all-software-execution-approved-gate-command-builder.mjs", [
  "--goal",
  "Render placeholder approved gate builder.",
  "--output-dir",
  join(smokeRoot, "placeholder-builder")
]);
const placeholder = readJson(placeholderResult.paths.builder);

const checks = [
  {
    name: "Execution approved gate command builder loads a ready gate",
    pass:
      builder.format === "transparent_ai_execution_approved_gate_command_builder_v1" &&
      builder.status === "approval_gate_command_builder_ready_for_teacher_final_confirmation" &&
      builder.gate.readyForExecuteRequest === true &&
      builder.gate.generatedArgsIncludeExecute === true &&
      builder.gate.generatedArgsUsable === true &&
      builder.gate.blockers.length === 0,
    evidence: builderResult.paths.builder
  },
  {
    name: "Execution approved gate command builder generates the final teacher-confirmed command",
    pass:
      builder.commandTemplate.includes("run-all-software-execution-approved-gate-runner.mjs") &&
      builder.commandTemplate.includes("--execute-approved-gate") &&
      builder.commandTemplate.includes("--teacher-confirmation") &&
      builder.commandTemplate.includes("<teacher-confirmed-approved-gate-runner-text>") &&
      builder.commandTemplate.includes("--rollback-point-created") &&
      builder.commandTemplate.includes("<retained-rollback-point-path-or-label>") &&
      html.includes("transparent_ai_execution_approved_gate_run_request_v1") &&
      html.includes("teacher confirmed approved execution gate runner"),
    evidence: builder.commandTemplate
  },
  {
    name: "Execution approved gate command builder writes a browser page and README",
    pass:
      existsSync(builderResult.paths.html) &&
      existsSync(builderResult.paths.readme) &&
      html.includes("Download run request JSON") &&
      readme.includes("It does not run the approved gate runner"),
    evidence: builderResult.paths.html
  },
  {
    name: "Execution approved gate command builder keeps execution locks closed",
    pass:
      builder.locks.reviewOnly === true &&
      builder.locks.accepted === false &&
      builder.locks.ruleEnabled === false &&
      builder.locks.packagingGated === true &&
      builder.locks.builderDoesNotRunApprovedGate === true &&
      builder.locks.builderDoesNotInvokeRunner === true &&
      builder.locks.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks.builderDoesNotSendUiEvents === true &&
      builder.locks.builderDoesNotCaptureScreenshots === true &&
      builder.locks.builderDoesNotWriteMemory === true &&
      builder.locks.generatedCommandRequiresTeacherConfirmation === true &&
      builder.locks.generatedCommandRequiresRollback === true &&
      builder.locks.goalComplete === false,
    evidence: JSON.stringify(builder.locks)
  },
  {
    name: "Execution approved gate command builder can render before a gate path is available",
    pass:
      placeholder.status === "waiting_for_ready_gate_path" &&
      placeholder.commandTemplate.includes("<ready-real-local-execution-approval-gate.json>") &&
      existsSync(placeholder.paths.html),
    evidence: placeholder.paths.html
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(JSON.stringify({ status: "failed", smoke: "transparent_ai_execution_approved_gate_command_builder_smoke_v1", smokeRoot, checks }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: "passed", smoke: "transparent_ai_execution_approved_gate_command_builder_smoke_v1", smokeRoot, checks }, null, 2));
