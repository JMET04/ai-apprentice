import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowNodeDefinition } from "../src/lib/types";
import { architectureAuditLayers } from "../src/lib/architecture-audit";
import { prisma } from "../src/server/db/prisma";
import { memoryStore } from "../src/server/memory/memory-store";
import { buildLearningChallengeProbe, buildLearningChallengeSuite } from "../src/server/qualification/learning-challenge";
import { buildQualificationReport } from "../src/server/qualification/learning-report";

type Check = {
  name: string;
  pass: boolean;
  evidence: string;
};

const root = process.cwd();

function layerPathExists(pathSpec: string) {
  return pathSpec.split(",").every((part) => existsSync(join(root, part.trim())));
}

function textIsReadable(...paths: string[]) {
  const badMarkers = [
    "\u9203\u00ab",
    "\u9203\u00a5",
    "\u6d60\u5a7e",
    "\u934c\u50b6",
    "\u9435",
    "\u9508",
    "\u9286",
    "\u934c\u5db6",
    "\u69db\u52ec",
    "\u6f76\u66df",
    "\u93c3\u30e8"
  ];
  const text = paths.map((path) => readFileSync(join(root, path), "utf8")).join("\n");

  return !badMarkers.some((marker) => text.includes(marker));
}

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

async function main() {
  const checks: Check[] = [];
  const task = await memoryStore.getTaskProfile("task-photo-travel-journal");

  push(checks, "Demo task exists", Boolean(task), task?.name ?? "Missing task-photo-travel-journal.");

  if (!task) {
    return finish(checks);
  }

  const report = buildQualificationReport(task);
  const spatialReadableText = JSON.stringify(report.spatialEngineeringTeachingModel);
  const spatialModelReadable =
    !/[�]|鍧|鑰|俙|鈥\?|濡傛灉|涓嬩竴姝|鎷熷悎/.test(spatialReadableText) &&
    spatialReadableText.includes("老师") &&
    spatialReadableText.includes("下一步预测") &&
    spatialReadableText.includes("最小二乘") &&
    spatialReadableText.includes("批量样本共识");
  const domainReadableText = JSON.stringify(report.domainLearningWorkflow);
  const domainWorkflowReadable =
    !/[�]|鍧|鑰|俙|鈥\?|棰嗗煙|涓嬩竴姝|甯︽暀/.test(domainReadableText) &&
    domainReadableText.includes("领域自学计划") &&
    domainReadableText.includes("老师") &&
    domainReadableText.includes("下一步预测");
  const architecturePathsPresent = architectureAuditLayers.every((layer) => layerPathExists(layer.path));
  const learnedTraceRows = await prisma.traceStep.findMany({
    where: { runId: "run-demo-golden-hour" }
  });
  const traceRowsWithValidation = learnedTraceRows.filter((row) => row.validation.trim().length > 0).length;
  const reportRequirement = (id: string) => report.requirements.find((requirement) => requirement.id === id);
  const learningDelta = report.learningDeltas[0];
  const teacherBoundary = report.teacherAcceptanceBoundary;
  const challengeRules = await memoryStore.listRules({
    apprenticeId: task.apprenticeId,
    taskId: task.id,
    includeDisabled: true
  });
  const challengeWorkflowNodes = JSON.parse(task.workflows[0]?.nodes ?? "[]") as WorkflowNodeDefinition[];
  const challengeProbe = buildLearningChallengeProbe({
    input: "Lake portrait near Geneva with clear weather, warm orange rim light, and long shadows.",
    expectedLighting: "golden hour",
    expectedReview: false,
    taskId: task.id,
    apprenticeId: task.apprenticeId,
    workflowNodes: challengeWorkflowNodes,
    rules: challengeRules
  });
  const counterexampleChallengeProbe = buildLearningChallengeProbe({
    input: "At midday near Geneva, I photographed a lake portrait with rim light and long shadows under overhead sun.",
    expectedLighting: "natural light",
    expectedReview: true,
    taskId: task.id,
    apprenticeId: task.apprenticeId,
    workflowNodes: challengeWorkflowNodes,
    rules: challengeRules
  });
  const challengeSuite = buildLearningChallengeSuite({
    taskId: task.id,
    apprenticeId: task.apprenticeId,
    workflowNodes: challengeWorkflowNodes,
    rules: challengeRules
  });
  const readableDemoRows = [
    ...(await prisma.rule.findMany({
      select: { id: true, title: true, condition: true, action: true }
    })).map((row) => ({ table: "Rule", id: row.id, text: `${row.title}\n${row.condition}\n${row.action}` })),
    ...(await prisma.correction.findMany({
      select: { id: true, userFeedback: true, extractedRule: true, beforeOutput: true, afterOutput: true, learningTrace: true }
    })).map((row) => ({
      table: "Correction",
      id: row.id,
      text: [
        row.userFeedback,
        row.extractedRule,
        row.beforeOutput,
        row.afterOutput ?? "",
        row.learningTrace ?? ""
      ].join("\n")
    })),
    ...(await prisma.teachingExample.findMany({
      select: { id: true, input: true, expectedOutput: true, extractedRule: true, learningTrace: true }
    })).map((row) => ({
      table: "TeachingExample",
      id: row.id,
      text: [row.input, row.expectedOutput, row.extractedRule ?? "", row.learningTrace ?? ""].join("\n")
    })),
    ...(await prisma.visualDemonstration.findMany({
      select: { id: true, title: true, artifact: true, teacherNotes: true, extractedRule: true, learningTrace: true }
    })).map((row) => ({
      table: "VisualDemonstration",
      id: row.id,
      text: [row.title, row.artifact, row.teacherNotes, row.extractedRule ?? "", row.learningTrace ?? ""].join("\n")
    }))
  ];
  const unreadableDemoRows = readableDemoRows.filter((row) => /\?{4,}/.test(row.text) || row.text.includes("�"));

  push(
    checks,
    "Architecture layers are separated",
    report.summary.architectureLayers === 10 && architecturePathsPresent,
    `${report.summary.architectureLayers} layers registered; paths present=${architecturePathsPresent}.`
  );
  push(
    checks,
    "Seed demo is immediately runnable",
    report.summary.workflowNodes >= 7 && report.summary.runs >= 2,
    `${task.apprentice.name}; workflow nodes=${report.summary.workflowNodes}; runs=${report.summary.runs}.`
  );
  push(
    checks,
    "Visual workflow execution trace is structured",
    Boolean(reportRequirement("public-structured-trace")?.passed) &&
      learnedTraceRows.length === 7 &&
      traceRowsWithValidation === 7,
      `report=${reportRequirement("public-structured-trace")?.passed ? "passed" : "failed"}; trace rows=${learnedTraceRows.length}; rows with validation=${traceRowsWithValidation}.`
  );
  push(
    checks,
    "Rule application audit explains memory source and cue match",
    readFileSync(join(root, "src/lib/types.ts"), "utf8").includes("evidencePath") &&
      readFileSync(join(root, "src/server/workflow/execution-engine.ts"), "utf8").includes(
        "evidencePathForRule"
      ) &&
      readFileSync(join(root, "src/server/workflow/execution-engine.ts"), "utf8").includes(
        "visual_demonstration"
      ) &&
      readFileSync(join(root, "src/server/workflow/execution-engine.ts"), "utf8").includes("Memory source") &&
      readFileSync(join(root, "src/components/trace-panel.tsx"), "utf8").includes("memorySource") &&
      readFileSync(join(root, "src/components/trace-panel.tsx"), "utf8").includes("evidencePath") &&
      readFileSync(join(root, "src/components/trace-panel.tsx"), "utf8").includes("Cue match") &&
      readFileSync(join(root, "src/components/trace-panel.tsx"), "utf8").includes("结构化执行追踪") &&
      readFileSync(join(root, "src/components/trace-panel.tsx"), "utf8").includes("规则决策审查") &&
      readFileSync(join(root, "src/components/trace-panel.tsx"), "utf8").includes("老师可在这里纠正") &&
      readFileSync(join(root, "src/server/workflow/execution-engine.test.ts"), "utf8").includes(
        "memorySource: \"visual_demonstration\""
      ),
    "Execution trace rule audit exposes source, condition, matched cues, action, confidence, and public evidence path."
  );
  push(
    checks,
    "Visual memory overgeneralization requires teacher review",
    readFileSync(join(root, "src/lib/types.ts"), "utf8").includes("\"conflicted\"") &&
      readFileSync(join(root, "src/lib/types.ts"), "utf8").includes("counterCues") &&
      readFileSync(join(root, "src/server/workflow/execution-engine.ts"), "utf8").includes(
        "counterLightingCues"
      ) &&
      readFileSync(join(root, "src/server/workflow/execution-engine.ts"), "utf8").includes(
        "Counterexample check"
      ) &&
      readFileSync(join(root, "src/components/trace-panel.tsx"), "utf8").includes("反例：") &&
      readFileSync(join(root, "src/server/workflow/execution-engine.test.ts"), "utf8").includes(
        "pauses visual memory when counterexample lighting cues suggest overgeneralization"
      ),
    "Counterexample lighting cues create a conflicted decision, keep the draft conservative, and require teacher review."
  );
  push(
    checks,
    "Teacher can save reusable visual counterexample memory",
    readFileSync(join(root, "src/server/corrections/rule-extractor.ts"), "utf8").includes(
      "visual_counterexample_memory"
    ) &&
      readFileSync(join(root, "src/server/workflow/execution-engine.ts"), "utf8").includes(
        "isCounterexampleRule"
      ) &&
      readFileSync(join(root, "src/server/workflow/execution-engine.ts"), "utf8").includes(
        "counterEvidenceSources"
      ) &&
      readFileSync(join(root, "src/components/run-console.tsx"), "utf8").includes(
        "视觉冲突审查"
      ) &&
      readFileSync(join(root, "src/components/run-console.tsx"), "utf8").includes(
        "把这次记为视觉反例"
      ) &&
      readFileSync(join(root, "src/server/workflow/execution-engine.test.ts"), "utf8").includes(
        "uses teacher counterexample memory as the source for visual conflict review"
      ),
    "A conflicted run can be converted into reusable counterexample memory and traced as the source of future conflict review."
  );
  push(
    checks,
    "Visual learning scenario matrix is reviewable",
    report.summary.visualScenarioPassed === report.summary.visualScenarioTotal &&
      report.summary.visualScenarioTotal >= 4 &&
      report.summary.visualScenarioTraceSteps >= report.summary.visualScenarioTotal * 7 &&
      report.visualLearningScenarios.every((scenario) => scenario.traceSummary.length >= 7) &&
      report.visualLearningScenarios.every((scenario) =>
        scenario.traceSummary.every((step) => step.stepName && step.validation.trim().length > 0)
      ) &&
      report.visualLearningScenarios.some((scenario) => scenario.id === "sunset-language" && scenario.passed) &&
      report.visualLearningScenarios.some((scenario) => scenario.id === "visual-rim-light" && scenario.passed) &&
      report.visualLearningScenarios.some((scenario) => scenario.id === "midday-counterexample" && scenario.passed) &&
      report.visualLearningScenarios.some((scenario) => scenario.id === "ordinary-daylight" && scenario.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "buildVisualLearningScenarios"
      ) &&
      readFileSync(join(root, "src/components/visual-learning-scenario-matrix-panel.tsx"), "utf8").includes(
        "可视化学习场景矩阵"
      ) &&
      readFileSync(join(root, "src/components/visual-learning-scenario-matrix-panel.tsx"), "utf8").includes(
        "公开 trace 回放"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "VisualLearningScenarioMatrixPanel"
      ),
    `scenarioMatrix=${report.summary.visualScenarioPassed}/${report.summary.visualScenarioTotal}; traceSteps=${report.summary.visualScenarioTraceSteps}; positive, visual, counterexample, and ordinary cases are visible.`
  );
  push(
    checks,
    "Visual baseline regression comparison is reviewable",
    report.summary.visualRegressionPassed === report.summary.visualRegressionTotal &&
      report.summary.visualRegressionTotal >= 4 &&
      report.summary.visualRegressionChanged >= 2 &&
      report.summary.visualRegressionConservative >= 2 &&
      report.visualRegressionCases.every((item) => item.passed) &&
      report.visualRegressionCases.some(
        (item) =>
          item.id === "visual-rim-light" &&
          item.baselineLighting === "natural light" &&
          item.learnedLighting === "golden hour" &&
          item.changedByMemory
      ) &&
      report.visualRegressionCases.some(
        (item) =>
          item.id === "midday-counterexample" &&
          item.baselineLighting === "natural light" &&
          item.learnedLighting === "natural light" &&
          !item.changedByMemory &&
          item.learnedNeedsReview
      ) &&
      report.policyEvidence.some((item) => item.id === "visual-regression-comparison" && item.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualRegressionCases"
      ) &&
      readFileSync(join(root, "src/components/visual-regression-comparison-panel.tsx"), "utf8").includes(
        "可视化基线回归对比"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("VisualRegressionComparisonPanel"),
    `regression=${report.summary.visualRegressionPassed}/${report.summary.visualRegressionTotal}; changed=${report.summary.visualRegressionChanged}; conservative=${report.summary.visualRegressionConservative}.`
  );
  push(
    checks,
    "Visual robustness stress suite is review-only",
    report.visualRobustnessSuite.reviewOnly === true &&
      report.visualRobustnessSuite.persisted === false &&
      report.visualRobustnessSuite.accepted === false &&
      report.visualRobustnessSuite.packagingGated === true &&
      report.visualRobustnessSuite.passed === report.visualRobustnessSuite.total &&
      report.summary.visualRobustnessPassed === report.summary.visualRobustnessTotal &&
      report.summary.visualRobustnessTotal >= 4 &&
      report.summary.visualRobustnessFalsePositiveGuards >= 3 &&
      report.summary.visualRobustnessPositiveParaphrases >= 1 &&
      report.visualRobustnessSuite.cases.some(
        (item) => item.id === "low-sun-paraphrase" && item.actualLighting === "golden hour" && !item.needsReview
      ) &&
      report.visualRobustnessSuite.cases.some(
        (item) => item.id === "cafe-sign-midday" && item.actualLighting === "natural light" && item.needsReview
      ) &&
      report.visualRobustnessSuite.cases
        .filter((item) => item.stressType === "false_positive_guard")
        .every((item) =>
          item.decisions.some((decision) => decision.decision === "conflicted" || decision.decision === "counterexample")
        ) &&
      report.policyEvidence.some((item) => item.id === "visual-robustness-stress-suite" && item.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualRobustnessSuite"
      ) &&
      readFileSync(join(root, "src/components/visual-robustness-suite-panel.tsx"), "utf8").includes(
        "可视化鲁棒性压力套件"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "VisualRobustnessSuitePanel"
      ),
    `robustness=${report.summary.visualRobustnessPassed}/${report.summary.visualRobustnessTotal}; falsePositiveGuards=${report.summary.visualRobustnessFalsePositiveGuards}; accepted=${report.visualRobustnessSuite.accepted}.`
  );
  push(
    checks,
    "Apprentice capability boundary is reviewable",
    report.summary.capabilityBoundaryPassed === report.summary.capabilityBoundaryTotal &&
      report.summary.capabilityBoundaryTotal === 4 &&
      report.summary.capabilityBoundaryItems === 4 &&
      report.capabilityBoundary.every((item) => item.passed) &&
      report.capabilityBoundary.some((item) => item.category === "automatic") &&
      report.capabilityBoundary.some((item) => item.category === "teacher_review") &&
      report.capabilityBoundary.some((item) => item.category === "blocked") &&
      report.capabilityBoundary.some(
        (item) =>
          item.id === "automatic-golden-hour" &&
          item.passed &&
          item.status === "ready" &&
          item.scenarioIds.includes("sunset-language") &&
          item.scenarioIds.includes("visual-rim-light")
      ) &&
      report.capabilityBoundary.some(
        (item) =>
          item.id === "teacher-review-boundary" &&
          item.passed &&
          item.status === "review_required" &&
          item.scenarioIds.includes("midday-counterexample") &&
          item.scenarioIds.includes("ordinary-daylight")
      ) &&
      report.capabilityBoundary.some((item) => item.id === "packaging-boundary" && item.passed && item.status === "locked") &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "capabilityBoundaryPassed"
      ) &&
      readFileSync(join(root, "src/components/apprentice-capability-boundary-panel.tsx"), "utf8").includes(
        "AI 学徒能力边界"
      ) &&
      readFileSync(join(root, "src/components/apprentice-capability-boundary-panel.tsx"), "utf8").includes(
        "条边界已证明"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "ApprenticeCapabilityBoundaryPanel"
    ),
    `boundary=${report.summary.capabilityBoundaryPassed}/${report.summary.capabilityBoundaryTotal}; automatic behavior, teacher-review cases, sourced memory, and locked packaging are visible.`
  );
  push(
    checks,
    "Codex capability transfer is reviewable",
    report.codexCapabilityTransferReport.format === "codex_capability_transfer_review_json_v1" &&
      report.codexCapabilityTransferReport.reviewOnly === true &&
      report.codexCapabilityTransferReport.accepted === false &&
      report.codexCapabilityTransferReport.packagingGated === true &&
      report.summary.codexCapabilityTransferItems === 5 &&
      report.summary.codexCapabilityTransferReady === 5 &&
      report.summary.codexCapabilityTransferLocked === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.format ===
        "codex_capability_transplant_draft_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.reviewOnly === true &&
      report.codexCapabilityTransferReport.transplantDraft.accepted === false &&
      report.codexCapabilityTransferReport.transplantDraft.packagingGated === true &&
      report.codexCapabilityTransferReport.transplantDraft.rowCount === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.readyRows === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.lockedRows === 5 &&
      report.summary.codexCapabilityTransplantRehearsalRows === 5 &&
      report.summary.codexCapabilityTransplantRehearsalReady === 5 &&
      report.summary.codexCapabilityTransplantRehearsalLocked === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.format ===
        "codex_capability_transplant_rehearsal_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.reviewOnly === true &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.accepted === false &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.packagingGated === true &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.rowCount === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.readyRows === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.lockedRows === 5 &&
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
      ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.exportJson.includes(
        "codex_capability_transplant_rehearsal_json_v1"
      ) &&
      report.summary.codexCapabilityTransplantRehearsalResultRows === 5 &&
      report.summary.codexCapabilityTransplantRehearsalResultNotRun === 5 &&
      report.summary.codexCapabilityTransplantRehearsalResultLocked === 5 &&
      report.summary.codexCapabilityTransplantRehearsalResultValidationRows === 5 &&
      report.summary.codexCapabilityTransplantRehearsalResultValidationReady === 5 &&
      report.summary.codexCapabilityTransplantRehearsalResultValidationBlockedStatuses === 5 &&
      report.summary.codexCapabilityTransplantRehearsalResultValidationReplayRows === 15 &&
      report.summary.codexCapabilityTransplantRehearsalResultValidationReplayReady === 15 &&
      report.summary.codexCapabilityTransplantRehearsalResultValidationReplayBlockedStatuses === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.format ===
        "codex_capability_transplant_rehearsal_result_template_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.reviewOnly === true &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.accepted === false &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.packagingGated === true &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.rowCount === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.notRunRows === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.lockedRows === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.rows.every(
        (row) =>
          row.defaultStatus === "not_run_yet" &&
          row.observedOutputPlaceholder.includes("do not include private reasoning") &&
          row.mismatchQuestion.includes("imply acceptance") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.format ===
        "codex_capability_transplant_rehearsal_result_validation_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.reviewOnly === true &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.accepted === false &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.packagingGated === true &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.rowCount === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.readyRows === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.blockedStatusRows === 5 &&
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
      ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.reviewOnly ===
        true &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.accepted ===
        false &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.packagingGated ===
        true &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.rowCount ===
        15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.readyRows ===
        15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.blockedStatusRows ===
        15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.rows.every(
        (row) =>
          ["not_run_yet", "matched_expected", "mismatch_blocked"].includes(row.simulatedStatus) &&
          row.nextReviewAction.length > 0 &&
          row.consequence.toLowerCase().includes("no") &&
          row.blockedStatusReminder.includes("accepted") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .itemCount === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .readyItems === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .pendingVerifierItems === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .matchedEvidenceItems === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .mismatchBlockerItems === 5 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .items.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.stepCount === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.lockedSteps === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.steps.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.itemCount === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.lockedChecks === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.items.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.rowCount === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.lockedRows === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.noOpRows === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.rows.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.rowCount === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.needsReviewRows === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.blockedDecisionRows === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rowCount === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.readyRows === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.blockedDecisionRows === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rows.every(
          (row) =>
            row.order > 0 &&
            ["needs_teacher_review", "blocked", "ready_for_follow_up"].includes(row.simulatedDecision) &&
            row.nextReviewAction.length > 0 &&
            row.consequence.includes("does not accept technology") &&
            row.blockedDecisionReminder.includes("accepted remains blocked") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.itemCount === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.readyItems === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
        .missingTeacherEvidenceItems === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.blockedItems === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.readyForFollowUpItems === 15 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items.every(
          (item) =>
            ["missing_teacher_evidence", "blocked_route", "review_only_follow_up"].includes(item.lane) &&
            item.reviewerAction.length > 0 &&
            item.evidenceRequest.length > 0 &&
            item.continueCondition.length > 0 &&
            item.stopCondition.includes("Stop") &&
            item.blockedTransitions.includes("Package") &&
            item.ruleEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.lockedSteps === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.blockedSteps === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.steps.every(
          (step) =>
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
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount ===
        45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.lockedChecks ===
        45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.blockedItems ===
        45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.items.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .rowCount === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .lockedRows === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .noOpRows === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rows.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.rowCount === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.needsReviewRows === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.rowCount === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.blockedDecisionRows === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.rowCount === 135 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.blockedDecisionRows === 135 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rows.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.nextReviewQueue.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.nextReviewQueue.itemCount === 135 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.nextReviewQueue.readyItems === 135 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.nextReviewQueue.blockedItems === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.nextReviewQueue.readyForFollowUpItems === 45 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.nextReviewQueue.handoff.format ===
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1" &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount === 135 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.nextReviewQueue.handoff.lockedSteps === 135 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
        .receiptTemplate.validation.replay.nextReviewQueue.handoff.blockedSteps === 135 &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue
        .handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.steps.every(
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
        ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.exportJson.includes(
        "codex_capability_transplant_rehearsal_result_template_json_v1"
      ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.exportJson.includes(
        "codex_capability_transplant_rehearsal_result_validation_json_v1"
      ) &&
      report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.exportJson.includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_json_v1"
      ) &&
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
      ) &&
      report.codexCapabilityTransferReport.transplantDraft.exportJson.includes(
        "codex_capability_transplant_draft_json_v1"
      ) &&
      report.codexCapabilityTransferReport.items.every(
        (item) =>
          item.structuredTraceExample.includes("Trace shows") &&
          item.blockedSideEffects.includes("Accept technology") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.codexCapabilityTransferReport.items.some((item) => item.id === "codex-mcp-tool-contract") &&
      report.codexCapabilityTransferReport.items.some((item) => item.id === "codex-context-recovery-memory") &&
      report.codexCapabilityTransferReport.exportJson.includes("codex_capability_transfer_review_json_v1") &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "Codex capability transfer review"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "Codex capability transplant draft"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "Codex capability transplant rehearsal"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_draft_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "Codex capability transplant rehearsal result template"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_template_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result validation replay"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result replay next review queue"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result replay queue handoff"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result replay queue handoff runbook"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result replay queue handoff runbook dry-run audit"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result replay queue handoff runbook dry-run receipt template"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result replay queue handoff runbook dry-run receipt validation"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result replay queue handoff runbook dry-run receipt validation replay"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result replay queue handoff runbook dry-run receipt validation replay queue"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result replay queue handoff runbook dry-run receipt validation replay queue handoff"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "receipt template"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "receipt validation"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "receipt validation replay"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "receipt validation replay queue"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "receipt validation replay queue handoff"
      ) &&
      readFileSync(join(root, "src/components/codex-capability-transfer-panel.tsx"), "utf8").includes(
        "codex_capability_transplant_rehearsal_result_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "CodexCapabilityTransferPanel"
      ),
    `codexTransfer=${report.summary.codexCapabilityTransferReady}/${report.summary.codexCapabilityTransferItems}; transplant=${report.codexCapabilityTransferReport.transplantDraft.readyRows}/${report.codexCapabilityTransferReport.transplantDraft.rowCount}; rehearsal=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.readyRows}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.rowCount}; resultTemplate=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.notRunRows}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.rowCount}; resultValidation=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.readyRows}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.rowCount}; resultReplay=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.readyRows}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.rowCount}; resultReplayQueue=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.readyItems}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.itemCount}; resultReplayHandoff=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.lockedSteps}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.stepCount}; resultReplayHandoffRunbook=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.lockedChecks}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount}; resultReplayHandoffRunbookDryRun=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.noOpRows}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount}; resultReplayHandoffRunbookDryRunReceipt=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.needsReviewRows}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount}; resultReplayHandoffRunbookDryRunReceiptValidation=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.blockedDecisionRows}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount}; resultReplayHandoffRunbookDryRunReceiptValidationReplay=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.readyRows}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rowCount}; resultReplayHandoffRunbookDryRunReceiptValidationReplayQueue=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.readyItems}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.itemCount}; resultReplayHandoffRunbookDryRunReceiptValidationReplayQueueHandoff=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.lockedSteps}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount}; resultReplayHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbook=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.lockedChecks}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount}; resultReplayHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.noOpRows}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount}; resultReplayHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceipt=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.needsReviewRows}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount}; resultReplayHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidation=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.blockedDecisionRows}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount}; resultReplayHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplay=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.readyRows}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rowCount}; resultReplayHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueue=${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.readyItems}/${report.codexCapabilityTransferReport.transplantDraft.rehearsal.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.itemCount}; locked=${report.summary.codexCapabilityTransferLocked}; accepted=${report.codexCapabilityTransferReport.accepted}; packaging=${report.codexCapabilityTransferReport.packagingGated}.`
  );
  push(
    checks,
    "Visual learning readiness rubric is reviewable",
    report.summary.visualReadinessPassed === report.summary.visualReadinessTotal &&
      report.summary.visualReadinessTotal === 6 &&
      report.visualLearningReadiness.every((item) => item.passed) &&
      report.visualLearningReadiness.some((item) => item.id === "positive-visual-transfer" && item.status === "proven") &&
      report.visualLearningReadiness.some(
        (item) => item.id === "counterexample-boundary" && item.status === "review_required"
      ) &&
      report.visualLearningReadiness.some(
        (item) => item.id === "ordinary-input-boundary" && item.status === "review_required"
      ) &&
      report.visualLearningReadiness.some((item) => item.id === "trace-auditability" && item.status === "proven") &&
      report.visualLearningReadiness.some(
        (item) => item.id === "memory-source-grounding" && item.status === "proven"
      ) &&
      report.visualLearningReadiness.some(
        (item) => item.id === "review-only-packaging-lock" && item.status === "locked"
      ) &&
      report.policyEvidence.some((item) => item.id === "visual-learning-readiness-rubric" && item.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualLearningReadiness"
      ) &&
      readFileSync(join(root, "src/components/visual-learning-readiness-panel.tsx"), "utf8").includes(
        "可视化学习准备度评分表"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("VisualLearningReadinessPanel"),
    `readiness=${report.summary.visualReadinessPassed}/${report.summary.visualReadinessTotal}; positive transfer, counterexample boundary, trace auditability, memory grounding, and packaging lock are visible.`
  );
  push(
    checks,
    "Visual cue audit trail is reviewable",
    report.summary.visualCueAuditPassed >= 3 &&
      report.summary.visualCueAuditTotal >= report.summary.visualCueAuditPassed &&
      report.visualCueAuditTrail.some((item) => item.cueType === "annotation" && item.passed) &&
      report.visualCueAuditTrail.some(
        (item) => item.cue === "warm rim light" && item.ruleTitles.length > 0 && item.challengeIds.length > 0
      ) &&
      report.visualCueAuditTrail.some(
        (item) =>
          item.cue === "golden hour" &&
          item.ruleTitles.includes("Dusk words mean golden hour") &&
          item.challengeIds.includes("positive-visual-cue")
      ) &&
      report.visualCueAuditTrail.some((item) => item.cue === "reflective lake surface" && !item.passed) &&
      report.policyEvidence.some((item) => item.id === "visual-cue-audit-trail" && item.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualCueAuditTrail"
      ) &&
      readFileSync(join(root, "src/components/visual-cue-audit-trail-panel.tsx"), "utf8").includes(
        "可视化线索审计链"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("VisualCueAuditTrailPanel"),
    `cueAudit=${report.summary.visualCueAuditPassed}/${report.summary.visualCueAuditTotal}; reference cues link to rules, outcomes, and context-only boundaries.`
  );
  push(
    checks,
    "Visual decision ledger is reviewable",
    report.summary.visualDecisionLedgerItems === report.visualDecisionLedger.length &&
      report.summary.visualDecisionLedgerItems >= 6 &&
      report.summary.visualDecisionApplied >= 3 &&
      report.summary.visualDecisionConflicted >= 2 &&
      report.summary.visualDecisionReviewRequired >= 2 &&
      report.visualDecisionLedger.every((item) => item.expectationPassed === true) &&
      report.visualDecisionLedger.some((item) => item.sourceType === "scenario" && item.decision === "applied") &&
      report.visualDecisionLedger.some((item) => item.sourceType === "challenge" && item.decision === "applied") &&
      report.visualDecisionLedger.some(
        (item) => item.decision === "conflicted" && item.counterCues.includes("midday") && item.needsReview
      ) &&
      report.visualDecisionLedger.some((item) => item.memorySource === "visual_demonstration") &&
      report.policyEvidence.some((item) => item.id === "visual-decision-ledger" && item.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualDecisionLedger"
      ) &&
      readFileSync(join(root, "src/components/visual-decision-ledger-panel.tsx"), "utf8").includes(
        "可视化决策台账"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("VisualDecisionLedgerPanel"),
    `decisionLedger=${report.summary.visualDecisionLedgerItems}; applied=${report.summary.visualDecisionApplied}; conflicted=${report.summary.visualDecisionConflicted}; review=${report.summary.visualDecisionReviewRequired}.`
  );
  push(
    checks,
    "Visual learning limits are reviewable",
    report.summary.visualLearningLimitItems === report.visualLearningLimits.length &&
      report.summary.visualLearningUnprovenCues > 0 &&
      report.summary.visualLearningReviewLimits > 0 &&
      report.summary.visualLearningBlockedLimits > 0 &&
      report.visualLearningLimits.some(
        (item) => item.category === "unproven_cue" && item.status === "needs_evidence"
      ) &&
      report.visualLearningLimits.some(
        (item) => item.category === "teacher_review" && item.status === "review_required"
      ) &&
      report.visualLearningLimits.some((item) => item.category === "blocked_work" && item.status === "locked") &&
      report.policyEvidence.some((item) => item.id === "visual-learning-limits-visible" && item.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualLearningLimits"
      ) &&
      readFileSync(join(root, "src/components/visual-learning-limits-panel.tsx"), "utf8").includes(
        "可视化学习边界"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("VisualLearningLimitsPanel"),
    `limits=${report.summary.visualLearningLimitItems}; unproven=${report.summary.visualLearningUnprovenCues}; review=${report.summary.visualLearningReviewLimits}; blocked=${report.summary.visualLearningBlockedLimits}.`
  );
  push(
    checks,
    "Visual confidence calibration is reviewable",
    report.visualConfidenceCalibration.status === "calibrated_for_teacher_review" &&
      report.visualConfidenceCalibration.accepted === false &&
      report.visualConfidenceCalibration.packagingGated === true &&
      report.visualConfidenceCalibration.reviewThreshold === 0.82 &&
      report.summary.visualConfidenceCalibrationPassed === report.summary.visualConfidenceCalibrationTotal &&
      report.summary.visualConfidenceCalibrationTotal >= 7 &&
      report.summary.visualConfidenceAutoReady >= 3 &&
      report.summary.visualConfidenceReviewRequired >= 4 &&
      report.visualConfidenceCalibration.items.every((item) => item.passed) &&
      report.visualConfidenceCalibration.items.some(
        (item) => item.expectedOutcome === "automatic" && item.averageConfidence >= report.visualConfidenceCalibration.reviewThreshold
      ) &&
      report.visualConfidenceCalibration.items.some(
        (item) => item.expectedOutcome === "teacher_review" && item.actualOutcome === "teacher_review"
      ) &&
      report.visualConfidenceCalibration.items.some(
        (item) => item.sourceId === "counterexample-midday" && item.conflictedDecisions > 0
      ) &&
      report.policyEvidence.some((item) => item.id === "visual-confidence-calibration" && item.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualConfidenceCalibration"
      ) &&
      readFileSync(join(root, "src/components/visual-confidence-calibration-panel.tsx"), "utf8").includes(
        "可视化置信度校准"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "VisualConfidenceCalibrationPanel"
      ),
    `confidence=${report.summary.visualConfidenceCalibrationPassed}/${report.summary.visualConfidenceCalibrationTotal}; auto=${report.summary.visualConfidenceAutoReady}; review=${report.summary.visualConfidenceReviewRequired}; accepted=${report.visualConfidenceCalibration.accepted}.`
  );
  push(
    checks,
    "Visual behavior scorecard is review-only",
    report.visualBehaviorScorecard.status === "ready_for_teacher_review" &&
      report.visualBehaviorScorecard.reviewOnly === true &&
      report.visualBehaviorScorecard.accepted === false &&
      report.visualBehaviorScorecard.packagingGated === true &&
      report.summary.visualBehaviorScorecardPassed === report.summary.visualBehaviorScorecardCases &&
      report.summary.visualBehaviorScorecardCases >= 15 &&
      report.summary.visualBehaviorScorecardMetricsPassed === report.summary.visualBehaviorScorecardMetrics &&
      report.summary.visualBehaviorScorecardMetrics >= 5 &&
      report.summary.visualBehaviorScorecardAutoRoutes >= 6 &&
      report.summary.visualBehaviorScorecardReviewRoutes >= 9 &&
      report.visualBehaviorScorecard.cases.every((item) => item.passed) &&
      report.visualBehaviorScorecard.metrics.every((metric) => metric.passed) &&
      report.visualBehaviorScorecard.metrics.some((metric) => metric.id === "lighting-accuracy" && metric.correct === metric.total) &&
      report.visualBehaviorScorecard.metrics.some((metric) => metric.id === "review-routing" && metric.correct === metric.total) &&
      report.visualBehaviorScorecard.metrics.some((metric) => metric.id === "memory-effect" && metric.correct === metric.total) &&
      report.visualBehaviorScorecard.cases.some((item) => item.id === "challenge-positive-visual-cue" && item.route === "automatic") &&
      report.visualBehaviorScorecard.cases.some((item) => item.id === "robustness-cafe-sign-midday" && item.route === "teacher_review") &&
      report.visualBehaviorScorecard.blockedActions.includes("Accept technology") &&
      report.visualBehaviorScorecard.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "visual-behavior-scorecard" && item.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "behavior-scorecard" && section.passed) &&
      report.visualTeacherReviewWorksheet.items.some((item) => item.id === "behavior-scorecard-decision") &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualBehaviorScorecard"
      ) &&
      readFileSync(join(root, "src/components/visual-behavior-scorecard-panel.tsx"), "utf8").includes(
        "可视化行为评分卡"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "VisualBehaviorScorecardPanel"
      ),
    `scorecard=${report.summary.visualBehaviorScorecardPassed}/${report.summary.visualBehaviorScorecardCases}; metrics=${report.summary.visualBehaviorScorecardMetricsPassed}/${report.summary.visualBehaviorScorecardMetrics}; auto=${report.summary.visualBehaviorScorecardAutoRoutes}; review=${report.summary.visualBehaviorScorecardReviewRoutes}.`
  );
  push(
    checks,
    "Visual rule coverage matrix is review-only",
    report.visualRuleCoverageMatrix.status === "ready_for_teacher_review" &&
      report.visualRuleCoverageMatrix.reviewOnly === true &&
      report.visualRuleCoverageMatrix.accepted === false &&
      report.visualRuleCoverageMatrix.packagingGated === true &&
      report.summary.visualRuleCoverageRules === report.visualRuleCoverageMatrix.items.length &&
      report.summary.visualRuleCoverageCovered === report.summary.visualRuleCoverageRules &&
      report.summary.visualRuleCoverageRules ===
        report.memoryProvenance.filter(
          (item) =>
            !item.sourceTypes.includes("Spatial teaching") &&
            !item.ruleId.startsWith("spatial-teaching-rule-") &&
            !item.ruleTitle.startsWith("三维带教待确认") &&
            !item.ruleId.startsWith("spatial-construction-correction-rule-") &&
            !item.ruleTitle.startsWith("三维构造纠正待确认") &&
            !item.ruleId.startsWith("human-teaching-rule-") &&
            !item.ruleTitle.startsWith("人类带教待确认")
        ).length &&
      report.summary.visualRuleCoverageSourceOnly === 0 &&
      report.summary.visualRuleCoveragePositiveLinks > 0 &&
      report.summary.visualRuleCoverageReviewLinks > 0 &&
      report.visualRuleCoverageMatrix.items.every((item) => item.passed && item.sourceCount > 0) &&
      report.visualRuleCoverageMatrix.items.some((item) => item.sourceTypes.includes("Visual demonstration")) &&
      report.visualRuleCoverageMatrix.items.some((item) => item.positiveDecisionIds.length > 0) &&
      report.visualRuleCoverageMatrix.items.some((item) => item.reviewDecisionIds.length > 0) &&
      report.visualRuleCoverageMatrix.blockedActions.includes("Accept technology") &&
      report.visualRuleCoverageMatrix.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "visual-rule-coverage-matrix" && item.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "rule-coverage-matrix" && section.passed) &&
      report.visualTeacherReviewWorksheet.items.some((item) => item.id === "rule-coverage-decision") &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualRuleCoverageMatrix"
      ) &&
      readFileSync(join(root, "src/components/visual-rule-coverage-matrix-panel.tsx"), "utf8").includes(
        "可视化规则覆盖矩阵"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "VisualRuleCoverageMatrixPanel"
      ),
    `ruleCoverage=${report.summary.visualRuleCoverageCovered}/${report.summary.visualRuleCoverageRules}; positive=${report.summary.visualRuleCoveragePositiveLinks}; review=${report.summary.visualRuleCoverageReviewLinks}; accepted=${report.visualRuleCoverageMatrix.accepted}.`
  );
  push(
    checks,
    "Visual correction rehearsal is review-only",
    report.visualCorrectionRehearsal.status === "ready_for_teacher_review" &&
      report.visualCorrectionRehearsal.reviewOnly === true &&
      report.visualCorrectionRehearsal.persisted === false &&
      report.visualCorrectionRehearsal.accepted === false &&
      report.visualCorrectionRehearsal.packagingGated === true &&
      report.summary.visualCorrectionRehearsals === report.visualCorrectionRehearsal.cases.length &&
      report.summary.visualCorrectionRehearsalsPassed === report.summary.visualCorrectionRehearsals &&
      report.summary.visualCorrectionRehearsalChanged >= 1 &&
      report.summary.visualCorrectionRehearsalReviewPreserved >= 1 &&
      report.visualCorrectionRehearsal.cases.every((item) => item.passed && item.learningTrace.length >= 3) &&
      report.visualCorrectionRehearsal.cases.some(
        (item) => item.id === "positive-low-sun-correction" && item.changedByCandidateRule
      ) &&
      report.visualCorrectionRehearsal.cases.some(
        (item) => item.id === "counterexample-sign-correction" && item.errorType === "visual_counterexample_memory" && item.afterReview
      ) &&
      report.visualCorrectionRehearsal.blockedActions.includes("Accept technology") &&
      report.visualCorrectionRehearsal.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "visual-correction-rehearsal" && item.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "correction-rehearsal" && section.passed) &&
      report.visualTeacherReviewWorksheet.items.some((item) => item.id === "correction-rehearsal-decision") &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualCorrectionRehearsal"
      ) &&
      readFileSync(join(root, "src/components/visual-correction-rehearsal-panel.tsx"), "utf8").includes(
        "可视化纠正预演"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "VisualCorrectionRehearsalPanel"
      ),
    `correctionRehearsal=${report.summary.visualCorrectionRehearsalsPassed}/${report.summary.visualCorrectionRehearsals}; changed=${report.summary.visualCorrectionRehearsalChanged}; review=${report.summary.visualCorrectionRehearsalReviewPreserved}; persisted=${report.visualCorrectionRehearsal.persisted}.`
  );
  push(
    checks,
    "Visual learning state transition audit is review-only",
    report.visualLearningStateAudit.status === "ready_for_teacher_review" &&
      report.visualLearningStateAudit.reviewOnly === true &&
      report.visualLearningStateAudit.accepted === false &&
      report.visualLearningStateAudit.packagingGated === true &&
      report.summary.visualStateTransitions === report.visualLearningStateAudit.transitions.length &&
      report.summary.visualStateTransitionsPassed === report.summary.visualStateTransitions &&
      report.summary.visualStateTransitionAutomatic >= 3 &&
      report.summary.visualStateTransitionReview >= 2 &&
      report.summary.visualStateTransitionLocked >= 1 &&
      report.visualLearningStateAudit.transitions.every((item) => item.passed) &&
      report.visualLearningStateAudit.transitions.some((item) => item.id === "baseline-to-text-memory") &&
      report.visualLearningStateAudit.transitions.some((item) => item.id === "teacher-correction-to-candidate-transfer") &&
      report.visualLearningStateAudit.transitions.some((item) => item.id === "review-ready-to-packaging-lock" && item.reviewState === "locked") &&
      report.visualLearningStateAudit.blockedActions.includes("Accept technology") &&
      report.visualLearningStateAudit.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "visual-learning-state-transition-audit" && item.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "learning-state-transition-audit" && section.passed) &&
      report.visualTeacherReviewWorksheet.items.some((item) => item.id === "state-transition-decision") &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualLearningStateAudit"
      ) &&
      readFileSync(join(root, "src/components/visual-learning-state-audit-panel.tsx"), "utf8").includes(
        "可视化学习状态转换审计"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "VisualLearningStateAuditPanel"
      ),
    `stateTransitions=${report.summary.visualStateTransitionsPassed}/${report.summary.visualStateTransitions}; auto=${report.summary.visualStateTransitionAutomatic}; review=${report.summary.visualStateTransitionReview}; locked=${report.summary.visualStateTransitionLocked}.`
  );
  push(
    checks,
    "Visual uncertainty escalation audit is review-only",
    report.visualUncertaintyEscalationAudit.status === "ready_for_teacher_review" &&
      report.visualUncertaintyEscalationAudit.reviewOnly === true &&
      report.visualUncertaintyEscalationAudit.accepted === false &&
      report.visualUncertaintyEscalationAudit.packagingGated === true &&
      report.summary.visualUncertaintyEscalations === report.visualUncertaintyEscalationAudit.items.length &&
      report.summary.visualUncertaintyEscalationsReady === report.summary.visualUncertaintyEscalations &&
      report.summary.visualUncertaintyTeacherReview >= 5 &&
      report.summary.visualUncertaintyLocked >= 1 &&
      report.visualUncertaintyEscalationAudit.items.every((item) => item.passed && item.evidenceReady) &&
      report.visualUncertaintyEscalationAudit.items.some((item) => item.id === "conflicted-visual-memory") &&
      report.visualUncertaintyEscalationAudit.items.some((item) => item.id === "ordinary-daylight-escalation") &&
      report.visualUncertaintyEscalationAudit.items.some(
        (item) => item.id === "packaging-lock-escalation" && item.reviewState === "locked"
      ) &&
      report.visualUncertaintyEscalationAudit.blockedActions.includes("Accept technology") &&
      report.visualUncertaintyEscalationAudit.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "visual-uncertainty-escalation-audit" && item.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "uncertainty-escalation-audit" && section.passed) &&
      report.visualTeacherReviewWorksheet.items.some((item) => item.id === "uncertainty-escalation-decision") &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualUncertaintyEscalationAudit"
      ) &&
      readFileSync(join(root, "src/components/visual-uncertainty-escalation-audit-panel.tsx"), "utf8").includes(
        "可视化不确定性升级审计"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "VisualUncertaintyEscalationAuditPanel"
      ),
    `uncertainty=${report.summary.visualUncertaintyEscalationsReady}/${report.summary.visualUncertaintyEscalations}; review=${report.summary.visualUncertaintyTeacherReview}; locked=${report.summary.visualUncertaintyLocked}; accepted=${report.visualUncertaintyEscalationAudit.accepted}.`
  );
  push(
    checks,
    "Spatial engineering teaching model is code-first and review-only",
    report.spatialEngineeringTeachingModel.status === "ready_for_teacher_review" &&
      report.spatialEngineeringTeachingModel.reviewOnly === true &&
      report.spatialEngineeringTeachingModel.accepted === false &&
      report.spatialEngineeringTeachingModel.packagingGated === true &&
      report.spatialEngineeringTeachingModel.teachingInputMode === "code_first" &&
      report.spatialEngineeringTeachingModel.codeTeachingProtocol.format === "json_dsl" &&
      report.spatialEngineeringTeachingModel.codeTeachingProtocol.imageUse === "optional_reference_only" &&
      spatialModelReadable &&
      report.summary.spatialFitCandidates === report.spatialEngineeringTeachingModel.candidates.length &&
      report.summary.spatialFitCandidatesReady === report.summary.spatialFitCandidates &&
      report.summary.spatialTeacherSelectableCandidates === report.summary.spatialFitCandidates &&
      report.summary.spatialModelingRules === report.spatialEngineeringTeachingModel.extractedRules.length &&
      report.summary.spatialTeachingRehearsals === report.spatialEngineeringTeachingModel.teachingRehearsals.length &&
      report.summary.spatialTeachingRehearsalsReady === report.summary.spatialTeachingRehearsals &&
      report.summary.spatialGuidedGenerationSteps === report.spatialEngineeringTeachingModel.guidedGenerationSteps.length &&
      report.summary.spatialGuidedGenerationStepsReady === report.summary.spatialGuidedGenerationSteps &&
      report.summary.spatialConstructionPredictionPlans ===
        report.spatialEngineeringTeachingModel.constructionPredictionPlans.length &&
      report.summary.spatialConstructionPredictionPlansReady ===
        report.summary.spatialConstructionPredictionPlans &&
      report.summary.spatialBatchSamples === report.spatialEngineeringTeachingModel.batchPatternLearning.sampleCount &&
      report.summary.spatialBatchRuleCandidates ===
        report.spatialEngineeringTeachingModel.batchPatternLearning.ruleCandidates.length &&
      report.summary.spatialPositionParameterRows ===
        report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.parameterRows.length &&
      report.summary.spatialPositionParameterRowsReady === report.summary.spatialPositionParameterRows &&
      report.summary.spatialPositionParameterReportReady === 1 &&
      report.summary.spatialCodePatchMemories === report.spatialConstructionCodePatchMemoryReplays.length &&
      report.summary.spatialCodePatchMemoriesReady ===
        report.spatialConstructionCodePatchMemoryReplays.filter((item) => item.passed).length &&
      report.summary.spatialCodePatchMemoryMatches === report.spatialConstructionCodePatchMemoryMatches.length &&
      report.summary.spatialCodePatchMemoryMatchesReady ===
        report.spatialConstructionCodePatchMemoryMatches.filter((item) => item.passed).length &&
      report.spatialConstructionCodePatchMemoryReplays.every(
        (item) =>
          item.accepted === false &&
          item.packagingGated === true &&
          item.teacherReviewRequired === true &&
          item.anchorPoints.length >= 2 &&
          item.geometryPatch.length > 0 &&
          item.nextStepPrediction.includes("下一步预测")
      ) &&
      report.spatialConstructionCodePatchMemoryMatches.every(
        (item) =>
          item.accepted === false &&
          item.packagingGated === true &&
          item.matchScore >= 0 &&
          item.conflictChecks.length >= 3 &&
          item.teacherQuestion.includes("老师") &&
          item.nextStepPrediction.includes("下一步预测")
      ) &&
      report.spatialEngineeringTeachingModel.constructionPredictionPlans.length ===
        report.spatialEngineeringTeachingModel.candidates.length &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.status === "ready_for_teacher_review" &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.reviewOnly === true &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.accepted === false &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.packagingGated === true &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.sampleCount >= 12 &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.samples.every((sample) => sample.evidence.includes("残差")) &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.status ===
        "ready_for_teacher_review" &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.reviewOnly === true &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.accepted === false &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.packagingGated === true &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.parameterRows.length >= 5 &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.parameterRows.every(
        (row) =>
          row.reviewOnly === true &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.passed === true &&
          row.teacherQuestion.includes("老师") &&
          row.range >= 0 &&
          row.standardDeviation >= 0
      ) &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.ruleCandidates.length >= 2 &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.ruleCandidates.every(
        (candidate) =>
          candidate.reviewState === "awaiting_teacher_review" &&
          candidate.teacherQuestion.includes("老师") &&
          candidate.nextStepPrediction.includes("下一步预测")
      ) &&
      report.spatialEngineeringTeachingModel.constructionPredictionPlans.every(
        (plan) =>
          plan.accepted === false &&
          plan.packagingGated === true &&
          plan.memoryPolicy === "preview_only_requires_teacher_confirmation" &&
          plan.anchorPoints.length >= 2 &&
          plan.constructionSteps.length >= 3 &&
          plan.constructionSteps.every(
            (step) =>
              step.passed &&
              step.reviewState === "awaiting_teacher_review" &&
              step.validationCheck.length > 0 &&
              step.teacherCorrectionSlot.length > 0 &&
              step.nextStepPrediction.includes("下一步预测")
          )
      ) &&
      report.spatialEngineeringTeachingModel.guidedGenerationSteps.length >= 4 &&
      report.spatialEngineeringTeachingModel.guidedGenerationSteps.every(
        (step) =>
          step.passed &&
          step.reviewState === "awaiting_teacher_review" &&
          step.whyThisStep.length > 0 &&
          step.teacherCorrectionSlot.length > 0 &&
          step.nextStepPrediction.includes("下一步预测")
      ) &&
      report.spatialEngineeringTeachingModel.candidates.every((candidate) => candidate.passed && candidate.teacherSelectable) &&
      report.spatialEngineeringTeachingModel.extractedRules.every((rule) => rule.passed) &&
      report.spatialEngineeringTeachingModel.teachingRehearsals.every(
        (rehearsal) =>
          rehearsal.passed &&
          rehearsal.memoryPolicy === "preview_only_requires_teacher_confirmation" &&
          rehearsal.nextStepPrediction.includes("下一步预测") &&
          rehearsal.conflictChecks.length >= 3
      ) &&
      report.spatialEngineeringTeachingModel.coordinateDialogue.status === "ready_for_teacher_review" &&
      report.spatialEngineeringTeachingModel.coordinateDialogue.inputMode === "coordinate_dialogue_code" &&
      report.spatialEngineeringTeachingModel.coordinateDialogue.reviewOnly === true &&
      report.spatialEngineeringTeachingModel.coordinateDialogue.accepted === false &&
      report.spatialEngineeringTeachingModel.coordinateDialogue.packagingGated === true &&
      report.spatialEngineeringTeachingModel.coordinateDialogue.commands.length >= 4 &&
      report.spatialEngineeringTeachingModel.coordinateDialogue.turns.length >= 4 &&
      report.spatialEngineeringTeachingModel.coordinateDialogue.turns.every(
        (turn) =>
          turn.passed &&
          turn.reviewState === "awaiting_teacher_review" &&
          turn.aiInterpretation.length > 0 &&
          turn.coordinateEffect.length > 0 &&
          turn.candidateImpact.length > 0 &&
          turn.whyThisStep.length > 0 &&
          turn.teacherCorrectionSlot.length > 0 &&
          turn.nextStepPrediction.includes("下一步预测")
      ) &&
      report.spatialEngineeringTeachingModel.coordinateDialogue.blockedActions.includes("Package") &&
      report.spatialEngineeringTeachingModel.memoryPersistence.mode === "paused_rule_memory" &&
      report.spatialEngineeringTeachingModel.memoryPersistence.apiPath === "/api/spatial-teaching-memories" &&
      report.spatialEngineeringTeachingModel.memoryPersistence.requiresTeacherConfirmation === true &&
      report.spatialEngineeringTeachingModel.memoryPersistence.autoApplies === false &&
      report.spatialEngineeringTeachingModel.memoryPersistence.accepted === false &&
      report.spatialEngineeringTeachingModel.memoryPersistence.packagingGated === true &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes("analyzeSpatialMemoryConflicts") &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes("conflict_requires_teacher") &&
      report.spatialEngineeringTeachingModel.blockedActions.includes("Accept technology") &&
      report.spatialEngineeringTeachingModel.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "spatial-engineering-teaching-model" && item.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "spatial-engineering-teaching-model" && section.passed) &&
      report.visualTeacherReviewWorksheet.items.some((item) => item.id === "spatial-fit-selection-decision") &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes("parseSpatialTeachingInput") &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes("parseSpatialCoordinateDialogueCode") &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes(
        "buildSpatialCoordinateDialoguePreview"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes(
        "defaultSpatialCoordinateDialogueJson"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes("fitLeastSquaresLine") &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes("SpatialConstructionPredictionPlan") &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes(
        "buildSpatialConstructionCorrectionDraft"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes(
        "buildSpatialConstructionRevisionCandidates"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes(
        "buildSpatialConstructionRevisionSelectionPreview"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes(
        "parseSpatialConstructionCodePatch"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes(
        "buildSpatialCodePatchMatchReviewRecord"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes("SpatialBatchPatternLearning") &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes("buildSpatialBatchPatternLearning") &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes(
        "SpatialPositionParameterLearningReport"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes(
        "SpatialCandidateSelectionImpactPreview"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes("invalid teaching code") &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes(
        "keeps spatial teaching explanations readable in Chinese"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes(
        "previews direct 3D coordinate dialogue commands"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes("最小二乘") &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes("批量样本共识") &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes("constructionPredictionPlans") &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes(
        "spatial_construction_correction"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes(
        "regenerates local construction candidates"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes(
        "stepwise code preview"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes(
        "edit construction preview JSON"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes(
        "stores teacher-edited construction JSON"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes(
        "records teacher review of code patch matches"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "三维工程带教模型"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "代码优先带教"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "实时解析结果"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "三维坐标对话脚本"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "当前数学建模候选"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "人类粗线条先被保留为白色虚线"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "老师下一步可教"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "批量示教数学建模"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "批量共识模型"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "位置参数学习报告"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "候选选择影响预演"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "老师坐标对话代码"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "AI 如何理解"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "三维点位带教表"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "增加点"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "候选后续预测"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "构造预测可审查"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "老师纠正构造预测"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "纠正后重新生成候选"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "选择此候选继续预演"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "已选候选的代码化预演"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "老师可直接改 JSON 构造草稿"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "代码草稿校验通过"
      ) &&
      readFileSync(join(root, "src/components/spatial-memory-review-panel.tsx"), "utf8").includes(
        "老师代码草稿记忆回放"
      ) &&
      readFileSync(join(root, "src/components/spatial-memory-review-panel.tsx"), "utf8").includes(
        "spatialConstructionCodePatchMemoryReplays"
      ) &&
      readFileSync(join(root, "src/components/spatial-memory-review-panel.tsx"), "utf8").includes(
        "旧代码草稿命中新构造预演"
      ) &&
      readFileSync(join(root, "src/components/spatial-memory-review-panel.tsx"), "utf8").includes(
        "保存命中审查"
      ) &&
      readFileSync(join(root, "src/components/spatial-memory-review-panel.tsx"), "utf8").includes(
        "spatialConstructionCodePatchMemoryMatches"
      ) &&
      readFileSync(join(root, "src/app/api/spatial-code-patch-match-reviews/route.ts"), "utf8").includes(
        "buildSpatialCodePatchMatchReviewRecord"
      ) &&
      readFileSync(join(root, "src/app/api/spatial-code-patch-match-reviews/route.ts"), "utf8").includes(
        "ruleEnabled: false"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "codePatch: parsedRevisionCodePatch"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "/api/spatial-construction-corrections"
      ) &&
      readFileSync(join(root, "src/app/api/spatial-construction-corrections/route.ts"), "utf8").includes(
        "buildSpatialConstructionCorrectionDraft"
      ) &&
      readFileSync(join(root, "src/app/api/spatial-construction-corrections/route.ts"), "utf8").includes(
        "parseSpatialConstructionCodePatch"
      ) &&
      readFileSync(join(root, "src/app/api/spatial-construction-corrections/route.ts"), "utf8").includes(
        "codePatchSaved"
      ) &&
      readFileSync(join(root, "src/app/api/spatial-construction-corrections/route.ts"), "utf8").includes(
        "ruleEnabled: false"
      ) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "spatialConstructionCorrectionCount"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "规则预演"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "保存为待确认记忆"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "三维带教分步生成记录"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "为什么这样生成"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "老师纠正点"
      ) &&
      readFileSync(join(root, "src/components/spatial-memory-review-panel.tsx"), "utf8").includes(
        "三维带教记忆审查台"
      ) &&
      readFileSync(join(root, "src/components/spatial-memory-review-panel.tsx"), "utf8").includes(
        "冲突处理要求"
      ) &&
      readFileSync(join(root, "src/components/spatial-memory-review-panel.tsx"), "utf8").includes(
        "老师审查备注"
      ) &&
      readFileSync(join(root, "src/components/spatial-memory-review-panel.tsx"), "utf8").includes(
        "像下棋一样动态预测下一步"
      ) &&
      readFileSync(join(root, "src/components/spatial-memory-review-panel.tsx"), "utf8").includes(
        "/api/spatial-teaching-memory-reviews"
      ) &&
      readFileSync(join(root, "src/app/api/spatial-teaching-memory-reviews/route.ts"), "utf8").includes(
        "buildSpatialMemoryTeacherReviewRecord"
      ) &&
      readFileSync(join(root, "src/app/api/spatial-teaching-memory-reviews/route.ts"), "utf8").includes(
        "ruleEnabled: false"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes(
        "buildSpatialMemoryTeacherReviewRecord"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes(
        "像下棋一样预测下一步"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes(
        "records teacher review notes without enabling spatial memory"
      ) &&
      readFileSync(join(root, "src/app/api/spatial-teaching-memories/route.ts"), "utf8").includes(
        "buildSpatialTeachingMemoryDraft"
      ) &&
      readFileSync(join(root, "src/app/api/spatial-teaching-memories/route.ts"), "utf8").includes(
        "buildSpatialTeachingMemoryDraftFromCode"
      ) &&
      readFileSync(join(root, "src/app/api/spatial-teaching-memories/route.ts"), "utf8").includes(
        "serverRecomputedCandidates"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "selectedCandidateId"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.test.ts"), "utf8").includes(
        "recomputes selected spatial memory from teacher code on the server side"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "SpatialEngineeringTeachingPanel"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "SpatialMemoryReviewPanel"
      ) &&
      report.summary.spatialResidualLenses >= 3 &&
      report.summary.spatialResidualVectors >= report.spatialEngineeringTeachingModel.rawStroke.length * 3 &&
      report.summary.spatialDirectionToleranceChecks ===
        report.spatialEngineeringTeachingModel.directionToleranceChecks.length &&
      report.summary.spatialDirectionToleranceChecks >= report.spatialEngineeringTeachingModel.candidates.length &&
      report.summary.spatialDirectionToleranceReady === report.summary.spatialDirectionToleranceChecks &&
      report.summary.spatialCandidateComparisons ===
        report.spatialEngineeringTeachingModel.candidateComparisonMatrix.length &&
      report.summary.spatialCandidateComparisonsReady === report.summary.spatialCandidateComparisons &&
      report.summary.spatialCandidateSelectionImpactPreviews ===
        report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.length &&
      report.summary.spatialCandidateSelectionImpactPreviewsReady ===
        report.summary.spatialCandidateSelectionImpactPreviews &&
      report.summary.spatialCandidateSelectionDisabledDrafts ===
        report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.reduce(
          (sum, preview) => sum + preview.disabledRuleDrafts.length,
          0
        ) &&
      report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.length ===
        report.spatialEngineeringTeachingModel.candidates.length &&
      report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.every(
        (preview) =>
          preview.reviewOnly === true &&
          preview.accepted === false &&
          preview.packagingGated === true &&
          preview.passed === true &&
          preview.disabledRuleDrafts.length >= 2 &&
          preview.disabledRuleDrafts.every(
            (draft) => draft.willBeEnabled === false && draft.teacherReviewRequired === true
          ) &&
          preview.predictedSteps.length >= 4 &&
          preview.predictedSteps.every(
            (step) =>
              step.reviewState === "awaiting_teacher_review" &&
              step.nextStepPrediction.includes("下一步预测") &&
              step.teacherCorrectionSlot.includes("老师")
          ) &&
          preview.memoryImpact.autoApplies === false &&
          preview.memoryImpact.requiresTeacherConfirmation === true &&
          preview.teacherQuestion.includes("老师") &&
          preview.blockedActions.includes("Package")
      ) &&
      report.spatialEngineeringTeachingModel.directionToleranceChecks.every(
        (check) =>
          check.reviewOnly === true &&
          check.accepted === false &&
          check.packagingGated === true &&
          check.passed &&
          check.status === "within_tolerance" &&
          check.angularDeviationDeg <= check.allowedDeviationDeg &&
          check.teacherQuestion.includes("老师")
      ) &&
      report.spatialEngineeringTeachingModel.residualTeachingLenses.every(
        (lens) =>
          lens.reviewOnly === true &&
          lens.accepted === false &&
          lens.packagingGated === true
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "拟合误差教学放大镜"
      ),
    `spatial=${report.summary.spatialFitCandidatesReady}/${report.summary.spatialFitCandidates}; rehearsals=${report.summary.spatialTeachingRehearsalsReady}/${report.summary.spatialTeachingRehearsals}; construction=${report.summary.spatialConstructionPredictionPlansReady}/${report.summary.spatialConstructionPredictionPlans}; batch=${report.summary.spatialBatchSamples}/${report.summary.spatialBatchRuleCandidates}; positionRows=${report.summary.spatialPositionParameterRowsReady}/${report.summary.spatialPositionParameterRows}; impact=${report.summary.spatialCandidateSelectionImpactPreviewsReady}/${report.summary.spatialCandidateSelectionImpactPreviews}; codePatch=${report.summary.spatialCodePatchMemoriesReady}/${report.summary.spatialCodePatchMemories}; match=${report.summary.spatialCodePatchMemoryMatchesReady}/${report.summary.spatialCodePatchMemoryMatches}; residualLenses=${report.summary.spatialResidualLenses}; residualVectors=${report.summary.spatialResidualVectors}; comparisons=${report.summary.spatialCandidateComparisons}; code=${report.spatialEngineeringTeachingModel.teachingInputMode}; image=${report.spatialEngineeringTeachingModel.codeTeachingProtocol.imageUse}; readable=${spatialModelReadable}.`
  );
  push(
    checks,
    "Spatial direction tolerance review is visible",
    report.summary.spatialDirectionToleranceChecks ===
      report.spatialEngineeringTeachingModel.directionToleranceChecks.length &&
      report.summary.spatialDirectionToleranceReady === report.summary.spatialDirectionToleranceChecks &&
      report.spatialEngineeringTeachingModel.directionToleranceChecks.every(
        (check) =>
          check.reviewOnly === true &&
          check.accepted === false &&
          check.packagingGated === true &&
          check.passed &&
          check.status === "within_tolerance" &&
          check.angularDeviationDeg <= check.allowedDeviationDeg &&
          check.teacherQuestion.includes("老师")
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "方向容差审查"
      ),
    `direction=${report.summary.spatialDirectionToleranceReady}/${report.summary.spatialDirectionToleranceChecks}; accepted=${report.spatialEngineeringTeachingModel.accepted}; packaging=${report.spatialEngineeringTeachingModel.packagingGated}.`
  );
  push(
    checks,
    "Spatial fit candidate comparison matrix is visible",
    report.summary.spatialCandidateComparisons ===
      report.spatialEngineeringTeachingModel.candidateComparisonMatrix.length &&
      report.summary.spatialCandidateComparisons === report.summary.spatialFitCandidates &&
      report.summary.spatialCandidateComparisonsReady === report.summary.spatialCandidateComparisons &&
      report.spatialEngineeringTeachingModel.candidateComparisonMatrix.every(
        (row) =>
          row.reviewOnly === true &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.passed === true &&
          row.residual >= 0 &&
          row.maxResidual >= row.residual &&
          row.angularDeviationDeg >= 0 &&
          row.residualRank > 0 &&
          row.directionRank > 0 &&
          row.recommendedReviewOrder > 0 &&
          row.teacherDecisionHint.includes("老师") &&
          row.selectionTradeoff.length > 0
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "拟合候选对比矩阵"
      ),
    `comparison=${report.summary.spatialCandidateComparisonsReady}/${report.summary.spatialCandidateComparisons}; accepted=${report.spatialEngineeringTeachingModel.accepted}; packaging=${report.spatialEngineeringTeachingModel.packagingGated}.`
  );
  push(
    checks,
    "Spatial candidate selection impact preview is visible",
    report.summary.spatialCandidateSelectionImpactPreviews ===
      report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.length &&
      report.summary.spatialCandidateSelectionImpactPreviews === report.summary.spatialFitCandidates &&
      report.summary.spatialCandidateSelectionImpactPreviewsReady ===
        report.summary.spatialCandidateSelectionImpactPreviews &&
      report.summary.spatialCandidateSelectionDisabledDrafts >= report.summary.spatialFitCandidates * 2 &&
      report.summary.spatialCandidateImpactCorrectionRehearsals ===
        report.summary.spatialCandidateSelectionImpactPreviews &&
      report.summary.spatialCandidateImpactCorrectionRehearsalsReady ===
        report.summary.spatialCandidateImpactCorrectionRehearsals &&
      report.summary.spatialCandidateImpactSecondRoundCandidates >=
        report.summary.spatialCandidateSelectionImpactPreviews * 3 &&
      report.summary.spatialCandidateImpactSecondRoundSelectionPreviews ===
        report.summary.spatialCandidateSelectionImpactPreviews &&
      report.summary.spatialCandidateImpactSecondRoundSelectionPreviewsReady ===
        report.summary.spatialCandidateImpactSecondRoundSelectionPreviews &&
      report.summary.spatialCandidateImpactSecondRoundSelectionTraceSteps >=
        report.summary.spatialCandidateImpactSecondRoundSelectionPreviews * 4 &&
      report.summary.spatialCandidateImpactSecondRoundSelectionTraceStepsReady ===
        report.summary.spatialCandidateImpactSecondRoundSelectionTraceSteps &&
      report.summary.spatialCandidateImpactRegeneratedDrafts >=
        report.summary.spatialCandidateImpactSecondRoundCandidates * 2 &&
      report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.every(
        (preview) =>
          preview.reviewOnly === true &&
          preview.accepted === false &&
          preview.packagingGated === true &&
          preview.passed === true &&
          preview.disabledRuleDrafts.length >= 2 &&
          preview.disabledRuleDrafts.every(
            (draft) =>
              draft.willBeEnabled === false &&
              draft.teacherReviewRequired === true &&
              draft.conflictBoundary.length > 0
          ) &&
          preview.conflictBoundaries.length >= 3 &&
          preview.predictedSteps.length >= 4 &&
          preview.predictedSteps.every(
            (step) =>
              step.reviewState === "awaiting_teacher_review" &&
              step.nextStepPrediction.includes("下一步预测") &&
              step.whyThisStep.length > 0 &&
              step.teacherCorrectionSlot.includes("老师")
          ) &&
          preview.memoryImpact.mode === "disabled_rule_draft_preview" &&
          preview.memoryImpact.autoApplies === false &&
          preview.memoryImpact.requiresTeacherConfirmation === true &&
          preview.teacherQuestion.includes("老师") &&
          preview.correctionRehearsal.reviewOnly === true &&
          preview.correctionRehearsal.accepted === false &&
          preview.correctionRehearsal.packagingGated === true &&
          preview.correctionRehearsal.passed === true &&
          preview.correctionRehearsal.secondRoundCandidates.length >= 3 &&
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
          preview.selectedSecondRoundPreview.blockedActions.includes("Accept technology") &&
          preview.correctionRehearsal.secondRoundCandidates.every(
            (candidate) =>
              candidate.reviewOnly === true &&
              candidate.accepted === false &&
              candidate.packagingGated === true &&
              candidate.passed === true &&
              candidate.regeneratedRuleDrafts.length >= 2 &&
              candidate.regeneratedRuleDrafts.every(
                (draft) => draft.willBeEnabled === false && draft.teacherReviewRequired === true
              ) &&
              candidate.regeneratedConflictBoundaries.length >= 4 &&
              candidate.nextStepPrediction.includes("下一步预测")
          ) &&
          preview.blockedActions.includes("Package")
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "候选选择影响预演"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "老师纠正后二轮即时再生"
      ) &&
      !readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "<Badge tone=\"blue\">老师纠正后二轮再生</Badge>"
      ),
    `impact=${report.summary.spatialCandidateSelectionImpactPreviewsReady}/${report.summary.spatialCandidateSelectionImpactPreviews}; secondRound=${report.summary.spatialCandidateImpactSecondRoundCandidates}; selectedFollowUps=${report.summary.spatialCandidateImpactSecondRoundSelectionPreviewsReady}/${report.summary.spatialCandidateImpactSecondRoundSelectionPreviews}; selectionTraceSteps=${report.summary.spatialCandidateImpactSecondRoundSelectionTraceStepsReady}/${report.summary.spatialCandidateImpactSecondRoundSelectionTraceSteps}; regeneratedDrafts=${report.summary.spatialCandidateImpactRegeneratedDrafts}; accepted=${report.spatialEngineeringTeachingModel.accepted}; packaging=${report.spatialEngineeringTeachingModel.packagingGated}.`
  );
  push(
    checks,
    "Spatial batch position parameter learning report is visible",
    report.summary.spatialPositionParameterRows ===
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.parameterRows.length &&
      report.summary.spatialPositionParameterRowsReady === report.summary.spatialPositionParameterRows &&
      report.summary.spatialPositionParameterReportReady === 1 &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.status ===
        "ready_for_teacher_review" &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.reviewOnly === true &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.accepted === false &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.packagingGated === true &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.sourceSampleCount >= 12 &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.learnedModel ===
        "sample_mean_variation_envelope" &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.parameterRows.length >= 5 &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.parameterRows.every(
        (row) =>
          row.passed === true &&
          row.reviewOnly === true &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.range >= 0 &&
          row.standardDeviation >= 0 &&
          row.teacherQuestion.includes("老师")
      ) &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.directionModel
        .teacherQuestion.includes("老师") &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.toleranceRecommendation.rationale.includes(
        "老师输入容差"
      ) &&
      report.spatialEngineeringTeachingModel.batchPatternLearning.positionParameterLearningReport.outlierPolicy.ruleDraft.includes(
        "不自动套用"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "位置参数学习报告"
      ),
    `positionRows=${report.summary.spatialPositionParameterRowsReady}/${report.summary.spatialPositionParameterRows}; accepted=${report.spatialEngineeringTeachingModel.accepted}; packaging=${report.spatialEngineeringTeachingModel.packagingGated}.`
  );
  push(
    checks,
    "Spatial circular arc fitting is visible",
    report.summary.spatialArcFitCandidates === 1 &&
      report.spatialEngineeringTeachingModel.candidates.some(
        (candidate) =>
          candidate.id === "fit-circular-arc-guide" &&
          candidate.model === "circular_arc" &&
          candidate.teacherSelectable === true &&
          candidate.passed === true &&
          candidate.arc?.plane === "xz" &&
          typeof candidate.arc.radius === "number" &&
          candidate.arc.radius > 0
      ) &&
      report.spatialEngineeringTeachingModel.residualTeachingLenses.some(
        (lens) =>
          lens.candidateId === "fit-circular-arc-guide" &&
          lens.reviewOnly === true &&
          lens.accepted === false &&
          lens.packagingGated === true
      ) &&
      report.spatialEngineeringTeachingModel.directionToleranceChecks.some(
        (check) =>
          check.candidateId === "fit-circular-arc-guide" &&
          check.reviewOnly === true &&
          check.accepted === false &&
          check.packagingGated === true &&
          check.passed === true
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "圆弧意图候选"
      ),
    `arc=${report.summary.spatialArcFitCandidates}; candidates=${report.summary.spatialFitCandidates}; accepted=${report.spatialEngineeringTeachingModel.accepted}; packaging=${report.spatialEngineeringTeachingModel.packagingGated}.`
  );
  push(
    checks,
    "Spatial smooth spline fitting is visible",
    report.summary.spatialSplineFitCandidates === 1 &&
      report.spatialEngineeringTeachingModel.candidates.some(
        (candidate) =>
          candidate.id === "fit-smooth-bezier-guide" &&
          candidate.model === "bezier_spline" &&
          candidate.teacherSelectable === true &&
          candidate.passed === true &&
          Array.isArray(candidate.bezier?.controlHandles) &&
          candidate.bezier.controlHandles.length === 4 &&
          candidate.bezier.sampledPointCount >= 7 &&
          candidate.bezier.maxHandleOffset > 0
      ) &&
      report.spatialEngineeringTeachingModel.residualTeachingLenses.some(
        (lens) =>
          lens.candidateId === "fit-smooth-bezier-guide" &&
          lens.reviewOnly === true &&
          lens.accepted === false &&
          lens.packagingGated === true
      ) &&
      report.spatialEngineeringTeachingModel.directionToleranceChecks.some(
        (check) =>
          check.candidateId === "fit-smooth-bezier-guide" &&
          check.reviewOnly === true &&
          check.accepted === false &&
          check.packagingGated === true &&
          check.passed === true
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "平滑样条意图候选"
      ),
    `spline=${report.summary.spatialSplineFitCandidates}; candidates=${report.summary.spatialFitCandidates}; accepted=${report.spatialEngineeringTeachingModel.accepted}; packaging=${report.spatialEngineeringTeachingModel.packagingGated}.`
  );
  push(
    checks,
    "Spatial multi-segment spline fitting is visible",
    report.summary.spatialMultiSegmentSplineFitCandidates === 1 &&
      report.spatialEngineeringTeachingModel.candidates.some(
        (candidate) =>
          candidate.id === "fit-multi-segment-spline-guide" &&
          candidate.model === "multi_segment_bezier_spline" &&
          candidate.teacherSelectable === true &&
          candidate.passed === true &&
          candidate.multiSegment?.segmentCount === 2 &&
          Array.isArray(candidate.multiSegment.knotPoints) &&
          candidate.multiSegment.knotPoints.length === 3 &&
          candidate.multiSegment.sampledPointCount >= 9 &&
          candidate.multiSegment.maxSegmentSpan > 0
      ) &&
      report.spatialEngineeringTeachingModel.residualTeachingLenses.some(
        (lens) =>
          lens.candidateId === "fit-multi-segment-spline-guide" &&
          lens.reviewOnly === true &&
          lens.accepted === false &&
          lens.packagingGated === true
      ) &&
      report.spatialEngineeringTeachingModel.directionToleranceChecks.some(
        (check) =>
          check.candidateId === "fit-multi-segment-spline-guide" &&
          check.reviewOnly === true &&
          check.accepted === false &&
          check.packagingGated === true &&
          check.passed === true
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "多段样条意图候选"
      ),
    `multiSpline=${report.summary.spatialMultiSegmentSplineFitCandidates}; candidates=${report.summary.spatialFitCandidates}; accepted=${report.spatialEngineeringTeachingModel.accepted}; packaging=${report.spatialEngineeringTeachingModel.packagingGated}.`
  );
  push(
    checks,
    "Spatial surface patch teaching lens is visible",
    report.summary.spatialSurfacePatchLenses === 1 &&
      report.summary.spatialSurfacePatchReady === 1 &&
      report.summary.spatialSurfacePatchVectors === report.spatialEngineeringTeachingModel.rawStroke.length &&
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.id === "surface-patch-height-field-lens" &&
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.fitModel === "local_xz_height_patch" &&
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.reviewOnly === true &&
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.accepted === false &&
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.packagingGated === true &&
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.passed === true &&
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.equation.includes("y=") &&
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.patchCorners.length === 4 &&
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.vectors.length ===
        report.spatialEngineeringTeachingModel.rawStroke.length &&
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.vectors.every(
        (vector) =>
          vector.heightResidual >= 0 &&
          vector.projectedPatchPoint &&
          typeof vector.projectedPatchPoint.y === "number"
      ) &&
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.teacherQuestion.includes("老师") &&
      report.spatialEngineeringTeachingModel.surfacePatchTeachingLens.nextStepPrediction.includes("下一步预测") &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "曲面 patch 教学放大镜"
      ),
    `surfacePatch=${report.summary.spatialSurfacePatchReady}/${report.summary.spatialSurfacePatchLenses}; vectors=${report.summary.spatialSurfacePatchVectors}; accepted=${report.spatialEngineeringTeachingModel.accepted}; packaging=${report.spatialEngineeringTeachingModel.packagingGated}.`
  );
  push(
    checks,
    "Spatial surface patch fitting candidate is visible",
    report.summary.spatialSurfacePatchFitCandidates === 1 &&
      report.spatialEngineeringTeachingModel.candidates.some(
        (candidate) =>
          candidate.id === "fit-surface-patch-guide" &&
          candidate.model === "surface_patch" &&
          candidate.teacherSelectable === true &&
          candidate.passed === true &&
          candidate.surfacePatch?.fitModel === "local_xz_height_patch" &&
          candidate.surfacePatch.patchCorners.length === 4 &&
          candidate.surfacePatch.meanHeightResidual >= 0 &&
          candidate.surfacePatch.maxHeightResidual >= candidate.surfacePatch.meanHeightResidual
      ) &&
      report.spatialEngineeringTeachingModel.residualTeachingLenses.some(
        (lens) =>
          lens.candidateId === "fit-surface-patch-guide" &&
          lens.reviewOnly === true &&
          lens.accepted === false &&
          lens.packagingGated === true &&
          lens.vectors.length === report.spatialEngineeringTeachingModel.rawStroke.length
      ) &&
      report.spatialEngineeringTeachingModel.directionToleranceChecks.some(
        (check) =>
          check.candidateId === "fit-surface-patch-guide" &&
          check.reviewOnly === true &&
          check.accepted === false &&
          check.packagingGated === true &&
          check.passed === true
      ) &&
      report.spatialEngineeringTeachingModel.candidateSelectionImpactPreviews.some(
        (preview) =>
          preview.candidateId === "fit-surface-patch-guide" &&
          preview.reviewOnly === true &&
          preview.accepted === false &&
          preview.packagingGated === true &&
          preview.memoryImpact.autoApplies === false
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "曲面拟合意图候选"
      ),
    `surfaceFit=${report.summary.spatialSurfacePatchFitCandidates}; candidates=${report.summary.spatialFitCandidates}; accepted=${report.spatialEngineeringTeachingModel.accepted}; packaging=${report.spatialEngineeringTeachingModel.packagingGated}.`
  );
  const surfacePatchStabilityReport =
    report.spatialEngineeringTeachingModel.batchPatternLearning.surfacePatchStabilityReport;
  push(
    checks,
    "Spatial surface patch batch stability report is visible",
    report.summary.spatialSurfacePatchStabilitySamples === surfacePatchStabilityReport.sourceSampleCount &&
      report.summary.spatialSurfacePatchStabilitySamples >= 12 &&
      report.summary.spatialSurfacePatchStabilityReady === 1 &&
      report.summary.spatialSurfacePatchStabilityOutliers === surfacePatchStabilityReport.outlierPolicy.outlierCount &&
      report.summary.spatialSurfacePatchSelectionReplays === surfacePatchStabilityReport.teacherSelectionReplay.options.length &&
      report.summary.spatialSurfacePatchSelectionReplays === 3 &&
      report.summary.spatialSurfacePatchSelectionReplayReady === 1 &&
      report.summary.spatialSurfacePatchSelectionReplayDisabledDrafts ===
        surfacePatchStabilityReport.teacherSelectionReplay.options.reduce(
          (count, option) => count + option.disabledRuleDrafts.length,
          0
        ) &&
      surfacePatchStabilityReport.status === "ready_for_teacher_review" &&
      surfacePatchStabilityReport.reviewOnly === true &&
      surfacePatchStabilityReport.accepted === false &&
      surfacePatchStabilityReport.packagingGated === true &&
      surfacePatchStabilityReport.learnedModel === "surface_patch_gradient_residual_consensus" &&
      surfacePatchStabilityReport.samples.length === surfacePatchStabilityReport.sourceSampleCount &&
      surfacePatchStabilityReport.samples.every(
        (sample) =>
          typeof sample.xSlope === "number" &&
          typeof sample.zSlope === "number" &&
          sample.meanHeightResidual >= 0 &&
          sample.maxHeightResidual >= sample.meanHeightResidual &&
          sample.teacherQuestion.includes("老师")
      ) &&
      surfacePatchStabilityReport.gradientConsensus.teacherQuestion.includes("老师") &&
      surfacePatchStabilityReport.residualEnvelope.stableSampleCount >= 3 &&
      surfacePatchStabilityReport.residualEnvelope.maxHeightResidual >=
        surfacePatchStabilityReport.residualEnvelope.meanHeightResidual &&
      surfacePatchStabilityReport.outlierPolicy.teacherQuestion.includes("老师") &&
      surfacePatchStabilityReport.teacherSelectionReplay.mode === "surface_patch_teacher_selection_replay" &&
      surfacePatchStabilityReport.teacherSelectionReplay.memoryPolicy.mode === "disabled_rule_draft_preview" &&
      surfacePatchStabilityReport.teacherSelectionReplay.memoryPolicy.autoApplies === false &&
      surfacePatchStabilityReport.teacherSelectionReplay.memoryPolicy.requiresTeacherConfirmation === true &&
      surfacePatchStabilityReport.teacherSelectionReplay.reviewOnly === true &&
      surfacePatchStabilityReport.teacherSelectionReplay.accepted === false &&
      surfacePatchStabilityReport.teacherSelectionReplay.packagingGated === true &&
      surfacePatchStabilityReport.teacherSelectionReplay.blockedActions.includes("Package") &&
      surfacePatchStabilityReport.teacherSelectionReplay.options.every(
        (option) =>
          option.disabledRuleDrafts.length > 0 &&
          option.disabledRuleDrafts.every((draft) => draft.willBeEnabled === false) &&
          option.oldKnowledgeConflictBoundaries.length >= 3 &&
          option.nextStepPrediction.includes("下一步预测")
      ) &&
      surfacePatchStabilityReport.blockedActions.includes("Package") &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "曲面 patch 批量稳定性报告"
      ) &&
      readFileSync(join(root, "src/components/spatial-engineering-teaching-panel.tsx"), "utf8").includes(
        "曲面批量老师选择回放"
      ) &&
      readFileSync(join(root, "src/lib/spatial-teaching.ts"), "utf8").includes(
        "surface_patch_teacher_selection_replay"
      ),
    `surfacePatchBatch=${report.summary.spatialSurfacePatchStabilityReady}/${report.summary.spatialSurfacePatchStabilitySamples}; outliers=${report.summary.spatialSurfacePatchStabilityOutliers}; replays=${report.summary.spatialSurfacePatchSelectionReplays}; drafts=${report.summary.spatialSurfacePatchSelectionReplayDisabledDrafts}; accepted=${surfacePatchStabilityReport.accepted}; packaging=${surfacePatchStabilityReport.packagingGated}.`
  );
  push(
    checks,
    "Domain learning workflow stages self-research before human teaching",
    report.domainLearningWorkflow.status === "ready_for_teacher_review" &&
      report.domainLearningWorkflow.reviewOnly === true &&
      report.domainLearningWorkflow.accepted === false &&
      report.domainLearningWorkflow.packagingGated === true &&
      domainWorkflowReadable &&
      report.summary.domainLearningStagesReady === report.summary.domainLearningStages &&
      report.summary.domainKnowledgeNodes === report.domainLearningWorkflow.knowledgeNodes.length &&
      report.summary.domainGuidedGenerationSteps === report.domainLearningWorkflow.guidedGenerationSteps.length &&
      report.domainLearningWorkflow.stages.some((stage) => stage.phase === "self_research") &&
      report.domainLearningWorkflow.stages.some((stage) => stage.phase === "knowledge_map") &&
      report.domainLearningWorkflow.stages.some((stage) => stage.phase === "human_ingest") &&
      report.domainLearningWorkflow.stages.some((stage) => stage.phase === "guided_generation") &&
      report.domainLearningWorkflow.guidedGenerationSteps.every(
        (step) =>
          step.reviewState === "awaiting_teacher_review" &&
          step.whyThisStep.length > 0 &&
          step.nextStepPrediction.length > 0
      ) &&
      report.domainLearningWorkflow.guidedGenerationSteps.some((step) => step.nextStepPrediction.includes("下一步")) &&
      report.domainLearningWorkflow.blockedActions.includes("Accept technology") &&
      report.domainLearningWorkflow.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "domain-learning-workflow" && item.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "domain-learning-workflow" && section.passed) &&
      report.visualTeacherReviewWorksheet.items.some((item) => item.id === "domain-learning-workflow-decision") &&
      readFileSync(join(root, "src/components/domain-learning-workflow-panel.tsx"), "utf8").includes(
        "领域学习工作流"
      ) &&
      readFileSync(join(root, "src/lib/domain-learning.ts"), "utf8").includes("defaultDomainTeachingBriefJson") &&
      readFileSync(join(root, "src/lib/domain-learning.ts"), "utf8").includes("buildDomainTeachingBriefPreview") &&
      readFileSync(join(root, "src/lib/domain-learning.test.ts"), "utf8").includes(
        "previews an editable domain brief"
      ) &&
      readFileSync(join(root, "src/components/domain-learning-workflow-panel.tsx"), "utf8").includes(
        "可编辑领域学习 brief"
      ) &&
      readFileSync(join(root, "src/components/domain-learning-workflow-panel.tsx"), "utf8").includes(
        "老师给 AI 的领域学习代码"
      ) &&
      readFileSync(join(root, "src/components/domain-learning-workflow-panel.tsx"), "utf8").includes(
        "下一步预测"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "DomainLearningWorkflowPanel"
      ) &&
      (() => {
        const selfStudy = report.domainLearningWorkflow.aiSelfStudyResult;
        if (!selfStudy) return true;
        return (
          selfStudy.topics.length >= 3 &&
          selfStudy.topics.every(
            (t) =>
              t.id.length > 0 &&
              t.label.length > 0 &&
              t.whyToLearn.length > 0 &&
              t.possibleMistakes.length >= 1 &&
              t.teacherConfirmationQuestion.length > 0 &&
              t.passCriteria.length > 0 &&
              t.reviewOnly === true &&
              t.accepted === false &&
              t.packagingGated === true
          ) &&
          selfStudy.note.includes("mock") &&
          selfStudy.note.includes("不连接外部模型")
        );
      })() &&
      readFileSync(join(root, "src/lib/domain-ai-service.ts"), "utf8").includes("mockAIDomainSelfStudy") &&
      readFileSync(join(root, "src/lib/domain-ai-service.ts"), "utf8").includes("AISelfStudyTopic") &&
      readFileSync(join(root, "src/components/domain-learning-workflow-panel.tsx"), "utf8").includes(
        "AI 自学主题建议"
      ) &&
      readFileSync(join(root, "src/components/domain-learning-workflow-panel.tsx"), "utf8").includes(
        "不连接外部模型"
      ),
    `domainStages=${report.summary.domainLearningStagesReady}/${report.summary.domainLearningStages}; nodes=${report.summary.domainKnowledgeNodes}; guided=${report.summary.domainGuidedGenerationSteps}; aiSelfStudyTopics=${report.domainLearningWorkflow.aiSelfStudyResult?.topics.length ?? 0}; prediction=visible; readable=${domainWorkflowReadable}.`
  );
  push(
    checks,
    "AI service replacement readiness is review-only",
    report.domainLearningWorkflow.aiServiceReplacementReadiness.mode ===
      "mock_to_real_ai_service_replacement_readiness_v1" &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.format ===
        "ai_service_replacement_readiness_json_v1" &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.status === "ready_for_teacher_review" &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.reviewOnly === true &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.accepted === false &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.packagingGated === true &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.externalCallsEnabled === false &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.passed === true &&
      report.summary.aiServiceReplacementSchemaChecks ===
        report.domainLearningWorkflow.aiServiceReplacementReadiness.schemaChecks.length &&
      report.summary.aiServiceReplacementSchemaChecks === 4 &&
      report.summary.aiServiceReplacementSteps ===
        report.domainLearningWorkflow.aiServiceReplacementReadiness.replacementSteps.length &&
      report.summary.aiServiceReplacementSteps === 3 &&
      report.summary.aiServiceReplacementReady === 1 &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.schemaChecks.every((check) => check.passed) &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.replacementSteps.every((step) => step.passed) &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.adapterContract.inputFields.includes("domain") &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.adapterContract.outputFields.includes(
        "topics[].passCriteria"
      ) &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.adapterContract.requiredLocks.includes(
        "accepted=false"
      ) &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.blockedActions.includes("Call external model") &&
      report.domainLearningWorkflow.aiServiceReplacementReadiness.blockedActions.includes("Package") &&
      readFileSync(join(root, "src/lib/domain-learning.ts"), "utf8").includes(
        "buildAIServiceReplacementReadinessReport"
      ) &&
      readFileSync(join(root, "src/components/domain-learning-workflow-panel.tsx"), "utf8").includes(
        "AI service replacement readiness"
      ) &&
      readFileSync(join(root, "src/components/domain-learning-workflow-panel.tsx"), "utf8").includes(
        "ai_service_replacement_readiness_json_v1"
      ),
    `aiServiceReplacement=${report.summary.aiServiceReplacementReady}/1; schema=${report.summary.aiServiceReplacementSchemaChecks}; steps=${report.summary.aiServiceReplacementSteps}; externalCalls=${report.domainLearningWorkflow.aiServiceReplacementReadiness.externalCallsEnabled}; accepted=${report.domainLearningWorkflow.aiServiceReplacementReadiness.accepted}; packaging=${report.domainLearningWorkflow.aiServiceReplacementReadiness.packagingGated}.`
  );
  push(
    checks,
    "AI service output validation rehearsal blocks unsafe model output",
    report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.mode ===
      "ai_service_output_validation_rehearsal_v1" &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.format ===
        "ai_service_output_validation_rehearsal_json_v1" &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.status === "ready_for_teacher_review" &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.reviewOnly === true &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.accepted === false &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.packagingGated === true &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.externalCallsEnabled === false &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.passed === true &&
      report.summary.aiServiceValidationCases ===
        report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.cases.length &&
      report.summary.aiServiceValidationCases === 4 &&
      report.summary.aiServiceValidationBlockedCases ===
        report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.blockedCases &&
      report.summary.aiServiceValidationBlockedCases === 3 &&
      report.summary.aiServiceValidationReady === 1 &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.acceptedForTeacherReview === 1 &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.cases.every(
        (item) =>
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true &&
          item.passed &&
          item.publicTrace.length >= 3
      ) &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.cases.some(
        (item) => item.validationResult === "blocked_missing_locks"
      ) &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.cases.some(
        (item) => item.validationResult === "blocked_schema_error"
      ) &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.cases.some(
        (item) => item.validationResult === "blocked_side_effect"
      ) &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.blockedActions.includes(
        "Call external model"
      ) &&
      report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.blockedActions.includes("Package") &&
      readFileSync(join(root, "src/lib/domain-learning.ts"), "utf8").includes(
        "buildAIServiceOutputValidationRehearsal"
      ) &&
      readFileSync(join(root, "src/components/domain-learning-workflow-panel.tsx"), "utf8").includes(
        "AI service output validation rehearsal"
      ) &&
      readFileSync(join(root, "src/components/domain-learning-workflow-panel.tsx"), "utf8").includes(
        "ai_service_output_validation_rehearsal_json_v1"
      ),
    `aiServiceValidation=${report.summary.aiServiceValidationReady}/1; cases=${report.summary.aiServiceValidationCases}; blocked=${report.summary.aiServiceValidationBlockedCases}; externalCalls=${report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.externalCallsEnabled}; accepted=${report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.accepted}; packaging=${report.domainLearningWorkflow.aiServiceOutputValidationRehearsal.packagingGated}.`
  );
  push(
    checks,
    "Multi-apprentice cross-domain validation is review-only",
    report.crossDomainValidationReport.mode === "multi_apprentice_cross_domain_review" &&
      report.crossDomainValidationReport.status === "ready_for_teacher_review" &&
      report.crossDomainValidationReport.reviewOnly === true &&
      report.crossDomainValidationReport.accepted === false &&
      report.crossDomainValidationReport.packagingGated === true &&
      report.summary.crossDomainValidationCases === report.crossDomainValidationReport.cases.length &&
      report.summary.crossDomainValidationReady === 1 &&
      report.summary.crossDomainValidationDomains === report.crossDomainValidationReport.domainsCovered.length &&
      report.summary.crossDomainValidationApprentices === report.crossDomainValidationReport.apprenticesCovered.length &&
      report.summary.crossDomainValidationReviewBoundaries === report.crossDomainValidationReport.reviewBoundaries &&
      report.crossDomainValidationReport.cases.length >= 3 &&
      report.crossDomainValidationReport.domainsCovered.length >= 3 &&
      report.crossDomainValidationReport.apprenticesCovered.length >= 3 &&
      report.crossDomainValidationReport.reviewBoundaries >= 1 &&
      report.crossDomainValidationReport.cases.every(
        (item) =>
          item.passed &&
          item.reusedLearning.length > 0 &&
          item.boundaryCheck.length > 0 &&
          item.transferQuestion.length > 0
      ) &&
      report.crossDomainValidationReport.cases.some((item) => item.reviewState === "needs_teacher_review") &&
      report.crossDomainValidationReport.teacherQuestion.includes("老师") &&
      report.crossDomainValidationReport.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "multi-apprentice-cross-domain-validation" && item.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "cross-domain-validation" && section.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "multi_apprentice_cross_domain_review"
      ) &&
      readFileSync(join(root, "src/components/cross-domain-validation-panel.tsx"), "utf8").includes(
        "多学徒跨领域验证报告"
      ) &&
      readFileSync(join(root, "src/components/cross-domain-validation-panel.tsx"), "utf8").includes(
        "仍需老师审查"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "CrossDomainValidationPanel"
      ),
    `crossDomain=${report.summary.crossDomainValidationReady}/${report.summary.crossDomainValidationCases}; domains=${report.summary.crossDomainValidationDomains}; apprentices=${report.summary.crossDomainValidationApprentices}; boundaries=${report.summary.crossDomainValidationReviewBoundaries}; accepted=${report.crossDomainValidationReport.accepted}.`
  );
  push(
    checks,
    "Cross-domain teacher batch score replay is draft-only",
    report.crossDomainValidationReport.teacherBatchScoreReplay.mode ===
      "cross_domain_teacher_batch_score_replay_v1" &&
      report.crossDomainValidationReport.teacherBatchScoreReplay.format ===
        "teacher_cross_domain_score_json_v1" &&
      report.crossDomainValidationReport.teacherBatchScoreReplay.reviewOnly === true &&
      report.crossDomainValidationReport.teacherBatchScoreReplay.accepted === false &&
      report.crossDomainValidationReport.teacherBatchScoreReplay.packagingGated === true &&
      report.crossDomainValidationReport.teacherBatchScoreReplay.items.length ===
        report.crossDomainValidationReport.cases.length &&
      report.summary.crossDomainTeacherScoreItems ===
        report.crossDomainValidationReport.teacherBatchScoreReplay.items.length &&
      report.summary.crossDomainTeacherScoreReplayReady === 1 &&
      report.summary.crossDomainTeacherScoreAverage ===
        report.crossDomainValidationReport.teacherBatchScoreReplay.averageScore &&
      report.summary.crossDomainTeacherScoreFollowUps ===
        report.crossDomainValidationReport.teacherBatchScoreReplay.needsFollowUp &&
      report.summary.crossDomainTeacherScoreDisabledDrafts ===
        report.crossDomainValidationReport.teacherBatchScoreReplay.disabledDraftImpacts &&
      report.crossDomainValidationReport.teacherBatchScoreReplay.items.every(
        (item) =>
          item.score >= 0 &&
          item.score <= 100 &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true &&
          item.followUpQuestion.includes("老师")
      ) &&
      report.crossDomainValidationReport.teacherBatchScoreReplay.items.some(
        (item) => item.decision === "needs_revision"
      ) &&
      report.crossDomainValidationReport.teacherBatchScoreReplay.templateJson.includes(
        "teacher_cross_domain_score_json_v1"
      ) &&
      report.crossDomainValidationReport.teacherBatchScoreReplay.blockedActions.includes(
        "Enable cross-domain rules"
      ) &&
      report.crossDomainValidationReport.teacherBatchScoreReplay.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "cross-domain-teacher-batch-score-replay" && item.passed) &&
      report.visualReviewDossier.sections.some(
        (section) => section.id === "cross-domain-teacher-score-replay" && section.passed
      ) &&
      readFileSync(join(root, "src/components/cross-domain-validation-panel.tsx"), "utf8").includes(
        "老师批量回填评分预演"
      ) &&
      readFileSync(join(root, "src/components/cross-domain-validation-panel.tsx"), "utf8").includes(
        "teacher_cross_domain_score_json_v1"
      ),
    `crossDomainTeacherScores=${report.summary.crossDomainTeacherScoreReplayReady}/${report.summary.crossDomainTeacherScoreItems}; average=${report.summary.crossDomainTeacherScoreAverage}; followUps=${report.summary.crossDomainTeacherScoreFollowUps}; disabledDrafts=${report.summary.crossDomainTeacherScoreDisabledDrafts}.`
  );
  push(
    checks,
    "Cross-domain teacher score recovery diff is review-only",
    report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.mode ===
      "cross_domain_teacher_score_draft_recovery_diff_v1" &&
      report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.format ===
        "teacher_cross_domain_score_recovery_diff_json_v1" &&
      report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.reviewOnly === true &&
      report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.accepted === false &&
      report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.packagingGated === true &&
      report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.rows.length ===
        report.crossDomainValidationReport.teacherBatchScoreReplay.items.length &&
      report.summary.crossDomainTeacherScoreRecoveryRows ===
        report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.rows.length &&
      report.summary.crossDomainTeacherScoreRecoveryReady ===
        (report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.passed ? 1 : 0) &&
      report.summary.crossDomainTeacherScoreRecoveryPersisted ===
        report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.persistedDraftCount &&
      report.summary.crossDomainTeacherScoreRecoveryChangedRows ===
        report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.changedRows &&
      report.summary.crossDomainTeacherScoreRecoveryMissingRows ===
        report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.missingRecoveredRows &&
      report.summary.crossDomainTeacherScoreRecoveryFollowUps ===
        report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.recoveredFollowUps &&
      report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.rows.every(
        (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
      ) &&
      report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.exportJson.includes(
        "teacher_cross_domain_score_recovery_diff_json_v1"
      ) &&
      report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.blockedActions.includes(
        "Enable cross-domain rules"
      ) &&
      report.crossDomainValidationReport.teacherScoreDraftRecoveryDiff.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "cross-domain-teacher-score-recovery-diff" && item.passed) &&
      report.visualReviewDossier.sections.some(
        (section) => section.id === "cross-domain-teacher-score-recovery-diff" && section.passed
      ) &&
      readFileSync(join(root, "src/components/cross-domain-validation-panel.tsx"), "utf8").includes(
        "Cross-domain score draft recovery diff"
      ) &&
      readFileSync(join(root, "src/components/cross-domain-validation-panel.tsx"), "utf8").includes(
        "teacher_cross_domain_score_recovery_diff_json_v1"
      ) &&
      readFileSync(join(root, "src/app/api/cross-domain-score-drafts/route.ts"), "utf8").includes(
        "buildCrossDomainTeacherScoreDraft"
      ),
    `crossDomainScoreRecovery=${report.summary.crossDomainTeacherScoreRecoveryReady}/${report.summary.crossDomainTeacherScoreRecoveryRows}; persisted=${report.summary.crossDomainTeacherScoreRecoveryPersisted}; changed=${report.summary.crossDomainTeacherScoreRecoveryChangedRows}; missing=${report.summary.crossDomainTeacherScoreRecoveryMissingRows}; followUps=${report.summary.crossDomainTeacherScoreRecoveryFollowUps}.`
  );
  push(
    checks,
    "Human teaching memory protocol remembers rules and asks on conflict",
    report.humanTeachingMemoryProtocol.status === "ready_for_teacher_review" &&
      report.humanTeachingMemoryProtocol.reviewOnly === true &&
      report.humanTeachingMemoryProtocol.accepted === false &&
      report.humanTeachingMemoryProtocol.packagingGated === true &&
      report.summary.humanTeachingMemoryRulesReady === report.summary.humanTeachingMemoryRules &&
      report.summary.teachingConflictStepsReady === report.summary.teachingConflictSteps &&
      report.summary.voiceTeachingModes === 1 &&
      report.summary.voiceRestatementReviewVersions >= 3 &&
      report.summary.voiceRestatementReviewHistoryReady === 1 &&
      report.summary.voiceEngineSelectionCandidates >= 3 &&
      report.summary.voiceEngineSelectionReady === 1 &&
      report.summary.voiceEngineTeacherScoreReplays === report.summary.voiceEngineSelectionCandidates &&
      report.summary.voiceBrowserCompatibilityBrowsers >= 4 &&
      report.summary.voiceBrowserCompatibilityReady === 1 &&
      report.summary.voiceBrowserCompatibilityRecognitionRisks >= 2 &&
      report.summary.voiceBrowserCompatibilityFallbacks >= 2 &&
      report.summary.voiceBrowserCompatibilityReviewDrafts >= 0 &&
      report.summary.voiceBrowserCompatibilityComparisonBrowsers ===
        report.voiceBrowserCompatibilityComparisonReport.items.length &&
      report.summary.voiceBrowserCompatibilityComparisonReady === 1 &&
      report.summary.voiceBrowserCompatibilityComparisonPersistedReviews ===
        report.voiceBrowserCompatibilityComparisonReport.persistedReviewCount &&
      report.summary.voiceBrowserCompatibilityComparisonFallbackTests ===
        report.voiceBrowserCompatibilityComparisonReport.fallbackTestedBrowsers &&
      report.summary.voiceBrowserCompatibilityBatchDiffRows ===
        report.voiceBrowserCompatibilityBatchDiffReport.rows.length &&
      report.summary.voiceBrowserCompatibilityBatchDiffReady ===
        (report.voiceBrowserCompatibilityBatchDiffReport.passed ? 1 : 0) &&
      report.summary.voiceBrowserCompatibilityBatchDiffMissingReviews ===
        report.voiceBrowserCompatibilityBatchDiffReport.missingRuntimeReviews &&
      report.summary.voiceBrowserCompatibilityBatchDiffRuntimeDiffs ===
        report.voiceBrowserCompatibilityBatchDiffReport.runtimeDiffs &&
      report.summary.voiceBrowserCompatibilityBatchDiffFallbackGaps ===
        report.voiceBrowserCompatibilityBatchDiffReport.fallbackGaps &&
      report.humanTeachingMemoryProtocol.rules.some((rule) => rule.appliesTo === "all_future_commands") &&
      report.humanTeachingMemoryProtocol.rules.some((rule) => rule.appliesTo === "conflicting_new_knowledge") &&
      report.humanTeachingMemoryProtocol.conflictSteps.every(
        (step) => step.passed && step.action.length > 0 && step.teacherQuestion.length > 0
      ) &&
      report.humanTeachingMemoryProtocol.voiceExperience.mode === "voice_optional" &&
      report.humanTeachingMemoryProtocol.voiceExperience.passed === true &&
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.reviewOnly === true &&
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.ruleEnabled === false &&
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.accepted === false &&
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.packagingGated === true &&
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.learningTrace.length >= 3 &&
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.learningTrace.every((step) => step.needsHumanReview) &&
      report.humanTeachingMemoryProtocol.voiceTranscriptDraft.teacherQuestion.includes("老师") &&
      report.humanTeachingMemoryProtocol.futureCommandReplay.reviewOnly === true &&
      report.humanTeachingMemoryProtocol.futureCommandReplay.accepted === false &&
      report.humanTeachingMemoryProtocol.futureCommandReplay.packagingGated === true &&
      report.humanTeachingMemoryProtocol.futureCommandReplay.status === "memory_hit_waiting_teacher_review" &&
      report.humanTeachingMemoryProtocol.futureCommandReplay.hits.length > 0 &&
      report.humanTeachingMemoryProtocol.futureCommandReplay.hits.every(
        (hit) =>
          hit.reviewState === "awaiting_teacher_review" &&
          hit.recallReason.includes("老师") &&
          hit.teacherQuestion.includes("老师")
      ) &&
      report.humanTeachingMemoryProtocol.futureCommandReplay.nextStepPrediction.includes("先回放") &&
      report.humanTeachingMemoryProtocol.blockedActions.includes("Accept technology") &&
      report.humanTeachingMemoryProtocol.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "human-teaching-memory-protocol" && item.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "human-teaching-memory-protocol" && section.passed) &&
      report.visualTeacherReviewWorksheet.items.some((item) => item.id === "human-teaching-memory-decision") &&
      report.voiceBrowserCompatibilityComparisonReport.mode ===
        "voice_browser_compatibility_export_comparison_v1" &&
      report.voiceBrowserCompatibilityComparisonReport.format ===
        "voice_browser_runtime_review_export_json_v1" &&
      report.voiceBrowserCompatibilityComparisonReport.reviewOnly === true &&
      report.voiceBrowserCompatibilityComparisonReport.accepted === false &&
      report.voiceBrowserCompatibilityComparisonReport.packagingGated === true &&
      report.voiceBrowserCompatibilityComparisonReport.items.length >= 4 &&
      report.voiceBrowserCompatibilityComparisonReport.items.every(
        (item) =>
          item.ruleEnabled === false &&
          item.voiceOnlyMemoryEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.voiceBrowserCompatibilityComparisonReport.exportJson.includes(
        "voice_browser_runtime_review_export_json_v1"
      ) &&
      report.voiceBrowserCompatibilityComparisonReport.blockedActions.includes("Enable voice-only memory") &&
      report.voiceBrowserCompatibilityComparisonReport.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "voice-browser-compatibility-comparison" && item.passed) &&
      report.voiceBrowserCompatibilityBatchDiffReport.mode === "voice_browser_runtime_batch_gap_diff_v1" &&
      report.voiceBrowserCompatibilityBatchDiffReport.format ===
        "voice_browser_runtime_batch_gap_diff_json_v1" &&
      report.voiceBrowserCompatibilityBatchDiffReport.reviewOnly === true &&
      report.voiceBrowserCompatibilityBatchDiffReport.accepted === false &&
      report.voiceBrowserCompatibilityBatchDiffReport.packagingGated === true &&
      report.voiceBrowserCompatibilityBatchDiffReport.passed === true &&
      report.voiceBrowserCompatibilityBatchDiffReport.rows.length ===
        report.voiceBrowserCompatibilityComparisonReport.items.length &&
      report.voiceBrowserCompatibilityBatchDiffReport.rows.every(
        (row) =>
          row.ruleEnabled === false &&
          row.voiceOnlyMemoryEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      report.voiceBrowserCompatibilityBatchDiffReport.exportJson.includes(
        "voice_browser_runtime_batch_gap_diff_json_v1"
      ) &&
      report.voiceBrowserCompatibilityBatchDiffReport.batchCompletionTemplateJson.includes(
        "voice_browser_runtime_batch_gap_diff_json_v1"
      ) &&
      report.voiceBrowserCompatibilityBatchDiffReport.blockedActions.includes("Enable voice-only memory") &&
      report.voiceBrowserCompatibilityBatchDiffReport.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "voice-browser-runtime-batch-gap-diff" && item.passed) &&
      report.visualReviewDossier.sections.some(
        (section) => section.id === "voice-browser-compatibility-comparison" && section.passed
      ) &&
      report.visualReviewDossier.sections.some(
        (section) => section.id === "voice-browser-runtime-batch-gap-diff" && section.passed
      ) &&
      readFileSync(join(root, "src/components/voice-browser-compatibility-comparison-panel.tsx"), "utf8").includes(
        "voice_browser_runtime_review_export_json_v1"
      ) &&
      readFileSync(join(root, "src/components/voice-browser-compatibility-comparison-panel.tsx"), "utf8").includes(
        "Runtime batch gap diff"
      ) &&
      readFileSync(join(root, "src/components/voice-browser-compatibility-comparison-panel.tsx"), "utf8").includes(
        "voice_browser_runtime_batch_gap_diff_json_v1"
      ) &&
      readFileSync(join(root, "src/components/voice-browser-compatibility-comparison-panel.tsx"), "utf8").includes(
        "voiceOnlyMemoryEnabled=false"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "VoiceBrowserCompatibilityComparisonPanel"
      ) &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.ts"), "utf8").includes(
        "buildHumanKnowledgeTeachingDraft"
      ) &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.ts"), "utf8").includes(
        "buildVoiceTeachingTranscriptDraft"
      ) &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.ts"), "utf8").includes(
        "buildHumanKnowledgeFutureCommandReplay"
      ) &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.ts"), "utf8").includes(
        "conflict_requires_teacher"
      ) &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.test.ts"), "utf8").includes(
        "saves human-taught knowledge as paused memory"
      ) &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.test.ts"), "utf8").includes(
        "turns voice teaching transcript into an editable paused memory draft"
      ) &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.test.ts"), "utf8").includes(
        "replays remembered human knowledge before a future command continues"
      ) &&
      readFileSync(join(root, "src/app/api/human-knowledge-teaching/route.ts"), "utf8").includes(
        "buildHumanKnowledgeTeachingDraft"
      ) &&
      readFileSync(join(root, "src/app/api/human-knowledge-teaching/route.ts"), "utf8").includes(
        "ruleEnabled: false"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "人类知识输入"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "/api/human-knowledge-teaching"
      ) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "humanKnowledgeCorrectionCount"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "人类带教记忆协议"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "未来命令记忆回放"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "先查旧知识"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "语音"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "中文语音带教预演"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "开始语音带教"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "把语音转成结构化规则草稿"
      ) &&
      (() => {
        const voiceRestatement =
          report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement;
        if (!voiceRestatement) return true;
        return (
          voiceRestatement.spokenText.length > 0 &&
          voiceRestatement.spokenText.includes("老师") &&
          voiceRestatement.toneCheck.respectsTeacher === true &&
          voiceRestatement.toneCheck.soundsLikeStudent === true &&
          voiceRestatement.toneCheck.notRobotic === true &&
          voiceRestatement.ttsPreview.mode === "browser_speech_synthesis_preview" &&
          voiceRestatement.ttsPreview.utteranceText === voiceRestatement.spokenText &&
          voiceRestatement.ttsPreview.language === "zh-CN" &&
          voiceRestatement.ttsPreview.reviewOnly === true &&
          voiceRestatement.ttsPreview.accepted === false &&
          voiceRestatement.ttsPreview.packagingGated === true &&
          voiceRestatement.ttsPreview.blockedActions.includes("Package") &&
          voiceRestatement.ttsPreview.teacherQuestion.includes("老师") &&
          voiceRestatement.ttsPreview.passed === true &&
          voiceRestatement.voiceEngineSelection.mode === "browser_voice_engine_selection_review" &&
          voiceRestatement.voiceEngineSelection.runtimeVoiceListSource === "speechSynthesis.getVoices" &&
          voiceRestatement.voiceEngineSelection.requiresRuntimeVoiceList === true &&
          voiceRestatement.voiceEngineSelection.candidates.length === report.summary.voiceEngineSelectionCandidates &&
          voiceRestatement.voiceEngineSelection.preferredVoiceId === "browser-zh-cn-warm-student" &&
          voiceRestatement.voiceEngineSelection.reviewOnly === true &&
          voiceRestatement.voiceEngineSelection.accepted === false &&
          voiceRestatement.voiceEngineSelection.packagingGated === true &&
          voiceRestatement.voiceEngineSelection.blockedActions.includes("Package") &&
          voiceRestatement.voiceEngineSelection.teacherQuestion.includes("老师") &&
          voiceRestatement.voiceEngineSelection.passed === true &&
          voiceRestatement.voiceEngineSelection.candidates.every(
            (candidate) =>
              candidate.teacherScoreReplay.replaySource === "teacher_voice_review_replay" &&
              candidate.reviewOnly === true &&
              candidate.accepted === false &&
              candidate.packagingGated === true
          ) &&
          voiceRestatement.browserCompatibilityAudit.mode === "browser_voice_compatibility_audit" &&
          voiceRestatement.browserCompatibilityAudit.status === "ready_for_teacher_review" &&
          voiceRestatement.browserCompatibilityAudit.cases.length ===
            report.summary.voiceBrowserCompatibilityBrowsers &&
          voiceRestatement.browserCompatibilityAudit.cases.some((item) => item.browser === "Chrome") &&
          voiceRestatement.browserCompatibilityAudit.cases.some((item) => item.browser === "Edge") &&
          voiceRestatement.browserCompatibilityAudit.cases.some((item) => item.browser === "Safari") &&
          voiceRestatement.browserCompatibilityAudit.cases.some((item) => item.browser === "Firefox") &&
          voiceRestatement.browserCompatibilityAudit.recognitionRiskBrowsers ===
            report.summary.voiceBrowserCompatibilityRecognitionRisks &&
          voiceRestatement.browserCompatibilityAudit.fallbackRequiredBrowsers ===
            report.summary.voiceBrowserCompatibilityFallbacks &&
          voiceRestatement.browserCompatibilityAudit.reviewOnly === true &&
          voiceRestatement.browserCompatibilityAudit.accepted === false &&
          voiceRestatement.browserCompatibilityAudit.packagingGated === true &&
          voiceRestatement.browserCompatibilityAudit.blockedActions.includes("Enable voice-only memory") &&
          voiceRestatement.browserCompatibilityAudit.blockedActions.includes("Package") &&
          voiceRestatement.browserCompatibilityAudit.teacherQuestion.includes("老师") &&
          voiceRestatement.browserCompatibilityAudit.passed === true &&
          voiceRestatement.teacherReviewHistory.mode === "teacher_tts_review_history_preview" &&
          voiceRestatement.teacherReviewHistory.versions.length === report.summary.voiceRestatementReviewVersions &&
          voiceRestatement.teacherReviewHistory.versions.some(
            (version) => version.reviewState === "current_waiting_teacher_review"
          ) &&
          voiceRestatement.teacherReviewHistory.versions.every(
            (version) => version.reviewOnly === true && version.accepted === false && version.packagingGated === true
          ) &&
          voiceRestatement.teacherReviewHistory.currentVersionId === "voice-restatement-review-current" &&
          voiceRestatement.teacherReviewHistory.bestPriorVersionId.length > 0 &&
          voiceRestatement.teacherReviewHistory.teacherQuestion.includes("老师") &&
          voiceRestatement.teacherReviewHistory.blockedActions.includes("Package") &&
          voiceRestatement.teacherReviewHistory.passed === true &&
          voiceRestatement.reviewOnly === true &&
          voiceRestatement.accepted === false &&
          voiceRestatement.packagingGated === true &&
          voiceRestatement.teacherToneReview.reviewState === "awaiting_teacher_review"
        );
      })() &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.ts"), "utf8").includes(
        "buildAIVoiceRestatement"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "AI 向老师复述请教"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "语气自然度审查"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "TTS 语音朗读预演"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "朗读 AI 复述文案"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "停止朗读"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "ttsPreview.mode"
      ) &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.ts"), "utf8").includes(
        "browser_speech_synthesis_preview"
      ) &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.ts"), "utf8").includes(
        "browser_voice_engine_selection_review"
      ) &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.ts"), "utf8").includes(
        "teacher_voice_review_replay"
      ) &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.ts"), "utf8").includes(
        "teacher_tts_review_history_preview"
      ) &&
      readFileSync(join(root, "src/lib/human-knowledge-teaching.ts"), "utf8").includes(
        "browser_voice_compatibility_audit"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "跨浏览器兼容性审查"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "/api/voice-browser-compatibility-reviews"
      ) &&
      readFileSync(join(root, "src/app/api/voice-browser-compatibility-reviews/route.ts"), "utf8").includes(
        "buildVoiceBrowserCompatibilityReviewRecord"
      ) &&
      readFileSync(join(root, "src/app/api/voice-browser-compatibility-reviews/route.ts"), "utf8").includes(
        "voiceOnlyMemoryEnabled: false"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "语音复述只是教学辅助体验"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "老师历史评分与版本对比"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "真实语音引擎声音选择"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "speechSynthesis.getVoices"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "本机浏览器 voices"
      ) &&
      readFileSync(join(root, "src/components/human-teaching-memory-protocol-panel.tsx"), "utf8").includes(
        "current_waiting_teacher_review"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "HumanTeachingMemoryProtocolPanel"
      ),
    `humanMemory=${report.summary.humanTeachingMemoryRulesReady}/${report.summary.humanTeachingMemoryRules}; conflicts=${report.summary.teachingConflictStepsReady}/${report.summary.teachingConflictSteps}; voice=${report.summary.voiceTeachingModes}; tts=${report.humanTeachingMemoryProtocol.voiceTranscriptDraft.aiRestatement?.ttsPreview.mode ?? "none"}; voiceCandidates=${report.summary.voiceEngineSelectionCandidates}; voiceBrowsers=${report.summary.voiceBrowserCompatibilityBrowsers}; voiceFallbacks=${report.summary.voiceBrowserCompatibilityFallbacks}; voiceReviewDrafts=${report.summary.voiceBrowserCompatibilityReviewDrafts}; voiceComparison=${report.summary.voiceBrowserCompatibilityComparisonReady}/${report.summary.voiceBrowserCompatibilityComparisonBrowsers}; voiceComparisonPersisted=${report.summary.voiceBrowserCompatibilityComparisonPersistedReviews}; voiceBatchDiff=${report.summary.voiceBrowserCompatibilityBatchDiffReady}/${report.summary.voiceBrowserCompatibilityBatchDiffRows}; voiceBatchMissing=${report.summary.voiceBrowserCompatibilityBatchDiffMissingReviews}; voiceBatchFallbackGaps=${report.summary.voiceBrowserCompatibilityBatchDiffFallbackGaps}; scoreReplays=${report.summary.voiceEngineTeacherScoreReplays}; reviewVersions=${report.summary.voiceRestatementReviewVersions}.`
  );
  push(
    checks,
    "Chinese teaching prediction board is chess-like and review-only",
    report.teachingPredictionBoard.status === "ready_for_teacher_review" &&
      report.teachingPredictionBoard.reviewOnly === true &&
      report.teachingPredictionBoard.accepted === false &&
      report.teachingPredictionBoard.packagingGated === true &&
      report.teachingPredictionBoard.metaphor === "chess_like_next_move_prediction" &&
      report.summary.teachingPredictionMoves === report.teachingPredictionBoard.moves.length &&
      report.summary.teachingPredictionMovesReady === report.summary.teachingPredictionMoves &&
      report.teachingPredictionBoard.moves.length >= 6 &&
      report.teachingPredictionBoard.moves.every(
        (move) =>
          move.passed &&
          move.reviewState === "awaiting_teacher_review" &&
          move.apprenticePrediction.length > 0 &&
          move.whyThisPrediction.length > 0 &&
          move.teacherCorrectionPoint.length > 0 &&
          move.memoryEffect.length > 0 &&
          move.conflictPolicy.length > 0
      ) &&
      report.teachingPredictionBoard.moves.some((move) => move.teacherInputMode === "code_coordinate") &&
      report.teachingPredictionBoard.moves.some((move) => move.teacherInputMode === "memory_conflict") &&
      report.teachingPredictionBoard.moves.some((move) => move.label.includes("像下棋一样")) &&
      report.teachingPredictionBoard.moves.some((move) => move.memoryEffect.includes("accepted=false")) &&
      report.teachingPredictionBoard.blockedActions.includes("Accept technology") &&
      report.teachingPredictionBoard.blockedActions.includes("Package") &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "buildTeachingPredictionBoard"
      ) &&
      readFileSync(join(root, "src/lib/teaching-prediction.ts"), "utf8").includes(
        "buildDynamicTeachingPredictionPreview"
      ) &&
      readFileSync(join(root, "src/lib/teaching-prediction.test.ts"), "utf8").includes(
        "predicts chess-like next moves from code-first teacher input"
      ) &&
      readFileSync(join(root, "src/components/teaching-prediction-board-panel.tsx"), "utf8").includes(
        "中文带教棋局预测板"
      ) &&
      readFileSync(join(root, "src/components/teaching-prediction-board-panel.tsx"), "utf8").includes(
        "像下棋一样预测下一步"
      ) &&
      readFileSync(join(root, "src/components/teaching-prediction-board-panel.tsx"), "utf8").includes(
        "中文带教下一手模拟器"
      ) &&
      readFileSync(join(root, "src/components/teaching-prediction-board-panel.tsx"), "utf8").includes(
        "老师这一手教学代码"
      ) &&
      readFileSync(join(root, "src/components/teaching-prediction-board-panel.tsx"), "utf8").includes(
        "为什么这么预测"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "TeachingPredictionBoardPanel"
      ),
    `predictionMoves=${report.summary.teachingPredictionMovesReady}/${report.summary.teachingPredictionMoves}; mode=${report.teachingPredictionBoard.metaphor}; accepted=${report.teachingPredictionBoard.accepted}.`
  );
  push(
    checks,
    "Visual evidence replay is review-only",
    report.visualEvidenceReplay.status === "ready_for_teacher_review" &&
      report.visualEvidenceReplay.reviewOnly === true &&
      report.visualEvidenceReplay.accepted === false &&
      report.visualEvidenceReplay.packagingGated === true &&
      report.summary.visualEvidenceReplayReady === report.summary.visualEvidenceReplaySteps &&
      report.summary.visualEvidenceReplaySteps >= 7 &&
      report.visualEvidenceReplay.steps.every((step) => step.passed) &&
      report.visualEvidenceReplay.steps.some((step) => step.phase === "teach") &&
      report.visualEvidenceReplay.steps.some((step) => step.phase === "extract") &&
      report.visualEvidenceReplay.steps.some((step) => step.phase === "apply") &&
      report.visualEvidenceReplay.steps.some((step) => step.phase === "stress") &&
      report.visualEvidenceReplay.steps.some((step) => step.phase === "limits") &&
      report.visualEvidenceReplay.steps.some((step) => step.phase === "review" && step.status === "locked") &&
      report.visualEvidenceReplay.blockedActions.includes("Accept technology") &&
      report.visualEvidenceReplay.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "visual-evidence-replay" && item.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualEvidenceReplay"
      ) &&
      readFileSync(join(root, "src/components/visual-evidence-replay-panel.tsx"), "utf8").includes(
        "可视化证据回放"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "VisualEvidenceReplayPanel"
      ),
    `replay=${report.summary.visualEvidenceReplayReady}/${report.summary.visualEvidenceReplaySteps}; accepted=${report.visualEvidenceReplay.accepted}; packaging=${report.visualEvidenceReplay.packagingGated}.`
  );
  push(
    checks,
    "Visual red-team risk register is review-only",
    report.visualRedTeamRegister.status === "ready_for_teacher_review" &&
      report.visualRedTeamRegister.reviewOnly === true &&
      report.visualRedTeamRegister.accepted === false &&
      report.visualRedTeamRegister.packagingGated === true &&
      report.summary.visualRedTeamRisks === report.visualRedTeamRegister.risks.length &&
      report.summary.visualRedTeamRisks >= 6 &&
      report.summary.visualRedTeamMitigated >= 4 &&
      report.summary.visualRedTeamTeacherReview >= 1 &&
      report.summary.visualRedTeamLocked >= 1 &&
      report.visualRedTeamRegister.risks.every((risk) => risk.passed) &&
      report.visualRedTeamRegister.risks.some((risk) => risk.id === "lexical-false-positive") &&
      report.visualRedTeamRegister.risks.some((risk) => risk.id === "unproven-cue-overclaim") &&
      report.visualRedTeamRegister.risks.some((risk) => risk.id === "premature-packaging" && risk.status === "locked") &&
      report.visualRedTeamRegister.blockedActions.includes("Accept technology") &&
      report.visualRedTeamRegister.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "visual-red-team-risk-register" && item.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "red-team-risk-register" && section.passed) &&
      report.visualTeacherReviewWorksheet.items.some((item) => item.id === "red-team-risk-decision") &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualRedTeamRegister"
      ) &&
      readFileSync(join(root, "src/components/visual-red-team-risk-register-panel.tsx"), "utf8").includes(
        "可视化学习红队风险登记"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "VisualRedTeamRiskRegisterPanel"
      ),
    `redTeam=${report.summary.visualRedTeamMitigated}/${report.summary.visualRedTeamRisks}; review=${report.summary.visualRedTeamTeacherReview}; locked=${report.summary.visualRedTeamLocked}; accepted=${report.visualRedTeamRegister.accepted}.`
  );
  push(
    checks,
    "Visual teacher review worksheet is unanswered",
    report.visualTeacherReviewWorksheet.status === "awaiting_teacher_review" &&
      report.visualTeacherReviewWorksheet.reviewOnly === true &&
      report.visualTeacherReviewWorksheet.accepted === false &&
      report.visualTeacherReviewWorksheet.packagingGated === true &&
      report.summary.visualTeacherWorksheetItems === report.visualTeacherReviewWorksheet.items.length &&
      report.summary.visualTeacherWorksheetReady === report.visualTeacherReviewWorksheet.items.length &&
      report.summary.visualTeacherWorksheetUnanswered === report.visualTeacherReviewWorksheet.items.length &&
      report.summary.visualTeacherWorksheetBatchExportItems === report.visualTeacherReviewWorksheet.items.length &&
      report.summary.visualTeacherWorksheetBatchExportReady === 1 &&
      report.summary.visualTeacherWorksheetBatchAllowedDecisions === 4 &&
      report.summary.visualTeacherWorksheetDraftVersions ===
        report.visualTeacherReviewWorksheet.draftVersionComparison.versions.length &&
      report.summary.visualTeacherWorksheetDraftVersionReady === 1 &&
      report.summary.visualTeacherWorksheetDraftChangedItems ===
        report.visualTeacherReviewWorksheet.draftVersionComparison.changedItemCount &&
      report.summary.visualTeacherWorksheetDraftFollowUpItems ===
        report.visualTeacherReviewWorksheet.draftVersionComparison.followUpItemCount &&
      report.summary.visualTeacherReviewDraftRecoveryVersions ===
        report.visualTeacherReviewDraftRecoveryReport.versions.length &&
      report.summary.visualTeacherReviewDraftRecoveryReady ===
        (report.visualTeacherReviewDraftRecoveryReport.passed ? 1 : 0) &&
      report.summary.visualTeacherReviewDraftRecoveryPersisted ===
        report.visualTeacherReviewDraftRecoveryReport.persistedDraftCount &&
      report.summary.visualTeacherReviewDraftRecoveryFollowUps ===
        report.visualTeacherReviewDraftRecoveryReport.restoredFollowUpItems &&
      report.summary.visualTeacherReviewDraftReplayRows ===
        report.visualTeacherReviewDraftReplayReport.rows.length &&
      report.summary.visualTeacherReviewDraftReplayReady ===
        (report.visualTeacherReviewDraftReplayReport.passed ? 1 : 0) &&
      report.summary.visualTeacherReviewDraftReplayStaticDiffs ===
        report.visualTeacherReviewDraftReplayReport.staticVersionDiffs &&
      report.summary.visualTeacherReviewDraftReplayPersistedDiffs ===
        report.visualTeacherReviewDraftReplayReport.persistedRecoveryDiffs &&
      report.summary.visualTeacherReviewDraftReplayExported ===
        report.visualTeacherReviewDraftReplayReport.exportedReplayCount &&
      report.visualTeacherReviewWorksheet.batchReviewExchange.status === "ready_for_teacher_review" &&
      report.visualTeacherReviewWorksheet.batchReviewExchange.reviewOnly === true &&
      report.visualTeacherReviewWorksheet.batchReviewExchange.accepted === false &&
      report.visualTeacherReviewWorksheet.batchReviewExchange.packagingGated === true &&
      report.visualTeacherReviewWorksheet.batchReviewExchange.format === "teacher_review_batch_json_v1" &&
      report.visualTeacherReviewWorksheet.batchReviewExchange.itemCount ===
        report.visualTeacherReviewWorksheet.items.length &&
      report.visualTeacherReviewWorksheet.batchReviewExchange.passed === true &&
      report.visualTeacherReviewWorksheet.batchReviewExchange.blockedActions.includes("Package") &&
      report.visualTeacherReviewWorksheet.draftVersionComparison.mode === "teacher_review_draft_version_comparison" &&
      report.visualTeacherReviewWorksheet.draftVersionComparison.versions.length === 3 &&
      report.visualTeacherReviewWorksheet.draftVersionComparison.currentVersionId ===
        "teacher-review-draft-current" &&
      report.visualTeacherReviewWorksheet.draftVersionComparison.changedItemCount === 9 &&
      report.visualTeacherReviewWorksheet.draftVersionComparison.followUpItemCount === 3 &&
      report.visualTeacherReviewWorksheet.draftVersionComparison.reviewOnly === true &&
      report.visualTeacherReviewWorksheet.draftVersionComparison.accepted === false &&
      report.visualTeacherReviewWorksheet.draftVersionComparison.packagingGated === true &&
      report.visualTeacherReviewWorksheet.draftVersionComparison.passed === true &&
      report.visualTeacherReviewWorksheet.draftVersionComparison.teacherQuestion.includes("老师") &&
      report.visualTeacherReviewWorksheet.draftVersionComparison.blockedActions.includes("Package") &&
      report.visualTeacherReviewWorksheet.draftVersionComparison.versions.every(
        (version) => version.reviewOnly === true && version.accepted === false && version.packagingGated === true
      ) &&
      report.visualTeacherReviewDraftRecoveryReport.mode === "teacher_review_draft_persistence_recovery_v1" &&
      report.visualTeacherReviewDraftRecoveryReport.reviewOnly === true &&
      report.visualTeacherReviewDraftRecoveryReport.accepted === false &&
      report.visualTeacherReviewDraftRecoveryReport.packagingGated === true &&
      report.visualTeacherReviewDraftRecoveryReport.passed === true &&
      report.visualTeacherReviewDraftRecoveryReport.versions.every(
        (version) =>
          version.ruleEnabled === false &&
          version.accepted === false &&
          version.packagingGated === true &&
          version.learningTraceSteps >= 3
      ) &&
      report.visualTeacherReviewDraftRecoveryReport.exportJson.includes(
        "teacher_review_draft_persistence_recovery_v1"
      ) &&
      report.visualTeacherReviewDraftRecoveryReport.blockedActions.includes("Package") &&
      report.visualTeacherReviewDraftReplayReport.mode === "teacher_review_draft_diff_recovery_replay_v1" &&
      report.visualTeacherReviewDraftReplayReport.format ===
        "teacher_review_draft_diff_recovery_replay_json_v1" &&
      report.visualTeacherReviewDraftReplayReport.reviewOnly === true &&
      report.visualTeacherReviewDraftReplayReport.accepted === false &&
      report.visualTeacherReviewDraftReplayReport.packagingGated === true &&
      report.visualTeacherReviewDraftReplayReport.passed === true &&
      report.visualTeacherReviewDraftReplayReport.rows.length >=
        report.visualTeacherReviewWorksheet.draftVersionComparison.versions.length &&
      report.visualTeacherReviewDraftReplayReport.rows.every(
        (row) =>
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.replaySteps.length >= 3
      ) &&
      report.visualTeacherReviewDraftReplayReport.exportJson.includes(
        "teacher_review_draft_diff_recovery_replay_json_v1"
      ) &&
      report.visualTeacherReviewDraftReplayReport.blockedActions.includes("Package") &&
      (() => {
        const template = JSON.parse(report.visualTeacherReviewWorksheet.batchReviewExchange.templateJson) as {
          format?: string;
          accepted?: boolean;
          packagingGated?: boolean;
          items?: Array<{ id?: string; decision?: string; note?: string }>;
        };

        return (
          template.format === "teacher_review_batch_json_v1" &&
          template.accepted === false &&
          template.packagingGated === true &&
          Array.isArray(template.items) &&
          template.items.length === report.visualTeacherReviewWorksheet.items.length &&
          template.items.every((item) => item.id && item.decision === "unreviewed" && item.note === "")
        );
      })() &&
      report.visualTeacherReviewWorksheet.items.length >= 7 &&
      report.visualTeacherReviewWorksheet.items.every((item) => item.status === "unanswered" && item.evidenceReady) &&
      report.visualTeacherReviewWorksheet.items.some((item) => item.id === "positive-transfer-decision") &&
      report.visualTeacherReviewWorksheet.items.some((item) => item.id === "counterexample-safety-decision") &&
      report.visualTeacherReviewWorksheet.items.some(
        (item) => item.id === "review-only-lock-decision" && item.readinessSignal === "locked"
      ) &&
      report.visualTeacherReviewWorksheet.blockedActions.includes("Accept technology") &&
      report.visualTeacherReviewWorksheet.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "visual-teacher-review-worksheet" && item.passed) &&
      report.policyEvidence.some((item) => item.id === "teacher-review-draft-persistence-recovery" && item.passed) &&
      report.policyEvidence.some((item) => item.id === "teacher-review-draft-diff-recovery-replay" && item.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "teacher-review-draft-recovery" && section.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "teacher-review-draft-diff-replay" && section.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualTeacherReviewWorksheet"
      ) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualTeacherReviewDraftRecoveryReport"
      ) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualTeacherReviewDraftReplayReport"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "老师最终审查表"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "不会记录“已验收”"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "本地审查草稿"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "不保存数据库"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "不代表验收"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "不解锁封装"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "老师备注草稿"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "下一轮带教修正清单"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "可复制给 AI 的本地草稿"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "不会把它写入长期记忆"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "保存老师审查草稿"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "批量导出/回填审查 JSON"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "应用批量回填到本地草稿"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "teacher_review_batch_json_v1"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "teacher_review_draft_persistence_recovery_v1"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "Persisted teacher review draft recovery"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "Draft diff recovery replay"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "teacher_review_draft_diff_recovery_replay_json_v1"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "老师审查草稿版本对比"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "版本变化"
      ) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "draftVersionComparison"
      ) &&
      readFileSync(join(root, "src/components/visual-teacher-review-worksheet-panel.tsx"), "utf8").includes(
        "/api/teacher-review-drafts"
      ) &&
      readFileSync(join(root, "src/app/api/teacher-review-drafts/route.ts"), "utf8").includes(
        "buildTeacherReviewDraft"
      ) &&
      readFileSync(join(root, "src/lib/teacher-review-draft.ts"), "utf8").includes(
        "visual_teacher_review_draft"
      ) &&
      readFileSync(join(root, "src/lib/teacher-review-draft.test.ts"), "utf8").includes(
        "without accepting the technology or unlocking packaging"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "VisualTeacherReviewWorksheetPanel"
      ),
    `worksheet=${report.summary.visualTeacherWorksheetReady}/${report.summary.visualTeacherWorksheetItems}; unanswered=${report.summary.visualTeacherWorksheetUnanswered}; batch=${report.summary.visualTeacherWorksheetBatchExportReady}/${report.summary.visualTeacherWorksheetBatchExportItems}; draftVersions=${report.summary.visualTeacherWorksheetDraftVersions}; draftFollowUps=${report.summary.visualTeacherWorksheetDraftFollowUpItems}; recoveredDrafts=${report.summary.visualTeacherReviewDraftRecoveryPersisted}; recoveredFollowUps=${report.summary.visualTeacherReviewDraftRecoveryFollowUps}; replayRows=${report.summary.visualTeacherReviewDraftReplayRows}; replayPersisted=${report.summary.visualTeacherReviewDraftReplayPersistedDiffs}; accepted=${report.visualTeacherReviewWorksheet.accepted}.`
  );
  push(
    checks,
    "Visual learning review dossier is review-only",
    report.visualReviewDossier.status === "ready_for_teacher_review" &&
      report.visualReviewDossier.accepted === false &&
      report.visualReviewDossier.packagingGated === true &&
      report.summary.visualReviewDossierPassed === report.summary.visualReviewDossierTotal &&
      report.summary.visualReviewDossierTotal >= 8 &&
      report.visualReviewDossier.sections.every((section) => section.passed) &&
      report.visualReviewDossier.sections.some((section) => section.id === "baseline-regression") &&
      report.visualReviewDossier.sections.some((section) => section.id === "learning-limits") &&
      report.visualReviewDossier.sections.some((section) => section.id === "teacher-review-draft-recovery") &&
      report.visualReviewDossier.sections.some((section) => section.id === "review-only-boundary" && section.status === "locked") &&
      report.visualReviewDossier.blockedActions.includes("Accept technology") &&
      report.visualReviewDossier.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "visual-review-dossier" && item.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualReviewDossier"
      ) &&
      readFileSync(join(root, "src/components/visual-review-dossier-panel.tsx"), "utf8").includes(
        "可视化学习审查档案"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("VisualReviewDossierPanel"),
    `dossier=${report.summary.visualReviewDossierPassed}/${report.summary.visualReviewDossierTotal}; accepted=${report.visualReviewDossier.accepted}; packaging=${report.visualReviewDossier.packagingGated}.`
  );
  push(
    checks,
    "Teacher trial feedback receipt is review-only",
    readFileSync(join(root, "src/components/teacher-trial-feedback-panel.tsx"), "utf8").includes(
      "Hands-on trial receipt"
    ) &&
      readFileSync(join(root, "src/components/teacher-trial-feedback-panel.tsx"), "utf8").includes(
        "/api/teacher-trial-feedback-drafts"
      ) &&
      readFileSync(join(root, "src/app/api/teacher-trial-feedback-drafts/route.ts"), "utf8").includes(
        "buildTeacherTrialFeedbackDraft"
      ) &&
      readFileSync(join(root, "src/lib/teacher-trial-feedback-draft.ts"), "utf8").includes(
        "teacher_trial_feedback_draft"
      ) &&
      readFileSync(join(root, "src/lib/teacher-trial-feedback-draft.ts"), "utf8").includes(
        "ruleEnabled=false; accepted=false; packagingGated=true"
      ) &&
      readFileSync(join(root, "src/lib/teacher-trial-feedback-draft.test.ts"), "utf8").includes(
        "without accepting technology or unlocking packaging"
      ) &&
      readFileSync(join(root, "scripts/smoke-preview-package.ts"), "utf8").includes(
        "Trial feedback POST saves locked draft"
      ) &&
      readFileSync(join(root, "scripts/smoke-preview-package.ts"), "utf8").includes(
        "qualification_summary_json_v1"
      ) &&
      readFileSync(join(root, "package.json"), "utf8").includes('"smoke:preview"') &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("TeacherTrialFeedbackPanel"),
    "Trial feedback can be saved as disabled review evidence while accepted=false and packagingGated=true."
  );
  const expectedUserRequirementCoverageIds = [
    "visual-learning-before-packaging",
    "apprentice-not-chatbot",
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
  ];
  push(
    checks,
    "User explicit requirements coverage audit is review-only",
    report.userRequirementCoverageAudit.status === "ready_for_teacher_review" &&
      report.userRequirementCoverageAudit.reviewOnly === true &&
      report.userRequirementCoverageAudit.accepted === false &&
      report.userRequirementCoverageAudit.packagingGated === true &&
      report.summary.userRequirementCoverageItems === report.userRequirementCoverageAudit.items.length &&
      report.summary.userRequirementCoverageItems >= expectedUserRequirementCoverageIds.length &&
      report.summary.userRequirementCoverageReady ===
        report.userRequirementCoverageAudit.items.filter(
          (item) => item.reviewState === "ready_for_teacher_review" && item.passed
        ).length &&
      report.summary.userRequirementCoverageLocked === 1 &&
      expectedUserRequirementCoverageIds.every((id) =>
        report.userRequirementCoverageAudit.items.some((item) => item.id === id && item.passed)
      ) &&
      report.userRequirementCoverageAudit.items.every(
        (item) => item.teacherQuestion.includes("老师") && item.evidencePath.length > 0
      ) &&
      report.userRequirementCoverageAudit.items.some(
        (item) =>
          item.id === "visual-learning-before-packaging" &&
          item.reviewState === "locked_until_teacher_acceptance"
      ) &&
      report.userRequirementCoverageAudit.blockedActions.includes("Package") &&
      report.userRequirementCoverageAudit.blockedActions.includes("Release") &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "userRequirementCoverageAudit"
      ) &&
      readFileSync(join(root, "src/components/user-requirement-coverage-audit-panel.tsx"), "utf8").includes(
        "用户要求覆盖审计"
      ) &&
      readFileSync(join(root, "src/components/user-requirement-coverage-audit-panel.tsx"), "utf8").includes(
        "按老师这几轮明确要求"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "UserRequirementCoverageAuditPanel"
      ),
    `userRequirements=${report.summary.userRequirementCoverageReady + report.summary.userRequirementCoverageLocked}/${report.summary.userRequirementCoverageItems}; locked=${report.summary.userRequirementCoverageLocked}; accepted=${report.userRequirementCoverageAudit.accepted}.`
  );
  push(
    checks,
    "Hands-on Chinese teaching lesson is review-only",
    report.handsOnTeachingLesson.status === "ready_for_teacher_review" &&
      report.handsOnTeachingLesson.reviewOnly === true &&
      report.handsOnTeachingLesson.accepted === false &&
      report.handsOnTeachingLesson.packagingGated === true &&
      report.summary.handsOnTeachingLessonSteps === report.handsOnTeachingLesson.steps.length &&
      report.summary.handsOnTeachingLessonSteps === 7 &&
      report.summary.handsOnTeachingLessonReady ===
        report.handsOnTeachingLesson.steps.filter(
          (step) => step.reviewState === "awaiting_teacher_review" && step.passed
        ).length &&
      report.summary.handsOnTeachingLessonLocked === 1 &&
      report.summary.handsOnTeachingRunbookSteps === report.handsOnTeachingLesson.runbook.items.length &&
      report.summary.handsOnTeachingRunbookSteps === report.summary.handsOnTeachingLessonSteps &&
      report.summary.handsOnTeachingRunbookReady === report.handsOnTeachingLesson.runbook.readySteps &&
      report.summary.handsOnTeachingRunbookLocked === report.handsOnTeachingLesson.runbook.lockedSteps &&
      report.handsOnTeachingLesson.steps.map((step) => step.phase).join(" > ") ===
        "domain_orientation > teacher_instruction > code_coordinate > model_fit > next_move_prediction > teacher_correction > memory_replay" &&
      report.handsOnTeachingLesson.steps.every(
        (step) =>
          step.passed &&
          step.teacherCanDo.includes("老师") &&
          step.apprenticeWillDo.includes("AI") &&
          step.whyThisStep.length > 0 &&
          step.correctionPoint.includes("老师") &&
          step.evidencePath.startsWith("qualification_report.")
      ) &&
      report.handsOnTeachingLesson.steps.some(
        (step) => step.phase === "memory_replay" && step.reviewState === "locked_until_teacher_acceptance"
      ) &&
      report.handsOnTeachingLesson.runbook.mode === "hands_on_teaching_lesson_runbook_v1" &&
      report.handsOnTeachingLesson.runbook.format === "hands_on_teaching_lesson_runbook_json_v1" &&
      report.handsOnTeachingLesson.runbook.reviewOnly === true &&
      report.handsOnTeachingLesson.runbook.accepted === false &&
      report.handsOnTeachingLesson.runbook.packagingGated === true &&
      report.handsOnTeachingLesson.runbook.passed === true &&
      report.handsOnTeachingLesson.runbook.items.every(
        (item) =>
          item.passed &&
          item.anchorId.startsWith("teach-") &&
          item.evidencePath.startsWith("qualification_report.") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.handsOnTeachingLesson.runbook.exportJson.includes("hands_on_teaching_lesson_runbook_json_v1") &&
      report.handsOnTeachingLesson.runbook.blockedActions.includes("Enable rules") &&
      report.handsOnTeachingLesson.runbook.blockedActions.includes("Package") &&
      report.handsOnTeachingLesson.blockedActions.includes("Package") &&
      report.handsOnTeachingLesson.blockedActions.includes("Release") &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "handsOnTeachingLesson"
      ) &&
      readFileSync(join(root, "src/components/hands-on-teaching-lesson-panel.tsx"), "utf8").includes(
        "中文带教课时演练"
      ) &&
      readFileSync(join(root, "src/components/hands-on-teaching-lesson-panel.tsx"), "utf8").includes(
        "老师可以这样教"
      ) &&
      readFileSync(join(root, "src/components/hands-on-teaching-lesson-panel.tsx"), "utf8").includes(
        "Hands-on lesson runbook"
      ) &&
      readFileSync(join(root, "src/components/hands-on-teaching-lesson-panel.tsx"), "utf8").includes(
        "hands_on_teaching_lesson_runbook_json_v1"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "HandsOnTeachingLessonPanel"
      ),
    `lesson=${report.summary.handsOnTeachingLessonReady + report.summary.handsOnTeachingLessonLocked}/${report.summary.handsOnTeachingLessonSteps}; runbook=${report.summary.handsOnTeachingRunbookReady + report.summary.handsOnTeachingRunbookLocked}/${report.summary.handsOnTeachingRunbookSteps}; locked=${report.summary.handsOnTeachingLessonLocked}; accepted=${report.handsOnTeachingLesson.accepted}.`
  );
  push(
    checks,
    "Visual review manifest is review-only",
    report.visualReviewManifest.status === "ready_for_teacher_review" &&
      report.visualReviewManifest.reviewOnly === true &&
      report.visualReviewManifest.accepted === false &&
      report.visualReviewManifest.packagingGated === true &&
      report.visualReviewManifest.verifierCommand === "npm run verify:learning" &&
      report.summary.visualReviewManifestSections === report.visualReviewManifest.evidenceSections.length &&
      report.summary.visualReviewManifestSections >= 8 &&
      report.summary.visualReviewManifestEndpoints === report.visualReviewManifest.evidenceEndpoints.length &&
      report.summary.visualReviewManifestEndpoints >= 3 &&
      report.visualReviewManifest.evidenceEndpoints.every(
        (endpoint) => endpoint.method === "GET" && endpoint.persisted === false
      ) &&
      report.visualReviewManifest.blockedActions.includes("Accept technology") &&
      report.visualReviewManifest.blockedActions.includes("Package") &&
      report.policyEvidence.some((item) => item.id === "visual-review-manifest-review-only" && item.passed) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "visualReviewManifest"
      ) &&
      readFileSync(join(root, "src/components/visual-review-manifest-panel.tsx"), "utf8").includes(
        "可视化审查清单"
      ) &&
      readFileSync(join(root, "src/components/visual-review-manifest-panel.tsx"), "utf8").includes(
        "verifierCommand"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("VisualReviewManifestPanel"),
    `manifest=${report.summary.visualReviewManifestSections} sections; endpoints=${report.summary.visualReviewManifestEndpoints}; accepted=${report.visualReviewManifest.accepted}; packaging=${report.visualReviewManifest.packagingGated}.`
  );
  push(
    checks,
    "Teacher challenge probe is review-only",
      challengeProbe.output.lightingCondition === "golden hour" &&
      challengeProbe.expectationResult.passed === true &&
      challengeProbe.expectationResult.lightingMatches === true &&
      challengeProbe.expectationResult.reviewMatches === true &&
      counterexampleChallengeProbe.output.lightingCondition === "natural light" &&
      counterexampleChallengeProbe.status === "needs_review" &&
      counterexampleChallengeProbe.expectationResult.passed === true &&
      challengeSuite.passed === challengeSuite.total &&
      challengeSuite.total === 3 &&
      challengeSuite.persisted === false &&
      challengeSuite.reviewOnly === true &&
      challengeSuite.accepted === false &&
      challengeSuite.packagingGated === true &&
      challengeSuite.items.some((item) => item.id === "positive-visual-cue" && item.probe.changedByMemory) &&
      challengeSuite.items.some(
        (item) =>
          item.id === "counterexample-midday" &&
          item.probe.output.lightingCondition === "natural light" &&
          item.probe.status === "needs_review"
      ) &&
      challengeSuite.items.some(
        (item) =>
          item.id === "ordinary-daylight" &&
          item.probe.output.lightingCondition === "natural light" &&
          item.probe.status === "needs_review"
      ) &&
      challengeSuite.items.every((item) => item.probe.traceSummary.length >= 7) &&
      challengeSuite.items.every((item) =>
        item.probe.traceSummary.every((step) => step.stepName && step.validation.trim().length > 0)
      ) &&
      challengeSuite.items.some((item) =>
        item.probe.ruleDecisions.some((decision) => decision.decision === "applied")
      ) &&
      challengeSuite.items.some((item) =>
        item.probe.ruleDecisions.some(
          (decision) => decision.decision === "conflicted" || decision.decision === "counterexample"
        )
      ) &&
      report.summary.challengeSuitePassed === report.summary.challengeSuiteTotal &&
      report.summary.challengeSuiteTotal === 3 &&
      report.summary.challengeSuiteTraceSteps >= 21 &&
      report.challengeSuite.passed === report.challengeSuite.total &&
      report.challengeSuite.total === 3 &&
      report.challengeSuite.persisted === false &&
      report.challengeSuite.accepted === false &&
      report.challengeSuite.packagingGated === true &&
      report.policyEvidence.some((item) => item.id === "review-only-challenge-suite" && item.passed) &&
      counterexampleChallengeProbe.expectationResult.lightingMatches === true &&
      counterexampleChallengeProbe.expectationResult.reviewMatches === true &&
      counterexampleChallengeProbe.persisted === false &&
      counterexampleChallengeProbe.ruleDecisions.some(
        (decision) => decision.decision === "conflicted" || decision.decision === "counterexample"
      ) &&
      challengeProbe.baselineOutput.lightingCondition === "natural light" &&
      challengeProbe.changedByMemory === true &&
      challengeProbe.memoryComparison.some(
        (item) =>
          item.field === "lightingCondition" &&
          item.baseline === "natural light" &&
          item.learned === "golden hour" &&
          item.changed
      ) &&
      challengeProbe.persisted === false &&
      challengeProbe.reviewOnly === true &&
      challengeProbe.accepted === false &&
      challengeProbe.packagingGated === true &&
      challengeProbe.traceSummary.length >= 7 &&
      challengeProbe.traceSummary.every((step) => step.validation.trim().length > 0) &&
      challengeProbe.ruleDecisions.some((decision) => decision.decision === "applied") &&
      readFileSync(join(root, "src/server/qualification/learning-challenge.ts"), "utf8").includes(
        "expectationResult"
      ) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "challengeSuitePassed"
      ) &&
      readFileSync(join(root, "src/server/qualification/learning-report.ts"), "utf8").includes(
        "review-only-challenge-suite"
      ) &&
      readFileSync(join(root, "src/app/api/tasks/[id]/learning-challenge/route.ts"), "utf8").includes(
        "buildLearningChallengeProbe"
      ) &&
      readFileSync(join(root, "src/app/api/tasks/[id]/learning-challenge-suite/route.ts"), "utf8").includes(
        "buildLearningChallengeSuite"
      ) &&
      !readFileSync(join(root, "src/app/api/tasks/[id]/learning-challenge/route.ts"), "utf8").includes(
        "saveRun"
      ) &&
      !readFileSync(join(root, "src/app/api/tasks/[id]/learning-challenge-suite/route.ts"), "utf8").includes(
        "saveRun"
      ) &&
      readFileSync(join(root, "src/components/learning-challenge-probe.tsx"), "utf8").includes(
        "只读审查探针"
      ) &&
      readFileSync(join(root, "src/components/learning-challenge-suite-panel.tsx"), "utf8").includes(
        "只读挑战套件"
      ) &&
      readFileSync(join(root, "src/components/learning-challenge-suite-panel.tsx"), "utf8").includes(
        "学习前后对比"
      ) &&
      readFileSync(join(root, "src/components/learning-challenge-suite-panel.tsx"), "utf8").includes(
        "规则决策"
      ) &&
      readFileSync(join(root, "src/components/learning-challenge-suite-panel.tsx"), "utf8").includes(
        "公开追踪回放"
      ) &&
      readFileSync(join(root, "src/components/learning-challenge-probe.tsx"), "utf8").includes(
        "记忆影响对比"
      ) &&
      readFileSync(join(root, "src/components/learning-challenge-probe.tsx"), "utf8").includes(
        "预期光线"
      ) &&
      readFileSync(join(root, "src/lib/learning-challenge-presets.ts"), "utf8").includes(
        "反例：正午强光"
      ) &&
      readFileSync(join(root, "src/components/learning-challenge-probe.tsx"), "utf8").includes(
        "defaultLearningChallengeSuite"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("LearningChallengeProbe") &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("LearningChallengeSuitePanel"),
    `challenge=${challengeProbe.baselineOutput.lightingCondition}->${challengeProbe.output.lightingCondition}; suite=${challengeSuite.passed}/${challengeSuite.total}; counterexample=${counterexampleChallengeProbe.output.lightingCondition}/${counterexampleChallengeProbe.status}; graded=${challengeProbe.expectationResult.passed}/${counterexampleChallengeProbe.expectationResult.passed}; persisted=${challengeProbe.persisted}; trace=${challengeProbe.traceSummary.length}; accepted=${challengeProbe.accepted}.`
  );
  push(
    checks,
    "AI generated execution plan is visible",
    Boolean(reportRequirement("generated-execution-plan")?.passed) &&
      report.summary.executionPlanSteps === 7 &&
      report.executionPlan.length === 7 &&
      report.executionPlan.every((step) => step.plannedOutputFields.length > 0 && step.validation.trim().length > 0) &&
      report.executionPlan.some((step) => step.needsHumanReview) &&
      readFileSync(join(root, "src/components/execution-plan-panel.tsx"), "utf8").includes(
        "AI 生成执行计划"
      ) &&
      readFileSync(join(root, "src/components/execution-plan-panel.tsx"), "utf8").includes(
        "执行前计划证据"
      ) &&
      readFileSync(join(root, "src/components/run-console.tsx"), "utf8").includes("ExecutionPlanPanel"),
    `report=${reportRequirement("generated-execution-plan")?.passed ? "passed" : "failed"}; plan steps=${report.summary.executionPlanSteps}.`
  );
  push(
    checks,
    "Visual teaching editor supports full node palette and connection audit",
    ["input", "understand", "decision", "execute", "check", "human_review", "output"].every((nodeType) =>
      readFileSync(join(root, "src/components/workflow-editor.tsx"), "utf8").includes(`type: \"${nodeType}\"`) ||
      readFileSync(join(root, "src/components/workflow-editor.tsx"), "utf8").includes(`type: "${nodeType}"`)
    ) &&
      readFileSync(join(root, "src/components/workflow-editor.tsx"), "utf8").includes("添加带教节点") &&
      readFileSync(join(root, "src/components/workflow-editor.tsx"), "utf8").includes("连接审计") &&
      readFileSync(join(root, "src/components/workflow-editor.tsx"), "utf8").includes("onConnect") &&
      readFileSync(join(root, "src/components/workflow-editor.tsx"), "utf8").includes("保存版本") &&
      readFileSync(join(root, "src/app/api/workflows/[id]/route.ts"), "utf8").includes("saveWorkflowVersion"),
    "Visual editor can add each teaching node type, connect nodes, audit the path, and save a workflow version."
  );
  push(
    checks,
    "Task teaching material captures notes and error cases",
    readFileSync(join(root, "src/components/task-create-form.tsx"), "utf8").includes("已知错误案例") &&
      readFileSync(join(root, "src/components/task-create-form.tsx"), "utf8").includes("光线判断错误") &&
      readFileSync(join(root, "src/app/api/tasks/route.ts"), "utf8").includes("errorCases") &&
      readFileSync(join(root, "src/server/memory/memory-store.ts"), "utf8").includes("errorCases") &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("已知错误案例") &&
      readFileSync(join(root, "src/lib/demo-data.ts"), "utf8").includes("Missing advice"),
    "Task creation and task detail preserve teacher notes plus known error cases as reusable task teaching material."
  );
  push(
    checks,
    "Visual workflow nodes align to trace steps",
    Boolean(reportRequirement("workflow-trace-alignment")?.passed) &&
      report.summary.traceAlignedNodes === 7 &&
      report.summary.traceTotalNodes === 7 &&
      report.traceAlignment.length === 7 &&
      report.traceAlignment.every((item) => item.traceStepId && item.validation),
    `report=${reportRequirement("workflow-trace-alignment")?.passed ? "passed" : "failed"}; aligned=${report.summary.traceAlignedNodes}/${report.summary.traceTotalNodes}.`
  );
  push(
    checks,
    "Private reasoning is not exposed",
    Boolean(reportRequirement("private-reasoning-withheld")?.passed) &&
      Boolean(report.policyEvidence.find((item) => item.id === "public-trace-only")?.passed),
    report.policyEvidence.find((item) => item.id === "public-trace-only")?.evidence ??
      reportRequirement("private-reasoning-withheld")?.evidence ??
      "Missing private-reasoning requirement."
  );
  push(
    checks,
    "Guardrail policy gates are visible",
      Boolean(reportRequirement("guardrail-policy-visible")?.passed) &&
      report.summary.policyGatesPassed === report.summary.policyGatesTotal &&
      report.summary.policyGatesTotal >= 6 &&
      report.policyEvidence.every((item) => item.passed) &&
      report.policyEvidence.some((item) => item.id === "corrections-link-to-runs") &&
      report.policyEvidence.some((item) => item.id === "visual-scenario-matrix") &&
      report.policyEvidence.some((item) => item.id === "visual-regression-comparison") &&
      report.policyEvidence.some((item) => item.id === "visual-robustness-stress-suite") &&
      report.policyEvidence.some((item) => item.id === "visual-cue-audit-trail") &&
      report.policyEvidence.some((item) => item.id === "visual-decision-ledger") &&
      report.policyEvidence.some((item) => item.id === "visual-learning-limits-visible") &&
      report.policyEvidence.some((item) => item.id === "visual-rule-coverage-matrix") &&
      report.policyEvidence.some((item) => item.id === "visual-correction-rehearsal") &&
      report.policyEvidence.some((item) => item.id === "visual-learning-state-transition-audit") &&
      report.policyEvidence.some((item) => item.id === "visual-confidence-calibration") &&
      report.policyEvidence.some((item) => item.id === "visual-behavior-scorecard") &&
      report.policyEvidence.some((item) => item.id === "visual-evidence-replay") &&
      report.policyEvidence.some((item) => item.id === "visual-red-team-risk-register") &&
      report.policyEvidence.some((item) => item.id === "visual-uncertainty-escalation-audit") &&
      report.policyEvidence.some((item) => item.id === "spatial-engineering-teaching-model") &&
      report.policyEvidence.some((item) => item.id === "domain-learning-workflow") &&
      report.policyEvidence.some((item) => item.id === "multi-apprentice-cross-domain-validation") &&
      report.policyEvidence.some((item) => item.id === "cross-domain-teacher-batch-score-replay") &&
      report.policyEvidence.some((item) => item.id === "cross-domain-teacher-score-recovery-diff") &&
      report.policyEvidence.some((item) => item.id === "human-teaching-memory-protocol") &&
      report.policyEvidence.some((item) => item.id === "voice-browser-runtime-batch-gap-diff") &&
      report.policyEvidence.some((item) => item.id === "teacher-review-draft-persistence-recovery") &&
      report.policyEvidence.some((item) => item.id === "teacher-review-draft-diff-recovery-replay") &&
      report.policyEvidence.some((item) => item.id === "visual-teacher-review-worksheet") &&
      report.policyEvidence.some((item) => item.id === "visual-review-dossier") &&
      report.policyEvidence.some((item) => item.id === "visual-review-manifest-review-only") &&
      report.policyEvidence.some((item) => item.id === "packaging-locked"),
    `report=${reportRequirement("guardrail-policy-visible")?.passed ? "passed" : "failed"}; policy=${report.summary.policyGatesPassed}/${report.summary.policyGatesTotal}.`
  );
  push(
    checks,
    "Teacher review checklist covers the MVP loop",
    Boolean(reportRequirement("teacher-review-checklist")?.passed) &&
      report.summary.teacherReviewChecklistPassed === 12 &&
      report.summary.teacherReviewChecklistTotal === 12 &&
      report.teacherReviewChecklist.every((item) => item.passed) &&
      report.teacherReviewChecklist.some((item) => item.id === "mvp-apply-next-run") &&
      report.teacherReviewChecklist.some((item) => item.id === "packaging-waits-for-teacher"),
    `report=${reportRequirement("teacher-review-checklist")?.passed ? "passed" : "failed"}; checklist=${report.summary.teacherReviewChecklistPassed}/${report.summary.teacherReviewChecklistTotal}.`
  );
  push(
    checks,
    "Learning loop timeline proves the core loop",
    Boolean(reportRequirement("learning-loop-timeline")?.passed) &&
      report.summary.learningLoopTimelinePassed === 6 &&
      report.summary.learningLoopTimelineTotal === 6 &&
      report.learningLoopTimeline.every((item) => item.passed) &&
      report.learningLoopTimeline.map((item) => item.id).join(" > ") ===
        "human-teaches > ai-executes-before > human-corrects > system-extracts-rules > ai-improves-next-run > teacher-reviews-transparency",
    `report=${reportRequirement("learning-loop-timeline")?.passed ? "passed" : "failed"}; timeline=${report.summary.learningLoopTimelinePassed}/${report.summary.learningLoopTimelineTotal}.`
  );
  push(
    checks,
    "Correction became reusable memory",
    Boolean(reportRequirement("feedback-memory")?.passed),
    reportRequirement("feedback-memory")?.evidence ?? "Missing feedback-memory requirement."
  );
  push(
    checks,
    "Correction learning record exposes required structured fields",
    readFileSync(join(root, "src/components/correction-learning-record.tsx"), "utf8").includes(
      "结构化纠错学习记录"
    ) &&
      readFileSync(join(root, "src/components/correction-learning-record.tsx"), "utf8").includes("错误类型") &&
      readFileSync(join(root, "src/components/correction-learning-record.tsx"), "utf8").includes("错误原因") &&
      readFileSync(join(root, "src/components/correction-learning-record.tsx"), "utf8").includes(
        "适用条件"
      ) &&
      readFileSync(join(root, "src/components/correction-learning-record.tsx"), "utf8").includes(
        "纠正后的规则动作"
      ) &&
      readFileSync(join(root, "src/components/correction-learning-record.tsx"), "utf8").includes(
        "关联任务和来源运行"
      ) &&
      readFileSync(join(root, "src/components/correction-learning-record.tsx"), "utf8").includes(
        "未来应用策略"
      ) &&
      readFileSync(join(root, "src/components/correction-learning-record.tsx"), "utf8").includes(
        "已存为长期规则"
      ) &&
      readFileSync(join(root, "src/components/run-console.tsx"), "utf8").includes("CorrectionLearningRecord"),
    "Run page exposes error type, reason, condition, corrected action, related task, source run, automatic-apply policy, and teacher-confirmation policy."
  );
  push(
    checks,
    "Teacher controls future memory application policy",
    readFileSync(join(root, "src/components/run-console.tsx"), "utf8").includes("老师记忆策略") &&
      readFileSync(join(root, "src/components/run-console.tsx"), "utf8").includes("运行 AI 学徒") &&
      readFileSync(join(root, "src/components/run-console.tsx"), "utf8").includes("自然语言纠错") &&
      readFileSync(join(root, "src/components/run-console.tsx"), "utf8").includes("结构化字段纠错") &&
      readFileSync(join(root, "src/components/run-console.tsx"), "utf8").includes("示例带教") &&
      readFileSync(join(root, "src/components/run-console.tsx"), "utf8").includes(
        "以后相似任务自动应用"
      ) &&
      readFileSync(join(root, "src/components/run-console.tsx"), "utf8").includes(
        "启用前必须请老师确认"
      ) &&
      readFileSync(join(root, "src/components/run-console.tsx"), "utf8").includes("memoryPolicy") &&
      readFileSync(join(root, "src/app/api/corrections/route.ts"), "utf8").includes("memoryPolicy") &&
      readFileSync(join(root, "src/server/corrections/rule-extractor.ts"), "utf8").includes(
        "resolveMemoryPolicy"
      ) &&
      readFileSync(join(root, "src/server/corrections/rule-extractor.test.ts"), "utf8").includes(
        "keeps a lighting correction paused"
      ),
    "Correction flow lets the teacher choose automatic reuse or paused memory, and the extractor enables or pauses the rule accordingly."
  );
  push(
    checks,
    "Reusable memory provenance is traceable",
    Boolean(reportRequirement("memory-provenance")?.passed) &&
      report.summary.memoryProvenanceRules === report.summary.rules &&
      report.memoryProvenance.every((item) => item.sources.length > 0) &&
      report.memoryProvenance.some((item) => item.appliedRunIds.includes("run-demo-golden-hour")),
    `report=${reportRequirement("memory-provenance")?.passed ? "passed" : "failed"}; sourced=${report.summary.memoryProvenanceRules}/${report.summary.rules}.`
  );
  push(
    checks,
    "Visual demonstration is saved with reference evidence",
    report.visualDemos.some((demo) => demo.hasReferenceImage && demo.visualCueCount > 0),
    `${report.visualDemos[0]?.title ?? "missing"}; cues=${report.visualDemos[0]?.visualCueCount ?? 0}.`
  );
  push(
    checks,
    "Visual demonstration learning record explains image-to-rule conversion",
    readFileSync(join(root, "src/components/visual-demonstration-learning-record.tsx"), "utf8").includes(
      "视觉示范学习记录"
    ) &&
      readFileSync(join(root, "src/components/visual-demonstration-learning-record.tsx"), "utf8").includes(
        "老师参考画面"
      ) &&
      readFileSync(join(root, "src/components/visual-demonstration-learning-record.tsx"), "utf8").includes(
        "抽取出的视觉线索"
      ) &&
      readFileSync(join(root, "src/components/visual-demonstration-learning-record.tsx"), "utf8").includes(
        "从视觉证据抽取的规则"
      ) &&
      readFileSync(join(root, "src/components/visual-demonstration-learning-record.tsx"), "utf8").includes(
        "未来复用策略"
      ) &&
      readFileSync(join(root, "src/components/visual-demonstration-form.tsx"), "utf8").includes(
        "VisualDemonstrationLearningRecord"
      ),
    "Visual demo save flow exposes reference frame, extracted visual cues, generated rule, and future reuse policy."
  );
  push(
    checks,
    "Visual demonstration grounds cues in image regions",
    report.visualDemos.some((demo) => demo.annotationCount > 0) &&
      readFileSync(join(root, "src/lib/types.ts"), "utf8").includes("VisualCueAnnotation") &&
      readFileSync(join(root, "src/app/api/visual-demonstrations/route.ts"), "utf8").includes(
        "parseVisualAnnotations"
      ) &&
      readFileSync(join(root, "src/components/visual-demonstration-form.tsx"), "utf8").includes(
        "把视觉线索绑定到图片区域"
      ) &&
      readFileSync(join(root, "src/components/visual-demonstration-learning-record.tsx"), "utf8").includes(
        "带区域证据的视觉线索"
      ) &&
      readFileSync(join(root, "src/components/learning-evidence-panel.tsx"), "utf8").includes(
        "带位置证据的视觉线索"
      ),
    `grounded=${report.visualDemos.filter((demo) => demo.annotationCount > 0).length}/${report.visualDemos.length}; source, API, form, and review UI expose annotation evidence.`
  );
  push(
    checks,
    "Teaching example and execution history became memory",
    Boolean(reportRequirement("multi-source-teaching")?.passed),
    reportRequirement("multi-source-teaching")?.evidence ?? "Missing multi-source requirement."
  );
  push(
    checks,
    "Learning changes the next run",
    Boolean(reportRequirement("next-run-improvement")?.passed) &&
      learningDelta?.sourceRunId === "run-demo-before-teaching" &&
      learningDelta?.appliedRunId === "run-demo-golden-hour" &&
      learningDelta?.beforeLighting === "natural light" &&
      learningDelta?.afterLighting === "golden hour" &&
      learningDelta?.fieldChanges.some((change) => change.field === "lightingCondition") &&
      learningDelta?.fieldChanges.some((change) => change.field === "photographyAdvice") &&
      learningDelta?.fieldChanges.some((change) => change.field === "recommendedTitles"),
    learningDelta
      ? `before=${learningDelta.sourceRunId}:${learningDelta.beforeLighting}; after=${learningDelta.appliedRunId}:${learningDelta.afterLighting}; fields=${learningDelta.fieldChanges.map((change) => change.field).join(", ")}; rule=${learningDelta.ruleTitle}.`
      : "Missing learning delta."
  );
  push(
    checks,
    "Qualification report is ready for teacher review",
    report.status === "qualified_for_teacher_review" &&
      report.summary.requirementsPassed === 16 &&
      report.summary.requirementsTotal === 16,
    `status=${report.status}; requirements=${report.summary.requirementsPassed}/${report.summary.requirementsTotal}.`
  );
  push(
    checks,
    "Teacher acceptance boundary keeps app review-only",
    Boolean(reportRequirement("teacher-acceptance-boundary")?.passed) &&
      teacherBoundary.mode === "visual_learning_review_only" &&
      teacherBoundary.accepted === false &&
      teacherBoundary.packagingGated === true &&
      teacherBoundary.exposedAcceptanceAction === false &&
      ["Packaging", "Release", "Wrapping"].every((item) => teacherBoundary.blockedWork.includes(item)) &&
      report.summary.acceptanceBoundaryPassed === 1 &&
      report.summary.acceptanceBoundaryTotal === 1,
    `mode=${teacherBoundary.mode}; accepted=${teacherBoundary.accepted}; blocked=${teacherBoundary.blockedWork.join(", ")}.`
  );
  push(
    checks,
    "Teacher acceptance evidence agenda is review-only",
    report.teacherAcceptanceEvidenceAgenda.mode === "teacher_acceptance_evidence_gap_agenda_v1" &&
      report.teacherAcceptanceEvidenceAgenda.format === "teacher_acceptance_evidence_gap_agenda_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.status === "ready_for_teacher_review" &&
      report.teacherAcceptanceEvidenceAgenda.reviewOnly === true &&
      report.teacherAcceptanceEvidenceAgenda.accepted === false &&
      report.teacherAcceptanceEvidenceAgenda.packagingGated === true &&
      report.teacherAcceptanceEvidenceAgenda.passed === true &&
      report.summary.teacherAcceptanceAgendaItems === report.teacherAcceptanceEvidenceAgenda.items.length &&
      report.summary.teacherAcceptanceAgendaItems === 5 &&
      report.summary.teacherAcceptanceAgendaReady === report.teacherAcceptanceEvidenceAgenda.readyItems &&
      report.summary.teacherAcceptanceAgendaReady === 3 &&
      report.summary.teacherAcceptanceAgendaUnanswered === report.teacherAcceptanceEvidenceAgenda.unansweredItems &&
      report.summary.teacherAcceptanceAgendaUnanswered === 1 &&
      report.summary.teacherAcceptanceAgendaLocked === report.teacherAcceptanceEvidenceAgenda.lockedItems &&
      report.summary.teacherAcceptanceAgendaLocked === 1 &&
      report.summary.teacherAcceptanceAgendaDecisionItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.itemCount &&
      report.summary.teacherAcceptanceAgendaDecisionItems === 5 &&
      report.summary.teacherAcceptanceAgendaDecisionReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.passed ? 1 : 0) &&
      report.summary.teacherAcceptanceAgendaDecisionReady === 1 &&
      report.summary.teacherAcceptanceAgendaAllowedDecisions ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.allowedDecisions.length &&
      report.summary.teacherAcceptanceAgendaAllowedDecisions === 4 &&
      report.summary.teacherAcceptanceAgendaDecisionReplayRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.rowCount &&
      report.summary.teacherAcceptanceAgendaDecisionReplayRows === 5 &&
      report.summary.teacherAcceptanceAgendaDecisionReplayReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.passed ? 1 : 0) &&
      report.summary.teacherAcceptanceAgendaDecisionReplayReady === 1 &&
      report.summary.teacherAcceptanceAgendaDecisionReplayLockedRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.packagingLockedRows &&
      report.summary.teacherAcceptanceAgendaDecisionReplayLockedRows === 5 &&
      report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.rows.length &&
      report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryRows === 5 &&
      report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.passed ? 1 : 0) &&
      report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryReady === 1 &&
      report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryPersisted ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.persistedDraftCount &&
      report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryMissingRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.missingRecoveredRows &&
      (report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryPersisted === 0
        ? report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryMissingRows === 5
        : report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryMissingRows === 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewQueueItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewQueueItems >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewQueueReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.passed ? 1 : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewQueueReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewQueueLockedItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.lockedItems &&
      report.summary.teacherAcceptanceAgendaNextReviewHandoffSteps ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.stepCount &&
      report.summary.teacherAcceptanceAgendaNextReviewHandoffSteps >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewHandoffReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.passed ? 1 : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewHandoffReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewHandoffLockedSteps ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.lockedSteps &&
      report.summary.teacherAcceptanceAgendaNextReviewRunbookSteps ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.stepCount &&
      report.summary.teacherAcceptanceAgendaNextReviewRunbookSteps >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewRunbookReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.passed ? 1 : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewRunbookReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewRunbookLockedChecks ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.lockedChecks &&
      report.summary.teacherAcceptanceAgendaNextReviewDryRunRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewDryRunRows >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewDryRunReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewDryRunReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewDryRunNoOpRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .noOpRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptRows >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptNeedsReviewRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.needsReviewRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptValidationRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptValidationRows >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptValidationReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptValidationReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptValidationBlockedDecisions ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.blockedDecisionCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptReplayRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptReplayRows >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptReplayReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptReplayReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptReplayBlockedDecisions ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.blockedDecisionCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanItems >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanBlockedRoutes ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.blockedRouteCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditItems >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditForbiddenTransitions ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.forbiddenTransitionCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketItems >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketCommands ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.commandCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultRows >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultNotRunRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .notRunRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate
          .validation.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationRows >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationBlockedStatuses ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .blockedStatusCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayRows >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayBlockedStatuses ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.blockedStatusCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueRows >= 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueReady === 1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueMismatchStops ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.mismatchStopRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffSteps ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.stepCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffSteps >=
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffMismatchStops ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.mismatchStopSteps &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookItems >=
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookLockedChecks ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.lockedChecks &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunRows >=
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunNoOpRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.noOpRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptRows >=
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.needsReviewRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationRows >=
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.blockedDecisionRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount *
          3 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay
          .blockedDecisionRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .blockedItems &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .readyForFollowUpItems &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.stepCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue
          .handoff.blockedSteps &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook
          .passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.lockedChecks &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.noOpRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.needsReviewRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.blockedDecisionRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows *
          3 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.blockedDecisionRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.blockedItems &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.readyForFollowUpItems &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.blockedStepCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.lockedChecks &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.noOpRows &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rows.every(
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
        ) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.needsReviewRows &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
          (row) =>
            row.defaultDecision === "needs_teacher_review" &&
            row.blockerQuestion.includes("accepted=true") &&
            row.blockerQuestion.includes("Package") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
      report.teacherAcceptanceEvidenceAgenda.items.every(
        (item) =>
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true &&
          item.passed &&
          item.evidencePath.length > 0
      ) &&
      report.teacherAcceptanceEvidenceAgenda.items.some(
        (item) => item.readiness === "needs_teacher_answer"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.items.some(
        (item) => item.readiness === "locked_until_teacher_acceptance"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.exportJson.includes(
        "teacher_acceptance_evidence_gap_agenda_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.format ===
        "teacher_acceptance_agenda_decision_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.reviewOnly === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.accepted === false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.packagingGated === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.items.every(
        (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.items.some(
        (item) => item.proposedDecision === "locked"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.templateJson.includes(
        "teacher_acceptance_agenda_decision_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.format ===
        "teacher_acceptance_agenda_decision_replay_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.reviewOnly === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.accepted === false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.packagingGated === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.rows.every(
        (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.rows.some(
        (row) => row.simulatedDecision === "locked"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.exportJson.includes(
        "teacher_acceptance_agenda_decision_replay_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.decisionReplay.blockedActions.includes("Package") &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.format ===
        "teacher_acceptance_agenda_decision_draft_recovery_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.reviewOnly === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.accepted === false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.packagingGated === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.rows.every(
        (row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.exportJson.includes(
        "teacher_acceptance_agenda_decision_draft_recovery_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.format ===
        "teacher_acceptance_agenda_next_review_queue_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.reviewOnly === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.accepted === false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.packagingGated === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.items.every(
        (item) => item.ruleEnabled === false && item.accepted === false && item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.exportJson.includes(
        "teacher_acceptance_agenda_next_review_queue_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.format ===
        "teacher_acceptance_agenda_next_review_handoff_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.reviewOnly === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.accepted === false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.packagingGated === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.stepCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewQueue.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.steps.every(
        (step) => step.ruleEnabled === false && step.accepted === false && step.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.exportJson.includes(
        "teacher_acceptance_agenda_next_review_handoff_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.handoffText.includes(
        "Do not accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.format ===
        "teacher_acceptance_agenda_next_review_runbook_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.reviewOnly === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.accepted === false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.packagingGated === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.stepCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.stepCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.steps.every(
        (step) =>
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true &&
          step.evidencePath.length > 0 &&
          step.stopCondition.includes("Stop")
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.exportJson.includes(
        "teacher_acceptance_agenda_next_review_runbook_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .format === "teacher_acceptance_agenda_next_review_dry_run_audit_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .reviewOnly === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .accepted === false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .packagingGated === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.stepCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.rows.every(
        (row) =>
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.lockAssertion.includes("packagingGated=true") &&
          row.noOpActions.includes("Package")
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.exportJson.includes(
        "teacher_acceptance_agenda_next_review_dry_run_audit_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.format === "teacher_acceptance_agenda_next_review_receipt_template_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.reviewOnly === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.accepted === false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.packagingGated === true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true &&
          row.nextReviewerNotePlaceholder.includes("not technology acceptance")
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_template_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.format ===
        "teacher_acceptance_agenda_next_review_receipt_validation_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
        (row) =>
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.allowedDecisions.includes("blocked") &&
          row.allowedDecisions.includes("ready_for_follow_up") &&
          row.blockedDecision === "accepted" &&
          row.invalidIf.includes("accepted=true") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_validation_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.format ===
        "teacher_acceptance_agenda_next_review_receipt_decision_replay_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount *
          3 &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.rows.every(
        (row) =>
          row.blockedDecisionReminder.includes("accepted") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.rows.some(
        (row) => row.simulatedDecision === "blocked"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_decision_replay_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.itemCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.items.every(
        (item) =>
          item.lockReminder.includes("accepted remains blocked") &&
          item.stopCondition.includes("packagingGated=false") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.items.some(
        (item) => item.plannedRoute === "blocked_receipt_escalation"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.itemCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.items.every(
        (item) =>
          item.forbiddenTransitions.includes("decision=accepted") &&
          item.forbiddenTransitions.includes("packagingGated=false") &&
          item.noOpAssertion.includes("no-op") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.itemCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.items.every(
        (item) =>
          item.evidencePath.includes("followUpPlan.lockAudit") &&
          item.verificationCommand === "npm.cmd run verify:learning" &&
          item.expectedResult.includes("accepted=false") &&
          item.expectedResult.includes("packaging=true") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.itemCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.items.every(
        (item) =>
          item.defaultStatus === "not_run_yet" &&
          item.statusOptions.includes("mismatch_blocked") &&
          item.nextReviewerNotePlaceholder.includes("not technology acceptance") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.itemCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.items.every(
        (item) =>
          item.allowedStatuses.includes("not_run_yet") &&
          item.allowedStatuses.includes("matched_expected") &&
          item.allowedStatuses.includes("mismatch_blocked") &&
          item.blockedStatus === "accepted" &&
          item.invalidIf.includes("accepted=true") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.itemCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.itemCount *
          3 &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.items.every(
        (item) =>
          item.blockedStatusReminder.includes("accepted") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.items.some(
        (item) => item.simulatedStatus === "mismatch_blocked"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.itemCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.notRunRows >=
        1 &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.matchedRows >=
        1 &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.mismatchStopRows >=
        1 &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.items.every(
        (item) =>
          item.stopCondition.includes("accepted") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.stepCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.mismatchStopSteps >=
        1 &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.steps.every(
        (step) =>
          step.expectedLockedResult.includes("accepted=false") &&
          step.blockedIf.includes("accepted=true") &&
          step.blockedIf.includes("packagingGated=false") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.stepCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.lockedChecks ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.stepCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.items.every(
        (item) =>
          item.lockAssertion.includes("accepted=false") &&
          item.stopCondition.includes("accepted=true") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.noOpRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rows.every(
        (row) =>
          row.lockAssertion.includes("accepted=false") &&
          row.noOpActions.includes("Do not accept technology") &&
          row.noOpActions.includes("Do not package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.needsReviewRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.blockedDecisionRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
        (row) =>
          row.allowedDecisions.includes("needs_teacher_review") &&
          row.allowedDecisions.includes("blocked") &&
          row.allowedDecisions.includes("ready_for_follow_up") &&
          row.blockedDecision === "accepted" &&
          row.invalidIf.includes("decision=accepted") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount *
          3 &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.blockedDecisionRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rows.every(
        (row) =>
          ["needs_teacher_review", "blocked", "ready_for_follow_up"].includes(row.simulatedDecision) &&
          row.blockedDecisionReminder.includes("accepted remains blocked") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.itemCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.blockedItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.blockedDecisionRows &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.readyForFollowUpItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.blockedDecisionRows &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items.every(
        (item) =>
          ["needs_teacher_review_queue", "blocked_queue", "ready_for_follow_up_queue"].includes(item.queueLane) &&
          item.blockedTransitions.includes("accepted") &&
          item.blockedTransitions.includes("ruleEnabled=true") &&
          item.blockedTransitions.includes("packagingGated=false") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.blockedSteps ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.blockedItems &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.steps.every(
        (step) =>
          step.blockedIf.includes("accepted") &&
          step.blockedIf.includes("ruleEnabled=true") &&
          step.blockedIf.includes("packagingGated=false") &&
          step.expectedLockedResult.includes("accepted=false") &&
          step.ruleEnabled === false &&
          step.accepted === false &&
          step.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.lockedChecks ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.items.every(
        (item) =>
          item.lockAssertion.includes("ruleEnabled=false") &&
          item.lockAssertion.includes("accepted=false") &&
          item.lockAssertion.includes("packagingGated=true") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.noOpRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rows.every(
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
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.needsReviewRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.blockerQuestion.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.blockedDecisionRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rows.every(
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
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.rowCount *
          3 &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.blockedDecisionRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rows.every(
        (row) =>
          ["needs_teacher_review", "blocked", "ready_for_follow_up"].includes(row.simulatedDecision) &&
          row.blockedDecisionReminder.includes("accepted") &&
          row.consequence.includes("does not accept technology") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.itemCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.blockedItems >=
        1 &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.readyForFollowUpItems >=
        1 &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.items.every(
        (item) =>
          ["needs_teacher_review_queue", "blocked_queue", "ready_for_follow_up_queue"].includes(item.queueLane) &&
          item.blockedTransitions.includes("accepted") &&
          item.blockedTransitions.includes("ruleEnabled=true") &&
          item.blockedTransitions.includes("packagingGated=false") &&
          item.ruleEnabled === false &&
          item.accepted === false &&
          item.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.blockedActions.includes(
        "Accept technology"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.blockedStepCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.steps.every(
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
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.lockedChecks ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.items.every(
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
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.noOpRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rows.every(
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
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.needsReviewRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
        (row) =>
          row.defaultDecision === "needs_teacher_review" &&
          row.blockerQuestion.includes("accepted=true") &&
          row.blockerQuestion.includes("Package") &&
          row.ruleEnabled === false &&
          row.accepted === false &&
          row.packagingGated === true
      ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit.receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.exportJson.includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
      ) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationBlockedDecisions ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.blockedDecisionRows &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.reviewOnly ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.accepted ===
        false &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.packagingGated ===
        true &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.rowCount ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.blockedDecisionRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.rowCount &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.rows.every(
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
        ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.exportJson.includes(
          "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
        ) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows *
          3 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayBlockedDecisions ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.blockedDecisionRows &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.rows.every(
          (row) =>
            ["needs_teacher_review", "blocked", "ready_for_follow_up"].includes(row.simulatedDecision) &&
            row.blockedDecisionReminder.includes("accepted remains blocked") &&
            row.consequence.includes("does not accept technology") &&
            row.ruleEnabled === false &&
            row.accepted === false &&
            row.packagingGated === true
        ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.exportJson.includes(
          "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
        ) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueBlockedItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.blockedItems &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueReadyForFollowUpItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.readyForFollowUpItems &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.items.every(
          (item) =>
            ["needs_teacher_review_queue", "blocked_queue", "ready_for_follow_up_queue"].includes(item.queueLane) &&
            item.blockedTransitions.includes("accepted") &&
            item.blockedTransitions.includes("ruleEnabled=true") &&
            item.blockedTransitions.includes("packagingGated=false") &&
            item.blockedTransitions.includes("Package") &&
            item.ruleEnabled === false &&
            item.accepted === false &&
            item.packagingGated === true
        ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.exportJson.includes(
          "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
        ) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.stepCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffBlockedSteps ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.blockedSteps &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.handoff.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.handoff.steps.every(
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
        ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.handoff.exportJson.includes(
          "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
        ) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.itemCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookLockedChecks ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.lockedChecks &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.handoff.runbook.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.handoff.runbook.items.every(
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
        ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.handoff.runbook.exportJson.includes(
          "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
        ) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunNoOpRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.noOpRows &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.rows.every(
          (row) =>
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
        ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.exportJson.includes(
          "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
        ) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rowCount &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows ===
        report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady ===
        (report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.passed
          ? 1
          : 0) &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptReady ===
        1 &&
      report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptNeedsReviewRows ===
        report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
          .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
          .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
          .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit
          .receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
          .needsReviewRows &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.format ===
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1" &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.rows.every(
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
        ) &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.draftRecovery.nextReviewHandoff.runbook.dryRunAudit
        .receiptTemplate.validation.decisionReplay.followUpPlan.lockAudit.verificationPacket.resultTemplate.validation
        .replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff
        .runbook.dryRunAudit.receiptTemplate.validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate
        .validation.replay.nextReviewQueue.handoff.runbook.dryRunAudit.receiptTemplate.exportJson.includes(
          "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
        ) &&
      readFileSync(
        join(root, "src/app/api/teacher-acceptance-agenda-decision-drafts/route.ts"),
        "utf8"
      ).includes("buildTeacherAcceptanceAgendaDecisionDraft") &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.blockedActions.includes("Accept technology") &&
      report.teacherAcceptanceEvidenceAgenda.decisionExchange.blockedActions.includes("Package") &&
      report.teacherAcceptanceEvidenceAgenda.blockedActions.includes("Accept technology") &&
      report.teacherAcceptanceEvidenceAgenda.blockedActions.includes("Package") &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance evidence agenda"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda decision exchange"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda decision replay"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda decision draft recovery"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda next review queue"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-agenda-draft-control.tsx"), "utf8").includes(
        "/api/teacher-acceptance-agenda-decision-drafts"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_evidence_gap_agenda_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_decision_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_decision_replay_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_decision_draft_recovery_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_queue_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_decision_replay_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_plan_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_lock_audit_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_packet_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_template_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_validation_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_next_review_queue_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_audit_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_template_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run audit"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt template"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run audit"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_audit_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt template"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_template_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_json_v1"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "Teacher acceptance agenda next review receipt verification result replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff runbook dry-run receipt validation replay queue handoff"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "teacher_acceptance_agenda_next_review_receipt_follow_up_verification_result_replay_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_runbook_dry_run_receipt_validation_replay_next_review_queue_handoff_json_v1"
      ),
    `agenda=${report.summary.teacherAcceptanceAgendaReady}/${report.summary.teacherAcceptanceAgendaItems}; decisions=${report.summary.teacherAcceptanceAgendaDecisionItems}; replay=${report.summary.teacherAcceptanceAgendaDecisionReplayRows}; recovered=${report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryPersisted}/${report.summary.teacherAcceptanceAgendaDecisionDraftRecoveryRows}; queue=${report.summary.teacherAcceptanceAgendaNextReviewQueueItems}; handoff=${report.summary.teacherAcceptanceAgendaNextReviewHandoffSteps}; runbook=${report.summary.teacherAcceptanceAgendaNextReviewRunbookSteps}; dryRun=${report.summary.teacherAcceptanceAgendaNextReviewDryRunRows}; receipt=${report.summary.teacherAcceptanceAgendaNextReviewReceiptRows}; receiptValidation=${report.summary.teacherAcceptanceAgendaNextReviewReceiptValidationRows}; receiptReplay=${report.summary.teacherAcceptanceAgendaNextReviewReceiptReplayRows}; receiptFollowUp=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpPlanItems}; receiptLockAudit=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpLockAuditItems}; receiptVerifyPacket=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationPacketItems}; receiptVerifyResult=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultRows}; receiptVerifyValidation=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultValidationRows}; receiptVerifyReplay=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayRows}; receiptVerifyReplayQueue=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueRows}; receiptVerifyReplayQueueHandoff=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffSteps}; receiptVerifyReplayQueueHandoffRunbook=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookItems}; receiptVerifyReplayQueueHandoffRunbookDryRun=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunRows}; receiptVerifyReplayQueueHandoffRunbookDryRunReceipt=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptRows}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidation=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationRows}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplay=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueue=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoff=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbook=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceipt=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidation=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplay=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueue=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoff=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbook=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRun=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunRows}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceipt=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptRows}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidation=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationRows}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplay=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayRows}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueue=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueItems}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoff=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffSteps}; receiptVerifyReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbook=${report.summary.teacherAcceptanceAgendaNextReviewReceiptFollowUpVerificationResultReplayQueueHandoffRunbookDryRunReceiptValidationReplayQueueHandoffRunbookItems}; unanswered=${report.summary.teacherAcceptanceAgendaUnanswered}; locked=${report.summary.teacherAcceptanceAgendaLocked}; accepted=${report.teacherAcceptanceEvidenceAgenda.accepted}; packaging=${report.teacherAcceptanceEvidenceAgenda.packagingGated}.`
  );
  push(
    checks,
    "Packaging remains gated",
    report.packaging.gated &&
      report.packaging.accepted === false &&
      report.packaging.status === "pending_teacher_acceptance" &&
      readFileSync(join(root, "src/lib/teacher-acceptance.ts"), "utf8").includes("封装闸门已锁定") &&
      readFileSync(join(root, "src/components/learning-loop-gate.tsx"), "utf8").includes("visualLearningAcceptanceGate") &&
      readFileSync(join(root, "README.md"), "utf8").includes("封装、分发或产品包装必须等用户确认"),
    `status=${report.packaging.status}; accepted=${report.packaging.accepted}; checked shared gate, task component, and README warning.`
  );
  push(
    checks,
    "Teacher review handoff keeps packaging locked",
    readFileSync(join(root, "src/components/teacher-review-handoff.tsx"), "utf8").includes("老师审查入口") &&
      readFileSync(join(root, "src/components/teacher-review-handoff.tsx"), "utf8").includes("npm run verify:learning") &&
      readFileSync(join(root, "src/components/teacher-review-handoff.tsx"), "utf8").includes("visualLearningAcceptanceGate") &&
      readFileSync(join(root, "src/components/teacher-review-handoff.tsx"), "utf8").includes("先审查可视化学习，再谈封装") &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("TeacherReviewHandoff"),
    "Task page exposes a teacher review handoff with local verification and the shared packaging gate."
  );
  push(
    checks,
    "Teacher review checklist is visible",
    readFileSync(join(root, "src/components/teacher-review-checklist-panel.tsx"), "utf8").includes("老师验收审查清单") &&
      readFileSync(join(root, "src/components/teacher-review-checklist-panel.tsx"), "utf8").includes("不会记录系统已验收") &&
      readFileSync(join(root, "src/components/teacher-review-checklist-panel.tsx"), "utf8").includes("不会解锁封装") &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("TeacherReviewChecklistPanel"),
    "Task page exposes a read-only teacher acceptance checklist without packaging controls."
  );
  push(
    checks,
    "Teacher acceptance boundary panel is visible",
    readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
      "老师验收边界"
    ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "visual_learning_review_only"
      ) &&
      readFileSync(join(root, "src/components/teacher-acceptance-boundary-panel.tsx"), "utf8").includes(
        "这个页面不提供验收按钮"
      ) &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes(
        "TeacherAcceptanceBoundaryPanel"
      ),
    "Task page exposes a read-only boundary panel that names review-only mode and blocked packaging work."
  );
  push(
    checks,
    "Apprentice capability growth record is visible",
    readFileSync(join(root, "src/components/apprentice-growth-timeline.tsx"), "utf8").includes(
      "学徒能力成长记录"
    ) &&
      readFileSync(join(root, "src/components/apprentice-growth-timeline.tsx"), "utf8").includes(
        "Visual demonstration"
      ) &&
      readFileSync(join(root, "src/components/apprentice-growth-timeline.tsx"), "utf8").includes(
        "Execution history"
      ) &&
      readFileSync(join(root, "src/app/apprentices/[id]/page.tsx"), "utf8").includes(
        "ApprenticeGrowthTimeline"
      ) &&
      readFileSync(join(root, "src/server/memory/memory-store.ts"), "utf8").includes(
        "visualDemos: { orderBy"
      ) &&
      readFileSync(join(root, "src/server/memory/memory-store.ts"), "utf8").includes("examples: { orderBy"),
    "Apprentice profile exposes a student-style growth timeline sourced from tasks, visual demos, examples, corrections, rules, and runs."
  );
  push(
    checks,
    "Learning loop timeline is visible",
    readFileSync(join(root, "src/components/learning-loop-timeline-panel.tsx"), "utf8").includes("可见学习闭环时间线") &&
      readFileSync(join(root, "src/components/learning-loop-timeline-panel.tsx"), "utf8").includes("基线执行") &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("LearningLoopTimelinePanel"),
    "Task page exposes the complete human-teaches to AI-improves timeline."
  );
  push(
    checks,
    "Learning causality map exposes field-level proof",
    readFileSync(join(root, "src/components/learning-causality-map.tsx"), "utf8").includes("可视化学习因果图") &&
      readFileSync(join(root, "src/components/learning-causality-map.tsx"), "utf8").includes("带教前") &&
      readFileSync(join(root, "src/components/learning-causality-map.tsx"), "utf8").includes("应用记忆后") &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("LearningCausalityMap") &&
      Boolean(learningDelta?.fieldChanges.length && learningDelta.fieldChanges.length >= 3),
    `fieldChanges=${learningDelta?.fieldChanges.map((change) => change.field).join(", ") ?? "missing"}.`
  );
  push(
    checks,
    "Workflow trace alignment panel is reviewable",
    readFileSync(join(root, "src/components/workflow-trace-alignment-panel.tsx"), "utf8").includes("流程与执行追踪对齐") &&
      readFileSync(join(root, "src/components/workflow-trace-alignment-panel.tsx"), "utf8").includes("打开 trace 回放") &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("WorkflowTraceAlignmentPanel"),
    "Task page exposes node-by-node trace coverage for teacher review."
  );
  push(
    checks,
    "Memory provenance panel is reviewable",
    readFileSync(join(root, "src/components/memory-provenance-panel.tsx"), "utf8").includes("可复用记忆来源") &&
      readFileSync(join(root, "src/components/memory-provenance-panel.tsx"), "utf8").includes("执行中复用") &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("MemoryProvenancePanel"),
    "Task page exposes teaching-source to reusable-memory provenance."
  );
  push(
    checks,
    "Guardrail policy panel is reviewable",
    readFileSync(join(root, "src/components/policy-guardrail-panel.tsx"), "utf8").includes("护栏与老师控制证据") &&
      readFileSync(join(root, "src/components/policy-guardrail-panel.tsx"), "utf8").includes("策略闸门") &&
      readFileSync(join(root, "src/app/tasks/[id]/page.tsx"), "utf8").includes("PolicyGuardrailPanel"),
    "Task page exposes policy gates for teacher review."
  );
  push(
    checks,
    "Project instructions and docs are readable",
    textIsReadable("AGENTS.md", "README.md", "src/components/task-create-form.tsx"),
    "Checked AGENTS.md, README.md, and the task creation form for known mojibake markers."
  );
  push(
    checks,
    "Live demo teaching data is Chinese-readable",
    unreadableDemoRows.length === 0,
    unreadableDemoRows.length === 0
      ? `${readableDemoRows.length} live teaching-memory rows checked without placeholder question-mark text.`
      : `Unreadable rows: ${unreadableDemoRows.map((row) => `${row.table}:${row.id}`).join(", ")}.`
  );

  return finish(checks);
}

function finish(checks: Check[]) {
  const failed = checks.filter((check) => !check.pass);
  const result = {
    status: failed.length === 0 ? "passed" : "failed",
    passed: checks.length - failed.length,
    total: checks.length,
    checks
  };

  console.log(JSON.stringify(result, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
