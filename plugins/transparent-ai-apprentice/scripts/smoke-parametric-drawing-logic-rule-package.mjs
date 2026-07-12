#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "parametric-drawing-logic-rule-package-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

function runScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
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
  "Compile teacher-reviewed universal detail logic into disabled rule candidates.",
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
  "A1|angle|sweep_angle|angle = clamp(sweep_angle, 15deg, 75deg)|angle follows sweep data",
  "--relationship",
  "D1|depth_relation|view_depth|projected offset = view_depth * perspective_scale|depth/perspective follows view depth",
  "--output-dir",
  join(smokeRoot, "kit")
]);
const kit = readJson(kitResult.kitPath);

const blockedValidationResult = runScript("validate-parametric-drawing-logic-receipt.mjs", [
  "--kit",
  kitResult.kitPath,
  "--receipt",
  kitResult.receiptTemplatePath,
  "--output-dir",
  join(smokeRoot, "blocked-validation")
]);
const blockedPackageResult = runScript("compile-parametric-drawing-logic-rule-package.mjs", [
  "--kit",
  kitResult.kitPath,
  "--validation",
  blockedValidationResult.validationPath,
  "--output-dir",
  join(smokeRoot, "blocked-package")
]);
const blockedPackage = readJson(blockedPackageResult.packagePath);

const reviewedReceipt = readJson(kitResult.receiptTemplatePath);
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
  correctedCategoryOrLogicSource: "",
  blockerNote: ""
}));
reviewedReceipt.detailTransferValidationReview = reviewedReceipt.detailTransferValidationReview.map((row) => ({
  ...row,
  teacherDecision: "ready_for_dry_run_generation_plan",
  validationCatchesImportantWrongCases: true,
  correctedTransferTest: `Validate ${row.featureId} by recomputing from reviewed data and failing appearance-only copies.`,
  blockerNote: ""
}));
reviewedReceipt.fullDetailCoverageReview = {
  ...reviewedReceipt.fullDetailCoverageReview,
  teacherDecision: "teacher_reviewed_detail_logic",
  explicitSurfaceDetailsReviewed: true,
  implicitDerivedDetailsReviewed: true,
  hiddenConstraintAndStateDetailsReviewed: true,
  allConsequentialDetailsEitherLogicBackedExceptionDecorativeOrBlocked: true,
  coverageNote: "Teacher confirmed examples expanded to full consequential detail coverage."
};
const reviewedReceiptPath = join(smokeRoot, "teacher-reviewed-parametric-logic-receipt.json");
writeFileSync(reviewedReceiptPath, `${JSON.stringify(reviewedReceipt, null, 2)}\n`, "utf8");

const readyValidationResult = runScript("validate-parametric-drawing-logic-receipt.mjs", [
  "--kit",
  kitResult.kitPath,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  join(smokeRoot, "ready-validation")
]);
const readyPackageResult = runScript("compile-parametric-drawing-logic-rule-package.mjs", [
  "--kit",
  kitResult.kitPath,
  "--validation",
  readyValidationResult.validationPath,
  "--output-dir",
  join(smokeRoot, "ready-package")
]);
const readyPackage = readJson(readyPackageResult.packagePath);

const checks = [
  check(
    "Universal detail logic rule package compiler blocks unreviewed receipt validation",
    blockedPackage.format === "transparent_ai_universal_detail_logic_rule_package_v1" &&
      blockedPackage.status === "blocked_until_receipt_validation_ready" &&
      blockedPackage.decision === "needs_teacher_review" &&
      blockedPackage.gates.sourceReceiptValidationReady === false &&
      blockedPackage.blockedReasons.includes("receipt_validation_is_not_ready_for_review_only_dry_run") &&
      blockedPackage.nextReviewOnlyApplicationCommand === "" &&
      blockedPackage.locks.compilerDoesNotGenerateOutput === true &&
      blockedPackage.locks.compilerDoesNotExecuteSoftware === true &&
      blockedPackage.locks.compilerDoesNotWriteMemory === true,
    blockedPackageResult.packagePath
  ),
  check(
    "Universal detail logic rule package compiler emits only disabled rule candidates after all detail logic is reviewed",
    readyPackage.status === "review_only_logic_rule_package_ready_for_dry_run_application" &&
      readyPackage.decision === "ready_for_review_only_rule_application_dry_run" &&
      readyPackage.counts.logicRuleCandidates === 3 &&
      readyPackage.logicRuleCandidates.every((row) => row.ruleEnabled === false && row.accepted === false) &&
      readyPackage.gates.everyRuleCandidateDisabled === true &&
      readyPackage.gates.fullDetailCoverageReviewed === true &&
      readyPackage.gates.implicitHiddenDerivedDetailCoverageReviewed === true &&
      readyPackage.gates.visualSimilarityStillSecondaryOnly === true &&
      readyPackage.nextReviewOnlyApplicationCommand.includes("create-parametric-drawing-logic-learning-kit.mjs") &&
      readyPackage.locks.targetOutputGenerated === false &&
      readyPackage.locks.softwareActionsExecuted === false &&
      readyPackage.locks.memoryWritten === false,
    readyPackageResult.packagePath
  ),
  check(
    "Universal detail logic rule package keeps line angle and depth under reusable logic validation",
    readyPackage.logicRuleCandidates.some((row) => row.featureId === "L1" && row.logicSource.includes("panel_width")) &&
      readyPackage.logicRuleCandidates.some((row) => row.featureId === "A1" && row.formulaOrConstraint.includes("sweep_angle")) &&
      readyPackage.logicRuleCandidates.some((row) => row.featureId === "D1" && row.detailCategory === "view_depth_or_perspective_relation") &&
      readyPackage.preGenerationValidationMatrix.every(
        (row) => row.visualSimilarityRole === "secondary_review_signal_only_after_logic_validation_passes"
      ),
    readyPackageResult.packagePath
  ),
  check(
    "Universal detail logic rule package reads the source kit and validation without accepting technology",
    kit.format === "transparent_ai_parametric_drawing_logic_learning_kit_v1" &&
      readyPackage.sourceKit === resolve(kitResult.kitPath) &&
      readyPackage.sourceReceiptValidation === resolve(readyValidationResult.validationPath) &&
      readyPackage.locks.accepted === false &&
      readyPackage.locks.ruleEnabled === false &&
      readyPackage.locks.technologyAccepted === false,
    kitResult.kitPath
  )
];

const failed = checks.filter((item) => !item.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length ? "failed" : "passed",
      smoke: "transparent_ai_universal_detail_logic_rule_package_smoke_v1",
      smokeRoot,
      paths: {
        kit: kitResult.kitPath,
        blockedValidation: blockedValidationResult.validationPath,
        blockedPackage: blockedPackageResult.packagePath,
        readyValidation: readyValidationResult.validationPath,
        readyPackage: readyPackageResult.packagePath
      },
      checks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
