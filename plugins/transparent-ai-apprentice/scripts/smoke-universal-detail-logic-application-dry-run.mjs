#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "universal-detail-logic-application-dry-run-smoke", String(Date.now()))
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
  `${JSON.stringify({ panel_width: 120, margin: 10, sweep_angle: 45, view_depth: 18, perspective_scale: 0.5 }, null, 2)}\n`,
  "utf8"
);
writeFileSync(
  newDataPath,
  `${JSON.stringify({ panel_width: 180, margin: 12, sweep_angle: 90, view_depth: 24, perspective_scale: 0.5 }, null, 2)}\n`,
  "utf8"
);

const kitResult = runScript("create-parametric-drawing-logic-learning-kit.mjs", [
  "--goal",
  "Apply reviewed universal detail logic to new data in dry-run.",
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
  "A1|angle|sweep_angle|angle = clamp(sweep_angle, 15, 75)|angle follows sweep data",
  "--relationship",
  "D1|depth_relation|view_depth|projected_offset = view_depth * perspective_scale|depth/perspective follows view depth",
  "--output-dir",
  join(smokeRoot, "kit")
]);
const reviewedReceipt = readJson(kitResult.receiptTemplatePath);
reviewedReceipt.decision = "ready_for_dry_run_generation_plan";
reviewedReceipt.relationshipReviews = reviewedReceipt.relationshipReviews.map((row) => ({
  ...row,
  teacherDecision: "teacher_reviewed_relationship",
  evidenceReviewed: true
}));
reviewedReceipt.universalDetailLogicReview = reviewedReceipt.universalDetailLogicReview.map((row) => ({
  ...row,
  teacherDecision: "teacher_reviewed_detail_logic"
}));
reviewedReceipt.detailTransferValidationReview = reviewedReceipt.detailTransferValidationReview.map((row) => ({
  ...row,
  teacherDecision: "ready_for_dry_run_generation_plan",
  validationCatchesImportantWrongCases: true,
  correctedTransferTest: `Recompute ${row.featureId} from reviewed logic and fail visual-only copies.`
}));
reviewedReceipt.fullDetailCoverageReview = {
  teacherDecision: "teacher_reviewed_detail_logic",
  explicitSurfaceDetailsReviewed: true,
  implicitDerivedDetailsReviewed: true,
  hiddenConstraintAndStateDetailsReviewed: true,
  allConsequentialDetailsEitherLogicBackedExceptionDecorativeOrBlocked: true,
  coverageNote: "All details reviewed."
};
const receiptPath = join(smokeRoot, "reviewed-receipt.json");
writeFileSync(receiptPath, `${JSON.stringify(reviewedReceipt, null, 2)}\n`, "utf8");

const validationResult = runScript("validate-parametric-drawing-logic-receipt.mjs", [
  "--kit",
  kitResult.kitPath,
  "--receipt",
  receiptPath,
  "--output-dir",
  join(smokeRoot, "validation")
]);
const packageResult = runScript("compile-parametric-drawing-logic-rule-package.mjs", [
  "--kit",
  kitResult.kitPath,
  "--validation",
  validationResult.validationPath,
  "--output-dir",
  join(smokeRoot, "package")
]);
const dryRunResult = runScript("apply-universal-detail-logic-rule-package-dry-run.mjs", [
  "--package",
  packageResult.packagePath,
  "--new-data",
  newDataPath,
  "--output-dir",
  join(smokeRoot, "dry-run")
]);
const dryRun = readJson(dryRunResult.dryRunPath);
const byFeature = new Map(dryRun.appliedFeatureRows.map((row) => [row.featureId, row]));

const blockedPackage = readJson(packageResult.packagePath);
blockedPackage.status = "blocked_until_receipt_validation_ready";
const blockedPackagePath = join(smokeRoot, "blocked-rule-package.json");
writeFileSync(blockedPackagePath, `${JSON.stringify(blockedPackage, null, 2)}\n`, "utf8");
const blockedDryRunResult = runScript("apply-universal-detail-logic-rule-package-dry-run.mjs", [
  "--package",
  blockedPackagePath,
  "--new-data",
  newDataPath,
  "--output-dir",
  join(smokeRoot, "blocked-dry-run")
]);
const blockedDryRun = readJson(blockedDryRunResult.dryRunPath);

const checks = [
  check(
    "Universal detail logic application dry-run computes reviewed formulas from new data",
    dryRun.format === "transparent_ai_universal_detail_logic_application_dry_run_v1" &&
      dryRun.status === "review_only_logic_application_dry_run_ready_for_teacher_review" &&
      byFeature.get("L1")?.computedValues.length === 156 &&
      byFeature.get("A1")?.computedValues.angle === 75 &&
      byFeature.get("D1")?.computedValues.projected_offset === 12 &&
      dryRun.counts.blockedRows === 0,
    dryRunResult.dryRunPath
  ),
  check(
    "Universal detail logic application dry-run keeps output generation and software execution locked",
    dryRun.locks.dryRunDoesNotGenerateOutput === true &&
      dryRun.locks.dryRunDoesNotExecuteSoftware === true &&
      dryRun.locks.dryRunDoesNotWriteMemory === true &&
      dryRun.locks.targetOutputGenerated === false &&
      dryRun.locks.softwareActionsExecuted === false &&
      dryRun.locks.memoryWritten === false &&
      dryRun.gates.visualSimilarityStillSecondaryOnly === true,
    dryRunResult.dryRunPath
  ),
  check(
    "Universal detail logic application dry-run blocks when rule package is not ready",
    blockedDryRun.status === "blocked_until_teacher_normalizes_uncalculable_logic" &&
      blockedDryRun.blockedRows.length === 3 &&
      blockedDryRun.gates.sourceRulePackageReady === false &&
      blockedDryRun.locks.targetOutputGenerated === false,
    blockedDryRunResult.dryRunPath
  )
];

const failed = checks.filter((item) => !item.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length ? "failed" : "passed",
      smoke: "transparent_ai_universal_detail_logic_application_dry_run_smoke_v1",
      smokeRoot,
      paths: {
        kit: kitResult.kitPath,
        validation: validationResult.validationPath,
        rulePackage: packageResult.packagePath,
        dryRun: dryRunResult.dryRunPath,
        blockedDryRun: blockedDryRunResult.dryRunPath
      },
      checks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
