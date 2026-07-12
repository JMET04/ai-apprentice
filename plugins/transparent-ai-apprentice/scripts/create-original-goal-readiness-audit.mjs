#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slug(value) {
  return String(value || "original-goal-readiness-audit")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "original-goal-readiness-audit";
}

function runJsonScript(scriptName) {
  const scriptPath = join(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) {
    return {
      status: "failed",
      command: `node plugins/transparent-ai-apprentice/scripts/${scriptName}`,
      exitCode: result.status,
      stderr: result.stderr,
      stdout: result.stdout
    };
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    return {
      status: "failed_to_parse",
      command: `node plugins/transparent-ai-apprentice/scripts/${scriptName}`,
      exitCode: result.status,
      parseError: error.message,
      stdout: result.stdout
    };
  }
}

function readText(relativePath) {
  return readFileSync(join(pluginRoot, relativePath), "utf8");
}

function pickCheck(result, label) {
  return (result.checks ?? []).find((check) => check.requirement === label || check.name === label) ?? null;
}

function statusFromEvidence(goalSmoke, verifier, requirementLabel) {
  const goalCheck = pickCheck(goalSmoke, requirementLabel);
  const verifierPassed = verifier.status === "passed";
  if (goalCheck?.pass && verifierPassed) return "implemented_review_only_verified";
  if (goalCheck?.pass) return "implemented_by_goal_smoke_only";
  return "not_verified";
}

