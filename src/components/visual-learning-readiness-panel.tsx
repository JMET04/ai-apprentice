import { ShieldCheck } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function statusTone(status: string): "neutral" | "teal" | "amber" | "blue" {
  if (status === "proven") {
    return "teal";
  }

  if (status === "locked") {
    return "blue";
  }

  return "amber";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    proven: "已证明",
    locked: "已锁定",
    needs_review: "需要老师审查",
    review_only: "只读审查",
    missing_evidence: "证据不足"
  };

  return labels[status] ?? status.replace("_", " ");
}

export function VisualLearningReadinessPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  return (
    <Surface className="border-apprentice-teal/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={report.summary.visualReadinessPassed === report.summary.visualReadinessTotal ? "teal" : "amber"}>
            准备度 {report.summary.visualReadinessPassed}/{report.summary.visualReadinessTotal}
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化学习准备度评分表</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这是给老师判断“可视化学习技术是否合格”的只读评分表。它用证据证明行为，但不提供确认按钮，
            也不会解锁封装。
          </p>
        </div>
        <ShieldCheck className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {report.visualLearningReadiness.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "已证明" : "需要证据"}</Badge>
              <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.reviewQuestion}</p>
            <p className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">{item.evidence}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.sourceIds.map((sourceId) => (
                <Badge key={`${item.id}-${sourceId}`} tone="neutral">
                  {sourceId}
                </Badge>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
