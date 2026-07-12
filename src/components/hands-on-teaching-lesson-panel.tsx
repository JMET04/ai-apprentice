"use client";

import { GraduationCap, Link2, LockKeyhole, MapPin, PlayCircle } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function phaseLabel(phase: string) {
  const labels: Record<string, string> = {
    domain_orientation: "领域预习",
    teacher_instruction: "老师输入",
    code_coordinate: "三维坐标",
    model_fit: "数学拟合",
    next_move_prediction: "下一手预测",
    teacher_correction: "逐步纠正",
    memory_replay: "记忆回放"
  };

  return labels[phase] ?? phase;
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "开始一堂带教课": "开始一堂带教课",
    "逐步纠正 AI": "逐步纠正 AI",
    "重新运行本地验证": "重新运行本地验证",
    "Accept technology": "确认技术合格",
    Package: "封装",
    Release: "发布",
    Wrap: "包装交付"
  };

  return labels[action] ?? action;
}

function scrollToAnchor(anchorId: string) {
  document.getElementById(anchorId)?.scrollIntoView?.({ behavior: "smooth" });
}

const quickJumpEntries: { phase: string; label: string; anchor: string }[] = [
  { phase: "domain_orientation", label: "领域预习", anchor: "teach-domain-brief" },
  { phase: "teacher_instruction", label: "老师输入", anchor: "teach-domain-brief" },
  { phase: "code_coordinate", label: "三维坐标", anchor: "teach-3d-coordinates" },
  { phase: "model_fit", label: "数学拟合", anchor: "teach-fit-candidates" },
  { phase: "next_move_prediction", label: "下一手预测", anchor: "teach-next-move" },
  { phase: "teacher_correction", label: "逐步纠正", anchor: "teach-fit-candidates" },
  { phase: "memory_replay", label: "记忆回放", anchor: "teach-memory-replay" }
];

export function HandsOnTeachingLessonPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const lesson = report.handsOnTeachingLesson;
  const runbook = lesson.runbook;

  return (
    <Surface className="border-apprentice-teal/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={lesson.status === "ready_for_teacher_review" ? "teal" : "amber"}>
              {report.summary.handsOnTeachingLessonReady + report.summary.handsOnTeachingLessonLocked}/
              {report.summary.handsOnTeachingLessonSteps} 步可演练
            </Badge>
            <Badge tone="blue">review-only</Badge>
            <Badge tone="blue">封装锁定</Badge>
          </div>
          <h3 className="mt-3 text-lg font-extrabold text-ink">中文带教课时演练</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{lesson.startPrompt}</p>
        </div>
        <GraduationCap className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-4 rounded-md border border-apprentice-teal/30 bg-teal-50/60 p-4">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-apprentice-teal" />
          <p className="text-xs font-bold uppercase text-teal-800">从这里开始教</p>
        </div>
        <p className="mt-1 text-xs leading-5 text-teal-700">
          点击下方快捷入口，直接跳转到对应带教面板。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickJumpEntries
            .filter((entry, index, array) => array.findIndex((e) => e.anchor === entry.anchor) === index)
            .map((entry) => (
              <button
                key={entry.anchor}
                type="button"
                onClick={() => scrollToAnchor(entry.anchor)}
                className="rounded-md border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-teal-700 transition hover:border-apprentice-teal hover:bg-teal-100 hover:text-teal-900"
              >
                <Link2 className="mr-1 inline-block size-3" />
                {quickJumpEntries
                  .filter((e) => e.anchor === entry.anchor)
                  .map((e) => e.label)
                  .join(" / ")}
              </button>
            ))}
        </div>
      </div>

      <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">{runbook.mode}</Badge>
              <Badge tone="neutral">{runbook.format}</Badge>
              <Badge tone="amber">accepted=false</Badge>
              <Badge tone="amber">packagingGated=true</Badge>
            </div>
            <h4 className="mt-3 text-base font-extrabold text-ink">Hands-on lesson runbook</h4>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-950">{runbook.teacherQuestion}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right text-xs text-blue-950">
            <p>
              steps
              <span className="ml-2 text-lg font-black text-ink">{runbook.items.length}</span>
            </p>
            <p>
              ready
              <span className="ml-2 text-lg font-black text-ink">{runbook.readySteps}</span>
            </p>
            <p>
              locked
              <span className="ml-2 text-lg font-black text-ink">{runbook.lockedSteps}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="grid gap-2">
            {runbook.items.map((item) => (
              <button
                key={item.stepId}
                type="button"
                onClick={() => scrollToAnchor(item.anchorId)}
                className="rounded-md border border-blue-200 bg-white p-3 text-left text-xs leading-5 text-slate-700 transition hover:border-apprentice-blue hover:bg-blue-50"
              >
                <span className="font-extrabold text-ink">
                  {item.order}. {phaseLabel(item.phase)}
                </span>
                <span className="ml-2 font-mono text-slate-500">{item.evidencePath}</span>
                <span className="mt-1 block font-bold text-blue-950">{item.correctionCheckpoint}</span>
              </button>
            ))}
          </div>
          <textarea
            aria-label="hands_on_teaching_lesson_runbook_json_v1"
            className="min-h-64 w-full resize-y rounded-md border border-blue-200 bg-white p-3 font-mono text-xs leading-5 text-slate-700 outline-none"
            readOnly
            value={runbook.exportJson}
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
            <p className="font-extrabold text-ink">Allowed actions</p>
            <p className="mt-1">{runbook.allowedActions.join(" / ")}</p>
          </div>
          <div className="rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
            <p className="font-extrabold text-ink">Blocked actions</p>
            <p className="mt-1">{runbook.blockedActions.join(" / ")}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {lesson.steps.map((step) => (
          <article key={step.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={step.passed ? "teal" : "amber"}>
                第 {step.order} 步 · {phaseLabel(step.phase)}
              </Badge>
              <Badge tone={step.reviewState === "locked_until_teacher_acceptance" ? "blue" : "neutral"}>
                {step.reviewState === "locked_until_teacher_acceptance" ? "确认前锁定" : "等待老师审查"}
              </Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{step.label}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
                <p className="font-extrabold text-ink">老师可以这样教</p>
                <p className="mt-1">{step.teacherCanDo}</p>
              </div>
              <div className="rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
                <p className="font-extrabold text-ink">AI 会这样回应</p>
                <p className="mt-1">{step.apprenticeWillDo}</p>
              </div>
            </div>
            <div className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
              <div className="flex items-center gap-2 font-extrabold text-ink">
                <PlayCircle className="size-4 text-apprentice-teal" />
                为什么这一步这样生成
              </div>
              <p className="mt-1">{step.whyThisStep}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{step.visibleEvidence}</p>
              {step.panelAnchorId ? (
                <button
                  type="button"
                  onClick={() => scrollToAnchor(step.panelAnchorId)}
                  className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-xs font-bold text-slate-600 transition hover:border-apprentice-teal hover:text-apprentice-teal"
                >
                  <Link2 className="size-3" />
                  {step.evidencePath}
                </button>
              ) : (
                <Badge tone="neutral">{step.evidencePath}</Badge>
              )}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">
              <span className="font-extrabold text-ink">老师纠正点：</span>
              {step.correctionPoint}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-teal-50 p-3 text-sm leading-6 text-teal-900">
          <p className="font-extrabold text-teal-950">审查期间允许</p>
          <p className="mt-1">{lesson.allowedActions.map(actionLabel).join(" / ")}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-3 text-sm leading-6 text-blue-900">
          <div className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-apprentice-blue" />
            <p className="font-extrabold text-blue-950">仍然禁止</p>
          </div>
          <p className="mt-1">{lesson.blockedActions.map(actionLabel).join(" / ")}</p>
        </div>
      </div>
    </Surface>
  );
}
