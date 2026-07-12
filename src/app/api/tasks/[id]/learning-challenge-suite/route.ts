import { NextResponse } from "next/server";
import type { WorkflowNodeDefinition } from "@/lib/types";
import { memoryStore } from "@/server/memory/memory-store";
import { buildLearningChallengeSuite } from "@/server/qualification/learning-challenge";

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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await memoryStore.getTaskProfile(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const rules = await memoryStore.listRules({
    apprenticeId: task.apprenticeId,
    taskId: task.id,
    includeDisabled: true
  });
  const workflowNodes = parseJson<WorkflowNodeDefinition[]>(task.workflows[0]?.nodes, []);

  return NextResponse.json(
    buildLearningChallengeSuite({
      taskId: task.id,
      apprenticeId: task.apprenticeId,
      workflowNodes,
      rules
    })
  );
}
