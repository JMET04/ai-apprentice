#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-operational-status-console")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-operational-status-console"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function latestNamedFile(root, names, maxFiles = 4000, preferredSubdirs = []) {
  if (!root || !existsSync(root)) return "";
  const wanted = new Set(names);
  const resolvedRoot = resolve(root);
  const preferredRoots = preferredSubdirs
    .map((subdir) => join(resolvedRoot, subdir))
    .filter((candidate) => existsSync(candidate));
  const roots = preferredRoots.length ? preferredRoots : [resolvedRoot];
  const matches = [];
  const seenRoots = new Set();
  for (const searchRoot of roots) {
    const normalizedRoot = resolve(searchRoot).toLowerCase();
    if (seenRoots.has(normalizedRoot)) continue;
    seenRoots.add(normalizedRoot);
    const stack = [searchRoot];
    let scanned = 0;
    while (stack.length && scanned < maxFiles) {
      const current = stack.pop();
      let entries = [];
      try {
        entries = readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return b.name.localeCompare(a.name);
      });
      for (const entry of entries) {
        const full = join(current, entry.name);
        scanned += 1;
        if (entry.isDirectory()) {
          if (/\bsmoke\b|smoke-|-\bsmoke\b|-smoke/i.test(entry.name)) continue;
          stack.push(full);
        } else if (wanted.has(entry.name)) {
          try {
            matches.push({ path: full, mtimeMs: statSync(full).mtimeMs });
          } catch {
            // Ignore files that disappear during a status scan.
          }
        }
        if (scanned >= maxFiles) break;
      }
    }
  }
  matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches[0]?.path || "";
}

function readEvidence({ explicit, scanRoot, names, expectedFormat, label, preferredSubdirs, maxFiles }) {
  if (explicit && String(explicit).trim().startsWith("{")) {
    const value = JSON.parse(String(explicit));
    return {
      label,
      path: "",
      status: value.status || value.completionDecision || "provided",
      format: value.format || "",
      formatMatched: expectedFormat ? value.format === expectedFormat : true,
      value
    };
  }
  const path = explicit ? resolve(explicit) : latestNamedFile(scanRoot, names, maxFiles, preferredSubdirs);
  if (!path || !existsSync(path)) {
    return { label, path: "", status: "missing", format: "", formatMatched: false, value: null };
  }
  const value = readJson(path);
  return {
    label,
    path,
    status: value.status || value.completionDecision || "provided",
    format: value.format || "",
    formatMatched: expectedFormat ? value.format === expectedFormat : true,
    value
  };
}

function buildLocks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    statusConsoleReadOnly: true,
    scanReadsEvidenceMetadataOnly: true,
    registerTaskCalled: false,
    unregisterTaskCalled: false,
    startTaskCalled: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    logContentsRead: false,
    rawFullLogsRetained: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    longTermMemoryWritten: false,
    rolloutSupervisorInvoked: false,
    coverageRunnerInvoked: false,
    nativeUniversalExecution: false,
    allSoftwareLogSourceDiscoveryComplete: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (!value) continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function numbers(value) {
  if (!value || typeof value !== "object") return {};
  return value.totals || value.counts || value.summary || {};
}

function evidenceSummary(input) {
  return {
    label: input.label,
    found: Boolean(input.value),
    path: input.path,
    format: input.format,
    formatMatched: input.formatMatched,
    status: input.status
  };
}

