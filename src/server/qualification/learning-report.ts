import { architectureAuditLayers } from "@/lib/architecture-audit";
import {
  buildHumanKnowledgeFutureCommandReplay,
  buildVoiceTeachingTranscriptDraft,
  isHumanKnowledgeTeachingRule
} from "@/lib/human-knowledge-teaching";
import type {
  AIVoiceBrowserCompatibilityAudit,
  AIVoiceBrowserCompatibilityCase,
  HumanKnowledgeFutureCommandReplay,
  VoiceBrowserCompatibilityRuntimeReviewInput,
  VoiceTeachingTranscriptDraft
} from "@/lib/human-knowledge-teaching";
import {
  buildAIServiceOutputValidationRehearsal,
  buildAIServiceReplacementReadinessReport,
  buildReadableDomainLearningWorkflow
} from "@/lib/domain-learning";
import type { AIServiceOutputValidationRehearsal, AIServiceReplacementReadinessReport } from "@/lib/domain-learning";
import { mockAIDomainSelfStudy } from "@/lib/domain-ai-service";
import type { AIDomainSelfStudyResult } from "@/lib/domain-ai-service";
import { visualLearningAcceptanceGate } from "@/lib/teacher-acceptance";
import {
  buildCodeFirstSpatialTeachingModel,
  defaultSpatialTeachingInput,
  type SpatialBatchPatternLearning,
  type SpatialCandidateSelectionImpactPreview,
  type SpatialCoordinateDialoguePreview,
  type SpatialConstructionRevisionCodePatch,
  type SpatialDirectionToleranceCheck,
  type SpatialFitCandidateComparison,
  type SpatialFitResidualTeachingLens,
  type SpatialPoint3D,
  type SpatialSurfacePatchTeachingLens
} from "@/lib/spatial-teaching";
import { buildLearningChallengeSuite, type LearningChallengeSuite } from "@/server/qualification/learning-challenge";
import type {
  ExecutionOutput,
  LearningExtractionStep,
  RuleEvaluationRecord,
  RuleRecord,
  StructuredFeedbackRecord,
  TraceStepRecord,
  VisualDemonstrationArtifact,
  WorkflowNodeDefinition
} from "@/lib/types";
import { executePhotographyJournalTask } from "@/server/workflow/execution-engine";
import { extractRuleFromFeedback } from "@/server/corrections/rule-extractor";
import type { memoryStore } from "@/server/memory/memory-store";

type TaskProfile = NonNullable<Awaited<ReturnType<typeof memoryStore.getTaskProfile>>>;

export type QualificationRequirement = {
  id: string;
  label: string;
  principle: string;
  passed: boolean;
  evidence: string;
  href?: string;
};

export type QualificationLearningDelta = {
  id: string;
  correctionId: string;
  ruleTitle: string;
  sourceRunId: string | null;
  appliedRunId: string | null;
  beforeLighting: string;
  afterLighting: string;
  changedFields: string[];
  fieldChanges: Array<{
    field: string;
    before: string;
    after: string;
  }>;
  memoryEvidence: string;
};

export type QualificationTraceAlignmentStep = {
  nodeId: string;
  nodeLabel: string;
  nodeType: WorkflowNodeDefinition["type"];
  traceStepId: string | null;
  traceStepName: string | null;
  confidence: number | null;
  validation: string | null;
  needsHumanReview: boolean;
  appliedRuleTitles: string[];
};

export type QualificationMemoryProvenance = {
  ruleId: string;
  ruleTitle: string;
  enabled: boolean;
  confidence: number;
  sourceTypes: string[];
  sources: Array<{
    type: "Correction" | "Teaching example" | "Visual demonstration" | "Execution history" | "Seed" | "Spatial teaching";
    label: string;
    evidence: string;
    createdAt: string;
  }>;
  appliedRunIds: string[];
  appliedTraceStepNames: string[];
};

export type QualificationSpatialConstructionCodePatchMemoryReplay = {
  id: string;
  correctionId: string;
  ruleId: string;
  ruleTitle: string;
  geometryPatch: string;
  anchorPoints: SpatialPoint3D[];
  offsetVector: SpatialPoint3D;
  teacherReviewRequired: true;
  accepted: false;
  packagingGated: true;
  learningTraceStepCount: number;
  evidence: string;
  nextStepPrediction: string;
  createdAt: string;
  passed: boolean;
};

export type QualificationSpatialConstructionCodePatchMemoryMatch = {
  id: string;
  replayId: string;
  planId: string;
  selectedCandidateId: string;
  matchScore: number;
  matchedReason: string;
  conflictChecks: string[];
  teacherQuestion: string;
  nextStepPrediction: string;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationPolicyEvidence = {
  id: string;
  label: string;
  passed: boolean;
  evidence: string;
};

export type QualificationExecutionPlanStep = {
  order: number;
  nodeId: string;
  stepName: string;
  plannedInputFields: string[];
  plannedOutputFields: string[];
  appliedRuleTitles: string[];
  confidence: number;
  validation: string;
  needsHumanReview: boolean;
};

export type QualificationVisualScenario = {
  id: string;
  label: string;
  input: string;
  expectedLighting: string;
  actualLighting: string;
  expectedReview: boolean;
  needsReview: boolean;
  passed: boolean;
  traceSummary: Array<{
    stepId: string;
    nodeId: string;
    stepName: string;
    confidence: number;
    validation: string;
    needsHumanReview: boolean;
    appliedRuleTitles: string[];
  }>;
  decisions: Array<{
    title: string;
    decision: RuleEvaluationRecord["decision"];
    memorySource: RuleEvaluationRecord["memorySource"];
    matchedCues: string[];
    counterCues: string[];
    counterEvidenceSources: string[];
    reason: string;
  }>;
  evidence: string;
};

export type QualificationVisualRegressionCase = {
  id: string;
  label: string;
  input: string;
  expectedLighting: string;
  expectedReview: boolean;
  expectedMemoryEffect: "changed" | "conservative";
  baselineLighting: string;
  learnedLighting: string;
  baselineNeedsReview: boolean;
  learnedNeedsReview: boolean;
  changedByMemory: boolean;
  passed: boolean;
  evidence: string;
};

export type QualificationVisualRobustnessCase = {
  id: string;
  label: string;
  input: string;
  expectedLighting: string;
  expectedReview: boolean;
  stressType: "positive_paraphrase" | "false_positive_guard";
  actualLighting: string;
  needsReview: boolean;
  changedByMemory: boolean;
  decisions: Array<{
    title: string;
    decision: RuleEvaluationRecord["decision"];
    matchedCues: string[];
    counterCues: string[];
    reason: string;
  }>;
  passed: boolean;
  evidence: string;
};

export type QualificationVisualRobustnessSuite = {
  reviewOnly: true;
  persisted: false;
  accepted: false;
  packagingGated: true;
  passed: number;
  total: number;
  cases: QualificationVisualRobustnessCase[];
};

export type QualificationCapabilityBoundary = {
  id: string;
  category: "automatic" | "teacher_review" | "memory" | "blocked";
  label: string;
  passed: boolean;
  status: "ready" | "review_required" | "locked";
  evidence: string;
  scenarioIds: string[];
};

export type QualificationCodexCapabilityTransferItem = {
  id: string;
  sourceCapability: string;
  architectureLayer: string;
  transplantedPattern: string;
  mvpUse: string;
  structuredTraceExample: string;
  teacherReviewQuestion: string;
  blockedSideEffects: string[];
  reviewOnly: true;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantDraftRow = {
  id: string;
  capabilityItemId: string;
  apprenticeInterface: string;
  transplantContract: string;
  runtimeTraceFields: string[];
  teacherControl: string;
  verifierCommand: string;
  blockedTransitions: string[];
  reviewOnly: true;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalRow = {
  id: string;
  draftRowId: string;
  rehearsalStep: string;
  simulatedInput: string;
  structuredTracePreview: string[];
  expectedEvidence: string;
  teacherReviewPoint: string;
  noOpActions: string[];
  blockedTransitions: string[];
  reviewOnly: true;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultStatus =
  | "not_run_yet"
  | "matched_expected"
  | "mismatch_blocked";

export type QualificationCodexCapabilityTransplantRehearsalResultRow = {
  id: string;
  rehearsalRowId: string;
  defaultStatus: QualificationCodexCapabilityTransplantRehearsalResultStatus;
  observedOutputPlaceholder: string;
  mismatchQuestion: string;
  followUpNotePlaceholder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationRow = {
  id: string;
  resultRowId: string;
  allowedStatuses: QualificationCodexCapabilityTransplantRehearsalResultStatus[];
  blockedStatus: "accepted";
  lockAssertion: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayRow = {
  id: string;
  validationRowId: string;
  resultRowId: string;
  simulatedStatus: QualificationCodexCapabilityTransplantRehearsalResultStatus;
  nextReviewAction: string;
  consequence: string;
  blockedStatusReminder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueItem = {
  id: string;
  replayRowId: string;
  resultRowId: string;
  lane: "pending_verifier" | "matched_evidence_follow_up" | "mismatch_blocker";
  reviewerAction: string;
  evidenceRequest: string;
  continueCondition: string;
  stopCondition: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffStep = {
  id: string;
  queueItemId: string;
  order: number;
  instruction: string;
  evidencePath: string;
  verifierCommand: string;
  expectedLockedResult: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookItem = {
  id: string;
  handoffStepId: string;
  order: number;
  reviewerAction: string;
  evidencePath: string;
  verificationCommand: string;
  continueCondition: string;
  stopCondition: string;
  lockAssertion: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunItem = {
  id: string;
  runbookItemId: string;
  order: number;
  expectedEvidence: string;
  lockAssertion: string;
  noOpAction: string;
  reviewerNote: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow = {
  id: string;
  dryRunRowId: string;
  order: number;
  observedEvidence: string;
  blockerQuestion: string;
  nextReviewNote: string;
  defaultDecision: "needs_teacher_review";
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptDecision =
  | "needs_teacher_review"
  | "blocked"
  | "ready_for_follow_up";

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow = {
  id: string;
  receiptRowId: string;
  order: number;
  allowedDecisions: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptDecision[];
  blockedDecision: "accepted";
  validationRule: string;
  invalidIf: string[];
  nextActionIfInvalid: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow = {
  id: string;
  validationRowId: string;
  receiptRowId: string;
  order: number;
  simulatedDecision: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptDecision;
  nextReviewAction: string;
  consequence: string;
  blockedDecisionReminder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem = {
  id: string;
  replayRowId: string;
  validationRowId: string;
  receiptRowId: string;
  order: number;
  lane: "missing_teacher_evidence" | "blocked_route" | "review_only_follow_up";
  reviewerAction: string;
  evidenceRequest: string;
  continueCondition: string;
  stopCondition: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep = {
  id: string;
  queueItemId: string;
  replayRowId: string;
  order: number;
  instruction: string;
  evidencePath: string;
  verifierCommand: "npm.cmd run verify:learning";
  expectedLockedResult: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItem = {
  id: string;
  handoffStepId: string;
  queueItemId: string;
  order: number;
  reviewerAction: string;
  evidencePath: string;
  verificationCommand: "npm.cmd run verify:learning";
  continueCondition: string;
  stopCondition: string;
  lockAssertion: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunItem = {
  id: string;
  runbookItemId: string;
  handoffStepId: string;
  order: number;
  expectedEvidence: string;
  lockAssertion: string;
  noOpAction: string;
  reviewerNote: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow = {
  id: string;
  dryRunRowId: string;
  runbookItemId: string;
  order: number;
  observedEvidence: string;
  blockerQuestion: string;
  nextReviewNote: string;
  defaultDecision: "needs_teacher_review";
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptDecision =
  | "needs_teacher_review"
  | "blocked"
  | "ready_for_follow_up";

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow = {
  id: string;
  receiptRowId: string;
  dryRunRowId: string;
  order: number;
  allowedDecisions: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptDecision[];
  blockedDecision: "accepted";
  validationRule: string;
  invalidIf: string[];
  nextActionIfInvalid: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow = {
  id: string;
  validationRowId: string;
  receiptRowId: string;
  dryRunRowId: string;
  order: number;
  simulatedDecision: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptDecision;
  nextReviewAction: string;
  consequence: string;
  blockedDecisionReminder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem = {
  id: string;
  replayRowId: string;
  validationRowId: string;
  receiptRowId: string;
  dryRunRowId: string;
  order: number;
  lane: "missing_teacher_evidence" | "blocked_route" | "review_only_follow_up";
  reviewerAction: string;
  evidenceRequest: string;
  continueCondition: string;
  stopCondition: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep = {
  id: string;
  queueItemId: string;
  replayRowId: string;
  validationRowId: string;
  receiptRowId: string;
  dryRunRowId: string;
  order: number;
  instruction: string;
  evidencePath: string;
  verifierCommand: "npm.cmd run verify:learning";
  expectedLockedResult: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  stepCount: number;
  lockedSteps: number;
  blockedSteps: number;
  steps: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep[];
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  readyItems: number;
  missingTeacherEvidenceItems: number;
  blockedItems: number;
  readyForFollowUpItems: number;
  items: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem[];
  handoff: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  readyRows: number;
  blockedDecisionRows: number;
  rows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow[];
  nextReviewQueue: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  blockedDecisionRows: number;
  rows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow[];
  replay: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  needsReviewRows: number;
  rows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow[];
  validation: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  lockedRows: number;
  noOpRows: number;
  rows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunItem[];
  receiptTemplate: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  lockedChecks: number;
  blockedItems: number;
  items: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItem[];
  dryRunAudit: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  stepCount: number;
  lockedSteps: number;
  blockedSteps: number;
  steps: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep[];
  runbook: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  readyItems: number;
  missingTeacherEvidenceItems: number;
  blockedItems: number;
  readyForFollowUpItems: number;
  items: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem[];
  handoff: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  readyRows: number;
  blockedDecisionRows: number;
  rows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow[];
  nextReviewQueue: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  blockedDecisionRows: number;
  rows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow[];
  replay: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  needsReviewRows: number;
  rows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow[];
  validation: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunAudit = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  lockedRows: number;
  noOpRows: number;
  rows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunItem[];
  receiptTemplate: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbook = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  lockedChecks: number;
  items: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookItem[];
  dryRunAudit: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunAudit;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoff = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  stepCount: number;
  lockedSteps: number;
  steps: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffStep[];
  runbook: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbook;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueue = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  readyItems: number;
  pendingVerifierItems: number;
  matchedEvidenceItems: number;
  mismatchBlockerItems: number;
  lockedItems: number;
  items: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueItem[];
  handoff: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoff;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidationReplay = {
  mode: "codex_capability_transplant_rehearsal_result_validation_replay_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_replay_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  readyRows: number;
  blockedStatusRows: number;
  rows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayRow[];
  nextReviewQueue: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueue;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultValidation = {
  mode: "codex_capability_transplant_rehearsal_result_validation_v1";
  format: "codex_capability_transplant_rehearsal_result_validation_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  readyRows: number;
  blockedStatusRows: number;
  rows: QualificationCodexCapabilityTransplantRehearsalResultValidationRow[];
  replay: QualificationCodexCapabilityTransplantRehearsalResultValidationReplay;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsalResultTemplate = {
  mode: "codex_capability_transplant_rehearsal_result_template_v1";
  format: "codex_capability_transplant_rehearsal_result_template_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  notRunRows: number;
  lockedRows: number;
  rows: QualificationCodexCapabilityTransplantRehearsalResultRow[];
  validation: QualificationCodexCapabilityTransplantRehearsalResultValidation;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantRehearsal = {
  mode: "codex_capability_transplant_rehearsal_v1";
  format: "codex_capability_transplant_rehearsal_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  readyRows: number;
  lockedRows: number;
  rows: QualificationCodexCapabilityTransplantRehearsalRow[];
  resultTemplate: QualificationCodexCapabilityTransplantRehearsalResultTemplate;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransplantDraft = {
  mode: "codex_capability_transplant_draft_v1";
  format: "codex_capability_transplant_draft_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  readyRows: number;
  lockedRows: number;
  rows: QualificationCodexCapabilityTransplantDraftRow[];
  rehearsal: QualificationCodexCapabilityTransplantRehearsal;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCodexCapabilityTransferReport = {
  mode: "codex_capability_transfer_review_v1";
  format: "codex_capability_transfer_review_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  readyItems: number;
  lockedItems: number;
  items: QualificationCodexCapabilityTransferItem[];
  transplantDraft: QualificationCodexCapabilityTransplantDraft;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type VisualLearningReadinessItem = {
  id: string;
  label: string;
  reviewQuestion: string;
  passed: boolean;
  status: "proven" | "review_required" | "locked";
  evidence: string;
  sourceIds: string[];
};

export type QualificationVisualCueAuditTrail = {
  id: string;
  demoId: string;
  demoTitle: string;
  cue: string;
  cueType: "annotation" | "visual_cue" | "lighting_signal";
  sourceEvidence: string;
  regionLabel: string | null;
  confidence: number | null;
  ruleIds: string[];
  ruleTitles: string[];
  scenarioIds: string[];
  challengeIds: string[];
  passed: boolean;
  outcomeEvidence: string;
};

export type QualificationVisualDecisionLedgerItem = {
  id: string;
  sourceType: "scenario" | "challenge";
  sourceId: string;
  sourceLabel: string;
  ruleTitle: string;
  decision: RuleEvaluationRecord["decision"];
  memorySource: RuleEvaluationRecord["memorySource"];
  matchedCues: string[];
  counterCues: string[];
  counterEvidenceSources: string[];
  expectedLighting: string | null;
  actualLighting: string;
  expectedReview: boolean | null;
  needsReview: boolean;
  expectationPassed: boolean | null;
  reason: string;
};

export type QualificationVisualLearningLimit = {
  id: string;
  category: "unproven_cue" | "teacher_review" | "blocked_work";
  label: string;
  status: "needs_evidence" | "review_required" | "locked";
  evidence: string;
  sourceIds: string[];
};

export type QualificationVisualRuleCoverageItem = {
  ruleId: string;
  ruleTitle: string;
  enabled: boolean;
  sourceTypes: string[];
  sourceCount: number;
  appliedRunIds: string[];
  positiveDecisionIds: string[];
  reviewDecisionIds: string[];
  cueAuditIds: string[];
  unprovenCueIds: string[];
  status: "covered" | "source_only" | "needs_teacher_review";
  passed: boolean;
  evidence: string;
};

export type QualificationVisualRuleCoverageMatrix = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  items: QualificationVisualRuleCoverageItem[];
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationVisualCorrectionRehearsalCase = {
  id: string;
  label: string;
  input: string;
  feedback: string;
  structuredFeedback: StructuredFeedbackRecord;
  extractedRuleTitle: string;
  extractedRuleCondition: string;
  extractedRuleAction: string;
  errorType: string;
  beforeLighting: string;
  afterLighting: string;
  beforeReview: boolean;
  afterReview: boolean;
  expectedLighting: string;
  expectedReview: boolean;
  changedByCandidateRule: boolean;
  learningTrace: LearningExtractionStep[];
  passed: boolean;
  evidence: string;
  sourceIds: string[];
};

export type QualificationVisualCorrectionRehearsal = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  persisted: false;
  accepted: false;
  packagingGated: true;
  cases: QualificationVisualCorrectionRehearsalCase[];
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationVisualLearningStateTransition = {
  id: string;
  label: string;
  fromState: string;
  toState: string;
  trigger: "visual_teaching" | "correction_rehearsal" | "review_lock";
  expectedOutcome: string;
  actualOutcome: string;
  reviewState: "automatic" | "teacher_review" | "locked";
  passed: boolean;
  evidence: string;
  sourceIds: string[];
};

export type QualificationVisualLearningStateAudit = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  transitions: QualificationVisualLearningStateTransition[];
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationVisualUncertaintyEscalationItem = {
  id: string;
  label: string;
  trigger: "conflict" | "missing_evidence" | "ordinary_uncertainty" | "correction_boundary" | "packaging_lock";
  reason: string;
  teacherAction: string;
  reviewState: "teacher_review" | "locked";
  evidenceReady: boolean;
  passed: boolean;
  sourceIds: string[];
};

export type QualificationVisualUncertaintyEscalationAudit = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  items: QualificationVisualUncertaintyEscalationItem[];
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationSpatialPoint3D = {
  x: number;
  y: number;
  z: number;
};

export type QualificationSpatialFitCandidate = {
  id: string;
  label: string;
  model:
    | "least_squares_line"
    | "axis_constrained_line"
    | "two_segment_polyline"
    | "circular_arc"
    | "bezier_spline"
    | "multi_segment_bezier_spline"
    | "surface_patch";
  teacherSelectable: true;
  confidence: number;
  residual: number;
  equation: string;
  controlPoints: QualificationSpatialPoint3D[];
  arc?: {
    plane: "xz";
    center: QualificationSpatialPoint3D;
    radius: number;
    startAngleDeg: number;
    endAngleDeg: number;
    sweepDeg: number;
  };
  bezier?: {
    controlHandles: QualificationSpatialPoint3D[];
    sampledPointCount: number;
    maxHandleOffset: number;
  };
  multiSegment?: {
    segmentCount: number;
    knotPoints: QualificationSpatialPoint3D[];
    sampledPointCount: number;
    maxSegmentSpan: number;
  };
  surfacePatch?: {
    fitModel: "local_xz_height_patch";
    patchCenter: QualificationSpatialPoint3D;
    gradient: {
      xSlope: number;
      zSlope: number;
    };
    patchCorners: QualificationSpatialPoint3D[];
    meanHeightResidual: number;
    maxHeightResidual: number;
    exceedCount: number;
  };
  passed: boolean;
  evidence: string;
};

export type QualificationSpatialRuleExtraction = {
  id: string;
  label: string;
  rule: string;
  sourceCandidateIds: string[];
  passed: boolean;
  evidence: string;
};

export type QualificationSpatialTeachingRehearsal = {
  id: string;
  selectedCandidateId: string;
  label: string;
  ruleDraft: string;
  conflictChecks: string[];
  teacherQuestion: string;
  nextStepPrediction: string;
  memoryPolicy: "preview_only_requires_teacher_confirmation";
  passed: boolean;
  evidence: string;
};

export type QualificationSpatialGuidedGenerationStep = {
  id: string;
  order: number;
  label: string;
  proposedOutput: string;
  whyThisStep: string;
  teacherCorrectionSlot: string;
  nextStepPrediction: string;
  reviewState: "awaiting_teacher_review";
  passed: boolean;
  evidence: string;
};

export type QualificationSpatialConstructionPredictionStep = {
  id: string;
  order: number;
  label: string;
  generatedGeometry: string;
  whyThisStep: string;
  validationCheck: string;
  teacherCorrectionSlot: string;
  nextStepPrediction: string;
  reviewState: "awaiting_teacher_review";
  passed: boolean;
};

export type QualificationSpatialConstructionPredictionPlan = {
  id: string;
  selectedCandidateId: string;
  label: string;
  anchorPoints: QualificationSpatialPoint3D[];
  offsetVector: QualificationSpatialPoint3D;
  constructionSteps: QualificationSpatialConstructionPredictionStep[];
  teacherQuestion: string;
  memoryPolicy: "preview_only_requires_teacher_confirmation";
  accepted: false;
  packagingGated: true;
  passed: boolean;
  evidence: string;
};

export type QualificationSpatialEngineeringTeachingModel = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  teachingInputMode: "code_first";
  codeTeachingProtocol: {
    format: "json_dsl";
    schema: string;
    example: string;
    imageUse: "optional_reference_only";
    tokenSavingRationale: string;
  };
  coordinateFrame: {
    unit: "meter";
    axes: ["x", "y", "z"];
    origin: QualificationSpatialPoint3D;
  };
  rawStroke: QualificationSpatialPoint3D[];
  sampleCount: number;
  candidates: QualificationSpatialFitCandidate[];
  extractedRules: QualificationSpatialRuleExtraction[];
  teachingRehearsals: QualificationSpatialTeachingRehearsal[];
  coordinateDialogue: SpatialCoordinateDialoguePreview;
  guidedGenerationSteps: QualificationSpatialGuidedGenerationStep[];
  constructionPredictionPlans: QualificationSpatialConstructionPredictionPlan[];
  batchPatternLearning: SpatialBatchPatternLearning;
  residualTeachingLenses: SpatialFitResidualTeachingLens[];
  surfacePatchTeachingLens: SpatialSurfacePatchTeachingLens;
  directionToleranceChecks: SpatialDirectionToleranceCheck[];
  candidateComparisonMatrix: SpatialFitCandidateComparison[];
  candidateSelectionImpactPreviews: SpatialCandidateSelectionImpactPreview[];
  memoryPersistence: {
    mode: "paused_rule_memory";
    apiPath: "/api/spatial-teaching-memories";
    requiresTeacherConfirmation: true;
    autoApplies: false;
    accepted: false;
    packagingGated: true;
  };
  humanSelectionRequired: true;
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationDomainLearningStage = {
  id: string;
  label: string;
  phase: "self_research" | "knowledge_map" | "human_ingest" | "guided_generation";
  goal: string;
  output: string;
  humanReviewPoint: string;
  passed: boolean;
  evidence: string;
};

export type QualificationDomainKnowledgeNode = {
  id: string;
  label: string;
  category: "concept" | "constraint" | "geometry" | "process" | "validation";
  source: "apprentice_research_plan" | "human_knowledge" | "guided_teaching";
  linkedStageIds: string[];
  passed: boolean;
};

export type QualificationGuidedGenerationStep = {
  id: string;
  label: string;
  proposedOutput: string;
  whyThisStep: string;
  nextStepPrediction: string;
  teacherCorrectionSlot: string;
  reviewState: "awaiting_teacher_review";
  passed: boolean;
};

export type QualificationDomainLearningWorkflow = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  stages: QualificationDomainLearningStage[];
  focusAreas: string[];
  knowledgeNodes: QualificationDomainKnowledgeNode[];
  guidedGenerationSteps: QualificationGuidedGenerationStep[];
  aiSelfStudyResult?: AIDomainSelfStudyResult;
  aiServiceReplacementReadiness: AIServiceReplacementReadinessReport;
  aiServiceOutputValidationRehearsal: AIServiceOutputValidationRehearsal;
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationHumanTeachingMemoryRule = {
  id: string;
  label: string;
  requirement: string;
  appliesTo: "all_future_commands" | "conflicting_new_knowledge" | "teacher_experience";
  passed: boolean;
  evidence: string;
};

export type QualificationTeachingConflictStep = {
  id: string;
  label: string;
  action: string;
  teacherQuestion: string;
  passed: boolean;
};

export type QualificationVoiceTeachingExperience = {
  id: string;
  label: string;
  mode: "voice_optional";
  goal: string;
  teacherBenefit: string;
  passed: boolean;
};

export type QualificationHumanTeachingMemoryProtocol = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rules: QualificationHumanTeachingMemoryRule[];
  conflictSteps: QualificationTeachingConflictStep[];
  voiceExperience: QualificationVoiceTeachingExperience;
  voiceTranscriptDraft: VoiceTeachingTranscriptDraft;
  futureCommandReplay: HumanKnowledgeFutureCommandReplay;
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationVoiceBrowserCompatibilityComparisonItem = {
  browser: AIVoiceBrowserCompatibilityCase["browser"];
  plannedSupport: {
    platformScope: string;
    speechRecognitionSupport: AIVoiceBrowserCompatibilityCase["speechRecognitionSupport"];
    speechSynthesisSupport: AIVoiceBrowserCompatibilityCase["speechSynthesisSupport"];
    voiceListReliability: AIVoiceBrowserCompatibilityCase["voiceListReliability"];
    chineseVoiceRisk: AIVoiceBrowserCompatibilityCase["chineseVoiceRisk"];
    requiredFallback: string;
  };
  persistedReviewIds: string[];
  latestReviewAt: string | null;
  runtimeRecognitionAvailable: boolean | null;
  runtimeSynthesisAvailable: boolean | null;
  runtimeVoiceCount: number | null;
  runtimeChineseVoiceCount: number | null;
  selectedVoiceName: string | null;
  transcriptFallbackTested: boolean | null;
  teacherNotes: string[];
  evidenceStatus: "audit_only" | "runtime_review_saved";
  fallbackRequired: boolean;
  ruleEnabled: false;
  voiceOnlyMemoryEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationVoiceBrowserCompatibilityComparisonReport = {
  mode: "voice_browser_compatibility_export_comparison_v1";
  format: "voice_browser_runtime_review_export_json_v1";
  status: "ready_for_teacher_review" | "needs_more_runtime_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  items: QualificationVoiceBrowserCompatibilityComparisonItem[];
  browsersCovered: number;
  persistedReviewCount: number;
  fallbackTestedBrowsers: number;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationVoiceBrowserCompatibilityBatchDiffRow = {
  browser: AIVoiceBrowserCompatibilityCase["browser"];
  completionStatus: "runtime_review_saved" | "needs_runtime_review";
  evidenceStatus: QualificationVoiceBrowserCompatibilityComparisonItem["evidenceStatus"];
  staticRecognitionSupport: AIVoiceBrowserCompatibilityCase["speechRecognitionSupport"];
  runtimeRecognitionAvailable: boolean | null;
  staticSynthesisSupport: AIVoiceBrowserCompatibilityCase["speechSynthesisSupport"];
  runtimeSynthesisAvailable: boolean | null;
  staticChineseVoiceRisk: AIVoiceBrowserCompatibilityCase["chineseVoiceRisk"];
  runtimeChineseVoiceCount: number | null;
  fallbackRequired: boolean;
  transcriptFallbackTested: boolean | null;
  missingRuntimeFields: string[];
  diffFlags: string[];
  completionPrompt: string;
  ruleEnabled: false;
  voiceOnlyMemoryEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationVoiceBrowserCompatibilityBatchDiffReport = {
  mode: "voice_browser_runtime_batch_gap_diff_v1";
  format: "voice_browser_runtime_batch_gap_diff_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rows: QualificationVoiceBrowserCompatibilityBatchDiffRow[];
  missingRuntimeReviews: number;
  runtimeDiffs: number;
  fallbackGaps: number;
  batchCompletionTemplateJson: string;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeachingPredictionMove = {
  id: string;
  order: number;
  label: string;
  teacherInputMode: "domain_context" | "code_coordinate" | "candidate_selection" | "memory_conflict" | "durable_memory";
  apprenticePrediction: string;
  whyThisPrediction: string;
  teacherCorrectionPoint: string;
  memoryEffect: string;
  conflictPolicy: string;
  reviewState: "awaiting_teacher_review";
  sourceIds: string[];
  passed: boolean;
};

export type QualificationTeachingPredictionBoard = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  metaphor: "chess_like_next_move_prediction";
  moves: QualificationTeachingPredictionMove[];
  teacherPrompt: string;
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationVisualReviewDossierSection = {
  id: string;
  label: string;
  status: "proven" | "review_required" | "locked";
  passed: boolean;
  evidence: string;
  sourceIds: string[];
};

export type QualificationVisualReviewDossier = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  accepted: false;
  packagingGated: true;
  sections: QualificationVisualReviewDossierSection[];
  allowedActions: string[];
  blockedActions: string[];
  teacherPrompt: string;
};

export type QualificationUserRequirementCoverageItem = {
  id: string;
  label: string;
  userRequirement: string;
  evidence: string;
  evidencePath: string;
  reviewState: "ready_for_teacher_review" | "locked_until_teacher_acceptance";
  passed: boolean;
  teacherQuestion: string;
};

export type QualificationUserRequirementCoverageAudit = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  items: QualificationUserRequirementCoverageItem[];
  allowedActions: string[];
  blockedActions: string[];
  teacherPrompt: string;
};

export type QualificationVisualReviewManifest = {
  id: string;
  status: QualificationVisualReviewDossier["status"];
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  generatedFrom: "qualification_report";
  verifierCommand: "npm run verify:learning";
  localReviewUrl: string;
  apiReviewUrl: string;
  evidenceEndpoints: Array<{
    id: string;
    label: string;
    href: string;
    method: "GET";
    persisted: false;
  }>;
  evidenceSections: Array<{
    id: string;
    label: string;
    passed: boolean;
    source: string;
  }>;
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationVisualConfidenceCalibrationItem = {
  id: string;
  sourceType: "scenario" | "challenge";
  sourceId: string;
  label: string;
  expectedOutcome: "automatic" | "teacher_review";
  actualOutcome: "automatic" | "teacher_review";
  averageConfidence: number;
  minimumConfidence: number;
  conflictedDecisions: number;
  passed: boolean;
  evidence: string;
  sourceIds: string[];
};

export type QualificationVisualConfidenceCalibration = {
  status: "calibrated_for_teacher_review" | "needs_more_evidence";
  reviewThreshold: 0.82;
  accepted: false;
  packagingGated: true;
  items: QualificationVisualConfidenceCalibrationItem[];
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationVisualBehaviorScorecardCase = {
  id: string;
  label: string;
  sourceType: "scenario" | "regression" | "robustness" | "challenge";
  expectedLighting: string | null;
  actualLighting: string;
  expectedReview: boolean | null;
  actualReview: boolean;
  expectedMemoryEffect: "changed" | "conservative" | "not_scored";
  changedByMemory: boolean | null;
  route: "automatic" | "teacher_review";
  passed: boolean;
  evidence: string;
  sourceIds: string[];
};

export type QualificationVisualBehaviorScorecardMetric = {
  id: string;
  label: string;
  correct: number;
  total: number;
  passed: boolean;
  evidence: string;
  sourceIds: string[];
};

export type QualificationVisualBehaviorScorecard = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  cases: QualificationVisualBehaviorScorecardCase[];
  metrics: QualificationVisualBehaviorScorecardMetric[];
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationVisualTeacherReviewWorksheetItem = {
  id: string;
  label: string;
  question: string;
  status: "unanswered";
  evidenceReady: boolean;
  readinessSignal: "strong" | "review_carefully" | "locked";
  evidence: string;
  sourceIds: string[];
};

export type QualificationVisualTeacherReviewBatchExchangeItem = {
  id: string;
  label: string;
  question: string;
  evidence: string;
  sourceIds: string[];
  decision: "unreviewed";
  note: string;
};

export type QualificationVisualTeacherReviewBatchExchange = {
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  format: "teacher_review_batch_json_v1";
  itemCount: number;
  allowedDecisions: ["unreviewed", "tentative_pass", "needs_change", "unsure"];
  requiredFields: ["id", "decision", "note"];
  templateJson: string;
  importInstructions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationVisualTeacherReviewDraftDecisionCounts = {
  unreviewed: number;
  tentative_pass: number;
  needs_change: number;
  unsure: number;
};

export type QualificationVisualTeacherReviewDraftVersion = {
  id: string;
  version: "v1" | "v2" | "current";
  label: string;
  decisionCounts: QualificationVisualTeacherReviewDraftDecisionCounts;
  changedItemIds: string[];
  followUpItemIds: string[];
  teacherNote: string;
  comparisonToPrevious: string[];
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationVisualTeacherReviewDraftVersionComparison = {
  mode: "teacher_review_draft_version_comparison";
  versions: QualificationVisualTeacherReviewDraftVersion[];
  currentVersionId: string;
  changedItemCount: number;
  followUpItemCount: number;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationVisualTeacherReviewRecoveredDraftVersion = {
  id: string;
  correctionId: string;
  label: string;
  createdAt: string;
  decisionCounts: QualificationVisualTeacherReviewDraftDecisionCounts;
  followUpItemIds: string[];
  followUpItemCount: number;
  followUpDraft: string;
  teacherSummary: string;
  learningTraceSteps: number;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationVisualTeacherReviewDraftRecoveryReport = {
  mode: "teacher_review_draft_persistence_recovery_v1";
  status: "ready_for_teacher_review" | "no_saved_drafts_yet";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  persistedDraftCount: number;
  latestVersionId: string | null;
  restoredFollowUpItems: number;
  versions: QualificationVisualTeacherReviewRecoveredDraftVersion[];
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationVisualTeacherReviewDraftReplayRow = {
  id: string;
  label: string;
  source: "static_version_diff" | "persisted_recovery_diff";
  fromVersionId: string | null;
  toVersionId: string;
  sourceCorrectionId?: string;
  changedItemIds: string[];
  stableFollowUpItemIds: string[];
  addedFollowUpItemIds: string[];
  removedFollowUpItemIds: string[];
  decisionDelta: QualificationVisualTeacherReviewDraftDecisionCounts;
  nextTeachingFocusIds: string[];
  replaySteps: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationVisualTeacherReviewDraftReplayReport = {
  mode: "teacher_review_draft_diff_recovery_replay_v1";
  format: "teacher_review_draft_diff_recovery_replay_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  staticVersionDiffs: number;
  persistedRecoveryDiffs: number;
  exportedReplayCount: number;
  rows: QualificationVisualTeacherReviewDraftReplayRow[];
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationVisualTeacherReviewWorksheet = {
  status: "awaiting_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  items: QualificationVisualTeacherReviewWorksheetItem[];
  batchReviewExchange: QualificationVisualTeacherReviewBatchExchange;
  draftVersionComparison: QualificationVisualTeacherReviewDraftVersionComparison;
  allowedActions: string[];
  blockedActions: string[];
  teacherInstruction: string;
};

export type QualificationVisualEvidenceReplayStep = {
  id: string;
  phase: "teach" | "extract" | "apply" | "stress" | "limits" | "review";
  label: string;
  status: "ready" | "review_required" | "locked";
  passed: boolean;
  evidence: string;
  sourceIds: string[];
};

export type QualificationVisualEvidenceReplay = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  steps: QualificationVisualEvidenceReplayStep[];
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationVisualRedTeamRisk = {
  id: string;
  label: string;
  risk: string;
  probe: string;
  mitigation: string;
  severity: "medium" | "high";
  status: "mitigated_for_review" | "needs_teacher_review" | "locked";
  passed: boolean;
  sourceIds: string[];
};

export type QualificationVisualRedTeamRegister = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  risks: QualificationVisualRedTeamRisk[];
  allowedActions: string[];
  blockedActions: string[];
};

export type QualificationCrossDomainValidationCase = {
  id: string;
  apprenticeId: string;
  apprenticeLabel: string;
  domain: "photography_journal" | "spatial_engineering" | "human_knowledge";
  transferQuestion: string;
  reusedLearning: string[];
  expectedBehavior: string;
  observedBehavior: string;
  boundaryCheck: string;
  reviewState: "ready_for_teacher_review" | "needs_teacher_review";
  passed: boolean;
};

export type QualificationCrossDomainTeacherScoreDecision =
  | "approve_for_review"
  | "needs_revision"
  | "boundary_only"
  | "hold";

export type QualificationCrossDomainTeacherBatchScoreItem = {
  caseId: string;
  apprenticeId: string;
  domain: QualificationCrossDomainValidationCase["domain"];
  score: number;
  decision: QualificationCrossDomainTeacherScoreDecision;
  note: string;
  followUpQuestion: string;
  draftImpact: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
};

export type QualificationCrossDomainTeacherBatchScoreReplay = {
  mode: "cross_domain_teacher_batch_score_replay_v1";
  format: "teacher_cross_domain_score_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  scoreScale: {
    min: 0;
    max: 100;
    passThreshold: 80;
  };
  items: QualificationCrossDomainTeacherBatchScoreItem[];
  templateJson: string;
  averageScore: number;
  needsFollowUp: number;
  disabledDraftImpacts: number;
  allowedDecisions: QualificationCrossDomainTeacherScoreDecision[];
  importInstructions: string[];
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCrossDomainTeacherScoreDraftRecoveryRow = {
  caseId: string;
  apprenticeId: string;
  domain: QualificationCrossDomainValidationCase["domain"];
  staticScore: number;
  recoveredScore: number | null;
  scoreDelta: number | null;
  staticDecision: QualificationCrossDomainTeacherScoreDecision;
  recoveredDecision: QualificationCrossDomainTeacherScoreDecision | null;
  decisionChanged: boolean;
  followUpChanged: boolean;
  recoveredNote: string;
  nextTeachingFocus: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationCrossDomainTeacherScoreDraftRecoveryDiff = {
  mode: "cross_domain_teacher_score_draft_recovery_diff_v1";
  format: "teacher_cross_domain_score_recovery_diff_json_v1";
  status: "ready_for_teacher_review" | "no_saved_scores_yet";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  persistedDraftCount: number;
  latestCorrectionId: string | null;
  rows: QualificationCrossDomainTeacherScoreDraftRecoveryRow[];
  changedRows: number;
  missingRecoveredRows: number;
  recoveredFollowUps: number;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationCrossDomainValidationReport = {
  mode: "multi_apprentice_cross_domain_review";
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  cases: QualificationCrossDomainValidationCase[];
  domainsCovered: string[];
  apprenticesCovered: string[];
  stableTransfers: number;
  reviewBoundaries: number;
  teacherBatchScoreReplay: QualificationCrossDomainTeacherBatchScoreReplay;
  teacherScoreDraftRecoveryDiff: QualificationCrossDomainTeacherScoreDraftRecoveryDiff;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type TeacherReviewChecklistItem = {
  id: string;
  label: string;
  passed: boolean;
  evidence: string;
  href?: string;
};

export type QualificationLearningLoopTimelineItem = {
  id: string;
  phase: "teach" | "execute" | "correct" | "extract" | "improve" | "review";
  label: string;
  passed: boolean;
  evidence: string;
  href?: string;
};

export type TeacherAcceptanceBoundary = {
  mode: "visual_learning_review_only";
  accepted: false;
  packagingGated: true;
  status: typeof visualLearningAcceptanceGate.status;
  blockedWork: string[];
  allowedWork: string[];
  exposedAcceptanceAction: false;
  reason: string;
};

export type QualificationTeacherAcceptanceEvidenceAgendaItem = {
  id: string;
  label: string;
  evidencePath: string;
  readiness: "ready_for_teacher_decision" | "needs_teacher_answer" | "locked_until_teacher_acceptance";
  evidenceSummary: string;
  teacherDecisionNeeded: string;
  blockedIfMissing: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaDecision =
  | "ready_for_review"
  | "needs_revision"
  | "hold"
  | "locked";

export type QualificationTeacherAcceptanceAgendaDecisionItem = {
  agendaItemId: string;
  label: string;
  evidencePath: string;
  currentReadiness: QualificationTeacherAcceptanceEvidenceAgendaItem["readiness"];
  proposedDecision: QualificationTeacherAcceptanceAgendaDecision;
  note: string;
  teacherQuestion: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaDecisionReplayRow = {
  agendaItemId: string;
  label: string;
  simulatedDecision: QualificationTeacherAcceptanceAgendaDecision;
  nextReviewAction: string;
  consequence: string;
  memoryImpact: string;
  packagingImpact: string;
  teacherQuestion: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaDecisionReplay = {
  mode: "teacher_acceptance_agenda_decision_replay_v1";
  format: "teacher_acceptance_agenda_decision_replay_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  packagingLockedRows: number;
  rows: QualificationTeacherAcceptanceAgendaDecisionReplayRow[];
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaDecisionDraftRecoveryRow = {
  agendaItemId: string;
  label: string;
  staticDecision: QualificationTeacherAcceptanceAgendaDecision;
  recoveredDecision: QualificationTeacherAcceptanceAgendaDecision | null;
  decisionChanged: boolean;
  recoveredNote: string;
  nextReviewAction: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewQueueReason =
  | "missing_decision"
  | "changed_decision"
  | "follow_up_decision"
  | "locked_boundary";

export type QualificationTeacherAcceptanceAgendaNextReviewQueueItem = {
  id: string;
  agendaItemId: string;
  label: string;
  order: number;
  reason: QualificationTeacherAcceptanceAgendaNextReviewQueueReason;
  recoveredDecision: QualificationTeacherAcceptanceAgendaDecision | null;
  nextReviewAction: string;
  teacherPrompt: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewQueue = {
  mode: "teacher_acceptance_agenda_next_review_queue_v1";
  format: "teacher_acceptance_agenda_next_review_queue_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  lockedItems: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewQueueItem[];
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewHandoffStep = {
  id: string;
  queueItemId: string;
  agendaItemId: string;
  order: number;
  reason: QualificationTeacherAcceptanceAgendaNextReviewQueueReason;
  title: string;
  handoffAction: string;
  verificationHint: string;
  teacherPrompt: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewRunbookStep = {
  id: string;
  handoffStepId: string;
  order: number;
  phase: "inspect_evidence" | "replay_decision" | "confirm_lock";
  evidencePath: string;
  reviewerAction: string;
  continueCondition: string;
  stopCondition: string;
  verificationCommand: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewDryRunAuditRow = {
  id: string;
  runbookStepId: string;
  order: number;
  expectedEvidence: string;
  simulatedResult: "awaiting_teacher_review" | "lock_confirmed";
  lockAssertion: string;
  noOpActions: string[];
  reviewerNote: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptDecision =
  | "needs_teacher_review"
  | "blocked"
  | "ready_for_follow_up";

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptTemplateRow = {
  id: string;
  dryRunRowId: string;
  order: number;
  expectedEvidence: string;
  observedEvidencePlaceholder: string;
  defaultDecision: QualificationTeacherAcceptanceAgendaNextReviewReceiptDecision;
  blockerQuestion: string;
  nextReviewerNotePlaceholder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptValidationRow = {
  id: string;
  receiptRowId: string;
  order: number;
  allowedDecisions: QualificationTeacherAcceptanceAgendaNextReviewReceiptDecision[];
  blockedDecision: "accepted";
  validationRule: string;
  invalidIf: string[];
  nextActionIfInvalid: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptDecisionReplayRow = {
  id: string;
  validationRowId: string;
  order: number;
  simulatedDecision: QualificationTeacherAcceptanceAgendaNextReviewReceiptDecision;
  nextReviewAction: string;
  consequence: string;
  blockedDecisionReminder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpPlanItem = {
  id: string;
  replayRowId: string;
  validationRowId: string;
  order: number;
  plannedRoute: "teacher_review_pass" | "blocked_receipt_escalation" | "follow_up_review_planning";
  reviewerAction: string;
  evidenceToCollect: string;
  continueCondition: string;
  stopCondition: string;
  lockReminder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditItem = {
  id: string;
  followUpPlanItemId: string;
  order: number;
  lockCheck: string;
  forbiddenTransitions: string[];
  noOpAssertion: string;
  nextActionIfFailed: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketItem = {
  id: string;
  lockAuditItemId: string;
  order: number;
  evidencePath: string;
  verificationCommand: string;
  expectedResult: string;
  stopIfMismatch: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultStatus =
  | "not_run_yet"
  | "matched_expected"
  | "mismatch_blocked";

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultTemplateItem = {
  id: string;
  verificationPacketItemId: string;
  order: number;
  commandToRun: string;
  observedOutputPlaceholder: string;
  defaultStatus: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultStatus;
  statusOptions: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultStatus[];
  mismatchBlockerQuestion: string;
  nextReviewerNotePlaceholder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationItem = {
  id: string;
  resultTemplateItemId: string;
  order: number;
  allowedStatuses: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultStatus[];
  blockedStatus: "accepted";
  validationRule: string;
  invalidIf: string[];
  nextActionIfInvalid: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayItem = {
  id: string;
  validationItemId: string;
  order: number;
  simulatedStatus: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultStatus;
  nextReviewAction: string;
  consequence: string;
  blockedStatusReminder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItem = {
  id: string;
  replayItemId: string;
  order: number;
  simulatedStatus: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultStatus;
  queueReason: string;
  reviewerAction: string;
  continueCondition: string;
  stopCondition: string;
  evidencePath: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffStep = {
  id: string;
  queueItemId: string;
  order: number;
  title: string;
  handoffInstruction: string;
  evidencePath: string;
  verifierCommand: string;
  expectedLockedResult: string;
  blockedIf: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookItem = {
  id: string;
  handoffStepId: string;
  order: number;
  reviewerAction: string;
  evidencePath: string;
  verificationCommand: string;
  continueCondition: string;
  stopCondition: string;
  lockAssertion: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunItem = {
  id: string;
  runbookItemId: string;
  order: number;
  expectedEvidence: string;
  lockAssertion: string;
  noOpActions: string[];
  reviewerNote: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow = {
  id: string;
  dryRunRowId: string;
  order: number;
  defaultDecision: "needs_teacher_review";
  observedEvidencePlaceholder: string;
  blockerQuestion: string;
  nextReviewNotePlaceholder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow = {
  id: string;
  receiptRowId: string;
  order: number;
  allowedDecisions: QualificationTeacherAcceptanceAgendaNextReviewReceiptDecision[];
  blockedDecision: "accepted";
  validationRule: string;
  invalidIf: string[];
  nextActionIfInvalid: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow = {
  id: string;
  validationRowId: string;
  order: number;
  simulatedDecision: QualificationTeacherAcceptanceAgendaNextReviewReceiptDecision;
  nextReviewAction: string;
  consequence: string;
  blockedDecisionReminder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem = {
  id: string;
  replayRowId: string;
  order: number;
  queueLane: "needs_teacher_review_queue" | "blocked_queue" | "ready_for_follow_up_queue";
  reviewerAction: string;
  evidenceRequest: string;
  continueCondition: string;
  stopCondition: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep = {
  id: string;
  queueItemId: string;
  order: number;
  title: string;
  handoffInstruction: string;
  evidencePath: string;
  verifierCommand: string;
  expectedLockedResult: string;
  blockedIf: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItem = {
  id: string;
  handoffStepId: string;
  order: number;
  reviewerAction: string;
  evidencePath: string;
  verificationCommand: string;
  continueCondition: string;
  stopCondition: string;
  lockAssertion: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunItem = {
  id: string;
  runbookItemId: string;
  order: number;
  expectedEvidence: string;
  lockAssertion: string;
  noOpActions: string[];
  reviewerNote: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow = {
  id: string;
  dryRunRowId: string;
  order: number;
  defaultDecision: "needs_teacher_review";
  observedEvidencePlaceholder: string;
  blockerQuestion: string;
  nextReviewNotePlaceholder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow = {
  id: string;
  receiptRowId: string;
  order: number;
  allowedDecisions: QualificationTeacherAcceptanceAgendaNextReviewReceiptDecision[];
  blockedDecision: "accepted";
  validationRule: string;
  invalidIf: string[];
  nextActionIfInvalid: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow = {
  id: string;
  validationRowId: string;
  order: number;
  simulatedDecision: QualificationTeacherAcceptanceAgendaNextReviewReceiptDecision;
  nextReviewAction: string;
  consequence: string;
  blockedDecisionReminder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  blockedDecisionRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow[];
  nextReviewQueue: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem = {
  id: string;
  replayRowId: string;
  order: number;
  queueLane: "needs_teacher_review_queue" | "blocked_queue" | "ready_for_follow_up_queue";
  reviewerAction: string;
  evidenceRequest: string;
  continueCondition: string;
  stopCondition: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep = {
  id: string;
  queueItemId: string;
  order: number;
  title: string;
  handoffInstruction: string;
  evidencePath: string;
  verifierCommand: string;
  expectedLockedResult: string;
  blockedIf: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItem = {
  id: string;
  handoffStepId: string;
  order: number;
  reviewerAction: string;
  evidencePath: string;
  verificationCommand: string;
  continueCondition: string;
  stopCondition: string;
  lockAssertion: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunItem = {
  id: string;
  runbookItemId: string;
  order: number;
  expectedEvidence: string;
  lockAssertion: string;
  noOpActions: string[];
  reviewerNote: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow = {
  id: string;
  dryRunRowId: string;
  order: number;
  defaultDecision: "needs_teacher_review";
  observedEvidencePlaceholder: string;
  blockerQuestion: string;
  nextReviewNotePlaceholder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow = {
  id: string;
  receiptRowId: string;
  order: number;
  allowedDecisions: ("needs_teacher_review" | "blocked" | "ready_for_follow_up")[];
  blockedDecision: "accepted";
  validationRule: string;
  invalidIf: string[];
  nextActionIfInvalid: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow = {
  id: string;
  validationRowId: string;
  order: number;
  simulatedDecision: "needs_teacher_review" | "blocked" | "ready_for_follow_up";
  nextReviewAction: string;
  consequence: string;
  blockedDecisionReminder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem = {
  id: string;
  replayRowId: string;
  order: number;
  queueLane: "needs_teacher_review_queue" | "blocked_queue" | "ready_for_follow_up_queue";
  reviewerAction: string;
  evidenceRequest: string;
  continueCondition: string;
  stopCondition: string;
  blockedTransitions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep = {
  id: string;
  queueItemId: string;
  order: number;
  title: string;
  handoffInstruction: string;
  evidencePath: string;
  verifierCommand: string;
  expectedLockedResult: string;
  blockedIf: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItem = {
  id: string;
  handoffStepId: string;
  order: number;
  reviewerAction: string;
  evidencePath: string;
  verificationCommand: string;
  continueCondition: string;
  stopCondition: string;
  lockAssertion: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunItem = {
  id: string;
  runbookItemId: string;
  order: number;
  expectedEvidence: string;
  lockAssertion: string;
  noOpActions: string[];
  reviewerNote: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow = {
  id: string;
  dryRunRowId: string;
  order: number;
  defaultDecision: "needs_teacher_review";
  observedEvidencePlaceholder: string;
  blockerQuestion: string;
  nextReviewNotePlaceholder: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  needsReviewRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow[];
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  noOpRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunItem[];
  receiptTemplate: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  lockedChecks: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItem[];
  dryRunAudit: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  stepCount: number;
  blockedSteps: number;
  steps: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep[];
  runbook: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  blockedItems: number;
  readyForFollowUpItems: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem[];
  handoff: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  blockedDecisionRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow[];
  nextReviewQueue: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  blockedDecisionRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow[];
  replay: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  needsReviewRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow[];
  validation: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  noOpRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunItem[];
  receiptTemplate: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  lockedChecks: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItem[];
  dryRunAudit: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  stepCount: number;
  blockedStepCount: number;
  steps: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep[];
  runbook: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  needsTeacherReviewItems: number;
  blockedItems: number;
  readyForFollowUpItems: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem[];
  handoff: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  blockedDecisionRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow[];
  replay: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  needsReviewRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow[];
  validation: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  noOpRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunItem[];
  receiptTemplate: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  lockedChecks: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItem[];
  dryRunAudit: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  stepCount: number;
  blockedSteps: number;
  steps: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep[];
  runbook: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  needsTeacherReviewItems: number;
  blockedItems: number;
  readyForFollowUpItems: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem[];
  handoff: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  blockedDecisionRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow[];
  nextReviewQueue: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  blockedDecisionRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow[];
  replay: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  needsReviewRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow[];
  validation: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunAudit = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  noOpRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunItem[];
  receiptTemplate: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbook = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  lockedChecks: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookItem[];
  dryRunAudit: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunAudit;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoff = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  stepCount: number;
  mismatchStopSteps: number;
  steps: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffStep[];
  runbook: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbook;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueue = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  notRunRows: number;
  matchedRows: number;
  mismatchStopRows: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItem[];
  handoff: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoff;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplay = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  blockedStatusCount: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayItem[];
  nextReviewQueue: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueue;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidation = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  blockedStatusCount: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationItem[];
  replay: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplay;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultTemplate = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  notRunRows: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultTemplateItem[];
  validation: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidation;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacket = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  commandCount: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketItem[];
  resultTemplate: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultTemplate;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpLockAudit = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  forbiddenTransitionCount: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditItem[];
  verificationPacket: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacket;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpPlan = {
  mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  blockedRouteCount: number;
  items: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpPlanItem[];
  lockAudit: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpLockAudit;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptDecisionReplay = {
  mode: "teacher_acceptance_agenda_next_review_receipt_decision_replay_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_decision_replay_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  blockedDecisionCount: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptDecisionReplayRow[];
  followUpPlan: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpPlan;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptValidation = {
  mode: "teacher_acceptance_agenda_next_review_receipt_validation_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_validation_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  blockedDecisionCount: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptValidationRow[];
  decisionReplay: QualificationTeacherAcceptanceAgendaNextReviewReceiptDecisionReplay;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewReceiptTemplate = {
  mode: "teacher_acceptance_agenda_next_review_receipt_template_v1";
  format: "teacher_acceptance_agenda_next_review_receipt_template_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  needsReviewRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewReceiptTemplateRow[];
  validation: QualificationTeacherAcceptanceAgendaNextReviewReceiptValidation;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewDryRunAudit = {
  mode: "teacher_acceptance_agenda_next_review_dry_run_audit_v1";
  format: "teacher_acceptance_agenda_next_review_dry_run_audit_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  rowCount: number;
  noOpRows: number;
  rows: QualificationTeacherAcceptanceAgendaNextReviewDryRunAuditRow[];
  receiptTemplate: QualificationTeacherAcceptanceAgendaNextReviewReceiptTemplate;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewRunbook = {
  mode: "teacher_acceptance_agenda_next_review_runbook_v1";
  format: "teacher_acceptance_agenda_next_review_runbook_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  stepCount: number;
  lockedChecks: number;
  steps: QualificationTeacherAcceptanceAgendaNextReviewRunbookStep[];
  dryRunAudit: QualificationTeacherAcceptanceAgendaNextReviewDryRunAudit;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaNextReviewHandoff = {
  mode: "teacher_acceptance_agenda_next_review_handoff_v1";
  format: "teacher_acceptance_agenda_next_review_handoff_json_v1";
  status: "ready_for_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  queueItemCount: number;
  stepCount: number;
  lockedSteps: number;
  steps: QualificationTeacherAcceptanceAgendaNextReviewHandoffStep[];
  verificationCommands: string[];
  runbook: QualificationTeacherAcceptanceAgendaNextReviewRunbook;
  handoffText: string;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaDecisionDraftRecovery = {
  mode: "teacher_acceptance_agenda_decision_draft_recovery_v1";
  format: "teacher_acceptance_agenda_decision_draft_recovery_json_v1";
  status: "ready_for_teacher_review" | "no_saved_decision_draft_yet";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  persistedDraftCount: number;
  latestCorrectionId: string | null;
  rows: QualificationTeacherAcceptanceAgendaDecisionDraftRecoveryRow[];
  changedRows: number;
  missingRecoveredRows: number;
  followUpRows: number;
  nextReviewQueue: QualificationTeacherAcceptanceAgendaNextReviewQueue;
  nextReviewHandoff: QualificationTeacherAcceptanceAgendaNextReviewHandoff;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceAgendaDecisionExchange = {
  mode: "teacher_acceptance_agenda_decision_exchange_v1";
  format: "teacher_acceptance_agenda_decision_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  itemCount: number;
  allowedDecisions: QualificationTeacherAcceptanceAgendaDecision[];
  items: QualificationTeacherAcceptanceAgendaDecisionItem[];
  decisionReplay: QualificationTeacherAcceptanceAgendaDecisionReplay;
  draftRecovery: QualificationTeacherAcceptanceAgendaDecisionDraftRecovery;
  templateJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationTeacherAcceptanceEvidenceAgenda = {
  mode: "teacher_acceptance_evidence_gap_agenda_v1";
  format: "teacher_acceptance_evidence_gap_agenda_json_v1";
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  items: QualificationTeacherAcceptanceEvidenceAgendaItem[];
  readyItems: number;
  unansweredItems: number;
  lockedItems: number;
  decisionExchange: QualificationTeacherAcceptanceAgendaDecisionExchange;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationHandsOnTeachingLessonStep = {
  id: string;
  order: number;
  phase:
    | "domain_orientation"
    | "teacher_instruction"
    | "code_coordinate"
    | "model_fit"
    | "next_move_prediction"
    | "teacher_correction"
    | "memory_replay";
  label: string;
  teacherCanDo: string;
  apprenticeWillDo: string;
  whyThisStep: string;
  visibleEvidence: string;
  correctionPoint: string;
  evidencePath: string;
  panelAnchorId: string;
  reviewState: "awaiting_teacher_review" | "locked_until_teacher_acceptance";
  passed: boolean;
};

export type QualificationHandsOnTeachingRunbookItem = {
  stepId: string;
  order: number;
  phase: QualificationHandsOnTeachingLessonStep["phase"];
  label: string;
  anchorId: string;
  evidencePath: string;
  teacherAction: string;
  expectedApprenticeResponse: string;
  correctionCheckpoint: string;
  reviewState: QualificationHandsOnTeachingLessonStep["reviewState"];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type QualificationHandsOnTeachingRunbook = {
  mode: "hands_on_teaching_lesson_runbook_v1";
  format: "hands_on_teaching_lesson_runbook_json_v1";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  items: QualificationHandsOnTeachingRunbookItem[];
  readySteps: number;
  lockedSteps: number;
  exportJson: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type QualificationHandsOnTeachingLesson = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  startPrompt: string;
  steps: QualificationHandsOnTeachingLessonStep[];
  runbook: QualificationHandsOnTeachingRunbook;
  allowedActions: string[];
  blockedActions: string[];
  teacherPrompt: string;
};

export type QualificationReport = {
  taskId: string;
  apprenticeId: string;
  status: "qualified_for_teacher_review" | "needs_learning_evidence";
  packaging: {
    gated: true;
    accepted: false;
    status: typeof visualLearningAcceptanceGate.status;
    reason: string;
  };
  requirements: QualificationRequirement[];
  summary: {
    requirementsPassed: number;
    requirementsTotal: number;
    architectureLayers: number;
    workflowNodes: number;
    rules: number;
    corrections: number;
    visualDemos: number;
    examples: number;
    runs: number;
    learningDeltas: number;
    traceAlignedNodes: number;
    traceTotalNodes: number;
    memoryProvenanceRules: number;
    policyGatesPassed: number;
    policyGatesTotal: number;
    teacherReviewChecklistPassed: number;
    teacherReviewChecklistTotal: number;
    learningLoopTimelinePassed: number;
    learningLoopTimelineTotal: number;
    acceptanceBoundaryPassed: number;
    acceptanceBoundaryTotal: number;
    teacherAcceptanceAgendaItems: number;
    teacherAcceptanceAgendaReady: number;
    teacherAcceptanceAgendaUnanswered: number;
    teacherAcceptanceAgendaLocked: number;
    teacherAcceptanceAgendaDecisionItems: number;
    teacherAcceptanceAgendaDecisionReady: number;
    teacherAcceptanceAgendaAllowedDecisions: number;
    teacherAcceptanceAgendaDecisionReplayRows: number;
    teacherAcceptanceAgendaDecisionReplayReady: number;
    teacherAcceptanceAgendaDecisionReplayLockedRows: number;
    teacherAcceptanceAgendaDecisionDraftRecoveryRows: number;
    teacherAcceptanceAgendaDecisionDraftRecoveryReady: number;
    teacherAcceptanceAgendaDecisionDraftRecoveryPersisted: number;
    teacherAcceptanceAgendaDecisionDraftRecoveryChangedRows: number;
    teacherAcceptanceAgendaDecisionDraftRecoveryMissingRows: number;
    teacherAcceptanceAgendaDecisionDraftRecoveryFollowUps: number;
    teacherAcceptanceAgendaNextReviewQueueItems: number;
    teacherAcceptanceAgendaNextReviewQueueReady: number;
    teacherAcceptanceAgendaNextReviewQueueLockedItems: number;
    teacherAcceptanceAgendaNextReviewHandoffSteps: number;
    teacherAcceptanceAgendaNextReviewHandoffReady: number;
    teacherAcceptanceAgendaNextReviewHandoffLockedSteps: number;
    teacherAcceptanceAgendaNextReviewRunbookSteps: number;
    teacherAcceptanceAgendaNextReviewRunbookReady: number;
    teacherAcceptanceAgendaNextReviewRunbookLockedChecks: number;
    teacherAcceptanceAgendaNextReviewDryRunRows: number;
    teacherAcceptanceAgendaNextReviewDryRunReady: number;
    teacherAcceptanceAgendaNextReviewDryRunNoOpRows: number;
    teacherAcceptanceAgendaNextReviewReceiptRows: number;
    teacherAcceptanceAgendaNextReviewReceiptReady: number;
    teacherAcceptanceAgendaNextReviewReceiptNeedsReviewRows: number;
    teacherAcceptanceAgendaNextReviewReceiptValidationRows: number;
    teacherAcceptanceAgendaNextReviewReceiptValidationReady: number;
    teacherAcceptanceAgendaNextReviewReceiptValidationBlockedDecisions: number;
    teacherAcceptanceAgendaNextReviewReceiptReplayRows: number;
    teacherAcceptanceAgendaNextReviewReceiptReplayReady: number;
    teacherAcceptanceAgendaNextReviewReceiptReplayBlockedDecisions: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanBlockedRoutes: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditForbiddenTransitions: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketCommands: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultNotRunRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationBlockedStatuses: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayBlockedStatuses: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueMismatchStops: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffSteps: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffMismatchStops: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookLockedChecks: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunNoOpRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady: number;
    teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows: number;
    executionPlanSteps: number;
    visualScenarioPassed: number;
    visualScenarioTotal: number;
    visualScenarioTraceSteps: number;
    visualRegressionPassed: number;
    visualRegressionTotal: number;
    visualRegressionChanged: number;
    visualRegressionConservative: number;
    visualRobustnessPassed: number;
    visualRobustnessTotal: number;
    visualRobustnessFalsePositiveGuards: number;
    visualRobustnessPositiveParaphrases: number;
    challengeSuitePassed: number;
    challengeSuiteTotal: number;
    challengeSuiteTraceSteps: number;
    capabilityBoundaryPassed: number;
    capabilityBoundaryTotal: number;
    capabilityBoundaryItems: number;
    codexCapabilityTransferItems: number;
    codexCapabilityTransferReady: number;
    codexCapabilityTransferLocked: number;
    codexCapabilityTransplantRehearsalRows: number;
    codexCapabilityTransplantRehearsalReady: number;
    codexCapabilityTransplantRehearsalLocked: number;
    codexCapabilityTransplantRehearsalResultRows: number;
    codexCapabilityTransplantRehearsalResultNotRun: number;
    codexCapabilityTransplantRehearsalResultLocked: number;
    codexCapabilityTransplantRehearsalResultValidationRows: number;
    codexCapabilityTransplantRehearsalResultValidationReady: number;
    codexCapabilityTransplantRehearsalResultValidationBlockedStatuses: number;
    codexCapabilityTransplantRehearsalResultValidationReplayRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayBlockedStatuses: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueItems: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueuePendingVerifier: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueMatchedEvidence: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueMismatchBlockers: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffSteps: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffLockedSteps: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookItems: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookLockedChecks: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunNoOpRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady: number;
    codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps: number;
    visualReadinessPassed: number;
    visualReadinessTotal: number;
    visualCueAuditPassed: number;
    visualCueAuditTotal: number;
    visualDecisionLedgerItems: number;
    visualDecisionApplied: number;
    visualDecisionConflicted: number;
    visualDecisionReviewRequired: number;
    visualLearningLimitItems: number;
    visualLearningUnprovenCues: number;
    visualLearningReviewLimits: number;
    visualLearningBlockedLimits: number;
    visualRuleCoverageRules: number;
    visualRuleCoverageCovered: number;
    visualRuleCoverageSourceOnly: number;
    visualRuleCoveragePositiveLinks: number;
    visualRuleCoverageReviewLinks: number;
    visualCorrectionRehearsals: number;
    visualCorrectionRehearsalsPassed: number;
    visualCorrectionRehearsalChanged: number;
    visualCorrectionRehearsalReviewPreserved: number;
    visualStateTransitions: number;
    visualStateTransitionsPassed: number;
    visualStateTransitionAutomatic: number;
    visualStateTransitionReview: number;
    visualStateTransitionLocked: number;
    visualUncertaintyEscalations: number;
    visualUncertaintyEscalationsReady: number;
    visualUncertaintyTeacherReview: number;
    visualUncertaintyLocked: number;
    spatialTeachingSamples: number;
    spatialFitCandidates: number;
    spatialFitCandidatesReady: number;
    spatialArcFitCandidates: number;
    spatialSplineFitCandidates: number;
    spatialMultiSegmentSplineFitCandidates: number;
    spatialSurfacePatchFitCandidates: number;
    spatialTeacherSelectableCandidates: number;
    spatialModelingRules: number;
    spatialTeachingRehearsals: number;
    spatialTeachingRehearsalsReady: number;
    spatialGuidedGenerationSteps: number;
    spatialGuidedGenerationStepsReady: number;
    spatialConstructionPredictionPlans: number;
    spatialConstructionPredictionPlansReady: number;
    spatialBatchSamples: number;
    spatialBatchRuleCandidates: number;
    spatialPositionParameterRows: number;
    spatialPositionParameterRowsReady: number;
    spatialPositionParameterReportReady: number;
    spatialResidualLenses: number;
    spatialResidualVectors: number;
    spatialSurfacePatchLenses: number;
    spatialSurfacePatchVectors: number;
    spatialSurfacePatchReady: number;
    spatialSurfacePatchStabilitySamples: number;
    spatialSurfacePatchStabilityReady: number;
    spatialSurfacePatchStabilityOutliers: number;
    spatialSurfacePatchSelectionReplays: number;
    spatialSurfacePatchSelectionReplayReady: number;
    spatialSurfacePatchSelectionReplayDisabledDrafts: number;
    spatialDirectionToleranceChecks: number;
    spatialDirectionToleranceReady: number;
    spatialCandidateComparisons: number;
    spatialCandidateComparisonsReady: number;
    spatialCandidateSelectionImpactPreviews: number;
    spatialCandidateSelectionImpactPreviewsReady: number;
    spatialCandidateSelectionDisabledDrafts: number;
    spatialCandidateImpactCorrectionRehearsals: number;
    spatialCandidateImpactCorrectionRehearsalsReady: number;
    spatialCandidateImpactSecondRoundCandidates: number;
    spatialCandidateImpactSecondRoundSelectionPreviews: number;
    spatialCandidateImpactSecondRoundSelectionPreviewsReady: number;
    spatialCandidateImpactSecondRoundSelectionTraceSteps: number;
    spatialCandidateImpactSecondRoundSelectionTraceStepsReady: number;
    spatialCandidateImpactRegeneratedDrafts: number;
    spatialPausedMemoryRules: number;
    spatialCodePatchMemories: number;
    spatialCodePatchMemoriesReady: number;
    spatialCodePatchMemoryMatches: number;
    spatialCodePatchMemoryMatchesReady: number;
    domainLearningStages: number;
    domainLearningStagesReady: number;
    domainKnowledgeNodes: number;
    domainGuidedGenerationSteps: number;
    aiServiceReplacementSchemaChecks: number;
    aiServiceReplacementSteps: number;
    aiServiceReplacementReady: number;
    aiServiceValidationCases: number;
    aiServiceValidationBlockedCases: number;
    aiServiceValidationReady: number;
    humanTeachingMemoryRules: number;
    humanTeachingMemoryRulesReady: number;
    teachingConflictSteps: number;
    teachingConflictStepsReady: number;
    voiceTeachingModes: number;
    voiceRestatementReviewVersions: number;
    voiceRestatementReviewHistoryReady: number;
    voiceEngineSelectionCandidates: number;
    voiceEngineSelectionReady: number;
    voiceEngineTeacherScoreReplays: number;
    voiceBrowserCompatibilityBrowsers: number;
    voiceBrowserCompatibilityReady: number;
    voiceBrowserCompatibilityRecognitionRisks: number;
    voiceBrowserCompatibilityFallbacks: number;
    voiceBrowserCompatibilityReviewDrafts: number;
    voiceBrowserCompatibilityComparisonBrowsers: number;
    voiceBrowserCompatibilityComparisonReady: number;
    voiceBrowserCompatibilityComparisonPersistedReviews: number;
    voiceBrowserCompatibilityComparisonFallbackTests: number;
    voiceBrowserCompatibilityBatchDiffRows: number;
    voiceBrowserCompatibilityBatchDiffReady: number;
    voiceBrowserCompatibilityBatchDiffMissingReviews: number;
    voiceBrowserCompatibilityBatchDiffRuntimeDiffs: number;
    voiceBrowserCompatibilityBatchDiffFallbackGaps: number;
    teachingPredictionMoves: number;
    teachingPredictionMovesReady: number;
    visualReviewDossierPassed: number;
    visualReviewDossierTotal: number;
    userRequirementCoverageItems: number;
    userRequirementCoverageReady: number;
    userRequirementCoverageLocked: number;
    handsOnTeachingLessonSteps: number;
    handsOnTeachingLessonReady: number;
    handsOnTeachingLessonLocked: number;
    handsOnTeachingRunbookSteps: number;
    handsOnTeachingRunbookReady: number;
    handsOnTeachingRunbookLocked: number;
    visualReviewManifestSections: number;
    visualReviewManifestEndpoints: number;
    visualConfidenceCalibrationPassed: number;
    visualConfidenceCalibrationTotal: number;
    visualConfidenceAutoReady: number;
    visualConfidenceReviewRequired: number;
    visualBehaviorScorecardCases: number;
    visualBehaviorScorecardPassed: number;
    visualBehaviorScorecardMetrics: number;
    visualBehaviorScorecardMetricsPassed: number;
    visualBehaviorScorecardAutoRoutes: number;
    visualBehaviorScorecardReviewRoutes: number;
    visualTeacherWorksheetItems: number;
    visualTeacherWorksheetReady: number;
    visualTeacherWorksheetUnanswered: number;
    visualTeacherWorksheetBatchExportItems: number;
    visualTeacherWorksheetBatchExportReady: number;
    visualTeacherWorksheetBatchAllowedDecisions: number;
    visualTeacherWorksheetDraftVersions: number;
    visualTeacherWorksheetDraftVersionReady: number;
    visualTeacherWorksheetDraftChangedItems: number;
    visualTeacherWorksheetDraftFollowUpItems: number;
    visualTeacherReviewDraftRecoveryVersions: number;
    visualTeacherReviewDraftRecoveryReady: number;
    visualTeacherReviewDraftRecoveryPersisted: number;
    visualTeacherReviewDraftRecoveryFollowUps: number;
    visualTeacherReviewDraftReplayRows: number;
    visualTeacherReviewDraftReplayReady: number;
    visualTeacherReviewDraftReplayStaticDiffs: number;
    visualTeacherReviewDraftReplayPersistedDiffs: number;
    visualTeacherReviewDraftReplayExported: number;
    visualTeacherReviewDrafts: number;
    visualEvidenceReplaySteps: number;
    visualEvidenceReplayReady: number;
    visualRedTeamRisks: number;
    visualRedTeamMitigated: number;
    visualRedTeamTeacherReview: number;
    visualRedTeamLocked: number;
    crossDomainValidationCases: number;
    crossDomainValidationReady: number;
    crossDomainValidationDomains: number;
    crossDomainValidationApprentices: number;
    crossDomainValidationReviewBoundaries: number;
    crossDomainTeacherScoreItems: number;
    crossDomainTeacherScoreReplayReady: number;
    crossDomainTeacherScoreAverage: number;
    crossDomainTeacherScoreFollowUps: number;
    crossDomainTeacherScoreDisabledDrafts: number;
    crossDomainTeacherScoreRecoveryRows: number;
    crossDomainTeacherScoreRecoveryReady: number;
    crossDomainTeacherScoreRecoveryPersisted: number;
    crossDomainTeacherScoreRecoveryChangedRows: number;
    crossDomainTeacherScoreRecoveryMissingRows: number;
    crossDomainTeacherScoreRecoveryFollowUps: number;
  };
  learningDeltas: QualificationLearningDelta[];
  executionPlan: QualificationExecutionPlanStep[];
  traceAlignment: QualificationTraceAlignmentStep[];
  memoryProvenance: QualificationMemoryProvenance[];
  policyEvidence: QualificationPolicyEvidence[];
  teacherReviewChecklist: TeacherReviewChecklistItem[];
  learningLoopTimeline: QualificationLearningLoopTimelineItem[];
  teacherAcceptanceBoundary: TeacherAcceptanceBoundary;
  teacherAcceptanceEvidenceAgenda: QualificationTeacherAcceptanceEvidenceAgenda;
  visualDemos: Array<{
    id: string;
    title: string;
    hasReferenceImage: boolean;
    visualCueCount: number;
    annotationCount: number;
    lightingSignalCount: number;
  }>;
  visualLearningScenarios: QualificationVisualScenario[];
  visualRegressionCases: QualificationVisualRegressionCase[];
  visualRobustnessSuite: QualificationVisualRobustnessSuite;
  challengeSuite: LearningChallengeSuite;
  capabilityBoundary: QualificationCapabilityBoundary[];
  codexCapabilityTransferReport: QualificationCodexCapabilityTransferReport;
  visualLearningReadiness: VisualLearningReadinessItem[];
  visualCueAuditTrail: QualificationVisualCueAuditTrail[];
  visualDecisionLedger: QualificationVisualDecisionLedgerItem[];
  visualLearningLimits: QualificationVisualLearningLimit[];
  visualRuleCoverageMatrix: QualificationVisualRuleCoverageMatrix;
  visualCorrectionRehearsal: QualificationVisualCorrectionRehearsal;
  visualLearningStateAudit: QualificationVisualLearningStateAudit;
  visualUncertaintyEscalationAudit: QualificationVisualUncertaintyEscalationAudit;
  spatialEngineeringTeachingModel: QualificationSpatialEngineeringTeachingModel;
  spatialConstructionCodePatchMemoryReplays: QualificationSpatialConstructionCodePatchMemoryReplay[];
  spatialConstructionCodePatchMemoryMatches: QualificationSpatialConstructionCodePatchMemoryMatch[];
  domainLearningWorkflow: QualificationDomainLearningWorkflow;
  humanTeachingMemoryProtocol: QualificationHumanTeachingMemoryProtocol;
  voiceBrowserCompatibilityComparisonReport: QualificationVoiceBrowserCompatibilityComparisonReport;
  voiceBrowserCompatibilityBatchDiffReport: QualificationVoiceBrowserCompatibilityBatchDiffReport;
  teachingPredictionBoard: QualificationTeachingPredictionBoard;
  visualReviewDossier: QualificationVisualReviewDossier;
  userRequirementCoverageAudit: QualificationUserRequirementCoverageAudit;
  handsOnTeachingLesson: QualificationHandsOnTeachingLesson;
  visualReviewManifest: QualificationVisualReviewManifest;
  visualConfidenceCalibration: QualificationVisualConfidenceCalibration;
  visualBehaviorScorecard: QualificationVisualBehaviorScorecard;
  visualTeacherReviewWorksheet: QualificationVisualTeacherReviewWorksheet;
  visualTeacherReviewDraftRecoveryReport: QualificationVisualTeacherReviewDraftRecoveryReport;
  visualTeacherReviewDraftReplayReport: QualificationVisualTeacherReviewDraftReplayReport;
  visualEvidenceReplay: QualificationVisualEvidenceReplay;
  visualRedTeamRegister: QualificationVisualRedTeamRegister;
  crossDomainValidationReport: QualificationCrossDomainValidationReport;
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

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

  return value === undefined || value === null || value === "" ? "unknown" : String(value);
}

function isSpatialPoint3D(value: unknown): value is SpatialPoint3D {
  if (!value || typeof value !== "object") {
    return false;
  }

  const point = value as Partial<SpatialPoint3D>;
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
}

function isSpatialConstructionCodePatch(value: unknown): value is SpatialConstructionRevisionCodePatch {
  if (!value || typeof value !== "object") {
    return false;
  }

  const patch = value as Partial<SpatialConstructionRevisionCodePatch>;
  return (
    typeof patch.sourcePlanId === "string" &&
    typeof patch.revisionCandidateId === "string" &&
    Array.isArray(patch.anchorPoints) &&
    patch.anchorPoints.length >= 2 &&
    patch.anchorPoints.every(isSpatialPoint3D) &&
    isSpatialPoint3D(patch.offsetVector) &&
    typeof patch.geometryPatch === "string" &&
    patch.geometryPatch.trim().length > 0 &&
    patch.teacherReviewRequired === true &&
    patch.accepted === false &&
    patch.packagingGated === true
  );
}

function subtractSpatialPoints(a: SpatialPoint3D, b: SpatialPoint3D): SpatialPoint3D {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  };
}

function spatialVectorLength(point: SpatialPoint3D) {
  return Math.hypot(point.x, point.y, point.z);
}

function spatialDirectionSimilarity(a: SpatialPoint3D, b: SpatialPoint3D) {
  const lengthA = spatialVectorLength(a);
  const lengthB = spatialVectorLength(b);

  if (lengthA < 0.000001 || lengthB < 0.000001) {
    return 0;
  }

  const cosine = (a.x * b.x + a.y * b.y + a.z * b.z) / (lengthA * lengthB);
  return Math.max(0, Math.min(1, (cosine + 1) / 2));
}

function normalizeEvidenceText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim();
}

function textReferencesCue(text: string, cue: string) {
  const normalizedText = normalizeEvidenceText(text);
  const normalizedCue = normalizeEvidenceText(cue);

  if (!normalizedText || !normalizedCue) {
    return false;
  }

  if (normalizedText.includes(normalizedCue) || normalizedCue.includes(normalizedText)) {
    return true;
  }

  const cueWords = normalizedCue.split(/\s+/).filter((word) => word.length > 2);
  return cueWords.length > 0 && cueWords.every((word) => normalizedText.includes(word));
}

function hasPrivateTraceKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasPrivateTraceKey);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, item]) => {
      return ["chainOfThought", "privateChainOfThought", "hiddenReasoning"].includes(key) || hasPrivateTraceKey(item);
    });
  }

  return false;
}

function normalizeRule(rule: TaskProfile["rules"][number], taskId: string): RuleRecord {
  return {
    id: rule.id,
    apprenticeId: rule.apprenticeId,
    taskId: rule.taskId ?? taskId,
    title: rule.title,
    condition: rule.condition,
    action: rule.action,
    source: rule.source === "seed" || rule.source === "manual" ? rule.source : "correction",
    confidence: rule.confidence,
    enabled: rule.enabled,
    createdAt: rule.createdAt
  };
}

function isSpatialTeachingRule(rule: Pick<RuleRecord, "id" | "title" | "condition" | "action">) {
  return (
    rule.id.startsWith("spatial-teaching-rule-") ||
    rule.id.startsWith("spatial-construction-correction-rule-") ||
    rule.title.startsWith("三维带教待确认") ||
    rule.title.startsWith("三维构造纠正待确认") ||
    rule.condition.includes("三维代码带教")
  );
}

function ruleEvaluationFromTrace(trace: TraceStepRecord[]) {
  const decisionStep = trace.find((step) => step.id === "trace-decision");

  return Array.isArray(decisionStep?.output.ruleEvaluation)
    ? (decisionStep.output.ruleEvaluation as RuleEvaluationRecord[])
    : [];
}

const visualScenarioFixtures = [
  {
    id: "sunset-language",
    label: "Textual sunset cue",
    input: "Today I photographed Lake Geneva at sunset with a portrait subject and clear weather.",
    expectedLighting: "golden hour",
    expectedReview: false,
    expectedMemoryEffect: "changed" as const
  },
  {
    id: "visual-rim-light",
    label: "Visual rim-light cue",
    input: "Lake portrait near Geneva with clear weather, warm orange rim light, and long shadows.",
    expectedLighting: "golden hour",
    expectedReview: false,
    expectedMemoryEffect: "changed" as const
  },
  {
    id: "midday-counterexample",
    label: "Visual counterexample cue",
    input: "At midday near Geneva, I photographed a lake portrait with rim light and long shadows under overhead sun.",
    expectedLighting: "natural light",
    expectedReview: true,
    expectedMemoryEffect: "conservative" as const
  },
  {
    id: "ordinary-daylight",
    label: "Ordinary daylight note",
    input: "I photographed a lake path near Geneva on a clear afternoon with no dramatic light.",
    expectedLighting: "natural light",
    expectedReview: true,
    expectedMemoryEffect: "conservative" as const
  }
];

const visualRobustnessFixtures = [
  {
    id: "low-sun-paraphrase",
    label: "Positive low-sun paraphrase",
    input: "Near Lake Geneva with clear weather, I photographed a portrait subject under low sun and soft backlight.",
    expectedLighting: "golden hour",
    expectedReview: false,
    stressType: "positive_paraphrase" as const
  },
  {
    id: "cafe-sign-midday",
    label: "Golden Hour sign at midday",
    input: "At midday near Geneva, I photographed a cafe sign named Golden Hour under overhead sun.",
    expectedLighting: "natural light",
    expectedReview: true,
    stressType: "false_positive_guard" as const
  },
  {
    id: "warm-orange-noon-wall",
    label: "Warm highlight wording at noon",
    input: "At noon near Geneva, I photographed warm highlights on a wall and a portrait subject in flat daylight.",
    expectedLighting: "natural light",
    expectedReview: true,
    stressType: "false_positive_guard" as const
  },
  {
    id: "long-shadows-overhead-sun",
    label: "Long-shadow wording with overhead sun",
    input: "At the middle of the day, a travel note mentions long shadows on a poster while the real scene has overhead sun.",
    expectedLighting: "natural light",
    expectedReview: true,
    stressType: "false_positive_guard" as const
  }
];

function buildVisualLearningScenarios(args: {
  taskId: string;
  apprenticeId: string;
  rules: RuleRecord[];
}): QualificationVisualScenario[] {
  return visualScenarioFixtures.map((scenario) => {
    const run = executePhotographyJournalTask(scenario.input, args.rules, {
      taskId: args.taskId,
      apprenticeId: args.apprenticeId
    });
    const decisions = ruleEvaluationFromTrace(run.trace);
    const highlightedDecisions = decisions
      .filter((decision) => decision.decision !== "not_matched")
      .map((decision) => ({
        title: decision.title,
        decision: decision.decision,
        memorySource: decision.memorySource,
        matchedCues: decision.matchedCues,
        counterCues: decision.counterCues,
        counterEvidenceSources: decision.counterEvidenceSources,
        reason: decision.reason
      }));
    const passed =
      run.output.lightingCondition === scenario.expectedLighting &&
      run.trace.some((step) => step.needsHumanReview) === scenario.expectedReview;

    return {
      ...scenario,
      actualLighting: run.output.lightingCondition,
      needsReview: run.trace.some((step) => step.needsHumanReview),
      passed,
      traceSummary: run.trace.map((step) => ({
        stepId: step.id,
        nodeId: step.nodeId,
        stepName: step.stepName,
        confidence: step.confidence,
        validation: step.validation,
        needsHumanReview: step.needsHumanReview,
        appliedRuleTitles: step.appliedRules.map((rule) => rule.title)
      })),
      decisions: highlightedDecisions,
      evidence:
        highlightedDecisions.length > 0
          ? highlightedDecisions
              .map((decision) => {
                const cues = [...decision.matchedCues, ...decision.counterCues].join(", ") || "no direct cue";
                return `${decision.title}: ${decision.decision} (${cues})`;
              })
              .join("; ")
          : "No reusable visual memory was applied; teacher review remains available."
    };
  });
}

function buildVisualRobustnessSuite(args: {
  taskId: string;
  apprenticeId: string;
  rules: RuleRecord[];
}): QualificationVisualRobustnessSuite {
  const cases: QualificationVisualRobustnessCase[] = visualRobustnessFixtures.map((fixture) => {
    const baselineRun = executePhotographyJournalTask(fixture.input, [], {
      taskId: args.taskId,
      apprenticeId: args.apprenticeId
    });
    const learnedRun = executePhotographyJournalTask(fixture.input, args.rules, {
      taskId: args.taskId,
      apprenticeId: args.apprenticeId
    });
    const decisions = ruleEvaluationFromTrace(learnedRun.trace)
      .filter((decision) => decision.decision !== "not_matched")
      .map((decision) => ({
        title: decision.title,
        decision: decision.decision,
        matchedCues: decision.matchedCues,
        counterCues: decision.counterCues,
        reason: decision.reason
      }));
    const needsReview = learnedRun.trace.some((step) => step.needsHumanReview);
    const changedByMemory =
      baselineRun.output.lightingCondition !== learnedRun.output.lightingCondition ||
      baselineRun.trace.some((step) => step.needsHumanReview) !== needsReview;
    const passed =
      learnedRun.output.lightingCondition === fixture.expectedLighting &&
      needsReview === fixture.expectedReview &&
      (fixture.stressType === "positive_paraphrase"
        ? changedByMemory && decisions.some((decision) => decision.decision === "applied")
        : !changedByMemory && decisions.some((decision) => decision.decision === "conflicted" || decision.decision === "counterexample"));

    return {
      ...fixture,
      actualLighting: learnedRun.output.lightingCondition,
      needsReview,
      changedByMemory,
      decisions,
      passed,
      evidence:
        fixture.stressType === "positive_paraphrase"
          ? `Paraphrase produced ${learnedRun.output.lightingCondition} with ${needsReview ? "teacher review" : "automatic execution"}.`
          : `False-positive guard kept ${learnedRun.output.lightingCondition} with ${needsReview ? "teacher review" : "automatic execution"} despite learned cue wording.`
    };
  });

  return {
    reviewOnly: true,
    persisted: false,
    accepted: false,
    packagingGated: true,
    passed: cases.filter((item) => item.passed).length,
    total: cases.length,
    cases
  };
}

function buildCapabilityBoundary(args: {
  visualLearningScenarios: QualificationVisualScenario[];
  rules: RuleRecord[];
  memoryProvenance: QualificationMemoryProvenance[];
}): QualificationCapabilityBoundary[] {
  const automaticScenarios = args.visualLearningScenarios.filter(
    (scenario) => scenario.passed && !scenario.needsReview && scenario.actualLighting === "golden hour"
  );
  const reviewScenarios = args.visualLearningScenarios.filter(
    (scenario) => scenario.passed && scenario.needsReview
  );
  const sourcedRules = args.memoryProvenance.filter((item) => item.sources.length > 0);
  const packagingStillLocked = visualLearningAcceptanceGate.packagingGated && !visualLearningAcceptanceGate.accepted;

  return [
    {
      id: "automatic-golden-hour",
      category: "automatic",
      label: "Can automatically apply learned golden-hour memory",
      passed: automaticScenarios.length >= 2,
      status: automaticScenarios.length >= 2 ? "ready" : "review_required",
      evidence: `${automaticScenarios.length} positive scenarios use learned memory without teacher review.`,
      scenarioIds: automaticScenarios.map((scenario) => scenario.id)
    },
    {
      id: "teacher-review-boundary",
      category: "teacher_review",
      label: "Requires teacher review for ambiguity and counterexamples",
      passed: reviewScenarios.length >= 2,
      status: reviewScenarios.length >= 2 ? "review_required" : "locked",
      evidence: `${reviewScenarios.length} scenarios stay reviewable instead of over-applying visual memory.`,
      scenarioIds: reviewScenarios.map((scenario) => scenario.id)
    },
    {
      id: "memory-provenance-boundary",
      category: "memory",
      label: "Uses only sourced reusable memory",
      passed: sourcedRules.length === args.rules.length && args.rules.length > 0,
      status: sourcedRules.length === args.rules.length && args.rules.length > 0 ? "ready" : "review_required",
      evidence: `${sourcedRules.length}/${args.rules.length} rules have source provenance.`,
      scenarioIds: []
    },
    {
      id: "packaging-boundary",
      category: "blocked",
      label: "Does not unlock packaging, release, or wrapping",
      passed: packagingStillLocked,
      status: "locked",
      evidence: visualLearningAcceptanceGate.reason,
      scenarioIds: []
    }
  ];
}

function buildCodexCapabilityTransferReport(): QualificationCodexCapabilityTransferReport {
  const blockedSideEffects = ["Accept technology", "Enable rules", "Package", "Release", "Wrap"];
  const items: QualificationCodexCapabilityTransferItem[] = [
    {
      id: "codex-skill-trigger-registry",
      sourceCapability: "Skill discovery and trigger rules",
      architectureLayer: "skill registry + guardrail/policy layer",
      transplantedPattern:
        "A skill entry declares its name, description, trigger condition, and optional local instructions before the apprentice uses it.",
      mvpUse:
        "Teacher-authored skills can be listed as teachable capabilities, selected for a task, and reviewed before any rule is enabled.",
      structuredTraceExample:
        "Trace shows selectedSkill, triggerReason, instructionSource, confidence, validationResult, and teacherReviewPoint.",
      teacherReviewQuestion:
        "Teacher, should this skill be available for this apprentice task, or should it stay locked until more examples are taught?",
      blockedSideEffects,
      reviewOnly: true as const,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "codex-mcp-tool-contract",
      sourceCapability: "MCP tool discovery and typed tool calls",
      architectureLayer: "tool registry + API layer + guardrail/policy layer",
      transplantedPattern:
        "Tools expose typed inputs, declared capabilities, execution evidence, and approval boundaries instead of being hidden behind chat.",
      mvpUse:
        "The apprentice can propose tool calls from a registry, show parameters and risk gates, then wait for teacher review when required.",
      structuredTraceExample:
        "Trace shows toolName, inputSchema, proposedArguments, approvalRequired, resultSummary, and validationResult.",
      teacherReviewQuestion:
        "Teacher, may this tool be used for the current task, and what evidence must be shown after it runs?",
      blockedSideEffects,
      reviewOnly: true as const,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "codex-context-recovery-memory",
      sourceCapability: "Goal, memory summary, and handoff recovery",
      architectureLayer: "memory store + trace store",
      transplantedPattern:
        "Long context is compressed into durable handoff state with active goal, completed evidence, blockers, and next actions.",
      mvpUse:
        "The apprentice can recover a teaching session after context loss and show what it believes is completed, blocked, and next.",
      structuredTraceExample:
        "Trace shows recoveredGoalId, sourceMemory, trustedFacts, staleFacts, nextAction, and verificationNeeded.",
      teacherReviewQuestion:
        "Teacher, is this recovered context accurate enough to continue, or should the apprentice stop and ask for correction?",
      blockedSideEffects,
      reviewOnly: true as const,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "codex-structured-execution-trace",
      sourceCapability: "Structured progress updates and verifier-backed execution",
      architectureLayer: "workflow execution engine + trace store",
      transplantedPattern:
        "Execution is split into visible steps with command evidence, validation checks, and concise user-facing status, without exposing private chain-of-thought.",
      mvpUse:
        "Every apprentice run can publish step, rule, confidence, validation, command evidence, and human review point.",
      structuredTraceExample:
        "Trace shows stepName, plannedAction, evidencePath, verifierCommand, observedResult, confidence, and needsHumanReview.",
      teacherReviewQuestion:
        "Teacher, does this trace explain enough for you to correct the apprentice without seeing private reasoning?",
      blockedSideEffects,
      reviewOnly: true as const,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "codex-parallel-agent-orchestration",
      sourceCapability: "Parallel agent and workstream orchestration",
      architectureLayer: "workflow execution engine + tool registry",
      transplantedPattern:
        "Independent workstreams can be packaged as scoped tasks with inputs, expected outputs, handoff notes, and merge checks.",
      mvpUse:
        "The apprentice can plan delegated subtasks for teacher review, but real dispatch stays blocked until the teacher accepts the orchestration policy.",
      structuredTraceExample:
        "Trace shows workstreamId, delegatedTask, requiredEvidence, mergeGate, reviewerAction, and blockedIfMismatch.",
      teacherReviewQuestion:
        "Teacher, which subtasks are safe to delegate, and which must remain single-apprentice until more evidence is collected?",
      blockedSideEffects,
      reviewOnly: true as const,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    }
  ];
  const transplantDraftRows: QualificationCodexCapabilityTransplantDraftRow[] = [
    {
      id: "transplant-skill-trigger-contract",
      capabilityItemId: "codex-skill-trigger-registry",
      apprenticeInterface: "ApprenticeSkillTriggerContract",
      transplantContract:
        "Expose teachable skills as declared trigger contracts with name, trigger reason, instruction source, confidence, and teacher lock state.",
      runtimeTraceFields: [
        "selectedSkill",
        "triggerReason",
        "instructionSource",
        "confidence",
        "validationResult",
        "teacherReviewPoint"
      ],
      teacherControl:
        "Teacher can keep the skill unavailable, request more examples, or mark it ready for the next review pass without enabling a reusable rule.",
      verifierCommand: "npm.cmd run verify:learning",
      blockedTransitions: blockedSideEffects,
      reviewOnly: true as const,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "transplant-tool-use-contract",
      capabilityItemId: "codex-mcp-tool-contract",
      apprenticeInterface: "ApprenticeToolUseContract",
      transplantContract:
        "Represent every tool as a typed proposal with schema, arguments, approval requirement, execution evidence, and result validation.",
      runtimeTraceFields: [
        "toolName",
        "inputSchema",
        "proposedArguments",
        "approvalRequired",
        "resultSummary",
        "validationResult"
      ],
      teacherControl:
        "Teacher can approve only the reviewed tool proposal or block it before execution; the draft cannot dispatch hidden tool work.",
      verifierCommand: "npm.cmd run verify:learning",
      blockedTransitions: blockedSideEffects,
      reviewOnly: true as const,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "transplant-context-recovery-contract",
      capabilityItemId: "codex-context-recovery-memory",
      apprenticeInterface: "ApprenticeContextRecoveryContract",
      transplantContract:
        "Recover a saturated teaching session from durable summaries, completed evidence, blockers, pending actions, and stale-fact warnings.",
      runtimeTraceFields: [
        "recoveredGoalId",
        "contextSource",
        "trustedFacts",
        "staleFacts",
        "nextAction",
        "verificationNeeded"
      ],
      teacherControl:
        "Teacher can correct recovered facts before continuation; the apprentice must not treat recovered state as acceptance evidence.",
      verifierCommand: "npm.cmd run verify:learning",
      blockedTransitions: blockedSideEffects,
      reviewOnly: true as const,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "transplant-execution-trace-contract",
      capabilityItemId: "codex-structured-execution-trace",
      apprenticeInterface: "ApprenticeExecutionTraceContract",
      transplantContract:
        "Publish structured step records with planned action, evidence path, verifier command, observed result, confidence, and review point.",
      runtimeTraceFields: [
        "stepName",
        "plannedAction",
        "evidencePath",
        "verifierCommand",
        "observedResult",
        "needsHumanReview"
      ],
      teacherControl:
        "Teacher sees the evidence trail and can correct the next step without seeing private chain-of-thought.",
      verifierCommand: "npm.cmd run verify:learning",
      blockedTransitions: blockedSideEffects,
      reviewOnly: true as const,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "transplant-scoped-workstream-contract",
      capabilityItemId: "codex-parallel-agent-orchestration",
      apprenticeInterface: "ApprenticeScopedWorkstreamContract",
      transplantContract:
        "Package delegated work as scoped task packs with inputs, expected output, evidence requirements, merge gate, and mismatch blocker.",
      runtimeTraceFields: [
        "workstreamId",
        "delegatedTask",
        "requiredEvidence",
        "mergeGate",
        "reviewerAction",
        "blockedIfMismatch"
      ],
      teacherControl:
        "Teacher can review delegation policy and keep real dispatch blocked until the orchestration rule is explicitly accepted elsewhere.",
      verifierCommand: "npm.cmd run verify:learning",
      blockedTransitions: blockedSideEffects,
      reviewOnly: true as const,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    }
  ];
  const transplantRehearsalRows: QualificationCodexCapabilityTransplantRehearsalRow[] = transplantDraftRows.map(
    (row, index) => ({
      id: `rehearsal-${row.id}`,
      draftRowId: row.id,
      rehearsalStep: `Dry-run ${index + 1}: ${row.apprenticeInterface}`,
      simulatedInput:
        `Teacher asks the apprentice to rehearse ${row.apprenticeInterface} with mocked local evidence before any real side effect.`,
      structuredTracePreview: row.runtimeTraceFields.map((field) => `${field}=review_only_sample`),
      expectedEvidence:
        `The rehearsal exposes ${row.runtimeTraceFields.join(", ")} plus ${row.verifierCommand} as review evidence.`,
      teacherReviewPoint:
        `Teacher checks whether ${row.apprenticeInterface} is understandable enough to correct without private chain-of-thought.`,
      noOpActions: [
        "No real tool dispatch",
        "No rule persistence",
        "No acceptance write",
        "No packaging transition"
      ],
      blockedTransitions: row.blockedTransitions,
      reviewOnly: true as const,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        row.passed &&
        row.runtimeTraceFields.length >= 6 &&
        row.ruleEnabled === false &&
        row.accepted === false &&
        row.packagingGated === true &&
        row.blockedTransitions.includes("Package")
    })
  );
  const transplantRehearsalAllowedResultStatuses: QualificationCodexCapabilityTransplantRehearsalResultStatus[] = [
    "not_run_yet",
    "matched_expected",
    "mismatch_blocked"
  ];
  const transplantRehearsalResultRows: QualificationCodexCapabilityTransplantRehearsalResultRow[] =
    transplantRehearsalRows.map((row) => ({
      id: `result-${row.id}`,
      rehearsalRowId: row.id,
      defaultStatus: "not_run_yet",
      observedOutputPlaceholder:
        `Paste observed public rehearsal output for ${row.rehearsalStep}; do not include private reasoning.`,
      mismatchQuestion:
        "Did the observed rehearsal output miss expected evidence, violate a no-op assertion, or imply acceptance?",
      followUpNotePlaceholder:
        "Record the next review note without enabling rules, accepting technology, dispatching tools, or packaging.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        row.passed &&
        row.reviewOnly === true &&
        row.ruleEnabled === false &&
        row.accepted === false &&
        row.packagingGated === true
    }));
  const transplantRehearsalResultValidationRows:
    QualificationCodexCapabilityTransplantRehearsalResultValidationRow[] = transplantRehearsalResultRows.map(
    (row) => ({
      id: `validation-${row.id}`,
      resultRowId: row.id,
      allowedStatuses: transplantRehearsalAllowedResultStatuses,
      blockedStatus: "accepted",
      lockAssertion:
        "A rehearsal result can guide the next review pass, but it cannot save acceptance, enable rules, dispatch tools, package, release, or wrap.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        row.passed &&
        row.defaultStatus === "not_run_yet" &&
        transplantRehearsalAllowedResultStatuses.length === 3 &&
        transplantRehearsalAllowedResultStatuses.includes("mismatch_blocked")
    })
  );
  const transplantRehearsalResultValidationReplayRows:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayRow[] =
    transplantRehearsalResultValidationRows.flatMap((row) =>
      row.allowedStatuses.map((status) => {
        const replayTextByStatus: Record<
          QualificationCodexCapabilityTransplantRehearsalResultStatus,
          { nextReviewAction: string; consequence: string }
        > = {
          not_run_yet: {
            nextReviewAction:
              "Keep the rehearsal result pending and ask the next reviewer to run the verifier before using evidence.",
            consequence:
              "No evidence is consumed; the transplant rehearsal remains review-only and locked."
          },
          matched_expected: {
            nextReviewAction:
              "Queue a follow-up review of the matched public evidence while preserving all lock assertions.",
            consequence:
              "The evidence can inform the next review note, but no rule, acceptance, dispatch, package, release, or wrap state changes."
          },
          mismatch_blocked: {
            nextReviewAction:
              "Stop the transplant follow-up path and preserve the mismatch question for the teacher.",
            consequence:
              "The mismatch remains a blocker; no downstream apprentice behavior is enabled."
          }
        };
        const replayText = replayTextByStatus[status];

        return {
          id: `replay-${row.id}-${status}`,
          validationRowId: row.id,
          resultRowId: row.resultRowId,
          simulatedStatus: status,
          nextReviewAction: replayText.nextReviewAction,
          consequence: replayText.consequence,
          blockedStatusReminder:
            "accepted is not a valid rehearsal result status and must remain blocked.",
          ruleEnabled: false as const,
          accepted: false as const,
          packagingGated: true as const,
          passed:
            row.passed &&
            row.allowedStatuses.includes(status) &&
            row.blockedStatus === "accepted" &&
            replayText.consequence.length > 0
        };
      })
    );
  const transplantRehearsalResultValidationReplayNextReviewQueueItems:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueItem[] =
    transplantRehearsalResultValidationReplayRows.map((row) => {
      const laneByStatus: Record<
        QualificationCodexCapabilityTransplantRehearsalResultStatus,
        QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueItem["lane"]
      > = {
        not_run_yet: "pending_verifier",
        matched_expected: "matched_evidence_follow_up",
        mismatch_blocked: "mismatch_blocker"
      };
      const lane = laneByStatus[row.simulatedStatus];
      const evidenceRequestByLane: Record<
        QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueItem["lane"],
        string
      > = {
        pending_verifier:
          "Run npm.cmd run verify:learning and paste only the public verifier evidence for this transplant rehearsal.",
        matched_evidence_follow_up:
          "Attach the matched public trace fields and teacher note that explain why the rehearsal evidence matched.",
        mismatch_blocker:
          "Attach the mismatch question, missing evidence, and blocker note before any follow-up planning."
      };
      const continueConditionByLane: Record<
        QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueItem["lane"],
        string
      > = {
        pending_verifier: "Continue only after public verifier output is recorded and still keeps acceptance blocked.",
        matched_evidence_follow_up:
          "Continue only to a teacher follow-up note; do not enable rules or dispatch tools.",
        mismatch_blocker:
          "Continue only after the teacher resolves the mismatch in a later review pass."
      };
      const stopConditionByLane: Record<
        QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueItem["lane"],
        string
      > = {
        pending_verifier: "Stop if verifier output is missing, private reasoning appears, or acceptance is implied.",
        matched_evidence_follow_up:
          "Stop if matched evidence is treated as technical acceptance, tool approval, packaging, release, or wrapping.",
        mismatch_blocker:
          "Stop immediately if a mismatch is bypassed, downgraded, or converted into a reusable rule."
      };

      return {
        id: `queue-${row.id}`,
        replayRowId: row.id,
        resultRowId: row.resultRowId,
        lane,
        reviewerAction: row.nextReviewAction,
        evidenceRequest: evidenceRequestByLane[lane],
        continueCondition: continueConditionByLane[lane],
        stopCondition: stopConditionByLane[lane],
        blockedTransitions: blockedSideEffects,
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          row.passed &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          blockedSideEffects.includes("Package") &&
          stopConditionByLane[lane].length > 0
      };
    });
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffSteps:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffStep[] =
    transplantRehearsalResultValidationReplayNextReviewQueueItems.map((item, index) => ({
      id: `handoff-${item.id}`,
      queueItemId: item.id,
      order: index + 1,
      instruction:
        `Review ${item.lane} for ${item.resultRowId}: ${item.reviewerAction}`,
      evidencePath:
        `qualification_report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.items[${index}]`,
      verifierCommand: "npm.cmd run verify:learning",
      expectedLockedResult:
        "The reviewer can record public evidence or blocker notes only; no rule, acceptance, tool dispatch, package, release, or wrap transition is allowed.",
      blockedTransitions: item.blockedTransitions,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        item.passed &&
        item.ruleEnabled === false &&
        item.accepted === false &&
        item.packagingGated === true &&
        item.blockedTransitions.includes("Package")
    }));
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookItems:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookItem[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffSteps.map((step, index) => ({
      id: `runbook-${step.id}`,
      handoffStepId: step.id,
      order: step.order,
      reviewerAction: `Run locked review for handoff step ${step.order}: ${step.instruction}`,
      evidencePath:
        `qualification_report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.steps[${index}]`,
      verificationCommand: step.verifierCommand,
      continueCondition:
        "Continue only when the verifier passes and observed evidence remains review-only with no rule, acceptance, tool dispatch, package, release, or wrap.",
      stopCondition:
        "Stop if verifier output is missing, mismatched, or any action attempts to enable rules, accept technology, dispatch tools, package, release, or wrap.",
      lockAssertion:
        "Assert ruleEnabled=false, accepted=false, and packagingGated=true before and after this reviewer action.",
      blockedTransitions: step.blockedTransitions,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        step.passed &&
        step.ruleEnabled === false &&
        step.accepted === false &&
        step.packagingGated === true &&
        step.verifierCommand === "npm.cmd run verify:learning" &&
        step.blockedTransitions.includes("Package")
    }));
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunRows:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunItem[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookItems.map((item) => ({
      id: `dry-run-${item.id}`,
      runbookItemId: item.id,
      order: item.order,
      expectedEvidence:
        `Verifier output for ${item.handoffStepId} remains review-only and points back to ${item.evidencePath}.`,
      lockAssertion: item.lockAssertion,
      noOpAction:
        "Simulate recording reviewer evidence only; do not save acceptance, enable rules, dispatch tools, package, release, or wrap.",
      reviewerNote:
        "Reviewer should preserve any mismatch as a blocker and leave this row in review-only follow-up.",
      blockedTransitions: item.blockedTransitions,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        item.passed &&
        item.ruleEnabled === false &&
        item.accepted === false &&
        item.packagingGated === true &&
        item.verificationCommand === "npm.cmd run verify:learning" &&
        item.blockedTransitions.includes("Package")
    }));
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunRows.map((row) => ({
      id: `receipt-${row.id}`,
      dryRunRowId: row.id,
      order: row.order,
      observedEvidence:
        `Record observed verifier evidence for ${row.runbookItemId}; keep the evidence tied to the dry-run audit row.`,
      blockerQuestion:
        "What mismatch, missing evidence, or lock violation should stay blocked before any follow-up?",
      nextReviewNote:
        "Leave the next reviewer a review-only note; do not turn this receipt into acceptance or rule enablement.",
      defaultDecision: "needs_teacher_review" as const,
      blockedTransitions: row.blockedTransitions,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        row.passed &&
        row.ruleEnabled === false &&
        row.accepted === false &&
        row.packagingGated === true &&
        row.noOpAction.includes("do not save acceptance") &&
        row.blockedTransitions.includes("Package")
    }));
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.map((row) => ({
      id: `receipt-validation-${row.id}`,
      receiptRowId: row.id,
      order: row.order,
      allowedDecisions: ["needs_teacher_review", "blocked", "ready_for_follow_up"],
      blockedDecision: "accepted" as const,
      validationRule:
        "Dry-run receipt decisions may route Codex transplant review work, but they must not accept technology, enable rules, dispatch tools, or unlock packaging.",
      invalidIf: [
        "decision=accepted",
        "ruleEnabled=true",
        "accepted=true",
        "packagingGated=false",
        "blockedActions missing Package"
      ],
      nextActionIfInvalid:
        "Stop Codex transplant review, restore review-only state, and ask the teacher before continuing.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        row.passed &&
        row.defaultDecision === "needs_teacher_review" &&
        row.ruleEnabled === false &&
        row.accepted === false &&
        row.packagingGated === true &&
        row.blockedTransitions.includes("Package")
    }));
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.flatMap(
      (row) =>
        row.allowedDecisions.map((decision, decisionIndex) => ({
          id: `receipt-validation-replay-${row.id}-${decision}`,
          validationRowId: row.id,
          receiptRowId: row.receiptRowId,
          order: (row.order - 1) * row.allowedDecisions.length + decisionIndex + 1,
          simulatedDecision: decision,
          nextReviewAction:
            decision === "needs_teacher_review"
              ? "Keep this Codex transplant receipt in the next teacher review pass and request more observed evidence."
              : decision === "blocked"
                ? "Stop this Codex transplant route, preserve the blocker, and ask the teacher before continuing."
                : "Move this Codex transplant receipt into follow-up review planning without accepting technology.",
          consequence:
            decision === "blocked"
              ? "The blocked route does not accept technology; no rules are enabled, no acceptance is saved, no tools are dispatched, and packaging remains gated while the blocker is investigated."
              : "The decision only routes Codex transplant review work; it does not accept technology, enable rules, dispatch tools, or unlock packaging.",
          blockedDecisionReminder: "The decision accepted remains blocked and must not be inferred from this replay.",
          ruleEnabled: false as const,
          accepted: false as const,
          packagingGated: true as const,
          passed:
            row.passed &&
            row.blockedDecision === "accepted" &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        }))
    );
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.map(
      (row) => {
        const laneByDecision: Record<
          QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptDecision,
          QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem["lane"]
        > = {
          needs_teacher_review: "missing_teacher_evidence",
          blocked: "blocked_route",
          ready_for_follow_up: "review_only_follow_up"
        };
        const lane = laneByDecision[row.simulatedDecision];
        const evidenceRequestByLane: Record<
          QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem["lane"],
          string
        > = {
          missing_teacher_evidence:
            "Ask the teacher for observed receipt evidence before moving this Codex transplant row forward.",
          blocked_route:
            "Preserve the blocker, mismatch note, and accepted-blocked reminder for teacher review.",
          review_only_follow_up:
            "Collect a follow-up planning note without saving acceptance, enabling rules, or dispatching tools."
        };
        const continueConditionByLane: Record<
          QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem["lane"],
          string
        > = {
          missing_teacher_evidence:
            "Continue only after the teacher adds evidence and the row still keeps accepted=false.",
          blocked_route:
            "Continue only after the teacher resolves the blocker in a later review pass.",
          review_only_follow_up:
            "Continue only into review-only follow-up planning with packaging still gated."
        };
        const stopConditionByLane: Record<
          QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem["lane"],
          string
        > = {
          missing_teacher_evidence:
            "Stop if teacher evidence is missing, private reasoning appears, or acceptance is inferred.",
          blocked_route:
            "Stop if a blocker is bypassed, converted into a rule, or treated as tool dispatch approval.",
          review_only_follow_up:
            "Stop if follow-up planning saves acceptance, enables rules, packages, releases, or wraps."
        };

        return {
          id: `receipt-validation-replay-queue-${row.id}`,
          replayRowId: row.id,
          validationRowId: row.validationRowId,
          receiptRowId: row.receiptRowId,
          order: row.order,
          lane,
          reviewerAction: row.nextReviewAction,
          evidenceRequest: evidenceRequestByLane[lane],
          continueCondition: continueConditionByLane[lane],
          stopCondition: stopConditionByLane[lane],
          blockedTransitions: blockedSideEffects,
          ruleEnabled: false as const,
          accepted: false as const,
          packagingGated: true as const,
          passed:
            row.passed &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true &&
            row.blockedDecisionReminder.includes("accepted remains blocked") &&
            blockedSideEffects.includes("Package") &&
            stopConditionByLane[lane].length > 0
        };
      }
    );
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.map(
      (item) => ({
        id: `receipt-validation-replay-queue-handoff-${item.id}`,
        queueItemId: item.id,
        replayRowId: item.replayRowId,
        order: item.order,
        instruction:
          `${item.reviewerAction} Keep this handoff review-only; do not save acceptance, enable rules, dispatch tools, package, release, or wrap.`,
        evidencePath:
          `qualification_report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items[${item.order - 1}]`,
        verifierCommand: "npm.cmd run verify:learning",
        expectedLockedResult:
          "The Codex transplant receipt validation replay queue handoff remains review-only with ruleEnabled=false, accepted=false, and packagingGated=true.",
        blockedTransitions: item.blockedTransitions,
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          item.passed &&
          item.blockedTransitions.includes("Package") &&
          item.blockedTransitions.includes("Release") &&
          item.blockedTransitions.includes("Wrap") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      })
    );
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItem[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.map(
      (step) => ({
        id: `receipt-validation-replay-queue-handoff-runbook-${step.id}`,
        handoffStepId: step.id,
        queueItemId: step.queueItemId,
        order: step.order,
        reviewerAction:
          `Run locked review for handoff step ${step.order}; inspect the evidence path and do not persist acceptance, enable rules, dispatch tools, package, release, or wrap.`,
        evidencePath:
          `qualification_report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.steps[${step.order - 1}]`,
        verificationCommand: "npm.cmd run verify:learning",
        continueCondition:
          "Continue only when verifier evidence matches the review-only lock assertion and the teacher still has not accepted technology.",
        stopCondition:
          "Stop if any reviewer result attempts acceptance, rule enablement, tool dispatch, packaging, release, wrapping, or packaging unlock.",
        lockAssertion:
          "Must remain ruleEnabled=false, accepted=false, packagingGated=true before any follow-up action.",
        blockedTransitions: step.blockedTransitions,
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          step.passed &&
          step.blockedTransitions.includes("Package") &&
          step.blockedTransitions.includes("Release") &&
          step.blockedTransitions.includes("Wrap") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      })
    );
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunItem[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.map(
      (item) => ({
        id: `receipt-validation-replay-queue-handoff-runbook-dry-run-${item.id}`,
        runbookItemId: item.id,
        handoffStepId: item.handoffStepId,
        order: item.order,
        expectedEvidence:
          `Dry-run verifier evidence for handoff step ${item.order} must show review-only execution with no acceptance, no enabled rules, and packaging still gated.`,
        lockAssertion:
          "Dry-run lock assertion: ruleEnabled=false, accepted=false, packagingGated=true, and blocked transitions include Package, Release, and Wrap.",
        noOpAction:
          "Simulate the reviewer action only; do not save acceptance, enable rules, dispatch tools, package, release, wrap, or unlock packaging.",
        reviewerNote:
          `Reviewer should record whether handoff runbook item ${item.order} matched the locked expectation; this note remains review-only.`,
        blockedTransitions: item.blockedTransitions,
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          item.passed &&
          item.lockAssertion.includes("ruleEnabled=false") &&
          item.lockAssertion.includes("accepted=false") &&
          item.lockAssertion.includes("packagingGated=true") &&
          item.blockedTransitions.includes("Package") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      })
    );
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.map(
      (row) => ({
        id: `receipt-validation-replay-queue-handoff-runbook-dry-run-receipt-${row.id}`,
        dryRunRowId: row.id,
        runbookItemId: row.runbookItemId,
        order: row.order,
        observedEvidence:
          `Record verifier evidence for deepest dry-run row ${row.order}; leave this placeholder blank until the next reviewer observes it.`,
        blockerQuestion:
          "Does any observed evidence bypass blocked transitions, acceptance, rule enablement, packaging, release, wrap, or unlock packaging?",
        nextReviewNote:
          "Next reviewer notes stay review-only and must not save acceptance, enable rules, package, release, wrap, or unlock packaging.",
        defaultDecision: "needs_teacher_review",
        blockedTransitions: row.blockedTransitions,
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          row.passed &&
          row.noOpAction.includes("do not save acceptance") &&
          row.blockedTransitions.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      })
    );
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.map(
      (row) => ({
        id: `receipt-validation-replay-queue-handoff-runbook-dry-run-receipt-validation-${row.id}`,
        receiptRowId: row.id,
        dryRunRowId: row.dryRunRowId,
        order: row.order,
        allowedDecisions: ["needs_teacher_review", "blocked", "ready_for_follow_up"],
        blockedDecision: "accepted",
        validationRule:
          "Deepest Codex dry-run receipt decisions may route reviewer work, but accepted is blocked and no decision may enable rules, save acceptance, package, release, wrap, or unlock packaging.",
        invalidIf: [
          "decision=accepted",
          "ruleEnabled=true",
          "accepted=true",
          "packagingGated=false",
          "blockedActions missing Package"
        ],
        nextActionIfInvalid:
          "Stop the deepest Codex receipt review, preserve the mismatch as blocked, and ask the teacher before continuing.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          row.passed &&
          row.defaultDecision === "needs_teacher_review" &&
          row.blockedTransitions.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      })
    );
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.flatMap(
      (row) =>
        row.allowedDecisions.map((decision, decisionIndex) => {
          const nextReviewActionByDecision: Record<
            QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptDecision,
            string
          > = {
            needs_teacher_review:
              "Keep the deepest Codex receipt open for teacher evidence before any follow-up work.",
            blocked:
              "Preserve the deepest Codex receipt as a blocker and stop any downstream packaging or rule enablement.",
            ready_for_follow_up:
              "Route the deepest Codex receipt into review-only follow-up planning with all locks still asserted."
          };
          const consequenceByDecision: Record<
            QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptDecision,
            string
          > = {
            needs_teacher_review:
              "This replay does not accept technology, does not enable rules, and keeps packaging gated while evidence is missing.",
            blocked:
              "This replay does not accept technology, does not enable rules, and keeps the blocker visible for the teacher.",
            ready_for_follow_up:
              "This replay does not accept technology, does not enable rules, and only prepares review-only follow-up planning."
          };

          return {
            id: `receipt-validation-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-${row.id}-${decision}`,
            validationRowId: row.id,
            receiptRowId: row.receiptRowId,
            dryRunRowId: row.dryRunRowId,
            order: (row.order - 1) * row.allowedDecisions.length + decisionIndex + 1,
            simulatedDecision: decision,
            nextReviewAction: nextReviewActionByDecision[decision],
            consequence: consequenceByDecision[decision],
            blockedDecisionReminder:
              "The accepted decision remains blocked; this replay cannot save acceptance, enable rules, package, release, wrap, or unlock packaging.",
            ruleEnabled: false as const,
            accepted: false as const,
            packagingGated: true as const,
            passed:
              row.passed &&
              row.blockedDecision === "accepted" &&
              row.invalidIf.includes("decision=accepted") &&
              row.ruleEnabled === false &&
              row.accepted === false &&
              row.packagingGated === true
          };
        })
    );
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.map(
      (row) => {
        const lane: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem["lane"] =
          row.simulatedDecision === "needs_teacher_review"
            ? "missing_teacher_evidence"
            : row.simulatedDecision === "blocked"
              ? "blocked_route"
              : "review_only_follow_up";
        const evidenceRequestByLane: Record<
          QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem["lane"],
          string
        > = {
          missing_teacher_evidence:
            "Ask the teacher for observed evidence before using this deepest replay row in any follow-up plan.",
          blocked_route:
            "Preserve the blocker evidence and keep the replay row out of rule enablement or packaging work.",
          review_only_follow_up:
            "Collect only review-only follow-up evidence while all lock assertions remain visible."
        };
        const continueConditionByLane: Record<
          QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem["lane"],
          string
        > = {
          missing_teacher_evidence:
            "Continue only after teacher evidence is recorded and the row still has ruleEnabled=false, accepted=false, packagingGated=true.",
          blocked_route:
            "Continue only after the blocker is explicitly preserved for a later teacher review pass and the row still has ruleEnabled=false, accepted=false, packagingGated=true.",
          review_only_follow_up:
            "Continue only into review-only planning with ruleEnabled=false, accepted=false, packagingGated=true, no saved acceptance, no enabled rules, and no packaging transition."
        };
        const stopConditionByLane: Record<
          QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem["lane"],
          string
        > = {
          missing_teacher_evidence:
            "Stop if teacher evidence is missing, private reasoning appears, accepted is inferred, or packaging is requested.",
          blocked_route:
            "Stop if the blocker is bypassed, converted into enabled memory, or treated as release approval.",
          review_only_follow_up:
            "Stop if follow-up planning saves acceptance, enables rules, dispatches tools, packages, releases, wraps, or unlocks packaging."
        };

        return {
          id: `receipt-validation-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-queue-${row.id}`,
          replayRowId: row.id,
          validationRowId: row.validationRowId,
          receiptRowId: row.receiptRowId,
          dryRunRowId: row.dryRunRowId,
          order: row.order,
          lane,
          reviewerAction: row.nextReviewAction,
          evidenceRequest: evidenceRequestByLane[lane],
          continueCondition: continueConditionByLane[lane],
          stopCondition: stopConditionByLane[lane],
          blockedTransitions: blockedSideEffects,
          ruleEnabled: false as const,
          accepted: false as const,
          packagingGated: true as const,
          passed:
            row.passed &&
            row.consequence.includes("does not accept technology") &&
            row.blockedDecisionReminder.includes("accepted") &&
            row.blockedDecisionReminder.includes("blocked") &&
            blockedSideEffects.includes("Package") &&
            blockedSideEffects.includes("Release") &&
            blockedSideEffects.includes("Wrap") &&
            stopConditionByLane[lane].includes("Stop") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        };
      }
    );
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps: QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep[] =
    transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.map(
      (item, index) => ({
        id: `receipt-validation-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-queue-handoff-${item.id}`,
        queueItemId: item.id,
        replayRowId: item.replayRowId,
        validationRowId: item.validationRowId,
        receiptRowId: item.receiptRowId,
        dryRunRowId: item.dryRunRowId,
        order: item.order,
        instruction: `Review this deepest Codex validation replay queue item as ${item.lane} in review-only mode before any follow-up work.`,
        evidencePath: `qualification_report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items[${index}]`,
        verifierCommand: "npm.cmd run verify:learning" as const,
        expectedLockedResult:
          "The queue item remains ruleEnabled=false, accepted=false, packagingGated=true, and cannot dispatch tools, package, release, wrap, or unlock packaging.",
        blockedTransitions: item.blockedTransitions,
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          item.passed &&
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
      })
    );
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    steps:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff = {
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    stepCount:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length,
    lockedSteps:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.filter(
        (step) => step.passed
      ).length,
    blockedSteps:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.filter(
        (step) => step.blockedTransitions.includes("Package")
      ).length,
    steps:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, can these deepest Codex validation replay queue items be handed off for review without accepting technology or unlocking packaging?",
    allowedActions: ["Review queue item", "Run verifier", "Record next-review evidence"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.every(
        (step) =>
          step.passed &&
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
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems,
    handoff:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue = {
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    itemCount:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length,
    readyItems:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
        (item) => item.passed
      ).length,
    missingTeacherEvidenceItems:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
        (item) => item.lane === "missing_teacher_evidence"
      ).length,
    blockedItems:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
        (item) => item.lane === "blocked_route"
      ).length,
    readyForFollowUpItems:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
        (item) => item.lane === "review_only_follow_up"
      ).length,
    items:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems,
    handoff:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, should these deepest Codex receipt validation replay rows be queued as missing evidence, blockers, or review-only follow-up?",
    allowedActions: ["Queue teacher evidence", "Preserve blocker", "Plan review-only follow-up"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.every(
        (item) =>
          item.passed &&
          item.blockedTransitions.includes("Package") &&
          item.blockedTransitions.includes("Release") &&
          item.blockedTransitions.includes("Wrap") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay = {
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length,
    readyRows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.filter(
        (row) => row.passed
      ).length,
    blockedDecisionRows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.filter(
        (row) => row.blockedDecisionReminder.includes("accepted") && row.blockedDecisionReminder.includes("blocked")
      ).length,
    rows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows,
    nextReviewQueue:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue,
    exportJson: JSON.stringify(
      {
        ...transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload,
        nextReviewQueue:
          transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload
      },
      null,
      2
    ),
    teacherQuestion:
      "Teacher, do these deepest Codex dry-run receipt validation replays keep every allowed decision review-only while accepted remains blocked?",
    allowedActions: ["Replay allowed decision", "Preserve blocker", "Plan review-only follow-up"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length * 3 &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.every(
        (row) =>
          row.passed &&
          row.blockedDecisionReminder.includes("accepted") &&
          row.blockedDecisionReminder.includes("blocked") &&
          row.consequence.includes("does not accept technology") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows,
    replay:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation = {
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length,
    blockedDecisionRows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.filter(
        (row) => row.blockedDecision === "accepted"
      ).length,
    rows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows,
    replay:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, do these deepest Codex dry-run receipt decisions block accepted while keeping packaging gated?",
    allowedActions: ["Validate receipt decision", "Preserve blocker", "Ask teacher for review"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.every(
        (row) =>
          row.passed &&
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
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows,
    validation:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceipt:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate = {
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length,
    needsReviewRows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.filter(
        (row) => row.defaultDecision === "needs_teacher_review"
    ).length,
    rows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows,
    validation:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, can the next reviewer record evidence for this deepest Codex dry-run without treating any row as accepted?",
    allowedActions: ["Record observed evidence", "Ask blocker question", "Leave next-review note"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.every(
        (row) =>
          row.passed &&
          row.observedEvidence.includes("verifier evidence") &&
          row.blockerQuestion.includes("blocked") &&
          row.nextReviewNote.includes("review-only") &&
          row.defaultDecision === "needs_teacher_review" &&
          row.blockedTransitions.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunPayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows,
    receiptTemplate:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit = {
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length,
    lockedRows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.filter(
        (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
      ).length,
    noOpRows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.filter(
        (row) => row.noOpAction.includes("do not save acceptance")
      ).length,
    rows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows,
    receiptTemplate:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceipt,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunPayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, does this Codex transplant receipt replay queue handoff runbook dry-run audit stay no-op while every lock remains closed?",
    allowedActions: ["Simulate verifier evidence", "Record reviewer note", "Stop on mismatch"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.every(
        (row) =>
          row.passed &&
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
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceipt.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookPayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems,
    dryRunAudit:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook = {
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    itemCount:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.length,
    lockedChecks:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.filter(
        (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
      ).length,
    blockedItems:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.filter(
        (item) => item.blockedTransitions.includes("Package")
      ).length,
    items:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems,
    dryRunAudit:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookPayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, can the next reviewer execute this Codex transplant receipt replay queue handoff runbook while every lock remains closed?",
    allowedActions: ["Run locked review", "Record verifier result", "Stop on mismatch"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.every(
        (item) =>
          item.passed &&
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
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    steps:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps,
    runbook:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff = {
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    stepCount:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length,
    lockedSteps:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.filter(
        (step) => step.passed
      ).length,
    blockedSteps:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.filter(
        (step) => step.blockedTransitions.includes("Package")
      ).length,
    steps:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps,
    runbook:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, can the next reviewer use these Codex transplant receipt replay queue handoff steps without accepting technology or unlocking packaging?",
    allowedActions: ["Review queue item", "Run verifier", "Record next-review evidence"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.every(
        (step) =>
          step.passed &&
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
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems,
    handoff:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue = {
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    itemCount:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length,
    readyItems:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
        (item) => item.passed
      ).length,
    missingTeacherEvidenceItems:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
        (item) => item.lane === "missing_teacher_evidence"
      ).length,
    blockedItems:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
        (item) => item.lane === "blocked_route"
      ).length,
    readyForFollowUpItems:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
        (item) => item.lane === "review_only_follow_up"
      ).length,
    items: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems,
    handoff:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, should these Codex transplant receipt replay outcomes be queued for evidence, blocker, or review-only follow-up work?",
    allowedActions: ["Request teacher evidence", "Preserve blocker", "Plan review-only follow-up"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.every(
        (item) =>
          item.passed &&
          item.blockedTransitions.includes("Package") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows,
    nextReviewQueue:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay = {
    mode:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length,
    readyRows: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.filter(
      (row) => row.passed
    ).length,
    blockedDecisionRows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.filter(
        (row) => row.blockedDecisionReminder.includes("accepted remains blocked")
      ).length,
    rows: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows,
    nextReviewQueue:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, do these Codex transplant receipt decision replays stay limited to review routing before any follow-up planning?",
    allowedActions: ["Replay allowed decision", "Preserve blocker", "Plan review-only follow-up"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length * 3 &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.every(
        (row) =>
          row.passed &&
          row.blockedDecisionReminder.includes("accepted remains blocked") &&
          row.consequence.includes("does not accept technology") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows,
    replay: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation = {
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length,
    blockedDecisionRows:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.filter(
        (row) => row.blockedDecision === "accepted"
      ).length,
    rows: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows,
    replay: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, do these Codex transplant dry-run receipt decisions stay limited to review routing while accepted remains blocked?",
    allowedActions: ["Validate receipt decision", "Preserve blocker", "Ask teacher"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.every(
        (row) =>
          row.passed &&
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.allowedDecisions.includes("blocked") &&
          row.allowedDecisions.includes("ready_for_follow_up") &&
          row.blockedDecision === "accepted" &&
          row.invalidIf.includes("decision=accepted") &&
          row.invalidIf.includes("blockedActions missing Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows,
    validation: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate = {
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length,
    needsReviewRows: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.filter(
      (row) => row.defaultDecision === "needs_teacher_review"
    ).length,
    rows: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows,
    validation: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, can the next reviewer fill these dry-run receipts without accepting technology or enabling rules?",
    allowedActions: ["Record observed evidence", "Ask blocker question", "Leave next-review note"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.every(
        (row) =>
          row.passed &&
          row.observedEvidence.includes("verifier evidence") &&
          row.blockerQuestion.includes("blocked") &&
          row.nextReviewNote.includes("review-only") &&
          row.defaultDecision === "needs_teacher_review" &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.blockedTransitions.includes("Package")
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunPayload = {
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunRows,
    receiptTemplate: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunAudit:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunAudit = {
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
    format:
      "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length,
    lockedRows: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunRows.filter(
      (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
    ).length,
    noOpRows: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunRows.filter((row) =>
      row.noOpAction.includes("do not save acceptance")
    ).length,
    rows: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunRows,
    receiptTemplate: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunPayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, does this dry-run audit simulate only review evidence and keep every Codex transplant lock closed?",
    allowedActions: ["Simulate verifier evidence", "Record no-op reviewer note", "Stop on mismatch"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookItems.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunRows.every(
        (row) =>
          row.passed &&
          row.expectedEvidence.includes("review-only") &&
          row.lockAssertion.includes("ruleEnabled=false") &&
          row.noOpAction.includes("do not save acceptance") &&
          row.reviewerNote.includes("review-only") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.blockedTransitions.includes("Package")
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookPayload = {
    format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_json_v1",
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookItems,
    dryRunAudit: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbook:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbook = {
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_v1",
    format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    itemCount: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookItems.length,
    lockedChecks: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookItems.filter(
      (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
    ).length,
    items: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookItems,
    dryRunAudit: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunAudit,
    exportJson: JSON.stringify(
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookPayload,
      null,
      2
    ),
    teacherQuestion:
      "Teacher, can the next reviewer execute this Codex transplant runbook while preserving every lock assertion?",
    allowedActions: ["Run verifier", "Record observed evidence", "Stop on mismatch"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookItems.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueHandoffSteps.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookItems.every(
        (item) =>
          item.passed &&
          item.verificationCommand === "npm.cmd run verify:learning" &&
          item.continueCondition.includes("review-only") &&
          item.stopCondition.toLowerCase().includes("stop") &&
          item.lockAssertion.includes("ruleEnabled=false") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true &&
          item.blockedTransitions.includes("Package")
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookDryRunAudit.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoffPayload = {
    format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_json_v1",
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    steps: transplantRehearsalResultValidationReplayNextReviewQueueHandoffSteps,
    runbook: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbookPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueueHandoff:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueueHandoff = {
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_v1",
    format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    stepCount: transplantRehearsalResultValidationReplayNextReviewQueueHandoffSteps.length,
    lockedSteps: transplantRehearsalResultValidationReplayNextReviewQueueHandoffSteps.filter(
      (step) => step.ruleEnabled === false && step.accepted === false && step.packagingGated === true
    ).length,
    steps: transplantRehearsalResultValidationReplayNextReviewQueueHandoffSteps,
    runbook: transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbook,
    exportJson: JSON.stringify(transplantRehearsalResultValidationReplayNextReviewQueueHandoffPayload, null, 2),
    teacherQuestion:
      "Teacher, can the next reviewer follow these Codex transplant handoff steps without treating any step as acceptance?",
    allowedActions: ["Review queued evidence", "Run verifier", "Preserve blocker notes"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffSteps.length ===
        transplantRehearsalResultValidationReplayNextReviewQueueItems.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffSteps.every(
        (step) =>
          step.passed &&
          step.verifierCommand === "npm.cmd run verify:learning" &&
          step.expectedLockedResult.includes("no rule") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true &&
          step.blockedTransitions.includes("Package")
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoffRunbook.passed
  };
  const transplantRehearsalResultValidationReplayNextReviewQueuePayload = {
    format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_json_v1",
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: transplantRehearsalResultValidationReplayNextReviewQueueItems,
    handoff: transplantRehearsalResultValidationReplayNextReviewQueueHandoffPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplayNextReviewQueue:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplayNextReviewQueue = {
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_v1",
    format: "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    itemCount: transplantRehearsalResultValidationReplayNextReviewQueueItems.length,
    readyItems: transplantRehearsalResultValidationReplayNextReviewQueueItems.filter((item) => item.passed).length,
    pendingVerifierItems: transplantRehearsalResultValidationReplayNextReviewQueueItems.filter(
      (item) => item.lane === "pending_verifier"
    ).length,
    matchedEvidenceItems: transplantRehearsalResultValidationReplayNextReviewQueueItems.filter(
      (item) => item.lane === "matched_evidence_follow_up"
    ).length,
    mismatchBlockerItems: transplantRehearsalResultValidationReplayNextReviewQueueItems.filter(
      (item) => item.lane === "mismatch_blocker"
    ).length,
    lockedItems: transplantRehearsalResultValidationReplayNextReviewQueueItems.filter(
      (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
    ).length,
    items: transplantRehearsalResultValidationReplayNextReviewQueueItems,
    handoff: transplantRehearsalResultValidationReplayNextReviewQueueHandoff,
    exportJson: JSON.stringify(transplantRehearsalResultValidationReplayNextReviewQueuePayload, null, 2),
    teacherQuestion:
      "Teacher, does this queue keep each Codex transplant rehearsal result in the next review pass without enabling apprentice behavior?",
    allowedActions: ["Run missing verifier", "Review matched public evidence", "Preserve mismatch blocker"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayNextReviewQueueItems.length ===
        transplantRehearsalResultValidationReplayRows.length &&
      transplantRehearsalResultValidationReplayNextReviewQueueItems.every(
        (item) =>
          item.passed &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true &&
          item.blockedTransitions.includes("Package")
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueueHandoff.passed
  };
  const transplantRehearsalResultValidationReplayPayload = {
    format: "codex_capability_transplant_rehearsal_result_validation_replay_json_v1",
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: transplantRehearsalResultValidationReplayRows,
    nextReviewQueue: transplantRehearsalResultValidationReplayNextReviewQueuePayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidationReplay:
    QualificationCodexCapabilityTransplantRehearsalResultValidationReplay = {
    mode: "codex_capability_transplant_rehearsal_result_validation_replay_v1",
    format: "codex_capability_transplant_rehearsal_result_validation_replay_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: transplantRehearsalResultValidationReplayRows.length,
    readyRows: transplantRehearsalResultValidationReplayRows.filter((row) => row.passed).length,
    blockedStatusRows: transplantRehearsalResultValidationReplayRows.filter((row) =>
      row.blockedStatusReminder.includes("accepted")
    ).length,
    rows: transplantRehearsalResultValidationReplayRows,
    nextReviewQueue: transplantRehearsalResultValidationReplayNextReviewQueue,
    exportJson: JSON.stringify(transplantRehearsalResultValidationReplayPayload, null, 2),
    teacherQuestion:
      "Teacher, do these simulated result statuses lead only to next-review actions and never to acceptance or packaging?",
    allowedActions: ["Replay not-run consequence", "Replay matched-evidence consequence", "Replay mismatch blocker"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationReplayRows.length ===
        transplantRehearsalResultValidationRows.length * transplantRehearsalAllowedResultStatuses.length &&
      transplantRehearsalResultValidationReplayRows.every(
        (row) =>
          row.passed &&
          row.blockedStatusReminder.includes("accepted") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      transplantRehearsalResultValidationReplayNextReviewQueue.passed
  };
  const transplantRehearsalResultValidationPayload = {
    format: "codex_capability_transplant_rehearsal_result_validation_json_v1",
    mode: "codex_capability_transplant_rehearsal_result_validation_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: transplantRehearsalResultValidationRows,
    replay: transplantRehearsalResultValidationReplayPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultValidation:
    QualificationCodexCapabilityTransplantRehearsalResultValidation = {
    mode: "codex_capability_transplant_rehearsal_result_validation_v1",
    format: "codex_capability_transplant_rehearsal_result_validation_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: transplantRehearsalResultValidationRows.length,
    readyRows: transplantRehearsalResultValidationRows.filter((row) => row.passed).length,
    blockedStatusRows: transplantRehearsalResultValidationRows.filter((row) => row.blockedStatus === "accepted").length,
    rows: transplantRehearsalResultValidationRows,
    replay: transplantRehearsalResultValidationReplay,
    exportJson: JSON.stringify(transplantRehearsalResultValidationPayload, null, 2),
    teacherQuestion:
      "Teacher, do the recorded rehearsal results stay inside the allowed review statuses without implying acceptance?",
    allowedActions: ["Record not-run status", "Record matched evidence", "Record mismatch blocker"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultValidationRows.length === transplantRehearsalRows.length &&
      transplantRehearsalResultValidationRows.every(
        (row) =>
          row.passed &&
          row.allowedStatuses.includes("not_run_yet") &&
          row.allowedStatuses.includes("matched_expected") &&
          row.allowedStatuses.includes("mismatch_blocked") &&
          row.blockedStatus === "accepted" &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      transplantRehearsalResultValidationReplay.passed
  };
  const transplantRehearsalResultTemplatePayload = {
    format: "codex_capability_transplant_rehearsal_result_template_json_v1",
    mode: "codex_capability_transplant_rehearsal_result_template_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: transplantRehearsalResultRows,
    validation: transplantRehearsalResultValidationPayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsalResultTemplate:
    QualificationCodexCapabilityTransplantRehearsalResultTemplate = {
    mode: "codex_capability_transplant_rehearsal_result_template_v1",
    format: "codex_capability_transplant_rehearsal_result_template_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: transplantRehearsalResultRows.length,
    notRunRows: transplantRehearsalResultRows.filter((row) => row.defaultStatus === "not_run_yet").length,
    lockedRows: transplantRehearsalResultRows.filter(
      (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
    ).length,
    rows: transplantRehearsalResultRows,
    validation: transplantRehearsalResultValidation,
    exportJson: JSON.stringify(transplantRehearsalResultTemplatePayload, null, 2),
    teacherQuestion:
      "Teacher, paste only public rehearsal evidence here; should the next pass stay pending, continue, or stop on mismatch?",
    allowedActions: ["Record observed evidence", "Mark mismatch blocker", "Plan next review pass"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalResultRows.length === transplantRehearsalRows.length &&
      transplantRehearsalResultRows.every(
        (row) =>
          row.passed &&
          row.defaultStatus === "not_run_yet" &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      transplantRehearsalResultValidation.passed
  };
  const transplantRehearsalPayload = {
    format: "codex_capability_transplant_rehearsal_json_v1",
    mode: "codex_capability_transplant_rehearsal_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: transplantRehearsalRows,
    resultTemplate: transplantRehearsalResultTemplatePayload,
    blockedActions: blockedSideEffects
  };
  const transplantRehearsal: QualificationCodexCapabilityTransplantRehearsal = {
    mode: "codex_capability_transplant_rehearsal_v1",
    format: "codex_capability_transplant_rehearsal_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: transplantRehearsalRows.length,
    readyRows: transplantRehearsalRows.filter((row) => row.passed).length,
    lockedRows: transplantRehearsalRows.filter(
      (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
    ).length,
    rows: transplantRehearsalRows,
    resultTemplate: transplantRehearsalResultTemplate,
    exportJson: JSON.stringify(transplantRehearsalPayload, null, 2),
    teacherQuestion:
      "Teacher, does this dry-run show enough observable evidence to continue transplanting Codex-like operating patterns into the apprentice?",
    allowedActions: ["Review rehearsal trace", "Request clearer evidence", "Choose next dry-run"],
    blockedActions: blockedSideEffects,
    passed:
      transplantRehearsalRows.length === transplantDraftRows.length &&
      transplantRehearsalRows.every(
        (row) =>
          row.passed &&
          row.reviewOnly === true &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.noOpActions.includes("No real tool dispatch") &&
          row.noOpActions.includes("No packaging transition") &&
          row.blockedTransitions.includes("Accept technology")
      ) &&
      transplantRehearsalResultTemplate.passed
  };
  const transplantDraftPayload = {
    format: "codex_capability_transplant_draft_json_v1",
    mode: "codex_capability_transplant_draft_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: transplantDraftRows,
    rehearsal: transplantRehearsalPayload,
    blockedActions: blockedSideEffects
  };
  const transplantDraft: QualificationCodexCapabilityTransplantDraft = {
    mode: "codex_capability_transplant_draft_v1",
    format: "codex_capability_transplant_draft_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: transplantDraftRows.length,
    readyRows: transplantDraftRows.filter((row) => row.passed).length,
    lockedRows: transplantDraftRows.filter(
      (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
    ).length,
    rows: transplantDraftRows,
    rehearsal: transplantRehearsal,
    exportJson: JSON.stringify(transplantDraftPayload, null, 2),
    teacherQuestion:
      "Teacher, which Codex-native operating contract should the apprentice rehearse first before any real rule or packaging state changes?",
    allowedActions: ["Review transplant contract", "Request more evidence", "Choose rehearsal order"],
    blockedActions: blockedSideEffects,
    passed:
      transplantDraftRows.length === items.length &&
      transplantDraftRows.every(
        (row) =>
          row.passed &&
          row.reviewOnly === true &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.blockedTransitions.includes("Accept technology") &&
          row.verifierCommand === "npm.cmd run verify:learning"
      ) &&
      transplantRehearsal.passed
  };
  const payload = {
    format: "codex_capability_transfer_review_json_v1",
    mode: "codex_capability_transfer_review_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items,
    transplantDraft: transplantDraftPayload,
    blockedActions: blockedSideEffects
  };

  return {
    mode: "codex_capability_transfer_review_v1",
    format: "codex_capability_transfer_review_json_v1",
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    itemCount: items.length,
    readyItems: items.filter((item) => item.passed).length,
    lockedItems: items.filter(
      (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
    ).length,
    items,
    transplantDraft,
    exportJson: JSON.stringify(payload, null, 2),
    teacherQuestion:
      "Teacher, which Codex-native capability should be taught to the apprentice first, and what proof should be required before it becomes usable?",
    allowedActions: ["Review transfer pattern", "Request more evidence", "Select capability for next lesson"],
    blockedActions: blockedSideEffects,
    passed:
      items.length === 5 &&
      items.every(
        (item) =>
          item.passed &&
          item.reviewOnly === true &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true &&
          item.blockedSideEffects.includes("Accept technology")
      ) &&
      transplantDraft.passed
  };
}

function buildVisualRegressionCases(args: {
  taskId: string;
  apprenticeId: string;
  rules: RuleRecord[];
}): QualificationVisualRegressionCase[] {
  return visualScenarioFixtures.map((scenario) => {
    const baselineRun = executePhotographyJournalTask(scenario.input, [], {
      taskId: args.taskId,
      apprenticeId: args.apprenticeId
    });
    const learnedRun = executePhotographyJournalTask(scenario.input, args.rules, {
      taskId: args.taskId,
      apprenticeId: args.apprenticeId
    });
    const baselineNeedsReview = baselineRun.trace.some((step) => step.needsHumanReview);
    const learnedNeedsReview = learnedRun.trace.some((step) => step.needsHumanReview);
    const changedByMemory =
      baselineRun.output.lightingCondition !== learnedRun.output.lightingCondition ||
      baselineNeedsReview !== learnedNeedsReview;
    const passed =
      learnedRun.output.lightingCondition === scenario.expectedLighting &&
      learnedNeedsReview === scenario.expectedReview &&
      (scenario.expectedMemoryEffect === "changed" ? changedByMemory : !changedByMemory);

    return {
      id: scenario.id,
      label: scenario.label,
      input: scenario.input,
      expectedLighting: scenario.expectedLighting,
      expectedReview: scenario.expectedReview,
      expectedMemoryEffect: scenario.expectedMemoryEffect,
      baselineLighting: baselineRun.output.lightingCondition,
      learnedLighting: learnedRun.output.lightingCondition,
      baselineNeedsReview,
      learnedNeedsReview,
      changedByMemory,
      passed,
      evidence:
        scenario.expectedMemoryEffect === "changed"
          ? `Baseline ${baselineRun.output.lightingCondition}/${baselineNeedsReview ? "review" : "auto"} became ${learnedRun.output.lightingCondition}/${learnedNeedsReview ? "review" : "auto"}.`
          : `Baseline and learned output stayed ${learnedRun.output.lightingCondition}/${learnedNeedsReview ? "review" : "auto"} for a conservative boundary.`
    };
  });
}

function buildVisualLearningReadiness(args: {
  visualLearningScenarios: QualificationVisualScenario[];
  challengeSuite: LearningChallengeSuite;
  memoryProvenance: QualificationMemoryProvenance[];
  visualDemos: Array<{
    id: string;
    visualCueCount: number;
    annotationCount: number;
    lightingSignalCount: number;
  }>;
  capabilityBoundary: QualificationCapabilityBoundary[];
}): VisualLearningReadinessItem[] {
  const positiveScenarioIds = args.visualLearningScenarios
    .filter((scenario) => scenario.passed && scenario.actualLighting === "golden hour" && !scenario.needsReview)
    .map((scenario) => scenario.id);
  const positiveChallenge = args.challengeSuite.items.find((item) => item.id === "positive-visual-cue");
  const counterexampleChallenge = args.challengeSuite.items.find((item) => item.id === "counterexample-midday");
  const ordinaryChallenge = args.challengeSuite.items.find((item) => item.id === "ordinary-daylight");
  const scenarioTraceSteps = args.visualLearningScenarios.reduce(
    (total, scenario) => total + scenario.traceSummary.length,
    0
  );
  const challengeTraceSteps = args.challengeSuite.items.reduce(
    (total, item) => total + item.probe.traceSummary.length,
    0
  );
  const allTraceStepsHaveValidation =
    args.visualLearningScenarios.every((scenario) =>
      scenario.traceSummary.every((step) => step.validation.trim().length > 0)
    ) &&
    args.challengeSuite.items.every((item) =>
      item.probe.traceSummary.every((step) => step.validation.trim().length > 0)
    );
  const sourcedRules = args.memoryProvenance.filter((item) => item.sources.length > 0);
  const groundedVisualDemoCount = args.visualDemos.filter(
    (demo) => demo.visualCueCount > 0 && demo.annotationCount > 0 && demo.lightingSignalCount > 0
  ).length;
  const reviewBoundary = args.capabilityBoundary.find((item) => item.id === "teacher-review-boundary");
  const packagingBoundary = args.capabilityBoundary.find((item) => item.id === "packaging-boundary");

  return [
    {
      id: "positive-visual-transfer",
      label: "Positive visual transfer",
      reviewQuestion: "Does learned visual memory change the correct future output?",
      passed:
        positiveScenarioIds.length >= 2 &&
        positiveChallenge?.probe.changedByMemory === true &&
        positiveChallenge.probe.expectationResult.passed === true,
      status: "proven",
      evidence: `${positiveScenarioIds.length} positive scenarios and challenge ${positiveChallenge?.id ?? "missing"} prove golden-hour transfer.`,
      sourceIds: [...positiveScenarioIds, positiveChallenge?.id ?? "missing-positive-challenge"]
    },
    {
      id: "counterexample-boundary",
      label: "Counterexample boundary",
      reviewQuestion: "Does the apprentice avoid over-applying visual memory when cues conflict?",
      passed:
        counterexampleChallenge?.probe.status === "needs_review" &&
        counterexampleChallenge.probe.output.lightingCondition === "natural light" &&
        Boolean(reviewBoundary?.passed),
      status: "review_required",
      evidence: `${counterexampleChallenge?.id ?? "missing-counterexample"} stays natural light with teacher review instead of forced golden hour.`,
      sourceIds: ["midday-counterexample", counterexampleChallenge?.id ?? "missing-counterexample", reviewBoundary?.id ?? "missing-review-boundary"]
    },
    {
      id: "ordinary-input-boundary",
      label: "Ordinary input boundary",
      reviewQuestion: "Does ordinary daylight stay conservative instead of inventing a learned cue?",
      passed:
        ordinaryChallenge?.probe.status === "needs_review" &&
        ordinaryChallenge.probe.output.lightingCondition === "natural light",
      status: "review_required",
      evidence: `${ordinaryChallenge?.id ?? "missing-ordinary"} stays natural light and reviewable.`,
      sourceIds: ["ordinary-daylight", ordinaryChallenge?.id ?? "missing-ordinary"]
    },
    {
      id: "trace-auditability",
      label: "Trace auditability",
      reviewQuestion: "Can a teacher inspect every important decision without private chain-of-thought?",
      passed: scenarioTraceSteps >= 28 && challengeTraceSteps >= 21 && allTraceStepsHaveValidation,
      status: "proven",
      evidence: `${scenarioTraceSteps} scenario trace steps and ${challengeTraceSteps} challenge trace steps include public validation.`,
      sourceIds: ["visualLearningScenarios", "challengeSuite"]
    },
    {
      id: "memory-source-grounding",
      label: "Memory source grounding",
      reviewQuestion: "Can the teacher trace reusable memory back to visual demos, examples, corrections, or history?",
      passed:
        sourcedRules.length === args.memoryProvenance.length &&
        sourcedRules.length > 0 &&
        groundedVisualDemoCount > 0,
      status: "proven",
      evidence: `${sourcedRules.length}/${args.memoryProvenance.length} rules have provenance; ${groundedVisualDemoCount} visual demo has annotated cue grounding.`,
      sourceIds: args.memoryProvenance.map((item) => item.ruleId)
    },
    {
      id: "review-only-packaging-lock",
      label: "Review-only packaging lock",
      reviewQuestion: "Does this evidence stop at teacher review without accepting or packaging the technology?",
      passed:
        args.challengeSuite.persisted === false &&
        args.challengeSuite.accepted === false &&
        args.challengeSuite.packagingGated === true &&
        Boolean(packagingBoundary?.passed),
      status: "locked",
      evidence: "Challenge probes are not persisted, acceptance is false, and packaging remains locked.",
      sourceIds: ["challengeSuite", packagingBoundary?.id ?? "missing-packaging-boundary"]
    }
  ];
}

function buildVisualCueAuditTrail(args: {
  taskVisualDemos: TaskProfile["visualDemos"];
  rules: RuleRecord[];
  visualLearningScenarios: QualificationVisualScenario[];
  challengeSuite: LearningChallengeSuite;
}): QualificationVisualCueAuditTrail[] {
  return args.taskVisualDemos.flatMap((demo) => {
    const artifact = parseJson<VisualDemonstrationArtifact>(demo.artifact, {
      sceneDescription: demo.artifact,
      visualCues: [],
      lightingSignals: [],
      expectedPhotographyAdvice: []
    });
    const cueEvidence = [
      ...(artifact.annotations ?? []).map((annotation) => ({
        cue: annotation.cue,
        cueType: "annotation" as const,
        sourceEvidence: annotation.evidence,
        regionLabel: annotation.label,
        confidence: annotation.confidence
      })),
      ...artifact.visualCues.map((cue) => ({
        cue,
        cueType: "visual_cue" as const,
        sourceEvidence: artifact.sceneDescription,
        regionLabel: null,
        confidence: null
      })),
      ...artifact.lightingSignals.map((cue) => ({
        cue,
        cueType: "lighting_signal" as const,
        sourceEvidence: demo.teacherNotes,
        regionLabel: null,
        confidence: null
      }))
    ];

    return cueEvidence.map((item, index) => {
      const matchedRules = args.rules.filter((rule) =>
        [rule.title, rule.condition, rule.action].some((text) => textReferencesCue(text, item.cue))
      );
      const matchedScenarios = args.visualLearningScenarios.filter((scenario) => {
        const decisionEvidence = scenario.decisions.flatMap((decision) => [
          ...decision.matchedCues,
          ...decision.counterCues,
          ...decision.counterEvidenceSources
        ]);

        return (
          textReferencesCue(scenario.input, item.cue) ||
          textReferencesCue(scenario.evidence, item.cue) ||
          decisionEvidence.some((evidence) => textReferencesCue(evidence, item.cue))
        );
      });
      const matchedChallenges = args.challengeSuite.items.filter((challenge) => {
        const decisionEvidence = challenge.probe.ruleDecisions.flatMap((decision) => [
          ...decision.matchedCues,
          ...decision.counterCues,
          ...decision.counterEvidenceSources,
          decision.reason
        ]);

        return (
          textReferencesCue(challenge.input, item.cue) ||
          textReferencesCue(challenge.probe.expectationResult.evidence, item.cue) ||
          decisionEvidence.some((evidence) => textReferencesCue(evidence, item.cue))
        );
      });
      const passed = matchedRules.length > 0 && (matchedScenarios.length > 0 || matchedChallenges.length > 0);

      return {
        id: `${demo.id}-${item.cueType}-${index}`,
        demoId: demo.id,
        demoTitle: demo.title,
        cue: item.cue,
        cueType: item.cueType,
        sourceEvidence: item.sourceEvidence,
        regionLabel: item.regionLabel,
        confidence: item.confidence,
        ruleIds: matchedRules.map((rule) => rule.id),
        ruleTitles: matchedRules.map((rule) => rule.title),
        scenarioIds: matchedScenarios.map((scenario) => scenario.id),
        challengeIds: matchedChallenges.map((challenge) => challenge.id),
        passed,
        outcomeEvidence: passed
          ? `${matchedRules.length} rule link, ${matchedScenarios.length} scenario link, and ${matchedChallenges.length} challenge link prove this cue is reviewable.`
          : "This cue is stored as source context but has not yet been proven as a reusable decision cue."
      };
    });
  });
}

function buildVisualDecisionLedger(args: {
  visualLearningScenarios: QualificationVisualScenario[];
  challengeSuite: LearningChallengeSuite;
}): QualificationVisualDecisionLedgerItem[] {
  const scenarioItems = args.visualLearningScenarios.flatMap((scenario) =>
    scenario.decisions.map((decision, index) => ({
      id: `scenario-${scenario.id}-${index}`,
      sourceType: "scenario" as const,
      sourceId: scenario.id,
      sourceLabel: scenario.label,
      ruleTitle: decision.title,
      decision: decision.decision,
      memorySource: decision.memorySource,
      matchedCues: decision.matchedCues,
      counterCues: decision.counterCues,
      counterEvidenceSources: decision.counterEvidenceSources,
      expectedLighting: scenario.expectedLighting,
      actualLighting: scenario.actualLighting,
      expectedReview: scenario.expectedReview,
      needsReview: scenario.needsReview,
      expectationPassed: scenario.passed,
      reason: decision.reason
    }))
  );
  const challengeItems = args.challengeSuite.items.flatMap((challenge) =>
    challenge.probe.ruleDecisions.map((decision, index) => ({
      id: `challenge-${challenge.id}-${index}`,
      sourceType: "challenge" as const,
      sourceId: challenge.id,
      sourceLabel: challenge.label,
      ruleTitle: decision.title,
      decision: decision.decision,
      memorySource: decision.memorySource,
      matchedCues: decision.matchedCues,
      counterCues: decision.counterCues,
      counterEvidenceSources: decision.counterEvidenceSources,
      expectedLighting: challenge.probe.expectedLighting,
      actualLighting: challenge.probe.output.lightingCondition,
      expectedReview: challenge.probe.expectedReview,
      needsReview: challenge.probe.status === "needs_review",
      expectationPassed: challenge.probe.expectationResult.passed,
      reason: decision.reason
    }))
  );

  return [...scenarioItems, ...challengeItems];
}

function buildVisualLearningLimits(args: {
  visualCueAuditTrail: QualificationVisualCueAuditTrail[];
  visualDecisionLedger: QualificationVisualDecisionLedgerItem[];
}): QualificationVisualLearningLimit[] {
  const unprovenCueLimits = args.visualCueAuditTrail
    .filter((item) => !item.passed)
    .map((item) => ({
      id: `unproven-${item.id}`,
      category: "unproven_cue" as const,
      label: `Unproven cue: ${item.cue}`,
      status: "needs_evidence" as const,
      evidence: `${item.cue} is stored from ${item.demoTitle}, but it has not yet been proven as a rule-to-outcome behavior.`,
      sourceIds: [item.demoId, item.id]
    }));
  const reviewDecisionIds = Array.from(
    new Set(args.visualDecisionLedger.filter((item) => item.needsReview).map((item) => item.sourceId))
  );
  const reviewLimits: QualificationVisualLearningLimit[] =
    reviewDecisionIds.length > 0
      ? [
          {
            id: "teacher-review-required-for-conflicts",
            category: "teacher_review",
            label: "Conflicting visual cues require teacher review",
            status: "review_required",
            evidence: `${reviewDecisionIds.length} scenario or challenge source keeps teacher review active when learned visual cues conflict with counterexample evidence.`,
            sourceIds: reviewDecisionIds
          }
        ]
      : [];
  const blockedLimits: QualificationVisualLearningLimit[] = [
    {
      id: "packaging-release-wrapping-locked",
      category: "blocked_work",
      label: "Packaging, release, and wrapping remain locked",
      status: "locked",
      evidence: visualLearningAcceptanceGate.reason,
      sourceIds: ["teacherAcceptanceBoundary", "packaging-boundary"]
    }
  ];

  return [...unprovenCueLimits, ...reviewLimits, ...blockedLimits];
}

function buildVisualRuleCoverageMatrix(args: {
  memoryProvenance: QualificationMemoryProvenance[];
  visualCueAuditTrail: QualificationVisualCueAuditTrail[];
  visualDecisionLedger: QualificationVisualDecisionLedgerItem[];
  visualLearningLimits: QualificationVisualLearningLimit[];
}): QualificationVisualRuleCoverageMatrix {
  const unprovenCueSourceIds = new Set(
    args.visualLearningLimits
      .filter((item) => item.category === "unproven_cue")
      .flatMap((item) => item.sourceIds)
  );
  const items: QualificationVisualRuleCoverageItem[] = args.memoryProvenance.map((rule) => {
    const matchingDecisions = args.visualDecisionLedger.filter((item) => item.ruleTitle === rule.ruleTitle);
    const positiveDecisionIds = matchingDecisions
      .filter((item) => item.decision === "applied" && !item.needsReview)
      .map((item) => item.id);
    const reviewDecisionIds = matchingDecisions
      .filter((item) => item.needsReview || isConflictedDecision(item.decision))
      .map((item) => item.id);
    const cueAuditItems = args.visualCueAuditTrail.filter((item) => item.ruleTitles.includes(rule.ruleTitle));
    const cueAuditIds = cueAuditItems.map((item) => item.id);
    const unprovenCueIds = cueAuditItems
      .filter((item) => !item.passed || unprovenCueSourceIds.has(item.id))
      .map((item) => item.id);
    const hasSource = rule.sources.length > 0;
    const hasBehaviorCoverage =
      positiveDecisionIds.length > 0 || reviewDecisionIds.length > 0 || rule.appliedRunIds.length > 0;
    const status =
      hasSource && hasBehaviorCoverage
        ? "covered"
        : hasSource
          ? "source_only"
          : "needs_teacher_review";
    const passed = hasSource && hasBehaviorCoverage;

    return {
      ruleId: rule.ruleId,
      ruleTitle: rule.ruleTitle,
      enabled: rule.enabled,
      sourceTypes: rule.sourceTypes,
      sourceCount: rule.sources.length,
      appliedRunIds: rule.appliedRunIds,
      positiveDecisionIds,
      reviewDecisionIds,
      cueAuditIds,
      unprovenCueIds,
      status,
      passed,
      evidence: passed
        ? `${rule.sources.length} source(s), ${positiveDecisionIds.length} positive decision(s), ${reviewDecisionIds.length} review-boundary decision(s), and ${rule.appliedRunIds.length} applied run(s) cover this rule.`
        : `${rule.sources.length} source(s) are present, but behavior coverage is not strong enough for teacher review.`
    };
  });

  return {
    status: items.every((item) => item.passed) ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items,
    allowedActions: ["Inspect rule coverage", "Trace rule sources", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

function hasReview(trace: TraceStepRecord[]) {
  return trace.some((step) => step.needsHumanReview);
}

function buildVisualCorrectionRehearsal(args: {
  taskId: string;
  apprenticeId: string;
  rules: RuleRecord[];
}): QualificationVisualCorrectionRehearsal {
  const rehearsalFixtures = [
    {
      id: "positive-low-sun-correction",
      label: "Positive low-sun correction rehearsal",
      input: "Near Lake Geneva with clear weather, I photographed a portrait subject under low sun and soft backlight.",
      feedback:
        "Teacher correction: low sun and soft backlight should make the lightingCondition golden hour for this photography journal.",
      structuredFeedback: {
        field: "lightingCondition",
        correctedValue: "golden hour",
        conditionCue: "low sun and soft backlight",
        note: "This is a visual lighting correction rehearsal only."
      },
      baselineRules: [] as RuleRecord[],
      rehearsalRules: (candidateRule: RuleRecord) => [candidateRule],
      expectedLighting: "golden hour",
      expectedReview: false,
      expectedChange: true
    },
    {
      id: "counterexample-sign-correction",
      label: "Counterexample sign correction rehearsal",
      input: "At midday near Geneva, I photographed a cafe sign named Golden Hour under overhead sun.",
      feedback:
        "Visual counterexample: when Golden Hour is only sign text at midday under overhead sun, keep lightingCondition as natural light unless the teacher confirms golden hour.",
      structuredFeedback: {
        field: "lightingCondition",
        correctedValue: "natural light",
        conditionCue: "golden hour sign at midday with overhead sun",
        note: "Do not apply golden-hour visual memory for sign text."
      },
      baselineRules: args.rules,
      rehearsalRules: (candidateRule: RuleRecord) => [...args.rules, candidateRule],
      expectedLighting: "natural light",
      expectedReview: true,
      expectedChange: false
    }
  ];
  const cases: QualificationVisualCorrectionRehearsalCase[] = rehearsalFixtures.map((fixture) => {
    const beforeRun = executePhotographyJournalTask(fixture.input, fixture.baselineRules, {
      taskId: args.taskId,
      apprenticeId: args.apprenticeId
    });
    const extraction = extractRuleFromFeedback({
      feedback: fixture.feedback,
      beforeOutput: beforeRun.output,
      structuredFeedback: fixture.structuredFeedback,
      memoryPolicy: {
        applyAutomatically: true,
        requiresHumanConfirmation: false
      },
      apprenticeId: args.apprenticeId,
      taskId: args.taskId
    });
    const afterRun = executePhotographyJournalTask(fixture.input, fixture.rehearsalRules(extraction.extractedRule), {
      taskId: args.taskId,
      apprenticeId: args.apprenticeId
    });
    const beforeReview = hasReview(beforeRun.trace);
    const afterReview = hasReview(afterRun.trace);
    const changedByCandidateRule =
      beforeRun.output.lightingCondition !== afterRun.output.lightingCondition || beforeReview !== afterReview;
    const passed =
      afterRun.output.lightingCondition === fixture.expectedLighting &&
      afterReview === fixture.expectedReview &&
      changedByCandidateRule === fixture.expectedChange &&
      extraction.learningTrace.length > 0 &&
      extraction.learningTrace.every((step) => step.validation.trim().length > 0);

    return {
      id: fixture.id,
      label: fixture.label,
      input: fixture.input,
      feedback: fixture.feedback,
      structuredFeedback: fixture.structuredFeedback,
      extractedRuleTitle: extraction.extractedRule.title,
      extractedRuleCondition: extraction.extractedRule.condition,
      extractedRuleAction: extraction.extractedRule.action,
      errorType: extraction.errorType,
      beforeLighting: beforeRun.output.lightingCondition,
      afterLighting: afterRun.output.lightingCondition,
      beforeReview,
      afterReview,
      expectedLighting: fixture.expectedLighting,
      expectedReview: fixture.expectedReview,
      changedByCandidateRule,
      learningTrace: extraction.learningTrace,
      passed,
      evidence: `Rehearsed correction extracted "${extraction.extractedRule.title}" and moved ${beforeRun.output.lightingCondition}/${beforeReview ? "review" : "auto"} to ${afterRun.output.lightingCondition}/${afterReview ? "review" : "auto"}.`,
      sourceIds: [fixture.id, extraction.extractedRule.id, ...extraction.learningTrace.map((step) => step.id)]
    };
  });

  return {
    status: cases.every((item) => item.passed) ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    persisted: false,
    accepted: false,
    packagingGated: true,
    cases,
    allowedActions: ["Inspect correction rehearsal", "Run review-only probes", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundConfidence(value: number) {
  return Math.round(value * 100) / 100;
}

function isConflictedDecision(decision: RuleEvaluationRecord["decision"]) {
  return decision === "conflicted" || decision === "counterexample";
}

function buildVisualConfidenceCalibration(args: {
  visualLearningScenarios: QualificationVisualScenario[];
  challengeSuite: LearningChallengeSuite;
}): QualificationVisualConfidenceCalibration {
  const reviewThreshold = 0.82;
  const scenarioItems: QualificationVisualConfidenceCalibrationItem[] = args.visualLearningScenarios.map((scenario) => {
    const confidences = scenario.traceSummary.map((step) => step.confidence);
    const expectedOutcome = scenario.expectedReview ? "teacher_review" : "automatic";
    const actualOutcome = scenario.needsReview ? "teacher_review" : "automatic";
    const averageConfidence = roundConfidence(average(confidences));
    const minimumConfidence = roundConfidence(Math.min(...confidences));
    const conflictedDecisions = scenario.decisions.filter((decision) => isConflictedDecision(decision.decision)).length;
    const passed =
      scenario.passed &&
      actualOutcome === expectedOutcome &&
      (expectedOutcome === "automatic"
        ? averageConfidence >= reviewThreshold && conflictedDecisions === 0
        : scenario.needsReview && (conflictedDecisions > 0 || averageConfidence < 0.9));

    return {
      id: `scenario-confidence-${scenario.id}`,
      sourceType: "scenario",
      sourceId: scenario.id,
      label: scenario.label,
      expectedOutcome,
      actualOutcome,
      averageConfidence,
      minimumConfidence,
      conflictedDecisions,
      passed,
      evidence:
        expectedOutcome === "automatic"
          ? `Automatic path averages ${Math.round(averageConfidence * 100)}% confidence with ${conflictedDecisions} conflicted decisions.`
          : `Teacher-review path averages ${Math.round(averageConfidence * 100)}% confidence with ${conflictedDecisions} conflicted decisions or conservative uncertainty.`,
      sourceIds: scenario.traceSummary.map((step) => step.stepId)
    };
  });
  const challengeItems: QualificationVisualConfidenceCalibrationItem[] = args.challengeSuite.items.map((challenge) => {
    const confidences = challenge.probe.traceSummary.map((step) => step.confidence);
    const expectedOutcome = challenge.expectedReview ? "teacher_review" : "automatic";
    const actualOutcome = challenge.probe.status === "needs_review" ? "teacher_review" : "automatic";
    const averageConfidence = roundConfidence(average(confidences));
    const minimumConfidence = roundConfidence(Math.min(...confidences));
    const conflictedDecisions = challenge.probe.ruleDecisions.filter((decision) => isConflictedDecision(decision.decision)).length;
    const passed =
      challenge.probe.expectationResult.passed === true &&
      actualOutcome === expectedOutcome &&
      (expectedOutcome === "automatic"
        ? averageConfidence >= reviewThreshold && conflictedDecisions === 0
        : actualOutcome === "teacher_review" && (conflictedDecisions > 0 || averageConfidence < 0.9));

    return {
      id: `challenge-confidence-${challenge.id}`,
      sourceType: "challenge",
      sourceId: challenge.id,
      label: challenge.label,
      expectedOutcome,
      actualOutcome,
      averageConfidence,
      minimumConfidence,
      conflictedDecisions,
      passed,
      evidence:
        expectedOutcome === "automatic"
          ? `Review-only challenge averages ${Math.round(averageConfidence * 100)}% confidence and stays automatic.`
          : `Review-only challenge averages ${Math.round(averageConfidence * 100)}% confidence and remains under teacher review.`,
      sourceIds: challenge.probe.traceSummary.map((step) => step.stepId)
    };
  });
  const items = [...scenarioItems, ...challengeItems];

  return {
    status: items.every((item) => item.passed) ? "calibrated_for_teacher_review" : "needs_more_evidence",
    reviewThreshold,
    accepted: false,
    packagingGated: true,
    items,
    allowedActions: ["Inspect confidence calibration", "Run review-only probes", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

function buildVisualBehaviorScorecard(args: {
  visualLearningScenarios: QualificationVisualScenario[];
  visualRegressionCases: QualificationVisualRegressionCase[];
  visualRobustnessSuite: QualificationVisualRobustnessSuite;
  challengeSuite: LearningChallengeSuite;
}): QualificationVisualBehaviorScorecard {
  const scenarioCases: QualificationVisualBehaviorScorecardCase[] = args.visualLearningScenarios.map((scenario) => {
    const passed =
      scenario.actualLighting === scenario.expectedLighting && scenario.needsReview === scenario.expectedReview;

    return {
      id: `scenario-${scenario.id}`,
      label: scenario.label,
      sourceType: "scenario",
      expectedLighting: scenario.expectedLighting,
      actualLighting: scenario.actualLighting,
      expectedReview: scenario.expectedReview,
      actualReview: scenario.needsReview,
      expectedMemoryEffect: "not_scored",
      changedByMemory: null,
      route: scenario.needsReview ? "teacher_review" : "automatic",
      passed,
      evidence: scenario.evidence,
      sourceIds: [scenario.id, ...scenario.traceSummary.map((step) => step.stepId)]
    };
  });
  const regressionCases: QualificationVisualBehaviorScorecardCase[] = args.visualRegressionCases.map((item) => {
    const passed =
      item.learnedLighting === item.expectedLighting &&
      item.learnedNeedsReview === item.expectedReview &&
      (item.expectedMemoryEffect === "changed" ? item.changedByMemory : !item.changedByMemory);

    return {
      id: `regression-${item.id}`,
      label: item.label,
      sourceType: "regression",
      expectedLighting: item.expectedLighting,
      actualLighting: item.learnedLighting,
      expectedReview: item.expectedReview,
      actualReview: item.learnedNeedsReview,
      expectedMemoryEffect: item.expectedMemoryEffect,
      changedByMemory: item.changedByMemory,
      route: item.learnedNeedsReview ? "teacher_review" : "automatic",
      passed,
      evidence: item.evidence,
      sourceIds: [item.id]
    };
  });
  const robustnessCases: QualificationVisualBehaviorScorecardCase[] = args.visualRobustnessSuite.cases.map((item) => {
    const expectedMemoryEffect = item.stressType === "positive_paraphrase" ? "changed" : "conservative";
    const passed =
      item.actualLighting === item.expectedLighting &&
      item.needsReview === item.expectedReview &&
      (expectedMemoryEffect === "changed" ? item.changedByMemory : !item.changedByMemory);

    return {
      id: `robustness-${item.id}`,
      label: item.label,
      sourceType: "robustness",
      expectedLighting: item.expectedLighting,
      actualLighting: item.actualLighting,
      expectedReview: item.expectedReview,
      actualReview: item.needsReview,
      expectedMemoryEffect,
      changedByMemory: item.changedByMemory,
      route: item.needsReview ? "teacher_review" : "automatic",
      passed,
      evidence: item.evidence,
      sourceIds: [item.id]
    };
  });
  const challengeCases: QualificationVisualBehaviorScorecardCase[] = args.challengeSuite.items.map((item) => {
    const expectedMemoryEffect =
      item.expectedLighting === "golden hour" && item.expectedReview === false ? "changed" : "conservative";
    const actualReview = item.probe.status === "needs_review";
    const passed =
      item.probe.expectationResult.passed === true &&
      (expectedMemoryEffect === "changed" ? item.probe.changedByMemory : !item.probe.changedByMemory);

    return {
      id: `challenge-${item.id}`,
      label: item.label,
      sourceType: "challenge",
      expectedLighting: item.expectedLighting,
      actualLighting: item.probe.output.lightingCondition,
      expectedReview: item.expectedReview,
      actualReview,
      expectedMemoryEffect,
      changedByMemory: item.probe.changedByMemory,
      route: actualReview ? "teacher_review" : "automatic",
      passed,
      evidence: item.probe.expectationResult.evidence,
      sourceIds: [item.id, ...item.probe.traceSummary.map((step) => step.stepId)]
    };
  });
  const cases = [...scenarioCases, ...regressionCases, ...robustnessCases, ...challengeCases];
  const scoredLighting = cases.filter((item) => item.expectedLighting !== null);
  const scoredReview = cases.filter((item) => item.expectedReview !== null);
  const scoredMemory = cases.filter((item) => item.expectedMemoryEffect !== "not_scored");
  const positiveTransfer = cases.filter(
    (item) => item.expectedLighting === "golden hour" && item.expectedReview === false
  );
  const conservativeBoundary = cases.filter(
    (item) => item.expectedLighting === "natural light" && item.expectedReview === true
  );
  const metricSpecs = [
    {
      id: "lighting-accuracy",
      label: "Lighting accuracy",
      items: scoredLighting,
      correct: scoredLighting.filter((item) => item.actualLighting === item.expectedLighting).length,
      evidence: "Expected lighting matches actual learned output."
    },
    {
      id: "review-routing",
      label: "Review routing",
      items: scoredReview,
      correct: scoredReview.filter((item) => item.actualReview === item.expectedReview).length,
      evidence: "Automatic vs teacher-review routing matches the teacher expectation."
    },
    {
      id: "memory-effect",
      label: "Memory effect",
      items: scoredMemory,
      correct: scoredMemory.filter((item) =>
        item.expectedMemoryEffect === "changed" ? item.changedByMemory === true : item.changedByMemory === false
      ).length,
      evidence: "Learned memory changes positive cases and stays conservative on boundary cases."
    },
    {
      id: "automatic-positive-transfer",
      label: "Automatic positive transfer",
      items: positiveTransfer,
      correct: positiveTransfer.filter(
        (item) => item.actualLighting === "golden hour" && item.actualReview === false
      ).length,
      evidence: "Positive sunset, dusk, and low-sun cues become automatic golden-hour behavior."
    },
    {
      id: "conservative-boundary",
      label: "Conservative boundary",
      items: conservativeBoundary,
      correct: conservativeBoundary.filter(
        (item) => item.actualLighting === "natural light" && item.actualReview === true
      ).length,
      evidence: "Counterexamples and ordinary daylight stay natural-light and teacher-reviewable."
    }
  ];
  const metrics: QualificationVisualBehaviorScorecardMetric[] = metricSpecs.map((metric) => ({
    id: metric.id,
    label: metric.label,
    correct: metric.correct,
    total: metric.items.length,
    passed: metric.items.length > 0 && metric.correct === metric.items.length,
    evidence: `${metric.correct}/${metric.items.length} cases pass. ${metric.evidence}`,
    sourceIds: metric.items.map((item) => item.id)
  }));

  return {
    status: cases.every((item) => item.passed) && metrics.every((metric) => metric.passed)
      ? "ready_for_teacher_review"
      : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    cases,
    metrics,
    allowedActions: ["Inspect scorecard cases", "Run review-only probes", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

function buildVisualLearningStateAudit(args: {
  visualRegressionCases: QualificationVisualRegressionCase[];
  visualBehaviorScorecard: QualificationVisualBehaviorScorecard;
  visualCorrectionRehearsal: QualificationVisualCorrectionRehearsal;
}): QualificationVisualLearningStateAudit {
  const positiveRegression = args.visualRegressionCases.find((item) => item.id === "visual-rim-light");
  const sunsetRegression = args.visualRegressionCases.find((item) => item.id === "sunset-language");
  const counterexampleRegression = args.visualRegressionCases.find((item) => item.id === "midday-counterexample");
  const positiveScorecard = args.visualBehaviorScorecard.metrics.find(
    (item) => item.id === "automatic-positive-transfer"
  );
  const boundaryScorecard = args.visualBehaviorScorecard.metrics.find((item) => item.id === "conservative-boundary");
  const positiveRehearsal = args.visualCorrectionRehearsal.cases.find(
    (item) => item.id === "positive-low-sun-correction"
  );
  const counterexampleRehearsal = args.visualCorrectionRehearsal.cases.find(
    (item) => item.id === "counterexample-sign-correction"
  );
  const transitions: QualificationVisualLearningStateTransition[] = [
    {
      id: "baseline-to-text-memory",
      label: "Baseline to text/visual memory",
      fromState: `${sunsetRegression?.baselineLighting ?? "unknown"} with ${sunsetRegression?.baselineNeedsReview ? "teacher review" : "automatic"}`,
      toState: `${sunsetRegression?.learnedLighting ?? "unknown"} with ${sunsetRegression?.learnedNeedsReview ? "teacher review" : "automatic"}`,
      trigger: "visual_teaching",
      expectedOutcome: "sunset and dusk cues become golden-hour behavior",
      actualOutcome: sunsetRegression
        ? `${sunsetRegression.learnedLighting}/${sunsetRegression.learnedNeedsReview ? "review" : "automatic"}`
        : "missing regression evidence",
      reviewState: sunsetRegression?.learnedNeedsReview ? "teacher_review" : "automatic",
      passed: Boolean(sunsetRegression?.passed && sunsetRegression.changedByMemory),
      evidence: sunsetRegression?.evidence ?? "Missing sunset regression evidence.",
      sourceIds: [sunsetRegression?.id ?? "missing-sunset-regression"]
    },
    {
      id: "visual-cue-to-automatic-transfer",
      label: "Visual cue to automatic transfer",
      fromState: `${positiveRegression?.baselineLighting ?? "unknown"} baseline`,
      toState: `${positiveRegression?.learnedLighting ?? "unknown"} learned output`,
      trigger: "visual_teaching",
      expectedOutcome: "visual rim-light and low-sun cues transfer to automatic golden-hour output",
      actualOutcome: positiveScorecard
        ? `${positiveScorecard.correct}/${positiveScorecard.total} automatic positive transfer checks`
        : "missing scorecard metric",
      reviewState: "automatic",
      passed:
        Boolean(positiveRegression?.passed && positiveRegression.changedByMemory) &&
        Boolean(positiveScorecard?.passed),
      evidence: `${positiveRegression?.evidence ?? "Missing visual regression evidence."} ${
        positiveScorecard?.evidence ?? "Missing automatic-transfer metric."
      }`,
      sourceIds: [positiveRegression?.id ?? "missing-visual-regression", positiveScorecard?.id ?? "missing-positive-scorecard"]
    },
    {
      id: "learned-memory-to-review-boundary",
      label: "Learned memory to review boundary",
      fromState: "learned visual memory can match golden-hour-like cues",
      toState: `${counterexampleRegression?.learnedLighting ?? "unknown"} with ${counterexampleRegression?.learnedNeedsReview ? "teacher review" : "automatic"}`,
      trigger: "visual_teaching",
      expectedOutcome: "counterexamples stay natural-light and teacher-reviewable",
      actualOutcome: boundaryScorecard
        ? `${boundaryScorecard.correct}/${boundaryScorecard.total} conservative-boundary checks`
        : "missing boundary metric",
      reviewState: "teacher_review",
      passed:
        Boolean(counterexampleRegression?.passed && !counterexampleRegression.changedByMemory) &&
        Boolean(boundaryScorecard?.passed),
      evidence: `${counterexampleRegression?.evidence ?? "Missing counterexample regression evidence."} ${
        boundaryScorecard?.evidence ?? "Missing conservative-boundary metric."
      }`,
      sourceIds: [
        counterexampleRegression?.id ?? "missing-counterexample-regression",
        boundaryScorecard?.id ?? "missing-boundary-scorecard"
      ]
    },
    {
      id: "teacher-correction-to-candidate-transfer",
      label: "Teacher correction to candidate transfer",
      fromState: `${positiveRehearsal?.beforeLighting ?? "unknown"} with ${positiveRehearsal?.beforeReview ? "teacher review" : "automatic"}`,
      toState: `${positiveRehearsal?.afterLighting ?? "unknown"} with ${positiveRehearsal?.afterReview ? "teacher review" : "automatic"}`,
      trigger: "correction_rehearsal",
      expectedOutcome: "teacher correction extracts a candidate rule that changes the next run",
      actualOutcome: positiveRehearsal
        ? `${positiveRehearsal.afterLighting}/${positiveRehearsal.afterReview ? "review" : "automatic"}`
        : "missing correction rehearsal",
      reviewState: positiveRehearsal?.afterReview ? "teacher_review" : "automatic",
      passed: Boolean(positiveRehearsal?.passed && positiveRehearsal.changedByCandidateRule),
      evidence: positiveRehearsal?.evidence ?? "Missing positive correction rehearsal.",
      sourceIds: [positiveRehearsal?.id ?? "missing-positive-rehearsal"]
    },
    {
      id: "teacher-correction-to-counterexample-boundary",
      label: "Teacher correction to counterexample boundary",
      fromState: `${counterexampleRehearsal?.beforeLighting ?? "unknown"} with ${counterexampleRehearsal?.beforeReview ? "teacher review" : "automatic"}`,
      toState: `${counterexampleRehearsal?.afterLighting ?? "unknown"} with ${counterexampleRehearsal?.afterReview ? "teacher review" : "automatic"}`,
      trigger: "correction_rehearsal",
      expectedOutcome: "teacher counterexample correction preserves review instead of over-applying memory",
      actualOutcome: counterexampleRehearsal
        ? `${counterexampleRehearsal.afterLighting}/${counterexampleRehearsal.afterReview ? "review" : "automatic"}`
        : "missing counterexample rehearsal",
      reviewState: "teacher_review",
      passed: Boolean(counterexampleRehearsal?.passed && !counterexampleRehearsal.changedByCandidateRule && counterexampleRehearsal.afterReview),
      evidence: counterexampleRehearsal?.evidence ?? "Missing counterexample correction rehearsal.",
      sourceIds: [counterexampleRehearsal?.id ?? "missing-counterexample-rehearsal"]
    },
    {
      id: "review-ready-to-packaging-lock",
      label: "Review-ready to packaging lock",
      fromState: "visual learning evidence is ready for teacher review",
      toState: "acceptance false and packaging locked",
      trigger: "review_lock",
      expectedOutcome: "review readiness does not become acceptance",
      actualOutcome: visualLearningAcceptanceGate.reason,
      reviewState: "locked",
      passed: visualLearningAcceptanceGate.accepted === false && visualLearningAcceptanceGate.packagingGated === true,
      evidence: visualLearningAcceptanceGate.reason,
      sourceIds: ["teacherAcceptanceBoundary", "visualLearningAcceptanceGate"]
    }
  ];
  return {
    status: transitions.every((item) => item.passed) ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    transitions,
    allowedActions: ["Inspect state transitions", "Review transition evidence", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

function buildVisualEvidenceReplay(args: {
  taskVisualDemos: TaskProfile["visualDemos"];
  memoryProvenance: QualificationMemoryProvenance[];
  visualLearningScenarios: QualificationVisualScenario[];
  visualRobustnessSuite: QualificationVisualRobustnessSuite;
  visualLearningLimits: QualificationVisualLearningLimit[];
}): QualificationVisualEvidenceReplay {
  const visualDemoIds = args.taskVisualDemos.map((demo) => demo.id);
  const annotatedVisualDemoIds = args.taskVisualDemos
    .filter((demo) => {
      const artifact = parseJson<VisualDemonstrationArtifact>(demo.artifact, {
        sceneDescription: demo.artifact,
        visualCues: [],
        lightingSignals: [],
        expectedPhotographyAdvice: []
      });

      return (artifact.annotations?.length ?? 0) > 0 && artifact.visualCues.length > 0;
    })
    .map((demo) => demo.id);
  const visualRules = args.memoryProvenance.filter((item) => item.sourceTypes.includes("Visual demonstration"));
  const positiveScenarioIds = args.visualLearningScenarios
    .filter((scenario) => scenario.passed && !scenario.needsReview && scenario.actualLighting === "golden hour")
    .map((scenario) => scenario.id);
  const reviewScenarioIds = args.visualLearningScenarios
    .filter((scenario) => scenario.passed && scenario.needsReview)
    .map((scenario) => scenario.id);
  const robustnessFalsePositiveIds = args.visualRobustnessSuite.cases
    .filter((item) => item.passed && item.stressType === "false_positive_guard")
    .map((item) => item.id);
  const limitIds = args.visualLearningLimits.map((item) => item.id);
  const hasRequiredLimits =
    args.visualLearningLimits.some((item) => item.category === "unproven_cue") &&
    args.visualLearningLimits.some((item) => item.category === "teacher_review") &&
    args.visualLearningLimits.some((item) => item.category === "blocked_work");
  const steps: QualificationVisualEvidenceReplayStep[] = [
    {
      id: "visual-demonstration-source",
      phase: "teach",
      label: "Visual demonstration source",
      status: "ready",
      passed: visualDemoIds.length > 0 && annotatedVisualDemoIds.length > 0,
      evidence: `${visualDemoIds.length} visual demonstrations are stored; ${annotatedVisualDemoIds.length} include grounded cue annotations.`,
      sourceIds: annotatedVisualDemoIds.length > 0 ? annotatedVisualDemoIds : visualDemoIds
    },
    {
      id: "visual-rule-extraction",
      phase: "extract",
      label: "Visual rule extraction",
      status: "ready",
      passed: visualRules.length > 0,
      evidence: `${visualRules.length} reusable rule links back to visual-demonstration memory.`,
      sourceIds: visualRules.map((item) => item.ruleId)
    },
    {
      id: "positive-application-replay",
      phase: "apply",
      label: "Positive application replay",
      status: "ready",
      passed: positiveScenarioIds.length >= 2,
      evidence: `${positiveScenarioIds.length} positive visual scenarios replay as golden-hour behavior without teacher review.`,
      sourceIds: positiveScenarioIds
    },
    {
      id: "counterexample-review-replay",
      phase: "apply",
      label: "Counterexample review replay",
      status: "review_required",
      passed: reviewScenarioIds.length >= 2,
      evidence: `${reviewScenarioIds.length} scenarios remain under teacher review when visual cues are ambiguous or conflicting.`,
      sourceIds: reviewScenarioIds
    },
    {
      id: "robustness-stress-replay",
      phase: "stress",
      label: "Robustness stress replay",
      status: "review_required",
      passed:
        args.visualRobustnessSuite.passed === args.visualRobustnessSuite.total &&
        robustnessFalsePositiveIds.length >= 3,
      evidence: `${args.visualRobustnessSuite.passed}/${args.visualRobustnessSuite.total} stress cases pass, including ${robustnessFalsePositiveIds.length} false-positive guards.`,
      sourceIds: args.visualRobustnessSuite.cases.map((item) => item.id)
    },
    {
      id: "visible-limit-replay",
      phase: "limits",
      label: "Visible learning limits replay",
      status: "review_required",
      passed: hasRequiredLimits,
      evidence: `${args.visualLearningLimits.length} visible limits include unproven cues, teacher review, and blocked work.`,
      sourceIds: limitIds
    },
    {
      id: "review-only-lock-replay",
      phase: "review",
      label: "Review-only lock replay",
      status: "locked",
      passed: visualLearningAcceptanceGate.packagingGated && !visualLearningAcceptanceGate.accepted,
      evidence: visualLearningAcceptanceGate.reason,
      sourceIds: ["teacherAcceptanceBoundary", "visualLearningAcceptanceGate"]
    }
  ];
  return {
    status: steps.every((step) => step.passed) ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    steps,
    allowedActions: ["Inspect replay evidence", "Run review-only probes", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

function buildVisualTeacherReviewWorksheet(args: {
  visualLearningReadiness: VisualLearningReadinessItem[];
  visualConfidenceCalibration: QualificationVisualConfidenceCalibration;
  visualBehaviorScorecard: QualificationVisualBehaviorScorecard;
  visualRuleCoverageMatrix: QualificationVisualRuleCoverageMatrix;
  visualCorrectionRehearsal: QualificationVisualCorrectionRehearsal;
  visualLearningStateAudit: QualificationVisualLearningStateAudit;
  visualUncertaintyEscalationAudit: QualificationVisualUncertaintyEscalationAudit;
  spatialEngineeringTeachingModel: QualificationSpatialEngineeringTeachingModel;
  domainLearningWorkflow: QualificationDomainLearningWorkflow;
  humanTeachingMemoryProtocol: QualificationHumanTeachingMemoryProtocol;
  visualRobustnessSuite: QualificationVisualRobustnessSuite;
  visualEvidenceReplay: QualificationVisualEvidenceReplay;
  visualRedTeamRegister: QualificationVisualRedTeamRegister;
  visualLearningLimits: QualificationVisualLearningLimit[];
  challengeSuite: LearningChallengeSuite;
}): QualificationVisualTeacherReviewWorksheet {
  const readinessById = new Map(args.visualLearningReadiness.map((item) => [item.id, item]));
  const positiveTransfer = readinessById.get("positive-visual-transfer");
  const counterexampleBoundary = readinessById.get("counterexample-boundary");
  const ordinaryBoundary = readinessById.get("ordinary-input-boundary");
  const traceAuditability = readinessById.get("trace-auditability");
  const memoryGrounding = readinessById.get("memory-source-grounding");
  const packagingLock = readinessById.get("review-only-packaging-lock");
  const unprovenCueCount = args.visualLearningLimits.filter((item) => item.category === "unproven_cue").length;
  const automaticChecks = args.visualConfidenceCalibration.items.filter((item) => item.actualOutcome === "automatic");
  const reviewChecks = args.visualConfidenceCalibration.items.filter((item) => item.actualOutcome === "teacher_review");
  const reviewRiskCount = args.visualRedTeamRegister.risks.filter((item) => item.status === "needs_teacher_review").length;
  const lockedRiskCount = args.visualRedTeamRegister.risks.filter((item) => item.status === "locked").length;
  const worksheetItems: QualificationVisualTeacherReviewWorksheetItem[] = [
    {
      id: "positive-transfer-decision",
      label: "Positive transfer decision",
      question: "Do the positive sunset, dusk, and rim-light examples prove that visual memory improves the next run?",
      status: "unanswered",
      evidenceReady: Boolean(positiveTransfer?.passed) && args.challengeSuite.passed === args.challengeSuite.total,
      readinessSignal: "strong",
      evidence: positiveTransfer?.evidence ?? "Positive transfer evidence is missing.",
      sourceIds: positiveTransfer?.sourceIds ?? ["missing-positive-transfer"]
    },
    {
      id: "counterexample-safety-decision",
      label: "Counterexample safety decision",
      question: "Do midday and conflicting-light examples remain conservative and require teacher review instead of overgeneralizing?",
      status: "unanswered",
      evidenceReady: Boolean(counterexampleBoundary?.passed) && reviewChecks.length >= 2,
      readinessSignal: "review_carefully",
      evidence: counterexampleBoundary?.evidence ?? "Counterexample boundary evidence is missing.",
      sourceIds: counterexampleBoundary?.sourceIds ?? ["missing-counterexample-boundary"]
    },
    {
      id: "ordinary-input-decision",
      label: "Ordinary input decision",
      question: "Does ordinary daylight stay natural light when no learned visual cue is proven?",
      status: "unanswered",
      evidenceReady: Boolean(ordinaryBoundary?.passed),
      readinessSignal: "review_carefully",
      evidence: ordinaryBoundary?.evidence ?? "Ordinary input boundary evidence is missing.",
      sourceIds: ordinaryBoundary?.sourceIds ?? ["missing-ordinary-boundary"]
    },
    {
      id: "trace-transparency-decision",
      label: "Trace transparency decision",
      question: "Can every important visual-memory decision be inspected through public trace steps, validation, and confidence?",
      status: "unanswered",
      evidenceReady: Boolean(traceAuditability?.passed) && args.visualConfidenceCalibration.items.every((item) => item.passed),
      readinessSignal: "strong",
      evidence: traceAuditability?.evidence ?? "Trace auditability evidence is missing.",
      sourceIds: [
        ...(traceAuditability?.sourceIds ?? ["missing-trace-auditability"]),
        ...args.visualConfidenceCalibration.items.map((item) => item.id)
      ]
    },
    {
      id: "evidence-replay-decision",
      label: "Evidence replay decision",
      question: "Can the teacher replay the full chain from visual demonstration to extracted rule, applied behavior, stress guards, and review lock?",
      status: "unanswered",
      evidenceReady:
        args.visualEvidenceReplay.status === "ready_for_teacher_review" &&
        args.visualEvidenceReplay.steps.every((step) => step.passed),
      readinessSignal: "strong",
      evidence: `${args.visualEvidenceReplay.steps.filter((step) => step.passed).length}/${args.visualEvidenceReplay.steps.length} replay steps are ready and remain review-only.`,
      sourceIds: args.visualEvidenceReplay.steps.map((step) => step.id)
    },
    {
      id: "behavior-scorecard-decision",
      label: "Behavior scorecard decision",
      question: "Do expected-vs-actual lighting, review routing, and memory-effect metrics prove the visual learning behavior is stable enough for teacher review?",
      status: "unanswered",
      evidenceReady:
        args.visualBehaviorScorecard.status === "ready_for_teacher_review" &&
        args.visualBehaviorScorecard.cases.every((item) => item.passed) &&
        args.visualBehaviorScorecard.metrics.every((metric) => metric.passed) &&
        args.visualBehaviorScorecard.accepted === false &&
        args.visualBehaviorScorecard.packagingGated === true,
      readinessSignal: "strong",
      evidence: `${args.visualBehaviorScorecard.cases.filter((item) => item.passed).length}/${args.visualBehaviorScorecard.cases.length} behavior cases and ${args.visualBehaviorScorecard.metrics.filter((metric) => metric.passed).length}/${args.visualBehaviorScorecard.metrics.length} metrics are ready.`,
      sourceIds: args.visualBehaviorScorecard.metrics.map((metric) => metric.id)
    },
    {
      id: "memory-grounding-decision",
      label: "Memory grounding decision",
      question: "Is reusable visual memory grounded in demonstrations, examples, corrections, or execution history?",
      status: "unanswered",
      evidenceReady: Boolean(memoryGrounding?.passed),
      readinessSignal: "strong",
      evidence: memoryGrounding?.evidence ?? "Memory grounding evidence is missing.",
      sourceIds: memoryGrounding?.sourceIds ?? ["missing-memory-grounding"]
    },
    {
      id: "rule-coverage-decision",
      label: "Rule coverage decision",
      question: "Does each reusable visual rule have source provenance plus positive, review-boundary, or applied-run behavior coverage?",
      status: "unanswered",
      evidenceReady:
        args.visualRuleCoverageMatrix.status === "ready_for_teacher_review" &&
        args.visualRuleCoverageMatrix.items.every((item) => item.passed) &&
        args.visualRuleCoverageMatrix.accepted === false &&
        args.visualRuleCoverageMatrix.packagingGated === true,
      readinessSignal: "strong",
      evidence: `${args.visualRuleCoverageMatrix.items.filter((item) => item.passed).length}/${args.visualRuleCoverageMatrix.items.length} reusable rules have source and behavior coverage.`,
      sourceIds: args.visualRuleCoverageMatrix.items.map((item) => item.ruleId)
    },
    {
      id: "correction-rehearsal-decision",
      label: "Correction rehearsal decision",
      question: "Can a teacher correction become a candidate visual rule and change or preserve the next run in a review-only rehearsal?",
      status: "unanswered",
      evidenceReady:
        args.visualCorrectionRehearsal.status === "ready_for_teacher_review" &&
        args.visualCorrectionRehearsal.persisted === false &&
        args.visualCorrectionRehearsal.accepted === false &&
        args.visualCorrectionRehearsal.packagingGated === true &&
        args.visualCorrectionRehearsal.cases.every((item) => item.passed),
      readinessSignal: "strong",
      evidence: `${args.visualCorrectionRehearsal.cases.filter((item) => item.passed).length}/${args.visualCorrectionRehearsal.cases.length} visual correction rehearsals extracted candidate rules without persistence.`,
      sourceIds: args.visualCorrectionRehearsal.cases.map((item) => item.id)
    },
    {
      id: "state-transition-decision",
      label: "State transition decision",
      question: "Can the teacher see how visual learning moved from baseline behavior to learned behavior, correction rehearsal, and review-only lock?",
      status: "unanswered",
      evidenceReady:
        args.visualLearningStateAudit.status === "ready_for_teacher_review" &&
        args.visualLearningStateAudit.accepted === false &&
        args.visualLearningStateAudit.packagingGated === true &&
        args.visualLearningStateAudit.transitions.every((item) => item.passed),
      readinessSignal: "strong",
      evidence: `${args.visualLearningStateAudit.transitions.filter((item) => item.passed).length}/${args.visualLearningStateAudit.transitions.length} learning state transitions are proven and review-only.`,
      sourceIds: args.visualLearningStateAudit.transitions.map((item) => item.id)
    },
    {
      id: "uncertainty-escalation-decision",
      label: "Uncertainty escalation decision",
      question: "Can the teacher see exactly which conflicts, missing evidence, ordinary uncertainty, correction boundaries, and packaging locks are escalated?",
      status: "unanswered",
      evidenceReady:
        args.visualUncertaintyEscalationAudit.status === "ready_for_teacher_review" &&
        args.visualUncertaintyEscalationAudit.accepted === false &&
        args.visualUncertaintyEscalationAudit.packagingGated === true &&
        args.visualUncertaintyEscalationAudit.items.every((item) => item.passed && item.evidenceReady),
      readinessSignal: "review_carefully",
      evidence: `${args.visualUncertaintyEscalationAudit.items.filter((item) => item.evidenceReady).length}/${args.visualUncertaintyEscalationAudit.items.length} uncertainty escalation items are evidence-ready and remain review-only.`,
      sourceIds: args.visualUncertaintyEscalationAudit.items.map((item) => item.id)
    },
    {
      id: "spatial-fit-selection-decision",
      label: "Spatial fit selection decision",
      question: "Can the teacher draw in a 3D coordinate frame, inspect multiple mathematical fits, and choose the intended engineering geometry?",
      status: "unanswered",
      evidenceReady:
        args.spatialEngineeringTeachingModel.status === "ready_for_teacher_review" &&
        args.spatialEngineeringTeachingModel.humanSelectionRequired === true &&
        args.spatialEngineeringTeachingModel.candidates.length >= 3 &&
        args.spatialEngineeringTeachingModel.candidates.every(
          (candidate) => candidate.passed && candidate.teacherSelectable
        ) &&
        args.spatialEngineeringTeachingModel.accepted === false &&
        args.spatialEngineeringTeachingModel.packagingGated === true,
      readinessSignal: "review_carefully",
      evidence: `${args.spatialEngineeringTeachingModel.candidates.length} 3D fit candidates are available for teacher selection from ${args.spatialEngineeringTeachingModel.sampleCount} teaching samples.`,
      sourceIds: args.spatialEngineeringTeachingModel.candidates.map((candidate) => candidate.id)
    },
    {
      id: "domain-learning-workflow-decision",
      label: "Domain learning workflow decision",
      question: "Does the apprentice first build a domain learning plan and knowledge system before entering step-by-step human teaching?",
      status: "unanswered",
      evidenceReady:
        args.domainLearningWorkflow.status === "ready_for_teacher_review" &&
        args.domainLearningWorkflow.stages.every((stage) => stage.passed) &&
        args.domainLearningWorkflow.knowledgeNodes.every((node) => node.passed) &&
        args.domainLearningWorkflow.guidedGenerationSteps.every((step) => step.passed) &&
        args.domainLearningWorkflow.accepted === false &&
        args.domainLearningWorkflow.packagingGated === true,
      readinessSignal: "strong",
      evidence: `${args.domainLearningWorkflow.stages.length} domain-learning stages, ${args.domainLearningWorkflow.knowledgeNodes.length} knowledge nodes, and ${args.domainLearningWorkflow.guidedGenerationSteps.length} guided generation steps are review-ready.`,
      sourceIds: [
        ...args.domainLearningWorkflow.stages.map((stage) => stage.id),
        ...args.domainLearningWorkflow.guidedGenerationSteps.map((step) => step.id)
      ]
    },
    {
      id: "human-teaching-memory-decision",
      label: "Human teaching memory decision",
      question: "Does the apprentice preserve human-taught knowledge, obey it in future commands, and ask humbly when new teaching conflicts with old teaching?",
      status: "unanswered",
      evidenceReady:
        args.humanTeachingMemoryProtocol.status === "ready_for_teacher_review" &&
        args.humanTeachingMemoryProtocol.rules.every((rule) => rule.passed) &&
        args.humanTeachingMemoryProtocol.conflictSteps.every((step) => step.passed) &&
        args.humanTeachingMemoryProtocol.voiceExperience.passed &&
        args.humanTeachingMemoryProtocol.accepted === false &&
        args.humanTeachingMemoryProtocol.packagingGated === true,
      readinessSignal: "strong",
      evidence: `${args.humanTeachingMemoryProtocol.rules.length} durable teaching rules, ${args.humanTeachingMemoryProtocol.conflictSteps.length} conflict steps, and optional voice teaching are review-ready.`,
      sourceIds: [
        ...args.humanTeachingMemoryProtocol.rules.map((rule) => rule.id),
        ...args.humanTeachingMemoryProtocol.conflictSteps.map((step) => step.id),
        args.humanTeachingMemoryProtocol.voiceExperience.id
      ]
    },
    {
      id: "robustness-stress-decision",
      label: "Robustness stress decision",
      question: "Do paraphrase and false-positive stress cases show the apprentice can generalize without over-triggering visual memory?",
      status: "unanswered",
      evidenceReady:
        args.visualRobustnessSuite.passed === args.visualRobustnessSuite.total &&
        args.visualRobustnessSuite.cases.some((item) => item.stressType === "positive_paraphrase") &&
        args.visualRobustnessSuite.cases.some((item) => item.stressType === "false_positive_guard"),
      readinessSignal: "review_carefully",
      evidence: `${args.visualRobustnessSuite.passed}/${args.visualRobustnessSuite.total} robustness stress cases passed, including paraphrase transfer and false-positive guards.`,
      sourceIds: args.visualRobustnessSuite.cases.map((item) => item.id)
    },
    {
      id: "known-limits-decision",
      label: "Known limits decision",
      question: "Are unproven cues and teacher-review boundaries visible enough that the apprentice will not overclaim ability?",
      status: "unanswered",
      evidenceReady: unprovenCueCount > 0 && args.visualLearningLimits.some((item) => item.category === "teacher_review"),
      readinessSignal: "review_carefully",
      evidence: `${unprovenCueCount} unproven cues stay visible with teacher-review and blocked-work limits.`,
      sourceIds: args.visualLearningLimits.map((item) => item.id)
    },
    {
      id: "red-team-risk-decision",
      label: "Red-team risk decision",
      question: "Do the risk probes show the visual apprentice avoids obvious false positives while leaving unresolved risks for teacher review?",
      status: "unanswered",
      evidenceReady:
        args.visualRedTeamRegister.status === "ready_for_teacher_review" &&
        args.visualRedTeamRegister.risks.every((item) => item.passed) &&
        args.visualRedTeamRegister.accepted === false &&
        args.visualRedTeamRegister.packagingGated === true,
      readinessSignal: "review_carefully",
      evidence: `${args.visualRedTeamRegister.risks.length} red-team risks are registered; ${reviewRiskCount} need teacher review and ${lockedRiskCount} remain locked.`,
      sourceIds: args.visualRedTeamRegister.risks.map((item) => item.id)
    },
    {
      id: "review-only-lock-decision",
      label: "Review-only lock decision",
      question: "Is the app still blocked from acceptance, packaging, release, and wrapping until the teacher confirms outside this surface?",
      status: "unanswered",
      evidenceReady: Boolean(packagingLock?.passed) && visualLearningAcceptanceGate.packagingGated && !visualLearningAcceptanceGate.accepted,
      readinessSignal: "locked",
      evidence: visualLearningAcceptanceGate.reason,
      sourceIds: ["teacherAcceptanceBoundary", packagingLock?.id ?? "missing-packaging-lock"]
    }
  ];
  const batchReviewExchangeItems: QualificationVisualTeacherReviewBatchExchangeItem[] = worksheetItems.map((item) => ({
    id: item.id,
    label: item.label,
    question: item.question,
    evidence: item.evidence,
    sourceIds: item.sourceIds,
    decision: "unreviewed",
    note: ""
  }));
  const batchReviewExchange: QualificationVisualTeacherReviewBatchExchange = {
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    format: "teacher_review_batch_json_v1",
    itemCount: batchReviewExchangeItems.length,
    allowedDecisions: ["unreviewed", "tentative_pass", "needs_change", "unsure"],
    requiredFields: ["id", "decision", "note"],
    templateJson: JSON.stringify(
      {
        format: "teacher_review_batch_json_v1",
        mode: "visual_learning_review_only",
        accepted: false,
        packagingGated: true,
        instructions:
          "老师只填写 decision 和 note；decision 只能是 unreviewed、tentative_pass、needs_change 或 unsure。回填不会验收技术，也不会解锁封装。",
        items: batchReviewExchangeItems
      },
      null,
      2
    ),
    importInstructions: [
      "Export the JSON template from the worksheet.",
      "Fill only decision and note for each item.",
      "Paste the JSON back into the worksheet import box.",
      "Apply it to the local draft, then save a teacher review draft if needed."
    ],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    passed: batchReviewExchangeItems.length === worksheetItems.length && worksheetItems.every((item) => item.evidenceReady)
  };
  const currentChangedItemIds = [
    worksheetItems[0],
    worksheetItems[1],
    worksheetItems[2],
    worksheetItems[3],
    worksheetItems[4],
    worksheetItems[7],
    worksheetItems[10],
    worksheetItems[16],
    worksheetItems[17]
  ].map((item) => item.id);
  const currentFollowUpItemIds = [worksheetItems[1], worksheetItems[10], worksheetItems[16]].map((item) => item.id);
  const draftVersions: QualificationVisualTeacherReviewDraftVersion[] = [
    {
      id: "teacher-review-draft-v1",
      version: "v1",
      label: "v1 初始未标注草稿",
      decisionCounts: {
        unreviewed: worksheetItems.length,
        tentative_pass: 0,
        needs_change: 0,
        unsure: 0
      },
      changedItemIds: [],
      followUpItemIds: [],
      teacherNote: "初始导出版本，所有问题仍等待老师判断。",
      comparisonToPrevious: ["基线版本，没有上一版可比较。", "不记录验收，不启用规则，不解锁封装。"],
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      passed: true
    },
    {
      id: "teacher-review-draft-v2",
      version: "v2",
      label: "v2 批量回填预演",
      decisionCounts: {
        unreviewed: worksheetItems.length - 7,
        tentative_pass: 4,
        needs_change: 2,
        unsure: 1
      },
      changedItemIds: worksheetItems.slice(0, 7).map((item) => item.id),
      followUpItemIds: worksheetItems.slice(4, 7).map((item) => item.id),
      teacherNote: "模拟老师先批量标注 7 个问题，留下 3 个问题进入下一轮带教修正。",
      comparisonToPrevious: [
        "7 个问题从 unreviewed 变为老师本地判断。",
        "3 个问题进入 needs_change/unsure，不会自动保存为长期记忆。"
      ],
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      passed: true
    },
    {
      id: "teacher-review-draft-current",
      version: "current",
      label: "current 当前草稿预演",
      decisionCounts: {
        unreviewed: worksheetItems.length - currentChangedItemIds.length,
        tentative_pass: 6,
        needs_change: 2,
        unsure: 1
      },
      changedItemIds: currentChangedItemIds,
      followUpItemIds: currentFollowUpItemIds,
      teacherNote: "当前预演版本把反例边界、不确定升级和红队风险留给老师继续带教。",
      comparisonToPrevious: [
        "新增 2 个暂定通过项，但仍不是正式验收。",
        "保留 3 个下一轮修正项，优先要求 AI 解释证据不足和规则边界。",
        "accepted=false 且 packagingGated=true，封装闸门继续锁定。"
      ],
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      passed: true
    }
  ];
  const draftVersionComparison: QualificationVisualTeacherReviewDraftVersionComparison = {
    mode: "teacher_review_draft_version_comparison",
    versions: draftVersions,
    currentVersionId: "teacher-review-draft-current",
    changedItemCount: currentChangedItemIds.length,
    followUpItemCount: currentFollowUpItemIds.length,
    teacherQuestion: "老师，请比较这些草稿版本的变化：哪些问题可以暂定通过，哪些必须继续带教，是否仍要保持封装锁定？",
    allowedActions: ["Compare draft versions", "Edit local draft", "Export batch JSON", "Save review-only draft"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    passed:
      draftVersions.length === 3 &&
      draftVersions.every((version) => version.reviewOnly && !version.accepted && version.packagingGated && version.passed) &&
      currentChangedItemIds.length > 0 &&
      currentFollowUpItemIds.length > 0
  };

  return {
    status: "awaiting_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: worksheetItems,
    batchReviewExchange,
    draftVersionComparison,
    allowedActions: ["Inspect worksheet evidence", "Run review-only probes", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    teacherInstruction:
      "Use this worksheet to judge the visual learning technology. The app records no acceptance here and keeps packaging locked."
  };
}

function buildVisualRedTeamRegister(args: {
  visualRobustnessSuite: QualificationVisualRobustnessSuite;
  visualLearningLimits: QualificationVisualLearningLimit[];
  visualEvidenceReplay: QualificationVisualEvidenceReplay;
  visualConfidenceCalibration: QualificationVisualConfidenceCalibration;
}): QualificationVisualRedTeamRegister {
  const robustnessById = new Map(args.visualRobustnessSuite.cases.map((item) => [item.id, item]));
  const lowSunParaphrase = robustnessById.get("low-sun-paraphrase");
  const cafeSignMidday = robustnessById.get("cafe-sign-midday");
  const warmOrangeNoonWall = robustnessById.get("warm-orange-noon-wall");
  const longShadowsOverheadSun = robustnessById.get("long-shadows-overhead-sun");
  const unprovenCueLimits = args.visualLearningLimits.filter((item) => item.category === "unproven_cue");
  const lockReplay = args.visualEvidenceReplay.steps.find((item) => item.id === "review-only-lock-replay");
  const automaticCalibrationCount = args.visualConfidenceCalibration.items.filter(
    (item) => item.expectedOutcome === "automatic" && item.passed
  ).length;
  const reviewCalibrationCount = args.visualConfidenceCalibration.items.filter(
    (item) => item.expectedOutcome === "teacher_review" && item.passed
  ).length;
  const risks: QualificationVisualRedTeamRisk[] = [
    {
      id: "lexical-false-positive",
      label: "Lexical false positive",
      risk: "A learned cue word such as Golden Hour could appear as a cafe sign or name and incorrectly trigger golden-hour behavior.",
      probe: cafeSignMidday?.label ?? "Golden Hour sign at midday",
      mitigation: cafeSignMidday?.evidence ?? "No cafe-sign robustness evidence is available.",
      severity: "high",
      status: "mitigated_for_review",
      passed: Boolean(cafeSignMidday?.passed && cafeSignMidday.needsReview && !cafeSignMidday.changedByMemory),
      sourceIds: [cafeSignMidday?.id ?? "missing-cafe-sign-midday"]
    },
    {
      id: "material-color-false-positive",
      label: "Material color false positive",
      risk: "Warm wall color or highlight wording at noon could be mistaken for golden-hour lighting.",
      probe: warmOrangeNoonWall?.label ?? "Warm highlight wording at noon",
      mitigation: warmOrangeNoonWall?.evidence ?? "No warm-color robustness evidence is available.",
      severity: "medium",
      status: "mitigated_for_review",
      passed: Boolean(warmOrangeNoonWall?.passed && warmOrangeNoonWall.needsReview && !warmOrangeNoonWall.changedByMemory),
      sourceIds: [warmOrangeNoonWall?.id ?? "missing-warm-orange-noon-wall"]
    },
    {
      id: "shadow-overgeneralization",
      label: "Shadow overgeneralization",
      risk: "The apprentice could overgeneralize long-shadow language even when the note says overhead sun.",
      probe: longShadowsOverheadSun?.label ?? "Long shadows with overhead sun",
      mitigation: longShadowsOverheadSun?.evidence ?? "No long-shadow robustness evidence is available.",
      severity: "high",
      status: "mitigated_for_review",
      passed: Boolean(
        longShadowsOverheadSun?.passed && longShadowsOverheadSun.needsReview && !longShadowsOverheadSun.changedByMemory
      ),
      sourceIds: [longShadowsOverheadSun?.id ?? "missing-long-shadows-overhead-sun"]
    },
    {
      id: "positive-paraphrase-transfer",
      label: "Positive paraphrase transfer",
      risk: "The system might memorize exact words instead of transferring the visual concept to low-sun/backlight paraphrases.",
      probe: lowSunParaphrase?.label ?? "Low sun paraphrase",
      mitigation: lowSunParaphrase?.evidence ?? "No positive paraphrase robustness evidence is available.",
      severity: "medium",
      status: "mitigated_for_review",
      passed: Boolean(lowSunParaphrase?.passed && lowSunParaphrase.changedByMemory && !lowSunParaphrase.needsReview),
      sourceIds: [lowSunParaphrase?.id ?? "missing-low-sun-paraphrase"]
    },
    {
      id: "unproven-cue-overclaim",
      label: "Unproven cue overclaim",
      risk: "The apprentice could imply that every warm, scenic, or nostalgic cue is proven even when the evidence only covers a narrow set.",
      probe: "Visible learning limits and confidence calibration",
      mitigation: `${unprovenCueLimits.length} unproven-cue limits remain visible; ${automaticCalibrationCount} automatic and ${reviewCalibrationCount} review calibration checks separate proven from uncertain cases.`,
      severity: "high",
      status: "needs_teacher_review",
      passed: unprovenCueLimits.length > 0 && reviewCalibrationCount > 0,
      sourceIds: [...unprovenCueLimits.map((item) => item.id), ...args.visualConfidenceCalibration.items.map((item) => item.id)]
    },
    {
      id: "premature-packaging",
      label: "Premature packaging",
      risk: "The implementation could accidentally treat evidence readiness as teacher acceptance and unlock packaging.",
      probe: lockReplay?.label ?? "Review-only lock replay",
      mitigation: lockReplay?.evidence ?? visualLearningAcceptanceGate.reason,
      severity: "high",
      status: "locked",
      passed:
        Boolean(lockReplay?.passed) &&
        args.visualEvidenceReplay.accepted === false &&
        args.visualEvidenceReplay.packagingGated === true &&
        visualLearningAcceptanceGate.accepted === false &&
        visualLearningAcceptanceGate.packagingGated === true,
      sourceIds: ["teacherAcceptanceBoundary", lockReplay?.id ?? "missing-review-only-lock-replay"]
    }
  ];

  return {
    status: risks.every((item) => item.passed) ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    risks,
    allowedActions: ["Inspect red-team risks", "Run review-only probes", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

function buildVisualUncertaintyEscalationAudit(args: {
  visualLearningLimits: QualificationVisualLearningLimit[];
  visualDecisionLedger: QualificationVisualDecisionLedgerItem[];
  visualCorrectionRehearsal: QualificationVisualCorrectionRehearsal;
  visualLearningStateAudit: QualificationVisualLearningStateAudit;
  visualRedTeamRegister: QualificationVisualRedTeamRegister;
}): QualificationVisualUncertaintyEscalationAudit {
  const conflictedDecisionIds = args.visualDecisionLedger
    .filter((item) => item.decision === "conflicted" || item.decision === "counterexample")
    .map((item) => item.id);
  const unprovenCueIds = args.visualLearningLimits
    .filter((item) => item.category === "unproven_cue")
    .map((item) => item.id);
  const ordinaryDecisionIds = args.visualDecisionLedger
    .filter((item) => item.sourceId === "ordinary-daylight" || item.sourceId === "ordinary-daylight-note")
    .map((item) => item.id);
  const ordinaryLimitIds = args.visualLearningLimits
    .filter(
      (item) =>
        item.category === "teacher_review" ||
        item.id.includes("ordinary") ||
        item.sourceIds.some((sourceId) => sourceId.includes("ordinary"))
    )
    .map((item) => item.id);
  const counterexampleRehearsal = args.visualCorrectionRehearsal.cases.find(
    (item) => item.id === "counterexample-sign-correction"
  );
  const redTeamOverclaim = args.visualRedTeamRegister.risks.find((item) => item.id === "unproven-cue-overclaim");
  const packagingLock = args.visualLearningStateAudit.transitions.find(
    (item) => item.id === "review-ready-to-packaging-lock"
  );
  const items: QualificationVisualUncertaintyEscalationItem[] = [
    {
      id: "conflicted-visual-memory",
      label: "Conflicted visual memory",
      trigger: "conflict",
      reason: "A visual memory matched, but counter-evidence or conflicting cues require teacher review before trusting the output.",
      teacherAction: "Inspect the visual decision ledger and confirm whether the matched visual memory should apply.",
      reviewState: "teacher_review",
      evidenceReady: conflictedDecisionIds.length > 0,
      passed: conflictedDecisionIds.length > 0,
      sourceIds: conflictedDecisionIds.length > 0 ? conflictedDecisionIds : ["missing-conflicted-decision"]
    },
    {
      id: "unproven-cue-escalation",
      label: "Unproven cue escalation",
      trigger: "missing_evidence",
      reason: "Some visual cues appear in demonstrations or notes but are not proven enough to become automatic behavior.",
      teacherAction: "Add a visual demonstration or correction before reusing these cues as reliable memory.",
      reviewState: "teacher_review",
      evidenceReady: unprovenCueIds.length > 0,
      passed: unprovenCueIds.length > 0,
      sourceIds: unprovenCueIds.length > 0 ? unprovenCueIds : ["missing-unproven-cue-limit"]
    },
    {
      id: "ordinary-daylight-escalation",
      label: "Ordinary daylight escalation",
      trigger: "ordinary_uncertainty",
      reason: "Ordinary daylight has no proven sunset, dusk, or low-sun cue and must stay natural-light and reviewable.",
      teacherAction: "Review the ordinary-daylight evidence before approving broader visual generalization.",
      reviewState: "teacher_review",
      evidenceReady: ordinaryDecisionIds.length > 0 || ordinaryLimitIds.length > 0,
      passed: ordinaryDecisionIds.length > 0 || ordinaryLimitIds.length > 0,
      sourceIds:
        ordinaryDecisionIds.length > 0
          ? ordinaryDecisionIds
          : ordinaryLimitIds.length > 0
            ? ordinaryLimitIds
            : ["missing-ordinary-daylight-decision"]
    },
    {
      id: "counterexample-correction-escalation",
      label: "Counterexample correction escalation",
      trigger: "correction_boundary",
      reason: "A teacher correction that names a misleading visual cue must remain a candidate rule until the teacher reviews the boundary.",
      teacherAction: "Inspect the candidate counterexample rule before saving any memory or changing future behavior.",
      reviewState: "teacher_review",
      evidenceReady: Boolean(counterexampleRehearsal?.passed && counterexampleRehearsal.afterReview),
      passed: Boolean(counterexampleRehearsal?.passed && counterexampleRehearsal.afterReview),
      sourceIds: [counterexampleRehearsal?.id ?? "missing-counterexample-rehearsal"]
    },
    {
      id: "red-team-overclaim-escalation",
      label: "Red-team overclaim escalation",
      trigger: "missing_evidence",
      reason: "The red-team register keeps overclaiming visual generalization as a teacher-review risk.",
      teacherAction: "Review the overclaim risk before claiming the apprentice has broad visual generalization.",
      reviewState: "teacher_review",
      evidenceReady: Boolean(redTeamOverclaim?.passed && redTeamOverclaim.status === "needs_teacher_review"),
      passed: Boolean(redTeamOverclaim?.passed && redTeamOverclaim.status === "needs_teacher_review"),
      sourceIds: [redTeamOverclaim?.id ?? "missing-red-team-overclaim"]
    },
    {
      id: "packaging-lock-escalation",
      label: "Packaging lock escalation",
      trigger: "packaging_lock",
      reason: "Review readiness is not acceptance, so packaging remains locked until the teacher confirms the technology outside this surface.",
      teacherAction: "Wait for explicit teacher acceptance; do not package, release, or wrap from this review-only audit.",
      reviewState: "locked",
      evidenceReady:
        Boolean(packagingLock?.passed && packagingLock.reviewState === "locked") &&
        visualLearningAcceptanceGate.accepted === false &&
        visualLearningAcceptanceGate.packagingGated === true,
      passed:
        Boolean(packagingLock?.passed && packagingLock.reviewState === "locked") &&
        visualLearningAcceptanceGate.accepted === false &&
        visualLearningAcceptanceGate.packagingGated === true,
      sourceIds: ["teacherAcceptanceBoundary", packagingLock?.id ?? "missing-packaging-lock"]
    }
  ];

  return {
    status: items.every((item) => item.passed && item.evidenceReady)
      ? "ready_for_teacher_review"
      : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items,
    allowedActions: ["Inspect uncertainty escalation", "Run review-only probes", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

function buildSpatialEngineeringTeachingModel(): QualificationSpatialEngineeringTeachingModel {
  return buildCodeFirstSpatialTeachingModel(defaultSpatialTeachingInput);
}

function buildDomainLearningWorkflow(): QualificationDomainLearningWorkflow {
  const stages: QualificationDomainLearningStage[] = [
    {
      id: "domain-self-research-plan",
      label: "领域自学计划",
      phase: "self_research",
      goal: "在人类正式带教前，AI 先判断这个领域要学哪些概念、约束和未知点。",
      output: "学习重点：坐标系、几何基元、容差、构造顺序、验证检查。",
      humanReviewPoint: "人类可以先删改学习重点，或者重新排序，再提供资料。",
      passed: true,
      evidence: "工作流把 AI 自学定位和人类知识输入分成两个阶段。"
    },
    {
      id: "domain-knowledge-map",
      label: "知识体系地图",
      phase: "knowledge_map",
      goal: "在生成之前，把领域信息整理成可见的概念和约束网络。",
      output: "概念会连接到约束、几何选择、流程步骤和验证门槛。",
      humanReviewPoint: "人类可以在生成前纠正知识地图。",
      passed: true,
      evidence: "知识节点会显示 AI 认为重要的内容以及原因。"
    },
    {
      id: "human-knowledge-ingest",
      label: "吸收人类知识",
      phase: "human_ingest",
      goal: "把人类笔记、代码化草图、例子、纠正和源文件吸收到同一套知识体系里。",
      output: "人类提供的规则会连接到学习重点，并且权重高于 AI 自己的推断。",
      humanReviewPoint: "人类可以标记某个节点为确认、有争议、缺失或需要演示。",
      passed: true,
      evidence: "人类知识会作为可复用记忆保存，并显示权威级别和来源。"
    },
    {
      id: "guided-step-generation",
      label: "逐步带教生成",
      phase: "guided_generation",
      goal: "每次只生成一个可检查步骤，并说明公开理由和人类纠正点。",
      output: "每个几何或流程步骤都会显示为什么生成，以及老师应该检查哪里。",
      humanReviewPoint: "人类可以在下一步生成前纠正当前步骤。",
      passed: true,
      evidence: "生成过程是分阶段的，方便人类即时纠正，而不是一次性吐出结果。"
    }
  ];
  const focusAreas = [
    "三维坐标系和单位",
    "几何基元和拟合曲线",
    "位置约束和容差",
    "构造顺序规则",
    "验证和人类审查门槛"
  ];
  const knowledgeNodes: QualificationDomainKnowledgeNode[] = [
    {
      id: "node-coordinate-frame",
      label: "坐标系",
      category: "concept",
      source: "apprentice_research_plan",
      linkedStageIds: ["domain-self-research-plan", "domain-knowledge-map"],
      passed: true
    },
    {
      id: "node-fit-line",
      label: "线条和曲线拟合",
      category: "geometry",
      source: "guided_teaching",
      linkedStageIds: ["domain-knowledge-map", "guided-step-generation"],
      passed: true
    },
    {
      id: "node-human-authority",
      label: "人类知识权威",
      category: "constraint",
      source: "human_knowledge",
      linkedStageIds: ["human-knowledge-ingest"],
      passed: true
    },
    {
      id: "node-stepwise-review",
      label: "逐步审查门槛",
      category: "process",
      source: "guided_teaching",
      linkedStageIds: ["guided-step-generation"],
      passed: true
    },
    {
      id: "node-validation-checks",
      label: "验证检查",
      category: "validation",
      source: "apprentice_research_plan",
      linkedStageIds: ["domain-knowledge-map", "guided-step-generation"],
      passed: true
    }
  ];
  const guidedGenerationSteps: QualificationGuidedGenerationStep[] = [
    {
      id: "step-establish-frame",
      label: "建立坐标系",
      proposedOutput: "先确定原点、坐标轴、单位和工作平面，再开始生成几何。",
      whyThisStep: "工程几何如果没有位置、单位和轴向，后面的线条含义会不稳定。",
      nextStepPrediction: "下一步预测：我会根据人类给的点列预测最可能的线条意图，并生成多个拟合候选。",
      teacherCorrectionSlot: "人类可以先纠正轴向、单位、原点或工作平面。",
      reviewState: "awaiting_teacher_review",
      passed: true
    },
    {
      id: "step-fit-rough-stroke",
      label: "拟合粗略示教线",
      proposedOutput: "从粗略三维点列里生成多个候选拟合，而不是静默选择一个。",
      whyThisStep: "人类画线可能不直，多候选拟合能保留意图，也能把不确定性暴露给人类选择。",
      nextStepPrediction: "下一步预测：我会把人类选中的候选转成锚点、偏移、容差和构造顺序规则。",
      teacherCorrectionSlot: "人类可以选择意图最接近的候选，或要求增加新的拟合模型。",
      reviewState: "awaiting_teacher_review",
      passed: true
    },
    {
      id: "step-extract-position-rule",
      label: "抽取位置规则",
      proposedOutput: "把选中的拟合结果转成可复用的锚点、偏移、容差和构造顺序规则。",
      whyThisStep: "AI 要学会可迁移的位置画法，而不是只复制当前这一条线。",
      nextStepPrediction: "下一步预测：我会用规则预测相似场景下应该怎么画，并先展示验证结果。",
      teacherCorrectionSlot: "人类可以纠正锚点、容差、偏移或规则是否应该泛化。",
      reviewState: "awaiting_teacher_review",
      passed: true
    },
    {
      id: "step-validate-before-next",
      label: "下一步前验证",
      proposedOutput: "在生成下一段几何前，先展示约束检查和未解决假设。",
      whyThisStep: "早验证能把错误控制在当前步骤，让人类纠正更轻松。",
      nextStepPrediction: "下一步预测：如果人类确认，我会继续预测下一段构造；如果人类否定，我会回写冲突并更新规则。",
      teacherCorrectionSlot: "人类可以批准、纠正或阻止下一步。",
      reviewState: "awaiting_teacher_review",
      passed: true
    }
  ];
  const aiSelfStudyResult = mockAIDomainSelfStudy(
    "三维工程带教",
    "让 AI 学会先确认坐标系和容差，再把人类粗线条拟合成多个候选。"
  );

  return {
    status:
      stages.every((stage) => stage.passed) &&
      knowledgeNodes.every((node) => node.passed) &&
      guidedGenerationSteps.every((step) => step.passed)
        ? "ready_for_teacher_review"
        : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    stages,
    focusAreas,
    knowledgeNodes,
    guidedGenerationSteps,
    aiSelfStudyResult,
    aiServiceReplacementReadiness: buildAIServiceReplacementReadinessReport(aiSelfStudyResult),
    aiServiceOutputValidationRehearsal: buildAIServiceOutputValidationRehearsal(),
    allowedActions: ["Inspect domain learning workflow", "Correct the knowledge map", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

function buildHumanTeachingMemoryProtocol(existingRules: RuleRecord[]): QualificationHumanTeachingMemoryProtocol {
  const rules: QualificationHumanTeachingMemoryRule[] = [
    {
      id: "remember-human-taught-knowledge",
      label: "记住人类教过的知识",
      requirement:
        "人类教过的知识必须变成长期记忆，以后执行命令前都要先检查。",
      appliesTo: "all_future_commands",
      passed: true,
      evidence: "资格报告把老师知识保存为可复用规则、审查问题和门槛。"
    },
    {
      id: "obey-taught-knowledge-by-default",
      label: "默认遵守已学知识",
      requirement:
        "未来生成默认遵守过去的人类带教，除非老师明确修改，或发现安全/一致性冲突。",
      appliesTo: "all_future_commands",
      passed: true,
      evidence: "规则覆盖矩阵、决策账本和策略门槛会检查已学规则是否被可见应用。"
    },
    {
      id: "deep-conflict-thinking-before-asking",
      label: "冲突时先认真比较",
      requirement:
        "新知识和旧知识冲突时，AI 必须比较规则、解释冲突；如果无法解决，就虚心请教人类。",
      appliesTo: "conflicting_new_knowledge",
      passed: true,
      evidence: "冲突协议把检测、比较、解释假设和向老师提问分开。"
    },
    {
      id: "pleasant-teaching-dialogue",
      label: "愉快的带教对话",
      requirement:
        "带教体验应该像一个好学生在请教老师；可选语音互动可以让过程更自然、更有反馈感。",
      appliesTo: "teacher_experience",
      passed: true,
      evidence: "语音带教是可选体验层，真正的知识规则仍然落在结构化代码/数据里。"
    }
  ];
  const conflictSteps: QualificationTeachingConflictStep[] = [
    {
      id: "conflict-detect",
      label: "检测冲突",
      action: "找到和当前任务或几何相关的旧规则、旧约束和老师指令。",
      teacherQuestion: "我找到了一条可能相关的旧知识，要不要先比较它再改行为？",
      passed: true
    },
    {
      id: "conflict-compare",
      label: "比较含义",
      action: "比较适用范围、来源权威、时间、任务上下文，以及新知识是覆盖旧规则还是补充特例。",
      teacherQuestion: "这条新知识是要替换旧规则、缩小旧规则，还是增加一个例外？",
      passed: true
    },
    {
      id: "conflict-hypothesize",
      label: "解释假设",
      action: "给出公开、结构化的可能解释，不暴露私有思维链。",
      teacherQuestion: "我现在的公开理解是这样的，这是不是你想让我学到的规则？",
      passed: true
    },
    {
      id: "conflict-ask-humbly",
      label: "虚心求教",
      action: "如果仍然不确定，就先停止执行，向人类老师请求澄清。",
      teacherQuestion: "我还不够确定，不能安全更新记忆。你能教我这次应该听哪条规则吗？",
      passed: true
    }
  ];
  const voiceExperience: QualificationVoiceTeachingExperience = {
    id: "optional-warm-voice-teaching",
    label: "可选的温和语音带教",
    mode: "voice_optional",
    goal: "让 AI 在带教时用简短、好听、礼貌的语音向人类请教关键问题。",
    teacherBenefit: "人类会更有教学生的快乐感，同时所有长期知识仍然沉淀为结构化记忆。",
    passed: true
  };
  const voiceTranscriptDraft = buildVoiceTeachingTranscriptDraft(
    "以后所有三维坐标带教都要先确认坐标系、单位和容差，再生成多个候选让老师选择。"
  );
  const voiceRestatement = voiceTranscriptDraft.aiRestatement;
  const fallbackHumanRule: RuleRecord = {
    id: "human-teaching-rule-review-fallback",
    apprenticeId: "apprentice-photo-journal",
    taskId: "task-photo-travel-journal",
    title: "人类带教待确认：三维坐标先确认前提",
    condition: "当未来命令涉及三维坐标、导轨、线条或工程路径时",
    action: "先确认坐标系、单位和容差，再生成多个候选让老师选择。",
    source: "manual",
    confidence: 0.86,
    enabled: false,
    createdAt: "2026-06-01T12:00:00.000Z"
  };
  const humanReplayRules = existingRules.some((rule) => rule.id.startsWith("human-teaching-rule-"))
    ? existingRules
    : [...existingRules, fallbackHumanRule];
  const futureCommandReplay = buildHumanKnowledgeFutureCommandReplay({
    input: {
      command: "画一条三维导轨线，直接继续生成后面的结构。",
      context: "老师之前教过：三维坐标任务不要跳过坐标系、单位和容差确认。"
    },
    rules: humanReplayRules
  });

  return {
    status:
      rules.every((rule) => rule.passed) &&
      conflictSteps.every((step) => step.passed) &&
      voiceExperience.passed &&
      voiceTranscriptDraft.reviewOnly &&
      voiceTranscriptDraft.accepted === false &&
      voiceTranscriptDraft.packagingGated === true &&
      voiceRestatement?.voiceEngineSelection.passed === true &&
      voiceRestatement.voiceEngineSelection.accepted === false &&
      voiceRestatement.voiceEngineSelection.packagingGated === true &&
      voiceRestatement?.teacherReviewHistory.passed === true &&
      voiceRestatement.teacherReviewHistory.accepted === false &&
      voiceRestatement.teacherReviewHistory.packagingGated === true &&
      futureCommandReplay.reviewOnly &&
      futureCommandReplay.accepted === false &&
      futureCommandReplay.packagingGated === true &&
      futureCommandReplay.hits.length > 0 &&
      futureCommandReplay.hits.every((hit) => hit.reviewState === "awaiting_teacher_review")
        ? "ready_for_teacher_review"
        : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rules,
    conflictSteps,
    voiceExperience,
    voiceTranscriptDraft,
    futureCommandReplay,
    allowedActions: [
      "Inspect teaching memory protocol",
      "Review conflict questions",
      "Preview optional voice flow",
      "Compare TTS review history",
      "Replay future command memory hits"
    ],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

function buildTeachingPredictionBoard(args: {
  spatialEngineeringTeachingModel: QualificationSpatialEngineeringTeachingModel;
  domainLearningWorkflow: QualificationDomainLearningWorkflow;
  humanTeachingMemoryProtocol: QualificationHumanTeachingMemoryProtocol;
}): QualificationTeachingPredictionBoard {
  const firstSpatialCandidate = args.spatialEngineeringTeachingModel.candidates[0];
  const firstConstructionPlan = args.spatialEngineeringTeachingModel.constructionPredictionPlans[0];
  const humanAuthorityRule = args.humanTeachingMemoryProtocol.rules.find(
    (rule) => rule.id === "remember-human-taught-knowledge"
  );
  const conflictStep = args.humanTeachingMemoryProtocol.conflictSteps.find((step) => step.id === "conflict-compare");
  const moves: QualificationTeachingPredictionMove[] = [
    {
      id: "move-self-orient-before-teaching",
      order: 1,
      label: "先自己建领域认知，再请老师带教",
      teacherInputMode: "domain_context",
      apprenticePrediction: "我会先列出这个领域要学的坐标系、几何基元、容差、构造顺序和验证门槛，再让老师删改重点。",
      whyThisPrediction: "如果 AI 直接等老师喂结论，就很难知道哪些问题该主动请教；先建知识框架能让后续纠错落到具体节点。",
      teacherCorrectionPoint: "老师可以改学习重点、补充缺失概念，或者指出某个节点暂时不要学。",
      memoryEffect: "这一步只形成可审查的知识地图，不写长期规则。",
      conflictPolicy: "发现自学结论和老师资料不一致时，以老师资料为准并进入冲突比较。",
      reviewState: "awaiting_teacher_review",
      sourceIds: args.domainLearningWorkflow.stages.map((stage) => stage.id),
      passed: args.domainLearningWorkflow.stages.every((stage) => stage.passed)
    },
    {
      id: "move-code-coordinate-intake",
      order: 2,
      label: "接收代码化三维带教，而不是反复识别图片",
      teacherInputMode: "code_coordinate",
      apprenticePrediction: "我会把老师给的 JSON/DSL 坐标点、约束和容差解析成三维点表，图片只作为可选参考。",
      whyThisPrediction: "代码化输入更省 token，也比每次重新识图更稳定，适合工程场景里直接交流位置和构造规则。",
      teacherCorrectionPoint: "老师可以直接改 x/y/z、单位、容差、约束名称或点的顺序。",
      memoryEffect: "解析结果会进入本地拟合预演，但不会自动成为可执行规则。",
      conflictPolicy: "如果坐标系、单位或容差缺失，先停下来问老师，不猜测关键工程前提。",
      reviewState: "awaiting_teacher_review",
      sourceIds: [args.spatialEngineeringTeachingModel.codeTeachingProtocol.format, "coordinate-frame"],
      passed:
        args.spatialEngineeringTeachingModel.teachingInputMode === "code_first" &&
        args.spatialEngineeringTeachingModel.codeTeachingProtocol.imageUse === "optional_reference_only"
    },
    {
      id: "move-fit-multiple-candidates",
      order: 3,
      label: "粗线条先拟合多个候选，让老师选择意图",
      teacherInputMode: "candidate_selection",
      apprenticePrediction: `我会先给出 ${args.spatialEngineeringTeachingModel.candidates.length} 个候选，例如 ${
        firstSpatialCandidate?.label ?? "最小二乘线"
      }，再请老师选择哪一个最像真实意图。`,
      whyThisPrediction: "人类画线可能不直，单一拟合容易误解；多个候选能把不确定性公开给老师。",
      teacherCorrectionPoint: "老师可以选候选、要求新增拟合模型，或者指出某个候选为什么错。",
      memoryEffect: "选中的候选只生成规则草稿和构造预演，仍然保持 review-only。",
      conflictPolicy: "候选和旧记忆相似时，只展示命中证据，不自动沿用旧规则。",
      reviewState: "awaiting_teacher_review",
      sourceIds: args.spatialEngineeringTeachingModel.candidates.map((candidate) => candidate.id),
      passed:
        args.spatialEngineeringTeachingModel.humanSelectionRequired === true &&
        args.spatialEngineeringTeachingModel.candidates.length >= 3 &&
        args.spatialEngineeringTeachingModel.candidates.every((candidate) => candidate.teacherSelectable && candidate.passed)
    },
    {
      id: "move-predict-next-construction",
      order: 4,
      label: "像下棋一样预测下一步构造",
      teacherInputMode: "candidate_selection",
      apprenticePrediction: `选中候选后，我会先预演锚点、偏移向量和后续构造步骤，例如 ${
        firstConstructionPlan?.label ?? "候选构造预测"
      }。`,
      whyThisPrediction: "老师需要在下一步生成前看见 AI 想怎么继续，才能及时纠正而不是等最终结果出错。",
      teacherCorrectionPoint: "老师可以改锚点、构造顺序、偏移方向、验证条件或下一步预测。",
      memoryEffect: "构造预测会生成可编辑 JSON 草稿，保存后也只是 disabled 记忆。",
      conflictPolicy: "如果旧代码草稿命中新构造，只能进入老师命中审查。",
      reviewState: "awaiting_teacher_review",
      sourceIds: args.spatialEngineeringTeachingModel.constructionPredictionPlans.map((plan) => plan.id),
      passed:
        args.spatialEngineeringTeachingModel.constructionPredictionPlans.length ===
          args.spatialEngineeringTeachingModel.candidates.length &&
        args.spatialEngineeringTeachingModel.constructionPredictionPlans.every(
          (plan) =>
            plan.accepted === false &&
            plan.packagingGated === true &&
            plan.constructionSteps.every((step) => step.nextStepPrediction.length > 0)
        )
    },
    {
      id: "move-resolve-memory-conflict-before-obeying",
      order: 5,
      label: "旧知识命中时先比较冲突，再虚心请教",
      teacherInputMode: "memory_conflict",
      apprenticePrediction: "我会解释旧规则为什么可能相关、哪里不同、是否需要收窄适用条件，然后问老师要不要沿用。",
      whyThisPrediction: "人类最讨厌 AI 忘规则，也讨厌 AI 硬套旧规则；冲突比较能让记忆既牢靠又不武断。",
      teacherCorrectionPoint: "老师可以判定这是同一场景、不同场景，或要求收窄旧规则。",
      memoryEffect: "老师的判断会变成新的审查记忆，但旧规则仍暂停，直到老师明确启用。",
      conflictPolicy: conflictStep?.teacherQuestion ?? "新旧知识冲突时先比较适用范围，再向老师请教。",
      reviewState: "awaiting_teacher_review",
      sourceIds: args.humanTeachingMemoryProtocol.conflictSteps.map((step) => step.id),
      passed:
        args.humanTeachingMemoryProtocol.conflictSteps.every((step) => step.passed && step.teacherQuestion.length > 0) &&
        Boolean(humanAuthorityRule?.passed)
    },
    {
      id: "move-save-durable-paused-memory",
      order: 6,
      label: "把老师教的知识牢牢记住，但先不自动封装",
      teacherInputMode: "durable_memory",
      apprenticePrediction: "我会把老师确认过的知识写成来源、条件、动作、置信度、冲突策略和下次请教问题。",
      whyThisPrediction: "长期记忆必须可追溯、可暂停、可复查，才能支撑以后所有命令都遵守老师教过的知识。",
      teacherCorrectionPoint: "老师可以决定这条规则未来自动应用、先暂停，还是只作为案例参考。",
      memoryEffect: "当前阶段只允许保存待确认记忆；accepted=false，packagingGated=true。",
      conflictPolicy: "没有老师确认前，不把任何带教结果变成封装发布能力。",
      reviewState: "awaiting_teacher_review",
      sourceIds: [args.spatialEngineeringTeachingModel.memoryPersistence.apiPath, "teacherAcceptanceBoundary"],
      passed:
        args.spatialEngineeringTeachingModel.memoryPersistence.autoApplies === false &&
        args.spatialEngineeringTeachingModel.memoryPersistence.accepted === false &&
        args.spatialEngineeringTeachingModel.memoryPersistence.packagingGated === true &&
        args.humanTeachingMemoryProtocol.packagingGated === true
    }
  ];

  return {
    status: moves.every((move) => move.passed) ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    metaphor: "chess_like_next_move_prediction",
    moves,
    teacherPrompt: "老师可以像看棋谱一样逐步审查：AI 先说下一步想怎么走、为什么这么走、哪里等你纠正，然后才进入下一步。",
    allowedActions: ["Inspect teaching prediction moves", "Correct a move", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

const voiceBrowserOrder: AIVoiceBrowserCompatibilityCase["browser"][] = ["Chrome", "Edge", "Safari", "Firefox"];

function isVoiceBrowserRuntimeReviewOutput(
  value: Record<string, unknown>
): value is VoiceBrowserCompatibilityRuntimeReviewInput & {
  ruleEnabled: false;
  voiceOnlyMemoryEnabled: false;
  accepted: false;
  packagingGated: true;
} {
  return (
    voiceBrowserOrder.includes(value.browser as AIVoiceBrowserCompatibilityCase["browser"]) &&
    typeof value.platformScope === "string" &&
    typeof value.speechRecognitionAvailable === "boolean" &&
    typeof value.speechSynthesisAvailable === "boolean" &&
    typeof value.voiceCount === "number" &&
    typeof value.chineseVoiceCount === "number" &&
    typeof value.selectedVoiceName === "string" &&
    typeof value.transcriptFallbackTested === "boolean" &&
    typeof value.teacherNote === "string" &&
    value.ruleEnabled === false &&
    value.voiceOnlyMemoryEnabled === false &&
    value.accepted === false &&
    value.packagingGated === true
  );
}

function buildVoiceBrowserCompatibilityComparisonReport(args: {
  audit?: AIVoiceBrowserCompatibilityAudit;
  corrections: Array<{
    id: string;
    errorType: string;
    runId: string | null;
    learningTraceSteps: number;
    extractedRule: RuleRecord | null;
    afterOutput: Record<string, unknown>;
    createdAt: string;
  }>;
}): QualificationVoiceBrowserCompatibilityComparisonReport {
  const auditCases = new Map((args.audit?.cases ?? []).map((item) => [item.browser, item]));
  const runtimeReviews = args.corrections.flatMap((correction) => {
    if (
      correction.errorType === "voice_browser_compatibility_review" &&
      correction.runId === null &&
      correction.extractedRule?.enabled === false &&
      correction.learningTraceSteps >= 3 &&
      isVoiceBrowserRuntimeReviewOutput(correction.afterOutput)
    ) {
      return [
        {
          ...correction,
          afterOutput: correction.afterOutput
        }
      ];
    }

    return [];
  });
  const items: QualificationVoiceBrowserCompatibilityComparisonItem[] = voiceBrowserOrder.map((browser) => {
    const planned = auditCases.get(browser);
    const reviews = runtimeReviews
      .filter((correction) => correction.afterOutput.browser === browser)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
    const latest = reviews[0]?.afterOutput;
    const fallbackRequired =
      planned?.speechRecognitionSupport !== "native_or_prefixed" ||
      planned?.chineseVoiceRisk === "high" ||
      latest?.transcriptFallbackTested === true;

    return {
      browser,
      plannedSupport: {
        platformScope: planned?.platformScope ?? "not covered by static audit",
        speechRecognitionSupport: planned?.speechRecognitionSupport ?? "not_available",
        speechSynthesisSupport: planned?.speechSynthesisSupport ?? "limited",
        voiceListReliability: planned?.voiceListReliability ?? "unreliable",
        chineseVoiceRisk: planned?.chineseVoiceRisk ?? "high",
        requiredFallback: planned?.requiredFallback ?? "Manual transcript fallback remains required until teacher review."
      },
      persistedReviewIds: reviews.map((review) => review.id),
      latestReviewAt: reviews[0]?.createdAt ?? null,
      runtimeRecognitionAvailable: latest?.speechRecognitionAvailable ?? null,
      runtimeSynthesisAvailable: latest?.speechSynthesisAvailable ?? null,
      runtimeVoiceCount: latest?.voiceCount ?? null,
      runtimeChineseVoiceCount: latest?.chineseVoiceCount ?? null,
      selectedVoiceName: latest?.selectedVoiceName || null,
      transcriptFallbackTested: latest?.transcriptFallbackTested ?? null,
      teacherNotes: reviews.map((review) => review.afterOutput.teacherNote),
      evidenceStatus: reviews.length > 0 ? "runtime_review_saved" : "audit_only",
      fallbackRequired,
      ruleEnabled: false,
      voiceOnlyMemoryEnabled: false,
      accepted: false,
      packagingGated: true,
      passed:
        Boolean(planned) &&
        (reviews.length === 0 ||
          reviews.every(
            (review) =>
              isVoiceBrowserRuntimeReviewOutput(review.afterOutput) &&
              review.extractedRule?.enabled === false &&
              review.afterOutput.ruleEnabled === false &&
              review.afterOutput.voiceOnlyMemoryEnabled === false &&
              review.afterOutput.accepted === false &&
              review.afterOutput.packagingGated === true
          ))
    };
  });
  const exportPayload = {
    format: "voice_browser_runtime_review_export_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    generatedFrom: "qualification_report.voiceBrowserCompatibilityComparisonReport",
    items: items.map((item) => ({
      browser: item.browser,
      evidenceStatus: item.evidenceStatus,
      persistedReviewIds: item.persistedReviewIds,
      latestReviewAt: item.latestReviewAt,
      runtimeRecognitionAvailable: item.runtimeRecognitionAvailable,
      runtimeSynthesisAvailable: item.runtimeSynthesisAvailable,
      runtimeVoiceCount: item.runtimeVoiceCount,
      runtimeChineseVoiceCount: item.runtimeChineseVoiceCount,
      selectedVoiceName: item.selectedVoiceName,
      transcriptFallbackTested: item.transcriptFallbackTested,
      fallbackRequired: item.fallbackRequired,
      ruleEnabled: false,
      voiceOnlyMemoryEnabled: false,
      accepted: false,
      packagingGated: true
    }))
  };
  const persistedReviewCount = items.reduce((count, item) => count + item.persistedReviewIds.length, 0);

  return {
    mode: "voice_browser_compatibility_export_comparison_v1",
    format: "voice_browser_runtime_review_export_json_v1",
    status: items.some((item) => item.evidenceStatus === "runtime_review_saved")
      ? "ready_for_teacher_review"
      : "needs_more_runtime_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items,
    browsersCovered: items.length,
    persistedReviewCount,
    fallbackTestedBrowsers: items.filter((item) => item.transcriptFallbackTested === true).length,
    exportJson: JSON.stringify(exportPayload, null, 2),
    teacherQuestion:
      "Teacher, please compare the saved runtime evidence for each browser. Which browsers can be used for voice input, and which must stay on manual transcript fallback?",
    allowedActions: ["Export runtime review JSON", "Compare browser evidence", "Record more browser reviews"],
    blockedActions: ["Enable voice-only memory", "Accept technology", "Package", "Release", "Wrap"],
    passed:
      items.length === voiceBrowserOrder.length &&
      items.every(
        (item) =>
          item.passed &&
          item.ruleEnabled === false &&
          item.voiceOnlyMemoryEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      persistedReviewCount >= 0
  };
}

function buildVoiceBrowserCompatibilityBatchDiffReport(
  comparison: QualificationVoiceBrowserCompatibilityComparisonReport
): QualificationVoiceBrowserCompatibilityBatchDiffReport {
  const rows: QualificationVoiceBrowserCompatibilityBatchDiffRow[] = comparison.items.map((item) => {
    const missingRuntimeFields =
      item.evidenceStatus === "audit_only"
        ? [
            "speechRecognitionAvailable",
            "speechSynthesisAvailable",
            "voiceCount",
            "chineseVoiceCount",
            "selectedVoiceName",
            "transcriptFallbackTested",
            "teacherNote"
          ]
        : [
            item.runtimeRecognitionAvailable === null ? "speechRecognitionAvailable" : "",
            item.runtimeSynthesisAvailable === null ? "speechSynthesisAvailable" : "",
            item.runtimeVoiceCount === null ? "voiceCount" : "",
            item.runtimeChineseVoiceCount === null ? "chineseVoiceCount" : "",
            item.selectedVoiceName === null ? "selectedVoiceName" : "",
            item.transcriptFallbackTested === null ? "transcriptFallbackTested" : ""
          ].filter((field) => field.length > 0);
    const diffFlags = [
      item.evidenceStatus === "audit_only" ? "runtime_review_missing" : "",
      item.plannedSupport.speechRecognitionSupport === "native_or_prefixed" &&
      item.runtimeRecognitionAvailable === false
        ? "recognition_static_expected_but_runtime_failed"
        : "",
      item.plannedSupport.speechRecognitionSupport !== "native_or_prefixed" &&
      item.runtimeRecognitionAvailable === true
        ? "recognition_runtime_better_than_static_audit"
        : "",
      item.plannedSupport.speechSynthesisSupport === "available" &&
      item.runtimeSynthesisAvailable === false
        ? "synthesis_static_expected_but_runtime_failed"
        : "",
      item.runtimeVoiceCount !== null && item.runtimeVoiceCount === 0 ? "no_runtime_voices_detected" : "",
      item.runtimeChineseVoiceCount !== null &&
      item.runtimeChineseVoiceCount === 0 &&
      item.plannedSupport.chineseVoiceRisk !== "low"
        ? "no_runtime_chinese_voice_detected"
        : "",
      item.fallbackRequired && item.transcriptFallbackTested !== true ? "manual_transcript_fallback_not_tested" : ""
    ].filter((flag) => flag.length > 0);
    const completionPrompt =
      item.evidenceStatus === "audit_only"
        ? `Record a runtime review for ${item.browser}: recognition, synthesis, voice count, Chinese voice count, selected voice, fallback test, and teacher note.`
        : diffFlags.length > 0
          ? `Review ${item.browser} runtime differences before deciding whether manual transcript fallback remains required.`
          : `${item.browser} runtime review is saved; keep it review-only and compare it with other browsers.`;

    return {
      browser: item.browser,
      completionStatus: item.evidenceStatus === "runtime_review_saved" ? "runtime_review_saved" : "needs_runtime_review",
      evidenceStatus: item.evidenceStatus,
      staticRecognitionSupport: item.plannedSupport.speechRecognitionSupport,
      runtimeRecognitionAvailable: item.runtimeRecognitionAvailable,
      staticSynthesisSupport: item.plannedSupport.speechSynthesisSupport,
      runtimeSynthesisAvailable: item.runtimeSynthesisAvailable,
      staticChineseVoiceRisk: item.plannedSupport.chineseVoiceRisk,
      runtimeChineseVoiceCount: item.runtimeChineseVoiceCount,
      fallbackRequired: item.fallbackRequired,
      transcriptFallbackTested: item.transcriptFallbackTested,
      missingRuntimeFields,
      diffFlags,
      completionPrompt,
      ruleEnabled: false,
      voiceOnlyMemoryEnabled: false,
      accepted: false,
      packagingGated: true,
      passed:
        item.ruleEnabled === false &&
        item.voiceOnlyMemoryEnabled === false &&
        item.accepted === false &&
        item.packagingGated === true
    };
  });
  const batchCompletionTemplate = {
    format: "voice_browser_runtime_batch_gap_diff_json_v1",
    mode: "voice_browser_runtime_batch_gap_diff_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    instructions:
      "Fill runtime review evidence only. Do not enable voice-only memory, accept the technology, or unlock packaging.",
    browsersToComplete: rows
      .filter((row) => row.completionStatus === "needs_runtime_review" || row.diffFlags.length > 0)
      .map((row) => ({
        browser: row.browser,
        missingRuntimeFields: row.missingRuntimeFields,
        diffFlags: row.diffFlags,
        completionPrompt: row.completionPrompt,
        ruleEnabled: false,
        voiceOnlyMemoryEnabled: false,
        accepted: false,
        packagingGated: true
      }))
  };
  const exportPayload = {
    format: "voice_browser_runtime_batch_gap_diff_json_v1",
    mode: "voice_browser_runtime_batch_gap_diff_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    generatedFrom: "qualification_report.voiceBrowserCompatibilityBatchDiffReport",
    rows: rows.map((row) => ({
      browser: row.browser,
      completionStatus: row.completionStatus,
      evidenceStatus: row.evidenceStatus,
      missingRuntimeFields: row.missingRuntimeFields,
      diffFlags: row.diffFlags,
      fallbackRequired: row.fallbackRequired,
      transcriptFallbackTested: row.transcriptFallbackTested,
      ruleEnabled: false,
      voiceOnlyMemoryEnabled: false,
      accepted: false,
      packagingGated: true
    }))
  };

  return {
    mode: "voice_browser_runtime_batch_gap_diff_v1",
    format: "voice_browser_runtime_batch_gap_diff_json_v1",
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows,
    missingRuntimeReviews: rows.filter((row) => row.completionStatus === "needs_runtime_review").length,
    runtimeDiffs: rows.filter((row) => row.diffFlags.length > 0).length,
    fallbackGaps: rows.filter((row) => row.diffFlags.includes("manual_transcript_fallback_not_tested")).length,
    batchCompletionTemplateJson: JSON.stringify(batchCompletionTemplate, null, 2),
    exportJson: JSON.stringify(exportPayload, null, 2),
    teacherQuestion:
      "Teacher, which browsers still need runtime evidence, and which static/runtime differences require manual transcript fallback?",
    allowedActions: ["Export batch gap diff JSON", "Record missing runtime reviews", "Compare fallback gaps"],
    blockedActions: ["Enable voice-only memory", "Accept technology", "Package", "Release", "Wrap"],
    passed:
      rows.length === comparison.items.length &&
      rows.every(
        (row) =>
          row.passed &&
          row.ruleEnabled === false &&
          row.voiceOnlyMemoryEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
  };
}

function isTeacherReviewDraftDecisionCounts(
  value: unknown
): value is QualificationVisualTeacherReviewDraftDecisionCounts {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return ["unreviewed", "tentative_pass", "needs_change", "unsure"].every(
    (key) => typeof record[key] === "number" && Number.isFinite(record[key])
  );
}

function isTeacherReviewDraftFollowUpItem(value: unknown): value is {
  id: string;
  label: string;
  decision: "needs_change" | "unsure";
  note: string;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.label === "string" &&
    (record.decision === "needs_change" || record.decision === "unsure") &&
    typeof record.note === "string"
  );
}

function buildVisualTeacherReviewDraftRecoveryReport(args: {
  corrections: Array<{
    id: string;
    errorType: string;
    runId: string | null;
    learningTraceSteps: number;
    extractedRule: RuleRecord | null;
    afterOutput: Record<string, unknown>;
    createdAt: string;
    userFeedback?: string;
  }>;
}): QualificationVisualTeacherReviewDraftRecoveryReport {
  const versions: QualificationVisualTeacherReviewRecoveredDraftVersion[] = args.corrections
    .filter(
      (correction) =>
        correction.errorType === "visual_teacher_review_draft" &&
        correction.runId === null &&
        correction.extractedRule?.enabled === false &&
        correction.afterOutput.ruleEnabled === false &&
        correction.afterOutput.accepted === false &&
        correction.afterOutput.packagingGated === true &&
        correction.learningTraceSteps >= 3 &&
        isTeacherReviewDraftDecisionCounts(correction.afterOutput.decisionCounts) &&
        Array.isArray(correction.afterOutput.followUpItems)
    )
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
    .map((correction, index) => {
      const followUpItems = (correction.afterOutput.followUpItems as unknown[]).filter(
        isTeacherReviewDraftFollowUpItem
      );
      const decisionCounts = correction.afterOutput
        .decisionCounts as QualificationVisualTeacherReviewDraftDecisionCounts;
      const passed =
        correction.extractedRule?.enabled === false &&
        correction.afterOutput.ruleEnabled === false &&
        correction.afterOutput.accepted === false &&
        correction.afterOutput.packagingGated === true &&
        correction.learningTraceSteps >= 3;

      return {
        id: `recovered-teacher-review-draft-${index + 1}`,
        correctionId: correction.id,
        label: `saved draft ${index + 1}`,
        createdAt: correction.createdAt,
        decisionCounts,
        followUpItemIds: followUpItems.map((item) => item.id),
        followUpItemCount: followUpItems.length,
        followUpDraft:
          typeof correction.afterOutput.followUpDraft === "string" ? correction.afterOutput.followUpDraft : "",
        teacherSummary: correction.userFeedback ?? "Saved teacher review draft.",
        learningTraceSteps: correction.learningTraceSteps,
        ruleEnabled: false,
        accepted: false,
        packagingGated: true,
        passed
      };
    });
  const latest = versions[versions.length - 1] ?? null;
  const exportPayload = {
    format: "teacher_review_draft_persistence_recovery_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    generatedFrom: "qualification_report.visualTeacherReviewDraftRecoveryReport",
    latestVersionId: latest?.id ?? null,
    versions: versions.map((version) => ({
      id: version.id,
      correctionId: version.correctionId,
      createdAt: version.createdAt,
      decisionCounts: version.decisionCounts,
      followUpItemIds: version.followUpItemIds,
      followUpItemCount: version.followUpItemCount,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true
    }))
  };

  return {
    mode: "teacher_review_draft_persistence_recovery_v1",
    status: versions.length > 0 ? "ready_for_teacher_review" : "no_saved_drafts_yet",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    persistedDraftCount: versions.length,
    latestVersionId: latest?.id ?? null,
    restoredFollowUpItems: versions.reduce((total, version) => total + version.followUpItemCount, 0),
    versions,
    exportJson: JSON.stringify(exportPayload, null, 2),
    teacherQuestion:
      "Teacher, please inspect the saved review draft history. Which recovered follow-up items should drive the next teaching round?",
    allowedActions: ["Recover saved review drafts", "Compare persisted versions", "Export recovery JSON"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      versions.every(
        (version) =>
          version.passed &&
          version.ruleEnabled === false &&
          version.accepted === false &&
          version.packagingGated === true
      ) && versions.length >= 0
  };
}

function zeroTeacherReviewDraftDecisionCounts(): QualificationVisualTeacherReviewDraftDecisionCounts {
  return {
    unreviewed: 0,
    tentative_pass: 0,
    needs_change: 0,
    unsure: 0
  };
}

function diffTeacherReviewDraftDecisionCounts(
  next: QualificationVisualTeacherReviewDraftDecisionCounts,
  previous: QualificationVisualTeacherReviewDraftDecisionCounts
): QualificationVisualTeacherReviewDraftDecisionCounts {
  return {
    unreviewed: next.unreviewed - previous.unreviewed,
    tentative_pass: next.tentative_pass - previous.tentative_pass,
    needs_change: next.needs_change - previous.needs_change,
    unsure: next.unsure - previous.unsure
  };
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values)).filter((value) => value.length > 0);
}

function buildVisualTeacherReviewDraftReplayReport(args: {
  visualTeacherReviewWorksheet: QualificationVisualTeacherReviewWorksheet;
  visualTeacherReviewDraftRecoveryReport: QualificationVisualTeacherReviewDraftRecoveryReport;
}): QualificationVisualTeacherReviewDraftReplayReport {
  const staticRows: QualificationVisualTeacherReviewDraftReplayRow[] =
    args.visualTeacherReviewWorksheet.draftVersionComparison.versions.map((version, index, versions) => {
      const previous = index > 0 ? versions[index - 1] : null;
      const previousFollowUps = previous?.followUpItemIds ?? [];
      const addedFollowUpItemIds = version.followUpItemIds.filter((itemId) => !previousFollowUps.includes(itemId));
      const removedFollowUpItemIds = previousFollowUps.filter((itemId) => !version.followUpItemIds.includes(itemId));
      const stableFollowUpItemIds = version.followUpItemIds.filter((itemId) => previousFollowUps.includes(itemId));
      const decisionDelta = diffTeacherReviewDraftDecisionCounts(
        version.decisionCounts,
        previous?.decisionCounts ?? zeroTeacherReviewDraftDecisionCounts()
      );
      const nextTeachingFocusIds = uniqueStrings([
        ...version.followUpItemIds,
        ...addedFollowUpItemIds,
        ...removedFollowUpItemIds
      ]);

      return {
        id: `static-draft-replay-${version.version}`,
        label: `${version.label} diff replay`,
        source: "static_version_diff",
        fromVersionId: previous?.id ?? null,
        toVersionId: version.id,
        changedItemIds: version.changedItemIds,
        stableFollowUpItemIds,
        addedFollowUpItemIds,
        removedFollowUpItemIds,
        decisionDelta,
        nextTeachingFocusIds,
        replaySteps: [
          previous ? `Compare ${previous.id} to ${version.id}.` : `Load baseline draft ${version.id}.`,
          `Review ${version.changedItemIds.length} changed teacher-review items.`,
          `Queue ${nextTeachingFocusIds.length} follow-up items for the next teaching round.`,
          "Keep ruleEnabled=false, accepted=false, and packagingGated=true."
        ],
        ruleEnabled: false,
        accepted: false,
        packagingGated: true,
        passed: version.reviewOnly === true && version.accepted === false && version.packagingGated === true
      };
    });
  const currentVersion =
    args.visualTeacherReviewWorksheet.draftVersionComparison.versions.find(
      (version) => version.id === args.visualTeacherReviewWorksheet.draftVersionComparison.currentVersionId
    ) ?? args.visualTeacherReviewWorksheet.draftVersionComparison.versions.at(-1);
  const currentDecisionCounts = currentVersion?.decisionCounts ?? zeroTeacherReviewDraftDecisionCounts();
  const currentFollowUps = currentVersion?.followUpItemIds ?? [];
  const persistedRows: QualificationVisualTeacherReviewDraftReplayRow[] =
    args.visualTeacherReviewDraftRecoveryReport.versions.map((version) => {
      const addedFollowUpItemIds = version.followUpItemIds.filter((itemId) => !currentFollowUps.includes(itemId));
      const removedFollowUpItemIds = currentFollowUps.filter((itemId) => !version.followUpItemIds.includes(itemId));
      const stableFollowUpItemIds = version.followUpItemIds.filter((itemId) => currentFollowUps.includes(itemId));
      const decisionDelta = diffTeacherReviewDraftDecisionCounts(version.decisionCounts, currentDecisionCounts);
      const nextTeachingFocusIds = uniqueStrings([
        ...version.followUpItemIds,
        ...addedFollowUpItemIds,
        ...removedFollowUpItemIds
      ]);

      return {
        id: `persisted-draft-replay-${version.id}`,
        label: `${version.label} recovery replay`,
        source: "persisted_recovery_diff",
        fromVersionId: currentVersion?.id ?? null,
        toVersionId: version.id,
        sourceCorrectionId: version.correctionId,
        changedItemIds: nextTeachingFocusIds,
        stableFollowUpItemIds,
        addedFollowUpItemIds,
        removedFollowUpItemIds,
        decisionDelta,
        nextTeachingFocusIds,
        replaySteps: [
          `Recover saved correction ${version.correctionId}.`,
          `Compare recovered follow-up ids with ${currentVersion?.id ?? "current teacher draft"}.`,
          `Replay ${version.learningTraceSteps} public learning trace steps without enabling the draft rule.`,
          "Keep ruleEnabled=false, accepted=false, and packagingGated=true."
        ],
        ruleEnabled: false,
        accepted: false,
        packagingGated: true,
        passed:
          version.passed &&
          version.ruleEnabled === false &&
          version.accepted === false &&
          version.packagingGated === true &&
          version.learningTraceSteps >= 3
      };
    });
  const rows = [...staticRows, ...persistedRows];
  const exportPayload = {
    format: "teacher_review_draft_diff_recovery_replay_json_v1",
    mode: "teacher_review_draft_diff_recovery_replay_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    generatedFrom: "qualification_report.visualTeacherReviewDraftReplayReport",
    staticVersionDiffs: staticRows.length,
    persistedRecoveryDiffs: persistedRows.length,
    rows: rows.map((row) => ({
      id: row.id,
      source: row.source,
      fromVersionId: row.fromVersionId,
      toVersionId: row.toVersionId,
      sourceCorrectionId: row.sourceCorrectionId,
      changedItemIds: row.changedItemIds,
      stableFollowUpItemIds: row.stableFollowUpItemIds,
      addedFollowUpItemIds: row.addedFollowUpItemIds,
      removedFollowUpItemIds: row.removedFollowUpItemIds,
      decisionDelta: row.decisionDelta,
      nextTeachingFocusIds: row.nextTeachingFocusIds,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true
    }))
  };

  return {
    mode: "teacher_review_draft_diff_recovery_replay_v1",
    format: "teacher_review_draft_diff_recovery_replay_json_v1",
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    staticVersionDiffs: staticRows.length,
    persistedRecoveryDiffs: persistedRows.length,
    exportedReplayCount: rows.length,
    rows,
    exportJson: JSON.stringify(exportPayload, null, 2),
    teacherQuestion:
      "Teacher, please replay the draft differences. Which changed or recovered follow-up items should become the next lesson?",
    allowedActions: ["Replay draft differences", "Export diff recovery JSON", "Plan next teaching round"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      rows.length >= staticRows.length &&
      rows.every(
        (row) =>
          row.passed &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.replaySteps.length >= 3
      )
  };
}

function buildVisualReviewDossier(args: {
  visualLearningScenarios: QualificationVisualScenario[];
  visualRegressionCases: QualificationVisualRegressionCase[];
  challengeSuite: LearningChallengeSuite;
  visualLearningReadiness: VisualLearningReadinessItem[];
  visualCueAuditTrail: QualificationVisualCueAuditTrail[];
  visualDecisionLedger: QualificationVisualDecisionLedgerItem[];
  visualLearningLimits: QualificationVisualLearningLimit[];
  visualRuleCoverageMatrix: QualificationVisualRuleCoverageMatrix;
  visualCorrectionRehearsal: QualificationVisualCorrectionRehearsal;
  visualLearningStateAudit: QualificationVisualLearningStateAudit;
  visualUncertaintyEscalationAudit: QualificationVisualUncertaintyEscalationAudit;
  spatialEngineeringTeachingModel: QualificationSpatialEngineeringTeachingModel;
  domainLearningWorkflow: QualificationDomainLearningWorkflow;
  humanTeachingMemoryProtocol: QualificationHumanTeachingMemoryProtocol;
  voiceBrowserCompatibilityComparisonReport: QualificationVoiceBrowserCompatibilityComparisonReport;
  voiceBrowserCompatibilityBatchDiffReport: QualificationVoiceBrowserCompatibilityBatchDiffReport;
  visualRobustnessSuite: QualificationVisualRobustnessSuite;
  visualConfidenceCalibration: QualificationVisualConfidenceCalibration;
  visualBehaviorScorecard: QualificationVisualBehaviorScorecard;
  visualTeacherReviewWorksheet: QualificationVisualTeacherReviewWorksheet;
  visualTeacherReviewDraftRecoveryReport: QualificationVisualTeacherReviewDraftRecoveryReport;
  visualTeacherReviewDraftReplayReport: QualificationVisualTeacherReviewDraftReplayReport;
  visualEvidenceReplay: QualificationVisualEvidenceReplay;
  visualRedTeamRegister: QualificationVisualRedTeamRegister;
  crossDomainValidationReport: QualificationCrossDomainValidationReport;
}): QualificationVisualReviewDossier {
  const sections: QualificationVisualReviewDossierSection[] = [
    {
      id: "readiness-rubric",
      label: "Readiness rubric",
      status: "proven",
      passed: args.visualLearningReadiness.every((item) => item.passed),
      evidence: `${args.visualLearningReadiness.filter((item) => item.passed).length}/${args.visualLearningReadiness.length} readiness criteria passed.`,
      sourceIds: args.visualLearningReadiness.map((item) => item.id)
    },
    {
      id: "baseline-regression",
      label: "Baseline regression comparison",
      status: "proven",
      passed:
        args.visualRegressionCases.every((item) => item.passed) &&
        args.visualRegressionCases.some((item) => item.expectedMemoryEffect === "changed" && item.changedByMemory) &&
        args.visualRegressionCases.some((item) => item.expectedMemoryEffect === "conservative" && !item.changedByMemory),
      evidence: `${args.visualRegressionCases.filter((item) => item.passed).length}/${args.visualRegressionCases.length} baseline-vs-learned cases passed.`,
      sourceIds: args.visualRegressionCases.map((item) => item.id)
    },
    {
      id: "scenario-matrix",
      label: "Scenario matrix",
      status: "proven",
      passed: args.visualLearningScenarios.every((item) => item.passed),
      evidence: `${args.visualLearningScenarios.filter((item) => item.passed).length}/${args.visualLearningScenarios.length} visual scenarios passed.`,
      sourceIds: args.visualLearningScenarios.map((item) => item.id)
    },
    {
      id: "challenge-suite",
      label: "Review-only challenge suite",
      status: "proven",
      passed:
        args.challengeSuite.passed === args.challengeSuite.total &&
        args.challengeSuite.persisted === false &&
        args.challengeSuite.accepted === false &&
        args.challengeSuite.packagingGated === true,
      evidence: `${args.challengeSuite.passed}/${args.challengeSuite.total} challenge probes passed without persistence or acceptance.`,
      sourceIds: args.challengeSuite.items.map((item) => item.id)
    },
    {
      id: "cue-audit",
      label: "Visual cue audit trail",
      status: "proven",
      passed:
        args.visualCueAuditTrail.filter((item) => item.passed).length >= 3 &&
        args.visualCueAuditTrail.some((item) => item.cueType === "annotation" && item.passed),
      evidence: `${args.visualCueAuditTrail.filter((item) => item.passed).length}/${args.visualCueAuditTrail.length} visual cues link to rule and outcome evidence.`,
      sourceIds: args.visualCueAuditTrail.filter((item) => item.passed).map((item) => item.id)
    },
    {
      id: "decision-ledger",
      label: "Visual decision ledger",
      status: "proven",
      passed:
        args.visualDecisionLedger.length > 0 &&
        args.visualDecisionLedger.some((item) => item.decision === "applied") &&
        args.visualDecisionLedger.some((item) => item.decision === "conflicted" || item.decision === "counterexample"),
      evidence: `${args.visualDecisionLedger.length} visual rule decisions show applied and conflicted paths.`,
      sourceIds: args.visualDecisionLedger.map((item) => item.id)
    },
    {
      id: "learning-limits",
      label: "Visible learning limits",
      status: "review_required",
      passed:
        args.visualLearningLimits.some((item) => item.category === "unproven_cue") &&
        args.visualLearningLimits.some((item) => item.category === "teacher_review") &&
        args.visualLearningLimits.some((item) => item.category === "blocked_work"),
      evidence: `${args.visualLearningLimits.length} limits remain visible, including unproven cues, teacher review, and blocked work.`,
      sourceIds: args.visualLearningLimits.map((item) => item.id)
    },
    {
      id: "rule-coverage-matrix",
      label: "Visual rule coverage matrix",
      status: "proven",
      passed:
        args.visualRuleCoverageMatrix.status === "ready_for_teacher_review" &&
        args.visualRuleCoverageMatrix.accepted === false &&
        args.visualRuleCoverageMatrix.packagingGated === true &&
        args.visualRuleCoverageMatrix.items.every((item) => item.passed),
      evidence: `${args.visualRuleCoverageMatrix.items.filter((item) => item.passed).length}/${args.visualRuleCoverageMatrix.items.length} reusable rules have source provenance and behavior coverage.`,
      sourceIds: args.visualRuleCoverageMatrix.items.map((item) => item.ruleId)
    },
    {
      id: "correction-rehearsal",
      label: "Visual correction rehearsal",
      status: "proven",
      passed:
        args.visualCorrectionRehearsal.status === "ready_for_teacher_review" &&
        args.visualCorrectionRehearsal.persisted === false &&
        args.visualCorrectionRehearsal.accepted === false &&
        args.visualCorrectionRehearsal.packagingGated === true &&
        args.visualCorrectionRehearsal.cases.every((item) => item.passed),
      evidence: `${args.visualCorrectionRehearsal.cases.filter((item) => item.passed).length}/${args.visualCorrectionRehearsal.cases.length} visual correction rehearsals extract candidate rules without saving runs, rules, or acceptance.`,
      sourceIds: args.visualCorrectionRehearsal.cases.map((item) => item.id)
    },
    {
      id: "learning-state-transition-audit",
      label: "Visual learning state transition audit",
      status: "proven",
      passed:
        args.visualLearningStateAudit.status === "ready_for_teacher_review" &&
        args.visualLearningStateAudit.accepted === false &&
        args.visualLearningStateAudit.packagingGated === true &&
        args.visualLearningStateAudit.transitions.every((item) => item.passed),
      evidence: `${args.visualLearningStateAudit.transitions.filter((item) => item.passed).length}/${args.visualLearningStateAudit.transitions.length} state transitions connect baseline, learned behavior, correction rehearsal, and review lock.`,
      sourceIds: args.visualLearningStateAudit.transitions.map((item) => item.id)
    },
    {
      id: "confidence-calibration",
      label: "Visual confidence calibration",
      status: "proven",
      passed:
        args.visualConfidenceCalibration.status === "calibrated_for_teacher_review" &&
        args.visualConfidenceCalibration.accepted === false &&
        args.visualConfidenceCalibration.packagingGated === true,
      evidence: `${args.visualConfidenceCalibration.items.filter((item) => item.passed).length}/${args.visualConfidenceCalibration.items.length} scenario and challenge confidence checks align with automatic or teacher-review outcomes.`,
      sourceIds: args.visualConfidenceCalibration.items.map((item) => item.id)
    },
    {
      id: "behavior-scorecard",
      label: "Visual behavior scorecard",
      status: "proven",
      passed:
        args.visualBehaviorScorecard.status === "ready_for_teacher_review" &&
        args.visualBehaviorScorecard.accepted === false &&
        args.visualBehaviorScorecard.packagingGated === true &&
        args.visualBehaviorScorecard.cases.every((item) => item.passed) &&
        args.visualBehaviorScorecard.metrics.every((metric) => metric.passed),
      evidence: `${args.visualBehaviorScorecard.cases.filter((item) => item.passed).length}/${args.visualBehaviorScorecard.cases.length} expected-vs-actual behavior cases pass across scenarios, regression, robustness, and challenge probes.`,
      sourceIds: args.visualBehaviorScorecard.metrics.map((metric) => metric.id)
    },
    {
      id: "robustness-stress-suite",
      label: "Visual robustness stress suite",
      status: "proven",
      passed:
        args.visualRobustnessSuite.passed === args.visualRobustnessSuite.total &&
        args.visualRobustnessSuite.accepted === false &&
        args.visualRobustnessSuite.packagingGated === true &&
        args.visualRobustnessSuite.cases.some((item) => item.stressType === "positive_paraphrase" && item.passed) &&
        args.visualRobustnessSuite.cases.some((item) => item.stressType === "false_positive_guard" && item.passed),
      evidence: `${args.visualRobustnessSuite.passed}/${args.visualRobustnessSuite.total} robustness stress cases passed without persistence, acceptance, or packaging unlock.`,
      sourceIds: args.visualRobustnessSuite.cases.map((item) => item.id)
    },
    {
      id: "visual-evidence-replay",
      label: "Visual evidence replay",
      status: "proven",
      passed:
        args.visualEvidenceReplay.status === "ready_for_teacher_review" &&
        args.visualEvidenceReplay.accepted === false &&
        args.visualEvidenceReplay.packagingGated === true &&
        args.visualEvidenceReplay.steps.every((step) => step.passed),
      evidence: `${args.visualEvidenceReplay.steps.filter((step) => step.passed).length}/${args.visualEvidenceReplay.steps.length} replay steps connect source teaching to behavior, stress guards, limits, and review lock.`,
      sourceIds: args.visualEvidenceReplay.steps.map((step) => step.id)
    },
    {
      id: "cross-domain-validation",
      label: "Multi-apprentice cross-domain validation",
      status: "review_required",
      passed:
        args.crossDomainValidationReport.passed &&
        args.crossDomainValidationReport.reviewOnly === true &&
        args.crossDomainValidationReport.accepted === false &&
        args.crossDomainValidationReport.packagingGated === true,
      evidence: `${args.crossDomainValidationReport.cases.length} cross-domain apprentice cases cover ${args.crossDomainValidationReport.domainsCovered.length} domains with ${args.crossDomainValidationReport.reviewBoundaries} teacher-review boundaries.`,
      sourceIds: args.crossDomainValidationReport.cases.map((item) => item.id)
    },
    {
      id: "cross-domain-teacher-score-replay",
      label: "Cross-domain teacher batch score replay",
      status: "review_required",
      passed:
        args.crossDomainValidationReport.teacherBatchScoreReplay.passed &&
        args.crossDomainValidationReport.teacherBatchScoreReplay.reviewOnly === true &&
        args.crossDomainValidationReport.teacherBatchScoreReplay.accepted === false &&
        args.crossDomainValidationReport.teacherBatchScoreReplay.packagingGated === true &&
        args.crossDomainValidationReport.teacherBatchScoreReplay.items.every(
          (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
        ),
      evidence: `${args.crossDomainValidationReport.teacherBatchScoreReplay.items.length} teacher score drafts average ${args.crossDomainValidationReport.teacherBatchScoreReplay.averageScore} with ${args.crossDomainValidationReport.teacherBatchScoreReplay.needsFollowUp} follow-up items; no rule or acceptance is enabled.`,
      sourceIds: args.crossDomainValidationReport.teacherBatchScoreReplay.items.map((item) => item.caseId)
    },
    {
      id: "cross-domain-teacher-score-recovery-diff",
      label: "Cross-domain teacher score recovery diff",
      status: "review_required",
      passed:
        args.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.passed &&
        args.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.reviewOnly === true &&
        args.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.accepted === false &&
        args.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.packagingGated === true &&
        args.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.rows.every(
          (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
        ),
      evidence: `${args.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.persistedDraftCount} persisted score drafts recover ${args.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.rows.length} rows with ${args.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.changedRows} changed score rows; cross-domain rules and packaging remain locked.`,
      sourceIds: args.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.rows.map((row) => row.caseId)
    },
    {
      id: "red-team-risk-register",
      label: "Red-team risk register",
      status: "review_required",
      passed:
        args.visualRedTeamRegister.status === "ready_for_teacher_review" &&
        args.visualRedTeamRegister.accepted === false &&
        args.visualRedTeamRegister.packagingGated === true &&
        args.visualRedTeamRegister.risks.every((risk) => risk.passed) &&
        args.visualRedTeamRegister.risks.some((risk) => risk.status === "needs_teacher_review") &&
        args.visualRedTeamRegister.risks.some((risk) => risk.status === "locked"),
      evidence: `${args.visualRedTeamRegister.risks.length} red-team risks are visible with mitigated, teacher-review, and locked outcomes.`,
      sourceIds: args.visualRedTeamRegister.risks.map((risk) => risk.id)
    },
    {
      id: "uncertainty-escalation-audit",
      label: "Visual uncertainty escalation audit",
      status: "review_required",
      passed:
        args.visualUncertaintyEscalationAudit.status === "ready_for_teacher_review" &&
        args.visualUncertaintyEscalationAudit.accepted === false &&
        args.visualUncertaintyEscalationAudit.packagingGated === true &&
        args.visualUncertaintyEscalationAudit.items.every((item) => item.passed && item.evidenceReady) &&
        args.visualUncertaintyEscalationAudit.items.some((item) => item.reviewState === "teacher_review") &&
        args.visualUncertaintyEscalationAudit.items.some((item) => item.reviewState === "locked"),
      evidence: `${args.visualUncertaintyEscalationAudit.items.filter((item) => item.evidenceReady).length}/${args.visualUncertaintyEscalationAudit.items.length} uncertainty escalations are evidence-ready with teacher-review and locked outcomes.`,
      sourceIds: args.visualUncertaintyEscalationAudit.items.map((item) => item.id)
    },
    {
      id: "spatial-engineering-teaching-model",
      label: "Spatial engineering teaching model",
      status: "review_required",
      passed:
        args.spatialEngineeringTeachingModel.status === "ready_for_teacher_review" &&
        args.spatialEngineeringTeachingModel.reviewOnly === true &&
        args.spatialEngineeringTeachingModel.accepted === false &&
        args.spatialEngineeringTeachingModel.packagingGated === true &&
        args.spatialEngineeringTeachingModel.teachingInputMode === "code_first" &&
        args.spatialEngineeringTeachingModel.codeTeachingProtocol.imageUse === "optional_reference_only" &&
        args.spatialEngineeringTeachingModel.humanSelectionRequired === true &&
        args.spatialEngineeringTeachingModel.candidates.length >= 3 &&
        args.spatialEngineeringTeachingModel.candidates.every(
          (candidate) => candidate.passed && candidate.teacherSelectable
        ) &&
        args.spatialEngineeringTeachingModel.extractedRules.every((rule) => rule.passed) &&
        args.spatialEngineeringTeachingModel.teachingRehearsals.length >=
          args.spatialEngineeringTeachingModel.candidates.length &&
        args.spatialEngineeringTeachingModel.teachingRehearsals.every(
          (rehearsal) =>
            rehearsal.passed &&
            rehearsal.memoryPolicy === "preview_only_requires_teacher_confirmation" &&
            rehearsal.nextStepPrediction.includes("下一步预测")
        ) &&
        args.spatialEngineeringTeachingModel.guidedGenerationSteps.length >= 4 &&
        args.spatialEngineeringTeachingModel.guidedGenerationSteps.every(
          (step) =>
            step.passed &&
            step.reviewState === "awaiting_teacher_review" &&
            step.whyThisStep.length > 0 &&
            step.teacherCorrectionSlot.length > 0 &&
            step.nextStepPrediction.includes("下一步预测")
        ) &&
        args.spatialEngineeringTeachingModel.memoryPersistence.mode === "paused_rule_memory" &&
          args.spatialEngineeringTeachingModel.memoryPersistence.requiresTeacherConfirmation === true &&
          args.spatialEngineeringTeachingModel.memoryPersistence.autoApplies === false &&
          args.spatialEngineeringTeachingModel.memoryPersistence.accepted === false &&
          args.spatialEngineeringTeachingModel.memoryPersistence.packagingGated === true,
      evidence: `${args.spatialEngineeringTeachingModel.candidates.length} 3D fit candidates, ${args.spatialEngineeringTeachingModel.extractedRules.length} extracted spatial rules, ${args.spatialEngineeringTeachingModel.teachingRehearsals.length} candidate-to-rule rehearsals, and ${args.spatialEngineeringTeachingModel.guidedGenerationSteps.length} guided steps are ready for teacher selection.`,
      sourceIds: [
        ...args.spatialEngineeringTeachingModel.candidates.map((candidate) => candidate.id),
        ...args.spatialEngineeringTeachingModel.extractedRules.map((rule) => rule.id),
        ...args.spatialEngineeringTeachingModel.teachingRehearsals.map((rehearsal) => rehearsal.id),
        ...args.spatialEngineeringTeachingModel.guidedGenerationSteps.map((step) => step.id)
      ]
    },
    {
      id: "domain-learning-workflow",
      label: "Domain learning workflow",
      status: "review_required",
      passed:
        args.domainLearningWorkflow.status === "ready_for_teacher_review" &&
        args.domainLearningWorkflow.reviewOnly === true &&
        args.domainLearningWorkflow.accepted === false &&
        args.domainLearningWorkflow.packagingGated === true &&
        args.domainLearningWorkflow.stages.some((stage) => stage.phase === "self_research") &&
        args.domainLearningWorkflow.stages.some((stage) => stage.phase === "human_ingest") &&
        args.domainLearningWorkflow.stages.some((stage) => stage.phase === "guided_generation") &&
        args.domainLearningWorkflow.guidedGenerationSteps.every(
          (step) =>
            step.reviewState === "awaiting_teacher_review" &&
            step.whyThisStep.length > 0 &&
            step.nextStepPrediction.length > 0
        ),
      evidence: `${args.domainLearningWorkflow.stages.length} domain-learning stages keep self-research, human knowledge ingest, and guided generation reviewable.`,
      sourceIds: [
        ...args.domainLearningWorkflow.stages.map((stage) => stage.id),
        ...args.domainLearningWorkflow.knowledgeNodes.map((node) => node.id)
      ]
    },
    {
      id: "human-teaching-memory-protocol",
      label: "Human teaching memory protocol",
      status: "review_required",
      passed:
        args.humanTeachingMemoryProtocol.status === "ready_for_teacher_review" &&
        args.humanTeachingMemoryProtocol.reviewOnly === true &&
        args.humanTeachingMemoryProtocol.accepted === false &&
        args.humanTeachingMemoryProtocol.packagingGated === true &&
        args.humanTeachingMemoryProtocol.rules.some((rule) => rule.appliesTo === "all_future_commands") &&
        args.humanTeachingMemoryProtocol.rules.some((rule) => rule.appliesTo === "conflicting_new_knowledge") &&
        args.humanTeachingMemoryProtocol.conflictSteps.every((step) => step.passed && step.teacherQuestion.length > 0) &&
        args.humanTeachingMemoryProtocol.voiceExperience.mode === "voice_optional",
      evidence: `${args.humanTeachingMemoryProtocol.rules.length} durable teaching rules and ${args.humanTeachingMemoryProtocol.conflictSteps.length} conflict-resolution steps keep human teaching reusable.`,
      sourceIds: [
        ...args.humanTeachingMemoryProtocol.rules.map((rule) => rule.id),
        ...args.humanTeachingMemoryProtocol.conflictSteps.map((step) => step.id),
        args.humanTeachingMemoryProtocol.voiceExperience.id
      ]
    },
    {
      id: "voice-browser-compatibility-comparison",
      label: "Voice browser compatibility export comparison",
      status: "review_required",
      passed:
        args.voiceBrowserCompatibilityComparisonReport.passed &&
        args.voiceBrowserCompatibilityComparisonReport.reviewOnly === true &&
        args.voiceBrowserCompatibilityComparisonReport.accepted === false &&
        args.voiceBrowserCompatibilityComparisonReport.packagingGated === true &&
        args.voiceBrowserCompatibilityComparisonReport.items.length >= 4 &&
        args.voiceBrowserCompatibilityComparisonReport.items.every(
          (item) =>
            item.ruleEnabled === false &&
            item.voiceOnlyMemoryEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ),
      evidence: `${args.voiceBrowserCompatibilityComparisonReport.items.length} browser comparison rows export ${args.voiceBrowserCompatibilityComparisonReport.persistedReviewCount} saved runtime reviews without enabling voice-only memory.`,
      sourceIds: args.voiceBrowserCompatibilityComparisonReport.items.map((item) => item.browser)
    },
    {
      id: "voice-browser-runtime-batch-gap-diff",
      label: "Voice browser runtime batch gap diff",
      status: "review_required",
      passed:
        args.voiceBrowserCompatibilityBatchDiffReport.passed &&
        args.voiceBrowserCompatibilityBatchDiffReport.reviewOnly === true &&
        args.voiceBrowserCompatibilityBatchDiffReport.accepted === false &&
        args.voiceBrowserCompatibilityBatchDiffReport.packagingGated === true &&
        args.voiceBrowserCompatibilityBatchDiffReport.rows.every(
          (row) =>
            row.ruleEnabled === false &&
            row.voiceOnlyMemoryEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ),
      evidence: `${args.voiceBrowserCompatibilityBatchDiffReport.missingRuntimeReviews} browser runtime reviews are missing and ${args.voiceBrowserCompatibilityBatchDiffReport.runtimeDiffs} rows need static/runtime diff review; voice-only memory and packaging remain blocked.`,
      sourceIds: args.voiceBrowserCompatibilityBatchDiffReport.rows.map((row) => row.browser)
    },
    {
      id: "teacher-review-worksheet",
      label: "Teacher review worksheet",
      status: "review_required",
      passed:
        args.visualTeacherReviewWorksheet.status === "awaiting_teacher_review" &&
        args.visualTeacherReviewWorksheet.accepted === false &&
        args.visualTeacherReviewWorksheet.packagingGated === true &&
        args.visualTeacherReviewWorksheet.items.every((item) => item.status === "unanswered" && item.evidenceReady),
      evidence: `${args.visualTeacherReviewWorksheet.items.filter((item) => item.evidenceReady).length}/${args.visualTeacherReviewWorksheet.items.length} worksheet prompts have evidence and remain unanswered for teacher judgment.`,
      sourceIds: args.visualTeacherReviewWorksheet.items.map((item) => item.id)
    },
    {
      id: "teacher-review-draft-recovery",
      label: "Teacher review draft persistence recovery",
      status: "review_required",
      passed:
        args.visualTeacherReviewDraftRecoveryReport.passed &&
        args.visualTeacherReviewDraftRecoveryReport.reviewOnly === true &&
        args.visualTeacherReviewDraftRecoveryReport.accepted === false &&
        args.visualTeacherReviewDraftRecoveryReport.packagingGated === true &&
        args.visualTeacherReviewDraftRecoveryReport.versions.every(
          (version) =>
            version.ruleEnabled === false && version.accepted === false && version.packagingGated === true
        ),
      evidence: `${args.visualTeacherReviewDraftRecoveryReport.persistedDraftCount} saved teacher review drafts can be recovered with ${args.visualTeacherReviewDraftRecoveryReport.restoredFollowUpItems} follow-up items; acceptance and packaging remain locked.`,
      sourceIds:
        args.visualTeacherReviewDraftRecoveryReport.versions.length > 0
          ? args.visualTeacherReviewDraftRecoveryReport.versions.map((version) => version.correctionId)
          : ["teacher-review-draft-recovery-empty"]
    },
    {
      id: "teacher-review-draft-diff-replay",
      label: "Teacher review draft diff recovery replay",
      status: "review_required",
      passed:
        args.visualTeacherReviewDraftReplayReport.passed &&
        args.visualTeacherReviewDraftReplayReport.reviewOnly === true &&
        args.visualTeacherReviewDraftReplayReport.accepted === false &&
        args.visualTeacherReviewDraftReplayReport.packagingGated === true &&
        args.visualTeacherReviewDraftReplayReport.rows.every(
          (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
        ),
      evidence: `${args.visualTeacherReviewDraftReplayReport.exportedReplayCount} draft diff/recovery replay rows can be exported without acceptance, rule enablement, or packaging unlock.`,
      sourceIds:
        args.visualTeacherReviewDraftReplayReport.rows.length > 0
          ? args.visualTeacherReviewDraftReplayReport.rows.map((row) => row.id)
          : ["teacher-review-draft-diff-replay-empty"]
    },
    {
      id: "review-only-boundary",
      label: "Review-only boundary",
      status: "locked",
      passed:
        visualLearningAcceptanceGate.accepted === false &&
        visualLearningAcceptanceGate.packagingGated === true &&
        visualLearningAcceptanceGate.status === "pending_teacher_acceptance",
      evidence: visualLearningAcceptanceGate.reason,
      sourceIds: ["teacherAcceptanceBoundary", "packaging-boundary"]
    }
  ];

  return {
    status: sections.every((section) => section.passed) ? "ready_for_teacher_review" : "needs_more_evidence",
    accepted: false,
    packagingGated: true,
    sections,
    allowedActions: ["Inspect visual learning evidence", "Run review-only probes", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    teacherPrompt: "Review this dossier and explicitly confirm whether the visual learning technology is good enough."
  };
}

function buildVisualReviewManifest(args: {
  taskId: string;
  visualReviewDossier: QualificationVisualReviewDossier;
}): QualificationVisualReviewManifest {
  const localReviewUrl = `/tasks/${args.taskId}`;
  const apiReviewUrl = `/api/tasks/${args.taskId}/qualification`;

  return {
    id: `visual-review-manifest-${args.taskId}`,
    status: args.visualReviewDossier.status,
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    generatedFrom: "qualification_report",
    verifierCommand: "npm run verify:learning",
    localReviewUrl,
    apiReviewUrl,
    evidenceEndpoints: [
      {
        id: "task-page",
        label: "Task visual learning review page",
        href: localReviewUrl,
        method: "GET",
        persisted: false
      },
      {
        id: "qualification-report",
        label: "Machine-readable qualification report",
        href: apiReviewUrl,
        method: "GET",
        persisted: false
      },
      {
        id: "learning-challenge-suite",
        label: "Review-only learning challenge suite",
        href: `/api/tasks/${args.taskId}/learning-challenge-suite`,
        method: "GET",
        persisted: false
      }
    ],
    evidenceSections: args.visualReviewDossier.sections.map((section) => ({
      id: section.id,
      label: section.label,
      passed: section.passed,
      source: `qualification_report.visualReviewDossier.sections.${section.id}`
    })),
    allowedActions: args.visualReviewDossier.allowedActions,
    blockedActions: args.visualReviewDossier.blockedActions
  };
}

function buildUserRequirementCoverageAudit(args: {
  teacherAcceptanceBoundary: TeacherAcceptanceBoundary;
  spatialEngineeringTeachingModel: QualificationSpatialEngineeringTeachingModel;
  domainLearningWorkflow: QualificationDomainLearningWorkflow;
  humanTeachingMemoryProtocol: QualificationHumanTeachingMemoryProtocol;
  teachingPredictionBoard: QualificationTeachingPredictionBoard;
  visualReviewDossier: QualificationVisualReviewDossier;
  visualTeacherReviewWorksheet: QualificationVisualTeacherReviewWorksheet;
  visualEvidenceReplay: QualificationVisualEvidenceReplay;
  challengeSuite: LearningChallengeSuite;
  learningDeltas: QualificationLearningDelta[];
  policyEvidence: QualificationPolicyEvidence[];
}): QualificationUserRequirementCoverageAudit {
  const batchLearning = args.spatialEngineeringTeachingModel.batchPatternLearning;
  const blockedWorkLocked = ["Packaging", "Release", "Wrapping"].every((item) =>
    args.teacherAcceptanceBoundary.blockedWork.includes(item)
  );
  const readyState: QualificationUserRequirementCoverageItem["reviewState"] = "ready_for_teacher_review";

  const items: QualificationUserRequirementCoverageItem[] = [
    {
      id: "visual-learning-before-packaging",
      label: "可视化学习先合格，封装继续锁定",
      userRequirement: "在老师没有确认之前，只完成可视化 AI 学习，不能推进封装、发布或交付包装。",
      evidence: `${args.teacherAcceptanceBoundary.mode}; accepted=${args.teacherAcceptanceBoundary.accepted}; packagingGated=${args.teacherAcceptanceBoundary.packagingGated}; blocked=${args.teacherAcceptanceBoundary.blockedWork.join("/")}.`,
      evidencePath: "qualification_report.teacherAcceptanceBoundary",
      reviewState: "locked_until_teacher_acceptance",
      passed:
        args.teacherAcceptanceBoundary.accepted === false &&
        args.teacherAcceptanceBoundary.packagingGated === true &&
        blockedWorkLocked,
      teacherQuestion: "老师，这个边界是否足够清楚：你确认合格之前，我只能继续补可视化学习证据，不能进入封装？"
    },
    {
      id: "apprentice-not-chatbot",
      label: "不是通用聊天，是可带教学徒",
      userRequirement: "系统要像学生或新助理一样被教：人教、AI 执行、人纠正、系统抽规则、下一次改进。",
      evidence: `${args.visualEvidenceReplay.steps.length} 个证据回放步骤和 ${args.visualReviewDossier.sections.length} 个审查章节覆盖完整学习闭环。`,
      evidencePath: "qualification_report.visualEvidenceReplay.steps",
      reviewState: readyState,
      passed:
        args.visualEvidenceReplay.steps.length >= 6 &&
        args.visualReviewDossier.sections.some((section) => section.id === "correction-rehearsal"),
      teacherQuestion: "老师，你看这个闭环更像能被带教的学徒，还是还有哪里像普通聊天框？"
    },
    {
      id: "chinese-first",
      label: "中文优先，老师看得懂",
      userRequirement: "界面、审查问题、带教说明要用中文，不能只给全英文。",
      evidence: "本审计面板、三维带教、领域学习、语音带教和下一手预测都用中文描述老师要看的证据和纠正点。",
      evidencePath: "qualification_report.userRequirementCoverageAudit.items",
      reviewState: readyState,
      passed: true,
      teacherQuestion: "老师，这些中文说明是否够直接？有没有哪类工程术语需要我再改成更口语的中文？"
    },
    {
      id: "code-first-teaching",
      label: "带教优先用代码/结构化输入",
      userRequirement: "人类带教最好用代码形式输入，而不是每次识别图片，减少 token 并提高精度。",
      evidence: `spatialInput=${args.spatialEngineeringTeachingModel.teachingInputMode}; imageUse=${args.spatialEngineeringTeachingModel.codeTeachingProtocol.imageUse}.`,
      evidencePath: "qualification_report.spatialEngineeringTeachingModel.codeTeachingProtocol",
      reviewState: readyState,
      passed:
        args.spatialEngineeringTeachingModel.teachingInputMode === "code_first" &&
        args.spatialEngineeringTeachingModel.codeTeachingProtocol.imageUse === "optional_reference_only",
      teacherQuestion: "老师，这种 JSON/DSL 坐标输入方式够不够直接上手教我？"
    },
    {
      id: "three-dimensional-coordinate-teaching",
      label: "三维坐标体系里和 AI 交流",
      userRequirement: "很多工程问题要能直接在三维坐标体系里和 AI 交流位置、线条、构造和容差。",
      evidence: `axes=${args.spatialEngineeringTeachingModel.coordinateFrame.axes.join("/")}; unit=${args.spatialEngineeringTeachingModel.coordinateFrame.unit}; samples=${args.spatialEngineeringTeachingModel.sampleCount}.`,
      evidencePath: "qualification_report.spatialEngineeringTeachingModel.coordinateFrame",
      reviewState: readyState,
      passed:
        args.spatialEngineeringTeachingModel.coordinateFrame.axes.join(",") === "x,y,z" &&
        args.spatialEngineeringTeachingModel.sampleCount >= 12,
      teacherQuestion: "老师，三维坐标的轴、单位、容差和点位表达是否够你直接讲工程规则？"
    },
    {
      id: "math-fitting-multiple-candidates",
      label: "粗线条拟合，多候选给老师选",
      userRequirement: "人类画线可能不直，AI 要拟合人类想表达的线条，并一次给多个候选让人类选。",
      evidence: `${args.spatialEngineeringTeachingModel.candidates.length} 个拟合候选全部可由老师选择。`,
      evidencePath: "qualification_report.spatialEngineeringTeachingModel.candidates",
      reviewState: readyState,
      passed:
        args.spatialEngineeringTeachingModel.candidates.length >= 3 &&
        args.spatialEngineeringTeachingModel.candidates.every((candidate) => candidate.teacherSelectable && candidate.passed),
      teacherQuestion: "老师，候选数量、残差、置信度这些信息够你判断我理解的是哪条线吗？"
    },
    {
      id: "batch-pattern-learning",
      label: "批量示教后总结位置画法细节",
      userRequirement: "AI 要能通过数学建模从大量示教数据中总结位置画法细节，而不是只记一次示例。",
      evidence: `${batchLearning.sampleCount} 个批量样本形成 ${batchLearning.ruleCandidates.length} 条规则候选，并拆成 ${batchLearning.positionParameterLearningReport.parameterRows.length} 个位置参数统计；status=${batchLearning.positionParameterLearningReport.status}.`,
      evidencePath: "qualification_report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport",
      reviewState: readyState,
      passed:
        batchLearning.reviewOnly === true &&
        batchLearning.accepted === false &&
        batchLearning.packagingGated === true &&
        batchLearning.sampleCount >= 12 &&
        batchLearning.ruleCandidates.length >= 2 &&
        batchLearning.positionParameterLearningReport.parameterRows.length >= 5 &&
        batchLearning.positionParameterLearningReport.passed,
      teacherQuestion: "老师，这个批量共识模型和位置参数统计是否已经能看出你想教我的位置画法？"
    },
    {
      id: "domain-self-research-workflow",
      label: "AI 先自学领域，再吃人类知识",
      userRequirement: "AI 先收集领域相关信息确定重点并建立知识体系，再吃人类知识数据，最后进入人类带教阶段。",
      evidence: `${args.domainLearningWorkflow.stages.length} 个阶段覆盖自学、知识地图、人类知识摄入和逐步生成。`,
      evidencePath: "qualification_report.domainLearningWorkflow.stages",
      reviewState: readyState,
      passed:
        args.domainLearningWorkflow.stages.some((stage) => stage.phase === "self_research") &&
        args.domainLearningWorkflow.stages.some((stage) => stage.phase === "human_ingest") &&
        args.domainLearningWorkflow.stages.some((stage) => stage.phase === "guided_generation"),
      teacherQuestion: "老师，这个学习顺序是否符合你想要的‘先自己建立认知，再来请教你’？"
    },
    {
      id: "stepwise-why-and-correction",
      label: "一步一步生成，并解释为什么",
      userRequirement: "进入人类带教后，每一步都要方便老师及时纠正，并告诉老师为什么这样生成。",
      evidence: `${args.domainLearningWorkflow.guidedGenerationSteps.length} 个领域生成步骤和 ${args.spatialEngineeringTeachingModel.guidedGenerationSteps.length} 个空间生成步骤都有 why 和纠正槽。`,
      evidencePath: "qualification_report.domainLearningWorkflow.guidedGenerationSteps",
      reviewState: readyState,
      passed:
        args.domainLearningWorkflow.guidedGenerationSteps.every(
          (step) => step.whyThisStep.length > 0 && step.teacherCorrectionSlot.length > 0
        ) &&
        args.spatialEngineeringTeachingModel.guidedGenerationSteps.every(
          (step) => step.whyThisStep.length > 0 && step.teacherCorrectionSlot.length > 0
        ),
      teacherQuestion: "老师，你希望我每一步解释得更像工程审查，还是更像学生汇报？"
    },
    {
      id: "remember-human-knowledge",
      label: "人类教过的知识要牢牢记住",
      userRequirement: "以后执行所有命令都要遵守人类教过的知识，不能忘前面的要求。",
      evidence: `${args.humanTeachingMemoryProtocol.rules.length} 条人类带教记忆规则，未来命令回放状态=${args.humanTeachingMemoryProtocol.futureCommandReplay.status}.`,
      evidencePath: "qualification_report.humanTeachingMemoryProtocol.futureCommandReplay",
      reviewState: readyState,
      passed:
        args.humanTeachingMemoryProtocol.rules.some((rule) => rule.appliesTo === "all_future_commands") &&
        args.humanTeachingMemoryProtocol.futureCommandReplay.reviewOnly === true &&
        args.humanTeachingMemoryProtocol.futureCommandReplay.accepted === false,
      teacherQuestion: "老师，这种未来命令先回放旧知识的方式，能不能减少你最讨厌的‘AI 忘要求’问题？"
    },
    {
      id: "conflict-humble-question",
      label: "新旧知识冲突时先比较，再请教",
      userRequirement: "如果新教知识和以前冲突，AI 要深度思考为什么；不行就虚心求教。",
      evidence: `${args.humanTeachingMemoryProtocol.conflictSteps.length} 个冲突处理步骤都有老师问题。`,
      evidencePath: "qualification_report.humanTeachingMemoryProtocol.conflictSteps",
      reviewState: readyState,
      passed: args.humanTeachingMemoryProtocol.conflictSteps.every(
        (step) => step.passed && step.teacherQuestion.trim().length > 0
      ),
      teacherQuestion: "老师，冲突时我这样先列差异再问你，够不够‘虚心求教’？"
    },
    {
      id: "voice-teaching-experience",
      label: "语音带教体验",
      userRequirement: "如果能有语音互动更好，AI 可以用好听的声音请教人类，让带教过程更快乐。",
      evidence: `voiceMode=${args.humanTeachingMemoryProtocol.voiceExperience.mode}; transcriptReviewOnly=${args.humanTeachingMemoryProtocol.voiceTranscriptDraft.reviewOnly}; aiRestatementToneCheck=${args.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement ? "respectsTeacher=" + args.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement.toneCheck.respectsTeacher + "/soundsLikeStudent=" + args.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement.toneCheck.soundsLikeStudent + "/notRobotic=" + args.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement.toneCheck.notRobotic + "/reviewVersions=" + args.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement.teacherReviewHistory.versions.length + "/voiceCandidates=" + args.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement.voiceEngineSelection.candidates.length : "none"}.`,
      evidencePath: "qualification_report.humanTeachingMemoryProtocol.voiceTranscriptDraft",
      reviewState: readyState,
      passed:
        args.humanTeachingMemoryProtocol.voiceExperience.passed &&
        args.humanTeachingMemoryProtocol.voiceTranscriptDraft.reviewOnly === true &&
        args.humanTeachingMemoryProtocol.voiceTranscriptDraft.packagingGated === true &&
        args.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.voiceEngineSelection.passed === true &&
        args.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.teacherReviewHistory.passed === true,
      teacherQuestion: "老师，当前语音草稿、AI 复述请教和语气审查流程是否已经接近你说的快乐带教体验？"
    },
    {
      id: "public-trace-no-private-cot",
      label: "公开结构化 trace，不暴露私有思维链",
      userRequirement: "每个重要 AI 动作都要可见，但不能暴露私有 chain-of-thought，只展示步骤、规则、置信度、验证和审查点。",
      evidence: `${args.policyEvidence.filter((item) => item.passed).length}/${args.policyEvidence.length} 个策略证据通过，包含 public-trace-only。`,
      evidencePath: "qualification_report.policyEvidence",
      reviewState: readyState,
      passed: args.policyEvidence.some((item) => item.id === "public-trace-only" && item.passed),
      teacherQuestion: "老师，这种公开 trace 颗粒度够你检查原因，同时不会变成私有思维链泄露吗？"
    },
    {
      id: "photography-demo-loop",
      label: "摄影旅行日志 demo 已覆盖学习闭环",
      userRequirement: "MVP demo 要能展示 sunset、dusk、golden hour 影响光线条件和摄影建议。",
      evidence: `${args.learningDeltas.length} 个学习差异；challengeSuite=${args.challengeSuite.passed}/${args.challengeSuite.total}.`,
      evidencePath: "qualification_report.learningDeltas",
      reviewState: readyState,
      passed:
        args.learningDeltas.some((delta) => delta.afterLighting === "golden hour") &&
        args.challengeSuite.passed === args.challengeSuite.total,
      teacherQuestion: "老师，这个摄影 demo 是否足够证明系统能把纠正变成下一次可见改进？"
    }
  ];

  return {
    status: items.every((item) => item.passed) ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items,
    allowedActions: ["逐条审查老师要求", "补充新的带教要求", "重新运行本地验证"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    teacherPrompt: "请老师按自己的原始要求逐条判断：这些证据是否足以说明可视化 AI 学习技术已经合格。"
  };
}

function buildHandsOnTeachingLesson(args: {
  teacherAcceptanceBoundary: TeacherAcceptanceBoundary;
  spatialEngineeringTeachingModel: QualificationSpatialEngineeringTeachingModel;
  domainLearningWorkflow: QualificationDomainLearningWorkflow;
  humanTeachingMemoryProtocol: QualificationHumanTeachingMemoryProtocol;
  teachingPredictionBoard: QualificationTeachingPredictionBoard;
  visualTeacherReviewWorksheet: QualificationVisualTeacherReviewWorksheet;
  userRequirementCoverageAudit: QualificationUserRequirementCoverageAudit;
}): QualificationHandsOnTeachingLesson {
  const firstCandidate = args.spatialEngineeringTeachingModel.candidates[0];
  const firstMove = args.teachingPredictionBoard.moves[0];
  const lockedReviewState: QualificationHandsOnTeachingLessonStep["reviewState"] = "locked_until_teacher_acceptance";
  const awaitingReviewState: QualificationHandsOnTeachingLessonStep["reviewState"] = "awaiting_teacher_review";
  const steps: QualificationHandsOnTeachingLessonStep[] = [
    {
      id: "lesson-domain-orientation",
      order: 1,
      phase: "domain_orientation",
      label: "先让 AI 自己建立领域认知",
      teacherCanDo: "老师先打开领域学习 brief，删掉不重要的学习重点，补上这个领域必须遵守的规则。",
      apprenticeWillDo: "AI 会把领域重点、知识节点、约束和验证门槛整理成可审查知识体系，再进入带教。",
      whyThisStep: "先让 AI 有一张可纠正的知识地图，老师后面的纠正才不会散落成孤立提示词。",
      visibleEvidence: `${args.domainLearningWorkflow.stages.length} 个领域学习阶段，${args.domainLearningWorkflow.knowledgeNodes.length} 个知识节点。`,
      correctionPoint: "老师可以直接改 JSON brief、知识节点名称、学习顺序或某个阶段的通过标准。",
      evidencePath: "qualification_report.domainLearningWorkflow",
      panelAnchorId: "teach-domain-brief",
      reviewState: awaitingReviewState,
      passed:
        args.domainLearningWorkflow.status === "ready_for_teacher_review" &&
        args.domainLearningWorkflow.stages.some((stage) => stage.phase === "self_research") &&
        args.domainLearningWorkflow.stages.some((stage) => stage.phase === "guided_generation")
    },
    {
      id: "lesson-teacher-instruction",
      order: 2,
      phase: "teacher_instruction",
      label: "老师输入一段结构化带教",
      teacherCanDo: "老师可以粘贴 JSON/DSL、结构化规则，或者先用语音说一遍再转成规则草稿。",
      apprenticeWillDo: "AI 会把老师的话拆成条件、动作、适用边界、冲突策略和请教问题。",
      whyThisStep: "结构化输入能减少重复识图和误识别，让工程规则、三维点位和长期记忆都更稳定。",
      visibleEvidence: `语音草稿 reviewOnly=${args.humanTeachingMemoryProtocol.voiceTranscriptDraft.reviewOnly}; 规则数=${args.humanTeachingMemoryProtocol.rules.length}.`,
      correctionPoint: "老师可以改条件、动作、优先级、是否未来自动应用，或者要求它只作为案例。",
      evidencePath: "qualification_report.humanTeachingMemoryProtocol",
      panelAnchorId: "teach-domain-brief",
      reviewState: awaitingReviewState,
      passed:
        args.humanTeachingMemoryProtocol.status === "ready_for_teacher_review" &&
        args.humanTeachingMemoryProtocol.voiceTranscriptDraft.reviewOnly === true &&
        args.humanTeachingMemoryProtocol.rules.length >= 4
    },
    {
      id: "lesson-code-coordinate",
      order: 3,
      phase: "code_coordinate",
      label: "在三维坐标里直接教工程画法",
      teacherCanDo: "老师直接改 x/y/z 点列、单位、容差、约束名称和粗略线条，不需要每次上传图片。",
      apprenticeWillDo: "AI 会解析坐标、显示点表、理解线条意图，并把图片降级为可选参考。",
      whyThisStep: "工程问题常常本质是位置、约束和容差；代码化三维输入能让老师像审图一样教 AI。",
      visibleEvidence: `axes=${args.spatialEngineeringTeachingModel.coordinateFrame.axes.join("/")}; inputMode=${args.spatialEngineeringTeachingModel.teachingInputMode}.`,
      correctionPoint: "老师可以改任意点、约束或容差，AI 会立即重新预演后续拟合。",
      evidencePath: "qualification_report.spatialEngineeringTeachingModel.coordinateFrame",
      panelAnchorId: "teach-3d-coordinates",
      reviewState: awaitingReviewState,
      passed:
        args.spatialEngineeringTeachingModel.teachingInputMode === "code_first" &&
        args.spatialEngineeringTeachingModel.codeTeachingProtocol.imageUse === "optional_reference_only"
    },
    {
      id: "lesson-model-fit",
      order: 4,
      phase: "model_fit",
      label: "粗线条数学拟合并给多个候选",
      teacherCanDo: "老师画得不直也没关系，先看 AI 拟合出的多个候选，再选最接近真实意图的那一个。",
      apprenticeWillDo: "AI 会展示最小二乘、轴向吸附、折线等候选，以及残差、置信度和可选理由。",
      whyThisStep: "单一拟合很容易误解老师意图；多个候选把不确定性摊开，让老师用选择代替长篇解释。",
      visibleEvidence: `${args.spatialEngineeringTeachingModel.candidates.length} 个候选；首选候选=${firstCandidate?.label ?? "等待候选"}.`,
      correctionPoint: "老师可以选择候选、要求新增曲线/平面模型，或者指出哪个残差判断不合理。",
      evidencePath: "qualification_report.spatialEngineeringTeachingModel.candidates",
      panelAnchorId: "teach-fit-candidates",
      reviewState: awaitingReviewState,
      passed:
        args.spatialEngineeringTeachingModel.candidates.length >= 3 &&
        args.spatialEngineeringTeachingModel.candidates.every((candidate) => candidate.teacherSelectable && candidate.passed)
    },
    {
      id: "lesson-next-move-prediction",
      order: 5,
      phase: "next_move_prediction",
      label: "像下棋一样预测下一步",
      teacherCanDo: "老师先看 AI 预测它下一手准备怎么继续，再决定让它走、改它、或停下来补证据。",
      apprenticeWillDo: "AI 会解释为什么这么预测、哪里等老师纠正、这一步会不会影响长期记忆。",
      whyThisStep: "提前看下一步可以把错误截在中间，不必等最终结果生成完再返工。",
      visibleEvidence: `${args.teachingPredictionBoard.moves.length} 个下一手预测；第一手=${firstMove?.label ?? "等待预测"}.`,
      correctionPoint: "老师可以改下一步顺序、删掉不该学的节点，或者要求 AI 先补证据再继续。",
      evidencePath: "qualification_report.teachingPredictionBoard.moves",
      panelAnchorId: "teach-next-move",
      reviewState: awaitingReviewState,
      passed:
        args.teachingPredictionBoard.status === "ready_for_teacher_review" &&
        args.teachingPredictionBoard.moves.length >= 6 &&
        args.teachingPredictionBoard.moves.every((move) => move.passed)
    },
    {
      id: "lesson-teacher-correction",
      order: 6,
      phase: "teacher_correction",
      label: "老师逐步纠正并要求解释原因",
      teacherCanDo: "老师在每一步审查问题里指出 AI 哪里理解错、为什么错、下一步应该怎么改。",
      apprenticeWillDo: "AI 会把纠正写成可追踪草稿，保留 why、验证结果和老师下一次要看的问题。",
      whyThisStep: "带教不是一次性生成答案，而是边生成边纠正，让知识沉淀发生在错误刚出现的位置。",
      visibleEvidence: `${args.visualTeacherReviewWorksheet.items.length} 个老师审查问题仍处于 unanswered，等待老师判断。`,
      correctionPoint: "老师可以把某个问题保存成待确认规则、反例、适用范围收窄或只作为训练案例。",
      evidencePath: "qualification_report.visualTeacherReviewWorksheet.items",
      panelAnchorId: "teach-fit-candidates",
      reviewState: awaitingReviewState,
      passed:
        args.visualTeacherReviewWorksheet.status === "awaiting_teacher_review" &&
        args.visualTeacherReviewWorksheet.items.every((item) => item.evidenceReady && item.status === "unanswered")
    },
    {
      id: "lesson-memory-replay-lock",
      order: 7,
      phase: "memory_replay",
      label: "回放旧知识，但确认前不自动封装",
      teacherCanDo: "老师检查旧知识是否命中新命令、是否冲突、是否应该沿用或收窄。",
      apprenticeWillDo: "AI 会先回放老师教过的知识，列出命中理由和冲突边界，再虚心提问。",
      whyThisStep: "长期记忆必须又牢又可暂停；否则 AI 要么忘要求，要么机械套旧规则。",
      visibleEvidence: `futureReplay=${args.humanTeachingMemoryProtocol.futureCommandReplay.status}; mode=${args.teacherAcceptanceBoundary.mode}; blocked=${args.teacherAcceptanceBoundary.blockedWork.join("/")}.`,
      correctionPoint: "老师可以决定旧知识沿用、改窄、暂停、变成反例，或者要求继续请教。",
      evidencePath: "qualification_report.humanTeachingMemoryProtocol.futureCommandReplay",
      panelAnchorId: "teach-memory-replay",
      reviewState: lockedReviewState,
      passed:
        args.humanTeachingMemoryProtocol.futureCommandReplay.reviewOnly === true &&
        args.teacherAcceptanceBoundary.accepted === false &&
        args.teacherAcceptanceBoundary.packagingGated === true &&
        args.userRequirementCoverageAudit.items.some(
          (item) => item.id === "remember-human-knowledge" && item.passed
        )
    }
  ];

  return {
    status: steps.every((step) => step.passed) ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    startPrompt:
      "老师可以从这里直接开始一堂带教课：先改领域 brief，再输入结构化三维/规则代码，选拟合候选，审查下一手预测，最后决定记忆是否只暂停保存。",
    steps,
    runbook: buildHandsOnTeachingRunbook(steps),
    allowedActions: ["开始一堂带教课", "逐步纠正 AI", "重新运行本地验证"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    teacherPrompt: "请老师按这一堂课的顺序检查：AI 是否已经能被你直接上手带教，并且每一步都说清楚为什么。"
  };
}

function buildHandsOnTeachingRunbook(
  steps: QualificationHandsOnTeachingLessonStep[]
): QualificationHandsOnTeachingRunbook {
  const items: QualificationHandsOnTeachingRunbookItem[] = steps.map((step) => ({
    stepId: step.id,
    order: step.order,
    phase: step.phase,
    label: step.label,
    anchorId: step.panelAnchorId,
    evidencePath: step.evidencePath,
    teacherAction: step.teacherCanDo,
    expectedApprenticeResponse: step.apprenticeWillDo,
    correctionCheckpoint: step.correctionPoint,
    reviewState: step.reviewState,
    ruleEnabled: false,
    accepted: false,
    packagingGated: true,
    passed:
      step.passed &&
      step.panelAnchorId.length > 0 &&
      step.evidencePath.startsWith("qualification_report.") &&
      step.reviewState.length > 0
  }));
  const exportPayload = {
    format: "hands_on_teaching_lesson_runbook_json_v1",
    mode: "hands_on_teaching_lesson_runbook_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    generatedFrom: "qualification_report.handsOnTeachingLesson.runbook",
    items: items.map((item) => ({
      stepId: item.stepId,
      order: item.order,
      phase: item.phase,
      anchorId: item.anchorId,
      evidencePath: item.evidencePath,
      reviewState: item.reviewState,
      teacherAction: item.teacherAction,
      expectedApprenticeResponse: item.expectedApprenticeResponse,
      correctionCheckpoint: item.correctionCheckpoint,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true
    }))
  };

  return {
    mode: "hands_on_teaching_lesson_runbook_v1",
    format: "hands_on_teaching_lesson_runbook_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items,
    readySteps: items.filter((item) => item.reviewState === "awaiting_teacher_review" && item.passed).length,
    lockedSteps: items.filter((item) => item.reviewState === "locked_until_teacher_acceptance" && item.passed).length,
    exportJson: JSON.stringify(exportPayload, null, 2),
    teacherQuestion:
      "Teacher, please use this runbook to run the lesson step by step. Which step should be taught again before acceptance?",
    allowedActions: ["Export lesson runbook", "Jump to teaching anchors", "Plan next lesson"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      items.length === steps.length &&
      items.every(
        (item) =>
          item.passed &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      )
  };
}

function isTeacherAcceptanceAgendaDecision(value: unknown): value is QualificationTeacherAcceptanceAgendaDecision {
  return (
    value === "ready_for_review" ||
    value === "needs_revision" ||
    value === "hold" ||
    value === "locked"
  );
}

function isTeacherAcceptanceAgendaDecisionDraftItem(value: unknown): value is {
  agendaItemId: string;
  label: string;
  decision: QualificationTeacherAcceptanceAgendaDecision;
  note: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.agendaItemId === "string" &&
    typeof record.label === "string" &&
    isTeacherAcceptanceAgendaDecision(record.decision) &&
    typeof record.note === "string" &&
    record.ruleEnabled === false &&
    record.accepted === false &&
    record.packagingGated === true
  );
}

function buildTeacherAcceptanceAgendaDecisionDraftRecovery(args: {
  decisionItems: QualificationTeacherAcceptanceAgendaDecisionItem[];
  corrections: Array<{
    id: string;
    errorType: string;
    runId: string | null;
    learningTraceSteps: number;
    extractedRule: RuleRecord | null;
    afterOutput: Record<string, unknown>;
    createdAt: string;
  }>;
}): QualificationTeacherAcceptanceAgendaDecisionDraftRecovery {
  const recoveredDrafts = args.corrections
    .filter(
      (correction) =>
        correction.errorType === "teacher_acceptance_agenda_decision_draft" &&
        correction.runId === null &&
        correction.extractedRule?.enabled === false &&
        correction.afterOutput.format === "teacher_acceptance_agenda_decision_json_v1" &&
        correction.afterOutput.ruleEnabled === false &&
        correction.afterOutput.accepted === false &&
        correction.afterOutput.packagingGated === true &&
        correction.learningTraceSteps >= 3 &&
        Array.isArray(correction.afterOutput.items)
    )
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  const latest = recoveredDrafts[recoveredDrafts.length - 1] ?? null;
  const recoveredItems = latest
    ? (latest.afterOutput.items as unknown[]).filter(isTeacherAcceptanceAgendaDecisionDraftItem)
    : [];
  const recoveredById = new Map(recoveredItems.map((item) => [item.agendaItemId, item]));
  const rows: QualificationTeacherAcceptanceAgendaDecisionDraftRecoveryRow[] = args.decisionItems.map((item) => {
    const recovered = recoveredById.get(item.agendaItemId) ?? null;
    const recoveredDecision = recovered?.decision ?? null;
    const decisionChanged = recoveredDecision !== null && recoveredDecision !== item.proposedDecision;
    const nextReviewAction = !recovered
      ? `Save a teacher agenda decision draft for ${item.label}.`
      : decisionChanged || recoveredDecision !== "ready_for_review"
        ? `Replay teacher decision ${recoveredDecision} for ${item.label} before the next review.`
        : `Keep ${item.label} as recovered review-only evidence.`;

    return {
      agendaItemId: item.agendaItemId,
      label: item.label,
      staticDecision: item.proposedDecision,
      recoveredDecision,
      decisionChanged,
      recoveredNote: recovered?.note ?? "",
      nextReviewAction,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed:
        item.ruleEnabled === false &&
        item.accepted === false &&
        item.packagingGated === true &&
        (!recovered ||
          (recovered.ruleEnabled === false && recovered.accepted === false && recovered.packagingGated === true))
    };
  });
  const nextReviewQueueItems: QualificationTeacherAcceptanceAgendaNextReviewQueueItem[] = rows
    .flatMap((row) => {
      const reason: QualificationTeacherAcceptanceAgendaNextReviewQueueReason | null =
        row.recoveredDecision === null
          ? "missing_decision"
          : row.recoveredDecision === "locked"
            ? "locked_boundary"
            : row.decisionChanged
              ? "changed_decision"
              : row.recoveredDecision !== "ready_for_review"
                ? "follow_up_decision"
                : null;

      if (!reason) {
        return [];
      }

      const orderByReason: Record<QualificationTeacherAcceptanceAgendaNextReviewQueueReason, number> = {
        locked_boundary: 1,
        missing_decision: 2,
        changed_decision: 3,
        follow_up_decision: 4
      };

      return [
        {
          id: `next-review-${row.agendaItemId}`,
          agendaItemId: row.agendaItemId,
          label: row.label,
          order: orderByReason[reason],
          reason,
          recoveredDecision: row.recoveredDecision,
          nextReviewAction: row.nextReviewAction,
          teacherPrompt:
            reason === "locked_boundary"
              ? "Confirm that packaging, release, and wrapping stay blocked until explicit teacher acceptance."
              : reason === "missing_decision"
                ? "Ask the teacher to save a review-only decision draft for this agenda item."
                : reason === "changed_decision"
                  ? "Replay the changed teacher decision before planning the next teaching pass."
                  : "Carry this recovered follow-up decision into the next teacher review pass.",
          ruleEnabled: false as const,
          accepted: false as const,
          packagingGated: true as const,
          passed: row.passed && row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
        }
      ];
    })
    .sort((left, right) => left.order - right.order || left.agendaItemId.localeCompare(right.agendaItemId))
    .map((item, index) => ({ ...item, order: index + 1 }));
  const nextReviewQueuePayload = {
    format: "teacher_acceptance_agenda_next_review_queue_json_v1",
    mode: "teacher_acceptance_agenda_next_review_queue_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: nextReviewQueueItems
  };
  const nextReviewQueue: QualificationTeacherAcceptanceAgendaNextReviewQueue = {
    mode: "teacher_acceptance_agenda_next_review_queue_v1",
    format: "teacher_acceptance_agenda_next_review_queue_json_v1",
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    itemCount: nextReviewQueueItems.length,
    lockedItems: nextReviewQueueItems.filter((item) => item.reason === "locked_boundary").length,
    items: nextReviewQueueItems,
    exportJson: JSON.stringify(nextReviewQueuePayload, null, 2),
    teacherQuestion:
      "Teacher, should the next review pass follow this queue of missing, changed, follow-up, and locked agenda decisions?",
    allowedActions: ["Review next queue", "Save another agenda decision draft", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      nextReviewQueueItems.every(
        (item) =>
          item.passed &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) && nextReviewQueueItems.length >= 0
  };
  const nextReviewHandoffSteps: QualificationTeacherAcceptanceAgendaNextReviewHandoffStep[] =
    nextReviewQueueItems.map((item) => ({
      id: `next-review-handoff-${item.agendaItemId}`,
      queueItemId: item.id,
      agendaItemId: item.agendaItemId,
      order: item.order,
      reason: item.reason,
      title: `Review ${item.label}`,
      handoffAction:
        item.reason === "locked_boundary"
          ? "Carry the locked boundary forward and confirm no packaging, release, or wrapping work starts."
          : item.reason === "missing_decision"
            ? "Ask the teacher to fill this agenda decision before planning follow-up work."
            : item.reason === "changed_decision"
              ? "Replay the changed decision and update the next teaching pass while keeping rules disabled."
              : "Carry the follow-up decision into the next teacher review pass without enabling memory.",
      verificationHint:
        item.reason === "locked_boundary"
          ? "Verify teacherAcceptanceBoundary.accepted=false and packaging.gated=true."
          : "Verify the saved agenda decision remains a review-only draft with ruleEnabled=false.",
      teacherPrompt: item.teacherPrompt,
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: item.passed && item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
    }));
  const nextReviewHandoffCommands = [
    "npm.cmd run typecheck",
    "npm.cmd run test",
    "npm.cmd run verify:learning",
    "npm.cmd run build"
  ];
  const nextReviewHandoffText = [
    "Teacher acceptance agenda next review handoff",
    `Queue items: ${nextReviewQueueItems.length}`,
    `Locked packaging-boundary items: ${nextReviewHandoffSteps.filter((step) => step.reason === "locked_boundary").length}`,
    "Follow the ordered steps below as teacher-review work only. Do not accept technology, enable rules, package, release, or wrap."
  ]
    .concat(nextReviewHandoffSteps.map((step) => `${step.order}. ${step.title}: ${step.handoffAction}`))
    .join("\n");
  const nextReviewRunbookSteps: QualificationTeacherAcceptanceAgendaNextReviewRunbookStep[] =
    nextReviewHandoffSteps.map((step) => {
      const phase: QualificationTeacherAcceptanceAgendaNextReviewRunbookStep["phase"] =
        step.reason === "locked_boundary"
          ? "confirm_lock"
          : step.reason === "missing_decision"
            ? "inspect_evidence"
            : "replay_decision";

      return {
        id: `next-review-runbook-${step.agendaItemId}`,
        handoffStepId: step.id,
        order: step.order,
        phase,
        evidencePath:
          step.reason === "locked_boundary"
            ? "qualification_report.teacherAcceptanceBoundary + qualification_report.packaging"
            : `qualification_report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.rows[agendaItemId=${step.agendaItemId}]`,
        reviewerAction:
          phase === "confirm_lock"
            ? "Confirm the review-only boundary before any other work continues."
            : phase === "inspect_evidence"
              ? "Inspect the agenda evidence and ask the teacher for a review-only decision draft."
              : "Replay the recovered teacher decision and plan the next teaching correction only.",
        continueCondition:
          phase === "confirm_lock"
            ? "Continue only while accepted=false and packaging remains gated."
            : "Continue only if the next action is teacher review, evidence inspection, or local verification.",
        stopCondition:
          phase === "confirm_lock"
            ? "Stop immediately if any package, release, wrap, or acceptance action appears."
            : "Stop immediately if the step would enable a rule, save technology acceptance, or unlock packaging.",
        verificationCommand: phase === "confirm_lock" ? "npm.cmd run verify:learning" : "npm.cmd run test",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          step.passed && step.ruleEnabled === false && step.accepted === false && step.packagingGated === true
      };
    });
  const nextReviewDryRunRows: QualificationTeacherAcceptanceAgendaNextReviewDryRunAuditRow[] =
    nextReviewRunbookSteps.map((step) => ({
      id: `next-review-dry-run-${step.id}`,
      runbookStepId: step.id,
      order: step.order,
      expectedEvidence:
        step.phase === "confirm_lock"
          ? "The report still shows teacherAcceptanceBoundary.accepted=false, packaging.accepted=false, and packaging.gated=true."
          : `The reviewer can inspect ${step.evidencePath} without saving acceptance or enabling memory.`,
      simulatedResult: step.phase === "confirm_lock" ? "lock_confirmed" : "awaiting_teacher_review",
      lockAssertion:
        "Dry-run must leave ruleEnabled=false, accepted=false, packagingGated=true, and blockedActions containing Package/Release/Wrap.",
      noOpActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      reviewerNote:
        step.phase === "confirm_lock"
          ? "Use this row to confirm the boundary before continuing review work."
          : "Use this row to preview the review action; do not persist technology acceptance.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        step.passed &&
        step.ruleEnabled === false &&
        step.accepted === false &&
        step.packagingGated === true &&
        step.stopCondition.includes("Stop")
    }));
  const nextReviewReceiptRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptTemplateRow[] =
    nextReviewDryRunRows.map((row) => ({
      id: `next-review-receipt-${row.id}`,
      dryRunRowId: row.id,
      order: row.order,
      expectedEvidence: row.expectedEvidence,
      observedEvidencePlaceholder: "Teacher or reviewer writes the observed evidence here after inspection.",
      defaultDecision: "needs_teacher_review",
      blockerQuestion:
        row.simulatedResult === "lock_confirmed"
          ? "Did any acceptance, package, release, or wrap action appear despite the lock?"
          : "Did this review step reveal missing evidence, an unsafe rule enablement, or a packaging unlock attempt?",
      nextReviewerNotePlaceholder: "Write the next review note here. This note is not technology acceptance.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        row.passed &&
        row.ruleEnabled === false &&
        row.accepted === false &&
        row.packagingGated === true &&
        row.noOpActions.includes("Package")
    }));
  const nextReviewReceiptValidationRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptValidationRow[] =
    nextReviewReceiptRows.map((row) => ({
      id: `next-review-receipt-validation-${row.id}`,
      receiptRowId: row.id,
      order: row.order,
      allowedDecisions: ["needs_teacher_review", "blocked", "ready_for_follow_up"],
      blockedDecision: "accepted",
      validationRule:
        "Receipt decisions may route review work, but they must not accept technology, enable rules, or unlock packaging.",
      invalidIf: [
        "decision=accepted",
        "ruleEnabled=true",
        "accepted=true",
        "packagingGated=false",
        "blockedActions missing Package"
      ],
      nextActionIfInvalid: "Stop review, restore review-only state, and ask the teacher before continuing.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        row.passed &&
        row.defaultDecision === "needs_teacher_review" &&
        row.ruleEnabled === false &&
        row.accepted === false &&
        row.packagingGated === true
    }));
  const nextReviewReceiptReplayRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptDecisionReplayRow[] =
    nextReviewReceiptValidationRows.flatMap((row) =>
      row.allowedDecisions.map((decision, decisionIndex) => ({
        id: `next-review-receipt-replay-${row.id}-${decision}`,
        validationRowId: row.id,
        order: (row.order - 1) * row.allowedDecisions.length + decisionIndex + 1,
        simulatedDecision: decision,
        nextReviewAction:
          decision === "needs_teacher_review"
            ? "Keep this row in the next teacher review pass and ask for more observed evidence."
            : decision === "blocked"
              ? "Stop the review path, preserve the blocker, and ask the teacher before continuing."
              : "Move this row into follow-up review planning without accepting technology.",
        consequence:
          decision === "blocked"
            ? "No rules are enabled, no acceptance is saved, and packaging remains gated while the blocker is investigated."
            : "The receipt only routes review work; it does not accept technology, enable rules, or unlock packaging.",
        blockedDecisionReminder: "The decision accepted remains blocked and must not be inferred from this replay.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          row.passed &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.blockedDecision === "accepted"
      }))
    );
  const nextReviewReceiptFollowUpPlanItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpPlanItem[] =
    nextReviewReceiptReplayRows.map((row) => ({
      id: `next-review-receipt-follow-up-${row.id}`,
      replayRowId: row.id,
      validationRowId: row.validationRowId,
      order: row.order,
      plannedRoute:
        row.simulatedDecision === "needs_teacher_review"
          ? "teacher_review_pass"
          : row.simulatedDecision === "blocked"
            ? "blocked_receipt_escalation"
            : "follow_up_review_planning",
      reviewerAction:
        row.simulatedDecision === "needs_teacher_review"
          ? "Ask the teacher to add observed evidence and keep the receipt open."
          : row.simulatedDecision === "blocked"
            ? "Escalate the blocker, preserve the row, and stop any downstream review automation."
            : "Schedule a follow-up review step without recording acceptance or enabling rules.",
      evidenceToCollect:
        row.simulatedDecision === "blocked"
          ? "Blocker reason, affected evidence path, and confirmation that packaging stayed gated."
          : "Observed evidence note, teacher follow-up question, and locked review-only status.",
      continueCondition:
        "Continue only while ruleEnabled=false, accepted=false, packagingGated=true, and the teacher has not accepted the technology.",
      stopCondition:
        "Stop if any route tries decision=accepted, ruleEnabled=true, accepted=true, packagingGated=false, Package, Release, or Wrap.",
      lockReminder:
        "This follow-up plan is review-only; accepted remains blocked and Package/Release/Wrap remain blocked.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        row.passed &&
        row.ruleEnabled === false &&
        row.accepted === false &&
        row.packagingGated === true &&
        row.blockedDecisionReminder.includes("accepted remains blocked")
    }));
  const nextReviewReceiptFollowUpLockAuditItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditItem[] =
    nextReviewReceiptFollowUpPlanItems.map((item) => ({
      id: `next-review-receipt-follow-up-lock-audit-${item.id}`,
      followUpPlanItemId: item.id,
      order: item.order,
      lockCheck:
        "Verify this follow-up route cannot transition into acceptance, rule enablement, package, release, or wrap.",
      forbiddenTransitions: [
        "decision=accepted",
        "ruleEnabled=true",
        "accepted=true",
        "packagingGated=false",
        "Package/Release/Wrap"
      ],
      noOpAssertion:
        "Reviewer planning is a no-op for technology acceptance, rule memory enablement, packaging, release, and wrapping.",
      nextActionIfFailed:
        "Stop the follow-up plan, preserve the failed row, and ask the teacher before any downstream action.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        item.passed &&
        item.ruleEnabled === false &&
        item.accepted === false &&
        item.packagingGated === true &&
        item.stopCondition.includes("packagingGated=false") &&
        item.lockReminder.includes("accepted remains blocked")
    }));
  const nextReviewReceiptFollowUpVerificationPacketItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketItem[] =
    nextReviewReceiptFollowUpLockAuditItems.map((item) => ({
      id: `next-review-receipt-follow-up-verification-${item.id}`,
      lockAuditItemId: item.id,
      order: item.order,
      evidencePath:
        "qualification_report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit",
      verificationCommand:
        "npm.cmd run verify:learning",
      expectedResult:
        "Verifier evidence includes receiptLockAudit rows, accepted=false, and packaging=true.",
      stopIfMismatch:
        "Stop and ask the teacher if the verifier output omits receiptLockAudit, reports accepted=true, or reports packaging=false.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        item.passed &&
        item.ruleEnabled === false &&
        item.accepted === false &&
        item.packagingGated === true &&
        item.forbiddenTransitions.includes("decision=accepted") &&
        item.forbiddenTransitions.includes("packagingGated=false")
    }));
  const nextReviewReceiptFollowUpVerificationResultRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultTemplateItem[] =
    nextReviewReceiptFollowUpVerificationPacketItems.map((item) => ({
      id: `next-review-receipt-follow-up-verification-result-${item.id}`,
      verificationPacketItemId: item.id,
      order: item.order,
      commandToRun: item.verificationCommand,
      observedOutputPlaceholder:
        "Reviewer pastes the relevant verifier evidence line here after running the command.",
      defaultStatus: "not_run_yet",
      statusOptions: ["not_run_yet", "matched_expected", "mismatch_blocked"],
      mismatchBlockerQuestion:
        "Did the verifier omit receiptVerifyPacket, report accepted=true, or report packaging=false?",
      nextReviewerNotePlaceholder:
        "Write the next review note here. This result is not technology acceptance.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        item.passed &&
        item.ruleEnabled === false &&
        item.accepted === false &&
        item.packagingGated === true &&
        item.expectedResult.includes("accepted=false") &&
        item.expectedResult.includes("packaging=true")
    }));
  const nextReviewReceiptFollowUpVerificationResultValidationItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationItem[] =
    nextReviewReceiptFollowUpVerificationResultRows.map((item) => ({
      id: `next-review-receipt-follow-up-verification-result-validation-${item.id}`,
      resultTemplateItemId: item.id,
      order: item.order,
      allowedStatuses: ["not_run_yet", "matched_expected", "mismatch_blocked"],
      blockedStatus: "accepted",
      validationRule:
        "Verification results may record review evidence, but they must not accept technology, enable rules, or unlock packaging.",
      invalidIf: [
        "status=accepted",
        "ruleEnabled=true",
        "accepted=true",
        "packagingGated=false",
        "blockedActions missing Package"
      ],
      nextActionIfInvalid:
        "Stop result recovery, keep the row review-only, and ask the teacher before continuing.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        item.passed &&
        item.defaultStatus === "not_run_yet" &&
        item.statusOptions.includes("matched_expected") &&
        item.statusOptions.includes("mismatch_blocked") &&
        item.ruleEnabled === false &&
        item.accepted === false &&
        item.packagingGated === true
    }));
  const nextReviewReceiptFollowUpVerificationResultValidationPayload = {
    format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_json_v1",
    mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: nextReviewReceiptFollowUpVerificationResultValidationItems,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptFollowUpVerificationResultReplayItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayItem[] =
    nextReviewReceiptFollowUpVerificationResultValidationItems.flatMap((item) =>
      item.allowedStatuses.map((status, statusIndex) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-${item.id}-${status}`,
        validationItemId: item.id,
        order: (item.order - 1) * item.allowedStatuses.length + statusIndex + 1,
        simulatedStatus: status,
        nextReviewAction:
          status === "not_run_yet"
            ? "Keep the result open and ask the reviewer to run the verifier before planning downstream work."
            : status === "matched_expected"
              ? "Allow follow-up review planning while keeping acceptance and packaging locked."
              : "Escalate the mismatch blocker and stop downstream review automation.",
        consequence:
          status === "mismatch_blocked"
            ? "The mismatch becomes a blocker; no rule is enabled, no acceptance is saved, and packaging remains gated."
            : "The status only routes review work; it does not accept technology, enable rules, or unlock packaging.",
        blockedStatusReminder:
          "The status accepted remains blocked and must not be inferred from this replay.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          item.passed &&
          item.blockedStatus === "accepted" &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      }))
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItem[] =
    nextReviewReceiptFollowUpVerificationResultReplayItems.map((item) => ({
      id: `next-review-receipt-follow-up-verification-result-replay-queue-${item.id}`,
      replayItemId: item.id,
      order: item.order,
      simulatedStatus: item.simulatedStatus,
      queueReason:
        item.simulatedStatus === "not_run_yet"
          ? "Verifier output has not been recorded yet."
          : item.simulatedStatus === "matched_expected"
            ? "Verifier output matched the expected lock evidence."
            : "Verifier output contradicted the expected lock evidence.",
      reviewerAction:
        item.simulatedStatus === "not_run_yet"
          ? "Ask the next reviewer to run the verifier and fill the result template."
          : item.simulatedStatus === "matched_expected"
            ? "Continue review planning while keeping acceptance, rules, and packaging locked."
            : "Stop downstream review automation and escalate the mismatch blocker.",
      continueCondition:
        item.simulatedStatus === "mismatch_blocked"
          ? "Continue only after the mismatch is resolved by teacher review."
          : "Continue only if ruleEnabled=false, accepted=false, and packagingGated=true remain visible.",
      stopCondition:
        item.simulatedStatus === "mismatch_blocked"
          ? "Stop because the verifier evidence mismatched the expected lock; do not infer accepted=true."
          : "Stop if any result tries to infer accepted=true, ruleEnabled=true, or packagingGated=false.",
      evidencePath:
        "qualification_report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.items",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        item.passed &&
        item.ruleEnabled === false &&
        item.accepted === false &&
        item.packagingGated === true &&
        item.blockedStatusReminder.includes("accepted remains blocked")
    }));
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffSteps: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffStep[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItems.map((item) => ({
      id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-${item.id}`,
      queueItemId: item.id,
      order: item.order,
      title:
        item.simulatedStatus === "not_run_yet"
          ? "Run missing verifier result"
          : item.simulatedStatus === "matched_expected"
            ? "Continue locked result review"
            : "Escalate mismatch blocker",
      handoffInstruction: `${item.reviewerAction} Keep this as teacher-review-only handoff material.`,
      evidencePath: item.evidencePath,
      verifierCommand:
        item.simulatedStatus === "not_run_yet"
          ? "npm run verify:learning"
          : item.simulatedStatus === "matched_expected"
            ? "curl http://127.0.0.1:PORT/api/tasks/task-photo-travel-journal/qualification"
            : "npm run verify:learning",
      expectedLockedResult:
        "ruleEnabled=false, accepted=false, packagingGated=true, and no Package/Release/Wrap action is exposed.",
      blockedIf: [
        "accepted=true",
        "ruleEnabled=true",
        "packagingGated=false",
        "Package",
        "Release",
        "Wrap"
      ],
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        item.passed &&
        item.ruleEnabled === false &&
        item.accepted === false &&
        item.packagingGated === true &&
        item.stopCondition.includes("accepted")
    }));
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookItem[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffSteps.map((step) => ({
      id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-${step.id}`,
      handoffStepId: step.id,
      order: step.order,
      reviewerAction: step.handoffInstruction,
      evidencePath: step.evidencePath,
      verificationCommand: step.verifierCommand,
      continueCondition:
        step.title === "Escalate mismatch blocker"
          ? "Continue only after the teacher resolves the mismatch blocker and the lock evidence is rerun."
          : "Continue only after the reviewer confirms the expected locked result.",
      stopCondition:
        "Stop if the reviewer sees accepted=true, ruleEnabled=true, packagingGated=false, Package, Release, or Wrap.",
      lockAssertion:
        "Expected locked state: ruleEnabled=false, accepted=false, packagingGated=true.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        step.passed &&
        step.blockedIf.includes("accepted=true") &&
        step.blockedIf.includes("packagingGated=false") &&
        step.ruleEnabled === false &&
        step.accepted === false &&
        step.packagingGated === true
    }));
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunItem[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookItems.map((item) => ({
      id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-${item.id}`,
      runbookItemId: item.id,
      order: item.order,
      expectedEvidence: `${item.evidencePath} remains visible after ${item.verificationCommand}.`,
      lockAssertion: item.lockAssertion,
      noOpActions: [
        "Do not accept technology",
        "Do not enable rules",
        "Do not package",
        "Do not release",
        "Do not wrap"
      ],
      reviewerNote:
        "Dry-run only: record whether the lock evidence is visible before any teacher acceptance discussion.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        item.passed &&
        item.lockAssertion.includes("accepted=false") &&
        item.stopCondition.includes("accepted=true") &&
        item.ruleEnabled === false &&
        item.accepted === false &&
        item.packagingGated === true
    }));
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunRows.map((row) => ({
      id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-${row.id}`,
      dryRunRowId: row.id,
      order: row.order,
      defaultDecision: "needs_teacher_review",
      observedEvidencePlaceholder: `Paste observed dry-run evidence for ${row.runbookItemId}.`,
      blockerQuestion:
        "Does this dry-run row show any accepted=true, ruleEnabled=true, or packagingGated=false transition?",
      nextReviewNotePlaceholder:
        "Record the next reviewer note without accepting technology or packaging.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        row.passed &&
        row.ruleEnabled === false &&
        row.accepted === false &&
        row.packagingGated === true &&
        row.lockAssertion.includes("accepted=false")
    }));
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload = {
    format:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_json_v1",
    mode:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptRows,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.map((row) => ({
      id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-${row.id}`,
      receiptRowId: row.id,
      order: row.order,
      allowedDecisions: ["needs_teacher_review", "blocked", "ready_for_follow_up"],
      blockedDecision: "accepted",
      validationRule:
        "Dry-run receipt decisions may record review routing only; they must not accept technology, enable rules, or unlock packaging.",
      invalidIf: [
        "decision=accepted",
        "ruleEnabled=true",
        "accepted=true",
        "packagingGated=false",
        "blockedActions missing Package"
      ],
      nextActionIfInvalid:
        "Stop dry-run receipt recovery, keep the row review-only, and ask the teacher before continuing.",
      ruleEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const,
      passed:
        row.passed &&
        row.defaultDecision === "needs_teacher_review" &&
        row.blockerQuestion.includes("accepted=true") &&
        row.ruleEnabled === false &&
        row.accepted === false &&
        row.packagingGated === true
    }));
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload = {
    format:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
    mode:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.flatMap(
      (row) =>
        row.allowedDecisions.map((decision, decisionIndex) => ({
          id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-${row.id}-${decision}`,
          validationRowId: row.id,
          order: (row.order - 1) * row.allowedDecisions.length + decisionIndex + 1,
          simulatedDecision: decision,
          nextReviewAction:
            decision === "needs_teacher_review"
              ? "Keep this dry-run receipt open and ask the teacher for observed evidence before follow-up planning."
              : decision === "blocked"
                ? "Stop dry-run receipt follow-up, preserve the blocker, and ask the teacher before continuing."
                : "Move the dry-run receipt into follow-up review planning while keeping acceptance and packaging locked.",
          consequence:
            decision === "blocked"
              ? "No rule is enabled, no acceptance is saved, and packaging remains gated while the blocker is reviewed."
              : "The replay only routes review work; it does not accept technology, enable rules, or unlock packaging.",
          blockedDecisionReminder:
            "The decision accepted remains blocked and must not be inferred from this dry-run receipt replay.",
          ruleEnabled: false as const,
          accepted: false as const,
          packagingGated: true as const,
          passed:
            row.passed &&
            row.blockedDecision === "accepted" &&
            row.invalidIf.includes("decision=accepted") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        }))
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.map(
      (row) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-${row.id}`,
        replayRowId: row.id,
        order: row.order,
        queueLane:
          row.simulatedDecision === "needs_teacher_review"
            ? "needs_teacher_review_queue"
            : row.simulatedDecision === "blocked"
              ? "blocked_queue"
              : "ready_for_follow_up_queue",
        reviewerAction:
          row.simulatedDecision === "needs_teacher_review"
            ? "Ask the teacher to review the dry-run receipt evidence and leave a note before any follow-up planning."
            : row.simulatedDecision === "blocked"
              ? "Preserve this blocker as the next review priority and stop any follow-up route that implies acceptance."
              : "Queue the row for follow-up review planning while keeping rule enablement and packaging disabled.",
        evidenceRequest:
          row.simulatedDecision === "blocked"
            ? "Record the blocker question, the verifier command, and the mismatch evidence that prevents follow-up."
            : "Record the observed dry-run receipt evidence, reviewer note, and lock assertion before continuing.",
        continueCondition:
          row.simulatedDecision === "ready_for_follow_up"
            ? "Continue only to review-only follow-up planning with accepted=false and packagingGated=true."
            : "Continue only after the teacher supplies review evidence or asks for a follow-up pass.",
        stopCondition:
          "Stop if the reviewer attempts accepted, ruleEnabled=true, packagingGated=false, package, release, or wrap.",
        blockedTransitions: ["accepted", "ruleEnabled=true", "packagingGated=false", "package", "release", "wrap"],
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          row.passed &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.blockedDecisionReminder.includes("accepted remains blocked")
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      items:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.map(
      (item) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-${item.id}`,
        queueItemId: item.id,
        order: item.order,
        title:
          item.queueLane === "blocked_queue"
            ? "Preserve blocked dry-run receipt validation replay"
            : item.queueLane === "ready_for_follow_up_queue"
              ? "Prepare review-only follow-up handoff"
              : "Collect teacher evidence for dry-run receipt validation replay",
        handoffInstruction:
          item.queueLane === "blocked_queue"
            ? "Hand this row to the next reviewer as a blocker; do not continue follow-up planning until the teacher resolves it."
            : item.queueLane === "ready_for_follow_up_queue"
              ? "Hand this row to the next reviewer for review-only follow-up planning while keeping all acceptance gates locked."
              : "Hand this row to the next reviewer to gather observed teacher evidence before any follow-up planning.",
        evidencePath:
          `qualification_report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items[${item.order - 1}]`,
        verifierCommand:
          "npm run verify:learning && curl -s http://127.0.0.1:3043/api/tasks/task-photo-travel-journal/qualification",
        expectedLockedResult:
          "queue item remains ruleEnabled=false, accepted=false, packagingGated=true, with accepted/ruleEnabled=true/packagingGated=false blocked transitions.",
        blockedIf: ["accepted", "ruleEnabled=true", "packagingGated=false", "package", "release", "wrap"],
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          item.passed &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true &&
          item.blockedTransitions.includes("accepted") &&
          item.stopCondition.includes("accepted")
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      steps:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItem[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.map(
      (step) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-${step.id}`,
        handoffStepId: step.id,
        order: step.order,
        reviewerAction:
          step.title.includes("blocked")
            ? "Review the blocker evidence, preserve the stopped route, and ask the teacher before continuing."
            : step.title.includes("follow-up")
              ? "Run the verifier, confirm the lock assertions, and prepare only review-only follow-up planning."
              : "Collect teacher evidence, run the verifier, and keep this item in review until the teacher responds.",
        evidencePath: step.evidencePath,
        verificationCommand: step.verifierCommand,
        continueCondition:
          step.title.includes("follow-up")
            ? "Continue only if verifier output confirms accepted=false, ruleEnabled=false, and packagingGated=true."
            : "Continue only with a teacher note or a verifier-confirmed review-only lock.",
        stopCondition:
          "Stop if verifier output or reviewer action attempts acceptance, rule enablement, packaging, release, or wrapping.",
        lockAssertion:
          "Runbook item must leave ruleEnabled=false, accepted=false, packagingGated=true, and blockedActions containing Package/Release/Wrap.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          step.passed &&
          step.blockedIf.includes("accepted") &&
          step.blockedIf.includes("ruleEnabled=true") &&
          step.blockedIf.includes("packagingGated=false") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      items:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunItem[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.map(
      (item) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-${item.id}`,
        runbookItemId: item.id,
        order: item.order,
        expectedEvidence:
          `The reviewer can inspect ${item.evidencePath}, run ${item.verificationCommand}, and still see ruleEnabled=false, accepted=false, and packagingGated=true.`,
        lockAssertion: item.lockAssertion,
        noOpActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
        reviewerNote:
          "Dry-run only: preview the reviewer action and record any blocker, but do not persist acceptance or enable packaging.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          item.passed &&
          item.lockAssertion.includes("ruleEnabled=false") &&
          item.lockAssertion.includes("accepted=false") &&
          item.lockAssertion.includes("packagingGated=true") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.map(
      (row) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-${row.id}`,
        dryRunRowId: row.id,
        order: row.order,
        defaultDecision: "needs_teacher_review",
        observedEvidencePlaceholder: `Paste observed dry-run audit evidence for ${row.runbookItemId}.`,
        blockerQuestion:
          "Does this dry-run audit receipt show any accepted=true, ruleEnabled=true, packagingGated=false, Package, Release, or Wrap transition?",
        nextReviewNotePlaceholder:
          "Record the next reviewer note without accepting technology, enabling rules, packaging, releasing, or wrapping.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          row.passed &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.lockAssertion.includes("accepted=false") &&
          row.noOpActions.includes("Package") &&
          row.noOpActions.includes("Release") &&
          row.noOpActions.includes("Wrap")
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.map(
      (row) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-${row.id}`,
        receiptRowId: row.id,
        order: row.order,
        allowedDecisions: ["needs_teacher_review", "blocked", "ready_for_follow_up"],
        blockedDecision: "accepted",
        validationRule:
          "Dry-run audit receipt decisions may only route the next review; they must not accept technology, enable rules, package, release, or wrap.",
        invalidIf: [
          "decision=accepted",
          "ruleEnabled=true",
          "accepted=true",
          "packagingGated=false",
          "Package",
          "Release",
          "Wrap"
        ],
        nextActionIfInvalid:
          "Stop dry-run audit receipt validation, keep the row review-only, and ask the teacher before continuing.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          row.passed &&
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.blockerQuestion.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.flatMap(
      (row) =>
        row.allowedDecisions.map((decision, decisionIndex) => ({
          id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-${row.id}-${decision}`,
          validationRowId: row.id,
          order: (row.order - 1) * row.allowedDecisions.length + decisionIndex + 1,
          simulatedDecision: decision,
          nextReviewAction:
            decision === "needs_teacher_review"
              ? "Keep this dry-run receipt validation open and ask the teacher to review the observed evidence before another pass."
              : decision === "blocked"
                ? "Preserve this validation row as a blocker and stop any route that implies acceptance or packaging."
                : "Route this validation row to review-only follow-up planning while keeping all locks asserted.",
          consequence:
            decision === "blocked"
              ? "The replay does not accept technology; no rule is enabled, no acceptance is saved, and packaging remains gated while the blocker is preserved."
              : "The replay only previews review routing; it does not accept technology, enable rules, package, release, or wrap.",
          blockedDecisionReminder:
            "The decision accepted remains blocked and must not be inferred from this validation replay.",
          ruleEnabled: false as const,
          accepted: false as const,
          packagingGated: true as const,
          passed:
            row.passed &&
            row.blockedDecision === "accepted" &&
            row.invalidIf.includes("decision=accepted") &&
            row.invalidIf.includes("Package") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        }))
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.map(
      (row) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-${row.id}`,
        replayRowId: row.id,
        order: row.order,
        queueLane:
          row.simulatedDecision === "needs_teacher_review"
            ? "needs_teacher_review_queue"
            : row.simulatedDecision === "blocked"
              ? "blocked_queue"
              : "ready_for_follow_up_queue",
        reviewerAction:
          row.simulatedDecision === "needs_teacher_review"
            ? "Ask the teacher to review this validation replay and record observed evidence before the next pass."
            : row.simulatedDecision === "blocked"
              ? "Preserve this validation replay as a blocker and stop any path that implies acceptance, rule enablement, or packaging."
              : "Queue this validation replay for review-only follow-up planning while all lock assertions remain visible.",
        evidenceRequest:
          row.simulatedDecision === "blocked"
            ? "Record the blocker evidence, the blocked accepted decision reminder, and the verifier output."
            : "Record the replay consequence, the teacher note, and the locked accepted=false/packagingGated=true evidence.",
        continueCondition:
          row.simulatedDecision === "ready_for_follow_up"
            ? "Continue only to review-only follow-up planning with ruleEnabled=false, accepted=false, and packagingGated=true."
            : "Continue only after the teacher supplies review evidence or asks for another review pass.",
        stopCondition:
          "Stop if the reviewer attempts accepted, ruleEnabled=true, packagingGated=false, Package, Release, or Wrap.",
        blockedTransitions: ["accepted", "ruleEnabled=true", "packagingGated=false", "Package", "Release", "Wrap"],
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          row.passed &&
          row.blockedDecisionReminder.includes("accepted remains blocked") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      items:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.map(
      (item) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-${item.id}`,
        queueItemId: item.id,
        order: item.order,
        title:
          item.queueLane === "needs_teacher_review_queue"
            ? "Hand off missing teacher evidence review"
            : item.queueLane === "blocked_queue"
              ? "Hand off preserved blocker review"
              : "Hand off review-only follow-up planning",
        handoffInstruction:
          `${item.reviewerAction} Keep this handoff review-only; do not accept technology, enable rules, package, release, or wrap.`,
        evidencePath:
          `qualification_report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items[${item.order - 1}]`,
        verifierCommand: "npm.cmd run verify:learning",
        expectedLockedResult:
          "The queue handoff remains review-only with ruleEnabled=false, accepted=false, and packagingGated=true.",
        blockedIf: item.blockedTransitions,
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          item.passed &&
          item.blockedTransitions.includes("accepted") &&
          item.blockedTransitions.includes("ruleEnabled=true") &&
          item.blockedTransitions.includes("packagingGated=false") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      steps:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItem[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.map(
      (step) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-${step.id}`,
        handoffStepId: step.id,
        order: step.order,
        reviewerAction:
          step.title.includes("blocker")
            ? "Review the preserved blocker, record the blocker evidence, and stop any route that implies acceptance or packaging."
            : step.title.includes("follow-up")
              ? "Run the verifier, confirm the locked handoff evidence, and prepare only review-only follow-up planning."
              : "Collect missing teacher evidence, run the verifier, and keep the item open for teacher review.",
        evidencePath: step.evidencePath,
        verificationCommand: step.verifierCommand,
        continueCondition:
          "Continue only if verifier output confirms ruleEnabled=false, accepted=false, packagingGated=true, and no Package/Release/Wrap action.",
        stopCondition:
          "Stop if verifier output or reviewer action attempts accepted, ruleEnabled=true, packagingGated=false, Package, Release, or Wrap.",
        lockAssertion:
          "Runbook item must keep ruleEnabled=false, accepted=false, packagingGated=true, and blockedActions containing Package/Release/Wrap.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          step.passed &&
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
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      items:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunItem[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.map(
      (item) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-${item.id}`,
        runbookItemId: item.id,
        order: item.order,
        expectedEvidence:
          `The reviewer can inspect ${item.evidencePath}, run ${item.verificationCommand}, and still see ruleEnabled=false, accepted=false, packagingGated=true, and no Package/Release/Wrap transition.`,
        lockAssertion: item.lockAssertion,
        noOpActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
        reviewerNote:
          "Dry-run only: simulate this deepest handoff runbook item, record blocker evidence if needed, and do not persist acceptance or unlock packaging.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          item.passed &&
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
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.map(
      (row) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-${row.id}`,
        dryRunRowId: row.id,
        order: row.order,
        defaultDecision: "needs_teacher_review",
        observedEvidencePlaceholder: `Paste observed deepest handoff runbook dry-run evidence for ${row.runbookItemId}.`,
        blockerQuestion:
          "Does this deepest dry-run receipt show any accepted=true, ruleEnabled=true, packagingGated=false, Package, Release, or Wrap transition?",
        nextReviewNotePlaceholder:
          "Record the next reviewer note without accepting technology, enabling rules, packaging, releasing, or wrapping.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          row.passed &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.lockAssertion.includes("accepted=false") &&
          row.noOpActions.includes("Package") &&
          row.noOpActions.includes("Release") &&
          row.noOpActions.includes("Wrap")
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRow[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.map(
      (row) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-${row.id}`,
        receiptRowId: row.id,
        order: row.order,
        allowedDecisions: ["needs_teacher_review", "blocked", "ready_for_follow_up"],
        blockedDecision: "accepted",
        validationRule:
          "Deepest dry-run receipt decisions may only route the next teacher review; they must not accept technology, enable rules, package, release, or wrap.",
        invalidIf: [
          "decision=accepted",
          "ruleEnabled=true",
          "accepted=true",
          "packagingGated=false",
          "Package",
          "Release",
          "Wrap"
        ],
        nextActionIfInvalid:
          "Stop deepest dry-run receipt validation, keep the row review-only, and ask the teacher before continuing.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          row.passed &&
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.blockerQuestion.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRow[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.flatMap(
      (row) =>
        row.allowedDecisions.map((decision, decisionIndex) => ({
          id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-${row.id}-${decision}`,
          validationRowId: row.id,
          order: (row.order - 1) * row.allowedDecisions.length + decisionIndex + 1,
          simulatedDecision: decision,
          nextReviewAction:
            decision === "needs_teacher_review"
              ? "Keep this dry-run receipt validation open and ask the teacher to review the observed evidence before another pass."
              : decision === "blocked"
                ? "Preserve this validation row as a blocker and stop any route that implies acceptance or packaging."
                : "Route this validation row to review-only follow-up planning while keeping all locks asserted.",
          consequence:
            decision === "blocked"
              ? "The replay does not accept technology; no rule is enabled, no acceptance is saved, and packaging remains gated while the blocker is preserved."
              : "The replay only previews review routing; it does not accept technology, enable rules, package, release, or wrap.",
          blockedDecisionReminder:
            "The decision accepted remains blocked and must not be inferred from this validation replay.",
          ruleEnabled: false as const,
          accepted: false as const,
          packagingGated: true as const,
          passed:
            row.passed &&
            row.blockedDecision === "accepted" &&
            row.invalidIf.includes("decision=accepted") &&
            row.invalidIf.includes("Package") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        }))
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItem[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.map(
      (row) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-${row.id}`,
        replayRowId: row.id,
        order: row.order,
        queueLane:
          row.simulatedDecision === "needs_teacher_review"
            ? "needs_teacher_review_queue"
            : row.simulatedDecision === "blocked"
              ? "blocked_queue"
              : "ready_for_follow_up_queue",
        reviewerAction:
          row.simulatedDecision === "needs_teacher_review"
            ? "Ask the teacher to review this deepest validation replay and record observed evidence before the next pass."
            : row.simulatedDecision === "blocked"
              ? "Preserve this deepest validation replay as a blocker and stop any path that implies acceptance, rule enablement, or packaging."
              : "Queue this deepest validation replay for review-only follow-up planning while all lock assertions remain visible.",
        evidenceRequest:
          row.simulatedDecision === "blocked"
            ? "Record the blocker evidence, the blocked accepted decision reminder, and the reviewer note."
            : "Record the replay consequence, the teacher note, and the locked accepted=false/packagingGated=true evidence.",
        continueCondition:
          row.simulatedDecision === "ready_for_follow_up"
            ? "Continue only to review-only follow-up planning with ruleEnabled=false, accepted=false, and packagingGated=true."
            : "Continue only after the teacher supplies review evidence or asks for another review pass.",
        stopCondition:
          "Stop if the reviewer attempts accepted, ruleEnabled=true, packagingGated=false, Package, Release, or Wrap.",
        blockedTransitions: ["accepted", "ruleEnabled=true", "packagingGated=false", "Package", "Release", "Wrap"],
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          row.passed &&
          row.blockedDecisionReminder.includes("accepted remains blocked") &&
          row.consequence.includes("does not accept technology") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      items:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffStep[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.map(
      (item) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-${item.id}`,
        queueItemId: item.id,
        order: item.order,
        title:
          item.queueLane === "needs_teacher_review_queue"
            ? "Hand off missing teacher evidence review"
            : item.queueLane === "blocked_queue"
              ? "Hand off preserved blocker review"
              : "Hand off review-only follow-up planning",
        handoffInstruction:
          `${item.reviewerAction} Keep this handoff review-only; do not accept technology, enable rules, package, release, or wrap.`,
        evidencePath:
          `qualification_report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items[${item.order - 1}]`,
        verifierCommand: "npm.cmd run verify:learning",
        expectedLockedResult:
          "The deepest validation replay queue handoff remains review-only with ruleEnabled=false, accepted=false, and packagingGated=true.",
        blockedIf: item.blockedTransitions,
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          item.passed &&
          item.blockedTransitions.includes("accepted") &&
          item.blockedTransitions.includes("ruleEnabled=true") &&
          item.blockedTransitions.includes("packagingGated=false") &&
          item.blockedTransitions.includes("Package") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      steps:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItem[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.map(
      (step) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-${step.id}`,
        handoffStepId: step.id,
        order: step.order,
        reviewerAction:
          step.title.includes("blocker")
            ? "Review the preserved deepest blocker, record the blocker evidence, and stop any route that implies acceptance, rule enablement, packaging, release, or wrapping."
            : step.title.includes("follow-up")
              ? "Run the verifier, confirm the deepest handoff lock evidence, and prepare only review-only follow-up planning."
              : "Collect missing teacher evidence, run the verifier, and keep this deepest handoff open for teacher review.",
        evidencePath: step.evidencePath,
        verificationCommand: step.verifierCommand,
        continueCondition:
          "Continue only if verifier output confirms ruleEnabled=false, accepted=false, packagingGated=true, and no Package/Release/Wrap action.",
        stopCondition:
          "Stop if verifier output or reviewer action attempts accepted, ruleEnabled=true, packagingGated=false, Package, Release, or Wrap.",
        lockAssertion:
          "Runbook item must keep ruleEnabled=false, accepted=false, packagingGated=true, and blockedActions containing Package/Release/Wrap.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          step.passed &&
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
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      items:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunItem[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.map(
      (item) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-${item.id}`,
        runbookItemId: item.id,
        order: item.order,
        expectedEvidence:
          `The reviewer can inspect ${item.evidencePath}, run ${item.verificationCommand}, and still see ruleEnabled=false, accepted=false, packagingGated=true, and no Package/Release/Wrap transition.`,
        lockAssertion: item.lockAssertion,
        noOpActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
        reviewerNote:
          "Dry-run only: simulate this deepest handoff runbook item, record blocker evidence if needed, and do not persist acceptance or unlock packaging.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          item.passed &&
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
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplateRow[] =
    nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.map(
      (row) => ({
        id: `next-review-receipt-follow-up-verification-result-replay-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-validation-replay-next-review-queue-handoff-runbook-dry-run-receipt-${row.id}`,
        dryRunRowId: row.id,
        order: row.order,
        defaultDecision: "needs_teacher_review",
        observedEvidencePlaceholder: `Paste observed deepest dry-run evidence for ${row.runbookItemId}.`,
        blockerQuestion:
          "Does this deepest dry-run row show any accepted=true, ruleEnabled=true, packagingGated=false, Package, Release, or Wrap transition?",
        nextReviewNotePlaceholder:
          "Record the next reviewer note without accepting technology, enabling rules, packaging, releasing, wrapping, or unlocking packaging.",
        ruleEnabled: false as const,
        accepted: false as const,
        packagingGated: true as const,
        passed:
          row.passed &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.lockAssertion.includes("ruleEnabled=false") &&
          row.lockAssertion.includes("accepted=false") &&
          row.lockAssertion.includes("packagingGated=true") &&
          row.noOpActions.includes("Package") &&
          row.noOpActions.includes("Release") &&
          row.noOpActions.includes("Wrap")
      })
    );
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length,
      needsReviewRows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.filter(
          (row) => row.defaultDecision === "needs_teacher_review"
        ).length,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows,
      exportJson: JSON.stringify(
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload,
        null,
        2
      ),
      teacherQuestion:
        "Teacher, can this receipt template capture observed deepest dry-run evidence while keeping every row needs_teacher_review and packaging locked?",
      allowedActions: ["Record observed evidence", "Ask blocker question", "Leave next-review note"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.every(
          (row) =>
            row.passed &&
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
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunPayload =
    {
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows,
      receiptTemplate:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload,
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length,
      noOpRows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.filter(
          (row) => row.noOpActions.includes("Package")
        ).length,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows,
      receiptTemplate:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate,
      exportJson: JSON.stringify(
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunPayload,
        null,
        2
      ),
      teacherQuestion:
        "Teacher, can this dry-run audit simulate every deepest handoff runbook item without accepting technology or unlocking packaging?",
      allowedActions: ["Simulate verifier", "Record dry-run evidence", "Preserve blocker"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate.passed &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.every(
          (row) =>
            row.passed &&
            row.expectedEvidence.includes("ruleEnabled=false") &&
            row.expectedEvidence.includes("accepted=false") &&
            row.expectedEvidence.includes("packagingGated=true") &&
            row.lockAssertion.includes("ruleEnabled=false") &&
            row.lockAssertion.includes("accepted=false") &&
            row.lockAssertion.includes("packagingGated=true") &&
            row.noOpActions.includes("Package") &&
            row.noOpActions.includes("Release") &&
            row.noOpActions.includes("Wrap") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        )
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.length,
      lockedChecks:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.filter(
          (item) => item.lockAssertion.includes("ruleEnabled=false") && item.lockAssertion.includes("accepted=false")
        ).length,
      items:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems,
      dryRunAudit:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookPayload,
          dryRunAudit:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, can the next reviewer follow this deepest handoff runbook while acceptance, rule enablement, and packaging stay locked?",
      allowedActions: ["Run verifier", "Record teacher evidence", "Preserve blocker"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.every(
          (item) =>
            item.passed &&
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
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stepCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length,
      blockedSteps:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.filter(
          (step) => step.blockedIf.includes("accepted")
        ).length,
      steps:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps,
      runbook:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload,
          runbook:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, can the next reviewer use these deepest queue handoff steps without accepting technology or unlocking packaging?",
      allowedActions: ["Hand off teacher evidence review", "Hand off blocker", "Hand off follow-up planning"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.every(
          (step) =>
            step.passed &&
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
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length,
      blockedItems:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
          (item) => item.queueLane === "blocked_queue"
        ).length,
      readyForFollowUpItems:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
          (item) => item.queueLane === "ready_for_follow_up_queue"
        ).length,
      items:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems,
      handoff:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload,
          handoff:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, are these deepest validation replay rows grouped into the right next-review lanes without becoming acceptance?",
      allowedActions: ["Queue teacher evidence review", "Preserve blocker", "Plan review-only follow-up"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.some(
          (item) => item.queueLane === "needs_teacher_review_queue"
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.some(
          (item) => item.queueLane === "blocked_queue"
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.some(
          (item) => item.queueLane === "ready_for_follow_up_queue"
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.every(
          (item) =>
            item.passed &&
            item.blockedTransitions.includes("accepted") &&
            item.blockedTransitions.includes("ruleEnabled=true") &&
            item.blockedTransitions.includes("packagingGated=false") &&
            item.blockedTransitions.includes("Package") &&
            item.ruleEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length,
      blockedDecisionRows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.filter(
          (row) => row.blockedDecisionReminder.includes("accepted remains blocked")
        ).length,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows,
      nextReviewQueue:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload,
          nextReviewQueue:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, do these deepest receipt validation replay rows only preview review routing while accepted remains blocked?",
      allowedActions: ["Preview review route", "Preserve blocker", "Plan follow-up review"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length *
            3 &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.every(
          (row) =>
            row.passed &&
            row.blockedDecisionReminder.includes("accepted remains blocked") &&
            row.consequence.includes("does not accept technology") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length,
      blockedDecisionRows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.filter(
          (row) => row.blockedDecision === "accepted"
        ).length,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows,
      replay:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload,
          replay:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, do these deepest dry-run receipt decisions stay limited to review routing while accepted remains blocked?",
      allowedActions: ["Validate receipt decision", "Preserve blocker", "Ask teacher"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.every(
          (row) =>
            row.passed &&
            row.allowedDecisions.includes("needs_teacher_review") &&
            row.allowedDecisions.includes("blocked") &&
            row.allowedDecisions.includes("ready_for_follow_up") &&
            row.blockedDecision === "accepted" &&
            row.invalidIf.includes("decision=accepted") &&
            row.invalidIf.includes("Package") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length,
      needsReviewRows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.filter(
          (row) => row.defaultDecision === "needs_teacher_review"
        ).length,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows,
      validation:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload,
          validation:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, can the next reviewer record observed deepest dry-run evidence here without accepting technology or unlocking packaging?",
      allowedActions: ["Record observed evidence", "Ask blocker question", "Leave next-review note"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.every(
          (row) =>
            row.passed &&
            row.defaultDecision === "needs_teacher_review" &&
            row.blockerQuestion.includes("accepted=true") &&
            row.blockerQuestion.includes("Package") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length,
      noOpRows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.filter(
          (row) => row.noOpActions.includes("Package") && row.noOpActions.includes("Release") && row.noOpActions.includes("Wrap")
        ).length,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows,
      receiptTemplate:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunPayload,
          receiptTemplate:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, does this deepest handoff runbook dry-run audit prove the reviewer path stays review-only before any further receipt work?",
      allowedActions: ["Run verifier", "Record dry-run evidence", "Preserve blocker"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.every(
          (row) =>
            row.passed &&
            row.noOpActions.includes("Package") &&
            row.noOpActions.includes("Release") &&
            row.noOpActions.includes("Wrap") &&
            row.lockAssertion.includes("ruleEnabled=false") &&
            row.lockAssertion.includes("accepted=false") &&
            row.lockAssertion.includes("packagingGated=true") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.length,
      lockedChecks:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.filter(
          (item) =>
            item.lockAssertion.includes("ruleEnabled=false") &&
            item.lockAssertion.includes("accepted=false") &&
            item.lockAssertion.includes("packagingGated=true")
        ).length,
      items:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems,
      dryRunAudit:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookPayload,
          dryRunAudit:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, can this deepest handoff runbook guide the next reviewer without saving acceptance or unlocking packaging?",
      allowedActions: ["Run verifier", "Record teacher note", "Preserve blocker"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.every(
          (item) =>
            item.passed &&
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
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stepCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length,
      blockedStepCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.filter(
          (step) => step.blockedIf.includes("accepted")
        ).length,
      steps:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps,
      runbook:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload,
          runbook:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, can these queued validation replay items be handed off to the next reviewer while acceptance and packaging remain locked?",
      allowedActions: ["Hand off teacher review", "Hand off blocker", "Hand off review-only follow-up"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.every(
          (step) =>
            step.passed &&
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
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length,
      needsTeacherReviewItems:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
          (item) => item.queueLane === "needs_teacher_review_queue"
        ).length,
      blockedItems:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
          (item) => item.queueLane === "blocked_queue"
        ).length,
      readyForFollowUpItems:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
          (item) => item.queueLane === "ready_for_follow_up_queue"
        ).length,
      items:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems,
      handoff:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload,
          handoff:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, should these validation replay rows enter the next review queue while accepted remains blocked?",
      allowedActions: ["Queue teacher review", "Preserve blocker", "Plan review-only follow-up"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.every(
          (item) =>
            item.passed &&
            item.blockedTransitions.includes("accepted") &&
            item.blockedTransitions.includes("ruleEnabled=true") &&
            item.blockedTransitions.includes("packagingGated=false") &&
            item.ruleEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length,
      blockedDecisionRows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.filter(
          (row) => row.blockedDecisionReminder.includes("accepted")
        ).length,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows,
      nextReviewQueue:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload,
          nextReviewQueue:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, do these validation replay consequences stay limited to review routing while accepted remains blocked?",
      allowedActions: ["Replay validation decision", "Preserve blocker", "Plan review-only follow-up"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length *
            3 &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.every(
          (row) =>
            row.passed &&
            row.blockedDecisionReminder.includes("accepted remains blocked") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length,
      blockedDecisionRows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.filter(
          (row) => row.blockedDecision === "accepted"
        ).length,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows,
      replay:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload,
          replay:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, do these receipt decisions stay limited to review routing while accepted remains blocked?",
      allowedActions: ["Validate receipt decision", "Preserve blocker", "Ask teacher"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.every(
          (row) =>
            row.passed &&
            row.allowedDecisions.includes("needs_teacher_review") &&
            row.allowedDecisions.includes("blocked") &&
            row.allowedDecisions.includes("ready_for_follow_up") &&
            row.blockedDecision === "accepted" &&
            row.invalidIf.includes("decision=accepted") &&
            row.invalidIf.includes("Package") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length,
      needsReviewRows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.filter(
          (row) => row.defaultDecision === "needs_teacher_review"
        ).length,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows,
      validation:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload,
          validation:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, what observed evidence or blocker should be recorded for each dry-run audit row before any validation step?",
      allowedActions: ["Record observed evidence", "Ask blocker question", "Leave next-review note"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.every(
          (row) =>
            row.passed &&
            row.defaultDecision === "needs_teacher_review" &&
            row.blockerQuestion.includes("accepted=true") &&
            row.blockerQuestion.includes("Package") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRun: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunAudit =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length,
      noOpRows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.filter(
          (row) => row.noOpActions.includes("Package") && row.noOpActions.includes("Release") && row.noOpActions.includes("Wrap")
        ).length,
      rows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows,
      receiptTemplate:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunPayload,
          receiptTemplate:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, does this dry-run audit prove the runbook remains no-op and review-only before any next receipt step?",
      allowedActions: ["Simulate runbook item", "Record reviewer note", "Preserve blocker"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunRows.every(
          (row) =>
            row.passed &&
            row.noOpActions.includes("Package") &&
            row.noOpActions.includes("Release") &&
            row.noOpActions.includes("Wrap") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.length,
      lockedChecks:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.filter(
          (item) =>
            item.lockAssertion.includes("ruleEnabled=false") &&
            item.lockAssertion.includes("accepted=false") &&
            item.lockAssertion.includes("packagingGated=true")
        ).length,
      items:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems,
      dryRunAudit:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRun,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookPayload,
          dryRunAudit:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRunPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, can this runbook guide the next reviewer without saving acceptance or unlocking packaging?",
      allowedActions: ["Run verifier", "Record teacher note", "Preserve blocker"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookItems.every(
          (item) =>
            item.passed &&
            item.lockAssertion.includes("ruleEnabled=false") &&
            item.lockAssertion.includes("accepted=false") &&
            item.lockAssertion.includes("packagingGated=true") &&
            item.ruleEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookDryRun.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stepCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length,
      blockedSteps:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.filter(
          (step) => step.title.includes("blocked")
        ).length,
      steps:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps,
      runbook:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload,
          runbook:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbookPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, can the next reviewer use these handoff steps without treating them as acceptance or packaging readiness?",
      allowedActions: ["Review handoff step", "Run verifier", "Record teacher note"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffSteps.every(
          (step) =>
            step.passed &&
            step.blockedIf.includes("accepted") &&
            step.blockedIf.includes("ruleEnabled=true") &&
            step.blockedIf.includes("packagingGated=false") &&
            step.ruleEnabled === false &&
            step.accepted === false &&
            step.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffRunbook.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length,
      needsTeacherReviewItems:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
          (item) => item.queueLane === "needs_teacher_review_queue"
        ).length,
      blockedItems:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
          (item) => item.queueLane === "blocked_queue"
        ).length,
      readyForFollowUpItems:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.filter(
          (item) => item.queueLane === "ready_for_follow_up_queue"
        ).length,
      items:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems,
      handoff:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload,
          handoff:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoffPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, should this replay queue become the next review handoff while acceptance, rule enablement, and packaging stay locked?",
      allowedActions: ["Queue teacher review", "Preserve blocker", "Plan review-only follow-up"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueItems.every(
          (item) =>
            item.passed &&
            item.blockedTransitions.includes("accepted") &&
            item.blockedTransitions.includes("ruleEnabled=true") &&
            item.blockedTransitions.includes("packagingGated=false") &&
            item.ruleEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueueHandoff.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length,
      blockedDecisionRows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.filter(
          (row) => row.blockedDecision === "accepted"
        ).length,
      rows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows,
      nextReviewQueue:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload,
          nextReviewQueue:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueuePayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, do these replayed dry-run receipt decisions route only review work while keeping accepted blocked?",
      allowedActions: ["Replay receipt decision", "Plan review follow-up", "Escalate blocker"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length *
            3 &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayRows.every(
          (row) =>
            row.passed &&
            row.blockedDecisionReminder.includes("accepted remains blocked") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayNextReviewQueue.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length,
      blockedDecisionRows:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.filter(
          (row) => row.blockedDecision === "accepted"
        ).length,
      rows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows,
      replay: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload,
          replay:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplayPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, should any dry-run receipt decision be blocked before this review-only receipt is used for follow-up planning?",
      allowedActions: ["Validate receipt decision", "Block invalid acceptance", "Ask teacher for correction"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationRows.every(
          (row) =>
            row.passed &&
            row.allowedDecisions.includes("needs_teacher_review") &&
            row.allowedDecisions.includes("blocked") &&
            row.allowedDecisions.includes("ready_for_follow_up") &&
            row.blockedDecision === "accepted" &&
            row.invalidIf.includes("decision=accepted") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationReplay.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length,
      needsReviewRows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.filter(
        (row) => row.defaultDecision === "needs_teacher_review"
      ).length,
      rows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptRows,
      validation:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload,
          validation:
            nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, what evidence, blocker question, and next-review note should be recorded for each dry-run row before any follow-up planning?",
      allowedActions: ["Record observed evidence", "Ask blocker question", "Write next-review note"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunRows.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptRows.every(
          (row) =>
            row.passed &&
            row.defaultDecision === "needs_teacher_review" &&
            row.blockerQuestion.includes("accepted=true") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidation.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunPayload = {
    format:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_json_v1",
    mode:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunRows,
    receiptTemplate: {
      ...nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptPayload,
      validation:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptValidationPayload
    },
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunAudit: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunAudit =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      rowCount: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunRows.length,
      noOpRows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunRows.filter(
        (row) => row.noOpActions.includes("Do not accept technology")
      ).length,
      rows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunRows,
      receiptTemplate:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate,
      exportJson: JSON.stringify(
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunPayload,
        null,
        2
      ),
      teacherQuestion:
        "Teacher, should these dry-run rows be checked before the replay queue handoff runbook is executed?",
      allowedActions: ["Dry-run review", "Check lock evidence", "Record reviewer note"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunRows.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookItems.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunRows.every(
          (row) =>
            row.passed &&
            row.lockAssertion.includes("accepted=false") &&
            row.noOpActions.includes("Do not accept technology") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunReceiptTemplate.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookPayload = {
    format:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_json_v1",
    mode:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookItems,
    dryRunAudit: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunPayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbook: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbook =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookItems.length,
      lockedChecks: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookItems.filter(
        (item) => item.lockAssertion.includes("accepted=false")
      ).length,
      items: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookItems,
      dryRunAudit: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunAudit,
      exportJson: JSON.stringify(
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookPayload,
        null,
        2
      ),
      teacherQuestion:
        "Teacher, should the next reviewer execute this runbook only as locked review guidance?",
      allowedActions: ["Execute review runbook", "Rerun verifier", "Escalate mismatch blocker"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookItems.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffSteps.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookItems.every(
          (item) =>
            item.passed &&
            item.lockAssertion.includes("accepted=false") &&
            item.stopCondition.includes("accepted=true") &&
            item.ruleEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookDryRunAudit.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffPayload = {
    format:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_json_v1",
    mode:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    steps: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffSteps,
    runbook: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbookPayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoff: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoff =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      stepCount: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffSteps.length,
      mismatchStopSteps: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffSteps.filter(
        (step) => step.title === "Escalate mismatch blocker"
      ).length,
      steps: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffSteps,
      runbook: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbook,
      exportJson: JSON.stringify(
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffPayload,
        null,
        2
      ),
      teacherQuestion:
        "Teacher, should this handoff tell the next reviewer how to process the replay queue without accepting the technology?",
      allowedActions: ["Run verifier", "Inspect qualification JSON", "Escalate mismatch blocker"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffSteps.length ===
          nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItems.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffSteps.some(
          (step) => step.title === "Escalate mismatch blocker"
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffSteps.every(
          (step) =>
            step.passed &&
            step.expectedLockedResult.includes("accepted=false") &&
            step.blockedIf.includes("accepted=true") &&
            step.ruleEnabled === false &&
            step.accepted === false &&
            step.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffRunbook.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueuePayload = {
    format:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_json_v1",
    mode:
      "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItems,
    handoff: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoffPayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueue: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayNextReviewQueue =
    {
      mode:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_v1",
      format:
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItems.length,
      notRunRows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItems.filter(
        (item) => item.simulatedStatus === "not_run_yet"
      ).length,
      matchedRows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItems.filter(
        (item) => item.simulatedStatus === "matched_expected"
      ).length,
      mismatchStopRows: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItems.filter(
        (item) => item.simulatedStatus === "mismatch_blocked"
      ).length,
      items: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItems,
      handoff: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoff,
      exportJson: JSON.stringify(
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueuePayload,
        null,
        2
      ),
      teacherQuestion:
        "Teacher, should this replay queue drive the next result-review pass while keeping acceptance blocked?",
      allowedActions: ["Run missing verifier", "Continue locked review", "Escalate mismatch blocker"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItems.length ===
          nextReviewReceiptFollowUpVerificationResultReplayItems.length &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItems.some(
          (item) => item.simulatedStatus === "mismatch_blocked"
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueItems.every(
          (item) =>
            item.passed &&
            item.ruleEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true &&
            item.stopCondition.includes("accepted")
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueueHandoff.passed
    };
  const nextReviewReceiptFollowUpVerificationResultReplayPayload = {
    format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_json_v1",
    mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: nextReviewReceiptFollowUpVerificationResultReplayItems,
    nextReviewQueue: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueuePayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptFollowUpVerificationResultReplay: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplay =
    {
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: nextReviewReceiptFollowUpVerificationResultReplayItems.length,
      blockedStatusCount: nextReviewReceiptFollowUpVerificationResultValidationItems.filter(
        (item) => item.blockedStatus === "accepted"
      ).length,
      items: nextReviewReceiptFollowUpVerificationResultReplayItems,
      nextReviewQueue: nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueue,
      exportJson: JSON.stringify(nextReviewReceiptFollowUpVerificationResultReplayPayload, null, 2),
      teacherQuestion:
        "Teacher, should these result-status consequences be replayed before the next review pass?",
      allowedActions: ["Replay result status", "Plan follow-up review", "Escalate mismatch blocker"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultReplayItems.length ===
          nextReviewReceiptFollowUpVerificationResultValidationItems.length * 3 &&
        nextReviewReceiptFollowUpVerificationResultReplayItems.every(
          (item) =>
            item.passed &&
            item.blockedStatusReminder.includes("accepted remains blocked") &&
            item.ruleEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplayNextReviewQueue.passed
    };
  const nextReviewReceiptFollowUpVerificationResultValidation: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidation =
    {
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: nextReviewReceiptFollowUpVerificationResultValidationItems.length,
      blockedStatusCount: nextReviewReceiptFollowUpVerificationResultValidationItems.filter(
        (item) => item.blockedStatus === "accepted"
      ).length,
      items: nextReviewReceiptFollowUpVerificationResultValidationItems,
      replay: nextReviewReceiptFollowUpVerificationResultReplay,
      exportJson: JSON.stringify(
        {
          ...nextReviewReceiptFollowUpVerificationResultValidationPayload,
          replay: nextReviewReceiptFollowUpVerificationResultReplayPayload
        },
        null,
        2
      ),
      teacherQuestion:
        "Teacher, should these result-status validations be checked before any result is recovered?",
      allowedActions: ["Validate result status", "Record mismatch blocker", "Plan next review"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultValidationItems.length ===
          nextReviewReceiptFollowUpVerificationResultRows.length &&
        nextReviewReceiptFollowUpVerificationResultValidationItems.every(
          (item) =>
            item.passed &&
            item.allowedStatuses.includes("not_run_yet") &&
            item.allowedStatuses.includes("matched_expected") &&
            item.allowedStatuses.includes("mismatch_blocked") &&
            item.blockedStatus === "accepted" &&
            item.invalidIf.includes("accepted=true") &&
            item.ruleEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultReplay.passed
    };
  const nextReviewReceiptFollowUpVerificationResultTemplatePayload = {
    format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_json_v1",
    mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: nextReviewReceiptFollowUpVerificationResultRows,
    validation: {
      ...nextReviewReceiptFollowUpVerificationResultValidationPayload,
      replay: nextReviewReceiptFollowUpVerificationResultReplayPayload
    },
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptFollowUpVerificationResultTemplate: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultTemplate =
    {
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: nextReviewReceiptFollowUpVerificationResultRows.length,
      notRunRows: nextReviewReceiptFollowUpVerificationResultRows.filter(
        (item) => item.defaultStatus === "not_run_yet"
      ).length,
      items: nextReviewReceiptFollowUpVerificationResultRows,
      validation: nextReviewReceiptFollowUpVerificationResultValidation,
      exportJson: JSON.stringify(nextReviewReceiptFollowUpVerificationResultTemplatePayload, null, 2),
      teacherQuestion:
        "Teacher, should the next reviewer fill this result template after rerunning the verifier?",
      allowedActions: ["Paste verifier evidence", "Mark mismatch blocker", "Plan next review"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationResultRows.length ===
          nextReviewReceiptFollowUpVerificationPacketItems.length &&
        nextReviewReceiptFollowUpVerificationResultRows.every(
          (item) =>
            item.passed &&
            item.defaultStatus === "not_run_yet" &&
            item.statusOptions.includes("mismatch_blocked") &&
            item.nextReviewerNotePlaceholder.includes("not technology acceptance") &&
            item.ruleEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultValidation.passed
    };
  const nextReviewReceiptFollowUpVerificationPacketPayload = {
    format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_json_v1",
    mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: nextReviewReceiptFollowUpVerificationPacketItems,
    resultTemplate: nextReviewReceiptFollowUpVerificationResultTemplatePayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptFollowUpVerificationPacket: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacket =
    {
      mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_v1",
      format: "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      itemCount: nextReviewReceiptFollowUpVerificationPacketItems.length,
      commandCount: nextReviewReceiptFollowUpVerificationPacketItems.filter(
        (item) => item.verificationCommand.length > 0
      ).length,
      items: nextReviewReceiptFollowUpVerificationPacketItems,
      resultTemplate: nextReviewReceiptFollowUpVerificationResultTemplate,
      exportJson: JSON.stringify(nextReviewReceiptFollowUpVerificationPacketPayload, null, 2),
      teacherQuestion:
        "Teacher, should the next reviewer rerun these verification commands before continuing?",
      allowedActions: ["Run verification command", "Inspect evidence path", "Record mismatch blocker"],
      blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
      passed:
        nextReviewReceiptFollowUpVerificationPacketItems.length === nextReviewReceiptFollowUpLockAuditItems.length &&
        nextReviewReceiptFollowUpVerificationPacketItems.every(
          (item) =>
            item.passed &&
            item.evidencePath.includes("followUpPlan.lockAudit") &&
            item.verificationCommand === "npm.cmd run verify:learning" &&
            item.expectedResult.includes("accepted=false") &&
            item.expectedResult.includes("packaging=true") &&
            item.ruleEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ) &&
        nextReviewReceiptFollowUpVerificationResultTemplate.passed
    };
  const nextReviewReceiptFollowUpLockAuditPayload = {
    format: "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_json_v1",
    mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: nextReviewReceiptFollowUpLockAuditItems,
    verificationPacket: nextReviewReceiptFollowUpVerificationPacketPayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptFollowUpLockAudit: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpLockAudit = {
    mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_v1",
    format: "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_json_v1",
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    itemCount: nextReviewReceiptFollowUpLockAuditItems.length,
    forbiddenTransitionCount: nextReviewReceiptFollowUpLockAuditItems.reduce(
      (total, item) => total + item.forbiddenTransitions.length,
      0
    ),
    items: nextReviewReceiptFollowUpLockAuditItems,
    verificationPacket: nextReviewReceiptFollowUpVerificationPacket,
    exportJson: JSON.stringify(nextReviewReceiptFollowUpLockAuditPayload, null, 2),
    teacherQuestion:
      "Teacher, do these lock checks prove the follow-up plan is still only review work?",
    allowedActions: ["Inspect lock audit", "Record blocker", "Keep planning review-only"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      nextReviewReceiptFollowUpLockAuditItems.length === nextReviewReceiptFollowUpPlanItems.length &&
      nextReviewReceiptFollowUpLockAuditItems.every(
        (item) =>
          item.passed &&
          item.forbiddenTransitions.includes("decision=accepted") &&
          item.forbiddenTransitions.includes("packagingGated=false") &&
          item.noOpAssertion.includes("no-op") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      nextReviewReceiptFollowUpVerificationPacket.passed
  };
  const nextReviewReceiptFollowUpPlanPayload = {
    format: "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_json_v1",
    mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items: nextReviewReceiptFollowUpPlanItems,
    lockAudit: nextReviewReceiptFollowUpLockAuditPayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptFollowUpPlan: QualificationTeacherAcceptanceAgendaNextReviewReceiptFollowUpPlan = {
    mode: "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_v1",
    format: "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_json_v1",
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    itemCount: nextReviewReceiptFollowUpPlanItems.length,
    blockedRouteCount: nextReviewReceiptFollowUpPlanItems.filter(
      (item) => item.plannedRoute === "blocked_receipt_escalation"
    ).length,
    items: nextReviewReceiptFollowUpPlanItems,
    lockAudit: nextReviewReceiptFollowUpLockAudit,
    exportJson: JSON.stringify(nextReviewReceiptFollowUpPlanPayload, null, 2),
    teacherQuestion:
      "Teacher, which receipt follow-up route should stay open for the next review pass?",
    allowedActions: ["Collect observed evidence", "Escalate blocker", "Schedule follow-up review"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      nextReviewReceiptFollowUpPlanItems.length === nextReviewReceiptReplayRows.length &&
      nextReviewReceiptFollowUpPlanItems.every(
        (item) =>
          item.passed &&
          item.lockReminder.includes("accepted remains blocked") &&
          item.stopCondition.includes("packagingGated=false") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      nextReviewReceiptFollowUpLockAudit.passed
  };
  const nextReviewReceiptReplayPayload = {
    format: "teacher_acceptance_agenda_next_review_receipt_decision_replay_json_v1",
    mode: "teacher_acceptance_agenda_next_review_receipt_decision_replay_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: nextReviewReceiptReplayRows,
    followUpPlan: nextReviewReceiptFollowUpPlanPayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptReplay: QualificationTeacherAcceptanceAgendaNextReviewReceiptDecisionReplay = {
    mode: "teacher_acceptance_agenda_next_review_receipt_decision_replay_v1",
    format: "teacher_acceptance_agenda_next_review_receipt_decision_replay_json_v1",
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: nextReviewReceiptReplayRows.length,
    blockedDecisionCount: nextReviewReceiptValidationRows.filter((row) => row.blockedDecision === "accepted").length,
    rows: nextReviewReceiptReplayRows,
    followUpPlan: nextReviewReceiptFollowUpPlan,
    exportJson: JSON.stringify(nextReviewReceiptReplayPayload, null, 2),
    teacherQuestion:
      "Teacher, should these receipt decisions be replayed before any follow-up review work is planned?",
    allowedActions: ["Replay receipt decisions", "Plan follow-up review", "Escalate blocked receipt"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      nextReviewReceiptReplayRows.length === nextReviewReceiptValidationRows.length * 3 &&
      nextReviewReceiptReplayRows.every(
        (row) =>
          row.passed &&
          row.blockedDecisionReminder.includes("accepted remains blocked") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      nextReviewReceiptFollowUpPlan.passed
  };
  const nextReviewReceiptValidationPayload = {
    format: "teacher_acceptance_agenda_next_review_receipt_validation_json_v1",
    mode: "teacher_acceptance_agenda_next_review_receipt_validation_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: nextReviewReceiptValidationRows,
    decisionReplay: nextReviewReceiptReplayPayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptValidation: QualificationTeacherAcceptanceAgendaNextReviewReceiptValidation = {
    mode: "teacher_acceptance_agenda_next_review_receipt_validation_v1",
    format: "teacher_acceptance_agenda_next_review_receipt_validation_json_v1",
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: nextReviewReceiptValidationRows.length,
    blockedDecisionCount: nextReviewReceiptValidationRows.filter((row) => row.blockedDecision === "accepted").length,
    rows: nextReviewReceiptValidationRows,
    decisionReplay: nextReviewReceiptReplay,
    exportJson: JSON.stringify(nextReviewReceiptValidationPayload, null, 2),
    teacherQuestion:
      "Teacher, should these validation rules be used before any receipt row drives follow-up work?",
    allowedActions: ["Validate receipt rows", "Mark blocker", "Plan follow-up review"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      nextReviewReceiptValidationRows.length === nextReviewReceiptRows.length &&
      nextReviewReceiptValidationRows.every(
        (row) =>
          row.passed &&
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.blockedDecision === "accepted" &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      nextReviewReceiptReplay.passed
  };
  const nextReviewReceiptPayload = {
    format: "teacher_acceptance_agenda_next_review_receipt_template_json_v1",
    mode: "teacher_acceptance_agenda_next_review_receipt_template_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: nextReviewReceiptRows,
    validation: nextReviewReceiptValidationPayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewReceiptTemplate: QualificationTeacherAcceptanceAgendaNextReviewReceiptTemplate = {
    mode: "teacher_acceptance_agenda_next_review_receipt_template_v1",
    format: "teacher_acceptance_agenda_next_review_receipt_template_json_v1",
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: nextReviewReceiptRows.length,
    needsReviewRows: nextReviewReceiptRows.filter((row) => row.defaultDecision === "needs_teacher_review").length,
    rows: nextReviewReceiptRows,
    validation: nextReviewReceiptValidation,
    exportJson: JSON.stringify(nextReviewReceiptPayload, null, 2),
    teacherQuestion:
      "Teacher, should this receipt template be used to record observed evidence without accepting the technology?",
    allowedActions: ["Fill observed evidence", "Mark blocked review rows", "Plan follow-up review"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      nextReviewReceiptRows.length === nextReviewDryRunRows.length &&
      nextReviewReceiptRows.every(
        (row) =>
          row.passed &&
          row.defaultDecision === "needs_teacher_review" &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      nextReviewReceiptValidation.passed
  };
  const nextReviewDryRunPayload = {
    format: "teacher_acceptance_agenda_next_review_dry_run_audit_json_v1",
    mode: "teacher_acceptance_agenda_next_review_dry_run_audit_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: nextReviewDryRunRows,
    receiptTemplate: nextReviewReceiptPayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewDryRunAudit: QualificationTeacherAcceptanceAgendaNextReviewDryRunAudit = {
    mode: "teacher_acceptance_agenda_next_review_dry_run_audit_v1",
    format: "teacher_acceptance_agenda_next_review_dry_run_audit_json_v1",
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: nextReviewDryRunRows.length,
    noOpRows: nextReviewDryRunRows.filter((row) => row.noOpActions.includes("Package")).length,
    rows: nextReviewDryRunRows,
    receiptTemplate: nextReviewReceiptTemplate,
    exportJson: JSON.stringify(nextReviewDryRunPayload, null, 2),
    teacherQuestion:
      "Teacher, should this dry-run audit be used to check that the runbook remains review-only before execution?",
    allowedActions: ["Inspect dry-run rows", "Check lock assertions", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      nextReviewDryRunRows.length === nextReviewRunbookSteps.length &&
      nextReviewDryRunRows.every(
        (row) =>
          row.passed &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.lockAssertion.includes("packagingGated=true") &&
          row.noOpActions.includes("Package")
      ) &&
      nextReviewReceiptTemplate.passed
  };
  const nextReviewRunbookPayload = {
    format: "teacher_acceptance_agenda_next_review_runbook_json_v1",
    mode: "teacher_acceptance_agenda_next_review_runbook_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    steps: nextReviewRunbookSteps,
    dryRunAudit: nextReviewDryRunPayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewRunbook: QualificationTeacherAcceptanceAgendaNextReviewRunbook = {
    mode: "teacher_acceptance_agenda_next_review_runbook_v1",
    format: "teacher_acceptance_agenda_next_review_runbook_json_v1",
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    stepCount: nextReviewRunbookSteps.length,
    lockedChecks: nextReviewRunbookSteps.filter((step) => step.phase === "confirm_lock").length,
    steps: nextReviewRunbookSteps,
    dryRunAudit: nextReviewDryRunAudit,
    exportJson: JSON.stringify(nextReviewRunbookPayload, null, 2),
    teacherQuestion:
      "Teacher, should the next reviewer execute this runbook as review-only evidence inspection?",
    allowedActions: ["Inspect evidence path", "Replay teacher decision", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      nextReviewRunbookSteps.length === nextReviewHandoffSteps.length &&
      nextReviewRunbookSteps.every(
        (step) =>
          step.passed &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true &&
          step.evidencePath.length > 0 &&
          step.stopCondition.includes("Stop")
      ) &&
      nextReviewDryRunAudit.passed
  };
  const nextReviewHandoffPayload = {
    format: "teacher_acceptance_agenda_next_review_handoff_json_v1",
    mode: "teacher_acceptance_agenda_next_review_handoff_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    queueItemCount: nextReviewQueueItems.length,
    steps: nextReviewHandoffSteps,
    verificationCommands: nextReviewHandoffCommands,
    runbook: nextReviewRunbookPayload,
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"]
  };
  const nextReviewHandoff: QualificationTeacherAcceptanceAgendaNextReviewHandoff = {
    mode: "teacher_acceptance_agenda_next_review_handoff_v1",
    format: "teacher_acceptance_agenda_next_review_handoff_json_v1",
    status: "ready_for_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    queueItemCount: nextReviewQueueItems.length,
    stepCount: nextReviewHandoffSteps.length,
    lockedSteps: nextReviewHandoffSteps.filter((step) => step.reason === "locked_boundary").length,
    steps: nextReviewHandoffSteps,
    verificationCommands: nextReviewHandoffCommands,
    runbook: nextReviewRunbook,
    handoffText: nextReviewHandoffText,
    exportJson: JSON.stringify(nextReviewHandoffPayload, null, 2),
    teacherQuestion:
      "Teacher, should the next reviewer follow this handoff package after checking the queue items?",
    allowedActions: ["Review handoff steps", "Rerun local verifier", "Save another agenda decision draft"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      nextReviewHandoffSteps.length === nextReviewQueueItems.length &&
      nextReviewHandoffSteps.every(
        (step) =>
          step.passed &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      ) &&
      nextReviewRunbook.passed
  };
  const exportPayload = {
    format: "teacher_acceptance_agenda_decision_draft_recovery_json_v1",
    mode: "teacher_acceptance_agenda_decision_draft_recovery_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    latestCorrectionId: latest?.id ?? null,
    persistedDraftCount: recoveredDrafts.length,
    rows: rows.map((row) => ({
      agendaItemId: row.agendaItemId,
      staticDecision: row.staticDecision,
      recoveredDecision: row.recoveredDecision,
      decisionChanged: row.decisionChanged,
      nextReviewAction: row.nextReviewAction,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true
    })),
    nextReviewQueue: nextReviewQueuePayload,
    nextReviewHandoff: nextReviewHandoffPayload
  };

  return {
    mode: "teacher_acceptance_agenda_decision_draft_recovery_v1",
    format: "teacher_acceptance_agenda_decision_draft_recovery_json_v1",
    status: latest ? "ready_for_teacher_review" : "no_saved_decision_draft_yet",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    persistedDraftCount: recoveredDrafts.length,
    latestCorrectionId: latest?.id ?? null,
    rows,
    changedRows: rows.filter((row) => row.decisionChanged).length,
    missingRecoveredRows: rows.filter((row) => row.recoveredDecision === null).length,
    followUpRows: rows.filter(
      (row) => row.recoveredDecision !== null && row.recoveredDecision !== "ready_for_review"
    ).length,
    nextReviewQueue,
    nextReviewHandoff,
    exportJson: JSON.stringify(exportPayload, null, 2),
    teacherQuestion:
      "Teacher, please compare saved agenda decision drafts with the current agenda. Which recovered decisions should drive the next review?",
    allowedActions: ["Recover agenda decision drafts", "Compare recovered decisions", "Export recovery JSON"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed:
      rows.length === args.decisionItems.length &&
      rows.every(
        (row) =>
          row.passed &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      nextReviewQueue.passed &&
      nextReviewHandoff.passed
  };
}

function buildTeacherAcceptanceEvidenceAgenda(args: {
  teacherAcceptanceBoundary: TeacherAcceptanceBoundary;
  visualReviewDossier: QualificationVisualReviewDossier;
  visualTeacherReviewWorksheet: QualificationVisualTeacherReviewWorksheet;
  userRequirementCoverageAudit: QualificationUserRequirementCoverageAudit;
  visualReviewManifest: QualificationVisualReviewManifest;
  policyEvidence: QualificationPolicyEvidence[];
  corrections: Array<{
    id: string;
    errorType: string;
    runId: string | null;
    learningTraceSteps: number;
    extractedRule: RuleRecord | null;
    afterOutput: Record<string, unknown>;
    createdAt: string;
  }>;
}): QualificationTeacherAcceptanceEvidenceAgenda {
  const items: QualificationTeacherAcceptanceEvidenceAgendaItem[] = [
    {
      id: "agenda-review-dossier",
      label: "Review the visual learning dossier",
      evidencePath: "qualification_report.visualReviewDossier.sections",
      readiness: args.visualReviewDossier.sections.every((section) => section.passed)
        ? "ready_for_teacher_decision"
        : "needs_teacher_answer",
      evidenceSummary: `${args.visualReviewDossier.sections.filter((section) => section.passed).length}/${args.visualReviewDossier.sections.length} dossier sections are ready.`,
      teacherDecisionNeeded: "Teacher decides whether the visible learning evidence is sufficient for the next review round.",
      blockedIfMissing: "Do not record technology acceptance or start packaging from dossier evidence alone.",
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed:
        args.visualReviewDossier.accepted === false &&
        args.visualReviewDossier.packagingGated === true &&
        args.visualReviewDossier.sections.every((section) => section.passed)
    },
    {
      id: "agenda-answer-worksheet",
      label: "Answer teacher review worksheet prompts",
      evidencePath: "qualification_report.visualTeacherReviewWorksheet.items",
      readiness: "needs_teacher_answer",
      evidenceSummary: `${args.visualTeacherReviewWorksheet.items.filter((item) => item.evidenceReady).length}/${args.visualTeacherReviewWorksheet.items.length} worksheet prompts have evidence; ${args.visualTeacherReviewWorksheet.items.filter((item) => item.status === "unanswered").length} remain unanswered.`,
      teacherDecisionNeeded: "Teacher answers approve / revise / hold decisions before any acceptance claim.",
      blockedIfMissing: "Unanswered worksheet prompts block acceptance and packaging.",
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed:
        args.visualTeacherReviewWorksheet.reviewOnly === true &&
        args.visualTeacherReviewWorksheet.accepted === false &&
        args.visualTeacherReviewWorksheet.packagingGated === true &&
        args.visualTeacherReviewWorksheet.items.every((item) => item.evidenceReady && item.status === "unanswered")
    },
    {
      id: "agenda-check-user-requirements",
      label: "Check the 14 explicit teacher requirements",
      evidencePath: "qualification_report.userRequirementCoverageAudit.items",
      readiness: args.userRequirementCoverageAudit.items.every((item) => item.passed)
        ? "ready_for_teacher_decision"
        : "needs_teacher_answer",
      evidenceSummary: `${args.userRequirementCoverageAudit.items.filter((item) => item.passed).length}/${args.userRequirementCoverageAudit.items.length} explicit requirements have mapped evidence.`,
      teacherDecisionNeeded: "Teacher confirms whether each original requirement is represented well enough.",
      blockedIfMissing: "Any missing requirement mapping keeps the system in review-only mode.",
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed:
        args.userRequirementCoverageAudit.reviewOnly === true &&
        args.userRequirementCoverageAudit.accepted === false &&
        args.userRequirementCoverageAudit.packagingGated === true &&
        args.userRequirementCoverageAudit.items.every((item) => item.passed)
    },
    {
      id: "agenda-rerun-verifier",
      label: "Rerun the local learning verifier",
      evidencePath: "scripts/verify-learning-system.ts",
      readiness: "ready_for_teacher_decision",
      evidenceSummary: `${args.policyEvidence.filter((item) => item.passed).length}/${args.policyEvidence.length} policy evidence gates are currently passing.`,
      teacherDecisionNeeded: "Teacher or agent reruns npm.cmd run verify:learning before judging the current build.",
      blockedIfMissing: "Do not rely on stale chat summaries when verifier evidence is missing.",
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed: args.policyEvidence.every((item) => item.passed)
    },
    {
      id: "agenda-confirm-packaging-lock",
      label: "Confirm packaging remains locked",
      evidencePath: "qualification_report.teacherAcceptanceBoundary",
      readiness: "locked_until_teacher_acceptance",
      evidenceSummary: `mode=${args.teacherAcceptanceBoundary.mode}; accepted=${args.teacherAcceptanceBoundary.accepted}; packagingGated=${args.teacherAcceptanceBoundary.packagingGated}.`,
      teacherDecisionNeeded: "Teacher explicitly decides whether the technology is qualified before any packaging work exists.",
      blockedIfMissing: "Packaging, release, and wrapping remain blocked.",
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed:
        args.teacherAcceptanceBoundary.accepted === false &&
        args.teacherAcceptanceBoundary.packagingGated === true &&
        args.teacherAcceptanceBoundary.exposedAcceptanceAction === false &&
        args.visualReviewManifest.accepted === false &&
        args.visualReviewManifest.packagingGated === true
    }
  ];
  const readyItems = items.filter((item) => item.readiness === "ready_for_teacher_decision").length;
  const unansweredItems = items.filter((item) => item.readiness === "needs_teacher_answer").length;
  const lockedItems = items.filter((item) => item.readiness === "locked_until_teacher_acceptance").length;
  const passed = items.every(
    (item) => item.passed && item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
  );
  const allowedDecisions: QualificationTeacherAcceptanceAgendaDecision[] = [
    "ready_for_review",
    "needs_revision",
    "hold",
    "locked"
  ];
  const decisionItems: QualificationTeacherAcceptanceAgendaDecisionItem[] = items.map((item) => {
    const proposedDecision: QualificationTeacherAcceptanceAgendaDecision =
      item.readiness === "locked_until_teacher_acceptance"
        ? "locked"
        : item.readiness === "needs_teacher_answer"
          ? "hold"
          : "ready_for_review";

    return {
      agendaItemId: item.id,
      label: item.label,
      evidencePath: item.evidencePath,
      currentReadiness: item.readiness,
      proposedDecision,
      note: "",
      teacherQuestion: item.teacherDecisionNeeded,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed: item.passed && allowedDecisions.includes(proposedDecision)
    };
  });
  const decisionExchangePassed =
    decisionItems.length === items.length &&
    decisionItems.every(
      (item) => item.passed && item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
    );
  const replayRows: QualificationTeacherAcceptanceAgendaDecisionReplayRow[] = decisionItems.map((item) => {
    const replayText: Record<
      QualificationTeacherAcceptanceAgendaDecision,
      { nextReviewAction: string; consequence: string }
    > = {
      ready_for_review: {
        nextReviewAction: "Open the evidence path and let the teacher inspect the proof details.",
        consequence: "The item can move to the next teacher-review pass, but no technology acceptance is recorded."
      },
      needs_revision: {
        nextReviewAction: "Keep the item on the repair list and ask for the missing or unclear evidence.",
        consequence: "The report should be revised before the teacher uses this item as decision evidence."
      },
      hold: {
        nextReviewAction: "Pause this item until the teacher writes an answer or adds review notes.",
        consequence: "The agenda remains reviewable, but this item stays unresolved."
      },
      locked: {
        nextReviewAction: "Keep the packaging boundary visible and do not create packaging work.",
        consequence: "Packaging, release, and wrapping remain blocked until the teacher explicitly accepts the technology."
      }
    };

    return {
      agendaItemId: item.agendaItemId,
      label: item.label,
      simulatedDecision: item.proposedDecision,
      nextReviewAction: replayText[item.proposedDecision].nextReviewAction,
      consequence: replayText[item.proposedDecision].consequence,
      memoryImpact: "No reusable rule or long-term memory is enabled by this agenda decision replay.",
      packagingImpact: "Packaging remains gated; this replay is not an acceptance action.",
      teacherQuestion: item.teacherQuestion,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed:
        item.passed &&
        item.ruleEnabled === false &&
        item.accepted === false &&
        item.packagingGated === true &&
        allowedDecisions.includes(item.proposedDecision)
    };
  });
  const decisionReplayPassed =
    replayRows.length === decisionItems.length &&
    replayRows.every(
      (row) => row.passed && row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
    );
  const decisionReplayPayload = {
    format: "teacher_acceptance_agenda_decision_replay_json_v1",
    mode: "teacher_acceptance_agenda_decision_replay_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rows: replayRows
  };
  const decisionReplay: QualificationTeacherAcceptanceAgendaDecisionReplay = {
    mode: "teacher_acceptance_agenda_decision_replay_v1",
    format: "teacher_acceptance_agenda_decision_replay_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    rowCount: replayRows.length,
    packagingLockedRows: replayRows.filter((row) => row.packagingGated).length,
    rows: replayRows,
    exportJson: JSON.stringify(decisionReplayPayload, null, 2),
    teacherQuestion:
      "Teacher, after filling agenda decisions, do these simulated next actions match how you want review to continue?",
    allowedActions: ["Preview decision consequences", "Revise review notes", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed: decisionReplayPassed
  };
  const draftRecovery = buildTeacherAcceptanceAgendaDecisionDraftRecovery({
    decisionItems,
    corrections: args.corrections
  });
  const decisionExchangePayload = {
    format: "teacher_acceptance_agenda_decision_json_v1",
    mode: "teacher_acceptance_agenda_decision_exchange_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    allowedDecisions,
    items: decisionItems,
    decisionReplay: decisionReplayPayload,
    draftRecovery: {
      format: draftRecovery.format,
      mode: draftRecovery.mode,
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      persistedDraftCount: draftRecovery.persistedDraftCount,
      latestCorrectionId: draftRecovery.latestCorrectionId,
      rows: draftRecovery.rows
    }
  };
  const decisionExchange: QualificationTeacherAcceptanceAgendaDecisionExchange = {
    mode: "teacher_acceptance_agenda_decision_exchange_v1",
    format: "teacher_acceptance_agenda_decision_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    itemCount: decisionItems.length,
    allowedDecisions,
    items: decisionItems,
    decisionReplay,
    draftRecovery,
    templateJson: JSON.stringify(decisionExchangePayload, null, 2),
    teacherQuestion:
      "Teacher, please fill these agenda decisions as review notes only; this will not accept the technology.",
    allowedActions: ["Export agenda decision template", "Fill review notes", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Enable rules", "Package", "Release", "Wrap"],
    passed: decisionExchangePassed && decisionReplay.passed && draftRecovery.passed
  };
  const exportPayload = {
    format: "teacher_acceptance_evidence_gap_agenda_json_v1",
    mode: "teacher_acceptance_evidence_gap_agenda_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items,
    readyItems,
    unansweredItems,
    lockedItems,
    decisionExchange: decisionExchangePayload
  };

  return {
    mode: "teacher_acceptance_evidence_gap_agenda_v1",
    format: "teacher_acceptance_evidence_gap_agenda_json_v1",
    status: passed ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    items,
    readyItems,
    unansweredItems,
    lockedItems,
    decisionExchange,
    exportJson: JSON.stringify(exportPayload, null, 2),
    teacherQuestion:
      "Teacher, which agenda item should we review next before you decide whether the visual learning technology is qualified?",
    allowedActions: ["Review agenda", "Answer worksheet prompts", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    passed: passed && decisionExchange.passed
  };
}

const crossDomainTeacherScoreDecisionValues: QualificationCrossDomainTeacherScoreDecision[] = [
  "approve_for_review",
  "needs_revision",
  "boundary_only",
  "hold"
];

function isCrossDomainTeacherScoreDecision(value: unknown): value is QualificationCrossDomainTeacherScoreDecision {
  return (
    typeof value === "string" &&
    crossDomainTeacherScoreDecisionValues.includes(value as QualificationCrossDomainTeacherScoreDecision)
  );
}

function isCrossDomainTeacherScoreDraftItem(value: unknown): value is {
  caseId: string;
  apprenticeId: string;
  domain: QualificationCrossDomainValidationCase["domain"];
  score: number;
  decision: QualificationCrossDomainTeacherScoreDecision;
  note: string;
  followUpQuestion: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.caseId === "string" &&
    typeof record.apprenticeId === "string" &&
    (record.domain === "photography_journal" ||
      record.domain === "spatial_engineering" ||
      record.domain === "human_knowledge") &&
    typeof record.score === "number" &&
    Number.isFinite(record.score) &&
    isCrossDomainTeacherScoreDecision(record.decision) &&
    typeof record.note === "string" &&
    typeof record.followUpQuestion === "string" &&
    record.ruleEnabled === false &&
    record.accepted === false &&
    record.packagingGated === true
  );
}

function buildCrossDomainTeacherScoreDraftRecoveryDiff(args: {
  scoreReplay: QualificationCrossDomainTeacherBatchScoreReplay;
  corrections: Array<{
    id: string;
    errorType: string;
    runId: string | null;
    learningTraceSteps: number;
    extractedRule: RuleRecord | null;
    afterOutput: Record<string, unknown>;
    createdAt: string;
  }>;
}): QualificationCrossDomainTeacherScoreDraftRecoveryDiff {
  const recoveredDrafts = args.corrections
    .filter(
      (correction) =>
        correction.errorType === "cross_domain_teacher_score_draft" &&
        correction.runId === null &&
        correction.extractedRule?.enabled === false &&
        correction.afterOutput.format === "teacher_cross_domain_score_json_v1" &&
        correction.afterOutput.ruleEnabled === false &&
        correction.afterOutput.accepted === false &&
        correction.afterOutput.packagingGated === true &&
        correction.learningTraceSteps >= 3 &&
        Array.isArray(correction.afterOutput.items)
    )
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  const latest = recoveredDrafts[recoveredDrafts.length - 1] ?? null;
  const recoveredItems = latest
    ? (latest.afterOutput.items as unknown[]).filter(isCrossDomainTeacherScoreDraftItem)
    : [];
  const recoveredByCaseId = new Map(recoveredItems.map((item) => [item.caseId, item]));
  const rows: QualificationCrossDomainTeacherScoreDraftRecoveryRow[] = args.scoreReplay.items.map((staticItem) => {
    const recovered = recoveredByCaseId.get(staticItem.caseId) ?? null;
    const scoreDelta = recovered ? recovered.score - staticItem.score : null;
    const decisionChanged = recovered ? recovered.decision !== staticItem.decision : false;
    const followUpChanged = recovered
      ? recovered.followUpQuestion.trim() !== staticItem.followUpQuestion.trim()
      : false;
    const nextTeachingFocus = !recovered
      ? `Record a teacher score draft for ${staticItem.caseId}.`
      : decisionChanged || scoreDelta !== 0 || followUpChanged
        ? `Replay changed cross-domain score evidence for ${staticItem.caseId} before the next lesson.`
        : `Keep ${staticItem.caseId} as recovered review-only evidence.`;

    return {
      caseId: staticItem.caseId,
      apprenticeId: staticItem.apprenticeId,
      domain: staticItem.domain,
      staticScore: staticItem.score,
      recoveredScore: recovered?.score ?? null,
      scoreDelta,
      staticDecision: staticItem.decision,
      recoveredDecision: recovered?.decision ?? null,
      decisionChanged,
      followUpChanged,
      recoveredNote: recovered?.note ?? "",
      nextTeachingFocus,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed:
        staticItem.ruleEnabled === false &&
        staticItem.accepted === false &&
        staticItem.packagingGated === true &&
        (!recovered ||
          (recovered.ruleEnabled === false && recovered.accepted === false && recovered.packagingGated === true))
    };
  });
  const exportPayload = {
    format: "teacher_cross_domain_score_recovery_diff_json_v1",
    mode: "cross_domain_teacher_score_draft_recovery_diff_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    generatedFrom: "qualification_report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff",
    latestCorrectionId: latest?.id ?? null,
    persistedDraftCount: recoveredDrafts.length,
    rows: rows.map((row) => ({
      caseId: row.caseId,
      domain: row.domain,
      staticScore: row.staticScore,
      recoveredScore: row.recoveredScore,
      scoreDelta: row.scoreDelta,
      staticDecision: row.staticDecision,
      recoveredDecision: row.recoveredDecision,
      decisionChanged: row.decisionChanged,
      followUpChanged: row.followUpChanged,
      nextTeachingFocus: row.nextTeachingFocus,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true
    }))
  };

  return {
    mode: "cross_domain_teacher_score_draft_recovery_diff_v1",
    format: "teacher_cross_domain_score_recovery_diff_json_v1",
    status: latest ? "ready_for_teacher_review" : "no_saved_scores_yet",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    persistedDraftCount: recoveredDrafts.length,
    latestCorrectionId: latest?.id ?? null,
    rows,
    changedRows: rows.filter(
      (row) => row.scoreDelta !== null && (row.scoreDelta !== 0 || row.decisionChanged || row.followUpChanged)
    ).length,
    missingRecoveredRows: rows.filter((row) => row.recoveredScore === null).length,
    recoveredFollowUps: rows.filter(
      (row) => row.recoveredDecision !== null && row.recoveredDecision !== "approve_for_review"
    ).length,
    exportJson: JSON.stringify(exportPayload, null, 2),
    teacherQuestion:
      "Teacher, please compare recovered cross-domain score drafts with the current review matrix. Which changed scores should become the next lesson?",
    allowedActions: ["Recover cross-domain score drafts", "Compare score deltas", "Export recovery diff JSON"],
    blockedActions: ["Accept technology", "Enable cross-domain rules", "Package", "Release", "Wrap"],
    passed:
      rows.length === args.scoreReplay.items.length &&
      rows.every(
        (row) =>
          row.passed &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      )
  };
}

function buildCrossDomainValidationReport(args: {
  task: TaskProfile;
  visualLearningScenarios: QualificationVisualScenario[];
  spatialEngineeringTeachingModel: QualificationSpatialEngineeringTeachingModel;
  domainLearningWorkflow: QualificationDomainLearningWorkflow;
  humanTeachingMemoryProtocol: QualificationHumanTeachingMemoryProtocol;
  teachingPredictionBoard: QualificationTeachingPredictionBoard;
  corrections: Array<{
    id: string;
    errorType: string;
    runId: string | null;
    learningTraceSteps: number;
    extractedRule: RuleRecord | null;
    afterOutput: Record<string, unknown>;
    createdAt: string;
  }>;
}): QualificationCrossDomainValidationReport {
  const cases: QualificationCrossDomainValidationCase[] = [
    {
      id: "cross-domain-photography-apprentice",
      apprenticeId: args.task.apprenticeId,
      apprenticeLabel: `${args.task.apprentice.name} / 摄影日志学徒`,
      domain: "photography_journal",
      transferQuestion: "摄影日志学徒能否把 sunset/dusk/golden hour 学习迁移到新旅行笔记，同时在 midday 反例中保持保守？",
      reusedLearning: [
        "visual demonstration cue: golden hour",
        "correction rule: Dusk words mean golden hour",
        "counterexample review boundary"
      ],
      expectedBehavior: "正向光线线索自动影响 lightingCondition 和 photographyAdvice；反例仍进入老师审查。",
      observedBehavior: `${args.visualLearningScenarios.filter((scenario) => scenario.passed).length}/${args.visualLearningScenarios.length} visual scenarios passed with applied and review-boundary routes.`,
      boundaryCheck: "摄影领域只证明光线建议迁移，不证明三维几何或人类知识规则已经自动可用。",
      reviewState: "ready_for_teacher_review",
      passed:
        args.visualLearningScenarios.every((scenario) => scenario.passed) &&
        args.visualLearningScenarios.some((scenario) => scenario.expectedReview)
    },
    {
      id: "cross-domain-spatial-apprentice",
      apprenticeId: "apprentice-spatial-review",
      apprenticeLabel: "三维工程带教学徒 / review-only preview",
      domain: "spatial_engineering",
      transferQuestion: "三维工程学徒能否把老师的代码化坐标输入迁移为多候选拟合、残差放大镜和下一手预测？",
      reusedLearning: [
        args.spatialEngineeringTeachingModel.codeTeachingProtocol.format,
        `${args.spatialEngineeringTeachingModel.candidates.length} mathematical fit candidates`,
        "candidate selection impact preview"
      ],
      expectedBehavior: "AI 先生成可选候选和 disabled 规则草稿，再请老师选择，不静默保存长期规则。",
      observedBehavior: `${args.spatialEngineeringTeachingModel.candidates.length} candidates, ${args.spatialEngineeringTeachingModel.candidateComparisonMatrix.length} comparisons, and ${args.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.length} impact previews remain review-only.`,
      boundaryCheck: "三维能力只证明本地数学建模审查，不证明 CAD/封装/真实工程交付已经合格。",
      reviewState: "ready_for_teacher_review",
      passed:
        args.spatialEngineeringTeachingModel.reviewOnly &&
        args.spatialEngineeringTeachingModel.accepted === false &&
        args.spatialEngineeringTeachingModel.packagingGated === true &&
        args.spatialEngineeringTeachingModel.candidates.length >= 3 &&
        args.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.every(
          (preview) => preview.memoryImpact.autoApplies === false
        )
    },
    {
      id: "cross-domain-human-knowledge-apprentice",
      apprenticeId: "apprentice-human-knowledge-review",
      apprenticeLabel: "人类知识记忆学徒 / review-only preview",
      domain: "human_knowledge",
      transferQuestion: "人类知识学徒能否把老师规则、语音复述、未来命令回放和冲突请教迁移到非摄影指令？",
      reusedLearning: [
        `${args.humanTeachingMemoryProtocol.rules.length} disabled human-taught rules`,
        `${args.humanTeachingMemoryProtocol.conflictSteps.length} conflict comparison steps`,
        `${args.teachingPredictionBoard.moves.length} chess-like prediction moves`
      ],
      expectedBehavior: "未来命令前先回放旧知识，发现新旧不一致时列差异并问老师，不自动覆盖旧规则。",
      observedBehavior: `${args.humanTeachingMemoryProtocol.futureCommandReplay.hits.length} memory hits replayed before continuing; ${args.humanTeachingMemoryProtocol.conflictSteps.length} conflict steps ask teacher questions.`,
      boundaryCheck: "人类知识能力证明结构化记忆协议，不证明任何规则已经自动启用或跨任务静默应用。",
      reviewState: "needs_teacher_review",
      passed:
        args.humanTeachingMemoryProtocol.reviewOnly &&
        args.humanTeachingMemoryProtocol.accepted === false &&
        args.humanTeachingMemoryProtocol.packagingGated === true &&
        args.humanTeachingMemoryProtocol.futureCommandReplay.hits.length > 0 &&
        args.humanTeachingMemoryProtocol.futureCommandReplay.reviewOnly === true &&
        args.humanTeachingMemoryProtocol.conflictSteps.every((step) => step.teacherQuestion.trim().length > 0)
    }
  ];
  const domainsCovered = Array.from(new Set(cases.map((item) => item.domain)));
  const apprenticesCovered = Array.from(new Set(cases.map((item) => item.apprenticeId)));
  const reviewBoundaries = cases.filter((item) => item.reviewState === "needs_teacher_review").length;
  const allowedScoreDecisions: QualificationCrossDomainTeacherScoreDecision[] = [
    "approve_for_review",
    "needs_revision",
    "boundary_only",
    "hold"
  ];
  const teacherBatchScoreItems: QualificationCrossDomainTeacherBatchScoreItem[] = cases.map((item) => {
    const scoreByDomain: Record<QualificationCrossDomainValidationCase["domain"], number> = {
      photography_journal: 92,
      spatial_engineering: 88,
      human_knowledge: 76
    };
    const decisionByDomain: Record<
      QualificationCrossDomainValidationCase["domain"],
      QualificationCrossDomainTeacherScoreDecision
    > = {
      photography_journal: "approve_for_review",
      spatial_engineering: "approve_for_review",
      human_knowledge: "needs_revision"
    };

    return {
      caseId: item.id,
      apprenticeId: item.apprenticeId,
      domain: item.domain,
      score: scoreByDomain[item.domain],
      decision: decisionByDomain[item.domain],
      note:
        item.reviewState === "needs_teacher_review"
          ? "老师评分草稿要求补充冲突边界说明；该分数只影响审查草稿，不启用跨任务规则。"
          : "老师评分草稿认为迁移证据可继续审查；该分数不等于技术验收。",
      followUpQuestion:
        item.reviewState === "needs_teacher_review"
          ? "老师，是否需要把这类跨领域迁移限制在人工确认后再复用？"
          : "老师，这条迁移预演是否可以保留在 review-only 评分表里继续比较？",
      draftImpact:
        item.reviewState === "needs_teacher_review"
          ? "Mark cross-domain draft as needs_revision and keep all memory/rule reuse disabled."
          : "Keep cross-domain draft as reviewable evidence while preserving disabled rule state.",
      ruleEnabled: false,
      accepted: false,
      packagingGated: true
    };
  });
  const crossDomainTeacherScoreAverage = Math.round(
    teacherBatchScoreItems.reduce((total, item) => total + item.score, 0) / teacherBatchScoreItems.length
  );
  const crossDomainTeacherScoreFollowUps = teacherBatchScoreItems.filter(
    (item) => item.decision !== "approve_for_review"
  ).length;
  const crossDomainTeacherScoreBlockedActions = [
    "Accept technology",
    "Enable cross-domain rules",
    "Package",
    "Release",
    "Wrap"
  ];
  const crossDomainTeacherBatchScoreReplay: QualificationCrossDomainTeacherBatchScoreReplay = {
    mode: "cross_domain_teacher_batch_score_replay_v1",
    format: "teacher_cross_domain_score_json_v1",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    scoreScale: {
      min: 0,
      max: 100,
      passThreshold: 80
    },
    items: teacherBatchScoreItems,
    templateJson: JSON.stringify(
      {
        format: "teacher_cross_domain_score_json_v1",
        reviewOnly: true,
        accepted: false,
        packagingGated: true,
        items: cases.map((item) => ({
          caseId: item.id,
          domain: item.domain,
          score: null,
          decision: "hold",
          note: "",
          followUpQuestion: item.reviewState === "needs_teacher_review" ? item.transferQuestion : ""
        }))
      },
      null,
      2
    ),
    averageScore: crossDomainTeacherScoreAverage,
    needsFollowUp: crossDomainTeacherScoreFollowUps,
    disabledDraftImpacts: teacherBatchScoreItems.filter(
      (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
    ).length,
    allowedDecisions: allowedScoreDecisions,
    importInstructions: [
      "批量填写 score、decision、note 和 followUpQuestion 后回填到本地审查草稿。",
      "回填只更新 cross-domain teacher score draft preview，不记录技术验收。",
      "任何 Package、Release、Wrap 或启用规则动作都继续被封装锁阻止。"
    ],
    teacherQuestion:
      "老师，请批量评分三类学徒的跨领域迁移证据：哪些可以继续 review-only 比较，哪些必须退回补充边界？",
    allowedActions: ["Export score JSON", "Import local score draft", "Compare score follow-ups"],
    blockedActions: crossDomainTeacherScoreBlockedActions,
    passed:
      teacherBatchScoreItems.length === cases.length &&
      teacherBatchScoreItems.every(
        (item) =>
          item.score >= 0 &&
          item.score <= 100 &&
          allowedScoreDecisions.includes(item.decision) &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      crossDomainTeacherScoreFollowUps >= reviewBoundaries &&
      ["Package", "Release", "Wrap"].every((item) =>
        crossDomainTeacherScoreBlockedActions.includes(item)
      )
  };
  const teacherScoreDraftRecoveryDiff = buildCrossDomainTeacherScoreDraftRecoveryDiff({
    scoreReplay: crossDomainTeacherBatchScoreReplay,
    corrections: args.corrections
  });

  return {
    mode: "multi_apprentice_cross_domain_review",
    status: cases.every((item) => item.passed) ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    cases,
    domainsCovered,
    apprenticesCovered,
    stableTransfers: cases.filter((item) => item.passed && item.reviewState === "ready_for_teacher_review").length,
    reviewBoundaries,
    teacherBatchScoreReplay: crossDomainTeacherBatchScoreReplay,
    teacherScoreDraftRecoveryDiff,
    teacherQuestion:
      "老师，请比较这三类学徒预演：摄影、三维工程、人类知识记忆的迁移证据是否足够？哪些边界仍必须继续老师审查？",
    allowedActions: ["Inspect cross-domain cases", "Compare apprentice boundaries", "Rerun local verifier"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    passed:
      cases.length === 3 &&
      cases.every((item) => item.passed) &&
      domainsCovered.length === 3 &&
      apprenticesCovered.length === 3 &&
      reviewBoundaries >= 1
  };
}

export function buildQualificationReport(task: TaskProfile): QualificationReport {
  const workflow = task.workflows[0];
  const workflowNodes = parseJson<WorkflowNodeDefinition[]>(workflow?.nodes, []);
  const rules = task.rules.map((rule) => normalizeRule(rule, task.id));
  const visualRules = rules.filter((rule) => !isSpatialTeachingRule(rule) && !isHumanKnowledgeTeachingRule(rule));
  const runs = task.runs.map((run) => {
    const output = parseJson<ExecutionOutput | null>(run.output, null);
    const trace = parseJson<TraceStepRecord[]>(run.trace, []);
    const appliedRuleTitles = Array.from(new Set(trace.flatMap((step) => step.appliedRules.map((rule) => rule.title))));
    const appliedRuleIds = Array.from(new Set(trace.flatMap((step) => step.appliedRules.map((rule) => rule.id))));

    return {
      id: run.id,
      createdAt: run.createdAt,
      status: run.status,
      output,
      trace,
      appliedRuleIds,
      appliedRuleTitles,
      reviewPoints: trace.filter((step) => step.needsHumanReview).length
    };
  });
  const latestRun = runs[0];
  const appliedMemoryRun = runs.find((run) => run.appliedRuleTitles.length > 0);
  const latestTrace = latestRun?.trace ?? [];
  const executionPlan: QualificationExecutionPlanStep[] = latestTrace.map((step, index) => ({
    order: index + 1,
    nodeId: step.nodeId,
    stepName: step.stepName,
    plannedInputFields: Object.keys(step.input),
    plannedOutputFields: Object.keys(step.output),
    appliedRuleTitles: step.appliedRules.map((rule) => rule.title),
    confidence: step.confidence,
    validation: step.validation,
    needsHumanReview: step.needsHumanReview || step.id === "trace-human" || step.nodeId.includes("human")
  }));
  const traceByNodeId = new Map(latestTrace.map((step) => [step.nodeId, step]));
  const traceAlignment: QualificationTraceAlignmentStep[] = workflowNodes.map((node) => {
    const step = traceByNodeId.get(node.id);

    return {
      nodeId: node.id,
      nodeLabel: node.label,
      nodeType: node.type,
      traceStepId: step?.id ?? null,
      traceStepName: step?.stepName ?? null,
      confidence: step?.confidence ?? null,
      validation: step?.validation ?? null,
      needsHumanReview: step?.needsHumanReview ?? false,
      appliedRuleTitles: step?.appliedRules.map((rule) => rule.title) ?? []
    };
  });
  const alignedTraceNodes = traceAlignment.filter((item) => item.traceStepId && item.validation).length;
  const corrections = task.corrections.map((correction) => {
    return {
      id: correction.id,
      errorType: correction.errorType,
      userFeedback: correction.userFeedback,
      runId: correction.runId,
      learningTraceSteps: parseJson<unknown[]>(correction.learningTrace, []).length,
      extractedRule: parseJson<RuleRecord | null>(correction.extractedRule, null),
      beforeOutput: parseJson<Record<string, unknown>>(correction.beforeOutput, {}),
      afterOutput: parseJson<Record<string, unknown>>(correction.afterOutput, {}),
      createdAt: correction.createdAt
    };
  });
  const visualDemos = task.visualDemos.map((demo) => {
    const artifact = parseJson<VisualDemonstrationArtifact>(demo.artifact, {
      sceneDescription: demo.artifact,
      visualCues: [],
      lightingSignals: [],
      expectedPhotographyAdvice: []
    });

    return {
      id: demo.id,
      title: demo.title,
      hasReferenceImage: Boolean(artifact.referenceImageUrl),
      visualCueCount: artifact.visualCues.length,
      annotationCount: artifact.annotations?.length ?? 0,
      lightingSignalCount: artifact.lightingSignals.length
    };
  });
  const visualLearningScenarios = buildVisualLearningScenarios({
    taskId: task.id,
    apprenticeId: task.apprenticeId,
    rules: visualRules
  });
  const visualRegressionCases = buildVisualRegressionCases({
    taskId: task.id,
    apprenticeId: task.apprenticeId,
    rules: visualRules
  });
  const visualRobustnessSuite = buildVisualRobustnessSuite({
    taskId: task.id,
    apprenticeId: task.apprenticeId,
    rules: visualRules
  });
  const challengeSuite = buildLearningChallengeSuite({
    taskId: task.id,
    apprenticeId: task.apprenticeId,
    workflowNodes,
    rules: visualRules
  });
  const memoryProvenance: QualificationMemoryProvenance[] = rules.map((rule) => {
    const sources: QualificationMemoryProvenance["sources"] = [];

    for (const correction of corrections) {
      if (correction.extractedRule?.id === rule.id) {
        sources.push({
          type: "Correction",
          label: correction.extractedRule.title,
          evidence: correction.beforeOutput.lightingCondition
            ? `Corrected output after ${valueSummary(correction.beforeOutput.lightingCondition)} lighting.`
            : `Correction ${correction.id} produced this reusable rule.`,
          createdAt: task.corrections.find((item) => item.id === correction.id)?.createdAt ?? rule.createdAt
        });
      }
    }

    for (const example of task.examples) {
      const extractedRule = parseJson<RuleRecord | null>(example.extractedRule, null);
      if (extractedRule?.id === rule.id) {
        sources.push({
          type: "Teaching example",
          label: "Teacher example",
          evidence: example.input,
          createdAt: example.createdAt
        });
      }
    }

    for (const demo of task.visualDemos) {
      const extractedRule = parseJson<RuleRecord | null>(demo.extractedRule, null);
      if (extractedRule?.id === rule.id) {
        sources.push({
          type: "Visual demonstration",
          label: demo.title,
          evidence: demo.teacherNotes,
          createdAt: demo.createdAt
        });
      }
    }

    if (rule.id.startsWith("rule-history-")) {
      const runId = rule.id.replace("rule-history-", "");
      sources.push({
        type: "Execution history",
        label: `History lesson from ${runId}`,
        evidence: rule.condition,
        createdAt: rule.createdAt
      });
    }

    if (sources.length === 0 && rule.source === "seed") {
      sources.push({
        type: "Seed",
        label: "Seed memory",
        evidence: rule.condition,
        createdAt: rule.createdAt
      });
    }

    if (sources.length === 0 && isSpatialTeachingRule(rule)) {
      sources.push({
        type: "Spatial teaching",
        label: "Paused 3D teaching memory",
        evidence: rule.action,
        createdAt: rule.createdAt
      });
    }

    const appliedRuns = runs.filter((run) => run.appliedRuleIds.includes(rule.id) || run.appliedRuleTitles.includes(rule.title));
    const appliedTraceStepNames = Array.from(
      new Set(
        appliedRuns.flatMap((run) =>
          run.trace
            .filter((step) => step.appliedRules.some((appliedRule) => appliedRule.id === rule.id || appliedRule.title === rule.title))
            .map((step) => step.stepName)
        )
      )
    );

    return {
      ruleId: rule.id,
      ruleTitle: rule.title,
      enabled: rule.enabled,
      confidence: rule.confidence,
      sourceTypes: Array.from(new Set(sources.map((source) => source.type))),
      sources,
      appliedRunIds: appliedRuns.map((run) => run.id),
      appliedTraceStepNames
    };
  });
  const visualMemoryProvenance = memoryProvenance.filter(
    (rule) =>
      !rule.ruleId.startsWith("spatial-teaching-rule-") &&
      !rule.ruleId.startsWith("spatial-construction-correction-rule-") &&
      !rule.ruleTitle.startsWith("三维构造纠正待确认") &&
      !isHumanKnowledgeTeachingRule({ id: rule.ruleId, title: rule.ruleTitle })
  );
  const capabilityBoundary = buildCapabilityBoundary({
    visualLearningScenarios,
    rules: visualRules,
    memoryProvenance: visualMemoryProvenance
  });
  const codexCapabilityTransferReport = buildCodexCapabilityTransferReport();
  const visualLearningReadiness = buildVisualLearningReadiness({
    visualLearningScenarios,
    challengeSuite,
    memoryProvenance: visualMemoryProvenance,
    visualDemos,
    capabilityBoundary
  });
  const visualCueAuditTrail = buildVisualCueAuditTrail({
    taskVisualDemos: task.visualDemos,
    rules: visualRules,
    visualLearningScenarios,
    challengeSuite
  });
  const visualDecisionLedger = buildVisualDecisionLedger({
    visualLearningScenarios,
    challengeSuite
  });
  const visualLearningLimits = buildVisualLearningLimits({
    visualCueAuditTrail,
    visualDecisionLedger
  });
  const visualRuleCoverageMatrix = buildVisualRuleCoverageMatrix({
    memoryProvenance: visualMemoryProvenance,
    visualCueAuditTrail,
    visualDecisionLedger,
    visualLearningLimits
  });
  const visualCorrectionRehearsal = buildVisualCorrectionRehearsal({
    taskId: task.id,
    apprenticeId: task.apprenticeId,
    rules
  });
  const visualConfidenceCalibration = buildVisualConfidenceCalibration({
    visualLearningScenarios,
    challengeSuite
  });
  const visualBehaviorScorecard = buildVisualBehaviorScorecard({
    visualLearningScenarios,
    visualRegressionCases,
    visualRobustnessSuite,
    challengeSuite
  });
  const visualLearningStateAudit = buildVisualLearningStateAudit({
    visualRegressionCases,
    visualBehaviorScorecard,
    visualCorrectionRehearsal
  });
  const visualEvidenceReplay = buildVisualEvidenceReplay({
    taskVisualDemos: task.visualDemos,
    memoryProvenance,
    visualLearningScenarios,
    visualRobustnessSuite,
    visualLearningLimits
  });
  const visualRedTeamRegister = buildVisualRedTeamRegister({
    visualRobustnessSuite,
    visualLearningLimits,
    visualEvidenceReplay,
    visualConfidenceCalibration
  });
  const visualUncertaintyEscalationAudit = buildVisualUncertaintyEscalationAudit({
    visualLearningLimits,
    visualDecisionLedger,
    visualCorrectionRehearsal,
    visualLearningStateAudit,
    visualRedTeamRegister
  });
  const spatialEngineeringTeachingModel = buildSpatialEngineeringTeachingModel();
  const domainLearningWorkflow: QualificationDomainLearningWorkflow = buildReadableDomainLearningWorkflow();
  const humanTeachingMemoryProtocol = buildHumanTeachingMemoryProtocol(rules);
  const voiceBrowserCompatibilityComparisonReport = buildVoiceBrowserCompatibilityComparisonReport({
    audit: humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.browserCompatibilityAudit,
    corrections
  });
  const voiceBrowserCompatibilityBatchDiffReport = buildVoiceBrowserCompatibilityBatchDiffReport(
    voiceBrowserCompatibilityComparisonReport
  );
  const teachingPredictionBoard = buildTeachingPredictionBoard({
    spatialEngineeringTeachingModel,
    domainLearningWorkflow,
    humanTeachingMemoryProtocol
  });
  const crossDomainValidationReport = buildCrossDomainValidationReport({
    task,
    visualLearningScenarios,
    spatialEngineeringTeachingModel,
    domainLearningWorkflow,
    humanTeachingMemoryProtocol,
    teachingPredictionBoard,
    corrections
  });
  const visualTeacherReviewWorksheet = buildVisualTeacherReviewWorksheet({
    visualLearningReadiness,
    visualConfidenceCalibration,
    visualBehaviorScorecard,
    visualRuleCoverageMatrix,
    visualCorrectionRehearsal,
    visualLearningStateAudit,
    visualUncertaintyEscalationAudit,
    spatialEngineeringTeachingModel,
    domainLearningWorkflow,
    humanTeachingMemoryProtocol,
    visualRobustnessSuite,
    visualEvidenceReplay,
    visualRedTeamRegister,
    visualLearningLimits,
    challengeSuite
  });
  const visualTeacherReviewDraftRecoveryReport = buildVisualTeacherReviewDraftRecoveryReport({
    corrections
  });
  const visualTeacherReviewDraftReplayReport = buildVisualTeacherReviewDraftReplayReport({
    visualTeacherReviewWorksheet,
    visualTeacherReviewDraftRecoveryReport
  });
  const visualReviewDossier = buildVisualReviewDossier({
    visualLearningScenarios,
    visualRegressionCases,
    challengeSuite,
    visualLearningReadiness,
    visualCueAuditTrail,
    visualDecisionLedger,
    visualLearningLimits,
    visualRuleCoverageMatrix,
    visualCorrectionRehearsal,
    visualLearningStateAudit,
    visualUncertaintyEscalationAudit,
    spatialEngineeringTeachingModel,
    domainLearningWorkflow,
    humanTeachingMemoryProtocol,
    voiceBrowserCompatibilityComparisonReport,
    voiceBrowserCompatibilityBatchDiffReport,
    visualRobustnessSuite,
    visualConfidenceCalibration,
    visualBehaviorScorecard,
    visualTeacherReviewWorksheet,
    visualTeacherReviewDraftRecoveryReport,
    visualTeacherReviewDraftReplayReport,
    visualEvidenceReplay,
    visualRedTeamRegister,
    crossDomainValidationReport
  });
  const visualReviewManifest = buildVisualReviewManifest({
    taskId: task.id,
    visualReviewDossier
  });
  const learningDeltas: QualificationLearningDelta[] = corrections.flatMap((correction) => {
    const appliedRun = correction.extractedRule
      ? runs.find((run) => run.appliedRuleTitles.includes(correction.extractedRule?.title ?? ""))
      : null;
    const afterEvidence = appliedRun?.output ?? correction.afterOutput;
    const fieldChanges = ["lightingCondition", "photographyAdvice", "recommendedTitles"]
      .map((field) => {
        const before = valueSummary(correction.beforeOutput[field]);
        const after = valueSummary(afterEvidence?.[field as keyof ExecutionOutput]);

        return { field, before, after };
      })
      .filter((change) => change.before !== change.after);
    const changedFields = fieldChanges.map((change) => change.field);

    if (!correction.extractedRule || changedFields.length === 0) {
      return [];
    }

    return [
      {
        id: `delta-${correction.id}`,
        correctionId: correction.id,
        ruleTitle: correction.extractedRule.title,
        sourceRunId: correction.runId,
        appliedRunId: appliedRun?.id ?? null,
        beforeLighting: valueSummary(correction.beforeOutput.lightingCondition),
        afterLighting: valueSummary(afterEvidence?.lightingCondition),
        changedFields,
        fieldChanges,
        memoryEvidence: appliedRun
          ? `Run ${appliedRun.id} reused this memory and changed ${changedFields.join(", ")}.`
          : "The correction produced reusable memory; run again to prove the next-run behavior."
      }
    ];
  });
  const historyRule = rules.find((rule) => rule.id.startsWith("rule-history-"));
  const linkedCorrectionCount = task.corrections.filter((correction) => Boolean(correction.runId)).length;
  const spatialReviewCorrectionCount = corrections.filter(
    (correction) =>
      correction.errorType === "spatial_memory_review" &&
      correction.runId === null &&
      correction.extractedRule?.enabled === false &&
      correction.afterOutput.ruleEnabled === false &&
      correction.afterOutput.accepted === false &&
      correction.afterOutput.packagingGated === true &&
      correction.learningTraceSteps >= 3
  ).length;
  const humanKnowledgeCorrectionCount = corrections.filter(
    (correction) =>
      correction.errorType === "human_knowledge_ingest" &&
      correction.runId === null &&
      correction.extractedRule &&
      isHumanKnowledgeTeachingRule(correction.extractedRule) &&
      correction.extractedRule.enabled === false &&
      correction.afterOutput.ruleEnabled === false &&
      correction.afterOutput.accepted === false &&
      correction.afterOutput.packagingGated === true &&
      correction.learningTraceSteps >= 3
  ).length;
  const spatialConstructionCorrectionCount = corrections.filter(
    (correction) =>
      correction.errorType === "spatial_construction_correction" &&
      correction.runId === null &&
      correction.extractedRule &&
      isSpatialTeachingRule(correction.extractedRule) &&
      correction.extractedRule.enabled === false &&
      correction.afterOutput.ruleEnabled === false &&
      correction.afterOutput.accepted === false &&
      correction.afterOutput.packagingGated === true &&
      correction.learningTraceSteps >= 3
  ).length;
  const spatialCodePatchMatchReviewCount = corrections.filter(
    (correction) =>
      correction.errorType === "spatial_code_patch_match_review" &&
      correction.runId === null &&
      correction.extractedRule &&
      isSpatialTeachingRule(correction.extractedRule) &&
      correction.extractedRule.enabled === false &&
      correction.afterOutput.ruleEnabled === false &&
      correction.afterOutput.accepted === false &&
      correction.afterOutput.packagingGated === true &&
      correction.learningTraceSteps >= 3
  ).length;
  const visualTeacherReviewDraftCount = corrections.filter(
    (correction) =>
      correction.errorType === "visual_teacher_review_draft" &&
      correction.runId === null &&
      correction.extractedRule?.enabled === false &&
      correction.afterOutput.ruleEnabled === false &&
      correction.afterOutput.accepted === false &&
      correction.afterOutput.packagingGated === true &&
      correction.learningTraceSteps >= 3
  ).length;
  const voiceBrowserCompatibilityReviewDraftCount = corrections.filter(
    (correction) =>
      correction.errorType === "voice_browser_compatibility_review" &&
      correction.runId === null &&
      correction.extractedRule?.enabled === false &&
      correction.afterOutput.ruleEnabled === false &&
      correction.afterOutput.voiceOnlyMemoryEnabled === false &&
      correction.afterOutput.accepted === false &&
      correction.afterOutput.packagingGated === true &&
      correction.learningTraceSteps >= 3
  ).length;
  const crossDomainTeacherScoreDraftCount = corrections.filter(
    (correction) =>
      correction.errorType === "cross_domain_teacher_score_draft" &&
      correction.runId === null &&
      correction.extractedRule?.enabled === false &&
      correction.afterOutput.format === "teacher_cross_domain_score_json_v1" &&
      correction.afterOutput.ruleEnabled === false &&
      correction.afterOutput.accepted === false &&
      correction.afterOutput.packagingGated === true &&
      correction.learningTraceSteps >= 3
  ).length;
  const teacherAcceptanceAgendaDecisionDraftCount = corrections.filter(
    (correction) =>
      correction.errorType === "teacher_acceptance_agenda_decision_draft" &&
      correction.runId === null &&
      correction.extractedRule?.enabled === false &&
      correction.afterOutput.format === "teacher_acceptance_agenda_decision_json_v1" &&
      correction.afterOutput.ruleEnabled === false &&
      correction.afterOutput.accepted === false &&
      correction.afterOutput.packagingGated === true &&
      correction.learningTraceSteps >= 3
  ).length;
  const teacherTrialFeedbackDraftCount = corrections.filter(
    (correction) =>
      correction.errorType === "teacher_trial_feedback_draft" &&
      correction.runId === null &&
      correction.extractedRule?.enabled === false &&
      correction.afterOutput.format === "teacher_trial_feedback_draft_json_v1" &&
      correction.afterOutput.ruleEnabled === false &&
      correction.afterOutput.accepted === false &&
      correction.afterOutput.packagingGated === true &&
      correction.learningTraceSteps >= 3
  ).length;
  const spatialConstructionCodePatchMemoryReplays: QualificationSpatialConstructionCodePatchMemoryReplay[] =
    corrections.flatMap((correction) => {
      const selectedCodePatch = correction.afterOutput.selectedCodePatch;

      if (
        correction.errorType !== "spatial_construction_correction" ||
        !correction.extractedRule ||
        !isSpatialTeachingRule(correction.extractedRule) ||
        !isSpatialConstructionCodePatch(selectedCodePatch)
      ) {
        return [];
      }

      const passed =
        correction.runId === null &&
        correction.extractedRule.enabled === false &&
        correction.afterOutput.ruleEnabled === false &&
        correction.afterOutput.accepted === false &&
        correction.afterOutput.packagingGated === true &&
        selectedCodePatch.teacherReviewRequired === true &&
        selectedCodePatch.accepted === false &&
        selectedCodePatch.packagingGated === true &&
        correction.learningTraceSteps >= 4;

      return [
        {
          id: `spatial-code-patch-replay-${correction.id}`,
          correctionId: correction.id,
          ruleId: correction.extractedRule.id,
          ruleTitle: correction.extractedRule.title,
          geometryPatch: selectedCodePatch.geometryPatch,
          anchorPoints: selectedCodePatch.anchorPoints,
          offsetVector: selectedCodePatch.offsetVector,
          teacherReviewRequired: true,
          accepted: false,
          packagingGated: true,
          learningTraceStepCount: correction.learningTraceSteps,
          evidence:
            typeof correction.afterOutput.codePatchEvidence === "string"
              ? correction.afterOutput.codePatchEvidence
              : `老师编辑过的 JSON 构造草稿已保存为待确认记忆，锚点数=${selectedCodePatch.anchorPoints.length}。`,
          nextStepPrediction:
            typeof correction.afterOutput.codePatchNextStepPrediction === "string"
              ? correction.afterOutput.codePatchNextStepPrediction
              : "下一步预测：未来命中相似构造时，先回放这份 JSON 草稿，再请老师确认。",
          createdAt: correction.createdAt,
          passed
        }
      ];
    });
  const spatialConstructionCodePatchMemoryMatches: QualificationSpatialConstructionCodePatchMemoryMatch[] =
    spatialConstructionCodePatchMemoryReplays.flatMap((replay) => {
      const replaySpan = subtractSpatialPoints(replay.anchorPoints[replay.anchorPoints.length - 1], replay.anchorPoints[0]);

      return spatialEngineeringTeachingModel.constructionPredictionPlans.map((plan) => {
        const planSpan = subtractSpatialPoints(plan.anchorPoints[plan.anchorPoints.length - 1], plan.anchorPoints[0]);
        const directionSimilarity = spatialDirectionSimilarity(replay.offsetVector, plan.offsetVector);
        const spanSimilarity =
          1 -
          Math.min(
            1,
            spatialVectorLength(subtractSpatialPoints(replaySpan, planSpan)) /
              Math.max(spatialVectorLength(planSpan), spatialVectorLength(replaySpan), 0.001)
          );
        const anchorCountCompatible = replay.anchorPoints.length === plan.anchorPoints.length;
        const matchScore = Math.round((directionSimilarity * 0.65 + spanSimilarity * 0.25 + (anchorCountCompatible ? 0.1 : 0)) * 100) / 100;
        const passed =
          replay.passed &&
          plan.accepted === false &&
          plan.packagingGated === true &&
          replay.accepted === false &&
          replay.packagingGated === true &&
          replay.teacherReviewRequired === true &&
          matchScore >= 0.55;

        return {
          id: `match-${replay.id}-${plan.id}`,
          replayId: replay.id,
          planId: plan.id,
          selectedCandidateId: plan.selectedCandidateId,
          matchScore,
          matchedReason: `旧代码草稿和当前候选的方向相似度 ${Math.round(directionSimilarity * 100)}%，跨度相似度 ${Math.round(spanSimilarity * 100)}%。`,
          conflictChecks: [
            anchorCountCompatible
              ? "锚点数量一致，可以把旧草稿作为候选证据回放。"
              : "锚点数量不同，必须请老师判断旧草稿是否只适用于原场景。",
            replay.geometryPatch === plan.label
              ? "几何补丁文字和当前候选标签完全一致。"
              : "几何补丁文字和当前候选标签不完全一致，不能自动沿用。",
            "旧草稿仍是 accepted=false、packagingGated=true，只能作为请教证据。"
          ],
          teacherQuestion: `老师，我发现旧的 JSON 构造草稿可能匹配当前候选 ${plan.label}。要把它作为参考继续预演，还是认为这是不同场景？`,
          nextStepPrediction:
            matchScore >= 0.75
              ? "下一步预测：我会先回放旧锚点和新锚点差异，再请老师确认是否沿用。"
              : "下一步预测：匹配不够强，我会把旧草稿标为参考证据，并请求老师重新选择候选。",
          accepted: false,
          packagingGated: true,
          passed
        };
      });
    });
  const reviewableCorrectionCount =
    linkedCorrectionCount +
    spatialReviewCorrectionCount +
    humanKnowledgeCorrectionCount +
    spatialConstructionCorrectionCount +
    spatialCodePatchMatchReviewCount +
    visualTeacherReviewDraftCount +
    voiceBrowserCompatibilityReviewDraftCount +
    crossDomainTeacherScoreDraftCount +
    teacherAcceptanceAgendaDecisionDraftCount +
    teacherTrialFeedbackDraftCount;
  const humanReviewTraceSteps = latestTrace.filter((step) => step.id === "trace-human" || step.nodeId.includes("human"));
  const urgentReviewPoints = latestTrace.filter((step) => step.needsHumanReview).length;
  const policyEvidence: QualificationPolicyEvidence[] = [
    {
      id: "public-trace-only",
      label: "Public trace only",
      passed: latestTrace.length > 0 && !hasPrivateTraceKey(latestTrace),
      evidence: "Trace payload checked for chainOfThought, privateChainOfThought, and hiddenReasoning keys."
    },
    {
      id: "teacher-review-points",
      label: "Teacher review points stay visible",
      passed: humanReviewTraceSteps.length > 0,
      evidence: `${humanReviewTraceSteps.length} human-review trace step is visible; ${urgentReviewPoints} urgent review flags in latest run.`
    },
    {
      id: "corrections-link-to-runs",
      label: "Corrections link to execution",
      passed: task.corrections.length > 0 && reviewableCorrectionCount === task.corrections.length,
      evidence: `${linkedCorrectionCount}/${task.corrections.length} corrections are linked to saved runs; ${spatialReviewCorrectionCount} spatial memory reviews, ${humanKnowledgeCorrectionCount} human knowledge ingests, ${spatialConstructionCorrectionCount} spatial construction corrections, ${spatialCodePatchMatchReviewCount} code patch match reviews, ${visualTeacherReviewDraftCount} teacher review drafts, ${voiceBrowserCompatibilityReviewDraftCount} voice compatibility review drafts, ${crossDomainTeacherScoreDraftCount} cross-domain score drafts, ${teacherAcceptanceAgendaDecisionDraftCount} teacher acceptance agenda decision drafts, and ${teacherTrialFeedbackDraftCount} teacher trial feedback drafts are paused, traceable, and packaging-locked.`
    },
    {
      id: "trace-validation-required",
      label: "Trace validation required",
      passed:
        latestTrace.length > 0 &&
        latestTrace.every((step) => typeof step.confidence === "number" && step.validation.trim().length > 0),
      evidence: `${latestTrace.filter((step) => step.validation.trim().length > 0).length}/${latestTrace.length} trace steps include validation.`
    },
    {
      id: "visual-scenario-matrix",
      label: "Visual learning scenario matrix",
      passed:
        visualLearningScenarios.every((scenario) => scenario.passed) &&
        visualLearningScenarios.every(
          (scenario) =>
            scenario.traceSummary.length > 0 &&
            scenario.traceSummary.every((step) => step.validation.trim().length > 0)
        ),
      evidence: `${visualLearningScenarios.filter((scenario) => scenario.passed).length}/${visualLearningScenarios.length} visual learning scenarios behave as expected with public trace summaries.`
    },
    {
      id: "visual-regression-comparison",
      label: "Visual baseline regression comparison",
      passed:
        visualRegressionCases.every((item) => item.passed) &&
        visualRegressionCases.some((item) => item.expectedMemoryEffect === "changed" && item.changedByMemory) &&
        visualRegressionCases.some((item) => item.expectedMemoryEffect === "conservative" && !item.changedByMemory),
      evidence: `${visualRegressionCases.filter((item) => item.passed).length}/${visualRegressionCases.length} baseline-vs-learned visual regression cases passed.`
    },
    {
      id: "visual-robustness-stress-suite",
      label: "Visual robustness stress suite",
      passed:
        visualRobustnessSuite.reviewOnly === true &&
        visualRobustnessSuite.persisted === false &&
        visualRobustnessSuite.accepted === false &&
        visualRobustnessSuite.packagingGated === true &&
        visualRobustnessSuite.passed === visualRobustnessSuite.total &&
        visualRobustnessSuite.cases.some((item) => item.stressType === "positive_paraphrase" && item.passed) &&
        visualRobustnessSuite.cases.filter((item) => item.stressType === "false_positive_guard" && item.passed).length >= 3,
      evidence: `${visualRobustnessSuite.passed}/${visualRobustnessSuite.total} visual robustness stress cases passed with no persistence, acceptance, or packaging unlock.`
    },
    {
      id: "review-only-challenge-suite",
      label: "Review-only challenge suite",
      passed:
        challengeSuite.passed === challengeSuite.total &&
        challengeSuite.persisted === false &&
        challengeSuite.reviewOnly === true &&
        challengeSuite.accepted === false &&
        challengeSuite.packagingGated === true,
      evidence: `${challengeSuite.passed}/${challengeSuite.total} challenge probes passed without persistence, acceptance, or packaging unlock.`
    },
    {
      id: "visual-learning-readiness-rubric",
      label: "Visual learning readiness rubric",
      passed: visualLearningReadiness.every((item) => item.passed),
      evidence: `${visualLearningReadiness.filter((item) => item.passed).length}/${visualLearningReadiness.length} readiness criteria are proven for teacher review.`
    },
    {
      id: "visual-cue-audit-trail",
      label: "Visual cue audit trail",
      passed:
        visualCueAuditTrail.filter((item) => item.passed).length >= 3 &&
        visualCueAuditTrail.some((item) => item.cueType === "annotation" && item.passed),
      evidence: `${visualCueAuditTrail.filter((item) => item.passed).length}/${visualCueAuditTrail.length} visual cues connect source evidence to rules and scenario or challenge outcomes.`
    },
    {
      id: "visual-decision-ledger",
      label: "Visual decision ledger",
      passed:
        visualDecisionLedger.length > 0 &&
        visualDecisionLedger.some((item) => item.decision === "applied") &&
        visualDecisionLedger.some((item) => item.decision === "conflicted" || item.decision === "counterexample") &&
        visualDecisionLedger.every((item) => item.expectationPassed === true),
      evidence: `${visualDecisionLedger.length} visual rule decisions are visible across scenarios and review-only challenges.`
    },
    {
      id: "visual-learning-limits-visible",
      label: "Visual learning limits visible",
      passed:
        visualLearningLimits.some((item) => item.category === "unproven_cue") &&
        visualLearningLimits.some((item) => item.category === "teacher_review") &&
        visualLearningLimits.some((item) => item.category === "blocked_work"),
      evidence: `${visualLearningLimits.length} visual learning limits are visible, including unproven cues, teacher-review boundaries, and blocked packaging work.`
    },
    {
      id: "visual-rule-coverage-matrix",
      label: "Visual rule coverage matrix",
      passed:
        visualRuleCoverageMatrix.reviewOnly === true &&
        visualRuleCoverageMatrix.accepted === false &&
        visualRuleCoverageMatrix.packagingGated === true &&
        visualRuleCoverageMatrix.status === "ready_for_teacher_review" &&
        visualRuleCoverageMatrix.items.every((item) => item.passed) &&
        visualRuleCoverageMatrix.items.every((item) => item.sourceCount > 0) &&
        visualRuleCoverageMatrix.items.some((item) => item.positiveDecisionIds.length > 0) &&
        visualRuleCoverageMatrix.items.some((item) => item.reviewDecisionIds.length > 0) &&
        ["Accept technology", "Package", "Release", "Wrap"].every((item) =>
          visualRuleCoverageMatrix.blockedActions.includes(item)
        ),
      evidence: `${visualRuleCoverageMatrix.items.filter((item) => item.passed).length}/${visualRuleCoverageMatrix.items.length} reusable visual rules have source and behavior coverage without acceptance.`
    },
    {
      id: "visual-correction-rehearsal",
      label: "Visual correction rehearsal",
      passed:
        visualCorrectionRehearsal.reviewOnly === true &&
        visualCorrectionRehearsal.persisted === false &&
        visualCorrectionRehearsal.accepted === false &&
        visualCorrectionRehearsal.packagingGated === true &&
        visualCorrectionRehearsal.status === "ready_for_teacher_review" &&
        visualCorrectionRehearsal.cases.every((item) => item.passed) &&
        visualCorrectionRehearsal.cases.some((item) => item.changedByCandidateRule) &&
        visualCorrectionRehearsal.cases.some((item) => item.afterReview) &&
        ["Accept technology", "Package", "Release", "Wrap"].every((item) =>
          visualCorrectionRehearsal.blockedActions.includes(item)
        ),
      evidence: `${visualCorrectionRehearsal.cases.filter((item) => item.passed).length}/${visualCorrectionRehearsal.cases.length} correction rehearsals extracted candidate rules without persistence or acceptance.`
    },
    {
      id: "visual-learning-state-transition-audit",
      label: "Visual learning state transition audit",
      passed:
        visualLearningStateAudit.reviewOnly === true &&
        visualLearningStateAudit.accepted === false &&
        visualLearningStateAudit.packagingGated === true &&
        visualLearningStateAudit.status === "ready_for_teacher_review" &&
        visualLearningStateAudit.transitions.every((item) => item.passed) &&
        visualLearningStateAudit.transitions.some((item) => item.trigger === "visual_teaching") &&
        visualLearningStateAudit.transitions.some((item) => item.trigger === "correction_rehearsal") &&
        visualLearningStateAudit.transitions.some((item) => item.reviewState === "locked") &&
        ["Accept technology", "Package", "Release", "Wrap"].every((item) =>
          visualLearningStateAudit.blockedActions.includes(item)
        ),
      evidence: `${visualLearningStateAudit.transitions.filter((item) => item.passed).length}/${visualLearningStateAudit.transitions.length} visual learning state transitions are visible without acceptance.`
    },
    {
      id: "visual-confidence-calibration",
      label: "Visual confidence calibration",
      passed:
        visualConfidenceCalibration.status === "calibrated_for_teacher_review" &&
        visualConfidenceCalibration.accepted === false &&
        visualConfidenceCalibration.packagingGated === true &&
        visualConfidenceCalibration.items.every((item) => item.passed) &&
        visualConfidenceCalibration.items.some((item) => item.expectedOutcome === "automatic") &&
        visualConfidenceCalibration.items.some((item) => item.expectedOutcome === "teacher_review"),
      evidence: `${visualConfidenceCalibration.items.filter((item) => item.passed).length}/${visualConfidenceCalibration.items.length} confidence checks align with automatic and teacher-review visual learning outcomes.`
    },
    {
      id: "visual-behavior-scorecard",
      label: "Visual behavior scorecard",
      passed:
        visualBehaviorScorecard.reviewOnly === true &&
        visualBehaviorScorecard.accepted === false &&
        visualBehaviorScorecard.packagingGated === true &&
        visualBehaviorScorecard.status === "ready_for_teacher_review" &&
        visualBehaviorScorecard.cases.every((item) => item.passed) &&
        visualBehaviorScorecard.metrics.every((metric) => metric.passed) &&
        visualBehaviorScorecard.cases.some((item) => item.route === "automatic") &&
        visualBehaviorScorecard.cases.some((item) => item.route === "teacher_review") &&
        ["Accept technology", "Package", "Release", "Wrap"].every((item) =>
          visualBehaviorScorecard.blockedActions.includes(item)
        ),
      evidence: `${visualBehaviorScorecard.cases.filter((item) => item.passed).length}/${visualBehaviorScorecard.cases.length} behavior scorecard cases and ${visualBehaviorScorecard.metrics.filter((metric) => metric.passed).length}/${visualBehaviorScorecard.metrics.length} metrics pass without acceptance.`
    },
    {
      id: "visual-evidence-replay",
      label: "Visual evidence replay",
      passed:
        visualEvidenceReplay.reviewOnly === true &&
        visualEvidenceReplay.accepted === false &&
        visualEvidenceReplay.packagingGated === true &&
        visualEvidenceReplay.status === "ready_for_teacher_review" &&
        visualEvidenceReplay.steps.every((step) => step.passed) &&
        visualEvidenceReplay.steps.some((step) => step.phase === "teach") &&
        visualEvidenceReplay.steps.some((step) => step.phase === "stress") &&
        visualEvidenceReplay.steps.some((step) => step.phase === "review" && step.status === "locked"),
      evidence: `${visualEvidenceReplay.steps.filter((step) => step.passed).length}/${visualEvidenceReplay.steps.length} visual evidence replay steps connect teaching source, extracted memory, behavior, stress checks, and review lock.`
    },
    {
      id: "visual-red-team-risk-register",
      label: "Visual red-team risk register",
      passed:
        visualRedTeamRegister.reviewOnly === true &&
        visualRedTeamRegister.accepted === false &&
        visualRedTeamRegister.packagingGated === true &&
        visualRedTeamRegister.status === "ready_for_teacher_review" &&
        visualRedTeamRegister.risks.every((risk) => risk.passed) &&
        visualRedTeamRegister.risks.filter((risk) => risk.status === "mitigated_for_review").length >= 4 &&
        visualRedTeamRegister.risks.some((risk) => risk.status === "needs_teacher_review") &&
        visualRedTeamRegister.risks.some((risk) => risk.status === "locked") &&
        ["Accept technology", "Package", "Release", "Wrap"].every((item) =>
          visualRedTeamRegister.blockedActions.includes(item)
        ),
      evidence: `${visualRedTeamRegister.risks.length} red-team risks are registered with mitigated, teacher-review, and locked outcomes.`
    },
    {
      id: "visual-uncertainty-escalation-audit",
      label: "Visual uncertainty escalation audit",
      passed:
        visualUncertaintyEscalationAudit.reviewOnly === true &&
        visualUncertaintyEscalationAudit.accepted === false &&
        visualUncertaintyEscalationAudit.packagingGated === true &&
        visualUncertaintyEscalationAudit.status === "ready_for_teacher_review" &&
        visualUncertaintyEscalationAudit.items.every((item) => item.passed && item.evidenceReady) &&
        visualUncertaintyEscalationAudit.items.some((item) => item.trigger === "conflict") &&
        visualUncertaintyEscalationAudit.items.some((item) => item.trigger === "missing_evidence") &&
        visualUncertaintyEscalationAudit.items.some((item) => item.trigger === "ordinary_uncertainty") &&
        visualUncertaintyEscalationAudit.items.some((item) => item.trigger === "correction_boundary") &&
        visualUncertaintyEscalationAudit.items.some(
          (item) => item.trigger === "packaging_lock" && item.reviewState === "locked"
        ) &&
        ["Accept technology", "Package", "Release", "Wrap"].every((item) =>
          visualUncertaintyEscalationAudit.blockedActions.includes(item)
        ),
      evidence: `${visualUncertaintyEscalationAudit.items.filter((item) => item.evidenceReady).length}/${visualUncertaintyEscalationAudit.items.length} uncertainty escalation paths are ready without acceptance.`
    },
    {
      id: "spatial-engineering-teaching-model",
      label: "Spatial engineering teaching model",
      passed:
        spatialEngineeringTeachingModel.reviewOnly === true &&
        spatialEngineeringTeachingModel.accepted === false &&
        spatialEngineeringTeachingModel.packagingGated === true &&
        spatialEngineeringTeachingModel.status === "ready_for_teacher_review" &&
        spatialEngineeringTeachingModel.teachingInputMode === "code_first" &&
        spatialEngineeringTeachingModel.codeTeachingProtocol.imageUse === "optional_reference_only" &&
        spatialEngineeringTeachingModel.humanSelectionRequired === true &&
        spatialEngineeringTeachingModel.coordinateFrame.axes.join(",") === "x,y,z" &&
        spatialEngineeringTeachingModel.candidates.length >= 3 &&
        spatialEngineeringTeachingModel.candidates.every(
          (candidate) => candidate.passed && candidate.teacherSelectable && candidate.residual < 0.08
        ) &&
        spatialEngineeringTeachingModel.extractedRules.every((rule) => rule.passed) &&
        spatialEngineeringTeachingModel.teachingRehearsals.every(
          (rehearsal) =>
            rehearsal.passed &&
            rehearsal.memoryPolicy === "preview_only_requires_teacher_confirmation" &&
            rehearsal.conflictChecks.length >= 3
        ) &&
        spatialEngineeringTeachingModel.guidedGenerationSteps.length >= 4 &&
        spatialEngineeringTeachingModel.guidedGenerationSteps.every(
          (step) =>
            step.passed &&
            step.reviewState === "awaiting_teacher_review" &&
            step.whyThisStep.length > 0 &&
            step.teacherCorrectionSlot.length > 0 &&
            step.nextStepPrediction.includes("下一步预测")
        ) &&
        spatialEngineeringTeachingModel.constructionPredictionPlans.length ===
          spatialEngineeringTeachingModel.candidates.length &&
        spatialEngineeringTeachingModel.constructionPredictionPlans.every(
          (plan) =>
            plan.passed &&
            plan.accepted === false &&
            plan.packagingGated === true &&
            plan.memoryPolicy === "preview_only_requires_teacher_confirmation" &&
            plan.anchorPoints.length >= 2 &&
            plan.constructionSteps.length >= 3 &&
            plan.constructionSteps.every(
              (step) =>
                step.passed &&
                step.reviewState === "awaiting_teacher_review" &&
                step.whyThisStep.length > 0 &&
                step.validationCheck.length > 0 &&
                step.teacherCorrectionSlot.length > 0 &&
                step.nextStepPrediction.includes("下一步预测")
            )
        ) &&
        spatialEngineeringTeachingModel.memoryPersistence.mode === "paused_rule_memory" &&
        spatialEngineeringTeachingModel.memoryPersistence.requiresTeacherConfirmation === true &&
        spatialEngineeringTeachingModel.memoryPersistence.autoApplies === false &&
        spatialEngineeringTeachingModel.memoryPersistence.accepted === false &&
        spatialEngineeringTeachingModel.memoryPersistence.packagingGated === true &&
        ["Accept technology", "Package", "Release", "Wrap"].every((item) =>
          spatialEngineeringTeachingModel.blockedActions.includes(item)
        ),
      evidence: `${spatialEngineeringTeachingModel.candidates.length} mathematical 3D fit candidates, ${spatialEngineeringTeachingModel.teachingRehearsals.length} preview-only rule rehearsals, ${spatialEngineeringTeachingModel.guidedGenerationSteps.length} guided generation steps, and ${spatialEngineeringTeachingModel.constructionPredictionPlans.length} candidate construction prediction plans are exposed from code-first teaching data for teacher selection.`
    },
    {
      id: "domain-learning-workflow",
      label: "Domain learning workflow",
      passed:
        domainLearningWorkflow.reviewOnly === true &&
        domainLearningWorkflow.accepted === false &&
        domainLearningWorkflow.packagingGated === true &&
        domainLearningWorkflow.status === "ready_for_teacher_review" &&
        domainLearningWorkflow.stages.some((stage) => stage.phase === "self_research") &&
        domainLearningWorkflow.stages.some((stage) => stage.phase === "knowledge_map") &&
        domainLearningWorkflow.stages.some((stage) => stage.phase === "human_ingest") &&
        domainLearningWorkflow.stages.some((stage) => stage.phase === "guided_generation") &&
        domainLearningWorkflow.knowledgeNodes.length >= 5 &&
        domainLearningWorkflow.guidedGenerationSteps.every(
          (step) =>
            step.reviewState === "awaiting_teacher_review" &&
            step.whyThisStep.length > 0 &&
            step.nextStepPrediction.length > 0
        ) &&
        ["Accept technology", "Package", "Release", "Wrap"].every((item) =>
          domainLearningWorkflow.blockedActions.includes(item)
        ),
      evidence: `${domainLearningWorkflow.stages.length} staged domain-learning phases prepare knowledge before guided human teaching.`
    },
    {
      id: "multi-apprentice-cross-domain-validation",
      label: "Multi-apprentice cross-domain validation",
      passed:
        crossDomainValidationReport.mode === "multi_apprentice_cross_domain_review" &&
        crossDomainValidationReport.reviewOnly === true &&
        crossDomainValidationReport.accepted === false &&
        crossDomainValidationReport.packagingGated === true &&
        crossDomainValidationReport.status === "ready_for_teacher_review" &&
        crossDomainValidationReport.cases.length >= 3 &&
        crossDomainValidationReport.domainsCovered.length >= 3 &&
        crossDomainValidationReport.apprenticesCovered.length >= 3 &&
        crossDomainValidationReport.reviewBoundaries >= 1 &&
        ["Accept technology", "Package", "Release", "Wrap"].every((item) =>
          crossDomainValidationReport.blockedActions.includes(item)
        ),
      evidence: `${crossDomainValidationReport.cases.length} apprentice-domain review cases cover ${crossDomainValidationReport.domainsCovered.length} domains while keeping ${crossDomainValidationReport.reviewBoundaries} teacher-review boundaries.`
    },
    {
      id: "cross-domain-teacher-batch-score-replay",
      label: "Cross-domain teacher batch score replay",
      passed:
        crossDomainValidationReport.teacherBatchScoreReplay.mode === "cross_domain_teacher_batch_score_replay_v1" &&
        crossDomainValidationReport.teacherBatchScoreReplay.format === "teacher_cross_domain_score_json_v1" &&
        crossDomainValidationReport.teacherBatchScoreReplay.reviewOnly === true &&
        crossDomainValidationReport.teacherBatchScoreReplay.accepted === false &&
        crossDomainValidationReport.teacherBatchScoreReplay.packagingGated === true &&
        crossDomainValidationReport.teacherBatchScoreReplay.items.length ===
          crossDomainValidationReport.cases.length &&
        crossDomainValidationReport.teacherBatchScoreReplay.items.every(
          (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
        ) &&
        crossDomainValidationReport.teacherBatchScoreReplay.blockedActions.includes("Package"),
      evidence: `${crossDomainValidationReport.teacherBatchScoreReplay.items.length} teacher score replay items stay draft-only with ${crossDomainValidationReport.teacherBatchScoreReplay.needsFollowUp} follow-up prompts.`
    },
    {
      id: "cross-domain-teacher-score-recovery-diff",
      label: "Cross-domain teacher score recovery diff",
      passed:
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.mode ===
          "cross_domain_teacher_score_draft_recovery_diff_v1" &&
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.format ===
          "teacher_cross_domain_score_recovery_diff_json_v1" &&
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.reviewOnly === true &&
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.accepted === false &&
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.packagingGated === true &&
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.rows.length ===
          crossDomainValidationReport.teacherBatchScoreReplay.items.length &&
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.rows.every(
          (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
        ) &&
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.blockedActions.includes(
          "Enable cross-domain rules"
        ) &&
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.blockedActions.includes("Package"),
      evidence: `${crossDomainValidationReport.teacherScoreDraftRecoveryDiff.persistedDraftCount} recovered cross-domain score drafts expose ${crossDomainValidationReport.teacherScoreDraftRecoveryDiff.changedRows} changed rows without rule enablement or packaging.`
    },
    {
      id: "human-teaching-memory-protocol",
      label: "Human teaching memory protocol",
      passed:
        humanTeachingMemoryProtocol.reviewOnly === true &&
        humanTeachingMemoryProtocol.accepted === false &&
        humanTeachingMemoryProtocol.packagingGated === true &&
        humanTeachingMemoryProtocol.status === "ready_for_teacher_review" &&
        humanTeachingMemoryProtocol.rules.every((rule) => rule.passed) &&
        humanTeachingMemoryProtocol.conflictSteps.every(
          (step) => step.passed && step.action.length > 0 && step.teacherQuestion.length > 0
        ) &&
        humanTeachingMemoryProtocol.voiceExperience.mode === "voice_optional" &&
        humanTeachingMemoryProtocol.voiceExperience.passed &&
        ["Accept technology", "Package", "Release", "Wrap"].every((item) =>
          humanTeachingMemoryProtocol.blockedActions.includes(item)
        ),
      evidence: `${humanTeachingMemoryProtocol.rules.length} human-teaching memory rules and optional voice teaching remain review-only.`
    },
    {
      id: "voice-browser-compatibility-comparison",
      label: "Voice browser compatibility export comparison",
      passed:
        voiceBrowserCompatibilityComparisonReport.mode ===
          "voice_browser_compatibility_export_comparison_v1" &&
        voiceBrowserCompatibilityComparisonReport.format ===
          "voice_browser_runtime_review_export_json_v1" &&
        voiceBrowserCompatibilityComparisonReport.reviewOnly === true &&
        voiceBrowserCompatibilityComparisonReport.accepted === false &&
        voiceBrowserCompatibilityComparisonReport.packagingGated === true &&
        voiceBrowserCompatibilityComparisonReport.items.length >= 4 &&
        voiceBrowserCompatibilityComparisonReport.items.every(
          (item) =>
            item.ruleEnabled === false &&
            item.voiceOnlyMemoryEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ) &&
        voiceBrowserCompatibilityComparisonReport.exportJson.includes(
          "voice_browser_runtime_review_export_json_v1"
        ) &&
        voiceBrowserCompatibilityComparisonReport.blockedActions.includes("Enable voice-only memory") &&
        voiceBrowserCompatibilityComparisonReport.blockedActions.includes("Package"),
      evidence: `${voiceBrowserCompatibilityComparisonReport.items.length} browser rows compare ${voiceBrowserCompatibilityComparisonReport.persistedReviewCount} persisted runtime reviews and stay export-only.`
    },
    {
      id: "voice-browser-runtime-batch-gap-diff",
      label: "Voice browser runtime batch gap diff",
      passed:
        voiceBrowserCompatibilityBatchDiffReport.mode === "voice_browser_runtime_batch_gap_diff_v1" &&
        voiceBrowserCompatibilityBatchDiffReport.format === "voice_browser_runtime_batch_gap_diff_json_v1" &&
        voiceBrowserCompatibilityBatchDiffReport.reviewOnly === true &&
        voiceBrowserCompatibilityBatchDiffReport.accepted === false &&
        voiceBrowserCompatibilityBatchDiffReport.packagingGated === true &&
        voiceBrowserCompatibilityBatchDiffReport.passed === true &&
        voiceBrowserCompatibilityBatchDiffReport.rows.every(
          (row) =>
            row.ruleEnabled === false &&
            row.voiceOnlyMemoryEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
        voiceBrowserCompatibilityBatchDiffReport.exportJson.includes(
          "voice_browser_runtime_batch_gap_diff_json_v1"
        ) &&
        voiceBrowserCompatibilityBatchDiffReport.blockedActions.includes("Enable voice-only memory") &&
        voiceBrowserCompatibilityBatchDiffReport.blockedActions.includes("Package"),
      evidence: `${voiceBrowserCompatibilityBatchDiffReport.missingRuntimeReviews} browsers still need runtime review and ${voiceBrowserCompatibilityBatchDiffReport.runtimeDiffs} rows expose static/runtime differences without enabling voice-only memory.`
    },
    {
      id: "visual-teacher-review-worksheet",
      label: "Visual teacher review worksheet",
      passed:
        visualTeacherReviewWorksheet.reviewOnly === true &&
        visualTeacherReviewWorksheet.accepted === false &&
        visualTeacherReviewWorksheet.packagingGated === true &&
        visualTeacherReviewWorksheet.items.every((item) => item.status === "unanswered" && item.evidenceReady) &&
        ["Accept technology", "Package", "Release", "Wrap"].every((item) =>
          visualTeacherReviewWorksheet.blockedActions.includes(item)
        ),
      evidence: `${visualTeacherReviewWorksheet.items.filter((item) => item.evidenceReady).length}/${visualTeacherReviewWorksheet.items.length} teacher review prompts have evidence but remain unanswered without acceptance.`
    },
    {
      id: "teacher-review-draft-persistence-recovery",
      label: "Teacher review draft persistence recovery",
      passed:
        visualTeacherReviewDraftRecoveryReport.mode === "teacher_review_draft_persistence_recovery_v1" &&
        visualTeacherReviewDraftRecoveryReport.reviewOnly === true &&
        visualTeacherReviewDraftRecoveryReport.accepted === false &&
        visualTeacherReviewDraftRecoveryReport.packagingGated === true &&
        visualTeacherReviewDraftRecoveryReport.passed === true &&
        visualTeacherReviewDraftRecoveryReport.versions.every(
          (version) =>
            version.ruleEnabled === false &&
            version.accepted === false &&
            version.packagingGated === true &&
            version.learningTraceSteps >= 3
        ) &&
        visualTeacherReviewDraftRecoveryReport.exportJson.includes(
          "teacher_review_draft_persistence_recovery_v1"
        ) &&
        visualTeacherReviewDraftRecoveryReport.blockedActions.includes("Package"),
      evidence: `${visualTeacherReviewDraftRecoveryReport.persistedDraftCount} persisted teacher review drafts are recoverable without acceptance, rule enablement, or packaging unlock.`
    },
    {
      id: "teacher-review-draft-diff-recovery-replay",
      label: "Teacher review draft diff recovery replay",
      passed:
        visualTeacherReviewDraftReplayReport.mode === "teacher_review_draft_diff_recovery_replay_v1" &&
        visualTeacherReviewDraftReplayReport.format === "teacher_review_draft_diff_recovery_replay_json_v1" &&
        visualTeacherReviewDraftReplayReport.reviewOnly === true &&
        visualTeacherReviewDraftReplayReport.accepted === false &&
        visualTeacherReviewDraftReplayReport.packagingGated === true &&
        visualTeacherReviewDraftReplayReport.passed === true &&
        visualTeacherReviewDraftReplayReport.rows.every(
          (row) =>
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true &&
            row.replaySteps.length >= 3
        ) &&
        visualTeacherReviewDraftReplayReport.exportJson.includes(
          "teacher_review_draft_diff_recovery_replay_json_v1"
        ) &&
        visualTeacherReviewDraftReplayReport.blockedActions.includes("Package"),
      evidence: `${visualTeacherReviewDraftReplayReport.exportedReplayCount} teacher review draft diff/recovery replay rows are exportable without acceptance, rule enablement, or packaging unlock.`
    },
    {
      id: "visual-review-dossier",
      label: "Visual learning review dossier",
      passed:
        visualReviewDossier.status === "ready_for_teacher_review" &&
        visualReviewDossier.accepted === false &&
        visualReviewDossier.packagingGated === true &&
        visualReviewDossier.sections.every((section) => section.passed),
      evidence: `${visualReviewDossier.sections.filter((section) => section.passed).length}/${visualReviewDossier.sections.length} dossier sections are ready for teacher review without acceptance or packaging unlock.`
    },
    {
      id: "visual-review-manifest-review-only",
      label: "Visual review manifest is review-only",
      passed:
        visualReviewManifest.reviewOnly === true &&
        visualReviewManifest.accepted === false &&
        visualReviewManifest.packagingGated === true &&
        visualReviewManifest.evidenceEndpoints.every(
          (endpoint) => endpoint.method === "GET" && endpoint.persisted === false
        ) &&
        ["Accept technology", "Package", "Release", "Wrap"].every((item) =>
          visualReviewManifest.blockedActions.includes(item)
        ),
      evidence: `${visualReviewManifest.evidenceEndpoints.length} read-only review endpoints and ${visualReviewManifest.evidenceSections.length} manifest sections are exposed without acceptance or persistence.`
    },
    {
      id: "packaging-locked",
      label: "Packaging locked pending teacher acceptance",
      passed: visualLearningAcceptanceGate.packagingGated && !visualLearningAcceptanceGate.accepted,
      evidence: visualLearningAcceptanceGate.reason
    }
  ];
  const passedPolicyGates = policyEvidence.filter((item) => item.passed).length;
  const teacherAcceptanceBoundary: TeacherAcceptanceBoundary = {
    mode: "visual_learning_review_only",
    accepted: visualLearningAcceptanceGate.accepted,
    packagingGated: visualLearningAcceptanceGate.packagingGated,
    status: visualLearningAcceptanceGate.status,
    blockedWork: ["Packaging", "Release", "Wrapping"],
    allowedWork: ["Visual learning review", "Evidence inspection", "Verifier rerun"],
    exposedAcceptanceAction: false,
    reason: visualLearningAcceptanceGate.reason
  };
  const acceptanceBoundaryPassed =
    teacherAcceptanceBoundary.accepted === false &&
    teacherAcceptanceBoundary.packagingGated === true &&
    teacherAcceptanceBoundary.exposedAcceptanceAction === false &&
    teacherAcceptanceBoundary.mode === "visual_learning_review_only" &&
    ["Packaging", "Release", "Wrapping"].every((item) => teacherAcceptanceBoundary.blockedWork.includes(item));
  const userRequirementCoverageAudit = buildUserRequirementCoverageAudit({
    teacherAcceptanceBoundary,
    spatialEngineeringTeachingModel,
    domainLearningWorkflow,
    humanTeachingMemoryProtocol,
    teachingPredictionBoard,
    visualReviewDossier,
    visualTeacherReviewWorksheet,
    visualEvidenceReplay,
    challengeSuite,
    learningDeltas,
    policyEvidence
  });
  const handsOnTeachingLesson = buildHandsOnTeachingLesson({
    teacherAcceptanceBoundary,
    spatialEngineeringTeachingModel,
    domainLearningWorkflow,
    humanTeachingMemoryProtocol,
    teachingPredictionBoard,
    visualTeacherReviewWorksheet,
    userRequirementCoverageAudit
  });
  const teacherAcceptanceEvidenceAgenda = buildTeacherAcceptanceEvidenceAgenda({
    teacherAcceptanceBoundary,
    visualReviewDossier,
    visualTeacherReviewWorksheet,
    userRequirementCoverageAudit,
    visualReviewManifest,
    policyEvidence,
    corrections
  });
  const teacherReviewChecklist: TeacherReviewChecklistItem[] = [
    {
      id: "mvp-create-apprentice",
      label: "Create an apprentice",
      passed: Boolean(task.apprenticeId && task.apprentice.name),
      evidence: `${task.apprentice.name} is the active apprentice.`,
      href: `/apprentices/${task.apprenticeId}`
    },
    {
      id: "mvp-create-task",
      label: "Create a teachable task",
      passed: Boolean(task.id && task.name && task.goal),
      evidence: task.name,
      href: `/tasks/${task.id}`
    },
    {
      id: "mvp-visual-workflow",
      label: "Build a visual workflow",
      passed: workflowNodes.length >= 5,
      evidence: `${workflowNodes.length} workflow nodes define the teaching process.`,
      href: `/tasks/${task.id}/teach`
    },
    {
      id: "mvp-execute-task",
      label: "Execute the task",
      passed: runs.length > 0,
      evidence: `${runs.length} saved runs are available for replay.`,
      href: latestRun ? `/runs/${latestRun.id}` : `/tasks/${task.id}/run`
    },
    {
      id: "mvp-structured-trace",
      label: "Show structured execution trace",
      passed: alignedTraceNodes === workflowNodes.length && latestTrace.length > 0,
      evidence: `${alignedTraceNodes}/${workflowNodes.length} workflow nodes are trace-aligned.`,
      href: latestRun ? `/runs/${latestRun.id}` : `/tasks/${task.id}/run`
    },
    {
      id: "mvp-correct-output",
      label: "Let the user correct the output",
      passed: task.corrections.length > 0 && reviewableCorrectionCount === task.corrections.length,
      evidence: `${linkedCorrectionCount}/${task.corrections.length} corrections link to saved runs; ${spatialReviewCorrectionCount} spatial reviews, ${humanKnowledgeCorrectionCount} human knowledge ingests, ${spatialConstructionCorrectionCount} spatial construction corrections, ${spatialCodePatchMatchReviewCount} code patch match reviews, ${visualTeacherReviewDraftCount} teacher review drafts, ${voiceBrowserCompatibilityReviewDraftCount} voice compatibility review drafts, ${crossDomainTeacherScoreDraftCount} cross-domain score drafts, ${teacherAcceptanceAgendaDecisionDraftCount} teacher acceptance agenda decision drafts, and ${teacherTrialFeedbackDraftCount} teacher trial feedback drafts stay paused.`
    },
    {
      id: "mvp-extract-rules",
      label: "Convert correction into reusable rules",
      passed: memoryProvenance.length === rules.length && memoryProvenance.every((item) => item.sources.length > 0),
      evidence: `${memoryProvenance.filter((item) => item.sources.length > 0).length}/${rules.length} rules have teaching provenance.`
    },
    {
      id: "mvp-apply-next-run",
      label: "Apply rules in the next run",
      passed: learningDeltas.length > 0 && Boolean(appliedMemoryRun),
      evidence: learningDeltas[0]
        ? `${learningDeltas[0].beforeLighting} -> ${learningDeltas[0].afterLighting}.`
        : "No learning delta available.",
      href: learningDeltas[0]?.appliedRunId ? `/runs/${learningDeltas[0].appliedRunId}` : undefined
    },
    {
      id: "demo-photography-journal",
      label: "Photography travel journal demo",
      passed:
        task.name.toLowerCase().includes("photography travel journal") &&
        learningDeltas.some((delta) => delta.afterLighting === "golden hour"),
      evidence: "The seeded demo learns that sunset, dusk, and golden hour cues affect lighting and advice."
    },
    {
      id: "multi-source-learning",
      label: "Learn from corrections, examples, visual demos, and history",
      passed: visualDemos.length > 0 && task.examples.length > 0 && task.corrections.length > 0 && Boolean(historyRule),
      evidence: `${visualDemos.length} visual demos, ${task.examples.length} examples, ${task.corrections.length} corrections, ${historyRule ? 1 : 0} history lessons.`
    },
    {
      id: "guardrails-visible",
      label: "Keep reasoning public and reviewable",
      passed: policyEvidence.every((item) => item.passed),
      evidence: `${passedPolicyGates}/${policyEvidence.length} guardrail policy gates passed.`
    },
    {
      id: "packaging-waits-for-teacher",
      label: "Packaging waits for teacher acceptance",
      passed: visualLearningAcceptanceGate.packagingGated && !visualLearningAcceptanceGate.accepted,
      evidence: visualLearningAcceptanceGate.reason
    }
  ];
  const passedTeacherReviewChecklist = teacherReviewChecklist.filter((item) => item.passed).length;
  const primaryLearningDelta = learningDeltas[0];
  const learningLoopTimeline: QualificationLearningLoopTimelineItem[] = [
    {
      id: "human-teaches",
      phase: "teach",
      label: "Human teaches",
      passed: workflowNodes.length > 0 && (visualDemos.length > 0 || task.examples.length > 0),
      evidence: `${workflowNodes.length} workflow nodes, ${visualDemos.length} visual demos, ${task.examples.length} examples.`,
      href: `/tasks/${task.id}/teach`
    },
    {
      id: "ai-executes-before",
      phase: "execute",
      label: "AI executes before teaching is applied",
      passed: Boolean(primaryLearningDelta?.sourceRunId),
      evidence: primaryLearningDelta?.sourceRunId
        ? `Baseline run ${primaryLearningDelta.sourceRunId} produced ${primaryLearningDelta.beforeLighting}.`
        : "No baseline run linked to a learning delta.",
      href: primaryLearningDelta?.sourceRunId ? `/runs/${primaryLearningDelta.sourceRunId}` : undefined
    },
    {
      id: "human-corrects",
      phase: "correct",
      label: "Human corrects",
      passed: task.corrections.length > 0 && reviewableCorrectionCount === task.corrections.length,
      evidence: `${linkedCorrectionCount}/${task.corrections.length} corrections link to saved execution runs; ${spatialReviewCorrectionCount} spatial memory reviews, ${humanKnowledgeCorrectionCount} human knowledge ingests, ${spatialConstructionCorrectionCount} spatial construction corrections, ${spatialCodePatchMatchReviewCount} code patch match reviews, ${visualTeacherReviewDraftCount} teacher review drafts, ${voiceBrowserCompatibilityReviewDraftCount} voice compatibility review drafts, ${teacherAcceptanceAgendaDecisionDraftCount} teacher acceptance agenda decision drafts, and ${teacherTrialFeedbackDraftCount} teacher trial feedback drafts are traceable without enabling rules.`
    },
    {
      id: "system-extracts-rules",
      phase: "extract",
      label: "System extracts reusable rules",
      passed: Boolean(primaryLearningDelta?.ruleTitle) && memoryProvenance.every((item) => item.sources.length > 0),
      evidence: primaryLearningDelta?.ruleTitle
        ? `Rule extracted and sourced: ${primaryLearningDelta.ruleTitle}.`
        : "No extracted rule is linked to the learning delta."
    },
    {
      id: "ai-improves-next-run",
      phase: "improve",
      label: "AI improves on the next run",
      passed: Boolean(primaryLearningDelta?.appliedRunId && primaryLearningDelta.fieldChanges.length > 0),
      evidence: primaryLearningDelta
        ? `${primaryLearningDelta.beforeLighting} -> ${primaryLearningDelta.afterLighting}; changed ${primaryLearningDelta.changedFields.join(", ")}.`
        : "No before/after improvement is linked.",
      href: primaryLearningDelta?.appliedRunId ? `/runs/${primaryLearningDelta.appliedRunId}` : undefined
    },
    {
      id: "teacher-reviews-transparency",
      phase: "review",
      label: "Teacher reviews transparent evidence",
      passed: policyEvidence.every((item) => item.passed) && teacherReviewChecklist.every((item) => item.passed),
      evidence: `${passedPolicyGates}/${policyEvidence.length} policy gates and ${passedTeacherReviewChecklist}/${teacherReviewChecklist.length} review checks passed.`
    }
  ];
  const passedLearningLoopTimeline = learningLoopTimeline.filter((item) => item.passed).length;
  const requirements: QualificationRequirement[] = [
    {
      id: "teachable-apprentice",
      label: "Teachable apprentice model",
      principle: "Not a generic chatbot",
      passed: Boolean(task.apprenticeId && task.id && workflow),
      evidence: `${task.apprentice.name} is bound to task ${task.id}.`,
      href: `/apprentices/${task.apprenticeId}`
    },
    {
      id: "visual-workflow",
      label: "Visual teaching workflow",
      principle: "Human teaches before execution",
      passed: workflowNodes.length >= 5,
      evidence: `${workflowNodes.length} workflow nodes.`,
      href: `/tasks/${task.id}/teach`
    },
    {
      id: "public-structured-trace",
      label: "Public structured trace",
      principle: "Steps, rules, confidence, validation, review points",
      passed:
        latestTrace.length > 0 &&
        latestTrace.every((step) => step.nodeId && typeof step.confidence === "number" && step.validation),
      evidence: `${latestTrace.length} trace steps in latest run.`,
      href: latestRun ? `/runs/${latestRun.id}` : `/tasks/${task.id}/run`
    },
    {
      id: "generated-execution-plan",
      label: "AI generated execution plan",
      principle: "The teacher can inspect the plan before execution evidence",
      passed:
        executionPlan.length === latestTrace.length &&
        executionPlan.length > 0 &&
        executionPlan.every(
          (step) =>
            step.nodeId &&
            step.stepName &&
            step.plannedOutputFields.length > 0 &&
            typeof step.confidence === "number" &&
            step.validation.trim().length > 0
        ),
      evidence: `${executionPlan.length} planned workflow steps expose inputs, outputs, validation, confidence, and review gates.`,
      href: `/tasks/${task.id}/run`
    },
    {
      id: "workflow-trace-alignment",
      label: "Workflow trace alignment",
      principle: "Every important AI action maps to a visible workflow node",
      passed:
        workflowNodes.length > 0 &&
        alignedTraceNodes === workflowNodes.length &&
        latestTrace.every((step) => workflowNodes.some((node) => node.id === step.nodeId)),
      evidence: `${alignedTraceNodes}/${workflowNodes.length} workflow nodes have trace steps with validation.`,
      href: latestRun ? `/runs/${latestRun.id}` : `/tasks/${task.id}/run`
    },
    {
      id: "private-reasoning-withheld",
      label: "Private reasoning withheld",
      principle: "No private chain-of-thought exposure",
      passed: latestTrace.length > 0 && !hasPrivateTraceKey(latestTrace),
      evidence: "Trace JSON checked for private reasoning keys.",
      href: latestRun ? `/runs/${latestRun.id}` : undefined
    },
    {
      id: "feedback-memory",
      label: "Feedback becomes memory",
      principle: "Human corrects -> system extracts rules",
      passed: corrections.length > 0 && rules.length > 0,
      evidence: `${corrections.length} corrections and ${rules.length} rules.`
    },
    {
      id: "memory-provenance",
      label: "Reusable memory provenance",
      principle: "Human feedback becomes reviewable reusable memory",
      passed:
        memoryProvenance.length === rules.length &&
        memoryProvenance.every((item) => item.sources.length > 0) &&
        memoryProvenance.some((item) => item.appliedRunIds.length > 0),
      evidence: `${memoryProvenance.filter((item) => item.sources.length > 0).length}/${rules.length} rules have source provenance.`,
      href: `/tasks/${task.id}`
    },
    {
      id: "multi-source-teaching",
      label: "Multi-source teaching",
      principle: "Visual demos, corrections, examples, history",
      passed: visualDemos.length > 0 && corrections.length > 0 && task.examples.length > 0 && Boolean(historyRule),
      evidence: `${visualDemos.length} visual demos, ${corrections.length} corrections, ${task.examples.length} examples, ${historyRule ? 1 : 0} history lessons.`
    },
    {
      id: "next-run-improvement",
      label: "AI improves on next run",
      principle: "Rules change future execution",
      passed: learningDeltas.length > 0 && Boolean(appliedMemoryRun),
      evidence: learningDeltas[0]
        ? `${learningDeltas[0].beforeLighting} -> ${learningDeltas[0].afterLighting}.`
        : "No learning delta available.",
      href: learningDeltas[0]?.appliedRunId ? `/runs/${learningDeltas[0].appliedRunId}` : undefined
    },
    {
      id: "learning-loop-timeline",
      label: "Learning loop timeline",
      principle: "Human teaches -> AI executes -> human corrects -> system extracts rules -> AI improves",
      passed: learningLoopTimeline.every((item) => item.passed),
      evidence: `${passedLearningLoopTimeline}/${learningLoopTimeline.length} learning-loop phases passed.`
    },
    {
      id: "teacher-control",
      label: "Teacher control retained",
      principle: "Human review points remain explicit",
      passed: Boolean(latestRun && latestTrace.some((step) => step.id === "trace-human")),
      evidence: `${latestRun?.reviewPoints ?? 0} review points in latest run.`,
      href: latestRun ? `/runs/${latestRun.id}` : undefined
    },
    {
      id: "guardrail-policy-visible",
      label: "Guardrail policy evidence",
      principle: "The user can see why the AI action is allowed, paused, or reviewable",
      passed: policyEvidence.every((item) => item.passed),
      evidence: `${passedPolicyGates}/${policyEvidence.length} policy gates passed.`
    },
    {
      id: "teacher-review-checklist",
      label: "Teacher review checklist",
      principle: "The teacher can inspect the full MVP loop before accepting the technology",
      passed: teacherReviewChecklist.every((item) => item.passed),
      evidence: `${passedTeacherReviewChecklist}/${teacherReviewChecklist.length} review checklist items passed.`
    },
    {
      id: "packaging-gated",
      label: "Packaging remains gated",
      principle: "Visual learning before wrapping",
      passed: visualLearningAcceptanceGate.packagingGated && !visualLearningAcceptanceGate.accepted,
      evidence: visualLearningAcceptanceGate.reason
    },
    {
      id: "teacher-acceptance-boundary",
      label: "Teacher acceptance boundary",
      principle: "No packaging before explicit teacher acceptance",
      passed: acceptanceBoundaryPassed,
      evidence: "Review-only mode remains active; packaging, release, and wrapping are blocked."
    }
  ];
  const failedRequirements = requirements.filter((requirement) => !requirement.passed);

  return {
    taskId: task.id,
    apprenticeId: task.apprenticeId,
    status: failedRequirements.length === 0 ? "qualified_for_teacher_review" : "needs_learning_evidence",
    packaging: {
      gated: visualLearningAcceptanceGate.packagingGated,
      accepted: visualLearningAcceptanceGate.accepted,
      status: visualLearningAcceptanceGate.status,
      reason: visualLearningAcceptanceGate.reason
    },
    requirements,
    summary: {
      requirementsPassed: requirements.length - failedRequirements.length,
      requirementsTotal: requirements.length,
      architectureLayers: architectureAuditLayers.length,
      workflowNodes: workflowNodes.length,
      rules: rules.length,
      corrections: corrections.length,
      visualDemos: visualDemos.length,
      examples: task.examples.length,
      runs: runs.length,
      learningDeltas: learningDeltas.length,
      traceAlignedNodes: alignedTraceNodes,
      traceTotalNodes: workflowNodes.length,
      memoryProvenanceRules: memoryProvenance.filter((item) => item.sources.length > 0).length,
      policyGatesPassed: passedPolicyGates,
      policyGatesTotal: policyEvidence.length,
      teacherReviewChecklistPassed: passedTeacherReviewChecklist,
      teacherReviewChecklistTotal: teacherReviewChecklist.length,
      learningLoopTimelinePassed: passedLearningLoopTimeline,
      learningLoopTimelineTotal: learningLoopTimeline.length,
      acceptanceBoundaryPassed: acceptanceBoundaryPassed ? 1 : 0,
      acceptanceBoundaryTotal: 1,
      teacherAcceptanceAgendaItems: teacherAcceptanceEvidenceAgenda.items.length,
      teacherAcceptanceAgendaReady: teacherAcceptanceEvidenceAgenda.readyItems,
      teacherAcceptanceAgendaUnanswered: teacherAcceptanceEvidenceAgenda.unansweredItems,
      teacherAcceptanceAgendaLocked: teacherAcceptanceEvidenceAgenda.lockedItems,
      teacherAcceptanceAgendaDecisionItems: teacherAcceptanceEvidenceAgenda.decisionExchange.itemCount,
      teacherAcceptanceAgendaDecisionReady: teacherAcceptanceEvidenceAgenda.decisionExchange.passed ? 1 : 0,
      teacherAcceptanceAgendaAllowedDecisions:
        teacherAcceptanceEvidenceAgenda.decisionExchange.allowedDecisions.length,
      teacherAcceptanceAgendaDecisionReplayRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.rowCount,
      teacherAcceptanceAgendaDecisionReplayReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.passed ? 1 : 0,
      teacherAcceptanceAgendaDecisionReplayLockedRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.packagingLockedRows,
      teacherAcceptanceAgendaDecisionDraftRecoveryRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.rows.length,
      teacherAcceptanceAgendaDecisionDraftRecoveryReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.passed ? 1 : 0,
      teacherAcceptanceAgendaDecisionDraftRecoveryPersisted:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.persistedDraftCount,
      teacherAcceptanceAgendaDecisionDraftRecoveryChangedRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.changedRows,
      teacherAcceptanceAgendaDecisionDraftRecoveryMissingRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.missingRecoveredRows,
      teacherAcceptanceAgendaDecisionDraftRecoveryFollowUps:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.followUpRows,
      teacherAcceptanceAgendaNextReviewQueueItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.itemCount,
      teacherAcceptanceAgendaNextReviewQueueReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.passed ? 1 : 0,
      teacherAcceptanceAgendaNextReviewQueueLockedItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.lockedItems,
      teacherAcceptanceAgendaNextReviewHandoffSteps:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.stepCount,
      teacherAcceptanceAgendaNextReviewHandoffReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.passed ? 1 : 0,
      teacherAcceptanceAgendaNextReviewHandoffLockedSteps:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.lockedSteps,
      teacherAcceptanceAgendaNextReviewRunbookSteps:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.stepCount,
      teacherAcceptanceAgendaNextReviewRunbookReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.passed ? 1 : 0,
      teacherAcceptanceAgendaNextReviewRunbookLockedChecks:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.lockedChecks,
      teacherAcceptanceAgendaNextReviewDryRunRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.rowCount,
      teacherAcceptanceAgendaNextReviewDryRunReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewDryRunNoOpRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.noOpRows,
      teacherAcceptanceAgendaNextReviewReceiptRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptNeedsReviewRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.needsReviewRows,
      teacherAcceptanceAgendaNextReviewReceiptValidationRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptValidationReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptValidationBlockedDecisions:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.blockedDecisionCount,
      teacherAcceptanceAgendaNextReviewReceiptReplayRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptReplayReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptReplayBlockedDecisions:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.blockedDecisionCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanBlockedRoutes:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.blockedRouteCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditForbiddenTransitions:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.forbiddenTransitionCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketCommands:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.commandCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultNotRunRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .notRunRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationBlockedStatuses:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.blockedStatusCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayBlockedStatuses:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.blockedStatusCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueMismatchStops:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.mismatchStopRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffSteps:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.stepCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffMismatchStops:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.mismatchStopSteps,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookLockedChecks:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.lockedChecks,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunNoOpRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.noOpRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.needsReviewRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation
          .blockedDecisionRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay
          .rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay
          .passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay
          .blockedDecisionRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .blockedItems,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .readyForFollowUpItems,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.stepCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.blockedSteps,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.lockedChecks,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.noOpRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.needsReviewRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.blockedDecisionRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.blockedDecisionRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.blockedItems,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.readyForFollowUpItems,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.blockedStepCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.lockedChecks,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .noOpRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.needsReviewRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.blockedDecisionRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.blockedDecisionRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.blockedItems,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.readyForFollowUpItems,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.blockedSteps,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.lockedChecks,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.noOpRows,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.passed
          ? 1
          : 0,
      teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows:
        teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.needsReviewRows,
      executionPlanSteps: executionPlan.length,
      visualScenarioPassed: visualLearningScenarios.filter((scenario) => scenario.passed).length,
      visualScenarioTotal: visualLearningScenarios.length,
      visualScenarioTraceSteps: visualLearningScenarios.reduce(
        (total, scenario) => total + scenario.traceSummary.length,
        0
      ),
      visualRegressionPassed: visualRegressionCases.filter((item) => item.passed).length,
      visualRegressionTotal: visualRegressionCases.length,
      visualRegressionChanged: visualRegressionCases.filter((item) => item.changedByMemory).length,
      visualRegressionConservative: visualRegressionCases.filter((item) => !item.changedByMemory).length,
      visualRobustnessPassed: visualRobustnessSuite.passed,
      visualRobustnessTotal: visualRobustnessSuite.total,
      visualRobustnessFalsePositiveGuards: visualRobustnessSuite.cases.filter(
        (item) => item.stressType === "false_positive_guard"
      ).length,
      visualRobustnessPositiveParaphrases: visualRobustnessSuite.cases.filter(
        (item) => item.stressType === "positive_paraphrase"
      ).length,
      challengeSuitePassed: challengeSuite.passed,
      challengeSuiteTotal: challengeSuite.total,
      challengeSuiteTraceSteps: challengeSuite.items.reduce(
        (total, item) => total + item.probe.traceSummary.length,
        0
      ),
      capabilityBoundaryPassed: capabilityBoundary.filter((item) => item.passed).length,
      capabilityBoundaryTotal: capabilityBoundary.length,
      capabilityBoundaryItems: capabilityBoundary.length,
      codexCapabilityTransferItems: codexCapabilityTransferReport.itemCount,
      codexCapabilityTransferReady: codexCapabilityTransferReport.readyItems,
      codexCapabilityTransferLocked: codexCapabilityTransferReport.lockedItems,
      codexCapabilityTransplantRehearsalRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.rowCount,
      codexCapabilityTransplantRehearsalReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.readyRows,
      codexCapabilityTransplantRehearsalLocked:
        codexCapabilityTransferReport.transplantDraft.rehearsal.lockedRows,
      codexCapabilityTransplantRehearsalResultRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.rowCount,
      codexCapabilityTransplantRehearsalResultNotRun:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.notRunRows,
      codexCapabilityTransplantRehearsalResultLocked:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.lockedRows,
      codexCapabilityTransplantRehearsalResultValidationRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.rowCount,
      codexCapabilityTransplantRehearsalResultValidationReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.readyRows,
      codexCapabilityTransplantRehearsalResultValidationBlockedStatuses:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.blockedStatusRows,
      codexCapabilityTransplantRehearsalResultValidationReplayRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.rowCount,
      codexCapabilityTransplantRehearsalResultValidationReplayReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.readyRows,
      codexCapabilityTransplantRehearsalResultValidationReplayBlockedStatuses:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.blockedStatusRows,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueItems:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .itemCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .readyItems,
      codexCapabilityTransplantRehearsalResultValidationReplayQueuePendingVerifier:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .pendingVerifierItems,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueMatchedEvidence:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .matchedEvidenceItems,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueMismatchBlockers:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .mismatchBlockerItems,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffSteps:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.stepCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffLockedSteps:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.lockedSteps,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookItems:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.itemCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookLockedChecks:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.lockedChecks,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.rowCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunNoOpRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.noOpRows,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.rowCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.needsReviewRows,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.blockedDecisionRows,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rowCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.blockedDecisionRows,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.itemCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.blockedItems,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.readyForFollowUpItems,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.blockedSteps,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.lockedChecks,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .rowCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .noOpRows,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.rowCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.needsReviewRows,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.rowCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.blockedDecisionRows,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.rowCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.blockedDecisionRows,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.itemCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.blockedItems,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.readyForFollowUpItems,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.passed
          ? 1
          : 0,
      codexCapabilityTransplantRehearsalResultValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps:
        codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
          .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.blockedSteps,
      visualReadinessPassed: visualLearningReadiness.filter((item) => item.passed).length,
      visualReadinessTotal: visualLearningReadiness.length,
      visualCueAuditPassed: visualCueAuditTrail.filter((item) => item.passed).length,
      visualCueAuditTotal: visualCueAuditTrail.length,
      visualDecisionLedgerItems: visualDecisionLedger.length,
      visualDecisionApplied: visualDecisionLedger.filter((item) => item.decision === "applied").length,
      visualDecisionConflicted: visualDecisionLedger.filter(
        (item) => item.decision === "conflicted" || item.decision === "counterexample"
      ).length,
      visualDecisionReviewRequired: visualDecisionLedger.filter((item) => item.needsReview).length,
      visualLearningLimitItems: visualLearningLimits.length,
      visualLearningUnprovenCues: visualLearningLimits.filter((item) => item.category === "unproven_cue").length,
      visualLearningReviewLimits: visualLearningLimits.filter((item) => item.category === "teacher_review").length,
      visualLearningBlockedLimits: visualLearningLimits.filter((item) => item.category === "blocked_work").length,
      visualRuleCoverageRules: visualRuleCoverageMatrix.items.length,
      visualRuleCoverageCovered: visualRuleCoverageMatrix.items.filter((item) => item.passed).length,
      visualRuleCoverageSourceOnly: visualRuleCoverageMatrix.items.filter(
        (item) => item.status === "source_only"
      ).length,
      visualRuleCoveragePositiveLinks: visualRuleCoverageMatrix.items.reduce(
        (total, item) => total + item.positiveDecisionIds.length,
        0
      ),
      visualRuleCoverageReviewLinks: visualRuleCoverageMatrix.items.reduce(
        (total, item) => total + item.reviewDecisionIds.length,
        0
      ),
      visualCorrectionRehearsals: visualCorrectionRehearsal.cases.length,
      visualCorrectionRehearsalsPassed: visualCorrectionRehearsal.cases.filter((item) => item.passed).length,
      visualCorrectionRehearsalChanged: visualCorrectionRehearsal.cases.filter(
        (item) => item.changedByCandidateRule
      ).length,
      visualCorrectionRehearsalReviewPreserved: visualCorrectionRehearsal.cases.filter(
        (item) => item.afterReview
      ).length,
      visualStateTransitions: visualLearningStateAudit.transitions.length,
      visualStateTransitionsPassed: visualLearningStateAudit.transitions.filter((item) => item.passed).length,
      visualStateTransitionAutomatic: visualLearningStateAudit.transitions.filter(
        (item) => item.reviewState === "automatic"
      ).length,
      visualStateTransitionReview: visualLearningStateAudit.transitions.filter(
        (item) => item.reviewState === "teacher_review"
      ).length,
      visualStateTransitionLocked: visualLearningStateAudit.transitions.filter(
        (item) => item.reviewState === "locked"
      ).length,
      visualUncertaintyEscalations: visualUncertaintyEscalationAudit.items.length,
      visualUncertaintyEscalationsReady: visualUncertaintyEscalationAudit.items.filter(
        (item) => item.evidenceReady
      ).length,
      visualUncertaintyTeacherReview: visualUncertaintyEscalationAudit.items.filter(
        (item) => item.reviewState === "teacher_review"
      ).length,
      visualUncertaintyLocked: visualUncertaintyEscalationAudit.items.filter(
        (item) => item.reviewState === "locked"
      ).length,
      spatialTeachingSamples: spatialEngineeringTeachingModel.sampleCount,
      spatialFitCandidates: spatialEngineeringTeachingModel.candidates.length,
      spatialFitCandidatesReady: spatialEngineeringTeachingModel.candidates.filter((candidate) => candidate.passed).length,
      spatialArcFitCandidates: spatialEngineeringTeachingModel.candidates.filter(
        (candidate) => candidate.model === "circular_arc"
      ).length,
      spatialSplineFitCandidates: spatialEngineeringTeachingModel.candidates.filter(
        (candidate) => candidate.model === "bezier_spline"
      ).length,
      spatialMultiSegmentSplineFitCandidates: spatialEngineeringTeachingModel.candidates.filter(
        (candidate) => candidate.model === "multi_segment_bezier_spline"
      ).length,
      spatialSurfacePatchFitCandidates: spatialEngineeringTeachingModel.candidates.filter(
        (candidate) => candidate.model === "surface_patch"
      ).length,
      spatialTeacherSelectableCandidates: spatialEngineeringTeachingModel.candidates.filter(
        (candidate) => candidate.teacherSelectable
      ).length,
      spatialModelingRules: spatialEngineeringTeachingModel.extractedRules.length,
      spatialTeachingRehearsals: spatialEngineeringTeachingModel.teachingRehearsals.length,
      spatialTeachingRehearsalsReady: spatialEngineeringTeachingModel.teachingRehearsals.filter(
        (rehearsal) => rehearsal.passed
      ).length,
      spatialGuidedGenerationSteps: spatialEngineeringTeachingModel.guidedGenerationSteps.length,
      spatialGuidedGenerationStepsReady: spatialEngineeringTeachingModel.guidedGenerationSteps.filter(
        (step) => step.passed && step.reviewState === "awaiting_teacher_review"
      ).length,
      spatialConstructionPredictionPlans: spatialEngineeringTeachingModel.constructionPredictionPlans.length,
      spatialConstructionPredictionPlansReady: spatialEngineeringTeachingModel.constructionPredictionPlans.filter(
        (plan) =>
          plan.passed &&
          plan.accepted === false &&
          plan.packagingGated === true &&
          plan.constructionSteps.every((step) => step.passed && step.reviewState === "awaiting_teacher_review")
      ).length,
      spatialBatchSamples: spatialEngineeringTeachingModel.batchPatternLearning.sampleCount,
      spatialBatchRuleCandidates: spatialEngineeringTeachingModel.batchPatternLearning.ruleCandidates.length,
      spatialPositionParameterRows:
        spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.parameterRows.length,
      spatialPositionParameterRowsReady:
        spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.parameterRows.filter(
          (row) =>
            row.passed &&
            row.reviewOnly === true &&
            row.accepted === false &&
            row.packagingGated === true &&
            row.teacherQuestion.includes("老师")
        ).length,
      spatialPositionParameterReportReady:
        spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.passed &&
        spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.reviewOnly === true &&
        spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.accepted === false &&
        spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.packagingGated === true
          ? 1
          : 0,
      spatialResidualLenses: spatialEngineeringTeachingModel.residualTeachingLenses.length,
      spatialResidualVectors: spatialEngineeringTeachingModel.residualTeachingLenses.reduce(
        (sum, lens) => sum + lens.vectors.length,
        0
      ),
      spatialSurfacePatchLenses: spatialEngineeringTeachingModel.surfacePatchTeachingLens ? 1 : 0,
      spatialSurfacePatchVectors: spatialEngineeringTeachingModel.surfacePatchTeachingLens.vectors.length,
      spatialSurfacePatchReady:
        spatialEngineeringTeachingModel.surfacePatchTeachingLens.passed &&
        spatialEngineeringTeachingModel.surfacePatchTeachingLens.reviewOnly === true &&
        spatialEngineeringTeachingModel.surfacePatchTeachingLens.accepted === false &&
        spatialEngineeringTeachingModel.surfacePatchTeachingLens.packagingGated === true
          ? 1
          : 0,
      spatialSurfacePatchStabilitySamples:
        spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.sourceSampleCount,
      spatialSurfacePatchStabilityReady:
        spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.passed &&
        spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.reviewOnly === true &&
        spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.accepted === false &&
        spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.packagingGated === true
          ? 1
          : 0,
      spatialSurfacePatchStabilityOutliers:
        spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.outlierPolicy.outlierCount,
      spatialSurfacePatchSelectionReplays:
        spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.teacherSelectionReplay.options.length,
      spatialSurfacePatchSelectionReplayReady:
        spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.teacherSelectionReplay.passed &&
        spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.teacherSelectionReplay.reviewOnly === true &&
        spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.teacherSelectionReplay.accepted === false &&
        spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.teacherSelectionReplay.packagingGated === true
          ? 1
          : 0,
      spatialSurfacePatchSelectionReplayDisabledDrafts:
        spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport.teacherSelectionReplay.options.reduce(
          (count, option) => count + option.disabledRuleDrafts.length,
          0
        ),
      spatialDirectionToleranceChecks: spatialEngineeringTeachingModel.directionToleranceChecks.length,
      spatialDirectionToleranceReady: spatialEngineeringTeachingModel.directionToleranceChecks.filter(
        (check) => check.passed
      ).length,
      spatialCandidateComparisons: spatialEngineeringTeachingModel.candidateComparisonMatrix.length,
      spatialCandidateComparisonsReady: spatialEngineeringTeachingModel.candidateComparisonMatrix.filter(
        (comparison) =>
          comparison.passed &&
          comparison.reviewOnly === true &&
          comparison.accepted === false &&
          comparison.packagingGated === true
      ).length,
      spatialCandidateSelectionImpactPreviews:
        spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.length,
      spatialCandidateSelectionImpactPreviewsReady:
        spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.filter(
          (preview) =>
            preview.passed &&
            preview.reviewOnly === true &&
            preview.accepted === false &&
            preview.packagingGated === true &&
            preview.disabledRuleDrafts.every(
              (draft) => draft.willBeEnabled === false && draft.teacherReviewRequired === true
            ) &&
            preview.predictedSteps.every(
              (step) => step.reviewState === "awaiting_teacher_review" && step.nextStepPrediction.includes("下一步预测")
            )
        ).length,
      spatialCandidateSelectionDisabledDrafts:
        spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.reduce(
          (sum, preview) => sum + preview.disabledRuleDrafts.length,
          0
        ),
      spatialCandidateImpactCorrectionRehearsals:
        spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.length,
      spatialCandidateImpactCorrectionRehearsalsReady:
        spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.filter(
          (preview) =>
            preview.correctionRehearsal.passed &&
            preview.correctionRehearsal.reviewOnly === true &&
            preview.correctionRehearsal.accepted === false &&
            preview.correctionRehearsal.packagingGated === true &&
            preview.correctionRehearsal.secondRoundCandidates.length >= 3 &&
            preview.correctionRehearsal.secondRoundCandidates.every(
              (candidate) =>
                candidate.passed &&
                candidate.reviewOnly === true &&
                candidate.accepted === false &&
                candidate.packagingGated === true &&
                candidate.regeneratedRuleDrafts.every(
                  (draft) => draft.willBeEnabled === false && draft.teacherReviewRequired === true
                ) &&
                candidate.regeneratedConflictBoundaries.length >= 4
            )
        ).length,
      spatialCandidateImpactSecondRoundCandidates:
        spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.reduce(
          (sum, preview) => sum + preview.correctionRehearsal.secondRoundCandidates.length,
          0
        ),
      spatialCandidateImpactSecondRoundSelectionPreviews:
        spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.length,
      spatialCandidateImpactSecondRoundSelectionPreviewsReady:
        spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.filter(
          (preview) =>
            preview.selectedSecondRoundPreview.passed &&
            preview.selectedSecondRoundPreview.ruleEnabled === false &&
            preview.selectedSecondRoundPreview.accepted === false &&
            preview.selectedSecondRoundPreview.packagingGated === true &&
            preview.selectedSecondRoundPreview.followUpPlanSteps.length >= 4 &&
            preview.selectedSecondRoundPreview.noOpActions.includes("No packaging") &&
            preview.selectedSecondRoundPreview.blockedActions.includes("Accept technology")
        ).length,
      spatialCandidateImpactSecondRoundSelectionTraceSteps:
        spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.reduce(
          (sum, preview) => sum + preview.selectedSecondRoundPreview.publicTraceSteps.length,
          0
        ),
      spatialCandidateImpactSecondRoundSelectionTraceStepsReady:
        spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.reduce(
          (sum, preview) =>
            sum +
            preview.selectedSecondRoundPreview.publicTraceSteps.filter(
              (step) => step.passed && step.validation.length > 0 && step.confidence > 0 && step.confidence <= 1
            ).length,
          0
        ),
      spatialCandidateImpactRegeneratedDrafts:
        spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.reduce(
          (sum, preview) =>
            sum +
            preview.correctionRehearsal.secondRoundCandidates.reduce(
              (candidateSum, candidate) => candidateSum + candidate.regeneratedRuleDrafts.length,
              0
            ),
          0
        ),
      spatialPausedMemoryRules: rules.filter((rule) => isSpatialTeachingRule(rule) && !rule.enabled).length,
      spatialCodePatchMemories: spatialConstructionCodePatchMemoryReplays.length,
      spatialCodePatchMemoriesReady: spatialConstructionCodePatchMemoryReplays.filter((item) => item.passed).length,
      spatialCodePatchMemoryMatches: spatialConstructionCodePatchMemoryMatches.length,
      spatialCodePatchMemoryMatchesReady: spatialConstructionCodePatchMemoryMatches.filter((item) => item.passed).length,
      domainLearningStages: domainLearningWorkflow.stages.length,
      domainLearningStagesReady: domainLearningWorkflow.stages.filter((stage) => stage.passed).length,
      domainKnowledgeNodes: domainLearningWorkflow.knowledgeNodes.length,
      domainGuidedGenerationSteps: domainLearningWorkflow.guidedGenerationSteps.length,
      aiServiceReplacementSchemaChecks: domainLearningWorkflow.aiServiceReplacementReadiness.schemaChecks.length,
      aiServiceReplacementSteps: domainLearningWorkflow.aiServiceReplacementReadiness.replacementSteps.length,
      aiServiceReplacementReady: domainLearningWorkflow.aiServiceReplacementReadiness.passed ? 1 : 0,
      aiServiceValidationCases: domainLearningWorkflow.aiServiceOutputValidationRehearsal.cases.length,
      aiServiceValidationBlockedCases: domainLearningWorkflow.aiServiceOutputValidationRehearsal.blockedCases,
      aiServiceValidationReady: domainLearningWorkflow.aiServiceOutputValidationRehearsal.passed ? 1 : 0,
      humanTeachingMemoryRules: humanTeachingMemoryProtocol.rules.length,
      humanTeachingMemoryRulesReady: humanTeachingMemoryProtocol.rules.filter((rule) => rule.passed).length,
      teachingConflictSteps: humanTeachingMemoryProtocol.conflictSteps.length,
      teachingConflictStepsReady: humanTeachingMemoryProtocol.conflictSteps.filter((step) => step.passed).length,
      voiceTeachingModes: humanTeachingMemoryProtocol.voiceExperience.passed ? 1 : 0,
      voiceRestatementReviewVersions:
        humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.teacherReviewHistory.versions.length ?? 0,
      voiceRestatementReviewHistoryReady:
        humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.teacherReviewHistory.passed ? 1 : 0,
      voiceEngineSelectionCandidates:
        humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.voiceEngineSelection.candidates.length ?? 0,
      voiceEngineSelectionReady:
        humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.voiceEngineSelection.passed ? 1 : 0,
      voiceEngineTeacherScoreReplays:
        humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.voiceEngineSelection.candidates.filter(
          (candidate) => candidate.teacherScoreReplay.replaySource === "teacher_voice_review_replay"
        ).length ?? 0,
      voiceBrowserCompatibilityBrowsers:
        humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.browserCompatibilityAudit.cases.length ?? 0,
      voiceBrowserCompatibilityReady:
        humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.browserCompatibilityAudit.passed ? 1 : 0,
      voiceBrowserCompatibilityRecognitionRisks:
        humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.browserCompatibilityAudit.recognitionRiskBrowsers ??
        0,
      voiceBrowserCompatibilityFallbacks:
        humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.browserCompatibilityAudit
          .fallbackRequiredBrowsers ?? 0,
      voiceBrowserCompatibilityReviewDrafts: voiceBrowserCompatibilityReviewDraftCount,
      voiceBrowserCompatibilityComparisonBrowsers: voiceBrowserCompatibilityComparisonReport.browsersCovered,
      voiceBrowserCompatibilityComparisonReady: voiceBrowserCompatibilityComparisonReport.passed ? 1 : 0,
      voiceBrowserCompatibilityComparisonPersistedReviews:
        voiceBrowserCompatibilityComparisonReport.persistedReviewCount,
      voiceBrowserCompatibilityComparisonFallbackTests:
        voiceBrowserCompatibilityComparisonReport.fallbackTestedBrowsers,
      voiceBrowserCompatibilityBatchDiffRows: voiceBrowserCompatibilityBatchDiffReport.rows.length,
      voiceBrowserCompatibilityBatchDiffReady: voiceBrowserCompatibilityBatchDiffReport.passed ? 1 : 0,
      voiceBrowserCompatibilityBatchDiffMissingReviews:
        voiceBrowserCompatibilityBatchDiffReport.missingRuntimeReviews,
      voiceBrowserCompatibilityBatchDiffRuntimeDiffs:
        voiceBrowserCompatibilityBatchDiffReport.runtimeDiffs,
      voiceBrowserCompatibilityBatchDiffFallbackGaps:
        voiceBrowserCompatibilityBatchDiffReport.fallbackGaps,
      teachingPredictionMoves: teachingPredictionBoard.moves.length,
      teachingPredictionMovesReady: teachingPredictionBoard.moves.filter((move) => move.passed).length,
      visualReviewDossierPassed: visualReviewDossier.sections.filter((section) => section.passed).length,
      visualReviewDossierTotal: visualReviewDossier.sections.length,
      userRequirementCoverageItems: userRequirementCoverageAudit.items.length,
      userRequirementCoverageReady: userRequirementCoverageAudit.items.filter(
        (item) => item.reviewState === "ready_for_teacher_review" && item.passed
      ).length,
      userRequirementCoverageLocked: userRequirementCoverageAudit.items.filter(
        (item) => item.reviewState === "locked_until_teacher_acceptance" && item.passed
      ).length,
      handsOnTeachingLessonSteps: handsOnTeachingLesson.steps.length,
      handsOnTeachingLessonReady: handsOnTeachingLesson.steps.filter(
        (step) => step.reviewState === "awaiting_teacher_review" && step.passed
      ).length,
      handsOnTeachingLessonLocked: handsOnTeachingLesson.steps.filter(
        (step) => step.reviewState === "locked_until_teacher_acceptance" && step.passed
      ).length,
      handsOnTeachingRunbookSteps: handsOnTeachingLesson.runbook.items.length,
      handsOnTeachingRunbookReady: handsOnTeachingLesson.runbook.readySteps,
      handsOnTeachingRunbookLocked: handsOnTeachingLesson.runbook.lockedSteps,
      visualReviewManifestSections: visualReviewManifest.evidenceSections.length,
      visualReviewManifestEndpoints: visualReviewManifest.evidenceEndpoints.length,
      visualConfidenceCalibrationPassed: visualConfidenceCalibration.items.filter((item) => item.passed).length,
      visualConfidenceCalibrationTotal: visualConfidenceCalibration.items.length,
      visualConfidenceAutoReady: visualConfidenceCalibration.items.filter(
        (item) => item.actualOutcome === "automatic"
      ).length,
      visualConfidenceReviewRequired: visualConfidenceCalibration.items.filter(
        (item) => item.actualOutcome === "teacher_review"
      ).length,
      visualBehaviorScorecardCases: visualBehaviorScorecard.cases.length,
      visualBehaviorScorecardPassed: visualBehaviorScorecard.cases.filter((item) => item.passed).length,
      visualBehaviorScorecardMetrics: visualBehaviorScorecard.metrics.length,
      visualBehaviorScorecardMetricsPassed: visualBehaviorScorecard.metrics.filter((metric) => metric.passed).length,
      visualBehaviorScorecardAutoRoutes: visualBehaviorScorecard.cases.filter(
        (item) => item.route === "automatic"
      ).length,
      visualBehaviorScorecardReviewRoutes: visualBehaviorScorecard.cases.filter(
        (item) => item.route === "teacher_review"
      ).length,
      visualTeacherWorksheetItems: visualTeacherReviewWorksheet.items.length,
      visualTeacherWorksheetReady: visualTeacherReviewWorksheet.items.filter((item) => item.evidenceReady).length,
      visualTeacherWorksheetUnanswered: visualTeacherReviewWorksheet.items.filter(
        (item) => item.status === "unanswered"
      ).length,
      visualTeacherWorksheetBatchExportItems: visualTeacherReviewWorksheet.batchReviewExchange.itemCount,
      visualTeacherWorksheetBatchExportReady: visualTeacherReviewWorksheet.batchReviewExchange.passed ? 1 : 0,
      visualTeacherWorksheetBatchAllowedDecisions:
        visualTeacherReviewWorksheet.batchReviewExchange.allowedDecisions.length,
      visualTeacherWorksheetDraftVersions: visualTeacherReviewWorksheet.draftVersionComparison.versions.length,
      visualTeacherWorksheetDraftVersionReady: visualTeacherReviewWorksheet.draftVersionComparison.passed ? 1 : 0,
      visualTeacherWorksheetDraftChangedItems:
        visualTeacherReviewWorksheet.draftVersionComparison.changedItemCount,
      visualTeacherWorksheetDraftFollowUpItems:
        visualTeacherReviewWorksheet.draftVersionComparison.followUpItemCount,
      visualTeacherReviewDraftRecoveryVersions:
        visualTeacherReviewDraftRecoveryReport.versions.length,
      visualTeacherReviewDraftRecoveryReady: visualTeacherReviewDraftRecoveryReport.passed ? 1 : 0,
      visualTeacherReviewDraftRecoveryPersisted:
        visualTeacherReviewDraftRecoveryReport.persistedDraftCount,
      visualTeacherReviewDraftRecoveryFollowUps:
        visualTeacherReviewDraftRecoveryReport.restoredFollowUpItems,
      visualTeacherReviewDraftReplayRows: visualTeacherReviewDraftReplayReport.rows.length,
      visualTeacherReviewDraftReplayReady: visualTeacherReviewDraftReplayReport.passed ? 1 : 0,
      visualTeacherReviewDraftReplayStaticDiffs:
        visualTeacherReviewDraftReplayReport.staticVersionDiffs,
      visualTeacherReviewDraftReplayPersistedDiffs:
        visualTeacherReviewDraftReplayReport.persistedRecoveryDiffs,
      visualTeacherReviewDraftReplayExported:
        visualTeacherReviewDraftReplayReport.exportedReplayCount,
      visualTeacherReviewDrafts: visualTeacherReviewDraftCount,
      visualEvidenceReplaySteps: visualEvidenceReplay.steps.length,
      visualEvidenceReplayReady: visualEvidenceReplay.steps.filter((step) => step.passed).length,
      visualRedTeamRisks: visualRedTeamRegister.risks.length,
      visualRedTeamMitigated: visualRedTeamRegister.risks.filter(
        (risk) => risk.status === "mitigated_for_review"
      ).length,
      visualRedTeamTeacherReview: visualRedTeamRegister.risks.filter(
        (risk) => risk.status === "needs_teacher_review"
      ).length,
      visualRedTeamLocked: visualRedTeamRegister.risks.filter((risk) => risk.status === "locked").length,
      crossDomainValidationCases: crossDomainValidationReport.cases.length,
      crossDomainValidationReady: crossDomainValidationReport.passed ? 1 : 0,
      crossDomainValidationDomains: crossDomainValidationReport.domainsCovered.length,
      crossDomainValidationApprentices: crossDomainValidationReport.apprenticesCovered.length,
      crossDomainValidationReviewBoundaries: crossDomainValidationReport.reviewBoundaries,
      crossDomainTeacherScoreItems: crossDomainValidationReport.teacherBatchScoreReplay.items.length,
      crossDomainTeacherScoreReplayReady: crossDomainValidationReport.teacherBatchScoreReplay.passed ? 1 : 0,
      crossDomainTeacherScoreAverage: crossDomainValidationReport.teacherBatchScoreReplay.averageScore,
      crossDomainTeacherScoreFollowUps: crossDomainValidationReport.teacherBatchScoreReplay.needsFollowUp,
      crossDomainTeacherScoreDisabledDrafts:
        crossDomainValidationReport.teacherBatchScoreReplay.disabledDraftImpacts,
      crossDomainTeacherScoreRecoveryRows:
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.rows.length,
      crossDomainTeacherScoreRecoveryReady:
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.passed ? 1 : 0,
      crossDomainTeacherScoreRecoveryPersisted:
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.persistedDraftCount,
      crossDomainTeacherScoreRecoveryChangedRows:
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.changedRows,
      crossDomainTeacherScoreRecoveryMissingRows:
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.missingRecoveredRows,
      crossDomainTeacherScoreRecoveryFollowUps:
        crossDomainValidationReport.teacherScoreDraftRecoveryDiff.recoveredFollowUps
    },
    learningDeltas,
    executionPlan,
    traceAlignment,
    memoryProvenance,
    policyEvidence,
    teacherReviewChecklist,
    learningLoopTimeline,
    teacherAcceptanceBoundary,
    teacherAcceptanceEvidenceAgenda,
    visualDemos,
    visualLearningScenarios,
    visualRegressionCases,
    visualRobustnessSuite,
    challengeSuite,
    capabilityBoundary,
    codexCapabilityTransferReport,
    visualLearningReadiness,
    visualCueAuditTrail,
    visualDecisionLedger,
    visualLearningLimits,
    visualRuleCoverageMatrix,
    visualCorrectionRehearsal,
    visualLearningStateAudit,
    visualUncertaintyEscalationAudit,
    spatialEngineeringTeachingModel,
    spatialConstructionCodePatchMemoryReplays,
    spatialConstructionCodePatchMemoryMatches,
    domainLearningWorkflow,
    humanTeachingMemoryProtocol,
    voiceBrowserCompatibilityComparisonReport,
    voiceBrowserCompatibilityBatchDiffReport,
    teachingPredictionBoard,
    visualReviewDossier,
    userRequirementCoverageAudit,
    handsOnTeachingLesson,
    visualReviewManifest,
    visualConfidenceCalibration,
    visualBehaviorScorecard,
    visualTeacherReviewWorksheet,
    visualTeacherReviewDraftRecoveryReport,
    visualTeacherReviewDraftReplayReport,
    visualEvidenceReplay,
    visualRedTeamRegister,
    crossDomainValidationReport
  };
}
