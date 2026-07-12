import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RunConsole } from "@/components/run-console";
import { executePhotographyJournalTask } from "@/server/workflow/execution-engine";
import { memoryStore } from "@/server/memory/memory-store";
import { traceNodeIdsFromWorkflow } from "@/server/workflow/trace-node-map";
import type { WorkflowNodeDefinition } from "@/lib/types";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await memoryStore.getTaskProfile(id);

  if (!task) {
    notFound();
  }

  const inputSchema = parseJson<{ example?: string }>(task.inputSchema, {});
  const inputExample = inputSchema.example ?? "";
  const rules = await memoryStore.listRules({
    apprenticeId: task.apprenticeId,
    taskId: task.id,
    includeDisabled: true
  });
  const workflowNodes = parseJson<WorkflowNodeDefinition[]>(task.workflows[0]?.nodes ?? "[]", []);
  const initialRun = executePhotographyJournalTask(inputExample, rules, {
    taskId: task.id,
    apprenticeId: task.apprenticeId,
    traceNodeIds: traceNodeIdsFromWorkflow(workflowNodes)
  });

  return (
    <AppShell>
      <RunConsole
        initialRun={initialRun}
        taskId={task.id}
        apprenticeId={task.apprenticeId}
        inputExample={inputExample}
      />
    </AppShell>
  );
}
