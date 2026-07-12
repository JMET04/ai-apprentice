import { NextResponse } from "next/server";
import { buildHumanKnowledgeTeachingDraft, type HumanKnowledgeTeachingInput } from "@/lib/human-knowledge-teaching";
import { prisma } from "@/server/db/prisma";
import { memoryStore } from "@/server/memory/memory-store";

function normalizePriority(value: unknown): HumanKnowledgeTeachingInput["priority"] {
  return value === "high" ? "high" : "normal";
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    apprenticeId?: string;
    taskId?: string;
    title?: string;
    condition?: string;
    action?: string;
    teacherNote?: string;
    priority?: HumanKnowledgeTeachingInput["priority"];
  };

  if (!body.apprenticeId || !body.taskId) {
    return NextResponse.json({ error: "apprenticeId and taskId are required." }, { status: 400 });
  }

  if (!body.title?.trim() || !body.condition?.trim() || !body.action?.trim() || !body.teacherNote?.trim()) {
    return NextResponse.json(
      { error: "title, condition, action, and teacherNote are required." },
      { status: 400 }
    );
  }

  const task = await memoryStore.getTaskProfile(body.taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  if (task.apprenticeId !== body.apprenticeId) {
    return NextResponse.json({ error: "Task does not belong to this apprentice." }, { status: 400 });
  }

  const existingRules = await memoryStore.listRules({
    apprenticeId: body.apprenticeId,
    taskId: body.taskId,
    includeDisabled: true
  });
  const draft = buildHumanKnowledgeTeachingDraft({
    apprenticeId: body.apprenticeId,
    taskId: body.taskId,
    input: {
      title: body.title.trim(),
      condition: body.condition.trim(),
      action: body.action.trim(),
      teacherNote: body.teacherNote.trim(),
      priority: normalizePriority(body.priority)
    },
    existingRules
  });

  await prisma.$transaction([
    prisma.rule.create({
      data: {
        id: draft.rule.id,
        apprenticeId: draft.rule.apprenticeId,
        taskId: draft.rule.taskId,
        title: draft.rule.title,
        condition: draft.rule.condition,
        action: draft.rule.action,
        source: draft.rule.source,
        confidence: draft.rule.confidence,
        enabled: false,
        createdAt: draft.rule.createdAt
      }
    }),
    prisma.correction.create({
      data: {
        id: draft.correctionRecord.id,
        apprenticeId: body.apprenticeId,
        taskId: body.taskId,
        runId: null,
        userFeedback: draft.correctionRecord.userFeedback,
        errorType: draft.correctionRecord.errorType,
        extractedRule: JSON.stringify(draft.correctionRecord.extractedRule),
        beforeOutput: JSON.stringify(draft.correctionRecord.beforeOutput),
        afterOutput: JSON.stringify(draft.correctionRecord.afterOutput),
        learningTrace: JSON.stringify(draft.correctionRecord.learningTrace),
        createdAt: draft.correctionRecord.createdAt
      }
    })
  ]);

  return NextResponse.json({
    ...draft,
    ruleEnabled: false,
    accepted: false,
    packagingGated: true,
    mode: "visual_learning_review_only"
  });
}
