import type { CorrectionExtraction, MemoryApplicationPolicy, StructuredFeedbackRecord } from "@/lib/types";
import { buildLearningTrace } from "./learning-trace";

const duskPattern = /(\u508d\u665a|\u9ec4\u660f|\u5915\u9633|\u65e5\u843d|sunset|dusk|golden hour)/i;
const lightingPattern = /\u5149\u7ebf|lighting/i;

function resolveMemoryPolicy(args: {
  defaultApplyAutomatically: boolean;
  defaultRequiresHumanConfirmation: boolean;
  memoryPolicy?: MemoryApplicationPolicy;
  canApplyAutomatically?: boolean;
}) {
  const canApplyAutomatically = args.canApplyAutomatically ?? true;
  const requiresHumanConfirmation =
    args.memoryPolicy?.requiresHumanConfirmation ?? args.defaultRequiresHumanConfirmation;
  const requestedAutomaticApplication =
    args.memoryPolicy?.applyAutomatically ?? args.defaultApplyAutomatically;

  return {
    applyAutomatically: canApplyAutomatically && requestedAutomaticApplication && !requiresHumanConfirmation,
    requiresHumanConfirmation
  };
}

export function extractRuleFromFeedback(args: {
  feedback: string;
  beforeOutput: unknown;
  structuredFeedback?: StructuredFeedbackRecord;
  memoryPolicy?: MemoryApplicationPolicy;
  apprenticeId: string;
  taskId: string;
}): CorrectionExtraction {
  const isLightingCorrection = duskPattern.test(args.feedback) || lightingPattern.test(args.feedback);
  const createdAt = new Date().toISOString();

  if (args.structuredFeedback) {
    const field = args.structuredFeedback.field.trim();
    const correctedValue = args.structuredFeedback.correctedValue.trim();
    const conditionCue = args.structuredFeedback.conditionCue.trim();
    const note = args.structuredFeedback.note?.trim();
    const hasReusableCondition = Boolean(field && correctedValue && conditionCue);
    const isVisualCounterexample =
      field === "lightingCondition" &&
      /natural light|not golden hour|do not apply|counterexample/i.test(`${correctedValue} ${conditionCue} ${note ?? ""}`);
    const memoryPolicy = resolveMemoryPolicy({
      defaultApplyAutomatically: hasReusableCondition,
      defaultRequiresHumanConfirmation: false,
      memoryPolicy: args.memoryPolicy,
      canApplyAutomatically: hasReusableCondition
    });
    const extractedRule = {
      id: `rule-structured-${Date.now()}`,
      apprenticeId: args.apprenticeId,
      taskId: args.taskId,
      title: isVisualCounterexample ? "Visual counterexample for golden-hour memory" : `Structured feedback for ${field}`,
      condition: isVisualCounterexample
        ? `Counterexample cues for visual golden-hour memory: ${conditionCue}.`
        : `Input or visual evidence contains: ${conditionCue}.`,
      action: isVisualCounterexample
        ? `Keep lightingCondition as natural light and do not apply golden-hour visual memory without teacher review.${note ? ` ${note}` : ""}`
        : `Set ${field} to ${correctedValue}.${note ? ` ${note}` : ""}`,
      source: "correction" as const,
      confidence: isVisualCounterexample ? 0.87 : 0.84,
      enabled: memoryPolicy.applyAutomatically,
      createdAt
    };

    return {
      errorType: isVisualCounterexample ? "visual_counterexample_memory" : "structured_field_feedback",
      errorReason: isVisualCounterexample
        ? "The teacher confirmed that these visual or text cues are a counterexample to golden-hour memory."
        : `The teacher corrected the ${field} field with a reusable condition.`,
      condition: extractedRule.condition,
      action: extractedRule.action,
      applyAutomatically: memoryPolicy.applyAutomatically,
      requiresHumanConfirmation: memoryPolicy.requiresHumanConfirmation,
      extractedRule,
      learningTrace: buildLearningTrace({
        source: "structured_feedback",
        evidence: `${field} -> ${correctedValue} when ${conditionCue}`,
        ruleTitle: extractedRule.title,
        confidence: extractedRule.confidence,
        applyAutomatically: memoryPolicy.applyAutomatically,
        requiresHumanConfirmation: memoryPolicy.requiresHumanConfirmation
      })
    };
  }

  if (isLightingCorrection) {
    const memoryPolicy = resolveMemoryPolicy({
      defaultApplyAutomatically: true,
      defaultRequiresHumanConfirmation: false,
      memoryPolicy: args.memoryPolicy
    });
    const extractedRule = {
      id: `rule-${Date.now()}`,
      apprenticeId: args.apprenticeId,
      taskId: args.taskId,
      title: "Dusk words mean golden hour",
      condition: "Text contains \u508d\u665a / \u9ec4\u660f / \u5915\u9633 / \u65e5\u843d / sunset / dusk / golden hour.",
      action: "Set lighting condition to golden hour and add advice about soft side light and backlight.",
      source: "correction" as const,
      confidence: 0.9,
      enabled: memoryPolicy.applyAutomatically,
      createdAt
    };

    return {
      errorType: "lighting_condition_rule",
      errorReason: "The apprentice treated time-of-day lighting language too generically.",
      condition: extractedRule.condition,
      action: extractedRule.action,
      applyAutomatically: memoryPolicy.applyAutomatically,
      requiresHumanConfirmation: memoryPolicy.requiresHumanConfirmation,
      extractedRule,
      learningTrace: buildLearningTrace({
        source: "correction",
        evidence: args.feedback,
        ruleTitle: extractedRule.title,
        confidence: extractedRule.confidence,
        applyAutomatically: memoryPolicy.applyAutomatically,
        requiresHumanConfirmation: memoryPolicy.requiresHumanConfirmation
      })
    };
  }

  const memoryPolicy = resolveMemoryPolicy({
    defaultApplyAutomatically: false,
    defaultRequiresHumanConfirmation: true,
    memoryPolicy: args.memoryPolicy
  });
  const extractedRule = {
    id: `rule-${Date.now()}`,
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    title: "Teacher preference from correction",
    condition: "Similar task context appears again.",
    action: args.feedback,
    source: "correction" as const,
    confidence: 0.68,
    enabled: memoryPolicy.applyAutomatically,
    createdAt
  };

  return {
    errorType: "teacher_preference",
    errorReason: "The teacher gave a natural-language preference that should be reviewed.",
    condition: "When a future task matches this correction context.",
    action: args.feedback,
    applyAutomatically: memoryPolicy.applyAutomatically,
    requiresHumanConfirmation: memoryPolicy.requiresHumanConfirmation,
    extractedRule,
    learningTrace: buildLearningTrace({
      source: "correction",
      evidence: args.feedback,
      ruleTitle: extractedRule.title,
      confidence: extractedRule.confidence,
      applyAutomatically: memoryPolicy.applyAutomatically,
      requiresHumanConfirmation: memoryPolicy.requiresHumanConfirmation
    })
  };
}
