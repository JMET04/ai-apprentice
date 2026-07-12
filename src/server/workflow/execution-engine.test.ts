import { describe, expect, it } from "vitest";
import { extractRuleFromFeedback } from "@/server/corrections/rule-extractor";
import { extractRuleFromTeachingExample } from "@/server/corrections/example-extractor";
import { extractRuleFromVisualDemonstration } from "@/server/corrections/visual-demo-extractor";
import { extractRuleFromExecutionHistory } from "@/server/corrections/history-lesson-extractor";
import type { RuleEvaluationRecord } from "@/lib/types";
import { executePhotographyJournalTask } from "./execution-engine";

function decisionAudit(run: ReturnType<typeof executePhotographyJournalTask>) {
  const decisionStep = run.trace.find((step) => step.id === "trace-decision");
  return (decisionStep?.output.ruleEvaluation ?? []) as RuleEvaluationRecord[];
}

describe("transparent apprentice learning loop", () => {
  it("applies the golden hour correction rule to dusk-like travel notes", () => {
    const run = executePhotographyJournalTask("Today I visited Lake Geneva at sunset with lake and snow mountains.");

    expect(run.output.lightingCondition).toBe("golden hour");
    expect(run.trace.some((step) => step.appliedRules.some((rule) => rule.id === "rule-golden-hour"))).toBe(true);
  });

  it("still recognizes Chinese dusk cues through explicit Unicode escapes", () => {
    const run = executePhotographyJournalTask(
      "\u508d\u665a\u53bb\u4e86\u65e5\u5185\u74e6\u6e56, \u5929\u6c14\u5f88\u597d, \u62cd\u4e86\u6e56\u9762\u548c\u96ea\u5c71."
    );

    expect(run.output.location).toBe("Lake Geneva");
    expect(run.output.lightingCondition).toBe("golden hour");
    expect(decisionAudit(run)[0]).toMatchObject({
      ruleId: "rule-golden-hour",
      decision: "applied",
      matchedCues: ["\u508d\u665a"]
    });
  });

  it("uses caller-provided learned rules as the visible memory source", () => {
    const run = executePhotographyJournalTask("sunset by the lake with mountains", [
      {
        id: "rule-custom-sunset",
        apprenticeId: "a1",
        taskId: "t1",
        title: "Custom sunset memory",
        condition: "Text contains sunset.",
        action: "Mark lighting as golden hour.",
        source: "correction",
        confidence: 0.95,
        enabled: true,
        createdAt: "2026-06-01T00:00:00.000Z"
      }
    ]);

    expect(run.output.lightingCondition).toBe("golden hour");
    expect(run.trace.some((step) => step.appliedRules.some((rule) => rule.id === "rule-custom-sunset"))).toBe(true);
  });

  it("does not change lighting from dusk words when matching memory is disabled", () => {
    const run = executePhotographyJournalTask("sunset by the lake with mountains", [
      {
        id: "rule-disabled-sunset",
        apprenticeId: "a1",
        taskId: "t1",
        title: "Disabled sunset memory",
        condition: "Text contains sunset.",
        action: "Mark lighting as golden hour.",
        source: "manual",
        confidence: 0.95,
        enabled: false,
        createdAt: "2026-06-01T00:00:00.000Z"
      }
    ]);

    expect(run.output.lightingCondition).toBe("natural light");
    expect(run.trace.some((step) => step.appliedRules.length > 0)).toBe(false);
    expect(decisionAudit(run)).toMatchObject([
      {
        ruleId: "rule-disabled-sunset",
        decision: "disabled",
        matched: true,
        matchedCues: ["sunset"]
      }
    ]);
  });

  it("uses visual demonstration cues as executable lighting memory", () => {
    const extraction = extractRuleFromVisualDemonstration({
      apprenticeId: "a1",
      taskId: "t1",
      title: "Low sun portrait board",
      artifact: {
        sceneDescription: "A portrait with low sun, warm orange highlights, rim light, and long shadows.",
        visualCues: ["low sun", "warm orange", "rim light", "long shadows"],
        lightingSignals: ["golden hour"],
        expectedPhotographyAdvice: ["Use backlight rim composition."]
      }
    });

    const run = executePhotographyJournalTask(
      "bridge portrait with warm orange rim light and long shadows",
      [extraction.extractedRule]
    );

    expect(run.output.lightingCondition).toBe("golden hour");
    expect(run.trace.some((step) => step.appliedRules.some((rule) => rule.id === extraction.extractedRule.id))).toBe(
      true
    );
    expect(decisionAudit(run)[0]).toMatchObject({
      decision: "applied",
      matchedCues: expect.arrayContaining(["rim light", "long shadows"]),
      memorySource: "visual_demonstration",
      ruleCondition: expect.stringContaining("low sun"),
      ruleAction: expect.stringContaining("golden hour"),
      evidencePath: expect.arrayContaining([
        expect.objectContaining({
          label: "Memory source",
          evidence: expect.stringContaining("visual-demonstration")
        }),
        expect.objectContaining({
          label: "Cue match",
          evidence: expect.stringContaining("rim light")
        })
      ])
    });
  });

  it("pauses visual memory when counterexample lighting cues suggest overgeneralization", () => {
    const extraction = extractRuleFromVisualDemonstration({
      apprenticeId: "a1",
      taskId: "t1",
      title: "Low sun portrait board",
      artifact: {
        sceneDescription: "A portrait with low sun, rim light, and long shadows.",
        visualCues: ["low sun", "rim light", "long shadows"],
        lightingSignals: ["golden hour"],
        expectedPhotographyAdvice: ["Use backlight rim composition."]
      }
    });

    const run = executePhotographyJournalTask(
      "midday lake portrait with rim light and long shadows under overhead sun",
      [extraction.extractedRule]
    );
    const decision = decisionAudit(run)[0];

    expect(run.output.lightingCondition).toBe("natural light");
    expect(run.status).toBe("needs_review");
    expect(run.trace.some((step) => step.appliedRules.length > 0)).toBe(false);
    expect(decision).toMatchObject({
      decision: "conflicted",
      memorySource: "visual_demonstration",
      matchedCues: expect.arrayContaining(["rim light", "long shadows"]),
      counterCues: expect.arrayContaining(["midday", "overhead sun"]),
      evidencePath: expect.arrayContaining([
        expect.objectContaining({
          label: "Counterexample check",
          evidence: expect.stringContaining("midday")
        })
      ])
    });
  });

  it("uses teacher counterexample memory as the source for visual conflict review", () => {
    const visual = extractRuleFromVisualDemonstration({
      apprenticeId: "a1",
      taskId: "t1",
      title: "Low sun portrait board",
      artifact: {
        sceneDescription: "A portrait with low sun, rim light, and long shadows.",
        visualCues: ["low sun", "rim light", "long shadows"],
        lightingSignals: ["golden hour"],
        expectedPhotographyAdvice: ["Use backlight rim composition."]
      }
    });
    const counterexample = extractRuleFromFeedback({
      apprenticeId: "a1",
      taskId: "t1",
      beforeOutput: { lightingCondition: "golden hour" },
      feedback: "Visual counterexample",
      structuredFeedback: {
        field: "lightingCondition",
        correctedValue: "natural light",
        conditionCue: "midday, overhead sun",
        note: "Do not apply golden-hour visual memory for this lighting."
      }
    });

    const run = executePhotographyJournalTask("midday portrait with rim light and overhead sun", [
      visual.extractedRule,
      counterexample.extractedRule
    ]);
    const audit = decisionAudit(run);

    expect(counterexample.errorType).toBe("visual_counterexample_memory");
    expect(counterexample.extractedRule.title).toBe("Visual counterexample for golden-hour memory");
    expect(audit.find((evaluation) => evaluation.ruleId === counterexample.extractedRule.id)).toMatchObject({
      decision: "counterexample",
      counterCues: expect.arrayContaining(["midday", "overhead sun"])
    });
    expect(audit.find((evaluation) => evaluation.ruleId === visual.extractedRule.id)).toMatchObject({
      decision: "conflicted",
      counterEvidenceSources: ["Visual counterexample for golden-hour memory"],
      evidencePath: expect.arrayContaining([
        expect.objectContaining({
          label: "Counterexample check",
          evidence: expect.stringContaining("Counterexample memory sources")
        })
      ])
    });
    expect(run.output.lightingCondition).toBe("natural light");
  });

  it("does not apply enabled rules when their learned cues do not match the input", () => {
    const run = executePhotographyJournalTask("bright noon by the lake with mountains", [
      {
        id: "rule-custom-sunset",
        apprenticeId: "a1",
        taskId: "t1",
        title: "Custom sunset memory",
        condition: "Text contains sunset.",
        action: "Mark lighting as golden hour.",
        source: "correction",
        confidence: 0.95,
        enabled: true,
        createdAt: "2026-06-01T00:00:00.000Z"
      }
    ]);

    expect(run.output.lightingCondition).toBe("natural light");
    expect(run.trace.some((step) => step.appliedRules.length > 0)).toBe(false);
    expect(decisionAudit(run)[0]).toMatchObject({
      ruleId: "rule-custom-sunset",
      decision: "not_matched",
      matched: false
    });
  });

  it("keeps generated runs attached to the requested task and apprentice", () => {
    const run = executePhotographyJournalTask("sunset by the lake with mountains", [], {
      taskId: "task-custom",
      apprenticeId: "apprentice-custom"
    });

    expect(run.taskId).toBe("task-custom");
    expect(run.apprenticeId).toBe("apprentice-custom");
  });

  it("binds trace steps to caller-provided workflow node ids", () => {
    const run = executePhotographyJournalTask("sunset by the lake with mountains", [], {
      taskId: "task-custom",
      apprenticeId: "apprentice-custom",
      traceNodeIds: {
        input: "task-custom-node-input",
        understand: "task-custom-node-understand",
        decision: "task-custom-node-decision",
        execute: "task-custom-node-execute",
        check: "task-custom-node-check",
        human_review: "task-custom-node-human",
        output: "task-custom-node-output"
      }
    });

    expect(run.trace.map((step) => step.nodeId)).toEqual([
      "task-custom-node-input",
      "task-custom-node-understand",
      "task-custom-node-decision",
      "task-custom-node-execute",
      "task-custom-node-check",
      "task-custom-node-human",
      "task-custom-node-output"
    ]);
  });

  it("records every visual workflow phase in the public trace", () => {
    const run = executePhotographyJournalTask("sunset by Lake Geneva with clear weather and mountains");

    expect(run.trace.map((step) => step.id)).toEqual([
      "trace-input",
      "trace-understand",
      "trace-decision",
      "trace-execute",
      "trace-check",
      "trace-human",
      "trace-output"
    ]);
    expect(run.trace.find((step) => step.id === "trace-check")).toMatchObject({
      validation: "Structured output passed required-field and public-trace checks.",
      needsHumanReview: false
    });
    expect(run.trace.find((step) => step.id === "trace-output")?.output).toMatchObject({
      memoryApplied: expect.arrayContaining(["Dusk words mean golden hour"])
    });
  });

  it("extracts a reusable lighting rule from natural-language correction", () => {
    const extraction = extractRuleFromFeedback({
      apprenticeId: "a1",
      taskId: "t1",
      beforeOutput: {},
      feedback:
        "In future runs, if sunset, dusk, golden hour, \u508d\u665a, or \u9ec4\u660f appears, set lightingCondition to golden hour."
    });

    expect(extraction.errorType).toBe("lighting_condition_rule");
    expect(extraction.applyAutomatically).toBe(true);
    expect(extraction.extractedRule.action).toContain("golden hour");
    expect(extraction.learningTrace.map((step) => step.id)).toEqual([
      "learn-read-signal",
      "learn-extract-rule",
      "learn-policy-check"
    ]);
  });

  it("extracts reusable rules from structured field feedback", () => {
    const extraction = extractRuleFromFeedback({
      apprenticeId: "a1",
      taskId: "t1",
      beforeOutput: { lightingCondition: "natural light" },
      feedback: "Structured field correction",
      structuredFeedback: {
        field: "lightingCondition",
        correctedValue: "golden hour",
        conditionCue: "warm orange rim light",
        note: "Use warm backlight advice."
      }
    });

    const run = executePhotographyJournalTask("portrait with warm orange rim light", [extraction.extractedRule]);

    expect(extraction.errorType).toBe("structured_field_feedback");
    expect(extraction.extractedRule.title).toBe("Structured feedback for lightingCondition");
    expect(extraction.learningTrace.some((step) => step.validation.includes("Memory can be applied"))).toBe(true);
    expect(run.output.lightingCondition).toBe("golden hour");
    expect(decisionAudit(run)[0]).toMatchObject({
      decision: "applied",
      matchedCues: expect.arrayContaining(["warm orange", "rim light"])
    });
  });

  it("keeps teacher-confirmation rules paused until explicitly enabled", () => {
    const preference = extractRuleFromFeedback({
      apprenticeId: "a1",
      taskId: "t1",
      beforeOutput: {},
      feedback: "Prefer a calmer editorial tone for similar journals."
    });
    const example = extractRuleFromTeachingExample({
      apprenticeId: "a1",
      taskId: "t1",
      input: "a bright noon cafe street scene",
      expectedOutput: { tone: "calm editorial" }
    });
    const visual = extractRuleFromVisualDemonstration({
      apprenticeId: "a1",
      taskId: "t1",
      title: "Neutral architecture board",
      artifact: {
        sceneDescription: "Clean white building facade at noon.",
        visualCues: ["straight lines", "white facade"],
        lightingSignals: ["noon"],
        expectedPhotographyAdvice: ["Keep vertical lines straight."]
      }
    });

    expect(preference.requiresHumanConfirmation).toBe(true);
    expect(preference.extractedRule.enabled).toBe(false);
    expect(example.requiresHumanConfirmation).toBe(true);
    expect(example.extractedRule.enabled).toBe(false);
    expect(visual.requiresHumanConfirmation).toBe(true);
    expect(visual.extractedRule.enabled).toBe(false);
    expect(visual.learningTrace.some((step) => step.needsHumanReview)).toBe(true);
  });

  it("extracts reusable active memory from a clear successful execution history trace", () => {
    const run = executePhotographyJournalTask(
      "Today I visited Lake Geneva. The weather was clear. I photographed the lake, snow mountains, and a portrait at sunset."
    );
    const rule = extractRuleFromExecutionHistory({
      runId: run.id,
      apprenticeId: run.apprenticeId,
      taskId: run.taskId,
      input: run.input,
      output: run.output,
      trace: run.trace
    });

    expect(rule.id).toBe(`rule-history-${run.id}`);
    expect(rule.source).toBe("manual");
    expect(rule.enabled).toBe(true);
    expect(rule.condition).toContain("sunset");
    expect(rule.action).toContain("lightingCondition=golden hour");
  });

  it("keeps execution-history memory paused when the source trace still needed review", () => {
    const run = executePhotographyJournalTask("sunset by the lake with mountains");
    const rule = extractRuleFromExecutionHistory({
      runId: run.id,
      apprenticeId: run.apprenticeId,
      taskId: run.taskId,
      input: run.input,
      output: run.output,
      trace: run.trace
    });

    expect(rule.enabled).toBe(false);
  });
});
