#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "current-goal-teacher-method-adaptation-handoff")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 84) || "current-goal-teacher-method-adaptation-handoff"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function loadOptional(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return readJson(path);
  } catch {
    return null;
  }
}

function newestDirectoryWithFile(root, fileName) {
  if (!existsSync(root)) return "";
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(root, entry.name);
      const file = join(dir, fileName);
      return existsSync(file) ? { file, time: statSync(dir).mtimeMs } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.time - a.time)[0]?.file || "";
}

function q(value) {
  const text = String(value ?? "");
  return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function commandText(scriptName, args = []) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map(q)
    .join(" ");
}

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function link(label, path) {
  return path && existsSync(path)
    ? `<a href="${htmlEscape(fileHref(path))}">${htmlEscape(label)}</a>`
    : `<span>${htmlEscape(label)}: ${htmlEscape(path || "missing")}</span>`;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    handoffDoesNotReviewMethodForTeacher: true,
    handoffDoesNotCompileActiveRules: true,
    handoffDoesNotEnableRules: true,
    handoffDoesNotWriteMemory: true,
    handoffDoesNotRunLowTokenCycle: true,
    handoffDoesNotRegisterMonitor: true,
    handoffDoesNotReadLogs: true,
    handoffDoesNotReadFullLogs: true,
    handoffDoesNotCaptureScreenshots: true,
    handoffDoesNotRecordScreen: true,
    handoffDoesNotExecuteTargetSoftware: true,
    fullContinuousRecording: false,
    nativeUniversalExecution: false,
    mediumRuntimeReuseEnabled: false,
    goalComplete: false
  };
}

function supportedMethodLanes() {
  return [
    {
      id: "ordered_steps",
      teacherCanTeachBy: "step sequence, checklist, ordered demonstration",
      route: "create_action_sequence_artifact",
      lowTokenEvidence: "structured step cards and trace deltas"
    },
    {
      id: "before_after_examples",
      teacherCanTeachBy: "before/after examples, tables, case pairs",
      route: "teach_apprentice",
      lowTokenEvidence: "example boundary rows and changed-field summaries"
    },
    {
      id: "transparent_overlay_sketch",
      teacherCanTeachBy: "transparent drawing mask over software or screenshot",
      route: "create_transparent_sketch_overlay_kit",
      lowTokenEvidence: "overlay packet vectors, labels, and normalized coordinates"
    },
    {
      id: "spatial_intent_review",
      teacherCanTeachBy: "2D position, perspective relation, 3D depth cue, numbered target",
      route: "interpret_transparent_sketch_spatial_intent",
      lowTokenEvidence: "spatial intent JSON and universal detail logic contract"
    },
    {
      id: "voice_explanation",
      teacherCanTeachBy: "voice or typed instruction",
      route: "create_voice_teaching_kit",
      lowTokenEvidence: "transcript, command candidates, numbered confirmation"
    },
    {
      id: "software_log_deltas",
      teacherCanTeachBy: "software event/log/file state changes",
      route: "watch_log_source_metadata_deltas",
      lowTokenEvidence: "metadata delta first, bounded tail only after trigger"
    },
    {
      id: "correction_first",
      teacherCanTeachBy: "corrections, counterexamples, boundary notes",
      route: "correct_last_result",
      lowTokenEvidence: "wrong output hash, corrected boundary, replay result"
    },
    {
      id: "silent_workalong_until_trigger",
      teacherCanTeachBy: "work quietly and ask only at rule/action/memory boundaries",
      route: "run_all_software_observer_supervisor",
      lowTokenEvidence: "event-triggered observation with no continuous recording"
    },
    {
      id: "triggered_screenshot",
      teacherCanTeachBy: "visual check only when metadata/overlay is ambiguous",
      route: "monitor_software_observation_deltas",
      lowTokenEvidence: "trigger reason, bounded screenshot receipt, teacher review"
    }
  ];
}

function profileModes(profile) {
  return (Array.isArray(profile?.preferredTeachingModes) ? profile.preferredTeachingModes : [])
    .map((mode) => mode?.mode)
    .filter(Boolean);
}

