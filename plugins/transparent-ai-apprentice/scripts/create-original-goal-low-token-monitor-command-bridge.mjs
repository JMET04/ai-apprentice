#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-monitor-command-bridge")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "original-goal-low-token-monitor-command-bridge"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonIfExists(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return readJson(path);
  } catch {
    return null;
  }
}

function latestJsonUnder(root, fileName) {
  if (!existsSync(root)) return "";
  const entries = [];
  for (const name of readdirSync(root, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const candidate = join(root, name.name, fileName);
    if (existsSync(candidate)) entries.push(candidate);
  }
  entries.sort().reverse();
  return entries[0] || "";
}

function resolveQueuePath(input) {
  if (input && existsSync(input)) return resolve(input);
  const latest = latestJsonUnder(
    join(process.cwd(), ".transparent-apprentice", "original-goal-objective-fulfillment-next-step-queues"),
    "original-goal-objective-fulfillment-next-step-queue.json"
  );
  if (latest) return latest;
  throw new Error("--queue is required when no latest objective fulfillment next-step queue exists");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function command(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replaceAll('"', '\\"')}"`);
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    bridgeDoesNotRunCommands: true,
    bridgeDoesNotRegisterTask: true,
    bridgeDoesNotLaunchRunner: true,
    bridgeDoesNotReadLogs: true,
    bridgeDoesNotReadFullLogs: true,
    bridgeDoesNotCaptureScreenshots: true,
    bridgeDoesNotRecordScreen: true,
    bridgeDoesNotExecuteTargetSoftware: true,
    bridgeDoesNotWriteMemory: true,
    bridgeDoesNotEnableRules: true,
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

function isRealPath(value) {
  const text = String(value || "").trim();
  return Boolean(text) && !text.includes("<") && existsSync(text);
}

function sourceContext(queue) {
  const sourceAuditPath = queue.sourceAuditPath && existsSync(queue.sourceAuditPath) ? resolve(queue.sourceAuditPath) : "";
  const audit = readJsonIfExists(sourceAuditPath);
  const sourceRefreshPath = audit?.sourceRefreshPath && existsSync(audit.sourceRefreshPath) ? resolve(audit.sourceRefreshPath) : "";
  const refresh = readJsonIfExists(sourceRefreshPath);
  const paths = refresh?.paths || {};
  const evidence = refresh?.refreshedEvidence || {};
  const coverageEvidenceDossierPath = paths.originalGoalLowTokenCoverageEvidenceDossier || "";
  const waitingRowCockpitPath = paths.originalGoalLowTokenCoverageWaitingRowCockpit || "";
  const readinessPackagePath = paths.realLocalAllSoftwareLowTokenReadinessPackage || "";
  const logSourceMissingRows =
    typeof evidence.logSourceDiscoveryMissingRows === "number" ? evidence.logSourceDiscoveryMissingRows : null;
  const allRowsHaveReviewableSourceRoute =
    logSourceMissingRows === 0 ||
    evidence.logSourceDiscoveryStatus === "all_rows_have_reviewable_low_token_source_route_waiting_for_teacher_review";
  const coverageArtifactsReady = isRealPath(coverageEvidenceDossierPath) || isRealPath(waitingRowCockpitPath);
  const readinessPackageReady = isRealPath(readinessPackagePath);
  return {
    sourceAuditPath,
    sourceRefreshPath,
    logSourceDiscoveryStatus: evidence.logSourceDiscoveryStatus || "",
    logSourceMissingRows,
    allRowsHaveReviewableSourceRoute,
    coverageArtifactsReady,
    coverageEvidenceDossierPath,
    waitingRowCockpitPath,
    readinessPackageReady,
    readinessPackagePath,
    coverageTeacherReceiptReady: evidence.originalGoalLowTokenCoverageDossierReceiptValidationReady === true,
    recurringMonitorTeacherConfirmationReady:
      evidence.allSoftwareRecurringMonitorTeacherConfirmationReceiptReady === true ||
      evidence.allSoftwareRecurringMonitorTeacherConfirmationValidationReady === true
  };
}

function routeStatus(routeId, context) {
  if (routeId === "existing_low_token_coverage_review") {
    return context.coverageArtifactsReady && context.allRowsHaveReviewableSourceRoute
      ? "ready_for_teacher_coverage_review_receipt"
      : "waiting_for_coverage_artifacts_or_log_source_routes";
  }
  if (routeId === "existing_recurring_monitor_teacher_confirmation") {
    return context.coverageArtifactsReady && context.readinessPackageReady
      ? "ready_after_teacher_coverage_review_and_retained_rollback"
      : "waiting_for_readiness_package_or_coverage_review";
  }
  if (routeId === "existing_recurring_monitor_registration_runner_template") {
    return "waiting_for_validated_teacher_monitor_confirmation";
  }
  if (routeId === "existing_recurring_monitor_status_verifier") return "waiting_for_registration_runner_result";
  if (routeId === "existing_recurring_monitor_run_output_audit") return "waiting_for_bounded_monitor_run_output";
  return "waiting_for_teacher_review";
}

function compactEvidenceForRoute(routeId, context) {
  if (routeId === "existing_low_token_coverage_review") {
    return {
      logSourceDiscoveryStatus: context.logSourceDiscoveryStatus,
      logSourceMissingRows: context.logSourceMissingRows,
      allRowsHaveReviewableSourceRoute: context.allRowsHaveReviewableSourceRoute,
      coverageEvidenceDossierPath: context.coverageEvidenceDossierPath,
      waitingRowCockpitPath: context.waitingRowCockpitPath
    };
  }
  if (routeId === "existing_recurring_monitor_teacher_confirmation") {
    return {
      readinessPackagePath: context.readinessPackagePath,
      coverageEvidenceDossierPath: context.coverageEvidenceDossierPath,
      waitingRowCockpitPath: context.waitingRowCockpitPath,
      coverageTeacherReceiptReady: context.coverageTeacherReceiptReady
    };
  }
  return {};
}

function missingBeforeUse(routeId, fallback, context) {
  if (routeId === "existing_low_token_coverage_review") {
    const missing = [];
    if (!context.coverageArtifactsReady) missing.push("current coverage dossier or cockpit evidence");
    if (!context.allRowsHaveReviewableSourceRoute) missing.push("reviewable log or fallback source route for every row");
    missing.push("teacher-reviewed exclusions for software that must not be observed");
    missing.push("evidence-return receipts for blocked waiting rows when the teacher marks rows unresolved");
    return missing;
  }
  if (routeId === "existing_recurring_monitor_teacher_confirmation") {
    const missing = [];
    if (!context.readinessPackageReady) missing.push("readiness package");
    missing.push("teacher-filled recurring monitor confirmation receipt");
    missing.push("retained rollback point");
    missing.push("teacher-reviewed coverage receipt or explicit software exclusions");
    return missing;
  }
  return fallback;
}

function route(route, context) {
  return {
    ...route,
    routeStatus: routeStatus(route.routeId, context),
    evidenceAlreadyAvailable: compactEvidenceForRoute(route.routeId, context),
    missingBeforeUse: missingBeforeUse(route.routeId, route.missingBeforeUse || [], context)
  };
}

function findLowTokenItem(queue) {
  return (Array.isArray(queue.queueItems) ? queue.queueItems : []).find(
    (item) => item.requirementId === "all_software_low_token_learning"
  );
}

function buildBridge(queue, queuePath) {
  if (queue.format !== "transparent_ai_original_goal_objective_fulfillment_next_step_queue_v1") {
    throw new Error("--queue must be transparent_ai_original_goal_objective_fulfillment_next_step_queue_v1");
  }
  const item = findLowTokenItem(queue);
  if (!item) throw new Error("Queue is missing all_software_low_token_learning item");
  const context = sourceContext(queue);

  const sharedMissing = [
    "full reviewed software coverage or explicit teacher exclusions",
    "teacher confirmation receipt for recurring monitor registration",
    "retained rollback point for monitor registration and later runner use",
    "registration runner output witness",
    "read-only registration status verification",
    "recurring monitor run-output audit",
    "teacher review packet for automatic low-token learning evidence",
    "final objective fulfillment audit after evidence return"
  ];

  return {
    sourceQueuePath: queuePath,
    lowTokenObjective: item,
    status: "low_token_monitor_command_bridge_ready_for_teacher_review",
    bridgeDoesNotSatisfyAllSoftwareLearning: true,
    completionAllowed: false,
    evidenceContext: context,
    recommendedTeacherRouteId: "existing_low_token_coverage_review",
    nextEvidenceAwareAction:
      context.coverageArtifactsReady && context.allRowsHaveReviewableSourceRoute && context.readinessPackageReady
        ? "Open the coverage review receipt first; after the teacher confirms coverage or exclusions and rollback is retained, select the recurring monitor teacher-confirmation route."
        : "Open the coverage evidence dossier and waiting-row cockpit first; resolve missing log-source routes or coverage artifacts before recurring monitor planning.",
    recommendedRouteOrder: [
      route({
        routeId: "existing_low_token_coverage_review",
        routeKind: "coverage_before_monitor",
        whenToUse:
          "Use first when the objective still lacks all-software coverage, teacher exclusions, or returned evidence for blocked waiting rows.",
        commandTemplate: command("create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs", [
          ["--dossier", "<low-token-coverage-evidence-dossier.json>"]
        ]),
        downstreamEvidence:
          "coverage evidence dossier receipt -> waiting-row or fallback-route evidence return -> refreshed objective audit",
        missingBeforeUse: [
          "current coverage dossier or cockpit evidence",
          "teacher-reviewed exclusions for software that must not be observed",
          "evidence-return receipts for blocked waiting rows"
        ]
      }, context),
      route({
        routeId: "existing_recurring_monitor_teacher_confirmation",
        routeKind: "teacher_confirmation_before_registration",
        whenToUse:
          "Use after coverage evidence is reviewed and the teacher wants recurring low-token observation without continuous recording.",
        commandTemplate: command("create-all-software-recurring-monitor-teacher-confirmation-package.mjs", [
          ["--readiness-package", "<real-local-all-software-low-token-readiness-package.json>"],
          ["--rollback-point", "<retained-rollback-point>"]
        ]),
        validationTemplate: command("validate-all-software-recurring-monitor-teacher-confirmation-receipt.mjs", [
          ["--package", "<recurring-monitor-teacher-confirmation-package.json>"],
          ["--receipt", "<teacher-filled-recurring-monitor-confirmation-receipt.json>"]
        ]),
        downstreamEvidence:
          "teacher confirmation validation with no continuous recording, no screenshot by default, rollback retained, and low-token scope reviewed",
        missingBeforeUse: [
          "readiness package",
          "teacher-filled recurring monitor confirmation receipt",
          "retained rollback point"
        ]
      }, context),
      route({
        routeId: "existing_recurring_monitor_registration_runner_template",
        routeKind: "registration_after_validated_teacher_confirmation",
        whenToUse:
          "Use only after the teacher-confirmation receipt validates as ready for registration planning.",
        commandTemplate: command("run-all-software-recurring-monitor-registration-runner.mjs", [
          ["--validation", "<validated-recurring-monitor-teacher-confirmation-receipt.json>"],
          ["--teacher-confirmation", "teacher confirmed recurring low-token monitor registration"]
        ]),
        downstreamEvidence:
          "registration runner result plus scheduled task evidence; the bridge itself never registers anything",
        missingBeforeUse: [
          "validated recurring monitor teacher confirmation receipt",
          "teacher confirmation text",
          "rollback point still retained"
        ]
      }, context),
      route({
        routeId: "existing_recurring_monitor_status_verifier",
        routeKind: "read_only_registration_status_check",
        whenToUse: "Use after a separate registration runner claims a monitor was registered.",
        commandTemplate: command("verify-all-software-recurring-monitor-registration-status.mjs", [
          ["--registration", "<registration-runner-result.json>"]
        ]),
        downstreamEvidence: "read-only registration status packet, not a learning claim",
        missingBeforeUse: ["registration runner result", "expected task or monitor id"]
      }, context),
      route({
        routeId: "existing_recurring_monitor_run_output_audit",
        routeKind: "run_output_before_learning_claim",
        whenToUse:
          "Use after the monitor has produced run output that should be audited before any automatic learning claim.",
        commandTemplate: command("audit-all-software-recurring-monitor-run-output.mjs", [
          ["--registration", "<registration-status-verification.json>"],
          ["--run-output", "<recurring-monitor-run-output.json>"]
        ]),
        downstreamEvidence:
          "run-output audit -> teacher review packet -> objective fulfillment audit refresh; still no memory write without approval",
        missingBeforeUse: ["registration status verification", "bounded recurring monitor run output", "teacher review plan"]
      }, context)
    ],
    missingBeforeCompletion: [
      ...new Set([...(Array.isArray(item.missingBeforeCompletion) ? item.missingBeforeCompletion : []), ...sharedMissing])
    ],
    blockedActions: [
      "run_monitor_from_low_token_bridge",
      "register_task_from_low_token_bridge",
      "launch_runner_from_low_token_bridge",
      "read_logs_from_low_token_bridge",
      "read_full_logs_from_low_token_bridge",
      "capture_screenshot_from_low_token_bridge",
      "record_screen_from_low_token_bridge",
      "write_memory_from_low_token_bridge",
      "enable_rule_from_low_token_bridge",
      "claim_all_software_learning_complete_from_low_token_bridge",
      "claim_goal_complete_from_low_token_bridge"
    ],
    locks: locks()
  };
}

function writeReadme(path, packet) {
  const lines = [
    "# Original Goal Low-Token Monitor Command Bridge",
    "",
    `Status: ${packet.status}`,
    `Source queue: ${packet.sourceQueuePath}`,
    "",
    "This bridge maps the unfinished all-software low-token learning objective to existing coverage, teacher-confirmation, registration, status-verification, and run-output audit gates.",
    "It is not a monitor, registration runner, log reader, screenshot capturer, memory writer, or completion proof.",
    "",
    "Evidence-aware route state:",
    `- Source refresh: ${packet.evidenceContext.sourceRefreshPath || "(none)"}`,
    `- Log-source discovery: ${packet.evidenceContext.logSourceDiscoveryStatus || "(unknown)"}`,
    `- Missing log-source rows: ${packet.evidenceContext.logSourceMissingRows ?? "(unknown)"}`,
    `- Coverage artifacts ready: ${packet.evidenceContext.coverageArtifactsReady}`,
    `- Readiness package ready: ${packet.evidenceContext.readinessPackageReady}`,
    `- Recommended teacher route: ${packet.recommendedTeacherRouteId}`,
    `- Next evidence-aware action: ${packet.nextEvidenceAwareAction}`,
    "",
    "Recommended route order:"
  ];
  for (const route of packet.recommendedRouteOrder) {
    lines.push("", `## ${route.routeId}`, `Route status: ${route.routeStatus}`, route.whenToUse, "", "Command template:", route.commandTemplate);
    if (route.validationTemplate) lines.push("", "Validation template:", route.validationTemplate);
    if (Object.keys(route.evidenceAlreadyAvailable || {}).length) {
      lines.push("", "Evidence already available:");
      for (const [key, value] of Object.entries(route.evidenceAlreadyAvailable)) lines.push(`- ${key}: ${value || ""}`);
    }
    lines.push("", "Missing before use:");
    for (const missing of route.missingBeforeUse) lines.push(`- ${missing}`);
  }
  lines.push("", "Still missing before objective completion:");
  for (const missing of packet.missingBeforeCompletion) lines.push(`- ${missing}`);
  lines.push(
    "",
    "Locked boundary: this bridge does not run commands, register tasks, launch runners, read logs, read full logs, capture screenshots, record the screen, execute target software, write memory, enable rules, unlock packaging, or claim completion."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  const routes = packet.recommendedRouteOrder
    .map(
      (route) => `<section class="panel">
  <h2>${htmlEscape(route.routeId)}</h2>
  <p><strong>Route status:</strong> ${htmlEscape(route.routeStatus || "")}</p>
  <p>${htmlEscape(route.whenToUse)}</p>
  <p><strong>Downstream evidence:</strong> ${htmlEscape(route.downstreamEvidence)}</p>
  <p><strong>Evidence already available:</strong> ${htmlEscape(JSON.stringify(route.evidenceAlreadyAvailable || {}))}</p>
  <pre>${htmlEscape(route.commandTemplate)}</pre>
  ${route.validationTemplate ? `<pre>${htmlEscape(route.validationTemplate)}</pre>` : ""}
  <ul>${route.missingBeforeUse.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
</section>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Original Goal Low-Token Monitor Command Bridge</title>
  <style>
    body { margin: 0; font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f8fafc; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    .panel { background: white; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; margin: 12px 0; }
    pre { white-space: pre-wrap; background: #eef2f7; border-radius: 6px; padding: 10px; overflow-wrap: anywhere; }
    a { color: #174d89; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Low-Token Monitor Command Bridge</h1>
  <p>Status: <code>${htmlEscape(packet.status)}</code></p>
  <p>Source queue: <a href="${htmlEscape(fileHref(packet.sourceQueuePath))}">${htmlEscape(basename(packet.sourceQueuePath))}</a></p>
  <p><strong>Recommended teacher route:</strong> <code>${htmlEscape(packet.recommendedTeacherRouteId)}</code></p>
  <p><strong>Next evidence-aware action:</strong> ${htmlEscape(packet.nextEvidenceAwareAction)}</p>
  <p><strong>Evidence context:</strong> log-source status <code>${htmlEscape(packet.evidenceContext.logSourceDiscoveryStatus || "")}</code>, missing rows <code>${htmlEscape(packet.evidenceContext.logSourceMissingRows ?? "")}</code>, coverage artifacts ready <code>${htmlEscape(packet.evidenceContext.coverageArtifactsReady)}</code>, readiness package ready <code>${htmlEscape(packet.evidenceContext.readinessPackageReady)}</code>.</p>
  <p>This bridge selects existing low-token monitor gates. It does not register monitors, read logs, capture screenshots, write memory, or complete the goal.</p>
  ${routes}
</main>
</body>
</html>`,
    "utf8"
  );
}

const queuePath = resolveQueuePath(argValue("--queue", argValue("--queue-path", "")));
const queue = readJson(queuePath);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-monitor-command-bridges"))
);
const bridgeId = `${new Date().toISOString().replace(/[:.]/g, "-")}-lt-monitor-bridge-${slugify(queue.queueId || "queue").slice(0, 16)}`;
const bridgeDir = join(outputRoot, bridgeId);
mkdirSync(outputRoot, { recursive: true });
mkdirSync(bridgeDir, { recursive: true });

const packet = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_monitor_command_bridge_v1",
  bridgeId,
  ...buildBridge(queue, queuePath),
  paths: {}
};
packet.paths.bridge = join(bridgeDir, "original-goal-low-token-monitor-command-bridge.json");
packet.paths.html = join(bridgeDir, "original-goal-low-token-monitor-command-bridge.html");
packet.paths.readme = join(bridgeDir, "ORIGINAL_GOAL_LOW_TOKEN_MONITOR_COMMAND_BRIDGE_START_HERE.md");

writeReadme(packet.paths.readme, packet);
writeHtml(packet.paths.html, packet);
writeFileSync(packet.paths.bridge, `${JSON.stringify(packet, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_monitor_command_bridge_result_v1",
      bridgePath: packet.paths.bridge,
      htmlPath: packet.paths.html,
      readmePath: packet.paths.readme,
      status: packet.status,
      routes: packet.recommendedRouteOrder.length,
      recommendedTeacherRouteId: packet.recommendedTeacherRouteId,
      coverageArtifactsReady: packet.evidenceContext.coverageArtifactsReady,
      readinessPackageReady: packet.evidenceContext.readinessPackageReady,
      logSourceMissingRows: packet.evidenceContext.logSourceMissingRows,
      completionAllowed: packet.completionAllowed
    },
    null,
    2
  )
);
