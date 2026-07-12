#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const smokeBase = resolve(
  argValue("--output-dir", join(tmpdir(), "transparent-ai-apprentice-smoke", "real-local-full-goal-integrated-cycle"))
);
const smokeRoot = join(smokeBase, String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowerShell(args, cwd = smokeRoot) {
  return spawnSync("powershell", ["-ExecutionPolicy", "Bypass", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function firstCandidate(inventory) {
  const candidates = Array.isArray(inventory?.softwareCandidates) ? inventory.softwareCandidates : [];
  return candidates.find((row) => row.windowTitle || row.processName) || candidates[0] || null;
}

function candidateName(candidate) {
  return String(candidate?.software || candidate?.processName || "real local software");
}

const teacherMessage =
  "I prefer to draw first on a transparent mask, then watch log metadata changes, then let you ask only when the rule boundary or execution target is unclear.";
const goal =
  "Prove the full objective as one review-only loop: adapt to teacher method, learn from all local software with low tokens, understand transparent 2D/perspective/3D sketch intent, confirm numbered targets, and enter supervised execution gates.";

const teacherProfileResult = runNodeScript("create-teacher-learning-method-profile.mjs", [
  "--goal",
  goal,
  "--software",
  "real local software",
  "--teacher-message",
  teacherMessage,
  "--teacher-style",
  "transparent overlay sketch, software log metadata, voice or typed correction, fewer questions",
  "--evidence-preference",
  "metadata first, overlay second, receipt before learning",
  "--preferred-tool",
  "draw.io or Excalidraw",
  "--output-dir",
  join(smokeRoot, "teacher-method-profile")
]);
const teacherProfile = readJson(teacherProfileResult.profilePath);

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  goal,
  "--max-processes",
  "8",
  "--max-installed",
  "8",
  "--max-log-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "real-inventory-kit")
]);
const inventoryPath = join(smokeRoot, "real-local-software-observer-inventory.json");
const inventoryProbe = runPowerShell([
  "-File",
  inventoryKit.readOnlyProbe,
  "-OutputPath",
  inventoryPath,
  "-MaxProcesses",
  "8",
  "-MaxInstalled",
  "8",
  "-MaxLogFilesPerCandidate",
  "1"
]);
const inventory = existsSync(inventoryPath) ? readJson(inventoryPath) : null;
const realCandidate = firstCandidate(inventory);
if (!realCandidate) throw new Error("Real local inventory returned no candidates.");
const software = candidateName(realCandidate);
const processName = String(realCandidate.processName || "");
const windowTitle = String(realCandidate.windowTitle || "");

const realQueue = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--max-candidates",
  "6",
  "--max-files-per-candidate",
  "1",
  "--max-depth",
  "0",
  "--max-entries-per-dir",
  "40",
  "--output-dir",
  join(smokeRoot, "real-observer-queue")
]);
const realQueueJson = readJson(realQueue.queuePath);

