import { GitCompareArrows } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

export function VisualRegressionComparisonPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  return (
    <Surface className="border-apprentice-blue/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={report.summary.visualRegressionPassed === report.summary.visualRegressionTotal ? "teal" : "amber"}>
            {report.summary.visualRegressionPassed}/{report.summary.visualRegressionTotal} 个回归案例
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化基线回归对比</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            同一批可视化学习场景会分别在无记忆和当前记忆下运行。正向案例应该改变，反例和普通日光必须保持保守。
          </p>
        </div>
        <GitCompareArrows className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">被记忆改变</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualRegressionChanged}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">保持保守</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualRegressionConservative}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {report.visualRegressionCases.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "已通过" : "需要证据"}</Badge>
              <Badge tone={item.expectedMemoryEffect === "changed" ? "blue" : "neutral"}>
                {item.expectedMemoryEffect}
              </Badge>
              <Badge tone={item.changedByMemory ? "teal" : "neutral"}>
                {item.changedByMemory ? "记忆改变输出" : "记忆保持保守"}
              </Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.label}</p>
            <p className="mt-2 break-words text-xs leading-5 text-slate-600">{item.input}</p>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">无记忆基线</p>
                <p className="mt-1">{item.baselineLighting}</p>
                <p>{item.baselineNeedsReview ? "老师审查" : "自动"}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">当前已学记忆</p>
                <p className="mt-1">{item.learnedLighting}</p>
                <p>{item.learnedNeedsReview ? "老师审查" : "自动"}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{item.evidence}</p>
          </article>
        ))}
      </div>
    </Surface>
  );
}
