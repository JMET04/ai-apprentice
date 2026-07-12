import { NextResponse } from "next/server";
import type { SpatialFitCandidate, SpatialTeachingRehearsal } from "@/lib/spatial-teaching";
import {
  buildSpatialTeachingMemoryDraft,
  buildSpatialTeachingMemoryDraftFromCode,
  isSpatialTeachingRuleRecord
} from "@/lib/spatial-teaching";
import { memoryStore } from "@/server/memory/memory-store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    apprenticeId?: string;
    taskId?: string;
    teachingCode?: string;
    selectedCandidateId?: string;
    candidate?: SpatialFitCandidate;
    rehearsal?: SpatialTeachingRehearsal;
  };

  if (!body.apprenticeId || !body.taskId) {
    return NextResponse.json({ error: "apprenticeId and taskId are required." }, { status: 400 });
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

  if (body.teachingCode && body.selectedCandidateId) {
    const trustedDraft = buildSpatialTeachingMemoryDraftFromCode({
      apprenticeId: body.apprenticeId,
      taskId: body.taskId,
      teachingCode: body.teachingCode,
      selectedCandidateId: body.selectedCandidateId,
      existingRules: existingRules.filter(isSpatialTeachingRuleRecord)
    });

    if (!trustedDraft.ok) {
      return NextResponse.json(
        {
          error: trustedDraft.error,
          evidence: trustedDraft.evidence,
          accepted: trustedDraft.accepted,
          packagingGated: trustedDraft.packagingGated,
          reviewOnly: true
        },
        { status: 400 }
      );
    }

    await memoryStore.saveRule(trustedDraft.draft.rule);

    return NextResponse.json({
      ...trustedDraft.draft,
      selectedCandidate: trustedDraft.candidate,
      selectedRehearsal: trustedDraft.rehearsal,
      serverRecomputedCandidates: trustedDraft.model.candidates.length,
      evidence: trustedDraft.evidence,
      reviewOnly: true
    });
  }

  if (!body.candidate || !body.rehearsal) {
    return NextResponse.json({ error: "candidate and rehearsal are required." }, { status: 400 });
  }

  if (body.candidate.id !== body.rehearsal.selectedCandidateId) {
    return NextResponse.json({ error: "Selected candidate does not match the rehearsal." }, { status: 400 });
  }

  const draft = buildSpatialTeachingMemoryDraft({
    apprenticeId: body.apprenticeId,
    taskId: body.taskId,
    candidate: body.candidate,
    rehearsal: body.rehearsal,
    existingRules: existingRules.filter(isSpatialTeachingRuleRecord)
  });

  await memoryStore.saveRule(draft.rule);

  return NextResponse.json({
    ...draft,
    reviewOnly: true
  });
}
