#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "unattended-learning-minimal-confirmation-pack")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 84) || "unattended-learning-minimal-confirmation-pack"
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

function latestRefreshPath(root) {
  const refreshRoot = resolve(root || join(process.cwd(), ".transparent-apprentice", "original-goal-current-status-refreshes"));
  if (!existsSync(refreshRoot)) return "";
  const latest = readdirSync(refreshRoot)
    .map((name) => join(refreshRoot, name))
    .filter((path) => {
      try {
        return statSync(path).isDirectory() && existsSync(join(path, "original-goal-current-status-refresh.json"));
      } catch {
        return false;
      }
    })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  return latest ? join(latest, "original-goal-current-status-refresh.json") : "";
}

function closedLocks() {
  return {
    reviewOnly: true,
    minimalConfirmationOnly: true,
    teacherMustConfirmBeforeRegistration: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packageDoesNotValidateReceipt: true,
    packageDoesNotRegisterTask: true,
    packageDoesNotLaunchRunner: true,
    packageDoesNotRunRegistration: true,
    packageDoesNotTriggerWitness: true,
    packageDoesNotReadLogs: true,
    packageDoesNotReadFullLogs: true,
    packageDoesNotCaptureScreenshots: true,
    packageDoesNotExecuteTargetSoftware: true,
    packageDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    longTermMemoryWritten: false,
    nativeUniversalExecution: false,
    unattendedAllAppMonitoringComplete: false,
    goalComplete: false
  };
}

function commandRisk(command) {
  const text = String(command || "").toLowerCase();
  const risky = [
    "run-all-software-recurring-monitor-registration-runner",
    "run-all-software-operational-learning-registration-approved-runner",
    "post-registration-output-witness-runner",
    "register-scheduledtask",
    "schtasks",
    "--execute-approved-registration",
    "--allow-system-change",
    "--allow-runner-trigger",
    "--trigger-reviewed-output"
  ].some((needle) => text.includes(needle));
  if (risky) {
    return {
      risk: "execution_or_registration_command",
      status: "gated_until_teacher_receipt_and_ready_gate",
      allowedInThisPack: false
    };
  }
  return {
    risk: "review_or_validation_command",
    status: "evidence_only_command_template",
    allowedInThisPack: false
  };
}

function normalizeGap(gap, index) {
  return {
    id: `unattended_gap_${String(index + 1).padStart(2, "0")}`,
    kind: gap?.kind || `remaining_gap_${index + 1}`,
    detail: gap?.detail || String(gap || ""),
    teacherQuestion: "Does this gap have enough teacher-reviewed evidence to continue to the next gate?",
    defaultDecision: "needs_teacher_review",
    allowedDecisions: ["needs_teacher_review", "teacher_confirms_review_only_gate", "blocked_needs_more_evidence"],
    blockedDecisions: ["accepted", "register_task", "launch_runner", "read_logs", "capture_screenshot", "execute_software"],
    locks: closedLocks()
  };
}

function normalizeConfirmation(row, index) {
  return {
    id: row?.id || `confirmation_${index + 1}`,
    label: row?.label || row?.id || `Confirmation ${index + 1}`,
    requiredPhrase: row?.requiredPhrase || "",
    sourceStatus: row?.status || "needs_teacher_review",
    blocks: row?.blocks === true,
    teacherDecision: "needs_teacher_review",
    allowedDecisions: ["needs_teacher_review", "teacher_confirms_review_only_gate", "blocked_needs_more_evidence"],
    blockedDecisions: ["accepted", "register_task", "launch_runner", "read_logs", "capture_screenshot", "execute_software"],
    teacherObservedEvidence: "",
    teacherNote: "",
    locks: closedLocks()
  };
}

