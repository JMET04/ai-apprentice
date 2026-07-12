#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "current-goal-all-software-low-token-learning-handoff")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "current-goal-all-software-low-token-learning-handoff"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function newestRefresh() {
  const root = join(process.cwd(), "artifacts", "original-goal-current-status-refreshes");
  if (!existsSync(root)) return "";
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(root, entry.name);
      const file = join(dir, "original-goal-current-status-refresh.json");
      return existsSync(file) ? { file, time: statSync(dir).mtimeMs } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.time - a.time)[0]?.file || "";
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

function fileLink(label, value) {
  return value && existsSync(value)
    ? `<a href="${htmlEscape(fileHref(value))}">${htmlEscape(label)}</a>`
    : `<span>${htmlEscape(label)}: ${htmlEscape(value || "missing")}</span>`;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    handoffDoesNotRegisterTask: true,
    handoffDoesNotLaunchRunner: true,
    handoffDoesNotReadLogs: true,
    handoffDoesNotReadFullLogs: true,
    handoffDoesNotCaptureScreenshots: true,
    handoffDoesNotRecordScreen: true,
    handoffDoesNotExecuteTargetSoftware: true,
    handoffDoesNotWriteMemory: true,
    handoffDoesNotEnableRules: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    logsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function loadOptional(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return readJson(path);
  } catch {
    return null;
  }
}

function routeRows(bridge, paths) {
  return Array.isArray(bridge?.recommendedRouteOrder)
    ? bridge.recommendedRouteOrder.map((route, index) => ({
        order: index + 1,
        routeId: route.routeId || "",
        routeStatus: route.routeStatus || "",
        missingBeforeUse: route.missingBeforeUse || [],
        evidenceAlreadyAvailable: route.evidenceAlreadyAvailable || {},
        commandTemplate: route.commandTemplate || "",
        downstreamEvidence: route.downstreamEvidence || "",
        teacherRouteSelectionActionPack: {
          order: [
            "open_route_receipt_builder",
            "fill_teacher_low_token_monitor_bridge_receipt_with_this_route_id",
            "validate_teacher_route_receipt",
            "build_selected_route_command_package_after_validation",
            "review_selected_route_command_package_before_any_next_gate"
          ],
          routeReceiptBuilderHtml: paths.originalGoalLowTokenMonitorBridgeReceiptBuilderHtml || "",
          routeReceiptTemplatePath: paths.originalGoalLowTokenMonitorBridgeReceiptTemplate || "",
          receiptSelectedRouteId: route.routeId || "",
          routeReceiptValidationCommandTemplate: paths.originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate || "",
          selectedRouteCommandBuilderCommandTemplate:
            paths.originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate || "",
          routeNextGateCommandPreview: route.commandTemplate || "",
          nextGateMayRunOnlyAfterSeparateTeacherApproval: true,
          keepsLowTokenLocksClosed: true,
          blockedHere: [
            "run_route_next_gate_from_handoff",
            "register_monitor_from_handoff",
            "read_logs_from_handoff",
            "read_full_logs_from_handoff",
            "write_memory_from_handoff",
            "claim_goal_complete_from_handoff"
          ]
        }
      }))
    : [];
}

