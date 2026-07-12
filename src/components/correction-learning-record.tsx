import { ClipboardCheck, PauseCircle, PlayCircle } from "lucide-react";
import type { CorrectionExtraction } from "@/lib/types";
import { LearningExtractionTrace } from "./learning-extraction-trace";
import { Badge } from "./ui";

export function CorrectionLearningRecord({
  extraction,
  taskId,
  sourceRunId,
  title = "结构化纠错学习记录"
}: Readonly<{
  extraction: CorrectionExtraction;
  taskId: string;
  sourceRunId: string;
  title?: string;
}>) {
  const isLongTermRule = extraction.extractedRule.enabled;

  return (
    <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50 p-4 text-sm text-teal-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="teal">纠错已转换成可复用记忆</Badge>
          <p className="mt-2 font-extrabold">{title}</p>
          <p className="mt-1 text-xs leading-5 text-teal-800">
            这是一条给老师审查的公开学习记录。它会保存学徒以后复用规则前必须看得懂的纠错字段。
          </p>
        </div>
        <ClipboardCheck className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-white p-3">
          <p className="text-xs font-bold uppercase text-teal-700">错误类型</p>
          <p className="mt-1 break-words font-bold text-ink">{extraction.errorType}</p>
        </div>
        <div className="rounded-md bg-white p-3">
          <p className="text-xs font-bold uppercase text-teal-700">错误原因</p>
          <p className="mt-1 break-words text-slate-700">{extraction.errorReason}</p>
        </div>
        <div className="rounded-md bg-white p-3">
          <p className="text-xs font-bold uppercase text-teal-700">适用条件</p>
          <p className="mt-1 break-words text-slate-700">{extraction.condition}</p>
        </div>
        <div className="rounded-md bg-white p-3">
          <p className="text-xs font-bold uppercase text-teal-700">纠正后的规则动作</p>
          <p className="mt-1 break-words text-slate-700">{extraction.action}</p>
        </div>
        <div className="rounded-md bg-white p-3">
          <p className="text-xs font-bold uppercase text-teal-700">关联任务和来源运行</p>
          <p className="mt-1 break-words font-mono text-xs text-slate-700">
            task={taskId}
            <br />
            run={sourceRunId}
          </p>
        </div>
        <div className="rounded-md bg-white p-3">
          <p className="text-xs font-bold uppercase text-teal-700">未来应用策略</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={extraction.applyAutomatically ? "teal" : "amber"}>
              {extraction.applyAutomatically ? "以后自动应用" : "先问老师"}
            </Badge>
            <Badge tone={extraction.requiresHumanConfirmation ? "amber" : "teal"}>
              {extraction.requiresHumanConfirmation ? "需要老师确认" : "不需要额外确认"}
            </Badge>
            <Badge tone={isLongTermRule ? "teal" : "neutral"}>
              {isLongTermRule ? "已存为长期规则" : "已保存但暂停审查"}
            </Badge>
          </div>
          <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-teal-800">
            {isLongTermRule ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
            {isLongTermRule
              ? "这条规则已进入记忆，会影响下一次运行。"
              : "这条规则已保存，但会暂停到老师审查后再启用。"}
          </p>
        </div>
      </div>

      <LearningExtractionTrace trace={extraction.learningTrace} />
    </div>
  );
}
