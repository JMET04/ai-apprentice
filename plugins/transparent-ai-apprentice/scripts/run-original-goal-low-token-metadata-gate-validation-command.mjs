#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPECTED_SCRIPT = "run-all-software-coverage-enrollment-follow-up-batch.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-metadata-gate-validation-command-run")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-metadata-gate-validation-command-run"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJsonFile(path, value) {
  writeFileSync(path, `\uFEFF${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function tokenizeCommandLine(value) {
  const text = String(value || "");
  const tokens = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && /\s/.test(char)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function locks({ runnerInvoked = false, batchRunnerInvoked = false } = {}) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationCommandRunnerInvoked: runnerInvoked,
    metadataGateBatchRunnerInvoked: batchRunnerInvoked,
    runsOnlyPreparedValidationCommand: true,
    shellCommandExecution: false,
    allSoftwareCoverageComplete: false,
    teacherAcceptanceRequired: true,
    rollbackPointRequiredBeforeRun: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    fullLogsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function hasTeacherConfirmation(value) {
  const text = String(value || "").trim();
  return text.length >= 8 && /confirm|confirmed|teacher|review|approve|ok|yes|确认|同意|老师|审核|已看/i.test(text);
}

function failClosed(message, details = {}) {
  const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-metadata-gate-validation-command-runs")));
  mkdirSync(outputRoot, { recursive: true });
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-blocked-${slugify(message)}`;
  const runDir = join(outputRoot, runId);
  mkdirSync(runDir, { recursive: true });
  const runPath = join(runDir, "original-goal-low-token-metadata-gate-validation-command-run.json");
  const packet = {
    ok: false,
    format: "transparent_ai_original_goal_low_token_metadata_gate_validation_command_run_v1",
    runId,
    status: "blocked",
    blockedReason: message,
    details,
    locks: locks()
  };
  writeJsonFile(runPath, packet);
  console.log(JSON.stringify({ ok: false, runPath, status: "blocked", blockedReason: message, locks: packet.locks }, null, 2));
  process.exit(1);
}

function preparedCommandFromValidation(validation) {
  const commands = Array.isArray(validation.nextPreparedCommands) ? validation.nextPreparedCommands : [];
  if (commands.length !== 1) failClosed("expected_exactly_one_prepared_command", { count: commands.length });
  const command = commands[0];
  if (command.tool !== "run_all_software_coverage_enrollment_follow_up_batch") {
    failClosed("prepared_command_tool_not_allowlisted", { tool: command.tool || "" });
  }
  return command;
}

function safeArgsFromCommand(command) {
  const tokens = tokenizeCommandLine(command.commandLine);
  if (tokens.length < 2) failClosed("prepared_command_is_empty", { commandLine: command.commandLine || "" });
  const forbiddenTokens = ["&&", "||", "|", ">", "<", "&", ";"];
  if (tokens.some((token) => forbiddenTokens.includes(token))) {
    failClosed("prepared_command_contains_shell_control_token", { tokens });
  }
  const scriptToken = tokens[1] || "";
  if (!scriptToken.endsWith(EXPECTED_SCRIPT)) {
    failClosed("prepared_command_script_not_allowlisted", { scriptToken });
  }
  const args = tokens.slice(2);
  if (!args.includes("--teacher-reviewed")) {
    failClosed("prepared_command_missing_teacher_reviewed_flag", { args });
  }
  if (args.includes("--allow-bounded-tail")) {
    failClosed("prepared_command_must_not_enable_bounded_tail_from_validation_runner", { args });
  }
  return { scriptPath: join(__dirname, EXPECTED_SCRIPT), args };
}

function quoteArg(value) {
  return `"${String(value || "").replace(/"/g, '\\"')}"`;
}

function nodeCommandLine(scriptName, args) {
  return ["node", `plugins\\transparent-ai-apprentice\\scripts\\${scriptName}`, ...args.map(quoteArg)].join(" ");
}

const validationArg = argValue("--validation", argValue("--receipt-validation", ""));
const validationPath = validationArg ? resolve(validationArg) : "";
if (!validationPath || !existsSync(validationPath)) {
  failClosed("validation_json_is_required", { validationPath });
}
const validation = readJson(validationPath);
if (validation.format !== "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_validation_v1") {
  failClosed("validation_format_not_supported", { format: validation.format || "" });
}
if (validation.status !== "validated_with_prepared_metadata_gate_command") {
  failClosed("validation_status_not_ready", { status: validation.status || "" });
}
if (validation.ok !== true) {
  failClosed("validation_not_ok", { ok: validation.ok });
}

const command = preparedCommandFromValidation(validation);
const teacherConfirmation = argValue("--teacher-confirmation", "");
const rollbackPoint = resolve(argValue("--rollback-point", command.rollbackPoint || validation.rollbackPoint || ""));
const allowRunner = hasFlag("--run-reviewed-command") && hasFlag("--allow-validation-command-runner");
if (!allowRunner) {
  failClosed("runner_requires_explicit_run_flags", {
    requiredFlags: ["--run-reviewed-command", "--allow-validation-command-runner"]
  });
}
if (!hasTeacherConfirmation(teacherConfirmation)) {
  failClosed("runner_requires_teacher_confirmation_text", { teacherConfirmation });
}
if (!rollbackPoint || !existsSync(rollbackPoint)) {
  failClosed("runner_requires_existing_retained_rollback_point", { rollbackPoint });
}
if (command.rollbackPoint && resolve(command.rollbackPoint) !== rollbackPoint) {
  failClosed("rollback_point_mismatch_with_validation", { expected: command.rollbackPoint, actual: rollbackPoint });
}

