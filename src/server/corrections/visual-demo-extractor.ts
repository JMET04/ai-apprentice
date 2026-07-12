import type { CorrectionExtraction, RuleRecord, VisualDemonstrationArtifact } from "@/lib/types";
import { buildLearningTrace } from "./learning-trace";

function hasGoldenHourCue(artifact: VisualDemonstrationArtifact) {
  const annotationEvidence = (artifact.annotations ?? []).flatMap((annotation) => [
    annotation.label,
    annotation.cue,
    annotation.evidence
  ]);
  const signals = [
    artifact.referenceImageUrl ? "reference image attached" : "",
    artifact.sceneDescription,
    ...annotationEvidence,
    ...artifact.visualCues,
    ...artifact.lightingSignals,
    ...artifact.expectedPhotographyAdvice
  ]
    .join(" ")
    .toLowerCase();

  return ["sunset", "dusk", "golden hour", "low sun", "warm light", "rim light"].some((cue) =>
    signals.includes(cue)
  );
}

export function extractRuleFromVisualDemonstration(args: {
  artifact: VisualDemonstrationArtifact;
  apprenticeId: string;
  taskId: string;
  title: string;
}): CorrectionExtraction {
  const goldenHour = hasGoldenHourCue(args.artifact);
  const annotationEvidence = (args.artifact.annotations ?? []).flatMap((annotation) => [
    annotation.cue,
    annotation.evidence
  ]);
  const cues = [
    ...args.artifact.lightingSignals,
    ...annotationEvidence,
    ...args.artifact.visualCues,
    ...args.artifact.expectedPhotographyAdvice
  ]
    .map((cue) => cue.trim())
    .filter(Boolean);
  const uniqueCues = Array.from(new Set(cues));
  const condition = goldenHour
    ? `Text or visual note resembles this teacher demonstration: ${uniqueCues.join(", ")}.`
    : "A future input resembles this teacher-provided visual demonstration.";
  const action = goldenHour
    ? "Classify lightingCondition as golden hour and recommend warm side light or backlight composition."
    : "Use the teacher's visual cues to adjust the structured journal and photography advice.";

  const extractedRule: RuleRecord = {
    id: `rule-visual-${Date.now()}`,
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    title: goldenHour ? "Visual sunset cues mean golden hour" : `Visual demo: ${args.title}`,
    condition,
    action,
    source: "correction",
    confidence: goldenHour ? 0.86 : 0.74,
    enabled: goldenHour,
    createdAt: new Date().toISOString()
  };

  return {
    errorType: "visual_demonstration_rule",
    errorReason:
      args.artifact.annotations && args.artifact.annotations.length > 0
        ? "The teacher grounded visual cues in specific reference-frame regions that should guide similar future executions."
        : "The teacher supplied visual evidence that should guide similar future executions.",
    condition,
    action,
    extractedRule,
    applyAutomatically: goldenHour,
    requiresHumanConfirmation: !goldenHour,
    learningTrace: buildLearningTrace({
      source: "visual_demo",
      evidence: `${args.title}: ${args.artifact.referenceImageUrl ? "reference image attached. " : ""}${args.artifact.sceneDescription}${
        args.artifact.annotations && args.artifact.annotations.length > 0
          ? ` Grounded regions: ${args.artifact.annotations
              .map((annotation) => `${annotation.label} -> ${annotation.cue}`)
              .join("; ")}.`
          : ""
      }`,
      ruleTitle: extractedRule.title,
      confidence: extractedRule.confidence,
      applyAutomatically: goldenHour,
      requiresHumanConfirmation: !goldenHour
    })
  };
}
