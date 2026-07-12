#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "original-goal-low-token-fallback-route-shortlist")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "original-goal-low-token-fallback-route-shortlist"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return `file:///${String(path).replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
}

function locks() {
  return {
    reviewOnly: true,
    recommendationOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    shortlistDoesNotSelectRoutes: true,
    shortlistDoesNotRunMetadataProbe: true,
    shortlistDoesNotReadLogs: true,
    shortlistDoesNotReadFullLogs: true,
    shortlistDoesNotTailFiles: true,
    shortlistDoesNotCaptureScreenshots: true,
    shortlistDoesNotExecuteTargetSoftware: true,
    shortlistDoesNotRegisterSchedule: true,
    shortlistDoesNotWriteMemory: true,
    routeRecommendationIsNotCoverage: true,
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

const preferredRoutesByCategory = {
  remote_control_app: ["remote_control_security_boundary", "teacher_exclusion_or_manual_marker"],
  chat_app: ["privacy_sensitive_chat_state_metadata", "teacher_exclusion_or_manual_marker"],
  runtime_framework: ["runtime_install_metadata", "teacher_exclusion_or_manual_marker"],
  crash_report_helper: ["crash_helper_parent_app_mapping", "teacher_exclusion_or_manual_marker"],
  browser: ["browser_profile_state_metadata", "process_window_metadata", "teacher_exclusion_or_manual_marker"],
  media_app: ["media_app_state_metadata", "process_window_metadata", "teacher_exclusion_or_manual_marker"],
  vendor_utility: ["vendor_utility_state_metadata", "windows_event_metadata", "teacher_exclusion_or_manual_marker"],
  productivity_app: ["process_window_metadata", "config_state_file_metadata", "teacher_exclusion_or_manual_marker"],
  security_app: ["security_tool_event_summary", "windows_event_metadata", "teacher_exclusion_or_manual_marker"],
  generic_desktop_app: ["windows_event_metadata", "process_window_metadata", "config_state_file_metadata", "teacher_exclusion_or_manual_marker"]
};

function recommendRoute(row) {
  const candidates = Array.isArray(row.candidateRoutes) ? row.candidateRoutes : [];
  const byId = new Map(candidates.map((route) => [route.routeId, route]));
  const preference = preferredRoutesByCategory[row.category] || preferredRoutesByCategory.generic_desktop_app;
  for (const routeId of preference) {
    if (byId.has(routeId)) return byId.get(routeId);
  }
  return candidates[0] || null;
}

function riskForRoute(row, route) {
  if (!route) return "blocked_no_candidate_route";
  if (route.routeId === "remote_control_security_boundary") return "high_risk_manual_marker_only";
  if (route.routeId === "privacy_sensitive_chat_state_metadata") return "privacy_sensitive_metadata_or_marker_only";
  if (route.routeId === "teacher_exclusion_or_manual_marker") return "teacher_policy_marker_only";
  if (String(route.tokenPolicy || "").includes("zero_token")) return "zero_token_until_teacher_marker";
  return "metadata_only_low_token";
}

function reasonForRoute(row, route) {
  if (!route) return "No candidate route exists, so this row must request a new route.";
  const category = row.category || "generic_desktop_app";
  if (category === "remote_control_app") return "Remote-control software is high risk, so the safest first route is an explicit teacher marker or exclusion before observation.";
  if (category === "chat_app") return "Chat software must avoid content; app-state metadata or teacher marker is the safest first route.";
  if (category === "runtime_framework") return "Runtime frameworks are usually dependencies, so install/runtime metadata is cheaper and safer than log reading.";
  if (category === "crash_report_helper") return "Crash helpers should be mapped to their parent app before being treated as independent teachable software.";
  if (category === "browser") return "Browser routes must avoid history, cookies, cache content, and page text; profile/process metadata is the safest first review.";
  if (category === "media_app") return "Media apps must avoid listening history or account content; app-state metadata is the safest first review.";
  return "This route keeps the first pass metadata-only and avoids full logs, screenshots, execution, schedule registration, and memory writes.";
}

function buildReceiptRow(row, recommendation) {
  const route = recommendation.recommendedRoute;
  return {
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber || "",
    software: row.software || "",
    category: row.category || "",
    allowedRouteIds: (row.candidateRoutes || []).map((candidate) => candidate.routeId),
    recommendedRouteId: route?.routeId || "",
    teacherDecision: "needs_teacher_review",
    allowedTeacherDecisions: ["needs_teacher_review", "select_candidate_route", "mark_out_of_scope", "request_new_route"],
    blockedTeacherDecisions: [
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
    selectedRouteId: "",
    routeEvidenceReviewed: false,
    privacyBoundaryReviewed: false,
    noContentReadConfirmed: false,
    routeSelectionNote: "",
    reviewedEvidencePathOrSignal: ""
  };
}

function writeHtml(path, shortlist) {
  const rows = shortlist.recommendations
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.priority)}</td>
        <td>${htmlEscape(row.rowId)}</td>
        <td>${htmlEscape(row.software)}</td>
        <td>${htmlEscape(row.category)}</td>
        <td>${htmlEscape(row.recommendedRouteId)}</td>
        <td>${htmlEscape(row.riskBoundary)}</td>
        <td>${htmlEscape(row.reason)}</td>
      </tr>`
    )
    .join("\n");
  const links = Object.entries(shortlist.paths)
    .filter(([, value]) => value)
    .map(([key, value]) => `<li><a href="${htmlEscape(fileHref(value))}">${htmlEscape(key)}</a></li>`)
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Low-Token Fallback Route Shortlist</title>
  <style>
    body { margin: 0; font: 14px/1.45 system-ui, sans-serif; color: #17202a; background: #f7f9fb; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 17px; margin-top: 24px; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #7c8a99; border-radius: 6px; background: white; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #d6dde5; }
    th, td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid #e3e8ef; }
    code { background: #edf1f5; padding: 1px 4px; border-radius: 4px; }
    a { color: #0b5cad; }
  </style>
</head>
<body>
  <main>
    <h1>Low-Token Fallback Route Shortlist</h1>
    <p class="status">${htmlEscape(shortlist.status)}</p>
    <p>Goal: ${htmlEscape(shortlist.goal)}</p>
    <p>Rows: ${htmlEscape(shortlist.counts.rows)} | Candidate routes: ${htmlEscape(shortlist.counts.sourceCandidateRoutes)} | Recommended routes: ${htmlEscape(shortlist.counts.recommendedRoutes)}</p>
    <h2>Recommendations</h2>
    <table>
      <thead><tr><th>#</th><th>Row</th><th>Software</th><th>Category</th><th>Recommended route</th><th>Boundary</th><th>Reason</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Evidence</h2>
    <ul>${links}</ul>
    <h2>Important</h2>
    <p>These are recommendations only. Teacher route selection is still required before any metadata probe, log read, screenshot, runner, schedule registration, memory write, coverage claim, or completion claim.</p>
  </main>
</body>
</html>`,
    "utf8"
  );
}

