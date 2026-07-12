#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "operational-post-registration-output-witness-receipt-review-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(scriptName, args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${scriptName} was expected to fail`);
    if (!result.stdout) throw new Error(result.stderr || `${scriptName} failed without JSON output`);
    return {
      ...JSON.parse(result.stdout.replace(/^\uFEFF/, "")),
      failedAsExpected: true,
      exitStatus: result.status
    };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

const evidenceDir = join(smokeRoot, "evidence");
const operationalScope = {
  scopeKind: "teacher_reviewed_operational_low_token_monitor_scope",
  sourceTrialPath: join(smokeRoot, "operational-trial.json"),
  sourceSchedulePath: join(smokeRoot, "schedule.json"),
  sourceReviewedRunCount: 1,
  teacherReviewedScope: true,
  rollbackPointCreated: true
};
const evidencePaths = {
  outputWitnessReceipt: writeJson(join(evidenceDir, "output-witness-receipt.json"), {
    format: "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_receipt_v1",
    runnerTriggered: true,
    memoryWritten: false
  }),
  registrationStatus: writeJson(join(evidenceDir, "registration-status.json"), {
    format: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
    status: "registered_and_matches_reviewed_runner",
    registeredMatchesExpectedRunner: true
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
  }),
  dryRunRehearsal: writeJson(join(evidenceDir, "dry-run-rehearsal.json"), {
    format: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
    status: "passed_activation_registration_dry_run_rehearsal"
  }),
  registrationExecuteGate: writeJson(join(evidenceDir, "registration-execute-gate.json"), {
    format: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
    status: "ready_for_teacher_registration_execute_review"
  })
};

const outputWitnessRunnerPath = writeJson(join(smokeRoot, "output-witness-runner.json"), {
  format: "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_v1",
  status: "post_registration_output_triggered_learning_events_waiting_for_teacher_review",
  runnerTriggered: true,
  directRunnerInvoked: true,
  directRunnerExitedZero: true,
  operationalScope,
  evidenceCounts: {
    reviewedRunCount: 1,
    compactLearningEvents: 1,
    teacherReviewItems: 1,
    replayItems: 1
  },
  paths: {
    receipt: evidencePaths.outputWitnessReceipt,
    registrationStatus: evidencePaths.registrationStatus,
    runOutputAudit: evidencePaths.runOutputAudit,
    teacherReviewPacket: evidencePaths.teacherReviewPacket,
    reviewDecisionReplayQueue: evidencePaths.reviewDecisionReplayQueue,
    unattendedAudit: evidencePaths.unattendedAudit,
    dryRunRehearsal: evidencePaths.dryRunRehearsal,
    registrationExecuteGate: evidencePaths.registrationExecuteGate
  },
  locks: {
    screenshotsCaptured: false,
    memoryWritten: false,
    goalComplete: false
  }
});

const builderResult = runNode("create-all-software-operational-post-registration-output-witness-receipt-builder.mjs", [
  "--goal",
  "Build post-registration output witness receipt review smoke.",
  "--witness-runner",
  outputWitnessRunnerPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const template = readJson(builderResult.receiptTemplatePath);
const html = readFileSync(builderResult.htmlPath, "utf8");
const readme = readFileSync(builderResult.readmePath, "utf8");

const blockedResult = runNode("validate-all-software-operational-post-registration-output-witness-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  builderResult.receiptTemplatePath,
  "--output-dir",
  join(smokeRoot, "blocked-validation")
]);
const blockedValidation = readJson(blockedResult.validationPath);

const reviewedReceipt = {
  ...template,
  teacherDecision: "teacher_reviewed_output_witness",
  evidenceReviewed: true
};
const reviewedReceiptPath = writeJson(join(smokeRoot, "teacher-reviewed-output-witness-receipt.json"), reviewedReceipt);
const reviewedResult = runNode("validate-all-software-operational-post-registration-output-witness-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  join(smokeRoot, "reviewed-validation")
]);
const reviewedValidation = readJson(reviewedResult.validationPath);

const postActivationReceipt = {
  ...template,
  teacherDecision: "teacher_reviewed_prepare_post_activation_witness",
  evidenceReviewed: true
};
const postActivationReceiptPath = writeJson(join(smokeRoot, "teacher-reviewed-prepare-post-activation-receipt.json"), postActivationReceipt);
const readyResult = runNode("validate-all-software-operational-post-registration-output-witness-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  postActivationReceiptPath,
  "--output-dir",
  join(smokeRoot, "ready-validation")
]);
const readyValidation = readJson(readyResult.validationPath);

