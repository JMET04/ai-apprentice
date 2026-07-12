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
    if (process.argv[index] === name && index + 1 < process.argv.length) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return String(value || "teacher-method")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "teacher-method";
}

function safeText(value = "", max = 260) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function includesAny(text, markers) {
  return markers.some((marker) => text.includes(marker));
}

function addMode(modes, mode) {
  const existing = modes.get(mode.mode);
  if (!existing || mode.confidence > existing.confidence) {
    modes.set(mode.mode, mode);
  }
}

const goal = argValue("--goal", argValue("--task", "Adapt the apprentice to the teacher's learning and teaching method."));
const software = argValue("--software", argValue("--app", "target software"));
const teacherMessage = argValue("--teacher-message", argValue("--message", ""));
const teacherStyle = argValue("--teacher-style", argValue("--style", argValue("--learning-method", "")));
const correction = argValue("--correction", argValue("--teacher-correction", ""));
const preferredTone = argValue("--preferred-tone", "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "teacher-method-profiles")));
const evidencePreferences = [...multiArg("--evidence"), ...multiArg("--evidence-preference")];
const preferredTools = [...multiArg("--preferred-tool"), ...multiArg("--tool")];

const profileId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const profileDir = join(outputRoot, profileId);
mkdirSync(profileDir, { recursive: true });

const combinedText = [goal, software, teacherMessage, teacherStyle, correction, preferredTone, ...evidencePreferences, ...preferredTools]
  .join(" ")
  .toLowerCase();

const modes = new Map();

addMode(modes, {
  mode: "ordered_steps",
  confidence: includesAny(combinedText, ["step", "first", "then", "next", "sequence", "ordered", "checklist", "步骤", "先", "然后", "接着", "顺序"]) ? 0.88 : 0.55,
  detectedFrom: "teacher message or default teaching baseline",
  evidenceCost: "low",
  recommendedTool: "create_action_sequence_artifact"
});

if (includesAny(combinedText, ["example", "before", "after", "table", "csv", "case", "样例", "例子", "表格", "前后", "对照"])) {
  addMode(modes, {
    mode: "before_after_examples",
    confidence: 0.9,
    detectedFrom: "example/table preference",
    evidenceCost: "low",
    recommendedTool: "teach_apprentice"
  });
}

if (includesAny(combinedText, ["draw", "sketch", "overlay", "mask", "transparent", "2d", "3d", "depth", "perspective", "草图", "画", "绘制", "蒙版", "透明", "二维", "三维", "深度", "透视"])) {
  addMode(modes, {
    mode: "transparent_overlay_sketch",
    confidence: 0.94,
    detectedFrom: "visual/spatial teaching preference",
    evidenceCost: "medium",
    recommendedTool: "create_transparent_sketch_overlay_kit"
  });
  addMode(modes, {
    mode: "spatial_intent_review",
    confidence: 0.9,
    detectedFrom: "2D, perspective, or 3D depth cue",
    evidenceCost: "medium",
    recommendedTool: "interpret_transparent_sketch_spatial_intent"
  });
}

if (includesAny(combinedText, ["voice", "speak", "say", "talk", "dictation", "tone", "语音", "说话", "口述", "听写", "语气"])) {
  addMode(modes, {
    mode: "voice_explanation",
    confidence: 0.86,
    detectedFrom: "voice or tone preference",
    evidenceCost: "low",
    recommendedTool: "create_voice_teaching_kit"
  });
}

if (includesAny(combinedText, ["log", "event", "delta", "watch", "metadata", "low token", "screen only", "日志", "事件", "变化", "低token", "少token", "截图"])) {
  addMode(modes, {
    mode: "software_log_deltas",
    confidence: 0.92,
    detectedFrom: "low-token software observation preference",
    evidenceCost: "very_low",
    recommendedTool: "watch_log_source_metadata_deltas"
  });
}

if (includesAny(combinedText, ["correction", "wrong", "not right", "only when", "unless", "boundary", "纠正", "不对", "错", "只有", "除非", "边界"])) {
  addMode(modes, {
    mode: "correction_first",
    confidence: 0.88,
    detectedFrom: "teacher correction or boundary language",
    evidenceCost: "low",
    recommendedTool: "correct_last_result"
  });
}

if (includesAny(combinedText, ["silent", "don't ask", "ask less", "少问", "不要一直问", "别一直问", "自动", "别打扰"])) {
  addMode(modes, {
    mode: "silent_workalong_until_trigger",
    confidence: 0.84,
    detectedFrom: "teacher wants fewer interruptions",
    evidenceCost: "very_low",
    recommendedTool: "run_all_software_observer_supervisor"
  });
}

if (includesAny(combinedText, ["screenshot", "screen", "capture", "截图", "屏幕", "截屏"])) {
  addMode(modes, {
    mode: "triggered_screenshot",
    confidence: 0.72,
    detectedFrom: "screen evidence preference",
    evidenceCost: "medium_high",
    recommendedTool: "monitor_software_observation_deltas"
  });
}

const preferredTeachingModes = [...modes.values()].sort((a, b) => b.confidence - a.confidence);
const evidencePreferenceOrder = [
  "explicit teacher correction or boundary",
  "manual teacher marker",
  "structured examples or tables",
  "ordered teacher steps",
  "log source metadata delta",
  "bounded log tail only after metadata changes",
  "Windows Event Log summary",
  "transparent overlay sketch packet",
  "voice transcript packet",
  "triggered screenshot only when cheap evidence is ambiguous"
];

const questionPolicy = {
  default: includesAny(combinedText, ["don't ask", "ask less", "少问", "不要一直问", "别一直问"]) ? "ask_only_at_boundaries" : "ask_short_boundary_questions",
  askOnlyWhen: [
    "a reusable rule boundary is missing",
    "a counterexample would change the action",
    "cheap log/event/file evidence is ambiguous",
    "the interpreted overlay/spatial intent confidence is low",
    "the next step could execute in visible software"
  ],
  neverAskFor: [
    "a full screen recording by default",
    "raw full logs when metadata or tail deltas are enough",
    "memory approval without showing replay evidence"
  ],
  preferredTone: preferredTone || (includesAny(combinedText, ["直接", "concise", "brief"]) ? "concise_direct" : "patient_but_brief")
};

const correctionPolicy = {
  defaultDecision: "needs_teacher_review",
  preserveCorrectionsAs: ["boundary", "counterexample", "narrowed memory draft"],
  ruleMemoryDefault: "disabled_until_explicit_teacher_approval",
  onMismatch: [
    "record teacher correction",
    "narrow the draft rule",
    "add a counterexample",
    "replay before saving profile memory"
  ]
};

const nextSuggestedTools = [
  "teach_apprentice",
  "create_learning_workflow",
  ...preferredTeachingModes.map((mode) => mode.recommendedTool),
  "create_teach_execute_learning_loop"
].filter((tool, index, array) => tool && array.indexOf(tool) === index);

const locks = {
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  reviewOnly: true,
  fullContinuousRecording: false,
  nativeUniversalExecution: false,
  privateChainOfThoughtExposed: false
};

const profile = {
  format: "transparent_ai_teacher_learning_method_profile_v1",
  profileId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  teacherSignalSummary: {
    teacherMessage: safeText(teacherMessage),
    teacherStyle: safeText(teacherStyle),
    correction: safeText(correction),
    evidencePreferences,
    preferredTools,
    inferredPrimaryMode: preferredTeachingModes[0]?.mode ?? "ordered_steps"
  },
  preferredTeachingModes,
  evidencePreferenceOrder,
  questionPolicy,
  correctionPolicy,
  lowTokenRoute: {
    strategy: "teacher_method_first_then_cheapest_evidence",
    fullContinuousRecording: false,
    screenshotPolicy: "triggered_only_after_metadata_event_marker_or_overlay_ambiguity",
    defaultSoftwareObservationPath: "metadata_delta_gate_before_tail_reads",
    reusableMemoryGate: "teacher_approval_after_replay"
  },
  nextSuggestedTools,
  locks
};

const route = {
  format: "transparent_ai_teacher_learning_method_route_v1",
  profileId,
  defaultNextTool: nextSuggestedTools[0] ?? "teach_apprentice",
  routeOrder: nextSuggestedTools,
  ordinaryTeacherNextStep:
    "Review teacher-learning-method-profile.json, correct the preferred teaching modes if needed, then continue with teach_apprentice or the suggested existing tool route.",
  blockedTransitions: [
    "accepted",
    "ruleEnabled",
    "technologyAccepted",
    "packagingUnlocked",
    "fullContinuousRecording",
    "nativeUniversalExecution"
  ],
  locks
};

const profilePath = join(profileDir, "teacher-learning-method-profile.json");
const routePath = join(profileDir, "teacher-learning-method-route.json");
const readmePath = join(profileDir, "TEACHER_METHOD_PROFILE_START_HERE.md");

writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
writeFileSync(routePath, `${JSON.stringify(route, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Teacher Learning Method Profile",
    "",
    `Goal: ${goal}`,
    `Software: ${software}`,
    "",
    "This packet does not approve technology, memory, packaging, or execution. It only routes the next teaching step toward the way this teacher naturally teaches.",
    "",
    "Suggested route:",
    ...nextSuggestedTools.map((tool, index) => `${index + 1}. ${tool}`),
    "",
    "Review questions:",
    "- Did the profile correctly identify whether the teacher prefers steps, examples, voice, logs, overlay sketches, or correction-first teaching?",
    "- Should the apprentice ask fewer questions, or ask earlier at reusable rule boundaries?",
    "- Is any private software, full log, or continuous recording source excluded before observation?",
    "",
    "Locked defaults: accepted=false, ruleEnabled=false, technologyAccepted=false, packagingGated=true, fullContinuousRecording=false, nativeUniversalExecution=false.",
    "",
    "Generated files:",
    `- ${basename(profilePath)}`,
    `- ${basename(routePath)}`
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_teacher_learning_method_profile_result_v1",
      profileId,
      profilePath,
      routePath,
      teacherReadme: readmePath,
      inferredPrimaryMode: profile.teacherSignalSummary.inferredPrimaryMode,
      preferredTeachingModeCount: preferredTeachingModes.length,
      nextSuggestedTools,
      fullContinuousRecording: false,
      nativeUniversalExecution: false,
      reviewLocks: locks
    },
    null,
    2
  )
);
