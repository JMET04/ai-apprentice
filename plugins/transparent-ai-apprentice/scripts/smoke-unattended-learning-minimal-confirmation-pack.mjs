#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`command failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-unattended-minimal-confirmation-"));
const auditPath = join(root, "audit.json");
const confirmationPackagePath = join(root, "confirmation-package.json");
const receiptTemplatePath = join(root, "receipt-template.json");
const refreshPath = join(root, "original-goal-current-status-refresh.json");
const outDir = join(root, "out");

writeJson(auditPath, {
  format: "transparent_ai_all_software_unattended_learning_audit_v1",
  status: "unattended_learning_not_ready_remaining_gaps",
  unattendedAllAppMonitoringComplete: false,
  remainingGaps: [
    { kind: "approval_gate_not_ready", detail: "missing explicit teacher confirmation" },
    { kind: "registration_runner_not_ready", detail: "runner blocked before registration" },
    { kind: "post_registration_witness_missing", detail: "no witnessed output after registration" },
    { kind: "no_live_run_receipt", detail: "no reviewed live monitor run receipt" },
    { kind: "native_execution_gate_closed", detail: "target software execution remains blocked" }
  ],
  locks: { reviewOnly: true, scheduledTaskRegistered: false }
});

writeJson(confirmationPackagePath, {
  format: "transparent_ai_all_software_recurring_monitor_teacher_confirmation_package_v1",
  status: "waiting_for_teacher_confirmation_receipt",
  goal: "Smoke all-software low-token unattended learning",
  confirmationRows: [
    {
      id: "recurring_monitor_confirmation",
      label: "Teacher explicitly allows recurring all-software low-token monitor review",
      requiredPhrase: "teacher confirmed all-software recurring monitoring",
      status: "needs_teacher_review",
      blocks: true
    },
    {
      id: "monitored_scope_confirmation",
      label: "Teacher reviewed monitored software scope and exclusions",
      requiredPhrase: "teacher reviewed monitored software scope",
      status: "needs_teacher_review",
      blocks: true
    },
    {
      id: "schedule_safety_confirmation",
      label: "Teacher reviewed metadata-first bounded schedule safety",
      requiredPhrase: "teacher reviewed metadata-first bounded low-token schedule",
      status: "ready_for_teacher_review",
      blocks: false
    },
    {
      id: "rollback_retained_confirmation",
      label: "Teacher confirms rollback point is retained before any registration",
      requiredPhrase: "rollback point retained before recurring monitor registration",
      status: "already_confirmed",
      blocks: false
    }
  ],
  nextCommands: [
    {
      id: "validate_teacher_confirmation_receipt",
      label: "Validate receipt",
      command:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-recurring-monitor-teacher-confirmation-receipt.mjs --confirmation-package pack --receipt receipt"
    },
    {
      id: "create_registration_runner_dry_run_after_ready_gate",
      label: "Dry-run registration runner",
      command:
        "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-recurring-monitor-registration-runner.mjs --approval-gate gate"
    },
    {
      id: "execute_registration_after_approval",
      label: "Execute registration",
      command: "node runner.mjs --execute-approved-registration --allow-system-change"
    }
  ],
  locks: { reviewOnly: true, packageDoesNotRegisterTask: true, goalComplete: false }
});

writeJson(receiptTemplatePath, {
  format: "transparent_ai_all_software_recurring_monitor_teacher_confirmation_receipt_v1",
  defaultDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "ready_to_rerun_approval_gate", "blocked"],
  blockedDecisions: ["accepted", "register_task", "launch_runner", "read_logs", "capture_screenshot", "execute_software"],
  confirmationRows: [],
  locks: { reviewOnly: true, packageDoesNotRegisterTask: true, goalComplete: false }
});

writeJson(refreshPath, {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  goal: "Smoke all-software low-token unattended learning",
  paths: {
    allSoftwareUnattendedLearningAudit: auditPath,
    recurringMonitorTeacherConfirmationPackage: confirmationPackagePath,
    recurringMonitorTeacherConfirmationReceiptTemplate: receiptTemplatePath
  }
});

const result = run([
  "plugins/transparent-ai-apprentice/scripts/create-unattended-learning-minimal-confirmation-pack.mjs",
  "--refresh",
  refreshPath,
  "--output-dir",
  outDir
]);
const packet = JSON.parse(readFileSync(result.packetPath, "utf8"));
const template = JSON.parse(readFileSync(result.teacherPatchTemplatePath, "utf8"));
const checks = [
  {
    name: "Pack combines audit gaps and teacher confirmation rows",
    pass:
      packet.format === "transparent_ai_unattended_learning_minimal_confirmation_pack_v1" &&
      packet.counts.gapRows === 5 &&
      packet.counts.confirmationRows === 4
  },
  {
    name: "All command templates remain gated and evidence-only",
    pass:
      packet.counts.commandTemplates === 3 &&
      packet.counts.gatedCommandTemplates === 3 &&
      packet.commandTemplates.every((entry) => entry.gate.allowedInThisPack === false)
  },
  {
    name: "Teacher patch template defaults to review without acceptance",
    pass:
      template.defaultDecision === "needs_teacher_review" &&
      template.blockedDecisions.includes("accepted") &&
      template.confirmationRows.length === 4 &&
      template.gapRows.length === 5
  },
  {
    name: "Minimal pack keeps side-effect locks closed",
    pass:
      packet.locks.packageDoesNotRegisterTask === true &&
      packet.locks.packageDoesNotReadLogs === true &&
      packet.locks.packageDoesNotCaptureScreenshots === true &&
      packet.locks.packageDoesNotExecuteTargetSoftware === true &&
      packet.locks.goalComplete === false
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_unattended_learning_minimal_confirmation_pack_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        packet: result.packetPath,
        html: result.htmlPath,
        readme: result.readmePath,
        teacherPatchTemplate: result.teacherPatchTemplatePath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
