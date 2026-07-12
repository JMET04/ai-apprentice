#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "parametric-drawing-logic-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "parametric-drawing-logic-receipt-validation"
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
    validationDoesNotGenerateOutput: true,
    validationDoesNotExecuteSoftware: true,
    validationDoesNotWriteMemory: true,
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

const POSITIVE_DECISIONS = new Set([
  "teacher_reviewed_relationship",
  "teacher_reviewed_relationships",
  "teacher_reviewed_logic_source",
  "teacher_reviewed_detail_logic",
  "teacher_corrected_relationship",
  "teacher_marked_decorative_or_non_parametric",
  "ready_for_dry_run_generation_plan"
]);

const BLOCKED_DECISIONS = new Set([
  "accepted",
  "execute_now",
  "write_memory",
  "claim_mastered",
  "claim_complete",
  "unlock_packaging",
  "generate_now",
  "native_universal_execution"
]);

function decisionOf(row) {
  return String(row?.teacherDecision || "").trim();
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function makeMap(rows, key) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.[key]) map.set(String(row[key]), row);
  }
  return map;
}

const kitInput = readJsonInput(
  argValue("--kit", argValue("--logic-kit", "")),
  "--kit",
  "transparent_ai_parametric_drawing_logic_learning_kit_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_parametric_drawing_logic_teacher_receipt_v1"
);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "parametric-drawing-logic-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });

const kit = kitInput.value;
const receipt = receiptInput.value;
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(kit.goal || kit.kitId)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });
const validationPath = join(validationDir, "parametric-drawing-logic-receipt-validation.json");
const readmePath = join(validationDir, "PARAMETRIC_DRAWING_LOGIC_RECEIPT_VALIDATION_START_HERE.md");
const locks = lockState();

const relationshipById = makeMap(receipt.relationshipReviews, "relationshipId");
const logicById = makeMap(receipt.universalDetailLogicReview, "relationshipId");
const validationById = makeMap(receipt.detailTransferValidationReview, "validationId");

const relationshipRows = (kit.relationshipDrafts || []).map((relationship) => {
  const review = relationshipById.get(String(relationship.relationshipId));
  const decision = decisionOf(review);
  const forbiddenDecision = BLOCKED_DECISIONS.has(decision);
  const reviewed = Boolean(review?.evidenceReviewed) && POSITIVE_DECISIONS.has(decision);
  const corrected = hasText(review?.correctedFormulaOrConstraint);
  return {
    relationshipId: relationship.relationshipId,
    featureId: relationship.featureId,
    featureType: relationship.featureType,
    decision,
    evidenceReviewed: Boolean(review?.evidenceReviewed),
    correctedFormulaOrConstraint: review?.correctedFormulaOrConstraint || "",
    status: forbiddenDecision
      ? "blocked_forbidden_decision"
      : reviewed || corrected
        ? "relationship_logic_reviewed"
        : "relationship_logic_needs_teacher_review",
    canAdvance: !forbiddenDecision && (reviewed || corrected),
    blocker: forbiddenDecision
      ? `Forbidden decision ${decision}`
      : reviewed || corrected
        ? ""
        : "Teacher must review evidence or provide a corrected formula/constraint."
  };
});

const universalLogicRows = (kit.universalDetailLogicContract?.rows || []).map((row) => {
  const review = logicById.get(String(row.relationshipId));
  const decision = decisionOf(review);
  const forbiddenDecision = BLOCKED_DECISIONS.has(decision);
  const teacherMarkedDecorative = Boolean(review?.markDecorativeOrNonParametric);
  const suppliedCorrection = hasText(review?.correctedCategoryOrLogicSource);
  const positive = POSITIVE_DECISIONS.has(decision) || teacherMarkedDecorative || suppliedCorrection;
  const originalMissing = row.logicSourceStatus === "missing_logic_source_blocks_generation";
  const missingStillBlocked = originalMissing && !teacherMarkedDecorative && !suppliedCorrection;
  return {
    relationshipId: row.relationshipId,
    featureId: row.featureId,
    detailCategory: row.detailCategory,
    sourceLogicStatus: row.logicSourceStatus,
    decision,
    markDecorativeOrNonParametric: teacherMarkedDecorative,
    correctedCategoryOrLogicSource: review?.correctedCategoryOrLogicSource || "",
    status: forbiddenDecision
      ? "blocked_forbidden_decision"
      : missingStillBlocked
        ? "missing_logic_source_still_blocks_generation"
        : positive
          ? "universal_detail_logic_reviewed"
          : "universal_detail_logic_needs_teacher_review",
    canAdvance: !forbiddenDecision && !missingStillBlocked && positive,
    blocker: forbiddenDecision
      ? `Forbidden decision ${decision}`
      : missingStillBlocked
        ? "Missing logic source still needs a data/formula/constraint, teacher exception, or decorative classification."
        : positive
          ? ""
          : "Teacher must review or correct this universal detail logic row."
  };
});

