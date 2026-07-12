import { CheckCircle2, LockKeyhole, Route, ShieldAlert } from "lucide-react";
import type { QualificationCapabilityBoundary, QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function toneForStatus(status: QualificationCapabilityBoundary["status"]) {
  if (status === "ready") {
    return "teal" as const;
  }

  return "amber" as const;
}

function statusLabel(status: QualificationCapabilityBoundary["status"]) {
  return status === "ready" ? "已就绪" : "保持锁定";
}

function categoryLabel(category: QualificationCapabilityBoundary["category"]) {
  const labels: Record<QualificationCapabilityBoundary["category"], string> = {
    automatic: "可自动执行",
    teacher_review: "老师审查",
    memory: "记忆能力",
    blocked: "已锁定"
  };
  return labels[category];
}

function iconForCategory(category: QualificationCapabilityBoundary["category"]) {
  if (category === "automatic") {
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-apprentice-teal" />;
  }

  if (category === "blocked") {
    return <LockKeyhole className="mt-0.5 size-4 shrink-0 text-apprentice-amber" />;
  }

  return <ShieldAlert className="mt-0.5 size-4 shrink-0 text-apprentice-amber" />;
}

export function ApprenticeCapabilityBoundaryPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  return (
    <Surface className="border-apprentice-blue/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="blue">
            {report.summary.capabilityBoundaryPassed}/{report.summary.capabilityBoundaryTotal} 条边界已证明
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">AI 学徒能力边界</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            清楚区分学徒可以自动做什么、哪些必须等老师审查、哪些在验收前保持锁定。
          </p>
        </div>
        <Route className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {report.capabilityBoundary.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-3 text-sm">
            <div className="flex items-start gap-2">
              {iconForCategory(item.category)}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-extrabold text-ink">{item.label}</p>
                  <Badge tone="neutral">{categoryLabel(item.category)}</Badge>
                  <Badge tone={toneForStatus(item.status)}>{statusLabel(item.status)}</Badge>
                  <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "证据已通过" : "需要证据"}</Badge>
                </div>
                <p className="mt-2 break-words text-xs leading-5 text-slate-600">{item.evidence}</p>
                {item.scenarioIds.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.scenarioIds.map((scenarioId) => (
                      <Badge key={scenarioId} tone="neutral">
                        {scenarioId}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
