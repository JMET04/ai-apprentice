import { NextResponse } from "next/server";
import {
  buildTeacherAcceptanceAgendaDecisionDraft,
  teacherAcceptanceAgendaDecisionValues,
  type TeacherAcceptanceAgendaDecision,
  type TeacherAcceptanceAgendaDecisionDraftItem
} from "@/lib/teacher-acceptance-agenda-draft";
import { prisma } from "@/server/db/prisma";
import { memoryStore } from "@/server/memory/memory-store";

function normalizeDecision(value: unknown): TeacherAcceptanceAgendaDecision {
  return typeof value === "string" &&
    teacherAcceptanceAgendaDecisionValues.includes(value as TeacherAcceptanceAgendaDecision)
    ? (value as TeacherAcceptanceAgendaDecision)
    : "hold";
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    apprenticeId?: string;
    taskId?: string;
    items?: Array<Partial<TeacherAcceptanceAgendaDecisionDraftItem>>;
    nextReviewPlan?: string;
  };

  if (!body.apprenticeId || !body.taskId) {
    return NextResponse.json({ error: "apprenticeId and taskId are required." }, { status: 400 });
  }
  const apprenticeId = body.apprenticeId;
  const taskId = body.taskId;

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items are required." }, { status: 400 });
  }

  const task = await memoryStore.getTaskProfile(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  if (task.apprenticeId !== apprenticeId) {
    return NextResponse.json({ error: "Task does not belong to this apprentice." }, { status: 400 });
  }

  const items = body.items.map((item, index) => ({
    agendaItemId: item.agendaItemId?.trim() || `teacher-acceptance-agenda-item-${index + 1}`,
    label: item.label?.trim() || `Teacher acceptance agenda item ${index + 1}`,
    evidencePath: item.evidencePath?.trim() || "qualification_report.teacherAcceptanceEvidenceAgenda",
    currentReadiness: item.currentReadiness?.trim() || "needs_teacher_answer",
    decision: normalizeDecision(item.decision),
    note: item.note?.trim() || "",
    teacherQuestion: item.teacherQuestion?.trim() || "What should happen next in teacher review?"
  }));
  const draft = buildTeacherAcceptanceAgendaDecisionDraft({
    apprenticeId,
    taskId,
    items,
    nextReviewPlan: body.nextReviewPlan?.trim() || ""
  });

  await prisma.correction.create({
    data: {
      id: draft.id,
      apprenticeId,
      taskId,
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
