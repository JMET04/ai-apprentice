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

function hasFlag(name) {
  return process.argv.includes(name);
}

function multiArg(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return String(value || "engineering-command-target-confirmation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "engineering-command-target-confirmation";
}

function clamp01(value, fallback = 0.5) {
  const number = Number(value);
  if (Number.isNaN(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function readJsonInput(input, label) {
  if (!input) throw new Error(`${label} is required`);
  const trimmed = String(input).trim();
  if (existsSync(trimmed)) {
    return {
      value: JSON.parse(readFileSync(trimmed, "utf8")),
      sourcePath: resolve(trimmed),
      baseDir: dirname(resolve(trimmed))
    };
  }
  if (trimmed.startsWith("{")) {
    return { value: JSON.parse(trimmed), sourcePath: "", baseDir: process.cwd() };
  }
  throw new Error(`${label} must be a JSON file path or JSON object string`);
}

function readMaybeJsonPath(value, baseDir) {
  if (!value) return null;
  if (typeof value === "object") return value;
  const candidate = String(value);
  const path = existsSync(candidate) ? candidate : join(baseDir, candidate);
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  return null;
}

function resolveJsonReference(value, baseDir) {
  if (!value) return null;
  if (typeof value === "object") return value;
  return readMaybeJsonPath(value, baseDir);
}

function commandTextFromIntent(intent) {
  if (!intent || typeof intent !== "object") return "";
  return intent.commandText || intent.voiceTranscript || "";
}

function pointForCandidate(candidate) {
  return {
    x: clamp01(candidate?.normalizedTarget?.x),
    y: clamp01(candidate?.normalizedTarget?.y),
    zHint: Number(candidate?.normalizedTarget?.zHint || 0),
    t: 0,
    planeId: "screen_or_model_view"
  };
}

function quoteArg(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function buildSingleTargetOverlay({ goal, software, selectedCandidate, commandIntent, sourceConfirmationPath, locks }) {
  const point = pointForCandidate(selectedCandidate);
  const label = `${selectedCandidate.number}. ${selectedCandidate.label}`;
  return {
    format: "transparent_ai_sketch_overlay_packet_v1",
    goal,
    software,
    overlayMode: "voice_text_confirmed_single_target",
    coordinateSpace: {
      origin: "top_left_screen_or_screenshot",
      units: "normalized_0_to_1",
      supports2D: true,
      supports3DDepthHints: true,
      selectedTargetOnly: true,
      targetNumberConfirmedByTeacher: selectedCandidate.number
    },
    anchors: [
      {
        id: selectedCandidate.id,
        type: "teacher_confirmed_numbered_target",
        number: selectedCandidate.number,
        label,
        box: [clamp01(point.x - 0.035), clamp01(point.y - 0.035), clamp01(point.x + 0.035), clamp01(point.y + 0.035)],
        reason: selectedCandidate.reason,
        selectedOnly: true
      }
    ],
    strokes: [
      {
        id: `confirmed-number-${selectedCandidate.number}-target-mark`,
        mode: "screen_2d",
        semanticLabel: `confirmed candidate ${selectedCandidate.number}: ${selectedCandidate.label}`,
        targetAnchorId: selectedCandidate.id,
        points: [
          point,
          {
            x: clamp01(point.x + 0.004),
            y: clamp01(point.y + 0.004),
            zHint: point.zHint,
            t: 30,
            planeId: "screen_or_model_view"
          }
        ],
        selectedOnly: true
      }
    ],
    spatialIntent: {
      relationships: [
        {
          subject: `confirmed-number-${selectedCandidate.number}-target-mark`,
          relation: "confirmed_target_for",
          object: commandIntent?.interpretedOperation || "engineering_command",
          teacherConfirmedNumber: selectedCandidate.number
        }
      ],
      inferredTeacherIntent:
        "review_only: teacher confirmed one numbered target from a voice/text engineering command before supervised action planning"
    },
    commandIntentSummary: {
      commandText: commandTextFromIntent(commandIntent),
      interpretedOperation: commandIntent?.interpretedOperation || "ambiguous_engineering_command",
      targetUnderstandingStatus: "teacher_confirmed_single_numbered_target"
    },
    sourceTargetConfirmation: sourceConfirmationPath || "",
    locks
  };
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

const confirmationInput =
  argValue("--confirmation") ||
  argValue("--target-confirmation") ||
  argValue("--review-packet") ||
  argValue("--packet");
const parsed = readJsonInput(confirmationInput, "--confirmation");
const reviewOrConfirmation = parsed.value;
const targetConfirmation = reviewOrConfirmation.targetConfirmation ?? reviewOrConfirmation;
const manifest = reviewOrConfirmation.manifest ?? readMaybeJsonPath(reviewOrConfirmation.kitPath, parsed.baseDir);
const selectedNumber = Number(
  argValue("--selected-number", argValue("--number", argValue("--candidate-number", targetConfirmation.selectedCandidateNumber ?? targetConfirmation.selectedCandidate?.number ?? "")))
);
if (!Number.isInteger(selectedNumber) || selectedNumber < 1) {
  throw new Error("--selected-number must identify exactly one candidate number");
}

const candidates = Array.isArray(targetConfirmation.candidates) ? targetConfirmation.candidates : [];
const selectedCandidate = candidates.find((candidate) => Number(candidate.number) === selectedNumber);
if (!selectedCandidate) {
  throw new Error(`Selected candidate number ${selectedNumber} was not found in ${candidates.length} candidates`);
}

const commandIntent =
  resolveJsonReference(reviewOrConfirmation.commandIntent, parsed.baseDir) ??
  readMaybeJsonPath(targetConfirmation.commandIntent, parsed.baseDir) ??
  readMaybeJsonPath(manifest?.files?.commandIntent, parsed.baseDir) ??
  null;
const voiceControlWorkflow =
  resolveJsonReference(reviewOrConfirmation.voiceControlWorkflow, parsed.baseDir) ??
  readMaybeJsonPath(targetConfirmation.voiceControlWorkflow, parsed.baseDir) ??
  readMaybeJsonPath(manifest?.files?.voiceControlWorkflow, parsed.baseDir) ??
  null;
const goal = argValue("--goal", targetConfirmation.goal ?? manifest?.goal ?? "Control engineering software by voice or text after target confirmation.");
const software = argValue("--software", argValue("--app", targetConfirmation.software ?? manifest?.software ?? "target engineering software"));
const processName = argValue("--process-name", manifest?.targetSoftware?.processName ?? "");
const windowTitle = argValue("--window-title", manifest?.targetSoftware?.windowTitle ?? "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "engineering-command-target-confirmations")));
const createActionKit = hasFlag("--create-action-kit");
const createExecutionAdapter = hasFlag("--create-execution-adapter");
const actionOutputDir = argValue("--action-output-dir", join(outputRoot, "supervised-action-kits"));
const executionAdapterOutputDir = argValue("--execution-adapter-output-dir", join(outputRoot, "execution-adapter-selections"));
const preferredAdapters = multiArg("--preferred-adapter");
const capabilityProfile = argValue("--capability-profile", "");
const observerQueue = argValue("--observer-queue", argValue("--queue", ""));
const typeText = argValue("--type-text", "");
const hotkey = argValue("--hotkey", "");

mkdirSync(outputRoot, { recursive: true });
const confirmationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}-number-${selectedNumber}`)}`;
const kitDir = join(outputRoot, confirmationId);
mkdirSync(kitDir, { recursive: true });

const receiptPath = join(kitDir, "engineering-command-target-confirmation-receipt.json");
const overlayPath = join(kitDir, "confirmed-single-target-overlay-packet.json");
const bridgeRequestPath = join(kitDir, "confirmed-target-supervised-action-request.json");
const executionAdapterRequestPath = join(kitDir, "confirmed-target-existing-execution-adapter-request.json");
const readmePath = join(kitDir, "CONFIRMED_ENGINEERING_TARGET_START_HERE.md");
const validationOutputDir = join(kitDir, "target-confirmation-validation");
const receiptValidationCommand = [
  "node plugins\\transparent-ai-apprentice\\scripts\\validate-engineering-command-target-confirmation-receipt.mjs",
  `--receipt ${quoteArg(receiptPath)}`,
  `--output-dir ${quoteArg(validationOutputDir)}`
].join(" ");

const locks = {
  reviewOnly: true,
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  teacherTargetNumberConfirmed: true,
  teacherExecutionConfirmationRequired: true,
  nativeUniversalExecution: false,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  selectedTargetOnly: true
};
const singleTargetOverlay = buildSingleTargetOverlay({
  goal,
  software,
  selectedCandidate,
  commandIntent,
  sourceConfirmationPath: parsed.sourcePath,
  locks
});
writeFileSync(overlayPath, `${JSON.stringify(singleTargetOverlay, null, 2)}\n`, "utf8");

const bridgeArgs = {
  goal,
  software,
  processName,
  windowTitle,
  overlayPacket: overlayPath,
  outputDir: actionOutputDir,
  typeText,
  hotkey
};
const bridgeRequest = {
  format: "transparent_ai_confirmed_engineering_target_supervised_action_request_v1",
  tool: "create_supervised_software_action_kit",
  arguments: bridgeArgs,
  sourceVoiceOrTextControlWorkflow: voiceControlWorkflow?.format ?? "",
  sourceCommandIntent: {
    commandText: commandTextFromIntent(commandIntent),
    interpretedOperation: commandIntent?.interpretedOperation || "ambiguous_engineering_command"
  },
  selectedCandidateNumber: selectedNumber,
  selectedCandidateId: selectedCandidate.id,
  selectedTargetOnly: true,
  executionMode: "dry_run_first",
  softwareActionsExecuted: false,
  locks
};
writeFileSync(bridgeRequestPath, `${JSON.stringify(bridgeRequest, null, 2)}\n`, "utf8");

let supervisedActionKit = null;
if (createActionKit || createExecutionAdapter) {
  const args = ["--goal", goal, "--software", software, "--overlay-packet", overlayPath, "--output-dir", actionOutputDir];
  if (processName) args.push("--process-name", processName);
  if (windowTitle) args.push("--window-title", windowTitle);
  if (typeText) args.push("--type-text", typeText);
  if (hotkey) args.push("--hotkey", hotkey);
  supervisedActionKit = runNodeScript("create-supervised-software-action-kit.mjs", args);
}

const actionPlanPath = supervisedActionKit?.actionPlan ?? supervisedActionKit?.files?.actionPlan ?? "";
const executionAdapterArgs = {
  goal,
  software,
  actionPlan: actionPlanPath,
  overlayPacket: overlayPath,
  outputDir: executionAdapterOutputDir,
  preferredAdapters,
  capabilityProfile,
  observerQueue
};
const executionAdapterRequest = {
  format: "transparent_ai_confirmed_engineering_target_existing_execution_adapter_request_v1",
  tool: "create_existing_software_execution_adapter",
  arguments: executionAdapterArgs,
  sourceVoiceOrTextControlWorkflow: voiceControlWorkflow?.format ?? "",
  sourceCommandIntent: {
    commandText: commandTextFromIntent(commandIntent),
    interpretedOperation: commandIntent?.interpretedOperation || "ambiguous_engineering_command"
  },
  selectedCandidateNumber: selectedNumber,
  selectedCandidateId: selectedCandidate.id,
  selectedTargetOnly: true,
  executionMode: "dry_run_first_route_selection",
  routePolicy: [
    "prefer documented API, CLI/script, browser automation, or file import/export when reviewed evidence exists",
    "fall back to supervised Windows UI automation only after structured routes are reviewed",
    "execute nothing until teacher confirmation, active-window or route preflight, and outcome verification"
  ],
  softwareActionsExecuted: false,
  locks
};
writeFileSync(executionAdapterRequestPath, `${JSON.stringify(executionAdapterRequest, null, 2)}\n`, "utf8");

let executionAdapterSelection = null;
if (createExecutionAdapter) {
  const args = ["--goal", goal, "--software", software, "--overlay-packet", overlayPath, "--output-dir", executionAdapterOutputDir];
  if (actionPlanPath) args.push("--action-plan", actionPlanPath);
  for (const adapter of preferredAdapters) args.push("--preferred-adapter", adapter);
  if (capabilityProfile) args.push("--capability-profile", capabilityProfile);
  if (observerQueue) args.push("--observer-queue", observerQueue);
  executionAdapterSelection = runNodeScript("create-existing-software-execution-adapter.mjs", args);
}

const receipt = {
  ok: true,
  format: "transparent_ai_engineering_command_target_confirmation_receipt_v1",
  confirmationId,
  goal,
  software,
  commandText: commandTextFromIntent(commandIntent),
  voiceOrTextControlWorkflow: voiceControlWorkflow?.format ?? "",
  status: "teacher_confirmed_single_target_ready_for_supervised_dry_run",
  selectedCandidateNumber: selectedNumber,
  selectedCandidate,
  candidateCountBeforeConfirmation: candidates.length,
  narrowedOverlayPacket: overlayPath,
  supervisedActionBridgeRequest: bridgeRequestPath,
  existingExecutionAdapterRequest: executionAdapterRequestPath,
  supervisedActionKit: supervisedActionKit?.kitPath ?? "",
  existingExecutionAdapterSelection: executionAdapterSelection?.selectionPath ?? "",
  existingExecutionPackage: executionAdapterSelection?.executionPackagePath ?? "",
  primaryExistingAdapterId: executionAdapterSelection?.primaryAdapterId ?? "",
  targetConfirmationReceiptValidationCommand: receiptValidationCommand,
  nextBridge: "create_supervised_software_action_kit",
  nextExistingAdapterBridge: "create_existing_software_execution_adapter",
  nextValidationRequiredBeforeExecutionApproval: "validate-engineering-command-target-confirmation-receipt.mjs",
  nextAllowedAction:
    "Validate this target-confirmation receipt, review the confirmed single-target overlay, then inspect the supervised action kit and existing execution adapter selection in dry-run mode before any active-window execution.",
  blockedActions: [
    "executing mouse or keyboard events without target-window preflight",
    "using unselected candidate targets",
    "saving reusable rules without teacher review",
    "packaging or releasing as accepted technology"
  ],
  evidence: {
    originalConfirmation: parsed.sourcePath,
    voiceOrTextControlWorkflowLoaded: Boolean(voiceControlWorkflow),
    selectedTargetOnly: true,
    narrowedOverlayAnchorCount: singleTargetOverlay.anchors.length,
    narrowedOverlayStrokeCount: singleTargetOverlay.strokes.length,
    existingExecutionAdapterSelectionCreated: Boolean(executionAdapterSelection),
    targetConfirmationReceiptValidationRequired: true
  },
  locks
};
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(readmePath, [
  "# Confirmed Engineering Command Target",
  "",
  `Goal: ${goal}`,
  `Software: ${software}`,
  `Confirmed target number: ${selectedNumber}`,
  "",
  "This narrows a voice/text engineering command from multiple numbered candidates to exactly one teacher-confirmed target.",
  "",
  "Next:",
  "",
  `1. Review ${basename(overlayPath)} and confirm it contains only the selected target.`,
  `2. Use ${basename(bridgeRequestPath)} with create_supervised_software_action_kit, or inspect the generated action kit if --create-action-kit was used.`,
  `3. Use ${basename(executionAdapterRequestPath)} with create_existing_software_execution_adapter, or inspect the generated adapter selection if --create-execution-adapter was used.`,
  "4. Validate this receipt before building the engineering voice execution approval gate.",
  "5. Keep every runner dry-run first; execute only after route/window preflight, explicit teacher confirmation, rollback, and outcome verification.",
  "",
  `Validation command: ${receiptValidationCommand}`,
  "",
  "Locked defaults: softwareActionsExecuted=false, nativeUniversalExecution=false, ruleEnabled=false, accepted=false, packagingGated=true."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_engineering_command_target_confirmation_result_v1",
  confirmationId,
  receipt: receiptPath,
  teacherReadme: readmePath,
  narrowedOverlayPacket: overlayPath,
  supervisedActionBridgeRequest: bridgeRequestPath,
  existingExecutionAdapterRequest: executionAdapterRequestPath,
  supervisedActionKit: supervisedActionKit?.kitPath ?? "",
  existingExecutionAdapterSelection: executionAdapterSelection?.selectionPath ?? "",
  existingExecutionPackage: executionAdapterSelection?.executionPackagePath ?? "",
  primaryExistingAdapterId: executionAdapterSelection?.primaryAdapterId ?? "",
  targetConfirmationReceiptValidationCommand: receiptValidationCommand,
  selectedCandidateNumber: selectedNumber,
  selectedCandidateId: selectedCandidate.id,
  selectedTargetOnly: true,
  candidateCountBeforeConfirmation: candidates.length,
  narrowedOverlayAnchorCount: singleTargetOverlay.anchors.length,
  narrowedOverlayStrokeCount: singleTargetOverlay.strokes.length,
  nextBridge: "create_supervised_software_action_kit",
  nextExistingAdapterBridge: "create_existing_software_execution_adapter",
  teacherExecutionConfirmationRequired: true,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false,
  reviewLocks: locks
}, null, 2));
