import { describe, expect, it } from "vitest";
import {
  analyzeSpatialMemoryConflicts,
  buildSpatialCandidateImpactCorrectionRehearsal,
  buildSpatialCandidateImpactSecondRoundSelectionPreview,
  buildSpatialCoordinateDialoguePreview,
  buildSpatialCodePatchMatchReviewRecord,
  buildSpatialConstructionCorrectionDraft,
  buildSpatialConstructionRevisionCandidates,
  buildSpatialConstructionRevisionSelectionPreview,
  buildSpatialMemoryTeacherReviewRecord,
  buildSpatialTeachingMemoryDraft,
  buildSpatialTeachingMemoryDraftFromCode,
  buildCodeFirstSpatialTeachingModel,
  defaultSpatialCoordinateDialogueJson,
  parseSpatialCoordinateDialogueCode,
  parseSpatialConstructionCodePatch,
  parseSpatialTeachingInput,
  spatialTeachingExampleJson,
  spatialTeachingPresetJson
} from "./spatial-teaching";

describe("code-first spatial teaching", () => {
  it("keeps spatial teaching explanations readable in Chinese", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const readableText = [
      model.codeTeachingProtocol.tokenSavingRationale,
      defaultSpatialCoordinateDialogueJson(),
      spatialTeachingPresetJson("axis"),
      ...model.candidates.map((candidate) => `${candidate.label}\n${candidate.evidence}`),
      ...model.teachingRehearsals.map(
        (rehearsal) => `${rehearsal.ruleDraft}\n${rehearsal.teacherQuestion}\n${rehearsal.nextStepPrediction}`
      ),
      ...model.guidedGenerationSteps.map(
        (step) => `${step.proposedOutput}\n${step.whyThisStep}\n${step.teacherCorrectionSlot}\n${step.nextStepPrediction}`
      ),
      model.batchPatternLearning.consensusModel,
      model.batchPatternLearning.variationSummary,
      ...model.batchPatternLearning.ruleCandidates.map(
        (candidate) => `${candidate.label}\n${candidate.ruleDraft}\n${candidate.teacherQuestion}\n${candidate.nextStepPrediction}`
      )
    ].join("\n");

    expect(readableText).toContain("老师");
    expect(readableText).toContain("下一步预测");
    expect(readableText).toContain("最小二乘");
    expect(readableText).toContain("批量样本共识");
    expect(readableText).not.toMatch(/[�]|鍧|鑰|俙|鈥\?/);
  });

  it("parses JSON teaching data and builds selectable 3D fit candidates", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    expect(model.status).toBe("ready_for_teacher_review");
    expect(model.teachingInputMode).toBe("code_first");
    expect(model.codeTeachingProtocol.imageUse).toBe("optional_reference_only");
    expect(model.candidates.map((candidate) => candidate.id)).toEqual([
      "fit-freehand-intent-line",
      "fit-axis-aligned-rail",
      "fit-two-segment-guide",
      "fit-circular-arc-guide",
      "fit-smooth-bezier-guide",
      "fit-multi-segment-spline-guide",
      "fit-surface-patch-guide"
    ]);
    expect(model.candidates.every((candidate) => candidate.passed && candidate.teacherSelectable)).toBe(true);
    expect(model.candidates[0].evidence).toContain("最小二乘");
    expect(model.candidates[0].controlPoints).toHaveLength(2);
    expect(model.extractedRules).toHaveLength(2);
    expect(model.teachingRehearsals).toHaveLength(7);
    expect(model.candidateSelectionImpactPreviews).toHaveLength(7);
    expect(model.coordinateDialogue.status).toBe("ready_for_teacher_review");
    expect(model.coordinateDialogue.inputMode).toBe("coordinate_dialogue_code");
    expect(model.coordinateDialogue.turns).toHaveLength(4);
    expect(model.coordinateDialogue.turns.every((turn) => turn.reviewState === "awaiting_teacher_review")).toBe(true);
    expect(model.coordinateDialogue.accepted).toBe(false);
    expect(model.coordinateDialogue.packagingGated).toBe(true);
    expect(model.guidedGenerationSteps).toHaveLength(4);
    expect(model.constructionPredictionPlans).toHaveLength(model.candidates.length);
    expect(model.batchPatternLearning.status).toBe("ready_for_teacher_review");
    expect(model.batchPatternLearning.reviewOnly).toBe(true);
    expect(model.batchPatternLearning.accepted).toBe(false);
    expect(model.batchPatternLearning.packagingGated).toBe(true);
    expect(model.batchPatternLearning.sampleCount).toBeGreaterThanOrEqual(12);
    expect(model.batchPatternLearning.ruleCandidates).toHaveLength(2);
    expect(model.batchPatternLearning.ruleCandidates.every((candidate) => candidate.teacherQuestion.includes("老师"))).toBe(true);
    expect(model.batchPatternLearning.positionParameterLearningReport.status).toBe("ready_for_teacher_review");
    expect(model.batchPatternLearning.positionParameterLearningReport.parameterRows).toHaveLength(5);
    expect(model.batchPatternLearning.positionParameterLearningReport.accepted).toBe(false);
    expect(model.batchPatternLearning.positionParameterLearningReport.packagingGated).toBe(true);
    expect(model.batchPatternLearning.surfacePatchStabilityReport.status).toBe("ready_for_teacher_review");
    expect(model.batchPatternLearning.surfacePatchStabilityReport.sourceSampleCount).toBe(
      model.batchPatternLearning.sampleCount
    );
    expect(model.batchPatternLearning.surfacePatchStabilityReport.accepted).toBe(false);
    expect(model.batchPatternLearning.surfacePatchStabilityReport.packagingGated).toBe(true);
    expect(model.surfacePatchTeachingLens.id).toBe("surface-patch-height-field-lens");
    expect(model.surfacePatchTeachingLens.reviewOnly).toBe(true);
    expect(model.surfacePatchTeachingLens.accepted).toBe(false);
    expect(model.surfacePatchTeachingLens.packagingGated).toBe(true);
    expect(model.constructionPredictionPlans.every((plan) => plan.constructionSteps.length >= 3)).toBe(true);
    expect(
      model.constructionPredictionPlans.every(
        (plan) =>
          plan.accepted === false &&
          plan.packagingGated === true &&
          plan.memoryPolicy === "preview_only_requires_teacher_confirmation" &&
          plan.constructionSteps.every((step) => step.nextStepPrediction.includes("下一步预测"))
      )
    ).toBe(true);
    expect(model.guidedGenerationSteps.every((step) => step.reviewState === "awaiting_teacher_review")).toBe(true);
    expect(model.guidedGenerationSteps.every((step) => step.whyThisStep.length > 0)).toBe(true);
    expect(model.guidedGenerationSteps.every((step) => step.teacherCorrectionSlot.length > 0)).toBe(true);
    expect(model.guidedGenerationSteps.every((step) => step.nextStepPrediction.includes("下一步预测"))).toBe(true);
    expect(model.teachingRehearsals.every((rehearsal) => rehearsal.memoryPolicy === "preview_only_requires_teacher_confirmation")).toBe(true);
    expect(model.teachingRehearsals.every((rehearsal) => rehearsal.nextStepPrediction.includes("下一步预测"))).toBe(true);
    expect(model.candidateSelectionImpactPreviews.every((preview) => preview.accepted === false && preview.packagingGated === true)).toBe(true);
    expect(model.accepted).toBe(false);
    expect(model.packagingGated).toBe(true);
  });

  it("previews direct 3D coordinate dialogue commands without accepting or packaging", () => {
    const parsedTeaching = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsedTeaching.ok) {
      throw new Error(parsedTeaching.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsedTeaching.value);
    const rawCode = defaultSpatialCoordinateDialogueJson("fit-axis-aligned-rail");
    const parsedDialogue = parseSpatialCoordinateDialogueCode(rawCode);

    expect(parsedDialogue.ok).toBe(true);
    if (!parsedDialogue.ok) {
      throw new Error(parsedDialogue.error);
    }

    const preview = buildSpatialCoordinateDialoguePreview({
      rawCode,
      rawStroke: model.rawStroke,
      candidates: model.candidates,
      selectedCandidateId: "fit-axis-aligned-rail"
    });

    expect(preview.status).toBe("ready_for_teacher_review");
    expect(preview.inputMode).toBe("coordinate_dialogue_code");
    expect(preview.commands).toHaveLength(4);
    expect(preview.turns.map((turn) => turn.order)).toEqual([1, 2, 3, 4]);
    expect(preview.turns.some((turn) => turn.aiInterpretation.includes("新增三维采样点"))).toBe(true);
    expect(preview.turns.some((turn) => turn.candidateImpact.includes("残差"))).toBe(true);
    expect(preview.turns.every((turn) => turn.nextStepPrediction.includes("下一步预测"))).toBe(true);
    expect(preview.accepted).toBe(false);
    expect(preview.packagingGated).toBe(true);
    expect(preview.blockedActions).toContain("Package");
  });

  it("adds a teacher-selectable circular arc fit candidate for rough curved intent", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const arc = model.candidates.find((candidate) => candidate.model === "circular_arc");

    expect(arc).toBeDefined();
    expect(arc?.id).toBe("fit-circular-arc-guide");
    expect(arc?.teacherSelectable).toBe(true);
    expect(arc?.passed).toBe(true);
    expect(arc?.arc?.plane).toBe("xz");
    expect(arc?.arc?.radius).toBeGreaterThan(0);
    expect(arc?.arc?.sweepDeg).toBeGreaterThan(0);
    expect(arc?.controlPoints.length).toBeGreaterThanOrEqual(5);
    expect(model.residualTeachingLenses.some((lens) => lens.candidateId === arc?.id)).toBe(true);
    expect(model.directionToleranceChecks.some((check) => check.candidateId === arc?.id)).toBe(true);
  });

  it("adds a teacher-selectable smooth Bezier candidate for flexible curve intent", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const spline = model.candidates.find((candidate) => candidate.model === "bezier_spline");

    expect(spline).toBeDefined();
    expect(spline?.id).toBe("fit-smooth-bezier-guide");
    expect(spline?.teacherSelectable).toBe(true);
    expect(spline?.passed).toBe(true);
    expect(spline?.bezier?.controlHandles).toHaveLength(4);
    expect(spline?.bezier?.sampledPointCount).toBeGreaterThanOrEqual(7);
    expect(spline?.bezier?.maxHandleOffset).toBeGreaterThan(0);
    expect(model.residualTeachingLenses.some((lens) => lens.candidateId === spline?.id)).toBe(true);
    expect(model.directionToleranceChecks.some((check) => check.candidateId === spline?.id)).toBe(true);
  });

  it("adds a teacher-selectable multi-segment spline candidate for local continuous curve intent", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const multiSegment = model.candidates.find((candidate) => candidate.model === "multi_segment_bezier_spline");

    expect(multiSegment).toBeDefined();
    expect(multiSegment?.id).toBe("fit-multi-segment-spline-guide");
    expect(multiSegment?.teacherSelectable).toBe(true);
    expect(multiSegment?.passed).toBe(true);
    expect(multiSegment?.multiSegment?.segmentCount).toBe(2);
    expect(multiSegment?.multiSegment?.knotPoints).toHaveLength(3);
    expect(multiSegment?.multiSegment?.sampledPointCount).toBeGreaterThanOrEqual(9);
    expect(multiSegment?.controlPoints.length).toBe(multiSegment?.multiSegment?.sampledPointCount);
    expect(model.residualTeachingLenses.some((lens) => lens.candidateId === multiSegment?.id)).toBe(true);
    expect(model.directionToleranceChecks.some((check) => check.candidateId === multiSegment?.id)).toBe(true);
    expect(model.candidateSelectionImpactPreviews.some((preview) => preview.candidateId === multiSegment?.id)).toBe(
      true
    );
  });

  it("adds a review-only surface patch teaching lens for local height-field intent", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const lens = model.surfacePatchTeachingLens;

    expect(lens.id).toBe("surface-patch-height-field-lens");
    expect(lens.label).toBe("曲面 patch 教学放大镜");
    expect(lens.fitModel).toBe("local_xz_height_patch");
    expect(lens.equation).toContain("y=");
    expect(lens.patchCorners).toHaveLength(4);
    expect(lens.vectors).toHaveLength(model.rawStroke.length);
    expect(lens.vectors.every((vector) => vector.heightResidual >= 0)).toBe(true);
    expect(lens.meanHeightResidual).toBeGreaterThanOrEqual(0);
    expect(lens.maxHeightResidual).toBeGreaterThanOrEqual(lens.meanHeightResidual);
    expect(lens.teacherQuestion).toContain("老师");
    expect(lens.nextStepPrediction).toContain("下一步预测");
    expect(lens.reviewOnly).toBe(true);
    expect(lens.accepted).toBe(false);
    expect(lens.packagingGated).toBe(true);
    expect(lens.passed).toBe(true);
  });

  it("adds a teacher-selectable surface patch candidate for local height-field intent", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const surface = model.candidates.find((candidate) => candidate.model === "surface_patch");

    expect(surface).toBeDefined();
    expect(surface?.id).toBe("fit-surface-patch-guide");
    expect(surface?.label).toBe("曲面拟合意图候选");
    expect(surface?.teacherSelectable).toBe(true);
    expect(surface?.passed).toBe(true);
    expect(surface?.surfacePatch?.fitModel).toBe("local_xz_height_patch");
    expect(surface?.surfacePatch?.patchCorners).toHaveLength(4);
    expect(surface?.surfacePatch?.meanHeightResidual).toBe(model.surfacePatchTeachingLens.meanHeightResidual);
    expect(surface?.surfacePatch?.maxHeightResidual).toBe(model.surfacePatchTeachingLens.maxHeightResidual);
    expect(surface?.controlPoints).toHaveLength(2);
    expect(model.residualTeachingLenses.some((lens) => lens.candidateId === surface?.id)).toBe(true);
    expect(model.directionToleranceChecks.some((check) => check.candidateId === surface?.id)).toBe(true);
    expect(model.candidateSelectionImpactPreviews.some((preview) => preview.candidateId === surface?.id)).toBe(true);
  });

  it("asks the teacher to fix invalid 3D coordinate dialogue code", () => {
    const parsedTeaching = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsedTeaching.ok) {
      throw new Error(parsedTeaching.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsedTeaching.value);
    const preview = buildSpatialCoordinateDialoguePreview({
      rawCode: JSON.stringify({ commands: [{ command: "select_candidate", candidateId: "" }] }),
      rawStroke: model.rawStroke,
      candidates: model.candidates
    });

    expect(preview.status).toBe("needs_teacher_fix");
    expect(preview.error).toContain("select_candidate");
    expect(preview.turns).toHaveLength(0);
    expect(preview.accepted).toBe(false);
    expect(preview.packagingGated).toBe(true);
  });

  it("provides hands-on teaching presets for straight, axis, and bend intent", () => {
    for (const preset of ["straight", "axis", "bend"] as const) {
      const parsed = parseSpatialTeachingInput(spatialTeachingPresetJson(preset));

      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }

      const model = buildCodeFirstSpatialTeachingModel(parsed.value);

      expect(model.candidates).toHaveLength(7);
      expect(model.teachingRehearsals).toHaveLength(model.candidates.length);
      expect(model.constructionPredictionPlans).toHaveLength(model.candidates.length);
      expect(model.teachingRehearsals.every((rehearsal) => rehearsal.conflictChecks.length >= 3)).toBe(true);
      expect(model.accepted).toBe(false);
      expect(model.packagingGated).toBe(true);
    }
  });

  it("regenerates second-round candidate impact from editable teacher correction", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const preview = model.candidateSelectionImpactPreviews[0];
    const { correctionRehearsal: _correctionRehearsal, ...previewWithoutRehearsal } = preview;
    void _correctionRehearsal;
    const rehearsal = buildSpatialCandidateImpactCorrectionRehearsal({
      preview: previewWithoutRehearsal,
      teacherCorrection: "老师指出这个候选把位置意图和构造意图混在一起了。",
      preferredDecision: "split_candidate_intent"
    });

    expect(rehearsal.seedTeacherCorrection).toContain("构造意图");
    expect(rehearsal.preferredDecision).toBe("split_candidate_intent");
    expect(rehearsal.secondRoundCandidates).toHaveLength(3);
    expect(rehearsal.secondRoundCandidates[0].sourceDecision).toBe("split_candidate_intent");
    expect(
      rehearsal.secondRoundCandidates.every(
        (candidate) =>
          candidate.teacherCorrection.includes("构造意图") &&
          candidate.regeneratedRuleDrafts.every((draft) => draft.willBeEnabled === false) &&
          candidate.accepted === false &&
          candidate.packagingGated === true
      )
    ).toBe(true);
    expect(rehearsal.accepted).toBe(false);
    expect(rehearsal.packagingGated).toBe(true);
  });

  it("turns selected second-round impact route into a no-op follow-up plan", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const preview = model.candidateSelectionImpactPreviews[0];
    const candidate = preview.correctionRehearsal.secondRoundCandidates[0];
    const selectionPreview = buildSpatialCandidateImpactSecondRoundSelectionPreview(candidate);

    expect(selectionPreview.selectedSecondRoundCandidateId).toBe(candidate.id);
    expect(selectionPreview.followUpPlanSteps).toHaveLength(4);
    expect(selectionPreview.publicTraceSteps).toHaveLength(4);
    expect(selectionPreview.publicTraceSteps.every((step) => step.validation.length > 0)).toBe(true);
    expect(selectionPreview.publicTraceSteps.every((step) => step.confidence > 0 && step.confidence <= 1)).toBe(true);
    expect(selectionPreview.publicTraceSteps.some((step) => step.label === "Assert no-op gate")).toBe(true);
    expect(selectionPreview.verifierCommand).toBe("npm.cmd run verify:learning");
    expect(selectionPreview.noOpActions).toContain("No rule enablement");
    expect(selectionPreview.noOpActions).toContain("No packaging");
    expect(selectionPreview.blockedActions).toContain("Accept technology");
    expect(selectionPreview.blockedActions).toContain("Package");
    expect(selectionPreview.ruleEnabled).toBe(false);
    expect(selectionPreview.accepted).toBe(false);
    expect(selectionPreview.packagingGated).toBe(true);
    expect(selectionPreview.passed).toBe(true);
    expect(preview.selectedSecondRoundPreview).toMatchObject({
      selectedSecondRoundCandidateId: candidate.id,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      passed: true
    });
    expect(preview.selectedSecondRoundPreview.publicTraceSteps).toHaveLength(4);
    expect(preview.selectedSecondRoundPreview.noOpActions).toContain("No packaging");
  });

  it("turns a selected fit candidate into paused long-term memory without accepting the technology", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const candidate = model.candidates[0];
    const rehearsal = model.teachingRehearsals[0];
    const draft = buildSpatialTeachingMemoryDraft({
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      candidate,
      rehearsal,
      createdAt: "2026-06-01T11:30:00.000Z"
    });

    expect(draft.rule.source).toBe("manual");
    expect(draft.rule.enabled).toBe(false);
    expect(draft.rule.action).toContain(candidate.equation);
    expect(draft.learningTrace).toHaveLength(4);
    expect(draft.learningTrace.some((step) => step.needsHumanReview)).toBe(true);
    expect(draft.conflictReport.status).toBe("no_prior_memory");
    expect(draft.memoryState).toBe("paused_for_teacher_confirmation");
    expect(draft.accepted).toBe(false);
    expect(draft.packagingGated).toBe(true);
  });

  it("recomputes selected spatial memory from teacher code on the server side", () => {
    const result = buildSpatialTeachingMemoryDraftFromCode({
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      teachingCode: spatialTeachingExampleJson(),
      selectedCandidateId: "fit-axis-aligned-rail",
      createdAt: "2026-06-01T11:35:00.000Z"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.model.candidates).toHaveLength(7);
    expect(result.candidate.id).toBe("fit-axis-aligned-rail");
    expect(result.rehearsal.selectedCandidateId).toBe(result.candidate.id);
    expect(result.draft.rule.enabled).toBe(false);
    expect(result.draft.rule.action).toContain(result.candidate.equation);
    expect(result.evidence).toContain("服务端");
    expect(result.accepted).toBe(false);
    expect(result.packagingGated).toBe(true);
  });

  it("rejects stale or forged spatial candidate ids when saving from code", () => {
    const result = buildSpatialTeachingMemoryDraftFromCode({
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      teachingCode: spatialTeachingExampleJson(),
      selectedCandidateId: "fit-forged-candidate"
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected forged candidate to be rejected");
    }

    expect(result.error).toContain("没有找到候选");
    expect(result.evidence).toContain("服务端");
    expect(result.accepted).toBe(false);
    expect(result.packagingGated).toBe(true);
  });

  it("saves teacher corrections to construction predictions as paused memory", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const plan = model.constructionPredictionPlans[0];
    const draft = buildSpatialConstructionCorrectionDraft({
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      plan,
      decision: "revise_anchor_points",
      teacherCorrection: "第二个锚点应该贴近导轨终点，不能沿 z 轴继续抬高。",
      createdAt: "2026-06-01T12:30:00.000Z"
    });

    expect(draft.rule.id).toContain("spatial-construction-correction-rule");
    expect(draft.rule.enabled).toBe(false);
    expect(draft.rule.title).toContain("三维构造纠正待确认");
    expect(draft.correctionRecord.errorType).toBe("spatial_construction_correction");
    expect(draft.correctionRecord.beforeOutput.planId).toBe(plan.id);
    expect(draft.correctionRecord.afterOutput.revisionCandidateIds).toHaveLength(3);
    expect(draft.revisionCandidates).toHaveLength(3);
    expect(draft.revisionCandidates.every((candidate) => candidate.accepted === false)).toBe(true);
    expect(draft.revisionCandidates.every((candidate) => candidate.packagingGated === true)).toBe(true);
    expect(draft.correctionRecord.afterOutput.ruleEnabled).toBe(false);
    expect(draft.correctionRecord.afterOutput.accepted).toBe(false);
    expect(draft.correctionRecord.afterOutput.packagingGated).toBe(true);
    expect(draft.correctionRecord.learningTrace).toHaveLength(3);
    expect(draft.correctionRecord.learningTrace.some((step) => step.needsHumanReview)).toBe(true);
    expect(draft.memoryState).toBe("paused_for_teacher_confirmation");
    expect(draft.accepted).toBe(false);
    expect(draft.packagingGated).toBe(true);
  });

  it("regenerates local construction candidates after teacher correction without accepting technology", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const plan = model.constructionPredictionPlans[0];
    const candidates = buildSpatialConstructionRevisionCandidates({
      plan,
      decision: "revise_anchor_points",
      teacherCorrection: "这条线应该更像贴着主轴走，不要继续往 z 方向抬高。"
    });

    expect(candidates).toHaveLength(3);
    expect(candidates.map((candidate) => candidate.label)).toEqual([
      "锚点吸附到主轴",
      "降低 z 方向漂移",
      "增加中间控制点"
    ]);
    expect(candidates.every((candidate) => candidate.sourcePlanId === plan.id)).toBe(true);
    expect(candidates.every((candidate) => candidate.reviewState === "local_preview_waiting_teacher_selection")).toBe(
      true
    );
    expect(candidates.every((candidate) => candidate.teacherQuestion.includes("老师"))).toBe(true);
    expect(candidates.every((candidate) => candidate.nextStepPrediction.includes("下一步预测"))).toBe(true);
    expect(candidates.every((candidate) => candidate.accepted === false && candidate.packagingGated === true)).toBe(
      true
    );
  });

  it("turns a selected construction revision into stepwise code preview for teacher review", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const [candidate] = buildSpatialConstructionRevisionCandidates({
      plan: model.constructionPredictionPlans[0],
      decision: "revise_anchor_points",
      teacherCorrection: "先沿主轴贴合，不要让手绘抖动改变真实意图。"
    });
    const preview = buildSpatialConstructionRevisionSelectionPreview(candidate);

    expect(preview.selectedRevisionCandidateId).toBe(candidate.id);
    expect(preview.codePatch.teacherReviewRequired).toBe(true);
    expect(preview.codePatch.accepted).toBe(false);
    expect(preview.codePatch.packagingGated).toBe(true);
    expect(preview.codePatchJson).toContain("\"anchorPoints\"");
    expect(preview.guidedSteps).toHaveLength(3);
    expect(preview.guidedSteps.every((step) => step.reviewState === "awaiting_teacher_review")).toBe(true);
    expect(preview.guidedSteps.every((step) => step.teacherCorrectionSlot.includes("老师"))).toBe(true);
    expect(preview.guidedSteps.every((step) => step.nextStepPrediction.includes("下一步预测"))).toBe(true);
    expect(preview.accepted).toBe(false);
    expect(preview.packagingGated).toBe(true);
  });

  it("lets the teacher edit construction preview JSON while keeping review gates locked", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const [candidate] = buildSpatialConstructionRevisionCandidates({
      plan: model.constructionPredictionPlans[0],
      decision: "revise_anchor_points",
      teacherCorrection: "用代码直接改锚点，不要靠图片识别。"
    });
    const preview = buildSpatialConstructionRevisionSelectionPreview(candidate);
    const editablePatch = JSON.parse(preview.codePatchJson) as typeof preview.codePatch;
    editablePatch.anchorPoints = [
      { x: 0, y: 0, z: 0.3 },
      { x: 1.2, y: 0, z: 0.3 }
    ];
    editablePatch.offsetVector = { x: 1.2, y: 0, z: 0 };
    editablePatch.geometryPatch = "老师用 JSON 直接修正为水平主轴构造。";

    const validation = parseSpatialConstructionCodePatch(JSON.stringify(editablePatch));

    expect(validation.ok).toBe(true);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    expect(validation.patch.anchorPoints).toHaveLength(2);
    expect(validation.patch.geometryPatch).toContain("JSON");
    expect(validation.accepted).toBe(false);
    expect(validation.packagingGated).toBe(true);
    expect(validation.nextStepPrediction).toContain("下一步预测");

    const unlockedDraft = {
      ...editablePatch,
      accepted: true,
      packagingGated: false
    };
    const rejected = parseSpatialConstructionCodePatch(JSON.stringify(unlockedDraft));

    expect(rejected.ok).toBe(false);
    expect(rejected.accepted).toBe(false);
    expect(rejected.packagingGated).toBe(true);
    expect(rejected.evidence).toContain("审查状态");
  });

  it("stores teacher-edited construction JSON as paused correction memory", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const plan = model.constructionPredictionPlans[0];
    const [candidate] = buildSpatialConstructionRevisionCandidates({
      plan,
      decision: "revise_anchor_points",
      teacherCorrection: "老师已经把构造草稿改成更贴近主轴。"
    });
    const preview = buildSpatialConstructionRevisionSelectionPreview(candidate);
    const validation = parseSpatialConstructionCodePatch(preview.codePatchJson);
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const draft = buildSpatialConstructionCorrectionDraft({
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      plan,
      decision: "revise_anchor_points",
      teacherCorrection: "保存这份 JSON 构造草稿，但不要自动启用。",
      codePatch: validation.patch,
      createdAt: "2026-06-01T13:00:00.000Z"
    });

    expect(draft.rule.enabled).toBe(false);
    expect(draft.rule.action).toContain("代码草稿");
    expect(draft.correctionRecord.afterOutput.selectedCodePatch?.revisionCandidateId).toBe(candidate.id);
    expect(draft.correctionRecord.afterOutput.codePatchEvidence).toContain("锚点数");
    expect(draft.correctionRecord.afterOutput.ruleEnabled).toBe(false);
    expect(draft.correctionRecord.afterOutput.accepted).toBe(false);
    expect(draft.correctionRecord.afterOutput.packagingGated).toBe(true);
    expect(draft.correctionRecord.learningTrace.some((step) => step.id === "spatial-construction-save-teacher-code-patch")).toBe(
      true
    );
  });

  it("compares new spatial teaching against old paused memories before asking the teacher", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const oldRule = buildSpatialTeachingMemoryDraft({
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      candidate: model.candidates[0],
      rehearsal: model.teachingRehearsals[0],
      createdAt: "2026-06-01T11:30:00.000Z"
    }).rule;
    const conflict = analyzeSpatialMemoryConflicts({
      candidate: model.candidates[2],
      rehearsal: model.teachingRehearsals[2],
      existingRules: [oldRule]
    });

    expect(conflict.status).toBe("conflict_requires_teacher");
    expect(conflict.comparedRuleIds).toEqual([oldRule.id]);
    expect(conflict.teacherQuestion).toContain("老师");
    expect(conflict.passed).toBe(true);
  });

  it("returns a Chinese validation message for invalid teaching code", () => {
    const parsed = parseSpatialTeachingInput("{bad json");

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      throw new Error("Expected invalid JSON to fail");
    }
    expect(parsed.error).toContain("带教输入");
  });

  it("records teacher review notes without enabling spatial memory or accepting packaging", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const draft = buildSpatialTeachingMemoryDraft({
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      candidate: model.candidates[1],
      rehearsal: model.teachingRehearsals[1],
      createdAt: "2026-06-01T11:30:00.000Z"
    });
    const review = buildSpatialMemoryTeacherReviewRecord({
      rule: draft.rule,
      decision: "add_applicability_condition",
      teacherNote: "这条只适用于 x 轴导轨草图，折线场景要重新生成候选。",
      createdAt: "2026-06-01T11:40:00.000Z"
    });

    expect(review.errorType).toBe("spatial_memory_review");
    expect(review.extractedRule.enabled).toBe(false);
    expect(review.afterOutput.ruleEnabled).toBe(false);
    expect(review.afterOutput.accepted).toBe(false);
    expect(review.afterOutput.packagingGated).toBe(true);
    expect(review.learningTrace).toHaveLength(3);
    expect(review.learningTrace.map((step) => step.label)).toContain("像下棋一样预测下一步");
    expect(review.learningTrace.some((step) => step.needsHumanReview)).toBe(true);
    expect(review.accepted).toBe(false);
    expect(review.packagingGated).toBe(true);
  });

  it("records teacher review of code patch matches without applying old memory", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const plan = model.constructionPredictionPlans[0];
    const rule = {
      id: "spatial-construction-correction-rule-demo",
      apprenticeId: "apprentice-demo",
      taskId: "task-demo",
      title: "三维构造纠正待确认：demo",
      condition: "三维代码带教中的构造纠正",
      action: "回放老师编辑过的 JSON 构造草稿后再请老师确认。",
      source: "manual" as const,
      confidence: 0.82,
      enabled: false,
      createdAt: "2026-06-01T13:20:00.000Z"
    };
    const review = buildSpatialCodePatchMatchReviewRecord({
      rule,
      decision: "tighten_applicability",
      teacherNote: "方向相似但锚点场景不同，未来只能作为参考证据。",
      match: {
        id: "match-demo",
        replayId: "replay-demo",
        planId: plan.id,
        selectedCandidateId: plan.selectedCandidateId,
        matchScore: 0.72,
        matchedReason: "旧草稿和当前候选方向相似。",
        conflictChecks: ["锚点数量不同", "几何补丁不完全一致", "旧草稿仍锁定"],
        teacherQuestion: "老师，这次要沿用旧草稿吗？",
        nextStepPrediction: "下一步预测：先回放旧草稿，再请老师确认。",
        accepted: false,
        packagingGated: true
      },
      createdAt: "2026-06-01T13:21:00.000Z"
    });

    expect(review.errorType).toBe("spatial_code_patch_match_review");
    expect(review.extractedRule.enabled).toBe(false);
    expect(review.beforeOutput.matchScore).toBe(0.72);
    expect(review.afterOutput.decision).toBe("tighten_applicability");
    expect(review.afterOutput.ruleEnabled).toBe(false);
    expect(review.afterOutput.accepted).toBe(false);
    expect(review.afterOutput.packagingGated).toBe(true);
    expect(review.learningTrace).toHaveLength(3);
    expect(review.learningTrace.every((step) => step.validation.length > 0)).toBe(true);
  });
});

