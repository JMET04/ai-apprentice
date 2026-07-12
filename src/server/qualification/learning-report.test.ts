import { describe, expect, it } from "vitest";
import { buildCrossDomainTeacherScoreDraft } from "@/lib/cross-domain-score-draft";
import { buildTeacherAcceptanceAgendaDecisionDraft } from "@/lib/teacher-acceptance-agenda-draft";
import { demoApprentice, demoRules, demoTask, demoTeachingExamples, demoVisualDemonstrations, demoWorkflow } from "@/lib/demo-data";
import { buildVoiceBrowserCompatibilityReviewRecord } from "@/lib/human-knowledge-teaching";
import { buildTeacherReviewDraft } from "@/lib/teacher-review-draft";
import { buildTeacherTrialFeedbackDraft } from "@/lib/teacher-trial-feedback-draft";
import { extractRuleFromExecutionHistory } from "@/server/corrections/history-lesson-extractor";
import { executePhotographyJournalTask } from "@/server/workflow/execution-engine";
import { buildQualificationReport } from "./learning-report";
import { buildQualificationApiSummary } from "./qualification-api-summary";

type ReportTask = Parameters<typeof buildQualificationReport>[0];

function taskProfileFixture(): ReportTask {
  const beforeRun = {
    ...executePhotographyJournalTask(demoTask.inputExample, [], {
      taskId: demoTask.id,
      apprenticeId: demoApprentice.id
    }),
    id: "run-demo-before-teaching",
    createdAt: "2026-06-01T09:04:00.000Z"
  };
  const learnedRun = {
    ...executePhotographyJournalTask(demoTask.inputExample, demoRules, {
      taskId: demoTask.id,
      apprenticeId: demoApprentice.id
    }),
    id: "run-demo-golden-hour",
    createdAt: "2026-06-01T09:10:00.000Z"
  };
  const historyRule = extractRuleFromExecutionHistory({
    runId: learnedRun.id,
    apprenticeId: learnedRun.apprenticeId,
    taskId: learnedRun.taskId,
    input: learnedRun.input,
    output: learnedRun.output,
    trace: learnedRun.trace
  });
  const now = "2026-06-01T09:00:00.000Z";

  return {
    id: demoTask.id,
    apprenticeId: demoApprentice.id,
    name: demoTask.name,
    goal: demoTask.goal,
    inputSchema: JSON.stringify(demoTask.inputSchema),
    expectedOutput: JSON.stringify(demoTask.expectedOutput),
    status: demoTask.status,
    createdAt: now,
    updatedAt: now,
    apprentice: {
      ...demoApprentice,
      userId: "user-demo-teacher",
      createdAt: now,
      updatedAt: now
    },
    workflows: [
      {
        id: demoWorkflow.id,
        taskId: demoTask.id,
        name: demoWorkflow.name,
        version: demoWorkflow.version,
        nodes: JSON.stringify(demoWorkflow.nodes),
        edges: JSON.stringify(demoWorkflow.edges),
        createdAt: now,
        updatedAt: now,
        nodeRows: []
      }
    ],
    rules: [...demoRules, historyRule],
    corrections: [
      {
        id: "correction-golden-hour",
        apprenticeId: demoApprentice.id,
        taskId: demoTask.id,
        runId: beforeRun.id,
        userFeedback: "Use golden hour for sunset and dusk cues.",
        errorType: "lighting_condition_rule",
        extractedRule: JSON.stringify(demoRules[0]),
        beforeOutput: JSON.stringify(beforeRun.output),
        afterOutput: JSON.stringify(learnedRun.output),
        learningTrace: JSON.stringify([
          { id: "read", label: "Read", evidence: "sunset", confidence: 0.9, validation: "ok", needsHumanReview: false },
          { id: "extract", label: "Extract", evidence: "rule", confidence: 0.9, validation: "ok", needsHumanReview: false },
          { id: "policy", label: "Policy", evidence: "auto", confidence: 0.9, validation: "ok", needsHumanReview: false }
        ]),
        createdAt: "2026-06-01T09:05:00.000Z"
      }
    ],
    examples: demoTeachingExamples.map((example) => ({
      id: example.id,
      apprenticeId: example.apprenticeId,
      taskId: example.taskId,
      input: example.input,
      expectedOutput: JSON.stringify(example.expectedOutput),
      extractedRule: example.extractedRule ? JSON.stringify(example.extractedRule) : null,
      learningTrace: example.learningTrace ? JSON.stringify(example.learningTrace) : null,
      createdAt: example.createdAt
    })),
    visualDemos: demoVisualDemonstrations.map((demo) => ({
      id: demo.id,
      apprenticeId: demo.apprenticeId,
      taskId: demo.taskId,
      title: demo.title,
      artifact: JSON.stringify(demo.artifact),
      teacherNotes: demo.teacherNotes,
      extractedRule: demo.extractedRule ? JSON.stringify(demo.extractedRule) : null,
      learningTrace: demo.learningTrace ? JSON.stringify(demo.learningTrace) : null,
      createdAt: demo.createdAt
    })),
    runs: [
      {
        id: learnedRun.id,
        taskId: learnedRun.taskId,
        apprenticeId: learnedRun.apprenticeId,
        input: JSON.stringify({ rawTravelNote: learnedRun.input }),
        output: JSON.stringify(learnedRun.output),
        status: learnedRun.status,
        trace: JSON.stringify(learnedRun.trace),
        createdAt: learnedRun.createdAt
      },
      {
        id: beforeRun.id,
        taskId: beforeRun.taskId,
        apprenticeId: beforeRun.apprenticeId,
        input: JSON.stringify({ rawTravelNote: beforeRun.input }),
        output: JSON.stringify(beforeRun.output),
        status: beforeRun.status,
        trace: JSON.stringify(beforeRun.trace),
        createdAt: beforeRun.createdAt
      }
    ]
  } as unknown as ReportTask;
}

