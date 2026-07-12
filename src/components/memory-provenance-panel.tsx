import Link from "next/link";
import { BookOpenCheck, GitBranch, History } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function sourceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    Correction: "老师纠正",
    Example: "老师示例",
    "Visual demonstration": "视觉示范",
    "Execution history": "执行历史"
  };
  return labels[type] ?? type;
}

export function MemoryProvenancePanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const provenRules = report.memoryProvenance.filter((rule) => rule.sources.length > 0).length;

  return (
    <Surface className="border-teal-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="teal">{provenRules}/{report.memoryProvenance.length} 条规则有来源</Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可复用记忆来源</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            每条学到的规则都能回溯到老师带教证据，并能继续追踪到它在哪些运行或 trace 步骤里被复用。
          </p>
        </div>
        <GitBranch className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {report.memoryProvenance.map((rule) => (
          <article key={rule.ruleId} className="min-w-0 rounded-md border border-line bg-mist p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-extrabold text-ink">{rule.ruleTitle}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{rule.ruleId}</p>
              </div>
              <Badge tone={rule.enabled ? "teal" : "neutral"}>{rule.enabled ? "已启用" : "已暂停"}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="neutral">{Math.round(rule.confidence * 100)}% 置信度</Badge>
              {rule.sourceTypes.map((type) => (
                <Badge key={type} tone={type === "Visual demonstration" ? "blue" : "teal"}>
                  {sourceTypeLabel(type)}
                </Badge>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {rule.sources.map((source) => (
                <div key={`${rule.ruleId}-${source.type}-${source.createdAt}`} className="rounded-md bg-white p-3">
                  <div className="flex items-center gap-2">
                    <BookOpenCheck className="size-3 text-apprentice-teal" />
                    <p className="text-xs font-bold uppercase text-slate-500">{sourceTypeLabel(source.type)}</p>
                  </div>
                  <p className="mt-1 font-bold text-ink">{source.label}</p>
                  <p className="mt-1 break-words text-xs leading-5 text-slate-600">{source.evidence}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-md border border-teal-100 bg-teal-50 p-3">
              <div className="flex items-center gap-2">
                <History className="size-3 text-apprentice-teal" />
                <p className="text-xs font-bold uppercase text-teal-700">执行中复用</p>
              </div>
              {rule.appliedRunIds.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {rule.appliedRunIds.map((runId) => (
                    <Link key={runId} href={`/runs/${runId}`} className="text-xs font-bold text-teal-800">
                      {runId}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs leading-5 text-teal-800">还没有已保存运行复用这条规则。</p>
              )}
              {rule.appliedTraceStepNames.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {rule.appliedTraceStepNames.map((stepName) => (
                    <Badge key={stepName} tone="teal">{stepName}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