describe("拟合候选对比矩阵", () => {
  it("为每个拟合候选生成老师可审查的对比行", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    expect(model.candidateComparisonMatrix).toHaveLength(model.candidates.length);
    expect(model.candidateComparisonMatrix.map((row) => row.candidateId).sort()).toEqual(
      model.candidates.map((candidate) => candidate.id).sort()
    );
    expect(model.candidateComparisonMatrix.map((row) => row.recommendedReviewOrder).sort((a, b) => a - b)).toEqual([
      1,
      2,
      3,
      4,
      5,
      6,
      7
    ]);
  });

  it("对比矩阵公开残差、方向、复杂度和老师选择取舍，但不解锁封装", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    for (const row of model.candidateComparisonMatrix) {
      expect(row.residual).toBeGreaterThanOrEqual(0);
      expect(row.maxResidual).toBeGreaterThanOrEqual(row.residual);
      expect(row.angularDeviationDeg).toBeGreaterThanOrEqual(0);
      expect(row.residualRank).toBeGreaterThan(0);
      expect(row.directionRank).toBeGreaterThan(0);
      expect(row.teacherDecisionHint).toContain("老师");
      expect(row.selectionTradeoff.length).toBeGreaterThan(10);
      expect(row.reviewOnly).toBe(true);
      expect(row.accepted).toBe(false);
      expect(row.packagingGated).toBe(true);
      expect(row.passed).toBe(true);
    }
  });
});

