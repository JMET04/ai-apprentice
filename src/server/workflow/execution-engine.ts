import { demoApprentice, demoRules, demoTask, demoWorkflow } from "@/lib/demo-data";
import type {
  ExecutionOutput,
  ExecutionRunRecord,
  RuleEvaluationRecord,
  RuleRecord,
  TraceNodeIds,
  TraceStepRecord
} from "@/lib/types";
import { ensurePublicTraceOnly, needsHumanReview } from "@/server/policy/guardrails";

const zhDusk = "\u508d\u665a";
const zhTwilight = "\u9ec4\u660f";
const zhEveningSun = "\u5915\u9633";
const zhSunset = "\u65e5\u843d";

const learnedLightingCues = [
  zhDusk,
  zhTwilight,
  zhEveningSun,
  zhSunset,
  "sunset",
  "dusk",
  "golden hour",
  "low sun",
  "low-angle",
  "low angle",
  "warm light",
  "warm highlights",
  "warm orange",
  "rim light",
  "backlight",
  "side light",
  "long shadows"
];

const counterLightingCues = [
  "noon",
  "midday",
  "middle of the day",
  "overhead sun",
  "harsh noon",
  "flat daylight",
  "white facade at noon",
  "\u6b63\u5348",
  "\u4e2d\u5348",
  "\u5348\u95f4"
];

function extractSubjects(input: string) {
  const subjects = [];

  if (/\u6e56|\u6e56\u9762|lake/i.test(input)) {
    subjects.push("lake surface");
  }
  if (/\u96ea\u5c71|mountain|snow/i.test(input)) {
    subjects.push("snow mountains");
  }
  if (/\u4eba\u50cf|portrait/i.test(input)) {
    subjects.push("portrait subject");
  }

  return subjects.length > 0 ? subjects : ["travel scene"];
}

function detectLocation(input: string) {
  if (/\u65e5\u5185\u74e6|geneva/i.test(input)) {
    return "Lake Geneva";
  }

  const englishMatch = input.match(/\b(?:at|in|near|by)\s+([A-Z][A-Za-z\s]+?)(?:\s+with|\s+and|\.|,|$)/);
  if (englishMatch?.[1]) {
    return englishMatch[1].trim();
  }

  return "unspecified location";
}

