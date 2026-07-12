import { describe, expect, it } from "vitest";
import { demoApprentice, demoTask } from "@/lib/demo-data";
import { extractRuleFromVisualDemonstration } from "./visual-demo-extractor";

describe("extractRuleFromVisualDemonstration", () => {
  it("uses grounded visual annotations as reusable rule evidence", () => {
    const extraction = extractRuleFromVisualDemonstration({
      apprenticeId: demoApprentice.id,
      taskId: demoTask.id,
      title: "Annotated low-sun portrait",
      artifact: {
        referenceImageUrl: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
        sceneDescription: "A portrait frame with warm light.",
        visualCues: ["soft face shadows"],
        lightingSignals: [],
        expectedPhotographyAdvice: ["Use backlight rim composition."],
        annotations: [
          {
            id: "annotation-sun",
            label: "Sun disk",
            cue: "low sun angle",
            evidence: "The sun is low in the image and casts long warm shadows.",
            region: { x: 72, y: 18, width: 14, height: 18 },
            confidence: 0.91
          }
        ]
      }
    });

    expect(extraction.errorType).toBe("visual_demonstration_rule");
    expect(extraction.extractedRule.enabled).toBe(true);
    expect(extraction.extractedRule.title).toBe("Visual sunset cues mean golden hour");
    expect(extraction.condition).toContain("low sun angle");
    expect(extraction.learningTrace[0].evidence).toContain("Sun disk -> low sun angle");
  });
});
