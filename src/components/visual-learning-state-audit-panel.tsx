import { GitCommitHorizontal } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function triggerTone(trigger: string): "neutral" | "teal" | "amber" | "blue" {
  if (trigger === "visual_teaching") {
    return "blue";
  }

  if (trigger === "correction_rehearsal") {
    return "amber";
  }

  return "neutral";
}

function reviewTone(reviewState: string): "neutral" | "teal" | "amber" | "blue" {
  if (reviewState === "automatic") {
    return "teal";
  }

  if (reviewState === "teacher_review") {
    return "amber";
  }

  return "blue";
}

function triggerLabel(trigger: string) {
  const labels: Record<string, string> = {
    visual_teaching: "视觉带教",
    correction_rehearsal: "纠正预演",
    baseline: "基线",
    packaging_lock: "封装锁"
  };
  return labels[trigger] ?? trigger.replace("_", " ");
}

function reviewStateLabel(reviewState: string) {
  const labels: Record<string, string> = {
    automatic: "自动执行",
    teacher_review: "老师审查",
    locked: "已锁定"
  };
  return labels[reviewState] ?? reviewState.replace("_", " ");
}

export function VisualLearningStateAuditPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const audit = report.visualLearningStateAudit;

  return (
    <Surface className="border-blue-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={audit.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            {report.summary.visualStateTransitionsPassed}/{report.summary.visualStateTransitions} 次状态转换
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化学习状态转换审计</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            逐状态展示 AI 学徒如何从基线行为走到已学习行为、纠正预演和只读锁定。每个转换都会说明触发原因、预期结果、实际结果和审查边界。
          </p>
        </div>
        <GitCommitHorizontal className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">自动执行</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualStateTransitionAutomatic}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">老师审查</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualStateTransitionReview}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">已锁定</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualStateTransitionLocked}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">是否验收</p>
          <p className="mt-1 text-xl font-black text-ink">{audit.accepted ? "是" : "否"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {audit.transitions.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "已证明" : "需要证据"}</Badge>
              <Badge tone={triggerTone(item.trigger)}>{triggerLabel(item.trigger)}</Badge>
              <Badge tone={reviewTone(item.reviewState)}>{reviewStateLabel(item.reviewState)}</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.label}</p>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">从</p>
                <p className="mt-1">{item.fromState}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">到</p>
                <p className="mt-1">{item.toState}</p>
              </div>
            </div>
            <div className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
              <p className="font-bold text-ink">预期</p>
              <p className="mt-1">{item.expectedOutcome}</p>
              <p className="mt-2 font-bold text-ink">实际</p>
              <p className="mt-1">{item.actualOutcome}</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{item.evidence}</p>
          </article>
        ))}
      </div>
    </Surface>
  );
}
