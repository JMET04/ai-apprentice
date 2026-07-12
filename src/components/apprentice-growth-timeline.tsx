import Link from "next/link";
import { BookOpenCheck, CheckCircle2, Eye, GitPullRequestArrow, History, Sparkles } from "lucide-react";
import { Badge, Surface } from "./ui";

export type ApprenticeGrowthMetric = {
  label: string;
  value: number;
  evidence: string;
};

export type ApprenticeGrowthMilestone = {
  id: string;
  createdAt: string;
  source: "Task" | "Visual demonstration" | "Teacher example" | "Correction" | "Rule" | "Execution history";
  label: string;
  evidence: string;
  learnedRuleTitle?: string | null;
  href?: string;
};

function sourceLabel(source: ApprenticeGrowthMilestone["source"]) {
  const labels: Record<ApprenticeGrowthMilestone["source"], string> = {
    Task: "任务",
    "Visual demonstration": "视觉示范",
    "Teacher example": "老师示例",
    Correction: "纠错",
    Rule: "规则",
    "Execution history": "执行历史"
  };

  return labels[source];
}

const sourceIcons = {
  Task: BookOpenCheck,
  "Visual demonstration": Eye,
  "Teacher example": Sparkles,
  Correction: GitPullRequestArrow,
  Rule: CheckCircle2,
  "Execution history": History
};

const sourceTones = {
  Task: "blue",
  "Visual demonstration": "blue",
  "Teacher example": "teal",
  Correction: "amber",
  Rule: "teal",
  "Execution history": "neutral"
} as const;

export function ApprenticeGrowthTimeline({
  apprenticeName,
  metrics,
  milestones
}: Readonly<{
  apprenticeName: string;
  metrics: ApprenticeGrowthMetric[];
  milestones: ApprenticeGrowthMilestone[];
}>) {
  return (
    <Surface className="border-teal-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="teal">学徒能力成长记录</Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">{apprenticeName} 的学习历史</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            像学生成长档案一样记录学徒学过什么、记忆从哪里来、哪些证据可以重新打开审查。
            这里只展示结构化学习来源，不展示私有思维链。
          </p>
        </div>
        <History className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-md border border-line bg-mist p-3">
            <p className="text-xs font-bold uppercase text-slate-500">{metric.label}</p>
            <p className="mt-1 text-2xl font-black text-ink">{metric.value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{metric.evidence}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        {milestones.length > 0 ? (
          milestones.map((milestone, index) => {
            const Icon = sourceIcons[milestone.source];
            const tone = sourceTones[milestone.source];

            return (
              <article key={milestone.id} className="rounded-md border border-line bg-white p-4 text-sm">
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal-50 text-xs font-black text-apprentice-teal">
                    {index + 1}
                  </span>
                  <Icon className="mt-1 size-4 shrink-0 text-apprentice-teal" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tone}>{sourceLabel(milestone.source)}</Badge>
                      <span className="text-xs text-slate-500">{new Date(milestone.createdAt).toLocaleString()}</span>
                    </div>
                    <h4 className="mt-2 font-extrabold text-ink">{milestone.label}</h4>
                    <p className="mt-1 break-words leading-6 text-slate-600">{milestone.evidence}</p>
                    {milestone.learnedRuleTitle ? (
                      <p className="mt-2 text-xs font-bold text-teal-700">
                        学到的记忆：{milestone.learnedRuleTitle}
                      </p>
                    ) : null}
                    {milestone.href ? (
                      <Link href={milestone.href} className="mt-3 inline-flex text-xs font-bold text-apprentice-blue">
                        查看证据
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-md bg-mist p-3 text-sm text-slate-600">
            还没有成长记录。带教一个任务、保存一次纠错或运行一次学徒后，这里会生成可见记录。
          </p>
        )}
      </div>
    </Surface>
  );
}
