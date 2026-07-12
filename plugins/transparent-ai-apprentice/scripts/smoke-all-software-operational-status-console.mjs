#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function runScript(args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [join(__dirname, "create-all-software-operational-status-console.mjs"), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "status console script failed");
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "all-software-operational-status-console-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const missing = runScript([
  "--goal",
  "smoke missing operational status evidence",
  "--scan-root",
  join(smokeRoot, "empty"),
  "--output-dir",
  join(smokeRoot, "missing-output")
]);
const missingPacket = readJson(missing.consolePath);

const evidenceRoot = join(smokeRoot, "evidence");
const noisyRoot = join(evidenceRoot, "goal-command-centers", "noisy-preview-package");
mkdirSync(noisyRoot, { recursive: true });
for (let index = 0; index < 350; index += 1) {
  writeFileSync(join(noisyRoot, `noise-${String(index).padStart(3, "0")}.json`), "{}\n", "utf8");
}
writeJson(join(evidenceRoot, "all-software-operational-learning-workbenches", "ready", "all-software-operational-learning-workbench.json"), {
  format: "transparent_ai_all_software_operational_learning_workbench_v1",
  status: "ready_for_teacher_operational_review",
  operationalProof: {
    taskRegistered: true,
    reviewedOutputReady: true,
    reviewReplayed: true,
    unattendedReadyForTeacherOperationalReview: true,
    remainingGaps: []
  }
});
writeJson(join(evidenceRoot, "all-software-operational-learning-post-activation-witnesses", "ready", "all-software-operational-learning-post-activation-witness.json"), {
  format: "transparent_ai_all_software_operational_learning_post_activation_witness_v1",
  status: "post_activation_witness_ready_for_teacher_operational_review",
  operationalProof: {
    taskRegistered: true,
    reviewedOutputExists: true,
    readyForTeacherOperationalReview: true
  }
});
writeJson(join(evidenceRoot, "all-software-recurring-monitor-registration-status", "ready", "all-software-recurring-monitor-registration-status.json"), {
  format: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
  status: "registered_and_matches_reviewed_runner",
  taskRegistered: true
});
writeJson(join(evidenceRoot, "all-software-recurring-monitor-run-output-audits", "ready", "all-software-recurring-monitor-run-output-audit.json"), {
  format: "transparent_ai_all_software_recurring_monitor_run_output_audit_v1",
  status: "learning_events_waiting_for_teacher_review",
  totals: {
    reviewedRuns: 2,
    compactLearningEvents: 3,
    lockMismatches: 0
  }
});
writeJson(join(evidenceRoot, "all-software-recurring-monitor-teacher-review-packets", "ready", "all-software-recurring-monitor-teacher-review-packet.json"), {
  format: "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1",
  status: "waiting_for_teacher_review",
  reviewItems: [{ id: "event-1" }]
});
writeJson(join(evidenceRoot, "all-software-recurring-monitor-review-decision-replay-queues", "ready", "all-software-recurring-monitor-review-decision-replay-queue.json"), {
  format: "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1",
  status: "ready_for_follow_up_queue_review",
  replayRows: [{ id: "event-1", decision: "ready_for_follow_up" }]
});
writeJson(join(evidenceRoot, "all-software-unattended-learning-audits", "ready", "all-software-unattended-learning-audit.json"), {
  format: "transparent_ai_all_software_unattended_learning_audit_v1",
  status: "unattended_learning_ready_for_teacher_operational_review",
  unattendedAllAppMonitoringComplete: true,
  remainingGaps: []
});
writeJson(join(evidenceRoot, "all-software-coverage-convergence-audits", "ready", "all-software-coverage-convergence-audit.json"), {
  format: "transparent_ai_all_software_coverage_convergence_audit_v1",
  status: "bounded_coverage_ready_for_teacher_completion_review",
  remainingBatchCount: 0
});
const logSourceDiscoveryLedgerPath = writeJson(
  join(evidenceRoot, "all-software-log-source-discovery-ledgers", "ready", "all-software-log-source-discovery-ledger.json"),
  {
    format: "transparent_ai_all_software_log_source_discovery_ledger_v1",
    status: "needs_teacher_log_source_review",
    counts: {
      totalInventoryRows: 4,
      ledgerRows: 4,
      directLogCandidatesReadyForMetadataGate: 1,
      nonLogLowTokenFallbackReadyForReview: 1,
      windowsEventLogFallbackReadyForReview: 1,
      candidateRootsNeedBoundedScan: 0,
      needsTeacherLogSourceOrExclusion: 1,
      teacherExcludedOrPrivate: 0
    },
    allRowsHaveSourceRoute: false,
    allSoftwareLogSourceDiscoveryComplete: false,
    nextReviewQueue: [
      {
        ledgerNumber: 4,
        software: "MissingSourceApp",
        discoveryStatus: "needs_teacher_log_source_or_exclusion"
      }
    ],
    locks: {
      logContentsRead: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false,
      packagingGated: true
    }
  }
);
const coverageRolloutReceiptBuilderPath = writeJson(
  join(
    evidenceRoot,
    "all-software-coverage-rollout-receipt-builders",
    "ready",
    "all-software-coverage-rollout-receipt-builder.json"
  ),
  {
    format: "transparent_ai_all_software_coverage_rollout_receipt_builder_v1",
    status: "coverage_rollout_receipt_builder_ready_for_teacher_use",
    counts: {
      batches: 2,
      totalSoftware: 3
    },
    paths: {
      html: join(evidenceRoot, "all-software-coverage-rollout-receipt-builders", "ready", "all-software-coverage-rollout-receipt-builder.html"),
      sourceExpansionPlan: join(evidenceRoot, "fixture-coverage-expansion-plan.json")
    },
    nextValidationCommand:
      'node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-coverage-rollout-receipt.mjs --plan "D:\\example\\coverage-expansion-plan.json" --receipt "<teacher-filled-coverage-rollout-receipt.json>"',
    locks: {
      builderDoesNotWriteReceipt: true,
      rolloutSupervisorInvoked: false,
      coverageRunnerInvoked: false,
      targetSoftwareCommandsExecuted: false
    }
  }
);
const coverageRolloutReceiptValidationPath = writeJson(
  join(
    evidenceRoot,
    "all-software-coverage-rollout-receipt-validations",
    "ready",
    "all-software-coverage-rollout-receipt-validation.json"
  ),
  {
    format: "transparent_ai_all_software_coverage_rollout_receipt_validation_v1",
    status: "validated_with_ready_coverage_rollout_rows",
    validationDecision: "some_rows_ready_for_reviewed_coverage_rollout",
    readyRowCount: 1,
    nextReviewCommands: [
      {
        tool: "run_all_software_coverage_rollout_supervisor",
        commandLine:
          'node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-rollout-supervisor.mjs --plan "D:\\example\\coverage-expansion-plan.json" --teacher-reviewed --start-batch batch-001 --max-batches 1',
        executesNow: false
      }
    ],
    locks: {
      validationDoesNotInvokeRolloutSupervisor: true,
      rolloutSupervisorInvoked: false,
      coverageRunnerInvoked: false,
      targetSoftwareCommandsExecuted: false
    }
  }
);
writeJson(join(evidenceRoot, "all-software-execution-capability-convergence-audits", "ready", "all-software-execution-capability-convergence-audit.json"), {
  format: "transparent_ai_all_software_execution_capability_convergence_audit_v1",
  status: "bounded_execution_capability_ready_for_teacher_completion_review",
  remainingReviewGaps: []
});
const activationGatePath = writeJson(
  join(evidenceRoot, "all-software-operational-learning-activation-gates", "ready", "all-software-operational-learning-activation-gate.json"),
  {
    format: "transparent_ai_all_software_operational_learning_activation_gate_v1",
    status: "ready_for_teacher_registration_review",
    readyForTeacherRegistrationReview: true,
    blockers: [],
    locks: {
      activationGateDoesNotRegisterTask: true,
      scheduledTaskRegistered: false,
      teacherConfirmationRequiredBeforeSystemChange: true
    }
  }
);
const activationReviewPacketPath = writeJson(
  join(
    evidenceRoot,
    "all-software-operational-activation-review-packets",
    "ready",
    "all-software-operational-activation-review-packet.json"
  ),
  {
    format: "transparent_ai_all_software_operational_activation_review_packet_v1",
    status: "activation_gate_ready_for_dry_run_rehearsal",
    missingConfirmationCount: 0,
    confirmationRows: [
      { id: "recurring_monitor_teacher_confirmation", current: "confirmed" },
      { id: "reviewed_monitor_scope_confirmation", current: "confirmed" },
      { id: "registration_review_confirmation", current: "confirmed" },
      { id: "rollback_point_retained", current: "confirmed" }
    ],
    locks: {
      packetDoesNotRegisterTask: true,
      scheduledTaskRegistered: false,
      targetSoftwareCommandsExecuted: false
    }
  }
);
const activationReceiptValidationPath = writeJson(
  join(
    evidenceRoot,
    "all-software-operational-activation-review-receipt-validations",
    "ready",
    "all-software-operational-activation-review-receipt-validation.json"
  ),
  {
    format: "transparent_ai_all_software_operational_activation_review_receipt_validation_v1",
    status: "receipt_validated_ready_to_rerun_activation_gate",
    validationDecision: "ready_to_rerun_activation_gate_review_only",
    readyToRerunActivationGate: true,
    missingConfirmationCount: 0,
    nextSafeCommands: [
      {
        id: "rerun_activation_gate_after_validated_receipt",
        command: "node plugins\\transparent-ai-apprentice\\scripts\\create-all-software-operational-learning-activation-gate.mjs --trial \"D:\\example\\trial.json\" --rollback-point-created",
        enabled: true
      }
    ],
    locks: {
      validationDoesNotRegisterTask: true,
      scheduledTaskRegistered: false,
      targetSoftwareCommandsExecuted: false
    }
  }
);
const activationRehearsalPath = writeJson(
  join(
    evidenceRoot,
    "all-software-operational-learning-activation-dry-run-rehearsals",
    "ready",
    "all-software-operational-learning-activation-dry-run-rehearsal.json"
  ),
  {
    format: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
    status: "dry_run_rehearsal_passed_no_system_change",
    dryRunRehearsalPassed: true,
    locks: {
      activationDryRunWrapperExecuted: true,
      wrapperExecuteFlagPassed: false,
      scheduledTaskRegistered: false,
      registrationStatusQueryOnly: true,
      targetSoftwareCommandsExecuted: false
    }
  }
);
const registrationExecuteGatePath = writeJson(
  join(
    evidenceRoot,
    "all-software-operational-learning-registration-execute-gates",
    "ready",
    "all-software-operational-learning-registration-execute-gate.json"
  ),
  {
    format: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
    status: "ready_for_teacher_registration_execute_review",
    readyForTeacherRegistrationExecuteReview: true,
    blockers: [],
    locks: {
      executeRequestPrepared: true,
      executeRequestExecuted: false,
      scheduledTaskRegistered: false,
      scheduledTaskStarted: false,
      scheduledTaskUnregistered: false,
      targetSoftwareCommandsExecuted: false
    }
  }
);
writeJson(join(evidenceRoot, "original-goal-readiness-audits", "ready", "original-goal-readiness-audit.json"), {
  format: "transparent_ai_original_goal_readiness_audit_v1",
  status: "review_only_feasibility_verified_with_boundaries",
  completionDecision: "not_complete_full_objective_because_universal_native_control_and_unattended_all_app_coverage_are_not_proven"
});
const engineeringVoiceWorkbenchPath = writeJson(
  join(evidenceRoot, "engineering-voice-control-workbenches", "ready", "engineering-voice-control-workbench.json"),
  {
    format: "transparent_ai_engineering_voice_control_workbench_v1",
    status: "needs_teacher_review",
    productPurpose:
      "A teacher-facing single screen for non-experts: speak or type an engineering command, inspect numbered possible targets, confirm one number, then hand off only to dry-run-first supervised execution.",
    existingAbilitiesReused: [
      "create_voice_teaching_kit",
      "create_engineering_command_confirmation_kit",
      "confirm_engineering_command_target",
      "create_existing_software_execution_adapter"
    ],
    locks: {
      workbenchDoesNotExecuteSoftware: true,
      numberedTargetConfirmationRequired: true,
      targetSoftwareCommandsExecuted: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false
    }
  }
);