const forbiddenReceipt = { ...postActivationReceipt, teacherDecision: "register_now" };
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-output-witness-receipt.json"), forbiddenReceipt);
const forbiddenResult = runNode("validate-all-software-operational-post-registration-output-witness-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
], { expectFailure: true });
const forbiddenValidation = readJson(forbiddenResult.validationPath);

const checks = [
  {
    name: "Post-registration output witness receipt builder writes HTML and receipt template",
    pass:
      builderResult.format === "transparent_ai_all_software_operational_post_registration_output_witness_receipt_builder_result_v1" &&
      builder.format === "transparent_ai_all_software_operational_post_registration_output_witness_receipt_builder_v1" &&
      template.format === "transparent_ai_all_software_operational_post_registration_output_witness_review_receipt_v1" &&
      template.operationalScope?.teacherReviewedScope === true &&
      existsSync(builderResult.htmlPath) &&
      html.includes("Post-Registration Output Witness Receipt Builder") &&
      html.includes("runOutputAudit") &&
      readme.includes("does not save the generated receipt"),
    evidence: builderResult.htmlPath
  },
  {
    name: "Post-registration output witness receipt review preserves teacher-reviewed operational scope",
    pass:
      builder.operationalScope?.scopeKind === "teacher_reviewed_operational_low_token_monitor_scope" &&
      reviewedReceipt.operationalScope?.sourceTrialPath === operationalScope.sourceTrialPath &&
      reviewedValidation.operationalScopeVerified === true &&
      readyValidation.operationalScopeVerified === true,
    evidence: JSON.stringify(reviewedValidation.operationalScope)
  },
  {
    name: "Post-registration output witness receipt validation blocks default unreviewed receipt",
    pass:
      blockedValidation.status === "blocked_until_teacher_reviews_post_registration_output_witness_evidence" &&
      blockedValidation.gates.teacherDecisionPositive === false &&
      blockedValidation.gates.evidenceReviewed === false &&
      blockedValidation.nextPostActivationWitnessCommand === "" &&
      blockedValidation.locks.validationDoesNotRerunOutputWitness === true,
    evidence: blockedResult.validationPath
  },
  {
    name: "Post-registration output witness receipt validation accepts reviewed output witness without system changes",
    pass:
      reviewedValidation.status === "post_registration_output_witness_reviewed_waiting_for_optional_post_activation_evidence" &&
      reviewedValidation.decision === "output_witness_reviewed_no_system_change" &&
      reviewedValidation.counts.blockedCoreEvidenceRows === 0 &&
      reviewedValidation.nextPostActivationWitnessCommand === "" &&
      reviewedValidation.locks.validationDoesNotRegisterTask === true &&
      reviewedValidation.locks.softwareActionsExecuted === false,
    evidence: reviewedResult.validationPath
  },
  {
    name: "Post-registration output witness receipt validation prepares only review-only post-activation witness command",
    pass:
      readyValidation.status === "ready_for_review_only_post_activation_witness_command" &&
      readyValidation.decision === "ready_for_review_only_post_activation_witness" &&
      readyValidation.counts.blockedCoreEvidenceRows === 0 &&
      readyValidation.counts.blockedPostActivationEvidenceRows === 0 &&
      readyValidation.nextPostActivationWitnessCommand.includes(
        "create-all-software-operational-learning-post-activation-witness.mjs"
      ) &&
      readyValidation.nextPostActivationWitnessCommand.includes("--run-output-audit") &&
      readyValidation.locks.validationDoesNotInvokeReviewedScheduledRunner === true,
    evidence: readyResult.validationPath
  },
  {
    name: "Post-registration output witness receipt validation fails closed on forbidden registration decisions",
    pass:
      forbiddenValidation.status === "blocked_until_teacher_reviews_post_registration_output_witness_evidence" &&
      forbiddenValidation.gates.noForbiddenTeacherDecision === false &&
      forbiddenValidation.nextPostActivationWitnessCommand === "" &&
      forbiddenResult.failedAsExpected === true &&
      forbiddenResult.exitStatus !== 0,
    evidence: forbiddenResult.validationPath
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(JSON.stringify({ status: "failed", smoke: "transparent_ai_operational_post_registration_output_witness_receipt_review_smoke_v1", smokeRoot, checks }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: "passed", smoke: "transparent_ai_operational_post_registration_output_witness_receipt_review_smoke_v1", smokeRoot, checks }, null, 2));
