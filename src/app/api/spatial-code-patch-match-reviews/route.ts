import { NextResponse } from "next/server";
import {
  buildSpatialCodePatchMatchReviewRecord,
  isSpatialTeachingRuleRecord,
  type SpatialCodePatchMatchReviewDecision,
  type SpatialCodePatchMatchReviewInput
} from "@/lib/spatial-teaching";
import { prisma } from "@/server/db/prisma";
import { memoryStore } from "@/server/memory/memory-store";

const matchReviewDecisions = new Set<SpatialCodePatchMatchReviewDecision>([
  "use_as_reference",
  "different_scene",
  "tighten_applicability"
]);

export async function POST(request: Request) {
  const body = (await request.json()) as {
    apprenticeId?: string;
    taskId?: string;
    ruleId?: string;
    match?: SpatialCodePatchMatchReviewInput;
    decision?: SpatialCodePatchMatchReviewDecision;
    teacherNote?: string;
  };

  if (!body.apprenticeId || !body.taskId || !body.ruleId) {
    return NextResponse.json({ error: "apprenticeId, taskId, and ruleId are required." }, { status: 400 });
  }

  if (!body.match?.id || !body.match.replayId || !body.match.planId) {
    return NextResponse.json({ error: "A code patch match payload is required." }, { status: 400 });
  }

  if (!body.decision || !matchReviewDecisions.has(body.decision)) {
    return NextResponse.json({ error: "A valid match review decision is required." }, { status: 400 });
  }

  const teacherNote = body.teacherNote?.trim() ?? "";
  if (teacherNote.length < 6) {
    return NextResponse.json({ error: "teacherNote must explain the match review in at least 6 characters." }, { status: 400 });
  }

  if (body.match.accepted !== false || body.match.packagingGated !== true) {
    return NextResponse.json(
      {
        error: "Match reviews must remain accepted=false and packagingGated=true.",
        accepted: false,
        packagingGated: true,
        mode: "visual_learning_review_only"
      },
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

  const rules = await memoryStore.listRules({
    apprenticeId: body.apprenticeId,
    taskId: body.taskId,
    includeDisabled: true
  });
  const rule = rules.find((item) => item.id === body.ruleId);

  if (!rule || !isSpatialTeachingRuleRecord(rule)) {
    return NextResponse.json({ error: "Spatial code patch memory rule not found." }, { status: 404 });
  }

  const review = buildSpatialCodePatchMatchReviewRecord({
    rule,
    match: body.match,
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
