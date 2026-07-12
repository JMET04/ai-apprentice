import { describe, expect, it } from "vitest";
import {
  buildDynamicTeachingPredictionPreview,
  defaultDynamicTeachingPredictionJson
} from "./teaching-prediction";

describe("dynamic teaching prediction", () => {
  it("predicts chess-like next moves from code-first teacher input", () => {
    const preview = buildDynamicTeachingPredictionPreview(defaultDynamicTeachingPredictionJson());

    expect(preview.status).toBe("ready_for_teacher_review");
    expect(preview.metaphor).toBe("chess_like_next_move_prediction");
    expect(preview.reviewOnly).toBe(true);
    expect(preview.accepted).toBe(false);
    expect(preview.packagingGated).toBe(true);
    expect(preview.parsedInput?.inputMode).toBe("code_coordinate");
    expect(preview.candidates).toHaveLength(3);
    expect(preview.candidates.every((candidate) => candidate.reviewState === "awaiting_teacher_review")).toBe(true);
    expect(preview.candidates.every((candidate) => candidate.teacherCorrectionPoint.includes("老师"))).toBe(true);
    expect(preview.candidates.some((candidate) => candidate.predictedNextStep.includes("坐标"))).toBe(true);
    expect(preview.candidates.some((candidate) => candidate.memoryEffect.includes("accepted=false"))).toBe(true);
    expect(preview.teacherQuestion).toContain("老师");
    expect(preview.blockedActions).toEqual(["Accept technology", "Package", "Release", "Wrap"]);
  });

  it("asks the teacher to fix invalid teaching move code without unlocking packaging", () => {
    const preview = buildDynamicTeachingPredictionPreview("{");

    expect(preview.status).toBe("needs_teacher_fix");
    expect(preview.parsedInput).toBeNull();
    expect(preview.candidates).toHaveLength(0);
    expect(preview.teacherQuestion).toContain("老师");
    expect(preview.accepted).toBe(false);
    expect(preview.packagingGated).toBe(true);
    expect(preview.blockedActions).toContain("Package");
  });
});
