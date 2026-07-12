import type { RuleEvaluationRecord, TraceStepRecord } from "@/lib/types";

function ruleEvaluations(trace: TraceStepRecord[]) {
  return trace.flatMap((step) =>
    Array.isArray(step.output.ruleEvaluation) ? (step.output.ruleEvaluation as RuleEvaluationRecord[]) : []
  );
}

export const traceStore = {
  summarize(trace: TraceStepRecord[]) {
    const evaluations = ruleEvaluations(trace);

    return {
      steps: trace.length,
      appliedRules: trace.flatMap((step) => step.appliedRules).length,
      ruleEvaluations: evaluations.length,
      disabledRules: evaluations.filter((evaluation) => evaluation.decision === "disabled").length,
      unmatchedRules: evaluations.filter((evaluation) => evaluation.decision === "not_matched").length,
      humanReviewPoints: trace.filter((step) => step.needsHumanReview).length
    };
  }
};
