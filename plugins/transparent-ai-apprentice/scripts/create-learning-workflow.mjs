#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function multiArg(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && index + 1 < process.argv.length) {
      values.push(process.argv[index + 1]);
    }
  }
  return values;
}

function slugify(value) {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return ascii || `workflow-${Date.now()}`;
}

function textOrFallback(value, fallback) {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

const goal = textOrFallback(
  argValue("--goal", argValue("--task")),
  "Teach an apprentice to perform a repeatable digital helper task."
);
const domain = textOrFallback(argValue("--domain", argValue("--software", argValue("--tool"))), "digital office work");
const futureInput = textOrFallback(
  argValue("--future-input"),
  "A new task that looks similar on the surface but has a changed detail the apprentice must evaluate."
);
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "learning-workflows")));
const teacherExamples = multiArg("--example");
const teacherCounterexamples = multiArg("--counterexample");
const workflowId = `${slugify(`${domain}-${goal}`)}-${Date.now()}`;
const workflowDir = join(outputRoot, workflowId);
mkdirSync(workflowDir, { recursive: true });

const locks = {
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  privateChainOfThoughtExposed: false
};

const lowTokenObservationPolicy = {
  strategy: "event_driven_low_token_observation",
  fullContinuousRecording: false,
  observeCheapSignalsFirst: [
    "file modified time",
    "log source metadata-only delta gate before tail reads",
    "log tail delta",
    "baseline-vs-current compact observation delta",
    "multi-software watch cycle with persisted baselines",
    "event log count and last event type",
    "teacher before/after marker",
    "manual teacher note",
    "structured recorder export"
  ],
  escalateToScreenshotOnlyWhen: [
    "error keyword or exception appears",
    "state changes from normal to blocked, failed, or exported",
    "watch_log_source_metadata_deltas reports changed size or mtime and emits a narrowed queue",
    "monitor_software_observation_deltas classifies the change as failure, warning, ambiguity, or teacher-marker request",
    "teacher drops a before/after marker",
    "the apprentice cannot infer the cause from logs or structured events",
    "the teacher explicitly asks for a screenshot"
  ],
  askTeacherOnlyWhen: [
    "the same surface cue can mean two different actions",
    "a missing policy boundary would change the result",
    "confidence is low after cheap signal review",
    "a proposed reusable rule would affect future work"
  ],
  compactEvidenceFormat: "transparent_ai_workalong_observation_v1",
  compactUniversalLearningEventFormat: "transparent_ai_compact_learning_events_from_universal_observation_v1",
  unifiedTeachExecuteLoopFormat: "transparent_ai_teach_execute_learning_loop_v1"
};

const rollbackPolicy = {
  strategy: "periodic_teacher_confirmed_rollback_points",
  createRollbackPointBefore: [
    "starting a new learning direction",
    "importing a large demonstration or work-along observation",
    "applying a teacher correction to memory",
    "saving approved profile memory",
    "packaging or refreshing a plugin/cache install"
  ],
  keepUntil: "teacher confirms the current direction is correct",
  deleteOnlyAfterTeacherConfirmation: true,
  recommendedTools: ["create_rollback_point", "confirm_rollback_point"],
  rollbackPointFormat: "transparent_ai_rollback_point_v1"
};

