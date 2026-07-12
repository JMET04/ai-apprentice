import { NextResponse } from "next/server";
import {
  buildSpatialMemoryTeacherReviewRecord,
  isSpatialTeachingRuleRecord,
  type SpatialMemoryTeacherReviewDecision
} from "@/lib/spatial-teaching";
import { prisma } from "@/server/db/prisma";
import { memoryStore } from "@/server/memory/memory-store";

const reviewDecisions = new Set<SpatialMemoryTeacherReviewDecision>([
  "keep_paused",
  "add_applicability_condition",
  "mark_conflict_reason"
]);

export async function POST(request: Request) {
  const body = (await request.json()) as {
    apprenticeId?: string;
    taskId?: string;
    ruleId?: string;
    decision?: SpatialMemoryTeacherReviewDecision;
    teacherNote?: string;
  };

  if (!body.apprenticeId || !body.taskId || !body.ruleId) {
    return NextResponse.json({ error: "apprenticeId, taskId, and ruleId are required." }, { status: 400 });
  }

  if (!body.decision || !reviewDecisions.has(body.decision)) {
    return NextResponse.json({ error: "A valid review decision is required." }, { status: 400 });
  }

  const teacherNote = body.teacherNote?.trim() ?? "";
  if (teacherNote.length < 6) {
    return NextResponse.json({ error: "teacherNote must explain the teacher review in at least 6 characters." }, { status: 400 });
  }

  const task = await memoryStore.getTaskProfile(body.taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  if (task.apprenticeId !== body.apprenticeId) {
    return NextResponse.json({ error: "Task does not belong to this apprentice." }, { status: 400 });
  }

  const rules = await memoryStore.listRules({
    apprenticeId: body.apprenticeId,
    taskId: body.taskId,
    includeDisabled: true
  });
  const rule = rules.find((item) => item.id === body.ruleId);

  if (!rule || !isSpatialTeachingRuleRecord(rule)) {
    return NextResponse.json({ error: "Spatial teaching memory rule not found." }, { status: 404 });
  }

  if (rule.enabled) {
    return NextResponse.json(
      { error: "Spatial teaching memory reviews only apply to paused rules." },
      { status: 409 }
    );
  }

  const review = buildSpatialMemoryTeacherReviewRecord({
    rule,
    decision: body.decision,
    teacherNote
  });

  await prisma.$transaction([
    prisma.rule.update({
      where: { id: rule.id },
      data: { enabled: false }
    }),
    prisma.correction.create({
      data: {
        id: review.id,
        apprenticeId: body.apprenticeId,
        taskId: body.taskId,
        runId: null,
        userFeedback: review.userFeedback,
        errorType: review.errorType,
        extractedRule: JSON.stringify(review.extractedRule),
        beforeOutput: JSON.stringify(review.beforeOutput),
        afterOutput: JSON.stringify(review.afterOutput),
        learningTrace: JSON.stringify(review.learningTrace),
        createdAt: review.createdAt
      }
    })
  ]);

  return NextResponse.json({
    review,
    ruleEnabled: false,
    accepted: false,
    packagingGated: true,
    mode: "visual_learning_review_only"
  });
}
