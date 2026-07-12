#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormats = []) {
  const text = String(input || "").trim();
  if (!text) return null;
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormats.length && !expectedFormats.includes(parsed.value?.format)) {
    throw new Error(`${label} must be one of ${expectedFormats.join(", ")}`);
  }
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashText(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function slugify(value) {
  return (
    String(value || "teacher-method-execution-learning-contract")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 96) || "teacher-method-execution-learning-contract"
  );
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    if (value === true) {
      parts.push(flag);
      continue;
    }
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    contractOnly: true,
    accepted: false,
    ruleEnabled: false,
    draftRulesEnabled: false,
    activeRulePackageCompiled: false,
    memoryEnabled: false,
    memoryWritten: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRead: false,
    scheduledTaskInstalled: false,
    technologyAccepted: false,
    packagingGated: true,
    packagingUnlocked: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function modeNames(profile) {
  return (Array.isArray(profile.preferredTeachingModes) ? profile.preferredTeachingModes : [])
    .map((mode) => mode?.mode)
    .filter(Boolean);
}

function routeContract(id, mode, summary, policy, evidence = {}) {
  return {
    id,
    teacherMode: mode,
    summary,
    policy,
    evidence,
    defaultDecision: "needs_teacher_review",
    reviewOnly: true,
    executeNow: false,
    ruleEnabled: false,
    memoryWriteAllowed: false,
    packagingGated: true
  };
}

function buildContracts({ profile, lowTokenHandoff, sketchRuleDraft }) {
  const modes = new Set(modeNames(profile));
  modes.add("ordered_steps");
  const contracts = [];

  if (modes.has("software_log_deltas") || profile.lowTokenRoute) {
    contracts.push(
      routeContract(
        "low_token_log_metadata_first",
        "software_log_deltas",
        "Use log/event/file metadata deltas first; read bounded tails only after a cheap change marker is present.",
        {
          defaultObservation: "metadata_delta_gate",
          fullLogPolicy: "blocked_by_default",
          boundedTailPolicy: "allowed_only_after_metadata_change_and_teacher_scope",
          screenshotPolicy: "triggered_only_when_metadata_is_ambiguous",
          learningSignal: "compact_learning_event_review_before_rule_draft",
          tokenBudgetIntent: "avoid_continuous_recording_and_full_log_reads"
        },
        {
          handoffPath: lowTokenHandoff?.path || "",
          handoffStatus: lowTokenHandoff?.value?.status || "",
          compactLearningEvents: lowTokenHandoff?.value?.counts?.compactLearningEvents || 0
        }
      )
    );
  }

  if (modes.has("transparent_overlay_sketch") || modes.has("spatial_intent_review") || sketchRuleDraft) {
    contracts.push(
      routeContract(
        "transparent_overlay_spatial_intent",
        modes.has("transparent_overlay_sketch") ? "transparent_overlay_sketch" : "spatial_intent_review",
        "Teacher overlay strokes must become numbered targets plus reviewed 2D, angle, perspective, and 3D depth logic before execution.",
        {
          overlayPolicy: "teacher_draws_on_transparent_mask",
          intentPolicy: "interpret_position_angle_perspective_depth_then_number_targets",
          confirmationPolicy: "teacher_confirms_numbered_target_before_execution",
          visualSimilarityPolicy: "blocked_without_logic_contract",
          missingLogicPolicy: "route_to_high_reasoning_teacher_review",
          executionPolicy: "execution_gate_only_after_teacher_confirmed_spatial_intent_and_active_rules"
        },
        {
          ruleDraftPath: sketchRuleDraft?.path || "",
          ruleDraftStatus: sketchRuleDraft?.value?.status || "",
          disabledRuleCount: sketchRuleDraft?.value?.disabledRuleCount || 0,
          requiredScopes: sketchRuleDraft?.value?.detailLogicContractSummary?.requiredScopes || []
        }
      )
    );
  }

  if (modes.has("correction_first") || profile.correctionPolicy) {
    contracts.push(
      routeContract(
        "correction_boundary_counterexample",
        "correction_first",
        "Teacher corrections become boundaries and counterexamples before any memory or active rule promotion.",
        {
          correctionCapture: "record_boundary_counterexample_and_wrong_output",
          ruleDraftPolicy: "draft_disabled_until_teacher_reviews_replay",
          repairPolicy: "return_to_high_reasoning_for_rule_repair_on_mismatch",
          replayPolicy: "show structured trace_and_validation_before_promotion"
        }
      )
    );
  }

  if (modes.has("voice_explanation")) {
    contracts.push(
      routeContract(
        "voice_or_text_instruction_to_numbered_confirmation",
        "voice_explanation",
        "Voice or typed instructions are transcribed into candidate intent, then shown as numbered targets for teacher confirmation.",
        {
          speechPolicy: "transcript_is_instruction_evidence_not_execution_authority",
          ambiguityPolicy: "ask_short_boundary_question_or_show_numbered_candidates",
          executionPolicy: "no_action_until_teacher_confirms_candidate_number"
        }
      )
    );
  }

  if (modes.has("before_after_examples")) {
    contracts.push(
      routeContract(
        "example_pair_to_rule_boundary",
        "before_after_examples",
        "Before/after examples become reusable boundary tests so the apprentice learns strict detail logic instead of surface resemblance.",
        {
          examplePolicy: "extract_changed_features_relations_and_invariants",
          validationPolicy: "new_output_must_pass_example_boundary_checks",
          uncertaintyPolicy: "unknown_blocks_execution_under_active_blocking_rule"
        }
      )
    );
  }

  if (modes.has("silent_workalong_until_trigger")) {
    contracts.push(
      routeContract(
        "silent_workalong_boundary_gates",
        "silent_workalong_until_trigger",
        "Ask fewer questions while still stopping at reusable-rule, target-execution, and memory-promotion gates.",
        {
          questionPolicy: "ask_only_at_boundaries",
          triggerPolicy: "metadata_delta_overlay_ambiguity_or_rule_boundary",
          continuousRecordingPolicy: "blocked"
        }
      )
    );
  }

  if (modes.has("triggered_screenshot")) {
    contracts.push(
      routeContract(
        "triggered_visual_check_after_cheap_evidence",
        "triggered_screenshot",
        "Screenshots are a fallback visual check only after cheaper metadata or overlay evidence cannot disambiguate.",
        {
          screenshotPolicy: "triggered_only",
          precondition: "cheap_evidence_ambiguous_or_teacher_marker_requires_view",
          retentionPolicy: "bounded_review_packet_only"
        }
      )
    );
  }

  const coveredModes = new Set(contracts.map((contract) => contract.teacherMode));
  const unmappedModes = [...modes].filter((mode) => !coveredModes.has(mode));
  for (const mode of unmappedModes) {
    contracts.push(
      routeContract(
        `custom_teacher_method_extension.${slugify(mode)}`,
        mode,
        "Unrecognized teacher method is preserved as a review-only extension lane instead of being flattened into a generic agent action.",
        {
          extensionPolicy: "ask_teacher_for_one_example_boundary_and_one_counterexample",
          evidencePolicy: "prefer_low_token_structured_evidence",
          rulePolicy: "draft_disabled_only_until_reviewed"
        }
      )
    );
  }

  contracts.push(
    routeContract(
      "confirmed_execution_gate",
      "all_teacher_methods",
      "No visible software action can run until teacher intent, evidence packet, active rules, rollback point, and execution adapter are all confirmed.",
      {
        requiresTeacherConfirmedTarget: true,
        requiresRollbackPoint: true,
        requiresActiveBlockingRulesOnlyAfterReview: true,
        requiresAdapterDryRun: true,
        noNativeUniversalExecutionClaim: true
      }
    )
  );

  return contracts;
}

const profileInput = readJsonInput(
  argValue("--profile", argValue("--teacher-method-profile", "")),
  "--profile",
  ["transparent_ai_teacher_learning_method_profile_v1"]
);
if (!profileInput) throw new Error("--profile is required");

const teacherReviewedMethod = hasFlag("--teacher-reviewed-method");
if (!teacherReviewedMethod) throw new Error("TEACHER_METHOD_CONTRACT_REQUIRES_TEACHER_REVIEWED_METHOD_FLAG");

const rollbackPoint = resolve(argValue("--rollback-point", ""));
if (!rollbackPoint || !existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint}`);

const lowTokenHandoff = readJsonInput(
  argValue("--low-token-learning-handoff", ""),
  "--low-token-learning-handoff",
  ["transparent_ai_original_goal_low_token_compact_evidence_learning_handoff_v1"]
);
const sketchRuleDraft = readJsonInput(
  argValue("--transparent-sketch-rule-draft", argValue("--sketch-rule-draft", "")),
  "--transparent-sketch-rule-draft",
  ["transparent_ai_transparent_sketch_logic_contract_rule_draft_v1"]
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "teacher-method-execution-learning-contracts")
  )
);

const profile = profileInput.value;
const lockState = locks();
const contractId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(profile.profileId || profile.goal)}`;
const contractDir = join(outputRoot, contractId);
const contractPath = join(contractDir, "teacher-method-execution-learning-contract.json");
const readmePath = join(contractDir, "TEACHER_METHOD_EXECUTION_LEARNING_CONTRACT_START_HERE.md");
const routeContracts = buildContracts({ profile, lowTokenHandoff, sketchRuleDraft });
const routeIds = routeContracts.map((contract) => contract.id);

const modelTierPolicy = {
  format: "transparent_ai_high_to_medium_reasoning_runtime_policy_v1",
  highReasoningUseCases: [
    "extract reusable logic from teacher correction",
    "turn transparent sketch perspective/depth intent into strict rule drafts",
    "repair a rule when teacher finds a mismatch",
    "decide whether missing evidence should block execution"
  ],
  mediumReasoningUseCases: [
    "run already reviewed deterministic workflow",
    "apply active reviewed rule package to routine evidence",
    "prepare numbered confirmation candidates from known schema"
  ],
  downgradeCondition:
    "Only after teacher-reviewed contract, active rule package, rollback point, and execution adapter dry-run are all present.",
  escalationCondition:
    "Any teacher correction, unknown validator result, missing logic source, or spatial ambiguity returns to high reasoning before execution.",
  costReductionIntent:
    "Spend high reasoning on rule construction and repair, then use medium reasoning for confirmed repeat execution."
};

const coverage = {
  teacherModes: modeNames(profile),
  routeContractCount: routeContracts.length,
  lowTokenMetadataFirst:
    routeIds.includes("low_token_log_metadata_first") &&
    routeContracts.some((contract) => contract.policy?.fullLogPolicy === "blocked_by_default"),
  transparentOverlaySpatialIntent: routeIds.includes("transparent_overlay_spatial_intent"),
  correctionBoundaryCounterexample: routeIds.includes("correction_boundary_counterexample"),
  highToMediumModelTierPolicy: modelTierPolicy.format === "transparent_ai_high_to_medium_reasoning_runtime_policy_v1",
  everyTeacherModeHasRoute: modeNames(profile).every((mode) =>
    routeContracts.some((contract) => contract.teacherMode === mode || contract.id.endsWith(slugify(mode)))
  )
};

const packet = {
  ok: true,
  format: "transparent_ai_teacher_method_execution_learning_contract_v1",
  contractId,
  createdAt: new Date().toISOString(),
  status: "ready_for_teacher_method_execution_learning_contract_review",
  profilePath: profileInput.path,
  lowTokenLearningHandoffPath: lowTokenHandoff?.path || "",
  transparentSketchRuleDraftPath: sketchRuleDraft?.path || "",
  rollbackPoint,
  teacherReviewedMethod,
  goal: profile.goal || "",
  software: profile.software || "target software",
  teacherMethodSummary: profile.teacherSignalSummary || {},
  routeContracts,
  modelTierPolicy,
  nextPreparedCommands: {
    lowTokenLearningReviewValidation: lowTokenHandoff
      ? commandLine("validate-original-goal-low-token-compact-evidence-learning-review-receipt.mjs", [
          ["--handoff", lowTokenHandoff.path],
          ["--receipt", "<teacher-filled-compact-learning-review-receipt.json>"],
          ["--output-dir", join(contractDir, "low-token-learning-review-validation")]
        ])
      : "",
    transparentSketchRuleDraft: commandLine("create-transparent-sketch-logic-contract-rule-draft.mjs", [
      ["--spatial-intent", "<teacher-reviewed-spatial-intent-interpretation.json>"],
      ["--rollback-point", rollbackPoint],
      ["--teacher-reviewed-spatial-intent", true],
      ["--output-dir", join(contractDir, "transparent-sketch-logic-contract-rule-draft")]
    ]),
    compactEvidenceRequest: commandLine("create-original-goal-low-token-compact-evidence-request-pack.mjs", [
      ["--goal", profile.goal || "<goal>"],
      ["--software", profile.software || "<software>"],
      ["--output-dir", join(contractDir, "low-token-compact-evidence-request")]
    ]),
    transparentSketchDepthRehearsal: commandLine("create-transparent-sketch-depth-demonstration-rehearsal.mjs", [
      ["--goal", profile.goal || "<goal>"],
      ["--software", profile.software || "<software>"],
      ["--selected-number", "1"],
      ["--teacher-confirmed-number", true],
      ["--output-dir", join(contractDir, "transparent-sketch-depth-rehearsal")]
    ])
  },
  coverage,
  blockedActions: [
    "continuous_full_screen_recording_by_default",
    "read_full_logs_without_metadata_trigger",
    "execute_software_from_teacher_method_profile",
    "execute_from_visual_similarity_without_logic",
    "write_long_term_memory_from_unreviewed_correction",
    "enable_rule_without_teacher_review",
    "downgrade_to_medium_reasoning_before_contract_review",
    "claim_universal_native_execution",
    "unlock_packaging",
    "claim_goal_complete"
  ],
  locks: lockState,
  executeNow: false,
  goalComplete: false,
  evidenceHash: hashText(JSON.stringify({ profile, lowTokenHandoff: lowTokenHandoff?.value || null, sketchRuleDraft: sketchRuleDraft?.value || null }))
};

writeJson(contractPath, packet);
writeFileSync(
  readmePath,
  [
    "# Teacher Method Execution Learning Contract",
    "",
    `Status: ${packet.status}`,
    `Profile: ${packet.profilePath}`,
    `Route contracts: ${routeContracts.length}`,
    "",
    "This contract connects teacher learning method adaptation to low-token evidence collection, transparent sketch spatial intent, correction-first rule repair, and the high-to-medium reasoning cost-control lane.",
    "It is review-only. It does not execute target software, read full logs, capture screenshots, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Coverage:",
    `- Low-token metadata first: ${coverage.lowTokenMetadataFirst}`,
    `- Transparent overlay spatial intent: ${coverage.transparentOverlaySpatialIntent}`,
    `- Correction boundary/counterexample: ${coverage.correctionBoundaryCounterexample}`,
    `- High-to-medium model tier policy: ${coverage.highToMediumModelTierPolicy}`,
    `- Every teacher mode has a route: ${coverage.everyTeacherModeHasRoute}`
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      status: packet.status,
      contractPath,
      readmePath,
      routeContractCount: routeContracts.length,
      coverage,
      locks: lockState,
      executeNow: false,
      goalComplete: false
    },
    null,
    2
  )
);
