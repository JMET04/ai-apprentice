import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, Route } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

const phaseTone: Record<string, "blue" | "teal" | "amber" | "neutral"> = {
  teach: "blue",
  execute: "neutral",
  correct: "amber",
  extract: "teal",
  improve: "teal",
  review: "blue"
};

function phaseLabel(phase: string) {
  const labels: Record<string, string> = {
    teach: "带教",
    execute: "执行",
    correct: "纠错",
    extract: "抽取",
    improve: "改进",
    review: "审查"
  };

  return labels[phase] ?? phase;
}

export function LearningLoopTimelinePanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const complete = report.summary.learningLoopTimelinePassed === report.summary.learningLoopTimelineTotal;

  return (
    <Surface className="border-teal-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={complete ? "teal" : "amber"}>
            闭环阶段 {report.summary.learningLoopTimelinePassed}/{report.summary.learningLoopTimelineTotal}
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可见学习闭环时间线</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这里把完整学徒闭环作为证据展示：人类带教、基线执行、老师纠错、规则抽取、
            改进后的执行，以及老师最终审查。
          </p>
        </div>
        <Route className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-6">
        {report.learningLoopTimeline.map((item, index) => (
          <article key={item.id} className="min-w-0 rounded-md border border-line bg-mist p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <Badge tone={phaseTone[item.phase] ?? "neutral"}>{phaseLabel(item.phase)}</Badge>
              {item.passed ? (
                <CheckCircle2 className="size-4 shrink-0 text-apprentice-teal" />
              ) : (
                <CircleAlert className="size-4 shrink-0 text-apprentice-amber" />
              )}
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.label}</p>
            <p className="mt-2 break-words text-xs leading-5 text-slate-600">{item.evidence}</p>
            {item.href ? (
              <Link href={item.href} className="mt-3 inline-flex text-xs font-bold text-apprentice-blue">
                查看证据
              </Link>
            ) : null}
            {index < report.learningLoopTimeline.length - 1 ? (
              <div className="mt-3 hidden justify-end xl:flex">
                <ArrowRight className="size-4 text-apprentice-teal" />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </Surface>
  );
}
