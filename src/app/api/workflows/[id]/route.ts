import { NextResponse } from "next/server";
import type { WorkflowEdgeDefinition, WorkflowNodeDefinition } from "@/lib/types";
import { memoryStore } from "@/server/memory/memory-store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    nodes?: WorkflowNodeDefinition[];
    edges?: WorkflowEdgeDefinition[];
  };

  if (!body.nodes?.length) {
    return NextResponse.json({ error: "At least one workflow node is required." }, { status: 400 });
  }

  const workflow = await memoryStore.saveWorkflowVersion({
    workflowId: id,
    nodes: body.nodes,
    edges: body.edges ?? []
  });

  return NextResponse.json({
    id: workflow.id,
    version: workflow.version,
    savedAt: workflow.updatedAt
  });
}
