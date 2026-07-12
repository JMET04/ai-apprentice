#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "low-token-operation-preflight-policy")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "low-token-operation-preflight-policy"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function evidenceStatus(input, expectedFormat) {
  if (!input.value) return "missing";
  if (expectedFormat && input.value.format !== expectedFormat) return "wrong_format";
  return "present";
}

function writeHtml(path, policy) {
  const laneRows = policy.preflightLanes
    .map(
      (lane) => `<tr>
        <td>${lane.order}</td>
        <td>${lane.id}</td>
        <td>${lane.status}</td>
        <td>${lane.evidencePath || ""}</td>
        <td>${lane.nextReviewAction}</td>
      </tr>`
    )
    .join("\n");
  const blocked = policy.blockedActions.map((item) => `<li>${item}</li>`).join("\n");
  const gates = policy.requiredBeforeExecution.map((item) => `<li>${item}</li>`).join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Low Token Operation Preflight Policy</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #17202a; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #ccd1d1; padding: 8px; vertical-align: top; }
    th { background: #eef2f3; text-align: left; }
    code { background: #eef2f3; padding: 2px 4px; }
  </style>
</head>
<body>
  <h1>Low Token Operation Preflight Policy</h1>
  <p>Status: <strong>${policy.status}</strong></p>
  <p>Goal: ${policy.goal}</p>
  <h2>Preflight lanes</h2>
  <table>
    <thead><tr><th>Order</th><th>Lane</th><th>Status</th><th>Evidence</th><th>Next review action</th></tr></thead>
    <tbody>${laneRows}</tbody>
  </table>
  <h2>Required before execution</h2>
  <ul>${gates}</ul>
  <h2>Blocked actions</h2>
  <ul>${blocked}</ul>
  <p>Policy JSON: <code>${policy.paths.policy}</code></p>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue(
  "--goal",
  "Preflight automatic low-token learning and supervised engineering-software operation before execution."
);
const software = argValue("--software", argValue("--app", "all reviewed software"));
const command = argValue("--command", argValue("--text-command", argValue("--voice-transcript", "")));
const teacherStyle = argValue("--teacher-style", argValue("--teaching-style", "ask_teacher_preference"));
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "low-token-operation-preflight-policies"))
);

const runnerInput = readJsonInput(argValue("--runner", argValue("--runner-journal", "")), "--runner");
const learningCycleInput = readJsonInput(argValue("--learning-cycle", argValue("--cycle", "")), "--learning-cycle");
const visualQueueInput = readJsonInput(
  argValue("--visual-check-queue", argValue("--automatic-visual-check-queue", "")),
  "--visual-check-queue"
);
const targetConfirmationInput = readJsonInput(
  argValue("--target-confirmation", argValue("--numbered-target", "")),
  "--target-confirmation"
);
const spatialIntentInput = readJsonInput(argValue("--spatial-intent", argValue("--overlay-intent", "")), "--spatial-intent");
const executionGateInput = readJsonInput(argValue("--execution-gate", argValue("--approval-gate", "")), "--execution-gate");
const rollbackInput = readJsonInput(argValue("--rollback-point", argValue("--rollback", "")), "--rollback-point");

mkdirSync(outputRoot, { recursive: true });
const policyId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const policyDir = join(outputRoot, policyId);
mkdirSync(policyDir, { recursive: true });

const policyPath = join(policyDir, "low-token-operation-preflight-policy.json");
const htmlPath = join(policyDir, "low-token-operation-preflight-policy.html");
const readmePath = join(policyDir, "LOW_TOKEN_OPERATION_PREFLIGHT_POLICY_START_HERE.md");

const runnerPresent = evidenceStatus(runnerInput, "transparent_ai_automatic_low_token_learning_runner_v1") === "present";
const cyclePresent =
  evidenceStatus(learningCycleInput, "transparent_ai_all_software_low_token_learning_cycle_v1") === "present";
const visualQueuePresent =
  evidenceStatus(visualQueueInput, "transparent_ai_automatic_triggered_visual_check_queue_v1") === "present";
