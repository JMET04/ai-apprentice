import type { LearningExtractionStep } from "@/lib/types";

export function buildLearningTrace(args: {
  source: "correction" | "structured_feedback" | "example" | "visual_demo";
  evidence: string;
  ruleTitle: string;
  confidence: number;
  applyAutomatically: boolean;
  requiresHumanConfirmation: boolean;
}): LearningExtractionStep[] {
  return [
    {
      id: "learn-read-signal",
      label: "Read teacher signal",
      evidence: args.evidence,
      confidence: 0.88,
      validation: `Teacher signal captured from ${args.source}.`,
      needsHumanReview: false
    },
    {
      id: "learn-extract-rule",
      label: "Extract reusable rule",
      evidence: args.ruleTitle,
      confidence: args.confidence,
      validation: "Reusable condition and action were separated from the source evidence.",
      needsHumanReview: false
    },
    {
      id: "learn-policy-check",
      label: "Apply memory policy",
      evidence: args.applyAutomatically ? "Rule can run automatically." : "Rule is saved paused for teacher approval.",
      confidence: args.requiresHumanConfirmation ? 0.72 : 0.9,
      validation: args.requiresHumanConfirmation
        ? "Human confirmation is required before this memory affects future runs."
        : "Memory can be applied to matching future runs.",
      needsHumanReview: args.requiresHumanConfirmation
    }
  ];
}
