import type { LearningExtractionStep, RuleRecord } from "./types";

export type TeacherReviewDraftDecision = "unreviewed" | "tentative_pass" | "needs_change" | "unsure";

export type TeacherReviewDraftItem = {
  id: string;
  label: string;
  question: string;
  evidence: string;
  decision: TeacherReviewDraftDecision;
  note: string;
};

export type TeacherReviewDraftRecord = {
  id: string;
  errorType: "visual_teacher_review_draft";
  userFeedback: string;
  extractedRule: RuleRecord;
  beforeOutput: {
    mode: "visual_learning_review_only";
    accepted: false;
    packagingGated: true;
    itemCount: number;
  };
  afterOutput: {
    decisionCounts: Record<TeacherReviewDraftDecision, number>;
    followUpItems: Array<{
      id: string;
      label: string;
      decision: TeacherReviewDraftDecision;
      note: string;
    }>;
    followUpDraft: string;
    ruleEnabled: false;
    accepted: false;
    packagingGated: true;
  };
  learningTrace: LearningExtractionStep[];
  createdAt: string;
};

const decisionLabels: Record<TeacherReviewDraftDecision, string> = {
  unreviewed: "未标注",
  tentative_pass: "暂定通过",
  needs_change: "需要修改",
  unsure: "不确定"
};

export function buildTeacherReviewDraft(args: {
  apprenticeId: string;
  taskId: string;
  items: TeacherReviewDraftItem[];
  followUpDraft: string;
  createdAt?: string;
}): TeacherReviewDraftRecord {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const counts: Record<TeacherReviewDraftDecision, number> = {
    unreviewed: 0,
    tentative_pass: 0,
    needs_change: 0,
    unsure: 0
  };
  const normalizedItems = args.items.map((item) => ({
    ...item,
    decision: item.decision ?? "unreviewed",
    note: item.note.trim()
  }));

  for (const item of normalizedItems) {
    counts[item.decision] += 1;
  }

  const followUpItems = normalizedItems
    .filter((item) => item.decision === "needs_change" || item.decision === "unsure")
    .map((item) => ({
      id: item.id,
      label: item.label,
      decision: item.decision,
      note: item.note
    }));
  const teacherSummary = [
    `老师审查草稿：暂定通过 ${counts.tentative_pass} 项，需要修改 ${counts.needs_change} 项，不确定 ${counts.unsure} 项，未标注 ${counts.unreviewed} 项。`,
    ...followUpItems.map(
      (item, index) =>
        `${index + 1}. ${decisionLabels[item.decision]}：${item.label}${item.note ? `；老师备注：${item.note}` : ""}`
    )
  ].join("\n");
  const extractedRule: RuleRecord = {
    id: `visual-teacher-review-draft-rule-${Date.parse(createdAt) || Date.now()}`,
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    title: `可视化学习审查草稿：${followUpItems.length} 项需要继续带教`,
    condition: "老师在可视化学习最终审查表中记录了逐项判断。",
    action:
      followUpItems.length > 0
        ? `下一轮优先处理：${followUpItems.map((item) => item.label).join("；")}。`
        : "当前草稿没有标记需要修改或不确定的项目，但仍不代表技术验收通过。",
    source: "manual",
    confidence: 0.72,
    enabled: false,
    createdAt
  };

  return {
    id: `visual-teacher-review-draft-${Date.parse(createdAt) || Date.now()}`,
    errorType: "visual_teacher_review_draft",
    userFeedback: teacherSummary,
    extractedRule,
    beforeOutput: {
      mode: "visual_learning_review_only",
      accepted: false,
      packagingGated: true,
      itemCount: normalizedItems.length
    },
    afterOutput: {
      decisionCounts: counts,
      followUpItems,
      followUpDraft: args.followUpDraft,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true
    },
    learningTrace: [
      {
        id: "teacher-review-read-draft",
        label: "读取老师逐项审查草稿",
        evidence: teacherSummary,
        confidence: 0.91,
        validation: "这只是老师审查意见，不是技术验收结论。",
        needsHumanReview: false
      },
      {
        id: "teacher-review-build-next-teaching-list",
        label: "生成下一轮带教修正清单",
        evidence: args.followUpDraft,
        confidence: 0.84,
        validation: "需要修改和不确定项会进入后续改进清单，暂定通过项不会解锁封装。",
        needsHumanReview: true
      },
      {
        id: "teacher-review-keep-packaging-locked",
        label: "保持封装锁定",
        evidence: "accepted=false，packagingGated=true，mode=visual_learning_review_only。",
        confidence: 1,
        validation: "老师没有明确确认技术合格前，任何审查草稿都不能变成验收或发布动作。",
        needsHumanReview: true
      }
    ],
    createdAt
  };
}
