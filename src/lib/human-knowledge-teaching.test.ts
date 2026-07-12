import { describe, expect, it } from "vitest";
import {
  analyzeHumanKnowledgeConflicts,
  buildAIVoiceRestatement,
  buildHumanKnowledgeFutureCommandReplay,
  buildVoiceBrowserCompatibilityReviewRecord,
  buildVoiceTeachingTranscriptDraft,
  buildHumanKnowledgeTeachingDraft,
  isHumanKnowledgeTeachingRule
} from "./human-knowledge-teaching";
import type { RuleRecord } from "./types";

const input = {
  title: "三维导轨先确认坐标系",
  condition: "当老师用三维坐标描述导轨或线条时",
  action: "先确认原点、单位、轴向和容差，再生成多个候选拟合",
  teacherNote: "这条规则用于工程画法带教，不要直接套到摄影游记任务。",
  priority: "high" as const
};

describe("human knowledge teaching", () => {
  it("saves human-taught knowledge as paused memory with public trace", () => {
    const draft = buildHumanKnowledgeTeachingDraft({
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      input,
      createdAt: "2026-06-01T12:20:00.000Z"
    });

    expect(draft.rule.enabled).toBe(false);
    expect(draft.rule.source).toBe("manual");
    expect(draft.rule.title).toContain(input.title);
    expect(draft.correctionRecord.errorType).toBe("human_knowledge_ingest");
    expect(draft.correctionRecord.afterOutput.ruleEnabled).toBe(false);
    expect(draft.correctionRecord.afterOutput.accepted).toBe(false);
    expect(draft.correctionRecord.afterOutput.packagingGated).toBe(true);
    expect(draft.correctionRecord.learningTrace).toHaveLength(3);
    expect(draft.correctionRecord.learningTrace.some((step) => step.needsHumanReview)).toBe(true);
    expect(draft.memoryState).toBe("paused_for_teacher_confirmation");
    expect(draft.accepted).toBe(false);
    expect(draft.packagingGated).toBe(true);
    expect(isHumanKnowledgeTeachingRule(draft.rule)).toBe(true);
  });

  it("compares new human knowledge with old memories before asking the teacher", () => {
    const oldRule: RuleRecord = {
      id: "human-teaching-rule-old",
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      title: "三维导轨坐标系",
      condition: "老师讲三维导轨时",
      action: "先确认坐标系和容差",
      source: "manual",
      confidence: 0.8,
      enabled: false,
      createdAt: "2026-06-01T12:00:00.000Z"
    };

    const report = analyzeHumanKnowledgeConflicts({
      input,
      existingRules: [oldRule]
    });

    expect(report.status).toBe("compatible_with_prior_memory");
    expect(report.comparedRuleIds).toEqual([oldRule.id]);
    expect(report.teacherQuestion).toContain("老师");
    expect(report.passed).toBe(true);
  });

  it("turns voice teaching transcript into an editable paused memory draft", () => {
    const draft = buildVoiceTeachingTranscriptDraft(
      "以后所有三维导轨任务，必须先确认坐标系和容差，再生成多个候选让老师选择。"
    );

    expect(draft.suggestedInput.priority).toBe("high");
    expect(draft.suggestedInput.title).toContain("语音带教待确认");
    expect(draft.suggestedInput.condition).toContain("三维导轨");
    expect(draft.suggestedInput.action).toContain("检查旧记忆是否冲突");
    expect(draft.teacherQuestion).toContain("老师");
    expect(draft.learningTrace).toHaveLength(3);
    expect(draft.learningTrace.every((step) => step.needsHumanReview)).toBe(true);
    expect(draft.reviewOnly).toBe(true);
    expect(draft.ruleEnabled).toBe(false);
    expect(draft.accepted).toBe(false);
    expect(draft.packagingGated).toBe(true);
  });

  it("replays remembered human knowledge before a future command continues", () => {
    const oldRule: RuleRecord = {
      id: "human-teaching-rule-coordinate",
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      title: "人类带教待确认：三维导轨先确认坐标系",
      condition: "当未来任务涉及三维坐标、导轨、线条或工程路径时",
      action: "先确认坐标系、单位和容差，再生成多个候选让老师选择。",
      source: "manual",
      confidence: 0.88,
      enabled: false,
      createdAt: "2026-06-01T12:00:00.000Z"
    };

    const replay = buildHumanKnowledgeFutureCommandReplay({
      input: {
        command: "画一条三维导轨线，直接继续生成后面的结构。",
        context: "老师之前教过：三维坐标任务不要跳过坐标系和容差确认。"
      },
      rules: [oldRule]
    });

    expect(replay.status).toBe("memory_hit_waiting_teacher_review");
    expect(replay.reviewOnly).toBe(true);
    expect(replay.accepted).toBe(false);
    expect(replay.packagingGated).toBe(true);
    expect(replay.hits).toHaveLength(1);
    expect(replay.hits[0].ruleId).toBe(oldRule.id);
    expect(replay.hits[0].ruleEnabled).toBe(false);
    expect(replay.hits[0].proposedBehavior).toContain("等老师确认");
    expect(replay.hits[0].teacherQuestion).toContain("老师");
    expect(replay.hits[0].conflictNotes.some((note) => note.includes("disabled"))).toBe(true);
    expect(replay.nextStepPrediction).toContain("先回放");
    expect(replay.blockedActions).toContain("Package");
  });
});