const phases = [
  {
    id: "rollback_checkpoint",
    name: "Rollback checkpoint",
    purpose: "Create a recoverable snapshot before changing direction, memory, package state, or cached install state.",
    requiredEvidence: ["rollback point manifest", "snapshot source paths", "teacher-confirmation-required cleanup rule"],
    output: "transparent_ai_rollback_point_v1"
  },
  {
    id: "consent_scope",
    name: "Consent and scope",
    purpose: "Define the repeatable job, allowed tools, privacy boundary, and stop conditions before observation.",
    requiredEvidence: ["teacher goal", "allowed software or artifact sources", "privacy or do-not-record boundary"],
    output: "scope card with locks closed"
  },
  {
    id: "teacher_method_profile",
    name: "Teacher method profile",
    purpose: "Route the apprentice toward the teacher's preferred learning method before spending observation, screenshot, or execution budget.",
    requiredEvidence: ["teacher style hint or default method profile", "preferred evidence order", "question policy"],
    output: "transparent_ai_teacher_learning_method_profile_v1"
  },
  {
    id: "observe",
    name: "Low-token observation",
    purpose: "Collect only high-signal evidence from demonstrations, examples, logs, work-along events, voice transcripts, or existing drawings.",
    requiredEvidence: ["at least one positive demonstration or example", "cheap signal summary before screenshots"],
    output: "compact observation packet"
  },
  {
    id: "decompose",
    name: "Task decomposition",
    purpose: "Break the skill into inputs, state variables, decision points, actions, outputs, and validation checks.",
    requiredEvidence: ["primitive action list", "input and output schema", "decision point list"],
    output: "competency map"
  },
  {
    id: "causal_model",
    name: "Causal model",
    purpose: "Explain why each decision should happen, which invariant it depends on, and what evidence would overturn it.",
    requiredEvidence: ["why this action", "required precondition", "rule-breaking evidence"],
    output: "causal rule draft"
  },
  {
    id: "boundaries_counterexamples",
    name: "Boundaries and counterexamples",
    purpose: "Record where the learned behavior must not apply so the apprentice does not memorize surface cues.",
    requiredEvidence: ["negative example", "edge case", "must-not-apply cue"],
    output: "counterexample gate"
  },
  {
    id: "practice_replay",
    name: "Practice and replay",
    purpose: "Run positive, negative, and transfer tasks through the disabled draft before saving memory.",
    requiredEvidence: ["positive replay", "counterexample replay", "transfer replay"],
    output: "review-only replay report"
  },
  {
    id: "evaluation_gates",
    name: "Mastery gates",
    purpose: "Block memory until the apprentice can explain, apply, refuse, transfer, and recover from failure.",
    requiredEvidence: ["causal explanation", "counterexample pass", "reproduction evidence", "failure recovery plan"],
    output: "mastery assessment"
  },
  {
    id: "approval_memory",
    name: "Teacher approval and memory",
    purpose: "Save reusable memory only after explicit teacher approval of the replayed behavior.",
    requiredEvidence: ["explicit approval", "profile name", "approved replay summary"],
    output: "approved profile memory, only if teacher says remember or save"
  },
  {
    id: "deployment_monitor",
    name: "Run, monitor, correct",
    purpose: "Use approved memory for repeat work, monitor failures cheaply, and feed corrections back into narrower memory.",
    requiredEvidence: ["learned-work run", "observed mismatch or success", "teacher correction if mismatch"],
    output: "updated review queue"
  }
];

const competencyMap = {
  taskGoal: goal,
  domain,
  conceptsToLearn: [
    "goal and success definition",
    "input facts that matter",
    "state transitions that change the action",
    "validation signals after action",
    "teacher preference and style constraints"
  ],
  primitives: [
    "observe cheap signal",
    "summarize evidence",
    "select action",
    "ask a short question when boundary is missing",
    "execute or draft output",
    "verify result",
    "record correction"
  ],
  decisionPoints: [
    "Is this the learned task or a new teaching request?",
    "Which evidence changes the action?",
    "Is a counterexample present?",
    "Is confidence high enough to proceed without asking?",
    "Did validation prove the output matches the teacher's intent?"
  ],
  invariants: [
    "Do not save memory without explicit teacher approval.",
    "Do not apply a rule when its boundary evidence is missing or contradicted.",
    "Do not replace cheap logs and structured events with continuous screen recording by default.",
    "Do not expose private chain-of-thought; show structured trace rows only."
  ],
  failureModes: [
    "surface-cue matching without causal evidence",
    "over-broad rule that fires on counterexamples",
    "teacher correction ignored after replay",
    "screen evidence collected continuously when event-driven evidence is enough",
    "memory saved before reproduction"
  ]
};

const practicePlan = {
  positiveExamples:
    teacherExamples.length > 0
      ? teacherExamples
      : [
          `${domain}: example where the evidence fully supports the learned action.`,
          `${domain}: second positive example with different wording or UI state.`
        ],
  counterexamples:
    teacherCounterexamples.length > 0
      ? teacherCounterexamples
      : [
          `${domain}: looks similar but lacks the deciding evidence, so the apprentice must not apply the learned action.`,
          `${domain}: contains a conflict or missing boundary, so the apprentice must ask the teacher first.`
        ],
  transferTasks: [
    futureInput,
    `${domain}: same underlying rule in a new file, customer, ticket, drawing, or software state.`
  ],
  failureRecovery: [
    "Capture the mismatch as a correction with correct_last_result.",
    "Narrow the saved profile memory instead of adding a broader duplicate.",
    "Add the failed input as a new counterexample before the next approval."
  ]
};

const masteryGates = {
  requiresTeacherApproval: true,
  requiresReproduction: true,
  requiresFailureRecovery: true,
  minimumPositiveReplays: 2,
  minimumCounterexamples: 1,
  minimumTransferTasks: 1,
  canExplainCausalModel: true,
  canRefuseOutOfScopeInput: true,
  canAskWhenBoundaryMissing: true,
  memorySaveBlockedUntil: [
    "positive replay passes",
    "counterexample replay does not trigger the learned action",
    "transfer replay preserves the same underlying logic",
    "teacher explicitly says approve and remember"
  ]
};

