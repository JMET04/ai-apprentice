#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function textArg(name, fallback = "") {
  const filePath = argValue(`${name}-file`, "");
  if (filePath) return readFileSync(resolve(filePath), "utf8").replace(/^\uFEFF/, "").trim();
  return argValue(name, fallback);
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
  return String(value || "engineering-voice-control-session")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "engineering-voice-control-session";
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readOptionalJson(path) {
  if (!path || !existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const goal = textArg("--goal", textArg("--task", "Let a non-expert control engineering software by voice or typed command after numbered target confirmation."));
const software = argValue("--software", argValue("--app", "target engineering software"));
const command = textArg("--command", textArg("--text-command", ""));
const voiceTranscript = textArg("--voice-transcript", "");
const processName = argValue("--process-name", "");
const windowTitle = argValue("--window-title", "");
const installPath = argValue("--install-path", "");
const executable = argValue("--executable", "");
const locale = argValue("--locale", "zh-CN");
const preferredTone = argValue("--preferred-tone", "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "engineering-voice-control-sessions")));
const includeVoiceKit = !hasFlag("--no-voice-kit");
const runReadOnlyProbe = hasFlag("--run-read-only-probe");
const createProfile = !hasFlag("--no-control-profile");
const createAdapterSelection = hasFlag("--create-adapter-selection");
const includeRegistry = hasFlag("--include-registry");
const noPortScan = hasFlag("--no-port-scan");
const maxFiles = argValue("--max-files", "160");
const maxDepth = argValue("--max-depth", "4");
const maxRegistryItems = argValue("--max-registry-items", "60");
const candidates = argValues("--candidate");
const fileExtensions = argValues("--file-extension");
const importFormats = argValues("--import-format");
const exportFormats = argValues("--export-format");
const commandNames = argValues("--command-name");
const apiMethods = argValues("--api-method");
const macroNames = argValues("--macro-name");
const apiHint = argValue("--api-hint", "");
const macroHint = argValue("--macro-hint", "");
const commandHelp = argValue("--command-help", "");
const url = argValue("--url", "");

mkdirSync(outputRoot, { recursive: true });
const sessionId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const sessionDir = join(outputRoot, sessionId);
mkdirSync(sessionDir, { recursive: true });

const voiceKitDir = join(sessionDir, "voice-kit");
const commandKitDir = join(sessionDir, "numbered-command-confirmation");
const probeDir = join(sessionDir, "control-channel-probe");
const profileDir = join(sessionDir, "control-channel-profile");
const sessionPath = join(sessionDir, "engineering-voice-control-session.json");
const readmePath = join(sessionDir, "ENGINEERING_VOICE_CONTROL_SESSION_START_HERE.md");

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  fileContentsRead: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequiredBeforeExecution: true,
  numberedTargetConfirmationRequired: true,
  dryRunFirst: true
};

const voiceKit = includeVoiceKit
  ? runNodeScript("create-voice-teaching-kit.mjs", [
      "--goal",
      goal,
      "--locale",
      locale,
      ...(preferredTone ? ["--preferred-tone", preferredTone] : []),
      "--output-dir",
      voiceKitDir
    ])
  : null;

const commandArgs = ["--goal", goal, "--software", software, "--output-dir", commandKitDir];
if (command) commandArgs.push("--command", command);
if (voiceTranscript) commandArgs.push("--voice-transcript", voiceTranscript);
if (processName) commandArgs.push("--process-name", processName);
if (windowTitle) commandArgs.push("--window-title", windowTitle);
if (locale) commandArgs.push("--locale", locale);
for (const candidate of candidates) commandArgs.push("--candidate", candidate);
const commandKit = runNodeScript("create-engineering-command-confirmation-kit.mjs", commandArgs);

const probeArgs = ["--goal", goal, "--software", software, "--output-dir", probeDir, "--max-files", maxFiles, "--max-depth", maxDepth, "--max-registry-items", maxRegistryItems];
if (processName) probeArgs.push("--process-name", processName);
if (windowTitle) probeArgs.push("--window-title", windowTitle);
if (installPath) probeArgs.push("--install-path", installPath);
if (executable) probeArgs.push("--executable", executable);
if (runReadOnlyProbe) probeArgs.push("--run-read-only-probe");
if (includeRegistry) probeArgs.push("--include-registry");
if (noPortScan) probeArgs.push("--no-port-scan");
for (const value of fileExtensions) probeArgs.push("--file-extension", value);
for (const value of importFormats) probeArgs.push("--import-format", value);
for (const value of exportFormats) probeArgs.push("--export-format", value);
const probe = runNodeScript("create-software-control-channel-probe.mjs", probeArgs);

let controlProfile = null;
if (createProfile) {
  const profileArgs = ["--goal", goal, "--software", software, "--output-dir", profileDir];
  if (processName) profileArgs.push("--process-name", processName);
  if (windowTitle) profileArgs.push("--window-title", windowTitle);
  if (installPath) profileArgs.push("--install-path", installPath);
  if (executable) profileArgs.push("--executable", executable);
  if (url) profileArgs.push("--url", url);
  if (commandHelp) profileArgs.push("--command-help", commandHelp);
  if (apiHint) profileArgs.push("--api-hint", apiHint);
  if (macroHint) profileArgs.push("--macro-hint", macroHint);
  if (probe.probeResultPath) profileArgs.push("--probe-result", probe.probeResultPath);
  for (const value of commandNames) profileArgs.push("--command-name", value);
  for (const value of apiMethods) profileArgs.push("--api-method", value);
  for (const value of macroNames) profileArgs.push("--macro-name", value);
  for (const value of fileExtensions) profileArgs.push("--file-extension", value);
  for (const value of importFormats) profileArgs.push("--import-format", value);
  for (const value of exportFormats) profileArgs.push("--export-format", value);
  if (createAdapterSelection) profileArgs.push("--create-adapter-selection");
  controlProfile = runNodeScript("create-software-control-channel-profile.mjs", profileArgs);
}

const targetConfirmation = readOptionalJson(commandKit.targetConfirmation);
const candidateNumbers = Array.isArray(targetConfirmation?.candidates) ? targetConfirmation.candidates.map((candidate) => candidate.number) : commandKit.candidateNumbers ?? [];

const nextCalls = [
  {
    when: "Teacher reviews the understood voice/text command and numbered candidates.",
    tool: "confirm_engineering_command_target",
    arguments: {
      confirmation: commandKit.targetConfirmation,
      selectedCandidateNumber: "<teacher confirmed number>",
      createActionKit: true,
      createExecutionAdapter: true,
      software,
      processName,
      windowTitle
    },
    blockedUntil: "teacher confirms exactly one visible number or corrects the candidate list"
  },
  {
    when: "Teacher wants a lower-token control route before UI automation.",
    tool: "create_software_control_channel_profile",
    arguments: {
      goal,
      software,
      probeResult: probe.probeResultPath || "<run read-only probe first, then pass result>",
      actionPlan: "<single-target supervised action plan after confirm_engineering_command_target>",
      createAdapterSelection: true
    },
    blockedUntil: "teacher has reviewed probe scope/result and selected target"
  },
  {
    when: "A dry-run action package exists and the teacher wants to rehearse execution.",
    tool: "start_teach_execute_supervised_execution",
    arguments: {
      actionRehearsal: "<reviewed action rehearsal JSON>",
      teacherConfirmation: "<explicit teacher confirmation>",
      targetWindowTitle: windowTitle || "<visible target window title>",
      spatialReadinessConfirmed: true
    },
    blockedUntil: "dry-run, target-window, spatial readiness, and outcome verifier are reviewed"
  }
];

const session = {
  ok: true,
  format: "transparent_ai_engineering_voice_control_session_v1",
  sessionId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  command,
  voiceTranscriptProvided: Boolean(voiceTranscript),
  productIntent:
    "One review-only entry for non-experts: speak or type a command, confirm a numbered target, discover low-token control channels, dry-run an existing adapter, then execute only under teacher supervision.",
  nonExpertVoiceTextNumberedControlLoop: {
    format: "transparent_ai_non_expert_voice_text_numbered_control_loop_v1",
    purpose:
      "Let a user who does not know the engineering software describe the desired operation by voice or typed text, then review numbered possible target positions before any execution route is prepared.",
    optimizedPromptTemplate:
      "I want to control <software> without knowing its UI. My command is: <voice transcript or typed command>. First restate what you understood, mark the possible target positions with numbers, wait for me to confirm one number or correct you, then only prepare a dry-run-first execution route.",
    acceptedInputModes: [
      "browser_or_system_speech_transcript",
      "typed_text_command",
      "manual_transcript_from_any_dictation_tool"
    ],
    userFacingLoop: [
      {
        step: 1,
        id: "receive_voice_or_text",
        display: "Receive a short voice transcript or typed engineering command.",
        tokenPolicy: "store only the short command/transcript, not continuous audio"
      },
      {
        step: 2,
        id: "restate_understanding",
        display: "Restate the understood engineering operation and uncertainty.",
        output: "transparent_ai_engineering_voice_text_command_intent_v1"
      },
      {
        step: 3,
        id: "mark_numbered_possible_positions",
        display: "Mark the possible target positions with visible numbers for teacher confirmation.",
        output: "transparent_ai_numbered_target_confirmation_v1",
        candidateNumbers,
        coordinateSpace: "normalized_0_to_1_screen_or_screenshot"
      },
      {
        step: 4,
        id: "wait_for_confirmed_number",
        display: "Wait until the user confirms exactly one number or corrects the target list.",
        requiredBridge: "confirm_engineering_command_target",
        blocksExecution: true
      },
      {
        step: 5,
        id: "prepare_dry_run_execution_route",
        display:
          "Prepare only a dry-run-first reviewed route using existing API, macro, CLI/script, browser, file import/export, or supervised UI fallback.",
        blocksRealActionUntil: [
          "teacher confirmed one number",
          "dry-run receipt reviewed",
          "target window or structured route preflight reviewed",
          "teacher explicitly confirms execution"
        ]
      }
    ],
    confirmationContract: {
      teacherMustConfirmExactlyOneNumber: true,
      confirmationTool: "confirm_engineering_command_target",
      correctionAllowedInsteadOfConfirmation: true,
      selectedTargetOnlyAfterConfirmation: true,
      autoExecuteFromVoiceOnly: false
    },
    executionContract: {
      dryRunFirst: true,
      preferExistingStructuredControlRoutes: true,
      structuredRoutesBeforeUiFallback: [
        "existing-application-api",
        "existing-cli-or-script",
        "existing-browser-automation",
        "existing-file-import-export",
        "existing-windows-ui-automation"
      ],
      teacherConfirmationRequiredBeforeExecution: true,
      outcomeVerificationRequiredBeforeLearning: true
    },
    locks
  },
  generated: {
    voiceKit: voiceKit
      ? {
          teacherReadme: voiceKit.teacherReadme ?? voiceKit.files?.teacherReadme ?? "",
          html: voiceKit.files?.html ?? voiceKit.html ?? "",
          preferences: voiceKit.files?.preferences ?? voiceKit.preferences ?? "",
          manifest: voiceKit.files?.manifest ?? voiceKit.manifest ?? voiceKit.kitPath ?? ""
        }
      : null,
    engineeringCommandConfirmationKit: {
      teacherReadme: commandKit.teacherReadme ?? "",
      browserHtml: commandKit.browserHtml ?? "",
      commandIntent: commandKit.commandIntent ?? "",
      voiceControlWorkflow: commandKit.voiceControlWorkflow ?? "",
      targetConfirmation: commandKit.targetConfirmation ?? "",
      overlayPacket: commandKit.overlayPacket ?? "",
      manifest: commandKit.kitPath ?? "",
      candidateNumbers,
      nextConfirmationBridge: "confirm_engineering_command_target"
    },
    softwareControlChannelProbe: {
      teacherReadme: probe.teacherReadme ?? probe.readmePath ?? "",
      probePlan: probe.probePlan ?? probe.probePlanPath ?? "",
      probeScript: probe.probeScript ?? probe.probeScriptPath ?? "",
      probeResultTemplate: probe.probeResultTemplate ?? probe.probeResultTemplatePath ?? "",
      probeResult: probe.probeResult ?? probe.probeResultPath ?? "",
      nextProfileRequest: probe.nextProfileRequest ?? probe.nextProfileRequestPath ?? "",
      didRunReadOnlyProbe: probe.didRunReadOnlyProbe === true,
      discoveredRouteCounts: probe.discoveredRouteCounts ?? {}
    },
    softwareControlChannelProfile: controlProfile
      ? {
          teacherReadme: controlProfile.readmePath ?? "",
          profilePath: controlProfile.profilePath ?? "",
          adapterRequestPath: controlProfile.adapterRequestPath ?? "",
          receiptTemplatePath: controlProfile.receiptTemplatePath ?? "",
          primaryAdapterId: controlProfile.primaryAdapterId ?? "",
          recommendedAdapterIds: controlProfile.recommendedAdapterIds ?? [],
          structuredRouteFound: controlProfile.structuredRouteFound === true,
          adapterSelectionPath: controlProfile.adapterSelectionPath ?? "",
          executionPackagePath: controlProfile.executionPackagePath ?? ""
        }
      : null
  },
  orderedWorkflow: [
    "capture_or_type_command",
    "interpret_command",
    "mark_numbered_candidates",
    "teacher_confirms_exactly_one_number",
    "read_only_control_channel_probe",
    "control_channel_profile",
    "single_target_action_plan",
    "existing_adapter_dry_run",
    "supervised_execution_gate",
    "outcome_verification_before_learning"
  ],
  nextCalls,
  blockedActions: [
    "execute_without_confirmed_number",
    "execute_without_dry_run",
    "execute_without_target_window_preflight",
    "read_file_contents_during_probe",
    "continuous_recording_by_default",
    "enable_rule_or_memory_without_teacher_approval",
    "unlock_packaging_or_claim_native_universal_execution"
  ],
  locks
};

writeFileSync(sessionPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Engineering Voice Control Session",
    "",
    `Goal: ${goal}`,
    `Software: ${software}`,
    "",
    "Use this package when a non-expert wants to speak or type an engineering-software command.",
    "",
    "Review flow:",
    "1. Open the voice kit or command confirmation HTML.",
    "2. Check the interpreted operation and numbered target candidates.",
    "3. Confirm exactly one number, or correct the target list before planning actions.",
    "4. Review the read-only control-channel probe package. Run it only after reviewing scope.",
    "5. Pass the probe result into the control-channel profile and prefer API, macro, CLI/script, browser/local-service, or file import/export before Windows UI fallback.",
    "6. Generate only dry-run-first adapter/action packages.",
    "7. Use the supervised execution gate only after target-window, spatial readiness, and receipt verification are reviewed.",
    "",
    "Generated files:",
    `- ${basename(sessionPath)}`,
    ...(voiceKit ? [`- voice kit: ${voiceKit.teacherReadme}`] : []),
    `- command confirmation: ${commandKit.teacherReadme}`,
    `- read-only control-channel probe: ${probe.teacherReadme ?? probe.readmePath}`,
    ...(controlProfile ? [`- control-channel profile: ${controlProfile.readmePath}`] : []),
    "",
    "Locked defaults: accepted=false, ruleEnabled=false, technologyAccepted=false, packagingGated=true, fullContinuousRecording=false, screenshotsCaptured=false, softwareActionsExecuted=false, targetSoftwareCommandsExecuted=false, nativeUniversalExecution=false."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_engineering_voice_control_session_result_v1",
      nonExpertControlMode: "voice_or_text_numbered_target_confirmation",
      sessionId,
      sessionPath,
      teacherReadme: readmePath,
      voiceKit: voiceKit?.teacherReadme ?? voiceKit?.files?.teacherReadme ?? "",
      voiceKitHtml: voiceKit?.files?.html ?? voiceKit?.html ?? "",
      commandConfirmationKit: commandKit.teacherReadme ?? "",
      targetConfirmation: commandKit.targetConfirmation ?? "",
      candidateNumbers,
      teacherMustConfirmExactlyOneNumber: true,
      softwareControlChannelProbe: probe.teacherReadme ?? probe.readmePath ?? "",
      probeResult: probe.probeResult ?? probe.probeResultPath ?? "",
      softwareControlChannelProfile: controlProfile?.profilePath ?? "",
      primaryAdapterId: controlProfile?.primaryAdapterId ?? "",
      recommendedAdapterIds: controlProfile?.recommendedAdapterIds ?? [],
      nextConfirmationBridge: "confirm_engineering_command_target",
      nextProfileBridge: "create_software_control_channel_profile",
      nextSupervisedExecutionGate: "start_teach_execute_supervised_execution",
      fullContinuousRecording: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      nativeUniversalExecution: false,
      reviewLocks: locks
    },
    null,
    2
  )
);
