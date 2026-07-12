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

function slugify(value) {
  return String(value || "teach-execute-safe-start")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "teach-execute-safe-start";
}

function readOptionalJson(input) {
  if (!input) return null;
  const text = String(input).trim();
  if (!text) return null;
  if (existsSync(text)) return JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, ""));
  if (text.startsWith("{")) return JSON.parse(text);
  return null;
}

function runScript(scriptName, args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  return JSON.parse(result.stdout);
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    screenshotsCaptured: false,
    nativeUniversalExecution: false,
    softwareActionsExecuted: false,
    scheduledTaskRegistered: false,
    memoryEnabled: false,
    teacherConfirmationRequired: true,
    privateChainOfThoughtExposed: false
  };
}

function compactResult(result) {
  const usefulKeys = [
    "format",
    "profilePath",
    "routePath",
    "bootstrapPath",
    "teacherReviewTemplate",
    "receiptPath",
    "readme",
    "teacherReadme",
    "kitPath",
    "browserOverlay",
    "powershellOverlay",
    "packetSchema",
    "samplePacket",
    "selectionPath",
    "executionPackagePath",
    "executionPackageReceiptTemplatePath",
    "adapterRequestPath",
    "receiptTemplatePath",
    "readmePath",
    "adapterSelectionPath",
    "primaryAdapterId",
    "selectedAdapterIds",
    "recommendedAdapterIds"
  ];
  return Object.fromEntries(usefulKeys.filter((key) => result[key] !== undefined).map((key) => [key, result[key]]));
}

const runbookInput = argValue("--runbook", argValue("--runbook-path", ""));
const providedRunbook = readOptionalJson(runbookInput);
const goal =
  argValue("--goal", providedRunbook?.goal || "Safely start an all-software teach-execute learning loop without executing software.");
const software = argValue("--software", argValue("--app", providedRunbook?.software || "arbitrary local software"));
const teacherStyle = argValue(
  "--teacher-style",
  argValue(
    "--style",
    providedRunbook?.teacherAdaptation?.teacherStyle ||
      "mixed: logs, transparent overlay sketches, 2D/perspective/3D depth demos, corrections, and supervised execution receipts"
  )
);
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "teach-execute-safe-starts")));
mkdirSync(outputRoot, { recursive: true });

const safeStartId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const safeStartDir = join(outputRoot, safeStartId);
mkdirSync(safeStartDir, { recursive: true });

const runbookResult = providedRunbook
  ? null
  : runScript(
      "create-teach-execute-learning-loop.mjs",
      ["--goal", goal, "--software", software, "--teacher-style", teacherStyle, "--output-dir", join(safeStartDir, "generated-runbook")],
      process.cwd()
    );
const runbookPath = runbookInput && existsSync(runbookInput) ? resolve(runbookInput) : runbookResult?.runbookPath || "";
const runbook = providedRunbook || (runbookPath ? JSON.parse(readFileSync(runbookPath, "utf8").replace(/^\uFEFF/, "")) : null);

if (runbook?.format && runbook.format !== "transparent_ai_teach_execute_learning_loop_v1") {
  throw new Error(`Unsupported runbook format: ${runbook.format}`);
}

const stageResults = [];
function addStage(stageId, scriptName, args) {
  const result = runScript(scriptName, args, process.cwd());
  stageResults.push({
    stageId,
    scriptName,
    status: "generated_review_only",
    result: compactResult(result),
    locks: locks()
  });
  return result;
}

const teacherProfile = addStage("teacher_method_profile", "create-teacher-learning-method-profile.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--teacher-style",
  teacherStyle,
  "--teacher-message",
  "Safe start for a teach-execute runbook: infer teacher method before observing software or interpreting sketches.",
  "--output-dir",
  join(safeStartDir, "teacher-method-profile")
]);

