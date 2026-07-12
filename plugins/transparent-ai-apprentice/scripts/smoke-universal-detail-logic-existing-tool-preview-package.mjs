#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "universal-detail-logic-existing-tool-preview-smoke", String(Date.now()))
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
  "Create an existing-tool preview from reviewed logic dry-run values.",
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
  "D1|depth_relation|view_depth|projected_offset = view_depth * perspective_scale|depth follows view depth",
  "--output-dir",
  join(smokeRoot, "kit")
]);
const receipt = readJson(kitResult.receiptTemplatePath);
receipt.decision = "ready_for_dry_run_generation_plan";
receipt.relationshipReviews = receipt.relationshipReviews.map((row) => ({
  ...row,
  teacherDecision: "teacher_reviewed_relationship",
  evidenceReviewed: true
}));
receipt.universalDetailLogicReview = receipt.universalDetailLogicReview.map((row) => ({
  ...row,
  teacherDecision: "teacher_reviewed_detail_logic"
}));
receipt.detailTransferValidationReview = receipt.detailTransferValidationReview.map((row) => ({
  ...row,
  teacherDecision: "ready_for_dry_run_generation_plan",
  validationCatchesImportantWrongCases: true,
  correctedTransferTest: `Recompute ${row.featureId} from reviewed logic before visual review.`
}));
receipt.fullDetailCoverageReview = {
  teacherDecision: "teacher_reviewed_detail_logic",
  explicitSurfaceDetailsReviewed: true,
  implicitDerivedDetailsReviewed: true,
  hiddenConstraintAndStateDetailsReviewed: true,
  allConsequentialDetailsEitherLogicBackedExceptionDecorativeOrBlocked: true,
  coverageNote: "All details reviewed."
};
const receiptPath = join(smokeRoot, "receipt.json");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

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
const previewResult = runScript("create-universal-detail-logic-existing-tool-preview-package.mjs", [
  "--dry-run",
  dryRunResult.dryRunPath,
  "--output-dir",
  join(smokeRoot, "preview")
]);
const preview = readJson(previewResult.packagePath);
const recipe = readJson(previewResult.recipePath);
const svg = readFileSync(previewResult.svgPath, "utf8");

const blockedDryRun = readJson(dryRunResult.dryRunPath);
blockedDryRun.status = "blocked_until_teacher_normalizes_uncalculable_logic";
blockedDryRun.counts.blockedRows = 1;
blockedDryRun.blockedRows = [blockedDryRun.appliedFeatureRows[0]];
const blockedDryRunPath = join(smokeRoot, "blocked-dry-run.json");
writeFileSync(blockedDryRunPath, `${JSON.stringify(blockedDryRun, null, 2)}\n`, "utf8");
const blockedPreviewResult = runScript("create-universal-detail-logic-existing-tool-preview-package.mjs", [
  "--dry-run",
  blockedDryRunPath,
  "--output-dir",
  join(smokeRoot, "blocked-preview")
]);
const blockedPreview = readJson(blockedPreviewResult.packagePath);

const checks = [
  check(
    "Universal detail logic existing-tool preview package creates SVG and JSON recipe from computed dry-run values",
    preview.format === "transparent_ai_universal_detail_logic_existing_tool_preview_package_v1" &&
      preview.status === "review_only_existing_tool_preview_ready_for_teacher_review" &&
      preview.counts.previewRows === 3 &&
      recipe.format === "transparent_ai_universal_detail_logic_existing_tool_preview_recipe_v1" &&
      recipe.previewRows.some((row) => row.featureId === "L1" && row.computedValues.length === 156) &&
      recipe.previewRows.some((row) => row.featureId === "A1" && row.computedValues.angle === 75) &&
      recipe.previewRows.some((row) => row.featureId === "D1" && row.computedValues.projected_offset === 12) &&
      svg.includes("Universal Detail Logic Preview") &&
      existsSync(previewResult.svgPath),
    previewResult.packagePath
  ),
  check(
    "Universal detail logic existing-tool preview package keeps native generation and software execution locked",
    preview.locks.previewDoesNotExecuteSoftware === true &&
      preview.locks.previewDoesNotGenerateNativeCad === true &&
      preview.locks.previewDoesNotWriteMemory === true &&
      preview.locks.targetCadGenerated === false &&
      preview.locks.targetOutputGenerated === false &&
      preview.locks.softwareActionsExecuted === false &&
      preview.locks.memoryWritten === false &&
      preview.gates.visualSimilarityStillSecondaryOnly === true,
    previewResult.packagePath
  ),
  check(
    "Universal detail logic existing-tool preview package blocks when application dry-run is not ready",
    blockedPreview.status === "blocked_until_logic_application_dry_run_ready" &&
      blockedPreview.counts.previewRows === 0 &&
      blockedPreview.gates.sourceDryRunReady === false &&
      blockedPreview.existingToolRoutes.includes("open_svg_preview_in_browser_or_vector_editor") &&
      blockedPreview.locks.targetOutputGenerated === false,
    blockedPreviewResult.packagePath
  )
];

const failed = checks.filter((item) => !item.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length ? "failed" : "passed",
      smoke: "transparent_ai_universal_detail_logic_existing_tool_preview_package_smoke_v1",
      smokeRoot,
      paths: {
        dryRun: dryRunResult.dryRunPath,
        previewPackage: previewResult.packagePath,
        recipe: previewResult.recipePath,
        svg: previewResult.svgPath,
        blockedPreview: blockedPreviewResult.packagePath
      },
      checks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
