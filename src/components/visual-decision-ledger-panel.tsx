import { GitCompareArrows, ListChecks } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function decisionTone(decision: string): "neutral" | "teal" | "amber" | "blue" {
  if (decision === "applied") {
    return "teal";
  }

  if (decision === "conflicted" || decision === "counterexample") {
    return "amber";
  }

  return "neutral";
}

function decisionLabel(decision: string) {
  const labels: Record<string, string> = {
    applied: "已应用",
    conflicted: "有冲突",
    counterexample: "反例",
    not_matched: "未匹配",
    disabled: "已禁用"
  };
  return labels[decision] ?? decision;
}

export function VisualDecisionLedgerPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  return (
    <Surface className="border-apprentice-teal/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="teal">{report.summary.visualDecisionLedgerItems} 条规则决策</Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化决策台账</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            汇总场景检查和只读挑战探针里的每一次视觉记忆规则决策，展示哪些记忆被应用、哪里发生冲突、哪些必须老师审查。
          </p>
        </div>
        <ListChecks className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">已应用</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualDecisionApplied}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">冲突或反例</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualDecisionConflicted}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">需要老师审查</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualDecisionReviewRequired}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {report.visualDecisionLedger.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={decisionTone(item.decision)}>{decisionLabel(item.decision)}</Badge>
              <Badge tone={item.sourceType === "challenge" ? "blue" : "neutral"}>{item.sourceType}</Badge>
              <Badge tone={item.needsReview ? "amber" : "teal"}>
                {item.needsReview ? "老师审查" : "自动"}
              </Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.ruleTitle}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {item.sourceLabel}：预期 {item.expectedLighting ?? "任意光线"}；实际 {item.actualLighting}
            </p>
            <p className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">{item.reason}</p>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
              <div className="rounded-md bg-white p-2">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <GitCompareArrows className="size-3.5 text-apprentice-teal" />
                  匹配线索
                </div>
                <p className="mt-1 break-words">{item.matchedCues.join(", ") || "无"}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">反例线索</p>
                <p className="mt-1 break-words">{item.counterCues.join(", ") || "无"}</p>
              </div>
            </div>
            {item.counterEvidenceSources.length > 0 ? (
              <p className="mt-3 text-xs font-bold leading-5 text-amber-700">
                反例记忆：{item.counterEvidenceSources.join(", ")}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </Surface>
  );
}
