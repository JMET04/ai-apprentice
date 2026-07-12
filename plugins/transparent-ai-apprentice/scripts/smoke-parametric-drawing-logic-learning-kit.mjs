#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "parametric-drawing-logic-learning-kit-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

function runScript(args) {
  const result = spawnSync(process.execPath, [join(__dirname, "create-parametric-drawing-logic-learning-kit.mjs"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "parametric drawing logic kit script failed");
  return JSON.parse(result.stdout);
}

function runContinueTeaching(args) {
  const result = spawnSync(process.execPath, [join(__dirname, "continue-teaching.mjs"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "continue-teaching script failed");
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
  `${JSON.stringify({ panel_width: 120, panel_height: 80, bolt_count: 4, margin: 10, sweep_angle: 45, fillet_radius: 3, material_thickness: 2, view_depth: 18, clearance: 0.8, datum_a_x: 5, operation_state: "ready" }, null, 2)}\n`,
  "utf8"
);
writeFileSync(
  newDataPath,
  `${JSON.stringify({ panel_width: 180, panel_height: 90, bolt_count: 6, margin: 12, sweep_angle: 60, fillet_radius: 4, material_thickness: 2.5, view_depth: 24, clearance: 1.1, datum_a_x: 8, operation_state: "reviewed" }, null, 2)}\n`,
  "utf8"
);

const emptyResult = runScript([
  "--goal",
  "Learn a CAD panel drawing's feature-data logic before generating a rigorous similar drawing.",
  "--source-drawing",
  drawingPath,
  "--source-data",
  sourceDataPath,
  "--output-dir",
  join(smokeRoot, "empty")
]);
const emptyKit = readJson(emptyResult.kitPath);
const emptyHtml = readFileSync(emptyResult.htmlPath, "utf8");

const mappedResult = runScript([
  "--goal",
  "Learn a CAD panel drawing's feature-data logic before generating a rigorous similar drawing.",
  "--software",
  "CAD",
  "--source-drawing",
  drawingPath,
  "--source-data",
  sourceDataPath,
  "--new-data",
  newDataPath,
  "--relationship",
  "L1|line_length|panel_width|length = panel_width - 2 * margin|bottom outer construction line",
  "--relationship",
  "H1|hole_pattern|bolt_count|count = bolt_count; spacing = (panel_width - 2 * margin)/(bolt_count - 1)|bolt holes follow width and count",
  "--relationship",
  "A1|angle|sweep_angle|angle = clamp(sweep_angle, 15deg, 75deg)|teacher says the opening angle follows sweep_angle, not the screenshot slant",
  "--relationship",
  "R1|radius|material_thickness|radius = material_thickness * 1.5 unless fillet_radius overrides|teacher says corner radius follows material thickness",
  "--relationship",
  "D1|depth_relation|view_depth|projected offset = view_depth * perspective_scale; clearance >= clearance|depth relation is data logic, not copied perspective",
  "--relationship",
  "C1|coordinate_datum|datum_a_x|x = datum_a_x + margin; y aligns to panel centerline|position comes from datum logic, not screenshot placement",
  "--relationship",
  "S1|software_output_state|operation_state|state must equal reviewed before export route is allowed|software output state is also consequential detail logic",
  "--teacher-correction",
  "L2|vertical edge is controlled by panel_height, not by the displayed screenshot height",
  "--output-dir",
  join(smokeRoot, "mapped")
]);
const mappedKit = readJson(mappedResult.kitPath);
const mappedReceipt = readJson(mappedResult.receiptTemplatePath);
const mappedHtml = readFileSync(mappedResult.htmlPath, "utf8");
const mappedReadme = readFileSync(mappedResult.readmePath, "utf8");
const routedResult = runContinueTeaching([
  "--goal",
  "Learn the universal detail logic behind a CAD drawing so a similar output can be generated from new data; lines and angles are only examples, and the result must be rigorous rather than only looks similar.",
  "--software",
  "CAD",
  "--output-dir",
  join(smokeRoot, "routed")
]);

const checks = [
  check(
    "Universal detail logic kit blocks surface copying until teacher maps feature-data logic",
    emptyKit.format === "transparent_ai_parametric_drawing_logic_learning_kit_v1" &&
    emptyKit.status === "waiting_for_teacher_feature_data_logic_mapping" &&
      emptyKit.relationshipDrafts[0].featureType.includes("angle_radius") &&
      emptyKit.relationshipDrafts[0].evidenceStatus === "needs_teacher_logic_mapping" &&
      emptyKit.universalDetailLogicContract.format === "transparent_ai_universal_detail_logic_contract_v1" &&
      emptyKit.universalDetailLogicContract.allDataLogicizedRequired === true &&
      emptyKit.universalDetailLogicContract.fullDetailCoverageRequired === true &&
      emptyKit.universalDetailLogicContract.implicitDerivedLogicRequired === true &&
      emptyKit.universalDetailLogicContract.allDataLogicizedDefinition.includes("software-state") &&
      emptyKit.universalDetailLogicContract.allDataLogicizedDefinition.includes("implicit") &&
      emptyKit.universalDetailLogicContract.logicCompletenessGate.requiredBeforeTargetSoftwareAction === true &&
      emptyKit.universalDetailLogicContract.logicCompletenessGate.fullDetailCoverageReviewRequired === true &&
      emptyKit.universalDetailLogicContract.logicCompletenessGate.visualSimilarityCanNeverOverrideMissingLogic === true &&
      emptyKit.universalDetailLogicContract.universalDetailScope.some((scope) => scope.includes("topology")) &&
      emptyKit.universalDetailLogicContract.surfaceSimilarityOnlyRejected === true &&
      emptyKit.universalDetailLogicContract.rows[0].logicSourceStatus === "missing_logic_source_blocks_generation" &&
      emptyKit.detailTransferValidationMatrix.length === 1 &&
      emptyKit.detailTransferValidationMatrix[0].primaryValidation === "blocked_until_teacher_supplies_data_formula_constraint_exception_or_decorative_status" &&
      emptyKit.detailTransferValidationMatrix[0].visualSimilarityRole === "secondary_review_signal_only_after_logic_validation_passes" &&
      emptyKit.universalDetailLogicContract.counts.missingLogicSource === 1 &&
      emptyKit.newDrawingGenerationPlan.status === "blocked_until_relationships_new_data_and_universal_detail_logic_are_reviewed" &&
      emptyKit.newDrawingGenerationPlan.missingInputs.includes("universal_detail_logic_source_review") &&
      emptyKit.blockedActions.includes("copy_surface_geometry_without_data_logic") &&
      emptyKit.blockedActions.includes("generate_detail_not_classified_by_universal_detail_logic_contract") &&
      emptyKit.blockedActions.includes("generate_visually_similar_output_without_feature_logic") &&
      emptyKit.blockedActions.includes("generate_any_output_detail_as_plausible_guess_without_logic_source") &&
      emptyHtml.includes("Parametric Drawing Logic Learning Kit"),
    emptyResult.kitPath
  ),
  check(
    "Universal detail logic kit captures teacher feature-data formulas before transfer",
      mappedKit.status === "parametric_logic_relationship_draft_waiting_for_teacher_review" &&
      mappedKit.relationshipDrafts.length === 7 &&
      mappedKit.relationshipDrafts.some((row) => row.featureId === "L1" && row.featureType === "line_length" && row.controlledByData === "panel_width" && row.formulaOrConstraint.includes("panel_width - 2 * margin")) &&
      mappedKit.relationshipDrafts.some((row) => row.featureId === "H1" && row.featureType === "hole_pattern" && row.controlledByData === "bolt_count" && row.formulaOrConstraint.includes("bolt_count")) &&
      mappedKit.relationshipDrafts.some((row) => row.featureId === "A1" && row.featureType === "angle" && row.controlledByData === "sweep_angle" && row.formulaOrConstraint.includes("clamp")) &&
      mappedKit.relationshipDrafts.some((row) => row.featureId === "R1" && row.featureType === "radius" && row.controlledByData === "material_thickness" && row.formulaOrConstraint.includes("material_thickness * 1.5")) &&
      mappedKit.relationshipDrafts.some((row) => row.featureId === "D1" && row.featureType === "depth_relation" && row.controlledByData === "view_depth" && row.formulaOrConstraint.includes("perspective_scale")) &&
      mappedKit.relationshipDrafts.some((row) => row.featureId === "C1" && row.featureType === "coordinate_datum" && row.controlledByData === "datum_a_x" && row.formulaOrConstraint.includes("datum_a_x")) &&
      mappedKit.relationshipDrafts.some((row) => row.featureId === "S1" && row.featureType === "software_output_state" && row.controlledByData === "operation_state" && row.formulaOrConstraint.includes("reviewed")) &&
      mappedKit.universalDetailLogicContract.format === "transparent_ai_universal_detail_logic_contract_v1" &&
      mappedKit.universalDetailLogicContract.counts.totalDetails === 7 &&
      mappedKit.universalDetailLogicContract.counts.missingLogicSource === 0 &&
      mappedKit.universalDetailLogicContract.logicCompletenessGate.passesOnlyWhenMissingLogicSourceCountIsZero === true &&
      mappedKit.universalDetailLogicContract.generationGate === "dry_run_only_waiting_for_teacher_reviewed_logic_sources" &&
      mappedKit.universalDetailLogicContract.rows.some((row) => row.featureId === "A1" && row.detailCategory === "angular_or_curvature_logic") &&
      mappedKit.universalDetailLogicContract.rows.some((row) => row.featureId === "H1" && row.detailCategory === "pattern_count_or_spacing") &&
      mappedKit.universalDetailLogicContract.rows.some((row) => row.featureId === "D1" && row.detailCategory === "view_depth_or_perspective_relation") &&
      mappedKit.universalDetailLogicContract.rows.some((row) => row.featureId === "C1" && row.detailCategory === "coordinate_datum_or_frame_logic") &&
      mappedKit.universalDetailLogicContract.rows.some((row) => row.featureId === "S1" && row.detailCategory === "state_property_or_software_output_logic") &&
      mappedKit.detailTransferValidationMatrix.length === 7 &&
      mappedKit.detailTransferValidationMatrix.every((row) => row.primaryValidation.includes("before_any_visual_similarity_check")) &&
      mappedKit.detailTransferValidationMatrix.every((row) => row.logicRigorTest.includes("without looking at the source artifact appearance")) &&
      mappedKit.detailTransferValidationMatrix.some((row) => row.featureId === "A1" && row.transferTest.includes("new data changes")) &&
      mappedKit.detailTransferValidationMatrix.some((row) => row.featureId === "D1" && row.teacherReviewQuestion.includes("depth/perspective")) &&
      mappedKit.detailTransferValidationMatrix.every((row) => row.failureCondition.includes("looks similar")) &&
      mappedKit.teacherCorrections.length === 1 &&
      mappedKit.sourceEvidence.sourceDataFields.some((row) => row.field === "panel_width") &&
      mappedKit.sourceEvidence.newDataFields.some((row) => row.field === "sweep_angle") &&
      mappedKit.logicLearningPrinciples.some((rule) => rule.includes("Rigor comes from feature-data logic")) &&
      mappedKit.logicLearningPrinciples.some((rule) => rule.includes("All data logicized means every consequential detail")) &&
      mappedKit.logicLearningPrinciples.some((rule) => rule.includes("starting point, not the scope boundary")),
    mappedResult.kitPath
  ),
  check(
    "Universal detail logic kit prepares only a dry-run generation/action plan for new data",
      mappedKit.newDrawingGenerationPlan.status === "dry_run_generation_plan_ready_for_review" &&
      mappedKit.nextReceiptValidationCommand.includes("validate-parametric-drawing-logic-receipt.mjs") &&
      mappedKit.nextReceiptValidationCommand.includes("<teacher-filled-parametric-drawing-logic-receipt.json>") &&
      mappedKit.newDrawingGenerationPlan.steps.some((step) => step.action.includes("Apply the reviewed formulas to the new data in dry-run mode")) &&
      mappedKit.newDrawingGenerationPlan.steps.some((step) => step.validation.includes("positions, relations")) &&
      mappedKit.existingToolRoutes.some((route) => route.includes("DXF/SVG/JSON recipe preview")) &&
      mappedKit.locks.targetCadGenerated === false &&
      mappedKit.locks.cadSoftwareExecuted === false &&
      mappedKit.locks.softwareActionsExecuted === false &&
      mappedKit.locks.memoryWritten === false &&
      mappedKit.locks.surfaceSimilarityOnlyAccepted === false &&
      mappedKit.locks.goalComplete === false,
    mappedResult.htmlPath
  ),
  check(
    "Parametric drawing logic receipt template keeps teacher review and forbidden decisions explicit",
      mappedReceipt.format === "transparent_ai_parametric_drawing_logic_teacher_receipt_v1" &&
      mappedReceipt.defaultDecision === "needs_teacher_review" &&
      mappedReceipt.relationshipReviews.length === 7 &&
      mappedReceipt.universalDetailLogicReview.length === 7 &&
      mappedReceipt.detailTransferValidationReview.length === 7 &&
      mappedReceipt.detailTransferValidationReview.every((row) => row.teacherDecision === "needs_teacher_review") &&
      mappedReceipt.detailTransferValidationReview.every((row) => row.validationCatchesImportantWrongCases === false) &&
      mappedReceipt.fullDetailCoverageReview.explicitSurfaceDetailsReviewed === false &&
      mappedReceipt.fullDetailCoverageReview.implicitDerivedDetailsReviewed === false &&
      mappedReceipt.fullDetailCoverageReview.hiddenConstraintAndStateDetailsReviewed === false &&
      mappedReceipt.universalDetailLogicReview.every((row) => row.teacherDecision === "needs_teacher_review") &&
      mappedReceipt.blockedTeacherDecisions.includes("execute_now") &&
      mappedReceipt.blockedTeacherDecisions.includes("write_memory") &&
      mappedReceipt.locks.accepted === false &&
      mappedReceipt.locks.ruleEnabled === false,
    mappedResult.receiptTemplatePath
  ),
  check(
    "Universal detail logic kit documents the optimized teacher prompt and relationship notation",
      mappedKit.optimizedTeacherPrompt.includes("Do not imitate the surface of the drawing/model/sketch/software output") &&
      mappedKit.optimizedTeacherPrompt.includes("Lines and angles are only examples") &&
      mappedKit.optimizedTeacherPrompt.includes("coordinate frame") &&
      mappedKit.optimizedTeacherPrompt.includes("software state") &&
      mappedKit.optimizedTeacherPrompt.includes("implicit, hidden, and derived output detail") &&
      mappedKit.optimizedTeacherPrompt.includes("generation or target-software action route") &&
      mappedKit.optimizedTeacherPrompt.includes("length, angle, radius, spacing, count") &&
      mappedKit.logicLearningPrinciples.some((rule) => rule.includes("universal detail logic contract")) &&
      mappedKit.logicLearningPrinciples.some((rule) => rule.includes("software-state")) &&
      mappedKit.logicLearningPrinciples.some((rule) => rule.includes("validation test for new data")) &&
      mappedKit.universalDetailLogicContract.everyDetailMustBeOneOf.includes("missing_logic_source_blocks_generation") &&
      mappedKit.universalDetailLogicContract.prohibitedShortcut === "generate_output_that_only_looks_similar_without_detail_logic" &&
      mappedKit.detailTransferValidationMatrix.every((row) => row.visualSimilarityRole === "secondary_review_signal_only_after_logic_validation_passes") &&
      mappedKit.detailLogicScope.some((scope) => scope.includes("spatial relations")) &&
      mappedKit.detailLogicScope.some((scope) => scope.includes("engineering constraints")) &&
      mappedKit.detailLogicScope.some((scope) => scope.includes("coordinate frames")) &&
      mappedKit.detailLogicScope.some((scope) => scope.includes("topology")) &&
      mappedKit.detailLogicScope.some((scope) => scope.includes("target output state")) &&
      mappedKit.blockedActions.includes("generate_any_consequential_detail_without_logic_source") &&
      mappedKit.blockedActions.includes("generate_detail_not_classified_by_universal_detail_logic_contract") &&
      mappedKit.blockedActions.includes("generate_any_output_detail_as_plausible_guess_without_logic_source") &&
      mappedKit.blockedActions.includes("override_missing_logic_with_visual_similarity") &&
      mappedKit.blockedActions.includes("execute_target_software_action_before_logic_completeness_gate") &&
      mappedKit.blockedActions.includes("stop_after_teacher_example_without_full_detail_coverage") &&
      mappedKit.blockedActions.includes("ignore_hidden_or_derived_constraints_that_control_output_details") &&
      mappedKit.blockedActions.includes("treat_line_or_angle_examples_as_the_complete_logic_scope") &&
      mappedReadme.includes("featureId|featureType|dataFieldOrVariable|formulaOrConstraint") &&
      mappedReadme.includes("Universal detail logic contract") &&
      mappedReadme.includes("Detail transfer validation matrix") &&
      mappedReadme.includes("Validate teacher-filled receipt") &&
      mappedReadme.includes("validate-parametric-drawing-logic-receipt.mjs") &&
      mappedReadme.includes("Lines and angles are only examples") &&
      mappedReadme.includes("Logic completeness gate") &&
      mappedReadme.includes("coordinate frames") &&
      mappedReadme.includes("Visual similarity is only a secondary review signal") &&
      mappedHtml.includes("Teacher Logic Relationship Drafts") &&
      mappedHtml.includes("Universal Detail Logic Contract") &&
      mappedHtml.includes("Detail Transfer Validation Matrix") &&
      mappedHtml.includes("Receipt validation") &&
      mappedHtml.includes("New Drawing Generation Plan") &&
      existsSync(mappedResult.readmePath),
    mappedResult.readmePath
  ),
  check(
    "Default teach_apprentice route sends natural CAD detail-logic requests to the universal detail logic kit before workalong",
    routedResult.route === "create_parametric_drawing_logic_learning_kit" &&
      routedResult.primaryResult.kitPath &&
      routedResult.primaryResult.htmlPath &&
      routedResult.primaryResult.readmePath &&
      routedResult.primaryResult.receiptTemplatePath &&
      routedResult.primaryResult.generationPlanStatus === "blocked_until_relationships_new_data_and_universal_detail_logic_are_reviewed" &&
      routedResult.nextTeacherAction.includes("universal detail logic kit") &&
      routedResult.locks.accepted === false &&
      routedResult.locks.packagingGated === true,
    routedResult.primaryResult.kitPath
  )
];

const failed = checks.filter((item) => !item.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length ? "failed" : "passed",
      smoke: "transparent_ai_parametric_drawing_logic_learning_kit_smoke_v1",
      smokeRoot,
      paths: {
        emptyKit: emptyResult.kitPath,
        mappedKit: mappedResult.kitPath,
        mappedHtml: mappedResult.htmlPath,
        mappedReceipt: mappedResult.receiptTemplatePath
      },
      checks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
