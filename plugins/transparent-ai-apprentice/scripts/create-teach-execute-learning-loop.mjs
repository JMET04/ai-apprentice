#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return String(value || "teach-execute-learning-loop")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "teach-execute-learning-loop";
}

const goal = argValue("--goal", argValue("--task", "Learn from any teacher, observe arbitrary software cheaply, interpret visual intent, and execute only under supervision."));
const software = argValue("--software", argValue("--app", "arbitrary target software"));
const teacherStyle = argValue("--teacher-style", argValue("--style", "teacher chooses: steps, examples, voice, overlay sketch, logs, or corrections"));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "teach-execute-learning-loops")));
mkdirSync(outputRoot, { recursive: true });

const loopId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const loopDir = join(outputRoot, loopId);
mkdirSync(loopDir, { recursive: true });

const runbookPath = join(loopDir, "teach-execute-learning-loop.json");
const readmePath = join(loopDir, "TEACH_EXECUTE_LOOP_START_HERE.md");
const verifierTemplatePath = join(loopDir, "loop-verification-receipt-template.json");

const locks = {
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true,
  privateChainOfThoughtExposed: false
};

const stages = [
  {
    id: "rollback_before_direction",
    purpose: "Create a recoverable checkpoint before changing learning direction, package state, or memory.",
    tool: "create_rollback_point",
    input: "paths to plugin, scripts, package, handoff, and generated package",
    output: "transparent_ai_rollback_point_v1",
    continueWhen: "rollback manifest exists",
    stopWhen: "rollback cannot be created"
  },
  {
    id: "teacher_method_profile",
    purpose: "Infer how this teacher prefers to teach before choosing logs, examples, voice, transparent overlay, screenshots, or supervised execution.",
    tool: "create_teacher_learning_method_profile",
    input: "teacher goal, style hints, correction examples, evidence preferences, and preferred existing tools",
    output: "transparent_ai_teacher_learning_method_profile_v1",
    continueWhen: "teacher has reviewed or corrected the preferred teaching modes, evidence order, and question policy",
    stopWhen: "the profile would enable memory, technology acceptance, packaging, continuous recording, or native execution"
  },
  {
    id: "all_software_observer_bootstrap",
    purpose: "For broad automatic log-learning requests, chain inventory, teacher exclusions, queue creation, and persisted watch baselines in one low-token review packet.",
    tool: "create_all_software_observer_bootstrap",
    input: "all-software automatic observation request plus optional reviewed inventory",
    output: "transparent_ai_all_software_observer_bootstrap_v1",
    continueWhen: "teacher has reviewed exclusions and the bootstrap only reads cheap metadata or bounded log tails",
    stopWhen: "bootstrap would include private apps, continuous recording, full logs, or native universal execution claims"
  },
  {
    id: "all_software_inventory",
    purpose: "Read the computer-wide software/log landscape before assuming CAD, SolidWorks, or any single app.",
    tool: "create_software_observer_inventory",
    input: "all-software or broad software-learning request",
    output: "transparent_ai_software_observer_batch_plan_v1",
    continueWhen: "teacher selects or confirms software candidates",
    stopWhen: "inventory is too broad or teacher forbids probing"
  },
  {
    id: "software_observer_queue",
    purpose: "Convert inventory/probe output into a bounded low-token queue of per-software observer candidates.",
    tool: "create_software_observer_queue",
    input: "transparent_ai_software_observer_inventory_v1 from the read-only probe",
    output: "transparent_ai_software_observer_queue_v1",
    continueWhen: "teacher selects a queued app and approves the cheap evidence sources",
    stopWhen: "queue contains private apps or no candidate should be observed"
  },
  {
    id: "all_software_observer_coverage_audit",
    purpose: "Audit whether the reviewed inventory and queue actually cover each software row with a low-token log route or non-log fallback before claiming broad software learning coverage.",
    tool: "create_all_software_observer_coverage_audit",
    input: "transparent_ai_software_observer_inventory_v1 plus transparent_ai_software_observer_queue_v1 and optional watch/learning evidence paths",
    output: "transparent_ai_all_software_observer_coverage_audit_v1 plus repair plan and receipt",
    continueWhen: "coverage audit shows log routes, non-log fallbacks, or explicit repair calls for gaps",
    stopWhen: "audit finds private apps, missing queue items, or missing low-token signals that the teacher has not reviewed"
  },
  {
    id: "log_source_metadata_delta_gate",
    purpose: "Compare only log metadata first so unchanged logs do not spend tail-read, screenshot, or learning budget.",
    tool: "watch_log_source_metadata_deltas",
    input: "transparent_ai_software_observer_queue_v1 plus persisted metadata watch state",
    output: "transparent_ai_log_source_metadata_delta_watch_v1",
    continueWhen: "metadata changed and a narrowed queue or nextTailReadCall exists, or no change means this pass can skip tail reads",
    stopWhen: "metadata gate would read log contents, capture screenshots, or include private apps"
  },
  {
    id: "all_software_observer_supervisor",
    purpose: "Run bounded periodic watch cycles over the reviewed queue and stop on meaningful deltas before screenshots, memory, or execution.",
    tool: "run_all_software_observer_supervisor",
    input: "transparent_ai_software_observer_queue_v1 plus persisted watch state",
    output: "transparent_ai_all_software_observer_supervisor_v1",
    continueWhen: "supervisor receipt reports changed signals or no meaningful deltas without reading full logs",
    stopWhen: "supervisor would run unbounded, include private apps, or install a background watcher without teacher approval"
  },
  {
    id: "automatic_observer_schedule",
    purpose: "Prepare a teacher-confirmed Windows Scheduled Task package for recurring bounded low-token observer supervisor runs.",
    tool: "create_automatic_observer_schedule",
    input: "reviewed transparent_ai_software_observer_queue_v1 plus interval, task name, and bounded per-run limits",
    output: "transparent_ai_automatic_observer_schedule_v1",
    continueWhen: "teacher has reviewed the queue, interval, runner, and register/unregister scripts before task registration",
    stopWhen: "schedule would register without teacher confirmation, run unbounded, read full logs, capture screenshots by default, or claim native execution"
  },
  {
    id: "all_software_low_token_learning_cycle",
    purpose: "Convert changed reviewed all-software queue items into compact learning events after watch deltas, without continuous recording or memory writes.",
    tool: "run_all_software_low_token_learning_cycle",
    input: "transparent_ai_software_observer_queue_v1 plus persisted watch state",
    output: "transparent_ai_all_software_low_token_learning_cycle_v1",
    continueWhen: "learning-cycle receipt contains compact event packets and teacher can choose reusable signals",
    stopWhen: "cycle would process unchanged/private items, write long-term memory, capture screenshots by default, or execute software"
  },
  {
    id: "software_observer_queue_item_run",
    purpose: "Run one reviewed queue item into concrete low-token observation evidence and compact learning events.",
    tool: "run_software_observer_queue_item",
    input: "transparent_ai_software_observer_queue_v1 plus selected queue item id",
    output: "transparent_ai_software_observer_queue_item_run_receipt_v1",
    continueWhen: "bounded tail/event evidence is compacted and teacher can identify the reusable signal",
    stopWhen: "selected item is private, log tail evidence is too noisy, or teacher has not approved observation"
  },
  {
    id: "software_observation_delta_monitor",
    purpose: "Compare baseline/current compact observations or queue snapshots, then request a screenshot only if a meaningful trigger appears.",
    tool: "monitor_software_observation_deltas",
    input: "previous observation or queue-item receipt plus current observation, or a reviewed queue item for a current bounded-tail snapshot",
    output: "transparent_ai_software_observation_delta_monitor_v1",
    continueWhen: "changed logs/events are classified and screenshot policy is explicit",
    stopWhen: "delta evidence is missing, private, or would require continuous recording"
  },
  {
    id: "software_observer_watch_cycle",
    purpose: "Run a bounded cycle across multiple reviewed software queue items, persisting baselines and reporting only changed signals.",
    tool: "run_software_observer_watch_cycle",
    input: "transparent_ai_software_observer_queue_v1 plus optional persisted watch state",
    output: "transparent_ai_software_observer_watch_cycle_v1",
    continueWhen: "cycle receipt reports no meaningful delta or teacher-reviewed changed signals",
    stopWhen: "cycle would touch private apps, read full logs, or need continuous recording"
  },
  {
    id: "software_control_channel_read_only_probe",
    purpose: "Before profiling execution routes, create a bounded metadata-only probe for API/SDK/COM, macro/add-in, CLI/script, browser/local-service, file import/export, and visible-window fallback clues.",
    tool: "create_software_control_channel_probe",
    input: "chosen software, process/window/install/executable hints, optional teacher-approved run-read-only-probe flag, and bounded file/registry limits",
    output: "transparent_ai_software_control_channel_probe_result_v1 plus transparent_ai_software_control_channel_probe_to_profile_request_v1",
    continueWhen: "teacher reviews the probe package or the read-only result and passes it into create_software_control_channel_profile",
    stopWhen: "probe would execute target software commands, read file contents, write registry, capture screenshots, continuously record, or inspect private apps"
  },
  {
    id: "software_profile",
    purpose: "Discover cheap sources for the chosen app: process, window, explicit logs, log roots, Windows Events, file deltas, and teacher markers.",
    tool: "create_software_capability_profile",
    input: "chosen software, process/window hints, optional log paths",
    output: "transparent_ai_software_capability_profile_v1 plus optional read-only probe",
    continueWhen: "teacher reviews the profile or probe result",
    stopWhen: "profile cannot identify any useful cheap source and teacher does not allow screenshots"
  },
  {
    id: "adaptive_observer",
    purpose: "Bridge the reviewed profile/probe into a universal low-token observer setup.",
    tool: "create_adaptive_software_observer_from_profile",
    input: "software capability profile and optional probe result",
    output: "transparent_ai_adaptive_software_observer_setup_v1 and universal observer kit",
    continueWhen: "observer selected sources are acceptable",
    stopWhen: "selected sources contradict teacher privacy or scope"
  },
  {
    id: "software_control_channel_profile",
    purpose: "Before any execution route is selected, discover whether the target software already exposes browser, CLI/script, application API, macro, file import/export, or Windows UI fallback control channels.",
    tool: "create_software_control_channel_profile",
    input: "voice/text command intent, confirmed numbered target, reviewed overlay packet, software profile, known install path, command/API/macro hints, and preferred adapter evidence",
    output: "transparent_ai_software_control_channel_profile_v1 plus transparent_ai_software_control_channel_existing_adapter_request_v1",
    continueWhen: "teacher reviews the ranked control channels and confirms the route is appropriate for dry-run adapter selection",
    stopWhen: "profile would execute software, skip numbered target confirmation, skip dry-run-first adapter selection, or claim universal native control"
  },
  {
    id: "universal_observation",
    purpose: "Collect compact log/event/file/marker evidence without continuous recording.",
    tool: "create_universal_software_observer_kit",
    input: "selected logs, roots, Windows Event Logs, process/window hints",
    output: "transparent_ai_universal_software_observation_v1",
    continueWhen: "collector emits observation summary",
    stopWhen: "collector would need full continuous recording"
  },
  {
    id: "compact_learning_events",
    purpose: "Compress observation into teacher-reviewable learning events before teaching.",
    tool: "compact_universal_observation_learning_events",
    input: "transparent_ai_universal_software_observation_v1",
    output: "transparent_ai_compact_learning_events_from_universal_observation_v1",
    continueWhen: "teacher identifies rule boundary and counterexample",
    stopWhen: "events are ambiguous and teacher has not labeled the signal"
  },
  {
    id: "transparent_overlay",
    purpose: "Let the teacher draw over the target software when logs are not enough or visual/spatial intent matters.",
    tool: "create_transparent_sketch_overlay_kit",
    input: "teacher sketch over visible software, 2D/perspective/3D mode",
    output: "transparent_ai_sketch_overlay_packet_v1",
    continueWhen: "teacher reviews the overlay packet",
    stopWhen: "target coordinate system or visible window is not confirmed"
  },
  {
    id: "spatial_intent",
    purpose: "Interpret teacher drawing into 2D position, perspective, relative-anchor, and 3D depth relationships.",
    tool: "interpret_transparent_sketch_spatial_intent",
    input: "transparent_ai_sketch_overlay_packet_v1",
    output: "transparent_ai_spatial_intent_interpretation_v1",
    continueWhen: "teacher confirms interpreted relationships",
    stopWhen: "confidence is low and teacher has not corrected the interpretation"
  },
  {
    id: "spatial_execution_route_bridge",
    purpose: "Bind the teacher-confirmed numbered 2D/perspective/3D sketch target to dry-run-first software execution route candidates.",
    tool: "create_spatial_software_execution_route_bridge",
    input: "transparent sketch overlay packet, spatial intent interpretation, numbered target confirmation or confirmation receipt, and reviewed control-channel profile",
    output: "transparent_ai_spatial_software_execution_route_bridge_v1",
    continueWhen: "teacher reviews the selected target and chooses one dry-run adapter route",
    stopWhen: "no target number is confirmed, the route would use unselected targets, or execution would skip dry-run/post-action evidence review"
  },
  {
    id: "execution_adapter_selection",
    purpose: "Choose an existing execution route from the reviewed control-channel profile, such as browser automation, CLI/API, file import/export, or supervised Windows UI before executing.",
    tool: "create_existing_software_execution_adapter",
    input: "reviewed control-channel profile, spatial intent, supervised action plan, software profile, and teacher preferred tools",
    output: "transparent_ai_existing_software_execution_adapter_selection_v1",
    continueWhen: "teacher reviews the selected existing route and dry-run evidence requirements",
    stopWhen: "adapter selection would execute immediately, skip dry run, or claim universal native control"
  },
  {
    id: "supervised_action_plan",
    purpose: "Compile reviewed spatial intent into dry-run-first click, drag, type, and hotkey candidates when no cheaper existing route is selected.",
    tool: "create_supervised_software_action_kit",
    input: "reviewed overlay packet and optional explicit text/hotkey actions",
    output: "transparent_ai_supervised_software_action_plan_v1 plus transparent_ai_supervised_software_action_preflight_v1 and runner",
    continueWhen: "teacher reviews dry-run action plan and preflight",
    stopWhen: "teacher has not confirmed visible target window, coordinates, and action order"
  },
  {
    id: "action_rehearsal",
    purpose: "Link reviewed observation plus transparent overlay into spatial intent, supervised action plan, existing adapter selection, dry-run receipt, and low-token outcome verification.",
    tool: "start_teach_execute_action_rehearsal",
    input: "transparent_ai_teach_execute_reviewed_observation_v1 plus transparent_ai_sketch_overlay_packet_v1 and explicit teacher rehearsal confirmation",
    output: "transparent_ai_teach_execute_action_rehearsal_v1",
    continueWhen: "teacher reviews the dry-run action rehearsal, adapter selection, preflight, and outcome verification",
    stopWhen: "the teacher has not confirmed the rehearsal or the overlay/reviewed observation evidence is missing"
  },
  {
    id: "supervised_execution_gate",
    purpose: "Run the generated supervised runner only through a teacher-confirmed gate that defaults to dry-run and requires target-window evidence for execute mode.",
    tool: "start_teach_execute_supervised_execution",
    input: "transparent_ai_teach_execute_action_rehearsal_v1 plus explicit supervised execution confirmation; optional --execute only with target-window title evidence",
    output: "transparent_ai_teach_execute_supervised_execution_v1 plus runner receipt, preflight, and outcome verification",
    continueWhen: "receipt, preflight, and cheap post-action signals are available for teacher review",
    stopWhen: "confirmation is missing, execute was requested without target-window evidence, preflight blocks execution, or teacher-visible result is unreviewed"
  },
  {
    id: "supervised_action_outcome_verification",
    purpose: "Verify the supervised action result with receipt, preflight, optional metadata-only log deltas, file/event markers, and teacher review before screenshots or learning.",
    tool: "verify_supervised_action_outcome",
    input: "transparent_ai_supervised_software_action_execution_receipt_v1 plus optional action plan, preflight, observer queue, and teacher marker",
    output: "transparent_ai_supervised_action_outcome_verification_v1",
    continueWhen: "teacher reviews the verification packet and visible result, or changed metadata has been narrowed for bounded tail review",
    stopWhen: "verification says blocked, ambiguous, wrong-window, or teacher has not confirmed the visible outcome"
  },
  {
    id: "post_action_evidence_checkpoint",
    purpose: "Compare before/after cheap state metadata around the execution receipt so learning does not rely only on a plausible action receipt or screenshot.",
    tool: "create_post_action_evidence_checkpoint",
    input: "before-state snapshot, supervised or existing-route execution receipt, watched files/directories, optional reviewed observer queue, and teacher markers",
    output: "transparent_ai_post_action_low_token_evidence_checkpoint_v1",
    continueWhen: "teacher reviews changed state metadata or confirms that one bounded visual check is needed",
    stopWhen: "checkpoint reports no cheap change and teacher has not approved a visual check, or state changes contradict teacher intent"
  },
  {
    id: "teach_and_replay",
    purpose: "Teach from compact learning events, overlay packet, preflight, execution receipt, outcome verification, post-action checkpoint, and teacher corrections.",
    tool: "teach_apprentice",
    input: "compact-learning-events.json, overlay packet, supervised action preflight, execution receipt, outcome verification, post-action evidence checkpoint, teacher boundary and counterexample",
    output: "review-only rule draft and replay card",
    continueWhen: "positive, counterexample, and transfer replay pass",
    stopWhen: "teacher has not approved memory or counterexample fails"
  },
  {
    id: "approve_or_correct",
    purpose: "Save only explicitly approved memory and narrow it when teacher says the result is wrong.",
    tool: "approve_teaching_memory / save_apprentice_memory / correct_last_result",
    input: "teacher approval or correction",
    output: "approved profile memory or narrowed disabled memory",
    continueWhen: "teacher explicitly asks to remember or save",
    stopWhen: "teacher says stop, no, not yet, or correction needed"
  }
];

