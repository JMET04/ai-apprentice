import { ListChecks } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function routeTone(route: string): "neutral" | "teal" | "amber" | "blue" {
  return route === "automatic" ? "teal" : "amber";
}

function sourceTone(sourceType: string): "neutral" | "teal" | "amber" | "blue" {
  if (sourceType === "scenario") {
    return "blue";
  }

  if (sourceType === "robustness") {
    return "amber";
  }

  return "neutral";
}

function routeLabel(route: string) {
  return route === "automatic" ? "自动执行" : "老师审查";
}

function sourceLabel(sourceType: string) {
  const labels: Record<string, string> = {
    scenario: "场景",
    regression: "回归",
    robustness: "鲁棒性",
    challenge: "老师挑战"
  };
  return labels[sourceType] ?? sourceType;
}

function reviewLabel(value: boolean | null) {
  if (value === null) {
    return "未评分";
  }

  return value ? "老师审查" : "自动执行";
}

export function VisualBehaviorScorecardPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const scorecard = report.visualBehaviorScorecard;

  return (
    <Surface className="border-apprentice-teal/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={scorecard.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            {report.summary.visualBehaviorScorecardPassed}/{report.summary.visualBehaviorScorecardCases} 个案例
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化行为评分卡</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            对比场景、回归、鲁棒性和老师挑战里的预期与实际行为，分别看光线判断、老师审查路由和记忆效果。当前仍只供审查。
          </p>
        </div>
        <ListChecks className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">指标通过</p>
          <p className="mt-1 text-xl font-black text-ink">
            {report.summary.visualBehaviorScorecardMetricsPassed}/{report.summary.visualBehaviorScorecardMetrics}
          </p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">自动路由</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualBehaviorScorecardAutoRoutes}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">审查路由</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualBehaviorScorecardReviewRoutes}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">是否验收</p>
          <p className="mt-1 text-xl font-black text-ink">{scorecard.accepted ? "是" : "否"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-5">
        {scorecard.metrics.map((metric) => (
          <article key={metric.id} className="rounded-md border border-line bg-mist p-3">
            <Badge tone={metric.passed ? "teal" : "amber"}>
              {metric.correct}/{metric.total}
            </Badge>
            <p className="mt-3 text-sm font-extrabold text-ink">{metric.label}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{metric.evidence}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {scorecard.cases.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "已匹配" : "需要证据"}</Badge>
              <Badge tone={sourceTone(item.sourceType)}>{sourceLabel(item.sourceType)}</Badge>
              <Badge tone={routeTone(item.route)}>{routeLabel(item.route)}</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.label}</p>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">光线</p>
                <p className="mt-1">预期：{item.expectedLighting ?? "未评分"}</p>
                <p>实际：{item.actualLighting}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">审查路由</p>
                <p className="mt-1">预期：{reviewLabel(item.expectedReview)}</p>
                <p>实际：{reviewLabel(item.actualReview)}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">记忆效果</p>
                <p className="mt-1">预期：{item.expectedMemoryEffect.replace("_", " ")}</p>
                <p>是否改变：{item.changedByMemory === null ? "未评分" : item.changedByMemory ? "是" : "否"}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{item.evidence}</p>
          </article>
        ))}
      </div>
    </Surface>
  );
}
