import Link from "next/link";
import { ArrowRight, BookOpenCheck, Eye, GitPullRequestArrow, History, Presentation } from "lucide-react";
import type { ExecutionOutput, LearningExtractionStep, RuleRecord, VisualCueAnnotation } from "@/lib/types";
import { LearningExtractionTrace } from "./learning-extraction-trace";
import { RuleMemoryControl } from "./rule-memory-control";
import { Badge, Surface } from "./ui";
import { VisualDemonstrationForm } from "./visual-demonstration-form";

type EvidenceRun = {
  id: string;
  status: string;
  createdAt: string;
  output: ExecutionOutput | null;
  reviewPoints: number;
  appliedRuleTitles: string[];
  traceStepCount: number;
  hasWorkflowNodeTrace: boolean;
  hasValidationEvidence: boolean;
};

type EvidenceCorrection = {
  id: string;
  feedback: string;
  errorType: string;
  createdAt: string;
  runId: string | null;
  extractedRuleTitle: string;
  extractedRuleEnabled: boolean;
  extractedRuleConfidence: number | null;
  beforeSummary: string;
  afterSummary: string;
  learningTrace: LearningExtractionStep[];
};

type EvidenceExample = {
  id: string;
  input: string;
  expectedOutput: Record<string, unknown>;
  extractedRuleTitle: string | null;
  learningTrace: LearningExtractionStep[];
  createdAt: string;
};

type EvidenceVisualDemonstration = {
  id: string;
  title: string;
  referenceImageUrl?: string;
  sceneDescription: string;
  visualCues: string[];
  annotations: VisualCueAnnotation[];
  lightingSignals: string[];
  expectedPhotographyAdvice: string[];
  teacherNotes: string;
  extractedRuleTitle: string | null;
  learningTrace: LearningExtractionStep[];
  createdAt: string;
};

type EvidenceLearningDelta = {
  id: string;
  correctionId: string;
  ruleTitle: string;
  beforeLighting: string;
  afterLighting: string;
  changedFields: string[];
  sourceRunId: string | null;
  appliedRunId: string | null;
  memoryEvidence: string;
};

function statusLabel(status: string) {
  if (status === "needs_review") {
    return "需要老师审查";
  }

  if (status === "completed") {
    return "已完成";
  }

  return status.replace("_", " ");
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    manual: "老师手动规则",
    correction: "纠错记忆",
    example: "示例记忆",
    visual_demonstration: "视觉示范",
    execution_history: "执行历史"
  };

  return labels[source] ?? source;
}

