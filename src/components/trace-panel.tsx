import { AlertTriangle, CheckCircle2, History, ShieldCheck } from "lucide-react";
import type { RuleEvaluationRecord, TraceStepRecord } from "@/lib/types";
import { cn, percent } from "@/lib/utils";
import { Badge, Surface } from "./ui";

function ruleEvaluationFromOutput(output: Record<string, unknown>) {
  return Array.isArray(output.ruleEvaluation) ? (output.ruleEvaluation as RuleEvaluationRecord[]) : [];
}

function decisionLabel(decision: RuleEvaluationRecord["decision"]) {
  const labels: Record<RuleEvaluationRecord["decision"], string> = {
    applied: "已应用",
    not_matched: "未命中",
    disabled: "规则暂停",
    conflicted: "发现冲突",
    counterexample: "反例拦截"
  };

  return labels[decision] ?? decision;
}

function memorySourceLabel(source: RuleEvaluationRecord["memorySource"] | undefined) {
  const labels: Record<string, string> = {
    correction: "来自老师纠错",
    visual_demonstration: "来自视觉示范",
    example: "来自老师示例",
    history: "来自执行历史",
    seed: "来自种子规则"
  };

  return labels[source ?? "correction"] ?? "来自学习记忆";
}

function evidenceLabel(label: string) {
  const labels: Record<string, string> = {
    "Cue match": "线索命中",
    "Counterexample check": "反例检查",
    "Rule source": "规则来源",
    "Condition check": "条件检查",
    "Action considered": "动作候选"
  };

  return labels[label] ?? label;
}

export function TracePanel({ trace }: Readonly<{ trace: TraceStepRecord[] }>) {
  return (
    <Surface className="h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-ink">结构化执行追踪</h2>
          <p className="text-sm text-slate-500">
            只展示可审查证据：步骤、规则、置信度、校验结果和老师审查点，不展示私密思维链。
          </p>
        </div>
        <Badge tone="blue">不暴露私密思维链</Badge>
      </div>
      <div className="space-y-3">
        {trace.map((step, index) => (
          <article key={step.id} className="min-w-0 rounded-lg border border-line bg-mist p-4">
            {(() => {
              const ruleEvaluation = ruleEvaluationFromOutput(step.output);

              return (
                <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500">第 {index + 1} 步</p>
                <h3 className="font-extrabold text-ink">{step.stepName}</h3>
                <p className="mt-1 break-words text-xs font-semibold text-slate-500">流程节点：{step.nodeId}</p>
              </div>
              <Badge tone={step.needsHumanReview ? "amber" : "teal"}>
                {step.needsHumanReview ? "需要老师审查" : `置信度 ${percent(step.confidence)}`}
              </Badge>
            </div>
            <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <div className="min-w-0">
                <dt className="font-bold text-slate-500">本步输入</dt>
                <dd className="mt-1 rounded-md bg-white p-2 text-slate-700 break-words">
                  {JSON.stringify(step.input)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-bold text-slate-500">本步输出</dt>
                <dd className="mt-1 rounded-md bg-white p-2 text-slate-700 break-words">
                  {JSON.stringify(step.output)}
                </dd>
              </div>
            </dl>
            {ruleEvaluation.length > 0 ? (
              <div className="mt-3 rounded-md bg-white p-3 text-sm">
                <p className="text-xs font-bold uppercase text-slate-500">规则决策审查</p>
                <div className="mt-2 space-y-2">
                  {ruleEvaluation.map((evaluation) => (
                    <div key={evaluation.ruleId} className="rounded-md bg-mist p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            evaluation.decision === "applied"
                              ? "teal"
                              : evaluation.decision === "disabled" ||
                                  evaluation.decision === "conflicted" ||
                                  evaluation.decision === "counterexample"
                                ? "amber"
                                : "neutral"
                          }
                        >
                          {decisionLabel(evaluation.decision)}
                        </Badge>
                        <p className="font-bold text-ink">{evaluation.title}</p>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{evaluation.reason}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge tone={evaluation.memorySource === "visual_demonstration" ? "blue" : "neutral"}>
                          {memorySourceLabel(evaluation.memorySource)}
                        </Badge>
                        <Badge tone="neutral">规则置信度 {percent(evaluation.ruleConfidence ?? 0.7)}</Badge>
                      </div>
                      {evaluation.matchedCues.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {evaluation.matchedCues.map((cue) => (
                            <Badge key={cue} tone="blue">{cue}</Badge>
                          ))}
                        </div>
                      ) : null}
                      {(evaluation.counterCues ?? []).length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(evaluation.counterCues ?? []).map((cue) => (
                            <Badge key={cue} tone="amber">反例：{cue}</Badge>
                          ))}
                        </div>
                      ) : null}
                      {(evaluation.evidencePath ?? []).length > 0 ? (
                        <div className="mt-3 grid gap-2">
                          {(evaluation.evidencePath ?? []).map((item) => (
                            <div
                              key={`${evaluation.ruleId}-${item.label}`}
                              className={cn(
                                "rounded-md border p-2",
                                item.label === "Cue match" && evaluation.decision === "applied"
                                  ? "border-teal-100 bg-teal-50 text-teal-950"
                                  : item.label === "Counterexample check" && evaluation.decision === "conflicted"
                                    ? "border-amber-100 bg-amber-50 text-amber-950"
                                  : "border-line bg-white text-slate-700"
                              )}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-bold uppercase text-slate-500">{evidenceLabel(item.label)}</p>
                                <Badge tone="neutral">置信度 {percent(item.confidence)}</Badge>
                              </div>
                              <p className="mt-1 text-xs leading-5">{item.evidence}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex max-w-full items-center gap-1 break-words rounded-md bg-white px-2 py-1 text-slate-600">
                <ShieldCheck className="size-3" />
                校验：{step.validation}
              </span>
              {step.appliedRules.map((rule) => (
                <span key={rule.id} className="inline-flex max-w-full items-center gap-1 break-words rounded-md bg-teal-50 px-2 py-1 text-teal-700">
                  <History className="size-3" />
                  已用记忆：{rule.title}
                </span>
              ))}
              {step.uncertainty.map((item) => (
                <span key={item} className="inline-flex max-w-full items-center gap-1 break-words rounded-md bg-amber-50 px-2 py-1 text-amber-700">
                  <AlertTriangle className="size-3" />
                  不确定：{item}
                </span>
              ))}
              {!step.needsHumanReview && step.uncertainty.length === 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">
                  <CheckCircle2 className="size-3" />
                  审查门槛通过
                </span>
              ) : null}
            </div>
            {step.needsHumanReview || step.uncertainty.length > 0 ? (
              <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                <p className="font-extrabold">老师可在这里纠正</p>
                <p className="mt-1">
                  请检查本步输入、输出、命中的规则和不确定项。如果这一步理解错了，下一轮纠错应该明确“适用条件、正确动作、是否允许自动复用”。
                </p>
              </div>
            ) : null}
                </>
              );
            })()}
          </article>
        ))}
      </div>
    </Surface>
  );
}
