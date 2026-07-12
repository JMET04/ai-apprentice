import Link from "next/link";
import { notFound } from "next/navigation";
import { ApprenticeCapabilityBoundaryPanel } from "@/components/apprentice-capability-boundary-panel";
import { AppShell } from "@/components/app-shell";
import { HandsOnTeachingLessonPanel } from "@/components/hands-on-teaching-lesson-panel";
import { LearningCausalityMap } from "@/components/learning-causality-map";
import { CodexCapabilityTransferPanel } from "@/components/codex-capability-transfer-panel";
import { CrossDomainValidationPanel } from "@/components/cross-domain-validation-panel";
import { DomainLearningWorkflowPanel } from "@/components/domain-learning-workflow-panel";
import { HumanTeachingMemoryProtocolPanel } from "@/components/human-teaching-memory-protocol-panel";
import { LearningLoopGate, type LearningGateStep } from "@/components/learning-loop-gate";
import { LearningLoopTimelinePanel } from "@/components/learning-loop-timeline-panel";
import { LearningEvidencePanel } from "@/components/learning-evidence-panel";
import { LearningChallengeProbe } from "@/components/learning-challenge-probe";
import { LearningChallengeSuitePanel } from "@/components/learning-challenge-suite-panel";
import { MemoryProvenancePanel } from "@/components/memory-provenance-panel";
import { PolicyGuardrailPanel } from "@/components/policy-guardrail-panel";
import { QualificationAuditPanel, type QualificationAuditItem } from "@/components/qualification-audit-panel";
import { TeacherAcceptanceBoundaryPanel } from "@/components/teacher-acceptance-boundary-panel";
import { TeacherTrialFeedbackPanel } from "@/components/teacher-trial-feedback-panel";
import { TeacherReviewChecklistPanel } from "@/components/teacher-review-checklist-panel";
import { TeacherReviewHandoff } from "@/components/teacher-review-handoff";
import { TeachingPredictionBoardPanel } from "@/components/teaching-prediction-board-panel";
import { Badge, Surface } from "@/components/ui";
import { UserRequirementCoverageAuditPanel } from "@/components/user-requirement-coverage-audit-panel";
import { VisualBehaviorScorecardPanel } from "@/components/visual-behavior-scorecard-panel";
import { VisualConfidenceCalibrationPanel } from "@/components/visual-confidence-calibration-panel";
import { VisualCorrectionRehearsalPanel } from "@/components/visual-correction-rehearsal-panel";
import { VisualCueAuditTrailPanel } from "@/components/visual-cue-audit-trail-panel";
import { VisualDecisionLedgerPanel } from "@/components/visual-decision-ledger-panel";
import { VisualEvidenceReplayPanel } from "@/components/visual-evidence-replay-panel";
import { VisualLearningStateAuditPanel } from "@/components/visual-learning-state-audit-panel";
import { VisualLearningLimitsPanel } from "@/components/visual-learning-limits-panel";
import { VisualLearningReadinessPanel } from "@/components/visual-learning-readiness-panel";
import { VisualLearningScenarioMatrixPanel } from "@/components/visual-learning-scenario-matrix-panel";
import { VisualRegressionComparisonPanel } from "@/components/visual-regression-comparison-panel";
import { VisualRedTeamRiskRegisterPanel } from "@/components/visual-red-team-risk-register-panel";
import { VisualReviewDossierPanel } from "@/components/visual-review-dossier-panel";
import { VisualReviewManifestPanel } from "@/components/visual-review-manifest-panel";
import { VisualRuleCoverageMatrixPanel } from "@/components/visual-rule-coverage-matrix-panel";
import { VisualRobustnessSuitePanel } from "@/components/visual-robustness-suite-panel";
import { VisualTeacherReviewWorksheetPanel } from "@/components/visual-teacher-review-worksheet-panel";
import { VisualUncertaintyEscalationAuditPanel } from "@/components/visual-uncertainty-escalation-audit-panel";
import { VoiceBrowserCompatibilityComparisonPanel } from "@/components/voice-browser-compatibility-comparison-panel";
import { WorkflowTraceAlignmentPanel } from "@/components/workflow-trace-alignment-panel";
import { SpatialEngineeringTeachingPanel } from "@/components/spatial-engineering-teaching-panel";
import { SpatialMemoryReviewPanel } from "@/components/spatial-memory-review-panel";
import type {
  ExecutionOutput,
  LearningExtractionStep,
  RuleRecord,
  TraceStepRecord,
  VisualDemonstrationArtifact,
  WorkflowNodeDefinition
} from "@/lib/types";
import { memoryStore } from "@/server/memory/memory-store";
import { buildQualificationReport, type QualificationReport } from "@/server/qualification/learning-report";

