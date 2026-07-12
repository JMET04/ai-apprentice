#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "recurring-monitor-teacher-confirmation-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "recurring-monitor-teacher-confirmation-receipt-validation"
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

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["confirmed", "already_confirmed", "ready_to_rerun_approval_gate", "ready"].includes(text)) return "confirmed";
  if (["blocked", "mismatch_blocked"].includes(text)) return "blocked";
  return "needs_teacher_review";
}

function rowSatisfied(packageRow, receiptRow) {
  if (packageRow.status === "already_confirmed") return true;
  const decision = normalizeDecision(receiptRow?.teacherDecision);
  const evidence = String(receiptRow?.teacherObservedEvidence || receiptRow?.observedEvidence || "");
  return decision === "confirmed" || evidence.includes(packageRow.requiredPhrase);
}

function writeReadme(path, validation) {
  const lines = [
    "# Recurring Monitor Teacher Confirmation Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.id}: ${row.status}`),
    "",
    "Next safe commands:",
    ...validation.nextCommands.map((entry, index) => `${index + 1}. ${entry.label}: ${entry.command}`),
    "",
    "Blocked transitions:",
    ...validation.blockedTransitions.map((item) => `- ${item}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate recurring monitor teacher confirmation receipt.");
const packageInput = readJsonInput(
  argValue("--confirmation-package", argValue("--package", "")),
  "--confirmation-package",
  "transparent_ai_all_software_recurring_monitor_teacher_confirmation_package_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_recurring_monitor_teacher_confirmation_receipt_v1"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-recurring-monitor-teacher-confirmation-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });

const confirmationPackage = packageInput.value;
const receipt = receiptInput.value;
const packageRows = Array.isArray(confirmationPackage.confirmationRows) ? confirmationPackage.confirmationRows : [];
const receiptRows = new Map((Array.isArray(receipt.confirmationRows) ? receipt.confirmationRows : []).map((row) => [row.id, row]));
const forbiddenDecisions = new Set([
  ...(confirmationPackage.blockedDecisions || []),
  ...(receipt.blockedDecisions || []),
  "accepted",
  "register_task",
  "start_runner",
  "execute_target_software",
  "write_memory",
  "claim_complete",
  "execute_now"
]);
const receiptDecision = String(receipt.decision || receipt.defaultDecision || "needs_teacher_review").trim().toLowerCase();
const forbiddenDecisionUsed = forbiddenDecisions.has(receiptDecision);
const validationRows = packageRows.map((row) => {
  const receiptRow = receiptRows.get(row.id);
  const satisfied = rowSatisfied(row, receiptRow);
  const decision = normalizeDecision(receiptRow?.teacherDecision);
  return {
    id: row.id,
    requiredPhrase: row.requiredPhrase,
    packageStatus: row.status,
    receiptDecision: receiptRow?.teacherDecision || "",
    status: satisfied ? "matched_expected_confirmation" : decision === "blocked" ? "blocked_by_teacher" : "missing_teacher_confirmation",
    canAdvance: satisfied
  };
});
const missingRows = validationRows.filter((row) => !row.canAdvance);
const readyToRerunApprovalGate = !forbiddenDecisionUsed && missingRows.length === 0;
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyToRerunApprovalGate
    ? "ready_to_rerun_approval_gate_review_only"
    : "needs_teacher_review";
const status = readyToRerunApprovalGate
  ? "receipt_validated_ready_to_rerun_approval_gate"
  : "receipt_validation_waiting_for_teacher_confirmation";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });
const validationPath = join(validationDir, "recurring-monitor-teacher-confirmation-receipt-validation.json");
const receiptPath = join(validationDir, "recurring-monitor-teacher-confirmation-receipt-validation-receipt.json");
const readmePath = join(validationDir, "RECURRING_MONITOR_TEACHER_CONFIRMATION_RECEIPT_VALIDATION_START_HERE.md");
const rerunApprovalGateCommand = commandLine("create-all-software-recurring-monitor-approval-gate.mjs", [
  ["--goal", "Teacher-confirmed recurring all-software low-token monitor approval"],
  ["--schedule", confirmationPackage.paths?.schedule || confirmationPackage.sourceEvidence?.schedule || "<automatic-low-token-learning-schedule.json>"],
  ["--teacher-confirmation", "teacher confirmed all-software recurring monitoring"],
  ["--scope-confirmation", "teacher reviewed monitored software scope"],
  ["--teacher-reviewed-scope", true],
  ["--rollback-point-created", true],
  ["--output-dir", join(outputRoot, "teacher-confirmed-approval-gate")]
]);
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  validationDoesNotRegisterTask: true,
  validationDoesNotLaunchRunner: true,
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
const validation = {
  ok: true,
  format: "transparent_ai_all_software_recurring_monitor_teacher_confirmation_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  readyToRerunApprovalGate,
  forbiddenDecisionUsed,
  missingConfirmationCount: missingRows.length,
  validationRows,
  nextCommands: [
    {
      id: "rerun_approval_gate_after_validated_teacher_receipt",
      label: "Rerun recurring monitor approval gate with validated teacher confirmations",
      command: rerunApprovalGateCommand,
      enabled: readyToRerunApprovalGate
    }
  ],
  blockedTransitions: [
    "register_scheduled_task_from_receipt_validation",
    "start_recurring_runner_from_receipt_validation",
    "execute_target_software_from_receipt_validation",
    "write_long_term_memory_from_receipt_validation",
    "claim_goal_complete_from_receipt_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourcePackage: packageInput.path,
    sourceReceipt: receiptInput.path,
    sourceSchedule: confirmationPackage.paths?.schedule || confirmationPackage.sourceEvidence?.schedule || ""
  },
  locks
};
const validationReceipt = {
  format: "transparent_ai_all_software_recurring_monitor_teacher_confirmation_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  readyToRerunApprovalGate,
  forbiddenDecisionUsed,
  missingConfirmationCount: missingRows.length,
  scheduledTaskRegistered: false,
  runnerLaunched: false,
  logContentsRead: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  goalComplete: false,
  locks
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_recurring_monitor_teacher_confirmation_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      readyToRerunApprovalGate,
      missingConfirmationCount: missingRows.length,
      validationPath,
      receiptPath,
      readmePath,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
