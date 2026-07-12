import { ListChecks, LockKeyhole, MessageSquareQuote } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function reviewStateLabel(state: string) {
  const labels: Record<string, string> = {
    ready_for_teacher_review: "等待老师审查",
    locked_until_teacher_acceptance: "确认前锁定"
  };

  return labels[state] ?? state;
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "逐条审查老师要求": "逐条审查老师要求",
    "补充新的带教要求": "补充新的带教要求",
    "重新运行本地验证": "重新运行本地验证",
    "Accept technology": "确认技术合格",
    Package: "封装",
    Release: "发布",
    Wrap: "包装交付"
  };

  return labels[action] ?? action;
}

export function UserRequirementCoverageAuditPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const audit = report.userRequirementCoverageAudit;

  return (
    <Surface className="border-apprentice-blue/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={audit.status === "ready_for_teacher_review" ? "teal" : "amber"}>
              {report.summary.userRequirementCoverageReady + report.summary.userRequirementCoverageLocked}/
              {report.summary.userRequirementCoverageItems} 项已对齐
            </Badge>
            <Badge tone="blue">accepted=false</Badge>
            <Badge tone="blue">封装锁定</Badge>
          </div>
          <h3 className="mt-3 text-lg font-extrabold text-ink">用户要求覆盖审计</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            按老师这几轮明确要求逐条对齐证据；这里是给老师判断技术合不合格的审查表，不是验收按钮，也不会解锁封装。
          </p>
        </div>
        <ListChecks className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">审查状态</p>
          <p className="mt-1 text-sm font-black text-ink">
            {audit.status === "ready_for_teacher_review" ? "等待老师审查" : "需要更多证据"}
          </p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">确认状态</p>
          <p className="mt-1 text-sm font-black text-ink">{audit.accepted ? "已确认" : "未确认"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">锁定项</p>
          <p className="mt-1 text-sm font-black text-ink">{report.summary.userRequirementCoverageLocked} 项</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {audit.items.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "证据已对齐" : "需要补证据"}</Badge>
              <Badge tone={item.reviewState === "locked_until_teacher_acceptance" ? "blue" : "neutral"}>
                {reviewStateLabel(item.reviewState)}
              </Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{item.userRequirement}</p>
            <p className="mt-3 text-xs leading-5 text-slate-600">{item.evidence}</p>
            <Badge tone="neutral">{item.evidencePath}</Badge>
            <div className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-700">
              <div className="mb-1 flex items-center gap-2 font-extrabold text-ink">
                <MessageSquareQuote className="size-4 text-apprentice-teal" />
                老师审查问题
              </div>
              {item.teacherQuestion}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-teal-50 p-3 text-sm leading-6 text-teal-900">
          <p className="font-extrabold text-teal-950">审查期间允许</p>
          <p className="mt-1">{audit.allowedActions.map(actionLabel).join(" / ")}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-3 text-sm leading-6 text-blue-900">
          <div className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-apprentice-blue" />
            <p className="font-extrabold text-blue-950">仍然禁止</p>
          </div>
          <p className="mt-1">{audit.blockedActions.map(actionLabel).join(" / ")}</p>
        </div>
      </div>
    </Surface>
  );
}