const goal = argValue("--goal", "Create a low-token fallback route recommendation shortlist for teacher review.");
const packInput = readJsonInput(
  argValue("--pack", argValue("--fallback-route-evidence-pack", "")),
  "--pack",
  "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_v1"
);
const outputRoot = resolve(
  argValue(
    "--out-dir",
    argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-fallback-route-shortlists"))
  )
);

const pack = packInput.value;
const shortlistId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(pack.packId || goal)}`;
const dir = join(outputRoot, shortlistId);
const shortlistPath = join(dir, "original-goal-low-token-fallback-route-shortlist.json");
const htmlPath = join(dir, "original-goal-low-token-fallback-route-shortlist.html");
const receiptTemplatePath = join(dir, "teacher-low-token-fallback-route-shortlist-receipt-template.json");
const readmePath = join(dir, "ORIGINAL_GOAL_LOW_TOKEN_FALLBACK_ROUTE_SHORTLIST_START_HERE.md");
const lockState = locks();

const recommendations = (pack.rows || []).map((row, index) => {
  const route = recommendRoute(row);
  return {
    priority: index + 1,
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber || "",
    software: row.software || "",
    category: row.category || "",
    sourceBlockers: row.sourceBlockers || [],
    sourceCandidateRouteCount: (row.candidateRoutes || []).length,
    recommendedRouteId: route?.routeId || "",
    recommendedRouteKind: route?.routeKind || "",
    tokenPolicy: route?.tokenPolicy || "",
    evidenceToReview: route?.evidenceToReview || "",
    teacherDecisionNeeded: route?.teacherDecisionNeeded || "",
    riskBoundary: riskForRoute(row, route),
    reason: reasonForRoute(row, route),
    recommendedRoute: route,
    routeSelectionStatus: "waiting_for_teacher_route_selection",
    recommendationIsCoverage: false,
    locks: lockState
  };
});

const receiptTemplate = {
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_v1",
  templateOnly: true,
  shortlistId,
  sourcePackPath: packInput.path,
  packId: pack.packId || "",
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "routes_selected_for_follow_up", "blocked", "request_new_routes"],
  blockedTeacherDecisions: [
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
  routeSelectionIsNotCoverage: true,
  blockedShortcutsReviewed: false,
  noFullLogReadConfirmed: false,
  noScreenshotConfirmed: false,
  noSoftwareExecutionConfirmed: false,
  noMemoryWriteConfirmed: false,
  receiptRows: (pack.rows || []).map((row, index) => buildReceiptRow(row, recommendations[index])),
  locks: lockState
};

const shortlist = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_fallback_route_shortlist_v1",
  shortlistId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_fallback_route_shortlist_review",
  sourceEvidence: {
    packPath: packInput.path,
    packId: pack.packId || "",
    packStatus: pack.status || "",
    sourceCandidateRoutes: pack.counts?.candidateRoutes || 0
  },
  counts: {
    rows: recommendations.length,
    sourceCandidateRoutes: pack.counts?.candidateRoutes || recommendations.reduce((sum, row) => sum + row.sourceCandidateRouteCount, 0),
    recommendedRoutes: recommendations.filter((row) => row.recommendedRouteId).length,
    highRiskManualMarkerRows: recommendations.filter((row) => row.riskBoundary.includes("manual_marker")).length,
    metadataOnlyRows: recommendations.filter((row) => row.riskBoundary === "metadata_only_low_token").length
  },
  recommendations,
  firstReviewRow: recommendations[0] || null,
  nextRequiredGate: "teacher_reviews_shortlist_then_validates_existing_fallback_route_receipt",
  nextValidationCommand: `node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs --pack "${packInput.path}" --receipt "<teacher-filled-low-token-fallback-route-shortlist-receipt.json>"`,
  blockedShortcuts: [
    "recommendations_do_not_select_routes",
    "do_not_run_metadata_probe_from_shortlist",
    "do_not_read_logs_or_full_logs",
    "do_not_capture_screenshots",
    "do_not_execute_target_software",
    "do_not_register_schedule",
    "do_not_write_memory",
    "do_not_claim_all_software_coverage_complete",
    "do_not_claim_goal_complete"
  ],
  paths: {
    shortlist: shortlistPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourcePack: packInput.path
  },
  locks: lockState
};

writeJson(shortlistPath, shortlist);
writeJson(receiptTemplatePath, receiptTemplate);
writeHtml(htmlPath, shortlist);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Fallback Route Shortlist",
    "",
    `Status: ${shortlist.status}`,
    `Rows: ${shortlist.counts.rows}`,
    `Source candidate routes: ${shortlist.counts.sourceCandidateRoutes}`,
    `Recommended routes: ${shortlist.counts.recommendedRoutes}`,
    "",
    "This shortlist recommends one conservative low-token route per waiting row. It does not select routes, run probes, read logs, capture screenshots, execute software, register schedules, write memory, or claim coverage.",
    "",
    "Teacher workflow:",
    "1. Open the HTML and inspect the recommended route per row.",
    "2. Fill the receipt template only after reviewing privacy boundaries and no-content-read constraints.",
    "3. Run the existing fallback-route receipt validator before any follow-up evidence plan.",
    "",
    `Shortlist: ${shortlistPath}`,
    `Receipt template: ${receiptTemplatePath}`,
    `Validation command: ${shortlist.nextValidationCommand}`
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_fallback_route_shortlist_result_v1",
      status: shortlist.status,
      shortlistPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      counts: shortlist.counts,
      firstReviewRow: shortlist.firstReviewRow,
      locks: lockState
    },
    null,
    2
  )
);