const antiParrotChecks = [
  {
    id: "causal_explanation_required",
    prompt: "Explain which evidence caused the action and which invariant would stop it.",
    requiredEvidence: "The answer names the deciding fact, not only a copied phrase."
  },
  {
    id: "counterexample_gate_required",
    prompt: "Run a near-match counterexample before memory approval.",
    requiredEvidence: "The learned action stays disabled or asks the teacher on the counterexample."
  },
  {
    id: "transfer_reproduction_required",
    prompt: "Apply the same logic to a changed future input.",
    requiredEvidence: "The apprentice keeps the rule logic while adapting surface wording or UI details."
  },
  {
    id: "failure_recovery_required",
    prompt: "When the teacher says it failed, record why and narrow the memory.",
    requiredEvidence: "A correction updates the review queue or profile memory instead of being ignored."
  }
];

const nextMcpCalls = [
  {
    phase: "rollback_checkpoint",
    tool: "create_rollback_point",
    when: "Before a learning direction, memory, package, or cache change could be hard to undo."
  },
  {
    phase: "rollback_checkpoint",
    tool: "confirm_rollback_point",
    when: "Only after the teacher confirms the current direction is correct and the rollback point can be marked or deleted."
  },
  {
    phase: "teacher_method_profile",
    tool: "create_teacher_learning_method_profile",
    when: "Before choosing logs, examples, voice, transparent overlay, or screenshots, infer how this teacher prefers to demonstrate, correct, and review."
  },
  {
    phase: "observe",
    tool: "create_workalong_teaching_kit",
    when: "The teacher wants Codex to learn beside desktop/domain software with logs, event deltas, and triggered screenshots."
  },
  {
    phase: "observe",
    tool: "create_all_software_observer_bootstrap",
    when: "The teacher asks for automatic low-token log learning across all software and needs inventory, private-app exclusions, queue creation, and watch baselines chained in one reviewable packet."
  },
  {
    phase: "observe",
    tool: "create_software_observer_inventory",
    when: "The teacher asks about all software, all logs, or a computer-wide setup before choosing which apps should get per-software observers."
  },
  {
    phase: "observe",
    tool: "create_software_observer_queue",
    when: "A read-only all-software inventory/probe output should become a bounded per-software observer queue with profile, universal observer, and compact-learning calls."
  },
  {
    phase: "observe",
    tool: "watch_log_source_metadata_deltas",
    when: "A reviewed observer queue should compare only log source metadata first and skip tail reads/screenshots when nothing changed."
  },
  {
    phase: "observe",
    tool: "run_software_observer_queue_item",
    when: "A teacher-reviewed queue item should be run into bounded-tail observation evidence and compact learning events before teach_apprentice."
  },
  {
    phase: "observe",
    tool: "monitor_software_observation_deltas",
    when: "A baseline and current observation/queue snapshot should be compared before spending tokens on screenshots."
  },
  {
    phase: "observe",
    tool: "run_all_software_observer_supervisor",
    when: "A reviewed software observer queue should be checked over bounded repeated cycles, stopping on meaningful deltas before screenshots or memory."
  },
  {
    phase: "observe",
    tool: "create_automatic_observer_schedule",
    when: "A reviewed queue should be prepared for recurring low-token supervisor runs through a teacher-confirmed Windows Scheduled Task package."
  },
  {
    phase: "observe",
    tool: "run_software_observer_watch_cycle",
    when: "Multiple reviewed software queue items should be scanned in one low-token cycle with persisted baselines."
  },
  {
    phase: "observe",
    tool: "create_software_capability_profile",
    when: "The target software is unfamiliar and the apprentice should first discover process/window/log/event/file-delta sources before screenshots."
  },
  {
    phase: "observe",
    tool: "create_adaptive_software_observer_from_profile",
    when: "A reviewed software profile or read-only probe result should be bridged into selected log/event sources and a universal low-token observer setup."
  },
  {
    phase: "observe",
    tool: "create_universal_software_observer_kit",
    when: "The software profile or teacher hints identify cheap sources, so the apprentice can collect logs, event logs, process/window clues, file deltas, and teacher markers first."
  },
  {
    phase: "observe",
    tool: "compact_universal_observation_learning_events",
    when: "A universal observation packet should be compressed into teacher-reviewable learning events before memory or action planning."
  },
  {
    phase: "observe",
    tool: "create_transparent_sketch_overlay_kit",
    when: "The teacher wants to draw a 2D, perspective, or 3D spatial correction over the target software as teaching evidence."
  },
  {
    phase: "practice_replay",
    tool: "create_teach_execute_learning_loop",
    when: "The teacher wants the whole low-token observe -> visual intent -> supervised execution receipt -> correction memory loop in one ordered runbook."
  },
  {
    phase: "practice_replay",
    tool: "interpret_transparent_sketch_spatial_intent",
    when: "A transparent overlay packet should be interpreted into 2D position, perspective, relative-anchor, and 3D depth intent before actions."
  },
  {
    phase: "practice_replay",
    tool: "create_existing_software_execution_adapter",
    when: "Reviewed spatial intent or an action plan should choose an existing browser, CLI/API, file import/export, or supervised Windows UI route before execution."
  },
  {
    phase: "practice_replay",
    tool: "create_supervised_software_action_kit",
    when: "A reviewed transparent overlay packet should become a dry-run-first click, drag, type, or hotkey action plan for visible teacher-supervised software execution."
  },
  {
    phase: "practice_replay",
    tool: "verify_supervised_action_outcome",
    when: "A supervised action runner wrote a preflight and execution receipt; verify outcome using receipt plus metadata-only log/file deltas before screenshots or memory."
  },
  {
    phase: "observe",
    tool: "teach_apprentice",
    when: "The teacher pastes examples, steps, files, recording events, voice transcript, or finalized work-along observation."
  },
  {
    phase: "practice_replay",
    tool: "run_apprentice_profile",
    when: "A saved approved profile memory should perform learned work on a new input."
  },
  {
    phase: "deployment_monitor",
    tool: "correct_last_result",
    when: "The output is stale, too broad, too narrow, or misses a boundary."
  },
  {
    phase: "deployment_monitor",
    tool: "review_apprentice_profile",
    when: "The teacher or agent needs to inspect approved memory and disabled/review items."
  }
];

