import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { WorkflowEditor } from "@/components/workflow-editor";
import type { WorkflowEdgeDefinition, WorkflowNodeDefinition } from "@/lib/types";
import { memoryStore } from "@/server/memory/memory-store";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function displayTaskName(value: string) {
  if (value === "Generate a structured photography travel journal from a travel note") {
    return "从旅行笔记生成结构化摄影日志";
  }

  return value;
}

export default async function TeachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await memoryStore.getTaskProfile(id);

  if (!task || !task.workflows[0]) {
    notFound();
  }

  const workflow = task.workflows[0];

  return (
    <AppShell>
      <WorkflowEditor
        workflowId={workflow.id}
        workflowName={`${displayTaskName(task.name)}带教流程`}
        version={workflow.version}
        initialNodes={parseJson<WorkflowNodeDefinition[]>(workflow.nodes, [])}
        initialEdges={parseJson<WorkflowEdgeDefinition[]>(workflow.edges, [])}
      />
    </AppShell>
  );
}
