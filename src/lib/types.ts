export type NodeKind =
  | "input"
  | "understand"
  | "decision"
  | "execute"
  | "check"
  | "human_review"
  | "output";

export type WorkflowNodeDefinition = {
  id: string;
  type: NodeKind;
  label: string;
  description: string;
  inputFields: string[];
  outputFields: string[];
  validationRules: string[];
  fallbackBehavior: string;
  position: { x: number; y: number };
};

export type WorkflowEdgeDefinition = {
  id: string;
  source: string;
  target: string;
};

export type RuleRecord = {
  id: string;
  apprenticeId: string;
  taskId: string;
  title: string;
  condition: string;
  action: string;
  source: "seed" | "correction" | "manual";
  confidence: number;
  enabled: boolean;
  createdAt: string;
};

export type TraceStepRecord = {
  id: string;
  nodeId: string;
  stepName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  appliedRules: Pick<RuleRecord, "id" | "title" | "condition" | "action">[];
  confidence: number;
  needsHumanReview: boolean;
  validation: string;
  uncertainty: string[];
};

export type RuleEvaluationRecord = {
  ruleId: string;
  title: string;
  enabled: boolean;
  matched: boolean;
  matchedCues: string[];
  counterCues: string[];
  counterEvidenceSources: string[];
  decision: "applied" | "conflicted" | "counterexample" | "disabled" | "not_matched";
  reason: string;
  memorySource: "seed" | "correction" | "manual" | "visual_demonstration";
  ruleConfidence: number;
  ruleCondition: string;
  ruleAction: string;
  evidencePath: Array<{
    label: string;
    evidence: string;
    confidence: number;
  }>;
};

export type TraceNodeIds = Partial<Record<NodeKind, string>>;

export type ExecutionOutput = {
  location: string;
  weather: string;
  subjects: string[];
  lightingCondition: string;
  recommendedTitles: string[];
  journalBody: string;
  photographyAdvice: string[];
};

export type ExecutionRunRecord = {
  id: string;
  taskId: string;
  apprenticeId: string;
  input: string;
  output: ExecutionOutput;
  status: "completed" | "needs_review";
  trace: TraceStepRecord[];
  createdAt: string;
};

export type CorrectionExtraction = {
  errorType: string;
  errorReason: string;
  condition: string;
  action: string;
  extractedRule: RuleRecord;
  applyAutomatically: boolean;
  requiresHumanConfirmation: boolean;
  learningTrace: LearningExtractionStep[];
};

export type MemoryApplicationPolicy = {
  applyAutomatically: boolean;
  requiresHumanConfirmation: boolean;
};

export type LearningExtractionStep = {
  id: string;
  label: string;
  evidence: string;
  confidence: number;
  validation: string;
  needsHumanReview: boolean;
};

export type StructuredFeedbackRecord = {
  field: string;
  correctedValue: string;
  conditionCue: string;
  note?: string;
};

export type TeachingExampleRecord = {
  id: string;
  apprenticeId: string;
  taskId: string;
  input: string;
  expectedOutput: Record<string, unknown>;
  extractedRule?: RuleRecord | null;
  learningTrace?: LearningExtractionStep[];
  createdAt: string;
};

export type VisualCueAnnotation = {
  id: string;
  label: string;
  cue: string;
  evidence: string;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
};

export type VisualDemonstrationArtifact = {
  referenceImageUrl?: string;
  sceneDescription: string;
  visualCues: string[];
  lightingSignals: string[];
  expectedPhotographyAdvice: string[];
  annotations?: VisualCueAnnotation[];
};

export type VisualDemonstrationRecord = {
  id: string;
  apprenticeId: string;
  taskId: string;
  title: string;
  artifact: VisualDemonstrationArtifact;
  teacherNotes: string;
  extractedRule?: RuleRecord | null;
  learningTrace?: LearningExtractionStep[];
  createdAt: string;
};
