import Link from "next/link";
import { CheckCircle2, Circle, LockKeyhole } from "lucide-react";
import { visualLearningAcceptanceGate } from "@/lib/teacher-acceptance";
import { Badge, Surface } from "./ui";

export type LearningGateStep = {
  label: string;
  evidence: string;
  complete: boolean;
  href?: string;
};

export function LearningLoopGate({
  steps,
  taskId
}: Readonly<{
  steps: LearningGateStep[];
  taskId: string;
}>) {
  const completeCount = steps.filter((step) => step.complete).length;
  const allComplete = completeCount === steps.length;

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={allComplete ? "teal" : "amber"}>
            学习闸门 {completeCount}/{steps.length}
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化学习合格闸门</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            在任何封装工作开始前，这里证明学徒是否已经能被带教、被纠错、被追踪，并在下一次运行中改进。
          </p>
        </div>
        <Link href={`/tasks/${taskId}/run`} className="rounded-md bg-ink px-3 py-2 text-xs font-bold text-white">
          验证运行闭环
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => (
          <article
            key={step.label}
            className="min-w-0 rounded-md border border-line bg-mist p-3 text-sm"
          >
            <div className="flex items-start gap-2">
              {step.complete ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-apprentice-teal" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-slate-400" />
              )}
              <div className="min-w-0">
                <p className="font-extrabold text-ink">{step.label}</p>
                <p className="mt-1 break-words text-xs leading-5 text-slate-600">{step.evidence}</p>
                {step.href ? (
                  <Link href={step.href} className="mt-2 inline-flex text-xs font-bold text-apprentice-blue">
                    查看证据
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-100 bg-amber-50 p-3 text-sm text-amber-950">
        <LockKeyhole className="mt-0.5 size-4 shrink-0" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-extrabold">{visualLearningAcceptanceGate.title}</p>
            <Badge tone="amber">{visualLearningAcceptanceGate.status}</Badge>
            <Badge tone="neutral">已验收：{visualLearningAcceptanceGate.accepted ? "是" : "否"}</Badge>
          </div>
          <p className="mt-1 leading-6">{visualLearningAcceptanceGate.reason}</p>
        </div>
      </div>
    </Surface>
  );
}