const targetPresent = Boolean(targetConfirmationInput.value);
const spatialPresent = Boolean(spatialIntentInput.value);
const executionGatePresent = Boolean(executionGateInput.value);
const rollbackPresent = evidenceStatus(rollbackInput, "transparent_ai_rollback_point_v1") === "present";

const visualRequestCount = Number(visualQueueInput.value?.requestCount || 0);
const targetSelected =
  targetConfirmationInput.value?.confirmedTarget?.selectedCandidateNumber ||
  targetConfirmationInput.value?.selectedCandidateNumber ||
  targetConfirmationInput.value?.selectedNumber ||
  "";
const executionReady =
  executionGateInput.value?.readyForTeacherExecuteReview === true ||
  executionGateInput.value?.readyForTeacherRegistrationExecuteReview === true;

const preflightLanes = [
  {
    order: 1,
    id: "low_token_observation_first",
    status: runnerPresent || cyclePresent ? "evidence_present" : "waiting_for_runner_or_learning_cycle",
    evidencePath: runnerInput.path || learningCycleInput.path,
    nextReviewAction:
      "Run or review automatic low-token learning evidence before screenshots, target selection, execution, or memory."
  },
  {
    order: 2,
    id: "visual_check_only_after_changed_signal",
    status: visualQueuePresent
      ? visualRequestCount > 0
        ? "waiting_for_teacher_visual_review"
        : "no_visual_check_needed"
      : "waiting_for_triggered_visual_check_queue",
    evidencePath: visualQueueInput.path,
    nextReviewAction:
      "If a meaningful changed signal needs grounding, capture at most one bounded screenshot after teacher confirmation."
  },
  {
    order: 3,
    id: "voice_text_numbered_target_confirmation",
    status: targetSelected ? "one_numbered_target_selected" : command || targetPresent ? "waiting_for_one_numbered_target" : "waiting_for_command",
    evidencePath: targetConfirmationInput.path,
    nextReviewAction:
      "Use voice or typed command only to create numbered candidates; do not execute until the teacher confirms exactly one number."
  },
  {
    order: 4,
    id: "transparent_sketch_spatial_intent",
    status: spatialPresent ? "spatial_intent_reviewable" : "optional_waiting_for_overlay_or_sketch_packet",
    evidencePath: spatialIntentInput.path,
    nextReviewAction:
      "When the teacher draws 2D, perspective, or 3D depth intent, preserve the interpreted spatial packet before target confirmation."
  },
  {
    order: 5,
    id: "execution_gate_and_rollback",
    status: executionReady && rollbackPresent ? "ready_for_teacher_execute_review" : "blocked_before_execution_or_registration",
    evidencePath: executionGateInput.path || rollbackInput.path,
    nextReviewAction:
      "Require route evidence, one confirmed target when spatial/voice is involved, explicit teacher confirmation, and a retained rollback point."
  }
];

const blockers = [];
if (!runnerPresent && !cyclePresent) blockers.push("missing_low_token_runner_or_learning_cycle_evidence");
if (!visualQueuePresent) blockers.push("missing_triggered_visual_check_queue_policy");
if (command && !targetSelected) blockers.push("voice_or_text_command_has_no_confirmed_numbered_target");
if (executionGatePresent && !rollbackPresent) blockers.push("execution_gate_missing_retained_rollback_point");
if (executionGatePresent && !executionReady) blockers.push("execution_gate_not_ready_for_teacher_execute_review");

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  metadataFirst: true,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  targetSoftwareCommandsExecuted: false,
  softwareActionsExecuted: false,
  uiEventsSent: false,
  scheduledTaskRegistered: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequiredBeforeCapture: true,
  teacherConfirmationRequiredBeforeExecution: true,
  rollbackPointRequiredBeforeExecution: true
};

