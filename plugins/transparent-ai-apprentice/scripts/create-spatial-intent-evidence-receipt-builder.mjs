#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "spatial-intent-evidence-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "spatial-intent-evidence-receipt-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotWriteReceipt: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotRunSpatialTargetConfirmation: true,
    builderDoesNotInterpretSketch: true,
    builderDoesNotBypassUniversalDetailLogic: true,
    builderDoesNotAcceptUnvalidatedDetailLogic: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotExecuteSoftware: true,
    spatialTargetConfirmationInvoked: false,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, builder) {
  const lines = [
    "# Spatial Intent Evidence Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Goal: ${builder.goal}`,
    `Source request: ${builder.paths.sourceRequest}`,
    "",
    "Use the HTML page to generate a teacher-filled spatial intent evidence receipt after the teacher exports a real transparent sketch packet.",
    "Also attach the universal detail logic contract/kit plus its passed receipt validation. The validation proves a teacher reviewed every consequential detail as data, formulas, constraints, references, exceptions, or decorative/non-parametric rows. Lines and angles are only examples; the same gate applies to depth, perspective, proportions, tolerances, materials, software states, and other details.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder packet: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder only creates JSON in the browser.",
    "- It does not save the generated receipt.",
    "- It does not validate the receipt.",
    "- It does not run spatial target confirmation, capture screenshots, execute software, write memory, enable rules, accept technology, or unlock packaging."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher-facing spatial intent evidence receipt generator.");
const requestInput = readJsonInput(
  argValue("--request", argValue("--spatial-intent-evidence-request", "")),
  "--request",
  "transparent_ai_spatial_intent_evidence_request_v1"
);
if (!requestInput.value) throw new Error("--request is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "spatial-intent-evidence-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const request = requestInput.value;
const htmlPath = join(builderDir, "spatial-intent-evidence-receipt-builder.html");
const builderPath = join(builderDir, "spatial-intent-evidence-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "teacher-spatial-intent-evidence-receipt-template.json");
const readmePath = join(builderDir, "SPATIAL_INTENT_EVIDENCE_RECEIPT_BUILDER_START_HERE.md");
const lockState = locks();
const placeholder = request.teacherExportedOverlayPacketPlaceholder || "<teacher-exported-transparent-sketch-packet.json>";
const nextValidationCommand =
  `node plugins\\transparent-ai-apprentice\\scripts\\validate-spatial-intent-evidence-receipt.mjs --request "${requestInput.path || "<spatial-intent-evidence-request.json>"}" --receipt "<teacher-filled-spatial-intent-evidence-receipt.json>" --output-dir "${join(builderDir, "receipt-validation")}"`;

const receiptTemplate = {
  format: "transparent_ai_spatial_intent_evidence_receipt_v1",
  builderId,
  sourceRequest: requestInput.path,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_reviewed_prepare_spatial_confirmation",
    "blocked_needs_more_evidence"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "execute_now",
    "enable_memory",
    "claim_complete",
    "unlock_packaging",
    "native_universal_execution"
  ],
  evidenceReviewed: false,
  teacherExportedOverlayPacketPath: placeholder,
  detailLogicReviewed: false,
  universalDetailLogicContractPath: "<teacher-reviewed-universal-detail-logic-contract-or-kit.json>",
  universalDetailLogicReceiptValidationPath: "<passed-parametric-drawing-logic-receipt-validation.json>",
  detailLogicRequirement:
    "Before numbered spatial confirmation, every consequential visible, geometric, spatial, semantic, material, process, software-state, and validation detail must be backed by teacher-reviewed data/formula/constraint/reference/exception or explicitly marked decorative/non-parametric, and the parametric drawing logic receipt validation must be ready_for_review_only_dry_run_generation_plan with zero blocked rows.",
  requiredSpatialEvidenceDimensions: [
    "2d_position_or_anchor",
    "angle_or_direction_vector",
    "perspective_relationship",
    "3d_depth_hint_or_near_far_relation"
  ],
  teacherNote: "",
  nextValidationCommandTemplate: nextValidationCommand,
  locks: lockState
};

const builder = {
  ok: true,
  format: "transparent_ai_spatial_intent_evidence_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "spatial_intent_evidence_receipt_builder_ready_for_teacher_use",
  sourceRequestStatus: request.status || "",
  expectedPacketFormat: request.expectedPacketFormat || "transparent_ai_sketch_overlay_packet_v1",
  transparentSketchOverlayPath: request.transparentSketchOverlayPath || "",
  teacherExportedOverlayPacketPlaceholder: placeholder,
  sourceHandoffSteps: request.teacherHandoffSteps || [],
  universalDetailLogicPolicy: {
    format: "transparent_ai_spatial_intent_detail_logic_gate_v1",
    allConsequentialDetailsMustBeLogicized: true,
    linesAndAnglesAreExamplesOnly: true,
    visualSimilarityCannotReplaceLogic: true,
    passedReceiptValidationRequired: true,
    requiredValidationFormat: "transparent_ai_parametric_drawing_logic_receipt_validation_v1",
    requiredValidationStatus: "ready_for_review_only_dry_run_generation_plan",
    acceptedLogicSources: [
      "teacher_reviewed_data_field_or_variable",
      "teacher_reviewed_formula_or_constraint",
      "teacher_reviewed_reference_or_datum_relationship",
      "teacher_reviewed_exception_or_design_rule",
      "teacher_marked_decorative_or_non_parametric"
    ],
    scopeExamples: [
      "line length",
      "angle",
      "radius",
      "spacing",
      "count",
      "coordinate frame",
      "datum",
      "position",
      "depth or perspective relation",
      "proportion or ratio",
      "tolerance or clearance",
      "material or process rule",
      "annotation or software output state"
    ],
    requiredSpatialEvidenceDimensions: [
      "2d_position_or_anchor",
      "angle_or_direction_vector",
      "perspective_relationship",
      "3d_depth_hint_or_near_far_relation"
    ],
    minimumSpatialEvidenceRule:
      "A teacher-exported overlay packet must contain 2D position/anchor evidence, angle or direction evidence, perspective relationship evidence, and 3D depth or near/far evidence before spatial target confirmation is prepared.",
    blockedShortcut: "prepare_spatial_confirmation_from_visual_similarity_without_universal_detail_logic"
  },
  paths: {
    builder: builderPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceRequest: requestInput.path,
    transparentSketchOverlay: request.transparentSketchOverlayPath || ""
  },
  nextValidationCommand,
  blockedActions: [
    "treat_placeholder_as_teacher_evidence",
    "treat_line_or_angle_examples_as_complete_logic_scope",
    "prepare_spatial_confirmation_without_universal_detail_logic_review",
    "prepare_spatial_confirmation_without_passed_detail_logic_receipt_validation",
    "run_spatial_target_confirmation_from_builder",
    "execute_target_software_from_builder",
    "capture_screenshot_from_builder",
    "write_memory_from_builder",
    "enable_rule_from_builder",
    "claim_goal_complete_from_builder",
    "unlock_packaging_from_builder"
  ],
  locks: lockState
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Spatial Intent Evidence Receipt Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { line-height: 1.55; }
    .panel { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); margin-top: 14px; }
    label { display: block; margin: 10px 0; font-weight: 600; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 9px; font: 14px "Segoe UI", Arial, sans-serif; }
    input[type="checkbox"] { width: 18px; height: 18px; vertical-align: middle; margin-right: 6px; }
    textarea { min-height: 220px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Spatial Intent Evidence Receipt Builder</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span></p>
    <section class="panel">
      <h2>Teacher evidence</h2>
      <p class="muted">Transparent overlay: <code>${htmlEscape(builder.transparentSketchOverlayPath || "(not available)")}</code></p>
      <p class="muted">Expected packet format: <code>${htmlEscape(builder.expectedPacketFormat)}</code></p>
      <label>Teacher-exported overlay packet path
        <input id="packetPath" value="${htmlEscape(placeholder)}">
      </label>
      <label><input id="evidenceReviewed" type="checkbox"> I reviewed the exported packet path and it is not the placeholder.</label>
      <p class="muted">Required spatial evidence: 2D position/anchor, angle or direction vector, perspective relationship, and 3D depth or near/far relation.</p>
      <label>Universal detail logic contract or kit path
        <input id="detailLogicPath" value="&lt;teacher-reviewed-universal-detail-logic-contract-or-kit.json&gt;">
      </label>
      <label>Passed detail logic receipt validation path
        <input id="detailLogicValidationPath" value="&lt;passed-parametric-drawing-logic-receipt-validation.json&gt;">
      </label>
      <label><input id="detailLogicReviewed" type="checkbox"> I reviewed the detail logic: consequential lines, angles, depth, proportions, constraints, tolerances, states, and exceptions are logic-backed or explicitly decorative.</label>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="teacher_reviewed_prepare_spatial_confirmation">teacher_reviewed_prepare_spatial_confirmation</option>
          <option value="blocked_needs_more_evidence">blocked_needs_more_evidence</option>
        </select>
      </label>
      <label>Teacher note
        <input id="teacherNote" value="">
      </label>
      <p>
        <button id="generate">Generate Receipt JSON</button>
        <button id="copy" class="secondary">Copy JSON</button>
      </p>
      <textarea id="receipt" spellcheck="false"></textarea>
      <p class="muted">Next validation command: <code>${htmlEscape(nextValidationCommand)}</code></p>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const receiptEl = document.getElementById("receipt");
    function buildReceipt() {
      return {
        format: "transparent_ai_spatial_intent_evidence_receipt_v1",
        builderId: builder.builderId,
        sourceRequest: builder.paths.sourceRequest,
        teacherDecision: document.getElementById("decision").value,
        evidenceReviewed: document.getElementById("evidenceReviewed").checked,
        teacherExportedOverlayPacketPath: document.getElementById("packetPath").value.trim(),
        detailLogicReviewed: document.getElementById("detailLogicReviewed").checked,
        universalDetailLogicContractPath: document.getElementById("detailLogicPath").value.trim(),
        universalDetailLogicReceiptValidationPath: document.getElementById("detailLogicValidationPath").value.trim(),
        detailLogicRequirement: builder.universalDetailLogicPolicy,
        requiredSpatialEvidenceDimensions: builder.universalDetailLogicPolicy.requiredSpatialEvidenceDimensions,
        teacherNote: document.getElementById("teacherNote").value.trim(),
        nextValidationCommandTemplate: builder.nextValidationCommand,
        locks: builder.locks
      };
    }
    function render() {
      receiptEl.value = JSON.stringify(buildReceipt(), null, 2);
    }
    document.getElementById("generate").addEventListener("click", render);
    document.getElementById("copy").addEventListener("click", async () => {
      render();
      await navigator.clipboard.writeText(receiptEl.value);
    });
    render();
  </script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_intent_evidence_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      nextValidationCommand,
      locks: lockState
    },
    null,
    2
  )
);