describe("qualification report", () => {
  it("uses one report to prove teacher-review readiness and packaging lock", () => {
    const report = buildQualificationReport(taskProfileFixture());

    expect(report.status).toBe("qualified_for_teacher_review");
    expect(report.packaging.gated).toBe(true);
    expect(report.packaging.accepted).toBe(false);
    expect(report.packaging.status).toBe("pending_teacher_acceptance");
    expect(report.summary.requirementsPassed).toBe(16);
    expect(report.summary.requirementsTotal).toBe(16);
    expect(report.summary.traceAlignedNodes).toBe(7);
    expect(report.summary.traceTotalNodes).toBe(7);
    expect(report.summary.memoryProvenanceRules).toBe(3);
    expect(report.summary.policyGatesPassed).toBe(34);
    expect(report.summary.policyGatesTotal).toBe(34);
    expect(report.summary.visualScenarioPassed).toBe(4);
    expect(report.summary.visualScenarioTotal).toBe(4);
    expect(report.summary.visualScenarioTraceSteps).toBe(28);
    expect(report.summary.visualRegressionPassed).toBe(4);
    expect(report.summary.visualRegressionTotal).toBe(4);
    expect(report.summary.visualRegressionChanged).toBe(2);
    expect(report.summary.visualRegressionConservative).toBe(2);
    expect(report.summary.visualRobustnessPassed).toBe(4);
    expect(report.summary.visualRobustnessTotal).toBe(4);
    expect(report.summary.visualRobustnessFalsePositiveGuards).toBe(3);
    expect(report.summary.visualRobustnessPositiveParaphrases).toBe(1);
    expect(report.summary.challengeSuitePassed).toBe(3);
    expect(report.summary.challengeSuiteTotal).toBe(3);
    expect(report.summary.challengeSuiteTraceSteps).toBe(21);
    expect(report.summary.capabilityBoundaryPassed).toBe(4);
    expect(report.summary.capabilityBoundaryTotal).toBe(4);
    expect(report.summary.capabilityBoundaryItems).toBe(4);
    expect(report.summary.codexCapabilityTransferItems).toBe(5);
    expect(report.summary.codexCapabilityTransferReady).toBe(5);
    expect(report.summary.codexCapabilityTransferLocked).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalRows).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalReady).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalLocked).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultRows).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultNotRun).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationBlockedStatuses).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueItems).toBe(15);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueReady).toBe(15);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueuePendingVerifier).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueMatchedEvidence).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueMismatchBlockers).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffSteps).toBe(15);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffReady).toBe(1);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffLockedSteps).toBe(15);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookItems).toBe(15);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookReady).toBe(1);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookLockedChecks).toBe(15);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunRows).toBe(
      15
    );
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReady).toBe(
      1
    );
    expect(
      report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunNoOpRows
    ).toBe(15);
    expect(
      report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptRows
    ).toBe(15);
    expect(
      report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptReady
    ).toBe(1);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows
    ).toBe(15);
    expect(
      report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows
    ).toBe(15);
    expect(
      report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady
    ).toBe(1);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions
    ).toBe(15);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady
    ).toBe(1);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady
    ).toBe(1);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems
    ).toBe(15);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems
    ).toBe(15);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady
    ).toBe(1);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady
    ).toBe(1);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady
    ).toBe(1);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady
    ).toBe(1);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady
    ).toBe(1);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows
    ).toBe(135);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady
    ).toBe(1);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions
    ).toBe(135);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems
    ).toBe(135);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady
    ).toBe(1);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems
    ).toBe(45);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps
    ).toBe(135);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady
    ).toBe(1);
    expect(
      report.summary
        .codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps
    ).toBe(135);
    expect(report.summary.visualReadinessPassed).toBe(6);
    expect(report.summary.visualReadinessTotal).toBe(6);
    expect(report.summary.visualCueAuditPassed).toBe(4);
    expect(report.summary.visualCueAuditTotal).toBe(10);
    expect(report.summary.visualDecisionLedgerItems).toBe(8);
    expect(report.summary.visualDecisionApplied).toBe(6);
    expect(report.summary.visualDecisionConflicted).toBe(2);
    expect(report.summary.visualDecisionReviewRequired).toBe(2);
    expect(report.summary.visualLearningLimitItems).toBe(8);
    expect(report.summary.visualLearningUnprovenCues).toBe(6);
    expect(report.summary.visualLearningReviewLimits).toBe(1);
    expect(report.summary.visualLearningBlockedLimits).toBe(1);
    expect(report.summary.visualRuleCoverageRules).toBe(3);
    expect(report.summary.visualRuleCoverageCovered).toBe(3);
    expect(report.summary.visualRuleCoverageSourceOnly).toBe(0);
    expect(report.summary.visualRuleCoveragePositiveLinks).toBe(6);
    expect(report.summary.visualRuleCoverageReviewLinks).toBe(2);
    expect(report.summary.visualCorrectionRehearsals).toBe(2);
    expect(report.summary.visualCorrectionRehearsalsPassed).toBe(2);
    expect(report.summary.visualCorrectionRehearsalChanged).toBe(1);
    expect(report.summary.visualCorrectionRehearsalReviewPreserved).toBe(1);
    expect(report.summary.visualStateTransitions).toBe(6);
    expect(report.summary.visualStateTransitionsPassed).toBe(6);
    expect(report.summary.visualStateTransitionAutomatic).toBe(3);
    expect(report.summary.visualStateTransitionReview).toBe(2);
    expect(report.summary.visualStateTransitionLocked).toBe(1);
    expect(report.summary.visualUncertaintyEscalations).toBe(6);
    expect(report.summary.visualUncertaintyEscalationsReady).toBe(6);
    expect(report.summary.visualUncertaintyTeacherReview).toBe(5);
    expect(report.summary.visualUncertaintyLocked).toBe(1);
    expect(report.summary.spatialTeachingSamples).toBe(18);
    expect(report.summary.spatialFitCandidates).toBe(7);
    expect(report.summary.spatialFitCandidatesReady).toBe(7);
    expect(report.summary.spatialArcFitCandidates).toBe(1);
    expect(report.summary.spatialSplineFitCandidates).toBe(1);
    expect(report.summary.spatialMultiSegmentSplineFitCandidates).toBe(1);
    expect(report.summary.spatialSurfacePatchFitCandidates).toBe(1);
    expect(report.summary.spatialTeacherSelectableCandidates).toBe(7);
    expect(report.summary.spatialModelingRules).toBe(2);
    expect(report.summary.spatialDirectionToleranceChecks).toBe(7);
    expect(report.summary.spatialDirectionToleranceReady).toBe(7);
    expect(report.summary.spatialCandidateComparisons).toBe(7);
    expect(report.summary.spatialCandidateComparisonsReady).toBe(7);
    expect(report.summary.spatialCandidateSelectionImpactPreviews).toBe(7);
    expect(report.summary.spatialCandidateSelectionImpactPreviewsReady).toBe(7);
    expect(report.summary.spatialCandidateSelectionDisabledDrafts).toBe(14);
    expect(report.summary.spatialCandidateImpactCorrectionRehearsals).toBe(7);
    expect(report.summary.spatialCandidateImpactCorrectionRehearsalsReady).toBe(7);
    expect(report.summary.spatialCandidateImpactSecondRoundCandidates).toBe(21);
    expect(report.summary.spatialCandidateImpactSecondRoundSelectionPreviews).toBe(7);
    expect(report.summary.spatialCandidateImpactSecondRoundSelectionPreviewsReady).toBe(7);
    expect(report.summary.spatialCandidateImpactSecondRoundSelectionTraceSteps).toBe(28);
    expect(report.summary.spatialCandidateImpactSecondRoundSelectionTraceStepsReady).toBe(28);
    expect(report.summary.spatialCandidateImpactRegeneratedDrafts).toBe(42);
    expect(report.summary.spatialPositionParameterRows).toBe(5);
    expect(report.summary.spatialPositionParameterRowsReady).toBe(5);
    expect(report.summary.spatialPositionParameterReportReady).toBe(1);
    expect(report.summary.spatialSurfacePatchLenses).toBe(1);
    expect(report.summary.spatialSurfacePatchVectors).toBe(6);
    expect(report.summary.spatialSurfacePatchReady).toBe(1);
    expect(report.summary.spatialSurfacePatchStabilitySamples).toBe(18);
    expect(report.summary.spatialSurfacePatchStabilityReady).toBe(1);
    expect(report.summary.spatialSurfacePatchStabilityOutliers).toBe(0);
    expect(report.summary.spatialSurfacePatchSelectionReplays).toBe(3);
    expect(report.summary.spatialSurfacePatchSelectionReplayReady).toBe(1);
    expect(report.summary.spatialSurfacePatchSelectionReplayDisabledDrafts).toBe(4);
    expect(report.summary.domainLearningStages).toBe(4);
    expect(report.summary.domainLearningStagesReady).toBe(4);
    expect(report.summary.domainKnowledgeNodes).toBe(5);
    expect(report.summary.domainGuidedGenerationSteps).toBe(4);
    expect(report.summary.humanTeachingMemoryRules).toBe(4);
    expect(report.summary.humanTeachingMemoryRulesReady).toBe(4);
    expect(report.summary.teachingConflictSteps).toBe(4);
    expect(report.summary.teachingConflictStepsReady).toBe(4);
    expect(report.summary.voiceTeachingModes).toBe(1);
    expect(report.summary.voiceRestatementReviewVersions).toBe(3);
    expect(report.summary.voiceRestatementReviewHistoryReady).toBe(1);
    expect(report.summary.voiceEngineSelectionCandidates).toBe(3);
    expect(report.summary.voiceEngineSelectionReady).toBe(1);
    expect(report.summary.voiceEngineTeacherScoreReplays).toBe(3);
    expect(report.summary.voiceBrowserCompatibilityBrowsers).toBe(4);
    expect(report.summary.voiceBrowserCompatibilityReady).toBe(1);
    expect(report.summary.voiceBrowserCompatibilityRecognitionRisks).toBe(2);
    expect(report.summary.voiceBrowserCompatibilityFallbacks).toBe(2);
    expect(report.summary.voiceBrowserCompatibilityReviewDrafts).toBe(0);
    expect(report.summary.voiceBrowserCompatibilityComparisonBrowsers).toBe(4);
    expect(report.summary.voiceBrowserCompatibilityComparisonReady).toBe(1);
    expect(report.summary.voiceBrowserCompatibilityComparisonPersistedReviews).toBe(0);
    expect(report.summary.voiceBrowserCompatibilityComparisonFallbackTests).toBe(0);
    expect(report.summary.voiceBrowserCompatibilityBatchDiffRows).toBe(4);
    expect(report.summary.voiceBrowserCompatibilityBatchDiffReady).toBe(1);
    expect(report.summary.voiceBrowserCompatibilityBatchDiffMissingReviews).toBe(4);
    expect(report.summary.voiceBrowserCompatibilityBatchDiffRuntimeDiffs).toBe(4);
    expect(report.summary.voiceBrowserCompatibilityBatchDiffFallbackGaps).toBe(2);
    expect(report.summary.teachingPredictionMoves).toBe(6);
    expect(report.summary.teachingPredictionMovesReady).toBe(6);
    expect(report.summary.visualReviewDossierPassed).toBe(28);
    expect(report.summary.visualReviewDossierTotal).toBe(28);
    expect(report.summary.userRequirementCoverageItems).toBe(14);
    expect(report.summary.userRequirementCoverageReady).toBe(13);
    expect(report.summary.userRequirementCoverageLocked).toBe(1);
    expect(report.summary.handsOnTeachingLessonSteps).toBe(7);
    expect(report.summary.handsOnTeachingLessonReady).toBe(6);
    expect(report.summary.handsOnTeachingLessonLocked).toBe(1);
    expect(report.summary.handsOnTeachingRunbookSteps).toBe(7);
    expect(report.summary.handsOnTeachingRunbookReady).toBe(6);
    expect(report.summary.handsOnTeachingRunbookLocked).toBe(1);
    expect(report.summary.visualReviewManifestSections).toBe(28);
    expect(report.summary.visualReviewManifestEndpoints).toBe(3);
    expect(report.summary.visualConfidenceCalibrationPassed).toBe(7);
    expect(report.summary.visualConfidenceCalibrationTotal).toBe(7);
    expect(report.summary.visualConfidenceAutoReady).toBe(3);
    expect(report.summary.visualConfidenceReviewRequired).toBe(4);
    expect(report.summary.visualBehaviorScorecardCases).toBe(15);
    expect(report.summary.visualBehaviorScorecardPassed).toBe(15);
    expect(report.summary.visualBehaviorScorecardMetrics).toBe(5);
    expect(report.summary.visualBehaviorScorecardMetricsPassed).toBe(5);
    expect(report.summary.visualBehaviorScorecardAutoRoutes).toBe(6);
    expect(report.summary.visualBehaviorScorecardReviewRoutes).toBe(9);
    expect(report.summary.visualTeacherWorksheetItems).toBe(18);
    expect(report.summary.visualTeacherWorksheetReady).toBe(18);
    expect(report.summary.visualTeacherWorksheetUnanswered).toBe(18);
    expect(report.summary.visualTeacherWorksheetBatchExportItems).toBe(18);
    expect(report.summary.visualTeacherWorksheetBatchExportReady).toBe(1);
    expect(report.summary.visualTeacherWorksheetBatchAllowedDecisions).toBe(4);
    expect(report.summary.visualTeacherWorksheetDraftVersions).toBe(3);
    expect(report.summary.visualTeacherWorksheetDraftVersionReady).toBe(1);
    expect(report.summary.visualTeacherWorksheetDraftChangedItems).toBe(9);
    expect(report.summary.visualTeacherWorksheetDraftFollowUpItems).toBe(3);
    expect(report.summary.visualTeacherReviewDraftRecoveryVersions).toBe(0);
    expect(report.summary.visualTeacherReviewDraftRecoveryReady).toBe(1);
    expect(report.summary.visualTeacherReviewDraftRecoveryPersisted).toBe(0);
    expect(report.summary.visualTeacherReviewDraftRecoveryFollowUps).toBe(0);
    expect(report.summary.visualTeacherReviewDraftReplayRows).toBe(3);
    expect(report.summary.visualTeacherReviewDraftReplayReady).toBe(1);
    expect(report.summary.visualTeacherReviewDraftReplayStaticDiffs).toBe(3);
    expect(report.summary.visualTeacherReviewDraftReplayPersistedDiffs).toBe(0);
    expect(report.summary.visualTeacherReviewDraftReplayExported).toBe(3);
    expect(report.summary.visualTeacherReviewDrafts).toBe(0);
    expect(report.summary.visualEvidenceReplaySteps).toBe(7);
    expect(report.summary.visualEvidenceReplayReady).toBe(7);
    expect(report.summary.visualRedTeamRisks).toBe(6);
    expect(report.summary.visualRedTeamMitigated).toBe(4);
    expect(report.summary.visualRedTeamTeacherReview).toBe(1);
    expect(report.summary.visualRedTeamLocked).toBe(1);
    expect(report.summary.crossDomainValidationCases).toBe(3);
    expect(report.summary.crossDomainValidationReady).toBe(1);
    expect(report.summary.crossDomainValidationDomains).toBe(3);
    expect(report.summary.crossDomainValidationApprentices).toBe(3);
    expect(report.summary.crossDomainValidationReviewBoundaries).toBe(1);
    expect(report.summary.crossDomainTeacherScoreItems).toBe(3);
    expect(report.summary.crossDomainTeacherScoreReplayReady).toBe(1);
    expect(report.summary.crossDomainTeacherScoreAverage).toBe(85);
    expect(report.summary.crossDomainTeacherScoreFollowUps).toBe(1);
    expect(report.summary.crossDomainTeacherScoreDisabledDrafts).toBe(3);
    expect(report.summary.crossDomainTeacherScoreRecoveryRows).toBe(3);
    expect(report.summary.crossDomainTeacherScoreRecoveryReady).toBe(1);
    expect(report.summary.crossDomainTeacherScoreRecoveryPersisted).toBe(0);
    expect(report.summary.crossDomainTeacherScoreRecoveryChangedRows).toBe(0);
    expect(report.summary.crossDomainTeacherScoreRecoveryMissingRows).toBe(3);
    expect(report.summary.crossDomainTeacherScoreRecoveryFollowUps).toBe(0);
    expect(report.summary.teacherReviewChecklistPassed).toBe(12);
    expect(report.summary.teacherReviewChecklistTotal).toBe(12);
    expect(report.summary.learningLoopTimelinePassed).toBe(6);
    expect(report.summary.learningLoopTimelineTotal).toBe(6);
    expect(report.summary.acceptanceBoundaryPassed).toBe(1);
    expect(report.summary.acceptanceBoundaryTotal).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaItems).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaReady).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaUnanswered).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaLocked).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaDecisionItems).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaDecisionReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaAllowedDecisions).toBe(4);
    expect(report.summary.teacherAcceptanceAgendaDecisionReplayRows).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaDecisionReplayReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaDecisionReplayLockedRows).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryRows).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryPersisted).toBe(0);
    expect(report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryChangedRows).toBe(0);
    expect(report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryMissingRows).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryFollowUps).toBe(0);
    expect(report.summary.teacherAcceptanceAgendaNextReviewQueueItems).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaNextReviewQueueReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewQueueLockedItems).toBe(0);
    expect(report.summary.teacherAcceptanceAgendaNextReviewHandoffSteps).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaNextReviewHandoffReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewHandoffLockedSteps).toBe(0);
    expect(report.summary.teacherAcceptanceAgendaNextReviewRunbookSteps).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaNextReviewRunbookReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewRunbookLockedChecks).toBe(0);
    expect(report.summary.teacherAcceptanceAgendaNextReviewDryRunRows).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaNextReviewDryRunReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewDryRunNoOpRows).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptRows).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptNeedsReviewRows).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptValidationRows).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptValidationReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptValidationBlockedDecisions).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptReplayRows).toBe(15);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptReplayReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptReplayBlockedDecisions).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanItems).toBe(15);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanBlockedRoutes).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditItems).toBe(15);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditForbiddenTransitions).toBe(75);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketItems).toBe(15);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketCommands).toBe(15);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultRows).toBe(15);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultNotRunRows).toBe(15);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationRows).toBe(15);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationBlockedStatuses).toBe(15);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayRows).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayBlockedStatuses).toBe(15);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueRows).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueMismatchStops).toBe(15);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffSteps).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffMismatchStops).toBe(15);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookItems).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookLockedChecks).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunRows).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunNoOpRows).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptRows).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationRows).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems).toBe(135);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows).toBe(1215);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions).toBe(1215);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems).toBe(1215);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems).toBe(405);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps).toBe(1215);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps).toBe(1215);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems).toBe(1215);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks).toBe(1215);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows).toBe(1215);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows).toBe(1215);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows).toBe(1215);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows).toBe(1215);
    expect(report.summary.executionPlanSteps).toBe(7);
    expect(report.executionPlan).toHaveLength(7);
    expect(report.executionPlan.every((step) => step.plannedOutputFields.length > 0 && step.validation)).toBe(true);
    expect(report.executionPlan.some((step) => step.needsHumanReview)).toBe(true);
    expect(report.traceAlignment).toHaveLength(7);
    expect(report.traceAlignment.every((item) => item.traceStepId && item.validation)).toBe(true);
    expect(report.memoryProvenance).toHaveLength(3);
    expect(report.memoryProvenance.every((item) => item.sources.length > 0)).toBe(true);
    expect(report.memoryProvenance.some((item) => item.appliedRunIds.includes("run-demo-golden-hour"))).toBe(true);
    expect(report.memoryProvenance.flatMap((item) => item.sourceTypes)).toEqual(
      expect.arrayContaining(["Correction", "Teaching example", "Visual demonstration", "Execution history"])
    );
    expect(report.policyEvidence.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "public-trace-only",
        "teacher-review-points",
        "corrections-link-to-runs",
        "trace-validation-required",
        "visual-scenario-matrix",
        "visual-regression-comparison",
        "visual-robustness-stress-suite",
        "review-only-challenge-suite",
        "visual-learning-readiness-rubric",
        "visual-cue-audit-trail",
        "visual-decision-ledger",
        "visual-learning-limits-visible",
        "visual-rule-coverage-matrix",
        "visual-correction-rehearsal",
        "visual-learning-state-transition-audit",
        "visual-confidence-calibration",
        "visual-behavior-scorecard",
        "visual-evidence-replay",
        "visual-red-team-risk-register",
        "visual-uncertainty-escalation-audit",
        "spatial-engineering-teaching-model",
        "domain-learning-workflow",
        "multi-apprentice-cross-domain-validation",
        "cross-domain-teacher-batch-score-replay",
        "cross-domain-teacher-score-recovery-diff",
        "human-teaching-memory-protocol",
        "voice-browser-compatibility-comparison",
        "voice-browser-runtime-batch-gap-diff",
        "visual-teacher-review-worksheet",
        "teacher-review-draft-persistence-recovery",
        "teacher-review-draft-diff-recovery-replay",
        "visual-review-dossier",
        "visual-review-manifest-review-only",
        "packaging-locked"
      ])
    );
    expect(report.policyEvidence.every((item) => item.passed)).toBe(true);
    expect(report.visualReviewDossier).toMatchObject({
      status: "ready_for_teacher_review",
      accepted: false,
      packagingGated: true
    });
    expect(report.visualReviewDossier.sections).toHaveLength(28);
    expect(report.visualReviewDossier.sections.every((section) => section.passed)).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "confidence-calibration")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "rule-coverage-matrix")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "correction-rehearsal")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "learning-state-transition-audit")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "behavior-scorecard")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "robustness-stress-suite")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "visual-evidence-replay")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "red-team-risk-register")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "uncertainty-escalation-audit")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "spatial-engineering-teaching-model")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "domain-learning-workflow")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "cross-domain-validation")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "cross-domain-teacher-score-replay")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "cross-domain-teacher-score-recovery-diff")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "human-teaching-memory-protocol")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "voice-browser-compatibility-comparison")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "voice-browser-runtime-batch-gap-diff")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "teacher-review-worksheet")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "teacher-review-draft-recovery")).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "teacher-review-draft-diff-replay")).toBe(true);
    expect(report.visualReviewDossier.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.userRequirementCoverageAudit).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    });
    expect(report.userRequirementCoverageAudit.items).toHaveLength(14);
    expect(report.userRequirementCoverageAudit.items.every((item) => item.passed)).toBe(true);
    expect(report.userRequirementCoverageAudit.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "visual-learning-before-packaging",
        "chinese-first",
        "code-first-teaching",
        "three-dimensional-coordinate-teaching",
        "math-fitting-multiple-candidates",
        "batch-pattern-learning",
        "domain-self-research-workflow",
        "stepwise-why-and-correction",
        "remember-human-knowledge",
        "conflict-humble-question",
        "voice-teaching-experience",
        "public-trace-no-private-cot",
        "photography-demo-loop"
      ])
    );
    expect(
      report.userRequirementCoverageAudit.items.some(
        (item) =>
          item.id === "visual-learning-before-packaging" &&
          item.reviewState === "locked_until_teacher_acceptance"
      )
    ).toBe(true);
    expect(
      report.userRequirementCoverageAudit.items.every(
        (item) => item.teacherQuestion.includes("老师") && item.evidencePath.length > 0
      )
    ).toBe(true);
    expect(report.userRequirementCoverageAudit.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.handsOnTeachingLesson).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    });
    expect(report.handsOnTeachingLesson.steps).toHaveLength(7);
    expect(report.handsOnTeachingLesson.steps.map((step) => step.phase)).toEqual([
      "domain_orientation",
      "teacher_instruction",
      "code_coordinate",
      "model_fit",
      "next_move_prediction",
      "teacher_correction",
      "memory_replay"
    ]);
    expect(report.handsOnTeachingLesson.steps.every((step) => step.passed)).toBe(true);
    expect(report.handsOnTeachingLesson.steps.every((step) => step.whyThisStep.length > 0)).toBe(true);
    expect(report.handsOnTeachingLesson.steps.every((step) => step.correctionPoint.includes("老师"))).toBe(true);
    expect(
      report.handsOnTeachingLesson.steps.some(
        (step) => step.phase === "memory_replay" && step.reviewState === "locked_until_teacher_acceptance"
      )
    ).toBe(true);
    expect(report.handsOnTeachingLesson.runbook).toMatchObject({
      mode: "hands_on_teaching_lesson_runbook_v1",
      format: "hands_on_teaching_lesson_runbook_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      readySteps: 6,
      lockedSteps: 1,
      passed: true
    });
    expect(report.handsOnTeachingLesson.runbook.items).toHaveLength(7);
    expect(
      report.handsOnTeachingLesson.runbook.items.every(
        (item) =>
          item.evidencePath.startsWith("qualification_report.") &&
          item.anchorId.startsWith("teach-") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true &&
          item.passed
      )
    ).toBe(true);
    expect(report.handsOnTeachingLesson.runbook.exportJson).toContain(
      "hands_on_teaching_lesson_runbook_json_v1"
    );
    expect(report.handsOnTeachingLesson.runbook.blockedActions).toEqual(
      expect.arrayContaining(["Enable rules", "Package", "Release", "Wrap"])
    );
    expect(report.handsOnTeachingLesson.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.visualReviewManifest).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      generatedFrom: "qualification_report",
      verifierCommand: "npm run verify:learning",
      localReviewUrl: "/tasks/task-photo-travel-journal",
      apiReviewUrl: "/api/tasks/task-photo-travel-journal/qualification"
    });
    expect(report.visualReviewManifest.evidenceSections).toHaveLength(28);
    expect(report.visualReviewManifest.evidenceEndpoints).toHaveLength(3);
    expect(report.visualReviewManifest.evidenceEndpoints.every((endpoint) => endpoint.method === "GET" && !endpoint.persisted)).toBe(true);
    expect(report.visualReviewManifest.evidenceEndpoints.map((endpoint) => endpoint.id)).toEqual([
      "task-page",
      "qualification-report",
      "learning-challenge-suite"
    ]);
    expect(report.visualReviewManifest.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.visualConfidenceCalibration).toMatchObject({
      status: "calibrated_for_teacher_review",
      reviewThreshold: 0.82,
      accepted: false,
      packagingGated: true
    });
    expect(report.visualConfidenceCalibration.items).toHaveLength(7);
    expect(report.visualConfidenceCalibration.items.every((item) => item.passed)).toBe(true);
    expect(report.visualConfidenceCalibration.items.filter((item) => item.actualOutcome === "automatic")).toHaveLength(3);
    expect(report.visualConfidenceCalibration.items.filter((item) => item.actualOutcome === "teacher_review")).toHaveLength(4);
    expect(
      report.visualConfidenceCalibration.items.some(
        (item) => item.sourceId === "counterexample-midday" && item.conflictedDecisions > 0
      )
    ).toBe(true);
    expect(report.visualBehaviorScorecard).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    });
    expect(report.visualBehaviorScorecard.cases).toHaveLength(15);
    expect(report.visualBehaviorScorecard.cases.every((item) => item.passed)).toBe(true);
    expect(report.visualBehaviorScorecard.metrics).toHaveLength(5);
    expect(report.visualBehaviorScorecard.metrics.every((metric) => metric.passed)).toBe(true);
    expect(report.visualBehaviorScorecard.metrics.map((metric) => [metric.id, metric.correct, metric.total])).toEqual([
      ["lighting-accuracy", 15, 15],
      ["review-routing", 15, 15],
      ["memory-effect", 11, 11],
      ["automatic-positive-transfer", 6, 6],
      ["conservative-boundary", 9, 9]
    ]);
    expect(report.visualBehaviorScorecard.cases.filter((item) => item.route === "automatic")).toHaveLength(6);
    expect(report.visualBehaviorScorecard.cases.filter((item) => item.route === "teacher_review")).toHaveLength(9);
    expect(report.visualBehaviorScorecard.cases.some((item) => item.id === "robustness-cafe-sign-midday" && item.actualReview)).toBe(true);
    expect(report.visualBehaviorScorecard.cases.some((item) => item.id === "challenge-positive-visual-cue" && item.changedByMemory)).toBe(true);
    expect(report.visualTeacherReviewWorksheet).toMatchObject({
      status: "awaiting_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    });
    expect(report.visualTeacherReviewWorksheet.items).toHaveLength(18);
    expect(report.visualTeacherReviewWorksheet.items.every((item) => item.status === "unanswered")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.every((item) => item.evidenceReady)).toBe(true);
    expect(report.visualTeacherReviewWorksheet.batchReviewExchange).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      format: "teacher_review_batch_json_v1",
      itemCount: 18,
      passed: true
    });
    const batchTemplate = JSON.parse(report.visualTeacherReviewWorksheet.batchReviewExchange.templateJson) as {
      format: string;
      accepted: boolean;
      packagingGated: boolean;
      items: Array<{ id: string; decision: string; note: string }>;
    };
    expect(batchTemplate.format).toBe("teacher_review_batch_json_v1");
    expect(batchTemplate.accepted).toBe(false);
    expect(batchTemplate.packagingGated).toBe(true);
    expect(batchTemplate.items).toHaveLength(report.visualTeacherReviewWorksheet.items.length);
    expect(batchTemplate.items.every((item) => item.decision === "unreviewed" && item.note === "")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.draftVersionComparison).toMatchObject({
      mode: "teacher_review_draft_version_comparison",
      currentVersionId: "teacher-review-draft-current",
      changedItemCount: 9,
      followUpItemCount: 3,
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(report.visualTeacherReviewWorksheet.draftVersionComparison.versions).toHaveLength(3);
    expect(
      report.visualTeacherReviewWorksheet.draftVersionComparison.versions.every(
        (version) => version.reviewOnly && version.accepted === false && version.packagingGated && version.passed
      )
    ).toBe(true);
    expect(report.visualTeacherReviewWorksheet.draftVersionComparison.teacherQuestion).toContain("老师");
    expect(report.visualTeacherReviewWorksheet.draftVersionComparison.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.visualTeacherReviewDraftRecoveryReport).toMatchObject({
      mode: "teacher_review_draft_persistence_recovery_v1",
      status: "no_saved_drafts_yet",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      persistedDraftCount: 0,
      latestVersionId: null,
      restoredFollowUpItems: 0,
      passed: true
    });
    expect(report.visualTeacherReviewDraftRecoveryReport.versions).toHaveLength(0);
    expect(report.visualTeacherReviewDraftRecoveryReport.exportJson).toContain(
      "teacher_review_draft_persistence_recovery_v1"
    );
    expect(report.visualTeacherReviewDraftRecoveryReport.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Enable rules", "Package", "Release", "Wrap"])
    );
    expect(report.visualTeacherReviewDraftReplayReport).toMatchObject({
      mode: "teacher_review_draft_diff_recovery_replay_v1",
      format: "teacher_review_draft_diff_recovery_replay_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      staticVersionDiffs: 3,
      persistedRecoveryDiffs: 0,
      exportedReplayCount: 3,
      passed: true
    });
    expect(report.visualTeacherReviewDraftReplayReport.rows).toHaveLength(3);
    expect(
      report.visualTeacherReviewDraftReplayReport.rows.every(
        (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
      )
    ).toBe(true);
    expect(report.visualTeacherReviewDraftReplayReport.exportJson).toContain(
      "teacher_review_draft_diff_recovery_replay_json_v1"
    );
    expect(report.visualTeacherReviewDraftReplayReport.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Enable rules", "Package", "Release", "Wrap"])
    );
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "positive-transfer-decision")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "evidence-replay-decision")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "behavior-scorecard-decision")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "rule-coverage-decision")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "correction-rehearsal-decision")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "state-transition-decision")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "uncertainty-escalation-decision")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "spatial-fit-selection-decision")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "domain-learning-workflow-decision")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "human-teaching-memory-decision")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "robustness-stress-decision")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "red-team-risk-decision")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.items.some((item) => item.id === "review-only-lock-decision" && item.readinessSignal === "locked")).toBe(true);
    expect(report.visualTeacherReviewWorksheet.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(
      report.visualConfidenceCalibration.items.some(
        (item) => item.sourceId === "positive-visual-cue" && item.averageConfidence >= 0.82
      )
    ).toBe(true);
    expect(report.visualRegressionCases.map((item) => item.id)).toEqual([
      "sunset-language",
      "visual-rim-light",
      "midday-counterexample",
      "ordinary-daylight"
    ]);
    expect(report.visualRegressionCases.every((item) => item.passed)).toBe(true);
    expect(report.visualRegressionCases.filter((item) => item.changedByMemory)).toHaveLength(2);
    expect(report.visualRegressionCases.find((item) => item.id === "visual-rim-light")).toMatchObject({
      baselineLighting: "natural light",
      learnedLighting: "golden hour",
      changedByMemory: true
    });
    expect(report.visualRegressionCases.find((item) => item.id === "midday-counterexample")).toMatchObject({
      baselineLighting: "natural light",
      learnedLighting: "natural light",
      changedByMemory: false,
      learnedNeedsReview: true
    });
    expect(report.visualRobustnessSuite).toMatchObject({
      reviewOnly: true,
      persisted: false,
      accepted: false,
      packagingGated: true,
      passed: 4,
      total: 4
    });
    expect(report.visualRobustnessSuite.cases.map((item) => item.id)).toEqual([
      "low-sun-paraphrase",
      "cafe-sign-midday",
      "warm-orange-noon-wall",
      "long-shadows-overhead-sun"
    ]);
    expect(report.visualRobustnessSuite.cases.every((item) => item.passed)).toBe(true);
    expect(report.visualRobustnessSuite.cases.filter((item) => item.stressType === "false_positive_guard")).toHaveLength(3);
    expect(report.visualRobustnessSuite.cases.find((item) => item.id === "low-sun-paraphrase")).toMatchObject({
      actualLighting: "golden hour",
      needsReview: false,
      changedByMemory: true
    });
    expect(report.visualRobustnessSuite.cases.find((item) => item.id === "cafe-sign-midday")).toMatchObject({
      actualLighting: "natural light",
      needsReview: true,
      changedByMemory: false
    });
    expect(report.visualEvidenceReplay).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    });
    expect(report.visualEvidenceReplay.steps).toHaveLength(7);
    expect(report.visualEvidenceReplay.steps.every((step) => step.passed)).toBe(true);
    expect(report.visualEvidenceReplay.steps.map((step) => step.phase)).toEqual([
      "teach",
      "extract",
      "apply",
      "apply",
      "stress",
      "limits",
      "review"
    ]);
    expect(report.visualEvidenceReplay.steps.some((step) => step.id === "visual-rule-extraction")).toBe(true);
    expect(report.visualEvidenceReplay.steps.some((step) => step.id === "review-only-lock-replay" && step.status === "locked")).toBe(true);
    expect(report.visualRedTeamRegister).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    });
    expect(report.visualRedTeamRegister.risks).toHaveLength(6);
    expect(report.visualRedTeamRegister.risks.every((risk) => risk.passed)).toBe(true);
    expect(report.visualRedTeamRegister.risks.map((risk) => risk.id)).toEqual([
      "lexical-false-positive",
      "material-color-false-positive",
      "shadow-overgeneralization",
      "positive-paraphrase-transfer",
      "unproven-cue-overclaim",
      "premature-packaging"
    ]);
    expect(report.visualRedTeamRegister.risks.filter((risk) => risk.status === "mitigated_for_review")).toHaveLength(4);
    expect(report.visualRedTeamRegister.risks.filter((risk) => risk.status === "needs_teacher_review")).toHaveLength(1);
    expect(report.visualRedTeamRegister.risks.filter((risk) => risk.status === "locked")).toHaveLength(1);
    expect(report.visualRedTeamRegister.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.visualLearningLimits).toHaveLength(8);
    expect(report.visualLearningLimits.some((item) => item.category === "unproven_cue" && item.status === "needs_evidence")).toBe(true);
    expect(report.visualLearningLimits.some((item) => item.category === "teacher_review" && item.status === "review_required")).toBe(true);
    expect(report.visualLearningLimits.some((item) => item.category === "blocked_work" && item.status === "locked")).toBe(true);
    expect(report.visualRuleCoverageMatrix).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    });
    expect(report.visualRuleCoverageMatrix.items).toHaveLength(3);
    expect(report.visualRuleCoverageMatrix.items.every((item) => item.passed)).toBe(true);
    expect(report.visualRuleCoverageMatrix.items.map((item) => item.ruleId)).toEqual([
      "rule-golden-hour",
      "rule-visual-golden-hour-cues",
      "rule-history-run-demo-golden-hour"
    ]);
    expect(report.visualRuleCoverageMatrix.items.some((item) => item.positiveDecisionIds.length > 0)).toBe(true);
    expect(report.visualRuleCoverageMatrix.items.some((item) => item.reviewDecisionIds.length > 0)).toBe(true);
    expect(report.visualRuleCoverageMatrix.items.some((item) => item.sourceTypes.includes("Visual demonstration"))).toBe(true);
    expect(report.visualRuleCoverageMatrix.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.visualCorrectionRehearsal).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      persisted: false,
      accepted: false,
      packagingGated: true
    });
    expect(report.visualCorrectionRehearsal.cases).toHaveLength(2);
    expect(report.visualCorrectionRehearsal.cases.every((item) => item.passed)).toBe(true);
    expect(report.visualCorrectionRehearsal.cases.some((item) => item.id === "positive-low-sun-correction" && item.changedByCandidateRule)).toBe(true);
    expect(report.visualCorrectionRehearsal.cases.some((item) => item.id === "counterexample-sign-correction" && item.errorType === "visual_counterexample_memory" && item.afterReview)).toBe(true);
    expect(report.visualCorrectionRehearsal.cases.every((item) => item.learningTrace.length === 3)).toBe(true);
    expect(report.visualCorrectionRehearsal.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.visualLearningStateAudit).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    });
    expect(report.visualLearningStateAudit.transitions).toHaveLength(6);
    expect(report.visualLearningStateAudit.transitions.every((item) => item.passed)).toBe(true);
    expect(report.visualLearningStateAudit.transitions.map((item) => item.id)).toEqual([
      "baseline-to-text-memory",
      "visual-cue-to-automatic-transfer",
      "learned-memory-to-review-boundary",
      "teacher-correction-to-candidate-transfer",
      "teacher-correction-to-counterexample-boundary",
      "review-ready-to-packaging-lock"
    ]);
    expect(report.visualLearningStateAudit.transitions.filter((item) => item.reviewState === "automatic")).toHaveLength(3);
    expect(report.visualLearningStateAudit.transitions.filter((item) => item.reviewState === "teacher_review")).toHaveLength(2);
    expect(report.visualLearningStateAudit.transitions.some((item) => item.reviewState === "locked")).toBe(true);
    expect(report.visualLearningStateAudit.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.visualUncertaintyEscalationAudit).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    });
    expect(report.visualUncertaintyEscalationAudit.items).toHaveLength(6);
    expect(report.visualUncertaintyEscalationAudit.items.every((item) => item.passed && item.evidenceReady)).toBe(true);
    expect(report.visualUncertaintyEscalationAudit.items.map((item) => item.id)).toEqual([
      "conflicted-visual-memory",
      "unproven-cue-escalation",
      "ordinary-daylight-escalation",
      "counterexample-correction-escalation",
      "red-team-overclaim-escalation",
      "packaging-lock-escalation"
    ]);
    expect(report.visualUncertaintyEscalationAudit.items.filter((item) => item.reviewState === "teacher_review")).toHaveLength(5);
    expect(report.visualUncertaintyEscalationAudit.items.some((item) => item.reviewState === "locked")).toBe(true);
    expect(report.visualUncertaintyEscalationAudit.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.spatialEngineeringTeachingModel).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      teachingInputMode: "code_first",
      humanSelectionRequired: true
    });
    expect(report.spatialEngineeringTeachingModel.codeTeachingProtocol).toMatchObject({
      format: "json_dsl",
      imageUse: "optional_reference_only"
    });
    expect(report.spatialEngineeringTeachingModel.candidates).toHaveLength(7);
    expect(report.spatialEngineeringTeachingModel.candidates.every((candidate) => candidate.passed && candidate.teacherSelectable)).toBe(true);
    expect(report.spatialEngineeringTeachingModel.candidates.map((candidate) => candidate.id)).toEqual([
      "fit-freehand-intent-line",
      "fit-axis-aligned-rail",
      "fit-two-segment-guide",
      "fit-circular-arc-guide",
      "fit-smooth-bezier-guide",
      "fit-multi-segment-spline-guide",
      "fit-surface-patch-guide"
    ]);
    expect(report.spatialEngineeringTeachingModel.candidates.some((candidate) => candidate.model === "circular_arc")).toBe(true);
    expect(report.spatialEngineeringTeachingModel.candidates.some((candidate) => candidate.model === "bezier_spline")).toBe(true);
    expect(
      report.spatialEngineeringTeachingModel.candidates.some(
        (candidate) =>
          candidate.model === "multi_segment_bezier_spline" &&
          candidate.multiSegment?.segmentCount === 2 &&
          candidate.multiSegment.knotPoints.length === 3
      )
    ).toBe(true);
    expect(
      report.spatialEngineeringTeachingModel.candidates.some(
        (candidate) =>
          candidate.model === "surface_patch" &&
          candidate.id === "fit-surface-patch-guide" &&
          candidate.surfacePatch?.fitModel === "local_xz_height_patch" &&
          candidate.surfacePatch.patchCorners.length === 4
      )
    ).toBe(true);
    expect(report.spatialEngineeringTeachingModel.extractedRules).toHaveLength(2);
    expect(report.spatialEngineeringTeachingModel.teachingRehearsals).toHaveLength(7);
    expect(report.spatialEngineeringTeachingModel.guidedGenerationSteps).toHaveLength(4);
    expect(report.spatialEngineeringTeachingModel.constructionPredictionPlans).toHaveLength(7);
    expect(report.spatialEngineeringTeachingModel.directionToleranceChecks).toHaveLength(7);
    expect(report.spatialEngineeringTeachingModel.candidateComparisonMatrix).toHaveLength(7);
    expect(report.spatialEngineeringTeachingModel.candidateComparisonMatrix.every((row) => row.reviewOnly)).toBe(true);
    expect(report.spatialEngineeringTeachingModel.candidateComparisonMatrix.every((row) => row.accepted === false)).toBe(true);
    expect(report.spatialEngineeringTeachingModel.candidateComparisonMatrix.every((row) => row.packagingGated)).toBe(true);
    expect(
      report.spatialEngineeringTeachingModel.candidateComparisonMatrix
        .map((row) => row.recommendedReviewOrder)
        .sort((a, b) => a - b)
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews).toHaveLength(7);
    expect(report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.every((preview) => preview.reviewOnly)).toBe(true);
    expect(report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.every((preview) => preview.accepted === false)).toBe(true);
    expect(report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.every((preview) => preview.packagingGated)).toBe(true);
    expect(
      report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.every(
        (preview) =>
          preview.disabledRuleDrafts.length === 2 &&
          preview.disabledRuleDrafts.every((draft) => draft.willBeEnabled === false) &&
          preview.predictedSteps.every((step) => step.nextStepPrediction.includes("下一步预测")) &&
          preview.correctionRehearsal.secondRoundCandidates.length === 3 &&
          preview.correctionRehearsal.secondRoundCandidates.every(
            (candidate) =>
              candidate.reviewOnly === true &&
              candidate.accepted === false &&
              candidate.packagingGated === true &&
              candidate.regeneratedRuleDrafts.length === 2 &&
              candidate.regeneratedRuleDrafts.every((draft) => draft.willBeEnabled === false) &&
              candidate.regeneratedConflictBoundaries.length >= 4 &&
              candidate.nextStepPrediction.includes("下一步预测")
          )
      )
    ).toBe(true);
    expect(
      report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.every(
        (preview) =>
          preview.correctionRehearsal.secondRoundCandidates.some(
            (candidate) => candidate.id === preview.selectedSecondRoundPreview.selectedSecondRoundCandidateId
          ) &&
          preview.selectedSecondRoundPreview.ruleEnabled === false &&
          preview.selectedSecondRoundPreview.accepted === false &&
          preview.selectedSecondRoundPreview.packagingGated === true &&
          preview.selectedSecondRoundPreview.followUpPlanSteps.length >= 4 &&
          preview.selectedSecondRoundPreview.publicTraceSteps.length >= 4 &&
          preview.selectedSecondRoundPreview.publicTraceSteps.every(
            (step) => step.passed && step.validation.length > 0 && step.confidence > 0 && step.confidence <= 1
          ) &&
          preview.selectedSecondRoundPreview.noOpActions.includes("No packaging") &&
          preview.selectedSecondRoundPreview.blockedActions.includes("Accept technology")
      )
    ).toBe(true);
    expect(report.spatialEngineeringTeachingModel.directionToleranceChecks.every((check) => check.passed)).toBe(true);
    expect(
      report.spatialEngineeringTeachingModel.directionToleranceChecks.every(
        (check) =>
          check.reviewOnly === true &&
          check.accepted === false &&
          check.packagingGated === true &&
          check.teacherQuestion.length > 0 &&
          check.angularDeviationDeg <= check.allowedDeviationDeg
      )
    ).toBe(true);
    expect(
      report.spatialEngineeringTeachingModel.constructionPredictionPlans.every(
        (plan) =>
          plan.accepted === false &&
          plan.packagingGated === true &&
          plan.anchorPoints.length >= 2 &&
          plan.constructionSteps.length >= 3 &&
          plan.constructionSteps.every(
            (step) =>
              step.passed &&
              step.reviewState === "awaiting_teacher_review" &&
              step.validationCheck.length > 0 &&
              step.nextStepPrediction.includes("下一步预测")
          )
      )
    ).toBe(true);
    expect(
      report.spatialEngineeringTeachingModel.guidedGenerationSteps.every(
        (step) =>
          step.passed &&
          step.reviewState === "awaiting_teacher_review" &&
          step.whyThisStep.length > 0 &&
          step.teacherCorrectionSlot.length > 0 &&
          step.nextStepPrediction.includes("下一步预测")
      )
    ).toBe(true);
    expect(report.spatialEngineeringTeachingModel.teachingRehearsals.every((rehearsal) => rehearsal.passed)).toBe(true);
    expect(
      report.spatialEngineeringTeachingModel.teachingRehearsals.every(
        (rehearsal) => rehearsal.memoryPolicy === "preview_only_requires_teacher_confirmation"
      )
    ).toBe(true);
    expect(report.spatialEngineeringTeachingModel.memoryPersistence).toMatchObject({
      mode: "paused_rule_memory",
      apiPath: "/api/spatial-teaching-memories",
      requiresTeacherConfirmation: true,
      autoApplies: false,
      accepted: false,
      packagingGated: true
    });
    expect(report.summary.spatialTeachingRehearsalsReady).toBe(report.summary.spatialTeachingRehearsals);
    expect(report.summary.spatialGuidedGenerationSteps).toBe(4);
    expect(report.summary.spatialGuidedGenerationStepsReady).toBe(4);
    expect(report.summary.spatialConstructionPredictionPlans).toBe(7);
    expect(report.summary.spatialConstructionPredictionPlansReady).toBe(7);
    expect(report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      learnedModel: "sample_mean_variation_envelope"
    });
    expect(
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.parameterRows
    ).toHaveLength(5);
    expect(report.summary.spatialPositionParameterRowsReady).toBe(
      report.summary.spatialPositionParameterRows
    );
    expect(report.summary.spatialPositionParameterReportReady).toBe(1);
    expect(report.spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      learnedModel: "surface_patch_gradient_residual_consensus",
      passed: true
    });
    expect(
      report.spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.samples
    ).toHaveLength(report.summary.spatialSurfacePatchStabilitySamples);
    expect(report.summary.spatialSurfacePatchStabilityReady).toBe(1);
    expect(report.summary.spatialSurfacePatchStabilityOutliers).toBe(
      report.spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.outlierPolicy.outlierCount
    );
    expect(
      report.spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.teacherSelectionReplay
    ).toMatchObject({
      mode: "surface_patch_teacher_selection_replay",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      report.spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.teacherSelectionReplay.options
    ).toHaveLength(report.summary.spatialSurfacePatchSelectionReplays);
    expect(
      report.spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.teacherSelectionReplay.options.every(
        (option) =>
          option.disabledRuleDrafts.every((draft) => draft.willBeEnabled === false) &&
          option.oldKnowledgeConflictBoundaries.length >= 3
      )
    ).toBe(true);
    expect(report.spatialEngineeringTeachingModel.surfacePatchTeachingLens).toMatchObject({
      id: "surface-patch-height-field-lens",
      label: "曲面 patch 教学放大镜",
      fitModel: "local_xz_height_patch",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.equation).toContain("y=");
    expect(report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.patchCorners).toHaveLength(4);
    expect(report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.vectors).toHaveLength(
      report.spatialEngineeringTeachingModel.rawStroke.length
    );
    expect(
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.vectors.every(
        (vector) => vector.heightResidual >= 0
      )
    ).toBe(true);
    expect(report.summary.spatialPausedMemoryRules).toBe(0);
    expect(report.summary.spatialCodePatchMemories).toBe(0);
    expect(report.summary.spatialCodePatchMemoriesReady).toBe(0);
    expect(report.summary.spatialCodePatchMemoryMatches).toBe(0);
    expect(report.summary.spatialCodePatchMemoryMatchesReady).toBe(0);
    expect(report.spatialConstructionCodePatchMemoryReplays).toHaveLength(0);
    expect(report.spatialConstructionCodePatchMemoryMatches).toHaveLength(0);
    expect(report.spatialEngineeringTeachingModel.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.domainLearningWorkflow).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    });
    expect(report.domainLearningWorkflow.stages.map((stage) => stage.phase)).toEqual([
      "self_research",
      "knowledge_map",
      "human_ingest",
      "guided_generation"
    ]);
    expect(report.domainLearningWorkflow.knowledgeNodes).toHaveLength(5);
    expect(report.domainLearningWorkflow.guidedGenerationSteps).toHaveLength(4);
    expect(
      report.domainLearningWorkflow.guidedGenerationSteps.every(
        (step) => step.whyThisStep.length > 0 && step.nextStepPrediction.length > 0
      )
    ).toBe(true);
    expect(
      report.domainLearningWorkflow.guidedGenerationSteps.some((step) => step.nextStepPrediction.includes("下一步"))
    ).toBe(true);
    expect(report.domainLearningWorkflow.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.summary.aiServiceReplacementSchemaChecks).toBe(4);
    expect(report.summary.aiServiceReplacementSteps).toBe(3);
    expect(report.summary.aiServiceReplacementReady).toBe(1);
    expect(report.domainLearningWorkflow.aiServiceReplacementReadiness).toMatchObject({
      mode: "mock_to_real_ai_service_replacement_readiness_v1",
      format: "ai_service_replacement_readiness_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      externalCallsEnabled: false,
      passed: true
    });
    expect(report.domainLearningWorkflow.aiServiceReplacementReadiness.schemaChecks).toHaveLength(
      report.summary.aiServiceReplacementSchemaChecks
    );
    expect(report.domainLearningWorkflow.aiServiceReplacementReadiness.replacementSteps).toHaveLength(
      report.summary.aiServiceReplacementSteps
    );
    expect(
      report.domainLearningWorkflow.aiServiceReplacementReadiness.schemaChecks.every((check) => check.passed)
    ).toBe(true);
    expect(
      report.domainLearningWorkflow.aiServiceReplacementReadiness.replacementSteps.every((step) => step.passed)
    ).toBe(true);
    expect(report.domainLearningWorkflow.aiServiceReplacementReadiness.blockedActions).toEqual(
      expect.arrayContaining(["Call external model", "Enable generated rules", "Accept technology", "Package"])
    );
    expect(report.summary.aiServiceValidationCases).toBe(4);
    expect(report.summary.aiServiceValidationBlockedCases).toBe(3);
    expect(report.summary.aiServiceValidationReady).toBe(1);
    expect(report.domainLearningWorkflow.aiServiceOutputValidationRehearsal).toMatchObject({
      mode: "ai_service_output_validation_rehearsal_v1",
      format: "ai_service_output_validation_rehearsal_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      externalCallsEnabled: false,
      acceptedForTeacherReview: 1,
      blockedCases: 3,
      passed: true
    });
    expect(report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.cases).toHaveLength(
      report.summary.aiServiceValidationCases
    );
    expect(report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.cases.map((item) => item.validationResult)).toEqual(
      expect.arrayContaining([
        "accepted_for_teacher_review",
        "blocked_missing_locks",
        "blocked_schema_error",
        "blocked_side_effect"
      ])
    );
    expect(
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.cases.every(
        (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
      )
    ).toBe(true);
    expect(report.crossDomainValidationReport).toMatchObject({
      mode: "multi_apprentice_cross_domain_review",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stableTransfers: 2,
      reviewBoundaries: 1,
      passed: true
    });
    expect(report.crossDomainValidationReport.cases).toHaveLength(report.summary.crossDomainValidationCases);
    expect(report.crossDomainValidationReport.domainsCovered).toHaveLength(3);
    expect(report.crossDomainValidationReport.apprenticesCovered).toHaveLength(3);
    expect(report.crossDomainValidationReport.cases.map((item) => item.domain)).toEqual(
      expect.arrayContaining(["photography_journal", "spatial_engineering", "human_knowledge"])
    );
    expect(report.crossDomainValidationReport.cases.every((item) => item.passed && item.boundaryCheck.length > 0)).toBe(
      true
    );
    expect(report.crossDomainValidationReport.cases.some((item) => item.reviewState === "needs_teacher_review")).toBe(
      true
    );
    expect(report.crossDomainValidationReport.teacherQuestion).toContain("老师");
    expect(report.crossDomainValidationReport.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.crossDomainValidationReport.teacherBatchScoreReplay).toMatchObject({
      mode: "cross_domain_teacher_batch_score_replay_v1",
      format: "teacher_cross_domain_score_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      averageScore: report.summary.crossDomainTeacherScoreAverage,
      needsFollowUp: report.summary.crossDomainTeacherScoreFollowUps,
      disabledDraftImpacts: report.summary.crossDomainTeacherScoreDisabledDrafts,
      passed: true
    });
    expect(report.crossDomainValidationReport.teacherBatchScoreReplay.items).toHaveLength(
      report.summary.crossDomainTeacherScoreItems
    );
    expect(report.crossDomainValidationReport.teacherBatchScoreReplay.allowedDecisions).toEqual(
      expect.arrayContaining(["approve_for_review", "needs_revision", "boundary_only", "hold"])
    );
    expect(
      report.crossDomainValidationReport.teacherBatchScoreReplay.items.every(
        (item) =>
          item.score >= 0 &&
          item.score <= 100 &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true &&
          item.followUpQuestion.includes("老师")
      )
    ).toBe(true);
    expect(report.crossDomainValidationReport.teacherBatchScoreReplay.items.some((item) => item.decision === "needs_revision")).toBe(
      true
    );
    expect(report.crossDomainValidationReport.teacherBatchScoreReplay.templateJson).toContain(
      "teacher_cross_domain_score_json_v1"
    );
    expect(report.crossDomainValidationReport.teacherBatchScoreReplay.blockedActions).toEqual(
      expect.arrayContaining(["Enable cross-domain rules", "Package", "Release", "Wrap"])
    );
    expect(report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff).toMatchObject({
      mode: "cross_domain_teacher_score_draft_recovery_diff_v1",
      format: "teacher_cross_domain_score_recovery_diff_json_v1",
      status: "no_saved_scores_yet",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      persistedDraftCount: 0,
      changedRows: 0,
      missingRecoveredRows: 3,
      recoveredFollowUps: 0,
      passed: true
    });
    expect(report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.rows).toHaveLength(
      report.summary.crossDomainTeacherScoreRecoveryRows
    );
    expect(
      report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.rows.every(
        (row) => row.recoveredScore === null && row.ruleEnabled === false && row.accepted === false && row.packagingGated
      )
    ).toBe(true);
    expect(report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.exportJson).toContain(
      "teacher_cross_domain_score_recovery_diff_json_v1"
    );
    expect(report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.blockedActions).toEqual(
      expect.arrayContaining(["Enable cross-domain rules", "Package", "Release", "Wrap"])
    );
    expect(report.humanTeachingMemoryProtocol).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    });
    expect(report.humanTeachingMemoryProtocol.rules).toHaveLength(4);
    expect(report.humanTeachingMemoryProtocol.rules.every((rule) => rule.passed)).toBe(true);
    expect(report.humanTeachingMemoryProtocol.rules.some((rule) => rule.appliesTo === "all_future_commands")).toBe(true);
    expect(report.humanTeachingMemoryProtocol.rules.some((rule) => rule.appliesTo === "conflicting_new_knowledge")).toBe(true);
    expect(report.humanTeachingMemoryProtocol.conflictSteps).toHaveLength(4);
    expect(report.humanTeachingMemoryProtocol.conflictSteps.every((step) => step.teacherQuestion.length > 0)).toBe(true);
    expect(report.humanTeachingMemoryProtocol.voiceExperience).toMatchObject({
      mode: "voice_optional",
      passed: true
    });
    expect(report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.ttsPreview).toMatchObject({
      mode: "browser_speech_synthesis_preview",
      language: "zh-CN",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.ttsPreview.utteranceText).toBe(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.spokenText
    );
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.ttsPreview.blockedActions
    ).toEqual(expect.arrayContaining(["Package", "Release", "Wrap"]));
    expect(report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.voiceEngineSelection).toMatchObject({
      mode: "browser_voice_engine_selection_review",
      runtimeVoiceListSource: "speechSynthesis.getVoices",
      requiresRuntimeVoiceList: true,
      preferredVoiceId: "browser-zh-cn-warm-student",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.voiceEngineSelection.candidates
    ).toHaveLength(report.summary.voiceEngineSelectionCandidates);
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.voiceEngineSelection.candidates.every(
        (candidate) =>
          candidate.teacherScoreReplay.replaySource === "teacher_voice_review_replay" &&
          candidate.reviewOnly &&
          candidate.accepted === false &&
          candidate.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.voiceEngineSelection.blockedActions
    ).toEqual(expect.arrayContaining(["Package", "Release", "Wrap"]));
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.browserCompatibilityAudit
    ).toMatchObject({
      mode: "browser_voice_compatibility_audit",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.browserCompatibilityAudit.cases
    ).toHaveLength(report.summary.voiceBrowserCompatibilityBrowsers);
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.browserCompatibilityAudit.cases.map(
        (item) => item.browser
      )
    ).toEqual(expect.arrayContaining(["Chrome", "Edge", "Safari", "Firefox"]));
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.browserCompatibilityAudit
        .recognitionRiskBrowsers
    ).toBe(report.summary.voiceBrowserCompatibilityRecognitionRisks);
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.browserCompatibilityAudit
        .fallbackRequiredBrowsers
    ).toBe(report.summary.voiceBrowserCompatibilityFallbacks);
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.browserCompatibilityAudit.cases.every(
        (item) => item.reviewOnly && item.accepted === false && item.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.browserCompatibilityAudit.blockedActions
    ).toEqual(expect.arrayContaining(["Enable voice-only memory", "Package", "Release", "Wrap"]));
    expect(report.voiceBrowserCompatibilityComparisonReport).toMatchObject({
      mode: "voice_browser_compatibility_export_comparison_v1",
      format: "voice_browser_runtime_review_export_json_v1",
      status: "needs_more_runtime_evidence",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      persistedReviewCount: report.summary.voiceBrowserCompatibilityComparisonPersistedReviews,
      fallbackTestedBrowsers: report.summary.voiceBrowserCompatibilityComparisonFallbackTests,
      passed: true
    });
    expect(report.voiceBrowserCompatibilityComparisonReport.items).toHaveLength(
      report.summary.voiceBrowserCompatibilityComparisonBrowsers
    );
    expect(report.voiceBrowserCompatibilityComparisonReport.items.map((item) => item.browser)).toEqual([
      "Chrome",
      "Edge",
      "Safari",
      "Firefox"
    ]);
    expect(
      report.voiceBrowserCompatibilityComparisonReport.items.every(
        (item) =>
          item.evidenceStatus === "audit_only" &&
          item.ruleEnabled === false &&
          item.voiceOnlyMemoryEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(report.voiceBrowserCompatibilityComparisonReport.exportJson).toContain(
      "voice_browser_runtime_review_export_json_v1"
    );
    expect(report.voiceBrowserCompatibilityComparisonReport.blockedActions).toEqual(
      expect.arrayContaining(["Enable voice-only memory", "Package", "Release", "Wrap"])
    );
    expect(report.voiceBrowserCompatibilityBatchDiffReport).toMatchObject({
      mode: "voice_browser_runtime_batch_gap_diff_v1",
      format: "voice_browser_runtime_batch_gap_diff_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      missingRuntimeReviews: 4,
      runtimeDiffs: 4,
      fallbackGaps: 2,
      passed: true
    });
    expect(report.voiceBrowserCompatibilityBatchDiffReport.rows).toHaveLength(4);
    expect(report.voiceBrowserCompatibilityBatchDiffReport.rows.map((row) => row.completionStatus)).toEqual([
      "needs_runtime_review",
      "needs_runtime_review",
      "needs_runtime_review",
      "needs_runtime_review"
    ]);
    expect(
      report.voiceBrowserCompatibilityBatchDiffReport.rows.every(
        (row) =>
          row.ruleEnabled === false &&
          row.voiceOnlyMemoryEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(report.voiceBrowserCompatibilityBatchDiffReport.exportJson).toContain(
      "voice_browser_runtime_batch_gap_diff_json_v1"
    );
    expect(report.voiceBrowserCompatibilityBatchDiffReport.blockedActions).toEqual(
      expect.arrayContaining(["Enable voice-only memory", "Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.teacherReviewHistory).toMatchObject({
      mode: "teacher_tts_review_history_preview",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.teacherReviewHistory.versions
    ).toHaveLength(report.summary.voiceRestatementReviewVersions);
    expect(
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.teacherReviewHistory.versions.every(
        (version) => version.accepted === false && version.packagingGated === true
      )
    ).toBe(true);
    expect(report.humanTeachingMemoryProtocol.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.teachingPredictionBoard).toMatchObject({
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      metaphor: "chess_like_next_move_prediction"
    });
    expect(report.teachingPredictionBoard.moves).toHaveLength(6);
    expect(report.teachingPredictionBoard.moves.every((move) => move.passed)).toBe(true);
    expect(report.teachingPredictionBoard.moves.map((move) => move.teacherInputMode)).toEqual([
      "domain_context",
      "code_coordinate",
      "candidate_selection",
      "candidate_selection",
      "memory_conflict",
      "durable_memory"
    ]);
    expect(report.teachingPredictionBoard.moves.some((move) => move.label.includes("像下棋一样"))).toBe(true);
    expect(report.teachingPredictionBoard.moves.every((move) => move.teacherCorrectionPoint.length > 0)).toBe(true);
    expect(report.teachingPredictionBoard.moves.every((move) => move.conflictPolicy.length > 0)).toBe(true);
    expect(report.teachingPredictionBoard.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.visualDecisionLedger).toHaveLength(8);
    expect(report.visualDecisionLedger.every((item) => item.expectationPassed)).toBe(true);
    expect(report.visualDecisionLedger.some((item) => item.sourceType === "scenario" && item.decision === "applied")).toBe(true);
    expect(report.visualDecisionLedger.some((item) => item.sourceType === "challenge" && item.decision === "applied")).toBe(true);
    expect(report.visualDecisionLedger.some((item) => item.sourceId === "counterexample-midday" && item.decision === "conflicted" && item.needsReview)).toBe(true);
    expect(report.visualDecisionLedger.some((item) => item.memorySource === "visual_demonstration")).toBe(true);
    expect(report.visualCueAuditTrail).toHaveLength(10);
    expect(report.visualCueAuditTrail.filter((item) => item.passed)).toHaveLength(4);
    expect(report.visualCueAuditTrail.some((item) => item.cue === "warm rim light" && item.cueType === "annotation" && item.passed)).toBe(true);
    expect(
      report.visualCueAuditTrail.some(
        (item) =>
          item.cue === "golden hour" &&
          item.ruleTitles.includes("Dusk words mean golden hour") &&
          item.challengeIds.includes("positive-visual-cue")
      )
    ).toBe(true);
    expect(report.visualCueAuditTrail.some((item) => item.cue === "reflective lake surface" && !item.passed)).toBe(true);
    expect(report.visualLearningReadiness.map((item) => item.id)).toEqual([
      "positive-visual-transfer",
      "counterexample-boundary",
      "ordinary-input-boundary",
      "trace-auditability",
      "memory-source-grounding",
      "review-only-packaging-lock"
    ]);
    expect(report.visualLearningReadiness.every((item) => item.passed)).toBe(true);
    expect(report.visualLearningReadiness.find((item) => item.id === "counterexample-boundary")).toMatchObject({
      status: "review_required"
    });
    expect(report.visualLearningReadiness.find((item) => item.id === "review-only-packaging-lock")).toMatchObject({
      status: "locked"
    });
    expect(report.challengeSuite).toMatchObject({
      reviewOnly: true,
      persisted: false,
      accepted: false,
      packagingGated: true,
      passed: 3,
      total: 3
    });
    expect(report.challengeSuite.items.map((item) => item.id)).toEqual([
      "positive-visual-cue",
      "counterexample-midday",
      "ordinary-daylight"
    ]);
    expect(report.challengeSuite.items.every((item) => item.probe.expectationResult.passed)).toBe(true);
    expect(report.visualLearningScenarios.map((scenario) => scenario.id)).toEqual([
      "sunset-language",
      "visual-rim-light",
      "midday-counterexample",
      "ordinary-daylight"
    ]);
    expect(report.visualLearningScenarios.every((scenario) => scenario.passed)).toBe(true);
    expect(report.visualLearningScenarios.every((scenario) => scenario.traceSummary.length === 7)).toBe(true);
    expect(
      report.visualLearningScenarios.every((scenario) =>
        scenario.traceSummary.every((step) => step.stepName && step.validation && typeof step.confidence === "number")
      )
    ).toBe(true);
    expect(report.visualLearningScenarios.find((scenario) => scenario.id === "midday-counterexample")).toMatchObject({
      actualLighting: "natural light",
      needsReview: true
    });
    expect(report.capabilityBoundary.map((item) => item.id)).toEqual([
      "automatic-golden-hour",
      "teacher-review-boundary",
      "memory-provenance-boundary",
      "packaging-boundary"
    ]);
    expect(report.capabilityBoundary.find((item) => item.id === "automatic-golden-hour")).toMatchObject({
      passed: true,
      status: "ready",
      scenarioIds: ["sunset-language", "visual-rim-light"]
    });
    expect(report.capabilityBoundary.find((item) => item.id === "teacher-review-boundary")).toMatchObject({
      passed: true,
      status: "review_required",
      scenarioIds: ["midday-counterexample", "ordinary-daylight"]
    });
    expect(report.capabilityBoundary.find((item) => item.id === "packaging-boundary")).toMatchObject({
      passed: true,
      status: "locked"
    });
    expect(report.capabilityBoundary.every((item) => item.passed)).toBe(true);
    expect(report.teacherReviewChecklist).toHaveLength(12);
    expect(report.teacherReviewChecklist.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "mvp-create-apprentice",
        "mvp-create-task",
        "mvp-visual-workflow",
        "mvp-execute-task",
        "mvp-structured-trace",
        "mvp-correct-output",
        "mvp-extract-rules",
        "mvp-apply-next-run",
        "demo-photography-journal",
        "multi-source-learning",
        "guardrails-visible",
        "packaging-waits-for-teacher"
      ])
    );
    expect(report.teacherReviewChecklist.every((item) => item.passed)).toBe(true);
    expect(report.learningLoopTimeline.map((item) => item.id)).toEqual([
      "human-teaches",
      "ai-executes-before",
      "human-corrects",
      "system-extracts-rules",
      "ai-improves-next-run",
      "teacher-reviews-transparency"
    ]);
    expect(report.learningLoopTimeline.every((item) => item.passed)).toBe(true);
    expect(report.teacherAcceptanceBoundary).toMatchObject({
      mode: "visual_learning_review_only",
      accepted: false,
      packagingGated: true,
      status: "pending_teacher_acceptance",
      exposedAcceptanceAction: false
    });
    expect(report.teacherAcceptanceBoundary.blockedWork).toEqual(
      expect.arrayContaining(["Packaging", "Release", "Wrapping"])
    );
    expect(report.teacherAcceptanceBoundary.allowedWork).toEqual(
      expect.arrayContaining(["Visual learning review", "Evidence inspection", "Verifier rerun"])
    );
    expect(report.teacherAcceptanceEvidenceAgenda).toMatchObject({
      mode: "teacher_acceptance_evidence_gap_agenda_v1",
      format: "teacher_acceptance_evidence_gap_agenda_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      readyItems: 3,
      unansweredItems: 1,
      lockedItems: 1,
      passed: true
    });
    expect(report.teacherAcceptanceEvidenceAgenda.items).toHaveLength(
      report.summary.teacherAcceptanceAgendaItems
    );
    expect(report.teacherAcceptanceEvidenceAgenda.items.map((item) => item.readiness)).toEqual(
      expect.arrayContaining([
        "ready_for_teacher_decision",
        "needs_teacher_answer",
        "locked_until_teacher_acceptance"
      ])
    );
    expect(
      report.teacherAcceptanceEvidenceAgenda.items.every(
        (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
      )
    ).toBe(true);
    expect(report.teacherAcceptanceEvidenceAgenda.exportJson).toContain(
      "teacher_acceptance_evidence_gap_agenda_json_v1"
    );
    expect(report.teacherAcceptanceEvidenceAgenda.blockedActions).toEqual(
      expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"])
    );
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange).toMatchObject({
      mode: "teacher_acceptance_agenda_decision_exchange_v1",
      format: "teacher_acceptance_agenda_decision_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 5,
      passed: true
    });
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.allowedDecisions).toEqual(
      expect.arrayContaining(["ready_for_review", "needs_revision", "hold", "locked"])
    );
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.items).toHaveLength(
      report.summary.teacherAcceptanceAgendaDecisionItems
    );
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.items.every(
        (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
      )
    ).toBe(true);
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.items.some((item) => item.proposedDecision === "locked")).toBe(
      true
    );
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.templateJson).toContain(
      "teacher_acceptance_agenda_decision_json_v1"
    );
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay).toMatchObject({
      mode: "teacher_acceptance_agenda_decision_replay_v1",
      format: "teacher_acceptance_agenda_decision_replay_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 5,
      packagingLockedRows: 5,
      passed: true
    });
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.rows).toHaveLength(
      report.summary.teacherAcceptanceAgendaDecisionReplayRows
    );
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.rows.every(
        (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.rows.some(
        (row) => row.simulatedDecision === "locked" && row.packagingImpact.includes("Packaging remains gated")
      )
    ).toBe(true);
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.exportJson).toContain(
      "teacher_acceptance_agenda_decision_replay_json_v1"
    );
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery).toMatchObject({
      mode: "teacher_acceptance_agenda_decision_draft_recovery_v1",
      format: "teacher_acceptance_agenda_decision_draft_recovery_json_v1",
      status: "no_saved_decision_draft_yet",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      persistedDraftCount: 0,
      changedRows: 0,
      missingRecoveredRows: 5,
      followUpRows: 0,
      passed: true
    });
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.rows.every(
        (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
      )
    ).toBe(true);
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.exportJson).toContain(
      "teacher_acceptance_agenda_decision_draft_recovery_json_v1"
    );
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_queue_v1",
      format: "teacher_acceptance_agenda_next_review_queue_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 5,
      lockedItems: 0,
      passed: true
    });
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.items.every(
        (item) => item.reason === "missing_decision" && item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
      )
    ).toBe(true);
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_queue_json_v1"
    );
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_handoff_v1",
      format: "teacher_acceptance_agenda_next_review_handoff_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      queueItemCount: 5,
      stepCount: 5,
      lockedSteps: 0,
      passed: true
    });
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.steps.every(
        (step) =>
          step.reason === "missing_decision" &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_handoff_json_v1"
    );
    expect(report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_runbook_v1",
      format: "teacher_acceptance_agenda_next_review_runbook_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stepCount: 5,
      lockedChecks: 0,
      passed: true
    });
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.steps.every(
        (step) =>
          step.phase === "inspect_evidence" &&
          step.evidencePath.includes("draftRecovery.rows") &&
          step.stopCondition.includes("Stop") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.exportJson
    ).toContain("teacher_acceptance_agenda_next_review_runbook_json_v1");
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
    ).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_dry_run_audit_v1",
      format: "teacher_acceptance_agenda_next_review_dry_run_audit_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 5,
      noOpRows: 5,
      passed: true
    });
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.rows.every(
        (row) =>
          row.simulatedResult === "awaiting_teacher_review" &&
          row.lockAssertion.includes("packagingGated=true") &&
          row.noOpActions.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .exportJson
    ).toContain("teacher_acceptance_agenda_next_review_dry_run_audit_json_v1");
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate
    ).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_template_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_template_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 5,
      needsReviewRows: 5,
      passed: true
    });
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.length > 0 &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.exportJson
    ).toContain("teacher_acceptance_agenda_next_review_receipt_template_json_v1");
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation
    ).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_validation_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_validation_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 5,
      blockedDecisionCount: 5,
      passed: true
    });
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
        (row) =>
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.blockedDecision === "accepted" &&
          row.invalidIf.includes("accepted=true") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.exportJson
    ).toContain("teacher_acceptance_agenda_next_review_receipt_validation_json_v1");
    const receiptDecisionReplay =
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay;
    expect(receiptDecisionReplay).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_decision_replay_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_decision_replay_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 15,
      blockedDecisionCount: 5,
      passed: true
    });
    expect(
      receiptDecisionReplay.rows.every(
        (row) =>
          row.blockedDecisionReminder.includes("accepted") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(receiptDecisionReplay.rows.some((row) => row.simulatedDecision === "blocked")).toBe(true);
    expect(receiptDecisionReplay.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_decision_replay_json_v1"
    );
    expect(receiptDecisionReplay.followUpPlan).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 15,
      blockedRouteCount: 5,
      passed: true
    });
    expect(
      receiptDecisionReplay.followUpPlan.items.every(
        (item) =>
          item.lockReminder.includes("accepted remains blocked") &&
          item.stopCondition.includes("packagingGated=false") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      receiptDecisionReplay.followUpPlan.items.some(
        (item) => item.plannedRoute === "blocked_receipt_escalation"
      )
    ).toBe(true);
    expect(receiptDecisionReplay.followUpPlan.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_json_v1"
    );
    expect(receiptDecisionReplay.followUpPlan.lockAudit).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 15,
      forbiddenTransitionCount: 75,
      passed: true
    });
    expect(
      receiptDecisionReplay.followUpPlan.lockAudit.items.every(
        (item) =>
          item.forbiddenTransitions.includes("decision=accepted") &&
          item.forbiddenTransitions.includes("packagingGated=false") &&
          item.noOpAssertion.includes("no-op") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(receiptDecisionReplay.followUpPlan.lockAudit.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_json_v1"
    );
    expect(receiptDecisionReplay.followUpPlan.lockAudit.verificationPacket).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 15,
      commandCount: 15,
      passed: true
    });
    expect(
      receiptDecisionReplay.followUpPlan.lockAudit.verificationPacket.items.every(
        (item) =>
          item.evidencePath.includes("followUpPlan.lockAudit") &&
          item.verificationCommand === "npm.cmd run verify:learning" &&
          item.expectedResult.includes("accepted=false") &&
          item.expectedResult.includes("packaging=true") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(receiptDecisionReplay.followUpPlan.lockAudit.verificationPacket.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_json_v1"
    );
    expect(receiptDecisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 15,
      notRunRows: 15,
      passed: true
    });
    expect(
      receiptDecisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.items.every(
        (item) =>
          item.defaultStatus === "not_run_yet" &&
          item.statusOptions.includes("mismatch_blocked") &&
          item.nextReviewerNotePlaceholder.includes("not technology acceptance") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(receiptDecisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_json_v1"
    );
    expect(receiptDecisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 15,
      blockedStatusCount: 15,
      passed: true
    });
    expect(
      receiptDecisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.items.every(
        (item) =>
          item.allowedStatuses.includes("not_run_yet") &&
          item.allowedStatuses.includes("matched_expected") &&
          item.allowedStatuses.includes("mismatch_blocked") &&
          item.blockedStatus === "accepted" &&
          item.invalidIf.includes("accepted=true") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(receiptDecisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_json_v1"
    );
    const resultReplay =
      receiptDecisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay;
    expect(resultReplay).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 45,
      blockedStatusCount: 15,
      passed: true
    });
    expect(
      resultReplay.items.every(
        (item) =>
          item.blockedStatusReminder.includes("accepted") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.items.some((item) => item.simulatedStatus === "mismatch_blocked")).toBe(true);
    expect(resultReplay.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_json_v1"
    );
    expect(resultReplay.nextReviewQueue).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 45,
      notRunRows: 15,
      matchedRows: 15,
      mismatchStopRows: 15,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.items.every(
        (item) =>
          item.stopCondition.includes("accepted") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_json_v1"
    );
    expect(resultReplay.nextReviewQueue.handoff).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stepCount: 45,
      mismatchStopSteps: 15,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.steps.every(
        (step) =>
          step.expectedLockedResult.includes("accepted=false") &&
          step.blockedIf.includes("accepted=true") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_json_v1"
    );
    expect(resultReplay.nextReviewQueue.handoff.runbook).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 45,
      lockedChecks: 45,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.items.every(
        (item) =>
          item.lockAssertion.includes("accepted=false") &&
          item.stopCondition.includes("accepted=true") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_json_v1"
    );
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 45,
      noOpRows: 45,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.rows.every(
        (row) =>
          row.lockAssertion.includes("accepted=false") &&
          row.noOpActions.includes("Do not accept technology") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_json_v1"
    );
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 45,
      needsReviewRows: 45,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_json_v1"
    );
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 45,
      blockedDecisionRows: 45,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
        (row) =>
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.allowedDecisions.includes("blocked") &&
          row.allowedDecisions.includes("ready_for_follow_up") &&
          row.blockedDecision === "accepted" &&
          row.invalidIf.includes("decision=accepted") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
    );
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 135,
      blockedDecisionRows: 45,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rows.every(
        (row) =>
          ["needs_teacher_review", "blocked", "ready_for_follow_up"].includes(row.simulatedDecision) &&
          row.blockedDecisionReminder.includes("accepted remains blocked") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
    );
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 135,
      blockedItems: 45,
      readyForFollowUpItems: 45,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items.every(
        (item) =>
          ["needs_teacher_review_queue", "blocked_queue", "ready_for_follow_up_queue"].includes(item.queueLane) &&
          item.blockedTransitions.includes("accepted") &&
          item.blockedTransitions.includes("ruleEnabled=true") &&
          item.blockedTransitions.includes("packagingGated=false") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
    );
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stepCount: 135,
      blockedSteps: 45,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.steps.every(
        (step) =>
          step.blockedIf.includes("accepted") &&
          step.blockedIf.includes("ruleEnabled=true") &&
          step.blockedIf.includes("packagingGated=false") &&
          step.expectedLockedResult.includes("accepted=false") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
    );
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 135,
      lockedChecks: 135,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.items.every(
        (item) =>
          item.lockAssertion.includes("ruleEnabled=false") &&
          item.lockAssertion.includes("accepted=false") &&
          item.lockAssertion.includes("packagingGated=true") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
    );
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 135,
      noOpRows: 135,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rows.every(
        (row) =>
          row.noOpActions.includes("Package") &&
          row.noOpActions.includes("Release") &&
          row.noOpActions.includes("Wrap") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
    );
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 135,
      needsReviewRows: 135,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.blockerQuestion.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
    );
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 135,
      blockedDecisionRows: 135,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
        (row) =>
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.allowedDecisions.includes("blocked") &&
          row.allowedDecisions.includes("ready_for_follow_up") &&
          row.blockedDecision === "accepted" &&
          row.invalidIf.includes("decision=accepted") &&
          row.invalidIf.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
    );
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 405,
      blockedDecisionRows: 405,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rows.every(
        (row) =>
          ["needs_teacher_review", "blocked", "ready_for_follow_up"].includes(row.simulatedDecision) &&
          row.blockedDecisionReminder.includes("accepted") &&
          row.consequence.includes("does not accept technology") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rows.some(
        (row) => row.simulatedDecision === "blocked"
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
    );
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 405,
      blockedItems: 135,
      readyForFollowUpItems: 135,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items.every(
        (item) =>
          ["needs_teacher_review_queue", "blocked_queue", "ready_for_follow_up_queue"].includes(item.queueLane) &&
          item.blockedTransitions.includes("accepted") &&
          item.blockedTransitions.includes("ruleEnabled=true") &&
          item.blockedTransitions.includes("packagingGated=false") &&
          item.stopCondition.includes("Package") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
    );
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stepCount: 405,
      blockedStepCount: 405,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.steps.every(
        (step) =>
          step.verifierCommand === "npm.cmd run verify:learning" &&
          step.expectedLockedResult.includes("ruleEnabled=false") &&
          step.expectedLockedResult.includes("accepted=false") &&
          step.expectedLockedResult.includes("packagingGated=true") &&
          step.blockedIf.includes("accepted") &&
          step.blockedIf.includes("Package") &&
          step.blockedIf.includes("Release") &&
          step.blockedIf.includes("Wrap") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.exportJson
    ).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
    );
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 405,
      lockedChecks: 405,
      passed: true
    });
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.items.every(
        (item) =>
          item.verificationCommand === "npm.cmd run verify:learning" &&
          item.lockAssertion.includes("ruleEnabled=false") &&
          item.lockAssertion.includes("accepted=false") &&
          item.lockAssertion.includes("packagingGated=true") &&
          item.stopCondition.includes("Package") &&
          item.stopCondition.includes("Release") &&
          item.stopCondition.includes("Wrap") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.exportJson
    ).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
    );
    const deepestRunbookDryRun =
      resultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit;
    expect(deepestRunbookDryRun).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 405,
      noOpRows: 405,
      passed: true
    });
    expect(
      deepestRunbookDryRun.rows.every(
        (row) =>
          row.noOpActions.includes("Package") &&
          row.noOpActions.includes("Release") &&
          row.noOpActions.includes("Wrap") &&
          row.lockAssertion.includes("ruleEnabled=false") &&
          row.lockAssertion.includes("accepted=false") &&
          row.lockAssertion.includes("packagingGated=true") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRun.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
    );
    const deepestRunbookDryRunReceipt = deepestRunbookDryRun.receiptTemplate;
    expect(deepestRunbookDryRunReceipt).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 405,
      needsReviewRows: 405,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceipt.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.blockerQuestion.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceipt.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
    );
    const deepestRunbookDryRunReceiptValidation = deepestRunbookDryRunReceipt.validation;
    expect(deepestRunbookDryRunReceiptValidation).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 405,
      blockedDecisionRows: 405,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidation.rows.every(
        (row) =>
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.allowedDecisions.includes("blocked") &&
          row.allowedDecisions.includes("ready_for_follow_up") &&
          row.blockedDecision === "accepted" &&
          row.invalidIf.includes("decision=accepted") &&
          row.invalidIf.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidation.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
    );
    const deepestRunbookDryRunReceiptValidationReplay = deepestRunbookDryRunReceiptValidation.replay;
    expect(deepestRunbookDryRunReceiptValidationReplay).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 1215,
      blockedDecisionRows: 1215,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidationReplay.rows.every(
        (row) =>
          ["needs_teacher_review", "blocked", "ready_for_follow_up"].includes(row.simulatedDecision) &&
          row.blockedDecisionReminder.includes("accepted remains blocked") &&
          row.consequence.includes("does not accept technology") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidationReplay.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
    );
    const deepestRunbookDryRunReceiptValidationReplayQueue = deepestRunbookDryRunReceiptValidationReplay.nextReviewQueue;
    expect(deepestRunbookDryRunReceiptValidationReplayQueue).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 1215,
      blockedItems: 405,
      readyForFollowUpItems: 405,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidationReplayQueue.items.every(
        (item) =>
          ["needs_teacher_review_queue", "blocked_queue", "ready_for_follow_up_queue"].includes(item.queueLane) &&
          item.blockedTransitions.includes("accepted") &&
          item.blockedTransitions.includes("ruleEnabled=true") &&
          item.blockedTransitions.includes("packagingGated=false") &&
          item.blockedTransitions.includes("Package") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidationReplayQueue.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
    );
    const deepestRunbookDryRunReceiptValidationReplayQueueHandoff = deepestRunbookDryRunReceiptValidationReplayQueue.handoff;
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoff).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stepCount: 1215,
      blockedSteps: 1215,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidationReplayQueueHandoff.steps.every(
        (step) =>
          step.handoffInstruction.includes("review-only") &&
          step.verifierCommand === "npm.cmd run verify:learning" &&
          step.expectedLockedResult.includes("ruleEnabled=false") &&
          step.expectedLockedResult.includes("accepted=false") &&
          step.expectedLockedResult.includes("packagingGated=true") &&
          step.blockedIf.includes("accepted") &&
          step.blockedIf.includes("Package") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoff.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
    );
    const deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbook =
      deepestRunbookDryRunReceiptValidationReplayQueueHandoff.runbook;
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbook).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 1215,
      lockedChecks: 1215,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbook.items.every(
        (item) =>
          item.verificationCommand === "npm.cmd run verify:learning" &&
          item.lockAssertion.includes("ruleEnabled=false") &&
          item.lockAssertion.includes("accepted=false") &&
          item.lockAssertion.includes("packagingGated=true") &&
          item.stopCondition.includes("Package") &&
          item.stopCondition.includes("Release") &&
          item.stopCondition.includes("Wrap") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbook.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
    );
    const deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun =
      deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbook.dryRunAudit;
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 1215,
      noOpRows: 1215,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun.rows.every(
        (row) =>
          row.expectedEvidence.includes("ruleEnabled=false") &&
          row.expectedEvidence.includes("accepted=false") &&
          row.expectedEvidence.includes("packagingGated=true") &&
          row.noOpActions.includes("Package") &&
          row.noOpActions.includes("Release") &&
          row.noOpActions.includes("Wrap") &&
          row.lockAssertion.includes("ruleEnabled=false") &&
          row.lockAssertion.includes("accepted=false") &&
          row.lockAssertion.includes("packagingGated=true") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
    );
    const deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceipt =
      deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun.receiptTemplate;
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceipt).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 1215,
      needsReviewRows: 1215,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceipt.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.blockerQuestion.includes("ruleEnabled=true") &&
          row.blockerQuestion.includes("packagingGated=false") &&
          row.blockerQuestion.includes("Package") &&
          row.blockerQuestion.includes("Release") &&
          row.blockerQuestion.includes("Wrap") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceipt.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
    );
    expect(report.learningDeltas[0]).toMatchObject({
      sourceRunId: "run-demo-before-teaching",
      appliedRunId: "run-demo-golden-hour",
      beforeLighting: "natural light",
      afterLighting: "golden hour"
    });
    expect(report.learningDeltas[0].fieldChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "lightingCondition",
          before: "natural light",
          after: "golden hour"
        }),
        expect.objectContaining({
          field: "photographyAdvice"
        }),
        expect.objectContaining({
          field: "recommendedTitles"
        })
      ])
    );
    expect(report.requirements.every((requirement) => requirement.passed)).toBe(true);
    expect(report.codexCapabilityTransferReport).toMatchObject({
      mode: "codex_capability_transfer_review_v1",
      format: "codex_capability_transfer_review_json_v1",
      itemCount: 5,
      readyItems: 5,
      lockedItems: 5,
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(report.codexCapabilityTransferReport.transplantDraft).toMatchObject({
      mode: "codex_capability_transplant_draft_v1",
      format: "codex_capability_transplant_draft_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 5,
      readyRows: 5,
      lockedRows: 5,
      passed: true
    });
    expect(report.summary.codexCapabilityTransplantRehearsalRows).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalReady).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalLocked).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultRows).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultNotRun).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationBlockedStatuses).toBe(5);
    expect(report.codexCapabilityTransferReport.transplantDraft.rehearsal).toMatchObject({
      mode: "codex_capability_transplant_rehearsal_v1",
      format: "codex_capability_transplant_rehearsal_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 5,
      readyRows: 5,
      lockedRows: 5,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.rows.every(
        (row) =>
          row.structuredTracePreview.length >= 6 &&
          row.noOpActions.includes("No real tool dispatch") &&
          row.noOpActions.includes("No packaging transition") &&
          row.blockedTransitions.includes("Accept technology") &&
          row.blockedTransitions.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(report.codexCapabilityTransferReport.transplantDraft.rehearsal.exportJson).toContain(
      "codex_capability_transplant_rehearsal_json_v1"
    );
    expect(report.summary.codexCapabilityTransplantRehearsalResultRows).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultNotRun).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultLocked).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationRows).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReady).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationBlockedStatuses).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayRows).toBe(15);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayReady).toBe(15);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayBlockedStatuses).toBe(15);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueItems).toBe(15);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueReady).toBe(15);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueuePendingVerifier).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueMatchedEvidence).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalResultValidationReplayQueueMismatchBlockers).toBe(5);
    expect(report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate).toMatchObject({
      mode: "codex_capability_transplant_rehearsal_result_template_v1",
      format: "codex_capability_transplant_rehearsal_result_template_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 5,
      notRunRows: 5,
      lockedRows: 5,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.rows.every(
        (row) =>
          row.defaultStatus === "not_run_yet" &&
          row.observedOutputPlaceholder.includes("do not include private reasoning") &&
          row.mismatchQuestion.includes("imply acceptance") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation).toMatchObject({
      mode: "codex_capability_transplant_rehearsal_result_validation_v1",
      format: "codex_capability_transplant_rehearsal_result_validation_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 5,
      readyRows: 5,
      blockedStatusRows: 5,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.rows.every(
        (row) =>
          row.allowedStatuses.includes("not_run_yet") &&
          row.allowedStatuses.includes("matched_expected") &&
          row.allowedStatuses.includes("mismatch_blocked") &&
          row.blockedStatus === "accepted" &&
          row.lockAssertion.includes("cannot save acceptance") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay
    ).toMatchObject({
      mode: "codex_capability_transplant_rehearsal_result_validation_replay_v1",
      format: "codex_capability_transplant_rehearsal_result_validation_replay_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 15,
      readyRows: 15,
      blockedStatusRows: 15,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.rows.every(
        (row) =>
          ["not_run_yet", "matched_expected", "mismatch_blocked"].includes(row.simulatedStatus) &&
          row.nextReviewAction.length > 0 &&
          row.consequence.toLowerCase().includes("no") &&
          row.blockedStatusReminder.includes("accepted") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
    ).toMatchObject({
      mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_v1",
      format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 15,
      readyItems: 15,
      pendingVerifierItems: 5,
      matchedEvidenceItems: 5,
      mismatchBlockerItems: 5,
      lockedItems: 15,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.items.every(
        (item) =>
          ["pending_verifier", "matched_evidence_follow_up", "mismatch_blocker"].includes(item.lane) &&
          item.reviewerAction.length > 0 &&
          item.evidenceRequest.length > 0 &&
          item.continueCondition.length > 0 &&
          item.stopCondition.toLowerCase().includes("stop") &&
          item.blockedTransitions.includes("Package") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff
    ).toMatchObject({
      mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_v1",
      format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stepCount: 15,
      lockedSteps: 15,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.steps.every(
        (step) =>
          step.order > 0 &&
          step.instruction.includes("Review") &&
          step.evidencePath.includes("nextReviewQueue.items") &&
          step.verifierCommand === "npm.cmd run verify:learning" &&
          step.expectedLockedResult.includes("no rule") &&
          step.blockedTransitions.includes("Package") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook
    ).toMatchObject({
      mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 15,
      lockedChecks: 15,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.items.every(
        (item) =>
          item.order > 0 &&
          item.reviewerAction.includes("Run locked review") &&
          item.evidencePath.includes("nextReviewQueue.handoff.steps") &&
          item.verificationCommand === "npm.cmd run verify:learning" &&
          item.continueCondition.includes("review-only") &&
          item.stopCondition.toLowerCase().includes("stop") &&
          item.lockAssertion.includes("ruleEnabled=false") &&
          item.blockedTransitions.includes("Package") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit
    ).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 15,
      lockedRows: 15,
      noOpRows: 15,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rows.every(
        (row) =>
          row.order > 0 &&
          row.expectedEvidence.includes("review-only") &&
          row.lockAssertion.includes("ruleEnabled=false") &&
          row.noOpAction.includes("do not save acceptance") &&
          row.reviewerNote.includes("review-only") &&
          row.blockedTransitions.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate
    ).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 15,
      needsReviewRows: 15,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
        (row) =>
          row.order > 0 &&
          row.observedEvidence.includes("verifier evidence") &&
          row.blockerQuestion.includes("blocked") &&
          row.nextReviewNote.includes("review-only") &&
          row.defaultDecision === "needs_teacher_review" &&
          row.blockedTransitions.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation
    ).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 15,
      blockedDecisionRows: 15,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
        (row) =>
          row.order > 0 &&
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.allowedDecisions.includes("blocked") &&
          row.allowedDecisions.includes("ready_for_follow_up") &&
          row.blockedDecision === "accepted" &&
          row.validationRule.includes("must not accept technology") &&
          row.invalidIf.includes("decision=accepted") &&
          row.invalidIf.includes("blockedActions missing Package") &&
          row.nextActionIfInvalid.includes("Stop") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay
    ).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 45,
      readyRows: 45,
      blockedDecisionRows: 45,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rows.every(
        (row) =>
          row.order > 0 &&
          ["needs_teacher_review", "blocked", "ready_for_follow_up"].includes(row.simulatedDecision) &&
          row.nextReviewAction.length > 0 &&
          row.consequence.includes("does not accept technology") &&
          row.blockedDecisionReminder.includes("accepted remains blocked") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
    ).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 45,
      readyItems: 45,
      missingTeacherEvidenceItems: 15,
      blockedItems: 15,
      readyForFollowUpItems: 15,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items.every(
        (item) =>
          item.order > 0 &&
          ["missing_teacher_evidence", "blocked_route", "review_only_follow_up"].includes(item.lane) &&
          item.reviewerAction.length > 0 &&
          item.evidenceRequest.length > 0 &&
          item.continueCondition.length > 0 &&
          item.stopCondition.includes("Stop") &&
          item.blockedTransitions.includes("Package") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
    ).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stepCount: 45,
      lockedSteps: 45,
      blockedSteps: 45,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.steps.every(
        (step) =>
          step.order > 0 &&
          step.instruction.includes("review-only") &&
          step.evidencePath.includes("nextReviewQueue.items") &&
          step.verifierCommand === "npm.cmd run verify:learning" &&
          step.expectedLockedResult.includes("ruleEnabled=false") &&
          step.expectedLockedResult.includes("accepted=false") &&
          step.expectedLockedResult.includes("packagingGated=true") &&
          step.blockedTransitions.includes("Package") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook
    ).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 45,
      lockedChecks: 45,
      blockedItems: 45,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.items.every(
        (item) =>
          item.order > 0 &&
          item.reviewerAction.includes("Run locked review") &&
          item.evidencePath.includes("nextReviewQueue.handoff.steps") &&
          item.verificationCommand === "npm.cmd run verify:learning" &&
          item.continueCondition.includes("review-only") &&
          item.stopCondition.includes("Stop") &&
          item.lockAssertion.includes("ruleEnabled=false") &&
          item.lockAssertion.includes("accepted=false") &&
          item.lockAssertion.includes("packagingGated=true") &&
          item.blockedTransitions.includes("Package") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
    ).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 45,
      lockedRows: 45,
      noOpRows: 45,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rows.every(
        (row) =>
          row.order > 0 &&
          row.expectedEvidence.includes("review-only") &&
          row.lockAssertion.includes("ruleEnabled=false") &&
          row.lockAssertion.includes("accepted=false") &&
          row.lockAssertion.includes("packagingGated=true") &&
          row.noOpAction.includes("do not save acceptance") &&
          row.noOpAction.includes("package") &&
          row.reviewerNote.includes("review-only") &&
          row.blockedTransitions.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
    ).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 45,
      needsReviewRows: 45,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
        (row) =>
          row.order > 0 &&
          row.observedEvidence.includes("verifier evidence") &&
          row.blockerQuestion.includes("blocked") &&
          row.nextReviewNote.includes("review-only") &&
          row.defaultDecision === "needs_teacher_review" &&
          row.blockedTransitions.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation
    ).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 45,
      blockedDecisionRows: 45,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
        (row) =>
          row.order > 0 &&
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.allowedDecisions.includes("blocked") &&
          row.allowedDecisions.includes("ready_for_follow_up") &&
          row.blockedDecision === "accepted" &&
          row.validationRule.includes("accepted is blocked") &&
          row.invalidIf.includes("decision=accepted") &&
          row.nextActionIfInvalid.includes("Stop") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay
    ).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: 135,
      readyRows: 135,
      blockedDecisionRows: 135,
      passed: true
    });
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rows.every(
        (row) =>
          row.order > 0 &&
          ["needs_teacher_review", "blocked", "ready_for_follow_up"].includes(row.simulatedDecision) &&
          row.nextReviewAction.length > 0 &&
          row.consequence.includes("does not accept technology") &&
          row.blockedDecisionReminder.includes("accepted") &&
          row.blockedDecisionReminder.includes("blocked") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.exportJson
    ).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
    );
    const codexDeepestReceiptValidationReplayQueue =
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.nextReviewQueue;
    expect(codexDeepestReceiptValidationReplayQueue).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: 135,
      readyItems: 135,
      missingTeacherEvidenceItems: 45,
      blockedItems: 45,
      readyForFollowUpItems: 45,
      passed: true
    });
    expect(
      codexDeepestReceiptValidationReplayQueue.items.every(
        (item) =>
          item.order > 0 &&
          ["missing_teacher_evidence", "blocked_route", "review_only_follow_up"].includes(item.lane) &&
          item.evidenceRequest.length > 0 &&
          item.continueCondition.includes("ruleEnabled=false") &&
          item.continueCondition.includes("accepted=false") &&
          item.continueCondition.includes("packagingGated=true") &&
          item.stopCondition.includes("Stop") &&
          item.blockedTransitions.includes("Package") &&
          item.blockedTransitions.includes("Release") &&
          item.blockedTransitions.includes("Wrap") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(codexDeepestReceiptValidationReplayQueue.exportJson).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
    );
    const codexDeepestReceiptValidationReplayQueueHandoff = codexDeepestReceiptValidationReplayQueue.handoff;
    expect(codexDeepestReceiptValidationReplayQueueHandoff).toMatchObject({
      mode:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      format:
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stepCount: 135,
      lockedSteps: 135,
      blockedSteps: 135,
      passed: true
    });
    expect(
      codexDeepestReceiptValidationReplayQueueHandoff.steps.every(
        (step) =>
          step.order > 0 &&
          step.instruction.includes("review-only") &&
          step.evidencePath.includes("nextReviewQueue.items") &&
          step.verifierCommand === "npm.cmd run verify:learning" &&
          step.expectedLockedResult.includes("ruleEnabled=false") &&
          step.expectedLockedResult.includes("accepted=false") &&
          step.expectedLockedResult.includes("packagingGated=true") &&
          step.blockedTransitions.includes("Package") &&
          step.blockedTransitions.includes("Release") &&
          step.blockedTransitions.includes("Wrap") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(codexDeepestReceiptValidationReplayQueueHandoff.exportJson).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
    );
    expect(report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.exportJson).toContain(
      "codex_capability_transplant_rehearsal_result_template_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.exportJson
    ).toContain("codex_capability_transplant_rehearsal_result_validation_json_v1");
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.exportJson
    ).toContain("codex_capability_transplant_rehearsal_result_validation_replay_json_v1");
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .exportJson
    ).toContain("codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_json_v1");
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.exportJson
    ).toContain("codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_json_v1");
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.exportJson
    ).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.exportJson
    ).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.exportJson
    ).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.exportJson
    ).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.exportJson
    ).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.exportJson
    ).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.exportJson
    ).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.exportJson
    ).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .exportJson
    ).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.exportJson
    ).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.exportJson
    ).toContain(
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.transplantDraft.rows.every(
        (row) =>
          row.apprenticeInterface.startsWith("Apprentice") &&
          row.runtimeTraceFields.length >= 6 &&
          row.verifierCommand === "npm.cmd run verify:learning" &&
          row.blockedTransitions.includes("Accept technology") &&
          row.blockedTransitions.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(report.codexCapabilityTransferReport.transplantDraft.exportJson).toContain(
      "codex_capability_transplant_draft_json_v1"
    );
    expect(
      report.codexCapabilityTransferReport.items.every(
        (item) =>
          item.structuredTraceExample.includes("Trace shows") &&
          item.blockedSideEffects.includes("Accept technology") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(report.codexCapabilityTransferReport.exportJson).toContain(
      "codex_capability_transfer_review_json_v1"
    );
  });

  it("serves a compact qualification API summary by default", () => {
    const report = buildQualificationReport(taskProfileFixture());
    const summary = buildQualificationApiSummary(report);
    const payload = JSON.stringify(summary);

    expect(summary.responseMode).toBe("qualification_summary_json_v1");
    expect(summary.status).toBe("qualified_for_teacher_review");
    expect(summary.packaging.accepted).toBe(false);
    expect(summary.packaging.gated).toBe(true);
    expect(summary.policyEvidence.find((item) => item.id === "corrections-link-to-runs")?.passed).toBe(true);
    expect(payload.length).toBeLessThan(250_000);
    expect(payload).not.toContain("teacherAcceptanceEvidenceAgenda");
    expect((summary as Record<string, unknown>).teacherAcceptanceEvidenceAgenda).toBeUndefined();
  });

  it("recovers persisted voice browser runtime reviews into the export comparison report", () => {
    const task = taskProfileFixture();
    const review = buildVoiceBrowserCompatibilityReviewRecord({
      apprenticeId: task.apprenticeId,
      taskId: task.id,
      createdAt: "2026-06-02T12:30:00.000Z",
      input: {
        browser: "Chrome",
        platformScope: "desktop Chromium smoke",
        speechRecognitionAvailable: true,
        speechSynthesisAvailable: true,
        voiceCount: 8,
        chineseVoiceCount: 3,
        selectedVoiceName: "Microsoft Xiaoxiao",
        transcriptFallbackTested: true,
        teacherNote: "Chrome runtime review saved by teacher; fallback path was tested."
      }
    });

    task.corrections.push({
      id: review.id,
      apprenticeId: task.apprenticeId,
      taskId: task.id,
      runId: null,
      userFeedback: review.userFeedback,
      errorType: review.errorType,
      extractedRule: JSON.stringify(review.extractedRule),
      beforeOutput: JSON.stringify(review.beforeOutput),
      afterOutput: JSON.stringify(review.afterOutput),
      learningTrace: JSON.stringify(review.learningTrace),
      createdAt: review.createdAt
    });

    const report = buildQualificationReport(task);
    const chrome = report.voiceBrowserCompatibilityComparisonReport.items.find((item) => item.browser === "Chrome");

    expect(report.summary.voiceBrowserCompatibilityReviewDrafts).toBe(1);
    expect(report.summary.voiceBrowserCompatibilityComparisonPersistedReviews).toBe(1);
    expect(report.summary.voiceBrowserCompatibilityComparisonFallbackTests).toBe(1);
    expect(report.summary.voiceBrowserCompatibilityBatchDiffRows).toBe(4);
    expect(report.summary.voiceBrowserCompatibilityBatchDiffMissingReviews).toBe(3);
    expect(report.summary.voiceBrowserCompatibilityBatchDiffRuntimeDiffs).toBe(3);
    expect(report.summary.voiceBrowserCompatibilityBatchDiffFallbackGaps).toBe(2);
    expect(report.voiceBrowserCompatibilityComparisonReport.status).toBe("ready_for_teacher_review");
    expect(chrome).toMatchObject({
      evidenceStatus: "runtime_review_saved",
      runtimeRecognitionAvailable: true,
      runtimeSynthesisAvailable: true,
      runtimeVoiceCount: 8,
      runtimeChineseVoiceCount: 3,
      selectedVoiceName: "Microsoft Xiaoxiao",
      transcriptFallbackTested: true,
      ruleEnabled: false,
      voiceOnlyMemoryEnabled: false,
      accepted: false,
      packagingGated: true
    });
    expect(report.voiceBrowserCompatibilityComparisonReport.exportJson).toContain(review.id);
    expect(report.voiceBrowserCompatibilityBatchDiffReport.rows.find((row) => row.browser === "Chrome")).toMatchObject({
      completionStatus: "runtime_review_saved",
      runtimeRecognitionAvailable: true,
      runtimeSynthesisAvailable: true,
      transcriptFallbackTested: true,
      ruleEnabled: false,
      voiceOnlyMemoryEnabled: false,
      accepted: false,
      packagingGated: true
    });
    expect(report.voiceBrowserCompatibilityBatchDiffReport.exportJson).toContain(
      "voice_browser_runtime_batch_gap_diff_json_v1"
    );
  });

  it("recovers persisted teacher review drafts without enabling rules or unlocking packaging", () => {
    const task = taskProfileFixture();
    const draft = buildTeacherReviewDraft({
      apprenticeId: task.apprenticeId,
      taskId: task.id,
      createdAt: "2026-06-02T13:10:00.000Z",
      followUpDraft: "Next teaching round should clarify the locked packaging item and the unsure voice fallback item.",
      items: [
        {
          id: "review-only-lock-decision",
          label: "Review-only packaging lock",
          question: "Does this remain blocked?",
          evidence: "accepted=false and packagingGated=true",
          decision: "needs_change",
          note: "Keep this visible in the next lesson."
        },
        {
          id: "voice-browser-compatibility-decision",
          label: "Voice browser compatibility",
          question: "Was fallback evidence reviewed?",
          evidence: "Manual transcript fallback remains available.",
          decision: "unsure",
          note: "Ask the teacher to review browser-specific recovery."
        },
        {
          id: "visual-evidence-replay-decision",
          label: "Visual evidence replay",
          question: "Can the teacher inspect the replay?",
          evidence: "Seven replay steps are present.",
          decision: "tentative_pass",
          note: "Looks reviewable, still not acceptance."
        }
      ]
    });

    task.corrections.push({
      id: draft.id,
      apprenticeId: task.apprenticeId,
      taskId: task.id,
      runId: null,
      userFeedback: draft.userFeedback,
      errorType: draft.errorType,
      extractedRule: JSON.stringify(draft.extractedRule),
      beforeOutput: JSON.stringify(draft.beforeOutput),
      afterOutput: JSON.stringify(draft.afterOutput),
      learningTrace: JSON.stringify(draft.learningTrace),
      createdAt: draft.createdAt
    });

    const report = buildQualificationReport(task);
    const recovered = report.visualTeacherReviewDraftRecoveryReport.versions[0];

    expect(report.summary.visualTeacherReviewDrafts).toBe(1);
    expect(report.summary.visualTeacherReviewDraftRecoveryPersisted).toBe(1);
    expect(report.summary.visualTeacherReviewDraftRecoveryVersions).toBe(1);
    expect(report.summary.visualTeacherReviewDraftRecoveryFollowUps).toBe(2);
    expect(report.summary.visualTeacherReviewDraftReplayRows).toBe(4);
    expect(report.summary.visualTeacherReviewDraftReplayStaticDiffs).toBe(3);
    expect(report.summary.visualTeacherReviewDraftReplayPersistedDiffs).toBe(1);
    expect(report.summary.visualTeacherReviewDraftReplayExported).toBe(4);
    expect(report.visualTeacherReviewDraftRecoveryReport.status).toBe("ready_for_teacher_review");
    expect(report.visualTeacherReviewDraftRecoveryReport.latestVersionId).toBe("recovered-teacher-review-draft-1");
    expect(recovered).toMatchObject({
      correctionId: draft.id,
      followUpItemCount: 2,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(recovered.decisionCounts.needs_change).toBe(1);
    expect(recovered.decisionCounts.unsure).toBe(1);
    expect(recovered.decisionCounts.tentative_pass).toBe(1);
    expect(recovered.learningTraceSteps).toBe(3);
    expect(report.visualTeacherReviewDraftRecoveryReport.exportJson).toContain(draft.id);
    expect(report.visualTeacherReviewDraftReplayReport.rows).toHaveLength(4);
    expect(report.visualTeacherReviewDraftReplayReport.persistedRecoveryDiffs).toBe(1);
    expect(report.visualTeacherReviewDraftReplayReport.rows.some((row) => row.source === "persisted_recovery_diff" && row.toVersionId === recovered.id)).toBe(true);
    expect(report.visualTeacherReviewDraftReplayReport.exportJson).toContain(draft.id);
    expect(report.policyEvidence.some((item) => item.id === "teacher-review-draft-persistence-recovery" && item.passed)).toBe(true);
    expect(report.policyEvidence.some((item) => item.id === "teacher-review-draft-diff-recovery-replay" && item.passed)).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "teacher-review-draft-recovery" && section.passed)).toBe(true);
    expect(report.visualReviewDossier.sections.some((section) => section.id === "teacher-review-draft-diff-replay" && section.passed)).toBe(true);
  });

  it("recovers persisted teacher acceptance agenda decision drafts without accepting technology", () => {
    const task = taskProfileFixture();
    const baseline = buildQualificationReport(task);
    const draftItems = baseline.teacherAcceptanceEvidenceAgenda.decisionExchange.items.map((item) => ({
      agendaItemId: item.agendaItemId,
      label: item.label,
      evidencePath: item.evidencePath,
      currentReadiness: item.currentReadiness,
      decision:
        item.agendaItemId === "agenda-review-dossier"
          ? ("needs_revision" as const)
          : item.proposedDecision,
      note:
        item.agendaItemId === "agenda-review-dossier"
          ? "Teacher wants the dossier summary to be shorter before final review."
          : "",
      teacherQuestion: item.teacherQuestion
    }));
    const draft = buildTeacherAcceptanceAgendaDecisionDraft({
      apprenticeId: task.apprenticeId,
      taskId: task.id,
      createdAt: "2026-06-02T15:30:00.000Z",
      items: draftItems,
      nextReviewPlan: "Shorten dossier evidence and keep packaging locked."
    });

    task.corrections.push({
      id: draft.id,
      apprenticeId: task.apprenticeId,
      taskId: task.id,
      runId: null,
      userFeedback: draft.userFeedback,
      errorType: draft.errorType,
      extractedRule: JSON.stringify(draft.extractedRule),
      beforeOutput: JSON.stringify(draft.beforeOutput),
      afterOutput: JSON.stringify(draft.afterOutput),
      learningTrace: JSON.stringify(draft.learningTrace),
      createdAt: draft.createdAt
    });

    const report = buildQualificationReport(task);
    const recovery = report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery;
    const dossierRow = recovery.rows.find((row) => row.agendaItemId === "agenda-review-dossier");

    expect(report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryRows).toBe(5);
    expect(report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryPersisted).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryChangedRows).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryMissingRows).toBe(0);
    expect(report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryFollowUps).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaNextReviewQueueItems).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaNextReviewQueueReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewQueueLockedItems).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewHandoffSteps).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaNextReviewHandoffReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewHandoffLockedSteps).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewRunbookSteps).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaNextReviewRunbookReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewRunbookLockedChecks).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewDryRunRows).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaNextReviewDryRunReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewDryRunNoOpRows).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptRows).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptNeedsReviewRows).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptValidationRows).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptValidationReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptValidationBlockedDecisions).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptReplayRows).toBe(9);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptReplayReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptReplayBlockedDecisions).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanItems).toBe(9);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanBlockedRoutes).toBe(3);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditItems).toBe(9);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditForbiddenTransitions).toBe(45);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketItems).toBe(9);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketCommands).toBe(9);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultRows).toBe(9);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultNotRunRows).toBe(9);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationRows).toBe(9);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationBlockedStatuses).toBe(9);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayRows).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayBlockedStatuses).toBe(9);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueRows).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueMismatchStops).toBe(9);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffSteps).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffMismatchStops).toBe(9);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookItems).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookLockedChecks).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunRows).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunNoOpRows).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptRows).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationRows).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps).toBe(27);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems).toBe(81);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows).toBe(729);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions).toBe(729);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems).toBe(729);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems).toBe(243);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps).toBe(729);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps).toBe(729);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems).toBe(729);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks).toBe(729);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows).toBe(729);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows).toBe(729);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows).toBe(729);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady).toBe(1);
    expect(report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows).toBe(729);
    expect(report.summary.codexCapabilityTransferItems).toBe(5);
    expect(report.summary.codexCapabilityTransferReady).toBe(5);
    expect(report.summary.codexCapabilityTransferLocked).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalRows).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalReady).toBe(5);
    expect(report.summary.codexCapabilityTransplantRehearsalLocked).toBe(5);
    expect(recovery.status).toBe("ready_for_teacher_review");
    expect(recovery.latestCorrectionId).toBe(draft.id);
    expect(recovery.rows.every((row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated)).toBe(
      true
    );
    expect(dossierRow).toMatchObject({
      staticDecision: "ready_for_review",
      recoveredDecision: "needs_revision",
      decisionChanged: true,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(recovery.exportJson).toContain(draft.id);
    expect(recovery.nextReviewQueue).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_queue_v1",
      format: "teacher_acceptance_agenda_next_review_queue_json_v1",
      itemCount: 3,
      lockedItems: 1,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(recovery.nextReviewQueue.items.map((item) => item.reason)).toEqual(
      expect.arrayContaining(["locked_boundary", "changed_decision", "follow_up_decision"])
    );
    expect(
      recovery.nextReviewQueue.items.every(
        (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
      )
    ).toBe(true);
    expect(recovery.nextReviewQueue.exportJson).toContain("teacher_acceptance_agenda_next_review_queue_json_v1");
    expect(recovery.nextReviewHandoff).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_handoff_v1",
      format: "teacher_acceptance_agenda_next_review_handoff_json_v1",
      queueItemCount: 3,
      stepCount: 3,
      lockedSteps: 1,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(recovery.nextReviewHandoff.steps.map((step) => step.reason)).toEqual(
      expect.arrayContaining(["locked_boundary", "changed_decision", "follow_up_decision"])
    );
    expect(
      recovery.nextReviewHandoff.steps.every(
        (step) => step.ruleEnabled === false && step.accepted === false && step.packagingGated === true
      )
    ).toBe(true);
    expect(recovery.nextReviewHandoff.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_handoff_json_v1"
    );
    expect(recovery.nextReviewHandoff.handoffText).toContain("Do not accept technology");
    expect(recovery.nextReviewHandoff.runbook).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_runbook_v1",
      format: "teacher_acceptance_agenda_next_review_runbook_json_v1",
      stepCount: 3,
      lockedChecks: 1,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(recovery.nextReviewHandoff.runbook.steps.map((step) => step.phase)).toEqual(
      expect.arrayContaining(["confirm_lock", "replay_decision"])
    );
    expect(
      recovery.nextReviewHandoff.runbook.steps.every(
        (step) =>
          step.stopCondition.includes("Stop") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(recovery.nextReviewHandoff.runbook.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_runbook_json_v1"
    );
    expect(recovery.nextReviewHandoff.runbook.dryRunAudit).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_dry_run_audit_v1",
      format: "teacher_acceptance_agenda_next_review_dry_run_audit_json_v1",
      rowCount: 3,
      noOpRows: 3,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(recovery.nextReviewHandoff.runbook.dryRunAudit.rows.map((row) => row.simulatedResult)).toEqual(
      expect.arrayContaining(["lock_confirmed", "awaiting_teacher_review"])
    );
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.rows.every(
        (row) =>
          row.lockAssertion.includes("packagingGated=true") &&
          row.noOpActions.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(recovery.nextReviewHandoff.runbook.dryRunAudit.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_dry_run_audit_json_v1"
    );
    expect(recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_template_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_template_json_v1",
      rowCount: 3,
      needsReviewRows: 3,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.nextReviewerNotePlaceholder.includes("not technology acceptance") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_template_json_v1"
    );
    expect(recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_validation_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_validation_json_v1",
      rowCount: 3,
      blockedDecisionCount: 3,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
        (row) =>
          row.allowedDecisions.includes("ready_for_follow_up") &&
          row.blockedDecision === "accepted" &&
          row.nextActionIfInvalid.includes("Stop review") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_validation_json_v1"
    );
    expect(recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_decision_replay_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_decision_replay_json_v1",
      rowCount: 9,
      blockedDecisionCount: 3,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.rows.every(
        (row) =>
          row.blockedDecisionReminder.includes("accepted") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.exportJson
    ).toContain("teacher_acceptance_agenda_next_review_receipt_decision_replay_json_v1");
    expect(recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_json_v1",
      itemCount: 9,
      blockedRouteCount: 3,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.items.every(
        (item) =>
          item.lockReminder.includes("accepted remains blocked") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.exportJson
    ).toContain("teacher_acceptance_agenda_next_review_receipt_follow_up_plan_json_v1");
    expect(recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_json_v1",
      itemCount: 9,
      forbiddenTransitionCount: 45,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.items.every(
        (item) =>
          item.forbiddenTransitions.includes("decision=accepted") &&
          item.forbiddenTransitions.includes("packagingGated=false") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.exportJson
    ).toContain("teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_json_v1");
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit
        .verificationPacket
    ).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_json_v1",
      itemCount: 9,
      commandCount: 9,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.items.every(
        (item) =>
          item.evidencePath.includes("followUpPlan.lockAudit") &&
          item.verificationCommand === "npm.cmd run verify:learning" &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.exportJson
    ).toContain("teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_json_v1");
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit
        .verificationPacket.resultTemplate
    ).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_json_v1",
      itemCount: 9,
      notRunRows: 9,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.items.every(
        (item) =>
          item.defaultStatus === "not_run_yet" &&
          item.statusOptions.includes("mismatch_blocked") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.exportJson
    ).toContain("teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_json_v1");
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit
        .verificationPacket.resultTemplate.validation
    ).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_json_v1",
      itemCount: 9,
      blockedStatusCount: 9,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.items.every(
        (item) =>
          item.allowedStatuses.includes("matched_expected") &&
          item.blockedStatus === "accepted" &&
          item.invalidIf.includes("accepted=true") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.exportJson
    ).toContain("teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_json_v1");
    const recoveredResultReplay =
      recovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit
        .verificationPacket.resultTemplate.validation.replay;
    expect(recoveredResultReplay).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_json_v1",
      itemCount: 27,
      blockedStatusCount: 9,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.items.every(
        (item) =>
          item.blockedStatusReminder.includes("accepted") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(recoveredResultReplay.items.some((item) => item.simulatedStatus === "mismatch_blocked")).toBe(true);
    expect(recoveredResultReplay.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_json_v1"
    );
    expect(recoveredResultReplay.nextReviewQueue).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_json_v1",
      itemCount: 27,
      notRunRows: 9,
      matchedRows: 9,
      mismatchStopRows: 9,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.items.every(
        (item) =>
          item.stopCondition.includes("accepted") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(recoveredResultReplay.nextReviewQueue.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_json_v1"
    );
    expect(recoveredResultReplay.nextReviewQueue.handoff).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_json_v1",
      stepCount: 27,
      mismatchStopSteps: 9,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.steps.every(
        (step) =>
          step.expectedLockedResult.includes("accepted=false") &&
          step.blockedIf.includes("accepted=true") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(recoveredResultReplay.nextReviewQueue.handoff.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_json_v1"
    );
    expect(recoveredResultReplay.nextReviewQueue.handoff.runbook).toMatchObject({
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_json_v1",
      itemCount: 27,
      lockedChecks: 27,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.items.every(
        (item) =>
          item.lockAssertion.includes("accepted=false") &&
          item.stopCondition.includes("accepted=true") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(recoveredResultReplay.nextReviewQueue.handoff.runbook.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_json_v1"
    );
    expect(recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_json_v1",
      rowCount: 27,
      noOpRows: 27,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.rows.every(
        (row) =>
          row.lockAssertion.includes("accepted=false") &&
          row.noOpActions.includes("Do not accept technology") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_json_v1"
    );
    expect(recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      rowCount: 27,
      needsReviewRows: 27,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_json_v1"
    );
    expect(recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      rowCount: 27,
      blockedDecisionRows: 27,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
        (row) =>
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.allowedDecisions.includes("blocked") &&
          row.allowedDecisions.includes("ready_for_follow_up") &&
          row.blockedDecision === "accepted" &&
          row.invalidIf.includes("decision=accepted") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
    );
    expect(recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      rowCount: 81,
      blockedDecisionRows: 27,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rows.every(
        (row) =>
          ["needs_teacher_review", "blocked", "ready_for_follow_up"].includes(row.simulatedDecision) &&
          row.blockedDecisionReminder.includes("accepted remains blocked") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
    );
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      itemCount: 81,
      blockedItems: 27,
      readyForFollowUpItems: 27,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items.every(
        (item) =>
          ["needs_teacher_review_queue", "blocked_queue", "ready_for_follow_up_queue"].includes(item.queueLane) &&
          item.blockedTransitions.includes("accepted") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.exportJson
    ).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
    );
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      stepCount: 81,
      blockedSteps: 27,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.steps.every(
        (step) =>
          step.blockedIf.includes("accepted") &&
          step.blockedIf.includes("ruleEnabled=true") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.exportJson
    ).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
    );
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      itemCount: 81,
      lockedChecks: 81,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.items.every(
        (item) =>
          item.lockAssertion.includes("ruleEnabled=false") &&
          item.lockAssertion.includes("accepted=false") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.exportJson
    ).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
    );
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      rowCount: 81,
      noOpRows: 81,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rows.every(
        (row) =>
          row.noOpActions.includes("Package") &&
          row.noOpActions.includes("Release") &&
          row.noOpActions.includes("Wrap") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.exportJson
    ).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
    );
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      rowCount: 81,
      needsReviewRows: 81,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.blockerQuestion.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.exportJson
    ).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
    );
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      rowCount: 81,
      blockedDecisionRows: 81,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
        (row) =>
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.allowedDecisions.includes("blocked") &&
          row.allowedDecisions.includes("ready_for_follow_up") &&
          row.blockedDecision === "accepted" &&
          row.invalidIf.includes("decision=accepted") &&
          row.invalidIf.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.exportJson
    ).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
    );
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      rowCount: 243,
      blockedDecisionRows: 243,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rows.every(
        (row) =>
          ["needs_teacher_review", "blocked", "ready_for_follow_up"].includes(row.simulatedDecision) &&
          row.blockedDecisionReminder.includes("accepted") &&
          row.consequence.includes("does not accept technology") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.exportJson
    ).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
    );
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      itemCount: 243,
      blockedItems: 81,
      readyForFollowUpItems: 81,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items.every(
        (item) =>
          ["needs_teacher_review_queue", "blocked_queue", "ready_for_follow_up_queue"].includes(item.queueLane) &&
          item.blockedTransitions.includes("accepted") &&
          item.blockedTransitions.includes("ruleEnabled=true") &&
          item.blockedTransitions.includes("packagingGated=false") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.exportJson
    ).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
    );
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      stepCount: 243,
      blockedStepCount: 243,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.steps.every(
        (step) =>
          step.verifierCommand === "npm.cmd run verify:learning" &&
          step.expectedLockedResult.includes("ruleEnabled=false") &&
          step.expectedLockedResult.includes("accepted=false") &&
          step.expectedLockedResult.includes("packagingGated=true") &&
          step.blockedIf.includes("accepted") &&
          step.blockedIf.includes("Package") &&
          step.blockedIf.includes("Release") &&
          step.blockedIf.includes("Wrap") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.exportJson
    ).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
    );
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook
    ).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      itemCount: 243,
      lockedChecks: 243,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.items.every(
        (item) =>
          item.verificationCommand === "npm.cmd run verify:learning" &&
          item.lockAssertion.includes("ruleEnabled=false") &&
          item.lockAssertion.includes("accepted=false") &&
          item.lockAssertion.includes("packagingGated=true") &&
          item.stopCondition.includes("Package") &&
          item.stopCondition.includes("Release") &&
          item.stopCondition.includes("Wrap") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.exportJson
    ).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
    );
    const deepestRunbookDryRun =
      recoveredResultReplay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit;
    expect(deepestRunbookDryRun).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      rowCount: 243,
      noOpRows: 243,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      deepestRunbookDryRun.rows.every(
        (row) =>
          row.noOpActions.includes("Package") &&
          row.noOpActions.includes("Release") &&
          row.noOpActions.includes("Wrap") &&
          row.lockAssertion.includes("ruleEnabled=false") &&
          row.lockAssertion.includes("accepted=false") &&
          row.lockAssertion.includes("packagingGated=true") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRun.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
    );
    const deepestRunbookDryRunReceipt = deepestRunbookDryRun.receiptTemplate;
    expect(deepestRunbookDryRunReceipt).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      rowCount: 243,
      needsReviewRows: 243,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceipt.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.blockerQuestion.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceipt.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
    );
    const deepestRunbookDryRunReceiptValidation = deepestRunbookDryRunReceipt.validation;
    expect(deepestRunbookDryRunReceiptValidation).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      rowCount: 243,
      blockedDecisionRows: 243,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidation.rows.every(
        (row) =>
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.allowedDecisions.includes("blocked") &&
          row.allowedDecisions.includes("ready_for_follow_up") &&
          row.blockedDecision === "accepted" &&
          row.invalidIf.includes("decision=accepted") &&
          row.invalidIf.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidation.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
    );
    const deepestRunbookDryRunReceiptValidationReplay = deepestRunbookDryRunReceiptValidation.replay;
    expect(deepestRunbookDryRunReceiptValidationReplay).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      rowCount: 729,
      blockedDecisionRows: 729,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidationReplay.rows.every(
        (row) =>
          ["needs_teacher_review", "blocked", "ready_for_follow_up"].includes(row.simulatedDecision) &&
          row.blockedDecisionReminder.includes("accepted remains blocked") &&
          row.consequence.includes("does not accept technology") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidationReplay.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
    );
    const deepestRunbookDryRunReceiptValidationReplayQueue = deepestRunbookDryRunReceiptValidationReplay.nextReviewQueue;
    expect(deepestRunbookDryRunReceiptValidationReplayQueue).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      itemCount: 729,
      blockedItems: 243,
      readyForFollowUpItems: 243,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidationReplayQueue.items.every(
        (item) =>
          ["needs_teacher_review_queue", "blocked_queue", "ready_for_follow_up_queue"].includes(item.queueLane) &&
          item.blockedTransitions.includes("accepted") &&
          item.blockedTransitions.includes("ruleEnabled=true") &&
          item.blockedTransitions.includes("packagingGated=false") &&
          item.blockedTransitions.includes("Package") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidationReplayQueue.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
    );
    const deepestRunbookDryRunReceiptValidationReplayQueueHandoff = deepestRunbookDryRunReceiptValidationReplayQueue.handoff;
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoff).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      stepCount: 729,
      blockedSteps: 729,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidationReplayQueueHandoff.steps.every(
        (step) =>
          step.handoffInstruction.includes("review-only") &&
          step.verifierCommand === "npm.cmd run verify:learning" &&
          step.expectedLockedResult.includes("ruleEnabled=false") &&
          step.expectedLockedResult.includes("accepted=false") &&
          step.expectedLockedResult.includes("packagingGated=true") &&
          step.blockedIf.includes("accepted") &&
          step.blockedIf.includes("Package") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoff.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
    );
    const deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbook =
      deepestRunbookDryRunReceiptValidationReplayQueueHandoff.runbook;
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbook).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      itemCount: 729,
      lockedChecks: 729,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbook.items.every(
        (item) =>
          item.verificationCommand === "npm.cmd run verify:learning" &&
          item.lockAssertion.includes("ruleEnabled=false") &&
          item.lockAssertion.includes("accepted=false") &&
          item.lockAssertion.includes("packagingGated=true") &&
          item.stopCondition.includes("Package") &&
          item.stopCondition.includes("Release") &&
          item.stopCondition.includes("Wrap") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbook.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
    );
    const deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun =
      deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbook.dryRunAudit;
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      rowCount: 729,
      noOpRows: 729,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun.rows.every(
        (row) =>
          row.expectedEvidence.includes("ruleEnabled=false") &&
          row.expectedEvidence.includes("accepted=false") &&
          row.expectedEvidence.includes("packagingGated=true") &&
          row.noOpActions.includes("Package") &&
          row.noOpActions.includes("Release") &&
          row.noOpActions.includes("Wrap") &&
          row.lockAssertion.includes("ruleEnabled=false") &&
          row.lockAssertion.includes("accepted=false") &&
          row.lockAssertion.includes("packagingGated=true") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
    );
    const deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceipt =
      deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun.receiptTemplate;
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceipt).toMatchObject({
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      rowCount: 729,
      needsReviewRows: 729,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(
      deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceipt.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.blockerQuestion.includes("ruleEnabled=true") &&
          row.blockerQuestion.includes("packagingGated=false") &&
          row.blockerQuestion.includes("Package") &&
          row.blockerQuestion.includes("Release") &&
          row.blockerQuestion.includes("Wrap") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
    ).toBe(true);
    expect(deepestRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceipt.exportJson).toContain(
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
    );
    expect(report.teacherAcceptanceBoundary).toMatchObject({
      accepted: false,
      packagingGated: true
    });
    expect(report.packaging).toMatchObject({
      accepted: false,
      gated: true
    });
  });

  it("recovers persisted cross-domain teacher score drafts without enabling cross-domain rules", () => {
    const task = taskProfileFixture();
    const baseline = buildQualificationReport(task);
    const draftItems = baseline.crossDomainValidationReport.teacherBatchScoreReplay.items.map((item) => ({
      caseId: item.caseId,
      apprenticeId: item.apprenticeId,
      domain: item.domain,
      score: item.domain === "human_knowledge" ? 64 : item.score,
      decision: item.domain === "human_knowledge" ? ("boundary_only" as const) : item.decision,
      note:
        item.domain === "human_knowledge"
          ? "Teacher wants human knowledge transfer to stay boundary-only until more conflict examples are taught."
          : item.note,
      followUpQuestion: item.followUpQuestion
    }));
    const draft = buildCrossDomainTeacherScoreDraft({
      apprenticeId: task.apprenticeId,
      taskId: task.id,
      createdAt: "2026-06-02T13:35:00.000Z",
      items: draftItems,
      followUpDraft: "Next lesson should add human-knowledge conflict examples before any cross-domain reuse."
    });

    task.corrections.push({
      id: draft.id,
      apprenticeId: task.apprenticeId,
      taskId: task.id,
      runId: null,
      userFeedback: draft.userFeedback,
      errorType: draft.errorType,
      extractedRule: JSON.stringify(draft.extractedRule),
      beforeOutput: JSON.stringify(draft.beforeOutput),
      afterOutput: JSON.stringify(draft.afterOutput),
      learningTrace: JSON.stringify(draft.learningTrace),
      createdAt: draft.createdAt
    });

    const report = buildQualificationReport(task);
    const recovery = report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff;
    const humanRow = recovery.rows.find((row) => row.domain === "human_knowledge");

    expect(report.summary.crossDomainTeacherScoreRecoveryRows).toBe(3);
    expect(report.summary.crossDomainTeacherScoreRecoveryReady).toBe(1);
    expect(report.summary.crossDomainTeacherScoreRecoveryPersisted).toBe(1);
    expect(report.summary.crossDomainTeacherScoreRecoveryChangedRows).toBe(1);
    expect(report.summary.crossDomainTeacherScoreRecoveryMissingRows).toBe(0);
    expect(report.summary.crossDomainTeacherScoreRecoveryFollowUps).toBe(1);
    expect(recovery.status).toBe("ready_for_teacher_review");
    expect(recovery.latestCorrectionId).toBe(draft.id);
    expect(recovery.persistedDraftCount).toBe(1);
    expect(recovery.rows.every((row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated)).toBe(
      true
    );
    expect(humanRow).toMatchObject({
      staticScore: 76,
      recoveredScore: 64,
      scoreDelta: -12,
      staticDecision: "needs_revision",
      recoveredDecision: "boundary_only",
      decisionChanged: true,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(recovery.exportJson).toContain(draft.id);
    expect(recovery.blockedActions).toEqual(
      expect.arrayContaining(["Enable cross-domain rules", "Package", "Release", "Wrap"])
    );
    expect(report.policyEvidence.some((item) => item.id === "cross-domain-teacher-score-recovery-diff" && item.passed)).toBe(
      true
    );
    expect(
      report.visualReviewDossier.sections.some(
        (section) => section.id === "cross-domain-teacher-score-recovery-diff" && section.passed
      )
    ).toBe(true);
  });

  it("keeps qualification ready after teacher trial feedback receipts are saved", () => {
    const task = taskProfileFixture();
    const draft = buildTeacherTrialFeedbackDraft({
      apprenticeId: task.apprenticeId,
      taskId: task.id,
      createdAt: "2026-06-03T10:15:19.860Z",
      nextReviewPlan: "Continue product review on review exports. Packaging remains locked.",
      items: [
        {
          id: "trial-task-detail",
          label: "Task detail review",
          route: `/tasks/${task.id}`,
          expectedEvidence: "Task page loads and shows the trial receipt panel.",
          decision: "works",
          note: "Page loaded during preview smoke."
        },
        {
          id: "trial-review-export",
          label: "Review exports",
          route: `/tasks/${task.id}`,
          expectedEvidence: "Review export JSON remains locked.",
          decision: "not_tried",
          note: "Teacher will inspect manually."
        }
      ]
    });

    task.corrections.push({
      id: draft.id,
      apprenticeId: task.apprenticeId,
      taskId: task.id,
      runId: null,
      userFeedback: draft.userFeedback,
      errorType: draft.errorType,
      extractedRule: JSON.stringify(draft.extractedRule),
      beforeOutput: JSON.stringify(draft.beforeOutput),
      afterOutput: JSON.stringify(draft.afterOutput),
      learningTrace: JSON.stringify(draft.learningTrace),
      createdAt: draft.createdAt
    });

    const report = buildQualificationReport(task);
    const correctionPolicy = report.policyEvidence.find((item) => item.id === "corrections-link-to-runs");

    expect(report.status).toBe("qualified_for_teacher_review");
    expect(report.requirements.every((item) => item.passed)).toBe(true);
    expect(report.learningLoopTimeline.every((item) => item.passed)).toBe(true);
    expect(report.teacherReviewChecklist.every((item) => item.passed)).toBe(true);
    expect(correctionPolicy?.passed).toBe(true);
    expect(correctionPolicy?.evidence).toContain("1 teacher trial feedback drafts");
    expect(report.teacherAcceptanceBoundary).toMatchObject({
      accepted: false,
      packagingGated: true
    });
  });
});
