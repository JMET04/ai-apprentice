import Link from "next/link";
import { ArrowRight, BrainCircuit, CheckCircle2, GitPullRequestArrow, ListChecks } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

export function LearningCausalityMap({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const delta = report.learningDeltas[0];

  return (
    <Surface className="border-teal-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={delta ? "teal" : "amber"}>{delta ? "因果学习证据" : "等待学习证据"}</Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化学习因果图</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            从老师纠正，到可复用规则，再到下一次输出改变。这里只展示公开结构化证据，不展示私有思维链。
          </p>
        </div>
        <BrainCircuit className="size-5 text-apprentice-teal" />
      </div>

      {delta ? (
        <>
          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <article className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="flex items-center gap-2">
                <GitPullRequestArrow className="size-4" />
                <p className="font-extrabold">老师纠正</p>
              </div>
              <p className="mt-2 leading-6">纠正记录 {delta.correctionId} 提供了可复用反馈。</p>
              {delta.sourceRunId ? (
                <Link href={`/runs/${delta.sourceRunId}`} className="mt-3 inline-flex text-xs font-bold text-amber-800">
                  查看来源运行
                </Link>
              ) : null}
            </article>

            <div className="hidden items-center justify-center lg:flex">
              <ArrowRight className="size-5 text-apprentice-teal" />
            </div>

            <article className="rounded-md border border-teal-100 bg-teal-50 p-3 text-sm text-teal-950">
              <div className="flex items-center gap-2">
                <ListChecks className="size-4" />
                <p className="font-extrabold">可复用规则</p>
              </div>
              <p className="mt-2 leading-6">{delta.ruleTitle}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {delta.changedFields.map((field) => (
                  <Badge key={field} tone="teal">{field}</Badge>
                ))}
              </div>
            </article>

            <div className="hidden items-center justify-center lg:flex">
              <ArrowRight className="size-5 text-apprentice-teal" />
            </div>

            <article className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                <p className="font-extrabold">下一次运行已改变</p>
              </div>
              <p className="mt-2 leading-6">{delta.memoryEvidence}</p>
              {delta.appliedRunId ? (
                <Link href={`/runs/${delta.appliedRunId}`} className="mt-3 inline-flex text-xs font-bold text-blue-800">
                  回放已学习的运行
                </Link>
              ) : null}
            </article>
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-line">
            <div className="grid bg-mist px-3 py-2 text-xs font-bold uppercase text-slate-500 md:grid-cols-[160px_1fr_1fr]">
              <span>输出字段</span>
              <span>带教前</span>
              <span>应用记忆后</span>
            </div>
            {delta.fieldChanges.map((change) => (
              <div
                key={change.field}
                className="grid gap-2 border-t border-line bg-white px-3 py-3 text-sm md:grid-cols-[160px_1fr_1fr]"
              >
                <p className="font-extrabold text-ink">{change.field}</p>
                <p className="break-words rounded-md bg-amber-50 p-2 text-amber-950">{change.before}</p>
                <p className="break-words rounded-md bg-teal-50 p-2 text-teal-950">{change.after}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-5 rounded-md border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          还没有证明带教前后的学习变化。先保存一次纠正，再重新运行任务，这张图会展示记忆如何改变下一次执行。
        </p>
      )}
    </Surface>
  );
}