const transferValidationRows = (kit.detailTransferValidationMatrix || []).map((row) => {
  const review = validationById.get(String(row.validationId));
  const decision = decisionOf(review);
  const forbiddenDecision = BLOCKED_DECISIONS.has(decision);
  const catchesWrongCases = Boolean(review?.validationCatchesImportantWrongCases);
  const correctedTransferTest = hasText(review?.correctedTransferTest);
  const positive = POSITIVE_DECISIONS.has(decision);
  return {
    validationId: row.validationId,
    featureId: row.featureId,
    detailCategory: row.detailCategory,
    decision,
    validationCatchesImportantWrongCases: catchesWrongCases,
    correctedTransferTest: review?.correctedTransferTest || "",
    status: forbiddenDecision
      ? "blocked_forbidden_decision"
      : (positive && catchesWrongCases) || correctedTransferTest
        ? "transfer_validation_reviewed"
        : "transfer_validation_needs_teacher_review",
    canAdvance: !forbiddenDecision && ((positive && catchesWrongCases) || correctedTransferTest),
    blocker: forbiddenDecision
      ? `Forbidden decision ${decision}`
      : (positive && catchesWrongCases) || correctedTransferTest
        ? ""
        : "Teacher must confirm the validation catches important wrong cases or provide a corrected transfer test."
  };
});

const forbiddenOverallDecision = BLOCKED_DECISIONS.has(String(receipt.decision || ""));
const dryRunDecisionReady = receipt.decision === "ready_for_dry_run_generation_plan";
const coverageReview = receipt.fullDetailCoverageReview || {};
const coverageDecision = decisionOf(coverageReview);
const coverageForbiddenDecision = BLOCKED_DECISIONS.has(coverageDecision);
const coverageReady =
  !coverageForbiddenDecision &&
  POSITIVE_DECISIONS.has(coverageDecision) &&
  coverageReview.explicitSurfaceDetailsReviewed === true &&
  coverageReview.implicitDerivedDetailsReviewed === true &&
  coverageReview.hiddenConstraintAndStateDetailsReviewed === true &&
  coverageReview.allConsequentialDetailsEitherLogicBackedExceptionDecorativeOrBlocked === true;
const fullDetailCoverageGate = {
  decision: coverageDecision,
  explicitSurfaceDetailsReviewed: coverageReview.explicitSurfaceDetailsReviewed === true,
  implicitDerivedDetailsReviewed: coverageReview.implicitDerivedDetailsReviewed === true,
  hiddenConstraintAndStateDetailsReviewed: coverageReview.hiddenConstraintAndStateDetailsReviewed === true,
  allConsequentialDetailsEitherLogicBackedExceptionDecorativeOrBlocked:
    coverageReview.allConsequentialDetailsEitherLogicBackedExceptionDecorativeOrBlocked === true,
  canAdvance: coverageReady,
  blocker: coverageForbiddenDecision
    ? `Forbidden decision ${coverageDecision}`
    : coverageReady
      ? ""
      : "Teacher must confirm full explicit, implicit, hidden, derived, state, and validation detail coverage before dry-run planning."
};
const allRowsCanAdvance =
  relationshipRows.every((row) => row.canAdvance) &&
  universalLogicRows.every((row) => row.canAdvance) &&
  transferValidationRows.every((row) => row.canAdvance);
const kitPlanReady = kit.newDrawingGenerationPlan?.status === "dry_run_generation_plan_ready_for_review";
const canPrepareDryRunReview =
  !forbiddenOverallDecision && dryRunDecisionReady && coverageReady && allRowsCanAdvance && kitPlanReady;
const forbiddenDecisionUsed =
  forbiddenOverallDecision ||
  coverageForbiddenDecision ||
  [...relationshipRows, ...universalLogicRows, ...transferValidationRows].some((row) => row.status === "blocked_forbidden_decision");

