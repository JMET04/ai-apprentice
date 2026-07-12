#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-fallback-route-evidence-pack")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-fallback-route-evidence-pack"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
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
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    candidateFallbackRoutesOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packDoesNotReadLogs: true,
    packDoesNotReadFullLogs: true,
    packDoesNotTailFiles: true,
    packDoesNotCaptureScreenshots: true,
    packDoesNotExecuteTargetSoftware: true,
    packDoesNotRegisterSchedule: true,
    packDoesNotWriteMemory: true,
    packDoesNotEnableCoverage: true,
    packDoesNotClaimAllSoftwareCoverage: true,
    windowsEventQueryExecuted: false,
    fileMetadataProbeExecuted: false,
    processMetadataProbeExecuted: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function classifySoftware(name, processName = "") {
  const text = `${name} ${processName}`.toLowerCase();
  if (text.includes("asp.net") || text.includes("shared framework") || text.includes(".net")) return "runtime_framework";
  if (text.includes("crashpad")) return "crash_report_helper";
  if (text.includes("微信") || text.includes("wechat")) return "chat_app";
  if (text.includes("浏览器") || text.includes("browser") || text.includes("chrome")) return "browser";
  if (text.includes("网易云") || text.includes("音乐") || text.includes("喜马拉雅")) return "media_app";
  if (text.includes("翻译") || text.includes("youdao")) return "productivity_app";
  if (text.includes("远程") || text.includes("向日葵") || text.includes("连连控")) return "remote_control_app";
  if (text.includes("mcafee") || text.includes("迈克菲")) return "security_app";
  if (text.includes("asus") || text.includes("华硕")) return "vendor_utility";
  return "generic_desktop_app";
}

