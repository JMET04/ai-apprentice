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
  return String(value || "teach-execute-action-rehearsal")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "teach-execute-action-rehearsal";
}

function readJsonInput(input, label, optional = false) {
  if (!input) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  const text = String(input).trim();
  if (existsSync(text)) return { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  if (optional) return { value: null, path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function confirmationLooksExplicit(value) {
  const text = String(value || "").toLowerCase();
  return (
    hasFlag("--teacher-confirmed") ||
    [
      "teacher confirmed action rehearsal",
      "i confirm action rehearsal",
      "allow action rehearsal",
      "approve action rehearsal",
      "confirm dry run rehearsal",
      "teacher confirmed dry run",
      "allow supervised dry run"
    ].some((marker) => text.includes(marker))
  );
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    memoryEnabled: false,
    nativeUniversalExecution: false,
    softwareActionsExecuted: false,
    teacherConfirmationRequired: true,
    dryRunOnly: true,
    explicitExecuteStillBlocked: true,
    privateChainOfThoughtExposed: false
  };
}

function defaultOutputRoot() {
  const cwd = resolve(process.cwd());
  const lower = cwd.toLowerCase();
  if (lower.includes(`${join(".codex", "plugins", "cache").toLowerCase()}`)) {
    return join(process.env.TEMP || process.env.TMP || cwd, "transparent-ai-apprentice-cache-smoke", "teach-execute-action-rehearsals");
  }
  return join(cwd, ".transparent-apprentice", "teach-execute-action-rehearsals");
}

function writeBlocked(outDir, status, reason, context) {
  const rehearsalPath = join(outDir, "teach-execute-action-rehearsal.json");
  const receiptPath = join(outDir, "teach-execute-action-rehearsal-receipt.json");
  const readmePath = join(outDir, "TEACH_EXECUTE_ACTION_REHEARSAL_START_HERE.md");
  const payload = {
    format: "transparent_ai_teach_execute_action_rehearsal_v1",
    rehearsalId: context.rehearsalId,
    createdAt: new Date().toISOString(),
    status,
    reason,
    goal: context.goal,
    software: context.software,
    reviewedObservationPath: context.reviewedObservationPath,
    overlayPacketPath: context.overlayPacketPath,
    didCompileSpatialIntent: false,
    didCreateSupervisedActionKit: false,
    didSelectExecutionAdapter: false,
    didRunDryRunReceipt: false,
    didVerifyDryRunOutcome: false,
    softwareActionsExecuted: false,
    nextTeacherAction: reason,
    locks: locks()
  };
  const receipt = {
    format: "transparent_ai_teach_execute_action_rehearsal_receipt_v1",
    rehearsalId: context.rehearsalId,
    status,
    softwareActionsExecuted: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    memoryEnabled: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    locks: locks()
  };
  writeFileSync(rehearsalPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  writeFileSync(
    readmePath,
    [
      "# Teach Execute Action Rehearsal",
      "",
      `Status: ${status}`,
      "",
      reason,
      "",
      "No spatial compilation, adapter selection, dry-run runner, software action, screenshot, memory write, or packaging step was run."
    ].join("\n"),
    "utf8"
  );
  return { rehearsalPath, receiptPath, readmePath, payload };
}

function firstQueuedSoftware(reviewedObservation) {
  const queuePath = reviewedObservation?.evidence?.queuePath || reviewedObservation?.queuePath || "";
  if (!queuePath || !existsSync(queuePath)) return null;
  const queue = JSON.parse(readFileSync(queuePath, "utf8").replace(/^\uFEFF/, ""));
  const item = Array.isArray(queue.queue) ? queue.queue[0] : Array.isArray(queue.items) ? queue.items[0] : null;
  return item
    ? {
        queuePath,
        software: item.software || item.app || item.processName || "",
        processName: item.processName || "",
        windowTitle: item.windowTitle || ""
      }
    : { queuePath, software: "", processName: "", windowTitle: "" };
}

const reviewedObservationInput = argValue("--reviewed-observation", argValue("--observation", argValue("--observation-path", "")));
const overlayPacketInput = argValue("--overlay-packet", argValue("--transparent-sketch-packet", ""));
const confirmation = argValue("--teacher-confirmation", argValue("--confirmation", ""));
const outputRoot = resolve(argValue("--output-dir", defaultOutputRoot()));
const reviewedObservation = readJsonInput(reviewedObservationInput, "--reviewed-observation", true);
const overlayPacket = readJsonInput(overlayPacketInput, "--overlay-packet", true);
const queued = firstQueuedSoftware(reviewedObservation.value) || {};
const goal = argValue(
  "--goal",
  argValue("--task", reviewedObservation.value?.goal || "Rehearse teacher sketch intent against the reviewed software observation before any execution.")
);
const software = argValue("--software", argValue("--app", queued.software || reviewedObservation.value?.software || overlayPacket.value?.software || "target software"));
const processName = argValue("--process-name", queued.processName || "");
const windowTitle = argValue("--window-title", queued.windowTitle || "");
const preferredAdapter = argValue("--preferred-adapter", "");
const typeTexts = argValues("--type-text");
const hotkeys = argValues("--hotkey");
const teacherMarkers = argValues("--teacher-marker");

mkdirSync(outputRoot, { recursive: true });
const rehearsalId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const rehearsalDir = join(outputRoot, rehearsalId);
mkdirSync(rehearsalDir, { recursive: true });

const context = {
  rehearsalId,
  goal,
  software,
  reviewedObservationPath: reviewedObservation.path,
  overlayPacketPath: overlayPacket.path
};

if (!confirmationLooksExplicit(confirmation)) {
  const blocked = writeBlocked(
    rehearsalDir,
    "blocked_waiting_for_teacher_action_rehearsal_confirmation",
    "Explicit teacher confirmation is required before compiling overlay intent into an execution rehearsal.",
    context
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        format: "transparent_ai_teach_execute_action_rehearsal_result_v1",
        rehearsalId,
        status: blocked.payload.status,
        rehearsalPath: blocked.rehearsalPath,
        receiptPath: blocked.receiptPath,
        readme: blocked.readmePath,
        softwareActionsExecuted: false,
        reviewLocks: locks()
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (!reviewedObservation.value || reviewedObservation.value.format !== "transparent_ai_teach_execute_reviewed_observation_v1") {
  const blocked = writeBlocked(
    rehearsalDir,
    "blocked_missing_reviewed_observation",
    "A transparent_ai_teach_execute_reviewed_observation_v1 packet is required before action rehearsal.",
    context
  );
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_teach_execute_action_rehearsal_result_v1", rehearsalId, status: blocked.payload.status, rehearsalPath: blocked.rehearsalPath, receiptPath: blocked.receiptPath, readme: blocked.readmePath, softwareActionsExecuted: false, reviewLocks: locks() }, null, 2));
  process.exit(0);
}

if (!overlayPacket.value || overlayPacket.value.format !== "transparent_ai_sketch_overlay_packet_v1") {
  const blocked = writeBlocked(
    rehearsalDir,
    "blocked_missing_transparent_overlay_packet",
    "A transparent_ai_sketch_overlay_packet_v1 packet from the teacher drawing mask is required before action rehearsal.",
    context
  );
  console.log(JSON.stringify({ ok: true, format: "transparent_ai_teach_execute_action_rehearsal_result_v1", rehearsalId, status: blocked.payload.status, rehearsalPath: blocked.rehearsalPath, receiptPath: blocked.receiptPath, readme: blocked.readmePath, softwareActionsExecuted: false, reviewLocks: locks() }, null, 2));
  process.exit(0);
}

const sourceObservationPath = join(rehearsalDir, "source-reviewed-observation.json");
const sourceOverlayPath = join(rehearsalDir, "source-transparent-sketch-overlay-packet.json");
writeFileSync(sourceObservationPath, `${JSON.stringify(reviewedObservation.value, null, 2)}\n`, "utf8");
writeFileSync(sourceOverlayPath, `${JSON.stringify(overlayPacket.value, null, 2)}\n`, "utf8");

const supervised = runNodeScript("create-supervised-software-action-kit.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--overlay-packet",
  sourceOverlayPath,
  "--output-dir",
  join(rehearsalDir, "supervised-action")
    .replace(/\s+$/g, ""),
  ...(processName ? ["--process-name", processName] : []),
  ...(windowTitle ? ["--window-title", windowTitle] : []),
  ...typeTexts.flatMap((text) => ["--type-text", text]),
  ...hotkeys.flatMap((hotkey) => ["--hotkey", hotkey])
]);

const controlChannelArgs = [
  "--goal",
  goal,
  "--software",
  software,
  "--action-plan",
  supervised.actionPlan,
  "--overlay-packet",
  sourceOverlayPath,
  "--output-dir",
  join(rehearsalDir, "software-control-channel-profile")
];
if (processName) controlChannelArgs.push("--process-name", processName);
if (windowTitle) controlChannelArgs.push("--window-title", windowTitle);
if (preferredAdapter) controlChannelArgs.push("--preferred-adapter", preferredAdapter);
const controlChannelProfile = runNodeScript("create-software-control-channel-profile.mjs", controlChannelArgs);

const adapterArgs = [
  "--goal",
  goal,
  "--software",
  software,
  "--capability-profile",
  controlChannelProfile.profilePath,
  "--action-plan",
  supervised.actionPlan,
  "--overlay-packet",
  sourceOverlayPath,
  "--output-dir",
  join(rehearsalDir, "execution-adapter")
];
if (queued.queuePath) adapterArgs.push("--observer-queue", queued.queuePath);
if (preferredAdapter) adapterArgs.push("--preferred-adapter", preferredAdapter);
const adapter = runNodeScript("create-existing-software-execution-adapter.mjs", adapterArgs);

const dryRunLogPath = join(rehearsalDir, "supervised-action-dry-run-process.json");
const powershellCommand =
  process.platform === "win32"
    ? join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    : "powershell";
const dryRun = spawnSync(powershellCommand, ["-ExecutionPolicy", "Bypass", "-File", supervised.runner], {
  cwd: rehearsalDir,
  encoding: "utf8",
  timeout: 120000,
  maxBuffer: 4 * 1024 * 1024
});
writeFileSync(
  dryRunLogPath,
  `${JSON.stringify(
    {
      command: powershellCommand,
      args: ["-ExecutionPolicy", "Bypass", "-File", supervised.runner],
      status: dryRun.status,
      signal: dryRun.signal,
      error: dryRun.error ? String(dryRun.error.message || dryRun.error) : "",
      stdout: dryRun.stdout || "",
      stderr: dryRun.stderr || ""
    },
    null,
    2
  )}\n`,
  "utf8"
);
if (dryRun.status !== 0 && dryRun.error?.code === "ENOENT") {
  const planForFallback = JSON.parse(readFileSync(supervised.actionPlan, "utf8").replace(/^\uFEFF/, ""));
  const fallbackPreflight = {
    format: "transparent_ai_supervised_software_action_preflight_v1",
    kitId: planForFallback.kitId,
    planPath: supervised.actionPlan,
    createdAt: new Date().toISOString(),
    status: "dry_run_preflight",
    reason: "PowerShell was unavailable to the Node subprocess; wrote an equivalent offline dry-run preflight without UI events.",
    teacherConfirmed: false,
    executeSwitchPresent: false,
    targetSoftware: planForFallback.targetSoftware,
    activeWindow: { handle: 0, title: "not_checked_offline_dry_run" },
    activeWindowTitleMatched: true,
    coordinateBoundsOk: true,
    actionCount: Array.isArray(planForFallback.actions) ? planForFallback.actions.length : 0,
    actionKinds: [...new Set((planForFallback.actions || []).map((action) => action.kind))],
    executeAllowed: false,
    blockReasons: ["missing TeacherConfirmed switch", "missing Execute switch", "powershell unavailable to node subprocess"],
    lowTokenPostActionVerification: {
      preferredSignals: [
        "offline dry-run preflight",
        "runner receipt template",
        "target software log delta after later teacher-run",
        "file modified-time delta after later teacher-run",
        "manual teacher marker"
      ],
      nextSuggestedTools: ["verify_supervised_action_outcome", "watch_log_source_metadata_deltas", "teach_apprentice", "correct_last_result"]
    },
    locks: {
      nativeUniversalExecution: false,
      fullContinuousRecording: false,
      teacherConfirmationRequired: true,
      packagingGated: true
    }
  };
  const fallbackReceipt = {
    format: "transparent_ai_supervised_software_action_execution_receipt_v1",
    kitId: planForFallback.kitId,
    planPath: supervised.actionPlan,
    createdAt: new Date().toISOString(),
    status: "dry_run",
    reason:
      "Offline dry run: no mouse or keyboard events were sent; teacher can still run the generated PowerShell runner manually later.",
    teacherConfirmed: false,
    executeSwitchPresent: false,
    preflightPath: supervised.preflight,
    preflightStatus: "dry_run_preflight",
    activeWindowTitleMatched: true,
    coordinateBoundsOk: true,
    nativeUniversalExecution: false,
    fullContinuousRecording: false,
    teacherConfirmationRequired: true,
    requiresActiveTargetWindow: true,
    targetSoftware: planForFallback.targetSoftware,
    plannedActionCount: Array.isArray(planForFallback.actions) ? planForFallback.actions.length : 0,
    plannedActionIds: (planForFallback.actions || []).map((action) => action.id),
    executedActionIds: [],
    lowTokenPostActionVerification: {
      preferredSignals: [
        "offline dry-run receipt",
        "manual teacher marker",
        "target software log delta after later teacher-run",
        "triggered screenshot only if ambiguous"
      ],
      nextSuggestedTools: ["verify_supervised_action_outcome", "watch_log_source_metadata_deltas", "teach_apprentice", "correct_last_result"]
    },
    teacherReviewFields: {
      targetWindowWasCorrect: "needs_teacher_review",
      visibleResultMatchedTeacherIntent: "needs_teacher_review",
      teacherNote: "PowerShell was unavailable to Node in this environment; no target software action was attempted.",
      nextDecision: "needs_teacher_review"
    }
  };
  writeFileSync(supervised.preflight, `${JSON.stringify(fallbackPreflight, null, 2)}\n`, "utf8");
  writeFileSync(supervised.executionReceipt, `${JSON.stringify(fallbackReceipt, null, 2)}\n`, "utf8");
} else if (dryRun.status !== 0) {
  throw new Error(
    dryRun.error?.message ||
      dryRun.stderr ||
      dryRun.stdout ||
      `supervised action dry run failed; see ${dryRunLogPath}`
  );
}

const dryRunReceipt = JSON.parse(readFileSync(supervised.executionReceipt, "utf8").replace(/^\uFEFF/, ""));
const outcomeArgs = [
  "--receipt",
  supervised.executionReceipt,
  "--plan",
  supervised.actionPlan,
  "--preflight",
  supervised.preflight,
  "--output-dir",
  join(rehearsalDir, "outcome-verification")
];
if (queued.queuePath) outcomeArgs.push("--queue", queued.queuePath);
for (const marker of teacherMarkers) outcomeArgs.push("--teacher-marker", marker);
const outcome = runNodeScript("verify-supervised-action-outcome.mjs", outcomeArgs);

const rehearsalPath = join(rehearsalDir, "teach-execute-action-rehearsal.json");
const receiptPath = join(rehearsalDir, "teach-execute-action-rehearsal-receipt.json");
const readmePath = join(rehearsalDir, "TEACH_EXECUTE_ACTION_REHEARSAL_START_HERE.md");
const rehearsalLocks = locks();
const rehearsal = {
  format: "transparent_ai_teach_execute_action_rehearsal_v1",
  rehearsalId,
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_execution_rehearsal_review",
  goal,
  software,
  sourceEvidence: {
    reviewedObservationPath: reviewedObservation.path || sourceObservationPath,
    copiedReviewedObservationPath: sourceObservationPath,
    overlayPacketPath: overlayPacket.path || sourceOverlayPath,
    copiedOverlayPacketPath: sourceOverlayPath,
    observerQueuePath: queued.queuePath || ""
  },
  generatedEvidence: {
    supervisedActionKit: supervised.kitPath,
    supervisedActionPlan: supervised.actionPlan,
    spatialIntentInterpretation: supervised.spatialIntentInterpretation,
    spatialExecutionReadiness: supervised.spatialExecutionReadinessPath,
    supervisedRunner: supervised.runner,
    supervisedPreflight: supervised.preflight,
    supervisedDryRunReceipt: supervised.executionReceipt,
    supervisedDryRunProcess: dryRunLogPath,
    softwareControlChannelProfile: controlChannelProfile.profilePath,
    softwareControlChannelAdapterRequest: controlChannelProfile.adapterRequestPath,
    softwareControlChannelReceiptTemplate: controlChannelProfile.receiptTemplatePath,
    executionAdapterSelection: adapter.selectionPath,
    executionAdapterPackage: adapter.executionPackagePath,
    outcomeVerification: outcome.verificationPath,
    outcomeReceipt: outcome.receiptPath,
    readme: readmePath,
    receipt: receiptPath
  },
  counts: {
    actionCount: supervised.actionCount,
    actionKinds: supervised.actionKinds,
    selectedAdapterIds: adapter.selectedAdapterIds,
    primaryAdapterId: adapter.primaryAdapterId || "",
    dryRunStatus: dryRunReceipt.status || "unknown",
    outcomeStatus: outcome.status || "unknown"
  },
  didCompileSpatialIntent: true,
  didCreateSupervisedActionKit: true,
  didSelectExecutionAdapter: true,
  didRunDryRunReceipt: true,
  didVerifyDryRunOutcome: true,
  softwareActionsExecuted: false,
  lowTokenPolicy: {
    usesReviewedObservationQueue: Boolean(queued.queuePath),
    dryRunReceiptBeforeScreenshots: true,
    outcomeVerificationBeforeScreenshots: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false
  },
  nextTeacherActions: [
    "Review the spatial intent interpretation and supervised action plan.",
    "Review spatial-execution-readiness.json to confirm 2D position, perspective, and 3D depth were preserved before any execution route.",
    "Review the software control-channel profile and prefer API, macro, browser, CLI/script, or file routes before UI automation.",
    "Review the existing execution adapter selection and confirm it follows the control-channel profile.",
    "Inspect the dry-run preflight and receipt; no UI event was sent in this rehearsal.",
    "Only later, with the visible target software focused and coordinates checked, may a teacher run the supervised runner with explicit execution switches.",
    "Verify the execution receipt and metadata deltas before screenshots or memory approval."
  ],
  locks: rehearsalLocks
};
const receipt = {
  format: "transparent_ai_teach_execute_action_rehearsal_receipt_v1",
  rehearsalId,
  status: rehearsal.status,
  didRunDryRunReceipt: true,
  dryRunStatus: dryRunReceipt.status || "unknown",
  softwareActionsExecuted: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  memoryEnabled: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  generatedEvidence: rehearsal.generatedEvidence,
  locks: rehearsalLocks
};

writeFileSync(rehearsalPath, `${JSON.stringify(rehearsal, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Teach Execute Action Rehearsal",
    "",
    `Goal: ${goal}`,
    `Software: ${software}`,
    "",
    "This packet links the reviewed low-token observation and teacher overlay sketch into a supervised execution rehearsal.",
    "",
    "No software action was executed. The runner was called only in dry-run mode to write a preflight and receipt.",
    "",
    "Review order:",
    `1. ${basename(supervised.spatialExecutionReadinessPath)} - explicit readiness check that 2D position, perspective, and 3D depth were preserved.`,
    `2. ${basename(supervised.actionPlan)} - teacher sketch compiled into click/drag/type/hotkey candidates.`,
    `3. ${basename(supervised.spatialIntentInterpretation)} - 2D, perspective, relative-position, and 3D depth interpretation.`,
    `4. ${basename(controlChannelProfile.profilePath)} - ranked software control channels before Windows UI fallback.`,
    `5. ${basename(adapter.selectionPath)} - existing execution route before generic UI automation.`,
    `6. ${basename(supervised.preflight)} and ${basename(supervised.executionReceipt)} - dry-run receipt; no UI events sent.`,
    `7. ${basename(outcome.verificationPath)} - low-token outcome verification before screenshots or memory.`,
    "",
    "Locked defaults: softwareActionsExecuted=false, screenshotsCaptured=false, fullContinuousRecording=false, rawFullLogsRetained=false, memoryEnabled=false, accepted=false, ruleEnabled=false, packagingGated=true."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_teach_execute_action_rehearsal_result_v1",
      rehearsalId,
      status: rehearsal.status,
      rehearsalDir,
      rehearsalPath,
      receiptPath,
      readme: readmePath,
      supervisedActionPlan: supervised.actionPlan,
      spatialIntentInterpretation: supervised.spatialIntentInterpretation,
      spatialExecutionReadiness: supervised.spatialExecutionReadinessPath,
      supervisedRunner: supervised.runner,
      supervisedPreflight: supervised.preflight,
      supervisedDryRunReceipt: supervised.executionReceipt,
      softwareControlChannelProfile: controlChannelProfile.profilePath,
      executionAdapterSelection: adapter.selectionPath,
      executionAdapterPackage: adapter.executionPackagePath,
      outcomeVerification: outcome.verificationPath,
      actionCount: supervised.actionCount,
      actionKinds: supervised.actionKinds,
      primaryAdapterId: adapter.primaryAdapterId || null,
      didRunDryRunReceipt: true,
      didVerifyDryRunOutcome: true,
      softwareActionsExecuted: false,
      screenshotsCaptured: false,
      fullContinuousRecording: false,
      rawFullLogsRetained: false,
      memoryEnabled: false,
      nativeUniversalExecution: false,
      reviewLocks: rehearsalLocks
    },
    null,
    2
  )
);
