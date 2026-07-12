import { describe, expect, it } from "vitest";
import { buildTeacherTrialFeedbackDraft } from "./teacher-trial-feedback-draft";

describe("teacher trial feedback draft", () => {
  it("records hands-on trial feedback without accepting technology or unlocking packaging", () => {
    const draft = buildTeacherTrialFeedbackDraft({
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      createdAt: "2026-06-03T10:20:00.000Z",
      nextReviewPlan: "Fix the correction route before the next preview package.",
      items: [
        {
          id: "open-task",
          label: "Open task detail",
          route: "/tasks/task-demo",
          expectedEvidence: "Task page loads and shows trace evidence.",
          decision: "works",
          note: "Looks good."
        },
        {
          id: "save-correction",
          label: "Save correction",
          route: "/tasks/task-demo/run",
          expectedEvidence: "Correction becomes disabled review memory.",
          decision: "needs_change",
          note: "Button copy is unclear."
        },
        {
          id: "export-review",
          label: "Export review packet",
          route: "/tasks/task-demo",
          expectedEvidence: "Review JSON is visible.",
          decision: "not_tried",
          note: ""
        }
      ]
    });

    expect(draft.errorType).toBe("teacher_trial_feedback_draft");
    expect(draft.beforeOutput.reviewOnly).toBe(true);
    expect(draft.beforeOutput.accepted).toBe(false);
    expect(draft.beforeOutput.packagingGated).toBe(true);
    expect(draft.afterOutput.ruleEnabled).toBe(false);
    expect(draft.afterOutput.accepted).toBe(false);
    expect(draft.afterOutput.packagingGated).toBe(true);
    expect(draft.afterOutput.decisionCounts).toEqual({
      works: 1,
      needs_change: 1,
      blocked: 0,
      not_tried: 1
    });
    expect(draft.afterOutput.followUpItems).toHaveLength(2);
    expect(draft.extractedRule.enabled).toBe(false);
    expect(draft.learningTrace).toHaveLength(3);
    expect(draft.learningTrace[2].validation).toContain("cannot enable rules");
  });
});
