#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function boolArg(name, fallback = false) {
  const value = argValue(name, "");
  if (!value) return fallback;
  return ["1", "true", "yes", "y"].includes(String(value).toLowerCase());
}

function slugify(value) {
  return (
    String(value || "spatial-first-blocker-overlay-resolution")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "spatial-first-blocker-overlay-resolution"
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
  if (!parsed) throw new Error(`${label} must be a JSON path or inline JSON object`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function q(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
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
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    resolverDoesNotRunSpatialTargetConfirmation: true,
    resolverDoesNotExecuteSoftware: true,
    resolverDoesNotCaptureScreenshots: true,
    resolverDoesNotReadFullLogs: true,
    resolverDoesNotWriteMemory: true,
    resolverDoesNotEnableRules: true,
    resolverDoesNotClaimCompletion: true,
    spatialTargetConfirmationInvoked: false,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    screenshotsCaptured: false,
    fullLogContentsRead: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function runNodeScript(script, args) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) {
    throw new Error(`${script} failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function writeReadme(path, packet) {
  const lines = [
    "# Spatial First Blocker Overlay Resolution",
    "",
    `Status: ${packet.status}`,
    `Overlay validation: ${packet.paths.overlayValidation || ""}`,
    `Prefilled receipt draft: ${packet.paths.prefilledReceipt || ""}`,
    `Receipt validation: ${packet.paths.receiptValidation || ""}`,
    "",
    "This packet resolves only the first teacher-exported-overlay blocker as far as the provided evidence allows.",
    "It validates the teacher-exported transparent sketch packet, pre-fills the spatial intent evidence receipt, and optionally validates that receipt when the required request is available.",
    "",
    "It does not infer teacher approval from a drawing, run spatial target confirmation, execute target software, capture screenshots, read full logs, write memory, enable rules, unlock packaging, or claim the original goal complete.",
    "",
    "Next actions:",
    ...packet.nextTeacherActions.map((item) => `- ${item.id}: ${item.action}`),
    "",
    "Locks:",
    ...Object.entries(packet.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  const actions = packet.nextTeacherActions
    .map(
      (item) => `<tr>
        <td><code>${htmlEscape(item.id)}</code></td>
        <td>${htmlEscape(item.action)}</td>
        <td><a href="${htmlEscape(fileHref(item.evidencePath))}">${htmlEscape(item.evidencePath || "")}</a></td>
      </tr>`
    )
    .join("");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Spatial First Blocker Overlay Resolution</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: 0; }
    section { background: #fff; border: 1px solid #dbe4ef; border-radius: 8px; padding: 15px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e4edf5; text-align: left; padding: 7px; vertical-align: top; }
    code { background: #eef3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Spatial First Blocker Overlay Resolution</h1>
  <section>
    <p><strong>Status:</strong> <code>${htmlEscape(packet.status)}</code></p>
    <p><strong>Overlay packet:</strong> <a href="${htmlEscape(fileHref(packet.paths.overlayPacket))}">${htmlEscape(packet.paths.overlayPacket)}</a></p>
    <p><strong>Receipt decision:</strong> <code>${htmlEscape(packet.prefilledReceipt.teacherDecision)}</code></p>
    <p>This is a review-only bridge from teacher-exported transparent sketch evidence to spatial intent receipt validation. It does not execute software.</p>
  </section>
  <section>
    <h2>Next Teacher Actions</h2>
    <table><thead><tr><th>ID</th><th>Action</th><th>Evidence</th></tr></thead><tbody>${actions}</tbody></table>
  </section>
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

const refreshInput = readJsonInput(
  argValue("--refresh", argValue("--current-status-refresh", "")),
  "--refresh",
  "transparent_ai_original_goal_current_status_refresh_v1"
);
const requestInput = readJsonInput(
  argValue("--request", argValue("--spatial-intent-evidence-request", refreshInput.value?.paths?.spatialIntentEvidenceRequest || "")),
  "--request",
  "transparent_ai_spatial_intent_evidence_request_v1"
);
const overlayInput = readJsonInput(
  argValue("--overlay-packet", argValue("--teacher-exported-overlay-packet", "")),
  "--overlay-packet",
  "transparent_ai_sketch_overlay_packet_v1"
);
if (!overlayInput.value) throw new Error("--overlay-packet is required");

const goal =
  argValue("--goal", refreshInput.value?.goal || requestInput.value?.goal || "Resolve teacher-exported overlay first blocker.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "spatial-first-blocker-overlay-resolutions"))
);
mkdirSync(outputRoot, { recursive: true });
const resolutionId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const dir = join(outputRoot, resolutionId);
mkdirSync(dir, { recursive: true });

const teacherReviewedSpatialIntent = boolArg("--teacher-reviewed-spatial-intent", false);
const detailLogicContractInput = readJsonInput(
  argValue("--detail-logic-contract", argValue("--universal-detail-logic-contract", "")),
  "--detail-logic-contract"
);
const detailLogicValidationInput = readJsonInput(
  argValue("--detail-logic-validation", argValue("--universal-detail-logic-receipt-validation", "")),
  "--detail-logic-validation"
);
const overlayValidationResult = runNodeScript("validate-transparent-sketch-overlay-packet.mjs", [
  "--overlay-packet",
  overlayInput.path || JSON.stringify(overlayInput.value),
  "--output-dir",
  join(dir, "overlay-packet-validation")
]);

const prefilledReceiptPath = join(dir, "teacher-spatial-intent-evidence-receipt-prefill.json");
const prefilledReceipt = {
  format: "transparent_ai_spatial_intent_evidence_receipt_v1",
  resolutionId,
  sourceRefresh: refreshInput.path,
  sourceRequest: requestInput.path,
  teacherDecision: teacherReviewedSpatialIntent
    ? "teacher_reviewed_prepare_spatial_confirmation"
    : "needs_teacher_review",
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
  evidenceReviewed: teacherReviewedSpatialIntent,
  teacherExportedOverlayPacketPath: overlayInput.path || "",
  detailLogicReviewed: Boolean(teacherReviewedSpatialIntent && detailLogicContractInput.path && detailLogicValidationInput.path),
  universalDetailLogicContractPath:
    detailLogicContractInput.path || "<teacher-reviewed-universal-detail-logic-contract-or-kit.json>",
  universalDetailLogicReceiptValidationPath:
    detailLogicValidationInput.path || "<passed-parametric-drawing-logic-receipt-validation.json>",
  teacherNote: teacherReviewedSpatialIntent
    ? "Teacher explicitly reviewed the spatial intent and supplied detail-logic evidence."
    : "Draft only: teacher still needs to review the overlay evidence, detail logic, and receipt decision.",
  locks: locks()
};
writeFileSync(prefilledReceiptPath, `${JSON.stringify(prefilledReceipt, null, 2)}\n`, "utf8");

let receiptValidationResult = null;
if (requestInput.value) {
  receiptValidationResult = runNodeScript("validate-spatial-intent-evidence-receipt.mjs", [
    "--request",
    requestInput.path,
    "--receipt",
    prefilledReceiptPath,
    "--output-dir",
    join(dir, "spatial-intent-evidence-receipt-validation")
  ]);
}

const receiptValidation = receiptValidationResult?.validationPath ? readJson(receiptValidationResult.validationPath) : null;
const readyForNextSpatialConfirmation =
  receiptValidation?.validationDecision === "ready_for_reviewed_spatial_target_confirmation" &&
  receiptValidation?.nextReviewCommand?.executesNow === false;
const status = readyForNextSpatialConfirmation
  ? "ready_for_numbered_spatial_target_confirmation_command_review"
  : receiptValidation
    ? "waiting_for_teacher_receipt_review_or_detail_logic_evidence"
    : overlayValidationResult.readyForSpatialIntentEvidenceReceipt
      ? "overlay_packet_validated_waiting_for_spatial_intent_request"
      : "waiting_for_teacher_overlay_packet_correction";
const nextTeacherActions = [
  overlayValidationResult.readyForSpatialIntentEvidenceReceipt
    ? {
        id: "review_prefilled_spatial_intent_receipt",
        action: "Teacher reviews the prefilled receipt, supplies explicit decision and detail-logic evidence, then reruns this resolver or the receipt validation command.",
        evidencePath: prefilledReceiptPath
      }
    : {
        id: "fix_teacher_exported_overlay_packet",
        action: "Teacher updates the transparent sketch overlay packet until it contains 2D position, angle or direction, perspective relation, 3D depth, and complete detail logic rows.",
        evidencePath: overlayValidationResult.validationPath
      },
  readyForNextSpatialConfirmation
    ? {
        id: "review_numbered_spatial_target_confirmation_command",
        action: "Teacher reviews the prepared command, then separately generates numbered spatial target confirmation. This resolver has not run it.",
        evidencePath: receiptValidation.nextReviewCommand.commandLine
      }
    : {
        id: "keep_spatial_execution_blocked",
        action: "Do not run spatial target confirmation or target software until receipt validation reports ready_for_reviewed_spatial_target_confirmation.",
        evidencePath: receiptValidationResult?.validationPath || overlayValidationResult.validationPath
      }
].filter(Boolean);

const resolutionPath = join(dir, "spatial-first-blocker-overlay-resolution.json");
const htmlPath = join(dir, "spatial-first-blocker-overlay-resolution.html");
const readmePath = join(dir, "SPATIAL_FIRST_BLOCKER_OVERLAY_RESOLUTION_START_HERE.md");
const lockState = locks();
const resolution = {
  ok: true,
  format: "transparent_ai_spatial_first_blocker_overlay_resolution_v1",
  resolutionId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  readyForNextSpatialConfirmation,
  overlayValidationStatus: overlayValidationResult.status,
  overlayReadyForReceipt: overlayValidationResult.readyForSpatialIntentEvidenceReceipt,
  receiptValidationStatus: receiptValidation?.status || "",
  receiptValidationDecision: receiptValidation?.validationDecision || "",
  prefilledReceipt,
  nextTeacherActions,
  blockedActions: [
    "infer_teacher_approval_from_overlay_packet",
    "run_spatial_target_confirmation_from_resolver",
    "execute_target_software_from_resolver",
    "capture_screenshot_from_resolver",
    "read_full_logs_from_resolver",
    "write_memory_from_resolver",
    "enable_rule_from_resolver",
    "claim_original_goal_complete_from_resolver"
  ],
  paths: {
    resolution: resolutionPath,
    html: htmlPath,
    readme: readmePath,
    refresh: refreshInput.path,
    request: requestInput.path,
    overlayPacket: overlayInput.path,
    overlayValidation: overlayValidationResult.validationPath,
    overlayValidationHtml: overlayValidationResult.htmlPath,
    prefilledReceipt: prefilledReceiptPath,
    receiptValidation: receiptValidationResult?.validationPath || "",
    receiptValidationReceipt: receiptValidationResult?.receiptPath || ""
  },
  locks: lockState,
  goalComplete: false
};
writeFileSync(resolutionPath, `${JSON.stringify(resolution, null, 2)}\n`, "utf8");
writeHtml(htmlPath, resolution);
writeReadme(readmePath, resolution);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_first_blocker_overlay_resolution_result_v1",
      status,
      resolutionPath,
      htmlPath,
      readmePath,
      readyForNextSpatialConfirmation,
      overlayReadyForReceipt: resolution.overlayReadyForReceipt,
      receiptValidationDecision: resolution.receiptValidationDecision,
      locks: lockState
    },
    null,
    2
  )
);
