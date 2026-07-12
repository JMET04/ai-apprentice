import { Route } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function statusTone(status: string): "neutral" | "teal" | "amber" | "blue" {
  if (status === "ready") {
    return "teal";
  }

  if (status === "locked") {
    return "blue";
  }

  return "amber";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ready: "就绪",
    review_required: "需要老师审查",
    locked: "已锁定",
    ready_for_teacher_review: "等待老师审查",
    needs_more_evidence: "需要更多证据"
  };

  return labels[status] ?? status;
}

function phaseLabel(phase: string) {
  const labels: Record<string, string> = {
    teach: "带教",
    extract: "抽取",
    apply: "应用",
    stress: "压力测试",
    limits: "限制",
    review: "审查"
  };

  return labels[phase] ?? phase;
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "Inspect replay": "检查回放",
    "Run challenge probes": "运行挑战探针",
    "Rerun local verifier": "重跑本地验证",
    "Accept technology": "确认技术合格",
    Package: "封装",
    Release: "发布",
    Wrap: "包装/封装交付"
  };

  return labels[action] ?? action;
}

export function VisualEvidenceReplayPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const replay = report.visualEvidenceReplay;

  return (
    <Surface className="border-apprentice-blue/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={replay.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            {report.summary.visualEvidenceReplayReady}/{report.summary.visualEvidenceReplaySteps} 个回放步骤
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化证据回放</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这里回放完整视觉学习链：来源示范、抽取规则、应用行为、反例审查、稳健性压力测试、可见限制和只审查封装锁。
          </p>
        </div>
        <Route className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">回放状态</p>
          <p className="mt-1 text-sm font-black text-ink">{statusLabel(replay.status)}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">只审查</p>
          <p className="mt-1 text-xl font-black text-ink">{replay.reviewOnly ? "是" : "否"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">是否验收</p>
          <p className="mt-1 text-xl font-black text-ink">{replay.accepted ? "是" : "否"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装锁</p>
          <p className="mt-1 text-xl font-black text-ink">{replay.packagingGated ? "锁定" : "打开"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {replay.steps.map((step) => (
          <article key={step.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={step.passed ? "teal" : "amber"}>{step.passed ? "证据就绪" : "需要证据"}</Badge>
              <Badge tone={statusTone(step.status)}>{statusLabel(step.status)}</Badge>
              <Badge tone="neutral">{phaseLabel(step.phase)}</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{step.label}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{step.evidence}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {step.sourceIds.slice(0, 8).map((sourceId) => (
                <Badge key={`${step.id}-${sourceId}`} tone="neutral">
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
          <p className="mt-1">{replay.allowedActions.map(actionLabel).join(" / ")}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-3 text-sm leading-6 text-blue-900">
          <p className="font-extrabold text-blue-950">仍然禁止</p>
          <p className="mt-1">{replay.blockedActions.map(actionLabel).join(" / ")}</p>
        </div>
      </div>
    </Surface>
  );
}
