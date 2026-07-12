#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "universal-detail-logic-rule-package")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "universal-detail-logic-rule-package"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function lockState() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    compilerDoesNotGenerateOutput: true,
    compilerDoesNotExecuteSoftware: true,
    compilerDoesNotWriteMemory: true,
    compilerDoesNotEnableRules: true,
    targetCadGenerated: false,
    targetOutputGenerated: false,
    cadSoftwareExecuted: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    surfaceSimilarityOnlyAccepted: false,
    goalComplete: false
  };
}

function makeMap(rows, key) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.[key]) map.set(String(row[key]), row);
  }
  return map;
}

function clean(value) {
  return String(value ?? "").trim();
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function writeHtml(path, pkg) {
  const ruleRows = pkg.logicRuleCandidates
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.featureId)}</td>
        <td>${htmlEscape(row.detailCategory)}</td>
        <td>${htmlEscape(row.logicSource)}</td>
        <td>${htmlEscape(row.formulaOrConstraint)}</td>
        <td>${htmlEscape(row.transferValidation)}</td>
        <td>${htmlEscape(row.status)}</td>
      </tr>`
    )
    .join("\n");
  const validationRows = pkg.preGenerationValidationMatrix
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.featureId)}</td>
        <td>${htmlEscape(row.mustProve)}</td>
        <td>${htmlEscape(row.failIf)}</td>
      </tr>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Universal Detail Logic Rule Package</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
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
    <h1>Universal Detail Logic Rule Package</h1>
    <section class="panel">
      <p><strong>Status:</strong> ${htmlEscape(pkg.status)}</p>
      <p><strong>Decision:</strong> ${htmlEscape(pkg.decision)}</p>
      <p><strong>Rule candidates:</strong> ${pkg.counts.logicRuleCandidates}</p>
      <p class="lock">This package compiles teacher-reviewed logic into disabled rule candidates. It does not generate output, execute target software, write memory, or accept rules.</p>
    </section>
    <h2>Logic Rule Candidates</h2>
    <table>
      <thead><tr><th>Feature</th><th>Category</th><th>Logic Source</th><th>Formula Or Constraint</th><th>Transfer Validation</th><th>Status</th></tr></thead>
      <tbody>${ruleRows}</tbody>
    </table>
    <h2>Pre-Generation Validation Matrix</h2>
    <table>
      <thead><tr><th>Feature</th><th>Must Prove</th><th>Fail If</th></tr></thead>
      <tbody>${validationRows}</tbody>
    </table>
  </main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

const kitInput = readJsonInput(
  argValue("--kit", argValue("--logic-kit", "")),
  "--kit",
  "transparent_ai_parametric_drawing_logic_learning_kit_v1"
);
const validationInput = readJsonInput(
  argValue("--validation", argValue("--receipt-validation", "")),
  "--validation",
  "transparent_ai_parametric_drawing_logic_receipt_validation_v1"
);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "universal-detail-logic-rule-packages"))
);
mkdirSync(outputRoot, { recursive: true });

const kit = kitInput.value;
const validation = validationInput.value;
const packageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(kit.goal || kit.kitId)}`;
const packageDir = join(outputRoot, packageId);
mkdirSync(packageDir, { recursive: true });
const packagePath = join(packageDir, "universal-detail-logic-rule-package.json");
const htmlPath = join(packageDir, "universal-detail-logic-rule-package.html");
const readmePath = join(packageDir, "UNIVERSAL_DETAIL_LOGIC_RULE_PACKAGE_START_HERE.md");
const locks = lockState();

const validationReady =
  validation.status === "ready_for_review_only_dry_run_generation_plan" &&
  validation.decision === "ready_for_review_only_dry_run" &&
  validation.counts?.blockedRows === 0 &&
  validation.requirementGates?.everyRelationshipLogicReviewed === true &&
  validation.requirementGates?.everyUniversalDetailLogicReviewed === true &&
  validation.requirementGates?.everyTransferValidationReviewed === true &&
  validation.requirementGates?.fullDetailCoverageReviewed === true &&
  validation.requirementGates?.implicitHiddenDerivedDetailCoverageReviewed === true;

const relationshipById = makeMap(kit.relationshipDrafts, "relationshipId");
const universalById = makeMap(validation.universalDetailLogicRows, "relationshipId");
const transferByFeatureId = makeMap(validation.transferValidationRows, "featureId");

const logicRuleCandidates = (validation.relationshipRows || []).map((row) => {
  const source = relationshipById.get(String(row.relationshipId)) || {};
  const universal = universalById.get(String(row.relationshipId)) || {};
  const transfer = transferByFeatureId.get(String(row.featureId)) || {};
  const logicSource =
    clean(row.correctedFormulaOrConstraint) ||
    clean(universal.correctedCategoryOrLogicSource) ||
    clean(source.controlledByData) ||
    clean(source.logicVariable) ||
    "teacher_reviewed_logic_source";
  const formulaOrConstraint =
    clean(row.correctedFormulaOrConstraint) ||
    clean(source.formulaOrConstraint) ||
    clean(universal.correctedCategoryOrLogicSource) ||
    "teacher_reviewed_exception_or_design_rule";
  return {
    ruleCandidateId: `disabled-rule-candidate-${row.relationshipId}`,
    relationshipId: row.relationshipId,
    featureId: row.featureId,
    featureType: row.featureType || source.featureType || source.geometryType || "",
    detailCategory: universal.detailCategory || "teacher_reviewed_detail_logic",
    logicSource,
    formulaOrConstraint,
    transferValidation:
      clean(transfer.correctedTransferTest) ||
      "Recompute or re-evaluate this detail from the reviewed logic source on new data before any visual similarity check.",
    failIf:
      "Fail if the detail is copied from the source artifact appearance, guessed from plausibility, or judged acceptable only because it looks similar.",
    status: validationReady ? "disabled_rule_candidate_ready_for_review_only_dry_run" : "blocked_until_receipt_validation_ready",
    accepted: false,
    ruleEnabled: false,
    memoryWritten: false
  };
});

