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

function slugify(value) {
  const slug =
    String(value || "low-token-coverage-convergence-audit")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84)
      .replace(/[.\s-]+$/g, "") || "low-token-coverage-convergence-audit";
  return slug.replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, `${slug}-audit`);
}

function exists(path) {
  return Boolean(path && existsSync(path));
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
    auditDoesNotRunCommands: true,
    auditDoesNotRegisterMonitor: true,
    auditDoesNotReadLogs: true,
    auditDoesNotReadFullLogs: true,
    auditDoesNotCaptureScreenshots: true,
    auditDoesNotRecordScreen: true,
    auditDoesNotExecuteTargetSoftware: true,
    auditDoesNotWriteMemory: true,
    auditDoesNotEnableRules: true,
    auditDoesNotDeleteRollbackPoints: true,
    metadataOnlyFirst: true,
    triggerBeforeScreenshot: true,
    teacherConfirmationRequiredBeforeMetadataGate: true,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    screenRecorded: false,
    scheduledTaskInstalled: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    allSoftwareCoverageComplete: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function safeCount(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function sourceSummary(path, packet) {
  return {
    path: path || "",
    exists: Boolean(packet),
    format: packet?.format || "",
    status: packet?.status || "",
    goalComplete: packet?.locks?.goalComplete === true,
    readsLogs: packet?.locks?.logContentsRead === true || packet?.locks?.fullLogsRead === true,
    capturesScreenshots: packet?.locks?.screenshotsCaptured === true,
    registersMonitor: packet?.locks?.scheduledTaskInstalled === true,
    executesTargetSoftware: packet?.locks?.softwareActionsExecuted === true || packet?.locks?.targetSoftwareCommandsExecuted === true,
    writesMemory: packet?.locks?.memoryWritten === true
  };
}

function writeReadme(path, audit) {
  const lines = [
    "# Low-Token Coverage Convergence Audit",
    "",
    `Status: ${audit.status}`,
    `Passed checks: ${audit.summary.passedChecks}/${audit.summary.totalChecks}`,
    `Completion allowed: ${audit.summary.finalGoalCompletionAllowed}`,
    "",
    "This audit proves the all-software low-token coverage evidence is converged into a teacher-reviewable state. It does not run monitors, read logs, capture screenshots, execute software, write memory, enable rules, or claim completion.",
    "",
    "Coverage counts:",
    `- total rows: ${audit.coverage.totalRows}`,
    `- rows with log-source ledger route: ${audit.coverage.rowsWithLogSourceLedgerRoute}`,
    `- rows with metadata gate preflight: ${audit.coverage.rowsWithMetadataGatePreflight}`,
    `- rows with coverage contract: ${audit.coverage.rowsWithCoverageContract}`,
    `- ready for teacher-confirmed metadata gate: ${audit.coverage.readyForTeacherConfirmedMetadataGateRows}`,
    `- blocked pending teacher signal/evidence: ${audit.coverage.blockedRows}`,
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
    `<!doctype html><html><head><meta charset="utf-8"><title>Low-Token Coverage Convergence Audit</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:1120px;margin:32px auto;padding:0 20px;line-height:1.45}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}code{background:#f3f3f3;padding:2px 4px}</style></head><body><h1>Low-Token Coverage Convergence Audit</h1><p>Status: <code>${htmlEscape(audit.status)}</code></p><p>Passed checks: ${audit.summary.passedChecks}/${audit.summary.totalChecks}. Completion allowed: ${audit.summary.finalGoalCompletionAllowed}</p><h2>Open Evidence</h2><ol>${links}</ol><h2>Coverage Counts</h2><pre>${htmlEscape(JSON.stringify(audit.coverage, null, 2))}</pre><h2>Checks</h2><table><thead><tr><th>Id</th><th>Status</th><th>Check</th><th>Blocker</th></tr></thead><tbody>${rows}</tbody></table></body></html>\n`,
    "utf8"
  );
}

const repoRoot = resolve(argValue("--repo-root", process.cwd()));
const goal = argValue("--goal", "Audit all-software low-token coverage convergence before teacher-approved monitor or metadata-gate execution.");
const finalReviewPackPath = resolve(
  argValue(
    "--final-review-pack",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-final-review-packs"), "low-token-coverage-final-review-pack.json")
  )
);
const cockpitPath = resolve(
  argValue(
    "--waiting-row-cockpit",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-waiting-row-cockpits"), "original-goal-low-token-coverage-waiting-row-cockpit.json")
  )
);
const dossierPath = resolve(
  argValue(
    "--coverage-dossier",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-evidence-dossiers"), "original-goal-low-token-coverage-evidence-dossier.json")
  )
);
const completionGatePath = resolve(
  argValue(
    "--completion-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-completion-gates"), "original-goal-low-token-coverage-completion-gate.json")
  )
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-low-token-coverage-convergence-audits")));

const finalReviewPack = exists(finalReviewPackPath) ? readJson(finalReviewPackPath) : null;
const cockpit = exists(cockpitPath) ? readJson(cockpitPath) : null;
const dossier = exists(dossierPath) ? readJson(dossierPath) : null;
const completionGate = exists(completionGatePath) ? readJson(completionGatePath) : null;
const coverageSummary = finalReviewPack?.coverageSummary || {};
const cockpitCounts = cockpit?.counts || {};
const dossierCounts = dossier?.counts || {};
const sourceEvidence = finalReviewPack?.sourceEvidence || {};

const totalRows = safeCount(cockpitCounts.totalRows || coverageSummary.logSourceDiscoveryRows || dossierCounts.totalInventoryRows);
const rowsWithLogSourceLedgerRoute = safeCount(cockpitCounts.rowsWithLogSourceLedgerRoute || coverageSummary.logSourceDiscoveryRows);
const rowsWithMetadataGatePreflight = safeCount(cockpitCounts.rowsWithMetadataGatePreflight);
const rowsWithCoverageContract = safeCount(cockpitCounts.rowsWithCoverageContract);
const readyRows = safeCount(cockpitCounts.readyForTeacherConfirmedMetadataGateRows);
const blockedRows = safeCount(cockpitCounts.blockedRows);
const logSourceLedgerPath = sourceEvidence.logSourceLedger || "";

const sources = {
  finalReviewPack: sourceSummary(finalReviewPackPath, finalReviewPack),
  waitingRowCockpit: sourceSummary(cockpitPath, cockpit),
  coverageDossier: sourceSummary(dossierPath, dossier),
  completionGate: sourceSummary(completionGatePath, completionGate),
  logSourceLedger: { path: logSourceLedgerPath, exists: exists(logSourceLedgerPath) }
};

const unsafeSource = Object.values(sources).some(
  (source) => source.readsLogs || source.capturesScreenshots || source.registersMonitor || source.executesTargetSoftware || source.writesMemory || source.goalComplete
);

const checks = [
  statusRow("final_review_pack_present", "Low-token final review pack is present.", Boolean(finalReviewPack), finalReviewPackPath, "missing_final_review_pack"),
  statusRow("completion_gate_present", "Low-token completion gate is present and remains non-completing.", Boolean(completionGate) && completionGate?.locks?.goalComplete === false, completionGatePath, "missing_or_completing_completion_gate"),
  statusRow("log_source_discovery_complete", "Every current software row has a low-token log/source ledger route.", totalRows > 0 && rowsWithLogSourceLedgerRoute === totalRows && coverageSummary.logSourceDiscoveryMissingRows === 0, `${rowsWithLogSourceLedgerRoute}/${totalRows}`, "log_source_routes_missing"),
  statusRow("metadata_gate_preflight_complete", "Every row has a metadata-gate preflight before any log read or screenshot.", totalRows > 0 && rowsWithMetadataGatePreflight === totalRows, `${rowsWithMetadataGatePreflight}/${totalRows}`, "metadata_gate_preflight_missing"),
  statusRow("coverage_contract_complete", "Every row has a coverage contract describing the low-token review boundary.", totalRows > 0 && rowsWithCoverageContract === totalRows, `${rowsWithCoverageContract}/${totalRows}`, "coverage_contract_missing"),
  statusRow("teacher_review_split_preserved", "Ready and blocked rows are split for teacher review instead of auto-approval.", readyRows > 0 && blockedRows > 0 && readyRows + blockedRows === totalRows, `${readyRows} ready, ${blockedRows} blocked`, "teacher_review_split_missing"),
  statusRow("log_source_ledger_linked", "The current log-source discovery ledger is linked and readable as metadata evidence.", exists(logSourceLedgerPath), logSourceLedgerPath, "log_source_ledger_missing"),
  statusRow("dossier_matches_inventory_scope", "Coverage dossier inventory matches the cockpit scope.", safeCount(dossierCounts.totalInventoryRows) === totalRows && safeCount(dossierCounts.ledgerRows) === totalRows, `${safeCount(dossierCounts.ledgerRows)}/${safeCount(dossierCounts.totalInventoryRows)}`, "dossier_scope_mismatch"),
  statusRow("review_only_locks_closed", "Sources do not read logs, capture screenshots, register monitors, execute target software, write memory, or claim completion.", !unsafeSource, "locks", "unsafe_source_lock_detected")
];

const failed = checks.filter((row) => !row.passed);
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });
const auditPath = join(auditDir, "low-token-coverage-convergence-audit.json");
const receiptTemplatePath = join(auditDir, "low-token-coverage-convergence-audit-receipt-template.json");
const readmePath = join(auditDir, "LOW_TOKEN_COVERAGE_CONVERGENCE_AUDIT_START_HERE.md");
const htmlPath = join(auditDir, "low-token-coverage-convergence-audit.html");
const lockState = locks();

