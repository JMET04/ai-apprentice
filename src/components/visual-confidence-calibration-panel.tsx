import { Gauge } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function outcomeTone(outcome: string): "neutral" | "teal" | "amber" | "blue" {
  return outcome === "automatic" ? "teal" : "amber";
}

function outcomeLabel(outcome: string) {
  return outcome === "automatic" ? "自动执行" : "老师审查";
}

export function VisualConfidenceCalibrationPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const calibration = report.visualConfidenceCalibration;

  return (
    <Surface className="border-apprentice-teal/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={calibration.status === "calibrated_for_teacher_review" ? "teal" : "amber"}>
            {report.summary.visualConfidenceCalibrationPassed}/{report.summary.visualConfidenceCalibrationTotal} 项已校准
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化置信度校准</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            检查可视化场景和只读探针里的置信度、冲突和老师审查结果是否一致，方便在不验收、不解锁封装的前提下判断学习技术。
          </p>
        </div>
        <Gauge className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">审查阈值</p>
          <p className="mt-1 text-xl font-black text-ink">{percent(calibration.reviewThreshold)}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">自动结果</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualConfidenceAutoReady}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">审查结果</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualConfidenceReviewRequired}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装锁</p>
          <p className="mt-1 text-xl font-black text-ink">{calibration.packagingGated ? "锁定" : "打开"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {calibration.items.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "已对齐" : "需要证据"}</Badge>
              <Badge tone={item.sourceType === "scenario" ? "blue" : "neutral"}>{item.sourceType}</Badge>
              <Badge tone={outcomeTone(item.actualOutcome)}>{outcomeLabel(item.actualOutcome)}</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.label}</p>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">置信度</p>
                <p className="mt-1">平均：{percent(item.averageConfidence)}</p>
                <p>最低：{percent(item.minimumConfidence)}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">结果对齐</p>
                <p className="mt-1">预期：{outcomeLabel(item.expectedOutcome)}</p>
                <p>冲突：{item.conflictedDecisions}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{item.evidence}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-teal-50 p-3 text-sm leading-6 text-teal-900">
          <p className="font-extrabold text-teal-950">审查期间允许</p>
          <p className="mt-1">{calibration.allowedActions.join(" / ")}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-3 text-sm leading-6 text-blue-900">
          <p className="font-extrabold text-blue-950">仍然锁定</p>
          <p className="mt-1">{calibration.blockedActions.join(" / ")}</p>
        </div>
      </div>
    </Surface>
  );
}
