import type { LearningExtractionStep, RuleRecord } from "./types";

export type TeacherAcceptanceAgendaDecision = "ready_for_review" | "needs_revision" | "hold" | "locked";

export type TeacherAcceptanceAgendaDecisionDraftItem = {
  agendaItemId: string;
  label: string;
  evidencePath: string;
  currentReadiness: string;
  decision: TeacherAcceptanceAgendaDecision;
  note: string;
  teacherQuestion: string;
};

export type TeacherAcceptanceAgendaDecisionDraftRecord = {
  id: string;
  errorType: "teacher_acceptance_agenda_decision_draft";
  userFeedback: string;
  extractedRule: RuleRecord;
  beforeOutput: {
    mode: "teacher_acceptance_agenda_decision_exchange_v1";
    format: "teacher_acceptance_agenda_decision_json_v1";
    reviewOnly: true;
    accepted: false;
    packagingGated: true;
    itemCount: number;
  };
  afterOutput: {
    format: "teacher_acceptance_agenda_decision_json_v1";
    items: Array<
      TeacherAcceptanceAgendaDecisionDraftItem & {
        ruleEnabled: false;
        accepted: false;
        packagingGated: true;
      }
    >;
    decisionCounts: Record<TeacherAcceptanceAgendaDecision, number>;
    followUpItems: Array<{
      agendaItemId: string;
      label: string;
      decision: TeacherAcceptanceAgendaDecision;
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

export const teacherAcceptanceAgendaDecisionValues: TeacherAcceptanceAgendaDecision[] = [
  "ready_for_review",
  "needs_revision",
  "hold",
  "locked"
];

function zeroCounts(): Record<TeacherAcceptanceAgendaDecision, number> {
  return {
    ready_for_review: 0,
    needs_revision: 0,
    hold: 0,
    locked: 0
  };
}

export function buildTeacherAcceptanceAgendaDecisionDraft(args: {
  apprenticeId: string;
  taskId: string;
  items: TeacherAcceptanceAgendaDecisionDraftItem[];
  nextReviewPlan: string;
  createdAt?: string;
}): TeacherAcceptanceAgendaDecisionDraftRecord {
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
    .filter((item) => item.decision !== "ready_for_review")
    .map((item) => ({
      agendaItemId: item.agendaItemId,
      label: item.label,
      decision: item.decision,
      note: item.note
    }));
  const nextReviewPlan =
    args.nextReviewPlan.trim() ||
    (followUpItems.length > 0
      ? `Review the unresolved agenda items: ${followUpItems.map((item) => item.label).join(", ")}.`
      : "All agenda items are ready for teacher review notes, but this is still not technology acceptance.");
  const teacherSummary = [
    `Teacher acceptance agenda decision draft: ${normalizedItems.length} items.`,
    `ready=${decisionCounts.ready_for_review}; revision=${decisionCounts.needs_revision}; hold=${decisionCounts.hold}; locked=${decisionCounts.locked}.`,
    ...followUpItems.map(
      (item, index) => `${index + 1}. ${item.label}: ${item.decision}; note=${item.note || "no note"}`
    )
  ].join("\n");
  const extractedRule: RuleRecord = {
    id: `teacher-acceptance-agenda-decision-draft-rule-${Date.parse(createdAt) || Date.now()}`,
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    title: `Teacher acceptance agenda draft: ${followUpItems.length} follow-up items`,
    condition: "The teacher records review notes for acceptance agenda items.",
    action:
      followUpItems.length > 0
        ? `Continue teacher review on: ${followUpItems.map((item) => item.agendaItemId).join(", ")}.`
        : "Keep the agenda decision draft as review evidence only; it is not technology acceptance.",
    source: "manual",
    confidence: 0.7,
    enabled: false,
    createdAt
  };

  return {
    id: `teacher-acceptance-agenda-decision-draft-${Date.parse(createdAt) || Date.now()}`,
    errorType: "teacher_acceptance_agenda_decision_draft",
    userFeedback: teacherSummary,
    extractedRule,
    beforeOutput: {
      mode: "teacher_acceptance_agenda_decision_exchange_v1",
      format: "teacher_acceptance_agenda_decision_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: normalizedItems.length
    },
    afterOutput: {
      format: "teacher_acceptance_agenda_decision_json_v1",
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
        id: "teacher-acceptance-agenda-read-decisions",
        label: "Read teacher acceptance agenda decisions",
        evidence: teacherSummary,
        confidence: 0.9,
        validation: "These are review notes only, not a technology acceptance record.",
        needsHumanReview: false
      },
      {
        id: "teacher-acceptance-agenda-plan-review",
        label: "Plan the next teacher review step",
        evidence: nextReviewPlan,
        confidence: 0.82,
        validation: "Only unresolved agenda decisions become follow-up review work.",
        needsHumanReview: true
      },
      {
        id: "teacher-acceptance-agenda-keep-lock",
        label: "Keep packaging locked",
        evidence: "ruleEnabled=false; accepted=false; packagingGated=true.",
        confidence: 1,
        validation: "Agenda decision drafts cannot enable rules, accept technology, package, release, or wrap.",
        needsHumanReview: true
      }
    ],
    createdAt
  };
}
