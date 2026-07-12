import { WandSparkles } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function reviewLabel(value: boolean) {
  return value ? "老师审查" : "自动执行";
}

export function VisualCorrectionRehearsalPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const rehearsal = report.visualCorrectionRehearsal;

  return (
    <Surface className="border-amber-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={rehearsal.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            {report.summary.visualCorrectionRehearsalsPassed}/{report.summary.visualCorrectionRehearsals} 次预演
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化纠正预演</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            只供审查的纠正闭环预演：从老师反馈提取候选视觉规则，用候选规则回放下一次运行，并确认不会保存运行、规则、验收或封装状态。
          </p>
        </div>
        <WandSparkles className="size-5 text-amber-600" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">被候选规则改变</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualCorrectionRehearsalChanged}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">审查保持</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualCorrectionRehearsalReviewPreserved}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">是否持久化</p>
          <p className="mt-1 text-xl font-black text-ink">{rehearsal.persisted ? "是" : "否"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">是否验收</p>
          <p className="mt-1 text-xl font-black text-ink">{rehearsal.accepted ? "是" : "否"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {rehearsal.cases.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "已就绪" : "需要证据"}</Badge>
              <Badge tone={item.changedByCandidateRule ? "teal" : "neutral"}>
                {item.changedByCandidateRule ? "已改变" : "保持不变"}
              </Badge>
              <Badge tone={item.afterReview ? "amber" : "teal"}>{reviewLabel(item.afterReview)}</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.label}</p>
            <p className="mt-2 break-words text-xs leading-5 text-slate-600">{item.input}</p>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">候选规则前</p>
                <p className="mt-1">{item.beforeLighting}</p>
                <p>{reviewLabel(item.beforeReview)}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">候选规则后</p>
                <p className="mt-1">{item.afterLighting}</p>
                <p>{reviewLabel(item.afterReview)}</p>
              </div>
            </div>
            <div className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
              <p className="font-bold text-ink">{item.extractedRuleTitle}</p>
              <p className="mt-1">{item.extractedRuleCondition}</p>
              <p>{item.extractedRuleAction}</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{item.evidence}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.learningTrace.map((step) => (
                <Badge key={`${item.id}-${step.id}`} tone={step.needsHumanReview ? "amber" : "teal"}>
                  {step.label}
                </Badge>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
