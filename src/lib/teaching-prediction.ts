export type DynamicTeachingPredictionInput = {
  teacherMove: string;
  inputMode: "domain_context" | "code_coordinate" | "candidate_selection" | "memory_conflict" | "durable_memory";
  knownRule?: string;
  selectedCandidateId?: string;
  context?: string;
};

export type DynamicTeachingPredictionCandidate = {
  id: string;
  label: string;
  predictedNextStep: string;
  whyThisPrediction: string;
  teacherCorrectionPoint: string;
  memoryEffect: string;
  conflictPolicy: string;
  confidence: number;
  reviewState: "awaiting_teacher_review";
  passed: boolean;
};

export type DynamicTeachingPredictionPreview = {
  status: "ready_for_teacher_review" | "needs_teacher_fix";
  metaphor: "chess_like_next_move_prediction";
  inputMode: "code_first_teaching_move";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  parsedInput: DynamicTeachingPredictionInput | null;
  candidates: DynamicTeachingPredictionCandidate[];
  recommendedCandidateId: string | null;
  teacherQuestion: string;
  error?: string;
  allowedActions: string[];
  blockedActions: string[];
};

const blockedActions = ["Accept technology", "Package", "Release", "Wrap"];

export function defaultDynamicTeachingPredictionJson() {
  return JSON.stringify(
    {
      teacherMove: "老师说：以后所有三维坐标带教都要先确认坐标系、单位和容差，再生成多个候选让我选。",
      inputMode: "code_coordinate",
      knownRule: "人类画的线可能不直，AI 要用数学拟合推断真实意图。",
      selectedCandidateId: "fit-axis-stabilized-line",
      context: "当前任务是工程三维坐标教学，老师希望 AI 像下棋一样先预测下一步再继续。"
    },
    null,
    2
  );
}

function parseDynamicTeachingPredictionInput(raw: string):
  | { ok: true; value: DynamicTeachingPredictionInput }
  | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as Partial<DynamicTeachingPredictionInput>;

    if (typeof parsed.teacherMove !== "string" || parsed.teacherMove.trim().length === 0) {
      return { ok: false, error: "teacherMove 必须写清楚老师刚教了什么。" };
    }

    const modes = ["domain_context", "code_coordinate", "candidate_selection", "memory_conflict", "durable_memory"];
    if (!parsed.inputMode || !modes.includes(parsed.inputMode)) {
      return {
        ok: false,
        error: "inputMode 必须是 domain_context、code_coordinate、candidate_selection、memory_conflict 或 durable_memory。"
      };
    }

    return {
      ok: true,
      value: {
        teacherMove: parsed.teacherMove.trim(),
        inputMode: parsed.inputMode,
        knownRule: parsed.knownRule?.trim(),
        selectedCandidateId: parsed.selectedCandidateId?.trim(),
        context: parsed.context?.trim()
      }
    };
  } catch {
    return { ok: false, error: "带教棋局输入必须是有效 JSON。" };
  }
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function confidenceFor(input: DynamicTeachingPredictionInput, kind: "next" | "conflict" | "memory") {
  const text = `${input.teacherMove}\n${input.knownRule ?? ""}\n${input.context ?? ""}`;
  let score = kind === "next" ? 0.76 : 0.7;

  if (input.selectedCandidateId) score += 0.07;
  if (includesAny(text, ["必须", "一定", "以后", "所有", "每次"])) score += 0.05;
  if (includesAny(text, ["坐标", "单位", "容差", "x", "y", "z", "三维"])) score += 0.05;
  if (kind === "conflict" && includesAny(text, ["冲突", "旧", "以前", "规则"])) score += 0.08;
  if (kind === "memory" && includesAny(text, ["记住", "长期", "以后", "所有"])) score += 0.08;

  return Math.min(0.94, Math.round(score * 100) / 100);
}

function nextStepByMode(input: DynamicTeachingPredictionInput) {
  const selected = input.selectedCandidateId ?? "当前老师选中的候选";

  if (input.inputMode === "domain_context") {
    return "先生成领域知识地图：坐标系、关键概念、约束、常见错误、验证门槛，并把每个节点列成老师可删改的审查点。";
  }

  if (input.inputMode === "code_coordinate") {
    return "先解析老师给的坐标/约束/容差代码，确认坐标系和单位，再生成多个拟合候选，不直接写入长期记忆。";
  }

  if (input.inputMode === "candidate_selection") {
    return `围绕 ${selected} 继续预演下一步构造：锚点、偏移向量、约束验证和失败时应该问老师的问题。`;
  }

  if (input.inputMode === "memory_conflict") {
    return "先把新教学和旧规则逐条比较，列出相同点、冲突点、适用范围差异，再虚心请老师决定是否收窄或替换旧记忆。";
  }

  return "先把老师确认过的知识整理成来源、条件、动作、冲突策略和下次请教问题，但保持 disabled，等老师确认后才允许未来命中。";
}

