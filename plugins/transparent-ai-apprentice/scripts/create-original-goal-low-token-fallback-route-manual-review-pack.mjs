#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "low-token-fallback-route-manual-review-pack")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "low-token-fallback-route-manual-review-pack"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
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

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function locks() {
  return {
    reviewOnly: true,
    manualReviewOnly: true,
    patchOnly: true,
    teacherMustConfirm: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packDoesNotValidateReceipt: true,
    packDoesNotRunMetadataProbe: true,
    packDoesNotReadLogs: true,
    packDoesNotReadFullLogs: true,
    packDoesNotCaptureScreenshots: true,
    packDoesNotExecuteTargetSoftware: true,
    packDoesNotRegisterSchedule: true,
    packDoesNotWriteMemory: true,
    routeSelectionIsNotCoverage: true,
    metadataProbeInvoked: false,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function recommendedManualAction(row, packRow) {
  const candidates = Array.isArray(packRow?.candidateRoutes) ? packRow.candidateRoutes : [];
  const byId = new Map(candidates.map((route) => [route.routeId, route]));
  if (row.category === "remote_control_app") {
    return {
      recommendedDecision: "mark_out_of_scope_or_select_manual_marker",
      safestRouteId: byId.has("remote_control_security_boundary")
        ? "remote_control_security_boundary"
        : "teacher_exclusion_or_manual_marker",
      reason:
        "Remote-control software is high risk. Prefer teacher exclusion or an explicit manual marker before any observation.",
      mustReview: ["remote control risk", "no automatic observation", "no execution", "no schedule registration"]
    };
  }
  if (row.category === "chat_app") {
    return {
      recommendedDecision: "select_privacy_preserving_state_metadata_or_manual_marker",
      safestRouteId: byId.has("privacy_sensitive_chat_state_metadata")
        ? "privacy_sensitive_chat_state_metadata"
        : "teacher_exclusion_or_manual_marker",
      reason:
        "Chat software must avoid message, contact, attachment, and account content. Only app-state metadata or teacher markers are acceptable.",
      mustReview: ["privacy boundary", "no chat content", "no attachment content", "no account data"]
    };
  }
  return {
    recommendedDecision: "select_candidate_route_or_request_new_route",
    safestRouteId: candidates[0]?.routeId || "",
    reason: "This row was not ready in the batch draft, so it needs one-by-one teacher review.",
    mustReview: ["route exists", "no content read", "privacy boundary", "teacher note"]
  };
}

function writeHtml(path, packet) {
  const rows = packet.manualRows
    .map((row) => {
      const routes = row.candidateRoutes
        .map((route) => `<li><code>${htmlEscape(route.routeId)}</code>: ${htmlEscape(route.evidenceToReview || "")}</li>`)
        .join("");
      const routeOptions = [
        `<option value="">Select after review</option>`,
        ...row.candidateRoutes.map(
          (route) =>
            `<option value="${htmlEscape(route.routeId)}"${
              route.routeId === row.recommendation.safestRouteId ? " data-recommended=\"true\"" : ""
            }>${htmlEscape(route.routeId)}${route.routeId === row.recommendation.safestRouteId ? " (recommended)" : ""}</option>`
        )
      ].join("");
      return `<article class="row">
        <h2>${htmlEscape(row.software || row.rowId)}</h2>
        <p><strong>Row:</strong> <code>${htmlEscape(row.rowId)}</code> <strong>Category:</strong> <code>${htmlEscape(row.category)}</code></p>
        <p><strong>Status:</strong> <code>${htmlEscape(row.validationStatus)}</code></p>
        <p><strong>Recommended:</strong> ${htmlEscape(row.recommendation.recommendedDecision)} via <code>${htmlEscape(row.recommendation.safestRouteId)}</code></p>
        <p>${htmlEscape(row.recommendation.reason)}</p>
        <ul>${routes}</ul>
        <fieldset class="teacher-row" data-row-id="${htmlEscape(row.rowId)}">
          <legend>Teacher patch row</legend>
          <label>Decision
            <select class="decision">
              <option value="needs_teacher_review">needs teacher review</option>
              <option value="select_recommended_route_after_review">select recommended route after review</option>
              <option value="select_different_candidate_route_after_review">select different candidate route after review</option>
              <option value="mark_out_of_scope">mark out of scope</option>
              <option value="request_new_route">request new route</option>
            </select>
          </label>
          <label>Selected route
            <select class="selected-route">${routeOptions}</select>
          </label>
          <label><input class="route-reviewed" type="checkbox"> route evidence reviewed</label>
          <label><input class="privacy-reviewed" type="checkbox"> privacy boundary reviewed</label>
          <label><input class="no-content" type="checkbox"> no content read confirmed</label>
          <label>Review note
            <input class="route-note" value="Teacher must fill this row manually.">
          </label>
          <label>Reviewed evidence path or signal
            <input class="evidence-signal" placeholder="manual marker, reviewed source, or reason">
          </label>
        </fieldset>
      </article>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Low-Token Fallback Route Manual Review Pack</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 27px; letter-spacing: 0; }
    .summary, .row { background: #fff; border: 1px solid #dbe4ef; border-radius: 8px; padding: 15px; margin: 14px 0; }
    fieldset { border: 1px solid #d7e1ec; border-radius: 8px; margin-top: 14px; padding: 12px; }
    label { display: block; margin: 10px 0; }
    select, input, textarea { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 8px; border: 1px solid #b9c8d7; border-radius: 6px; font: inherit; }
    input[type="checkbox"] { width: auto; margin-right: 6px; }
    textarea { min-height: 260px; font: 13px Consolas, monospace; }
    button { margin: 8px 8px 0 0; padding: 8px 12px; border: 0; border-radius: 6px; background: #174d89; color: white; cursor: pointer; }
    code { background: #eef3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Low-Token Fallback Route Manual Review Pack</h1>
  <section class="summary">
    <p><strong>Status:</strong> ${htmlEscape(packet.status)}</p>
    <p><strong>Manual rows:</strong> ${htmlEscape(packet.counts.manualRows)} of ${htmlEscape(packet.counts.validationRows)}</p>
    <p><strong>Source validation:</strong> <a href="${htmlEscape(fileHref(packet.sourceEvidence.validation))}">${htmlEscape(packet.sourceEvidence.validation)}</a></p>
    <p>This pack is review-only and patch-only. It does not validate receipts, run metadata probes, read logs, capture screenshots, execute software, register schedules, write memory, accept coverage, or claim completion.</p>
  </section>
  ${rows}
  <section class="summary">
    <h2>Teacher Patch JSON</h2>
    <p>Generate the patch after reviewing each row. The default remains blocked until a teacher changes decisions and confirms the privacy checks.</p>
    <button id="buildPatch" type="button">Build patch JSON</button>
    <button id="copyPatch" type="button">Copy patch JSON</button>
    <textarea id="patchJson" spellcheck="false"></textarea>
  </section>
</main>
<script>
const patchTemplate = ${jsonForScript(packet.teacherPatchTemplate)};
function buildPatch() {
  const patch = JSON.parse(JSON.stringify(patchTemplate));
  const rowsById = new Map(patch.rows.map((row) => [row.rowId, row]));
  document.querySelectorAll(".teacher-row").forEach((element) => {
    const row = rowsById.get(element.dataset.rowId);
    if (!row) return;
    row.teacherDecision = element.querySelector(".decision").value;
    row.selectedRouteId = element.querySelector(".selected-route").value;
    row.routeEvidenceReviewed = element.querySelector(".route-reviewed").checked;
    row.privacyBoundaryReviewed = element.querySelector(".privacy-reviewed").checked;
    row.noContentReadConfirmed = element.querySelector(".no-content").checked;
    row.routeSelectionNote = element.querySelector(".route-note").value.trim();
    row.reviewedEvidencePathOrSignal = element.querySelector(".evidence-signal").value.trim();
  });
  document.getElementById("patchJson").value = JSON.stringify(patch, null, 2);
}
document.getElementById("buildPatch").addEventListener("click", buildPatch);
document.getElementById("copyPatch").addEventListener("click", async () => {
  buildPatch();
  const text = document.getElementById("patchJson").value;
  if (navigator.clipboard) await navigator.clipboard.writeText(text);
});
buildPatch();
</script>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, packet) {
  const lines = [
    "# Low-Token Fallback Route Manual Review Pack",
    "",
    `Status: ${packet.status}`,
    `Manual rows: ${packet.counts.manualRows}`,
    `Already ready rows in source validation: ${packet.counts.readyRows}`,
    "",
    "This pack narrows the fallback route review to only the rows that were not ready in the batch draft.",
    "",
    "Rows:",
    ...packet.manualRows.map(
      (row) => `- ${row.rowId} ${row.software}: ${row.recommendation.recommendedDecision} (${row.recommendation.safestRouteId})`
    ),
    "",
    "Locks:",
    ...Object.entries(packet.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const validationPath = resolve(argValue("--validation", ""));
if (!validationPath || !existsSync(validationPath)) {
  throw new Error(
    "Usage: node create-original-goal-low-token-fallback-route-manual-review-pack.mjs --validation <fallback-route-receipt-validation.json>"
  );
}
const validation = readJson(validationPath);
if (validation.format !== "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_validation_v1") {
  throw new Error("--validation must be transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_validation_v1");
}

const packPath = resolve(argValue("--pack", validation.sourceEvidence?.pack || ""));
const pack = packPath && existsSync(packPath) ? readJson(packPath) : null;
const packRowsById = new Map((pack?.rows || []).map((row) => [row.rowId, row]));
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), "artifacts", "low-token-fallback-route-manual-review-packs"))
);
const packageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(validation.validationId || "manual-review")}`;
const dir = join(outputRoot, packageId);
mkdirSync(dir, { recursive: true });

const manualRows = (validation.validationRows || [])
  .filter((row) => row.readyForFollowUp !== true)
  .map((row) => {
    const packRow = packRowsById.get(row.rowId) || {};
    const recommendation = recommendedManualAction(row, packRow);
    return {
      rowId: row.rowId,
      ledgerNumber: row.ledgerNumber || "",
      software: row.software || "",
      category: row.category || "",
      validationStatus: row.status || "",
      previousDecision: row.normalizedDecision || "",
      candidateRoutes: packRow.candidateRoutes || [],
      recommendation,
      receiptPatchRow: {
        rowId: row.rowId,
        software: row.software || "",
        category: row.category || "",
        recommendedDecision: recommendation.recommendedDecision,
        recommendedRouteId: recommendation.safestRouteId,
        allowedTeacherDecisions: [
          "needs_teacher_review",
          "select_recommended_route_after_review",
          "select_different_candidate_route_after_review",
          "mark_out_of_scope",
          "request_new_route"
        ],
        teacherDecision: "needs_teacher_review",
        selectedRouteId: "",
        routeEvidenceReviewed: false,
        privacyBoundaryReviewed: false,
        noContentReadConfirmed: false,
        teacherActionHint:
          "Review the recommended route and privacy boundary, then set teacherDecision and selectedRouteId only if you approve.",
        routeSelectionNote: "Teacher must fill this row manually.",
        reviewedEvidencePathOrSignal: ""
      }
    };
  });

const packetPath = join(dir, "low-token-fallback-route-manual-review-pack.json");
const htmlPath = join(dir, "low-token-fallback-route-manual-review-pack.html");
const readmePath = join(dir, "LOW_TOKEN_FALLBACK_ROUTE_MANUAL_REVIEW_PACK_START_HERE.md");
const patchPath = join(dir, "teacher-manual-route-review-patch-template.json");
const lockState = locks();
const packet = {
  ok: true,
  format: "transparent_ai_low_token_fallback_route_manual_review_pack_v1",
  packageId,
  createdAt: new Date().toISOString(),
  status: manualRows.length
    ? "waiting_for_teacher_manual_review_of_remaining_fallback_routes"
    : "no_manual_fallback_route_rows_remaining",
  sourceEvidence: {
    validation: validationPath,
    pack: packPath || "",
    validationHtml: validation.paths?.html || ""
  },
  counts: {
    validationRows: (validation.validationRows || []).length,
    readyRows: Number(validation.counts?.readyRows || 0),
    manualRows: manualRows.length,
    remoteControlRows: manualRows.filter((row) => row.category === "remote_control_app").length,
    chatRows: manualRows.filter((row) => row.category === "chat_app").length
  },
  manualRows,
  teacherPatchTemplate: {
    format: "transparent_ai_low_token_fallback_route_manual_review_patch_v1",
    patchOnly: true,
    teacherMustConfirm: true,
    sourceValidation: validationPath,
    instructions:
      "Do not treat recommendations as approval. Teacher must explicitly set teacherDecision, selectedRouteId, and review confirmations before any follow-up validation.",
    allowedTeacherDecisions: [
      "needs_teacher_review",
      "select_recommended_route_after_review",
      "select_different_candidate_route_after_review",
      "mark_out_of_scope",
      "request_new_route"
    ],
    rows: manualRows.map((row) => row.receiptPatchRow),
    blockedDecisions: [
      "accepted",
      "read_logs_now",
      "read_full_logs",
      "capture_screenshot_now",
      "execute_now",
      "register_monitor_now",
      "write_memory_now",
      "claim_all_software_coverage_complete",
      "claim_goal_complete"
    ],
    locks: lockState
  },
  blockedClaims: [
    "claim_all_software_low_token_coverage_complete_from_manual_review_pack",
    "validate_full_route_receipt_from_manual_review_pack",
    "run_metadata_probe_from_manual_review_pack",
    "read_logs_from_manual_review_pack",
    "execute_target_software_from_manual_review_pack",
    "write_memory_from_manual_review_pack",
    "claim_goal_complete_from_manual_review_pack"
  ],
  paths: {
    packet: packetPath,
    html: htmlPath,
    readme: readmePath,
    patchTemplate: patchPath
  },
  locks: lockState
};

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(patchPath, `${JSON.stringify(packet.teacherPatchTemplate, null, 2)}\n`, "utf8");
writeHtml(htmlPath, packet);
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_low_token_fallback_route_manual_review_pack_result_v1",
      status: packet.status,
      packetPath,
      htmlPath,
      readmePath,
      patchPath,
      counts: packet.counts,
      locks: lockState,
      goalComplete: false
    },
    null,
    2
  )
);
