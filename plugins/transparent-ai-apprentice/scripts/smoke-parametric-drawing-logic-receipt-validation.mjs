#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "parametric-drawing-logic-receipt-validation-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

function runScript(scriptName, args, options = {}) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${scriptName} was expected to fail`);
    return { ...JSON.parse(result.stdout), failedAsExpected: true, exitStatus: result.status };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return { ...JSON.parse(result.stdout), exitStatus: result.status };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const drawingPath = join(smokeRoot, "source-panel.dxf");
const sourceDataPath = join(smokeRoot, "source-data.json");
const newDataPath = join(smokeRoot, "new-data.json");
writeFileSync(drawingPath, "0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n", "utf8");
writeFileSync(
  sourceDataPath,
  `${JSON.stringify({ panel_width: 120, margin: 10, bolt_count: 4, sweep_angle: 45, view_depth: 18 }, null, 2)}\n`,
  "utf8"
);
writeFileSync(
  newDataPath,
  `${JSON.stringify({ panel_width: 180, margin: 12, bolt_count: 6, sweep_angle: 60, view_depth: 24 }, null, 2)}\n`,
  "utf8"
);

const kitResult = runScript("create-parametric-drawing-logic-learning-kit.mjs", [
  "--goal",
  "Validate teacher-reviewed universal detail logic before any rigorous similar output.",
  "--software",
  "CAD",
  "--source-drawing",
  drawingPath,
  "--source-data",
  sourceDataPath,
  "--new-data",
  newDataPath,
  "--relationship",
  "L1|line_length|panel_width|length = panel_width - 2 * margin|length follows panel data",
  "--relationship",
  "H1|hole_pattern|bolt_count|count = bolt_count; spacing = (panel_width - 2 * margin)/(bolt_count - 1)|pattern follows count and width",
  "--relationship",
  "A1|angle|sweep_angle|angle = clamp(sweep_angle, 15deg, 75deg)|angle follows sweep data",
  "--relationship",
  "D1|depth_relation|view_depth|projected offset = view_depth * perspective_scale|depth/perspective follows view depth",
  "--output-dir",
  join(smokeRoot, "kit")
]);
const kit = readJson(kitResult.kitPath);
const defaultReceiptPath = kitResult.receiptTemplatePath;
const blockedResult = runScript("validate-parametric-drawing-logic-receipt.mjs", [
  "--kit",
  kitResult.kitPath,
  "--receipt",
  defaultReceiptPath,
  "--output-dir",
  join(smokeRoot, "blocked-validation")
]);
const blockedValidation = readJson(blockedResult.validationPath);

const reviewedReceipt = readJson(defaultReceiptPath);
reviewedReceipt.decision = "ready_for_dry_run_generation_plan";
reviewedReceipt.relationshipReviews = reviewedReceipt.relationshipReviews.map((row) => ({
  ...row,
  teacherDecision: "teacher_reviewed_relationship",
  evidenceReviewed: true,
  teacherNote: "Teacher confirmed this feature-data relationship."
}));
reviewedReceipt.universalDetailLogicReview = reviewedReceipt.universalDetailLogicReview.map((row) => ({
  ...row,
  teacherDecision: "teacher_reviewed_detail_logic",
  correctedCategoryOrLogicSource: row.logicSourceStatus === "missing_logic_source_blocks_generation" ? "teacher supplied missing logic source" : "",
  blockerNote: ""
}));
reviewedReceipt.detailTransferValidationReview = reviewedReceipt.detailTransferValidationReview.map((row) => ({
  ...row,
  teacherDecision: "ready_for_dry_run_generation_plan",
  validationCatchesImportantWrongCases: true,
  blockerNote: ""
}));
reviewedReceipt.fullDetailCoverageReview = {
  ...reviewedReceipt.fullDetailCoverageReview,
  teacherDecision: "teacher_reviewed_detail_logic",
  explicitSurfaceDetailsReviewed: true,
  implicitDerivedDetailsReviewed: true,
  hiddenConstraintAndStateDetailsReviewed: true,
  allConsequentialDetailsEitherLogicBackedExceptionDecorativeOrBlocked: true,
  coverageNote: "Teacher confirmed the examples were expanded into full consequential detail coverage."
};
const reviewedReceiptPath = join(smokeRoot, "teacher-reviewed-parametric-logic-receipt.json");
writeFileSync(reviewedReceiptPath, `${JSON.stringify(reviewedReceipt, null, 2)}\n`, "utf8");

const readyResult = runScript("validate-parametric-drawing-logic-receipt.mjs", [
  "--kit",
  kitResult.kitPath,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  join(smokeRoot, "ready-validation")
]);
const readyValidation = readJson(readyResult.validationPath);

const forbiddenReceipt = readJson(defaultReceiptPath);
forbiddenReceipt.decision = "execute_now";
forbiddenReceipt.relationshipReviews = forbiddenReceipt.relationshipReviews.map((row) => ({
  ...row,
  teacherDecision: "execute_now",
  evidenceReviewed: true
}));
forbiddenReceipt.universalDetailLogicReview = forbiddenReceipt.universalDetailLogicReview.map((row) => ({
  ...row,
  teacherDecision: "execute_now"
}));
forbiddenReceipt.detailTransferValidationReview = forbiddenReceipt.detailTransferValidationReview.map((row) => ({
  ...row,
  teacherDecision: "execute_now",
  validationCatchesImportantWrongCases: true
}));
forbiddenReceipt.fullDetailCoverageReview = {
  ...forbiddenReceipt.fullDetailCoverageReview,
  teacherDecision: "execute_now",
  explicitSurfaceDetailsReviewed: true,
  implicitDerivedDetailsReviewed: true,
  hiddenConstraintAndStateDetailsReviewed: true,
  allConsequentialDetailsEitherLogicBackedExceptionDecorativeOrBlocked: true
};
const forbiddenReceiptPath = join(smokeRoot, "teacher-forbidden-parametric-logic-receipt.json");
writeFileSync(forbiddenReceiptPath, `${JSON.stringify(forbiddenReceipt, null, 2)}\n`, "utf8");

const forbiddenResult = runScript(
  "validate-parametric-drawing-logic-receipt.mjs",
  [
    "--kit",
    kitResult.kitPath,
    "--receipt",
    forbiddenReceiptPath,
    "--output-dir",
    join(smokeRoot, "forbidden-validation")
  ],
  { expectFailure: true }
);
const forbiddenValidation = readJson(forbiddenResult.validationPath);

const checks = [
  check(
    "Parametric logic receipt validation blocks default unreviewed receipt",
    blockedValidation.format === "transparent_ai_parametric_drawing_logic_receipt_validation_v1" &&
      blockedValidation.status === "blocked_until_teacher_reviews_every_consequential_detail_logic_row" &&
      blockedValidation.counts.blockedRows > 0 &&
      blockedValidation.requirementGates.everyRelationshipLogicReviewed === false &&
      blockedValidation.requirementGates.fullDetailCoverageReviewed === false &&
      blockedValidation.requirementGates.visualSimilarityStillSecondaryOnly === true &&
      blockedValidation.nextReviewOnlyDryRunCommand === "" &&
      blockedValidation.locks.targetOutputGenerated === false &&
      blockedValidation.locks.softwareActionsExecuted === false &&
      blockedValidation.locks.memoryWritten === false,
    blockedResult.validationPath
  ),
  check(
    "Parametric logic receipt validation allows only review-only dry-run planning after every detail is logic-reviewed",
    readyValidation.status === "ready_for_review_only_dry_run_generation_plan" &&
      readyValidation.decision === "ready_for_review_only_dry_run" &&
      readyValidation.counts.blockedRows === 0 &&
      readyValidation.requirementGates.everyRelationshipLogicReviewed === true &&
      readyValidation.requirementGates.everyUniversalDetailLogicReviewed === true &&
      readyValidation.requirementGates.everyTransferValidationReviewed === true &&
      readyValidation.requirementGates.fullDetailCoverageReviewed === true &&
      readyValidation.requirementGates.implicitHiddenDerivedDetailCoverageReviewed === true &&
      readyValidation.fullDetailCoverageGate.canAdvance === true &&
      readyValidation.requirementGates.sourceKitDryRunPlanReady === true &&
      readyValidation.nextReviewOnlyDryRunCommand.includes("create-parametric-drawing-logic-learning-kit.mjs") &&
      readyValidation.nextReviewOnlyDryRunCommand.includes("--new-data") &&
      readyValidation.locks.validationDoesNotGenerateOutput === true &&
      readyValidation.locks.validationDoesNotExecuteSoftware === true &&
      readyValidation.locks.surfaceSimilarityOnlyAccepted === false,
    readyResult.validationPath
  ),
  check(
    "Parametric logic receipt validation keeps line angle and depth details under one all-detail logic gate",
      readyValidation.relationshipRows.some((row) => row.featureId === "L1" && row.status === "relationship_logic_reviewed") &&
      readyValidation.relationshipRows.some((row) => row.featureId === "A1" && row.status === "relationship_logic_reviewed") &&
      readyValidation.universalDetailLogicRows.some((row) => row.featureId === "D1" && row.detailCategory === "view_depth_or_perspective_relation") &&
      readyValidation.fullDetailCoverageGate.implicitDerivedDetailsReviewed === true &&
      readyValidation.transferValidationRows.every((row) => row.validationCatchesImportantWrongCases === true),
    kitResult.kitPath
  ),
  check(
    "Parametric logic receipt validation fails closed on forbidden generation or execution decisions",
    forbiddenResult.failedAsExpected === true &&
      forbiddenResult.exitStatus !== 0 &&
      forbiddenValidation.decision === "blocked_for_forbidden_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.counts.forbiddenDecisionRows > 0 &&
      forbiddenValidation.nextReviewOnlyDryRunCommand === "" &&
      forbiddenValidation.locks.validationDoesNotGenerateOutput === true &&
      forbiddenValidation.locks.validationDoesNotExecuteSoftware === true &&
      forbiddenValidation.locks.memoryWritten === false,
    forbiddenResult.validationPath
  )
];

const failed = checks.filter((item) => !item.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length ? "failed" : "passed",
      smoke: "transparent_ai_parametric_drawing_logic_receipt_validation_smoke_v1",
      smokeRoot,
      paths: {
        kit: kitResult.kitPath,
        defaultReceipt: defaultReceiptPath,
        reviewedReceipt: reviewedReceiptPath,
        blockedValidation: blockedResult.validationPath,
        readyValidation: readyResult.validationPath,
        forbiddenValidation: forbiddenResult.validationPath
      },
      checks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
