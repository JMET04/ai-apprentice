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

function multiArg(name) {
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
  return String(value || "triggered-visual-voice-workbench")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "triggered-visual-voice-workbench";
}

function readJsonInput(value, label, optional = false) {
  if (!value) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8").replace(/^\uFEFF/, "")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function optionalExistingPath(path) {
  if (!path) return "";
  const resolved = resolve(path);
  return existsSync(resolved) ? resolved : "";
}

function compact(value, max = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function runScript(scriptName, args) {
  const scriptPath = join(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function commandLine(scriptName, args) {
  const quoted = args.map((arg) => (String(arg).includes(" ") ? `"${String(arg).replace(/"/g, '\\"')}"` : String(arg)));
  return `node plugins/transparent-ai-apprentice/scripts/${scriptName} ${quoted.join(" ")}`.trim();
}

const handoffInput = readJsonInput(argValue("--handoff", argValue("--learning-handoff", "")), "--handoff", true);
const handoff = handoffInput.value;
if (handoff && handoff.format !== "transparent_ai_triggered_visual_evidence_learning_handoff_v1") {
  throw new Error("--handoff must be transparent_ai_triggered_visual_evidence_learning_handoff_v1");
}

const captureInput = readJsonInput(
  argValue("--capture-receipt", argValue("--visual-capture-receipt", handoff?.sourceEvidence?.captureReceiptPath || "")),
  "--capture-receipt",
  true
);
const capture = captureInput.value;
if (capture && capture.format !== "transparent_ai_triggered_visual_check_capture_receipt_v1") {
  throw new Error("--capture-receipt must be transparent_ai_triggered_visual_check_capture_receipt_v1");
}
if (!handoff && !capture) {
  throw new Error("--handoff or --capture-receipt is required");
}

const screenshotPath = optionalExistingPath(
  argValue("--screenshot", argValue("--visual-evidence", capture?.screenshotPath || handoff?.sourceEvidence?.screenshotPath || ""))
);
const software = argValue("--software", argValue("--app", capture?.software || handoff?.sourceEvidence?.software || "target engineering software"));
const processName = argValue("--process-name", capture?.processName || handoff?.sourceEvidence?.processName || "");
const windowTitle = argValue(
  "--window-title",
  capture?.observedWindowTitle || capture?.requestedWindowTitle || handoff?.sourceEvidence?.requestedWindowTitle || ""
);
const goal = argValue(
  "--goal",
  handoff?.goal || `Use a teacher-confirmed low-token visual check to help a non-expert control ${software} by voice or text.`
);
const command = argValue(
  "--command",
  argValue("--text-command", "Use the teacher's next spoken or typed command, then mark possible positions with numbers before any dry-run.")
);
const voiceTranscript = argValue("--voice-transcript", "");
const locale = argValue("--locale", "zh-CN");
const preferredTone = argValue("--preferred-tone", "concise_direct");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "triggered-visual-voice-control-workbenches"))
);
const candidates = multiArg("--candidate");

mkdirSync(outputRoot, { recursive: true });
const bridgeId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const bridgeDir = join(outputRoot, bridgeId);
mkdirSync(bridgeDir, { recursive: true });

let captureReceiptForWorkbench = captureInput.path;
if (capture && !captureReceiptForWorkbench) {
  captureReceiptForWorkbench = join(bridgeDir, "source-triggered-visual-capture-receipt.json");
  writeFileSync(captureReceiptForWorkbench, `${JSON.stringify(capture, null, 2)}\n`, "utf8");
}

const handoffReady =
  (!handoff || handoff.status === "waiting_for_teacher_learning_review") &&
  (!handoff || handoff.locks?.handoffDoesNotCaptureScreenshots === true) &&
  (!handoff || handoff.locks?.handoffDoesNotExecuteSoftware === true) &&
  (!handoff || handoff.locks?.handoffDoesNotWriteMemory === true);
const captureReady =
  (!capture || capture.status === "captured_one_bounded_visual_evidence") &&
  (!capture || capture.screenshotCount === 1) &&
  (!capture || capture.locks?.softwareActionsExecuted === false) &&
  (!capture || capture.locks?.nativeUniversalExecution === false);
const evidenceReady = Boolean(screenshotPath) && handoffReady && captureReady;

