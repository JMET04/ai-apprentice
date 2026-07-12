"use client";

import { useMemo, useState } from "react";
import { BrainCircuit, FlaskConical, Network } from "lucide-react";
import {
  buildDomainTeachingBriefPreview,
  defaultDomainTeachingBriefJson,
  type DomainLearningPhase
} from "@/lib/domain-learning";
import type { AIDomainSelfStudyResult } from "@/lib/domain-ai-service";
import type { QualificationReport } from "@/server/qualification/learning-report";
import { Badge, Surface } from "./ui";

function phaseTone(phase: DomainLearningPhase): "neutral" | "teal" | "amber" | "blue" {
  if (phase === "self_research" || phase === "knowledge_map") {
    return "blue";
  }

  if (phase === "human_ingest") {
    return "teal";
  }

  return "amber";
}

function phaseLabel(phase: DomainLearningPhase) {
  const labels: Record<DomainLearningPhase, string> = {
    self_research: "先自学",
    knowledge_map: "建知识图",
    human_ingest: "吃老师知识",
    guided_generation: "逐步带教"
  };

  return labels[phase];
}

export function DomainLearningWorkflowPanel({
  report
}: Readonly<{
  report: QualificationReport;
}>) {
  const workflow = report.domainLearningWorkflow;
  const replacementReadiness = workflow.aiServiceReplacementReadiness;
  const validationRehearsal = workflow.aiServiceOutputValidationRehearsal;
  const [briefCode, setBriefCode] = useState(defaultDomainTeachingBriefJson());
  const briefPreview = useMemo(() => buildDomainTeachingBriefPreview(briefCode), [briefCode]);

  return (
    <Surface className="border-teal-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={workflow.status === "ready_for_teacher_review" ? "teal" : "amber"}>
            {report.summary.domainLearningStagesReady}/{report.summary.domainLearningStages} 个阶段
          </Badge>
          <h3 className="mt-3 text-lg font-extrabold text-ink">领域学习工作流</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            AI 先自己梳理领域重点，建立知识体系，再吸收人类给的资料，最后进入一步一步的带教生成。
            每一步都会说明为什么这样生成，并预测下一步要做什么，方便老师及时纠正。
          </p>
        </div>
        <BrainCircuit className="size-5 text-apprentice-teal" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">学习重点</p>
          <p className="mt-1 text-xl font-black text-ink">{workflow.focusAreas.length}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">知识节点</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.domainKnowledgeNodes}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">带教步骤</p>
          <p className="mt-1 text-xl font-black text-ink">{report.summary.domainGuidedGenerationSteps}</p>
        </div>
        <div className="rounded-md bg-mist p-3">
          <p className="text-xs font-bold uppercase text-slate-500">已验收</p>
          <p className="mt-1 text-xl font-black text-ink">{workflow.accepted ? "是" : "否"}</p>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-teal-100 bg-teal-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal">可编辑领域学习 brief</Badge>
          <Badge tone="neutral">先自学再请教</Badge>
          <Badge tone="neutral">{briefPreview.packagingGated ? "封装锁定" : "封装打开"}</Badge>
        </div>
        <p className="mt-2 text-xs leading-5 text-teal-900">
          老师可以直接改这段 JSON，让 AI 重新决定学习重点、知识节点和第一步带教方式。这里仍然只是本地预演：
          不验收技术、不保存长期规则、不解锁封装。
        </p>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <label className="min-w-0">
            <span className="text-xs font-bold uppercase text-teal-800">老师给 AI 的领域学习代码</span>
            <textarea
              value={briefCode}
              onChange={(event) => setBriefCode(event.target.value)}
              spellCheck={false}
              className="mt-2 h-72 w-full resize-y rounded-md border border-teal-200 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 outline-none transition focus:border-apprentice-teal focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <div className="min-w-0">
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">重排重点</p>
                <p className="mt-1 text-xl font-black text-ink">{briefPreview.focusAreas.length}</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">知识节点</p>
                <p className="mt-1 text-xl font-black text-ink">{briefPreview.knowledgeNodes.length}</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">验收状态</p>
                <p className="mt-1 text-xl font-black text-ink">{briefPreview.accepted ? "是" : "否"}</p>
              </div>
            </div>

            {briefPreview.error ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                {briefPreview.error}
              </p>
            ) : null}

            <p className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-teal-950">
              {briefPreview.teacherQuestion}
            </p>

            <div className="mt-3 grid gap-2">
              {briefPreview.focusAreas.slice(0, 7).map((item) => (
                <p key={item} className="rounded-md bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-700">
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {briefPreview.guidedSteps.map((step) => (
            <article key={step.id} className="rounded-md border border-teal-100 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="amber">等待老师审查</Badge>
                <Badge tone={step.passed ? "teal" : "amber"}>{step.passed ? "可预演" : "需修正"}</Badge>
              </div>
              <p className="mt-2 font-extrabold text-ink">{step.label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-700">{step.proposedOutput}</p>
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">为什么这样生成</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{step.whyThisStep}</p>
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">下一步预测</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{step.nextStepPrediction}</p>
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">老师纠正点</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{step.teacherCorrectionSlot}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {workflow.stages.map((stage) => (
          <article key={stage.id} className="rounded-md border border-line bg-mist p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={stage.passed ? "teal" : "amber"}>{stage.passed ? "已就绪" : "需要证据"}</Badge>
              <Badge tone={phaseTone(stage.phase)}>{phaseLabel(stage.phase)}</Badge>
            </div>
            <p className="mt-3 font-extrabold text-ink">{stage.label}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{stage.goal}</p>
            <div className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
              <p className="font-bold text-ink">本阶段输出</p>
              <p className="mt-1">{stage.output}</p>
              <p className="mt-2 font-bold text-ink">人类审查点</p>
              <p className="mt-1">{stage.humanReviewPoint}</p>
            </div>
          </article>
        ))}
      </div>

      {(() => {
        const selfStudy: AIDomainSelfStudyResult | undefined =
          briefPreview.aiSelfStudy ?? workflow.aiSelfStudyResult;
        if (!selfStudy) return null;
        return (
          <div className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <FlaskConical className="size-4 text-apprentice-blue" />
              <Badge tone="blue">AI 自学主题建议</Badge>
              <Badge tone="neutral">{selfStudy.topics.length} 个自学主题</Badge>
              <Badge tone="neutral">reviewOnly</Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-blue-800">
              以下自学主题由 AI 自学服务生成。当前为 mock 服务，不连接外部模型；未来可替换为真实 LLM 调用。
              所有主题保持 accepted=false、packagingGated=true、reviewOnly=true。
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{selfStudy.note}</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {selfStudy.topics.map((topic) => (
                <article key={topic.id} className="rounded-md border border-blue-100 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">自学主题</Badge>
                    <Badge tone={topic.packagingGated ? "neutral" : "amber"}>
                      {topic.packagingGated ? "封装锁定" : "封装打开"}
                    </Badge>
                  </div>
                  <p className="mt-2 font-extrabold text-ink">{topic.label}</p>
                  <div className="mt-2 space-y-2 text-xs leading-5 text-slate-700">
                    <div className="rounded-md bg-blue-50/60 p-2">
                      <p className="font-bold text-blue-900">为什么要学</p>
                      <p className="mt-1">{topic.whyToLearn}</p>
                    </div>
                    <div className="rounded-md bg-amber-50/60 p-2">
                      <p className="font-bold text-amber-900">可能误区</p>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">
                        {topic.possibleMistakes.map((mistake, idx) => (
                          <li key={idx}>{mistake}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-md bg-teal-50/60 p-2">
                      <p className="font-bold text-teal-900">老师确认问题</p>
                      <p className="mt-1">{topic.teacherConfirmationQuestion}</p>
                    </div>
                    <div className="rounded-md bg-mist p-2">
                      <p className="font-bold text-slate-900">进入人类带教前的通过标准</p>
                      <p className="mt-1">{topic.passCriteria}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="mt-5 rounded-md border border-amber-100 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <FlaskConical className="size-4 text-amber-700" />
          <Badge tone="amber">AI service replacement readiness</Badge>
          <Badge tone="neutral">{replacementReadiness.mode}</Badge>
          <Badge tone="neutral">
            {replacementReadiness.externalCallsEnabled ? "external calls on" : "external calls blocked"}
          </Badge>
          <Badge tone={replacementReadiness.packagingGated ? "neutral" : "amber"}>
            {replacementReadiness.packagingGated ? "packaging gated" : "packaging open"}
          </Badge>
        </div>
        <p className="mt-2 text-xs leading-5 text-amber-900">
          This review checks whether the mock self-study service can be replaced behind the same service interface
          without enabling rules, recording acceptance, or opening packaging.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">schema checks</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.aiServiceReplacementSchemaChecks}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">replacement steps</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.aiServiceReplacementSteps}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">ready</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.aiServiceReplacementReady}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            {replacementReadiness.schemaChecks.map((check) => (
              <article key={check.id} className="rounded-md border border-amber-100 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={check.passed ? "teal" : "amber"}>{check.passed ? "passed" : "needs evidence"}</Badge>
                  <Badge tone="neutral">{check.id}</Badge>
                </div>
                <p className="mt-2 font-extrabold text-ink">{check.label}</p>
                <p className="mt-2 text-xs leading-5 text-slate-700">{check.expectedEvidence}</p>
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                  {check.currentEvidence}
                </p>
              </article>
            ))}
          </div>

          <div className="space-y-2">
            {replacementReadiness.replacementSteps.map((step) => (
              <article key={step.id} className="rounded-md border border-amber-100 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={step.passed ? "teal" : "amber"}>{step.passed ? "passed" : "needs evidence"}</Badge>
                  <Badge tone="neutral">{step.id}</Badge>
                </div>
                <p className="mt-2 font-extrabold text-ink">{step.label}</p>
                <p className="mt-2 text-xs leading-5 text-slate-700">{step.realModelRequirement}</p>
                <p className="mt-2 text-xs font-bold uppercase text-slate-500">teacher review point</p>
                <p className="mt-1 text-xs leading-5 text-slate-700">{step.teacherReviewPoint}</p>
                <p className="mt-2 text-xs font-bold uppercase text-slate-500">blocked until</p>
                <p className="mt-1 text-xs leading-5 text-slate-700">{step.blockedUntil}</p>
              </article>
            ))}
          </div>
        </div>

        <textarea
          aria-label="ai_service_replacement_readiness_json_v1"
          readOnly
          value={JSON.stringify(replacementReadiness, null, 2)}
          className="mt-3 h-56 w-full resize-y rounded-md border border-amber-200 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100"
        />
      </div>

      <div className="mt-5 rounded-md border border-rose-100 bg-rose-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <FlaskConical className="size-4 text-rose-700" />
          <Badge tone="amber">AI service output validation rehearsal</Badge>
          <Badge tone="neutral">{validationRehearsal.mode}</Badge>
          <Badge tone="neutral">
            {validationRehearsal.externalCallsEnabled ? "external calls on" : "external calls blocked"}
          </Badge>
          <Badge tone={validationRehearsal.packagingGated ? "neutral" : "amber"}>
            {validationRehearsal.packagingGated ? "packaging gated" : "packaging open"}
          </Badge>
        </div>
        <p className="mt-2 text-xs leading-5 text-rose-900">
          This rehearsal uses simulated model-like outputs to show which responses can reach teacher review and which
          are blocked before they can become memory, acceptance, or packaging state.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">cases</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.aiServiceValidationCases}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">blocked</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.aiServiceValidationBlockedCases}</p>
          </div>
          <div className="rounded-md bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">ready</p>
            <p className="mt-1 text-xl font-black text-ink">{report.summary.aiServiceValidationReady}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {validationRehearsal.cases.map((item) => (
            <article key={item.id} className="rounded-md border border-rose-100 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.validationResult === "accepted_for_teacher_review" ? "teal" : "amber"}>
                  {item.validationResult}
                </Badge>
                <Badge tone="neutral">{item.simulatedSource}</Badge>
                <Badge tone={item.packagingGated ? "neutral" : "amber"}>
                  {item.packagingGated ? "packaging gated" : "packaging open"}
                </Badge>
              </div>
              <p className="mt-2 font-extrabold text-ink">{item.label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-700">{item.inputSummary}</p>
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">validation focus</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{item.validationFocus}</p>
              <ul className="mt-2 space-y-1 rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">
                {item.publicTrace.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">teacher review point</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{item.teacherReviewPoint}</p>
            </article>
          ))}
        </div>

        <textarea
          aria-label="ai_service_output_validation_rehearsal_json_v1"
          readOnly
          value={JSON.stringify(validationRehearsal, null, 2)}
          className="mt-3 h-56 w-full resize-y rounded-md border border-rose-200 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-md border border-line bg-mist p-4">
          <div className="flex items-center gap-2">
            <Network className="size-4 text-apprentice-blue" />
            <p className="font-extrabold text-ink">知识体系</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {workflow.knowledgeNodes.map((node) => (
              <Badge key={node.id} tone={node.source === "human_knowledge" ? "teal" : "blue"}>
                {node.label}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            人类提供的知识节点拥有更高权重；AI 自己推断出来的内容必须保持可审查、可纠正。
          </p>
        </div>

        <div className="space-y-3">
          {workflow.guidedGenerationSteps.map((step) => (
            <article key={step.id} className="rounded-md border border-line bg-mist p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="amber">等待老师审查</Badge>
                <Badge tone={step.passed ? "teal" : "amber"}>{step.passed ? "理由可见" : "需要证据"}</Badge>
              </div>
              <p className="mt-3 font-extrabold text-ink">{step.label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{step.proposedOutput}</p>
              <div className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-slate-600">
                <p className="font-bold text-ink">为什么这样生成</p>
                <p className="mt-1">{step.whyThisStep}</p>
                <p className="mt-2 font-bold text-ink">下一步预测</p>
                <p className="mt-1">{step.nextStepPrediction}</p>
                <p className="mt-2 font-bold text-ink">人类纠正点</p>
                <p className="mt-1">{step.teacherCorrectionSlot}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Surface>
  );
}