describe("候选选择影响预演", () => {
  it("为每个拟合候选生成 disabled 规则草稿、冲突边界和下一步预测", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    expect(model.candidateSelectionImpactPreviews).toHaveLength(model.candidates.length);
    expect(model.candidateSelectionImpactPreviews.map((preview) => preview.candidateId).sort()).toEqual(
      model.candidates.map((candidate) => candidate.id).sort()
    );

    for (const preview of model.candidateSelectionImpactPreviews) {
      expect(preview.disabledRuleDrafts).toHaveLength(2);
      expect(preview.disabledRuleDrafts.every((draft) => draft.willBeEnabled === false)).toBe(true);
      expect(preview.disabledRuleDrafts.every((draft) => draft.teacherReviewRequired === true)).toBe(true);
      expect(preview.conflictBoundaries.length).toBeGreaterThanOrEqual(3);
      expect(preview.predictedSteps).toHaveLength(4);
      expect(preview.predictedSteps.every((step) => step.nextStepPrediction.includes("下一步预测"))).toBe(true);
      expect(preview.teacherQuestion).toContain("老师");
      expect(preview.memoryImpact.autoApplies).toBe(false);
      expect(preview.memoryImpact.requiresTeacherConfirmation).toBe(true);
    }
  });

  it("老师纠正后会生成二轮候选、再生规则草稿和冲突边界", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    for (const preview of model.candidateSelectionImpactPreviews) {
      expect(preview.correctionRehearsal.sourceCandidateId).toBe(preview.candidateId);
      expect(preview.correctionRehearsal.reviewOnly).toBe(true);
      expect(preview.correctionRehearsal.accepted).toBe(false);
      expect(preview.correctionRehearsal.packagingGated).toBe(true);
      expect(preview.correctionRehearsal.passed).toBe(true);
      expect(preview.correctionRehearsal.teacherQuestion).toContain("二轮");
      expect(preview.correctionRehearsal.secondRoundCandidates).toHaveLength(3);

      for (const candidate of preview.correctionRehearsal.secondRoundCandidates) {
        expect(candidate.sourceCandidateId).toBe(preview.candidateId);
        expect(candidate.reviewOnly).toBe(true);
        expect(candidate.accepted).toBe(false);
        expect(candidate.packagingGated).toBe(true);
        expect(candidate.regeneratedRuleDrafts).toHaveLength(preview.disabledRuleDrafts.length);
        expect(candidate.regeneratedRuleDrafts.every((draft) => draft.willBeEnabled === false)).toBe(true);
        expect(candidate.regeneratedRuleDrafts.every((draft) => draft.teacherReviewRequired === true)).toBe(true);
        expect(candidate.regeneratedConflictBoundaries.length).toBeGreaterThanOrEqual(4);
        expect(candidate.nextStepPrediction).toContain("下一步预测");
      }
    }
  });

  it("候选选择影响预演只用于审查，不会确认技术或解锁封装", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    expect(
      model.candidateSelectionImpactPreviews.every(
        (preview) =>
          preview.reviewOnly === true &&
          preview.accepted === false &&
          preview.packagingGated === true &&
          preview.passed === true &&
          preview.blockedActions.includes("Package") &&
          preview.blockedActions.includes("Accept technology")
      )
    ).toBe(true);
  });
});