function buildTaskPageQualificationReport(report: QualificationReport): QualificationReport {
  const compactTeacherAcceptanceEvidenceAgenda = {
    ...report.teacherAcceptanceEvidenceAgenda,
    exportJson:
      "Full teacher acceptance evidence agenda JSON is available from /api/tasks/{taskId}/qualification?view=full.",
    decisionExchange: {
      format: report.teacherAcceptanceEvidenceAgenda.decisionExchange.format,
      itemCount: report.teacherAcceptanceEvidenceAgenda.decisionExchange.itemCount,
      teacherQuestion: report.teacherAcceptanceEvidenceAgenda.decisionExchange.teacherQuestion,
      items: report.teacherAcceptanceEvidenceAgenda.decisionExchange.items,
      templateJson:
        "Full teacher acceptance agenda decision exchange JSON is available from /api/tasks/{taskId}/qualification?view=full."
    }
  };
  const compactCodexCapabilityTransferReport = {
    ...report.codexCapabilityTransferReport,
    exportJson:
      "Full Codex capability transfer JSON is available from /api/tasks/{taskId}/qualification?view=full.",
    transplantDraft: {
      ...report.codexCapabilityTransferReport.transplantDraft,
      exportJson:
        "Full Codex capability transplant draft JSON is available from /api/tasks/{taskId}/qualification?view=full.",
      rehearsal: {
        rowCount: report.summary.codexCapabilityTransplantRehearsalRows,
        readyRows: report.summary.codexCapabilityTransplantRehearsalReady,
        passed: report.summary.codexCapabilityTransplantRehearsalReady === report.summary.codexCapabilityTransplantRehearsalRows,
        teacherQuestion: "Open the full local report to inspect the detailed rehearsal packet.",
        rows: [],
        exportJson:
          "Full Codex capability transplant rehearsal JSON is available from /api/tasks/{taskId}/qualification?view=full."
      }
    }
  };

  return {
    ...report,
    teacherAcceptanceEvidenceAgenda: compactTeacherAcceptanceEvidenceAgenda,
    codexCapabilityTransferReport: compactCodexCapabilityTransferReport
  } as unknown as QualificationReport;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function valueSummary(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(" / ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return value === undefined || value === null || value === "" ? "未知" : String(value);
}

function statusLabel(status: string) {
  if (status === "needs_review") {
    return "需要老师审查";
  }

  if (status === "completed") {
    return "已完成";
  }

  return status;
}

function nodeTypeLabel(type: string) {
  const labels: Record<string, string> = {
    input: "输入",
    understand: "理解",
    decision: "决策",
    execute: "执行",
    check: "检查",
    human_review: "老师确认",
    output: "输出"
  };

  return labels[type] ?? type;
}

function displayText(value: string) {
  const labels: Record<string, string> = {
    "Generate a structured photography travel journal from a travel note": "从旅行笔记生成结构化摄影日志",
    "Teach the apprentice to transform a short travel note into a structured photography journal with visible evidence and reusable correction rules.":
      "教 AI 学徒把短旅行笔记转换成结构化摄影日志，并保留可见证据和可复用纠错规则。",
    "Today I visited Lake Geneva at sunset, with clear weather, lake reflections, snow mountains, and a portrait subject.":
      "今天我在日内瓦湖边 sunset 拍摄，天气 clear，有湖面反光、雪山和人像主体。",
    "Show every applied rule, confidence score, validation result, and human review point.":
      "展示每条已应用规则、置信度、校验结果和老师审查点。",
    "Wrong lighting: sunset, dusk, or golden hour is labeled as generic natural light.":
      "光线判断错误：sunset、dusk 或 golden hour 被标成普通 natural light。",
    "Missing advice: photographyAdvice does not mention warm side light or backlight when golden-hour cues are present.":
      "建议缺失：出现黄金时刻线索时，photographyAdvice 没有提到柔和侧光或逆光。",
    "Photography journal teaching flow": "摄影日志带教流程",
    "Receive travel note": "接收旅行笔记",
    "Understand intent": "理解意图",
    "Detect lighting clues": "识别光线线索",
    "Draft journal": "生成游记草稿",
    "Self-check format": "自检格式",
    "Teacher review": "老师审查",
    "Publish structured journal": "发布结构化游记"
  };

  return labels[value] ?? value;
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await memoryStore.getTaskProfile(id);

  if (!task) {
    notFound();
  }

  const inputSchema = parseJson<{ example?: string }>(task.inputSchema, {});
  const expectedOutput = parseJson<{ fields?: string[]; notes?: string; errorCases?: string[] }>(task.expectedOutput, {});
  const workflow = task.workflows[0];
  const workflowNodes = workflow
    ? parseJson<WorkflowNodeDefinition[]>(workflow.nodes, [])
    : [];
  const evidenceRules: RuleRecord[] = task.rules.map((rule) => ({
    id: rule.id,
    apprenticeId: rule.apprenticeId,
    taskId: rule.taskId ?? task.id,
    title: rule.title,
    condition: rule.condition,
    action: rule.action,
    source: rule.source === "seed" || rule.source === "manual" ? rule.source : "correction",
    confidence: rule.confidence,
    enabled: rule.enabled,
    createdAt: rule.createdAt
  }));
  const evidenceCorrections = task.corrections.map((correction) => {
    const extractedRule = parseJson<{ title?: string; enabled?: boolean; confidence?: number }>(
      correction.extractedRule,
      {}
    );
    const beforeOutput = parseJson<Record<string, unknown>>(correction.beforeOutput, {});
    const afterOutput = correction.afterOutput ? parseJson<Record<string, unknown>>(correction.afterOutput, {}) : {};

    return {
      id: correction.id,
      feedback: correction.userFeedback,
      errorType: correction.errorType,
      createdAt: correction.createdAt,
      runId: correction.runId,
      extractedRuleTitle: extractedRule.title ?? "Reusable rule",
      extractedRuleEnabled: extractedRule.enabled ?? false,
      extractedRuleConfidence: extractedRule.confidence ?? null,
      beforeSummary: beforeOutput.lightingCondition
        ? `lightingCondition: ${String(beforeOutput.lightingCondition)}`
        : JSON.stringify(beforeOutput).slice(0, 160),
      afterSummary: afterOutput.structuredFeedback
        ? `structured feedback: ${JSON.stringify(afterOutput.structuredFeedback)}`
        : extractedRule.title
          ? `learned rule: ${extractedRule.title}`
          : "Reusable memory extracted.",
      learningTrace: correction.learningTrace ? parseJson<LearningExtractionStep[]>(correction.learningTrace, []) : []
    };
  });
  const evidenceExamples = task.examples.map((example) => {
    const extractedRule = example.extractedRule ? parseJson<{ title?: string }>(example.extractedRule, {}) : {};
    return {
      id: example.id,
      input: example.input,
      expectedOutput: parseJson<Record<string, unknown>>(example.expectedOutput, {}),
      extractedRuleTitle: extractedRule.title ?? null,
      learningTrace: example.learningTrace ? parseJson<LearningExtractionStep[]>(example.learningTrace, []) : [],
      createdAt: example.createdAt
    };
  });
  const evidenceVisualDemonstrations = task.visualDemos.map((demo) => {
    const artifact = parseJson<VisualDemonstrationArtifact>(demo.artifact, {
      sceneDescription: demo.artifact,
      visualCues: [],
      lightingSignals: [],
      expectedPhotographyAdvice: []
    });
    const extractedRule = demo.extractedRule ? parseJson<{ title?: string }>(demo.extractedRule, {}) : {};
    return {
      id: demo.id,
      title: demo.title,
      referenceImageUrl: artifact.referenceImageUrl,
      sceneDescription: artifact.sceneDescription,
      visualCues: artifact.visualCues,
      annotations: artifact.annotations ?? [],
      lightingSignals: artifact.lightingSignals,
      expectedPhotographyAdvice: artifact.expectedPhotographyAdvice,
      teacherNotes: demo.teacherNotes,
      extractedRuleTitle: extractedRule.title ?? null,
      learningTrace: demo.learningTrace ? parseJson<LearningExtractionStep[]>(demo.learningTrace, []) : [],
      createdAt: demo.createdAt
    };
  });
  const evidenceRuns = task.runs.map((run) => {
    const output = parseJson<ExecutionOutput | null>(run.output, null);
    const trace = parseJson<TraceStepRecord[]>(run.trace, []);
    const appliedRuleTitles = Array.from(
      new Set(trace.flatMap((step) => step.appliedRules.map((rule) => rule.title)))
    );

    return {
      id: run.id,
      status: run.status,
      createdAt: run.createdAt,
      output,
      reviewPoints: trace.filter((step) => step.needsHumanReview).length,
      appliedRuleTitles,
      traceStepCount: trace.length,
      hasWorkflowNodeTrace: trace.length > 0 && trace.every((step) => Boolean(step.nodeId)),
      hasValidationEvidence: trace.length > 0 && trace.every((step) => Boolean(step.validation))
    };
  });
  const latestRun = evidenceRuns[0];
  const appliedMemoryRun = evidenceRuns.find((run) => run.appliedRuleTitles.length > 0);
  const historyLessonRule = evidenceRules.find((rule) => rule.id.startsWith("rule-history-"));
  const qualificationReport = buildQualificationReport(task);
  const pageQualificationReport = buildTaskPageQualificationReport(qualificationReport);
  const learningDeltas = qualificationReport.learningDeltas;
  const qualificationAuditItems: QualificationAuditItem[] = [
    ...qualificationReport.requirements.map((requirement) => ({
      label: requirement.label,
      principle: requirement.principle,
      evidence: requirement.evidence,
      complete: requirement.passed,
      href: requirement.href
    }))
  ];
  const gateSteps: LearningGateStep[] = [
    {
      label: "学徒已创建",
      evidence: `${task.apprentice.name} 已绑定到这个可带教任务。`,
      complete: Boolean(task.apprenticeId),
      href: `/apprentices/${task.apprenticeId}`
    },
    {
      label: "可带教任务已创建",
      evidence: task.goal,
      complete: Boolean(task.name && task.goal),
      href: `/tasks/${task.id}`
    },
    {
      label: "可视化流程已构建",
      evidence: workflow ? `${workflowNodes.length} 个工作流节点，版本 ${workflow.version}。` : "还没有保存工作流。",
      complete: workflowNodes.length >= 5 && Boolean(workflow),
      href: `/tasks/${task.id}/teach`
    },
    {
      label: "任务已执行",
      evidence: latestRun ? `最近运行 ${latestRun.id} 已保存，状态：${statusLabel(latestRun.status)}。` : "还没有保存运行。",
      complete: evidenceRuns.length > 0,
      href: latestRun ? `/runs/${latestRun.id}` : `/tasks/${task.id}/run`
    },
    {
      label: "结构化追踪可见",
      evidence: latestRun
        ? `${latestRun.traceStepCount} 个追踪步骤已关联工作流节点和校验证据。`
        : "还没有保存追踪证据。",
      complete: Boolean(latestRun?.hasWorkflowNodeTrace && latestRun.hasValidationEvidence),
      href: latestRun ? `/runs/${latestRun.id}` : `/tasks/${task.id}/run`
    },
    {
      label: "老师纠错已保存",
      evidence:
        evidenceCorrections.length > 0
          ? `${evidenceCorrections.length} 条纠错已转换成可审查证据。`
          : "还没有纠错记忆。",
      complete: evidenceCorrections.length > 0
    },
    {
      label: "可复用规则已抽取",
      evidence: `${evidenceRules.filter((rule) => rule.enabled).length} 条启用规则，任务规则总数 ${evidenceRules.length}。`,
      complete: evidenceRules.some((rule) => rule.enabled)
    },
    {
      label: "视觉示范已学习",
      evidence:
        evidenceVisualDemonstrations.length > 0
          ? `${evidenceVisualDemonstrations.length} 个视觉参考画面已保存，包含线索和老师备注。`
          : "还没有保存视觉示范。",
      complete: evidenceVisualDemonstrations.length > 0
    },
    {
      label: "结构化示例已保存",
      evidence:
        evidenceExamples.length > 0
          ? `${evidenceExamples.length} 个老师结构化示例可复用。`
          : "还没有保存结构化示例。",
      complete: evidenceExamples.length > 0
    },
    {
      label: "下一次运行已应用记忆",
      evidence: appliedMemoryRun
        ? `${appliedMemoryRun.id} 应用了：${appliedMemoryRun.appliedRuleTitles.join(", ")}。`
        : "还没有运行应用已学记忆。",
      complete: Boolean(appliedMemoryRun),
      href: appliedMemoryRun ? `/runs/${appliedMemoryRun.id}` : `/tasks/${task.id}/run`
    },
    {
      label: "学习前后变化可见",
      evidence:
        learningDeltas.length > 0
          ? `${learningDeltas.length} 条前后对比证明记忆应用后输出字段发生改变。`
          : "还没有持久化的学习前后变化证据。",
      complete: learningDeltas.length > 0,
      href: learningDeltas[0]?.appliedRunId ? `/runs/${learningDeltas[0].appliedRunId}` : `/tasks/${task.id}/run`
    },
    {
      label: "执行历史已变成记忆",
      evidence: historyLessonRule
        ? `${historyLessonRule.title} 已保存为${historyLessonRule.enabled ? "启用" : "暂停"}记忆。`
        : "还没有保存执行历史经验。",
      complete: Boolean(historyLessonRule),
      href: historyLessonRule ? `/runs/${historyLessonRule.id.replace("rule-history-", "")}` : `/tasks/${task.id}/run`
    }
  ];

  return (
    <AppShell>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_380px]">
        <Surface>
          <Badge tone="blue">可带教任务</Badge>
          <h2 className="mt-4 break-words text-2xl font-black leading-tight text-ink">{displayText(task.name)}</h2>
          <p className="mt-3 max-w-3xl break-words leading-7 text-slate-600">{displayText(task.goal)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="teal">{task.apprentice.name}</Badge>
            <Badge>{task.status === "active" ? "进行中" : task.status}</Badge>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-mist p-4">
              <h3 className="font-extrabold text-ink">输入示例</h3>
              <p className="mt-2 break-words text-sm leading-6 text-slate-700">
                {inputSchema.example ? displayText(inputSchema.example) : "还没有保存示例。"}
              </p>
            </div>
            <div className="rounded-lg bg-mist p-4">
              <h3 className="font-extrabold text-ink">期望输出</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {(expectedOutput.fields ?? []).map((field) => (
                  <Badge key={field}>{field}</Badge>
                ))}
              </div>
              {expectedOutput.notes ? <p className="mt-3 text-sm text-slate-600">{displayText(expectedOutput.notes)}</p> : null}
            </div>
          </div>
          {(expectedOutput.errorCases ?? []).length > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-4">
              <h3 className="font-extrabold text-amber-950">已知错误案例</h3>
              <div className="mt-3 grid gap-2">
                {(expectedOutput.errorCases ?? []).map((item) => (
                  <p key={item} className="rounded-md bg-white/70 p-3 text-sm leading-6 text-amber-900">
                    {displayText(item)}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
            <Link href={`/tasks/${task.id}/teach`} className="rounded-md bg-ink px-4 py-2 text-center text-sm font-bold text-white">
              打开可视化带教流程
            </Link>
            <Link href={`/tasks/${task.id}/run`} className="rounded-md bg-apprentice-teal px-4 py-2 text-center text-sm font-bold text-white">
              运行并纠错
            </Link>
          </div>
        </Surface>

        <Surface>
          <h3 className="font-extrabold text-ink">工作流摘要</h3>
          <p className="mt-2 text-sm text-slate-500">
            {workflow ? `${displayText(workflow.name)}，版本 ${workflow.version}` : "还没有保存工作流。"}
          </p>
          <div className="mt-4 space-y-2">
            {workflowNodes.map((node) => (
              <div key={node.id} className="rounded-md border border-line bg-mist p-3">
                <p className="text-sm font-bold text-ink">{displayText(node.label)}</p>
                <p className="mt-1 text-xs text-slate-500">{nodeTypeLabel(node.type)}</p>
              </div>
            ))}
          </div>
        </Surface>
      </div>
      <div className="mt-5">
        <LearningLoopGate steps={gateSteps} taskId={task.id} />
      </div>
      <div className="mt-5">
        <TeacherReviewHandoff taskId={task.id} report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <TeacherTrialFeedbackPanel apprenticeId={task.apprenticeId} taskId={task.id} />
      </div>
      <div className="mt-5">
        <TeacherAcceptanceBoundaryPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <TeacherReviewChecklistPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <UserRequirementCoverageAuditPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <HandsOnTeachingLessonPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <ApprenticeCapabilityBoundaryPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <CodexCapabilityTransferPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualReviewDossierPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualReviewManifestPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualTeacherReviewWorksheetPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualEvidenceReplayPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualRedTeamRiskRegisterPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualBehaviorScorecardPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualRuleCoverageMatrixPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualCorrectionRehearsalPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualLearningStateAuditPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualUncertaintyEscalationAuditPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <CrossDomainValidationPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5" id="teach-domain-brief">
        <DomainLearningWorkflowPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5" id="teach-memory-replay">
        <HumanTeachingMemoryProtocolPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VoiceBrowserCompatibilityComparisonPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5" id="teach-next-move">
        <TeachingPredictionBoardPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5" id="teach-3d-coordinates">
        <SpatialEngineeringTeachingPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <SpatialMemoryReviewPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualConfidenceCalibrationPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualRobustnessSuitePanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualLearningReadinessPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualCueAuditTrailPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualDecisionLedgerPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualLearningLimitsPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualRegressionComparisonPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <LearningLoopTimelinePanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <LearningCausalityMap report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <VisualLearningScenarioMatrixPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <LearningChallengeSuitePanel suite={pageQualificationReport.challengeSuite} />
      </div>
      <div className="mt-5">
        <LearningChallengeProbe taskId={task.id} initialInput={inputSchema.example ?? task.goal} />
      </div>
      <div className="mt-5">
        <WorkflowTraceAlignmentPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <MemoryProvenancePanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <PolicyGuardrailPanel report={pageQualificationReport} />
      </div>
      <div className="mt-5">
        <QualificationAuditPanel items={qualificationAuditItems} />
      </div>
      <div className="mt-5">
        <LearningEvidencePanel
          apprenticeId={task.apprenticeId}
          taskId={task.id}
          rules={evidenceRules}
          corrections={evidenceCorrections}
          examples={evidenceExamples}
          visualDemonstrations={evidenceVisualDemonstrations}
          learningDeltas={learningDeltas}
          runs={evidenceRuns}
        />
      </div>
    </AppShell>
  );
}
