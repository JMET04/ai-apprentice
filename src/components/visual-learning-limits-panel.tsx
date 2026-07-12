import { LockKeyhole, TriangleAlert } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function limitTone(status: string): "neutral" | "teal" | "amber" | "blue" {
  if (status === "locked") {
    return "blue";
  }

  if (status === "review_required" || status === "needs_evidence") {
    return "amber";
  }

  return "neutral";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    locked: "已锁定",
    review_required: "需要老师审查",
    needs_evidence: "需要证据",
    context_only: "仅上下文"
  };
  return labels[status] ?? status.replace("_", " ");
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    unproven_cue: "未证明线索",
    review_boundary: "审查边界",
    blocked_work: "锁定工作"
  };
  return labels[category] ?? category.replace("_", " ");
}

export function VisualLearningLimitsPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  return (
    <Surface className="border-amber-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="amber">{report.summary.visualLearningLimitItems} 条可见边界</Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化学习边界</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这个面板用来约束 AI 学徒：哪些线索仍只是上下文，哪些决策还要老师审查，哪些产品工作必须等明确验收后才能继续。
          </p>
        </div>
        <TriangleAlert className="size-5 text-apprentice-amber" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">未证明线索</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualLearningUnprovenCues}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">审查边界</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualLearningReviewLimits}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">锁定工作</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualLearningBlockedLimits}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {report.visualLearningLimits.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={limitTone(item.status)}>{statusLabel(item.status)}</Badge>
              <Badge tone="neutral">{categoryLabel(item.category)}</Badge>
            </div>
            <div className="mt-3 flex items-start gap-2">
              {item.status === "locked" ? (
                <LockKeyhole className="mt-0.5 size-4 shrink-0 text-apprentice-blue" />
              ) : (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-apprentice-amber" />
              )}
              <div className="min-w-0">
                <p className="font-extrabold text-ink">{item.label}</p>
                <p className="mt-2 break-words text-xs leading-5 text-slate-600">{item.evidence}</p>
              </div>
            </div>
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