describe("批量位置参数学习报告", () => {
  it("把多次示教样本拆成均值、范围、标准差和方向漂移", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const report = model.batchPatternLearning.positionParameterLearningReport;

    expect(report.sourceSampleCount).toBe(model.batchPatternLearning.sampleCount);
    expect(report.learnedModel).toBe("sample_mean_variation_envelope");
    expect(report.parameterRows.map((row) => row.sourceField)).toEqual([
      "start_y",
      "end_y",
      "start_z",
      "end_z",
      "span_length"
    ]);
    expect(report.anchorMean.startPoint.x).toBeGreaterThanOrEqual(0);
    expect(report.anchorMean.endPoint.x).toBeGreaterThan(report.anchorMean.startPoint.x);
    expect(report.directionModel.maxAngularDriftDeg).toBeGreaterThanOrEqual(0);
    expect(report.directionModel.teacherQuestion).toContain("老师");
    expect(report.toleranceRecommendation.rationale).toContain("老师输入容差");
    expect(report.outlierPolicy.ruleDraft).toContain("不自动套用");
  });

  it("位置参数学习报告只用于老师审查，不能解锁封装", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const report = model.batchPatternLearning.positionParameterLearningReport;

    expect(report.reviewOnly).toBe(true);
    expect(report.accepted).toBe(false);
    expect(report.packagingGated).toBe(true);
    expect(report.passed).toBe(true);
    expect(report.blockedActions).toEqual(expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"]));
    expect(
      report.parameterRows.every(
        (row) => row.reviewOnly === true && row.accepted === false && row.packagingGated === true && row.teacherQuestion.includes("老师")
      )
    ).toBe(true);
  });
});

