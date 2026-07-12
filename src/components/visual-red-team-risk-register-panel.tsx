import { Siren } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function statusTone(status: string): "neutral" | "teal" | "amber" | "blue" {
  if (status === "mitigated_for_review") {
    return "teal";
  }

  if (status === "locked") {
    return "blue";
  }

  return "amber";
}

function severityTone(severity: string): "neutral" | "teal" | "amber" | "blue" {
  return severity === "high" ? "amber" : "neutral";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    mitigated_for_review: "已缓解，待老师审查",
    needs_teacher_review: "需要老师审查",
    locked: "已锁定"
  };

  return labels[status] ?? status;
}

function severityLabel(severity: string) {
  const labels: Record<string, string> = {
    high: "高风险",
    medium: "中风险",
    low: "低风险"
  };

  return labels[severity] ?? severity;
}

export function VisualRedTeamRiskRegisterPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const register = report.visualRedTeamRegister;

  return (
    <Surface className="border-amber-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={register.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            {report.summary.visualRedTeamMitigated}/{report.summary.visualRedTeamRisks} 项已缓解
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化学习红队风险登记</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这里专门检查视觉规则过度泛化、误触发、未证实线索和过早封装等风险。它只记录老师审查证据，不提供验收通道。
          </p>
        </div>
        <Siren className="size-5 text-amber-600" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">老师审查</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualRedTeamTeacherReview}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">锁定风险</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualRedTeamLocked}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">是否验收</p>
          <p className="mt-1 text-xl font-black text-ink">{register.accepted ? "是" : "否"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装锁</p>
          <p className="mt-1 text-xl font-black text-ink">{register.packagingGated ? "锁定" : "打开"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {register.risks.map((risk) => (
          <article key={risk.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={risk.passed ? "teal" : "amber"}>{risk.passed ? "证据就绪" : "需要证据"}</Badge>
              <Badge tone={severityTone(risk.severity)}>{severityLabel(risk.severity)}</Badge>
              <Badge tone={statusTone(risk.status)}>{statusLabel(risk.status)}</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{risk.label}</p>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
              <div className="rounded-md bg-white p-3">
                <p className="font-bold text-ink">风险</p>
                <p className="mt-1">{risk.risk}</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="font-bold text-ink">探针</p>
                <p className="mt-1">{risk.probe}</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="font-bold text-ink">缓解证据</p>
                <p className="mt-1">{risk.mitigation}</p>
              </div>
            </div>
            <p className="mt-3 break-words text-xs leading-5 text-slate-500">
              证据来源：{risk.sourceIds.join(", ")}
            </p>
          </article>
        ))}
      </div>
    </Surface>
  );
}