function coverageScopeSummary(ledger) {
  const rows = Array.isArray(ledger?.rows) ? ledger.rows : [];
  const statusCounts = rows.reduce((acc, row) => {
    const status = row.discoveryStatus || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  return {
    status: ledger?.status || "",
    totalInventoryRows: ledger?.counts?.totalInventoryRows ?? rows.length,
    ledgerRows: ledger?.counts?.ledgerRows ?? rows.length,
    directLogCandidatesReadyForMetadataGate: ledger?.counts?.directLogCandidatesReadyForMetadataGate ?? 0,
    nonLogLowTokenFallbackReadyForReview: ledger?.counts?.nonLogLowTokenFallbackReadyForReview ?? 0,
    windowsEventLogFallbackReadyForReview: ledger?.counts?.windowsEventLogFallbackReadyForReview ?? 0,
    needsTeacherLogSourceOrExclusion: ledger?.counts?.needsTeacherLogSourceOrExclusion ?? 0,
    teacherExcludedOrPrivate: ledger?.counts?.teacherExcludedOrPrivate ?? 0,
    allRowsHaveSourceRoute: ledger?.allRowsHaveSourceRoute === true,
    statusCounts,
    representativeSoftware: rows.slice(0, 12).map((row) => ({
      ledgerNumber: row.ledgerNumber,
      software: row.software || "",
      processName: row.processName || "",
      discoveryStatus: row.discoveryStatus || "",
      lowTokenRoute:
        row.discoveryStatus === "windows_event_log_fallback_ready_for_review"
          ? "windows_event_log_metadata_preview"
          : row.discoveryStatus === "non_log_low_token_fallback_ready_for_review"
            ? "non_log_metadata_before_visual_check"
            : row.directLogCandidateCount > 0
              ? "direct_log_metadata_gate_then_bounded_tail"
              : "teacher_review_required",
      nextActionCount: Array.isArray(row.nextActions) ? row.nextActions.length : 0
    })),
    completionBoundary: {
      allSoftwareLogSourceDiscoveryComplete: ledger?.completionBoundary?.allSoftwareLogSourceDiscoveryComplete === true,
      reason: ledger?.completionBoundary?.reason || "Coverage scope is evidence for review, not proof that every app is learned.",
      requiredBeforeCompletion: ledger?.completionBoundary?.requiredBeforeCompletion || []
    }
  };
}

function writeHtml(path, packet) {
  const evidenceRows = Object.entries(packet.paths)
    .map(([key, value]) => `<tr><td><code>${htmlEscape(key)}</code></td><td>${value ? fileLink(value, value) : ""}</td></tr>`)
    .join("\n");
  const scopeRows = packet.coverageScopeSummary.representativeSoftware
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.ledgerNumber)}</td>
        <td>${htmlEscape(row.software || row.processName || "unknown")}</td>
        <td><code>${htmlEscape(row.discoveryStatus)}</code></td>
        <td><code>${htmlEscape(row.lowTokenRoute)}</code></td>
      </tr>`
    )
    .join("\n");
  const routeCards = packet.routeRows
    .map(
      (row) => `<article class="card">
        <h3>${row.order}. ${htmlEscape(row.routeId)}</h3>
        <p><strong>Status:</strong> ${htmlEscape(row.routeStatus)}</p>
        <p><strong>Coverage scope:</strong> applies to the teacher-reviewed ledger scope; representative rows and fallback types are summarized above.</p>
        <p><strong>Missing:</strong> ${htmlEscape(row.missingBeforeUse.join("; ") || "none")}</p>
        <p><strong>Evidence:</strong> ${htmlEscape(JSON.stringify(row.evidenceAlreadyAvailable || {}))}</p>
        <p><strong>Teacher route receipt:</strong> ${fileLink(
          row.teacherRouteSelectionActionPack.routeReceiptBuilderHtml ||
            row.teacherRouteSelectionActionPack.routeReceiptTemplatePath ||
            "missing",
          row.teacherRouteSelectionActionPack.routeReceiptBuilderHtml ||
            row.teacherRouteSelectionActionPack.routeReceiptTemplatePath
        )}</p>
        <p><strong>Receipt route id:</strong> <code>${htmlEscape(
          row.teacherRouteSelectionActionPack.receiptSelectedRouteId
        )}</code></p>
        <p><strong>Validate receipt:</strong></p>
        <pre>${htmlEscape(row.teacherRouteSelectionActionPack.routeReceiptValidationCommandTemplate)}</pre>
        <p><strong>Build selected-route command package after validation:</strong></p>
        <pre>${htmlEscape(row.teacherRouteSelectionActionPack.selectedRouteCommandBuilderCommandTemplate)}</pre>
        <p><strong>Next gate preview, not executable from this handoff:</strong></p>
        <pre>${htmlEscape(row.commandTemplate)}</pre>
      </article>`
    )
    .join("\n");
  const commandItems = packet.nextCommands
    .map((item) => `<li><strong>${htmlEscape(item.id)}</strong><pre>${htmlEscape(item.command)}</pre></li>`)
    .join("\n");
  const blockers = packet.blockedActions.map((item) => `<li><code>${htmlEscape(item)}</code></li>`).join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>All-Software Low-Token Learning Handoff</title>
  <style>
    body { margin: 0; font: 14px/1.45 Segoe UI, Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    section, .card { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; padding: 16px; margin: 12px 0; }
    h1, h2, h3 { margin: 0 0 10px; }
    table { border-collapse: collapse; width: 100%; }
    td { border-top: 1px solid #e8edf3; padding: 8px; vertical-align: top; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #eef2f7; border-radius: 6px; padding: 10px; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #8aa6c1; border-radius: 999px; background: #eef6ff; }
  </style>
</head>
<body>
<main>
  <h1>All-Software Low-Token Learning Handoff</h1>
  <p class="status">${htmlEscape(packet.status)}</p>
  <section>
    <h2>What This Proves Now</h2>
    <p>Every discovered row currently has a reviewable low-token source route, but teacher route selection, monitor registration, run output witness, and final completion evidence are still gated.</p>
  </section>
  <section>
    <h2>Coverage Scope</h2>
    <p><strong>Status:</strong> <code>${htmlEscape(packet.coverageScopeSummary.status || "unknown")}</code></p>
    <p><strong>Ledger rows:</strong> ${htmlEscape(packet.coverageScopeSummary.ledgerRows)} / ${htmlEscape(packet.coverageScopeSummary.totalInventoryRows)}; <strong>missing teacher source rows:</strong> ${htmlEscape(packet.coverageScopeSummary.needsTeacherLogSourceOrExclusion)}</p>
    <p><strong>Low-token source mix:</strong> direct logs ${htmlEscape(packet.coverageScopeSummary.directLogCandidatesReadyForMetadataGate)}, Windows event fallback ${htmlEscape(packet.coverageScopeSummary.windowsEventLogFallbackReadyForReview)}, non-log fallback ${htmlEscape(packet.coverageScopeSummary.nonLogLowTokenFallbackReadyForReview)}.</p>
    <table>
      <thead><tr><td>#</td><td>Software</td><td>Status</td><td>Low-token route</td></tr></thead>
      <tbody>${scopeRows}</tbody>
    </table>
  </section>
  <section>
    <h2>Evidence Files</h2>
    <table>${evidenceRows}</table>
  </section>
  <section>
    <h2>Teacher Route Options</h2>
    ${routeCards}
  </section>
  <section>
    <h2>Next Commands</h2>
    <ol>${commandItems}</ol>
  </section>
  <section>
    <h2>Blocked Here</h2>
    <ul>${blockers}</ul>
  </section>
</main>
</body>
</html>`,
    "utf8"
  );
}