function routeCandidates(row) {
  const category = classifySoftware(row.software, row.processName);
  const common = [
    {
      routeId: "windows_event_metadata",
      routeKind: "windows_event_log_metadata",
      evidenceToReview:
        "Event provider name, event count, newest timestamp, and severity histogram only; do not export event message bodies by default.",
      tokenPolicy: "metadata_only",
      teacherDecisionNeeded: "confirm_provider_or_reject_route"
    },
    {
      routeId: "process_window_metadata",
      routeKind: "process_and_window_state_metadata",
      evidenceToReview:
        "Process name, executable basename, window title presence, start time, and changed/not-changed signal only.",
      tokenPolicy: "metadata_only",
      teacherDecisionNeeded: "confirm_safe_observation_or_reject_route"
    },
    {
      routeId: "config_state_file_metadata",
      routeKind: "file_state_metadata",
      evidenceToReview:
        "Candidate config/state directory existence, file count, newest modified timestamp, and size buckets only; no file contents.",
      tokenPolicy: "metadata_only",
      teacherDecisionNeeded: "confirm_directory_or_require_teacher_marker"
    },
    {
      routeId: "teacher_exclusion_or_manual_marker",
      routeKind: "teacher_policy",
      evidenceToReview:
        "Teacher marks this software as out of scope, privacy-sensitive, runtime-only, or requiring a manual low-token marker.",
      tokenPolicy: "zero_token_until_teacher_marker",
      teacherDecisionNeeded: "confirm_exclusion_or_marker"
    }
  ];

  const byCategory = {
    runtime_framework: [
      {
        routeId: "runtime_install_metadata",
        routeKind: "installed_runtime_metadata",
        evidenceToReview:
          "Runtime install version, install path hash, and last modified timestamp only; runtime frameworks usually do not emit user workflow logs.",
        tokenPolicy: "metadata_only",
        teacherDecisionNeeded: "confirm_runtime_is_dependency_or_require_host_app_mapping"
      }
    ],
    crash_report_helper: [
      {
        routeId: "crash_helper_parent_app_mapping",
        routeKind: "parent_process_mapping",
        evidenceToReview:
          "Map crash helper to parent application and use parent app route; do not treat helper as an independent teachable app unless teacher says so.",
        tokenPolicy: "metadata_only",
        teacherDecisionNeeded: "confirm_parent_app_or_exclude_helper"
      }
    ],
    chat_app: [
      {
        routeId: "privacy_sensitive_chat_state_metadata",
        routeKind: "privacy_preserving_state_metadata",
        evidenceToReview:
          "Only reviewed app-state timestamps or teacher-provided markers; never read chat content or attachment content.",
        tokenPolicy: "metadata_or_teacher_marker_only",
        teacherDecisionNeeded: "confirm_privacy_boundary_before_any_observation"
      }
    ],
    browser: [
      {
        routeId: "browser_profile_state_metadata",
        routeKind: "profile_state_metadata",
        evidenceToReview:
          "Profile directory timestamp and extension/app state changes only; no history, cookies, cache contents, or page text.",
        tokenPolicy: "metadata_only",
        teacherDecisionNeeded: "confirm_profile_boundary"
      }
    ],
    media_app: [
      {
        routeId: "media_app_state_metadata",
        routeKind: "media_client_state_metadata",
        evidenceToReview:
          "App state timestamp, playback/process presence, and reviewed error/event metadata only; no listening history or account content.",
        tokenPolicy: "metadata_only",
        teacherDecisionNeeded: "confirm_privacy_safe_state_route"
      }
    ],
    remote_control_app: [
      {
        routeId: "remote_control_security_boundary",
        routeKind: "security_sensitive_manual_marker",
        evidenceToReview:
          "Treat as high-risk remote-control software; require explicit teacher marker or exclusion before observation.",
        tokenPolicy: "zero_token_until_teacher_marker",
        teacherDecisionNeeded: "confirm_high_risk_boundary"
      }
    ],
    security_app: [
      {
        routeId: "security_tool_event_summary",
        routeKind: "security_tool_metadata",
        evidenceToReview:
          "Only vendor event source presence, timestamp, and severity summary; never change protection settings.",
        tokenPolicy: "metadata_only",
        teacherDecisionNeeded: "confirm_read_only_security_boundary"
      }
    ],
    vendor_utility: [
      {
        routeId: "vendor_utility_state_metadata",
        routeKind: "vendor_utility_metadata",
        evidenceToReview:
          "Service/process state, vendor event source existence, and config timestamp only.",
        tokenPolicy: "metadata_only",
        teacherDecisionNeeded: "confirm_vendor_utility_route"
      }
    ],
    productivity_app: [
      {
        routeId: "productivity_app_state_metadata",
        routeKind: "productivity_state_metadata",
        evidenceToReview:
          "App state timestamp and reviewed error/update event metadata only; no user document or translation content.",
        tokenPolicy: "metadata_only",
        teacherDecisionNeeded: "confirm_content_boundary"
      }
    ],
    generic_desktop_app: []
  };

  return [...(byCategory[category] || []), ...common];
}

function writeReadme(path, pack) {
  const lines = [
    "# Original Goal Low-Token Fallback Route Evidence Pack",
    "",
    `Status: ${pack.status}`,
    `Rows: ${pack.counts.rows}`,
    `Candidate routes: ${pack.counts.candidateRoutes}`,
    "",
    "This pack narrows blocked low-token coverage rows into reviewable fallback-route candidates.",
    "",
    "Safety boundary:",
    "- This pack is review-only.",
    "- It does not read logs, tail files, capture screenshots, execute software, register schedules, write memory, enable coverage, or claim completion.",
    "- Each candidate route still requires teacher review before metadata probing, visual checks, or execution gates.",
    "",
    "Rows:",
    ...pack.rows.map((row, index) => `${index + 1}. ${row.rowId} ${row.software}: ${row.category}; routes=${row.candidateRoutes.length}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, pack) {
  const rows = pack.rows
    .map(
      (row) => `<tr><td>${htmlEscape(row.rowId)}</td><td>${htmlEscape(row.software)}</td><td>${htmlEscape(
        row.category
      )}</td><td>${htmlEscape(row.candidateRoutes.map((route) => route.routeId).join(", "))}</td><td>${htmlEscape(
        row.nextSafeAction
      )}</td></tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Low-Token Fallback Route Evidence Pack</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); margin-top: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; border-bottom: 1px solid #e6ebf2; padding: 8px; vertical-align: top; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .warn { background: #fff7df; color: #795400; }
  </style>
</head>
<body>
  <main>
    <h1>Low-Token Fallback Route Evidence Pack</h1>
    <p><span class="badge">review only</span> <span class="badge warn">candidate routes only</span></p>
    <section class="panel">
      <p>Status: <code>${htmlEscape(pack.status)}</code></p>
      <p>Rows: <code>${htmlEscape(pack.counts.rows)}</code>; candidate routes: <code>${htmlEscape(pack.counts.candidateRoutes)}</code></p>
    </section>
    <section class="panel">
      <table>
        <thead><tr><th>Row</th><th>Software</th><th>Category</th><th>Candidate Routes</th><th>Next Safe Action</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Create candidate low-token fallback routes for blocked waiting rows.");
const planInput = readJsonInput(
  argValue("--plan", argValue("--blocked-waiting-row-evidence-plan", "")),
  "--plan",
  "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_v1"
);
if (!planInput.value) throw new Error("--plan is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-fallback-route-evidence-packs"))
);
mkdirSync(outputRoot, { recursive: true });
const packId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packDir = join(outputRoot, packId);
mkdirSync(packDir, { recursive: true });
const packPath = join(packDir, "original-goal-low-token-fallback-route-evidence-pack.json");
const htmlPath = join(packDir, "original-goal-low-token-fallback-route-evidence-pack.html");
const readmePath = join(packDir, "ORIGINAL_GOAL_LOW_TOKEN_FALLBACK_ROUTE_EVIDENCE_PACK_START_HERE.md");