describe("方向容差审查", () => {
  it("每个拟合候选都有方向容差检查", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    expect(model.directionToleranceChecks).toHaveLength(model.candidates.length);
    expect(model.directionToleranceChecks.map((check) => check.candidateId).sort()).toEqual(
      model.candidates.map((candidate) => candidate.id).sort()
    );
  });

  it("方向容差检查保持 review-only 和封装锁", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    for (const check of model.directionToleranceChecks) {
      expect(check.reviewOnly).toBe(true);
      expect(check.accepted).toBe(false);
      expect(check.packagingGated).toBe(true);
      expect(check.allowedDeviationDeg).toBeGreaterThan(0);
      expect(check.angularDeviationDeg).toBeGreaterThanOrEqual(0);
      expect(check.teacherQuestion).toContain("老师");
    }
  });

  it("能把候选方向和老师粗略起止方向比较成角度证据", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    expect(model.directionToleranceChecks.every((check) => check.teacherDirection.x > 0)).toBe(true);
    expect(model.directionToleranceChecks.some((check) => check.status === "within_tolerance")).toBe(true);
    expect(model.directionToleranceChecks.every((check) => check.passed === (check.status === "within_tolerance"))).toBe(
      true
    );
  });
});

describe("拟合误差教学放大镜", () => {
  it("每个拟合候选都有对应的 residual lens", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    expect(model.residualTeachingLenses).toHaveLength(model.candidates.length);
    expect(model.residualTeachingLenses.map((lens) => lens.candidateId).sort()).toEqual(
      model.candidates.map((c) => c.id).sort()
    );
  });

  it("每个 lens 的 residual vector 数量等于 rawStroke 点数量", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    for (const lens of model.residualTeachingLenses) {
      expect(lens.vectors).toHaveLength(model.rawStroke.length);
    }
  });

  it("能区分超容差和未超容差点", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    for (const lens of model.residualTeachingLenses) {
      const exceedVectors = lens.vectors.filter((v) => v.exceedsTolerance);
      const withinVectors = lens.vectors.filter((v) => !v.exceedsTolerance);
      expect(exceedVectors.length + withinVectors.length).toBe(lens.vectors.length);
      expect(lens.exceedCount).toBe(exceedVectors.length);

      if (lens.vectors.length > 0) {
        expect(lens.maxResidual).toBeGreaterThanOrEqual(lens.minResidual);
      }
    }
  });

  it("lens 保持 reviewOnly、accepted=false、packagingGated=true", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    for (const lens of model.residualTeachingLenses) {
      expect(lens.reviewOnly).toBe(true);
      expect(lens.accepted).toBe(false);
      expect(lens.packagingGated).toBe(true);
    }
  });

  it("中文可读性检查通过", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);

    const lensText = JSON.stringify(model.residualTeachingLenses);
    expect(lensText).not.toMatch(/[�]|鍧|鑰|俙|鈥\?/);
    expect(lensText).toContain("candidateLabel");
    expect(lensText).toContain("exceedsTolerance");
  });
});

