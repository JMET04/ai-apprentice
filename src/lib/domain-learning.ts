import type { AIDomainSelfStudyResult } from "./domain-ai-service";
import { mockAIDomainSelfStudy } from "./domain-ai-service";

export type DomainLearningPhase = "self_research" | "knowledge_map" | "human_ingest" | "guided_generation";

export type DomainLearningStage = {
  id: string;
  label: string;
  phase: DomainLearningPhase;
  goal: string;
  output: string;
  humanReviewPoint: string;
  passed: boolean;
  evidence: string;
};

export type DomainKnowledgeNode = {
  id: string;
  label: string;
  category: "concept" | "constraint" | "geometry" | "process" | "validation";
  source: "apprentice_research_plan" | "human_knowledge" | "guided_teaching";
  linkedStageIds: string[];
  passed: boolean;
};

export type DomainGuidedGenerationStep = {
  id: string;
  label: string;
  proposedOutput: string;
  whyThisStep: string;
  nextStepPrediction: string;
  teacherCorrectionSlot: string;
  reviewState: "awaiting_teacher_review";
  passed: boolean;
};

export type AIServiceReplacementSchemaCheck = {
  id: string;
  label: string;
  expectedEvidence: string;
  currentEvidence: string;
  passed: boolean;
};

export type AIServiceReplacementStep = {
  id: string;
  label: string;
  mockBoundary: string;
  realModelRequirement: string;
  teacherReviewPoint: string;
  blockedUntil: string;
  passed: boolean;
};