const controlledLog = join(smokeRoot, "controlled-full-goal-learning.log");
writeFileSync(controlledLog, "startup complete\n", "utf8");
const controlledQueuePath = join(smokeRoot, "controlled-full-goal-learning-queue.json");
writeFileSync(
  controlledQueuePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_observer_queue_v1",
      queueId: "real-local-full-goal-controlled-learning",
      sourceInventoryPath: inventoryPath,
      queue: [
        {
          queueItemId: "real-local-full-goal-controlled-candidate",
          software,
          processName,
          windowTitle,
          score: 0.94,
          recentLogCandidates: [{ path: controlledLog, source: "controlled_full_goal_learning_delta" }],
          windowsEventLogs: ["Application", "System"]
        }
      ],
      locks: {
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        fullContinuousRecording: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  ),
  "utf8"
);
const learningStateDir = join(smokeRoot, "controlled-learning-state");
const learningBaseline = runNodeScript("run-all-software-low-token-learning-cycle.mjs", [
  "--queue",
  controlledQueuePath,
  "--state-dir",
  learningStateDir,
  "--output-dir",
  join(smokeRoot, "controlled-learning-baseline"),
  "--cycles",
  "1",
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "12"
]);
appendFileSync(controlledLog, "ERROR teacher-reviewed target changed after sketch and voice confirmation\n", "utf8");
const learningChanged = runNodeScript("run-all-software-low-token-learning-cycle.mjs", [
  "--queue",
  controlledQueuePath,
  "--state-dir",
  learningStateDir,
  "--output-dir",
  join(smokeRoot, "controlled-learning-changed"),
  "--cycles",
  "2",
  "--interval-ms",
  "0",
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "12",
  "--max-learning-items",
  "1",
  "--teacher-marker",
  "teacher says this changed signal is reusable only after target confirmation"
]);
const learningChangedJson = readJson(learningChanged.learningCyclePath);
const compactLearning = readJson(learningChangedJson.learningRuns[0].compactLearningEventsPath);

const voiceSession = runNodeScript("create-engineering-voice-control-session.mjs", [
  "--goal",
  `Let a non-expert say or type where to act in ${software}, then confirm a numbered target before execution.`,
  "--software",
  software,
  "--process-name",
  processName,
  "--window-title",
  windowTitle,
  "--voice-transcript",
  "Put number one on the deeper target pocket and wait for my confirmation.",
  "--command",
  "Put number one on the deeper target pocket and wait for my confirmation.",
  "--candidate",
  "deeper-target-pocket|deeper target pocket|0.72|0.32|0.42|voice command and teacher sketch both point to the deeper pocket",
  "--candidate",
  "near-side-reference|near side reference|0.25|0.62|0.08|alternate if teacher meant the near-side reference",
  "--no-port-scan",
  "--max-files",
  "8",
  "--max-depth",
  "0",
  "--max-registry-items",
  "0",
  "--preferred-adapter",
  "existing-cli-or-script",
  "--output-dir",
  join(smokeRoot, "voice-numbered-session")
]);
const voiceSessionJson = readJson(voiceSession.sessionPath);
const voiceTargetConfirmation = readJson(voiceSession.targetConfirmation);

const overlayPacket = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  software,
  goal,
  overlayMode: "full_goal_transparent_mask_2d_perspective_3d",
  coordinateSpace: {
    origin: "top_left_screen_or_screenshot",
    units: "normalized_0_to_1",
    supports2D: true,
    supports3DDepthHints: true,
    supportsPerspectiveRelationships: true
  },
  anchors: [
    { id: "near-source", type: "teacher_marked_region", label: "near source face", box: [0.18, 0.58, 0.31, 0.72] },
    { id: "deeper-target-pocket", type: "teacher_marked_region", label: "deeper target pocket", box: [0.63, 0.25, 0.82, 0.45] }
  ],
  strokes: [
    {
      id: "select-source-in-2d",
      mode: "screen_2d",
      semanticLabel: "select source on 2D plane",
      targetAnchorId: "near-source",
      points: [
        { x: 0.24, y: 0.65, t: 0, zHint: 0.02, planeId: "screen" },
        { x: 0.25, y: 0.65, t: 20, zHint: 0.02, planeId: "screen" }
      ]
    },
    {
      id: "move-through-perspective",
      mode: "perspective_grid",
      semanticLabel: "move through perspective toward deeper target pocket",
      targetAnchorId: "deeper-target-pocket",
      points: [
        { x: 0.25, y: 0.65, t: 0, zHint: 0.03, planeId: "screen" },
        { x: 0.72, y: 0.35, t: 120, zHint: 0.3, planeId: "perspective_plane" }
      ]
    },
    {
      id: "push-deeper-on-depth-axis",
      mode: "depth_axis_3d",
      semanticLabel: "push the target deeper on the depth axis",
      targetAnchorId: "deeper-target-pocket",
      points: [
        { x: 0.72, y: 0.43, t: 0, zHint: 0.12, planeId: "old_depth" },
        { x: 0.72, y: 0.29, t: 100, zHint: 0.5, planeId: "deeper_plane" }
      ]
    }
  ],
  spatialIntent: {
    relationships: [
      { subject: "move-through-perspective", relation: "perspective_to", object: "deeper-target-pocket" },
      { subject: "push-deeper-on-depth-axis", relation: "farther_than", object: "near-source" }
    ],
    perspectiveCues: [
      { strokeId: "move-through-perspective", cue: "perspective_grid" },
      { strokeId: "push-deeper-on-depth-axis", cue: "depth_axis_3d" }
    ],
    inferredTeacherIntent:
      "review_only: teacher uses transparent 2D, perspective, and 3D depth sketch to indicate where the software action should happen"
  },
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    softwareActionsExecuted: false
  }
};
const overlayPacketPath = join(smokeRoot, "full-goal-transparent-overlay-packet.json");
writeFileSync(overlayPacketPath, `${JSON.stringify(overlayPacket, null, 2)}\n`, "utf8");

