import { describe, expect, it } from "vitest";
import { buildTeacherAcceptanceAgendaDecisionDraft } from "./teacher-acceptance-agenda-draft";

describe("teacher acceptance agenda decision draft", () => {
  it("records agenda decisions without accepting technology or unlocking packaging", () => {
    const draft = buildTeacherAcceptanceAgendaDecisionDraft({
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      createdAt: "2026-06-02T15:10:00.000Z",
      nextReviewPlan: "Recheck worksheet evidence and keep packaging locked.",
      items: [
        {
          agendaItemId: "agenda-review-dossier",
          label: "Review dossier",
          evidencePath: "qualification_report.visualReviewDossier",
          currentReadiness: "ready_for_teacher_decision",
          decision: "ready_for_review",
          note: "Evidence is readable.",
          teacherQuestion: "Is dossier evidence enough for review?"
        },
        {
          agendaItemId: "agenda-confirm-packaging-lock",
          label: "Confirm packaging remains locked",
          evidencePath: "qualification_report.teacherAcceptanceBoundary",
          currentReadiness: "locked_until_teacher_acceptance",
          decision: "locked",
          note: "Keep this locked.",
          teacherQuestion: "Should packaging stay blocked?"
        }
      ]
    });

    expect(draft.errorType).toBe("teacher_acceptance_agenda_decision_draft");
    expect(draft.extractedRule.enabled).toBe(false);
    expect(draft.afterOutput.decisionCounts.ready_for_review).toBe(1);
    expect(draft.afterOutput.decisionCounts.locked).toBe(1);
    expect(draft.afterOutput.followUpItems).toHaveLength(1);
    expect(draft.afterOutput.items.every((item) => !item.ruleEnabled && !item.accepted && item.packagingGated)).toBe(
      true
    );
    expect(draft.afterOutput.accepted).toBe(false);
    expect(draft.afterOutput.packagingGated).toBe(true);
    expect(draft.learningTrace).toHaveLength(3);
    expect(draft.learningTrace.some((step) => step.id === "teacher-acceptance-agenda-keep-lock")).toBe(true);
  });
});
