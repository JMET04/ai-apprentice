#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "goal-teacher-review-cockpit-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", "create-goal-teacher-review-cockpit.mjs"), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "cockpit script failed");
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const centerDir = join(smokeRoot, "center");
mkdirSync(centerDir, { recursive: true });
const activationHtml = writeJson(join(centerDir, "activation-builder.html"), { marker: "html placeholder" });
const coverageHtml = writeJson(join(centerDir, "coverage-builder.html"), { marker: "html placeholder" });
const enrollmentHtml = writeJson(join(centerDir, "coverage-enrollment-builder.html"), { marker: "html placeholder" });
const enrollmentPlan = writeJson(join(centerDir, "coverage-enrollment-plan.json"), {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
  followUpItems: [{ followUpId: "follow-up-001", software: "Example App", route: "collect_watch_or_queue_item_evidence" }]
});
const enrollmentLedger = writeJson(join(centerDir, "coverage-enrollment-ledger.json"), {
  format: "transparent_ai_all_software_coverage_enrollment_ledger_v1",
  counts: { totalRows: 24, nextReviewQueue: 3 }
});
const enrollmentBatch = writeJson(join(centerDir, "coverage-enrollment-batch.json"), {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1",
  teacherReviewed: false,
  ranToolCount: 0
});
const controlHtml = writeJson(join(centerDir, "control-builder.html"), { marker: "html placeholder" });
const voiceHtml = writeJson(join(centerDir, "voice-workbench.html"), { marker: "html placeholder" });
const overlayHtml = writeJson(join(centerDir, "overlay.html"), { marker: "html placeholder" });
const statusPath = writeJson(join(centerDir, "status.json"), {
  format: "transparent_ai_all_software_operational_status_console_v1",
  status: "all_software_status_waiting_for_registration_or_manual_runner_evidence",
  scan: {
    missingEvidence: ["coverage_rollout_receipt_validation", "activation_dry_run_rehearsal", "registration_execute_gate"]
  },
  lanes: [
    {
      id: "automatic_learning_activation_path",
      status: "activation_receipt_validation_waiting_for_teacher_confirmations",
      detail: "missing=3"
    },
    {
      id: "coverage_rollout_receipt_gate",
      status: "coverage_rollout_receipt_ready_for_teacher_review",
      detail: "batches=3; totalSoftware=24"
    },
    {
      id: "non_expert_engineering_voice_control",
      status: "voice_text_numbered_control_ready_for_teacher_review",
      detail: "voice/text workbench exists and keeps software execution locked"
    },
    {
      id: "original_goal_boundary",
      status: "not_complete_full_objective_because_universal_native_control_and_unattended_all_app_coverage_are_not_proven",
      detail: "still gated"
    }
  ],
  nextSafeActions: [
    {
      label: "Open activation receipt validation and resolve remaining confirmations",
      command: "Review activation validation"
    },
    {
      label: "Validate teacher-filled coverage rollout receipt",
      command: "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-coverage-rollout-receipt.mjs --plan \"plan.json\" --receipt \"<teacher-filled-coverage-rollout-receipt.json>\""
    }
  ],
  locks: {
    targetSoftwareCommandsExecuted: false
  }
});
const centerPath = writeJson(join(centerDir, "goal-command-center.json"), {
  format: "transparent_ai_goal_command_center_v1",
  goal: "fixture goal",
  paths: {
    operationalStatusConsole: statusPath,
    activationReceiptBuilderHtml: activationHtml,
    activationReceiptValidation: join(centerDir, "activation-validation.json"),
    activationReviewPacket: join(centerDir, "activation-packet.json"),
    coverageRolloutReceiptBuilderHtml: coverageHtml,
    coverageConvergence: join(centerDir, "coverage-convergence.json"),
    coverageExpansionPlan: join(centerDir, "coverage-plan.json"),
    coverageEnrollmentFollowUpReceiptBuilderHtml: enrollmentHtml,
    coverageEnrollmentFollowUpReceiptBuilder: join(centerDir, "coverage-enrollment-builder.json"),
    coverageEnrollmentFollowUpPlan: enrollmentPlan,
    coverageEnrollmentLedger: enrollmentLedger,
    coverageEnrollmentFollowUpBatch: enrollmentBatch,
    controlChannelRepairReceiptBuilderHtml: controlHtml,
    controlChannelRepairQueue: join(centerDir, "control-queue.json"),
    voiceWorkbenchHtml: voiceHtml,
    voiceWorkbench: join(centerDir, "voice.json"),
    transparentOverlay: overlayHtml,
    teachExecuteLoop: join(centerDir, "teach-execute.json")
  },
  entryLinks: [
    { id: "engineering_voice_control_workbench", path: voiceHtml },
    { id: "coverage_rollout_receipt_builder", path: coverageHtml }
  ],
  nextCalls: {
    coverageRolloutReceiptValidation: {
      arguments: {
        plan: join(centerDir, "coverage-plan.json")
      }
    },
    coverageEnrollmentFollowUpReceiptValidation: {
      arguments: {
        plan: enrollmentPlan
      }
    },
    controlChannelRepairReceiptValidation: {
      arguments: {
        repairQueue: join(centerDir, "control-queue.json")
      }
    },
    confirmNumberedTarget: {
      arguments: {
        confirmCommandTemplate: "node confirm-engineering-command-target.mjs --selected-number __SELECTED_NUMBER__"
      }
    }
  }
});