describe("AI 语音复述", () => {
  it("buildAIVoiceRestatement 生成非空复述文案且中文可读", () => {
    const restatement = buildAIVoiceRestatement(
      "以后三维导轨任务必须先确认坐标系和容差，再生成候选让老师选择。"
    );

    expect(restatement.spokenText.length).toBeGreaterThan(0);
    expect(restatement.structuredInterpretation.length).toBeGreaterThan(0);
    expect(restatement.id).toContain("voice-restatement-");
    expect(restatement.ttsPreview.mode).toBe("browser_speech_synthesis_preview");
    expect(restatement.ttsPreview.utteranceText).toBe(restatement.spokenText);
    expect(restatement.ttsPreview.language).toBe("zh-CN");
    expect(restatement.teacherReviewHistory.mode).toBe("teacher_tts_review_history_preview");
    expect(restatement.teacherReviewHistory.versions).toHaveLength(3);
    expect(restatement.teacherReviewHistory.currentVersionId).toBe("voice-restatement-review-current");
    expect(
      restatement.teacherReviewHistory.versions[restatement.teacherReviewHistory.versions.length - 1].utteranceText
    ).toBe(restatement.spokenText);
    const allText = JSON.stringify(restatement);
    expect(allText).not.toMatch(/[�]|鍧|鑰|俙|鈥\?/);
  });

  it("复述包含'老师'和请教语气词", () => {
    const restatement = buildAIVoiceRestatement(
      "所有三维工程画法必须先确认原点，再用候选方式让老师选。"
    );

    expect(restatement.spokenText).toContain("老师");
    expect(restatement.spokenText).toMatch(/请问|对吗|纠正/u);
    expect(restatement.structuredInterpretation).toContain("老师");
  });

  it("toneCheck 三个字段均为 true", () => {
    const restatement = buildAIVoiceRestatement(
      "以后每次带教都要先检查坐标系。"
    );

    expect(restatement.toneCheck.respectsTeacher).toBe(true);
    expect(restatement.toneCheck.soundsLikeStudent).toBe(true);
    expect(restatement.toneCheck.notRobotic).toBe(true);
  });

  it("保持 reviewOnly/accepted/packagingGated 约束", () => {
    const restatement = buildAIVoiceRestatement(
      "必须检查容差再开始拟合。"
    );

    expect(restatement.reviewOnly).toBe(true);
    expect(restatement.accepted).toBe(false);
    expect(restatement.packagingGated).toBe(true);
    expect(restatement.ttsPreview.reviewOnly).toBe(true);
    expect(restatement.ttsPreview.accepted).toBe(false);
    expect(restatement.ttsPreview.packagingGated).toBe(true);
    expect(restatement.ttsPreview.blockedActions).toContain("Package");
    expect(restatement.ttsPreview.teacherQuestion).toContain("老师");
    expect(restatement.voiceEngineSelection.mode).toBe("browser_voice_engine_selection_review");
    expect(restatement.voiceEngineSelection.runtimeVoiceListSource).toBe("speechSynthesis.getVoices");
    expect(restatement.voiceEngineSelection.requiresRuntimeVoiceList).toBe(true);
    expect(restatement.voiceEngineSelection.candidates).toHaveLength(3);
    expect(restatement.voiceEngineSelection.preferredVoiceId).toBe("browser-zh-cn-warm-student");
    expect(restatement.voiceEngineSelection.reviewOnly).toBe(true);
    expect(restatement.voiceEngineSelection.accepted).toBe(false);
    expect(restatement.voiceEngineSelection.packagingGated).toBe(true);
    expect(restatement.voiceEngineSelection.blockedActions).toContain("Package");
    expect(restatement.voiceEngineSelection.teacherQuestion).toContain("老师");
    expect(
      restatement.voiceEngineSelection.candidates.every(
        (candidate) =>
          candidate.teacherScoreReplay.replaySource === "teacher_voice_review_replay" &&
          candidate.accepted === false &&
          candidate.packagingGated === true
      )
    ).toBe(true);
    expect(restatement.browserCompatibilityAudit.mode).toBe("browser_voice_compatibility_audit");
    expect(restatement.browserCompatibilityAudit.cases).toHaveLength(4);
    expect(restatement.browserCompatibilityAudit.cases.map((item) => item.browser)).toEqual(
      expect.arrayContaining(["Chrome", "Edge", "Safari", "Firefox"])
    );
    expect(restatement.browserCompatibilityAudit.recognitionRiskBrowsers).toBeGreaterThanOrEqual(2);
    expect(restatement.browserCompatibilityAudit.fallbackRequiredBrowsers).toBeGreaterThanOrEqual(2);
    expect(restatement.browserCompatibilityAudit.reviewOnly).toBe(true);
    expect(restatement.browserCompatibilityAudit.accepted).toBe(false);
    expect(restatement.browserCompatibilityAudit.packagingGated).toBe(true);
    expect(restatement.browserCompatibilityAudit.blockedActions).toContain("Package");
    expect(restatement.browserCompatibilityAudit.blockedActions).toContain("Enable voice-only memory");
    expect(restatement.browserCompatibilityAudit.teacherQuestion).toContain("老师");
    expect(restatement.teacherReviewHistory.reviewOnly).toBe(true);
    expect(restatement.teacherReviewHistory.accepted).toBe(false);
    expect(restatement.teacherReviewHistory.packagingGated).toBe(true);
    expect(restatement.teacherReviewHistory.blockedActions).toContain("Package");
    expect(restatement.teacherReviewHistory.teacherQuestion).toContain("老师");
    expect(restatement.teacherToneReview.reviewState).toBe("awaiting_teacher_review");
  });

  it("voiceTranscriptDraft 集成 aiRestatement", () => {
    const draft = buildVoiceTeachingTranscriptDraft(
      "以后所有三维任务必须先确认坐标系和容差。"
    );

    expect(draft.aiRestatement).toBeDefined();
    if (draft.aiRestatement) {
      expect(draft.aiRestatement.spokenText).toContain("老师");
      expect(draft.aiRestatement.toneCheck.respectsTeacher).toBe(true);
      expect(draft.aiRestatement.reviewOnly).toBe(true);
      expect(draft.aiRestatement.accepted).toBe(false);
      expect(draft.aiRestatement.packagingGated).toBe(true);
      expect(draft.aiRestatement.ttsPreview.passed).toBe(true);
      expect(draft.aiRestatement.ttsPreview.utteranceText).toBe(draft.aiRestatement.spokenText);
      expect(draft.aiRestatement.ttsPreview.blockedActions).toContain("Package");
      expect(draft.aiRestatement.voiceEngineSelection.passed).toBe(true);
      expect(draft.aiRestatement.voiceEngineSelection.candidates.length).toBeGreaterThanOrEqual(3);
      expect(draft.aiRestatement.browserCompatibilityAudit.passed).toBe(true);
      expect(draft.aiRestatement.browserCompatibilityAudit.cases.length).toBe(4);
      expect(draft.aiRestatement.teacherReviewHistory.passed).toBe(true);
      expect(draft.aiRestatement.teacherReviewHistory.versions.some((version) => version.version === "current")).toBe(true);
      expect(
        draft.aiRestatement.teacherReviewHistory.versions.every(
          (version) => version.accepted === false && version.packagingGated === true
        )
      ).toBe(true);
    }
  });

  it("buildVoiceBrowserCompatibilityReviewRecord 保存实测结果但不启用 voice-only memory", () => {
    const review = buildVoiceBrowserCompatibilityReviewRecord({
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      createdAt: "2026-06-02T12:20:00.000Z",
      input: {
        browser: "Chrome",
        platformScope: "desktop Chromium",
        speechRecognitionAvailable: true,
        speechSynthesisAvailable: true,
        voiceCount: 6,
        chineseVoiceCount: 2,
        selectedVoiceName: "Microsoft Xiaoxiao",
        transcriptFallbackTested: true,
        teacherNote: "老师已在本机浏览器完成听写和朗读审查。"
      }
    });

    expect(review.errorType).toBe("voice_browser_compatibility_review");
    expect(review.beforeOutput.mode).toBe("browser_voice_compatibility_audit");
    expect(review.extractedRule.enabled).toBe(false);
    expect(review.afterOutput.ruleEnabled).toBe(false);
    expect(review.afterOutput.voiceOnlyMemoryEnabled).toBe(false);
    expect(review.afterOutput.accepted).toBe(false);
    expect(review.afterOutput.packagingGated).toBe(true);
    expect(review.learningTrace).toHaveLength(3);
    expect(review.learningTrace.every((step) => step.needsHumanReview)).toBe(true);
    expect(review.userFeedback).toContain("Chrome");
  });

  it("空转写时仍生成合理的待补充复述", () => {
    const restatement = buildAIVoiceRestatement("");

    expect(restatement.spokenText).toContain("还没有");
    expect(restatement.spokenText).toContain("老师");
    expect(restatement.toneCheck.respectsTeacher).toBe(true);
    expect(restatement.reviewOnly).toBe(true);
  });
});
