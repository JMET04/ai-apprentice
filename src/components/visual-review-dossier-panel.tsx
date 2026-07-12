import { ClipboardCheck, LockKeyhole } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function statusTone(status: string): "neutral" | "teal" | "amber" | "blue" {
  if (status === "proven") {
    return "teal";
  }

  if (status === "locked") {
    return "blue";
  }

  return "amber";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    proven: "证据已证明",
    review_required: "需要老师审查",
    locked: "已锁定",
    ready_for_teacher_review: "等待老师审查",
    needs_more_evidence: "需要更多证据"
  };

  return labels[status] ?? status;
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "Inspect visual learning evidence": "检查可视化学习证据",
    "Run review-only probes": "运行只审查探针",
    "Rerun local verifier": "重跑本地验证",
    "Accept technology": "确认技术合格",
    Package: "封装",
    Release: "发布",
    Wrap: "包装/封装交付"
  };

  return labels[action] ?? action;
}

export function VisualReviewDossierPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const dossier = report.visualReviewDossier;

  return (
    <Surface className="border-apprentice-teal/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={dossier.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            {report.summary.visualReviewDossierPassed}/{report.summary.visualReviewDossierTotal} 个审查章节
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化学习审查档案</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这是给老师审查可视化学习技术用的证据包，会把证明、限制和只审查边界放在一起，但不提供验收动作。
          </p>
        </div>
        <ClipboardCheck className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">审查状态</p>
          <p className="mt-1 text-sm font-black text-ink">{statusLabel(dossier.status)}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">是否验收</p>
          <p className="mt-1 text-sm font-black text-ink">{dossier.accepted ? "是" : "否"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装锁</p>
          <p className="mt-1 text-sm font-black text-ink">{dossier.packagingGated ? "锁定" : "打开"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {dossier.sections.map((section) => (
          <article key={section.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={section.passed ? "teal" : "amber"}>{section.passed ? "证据就绪" : "需要证据"}</Badge>
              <Badge tone={statusTone(section.status)}>{statusLabel(section.status)}</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{section.label}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{section.evidence}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {section.sourceIds.slice(0, 8).map((sourceId) => (
                <Badge key={`${section.id}-${sourceId}`} tone="neutral">
                  {sourceId}
                </Badge>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-teal-50 p-3 text-sm leading-6 text-teal-900">
          <p className="font-extrabold text-teal-950">审查期间允许</p>
          <p className="mt-1">{dossier.allowedActions.map(actionLabel).join(" / ")}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-3 text-sm leading-6 text-blue-900">
          <div className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-apprentice-blue" />
            <p className="font-extrabold text-blue-950">仍然禁止</p>
          </div>
          <p className="mt-1">{dossier.blockedActions.map(actionLabel).join(" / ")}</p>
        </div>
      </div>
    </Surface>
  );
}
