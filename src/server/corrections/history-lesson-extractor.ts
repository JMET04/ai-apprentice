import type { ExecutionOutput, RuleRecord, TraceStepRecord } from "@/lib/types";

const reusableCuePattern =
  /(\u508d\u665a|\u9ec4\u660f|\u5915\u9633|\u65e5\u843d|sunset|dusk|golden hour|low sun|warm orange|rim light|backlight|long shadows)/gi;

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function extractRuleFromExecutionHistory(args: {
  runId: string;
  apprenticeId: string;
  taskId: string;
  input: string;
  output: ExecutionOutput;
  trace: TraceStepRecord[];
}): RuleRecord {
  const matchedCues = unique(args.input.match(reusableCuePattern) ?? []);
  const appliedRuleTitles = unique(args.trace.flatMap((step) => step.appliedRules.map((rule) => rule.title)));
  const finalConfidence = args.trace.length > 0
    ? args.trace.reduce((sum, step) => sum + step.confidence, 0) / args.trace.length
    : 0.7;
  const reviewPoints = args.trace.filter((step) => step.needsHumanReview).length;
  const condition =
    matchedCues.length > 0
      ? `A future input resembles execution ${args.runId} and contains: ${matchedCues.join(", ")}.`
      : `A future input resembles the successful pattern from execution ${args.runId}.`;
  const action = [
    `Reuse the observed output pattern: lightingCondition=${args.output.lightingCondition}.`,
    args.output.photographyAdvice.length > 0
      ? `Photography advice should resemble: ${args.output.photographyAdvice.slice(0, 2).join(" / ")}.`
      : null,
    appliedRuleTitles.length > 0 ? `This history lesson was supported by: ${appliedRuleTitles.join(", ")}.` : null
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `rule-history-${args.runId}`,
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    title: `History lesson from ${args.runId}`,
    condition,
    action,
    source: "manual",
    confidence: Math.min(0.92, Math.max(0.62, finalConfidence - reviewPoints * 0.04)),
    enabled: reviewPoints === 0,
    createdAt: new Date().toISOString()
  };
}
