import type { TraceNodeIds, WorkflowNodeDefinition } from "@/lib/types";

export function traceNodeIdsFromWorkflow(nodes: WorkflowNodeDefinition[]): TraceNodeIds {
  return nodes.reduce<TraceNodeIds>((ids, node) => {
    if (!ids[node.type]) {
      ids[node.type] = node.id;
    }
    return ids;
  }, {});
}