const spatialIntent = runNodeScript("interpret-transparent-sketch-spatial-intent.mjs", [
  "--overlay-packet",
  overlayPacketPath,
  "--output-dir",
  join(smokeRoot, "spatial-intent")
]);
const spatialIntentJson = readJson(spatialIntent.interpretationPath);

const spatialTarget = runNodeScript("create-spatial-target-confirmation-kit.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--overlay-packet",
  overlayPacketPath,
  "--spatial-intent",
  spatialIntent.interpretationPath,
  "--command",
  "Act on the deeper target pocket after checking 2D position, perspective, and depth.",
  "--max-candidates",
  "6",
  "--output-dir",
  join(smokeRoot, "spatial-target-confirmation")
]);
const spatialTargetJson = readJson(spatialTarget.targetConfirmation);
const selectedSpatialTarget =
  spatialTargetJson.candidates.find((candidate) => /deeper|target|pocket|depth/i.test(`${candidate.id} ${candidate.label} ${candidate.reason}`)) ||
  spatialTargetJson.candidates[0];
if (!selectedSpatialTarget) throw new Error("No spatial target candidates were generated.");

const controlProfilePath = join(smokeRoot, "full-goal-control-channel-profile.json");
writeFileSync(
  controlProfilePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_control_channel_profile_v1",
      goal,
      software,
      principle: "Prefer reviewed existing control channels before supervised UI automation.",
      channels: [
        {
          adapterId: "existing-cli-or-script",
          label: "teacher-reviewed script route for full-goal smoke",
          score: 30,
          evidence: ["real local software context", "voice target candidates", "transparent spatial sketch"],
          requiredEvidenceBeforeExecute: ["reviewed command manifest", "post-action checkpoint"],
          blockers: []
        },
        {
          adapterId: "existing-windows-ui-automation",
          label: "supervised UI fallback",
          score: 8,
          evidence: ["2D/perspective/3D overlay can become preflight actions"],
          requiredEvidenceBeforeExecute: ["target window title", "coordinate preflight", "spatial readiness confirmation"],
          blockers: ["use only if structured route is unavailable"]
        }
      ],
      recommendedRoute: {
        primaryAdapterId: "existing-cli-or-script",
        recommendedAdapters: ["existing-cli-or-script", "existing-windows-ui-automation"],
        dryRunFirst: true,
        teacherConfirmationRequired: true
      },
      locks: { accepted: false, ruleEnabled: false, packagingGated: true, softwareActionsExecuted: false, nativeUniversalExecution: false }
    },
    null,
    2
  ),
  "utf8"
);