export function buildDynamicTeachingPredictionPreview(raw: string): DynamicTeachingPredictionPreview {
  const parsed = parseDynamicTeachingPredictionInput(raw);

  if (!parsed.ok) {
    return {
      status: "needs_teacher_fix",
      metaphor: "chess_like_next_move_prediction",
      inputMode: "code_first_teaching_move",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      parsedInput: null,
      candidates: [],
      recommendedCandidateId: null,
      teacherQuestion: "老师，这一手带教代码我还不能稳定解析。请先修正 JSON，我再继续预测下一步。",
      error: parsed.error,
      allowedActions: ["Edit teaching move JSON", "Preview again"],
      blockedActions
    };
  }

  const input = parsed.value;
  const baseNextStep = nextStepByMode(input);
  const candidates: DynamicTeachingPredictionCandidate[] = [
    {
      id: "predict-next-visible-step",
      label: "下一手：先公开预测再行动",
      predictedNextStep: baseNextStep,
      whyThisPrediction:
        "像下棋一样，AI 不能只给最终答案，而要先把下一步想怎么走展示出来，让老师能在错误刚出现时纠正。",
      teacherCorrectionPoint: "老师可以改下一步顺序、删掉不该学的节点，或要求 AI 先补证据再继续。",
      memoryEffect: "这一步只形成预演候选；accepted=false，packagingGated=true，不会解锁封装。",
      conflictPolicy: "如果这一步和旧知识不一致，先展示差异和适用范围，再请老师决定。",
      confidence: confidenceFor(input, "next"),
      reviewState: "awaiting_teacher_review",
      passed: true
    },
    {
      id: "predict-conflict-question",
      label: "下一手：检查旧记忆是否冲突",
      predictedNextStep: input.knownRule
        ? `把老师刚教的内容和旧规则“${input.knownRule}”比较，判断是补充、收窄还是冲突。`
        : "先查询是否有相似旧规则；没有足够证据时，主动问老师这是新领域还是旧规则补充。",
      whyThisPrediction: "人类最讨厌 AI 忘规则，也讨厌 AI 硬套旧规则；所以新旧知识必须先比较。",
      teacherCorrectionPoint: "老师可以告诉 AI：这是同一规则、不同场景、旧规则太宽，或这次应该覆盖旧规则。",
      memoryEffect: "只保存冲突审查记录，不自动启用新规则。",
      conflictPolicy: "无法安全合并时，AI 必须停下来请教老师，不能假装懂了。",
      confidence: confidenceFor(input, "conflict"),
      reviewState: "awaiting_teacher_review",
      passed: true
    },
    {
      id: "predict-paused-memory-draft",
      label: "下一手：生成待确认记忆草稿",
      predictedNextStep: "把这一手带教转成结构化草稿：触发条件、执行动作、例外情况、老师原话、下次命中时要先问什么。",
      whyThisPrediction: "真正牢牢记住不是把一句话塞进上下文，而是让未来命令能复用、能追溯、能暂停、能被老师改。",
      teacherCorrectionPoint: "老师可以改适用条件、增加反例、降低优先级，或要求暂时只作为案例不作为规则。",
      memoryEffect: "草稿保持 ruleEnabled=false，只有老师明确确认后才可能成为未来可用记忆。",
      conflictPolicy: "任何和旧记忆冲突的草稿都标记为需要老师审查。",
      confidence: confidenceFor(input, "memory"),
      reviewState: "awaiting_teacher_review",
      passed: true
    }
  ];

  return {
    status: "ready_for_teacher_review",
    metaphor: "chess_like_next_move_prediction",
    inputMode: "code_first_teaching_move",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    parsedInput: input,
    candidates,
    recommendedCandidateId: candidates[0].id,
    teacherQuestion: "老师，我先按这一手带教预测了三种下一步。你看我应该继续哪一步，或者哪里理解错了？",
    allowedActions: ["Edit teaching move JSON", "Review predicted next move", "Correct candidate"],
    blockedActions
  };
}
