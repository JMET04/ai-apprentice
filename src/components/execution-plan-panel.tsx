import { ClipboardList, ShieldCheck } from "lucide-react";
import type { TraceStepRecord } from "@/lib/types";
import { percent } from "@/lib/utils";
import { Badge, Surface } from "./ui";

function emptyLabel(value: string) {
  return value === "none" ? "无" : value;
}

export function ExecutionPlanPanel({ trace }: Readonly<{ trace: TraceStepRecord[] }>) {
  return (
    <Surface>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Badge tone="blue">AI 生成执行计划</Badge>
          <h2 className="mt-3 font-extrabold text-ink">执行前计划证据</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            这份公开计划来自可视化流程节点。每一步都会列出输入、输出、引用规则、置信度、校验结果和老师审查点，
            但不会暴露模型私有推理。
          </p>
        </div>
        <ClipboardList className="size-5 text-apprentice-blue" />
      </div>

      <div className="grid gap-3">
        {trace.map((step, index) => {
          const isTeacherReviewGate = step.needsHumanReview || step.id === "trace-human" || step.nodeId.includes("human");

          return (
            <article key={step.id} className="rounded-md border border-line bg-mist p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">计划步骤 {index + 1}</Badge>
                  <Badge tone={isTeacherReviewGate ? "amber" : "teal"}>
                    {isTeacherReviewGate ? "老师审查点" : "可自动继续"}
                  </Badge>
                </div>
                <h3 className="mt-2 font-extrabold text-ink">{step.stepName}</h3>
                <p className="mt-1 break-words text-xs font-semibold text-slate-500">
                  流程节点：{step.nodeId}
                </p>
              </div>
              <Badge tone={step.confidence >= 0.82 ? "teal" : "amber"}>{percent(step.confidence)}</Badge>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded-md bg-white p-2">
                <p className="text-xs font-bold uppercase text-slate-500">计划输入</p>
                <p className="mt-1 break-words text-slate-700">
                  {emptyLabel(Object.keys(step.input).length > 0 ? Object.keys(step.input).join(", ") : "none")}
                </p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="text-xs font-bold uppercase text-slate-500">计划输出</p>
                <p className="mt-1 break-words text-slate-700">
                  {emptyLabel(Object.keys(step.output).length > 0 ? Object.keys(step.output).join(", ") : "none")}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex max-w-full items-center gap-1 break-words rounded-md bg-white px-2 py-1 text-xs text-slate-600">
                <ShieldCheck className="size-3" />
                {step.validation}
              </span>
              {step.appliedRules.length > 0 ? (
                step.appliedRules.map((rule) => (
                  <Badge key={rule.id} tone="teal">
                    {rule.title}
                  </Badge>
                ))
              ) : (
                <Badge tone="neutral">未应用记忆</Badge>
              )}
            </div>
          </article>
          );
        })}
      </div>
    </Surface>
  );
}
