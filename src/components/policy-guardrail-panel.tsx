import { CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

export function PolicyGuardrailPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const complete = report.summary.policyGatesPassed === report.summary.policyGatesTotal;

  return (
    <Surface className="border-amber-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={complete ? "teal" : "amber"}>
            策略闸门 {report.summary.policyGatesPassed}/{report.summary.policyGatesTotal}
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">护栏与老师控制证据</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这些可见策略检查保证学徒始终可审查：只展示公开追踪、明确老师审查点、纠错可回溯、
            校验证据完整，并且封装保持锁定。
          </p>
        </div>
        <ShieldCheck className="size-5 text-apprentice-amber" />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {report.policyEvidence.map((item) => (
          <article key={item.id} className="min-w-0 rounded-md border border-line bg-mist p-3 text-sm">
            <div className="flex items-start gap-2">
              {item.passed ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-apprentice-teal" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-apprentice-amber" />
              )}
              <div className="min-w-0">
                <p className="font-extrabold text-ink">{item.label}</p>
                <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "已通过" : "需要证据"}</Badge>
                <p className="mt-2 break-words text-xs leading-5 text-slate-600">{item.evidence}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
