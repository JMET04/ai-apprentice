import { describe, expect, it } from "vitest";
import {
  buildAIServiceReplacementReadinessReport,
  buildAIServiceOutputValidationRehearsal,
  buildDomainTeachingBriefPreview,
  buildReadableDomainLearningWorkflow,
  defaultDomainTeachingBriefJson,
  parseDomainTeachingBrief
} from "./domain-learning";
import { mockAIDomainSelfStudy } from "./domain-ai-service";

describe("domain learning workflow", () => {
  it("builds a readable Chinese staged workflow before human teaching", () => {
    const workflow = buildReadableDomainLearningWorkflow();

    expect(workflow.status).toBe("ready_for_teacher_review");
    expect(workflow.reviewOnly).toBe(true);
    expect(workflow.accepted).toBe(false);
    expect(workflow.packagingGated).toBe(true);
    expect(workflow.stages.map((stage) => stage.phase)).toEqual([
      "self_research",
      "knowledge_map",
      "human_ingest",
      "guided_generation"
    ]);
    expect(workflow.stages[0].label).toContain("领域自学");
    expect(workflow.guidedGenerationSteps.every((step) => step.nextStepPrediction.includes("下一步预测"))).toBe(true);
    expect(JSON.stringify(workflow)).toContain("老师");
  });

  it("previews an editable domain brief without accepting or packaging", () => {
    const preview = buildDomainTeachingBriefPreview(defaultDomainTeachingBriefJson());

    expect(preview.status).toBe("ready_for_teacher_review");
    expect(preview.reviewOnly).toBe(true);
    expect(preview.accepted).toBe(false);
    expect(preview.packagingGated).toBe(true);
    expect(preview.focusAreas.some((item) => item.includes("老师目标"))).toBe(true);
    expect(preview.knowledgeNodes.some((node) => node.source === "human_knowledge")).toBe(true);
    expect(preview.guidedSteps).toHaveLength(3);
    expect(preview.guidedSteps.every((step) => step.reviewState === "awaiting_teacher_review")).toBe(true);
    expect(preview.teacherQuestion).toContain("老师");
  });

  it("asks the teacher to fix invalid domain brief JSON", () => {
    const parsed = parseDomainTeachingBrief("{bad json");
    const preview = buildDomainTeachingBriefPreview("{bad json");

    expect(parsed.ok).toBe(false);
    expect(preview.status).toBe("needs_teacher_fix");
    expect(preview.error).toContain("有效 JSON");
    expect(preview.accepted).toBe(false);
    expect(preview.packagingGated).toBe(true);
  });
});