function writeReadme(path, packet) {
  const lines = [
    "# Unattended Learning Minimal Confirmation Pack",
    "",
    `Status: ${packet.status}`,
    `Audit gaps: ${packet.counts.gapRows}`,
    `Teacher confirmation rows: ${packet.counts.confirmationRows}`,
    "",
    "This pack is a teacher review handoff for recurring all-software low-token monitoring.",
    "It does not register scheduled tasks, launch runners, read logs, capture screenshots, execute target software, write memory, enable rules, accept technology, unlock packaging, or claim the goal complete.",
    "",
    "Teacher confirmation rows:",
    ...packet.confirmationRows.map((row, index) => `${index + 1}. ${row.id}: ${row.sourceStatus}; phrase=${row.requiredPhrase || "none"}`),
    "",
    "Remaining gaps:",
    ...packet.gapRows.map((row, index) => `${index + 1}. ${row.kind}: ${row.detail}`),
    "",
    "Command templates are evidence only in this pack:",
    ...packet.commandTemplates.map((entry, index) => `${index + 1}. ${entry.id}: ${entry.gate.status}`),
    "",
    "Locks:",
    ...Object.entries(packet.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  const confirmations = packet.confirmationRows
    .map(
      (row) => `<article class="row">
        <h2>${htmlEscape(row.id)}</h2>
        <p><strong>Status:</strong> <code>${htmlEscape(row.sourceStatus)}</code></p>
        <p><strong>Required phrase:</strong> <code>${htmlEscape(row.requiredPhrase || "none")}</code></p>
        <p><strong>Default:</strong> <code>${htmlEscape(row.teacherDecision)}</code></p>
      </article>`
    )
    .join("\n");
  const gaps = packet.gapRows
    .map(
      (row) => `<article class="row">
        <h2>${htmlEscape(row.kind)}</h2>
        <p>${htmlEscape(row.detail)}</p>
        <p><strong>Default:</strong> <code>${htmlEscape(row.defaultDecision)}</code></p>
      </article>`
    )
    .join("\n");
  const commands = packet.commandTemplates
    .map(
      (entry) => `<article class="row">
        <h2>${htmlEscape(entry.id)}</h2>
        <p><strong>Gate:</strong> <code>${htmlEscape(entry.gate.status)}</code></p>
        <p><code>${htmlEscape(entry.command)}</code></p>
      </article>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unattended Learning Minimal Confirmation Pack</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f6f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    h2 { font-size: 17px; margin: 0 0 8px; letter-spacing: 0; }
    .summary, .row { background: #fff; border: 1px solid #dbe4ef; border-radius: 8px; padding: 15px; margin: 14px 0; }
    code { background: #edf3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Unattended Learning Minimal Confirmation Pack</h1>
  <section class="summary">
    <p><strong>Status:</strong> <code>${htmlEscape(packet.status)}</code></p>
    <p><strong>Audit gaps:</strong> ${htmlEscape(packet.counts.gapRows)} <strong>Confirmation rows:</strong> ${htmlEscape(packet.counts.confirmationRows)}</p>
    <p><strong>Audit:</strong> <a href="${htmlEscape(fileHref(packet.sourceEvidence.audit))}">${htmlEscape(packet.sourceEvidence.audit)}</a></p>
    <p><strong>Confirmation package:</strong> <a href="${htmlEscape(fileHref(packet.sourceEvidence.confirmationPackage))}">${htmlEscape(packet.sourceEvidence.confirmationPackage)}</a></p>
    <p>This pack is review-only. It does not register tasks, launch runners, read logs, capture screenshots, execute software, write memory, enable rules, unlock packaging, or claim completion.</p>
  </section>
  <h2>Teacher Confirmation</h2>
  ${confirmations}
  <h2>Remaining Gaps</h2>
  ${gaps}
  <h2>Command Templates</h2>
  ${commands}
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

const refreshPath = resolve(argValue("--refresh", latestRefreshPath(argValue("--refresh-root", ""))));
if (!refreshPath || !existsSync(refreshPath)) {
  throw new Error("Usage: node create-unattended-learning-minimal-confirmation-pack.mjs --refresh <original-goal-current-status-refresh.json>");
}
const refresh = readJson(refreshPath);
const auditPath = resolve(argValue("--audit", refresh.paths?.allSoftwareUnattendedLearningAudit || ""));
const confirmationPackagePath = resolve(
  argValue("--confirmation-package", refresh.paths?.recurringMonitorTeacherConfirmationPackage || "")
);
const receiptTemplatePath = resolve(
  argValue("--receipt-template", refresh.paths?.recurringMonitorTeacherConfirmationReceiptTemplate || "")
);
if (!existsSync(auditPath)) throw new Error("--audit path does not exist");
if (!existsSync(confirmationPackagePath)) throw new Error("--confirmation-package path does not exist");
if (!existsSync(receiptTemplatePath)) throw new Error("--receipt-template path does not exist");

const audit = readJson(auditPath);
const confirmationPackage = readJson(confirmationPackagePath);
const receiptTemplate = readJson(receiptTemplatePath);
if (audit.format !== "transparent_ai_all_software_unattended_learning_audit_v1") {
  throw new Error("--audit must be transparent_ai_all_software_unattended_learning_audit_v1");
}
if (confirmationPackage.format !== "transparent_ai_all_software_recurring_monitor_teacher_confirmation_package_v1") {
  throw new Error("--confirmation-package must be transparent_ai_all_software_recurring_monitor_teacher_confirmation_package_v1");
}
if (receiptTemplate.format !== "transparent_ai_all_software_recurring_monitor_teacher_confirmation_receipt_v1") {
  throw new Error("--receipt-template must be transparent_ai_all_software_recurring_monitor_teacher_confirmation_receipt_v1");
}

const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), "artifacts", "unattended-learning-minimal-confirmation-packs")));
const goal = refresh.goal || confirmationPackage.goal || audit.goal || "all-software low-token unattended learning";
const packageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const dir = join(outputRoot, packageId);
mkdirSync(dir, { recursive: true });

const packetPath = join(dir, "unattended-learning-minimal-confirmation-pack.json");
const htmlPath = join(dir, "unattended-learning-minimal-confirmation-pack.html");
const readmePath = join(dir, "UNATTENDED_LEARNING_MINIMAL_CONFIRMATION_START_HERE.md");
const teacherPatchTemplatePath = join(dir, "teacher-unattended-minimal-confirmation-template.json");

const gapRows = (audit.remainingGaps || []).map(normalizeGap);
const confirmationRows = (confirmationPackage.confirmationRows || []).map(normalizeConfirmation);
const commandTemplates = (confirmationPackage.nextCommands || []).map((entry) => ({
  id: entry.id || basename(String(entry.command || "command")),
  label: entry.label || "",
  command: entry.command || "",
  enabledWhen: entry.enabledWhen || "",
  gate: commandRisk(entry.command || "")
}));
const locks = closedLocks();
const teacherPatchTemplate = {
  format: "transparent_ai_unattended_learning_minimal_confirmation_teacher_template_v1",
  packageId,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "teacher_confirms_review_only_gate", "blocked_needs_more_evidence"],
  blockedDecisions: ["accepted", "register_task", "launch_runner", "read_logs", "capture_screenshot", "execute_software"],
  confirmationRows: confirmationRows.map((row) => ({
    id: row.id,
    teacherDecision: "needs_teacher_review",
    teacherObservedEvidence: "",
    requiredPhrase: row.requiredPhrase,
    teacherNote: ""
  })),
  gapRows: gapRows.map((row) => ({
    id: row.id,
    kind: row.kind,
    teacherDecision: "needs_teacher_review",
    teacherObservedEvidence: "",
    teacherNote: ""
  })),
  sourcePackage: packetPath,
  locks
};

const packet = {
  ok: true,
  format: "transparent_ai_unattended_learning_minimal_confirmation_pack_v1",
  packageId,
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_minimal_confirmation",
  goal,
  sourceEvidence: {
    refresh: refreshPath,
    audit: auditPath,
    confirmationPackage: confirmationPackagePath,
    receiptTemplate: receiptTemplatePath
  },
  evidenceSummary: {
    auditStatus: audit.status || "",
    auditUnattendedAllAppMonitoringComplete: audit.unattendedAllAppMonitoringComplete === true,
    confirmationPackageStatus: confirmationPackage.status || "",
    receiptDefaultDecision: receiptTemplate.defaultDecision || "",
    receiptAllowedDecisions: receiptTemplate.allowedDecisions || [],
    receiptBlockedDecisions: receiptTemplate.blockedDecisions || []
  },
  counts: {
    gapRows: gapRows.length,
    confirmationRows: confirmationRows.length,
    commandTemplates: commandTemplates.length,
    gatedCommandTemplates: commandTemplates.filter((entry) => entry.gate.allowedInThisPack === false).length
  },
  confirmationRows,
  gapRows,
  commandTemplates,
  paths: {
    packet: packetPath,
    html: htmlPath,
    readme: readmePath,
    teacherPatchTemplate: teacherPatchTemplatePath
  },
  nextTeacherAction:
    "Fill teacher-unattended-minimal-confirmation-template.json only after reviewing the source audit and confirmation package.",
  completionBoundary:
    "This pack narrows unattended monitoring review. It is not acceptance, not registration, not execution, not evidence that all software is monitored, and not goal completion.",
  locks
};

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(teacherPatchTemplatePath, `${JSON.stringify(teacherPatchTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);
writeHtml(htmlPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_unattended_learning_minimal_confirmation_pack_result_v1",
      packageId,
      packetPath,
      htmlPath,
      readmePath,
      teacherPatchTemplatePath,
      counts: packet.counts,
      status: packet.status,
      locks
    },
    null,
    2
  )
);