const blockedRows = [
  ...relationshipRows,
  ...universalLogicRows,
  ...transferValidationRows,
  ...(coverageReady
    ? []
    : [
        {
          validationId: "full-detail-coverage-review",
          featureId: "all_consequential_details",
          detailCategory: "explicit_implicit_hidden_derived_state_and_validation_logic",
          status: coverageForbiddenDecision
            ? "blocked_forbidden_decision"
            : "full_detail_coverage_needs_teacher_review",
          canAdvance: false,
          blocker: fullDetailCoverageGate.blocker
        }
      ])
].filter((row) => !row.canAdvance);
const nextDryRunReviewCommand =
  `node plugins\\transparent-ai-apprentice\\scripts\\create-parametric-drawing-logic-learning-kit.mjs --goal "${String(kit.goal || "Review universal detail logic dry-run").replace(/"/g, '\\"')}"` +
  (kit.software ? ` --software "${String(kit.software).replace(/"/g, '\\"')}"` : "") +
  (kit.sourceEvidence?.sourceDrawingPath ? ` --source-drawing "${kit.sourceEvidence.sourceDrawingPath}"` : "") +
  (kit.sourceEvidence?.sourceDataPath ? ` --source-data "${kit.sourceEvidence.sourceDataPath}"` : "") +
  (kit.sourceEvidence?.newDataPath ? ` --new-data "${kit.sourceEvidence.newDataPath}"` : "") +
  " --output-dir <teacher-reviewed-dry-run-output-dir>";

const validation = {
  ok: true,
  format: "transparent_ai_parametric_drawing_logic_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  sourceKit: kitInput.path,
  sourceReceipt: receiptInput.path,
  status: canPrepareDryRunReview
    ? "ready_for_review_only_dry_run_generation_plan"
    : "blocked_until_teacher_reviews_every_consequential_detail_logic_row",
  decision: forbiddenDecisionUsed
    ? "blocked_for_forbidden_decision"
    : canPrepareDryRunReview
      ? "ready_for_review_only_dry_run"
      : "needs_teacher_review",
  forbiddenDecisionUsed,
  counts: {
    relationshipRows: relationshipRows.length,
    universalDetailLogicRows: universalLogicRows.length,
    transferValidationRows: transferValidationRows.length,
    blockedRows: blockedRows.length,
    forbiddenDecisionRows: [...relationshipRows, ...universalLogicRows, ...transferValidationRows].filter(
      (row) => row.status === "blocked_forbidden_decision"
    ).length
  },
  requirementGates: {
    receiptDecisionReadyForDryRunPlan: dryRunDecisionReady,
    noForbiddenOverallDecision: !forbiddenOverallDecision,
    everyRelationshipLogicReviewed: relationshipRows.every((row) => row.canAdvance),
    everyUniversalDetailLogicReviewed: universalLogicRows.every((row) => row.canAdvance),
    everyTransferValidationReviewed: transferValidationRows.every((row) => row.canAdvance),
    fullDetailCoverageReviewed: coverageReady,
    implicitHiddenDerivedDetailCoverageReviewed: coverageReady,
    sourceKitDryRunPlanReady: kitPlanReady,
    visualSimilarityStillSecondaryOnly: true
  },
  fullDetailCoverageGate,
  relationshipRows,
  universalDetailLogicRows: universalLogicRows,
  transferValidationRows,
  blockedRows,
  nextReviewOnlyDryRunCommand: canPrepareDryRunReview ? nextDryRunReviewCommand : "",
  blockedActions: [
    "accept_logic_without_teacher_review",
    "generate_output_from_visual_similarity",
    "skip_full_detail_coverage_review",
    "ignore_hidden_implicit_or_derived_detail_logic",
    "execute_target_software",
    "write_memory",
    "claim_mastered",
    "unlock_packaging",
    "native_universal_execution"
  ],
  locks,
  paths: {
    validation: validationPath,
    readme: readmePath,
    sourceKit: kitInput.path,
    sourceReceipt: receiptInput.path
  }
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Parametric Drawing Logic Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.decision}`,
    `Blocked rows: ${validation.counts.blockedRows}`,
    "",
    "This validation checks that every consequential detail has teacher-reviewed logic before any dry-run generation review.",
    "",
    "Safety boundary:",
    "- No output was generated.",
    "- No target software was executed.",
    "- No screenshot was captured.",
    "- No memory was written.",
    "- Visual similarity remains a secondary signal only after logic validation passes.",
    "",
    canPrepareDryRunReview ? `Next review-only dry-run command: ${nextDryRunReviewCommand}` : "Next action: teacher must resolve the blocked rows in the validation JSON."
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      status: validation.status,
      decision: validation.decision,
      format: "transparent_ai_parametric_drawing_logic_receipt_validation_result_v1",
      validationPath,
      readmePath,
      canPrepareDryRunReview,
      blockedRowCount: blockedRows.length,
      forbiddenDecisionUsed,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