function writeReadme(path, packet) {
  writeFileSync(
    path,
    [
      "# Current Goal All-Software Low-Token Learning Handoff",
      "",
      `Status: ${packet.status}`,
      "",
      "This package gathers the current all-software low-token learning evidence into one teacher-facing handoff.",
      "",
      "It does not register a scheduled task, launch a runner, read logs, capture screenshots, write memory, enable rules, execute target software, or claim the goal complete.",
      "",
      "Recommended route:",
      packet.recommendedFirstRouteId || "(none)",
      "",
      "Coverage scope:",
      `- Ledger status: ${packet.coverageScopeSummary.status || "unknown"}`,
      `- Ledger rows: ${packet.coverageScopeSummary.ledgerRows} / ${packet.coverageScopeSummary.totalInventoryRows}`,
      `- Direct log metadata-gate rows: ${packet.coverageScopeSummary.directLogCandidatesReadyForMetadataGate}`,
      `- Windows event fallback rows: ${packet.coverageScopeSummary.windowsEventLogFallbackReadyForReview}`,
      `- Non-log fallback rows: ${packet.coverageScopeSummary.nonLogLowTokenFallbackReadyForReview}`,
      `- Missing teacher source or exclusion rows: ${packet.coverageScopeSummary.needsTeacherLogSourceOrExclusion}`,
      "",
      "Open the HTML entry:",
      packet.paths.html,
      "",
      "Next commands:",
      ...packet.nextCommands.map((item) => `- ${item.id}: ${item.command}`)
    ].join("\n"),
    "utf8"
  );
}

const refreshPath = resolve(argValue("--refresh", argValue("--current-status-refresh", newestRefresh())));
if (!refreshPath || !existsSync(refreshPath)) throw new Error("--refresh is required when no latest current-status refresh exists.");

const refresh = readJson(refreshPath);
if (refresh.format !== "transparent_ai_original_goal_current_status_refresh_v1") {
  throw new Error("--refresh must be transparent_ai_original_goal_current_status_refresh_v1");
}

