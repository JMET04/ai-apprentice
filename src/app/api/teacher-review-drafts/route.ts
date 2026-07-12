import { NextResponse } from "next/server";
import {
  buildTeacherReviewDraft,
  type TeacherReviewDraftDecision,
  type TeacherReviewDraftItem
} from "@/lib/teacher-review-draft";
import { prisma } from "@/server/db/prisma";
import { memoryStore } from "@/server/memory/memory-store";

function normalizeDecision(value: unknown): TeacherReviewDraftDecision {
  if (value === "tentative_pass" || value === "needs_change" || value === "unsure") {
    return value;
  }

  return "unreviewed";
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    apprenticeId?: string;
    taskId?: string;
    items?: Array<Partial<TeacherReviewDraftItem>>;
    followUpDraft?: string;
  };

  if (!body.apprenticeId || !body.taskId) {
    return NextResponse.json({ error: "apprenticeId and taskId are required." }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items are required." }, { status: 400 });
  }

  const task = await memoryStore.getTaskProfile(body.taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  if (task.apprenticeId !== body.apprenticeId) {
    return NextResponse.json({ error: "Task does not belong to this apprentice." }, { status: 400 });
  }

  const items = body.items.map((item, index) => ({
    id: item.id?.trim() || `teacher-review-item-${index + 1}`,
    label: item.label?.trim() || `审查项 ${index + 1}`,
    question: item.question?.trim() || "老师尚未填写问题。",
    evidence: item.evidence?.trim() || "尚未提供证据。",
    decision: normalizeDecision(item.decision),
    note: item.note?.trim() || ""
  }));
  const draft = buildTeacherReviewDraft({
    apprenticeId: body.apprenticeId,
    taskId: body.taskId,
    items,
    followUpDraft: body.followUpDraft?.trim() || "老师尚未生成下一轮带教修正清单。"
  });

  await prisma.correction.create({
    data: {
      id: draft.id,
      apprenticeId: body.apprenticeId,
      taskId: body.taskId,
      runId: null,
      userFeedback: draft.userFeedback,
      errorType: draft.errorType,
      extractedRule: JSON.stringify(draft.extractedRule),
      beforeOutput: JSON.stringify(draft.beforeOutput),
      afterOutput: JSON.stringify(draft.afterOutput),
      learningTrace: JSON.stringify(draft.learningTrace),
      createdAt: draft.createdAt
    }
  });

  return NextResponse.json({
    draft,
    ruleEnabled: false,
    accepted: false,
    packagingGated: true,
    mode: "visual_learning_review_only"
  });
}
