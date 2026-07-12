#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
  return String(value || "engineering-voice-command-control-loop")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "engineering-voice-command-control-loop";
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const goal = argValue("--goal", argValue("--task", "Let a non-expert control engineering software by voice or typed command."));
const software = argValue("--software", argValue("--app", "target engineering software"));
const command = argValue("--command", argValue("--text-command", ""));
const voiceTranscript = argValue("--voice-transcript", "");
const processName = argValue("--process-name", "");
const windowTitle = argValue("--window-title", "");
const installPath = argValue("--install-path", "");
const executable = argValue("--executable", "");
const locale = argValue("--locale", "zh-CN");
const selectedNumberRaw = argValue("--selected-number", argValue("--number", argValue("--candidate-number", "")));
const selectedNumber = selectedNumberRaw ? Number(selectedNumberRaw) : 0;
const teacherConfirmedNumber = hasFlag("--teacher-confirmed-number") || hasFlag("--teacher-reviewed-number");
const runReadOnlyProbe = hasFlag("--run-read-only-probe");
const noPortScan = hasFlag("--no-port-scan");
const createActionKit = !hasFlag("--no-action-kit");
const createExecutionAdapter = !hasFlag("--no-execution-adapter");
const createAdapterSelection = hasFlag("--create-adapter-selection") || createExecutionAdapter;
const maxFiles = argValue("--max-files", "80");
const maxDepth = argValue("--max-depth", "2");
const maxRegistryItems = argValue("--max-registry-items", "0");
const typeText = argValue("--type-text", "");
const hotkey = argValue("--hotkey", "");
const preferredAdapters = argValues("--preferred-adapter");
const candidates = argValues("--candidate");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "engineering-voice-command-control-loops")));

mkdirSync(outputRoot, { recursive: true });
const loopId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const loopDir = join(outputRoot, loopId);
mkdirSync(loopDir, { recursive: true });

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  storesAudio: false,
  screenshotsCaptured: false,
  screenshotsOnlyAfterTriggerAndReview: true,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  teacherNumberConfirmationRequired: true,
  teacherExecutionConfirmationRequired: true,
  targetWindowPreflightRequired: true,
  dryRunFirst: true
};

const workbenchArgs = [
  "--goal",
  goal,
  "--software",
  software,
  "--locale",
  locale,
  "--output-dir",
  join(loopDir, "workbench"),
  "--max-files",
  maxFiles,
  "--max-depth",
  maxDepth,
  "--max-registry-items",
  maxRegistryItems
];
if (command) workbenchArgs.push("--command", command);
if (voiceTranscript) workbenchArgs.push("--voice-transcript", voiceTranscript);
if (processName) workbenchArgs.push("--process-name", processName);
if (windowTitle) workbenchArgs.push("--window-title", windowTitle);
if (installPath) workbenchArgs.push("--install-path", installPath);
if (executable) workbenchArgs.push("--executable", executable);
if (runReadOnlyProbe) workbenchArgs.push("--run-read-only-probe");
if (noPortScan) workbenchArgs.push("--no-port-scan");
if (createAdapterSelection) workbenchArgs.push("--create-adapter-selection");
if (createExecutionAdapter) workbenchArgs.push("--create-execution-adapter");
for (const candidate of candidates) workbenchArgs.push("--candidate", candidate);

const workbenchResult = runNodeScript("create-engineering-voice-control-workbench.mjs", workbenchArgs);
const workbench = readJson(workbenchResult.workbenchPath);
const targetConfirmation = readJson(workbenchResult.targetConfirmation);

