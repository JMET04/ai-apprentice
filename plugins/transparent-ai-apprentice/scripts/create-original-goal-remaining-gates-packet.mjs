#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return String(value || "original-goal-remaining-gates")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "original-goal-remaining-gates";
}

function readJson(path, label, required = false) {
  if (!path || !existsSync(path)) {
    if (required) throw new Error(`${label} is required: ${path || "(missing)"}`);
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function resolveMaybe(path) {
  return path ? resolve(path) : "";
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? `file:///${path.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}` : "";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packetDoesNotValidateReceipts: true,
    packetDoesNotRunCommands: true,
    packetDoesNotRegisterTask: true,
    packetDoesNotLaunchRunner: true,
    packetDoesNotExecuteTargetSoftware: true,
    packetDoesNotCaptureScreenshots: true,
    packetDoesNotReadFullLogs: true,
    packetDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function summarizeGateRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const lane = row.downstreamLane || row.lane || "unclassified";
    const group = groups.get(lane) || {
      lane,
      rowCount: 0,
      firstStatus: row.currentStatus || row.status || "",
      firstNextAction: row.nextAction || row.nextSafeActionLabel || "",
      firstEvidencePath: row.evidencePath || "",
      waitingForTeacher: 0,
      rowIds: []
    };
    group.rowCount += 1;
    if (String(row.teacherDecision || "").includes("needs_teacher_review")) group.waitingForTeacher += 1;
    if (group.rowIds.length < 8) group.rowIds.push(row.id || "");
    if (!group.firstStatus && (row.currentStatus || row.status)) group.firstStatus = row.currentStatus || row.status;
    if (!group.firstNextAction && (row.nextAction || row.nextSafeActionLabel)) {
      group.firstNextAction = row.nextAction || row.nextSafeActionLabel;
    }
    if (!group.firstEvidencePath && row.evidencePath) group.firstEvidencePath = row.evidencePath;
    groups.set(lane, group);
  }
  return [...groups.values()].sort((a, b) => b.rowCount - a.rowCount || a.lane.localeCompare(b.lane));
}

function compactRouteRows(rows) {
  return rows.slice(0, 12).map((row) => ({
    order: row.order || 0,
    id: row.id || "",
    lane: row.lane || "",
    reviewEntryId: row.reviewEntryId || "",
    openPath: row.openPath || "",
    validationCommand: row.validationCommand || "",
    teacherInstruction: row.teacherInstruction || "",
    doneCondition: row.doneCondition || "",
    stopCondition: row.stopCondition || "",
    coveredRowCount: row.coveredRowCount || array(row.coveredRows).length,
    screenshotCostClass: row.screenshotCostClass || "unknown"
  }));
}

function compactLowTokenActions(rows) {
  return rows.slice(0, 8).map((row) => ({
    id: row.id || "",
    route: row.route || "",
    priority: row.priority ?? null,
    estimatedTokenCost: row.estimatedTokenCost ?? null,
    screenshotCostClass: row.screenshotCostClass || "",
    status: row.status || "",
    software: row.software || "",
    reason: row.reason || "",
    evidencePath: row.evidencePath || "",
    nextTool: row.nextTool || "",
    nextInstruction: row.nextInstruction || ""
  }));
}

function writeHtml(path, packet) {
  const gates = packet.gateGroups
    .map(
      (row) => `
      <tr>
        <td>${htmlEscape(row.lane)}</td>
        <td>${htmlEscape(row.rowCount)}</td>
        <td>${htmlEscape(row.firstStatus)}</td>
        <td>${htmlEscape(row.firstNextAction)}</td>
      </tr>`
    )
    .join("");
  const routes = packet.shortestTeacherRoute
    .map(
      (row) => `
      <tr>
        <td>${htmlEscape(row.order)}</td>
        <td>${htmlEscape(row.lane)}</td>
        <td>${htmlEscape(row.reviewEntryId)}</td>
        <td><a href="${htmlEscape(fileHref(row.openPath))}">${htmlEscape(row.openPath ? basename(row.openPath) : "")}</a></td>
        <td>${htmlEscape(row.teacherInstruction)}</td>
      </tr>`
    )
    .join("");
  const lowToken = packet.nextLowTokenActions
    .map(
      (row) => `
      <tr>
        <td>${htmlEscape(row.id)}</td>
        <td>${htmlEscape(row.estimatedTokenCost)}</td>
        <td>${htmlEscape(row.screenshotCostClass)}</td>
        <td>${htmlEscape(row.software)}</td>
        <td>${htmlEscape(row.nextInstruction)}</td>
      </tr>`
    )
    .join("");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Original Goal Remaining Gates Packet</title>
  <style>
    body { margin: 0; font: 14px/1.45 system-ui, sans-serif; color: #17202a; background: #f7f9fb; }
    main { max-width: 1160px; margin: 0 auto; padding: 24px; }
    section { margin: 16px 0 22px; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { border: 1px solid #d8e0ea; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #edf2f7; }
    code { background: #eef3f8; padding: 2px 4px; border-radius: 4px; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Original Goal Remaining Gates Packet</h1>
    <section>
      <p><strong>Status:</strong> ${htmlEscape(packet.status)}</p>
      <p><strong>Completion decision:</strong> ${htmlEscape(packet.completionBoundary.completionDecision)}</p>
      <p><strong>Next safe action:</strong> ${htmlEscape(packet.nextSafeAction)}</p>
      <p><strong>Source refresh:</strong> <a href="${htmlEscape(fileHref(packet.sourceEvidence.statusRefresh))}">${htmlEscape(packet.sourceEvidence.statusRefresh)}</a></p>
    </section>
    <section>
      <h2>Real Local Low-Token Evidence</h2>
      <p>Candidates: <code>${htmlEscape(packet.realLocalReadiness.counts.realLocalCandidates)}</code>;
      queued: <code>${htmlEscape(packet.realLocalReadiness.counts.queuedSoftware)}</code>;
      compact events: <code>${htmlEscape(packet.realLocalReadiness.counts.compactLearningEvents)}</code>;
      triggered visual requests: <code>${htmlEscape(packet.realLocalReadiness.counts.triggeredVisualRequests)}</code>.</p>
    </section>
    <section>
      <h2>Grouped Remaining Gates</h2>
      <table><thead><tr><th>Lane</th><th>Rows</th><th>Status</th><th>Next Action</th></tr></thead><tbody>${gates}</tbody></table>
    </section>
    <section>
      <h2>Shortest Teacher Route</h2>
      <table><thead><tr><th>Order</th><th>Lane</th><th>Entry</th><th>Open</th><th>Instruction</th></tr></thead><tbody>${routes}</tbody></table>
    </section>
    <section>
      <h2>Low-Token Actions Before Screenshots</h2>
      <table><thead><tr><th>ID</th><th>Token</th><th>Screenshot</th><th>Software</th><th>Instruction</th></tr></thead><tbody>${lowToken}</tbody></table>
    </section>
    <p class="lock">This packet only summarizes existing evidence. It does not validate receipts, run commands, register schedules, capture screenshots, execute target software, write memory, accept technology, unlock packaging, or claim completion.</p>
  </main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

const statusRefreshInput = argValue("--status-refresh", argValue("--refresh", ""));
if (!statusRefreshInput) {
  throw new Error("Usage: node create-original-goal-remaining-gates-packet.mjs --status-refresh <original-goal-current-status-refresh.json>");
}
const statusRefreshPath = resolve(statusRefreshInput);
const refresh = readJson(statusRefreshPath, "--status-refresh", true);
const goal = argValue("--goal", refresh.goal || "Summarize remaining original-goal gates with low-token evidence.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-remaining-gates-packets"))
);
const packetId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packetDir = join(outputRoot, packetId);
mkdirSync(packetDir, { recursive: true });

const gapBoardPath = resolveMaybe(argValue("--gap-board", refresh.paths?.gapActionBoard || ""));
const routerPath = resolveMaybe(argValue("--router", refresh.paths?.teacherActionRouter || ""));
const readinessPath = resolveMaybe(argValue("--real-local-readiness-package", refresh.paths?.realLocalAllSoftwareLowTokenReadinessPackage || ""));
const lowTokenBudgetPath = resolveMaybe(argValue("--low-token-budget-plan", refresh.paths?.lowTokenTriggerBudgetPlan || ""));
const reviewHealthPath = resolveMaybe(argValue("--review-health", refresh.paths?.reviewEntrypointHealthAudit || ""));

const gapBoard = readJson(gapBoardPath, "--gap-board");
const router = readJson(routerPath, "--router");
const readiness = readJson(readinessPath, "--real-local-readiness-package");
const lowTokenBudget = readJson(lowTokenBudgetPath, "--low-token-budget-plan");
const reviewHealth = readJson(reviewHealthPath, "--review-health");

const actionRows = array(gapBoard?.actionRows || gapBoard?.rows);
const routeRows = array(router?.routeRows);
const lowTokenActions = array(lowTokenBudget?.selectedActions);
const packetLocks = locks();

const packet = {
  ok: true,
  format: "transparent_ai_original_goal_remaining_gates_packet_v1",
  packetId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_remaining_gate_review",
  purpose:
    "Compact the current original-goal blockers into the fewest teacher-review lanes while preserving low-token, no-execution, and no-completion boundaries.",
  sourceEvidence: {
    statusRefresh: statusRefreshPath,
    gapActionBoard: gapBoardPath,
    teacherActionRouter: routerPath,
    realLocalReadinessPackage: readinessPath,
    lowTokenBudgetPlan: lowTokenBudgetPath,
    reviewEntrypointHealthAudit: reviewHealthPath
  },
  completionBoundary: {
    completionDecision: refresh.completionDecision || "",
    nativeUniversalExecution: false,
    goalComplete: false,
    reason:
      "Universal native execution and unattended all-app coverage remain unproven until teacher-reviewed coverage, execution, activation, and spatial evidence all pass their gates."
  },
  evidenceHealth: {
    reviewEntrypointHealthStatus: reviewHealth?.status || refresh.refreshedEvidence?.reviewEntrypointHealthAuditStatus || "",
    checkedReviewEntrypoints: reviewHealth?.checked || refresh.refreshedEvidence?.reviewEntrypointHealthAuditChecked || 0,
    failedRequiredReviewEntrypoints: reviewHealth?.failedRequired || refresh.refreshedEvidence?.reviewEntrypointHealthAuditFailedRequired || 0
  },
  counts: {
    statusLanes: refresh.refreshedEvidence?.statusLaneCount || array(refresh.refreshedEvidence?.statusLanes).length,
    blockedOrWaitingLanes: refresh.refreshedEvidence?.blockedOrWaitingLaneCount || 0,
    gapRows: actionRows.length,
    gateGroups: summarizeGateRows(actionRows).length,
    teacherRouteRows: routeRows.length,
    lowTokenSelectedActions: lowTokenActions.length,
    lowTokenEstimatedCost: lowTokenBudget?.selectedEstimatedTokenCost ?? refresh.refreshedEvidence?.lowTokenTriggerBudgetPlanSelectedEstimatedTokenCost ?? null
  },
  realLocalReadiness: {
    status: readiness?.status || "",
    path: readinessPath,
    readme: readiness?.paths?.readme || "",
    receipt: dirname(readinessPath) ? join(dirname(readinessPath), "real-local-all-software-low-token-readiness-receipt.json") : "",
    counts: readiness?.counts || {},
    locks: readiness?.locks || {}
  },
  gateGroups: summarizeGateRows(actionRows),
  shortestTeacherRoute: compactRouteRows(routeRows),
  nextLowTokenActions: compactLowTokenActions(lowTokenActions),
  statusLanes: array(refresh.refreshedEvidence?.statusLanes).map((lane) => ({
    id: lane.id || "",
    status: lane.status || "",
    detail: lane.detail || ""
  })),
  nextSafeAction: refresh.nextSafeAction || "",
  blockedActions: [
    "validate_receipts_without_teacher_review",
    "register_scheduled_task_from_remaining_gates_packet",
    "launch_runner_from_remaining_gates_packet",
    "capture_screenshot_from_remaining_gates_packet",
    "execute_target_software_from_remaining_gates_packet",
    "write_memory_from_remaining_gates_packet",
    "claim_original_goal_complete_from_remaining_gates_packet"
  ],
  locks: packetLocks
};

const packetPath = join(packetDir, "original-goal-remaining-gates-packet.json");
const htmlPath = join(packetDir, "original-goal-remaining-gates-packet.html");
const readmePath = join(packetDir, "ORIGINAL_GOAL_REMAINING_GATES_START_HERE.md");

packet.paths = {
  packet: packetPath,
  html: htmlPath,
  readme: readmePath
};

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeHtml(htmlPath, packet);
writeFileSync(
  readmePath,
  [
    "# Original Goal Remaining Gates Packet",
    "",
    `Status: ${packet.status}`,
    `Completion decision: ${packet.completionBoundary.completionDecision}`,
    "",
    "Open in this order:",
    `1. HTML packet: ${htmlPath}`,
    `2. Source current-status refresh: ${statusRefreshPath}`,
    `3. Teacher action router: ${routerPath}`,
    `4. Gap action board: ${gapBoardPath}`,
    "",
    "This packet is low-token summary evidence only. It does not run commands, validate receipts, capture screenshots, execute software, write memory, unlock packaging, or claim completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_remaining_gates_packet_result_v1",
      packetId,
      status: packet.status,
      packetPath,
      htmlPath,
      readmePath,
      counts: packet.counts,
      completionDecision: packet.completionBoundary.completionDecision,
      locks: packetLocks
    },
    null,
    2
  )
);