const result = runScript([
  "--goal",
  "Review current gates from one cockpit",
  "--command-center",
  centerPath,
  "--output-dir",
  join(smokeRoot, "out")
]);
const cockpit = readJson(result.cockpitPath);
const html = readFileSync(result.htmlPath, "utf8");

const checks = [
  check(
    "Teacher review cockpit gathers current review gates into one packet",
    cockpit.format === "transparent_ai_goal_teacher_review_cockpit_v1" &&
      cockpit.reviewItems.some((item) => item.id === "activation_confirmations") &&
      cockpit.reviewItems.some((item) => item.id === "coverage_rollout_receipt") &&
      cockpit.reviewItems.some((item) => item.id === "coverage_enrollment_follow_up") &&
      cockpit.reviewItems.some((item) => item.id === "control_channel_repair_receipt") &&
      cockpit.reviewItems.some((item) => item.id === "voice_text_numbered_target") &&
      cockpit.reviewItems.some((item) => item.id === "transparent_sketch_overlay") &&
    cockpit.summary.missingEvidence.includes("coverage_rollout_receipt_validation"),
    result.cockpitPath
  ),
  check(
    "Teacher review cockpit provides an in-browser receipt generator without executing validation",
    cockpit.interactiveReceiptBuilder?.available === true &&
      cockpit.interactiveReceiptBuilder?.generatesReceiptJsonInBrowser === true &&
      cockpit.interactiveReceiptBuilder?.runsValidation === false &&
      cockpit.interactiveReceiptBuilder?.executesCommands === false &&
      html.includes("Generate reviewed receipt JSON") &&
      html.includes("Download receipt JSON") &&
      html.includes("goal_teacher_review_cockpit_browser_receipt_builder") &&
      html.includes("data-field='teacherDecision'") &&
      html.includes("teacher_reviewed_continue"),
    result.htmlPath
  ),
  check(
    "Teacher review cockpit previews safe downstream commands in browser without running validation",
    cockpit.browserValidationPreview?.available === true &&
      cockpit.browserValidationPreview?.outputFormat === "transparent_ai_goal_teacher_review_cockpit_browser_validation_preview_v1" &&
      cockpit.browserValidationPreview?.writesFiles === false &&
      cockpit.browserValidationPreview?.runsValidationScript === false &&
      cockpit.browserValidationPreview?.executesCommands === false &&
      html.includes("Preview safe next commands") &&
      html.includes("transparent_ai_goal_teacher_review_cockpit_browser_validation_preview_v1") &&
      html.includes("preview_has_safe_next_commands") &&
      html.includes("commandsExecuted: false"),
    result.htmlPath
  ),
  check(
    "Teacher review cockpit HTML links review pages and exposes copyable commands",
    existsSync(result.htmlPath) &&
      html.includes("Goal Teacher Review Cockpit") &&
      html.includes("Open review page") &&
      html.includes("Copy next command") &&
      html.includes("coverage_rollout_receipt_ready_for_teacher_review"),
    result.htmlPath
  ),
  check(
    "Teacher review cockpit includes coverage enrollment follow-up receipt validation",
    cockpit.reviewItems.some(
      (item) =>
        item.id === "coverage_enrollment_follow_up" &&
        item.primaryPath === enrollmentHtml &&
        item.command.includes("validate-all-software-coverage-enrollment-follow-up-receipt.mjs") &&
        item.command.includes("<teacher-filled-coverage-enrollment-follow-up-receipt.json>") &&
        item.command.includes(enrollmentPlan)
    ) &&
      cockpit.receiptTemplate.rowDecisions.some((row) => row.id === "coverage_enrollment_follow_up") &&
      html.includes("Coverage enrollment follow-up") &&
      html.includes("coverage_enrollment_follow_up_receipt_ready_for_teacher_review"),
    result.htmlPath
  ),
  check(
    "Teacher review cockpit preserves all execution and completion locks",
    cockpit.locks.cockpitDoesNotRunCommands === true &&
      cockpit.locks.cockpitDoesNotValidateReceipts === true &&
      cockpit.locks.softwareActionsExecuted === false &&
      cockpit.locks.targetSoftwareCommandsExecuted === false &&
      cockpit.locks.memoryWritten === false &&
      cockpit.locks.goalComplete === false,
    result.cockpitPath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_goal_teacher_review_cockpit_smoke_v1",
  smokeRoot,
  result,
  checks
};
console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
