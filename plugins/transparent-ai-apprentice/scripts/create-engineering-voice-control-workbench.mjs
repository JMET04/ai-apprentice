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
  return String(value || "engineering-voice-control-workbench")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "engineering-voice-control-workbench";
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

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function fileUri(path) {
  if (!path) return "";
  return `file:///${resolve(path).replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
}

function psQuote(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function nodeCommandLine(scriptName, args) {
  return [
    "node",
    psQuote(join("plugins", "transparent-ai-apprentice", "scripts", scriptName)),
    ...args.flatMap(([flag, value]) => (value === true ? [flag] : [flag, psQuote(value)]))
  ].join(" ");
}

const goal = textArg("--goal", textArg("--task", "Let a non-expert control engineering software by voice or typed command after numbered target confirmation."));
const software = argValue("--software", argValue("--app", "target engineering software"));
const command = textArg("--command", textArg("--text-command", ""));
const voiceTranscript = textArg("--voice-transcript", "");
const processName = argValue("--process-name", "");
const windowTitle = argValue("--window-title", "");
const installPath = argValue("--install-path", "");
const executable = argValue("--executable", "");
const visualEvidence = argValue("--visual-evidence", argValue("--image", argValue("--screenshot", "")));
const captureReceipt = argValue("--capture-receipt", argValue("--visual-capture-receipt", ""));
const locale = argValue("--locale", "zh-CN");
const preferredTone = argValue("--preferred-tone", "concise_direct");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "engineering-voice-control-workbenches")));
const candidates = argValues("--candidate");
const runReadOnlyProbe = hasFlag("--run-read-only-probe");
const createAdapterSelection = hasFlag("--create-adapter-selection");
const createExecutionAdapter = hasFlag("--create-execution-adapter");
const noPortScan = hasFlag("--no-port-scan");
const maxFiles = argValue("--max-files", "80");
const maxDepth = argValue("--max-depth", "2");
const maxRegistryItems = argValue("--max-registry-items", "0");

mkdirSync(outputRoot, { recursive: true });
const workbenchId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const workbenchDir = join(outputRoot, workbenchId);
mkdirSync(workbenchDir, { recursive: true });

const sessionDir = join(workbenchDir, "session");
const sessionArgs = [
  "--goal",
  goal,
  "--software",
  software,
  "--locale",
  locale,
  "--preferred-tone",
  preferredTone,
  "--output-dir",
  sessionDir,
  "--max-files",
  maxFiles,
  "--max-depth",
  maxDepth,
  "--max-registry-items",
  maxRegistryItems
];
if (command) sessionArgs.push("--command", command);
if (voiceTranscript) sessionArgs.push("--voice-transcript", voiceTranscript);
if (processName) sessionArgs.push("--process-name", processName);
if (windowTitle) sessionArgs.push("--window-title", windowTitle);
if (installPath) sessionArgs.push("--install-path", installPath);
if (executable) sessionArgs.push("--executable", executable);
if (runReadOnlyProbe) sessionArgs.push("--run-read-only-probe");
if (createAdapterSelection) sessionArgs.push("--create-adapter-selection");
if (noPortScan) sessionArgs.push("--no-port-scan");
for (const candidate of candidates) sessionArgs.push("--candidate", candidate);

const sessionResult = runNodeScript("create-engineering-voice-control-session.mjs", sessionArgs);
const session = readJson(sessionResult.sessionPath);
const targetConfirmation = readJson(sessionResult.targetConfirmation);

let visualTargetResult = null;
let visualTargetConfirmation = null;
if (visualEvidence || captureReceipt) {
  const visualArgs = [
    "--goal",
    goal,
    "--software",
    software,
    "--command",
    command || voiceTranscript,
    "--output-dir",
    join(workbenchDir, "visual-target-confirmation")
  ];
  if (visualEvidence) visualArgs.push("--visual-evidence", visualEvidence);
  if (captureReceipt) visualArgs.push("--capture-receipt", captureReceipt);
  if (voiceTranscript) visualArgs.push("--voice-transcript", voiceTranscript);
  if (processName) visualArgs.push("--process-name", processName);
  if (windowTitle) visualArgs.push("--window-title", windowTitle);
  for (const candidate of candidates) visualArgs.push("--candidate", candidate);
  visualTargetResult = runNodeScript("create-visual-engineering-target-confirmation-kit.mjs", visualArgs);
  visualTargetConfirmation = readJson(visualTargetResult.targetConfirmation);
}

const transparentSketchOverlayResult = runNodeScript("create-transparent-sketch-overlay-kit.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--mode",
  "2d_3d",
  "--output-dir",
  join(workbenchDir, "transparent-sketch-overlay")
]);
const teacherExportedOverlayPacketPlaceholder = "<teacher-exported-transparent-sketch-packet.json>";
const spatialTargetConfirmationCommandTemplate = nodeCommandLine("create-spatial-target-confirmation-kit.mjs", [
  ["--overlay-packet", teacherExportedOverlayPacketPlaceholder],
  ["--goal", goal],
  ["--software", software],
  ["--command", command || voiceTranscript || "Use the teacher's voice, typed instruction, or transparent sketch only after numbered target confirmation."],
  ["--output-dir", join(workbenchDir, "spatial-target-confirmation-from-teacher-sketch")],
  ["--create-action-kit", true]
]);

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
  uiEventsSent: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequiredBeforeExecution: true,
  numberedTargetConfirmationRequired: true,
  dryRunFirst: true,
  workbenchDoesNotExecuteSoftware: true
};

const optimizedPrompt =
  "I want to control <software> by voice or text, but I do not know the interface. First restate the operation you understood, mark possible positions as 1/2/3, wait for me to confirm one number or correct you, then prepare only a dry-run-first supervised execution route.";

const receiptTemplate = {
  format: "transparent_ai_engineering_voice_control_workbench_receipt_template_v1",
  workbenchId,
  software,
  goal,
  defaultStatus: "needs_teacher_review",
  allowedStatuses: ["needs_teacher_review", "number_confirmed_for_dry_run", "blocked_needs_better_target_candidates"],
  blockedStatuses: ["accepted", "execute_now", "memory_enabled", "packaging_unlocked"],
  selectedCandidateNumber: null,
  teacherCorrection: "",
  observedWorkbenchEvidence: "",
  nextToolAfterConfirmation: "confirm_engineering_command_target",
  locks
};

const workbenchPath = join(workbenchDir, "engineering-voice-control-workbench.json");
const htmlPath = join(workbenchDir, "engineering-voice-control-workbench.html");
const receiptTemplatePath = join(workbenchDir, "engineering-voice-control-workbench-receipt-template.json");
const readmePath = join(workbenchDir, "ENGINEERING_VOICE_CONTROL_WORKBENCH_START_HERE.md");

const activeTargetConfirmation = visualTargetConfirmation || targetConfirmation;
const activeTargetConfirmationPath = visualTargetResult?.targetConfirmation || sessionResult.targetConfirmation;
const visualBackdropPath = visualTargetConfirmation?.visualEvidencePath || visualTargetResult?.visualEvidencePath || "";
const candidatesForUi = Array.isArray(activeTargetConfirmation.candidates) ? activeTargetConfirmation.candidates : [];
const confirmCommandTemplate = nodeCommandLine("confirm-engineering-command-target.mjs", [
  ["--confirmation", activeTargetConfirmationPath],
  ["--selected-number", "__SELECTED_NUMBER__"],
  ["--goal", goal],
  ["--software", software],
  ["--output-dir", join(workbenchDir, "confirmed-target")],
  ["--action-output-dir", join(workbenchDir, "confirmed-target", "supervised-action-kits")],
  ["--execution-adapter-output-dir", join(workbenchDir, "confirmed-target", "execution-adapter-selections")],
  ...(processName ? [["--process-name", processName]] : []),
  ...(windowTitle ? [["--window-title", windowTitle]] : []),
  ["--create-action-kit", true],
  ...(createExecutionAdapter ? [["--create-execution-adapter", true]] : []),
  ...(sessionResult.softwareControlChannelProfile ? [["--capability-profile", sessionResult.softwareControlChannelProfile]] : [])
]);
const nextConfirmCall = {
  tool: "confirm_engineering_command_target",
  arguments: {
    confirmation: activeTargetConfirmationPath,
    selectedCandidateNumber: "<choose one visible number in the workbench>",
    createActionKit: true,
    createExecutionAdapter,
    software,
    processName,
    windowTitle,
    confirmCommandTemplate
  },
  blockedUntil: "teacher confirms exactly one number or corrects the candidates"
};

const workbench = {
  ok: true,
  format: "transparent_ai_engineering_voice_control_workbench_v1",
  workbenchId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  optimizedPrompt,
  productPurpose:
    "A teacher-facing single screen for non-experts: speak or type an engineering command, inspect numbered possible targets, confirm one number, then hand off only to dry-run-first supervised execution.",
  existingAbilitiesReused: [
    "create_voice_teaching_kit",
    "create_engineering_command_confirmation_kit",
    "create_engineering_voice_control_session",
    "create_visual_engineering_target_confirmation_kit",
    "create_transparent_sketch_overlay_kit",
    "create_spatial_target_confirmation_kit",
    "confirm_engineering_command_target",
    "create_software_control_channel_probe",
    "create_software_control_channel_profile",
    "create_existing_software_execution_adapter",
    "start_teach_execute_supervised_execution",
    "verify_supervised_action_outcome",
    "create_post_action_evidence_checkpoint"
  ],
  lowTokenPolicy: {
    storesContinuousAudio: false,
    keepsOnlyShortTranscriptOrTypedCommand: true,
    screenshotsOnlyAfterMeaningfulTriggerAndTeacherReview: true,
    doesNotReadTargetFileContentsByDefault: true,
    postActionVerificationBeforeLearning: true
  },
  teacherLoop: [
    "open_workbench_html",
    "speak_or_type_short_command",
    "optionally_draw_over_transparent_sketch_overlay_and_export_packet",
    "replace_teacher_exported_overlay_packet_placeholder_to_create_spatial_numbered_targets",
    "review_understood_operation",
    "select_one_numbered_candidate_or_write_correction",
    "copy_or_pass_confirm_tool_call",
    "review_dry_run_adapter_package",
    "execute_only_after_supervised_execution_gate"
  ],
  generated: {
    html: htmlPath,
    workbench: workbenchPath,
    receiptTemplate: receiptTemplatePath,
    teacherReadme: readmePath,
    sessionPath: sessionResult.sessionPath,
    sessionReadme: sessionResult.teacherReadme,
    voiceKitHtml: sessionResult.voiceKitHtml,
    commandConfirmationKit: sessionResult.commandConfirmationKit,
    targetConfirmation: sessionResult.targetConfirmation,
    activeTargetConfirmation: activeTargetConfirmationPath,
    visualTargetConfirmation: visualTargetResult?.targetConfirmation ?? "",
    visualTargetConfirmationHtml: visualTargetResult?.htmlPath ?? "",
    visualOverlayPacket: visualTargetResult?.overlayPacket ?? "",
    visualEvidencePath: visualBackdropPath,
    transparentSketchOverlayHtml: transparentSketchOverlayResult.browserOverlay,
    transparentSketchOverlayReadme: transparentSketchOverlayResult.teacherReadme,
    transparentSketchOverlayManifest: transparentSketchOverlayResult.kitPath,
    transparentSketchOverlayPowerShell: transparentSketchOverlayResult.powershellOverlay,
    softwareControlChannelProbe: sessionResult.softwareControlChannelProbe,
    softwareControlChannelProfile: sessionResult.softwareControlChannelProfile
  },
  spatialSketchBridge: {
    status: "waiting_for_teacher_exported_transparent_sketch_packet",
    transparentSketchOverlayHtml: transparentSketchOverlayResult.browserOverlay,
    teacherExportedOverlayPacketPlaceholder,
    spatialTargetConfirmationCommandTemplate,
    doesNotUseSamplePacketAsTeacherEvidence: true,
    generatedSpatialIntentEvidence: false,
    nextStep:
      "Open the transparent sketch overlay, draw the 2D/perspective/3D intent, export the packet, replace the placeholder path, then create numbered spatial target candidates for teacher confirmation."
  },
  visualEvidence: visualTargetResult
    ? {
        source: captureReceipt ? "triggered_visual_capture_receipt" : "reviewed_visual_evidence_file",
        path: visualBackdropPath,
        html: visualTargetResult.htmlPath,
        targetConfirmation: visualTargetResult.targetConfirmation,
        overlayPacket: visualTargetResult.overlayPacket,
        screenshotsCapturedByThisTool: false
      }
    : null,
  targetCandidates: candidatesForUi,
  nextConfirmCommandTemplate: confirmCommandTemplate,
  nextConfirmCommandPurpose:
    "Copy this command only after one visible number is selected; it creates dry-run-first confirmation evidence and does not execute target software.",
  nextConfirmCall,
  nextAfterConfirmedNumber: [
    "create_spatial_target_confirmation_kit_when_teacher_exported_overlay_packet_exists",
    "confirm_engineering_command_target",
    "create_supervised_software_action_kit",
    "create_existing_software_execution_adapter",
    "start_teach_execute_supervised_execution",
    "verify_supervised_action_outcome",
    "create_post_action_evidence_checkpoint"
  ],
  blockedActions: [
    "execute_from_voice_only",
    "execute_without_one_confirmed_number",
    "execute_without_dry_run_receipt",
    "execute_without_target_window_preflight",
    "capture_screenshot_without_trigger_or_teacher_review",
    "write_memory_or_enable_rule_without_teacher_approval",
    "claim_universal_native_execution_or_all_software_completion"
  ],
  locks
};

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Engineering Voice Control Workbench</title>
  <style>
    :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; background: #f7f8f4; color: #1c2420; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 0 0 10px; }
    p { line-height: 1.5; }
    .grid { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(320px, 1.2fr); gap: 18px; align-items: start; }
    .panel, .candidate, textarea, button, input { border: 1px solid #c8d0c4; border-radius: 6px; }
    .panel { background: #ffffff; padding: 16px; }
    textarea { width: 100%; min-height: 112px; padding: 10px; box-sizing: border-box; font: 14px/1.4 Consolas, monospace; }
    button { min-height: 38px; padding: 8px 12px; background: #203d35; color: white; cursor: pointer; }
    button.secondary { background: white; color: #203d35; }
    button.selected { background: #8c4f22; }
    .candidate { display: grid; grid-template-columns: 44px 1fr; gap: 12px; padding: 12px; margin: 10px 0; background: #fbfcf9; }
    .number { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: #203d35; color: white; font-weight: 700; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
    .locks { font-size: 13px; color: #4c5a53; }
    .stage { position: relative; aspect-ratio: 16 / 9; background: #e7ece4; overflow: hidden; border: 1px solid #c8d0c4; border-radius: 6px; }
    .stage img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .pin { position: absolute; width: 36px; height: 36px; margin-left: -18px; margin-top: -18px; border-radius: 50%; display: grid; place-items: center; background: #8c4f22; color: white; font-weight: 700; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,.18); }
    code { background: #edf1eb; padding: 2px 4px; border-radius: 4px; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } main { padding: 16px; } }
  </style>
</head>
<body>
<main>
  <h1>Engineering Voice Control Workbench</h1>
  <p>${htmlEscape(software)} | ${htmlEscape(goal)}</p>
  <div class="grid">
    <section class="panel">
      <h2>Voice Or Text</h2>
      <p class="locks">Only a short transcript or typed command is kept. Continuous recording is off.</p>
      <textarea id="command">${htmlEscape(command || voiceTranscript || "")}</textarea>
      <div class="toolbar">
        <button id="startVoice">Start Voice</button>
        <button class="secondary" id="stopVoice">Stop</button>
        <button class="secondary" id="makeReceipt">Make Review Packet</button>
      </div>
      <p id="voiceStatus" class="locks">Speech recognition uses the browser Web Speech API when available; type manually if it is unavailable.</p>
    </section>
    <section class="panel">
      <h2>Transparent Sketch To Numbered Targets</h2>
      <p class="locks">Open the transparent mask when the command needs position, perspective, or 3D depth. Export a real teacher packet, then replace the placeholder below. The sample packet is never treated as teacher evidence.</p>
      <div class="toolbar">
        <a href="${htmlEscape(fileUri(transparentSketchOverlayResult.browserOverlay))}" target="_blank"><button type="button" class="secondary">Open Sketch Overlay</button></a>
        <a href="${htmlEscape(fileUri(transparentSketchOverlayResult.teacherReadme))}" target="_blank"><button type="button" class="secondary">Open Sketch Readme</button></a>
      </div>
      <textarea readonly>${htmlEscape(spatialTargetConfirmationCommandTemplate)}</textarea>
    </section>
    <section class="panel">
      <h2>Numbered Target Candidates</h2>
      ${visualBackdropPath ? `<p class="locks">Using reviewed visual evidence as the coordinate backdrop: <code>${htmlEscape(visualBackdropPath)}</code></p>` : ""}
      <div class="stage" id="stage"></div>
      <div id="candidateList"></div>
    </section>
  </div>
  <section class="panel" style="margin-top:18px">
    <h2>Next Confirm Call</h2>
    <p class="locks">Copy this packet into MCP only after exactly one number is selected. It still creates dry-run-first materials.</p>
    <textarea id="packet" readonly></textarea>
  </section>
  <section class="panel" style="margin-top:18px">
    <h2>Copyable Local Confirm Command</h2>
    <p class="locks">Use this command only after the selected number is correct. It creates confirmation evidence and dry-run materials; it does not execute target software.</p>
    <textarea id="confirmCommand" readonly></textarea>
  </section>
  <section class="panel" style="margin-top:18px">
    <h2>Locked Gates</h2>
    <p class="locks">No target software command, click, typing, screenshot, memory write, acceptance, or packaging unlock happens from this workbench. Execution still needs dry-run receipt, active target-window preflight, explicit teacher confirmation, outcome verification, and post-action evidence.</p>
  </section>
</main>
<script>
const workbench = ${jsonForScript(workbench)};
let selectedNumber = null;
let recognition = null;
const stage = document.getElementById('stage');
const list = document.getElementById('candidateList');
const packet = document.getElementById('packet');
const confirmCommand = document.getElementById('confirmCommand');
const commandBox = document.getElementById('command');
function renderCandidates() {
  stage.innerHTML = '';
  if (workbench.visualEvidence && workbench.visualEvidence.path) {
    const img = document.createElement('img');
    img.src = '${htmlEscape(fileUri(visualBackdropPath))}';
    img.alt = 'Reviewed engineering visual evidence';
    stage.appendChild(img);
  }
  list.innerHTML = '';
  for (const candidate of workbench.targetCandidates) {
    const x = Math.max(0.04, Math.min(0.96, candidate.normalizedTarget?.x ?? 0.5));
    const y = Math.max(0.04, Math.min(0.96, candidate.normalizedTarget?.y ?? 0.5));
    const pin = document.createElement('button');
    pin.className = 'pin' + (selectedNumber === candidate.number ? ' selected' : '');
    pin.style.left = (x * 100) + '%';
    pin.style.top = (y * 100) + '%';
    pin.textContent = candidate.number;
    pin.title = candidate.label || candidate.id;
    pin.onclick = () => selectCandidate(candidate.number);
    stage.appendChild(pin);
    const row = document.createElement('div');
    row.className = 'candidate';
    row.innerHTML = '<div class="number">' + candidate.number + '</div><div><strong>' +
      (candidate.label || candidate.id || 'candidate') + '</strong><p>' +
      (candidate.reason || 'Review this possible target before action planning.') +
      '</p><p class="locks">x=' + x.toFixed(2) + ', y=' + y.toFixed(2) +
      ', z=' + (candidate.normalizedTarget?.zHint ?? 0) + '</p></div>';
    row.onclick = () => selectCandidate(candidate.number);
    list.appendChild(row);
  }
}
function selectCandidate(number) {
  selectedNumber = number;
  renderCandidates();
  makePacket();
}
function makePacket() {
  const next = JSON.parse(JSON.stringify(workbench.nextConfirmCall));
  next.arguments.selectedCandidateNumber = selectedNumber || '<select one number first>';
  next.arguments.teacherCommand = commandBox.value;
  next.reviewReceipt = {
    format: 'transparent_ai_engineering_voice_control_workbench_receipt_v1',
    workbenchId: workbench.workbenchId,
    status: selectedNumber ? 'number_confirmed_for_dry_run' : 'needs_teacher_review',
    selectedCandidateNumber: selectedNumber,
    teacherCommand: commandBox.value,
    software: workbench.software,
    locks: workbench.locks
  };
  packet.value = JSON.stringify(next, null, 2);
  confirmCommand.value = (workbench.nextConfirmCommandTemplate || '').replace('__SELECTED_NUMBER__', selectedNumber || '<select-one-number-first>');
}
document.getElementById('makeReceipt').onclick = makePacket;
document.getElementById('startVoice').onclick = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('voiceStatus').textContent = 'Speech recognition is unavailable in this browser. Type the command instead.';
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = '${htmlEscape(locale)}';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    commandBox.value = event.results[0][0].transcript;
    makePacket();
    document.getElementById('voiceStatus').textContent = 'Transcript captured. Review it before confirming a number.';
  };
  recognition.onend = () => document.getElementById('voiceStatus').textContent = 'Voice capture stopped.';
  recognition.start();
  document.getElementById('voiceStatus').textContent = 'Listening for one short command...';
};
document.getElementById('stopVoice').onclick = () => recognition && recognition.stop();
renderCandidates();
makePacket();
</script>
</body>
</html>
`;

writeFileSync(workbenchPath, `${JSON.stringify(workbench, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(htmlPath, html, "utf8");
writeFileSync(
  readmePath,
  [
    "# Engineering Voice Control Workbench",
    "",
    `Goal: ${goal}`,
    `Software: ${software}`,
    "",
    "Open the HTML workbench first:",
    `- ${htmlPath}`,
    "",
    "Workflow:",
    "1. Speak one short command or type it into the command box.",
    "2. If position, perspective, or 3D depth is ambiguous, open the transparent sketch overlay and export a real teacher packet.",
    `   Transparent sketch overlay: ${transparentSketchOverlayResult.browserOverlay}`,
    `   Spatial target command template: ${spatialTargetConfirmationCommandTemplate}`,
    visualBackdropPath
      ? "3. Review the numbered target candidates over the reviewed visual evidence."
      : "3. Review the numbered target candidates.",
    "4. Select exactly one number, or correct the target candidates.",
    "5. Copy the generated confirm call into MCP.",
    "   Or copy the generated local confirm command after the selected number is correct.",
    "6. Review the dry-run adapter/action package before any execution gate.",
    "",
    "This workbench does not execute target software, send UI events, capture screenshots, write memory, enable rules, or unlock packaging.",
    "",
    "Generated files:",
    `- ${basename(workbenchPath)}`,
    `- ${basename(htmlPath)}`,
    `- ${basename(receiptTemplatePath)}`,
    `- session: ${sessionResult.sessionPath}`,
    `- transparent sketch overlay: ${transparentSketchOverlayResult.browserOverlay}`,
    visualTargetResult ? `- visual confirmation: ${visualTargetResult.targetConfirmation}` : ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_engineering_voice_control_workbench_result_v1",
      workbenchId,
      workbenchPath,
      htmlPath,
      teacherReadme: readmePath,
      receiptTemplate: receiptTemplatePath,
      sessionPath: sessionResult.sessionPath,
      targetConfirmation: activeTargetConfirmationPath,
      transparentSketchOverlay: transparentSketchOverlayResult.browserOverlay,
      spatialTargetConfirmationCommandTemplate,
      visualTargetConfirmation: visualTargetResult?.targetConfirmation ?? "",
      visualEvidencePath: visualBackdropPath,
      candidateNumbers: candidatesForUi.map((candidate) => candidate.number),
      openFirst: htmlPath,
      nextConfirmationBridge: "confirm_engineering_command_target",
      nextConfirmCall,
      fullContinuousRecording: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      memoryWritten: false,
      nativeUniversalExecution: false,
      reviewLocks: locks
    },
    null,
    2
  )
);
