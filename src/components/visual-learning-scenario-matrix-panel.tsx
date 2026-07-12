import { CheckCircle2, CircleAlert, GitBranch } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
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

function memorySourceLabel(source: string) {
  return source === "visual_demonstration" ? "视觉示范" : source.replace("_", " ");
}

export function VisualLearningScenarioMatrixPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const passed = report.summary.visualScenarioPassed;
  const total = report.summary.visualScenarioTotal;

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={passed === total ? "teal" : "amber"}>
            {passed}/{total} 个场景通过
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化学习场景矩阵</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            用可审查证据覆盖正向线索、视觉记忆线索、反例和普通输入。
          </p>
        </div>
        <GitBranch className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {report.visualLearningScenarios.map((scenario) => (
          <article key={scenario.id} className="rounded-md border border-line bg-mist p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-extrabold text-ink">{scenario.label}</p>
                  <Badge tone={scenario.passed ? "teal" : "amber"}>
                    {scenario.passed ? "已通过" : "需要审查"}
                  </Badge>
                </div>
                <p className="mt-2 break-words text-xs leading-5 text-slate-600">{scenario.input}</p>
              </div>
              {scenario.passed ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-apprentice-teal" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-apprentice-amber" />
              )}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md bg-white p-2">
                <p className="text-xs font-bold uppercase text-slate-500">预期</p>
                <p className="mt-1 text-ink">{scenario.expectedLighting}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {scenario.expectedReview ? "预期老师审查" : "预期无需老师审查"}
                </p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="text-xs font-bold uppercase text-slate-500">实际</p>
                <p className="mt-1 text-ink">{scenario.actualLighting}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {scenario.needsReview ? "需要老师审查" : "审查门已通过"}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {scenario.decisions.length > 0 ? (
                scenario.decisions.map((decision) => (
                  <div key={`${scenario.id}-${decision.title}-${decision.decision}`} className="rounded-md bg-white p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          decision.decision === "applied"
                            ? "teal"
                            : decision.decision === "conflicted" || decision.decision === "counterexample"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {decisionLabel(decision.decision)}
                      </Badge>
                      <Badge tone={decision.memorySource === "visual_demonstration" ? "blue" : "neutral"}>
                        {memorySourceLabel(decision.memorySource)}
                      </Badge>
                    </div>
                    <p className="mt-1 font-bold text-ink">{decision.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {[...decision.matchedCues, ...decision.counterCues].join(", ") || "No direct cue."}
                    </p>
                    {decision.counterEvidenceSources.length > 0 ? (
                      <p className="mt-1 text-xs font-bold text-amber-700">
                        反例记忆：{decision.counterEvidenceSources.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-white p-2 text-xs leading-5 text-slate-600">{scenario.evidence}</p>
              )}
            </div>

            <div className="mt-3 rounded-md bg-white p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase text-slate-500">公开 trace 回放</p>
                <Badge tone="blue">{scenario.traceSummary.length} 步</Badge>
              </div>
              <div className="mt-2 grid gap-2">
                {scenario.traceSummary.map((step) => (
                  <div key={`${scenario.id}-${step.stepId}`} className="rounded-md border border-line bg-mist p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={step.needsHumanReview ? "amber" : "teal"}>
                        {step.needsHumanReview ? "老师审查" : percent(step.confidence)}
                      </Badge>
                      <p className="font-bold text-ink">{step.stepName}</p>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{step.validation}</p>
                    {step.appliedRuleTitles.length > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">
                        规则：{step.appliedRuleTitles.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
