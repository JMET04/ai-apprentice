import type { CorrectionExtraction } from "@/lib/types";
import { buildLearningTrace } from "./learning-trace";

const duskPattern = /(傍晚|黄昏|夕阳|日落|sunset|dusk|golden hour)/i;

export function extractRuleFromTeachingExample(args: {
  input: string;
  expectedOutput: Record<string, unknown>;
  apprenticeId: string;
  taskId: string;
}): CorrectionExtraction {
  const createdAt = new Date().toISOString();
  const expectedText = JSON.stringify(args.expectedOutput);
  const showsGoldenHour = duskPattern.test(args.input) || /golden hour/i.test(expectedText);

  if (showsGoldenHour) {
    const extractedRule = {
      id: `rule-example-${Date.now()}`,
      apprenticeId: args.apprenticeId,
      taskId: args.taskId,
      title: "Example shows dusk means golden hour",
      condition: "Input resembles a teacher example with sunset, dusk, or golden-hour language.",
      action: "Set lighting condition to golden hour and recommend warm side-light or backlight composition.",
      source: "manual" as const,
      confidence: 0.86,
      enabled: true,
      createdAt
    };

    return {
      errorType: "example_lighting_rule",
      errorReason: "The teacher demonstration maps dusk-like input language to golden-hour output.",
      condition: "Example input contains sunset, dusk, golden hour, or similar dusk-like language.",
      action: "Set lighting condition to golden hour and add warm side-light or backlight photography advice.",
      applyAutomatically: true,
      requiresHumanConfirmation: false,
      extractedRule,
      learningTrace: buildLearningTrace({
        source: "example",
        evidence: `${args.input} -> ${expectedText}`,
        ruleTitle: extractedRule.title,
        confidence: extractedRule.confidence,
        applyAutomatically: true,
        requiresHumanConfirmation: false
      })
    };
  }

  const extractedRule = {
    id: `rule-example-${Date.now()}`,
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    title: "Teacher example output pattern",
    condition: "Input resembles a saved teacher example.",
    action: `Use this demonstrated output pattern: ${expectedText}`,
    source: "manual" as const,
    confidence: 0.72,
    enabled: false,
    createdAt
  };

  return {
    errorType: "example_preference_rule",
    errorReason: "The teacher supplied a structured example that should guide similar future runs.",
    condition: "A future input resembles this teacher-provided example.",
    action: `Follow the demonstrated output pattern: ${expectedText}`,
    applyAutomatically: false,
    requiresHumanConfirmation: true,
    extractedRule,
    learningTrace: buildLearningTrace({
      source: "example",
      evidence: `${args.input} -> ${expectedText}`,
      ruleTitle: extractedRule.title,
      confidence: extractedRule.confidence,
      applyAutomatically: false,
      requiresHumanConfirmation: true
    })
  };
}
