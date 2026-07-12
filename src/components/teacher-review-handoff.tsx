import Link from "next/link";
import { ClipboardCheck, ExternalLink, LockKeyhole } from "lucide-react";
import { visualLearningAcceptanceGate } from "@/lib/teacher-acceptance";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

type ReviewLink = {
  label: string;
  description: string;
  href: string;
};

export function TeacherReviewHandoff({
  taskId,
  report
}: Readonly<{
  taskId: string;
  report: QualificationReport;
}>) {
  const learningDelta = report.learningDeltas[0];
  const reviewLinks: ReviewLink[] = [
    {
      label: "任务证据总览",
      description: "在当前任务页检查完整的可视化学习证据。",
      href: `/tasks/${taskId}`
    },
    {
      label: "可视化带教流程",
      description: "检查流程画布、可教学节点和节点校验规则。",
      href: `/tasks/${taskId}/teach`
    },
    {
      label: "学习前执行记录",
      description: "查看 golden hour 纠错前的基线执行。",
      href: learningDelta?.sourceRunId ? `/runs/${learningDelta.sourceRunId}` : `/tasks/${taskId}/run`
    },
    {
      label: "学习后执行记录",
      description: "查看已学习记忆如何改变下一次输出。",
      href: learningDelta?.appliedRunId ? `/runs/${learningDelta.appliedRunId}` : `/tasks/${taskId}/run`
    },
    {
      label: "资格报告 JSON",
      description: "打开机器可读的证据报告，方便 MCP 或自动审计工具复查。",
      href: `/api/tasks/${taskId}/qualification`
    }
  ];

  return (
    <Surface className="border-apprentice-blue/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="blue">老师审查入口</Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">先审查可视化学习，再谈封装</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这里集中放你判断“AI 学徒是否学会了”的入口。它只帮助审查，不记录技术验收，不解锁封装，也不启动发布工作。
          </p>
        </div>
        <ClipboardCheck className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3 md:grid-cols-2">
          {reviewLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="group min-w-0 rounded-md border border-line bg-mist p-3 text-sm transition hover:border-apprentice-blue/40 hover:bg-white"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-extrabold text-ink">{item.label}</span>
                <ExternalLink className="mt-0.5 size-4 shrink-0 text-slate-400 transition group-hover:text-apprentice-blue" />
              </span>
              <span className="mt-2 block break-words text-xs leading-5 text-slate-600">{item.description}</span>
            </Link>
          ))}
        </div>

        <aside className="rounded-md border border-amber-100 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-extrabold">{visualLearningAcceptanceGate.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="amber">等待老师确认</Badge>
                <Badge tone="neutral">已验收：{visualLearningAcceptanceGate.accepted ? "是" : "否"}</Badge>
              </div>
              <p className="mt-3 leading-6">{visualLearningAcceptanceGate.reason}</p>
              <div className="mt-4 rounded-md bg-white/70 p-3 font-mono text-xs text-amber-950">
                npm run verify:learning
              </div>
              <p className="mt-2 text-xs leading-5">
                你可以先用这个命令复现学习验证结果；只有你在对话里明确确认技术合格后，才允许继续推进封装。
              </p>
            </div>
          </div>
        </aside>
      </div>
    </Surface>
  );
}
