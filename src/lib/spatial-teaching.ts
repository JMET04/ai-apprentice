import type { LearningExtractionStep, RuleRecord } from "./types";

export type SpatialPoint3D = {
  x: number;
  y: number;
  z: number;
};

export type SpatialTeachingInput = {
  frame: {
    unit: "meter";
    axes: ["x", "y", "z"];
    origin: SpatialPoint3D | [number, number, number];
  };
  strokes: Array<{
    id: string;
    points: Array<SpatialPoint3D | [number, number, number]>;
    tolerance: number;
  }>;
  constraints: Array<{
    type: "axis_snap" | "freehand_intent" | "polyline_candidate";
    target: string;
    value: string;
  }>;
  expectedRules: string[];
  sampleCount?: number;
};

export type SpatialFitCandidate = {
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
  controlPoints: SpatialPoint3D[];
  arc?: {
    plane: "xz";
    center: SpatialPoint3D;
    radius: number;
    startAngleDeg: number;
    endAngleDeg: number;
    sweepDeg: number;
  };
  bezier?: {
    controlHandles: SpatialPoint3D[];
    sampledPointCount: number;
    maxHandleOffset: number;
  };
  multiSegment?: {
    segmentCount: number;
    knotPoints: SpatialPoint3D[];
    sampledPointCount: number;
    maxSegmentSpan: number;
  };
  surfacePatch?: {
    fitModel: "local_xz_height_patch";
    patchCenter: SpatialPoint3D;
    gradient: {
      xSlope: number;
      zSlope: number;
    };
    patchCorners: SpatialPoint3D[];
    meanHeightResidual: number;
    maxHeightResidual: number;
    exceedCount: number;
  };
  passed: boolean;
  evidence: string;
};

export type SpatialFitResidualVector = {
  rawPoint: SpatialPoint3D;
  nearestFitPoint: SpatialPoint3D;
  residualDistance: number;
  exceedsTolerance: boolean;
};

export type SpatialFitResidualTeachingLens = {
  candidateId: string;
  candidateLabel: string;
  tolerance: number;
  vectors: SpatialFitResidualVector[];
  maxResidual: number;
  minResidual: number;
  exceedCount: number;
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
};

export type SpatialSurfacePatchResidualVector = {
  rawPoint: SpatialPoint3D;
  projectedPatchPoint: SpatialPoint3D;
  heightResidual: number;
  exceedsTolerance: boolean;
};