const lowTokenPolicy = {
  fullContinuousRecording: false,
  evidencePreference: [
    "teacher learning method profile",
    "software control channel read-only probe",
    "software control channel profile before execution adapter selection",
    "existing software execution adapter selection",
    "supervised action preflight",
    "teacher-confirmed supervised execution gate",
    "execution receipt",
    "supervised action outcome verification",
    "compact learning event packet",
    "teacher-confirmed automatic observer schedule package",
    "metadata-only log source delta gate",
    "bounded all-software observer supervisor",
    "software observation delta monitor",
    "multi-software watch cycle",
    "log tail deltas",
    "Windows Event Log count and latest event preview",
    "file modified-time deltas",
    "manual teacher marker",
    "triggered screenshot only if cheap signals are ambiguous"
  ],
  retainedEvidenceLimits: {
    fullLogs: false,
    retainedSnippetLimitCharacters: 360,
    screenshotsByDefault: false,
    continuousVideoByDefault: false
  }
};

const teacherAdaptation = {
  teacherStyle,
  supportedTeachingMethods: [
    "teacher learning method profile",
    "ordered steps",
    "before/after examples",
    "voice explanation",
    "transparent overlay sketch",
    "2D plane sketch",
    "perspective drawing",
    "3D depth sketch",
    "screen event export",
    "software logs",
    "automatic low-token observer schedule",
    "software control channel read-only probe",
    "software control channel profile",
    "existing software execution adapter choice",
    "manual teacher marker",
    "plain correction after a failed attempt"
  ],
  adaptationRule:
    "Use the lowest-token evidence that the teacher naturally provides; ask for one boundary or counterexample when the next rule would otherwise overgeneralize."
};

