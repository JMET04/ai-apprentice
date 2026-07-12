import { describe, expect, it } from "vitest";
import { demoApprentice, demoRules, demoTask, demoWorkflow } from "@/lib/demo-data";
import { buildLearningChallengeProbe, buildLearningChallengeSuite } from "./learning-challenge";

describe("learning challenge probe", () => {
  it("runs a review-only visual learning challenge without persisting or unlocking packaging", () => {
    const probe = buildLearningChallengeProbe({
      input: "Lake portrait near Geneva with clear weather, warm orange rim light, and long shadows.",
      expectedLighting: "golden hour",
      expectedReview: false,
      taskId: demoTask.id,
      apprenticeId: demoApprentice.id,
      workflowNodes: demoWorkflow.nodes,
      rules: demoRules
    });

    expect(probe.output.lightingCondition).toBe("golden hour");
    expect(probe.expectedLighting).toBe("golden hour");
    expect(probe.expectedReview).toBe(false);
    expect(probe.expectationResult).toMatchObject({
      passed: true,
      lightingMatches: true,
      reviewMatches: true
    });
    expect(probe.baselineOutput.lightingCondition).toBe("natural light");
    expect(probe.changedByMemory).toBe(true);
    expect(probe.memoryComparison).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "lightingCondition",
          baseline: "natural light",
          learned: "golden hour",
          changed: true
        })
      ])
    );
    expect(probe.status).toBe("completed");
    expect(probe.persisted).toBe(false);
    expect(probe.reviewOnly).toBe(true);
    expect(probe.accepted).toBe(false);
    expect(probe.packagingGated).toBe(true);
    expect(probe.traceSummary).toHaveLength(7);
    expect(probe.traceSummary.every((step) => step.stepName && step.validation)).toBe(true);
    expect(probe.ruleDecisions.some((decision) => decision.memorySource === "visual_demonstration")).toBe(true);
    expect(probe.ruleDecisions.some((decision) => decision.decision === "applied")).toBe(true);
  });

  it("grades counterexample challenges as reviewable instead of over-applying visual memory", () => {
    const probe = buildLearningChallengeProbe({
      input: "At midday near Geneva, I photographed a lake portrait with rim light and long shadows under overhead sun.",
      expectedLighting: "natural light",
      expectedReview: true,
      taskId: demoTask.id,
      apprenticeId: demoApprentice.id,
      workflowNodes: demoWorkflow.nodes,
      rules: demoRules
    });

    expect(probe.output.lightingCondition).toBe("natural light");
    expect(probe.status).toBe("needs_review");
    expect(probe.expectationResult).toMatchObject({
      passed: true,
      lightingMatches: true,
      reviewMatches: true
    });
    expect(probe.changedByMemory).toBe(false);
    expect(probe.persisted).toBe(false);
    expect(probe.reviewOnly).toBe(true);
    expect(probe.ruleDecisions.some((decision) => decision.decision === "conflicted")).toBe(true);
    expect(probe.ruleDecisions.some((decision) => decision.counterCues.includes("midday"))).toBe(true);
  });

  it("runs the review-only challenge suite across positive, counterexample, and ordinary inputs", () => {
    const suite = buildLearningChallengeSuite({
      taskId: demoTask.id,
      apprenticeId: demoApprentice.id,
      workflowNodes: demoWorkflow.nodes,
      rules: demoRules
    });

    expect(suite).toMatchObject({
      reviewOnly: true,
      persisted: false,
      accepted: false,
      packagingGated: true,
      passed: 3,
      total: 3
    });
    expect(suite.items.map((item) => item.id)).toEqual([
      "positive-visual-cue",
      "counterexample-midday",
      "ordinary-daylight"
    ]);
    expect(suite.items.every((item) => item.probe.expectationResult.passed)).toBe(true);
    expect(suite.items.every((item) => item.probe.traceSummary.length === 7)).toBe(true);
    expect(suite.items.every((item) => item.probe.traceSummary.every((step) => step.stepName && step.validation))).toBe(true);
    expect(suite.items.find((item) => item.id === "positive-visual-cue")?.probe.changedByMemory).toBe(true);
    expect(
      suite.items
        .find((item) => item.id === "positive-visual-cue")
        ?.probe.ruleDecisions.some((decision) => decision.decision === "applied")
    ).toBe(true);
    expect(suite.items.find((item) => item.id === "counterexample-midday")?.probe.status).toBe("needs_review");
    expect(
      suite.items
        .find((item) => item.id === "counterexample-midday")
        ?.probe.ruleDecisions.some((decision) => decision.decision === "conflicted")
    ).toBe(true);
  });
});