const policy = {
  ok: true,
  format: "transparent_ai_low_token_operation_preflight_policy_v1",
  policyId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  command,
  teacherStyle,
  status: blockers.length ? "waiting_for_preflight_evidence_or_teacher_review" : "ready_for_teacher_preflight_review",
  purpose:
    "Unify automatic low-token observation, triggered visual checks, voice/text numbered target confirmation, transparent sketch spatial intent, execution gates, and rollback evidence before any system change.",
  paths: {
    policy: policyPath,
    html: htmlPath,
    readme: readmePath,
    runner: runnerInput.path,
    learningCycle: learningCycleInput.path,
    visualCheckQueue: visualQueueInput.path,
    targetConfirmation: targetConfirmationInput.path,
    spatialIntent: spatialIntentInput.path,
    executionGate: executionGateInput.path,
    rollbackPoint: rollbackInput.path
  },
  lowTokenOrder: [
    "read_log_metadata_or_file_event_deltas",
    "skip_tail_reads_when_metadata_unchanged",
    "read_bounded_tail_only_for_changed_sources",
    "compress_changed_items_into_teacher_review_events",
    "request_one_visual_check_only_for_meaningful_or_ambiguous_changes",
    "require_voice_text_numbered_target_confirmation_before_action",
    "require_dry_run_and_low_token_outcome_verification_before_learning"
  ],
  screenshotPolicy: {
    continuousRecordingAllowed: false,
    defaultScreenshotCapture: false,
    triggerRequired: true,
    triggerSources: ["error", "warning", "blocker", "ambiguous", "teacher_marker", "screenshot_recommended"],
    maxScreenshotsPerRequest: 1,
    teacherConfirmationRequired: true
  },
  executionPolicy: {
    executeFromThisPolicy: false,
    requiresReusableRouteEvidence: true,
    requiresOneConfirmedNumberedTargetWhenCommandOrSketchExists: true,
    requiresDryRunReceipt: true,
    requiresRetainedRollbackPoint: true,
    requiresExplicitTeacherConfirmation: true,
    targetSoftwareCommandsExecuted: false
  },
  requiredBeforeExecution: [
    "reviewed low-token observation or learning-cycle evidence",
    "single visual-check request only when a changed signal needs visual grounding",
    "one teacher-confirmed numbered target for voice/text or sketch-driven actions",
    "route evidence and dry-run receipt from an existing adapter or supervised action bridge",
    "retained rollback point that is deleted only after teacher confirmation"
  ],
  preflightLanes,
  blockers,
  nextSafeActions: [
    "review_low_token_operation_preflight_policy",
    "fill_missing_low_token_or_visual_queue_evidence",
    "confirm_exactly_one_numbered_target_before_dry_run_planning",
    "create_or_retain_rollback_point_before_any_execute_or_registration_gate",
    "verify_low_token_outcome_before_memory_or_rule_enablement"
  ],
  blockedActions: [
    "continuous_recording",
    "screenshot_without_changed_signal_and_teacher_confirmation",
    "execute_from_voice_or_text_without_numbered_target",
    "execute_from_sketch_without_spatial_intent_and_numbered_target",
    "register_recurring_monitor_without_teacher_confirmation_and_rollback",
    "write_long_term_memory_from_preflight",
    "claim_all_software_or_native_universal_execution_complete"
  ],
  locks
};

writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
writeHtml(htmlPath, policy);
writeFileSync(
  readmePath,
  [
    "# Low Token Operation Preflight Policy",
    "",
    `Status: ${policy.status}`,
    `Goal: ${goal}`,
    "",
    "Open the HTML or JSON policy before any automatic monitor activation or supervised engineering-software execution.",
    "",
    "This packet does not register tasks, capture screenshots, execute software, write memory, enable rules, accept technology, unlock packaging, or claim completion.",
    "",
    `Policy JSON: ${policyPath}`,
    `Policy HTML: ${htmlPath}`
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_low_token_operation_preflight_policy_result_v1",
      policyId,
      status: policy.status,
      policyPath,
      htmlPath,
      readmePath,
      blockerCount: blockers.length,
      laneCount: preflightLanes.length,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      longTermMemoryWritten: false,
      nativeUniversalExecution: false
    },
    null,
    2
  )
);
