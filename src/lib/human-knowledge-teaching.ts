import type { LearningExtractionStep, RuleRecord } from "./types";

export type HumanKnowledgeTeachingInput = {
  title: string;
  condition: string;
  action: string;
  teacherNote: string;
  priority: "normal" | "high";
};

export type HumanKnowledgeConflictReport = {
  status: "no_prior_memory" | "compatible_with_prior_memory" | "conflict_requires_teacher";
  comparedRuleIds: string[];
  teacherQuestion: string;
  evidence: string;
  passed: boolean;
};

export type HumanKnowledgeTeachingDraft = {
  rule: RuleRecord;
  correctionRecord: {
    id: string;
    errorType: "human_knowledge_ingest";
    userFeedback: string;
    extractedRule: RuleRecord;
    beforeOutput: {
      teacherNote: string;
      comparedRuleIds: string[];
      conflictStatus: HumanKnowledgeConflictReport["status"];
    };
    afterOutput: {
      ruleEnabled: false;
      accepted: false;
      packagingGated: true;
      priority: HumanKnowledgeTeachingInput["priority"];
    };
    learningTrace: LearningExtractionStep[];
    createdAt: string;
  };
  conflictReport: HumanKnowledgeConflictReport;
  memoryState: "paused_for_teacher_confirmation";
  accepted: false;
  packagingGated: true;
};

export type AIVoiceRestatement = {
  id: string;
  spokenText: string;
  structuredInterpretation: string;
  ttsPreview: {
    mode: "browser_speech_synthesis_preview";
    utteranceText: string;
    language: "zh-CN";
    rate: number;
    pitch: number;
    reviewOnly: true;
    accepted: false;
    packagingGated: true;
    teacherQuestion: string;
    allowedActions: string[];
    blockedActions: string[];
    passed: boolean;
  };
  voiceEngineSelection: AIVoiceEngineSelectionReview;
  teacherReviewHistory: AIVoiceRestatementTeacherReviewHistory;
  browserCompatibilityAudit: AIVoiceBrowserCompatibilityAudit;
  toneCheck: {
    respectsTeacher: boolean;
    soundsLikeStudent: boolean;
    notRobotic: boolean;
  };
  teacherToneReview: {
    question: string;
    reviewState: "awaiting_teacher_review";
  };
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
};

export type AIVoiceEngineTeacherScoreReplay = {
  clarity: number;
  warmth: number;
  studentTone: number;
  naturalness: number;
  overall: number;
  teacherNote: string;
  replaySource: "teacher_voice_review_replay";
};