const ready = runScript([
  "--goal",
  "smoke ready operational status evidence",
  "--scan-root",
  evidenceRoot,
  "--max-files",
  "120",
  "--output-dir",
  join(smokeRoot, "ready-output")
]);
const readyPacket = readJson(ready.consolePath);
const readyReceipt = readJson(ready.receiptPath);
const readme = readFileSync(ready.readmePath, "utf8");

const reviewPacketRoot = join(smokeRoot, "review-packet-evidence");
writeJson(
  join(reviewPacketRoot, "all-software-operational-learning-activation-gates", "blocked", "all-software-operational-learning-activation-gate.json"),
  {
    format: "transparent_ai_all_software_operational_learning_activation_gate_v1",
    status: "waiting_for_teacher_confirmation_scope_or_rollback_review",
    readyForTeacherRegistrationReview: false,
    blockers: [
      "missing_explicit_teacher_recurring_monitor_confirmation",
      "missing_reviewed_monitor_scope_confirmation",
      "missing_explicit_teacher_registration_confirmation"
    ],
    locks: {
      activationGateDoesNotRegisterTask: true,
      scheduledTaskRegistered: false,
      targetSoftwareCommandsExecuted: false
    }
  }
);
writeJson(
  join(
    reviewPacketRoot,
    "all-software-operational-activation-review-packets",
    "waiting",
    "all-software-operational-activation-review-packet.json"
  ),
  {
    format: "transparent_ai_all_software_operational_activation_review_packet_v1",
    status: "waiting_for_teacher_activation_confirmations",
    missingConfirmationCount: 3,
    confirmationRows: [
      { id: "recurring_monitor_teacher_confirmation", current: "missing" },
      { id: "reviewed_monitor_scope_confirmation", current: "missing" },
      { id: "registration_review_confirmation", current: "missing" },
      { id: "rollback_point_retained", current: "confirmed" }
    ],
    locks: {
      packetDoesNotRegisterTask: true,
      scheduledTaskRegistered: false,
      targetSoftwareCommandsExecuted: false
    }
  }
);
writeJson(
  join(
    reviewPacketRoot,
    "all-software-operational-activation-review-receipt-validations",
    "waiting",
    "all-software-operational-activation-review-receipt-validation.json"
  ),
  {
    format: "transparent_ai_all_software_operational_activation_review_receipt_validation_v1",
    status: "receipt_validation_waiting_for_teacher_confirmation",
    validationDecision: "needs_teacher_review",
    readyToRerunActivationGate: false,
    missingConfirmationCount: 2,
    locks: {
      validationDoesNotRegisterTask: true,
      scheduledTaskRegistered: false,
      targetSoftwareCommandsExecuted: false
    }
  }
);
const reviewPacketWaiting = runScript([
  "--goal",
  "smoke activation review packet waiting status",
  "--scan-root",
  reviewPacketRoot,
  "--output-dir",
  join(smokeRoot, "review-packet-output")
]);
const reviewPacketWaitingPacket = readJson(reviewPacketWaiting.consolePath);

