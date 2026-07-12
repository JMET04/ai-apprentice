import { describe, expect, it } from "vitest";
import { extractRuleFromFeedback } from "./rule-extractor";

describe("correction rule extractor memory policy", () => {
  it("keeps a lighting correction paused when the teacher requires confirmation", () => {
    const extraction = extractRuleFromFeedback({
      feedback: "When the note contains sunset, mark lightingCondition as golden hour.",
      beforeOutput: {},
      apprenticeId: "apprentice-photo-journal",
      taskId: "task-photo-travel-journal",
      memoryPolicy: {
        applyAutomatically: false,
        requiresHumanConfirmation: true
      }
    });

    expect(extraction.errorType).toBe("lighting_condition_rule");
    expect(extraction.applyAutomatically).toBe(false);
    expect(extraction.requiresHumanConfirmation).toBe(true);
    expect(extraction.extractedRule.enabled).toBe(false);
    expect(extraction.learningTrace.some((step) => step.needsHumanReview)).toBe(true);
  });

  it("enables structured feedback when the teacher allows future automatic use", () => {
    const extraction = extractRuleFromFeedback({
      feedback: "Structured field correction: set lightingCondition to golden hour.",
      beforeOutput: {},
      apprenticeId: "apprentice-photo-journal",
      taskId: "task-photo-travel-journal",
      structuredFeedback: {
        field: "lightingCondition",
        correctedValue: "golden hour",
        conditionCue: "warm rim light"
      },
      memoryPolicy: {
        applyAutomatically: true,
        requiresHumanConfirmation: false
      }
    });

    expect(extraction.errorType).toBe("structured_field_feedback");
    expect(extraction.applyAutomatically).toBe(true);
    expect(extraction.requiresHumanConfirmation).toBe(false);
    expect(extraction.extractedRule.enabled).toBe(true);
  });
});
