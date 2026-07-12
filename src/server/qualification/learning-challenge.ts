import { visualLearningAcceptanceGate } from "@/lib/teacher-acceptance";
import { defaultLearningChallengeSuite, type LearningChallengePreset } from "@/lib/learning-challenge-presets";
import type { ExecutionOutput, RuleEvaluationRecord, RuleRecord, TraceStepRecord, WorkflowNodeDefinition } from "@/lib/types";
import { executePhotographyJournalTask } from "@/server/workflow/execution-engine";
import { traceNodeIdsFromWorkflow } from "@/server/workflow/trace-node-map";

export type LearningChallengeProbe = {
  input: string;
  expectedLighting: string | null;
  expectedReview: boolean | null;
  baselineOutput: ExecutionOutput;
  output: ExecutionOutput;
  status: "completed" | "needs_review";
  expectationResult: {
    passed: boolean | null;
    lightingMatches: boolean | null;
    reviewMatches: boolean | null;
    evidence: string;
  };
  persisted: false;
  reviewOnly: true;
  packagingGated: true;
  accepted: false;
  changedByMemory: boolean;
  memoryComparison: Array<{
    field: keyof Pick<ExecutionOutput, "lightingCondition" | "recommendedTitles" | "photographyAdvice">;
    baseline: string;
    learned: string;
    changed: boolean;
  }>;
  traceSummary: Array<{
    stepId: string;
    nodeId: string;
    stepName: string;
    confidence: number;
    validation: string;
    needsHumanReview: boolean;
    appliedRuleTitles: string[];
  }>;
  ruleDecisions: Array<{
    title: string;
    decision: RuleEvaluationRecord["decision"];
    memorySource: RuleEvaluationRecord["memorySource"];
    matchedCues: string[];
    counterCues: string[];
    counterEvidenceSources: string[];
    reason: string;
  }>;
};

export type LearningChallengeSuiteItem = LearningChallengePreset;

export type LearningChallengeSuite = {
  reviewOnly: true;
  persisted: false;
  accepted: false;
  packagingGated: true;
  passed: number;
  total: number;
  items: Array<
    LearningChallengeSuiteItem & {
      probe: LearningChallengeProbe;
    }
  >;
};

type ComparableChallengeField = keyof Pick<ExecutionOutput, "lightingCondition" | "recommendedTitles" | "photographyAdvice">;

function ruleEvaluationFromTrace(trace: TraceStepRecord[]) {
  const decisionStep = trace.find((step) => step.id === "trace-decision");

  return Array.isArray(decisionStep?.output.ruleEvaluation)
    ? (decisionStep.output.ruleEvaluation as RuleEvaluationRecord[])
    : [];
}

function summarizeValue(value: string | string[]) {
  return Array.isArray(value) ? value.join(" / ") : value;
}

export function buildLearningChallengeProbe(args: {
  input: string;
  expectedLighting?: string | null;
  expectedReview?: boolean | null;
  taskId: string;
  apprenticeId: string;
  workflowNodes: WorkflowNodeDefinition[];
  rules: RuleRecord[];
}): LearningChallengeProbe {
  const traceNodeIds = traceNodeIdsFromWorkflow(args.workflowNodes);
  const baselineRun = executePhotographyJournalTask(args.input, [], {
    taskId: args.taskId,
    apprenticeId: args.apprenticeId,
    traceNodeIds
  });
  const run = executePhotographyJournalTask(args.input, args.rules, {
    taskId: args.taskId,
    apprenticeId: args.apprenticeId,
    traceNodeIds
  });
  const comparisonFields: ComparableChallengeField[] = [
    "lightingCondition",
    "recommendedTitles",
    "photographyAdvice"
  ];
  const memoryComparison: LearningChallengeProbe["memoryComparison"] = comparisonFields.map((field) => {
    const baseline = summarizeValue(baselineRun.output[field]);
    const learned = summarizeValue(run.output[field]);

    return {
      field,
      baseline,
      learned,
      changed: baseline !== learned
    };
  });
  const expectedLighting = args.expectedLighting?.trim() ? args.expectedLighting.trim() : null;
  const expectedReview = typeof args.expectedReview === "boolean" ? args.expectedReview : null;
  const actualReview = run.trace.some((step) => step.needsHumanReview);
  const lightingMatches = expectedLighting ? run.output.lightingCondition === expectedLighting : null;
  const reviewMatches = expectedReview === null ? null : actualReview === expectedReview;
  const expectedChecks = [lightingMatches, reviewMatches].filter((value) => value !== null);
  const expectationPassed = expectedChecks.length > 0 ? expectedChecks.every(Boolean) : null;

  return {
    input: args.input,
    expectedLighting,
    expectedReview,
    baselineOutput: baselineRun.output,
    output: run.output,
    status: run.status,
    expectationResult: {
      passed: expectationPassed,
      lightingMatches,
      reviewMatches,
      evidence:
        expectationPassed === null
          ? "No teacher expectation was provided for this challenge."
          : `Expected ${expectedLighting ?? "any lighting"} with ${
              expectedReview === null ? "any review state" : expectedReview ? "teacher review" : "no teacher review"
            }; actual ${run.output.lightingCondition} with ${actualReview ? "teacher review" : "no teacher review"}.`
    },
    persisted: false,
    reviewOnly: true,
    packagingGated: visualLearningAcceptanceGate.packagingGated,
    accepted: visualLearningAcceptanceGate.accepted,
    changedByMemory: memoryComparison.some((item) => item.changed),
    memoryComparison,
    traceSummary: run.trace.map((step) => ({
      stepId: step.id,
      nodeId: step.nodeId,
      stepName: step.stepName,
      confidence: step.confidence,
      validation: step.validation,
      needsHumanReview: step.needsHumanReview,
      appliedRuleTitles: step.appliedRules.map((rule) => rule.title)
    })),
    ruleDecisions: ruleEvaluationFromTrace(run.trace)
      .filter((decision) => decision.decision !== "not_matched")
      .map((decision) => ({
        title: decision.title,
        decision: decision.decision,
        memorySource: decision.memorySource,
        matchedCues: decision.matchedCues,
        counterCues: decision.counterCues,
        counterEvidenceSources: decision.counterEvidenceSources,
        reason: decision.reason
      }))
  };
}

export function buildLearningChallengeSuite(args: {
  taskId: string;
  apprenticeId: string;
  workflowNodes: WorkflowNodeDefinition[];
  rules: RuleRecord[];
  items?: LearningChallengeSuiteItem[];
}): LearningChallengeSuite {
  const items = (args.items ?? defaultLearningChallengeSuite).map((item) => ({
    ...item,
    probe: buildLearningChallengeProbe({
      input: item.input,
      expectedLighting: item.expectedLighting,
      expectedReview: item.expectedReview,
      taskId: args.taskId,
      apprenticeId: args.apprenticeId,
      workflowNodes: args.workflowNodes,
      rules: args.rules
    })
  }));

  return {
    reviewOnly: true,
    persisted: false,
    accepted: visualLearningAcceptanceGate.accepted,
    packagingGated: visualLearningAcceptanceGate.packagingGated,
    passed: items.filter((item) => item.probe.expectationResult.passed).length,
    total: items.length,
    items
  };
}
