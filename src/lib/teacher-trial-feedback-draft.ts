import type { LearningExtractionStep, RuleRecord } from "./types";

export type TeacherTrialFeedbackDecision = "works" | "needs_change" | "blocked" | "not_tried";

export type TeacherTrialFeedbackItem = {
  id: string;
  label: string;
  route: string;
  expectedEvidence: string;
  decision: TeacherTrialFeedbackDecision;
  note: string;
};

export type TeacherTrialFeedbackDraftRecord = {
  id: string;
  errorType: "teacher_trial_feedback_draft";
  userFeedback: string;
  extractedRule: RuleRecord;
  beforeOutput: {
    mode: "teacher_trial_feedback_review_only_v1";
    format: "teacher_trial_feedback_draft_json_v1";
    reviewOnly: true;
    accepted: false;
    packagingGated: true;
    itemCount: number;
  };
  afterOutput: {
    format: "teacher_trial_feedback_draft_json_v1";
    items: Array<
      TeacherTrialFeedbackItem & {
        ruleEnabled: false;
        accepted: false;
        packagingGated: true;
      }
    >;
    decisionCounts: Record<TeacherTrialFeedbackDecision, number>;
    followUpItems: Array<{
      id: string;
      label: string;
      route: string;
      decision: TeacherTrialFeedbackDecision;
      note: string;
    }>;
    nextReviewPlan: string;
    ruleEnabled: false;
    accepted: false;
    packagingGated: true;
  };
  learningTrace: LearningExtractionStep[];
  createdAt: string;
};

export const teacherTrialFeedbackDecisionValues: TeacherTrialFeedbackDecision[] = [
  "works",
  "needs_change",
  "blocked",
  "not_tried"
];

function zeroCounts(): Record<TeacherTrialFeedbackDecision, number> {
  return {
    works: 0,
    needs_change: 0,
    blocked: 0,
    not_tried: 0
  };
}

export function buildTeacherTrialFeedbackDraft(args: {
  apprenticeId: string;
  taskId: string;
  items: TeacherTrialFeedbackItem[];
  nextReviewPlan: string;
  createdAt?: string;
}): TeacherTrialFeedbackDraftRecord {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const normalizedItems = args.items.map((item) => ({
    ...item,
    note: item.note.trim(),
    ruleEnabled: false as const,
    accepted: false as const,
    packagingGated: true as const
  }));
  const decisionCounts = zeroCounts();

  for (const item of normalizedItems) {
    decisionCounts[item.decision] += 1;
  }

  const followUpItems = normalizedItems
    .filter((item) => item.decision !== "works")
    .map((item) => ({
      id: item.id,
      label: item.label,
      route: item.route,
      decision: item.decision,
      note: item.note
    }));
  const nextReviewPlan =
    args.nextReviewPlan.trim() ||
    (followUpItems.length > 0
      ? `Review trial feedback for: ${followUpItems.map((item) => item.label).join(", ")}.`
      : "Trial feedback has no unresolved route, but this is still not technology acceptance.");
  const teacherSummary = [
    `Teacher trial feedback draft: ${normalizedItems.length} routes.`,
    `works=${decisionCounts.works}; needs_change=${decisionCounts.needs_change}; blocked=${decisionCounts.blocked}; not_tried=${decisionCounts.not_tried}.`,
    ...followUpItems.map(
      (item, index) => `${index + 1}. ${item.label} (${item.route}): ${item.decision}; note=${item.note || "no note"}`
    )
  ].join("\n");
  const extractedRule: RuleRecord = {
    id: `teacher-trial-feedback-draft-rule-${Date.parse(createdAt) || Date.now()}`,
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    title: `Teacher trial feedback draft: ${followUpItems.length} follow-up routes`,
    condition: "The teacher records hands-on trial feedback for the preview package.",
    action:
      followUpItems.length > 0
        ? `Continue product work on: ${followUpItems.map((item) => item.id).join(", ")}.`
        : "Keep the trial receipt as review evidence only; it is not technology acceptance.",
    source: "manual",
    confidence: 0.74,
    enabled: false,
    createdAt
  };

  return {
    id: `teacher-trial-feedback-draft-${Date.parse(createdAt) || Date.now()}`,
    errorType: "teacher_trial_feedback_draft",
    userFeedback: teacherSummary,
    extractedRule,
    beforeOutput: {
      mode: "teacher_trial_feedback_review_only_v1",
      format: "teacher_trial_feedback_draft_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: normalizedItems.length
    },
    afterOutput: {
      format: "teacher_trial_feedback_draft_json_v1",
      items: normalizedItems,
      decisionCounts,
      followUpItems,
      nextReviewPlan,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true
    },
    learningTrace: [
      {
        id: "teacher-trial-read-feedback",
        label: "Read teacher trial feedback",
        evidence: teacherSummary,
        confidence: 0.9,
        validation: "This is hands-on preview feedback only, not technology acceptance.",
        needsHumanReview: false
      },
      {
        id: "teacher-trial-build-follow-up-plan",
        label: "Build review-only product follow-up plan",
        evidence: nextReviewPlan,
        confidence: 0.84,
        validation: "Needs-change, blocked, and not-tried routes become follow-up work; works routes do not unlock packaging.",
        needsHumanReview: true
      },
      {
        id: "teacher-trial-keep-lock",
        label: "Keep acceptance and packaging locked",
        evidence: "ruleEnabled=false; accepted=false; packagingGated=true.",
        confidence: 1,
        validation: "Trial feedback cannot enable rules, accept technology, package, release, wrap, or unlock packaging.",
        needsHumanReview: true
      }
    ],
    createdAt
  };
}
