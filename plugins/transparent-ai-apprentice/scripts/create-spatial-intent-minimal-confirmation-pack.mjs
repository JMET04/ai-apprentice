#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "spatial-intent-minimal-confirmation-pack")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "spatial-intent-minimal-confirmation-pack"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  if (!existsSync(text)) throw new Error(`${label} file does not exist: ${text}`);
  const path = resolve(text);
  const value = readJson(path);
  if (expectedFormat && value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return { value, path };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function locks() {
  return {
    reviewOnly: true,
    minimalConfirmationOnly: true,
    teacherMustExportRealOverlayPacket: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packDoesNotValidateReceipt: true,
    packDoesNotRunTargetConfirmation: true,
    packDoesNotRunRouteBridge: true,
    packDoesNotCaptureScreenshots: true,
    packDoesNotExecuteSoftware: true,
    packDoesNotSendUiEvents: true,
    packDoesNotWriteMemory: true,
    spatialTargetConfirmationInvoked: false,
    routeBridgeInvoked: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    formalSpatialIntentEvidencePresent: false,
    goalComplete: false
  };
}

function rowKind(row = {}) {
  const text = `${row.requirementId || ""} ${row.requirement || ""} ${row.evidence || ""}`.toLowerCase();
  if (
    (text.includes("2d") || text.includes("position")) &&
    text.includes("perspective") &&
    (text.includes("3d") || text.includes("depth"))
  ) {
    return "2d_perspective_3d_depth";
  }
  if (text.includes("2d") || text.includes("position")) return "2d_position";
  if (text.includes("perspective")) return "perspective_relation";
  if (text.includes("3d") || text.includes("depth")) return "3d_depth";
  if (text.includes("number")) return "numbered_target";
  if (text.includes("logic")) return "detail_logic";
  if (text.includes("never") || text.includes("execute")) return "safety_lock";
  return "general_review";
}

function rowDimensions(kind) {
  if (kind === "2d_perspective_3d_depth") return ["2d_position", "perspective_relation", "3d_depth"];
  if (["2d_position", "perspective_relation", "3d_depth"].includes(kind)) return [kind];
  return [];
}

function readLatestRefreshPath(root) {
  const refreshRoot = join(root, ".transparent-apprentice", "original-goal-current-status-refreshes");
  if (!existsSync(refreshRoot)) return "";
  const candidates = [];
  for (const entry of readdirSafe(refreshRoot)) {
    const path = join(refreshRoot, entry, "original-goal-current-status-refresh.json");
    if (existsSync(path)) candidates.push({ path, mtimeMs: statMtime(path) });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.path || "";
}

function readdirSafe(path) {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function statMtime(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function writeHtml(path, pack) {
  const rows = pack.confirmationRows
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.order)}</td>
        <td>${htmlEscape(row.kind)}</td>
        <td>${htmlEscape(row.requirement)}</td>
        <td>${htmlEscape(row.teacherQuestion)}</td>
        <td><code>${htmlEscape(row.evidence)}</code></td>
        <td>${htmlEscape(row.requiredTeacherInput)}</td>
      </tr>`
    )
    .join("\n");
  const links = pack.evidenceLinks
    .map((link) =>
      link.exists
        ? `<li><a href="${htmlEscape(fileHref(link.path))}">${htmlEscape(link.label || basename(link.path))}</a></li>`
        : `<li><code>${htmlEscape(link.label)}: ${htmlEscape(link.path)}</code></li>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Spatial Intent Minimal Confirmation Pack</title>
  <style>
    :root { color: #17202a; background: #f7f9fc; font: 14px/1.45 "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1220px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 27px; letter-spacing: 0; }
    .summary, table { background: #fff; border: 1px solid #dbe4ef; border-radius: 8px; }
    .summary { padding: 15px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { border-bottom: 1px solid #e3eaf3; padding: 9px; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #edf4f8; }
    code { display: inline-block; max-width: 100%; background: #eef3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Spatial Intent Minimal Confirmation Pack</h1>
  <section class="summary">
    <p><strong>Status:</strong> ${htmlEscape(pack.status)}</p>
    <p><strong>Decision:</strong> ${htmlEscape(pack.decision)}</p>
    <p><strong>Rows:</strong> ${htmlEscape(pack.counts.confirmationRows)}</p>
    <p>This pack reduces the transparent-sketch review to the smallest teacher confirmation set. It does not validate receipts, run target confirmation, bridge routes, capture screenshots, execute software, send UI events, write memory, enable rules, accept technology, unlock packaging, or claim completion.</p>
    <ul>${links}</ul>
  </section>
  <table>
    <thead><tr><th>#</th><th>Kind</th><th>Requirement</th><th>Teacher Question</th><th>Evidence</th><th>Required Teacher Input</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, pack) {
  const lines = [
    "# Spatial Intent Minimal Confirmation Pack",
    "",
    `Status: ${pack.status}`,
    `Decision: ${pack.decision}`,
    `Rows: ${pack.counts.confirmationRows}`,
    "",
    "Use this pack to review only the minimum teacher confirmations still missing for transparent sketch 2D, perspective, and 3D depth intent.",
    "",
    "Rows:",
    ...pack.confirmationRows.map((row) => `- ${row.order}. ${row.kind}: ${row.requiredTeacherInput}`),
    "",
    "Locks:",
    ...Object.entries(pack.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const refreshPath = argValue("--refresh", "") || readLatestRefreshPath(process.cwd());
const refreshInput = refreshPath ? readJsonInput(refreshPath, "--refresh", "transparent_ai_original_goal_current_status_refresh_v1") : { value: null, path: "" };
const refresh = refreshInput.value || {};
const paths = refresh.paths || {};
const rehearsalInput = readJsonInput(
  argValue("--rehearsal", paths.transparentSketchDepthDemonstrationRehearsal || ""),
  "--rehearsal",
  "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1"
);
const builderInput = readJsonInput(
  argValue("--builder", paths.transparentSketchDepthRehearsalReviewReceiptBuilder || ""),
  "--builder",
  "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_builder_v1"
);
const requestInput = readJsonInput(
  argValue("--spatial-request", paths.spatialIntentEvidenceRequest || ""),
  "--spatial-request",
  "transparent_ai_spatial_intent_evidence_request_v1"
);
const spatialTemplateInput = readJsonInput(
  argValue("--spatial-receipt-template", paths.spatialIntentEvidenceReceiptTemplate || ""),
  "--spatial-receipt-template",
  "transparent_ai_spatial_intent_evidence_receipt_v1"
);

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), "artifacts", "spatial-intent-minimal-confirmation-packs"))
);
const goal = argValue("--goal", refresh.goal || rehearsalInput.value.goal || "Spatial intent minimal confirmation pack.");
const packId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const dir = join(outputRoot, packId);
mkdirSync(dir, { recursive: true });

const reviewRows = Array.isArray(builderInput.value.reviewRows) ? builderInput.value.reviewRows : [];
const confirmationRows = reviewRows.map((row, index) => {
  const kind = rowKind(row);
  return {
    order: index + 1,
    kind,
    requirementId: row.requirementId || "",
    requirement: row.requirement || "",
    rehearsalPass: row.rehearsalPass === true,
    evidence: row.evidence || "",
    teacherQuestion: row.teacherQuestion || "",
    dimensionsCovered: rowDimensions(kind),
    requiredTeacherInput:
      kind === "2d_perspective_3d_depth"
        ? "Confirm the sketch identifies the intended 2D target, perspective relation, and 3D depth direction."
        : kind === "2d_position"
        ? "Confirm the sketch identifies the intended 2D target position."
        : kind === "perspective_relation"
          ? "Confirm the sketch encodes the intended perspective relationship."
          : kind === "3d_depth"
            ? "Confirm near/far or depth direction is correct."
            : kind === "numbered_target"
              ? "Confirm exactly one numbered target before any route review."
              : kind === "detail_logic"
                ? "Confirm consequential details are logicized and not merely visually similar."
                : kind === "safety_lock"
                  ? "Confirm no screenshots, software execution, UI events, memory, rules, packaging, or completion are unlocked."
                  : "Confirm or request correction.",
    allowedTeacherDecisions: row.allowedTeacherDecisions || [],
    blockedTeacherDecisions: row.blockedTeacherDecisions || []
  };
});

const lockState = locks();
const packetPath = join(dir, "spatial-intent-minimal-confirmation-pack.json");
const htmlPath = join(dir, "spatial-intent-minimal-confirmation-pack.html");
const readmePath = join(dir, "SPATIAL_INTENT_MINIMAL_CONFIRMATION_PACK_START_HERE.md");
const rehearsalPatchPath = join(dir, "teacher-transparent-sketch-depth-review-minimal-patch-template.json");
const spatialReceiptPatchPath = join(dir, "teacher-spatial-intent-evidence-minimal-receipt-patch-template.json");
const realOverlayRequired = true;
const missingFormalEvidence =
  refresh.refreshedEvidence?.formalSpatialIntentEvidencePresent !== true ||
  refresh.refreshedEvidence?.rawSpatialIntentPacketPresent !== true;

const pack = {
  ok: true,
  format: "transparent_ai_spatial_intent_minimal_confirmation_pack_v1",
  packId,
  createdAt: new Date().toISOString(),
  goal,
  status: missingFormalEvidence
    ? "waiting_for_teacher_minimal_spatial_confirmation_and_real_overlay_export"
    : "formal_spatial_intent_evidence_already_present",
  decision: "review_only_not_formal_spatial_evidence",
  sourceEvidence: {
    refresh: refreshInput.path,
    rehearsal: rehearsalInput.path,
    builder: builderInput.path,
    spatialRequest: requestInput.path,
    spatialReceiptTemplate: spatialTemplateInput.path,
    rehearsalHtml: rehearsalInput.value.paths?.html || "",
    transparentSketchOverlayPath: requestInput.value.transparentSketchOverlayPath || ""
  },
  counts: {
    confirmationRows: confirmationRows.length,
    passedRehearsalRows: confirmationRows.filter((row) => row.rehearsalPass).length,
    twoDRows: confirmationRows.filter((row) => row.dimensionsCovered.includes("2d_position")).length,
    perspectiveRows: confirmationRows.filter((row) => row.dimensionsCovered.includes("perspective_relation")).length,
    depthRows: confirmationRows.filter((row) => row.dimensionsCovered.includes("3d_depth")).length,
    numberedTargetRows: confirmationRows.filter((row) => row.kind === "numbered_target").length
  },
  capabilitySnapshot: {
    transparentSketch2DPerspective3DImplemented:
      refresh.refreshedEvidence?.transparentSketch2DPerspective3DImplemented === true ||
      rehearsalInput.value.capabilitiesRehearsed?.teacher3DDepthSketchUnderstood === true,
    formalSpatialIntentEvidencePresent: refresh.refreshedEvidence?.formalSpatialIntentEvidencePresent === true,
    rawSpatialIntentPacketPresent: refresh.refreshedEvidence?.rawSpatialIntentPacketPresent === true,
    selectedNumber: rehearsalInput.value.selectedNumber || 0,
    teacherConfirmedNumber: rehearsalInput.value.teacherConfirmedNumber === true,
    realOverlayRequired
  },
  confirmationRows,
  teacherWorkflow: [
    "Open the transparent sketch overlay or rehearsal HTML.",
    "Confirm or correct the 2D position, perspective relation, 3D depth, detail-logic, and numbered-target rows.",
    "Export a real teacher overlay packet from the overlay; do not use sample packet paths as formal evidence.",
    "Fill the spatial intent evidence receipt with the real packet path and reviewed detail-logic validation.",
    "Run validate-spatial-intent-evidence-receipt.mjs before any target confirmation kit is generated."
  ],
  evidenceLinks: [
    { label: "rehearsal", path: rehearsalInput.path, exists: existsSync(rehearsalInput.path) },
    { label: "rehearsal html", path: rehearsalInput.value.paths?.html || "", exists: existsSync(rehearsalInput.value.paths?.html || "") },
    { label: "receipt builder", path: builderInput.path, exists: existsSync(builderInput.path) },
    { label: "spatial request", path: requestInput.path, exists: existsSync(requestInput.path) },
    {
      label: "transparent sketch overlay",
      path: requestInput.value.transparentSketchOverlayPath || "",
      exists: existsSync(requestInput.value.transparentSketchOverlayPath || "")
    }
  ],
  nextValidationCommand: requestInput.value
    ? `node plugins\\transparent-ai-apprentice\\scripts\\validate-spatial-intent-evidence-receipt.mjs --request "${requestInput.path}" --receipt "<teacher-filled-spatial-intent-evidence-receipt.json>" --output-dir "${join(dir, "spatial-intent-evidence-receipt-validation")}"`
    : "",
  blockedClaims: [
    "claim_formal_spatial_intent_evidence_from_minimal_confirmation_pack",
    "claim_depth_rehearsal_accepted_from_minimal_confirmation_pack",
    "run_spatial_target_confirmation_from_minimal_confirmation_pack",
    "execute_target_software_from_minimal_confirmation_pack",
    "write_memory_from_minimal_confirmation_pack",
    "claim_goal_complete_from_minimal_confirmation_pack"
  ],
  paths: {
    packet: packetPath,
    html: htmlPath,
    readme: readmePath,
    rehearsalPatchTemplate: rehearsalPatchPath,
    spatialReceiptPatchTemplate: spatialReceiptPatchPath
  },
  locks: lockState
};

const rehearsalPatch = {
  format: "transparent_ai_spatial_intent_minimal_confirmation_rehearsal_patch_v1",
  patchOnly: true,
  sourceBuilder: builderInput.path,
  sourceRehearsal: rehearsalInput.path,
  rowDecisions: confirmationRows.map((row) => ({
    rowNumber: row.order,
    requirementId: row.requirementId,
    teacherDecision: "needs_teacher_review",
    evidenceReviewed: false,
    correctionRequest: "",
    teacherNote: ""
  })),
  locks: lockState
};

const spatialReceiptPatch = {
  ...spatialTemplateInput.value,
  format: "transparent_ai_spatial_intent_evidence_receipt_v1",
  patchOnly: true,
  teacherDecision: "needs_teacher_review",
  evidenceReviewed: false,
  teacherExportedOverlayPacketPath: "<teacher-exported-transparent-sketch-packet.json>",
  detailLogicReviewed: false,
  universalDetailLogicContractPath: "<teacher-reviewed-universal-detail-logic-contract-or-kit.json>",
  universalDetailLogicReceiptValidationPath: "<passed-parametric-drawing-logic-receipt-validation.json>",
  teacherNote: "Fill only after exporting a real overlay packet and reviewing detail logic.",
  locks: lockState
};

writeFileSync(packetPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
writeFileSync(rehearsalPatchPath, `${JSON.stringify(rehearsalPatch, null, 2)}\n`, "utf8");
writeFileSync(spatialReceiptPatchPath, `${JSON.stringify(spatialReceiptPatch, null, 2)}\n`, "utf8");
writeHtml(htmlPath, pack);
writeReadme(readmePath, pack);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_intent_minimal_confirmation_pack_result_v1",
      status: pack.status,
      packetPath,
      htmlPath,
      readmePath,
      rehearsalPatchPath,
      spatialReceiptPatchPath,
      counts: pack.counts,
      locks: lockState,
      goalComplete: false
    },
    null,
    2
  )
);