const explicit = runScript([
  "--goal",
  "smoke explicit evidence paths",
  "--workbench",
  join(evidenceRoot, "all-software-operational-learning-workbenches", "ready", "all-software-operational-learning-workbench.json"),
  "--post-activation-witness",
  join(evidenceRoot, "all-software-operational-learning-post-activation-witnesses", "ready", "all-software-operational-learning-post-activation-witness.json"),
  "--registration-status",
  join(evidenceRoot, "all-software-recurring-monitor-registration-status", "ready", "all-software-recurring-monitor-registration-status.json"),
  "--run-output-audit",
  join(evidenceRoot, "all-software-recurring-monitor-run-output-audits", "ready", "all-software-recurring-monitor-run-output-audit.json"),
  "--teacher-review-packet",
  join(evidenceRoot, "all-software-recurring-monitor-teacher-review-packets", "ready", "all-software-recurring-monitor-teacher-review-packet.json"),
  "--review-decision-replay-queue",
  join(evidenceRoot, "all-software-recurring-monitor-review-decision-replay-queues", "ready", "all-software-recurring-monitor-review-decision-replay-queue.json"),
  "--unattended-audit",
  join(evidenceRoot, "all-software-unattended-learning-audits", "ready", "all-software-unattended-learning-audit.json"),
  "--log-source-discovery-ledger",
  logSourceDiscoveryLedgerPath,
  "--coverage-rollout-receipt-builder",
  coverageRolloutReceiptBuilderPath,
  "--coverage-rollout-receipt-validation",
  coverageRolloutReceiptValidationPath,
  "--activation-gate",
  activationGatePath,
  "--activation-review-packet",
  activationReviewPacketPath,
  "--activation-receipt-validation",
  activationReceiptValidationPath,
  "--activation-dry-run-rehearsal",
  activationRehearsalPath,
  "--registration-execute-gate",
  registrationExecuteGatePath,
  "--engineering-voice-control-workbench",
  engineeringVoiceWorkbenchPath,
  "--output-dir",
  join(smokeRoot, "explicit-output")
]);
const explicitPacket = readJson(explicit.consolePath);

