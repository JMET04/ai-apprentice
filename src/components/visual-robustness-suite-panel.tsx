import { ShieldAlert } from "lucide-react";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function stressTone(stressType: string): "neutral" | "teal" | "amber" | "blue" {
  return stressType === "positive_paraphrase" ? "teal" : "amber";
}

function stressLabel(stressType: string) {
  const labels: Record<string, string> = {
    positive_paraphrase: "正向改写",
    false_positive_guard: "误判防线"
  };
  return labels[stressType] ?? stressType.replace("_", " ");
}

export function VisualRobustnessSuitePanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const suite = report.visualRobustnessSuite;

  return (
    <Surface className="border-amber-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={suite.passed === suite.total ? "teal" : "amber"}>
            {suite.passed}/{suite.total} 个鲁棒性案例
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">可视化鲁棒性压力套件</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            只供审查的压力案例，用来检查改写迁移和误判防线：记忆既要能泛化，也不能把错误光线语境里的线索词误当成规则。
          </p>
        </div>
        <ShieldAlert className="size-5 text-amber-600" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">误判防线</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualRobustnessFalsePositiveGuards}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">正向改写</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.visualRobustnessPositiveParaphrases}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">是否验收</p>
          <p className="mt-1 text-xl font-black text-ink">{suite.accepted ? "是" : "否"}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">封装锁</p>
          <p className="mt-1 text-xl font-black text-ink">{suite.packagingGated ? "锁定" : "打开"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {suite.cases.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.passed ? "teal" : "amber"}>{item.passed ? "已通过" : "需要证据"}</Badge>
              <Badge tone={stressTone(item.stressType)}>{stressLabel(item.stressType)}</Badge>
              <Badge tone={item.needsReview ? "amber" : "teal"}>
                {item.needsReview ? "老师审查" : "自动执行"}
              </Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{item.label}</p>
            <p className="mt-2 break-words text-xs leading-5 text-slate-600">{item.input}</p>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">预期</p>
                <p className="mt-1">{item.expectedLighting}</p>
                <p>{item.expectedReview ? "老师审查" : "自动执行"}</p>
              </div>
              <div className="rounded-md bg-white p-2">
                <p className="font-bold text-ink">实际</p>
                <p className="mt-1">{item.actualLighting}</p>
                <p>{item.changedByMemory ? "被记忆改变" : "保持保守"}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{item.evidence}</p>
            <div className="mt-3 grid gap-2">
              {item.decisions.map((decision, index) => (
                <div key={`${item.id}-${decision.title}-${index}`} className="rounded-md bg-white p-2 text-xs leading-5 text-slate-600">
                  <p className="font-bold text-ink">{decision.title}</p>
                  <p className="mt-1">{decision.decision}</p>
                  <p>匹配：{decision.matchedCues.join(", ") || "无"}</p>
                  <p>反例：{decision.counterCues.join(", ") || "无"}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
