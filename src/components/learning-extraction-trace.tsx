import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { LearningExtractionStep } from "@/lib/types";
import { Badge } from "./ui";

export function LearningExtractionTrace({ trace }: Readonly<{ trace: LearningExtractionStep[] }>) {
  if (trace.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-md bg-white p-3">
      <p className="text-xs font-bold uppercase text-slate-500">学习抽取追踪</p>
      <div className="mt-2 space-y-2">
        {trace.map((step, index) => (
          <article key={step.id} className="rounded-md bg-mist p-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-500">第 {index + 1} 步</p>
                <p className="font-bold text-ink">{step.label}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={step.needsHumanReview ? "amber" : "teal"}>
                  {step.needsHumanReview ? "需要老师" : "已通过"}
                </Badge>
                <Badge tone="blue">{Math.round(step.confidence * 100)}%</Badge>
              </div>
            </div>
            <p className="mt-2 break-words text-xs leading-5 text-slate-700">{step.evidence}</p>
            <p className="mt-2 inline-flex max-w-full items-center gap-1 break-words rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600">
              {step.needsHumanReview ? <AlertTriangle className="size-3" /> : <CheckCircle2 className="size-3" />}
              {step.validation}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
