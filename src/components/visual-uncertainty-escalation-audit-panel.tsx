import { AlertTriangle } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function triggerTone(trigger: string): "neutral" | "teal" | "amber" | "blue" {
  if (trigger === "packaging_lock") {
    return "blue";
  }

  if (trigger === "conflict" || trigger === "correction_boundary") {
    return "amber";
  }

  return "neutral";
}

function reviewTone(reviewState: string): "neutral" | "teal" | "amber" | "blue" {
  return reviewState === "locked" ? "blue" : "amber";
}

function triggerLabel(trigger: string) {
  const labels: Record<string, string> = {
    packaging_lock: "封装锁",
    conflict: "规则冲突",
    correction_boundary: "纠正边界",
    missing_evidence: "缺少证据",
    ordinary_uncertainty: "普通不确定性"
  };
  return labels[trigger] ?? trigger.replaceAll("_", " ");
}

function reviewStateLabel(reviewState: string) {
  const labels: Record<string, string> = {
    teacher_review: "老师审查",
    locked: "已锁定"
  };
  return labels[reviewState] ?? reviewState.replaceAll("_", " ");
}

export function VisualUncertaintyEscalationAuditPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const audit = report.visualUncertaintyEscalationAudit;

  return (
    <Surface className="border-amber-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={audit.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            {report.summary.visualUncertaintyEscalationsReady}/{report.summary.visualUncertaintyEscalations} 个升级点
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化不确定性升级审计</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            只读展示必须回到老师手里的时刻：冲突、缺少证据、普通不确定性、纠正边界和封装锁。每一项都说明为什么升级，以及老师下一步该看什么。
          </p>
        </div>
        <AlertTriangle className="size-5 text-amber-600" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">老师审查</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualUncertaintyTeacherReview}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">已锁定</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualUncertaintyLocked}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">是否验收</p>
          <p className="mt-1 text-xl font-black text-ink">{audit.accepted ? "是" : "否"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装锁</p>
          <p className="mt-1 text-xl font-black text-ink">{audit.packagingGated ? "锁定" : "打开"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {audit.items.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "证据就绪" : "需要证据"}</Badge>
              <Badge tone={triggerTone(item.trigger)}>{triggerLabel(item.trigger)}</Badge>
              <Badge tone={reviewTone(item.reviewState)}>{reviewStateLabel(item.reviewState)}</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.label}</p>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
              <div className="rounded-md bg-white p-3">
                <p className="font-bold text-ink">为什么升级</p>
                <p className="mt-1">{item.reason}</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="font-bold text-ink">老师动作</p>
                <p className="mt-1">{item.teacherAction}</p>
              </div>
            </div>
            <p className="mt-3 break-words text-xs leading-5 text-slate-500">
              来源：{item.sourceIds.join(", ")}
            </p>
          </article>
        ))}
      </div>
    </Surface>
  );
}