const observerBootstrap = addStage("all_software_observer_bootstrap", "create-all-software-observer-bootstrap.mjs", [
  "--goal",
  goal,
  "--output-dir",
  join(safeStartDir, "all-software-observer-bootstrap"),
  "--max-processes",
  "40",
  "--max-installed",
  "80",
  "--max-candidates",
  "12",
  "--max-files-per-candidate",
  "3",
  "--max-log-files-per-candidate",
  "3",
  "--max-watch-items",
  "4",
  "--max-logs-per-item",
  "2",
  "--max-tail-lines",
  "40",
  "--max-tail-bytes",
  "32768",
  "--no-initialize-watch"
]);

const overlayKit = addStage("transparent_overlay", "create-transparent-sketch-overlay-kit.mjs", [
  "--goal",
  "Let the teacher draw 2D, perspective, and 3D depth intent before any software action.",
  "--software",
  software,
  "--mode",
  "2d_3d",
  "--output-dir",
  join(safeStartDir, "transparent-overlay-kit")
]);

const controlChannelProfile = addStage("software_control_channel_profile", "create-software-control-channel-profile.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--overlay-packet",
  overlayKit.samplePacket,
  "--preferred-adapter",
  "existing-file-import-export",
  "--preferred-adapter",
  "existing-cli-or-script",
  "--preferred-adapter",
  "existing-browser-automation",
  "--output-dir",
  join(safeStartDir, "software-control-channel-profile")
]);

const executionAdapter = addStage("execution_adapter_selection", "create-existing-software-execution-adapter.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--capability-profile",
  controlChannelProfile.profilePath,
  "--overlay-packet",
  overlayKit.samplePacket,
  "--preferred-adapter",
  "existing-file-import-export",
  "--preferred-adapter",
  "existing-cli-or-script",
  "--preferred-adapter",
  "existing-browser-automation",
  "--output-dir",
  join(safeStartDir, "existing-execution-adapter")
]);

const safeStartPath = join(safeStartDir, "teach-execute-safe-start.json");
const receiptPath = join(safeStartDir, "teach-execute-safe-start-receipt.json");
const blockedActionsPath = join(safeStartDir, "blocked-actions.json");
const readmePath = join(safeStartDir, "TEACH_EXECUTE_SAFE_START_HERE.md");
const safeLocks = locks();

const blockedActions = {
  format: "transparent_ai_teach_execute_safe_start_blocked_actions_v1",
  safeStartId,
  blocked: [
    "do not execute generated runners",
    "do not register scheduled observer task",
    "do not capture screenshots unless a reviewed trigger is ambiguous",
    "do not read full logs or retain raw full logs",
    "do not save memory or enable rules",
    "do not claim universal native execution",
    "do not unlock packaging or release"
  ],
  allowedNow: [
    "review teacher-learning-method-profile.json",
    "review all-software observer bootstrap and exclusion template",
    "open transparent overlay kit and export a sketch packet",
    "review software control-channel profile and confirm whether API/CLI/browser/file routes are available before UI fallback",
    "review existing execution adapter selection",
    "create or keep rollback point before any next direction change"
  ],
  locks: safeLocks
};

