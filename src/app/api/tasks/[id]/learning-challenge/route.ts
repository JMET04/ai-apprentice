import { NextResponse } from "next/server";
import type { WorkflowNodeDefinition } from "@/lib/types";
import { memoryStore } from "@/server/memory/memory-store";
import { buildLearningChallengeProbe } from "@/server/qualification/learning-challenge";

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { input?: string; expectedLighting?: string; expectedReview?: boolean };
  const task = await memoryStore.getTaskProfile(id);
  const input = body.input?.trim() ?? "";

  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  if (input.length < 10) {
    return NextResponse.json({ error: "Challenge input must be at least 10 characters." }, { status: 400 });
  }

  const rules = await memoryStore.listRules({
    apprenticeId: task.apprenticeId,
    taskId: task.id,
    includeDisabled: true
  });
  const workflowNodes = parseJson<WorkflowNodeDefinition[]>(task.workflows[0]?.nodes, []);

  return NextResponse.json(
    buildLearningChallengeProbe({
      input,
      expectedLighting: body.expectedLighting,
      expectedReview: typeof body.expectedReview === "boolean" ? body.expectedReview : null,
      taskId: task.id,
      apprenticeId: task.apprenticeId,
      workflowNodes,
      rules
    })
  );
}