function writeReadme(path, audit) {
  const lines = [
    "# Original Goal Readiness Audit",
    "",
    `Status: ${audit.status}`,
    `Completion decision: ${audit.completionDecision}`,
    "",
    "## Summary",
    "",
    audit.summary,
    "",
    "## Requirement Results",
    ""
  ];
  for (const item of audit.requirements) {
    lines.push(`- ${item.id}: ${item.status}`);
    lines.push(`  Evidence: ${item.evidenceSummary}`);
    lines.push(`  Proof signals: ${item.proofSignals.join("; ")}`);
    if (item.notProven.length) lines.push(`  Not proven: ${item.notProven.join("; ")}`);
  }
  lines.push("", "## Verification Commands", "");
  for (const command of audit.verificationCommands) lines.push(`- ${command}`);
  lines.push("", "## Next Best Work", "");
  for (const step of audit.nextBestWork) lines.push(`- ${step}`);
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goalText =
  argValue(
    "--goal",
    "电脑上所有的软件都能自动读取日志并用低token学习；适应任何人的学习方法；透明绘画蒙版表达老师想法；理解透视/位置关系并到软件中执行；支持二维和三维深度草图演示。"
  );
const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, ".transparent-apprentice", "original-goal-readiness-audits"))
);
const runCommands = !hasFlag("--no-run");
const auditDir = join(outputRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goalText)}`);
mkdirSync(auditDir, { recursive: true });

const goalSmoke = runCommands
  ? runJsonScript("smoke-goal-coverage.mjs")
  : { status: "not_run", checks: [] };
const verifier = runCommands
  ? runJsonScript("verify-plugin.mjs")
  : { status: "not_run", checks: [] };

const sourceEvidence = {
  allSoftwareLearningCycle: readText("scripts/run-all-software-low-token-learning-cycle.mjs"),
  realLocalAllSoftwareLowTokenReadinessPackage: readText("scripts/create-real-local-all-software-low-token-readiness-package.mjs"),
  allSoftwareCoverageAudit: readText("scripts/create-all-software-observer-coverage-audit.mjs"),
  allSoftwareCoverageEnrollmentLedger: readText("scripts/create-all-software-coverage-enrollment-ledger.mjs"),
  allSoftwareCoverageEnrollmentFollowUpPlan: readText("scripts/create-all-software-coverage-enrollment-follow-up-plan.mjs"),
  allSoftwareCoverageEnrollmentFollowUpBatch: readText("scripts/run-all-software-coverage-enrollment-follow-up-batch.mjs"),
  allSoftwareCoverageEnrollmentFollowUpReconciliation: readText("scripts/reconcile-all-software-coverage-enrollment-follow-up-batch.mjs"),
  allSoftwareCoverageConvergenceAudit: readText("scripts/create-all-software-coverage-convergence-audit.mjs"),
  convergenceAutomaticLearningPackage: readText("scripts/create-convergence-automatic-learning-package.mjs"),
  allSoftwareRecurringMonitorApprovalGate: readText("scripts/create-all-software-recurring-monitor-approval-gate.mjs"),
  allSoftwareRecurringMonitorTeacherReviewPacket: readText("scripts/create-all-software-recurring-monitor-teacher-review-packet.mjs"),
  allSoftwareRecurringMonitorReviewDecisionReplayQueue: readText("scripts/create-all-software-recurring-monitor-review-decision-replay-queue.mjs"),
  allSoftwareUnattendedLearningAudit: readText("scripts/create-all-software-unattended-learning-audit.mjs"),
  allSoftwareOperationalLearningWorkbench: readText("scripts/create-all-software-operational-learning-workbench.mjs"),
  allSoftwareOperationalLearningTrial: readText("scripts/run-all-software-operational-learning-trial.mjs"),
  allSoftwareControlChannelCoverageAudit: readText("scripts/create-all-software-control-channel-coverage-audit.mjs"),
  allSoftwareExecutionPilotQueue: readText("scripts/create-all-software-execution-pilot-queue.mjs"),
  allSoftwareExecutionCapabilityMatrix: readText("scripts/create-all-software-execution-capability-matrix.mjs"),
  allSoftwareExecutionCapabilityConvergenceAudit: readText("scripts/create-all-software-execution-capability-convergence-audit.mjs"),
  allSoftwareExecutionPilotRunner: readText("scripts/run-all-software-execution-pilot-runner.mjs"),
  allSoftwareExecutionPilotBatch: readText("scripts/run-all-software-execution-pilot-batch.mjs"),
  realLocalAllSoftwareExecutionReadinessBatch: readText("scripts/run-real-local-all-software-execution-readiness-batch.mjs"),
  realLocalExecutionPilotSelector: readText("scripts/create-real-local-execution-pilot-selector.mjs"),
  teacherMethodProfile: readText("scripts/create-teacher-learning-method-profile.mjs"),
  transparentOverlay: readText("scripts/create-transparent-sketch-overlay-kit.mjs"),
  spatialIntent: readText("scripts/interpret-transparent-sketch-spatial-intent.mjs"),
  visualEngineeringTargetConfirmation: readText("scripts/create-visual-engineering-target-confirmation-kit.mjs"),
  engineeringVoiceControlSession: readText("scripts/create-engineering-voice-control-session.mjs"),
  engineeringVoiceControlWorkbench: readText("scripts/create-engineering-voice-control-workbench.mjs"),
  engineeringVoiceExecutionApprovalGate: readText("scripts/create-engineering-voice-execution-approval-gate.mjs"),
  engineeringVoiceExecutionApprovalGateSmoke: readText("scripts/smoke-engineering-voice-execution-approval-gate.mjs"),
  realLocalEngineeringVoiceControlledExecutionSmoke: readText("scripts/smoke-real-local-engineering-voice-controlled-execution.mjs"),
  realLocalAllSoftwareExecutionPilotRunnerSmoke: readText("scripts/smoke-real-local-all-software-execution-pilot-runner.mjs"),
  realLocalAllSoftwareExecutionCapabilityMatrixSmoke: readText("scripts/smoke-real-local-all-software-execution-capability-matrix.mjs"),
  realLocalAllSoftwareExecutionPilotBatchSmoke: readText("scripts/smoke-real-local-all-software-execution-pilot-batch.mjs"),
  realLocalAllSoftwareExecutionReadinessBatchSmoke: readText("scripts/smoke-real-local-all-software-execution-readiness-batch.mjs"),
  realLocalExecutionPilotSelectorSmoke: readText("scripts/smoke-real-local-execution-pilot-selector.mjs"),
  goalCommandCenter: readText("scripts/create-goal-command-center.mjs"),
  goalCommandCenterTrial: readText("scripts/run-goal-command-center-trial.mjs"),
  parametricDrawingLogic: readText("scripts/create-parametric-drawing-logic-learning-kit.mjs"),
  parametricDrawingLogicReceiptValidation: readText("scripts/validate-parametric-drawing-logic-receipt.mjs"),
  parametricDrawingLogicSmoke: readText("scripts/smoke-parametric-drawing-logic-learning-kit.mjs"),
  parametricDrawingLogicReceiptValidationSmoke: readText("scripts/smoke-parametric-drawing-logic-receipt-validation.mjs"),
  allSoftwareOperationalLearningActivationGate: readText("scripts/create-all-software-operational-learning-activation-gate.mjs"),
  allSoftwareOperationalLearningActivationDryRunRehearsal: readText(
    "scripts/run-all-software-operational-learning-activation-dry-run-rehearsal.mjs"
  ),
  allSoftwareOperationalLearningRegistrationExecuteGate: readText(
    "scripts/create-all-software-operational-learning-registration-execute-gate.mjs"
  ),
  allSoftwareOperationalLearningRegistrationApprovedRunner: readText(
    "scripts/run-all-software-operational-learning-registration-approved-runner.mjs"
  ),
  allSoftwareOperationalLearningPostRegistrationOutputWitnessRunner: readText(
    "scripts/run-all-software-operational-learning-post-registration-output-witness-runner.mjs"
  ),
  allSoftwareOperationalLearningPostActivationWitness: readText(
    "scripts/create-all-software-operational-learning-post-activation-witness.mjs"
  ),
  allSoftwareOperationalStatusConsole: readText("scripts/create-all-software-operational-status-console.mjs"),
  triggeredVisualLearningHandoff: existsSync(join(pluginRoot, "scripts", "smoke-triggered-visual-evidence-learning-handoff.mjs"))
    ? readText("scripts/smoke-triggered-visual-evidence-learning-handoff.mjs")
    : ""
};

const requirements = [
  {
    id: "all_software_low_token_log_learning",
    userRequirement: "电脑上所有的软件都能自动读取日志并用低token学习，不能只有CAD和SolidWorks。",
    status: statusFromEvidence(goalSmoke, verifier, "Can discover low-token evidence for arbitrary software, not only CAD or SolidWorks"),
    evidenceSummary:
      "Uses all-software inventory, observer queue, metadata delta gate, queue runner, all-software low-token learning cycle, automatic runner, schedule package, recurring monitor approval gate, recurring monitor run-output audit, teacher-review packet, review decision replay queue, unattended learning completion-boundary audit, operational learning workbench, real-local readiness package, real-local execution readiness dry-run batch, goal command center trial, real-local bounded smokes, coverage audit, a per-software enrollment ledger, an enrollment follow-up plan, an enrollment follow-up batch runner, and a reconciliation step that loops reviewed batch evidence back into the next audit and ledger.",
    proofSignals: [
      "transparent_ai_all_software_low_token_learning_cycle_v1",
      "transparent_ai_real_local_all_software_low_token_readiness_package_v1",
      "transparent_ai_all_software_observer_coverage_audit_v1",
      "transparent_ai_all_software_coverage_enrollment_ledger_v1",
      "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
      "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1",
      "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_v1",
      "transparent_ai_all_software_coverage_convergence_audit_v1",
      "transparent_ai_convergence_automatic_learning_package_v1",
      "transparent_ai_all_software_recurring_monitor_approval_gate_v1",
      "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1",
      "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1",
      "transparent_ai_all_software_unattended_learning_audit_v1",
      "transparent_ai_all_software_operational_learning_workbench_v1",
      "transparent_ai_all_software_operational_learning_trial_v1",
      "transparent_ai_all_software_operational_learning_activation_gate_v1",
      "transparent_ai_goal_command_center_v1",
      "transparent_ai_goal_command_center_trial_v1",
      "metadataDeltaGateEnabled",
      "nonLogFallbackItems"
    ],
    notProven: [
      "Not every installed app is proven to expose useful logs.",
      "Unattended background monitoring is not installed by default.",
      "Private or excluded software still requires teacher review before observation."
    ]
  },
  {
    id: "low_token_no_continuous_recording",
    userRequirement: "少用token，不要一直录屏；日志变动时再看截图。",
    status: statusFromEvidence(goalSmoke, verifier, "Uses low-token learning instead of continuous recording"),
    evidenceSummary:
      "Metadata gates, bounded tails, compact learning events, triggered visual requests, and one-shot capture receipts are verified.",
    proofSignals: [
      "fullContinuousRecording=false",
      "rawFullLogsRetained=false",
      "transparent_ai_triggered_visual_evidence_learning_handoff_smoke_v1"
    ],
    notProven: ["No automatic screenshot capture occurs without teacher-reviewed trigger and explicit confirmation."]
  },
  {
    id: "all_software_unattended_learning_audit",
    userRequirement: "Audit whether recurring low-token learning is operational before claiming all-software automatic log learning.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Audits unattended all-software low-token learning chain before completion claims"
    ),
    evidenceSummary:
      "The unattended learning audit aggregates automatic schedule, recurring monitor approval, registration runner, registration status, run-output audit, teacher review packet, and review replay evidence into one completion-boundary report.",
    proofSignals: [
      "transparent_ai_all_software_unattended_learning_audit_v1",
      "transparent_ai_all_software_unattended_learning_audit_receipt_v1",
      "unattended_learning_not_ready_remaining_gaps",
      "unattended_learning_ready_for_teacher_operational_review",
      "scheduled_task_not_registered_or_not_matching"
    ],
    notProven: [
      "The audit does not itself register scheduled tasks or prove every in-scope app has recurring output.",
      "Teacher review, replay decisions, rollback, and memory/rule gates still have to pass before operational acceptance."
    ]
  },
  {
    id: "all_software_operational_learning_workbench",
    userRequirement:
      "Give the teacher one safe operational path for moving all-software low-token learning from readiness evidence toward scheduled operation and audit review.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Provides one operational workbench for all-software low-token learning activation and verification"
    ),
    evidenceSummary:
      "The operational learning workbench indexes readiness, schedule, approval, registration runner, read-only status, run-output audit, teacher review, replay, and unattended audit evidence into one start-here guide.",
    proofSignals: [
      "transparent_ai_all_software_operational_learning_workbench_v1",
      "transparent_ai_all_software_operational_learning_workbench_receipt_v1",
      "ALL_SOFTWARE_OPERATIONAL_LEARNING_WORKBENCH_START_HERE.md",
      "operationalWorkbenchDoesNotRegisterTask: true",
      "operationalWorkbenchDoesNotLaunchRunner: true"
    ],
    notProven: [
      "The workbench does not itself register scheduled tasks or launch the runner.",
      "It does not prove every installed app has useful logs, recurring reviewed output, teacher acceptance, or native semantic control."
    ]
  },
  {
    id: "all_software_operational_learning_trial",
    userRequirement:
      "Prove the current computer can run the all-software low-token learning chain once without relying only on static packages.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Runs a bounded real-local operational trial of the all-software low-token learning chain"
    ),
    evidenceSummary:
      "The operational learning trial refreshes or reuses readiness evidence, manually launches only the existing automatic low-token runner, audits the runner output, creates the unattended-boundary audit, and builds the operational workbench into one start-here proof packet.",
    proofSignals: [
      "transparent_ai_all_software_operational_learning_trial_v1",
      "transparent_ai_all_software_operational_learning_trial_receipt_v1",
      "ALL_SOFTWARE_OPERATIONAL_LEARNING_TRIAL_START_HERE.md",
      "manualLowTokenRunnerLaunched: true",
      "scheduledTaskRegistered: false",
      "targetSoftwareCommandsExecuted: false",
      "longTermMemoryWritten: false"
    ],
    notProven: [
      "This is a manual operational proof, not a registered unattended monitor.",
      "It does not prove every installed app has useful logs, teacher acceptance, or universal native execution."
    ]
  },
  {
    id: "all_software_operational_learning_activation_gate",
    userRequirement:
      "Move from a real-local low-token learning trial toward automatic log learning activation without skipping teacher review, rollback, or dry-run registration gates.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Bridges operational trial evidence into an automatic learning activation review gate"
    ),
    evidenceSummary:
      "The activation gate consumes an operational trial, reuses the recurring monitor approval gate, prepares a dry-run registration runner, verifies scheduled-task status read-only, and rebuilds the workbench with activation evidence while keeping system changes blocked.",
    proofSignals: [
      "transparent_ai_all_software_operational_learning_activation_gate_v1",
      "transparent_ai_all_software_operational_learning_activation_gate_receipt_v1",
      "ALL_SOFTWARE_OPERATIONAL_LEARNING_ACTIVATION_GATE_START_HERE.md",
      "activationGateDoesNotRegisterTask: true",
      "registrationRunnerDryRunOnly: true",
      "registrationStatusQueryOnly: true",
      "scheduledTaskRegistered: false"
    ],
    notProven: [
      "The activation gate does not itself register or start a scheduled task.",
      "The teacher must still confirm scope, recurring monitoring, registration, and rollback before any system change."
    ]
  },
  {
    id: "all_software_operational_learning_activation_dry_run_rehearsal",
    userRequirement:
      "Before any automatic all-software learning activation changes the system, actually rehearse the generated registration wrapper in dry-run mode and verify status read-only.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Rehearses the activation registration wrapper in dry-run mode before any system change"
    ),
    evidenceSummary:
      "The activation dry-run rehearsal consumes an activation gate, locates the generated registration wrapper, invokes it without an execute flag, captures stdout/stderr/exit code, then runs the scheduled-task status verifier in read-only mode. It proves the activation path can be exercised before any task registration, start, unregister, target software command, screenshot, memory write, rule acceptance, or packaging unlock.",
    proofSignals: [
      "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
      "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_receipt_v1",
      "ALL_SOFTWARE_OPERATIONAL_LEARNING_ACTIVATION_DRY_RUN_REHEARSAL_START_HERE.md",
      "activationDryRunWrapperExecuted: true",
      "wrapperExecuteFlagPassed: false",
      "registrationStatusQueryOnly: true",
      "scheduledTaskRegistered: false"
    ],
    notProven: [
      "The rehearsal does not register, start, stop, or unregister a scheduled task.",
      "It does not prove unattended all-app monitoring is active; it only proves the pre-activation wrapper can be safely dry-run and reviewed."
    ]
  },
  {
    id: "all_software_operational_learning_registration_execute_gate",
    userRequirement:
      "After a passed activation dry-run rehearsal, prepare the real scheduled-task registration command only behind teacher review, rollback evidence, and an explicit execute gate.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Prepares a teacher-reviewed registration execute gate after activation dry-run rehearsal"
    ),
    evidenceSummary:
      "The registration execute gate consumes a passed activation dry-run rehearsal, verifies the source registration runner and post-rehearsal status, blocks without explicit teacher registration confirmation and rollback evidence, then prepares the real register and rollback/unregister commands without executing them.",
    proofSignals: [
      "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
      "transparent_ai_all_software_operational_learning_registration_execute_gate_receipt_v1",
      "ALL_SOFTWARE_OPERATIONAL_LEARNING_REGISTRATION_EXECUTE_GATE_START_HERE.md",
      "ready_for_teacher_registration_execute_review",
      "executeRequestPrepared: true",
      "executeRequestExecuted: false",
      "scheduledTaskRegistered: false"
    ],
    notProven: [
      "The execute gate does not itself register the scheduled task.",
      "It does not prove recurring output, teacher acceptance, or all-app unattended monitoring completion."
    ]
  },
  {
    id: "all_software_operational_learning_registration_approved_runner",
    userRequirement:
      "After the registration execute gate is ready, run exactly one teacher-approved recurring monitor registration attempt and verify Scheduled Task status read-only before any operational claim.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Executes one teacher-approved registration gate and witnesses scheduled-task status before operational claims"
    ),
    evidenceSummary:
      "The approved registration runner consumes a ready registration execute gate, requires final teacher registration confirmation, rollback evidence, an explicit execute-approved-registration flag, and allow-system-change, invokes only the existing recurring-monitor registration runner, then immediately runs the read-only scheduled-task status verifier. The verifier result is treated as authoritative instead of trusting the command exit code.",
    proofSignals: [
      "transparent_ai_all_software_operational_learning_registration_approved_runner_v1",
      "transparent_ai_all_software_operational_learning_registration_approved_runner_receipt_v1",
      "missing_execute_approved_registration_flag",
      "missing_allow_system_change_for_registration",
      "registration_execute_completed_and_status_matched",
      "registration_execute_completed_but_status_not_registered_or_mismatch",
      "statusVerifierRanAfterExecute: true",
      "unattendedAllAppMonitoringComplete: false"
    ],
    notProven: [
      "This runner can execute one approved registration command, but it does not start the task or prove recurring output exists.",
      "Operational automatic learning still requires post-activation status, run-output audit, teacher review, replay, unattended audit, and teacher acceptance before any completion claim."
    ]
  },
  {
    id: "all_software_operational_learning_post_registration_output_witness_runner",
    userRequirement:
      "After registration status matches the reviewed runner, trigger one bounded reviewed runner output and immediately route it through low-token output audit and teacher review gates before any operational claim.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Triggers one post-registration reviewed runner output and chains audit, teacher review, replay, and unattended gates"
    ),
    evidenceSummary:
      "The post-registration output witness runner consumes a registered-and-matching read-only registration status, requires teacher confirmation, rollback evidence, a trigger-reviewed-output flag, and allow-runner-trigger, directly invokes the same reviewed scheduled runner once, then chains existing run-output audit, teacher review packet, review decision replay queue, unattended audit, and optional post-activation witness evidence.",
    proofSignals: [
      "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_v1",
      "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_receipt_v1",
      "reviewed_scheduled_runner_direct_invocation",
      "post_registration_output_triggered_learning_events_waiting_for_teacher_review",
      "scheduledTaskStarted: false",
      "memoryWritten: false",
      "goalComplete: false"
    ],
    notProven: [
      "This runner does not register, unregister, start, or stop the Windows Scheduled Task; it directly invokes the reviewed runner script once for bounded proof.",
      "Compact learning events still require teacher review before memory, rule enablement, acceptance, packaging, or completion claims."
    ]
  },
  {
    id: "all_software_operational_learning_post_activation_witness",
    userRequirement:
      "After the reviewed registration execute gate, verify whether the registered recurring monitor is actually producing low-token learning output before any operational claim.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Witnesses post-activation registration, output, and review evidence before operational claims"
    ),
    evidenceSummary:
      "The post-activation witness ties the activation dry-run rehearsal, registration execute gate, read-only registration status, recurring run-output audit, teacher review packet, decision replay queue, and unattended-learning audit into one evidence chain. It reports missing registration, output, review, replay, or audit gaps without registering tasks, launching runners, capturing screenshots, reading full logs, writing memory, enabling rules, or executing target software.",
    proofSignals: [
      "transparent_ai_all_software_operational_learning_post_activation_witness_v1",
      "transparent_ai_all_software_operational_learning_post_activation_witness_receipt_v1",
      "ALL_SOFTWARE_OPERATIONAL_LEARNING_POST_ACTIVATION_WITNESS_START_HERE.md",
      "missing_post_activation_registration_status",
      "registered_waiting_for_post_activation_output_review",
      "post_activation_witness_ready_for_teacher_operational_review",
      "postActivationWitnessDoesNotChangeSystem: true",
      "goalComplete: false"
    ],
    notProven: [
      "The witness does not itself register scheduled tasks, launch the runner, or create recurring output.",
      "It can prove the provided activation scope is ready for teacher operational review, but it still does not prove every installed app has useful logs or universal native semantic execution."
    ]
  },
  {
    id: "all_software_operational_status_console",
    userRequirement:
      "Give the teacher or next agent a low-token current-state dashboard that shows what all-software learning and execution evidence is present, what is missing, and what the next safe command should be.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Summarizes current all-software operational evidence and next safe action with low token overhead"
    ),
    evidenceSummary:
      "The status console scans existing .transparent-apprentice evidence files or accepts explicit evidence paths for operational workbench, post-activation witness, registration status, run-output audit, teacher review packet, replay queue, unattended audit, coverage convergence, execution convergence, and original-goal readiness. It outputs evidence lanes, missing evidence, next safe commands, and blocked claims without changing the system.",
    proofSignals: [
      "transparent_ai_all_software_operational_status_console_v1",
      "transparent_ai_all_software_operational_status_console_receipt_v1",
      "ALL_SOFTWARE_OPERATIONAL_STATUS_CONSOLE_START_HERE.md",
      "all_software_status_waiting_for_registration_or_manual_runner_evidence",
      "all_software_status_ready_for_teacher_operational_review",
      "statusConsoleReadOnly: true",
      "goalComplete: false"
    ],
    notProven: [
      "The status console is a read-only dashboard; it does not register tasks, launch runners, create output, execute software, or write memory.",
      "It improves low-token progress visibility but is not proof that every installed app has useful logs or universal native semantic execution."
    ]
  },
  {
    id: "teacher_method_adaptation",
    userRequirement: "能适应任何人的学习方法。",
    status: statusFromEvidence(goalSmoke, verifier, "Adapts to different teacher methods"),
    evidenceSummary:
      "Teacher method profile routes examples, voice, overlay sketches, logs, corrections, and fewer-question preferences into existing tools.",
    proofSignals: ["transparent_ai_teacher_learning_method_profile_v1", "nextSuggestedTools", "evidencePreferences"],
    notProven: ["This is a reviewable adaptation profile, not a guarantee that every human teaching style is perfectly inferred."]
  },
  {
    id: "transparent_drawing_mask",
    userRequirement: "透明绘画蒙版功能，老师能在蒙版上绘制表达想法。",
    status: statusFromEvidence(goalSmoke, verifier, "Provides transparent drawing mask / overlay for teacher sketches"),
    evidenceSummary:
      "Browser overlay and Windows top-most overlay export transparent_ai_sketch_overlay_packet_v1 with anchors, strokes, backdrop, and normalized coordinates.",
    proofSignals: ["transparentDrawingMask: true", "transparent_ai_sketch_overlay_packet_v1"],
    notProven: []
  },
  {
    id: "perspective_position_depth_understanding",
    userRequirement: "通过透视关系或者位置关系理解老师意思，支持二维和三维平面内深度草图演示。",
    status: statusFromEvidence(goalSmoke, verifier, "Understands position, perspective, and 2D/3D depth demonstration before execution"),
    evidenceSummary:
      "Spatial interpreter handles screen_2d, perspective_grid, depth_axis_3d, relative anchors, moves_toward, perspective_to, and nearer_than before action planning.",
    proofSignals: ["transparent_ai_spatial_intent_interpretation_v1", "moves_toward", "nearer_than", "perspective_to"],
    notProven: ["The interpretation is still teacher-reviewed before execution and can be corrected."]
  },
  {
    id: "universal_detail_logic_before_similarity",
    userRequirement:
      "All important details, not only line examples, must be represented as data, formulas, constraints, depth/perspective relationships, position logic, tolerances, teacher exceptions, or explicit decorative classifications before generating similar output or executing software.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Logicizes every consequential detail before similar output or software action"
    ),
    evidenceSummary:
      "The parametric drawing logic kit and receipt validator convert teacher examples into universal detail rows, relationship rows, and transfer-validation rows. They block appearance-only copying, treat lines and angles as examples rather than the whole scope, require depth, position, pattern, tolerance, material/process, and teacher-exception logic sources, and only emit a review-only dry-run command after every consequential detail row is reviewed.",
    proofSignals: [
      "transparent_ai_parametric_drawing_logic_learning_kit_v1",
      "transparent_ai_universal_detail_logic_contract_v1",
      "transparent_ai_parametric_drawing_logic_teacher_receipt_v1",
      "transparent_ai_parametric_drawing_logic_receipt_validation_v1",
      "relationshipRows",
      "universalDetailLogicRows",
      "transferValidationRows",
      "blocked_until_teacher_reviews_every_consequential_detail_logic_row",
      "ready_for_review_only_dry_run_generation_plan",
      "surfaceSimilarityOnlyAccepted: false",
      "execute_or_generate_output_that_only_looks_similar_without_detail_logic"
    ],
    notProven: [
      "The validator proves a review gate and data-logic workflow, not that the apprentice has already mastered every future drawing domain.",
      "Teacher-filled receipts still need review before any generated output, memory write, rule enablement, or target-software action."
    ]
  },
  {
    id: "software_execution_from_teacher_intent",
    userRequirement: "理解后按照老师要求到软件中执行。",
    status: statusFromEvidence(goalSmoke, verifier, "Provides a teacher-confirmed supervised execution gate after action rehearsal"),
    evidenceSummary:
      "Confirmed targets can enter the goal command center, all-software control-channel coverage audit, execution pilot queue, execution capability matrix, execution capability matrix follow-up batch, execution capability follow-up reconciliation, execution capability supervisor, execution capability convergence audit, execution pilot runner, bounded execution pilot batch, real-local execution readiness dry-run batch, numbered real-local execution pilot selector, dry-run-first action plans, existing adapter selection, supervised execution gate, receipt verification, and post-action checkpoints. The goal command center now hands confirmed voice/text targets to the engineering voice execution approval gate before any execute runner request. Real-local smokes prove actual local inventory can reach numbered dry-run pilot receipts before execute mode; teacher-confirmed voice/text or all-software pilot targets can run controlled CLI routes only inside execution packages.",
    proofSignals: [
      "transparent_ai_all_software_control_channel_coverage_audit_v1",
      "transparent_ai_all_software_execution_pilot_queue_v1",
      "transparent_ai_all_software_execution_capability_matrix_v1",
      "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1",
      "transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_v1",
      "transparent_ai_all_software_execution_capability_supervisor_v1",
      "transparent_ai_all_software_execution_capability_convergence_audit_v1",
      "transparent_ai_all_software_execution_pilot_runner_v1",
      "transparent_ai_all_software_execution_pilot_batch_v1",
      "transparent_ai_real_local_all_software_execution_readiness_batch_v1",
      "transparent_ai_real_local_execution_pilot_selector_v1",
      "transparent_ai_engineering_voice_execution_approval_gate_v1",
      "transparent_ai_goal_command_center_v1",
      "transparent_ai_engineering_voice_control_workbench_v1",
      "transparent_ai_existing_software_execution_receipt_v1",
      "teacher_confirmed_cli_script_executed",
      "transparent_ai_supervised_action_outcome_verification_v1"
    ],
    notProven: [
      "Universal native semantic control inside every engineering program is not proven.",
      "Real UI events remain blocked unless target-window, spatial readiness, and teacher confirmation pass."
    ]
  },
  {
    id: "all_software_execution_capability_matrix",
    userRequirement: "Map local software from low-token observation and control-route evidence into next reviewed execution pilot lanes.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Maps all-software execution capability into next reviewed pilot lanes"
    ),
    evidenceSummary:
      "A real-local execution capability matrix now merges inventory, control-channel coverage, execution pilot queue, and readiness evidence into per-software stages and next review lanes so the teacher can advance one route at a time without claiming universal native control.",
    proofSignals: [
      "transparent_ai_all_software_execution_capability_matrix_v1",
      "transparent_ai_all_software_execution_capability_matrix_receipt_v1",
      "dry_run_pilot_package_ready",
      "control_route_reviewable_before_pilot",
      "observation_ready_control_evidence_missing",
      "review_and_run_one_dry_run_pilot",
      "collect_control_channel_evidence"
    ],
    notProven: [
      "The matrix is a routing and closure aid, not proof that every app has completed execution evidence.",
      "Rows still need teacher-reviewed dry-run or execute receipts before any completion claim."
    ]
  },
  {
    id: "all_software_execution_capability_matrix_follow_up_batch",
    userRequirement:
      "Advance matrix next lanes in bounded review-only batches so more local software can move toward proof without broad native-control claims.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Advances execution capability matrix lanes through bounded follow-up batches"
    ),
    evidenceSummary:
      "The follow-up batch consumes the execution capability matrix, prepares unreviewed runner calls without invoking them, invokes only dry-run pilot runners after teacher review, and routes other lanes to numbered confirmation, visual confirmation, read-only control-channel probes, or teacher questions.",
    proofSignals: [
      "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1",
      "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_receipt_v1",
      "dry_run_runner_call_prepared_waiting_for_teacher_review",
      "control_channel_probe_package_created_waiting_for_teacher_review",
      "waiting_for_numbered_target_or_exact_route_confirmation",
      "waiting_for_teacher_signal_or_exclusion"
    ],
    notProven: [
      "The follow-up batch advances only selected matrix rows.",
      "It does not prove every installed app has reviewed route evidence or teacher-approved exclusion."
    ]
  },
  {
    id: "all_software_execution_capability_matrix_follow_up_reconciliation",
    userRequirement:
      "Loop execution follow-up evidence back into the next reviewed all-software matrix pass without manual stitching.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Reconciles execution capability follow-up evidence into the next reviewed matrix pass"
    ),
    evidenceSummary:
      "The reconciliation consumes matrix follow-up batches, maps dry-run receipts, probe packages, route confirmations, visual confirmations, and teacher questions into explicit next lanes, and can regenerate only safe coverage, pilot queue, and matrix packages after teacher review.",
    proofSignals: [
      "transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_v1",
      "transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_receipt_v1",
      "review_dry_run_receipt_then_decide_execute_gate_or_more_evidence",
      "review_probe_result_then_rerun_control_channel_profile",
      "reconciled_next_execution_matrix_ready_for_review"
    ],
    notProven: [
      "The reconciliation prepares the next reviewed pass; it is not acceptance of all rows.",
      "Execution completion still requires reviewed receipts or teacher-approved exclusions per app."
    ]
  },
  {
    id: "all_software_execution_capability_supervisor",
    userRequirement:
      "Advance repeated execution capability matrix passes through a bounded supervisor instead of manual one-off stitching.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Supervises repeated execution capability matrix passes without broad native-control claims"
    ),
    evidenceSummary:
      "The execution capability supervisor reuses the existing follow-up batch and reconciliation tools across bounded rounds. Without teacher review it stops after preparing the first follow-up packet; with teacher review it can advance multiple safe matrix passes.",
    proofSignals: [
      "transparent_ai_all_software_execution_capability_supervisor_v1",
      "transparent_ai_all_software_execution_capability_supervisor_receipt_v1",
      "prepared_follow_up_waiting_for_teacher_review",
      "reviewed_rounds_completed_waiting_for_teacher_matrix_review"
    ],
    notProven: [
      "The supervisor advances bounded matrix rounds only; it is not all-software execution acceptance.",
      "Every in-scope app still needs reviewed route evidence, execution receipts, or teacher-approved exclusion before completion."
    ]
  },
  {
    id: "all_software_execution_capability_convergence_audit",
    userRequirement:
      "Audit whether execution capability matrix supervisors have converged before any all-software or native execution completion claim.",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Audits execution capability convergence before completion claims"
    ),
    evidenceSummary:
      "The execution capability convergence audit aggregates supervisor packets, selects the latest matrix, counts remaining lanes, and reports route, numbered-target, control-channel, dry-run receipt, or teacher-signal gaps before any completion decision.",
    proofSignals: [
      "transparent_ai_all_software_execution_capability_convergence_audit_v1",
      "transparent_ai_all_software_execution_capability_convergence_audit_receipt_v1",
      "execution_capability_still_has_remaining_lanes_or_review_gaps",
      "bounded_execution_capability_ready_for_teacher_completion_review"
    ],
    notProven: [
      "A convergence audit is not acceptance of full all-software execution.",
      "Even a bounded ready-for-review result still requires teacher review and does not prove universal native semantic control."
    ]
  },
  {
    id: "voice_text_engineering_control",
    userRequirement: "语音或文字操控工程软件，先标编号让用户确认再执行。",
    status: statusFromEvidence(
      goalSmoke,
      verifier,
      "Lets non-experts control engineering software by voice or text through numbered target confirmation"
    ),
    evidenceSummary:
      "Voice/text command sessions, the user-facing workbench, visual evidence target confirmation, and the goal command center create numbered target confirmations, require one selected number, profile control channels, route to dry-run-first adapters, pass through an engineering voice execution approval gate with reviewed evidence plus rollback, and can produce a teacher-confirmed controlled execution receipt for a reviewed local CLI/script route.",
    proofSignals: [
      "transparent_ai_engineering_voice_control_session_v1",
      "transparent_ai_engineering_voice_control_workbench_v1",
      "transparent_ai_visual_engineering_target_confirmation_v1",
      "transparent_ai_engineering_voice_execution_approval_gate_v1",
      "transparent_ai_goal_command_center_v1",
      "transparent_ai_numbered_target_confirmation_v1",
      "transparent_ai_real_local_engineering_voice_controlled_execution_smoke_v1",
      "teacher_confirmed_cli_script_executed"
    ],
    notProven: ["It is a supervised control workflow, not direct autonomous engineering software operation."]
  }
].map((item) => ({
  ...item,
  sourceSignalMatched: item.proofSignals.some((signal) => Object.values(sourceEvidence).some((text) => text.includes(signal)))
}));

const allVerified = requirements.every((item) => item.status.startsWith("implemented") && item.sourceSignalMatched);
const hardBoundaries = requirements.flatMap((item) => item.notProven);
const audit = {
  ok: true,
  format: "transparent_ai_original_goal_readiness_audit_v1",
  status: allVerified ? "review_only_feasibility_verified_with_boundaries" : "missing_or_unverified_goal_evidence",
  completionDecision: hardBoundaries.length
    ? "not_complete_full_objective_because_universal_native_control_and_unattended_all_app_coverage_are_not_proven"
    : "eligible_for_teacher_completion_review",
  goal: goalText,
  createdAt: new Date().toISOString(),
  auditDir,
  summary:
    "The current plugin verifies the requested goal as a bounded, teacher-reviewed feasibility loop. It does not honestly prove unattended monitoring for every installed app or autonomous native semantic control inside every engineering program.",
  commandResults: {
    goalCoverage: {
      status: goalSmoke.status,
      passed: goalSmoke.passed ?? null,
      total: goalSmoke.total ?? null,
      smoke: goalSmoke.smoke ?? ""
    },
    verifier: {
      status: verifier.status,
      passed: verifier.passed ?? null,
      total: verifier.total ?? null
    }
  },
  requirements,
  verificationCommands: [
    "npm.cmd run smoke:plugin-goal-coverage",
    "npm.cmd run smoke:plugin-goal-command-center",
    "npm.cmd run smoke:plugin-goal-command-center-trial",
    "npm.cmd run smoke:plugin-real-local-full-goal-integrated-cycle",
    "npm.cmd run smoke:plugin-real-local-all-software-learning-cycle",
    "npm.cmd run smoke:plugin-real-local-all-software-low-token-readiness-package",
    "npm.cmd run smoke:plugin-all-software-recurring-monitor-approval-gate",
    "npm.cmd run smoke:plugin-real-local-all-software-recurring-monitor-approval-gate",
    "npm.cmd run smoke:plugin-real-local-all-software-recurring-monitor-registration-runner",
    "npm.cmd run smoke:plugin-real-local-all-software-recurring-monitor-registration-status",
    "npm.cmd run smoke:plugin-real-local-all-software-recurring-monitor-run-output-audit",
    "npm.cmd run smoke:plugin-real-local-all-software-recurring-monitor-teacher-review-packet",
    "npm.cmd run smoke:plugin-all-software-recurring-monitor-review-decision-replay-queue",
    "npm.cmd run smoke:plugin-real-local-all-software-unattended-learning-audit",
    "npm.cmd run smoke:plugin-all-software-operational-learning-workbench",
    "npm.cmd run smoke:plugin-real-local-all-software-operational-learning-trial",
    "npm.cmd run smoke:plugin-all-software-operational-learning-activation-gate",
    "npm.cmd run smoke:plugin-all-software-operational-learning-activation-dry-run-rehearsal",
    "npm.cmd run smoke:plugin-all-software-operational-learning-registration-execute-gate",
    "npm.cmd run smoke:plugin-all-software-operational-learning-registration-approved-runner",
    "npm.cmd run smoke:plugin-all-software-operational-learning-post-registration-output-witness-runner",
    "npm.cmd run smoke:plugin-all-software-coverage-enrollment-ledger",
    "npm.cmd run smoke:plugin-all-software-coverage-enrollment-follow-up-plan",
    "npm.cmd run smoke:plugin-all-software-coverage-enrollment-follow-up-batch",
    "npm.cmd run smoke:plugin-all-software-coverage-enrollment-follow-up-reconciliation",
    "npm.cmd run smoke:plugin-real-local-all-software-coverage-convergence-audit",
    "npm.cmd run smoke:plugin-real-local-convergence-automatic-learning-package",
    "npm.cmd run smoke:plugin-real-local-all-software-control-channel-coverage-audit",
    "npm.cmd run smoke:plugin-real-local-all-software-execution-pilot-queue",
    "npm.cmd run smoke:plugin-real-local-all-software-execution-capability-matrix",
    "npm.cmd run smoke:plugin-real-local-all-software-execution-pilot-runner",
    "npm.cmd run smoke:plugin-real-local-all-software-execution-pilot-batch",
    "npm.cmd run smoke:plugin-real-local-all-software-execution-readiness-batch",
    "npm.cmd run smoke:plugin-real-local-execution-pilot-selector",
    "npm.cmd run smoke:plugin-visual-engineering-target-confirmation",
    "npm.cmd run smoke:plugin-engineering-voice-control-session",
    "npm.cmd run smoke:plugin-engineering-voice-execution-approval-gate",
    "npm.cmd run smoke:plugin-real-local-engineering-voice-controlled-execution",
    "npm.cmd run smoke:plugin-parametric-drawing-logic-learning-kit",
    "npm.cmd run smoke:plugin-parametric-drawing-logic-receipt-validation",
    "npm.cmd run smoke:plugin-triggered-visual-learning-handoff",
    "npm.cmd run verify:plugin"
  ],
  nextBestWork: [
    "Use create_all_software_operational_status_console at the start of each continuation so the teacher and next agent can see current operational learning, review, coverage, execution, missing-evidence, and next-safe-command lanes without rescanning full logs or screenshots.",
    "Use run_goal_command_center_trial after the teacher reviews the command center so one bounded read-only local low-token trial can run before screenshots, execution, or memory.",
    "Use create_all_software_coverage_enrollment_follow_up_plan after each enrollment ledger so waiting rows become reviewed next actions with watch_log_source_metadata_deltas, run_software_observer_queue_item, create_software_observer_queue, or teacher signal/exclusion requests.",
    "Use run_all_software_coverage_enrollment_follow_up_batch after teacher review to advance a few follow-up rows through metadata-only gates or queue promotion, then rerun coverage audit and enrollment ledger with the new evidence.",
    "Use reconcile_all_software_coverage_enrollment_follow_up_batch after each reviewed follow-up batch so batch evidence is automatically converted into the next coverage audit and enrollment ledger commands or a teacher-reviewed rerun.",
    "Use create_all_software_execution_capability_matrix after inventory, control-channel coverage, or pilot-queue evidence so each real local software row has a visible next lane before widening execute pilots.",
    "Use the real-local execution pilot selector to show numbered real software candidates, then let the teacher choose one candidate before running a single dry-run or explicitly confirmed route.",
    "For voice/text engineering control, run create_engineering_voice_execution_approval_gate after one number is confirmed and before copying any execute runner request.",
    "Use create_all_software_operational_learning_workbench after readiness, schedule, approval, registration, status, output, review, replay, or unattended-audit evidence exists so the teacher has one start-here guide for the next safe command order.",
    "Use run_all_software_operational_learning_trial when the teacher wants proof that the real local low-token learning chain can run once without registering background automation; review its runner journal, run-output audit, unattended audit, and workbench before any schedule registration or memory claim.",
    "Use create_all_software_operational_learning_activation_gate after reviewing an operational trial so the trial evidence is converted into approval, dry-run registration, read-only status, and updated workbench evidence before any teacher-approved system change.",
    "Use run_all_software_operational_learning_activation_dry_run_rehearsal after the activation gate so the generated registration wrapper is actually invoked in dry-run mode and the scheduled-task state is rechecked read-only before any registration attempt.",
    "Use create_all_software_operational_learning_registration_execute_gate after a passed dry-run rehearsal so the real register and rollback commands are prepared for teacher review without executing them; actual registration remains a separate explicit system-change step.",
    "Use run_all_software_operational_learning_registration_approved_runner only after the registration execute gate is ready and the teacher gives final system-change approval; it should invoke the existing registration runner once, then trust only the read-only scheduled-task status verifier before any operational claim.",
    "Use run_all_software_operational_learning_post_registration_output_witness_runner only after read-only registration status is registered_and_matches_reviewed_runner; it should trigger the reviewed scheduled runner once, then immediately route output into run-output audit, teacher review, decision replay, and unattended audit without screenshots, memory, rule enablement, packaging, or completion claims.",
    "Use create_all_software_recurring_monitor_approval_gate before turning a reviewed schedule package into any recurring monitor registration request, then use run_all_software_recurring_monitor_registration_runner in dry-run mode before any teacher-approved system change; after a teacher-approved registration attempt, use verify_all_software_recurring_monitor_registration_status to confirm absent/matched/mismatched task state without changing the system, use audit_all_software_recurring_monitor_run_output to turn existing automatic runner journals into teacher-review learning events, use create_all_software_recurring_monitor_teacher_review_packet to choose direct compact review versus one triggered visual-check request, use create_all_software_recurring_monitor_review_decision_replay_queue to replay teacher decisions into the next review-only follow-up queue without accepting rules or writing memory, run create_all_software_unattended_learning_audit, and then rerun create_all_software_operational_learning_workbench before claiming unattended all-software learning is operational.",
    "Collect teacher corrections on numbered target selection to improve spatial interpretation before widening execution.",
    "Before generating any similar drawing or executing a sketch-derived command, run validate_parametric_drawing_logic_receipt so line, angle, position, perspective, depth, pattern, tolerance, material/process, and teacher-exception rows are logic-reviewed instead of accepted by appearance.",
    "Keep rollback points until the teacher confirms the direction is correct."
  ],
  reviewLocks: {
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    privateChainOfThoughtExposed: false
  }
};

const auditPath = join(auditDir, "original-goal-readiness-audit.json");
const readmePath = join(auditDir, "ORIGINAL_GOAL_READINESS_AUDIT_START_HERE.md");
writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
writeReadme(readmePath, audit);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_readiness_audit_result_v1",
      status: audit.status,
      completionDecision: audit.completionDecision,
      auditPath,
      readmePath,
      requirementCount: requirements.length,
      verifiedRequirementCount: requirements.filter((item) => item.status.startsWith("implemented")).length,
      hardBoundaryCount: hardBoundaries.length,
      commandResults: audit.commandResults,
      reviewLocks: audit.reviewLocks
    },
    null,
    2
  )
);