const preGenerationValidationMatrix = logicRuleCandidates.map((rule) => ({
  ruleCandidateId: rule.ruleCandidateId,
  featureId: rule.featureId,
  mustProve:
    "New output detail is derived from the reviewed data/formula/constraint/exception and has a passing transfer validation before visual review.",
  failIf: rule.failIf,
  visualSimilarityRole: "secondary_review_signal_only_after_logic_validation_passes",
  blocksTargetSoftwareAction: true
}));

const blockedReasons = [
  ...(validationReady ? [] : ["receipt_validation_is_not_ready_for_review_only_dry_run"]),
  ...(logicRuleCandidates.length ? [] : ["no_logic_rule_candidates"])
];
const canPrepareDryRunRuleApplication = validationReady && logicRuleCandidates.length > 0;
const nextReviewOnlyApplicationCommand =
  `node plugins\\transparent-ai-apprentice\\scripts\\create-parametric-drawing-logic-learning-kit.mjs --goal "${clean(kit.goal).replace(/"/g, '\\"') || "Apply reviewed universal detail logic in dry-run"}"` +
  (kit.software ? ` --software "${clean(kit.software).replace(/"/g, '\\"')}"` : "") +
  (kit.sourceEvidence?.sourceDrawingPath ? ` --source-drawing "${kit.sourceEvidence.sourceDrawingPath}"` : "") +
  (kit.sourceEvidence?.sourceDataPath ? ` --source-data "${kit.sourceEvidence.sourceDataPath}"` : "") +
  (kit.sourceEvidence?.newDataPath ? ` --new-data "${kit.sourceEvidence.newDataPath}"` : "") +
  " --output-dir <review-only-rule-application-dry-run-output-dir>";

const pkg = {
  ok: true,
  format: "transparent_ai_universal_detail_logic_rule_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  sourceKit: kitInput.path,
  sourceReceiptValidation: validationInput.path,
  status: canPrepareDryRunRuleApplication
    ? "review_only_logic_rule_package_ready_for_dry_run_application"
    : "blocked_until_receipt_validation_ready",
  decision: canPrepareDryRunRuleApplication ? "ready_for_review_only_rule_application_dry_run" : "needs_teacher_review",
  principle:
    "Rigor comes from logicized details: every consequential output detail must cite a reviewed data field, formula, constraint, exception, or decorative/non-parametric decision before similar output or software action.",
  counts: {
    logicRuleCandidates: logicRuleCandidates.length,
    preGenerationValidationRows: preGenerationValidationMatrix.length,
    blockedReasons: blockedReasons.length
  },
  gates: {
    sourceReceiptValidationReady: validationReady,
    everyRuleCandidateDisabled: logicRuleCandidates.every((rule) => rule.ruleEnabled === false && rule.accepted === false),
    fullDetailCoverageReviewed: validation.requirementGates?.fullDetailCoverageReviewed === true,
    implicitHiddenDerivedDetailCoverageReviewed:
      validation.requirementGates?.implicitHiddenDerivedDetailCoverageReviewed === true,
    visualSimilarityStillSecondaryOnly: true,
    noGenerationOrExecutionPerformed: true
  },
  logicRuleCandidates,
  preGenerationValidationMatrix,
  nextReviewOnlyApplicationCommand: canPrepareDryRunRuleApplication ? nextReviewOnlyApplicationCommand : "",
  blockedReasons,
  blockedActions: [
    "enable_rule_candidates_without_teacher_acceptance",
    "write_rule_candidates_to_memory",
    "generate_output_from_rule_package",
    "execute_target_software_from_rule_package",
    "judge_by_visual_similarity_before_logic_validation",
    "claim_mastered_or_complete",
    "unlock_packaging",
    "native_universal_execution"
  ],
  locks,
  paths: {
    package: packagePath,
    html: htmlPath,
    readme: readmePath,
    sourceKit: kitInput.path,
    sourceReceiptValidation: validationInput.path
  }
};

writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Universal Detail Logic Rule Package",
    "",
    `Status: ${pkg.status}`,
    `Decision: ${pkg.decision}`,
    `Rule candidates: ${pkg.counts.logicRuleCandidates}`,
    "",
    "This package compiles teacher-reviewed detail logic into disabled rule candidates.",
    "",
    "Safety boundary:",
    "- No output was generated.",
    "- No target software was executed.",
    "- No screenshot was captured.",
    "- No memory was written.",
    "- No rule was enabled or accepted.",
    "- Visual similarity remains secondary after logic validation.",
    "",
    canPrepareDryRunRuleApplication
      ? `Next review-only dry-run application command: ${nextReviewOnlyApplicationCommand}`
      : `Blocked reasons: ${blockedReasons.join(", ")}`
  ].join("\n") + "\n",
  "utf8"
);
writeHtml(htmlPath, pkg);

console.log(
  JSON.stringify(
    {
      status: pkg.status,
      format: "transparent_ai_universal_detail_logic_rule_package_result_v1",
      packagePath,
      htmlPath,
      readmePath,
      canPrepareDryRunRuleApplication,
      ruleCandidateCount: logicRuleCandidates.length,
      locks
    },
    null,
    2
  )
);