const safeStart = {
  format: "transparent_ai_teach_execute_safe_start_v1",
  safeStartId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  teacherStyle,
  sourceRunbook: runbook
    ? {
        format: runbook.format,
        loopId: runbook.loopId || "",
        runbookPath,
        stageCount: Array.isArray(runbook.stages) ? runbook.stages.length : 0
      }
    : null,
  principle:
    "Turn the full teach-execute runbook into first reviewable materials using existing tools, without executing software actions or approving memory.",
  stageResults,
  evidence: {
    teacherMethodProfile: teacherProfile.profilePath,
    teacherMethodRoute: teacherProfile.routePath,
    observerBootstrap: observerBootstrap.bootstrapPath,
    observerReviewTemplate: observerBootstrap.teacherReviewTemplate,
    transparentOverlayManifest: overlayKit.kitPath,
    transparentOverlayReadme: overlayKit.teacherReadme,
    transparentOverlayBrowser: overlayKit.browserOverlay,
    transparentOverlayPowerShell: overlayKit.powershellOverlay,
    sampleSketchPacket: overlayKit.samplePacket,
    softwareControlChannelProfile: controlChannelProfile.profilePath,
    softwareControlChannelAdapterRequest: controlChannelProfile.adapterRequestPath,
    softwareControlChannelReceiptTemplate: controlChannelProfile.receiptTemplatePath,
    executionAdapterSelection: executionAdapter.selectionPath,
    executionPackage: executionAdapter.executionPackagePath,
    executionPackageReceiptTemplate: executionAdapter.executionPackageReceiptTemplatePath,
    blockedActions: blockedActionsPath,
    receipt: receiptPath,
    readme: readmePath
  },
  lowTokenStartPolicy: {
    fullContinuousRecording: false,
    screenshotsByDefault: false,
    rawFullLogsRetained: false,
    defaultObservationOrder: [
      "teacher method profile",
      "all-software inventory/bootstrap commands and teacher exclusions",
      "metadata/log-root queue review",
      "transparent overlay sketch packet only when visual intent matters",
      "software control-channel profile before Windows UI fallback",
      "existing execution adapter dry-run package",
      "teacher confirmation before any runner executes"
    ]
  },
  nextTeacherActions: [
    "Review TEACH_EXECUTE_SAFE_START_HERE.md.",
    "Edit or approve the teacher method profile.",
    "Exclude private software before any inventory probe or queue run.",
    "Use the transparent overlay kit for a 2D, perspective, or 3D depth sketch if visual intent matters.",
    "Review the software control-channel profile before selecting any execution adapter.",
    "Review the existing execution adapter dry-run package; do not run it with execute flags yet."
  ],
  locks: safeLocks
};

const receipt = {
  format: "transparent_ai_teach_execute_safe_start_receipt_v1",
  safeStartId,
  status: "waiting_for_teacher_review",
  generatedReviewOnlyMaterials: true,
  stageCount: stageResults.length,
  softwareActionsExecuted: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  scheduledTaskRegistered: false,
  memoryEnabled: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  evidence: safeStart.evidence,
  locks: safeLocks
};

writeFileSync(blockedActionsPath, `${JSON.stringify(blockedActions, null, 2)}\n`, "utf8");
writeFileSync(safeStartPath, `${JSON.stringify(safeStart, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Teach Execute Safe Start",
    "",
    `Goal: ${goal}`,
    `Software: ${software}`,
    "",
    "This packet is the safe first run for the full teach-execute loop. It generates reviewable materials with existing tools, but it does not execute software, register schedules, capture screenshots, read full logs, save memory, approve rules, or unlock packaging.",
    "",
    "Generated review-only materials:",
    `- ${basename(teacherProfile.profilePath)}: teacher method profile`,
    `- ${basename(observerBootstrap.bootstrapPath)}: all-software observer bootstrap and next commands`,
    `- ${basename(overlayKit.kitPath)}: transparent drawing mask kit for 2D, perspective, and 3D depth sketches`,
    `- ${basename(controlChannelProfile.profilePath)}: software control-channel profile before execution adapter selection`,
    `- ${basename(executionAdapter.selectionPath)}: existing execution adapter selection and dry-run package`,
    "",
    "Teacher review order:",
    ...safeStart.nextTeacherActions.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Locked defaults: accepted=false, ruleEnabled=false, packagingGated=true, fullContinuousRecording=false, screenshotsCaptured=false, softwareActionsExecuted=false, scheduledTaskRegistered=false, nativeUniversalExecution=false."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_teach_execute_safe_start_result_v1",
      safeStartId,
      safeStartDir,
      safeStartPath,
      readme: readmePath,
      receiptPath,
      blockedActionsPath,
      stageCount: stageResults.length,
      stageIds: stageResults.map((stage) => stage.stageId),
      teacherMethodProfile: teacherProfile.profilePath,
      observerBootstrap: observerBootstrap.bootstrapPath,
      transparentOverlayKit: overlayKit.kitPath,
      softwareControlChannelProfile: controlChannelProfile.profilePath,
      executionAdapterSelection: executionAdapter.selectionPath,
      softwareActionsExecuted: false,
      screenshotsCaptured: false,
      fullContinuousRecording: false,
      rawFullLogsRetained: false,
      scheduledTaskRegistered: false,
      nativeUniversalExecution: false,
      reviewLocks: safeLocks
    },
    null,
    2
  )
);
