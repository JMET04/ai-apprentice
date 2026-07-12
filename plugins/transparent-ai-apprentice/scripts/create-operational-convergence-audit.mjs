#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function newestFile(root, fileName) {
  if (!existsSync(root)) return "";
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(root);
  return found.sort((a, b) => b.time - a.time)[0]?.path || "";
}

function newestAny(repoRoot, roots, fileName) {
  for (const root of roots) {
    const path = newestFile(join(repoRoot, "artifacts", root), fileName);
    if (path) return path;
  }
  return "";
}

function slugify(value) {
  const slug =
    String(value || "operational-convergence-audit")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84)
      .replace(/[.\s-]+$/g, "") || "operational-convergence-audit";
  return slug.replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, `${slug}-audit`);
}

function exists(path) {
  return Boolean(path && existsSync(path) && statSync(path).isFile());
}

function statusRow(id, label, passed, evidence = "", blocker = "") {
  return { id, label, passed: Boolean(passed), evidence, blocker: passed ? "" : blocker };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return exists(path) ? pathToFileURL(path).href : "";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    auditDoesNotRegisterTask: true,
    auditDoesNotStartTask: true,
    auditDoesNotLaunchRunner: true,
    auditDoesNotReadLogs: true,
    auditDoesNotReadFullLogs: true,
    auditDoesNotCaptureScreenshots: true,
    auditDoesNotExecuteTargetSoftware: true,
    auditDoesNotWriteMemory: true,
    auditDoesNotEnableRules: true,
    auditDoesNotDeleteRollbackPoints: true,
    scheduledTaskRegistered: false,
    scheduledTaskStarted: false,
    runnerLaunched: false,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    unattendedAllAppMonitoringComplete: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function sourceSummary(path, packet) {
  return {
    path: path || "",
    exists: Boolean(packet),
    format: packet?.format || "",
    status: packet?.status || "",
    goalComplete: packet?.locks?.goalComplete === true || packet?.goalComplete === true,
    registersTask: packet?.locks?.scheduledTaskInstalled === true || packet?.scheduledTaskInstalled === true || packet?.taskRegistered === true,
    launchesRunner: packet?.locks?.runnerLaunched === true,
    readsLogs: packet?.locks?.logContentsRead === true || packet?.locks?.fullLogsRead === true,
    capturesScreenshots: packet?.locks?.screenshotsCaptured === true,
    executesTargetSoftware: packet?.locks?.softwareActionsExecuted === true || packet?.locks?.targetSoftwareCommandsExecuted === true,
    writesMemory: packet?.locks?.memoryWritten === true || packet?.locks?.longTermMemoryWritten === true
  };
}

function writeReadme(path, audit) {
  const lines = [
    "# Operational Convergence Audit",
    "",
    `Status: ${audit.status}`,
    `Passed checks: ${audit.summary.passedChecks}/${audit.summary.totalChecks}`,
    `Unattended ready: ${audit.summary.unattendedReady}`,
    `Task registered: ${audit.operational.taskRegistered}`,
    "",
    "This audit proves the operational evidence is converged for teacher review. It does not register a scheduled task, start a runner, read logs, capture screenshots, execute target software, write memory, enable rules, or claim unattended completion.",
    "",
    "Operational counts:",
    `- lanes: ${audit.operational.statusLaneCount}`,
    `- reviewed runs: ${audit.operational.reviewedRunCount}`,
    `- compact learning events: ${audit.operational.compactLearningEvents}`,
    `- teacher review ready: ${audit.operational.teacherReviewReady}`,
    `- replay ready: ${audit.operational.replayReady}`,
    `- remaining gaps: ${audit.operational.remainingGapCount}`,
    "",
    "Checks:",
    ...audit.checks.map((row) => `- ${row.passed ? "PASS" : "BLOCKED"} ${row.id}: ${row.label}${row.blocker ? ` (${row.blocker})` : ""}`),
    "",
    "Next teacher action:",
    audit.nextTeacherAction,
    "",
    "Blocked actions:",
    ...audit.blockedActions.map((item) => `- ${item}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, audit) {
  const rows = audit.checks
    .map(
      (row) =>
        `<tr><td>${htmlEscape(row.id)}</td><td>${row.passed ? "PASS" : "BLOCKED"}</td><td>${htmlEscape(row.label)}</td><td>${htmlEscape(row.blocker)}</td></tr>`
    )
    .join("\n");
  const links = audit.primaryOpenOrder
    .map((item) => {
      const href = fileHref(item.path);
      return `<li>${htmlEscape(item.label)}: ${href ? `<a href="${href}">${htmlEscape(item.path)}</a>` : htmlEscape(item.path || "missing")}</li>`;
    })
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html><html><head><meta charset="utf-8"><title>Operational Convergence Audit</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:1120px;margin:32px auto;padding:0 20px;line-height:1.45}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}code{background:#f3f3f3;padding:2px 4px}</style></head><body><h1>Operational Convergence Audit</h1><p>Status: <code>${htmlEscape(audit.status)}</code></p><p>Passed checks: ${audit.summary.passedChecks}/${audit.summary.totalChecks}. Unattended ready: ${audit.summary.unattendedReady}</p><h2>Open Evidence</h2><ol>${links}</ol><h2>Operational Counts</h2><pre>${htmlEscape(JSON.stringify(audit.operational, null, 2))}</pre><h2>Checks</h2><table><thead><tr><th>Id</th><th>Status</th><th>Check</th><th>Blocker</th></tr></thead><tbody>${rows}</tbody></table></body></html>\n`,
    "utf8"
  );
}

const repoRoot = resolve(argValue("--repo-root", process.cwd()));
const goal = argValue("--goal", "Audit all-software operational convergence before unattended monitor registration or runner launch.");
const finalReviewPackPath = resolve(
  argValue(
    "--operational-final-review-pack",
    newestFile(join(repoRoot, "artifacts", "current-goal-operational-final-review-packs"), "operational-final-review-pack.json")
  )
);
const statusConsolePath = resolve(
  argValue(
    "--status-console",
    newestFile(join(repoRoot, "artifacts", "current-goal-operational-status-consoles"), "all-software-operational-status-console.json")
  )
);
const registrationStatusPath = resolve(
  argValue(
    "--registration-status",
    newestAny(repoRoot, ["current-goal-recurring-monitor-registration-status", "all-software-recurring-monitor-registration-status"], "recurring-monitor-registration-status.json")
  )
);
const runOutputAuditPath = resolve(
  argValue(
    "--run-output-audit",
    newestAny(repoRoot, ["current-goal-recurring-monitor-run-output-audits", "all-software-recurring-monitor-run-output-audits"], "recurring-monitor-run-output-audit.json")
  )
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-operational-convergence-audits")));

const finalReviewPack = exists(finalReviewPackPath) ? readJson(finalReviewPackPath) : null;
const statusConsole = exists(statusConsolePath) ? readJson(statusConsolePath) : null;
const registrationStatus = exists(registrationStatusPath) ? readJson(registrationStatusPath) : null;
const runOutputAudit = exists(runOutputAuditPath) ? readJson(runOutputAuditPath) : null;
const opSummary = finalReviewPack?.operationalSummary || {};
const opProof = statusConsole?.operationalProof || {};
const lanes = Array.isArray(statusConsole?.lanes) ? statusConsole.lanes : [];
const remainingGaps = Array.isArray(finalReviewPack?.remainingGaps) ? finalReviewPack.remainingGaps : [];
const reviewedRunCount = Number(opSummary.reviewedRunCount ?? runOutputAudit?.reviewedRunCount ?? 0);
const compactLearningEvents = Number(opSummary.compactLearningEvents ?? runOutputAudit?.totals?.compactLearningEvents ?? 0);
const taskRegistered = Boolean(opProof.taskRegistered || registrationStatus?.taskRegistered || registrationStatus?.scheduledTaskInstalled);
const teacherReviewReady = Boolean(opProof.teacherReviewReady || opSummary.teacherReviewItems > 0);
const replayReady = Boolean(opProof.replayReady || opSummary.replayItems > 0);
const unattendedReady = Boolean(opProof.unattendedReady || opSummary.unattendedAllAppMonitoringComplete);

const sources = {
  finalReviewPack: sourceSummary(finalReviewPackPath, finalReviewPack),
  statusConsole: sourceSummary(statusConsolePath, statusConsole),
  registrationStatus: sourceSummary(registrationStatusPath, registrationStatus),
  runOutputAudit: sourceSummary(runOutputAuditPath, runOutputAudit)
};
const unsafeSource = Object.values(sources).some(
  (source) =>
    source.goalComplete ||
    source.registersTask ||
    source.launchesRunner ||
    source.readsLogs ||
    source.capturesScreenshots ||
    source.executesTargetSoftware ||
    source.writesMemory
);

const checks = [
  statusRow("operational_final_review_pack_present", "Operational final review pack is present.", Boolean(finalReviewPack), finalReviewPackPath, "missing_operational_final_review_pack"),
  statusRow("status_console_present", "Operational status console is present.", Boolean(statusConsole), statusConsolePath, "missing_status_console"),
  statusRow("status_lanes_present", "Status console exposes at least ten operational lanes.", lanes.length >= 10, String(lanes.length), "status_lanes_missing"),
  statusRow("reviewed_output_present", "At least one reviewed run output is present.", reviewedRunCount >= 1, String(reviewedRunCount), "reviewed_run_output_missing"),
  statusRow("compact_learning_events_present", "Compact learning events exist for low-token review.", compactLearningEvents >= 1, String(compactLearningEvents), "compact_learning_events_missing"),
  statusRow("teacher_review_loop_present", "Teacher review packet or replay queue is ready.", teacherReviewReady && replayReady, `teacherReview=${teacherReviewReady}; replay=${replayReady}`, "teacher_review_loop_missing"),
  statusRow("registration_status_boundary_present", "Registration status exists and proves the task is not registered yet.", Boolean(registrationStatus) && taskRegistered === false, registrationStatusPath, "registration_status_missing_or_registered"),
  statusRow("run_output_audit_present", "Run-output audit exists and is waiting for teacher review.", Boolean(runOutputAudit) && String(runOutputAudit.status || "").includes("teacher_review"), runOutputAuditPath, "run_output_audit_missing"),
  statusRow("remaining_gaps_explicit", "Remaining unattended gaps are explicit before any completion claim.", remainingGaps.length >= 1 || Number(opSummary.remainingGapCount || 0) >= 1, String(remainingGaps.length || opSummary.remainingGapCount || 0), "remaining_gaps_missing"),
  statusRow("unattended_completion_locked", "Unattended all-app monitoring is not claimed complete.", unattendedReady === false && finalReviewPack?.locks?.unattendedAllAppMonitoringComplete === false, "unattended locked", "unattended_completion_not_locked"),
  statusRow("review_only_locks_closed", "Sources do not register tasks, launch runners, read logs, capture screenshots, execute software, write memory, or claim completion.", !unsafeSource, "locks", "unsafe_source_lock_detected")
];

const failed = checks.filter((row) => !row.passed);
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });
const auditPath = join(auditDir, "operational-convergence-audit.json");
const receiptTemplatePath = join(auditDir, "operational-convergence-audit-receipt-template.json");
const readmePath = join(auditDir, "OPERATIONAL_CONVERGENCE_AUDIT_START_HERE.md");
const htmlPath = join(auditDir, "operational-convergence-audit.html");
const lockState = locks();

const audit = {
  ok: failed.length === 0,
  format: "transparent_ai_operational_convergence_audit_v1",
  auditId,
  createdAt: new Date().toISOString(),
  goal,
  status: failed.length
    ? "blocked_waiting_for_operational_convergence_evidence"
    : "operational_convergence_ready_for_teacher_review_not_unattended_completion",
  summary: {
    totalChecks: checks.length,
    passedChecks: checks.length - failed.length,
    blockedChecks: failed.length,
    unattendedReady,
    finalGoalCompletionAllowed: false
  },
  operational: {
    statusLaneCount: lanes.length,
    reviewedRunCount,
    compactLearningEvents,
    teacherReviewReady,
    replayReady,
    taskRegistered,
    unattendedReady,
    remainingGapCount: remainingGaps.length || Number(opSummary.remainingGapCount || 0)
  },
  sourceEvidence: sources,
  checks,
  blockers: failed.map((row) => `${row.id}:${row.blocker}`),
  nextTeacherAction:
    "Review the operational final pack, explicitly approve recurring monitor scope and registration, then validate run output before claiming unattended all-software learning.",
  primaryOpenOrder: [
    { label: "Operational Final Review Pack", path: finalReviewPackPath },
    { label: "Operational Status Console", path: statusConsolePath },
    { label: "Recurring Monitor Registration Status", path: registrationStatusPath },
    { label: "Recurring Monitor Run Output Audit", path: runOutputAuditPath }
  ],
  blockedActions: [
    "claim_unattended_operational_completion_from_audit",
    "register_task_from_audit",
    "start_task_from_audit",
    "launch_runner_from_audit",
    "read_logs_from_audit",
    "capture_screenshot_from_audit",
    "execute_target_software_from_audit",
    "write_memory_from_audit",
    "enable_rule_from_audit",
    "delete_rollback_points_from_audit",
    "unlock_packaging_from_audit"
  ],
  completionBoundary: {
    goalComplete: false,
    finalGoalCompletionAllowed: false,
    reason:
      "This audit proves operational evidence convergence only. Completion still requires explicit teacher registration approval, matching scheduled task evidence, reviewed run-output evidence, and final teacher acceptance."
  },
  paths: {
    audit: auditPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  },
  locks: lockState
};

const receiptTemplate = {
  format: "transparent_ai_operational_convergence_audit_receipt_template_v1",
  auditId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "ready_for_registration_scope_review", "blocked_needs_more_operational_evidence"],
  forbiddenTeacherDecisions: [
    "accepted",
    "claim_complete",
    "register_task_now",
    "start_task_now",
    "launch_runner_now",
    "read_logs_now",
    "capture_screenshot_now",
    "execute_target_software",
    "write_memory",
    "enable_rule",
    "delete_rollback_points",
    "unlock_packaging"
  ],
  reviewRows: checks.map((row) => ({
    checkId: row.id,
    passed: row.passed,
    teacherReviewed: false,
    teacherNote: ""
  })),
  locks: lockState
};

writeJson(auditPath, audit);
writeJson(receiptTemplatePath, receiptTemplate);
writeReadme(readmePath, audit);
writeHtml(htmlPath, audit);

console.log(
  JSON.stringify(
    {
      ok: audit.ok,
      format: "transparent_ai_operational_convergence_audit_result_v1",
      status: audit.status,
      auditPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      summary: audit.summary,
      operational: audit.operational,
      blockers: audit.blockers,
      locks: audit.locks
    },
    null,
    2
  )
);
