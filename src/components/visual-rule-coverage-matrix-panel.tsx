import { Network } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function statusTone(status: string): "neutral" | "teal" | "amber" | "blue" {
  if (status === "covered") {
    return "teal";
  }

  if (status === "source_only") {
    return "amber";
  }

  return "blue";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    covered: "已覆盖",
    source_only: "仅有来源",
    review_required: "需要审查"
  };
  return labels[status] ?? status.replace("_", " ");
}

function sourceTypeLabel(sourceType: string) {
  const labels: Record<string, string> = {
    Correction: "老师纠正",
    Example: "老师示例",
    "Visual demonstration": "视觉示范",
    "Execution history": "执行历史"
  };
  return labels[sourceType] ?? sourceType;
}

export function VisualRuleCoverageMatrixPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const matrix = report.visualRuleCoverageMatrix;

  return (
    <Surface className="border-teal-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={matrix.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            {report.summary.visualRuleCoverageCovered}/{report.summary.visualRuleCoverageRules} 条规则已覆盖
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化规则覆盖矩阵</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            逐条检查可复用视觉记忆规则的覆盖情况：来源、已应用运行、正向决策、审查边界决策、线索审计链路和仍未证明的线索。
          </p>
        </div>
        <Network className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">仅有来源</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualRuleCoverageSourceOnly}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">正向链路</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualRuleCoveragePositiveLinks}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">审查链路</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualRuleCoverageReviewLinks}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装锁</p>
          <p className="mt-1 text-xl font-black text-ink">{matrix.packagingGated ? "锁定" : "打开"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {matrix.items.map((item) => (
          <article key={item.ruleId} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "已覆盖" : "需要证据"}</Badge>
              <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
              <Badge tone={item.enabled ? "teal" : "neutral"}>{item.enabled ? "已启用" : "已暂停"}</Badge>
            </div>
            <p className="mt-3 break-words font-extrabold text-ink">{item.ruleTitle}</p>
            <p className="mt-1 break-words text-xs font-bold text-slate-500">{item.ruleId}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.sourceTypes.map((sourceType) => (
                <Badge key={`${item.ruleId}-${sourceType}`} tone={sourceType === "Visual demonstration" ? "blue" : "teal"}>
                  {sourceTypeLabel(sourceType)}
                </Badge>
              ))}
            </div>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">行为链路</p>
                <p className="mt-1">正向：{item.positiveDecisionIds.length}</p>
                <p>审查：{item.reviewDecisionIds.length}</p>
                <p>已应用运行：{item.appliedRunIds.length}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">线索覆盖</p>
                <p className="mt-1">已审计线索：{item.cueAuditIds.length}</p>
                <p>未证明线索：{item.unprovenCueIds.length}</p>
                <p>来源：{item.sourceCount}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{item.evidence}</p>
          </article>
        ))}
      </div>
    </Surface>
  );
}