const goal = argValue("--goal", refresh.goal || "Make all local software use low-token observation before learning.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), "artifacts", "current-goal-all-software-low-token-learning-handoffs"))
);
mkdirSync(outputRoot, { recursive: true });
const handoffId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const handoffDir = join(outputRoot, handoffId);
mkdirSync(handoffDir, { recursive: true });

const paths = refresh.paths || {};
const bridge = loadOptional(paths.originalGoalLowTokenMonitorCommandBridge);
const logSourceLedger = loadOptional(paths.logSourceDiscoveryLedger);
const unattendedAudit = loadOptional(paths.allSoftwareUnattendedLearningAudit);
const coverageGate = loadOptional(paths.originalGoalLowTokenCoverageCompletionGate);
const recurringValidation = loadOptional(paths.recurringMonitorTeacherConfirmationReceiptValidation);
const rows = routeRows(bridge, paths);
const scopeSummary = coverageScopeSummary(logSourceLedger);
const recommendedFirstRoute =
  rows.find((row) => row.routeStatus === "ready_for_teacher_coverage_review_receipt") ||
  rows.find((row) => row.routeStatus.includes("ready")) ||
  rows[0] ||
  null;

const logSourceStatus = bridge?.sourceContext?.logSourceDiscoveryStatus || refresh.refreshedEvidence?.logSourceDiscoveryStatus || "";
const logSourceMissingRows =
  bridge?.sourceContext?.logSourceMissingRows ?? refresh.refreshedEvidence?.logSourceDiscoveryMissingRows ?? null;
const allRowsHaveReviewableLowTokenRoute =
  logSourceMissingRows === 0 ||
  logSourceStatus === "all_rows_have_reviewable_low_token_source_route_waiting_for_teacher_review";

