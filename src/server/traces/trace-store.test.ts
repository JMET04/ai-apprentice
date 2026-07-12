import { describe, expect, it } from "vitest";
import type { TraceStepRecord } from "@/lib/types";
import { ensurePublicTraceOnly } from "@/server/policy/guardrails";
import { traceStore } from "./trace-store";

const baseStep: TraceStepRecord = {
  id: "trace-decision",
  nodeId: "node-decision",
  stepName: "Apply learned lighting rules",
  input: { note: "bright noon" },
  output: {},
  appliedRules: [],
  confidence: 0.76,
  needsHumanReview: true,
  validation: "No lighting correction matched; asking teacher to confirm.",
  uncertainty: ["Lighting condition may need teacher confirmation."]
};

describe("trace store and public trace guardrails", () => {
  it("summarizes rule decision audit counts", () => {
    const summary = traceStore.summarize([
      {
        ...baseStep,
        output: {
          ruleEvaluation: [
            {
              ruleId: "rule-a",
              title: "Rule A",
              enabled: true,
              matched: true,
              matchedCues: ["sunset"],
              decision: "applied",
              reason: "Input matched learned cues from this rule."
            },
            {
              ruleId: "rule-b",
              title: "Rule B",
              enabled: true,
              matched: false,
              matchedCues: [],
              decision: "not_matched",
              reason: "No learned cues from this rule matched the input."
            },
            {
              ruleId: "rule-c",
              title: "Rule C",
              enabled: false,
              matched: true,
              matchedCues: ["dusk"],
              decision: "disabled",
              reason: "Input matched this rule, but memory is paused by the teacher."
            }
          ]
        },
        appliedRules: [
          {
            id: "rule-a",
            title: "Rule A",
            condition: "Text contains sunset.",
            action: "Mark lighting as golden hour."
          }
        ]
      }
    ]);

    expect(summary).toEqual({
      steps: 1,
      appliedRules: 1,
      ruleEvaluations: 3,
      disabledRules: 1,
      unmatchedRules: 1,
      humanReviewPoints: 1
    });
  });

  it("recursively strips private reasoning fields from public traces", () => {
    const trace = ensurePublicTraceOnly([
      {
        ...baseStep,
        output: {
          publicDecision: "ask teacher",
          privateChainOfThought: "hidden",
          nested: {
            chainOfThought: "hidden nested",
            visible: "kept"
          },
          list: [{ hiddenReasoning: "hidden list item", visible: "kept list item" }]
        }
      }
    ]);

    expect(JSON.stringify(trace)).not.toContain("privateChainOfThought");
    expect(JSON.stringify(trace)).not.toContain("chainOfThought");
    expect(JSON.stringify(trace)).not.toContain("hiddenReasoning");
    expect(trace[0].output).toEqual({
      publicDecision: "ask teacher",
      nested: { visible: "kept" },
      list: [{ visible: "kept list item" }]
    });
  });
});
