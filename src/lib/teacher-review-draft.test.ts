import { describe, expect, it } from "vitest";
import { buildTeacherReviewDraft } from "./teacher-review-draft";

describe("teacher review draft", () => {
  it("records worksheet judgments without accepting the technology or unlocking packaging", () => {
    const draft = buildTeacherReviewDraft({
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      createdAt: "2026-06-01T14:40:00.000Z",
      followUpDraft: "下一轮先补强三维拟合证据，再复核普通自然光误判。",
      items: [
        {
          id: "spatial-fit-selection-decision",
          label: "三维拟合候选是否足够可选",
          question: "老师是否能看懂每个候选为什么生成？",
          evidence: "三个候选均有残差、置信度和下一步预测。",
          decision: "needs_change",
          note: "希望候选解释再短一点。"
        },
        {
          id: "packaging-boundary",
          label: "封装是否仍锁定",
          question: "未确认前是否没有封装入口？",
          evidence: "accepted=false，packagingGated=true。",
          decision: "tentative_pass",
          note: ""
        }
      ]
    });

    expect(draft.errorType).toBe("visual_teacher_review_draft");
    expect(draft.extractedRule.enabled).toBe(false);
    expect(draft.afterOutput.decisionCounts.needs_change).toBe(1);
    expect(draft.afterOutput.decisionCounts.tentative_pass).toBe(1);
    expect(draft.afterOutput.followUpItems).toHaveLength(1);
    expect(draft.afterOutput.accepted).toBe(false);
    expect(draft.afterOutput.packagingGated).toBe(true);
    expect(draft.learningTrace).toHaveLength(3);
    expect(draft.learningTrace.some((step) => step.id === "teacher-review-keep-packaging-locked")).toBe(true);
  });
});