const { scriptPath, args } = safeArgsFromCommand(command);
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-metadata-gate-validation-command-runs")));
mkdirSync(outputRoot, { recursive: true });
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(validation.goal || "metadata-gate-validation-command-run")}`;
const runDir = join(outputRoot, runId);
mkdirSync(runDir, { recursive: true });

const result = spawnSync(process.execPath, [scriptPath, ...args], {
  cwd: process.cwd(),
  encoding: "utf8",
  timeout: 180000
});
const parsedStdout = result.stdout ? JSON.parse(result.stdout) : null;
if (result.status !== 0) {
  failClosed("prepared_batch_runner_failed", { status: result.status, stderr: result.stderr, stdout: result.stdout });
}
const nextReconciliationOutputDir = join(runDir, "next-coverage-enrollment-reconciliation");
const nextReconciliationCommand = parsedStdout?.batchPath
  ? nodeCommandLine("reconcile-all-software-coverage-enrollment-follow-up-batch.mjs", [
      "--batch",
      parsedStdout.batchPath,
      "--output-dir",
      nextReconciliationOutputDir
    ])
  : "";

const runPath = join(runDir, "original-goal-low-token-metadata-gate-validation-command-run.json");
const receiptPath = join(runDir, "original-goal-low-token-metadata-gate-validation-command-run-receipt.json");
const readmePath = join(runDir, "ORIGINAL_GOAL_LOW_TOKEN_METADATA_GATE_VALIDATION_COMMAND_RUN_START_HERE.md");
const lockState = locks({ runnerInvoked: true, batchRunnerInvoked: true });
const packet = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_metadata_gate_validation_command_run_v1",
  runId,
  createdAt: new Date().toISOString(),
  status: "prepared_validation_command_runner_completed",
  sourceValidation: validationPath,
  preparedCommand: {
    tool: command.tool,
    readyFollowUpIds: command.readyFollowUpIds || [],
    commandLine: command.commandLine,
    executedViaShell: false,
    executedScript: basename(scriptPath),
    executedArgs: args
  },
  teacherConfirmation,
  rollbackPoint,
  batchResult: parsedStdout,
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    goalComplete: false,
    reason:
      "This runner only executes one teacher-confirmed prepared metadata-gate batch command from validation. Reconciliation, coverage audit refresh, teacher review, and native execution proof remain required."
  },
  paths: {
    run: runPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceValidation: validationPath,
    batchRun: parsedStdout?.batchPath || "",
    batchReceipt: parsedStdout?.receiptPath || "",
    nextReconciliationOutputDir
  },
  nextPreparedCommands: nextReconciliationCommand
    ? [
        {
          tool: "reconcile_all_software_coverage_enrollment_follow_up_batch",
          commandLine: nextReconciliationCommand,
          executesNow: false,
          requiresTeacherReviewOfBatchReceipt: true,
          purpose:
            "Loop the reviewed metadata-gate batch evidence back into the next coverage audit and enrollment ledger review package without running target software."
        }
      ]
    : [],
  locks: lockState
};
const receipt = {
  format: "transparent_ai_original_goal_low_token_metadata_gate_validation_command_run_receipt_v1",
  runId,
  sourceValidation: validationPath,
  batchRun: parsedStdout?.batchPath || "",
  batchReceipt: parsedStdout?.receiptPath || "",
  nextReconciliationCommand,
  nextReconciliationExecutesNow: false,
  nextReconciliationRequiresTeacherReviewOfBatchReceipt: true,
  teacherConfirmation,
  rollbackPoint,
  allSoftwareCoverageComplete: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  goalComplete: false,
  locks: lockState
};
writeJsonFile(runPath, packet);
writeJsonFile(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Metadata Gate Validation Command Run",
    "",
    `Status: ${packet.status}`,
    `Validation: ${validationPath}`,
    `Batch run: ${packet.paths.batchRun}`,
    `Batch receipt: ${packet.paths.batchReceipt}`,
    `Next reconciliation command: ${nextReconciliationCommand || "(not prepared)"}`,
    "",
    "This runner consumes one validated teacher receipt and runs only the allowlisted metadata-gate batch runner.",
    "The next reconciliation command is a review-only handoff. It is not executed by this runner.",
    "",
    "It does not use shell command execution, capture screenshots, execute target software, write memory, register schedules, enable rules, unlock packaging, or claim completion.",
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_metadata_gate_validation_command_run_result_v1",
      runPath,
      receiptPath,
      readmePath,
      status: packet.status,
      batchRun: packet.paths.batchRun,
      batchReceipt: packet.paths.batchReceipt,
      nextReconciliationCommand,
      nextReconciliationExecutesNow: false,
      locks: lockState
    },
    null,
    2
  )
);