const confirmedTarget = runNodeScript("confirm-engineering-command-target.mjs", [
  "--confirmation",
  spatialTarget.targetConfirmation,
  "--selected-number",
  String(selectedSpatialTarget.number),
  "--goal",
  goal,
  "--software",
  software,
  "--process-name",
  processName,
  "--window-title",
  windowTitle,
  "--create-action-kit",
  "--create-execution-adapter",
  "--preferred-adapter",
  "existing-cli-or-script",
  "--capability-profile",
  controlProfilePath,
  "--output-dir",
  join(smokeRoot, "confirmed-spatial-target"),
  "--action-output-dir",
  join(smokeRoot, "confirmed-spatial-target", "supervised-action-kits"),
  "--execution-adapter-output-dir",
  join(smokeRoot, "confirmed-spatial-target", "execution-adapter")
]);
const confirmedReceipt = readJson(confirmedTarget.receipt);

const safeStart = runNodeScript("start-teach-execute-safe-run.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--teacher-style",
  "transparent overlay sketch, real local log metadata, voice target confirmation",
  "--output-dir",
  join(smokeRoot, "safe-start")
]);
const safeStartJson = readJson(safeStart.safeStartPath);

const reviewedObservation = runNodeScript("start-teach-execute-reviewed-observation.mjs", [
  "--safe-start",
  safeStart.safeStartPath,
  "--teacher-confirmed",
  "--teacher-confirmation",
  "teacher confirmed read-only observation",
  "--goal",
  goal,
  "--software",
  software,
  "--max-processes",
  "6",
  "--max-installed",
  "6",
  "--max-log-files-per-candidate",
  "1",
  "--max-candidates",
  "4",
  "--max-files-per-candidate",
  "1",
  "--max-watch-items",
  "2",
  "--max-logs-per-item",
  "1",
  "--max-tail-lines",
  "12",
  "--max-tail-bytes",
  "512",
  "--output-dir",
  join(smokeRoot, "reviewed-observation")
]);
const reviewedObservationJson = readJson(reviewedObservation.observationPath);

const actionRehearsal = runNodeScript("start-teach-execute-action-rehearsal.mjs", [
  "--reviewed-observation",
  reviewedObservation.observationPath,
  "--overlay-packet",
  overlayPacketPath,
  "--teacher-confirmed",
  "--teacher-confirmation",
  "teacher confirmed action rehearsal",
  "--goal",
  goal,
  "--software",
  software,
  "--process-name",
  processName,
  "--window-title",
  windowTitle,
  "--preferred-adapter",
  "existing-cli-or-script",
  "--output-dir",
  join(smokeRoot, "action-rehearsal")
]);
const actionRehearsalJson = readJson(actionRehearsal.rehearsalPath);

const supervisedGateDryRun = runNodeScript("start-teach-execute-supervised-execution.mjs", [
  "--action-rehearsal",
  actionRehearsal.rehearsalPath,
  "--teacher-confirmed",
  "--teacher-confirmation",
  "teacher confirmed supervised execution",
  "--goal",
  goal,
  "--software",
  software,
  "--output-dir",
  join(smokeRoot, "supervised-execution-dry-run")
]);
const supervisedGateJson = readJson(supervisedGateDryRun.executionPath);

const executeBlocked = runNodeScript("start-teach-execute-supervised-execution.mjs", [
  "--action-rehearsal",
  actionRehearsal.rehearsalPath,
  "--teacher-confirmed",
  "--teacher-confirmation",
  "teacher confirmed supervised execution",
  "--execute",
  "--goal",
  goal,
  "--software",
  software,
  "--output-dir",
  join(smokeRoot, "supervised-execution-blocked")
]);

