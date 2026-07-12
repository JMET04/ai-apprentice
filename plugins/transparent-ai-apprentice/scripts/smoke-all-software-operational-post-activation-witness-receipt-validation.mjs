#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "post-activation-witness-receipt-validation-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const evidenceDir = join(smokeRoot, "evidence");
const evidencePaths = {
  dryRunRehearsal: writeJson(join(evidenceDir, "dry-run-rehearsal.json"), {
    format: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
    status: "passed_no_system_change"
  }),
  registrationExecuteGate: writeJson(join(evidenceDir, "registration-execute-gate.json"), {
    format: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
    status: "ready_for_teacher_registration_execute_review"
  }),
  registrationStatus: writeJson(join(evidenceDir, "registration-status.json"), {
    format: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
    status: "registered_and_matches_reviewed_runner"
  }),
  runOutputAudit: writeJson(join(evidenceDir, "run-output-audit.json"), {
    format: "transparent_ai_all_software_recurring_monitor_run_output_audit_v1",
    status: "recurring_monitor_run_output_ready_for_teacher_review",
    reviewedRunCount: 1
  }),
  teacherReviewPacket: writeJson(join(evidenceDir, "teacher-review-packet.json"), {
    format: "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1",
    status: "waiting_for_teacher_review",
    reviewItemCount: 1
  }),
  reviewDecisionReplayQueue: writeJson(join(evidenceDir, "review-decision-replay-queue.json"), {
    format: "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1",
    status: "review_decision_replay_ready_for_follow_up",
    replayItems: [{ status: "ready_for_follow_up" }]
  }),
  unattendedAudit: writeJson(join(evidenceDir, "unattended-audit.json"), {
    format: "transparent_ai_all_software_unattended_learning_audit_v1",
    status: "unattended_learning_ready_for_teacher_operational_review"
  })
};

const sourceWitnessPath = writeJson(join(smokeRoot, "source-witness.json"), {
  format: "transparent_ai_all_software_operational_learning_post_activation_witness_v1",
  status: "waiting_for_post_activation_registration_status",
  remainingGaps: [{ kind: "missing_post_activation_registration_status", detail: "smoke placeholder" }],
  paths: {
    dryRunRehearsal: evidencePaths.dryRunRehearsal,
    registrationExecuteGate: evidencePaths.registrationExecuteGate
  },
  locks: { reviewOnly: true, softwareActionsExecuted: false, goalComplete: false }
});

const builderResult = runScript("create-all-software-operational-post-activation-witness-receipt-builder.mjs", [
  "--goal",
  "Build receipt validation smoke builder.",
  "--witness",
  sourceWitnessPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const defaultReceipt = readJson(builderResult.receiptTemplatePath);
const blockedResult = runScript("validate-all-software-operational-post-activation-witness-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  builderResult.receiptTemplatePath,
  "--output-dir",
  join(smokeRoot, "blocked-validation")
]);
const blockedValidation = readJson(blockedResult.validationPath);

const reviewedReceipt = {
  ...defaultReceipt,
  teacherDecision: "teacher_reviewed_rerun_post_activation_witness",
  evidenceReviewed: true,
  evidencePaths
};
const reviewedReceiptPath = writeJson(join(smokeRoot, "teacher-reviewed-post-activation-witness-receipt.json"), reviewedReceipt);
const readyResult = runScript("validate-all-software-operational-post-activation-witness-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  join(smokeRoot, "ready-validation")
]);
const readyValidation = readJson(readyResult.validationPath);

const forbiddenReceipt = { ...reviewedReceipt, teacherDecision: "register_now" };
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-post-activation-witness-receipt.json"), forbiddenReceipt);
const forbiddenResult = runScript("validate-all-software-operational-post-activation-witness-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
]);
const forbiddenValidation = readJson(forbiddenResult.validationPath);

const checks = [
  check(
    "Post-activation witness receipt validation blocks default unreviewed receipt",
    blockedValidation.format === "transparent_ai_all_software_operational_post_activation_witness_receipt_validation_v1" &&
      blockedValidation.status === "blocked_until_teacher_reviews_post_activation_evidence_paths" &&
      blockedValidation.gates.teacherDecisionReadyForWitnessRerun === false &&
      blockedValidation.gates.evidenceReviewed === false &&
      blockedValidation.counts.blockedEvidenceRows > 0 &&
      blockedValidation.nextReviewOnlyWitnessCommand === "" &&
      blockedValidation.locks.validationDoesNotRegisterTask === true,
    blockedResult.validationPath
  ),
  check(
    "Post-activation witness receipt validation prepares only a review-only witness rerun command after every evidence path matches",
    readyValidation.status === "ready_for_review_only_post_activation_witness_rerun" &&
      readyValidation.decision === "ready_for_review_only_witness_rerun" &&
      readyValidation.counts.blockedEvidenceRows === 0 &&
      readyValidation.gates.allRequiredEvidencePathsPresentAndFormatMatched === true &&
      readyValidation.nextReviewOnlyWitnessCommand.includes("create-all-software-operational-learning-post-activation-witness.mjs") &&
      readyValidation.nextReviewOnlyWitnessCommand.includes("--run-output-audit") &&
      readyValidation.locks.validationDoesNotRerunWitness === true &&
      readyValidation.locks.softwareActionsExecuted === false,
    readyResult.validationPath
  ),
  check(
    "Post-activation witness receipt validation blocks forbidden registration or completion decisions",
    forbiddenValidation.status === "blocked_until_teacher_reviews_post_activation_evidence_paths" &&
      forbiddenValidation.gates.noForbiddenTeacherDecision === false &&
      forbiddenValidation.nextReviewOnlyWitnessCommand === "",
    forbiddenResult.validationPath
  ),
  check(
    "MCP advanced surface exposes post-activation witness receipt validation",
    existsSync(builderResult.htmlPath) &&
      builder.format === "transparent_ai_all_software_operational_post_activation_witness_receipt_builder_v1",
    builderResult.builderPath
  )
];

const failed = checks.filter((item) => !item.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length ? "failed" : "passed",
      smoke: "transparent_ai_all_software_operational_post_activation_witness_receipt_validation_smoke_v1",
      smokeRoot,
      paths: {
        builder: builderResult.builderPath,
        defaultReceipt: builderResult.receiptTemplatePath,
        reviewedReceipt: reviewedReceiptPath,
        blockedValidation: blockedResult.validationPath,
        readyValidation: readyResult.validationPath,
        forbiddenValidation: forbiddenResult.validationPath
      },
      checks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