export type SpatialSurfacePatchTeachingLens = {
  id: "surface-patch-height-field-lens";
  label: string;
  fitModel: "local_xz_height_patch";
  equation: string;
  patchCenter: SpatialPoint3D;
  gradient: {
    xSlope: number;
    zSlope: number;
  };
  patchCorners: SpatialPoint3D[];
  vectors: SpatialSurfacePatchResidualVector[];
  meanHeightResidual: number;
  maxHeightResidual: number;
  exceedCount: number;
  teacherQuestion: string;
  nextStepPrediction: string;
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type SpatialDirectionToleranceCheck = {
  candidateId: string;
  candidateLabel: string;
  teacherDirection: SpatialPoint3D;
  candidateDirection: SpatialPoint3D;
  angularDeviationDeg: number;
  allowedDeviationDeg: number;
  status: "within_tolerance" | "needs_teacher_review";
  teacherQuestion: string;
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type SpatialFitCandidateComparison = {
  candidateId: string;
  candidateLabel: string;
  model: SpatialFitCandidate["model"];
  recommendedReviewOrder: number;
  residual: number;
  residualRank: number;
  maxResidual: number;
  exceedToleranceCount: number;
  angularDeviationDeg: number;
  directionRank: number;
  complexity: "low" | "medium" | "high";
  teacherDecisionHint: string;
  selectionTradeoff: string;
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type SpatialCandidateSelectionImpactDraft = {
  id: string;
  label: string;
  draftType: "position_rule" | "construction_rule";
  draftText: string;
  sourceEvidence: string;
  willBeEnabled: false;
  teacherReviewRequired: true;
  conflictBoundary: string;
};

export type SpatialCandidateSelectionImpactStep = {
  id: string;
  order: number;
  label: string;
  predictedAction: string;
  whyThisStep: string;
  teacherCorrectionSlot: string;
  nextStepPrediction: string;
  reviewState: "awaiting_teacher_review";
  passed: boolean;
};

export type SpatialCandidateImpactCorrectionDecision =
  | "tighten_rule_scope"
  | "split_candidate_intent"
  | "mark_prior_conflict";

export type SpatialCandidateImpactSecondRoundCandidate = {
  id: string;
  label: string;
  sourceCandidateId: string;
  sourceDecision: SpatialCandidateImpactCorrectionDecision;
  teacherCorrection: string;
  revisedSelectionSummary: string;
  regeneratedRuleDrafts: SpatialCandidateSelectionImpactDraft[];
  regeneratedConflictBoundaries: string[];
  whyThisRevision: string;
  teacherCorrectionSlot: string;
  nextStepPrediction: string;
  reviewState: "local_preview_waiting_teacher_selection";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type SpatialCandidateImpactSecondRoundSelectionTraceStep = {
  id: string;
  order: number;
  label: string;
  visibleInput: string;
  publicReason: string;
  validation: string;
  confidence: number;
  teacherReviewPoint: string;
  passed: boolean;
};

export type SpatialCandidateImpactSecondRoundSelectionPreview = {
  id: string;
  selectedSecondRoundCandidateId: string;
  selectedDecision: SpatialCandidateImpactCorrectionDecision;
  followUpPlanSteps: string[];
  publicTraceSteps: SpatialCandidateImpactSecondRoundSelectionTraceStep[];
  evidencePath: string;
  verifierCommand: "npm.cmd run verify:learning";
  noOpActions: string[];
  blockedActions: string[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type SpatialCandidateImpactCorrectionRehearsal = {
  sourceCandidateId: string;
  seedTeacherCorrection: string;
  preferredDecision: SpatialCandidateImpactCorrectionDecision;
  secondRoundCandidates: SpatialCandidateImpactSecondRoundCandidate[];
  teacherQuestion: string;
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type SpatialCandidateSelectionImpactPreview = {
  candidateId: string;
  candidateLabel: string;
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  selectionSummary: string;
  disabledRuleDrafts: SpatialCandidateSelectionImpactDraft[];
  conflictBoundaries: string[];
  predictedSteps: SpatialCandidateSelectionImpactStep[];
  correctionRehearsal: SpatialCandidateImpactCorrectionRehearsal;
  selectedSecondRoundPreview: SpatialCandidateImpactSecondRoundSelectionPreview;
  memoryImpact: {
    mode: "disabled_rule_draft_preview";
    wouldCreateMemory: true;
    apiPath: "/api/spatial-teaching-memories";
    autoApplies: false;
    requiresTeacherConfirmation: true;
  };
  teacherQuestion: string;
  blockedActions: string[];
  passed: boolean;
};

export type SpatialRuleExtraction = {
  id: string;
  label: string;
  rule: string;
  sourceCandidateIds: string[];
  passed: boolean;
  evidence: string;
};

export type SpatialTeachingRehearsal = {
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

export type SpatialGuidedGenerationStep = {
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

export type SpatialCoordinateDialogueCommand =
  | {
      command: "add_point";
      point: SpatialPoint3D | [number, number, number];
      note?: string;
    }
  | {
      command: "fit_candidates";
      targetStrokeId: string;
      note?: string;
    }
  | {
      command: "select_candidate";
      candidateId: string;
      why?: string;
    }
  | {
      command: "ask_next";
      question: string;
    };

export type SpatialCoordinateDialogueTurn = {
  id: string;
  order: number;
  teacherCode: string;
  aiInterpretation: string;
  coordinateEffect: string;
  candidateImpact: string;
  whyThisStep: string;
  teacherCorrectionSlot: string;
  nextStepPrediction: string;
  reviewState: "awaiting_teacher_review";
  passed: boolean;
  evidence: string;
};

export type SpatialCoordinateDialoguePreview = {
  status: "ready_for_teacher_review" | "needs_teacher_fix";
  inputMode: "coordinate_dialogue_code";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  commands: SpatialCoordinateDialogueCommand[];
  turns: SpatialCoordinateDialogueTurn[];
  selectedCandidateId: string | null;
  teacherQuestion: string;
  error?: string;
  allowedActions: string[];
  blockedActions: string[];
};

export type SpatialConstructionPredictionStep = {
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

export type SpatialConstructionPredictionPlan = {
  id: string;
  selectedCandidateId: string;
  label: string;
  anchorPoints: SpatialPoint3D[];
  offsetVector: SpatialPoint3D;
  constructionSteps: SpatialConstructionPredictionStep[];
  teacherQuestion: string;
  memoryPolicy: "preview_only_requires_teacher_confirmation";
  accepted: false;
  packagingGated: true;
  passed: boolean;
  evidence: string;
};

export type SpatialBatchPatternSample = {
  id: string;
  label: string;
  source: "teacher_code_batch";
  startPoint: SpatialPoint3D;
  endPoint: SpatialPoint3D;
  yOffset: number;
  zOffset: number;
  spanLength: number;
  residualToConsensus: number;
  passed: boolean;
  evidence: string;
};

export type SpatialPositionParameterLearningRow = {
  id: string;
  label: string;
  sourceField: "start_y" | "end_y" | "start_z" | "end_z" | "span_length";
  meanValue: number;
  minValue: number;
  maxValue: number;
  range: number;
  standardDeviation: number;
  teacherTolerance: number;
  stability: "stable" | "needs_teacher_review" | "variable";
  inference: string;
  teacherQuestion: string;
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type SpatialPositionParameterLearningReport = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  sourceSampleCount: number;
  learnedModel: "sample_mean_variation_envelope";
  anchorMean: {
    startPoint: SpatialPoint3D;
    endPoint: SpatialPoint3D;
  };
  directionModel: {
    meanDirection: SpatialPoint3D;
    maxAngularDriftDeg: number;
    stability: "stable" | "needs_teacher_review";
    teacherQuestion: string;
  };
  parameterRows: SpatialPositionParameterLearningRow[];
  toleranceRecommendation: {
    yTolerance: number;
    zTolerance: number;
    spanTolerance: number;
    rationale: string;
    teacherQuestion: string;
  };
  outlierPolicy: {
    outlierCount: number;
    maxResidual: number;
    ruleDraft: string;
    teacherQuestion: string;
  };
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type SpatialSurfacePatchBatchSample = {
  id: string;
  label: string;
  sourceSampleId: string;
  xSlope: number;
  zSlope: number;
  meanHeightResidual: number;
  maxHeightResidual: number;
  stability: "stable" | "needs_teacher_review";
  teacherQuestion: string;
  passed: boolean;
};

export type SpatialSurfacePatchStabilityReport = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  sourceSampleCount: number;
  learnedModel: "surface_patch_gradient_residual_consensus";
  samples: SpatialSurfacePatchBatchSample[];
  gradientConsensus: {
    meanXSlope: number;
    meanZSlope: number;
    xSlopeRange: number;
    zSlopeRange: number;
    stability: "stable" | "needs_teacher_review";
    teacherQuestion: string;
  };
  residualEnvelope: {
    meanHeightResidual: number;
    maxHeightResidual: number;
    residualRange: number;
    stableSampleCount: number;
    teacherTolerance: number;
  };
  outlierPolicy: {
    outlierCount: number;
    ruleDraft: string;
    teacherQuestion: string;
  };
  teacherSelectionReplay: SpatialSurfacePatchTeacherSelectionReplay;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type SpatialSurfacePatchTeacherSelectionReplayOption = {
  id: string;
  label: string;
  teacherSelection: "use_stable_consensus" | "tighten_residual_tolerance" | "isolate_outliers";
  selectedSampleIds: string[];
  disabledRuleDrafts: Array<{
    id: string;
    title: string;
    condition: string;
    action: string;
    willBeEnabled: false;
    teacherQuestion: string;
  }>;
  oldKnowledgeConflictBoundaries: string[];
  nextStepPrediction: string;
  teacherCorrectionPoint: string;
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type SpatialSurfacePatchTeacherSelectionReplay = {
  mode: "surface_patch_teacher_selection_replay";
  options: SpatialSurfacePatchTeacherSelectionReplayOption[];
  teacherQuestion: string;
  memoryPolicy: {
    mode: "disabled_rule_draft_preview";
    autoApplies: false;
    requiresTeacherConfirmation: true;
  };
  allowedActions: string[];
  blockedActions: string[];
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type SpatialBatchPatternRuleCandidate = {
  id: string;
  label: string;
  ruleDraft: string;
  stableAnchorPoints: SpatialPoint3D[];
  variationRange: {
    y: number;
    z: number;
    span: number;
  };
  confidence: number;
  teacherQuestion: string;
  nextStepPrediction: string;
  reviewState: "awaiting_teacher_review";
  passed: boolean;
};

export type SpatialBatchPatternLearning = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  sampleCount: number;
  consensusModel: string;
  stableAnchorPoints: SpatialPoint3D[];
  variationSummary: string;
  samples: SpatialBatchPatternSample[];
  positionParameterLearningReport: SpatialPositionParameterLearningReport;
  surfacePatchStabilityReport: SpatialSurfacePatchStabilityReport;
  ruleCandidates: SpatialBatchPatternRuleCandidate[];
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
};

export type CodeFirstSpatialTeachingModel = {
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
    origin: SpatialPoint3D;
  };
  rawStroke: SpatialPoint3D[];
  sampleCount: number;
  candidates: SpatialFitCandidate[];
  extractedRules: SpatialRuleExtraction[];
  teachingRehearsals: SpatialTeachingRehearsal[];
  coordinateDialogue: SpatialCoordinateDialoguePreview;
  guidedGenerationSteps: SpatialGuidedGenerationStep[];
  constructionPredictionPlans: SpatialConstructionPredictionPlan[];
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

export type SpatialTeachingMemoryDraft = {
  rule: RuleRecord;
  learningTrace: LearningExtractionStep[];
  conflictReport: SpatialMemoryConflictReport;
  memoryState: "paused_for_teacher_confirmation";
  accepted: false;
  packagingGated: true;
};

export type SpatialTeachingMemoryDraftFromCodeResult =
  | {
      ok: true;
      model: CodeFirstSpatialTeachingModel;
      candidate: SpatialFitCandidate;
      rehearsal: SpatialTeachingRehearsal;
      draft: SpatialTeachingMemoryDraft;
      evidence: string;
      accepted: false;
      packagingGated: true;
    }
  | {
      ok: false;
      error: string;
      evidence: string;
      accepted: false;
      packagingGated: true;
    };

export type SpatialMemoryConflictReport = {
  status: "no_prior_memory" | "compatible_with_prior_memory" | "conflict_requires_teacher";
  comparedRuleIds: string[];
  comparison: string;
  teacherQuestion: string;
  passed: boolean;
  evidence: string;
};

export type SpatialMemoryTeacherReviewDecision =
  | "keep_paused"
  | "add_applicability_condition"
  | "mark_conflict_reason";

export type SpatialCodePatchMatchReviewDecision =
  | "use_as_reference"
  | "different_scene"
  | "tighten_applicability";

export type SpatialConstructionCorrectionDecision =
  | "revise_anchor_points"
  | "revise_construction_order"
  | "mark_prediction_conflict";

export type SpatialConstructionRevisionCandidate = {
  id: string;
  label: string;
  sourcePlanId: string;
  sourceDecision: SpatialConstructionCorrectionDecision;
  revisedAnchorPoints: SpatialPoint3D[];
  revisedOffsetVector: SpatialPoint3D;
  geometryPatch: string;
  whyThisRevision: string;
  validationCheck: string;
  teacherQuestion: string;
  nextStepPrediction: string;
  reviewState: "local_preview_waiting_teacher_selection";
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type SpatialConstructionRevisionPreviewStep = {
  id: string;
  order: number;
  label: string;
  generatedDraft: string;
  whyThisStep: string;
  teacherCorrectionSlot: string;
  nextStepPrediction: string;
  reviewState: "awaiting_teacher_review";
  passed: boolean;
};

export type SpatialConstructionRevisionCodePatch = {
  sourcePlanId: string;
  revisionCandidateId: string;
  anchorPoints: SpatialPoint3D[];
  offsetVector: SpatialPoint3D;
  geometryPatch: string;
  teacherReviewRequired: true;
  accepted: false;
  packagingGated: true;
};

export type SpatialConstructionCodePatchValidation =
  | {
      ok: true;
      patch: SpatialConstructionRevisionCodePatch;
      evidence: string;
      nextStepPrediction: string;
      accepted: false;
      packagingGated: true;
    }
  | {
      ok: false;
      error: string;
      evidence: string;
      nextStepPrediction: string;
      accepted: false;
      packagingGated: true;
    };

export type SpatialConstructionRevisionSelectionPreview = {
  id: string;
  selectedRevisionCandidateId: string;
  codePatch: SpatialConstructionRevisionCodePatch;
  codePatchJson: string;
  guidedSteps: SpatialConstructionRevisionPreviewStep[];
  teacherQuestion: string;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type SpatialMemoryTeacherReviewRecord = {
  id: string;
  errorType: "spatial_memory_review";
  userFeedback: string;
  extractedRule: RuleRecord;
  beforeOutput: {
    ruleId: string;
    previousEnabled: false;
    reviewState: "paused_for_teacher_confirmation";
  };
  afterOutput: {
    decision: SpatialMemoryTeacherReviewDecision;
    teacherNote: string;
    ruleEnabled: false;
    accepted: false;
    packagingGated: true;
  };
  learningTrace: LearningExtractionStep[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  createdAt: string;
};

export type SpatialCodePatchMatchReviewInput = {
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
};

export type SpatialCodePatchMatchReviewRecord = {
  id: string;
  errorType: "spatial_code_patch_match_review";
  userFeedback: string;
  extractedRule: RuleRecord;
  beforeOutput: {
    matchId: string;
    replayId: string;
    planId: string;
    selectedCandidateId: string;
    matchScore: number;
    conflictChecks: string[];
  };
  afterOutput: {
    decision: SpatialCodePatchMatchReviewDecision;
    teacherNote: string;
    ruleEnabled: false;
    accepted: false;
    packagingGated: true;
  };
  learningTrace: LearningExtractionStep[];
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  createdAt: string;
};

export type SpatialConstructionCorrectionDraft = {
  rule: RuleRecord;
  correctionRecord: {
    id: string;
    errorType: "spatial_construction_correction";
    userFeedback: string;
    extractedRule: RuleRecord;
    beforeOutput: {
      planId: string;
      selectedCandidateId: string;
      anchorPoints: SpatialPoint3D[];
      constructionStepIds: string[];
      comparedRuleIds: string[];
      conflictStatus: SpatialMemoryConflictReport["status"];
    };
    afterOutput: {
      decision: SpatialConstructionCorrectionDecision;
      revisionCandidateIds: string[];
      selectedCodePatch?: SpatialConstructionRevisionCodePatch;
      codePatchEvidence?: string;
      codePatchNextStepPrediction?: string;
      ruleEnabled: false;
      accepted: false;
      packagingGated: true;
    };
    learningTrace: LearningExtractionStep[];
    createdAt: string;
  };
  revisionCandidates: SpatialConstructionRevisionCandidate[];
  conflictReport: SpatialMemoryConflictReport;
  memoryState: "paused_for_teacher_confirmation";
  accepted: false;
  packagingGated: true;
};

const protocol = {
  format: "json_dsl" as const,
  schema:
    "{ frame: { unit, axes, origin }, strokes: [{ id, points: [{ x, y, z }], tolerance }], constraints: [{ type, target, value }], expectedRules: string[] }",
  imageUse: "optional_reference_only" as const,
  tokenSavingRationale:
    "坐标、约束、容差和意图规则都从结构化代码数据里学习，AI 不需要每次重新识别图片。"
};

export const defaultSpatialTeachingInput: SpatialTeachingInput = {
  frame: {
    unit: "meter",
    axes: ["x", "y", "z"],
    origin: { x: 0, y: 0, z: 0 }
  },
  strokes: [
    {
      id: "teacher-line-a",
      tolerance: 0.08,
      points: [
        { x: 0.08, y: 0.02, z: 0.31 },
        { x: 0.32, y: -0.01, z: 0.35 },
        { x: 0.56, y: 0.03, z: 0.34 },
        { x: 0.81, y: -0.02, z: 0.37 },
        { x: 1.05, y: 0.01, z: 0.36 },
        { x: 1.28, y: 0.02, z: 0.39 }
      ]
    }
  ],
  constraints: [
    { type: "freehand_intent", target: "teacher-line-a", value: "preserve endpoint span" },
    { type: "axis_snap", target: "teacher-line-a", value: "x" },
    { type: "polyline_candidate", target: "teacher-line-a", value: "allow one bend if residual improves" }
  ],
  expectedRules: [
    "preserve endpoint span",
    "average noisy y/z offsets",
    "offer multiple selectable fits before learning a durable rule"
  ],
  sampleCount: 18
};

export function spatialTeachingExampleJson() {
  return JSON.stringify(defaultSpatialTeachingInput, null, 2);
}

export function spatialTeachingPresetJson(preset: "straight" | "axis" | "bend") {
  const base = structuredClone(defaultSpatialTeachingInput);

  if (preset === "axis") {
    base.strokes[0] = {
      id: "teacher-axis-rail",
      tolerance: 0.06,
      points: [
        [0.05, 0.11, 0.42],
        [0.28, 0.1, 0.41],
        [0.52, 0.12, 0.43],
        [0.78, 0.09, 0.42],
        [1.02, 0.1, 0.41],
        [1.26, 0.11, 0.43]
      ]
    };
    base.constraints = [
      { type: "axis_snap", target: "teacher-axis-rail", value: "x" },
      { type: "freehand_intent", target: "teacher-axis-rail", value: "human wants a stable rail" }
    ];
    base.expectedRules = [
      "如果点列主要沿 x 轴延伸，优先生成轴向轨道候选。",
      "把 y/z 的手抖噪声拟合成稳定偏移，而不是逐点照抄。",
      "人类确认前不得把候选写入长期规则。"
    ];
  }

  if (preset === "bend") {
    base.strokes[0] = {
      id: "teacher-bend-guide",
      tolerance: 0.09,
      points: [
        [0.08, 0.02, 0.28],
        [0.32, 0.03, 0.3],
        [0.52, 0.04, 0.33],
        [0.67, 0.12, 0.43],
        [0.85, 0.23, 0.52],
        [1.08, 0.33, 0.59]
      ]
    };
    base.constraints = [
      { type: "polyline_candidate", target: "teacher-bend-guide", value: "one bend near middle" },
      { type: "freehand_intent", target: "teacher-bend-guide", value: "preserve visible direction change" }
    ];
    base.expectedRules = [
      "如果中段方向变化明显，必须给出折线候选供人类选择。",
      "折点位置要由残差和人类意图共同决定。",
      "下一步先展示约束验证，再继续生成后续几何。"
    ];
  }

  return JSON.stringify(base, null, 2);
}

export function defaultSpatialCoordinateDialogueJson(candidateId = "fit-freehand-intent-line") {
  return JSON.stringify(
    {
      commands: [
        {
          command: "add_point",
          point: [0.56, 0.03, 0.34],
          note: "老师补一个三维采样点，表达线条中段略微上抬。"
        },
        {
          command: "fit_candidates",
          targetStrokeId: "teacher-line-a",
          note: "请 AI 同时给出最小二乘、轴向吸附、折线三种候选。"
        },
        {
          command: "select_candidate",
          candidateId,
          why: "先按当前最像老师意图的候选继续预演，不写入长期记忆。"
        },
        {
          command: "ask_next",
          question: "如果老师说这条线应该贴着 x 轴走，下一步你会怎么改？"
        }
      ]
    },
    null,
    2
  );
}

function normalizePoint(point: SpatialPoint3D | [number, number, number]): SpatialPoint3D {
  if (Array.isArray(point)) {
    return { x: Number(point[0]), y: Number(point[1]), z: Number(point[2]) };
  }

  return { x: Number(point.x), y: Number(point.y), z: Number(point.z) };
}

function isFinitePoint(point: SpatialPoint3D) {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
}

export function parseSpatialTeachingInput(raw: string):
  | { ok: true; value: SpatialTeachingInput }
  | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as SpatialTeachingInput;
    const stroke = parsed.strokes?.[0];
    const points = stroke?.points?.map(normalizePoint) ?? [];

    if (parsed.frame?.unit !== "meter") {
      return { ok: false, error: "当前工程带教模型要求 frame.unit 为 meter。" };
    }

    if (parsed.frame.axes?.join(",") !== "x,y,z") {
      return { ok: false, error: "frame.axes 必须是 [\"x\", \"y\", \"z\"]。" };
    }

    if (!stroke?.id || points.length < 2 || points.some((point) => !isFinitePoint(point))) {
      return { ok: false, error: "strokes[0] 必须包含 id，并至少提供两个有效三维点。" };
    }

    return {
      ok: true,
      value: {
        ...parsed,
        frame: {
          unit: "meter",
          axes: ["x", "y", "z"],
          origin: normalizePoint(parsed.frame.origin)
        },
        strokes: [
          {
            ...stroke,
            tolerance: Number.isFinite(stroke.tolerance) ? Number(stroke.tolerance) : 0.08,
            points
          },
          ...(parsed.strokes ?? []).slice(1)
        ],
        constraints: parsed.constraints ?? [],
        expectedRules: parsed.expectedRules ?? []
      }
    };
  } catch {
    return { ok: false, error: "带教输入必须是有效 JSON。" };
  }
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));

  return Math.sqrt(variance);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function residual(values: number[]) {
  return round(average(values));
}

function formatPoint(point: SpatialPoint3D) {
  return `(${round(point.x)}, ${round(point.y)}, ${round(point.z)})`;
}

function subtractPoints(a: SpatialPoint3D, b: SpatialPoint3D): SpatialPoint3D {
  return {
    x: round(a.x - b.x),
    y: round(a.y - b.y),
    z: round(a.z - b.z)
  };
}

function addPoints(a: SpatialPoint3D, b: SpatialPoint3D): SpatialPoint3D {
  return {
    x: round(a.x + b.x),
    y: round(a.y + b.y),
    z: round(a.z + b.z)
  };
}

function scalePoint(point: SpatialPoint3D, factor: number): SpatialPoint3D {
  return {
    x: round(point.x * factor),
    y: round(point.y * factor),
    z: round(point.z * factor)
  };
}

function mixPoints(a: SpatialPoint3D, b: SpatialPoint3D, weightB = 0.5): SpatialPoint3D {
  return addPoints(scalePoint(a, 1 - weightB), scalePoint(b, weightB));
}

function confidenceFromResidual(value: number, tolerance: number) {
  return round(Math.max(0.5, 1 - value / Math.max(tolerance * 2.5, 0.001)));
}

function vectorLength(point: SpatialPoint3D) {
  return Math.hypot(point.x, point.y, point.z);
}

function normalizeVector(point: SpatialPoint3D, fallback: SpatialPoint3D): SpatialPoint3D {
  const length = vectorLength(point);

  if (length < 0.000001) {
    return fallback;
  }

  return {
    x: point.x / length,
    y: point.y / length,
    z: point.z / length
  };
}

function vectorAngleDeg(a: SpatialPoint3D, b: SpatialPoint3D) {
  const normalizedA = normalizeVector(a, { x: 1, y: 0, z: 0 });
  const normalizedB = normalizeVector(b, { x: 1, y: 0, z: 0 });
  const dot = Math.max(
    -1,
    Math.min(1, normalizedA.x * normalizedB.x + normalizedA.y * normalizedB.y + normalizedA.z * normalizedB.z)
  );

  return round((Math.acos(dot) * 180) / Math.PI);
}

function normalizeAngleRad(angle: number) {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

function shortestSweepDeg(startAngle: number, endAngle: number) {
  const raw = ((endAngle - startAngle) * 180) / Math.PI;
  const normalized = ((raw + 540) % 360) - 180;
  return round(Math.abs(normalized));
}

function circleFromThreeXZPoints(start: SpatialPoint3D, mid: SpatialPoint3D, end: SpatialPoint3D) {
  const x1 = start.x;
  const y1 = start.z;
  const x2 = mid.x;
  const y2 = mid.z;
  const x3 = end.x;
  const y3 = end.z;
  const determinant = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

  if (Math.abs(determinant) < 0.000001) {
    return null;
  }

  const ux =
    ((x1 * x1 + y1 * y1) * (y2 - y3) +
      (x2 * x2 + y2 * y2) * (y3 - y1) +
      (x3 * x3 + y3 * y3) * (y1 - y2)) /
    determinant;
  const uz =
    ((x1 * x1 + y1 * y1) * (x3 - x2) +
      (x2 * x2 + y2 * y2) * (x1 - x3) +
      (x3 * x3 + y3 * y3) * (x2 - x1)) /
    determinant;
  const radius = Math.hypot(x1 - ux, y1 - uz);

  if (!Number.isFinite(radius) || radius < 0.000001) {
    return null;
  }

  return { centerX: ux, centerZ: uz, radius };
}

function angleForXZPoint(point: SpatialPoint3D, centerX: number, centerZ: number) {
  return Math.atan2(point.z - centerZ, point.x - centerX);
}

function nearestPointOnXZCircle(point: SpatialPoint3D, center: SpatialPoint3D, radius: number, yLevel: number) {
  const radialX = point.x - center.x;
  const radialZ = point.z - center.z;
  const radialLength = Math.hypot(radialX, radialZ) || 1;

  return {
    x: round(center.x + (radialX / radialLength) * radius),
    y: yLevel,
    z: round(center.z + (radialZ / radialLength) * radius)
  };
}

function sampleXZArc(args: {
  center: SpatialPoint3D;
  radius: number;
  startAngle: number;
  endAngle: number;
  yLevel: number;
  count?: number;
}) {
  const count = args.count ?? 7;
  let sweep = normalizeAngleRad(args.endAngle) - normalizeAngleRad(args.startAngle);
  if (sweep > Math.PI) sweep -= Math.PI * 2;
  if (sweep < -Math.PI) sweep += Math.PI * 2;

  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    const angle = args.startAngle + sweep * ratio;
    return {
      x: round(args.center.x + Math.cos(angle) * args.radius),
      y: args.yLevel,
      z: round(args.center.z + Math.sin(angle) * args.radius)
    };
  });
}

function cubicBezierPoint(
  start: SpatialPoint3D,
  handleA: SpatialPoint3D,
  handleB: SpatialPoint3D,
  end: SpatialPoint3D,
  t: number
) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: round(uuu * start.x + 3 * uu * t * handleA.x + 3 * u * tt * handleB.x + ttt * end.x),
    y: round(uuu * start.y + 3 * uu * t * handleA.y + 3 * u * tt * handleB.y + ttt * end.y),
    z: round(uuu * start.z + 3 * uu * t * handleA.z + 3 * u * tt * handleB.z + ttt * end.z)
  };
}

function sampleCubicBezier(
  start: SpatialPoint3D,
  handleA: SpatialPoint3D,
  handleB: SpatialPoint3D,
  end: SpatialPoint3D,
  count = 9
) {
  return Array.from({ length: count }, (_, index) =>
    cubicBezierPoint(start, handleA, handleB, end, count === 1 ? 0 : index / (count - 1))
  );
}

function interpolatePoint(start: SpatialPoint3D, end: SpatialPoint3D, t: number): SpatialPoint3D {
  return {
    x: round(start.x + (end.x - start.x) * t),
    y: round(start.y + (end.y - start.y) * t),
    z: round(start.z + (end.z - start.z) * t)
  };
}

function sampleMultiSegmentBezierSpline(knots: SpatialPoint3D[]) {
  const segments = knots.slice(0, -1).map((segmentStart, index) => {
    const segmentEnd = knots[index + 1];
    const handleA = interpolatePoint(segmentStart, segmentEnd, 1 / 3);
    const handleB = interpolatePoint(segmentStart, segmentEnd, 2 / 3);

    return sampleCubicBezier(segmentStart, handleA, handleB, segmentEnd, 6);
  });

  return segments.flatMap((segment, index) => (index === 0 ? segment : segment.slice(1)));
}

function nearestPointOnSegment(point: SpatialPoint3D, segmentStart: SpatialPoint3D, segmentEnd: SpatialPoint3D) {
  const vx = segmentEnd.x - segmentStart.x;
  const vy = segmentEnd.y - segmentStart.y;
  const vz = segmentEnd.z - segmentStart.z;
  const lenSq = vx * vx + vy * vy + vz * vz || 1;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segmentStart.x) * vx + (point.y - segmentStart.y) * vy + (point.z - segmentStart.z) * vz) / lenSq
    )
  );
  const nearest = {
    x: round(segmentStart.x + vx * t),
    y: round(segmentStart.y + vy * t),
    z: round(segmentStart.z + vz * t)
  };

  return {
    point: nearest,
    distance: Math.hypot(point.x - nearest.x, point.y - nearest.y, point.z - nearest.z)
  };
}

function nearestPointOnPolyline(point: SpatialPoint3D, polyline: SpatialPoint3D[]) {
  if (polyline.length < 2) {
    return { point: polyline[0] ?? point, distance: 0 };
  }

  return polyline.slice(0, -1).reduce(
    (best, segmentStart, index) => {
      const option = nearestPointOnSegment(point, segmentStart, polyline[index + 1]);
      return option.distance < best.distance ? option : best;
    },
    { point: polyline[0], distance: Number.POSITIVE_INFINITY }
  );
}

function buildSpatialSurfacePatchTeachingLens(args: {
  rawStroke: SpatialPoint3D[];
  meanPoint: SpatialPoint3D;
  tolerance: number;
}): SpatialSurfacePatchTeachingLens {
  const { rawStroke, meanPoint, tolerance } = args;
  const safePointCount = Math.max(rawStroke.length, 1);
  const xVariance = rawStroke.reduce((sum, point) => sum + (point.x - meanPoint.x) ** 2, 0);
  const zVariance = rawStroke.reduce((sum, point) => sum + (point.z - meanPoint.z) ** 2, 0);
  const xSlope =
    xVariance > 0
      ? rawStroke.reduce((sum, point) => sum + (point.x - meanPoint.x) * (point.y - meanPoint.y), 0) / xVariance
      : 0;
  const zSlope =
    zVariance > 0
      ? rawStroke.reduce((sum, point) => sum + (point.z - meanPoint.z) * (point.y - meanPoint.y), 0) / zVariance
      : 0;
  const predictY = (point: Pick<SpatialPoint3D, "x" | "z">) =>
    round(meanPoint.y + xSlope * (point.x - meanPoint.x) + zSlope * (point.z - meanPoint.z));
  const minX = Math.min(...rawStroke.map((point) => point.x));
  const maxX = Math.max(...rawStroke.map((point) => point.x));
  const minZ = Math.min(...rawStroke.map((point) => point.z));
  const maxZ = Math.max(...rawStroke.map((point) => point.z));
  const patchCorners = [
    { x: round(minX), z: round(minZ) },
    { x: round(maxX), z: round(minZ) },
    { x: round(maxX), z: round(maxZ) },
    { x: round(minX), z: round(maxZ) }
  ].map((point) => ({ x: point.x, y: predictY(point), z: point.z }));
  const vectors = rawStroke.map((rawPoint) => {
    const projectedPatchPoint = {
      x: round(rawPoint.x),
      y: predictY(rawPoint),
      z: round(rawPoint.z)
    };
    const heightResidual = round(Math.abs(rawPoint.y - projectedPatchPoint.y));

    return {
      rawPoint: { x: round(rawPoint.x), y: round(rawPoint.y), z: round(rawPoint.z) },
      projectedPatchPoint,
      heightResidual,
      exceedsTolerance: heightResidual > tolerance
    };
  });
  const residuals = vectors.map((vector) => vector.heightResidual);
  const maxHeightResidual = round(Math.max(...residuals));
  const meanHeightResidual = round(residuals.reduce((sum, value) => sum + value, 0) / safePointCount);
  const xSlopeRounded = round(xSlope);
  const zSlopeRounded = round(zSlope);

  return {
    id: "surface-patch-height-field-lens",
    label: "曲面 patch 教学放大镜",
    fitModel: "local_xz_height_patch",
    equation: `y=${round(meanPoint.y)} + ${xSlopeRounded}(x-${round(meanPoint.x)}) + ${zSlopeRounded}(z-${round(meanPoint.z)})`,
    patchCenter: { x: round(meanPoint.x), y: round(meanPoint.y), z: round(meanPoint.z) },
    gradient: {
      xSlope: xSlopeRounded,
      zSlope: zSlopeRounded
    },
    patchCorners,
    vectors,
    meanHeightResidual,
    maxHeightResidual,
    exceedCount: vectors.filter((vector) => vector.exceedsTolerance).length,
    teacherQuestion:
      "老师，如果这组点其实是在教一个局部曲面或高度面，我应该按这个 patch 的 y 高度变化继续请教，还是回到线/弧/样条候选？",
    nextStepPrediction:
      "下一步预测：我只会把曲面 patch 当作审查放大镜展示，不会自动保存为规则；如果老师确认，我再生成 disabled 的曲面适用条件草稿。",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    passed: rawStroke.length >= 3 && patchCorners.length === 4 && vectors.length === rawStroke.length
  };
}

function spatialCandidateComplexity(model: SpatialFitCandidate["model"]): SpatialFitCandidateComparison["complexity"] {
  if (model === "least_squares_line" || model === "axis_constrained_line") {
    return "low";
  }

  if (model === "two_segment_polyline" || model === "circular_arc") {
    return "medium";
  }

  return "high";
}

function spatialCandidateComplexityPenalty(model: SpatialFitCandidate["model"]) {
  const complexity = spatialCandidateComplexity(model);
  if (complexity === "low") return 0;
  if (complexity === "medium") return 0.035;
  return 0.07;
}

function spatialCandidateTeacherHint(candidate: SpatialFitCandidate) {
  if (candidate.model === "surface_patch") {
    return "如果老师想表达局部曲面、高度面或随 x/z 变化的 y 偏移，优先审查这个候选。";
  }

  if (candidate.model === "axis_constrained_line") {
    return "如果老师想表达稳定轴向或工程导轨，优先审查这个候选。";
  }

  if (candidate.model === "two_segment_polyline") {
    return "如果老师想表达明显转折或折点，优先审查这个候选。";
  }

  if (candidate.model === "circular_arc") {
    return "如果老师想表达规则圆弧或固定半径路径，优先审查这个候选。";
  }

  if (candidate.model === "bezier_spline") {
    return "如果老师想表达自由但连续的柔性导向线，优先审查这个候选。";
  }

  if (candidate.model === "multi_segment_bezier_spline") {
    return "如果老师想表达多段连续曲线、局部弯曲或多处控制点，优先审查这个候选。";
  }

  return "如果老师只想表达整体方向，不强调吸附、转折或曲率，优先审查这个候选。";
}

function spatialCandidateTradeoff(candidate: SpatialFitCandidate) {
  if (candidate.model === "surface_patch") {
    return "能表达局部高度面的变化，但适用边界最容易过宽；老师必须确认这是曲面意图而不是线条抖动。";
  }

  if (candidate.model === "multi_segment_bezier_spline") {
    return "能表达多段连续变化，但复杂度最高，老师必须确认每个 knot 点和适用边界。";
  }

  if (candidate.model === "bezier_spline") {
    return "最能贴合自由曲线，但复杂度最高，未来复用前必须补充适用条件。";
  }

  if (candidate.model === "circular_arc") {
    return "能表达平滑曲率，但会假设近似固定半径，老师需要确认是否过度约束。";
  }

  if (candidate.model === "two_segment_polyline") {
    return "能表达转折，但不适合连续曲线；如果老师意图是柔滑过渡，应改选曲线候选。";
  }

  if (candidate.model === "axis_constrained_line") {
    return "最稳定、最容易复用，但可能忽略老师故意画出的弯曲或折点。";
  }

  return "最简洁，但可能把局部弯曲平均掉；适合先确认整体方向。";
}

function reviseImpactDraft(
  draft: SpatialCandidateSelectionImpactDraft,
  suffix: string,
  conflictBoundary: string
): SpatialCandidateSelectionImpactDraft {
  return {
    ...draft,
    id: `${draft.id}-${suffix}`,
    draftText: `${draft.draftText} 二轮修正：${conflictBoundary}`,
    sourceEvidence: `${draft.sourceEvidence}；二轮再生仍只作为老师审查证据。`,
    willBeEnabled: false,
    teacherReviewRequired: true,
    conflictBoundary
  };
}

function buildSecondRoundImpactCandidate(args: {
  preview: Omit<SpatialCandidateSelectionImpactPreview, "correctionRehearsal" | "selectedSecondRoundPreview">;
  teacherCorrection: string;
  decision: SpatialCandidateImpactCorrectionDecision;
  label: string;
  suffix: string;
  revisedSelectionSummary: string;
  conflictBoundary: string;
  whyThisRevision: string;
  nextStepPrediction: string;
}): SpatialCandidateImpactSecondRoundCandidate {
  const regeneratedRuleDrafts = args.preview.disabledRuleDrafts.map((draft) =>
    reviseImpactDraft(draft, args.suffix, args.conflictBoundary)
  );
  const regeneratedConflictBoundaries = [
    args.conflictBoundary,
    ...args.preview.conflictBoundaries.slice(0, 3),
    "二轮再生仍保持 autoApplies=false；老师确认前不会写成启用规则。"
  ];

  return {
    id: `impact-second-${args.preview.candidateId}-${args.suffix}`,
    label: args.label,
    sourceCandidateId: args.preview.candidateId,
    sourceDecision: args.decision,
    teacherCorrection: args.teacherCorrection,
    revisedSelectionSummary: args.revisedSelectionSummary,
    regeneratedRuleDrafts,
    regeneratedConflictBoundaries,
    whyThisRevision: args.whyThisRevision,
    teacherCorrectionSlot: "老师可以继续改纠正文本、指定旧规则优先级，或要求 AI 回到候选矩阵重新排序。",
    nextStepPrediction: args.nextStepPrediction,
    reviewState: "local_preview_waiting_teacher_selection",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    passed:
      regeneratedRuleDrafts.length >= 2 &&
      regeneratedRuleDrafts.every((draft) => draft.willBeEnabled === false && draft.teacherReviewRequired) &&
      regeneratedConflictBoundaries.length >= 4
  };
}

export function buildSpatialCandidateImpactCorrectionRehearsal(args: {
  preview: Omit<SpatialCandidateSelectionImpactPreview, "correctionRehearsal" | "selectedSecondRoundPreview">;
  teacherCorrection?: string;
  preferredDecision?: SpatialCandidateImpactCorrectionDecision;
}): SpatialCandidateImpactCorrectionRehearsal {
  const teacherCorrection =
    args.teacherCorrection?.trim() ||
    "老师认为这个候选的适用条件太宽，先不要直接泛化，请重新生成更窄的规则和冲突边界。";
  const preferredDecision = args.preferredDecision ?? "tighten_rule_scope";
  const secondRoundCandidates = [
    buildSecondRoundImpactCandidate({
      preview: args.preview,
      teacherCorrection,
      decision: "tighten_rule_scope",
      label: "二轮候选：收窄适用条件",
      suffix: "tight-scope",
      revisedSelectionSummary: `根据老师纠正“${teacherCorrection}”，把 ${args.preview.candidateLabel} 限定到当前坐标系、候选 id、容差和老师备注。`,
      conflictBoundary: `仅当候选=${args.preview.candidateId}、坐标系不变、老师容差一致时才允许参考；否则先请教老师。`,
      whyThisRevision: "老师指出规则可能太宽时，AI 应先缩小适用条件，而不是删除知识或自动泛化。",
      nextStepPrediction: "下一步预测：如果老师选中，我会把窄条件写入 disabled 规则草稿，并在未来命中时先回放边界。"
    }),
    buildSecondRoundImpactCandidate({
      preview: args.preview,
      teacherCorrection,
      decision: "split_candidate_intent",
      label: "二轮候选：拆分候选意图",
      suffix: "split-intent",
      revisedSelectionSummary: `根据老师纠正“${teacherCorrection}”，把 ${args.preview.candidateLabel} 拆成位置意图和构造意图两条候选线索。`,
      conflictBoundary: "位置画法和后续构造不得混成一条规则；未来命中时要分别展示匹配理由。",
      whyThisRevision: "有些错误来自 AI 把“这条线怎么画”和“下一步怎么构造”混在一起，所以二轮先拆分意图。",
      nextStepPrediction: "下一步预测：如果老师选中，我会分别生成位置规则草稿和构造规则草稿，并分别等待老师确认。"
    }),
    buildSecondRoundImpactCandidate({
      preview: args.preview,
      teacherCorrection,
      decision: "mark_prior_conflict",
      label: "二轮候选：旧知识优先冲突",
      suffix: "prior-conflict",
      revisedSelectionSummary: `根据老师纠正“${teacherCorrection}”，把当前候选标记为可能与旧知识冲突，未来先问老师。`,
      conflictBoundary: "如果旧规则和当前候选的锚点、容差或构造顺序不一致，旧规则优先进入请教流程，新候选只能作为参考证据。",
      whyThisRevision: "人类已经教过的知识不能被新候选覆盖；冲突不清楚时，AI 应先承认不确定并请老师裁决。",
      nextStepPrediction: "下一步预测：如果老师选中，我会在命中相似场景时先列出新旧差异，再问老师哪条规则优先。"
    })
  ].sort((left, right) => {
    if (left.sourceDecision === preferredDecision && right.sourceDecision !== preferredDecision) {
      return -1;
    }

    if (right.sourceDecision === preferredDecision && left.sourceDecision !== preferredDecision) {
      return 1;
    }

    return 0;
  });

  return {
    sourceCandidateId: args.preview.candidateId,
    seedTeacherCorrection: teacherCorrection,
    preferredDecision,
    secondRoundCandidates,
    teacherQuestion: `老师，我根据你的纠正重新生成了 ${secondRoundCandidates.length} 个二轮走法。你希望我按哪一种继续收窄规则和冲突边界？`,
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    passed:
      secondRoundCandidates.length >= 3 &&
      secondRoundCandidates.every(
        (candidate) =>
          candidate.passed &&
          candidate.reviewOnly === true &&
          candidate.accepted === false &&
          candidate.packagingGated === true &&
          candidate.nextStepPrediction.includes("下一步预测")
      )
  };
}

export function buildSpatialCandidateImpactSecondRoundSelectionPreview(
  candidate: SpatialCandidateImpactSecondRoundCandidate
): SpatialCandidateImpactSecondRoundSelectionPreview {
  const followUpPlanSteps = [
    `Review ${candidate.sourceDecision} as the selected second-round correction route.`,
    `Inspect ${candidate.regeneratedRuleDrafts.length} disabled rule drafts before any memory write.`,
    `Replay ${candidate.regeneratedConflictBoundaries.length} conflict boundaries with the teacher.`,
    "Keep the route local until the teacher explicitly chooses a later save action."
  ];
  const noOpActions = ["No rule enablement", "No memory persistence", "No technology acceptance", "No packaging"];
  const blockedActions = ["Enable rule", "Persist correction", "Accept technology", "Package", "Release", "Wrap"];
  const publicTraceSteps: SpatialCandidateImpactSecondRoundSelectionTraceStep[] = [
    {
      id: `selection-trace-${candidate.id}-visible-input`,
      order: 1,
      label: "Read selected second-round route",
      visibleInput: `${candidate.id}; decision=${candidate.sourceDecision}`,
      publicReason: "The apprentice can only use the teacher-visible route id, decision, correction text, and regenerated drafts.",
      validation: `Route is reviewOnly=${candidate.reviewOnly}, accepted=${candidate.accepted}, packagingGated=${candidate.packagingGated}.`,
      confidence: 0.86,
      teacherReviewPoint: "Teacher checks whether this is the route they meant to continue reviewing.",
      passed: candidate.reviewOnly === true && candidate.accepted === false && candidate.packagingGated === true
    },
    {
      id: `selection-trace-${candidate.id}-draft-locks`,
      order: 2,
      label: "Check regenerated draft locks",
      visibleInput: `${candidate.regeneratedRuleDrafts.length} regenerated disabled rule drafts`,
      publicReason: "A selected route may create follow-up review material, but it must not enable any rule.",
      validation: candidate.regeneratedRuleDrafts.every((draft) => draft.willBeEnabled === false)
        ? "All regenerated drafts keep willBeEnabled=false."
        : "At least one regenerated draft would enable a rule.",
      confidence: 0.9,
      teacherReviewPoint: "Teacher reviews draft wording and applicability before any future save action.",
      passed: candidate.regeneratedRuleDrafts.every((draft) => draft.willBeEnabled === false)
    },
    {
      id: `selection-trace-${candidate.id}-conflict-boundaries`,
      order: 3,
      label: "Replay conflict boundaries",
      visibleInput: `${candidate.regeneratedConflictBoundaries.length} regenerated conflict boundaries`,
      publicReason: "The apprentice must show old-knowledge and scope boundaries before treating the route as reusable.",
      validation:
        candidate.regeneratedConflictBoundaries.length >= 4
          ? "Conflict boundary replay has enough rows for teacher review."
          : "Conflict boundary replay needs more rows.",
      confidence: 0.82,
      teacherReviewPoint: "Teacher decides whether the boundaries are narrow enough or need another correction.",
      passed: candidate.regeneratedConflictBoundaries.length >= 4
    },
    {
      id: `selection-trace-${candidate.id}-no-op-gate`,
      order: 4,
      label: "Assert no-op gate",
      visibleInput: "ruleEnabled=false; accepted=false; packagingGated=true",
      publicReason: "This follow-up plan is only a review surface and must not become acceptance, rule enablement, or packaging.",
      validation: "No-op actions and blocked actions explicitly preserve the teacher acceptance gate.",
      confidence: 0.94,
      teacherReviewPoint: "Teacher can continue reviewing without accidentally accepting technology.",
      passed: true
    }
  ];

  return {
    id: `selection-preview-${candidate.id}`,
    selectedSecondRoundCandidateId: candidate.id,
    selectedDecision: candidate.sourceDecision,
    followUpPlanSteps,
    publicTraceSteps,
    evidencePath:
      "spatialEngineeringTeachingModel.candidateSelectionImpactPreviews[].correctionRehearsal.secondRoundCandidates[]",
    verifierCommand: "npm.cmd run verify:learning",
    noOpActions,
    blockedActions,
    ruleEnabled: false,
    accepted: false,
    packagingGated: true,
    passed:
      candidate.passed &&
      candidate.reviewOnly === true &&
      candidate.accepted === false &&
      candidate.packagingGated === true &&
      candidate.regeneratedRuleDrafts.every((draft) => draft.willBeEnabled === false) &&
      followUpPlanSteps.length >= 4 &&
      publicTraceSteps.length >= 4 &&
      publicTraceSteps.every((step) => step.passed && step.validation.length > 0 && step.confidence > 0) &&
      noOpActions.includes("No packaging") &&
      blockedActions.includes("Accept technology")
  };
}

function range(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return round(Math.max(...values) - Math.min(...values));
}

function buildSpatialPositionParameterRow(args: {
  id: string;
  label: string;
  sourceField: SpatialPositionParameterLearningRow["sourceField"];
  values: number[];
  teacherTolerance: number;
}): SpatialPositionParameterLearningRow {
  const parameterRange = range(args.values);
  const stability =
    parameterRange <= args.teacherTolerance
      ? "stable"
      : parameterRange <= args.teacherTolerance * 2
        ? "needs_teacher_review"
        : "variable";

  return {
    id: args.id,
    label: args.label,
    sourceField: args.sourceField,
    meanValue: round(average(args.values)),
    minValue: round(Math.min(...args.values)),
    maxValue: round(Math.max(...args.values)),
    range: parameterRange,
    standardDeviation: round(standardDeviation(args.values)),
    teacherTolerance: round(args.teacherTolerance),
    stability,
    inference:
      stability === "stable"
        ? "这个位置参数在多次示教中很稳定，可以作为老师意图的候选锚定细节。"
        : stability === "needs_teacher_review"
          ? "这个位置参数接近容差边界，AI 只能提示老师审查，不能自动记成规则。"
          : "这个位置参数变化较大，可能混入了新场景或老师想表达的另一种画法。",
    teacherQuestion:
      stability === "stable"
        ? `老师，${args.label} 的波动是否可以视为你允许的手绘误差？`
        : `老师，${args.label} 的变化有点明显，我应该把它当误差、离群样本，还是新的画法类别？`,
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    passed: true
  };
}

function buildSpatialPositionParameterLearningReport(args: {
  samples: SpatialBatchPatternSample[];
  tolerance: number;
}): SpatialPositionParameterLearningReport {
  const startPoint = {
    x: round(average(args.samples.map((sample) => sample.startPoint.x))),
    y: round(average(args.samples.map((sample) => sample.startPoint.y))),
    z: round(average(args.samples.map((sample) => sample.startPoint.z)))
  };
  const endPoint = {
    x: round(average(args.samples.map((sample) => sample.endPoint.x))),
    y: round(average(args.samples.map((sample) => sample.endPoint.y))),
    z: round(average(args.samples.map((sample) => sample.endPoint.z)))
  };
  const sampleDirections = args.samples.map((sample) =>
    normalizeVector(subtractPoints(sample.endPoint, sample.startPoint), { x: 1, y: 0, z: 0 })
  );
  const meanDirection = normalizeVector(
    {
      x: average(sampleDirections.map((direction) => direction.x)),
      y: average(sampleDirections.map((direction) => direction.y)),
      z: average(sampleDirections.map((direction) => direction.z))
    },
    { x: 1, y: 0, z: 0 }
  );
  const maxAngularDriftDeg = round(
    Math.max(...sampleDirections.map((direction) => vectorAngleDeg(direction, meanDirection)), 0)
  );
  const yTolerance = Math.max(args.tolerance, 0.001);
  const zTolerance = Math.max(args.tolerance, 0.001);
  const spanTolerance = Math.max(args.tolerance * 2, 0.002);
  const parameterRows = [
    buildSpatialPositionParameterRow({
      id: "position-param-start-y",
      label: "起点 y 位置",
      sourceField: "start_y",
      values: args.samples.map((sample) => sample.startPoint.y),
      teacherTolerance: yTolerance
    }),
    buildSpatialPositionParameterRow({
      id: "position-param-end-y",
      label: "终点 y 位置",
      sourceField: "end_y",
      values: args.samples.map((sample) => sample.endPoint.y),
      teacherTolerance: yTolerance
    }),
    buildSpatialPositionParameterRow({
      id: "position-param-start-z",
      label: "起点 z 高度",
      sourceField: "start_z",
      values: args.samples.map((sample) => sample.startPoint.z),
      teacherTolerance: zTolerance
    }),
    buildSpatialPositionParameterRow({
      id: "position-param-end-z",
      label: "终点 z 高度",
      sourceField: "end_z",
      values: args.samples.map((sample) => sample.endPoint.z),
      teacherTolerance: zTolerance
    }),
    buildSpatialPositionParameterRow({
      id: "position-param-span",
      label: "起止跨度",
      sourceField: "span_length",
      values: args.samples.map((sample) => sample.spanLength),
      teacherTolerance: spanTolerance
    })
  ];
  const maxResidual = round(Math.max(...args.samples.map((sample) => sample.residualToConsensus), 0));
  const outlierCount = args.samples.filter((sample) => !sample.passed).length;
  const passed =
    args.samples.length >= 12 &&
    parameterRows.length >= 5 &&
    parameterRows.every((row) => row.reviewOnly && !row.accepted && row.packagingGated) &&
    maxAngularDriftDeg <= 12;

  return {
    status: passed ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    sourceSampleCount: args.samples.length,
    learnedModel: "sample_mean_variation_envelope",
    anchorMean: {
      startPoint,
      endPoint
    },
    directionModel: {
      meanDirection: {
        x: round(meanDirection.x),
        y: round(meanDirection.y),
        z: round(meanDirection.z)
      },
      maxAngularDriftDeg,
      stability: maxAngularDriftDeg <= 8 ? "stable" : "needs_teacher_review",
      teacherQuestion:
        maxAngularDriftDeg <= 8
          ? "老师，这批样本的方向变化很小，能不能把这个方向作为稳定画法候选？"
          : "老师，这批样本方向有一定摆动，我应该继续拆分样本，还是先按一个宽容差方向预演？"
    },
    parameterRows,
    toleranceRecommendation: {
      yTolerance: round(Math.max(yTolerance, standardDeviation(parameterRows.slice(0, 2).map((row) => row.range)))),
      zTolerance: round(Math.max(zTolerance, standardDeviation(parameterRows.slice(2, 4).map((row) => row.range)))),
      spanTolerance: round(spanTolerance),
      rationale: "推荐容差来自老师输入容差和批量样本波动包络，只用于下一轮预演；老师确认前不会写成启用规则。",
      teacherQuestion: "老师，这个 y/z/跨度容差是否贴近你真实允许的手绘误差？"
    },
    outlierPolicy: {
      outlierCount,
      maxResidual,
      ruleDraft: `如果新示教样本残差超过 ${round(args.tolerance * 1.5)}m，先标记为离群或新画法，不自动套用当前共识模型。`,
      teacherQuestion:
        outlierCount === 0
          ? "老师，目前没有明显离群样本。以后超出这个范围时，我是否应该先停下来请教你？"
          : `老师，有 ${outlierCount} 个样本接近或超过稳定范围，我应该把它们拆成新类别吗？`
    },
    teacherQuestion:
      "老师，我已经把多次示教拆成位置参数统计。均值、范围、标准差、方向漂移和离群策略是否符合你想教我的画法细节？",
    allowedActions: ["Inspect parameter statistics", "Adjust tolerance", "Split outlier samples"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    passed
  };
}

function buildSpatialSurfacePatchStabilityReport(args: {
  samples: SpatialBatchPatternSample[];
  tolerance: number;
}): SpatialSurfacePatchStabilityReport {
  const surfaceSamples: SpatialSurfacePatchBatchSample[] = args.samples.map((sample, index) => {
    const span = Math.max(sample.spanLength, 0.001);
    const xSlope = round((sample.endPoint.y - sample.startPoint.y) / span);
    const zSlope = round(sample.zOffset / span);
    const meanHeightResidual = round(Math.abs(sample.yOffset) * 0.42 + Math.abs(sample.zOffset) * 0.18);
    const maxHeightResidual = round(meanHeightResidual + Math.abs(((index % 5) - 2) * 0.004));
    const passed = maxHeightResidual <= args.tolerance;

    return {
      id: `surface-patch-batch-${index + 1}`,
      label: `曲面 patch 样本 ${index + 1}`,
      sourceSampleId: sample.id,
      xSlope,
      zSlope,
      meanHeightResidual,
      maxHeightResidual,
      stability: passed ? "stable" : "needs_teacher_review",
      teacherQuestion: passed
        ? "老师，这个样本的曲面梯度和高度残差在容差内，可以作为 surface patch 共识证据吗？"
        : "老师，这个样本的曲面高度残差偏高，要把它标成离群曲面示教还是新意图？",
      passed
    };
  });
  const xSlopes = surfaceSamples.map((sample) => sample.xSlope);
  const zSlopes = surfaceSamples.map((sample) => sample.zSlope);
  const meanResiduals = surfaceSamples.map((sample) => sample.meanHeightResidual);
  const maxResiduals = surfaceSamples.map((sample) => sample.maxHeightResidual);
  const xSlopeRange = range(xSlopes);
  const zSlopeRange = range(zSlopes);
  const residualRange = range(meanResiduals);
  const stableSampleCount = surfaceSamples.filter((sample) => sample.passed).length;
  const gradientStable = xSlopeRange <= args.tolerance && zSlopeRange <= args.tolerance;
  const status =
    gradientStable && stableSampleCount >= Math.ceil(surfaceSamples.length * 0.7)
      ? "ready_for_teacher_review"
      : "needs_more_evidence";
  const outlierCount = surfaceSamples.length - stableSampleCount;
  const stableSurfaceSamples = surfaceSamples.filter((sample) => sample.passed);
  const outlierSurfaceSamples = surfaceSamples.filter((sample) => !sample.passed);
  const teacherSelectionReplay: SpatialSurfacePatchTeacherSelectionReplay = {
    mode: "surface_patch_teacher_selection_replay",
    options: [
      {
        id: "surface-patch-replay-use-stable-consensus",
        label: "采用稳定曲面共识",
        teacherSelection: "use_stable_consensus",
        selectedSampleIds: stableSurfaceSamples.slice(0, 6).map((sample) => sample.id),
        disabledRuleDrafts: [
          {
            id: "disabled-surface-patch-gradient-rule",
            title: "曲面 patch 梯度共识待确认",
            condition: `当多组 surface patch 示教的 x/z 梯度范围分别不超过 ${xSlopeRange}m 和 ${zSlopeRange}m 时`,
            action: `先把局部高度面预演为 y=f(x,z) 曲面候选，平均高度残差参考 ${round(average(meanResiduals))}m。`,
            willBeEnabled: false,
            teacherQuestion: "老师，要把这组稳定梯度作为 disabled 曲面规则草稿继续审查吗？"
          },
          {
            id: "disabled-surface-patch-stable-sample-rule",
            title: "稳定曲面样本包络待确认",
            condition: `当新样本落入 ${stableSampleCount}/${surfaceSamples.length} 个稳定样本形成的高度残差包络内`,
            action: "先回放稳定样本证据，再请老师确认是否沿用这组曲面意图。",
            willBeEnabled: false,
            teacherQuestion: "老师，稳定样本包络是否能作为下一次曲面示教的参考边界？"
          }
        ],
        oldKnowledgeConflictBoundaries: [
          "如果旧规则要求直线或轴向导轨，surface patch 只能作为候选意图，不覆盖旧规则。",
          "如果老师选择的是局部高度面，不能把它泛化到整段结构或所有三维导轨。",
          "如果新样本高度残差超过老师容差，必须先回到离群保护。"
        ],
        nextStepPrediction:
          "下一步预测：我会把稳定梯度、残差包络和样本来源展示成 disabled 规则草稿，等待老师确认是否保存为待确认记忆。",
        teacherCorrectionPoint: "老师可以指出哪些稳定样本其实属于另一个曲面族，或要求把适用范围缩到局部 patch。",
        reviewOnly: true,
        accepted: false,
        packagingGated: true,
        passed: stableSurfaceSamples.length >= 3
      },
      {
        id: "surface-patch-replay-tighten-residual-tolerance",
        label: "收紧高度残差容差",
        teacherSelection: "tighten_residual_tolerance",
        selectedSampleIds: surfaceSamples
          .filter((sample) => sample.maxHeightResidual <= args.tolerance * 0.75)
          .slice(0, 6)
          .map((sample) => sample.id),
        disabledRuleDrafts: [
          {
            id: "disabled-surface-patch-tight-tolerance-rule",
            title: "曲面 patch 严格容差待确认",
            condition: `当老师要求更严格曲面学习时，高度残差需低于 ${round(args.tolerance * 0.75)}m`,
            action: "只把低残差样本纳入曲面共识，边界样本先进入老师复核队列。",
            willBeEnabled: false,
            teacherQuestion: "老师，要不要把曲面 patch 的学习容差收紧，避免过宽泛化？"
          }
        ],
        oldKnowledgeConflictBoundaries: [
          "收紧容差会减少可复用样本数量，不能自动删除原来的宽容差草稿。",
          "严格容差只影响曲面 patch 学习，不影响直线、圆弧或样条候选的审查。",
          "边界样本必须保留来源，不能静默丢弃。"
        ],
        nextStepPrediction:
          "下一步预测：我会用更严格容差重新筛选曲面样本，并把被排除样本列成老师复核项。",
        teacherCorrectionPoint: "老师可以直接改容差，或指定哪些边界样本虽然残差略高但仍属于同一曲面意图。",
        reviewOnly: true,
        accepted: false,
        packagingGated: true,
        passed: true
      },
      {
        id: "surface-patch-replay-isolate-outliers",
        label: "隔离离群曲面样本",
        teacherSelection: "isolate_outliers",
        selectedSampleIds: outlierSurfaceSamples.slice(0, 6).map((sample) => sample.id),
        disabledRuleDrafts: [
          {
            id: "disabled-surface-patch-outlier-rule",
            title: "曲面 patch 离群保护待确认",
            condition: `当曲面样本最大高度残差超过 ${args.tolerance}m，或梯度方向偏离当前共识时`,
            action: "先标记为离群曲面示教，不套用稳定曲面规则，并请老师判断是否是新曲面族。",
            willBeEnabled: false,
            teacherQuestion: "老师，这些离群曲面样本要隔离保护，还是作为新的曲面族继续建模？"
          }
        ],
        oldKnowledgeConflictBoundaries: [
          "离群保护不能被当作技术失败或验收结论，只是提示老师审查。",
          "离群样本不会删除稳定共识，也不会自动生成新规则。",
          "如果老师确认新曲面族，需要重新进入候选对比和二轮纠正流程。"
        ],
        nextStepPrediction:
          outlierSurfaceSamples.length > 0
            ? "下一步预测：我会把离群样本单独列出，并等待老师决定隔离、收紧容差或新建曲面族。"
            : "下一步预测：当前没有离群样本；如果老师仍担心泛化过宽，我会改走收紧容差预演。",
        teacherCorrectionPoint: "老师可以把某个离群样本改判为新意图，或者要求它回到稳定样本集合。",
        reviewOnly: true,
        accepted: false,
        packagingGated: true,
        passed: true
      }
    ],
    teacherQuestion:
      "老师，如果你选择其中一种曲面批量处理策略，我会先回放影响、规则草稿和冲突边界；这样预演是否足够让你判断下一步？",
    memoryPolicy: {
      mode: "disabled_rule_draft_preview",
      autoApplies: false,
      requiresTeacherConfirmation: true
    },
    allowedActions: ["Replay teacher selection", "Inspect disabled drafts", "Adjust surface tolerance"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    passed: true
  };

  return {
    status,
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    sourceSampleCount: surfaceSamples.length,
    learnedModel: "surface_patch_gradient_residual_consensus",
    samples: surfaceSamples,
    gradientConsensus: {
      meanXSlope: round(average(xSlopes)),
      meanZSlope: round(average(zSlopes)),
      xSlopeRange,
      zSlopeRange,
      stability: gradientStable ? "stable" : "needs_teacher_review",
      teacherQuestion:
        "老师，这批 surface patch 的 x/z 梯度范围是否足够稳定，可以继续作为局部曲面意图候选吗？"
    },
    residualEnvelope: {
      meanHeightResidual: round(average(meanResiduals)),
      maxHeightResidual: round(Math.max(...maxResiduals, 0)),
      residualRange,
      stableSampleCount,
      teacherTolerance: args.tolerance
    },
    outlierPolicy: {
      outlierCount,
      ruleDraft: `如果新的曲面示教高度残差超过 ${args.tolerance}m，先标记为 surface patch 离群样本，不自动套用曲面候选。`,
      teacherQuestion:
        "老师，超过高度残差容差的 surface patch 样本要被当作离群保护，还是应该生成新的曲面候选族？"
    },
    teacherSelectionReplay,
    teacherQuestion:
      "老师，我已经把多组示教拆成 surface patch 梯度和高度残差共识。这个曲面稳定性足够继续审查吗？",
    allowedActions: ["Inspect surface patch gradients", "Mark outlier samples", "Ask for more surface examples"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    passed: status === "ready_for_teacher_review" && surfaceSamples.length >= 3
  };
}

export function parseSpatialCoordinateDialogueCode(raw: string):
  | { ok: true; commands: SpatialCoordinateDialogueCommand[] }
  | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as { commands?: unknown } | unknown[];
    const commands = Array.isArray(parsed) ? parsed : Array.isArray(parsed.commands) ? parsed.commands : null;

    if (!commands || commands.length === 0) {
      return { ok: false, error: "坐标对话脚本必须包含 commands 数组。" };
    }

    const normalized = commands.map((command, index) => {
      const item = command as Partial<SpatialCoordinateDialogueCommand> & {
        point?: SpatialPoint3D | [number, number, number];
      };

      if (item.command === "add_point") {
        const point = item.point ? normalizePoint(item.point) : null;

        if (!point || !isFinitePoint(point)) {
          throw new Error(`第 ${index + 1} 条 add_point 命令必须包含有效三维 point。`);
        }

        return {
          command: "add_point" as const,
          point,
          note: typeof item.note === "string" ? item.note : undefined
        };
      }

      if (item.command === "fit_candidates") {
        if (typeof item.targetStrokeId !== "string" || item.targetStrokeId.trim().length === 0) {
          throw new Error(`第 ${index + 1} 条 fit_candidates 命令必须包含 targetStrokeId。`);
        }

        return {
          command: "fit_candidates" as const,
          targetStrokeId: item.targetStrokeId,
          note: typeof item.note === "string" ? item.note : undefined
        };
      }

      if (item.command === "select_candidate") {
        if (typeof item.candidateId !== "string" || item.candidateId.trim().length === 0) {
          throw new Error(`第 ${index + 1} 条 select_candidate 命令必须包含 candidateId。`);
        }

        return {
          command: "select_candidate" as const,
          candidateId: item.candidateId,
          why: typeof item.why === "string" ? item.why : undefined
        };
      }

      if (item.command === "ask_next") {
        if (typeof item.question !== "string" || item.question.trim().length < 4) {
          throw new Error(`第 ${index + 1} 条 ask_next 命令必须包含老师问题。`);
        }

        return {
          command: "ask_next" as const,
          question: item.question
        };
      }

      throw new Error(`第 ${index + 1} 条命令类型不支持。`);
    });

    return { ok: true, commands: normalized };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "坐标对话脚本必须是有效 JSON。" };
  }
}

export function buildSpatialCoordinateDialoguePreview(args: {
  rawCode: string;
  rawStroke: SpatialPoint3D[];
  candidates: SpatialFitCandidate[];
  selectedCandidateId?: string;
}): SpatialCoordinateDialoguePreview {
  const parsed = parseSpatialCoordinateDialogueCode(args.rawCode);
  const selectedCandidate =
    args.candidates.find((candidate) => candidate.id === args.selectedCandidateId) ?? args.candidates[0] ?? null;

  if (!parsed.ok) {
    return {
      status: "needs_teacher_fix",
      inputMode: "coordinate_dialogue_code",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      commands: [],
      turns: [],
      selectedCandidateId: selectedCandidate?.id ?? null,
      teacherQuestion: "老师，这段坐标对话脚本还不能解析，请先修正 JSON 命令，再让我继续预演。",
      error: parsed.error,
      allowedActions: ["修正坐标对话 JSON", "继续本地预演"],
      blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
    };
  }

  const turns: SpatialCoordinateDialogueTurn[] = parsed.commands.map((command, index) => {
    if (command.command === "add_point") {
      const point = normalizePoint(command.point);

      return {
        id: `coordinate-dialogue-${index + 1}-add-point`,
        order: index + 1,
        teacherCode: JSON.stringify(command),
        aiInterpretation: `我把老师输入理解为新增三维采样点 ${formatPoint(point)}，它表达的是老师在线条局部位置上的真实意图。`,
        coordinateEffect: `当前原始点列已有 ${args.rawStroke.length} 个点；这条命令会作为下一轮拟合的补充点，而不是图片识别结果。`,
        candidateImpact: "新增点会影响最小二乘残差、轴向吸附偏移和折线候选的中段位置。",
        whyThisStep: "先把老师的空间意图落成结构化点位，AI 才能用数学拟合总结画法细节，而不是猜图片。",
        teacherCorrectionSlot: "老师可以直接改 x/y/z 或补充 note，说明这个点是锚点、经过点还是只是参考点。",
        nextStepPrediction: "下一步预测：我会重新生成多个拟合候选，并把残差、置信度和适用边界列出来让老师选。",
        reviewState: "awaiting_teacher_review",
        passed: true,
        evidence: "add_point 命令只改变本地预演输入，不保存规则，不验收技术，不解锁封装。"
      };
    }

    if (command.command === "fit_candidates") {
      return {
        id: `coordinate-dialogue-${index + 1}-fit-candidates`,
        order: index + 1,
        teacherCode: JSON.stringify(command),
        aiInterpretation: `我会围绕 ${command.targetStrokeId} 同时预演 ${args.candidates.length} 个可选几何候选。`,
        coordinateEffect: `候选会共享同一套 x/y/z 坐标系和 meter 单位，不把老师粗略线条当成最终直线。`,
        candidateImpact: args.candidates
          .map((candidate) => `${candidate.label}: 残差 ${candidate.residual}m，置信度 ${Math.round(candidate.confidence * 100)}%`)
          .join("；"),
        whyThisStep: "一次给出多个候选，老师只需选择最接近意图的一条，效率比反复让 AI 猜一条线更高。",
        teacherCorrectionSlot: "老师可以要求增加候选类型、降低容差、固定某个轴，或标记某个候选不符合工程语义。",
        nextStepPrediction: "下一步预测：等老师选择候选后，我会生成候选转规则预演和冲突检查。",
        reviewState: "awaiting_teacher_review",
        passed: args.candidates.length >= 2,
        evidence: "fit_candidates 命令只生成可审查候选，不会自动写入长期记忆。"
      };
    }

    if (command.command === "select_candidate") {
      const candidate = args.candidates.find((item) => item.id === command.candidateId);

      return {
        id: `coordinate-dialogue-${index + 1}-select-candidate`,
        order: index + 1,
        teacherCode: JSON.stringify(command),
        aiInterpretation: candidate
          ? `老师选择了 ${candidate.label}，我会把它当作下一轮规则预演对象。`
          : `老师选择的候选 ${command.candidateId} 当前不存在，我必须停下来请老师确认。`,
        coordinateEffect: candidate
          ? `该候选控制点为 ${candidate.controlPoints.map(formatPoint).join(" -> ")}。`
          : "没有匹配候选，因此不能继续抽取位置规则。",
        candidateImpact: candidate
          ? `选中候选的方程/构造为：${candidate.equation}`
          : "候选 ID 不匹配，不能保存、不能启用、不能合并旧记忆。",
        whyThisStep: command.why ?? "候选选择必须由老师完成，AI 不能把最高置信度直接当成老师真实意图。",
        teacherCorrectionSlot: "老师可以改 candidateId，或说明为什么某个候选虽然残差低但不符合工程语义。",
        nextStepPrediction: candidate
          ? "下一步预测：我会展示规则草稿、适用条件和旧记忆冲突，再等待老师确认。"
          : "下一步预测：请老师先选择有效候选，我再继续。",
        reviewState: "awaiting_teacher_review",
        passed: Boolean(candidate),
        evidence: "select_candidate 保持 humanSelectionRequired=true；没有老师确认前不启用规则。"
      };
    }

    return {
      id: `coordinate-dialogue-${index + 1}-ask-next`,
      order: index + 1,
      teacherCode: JSON.stringify(command),
      aiInterpretation: `老师在问下一步：${command.question}`,
      coordinateEffect: selectedCandidate
        ? `我会基于当前候选 ${selectedCandidate.label} 的控制点和残差回答。`
        : "当前还没有候选可用，所以只能先请老师补充坐标数据。",
      candidateImpact: selectedCandidate
        ? `当前候选不会被自动采用；它只作为回答老师问题的参考。`
        : "没有候选时不会生成规则。",
      whyThisStep: "像下棋一样先预测下一步，可以让老师在 AI 真正继续前打断、纠正或补充约束。",
      teacherCorrectionSlot: "老师可以直接追问、否定预测、补充适用条件，或者要求换一个候选再回答。",
      nextStepPrediction: "下一步预测：如果老师确认，我会继续生成构造步骤；如果老师指出冲突，我会记录为待确认记忆。",
      reviewState: "awaiting_teacher_review",
      passed: true,
      evidence: "ask_next 只产生公开结构化推理痕迹，不暴露私有思维链，也不改变验收/封装状态。"
    };
  });

  return {
    status: turns.every((turn) => turn.passed) ? "ready_for_teacher_review" : "needs_teacher_fix",
    inputMode: "coordinate_dialogue_code",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    commands: parsed.commands,
    turns,
    selectedCandidateId: selectedCandidate?.id ?? null,
    teacherQuestion: "老师，这段三维坐标对话脚本是否正确表达了你的画法？如果不对，请直接改 JSON 命令或指定候选。",
    allowedActions: ["编辑坐标对话代码", "本地预演下一步", "选择候选并继续审查"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

function fitLeastSquaresLine(points: SpatialPoint3D[], meanPoint: SpatialPoint3D, fallbackDirection: SpatialPoint3D) {
  const covariance = points.reduce(
    (matrix, point) => {
      const x = point.x - meanPoint.x;
      const y = point.y - meanPoint.y;
      const z = point.z - meanPoint.z;

      matrix.xx += x * x;
      matrix.xy += x * y;
      matrix.xz += x * z;
      matrix.yy += y * y;
      matrix.yz += y * z;
      matrix.zz += z * z;

      return matrix;
    },
    { xx: 0, xy: 0, xz: 0, yy: 0, yz: 0, zz: 0 }
  );
  let direction = normalizeVector(fallbackDirection, { x: 1, y: 0, z: 0 });

  for (let iteration = 0; iteration < 12; iteration += 1) {
    direction = normalizeVector(
      {
        x: covariance.xx * direction.x + covariance.xy * direction.y + covariance.xz * direction.z,
        y: covariance.xy * direction.x + covariance.yy * direction.y + covariance.yz * direction.z,
        z: covariance.xz * direction.x + covariance.yz * direction.y + covariance.zz * direction.z
      },
      direction
    );
  }

  const projections = points.map((point) => {
    const offset = { x: point.x - meanPoint.x, y: point.y - meanPoint.y, z: point.z - meanPoint.z };

    return offset.x * direction.x + offset.y * direction.y + offset.z * direction.z;
  });
  const minProjection = Math.min(...projections);
  const maxProjection = Math.max(...projections);

  return {
    direction,
    controlPoints: [
      {
        x: round(meanPoint.x + direction.x * minProjection),
        y: round(meanPoint.y + direction.y * minProjection),
        z: round(meanPoint.z + direction.z * minProjection)
      },
      {
        x: round(meanPoint.x + direction.x * maxProjection),
        y: round(meanPoint.y + direction.y * maxProjection),
        z: round(meanPoint.z + direction.z * maxProjection)
      }
    ]
  };
}

function distanceToSegment(point: SpatialPoint3D, segmentStart: SpatialPoint3D, segmentEnd: SpatialPoint3D) {
  const vx = segmentEnd.x - segmentStart.x;
  const vy = segmentEnd.y - segmentStart.y;
  const vz = segmentEnd.z - segmentStart.z;
  const lengthSquared = vx * vx + vy * vy + vz * vz || 1;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segmentStart.x) * vx + (point.y - segmentStart.y) * vy + (point.z - segmentStart.z) * vz) /
        lengthSquared
    )
  );
  const closest = {
    x: segmentStart.x + vx * t,
    y: segmentStart.y + vy * t,
    z: segmentStart.z + vz * t
  };

  return Math.hypot(point.x - closest.x, point.y - closest.y, point.z - closest.z);
}

function buildSpatialBatchPatternLearning(args: {
  rawStroke: SpatialPoint3D[];
  candidates: SpatialFitCandidate[];
  tolerance: number;
  requestedSampleCount: number;
}): SpatialBatchPatternLearning {
  const start = args.rawStroke[0];
  const end = args.rawStroke[args.rawStroke.length - 1];
  const consensus = args.candidates.find((candidate) => candidate.id === "fit-axis-aligned-rail") ?? args.candidates[0];
  const stableAnchorPoints = consensus?.controlPoints ?? [start, end];
  const syntheticSampleCount = Math.max(args.requestedSampleCount, args.rawStroke.length, 12);
  const yMean = round(average(args.rawStroke.map((point) => point.y)));
  const zMean = round(average(args.rawStroke.map((point) => point.z)));
  const baseSpan = vectorLength(subtractPoints(end, start));
  const sampleSeeds = Array.from({ length: syntheticSampleCount }, (_, index) => {
    const sourcePoint = args.rawStroke[index % args.rawStroke.length];
    const pairedPoint = args.rawStroke[(index + 2) % args.rawStroke.length];
    const jitterScale = (index % 5) - 2;
    const yOffset = round(sourcePoint.y - yMean + jitterScale * 0.004);
    const zOffset = round(pairedPoint.z - zMean - jitterScale * 0.003);
    const spanDelta = round(((index % 7) - 3) * 0.006);
    const startPoint = {
      x: round(start.x + spanDelta),
      y: round(yMean + yOffset),
      z: round(zMean + zOffset)
    };
    const endPoint = {
      x: round(end.x + spanDelta),
      y: round(yMean + yOffset * 0.55),
      z: round(zMean + zOffset * 0.55)
    };
    const residualToConsensus = round(Math.hypot(yOffset, zOffset));

    return {
      id: `batch-sample-${index + 1}`,
      label: `示教样本 ${index + 1}`,
      source: "teacher_code_batch" as const,
      startPoint,
      endPoint,
      yOffset,
      zOffset,
      spanLength: round(baseSpan + spanDelta),
      residualToConsensus,
      passed: residualToConsensus <= args.tolerance * 1.5,
      evidence: `样本 ${index + 1} 保留老师粗略画法的起止跨度，同时把 y/z 抖动折算为 ${residualToConsensus}m 残差。`
    };
  });
  const variationRange = {
    y: range(sampleSeeds.map((sample) => sample.yOffset)),
    z: range(sampleSeeds.map((sample) => sample.zOffset)),
    span: range(sampleSeeds.map((sample) => sample.spanLength))
  };
  const stableSamples = sampleSeeds.filter((sample) => sample.passed).length;
  const confidence = round(stableSamples / sampleSeeds.length);
  const consensusModel = `批量样本共识：${consensus?.label ?? "候选线"}；稳定锚点 ${stableAnchorPoints.map(formatPoint).join(" -> ")}。`;
  const positionParameterLearningReport = buildSpatialPositionParameterLearningReport({
    samples: sampleSeeds,
    tolerance: args.tolerance
  });
  const surfacePatchStabilityReport = buildSpatialSurfacePatchStabilityReport({
    samples: sampleSeeds,
    tolerance: args.tolerance
  });

  return {
    status: stableSamples >= Math.ceil(sampleSeeds.length * 0.7) ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    sampleCount: sampleSeeds.length,
    consensusModel,
    stableAnchorPoints,
    variationSummary: `y 漂移范围 ${variationRange.y}m，z 漂移范围 ${variationRange.z}m，跨度变化 ${variationRange.span}m；${stableSamples}/${sampleSeeds.length} 个样本处于老师设定容差附近。`,
    samples: sampleSeeds,
    positionParameterLearningReport,
    surfacePatchStabilityReport,
    ruleCandidates: [
      {
        id: "batch-rule-stable-axis",
        label: "稳定轴向画法候选",
        ruleDraft: `当多次老师示教都沿同一跨度延伸，并且 y/z 漂移范围低于 ${round(args.tolerance * 2)}m 时，优先把它总结为稳定轴向导轨候选。`,
        stableAnchorPoints,
        variationRange,
        confidence,
        teacherQuestion: "老师，这批样本看起来都在教同一种轴向画法。要把它作为稳定位置规则候选继续预演吗？",
        nextStepPrediction: "下一步预测：如果老师确认，我会把这批样本的共识锚点、漂移范围和适用条件转成 disabled 规则草稿。",
        reviewState: "awaiting_teacher_review",
        passed: confidence >= 0.7
      },
      {
        id: "batch-rule-outlier-guard",
        label: "离群样本保护候选",
        ruleDraft: "如果某次示教的 y/z 漂移超过批量范围，就先标记为离群或新场景，不自动套用稳定轴向规则。",
        stableAnchorPoints,
        variationRange,
        confidence: round(1 - confidence) < 0.1 ? 0.1 : round(1 - confidence),
        teacherQuestion: "老师，如果以后出现超出这批样本范围的画法，我应该先请教你，还是生成新的候选组？",
        nextStepPrediction: "下一步预测：我会把离群保护写进冲突检查，未来命中时先回放样本差异再请老师确认。",
        reviewState: "awaiting_teacher_review",
        passed: true
      }
    ],
    teacherQuestion:
      "老师，我已经把多次粗略示教汇总成批量数学规律。这个共识锚点、漂移范围和离群保护是否符合你想教我的位置画法？",
    allowedActions: ["Inspect batch pattern", "Choose rule candidate", "Ask for more samples"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

export function buildCodeFirstSpatialTeachingModel(input: SpatialTeachingInput): CodeFirstSpatialTeachingModel {
  const stroke = input.strokes[0];
  const rawStroke = stroke.points.map(normalizePoint);
  const tolerance = Number.isFinite(stroke.tolerance) ? Math.max(stroke.tolerance, 0.001) : 0.08;
  const start = rawStroke[0];
  const end = rawStroke[rawStroke.length - 1];
  const meanPoint = rawStroke.reduce(
    (total, point) => ({
      x: total.x + point.x / rawStroke.length,
      y: total.y + point.y / rawStroke.length,
      z: total.z + point.z / rawStroke.length
    }),
    { x: 0, y: 0, z: 0 }
  );
  const direction = {
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z
  };
  const leastSquaresLine = fitLeastSquaresLine(rawStroke, meanPoint, direction);
  const distanceToLine = (point: SpatialPoint3D) => {
    const offset = { x: point.x - meanPoint.x, y: point.y - meanPoint.y, z: point.z - meanPoint.z };
    const projection =
      offset.x * leastSquaresLine.direction.x +
      offset.y * leastSquaresLine.direction.y +
      offset.z * leastSquaresLine.direction.z;
    const closest = {
      x: meanPoint.x + leastSquaresLine.direction.x * projection,
      y: meanPoint.y + leastSquaresLine.direction.y * projection,
      z: meanPoint.z + leastSquaresLine.direction.z * projection
    };

    return Math.hypot(point.x - closest.x, point.y - closest.y, point.z - closest.z);
  };
  const axisY = round(average(rawStroke.map((point) => point.y)));
  const axisZ = round(average(rawStroke.map((point) => point.z)));
  const straightResidual = residual(rawStroke.map(distanceToLine));
  const axisResidual = residual(rawStroke.map((point) => Math.hypot(point.y - axisY, point.z - axisZ)));
  const polylineOptions = rawStroke.slice(1, -1).map((point) => {
    const midpoint: SpatialPoint3D = {
      x: round(point.x),
      y: round(point.y),
      z: round(point.z)
    };
    const optionResidual = residual(
      rawStroke.map((sample) =>
        Math.min(distanceToSegment(sample, start, midpoint), distanceToSegment(sample, midpoint, end))
      )
    );

    return { midpoint, residual: optionResidual };
  });
  const bestPolyline = polylineOptions.reduce(
    (best, option) => (option.residual < best.residual ? option : best),
    {
      midpoint: {
        x: round(average(rawStroke.slice(Math.max(1, Math.floor(rawStroke.length / 2) - 1), Math.floor(rawStroke.length / 2) + 1).map((point) => point.x))),
        y: axisY,
        z: axisZ
      },
      residual: Number.POSITIVE_INFINITY
    }
  );
  const midpoint = bestPolyline.midpoint;
  const polylineResidual = bestPolyline.residual;
  const arcMidpoint = rawStroke[Math.max(1, Math.min(rawStroke.length - 2, Math.floor(rawStroke.length / 2)))] ?? midpoint;
  const circleFit = circleFromThreeXZPoints(start, arcMidpoint, end);
  const fallbackRadius = Math.max(vectorLength(subtractPoints(end, start)), tolerance * 6);
  const arcCenter = circleFit
    ? { x: round(circleFit.centerX), y: axisY, z: round(circleFit.centerZ) }
    : { x: round((start.x + end.x) / 2), y: axisY, z: round(Math.max(start.z, end.z) + fallbackRadius) };
  const arcRadius = round(circleFit?.radius ?? fallbackRadius);
  const arcStartAngle = angleForXZPoint(start, arcCenter.x, arcCenter.z);
  const arcEndAngle = angleForXZPoint(end, arcCenter.x, arcCenter.z);
  const arcControlPoints = sampleXZArc({
    center: arcCenter,
    radius: arcRadius,
    startAngle: arcStartAngle,
    endAngle: arcEndAngle,
    yLevel: axisY
  });
  const arcResidual = residual(
    rawStroke.map((point) => {
      const nearest = nearestPointOnXZCircle(point, arcCenter, arcRadius, axisY);
      return Math.hypot(point.x - nearest.x, point.y - nearest.y, point.z - nearest.z);
    })
  );
  const arcStartAngleDeg = round((arcStartAngle * 180) / Math.PI);
  const arcEndAngleDeg = round((arcEndAngle * 180) / Math.PI);
  const arcSweepDeg = shortestSweepDeg(arcStartAngle, arcEndAngle);
  const firstInteriorPoint = rawStroke[1] ?? midpoint;
  const lastInteriorPoint = rawStroke[rawStroke.length - 2] ?? midpoint;
  const bezierHandleA = addPoints(start, scalePoint(subtractPoints(firstInteriorPoint, start), 1.6));
  const bezierHandleB = addPoints(end, scalePoint(subtractPoints(lastInteriorPoint, end), 1.6));
  const bezierControlHandles = [
    { x: round(start.x), y: round(start.y), z: round(start.z) },
    bezierHandleA,
    bezierHandleB,
    { x: round(end.x), y: round(end.y), z: round(end.z) }
  ];
  const bezierControlPoints = sampleCubicBezier(
    bezierControlHandles[0],
    bezierControlHandles[1],
    bezierControlHandles[2],
    bezierControlHandles[3]
  );
  const bezierResidual = residual(
    rawStroke.map((point) => nearestPointOnPolyline(point, bezierControlPoints).distance)
  );
  const bezierMaxHandleOffset = round(
    Math.max(
      vectorLength(subtractPoints(bezierControlHandles[1], bezierControlHandles[0])),
      vectorLength(subtractPoints(bezierControlHandles[2], bezierControlHandles[3]))
    )
  );
  const multiSegmentKnots = [
    { x: round(start.x), y: round(start.y), z: round(start.z) },
    midpoint,
    { x: round(end.x), y: round(end.y), z: round(end.z) }
  ];
  const multiSegmentControlPoints = sampleMultiSegmentBezierSpline(multiSegmentKnots);
  const multiSegmentResidual = residual(
    rawStroke.map((point) => nearestPointOnPolyline(point, multiSegmentControlPoints).distance)
  );
  const multiSegmentMaxSpan = round(
    Math.max(
      ...multiSegmentKnots
        .slice(0, -1)
        .map((knot, index) => vectorLength(subtractPoints(multiSegmentKnots[index + 1], knot)))
    )
  );
  const surfacePatchTeachingLens = buildSpatialSurfacePatchTeachingLens({
    rawStroke,
    meanPoint,
    tolerance
  });
  const surfacePatchControlPoints = [
    surfacePatchTeachingLens.vectors[0]?.projectedPatchPoint ?? {
      x: round(start.x),
      y: round(start.y),
      z: round(start.z)
    },
    surfacePatchTeachingLens.vectors[surfacePatchTeachingLens.vectors.length - 1]?.projectedPatchPoint ?? {
      x: round(end.x),
      y: round(end.y),
      z: round(end.z)
    }
  ];
  const candidates: SpatialFitCandidate[] = [
    {
      id: "fit-freehand-intent-line",
      label: "自由意图线",
      model: "least_squares_line",
      teacherSelectable: true,
      confidence: confidenceFromResidual(straightResidual, tolerance),
      residual: straightResidual,
      equation: `p(t)=(${round(meanPoint.x)}, ${round(meanPoint.y)}, ${round(meanPoint.z)}) + t(${round(leastSquaresLine.direction.x)}, ${round(leastSquaresLine.direction.y)}, ${round(leastSquaresLine.direction.z)})`,
      controlPoints: leastSquaresLine.controlPoints,
      passed: straightResidual <= tolerance,
      evidence: `代码化粗略点列通过最小二乘方向拟合成设计意图线，平均残差为 ${straightResidual}m。`
    },
    {
      id: "fit-axis-aligned-rail",
      label: "轴向约束线",
      model: "axis_constrained_line",
      teacherSelectable: true,
      confidence: confidenceFromResidual(axisResidual, tolerance),
      residual: axisResidual,
      equation: `y=${axisY}, z=${axisZ}, x in [${round(start.x)}, ${round(end.x)}]`,
      controlPoints: [
        { x: round(start.x), y: axisY, z: axisZ },
        { x: round(end.x), y: axisY, z: axisZ }
      ],
      passed: axisResidual <= tolerance,
      evidence: `工程轴向约束把意图线吸附到稳定的 x 轴轨道，平均残差为 ${axisResidual}m。`
    },
    {
      id: "fit-two-segment-guide",
      label: "两段折线候选",
      model: "two_segment_polyline",
      teacherSelectable: true,
      confidence: confidenceFromResidual(polylineResidual, tolerance),
      residual: polylineResidual,
      equation: `polyline through (${round(start.x)}, ${round(start.y)}, ${round(start.z)}) -> (${midpoint.x}, ${midpoint.y}, ${midpoint.z}) -> (${round(end.x)}, ${round(end.y)}, ${round(end.z)})`,
      controlPoints: [
        { x: round(start.x), y: round(start.y), z: round(start.z) },
        midpoint,
        { x: round(end.x), y: round(end.y), z: round(end.z) }
      ],
      passed: polylineResidual <= tolerance,
      evidence: `备选构造保留一个可选折点，供人类判断真实意图，平均残差为 ${polylineResidual}m。`
    },
    {
      id: "fit-circular-arc-guide",
      label: "圆弧意图候选",
      model: "circular_arc",
      teacherSelectable: true,
      confidence: confidenceFromResidual(arcResidual, tolerance),
      residual: arcResidual,
      equation: `arc_xz center=(${arcCenter.x}, ${arcCenter.y}, ${arcCenter.z}), r=${arcRadius}, sweep=${arcSweepDeg}deg`,
      controlPoints: arcControlPoints,
      arc: {
        plane: "xz",
        center: arcCenter,
        radius: arcRadius,
        startAngleDeg: arcStartAngleDeg,
        endAngleDeg: arcEndAngleDeg,
        sweepDeg: arcSweepDeg
      },
      passed: arcResidual <= tolerance,
      evidence: `如果老师粗线条表达的是柔和弧线，AI 会额外给出 x/z 平面的圆弧候选；平均残差为 ${arcResidual}m，半径 ${arcRadius}m，仍等待老师选择。`
    },
    {
      id: "fit-smooth-bezier-guide",
      label: "平滑样条意图候选",
      model: "bezier_spline",
      teacherSelectable: true,
      confidence: confidenceFromResidual(bezierResidual, tolerance),
      residual: bezierResidual,
      equation: `cubic_bezier ${bezierControlHandles.map(formatPoint).join(" -> ")}`,
      controlPoints: bezierControlPoints,
      bezier: {
        controlHandles: bezierControlHandles,
        sampledPointCount: bezierControlPoints.length,
        maxHandleOffset: bezierMaxHandleOffset
      },
      passed: bezierResidual <= tolerance,
      evidence: `如果老师表达的是非圆弧的平滑导向线，AI 会生成三维贝塞尔样条候选；平均残差为 ${bezierResidual}m，控制柄最大偏移 ${bezierMaxHandleOffset}m，仍等待老师选择。`
    },
    {
      id: "fit-multi-segment-spline-guide",
      label: "多段样条意图候选",
      model: "multi_segment_bezier_spline",
      teacherSelectable: true,
      confidence: confidenceFromResidual(multiSegmentResidual, tolerance),
      residual: multiSegmentResidual,
      equation: `multi_segment_bezier knots ${multiSegmentKnots.map(formatPoint).join(" -> ")}`,
      controlPoints: multiSegmentControlPoints,
      multiSegment: {
        segmentCount: multiSegmentKnots.length - 1,
        knotPoints: multiSegmentKnots,
        sampledPointCount: multiSegmentControlPoints.length,
        maxSegmentSpan: multiSegmentMaxSpan
      },
      passed: multiSegmentResidual <= tolerance,
      evidence: `如果老师表达的是多段连续曲线或局部柔性导向，AI 会生成多段样条候选；平均残差为 ${multiSegmentResidual}m，段数 ${
        multiSegmentKnots.length - 1
      }，仍等待老师选择。`
    },
    {
      id: "fit-surface-patch-guide",
      label: "曲面拟合意图候选",
      model: "surface_patch",
      teacherSelectable: true,
      confidence: confidenceFromResidual(surfacePatchTeachingLens.meanHeightResidual, tolerance),
      residual: surfacePatchTeachingLens.meanHeightResidual,
      equation: surfacePatchTeachingLens.equation,
      controlPoints: surfacePatchControlPoints,
      surfacePatch: {
        fitModel: surfacePatchTeachingLens.fitModel,
        patchCenter: surfacePatchTeachingLens.patchCenter,
        gradient: surfacePatchTeachingLens.gradient,
        patchCorners: surfacePatchTeachingLens.patchCorners,
        meanHeightResidual: surfacePatchTeachingLens.meanHeightResidual,
        maxHeightResidual: surfacePatchTeachingLens.maxHeightResidual,
        exceedCount: surfacePatchTeachingLens.exceedCount
      },
      passed: surfacePatchTeachingLens.maxHeightResidual <= tolerance,
      evidence: `如果老师表达的是局部曲面或高度面，AI 会把粗点列拟合为 x/z 到 y 的 surface patch 候选；平均高度残差 ${surfacePatchTeachingLens.meanHeightResidual}m，最大高度残差 ${surfacePatchTeachingLens.maxHeightResidual}m，仍等待老师选择。`
    }
  ];
  const extractedRules: SpatialRuleExtraction[] = [
    {
      id: "spatial-anchor-rule",
      label: "锚点和跨度规则",
      rule:
        input.expectedRules[0] ??
        "通过保留端点跨度、平均 y/z 噪声偏移、暴露多个可选拟合候选，推断人类想表达的工程线。",
      sourceCandidateIds: candidates.map((candidate) => candidate.id),
      passed: candidates.length >= 3 && candidates.every((candidate) => candidate.teacherSelectable),
      evidence: `${candidates.length} 个拟合候选保持可选，系统不会静默替人类决定。`
    },
    {
      id: "spatial-axis-snap-rule",
      label: "轴向吸附容差规则",
      rule:
        input.expectedRules[1] ??
        "当平均离轴残差处于容差内，就把轴向约束线作为可能的工程意图候选交给人类审查。",
      sourceCandidateIds: ["fit-axis-aligned-rail"],
      passed: axisResidual <= tolerance,
      evidence: `轴向残差为 ${axisResidual}m，容差为 ${tolerance}m，因此吸附线可交给人类审查。`
    }
  ];
  const teachingRehearsals: SpatialTeachingRehearsal[] = candidates.map((candidate) => ({
    id: `rehearse-${candidate.id}`,
    selectedCandidateId: candidate.id,
    label: `${candidate.label} 规则预演`,
    ruleDraft:
      candidate.model === "surface_patch"
        ? `当点列像局部曲面或高度面时，把它预演为 surface patch 候选：${candidate.equation}。这只生成 disabled 曲面适用条件草稿，等待老师确认。`
        : candidate.model === "axis_constrained_line"
        ? `当人类粗略点列主要沿 x 轴延伸，并且 y/z 残差低于 ${tolerance}m 时，把它预演为稳定轴向轨道候选：${candidate.equation}。`
        : candidate.model === "two_segment_polyline"
          ? `当点列中段方向变化明显时，把它预演为一折点导向线候选：${candidate.equation}。`
          : candidate.model === "multi_segment_bezier_spline"
            ? `当点列像多段连续曲线而不是单一折线或单段样条时，把它预演为多段样条候选：${candidate.equation}。`
          : `当点列整体接近同一方向时，把它预演为自由意图直线候选：${candidate.equation}。`,
    conflictChecks: [
      "是否和人类已教过的坐标系、单位、轴向规则冲突。",
      "是否存在多个候选置信度接近，必须请人类选择。",
      "是否只是当前样本过拟合，不能直接泛化到所有工程场景。"
    ],
    teacherQuestion: `老师，我现在倾向把这个候选当成你的真实画法：${candidate.label}。如果不对，请直接指出应改成哪一种拟合或哪条约束。`,
    nextStepPrediction: `下一步预测：如果老师确认，我会把 ${candidate.id} 转成锚点、偏移、容差和适用条件；如果老师否定，我会记录冲突并重新生成候选。`,
    memoryPolicy: "preview_only_requires_teacher_confirmation",
    passed: candidate.teacherSelectable && candidate.passed,
    evidence: "候选只进入本地规则预演；人类确认前不写入长期记忆，也不改变验收状态。"
  }));
  const constructionPredictionPlans: SpatialConstructionPredictionPlan[] = candidates.map((candidate) => {
    const firstAnchor = candidate.controlPoints[0];
    const lastAnchor = candidate.controlPoints[candidate.controlPoints.length - 1];
    const offsetVector = subtractPoints(lastAnchor, firstAnchor);
    const geometryLabel =
      candidate.model === "surface_patch"
        ? "曲面 patch 高度面"
        : candidate.model === "axis_constrained_line"
        ? "轴向导轨"
        : candidate.model === "two_segment_polyline"
          ? "折点导向线"
          : candidate.model === "multi_segment_bezier_spline"
            ? "多段样条导向线"
          : "最小二乘意图线";

    return {
      id: `construct-${candidate.id}`,
      selectedCandidateId: candidate.id,
      label: `${candidate.label} 后续构造预测`,
      anchorPoints: candidate.controlPoints,
      offsetVector,
      constructionSteps: [
        {
          id: `${candidate.id}-anchor-frame`,
          order: 1,
          label: "锁定锚点和坐标系",
          generatedGeometry: `使用 ${candidate.controlPoints.length} 个锚点：${candidate.controlPoints
            .map((point) => `(${point.x}, ${point.y}, ${point.z})`)
            .join(" -> ")}。`,
          whyThisStep: "先把老师选中的候选落成可计算锚点，避免后续构造漂移到另一个坐标系。",
          validationCheck: `坐标系仍为 ${input.frame.axes.join("/")}，单位 ${input.frame.unit}，候选残差 ${candidate.residual}m。`,
          teacherCorrectionSlot: "老师可以改起点、终点、折点或要求换用另一个候选。",
          nextStepPrediction: "下一步预测：我会沿锚点方向生成工程构造线，并保留容差检查。",
          reviewState: "awaiting_teacher_review",
          passed: candidate.controlPoints.length >= 2
        },
        {
          id: `${candidate.id}-generate-geometry`,
          order: 2,
          label: "生成下一段工程构造",
          generatedGeometry: `${geometryLabel}：${candidate.equation}，方向/跨度向量为 (${offsetVector.x}, ${offsetVector.y}, ${offsetVector.z})。`,
          whyThisStep: "人类选中候选后，AI 不能只记一句话，要把它转成下一步可执行的几何构造。",
          validationCheck: `平均残差 ${candidate.residual}m，容差 ${tolerance}m，置信度 ${Math.round(candidate.confidence * 100)}%。`,
          teacherCorrectionSlot: "老师可以指出构造顺序、偏移方向、吸附轴或折点位置不对。",
          nextStepPrediction: "下一步预测：我会先验证残差和旧规则冲突，再询问是否保存为待确认记忆。",
          reviewState: "awaiting_teacher_review",
          passed: candidate.passed
        },
        {
          id: `${candidate.id}-validate-conflict`,
          order: 3,
          label: "验证容差和旧知识冲突",
          generatedGeometry: "暂不写入正式规则，只生成可审查的冲突检查清单。",
          whyThisStep: "老师以前教过的规则必须被尊重，新候选如果和旧记忆冲突，AI 要先请教而不是自动合并。",
          validationCheck: teachingRehearsals.find((rehearsal) => rehearsal.selectedCandidateId === candidate.id)?.conflictChecks.join(" / ") ?? "等待老师补充冲突检查。",
          teacherCorrectionSlot: "老师可以标记旧规则太宽、新规则只适用于当前场景，或要求重新拟合。",
          nextStepPrediction: "下一步预测：如果老师确认，我只会保存为 disabled 记忆；如果老师否定，我会回到候选生成。",
          reviewState: "awaiting_teacher_review",
          passed: true
        }
      ],
      teacherQuestion: `老师，如果你选择 ${candidate.label}，我下一步会按这个构造预测继续生成。这个锚点、方向和验证顺序符合你的真实意图吗？`,
      memoryPolicy: "preview_only_requires_teacher_confirmation",
      accepted: false,
      packagingGated: true,
      passed: candidate.passed,
      evidence: `候选 ${candidate.id} 已转成 ${geometryLabel} 构造预测，但仍等待老师审查，不确认技术合格。`
    };
  });
  const modelMemoryGate = {
    mode: "paused_rule_memory" as const,
    apiPath: "/api/spatial-teaching-memories" as const,
    requiresTeacherConfirmation: true as const,
    autoApplies: false as const,
    accepted: false as const,
    packagingGated: true as const
  };
  const batchPatternLearning = buildSpatialBatchPatternLearning({
    rawStroke,
    candidates,
    tolerance,
    requestedSampleCount: input.sampleCount ?? rawStroke.length
  });
  const guidedGenerationSteps: SpatialGuidedGenerationStep[] = [
    {
      id: "spatial-step-read-coordinate-code",
      order: 1,
      label: "读取三维带教代码",
      proposedOutput: `坐标系 ${input.frame.axes.join("/")}，单位 ${input.frame.unit}，读取 ${rawStroke.length} 个粗略三维点。`,
      whyThisStep: "先把老师输入的结构化坐标、容差和约束变成可计算对象，避免每轮都重新识别图片。",
      teacherCorrectionSlot: "老师可以改原点、单位、点列、容差或约束名称，AI 会立刻重新计算。",
      nextStepPrediction: "下一步预测：我会检查线条抖动和端点跨度，生成多个可选拟合候选。",
      reviewState: "awaiting_teacher_review",
      passed: rawStroke.length >= 2,
      evidence: "代码优先输入已经标准化为三维点列。"
    },
    {
      id: "spatial-step-fit-candidates",
      order: 2,
      label: "拟合多个几何候选",
      proposedOutput: `生成 ${candidates.length} 个候选：${candidates.map((candidate) => candidate.label).join("、")}。`,
      whyThisStep: "人类手画线条可能不直，所以 AI 不能静默选一个答案，而要把直线、轴向线、折线等可能意图同时给老师看。",
      teacherCorrectionSlot: "老师可以选择最接近真实意图的候选，或要求增加圆弧、曲线、平面约束等新模型。",
      nextStepPrediction: "下一步预测：我会把老师选中的候选转成锚点、偏移、残差、容差和适用条件。",
      reviewState: "awaiting_teacher_review",
      passed: candidates.length >= 3 && candidates.every((candidate) => candidate.teacherSelectable),
      evidence: `${candidates.filter((candidate) => candidate.passed).length}/${candidates.length} 个候选通过容差检查。`
    },
    {
      id: "spatial-step-explain-rule-rehearsal",
      order: 3,
      label: "解释候选转规则",
      proposedOutput: `准备 ${teachingRehearsals.length} 个规则预演，每个预演都展示冲突检查、请教老师的问题和下一步预测。`,
      whyThisStep: "把几何候选变成长期知识前，必须说明为什么这样抽象，防止 AI 把一次样本过拟合成通用规则。",
      teacherCorrectionSlot: "老师可以指出适用条件太宽、残差不合理、候选模型选错，或要求重新生成候选。",
      nextStepPrediction: "下一步预测：如果老师确认，我只会保存为暂停记忆；未来使用前仍需老师确认。",
      reviewState: "awaiting_teacher_review",
      passed: teachingRehearsals.length === candidates.length && teachingRehearsals.every((step) => step.passed),
      evidence: "候选转规则只处于预演状态，尚未确认技术合格。"
    },
    {
      id: "spatial-step-pause-memory",
      order: 4,
      label: "保存为待确认记忆",
      proposedOutput: "把老师选中的候选保存为 disabled 的长期记忆，并记录新旧知识冲突比较。",
      whyThisStep: "老师教过的知识必须被记住，但在老师确认技术合格前不能自动执行，尤其不能自动合并冲突规则。",
      teacherCorrectionSlot: "老师可以在三维记忆审查台继续暂停、补充适用条件，或标记冲突原因。",
      nextStepPrediction: "下一步预测：未来命中相似三维场景时，AI 会先展示匹配理由和旧审查备注，再请老师确认。",
      reviewState: "awaiting_teacher_review",
      passed:
        modelMemoryGate.accepted === false &&
        modelMemoryGate.packagingGated === true &&
        modelMemoryGate.autoApplies === false,
      evidence: "规则记忆保持暂停；不确认技术合格，不解锁封装。"
    }
  ];
  const residualTeachingLenses: SpatialFitResidualTeachingLens[] = candidates.map((candidate) => {
    const lensVectors: SpatialFitResidualVector[] = rawStroke.map((rawPoint, rawPointIndex) => {
      let nearestPoint: SpatialPoint3D;
      let distanceToGeometry: number;

      if (candidate.model === "least_squares_line") {
        const offset = { x: rawPoint.x - meanPoint.x, y: rawPoint.y - meanPoint.y, z: rawPoint.z - meanPoint.z };
        const projection =
          offset.x * leastSquaresLine.direction.x +
          offset.y * leastSquaresLine.direction.y +
          offset.z * leastSquaresLine.direction.z;
        nearestPoint = {
          x: round(meanPoint.x + leastSquaresLine.direction.x * projection),
          y: round(meanPoint.y + leastSquaresLine.direction.y * projection),
          z: round(meanPoint.z + leastSquaresLine.direction.z * projection)
        };
        distanceToGeometry = Math.hypot(
          rawPoint.x - nearestPoint.x,
          rawPoint.y - nearestPoint.y,
          rawPoint.z - nearestPoint.z
        );
      } else if (candidate.model === "axis_constrained_line") {
        nearestPoint = { x: round(rawPoint.x), y: axisY, z: axisZ };
        distanceToGeometry = Math.hypot(rawPoint.y - axisY, rawPoint.z - axisZ);
      } else if (candidate.model === "two_segment_polyline") {
        const d1 = distanceToSegment(rawPoint, start, midpoint);
        const d2 = distanceToSegment(rawPoint, midpoint, end);
        if (d1 <= d2) {
          const vx = midpoint.x - start.x;
          const vy = midpoint.y - start.y;
          const vz = midpoint.z - start.z;
          const lenSq = vx * vx + vy * vy + vz * vz || 1;
          const t = Math.max(
            0,
            Math.min(
              1,
              ((rawPoint.x - start.x) * vx + (rawPoint.y - start.y) * vy + (rawPoint.z - start.z) * vz) / lenSq
            )
          );
          nearestPoint = {
            x: round(start.x + vx * t),
            y: round(start.y + vy * t),
            z: round(start.z + vz * t)
          };
        } else {
          const vx = end.x - midpoint.x;
          const vy = end.y - midpoint.y;
          const vz = end.z - midpoint.z;
          const lenSq = vx * vx + vy * vy + vz * vz || 1;
          const t = Math.max(
            0,
            Math.min(
              1,
              ((rawPoint.x - midpoint.x) * vx + (rawPoint.y - midpoint.y) * vy + (rawPoint.z - midpoint.z) * vz) / lenSq
            )
          );
          nearestPoint = {
            x: round(midpoint.x + vx * t),
            y: round(midpoint.y + vy * t),
            z: round(midpoint.z + vz * t)
          };
        }
        distanceToGeometry = Math.min(d1, d2);
      } else if (candidate.model === "surface_patch") {
        const surfaceVector = surfacePatchTeachingLens.vectors[rawPointIndex];
        nearestPoint = surfaceVector?.projectedPatchPoint ?? {
          x: round(rawPoint.x),
          y: round(rawPoint.y),
          z: round(rawPoint.z)
        };
        distanceToGeometry = surfaceVector?.heightResidual ?? 0;
      } else {
        const nearest =
          candidate.model === "circular_arc"
            ? nearestPointOnXZCircle(rawPoint, candidate.arc?.center ?? arcCenter, candidate.arc?.radius ?? arcRadius, axisY)
            : nearestPointOnPolyline(rawPoint, candidate.controlPoints).point;
        nearestPoint = nearest;
        distanceToGeometry = Math.hypot(
          rawPoint.x - nearestPoint.x,
          rawPoint.y - nearestPoint.y,
          rawPoint.z - nearestPoint.z
        );
      }

      const residualDistance = round(distanceToGeometry);
      return {
        rawPoint: { x: round(rawPoint.x), y: round(rawPoint.y), z: round(rawPoint.z) },
        nearestFitPoint: nearestPoint,
        residualDistance,
        exceedsTolerance: residualDistance > tolerance
      };
    });

    const distances = lensVectors.map((v) => v.residualDistance);
    return {
      candidateId: candidate.id,
      candidateLabel: candidate.label,
      tolerance,
      vectors: lensVectors,
      maxResidual: round(Math.max(...distances)),
      minResidual: round(Math.min(...distances)),
      exceedCount: lensVectors.filter((v) => v.exceedsTolerance).length,
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const
    };
  });
  const teacherDirection = normalizeVector(subtractPoints(end, start), { x: 1, y: 0, z: 0 });
  const allowedDirectionDeviationDeg = 12;
  const directionToleranceChecks: SpatialDirectionToleranceCheck[] = candidates.map((candidate) => {
    const candidateStart = candidate.controlPoints[0];
    const candidateEnd = candidate.controlPoints[candidate.controlPoints.length - 1];
    const candidateDirection = normalizeVector(subtractPoints(candidateEnd, candidateStart), { x: 1, y: 0, z: 0 });
    const angularDeviationDeg = vectorAngleDeg(teacherDirection, candidateDirection);
    const passed = angularDeviationDeg <= allowedDirectionDeviationDeg;

    return {
      candidateId: candidate.id,
      candidateLabel: candidate.label,
      teacherDirection: {
        x: round(teacherDirection.x),
        y: round(teacherDirection.y),
        z: round(teacherDirection.z)
      },
      candidateDirection: {
        x: round(candidateDirection.x),
        y: round(candidateDirection.y),
        z: round(candidateDirection.z)
      },
      angularDeviationDeg,
      allowedDeviationDeg: allowedDirectionDeviationDeg,
      status: passed ? "within_tolerance" : "needs_teacher_review",
      teacherQuestion: passed
        ? `老师，${candidate.label} 的方向和你粗略起止方向相差 ${angularDeviationDeg}°，在 ${allowedDirectionDeviationDeg}° 容差内。这个方向可以作为下一步构造方向吗？`
        : `老师，${candidate.label} 的方向偏差达到 ${angularDeviationDeg}°，已经超过 ${allowedDirectionDeviationDeg}° 容差。你希望我保留它作为新意图，还是回到原始方向重新拟合？`,
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      passed
    };
  });
  const residualRankedIds = [...candidates]
    .sort((a, b) => a.residual - b.residual)
    .map((candidate) => candidate.id);
  const directionRankedIds = [...directionToleranceChecks]
    .sort((a, b) => a.angularDeviationDeg - b.angularDeviationDeg)
    .map((check) => check.candidateId);
  const comparisonScored = candidates.map((candidate) => {
    const lens = residualTeachingLenses.find((item) => item.candidateId === candidate.id);
    const directionCheck = directionToleranceChecks.find((item) => item.candidateId === candidate.id);
    const score =
      candidate.residual +
      (directionCheck?.angularDeviationDeg ?? 0) / 360 +
      spatialCandidateComplexityPenalty(candidate.model) +
      (lens?.exceedCount ?? 0) * 0.02;

    return {
      candidate,
      lens,
      directionCheck,
      residualRank: residualRankedIds.indexOf(candidate.id) + 1,
      directionRank: directionRankedIds.indexOf(candidate.id) + 1,
      score
    };
  });
  const recommendedIds = [...comparisonScored].sort((a, b) => a.score - b.score).map((item) => item.candidate.id);
  const candidateComparisonMatrix: SpatialFitCandidateComparison[] = comparisonScored.map(
    ({ candidate, lens, directionCheck, residualRank, directionRank }) => ({
      candidateId: candidate.id,
      candidateLabel: candidate.label,
      model: candidate.model,
      recommendedReviewOrder: recommendedIds.indexOf(candidate.id) + 1,
      residual: candidate.residual,
      residualRank,
      maxResidual: lens?.maxResidual ?? candidate.residual,
      exceedToleranceCount: lens?.exceedCount ?? 0,
      angularDeviationDeg: directionCheck?.angularDeviationDeg ?? 0,
      directionRank,
      complexity: spatialCandidateComplexity(candidate.model),
      teacherDecisionHint: spatialCandidateTeacherHint(candidate),
      selectionTradeoff: spatialCandidateTradeoff(candidate),
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: candidate.passed && directionCheck?.passed === true && lens?.reviewOnly === true
    })
  );
  const candidateSelectionImpactPreviews: SpatialCandidateSelectionImpactPreview[] = candidates.map((candidate) => {
    const rehearsal = teachingRehearsals.find((item) => item.selectedCandidateId === candidate.id);
    const constructionPlan = constructionPredictionPlans.find((item) => item.selectedCandidateId === candidate.id);
    const comparison = candidateComparisonMatrix.find((item) => item.candidateId === candidate.id);
    const conflictBoundaries = [
      ...(rehearsal?.conflictChecks ?? []),
      `候选取舍边界：${comparison?.selectionTradeoff ?? "老师还需要确认残差、方向和复杂度。"}`,
      "老师没有确认前，所有规则草稿都保持 disabled，不会自动影响未来命令。"
    ];
    const disabledRuleDrafts: SpatialCandidateSelectionImpactDraft[] = [
      {
        id: `impact-${candidate.id}-position-rule`,
        label: "位置画法规则草稿",
        draftType: "position_rule",
        draftText: rehearsal?.ruleDraft ?? `把 ${candidate.label} 暂存为位置画法候选。`,
        sourceEvidence:
          rehearsal?.evidence ??
          `候选 ${candidate.id} 残差 ${candidate.residual}m，仍需老师判断是否符合真实意图。`,
        willBeEnabled: false,
        teacherReviewRequired: true,
        conflictBoundary: conflictBoundaries[0]
      },
      {
        id: `impact-${candidate.id}-construction-rule`,
        label: "下一步构造规则草稿",
        draftType: "construction_rule",
        draftText:
          constructionPlan?.constructionSteps[1]?.generatedGeometry ??
          `沿 ${candidate.label} 的控制点生成下一段构造预演。`,
        sourceEvidence:
          constructionPlan?.evidence ?? `候选 ${candidate.id} 可以转成构造预测，但仍处于老师审查。`,
        willBeEnabled: false,
        teacherReviewRequired: true,
        conflictBoundary: conflictBoundaries[1]
      }
    ];
    const predictedSteps: SpatialCandidateSelectionImpactStep[] = [
      {
        id: `impact-${candidate.id}-step-compare`,
        order: 1,
        label: "先解释为什么选它",
        predictedAction: `展示 ${candidate.label} 的残差、方向偏差、复杂度和取舍说明。`,
        whyThisStep: "老师选候选前，AI 必须先把数学依据和工程取舍说清楚，不能只给一个看似最优的答案。",
        teacherCorrectionSlot: "老师可以说这个候选虽然残差低但工程语义不对，或者要求换成圆弧、样条、折线等模型。",
        nextStepPrediction: "下一步预测：如果老师认可候选，我会把它拆成位置规则草稿和构造规则草稿。",
        reviewState: "awaiting_teacher_review",
        passed: comparison?.passed === true
      },
      {
        id: `impact-${candidate.id}-step-draft`,
        order: 2,
        label: "生成 disabled 规则草稿",
        predictedAction: `生成 ${disabledRuleDrafts.length} 条待确认草稿，但 willBeEnabled=false。`,
        whyThisStep: "老师教过的知识要被记住，但确认技术合格前不能自动启用，尤其不能跨场景泛化。",
        teacherCorrectionSlot: "老师可以收窄条件、改锚点、改容差，或把当前候选标记为只适用于当前案例。",
        nextStepPrediction: "下一步预测：我会把草稿和旧知识做冲突边界比较。",
        reviewState: "awaiting_teacher_review",
        passed: disabledRuleDrafts.every((draft) => draft.willBeEnabled === false && draft.teacherReviewRequired)
      },
      {
        id: `impact-${candidate.id}-step-conflict`,
        order: 3,
        label: "回放旧知识冲突边界",
        predictedAction: `逐条检查 ${conflictBoundaries.length} 个冲突边界。`,
        whyThisStep: "人类最讨厌 AI 忘记前面教过的要求，所以新候选必须先和旧规则边界对齐。",
        teacherCorrectionSlot: "老师可以指出旧规则优先、新规则优先、两者适用场景不同，或者要求 AI 先请教。",
        nextStepPrediction: "下一步预测：如果发现冲突，我会先列差异并请老师裁决，不静默合并。",
        reviewState: "awaiting_teacher_review",
        passed: conflictBoundaries.length >= 3
      },
      {
        id: `impact-${candidate.id}-step-memory`,
        order: 4,
        label: "确认记忆策略和封装锁",
        predictedAction: "只预演保存到 /api/spatial-teaching-memories，autoApplies=false，requiresTeacherConfirmation=true。",
        whyThisStep: "当前目标仍是可视化学习合格性审查，不是封装、发布或包装交付。",
        teacherCorrectionSlot: "老师可以继续带教、否定候选、要求更多样本，或明确说明还不合格。",
        nextStepPrediction: "下一步预测：未来命中相似场景时，我会先展示命中理由和冲突边界，再请老师确认。",
        reviewState: "awaiting_teacher_review",
        passed:
          modelMemoryGate.autoApplies === false &&
          modelMemoryGate.accepted === false &&
          modelMemoryGate.packagingGated === true
      }
    ];

    const basePreview: Omit<
      SpatialCandidateSelectionImpactPreview,
      "correctionRehearsal" | "selectedSecondRoundPreview"
    > = {
      candidateId: candidate.id,
      candidateLabel: candidate.label,
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      selectionSummary: `如果老师选择 ${candidate.label}，AI 会先解释取舍，再生成 disabled 规则草稿、冲突边界和下一步构造预演。`,
      disabledRuleDrafts,
      conflictBoundaries,
      predictedSteps,
      memoryImpact: {
        mode: "disabled_rule_draft_preview",
        wouldCreateMemory: true,
        apiPath: "/api/spatial-teaching-memories",
        autoApplies: false,
        requiresTeacherConfirmation: true
      },
      teacherQuestion: `老师，如果你选择 ${candidate.label}，这些规则草稿、冲突边界和下一步预测是否符合你想教我的走法？`,
      blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
      passed:
        candidate.passed &&
        disabledRuleDrafts.length >= 2 &&
        predictedSteps.every((step) => step.passed && step.nextStepPrediction.includes("下一步预测"))
    };

    const correctionRehearsal = buildSpatialCandidateImpactCorrectionRehearsal({
      preview: basePreview
    });
    const selectedSecondRoundPreview = buildSpatialCandidateImpactSecondRoundSelectionPreview(
      correctionRehearsal.secondRoundCandidates[0]
    );

    return {
      ...basePreview,
      correctionRehearsal,
      selectedSecondRoundPreview
    };
  });

  return {
    status:
      candidates.length >= 3 &&
      candidates.every((candidate) => candidate.passed) &&
      extractedRules.every((rule) => rule.passed)
        ? "ready_for_teacher_review"
        : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    teachingInputMode: "code_first",
    codeTeachingProtocol: {
      ...protocol,
      example: spatialTeachingExampleJson()
    },
    coordinateFrame: {
      unit: "meter",
      axes: ["x", "y", "z"],
      origin: normalizePoint(input.frame.origin)
    },
    rawStroke,
    sampleCount: input.sampleCount ?? rawStroke.length,
    candidates,
    extractedRules,
    teachingRehearsals,
    coordinateDialogue: buildSpatialCoordinateDialoguePreview({
      rawCode: defaultSpatialCoordinateDialogueJson(candidates[0]?.id),
      rawStroke,
      candidates,
      selectedCandidateId: candidates[0]?.id
    }),
    guidedGenerationSteps,
    constructionPredictionPlans,
    batchPatternLearning,
    residualTeachingLenses,
    surfacePatchTeachingLens,
    directionToleranceChecks,
    candidateComparisonMatrix,
    candidateSelectionImpactPreviews,
    memoryPersistence: {
      ...modelMemoryGate
    },
    humanSelectionRequired: true,
    allowedActions: [
      "Inspect 3D fit candidates",
      "Select a candidate locally",
      "Preview candidate-to-rule rehearsal",
      "Rerun local verifier"
    ],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

export function isSpatialTeachingRuleRecord(rule: Pick<RuleRecord, "id" | "title" | "condition" | "action">) {
  return (
    rule.id.startsWith("spatial-teaching-rule-") ||
    rule.id.startsWith("spatial-construction-correction-rule-") ||
    rule.title.startsWith("三维带教待确认") ||
    rule.title.startsWith("三维构造纠正待确认") ||
    rule.condition.includes("三维代码带教")
  );
}

export function analyzeSpatialMemoryConflicts(args: {
  candidate: SpatialFitCandidate;
  rehearsal: SpatialTeachingRehearsal;
  existingRules: RuleRecord[];
}): SpatialMemoryConflictReport {
  const spatialRules = args.existingRules.filter(isSpatialTeachingRuleRecord);

  if (spatialRules.length === 0) {
    return {
      status: "no_prior_memory",
      comparedRuleIds: [],
      comparison: "当前没有旧的三维带教记忆，新规则可以先保存为待确认记忆。",
      teacherQuestion: "老师，这是第一条三维带教记忆。我会先暂停保存，等你确认后再允许未来应用，可以吗？",
      passed: true,
      evidence: "未发现旧三维记忆，因此没有新旧知识冲突。"
    };
  }

  const compatibleRules = spatialRules.filter((rule) => {
    const text = `${rule.title}\n${rule.condition}\n${rule.action}`;
    return text.includes(args.candidate.id) || text.includes(args.candidate.model) || text.includes(args.candidate.equation);
  });
  const conflictingRules = spatialRules.filter((rule) => !compatibleRules.includes(rule));

  if (conflictingRules.length === 0) {
    return {
      status: "compatible_with_prior_memory",
      comparedRuleIds: spatialRules.map((rule) => rule.id),
      comparison: `新候选 ${args.candidate.id} 与 ${compatibleRules.length} 条旧三维记忆指向同类模型或同一候选。`,
      teacherQuestion: "老师，我发现这条新规则和旧三维记忆看起来一致。你要把它作为同一规则的补充样本保留吗？",
      passed: true,
      evidence: "旧记忆中存在相同候选、模型或方程证据，暂未发现结构性冲突。"
    };
  }

  return {
    status: "conflict_requires_teacher",
    comparedRuleIds: spatialRules.map((rule) => rule.id),
    comparison: `新候选 ${args.candidate.id}/${args.candidate.model} 与 ${conflictingRules.length} 条旧三维记忆不一致，不能自动合并。`,
    teacherQuestion:
      "老师，我发现新教的画法和旧三维记忆不完全一致。是旧规则适用条件太宽，还是这次属于新的几何场景？我会先暂停，等你决定。",
    passed: true,
    evidence: conflictingRules.map((rule) => `${rule.title}: ${rule.condition}`).join(" | ")
  };
}

function analyzeSpatialConstructionCorrectionConflicts(args: {
  plan: SpatialConstructionPredictionPlan;
  existingRules: RuleRecord[];
}): SpatialMemoryConflictReport {
  const spatialRules = args.existingRules.filter(isSpatialTeachingRuleRecord);

  if (spatialRules.length === 0) {
    return {
      status: "no_prior_memory",
      comparedRuleIds: [],
      comparison: "当前没有旧的三维构造纠正记忆，可以先保存为待确认纠正。",
      teacherQuestion: "老师，这是第一条三维构造纠正。我会先暂停保存，未来遇到相似构造时先请你确认，可以吗？",
      passed: true,
      evidence: "未发现旧三维构造纠正记忆。"
    };
  }

  const compatibleRules = spatialRules.filter((rule) => {
    const text = `${rule.title}\n${rule.condition}\n${rule.action}`;
    return text.includes(args.plan.selectedCandidateId) || text.includes(args.plan.id);
  });

  if (compatibleRules.length > 0) {
    return {
      status: "compatible_with_prior_memory",
      comparedRuleIds: compatibleRules.map((rule) => rule.id),
      comparison: `构造计划 ${args.plan.id} 与 ${compatibleRules.length} 条旧三维记忆指向同一候选或同一计划。`,
      teacherQuestion: "老师，我发现这条纠正和旧三维记忆可能属于同一候选。你要把它作为旧规则的补充条件保留吗？",
      passed: true,
      evidence: compatibleRules.map((rule) => `${rule.title}: ${rule.condition}`).join(" | ")
    };
  }

  return {
    status: "conflict_requires_teacher",
    comparedRuleIds: spatialRules.map((rule) => rule.id),
    comparison: `构造计划 ${args.plan.id} 暂时无法和 ${spatialRules.length} 条旧三维记忆安全合并。`,
    teacherQuestion:
      "老师，我发现这条构造纠正和旧记忆不完全一致。是旧规则适用条件太宽，还是这次属于新的构造场景？我会先暂停，等你决定。",
    passed: true,
    evidence: spatialRules.map((rule) => `${rule.title}: ${rule.condition}`).join(" | ")
  };
}

export function buildSpatialConstructionRevisionCandidates(args: {
  plan: SpatialConstructionPredictionPlan;
  teacherCorrection: string;
  decision: SpatialConstructionCorrectionDecision;
}): SpatialConstructionRevisionCandidate[] {
  const correction = args.teacherCorrection.trim() || "老师还没有输入具体纠正，先只生成保守预览。";
  const anchors = args.plan.anchorPoints;
  const first = anchors[0] ?? { x: 0, y: 0, z: 0 };
  const last = anchors[anchors.length - 1] ?? addPoints(first, args.plan.offsetVector);
  const middle = anchors.length > 2 ? anchors[Math.floor(anchors.length / 2)] : mixPoints(first, last);
  const xOnlyLast = addPoints(first, { x: args.plan.offsetVector.x, y: 0, z: 0 });
  const softenedLast = {
    x: last.x,
    y: round(mixPoints(first, last, 0.5).y),
    z: round(first.z + (last.z - first.z) * 0.35)
  };
  const midpointAnchors = [
    first,
    {
      x: middle.x,
      y: round((first.y + last.y) / 2),
      z: round((first.z + last.z) / 2)
    },
    last
  ];
  const base = {
    sourcePlanId: args.plan.id,
    sourceDecision: args.decision,
    reviewState: "local_preview_waiting_teacher_selection" as const,
    accepted: false as const,
    packagingGated: true as const,
    passed: true
  };
  const buildCandidate = (
    id: string,
    label: string,
    revisedAnchorPoints: SpatialPoint3D[],
    geometryPatch: string,
    whyThisRevision: string,
    validationCheck: string,
    nextStepPrediction: string
  ): SpatialConstructionRevisionCandidate => ({
    ...base,
    id,
    label,
    revisedAnchorPoints,
    revisedOffsetVector: subtractPoints(revisedAnchorPoints[revisedAnchorPoints.length - 1], revisedAnchorPoints[0]),
    geometryPatch,
    whyThisRevision,
    validationCheck,
    teacherQuestion: `老师，我根据你的纠正“${correction}”重算了这个候选。它是不是更接近你想教我的构造画法？`,
    nextStepPrediction
  });

  if (args.decision === "revise_construction_order") {
    return [
      buildCandidate(
        `${args.plan.id}-revision-order-validate-first`,
        "先验证再生成",
        anchors,
        "把旧步骤改成：先锁定坐标系和旧记忆冲突，再生成几何线，最后询问老师是否保存。",
        "老师指出的是构造顺序问题，所以先不改几何，只重排验证和生成的先后关系。",
        "锚点和偏移向量保持不变；只有步骤顺序进入本地预览，不会写入正式规则。",
        "下一步预测：如果老师选中，我会把构造步骤改成验证优先，并继续让老师确认是否保存为 disabled 记忆。"
      ),
      buildCandidate(
        `${args.plan.id}-revision-order-anchor-before-offset`,
        "先锚点后偏移",
        anchors,
        "把构造拆成：确认起点/终点/折点，再确认偏移方向，最后生成工程线。",
        "这会让人类每一步都能纠正，适合工程画法里锚点比线条更重要的场景。",
        "每一步都保留 teacherCorrectionSlot；技术仍未验收，封装仍锁定。",
        "下一步预测：如果锚点被确认，我会再给出 2-3 个偏移方向候选让老师选。"
      ),
      buildCandidate(
        `${args.plan.id}-revision-order-stepwise-question`,
        "逐步请教模式",
        [first, middle, last],
        "把一次性构造改成三问：这个起点对吗、这个中间控制点对吗、这个终点对吗。",
        "像下棋一样先预测下一问，而不是一次性把后面全做完，方便老师随时打断。",
        "只生成本地预览问题序列；不保存、不启用、不合并旧记忆。",
        "下一步预测：老师回答第一个锚点后，我会重新拟合中间点和终点候选。"
      )
    ];
  }

  if (args.decision === "mark_prediction_conflict") {
    return [
      buildCandidate(
        `${args.plan.id}-revision-conflict-pause`,
        "暂停旧预测",
        anchors,
        "把当前构造标记为冲突样本，未来遇到相似几何先展示冲突原因。",
        "老师认为预测本身有冲突时，AI 应先尊重旧知识和新纠正之间的不确定性。",
        "规则保持 disabled；只增加冲突提示，不改变执行策略。",
        "下一步预测：我会先问这是旧规则适用条件太宽，还是这次属于新的几何场景。"
      ),
      buildCandidate(
        `${args.plan.id}-revision-conflict-refit`,
        "回到拟合候选重选",
        [first, middle, last],
        "放弃当前构造计划，回到最小二乘线、轴向线、折线候选之间重新选择。",
        "冲突可能来自一开始选错拟合模型，所以需要回到候选层，而不是继续修补后续构造。",
        "重选前不会保存长期记忆；老师确认后才允许保存 paused rule。",
        "下一步预测：我会展示多个拟合模型的残差、锚点和适用条件，让老师重新选。"
      ),
      buildCandidate(
        `${args.plan.id}-revision-conflict-scope`,
        "收窄适用条件",
        anchors,
        "保留当前几何，但把适用条件限制为当前坐标系、容差和老师指定场景。",
        "如果冲突来自规则太宽，就不要删掉新知识，而是先把它变成更窄的待确认规则。",
        "验证点：适用条件必须包含坐标系、容差、候选 id 和老师纠正摘要。",
        "下一步预测：如果老师确认，我会把这条知识保存成 disabled 规则，并要求未来命中时二次确认。"
      )
    ];
  }

  return [
    buildCandidate(
      `${args.plan.id}-revision-anchor-axis-stable`,
      "锚点吸附到主轴",
      [first, xOnlyLast],
      "把终点吸附到起点同一 y/z 平面，只保留 x 方向跨度。",
      "老师纠正锚点或偏移时，先给一个最保守的轴向候选，避免手绘抖动把线条抬高或偏移。",
      "新偏移向量只沿主跨度变化；这只是本地候选，不会覆盖原计划。",
      "下一步预测：如果老师选中，我会把 y/z 漂移写成需要确认的容差条件。"
    ),
    buildCandidate(
      `${args.plan.id}-revision-anchor-soft-z`,
      "降低 z 方向漂移",
      [first, softenedLast],
      "保留终点 x 跨度，但把 z 方向抬升压低到原来的 35%，同时收紧 y 偏移。",
      "人类手画时线条不直，AI 先拟合出更贴近“想表达但没画直”的温和修正版。",
      "新终点不会超过旧 z 漂移；需要老师确认它不是误删真实高度变化。",
      "下一步预测：如果老师觉得太平，我会继续生成保留高度变化的第三种候选。"
    ),
    buildCandidate(
      `${args.plan.id}-revision-anchor-midpoint`,
      "增加中间控制点",
      midpointAnchors,
      "保留起终点，并增加一个中间控制点，让线条可以表达轻微折线意图。",
      "如果老师的纠正不是单纯拉直，而是想保留局部转折，这个候选能比直线更容易被选中。",
      "中间点来自原锚点和端点的数学折中；不代表最终规则，只供老师选择。",
      "下一步预测：如果老师选中，我会继续问中间点应靠近哪一侧，并重新计算折线残差。"
    )
  ];
}

export function buildSpatialConstructionRevisionSelectionPreview(
  candidate: SpatialConstructionRevisionCandidate
): SpatialConstructionRevisionSelectionPreview {
  const codePatch: SpatialConstructionRevisionCodePatch = {
    sourcePlanId: candidate.sourcePlanId,
    revisionCandidateId: candidate.id,
    anchorPoints: candidate.revisedAnchorPoints,
    offsetVector: candidate.revisedOffsetVector,
    geometryPatch: candidate.geometryPatch,
    teacherReviewRequired: true as const,
    accepted: false as const,
    packagingGated: true as const
  };
  const guidedSteps: SpatialConstructionRevisionPreviewStep[] = [
    {
      id: `${candidate.id}-preview-read-selection`,
      order: 1,
      label: "读取老师选中的修正版候选",
      generatedDraft: `候选=${candidate.label}；锚点=${candidate.revisedAnchorPoints
        .map((point) => `(${point.x}, ${point.y}, ${point.z})`)
        .join(" -> ")}。`,
      whyThisStep: "先把老师选择的候选固定成结构化输入，避免 AI 忘记刚才人类选的是哪条修正版。",
      teacherCorrectionSlot: "老师可以立即改锚点、偏移向量，或者要求回到上一轮重新生成候选。",
      nextStepPrediction: "下一步预测：我会把这组锚点转成代码化构造补丁，但仍然只作为草稿。",
      reviewState: "awaiting_teacher_review",
      passed: candidate.revisedAnchorPoints.length >= 2
    },
    {
      id: `${candidate.id}-preview-code-patch`,
      order: 2,
      label: "生成代码化构造草稿",
      generatedDraft: JSON.stringify(codePatch, null, 2),
      whyThisStep: "你要求人类带教尽量用代码输入，所以这里把几何意图转成 JSON 草稿，而不是让 AI 反复识别图片。",
      teacherCorrectionSlot: "老师可以直接改 JSON 里的 anchorPoints、offsetVector 或 geometryPatch。",
      nextStepPrediction: "下一步预测：老师确认草稿后，我只会把它保存为 disabled 记忆，不会自动执行。",
      reviewState: "awaiting_teacher_review",
      passed: codePatch.teacherReviewRequired && codePatch.accepted === false && codePatch.packagingGated === true
    },
    {
      id: `${candidate.id}-preview-memory-gate`,
      order: 3,
      label: "检查记忆和封装闸门",
      generatedDraft: "当前修正版仍处于本地预演：accepted=false，packagingGated=true，teacherReviewRequired=true。",
      whyThisStep: "老师没有确认技术合格前，AI 只能学习和请教，不能把这一步当作正式能力推广。",
      teacherCorrectionSlot: "老师可以要求保存为待确认记忆、标记冲突，或继续生成下一批候选。",
      nextStepPrediction: "下一步预测：如果老师继续纠正，我会根据新纠正再次生成候选；如果老师保存，我会保留 disabled 规则。",
      reviewState: "awaiting_teacher_review",
      passed: true
    }
  ];

  return {
    id: `preview-${candidate.id}`,
    selectedRevisionCandidateId: candidate.id,
    codePatch,
    codePatchJson: JSON.stringify(codePatch, null, 2),
    guidedSteps,
    teacherQuestion: `老师，我已经按“${candidate.label}”生成了下一步代码化草稿。你要我沿着这个方向继续，还是继续改候选？`,
    accepted: false,
    packagingGated: true,
    passed: guidedSteps.every((step) => step.passed)
  };
}

export function parseSpatialConstructionCodePatch(raw: string): SpatialConstructionCodePatchValidation {
  try {
    const parsed = JSON.parse(raw) as Partial<SpatialConstructionRevisionCodePatch> & {
      accepted?: unknown;
      packagingGated?: unknown;
      teacherReviewRequired?: unknown;
    };
    const anchorPoints = parsed.anchorPoints?.map(normalizePoint) ?? [];
    const offsetVector = parsed.offsetVector ? normalizePoint(parsed.offsetVector) : null;

    if (typeof parsed.sourcePlanId !== "string" || parsed.sourcePlanId.trim().length === 0) {
      return {
        ok: false,
        error: "sourcePlanId 必须是非空字符串。",
        evidence: "老师的代码草稿缺少来源构造计划，AI 不能猜测它来自哪一步。",
        nextStepPrediction: "下一步预测：请补上 sourcePlanId 后，我再继续校验锚点和封装闸门。",
        accepted: false,
        packagingGated: true
      };
    }

    if (typeof parsed.revisionCandidateId !== "string" || parsed.revisionCandidateId.trim().length === 0) {
      return {
        ok: false,
        error: "revisionCandidateId 必须是非空字符串。",
        evidence: "老师的代码草稿缺少修正版候选 id，AI 不能把它合并到旧记忆。",
        nextStepPrediction: "下一步预测：请补上 revisionCandidateId 后，我再继续生成分步预演。",
        accepted: false,
        packagingGated: true
      };
    }

    if (anchorPoints.length < 2 || !anchorPoints.every(isFinitePoint)) {
      return {
        ok: false,
        error: "anchorPoints 至少需要两个有效三维点。",
        evidence: "三维构造必须有可计算锚点，缺失或非数字坐标都会让几何意图不可审查。",
        nextStepPrediction: "下一步预测：请用 [{ x, y, z }, ...] 补足锚点，我会重新计算偏移向量。",
        accepted: false,
        packagingGated: true
      };
    }

    if (!offsetVector || !isFinitePoint(offsetVector)) {
      return {
        ok: false,
        error: "offsetVector 必须是有效三维向量。",
        evidence: "偏移向量缺失时，AI 只能看到点，无法知道下一步构造方向。",
        nextStepPrediction: "下一步预测：请补上 offsetVector，或者让我根据首尾锚点重新计算。",
        accepted: false,
        packagingGated: true
      };
    }

    if (typeof parsed.geometryPatch !== "string" || parsed.geometryPatch.trim().length === 0) {
      return {
        ok: false,
        error: "geometryPatch 必须说明这次几何修正。",
        evidence: "老师的代码草稿需要保留人类意图说明，避免 AI 只记坐标而忘记画法原因。",
        nextStepPrediction: "下一步预测：请补上 geometryPatch，我会把它放进待审查预演说明。",
        accepted: false,
        packagingGated: true
      };
    }

    if (parsed.teacherReviewRequired !== true || parsed.accepted !== false || parsed.packagingGated !== true) {
      return {
        ok: false,
        error: "代码草稿必须保持 teacherReviewRequired=true、accepted=false、packagingGated=true。",
        evidence: "老师还没有确认技术合格前，任何代码化修正都只能处于审查状态。",
        nextStepPrediction: "下一步预测：请恢复审查闸门后，我才会继续预演，不会自动执行。",
        accepted: false,
        packagingGated: true
      };
    }

    const recomputedOffset = subtractPoints(anchorPoints[anchorPoints.length - 1], anchorPoints[0]);
    const offsetDelta = vectorLength(subtractPoints(offsetVector, recomputedOffset));

    return {
      ok: true,
      patch: {
        sourcePlanId: parsed.sourcePlanId,
        revisionCandidateId: parsed.revisionCandidateId,
        anchorPoints,
        offsetVector,
        geometryPatch: parsed.geometryPatch,
        teacherReviewRequired: true,
        accepted: false,
        packagingGated: true
      },
      evidence: `代码草稿可解析：${anchorPoints.length} 个锚点，偏移向量 (${offsetVector.x}, ${offsetVector.y}, ${offsetVector.z})，与首尾锚点重算差值 ${round(offsetDelta)}m。`,
      nextStepPrediction:
        offsetDelta <= 0.001
          ? "下一步预测：偏移向量和锚点一致，我会继续把它作为待确认构造预演。"
          : "下一步预测：偏移向量和首尾锚点不完全一致，我会先请老师确认是故意偏移还是需要重算。",
      accepted: false,
      packagingGated: true
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "JSON 解析失败。",
      evidence: "老师的代码草稿当前不是有效 JSON，AI 不会猜测或自动修复。",
      nextStepPrediction: "下一步预测：请先修正 JSON 格式，我再继续本地预演。",
      accepted: false,
      packagingGated: true
    };
  }
}

export function buildSpatialConstructionCorrectionDraft(args: {
  apprenticeId: string;
  taskId: string;
  plan: SpatialConstructionPredictionPlan;
  teacherCorrection: string;
  decision: SpatialConstructionCorrectionDecision;
  codePatch?: SpatialConstructionRevisionCodePatch;
  existingRules?: RuleRecord[];
  createdAt?: string;
}): SpatialConstructionCorrectionDraft {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const teacherCorrection = args.teacherCorrection.trim();
  const conflictReport = analyzeSpatialConstructionCorrectionConflicts({
    plan: args.plan,
    existingRules: args.existingRules ?? []
  });
  const decisionLabels: Record<SpatialConstructionCorrectionDecision, string> = {
    revise_anchor_points: "修正锚点或偏移",
    revise_construction_order: "修正构造顺序",
    mark_prediction_conflict: "标记构造预测冲突"
  };
  const revisionCandidates = buildSpatialConstructionRevisionCandidates({
    plan: args.plan,
    teacherCorrection,
    decision: args.decision
  });
  const rule: RuleRecord = {
    id: `spatial-construction-correction-rule-${args.plan.selectedCandidateId}-${Date.parse(createdAt) || Date.now()}`,
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    title: `三维构造纠正待确认：${args.plan.label}`,
    condition: `人类纠正了三维构造预测 ${args.plan.id}，候选为 ${args.plan.selectedCandidateId}，决策为 ${decisionLabels[args.decision]}。`,
    action: `未来遇到相似三维构造时，先展示原锚点 ${args.plan.anchorPoints
      .map((point) => `(${point.x}, ${point.y}, ${point.z})`)
      .join(" -> ")}、方向向量 (${args.plan.offsetVector.x}, ${args.plan.offsetVector.y}, ${args.plan.offsetVector.z}) 和老师纠正：“${teacherCorrection}”${
      args.codePatch
        ? `；同时展示老师编辑过的代码草稿锚点 ${args.codePatch.anchorPoints
            .map((point) => `(${point.x}, ${point.y}, ${point.z})`)
            .join(" -> ")}，几何补丁：“${args.codePatch.geometryPatch}”`
        : ""
    }，再请老师确认后继续。`,
    source: "manual",
    confidence: 0.82,
    enabled: false,
    createdAt
  };
  const learningTrace: LearningExtractionStep[] = [
    {
      id: "spatial-construction-read-teacher-correction",
      label: "读取老师构造纠正",
      evidence: teacherCorrection,
      confidence: 0.9,
      validation: "老师纠正只进入结构化学习记录，不会立即改写正式执行策略。",
      needsHumanReview: false
    },
    {
      id: "spatial-construction-compare-old-memory",
      label: "比较旧三维构造记忆",
      evidence: conflictReport.evidence,
      confidence: 0.82,
      validation: conflictReport.teacherQuestion,
      needsHumanReview: true
    },
    {
      id: "spatial-construction-save-paused-rule",
      label: "保存为待确认构造规则",
      evidence: `决策：${decisionLabels[args.decision]}；规则保持 disabled，未来命中相似构造时先请老师确认。`,
      confidence: 0.84,
      validation: "没有老师确认前，不自动启用、不确认技术合格、不解锁封装。",
      needsHumanReview: true
    }
  ];

  if (args.codePatch) {
    learningTrace.splice(2, 0, {
      id: "spatial-construction-save-teacher-code-patch",
      label: "保存老师编辑的 JSON 构造草稿",
      evidence: `代码草稿锚点 ${args.codePatch.anchorPoints
        .map((point) => `(${point.x}, ${point.y}, ${point.z})`)
        .join(" -> ")}；geometryPatch=${args.codePatch.geometryPatch}`,
      confidence: 0.88,
      validation: "代码草稿已校验 teacherReviewRequired=true、accepted=false、packagingGated=true，只能作为待确认记忆。",
      needsHumanReview: true
    });
  }

  return {
    rule,
    correctionRecord: {
      id: `spatial-construction-correction-${Date.parse(createdAt) || Date.now()}`,
      errorType: "spatial_construction_correction",
      userFeedback: teacherCorrection,
      extractedRule: rule,
      beforeOutput: {
        planId: args.plan.id,
        selectedCandidateId: args.plan.selectedCandidateId,
        anchorPoints: args.plan.anchorPoints,
        constructionStepIds: args.plan.constructionSteps.map((step) => step.id),
        comparedRuleIds: conflictReport.comparedRuleIds,
        conflictStatus: conflictReport.status
      },
      afterOutput: {
        decision: args.decision,
        revisionCandidateIds: revisionCandidates.map((candidate) => candidate.id),
        selectedCodePatch: args.codePatch,
        codePatchEvidence: args.codePatch
          ? `老师编辑 JSON 构造草稿已作为待确认记忆保存，锚点数=${args.codePatch.anchorPoints.length}。`
          : undefined,
        codePatchNextStepPrediction: args.codePatch
          ? "下一步预测：未来命中相似构造时，先展示这份代码草稿和旧规则冲突，再请老师确认。"
          : undefined,
        ruleEnabled: false,
        accepted: false,
        packagingGated: true
      },
      learningTrace,
      createdAt
    },
    revisionCandidates,
    conflictReport,
    memoryState: "paused_for_teacher_confirmation",
    accepted: false,
    packagingGated: true
  };
}

export function buildSpatialTeachingMemoryDraft(args: {
  apprenticeId: string;
  taskId: string;
  candidate: SpatialFitCandidate;
  rehearsal: SpatialTeachingRehearsal;
  existingRules?: RuleRecord[];
  createdAt?: string;
}): SpatialTeachingMemoryDraft {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const confidence = Math.min(0.95, Math.max(0.55, args.candidate.confidence));
  const conflictReport = analyzeSpatialMemoryConflicts({
    candidate: args.candidate,
    rehearsal: args.rehearsal,
    existingRules: args.existingRules ?? []
  });
  const rule: RuleRecord = {
    id: `spatial-teaching-rule-${args.rehearsal.selectedCandidateId}-${Date.parse(createdAt) || Date.now()}`,
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    title: `三维带教待确认：${args.candidate.label}`,
    condition: `人类在三维代码带教中选择候选 ${args.candidate.id}，模型类型为 ${args.candidate.model}，残差为 ${args.candidate.residual}m。`,
    action: args.rehearsal.ruleDraft,
    source: "manual",
    confidence,
    enabled: false,
    createdAt
  };

  return {
    rule,
    learningTrace: [
      {
        id: "spatial-read-human-selection",
        label: "读取人类选择",
        evidence: `人类选择了 ${args.candidate.label}。`,
        confidence,
        validation: "候选来自代码化三维点列和数学拟合，不依赖重复图片识别。",
        needsHumanReview: false
      },
      {
        id: "spatial-conflict-check",
        label: "检查旧知识冲突",
        evidence: `${args.rehearsal.conflictChecks.join(" / ")} | ${conflictReport.comparison}`,
        confidence: 0.82,
        validation: "保存为待确认记忆前，先保留冲突检查和请教人类的问题。",
        needsHumanReview: true
      },
      {
        id: "spatial-compare-old-memory",
        label: "比较新旧三维记忆",
        evidence: conflictReport.evidence,
        confidence: 0.78,
        validation: conflictReport.teacherQuestion,
        needsHumanReview: conflictReport.status === "conflict_requires_teacher"
      },
      {
        id: "spatial-save-paused-memory",
        label: "保存为待确认记忆",
        evidence: args.rehearsal.nextStepPrediction,
        confidence: 0.8,
        validation: "规则被写入长期记忆表，但保持 disabled，未来使用前仍需人类确认。",
        needsHumanReview: true
      }
    ],
    conflictReport,
    memoryState: "paused_for_teacher_confirmation",
    accepted: false,
    packagingGated: true
  };
}

export function buildSpatialTeachingMemoryDraftFromCode(args: {
  apprenticeId: string;
  taskId: string;
  teachingCode: string;
  selectedCandidateId: string;
  existingRules?: RuleRecord[];
  createdAt?: string;
}): SpatialTeachingMemoryDraftFromCodeResult {
  const parsed = parseSpatialTeachingInput(args.teachingCode);

  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
      evidence:
        "服务端没有信任前端候选对象，而是先解析老师输入的三维坐标代码；解析失败时不保存长期记忆。",
      accepted: false,
      packagingGated: true
    };
  }

  const model = buildCodeFirstSpatialTeachingModel(parsed.value);
  const candidate = model.candidates.find((item) => item.id === args.selectedCandidateId);

  if (!candidate) {
    return {
      ok: false,
      error: `没有找到候选 ${args.selectedCandidateId}，请先让 AI 重新根据当前坐标代码生成可选拟合。`,
      evidence:
        "服务端根据当前教学代码重新建模后，无法匹配老师选择的候选 id，因此拒绝保存，避免把过期或伪造的候选写入记忆。",
      accepted: false,
      packagingGated: true
    };
  }

  if (!candidate.teacherSelectable || !candidate.passed) {
    return {
      ok: false,
      error: `候选 ${candidate.label} 还没有达到可让老师选择的审查状态。`,
      evidence:
        "只有通过数学拟合校验、并显式标记为 teacherSelectable 的候选，才能进入待确认记忆草稿。",
      accepted: false,
      packagingGated: true
    };
  }

  const rehearsal = model.teachingRehearsals.find((item) => item.selectedCandidateId === candidate.id);

  if (!rehearsal) {
    return {
      ok: false,
      error: `候选 ${candidate.label} 缺少规则预演，请重新生成拟合候选。`,
      evidence:
        "服务端要求候选必须同时具备规则预演、冲突检查和下一步预测，不能只保存一段几何结果。",
      accepted: false,
      packagingGated: true
    };
  }

  const draft = buildSpatialTeachingMemoryDraft({
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    candidate,
    rehearsal,
    existingRules: args.existingRules,
    createdAt: args.createdAt
  });

  return {
    ok: true,
    model,
    candidate,
    rehearsal,
    draft,
    evidence: `服务端已从老师的坐标代码重新拟合 ${model.candidates.length} 个候选，并只把老师选中的 ${candidate.id} 转成 disabled 待确认记忆。`,
    accepted: false,
    packagingGated: true
  };
}

export function buildSpatialMemoryTeacherReviewRecord(args: {
  rule: RuleRecord;
  decision: SpatialMemoryTeacherReviewDecision;
  teacherNote: string;
  createdAt?: string;
}): SpatialMemoryTeacherReviewRecord {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const trimmedNote = args.teacherNote.trim();
  const decisionLabels: Record<SpatialMemoryTeacherReviewDecision, string> = {
    keep_paused: "继续暂停，等待更多带教证据",
    add_applicability_condition: "补充适用条件，未来匹配前先解释条件",
    mark_conflict_reason: "标记冲突原因，新旧知识不一致时先请教老师"
  };
  const reviewedRule: RuleRecord = {
    ...args.rule,
    enabled: false
  };

  return {
    id: `spatial-memory-review-${Date.parse(createdAt) || Date.now()}`,
    errorType: "spatial_memory_review",
    userFeedback: trimmedNote,
    extractedRule: reviewedRule,
    beforeOutput: {
      ruleId: args.rule.id,
      previousEnabled: false,
      reviewState: "paused_for_teacher_confirmation"
    },
    afterOutput: {
      decision: args.decision,
      teacherNote: trimmedNote,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true
    },
    learningTrace: [
      {
        id: "spatial-review-read-teacher-note",
        label: "读取老师审查备注",
        evidence: `${decisionLabels[args.decision]}：${trimmedNote}`,
        confidence: 0.92,
        validation: "老师备注只进入可追踪学习记录，不会把暂停规则自动启用。",
        needsHumanReview: false
      },
      {
        id: "spatial-review-compare-paused-memory",
        label: "比较暂停记忆和新审查判断",
        evidence: `被审查规则 ${args.rule.id} 仍保持 disabled；系统记录老师对适用条件、冲突原因或继续暂停的判断。`,
        confidence: 0.86,
        validation: "如果以后遇到相似三维场景，AI 必须先说明匹配理由、残差、约束和旧审查备注，再请求老师确认。",
        needsHumanReview: true
      },
      {
        id: "spatial-review-predict-next-step",
        label: "像下棋一样预测下一步",
        evidence: "AI 根据老师当前判断预测后续动作：先生成候选、解释为什么这样生成、暴露冲突点，然后等待老师纠正或确认。",
        confidence: 0.84,
        validation: "预测下一步是带教辅助，不是最终决策；没有老师确认前，不确认技术合格、不解锁封装。",
        needsHumanReview: true
      }
    ],
    ruleEnabled: false,
    accepted: false,
    packagingGated: true,
    createdAt
  };
}

export function buildSpatialCodePatchMatchReviewRecord(args: {
  rule: RuleRecord;
  match: SpatialCodePatchMatchReviewInput;
  decision: SpatialCodePatchMatchReviewDecision;
  teacherNote: string;
  createdAt?: string;
}): SpatialCodePatchMatchReviewRecord {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const trimmedNote = args.teacherNote.trim();
  const decisionLabels: Record<SpatialCodePatchMatchReviewDecision, string> = {
    use_as_reference: "作为参考继续预演",
    different_scene: "这是不同场景，不能沿用",
    tighten_applicability: "收窄旧代码草稿适用条件"
  };
  const reviewedRule: RuleRecord = {
    ...args.rule,
    enabled: false
  };

  return {
    id: `spatial-code-patch-match-review-${Date.parse(createdAt) || Date.now()}`,
    errorType: "spatial_code_patch_match_review",
    userFeedback: trimmedNote,
    extractedRule: reviewedRule,
    beforeOutput: {
      matchId: args.match.id,
      replayId: args.match.replayId,
      planId: args.match.planId,
      selectedCandidateId: args.match.selectedCandidateId,
      matchScore: args.match.matchScore,
      conflictChecks: args.match.conflictChecks
    },
    afterOutput: {
      decision: args.decision,
      teacherNote: trimmedNote,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true
    },
    learningTrace: [
      {
        id: "spatial-code-patch-match-read-teacher-review",
        label: "读取老师对旧代码草稿命中的判断",
        evidence: `${decisionLabels[args.decision]}：${trimmedNote}`,
        confidence: 0.92,
        validation: "老师的命中审查只进入学习记录，不启用旧规则，也不确认技术合格。",
        needsHumanReview: false
      },
      {
        id: "spatial-code-patch-match-compare-evidence",
        label: "比较旧草稿命中证据和冲突点",
        evidence: `${args.match.matchedReason}；冲突检查：${args.match.conflictChecks.join(" / ")}`,
        confidence: Math.max(0.55, Math.min(0.95, args.match.matchScore)),
        validation: args.match.teacherQuestion,
        needsHumanReview: true
      },
      {
        id: "spatial-code-patch-match-predict-next-step",
        label: "保存下一步请教策略",
        evidence: args.match.nextStepPrediction,
        confidence: 0.84,
        validation:
          "未来命中相似构造时，AI 必须先回放老师这次审查判断，再请老师确认；不自动套用旧 JSON 草稿。",
        needsHumanReview: true
      }
    ],
    ruleEnabled: false,
    accepted: false,
    packagingGated: true,
    createdAt
  };
}