const audit = {
  ok: failed.length === 0,
  format: "transparent_ai_low_token_coverage_convergence_audit_v1",
  auditId,
  createdAt: new Date().toISOString(),
  goal,
  status: failed.length
    ? "blocked_waiting_for_low_token_coverage_convergence_evidence"
    : "low_token_coverage_convergence_ready_for_teacher_review_not_completion",
  summary: {
    totalChecks: checks.length,
    passedChecks: checks.length - failed.length,
    blockedChecks: failed.length,
    finalGoalCompletionAllowed: false
  },
  coverage: {
    totalRows,
    rowsWithLogSourceLedgerRoute,
    rowsWithMetadataGatePreflight,
    rowsWithCoverageContract,
    readyForTeacherConfirmedMetadataGateRows: readyRows,
    blockedRows,
    teacherReviewedCoverageRows: safeCount(coverageSummary.teacherReviewedCoverageRows),
    allSoftwareCoverageComplete: false
  },
  sourceEvidence: sources,
  checks,
  blockers: failed.map((row) => `${row.id}:${row.blocker}`),
  nextTeacherAction:
    "Review the waiting-row cockpit, confirm selected rows for metadata-only gates, preserve rollback points, and do not approve full log reads, screenshots, execution, memory, rule enablement, or completion from this audit.",
  primaryOpenOrder: [
    { label: "Low-Token Final Review Pack", path: finalReviewPackPath },
    { label: "Waiting Row Cockpit", path: cockpitPath },
    { label: "Coverage Dossier", path: dossierPath },
    { label: "Completion Gate", path: completionGatePath },
    { label: "Log Source Ledger", path: logSourceLedgerPath }
  ],
  blockedActions: [
    "claim_all_software_low_token_complete_from_audit",
    "register_monitor_from_audit",
    "run_metadata_gate_without_teacher_confirmation",
    "read_logs_from_audit",
    "read_full_logs_from_audit",
    "capture_screenshot_from_audit",
    "record_screen_from_audit",
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
      "This audit proves low-token coverage evidence convergence only. Completion still requires teacher-confirmed metadata gates, reviewed run-output evidence, validated receipts, retained rollback, and final teacher acceptance."
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
  format: "transparent_ai_low_token_coverage_convergence_audit_receipt_template_v1",
  auditId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "ready_for_selected_metadata_gate_review", "blocked_needs_more_evidence"],
  forbiddenTeacherDecisions: [
    "accepted",
    "claim_complete",
    "register_monitor_now",
    "run_metadata_gate_now",
    "read_logs_now",
    "read_full_logs",
    "capture_screenshot_now",
    "record_screen_now",
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
  selectedRowsForMetadataGate: [],
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
      format: "transparent_ai_low_token_coverage_convergence_audit_result_v1",
      status: audit.status,
      auditPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      summary: audit.summary,
      coverage: audit.coverage,
      blockers: audit.blockers,
      locks: audit.locks
    },
    null,
    2
  )
);
