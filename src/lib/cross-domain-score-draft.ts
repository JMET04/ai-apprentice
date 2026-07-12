import type { LearningExtractionStep, RuleRecord } from "./types";

export type CrossDomainTeacherScoreDecision =
  | "approve_for_review"
  | "needs_revision"
  | "boundary_only"
  | "hold";

export type CrossDomainTeacherScoreDraftItem = {
  caseId: string;
  apprenticeId: string;
  domain: "photography_journal" | "spatial_engineering" | "human_knowledge";
  score: number;
  decision: CrossDomainTeacherScoreDecision;
  note: string;
  followUpQuestion: string;
};

export type CrossDomainTeacherScoreDraftRecord = {
  id: string;
  errorType: "cross_domain_teacher_score_draft";
  userFeedback: string;
  extractedRule: RuleRecord;
  beforeOutput: {
    mode: "cross_domain_teacher_batch_score_replay_v1";
    format: "teacher_cross_domain_score_json_v1";
    reviewOnly: true;
    accepted: false;
    packagingGated: true;
    itemCount: number;
  };
  afterOutput: {
    format: "teacher_cross_domain_score_json_v1";
    items: Array<
      CrossDomainTeacherScoreDraftItem & {
        ruleEnabled: false;
        accepted: false;
        packagingGated: true;
      }
    >;
    averageScore: number;
    needsFollowUp: number;
    disabledDraftImpacts: number;
    followUpDraft: string;
    ruleEnabled: false;
    accepted: false;
    packagingGated: true;
  };
  learningTrace: LearningExtractionStep[];
  createdAt: string;
};

export const crossDomainTeacherScoreDecisions: CrossDomainTeacherScoreDecision[] = [
  "approve_for_review",
  "needs_revision",
  "boundary_only",
  "hold"
];

export function buildCrossDomainTeacherScoreDraft(args: {
  apprenticeId: string;
  taskId: string;
  items: CrossDomainTeacherScoreDraftItem[];
  followUpDraft: string;
  createdAt?: string;
}): CrossDomainTeacherScoreDraftRecord {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const normalizedItems = args.items.map((item) => ({
    ...item,
    score: Math.max(0, Math.min(100, Math.round(item.score))),
    note: item.note.trim(),
    followUpQuestion: item.followUpQuestion.trim(),
    ruleEnabled: false as const,
    accepted: false as const,
    packagingGated: true as const
  }));
  const averageScore =
    normalizedItems.length > 0
      ? Math.round(normalizedItems.reduce((total, item) => total + item.score, 0) / normalizedItems.length)
      : 0;
  const needsFollowUp = normalizedItems.filter((item) => item.decision !== "approve_for_review").length;
  const followUpCases = normalizedItems.filter(
    (item) => item.decision === "needs_revision" || item.decision === "boundary_only" || item.decision === "hold"
  );
  const teacherSummary = [
    `Cross-domain teacher score draft: ${normalizedItems.length} items; average=${averageScore}; followUps=${needsFollowUp}.`,
    ...followUpCases.map(
      (item, index) =>
        `${index + 1}. ${item.caseId}: ${item.decision}; score=${item.score}; note=${item.note || "no note"}`
    )
  ].join("\n");
  const extractedRule: RuleRecord = {
    id: `cross-domain-teacher-score-draft-rule-${Date.parse(createdAt) || Date.now()}`,
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    title: `Cross-domain teacher score draft: ${needsFollowUp} follow-up items`,
    condition: "The teacher records batch scores for cross-domain apprentice transfer evidence.",
    action:
      followUpCases.length > 0
        ? `Plan the next review-only lesson for: ${followUpCases.map((item) => item.caseId).join(", ")}.`
        : "Keep the score draft as review evidence only; it is not technology acceptance.",
    source: "manual",
    confidence: 0.68,
    enabled: false,
    createdAt
  };
  const followUpDraft =
    args.followUpDraft.trim() ||
    (followUpCases.length > 0
      ? `Next lesson should revisit ${followUpCases.map((item) => item.caseId).join(", ")} with boundary examples.`
      : "No cross-domain follow-up selected yet; keep review-only evidence locked.");

  return {
    id: `cross-domain-teacher-score-draft-${Date.parse(createdAt) || Date.now()}`,
    errorType: "cross_domain_teacher_score_draft",
    userFeedback: teacherSummary,
    extractedRule,
    beforeOutput: {
      mode: "cross_domain_teacher_batch_score_replay_v1",
      format: "teacher_cross_domain_score_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: normalizedItems.length
    },
    afterOutput: {
      format: "teacher_cross_domain_score_json_v1",
      items: normalizedItems,
      averageScore,
      needsFollowUp,
      disabledDraftImpacts: normalizedItems.filter(
        (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
      ).length,
      followUpDraft,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true
    },
    learningTrace: [
      {
        id: "cross-domain-score-read-draft",
        label: "Read cross-domain teacher score draft",
        evidence: teacherSummary,
        confidence: 0.9,
        validation: "This is a teacher review draft, not technology acceptance.",
        needsHumanReview: false
      },
      {
        id: "cross-domain-score-plan-next-lesson",
        label: "Plan next cross-domain teaching lesson",
        evidence: followUpDraft,
        confidence: 0.82,
        validation: "Only non-approved or boundary-only cases enter the next lesson queue.",
        needsHumanReview: true
      },
      {
        id: "cross-domain-score-keep-lock",
        label: "Keep cross-domain rules and packaging locked",
        evidence: "ruleEnabled=false; accepted=false; packagingGated=true.",
        confidence: 1,
        validation: "Teacher scores cannot enable cross-domain rules, accept the technology, or unlock packaging.",
        needsHumanReview: true
      }
    ],
    createdAt
  };
}
