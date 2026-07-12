import { ListChecks } from "lucide-react";
import type { LearningChallengeSuite } from "@/server/qualification/learning-challenge";
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
    counterexample: "反例命中",
    not_matched: "未命中",
    disabled: "已暂停"
  };

  return labels[decision] ?? decision;
}

function lightingLabel(lighting: string) {
  const labels: Record<string, string> = {
    "golden hour": "黄金时刻",
    "natural light": "自然光"
  };

  return labels[lighting] ?? lighting;
}

function statusLabel(status: string) {
  if (status === "needs_review") {
    return "需要老师审查";
  }

  if (status === "completed") {
    return "已完成";
  }

  return status;
}

export function LearningChallengeSuitePanel({
  suite
}: Readonly<{
  suite: LearningChallengeSuite;
}>) {
  return (
    <Surface className="border-apprentice-teal/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={suite.passed === suite.total ? "teal" : "amber"}>
            挑战套件 {suite.passed}/{suite.total}
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">只读挑战套件</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这是一组机器可读的老师验收挑战：正向线索、反例和普通日光都会跑一遍。它不会保存运行、
            不会学习新规则、不会确认技术合格，也不会解锁封装。
          </p>
        </div>
        <ListChecks className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-5 grid gap-4">
        {suite.items.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4 text-sm">
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.probe.expectationResult.passed ? "teal" : "amber"}>
                    {item.probe.expectationResult.passed ? "通过" : "待审查"}
                  </Badge>
                  <Badge tone="neutral">{lightingLabel(item.expectedLighting)}</Badge>
                  <Badge tone={item.expectedReview ? "amber" : "teal"}>
                    {item.expectedReview ? "老师审查" : "可自动"}
                  </Badge>
                  <Badge tone={item.probe.persisted ? "amber" : "teal"}>
                    已保存：{item.probe.persisted ? "是" : "否"}
                  </Badge>
                </div>
                <p className="mt-3 font-extrabold text-ink">{item.label}</p>
                <p className="mt-2 break-words text-xs leading-5 text-slate-600">{item.input}</p>
                <div className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
                  <p>
                    <strong>预期：</strong> {item.probe.expectationResult.evidence}
                  </p>
                  <p>
                    <strong>实际：</strong> {lightingLabel(item.probe.output.lightingCondition)}，{statusLabel(item.probe.status)}
                  </p>
                  <p>
                    <strong>记忆影响：</strong>{" "}
                    {item.probe.changedByMemory ? "记忆改变了输出" : "保持保守输出"}
                  </p>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-extrabold uppercase text-slate-500">学习前后对比</p>
                  <div className="mt-2 grid gap-2">
                    {item.probe.memoryComparison.map((comparison) => (
                      <div key={comparison.field} className="rounded-md bg-white p-2 text-xs leading-5 text-slate-600">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-ink">{comparison.field}</span>
                          <Badge tone={comparison.changed ? "teal" : "neutral"}>
                            {comparison.changed ? "已改变" : "未改变"}
                          </Badge>
                        </div>
                        <p className="mt-1 break-words">
                          <strong>学习前：</strong> {comparison.baseline}
                        </p>
                        <p className="break-words">
                          <strong>学习后：</strong> {comparison.learned}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-extrabold uppercase text-slate-500">规则决策</p>
                    <Badge tone="blue">{item.probe.ruleDecisions.length} 条决策</Badge>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {item.probe.ruleDecisions.length > 0 ? (
                      item.probe.ruleDecisions.map((decision) => (
                        <div key={`${item.id}-${decision.title}`} className="rounded-md bg-white p-2 text-xs leading-5 text-slate-600">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={decisionTone(decision.decision)}>{decisionLabel(decision.decision)}</Badge>
                            <span className="font-bold text-ink">{decision.title}</span>
                          </div>
                          <p className="mt-1 break-words">{decision.reason}</p>
                          <p className="mt-1 break-words">
                            <strong>命中线索：</strong> {decision.matchedCues.join(", ") || "无"}
                          </p>
                          <p className="break-words">
                            <strong>反例线索：</strong> {decision.counterCues.join(", ") || "无"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-md bg-white p-2 text-xs leading-5 text-slate-600">
                        没有可复用规则被触发，输出保持保守，并继续交给老师审查。
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-extrabold uppercase text-slate-500">公开追踪回放</p>
                    <Badge tone="blue">{item.probe.traceSummary.length} 步</Badge>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {item.probe.traceSummary.map((step) => (
                      <div key={`${item.id}-${step.stepId}`} className="rounded-md bg-white p-2 text-xs leading-5 text-slate-600">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-ink">{step.stepName}</span>
                          <Badge tone={step.needsHumanReview ? "amber" : "teal"}>
                            {step.needsHumanReview ? "审查" : "通过"}
                          </Badge>
                        </div>
                        <p className="mt-1 break-words">{step.validation}</p>
                        <p className="mt-1 break-words">
                          <strong>规则：</strong> {step.appliedRuleTitles.join(", ") || "无"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