let status = "waiting_for_numbered_target_confirmation";
let confirmationResult = null;
let blockedReason = "";
if (selectedNumberRaw && (!Number.isInteger(selectedNumber) || selectedNumber < 1)) {
  status = "blocked_invalid_selected_number";
  blockedReason = "--selected-number must be a positive integer.";
} else if (selectedNumberRaw && !teacherConfirmedNumber) {
  status = "blocked_selected_number_without_teacher_confirmation";
  blockedReason = "A number was supplied, but --teacher-confirmed-number was not present.";
} else if (teacherConfirmedNumber && selectedNumber > 0) {
  const confirmArgs = [
    "--confirmation",
    workbenchResult.targetConfirmation,
    "--selected-number",
    String(selectedNumber),
    "--goal",
    goal,
    "--software",
    software,
    "--output-dir",
    join(loopDir, "confirmed-target"),
    "--action-output-dir",
    join(loopDir, "confirmed-target", "supervised-action-kits"),
    "--execution-adapter-output-dir",
    join(loopDir, "confirmed-target", "execution-adapter-selections")
  ];
  if (processName) confirmArgs.push("--process-name", processName);
  if (windowTitle) confirmArgs.push("--window-title", windowTitle);
  if (typeText) confirmArgs.push("--type-text", typeText);
  if (hotkey) confirmArgs.push("--hotkey", hotkey);
  if (createActionKit) confirmArgs.push("--create-action-kit");
  if (createExecutionAdapter) confirmArgs.push("--create-execution-adapter");
  for (const adapter of preferredAdapters) confirmArgs.push("--preferred-adapter", adapter);
  if (workbenchResult.softwareControlChannelProfile && existsSync(workbenchResult.softwareControlChannelProfile)) {
    confirmArgs.push("--capability-profile", workbenchResult.softwareControlChannelProfile);
  }
  confirmationResult = runNodeScript("confirm-engineering-command-target.mjs", confirmArgs);
  status = "number_confirmed_dry_run_execution_package_ready";
}

const optimizedPrompt =
  "Speak or type one engineering command. I will restate what I understood, mark possible target positions with numbers, wait for you to confirm exactly one number or correct me, then prepare only a dry-run-first supervised execution package.";

const controlLoop = {
  ok: true,
  format: "transparent_ai_engineering_voice_command_control_loop_v1",
  loopId,
  createdAt: new Date().toISOString(),
  status,
  blockedReason,
  goal,
  software,
  command,
  voiceTranscriptProvided: Boolean(voiceTranscript),
  optimizedPrompt,
  purpose:
    "A one-command wrapper for non-experts: voice/text in, numbered target confirmation, then dry-run-first supervised engineering software control.",
  existingAbilitiesReused: [
    "create_engineering_voice_control_workbench",
    "create_engineering_voice_control_session",
    "create_voice_teaching_kit",
    "create_engineering_command_confirmation_kit",
    "confirm_engineering_command_target",
    "create_software_control_channel_probe",
    "create_software_control_channel_profile",
    "create_supervised_software_action_kit",
    "create_existing_software_execution_adapter",
    "create_engineering_voice_execution_approval_gate",
    "verify_supervised_action_outcome",
    "create_post_action_evidence_checkpoint"
  ],
  userFlow: [
    "speak_or_type_command",
    "review_public_understanding_trace",
    "inspect_numbered_target_candidates",
    "confirm_exactly_one_number_or_correct_candidates",
    "generate_confirmed_single_target_overlay",
    "prepare_dry_run_first_execution_package",
    "create_voice_execution_approval_gate_with_route_evidence_teacher_confirmation_and_rollback",
    "execute_only_after_target_window_preflight_teacher_confirmation_and_outcome_verification"
  ],
  generated: {
    loopDir,
    workbenchPath: workbenchResult.workbenchPath,
    workbenchHtml: workbenchResult.html,
    workbenchReadme: workbenchResult.teacherReadme,
    sessionPath: workbenchResult.sessionPath,
    targetConfirmation: workbenchResult.targetConfirmation,
    softwareControlChannelProbe: workbenchResult.softwareControlChannelProbe,
    softwareControlChannelProfile: workbenchResult.softwareControlChannelProfile,
    confirmationResult: confirmationResult?.receipt ?? "",
    confirmedSingleTargetOverlay: confirmationResult?.overlayPacket ?? confirmationResult?.narrowedOverlayPacket ?? "",
    supervisedActionKit: confirmationResult?.supervisedActionKit ?? null,
    existingExecutionPackage: confirmationResult?.existingExecutionPackage ?? ""
  },
  targetCandidates: Array.isArray(targetConfirmation.candidates) ? targetConfirmation.candidates : [],
  selectedCandidateNumber: status === "number_confirmed_dry_run_execution_package_ready" ? selectedNumber : null,
  nextTeacherAction:
    status === "waiting_for_numbered_target_confirmation"
        ? "Open the workbench HTML, review the understood command, and confirm exactly one numbered target or correct the candidates."
        : status === "number_confirmed_dry_run_execution_package_ready"
        ? "Review the confirmed single-target overlay and dry-run package, then create an engineering voice execution approval gate before any supervised execute attempt."
        : "Fix the blocked reason and rerun without executing software.",
  nextMcpCalls:
    status === "waiting_for_numbered_target_confirmation"
      ? [
          {
            tool: "run_engineering_voice_command_control_loop",
            arguments: {
              goal,
              software,
              command: command || "<voice transcript or typed command>",
              selectedCandidateNumber: "<teacher confirmed number>",
              teacherConfirmedNumber: true,
              outputDir: loopDir
            },
            blockedUntil: "teacher confirms exactly one visible number or supplies corrected candidates"
          }
        ]
      : [
          {
            tool: "create_engineering_voice_execution_approval_gate",
            arguments: {
              goal,
              software,
              confirmation: confirmationResult?.receipt ?? "<confirmed target receipt>",
              executionPackage: confirmationResult?.existingExecutionPackage ?? "<existing execution package>",
              adapterId: "<reviewed adapter id>",
              teacherConfirmation: "<explicit teacher voice execution confirmation>",
              rollbackPointCreated: false
            },
            blockedUntil: "reviewed route evidence, explicit teacher execution confirmation, and rollback point are present"
          },
          {
            tool: "verify_supervised_action_outcome",
            blockedUntil: "a supervised execution receipt exists"
          }
        ],
  blockedActions: [
    "execute_from_voice_without_number_confirmation",
    "execute_without_dry_run_receipt",
    "execute_without_engineering_voice_execution_approval_gate",
    "execute_without_target_window_preflight",
    "continuous_screen_or_audio_recording",
    "write_memory_or_enable_rule_without_teacher_approval",
    "claim_universal_native_execution_or_goal_completion"
  ],
  locks
};

