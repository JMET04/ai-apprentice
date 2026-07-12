import Link from "next/link";
import { CheckCircle2, ClipboardList, CircleAlert } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function reviewLabel(id: string, fallback: string) {
  const labels: Record<string, string> = {
    "mvp-create-apprentice": "已创建 AI 学徒",
    "mvp-create-task": "已创建可教学任务",
    "mvp-visual-workflow": "已建立可视化教学流程",
    "mvp-execute-task": "已执行任务",
    "mvp-structured-trace": "已展示结构化执行追踪",
    "mvp-correct-output": "已保存老师纠错",
    "mvp-extract-rules": "纠错已沉淀为规则",
    "mvp-apply-next-run": "下一次执行会参考学习记录",
    "demo-photography-journal": "摄影游记 demo 已覆盖",
    "multi-source-learning": "多来源学习证据已保存",
    "guardrails-visible": "边界和防误用证据可见",
    "packaging-waits-for-teacher": "封装等待老师确认"
  };

  return labels[id] ?? fallback;
}

export function TeacherReviewChecklistPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const complete = report.summary.teacherReviewChecklistPassed === report.summary.teacherReviewChecklistTotal;

  return (
    <Surface className="border-apprentice-blue/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={complete ? "teal" : "amber"}>
            {report.summary.teacherReviewChecklistPassed}/{report.summary.teacherReviewChecklistTotal} 个审查项
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">老师验收审查清单</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            这是只读清单，用来判断可视化 AI 学习技术是否足够好。它不会记录系统已验收，也不会解锁封装。
          </p>
        </div>
        <ClipboardList className="size-5 text-apprentice-blue" />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {report.teacherReviewChecklist.map((item) => (
          <article key={item.id} className="min-w-0 rounded-md border border-line bg-mist p-3 text-sm">
            <div className="flex items-start gap-2">
              {item.passed ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-apprentice-teal" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-apprentice-amber" />
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-extrabold text-ink">{reviewLabel(item.id, item.label)}</p>
                  <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "证据就绪" : "需要补证据"}</Badge>
                </div>
                <p className="mt-2 break-words text-xs leading-5 text-slate-600">{item.evidence}</p>
                {item.href ? (
                  <Link href={item.href} className="mt-2 inline-flex text-xs font-bold text-apprentice-blue">
                    查看证据
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
