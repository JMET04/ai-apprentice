import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HistoryLessonControl } from "@/components/history-lesson-control";
import { TracePanel } from "@/components/trace-panel";
import { Badge, Surface } from "@/components/ui";
import type {
  ExecutionOutput,
  RuleEvaluationRecord,
  RuleRecord,
  TraceStepRecord,
  VisualDemonstrationArtifact,
  WorkflowNodeDefinition
} from "@/lib/types";
import { memoryStore } from "@/server/memory/memory-store";
import { traceStore } from "@/server/traces/trace-store";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type RuleProvenance =
  | {
      type: "Correction";
      label: string;
      detail: string;
      createdAt: string;
    }
  | {
      type: "Example";
      label: string;
      detail: string;
      createdAt: string;
    }
  | {
      type: "Visual demonstration";
      label: string;
      detail: string;
      createdAt: string;
    };

function ruleIdFromJson(value: string | null) {
  if (!value) {
    return null;
  }

  return parseJson<Pick<RuleRecord, "id"> | null>(value, null)?.id ?? null;
}

function ruleEvaluationFromOutput(output: Record<string, unknown>) {
  return Array.isArray(output.ruleEvaluation) ? (output.ruleEvaluation as RuleEvaluationRecord[]) : [];
}

function runStatusLabel(status: string) {
  const labels: Record<string, string> = {
    completed: "已完成",
    needs_review: "需要老师审查",
    failed: "失败"
  };
  return labels[status] ?? status.replace("_", " ");
}

function provenanceTypeLabel(type: RuleProvenance["type"]) {
  const labels: Record<RuleProvenance["type"], string> = {
    Correction: "老师纠正",
    Example: "老师示例",
    "Visual demonstration": "视觉示范"
  };
  return labels[type];
}

