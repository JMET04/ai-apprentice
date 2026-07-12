import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ApprenticeGrowthTimeline,
  type ApprenticeGrowthMetric,
  type ApprenticeGrowthMilestone
} from "@/components/apprentice-growth-timeline";
import { AppShell } from "@/components/app-shell";
import { Badge, Surface } from "@/components/ui";
import type { ExecutionOutput, RuleRecord, TraceStepRecord } from "@/lib/types";
import { memoryStore } from "@/server/memory/memory-store";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function displayText(value: string) {
  const labels: Record<string, string> = {
    "A teachable AI apprentice learning to turn travel notes into transparent photography journals.":
      "一个正在学习把旅行笔记转换成透明摄影日志的可带教 AI 学徒。",
    "Photography travel writing": "摄影旅行写作",
    "Generate a structured photography travel journal from a travel note": "从旅行笔记生成结构化摄影日志",
    "Teach the apprentice to transform a short travel note into a structured photography journal with visible evidence and reusable correction rules.":
      "教 AI 学徒把短旅行笔记转换成结构化摄影日志，并保留可见证据和可复用纠错规则。"
  };

  return labels[value] ?? value;
}

export default async function ApprenticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const apprentice = await memoryStore.getApprenticeProfile(id);

  if (!apprentice) {
    notFound();
  }

  const latestRun = apprentice.runs[0];
  const growthMetrics: ApprenticeGrowthMetric[] = [
    {
      label: "任务记忆",
      value: apprentice.tasks.length,
      evidence: "已经绑定的可带教任务。"
    },
    {
      label: "已学规则",
      value: apprentice.rules.length,
      evidence: "规则库中的可复用记忆。"
    },
    {
      label: "老师纠错",
      value: apprentice.corrections.length,
      evidence: "已经保留下来的人工反馈。"
    },
    {
      label: "结构化示例",
      value: apprentice.examples.length,
      evidence: "老师给过的结构化示范。"
    },
    {
      label: "视觉示范",
      value: apprentice.visualDemos.length,
      evidence: "参考画面和线索坐标证据。"
    },
    {
      label: "追踪运行",
      value: apprentice.runs.length,
      evidence: "可回放的执行历史。"
    }
  ];
  const growthMilestones: ApprenticeGrowthMilestone[] = [
    ...apprentice.tasks.map((task) => ({
      id: `task-${task.id}`,
      createdAt: task.createdAt,
      source: "Task" as const,
      label: task.name,
      evidence: task.goal,
      href: `/tasks/${task.id}`
    })),
    ...apprentice.visualDemos.map((demo) => {
      const extractedRule = parseJson<Pick<RuleRecord, "title"> | null>(demo.extractedRule, null);

      return {
        id: `visual-${demo.id}`,
        createdAt: demo.createdAt,
        source: "Visual demonstration" as const,
        label: demo.title,
        evidence: demo.teacherNotes,
        learnedRuleTitle: extractedRule?.title ?? null,
        href: `/tasks/${demo.taskId}`
      };
    }),
    ...apprentice.examples.map((example) => {
      const extractedRule = parseJson<Pick<RuleRecord, "title"> | null>(example.extractedRule, null);

      return {
        id: `example-${example.id}`,
        createdAt: example.createdAt,
        source: "Teacher example" as const,
        label: "老师示例已转换成可复用记忆",
        evidence: example.input,
        learnedRuleTitle: extractedRule?.title ?? null,
        href: `/tasks/${example.taskId}`
      };
    }),
    ...apprentice.corrections.map((correction) => {
      const extractedRule = parseJson<Pick<RuleRecord, "title"> | null>(correction.extractedRule, null);

      return {
        id: `correction-${correction.id}`,
        createdAt: correction.createdAt,
        source: "Correction" as const,
        label: "老师纠错已转换成规则",
        evidence: correction.userFeedback,
        learnedRuleTitle: extractedRule?.title ?? null,
        href: correction.runId ? `/runs/${correction.runId}` : `/tasks/${correction.taskId}`
      };
    }),
    ...apprentice.rules.map((rule) => ({
      id: `rule-${rule.id}`,
      createdAt: rule.createdAt,
      source: "Rule" as const,
      label: rule.title,
      evidence: `${rule.condition} -> ${rule.action}`,
      learnedRuleTitle: rule.title,
      href: rule.taskId ? `/tasks/${rule.taskId}` : undefined
    })),
    ...apprentice.runs.map((run) => {
      const trace = parseJson<TraceStepRecord[]>(run.trace, []);
      const output = parseJson<ExecutionOutput | null>(run.output, null);
      const appliedRuleTitles = Array.from(new Set(trace.flatMap((step) => step.appliedRules.map((rule) => rule.title))));

      return {
        id: `run-${run.id}`,
        createdAt: run.createdAt,
        source: "Execution history" as const,
        label: run.status === "needs_review" ? "运行已完成，但需要老师审查" : "运行已完成",
        evidence:
          appliedRuleTitles.length > 0
            ? `应用了 ${appliedRuleTitles.join(", ")}；光线=${output?.lightingCondition ?? "未知"}。`
            : `没有应用已学规则；光线=${output?.lightingCondition ?? "未知"}。`,
        learnedRuleTitle: appliedRuleTitles[0] ?? null,
        href: `/runs/${run.id}`
      };
    })
  ]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 14);

  return (
    <AppShell>
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Surface>
          <Badge tone="teal">AI 学徒</Badge>
          <h2 className="mt-4 text-3xl font-black text-ink">{apprentice.name}</h2>
          <p className="mt-3 leading-7 text-slate-600">{displayText(apprentice.description)}</p>
          <dl className="mt-5 grid gap-3 text-sm">
            <div className="rounded-md bg-mist p-3">
              <dt className="font-bold text-slate-500">领域</dt>
              <dd className="mt-1 text-ink">{displayText(apprentice.domain)}</dd>
            </div>
            <div className="rounded-md bg-mist p-3">
              <dt className="font-bold text-slate-500">绑定任务</dt>
              <dd className="mt-1 text-ink">{apprentice.tasks.length}</dd>
            </div>
          </dl>
          <Link
            href={apprentice.tasks[0] ? `/tasks/${apprentice.tasks[0].id}/teach` : "/tasks/new"}
            className="mt-5 inline-flex rounded-md bg-apprentice-teal px-4 py-2 text-sm font-bold text-white"
          >
            {apprentice.tasks[0] ? "继续可视化带教" : "带教第一个任务"}
          </Link>
        </Surface>

        <div className="grid gap-5">
          <Surface>
            <h3 className="font-extrabold text-ink">已学规则</h3>
            <div className="mt-4 space-y-3">
              {apprentice.rules.length > 0 ? apprentice.rules.map((rule) => (
                <article key={rule.id} className="rounded-lg border border-line bg-mist p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-ink">{rule.title}</h4>
                    <Badge tone="teal">{Math.round(rule.confidence * 100)}% 置信度</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    <strong>条件：</strong> {rule.condition}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    <strong>动作：</strong> {rule.action}
                  </p>
                </article>
              )) : (
                <p className="rounded-md bg-mist p-3 text-sm text-slate-600">还没有可复用规则。先运行任务并教一次纠错，就会生成记忆。</p>
              )}
            </div>
          </Surface>

          <section className="grid gap-5 lg:grid-cols-2">
            <Surface>
              <h3 className="font-extrabold text-ink">纠错历史</h3>
              {apprentice.corrections.length > 0 ? (
                apprentice.corrections.map((correction) => (
                  <p key={correction.id} className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                    {correction.userFeedback}
                  </p>
                ))
              ) : (
                <p className="mt-3 rounded-md bg-mist p-3 text-sm text-slate-600">还没有保存纠错。</p>
              )}
            </Surface>
            <Surface>
              <h3 className="font-extrabold text-ink">执行记录</h3>
              {latestRun ? (
                <p className="mt-3 rounded-md bg-mist p-3 text-sm text-slate-700">
                  最近运行：{latestRun.status === "needs_review" ? "需要老师审查" : "已完成"}，
                  时间 {new Date(latestRun.createdAt).toLocaleString()}。
                </p>
              ) : (
                <p className="mt-3 rounded-md bg-mist p-3 text-sm text-slate-700">还没有执行运行。</p>
              )}
            </Surface>
          </section>
        </div>
      </div>
      <div className="mt-5">
        <ApprenticeGrowthTimeline
          apprenticeName={apprentice.name}
          metrics={growthMetrics}
          milestones={growthMilestones}
        />
      </div>
    </AppShell>
  );
}