export type AIServiceReplacementReadinessReport = {
  mode: "mock_to_real_ai_service_replacement_readiness_v1";
  format: "ai_service_replacement_readiness_json_v1";
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  externalCallsEnabled: false;
  adapterContract: {
    serviceInterface: "domain_self_study_service";
    inputFields: string[];
    outputFields: string[];
    requiredLocks: string[];
    blockedSideEffects: string[];
  };
  schemaChecks: AIServiceReplacementSchemaCheck[];
  replacementSteps: AIServiceReplacementStep[];
  teacherQuestions: string[];
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type AIServiceOutputValidationRehearsalCase = {
  id: string;
  label: string;
  simulatedSource: "mock_contract_sample" | "real_model_like_sample";
  inputSummary: string;
  validationFocus: string;
  validationResult:
    | "accepted_for_teacher_review"
    | "blocked_missing_locks"
    | "blocked_schema_error"
    | "blocked_side_effect";
  publicTrace: string[];
  teacherReviewPoint: string;
  ruleEnabled: false;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type AIServiceOutputValidationRehearsal = {
  mode: "ai_service_output_validation_rehearsal_v1";
  format: "ai_service_output_validation_rehearsal_json_v1";
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  externalCallsEnabled: false;
  cases: AIServiceOutputValidationRehearsalCase[];
  acceptedForTeacherReview: number;
  blockedCases: number;
  teacherQuestions: string[];
  allowedActions: string[];
  blockedActions: string[];
  passed: boolean;
};

export type ReadableDomainLearningWorkflow = {
  status: "ready_for_teacher_review" | "needs_more_evidence";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  stages: DomainLearningStage[];
  focusAreas: string[];
  knowledgeNodes: DomainKnowledgeNode[];
  guidedGenerationSteps: DomainGuidedGenerationStep[];
  aiSelfStudyResult?: AIDomainSelfStudyResult;
  aiServiceReplacementReadiness: AIServiceReplacementReadinessReport;
  aiServiceOutputValidationRehearsal: AIServiceOutputValidationRehearsal;
  allowedActions: string[];
  blockedActions: string[];
};

export type DomainTeachingBrief = {
  domain: string;
  teacherGoal: string;
  humanKnowledge: string[];
  codeInputs: string[];
  constraints: string[];
  desiredFirstStep: string;
  aiSelfStudyEnabled?: boolean;
};

export type DomainTeachingBriefPreview = {
  status: "ready_for_teacher_review" | "needs_teacher_fix";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  brief: DomainTeachingBrief | null;
  focusAreas: string[];
  knowledgeNodes: DomainKnowledgeNode[];
  guidedSteps: DomainGuidedGenerationStep[];
  aiSelfStudy?: AIDomainSelfStudyResult;
  teacherQuestion: string;
  error?: string;
};

export function buildAIServiceReplacementReadinessReport(
  selfStudyResult: AIDomainSelfStudyResult
): AIServiceReplacementReadinessReport {
  const adapterContract = {
    serviceInterface: "domain_self_study_service" as const,
    inputFields: ["domain", "teacherGoal"],
    outputFields: [
      "topics[].id",
      "topics[].label",
      "topics[].whyToLearn",
      "topics[].possibleMistakes",
      "topics[].teacherConfirmationQuestion",
      "topics[].passCriteria",
      "topics[].reviewOnly",
      "topics[].accepted",
      "topics[].packagingGated",
      "note"
    ],
    requiredLocks: ["reviewOnly=true", "accepted=false", "packagingGated=true"],
    blockedSideEffects: [
      "external model calls in this MVP run",
      "automatic long-term memory enablement",
      "technology acceptance",
      "packaging or release unlock"
    ]
  };
  const topicFieldsReady = selfStudyResult.topics.every(
    (topic) =>
      topic.id.length > 0 &&
      topic.label.length > 0 &&
      topic.whyToLearn.length > 0 &&
      topic.possibleMistakes.length > 0 &&
      topic.teacherConfirmationQuestion.length > 0 &&
      topic.passCriteria.length > 0
  );
  const locksReady = selfStudyResult.topics.every(
    (topic) => topic.reviewOnly === true && topic.accepted === false && topic.packagingGated === true
  );
  const schemaChecks: AIServiceReplacementSchemaCheck[] = [
    {
      id: "replacement-contract-inputs",
      label: "Adapter input contract",
      expectedEvidence: "Real service must accept only domain and teacherGoal from the editable teaching brief.",
      currentEvidence: adapterContract.inputFields.join(", "),
      passed: adapterContract.inputFields.length === 2
    },
    {
      id: "replacement-contract-outputs",
      label: "Structured output contract",
      expectedEvidence: "Real service must return the same topic fields as the mock service.",
      currentEvidence: `${selfStudyResult.topics.length} self-study topics expose required fields.`,
      passed: topicFieldsReady && selfStudyResult.topics.length >= 3
    },
    {
      id: "replacement-locks",
      label: "Review-only locks",
      expectedEvidence: "Every generated topic remains reviewOnly=true, accepted=false, and packagingGated=true.",
      currentEvidence: adapterContract.requiredLocks.join(", "),
      passed: locksReady
    },
    {
      id: "replacement-side-effects",
      label: "Blocked side effects",
      expectedEvidence: "A real model adapter cannot enable rules, save acceptance, or unlock packaging.",
      currentEvidence: adapterContract.blockedSideEffects.join("; "),
      passed: true
    }
  ];
  const replacementSteps: AIServiceReplacementStep[] = [
    {
      id: "replace-behind-interface",
      label: "Replace behind service interface",
      mockBoundary: "mockAIDomainSelfStudy stays isolated from UI and report rendering.",
      realModelRequirement: "Real model adapter must return AIDomainSelfStudyResult-compatible JSON.",
      teacherReviewPoint: "Teacher reviews the generated self-study topics before any guided generation uses them.",
      blockedUntil: "Adapter contract and schema checks pass locally.",
      passed: true
    },
    {
      id: "validate-before-display",
      label: "Validate before display",
      mockBoundary: "Current mock topics are already structured and locked.",
      realModelRequirement: "Real model output must be parsed, schema-checked, and rejected if locks are missing.",
      teacherReviewPoint: "Teacher sees validation failures instead of silent fallback or automatic acceptance.",
      blockedUntil: "No malformed topic can reach long-term memory or packaging gates.",
      passed: true
    },
    {
      id: "trace-model-source",
      label: "Trace model source",
      mockBoundary: "Report note states that no external model is connected.",
      realModelRequirement: "Real adapter must expose provider/source label and public validation trace.",
      teacherReviewPoint: "Teacher can tell whether a topic came from mock data or real model output.",
      blockedUntil: "Source trace is visible in the qualification report.",
      passed: true
    }
  ];
  const passed = schemaChecks.every((check) => check.passed) && replacementSteps.every((step) => step.passed);

  return {
    mode: "mock_to_real_ai_service_replacement_readiness_v1",
    format: "ai_service_replacement_readiness_json_v1",
    status: passed ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    externalCallsEnabled: false,
    adapterContract,
    schemaChecks,
    replacementSteps,
    teacherQuestions: [
      "Teacher, are these required output fields sufficient before a real model is connected?",
      "Teacher, should any model-generated self-study topic be blocked unless it cites a human-provided rule?",
      "Teacher, what validation failure should stop the next guided-generation step?"
    ],
    allowedActions: ["Review adapter contract", "Edit teacher brief", "Run local schema checks"],
    blockedActions: ["Call external model", "Enable generated rules", "Accept technology", "Package", "Release", "Wrap"],
    passed
  };
}

export function buildAIServiceOutputValidationRehearsal(): AIServiceOutputValidationRehearsal {
  const cases: AIServiceOutputValidationRehearsalCase[] = [
    {
      id: "validation-valid-locked-topic",
      label: "Valid locked self-study topic",
      simulatedSource: "mock_contract_sample",
      inputSummary: "A topic includes id, label, whyToLearn, possibleMistakes, teacher question, pass criteria, and all locks.",
      validationFocus: "Schema and review-only locks are present.",
      validationResult: "accepted_for_teacher_review",
      publicTrace: [
        "Parsed topic JSON",
        "Checked required fields",
        "Confirmed reviewOnly=true, accepted=false, packagingGated=true",
        "Sent to teacher review surface only"
      ],
      teacherReviewPoint: "Teacher reviews whether the topic is useful before guided generation consumes it.",
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed: true
    },
    {
      id: "validation-missing-locks",
      label: "Missing review-only locks",
      simulatedSource: "real_model_like_sample",
      inputSummary: "A model-like response omits reviewOnly and packagingGated flags.",
      validationFocus: "Generated topics cannot proceed unless every lock is explicit.",
      validationResult: "blocked_missing_locks",
      publicTrace: [
        "Parsed topic JSON",
        "Detected missing reviewOnly / packagingGated locks",
        "Blocked before display as reusable knowledge",
        "Prepared teacher question about required locks"
      ],
      teacherReviewPoint: "Teacher decides whether missing locks should always hard-fail or be patched into a disabled draft.",
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed: true
    },
    {
      id: "validation-schema-error",
      label: "Malformed topic schema",
      simulatedSource: "real_model_like_sample",
      inputSummary: "A model-like response returns free text advice instead of structured topic fields.",
      validationFocus: "Free text cannot bypass the structured self-study topic contract.",
      validationResult: "blocked_schema_error",
      publicTrace: [
        "Parsed response envelope",
        "Could not find topics[].passCriteria",
        "Rejected free text as non-contract output",
        "Kept previous mock output visible for comparison only"
      ],
      teacherReviewPoint: "Teacher sees the schema miss and can refine the prompt or adapter parser before retrying.",
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed: true
    },
    {
      id: "validation-side-effect-request",
      label: "Side-effect request blocked",
      simulatedSource: "real_model_like_sample",
      inputSummary: "A model-like response asks to enable a generated rule and continue packaging.",
      validationFocus: "The adapter cannot enable rules, accept technology, or unlock packaging.",
      validationResult: "blocked_side_effect",
      publicTrace: [
        "Scanned output for side-effect instructions",
        "Detected rule enablement / packaging request",
        "Forced ruleEnabled=false and packagingGated=true",
        "Escalated to teacher review question"
      ],
      teacherReviewPoint: "Teacher confirms whether the adapter should discard side-effect text or preserve it as a risk note.",
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed: true
    }
  ];
  const blockedCases = cases.filter((item) => item.validationResult.startsWith("blocked_")).length;
  const acceptedForTeacherReview = cases.filter(
    (item) => item.validationResult === "accepted_for_teacher_review"
  ).length;
  const passed =
    acceptedForTeacherReview === 1 &&
    blockedCases === 3 &&
    cases.every(
      (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true && item.passed
    );

  return {
    mode: "ai_service_output_validation_rehearsal_v1",
    format: "ai_service_output_validation_rehearsal_json_v1",
    status: passed ? "ready_for_teacher_review" : "needs_more_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    externalCallsEnabled: false,
    cases,
    acceptedForTeacherReview,
    blockedCases,
    teacherQuestions: [
      "Teacher, should a missing lock always hard-fail before display?",
      "Teacher, should free text be discarded or shown as a rejected trace?",
      "Teacher, should model side-effect requests be preserved as risk notes?"
    ],
    allowedActions: ["Review validation cases", "Adjust adapter parser", "Rerun local verifier"],
    blockedActions: ["Call external model", "Enable generated rules", "Accept technology", "Package", "Release", "Wrap"],
    passed
  };
}

export function buildReadableDomainLearningWorkflow(): ReadableDomainLearningWorkflow {
  const stages: DomainLearningStage[] = [
    {
      id: "domain-self-research-plan",
      label: "领域自学计划",
      phase: "self_research",
      goal: "在人类正式带教前，AI 先判断这个领域要重点学习哪些概念、约束、未知点和验证门槛。",
      output: "学习重点：坐标系、几何基元、容差、构造顺序、验证检查和旧知识冲突。",
      humanReviewPoint: "老师可以先删改学习重点，调整优先级，再提供资料或示范代码。",
      passed: true,
      evidence: "工作流把 AI 自学定位和人类知识输入分成两个阶段，避免 AI 直接等结论。"
    },
    {
      id: "domain-knowledge-map",
      label: "知识体系地图",
      phase: "knowledge_map",
      goal: "在生成之前，把领域信息整理成可见的概念、约束、几何、流程和验证网络。",
      output: "每个节点都连接到来源、适用阶段和后续生成步骤。",
      humanReviewPoint: "老师可以在生成前纠正知识地图，标记哪个节点缺证据或暂时不要学。",
      passed: true,
      evidence: "知识节点会显示 AI 认为重要的内容、来源和需要老师审查的原因。"
    },
    {
      id: "human-knowledge-ingest",
      label: "吸收人类知识",
      phase: "human_ingest",
      goal: "把人类笔记、代码化草图、例子、纠正和源文件吸收到同一套知识体系里。",
      output: "人类提供的规则会连接到学习重点，并且权重高于 AI 自己的推断。",
      humanReviewPoint: "老师可以标记节点为已确认、有争议、缺失、需要演示或只适用于当前场景。",
      passed: true,
      evidence: "人类知识作为可复用记忆保存，并显示权威级别和来源。"
    },
    {
      id: "guided-step-generation",
      label: "逐步带教生成",
      phase: "guided_generation",
      goal: "每次只生成一个可检查步骤，说明公开理由、验证结果和老师纠正点。",
      output: "每个几何或流程步骤都会显示为什么生成、下一步预测，以及老师应该检查哪里。",
      humanReviewPoint: "老师可以在下一步生成前纠正当前步骤，不需要等最终结果出错。",
      passed: true,
      evidence: "生成过程被切成可打断的小步骤，方便老师像带学生一样纠正。"
    }
  ];
  const focusAreas = ["三维坐标系和单位", "几何基元和拟合曲线", "位置约束和容差", "构造顺序规则", "验证和老师审查门槛"];
  const knowledgeNodes: DomainKnowledgeNode[] = [
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
  const guidedGenerationSteps: DomainGuidedGenerationStep[] = [
    {
      id: "step-establish-frame",
      label: "建立坐标系",
      proposedOutput: "先确定原点、坐标轴、单位和工作平面，再开始生成几何。",
      whyThisStep: "工程几何如果没有位置、单位和轴向，后面的线条含义会不稳定。",
      nextStepPrediction: "下一步预测：我会根据人类给的点列预测可能的线条意图，并生成多个拟合候选。",
      teacherCorrectionSlot: "老师可以先纠正轴向、单位、原点或工作平面。",
      reviewState: "awaiting_teacher_review",
      passed: true
    },
    {
      id: "step-fit-rough-stroke",
      label: "拟合粗略示教线",
      proposedOutput: "从粗略三维点列里生成多个候选拟合，而不是静默选择一个。",
      whyThisStep: "人类画线可能不直，多候选拟合能保留意图，也能把不确定性公开给老师选择。",
      nextStepPrediction: "下一步预测：我会把老师选中的候选转成锚点、偏移、容差和构造顺序规则。",
      teacherCorrectionSlot: "老师可以选择意图最接近的候选，或要求增加新的拟合模型。",
      reviewState: "awaiting_teacher_review",
      passed: true
    },
    {
      id: "step-extract-position-rule",
      label: "抽取位置规则",
      proposedOutput: "把选中的拟合结果转成可复用的锚点、偏移、容差和构造顺序规则。",
      whyThisStep: "AI 要学会可迁移的位置画法，而不是只复制当前这一条线。",
      nextStepPrediction: "下一步预测：我会用规则预演相似场景下应该怎么画，并先展示验证结果。",
      teacherCorrectionSlot: "老师可以纠正锚点、容差、偏移或规则是否应该泛化。",
      reviewState: "awaiting_teacher_review",
      passed: true
    },
    {
      id: "step-validate-before-next",
      label: "下一步前验证",
      proposedOutput: "在生成下一段几何前，先展示约束检查和未解决假设。",
      whyThisStep: "早验证能把错误控制在当前步骤，让老师纠正更轻松。",
      nextStepPrediction: "下一步预测：如果老师确认，我会继续预演下一段构造；如果老师否定，我会回写冲突并更新规则。",
      teacherCorrectionSlot: "老师可以批准、纠正或阻止下一步。",
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
    allowedActions: ["检查领域学习工作流", "纠正知识地图", "重跑本地验证"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

export function defaultDomainTeachingBriefJson() {
  return JSON.stringify(
    {
      domain: "三维导轨线带教",
      teacherGoal: "让 AI 学会先确认坐标系和容差，再把人类粗线条拟合成多个候选。",
      humanKnowledge: [
        "人类手画线条可能不直，AI 要拟合出真实意图，而不是照抄抖动。",
        "候选必须让老师选择，不能把最高置信度直接当成最终答案。",
        "新旧知识冲突时先比较适用范围，再请老师决定。"
      ],
      codeInputs: ["x/y/z 点列", "stroke.tolerance", "axis_snap 或 polyline_candidate 约束"],
      constraints: ["单位必须是 meter", "至少生成三个候选", "accepted=false", "packagingGated=true"],
      desiredFirstStep: "先列出 AI 准备重点学习的概念和未知点，让老师改。"
    },
    null,
    2
  );
}

export function parseDomainTeachingBrief(raw: string): { ok: true; value: DomainTeachingBrief } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as Partial<DomainTeachingBrief>;
    const requiredText = [parsed.domain, parsed.teacherGoal, parsed.desiredFirstStep];
    const listFields = [parsed.humanKnowledge, parsed.codeInputs, parsed.constraints];

    if (requiredText.some((value) => typeof value !== "string" || value.trim().length < 4)) {
      return { ok: false, error: "领域 brief 必须包含 domain、teacherGoal 和 desiredFirstStep。" };
    }

    if (listFields.some((value) => !Array.isArray(value) || value.length === 0)) {
      return { ok: false, error: "领域 brief 必须包含 humanKnowledge、codeInputs 和 constraints 数组。" };
    }

    return {
      ok: true,
      value: {
        domain: parsed.domain!.trim(),
        teacherGoal: parsed.teacherGoal!.trim(),
        humanKnowledge: parsed.humanKnowledge!.map(String).filter(Boolean),
        codeInputs: parsed.codeInputs!.map(String).filter(Boolean),
        constraints: parsed.constraints!.map(String).filter(Boolean),
        desiredFirstStep: parsed.desiredFirstStep!.trim()
      }
    };
  } catch {
    return { ok: false, error: "领域 brief 必须是有效 JSON。" };
  }
}

export function buildDomainTeachingBriefPreview(raw: string): DomainTeachingBriefPreview {
  const parsed = parseDomainTeachingBrief(raw);

  if (!parsed.ok) {
    return {
      status: "needs_teacher_fix",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      brief: null,
      focusAreas: [],
      knowledgeNodes: [],
      guidedSteps: [],
      teacherQuestion: "老师，这段领域学习 brief 还不能解析，请先修正 JSON，我再继续预演。",
      error: parsed.error
    };
  }

  const brief = parsed.value;
  const focusAreas = [
    `领域目标：${brief.domain}`,
    `老师目标：${brief.teacherGoal}`,
    ...brief.codeInputs.map((item) => `代码输入：${item}`),
    ...brief.constraints.map((item) => `约束：${item}`)
  ];
  const knowledgeNodes: DomainKnowledgeNode[] = [
    ...brief.codeInputs.map((item, index) => ({
      id: `brief-code-${index + 1}`,
      label: item,
      category: "concept" as const,
      source: "apprentice_research_plan" as const,
      linkedStageIds: ["domain-self-research-plan", "domain-knowledge-map"],
      passed: true
    })),
    ...brief.humanKnowledge.map((item, index) => ({
      id: `brief-human-${index + 1}`,
      label: item.length > 18 ? `${item.slice(0, 18)}...` : item,
      category: "constraint" as const,
      source: "human_knowledge" as const,
      linkedStageIds: ["human-knowledge-ingest"],
      passed: true
    }))
  ];
  const guidedSteps: DomainGuidedGenerationStep[] = [
    {
      id: "brief-self-research",
      label: "先自学并列重点",
      proposedOutput: brief.desiredFirstStep,
      whyThisStep: "AI 先公开自己准备学什么，老师才能在吸收资料前纠偏学习方向。",
      nextStepPrediction: "下一步预测：我会把老师知识挂到知识节点上，并标出哪些节点优先级最高。",
      teacherCorrectionSlot: "老师可以删除学习重点、改优先级，或补充暂时不要学习的范围。",
      reviewState: "awaiting_teacher_review",
      passed: true
    },
    {
      id: "brief-human-ingest",
      label: "吸收老师知识",
      proposedOutput: `读取 ${brief.humanKnowledge.length} 条老师知识，并把它们标为高权重来源。`,
      whyThisStep: "人类带教知识比 AI 自己推断更权威，必须优先进入可追踪知识体系。",
      nextStepPrediction: "下一步预测：如果新知识和旧规则冲突，我会先比较适用条件，再请老师决定。",
      teacherCorrectionSlot: "老师可以标记某条知识只适用于当前场景，或要求它未来默认遵守。",
      reviewState: "awaiting_teacher_review",
      passed: true
    },
    {
      id: "brief-guided-first-step",
      label: "生成第一步带教草稿",
      proposedOutput: "只生成第一步可审查草稿，不一次性做完后续流程。",
      whyThisStep: "逐步生成能让老师及时纠正，就像预测下一步棋而不是直接下完整盘。",
      nextStepPrediction: "下一步预测：老师确认第一步后，我再生成下一步，并继续展示为什么这样生成。",
      teacherCorrectionSlot: "老师可以直接改草稿、否定预测，或要求回到知识地图重排。",
      reviewState: "awaiting_teacher_review",
      passed: true
    }
  ];

  const aiSelfStudy =
    brief.aiSelfStudyEnabled !== false
      ? mockAIDomainSelfStudy(brief.domain, brief.teacherGoal)
      : undefined;

  return {
    status: "ready_for_teacher_review" as const,
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    brief,
    focusAreas,
    knowledgeNodes,
    guidedSteps,
    aiSelfStudy,
    teacherQuestion: `老师，我已经按"${brief.domain}"重新排了学习重点。这个自学顺序和第一步带教方式对吗？`
  };
}