const verificationReceiptTemplate = {
  format: "transparent_ai_teach_execute_learning_loop_verification_receipt_v1",
  loopId,
  status: "not_run_yet",
  stageResults: stages.map((stage) => ({
    stageId: stage.id,
    evidencePath: "",
    observedStatus: "not_run_yet",
    teacherReviewed: false,
    stopConditionTriggered: false,
    note: ""
  })),
  finalDecision: "needs_teacher_review",
  locks
};

const runbook = {
  format: "transparent_ai_teach_execute_learning_loop_v1",
  loopId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  productIntent:
    "Universal teachable apprentice loop: observe arbitrary software cheaply, adapt to the teacher's method, interpret visual/spatial demonstrations, preflight supervised actions before execution, execute only under teacher supervision, and learn from receipts/corrections.",
  lowTokenPolicy,
  teacherAdaptation,
  stages,
  requiredTeacherReviewPoints: [
    "software/source selection",
    "rule boundary and counterexample",
    "overlay spatial interpretation",
    "software control channel profile",
    "existing software execution adapter selection",
    "dry-run action plan",
    "supervised action preflight",
    "visible target window before execution",
    "execution receipt and post-action evidence",
    "supervised action outcome verification before learning",
    "memory approval"
  ],
  blockedClaims: [
    "universal native app control is proven",
    "background hidden execution is allowed",
    "continuous screen recording is default",
    "memory can be saved without teacher approval",
    "spatial intent can execute without teacher review"
  ],
  nextSuggestedTool: "create_software_observer_inventory",
  verificationReceiptTemplate: verifierTemplatePath,
  locks
};