function detectWeather(input: string) {
  if (/\u5929\u6c14\u5f88\u597d|sunny|clear|good weather/i.test(input)) {
    return "clear";
  }
  if (/\u96e8|rain/i.test(input)) {
    return "rain";
  }

  return "unspecified weather";
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function ruleText(rule: RuleRecord) {
  return normalizeText([rule.title, rule.condition, rule.action].join(" "));
}

function matchedCuesForRule(input: string, rule: RuleRecord) {
  const normalizedInput = normalizeText(input);
  const text = ruleText(rule);
  const ruleCues = learnedLightingCues.filter((cue) => text.includes(normalizeText(cue)));

  return ruleCues.filter((cue) => normalizedInput.includes(normalizeText(cue)));
}

function isCounterexampleRule(rule: RuleRecord) {
  const text = ruleText(rule);

  return (
    text.includes("counterexample") ||
    text.includes("not golden hour") ||
    text.includes("do not apply golden hour") ||
    text.includes("natural light") ||
    text.includes("keep lightingcondition")
  );
}

function matchedCounterCues(input: string, counterexampleRules: RuleRecord[] = []) {
  const normalizedInput = normalizeText(input);
  const staticCues = counterLightingCues.filter((cue) => normalizedInput.includes(normalizeText(cue)));
  const learnedMatches = counterexampleRules.flatMap((rule) => {
    const text = ruleText(rule);
    const ruleCues = counterLightingCues.filter((cue) => text.includes(normalizeText(cue)));
    const matched = ruleCues.filter((cue) => normalizedInput.includes(normalizeText(cue)));

    return matched.map((cue) => ({ cue, source: rule.title }));
  });

  return {
    cues: Array.from(new Set([...staticCues, ...learnedMatches.map((match) => match.cue)])),
    sourceTitles: Array.from(new Set(learnedMatches.map((match) => match.source)))
  };
}

function memorySourceForRule(rule: RuleRecord): RuleEvaluationRecord["memorySource"] {
  const text = ruleText(rule);

  if (rule.id.includes("visual") || text.includes("visual demonstration") || text.includes("visual note")) {
    return "visual_demonstration";
  }

  return rule.source;
}

function evidencePathForRule(
  rule: RuleRecord,
  matchedCues: string[],
  counterCues: string[],
  counterEvidenceSources: string[]
): RuleEvaluationRecord["evidencePath"] {
  const memorySource = memorySourceForRule(rule);
  const matchedCueEvidence =
    matchedCues.length > 0
      ? `Matched input cues: ${matchedCues.join(", ")}.`
      : "No learned cue from this rule matched the current input.";
  const counterCueEvidence =
    counterCues.length > 0
      ? `Counterexample cues also appeared: ${counterCues.join(", ")}.${
          counterEvidenceSources.length > 0
            ? ` Counterexample memory sources: ${counterEvidenceSources.join(", ")}.`
            : " Source: built-in visual overgeneralization guardrail."
        }`
      : "No counterexample cue appeared for this memory.";

  return [
    {
      label: "Memory source",
      evidence:
        memorySource === "visual_demonstration"
          ? "This rule came from teacher visual-demonstration evidence."
          : `This rule came from ${memorySource} memory.`,
      confidence: rule.confidence
    },
    {
      label: "Condition checked",
      evidence: rule.condition,
      confidence: rule.confidence
    },
    {
      label: "Cue match",
      evidence: matchedCueEvidence,
      confidence: matchedCues.length > 0 ? 0.9 : 0.64
    },
    {
      label: "Counterexample check",
      evidence: counterCueEvidence,
      confidence: counterCues.length > 0 ? 0.86 : 0.82
    },
    {
      label: "Action considered",
      evidence: rule.action,
      confidence: rule.confidence
    }
  ];
}

function evaluateRule(input: string, rule: RuleRecord, counterexampleRules: RuleRecord[] = []): RuleEvaluationRecord {
  const matchedCues = matchedCuesForRule(input, rule);
  const counterContext = matchedCounterCues(input, counterexampleRules);
  const counterCues = matchedCues.length > 0 || isCounterexampleRule(rule) ? counterContext.cues : [];
  const commonEvidence = {
    memorySource: memorySourceForRule(rule),
    ruleConfidence: rule.confidence,
    ruleCondition: rule.condition,
    ruleAction: rule.action,
    counterEvidenceSources: counterContext.sourceTitles,
    evidencePath: evidencePathForRule(rule, matchedCues, counterCues, counterContext.sourceTitles)
  };

  if (!rule.enabled) {
    return {
      ruleId: rule.id,
      title: rule.title,
      enabled: false,
      matched: matchedCues.length > 0,
      matchedCues,
      counterCues,
      decision: "disabled",
      reason:
        matchedCues.length > 0
          ? "Input matched this rule, but memory is paused by the teacher."
          : "Memory is paused by the teacher.",
      ...commonEvidence
    };
  }

  if (isCounterexampleRule(rule)) {
    return {
      ruleId: rule.id,
      title: rule.title,
      enabled: true,
      matched: counterCues.length > 0,
      matchedCues: [],
      counterCues,
      decision: counterCues.length > 0 ? "counterexample" : "not_matched",
      reason:
        counterCues.length > 0
          ? "Input matched teacher counterexample memory, so visual golden-hour memory should stay under review."
          : "No counterexample cue from this rule matched the input.",
      ...commonEvidence
    };
  }

  if (matchedCues.length > 0 && counterCues.length > 0) {
    return {
      ruleId: rule.id,
      title: rule.title,
      enabled: true,
      matched: true,
      matchedCues,
      counterCues,
      decision: "conflicted",
      reason: "Input matched this memory, but counterexample lighting cues require teacher review before applying it.",
      ...commonEvidence
    };
  }

  if (matchedCues.length > 0) {
    return {
      ruleId: rule.id,
      title: rule.title,
      enabled: true,
      matched: true,
      matchedCues,
      counterCues,
      decision: "applied",
      reason: "Input matched learned cues from this rule.",
      ...commonEvidence
    };
  }

  return {
    ruleId: rule.id,
    title: rule.title,
    enabled: true,
    matched: false,
    matchedCues,
    counterCues,
    decision: "not_matched",
    reason: "No learned cues from this rule matched the input.",
    ...commonEvidence
  };
}

function buildOutput(input: string, appliedRules: RuleRecord[]): ExecutionOutput {
  const lightingCondition = appliedRules.length > 0 ? "golden hour" : "natural light";
  const subjects = extractSubjects(input);
  const location = detectLocation(input);

  return {
    location,
    weather: detectWeather(input),
    subjects,
    lightingCondition,
    recommendedTitles:
      lightingCondition === "golden hour"
        ? ["Lake light at golden hour", "Portraits in warm evening light"]
        : ["Travel light record", "On-the-road photography notes"],
    journalBody:
      lightingCondition === "golden hour"
        ? `${location} has soft evening light, and ${subjects.join(", ")} form a layered photography journal scene. The apprentice used learned memory to mark the lighting as golden hour.`
        : `${location} is organized as a photography travel journal, with attention on ${subjects.join(", ")} and the visible weather context.`,
    photographyAdvice:
      appliedRules.length > 0
        ? ["Use warm side light to shape the subject.", "Try backlight or rim-light composition while preserving lake highlights."]
        : ["Record the shooting time so lighting can be classified.", "Capture subject and background relationships for better titles."]
  };
}

export function executePhotographyJournalTask(
  input: string,
  learnedRules: RuleRecord[] = demoRules,
  context: { taskId?: string; apprenticeId?: string; traceNodeIds?: TraceNodeIds } = {}
): ExecutionRunRecord {
  const normalizedInput = input.trim();
  const counterexampleRules = learnedRules.filter((rule) => rule.enabled && isCounterexampleRule(rule));
  const ruleEvaluation = learnedRules.map((rule) => evaluateRule(normalizedInput, rule, counterexampleRules));
  const appliedRuleIds = new Set(
    ruleEvaluation.filter((evaluation) => evaluation.decision === "applied").map((evaluation) => evaluation.ruleId)
  );
  const conflictedRuleEvaluations = ruleEvaluation.filter((evaluation) => evaluation.decision === "conflicted");
  const appliedRules = learnedRules.filter((rule) => appliedRuleIds.has(rule.id));
  const output = buildOutput(normalizedInput, appliedRules);
  const traceNodeIds = {
    input: "node-input",
    understand: "node-understand",
    decision: "node-decision",
    execute: "node-execute",
    check: "node-check",
    human_review: "node-human",
    output: "node-output",
    ...context.traceNodeIds
  };
  const uncertainty = [
    ...(output.location === "unspecified location" ? ["Location is missing."] : []),
    ...(output.weather === "unspecified weather" ? ["Weather is not explicit."] : [])
  ];
  const expectedFields = demoTask.expectedOutput.fields;
  const requiredOutputKeys = [
    "location",
    "weather",
    "subjects",
    "lightingCondition",
    "recommendedTitles",
    "journalBody",
    "photographyAdvice"
  ];
  const outputKeys = Object.keys(output);
  const missingOutputFields = requiredOutputKeys.filter((field) => !outputKeys.includes(field));
  const reviewRequired =
    needsHumanReview(0.84, uncertainty) || appliedRules.length === 0 || conflictedRuleEvaluations.length > 0;
  const ruleConflictUncertainty = conflictedRuleEvaluations.map(
    (evaluation) =>
      `${evaluation.title} matched ${evaluation.matchedCues.join(", ")} but also saw counter cues ${evaluation.counterCues.join(", ")}.`
  );

  // This is the transparent execution trace shown to the user. It is deliberately
  // structured evidence, not private model chain-of-thought.
  const trace: TraceStepRecord[] = [
    {
      id: "trace-input",
      nodeId: traceNodeIds.input,
      stepName: "Receive travel note",
      input: { rawTravelNote: normalizedInput },
      output: { normalizedNote: normalizedInput },
      appliedRules: [],
      confidence: normalizedInput.length > 10 ? 0.95 : 0.56,
      needsHumanReview: normalizedInput.length <= 10,
      validation: normalizedInput.length > 10 ? "Input has enough detail." : "Input may be too short.",
      uncertainty: normalizedInput.length <= 10 ? ["The note is too short."] : []
    },
    {
      id: "trace-understand",
      nodeId: traceNodeIds.understand,
      stepName: "Extract journal fields",
      input: { normalizedNote: normalizedInput },
      output: {
        location: output.location,
        weather: output.weather,
        subjects: output.subjects
      },
      appliedRules: [],
      confidence: uncertainty.length === 0 ? 0.88 : 0.74,
      needsHumanReview: uncertainty.length > 0,
      validation: "Candidate fields extracted from visible text.",
      uncertainty
    },
    {
      id: "trace-decision",
      nodeId: traceNodeIds.decision,
      stepName: "Apply learned lighting rules",
      input: { note: normalizedInput },
      output: { lightingCondition: output.lightingCondition, ruleEvaluation },
      appliedRules,
      confidence: conflictedRuleEvaluations.length > 0 ? 0.68 : appliedRules.length > 0 ? 0.92 : 0.76,
      needsHumanReview: appliedRules.length === 0 || conflictedRuleEvaluations.length > 0,
      validation:
        conflictedRuleEvaluations.length > 0
          ? "Matched learned lighting memory, but counterexample cues require teacher confirmation."
          : appliedRules.length > 0
            ? "Matched learned lighting memory from teacher feedback or visual demonstration."
            : "No lighting correction matched; asking teacher to confirm.",
      uncertainty:
        conflictedRuleEvaluations.length > 0
          ? ruleConflictUncertainty
          : appliedRules.length > 0
            ? []
            : ["Lighting condition may need teacher confirmation."]
    },
    {
      id: "trace-execute",
      nodeId: traceNodeIds.execute,
      stepName: "Generate structured journal",
      input: { fields: demoTask.expectedOutput.fields, lightingCondition: output.lightingCondition },
      output,
      appliedRules,
      confidence: conflictedRuleEvaluations.length > 0 ? 0.74 : appliedRules.length > 0 ? 0.9 : 0.8,
      needsHumanReview: conflictedRuleEvaluations.length > 0,
      validation:
        appliedRules.length > 0
          ? "All required output fields are present."
          : conflictedRuleEvaluations.length > 0
            ? "Draft kept conservative because a learned visual memory conflicted with counterexample evidence."
            : "All required output fields are present.",
      uncertainty: conflictedRuleEvaluations.length > 0 ? ruleConflictUncertainty : []
    },
    {
      id: "trace-check",
      nodeId: traceNodeIds.check,
      stepName: "Self-check structured output",
      input: { journalDraft: output, expectedFields, requiredOutputKeys },
      output: {
        requiredFieldCount: expectedFields.length,
        missingOutputFields,
        publicTraceOnly: true,
        reviewRequired,
        visualMemoryConflicts: conflictedRuleEvaluations.map((evaluation) => ({
          ruleId: evaluation.ruleId,
          title: evaluation.title,
          matchedCues: evaluation.matchedCues,
          counterCues: evaluation.counterCues
        }))
      },
      appliedRules,
      confidence: missingOutputFields.length === 0 && conflictedRuleEvaluations.length === 0 ? 0.91 : 0.72,
      needsHumanReview: missingOutputFields.length > 0 || conflictedRuleEvaluations.length > 0,
      validation:
        missingOutputFields.length === 0 && conflictedRuleEvaluations.length === 0
          ? "Structured output passed required-field and public-trace checks."
          : conflictedRuleEvaluations.length > 0
            ? "Structured output is complete, but visual memory conflict needs teacher review."
          : "Structured output is missing required fields.",
      uncertainty: [
        ...missingOutputFields.map((field) => `Output field may be missing: ${field}`),
        ...ruleConflictUncertainty
      ]
    },
    {
      id: "trace-human",
      nodeId: traceNodeIds.human_review,
      stepName: "Teacher review checkpoint",
      input: { validation: "All fields present", uncertainty: [...uncertainty, ...ruleConflictUncertainty] },
      output: {
        prompt:
          conflictedRuleEvaluations.length > 0
            ? "A visual memory matched the input, but counterexample cues were also present. Please confirm whether the rule should apply."
            : appliedRules.length > 0
            ? "This run used a remembered rule. Please confirm whether it should remain active."
            : "AI apprentice is not certain about lighting. Please teach it once."
      },
      appliedRules,
      confidence: 0.84,
      needsHumanReview: reviewRequired,
      validation: "Human review point is explicit.",
      uncertainty: [...uncertainty, ...ruleConflictUncertainty]
    },
    {
      id: "trace-output",
      nodeId: traceNodeIds.output,
      stepName: "Publish structured journal",
      input: { journalDraft: output, reviewRequired },
      output: {
        finalJournal: output,
        traceStepIds: [
          "trace-input",
          "trace-understand",
          "trace-decision",
          "trace-execute",
          "trace-check",
          "trace-human"
        ],
        memoryApplied: appliedRules.map((rule) => rule.title)
      },
      appliedRules,
      confidence: reviewRequired ? 0.82 : 0.9,
      needsHumanReview: reviewRequired,
      validation: "Final output is linked to workflow trace, validation, and memory provenance.",
      uncertainty: reviewRequired ? ["Final output remains open for teacher review."] : []
    }
  ];

  return {
    id: `run-${Date.now()}`,
    taskId: context.taskId ?? demoWorkflow.taskId,
    apprenticeId: context.apprenticeId ?? demoApprentice.id,
    input: normalizedInput,
    output,
    status: trace.some((step) => step.needsHumanReview) ? "needs_review" : "completed",
    trace: ensurePublicTraceOnly(trace),
    createdAt: new Date().toISOString()
  };
}