let workbenchResult = null;
let status = "blocked_triggered_visual_evidence_not_ready_for_voice_workbench";
if (evidenceReady) {
  const workbenchArgs = [
    "--goal",
    goal,
    "--software",
    software,
    "--command",
    command,
    "--locale",
    locale,
    "--preferred-tone",
    preferredTone,
    "--output-dir",
    join(bridgeDir, "engineering-voice-control-workbench")
  ];
  if (voiceTranscript) workbenchArgs.push("--voice-transcript", voiceTranscript);
  if (processName) workbenchArgs.push("--process-name", processName);
  if (windowTitle) workbenchArgs.push("--window-title", windowTitle);
  if (captureReceiptForWorkbench) workbenchArgs.push("--capture-receipt", captureReceiptForWorkbench);
  else workbenchArgs.push("--visual-evidence", screenshotPath);
  if (hasFlag("--run-read-only-probe")) workbenchArgs.push("--run-read-only-probe");
  if (hasFlag("--no-port-scan")) workbenchArgs.push("--no-port-scan");
  if (hasFlag("--create-adapter-selection")) workbenchArgs.push("--create-adapter-selection");
  if (hasFlag("--create-execution-adapter")) workbenchArgs.push("--create-execution-adapter");
  if (argValue("--max-files", "")) workbenchArgs.push("--max-files", argValue("--max-files"));
  if (argValue("--max-depth", "")) workbenchArgs.push("--max-depth", argValue("--max-depth"));
  if (argValue("--max-registry-items", "")) workbenchArgs.push("--max-registry-items", argValue("--max-registry-items"));
  for (const candidate of candidates) workbenchArgs.push("--candidate", candidate);
  workbenchResult = runScript("create-engineering-voice-control-workbench.mjs", workbenchArgs);
  status = "waiting_for_teacher_numbered_target_review";
}

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  bridgeDoesNotCaptureScreenshots: true,
  bridgeDoesNotExecuteSoftware: true,
  bridgeDoesNotReadFullLogs: true,
  bridgeDoesNotWriteMemory: true,
  bridgeDoesNotEnableRules: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequiredBeforeExecution: true,
  numberedTargetConfirmationRequired: true
};

const bridgePath = join(bridgeDir, "triggered-visual-evidence-voice-control-workbench.json");
const readmePath = join(bridgeDir, "TRIGGERED_VISUAL_VOICE_CONTROL_WORKBENCH_START_HERE.md");
const nextReviewCommand = workbenchResult
  ? commandLine("create-triggered-visual-evidence-voice-control-workbench.mjs", [
      "--handoff",
      handoffInput.path || "<triggered-visual-evidence-learning-handoff.json>",
      "--command",
      "<teacher voice transcript or typed command>",
      "--output-dir",
      join(outputRoot, "next-triggered-visual-voice-workbench")
    ])
  : "";