const checks = [
  check(
    "Status console scans missing evidence without claiming operation",
    missingPacket.status === "all_software_status_waiting_for_registration_or_manual_runner_evidence" &&
      missingPacket.scan.missingEvidence.includes("registration_status") &&
      missingPacket.scan.missingEvidence.includes("log_source_discovery_ledger") &&
      missingPacket.nextSafeActions.some((action) => action.command.includes("create-all-software-log-source-discovery-ledger.mjs")) &&
      missingPacket.completionBoundary.goalComplete === false,
    missing.consolePath
  ),
  check(
    "Status console auto-discovers latest operational evidence into one dashboard",
    readyPacket.status === "all_software_status_ready_for_teacher_operational_review" &&
      readyPacket.scan.scanStrategy === "preferred_evidence_directories_before_root_scan" &&
      readyPacket.scan.maxFiles === 120 &&
      readyPacket.operationalProof.taskRegistered === true &&
      readyPacket.operationalProof.reviewedOutputReady === true &&
      readyPacket.operationalProof.teacherReviewReady === true &&
      readyPacket.operationalProof.replayReady === true &&
      readyPacket.operationalProof.activationGateReady === true &&
      readyPacket.operationalProof.activationReviewPacketReady === true &&
      readyPacket.operationalProof.activationReceiptValidationReady === true &&
      readyPacket.operationalProof.activationReceiptValidatedForRerun === true &&
      readyPacket.operationalProof.activationDryRunPassed === true &&
      readyPacket.operationalProof.registrationExecuteGateReady === true &&
      readyPacket.operationalProof.coverageRolloutReceiptBuilderReady === true &&
      readyPacket.operationalProof.coverageRolloutReceiptValidationReady === true &&
      readyPacket.operationalProof.coverageRolloutReadyRows === 1 &&
      readyPacket.operationalProof.logSourceDiscoveryLedgerReady === true &&
      readyPacket.operationalProof.allSoftwareLogSourceDiscoveryComplete === false &&
      readyPacket.operationalProof.logSourceMissingRows === 1 &&
      readyPacket.operationalProof.logSourceNextReviewQueueCount === 1 &&
      readyPacket.operationalProof.engineeringVoiceControlReady === true &&
      readyPacket.scan.discoveredEvidence.logSourceDiscoveryLedger.found === true &&
      readyPacket.scan.discoveredEvidence.registrationExecuteGate.found === true &&
      readyPacket.scan.discoveredEvidence.activationReviewPacket.found === true &&
      readyPacket.scan.discoveredEvidence.activationReceiptValidation.found === true &&
      readyPacket.scan.discoveredEvidence.coverageRolloutReceiptBuilder.found === true &&
      readyPacket.scan.discoveredEvidence.coverageRolloutReceiptValidation.found === true &&
      readyPacket.scan.discoveredEvidence.engineeringVoiceControlWorkbench.found === true,
    ready.consolePath
  ),
  check(
    "Status console exposes log-source discovery ledger before broad coverage claims",
    readyPacket.lanes.some(
      (lane) =>
        lane.id === "log_source_discovery" &&
        lane.status === "waiting_for_teacher_log_source_or_exclusion" &&
        lane.detail.includes("allSoftwareLogSourceDiscoveryComplete=false")
    ) &&
      readyPacket.entryLinks.logSourceDiscoveryLedger === logSourceDiscoveryLedgerPath &&
      readyPacket.nextSafeActions.some(
        (action) =>
          action.label === "Review log-source discovery ledger gaps before reading logs or widening coverage" &&
          action.command.includes("all-software-log-source-discovery-ledger.json")
      ) &&
      readyPacket.blockedClaims.includes("claim_all_software_log_source_discovery_complete") &&
      readyPacket.blockedClaims.includes("read_logs_before_log_source_metadata_gate") &&
      readyPacket.blockedClaims.includes("widen_coverage_without_log_source_discovery_ledger") &&
      readyPacket.locks.allSoftwareLogSourceDiscoveryComplete === false,
    ready.consolePath
  ),
  check(
    "Status console exposes coverage rollout receipt gate without invoking rollout",
    readyPacket.lanes.some(
      (lane) =>
        lane.id === "coverage_rollout_receipt_gate" &&
        lane.status === "coverage_rollout_receipt_validation_has_reviewed_rows"
    ) &&
      readyPacket.entryLinks.coverageRolloutReceiptBuilder === coverageRolloutReceiptBuilderPath &&
      readyPacket.entryLinks.coverageRolloutReceiptValidation === coverageRolloutReceiptValidationPath &&
      readyPacket.nextSafeActions.some(
        (action) =>
          action.label === "Review validated coverage rollout commands; run one only after explicit teacher confirmation" &&
          action.command.includes("all-software-coverage-rollout-receipt-validation.json")
      ) &&
      readyPacket.blockedClaims.includes("run_coverage_rollout_supervisor_from_status_console") &&
      readyPacket.locks.rolloutSupervisorInvoked === false &&
      readyPacket.locks.coverageRunnerInvoked === false,
    ready.consolePath
  ),
  check(
    "Status console exposes execution capability convergence as a gated next safe action",
    readyPacket.lanes.some(
      (lane) =>
        lane.id === "execution_capability" &&
        lane.status === "bounded_execution_ready_for_teacher_review"
    ) &&
      readyPacket.nextSafeActions.some(
        (action) =>
          action.label === "Review execution capability convergence audit before any native-control claim" &&
          action.command.includes("all-software-execution-capability-convergence-audit.json") &&
          action.command.includes("do not claim universal native execution")
      ) &&
      readyPacket.blockedClaims.includes("claim_universal_native_execution") &&
      readyPacket.locks.nativeUniversalExecution === false,
    ready.consolePath
  ),
  check(
    "Status console shows the automatic learning activation path without registering the task",
    readyPacket.lanes.some(
      (lane) =>
        lane.id === "automatic_learning_activation_path" &&
        lane.status === "registration_execute_gate_ready_for_teacher_review"
    ) &&
      readyPacket.blockedClaims.includes("register_scheduled_task_without_activation_dry_run_and_execute_gate") &&
      readyPacket.blockedClaims.includes("treat_activation_review_packet_as_registration_permission") &&
      readyPacket.blockedClaims.includes("treat_activation_receipt_validation_as_registration_permission") &&
      readyPacket.locks.registerTaskCalled === false &&
      readyPacket.locks.startTaskCalled === false,
    ready.consolePath
  ),
  check(
    "Status console routes blocked activation gate through a teacher-facing activation review packet",
    reviewPacketWaitingPacket.operationalProof.activationReviewPacketReady === true &&
      reviewPacketWaitingPacket.operationalProof.activationReceiptValidationReady === true &&
      reviewPacketWaitingPacket.operationalProof.activationReceiptValidatedForRerun === false &&
      reviewPacketWaitingPacket.lanes.some(
        (lane) =>
          lane.id === "automatic_learning_activation_path" &&
          lane.status === "activation_receipt_validation_waiting_for_teacher_confirmations"
      ) &&
      reviewPacketWaitingPacket.nextSafeActions.some(
        (action) =>
          action.label === "Open activation receipt validation and resolve remaining confirmations" &&
          action.command.includes("all-software-operational-activation-review-receipt-validation.json")
      ) &&
      reviewPacketWaitingPacket.locks.registerTaskCalled === false,
    reviewPacketWaiting.consolePath
  ),
  check(
    "Status console exposes non-expert engineering voice/text control as a gated capability lane",
    readyPacket.lanes.some(
      (lane) =>
        lane.id === "non_expert_engineering_voice_control" &&
        lane.status === "voice_text_numbered_control_ready_for_teacher_review"
    ) &&
      readyPacket.blockedClaims.includes("execute_from_voice_without_numbered_target_confirmation") &&
      readyPacket.locks.targetSoftwareCommandsExecuted === false,
    ready.consolePath
  ),
  check(
    "Status console preserves completion and execution locks even with ready evidence",
    readyPacket.completionBoundary.goalComplete === false &&
      readyPacket.completionBoundary.nativeUniversalExecutionComplete === false &&
      readyPacket.locks.statusConsoleReadOnly === true &&
      readyPacket.locks.registerTaskCalled === false &&
      readyPacket.locks.runnerLaunched === false &&
      readyPacket.locks.targetSoftwareCommandsExecuted === false &&
      readyReceipt.locks.longTermMemoryWritten === false,
    ready.receiptPath
  ),
  check(
    "Status console supports explicit evidence paths and writes teacher start-here guide",
    explicitPacket.status === "all_software_status_ready_for_teacher_operational_review" &&
      readme.includes("All-Software Operational Status Console") &&
      readme.includes("Next safe actions:") &&
      readme.includes("Blocked claims:"),
    explicit.consolePath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_all_software_operational_status_console_smoke_v1",
  smokeRoot,
  checks
};
console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