describe("surface patch batch stability report", () => {
  it("adds a review-only surface patch batch stability report without unlocking packaging", () => {
    const parsed = parseSpatialTeachingInput(spatialTeachingExampleJson());
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildCodeFirstSpatialTeachingModel(parsed.value);
    const report = model.batchPatternLearning.surfacePatchStabilityReport;

    expect(report.status).toBe("ready_for_teacher_review");
    expect(report.reviewOnly).toBe(true);
    expect(report.accepted).toBe(false);
    expect(report.packagingGated).toBe(true);
    expect(report.learnedModel).toBe("surface_patch_gradient_residual_consensus");
    expect(report.sourceSampleCount).toBe(model.batchPatternLearning.sampleCount);
    expect(report.samples).toHaveLength(report.sourceSampleCount);
    expect(report.samples.every((sample) => sample.teacherQuestion.includes("老师"))).toBe(true);
    expect(report.gradientConsensus.meanXSlope).toEqual(expect.any(Number));
    expect(report.gradientConsensus.meanZSlope).toEqual(expect.any(Number));
    expect(report.gradientConsensus.teacherQuestion).toContain("老师");
    expect(report.residualEnvelope.stableSampleCount).toBeGreaterThanOrEqual(3);
    expect(report.residualEnvelope.maxHeightResidual).toBeGreaterThanOrEqual(
      report.residualEnvelope.meanHeightResidual
    );
    expect(report.outlierPolicy.ruleDraft).toContain("不自动套用");
    expect(report.outlierPolicy.teacherQuestion).toContain("老师");
    expect(report.teacherSelectionReplay.mode).toBe("surface_patch_teacher_selection_replay");
    expect(report.teacherSelectionReplay.options).toHaveLength(3);
    expect(report.teacherSelectionReplay.reviewOnly).toBe(true);
    expect(report.teacherSelectionReplay.accepted).toBe(false);
    expect(report.teacherSelectionReplay.packagingGated).toBe(true);
    expect(report.teacherSelectionReplay.memoryPolicy.autoApplies).toBe(false);
    expect(report.teacherSelectionReplay.memoryPolicy.requiresTeacherConfirmation).toBe(true);
    expect(
      report.teacherSelectionReplay.options.every(
        (option) =>
          option.disabledRuleDrafts.length > 0 &&
          option.disabledRuleDrafts.every((draft) => draft.willBeEnabled === false) &&
          option.oldKnowledgeConflictBoundaries.length >= 3 &&
          option.nextStepPrediction.includes("下一步预测") &&
          option.accepted === false &&
          option.packagingGated === true
      )
    ).toBe(true);
    expect(report.blockedActions).toEqual(expect.arrayContaining(["Accept technology", "Package", "Release", "Wrap"]));
    expect(report.passed).toBe(true);
  });
});
