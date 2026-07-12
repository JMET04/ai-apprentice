"use client";

import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node
} from "@xyflow/react";
import { Plus, Save, Workflow } from "lucide-react";
import type { NodeKind, WorkflowEdgeDefinition, WorkflowNodeDefinition } from "@/lib/types";
import { Badge, FieldLabel, PrimaryButton, Surface } from "./ui";

const nodeTemplates: Array<{
  type: NodeKind;
  label: string;
  description: string;
  inputFields: string[];
  outputFields: string[];
  validationRules: string[];
  fallbackBehavior: string;
}> = [
  {
    type: "input",
    label: "输入节点",
    description: "收集原始材料，并把老师输入整理成后续节点可读的结构。",
    inputFields: ["rawInput"],
    outputFields: ["normalizedInput"],
    validationRules: ["输入必须包含完成任务所需的上下文。"],
    fallbackBehavior: "请老师补充更清楚的源材料。"
  },
  {
    type: "understand",
    label: "理解节点",
    description: "总结任务目标，并识别需要抽取的字段。",
    inputFields: ["normalizedInput"],
    outputFields: ["fieldCandidates"],
    validationRules: ["必须识别期望输出字段。"],
    fallbackBehavior: "把缺失字段标记为不确定。"
  },
  {
    type: "decision",
    label: "决策节点",
    description: "根据可见证据选择正确规则或分支。",
    inputFields: ["fieldCandidates", "knownRules"],
    outputFields: ["decision", "appliedRules"],
    validationRules: ["决策必须引用可见规则或证据线索。"],
    fallbackBehavior: "走更保守的分支，并请求老师审查。"
  },
  {
    type: "execute",
    label: "执行节点",
    description: "结合工作流和记忆生成任务输出。",
    inputFields: ["decision", "fieldCandidates"],
    outputFields: ["draftOutput"],
    validationRules: ["输出必须符合期望结构。"],
    fallbackBehavior: "生成部分草稿，并标出缺失字段。"
  },
  {
    type: "check",
    label: "检查节点",
    description: "在展示最终结果前校验输出。",
    inputFields: ["draftOutput"],
    outputFields: ["validationResult", "uncertainty"],
    validationRules: ["列出不确定点和未通过的校验。"],
    fallbackBehavior: "把不确定结果交给老师审查。"
  },
  {
    type: "human_review",
    label: "老师确认",
    description: "当学徒不确定时，在这里暂停并请老师判断。",
    inputFields: ["uncertainty"],
    outputFields: ["teacherDecision"],
    validationRules: ["只有得到老师确认后才能继续。"],
    fallbackBehavior: "把运行保持为需要审查。"
  },
  {
    type: "output",
    label: "输出节点",
    description: "返回最终结果，并关联可见追踪证据。",
    inputFields: ["draftOutput", "teacherDecision"],
    outputFields: ["finalOutput"],
    validationRules: ["最终输出必须能回溯到可见追踪证据。"],
    fallbackBehavior: "返回带审查提示的草稿。"
  }
];

function nodeTypeLabel(type: NodeKind | string) {
  const labels: Record<string, string> = {
    input: "输入",
    understand: "理解",
    decision: "决策",
    execute: "执行",
    check: "检查",
    human_review: "老师确认",
    output: "输出"
  };

  return labels[type] ?? type.replace("_", " ");
}

const legacyNodeLabels: Record<string, Partial<WorkflowNodeDefinition>> = {
  "Receive travel note": {
    label: "接收旅行笔记",
    description: "老师提供原始旅行笔记和上下文。",
    validationRules: ["输入至少需要包含一句完整描述。"],
    fallbackBehavior: "请老师补充更清楚的笔记。"
  },
  "Understand intent": {
    label: "理解意图",
    description: "总结任务目标，并抽取候选字段。",
    validationRules: ["必须识别地点、天气和主体候选项。"],
    fallbackBehavior: "把缺失字段标记为不确定。"
  },
  "Detect lighting clues": {
    label: "识别光线线索",
    description: "检查笔记是否包含 sunset、dusk、golden hour 或老师教过的等价线索。",
    validationRules: ["如果出现傍晚类线索，就应用黄金时刻规则。"],
    fallbackBehavior: "使用自然光，并请求老师确认。"
  },
  "Draft journal": {
    label: "生成游记草稿",
    description: "结合工作流和记忆生成结构化游记字段。",
    validationRules: ["输出必须包含所有必填字段。"],
    fallbackBehavior: "生成部分草稿，并显示缺失字段。"
  },
  "Self-check format": {
    label: "自检格式",
    description: "校验格式，并列出不确定字段。",
    validationRules: ["所有期望字段都要存在。", "置信度低于 0.82 时需要老师审查。"],
    fallbackBehavior: "把具体字段标记出来，交给老师审查。"
  },
  "Teacher review": {
    label: "老师审查",
    description: "请老师确认不确定行为或纠正后的行为。",
    validationRules: ["老师批准后，纠错应保存为规则。"],
    fallbackBehavior: "最终输出前先暂停。"
  },
  "Publish structured journal": {
    label: "发布结构化游记",
    description: "返回最终结构化输出，并关联追踪证据。",
    validationRules: ["追踪必须引用已应用规则和置信度。"],
    fallbackBehavior: "返回带审查提示的草稿。"
  }
};

