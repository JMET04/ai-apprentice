import Link from "next/link";
import { CheckCircle2, CircleAlert, Route } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function nodeTypeLabel(type: string) {
  const labels: Record<string, string> = {
    input: "输入",
    understand: "理解",
    decision: "判断",
    execute: "执行",
    check: "检查",
    human_review: "老师确认",
    output: "输出"
  };

  return labels[type] ?? type;
}

export function WorkflowTraceAlignmentPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const aligned = report.summary.traceAlignedNodes;
  const total = report.summary.traceTotalNodes;
  const complete = total > 0 && aligned === total;
  const replayHref = report.learningDeltas[0]?.appliedRunId
    ? `/runs/${report.learningDeltas[0].appliedRunId}`
    : `/tasks/${report.taskId}/run`;

  return (
    <Surface className="border-blue-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={complete ? "teal" : "amber"}>{aligned}/{total} 个节点已追踪</Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">流程与执行追踪对齐</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            每个可视化流程节点都会对应到最新的结构化执行 trace，方便老师检查置信度、校验结果、应用记忆和审查点。
          </p>
        </div>
        <Link href={replayHref} className="rounded-md bg-ink px-3 py-2 text-xs font-bold text-white">
          打开 trace 回放
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {report.traceAlignment.map((item, index) => {
          const traced = Boolean(item.traceStepId && item.validation);

          return (
            <article
              key={item.nodeId}
              className="min-w-0 rounded-md border border-line bg-mist p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-slate-500">节点 {index + 1}</p>
                  <p className="mt-1 break-words font-extrabold text-ink">{item.nodeLabel}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{nodeTypeLabel(item.nodeType)}</p>
                </div>
                {traced ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-apprentice-teal" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-apprentice-amber" />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={traced ? "teal" : "amber"}>{traced ? "已关联 trace" : "缺少 trace"}</Badge>
                {item.confidence !== null ? (
                  <Badge tone="neutral">{Math.round(item.confidence * 100)}% 置信度</Badge>
                ) : null}
                {item.needsHumanReview ? <Badge tone="amber">老师审查</Badge> : null}
              </div>
              {item.validation ? (
                <p className="mt-3 break-words text-xs leading-5 text-slate-600">{item.validation}</p>
              ) : (
                <p className="mt-3 text-xs leading-5 text-amber-700">这个节点还没有记录校验结果。</p>
              )}
              {item.appliedRuleTitles.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.appliedRuleTitles.map((title) => (
                    <Badge key={title} tone="teal">{title}</Badge>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
        <Route className="mt-0.5 size-4 shrink-0" />
        <p className="leading-6">
          最新报告状态：{report.status}。封装仍由老师验收边界单独锁定。
        </p>
      </div>
    </Surface>
  );
}