export default async function RunReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await memoryStore.getRunProfile(id);

  if (!run) {
    notFound();
  }

  const input = parseJson<{ rawTravelNote?: string }>(run.input, {});
  const output = parseJson<ExecutionOutput | null>(run.output, null);
  const trace = parseJson<TraceStepRecord[]>(run.trace, []);
  const workflowNodes = parseJson<WorkflowNodeDefinition[]>(run.task.workflows[0]?.nodes ?? "[]", []);
  const workflowNodeById = new Map(workflowNodes.map((node) => [node.id, node]));
  const appliedRules = Array.from(
    new Map(trace.flatMap((step) => step.appliedRules.map((rule) => [rule.id, rule]))).values()
  );
  const provenanceByRule = new Map<string, RuleProvenance[]>();

  for (const correction of run.task.corrections) {
    const ruleId = ruleIdFromJson(correction.extractedRule);
    if (!ruleId) {
      continue;
    }

    const items = provenanceByRule.get(ruleId) ?? [];
    items.push({
      type: "Correction",
      label: correction.errorType,
      detail: correction.userFeedback,
      createdAt: correction.createdAt
    });
    provenanceByRule.set(ruleId, items);
  }

  for (const example of run.task.examples) {
    const ruleId = ruleIdFromJson(example.extractedRule);
    if (!ruleId) {
      continue;
    }

    const items = provenanceByRule.get(ruleId) ?? [];
    items.push({
      type: "Example",
      label: "Teacher example",
      detail: example.input,
      createdAt: example.createdAt
    });
    provenanceByRule.set(ruleId, items);
  }

  for (const demo of run.task.visualDemos) {
    const ruleId = ruleIdFromJson(demo.extractedRule);
    if (!ruleId) {
      continue;
    }

    const artifact = parseJson<VisualDemonstrationArtifact>(demo.artifact, {
      referenceImageUrl: undefined,
      sceneDescription: demo.teacherNotes,
      visualCues: [],
      lightingSignals: [],
      expectedPhotographyAdvice: []
    });
    const items = provenanceByRule.get(ruleId) ?? [];
    items.push({
      type: "Visual demonstration",
      label: demo.title,
      detail: artifact.sceneDescription,
      createdAt: demo.createdAt
    });
    provenanceByRule.set(ruleId, items);
  }

  const reviewPoints = trace.filter((step) => step.needsHumanReview).length;
  const traceSummary = traceStore.summarize(trace);
  const traceRowsWithValidation = run.traceSteps.filter((step) => step.validation.trim().length > 0).length;
  const traceRowsWithUncertainty = run.traceSteps.filter((step) => {
    const uncertainty = parseJson<string[]>(step.uncertainty, []);
    return Array.isArray(uncertainty);
  }).length;
  const workflowTraceMap = trace.map((step) => {
    const node = workflowNodeById.get(step.nodeId);
    const ruleEvaluation = ruleEvaluationFromOutput(step.output);

    return {
      step,
      node,
      appliedRuleCount: step.appliedRules.length,
      ruleCheckCount: ruleEvaluation.length,
      unmatchedRuleCount: ruleEvaluation.filter((evaluation) => evaluation.decision === "not_matched").length
    };
  });

  return (
    <AppShell>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[420px_1fr]">
        <div className="min-w-0 space-y-5">
          <Surface>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge tone={run.status === "needs_review" ? "amber" : "teal"}>{runStatusLabel(run.status)}</Badge>
                <h2 className="mt-4 text-2xl font-black text-ink">执行回放</h2>
                <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                  这是 {new Date(run.createdAt).toLocaleString()} 保存的一次运行，只用公开 trace 证据回放。
                </p>
              </div>
              <Link href={`/tasks/${run.taskId}`} className="rounded-md bg-ink px-3 py-2 text-xs font-bold text-white">
                返回任务
              </Link>
            </div>

            <dl className="mt-5 grid gap-3 text-sm">
              <div className="rounded-md bg-mist p-3">
                <dt className="font-bold text-slate-500">学徒</dt>
                <dd className="mt-1 break-words text-ink">{run.apprentice.name}</dd>
              </div>
              <div className="rounded-md bg-mist p-3">
                <dt className="font-bold text-slate-500">任务</dt>
                <dd className="mt-1 break-words text-ink">{run.task.name}</dd>
              </div>
              <div className="rounded-md bg-mist p-3">
                <dt className="font-bold text-slate-500">流程版本</dt>
                <dd className="mt-1 text-ink">{run.task.workflows[0]?.version ?? "未知"}</dd>
              </div>
              <div className="rounded-md bg-mist p-3">
                <dt className="font-bold text-slate-500">审查点</dt>
                <dd className="mt-1 text-ink">{reviewPoints}</dd>
              </div>
            </dl>
          </Surface>

          <Surface>
            <h3 className="font-extrabold text-ink">Trace 审计摘要</h3>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-mist p-3">
                <dt className="font-bold text-slate-500">步骤</dt>
                <dd className="mt-1 text-ink">{traceSummary.steps}</dd>
              </div>
              <div className="rounded-md bg-mist p-3">
                <dt className="font-bold text-slate-500">规则检查</dt>
                <dd className="mt-1 text-ink">{traceSummary.ruleEvaluations}</dd>
              </div>
              <div className="rounded-md bg-mist p-3">
                <dt className="font-bold text-slate-500">未匹配</dt>
                <dd className="mt-1 text-ink">{traceSummary.unmatchedRules}</dd>
              </div>
              <div className="rounded-md bg-mist p-3">
                <dt className="font-bold text-slate-500">已禁用</dt>
                <dd className="mt-1 text-ink">{traceSummary.disabledRules}</dd>
              </div>
              <div className="rounded-md bg-mist p-3">
                <dt className="font-bold text-slate-500">Trace 行</dt>
                <dd className="mt-1 text-ink">{run.traceSteps.length}</dd>
              </div>
              <div className="rounded-md bg-mist p-3">
                <dt className="font-bold text-slate-500">含验证行</dt>
                <dd className="mt-1 text-ink">{traceRowsWithValidation}</dd>
              </div>
              <div className="rounded-md bg-mist p-3">
                <dt className="font-bold text-slate-500">含不确定性行</dt>
                <dd className="mt-1 text-ink">{traceRowsWithUncertainty}</dd>
              </div>
            </dl>
          </Surface>

          <Surface>
            <HistoryLessonControl runId={run.id} apprenticeId={run.apprenticeId} taskId={run.taskId} />
          </Surface>

          <Surface>
            <h3 className="font-extrabold text-ink">流程 Trace 地图</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              这次运行如何穿过可视化带教流程。
            </p>
            <div className="mt-3 space-y-2">
              {workflowTraceMap.map(({ step, node, appliedRuleCount, ruleCheckCount, unmatchedRuleCount }, index) => (
                <article key={step.id} className="rounded-md border border-line bg-mist p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">步骤 {index + 1}</p>
                      <p className="font-extrabold text-ink">{node?.label ?? step.stepName}</p>
                      <p className="mt-1 break-words text-xs font-semibold text-slate-500">
                        {node?.type ?? "trace"} · {step.nodeId}
                      </p>
                    </div>
                    <Badge tone={step.needsHumanReview ? "amber" : "teal"}>
                      {step.needsHumanReview ? "需审查" : "已通过"}
                    </Badge>
                  </div>
                  {node ? <p className="mt-2 leading-6 text-slate-700">{node.description}</p> : null}
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md bg-white p-2">
                      <dt className="font-bold text-slate-500">使用规则</dt>
                      <dd className="mt-1 text-ink">{appliedRuleCount}</dd>
                    </div>
                    <div className="rounded-md bg-white p-2">
                      <dt className="font-bold text-slate-500">检查</dt>
                      <dd className="mt-1 text-ink">{ruleCheckCount}</dd>
                    </div>
                    <div className="rounded-md bg-white p-2">
                      <dt className="font-bold text-slate-500">未匹配</dt>
                      <dd className="mt-1 text-ink">{unmatchedRuleCount}</dd>
                    </div>
                  </dl>
                  {node?.validationRules.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {node.validationRules.slice(0, 2).map((rule) => (
                        <Badge key={rule}>{rule}</Badge>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </Surface>

          <Surface>
            <h3 className="font-extrabold text-ink">运行输入</h3>
            <p className="mt-3 break-words rounded-md bg-mist p-3 text-sm leading-6 text-slate-700">
              {input.rawTravelNote ?? run.input}
            </p>
          </Surface>

          <Surface>
            <h3 className="font-extrabold text-ink">运行输出</h3>
            {output ? (
              <dl className="mt-3 space-y-2 text-sm">
                {Object.entries(output).map(([key, value]) => (
                  <div key={key} className="rounded-md bg-mist p-3">
                    <dt className="font-bold text-slate-500">{key}</dt>
                    <dd className="mt-1 break-words text-slate-800">
                      {Array.isArray(value) ? value.join(" / ") : value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 rounded-md bg-mist p-3 text-sm text-slate-600">没有保存输出载荷。</p>
            )}
          </Surface>

          <Surface>
            <h3 className="font-extrabold text-ink">已使用记忆</h3>
            {appliedRules.length > 0 ? (
              <div className="mt-3 space-y-2">
                {appliedRules.map((rule) => (
                  <article key={rule.id} className="rounded-md bg-teal-50 p-3 text-sm text-teal-950">
                    <p className="font-bold">{rule.title}</p>
                    <p className="mt-1">
                      <strong>条件：</strong> {rule.condition}
                    </p>
                    <p className="mt-1">
                      <strong>动作：</strong> {rule.action}
                    </p>
                    <div className="mt-3 rounded-md bg-white p-3">
                      <p className="text-xs font-bold uppercase text-teal-700">学自</p>
                      {(provenanceByRule.get(rule.id) ?? []).length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {(provenanceByRule.get(rule.id) ?? []).map((source) => (
                            <div key={`${source.type}-${source.createdAt}`} className="rounded-md bg-teal-50 p-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={source.type === "Visual demonstration" ? "blue" : "teal"}>
                                  {provenanceTypeLabel(source.type)}
                                </Badge>
                                <span className="text-xs text-teal-700">
                                  {new Date(source.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="mt-1 font-bold">{source.label}</p>
                              <p className="mt-1 break-words leading-6">{source.detail}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-teal-700">
                          这条规则已在本次 trace 中应用，但还没有匹配到已保存的带教来源。
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-md bg-mist p-3 text-sm text-slate-600">本次没有应用已学习记忆。</p>
            )}
          </Surface>

          <Surface>
            <h3 className="font-extrabold text-ink">关联纠正</h3>
            {run.corrections.length > 0 ? (
              <div className="mt-3 space-y-2">
                {run.corrections.map((correction) => (
                  <p key={correction.id} className="rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                    {correction.userFeedback}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-md bg-mist p-3 text-sm text-slate-600">
                本次运行没有关联纠正。
              </p>
            )}
          </Surface>
        </div>

        <TracePanel trace={trace} />
      </div>
    </AppShell>
  );
}
