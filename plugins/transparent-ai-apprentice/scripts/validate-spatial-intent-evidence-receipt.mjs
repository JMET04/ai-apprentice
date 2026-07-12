#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "spatial-intent-evidence-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "spatial-intent-evidence-receipt-validation"
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

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_exported_overlay_packet", "ready_for_spatial_target_confirmation", "teacher_reviewed_prepare_spatial_confirmation"].includes(text)) {
    return "teacher_reviewed_prepare_spatial_confirmation";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
  if (["accepted", "execute_now", "enable_memory", "claim_complete", "unlock_packaging", "native_universal_execution"].includes(text)) return text;
  return "needs_teacher_review";
}

function psQuote(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

const DEFAULT_EXPECTED_OVERLAY_PACKET_FORMAT = "transparent_ai_sketch_overlay_packet_v1";
const DETAIL_LOGIC_PLACEHOLDER = "<teacher-reviewed-universal-detail-logic-contract-or-kit.json>";
const DETAIL_LOGIC_VALIDATION_PLACEHOLDER = "<passed-parametric-drawing-logic-receipt-validation.json>";

function resolveOptionalPath(value) {
  const text = String(value || "").trim();
  if (!text || text.includes("<") || text.includes(">")) return { path: "", placeholderUsed: true, exists: false, value: null };
  const path = resolve(text);
  const exists = existsSync(path);
  return { path, placeholderUsed: false, exists, value: exists ? readJson(path) : null };
}

function detailLogicSummary(value) {
  const contract =
    value?.format === "transparent_ai_universal_detail_logic_contract_v1"
      ? value
      : value?.universalDetailLogicContract?.format === "transparent_ai_universal_detail_logic_contract_v1"
        ? value.universalDetailLogicContract
        : null;
  const counts = contract?.counts || {};
  const missingLogicSource = Number(counts.missingLogicSource ?? counts.blockedDetails ?? 0);
  const totalDetails = Number(counts.totalDetails ?? contract?.rows?.length ?? 0);
  const completenessGate = contract?.logicCompletenessGate || {};
  const rows = Array.isArray(contract?.rows)
    ? contract.rows
    : Array.isArray(contract?.consequentialDetailRows)
      ? contract.consequentialDetailRows
      : [];
  const categoryText = rows.map((row) => String(row.detailCategory || row.featureType || row.classification || "").toLowerCase());
  const hasPositionRelationLogic = categoryText.some((text) => text.includes("position") || text.includes("alignment") || text.includes("relation"));
  const hasAngularOrDirectionLogic = categoryText.some((text) => text.includes("angular") || text.includes("angle") || text.includes("curvature") || text.includes("direction"));
  const hasDepthPerspectiveLogic = categoryText.some((text) => text.includes("depth") || text.includes("perspective") || text.includes("view"));
  return {
    contractFormat: contract?.format || "",
    totalDetails,
    missingLogicSource,
    logicCompletenessGateRequiresBeforeAction: completenessGate.requiredBeforeTargetSoftwareAction === true,
    visualSimilarityRejected: contract?.surfaceSimilarityOnlyRejected === true || completenessGate.visualSimilarityCanNeverOverrideMissingLogic === true,
    hasPositionRelationLogic,
    hasAngularOrDirectionLogic,
    hasDepthPerspectiveLogic,
    ready:
      contract?.format === "transparent_ai_universal_detail_logic_contract_v1" &&
      missingLogicSource === 0 &&
      hasPositionRelationLogic &&
      hasAngularOrDirectionLogic &&
      hasDepthPerspectiveLogic &&
      completenessGate.requiredBeforeTargetSoftwareAction === true &&
      (contract.surfaceSimilarityOnlyRejected === true || completenessGate.visualSimilarityCanNeverOverrideMissingLogic === true)
  };
}

function pointHasDepth(point) {
  return point && point.zHint !== undefined && point.zHint !== null && Number(point.zHint) !== 0;
}

function spatialEvidenceSummary(packet) {
  const strokes = Array.isArray(packet?.strokes) ? packet.strokes : [];
  const anchors = Array.isArray(packet?.anchors) ? packet.anchors : [];
  const relationships = Array.isArray(packet?.spatialIntent?.relationships) ? packet.spatialIntent.relationships : [];
  const perspectiveCues = Array.isArray(packet?.spatialIntent?.perspectiveCues) ? packet.spatialIntent.perspectiveCues : [];
  const allPoints = strokes.flatMap((stroke) => (Array.isArray(stroke.points) ? stroke.points : []));
  const has2DPositionEvidence =
    packet?.coordinateSpace?.supports2D === true ||
    packet?.spatialIntent?.supports2DPosition === true ||
    anchors.some((anchor) => Array.isArray(anchor.box) && anchor.box.length >= 4) ||
    allPoints.some((point) => point.x !== undefined && point.y !== undefined);
  const hasAngleOrDirectionEvidence = strokes.some((stroke) => {
    const points = Array.isArray(stroke.points) ? stroke.points : [];
    if (points.length < 2) return false;
    const first = points[0];
    const last = points[points.length - 1];
    return first?.x !== last?.x || first?.y !== last?.y || String(stroke.mode || "").includes("angle");
  });
  const hasPerspectiveEvidence =
    packet?.coordinateSpace?.supportsPerspectiveRelationships === true ||
    packet?.spatialIntent?.supportsPerspectiveRelationships === true ||
    strokes.some((stroke) => String(stroke.mode || "").includes("perspective")) ||
    relationships.some((row) => String(row.relation || "").includes("perspective")) ||
    perspectiveCues.some((row) => String(row.cue || "").includes("perspective"));
  const has3DDepthEvidence =
    packet?.coordinateSpace?.supports3DDepthHints === true ||
    packet?.spatialIntent?.supports3DDepthHints === true ||
    strokes.some((stroke) => String(stroke.mode || "").includes("3d") || String(stroke.depthHint || "").includes("near") || String(stroke.depthHint || "").includes("far")) ||
    relationships.some((row) => ["nearer_than", "farther_than"].includes(String(row.relation || ""))) ||
    perspectiveCues.some((row) => String(row.cue || "").includes("3d")) ||
    allPoints.some(pointHasDepth);
  const ready = has2DPositionEvidence && hasAngleOrDirectionEvidence && hasPerspectiveEvidence && has3DDepthEvidence;
  return {
    strokeCount: strokes.length,
    anchorCount: anchors.length,
    relationshipCount: relationships.length,
    perspectiveCueCount: perspectiveCues.length,
    has2DPositionEvidence,
    hasAngleOrDirectionEvidence,
    hasPerspectiveEvidence,
    has3DDepthEvidence,
    ready,
    missingDimensions: [
      has2DPositionEvidence ? "" : "2d_position",
      hasAngleOrDirectionEvidence ? "" : "angle_or_direction",
      hasPerspectiveEvidence ? "" : "perspective_relation",
      has3DDepthEvidence ? "" : "3d_depth"
    ].filter(Boolean)
  };
}

function detailLogicValidationSummary(value) {
  const gates = value?.requirementGates || {};
  const locks = value?.locks || {};
  const ready =
    value?.format === "transparent_ai_parametric_drawing_logic_receipt_validation_v1" &&
    value?.status === "ready_for_review_only_dry_run_generation_plan" &&
    value?.decision === "ready_for_review_only_dry_run" &&
    Number(value?.counts?.blockedRows ?? -1) === 0 &&
    gates.everyRelationshipLogicReviewed === true &&
    gates.everyUniversalDetailLogicReviewed === true &&
    gates.everyTransferValidationReviewed === true &&
    gates.visualSimilarityStillSecondaryOnly === true &&
    locks.validationDoesNotGenerateOutput === true &&
    locks.validationDoesNotExecuteSoftware === true &&
    locks.softwareActionsExecuted === false &&
    locks.memoryWritten === false;
  return {
    validationFormat: value?.format || "",
    validationStatus: value?.status || "",
    validationDecision: value?.decision || "",
    blockedRows: Number(value?.counts?.blockedRows ?? -1),
    everyRelationshipLogicReviewed: gates.everyRelationshipLogicReviewed === true,
    everyUniversalDetailLogicReviewed: gates.everyUniversalDetailLogicReviewed === true,
    everyTransferValidationReviewed: gates.everyTransferValidationReviewed === true,
    visualSimilarityStillSecondaryOnly: gates.visualSimilarityStillSecondaryOnly === true,
    validationDoesNotGenerateOutput: locks.validationDoesNotGenerateOutput === true,
    validationDoesNotExecuteSoftware: locks.validationDoesNotExecuteSoftware === true,
    ready
  };
}

function withOverlayPacket(commandTemplate, overlayPacketPath) {
  const replacement = psQuote(overlayPacketPath);
  if (commandTemplate.includes("<teacher-exported-transparent-sketch-packet.json>")) {
    return commandTemplate.replace(/"?<teacher-exported-transparent-sketch-packet\.json>"?/g, replacement);
  }
  return `${commandTemplate} --overlay-packet ${replacement}`;
}

function writeReadme(path, validation) {
  const lines = [
    "# Spatial Intent Evidence Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Validation row:",
    `- ${validation.validationRow.status}`,
    "",
    "Prepared next review command:",
    validation.nextReviewCommand?.commandLine || "- No command prepared.",
    "",
    "Safety boundary:",
    "- This validation does not interpret a placeholder as teacher evidence.",
    "- It blocks spatial target confirmation until a passed parametric/detail-logic receipt validation proves the teacher reviewed every consequential detail logic row.",
    "- It does not run spatial target confirmation, execute software, capture screenshots, write memory, enable rules, accept technology, or unlock packaging."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate teacher-exported transparent sketch packet receipt.");
const requestInput = readJsonInput(
  argValue("--request", argValue("--spatial-intent-evidence-request", "")),
  "--request",
  "transparent_ai_spatial_intent_evidence_request_v1"
);
if (!requestInput.value) throw new Error("--request is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_spatial_intent_evidence_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "spatial-intent-evidence-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const request = requestInput.value;
const receipt = receiptInput.value;
const forbidden = new Set(["accepted", "execute_now", "enable_memory", "claim_complete", "unlock_packaging", "native_universal_execution"]);
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisionUsed = forbidden.has(decision);
const evidenceReviewed = receipt.evidenceReviewed === true;
const overlayPacketPath = resolve(String(receipt.teacherExportedOverlayPacketPath || ""));
const placeholder = request.teacherExportedOverlayPacketPlaceholder || "<teacher-exported-transparent-sketch-packet.json>";
const placeholderUsed =
  !receipt.teacherExportedOverlayPacketPath ||
  String(receipt.teacherExportedOverlayPacketPath).includes(placeholder) ||
  String(receipt.teacherExportedOverlayPacketPath).includes("<teacher-exported-transparent-sketch-packet.json>");
const overlayPacketExists = !placeholderUsed && existsSync(overlayPacketPath);
const overlayPacket = overlayPacketExists ? readJson(overlayPacketPath) : null;
const expectedOverlayPacketFormat = request.expectedPacketFormat || DEFAULT_EXPECTED_OVERLAY_PACKET_FORMAT;
const overlayPacketFormatOk = overlayPacket?.format === expectedOverlayPacketFormat;
const hasSpatialEvidence =
  Array.isArray(overlayPacket?.strokes) || Array.isArray(overlayPacket?.anchors) || Boolean(overlayPacket?.spatialIntent);
const spatialEvidence = spatialEvidenceSummary(overlayPacket);
const detailLogicReviewed = receipt.detailLogicReviewed === true;
const detailLogicInput = resolveOptionalPath(receipt.universalDetailLogicContractPath);
const detailLogic = detailLogicInput.exists ? detailLogicSummary(detailLogicInput.value) : detailLogicSummary(null);
const detailLogicValidationInput = resolveOptionalPath(receipt.universalDetailLogicReceiptValidationPath);
const detailLogicValidation = detailLogicValidationInput.exists
  ? detailLogicValidationSummary(detailLogicValidationInput.value)
  : detailLogicValidationSummary(null);
const canPrepareSpatialConfirmation =
  decision === "teacher_reviewed_prepare_spatial_confirmation" &&
  evidenceReviewed &&
  detailLogicReviewed &&
  !forbiddenDecisionUsed &&
  !placeholderUsed &&
  overlayPacketExists &&
  overlayPacketFormatOk &&
  hasSpatialEvidence &&
  spatialEvidence.ready &&
  !detailLogicInput.placeholderUsed &&
  detailLogicInput.exists &&
  detailLogic.ready &&
  !detailLogicValidationInput.placeholderUsed &&
  detailLogicValidationInput.exists &&
  detailLogicValidation.ready;
const commandLine = canPrepareSpatialConfirmation
  ? withOverlayPacket(request.spatialTargetConfirmationCommandTemplate, overlayPacketPath)
  : "";

const validationRow = {
  receiptDecision: receipt.teacherDecision || "",
  normalizedDecision: decision,
  evidenceReviewed,
  teacherExportedOverlayPacketPath: receipt.teacherExportedOverlayPacketPath || "",
  placeholderUsed,
  overlayPacketExists,
  overlayPacketFormat: overlayPacket?.format || "",
  overlayPacketFormatOk,
  hasSpatialEvidence,
  spatialEvidence,
  detailLogicReviewed,
  universalDetailLogicContractPath: receipt.universalDetailLogicContractPath || "",
  detailLogicPlaceholderUsed: detailLogicInput.placeholderUsed,
  detailLogicContractExists: detailLogicInput.exists,
  detailLogicContractFormat: detailLogic.contractFormat,
  detailLogicTotalDetails: detailLogic.totalDetails,
  detailLogicMissingSourceCount: detailLogic.missingLogicSource,
  detailLogicReadyForAction: detailLogic.ready,
  detailLogicHasPositionRelationLogic: detailLogic.hasPositionRelationLogic,
  detailLogicHasAngularOrDirectionLogic: detailLogic.hasAngularOrDirectionLogic,
  detailLogicHasDepthPerspectiveLogic: detailLogic.hasDepthPerspectiveLogic,
  universalDetailLogicReceiptValidationPath: receipt.universalDetailLogicReceiptValidationPath || "",
  detailLogicValidationPlaceholderUsed: detailLogicValidationInput.placeholderUsed,
  detailLogicValidationExists: detailLogicValidationInput.exists,
  detailLogicValidationFormat: detailLogicValidation.validationFormat,
  detailLogicValidationStatus: detailLogicValidation.validationStatus,
  detailLogicValidationDecision: detailLogicValidation.validationDecision,
  detailLogicValidationBlockedRows: detailLogicValidation.blockedRows,
  detailLogicValidationReadyForAction: detailLogicValidation.ready,
  status: forbiddenDecisionUsed
    ? "blocked_for_forbidden_decision"
    : placeholderUsed
      ? "blocked_placeholder_is_not_teacher_evidence"
      : !overlayPacketExists
        ? "blocked_missing_teacher_exported_overlay_packet"
        : !overlayPacketFormatOk
          ? "blocked_wrong_overlay_packet_format"
          : !hasSpatialEvidence
            ? "blocked_missing_spatial_evidence"
            : !spatialEvidence.ready
              ? `blocked_missing_spatial_dimensions_${spatialEvidence.missingDimensions.join("_") || "unknown"}`
            : !detailLogicReviewed
              ? "blocked_missing_universal_detail_logic_review"
              : detailLogicInput.placeholderUsed || !detailLogicInput.exists
                ? "blocked_missing_universal_detail_logic_contract"
                : !detailLogic.ready
                  ? "blocked_universal_detail_logic_not_complete"
                  : detailLogicValidationInput.placeholderUsed || !detailLogicValidationInput.exists
                    ? "blocked_missing_universal_detail_logic_receipt_validation"
                    : !detailLogicValidation.ready
                      ? "blocked_universal_detail_logic_receipt_validation_not_ready"
                      : canPrepareSpatialConfirmation
                        ? "ready_for_spatial_target_confirmation_review_command"
                        : "needs_teacher_review_or_evidence",
  canPrepareSpatialConfirmation
};
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : canPrepareSpatialConfirmation
    ? "ready_for_reviewed_spatial_target_confirmation"
    : validationRow.status;
const status = forbiddenDecisionUsed || validationRow.status.startsWith("blocked_")
  ? "blocked"
  : canPrepareSpatialConfirmation
    ? "validated_with_ready_spatial_target_confirmation"
    : "waiting_for_teacher_spatial_intent_evidence_review";
const validationPath = join(validationDir, "spatial-intent-evidence-receipt-validation.json");
const receiptPath = join(validationDir, "spatial-intent-evidence-receipt-validation-receipt.json");
const readmePath = join(validationDir, "SPATIAL_INTENT_EVIDENCE_RECEIPT_VALIDATION_START_HERE.md");
const nextReviewCommand = canPrepareSpatialConfirmation
  ? {
      tool: "create_spatial_target_confirmation_kit",
      arguments: {
        overlayPacket: overlayPacketPath,
        createActionKit: true,
        executeNow: false
      },
      commandLine,
      executesNow: false,
      blockedUntil: "teacher confirms one numbered spatial target after reviewing the generated confirmation packet"
    }
  : null;
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  validationDoesNotRunSpatialTargetConfirmation: true,
  validationDoesNotInterpretPlaceholder: true,
  spatialTargetConfirmationInvoked: false,
  targetSoftwareCommandsExecuted: false,
  softwareActionsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  goalComplete: false
};
const validation = {
  ok: true,
  format: "transparent_ai_spatial_intent_evidence_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed,
  validationRow,
  nextReviewCommand,
  blockedTransitions: [
    "run_spatial_target_confirmation_from_validation",
    "prepare_spatial_confirmation_without_universal_detail_logic_review",
    "prepare_spatial_confirmation_without_passed_detail_logic_receipt_validation",
    "override_missing_detail_logic_with_visual_similarity",
    "execute_target_software_from_validation",
    "capture_screenshot_from_validation",
    "write_memory_from_validation",
    "enable_rule_from_validation",
    "unlock_packaging_from_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceRequest: requestInput.path,
    sourceReceipt: receiptInput.path,
    teacherExportedOverlayPacket: overlayPacketExists ? overlayPacketPath : "",
    universalDetailLogicContract: detailLogicInput.exists ? detailLogicInput.path : "",
    universalDetailLogicReceiptValidation: detailLogicValidationInput.exists ? detailLogicValidationInput.path : ""
  },
  locks
};
const validationReceipt = {
  format: "transparent_ai_spatial_intent_evidence_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  forbiddenDecisionUsed,
  readyForSpatialTargetConfirmation: canPrepareSpatialConfirmation,
  nextReviewCommand: nextReviewCommand?.commandLine || "",
  locks
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_intent_evidence_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      validationPath,
      receiptPath,
      readmePath,
      nextReviewCommand,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