const rows = (planInput.value.actionRows || []).map((row) => {
  const candidates = routeCandidates(row);
  return {
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber || "",
    software: row.software || "",
    processName: row.processName || "",
    category: classifySoftware(row.software, row.processName),
    sourceBlockers: row.blockers || [],
    candidateRoutes: candidates,
    routeSelectionStatus: "waiting_for_teacher_route_selection",
    nextSafeAction:
      "Teacher selects one candidate fallback route, rejects the software as out-of-scope, or requests a new evidence route before any metadata probe.",
    returnToCoverageCommandTemplate: commandLine("validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs", [
      ["--plan", planInput.path || "<original-goal-low-token-blocked-waiting-row-evidence-plan.json>"],
      ["--receipt", "<teacher-filled-low-token-blocked-waiting-row-evidence-plan-receipt.json>"],
      ["--output-dir", join(packDir, "blocked-waiting-row-evidence-plan-receipt-validation")]
    ])
  };
});

const packLocks = locks();
const pack = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_v1",
  packId,
  createdAt: new Date().toISOString(),
  goal,
  status: rows.length
    ? "waiting_for_teacher_fallback_route_review"
    : "no_blocked_waiting_rows_need_fallback_routes",
  sourceEvidence: {
    blockedWaitingRowEvidencePlan: planInput.path,
    sourceCockpit: planInput.value.sourceEvidence?.cockpit || "",
    sourceDossier: planInput.value.sourceEvidence?.sourceDossier || ""
  },
  counts: {
    rows: rows.length,
    candidateRoutes: rows.reduce((sum, row) => sum + row.candidateRoutes.length, 0),
    rowsWithPrivacySensitiveRoute: rows.filter((row) =>
      row.candidateRoutes.some((route) => route.tokenPolicy.includes("teacher_marker"))
    ).length,
    rowsRequiringTeacherRouteSelection: rows.length
  },
  rows,
  teacherReviewContract: {
    allowedDecisions: ["select_candidate_route", "reject_route", "mark_out_of_scope", "request_new_route"],
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
    selectedRouteIsStillNotCoverage: true
  },
  blockedShortcuts: [
    "Do not infer coverage from a candidate fallback route.",
    "Do not run metadata probes until a teacher selects the route.",
    "Do not read private content, logs, full logs, chats, browser history, account data, or media history.",
    "Do not execute target software, register schedules, write memory, enable rules, or claim completion."
  ],
  paths: {
    pack: packPath,
    html: htmlPath,
    readme: readmePath,
    sourcePlan: planInput.path
  },
  locks: packLocks
};

writeJson(packPath, pack);
writeHtml(htmlPath, pack);
writeReadme(readmePath, pack);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_result_v1",
      packId,
      status: pack.status,
      packPath,
      htmlPath,
      readmePath,
      counts: pack.counts,
      locks: packLocks
    },
    null,
    2
  )
);