writeFileSync(runbookPath, JSON.stringify(runbook, null, 2), "utf8");
writeFileSync(verifierTemplatePath, JSON.stringify(verificationReceiptTemplate, null, 2), "utf8");
writeFileSync(readmePath, [
  "# Teach Execute Learning Loop",
  "",
  `Goal: ${goal}`,
  `Software: ${software}`,
  "",
  "This runbook connects the existing Transparent AI Apprentice tools into one reviewable loop:",
  "",
  "1. Create a rollback point.",
  "2. Inventory software and cheap evidence sources.",
  "3. Turn inventory/probe output into a bounded per-software observer queue.",
  "4. Run one reviewed queue item into bounded-tail observation and compact learning events.",
  "5. Build a software profile and adaptive observer when deeper app-source discovery is needed.",
  "6. Create a software control-channel read-only probe to discover API, macro, CLI/script, browser/local-service, file import/export, and visible-window fallback clues without target commands.",
  "7. Collect universal observation without continuous recording.",
  "8. Compress observation into compact learning events.",
  "9. Use transparent overlay sketches when visual/spatial intent matters.",
  "10. Interpret 2D, perspective, and 3D depth cues.",
  "11. Create a software control-channel profile so API, macro, CLI/script, browser, or file import/export routes are reviewed before Windows UI fallback.",
  "12. Compile a supervised dry-run action plan.",
  "13. Run dry-run preflight first; block if the active target window, coordinates, or action risk do not match teacher review.",
  "14. Link reviewed observation and overlay into action rehearsal.",
  "15. Pass the action rehearsal through the supervised execution gate; default to dry-run and require target-window evidence for execute mode.",
  "16. Verify the supervised action outcome with receipt plus metadata-only post-action signals before screenshots or learning.",
  "17. Teach from compact events, overlay packet, preflight, receipt, outcome verification, corrections, and counterexamples.",
  "",
  "Locked defaults: accepted=false, ruleEnabled=false, technologyAccepted=false, packagingGated=true, fullContinuousRecording=false, nativeUniversalExecution=false.",
  "",
  "Generated files:",
  `- ${basename(runbookPath)}`,
  `- ${basename(verifierTemplatePath)}`
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_teach_execute_learning_loop_result_v1",
  loopId,
  runbookPath,
  teacherReadme: readmePath,
  verificationReceiptTemplate: verifierTemplatePath,
  stageCount: stages.length,
  toolChain: stages.map((stage) => stage.tool),
  fullContinuousRecording: false,
  nativeUniversalExecution: false,
  reviewLocks: locks
}, null, 2));