export function LearningEvidencePanel({
  apprenticeId,
  taskId,
  rules,
  corrections,
  examples,
  visualDemonstrations,
  learningDeltas,
  runs
}: Readonly<{
  apprenticeId: string;
  taskId: string;
  rules: RuleRecord[];
  corrections: EvidenceCorrection[];
  examples: EvidenceExample[];
  visualDemonstrations: EvidenceVisualDemonstration[];
  learningDeltas: EvidenceLearningDelta[];
  runs: EvidenceRun[];
}>) {
  return (
    <Surface>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-ink">学习证据</h3>
          <p className="mt-1 text-sm text-slate-500">
            这里记录这个任务从老师纠错、示例、视觉示范和执行历史中学到了什么。
          </p>
        </div>
        <Link href={`/tasks/${taskId}/run`} className="rounded-md bg-apprentice-teal px-3 py-2 text-xs font-bold text-white">
          运行学习闭环
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <div className="rounded-md border border-line bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">规则记忆</p>
          <p className="mt-1 text-2xl font-black text-ink">{rules.length}</p>
        </div>
        <div className="rounded-md border border-line bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">老师纠错</p>
          <p className="mt-1 text-2xl font-black text-ink">{corrections.length}</p>
        </div>
        <div className="rounded-md border border-line bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">结构化示例</p>
          <p className="mt-1 text-2xl font-black text-ink">{examples.length}</p>
        </div>
        <div className="rounded-md border border-line bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">视觉示范</p>
          <p className="mt-1 text-2xl font-black text-ink">{visualDemonstrations.length}</p>
        </div>
        <div className="rounded-md border border-line bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">可追踪运行</p>
          <p className="mt-1 text-2xl font-black text-ink">{runs.length}</p>
        </div>
      </div>

      <section className="mt-5 rounded-md border border-teal-100 bg-teal-50 p-4">
        <div className="flex items-center gap-2">
          <ArrowRight className="size-4 text-apprentice-teal" />
          <h4 className="text-sm font-extrabold text-teal-950">学习前后变化证据</h4>
        </div>
        <p className="mt-1 text-sm leading-6 text-teal-800">
          用持久化证据证明老师反馈确实改变了后续执行，只展示结构化追踪，不展示私有思维链。
        </p>
        {learningDeltas.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {learningDeltas.slice(0, 2).map((delta) => (
              <article key={delta.id} className="rounded-md bg-white p-3 text-sm text-teal-950">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="teal">学习前 / 学习后</Badge>
                  <Badge tone="neutral">{delta.changedFields.length} 个字段改变</Badge>
                </div>
                <p className="mt-2 font-bold">{delta.ruleTitle}</p>
                <div className="mt-3 grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
                  <div className="rounded-md border border-amber-100 bg-amber-50 p-3">
                    <p className="text-xs font-bold uppercase text-amber-700">带教前</p>
                    <p className="mt-1 font-extrabold text-amber-950">{delta.beforeLighting}</p>
                  </div>
                  <div className="hidden items-center justify-center sm:flex">
                    <ArrowRight className="size-5 text-apprentice-teal" />
                  </div>
                  <div className="rounded-md border border-teal-100 bg-teal-50 p-3">
                    <p className="text-xs font-bold uppercase text-teal-700">应用记忆后</p>
                    <p className="mt-1 font-extrabold text-teal-950">{delta.afterLighting}</p>
                  </div>
                </div>
                <p className="mt-3 leading-6">{delta.memoryEvidence}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {delta.changedFields.map((field) => (
                    <Badge key={field} tone="teal">{field}</Badge>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {delta.sourceRunId ? (
                    <Link
                      href={`/runs/${delta.sourceRunId}`}
                      className="rounded-md bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800"
                    >
                      查看来源纠错运行
                    </Link>
                  ) : null}
                  {delta.appliedRunId ? (
                    <Link
                      href={`/runs/${delta.appliedRunId}`}
                      className="rounded-md bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800"
                    >
                      回放学习后运行
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-md bg-white p-3 text-sm text-teal-800">
            还没有证明学习前后的变化。保存一次纠错并重新运行后，这里会显示哪些输出字段被记忆改变。
          </p>
        )}
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <section>
          <div className="flex items-center gap-2">
            <BookOpenCheck className="size-4 text-apprentice-teal" />
            <h4 className="text-sm font-extrabold text-ink">可复用任务规则</h4>
          </div>
          <div className="mt-3 space-y-2">
            {rules.length > 0 ? (
              rules.slice(0, 4).map((rule) => (
                <article key={rule.id} className="rounded-md bg-teal-50 p-3 text-sm text-teal-950">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{rule.title}</p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge tone={rule.source === "manual" ? "blue" : "neutral"}>{sourceLabel(rule.source)}</Badge>
                      <Badge tone={rule.enabled ? "teal" : "neutral"}>{rule.enabled ? "已启用" : "已暂停"}</Badge>
                      <Badge tone="teal">{Math.round(rule.confidence * 100)}%</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-teal-900">
                    <strong>条件：</strong> {rule.condition}
                  </p>
                  <p className="mt-1 text-teal-900">
                    <strong>动作：</strong> {rule.action}
                  </p>
                  <RuleMemoryControl
                    ruleId={rule.id}
                    enabled={rule.enabled}
                    apprenticeId={rule.apprenticeId}
                    taskId={taskId}
                  />
                </article>
              ))
            ) : (
              <p className="rounded-md bg-mist p-3 text-sm text-slate-600">
                还没有规则记忆。先运行任务，再保存一次老师纠错。
              </p>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2">
            <GitPullRequestArrow className="size-4 text-apprentice-amber" />
            <h4 className="text-sm font-extrabold text-ink">老师纠错</h4>
          </div>
          <div className="mt-3 space-y-2">
            {corrections.length > 0 ? (
              corrections.slice(0, 3).map((correction) => (
                <article key={correction.id} className="rounded-md bg-amber-50 p-3 text-sm text-amber-950">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="amber">{correction.errorType}</Badge>
                    <Badge tone={correction.extractedRuleEnabled ? "teal" : "neutral"}>
                      {correction.extractedRuleEnabled ? "启用记忆" : "暂停记忆"}
                    </Badge>
                    {correction.extractedRuleConfidence !== null ? (
                      <Badge tone="neutral">{Math.round(correction.extractedRuleConfidence * 100)}%</Badge>
                    ) : null}
                    <span className="text-xs text-amber-800">{new Date(correction.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 leading-6">{correction.feedback}</p>
                  <div className="mt-3 grid gap-2">
                    <div className="rounded-md bg-white p-2">
                      <p className="text-xs font-bold uppercase text-amber-700">纠错前</p>
                      <p className="mt-1 break-words text-amber-950">{correction.beforeSummary}</p>
                    </div>
                    <div className="rounded-md bg-white p-2">
                      <p className="text-xs font-bold uppercase text-amber-700">纠错后形成的可复用记忆</p>
                      <p className="mt-1 break-words text-amber-950">{correction.afterSummary}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-bold text-amber-800">抽取规则：{correction.extractedRuleTitle}</p>
                  <LearningExtractionTrace trace={correction.learningTrace} />
                  {correction.runId ? (
                    <Link
                      href={`/runs/${correction.runId}`}
                      className="mt-3 inline-flex rounded-md bg-white px-3 py-1 text-xs font-bold text-amber-800"
                    >
                      打开来源追踪
                    </Link>
                  ) : (
                    <p className="mt-3 rounded-md bg-white px-3 py-2 text-xs font-bold text-amber-800">
                      种子纠错：没有关联来源运行。
                    </p>
                  )}
                </article>
              ))
            ) : (
              <p className="rounded-md bg-mist p-3 text-sm text-slate-600">
                还没有老师纠错被转换成记忆。
              </p>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-apprentice-blue" />
            <h4 className="text-sm font-extrabold text-ink">视觉示范</h4>
          </div>
          <div className="mt-3 space-y-2">
            {visualDemonstrations.length > 0 ? (
              visualDemonstrations.slice(0, 3).map((demo) => (
                <article key={demo.id} className="rounded-md bg-blue-50 p-3 text-sm text-blue-950">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone="blue">参考画面</Badge>
                    <span className="text-xs text-blue-800">{new Date(demo.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 font-bold">{demo.title}</p>
                  {demo.referenceImageUrl ? (
                    <div className="mt-3">
                      <p className="text-xs font-bold uppercase text-blue-700">参考图片</p>
                      <div className="relative mt-1 overflow-hidden rounded-md border border-blue-100 bg-white">
                        <img
                          src={demo.referenceImageUrl}
                          alt={`${demo.title} visual reference`}
                          className="aspect-[16/10] w-full object-cover"
                        />
                        {demo.annotations.map((annotation, index) => (
                          <div
                            key={annotation.id}
                            className="absolute rounded border-2 border-amber-300 bg-amber-300/10"
                            style={{
                              left: `${annotation.region.x}%`,
                              top: `${annotation.region.y}%`,
                              width: `${annotation.region.width}%`,
                              height: `${annotation.region.height}%`
                            }}
                          >
                            <span className="absolute -left-2 -top-2 grid size-5 place-items-center rounded-full bg-amber-300 text-[10px] font-black text-amber-950">
                              {index + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-3 rounded-md bg-white p-3">
                    <p className="text-xs font-bold uppercase text-blue-700">场景</p>
                    <p className="mt-1 leading-6">{demo.sceneDescription}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[...demo.visualCues, ...demo.lightingSignals].slice(0, 8).map((cue) => (
                      <Badge key={cue} tone="blue">{cue}</Badge>
                    ))}
                  </div>
                  {demo.annotations.length > 0 ? (
                    <div className="mt-3 rounded-md bg-white p-3">
                      <p className="text-xs font-bold uppercase text-blue-700">带位置证据的视觉线索</p>
                      <div className="mt-2 space-y-2">
                        {demo.annotations.slice(0, 4).map((annotation, index) => (
                          <p key={annotation.id} className="leading-5">
                            <strong>区域 {index + 1} - {annotation.cue}：</strong> {annotation.evidence}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-2 leading-6">
                    <strong>老师备注：</strong> {demo.teacherNotes}
                  </p>
                  {demo.extractedRuleTitle ? (
                    <p className="mt-2 text-xs font-bold text-blue-800">抽取规则：{demo.extractedRuleTitle}</p>
                  ) : null}
                  <LearningExtractionTrace trace={demo.learningTrace} />
                </article>
              ))
            ) : (
              <p className="rounded-md bg-mist p-3 text-sm text-slate-600">
                还没有保存视觉示范。
              </p>
            )}
            <VisualDemonstrationForm apprenticeId={apprenticeId} taskId={taskId} />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2">
            <Presentation className="size-4 text-apprentice-blue" />
            <h4 className="text-sm font-extrabold text-ink">老师结构化示例</h4>
          </div>
          <div className="mt-3 space-y-2">
            {examples.length > 0 ? (
              examples.slice(0, 3).map((example) => (
                <article key={example.id} className="rounded-md bg-blue-50 p-3 text-sm text-blue-950">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone="blue">示范</Badge>
                    <span className="text-xs text-blue-800">{new Date(example.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 leading-6">
                    <strong>输入：</strong> {example.input}
                  </p>
                  <p className="mt-2 leading-6">
                    <strong>期望输出：</strong> {JSON.stringify(example.expectedOutput)}
                  </p>
                  {example.extractedRuleTitle ? (
                    <p className="mt-2 text-xs font-bold text-blue-800">抽取规则：{example.extractedRuleTitle}</p>
                  ) : null}
                  <LearningExtractionTrace trace={example.learningTrace} />
                </article>
              ))
            ) : (
              <p className="rounded-md bg-mist p-3 text-sm text-slate-600">
                还没有保存老师结构化示例。
              </p>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2">
            <History className="size-4 text-apprentice-blue" />
            <h4 className="text-sm font-extrabold text-ink">执行历史</h4>
          </div>
          <div className="mt-3 space-y-2">
            {runs.length > 0 ? (
              runs.slice(0, 4).map((run) => (
                <article key={run.id} className="rounded-md border border-line bg-mist p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={run.status === "needs_review" ? "amber" : "teal"}>
                      {statusLabel(run.status)}
                    </Badge>
                    <span className="text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p className="text-slate-700">
                      <strong>光线：</strong> {run.output?.lightingCondition ?? "未知"}
                    </p>
                    <p className="text-slate-700">
                      <strong>审查点：</strong> {run.reviewPoints}
                    </p>
                  </div>
                  {run.appliedRuleTitles.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {run.appliedRuleTitles.map((title) => (
                        <Badge key={title} tone="teal">{title}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">这次运行没有应用已学规则。</p>
                  )}
                  <Link
                    href={`/runs/${run.id}`}
                    className="mt-3 inline-flex rounded-md bg-white px-3 py-1 text-xs font-bold text-apprentice-blue"
                  >
                    打开追踪回放
                  </Link>
                </article>
              ))
            ) : (
              <p className="rounded-md bg-mist p-3 text-sm text-slate-600">
                还没有执行历史。第一次透明运行会显示在这里。
              </p>
            )}
          </div>
        </section>
      </div>
    </Surface>
  );
}
