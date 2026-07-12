import { NextResponse } from "next/server";
import {
  buildSpatialConstructionCorrectionDraft,
  isSpatialTeachingRuleRecord,
  parseSpatialConstructionCodePatch,
  type SpatialConstructionCorrectionDecision,
  type SpatialConstructionRevisionCodePatch,
  type SpatialConstructionPredictionPlan
} from "@/lib/spatial-teaching";
import { prisma } from "@/server/db/prisma";
import { memoryStore } from "@/server/memory/memory-store";

const correctionDecisions = new Set<SpatialConstructionCorrectionDecision>([
  "revise_anchor_points",
  "revise_construction_order",
  "mark_prediction_conflict"
]);

function normalizeDecision(value: unknown): SpatialConstructionCorrectionDecision {
  return correctionDecisions.has(value as SpatialConstructionCorrectionDecision)
    ? (value as SpatialConstructionCorrectionDecision)
    : "revise_anchor_points";
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    apprenticeId?: string;
    taskId?: string;
    plan?: SpatialConstructionPredictionPlan;
    teacherCorrection?: string;
    decision?: SpatialConstructionCorrectionDecision;
    codePatch?: SpatialConstructionRevisionCodePatch;
  };

  if (!body.apprenticeId || !body.taskId) {
    return NextResponse.json({ error: "apprenticeId and taskId are required." }, { status: 400 });
  }

  if (!body.plan?.id || !body.plan.selectedCandidateId) {
    return NextResponse.json({ error: "construction prediction plan is required." }, { status: 400 });
  }

  if (!body.teacherCorrection?.trim()) {
    return NextResponse.json({ error: "teacherCorrection is required." }, { status: 400 });
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
  const codePatchValidation = body.codePatch
    ? parseSpatialConstructionCodePatch(JSON.stringify(body.codePatch))
    : null;

  if (codePatchValidation && !codePatchValidation.ok) {
    return NextResponse.json(
      {
        error: codePatchValidation.error,
        evidence: codePatchValidation.evidence,
        accepted: false,
        packagingGated: true,
        mode: "visual_learning_review_only"
      },
      { status: 400 }
    );
  }

  const draft = buildSpatialConstructionCorrectionDraft({
    apprenticeId: body.apprenticeId,
    taskId: body.taskId,
    plan: body.plan,
    teacherCorrection: body.teacherCorrection.trim(),
    decision: normalizeDecision(body.decision),
    codePatch: codePatchValidation?.ok ? codePatchValidation.patch : undefined,
    existingRules: existingRules.filter(isSpatialTeachingRuleRecord)
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
    codePatchSaved: Boolean(codePatchValidation?.ok),
    accepted: false,
    packagingGated: true,
    mode: "visual_learning_review_only"
  });
}