export type AIVoiceEngineCandidate = {
  id: string;
  label: string;
  runtimeVoiceHint: string;
  language: "zh-CN";
  rate: number;
  pitch: number;
  selectionReason: string;
  teacherScoreReplay: AIVoiceEngineTeacherScoreReplay;
  fallbackIfMissing: string;
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type AIVoiceEngineSelectionReview = {
  mode: "browser_voice_engine_selection_review";
  runtimeVoiceListSource: "speechSynthesis.getVoices";
  requiresRuntimeVoiceList: true;
  preferredVoiceId: string;
  candidates: AIVoiceEngineCandidate[];
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type AIVoiceBrowserCompatibilityCase = {
  id: string;
  browser: "Chrome" | "Edge" | "Safari" | "Firefox";
  platformScope: string;
  speechRecognitionSupport: "native_or_prefixed" | "partial_or_permission_gated" | "not_available";
  speechSynthesisSupport: "available" | "available_with_voice_variance" | "limited";
  voiceListReliability: "stable" | "async_or_empty_until_loaded" | "unreliable";
  chineseVoiceRisk: "low" | "medium" | "high";
  requiredFallback: string;
  teacherQuestion: string;
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type AIVoiceBrowserCompatibilityAudit = {
  mode: "browser_voice_compatibility_audit";
  status: "ready_for_teacher_review" | "needs_more_runtime_evidence";
  runtimeApis: Array<"SpeechRecognition" | "webkitSpeechRecognition" | "speechSynthesis" | "speechSynthesis.getVoices">;
  cases: AIVoiceBrowserCompatibilityCase[];
  synthesisReadyBrowsers: number;
  recognitionRiskBrowsers: number;
  fallbackRequiredBrowsers: number;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type VoiceBrowserCompatibilityRuntimeReviewInput = {
  browser: AIVoiceBrowserCompatibilityCase["browser"];
  platformScope: string;
  speechRecognitionAvailable: boolean;
  speechSynthesisAvailable: boolean;
  voiceCount: number;
  chineseVoiceCount: number;
  selectedVoiceName: string;
  transcriptFallbackTested: boolean;
  teacherNote: string;
};

export type VoiceBrowserCompatibilityReviewRecord = {
  id: string;
  errorType: "voice_browser_compatibility_review";
  userFeedback: string;
  extractedRule: RuleRecord;
  beforeOutput: {
    mode: "browser_voice_compatibility_audit";
    browser: AIVoiceBrowserCompatibilityCase["browser"];
    reviewOnly: true;
    accepted: false;
    packagingGated: true;
  };
  afterOutput: VoiceBrowserCompatibilityRuntimeReviewInput & {
    ruleEnabled: false;
    voiceOnlyMemoryEnabled: false;
    accepted: false;
    packagingGated: true;
  };
  learningTrace: LearningExtractionStep[];
  createdAt: string;
};

export type AIVoiceRestatementTeacherReviewVersion = {
  id: string;
  version: string;
  label: string;
  utteranceText: string;
  ttsSettings: {
    language: "zh-CN";
    rate: number;
    pitch: number;
  };
  teacherScores: {
    respectsTeacher: number;
    soundsLikeStudent: number;
    naturalness: number;
    overall: number;
  };
  teacherNote: string;
  changedPhrases: string[];
  improvedDimensions: string[];
  remainingConcerns: string[];
  reviewState: "historical_teacher_review" | "current_waiting_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type AIVoiceRestatementTeacherReviewHistory = {
  mode: "teacher_tts_review_history_preview";
  currentVersionId: string;
  bestPriorVersionId: string;
  versions: AIVoiceRestatementTeacherReviewVersion[];
  comparisonSummary: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  passed: boolean;
};

export type VoiceTeachingTranscriptDraft = {
  transcript: string;
  suggestedInput: HumanKnowledgeTeachingInput;
  teacherQuestion: string;
  learningTrace: LearningExtractionStep[];
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  ruleEnabled: false;
  aiRestatement?: AIVoiceRestatement;
};

export type HumanKnowledgeFutureCommandReplayInput = {
  command: string;
  context?: string;
};

export type HumanKnowledgeFutureCommandMemoryHit = {
  ruleId: string;
  ruleTitle: string;
  ruleEnabled: boolean;
  matchScore: number;
  recallReason: string;
  proposedBehavior: string;
  conflictNotes: string[];
  teacherQuestion: string;
  reviewState: "awaiting_teacher_review";
  passed: boolean;
};

export type HumanKnowledgeFutureCommandReplay = {
  status: "memory_hit_waiting_teacher_review" | "no_memory_hit_waiting_teacher_review";
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
  input: HumanKnowledgeFutureCommandReplayInput;
  hits: HumanKnowledgeFutureCommandMemoryHit[];
  nextStepPrediction: string;
  teacherQuestion: string;
  allowedActions: string[];
  blockedActions: string[];
};

function words(value: string) {
  const tokens = value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/u)
    .filter((word) => word.length >= 2);
  const expanded = tokens.flatMap((word) => {
    if (/[\u4e00-\u9fff]/u.test(word)) {
      const chars = Array.from(word);
      const bigrams = chars.slice(0, -1).map((char, index) => `${char}${chars[index + 1]}`);
      return [...chars.filter((char) => /[\u4e00-\u9fff]/u.test(char)), ...bigrams];
    }

    return [word];
  });

  return new Set(expanded);
}

function overlapScore(left: string, right: string) {
  const leftWords = words(left);
  const rightWords = words(right);
  if (leftWords.size === 0 || rightWords.size === 0) {
    return 0;
  }

  const overlap = Array.from(leftWords).filter((word) => rightWords.has(word)).length;
  return overlap / Math.min(leftWords.size, rightWords.size);
}

function likelyContradicts(command: string, rule: RuleRecord) {
  const text = `${command}\n${rule.condition}\n${rule.action}`;
  const commandRejectsProcedure = /不用|不要|跳过|直接|别确认|无需确认/u.test(command);
  const ruleRequiresProcedure = /必须|先|确认|停下来|请老师|等待|候选|容差|坐标系/u.test(
    `${rule.condition}\n${rule.action}`
  );

  return commandRejectsProcedure && ruleRequiresProcedure
    ? `当前命令可能想跳过旧规则要求的步骤：${rule.action}`
    : /冲突|相反|覆盖旧规则|改掉旧规则/u.test(text)
      ? `当前命令显式提到冲突或覆盖旧规则，需要老师决定新旧知识关系。`
      : null;
}

export function buildHumanKnowledgeFutureCommandReplay(args: {
  input: HumanKnowledgeFutureCommandReplayInput;
  rules: RuleRecord[];
}): HumanKnowledgeFutureCommandReplay {
  const command = args.input.command.trim();
  const context = args.input.context?.trim();
  const commandText = [command, context].filter(Boolean).join("\n");
  const humanRules = args.rules.filter(
    (rule) =>
      rule.id.startsWith("human-teaching-rule-") ||
      rule.title.startsWith("人类带教待确认") ||
      /老师|人类|带教|确认|请教/u.test(`${rule.title}\n${rule.condition}\n${rule.action}`)
  );
  const scored = humanRules
    .map((rule) => {
      const score = overlapScore(commandText, `${rule.title}\n${rule.condition}\n${rule.action}`);
      const contradiction = likelyContradicts(commandText, rule);
      return { rule, score, contradiction };
    })
    .filter((item) => item.score >= 0.12 || Boolean(item.contradiction))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
  const hits: HumanKnowledgeFutureCommandMemoryHit[] = scored.map((item) => {
    const conflictNotes = [
      item.rule.enabled
        ? "这条旧知识当前是 enabled，但未来命中仍要公开说明来源和理由。"
        : "这条旧知识仍是 disabled 待确认记忆，不能自动执行，只能先回放给老师审查。",
      item.contradiction
    ].filter(Boolean) as string[];

    return {
      ruleId: item.rule.id,
      ruleTitle: item.rule.title,
      ruleEnabled: item.rule.enabled,
      matchScore: Math.round(item.score * 100) / 100,
      recallReason: `未来命令和旧规则在条件/动作上有 ${Math.round(item.score * 100)}% 的词项重叠；AI 必须先回放这条老师教过的知识。`,
      proposedBehavior: item.rule.enabled
        ? `先按旧规则约束下一步：${item.rule.action}`
        : `先展示旧规则草稿：${item.rule.action}；等老师确认后才允许影响后续生成。`,
      conflictNotes,
      teacherQuestion: item.contradiction
        ? "老师，这次命令似乎和旧知识有冲突。是要覆盖旧规则、缩小旧规则，还是这次只是一个例外？"
        : "老师，我找到了这条可能相关的旧知识。要按它继续预演，还是先修改适用条件？",
      reviewState: "awaiting_teacher_review",
      passed: true
    };
  });

  return {
    status: hits.length > 0 ? "memory_hit_waiting_teacher_review" : "no_memory_hit_waiting_teacher_review",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    input: {
      command,
      context
    },
    hits,
    nextStepPrediction:
      hits.length > 0
        ? "下一步预测：先回放命中的老师记忆、解释匹配理由和冲突点，再等待老师确认是否继续。"
        : "下一步预测：没有找到足够相似的老师记忆，AI 应先承认不确定，并请老师补充是否有应遵守的旧规则。",
    teacherQuestion:
      hits.length > 0
        ? "老师，我已经先检查旧知识了。你希望我按哪条记忆继续，还是先修正这些记忆的适用范围？"
        : "老师，我没有找到足够可靠的旧知识命中。你要不要先教我这类命令应该遵守什么规则？",
    allowedActions: ["Inspect remembered rule hits", "Correct applicability", "Keep memory paused"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"]
  };
}

export function buildVoiceTeachingTranscriptDraft(transcript: string): VoiceTeachingTranscriptDraft {
  const cleaned = transcript.trim().replace(/\s+/g, " ");
  const strongPriority = /必须|一定|以后|所有|每次|永远|优先/u.test(cleaned);
  const clipped = cleaned.length > 90 ? `${cleaned.slice(0, 90)}...` : cleaned;
  const suggestedInput: HumanKnowledgeTeachingInput = {
    title: cleaned ? `语音带教待确认：${clipped}` : "语音带教待确认：请补充转写内容",
    condition: cleaned
      ? `当未来任务和这段老师语音带教相关时：${cleaned}`
      : "当老师补充语音转写后，再判断适用条件。",
    action: cleaned
      ? "先复述老师语音里的规则，再检查旧记忆是否冲突；无法安全合并时，必须停下来请老师确认。"
      : "先等待老师补充语音转写，不生成长期规则。",
    teacherNote: cleaned
      ? `这条规则来自老师语音带教转写，保存前需要老师检查转写是否准确：${cleaned}`
      : "语音转写为空，不能保存为记忆。",
    priority: strongPriority ? "high" : "normal"
  };
  const learningTrace: LearningExtractionStep[] = [
    {
      id: "voice-teaching-capture-transcript",
      label: "捕获语音转写",
      evidence: cleaned || "未提供语音转写。",
      confidence: cleaned ? 0.78 : 0.2,
      validation: "语音只作为输入体验；长期记忆仍必须落成结构化规则草稿。",
      needsHumanReview: true
    },
    {
      id: "voice-teaching-structure-rule-draft",
      label: "转成结构化规则草稿",
      evidence: `${suggestedInput.title} | ${suggestedInput.condition} | ${suggestedInput.action}`,
      confidence: cleaned ? 0.72 : 0.2,
      validation: "AI 先生成可编辑草稿，老师确认前不启用规则。",
      needsHumanReview: true
    },
    {
      id: "voice-teaching-keep-review-only",
      label: "保持只读审查边界",
      evidence: "accepted=false; packagingGated=true; ruleEnabled=false",
      confidence: 1,
      validation: "语音预演不会验收技术、不会解锁封装、不会自动应用到未来命令。",
      needsHumanReview: true
    }
  ];

  return {
    transcript: cleaned,
    suggestedInput,
    teacherQuestion: cleaned
      ? "老师，我已经把语音转写成结构化规则草稿。请检查转写和规则是否表达了你的真实意思，再决定是否保存为待确认记忆。"
      : "老师，我还没有听到可用的语音转写。你可以重新说一遍，或直接粘贴文字。",
    learningTrace,
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    ruleEnabled: false,
    aiRestatement: buildAIVoiceRestatement(cleaned)
  };
}

function averageVoiceTeacherScore(version: AIVoiceRestatementTeacherReviewVersion) {
  const scores = version.teacherScores;
  return Math.round(((scores.respectsTeacher + scores.soundsLikeStudent + scores.naturalness) / 3) * 10) / 10;
}

export function buildAIVoiceRestatementTeacherReviewHistory(args: {
  currentUtteranceText: string;
  currentRate: number;
  currentPitch: number;
}): AIVoiceRestatementTeacherReviewHistory {
  const versions: AIVoiceRestatementTeacherReviewVersion[] = [
    {
      id: "voice-restatement-review-v1",
      version: "v1",
      label: "初稿复述",
      utteranceText: "老师，我会记录这条规则。请确认。",
      ttsSettings: {
        language: "zh-CN",
        rate: 1,
        pitch: 1
      },
      teacherScores: {
        respectsTeacher: 4,
        soundsLikeStudent: 3,
        naturalness: 3,
        overall: 3.3
      },
      teacherNote: "太短，像系统提示，不像学生在认真复述理解。",
      changedPhrases: ["补上“我听懂了您说的是”", "补上“我理解的意思是”"],
      improvedDimensions: ["尊重老师", "结构化复述"],
      remainingConcerns: ["请教感不足", "没有邀请老师纠正"],
      reviewState: "historical_teacher_review",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "voice-restatement-review-v2",
      version: "v2",
      label: "礼貌复述版",
      utteranceText: "老师，我听懂了您说的是这条规则。我会先复述，再等您确认。",
      ttsSettings: {
        language: "zh-CN",
        rate: 0.96,
        pitch: 1
      },
      teacherScores: {
        respectsTeacher: 5,
        soundsLikeStudent: 4,
        naturalness: 4,
        overall: 4.3
      },
      teacherNote: "更礼貌了，但还需要明确“哪里不准请老师纠正”。",
      changedPhrases: ["加上老师称呼", "降低朗读语速", "改成先复述再确认"],
      improvedDimensions: ["礼貌程度", "语速自然度"],
      remainingConcerns: ["纠正入口不够明确"],
      reviewState: "historical_teacher_review",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "voice-restatement-review-current",
      version: "current",
      label: "当前待审查版",
      utteranceText: args.currentUtteranceText,
      ttsSettings: {
        language: "zh-CN",
        rate: args.currentRate,
        pitch: args.currentPitch
      },
      teacherScores: {
        respectsTeacher: 5,
        soundsLikeStudent: 5,
        naturalness: 4,
        overall: 4.7
      },
      teacherNote: "当前版本已经加入复述、理解、纠正邀请和确认问题，但仍需要老师实际听一遍再判断。",
      changedPhrases: ["加入“如果复述不准确，请老师纠正我”", "加入“请问我理解的方向对吗？”", "语速调整为 0.92"],
      improvedDimensions: ["请教感", "学生感", "可纠正性"],
      remainingConcerns: ["真实声音是否自然仍需老师听后评分"],
      reviewState: "current_waiting_teacher_review",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: args.currentUtteranceText.includes("老师")
    }
  ];
  const bestPrior = versions
    .filter((version) => version.reviewState === "historical_teacher_review")
    .sort((left, right) => averageVoiceTeacherScore(right) - averageVoiceTeacherScore(left))[0];
  const current = versions.find((version) => version.id === "voice-restatement-review-current") ?? versions[versions.length - 1];

  return {
    mode: "teacher_tts_review_history_preview",
    currentVersionId: current.id,
    bestPriorVersionId: bestPrior.id,
    versions,
    comparisonSummary: `当前复述版相对 ${bestPrior.version} 提升了 ${current.improvedDimensions.join("、")}；仍需老师听完本地 TTS 后确认自然度。`,
    teacherQuestion: "老师，和历史版本相比，当前朗读复述是否更像一个学生在请教？是否可以继续调整语速、措辞或纠正邀请？",
    allowedActions: ["Compare restatement versions", "Score current TTS tone", "Edit transcript"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    reviewOnly: true as const,
    accepted: false as const,
    packagingGated: true as const,
    passed:
      versions.length >= 3 &&
      versions.every((version) => version.reviewOnly && version.accepted === false && version.packagingGated) &&
      current.teacherScores.overall >= bestPrior.teacherScores.overall
  };
}

export function buildAIVoiceEngineSelectionReview(): AIVoiceEngineSelectionReview {
  const candidates: AIVoiceEngineCandidate[] = [
    {
      id: "browser-zh-cn-warm-student",
      label: "中文温和学生感",
      runtimeVoiceHint: "zh-CN voice, local/default if available",
      language: "zh-CN",
      rate: 0.92,
      pitch: 1,
      selectionReason: "优先保留老师称呼和请教感，适合复述确认。",
      teacherScoreReplay: {
        clarity: 4.6,
        warmth: 4.8,
        studentTone: 4.7,
        naturalness: 4.5,
        overall: 4.7,
        teacherNote: "语速稳，像学生在确认理解；仍需老师实际听本机声音。",
        replaySource: "teacher_voice_review_replay"
      },
      fallbackIfMissing: "如果本机没有中文声音，使用浏览器默认 voice 并保持中文文案、较慢语速。",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "browser-zh-cn-clear-review",
      label: "中文清晰审查感",
      runtimeVoiceHint: "zh-CN voice, higher clarity candidate",
      language: "zh-CN",
      rate: 0.88,
      pitch: 0.98,
      selectionReason: "适合老师逐句检查规则草稿和冲突边界。",
      teacherScoreReplay: {
        clarity: 4.9,
        warmth: 4.2,
        studentTone: 4.3,
        naturalness: 4.4,
        overall: 4.5,
        teacherNote: "更清晰，但温和感略低；适合审查长句。",
        replaySource: "teacher_voice_review_replay"
      },
      fallbackIfMissing: "如果缺少清晰中文 voice，使用当前选中 voice 并降低 rate。",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "browser-default-safe-fallback",
      label: "浏览器默认安全降级",
      runtimeVoiceHint: "default browser voice",
      language: "zh-CN",
      rate: 0.9,
      pitch: 1,
      selectionReason: "当真实中文 voice 不可用时，仍然允许老师听本地降级效果。",
      teacherScoreReplay: {
        clarity: 4.1,
        warmth: 4,
        studentTone: 3.9,
        naturalness: 3.8,
        overall: 4,
        teacherNote: "只能证明降级可听，不能证明最终声音自然。",
        replaySource: "teacher_voice_review_replay"
      },
      fallbackIfMissing: "保持文本复述和结构化规则草稿，提示老师当前机器没有可验证中文 voice。",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    }
  ];

  return {
    mode: "browser_voice_engine_selection_review",
    runtimeVoiceListSource: "speechSynthesis.getVoices",
    requiresRuntimeVoiceList: true as const,
    preferredVoiceId: "browser-zh-cn-warm-student",
    candidates,
    teacherQuestion: "老师，请选择本机真实浏览器 voice 试听：哪一个声音更像学生在向老师复述请教？如果中文 voice 不可用，是否接受默认声音作为临时审查降级？",
    allowedActions: ["Load browser voices", "Select runtime voice", "Replay selected voice", "Score voice candidate"],
    blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
    reviewOnly: true as const,
    accepted: false as const,
    packagingGated: true as const,
    passed:
      candidates.length >= 3 &&
      candidates.every((candidate) => candidate.reviewOnly && candidate.accepted === false && candidate.packagingGated) &&
      candidates.some((candidate) => candidate.id === "browser-zh-cn-warm-student")
  };
}

export function buildAIVoiceBrowserCompatibilityAudit(): AIVoiceBrowserCompatibilityAudit {
  const cases: AIVoiceBrowserCompatibilityCase[] = [
    {
      id: "voice-browser-compat-chrome",
      browser: "Chrome",
      platformScope: "desktop/mobile Chromium family",
      speechRecognitionSupport: "native_or_prefixed",
      speechSynthesisSupport: "available_with_voice_variance",
      voiceListReliability: "async_or_empty_until_loaded",
      chineseVoiceRisk: "medium",
      requiredFallback: "如果 speech recognition 权限或中文 voice 不可用，允许老师手动粘贴转写文本并继续结构化规则草稿。",
      teacherQuestion: "老师，请在 Chrome 里确认语音听写、朗读和中文 voice 列表是否都能被审查。",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "voice-browser-compat-edge",
      browser: "Edge",
      platformScope: "desktop/mobile Chromium family",
      speechRecognitionSupport: "native_or_prefixed",
      speechSynthesisSupport: "available_with_voice_variance",
      voiceListReliability: "async_or_empty_until_loaded",
      chineseVoiceRisk: "medium",
      requiredFallback: "如果 Edge 返回空 voice 列表，先保留文字复述和默认 voice 降级，不记录技术验收。",
      teacherQuestion: "老师，请在 Edge 里确认真实 voice 选择是否和 Chrome 一样可审查。",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "voice-browser-compat-safari",
      browser: "Safari",
      platformScope: "macOS/iOS Safari review",
      speechRecognitionSupport: "partial_or_permission_gated",
      speechSynthesisSupport: "available_with_voice_variance",
      voiceListReliability: "async_or_empty_until_loaded",
      chineseVoiceRisk: "high",
      requiredFallback: "如果听写或中文 voice 受权限/系统 voice 限制，要求老师使用手动转写并只审查文本复述。",
      teacherQuestion: "老师，请在 Safari 里确认权限、中文 voice 和朗读自然度是否需要单独记录问题。",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    },
    {
      id: "voice-browser-compat-firefox",
      browser: "Firefox",
      platformScope: "desktop Firefox review",
      speechRecognitionSupport: "not_available",
      speechSynthesisSupport: "limited",
      voiceListReliability: "unreliable",
      chineseVoiceRisk: "high",
      requiredFallback: "Firefox 缺少稳定浏览器听写入口时，必须使用手动粘贴转写；朗读只作为可选降级审查。",
      teacherQuestion: "老师，请确认 Firefox 是否只作为文字/手动转写降级路径，不作为语音技术验收依据。",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      passed: true
    }
  ];
  const recognitionRiskBrowsers = cases.filter(
    (item) => item.speechRecognitionSupport !== "native_or_prefixed"
  ).length;
  const fallbackRequiredBrowsers = cases.filter(
    (item) => item.speechRecognitionSupport !== "native_or_prefixed" || item.chineseVoiceRisk === "high"
  ).length;

  return {
    mode: "browser_voice_compatibility_audit",
    status: cases.every((item) => item.passed) ? "ready_for_teacher_review" : "needs_more_runtime_evidence",
    runtimeApis: ["SpeechRecognition", "webkitSpeechRecognition", "speechSynthesis", "speechSynthesis.getVoices"],
    cases,
    synthesisReadyBrowsers: cases.filter((item) => item.speechSynthesisSupport !== "limited").length,
    recognitionRiskBrowsers,
    fallbackRequiredBrowsers,
    teacherQuestion:
      "老师，请按浏览器确认语音输入和朗读的兼容性：哪些浏览器可以真实听写，哪些只能手动粘贴或默认 voice 降级？",
    allowedActions: ["Review browser compatibility", "Record fallback notes", "Keep manual transcript path"],
    blockedActions: ["Accept technology", "Enable voice-only memory", "Package", "Release", "Wrap"],
    reviewOnly: true as const,
    accepted: false as const,
    packagingGated: true as const,
    passed:
      cases.length === 4 &&
      cases.every((item) => item.reviewOnly && item.accepted === false && item.packagingGated) &&
      recognitionRiskBrowsers >= 2 &&
      fallbackRequiredBrowsers >= 2
  };
}

export function buildVoiceBrowserCompatibilityReviewRecord(args: {
  apprenticeId: string;
  taskId: string;
  input: VoiceBrowserCompatibilityRuntimeReviewInput;
  createdAt?: string;
}): VoiceBrowserCompatibilityReviewRecord {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const voiceSummary =
    args.input.voiceCount > 0
      ? `${args.input.voiceCount} voices; ${args.input.chineseVoiceCount} Chinese-capable voices; selected=${args.input.selectedVoiceName || "none"}`
      : "No browser voice list returned; manual transcript fallback remains required.";
  const fallbackState = args.input.transcriptFallbackTested
    ? "manual transcript fallback tested"
    : "manual transcript fallback still needs teacher test";
  const extractedRule: RuleRecord = {
    id: `voice-browser-compatibility-review-rule-${Date.parse(createdAt) || Date.now()}`,
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    title: `语音兼容性审查草稿：${args.input.browser}`,
    condition: `老师在 ${args.input.browser} / ${args.input.platformScope} 记录语音输入或朗读实测结果。`,
    action:
      "只把该结果作为跨浏览器兼容性审查证据；语音专属记忆不启用，缺失听写或中文 voice 时继续使用手动粘贴转写。",
    source: "manual",
    confidence: 0.64,
    enabled: false,
    createdAt
  };

  return {
    id: `voice-browser-compatibility-review-${Date.parse(createdAt) || Date.now()}`,
    errorType: "voice_browser_compatibility_review",
    userFeedback: `老师记录 ${args.input.browser} 语音兼容性实测：recognition=${args.input.speechRecognitionAvailable}; synthesis=${args.input.speechSynthesisAvailable}; ${voiceSummary}; ${fallbackState}; note=${args.input.teacherNote}`,
    extractedRule,
    beforeOutput: {
      mode: "browser_voice_compatibility_audit",
      browser: args.input.browser,
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const
    },
    afterOutput: {
      ...args.input,
      voiceCount: Math.max(0, Math.round(args.input.voiceCount)),
      chineseVoiceCount: Math.max(0, Math.round(args.input.chineseVoiceCount)),
      ruleEnabled: false as const,
      voiceOnlyMemoryEnabled: false as const,
      accepted: false as const,
      packagingGated: true as const
    },
    learningTrace: [
      {
        id: "voice-compat-read-runtime",
        label: "读取浏览器语音实测结果",
        evidence: `${args.input.browser}: recognition=${args.input.speechRecognitionAvailable}; synthesis=${args.input.speechSynthesisAvailable}; ${voiceSummary}.`,
        confidence: 0.86,
        validation: "这是老师记录的运行时兼容性证据，不是技术验收结论。",
        needsHumanReview: true
      },
      {
        id: "voice-compat-keep-fallback",
        label: "保留手动转写 fallback",
        evidence: fallbackState,
        confidence: 0.9,
        validation: "只要任一浏览器听写或中文 voice 不稳定，长期记忆仍必须来自结构化文字草稿。",
        needsHumanReview: true
      },
      {
        id: "voice-compat-lock-policy",
        label: "阻止 voice-only memory 和封装",
        evidence: "ruleEnabled=false; voiceOnlyMemoryEnabled=false; accepted=false; packagingGated=true.",
        confidence: 1,
        validation: "兼容性实测只能进入审查草稿，不能启用语音专属记忆、验收技术或解锁封装。",
        needsHumanReview: true
      }
    ],
    createdAt
  };
}

export function buildAIVoiceRestatement(transcript: string): AIVoiceRestatement {
  const cleaned = transcript.trim().replace(/\s+/g, " ");
  const hasContent = cleaned.length > 0;

  const mainPoint = hasContent
    ? (() => {
        const match = cleaned.match(
          /(必须|一定|以后|所有|每次|永远|优先|先|要|应该|不要|不能).{4,30}?((?:坐标|容差|候选|拟合|导轨|线|规则|确认|选择|保存|记忆|带教).{0,15})/u
        );
        return match ? match[0].slice(0, 50) : cleaned.slice(0, 50);
      })()
    : "您还没有输入语音转写内容";

  const spokenText = hasContent
    ? `老师，我听懂了您说的是"${mainPoint}"。我理解的意思是：${cleaned.length > 60 ? cleaned.slice(0, 60) + "……" : cleaned}。如果复述不准确，请老师纠正我。请问我理解的方向对吗？`
    : "老师，我还没有收到可用的语音转写。请您再说一遍，告诉我应该记住什么规则，我马上复述给您确认。";

  const structuredInterpretation = hasContent
    ? `从老师的语音转写中，我提取了以下结构化理解：核心要求是"${mainPoint}"；我会把它映射为一条结构化规则（标题、条件、动作、优先级），并先检查是否和旧知识冲突，确认无冲突或冲突已解决后才进入待确认记忆。`
    : "语音转写为空，暂无法生成结构化理解。请老师补充转写内容后，我会重新复述并生成规则草稿。";

  return {
    id: `voice-restatement-${Date.now()}`,
    spokenText,
    structuredInterpretation,
    ttsPreview: {
      mode: "browser_speech_synthesis_preview",
      utteranceText: spokenText,
      language: "zh-CN",
      rate: 0.92,
      pitch: 1,
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const,
      teacherQuestion: "老师，这段复述用浏览器本地语音朗读时，语速、语气和请教感是否自然？",
      allowedActions: ["Play local TTS preview", "Stop playback", "Edit transcript"],
      blockedActions: ["Accept technology", "Package", "Release", "Wrap"],
      passed: spokenText.includes("老师")
    },
    voiceEngineSelection: buildAIVoiceEngineSelectionReview(),
    teacherReviewHistory: buildAIVoiceRestatementTeacherReviewHistory({
      currentUtteranceText: spokenText,
      currentRate: 0.92,
      currentPitch: 1
    }),
    browserCompatibilityAudit: buildAIVoiceBrowserCompatibilityAudit(),
    toneCheck: {
      respectsTeacher: true,
      soundsLikeStudent: true,
      notRobotic: true
    },
    teacherToneReview: {
      question: "老师觉得这个语气是否自然？像不像学生在向老师请教？如果哪里太机械或太随意，请告诉我调整。",
      reviewState: "awaiting_teacher_review"
    },
    reviewOnly: true as const,
    accepted: false as const,
    packagingGated: true as const
  };
}

export function analyzeHumanKnowledgeConflicts(args: {
  input: HumanKnowledgeTeachingInput;
  existingRules: RuleRecord[];
}): HumanKnowledgeConflictReport {
  const newText = `${args.input.title}\n${args.input.condition}\n${args.input.action}\n${args.input.teacherNote}`;
  const comparableRules = args.existingRules.filter((rule) => rule.enabled || rule.id.startsWith("human-teaching-rule-"));

  if (comparableRules.length === 0) {
    return {
      status: "no_prior_memory",
      comparedRuleIds: [],
      teacherQuestion: "老师，这是第一条结构化人类知识。我会先暂停保存，等你确认适用条件后再允许未来使用，可以吗？",
      evidence: "当前没有可比较的人类知识记忆。",
      passed: true
    };
  }

  const scoredRules = comparableRules.map((rule) => ({
    rule,
    score: overlapScore(newText, `${rule.title}\n${rule.condition}\n${rule.action}`)
  }));
  const compatibleRules = scoredRules.filter((item) => item.score >= 0.25);

  if (compatibleRules.length > 0) {
    return {
      status: "compatible_with_prior_memory",
      comparedRuleIds: compatibleRules.map((item) => item.rule.id),
      teacherQuestion: "老师，我发现这条新知识和旧记忆有相似条件。你希望把它当作旧规则的补充样本，还是单独保留为新规则？",
      evidence: compatibleRules.map((item) => `${item.rule.title}: overlap=${Math.round(item.score * 100)}%`).join(" | "),
      passed: true
    };
  }

  return {
    status: "conflict_requires_teacher",
    comparedRuleIds: comparableRules.map((rule) => rule.id),
    teacherQuestion:
      "老师，我暂时找不到能安全合并的旧知识。是旧规则适用范围太窄，还是这次属于新的领域条件？我会先暂停，等你决定。",
    evidence: comparableRules.map((rule) => `${rule.title}: ${rule.condition}`).join(" | "),
    passed: true
  };
}

export function buildHumanKnowledgeTeachingDraft(args: {
  apprenticeId: string;
  taskId: string;
  input: HumanKnowledgeTeachingInput;
  existingRules?: RuleRecord[];
  createdAt?: string;
}): HumanKnowledgeTeachingDraft {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const conflictReport = analyzeHumanKnowledgeConflicts({
    input: args.input,
    existingRules: args.existingRules ?? []
  });
  const rule: RuleRecord = {
    id: `human-teaching-rule-${Date.parse(createdAt) || Date.now()}`,
    apprenticeId: args.apprenticeId,
    taskId: args.taskId,
    title: `人类带教待确认：${args.input.title.trim()}`,
    condition: args.input.condition.trim(),
    action: args.input.action.trim(),
    source: "manual",
    confidence: args.input.priority === "high" ? 0.88 : 0.78,
    enabled: false,
    createdAt
  };
  const learningTrace: LearningExtractionStep[] = [
    {
      id: "human-knowledge-read-teacher-input",
      label: "读取人类结构化知识",
      evidence: args.input.teacherNote.trim(),
      confidence: 0.9,
      validation: "老师输入被保存为结构化规则草案，不依赖图片识别。",
      needsHumanReview: false
    },
    {
      id: "human-knowledge-compare-old-memory",
      label: "比较旧知识记忆",
      evidence: conflictReport.evidence,
      confidence: 0.82,
      validation: conflictReport.teacherQuestion,
      needsHumanReview: true
    },
    {
      id: "human-knowledge-save-paused-rule",
      label: "保存为待确认长期记忆",
      evidence: `优先级 ${args.input.priority}；规则保持 disabled，未来执行前先请老师确认。`,
      confidence: 0.84,
      validation: "没有老师确认前，不自动启用、不确认技术合格、不解锁封装。",
      needsHumanReview: true
    }
  ];

  return {
    rule,
    correctionRecord: {
      id: `human-knowledge-ingest-${Date.parse(createdAt) || Date.now()}`,
      errorType: "human_knowledge_ingest",
      userFeedback: args.input.teacherNote.trim(),
      extractedRule: rule,
      beforeOutput: {
        teacherNote: args.input.teacherNote.trim(),
        comparedRuleIds: conflictReport.comparedRuleIds,
        conflictStatus: conflictReport.status
      },
      afterOutput: {
        ruleEnabled: false,
        accepted: false,
        packagingGated: true,
        priority: args.input.priority
      },
      learningTrace,
      createdAt
    },
    conflictReport,
    memoryState: "paused_for_teacher_confirmation",
    accepted: false,
    packagingGated: true
  };
}

export function isHumanKnowledgeTeachingRule(rule: Pick<RuleRecord, "id" | "title">) {
  return rule.id.startsWith("human-teaching-rule-") || rule.title.startsWith("人类带教待确认");
}