const checks = [
  {
    name: "Teacher method profile adapts to overlay-first low-token teaching style",
    pass:
      teacherProfile.format === "transparent_ai_teacher_learning_method_profile_v1" &&
      teacherProfile.preferredTeachingModes.some((mode) => mode.mode === "transparent_overlay_sketch") &&
      teacherProfile.preferredTeachingModes.some((mode) => mode.mode === "software_log_deltas") &&
      teacherProfile.nextSuggestedTools.includes("create_transparent_sketch_overlay_kit") &&
      teacherProfile.nextSuggestedTools.includes("watch_log_source_metadata_deltas") &&
      teacherProfile.locks.fullContinuousRecording === false,
    evidence: teacherProfileResult.profilePath
  },
  {
    name: "Real local all-software inventory and queue are created without log contents or screenshots",
    pass:
      inventoryProbe.status === 0 &&
      inventory?.format === "transparent_ai_software_observer_inventory_v1" &&
      inventory.softwareCandidates.length > 0 &&
      realQueueJson.format === "transparent_ai_software_observer_queue_v1" &&
      realQueueJson.queue.length > 0 &&
      realQueueJson.boundedScan.fullLogsRead === false &&
      realQueueJson.boundedScan.screenshotsCaptured === false,
    evidence: realQueue.queuePath
  },
  {
    name: "Low-token learning uses metadata baseline then compact changed signal",
    pass:
      learningBaseline.status === "baseline_initialized_waiting_for_next_cycle" &&
      learningBaseline.tailReadSkippedByMetadataGate >= 1 &&
      learningBaseline.compactLearningEvents === 0 &&
      learningChanged.status === "learning_events_waiting_for_teacher_review" &&
      learningChanged.changedItems === 1 &&
      learningChanged.compactLearningEvents > 0 &&
      compactLearning.reviewLocks.accepted === false,
    evidence: learningChangedJson.learningRuns[0].compactLearningEventsPath
  },
  {
    name: "Voice or typed command creates numbered target candidates for real local software",
    pass:
      voiceSessionJson.format === "transparent_ai_engineering_voice_control_session_v1" &&
      voiceSessionJson.software === software &&
      voiceSessionJson.locks.numberedTargetConfirmationRequired === true &&
      voiceTargetConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      voiceTargetConfirmation.candidates.length === 2,
    evidence: voiceSession.targetConfirmation
  },
  {
    name: "Transparent mask preserves 2D position, perspective, and 3D depth sketch evidence",
    pass:
      overlayPacket.format === "transparent_ai_sketch_overlay_packet_v1" &&
      overlayPacket.coordinateSpace.supports2D === true &&
      overlayPacket.coordinateSpace.supportsPerspectiveRelationships === true &&
      overlayPacket.coordinateSpace.supports3DDepthHints === true &&
      overlayPacket.strokes.some((stroke) => stroke.mode === "screen_2d") &&
      overlayPacket.strokes.some((stroke) => stroke.mode === "perspective_grid") &&
      overlayPacket.strokes.some((stroke) => stroke.mode === "depth_axis_3d") &&
      spatialIntentJson.summary.supports2D === true &&
      spatialIntentJson.summary.supports3DDepthHints === true &&
      spatialIntentJson.summary.perspectiveCueCount >= 2,
    evidence: spatialIntent.interpretationPath
  },
  {
    name: "Spatial target confirmation narrows teacher sketch intent to one confirmed number",
    pass:
      spatialTargetJson.format === "transparent_ai_numbered_target_confirmation_v1" &&
      spatialTargetJson.candidates.length >= 2 &&
      confirmedReceipt.format === "transparent_ai_engineering_command_target_confirmation_receipt_v1" &&
      confirmedReceipt.selectedCandidateNumber === selectedSpatialTarget.number &&
      confirmedReceipt.evidence.selectedTargetOnly === true &&
      confirmedReceipt.evidence.existingExecutionAdapterSelectionCreated === true,
    evidence: confirmedTarget.receipt
  },
  {
    name: "Safe start and reviewed observation use real local read-only evidence before action rehearsal",
    pass:
      safeStartJson.format === "transparent_ai_teach_execute_safe_start_v1" &&
      safeStartJson.locks.softwareActionsExecuted === false &&
      reviewedObservationJson.format === "transparent_ai_teach_execute_reviewed_observation_v1" &&
      reviewedObservationJson.status === "waiting_for_teacher_observation_review" &&
      reviewedObservationJson.counts.rawCandidateCount > 0 &&
      reviewedObservationJson.didRunReadOnlyProbe !== false &&
      reviewedObservationJson.locks.softwareActionsExecuted === false,
    evidence: reviewedObservation.observationPath
  },
  {
    name: "Action rehearsal links observation and 2D/perspective/3D overlay into dry-run execution evidence",
    pass:
      actionRehearsalJson.format === "transparent_ai_teach_execute_action_rehearsal_v1" &&
      actionRehearsalJson.didCompileSpatialIntent === true &&
      actionRehearsalJson.didCreateSupervisedActionKit === true &&
      actionRehearsalJson.didSelectExecutionAdapter === true &&
      actionRehearsalJson.didRunDryRunReceipt === true &&
      actionRehearsalJson.didVerifyDryRunOutcome === true &&
      actionRehearsalJson.softwareActionsExecuted === false &&
      Boolean(actionRehearsalJson.generatedEvidence.spatialExecutionReadiness),
    evidence: actionRehearsal.rehearsalPath
  },
  {
    name: "Supervised execution gate defaults to dry-run and blocks execute without target-window evidence",
    pass:
      supervisedGateJson.format === "transparent_ai_teach_execute_supervised_execution_v1" &&
      supervisedGateJson.status === "dry_run_verified_no_ui_events" &&
      supervisedGateJson.didRunRunner === true &&
      supervisedGateJson.didVerifyOutcome === true &&
      supervisedGateJson.softwareActionsExecuted === false &&
      executeBlocked.status === "blocked_missing_target_window_title" &&
      executeBlocked.softwareActionsExecuted === false,
    evidence: `${supervisedGateDryRun.executionPath}; ${executeBlocked.executionPath}`
  },
  {
    name: "Integrated full-goal smoke keeps execution, screenshots, memory, acceptance, packaging, and native universal execution locked",
    pass:
      learningChanged.softwareActionsExecuted === false &&
      voiceSessionJson.locks.softwareActionsExecuted === false &&
      confirmedReceipt.locks.nativeUniversalExecution === false &&
      reviewedObservationJson.locks.screenshotsCaptured === false &&
      actionRehearsalJson.locks.memoryEnabled === false &&
      supervisedGateJson.locks.nativeUniversalExecution === false &&
      supervisedGateJson.locks.packagingGated === true,
    evidence: JSON.stringify({
      learning: learningChanged.softwareActionsExecuted,
      voice: voiceSessionJson.locks,
      executionGate: supervisedGateJson.locks
    })
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_full_goal_integrated_cycle_smoke_v1",
  smokeRoot,
  summaryPath: join(smokeRoot, "real-local-full-goal-integrated-cycle-smoke-summary.json"),
  realLocalSoftware: { software, processName, windowTitle, discoveredCandidateCount: inventory.softwareCandidates.length },
  paths: {
    teacherMethodProfile: teacherProfileResult.profilePath,
    inventory: inventoryPath,
    realQueue: realQueue.queuePath,
    compactLearningEvents: learningChangedJson.learningRuns[0].compactLearningEventsPath,
    voiceSession: voiceSession.sessionPath,
    voiceTargetConfirmation: voiceSession.targetConfirmation,
    overlayPacket: overlayPacketPath,
    spatialIntent: spatialIntent.interpretationPath,
    spatialTargetConfirmation: spatialTarget.targetConfirmation,
    confirmedTargetReceipt: confirmedTarget.receipt,
    reviewedObservation: reviewedObservation.observationPath,
    actionRehearsal: actionRehearsal.rehearsalPath,
    supervisedExecutionDryRun: supervisedGateDryRun.executionPath,
    supervisedExecutionBlocked: executeBlocked.executionPath
  },
  checks
};

writeFileSync(summary.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
