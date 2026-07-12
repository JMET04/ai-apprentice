import { GitBranch, MapPinned } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function cueTone(cueType: string): "neutral" | "teal" | "amber" | "blue" {
  if (cueType === "annotation") {
    return "amber";
  }

  if (cueType === "lighting_signal") {
    return "blue";
  }

  return "teal";
}

function cueTypeLabel(cueType: string) {
  const labels: Record<string, string> = {
    annotation: "标注区域",
    lighting_signal: "光线信号",
    teacher_note: "老师备注",
    extracted_cue: "提取线索"
  };
  return labels[cueType] ?? cueType.replace("_", " ");
}

export function VisualCueAuditTrailPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  return (
    <Surface className="border-apprentice-blue/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={report.summary.visualCueAuditPassed >= 3 ? "teal" : "amber"}>
            {report.summary.visualCueAuditPassed}/{report.summary.visualCueAuditTotal} 条线索链路
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化线索审计链</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            每条老师给的视觉线索都能从参考证据追到可复用规则，再追到场景或挑战结果。只作为上下文的线索也会保留可见，不会悄悄当成已学行为。
          </p>
        </div>
        <GitBranch className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {report.visualCueAuditTrail.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.passed ? "teal" : "neutral"}>{item.passed ? "已关联" : "仅上下文"}</Badge>
              <Badge tone={cueTone(item.cueType)}>{cueTypeLabel(item.cueType)}</Badge>
              {item.confidence === null ? null : <Badge tone="blue">{Math.round(item.confidence * 100)}%</Badge>}
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.cue}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              <strong>{item.demoTitle}</strong>
              {item.regionLabel ? `, ${item.regionLabel}` : ""}
            </p>
            <p className="mt-2 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">{item.sourceEvidence}</p>

            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
              <div className="rounded-md bg-white p-2">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <GitBranch className="size-3.5 text-apprentice-blue" />
                  规则链路
                </div>
                <p className="mt-1 break-words">{item.ruleTitles.join(" / ") || "还没有可复用规则链路。"}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <MapPinned className="size-3.5 text-apprentice-blue" />
                  结果链路
                </div>
                <p className="mt-1 break-words">
                  {[...item.scenarioIds, ...item.challengeIds].join(" / ") || "还没有场景或挑战链路。"}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-600">{item.outcomeEvidence}</p>
          </article>
        ))}
      </div>
    </Surface>
  );
}