describe("AI 自学服务", () => {
  it("mock AI 自学服务返回 3-5 个自学主题", () => {
    const result = mockAIDomainSelfStudy("三维工程带教", "让 AI 学会先确认坐标系和容差");
    expect(result.topics.length).toBeGreaterThanOrEqual(3);
    expect(result.topics.length).toBeLessThanOrEqual(5);
    expect(result.domain).toBe("三维工程带教");
    expect(result.note).toContain("mock");
    expect(result.note).toContain("不连接外部模型");
  });

  it("每个自学主题包含所有必需字段", () => {
    const result = mockAIDomainSelfStudy("三维工程带教", "让 AI 学会先确认坐标系和容差");

    for (const topic of result.topics) {
      expect(topic.id).toBeTruthy();
      expect(topic.label).toBeTruthy();
      expect(topic.whyToLearn.length).toBeGreaterThan(0);
      expect(topic.possibleMistakes.length).toBeGreaterThanOrEqual(1);
      expect(topic.teacherConfirmationQuestion.length).toBeGreaterThan(0);
      expect(topic.passCriteria.length).toBeGreaterThan(0);
    }
  });

  it("每个主题的字段非空且中文可读", () => {
    const result = mockAIDomainSelfStudy("三维导轨线带教", "让 AI 学会先确认坐标系和容差");
    const allText = JSON.stringify(result);

    expect(allText).not.toMatch(/[�]|鍧|鑰|俙|鈥\?/);
    expect(allText).toContain("老师");
    expect(allText).toContain("自学");
  });

  it("保持 reviewOnly/accepted/packagingGated 约束", () => {
    const result = mockAIDomainSelfStudy("三维工程带教", "让 AI 学会先确认坐标系和容差");

    for (const topic of result.topics) {
      expect(topic.reviewOnly).toBe(true);
      expect(topic.accepted).toBe(false);
      expect(topic.packagingGated).toBe(true);
    }
  });

  it("brief preview 集成 AI 自学结果", () => {
    const preview = buildDomainTeachingBriefPreview(defaultDomainTeachingBriefJson());

    expect(preview.aiSelfStudy).toBeDefined();
    if (preview.aiSelfStudy) {
      expect(preview.aiSelfStudy.topics.length).toBeGreaterThanOrEqual(3);
      expect(preview.aiSelfStudy.topics.every((t) => t.reviewOnly === true)).toBe(true);
      expect(preview.aiSelfStudy.note).toContain("mock");
    }
  });

  it("根据领域关键词生成不同数量主题", () => {
    const result3d = mockAIDomainSelfStudy("三维坐标系带教", "");
    const resultLine = mockAIDomainSelfStudy("线条拟合", "");
    const resultRule = mockAIDomainSelfStudy("长期记忆规则", "");

    expect(result3d.topics.length).toBeGreaterThanOrEqual(4);
    expect(resultLine.topics.length).toBeGreaterThanOrEqual(3);
    expect(resultRule.topics.length).toBeGreaterThanOrEqual(3);
  });

  it("buildReadableDomainLearningWorkflow 包含 AI 自学结果", () => {
    const workflow = buildReadableDomainLearningWorkflow();

    expect(workflow.aiSelfStudyResult).toBeDefined();
    if (workflow.aiSelfStudyResult) {
      expect(workflow.aiSelfStudyResult.topics.length).toBeGreaterThanOrEqual(3);
      expect(workflow.aiSelfStudyResult.topics.every((t) => t.reviewOnly === true)).toBe(true);
      expect(workflow.aiSelfStudyResult.topics.every((t) => t.accepted === false)).toBe(true);
      expect(workflow.aiSelfStudyResult.topics.every((t) => t.packagingGated === true)).toBe(true);
    }
  });

  it("exposes review-only readiness for replacing the mock AI service", () => {
    const workflow = buildReadableDomainLearningWorkflow();
    const readiness = workflow.aiServiceReplacementReadiness;

    expect(readiness).toMatchObject({
      mode: "mock_to_real_ai_service_replacement_readiness_v1",
      format: "ai_service_replacement_readiness_json_v1",
      status: "ready_for_teacher_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      externalCallsEnabled: false,
      passed: true
    });
    expect(readiness.adapterContract.inputFields).toEqual(["domain", "teacherGoal"]);
    expect(readiness.adapterContract.requiredLocks).toEqual(
      expect.arrayContaining(["reviewOnly=true", "accepted=false", "packagingGated=true"])
    );
    expect(readiness.schemaChecks).toHaveLength(4);
    expect(readiness.replacementSteps).toHaveLength(3);
    expect(readiness.schemaChecks.every((check) => check.passed)).toBe(true);
    expect(readiness.replacementSteps.every((step) => step.passed)).toBe(true);
    expect(readiness.blockedActions).toEqual(
      expect.arrayContaining(["Call external model", "Enable generated rules", "Accept technology", "Package"])
    );
  });

  it("builds the readiness report from the same self-study output contract", () => {
    const selfStudy = mockAIDomainSelfStudy("三维工程带教", "确认坐标系和容差");
    const readiness = buildAIServiceReplacementReadinessReport(selfStudy);

    expect(readiness.schemaChecks.some((check) => check.id === "replacement-contract-outputs")).toBe(true);
    expect(readiness.schemaChecks.every((check) => check.currentEvidence.length > 0)).toBe(true);
    expect(readiness.teacherQuestions.length).toBeGreaterThanOrEqual(3);
    expect(readiness.externalCallsEnabled).toBe(false);
  });

  it("rehearses real-model-like output validation without enabling side effects", () => {
    const workflow = buildReadableDomainLearningWorkflow();
    const rehearsal = workflow.aiServiceOutputValidationRehearsal;

    expect(rehearsal).toMatchObject({
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
    expect(rehearsal.cases).toHaveLength(4);
    expect(rehearsal.cases.map((item) => item.validationResult)).toEqual(
      expect.arrayContaining([
        "accepted_for_teacher_review",
        "blocked_missing_locks",
        "blocked_schema_error",
        "blocked_side_effect"
      ])
    );
    expect(
      rehearsal.cases.every(
        (item) =>
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true &&
          item.publicTrace.length >= 3
      )
    ).toBe(true);
    expect(rehearsal.blockedActions).toEqual(
      expect.arrayContaining(["Call external model", "Enable generated rules", "Accept technology", "Package"])
    );
  });

  it("builds standalone validation rehearsal with three blocked cases", () => {
    const rehearsal = buildAIServiceOutputValidationRehearsal();

    expect(rehearsal.cases.filter((item) => item.validationResult.startsWith("blocked_"))).toHaveLength(3);
    expect(rehearsal.cases.filter((item) => item.validationResult === "accepted_for_teacher_review")).toHaveLength(1);
    expect(rehearsal.teacherQuestions.length).toBeGreaterThanOrEqual(3);
    expect(rehearsal.externalCallsEnabled).toBe(false);
  });
});