const bridge = {
  ok: true,
  format: "transparent_ai_triggered_visual_evidence_voice_control_workbench_v1",
  bridgeId,
  createdAt: new Date().toISOString(),
  status,
  goal,
  software,
  commandText: command,
  voiceTranscript,
  sourceEvidence: {
    handoffPath: handoffInput.path,
    handoffStatus: handoff?.status || "",
    captureReceiptPath: captureReceiptForWorkbench,
    captureReceiptStatus: capture?.status || "",
    sourceRequestPath: handoff?.sourceEvidence?.sourceRequestPath || capture?.requestPath || "",
    screenshotPath,
    selectedRequestId: capture?.selectedRequestId || handoff?.sourceEvidence?.selectedRequestId || "",
    triggerReason: capture?.triggerReason || handoff?.sourceEvidence?.triggerReason || "",
    triggerEvidence: capture?.triggerEvidence || handoff?.sourceEvidence?.triggerEvidence || null
  },
  existingAbilitiesReused: [
    "create-engineering-voice-control-workbench.mjs",
    "create-engineering-voice-control-session.mjs",
    "create-visual-engineering-target-confirmation-kit.mjs",
    "create-transparent-sketch-overlay-kit.mjs",
    "confirm-engineering-command-target"
  ],
  workbench: workbenchResult
    ? {
        resultFormat: workbenchResult.format,
        workbenchPath: workbenchResult.workbenchPath,
        htmlPath: workbenchResult.htmlPath,
        teacherReadme: workbenchResult.teacherReadme,
        receiptTemplate: workbenchResult.receiptTemplate,
        activeTargetConfirmation: workbenchResult.targetConfirmation,
        visualTargetConfirmation: workbenchResult.visualTargetConfirmation,
        visualEvidencePath: workbenchResult.visualEvidencePath,
        candidateNumbers: workbenchResult.candidateNumbers,
        nextConfirmationBridge: workbenchResult.nextConfirmationBridge,
        nextConfirmCall: workbenchResult.nextConfirmCall
      }
    : null,
  nextTeacherAction:
    status === "waiting_for_teacher_numbered_target_review"
      ? "Open the generated voice/text workbench, type or speak one command, review the numbered markers over the confirmed visual evidence, and select exactly one number or correct the candidates."
      : "Repair the triggered visual handoff or capture receipt before creating a voice/text numbered-target workbench.",
  nextAllowedActions:
    status === "waiting_for_teacher_numbered_target_review"
      ? [
          "open_voice_control_workbench_html",
          "teacher_speaks_or_types_short_command",
          "teacher_confirms_exactly_one_number_or_corrects_candidates",
          "confirm_engineering_command_target_after_one_number",
          "review_dry_run_first_execution_route"
        ]
      : ["repair_triggered_visual_evidence_before_voice_workbench"],
  blockedActions: [
    "execute_from_voice_without_one_confirmed_number",
    "capture_more_screenshots_by_default",
    "continuous_recording",
    "read_full_logs",
    "send_mouse_or_keyboard_events",
    "write_memory_or_enable_rules_without_teacher_approval",
    "unlock_packaging",
    "claim_universal_native_execution"
  ],
  reusableCommands: {
    repeatBridgeWithTeacherCommand: nextReviewCommand,
    openWorkbenchHtml: workbenchResult?.htmlPath || "",
    confirmSelectedNumber: workbenchResult?.nextConfirmCall?.arguments?.confirmCommandTemplate || ""
  },
  summary: {
    evidenceReady,
    missingEvidence: [
      screenshotPath ? "" : "single_visual_evidence_path",
      handoffReady ? "" : "handoff_review_locks_or_status",
      captureReady ? "" : "capture_receipt_status_or_locks"
    ].filter(Boolean),
    workbenchCreated: Boolean(workbenchResult),
    htmlPath: workbenchResult?.htmlPath || "",
    visualTargetConfirmation: workbenchResult?.visualTargetConfirmation || "",
    commandPreview: compact(command)
  },
  locks
};

writeFileSync(bridgePath, `${JSON.stringify(bridge, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Triggered Visual Voice Control Workbench",
    "",
    `Status: ${status}`,
    `Software: ${software}`,
    `Visual evidence: ${screenshotPath || "missing"}`,
    "",
    "This bridge reuses the existing engineering voice/text workbench. It turns a low-token triggered, teacher-confirmed visual check into a numbered target selection screen for non-experts.",
    "",
    workbenchResult ? `Open first: ${workbenchResult.htmlPath}` : "Open first: blocked until visual evidence is ready",
    workbenchResult ? `Workbench packet: ${workbenchResult.workbenchPath}` : "Workbench packet: not created",
    `Bridge packet: ${bridgePath}`,
    "",
    "Flow:",
    "1. Open the workbench HTML.",
    "2. Speak or type one command.",
    "3. Review numbered markers over the confirmed screenshot/visual evidence.",
    "4. Confirm exactly one number or correct the candidate list.",
    "5. Only then use confirm_engineering_command_target for dry-run-first planning.",
    "",
    "Locked defaults: no new screenshots, no continuous recording, no target software execution, no UI events, no full-log reading, no memory write, accepted=false, ruleEnabled=false, packagingGated=true.",
    "",
    `Source handoff: ${handoffInput.path || "none"}`,
    `Source capture receipt: ${captureReceiptForWorkbench || "none"}`,
    workbenchResult ? `Visual target confirmation: ${workbenchResult.visualTargetConfirmation}` : ""
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_triggered_visual_evidence_voice_control_workbench_result_v1",
  bridgeId,
  bridgePath,
  teacherReadme: readmePath,
  status,
  workbenchPath: workbenchResult?.workbenchPath || "",
  htmlPath: workbenchResult?.htmlPath || "",
  visualTargetConfirmation: workbenchResult?.visualTargetConfirmation || "",
  visualEvidencePath: workbenchResult?.visualEvidencePath || screenshotPath,
  candidateNumbers: workbenchResult?.candidateNumbers || [],
  nextConfirmationBridge: workbenchResult?.nextConfirmationBridge || "",
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  reviewLocks: locks
}, null, 2));
