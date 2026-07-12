#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function multiArg(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return (
    String(value || "parametric-drawing-logic-learning-kit")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "parametric-drawing-logic-learning-kit"
  );
}

function readMaybeJson(input) {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{") || text.startsWith("[")) return { value: JSON.parse(text), path: "" };
  return { value: text, path: "" };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeRelationship(raw, index) {
  const value = String(raw || "").trim();
  const parts = value.split("|").map((part) => part.trim());
  const [featureId, featureType, dataFieldOrVariable, formulaOrConstraint, teacherNote] =
    parts.length >= 4 ? parts : [`feature-${index + 1}`, "unknown_feature", "", value, ""];
  return {
    relationshipId: `relationship-${index + 1}`,
    featureId: featureId || `feature-${index + 1}`,
    featureType: featureType || "unknown_feature",
    elementId: featureId || `feature-${index + 1}`,
    geometryType: featureType || "unknown_feature",
    controlledByData: dataFieldOrVariable || "teacher_mapping_needed",
    logicVariable: dataFieldOrVariable || "teacher_mapping_needed",
    formulaOrConstraint: formulaOrConstraint || "teacher_formula_needed",
    teacherNote: teacherNote || "",
    evidenceStatus: dataFieldOrVariable && formulaOrConstraint ? "teacher_supplied_logic_relationship_waiting_for_review" : "needs_teacher_logic_mapping",
    confidence: "teacher_review_required",
    ruleEnabled: false,
    accepted: false
  };
}

function normalizeCorrection(raw, index) {
  const value = String(raw || "").trim();
  const parts = value.split("|").map((part) => part.trim());
  return {
    correctionId: `correction-${index + 1}`,
    targetElementId: parts.length >= 2 ? parts[0] : "",
    correction: parts.length >= 2 ? parts.slice(1).join(" | ") : value,
    effect: "narrow_or_replace_relationship_before_replay",
    ruleEnabled: false,
    accepted: false
  };
}

function dataFields(sourceData) {
  const value = sourceData?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value).map((field) => ({ field, sampleValue: value[field] }));
}

const DETAIL_LOGIC_CATEGORIES = [
  "measurable_geometry",
  "angular_or_curvature_logic",
  "pattern_count_or_spacing",
  "coordinate_datum_or_frame_logic",
  "position_alignment_or_relation",
  "view_depth_or_perspective_relation",
  "topology_connectivity_or_order",
  "tolerance_fit_or_clearance",
  "annotation_semantic_or_standard",
  "material_process_or_manufacturing_rule",
  "state_property_or_software_output_logic",
  "teacher_exception_or_design_rule",
  "decorative_or_non_parametric",
  "uncategorized_requires_teacher_mapping"
];

const UNIVERSAL_DETAIL_SCOPE = [
  "measurable geometry: length, width, height, diameter, radius, curve, angle, slope, scale, proportion, ratio",
  "repeated structure: count, spacing, pitch, pattern, array order, sequence, topology, connectivity",
  "reference logic: datum, coordinate frame, origin, axis, plane, alignment, symmetry, offset, relative placement",
  "view logic: 2D screen position, projection, section, perspective, depth, z relation, near/far relationship",
  "engineering logic: tolerance, fit, clearance, material, thickness, process, manufacturing, standard, design rule",
  "semantic logic: annotation, label, dimension text, naming, warning, required state, software property, output value",
  "implicit and derived logic: dependencies that are not obvious from the surface but control angles, positions, states, constraints, generated properties, or validation outcomes",
  "teacher exceptions: special cases, boundary rules, decorative/non-parametric details explicitly marked by the teacher"
];

function classifyDetailCategory(featureType) {
  const value = String(featureType || "").toLowerCase();
  if (/(angle|slope|rotation|radius|curve|arc|fillet|chamfer)/.test(value)) return "angular_or_curvature_logic";
  if (/(hole|pattern|count|spacing|repeat|pitch|array)/.test(value)) return "pattern_count_or_spacing";
  if (/(datum|coordinate|frame|axis|origin|reference_plane|reference plane)/.test(value)) {
    return "coordinate_datum_or_frame_logic";
  }
  if (/(depth|view|perspective|projection|3d|section|isometric)/.test(value)) return "view_depth_or_perspective_relation";
  if (/(topology|connect|sequence|order|dependency|chain|route|path|parent|child)/.test(value)) {
    return "topology_connectivity_or_order";
  }
  if (/(position|offset|align|symmetry|mirror|relation|placement|plane|axis|origin|reference)/.test(value)) {
    return "position_alignment_or_relation";
  }
  if (/(tolerance|fit|clearance|allowance|interference)/.test(value)) return "tolerance_fit_or_clearance";
  if (/(annotation|label|dimension_text|standard|note|warning|semantic|name)/.test(value)) return "annotation_semantic_or_standard";
  if (/(material|process|manufactur|bend|relief|thickness|weld|cut|print|cnc)/.test(value)) {
    return "material_process_or_manufacturing_rule";
  }
  if (/(state|property|output|result|value|command|parameter|setting|mode|software)/.test(value)) {
    return "state_property_or_software_output_logic";
  }
  if (/(exception|rule|constraint|design)/.test(value)) return "teacher_exception_or_design_rule";
  if (/(decorative|non_parametric|style|visual_only)/.test(value)) return "decorative_or_non_parametric";
  if (/(length|line|width|height|diameter|dimension|measure|size|scale|proportion|ratio)/.test(value)) {
    return "measurable_geometry";
  }
  return "uncategorized_requires_teacher_mapping";
}

function buildUniversalDetailLogicContract(relationshipDrafts, sourceFields, targetFields) {
  const rows = relationshipDrafts.map((relationship) => {
    const detailCategory = classifyDetailCategory(relationship.featureType || relationship.geometryType);
    const dataOrVariable = String(relationship.controlledByData || "");
    const formulaOrConstraint = String(relationship.formulaOrConstraint || "");
    const hasLogicSource =
      Boolean(dataOrVariable && !["teacher_mapping_needed", "teacher_data_field_or_logic_variable"].includes(dataOrVariable)) &&
      Boolean(formulaOrConstraint && !["teacher_formula_needed", "teacher_formula_constraint_or_design_rule"].includes(formulaOrConstraint));
    const decorative = detailCategory === "decorative_or_non_parametric";
    return {
      relationshipId: relationship.relationshipId,
      featureId: relationship.featureId || relationship.elementId,
      featureType: relationship.featureType || relationship.geometryType,
      detailCategory,
      requiresLogicSource: !decorative,
      allowedNonLogicStatus: decorative ? "teacher_must_explicitly_mark_decorative_or_non_parametric" : "",
      logicSourceStatus: hasLogicSource
        ? "logic_source_supplied_waiting_for_teacher_review"
        : decorative
          ? "decorative_status_waiting_for_teacher_review"
          : "missing_logic_source_blocks_generation",
      dataOrVariable: relationship.controlledByData,
      formulaOrConstraint: relationship.formulaOrConstraint,
      blockedIfMissing: !hasLogicSource && !decorative,
      reviewQuestion:
        "Is this detail truly controlled by the cited data/formula/constraint, or should it be corrected, marked decorative, or blocked as missing evidence?",
      surfaceSimilarityAllowedAsEvidence: false,
      ruleEnabled: false,
      accepted: false
    };
  });
  const missingRows = rows.filter((row) => row.blockedIfMissing);
  const reviewableRows = rows.filter((row) => row.logicSourceStatus !== "missing_logic_source_blocks_generation");
  return {
    format: "transparent_ai_universal_detail_logic_contract_v1",
    principle:
      "All consequential output details must be logicized before generation; visual similarity is never enough by itself.",
    rigorPolicy:
      "The apprentice must explain each important detail as a data, formula, constraint, relation, state, exception, or decorative classification before it can be transferred to new data.",
    allDataLogicizedDefinition:
      "All data logicized means no consequential visible, hidden, implicit, derived, geometric, spatial, semantic, material, process, software-state, or validation detail may be generated from plausibility or appearance alone.",
    allDataLogicizedRequired: true,
    lineAndAngleExamplesOnly: true,
    surfaceSimilarityOnlyRejected: true,
    universalDetailScope: UNIVERSAL_DETAIL_SCOPE,
    fullDetailCoverageRequired: true,
    fullDetailCoveragePolicy:
      "A teacher may start with any example, including a line or angle, but the apprentice must expand the review to every consequential explicit, implicit, and derived detail before generation or software action.",
    implicitDerivedLogicRequired: true,
    everyDetailMustBeOneOf: [
      "teacher_reviewed_data_field_or_variable",
      "teacher_reviewed_formula_or_constraint",
      "teacher_reviewed_exception_or_design_rule",
      "teacher_marked_decorative_or_non_parametric",
      "missing_logic_source_blocks_generation"
    ],
    candidateDetailCategories: DETAIL_LOGIC_CATEGORIES,
    sourceDataFieldCount: sourceFields.length,
    newDataFieldCount: targetFields.length,
    rows,
    counts: {
      totalDetails: rows.length,
      reviewableWithLogicOrDecorativeStatus: reviewableRows.length,
      missingLogicSource: missingRows.length,
      blockedDetails: missingRows.length
    },
    logicCompletenessGate: {
      requiredBeforeDryRunGeneration: true,
      requiredBeforeTargetSoftwareAction: true,
      passesOnlyWhenMissingLogicSourceCountIsZero: true,
      visualSimilarityCanNeverOverrideMissingLogic: true,
      teacherCanOverrideOnlyBySupplyingLogicExceptionOrDecorativeClassification: true,
      fullDetailCoverageReviewRequired: true,
      implicitDerivedDetailReviewRequired: true
    },
    teacherReviewQuestions: [
      "Which data field, variable, formula, constraint, reference, or teacher rule controls this detail?",
      "Are there hidden or derived dependencies that control this detail even if they are not visually obvious?",
      "If new data changes, how should this detail recompute or re-evaluate?",
      "What exact wrong output would prove the apprentice copied appearance instead of logic?",
      "Is this detail consequential, or did the teacher explicitly mark it decorative/non-parametric?"
    ],
    generationGate:
      missingRows.length > 0
        ? "blocked_until_every_consequential_detail_has_logic_source_or_teacher_decorative_exception"
        : "dry_run_only_waiting_for_teacher_reviewed_logic_sources",
    missingLogicSourceBehavior: "block_generation_and_route_to_teacher_review",
    prohibitedShortcut: "generate_output_that_only_looks_similar_without_detail_logic",
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      memoryWritten: false,
      cadSoftwareExecuted: false,
      softwareActionsExecuted: false,
      packagingGated: true
    }
  };
}

function buildDetailTransferValidationMatrix(contract) {
  return contract.rows.map((row, index) => ({
    validationId: `detail-transfer-validation-${index + 1}`,
    featureId: row.featureId,
    featureType: row.featureType,
    detailCategory: row.detailCategory,
    logicSourceStatus: row.logicSourceStatus,
    primaryValidation:
      row.logicSourceStatus === "missing_logic_source_blocks_generation"
        ? "blocked_until_teacher_supplies_data_formula_constraint_exception_or_decorative_status"
        : "recompute_or_re-evaluate_this_detail_from_the_reviewed_logic_source_before_any_visual_similarity_check",
    transferTest:
      "When new data changes, verify the generated detail changes according to the cited data/formula/constraint, preserves teacher exceptions/design rules, and reports any missing field or invalid constraint.",
    logicRigorTest:
      "Pass only if the detail can be recomputed, re-evaluated, or teacher-explained from its logic source without looking at the source artifact appearance.",
    failureCondition:
      "Fail if the detail is copied from the source artifact appearance, guessed from plausibility, or judged acceptable only because it looks similar.",
    visualSimilarityRole: "secondary_review_signal_only_after_logic_validation_passes",
    teacherReviewQuestion:
      "Would this validation catch the important wrong cases for this detail, including angles, positions, depth/perspective, tolerances, and semantic/process rules?",
    blockedIfMissingLogic: row.blockedIfMissing,
    ruleEnabled: false,
    accepted: false
  }));
}

function writeHtml(path, kit) {
  const relationshipRows = kit.relationshipDrafts
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.featureId || row.elementId)}</td>
        <td>${htmlEscape(row.featureType || row.geometryType)}</td>
        <td>${htmlEscape(row.controlledByData)}</td>
        <td>${htmlEscape(row.formulaOrConstraint)}</td>
        <td>${htmlEscape(row.evidenceStatus)}</td>
      </tr>`
    )
    .join("\n");
  const universalDetailRows = kit.universalDetailLogicContract.rows
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.featureId)}</td>
        <td>${htmlEscape(row.detailCategory)}</td>
        <td>${htmlEscape(row.dataOrVariable)}</td>
        <td>${htmlEscape(row.formulaOrConstraint)}</td>
        <td>${htmlEscape(row.logicSourceStatus)}</td>
      </tr>`
    )
    .join("\n");
  const generationRows = kit.newDrawingGenerationPlan.steps
    .map(
      (step) => `<tr>
        <td>${htmlEscape(step.order)}</td>
        <td>${htmlEscape(step.action)}</td>
        <td>${htmlEscape(step.validation)}</td>
      </tr>`
    )
    .join("\n");
  const validationRows = kit.detailTransferValidationMatrix
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.featureId)}</td>
        <td>${htmlEscape(row.detailCategory)}</td>
        <td>${htmlEscape(row.primaryValidation)}</td>
        <td>${htmlEscape(row.failureCondition)}</td>
        <td>${htmlEscape(row.visualSimilarityRole)}</td>
      </tr>`
    )
    .join("\n");
  const scopeRows = kit.universalDetailLogicContract.universalDetailScope
    .map((item) => `<li>${htmlEscape(item)}</li>`)
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Universal Detail Logic Learning Kit</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 24px 0 10px; font-size: 18px; letter-spacing: 0; }
    .panel, table { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; box-shadow: 0 1px 2px rgba(16, 32, 56, .06); }
    .panel { padding: 16px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; }
    code { background: #eef3f9; border-radius: 5px; padding: 2px 5px; overflow-wrap: anywhere; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Universal Detail Logic Learning Kit</h1>
    <p class="lock">Backward-compatible name: Parametric Drawing Logic Learning Kit.</p>
    <section class="panel">
      <p><strong>Status:</strong> ${htmlEscape(kit.status)}</p>
      <p><strong>Goal:</strong> ${htmlEscape(kit.goal)}</p>
      <p><strong>Source drawing:</strong> <code>${htmlEscape(kit.sourceEvidence.sourceDrawingPath || "not supplied")}</code></p>
      <p><strong>Source data:</strong> <code>${htmlEscape(kit.sourceEvidence.sourceDataPath || "inline or not supplied")}</code></p>
      <p><strong>New data:</strong> <code>${htmlEscape(kit.sourceEvidence.newDataPath || "inline or not supplied")}</code></p>
      <p><strong>Receipt validation:</strong> <code>${htmlEscape(kit.nextReceiptValidationCommand)}</code></p>
      <p class="lock">This kit learns review-only output-detail-data logic: lines and angles are only examples; every consequential dimension, position, relation, tolerance, annotation, material/process choice, and design rule must be tied to data, formulas, constraints, or teacher exceptions. It does not modify CAD files, execute software, write memory, accept rules, or claim the drawing logic is mastered.</p>
    </section>
    <h2>All-Data Logic Scope</h2>
    <section class="panel">
      <p>${htmlEscape(kit.universalDetailLogicContract.allDataLogicizedDefinition)}</p>
      <ul>${scopeRows}</ul>
    </section>
    <h2>Teacher Logic Relationship Drafts</h2>
    <table>
      <thead><tr><th>Feature</th><th>Feature Type</th><th>Data Or Variable</th><th>Formula Or Constraint</th><th>Status</th></tr></thead>
      <tbody>${relationshipRows}</tbody>
    </table>
    <h2>Universal Detail Logic Contract</h2>
    <section class="panel">
      <p><strong>Gate:</strong> ${htmlEscape(kit.universalDetailLogicContract.generationGate)}</p>
      <p><strong>Missing logic source:</strong> ${htmlEscape(kit.universalDetailLogicContract.counts.missingLogicSource)}</p>
      <p class="lock">Every consequential detail must be data/formula/constraint-backed, a reviewed teacher exception, or explicitly decorative/non-parametric. Surface similarity alone is rejected.</p>
    </section>
    <table>
      <thead><tr><th>Feature</th><th>Detail Category</th><th>Data Or Variable</th><th>Formula Or Constraint</th><th>Logic Source Status</th></tr></thead>
      <tbody>${universalDetailRows}</tbody>
    </table>
    <h2>New Drawing Generation Plan</h2>
    <table>
      <thead><tr><th>#</th><th>Action</th><th>Validation</th></tr></thead>
      <tbody>${generationRows}</tbody>
    </table>
    <h2>Detail Transfer Validation Matrix</h2>
    <section class="panel">
      <p class="lock">The apprentice must validate each transferred detail from logic before judging visual similarity. A visually plausible result still fails when a detail cannot be recomputed, constrained, or teacher-approved.</p>
    </section>
    <table>
      <thead><tr><th>Feature</th><th>Detail Category</th><th>Primary Validation</th><th>Failure Condition</th><th>Visual Similarity Role</th></tr></thead>
      <tbody>${validationRows}</tbody>
    </table>
  </main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, kit) {
  const lines = [
    "# Universal Detail Logic Learning Kit",
    "",
    "Backward-compatible name: Parametric Drawing Logic Learning Kit",
    "",
    `Status: ${kit.status}`,
    `Goal: ${kit.goal}`,
    "",
    "Use this when a teacher provides an existing CAD/engineering drawing, model, sketch, diagram, or software output artifact and wants the apprentice to learn the underlying logic before generating a similar result from new data.",
    "",
    "Core principle:",
    "- The apprentice must make details rigorous from logic first, not produce something that merely looks similar.",
    "- All data logicized means every consequential detail is either backed by data/formula/constraint, a teacher exception/design rule, explicitly decorative/non-parametric, or blocked as missing evidence.",
    "- Consequential detail means any visible, hidden, implicit, derived, geometric, spatial, semantic, material, process, software-state, or validation detail that would matter if it were wrong.",
    "- Lines and angles are only examples. Treat every consequential output detail as a logic feature until the teacher marks it decorative or non-parametric.",
    "- Do not stop after the teacher's example. Expand from the example to a full detail-coverage review: explicit marks, derived relationships, hidden constraints, software states, and validation outcomes all need logic sources or blockers.",
    "- Treat lengths, angles, radii, hole counts, spacing, offsets, symmetry, alignment, proportions, tolerances, materials, annotations, manufacturing/process rules, semantic labels, view/depth relations, and design rules as learnable logic features.",
    "- Treat coordinate frames, datums, axes, topology, order, connectivity, software properties, required states, and output values as learnable logic features too.",
    "- Visual similarity is only a secondary review signal after feature-data logic has been mapped and replayed.",
    "- Universal detail logic contract: every consequential detail must be classified as data/formula/constraint-backed, teacher exception/design rule, decorative/non-parametric, or missing evidence that blocks generation.",
    "- Detail transfer validation matrix: every consequential detail must define how it is recomputed or re-evaluated on new data, what failure looks like, and why visual similarity is only a secondary review signal.",
    "- Logic completeness gate: generation and target-software action stay blocked until missing logic source count is zero or the teacher supplies a reviewed exception/decorative classification.",
    "",
    "Teacher relationship notation:",
    "- featureId|featureType|dataFieldOrVariable|formulaOrConstraint|optional note",
    "- Backward-compatible alias: elementId|geometryType|dataField|formulaOrConstraint|optional note",
    "- Example: L1|line_length|panel_width|length = panel_width - 2 * margin|outer horizontal edge",
    "- Example: A1|angle|sweep_angle|angle = clamp(sweep_angle, 15deg, 75deg)|hinge opening angle",
    "- Example: R1|radius|fillet_radius|radius = material_thickness * 1.5|bend relief radius",
    "- Example: H1|hole_pattern|bolt_count|repeat count = bolt_count; x spacing = usable_width/(bolt_count-1)|bolt pattern",
    "- Example: P1|position_alignment|datum_A|x = datum_A.x + offset; y aligns to centerline|position is controlled by references, not appearance",
    "- Example: T1|tolerance_clearance|clearance|clearance >= min_clearance_for_process|fit rule",
    "- Example: M1|material_process_rule|material_thickness|bend_relief = max(2mm, material_thickness * 1.5)|manufacturing rule",
    "",
    "Generated artifacts:",
    `- HTML: ${kit.paths.html}`,
    `- Kit JSON: ${kit.paths.kit}`,
    `- Teacher receipt template: ${kit.paths.receiptTemplate}`,
    `- Validate teacher-filled receipt: ${kit.nextReceiptValidationCommand}`,
    "",
    "Safety boundary:",
    "- This kit drafts parameter relationships only.",
    "- It does not parse private CAD geometry as proof unless the teacher supplies extracted evidence.",
    "- It does not modify source artifacts, execute CAD or target software, write memory, enable rules, accept technology, or unlock packaging."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", argValue("--task", "Learn the universal detail logic behind a CAD/engineering drawing, model, sketch, diagram, or software output artifact before generating a similar result from new data."));
const software = argValue("--software", argValue("--app", "CAD, engineering, drawing, modeling, or target output software"));
const sourceDrawingPath = argValue("--source-drawing", argValue("--drawing", argValue("--cad", "")));
const sourceData = readMaybeJson(argValue("--source-data", argValue("--data", "")));
const newData = readMaybeJson(argValue("--new-data", argValue("--target-data", "")));
const relationships = multiArg("--relationship").map(normalizeRelationship);
const corrections = multiArg("--teacher-correction").map(normalizeCorrection);
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "parametric-drawing-logic-learning-kits")));

mkdirSync(outputRoot, { recursive: true });
const kitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const kitDir = join(outputRoot, kitId);
mkdirSync(kitDir, { recursive: true });

const kitPath = join(kitDir, "parametric-drawing-logic-learning-kit.json");
const htmlPath = join(kitDir, "parametric-drawing-logic-learning-kit.html");
const readmePath = join(kitDir, "PARAMETRIC_DRAWING_LOGIC_LEARNING_KIT_START_HERE.md");
const receiptTemplatePath = join(kitDir, "parametric-drawing-logic-teacher-receipt-template.json");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  sourceCadModified: false,
  sourceArtifactModified: false,
  targetCadGenerated: false,
  targetOutputGenerated: false,
  cadSoftwareExecuted: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  surfaceSimilarityOnlyAccepted: false,
  goalComplete: false
};
const status =
  relationships.length > 0
    ? "parametric_logic_relationship_draft_waiting_for_teacher_review"
    : "waiting_for_teacher_feature_data_logic_mapping";
const sourceFields = dataFields(sourceData);
const targetFields = dataFields(newData);
const relationshipDrafts =
  relationships.length > 0
    ? relationships
    : [
        {
          relationshipId: "relationship-template-1",
          featureId: "teacher_named_feature",
          featureType: "any_data_driven_output_detail_length_angle_radius_spacing_count_position_relation_tolerance_material_or_rule",
          elementId: "teacher_named_feature",
          geometryType: "any_data_driven_output_detail_length_angle_radius_spacing_count_position_relation_tolerance_material_or_rule",
          controlledByData: "teacher_data_field_or_logic_variable",
          logicVariable: "teacher_data_field_or_logic_variable",
          formulaOrConstraint: "teacher_formula_constraint_or_design_rule",
          teacherNote: "Explain why this feature changes when the data changes and what would make it invalid.",
          evidenceStatus: "needs_teacher_logic_mapping",
          confidence: "teacher_review_required",
          ruleEnabled: false,
          accepted: false
        }
      ];
const universalDetailLogicContract = buildUniversalDetailLogicContract(relationshipDrafts, sourceFields, targetFields);
const detailTransferValidationMatrix = buildDetailTransferValidationMatrix(universalDetailLogicContract);
const nextReceiptValidationCommand =
  `node plugins\\transparent-ai-apprentice\\scripts\\validate-parametric-drawing-logic-receipt.mjs --kit "${kitPath}" --receipt "<teacher-filled-parametric-drawing-logic-receipt.json>" --output-dir "${join(kitDir, "receipt-validation")}"`;
const newDrawingGenerationPlan = {
  status:
    relationships.length > 0 && newData.value && universalDetailLogicContract.counts.missingLogicSource === 0
      ? "dry_run_generation_plan_ready_for_review"
      : "blocked_until_relationships_new_data_and_universal_detail_logic_are_reviewed",
  outputType: "parametric_recipe_or_dry_run_detail_logic_action_plan",
  steps: [
    {
      order: 1,
      action: "Review source artifact evidence and teacher-named logical features.",
      validation: "Every consequential generated detail must cite a teacher-reviewed data relationship, formula, constraint, design rule, or explicit decorative exception."
    },
    {
      order: 2,
      action: "Bind each output detail relationship to source data fields, variables, formulas, constraints, and design rules.",
      validation: "No line, angle, view position, depth relation, annotation, material/process choice, or other important detail may be copied from appearance alone without a logic source, decorative label, or teacher note."
    },
    {
      order: 3,
      action: "Apply the reviewed formulas to the new data in dry-run mode.",
      validation: "Report computed lengths, angles, radii, spacing, counts, positions, relations, tolerances, material/process values, missing fields, and invalid constraints before CAD generation."
    },
    {
      order: 4,
      action: "Prepare an existing-tool route such as scriptable CAD/API, model/script recipe, DXF/SVG/JSON preview, draw.io preview, or supervised UI fallback.",
      validation: "Route remains dry-run-first and requires teacher confirmation plus rollback before execution."
    },
    {
      order: 5,
      action: "Ask the teacher to review whether the dry-run preserves the intended logic before judging visual similarity.",
      validation: "Corrections become narrower disabled relationship drafts, not automatic memory."
    }
  ],
  missingInputs: [
    ...(relationships.length ? [] : ["teacher_feature_data_logic_relationships"]),
    ...(newData.value ? [] : ["new_data_for_transfer_generation"]),
    ...(universalDetailLogicContract.counts.missingLogicSource ? ["universal_detail_logic_source_review"] : [])
  ]
};
const teacherReceiptTemplate = {
  format: "transparent_ai_parametric_drawing_logic_teacher_receipt_v1",
  kitId,
  defaultDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "teacher_reviewed_relationships", "blocked_needs_more_evidence", "ready_for_dry_run_generation_plan"],
  blockedTeacherDecisions: ["accepted", "execute_now", "write_memory", "claim_mastered", "unlock_packaging"],
  fullDetailCoverageReview: {
    teacherDecision: "needs_teacher_review",
    explicitSurfaceDetailsReviewed: false,
    implicitDerivedDetailsReviewed: false,
    hiddenConstraintAndStateDetailsReviewed: false,
    allConsequentialDetailsEitherLogicBackedExceptionDecorativeOrBlocked: false,
    coverageNote: ""
  },
  relationshipReviews: relationshipDrafts.map((relationship) => ({
    relationshipId: relationship.relationshipId,
    teacherDecision: "needs_teacher_review",
    evidenceReviewed: false,
    correctedFormulaOrConstraint: "",
    teacherNote: ""
  })),
  universalDetailLogicReview: universalDetailLogicContract.rows.map((row) => ({
    relationshipId: row.relationshipId,
    featureId: row.featureId,
    detailCategory: row.detailCategory,
    logicSourceStatus: row.logicSourceStatus,
    teacherDecision: "needs_teacher_review",
    correctedCategoryOrLogicSource: "",
    markDecorativeOrNonParametric: false,
    blockerNote: ""
  })),
  detailTransferValidationReview: detailTransferValidationMatrix.map((row) => ({
    validationId: row.validationId,
    featureId: row.featureId,
    teacherDecision: "needs_teacher_review",
    validationCatchesImportantWrongCases: false,
    correctedTransferTest: "",
    blockerNote: ""
  })),
  locks
};
const kit = {
  ok: true,
  format: "transparent_ai_parametric_drawing_logic_learning_kit_v1",
  kitId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  status,
  optimizedTeacherPrompt:
    "Do not imitate the surface of the drawing/model/sketch/software output. Lines and angles are only examples: first decompose every consequential explicit, implicit, hidden, and derived output detail into a named logical feature such as length, angle, radius, spacing, count, coordinate frame, datum, topology, position, depth/view relation, alignment, ratio, tolerance, annotation, material/process rule, software state, output property, validation outcome, or design rule. Then tell me which data field, variable, formula, constraint, reference relationship, teacher exception, or decorative/non-parametric label controls each feature, test those relationships on new data in dry-run mode, and only then consider any generation or target-software action route.",
  logicLearningPrinciples: [
    "Rigor comes from feature-data logic, not from visual resemblance.",
    "All data logicized means every consequential detail must have a logic source, teacher exception, decorative/non-parametric classification, or explicit missing-evidence blocker.",
    "Consequential details include visible, hidden, implicit, derived, geometric, spatial, semantic, material, process, software-state, and validation details that would matter if wrong.",
    "The teacher's example is a starting point, not the scope boundary; the apprentice must expand it into full detail coverage before transfer.",
    "Every important generated detail must cite a reviewed data relationship, formula, constraint, or teacher exception.",
    "Every important detail must be classified in the universal detail logic contract before transfer: data/formula/constraint-backed, teacher exception, decorative/non-parametric, or missing evidence.",
    "Every transferred detail must also define a validation test for new data; visual resemblance is reviewed only after that logic validation passes.",
    "Line and angle examples must not narrow the scope; all consequential measurable, angular, positional, relational, semantic, material, process, tolerance, topology, coordinate-frame, and software-state details are logic candidates.",
    "Angles, radii, spacing, counts, tolerances, alignments, proportions, and annotations are first-class learnable features.",
    "Appearance-only copying is blocked until the teacher marks the feature as decorative or non-parametric.",
    "Teacher corrections narrow disabled relationship drafts; they do not become memory or accepted rules without review."
  ],
  detailLogicScope: [
    "geometry: lengths, angles, radii, curves, counts, patterns, offsets, spacing, alignments, symmetry, proportions",
    "reference systems: coordinate frames, datums, axes, origins, reference planes, and dependencies",
    "structure: topology, connectivity, ordering, parent-child relationships, command sequence, and output state transitions",
    "spatial relations: view position, depth, perspective intent, reference planes, relative placement, assembly relation",
    "engineering constraints: tolerances, fit/clearance, material thickness, bend relief, process/manufacturing rules",
    "semantic details: annotations, labels, dimensions, naming, warnings, standards, teacher-marked exceptions",
    "decorative details: allowed only when explicitly marked decorative or non-parametric by the teacher",
    "target output state: any consequential software-generated drawing, model, command result, placement, property, or artifact detail that would matter if wrong"
  ],
  sourceEvidence: {
    sourceDrawingPath: sourceDrawingPath ? resolve(sourceDrawingPath) : "",
    sourceDrawingExists: sourceDrawingPath ? existsSync(sourceDrawingPath) : false,
    sourceDrawingName: sourceDrawingPath ? basename(sourceDrawingPath) : "",
    sourceDataPath: sourceData.path,
    sourceDataFields: sourceFields,
    newDataPath: newData.path,
    newDataFields: targetFields
  },
  relationshipDrafts,
  universalDetailLogicContract,
  detailTransferValidationMatrix,
  teacherCorrections: corrections,
  newDrawingGenerationPlan,
  nextReceiptValidationCommand,
  nextTeacherActions: [
    "Name each important logical feature in the source artifact: lines and angles are examples, but include every consequential length, radius, hole, dimension, position, depth/view relation, spacing, count, alignment, proportion, tolerance, annotation, material/process rule, and design rule.",
    "For each named feature, provide the data field, variable, formula, constraint, or teacher exception that controls it.",
    "Mark which visual features are decorative or non-parametric so the apprentice does not overfit appearance.",
    "Provide new data and review the dry-run computed feature values before any generation or target-software route is executed."
  ],
  existingToolRoutes: [
    "reuse existing CAD API or macro only after teacher-reviewed dry-run",
    "generate a DXF/SVG/JSON recipe preview before native CAD execution",
    "reuse existing drawing/modeling/spreadsheet/script software when it can preserve reviewed detail logic with lower implementation cost",
    "use draw.io/Excalidraw preview for teacher review when CAD execution is not yet approved",
    "fall back to supervised UI only after numbered target confirmation and rollback"
  ],
  blockedActions: [
    "copy_surface_geometry_without_data_logic",
    "copy_surface_feature_without_data_logic",
    "generate_any_consequential_detail_without_logic_source",
    "stop_after_teacher_example_without_full_detail_coverage",
    "ignore_hidden_or_derived_constraints_that_control_output_details",
    "generate_detail_not_classified_by_universal_detail_logic_contract",
    "treat_line_or_angle_examples_as_the_complete_logic_scope",
    "generate_visually_similar_output_without_feature_logic",
    "generate_any_output_detail_as_plausible_guess_without_logic_source",
    "override_missing_logic_with_visual_similarity",
    "execute_target_software_action_before_logic_completeness_gate",
    "generate_final_cad_without_teacher_review",
    "execute_cad_software_from_learning_kit",
    "write_memory_from_unreviewed_relationships"
  ],
  paths: {
    kit: kitPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath
  },
  locks
};

writeFileSync(kitPath, `${JSON.stringify(kit, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(teacherReceiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, kit);
writeHtml(htmlPath, kit);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_parametric_drawing_logic_learning_kit_result_v1",
      kitId,
      status,
      kitPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      relationshipCount: relationshipDrafts.length,
      correctionCount: corrections.length,
      generationPlanStatus: newDrawingGenerationPlan.status,
      locks
    },
    null,
    2
  )
);