const handoffPath = join(handoffDir, "current-goal-all-software-low-token-learning-handoff.json");
const htmlPath = join(handoffDir, "current-goal-all-software-low-token-learning-handoff.html");
const readmePath = join(handoffDir, "CURRENT_GOAL_ALL_SOFTWARE_LOW_TOKEN_START_HERE.md");
const packetLocks = locks();
const packet = {
  ok: true,
  format: "transparent_ai_current_goal_all_software_low_token_learning_handoff_v1",
  handoffId,
  createdAt: new Date().toISOString(),
  goal,
  status: allRowsHaveReviewableLowTokenRoute
    ? "all_rows_have_reviewable_low_token_routes_waiting_for_teacher_route_selection"
    : "waiting_for_log_source_coverage_repair_before_monitor_route_selection",
  completionDecision: refresh.completionDecision,
  logSourceStatus,
  logSourceMissingRows,
  allRowsHaveReviewableLowTokenRoute,
  coverageScopeSummary: scopeSummary,
  routeRows: rows,
  teacherRouteSelectionActionPack: {
    status: "ready_for_teacher_route_selection_receipt_then_validation",
    routeReceiptBuilderHtml: paths.originalGoalLowTokenMonitorBridgeReceiptBuilderHtml || "",
    routeReceiptTemplatePath: paths.originalGoalLowTokenMonitorBridgeReceiptTemplate || "",
    routeReceiptValidationCommandTemplate: paths.originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate || "",
    selectedRouteCommandBuilderCommandTemplate:
      paths.originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate || "",
    requiredOrder: [
      "teacher opens the low-token monitor bridge receipt builder",
      "teacher selects exactly one known route or asks for more evidence",
      "validator creates a routeReadyForLaterGate receipt validation only if evidence is sufficient",
      "selected-route command builder creates a review-only next-gate handoff",
      "any real registration, log read, screenshot, software action, or memory write remains a later separate approval"
    ],
    executeNow: false,
    registerNow: false,
    readLogsNow: false,
    writeMemoryNow: false,
    goalCompleteNow: false
  },
  recommendedFirstRouteId: recommendedFirstRoute?.routeId || "",
  currentEvidence: {
    lowTokenMonitorBridgeReady: Boolean(bridge),
    logSourceDiscoveryLedgerReady: Boolean(logSourceLedger),
    routeCount: rows.length,
    coverageScopeRows: scopeSummary.ledgerRows,
    coverageScopeAllRowsHaveSourceRoute: scopeSummary.allRowsHaveSourceRoute,
    coverageGateStatus: coverageGate?.status || "",
    unattendedAuditStatus: unattendedAudit?.status || "",
    recurringMonitorTeacherConfirmationValidationStatus: recurringValidation?.status || "",
    recurringMonitorTeacherConfirmationDecision: recurringValidation?.validationDecision || ""
  },
  nextCommands: [
    {
      id: "open_teacher_route_receipt_builder",
      purpose: "Teacher selects exactly one low-token monitor route or asks for more evidence.",
      command: paths.originalGoalLowTokenMonitorBridgeReceiptBuilderHtml || paths.originalGoalLowTokenMonitorBridgeReceiptBuilder || ""
    },
    {
      id: "validate_teacher_route_receipt",
      purpose: "Validate the teacher-selected route without running it.",
      command: paths.originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate || ""
    },
    {
      id: "build_selected_route_command_after_validation",
      purpose: "After validation, create the next-gate command package without executing it.",
      command: paths.originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate || ""
    },
    {
      id: "review_recurring_monitor_confirmation_package",
      purpose: "If teacher chooses recurring monitoring, review the confirmation package before registration.",
      command: paths.recurringMonitorTeacherConfirmationPackageHtml || paths.recurringMonitorTeacherConfirmationPackage || ""
    },
    {
      id: "registration_and_output_witness_are_later_gates",
      purpose: "Registration, status verification, and run-output audit require separate teacher approval and retained rollback.",
      command: [
        paths.recurringMonitorRegistrationRunnerDryRunCommandTemplate || "",
        paths.recurringMonitorRegistrationStatusVerifierCommandTemplate || "",
        paths.allSoftwareUnattendedLearningAuditCommandTemplate || ""
      ]
        .filter(Boolean)
        .join("\n")
    }
  ],
  blockedActions: [
    "register_scheduled_task_from_handoff",
    "launch_low_token_runner_from_handoff",
    "read_logs_from_handoff",
    "read_full_logs_from_handoff",
    "capture_screenshot_from_handoff",
    "record_screen_from_handoff",
    "write_memory_from_handoff",
    "enable_rule_from_handoff",
    "execute_target_software_from_handoff",
    "claim_all_software_learning_complete_from_handoff"
  ],
  paths: {
    handoff: handoffPath,
    html: htmlPath,
    readme: readmePath,
    refresh: refreshPath,
    logSourceDiscoveryLedger: paths.logSourceDiscoveryLedger || "",
    readinessPackage: paths.realLocalAllSoftwareLowTokenReadinessPackage || "",
    lowTokenCoverageGate: paths.originalGoalLowTokenCoverageCompletionGate || "",
    lowTokenMonitorBridge: paths.originalGoalLowTokenMonitorCommandBridge || "",
    lowTokenMonitorBridgeHtml: paths.originalGoalLowTokenMonitorCommandBridgeHtml || "",
    routeReceiptBuilder: paths.originalGoalLowTokenMonitorBridgeReceiptBuilder || "",
    routeReceiptBuilderHtml: paths.originalGoalLowTokenMonitorBridgeReceiptBuilderHtml || "",
    routeReceiptTemplate: paths.originalGoalLowTokenMonitorBridgeReceiptTemplate || "",
    recurringMonitorTeacherConfirmationPackage: paths.recurringMonitorTeacherConfirmationPackage || "",
    recurringMonitorTeacherConfirmationHtml: paths.recurringMonitorTeacherConfirmationPackageHtml || "",
    recurringMonitorTeacherConfirmationTemplate: paths.recurringMonitorTeacherConfirmationReceiptTemplate || "",
    recurringMonitorTeacherConfirmationValidation: paths.recurringMonitorTeacherConfirmationReceiptValidation || "",
    unattendedAudit: paths.allSoftwareUnattendedLearningAudit || "",
    operationalPostRegistrationOutputWitnessReceiptBuilder: paths.operationalPostRegistrationOutputWitnessReceiptBuilder || ""
  },
  locks: packetLocks,
  goalComplete: false
};

writeFileSync(handoffPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeHtml(htmlPath, packet);
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_all_software_low_token_learning_handoff_result_v1",
      status: packet.status,
      handoffPath,
      htmlPath,
      readmePath,
      routeCount: rows.length,
      recommendedFirstRouteId: packet.recommendedFirstRouteId,
      allRowsHaveReviewableLowTokenRoute,
      locks: packetLocks
    },
    null,
    2
  )
);