function writeHtml(path, packet) {
  const laneRows = packet.supportedMethodLanes
    .map(
      (lane) => `<tr>
        <td><code>${htmlEscape(lane.id)}</code></td>
        <td>${htmlEscape(lane.teacherCanTeachBy)}</td>
        <td><code>${htmlEscape(lane.route)}</code></td>
        <td>${htmlEscape(lane.lowTokenEvidence)}</td>
      </tr>`
    )
    .join("\n");
  const commandItems = packet.nextCommands
    .map((item) => `<li><strong>${htmlEscape(item.id)}</strong><p>${htmlEscape(item.purpose)}</p><pre>${htmlEscape(item.command)}</pre></li>`)
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Teacher Method Adaptation Handoff</title>
  <style>
    body { margin: 0; font: 14px/1.45 Segoe UI, Arial, sans-serif; color: #182433; background: #f6f8fb; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    section { background: #fff; border: 1px solid #d8e2ec; border-radius: 8px; padding: 16px; margin: 12px 0; }
    h1, h2 { margin: 0 0 10px; letter-spacing: 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-top: 1px solid #e5ebf2; padding: 8px; text-align: left; vertical-align: top; }
    pre, code { background: #edf3f8; border-radius: 5px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; }
    a { color: #155d8b; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Teacher Method Adaptation Handoff</h1>
  <section>
    <h2>Status</h2>
    <p><code>${htmlEscape(packet.status)}</code></p>
    <p>This connects teacher-method adaptation to all-software low-token observation, transparent sketch spatial logic, and high-to-medium reasoning reuse gates.</p>
  </section>
  <section>
    <h2>Generated Profile</h2>
    <p>${link("Teacher learning method profile", packet.paths.teacherLearningMethodProfile)}</p>
    <p>Inferred modes: <code>${htmlEscape(packet.inferredTeacherModes.join(", "))}</code></p>
  </section>
  <section>
    <h2>Evidence Links</h2>
    <p>${link("All-software low-token handoff", packet.paths.allSoftwareLowTokenHandoff)}</p>
    <p>${link("Teacher spatial drawing handoff", packet.paths.teacherSpatialDrawingHandoff)}</p>
    <p>${link("Current status refresh", packet.paths.currentStatusRefresh)}</p>
  </section>
  <section>
    <h2>Supported Teaching Lanes</h2>
    <table><thead><tr><th>Lane</th><th>Teacher can teach by</th><th>Existing route</th><th>Low-token evidence</th></tr></thead><tbody>${laneRows}</tbody></table>
  </section>
  <section>
    <h2>Next Commands</h2>
    <ol>${commandItems}</ol>
  </section>
</main>
</body>
</html>`,
    "utf8"
  );
}

function writeReadme(path, packet) {
  writeFileSync(
    path,
    [
      "# Current Goal Teacher Method Adaptation Handoff",
      "",
      `Status: ${packet.status}`,
      "",
      "This handoff makes the 'adapt to anyone's learning method' requirement concrete by routing teacher styles into existing low-token, transparent-overlay, correction, and reasoning-tier gates.",
      "",
      "It does not execute software, read logs, capture screenshots, record the screen, write memory, enable rules, unlock packaging, or claim completion.",
      "",
      "Open the HTML entry:",
      packet.paths.html,
      "",
      "Generated profile:",
      packet.paths.teacherLearningMethodProfile,
      "",
      "Inferred teacher modes:",
      ...packet.inferredTeacherModes.map((mode) => `- ${mode}`),
      "",
      "Supported lanes:",
      ...packet.supportedMethodLanes.map((lane) => `- ${lane.id}: ${lane.route}`)
    ].join("\n") + "\n",
    "utf8"
  );
}

const goal = argValue(
  "--goal",
  "All local software should learn from low-token log and event evidence, adapt to each teacher's learning method, use transparent sketch overlays for 2D/perspective/3D intent, and execute only after teacher-confirmed logic."
);
const software = argValue("--software", "all local software / teacher-selected engineering software");
const teacherMessage = argValue(
  "--teacher-message",
  [
    "Teacher may teach by ordered steps, before/after examples, voice or text, corrections, transparent overlay sketches, perspective/depth cues, and low-token log metadata deltas.",
    "Ask fewer questions during routine observation, but stop at reusable rule, memory, target execution, and ambiguous spatial intent boundaries.",
    "Use high reasoning to build or repair rules, then only reuse medium reasoning after the workflow is teacher-reviewed and validated."
  ].join(" ")
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-teacher-method-adaptation-handoffs")));
mkdirSync(outputRoot, { recursive: true });
const handoffId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const handoffDir = join(outputRoot, handoffId);
mkdirSync(handoffDir, { recursive: true });

const currentStatusRefresh = resolve(
  argValue(
    "--refresh",
    newestDirectoryWithFile(join(repoRoot, "artifacts", "original-goal-current-status-refreshes"), "original-goal-current-status-refresh.json")
  )
);
const lowTokenHandoff = resolve(
  argValue(
    "--low-token-handoff",
    newestDirectoryWithFile(
      join(repoRoot, "artifacts", "current-goal-all-software-low-token-learning-handoffs"),
      "current-goal-all-software-low-token-learning-handoff.json"
    )
  )
);
const spatialHandoff = resolve(
  argValue(
    "--spatial-handoff",
    newestDirectoryWithFile(
      join(repoRoot, "artifacts", "current-goal-teacher-spatial-drawing-handoffs"),
      "current-goal-teacher-spatial-drawing-handoff.json"
    )
  )
);

const profileResult = runNodeScript("create-teacher-learning-method-profile.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--teacher-message",
  teacherMessage,
  "--teacher-style",
  "ordered steps, examples, transparent overlay sketch, spatial intent review, voice explanation, software log deltas, correction-first, ask less, triggered screenshot fallback",
  "--evidence-preference",
  "metadata delta first",
  "--evidence-preference",
  "transparent overlay packet",
  "--evidence-preference",
  "teacher correction boundary",
  "--preferred-tool",
  "transparent drawing overlay",
  "--output-dir",
  join(handoffDir, "teacher-method-profile")
]);
const profile = readJson(profileResult.profilePath);
const lanes = supportedMethodLanes();
const inferredModes = profileModes(profile);
const laneCoverage = lanes.map((lane) => ({
  ...lane,
  inferredInCurrentProfile: inferredModes.includes(lane.id),
  currentProfileRouteSuggested: Array.isArray(profile.nextSuggestedTools) && profile.nextSuggestedTools.includes(lane.route)
}));

const handoffPath = join(handoffDir, "current-goal-teacher-method-adaptation-handoff.json");
const htmlPath = join(handoffDir, "current-goal-teacher-method-adaptation-handoff.html");
const readmePath = join(handoffDir, "CURRENT_GOAL_TEACHER_METHOD_ADAPTATION_START_HERE.md");
const lockState = locks();
const lowTokenPacket = loadOptional(lowTokenHandoff);
const spatialPacket = loadOptional(spatialHandoff);
const packet = {
  ok: true,
  format: "transparent_ai_current_goal_teacher_method_adaptation_handoff_v1",
  handoffId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  status: "waiting_for_teacher_method_review_before_contract_or_medium_runtime_reuse",
  generatedTeacherMethodProfile: {
    profilePath: profileResult.profilePath,
    routePath: profileResult.routePath,
    teacherReadme: profileResult.teacherReadme,
    inferredPrimaryMode: profileResult.inferredPrimaryMode,
    preferredTeachingModeCount: profileResult.preferredTeachingModeCount
  },
  inferredTeacherModes: inferredModes,
  supportedMethodLanes: laneCoverage,
  currentGoalEvidence: {
    lowTokenHandoffStatus: lowTokenPacket?.status || "",
    lowTokenAllRowsHaveReviewableRoute: lowTokenPacket?.allRowsHaveReviewableLowTokenRoute === true,
    spatialHandoffStatus: spatialPacket?.status || "",
    spatial2D3DDepthValidationAvailable: spatialPacket?.implementedNow?.validates2DPositionPerspective3DDepth === true,
    spatialLogicContractRuleDraftPrepared: spatialPacket?.implementedNow?.logicContractRuleDraftCommandPreparedButNotRun === true
  },
  reasoningTierPolicy: {
    highReasoningUseCases: [
      "extract reusable logic from teacher corrections",
      "turn transparent sketch perspective/depth into strict Rule DSL drafts",
      "repair any failed medium-runtime reuse",
      "decide whether missing evidence blocks execution"
    ],
    mediumReasoningUseCases: [
      "apply an already teacher-reviewed workflow",
      "prepare deterministic evidence requests",
      "run reviewed dry-run planning without executing target software"
    ],
    downgradeAllowedOnlyAfter:
      "teacher-reviewed method contract, low-token evidence gate, spatial logic contract, retained rollback, and dry-run validation all pass",
    escalationBackToHighReasoningWhen:
      "teacher correction, missing logic source, ambiguous overlay/spatial intent, failed validator, or unexpected software evidence appears"
  },
  nextCommands: [
    {
      id: "review_generated_teacher_method_profile",
      purpose: "Teacher corrects misunderstood preferences before any reusable method contract.",
      command: profileResult.teacherReadme
    },
    {
      id: "create_teacher_method_execution_learning_contract_after_review",
      purpose: "After teacher review and retained rollback, convert the method profile into a review-only execution learning contract.",
      command: commandText("create-teacher-method-execution-learning-contract.mjs", [
        "--profile",
        profileResult.profilePath,
        "--low-token-learning-handoff",
        "<teacher-reviewed-low-token-compact-learning-handoff.json>",
        "--transparent-sketch-rule-draft",
        "<teacher-reviewed-transparent-sketch-logic-contract-rule-draft.json>",
        "--rollback-point",
        "<retained-rollback-point>",
        "--teacher-reviewed-method",
        "--output-dir",
        join("artifacts", "current-goal-teacher-method-execution-learning-contracts")
      ])
    },
    {
      id: "create_teacher_method_low_token_workflow_gate_after_contract",
      purpose: "Gate teacher-method reuse into low-token workflow reuse and high-to-medium reasoning downgrade.",
      command: commandText("create-teacher-method-low-token-workflow-gate-package.mjs", [
        "--refresh",
        currentStatusRefresh || "<original-goal-current-status-refresh.json>",
        "--profile",
        profileResult.profilePath,
        "--contract",
        "<teacher-method-execution-learning-contract.json>",
        "--output-dir",
        join("artifacts", "current-goal-teacher-method-low-token-workflow-gates")
      ])
    },
    {
      id: "prove_teacher_method_reuse_result_after_later_run",
      purpose: "Later, compare before/after reuse evidence before medium-runtime reuse or memory claims.",
      command: commandText("create-teacher-method-reuse-result-proof-builder.mjs", [
        "--contract-receipt-validation",
        "<teacher-method-contract-receipt-validation.json>",
        "--contract",
        "<teacher-method-execution-learning-contract.json>",
        "--output-dir",
        join("artifacts", "current-goal-teacher-method-reuse-result-proof-builders")
      ])
    }
  ],
  blockedActions: [
    "treat_generated_profile_as_teacher_review",
    "compile_active_rules_from_teacher_method_handoff",
    "enable_rules_from_teacher_method_handoff",
    "write_memory_from_teacher_method_handoff",
    "run_low_token_cycle_from_teacher_method_handoff",
    "read_logs_from_teacher_method_handoff",
    "read_full_logs_from_teacher_method_handoff",
    "capture_screenshot_from_teacher_method_handoff",
    "record_screen_from_teacher_method_handoff",
    "execute_target_software_from_teacher_method_handoff",
    "downgrade_to_medium_runtime_from_teacher_method_handoff",
    "claim_goal_complete_from_teacher_method_handoff"
  ],
  paths: {
    handoff: handoffPath,
    html: htmlPath,
    readme: readmePath,
    teacherLearningMethodProfile: profileResult.profilePath,
    teacherLearningMethodRoute: profileResult.routePath,
    teacherLearningMethodReadme: profileResult.teacherReadme,
    allSoftwareLowTokenHandoff: lowTokenHandoff && existsSync(lowTokenHandoff) ? lowTokenHandoff : "",
    teacherSpatialDrawingHandoff: spatialHandoff && existsSync(spatialHandoff) ? spatialHandoff : "",
    currentStatusRefresh: currentStatusRefresh && existsSync(currentStatusRefresh) ? currentStatusRefresh : ""
  },
  locks: lockState,
  goalComplete: false
};

writeFileSync(handoffPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeHtml(htmlPath, packet);
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_teacher_method_adaptation_handoff_result_v1",
      status: packet.status,
      handoffPath,
      htmlPath,
      readmePath,
      teacherLearningMethodProfile: profileResult.profilePath,
      inferredTeacherModes: inferredModes,
      supportedMethodLaneCount: laneCoverage.length,
      lowTokenEvidenceLinked: Boolean(packet.paths.allSoftwareLowTokenHandoff),
      spatialEvidenceLinked: Boolean(packet.paths.teacherSpatialDrawingHandoff),
      locks: lockState
    },
    null,
    2
  )
);
