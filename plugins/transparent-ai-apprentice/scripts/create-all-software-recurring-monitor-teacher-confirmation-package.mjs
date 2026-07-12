#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "recurring-monitor-teacher-confirmation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "recurring-monitor-teacher-confirmation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    if (value === true) {
      parts.push(flag);
      continue;
    }
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function writeReadme(path, packet) {
  const lines = [
    "# All-Software Recurring Monitor Teacher Confirmation Package",
    "",
    `Status: ${packet.status}`,
    `Goal: ${packet.goal}`,
    "",
    "This package is the review handoff before recurring low-token monitoring can be registered.",
    "It does not register a Windows Scheduled Task, launch a runner, read logs, capture screenshots, execute target software, write memory, enable rules, accept technology, or claim completion.",
    "",
    "Teacher confirmation rows:",
    ...packet.confirmationRows.map((row, index) => `${index + 1}. ${row.id}: ${row.status}; phrase=${row.requiredPhrase}`),
    "",
    "Open in order:",
    `1. This readme: ${packet.paths.readme}`,
    `2. Review HTML: ${packet.paths.html}`,
    `3. Schedule readme: ${packet.paths.scheduleReadme || "not provided"}`,
    `4. Approval gate readme: ${packet.paths.approvalGateReadme || "not provided"}`,
    `5. Unattended audit readme: ${packet.paths.unattendedAuditReadme || "not provided"}`,
    "",
    "Next commands after teacher confirmation:",
    ...packet.nextCommands.map((entry, index) => `${index + 1}. ${entry.label}: ${entry.command}`),
    "",
    "Remaining blockers:",
    ...packet.remainingBlockers.map((blocker) => `- ${blocker}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Teacher review before recurring all-software low-token monitor registration.");
const scheduleInput = readJsonInput(
  argValue("--schedule", argValue("--schedule-path", "")),
  "--schedule",
  "transparent_ai_automatic_low_token_learning_schedule_v1"
);
const approvalGateInput = readJsonInput(
  argValue("--approval-gate", argValue("--gate", "")),
  "--approval-gate",
  "transparent_ai_all_software_recurring_monitor_approval_gate_v1"
);
const unattendedAuditInput = readJsonInput(
  argValue("--unattended-audit", argValue("--audit", "")),
  "--unattended-audit",
  "transparent_ai_all_software_unattended_learning_audit_v1"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-recurring-monitor-teacher-confirmation-packages")
  )
);
mkdirSync(outputRoot, { recursive: true });
const packageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packageDir = join(outputRoot, packageId);
mkdirSync(packageDir, { recursive: true });

const schedule = scheduleInput.value;
const approvalGate = approvalGateInput.value;
const unattendedAudit = unattendedAuditInput.value;
const blockers = Array.from(new Set([...(approvalGate.blockers || []), ...(unattendedAudit.remainingGaps || []).map((gap) => gap.kind)]));
const confirmationRows = [
  {
    id: "recurring_monitor_confirmation",
    label: "Teacher explicitly allows recurring all-software low-token monitor review",
    requiredPhrase: "teacher confirmed all-software recurring monitoring",
    status: approvalGate.teacherConfirmationMatched === true ? "already_confirmed" : "needs_teacher_review",
    blocks: blockers.includes("missing_explicit_teacher_recurring_monitor_confirmation")
  },
  {
    id: "monitored_scope_confirmation",
    label: "Teacher reviewed monitored software scope and exclusions",
    requiredPhrase: "teacher reviewed monitored software scope",
    status: approvalGate.scopeConfirmationMatched === true ? "already_confirmed" : "needs_teacher_review",
    blocks: blockers.includes("missing_reviewed_monitor_scope_confirmation")
  },
  {
    id: "schedule_safety_confirmation",
    label: "Teacher reviewed metadata-first bounded schedule safety",
    requiredPhrase: "teacher reviewed metadata-first bounded low-token schedule",
    status:
      schedule.schedulePolicy?.metadataGateFirst === true &&
      schedule.schedulePolicy?.scheduledTaskInstalled === false &&
      schedule.locks?.scheduledTaskInstalled === false
        ? "ready_for_teacher_review"
        : "blocked_schedule_safety_mismatch",
    blocks: false
  },
  {
    id: "rollback_retained_confirmation",
    label: "Teacher confirms rollback point is retained before any registration",
    requiredPhrase: "rollback point retained before recurring monitor registration",
    status: approvalGate.rollbackPointCreated === true ? "already_confirmed" : "needs_teacher_review",
    blocks: approvalGate.rollbackPointCreated !== true
  }
];

const receiptTemplatePath = join(packageDir, "recurring-monitor-teacher-confirmation-receipt-template.json");
const packagePath = join(packageDir, "recurring-monitor-teacher-confirmation-package.json");
const readmePath = join(packageDir, "RECURRING_MONITOR_TEACHER_CONFIRMATION_START_HERE.md");
const htmlPath = join(packageDir, "recurring-monitor-teacher-confirmation.html");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  packageDoesNotRegisterTask: true,
  packageDoesNotLaunchRunner: true,
  scheduledTaskRegistered: false,
  runnerLaunched: false,
  logContentsRead: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  unattendedAllAppMonitoringComplete: false,
  goalComplete: false
};
const hasEvidenceMismatch = confirmationRows.some((row) => String(row.status).startsWith("blocked_"));
const readyAfterTeacherReceipt = !hasEvidenceMismatch;
const rerunApprovalGateCommand = commandLine("create-all-software-recurring-monitor-approval-gate.mjs", [
  ["--goal", "Teacher-confirmed recurring all-software low-token monitor approval"],
  ["--schedule", scheduleInput.path || "<automatic-low-token-learning-schedule.json>"],
  ["--teacher-confirmation", "teacher confirmed all-software recurring monitoring"],
  ["--scope-confirmation", "teacher reviewed monitored software scope"],
  ["--teacher-reviewed-scope", true],
  ["--rollback-point-created", true],
  ["--output-dir", join(outputRoot, "teacher-confirmed-approval-gate")]
]);
const validateReceiptCommand = commandLine("validate-all-software-recurring-monitor-teacher-confirmation-receipt.mjs", [
  ["--confirmation-package", packagePath],
  ["--receipt", "<teacher-filled-recurring-monitor-confirmation-receipt.json>"],
  ["--output-dir", join(outputRoot, "teacher-confirmation-receipt-validation")]
]);
const dryRunRunnerCommand = commandLine("run-all-software-recurring-monitor-registration-runner.mjs", [
  ["--goal", "Dry-run reviewed recurring monitor registration request"],
  ["--approval-gate", "<teacher-confirmed-approval-gate.json>"],
  ["--teacher-confirmation", "teacher confirmed registration dry run review only"],
  ["--rollback-point-created", true],
  ["--output-dir", join(outputRoot, "registration-runner-dry-run")]
]);
const packet = {
  ok: true,
  format: "transparent_ai_all_software_recurring_monitor_teacher_confirmation_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  goal,
  status: readyAfterTeacherReceipt ? "waiting_for_teacher_confirmation_receipt" : "blocked_by_evidence_mismatch",
  sourceEvidence: {
    schedule: scheduleInput.path,
    approvalGate: approvalGateInput.path,
    unattendedAudit: unattendedAuditInput.path
  },
  scheduleSummary: {
    taskName: schedule.taskName || "",
    intervalMinutes: schedule.schedulePolicy?.intervalMinutes ?? null,
    queuePath: schedule.queuePath || "",
    metadataGateFirst: schedule.schedulePolicy?.metadataGateFirst === true,
    scheduledTaskInstalled: schedule.schedulePolicy?.scheduledTaskInstalled === true,
    registerScript: schedule.files?.registerTask || ""
  },
  approvalGateSummary: {
    status: approvalGate.status || "",
    readyForRegistrationRequest: approvalGate.readyForRegistrationRequest === true,
    blockers: approvalGate.blockers || [],
    approvalGateDoesNotRegisterTask: approvalGate.locks?.approvalGateDoesNotRegisterTask === true
  },
  unattendedAuditSummary: {
    status: unattendedAudit.status || "",
    unattendedAllAppMonitoringComplete: unattendedAudit.unattendedAllAppMonitoringComplete === true,
    remainingGaps: (unattendedAudit.remainingGaps || []).map((gap) => ({ kind: gap.kind, detail: gap.detail }))
  },
  confirmationRows,
  remainingBlockers: blockers,
  nextCommands: [
    {
      id: "validate_teacher_confirmation_receipt",
      label: "Validate teacher-filled confirmation receipt before any approval gate rerun",
      command: validateReceiptCommand,
      enabledWhen: "teacher fills recurring-monitor-teacher-confirmation-receipt-template.json"
    },
    {
      id: "rerun_approval_gate_after_teacher_receipt",
      label: "Rerun approval gate after receipt validation is ready",
      command: rerunApprovalGateCommand,
      enabledWhen: "receipt validation reports readyToRerunApprovalGate=true"
    },
    {
      id: "create_registration_runner_dry_run_after_ready_gate",
      label: "Create dry-run registration runner after approval gate is ready",
      command: dryRunRunnerCommand,
      enabledWhen: "approval gate readyForRegistrationRequest=true"
    }
  ],
  paths: {
    package: packagePath,
    readme: readmePath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    schedule: scheduleInput.path,
    scheduleReadme: schedule.files?.readme || "",
    approvalGate: approvalGateInput.path,
    approvalGateReadme: approvalGateInput.path.replace("all-software-recurring-monitor-approval-gate.json", "ALL_SOFTWARE_RECURRING_MONITOR_APPROVAL_GATE_START_HERE.md"),
    unattendedAudit: unattendedAuditInput.path,
    unattendedAuditReadme: unattendedAuditInput.path.replace("all-software-unattended-learning-audit.json", "ALL_SOFTWARE_UNATTENDED_LEARNING_AUDIT_START_HERE.md")
  },
  locks
};
const receiptTemplate = {
  format: "transparent_ai_all_software_recurring_monitor_teacher_confirmation_receipt_v1",
  packageId,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "ready_to_rerun_approval_gate", "blocked"],
  blockedDecisions: ["accepted", "register_task", "start_runner", "execute_target_software", "write_memory", "claim_complete"],
  confirmationRows: confirmationRows.map((row) => ({
    id: row.id,
    teacherDecision: row.status === "already_confirmed" ? "already_confirmed" : "needs_teacher_review",
    teacherObservedEvidence: "",
    requiredPhrase: row.requiredPhrase
  })),
  sourcePackage: packagePath,
  locks
};

writeFileSync(packagePath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Recurring Monitor Teacher Confirmation</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #1f2937; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1100px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    .panel, .row { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 14px; margin-top: 16px; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    textarea { width: 100%; min-height: 240px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    .muted { color: #607086; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Recurring Monitor Teacher Confirmation</h1>
    <p>${htmlEscape(packet.goal)}</p>
    <section class="panel">
      <p>This page builds a review receipt only. It does not register tasks, launch runners, execute software, read logs, capture screenshots, or write memory.</p>
      <div class="grid">
        ${packet.confirmationRows
          .map(
            (row) => `<article class="row"><strong>${htmlEscape(row.label)}</strong><p>Status: <code>${htmlEscape(row.status)}</code></p><p>Phrase: <code>${htmlEscape(row.requiredPhrase)}</code></p></article>`
          )
          .join("\n")}
      </div>
      <p><button id="copy">Copy Receipt Template</button></p>
      <textarea id="receipt" spellcheck="false"></textarea>
      <p class="muted">First validate the filled receipt: <code>${htmlEscape(validateReceiptCommand)}</code></p>
    </section>
  </main>
  <script>
    const receipt = ${jsonForScript(receiptTemplate)};
    const box = document.getElementById("receipt");
    box.value = JSON.stringify(receipt, null, 2);
    document.getElementById("copy").addEventListener("click", async () => {
      await navigator.clipboard.writeText(box.value);
    });
  </script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_recurring_monitor_teacher_confirmation_package_result_v1",
      packageId,
      status: packet.status,
      packagePath,
      readmePath,
      htmlPath,
      receiptTemplatePath,
      remainingBlockers: blockers.length,
      locks
    },
    null,
    2
  )
);