const workflow = {
  format: "transparent_ai_learning_workflow_v1",
  workflowId,
  createdAt: new Date().toISOString(),
  goal,
  domain,
  intendedProductShape: "digital helper for repeatable worker tasks",
  principle:
    "Human teaches -> apprentice observes -> apprentice decomposes -> teacher corrects -> system extracts causal rules and counterexamples -> apprentice replays -> teacher approves -> approved memory performs repeat work -> failures feed back into narrower memory.",
  lowTokenObservationPolicy,
  rollbackPolicy,
  phases,
  competencyMap,
  practicePlan,
  masteryGates,
  antiParrotChecks,
  nextMcpCalls,
  reviewLocks: locks
};

const workflowPath = join(workflowDir, "learning-workflow.json");
const readmePath = join(workflowDir, "LEARNING_WORKFLOW_START_HERE.md");
writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), "utf8");
writeFileSync(
  readmePath,
  [
    `# Transparent AI Apprentice Learning Workflow`,
    ``,
    `Goal: ${goal}`,
    `Domain: ${domain}`,
    ``,
    `Use this as the teacher-facing runbook for a repeatable digital-helper skill.`,
    ``,
    `1. Confirm scope, privacy, allowed tools, and stop conditions.`,
    `2. Observe with cheap signals first: logs, event deltas, file timestamps, teacher markers, and structured exports.`,
    `3. Capture screenshots only on errors, state changes, explicit teacher markers, or low-confidence ambiguity.`,
    `4. Decompose the task into inputs, state variables, decisions, actions, outputs, and validation.`,
    `5. Write the causal model: why each action happens and what evidence would stop it.`,
    `6. Add at least one counterexample before approving memory.`,
    `7. Replay positive, counterexample, and transfer tasks while the rule is still disabled.`,
    `8. Do not approve memory until reproduction, counterexample, transfer, and failure-recovery gates are satisfied.`,
    `9. Save to profile only when the teacher explicitly says approve and remember.`,
    `10. During real learned work, correct failures with correct_last_result and narrow memory instead of broadening it.`,
    ``,
    `Locked defaults: accepted=false, ruleEnabled=false, technologyAccepted=false, packagingGated=true.`,
    ``,
    `Generated files:`,
    `- ${basename(workflowPath)}`,
    `- ${basename(readmePath)}`
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_learning_workflow_result_v1",
      workflowId,
      workflowPath,
      teacherReadme: readmePath,
      closedLoopSummary: {
        phases: phases.map((phase) => phase.id),
        lowTokenObservation: lowTokenObservationPolicy.strategy,
        rollbackPolicy: rollbackPolicy.strategy,
        antiParrotChecks: antiParrotChecks.map((check) => check.id),
        masteryGates
      },
      nextMcpCalls,
      reviewLocks: locks
    },
    null,
    2
  )
);
