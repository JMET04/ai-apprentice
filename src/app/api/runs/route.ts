import { NextResponse } from "next/server";
import { demoApprentice, demoTask } from "@/lib/demo-data";
import type { WorkflowNodeDefinition } from "@/lib/types";
import { getAIService } from "@/server/ai/service";
import { memoryStore } from "@/server/memory/memory-store";
import { traceNodeIdsFromWorkflow } from "@/server/workflow/trace-node-map";

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

export async function POST(request: Request) {
  const body = (await request.json()) as { input?: string; taskId?: string; apprenticeId?: string };

  const task = body.taskId ? await memoryStore.getTaskProfile(body.taskId) : null;
  if (body.taskId && !task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const apprenticeId = body.apprenticeId ?? task?.apprenticeId ?? demoApprentice.id;
  const taskId = task?.id ?? body.taskId ?? demoTask.id;

  if (task && task.apprenticeId !== apprenticeId) {
    return NextResponse.json({ error: "Task does not belong to this apprentice." }, { status: 400 });
  }

  const rules = await memoryStore.listRules({
    apprenticeId,
    taskId,
    includeDisabled: true
  });
  const workflowNodes = parseJson<WorkflowNodeDefinition[]>(task?.workflows[0]?.nodes, []);
  const traceNodeIds = traceNodeIdsFromWorkflow(workflowNodes);
  const run = await getAIService().generateExecution(body.input ?? "", { rules, taskId, apprenticeId, traceNodeIds });
  await memoryStore.saveRun(run);
  return NextResponse.json(run);
}