const controlLoopPath = join(loopDir, "engineering-voice-command-control-loop.json");
const receiptPath = join(loopDir, "engineering-voice-command-control-loop-receipt.json");
const readmePath = join(loopDir, "ENGINEERING_VOICE_COMMAND_CONTROL_LOOP_START_HERE.md");
writeFileSync(controlLoopPath, `${JSON.stringify(controlLoop, null, 2)}\n`, "utf8");
writeFileSync(
  receiptPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_engineering_voice_command_control_loop_receipt_v1",
      loopId,
      status,
      selectedCandidateNumber: controlLoop.selectedCandidateNumber,
      blockedReason,
      teacherDecision: status === "waiting_for_numbered_target_confirmation" ? "needs_number_confirmation" : "needs_execution_review",
      locks
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  readmePath,
  [
    "# Engineering Voice Command Control Loop",
    "",
    `Status: ${status}`,
    "",
    "1. Speak or type a short command for the engineering software.",
    "2. Review the numbered possible targets in the workbench.",
    "3. Confirm exactly one number, or correct the candidates.",
    "4. After confirmation, inspect the dry-run-first action package.",
    "5. Execute only through the supervised execution gate with target-window preflight and outcome verification.",
    "",
    "Safety locks: reviewOnly=true, accepted=false, ruleEnabled=false, packagingGated=true, softwareActionsExecuted=false, targetSoftwareCommandsExecuted=false, fullContinuousRecording=false.",
    "",
    `Open first: ${workbenchResult.html}`,
    `Loop JSON: ${controlLoopPath}`
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_engineering_voice_command_control_loop_result_v1",
      status,
      controlLoopPath,
      receiptPath,
      teacherReadme: readmePath,
      workbenchHtml: workbenchResult.html,
      targetConfirmation: workbenchResult.targetConfirmation,
      confirmationResult: confirmationResult?.receipt ?? "",
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      nativeUniversalExecution: false,
      packagingGated: true
    },
    null,
    2
  )
);
