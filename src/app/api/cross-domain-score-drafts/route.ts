import { NextResponse } from "next/server";
import {
  buildCrossDomainTeacherScoreDraft,
  crossDomainTeacherScoreDecisions,
  type CrossDomainTeacherScoreDecision,
  type CrossDomainTeacherScoreDraftItem
} from "@/lib/cross-domain-score-draft";
import { prisma } from "@/server/db/prisma";
import { memoryStore } from "@/server/memory/memory-store";

const domains = new Set<CrossDomainTeacherScoreDraftItem["domain"]>([
  "photography_journal",
  "spatial_engineering",
  "human_knowledge"
]);

function normalizeDecision(value: unknown): CrossDomainTeacherScoreDecision {
  return typeof value === "string" && crossDomainTeacherScoreDecisions.includes(value as CrossDomainTeacherScoreDecision)
    ? (value as CrossDomainTeacherScoreDecision)
    : "hold";
}

function normalizeScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

function normalizeDomain(value: unknown): CrossDomainTeacherScoreDraftItem["domain"] {
  return typeof value === "string" && domains.has(value as CrossDomainTeacherScoreDraftItem["domain"])
    ? (value as CrossDomainTeacherScoreDraftItem["domain"])
    : "human_knowledge";
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    apprenticeId?: string;
    taskId?: string;
    items?: Array<Partial<CrossDomainTeacherScoreDraftItem>>;
    followUpDraft?: string;
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
    caseId: item.caseId?.trim() || `cross-domain-case-${index + 1}`,
    apprenticeId: item.apprenticeId?.trim() || apprenticeId,
    domain: normalizeDomain(item.domain),
    score: normalizeScore(item.score),
    decision: normalizeDecision(item.decision),
    note: item.note?.trim() || "",
    followUpQuestion: item.followUpQuestion?.trim() || ""
  }));
  const draft = buildCrossDomainTeacherScoreDraft({
    apprenticeId,
    taskId,
    items,
    followUpDraft: body.followUpDraft?.trim() || ""
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