function writeReadme(path, consolePacket) {
  const lines = [
    "# All-Software Operational Status Console",
    "",
    `Status: ${consolePacket.status}`,
    `Goal completion: ${consolePacket.completionBoundary.goalComplete}`,
    "",
    "Evidence lanes:",
    ...consolePacket.lanes.map((lane) => `- ${lane.id}: ${lane.status} (${lane.detail})`),
    "",
    "Next safe actions:",
    ...consolePacket.nextSafeActions.map((action, index) => `${index + 1}. ${action.label}: ${action.command}`),
    "",
    "Blocked claims:",
    ...consolePacket.blockedClaims.map((claim) => `- ${claim}`),
    "",
    "This status console is read-only. It scans existing evidence files and writes a dashboard packet; it does not register tasks, launch runners, capture screenshots, read full logs, execute software, write memory, enable rules, accept technology, or claim universal native execution."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "Summarize current all-software low-token learning and supervised execution readiness without changing the system."
);
const scanRoot = resolve(argValue("--scan-root", join(process.cwd(), ".transparent-apprentice")));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-operational-status-consoles")));
const maxFiles = Math.max(100, Number(argValue("--max-files", "4000")) || 4000);
mkdirSync(outputRoot, { recursive: true });

const evidence = {
  workbench: readEvidence({
    explicit: argValue("--workbench", ""),
    scanRoot,
    names: ["all-software-operational-learning-workbench.json"],
    expectedFormat: "transparent_ai_all_software_operational_learning_workbench_v1",
    label: "operational_learning_workbench",
    preferredSubdirs: ["all-software-operational-learning-workbenches"],
    maxFiles
  }),
  postActivationWitness: readEvidence({
    explicit: argValue("--post-activation-witness", argValue("--witness", "")),
    scanRoot,
    names: ["all-software-operational-learning-post-activation-witness.json"],
    expectedFormat: "transparent_ai_all_software_operational_learning_post_activation_witness_v1",
    label: "post_activation_witness",
    preferredSubdirs: ["all-software-operational-learning-post-activation-witnesses"],
    maxFiles
  }),
  registrationStatus: readEvidence({
    explicit: argValue("--registration-status", ""),
    scanRoot,
    names: [
      "all-software-recurring-monitor-registration-status.json",
      "recurring-monitor-registration-status.json",
      "status-registered.json",
      "status-not-registered.json"
    ],
    expectedFormat: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
    label: "registration_status",
    preferredSubdirs: [
      "all-software-recurring-monitor-registration-status",
      "all-software-operational-learning-activation-gates"
    ],
    maxFiles
  }),
  runOutputAudit: readEvidence({
    explicit: argValue("--run-output-audit", ""),
    scanRoot,
    names: [
      "all-software-recurring-monitor-run-output-audit.json",
      "recurring-monitor-run-output-audit.json",
      "run-output-audit.json"
    ],
    expectedFormat: "transparent_ai_all_software_recurring_monitor_run_output_audit_v1",
    label: "run_output_audit",
    preferredSubdirs: [
      "all-software-recurring-monitor-run-output-audits",
      "all-software-operational-learning-trials"
    ],
    maxFiles
  }),
  teacherReviewPacket: readEvidence({
    explicit: argValue("--teacher-review-packet", ""),
    scanRoot,
    names: [
      "all-software-recurring-monitor-teacher-review-packet.json",
      "recurring-monitor-teacher-review-packet.json",
      "teacher-review-packet.json"
    ],
    expectedFormat: "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1",
    label: "teacher_review_packet",
    preferredSubdirs: ["all-software-recurring-monitor-teacher-review-packets"],
    maxFiles
  }),
  reviewDecisionReplayQueue: readEvidence({
    explicit: argValue("--review-decision-replay-queue", argValue("--replay-queue", "")),
    scanRoot,
    names: [
      "all-software-recurring-monitor-review-decision-replay-queue.json",
      "recurring-monitor-review-decision-replay-queue.json",
      "replay-queue.json"
    ],
    expectedFormat: "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1",
    label: "review_decision_replay_queue",
    preferredSubdirs: ["all-software-recurring-monitor-review-decision-replay-queues"],
    maxFiles
  }),
  unattendedAudit: readEvidence({
    explicit: argValue("--unattended-audit", ""),
    scanRoot,
    names: ["all-software-unattended-learning-audit.json", "unattended-audit-ready.json", "unattended-audit-not-ready.json"],
    expectedFormat: "transparent_ai_all_software_unattended_learning_audit_v1",
    label: "unattended_learning_audit",
    preferredSubdirs: ["all-software-unattended-learning-audits"],
    maxFiles
  }),
  coverageConvergenceAudit: readEvidence({
    explicit: argValue("--coverage-convergence-audit", ""),
    scanRoot,
    names: ["all-software-coverage-convergence-audit.json"],
    expectedFormat: "transparent_ai_all_software_coverage_convergence_audit_v1",
    label: "coverage_convergence_audit",
    preferredSubdirs: ["all-software-coverage-convergence-audits"],
    maxFiles
  }),
  logSourceDiscoveryLedger: readEvidence({
    explicit: argValue("--log-source-discovery-ledger", argValue("--source-discovery-ledger", "")),
    scanRoot,
    names: ["all-software-log-source-discovery-ledger.json"],
    expectedFormat: "transparent_ai_all_software_log_source_discovery_ledger_v1",
    label: "log_source_discovery_ledger",
    preferredSubdirs: ["all-software-log-source-discovery-ledgers"],
    maxFiles
  }),
  coverageRolloutReceiptBuilder: readEvidence({
    explicit: argValue("--coverage-rollout-receipt-builder", argValue("--coverage-rollout-builder", "")),
    scanRoot,
    names: ["all-software-coverage-rollout-receipt-builder.json"],
    expectedFormat: "transparent_ai_all_software_coverage_rollout_receipt_builder_v1",
    label: "coverage_rollout_receipt_builder",
    preferredSubdirs: ["current-coverage-rollout-receipt-builder", "all-software-coverage-rollout-receipt-builders"],
    maxFiles
  }),
  coverageRolloutReceiptValidation: readEvidence({
    explicit: argValue("--coverage-rollout-receipt-validation", argValue("--coverage-rollout-validation", "")),
    scanRoot,
    names: ["all-software-coverage-rollout-receipt-validation.json"],
    expectedFormat: "transparent_ai_all_software_coverage_rollout_receipt_validation_v1",
    label: "coverage_rollout_receipt_validation",
    preferredSubdirs: ["all-software-coverage-rollout-receipt-validations"],
    maxFiles
  }),
  executionConvergenceAudit: readEvidence({
    explicit: argValue("--execution-convergence-audit", ""),
    scanRoot,
    names: ["all-software-execution-capability-convergence-audit.json"],
    expectedFormat: "transparent_ai_all_software_execution_capability_convergence_audit_v1",
    label: "execution_capability_convergence_audit",
    preferredSubdirs: ["original-goal-execution-convergence-audits", "all-software-execution-capability-convergence-audits"],
    maxFiles
  }),
  activationGate: readEvidence({
    explicit: argValue("--activation-gate", ""),
    scanRoot,
    names: ["all-software-operational-learning-activation-gate.json"],
    expectedFormat: "transparent_ai_all_software_operational_learning_activation_gate_v1",
    label: "operational_activation_gate",
    preferredSubdirs: ["all-software-operational-learning-activation-gates"],
    maxFiles
  }),
  activationReviewPacket: readEvidence({
    explicit: argValue("--activation-review-packet", argValue("--review-packet", "")),
    scanRoot,
    names: ["all-software-operational-activation-review-packet.json"],
    expectedFormat: "transparent_ai_all_software_operational_activation_review_packet_v1",
    label: "activation_review_packet",
    preferredSubdirs: ["all-software-operational-activation-review-packets"],
    maxFiles
  }),
  activationReceiptValidation: readEvidence({
    explicit: argValue("--activation-receipt-validation", argValue("--receipt-validation", "")),
    scanRoot,
    names: ["all-software-operational-activation-review-receipt-validation.json"],
    expectedFormat: "transparent_ai_all_software_operational_activation_review_receipt_validation_v1",
    label: "activation_receipt_validation",
    preferredSubdirs: ["all-software-operational-activation-review-receipt-validations"],
    maxFiles
  }),
  activationDryRunRehearsal: readEvidence({
    explicit: argValue("--activation-dry-run-rehearsal", argValue("--dry-run-rehearsal", "")),
    scanRoot,
    names: ["all-software-operational-learning-activation-dry-run-rehearsal.json"],
    expectedFormat: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
    label: "activation_dry_run_rehearsal",
    preferredSubdirs: ["all-software-operational-learning-activation-dry-run-rehearsals"],
    maxFiles
  }),
  registrationExecuteGate: readEvidence({
    explicit: argValue("--registration-execute-gate", ""),
    scanRoot,
    names: ["all-software-operational-learning-registration-execute-gate.json"],
    expectedFormat: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
    label: "registration_execute_gate",
    preferredSubdirs: ["all-software-operational-learning-registration-execute-gates"],
    maxFiles
  }),
  originalGoalReadinessAudit: readEvidence({
    explicit: argValue("--original-goal-readiness-audit", ""),
    scanRoot,
    names: ["original-goal-readiness-audit.json"],
    expectedFormat: "transparent_ai_original_goal_readiness_audit_v1",
    label: "original_goal_readiness_audit",
    preferredSubdirs: ["original-goal-readiness-audits"],
    maxFiles
  }),
  engineeringVoiceControlWorkbench: readEvidence({
    explicit: argValue("--engineering-voice-control-workbench", argValue("--voice-control-workbench", "")),
    scanRoot,
    names: ["engineering-voice-control-workbench.json"],
    expectedFormat: "transparent_ai_engineering_voice_control_workbench_v1",
    label: "engineering_voice_control_workbench",
    preferredSubdirs: ["engineering-voice-control-workbenches", "goal-command-centers"],
    maxFiles
  })
};

const taskRegistered = evidence.registrationStatus.value?.status === "registered_and_matches_reviewed_runner" ||
  evidence.postActivationWitness.value?.operationalProof?.taskRegistered === true;
const runCounts = numbers(evidence.runOutputAudit.value);
const reviewedRuns = Number(runCounts.reviewedRuns ?? runCounts.reviewedRunCount ?? 0);
const compactEvents = Number(runCounts.compactLearningEvents ?? 0);
const reviewedOutputReady =
  reviewedRuns > 0 ||
  compactEvents > 0 ||
  evidence.workbench.value?.operationalProof?.reviewedOutputReady === true ||
  evidence.postActivationWitness.value?.operationalProof?.reviewedOutputExists === true;
const teacherReviewReady = Boolean(evidence.teacherReviewPacket.value);
const replayReady = Boolean(evidence.reviewDecisionReplayQueue.value);
const unattendedReady = evidence.unattendedAudit.value?.status === "unattended_learning_ready_for_teacher_operational_review";
const postActivationReady = evidence.postActivationWitness.value?.status === "post_activation_witness_ready_for_teacher_operational_review";
const coverageConverged = evidence.coverageConvergenceAudit.value?.status === "bounded_coverage_ready_for_teacher_completion_review";
const logSourceDiscoveryLedgerReady = Boolean(evidence.logSourceDiscoveryLedger.value);
const logSourceDiscoveryCounts = evidence.logSourceDiscoveryLedger.value?.counts || {};
const logSourceMissingRows = Number(logSourceDiscoveryCounts.needsTeacherLogSourceOrExclusion || 0);
const logSourceNextReviewQueueCount = Number(evidence.logSourceDiscoveryLedger.value?.nextReviewQueue?.length || 0);
const allRowsHaveLogSourceRoute = evidence.logSourceDiscoveryLedger.value?.allRowsHaveSourceRoute === true;
const coverageRolloutReceiptBuilderReady = Boolean(evidence.coverageRolloutReceiptBuilder.value) &&
  evidence.coverageRolloutReceiptBuilder.value?.locks?.builderDoesNotWriteReceipt === true &&
  evidence.coverageRolloutReceiptBuilder.value?.locks?.rolloutSupervisorInvoked === false &&
  evidence.coverageRolloutReceiptBuilder.value?.locks?.coverageRunnerInvoked === false;
const coverageRolloutReceiptValidationReady = Boolean(evidence.coverageRolloutReceiptValidation.value) &&
  evidence.coverageRolloutReceiptValidation.value?.locks?.validationDoesNotInvokeRolloutSupervisor === true &&
  evidence.coverageRolloutReceiptValidation.value?.locks?.rolloutSupervisorInvoked === false &&
  evidence.coverageRolloutReceiptValidation.value?.locks?.coverageRunnerInvoked === false;
const coverageRolloutReadyRows = Number(evidence.coverageRolloutReceiptValidation.value?.readyRowCount || 0);
const executionConverged = evidence.executionConvergenceAudit.value?.status === "bounded_execution_capability_ready_for_teacher_completion_review";
const activationGateReady = evidence.activationGate.value?.readyForTeacherRegistrationReview === true ||
  evidence.activationGate.value?.status === "ready_for_teacher_registration_review";
const activationReviewPacketReady = Boolean(evidence.activationReviewPacket.value) &&
  evidence.activationReviewPacket.value?.locks?.packetDoesNotRegisterTask === true &&
  evidence.activationReviewPacket.value?.locks?.scheduledTaskRegistered === false &&
  evidence.activationReviewPacket.value?.locks?.targetSoftwareCommandsExecuted === false;
const activationReceiptValidationReady = Boolean(evidence.activationReceiptValidation.value) &&
  evidence.activationReceiptValidation.value?.locks?.validationDoesNotRegisterTask === true &&
  evidence.activationReceiptValidation.value?.locks?.scheduledTaskRegistered === false &&
  evidence.activationReceiptValidation.value?.locks?.targetSoftwareCommandsExecuted === false;
const activationReceiptValidatedForRerun =
  activationReceiptValidationReady && evidence.activationReceiptValidation.value?.readyToRerunActivationGate === true;
const activationDryRunPassed = evidence.activationDryRunRehearsal.value?.dryRunRehearsalPassed === true &&
  evidence.activationDryRunRehearsal.value?.locks?.wrapperExecuteFlagPassed === false &&
  evidence.activationDryRunRehearsal.value?.locks?.scheduledTaskRegistered === false;
const registrationExecuteGateReady = evidence.registrationExecuteGate.value?.readyForTeacherRegistrationExecuteReview === true &&
  evidence.registrationExecuteGate.value?.locks?.executeRequestPrepared === true &&
  evidence.registrationExecuteGate.value?.locks?.executeRequestExecuted === false &&
  evidence.registrationExecuteGate.value?.locks?.scheduledTaskRegistered === false;
const engineeringVoiceControlReady = Boolean(evidence.engineeringVoiceControlWorkbench.value) &&
  evidence.engineeringVoiceControlWorkbench.value?.locks?.workbenchDoesNotExecuteSoftware === true &&
  evidence.engineeringVoiceControlWorkbench.value?.locks?.numberedTargetConfirmationRequired === true &&
  evidence.engineeringVoiceControlWorkbench.value?.locks?.targetSoftwareCommandsExecuted === false &&
  evidence.engineeringVoiceControlWorkbench.value?.existingAbilitiesReused?.includes("confirm_engineering_command_target");
const originalCompletionDecision =
  evidence.originalGoalReadinessAudit.value?.completionDecision ||
  "not_complete_full_objective_because_current_status_console_is_not_a_completion_proof";

const lanes = [
  {
    id: "operational_learning",
    status: postActivationReady || unattendedReady ? "ready_for_teacher_operational_review" : "not_operationally_proven",
    detail: taskRegistered
      ? reviewedOutputReady
        ? "registered monitor and reviewed output evidence are present"
        : "registration is present but reviewed runner output is missing"
      : "registered recurring monitor evidence is missing"
  },
  {
    id: "low_token_output_review",
    status: reviewedOutputReady ? "reviewed_output_present" : "waiting_for_runner_output_audit",
    detail: `reviewedRuns=${reviewedRuns}; compactLearningEvents=${compactEvents}`
  },
  {
    id: "teacher_review_loop",
    status: teacherReviewReady && replayReady ? "review_packet_and_replay_present" : "waiting_for_teacher_review_or_replay",
    detail: `teacherReviewPacket=${teacherReviewReady}; replayQueue=${replayReady}`
  },
  {
    id: "coverage_convergence",
    status: coverageConverged ? "bounded_coverage_ready_for_teacher_review" : "coverage_still_bounded_or_missing",
    detail: evidence.coverageConvergenceAudit.status
  },
  {
    id: "log_source_discovery",
    status: logSourceDiscoveryLedgerReady
      ? logSourceMissingRows > 0
        ? "waiting_for_teacher_log_source_or_exclusion"
        : allRowsHaveLogSourceRoute
          ? "all_bounded_rows_have_reviewable_source_routes"
          : "log_source_routes_ready_for_teacher_review"
      : "waiting_for_log_source_discovery_ledger",
    detail: logSourceDiscoveryLedgerReady
      ? `ledgerRows=${logSourceDiscoveryCounts.ledgerRows ?? "unknown"}; directLogs=${logSourceDiscoveryCounts.directLogCandidatesReadyForMetadataGate ?? "unknown"}; missingSources=${logSourceMissingRows}; nextReviewQueue=${logSourceNextReviewQueueCount}; allSoftwareLogSourceDiscoveryComplete=false`
      : "per-software log/source routes are not mapped yet; create the ledger before broad coverage claims"
  },
  {
    id: "coverage_rollout_receipt_gate",
    status: coverageRolloutReceiptValidationReady
      ? coverageRolloutReadyRows > 0
        ? "coverage_rollout_receipt_validation_has_reviewed_rows"
        : "coverage_rollout_receipt_validation_waiting_for_reviewed_rows"
      : coverageRolloutReceiptBuilderReady
        ? "coverage_rollout_receipt_ready_for_teacher_review"
        : "waiting_for_coverage_rollout_receipt_builder",
    detail: coverageRolloutReceiptValidationReady
      ? `readyRows=${coverageRolloutReadyRows}; validationDecision=${evidence.coverageRolloutReceiptValidation.value?.validationDecision || "unknown"}`
      : coverageRolloutReceiptBuilderReady
        ? `batches=${evidence.coverageRolloutReceiptBuilder.value?.counts?.batches ?? "unknown"}; totalSoftware=${evidence.coverageRolloutReceiptBuilder.value?.counts?.totalSoftware ?? "unknown"}`
        : evidence.coverageRolloutReceiptBuilder.status
  },
  {
    id: "execution_capability",
    status: executionConverged ? "bounded_execution_ready_for_teacher_review" : "execution_capability_still_bounded_or_missing",
    detail: evidence.executionConvergenceAudit.status
  },
  {
    id: "automatic_learning_activation_path",
    status: registrationExecuteGateReady
      ? "registration_execute_gate_ready_for_teacher_review"
      : activationDryRunPassed
        ? "activation_dry_run_passed_waiting_for_registration_execute_gate"
        : activationGateReady
          ? "activation_gate_ready_waiting_for_dry_run_rehearsal"
          : evidence.activationGate.value
            ? activationReceiptValidatedForRerun
              ? "activation_receipt_validated_waiting_for_activation_gate_rerun"
              : activationReceiptValidationReady
                ? "activation_receipt_validation_waiting_for_teacher_confirmations"
                : activationReviewPacketReady
                  ? "activation_review_packet_waiting_for_teacher_confirmations"
                  : "activation_gate_waiting_for_teacher_scope_confirmation_or_rollback"
            : "waiting_for_activation_gate",
    detail: registrationExecuteGateReady
      ? "execute and rollback commands are prepared for separate teacher review but not executed"
      : activationDryRunPassed
        ? "dry-run wrapper evidence passed with no scheduled-task change"
        : activationGateReady
          ? "activation gate is ready; next safe step is dry-run rehearsal"
          : activationReceiptValidatedForRerun
            ? "validated receipt can rerun activation gate without registering a task"
            : activationReceiptValidationReady
              ? `validationDecision=${evidence.activationReceiptValidation.value?.validationDecision}; missing=${evidence.activationReceiptValidation.value?.missingConfirmationCount ?? "unknown"}`
              : activationReviewPacketReady
                ? `confirmationRows=${evidence.activationReviewPacket.value?.confirmationRows?.length || 0}; missing=${evidence.activationReviewPacket.value?.missingConfirmationCount ?? "unknown"}`
            : evidence.activationGate.value?.blockers?.join(", ") || evidence.activationGate.status
  },
  {
    id: "non_expert_engineering_voice_control",
    status: engineeringVoiceControlReady ? "voice_text_numbered_control_ready_for_teacher_review" : "waiting_for_voice_text_numbered_control_workbench",
    detail: engineeringVoiceControlReady
      ? "voice/text workbench exists, reuses numbered target confirmation, and keeps software execution locked"
      : "engineering voice/text workbench evidence is missing or does not preserve execution locks"
  },
  {
    id: "original_goal_boundary",
    status: originalCompletionDecision,
    detail: "full goal remains active until all in-scope apps and native control evidence are proven"
  }
];

const missingEvidence = Object.values(evidence).filter((item) => !item.value).map((item) => item.label);
const readyForTeacherOperationalReview = (postActivationReady || unattendedReady) && reviewedOutputReady && teacherReviewReady && replayReady;
const status = readyForTeacherOperationalReview
  ? "all_software_status_ready_for_teacher_operational_review"
  : taskRegistered
    ? "all_software_status_registered_waiting_for_reviewed_output_or_replay"
    : "all_software_status_waiting_for_registration_or_manual_runner_evidence";

const nextSafeActions = [];
if (!logSourceDiscoveryLedgerReady) {
  nextSafeActions.push({
    label: "Create all-software log source discovery ledger before broad coverage claims",
    command: commandLine("create-all-software-log-source-discovery-ledger.mjs", [
      ["--inventory", "<software-observer-inventory.json>"],
      ["--queue", "<software-observer-queue.json>"]
    ])
  });
} else if (logSourceMissingRows > 0 || logSourceNextReviewQueueCount > 0) {
  nextSafeActions.push({
    label: "Review log-source discovery ledger gaps before reading logs or widening coverage",
    command: `Review log source discovery ledger in "${evidence.logSourceDiscoveryLedger.path}"; ask the teacher for source markers or exclusions before coverage claims`
  });
}
if (!taskRegistered) {
  nextSafeActions.push({
    label: "Open operational workbench and prepare registration review",
    command: commandLine("create-all-software-operational-learning-workbench.mjs", [["--goal", goal]])
  });
}
if (taskRegistered && !reviewedOutputReady) {
  nextSafeActions.push({
    label: "Audit existing recurring output without launching the runner",
    command: commandLine("audit-all-software-recurring-monitor-run-output.mjs", [["--registration-status", evidence.registrationStatus.path]])
  });
}
if (reviewedOutputReady && !teacherReviewReady) {
  nextSafeActions.push({
    label: "Build teacher review packet for compact learning events",
    command: commandLine("create-all-software-recurring-monitor-teacher-review-packet.mjs", [["--run-output-audit", evidence.runOutputAudit.path]])
  });
}
if (teacherReviewReady && !replayReady) {
  nextSafeActions.push({
    label: "Replay teacher review decisions into the next follow-up queue",
    command: commandLine("create-all-software-recurring-monitor-review-decision-replay-queue.mjs", [
      ["--teacher-review-packet", evidence.teacherReviewPacket.path]
    ])
  });
}
if (coverageConverged && !coverageRolloutReceiptBuilderReady) {
  nextSafeActions.push({
    label: "Create coverage rollout receipt builder before widening coverage",
    command: commandLine("create-all-software-coverage-rollout-receipt-builder.mjs", [
      ["--plan", "<coverage-expansion-plan.json>"],
      ["--convergence-audit", evidence.coverageConvergenceAudit.path]
    ])
  });
}
if (coverageRolloutReceiptBuilderReady && !coverageRolloutReceiptValidationReady) {
  nextSafeActions.push({
    label: "Validate teacher-filled coverage rollout receipt",
    command:
      evidence.coverageRolloutReceiptBuilder.value?.nextValidationCommand ||
      commandLine("validate-all-software-coverage-rollout-receipt.mjs", [
        ["--plan", evidence.coverageRolloutReceiptBuilder.value?.paths?.sourceExpansionPlan],
        ["--receipt", "<teacher-filled-coverage-rollout-receipt.json>"]
      ])
  });
}
if (coverageRolloutReceiptValidationReady && coverageRolloutReadyRows > 0) {
  nextSafeActions.push({
    label: "Review validated coverage rollout commands; run one only after explicit teacher confirmation",
    command: `Review coverage rollout validation in "${evidence.coverageRolloutReceiptValidation.path}"`
  });
}
if (executionConverged) {
  nextSafeActions.push({
    label: "Review execution capability convergence audit before any native-control claim",
    command: `Review execution convergence audit in "${evidence.executionConvergenceAudit.path}"; do not claim universal native execution without separate teacher completion review`
  });
} else if (evidence.executionConvergenceAudit.value?.nextCommand) {
  nextSafeActions.push({
    label: "Resolve execution capability gaps through the reviewed convergence audit",
    command: evidence.executionConvergenceAudit.value.nextCommand
  });
} else if (evidence.executionConvergenceAudit.value) {
  nextSafeActions.push({
    label: "Review execution capability convergence gaps before supervised execution",
    command: `Review execution convergence audit in "${evidence.executionConvergenceAudit.path}"`
  });
}
if (evidence.activationGate.value && !activationGateReady) {
  nextSafeActions.push({
    label: activationReceiptValidatedForRerun
      ? "Rerun activation gate from validated teacher receipt"
      : activationReceiptValidationReady
        ? "Open activation receipt validation and resolve remaining confirmations"
        : activationReviewPacketReady
      ? "Open activation review packet and fill teacher confirmations"
      : "Create activation review packet before any registration dry-run",
    command: activationReceiptValidatedForRerun
      ? evidence.activationReceiptValidation.value?.nextSafeCommands?.[0]?.command ||
        commandLine("create-all-software-operational-learning-activation-gate.mjs", [["--trial", evidence.activationGate.value?.paths?.sourceTrial]])
      : activationReceiptValidationReady
        ? `Review activation receipt validation in "${evidence.activationReceiptValidation.path}"`
        : activationReviewPacketReady
          ? commandLine("validate-all-software-operational-activation-review-receipt.mjs", [
              ["--review-packet", evidence.activationReviewPacket.path],
              ["--receipt", "<teacher-filled-activation-review-receipt.json>"]
            ])
          : commandLine("create-all-software-operational-activation-review-packet.mjs", [["--activation-gate", evidence.activationGate.path]])
  });
}
if (activationGateReady && !activationDryRunPassed) {
  nextSafeActions.push({
    label: "Run activation registration wrapper rehearsal in dry-run mode",
    command: commandLine("run-all-software-operational-learning-activation-dry-run-rehearsal.mjs", [
      ["--activation-gate", evidence.activationGate.path]
    ])
  });
}
if (activationDryRunPassed && !registrationExecuteGateReady) {
  nextSafeActions.push({
    label: "Prepare final registration execute gate without running it",
    command: commandLine("create-all-software-operational-learning-registration-execute-gate.mjs", [
      ["--dry-run-rehearsal", evidence.activationDryRunRehearsal.path]
    ])
  });
}
if (!engineeringVoiceControlReady) {
  nextSafeActions.push({
    label: "Create non-expert engineering voice/text numbered-control workbench",
    command: commandLine("create-engineering-voice-control-workbench.mjs", [["--goal", goal]])
  });
}
nextSafeActions.push({
  label: "Refresh completion-boundary audit before any broad claim",
  command: commandLine("create-original-goal-readiness-audit.mjs", [["--goal", goal]])
});

const consoleId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const consoleDir = join(outputRoot, consoleId);
mkdirSync(consoleDir, { recursive: true });
const consolePath = join(consoleDir, "all-software-operational-status-console.json");
const receiptPath = join(consoleDir, "all-software-operational-status-console-receipt.json");
const readmePath = join(consoleDir, "ALL_SOFTWARE_OPERATIONAL_STATUS_CONSOLE_START_HERE.md");
const locks = buildLocks();
const packet = {
  ok: true,
  format: "transparent_ai_all_software_operational_status_console_v1",
  consoleId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  purpose:
    "Read-only status dashboard for the real all-software low-token learning and supervised execution objective. It summarizes existing evidence, missing evidence, and next safe commands without changing the system.",
  scan: {
    scanRoot,
    maxFiles,
    scanStrategy: "preferred_evidence_directories_before_root_scan",
    discoveredEvidence: Object.fromEntries(Object.entries(evidence).map(([key, value]) => [key, evidenceSummary(value)])),
    missingEvidence
  },
  lanes,
  operationalProof: {
    taskRegistered,
    reviewedOutputReady,
    teacherReviewReady,
    replayReady,
    unattendedReady,
    postActivationReady,
    coverageConverged,
    logSourceDiscoveryLedgerReady,
    allRowsHaveLogSourceRoute,
    logSourceMissingRows,
    logSourceNextReviewQueueCount,
    allSoftwareLogSourceDiscoveryComplete: false,
    executionConverged,
    activationGateReady,
    activationReviewPacketReady,
    activationReceiptValidationReady,
    activationReceiptValidatedForRerun,
    activationDryRunPassed,
    registrationExecuteGateReady,
    coverageRolloutReceiptBuilderReady,
    coverageRolloutReceiptValidationReady,
    coverageRolloutReadyRows,
    engineeringVoiceControlReady,
    readyForTeacherOperationalReview
  },
  completionBoundary: {
    goalComplete: false,
    allSoftwareCoverageComplete: false,
    nativeUniversalExecutionComplete: false,
    originalCompletionDecision,
    reason:
      "This console can prove status visibility and evidence readiness only. It cannot prove every installed app has useful logs or universal native semantic control."
  },
  nextSafeActions,
  entryLinks: {
    logSourceDiscoveryLedger: evidence.logSourceDiscoveryLedger.path,
    coverageRolloutReceiptBuilder: evidence.coverageRolloutReceiptBuilder.path,
    coverageRolloutReceiptBuilderHtml: evidence.coverageRolloutReceiptBuilder.value?.paths?.html || "",
    coverageRolloutReceiptValidation: evidence.coverageRolloutReceiptValidation.path,
    engineeringVoiceControlWorkbench: evidence.engineeringVoiceControlWorkbench.path
  },
  blockedClaims: [
    "claim_goal_complete",
    "claim_unattended_all_app_monitoring_complete",
    "claim_universal_native_execution",
    "claim_all_software_log_source_discovery_complete",
    "read_logs_before_log_source_metadata_gate",
    "widen_coverage_without_log_source_discovery_ledger",
    "execute_from_voice_without_numbered_target_confirmation",
    "treat_coverage_rollout_receipt_as_completion_or_execution_permission",
    "run_coverage_rollout_supervisor_from_status_console",
    "register_scheduled_task_without_activation_dry_run_and_execute_gate",
    "treat_activation_review_packet_as_registration_permission",
    "treat_activation_receipt_validation_as_registration_permission",
    "write_long_term_memory_from_unreviewed_events",
    "register_or_start_recurring_monitor_from_status_console",
    "execute_target_software_from_status_console"
  ],
  paths: {
    console: consolePath,
    receipt: receiptPath,
    readme: readmePath
  },
  locks
};

const receipt = {
  format: "transparent_ai_all_software_operational_status_console_receipt_v1",
  consoleId,
  status,
  operationalProof: packet.operationalProof,
  completionBoundary: packet.completionBoundary,
  evidenceFound: Object.fromEntries(Object.entries(evidence).map(([key, value]) => [key, Boolean(value.value)])),
  locks
};

writeFileSync(consolePath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_status_console_result_v1",
      consoleId,
      status,
      consolePath,
      receiptPath,
      readmePath,
      missingEvidenceCount: missingEvidence.length,
      nextSafeActions: nextSafeActions.length,
      locks
    },
    null,
    2
  )
);