function localizeWorkflowNode(node: WorkflowNodeDefinition): WorkflowNodeDefinition {
  const legacy = legacyNodeLabels[node.label];

  return legacy ? { ...node, ...legacy } : node;
}

function toFlowNode(node: WorkflowNodeDefinition): Node {
  return {
    id: node.id,
    type: "default",
    position: node.position,
    data: {
      label: (
        <div className="min-w-44 p-2">
          <p className="text-[10px] font-bold uppercase text-apprentice-teal">{nodeTypeLabel(node.type)}</p>
          <p className="text-sm font-extrabold text-ink">{node.label}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{node.description}</p>
        </div>
      )
    }
  };
}

function toFlowEdge(edge: WorkflowEdgeDefinition): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: true
  };
}

function listToText(items: string[]) {
  return items.join("\n");
}

function textToList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function WorkflowEditor({
  workflowId,
  workflowName,
  version,
  initialNodes,
  initialEdges
}: Readonly<{
  workflowId: string;
  workflowName: string;
  version: number;
  initialNodes: WorkflowNodeDefinition[];
  initialEdges: WorkflowEdgeDefinition[];
}>) {
  const localizedInitialNodes = useMemo(() => initialNodes.map(localizeWorkflowNode), [initialNodes]);
  const [nodes, setNodes, onNodesChange] = useNodesState(localizedInitialNodes.map(toFlowNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges.map(toFlowEdge));
  const [nodeDetails, setNodeDetails] = useState(localizedInitialNodes);
  const [selectedId, setSelectedId] = useState(localizedInitialNodes[0]?.id);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState(version);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedNode = useMemo(
    () => nodeDetails.find((node) => node.id === selectedId) ?? nodeDetails[0],
    [nodeDetails, selectedId]
  );

  function onConnect(connection: Connection) {
    setEdges((currentEdges) => addEdge({ ...connection, animated: true }, currentEdges));
  }

  function addTeachingNode(type: NodeKind) {
    const template = nodeTemplates.find((item) => item.type === type) ?? nodeTemplates[0];
    const id = `node-${type}-${Date.now()}`;
    const nextNode: WorkflowNodeDefinition = {
      id,
      type: template.type,
      label: template.label,
      description: template.description,
      inputFields: template.inputFields,
      outputFields: template.outputFields,
      validationRules: template.validationRules,
      fallbackBehavior: template.fallbackBehavior,
      position: { x: 120 + (nodes.length % 4) * 180, y: 140 + Math.floor(nodes.length / 4) * 150 }
    };
    setNodeDetails((current) => [...current, nextNode]);
    setNodes((current) => [...current, toFlowNode(nextNode)]);
    setSelectedId(id);
  }

  function updateSelected(field: "label" | "description" | "fallbackBehavior", value: string) {
    if (!selectedNode) {
      return;
    }

    setNodeDetails((current) =>
      current.map((node) => (node.id === selectedNode.id ? { ...node, [field]: value } : node))
    );
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id
          ? toFlowNode({ ...selectedNode, [field]: value } as WorkflowNodeDefinition)
          : node
      )
    );
  }

  function updateSelectedList(field: "inputFields" | "outputFields" | "validationRules", value: string) {
    if (!selectedNode) {
      return;
    }

    const nextValue = textToList(value);
    setNodeDetails((current) =>
      current.map((node) => (node.id === selectedNode.id ? { ...node, [field]: nextValue } : node))
    );
  }

  async function saveWorkflowVersion() {
    setIsSaving(true);
    setSaveError(null);

    const nodePositions = new Map(nodes.map((node) => [node.id, node.position]));
    const nodesToSave = nodeDetails.map((node) => ({
      ...node,
      position: nodePositions.get(node.id) ?? node.position
    }));
    const edgesToSave: WorkflowEdgeDefinition[] = edges
      .filter((edge) => edge.source && edge.target)
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target
      }));

    const response = await fetch(`/api/workflows/${workflowId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nodes: nodesToSave,
        edges: edgesToSave
      })
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setSaveError(payload.error ?? "无法保存可视化带教流程。");
      setIsSaving(false);
      return;
    }

    const payload = (await response.json()) as { version: number; savedAt: string };
    setSavedVersion(payload.version);
    setSavedAt(new Date(payload.savedAt).toLocaleTimeString());
    setIsSaving(false);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Surface className="min-h-[620px] p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 place-items-center rounded-md bg-blue-50 text-apprentice-blue">
              <Workflow className="size-4" />
            </span>
            <div>
              <h2 className="font-extrabold text-ink">{workflowName}</h2>
              <p className="text-sm text-slate-500">
                可视化带教流程版本 {savedVersion}。拖动节点把手即可连接步骤，形成老师可审查的执行路径。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {nodeTemplates.map((template) => (
              <button
                key={template.type}
                className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-apprentice-blue/40 hover:text-apprentice-blue"
                onClick={() => addTeachingNode(template.type)}
                title={`添加${nodeTypeLabel(template.type)}节点`}
              >
                <Plus className="size-4" />
                {nodeTypeLabel(template.type)}
              </button>
            ))}
            <PrimaryButton onClick={saveWorkflowVersion} disabled={isSaving}>
              <Save className="mr-2 size-4" />
              {isSaving ? "正在保存..." : "保存版本"}
            </PrimaryButton>
          </div>
        </div>
        <div className="h-[540px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            fitView
            fitViewOptions={{ padding: 0.16, maxZoom: 1.25 }}
          >
            <Background />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>
      </Surface>

      <div className="space-y-5">
        <Surface>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <Badge tone="blue">添加带教节点</Badge>
              <h2 className="mt-2 font-extrabold text-ink">节点带教卡</h2>
            </div>
            <Badge tone="teal">可编辑</Badge>
          </div>
        {selectedNode ? (
          <div className="space-y-4">
            <div>
              <FieldLabel>节点名称</FieldLabel>
              <input
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
                value={selectedNode.label}
                onChange={(event) => updateSelected("label", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel>节点类型</FieldLabel>
              <input className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm" value={nodeTypeLabel(selectedNode.type)} readOnly />
            </div>
            <div>
              <FieldLabel>带教指令</FieldLabel>
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-line px-3 py-2 text-sm"
                value={selectedNode.description}
                onChange={(event) => updateSelected("description", event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>输入字段</FieldLabel>
                <textarea
                  className="mt-1 min-h-20 w-full rounded-md border border-line px-3 py-2 text-sm"
                  value={listToText(selectedNode.inputFields)}
                  onChange={(event) => updateSelectedList("inputFields", event.target.value)}
                />
              </div>
              <div>
                <FieldLabel>输出字段</FieldLabel>
                <textarea
                  className="mt-1 min-h-20 w-full rounded-md border border-line px-3 py-2 text-sm"
                  value={listToText(selectedNode.outputFields)}
                  onChange={(event) => updateSelectedList("outputFields", event.target.value)}
                />
              </div>
            </div>
            <div>
              <FieldLabel>校验规则</FieldLabel>
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-line px-3 py-2 text-sm"
                value={listToText(selectedNode.validationRules)}
                onChange={(event) => updateSelectedList("validationRules", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel>不确定时怎么处理</FieldLabel>
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                value={selectedNode.fallbackBehavior}
                onChange={(event) => updateSelected("fallbackBehavior", event.target.value)}
              />
            </div>
            {savedAt ? (
              <p className="rounded-md bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700">
                已在 {savedAt} 保存版本 {savedVersion}
              </p>
            ) : null}
            {saveError ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{saveError}</p>
            ) : null}
          </div>
        ) : null}
        </Surface>

        <Surface>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Badge tone="teal">连接审计</Badge>
              <h2 className="mt-2 font-extrabold text-ink">带教路径</h2>
            </div>
            <Badge tone="neutral">{edges.length} 条连接</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            每条连接都会保存为工作流结构，后续执行追踪会按这些节点对齐，方便老师逐步纠正。
          </p>
          <div className="mt-4 space-y-2">
            {edges.length > 0 ? (
              edges.map((edge) => {
                const source = nodeDetails.find((node) => node.id === edge.source);
                const target = nodeDetails.find((node) => node.id === edge.target);

                return (
                  <div key={edge.id} className="rounded-md border border-line bg-mist p-3 text-sm">
                    <p className="font-bold text-ink">
                      {source?.label ?? edge.source} {"->"} {target?.label ?? edge.target}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {nodeTypeLabel(source?.type ?? "unknown")} 到 {nodeTypeLabel(target?.type ?? "unknown")}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="rounded-md bg-mist p-3 text-sm text-slate-600">
                还没有连接。拖动节点把手来教 AI 下一步应该走到哪里。
              </p>
            )}
          </div>
        </Surface>
      </div>
    </div>
  );
}
