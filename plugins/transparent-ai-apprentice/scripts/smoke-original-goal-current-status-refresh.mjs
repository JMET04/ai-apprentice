#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "original-goal-current-status-refresh-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });
const serverScript = join(pluginRoot, "scripts", "mcp-server.mjs");

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 240000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function fileIsAscii(path) {
  return readFileSync(path).every((byte) => byte < 128);
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let nextId = 1;
  const pending = new Map();
  let stdoutBuffer = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });

  function rpc(method, params = {}) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function stop() {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }

  return { rpc, stop, stderr: () => stderr };
}

async function callMcpTool(name, args, extraEnv = {}) {
  const server = startServer(extraEnv);
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", { name, arguments: args });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const refreshScanRoot = join(smokeRoot, "scan-root-with-execution-follow-up");
const recurringMonitorFixtureDir = join(refreshScanRoot, "recurring-monitor-teacher-confirmation-fixtures", "fixture");
mkdirSync(recurringMonitorFixtureDir, { recursive: true });
const automaticLowTokenLearningScheduleFixturePath = join(
  recurringMonitorFixtureDir,
  "automatic-low-token-learning-schedule.json"
);
const recurringMonitorApprovalGateFixturePath = join(
  recurringMonitorFixtureDir,
  "all-software-recurring-monitor-approval-gate.json"
);
const automaticLowTokenLearningScheduleReadmeFixturePath = join(
  recurringMonitorFixtureDir,
  "AUTOMATIC_LOW_TOKEN_LEARNING_SCHEDULE_START_HERE.md"
);
const recurringMonitorApprovalGateReadmeFixturePath = join(
  recurringMonitorFixtureDir,
  "ALL_SOFTWARE_RECURRING_MONITOR_APPROVAL_GATE_START_HERE.md"
);
writeFileSync(automaticLowTokenLearningScheduleReadmeFixturePath, "# Fixture automatic low-token learning schedule\n", "utf8");
writeFileSync(recurringMonitorApprovalGateReadmeFixturePath, "# Fixture recurring monitor approval gate\n", "utf8");
writeFileSync(
  automaticLowTokenLearningScheduleFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_automatic_low_token_learning_schedule_v1",
      scheduleId: "current-status-recurring-monitor-schedule-fixture",
      taskName: "TransparentAI-LowTokenLearning-Fixture",
      inputKind: "queue",
      queuePath: "<reviewed-queue.json>",
      inventoryPath: "<reviewed-inventory.json>",
      runnerPath: "<run-scheduled-low-token-learning.ps1>",
      registerPath: "<register-low-token-learning-task.ps1>",
      runOutputDir: "<scheduled-learning-runs>",
      stateDir: "<persistent-learning-state>",
      schedulePolicy: {
        scheduler: "windows_scheduled_task",
        intervalMinutes: 15,
        runsPerLaunch: 1,
        metadataGateFirst: true,
        skipTailWhenMetadataUnchanged: true,
        scheduledTaskInstalled: false
      },
      paths: {
        readme: automaticLowTokenLearningScheduleReadmeFixturePath
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        scheduledTaskInstalled: false,
        fullContinuousRecording: false,
        screenshotsCaptured: false,
        rawFullLogsRetained: false,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        longTermMemoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  recurringMonitorApprovalGateFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_recurring_monitor_approval_gate_v1",
      gateId: "current-status-recurring-monitor-approval-gate-fixture",
      status: "blocked_before_recurring_monitor_registration_request",
      readyForRegistrationRequest: false,
      sourceSchedulePath: automaticLowTokenLearningScheduleFixturePath,
      schedule: {
        scheduleId: "current-status-recurring-monitor-schedule-fixture",
        taskName: "TransparentAI-LowTokenLearning-Fixture",
        metadataGateFirst: true,
        scheduledTaskInstalled: false
      },
      teacherConfirmationMatched: false,
      scopeConfirmationMatched: false,
      rollbackPointCreated: true,
      blockers: [
        "missing_explicit_teacher_recurring_monitor_confirmation",
        "missing_reviewed_monitor_scope_confirmation"
      ],
      paths: {
        readme: recurringMonitorApprovalGateReadmeFixturePath
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        technologyAccepted: false,
        packagingGated: true,
        scheduledTaskInstalled: false,
        approvalGateDoesNotRegisterTask: true,
        fullContinuousRecording: false,
        screenshotsCaptured: false,
        rawFullLogsRetained: false,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        longTermMemoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const recurringMonitorReceiptValidationFixtureDir = join(
  refreshScanRoot,
  "recurring-monitor-teacher-confirmation-receipt-validation",
  "fixture"
);
mkdirSync(recurringMonitorReceiptValidationFixtureDir, { recursive: true });
const recurringMonitorReceiptValidationFixturePath = join(
  recurringMonitorReceiptValidationFixtureDir,
  "recurring-monitor-teacher-confirmation-receipt-validation.json"
);
const recurringMonitorReceiptValidationReadmeFixturePath = join(
  recurringMonitorReceiptValidationFixtureDir,
  "RECURRING_MONITOR_TEACHER_CONFIRMATION_RECEIPT_VALIDATION_START_HERE.md"
);
writeFileSync(
  recurringMonitorReceiptValidationReadmeFixturePath,
  "# Fixture recurring monitor teacher confirmation receipt validation\n",
  "utf8"
);
writeFileSync(
  recurringMonitorReceiptValidationFixturePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_recurring_monitor_teacher_confirmation_receipt_validation_v1",
      status: "receipt_validation_waiting_for_teacher_confirmation",
      validationDecision: "needs_teacher_review",
      readyToRerunApprovalGate: false,
      missingConfirmationCount: 3,
      missingConfirmationRows: [
        "recurring_monitor_confirmation",
        "monitored_scope_confirmation",
        "schedule_safety_confirmation"
      ],
      locks: {
        reviewOnly: true,
        validationDoesNotRegisterTask: true,
        validationDoesNotLaunchRunner: true,
        scheduledTaskRegistered: false,
        runnerLaunched: false,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        screenshotsCaptured: false,
        longTermMemoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const executionBatchDir = join(refreshScanRoot, "current-original-goal-execution-follow-up-batches", "fixture");
mkdirSync(executionBatchDir, { recursive: true });
const executionFollowUpBatchPath = join(executionBatchDir, "all-software-execution-capability-matrix-follow-up-batch.json");
writeFileSync(
  executionFollowUpBatchPath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1",
      batchId: "smoke-current-status-refresh-execution-follow-up",
      createdAt: new Date().toISOString(),
      goal: "Smoke execution follow-up receipt builder discovery.",
      status: "prepared_follow_up_waiting_for_teacher_review",
      matrixPath: "",
      pilotQueuePath: "",
      counts: {
        totalRows: 1,
        preparedRunnerCalls: 1,
        dryRunRunnerInvocations: 0
      },
      rowResults: [
        {
          rowId: "software-1",
          software: "ExampleCAD",
          lane: "review_and_run_one_dry_run_pilot",
          status: "blocked_before_adapter_runner_control_channel_probe_package_created_waiting_for_teacher_review",
          runnerInvoked: false,
          probeResult: {
            probePlan: join(executionBatchDir, "examplecad-control-channel-probe-plan.json"),
            resultTemplate: join(executionBatchDir, "examplecad-control-channel-probe-result-template.json"),
            teacherReadme: join(executionBatchDir, "EXAMPLECAD_CONTROL_CHANNEL_PROBE_REVIEW.md"),
            nextProfileRequest: join(executionBatchDir, "examplecad-control-channel-profile-request.json")
          },
          nextCall: {
            tool: "run_all_software_execution_pilot_runner",
            arguments: {
              pilotId: "software-1",
              execute: false
            },
            blockedUntil: "teacher reviews this row in the execution follow-up receipt builder"
          }
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const runnerFixtureDir = join(refreshScanRoot, "automatic-low-token-learning-runs", "fixture");
mkdirSync(runnerFixtureDir, { recursive: true });
const runnerFixturePath = join(runnerFixtureDir, "automatic-low-token-learning-runner.json");
writeFileSync(
  runnerFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_automatic_low_token_learning_runner_v1",
      runnerId: "current-status-preflight-runner-fixture",
      status: "learning_events_waiting_for_teacher_review",
      totals: {
        metadataGateRuns: 1,
        changedItems: 1,
        compactLearningEvents: 1,
        screenshotRequests: 0
      },
      locks: {
        accepted: false,
        ruleEnabled: false,
        screenshotsCaptured: false,
        softwareActionsExecuted: false,
        longTermMemoryWritten: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const learningCycleFixtureDir = join(refreshScanRoot, "all-software-low-token-learning-cycles", "fixture");
mkdirSync(learningCycleFixtureDir, { recursive: true });
const learningCycleFixturePath = join(learningCycleFixtureDir, "all-software-low-token-learning-cycle.json");
writeFileSync(
  learningCycleFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_low_token_learning_cycle_v1",
      cycleId: "current-status-preflight-learning-cycle-fixture",
      status: "learning_events_waiting_for_teacher_review",
      counts: {
        compactLearningEvents: 1,
        screenshotRequests: 0
      },
      metadataGateRuns: [
        {
          software: "ExampleCAD",
          changedLogMetadata: 1,
          scannedLogMetadata: 3,
          gatePath: join(learningCycleFixtureDir, "metadata-gate.json")
        }
      ],
      watchRuns: [
        {
          watchCyclePath: join(learningCycleFixtureDir, "watch-cycle.json"),
          changedItems: [
            {
              software: "ExampleCAD",
              classifications: ["state_delta"],
              screenshotRecommended: false
            }
          ]
        }
      ],
      learningRuns: [
        {
          software: "ExampleCAD",
          compactEventCount: 1,
          classifications: ["state_delta"],
          compactLearningEventsPath: join(learningCycleFixtureDir, "compact-learning-events.json")
        }
      ],
      locks: {
        accepted: false,
        ruleEnabled: false,
        screenshotsCaptured: false,
        softwareActionsExecuted: false,
        longTermMemoryWritten: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const visualQueueFixtureDir = join(refreshScanRoot, "automatic-triggered-visual-check-queues", "fixture");
mkdirSync(visualQueueFixtureDir, { recursive: true });
const visualQueueFixturePath = join(visualQueueFixtureDir, "automatic-triggered-visual-check-queue.json");
writeFileSync(
  visualQueueFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_automatic_triggered_visual_check_queue_v1",
      queueId: "current-status-preflight-visual-queue-fixture",
      status: "waiting_for_teacher_visual_check_review",
      requestCount: 1,
      requests: [
        {
          id: "automatic-visual-check-1",
          software: "ExampleCAD",
          triggerReason: "error",
          captureOnlyAfterReview: true,
          maxScreenshots: 1
        }
      ],
      locks: {
        accepted: false,
        ruleEnabled: false,
        screenshotsCaptured: false,
        softwareActionsExecuted: false,
        longTermMemoryWritten: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const coverageConvergenceFixtureDir = join(refreshScanRoot, "all-software-coverage-convergence-audits", "fixture");
mkdirSync(coverageConvergenceFixtureDir, { recursive: true });
const coverageExpansionPlanFixturePath = join(coverageConvergenceFixtureDir, "all-software-coverage-expansion-plan.json");
const coverageConvergenceFixturePath = join(coverageConvergenceFixtureDir, "all-software-coverage-convergence-audit.json");
const logSourceDiscoveryLedgerFixtureDir = join(refreshScanRoot, "all-software-log-source-discovery-ledgers", "fixture");
mkdirSync(logSourceDiscoveryLedgerFixtureDir, { recursive: true });
const logSourceDiscoveryLedgerReadmeFixturePath = join(
  logSourceDiscoveryLedgerFixtureDir,
  "ALL_SOFTWARE_LOG_SOURCE_DISCOVERY_LEDGER_START_HERE.md"
);
const logSourceDiscoveryLedgerFixturePath = join(
  logSourceDiscoveryLedgerFixtureDir,
  "all-software-log-source-discovery-ledger.json"
);
const lowTokenCoverageDossierReceiptValidationFixtureDir = join(
  refreshScanRoot,
  "original-goal-low-token-coverage-dossier-receipt-validations",
  "fixture"
);
const lowTokenCoverageCompletionGateFixtureDir = join(
  refreshScanRoot,
  "original-goal-low-token-coverage-completion-gates",
  "fixture"
);
mkdirSync(lowTokenCoverageDossierReceiptValidationFixtureDir, { recursive: true });
mkdirSync(lowTokenCoverageCompletionGateFixtureDir, { recursive: true });
const lowTokenCoverageDossierReceiptValidationFixturePath = join(
  lowTokenCoverageDossierReceiptValidationFixtureDir,
  "original-goal-low-token-coverage-dossier-receipt-validation.json"
);
const lowTokenCoverageDossierReceiptValidationReadmeFixturePath = join(
  lowTokenCoverageDossierReceiptValidationFixtureDir,
  "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_DOSSIER_RECEIPT_VALIDATION_START_HERE.md"
);
const lowTokenCoverageCompletionGateFixturePath = join(
  lowTokenCoverageCompletionGateFixtureDir,
  "original-goal-low-token-coverage-completion-gate.json"
);
const lowTokenCoverageCompletionGateReadmeFixturePath = join(
  lowTokenCoverageCompletionGateFixtureDir,
  "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_COMPLETION_GATE_START_HERE.md"
);
const coverageReceiptBuilderFixtureDir = join(refreshScanRoot, "all-software-coverage-rollout-receipt-builders", "fixture");
mkdirSync(coverageReceiptBuilderFixtureDir, { recursive: true });
const coverageReceiptBuilderHtmlFixturePath = join(coverageReceiptBuilderFixtureDir, "all-software-coverage-rollout-receipt-builder.html");
const coverageReceiptBuilderFixturePath = join(coverageReceiptBuilderFixtureDir, "all-software-coverage-rollout-receipt-builder.json");
const coverageEnrollmentReceiptBuilderFixtureDir = join(
  refreshScanRoot,
  "all-software-coverage-enrollment-follow-up-receipt-builders",
  "fixture"
);
const coverageEnrollmentLedgerFixtureDir = join(
  refreshScanRoot,
  "all-software-coverage-enrollment-ledgers",
  "fixture"
);
const coverageEnrollmentFollowUpPlanFixtureDir = join(
  refreshScanRoot,
  "all-software-coverage-enrollment-follow-up-plans",
  "fixture"
);
const coverageEnrollmentFollowUpBatchFixtureDir = join(
  refreshScanRoot,
  "all-software-coverage-enrollment-follow-up-batches",
  "fixture"
);
const coverageEnrollmentFollowUpReconciliationFixtureDir = join(
  refreshScanRoot,
  "all-software-coverage-enrollment-follow-up-reconciliations",
  "fixture"
);
mkdirSync(coverageEnrollmentReceiptBuilderFixtureDir, { recursive: true });
mkdirSync(coverageEnrollmentLedgerFixtureDir, { recursive: true });
mkdirSync(coverageEnrollmentFollowUpPlanFixtureDir, { recursive: true });
mkdirSync(coverageEnrollmentFollowUpBatchFixtureDir, { recursive: true });
mkdirSync(coverageEnrollmentFollowUpReconciliationFixtureDir, { recursive: true });
const coverageEnrollmentLedgerReadmeFixturePath = join(
  coverageEnrollmentLedgerFixtureDir,
  "ALL_SOFTWARE_COVERAGE_ENROLLMENT_LEDGER_START_HERE.md"
);
const coverageEnrollmentLedgerFixturePath = join(
  coverageEnrollmentLedgerFixtureDir,
  "all-software-coverage-enrollment-ledger.json"
);
const coverageEnrollmentFollowUpPlanReadmeFixturePath = join(
  coverageEnrollmentFollowUpPlanFixtureDir,
  "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_START_HERE.md"
);
const coverageEnrollmentFollowUpPlanFixturePath = join(
  coverageEnrollmentFollowUpPlanFixtureDir,
  "all-software-coverage-enrollment-follow-up-plan.json"
);
const staleCoverageEnrollmentFollowUpPlanFixtureDir = join(
  refreshScanRoot,
  "all-software-coverage-enrollment-follow-up-plans",
  "stale-receipt-source"
);
mkdirSync(staleCoverageEnrollmentFollowUpPlanFixtureDir, { recursive: true });
const staleCoverageEnrollmentFollowUpPlanFixturePath = join(
  staleCoverageEnrollmentFollowUpPlanFixtureDir,
  "all-software-coverage-enrollment-follow-up-plan.json"
);
const coverageEnrollmentFollowUpBatchReadmeFixturePath = join(
  coverageEnrollmentFollowUpBatchFixtureDir,
  "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_BATCH_START_HERE.md"
);
const coverageEnrollmentFollowUpBatchFixturePath = join(
  coverageEnrollmentFollowUpBatchFixtureDir,
  "all-software-coverage-enrollment-follow-up-batch-run.json"
);
const coverageEnrollmentFollowUpReconciliationReadmeFixturePath = join(
  coverageEnrollmentFollowUpReconciliationFixtureDir,
  "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_RECONCILIATION_START_HERE.md"
);
const coverageEnrollmentFollowUpReconciliationFixturePath = join(
  coverageEnrollmentFollowUpReconciliationFixtureDir,
  "all-software-coverage-enrollment-follow-up-reconciliation.json"
);
const coverageEnrollmentReceiptBuilderHtmlFixturePath = join(
  coverageEnrollmentReceiptBuilderFixtureDir,
  "all-software-coverage-enrollment-follow-up-receipt-builder.html"
);
const coverageEnrollmentReceiptTemplateFixturePath = join(
  coverageEnrollmentReceiptBuilderFixtureDir,
  "teacher-coverage-enrollment-follow-up-receipt-template.json"
);
const coverageEnrollmentReceiptBuilderFixturePath = join(
  coverageEnrollmentReceiptBuilderFixtureDir,
  "all-software-coverage-enrollment-follow-up-receipt-builder.json"
);
writeFileSync(
  coverageExpansionPlanFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_expansion_plan_v1",
      planId: "current-status-coverage-plan-fixture",
      batches: [
        {
          batchId: "coverage-batch-1",
          rows: [
            { software: "ExampleCAD", processName: "examplecad.exe" },
            { software: "ExampleBrowser", processName: "examplebrowser.exe" }
          ]
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  coverageConvergenceFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_convergence_audit_v1",
      auditId: "current-status-coverage-convergence-fixture",
      status: "coverage_rollout_still_has_remaining_batches_or_audit_gaps",
      sourceExpansionPlanPath: coverageExpansionPlanFixturePath,
      remainingBatches: [
        {
          batchId: "coverage-batch-1",
          plannedRows: 2,
          status: "prepared_waiting_for_teacher_review",
          nextAction: "teacher_review_required_before_runner"
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        scheduledTaskRegistered: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(logSourceDiscoveryLedgerReadmeFixturePath, "# Fixture log source discovery ledger\n", "utf8");
writeFileSync(
  logSourceDiscoveryLedgerFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_log_source_discovery_ledger_v1",
      ledgerId: "current-status-log-source-discovery-fixture",
      status: "needs_teacher_log_source_review",
      counts: {
        totalInventoryRows: 3,
        ledgerRows: 3,
        directLogCandidatesReadyForMetadataGate: 1,
        nonLogLowTokenFallbackReadyForReview: 1,
        windowsEventLogFallbackReadyForReview: 0,
        candidateRootsNeedBoundedScan: 0,
        needsTeacherLogSourceOrExclusion: 1,
        teacherExcludedOrPrivate: 0
      },
      rows: [
        { ledgerNumber: 1, software: "ExampleCAD", discoveryStatus: "direct_log_candidates_ready_for_metadata_gate" },
        { ledgerNumber: 2, software: "ExampleBrowser", discoveryStatus: "non_log_low_token_fallback_ready_for_review" },
        { ledgerNumber: 3, software: "MissingSourceApp", discoveryStatus: "needs_teacher_log_source_or_exclusion" }
      ],
      allRowsHaveSourceRoute: false,
      allSoftwareLogSourceDiscoveryComplete: false,
      nextReviewQueue: [
        { ledgerNumber: 3, software: "MissingSourceApp", discoveryStatus: "needs_teacher_log_source_or_exclusion" }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        logContentsRead: false,
        screenshotsCaptured: false,
        softwareActionsExecuted: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  lowTokenCoverageDossierReceiptValidationReadmeFixturePath,
  "# Fixture low-token coverage dossier receipt validation\n",
  "utf8"
);
writeFileSync(
  lowTokenCoverageCompletionGateReadmeFixturePath,
  "# Fixture low-token coverage completion gate\n",
  "utf8"
);
writeFileSync(
  lowTokenCoverageDossierReceiptValidationFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_original_goal_low_token_coverage_dossier_receipt_validation_v1",
      validationId: "current-status-low-token-coverage-dossier-validation-fixture",
      status: "waiting_for_teacher_low_token_coverage_review",
      validationDecision: "needs_teacher_review",
      readyFollowUpRowCount: 0,
      reviewedReadyRowCount: 0,
      excludedRowCount: 0,
      waitingRowCount: 3,
      forbiddenDecisionUsed: false,
      validationRows: [
        { ledgerNumber: 1, software: "ExampleCAD", status: "needs_teacher_review_or_evidence" },
        { ledgerNumber: 2, software: "ExampleBrowser", status: "needs_teacher_review_or_evidence" },
        { ledgerNumber: 3, software: "MissingSourceApp", status: "needs_teacher_review_or_evidence" }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        validationDoesNotRunFollowUpPlan: true,
        validationDoesNotReadLogs: true,
        validationDoesNotCaptureScreenshots: true,
        validationDoesNotExecuteTargetSoftware: true,
        validationDoesNotRegisterSchedule: true,
        validationDoesNotWriteMemory: true,
        allSoftwareCoverageComplete: false,
        softwareActionsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  lowTokenCoverageCompletionGateFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_original_goal_low_token_coverage_completion_gate_v1",
      gateId: "current-status-low-token-coverage-completion-gate-fixture",
      status: "blocked_before_all_software_low_token_coverage_completion_claim",
      coverageEvidenceReadyForFinalTeacherReview: false,
      logSourceDiscoveryReadyForCoverage: false,
      allSoftwareCoverageComplete: false,
      canClaimOriginalGoalComplete: false,
      counts: {
        logSourceDiscoveryRows: 3,
        logSourceDiscoveryMissingRows: 1,
        ledgerRows: 3,
        unresolvedCoverageRows: 3,
        teacherReviewedCoverageRows: 0,
        readyFollowUpRowCount: 0,
        waitingValidationRowCount: 3
      },
      blockers: [
        "unresolved_log_source_discovery_rows_remain",
        "teacher_dossier_validation_has_waiting_rows",
        "not_every_ledger_row_has_teacher_reviewed_coverage_or_exclusion"
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        gateDoesNotRunFollowUpPlan: true,
        gateDoesNotReadLogs: true,
        gateDoesNotCaptureScreenshots: true,
        gateDoesNotExecuteTargetSoftware: true,
        gateDoesNotRegisterSchedule: true,
        gateDoesNotWriteMemory: true,
        allSoftwareCoverageComplete: false,
        softwareActionsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(coverageReceiptBuilderHtmlFixturePath, "<!doctype html><title>Fixture coverage receipt builder</title>\n", "utf8");
writeFileSync(
  coverageReceiptBuilderFixturePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_rollout_receipt_builder_v1",
      builderId: "current-status-coverage-receipt-builder-fixture",
      status: "coverage_rollout_receipt_builder_ready_for_teacher_use",
      sourcePlanStatus: "coverage_rollout_still_has_remaining_batches_or_audit_gaps",
      counts: {
        batches: 1,
        totalSoftware: 2
      },
      paths: {
        builder: coverageReceiptBuilderFixturePath,
        html: coverageReceiptBuilderHtmlFixturePath,
        sourceExpansionPlan: coverageExpansionPlanFixturePath,
        sourceConvergenceAudit: coverageConvergenceFixturePath
      },
      reviewRows: [
        {
          batchId: "coverage-batch-1",
          status: "prepared_waiting_for_teacher_review",
          batchSize: 2,
          defaultDecision: "needs_teacher_review"
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(coverageEnrollmentLedgerReadmeFixturePath, "# Fixture enrollment ledger\n", "utf8");
writeFileSync(
  coverageEnrollmentLedgerFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_ledger_v1",
      ledgerId: "current-status-enrollment-ledger-fixture",
      counts: {
        rows: 3,
        nextReviewQueue: 2
      },
      rows: [
        { ledgerNumber: 1, software: "ExampleCAD", status: "waiting_for_watch_evidence" },
        { ledgerNumber: 2, software: "ExampleBrowser", status: "inventory_signal_waiting_for_queue_enrollment" },
        { ledgerNumber: 3, software: "PrivateTool", status: "teacher_excluded_or_private", teacherExcluded: true }
      ],
      nextReviewQueue: [
        { ledgerNumber: 1, software: "ExampleCAD" },
        { ledgerNumber: 2, software: "ExampleBrowser" }
      ],
      sourceEvidence: {
        inventoryPath: "fixture-inventory.json",
        queuePath: "fixture-queue.json",
        coverageAuditPath: "fixture-coverage-audit.json"
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(coverageEnrollmentFollowUpPlanReadmeFixturePath, "# Fixture enrollment follow-up plan\n", "utf8");
writeFileSync(
  staleCoverageEnrollmentFollowUpPlanFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
      planId: "stale-current-status-enrollment-follow-up-plan-fixture",
      sourceLedgerPath: coverageEnrollmentLedgerFixturePath,
      counts: {
        followUpItems: 1
      },
      followUpItems: [
        { followUpId: "stale-enrollment-follow-up-001", software: "StaleTool", route: "collect_watch_or_queue_item_evidence" }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
utimesSync(staleCoverageEnrollmentFollowUpPlanFixturePath, new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-01T00:00:00.000Z"));
writeFileSync(
  coverageEnrollmentFollowUpPlanFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
      planId: "current-status-enrollment-follow-up-plan-fixture",
      sourceLedgerPath: coverageEnrollmentLedgerFixturePath,
      counts: {
        followUpItems: 2
      },
      followUpItems: [
        { followUpId: "enrollment-follow-up-001", software: "ExampleCAD", route: "collect_watch_or_queue_item_evidence" },
        { followUpId: "enrollment-follow-up-002", software: "ExampleBrowser", route: "promote_inventory_row_to_observer_queue" }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(coverageEnrollmentFollowUpBatchReadmeFixturePath, "# Fixture enrollment follow-up batch\n", "utf8");
writeFileSync(
  coverageEnrollmentFollowUpBatchFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1",
      batchId: "current-status-enrollment-follow-up-batch-fixture",
      sourcePlanPath: coverageEnrollmentFollowUpPlanFixturePath,
      teacherReviewed: false,
      selectedItemCount: 2,
      ranToolCount: 0,
      routeCounts: {
        dry_run_only: 2
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
utimesSync(
  coverageEnrollmentFollowUpBatchFixturePath,
  new Date("2026-01-02T00:00:00.000Z"),
  new Date("2026-01-02T00:00:00.000Z")
);
utimesSync(
  coverageEnrollmentFollowUpBatchReadmeFixturePath,
  new Date("2026-01-02T00:00:00.000Z"),
  new Date("2026-01-02T00:00:00.000Z")
);
writeFileSync(coverageEnrollmentFollowUpReconciliationReadmeFixturePath, "# Fixture enrollment follow-up reconciliation\n", "utf8");
writeFileSync(
  coverageEnrollmentFollowUpReconciliationFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_v1",
      reconciliationId: "current-status-enrollment-follow-up-reconciliation-fixture",
      status: "waiting_for_teacher_review",
      sourceEvidence: {
        batchPath: coverageEnrollmentFollowUpBatchFixturePath,
        sourcePlanPath: coverageEnrollmentFollowUpPlanFixturePath,
        sourceLedgerPath: coverageEnrollmentLedgerFixturePath
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  coverageEnrollmentReceiptBuilderHtmlFixturePath,
  "<!doctype html><title>Fixture enrollment follow-up receipt builder</title>\n",
  "utf8"
);
writeFileSync(
  coverageEnrollmentReceiptTemplateFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_review_receipt_v1",
      defaultDecision: "needs_teacher_review",
      rows: [{ itemId: "enrollment-gap-1", teacherDecision: "needs_teacher_review" }]
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  coverageEnrollmentReceiptBuilderFixturePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_receipt_builder_v1",
      builderId: "current-status-enrollment-follow-up-receipt-builder-fixture",
      status: "coverage_enrollment_follow_up_receipt_builder_ready_for_teacher_use",
      counts: {
        followUpRows: 1
      },
      paths: {
        builder: coverageEnrollmentReceiptBuilderFixturePath,
        html: coverageEnrollmentReceiptBuilderHtmlFixturePath,
        receiptTemplate: coverageEnrollmentReceiptTemplateFixturePath,
        sourceFollowUpPlan: staleCoverageEnrollmentFollowUpPlanFixturePath,
        sourceDryRunBatch: coverageEnrollmentFollowUpBatchFixturePath,
        sourceLedger: coverageEnrollmentLedgerFixturePath
      },
      nextReviewedBatchCommand: `node plugins/transparent-ai-apprentice/scripts/run-all-software-coverage-enrollment-follow-up-batch.mjs --teacher-reviewed --plan "${coverageEnrollmentFollowUpPlanFixturePath}"`,
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        builderDoesNotRunBatch: true,
        screenshotsCapturedByThisTool: false,
        softwareActionsExecuted: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const sketchImplementationAuditFixtureDir = join(refreshScanRoot, "sketch-demonstration-implementation-audit", "fixture");
mkdirSync(sketchImplementationAuditFixtureDir, { recursive: true });
const sketchImplementationAuditFixturePath = join(
  sketchImplementationAuditFixtureDir,
  "sketch-demonstration-implementation-audit.json"
);
writeFileSync(
  sketchImplementationAuditFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_sketch_demonstration_implementation_audit_v1",
      status: "passed",
      requirementSummary: {
        transparentDrawingMaskImplemented: true,
        existingDrawingSoftwareReused: true,
        teacher2DSketchUnderstood: true,
        teacherPerspectiveSketchUnderstood: true,
        teacher3DDepthSketchUnderstood: true,
        universalDetailLogicContractImplemented: true,
        visualSimilarityRejectedWithoutDetailLogic: true,
        numberedTargetConfirmationImplemented: true,
        softwareExecutionBridgeImplemented: true,
        realLocalSoftwareContextProven: true,
        unattendedNativeUniversalExecutionProven: false
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        technologyAccepted: false,
        packagingGated: true,
        screenshotsCapturedByDefault: false,
        fullContinuousRecording: false,
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const depthRehearsalValidationFixtureDir = join(
  refreshScanRoot,
  "transparent-sketch-depth-rehearsal-review-receipt-validations",
  "fixture"
);
mkdirSync(depthRehearsalValidationFixtureDir, { recursive: true });
const depthRehearsalValidationFixturePath = join(
  depthRehearsalValidationFixtureDir,
  "transparent-sketch-depth-rehearsal-review-receipt-validation.json"
);
writeFileSync(
  depthRehearsalValidationFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_validation_v1",
      status: "needs_teacher_review",
      validationDecision: "needs_teacher_review",
      totalRows: 6,
      confirmedRowCount: 0,
      readyForExecution: false,
      accepted: false,
      ruleEnabled: false,
      nativeUniversalExecution: false,
      goalComplete: false,
      locks: {
        reviewOnly: true,
        validationDoesNotExecuteSoftware: true,
        validationDoesNotCaptureScreenshots: true,
        validationDoesNotWriteMemory: true,
        accepted: false,
        ruleEnabled: false,
        technologyAccepted: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        uiEventsSent: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const spatialIntentEvidenceValidationFixtureDir = join(
  refreshScanRoot,
  "spatial-intent-evidence-receipt-validations",
  "fixture"
);
mkdirSync(spatialIntentEvidenceValidationFixtureDir, { recursive: true });
const spatialIntentEvidenceValidationFixturePath = join(
  spatialIntentEvidenceValidationFixtureDir,
  "spatial-intent-evidence-receipt-validation.json"
);
writeFileSync(
  spatialIntentEvidenceValidationFixturePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_intent_evidence_receipt_validation_v1",
      status: "validated_with_ready_spatial_target_confirmation",
      validationDecision: "ready_for_reviewed_spatial_target_confirmation",
      validationRow: {
        spatialEvidence: {
          ready: true,
          has2DPositionEvidence: true,
          hasAngleOrDirectionEvidence: true,
          hasPerspectiveEvidence: true,
          has3DDepthEvidence: true,
          missingDimensions: []
        },
        detailLogicReadyForAction: true,
        detailLogicValidationReadyForAction: true,
        canPrepareSpatialConfirmation: true
      },
      nextReviewCommand: {
        commandLine:
          "node plugins\\transparent-ai-apprentice\\scripts\\create-spatial-target-confirmation-kit.mjs --overlay-packet \"<teacher-exported-transparent-sketch-packet.json>\" --create-action-kit \"true\"",
        executesNow: false,
        blockedUntil: "teacher confirms one numbered spatial target after reviewing the generated confirmation packet"
      },
      locks: {
        reviewOnly: true,
        validationDoesNotRunSpatialTargetConfirmation: true,
        targetSoftwareCommandsExecuted: false,
        softwareActionsExecuted: false,
        uiEventsSent: false,
        screenshotsCaptured: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const operationalActivationChainFixtureDir = join(refreshScanRoot, "all-software-operational-learning-activation-gates", "fixture");
mkdirSync(operationalActivationChainFixtureDir, { recursive: true });
const operationalActivationGateFixturePath = join(
  operationalActivationChainFixtureDir,
  "all-software-operational-learning-activation-gate.json"
);
const operationalActivationGateReadmeFixturePath = join(
  operationalActivationChainFixtureDir,
  "ALL_SOFTWARE_OPERATIONAL_LEARNING_ACTIVATION_GATE_START_HERE.md"
);
writeFileSync(operationalActivationGateReadmeFixturePath, "# Fixture operational activation gate\n", "utf8");
writeFileSync(
  operationalActivationGateFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_operational_learning_activation_gate_v1",
      status: "activation_dry_run_ready_for_teacher_registration_review",
      paths: {
        activationGate: operationalActivationGateFixturePath,
        readme: operationalActivationGateReadmeFixturePath
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        scheduledTaskRegistered: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const operationalDryRunFixtureDir = join(refreshScanRoot, "all-software-operational-learning-activation-dry-run-rehearsals", "fixture");
mkdirSync(operationalDryRunFixtureDir, { recursive: true });
const operationalDryRunFixturePath = join(
  operationalDryRunFixtureDir,
  "all-software-operational-learning-activation-dry-run-rehearsal.json"
);
const operationalDryRunReadmeFixturePath = join(
  operationalDryRunFixtureDir,
  "ALL_SOFTWARE_OPERATIONAL_LEARNING_ACTIVATION_DRY_RUN_REHEARSAL_START_HERE.md"
);
writeFileSync(operationalDryRunReadmeFixturePath, "# Fixture operational activation dry-run rehearsal\n", "utf8");
writeFileSync(
  operationalDryRunFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
      status: "passed_no_system_change",
      paths: {
        rehearsal: operationalDryRunFixturePath,
        readme: operationalDryRunReadmeFixturePath
      },
      locks: {
        reviewOnly: true,
        activationDryRunWrapperExecuted: true,
        wrapperExecuteFlagPassed: false,
        registrationStatusQueryOnly: true,
        scheduledTaskRegistered: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const operationalExecuteGateFixtureDir = join(refreshScanRoot, "all-software-operational-learning-registration-execute-gates", "fixture");
mkdirSync(operationalExecuteGateFixtureDir, { recursive: true });
const operationalExecuteGateFixturePath = join(
  operationalExecuteGateFixtureDir,
  "all-software-operational-learning-registration-execute-gate.json"
);
const operationalExecuteGateReadmeFixturePath = join(
  operationalExecuteGateFixtureDir,
  "ALL_SOFTWARE_OPERATIONAL_LEARNING_REGISTRATION_EXECUTE_GATE_START_HERE.md"
);
writeFileSync(operationalExecuteGateReadmeFixturePath, "# Fixture operational registration execute gate\n", "utf8");
writeFileSync(
  operationalExecuteGateFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
      status: "ready_for_teacher_registration_execute_review",
      paths: {
        registrationExecuteGate: operationalExecuteGateFixturePath,
        readme: operationalExecuteGateReadmeFixturePath
      },
      locks: {
        reviewOnly: true,
        executeRequestPrepared: true,
        executeRequestExecuted: false,
        scheduledTaskRegistered: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const operationalWitnessFixtureDir = join(refreshScanRoot, "all-software-operational-learning-post-activation-witnesses", "fixture");
mkdirSync(operationalWitnessFixtureDir, { recursive: true });
const operationalWitnessFixturePath = join(
  operationalWitnessFixtureDir,
  "all-software-operational-learning-post-activation-witness.json"
);
const operationalWitnessReadmeFixturePath = join(
  operationalWitnessFixtureDir,
  "ALL_SOFTWARE_OPERATIONAL_LEARNING_POST_ACTIVATION_WITNESS_START_HERE.md"
);
writeFileSync(operationalWitnessReadmeFixturePath, "# Fixture operational post-activation witness\n", "utf8");
writeFileSync(
  operationalWitnessFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_operational_learning_post_activation_witness_v1",
      status: "waiting_for_post_activation_registration_status",
      readyForTeacherOperationalReview: false,
      remainingGaps: [
        {
          kind: "scheduled_task_not_registered_or_not_matching_after_execute_gate",
          detail: "Fixture keeps operational claim blocked until teacher-executed registration is witnessed."
        }
      ],
      paths: {
        witness: operationalWitnessFixturePath,
        readme: operationalWitnessReadmeFixturePath
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        scheduledTaskRegistered: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const executionConvergenceFixtureDir = join(refreshScanRoot, "all-software-execution-capability-convergence-audits", "fixture");
mkdirSync(executionConvergenceFixtureDir, { recursive: true });
const executionMatrixFixturePath = join(executionConvergenceFixtureDir, "all-software-execution-capability-matrix.json");
const executionConvergenceFixturePath = join(executionConvergenceFixtureDir, "all-software-execution-capability-convergence-audit.json");
const originalGoalExecutionConvergenceFixtureDir = join(refreshScanRoot, "original-goal-execution-convergence-audits", "fixture");
mkdirSync(originalGoalExecutionConvergenceFixtureDir, { recursive: true });
const originalGoalExecutionConvergenceFixturePath = join(
  originalGoalExecutionConvergenceFixtureDir,
  "all-software-execution-capability-convergence-audit.json"
);
writeFileSync(
  executionMatrixFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_execution_capability_matrix_v1",
      matrixId: "current-status-execution-matrix-fixture"
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  executionConvergenceFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_execution_capability_convergence_audit_v1",
      auditId: "current-status-execution-convergence-fixture",
      status: "execution_capability_still_has_remaining_lanes_or_review_gaps",
      sourceEvidence: {
        latestMatrixPath: executionMatrixFixturePath
      },
      remainingReviewGaps: [
        {
          kind: "route_confirmation",
          detail: "One software row still needs teacher-confirmed route evidence."
        }
      ],
      nextCommand: "Review latest matrix gaps, confirm exact routes, then rerun a bounded execution capability supervisor pass.",
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        scheduledTaskRegistered: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  originalGoalExecutionConvergenceFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_execution_capability_convergence_audit_v1",
      auditId: "current-status-original-goal-execution-convergence-fixture",
      status: "execution_capability_still_has_remaining_lanes_or_review_gaps",
      sourceEvidence: {
        latestMatrixPath: executionMatrixFixturePath,
        reconciliationPaths: ["D:\\example\\external-reconciliation.json"]
      },
      counts: {
        externalReconciliationsAudited: 1,
        externalReconciliationTotals: {
          reconciledRows: 10,
          rowsReadyForNextMatrix: 10,
          dryRunPilotReceipts: 0,
          controlChannelProbePackages: 10
        }
      },
      remainingReviewGaps: [
        {
          kind: "reconciliation_teacher_review_missing",
          detail: "External reconciliation exists but still needs teacher review."
        },
        {
          kind: "action_logic_source_missing",
          detail: "Latest matrix rows still lack reviewed action-level logic-source contracts."
        }
      ],
      nextCommand: "Review external reconciliation, then rerun a bounded execution capability supervisor pass.",
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        scheduledTaskRegistered: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const realLocalReadinessFixtureDir = join(refreshScanRoot, "real-local-all-software-low-token-readiness-packages", "fixture");
mkdirSync(realLocalReadinessFixtureDir, { recursive: true });
const realLocalReadinessFixturePath = join(realLocalReadinessFixtureDir, "real-local-all-software-low-token-readiness-package.json");
const realLocalReadinessReceiptFixturePath = join(realLocalReadinessFixtureDir, "real-local-all-software-low-token-readiness-receipt.json");
const realLocalReadinessReadmeFixturePath = join(realLocalReadinessFixtureDir, "REAL_LOCAL_ALL_SOFTWARE_LOW_TOKEN_READINESS_START_HERE.md");
const currentGoalStartHereFixtureDir = join(refreshScanRoot, "current-goal-start-here", "fixture");
mkdirSync(currentGoalStartHereFixtureDir, { recursive: true });
const currentGoalStartHereFixturePath = join(currentGoalStartHereFixtureDir, "current-goal-start-here.json");
const currentGoalStartHereHtmlFixturePath = join(currentGoalStartHereFixtureDir, "current-goal-start-here.html");
const currentGoalStartHereReadmeFixturePath = join(currentGoalStartHereFixtureDir, "CURRENT_GOAL_START_HERE.md");
const currentGoalRealLocalTrialFixtureDir = join(refreshScanRoot, "current-goal-real-local-trial-packages", "fixture");
mkdirSync(currentGoalRealLocalTrialFixtureDir, { recursive: true });
const currentGoalRealLocalTrialFixturePath = join(
  currentGoalRealLocalTrialFixtureDir,
  "current-goal-real-local-trial-package.json"
);
const currentGoalRealLocalTrialHtmlFixturePath = join(
  currentGoalRealLocalTrialFixtureDir,
  "current-goal-real-local-trial-package.html"
);
const currentGoalRealLocalTrialReadmeFixturePath = join(
  currentGoalRealLocalTrialFixtureDir,
  "CURRENT_GOAL_REAL_LOCAL_TRIAL_PACKAGE.md"
);
const readinessFallbackScanRoot = join(smokeRoot, "readiness-ledger-fallback-scan");
const readinessFallbackFixtureDir = join(
  readinessFallbackScanRoot,
  "real-local-all-software-low-token-readiness-packages",
  "fixture"
);
mkdirSync(readinessFallbackFixtureDir, { recursive: true });
const readinessFallbackPackagePath = join(
  readinessFallbackFixtureDir,
  "real-local-all-software-low-token-readiness-package.json"
);
const readinessFallbackLedgerPath = join(readinessFallbackFixtureDir, "all-software-log-source-discovery-ledger.json");
const readinessFallbackLedgerReadmePath = join(
  readinessFallbackFixtureDir,
  "ALL_SOFTWARE_LOG_SOURCE_DISCOVERY_LEDGER_START_HERE.md"
);
writeFileSync(
  realLocalReadinessFixturePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_local_all_software_low_token_readiness_package_v1",
      packageId: "current-status-real-local-readiness-fixture",
      status: "waiting_for_teacher_review_before_registration_or_learning_memory",
      counts: {
        realLocalCandidates: 3,
        cadOrSolidWorksCandidates: 1,
        nonCadSolidWorksCandidates: 2,
        nonCadSolidWorksLedgerRows: 2,
        queuedSoftware: 2,
        logSourceDiscoveryRows: 3,
        logSourceDiscoveryMissingRows: 1,
        directLogCandidatesReadyForMetadataGate: 1,
        lowTokenFallbackRoutesReadyForReview: 1,
        runnerRuns: 1,
        compactLearningEvents: 1,
        triggeredVisualRequests: 1
      },
      paths: {
        logSourceDiscoveryLedger: logSourceDiscoveryLedgerFixturePath,
        logSourceDiscoveryLedgerReadme: logSourceDiscoveryLedgerReadmeFixturePath
      },
      scopeEvidence: {
        scopeClaim: "real_local_bounded_all_software_not_cad_solidworks_only",
        realLocalCandidateRows: 3,
        cadOrSolidWorksCandidateRows: 1,
        nonCadSolidWorksCandidateRows: 2,
        nonCadSolidWorksLedgerRows: 2,
        sampledNonCadSolidWorksRows: [
          {
            software: "FixtureBrowser",
            processName: "fixturebrowser.exe",
            discoveryStatus: "windows_event_log_fallback_ready_for_review",
            candidateLogFileCount: 0,
            windowsEventLogCount: 1,
            canAttemptAutomaticLogReadAfterMetadataGate: false
          },
          {
            software: "FixtureEditor",
            processName: "fixtureeditor.exe",
            discoveryStatus: "non_log_low_token_fallback_ready_for_review",
            candidateLogFileCount: 0,
            windowsEventLogCount: 0,
            canAttemptAutomaticLogReadAfterMetadataGate: false
          }
        ],
        boundedNotComplete: true,
        proofBoundary:
          "Smoke fixture proves the current-status refresh propagates bounded non-CAD/SolidWorks scope evidence without claiming broad completion."
      },
      boundaries: {
        broadAllInstalledSoftwareComplete: false,
        logSourceDiscoveryComplete: false,
        allRowsHaveCurrentSourceRoute: false,
        arbitraryNativeExecutionComplete: false,
        scheduledTaskRegistered: false,
        screenshotsCaptured: false,
        longTermMemoryWritten: false
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        scheduledTaskInstalled: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  currentGoalStartHereHtmlFixturePath,
  "<!doctype html><html><head><title>Current Goal Start Here</title></head><body><h1>Current Goal Start Here</h1></body></html>\n",
  "utf8"
);
writeFileSync(currentGoalStartHereReadmeFixturePath, "# Current Goal Start Here\n", "utf8");
writeFileSync(
  currentGoalStartHereFixturePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_start_here_launchpad_v1",
      status: "stable_start_here_ready_review_only_goal_not_complete",
      goalComplete: false,
      entryLinks: [
        { id: "current_goal_real_local_trial_package", path: currentGoalRealLocalTrialHtmlFixturePath },
        { id: "teacher_trial_intake_router_html", path: "<teacher-trial-intake-router.html>" }
      ],
      safeNextActions: [
        { id: "create_real_local_trial_package", commandOrPath: "create-current-goal-real-local-trial-package.mjs" }
      ],
      statusSummary: {
        realLocalTrialPackageStatus: "real_local_trial_evidence_ready_review_only_goal_not_complete",
        realLocalTrialPackageChecksPassed: 10,
        realLocalTrialPackageChecksTotal: 10,
        realLocalTrialPackageSampleSoftware: "FixtureApp",
        goalComplete: false
      },
      paths: {
        launchpad: currentGoalStartHereFixturePath,
        html: currentGoalStartHereHtmlFixturePath,
        readme: currentGoalStartHereReadmeFixturePath,
        realLocalTrialPackage: currentGoalRealLocalTrialFixturePath
      },
      locks: {
        reviewOnly: true,
        launchpadDoesNotReadLogs: true,
        launchpadDoesNotCaptureScreenshots: true,
        launchpadDoesNotExecuteTargetSoftware: true,
        launchpadDoesNotWriteMemory: true,
        launchpadDoesNotDeleteRollbackPoints: true,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  currentGoalRealLocalTrialHtmlFixturePath,
  "<!doctype html><html><head><title>Current Goal Real Local Trial Package</title></head><body><h1>Current Goal Real Local Trial Package</h1></body></html>\n",
  "utf8"
);
writeFileSync(currentGoalRealLocalTrialReadmeFixturePath, "# Current Goal Real Local Trial Package\n", "utf8");
writeFileSync(
  currentGoalRealLocalTrialFixturePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_real_local_trial_package_v1",
      status: "real_local_trial_evidence_ready_review_only_goal_not_complete",
      goalComplete: false,
      realLocalSoftware: {
        software: "FixtureApp",
        processName: "FixtureApp",
        discoveredCandidateCount: 3
      },
      checkSummary: {
        total: 10,
        passed: 10,
        failed: 0
      },
      paths: {
        package: currentGoalRealLocalTrialFixturePath,
        html: currentGoalRealLocalTrialHtmlFixturePath,
        readme: currentGoalRealLocalTrialReadmeFixturePath
      },
      locks: {
        reviewOnly: true,
        realLocalTrialDoesNotRegisterMonitor: true,
        realLocalTrialDoesNotCaptureScreenshots: true,
        realLocalTrialDoesNotRecordScreen: true,
        realLocalTrialDoesNotExecuteTargetSoftware: true,
        realLocalTrialDoesNotWriteMemory: true,
        realLocalTrialDoesNotEnableRules: true,
        realLocalTrialDoesNotDowngradeRuntime: true,
        realLocalTrialDoesNotDeleteRollbackPoints: true,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(readinessFallbackLedgerReadmePath, "# Embedded fixture log source discovery ledger\n", "utf8");
writeFileSync(
  readinessFallbackLedgerPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_log_source_discovery_ledger_v1",
      ledgerId: "current-status-readiness-embedded-log-source-discovery-fixture",
      status: "needs_teacher_log_source_review",
      counts: {
        totalInventoryRows: 1,
        ledgerRows: 1,
        directLogCandidatesReadyForMetadataGate: 0,
        nonLogLowTokenFallbackReadyForReview: 1,
        windowsEventLogFallbackReadyForReview: 0,
        candidateRootsNeedBoundedScan: 0,
        needsTeacherLogSourceOrExclusion: 0,
        teacherExcludedOrPrivate: 0
      },
      allRowsHaveSourceRoute: true,
      nextReviewQueue: [
        {
          software: "EmbeddedFallbackApp",
          sourceRoute: "process_window_metadata_delta",
          reviewAction: "teacher_review_low_token_fallback_route"
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        logContentsRead: false,
        screenshotsCaptured: false,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        scheduledTaskRegistered: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  readinessFallbackPackagePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_local_all_software_low_token_readiness_package_v1",
      packageId: "current-status-readiness-embedded-log-source-fixture",
      status: "waiting_for_teacher_review_before_registration_or_learning_memory",
      counts: {
        realLocalCandidates: 1,
        queuedSoftware: 1,
        logSourceDiscoveryRows: 1,
        logSourceDiscoveryMissingRows: 0,
        directLogCandidatesReadyForMetadataGate: 0,
        lowTokenFallbackRoutesReadyForReview: 1
      },
      paths: {
        logSourceDiscoveryLedger: readinessFallbackLedgerPath,
        logSourceDiscoveryLedgerReadme: readinessFallbackLedgerReadmePath
      },
      boundaries: {
        broadAllInstalledSoftwareComplete: false,
        logSourceDiscoveryComplete: false,
        allRowsHaveCurrentSourceRoute: true,
        arbitraryNativeExecutionComplete: false,
        scheduledTaskRegistered: false,
        screenshotsCaptured: false,
        longTermMemoryWritten: false
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        scheduledTaskInstalled: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  realLocalReadinessReceiptFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_real_local_all_software_low_token_readiness_receipt_v1",
      packageId: "current-status-real-local-readiness-fixture",
      teacherDecision: "needs_teacher_review",
      accepted: false,
      ruleEnabled: false
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(realLocalReadinessReadmeFixturePath, "# Real Local All-Software Low-Token Readiness\n\nFixture for current-status direct entry smoke.\n", "utf8");

const spatialRouteBridgeFixtureDir = join(refreshScanRoot, "spatial-software-execution-routes", "fixture");
mkdirSync(spatialRouteBridgeFixtureDir, { recursive: true });
const spatialRouteBridgeFixturePath = join(
  spatialRouteBridgeFixtureDir,
  "spatial-software-execution-route-bridge.json"
);
writeFileSync(
  spatialRouteBridgeFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_spatial_software_execution_route_bridge_v1",
      bridgeId: "current-status-spatial-route-approval-handoff-fixture",
      status: "teacher_confirmed_route_waiting_for_real_local_execution_approval_gate",
      selectedTarget: {
        targetId: "numbered-target-2",
        targetNumber: 2,
        source: "teacher_confirmed_transparent_sketch_overlay"
      },
      nextExecutionGateHandoff: {
        format: "transparent_ai_spatial_route_to_execution_approval_handoff_v1",
        status: "ready_for_real_local_execution_approval_gate_prep",
        objectiveRequirementId: "transparent_sketch_spatial_intent_teacher_export",
        completionBlockerLane: "voice_text_numbered_confirmation_supervised_execution_gate",
        nextGate: "create_real_local_execution_approval_gate",
        prerequisiteGate: "create_real_local_execution_pilot_selector",
        nextGateAfterReadyGate: "create_all_software_execution_approved_gate_command_builder",
        finalRunnerGate: "run_all_software_execution_approved_gate_runner",
        readyForExecutionApprovalGatePrep: true,
        returnToCompletionBlockerMatrixAfterNextGate: true,
        requiredEvidenceBeforeManualUse: [
          "teacher_selected_numbered_spatial_target",
          "reviewed_execution_adapter",
          "rollback_point_manifest"
        ],
        locks: {
          routeBridgeDoesNotCreateApprovalGate: true,
          routeBridgeDoesNotRunApprovedGateRunner: true,
          routeBridgeDoesNotInvokeAdapter: true,
          softwareActionsExecuted: false,
          targetSoftwareCommandsExecuted: false,
          nativeUniversalExecution: false
        }
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const result = runNodeScript("create-original-goal-current-status-refresh.mjs", [
  "--goal",
  "Refresh current evidence for all-software low-token learning, teacher method adaptation, transparent sketch intent, and supervised execution gates.",
  "--software",
  "ExampleCAD",
  "--command",
  "Use the teacher's current instruction only after numbered target confirmation.",
  "--preflight-runner",
  runnerFixturePath,
  "--preflight-learning-cycle",
  learningCycleFixturePath,
  "--coverage-convergence",
  coverageConvergenceFixturePath,
  "--log-source-discovery-ledger",
  logSourceDiscoveryLedgerFixturePath,
  "--automatic-low-token-learning-schedule",
  automaticLowTokenLearningScheduleFixturePath,
  "--recurring-monitor-approval-gate",
  recurringMonitorApprovalGateFixturePath,
  "--recurring-monitor-teacher-confirmation-receipt-validation",
  recurringMonitorReceiptValidationFixturePath,
  "--coverage-rollout-receipt-builder",
  coverageReceiptBuilderFixturePath,
  "--real-local-readiness-package",
  realLocalReadinessFixturePath,
  "--current-goal-start-here",
  currentGoalStartHereFixturePath,
  "--current-goal-real-local-trial-package",
  currentGoalRealLocalTrialFixturePath,
  "--spatial-route-bridge",
  spatialRouteBridgeFixturePath,
  "--output-dir",
  join(smokeRoot, "refresh"),
  "--scan-root",
  refreshScanRoot,
  "--allow-smoke-evidence"
]);

const refresh = readJson(result.refreshPath);
const originalGoalCapabilityMatrixCoverageAudit = readJson(refresh.paths.originalGoalCapabilityMatrixCoverageAudit);
const originalGoalCapabilityMatrixCoverageAuditHtml = readFileSync(
  refresh.paths.originalGoalCapabilityMatrixCoverageAuditHtml,
  "utf8"
);
const knowledgeAugmentedSpatialExecutionBridgeCommandReview = readJson(
  refresh.paths.knowledgeAugmentedSpatialExecutionBridgeCommandReview
);
const readiness = readJson(result.originalGoalReadinessAudit);
const statusConsole = readJson(result.operationalStatusConsole);
const logSourceDiscoveryLedger = readJson(refresh.paths.logSourceDiscoveryLedger);
const readinessFallbackResult = runNodeScript("create-original-goal-current-status-refresh.mjs", [
  "--goal",
  "Refresh current evidence using a real-local readiness package that embeds the log-source discovery ledger path.",
  "--software",
  "EmbeddedFallbackApp",
  "--command",
  "Review the embedded low-token source route before any visual or execution follow-up.",
  "--real-local-readiness-package",
  readinessFallbackPackagePath,
  "--output-dir",
  join(smokeRoot, "readiness-ledger-fallback-refresh"),
  "--scan-root",
  readinessFallbackScanRoot,
  "--allow-smoke-evidence",
  "--no-command-center"
]);
const readinessFallbackRefresh = readJson(readinessFallbackResult.refreshPath);
const readinessFallbackLogSourceDiscoveryLedger = readJson(readinessFallbackRefresh.paths.logSourceDiscoveryLedger);
const readyRuleDslAuditScanRoot = join(smokeRoot, "ready-rule-dsl-audit-scan-root");
const readyRuleDslAuditFixtureDir = join(readyRuleDslAuditScanRoot, "rag-delivery-gate-audit-trail", "fixture");
mkdirSync(readyRuleDslAuditFixtureDir, { recursive: true });
const readyRuleDslAuditFixturePath = join(readyRuleDslAuditFixtureDir, "rag-delivery-gate-audit-trail.json");
writeFileSync(
  readyRuleDslAuditFixturePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_rag_delivery_gate_audit_trail_v1",
      auditId: "current-status-ready-rule-dsl-audit-fixture",
      status: "audit_trail_ready_for_teacher_review",
      sourceEvidence: {
        deliveryGatePath: "fixture-rag-validation-report-delivery-gate.json",
        retainedRollbackPoint: "fixture-retained-rollback-point"
      },
      evidenceChain: [
        {
          step: "closed_delivery_gate",
          evidencePath: "fixture-rag-validation-report-delivery-gate.json",
          status: "delivery_allowed_but_review_only"
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        technologyAccepted: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        packagingUnlocked: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const readyRuleDslAuditReviewBuilderDir = join(
  readyRuleDslAuditScanRoot,
  "rag-delivery-gate-audit-review-receipt-builder",
  "fixture"
);
mkdirSync(readyRuleDslAuditReviewBuilderDir, { recursive: true });
const readyRuleDslAuditReviewBuilderPath = join(
  readyRuleDslAuditReviewBuilderDir,
  "rag-delivery-gate-audit-review-receipt-builder.json"
);
const readyRuleDslAuditReviewTemplatePath = join(
  readyRuleDslAuditReviewBuilderDir,
  "rag-delivery-gate-audit-review-receipt-template.json"
);
const readyRuleDslAuditReviewWorkbenchHtmlPath = join(
  readyRuleDslAuditReviewBuilderDir,
  "rag-delivery-gate-audit-review-workbench.html"
);
writeFileSync(
  readyRuleDslAuditReviewWorkbenchHtmlPath,
  "<!doctype html><html><head><title>RAG Delivery Gate Audit Review Workbench</title></head><body>reviewOnly=true ruleEnabled=false softwareActionsExecuted=false packagingUnlocked=false</body></html>\n",
  "utf8"
);
writeFileSync(
  readyRuleDslAuditReviewTemplatePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_rag_delivery_gate_audit_review_receipt_v1",
      defaultDecision: "needs_teacher_review",
      auditTrailPath: readyRuleDslAuditFixturePath,
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        softwareActionsExecuted: false,
        packagingGated: true,
        packagingUnlocked: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  readyRuleDslAuditReviewBuilderPath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_rag_delivery_gate_audit_review_receipt_builder_v1",
      auditTrailPath: readyRuleDslAuditFixturePath,
      receiptTemplatePath: readyRuleDslAuditReviewTemplatePath,
      reviewWorkbenchHtmlPath: readyRuleDslAuditReviewWorkbenchHtmlPath,
      validationCommand: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\validate-rag-delivery-gate-audit-review-receipt.mjs --audit-trail "${readyRuleDslAuditFixturePath}" --receipt <teacher-filled-receipt.json>`,
      locks: {
        reviewOnly: true,
        evidenceOnly: true,
        accepted: false,
        ruleEnabled: false,
        memoryEnabled: false,
        softwareActionsExecuted: false,
        externalFetchPerformed: false,
        packagingGated: true,
        packagingUnlocked: false,
        deliveryGateOpen: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const readyRuleDslAuditReviewValidationDir = join(
  readyRuleDslAuditScanRoot,
  "rag-delivery-gate-audit-review-receipt-validation",
  "fixture"
);
mkdirSync(readyRuleDslAuditReviewValidationDir, { recursive: true });
const readyRuleDslAuditReviewValidationPath = join(
  readyRuleDslAuditReviewValidationDir,
  "rag-delivery-gate-audit-review-receipt-validation.json"
);
writeFileSync(
  readyRuleDslAuditReviewValidationPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1",
      validationId: "current-status-ready-rule-dsl-audit-review-validation-fixture",
      auditTrailPath: readyRuleDslAuditFixturePath,
      receiptPath: readyRuleDslAuditReviewTemplatePath,
      status: "waiting_for_teacher_review",
      reviewedEvidenceRows: 0,
      errors: [],
      warnings: [],
      nextReview: {
        mayPrepareReviewOnlyFollowUpQueue: false,
        mayAcceptTechnology: false,
        mayEnableRules: false,
        mayWriteMemory: false,
        mayExecuteSoftware: false,
        mayFetchExternalSources: false,
        mayOpenDeliveryGate: false,
        mayUnlockPackaging: false,
        mayClaimGoalComplete: false
      },
      locks: {
        reviewOnly: true,
        evidenceOnly: true,
        accepted: false,
        ruleEnabled: false,
        memoryEnabled: false,
        softwareActionsExecuted: false,
        externalFetchPerformed: false,
        packagingGated: true,
        packagingUnlocked: false,
        deliveryGateOpen: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const readyRuleDslAuditResult = runNodeScript("create-original-goal-current-status-refresh.mjs", [
  "--goal",
  "Refresh current evidence when a Rule DSL delivery-gate audit trail already exists.",
  "--software",
  "ExampleCAD",
  "--command",
  "Route an existing Rule DSL delivery-gate audit to teacher review instead of regenerating it.",
  "--output-dir",
  join(smokeRoot, "ready-rule-dsl-audit-refresh"),
  "--scan-root",
  readyRuleDslAuditScanRoot,
  "--allow-smoke-evidence"
]);
const readyRuleDslAuditRefresh = readJson(readyRuleDslAuditResult.refreshPath);
const readyRuleDslAuditQueue = readJson(readyRuleDslAuditRefresh.paths.originalGoalCompletionBlockerNextStepQueue);
const readyRuleDslAuditQueueItem = readyRuleDslAuditQueue.queueItems.find(
  (row) => row.lane === "rule_dsl_delivery_gate_audit"
);
const readyRuleDslAuditLaneCommandBuilder = readJson(
  readyRuleDslAuditRefresh.paths.originalGoalCompletionBlockerLaneCommandBuilder
);
const readyRuleDslAuditLaneItem = readyRuleDslAuditLaneCommandBuilder.items.find(
  (row) => row.lane === "rule_dsl_delivery_gate_audit"
);
const gapBoard = readJson(result.gapActionBoard);
const triage = readJson(refresh.paths.nextActionTriage);
const teacherActionShortlist = readJson(refresh.paths.teacherActionShortlist);
const teacherActionShortlistReceiptTemplate = readJson(refresh.paths.teacherActionShortlistRouterReceiptTemplate);
const originalGoalNextConfirmationPack = readJson(refresh.paths.originalGoalNextConfirmationPack);
const originalGoalNextConfirmationPackHtml = readFileSync(refresh.paths.originalGoalNextConfirmationPackHtml, "utf8");
const originalGoalNextConfirmationPackReceiptTemplate = readJson(refresh.paths.originalGoalNextConfirmationPackReceiptTemplate);
const originalGoalNextConfirmationPackReceiptBuilder = readJson(
  refresh.paths.originalGoalNextConfirmationPackReceiptBuilder
);
const originalGoalNextConfirmationPackReceiptBuilderHtml = readFileSync(
  refresh.paths.originalGoalNextConfirmationPackReceiptBuilderHtml,
  "utf8"
);
const originalGoalNextConfirmationPackReceiptBuilderTemplate = readJson(
  refresh.paths.originalGoalNextConfirmationPackReceiptBuilderTemplate
);
const originalGoalProofLedger = readJson(refresh.paths.originalGoalProofLedger);
const originalGoalProofLedgerHtml = readFileSync(refresh.paths.originalGoalProofLedgerHtml, "utf8");
const originalGoalProofGapClosurePack = readJson(refresh.paths.originalGoalProofGapClosurePack);
const originalGoalProofGapClosurePackHtml = readFileSync(refresh.paths.originalGoalProofGapClosurePackHtml, "utf8");
const originalGoalProofGapTeacherQueue = readJson(refresh.paths.originalGoalProofGapTeacherQueue);
const originalGoalProofGapTeacherQueueHtml = readFileSync(refresh.paths.originalGoalProofGapTeacherQueueHtml, "utf8");
const originalGoalProofGapEvidencePrefill = readJson(refresh.paths.originalGoalProofGapEvidencePrefill);
const originalGoalProofGapEvidencePrefillHtml = readFileSync(refresh.paths.originalGoalProofGapEvidencePrefillHtml, "utf8");
const originalGoalProofGapEvidencePrefillCandidateReceiptDraft = readJson(
  refresh.paths.originalGoalProofGapEvidencePrefillCandidateReceiptDraft
);
const originalGoalProofGapTeacherQueueReceiptBuilder = readJson(
  refresh.paths.originalGoalProofGapTeacherQueueReceiptBuilder
);
const originalGoalProofGapTeacherQueueReceiptBuilderHtml = readFileSync(
  refresh.paths.originalGoalProofGapTeacherQueueReceiptBuilderHtml,
  "utf8"
);
const originalGoalProofGapTeacherReviewCockpit = readJson(refresh.paths.originalGoalProofGapTeacherReviewCockpit);
const originalGoalProofGapTeacherReviewCockpitHtml = readFileSync(
  refresh.paths.originalGoalProofGapTeacherReviewCockpitHtml,
  "utf8"
);
const originalGoalProofGapTeacherQueueReceiptTemplate = readJson(
  refresh.paths.originalGoalProofGapTeacherQueueReceiptTemplate
);
const teacherMethodExecutionLearningContractReceiptBuilder = readJson(
  refresh.paths.teacherMethodExecutionLearningContractReceiptBuilder
);
const teacherMethodExecutionLearningContractReceiptBuilderHtml = readFileSync(
  refresh.paths.teacherMethodExecutionLearningContractReceiptBuilderHtml,
  "utf8"
);
const teacherMethodExecutionLearningContractReceiptTemplate = readJson(
  refresh.paths.teacherMethodExecutionLearningContractReceiptTemplate
);
const teacherMethodReuseResultProofBuilder = readJson(refresh.paths.teacherMethodReuseResultProofBuilder);
const teacherMethodReuseResultProofBuilderHtml = readFileSync(
  refresh.paths.teacherMethodReuseResultProofBuilderHtml,
  "utf8"
);
const teacherMethodReuseResultProofReceiptTemplate = readJson(
  refresh.paths.teacherMethodReuseResultProofReceiptTemplate
);
const triageHtml = readFileSync(refresh.paths.nextActionTriageHtml, "utf8");
const teacherActionRouter = readJson(refresh.paths.teacherActionRouter);
const teacherActionRouterHtml = readFileSync(refresh.paths.teacherActionRouterHtml, "utf8");
const teacherActionRouterReceiptBuilder = readJson(refresh.paths.teacherActionRouterReceiptBuilder);
const teacherActionRouterReceiptBuilderHtml = readFileSync(refresh.paths.teacherActionRouterReceiptBuilderHtml, "utf8");
const teacherActionRouterReceiptTemplate = readJson(refresh.paths.teacherActionRouterReceiptTemplate);
const controlChannelRepairReceiptBuilder = readJson(refresh.paths.controlChannelRepairReceiptBuilder);
const executionGapReviewCockpit = readJson(refresh.paths.executionGapReviewCockpit);
const executionGapReviewCockpitHtml = readFileSync(refresh.paths.executionGapReviewCockpitHtml, "utf8");
const executionGapReviewCockpitReceiptTemplate = readJson(refresh.paths.executionGapReviewCockpitReceiptTemplate);
const executionGapReviewCockpitShortlist = readJson(refresh.paths.executionGapReviewCockpitShortlist);
const executionGapReviewCockpitShortlistHtml = readFileSync(refresh.paths.executionGapReviewCockpitShortlistHtml, "utf8");
const executionGapReviewCockpitShortlistReceiptTemplate = readJson(
  refresh.paths.executionGapReviewCockpitShortlistReceiptTemplate
);
const actionLogicSourceShortlist = readJson(refresh.paths.actionLogicSourceShortlist);
const actionLogicSourceShortlistHtml = readFileSync(refresh.paths.actionLogicSourceShortlistHtml, "utf8");
const actionLogicSourceShortlistReceiptTemplate = readJson(refresh.paths.actionLogicSourceShortlistReceiptTemplate);
const originalGoalRemainingGatesPacket = readJson(refresh.paths.originalGoalRemainingGatesPacket);
const originalGoalRemainingGatesPacketHtml = readFileSync(refresh.paths.originalGoalRemainingGatesPacketHtml, "utf8");
const originalGoalRemainingGatesReceiptBuilder = readJson(refresh.paths.originalGoalRemainingGatesReceiptBuilder);
const originalGoalRemainingGatesReceiptBuilderHtml = readFileSync(refresh.paths.originalGoalRemainingGatesReceiptBuilderHtml, "utf8");
const originalGoalRemainingGatesReceiptTemplate = readJson(refresh.paths.originalGoalRemainingGatesReceiptTemplate);
const originalGoalReviewHandoffItemCommandBuilder = readJson(refresh.paths.originalGoalReviewHandoffItemCommandBuilder);
const originalGoalReviewHandoffItemCommandBuilderHtml = readFileSync(
  refresh.paths.originalGoalReviewHandoffItemCommandBuilderHtml,
  "utf8"
);
const completionBlockerMatrix = readJson(refresh.paths.originalGoalCompletionBlockerMatrix);
const completionBlockerMatrixHtml = readFileSync(refresh.paths.originalGoalCompletionBlockerMatrixHtml, "utf8");
const completionBlockerNextStepQueue = readJson(refresh.paths.originalGoalCompletionBlockerNextStepQueue);
const completionBlockerNextStepQueueHtml = readFileSync(refresh.paths.originalGoalCompletionBlockerNextStepQueueHtml, "utf8");
const lowTokenCoverageEvidenceDossier = readJson(refresh.paths.originalGoalLowTokenCoverageEvidenceDossier);
const lowTokenCoverageEvidenceDossierHtml = readFileSync(refresh.paths.originalGoalLowTokenCoverageEvidenceDossierHtml, "utf8");
const lowTokenCoverageDossierReceiptBuilder = readJson(refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilder);
const lowTokenCoverageDossierReceiptBuilderHtml = readFileSync(
  refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilderHtml,
  "utf8"
);
const lowTokenMetadataGatePreflight = readJson(refresh.paths.originalGoalLowTokenMetadataGatePreflight);
const lowTokenMetadataGatePreflightHtml = readFileSync(refresh.paths.originalGoalLowTokenMetadataGatePreflightHtml, "utf8");
const lowTokenMetadataGatePreflightReceiptBuilder = readJson(
  refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilder
);
const lowTokenMetadataGatePreflightReceiptBuilderHtml = readFileSync(
  refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilderHtml,
  "utf8"
);
const lowTokenMetadataGatePreflightReceiptTemplate = readJson(
  refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptTemplate
);
const lowTokenCoverageWaitingRowCockpit = readJson(refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpit);
const lowTokenCoverageWaitingRowCockpitHtml = readFileSync(
  refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitHtml,
  "utf8"
);
const lowTokenCoverageWaitingRowCockpitReceiptTemplate = readJson(
  refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate
);
const lowTokenReadyMetadataGateShortlist = readJson(refresh.paths.originalGoalLowTokenReadyMetadataGateShortlist);
const lowTokenReadyMetadataGateShortlistHtml = readFileSync(
  refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistHtml,
  "utf8"
);
const lowTokenReadyMetadataGateShortlistDraftReceipt = readJson(
  refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt
);
const lowTokenBlockedWaitingRowEvidencePlan = readJson(
  refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlan
);
const lowTokenBlockedWaitingRowEvidencePlanHtml = readFileSync(
  refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanHtml,
  "utf8"
);
const lowTokenFallbackRouteEvidencePack = readJson(refresh.paths.originalGoalLowTokenFallbackRouteEvidencePack);
const lowTokenFallbackRouteEvidencePackHtml = readFileSync(
  refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackHtml,
  "utf8"
);
const lowTokenFallbackRouteEvidencePackReceiptBuilder = readJson(
  refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder
);
const lowTokenFallbackRouteEvidencePackReceiptBuilderHtml = readFileSync(
  refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderHtml,
  "utf8"
);
const lowTokenFallbackRouteEvidencePackReceiptTemplate = readJson(
  refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptTemplate
);
const lowTokenBlockedWaitingRowEvidencePlanReceiptBuilder = readJson(
  refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder
);
const lowTokenBlockedWaitingRowEvidencePlanReceiptTemplate = readJson(
  refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptTemplate
);
const completionBlockerLaneCommandBuilder = readJson(refresh.paths.originalGoalCompletionBlockerLaneCommandBuilder);
const completionBlockerLaneCommandBuilderHtml = readFileSync(
  refresh.paths.originalGoalCompletionBlockerLaneCommandBuilderHtml,
  "utf8"
);
const triggeredVisualCheckCommandBuilder = readJson(refresh.paths.triggeredVisualCheckCommandBuilder);
const triggeredVisualCheckCommandBuilderHtml = readFileSync(refresh.paths.triggeredVisualCheckCommandBuilderHtml, "utf8");
const rollbackPoint = readJson(refresh.paths.rollbackPointManifest);
const lowTokenOperationPreflight = readJson(refresh.paths.lowTokenOperationPreflightPolicy);
const lowTokenTriggerBudgetPlan = readJson(refresh.paths.lowTokenTriggerBudgetPlan);
const lowTokenTriggerBudgetPlanHtml = readFileSync(refresh.paths.lowTokenTriggerBudgetPlanHtml, "utf8");
const eventTriggeredObservationPolicy = readJson(refresh.paths.eventTriggeredObservationPolicy);
const eventTriggeredObservationPolicyHtml = readFileSync(refresh.paths.eventTriggeredObservationPolicyHtml, "utf8");
const eventTriggeredObservationPolicyReceiptBuilder = readJson(refresh.paths.eventTriggeredObservationPolicyReceiptBuilder);
const eventTriggeredObservationPolicyReceiptBuilderHtml = readFileSync(
  refresh.paths.eventTriggeredObservationPolicyReceiptBuilderHtml,
  "utf8"
);
const eventTriggeredObservationPolicyReceiptTemplate = readJson(refresh.paths.eventTriggeredObservationPolicyReceiptTemplate);
const nonExpertVoiceControlCapability = readJson(refresh.paths.nonExpertEngineeringVoiceControlCapability);
const nonExpertVoiceControlCapabilityHtml = readFileSync(refresh.paths.nonExpertEngineeringVoiceControlCapabilityHtml, "utf8");
const spatialIntentEvidenceRequest = readJson(refresh.paths.spatialIntentEvidenceRequest);
const spatialIntentEvidenceRequestHtml = readFileSync(refresh.paths.spatialIntentEvidenceRequestHtml, "utf8");
const spatialIntentEvidenceReceiptBuilder = readJson(refresh.paths.spatialIntentEvidenceReceiptBuilder);
const spatialIntentEvidenceReceiptBuilderHtml = readFileSync(refresh.paths.spatialIntentEvidenceReceiptBuilderHtml, "utf8");
const spatialIntentEvidenceReceiptTemplate = readJson(refresh.paths.spatialIntentEvidenceReceiptTemplate);
const spatialIntentEvidenceReceiptValidation = readJson(refresh.paths.spatialIntentEvidenceReceiptValidation);
const transparentSketchDepthDemonstrationRehearsal = readJson(refresh.paths.transparentSketchDepthDemonstrationRehearsal);
const transparentSketchDepthDemonstrationRehearsalHtml = readFileSync(
  refresh.paths.transparentSketchDepthDemonstrationRehearsalHtml,
  "utf8"
);
const transparentSketchDepthRehearsalReviewReceiptBuilder = readJson(
  refresh.paths.transparentSketchDepthRehearsalReviewReceiptBuilder
);
const transparentSketchDepthRehearsalReviewReceiptBuilderHtml = readFileSync(
  refresh.paths.transparentSketchDepthRehearsalReviewReceiptBuilderHtml,
  "utf8"
);
const transparentSketchDepthRehearsalReviewReceiptTemplate = readJson(
  refresh.paths.transparentSketchDepthRehearsalReviewReceiptTemplate
);
const transparentSketchDepthRehearsalReviewReceiptValidation = readJson(
  refresh.paths.transparentSketchDepthRehearsalReviewReceiptValidation
);
const spatialToSoftwareExecutionGatePackage = readJson(refresh.paths.spatialToSoftwareExecutionGatePackage);
const spatialToSoftwareExecutionGatePackageHtml = readFileSync(
  refresh.paths.spatialToSoftwareExecutionGatePackageHtml,
  "utf8"
);
const spatialToSoftwareFirstBlockerHandoff = readJson(refresh.paths.spatialToSoftwareFirstBlockerHandoff);
const spatialToSoftwareFirstBlockerHandoffHtml = readFileSync(
  refresh.paths.spatialToSoftwareFirstBlockerHandoffHtml,
  "utf8"
);
const spatialSoftwareExecutionRouteBridge = readJson(refresh.paths.spatialSoftwareExecutionRouteBridge);
const parametricDrawingLogicKit = readJson(refresh.paths.parametricDrawingLogicLearningKit);
const parametricDrawingLogicHtml = readFileSync(refresh.paths.parametricDrawingLogicLearningKitHtml, "utf8");
const operationalPostActivationWitnessReceiptBuilder = readJson(refresh.paths.operationalPostActivationWitnessReceiptBuilder);
const operationalPostActivationWitnessReceiptBuilderHtml = readFileSync(
  refresh.paths.operationalPostActivationWitnessReceiptBuilderHtml,
  "utf8"
);
const commandCenter = readJson(result.goalCommandCenter);
const teacherReviewCockpit = readJson(refresh.paths.teacherReviewCockpit);
const teacherReviewCockpitHtml = readFileSync(refresh.paths.teacherReviewCockpitHtml, "utf8");
const teacherReviewCockpitReceiptTemplate = readJson(refresh.paths.teacherReviewCockpitReceiptTemplate);
const commandCenterVoiceWorkbench = readJson(commandCenter.paths.voiceWorkbench);
const commandCenterVoiceCommandInput = readFileSync(commandCenter.paths.voiceWorkbenchCommandInput, "utf8").trim();
const readme = readFileSync(result.readmePath, "utf8");
const dashboard = readFileSync(result.dashboardPath, "utf8");
const integratedControlFlow = readJson(refresh.paths.originalGoalIntegratedControlFlow);
const integratedControlFlowHtml = readFileSync(refresh.paths.originalGoalIntegratedControlFlowHtml, "utf8");
const integratedControlFlowReadme = readFileSync(refresh.paths.originalGoalIntegratedControlFlowReadme, "utf8");
const objectiveFulfillmentAudit = readJson(refresh.paths.originalGoalObjectiveFulfillmentAudit);
const objectiveFulfillmentNextStepQueue = readJson(refresh.paths.originalGoalObjectiveFulfillmentNextStepQueue);
const lowTokenMonitorCommandBridge = readJson(refresh.paths.originalGoalLowTokenMonitorCommandBridge);
const lowTokenMonitorBridgeReceiptBuilder = readJson(refresh.paths.originalGoalLowTokenMonitorBridgeReceiptBuilder);
const lowTokenMonitorBridgeReceiptTemplate = readJson(refresh.paths.originalGoalLowTokenMonitorBridgeReceiptTemplate);
const lowTokenCompactEvidenceTeacherLaunchpad = refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpad
  ? readJson(refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpad)
  : {};
const lowTokenCompactEvidenceTeacherLaunchpadHtml = refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadHtml
  ? readFileSync(refresh.paths.originalGoalLowTokenCompactEvidenceTeacherLaunchpadHtml, "utf8")
  : "";
const reviewEntrypointHealthAudit = readJson(refresh.paths.reviewEntrypointHealthAudit);
const reviewEntrypointHealthAuditHtml = readFileSync(refresh.paths.reviewEntrypointHealthAuditHtml, "utf8");
const effectiveVisualCheckQueue = refresh.discoveredEvidence?.lowTokenPreflightVisualCheckQueue || "";
const reusedOrGeneratedVisualCheckQueue =
  effectiveVisualCheckQueue === visualQueueFixturePath ||
  effectiveVisualCheckQueue === refresh.discoveredEvidence?.lowTokenPreflightVisualCheckQueueGenerated;
const executionReconciliationReviewRow = gapBoard.actionRows.find(
  (row) => row.id === "execution_reconciliation_teacher_review_missing"
);
const executionActionLogicSourceReviewRow = gapBoard.actionRows.find(
  (row) => row.id === "execution_action_logic_source_missing"
);
const spatialIntentGapRow = gapBoard.actionRows.find((row) => row.id === "spatial_spatial_intent_evidence_missing");

const mcpAdvanced = await callMcpTool(
  "create_original_goal_current_status_refresh",
  {
    goal: "Refresh current evidence through the MCP advanced tool.",
    software: "ExampleCAD",
    command: "Confirm one numbered target before any execution.",
    outputDir: join(smokeRoot, "mcp-advanced-refresh"),
    scanRoot: join(smokeRoot, "mcp-empty-scan-root")
  },
  { TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" }
);
const mcpAdvancedNames = mcpAdvanced.list.tools.map((tool) => tool.name);
const mcpAdvancedRefresh = readJson(mcpAdvanced.result.refreshPath);

const mcpDefault = await callMcpTool("teach_apprentice", {
  whatToTeach: "请刷新原目标当前状态，告诉我所有软件低 token 学习、透明草图、语音工程控制和监督执行现在做到哪一步。",
  message: "刷新原目标当前状态并给出下一步安全动作，不要注册任务、不要执行软件、不要写记忆。",
  software: "ExampleCAD",
  outputDir: join(smokeRoot, "mcp-default-refresh"),
  scanRoot: join(smokeRoot, "mcp-default-empty-scan-root")
});
const mcpDefaultCard = mcpDefault.result;

const checks = [
  {
    name: "Current status refresh regenerates readiness status board and command center",
    pass:
      result.format === "transparent_ai_original_goal_current_status_refresh_result_v1" &&
      refresh.format === "transparent_ai_original_goal_current_status_refresh_v1" &&
      readiness.format === "transparent_ai_original_goal_readiness_audit_v1" &&
      statusConsole.format === "transparent_ai_all_software_operational_status_console_v1" &&
      gapBoard.format === "transparent_ai_original_goal_gap_action_board_v1" &&
      commandCenter.format === "transparent_ai_goal_command_center_v1" &&
      triage.format === "transparent_ai_original_goal_next_action_triage_v1" &&
      rollbackPoint.format === "transparent_ai_rollback_point_v1" &&
      lowTokenOperationPreflight.format === "transparent_ai_low_token_operation_preflight_policy_v1" &&
      nonExpertVoiceControlCapability.format === "transparent_ai_non_expert_engineering_voice_control_capability_v1" &&
      spatialIntentEvidenceRequest.format === "transparent_ai_spatial_intent_evidence_request_v1" &&
      teacherActionRouterReceiptBuilder.format === "transparent_ai_original_goal_teacher_action_router_receipt_builder_v1" &&
      teacherActionRouterReceiptTemplate.format === "transparent_ai_original_goal_teacher_action_router_receipt_v1" &&
      operationalPostActivationWitnessReceiptBuilder.format ===
        "transparent_ai_all_software_operational_post_activation_witness_receipt_builder_v1" &&
      existsSync(result.readmePath) &&
      existsSync(result.dashboardPath) &&
      existsSync(refresh.paths.nextActionTriageHtml) &&
      existsSync(refresh.paths.lowTokenOperationPreflightPolicyHtml) &&
      refresh.paths.currentStatusDashboardHtml === result.dashboardPath,
    evidence: result.refreshPath
  },
  {
    name: "Current status refresh exposes original-goal next confirmation pack as the first teacher handoff",
    pass:
      originalGoalNextConfirmationPack.format === "transparent_ai_original_goal_next_confirmation_pack_v1" &&
      originalGoalNextConfirmationPack.status === "waiting_for_teacher_next_confirmation_review" &&
      originalGoalNextConfirmationPack.confirmationItems.length === 5 &&
      originalGoalNextConfirmationPack.counts.compactMetadataRows === 22 &&
      originalGoalNextConfirmationPack.counts.sensitiveManualRows === 3 &&
      originalGoalNextConfirmationPack.confirmationItems.some(
        (item) =>
          item.itemId === "low-token-manual-sensitive-3-rows" &&
          item.currentEvidence.manualRows.length === 3 &&
          item.currentEvidence.manualRows.some((row) => row.category === "chat_app") &&
          item.currentEvidence.manualRows.some((row) => row.recommendedRoute === "remote_control_security_boundary")
      ) &&
      originalGoalNextConfirmationPack.statusSnapshot.transparentSketch2DPerspective3DImplemented === true &&
      originalGoalNextConfirmationPack.statusSnapshot.compactEvidenceRunReady === false &&
      originalGoalNextConfirmationPack.locks.confirmationPackDoesNotReadFullLogs === true &&
      originalGoalNextConfirmationPack.locks.confirmationPackDoesNotCaptureScreenshots === true &&
      originalGoalNextConfirmationPack.locks.confirmationPackDoesNotExecuteTargetSoftware === true &&
      originalGoalNextConfirmationPack.locks.confirmationPackDoesNotRegisterSchedule === true &&
      originalGoalNextConfirmationPack.locks.confirmationPackDoesNotWriteMemory === true &&
      originalGoalNextConfirmationPack.locks.goalComplete === false &&
      originalGoalNextConfirmationPackReceiptTemplate.decision === "needs_teacher_review" &&
      originalGoalNextConfirmationPackReceiptTemplate.itemDecisions.length === 5 &&
      originalGoalNextConfirmationPackReceiptBuilder.format ===
        "transparent_ai_original_goal_next_confirmation_pack_receipt_builder_v1" &&
      originalGoalNextConfirmationPackReceiptBuilder.status ===
        "waiting_for_teacher_next_confirmation_pack_receipt" &&
      originalGoalNextConfirmationPackReceiptBuilder.counts.reviewRows === 5 &&
      originalGoalNextConfirmationPackReceiptBuilder.browserReceiptBuilder.generatesReceiptJsonInBrowser === true &&
      originalGoalNextConfirmationPackReceiptBuilder.locks.builderDoesNotReadFullLogs === true &&
      originalGoalNextConfirmationPackReceiptBuilder.locks.builderDoesNotExecuteTargetSoftware === true &&
      originalGoalNextConfirmationPackReceiptBuilder.locks.goalComplete === false &&
      originalGoalNextConfirmationPackReceiptBuilderTemplate.decision === "needs_teacher_review" &&
      originalGoalNextConfirmationPackReceiptBuilderTemplate.itemDecisions.length === 5 &&
      refresh.paths.originalGoalNextConfirmationPackHtml === originalGoalNextConfirmationPack.paths.html &&
      refresh.paths.originalGoalNextConfirmationPackReceiptBuilderHtml ===
        originalGoalNextConfirmationPackReceiptBuilder.paths.html &&
      refresh.refreshedEvidence.originalGoalNextConfirmationPackStatus ===
        "waiting_for_teacher_next_confirmation_review" &&
      refresh.refreshedEvidence.originalGoalNextConfirmationPackReceiptBuilderStatus ===
        "waiting_for_teacher_next_confirmation_pack_receipt" &&
      refresh.refreshedEvidence.originalGoalNextConfirmationPackReceiptBuilderRows === 5 &&
      refresh.refreshedEvidence.originalGoalNextConfirmationPackReceiptBuilderReviewOnly === true &&
      refresh.refreshedEvidence.originalGoalNextConfirmationPackItems === 5 &&
      refresh.refreshedEvidence.originalGoalNextConfirmationPackSensitiveManualRows === 3 &&
      refresh.refreshedEvidence.originalGoalNextConfirmationPackCompactMetadataRows === 22 &&
      refresh.refreshedEvidence.originalGoalNextConfirmationPackReviewOnly === true &&
      lowTokenCompactEvidenceTeacherLaunchpad.format ===
        "transparent_ai_original_goal_low_token_compact_evidence_teacher_launchpad_v1" &&
      lowTokenCompactEvidenceTeacherLaunchpad.status === "waiting_for_teacher_compact_evidence_receipt" &&
      lowTokenCompactEvidenceTeacherLaunchpad.counts.reviewRows === 22 &&
      Boolean(lowTokenCompactEvidenceTeacherLaunchpad.paths.rollbackPointManifest) &&
      Boolean(lowTokenCompactEvidenceTeacherLaunchpad.paths.rollbackPointCommandTemplate) &&
      lowTokenCompactEvidenceTeacherLaunchpad.nextSteps.some(
        (step) =>
          String(step.label || "").includes("rollback point") &&
          Array.isArray(step.requiredBefore) &&
          step.requiredBefore.includes("validation") &&
          step.requiredBefore.includes("compact-evidence-run")
      ) &&
      lowTokenCompactEvidenceTeacherLaunchpad.locks.launchpadDoesNotCreateRollbackPoint === true &&
      lowTokenCompactEvidenceTeacherLaunchpad.locks.rollbackPointCreatedByLaunchpad === false &&
      lowTokenCompactEvidenceTeacherLaunchpad.locks.launchpadDoesNotExecuteTargetSoftware === true &&
      lowTokenCompactEvidenceTeacherLaunchpad.locks.goalComplete === false &&
      refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadReady === true &&
      refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRows === 22 &&
      refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadDoesNotReadLogs === true &&
      refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadDoesNotExecuteTargetSoftware === true &&
      refresh.refreshedEvidence.originalGoalLowTokenCompactEvidenceTeacherLaunchpadRunRequiresRollback === true &&
      refresh.refreshedEvidence
        .originalGoalLowTokenCompactEvidenceTeacherLaunchpadRunRequiresRetainedRollbackManifestContract === true &&
      refresh.directReviewEntryPoints[0].id === "original_goal_next_confirmation_pack" &&
      refresh.directReviewEntryPoints.some(
        (entry) => entry.id === "original_goal_next_confirmation_pack_receipt_builder"
      ) &&
      refresh.directReviewEntryPoints.some(
        (entry) => entry.id === "original_goal_low_token_compact_evidence_teacher_launchpad"
      ) &&
      refresh.nextCommands[0].label ===
        "Open original-goal next confirmation pack before choosing any runner, screenshot, or execution lane" &&
      refresh.nextCommands.some(
        (entry) => entry.label === "Open original-goal next confirmation receipt builder after reviewing the pack"
      ) &&
      originalGoalNextConfirmationPackHtml.includes("Original Goal Next Confirmation Pack") &&
      originalGoalNextConfirmationPackReceiptBuilderHtml.includes(
        "Original Goal Next Confirmation Pack Receipt Builder"
      ) &&
      readme.includes("Original-goal next confirmation pack") &&
      readme.includes("Original-goal next confirmation receipt builder") &&
      dashboard.includes("Original-goal next confirmation pack"),
    evidence: refresh.paths.originalGoalNextConfirmationPackHtml
  },
  {
    name: "Current status refresh exposes original-goal proof ledger against the full objective",
    pass:
      originalGoalProofLedger.format === "transparent_ai_original_goal_proof_ledger_v1" &&
      originalGoalProofLedger.status === "objective_not_proven_complete" &&
      originalGoalProofLedger.completionAllowed === false &&
      originalGoalProofLedger.requirements.length === 4 &&
      originalGoalProofLedger.counts.nextTeacherConfirmationCount === 4 &&
      originalGoalProofLedger.requirements.some(
        (row) =>
          row.id === "all_software_low_token_learning" &&
          row.currentEvidence.compactMetadataRows === 22 &&
          row.currentEvidence.sensitiveManualRows === 3
      ) &&
      originalGoalProofLedger.requirements.some(
        (row) =>
          row.id === "transparent_mask_spatial_depth_understanding" &&
          row.nextTeacherConfirmation.itemId === "transparent-overlay-real-teacher-packet"
      ) &&
      originalGoalProofLedger.requirements.some(
        (row) =>
          row.id === "execute_in_target_software_after_confirmation" &&
          row.proofState === "not_proven_requires_teacher_confirmed_execution"
      ) &&
      originalGoalProofLedger.locks.ledgerDoesNotExecuteTargetSoftware === true &&
      originalGoalProofLedger.locks.goalComplete === false &&
      refresh.refreshedEvidence.originalGoalProofLedgerStatus === "objective_not_proven_complete" &&
      refresh.refreshedEvidence.originalGoalProofLedgerRequirementCount === 4 &&
      refresh.refreshedEvidence.originalGoalProofLedgerCompletionAllowed === false &&
      refresh.refreshedEvidence.originalGoalProofLedgerReviewOnly === true &&
      refresh.directReviewEntryPoints[1].id === "original_goal_proof_ledger" &&
      refresh.nextCommands[1].label ===
        "Open original-goal proof ledger to compare current evidence with the original objective" &&
      originalGoalProofLedgerHtml.includes("Original Goal Proof Ledger") &&
      readme.includes("Original-goal proof ledger") &&
      dashboard.includes("Original-goal proof ledger"),
    evidence: refresh.paths.originalGoalProofLedgerHtml
  },
  {
    name: "Current status refresh exposes original-goal proof gap closure pack",
    pass:
      originalGoalProofGapClosurePack.format === "transparent_ai_original_goal_proof_gap_closure_pack_v1" &&
      originalGoalProofGapClosurePack.status === "waiting_for_teacher_to_close_proof_gaps" &&
      originalGoalProofGapClosurePack.counts.closureRoutes >= 4 &&
      originalGoalProofGapClosurePack.closureRoutes.some(
        (row) => row.routeId === "unattended_monitor_audit_route"
      ) &&
      originalGoalProofGapClosurePack.closureRoutes.some(
        (row) => row.routeId === "current_teacher_method_receipt_route"
      ) &&
      originalGoalProofGapClosurePack.closureRoutes.some(
        (row) => row.routeId === "transparent_depth_rehearsal_receipt_route"
      ) &&
      originalGoalProofGapClosurePack.closureRoutes.some(
        (row) => row.routeId === "teacher_confirmed_execution_gate_route"
      ) &&
      originalGoalProofGapClosurePack.locks.packDoesNotRunCommands === true &&
      originalGoalProofGapClosurePack.locks.packDoesNotRegisterTask === true &&
      originalGoalProofGapClosurePack.locks.packDoesNotExecuteTargetSoftware === true &&
      originalGoalProofGapClosurePack.locks.goalComplete === false &&
      refresh.refreshedEvidence.originalGoalProofGapClosurePackReviewOnly === true &&
      refresh.directReviewEntryPoints[2].id === "original_goal_proof_gap_closure_pack" &&
      refresh.nextCommands[2].label ===
        "Open original-goal proof gap closure pack to map each missing proof item to the next teacher-reviewed route" &&
      originalGoalProofGapClosurePackHtml.includes("Original Goal Proof Gap Closure Pack") &&
      readme.includes("Original-goal proof gap closure pack") &&
      dashboard.includes("Original-goal proof gap closure pack"),
    evidence: refresh.paths.originalGoalProofGapClosurePackHtml
  },
  {
    name: "Current status refresh exposes original-goal proof gap teacher queue",
    pass:
      originalGoalProofGapTeacherQueue.format === "transparent_ai_original_goal_proof_gap_teacher_queue_v1" &&
      originalGoalProofGapTeacherQueue.status === "waiting_for_teacher_evidence_queue_receipt" &&
      originalGoalProofGapTeacherQueue.counts.queueItems >= 4 &&
      originalGoalProofGapTeacherQueue.counts.receiptRows === originalGoalProofGapTeacherQueue.counts.queueItems &&
      originalGoalProofGapTeacherQueue.queueItems.some(
        (item) => item.phase === "all_software_low_token_log_learning"
      ) &&
      originalGoalProofGapTeacherQueue.queueItems.some(
        (item) => item.phase === "adaptive_teacher_method"
      ) &&
      originalGoalProofGapTeacherQueue.queueItems.some(
        (item) => item.phase === "transparent_overlay_spatial_depth"
      ) &&
      originalGoalProofGapTeacherQueue.queueItems.some(
        (item) => item.phase === "teacher_confirmed_target_software_execution"
      ) &&
      originalGoalProofGapTeacherQueue.locks.queueDoesNotRunCommands === true &&
      originalGoalProofGapTeacherQueue.locks.queueDoesNotRegisterTask === true &&
      originalGoalProofGapTeacherQueue.locks.queueDoesNotExecuteTargetSoftware === true &&
      originalGoalProofGapTeacherQueue.locks.goalComplete === false &&
      originalGoalProofGapTeacherQueueReceiptTemplate.defaultDecision === "needs_teacher_evidence" &&
      originalGoalProofGapTeacherQueueReceiptTemplate.forbiddenDecisions.includes("accepted") &&
      originalGoalProofGapTeacherQueue.paths.receiptValidationCommandTemplate.includes(
        "validate-original-goal-proof-gap-teacher-queue-receipt.mjs"
      ) &&
      refresh.paths.originalGoalProofGapTeacherQueueReceiptValidationCommandTemplate.includes(
        "validate-original-goal-proof-gap-teacher-queue-receipt.mjs"
      ) &&
      refresh.paths.originalGoalProofGapValidationHandoffQueueCommandTemplate.includes(
        "create-original-goal-proof-gap-validation-handoff-queue.mjs"
      ) &&
      refresh.paths.originalGoalProofGapValidationHandoffQueueCommandTemplate.includes(
        "<original-goal-proof-gap-teacher-queue-receipt-validation.json>"
      ) &&
      refresh.refreshedEvidence.originalGoalProofGapTeacherQueueReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence.originalGoalProofGapValidationHandoffQueueCommandReady === true &&
      refresh.refreshedEvidence.originalGoalProofGapTeacherQueueReviewOnly === true &&
      originalGoalProofGapTeacherReviewCockpit.format ===
        "transparent_ai_original_goal_proof_gap_teacher_review_cockpit_v1" &&
      originalGoalProofGapTeacherReviewCockpit.status ===
        "waiting_for_teacher_to_review_candidates_and_fill_receipt" &&
      originalGoalProofGapTeacherReviewCockpit.counts.rows === originalGoalProofGapTeacherQueue.counts.queueItems &&
      originalGoalProofGapTeacherReviewCockpit.counts.rowsWithCandidateEvidence ===
        originalGoalProofGapEvidencePrefill.counts.rowsWithCandidateEvidence &&
      originalGoalProofGapTeacherReviewCockpit.counts.rowsStillNeedTeacherConfirmation ===
        originalGoalProofGapTeacherQueue.counts.queueItems &&
      originalGoalProofGapTeacherReviewCockpit.reviewOrder.length === 3 &&
      originalGoalProofGapTeacherReviewCockpit.reviewOrder[0].path ===
        refresh.paths.originalGoalProofGapEvidencePrefillHtml &&
      originalGoalProofGapTeacherReviewCockpit.reviewOrder[1].path ===
        refresh.paths.originalGoalProofGapTeacherQueueReceiptBuilderHtml &&
      originalGoalProofGapTeacherReviewCockpit.reviewOrder[2].command.includes(
        "validate-original-goal-proof-gap-teacher-queue-receipt.mjs"
      ) &&
      originalGoalProofGapTeacherReviewCockpit.locks.cockpitDoesNotFillReceipt === true &&
      originalGoalProofGapTeacherReviewCockpit.locks.cockpitDoesNotRunCommands === true &&
      originalGoalProofGapTeacherReviewCockpit.locks.cockpitDoesNotExecuteTargetSoftware === true &&
      originalGoalProofGapTeacherReviewCockpit.locks.goalComplete === false &&
      refresh.refreshedEvidence.originalGoalProofGapTeacherReviewCockpitRows ===
        originalGoalProofGapTeacherQueue.counts.queueItems &&
      refresh.refreshedEvidence.originalGoalProofGapTeacherReviewCockpitReviewOnly === true &&
      refresh.directReviewEntryPoints[3].id === "original_goal_proof_gap_teacher_review_cockpit" &&
      refresh.nextCommands[3].label ===
        "Open original-goal proof gap teacher review cockpit to review candidates, fill the receipt, and copy the validation command" &&
      refresh.directReviewEntryPoints[4].id === "original_goal_proof_gap_teacher_queue" &&
      refresh.nextCommands[4].label ===
        "Open original-goal proof gap teacher queue to collect the next teacher evidence receipt" &&
      originalGoalProofGapEvidencePrefill.format === "transparent_ai_original_goal_proof_gap_evidence_prefill_v1" &&
      originalGoalProofGapEvidencePrefill.status === "candidate_only_waiting_for_teacher_review" &&
      originalGoalProofGapEvidencePrefill.counts.rows === originalGoalProofGapTeacherQueue.counts.queueItems &&
      originalGoalProofGapEvidencePrefill.counts.rowsWithCandidateEvidence >= 4 &&
      originalGoalProofGapEvidencePrefill.counts.rowsStillNeedTeacherConfirmation ===
        originalGoalProofGapTeacherQueue.counts.queueItems &&
      originalGoalProofGapEvidencePrefill.rows.every(
        (row) => row.draftReceiptRow.decision === "needs_teacher_evidence"
      ) &&
      originalGoalProofGapEvidencePrefillCandidateReceiptDraft.format ===
        "transparent_ai_original_goal_proof_gap_teacher_queue_candidate_receipt_draft_v1" &&
      originalGoalProofGapEvidencePrefillCandidateReceiptDraft.forbiddenDecisions.includes("accepted") &&
      originalGoalProofGapEvidencePrefill.locks.prefillDoesNotClaimEvidenceAccepted === true &&
      originalGoalProofGapEvidencePrefill.locks.prefillDoesNotRunCommands === true &&
      originalGoalProofGapEvidencePrefill.locks.prefillDoesNotExecuteTargetSoftware === true &&
      originalGoalProofGapEvidencePrefill.locks.goalComplete === false &&
      refresh.refreshedEvidence.originalGoalProofGapEvidencePrefillRows ===
        originalGoalProofGapTeacherQueue.counts.queueItems &&
      refresh.refreshedEvidence.originalGoalProofGapEvidencePrefillRowsStillNeedTeacherConfirmation ===
        originalGoalProofGapTeacherQueue.counts.queueItems &&
      refresh.refreshedEvidence.originalGoalProofGapEvidencePrefillReviewOnly === true &&
      refresh.directReviewEntryPoints[5].id === "original_goal_proof_gap_evidence_prefill" &&
      refresh.nextCommands[5].label ===
        "Open original-goal proof gap evidence prefill to review candidate evidence paths before filling the receipt" &&
      originalGoalProofGapTeacherQueueReceiptBuilder.format ===
        "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_builder_v1" &&
      originalGoalProofGapTeacherQueueReceiptBuilder.status ===
        "waiting_for_teacher_to_fill_proof_gap_queue_receipt" &&
      originalGoalProofGapTeacherQueueReceiptBuilder.counts.reviewRows ===
        originalGoalProofGapTeacherQueue.counts.queueItems &&
      originalGoalProofGapTeacherQueueReceiptBuilder.browserReceiptBuilder.generatesReceiptJsonInBrowser === true &&
      originalGoalProofGapTeacherQueueReceiptBuilder.browserReceiptBuilder.doesNotWriteReceiptToDisk === true &&
      originalGoalProofGapTeacherQueueReceiptBuilder.locks.builderDoesNotRunCommands === true &&
      originalGoalProofGapTeacherQueueReceiptBuilder.locks.builderDoesNotRegisterTask === true &&
      originalGoalProofGapTeacherQueueReceiptBuilder.locks.builderDoesNotExecuteTargetSoftware === true &&
      originalGoalProofGapTeacherQueueReceiptBuilder.locks.goalComplete === false &&
      refresh.refreshedEvidence.originalGoalProofGapTeacherQueueReceiptBuilderRows ===
        originalGoalProofGapTeacherQueue.counts.queueItems &&
      refresh.refreshedEvidence.originalGoalProofGapTeacherQueueReceiptBuilderReviewOnly === true &&
      refresh.directReviewEntryPoints[6].id === "original_goal_proof_gap_teacher_queue_receipt_builder" &&
      refresh.nextCommands[6].label ===
        "Open original-goal proof gap teacher queue receipt builder to generate teacher-filled receipt JSON" &&
      refresh.nextCommands[7].label ===
        "After validating the teacher-filled proof gap receipt, create the review-only validation handoff queue" &&
      refresh.nextCommands[7].command.includes("create-original-goal-proof-gap-validation-handoff-queue.mjs") &&
      refresh.refreshedEvidence.statusLanes.some(
        (row) =>
          row.id === "status_lane_original_goal_proof_gap_validation_handoff_queue" &&
          row.status === "waiting_for_teacher_receipt_validation_result"
      ) &&
      originalGoalProofGapTeacherQueueHtml.includes("Original Goal Proof Gap Teacher Queue") &&
      originalGoalProofGapTeacherReviewCockpitHtml.includes(
        "Original Goal Proof Gap Teacher Review Cockpit"
      ) &&
      originalGoalProofGapEvidencePrefillHtml.includes("Original Goal Proof Gap Evidence Prefill") &&
      originalGoalProofGapTeacherQueueReceiptBuilderHtml.includes(
        "Original Goal Proof Gap Teacher Queue Receipt Builder"
      ) &&
      readme.includes("Original-goal proof gap teacher queue") &&
      readme.includes("Original-goal proof gap teacher review cockpit") &&
      readme.includes("Original-goal proof gap evidence prefill") &&
      readme.includes("Original-goal proof gap teacher queue receipt builder") &&
      readme.includes("Original-goal proof gap validation handoff queue command") &&
      dashboard.includes("Original-goal proof gap teacher queue"),
    evidence: refresh.paths.originalGoalProofGapTeacherQueueHtml
  },
  {
    name: "Current status refresh exposes teacher method contract receipt gate",
    pass:
      teacherMethodExecutionLearningContractReceiptBuilder.format ===
        "transparent_ai_teacher_method_execution_learning_contract_receipt_builder_v1" &&
      teacherMethodExecutionLearningContractReceiptBuilder.status ===
        "waiting_for_teacher_method_contract_receipt" &&
      teacherMethodExecutionLearningContractReceiptBuilder.counts.routeRows >= 4 &&
      teacherMethodExecutionLearningContractReceiptBuilder.nextValidationCommand.includes(
        "validate-teacher-method-execution-learning-contract-receipt.mjs"
      ) &&
      teacherMethodExecutionLearningContractReceiptTemplate.format ===
        "transparent_ai_teacher_method_execution_learning_contract_receipt_v1" &&
      teacherMethodExecutionLearningContractReceiptTemplate.teacherDecision === "needs_teacher_review" &&
      teacherMethodExecutionLearningContractReceiptTemplate.forbiddenTeacherDecisions.includes("accepted") &&
      teacherMethodExecutionLearningContractReceiptTemplate.routeRows.length ===
        teacherMethodExecutionLearningContractReceiptBuilder.counts.routeRows &&
      teacherMethodExecutionLearningContractReceiptBuilder.locks.builderDoesNotRunCommands === true &&
      teacherMethodExecutionLearningContractReceiptBuilder.locks.builderDoesNotExecuteTargetSoftware === true &&
      teacherMethodExecutionLearningContractReceiptBuilder.locks.builderDoesNotWriteMemory === true &&
      teacherMethodExecutionLearningContractReceiptBuilder.locks.goalComplete === false &&
      refresh.refreshedEvidence.teacherMethodExecutionLearningContractReceiptBuilderReady === true &&
      refresh.refreshedEvidence.teacherMethodExecutionLearningContractReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence.teacherMethodExecutionLearningContractReceiptBuilderReviewOnly === true &&
      refresh.paths.teacherMethodExecutionLearningContractReceiptValidationCommandTemplate.includes(
        "<teacher-filled-teacher-method-execution-learning-contract-receipt.json>"
      ) &&
      refresh.directReviewEntryPoints.some(
        (link) =>
          link.id === "teacher_method_execution_learning_contract_receipt_builder" &&
          link.path === refresh.paths.teacherMethodExecutionLearningContractReceiptBuilderHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("teacher method execution-learning contract receipt builder") &&
          row.command === refresh.paths.teacherMethodExecutionLearningContractReceiptBuilderHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher-filled teacher method execution-learning contract receipt") &&
          row.command.includes("validate-teacher-method-execution-learning-contract-receipt.mjs")
      ) &&
      teacherMethodExecutionLearningContractReceiptBuilderHtml.includes(
        "Teacher Method Contract Receipt Builder"
      ) &&
      readme.includes("Teacher method execution-learning contract receipt builder") &&
      dashboard.includes("Teacher method contract receipt builder"),
    evidence: refresh.paths.teacherMethodExecutionLearningContractReceiptBuilderHtml
  },
  {
    name: "Current status refresh exposes teacher method reuse result proof gate",
    pass:
      teacherMethodReuseResultProofBuilder.format === "transparent_ai_teacher_method_reuse_result_proof_builder_v1" &&
      [
        "waiting_for_confirmed_teacher_method_contract_receipt_validation",
        "waiting_for_teacher_reuse_result_proof_receipt"
      ].includes(teacherMethodReuseResultProofBuilder.status) &&
      teacherMethodReuseResultProofBuilder.nextValidationCommand.includes(
        "validate-teacher-method-reuse-result-proof-receipt.mjs"
      ) &&
      teacherMethodReuseResultProofReceiptTemplate.format ===
        "transparent_ai_teacher_method_reuse_result_proof_receipt_v1" &&
      teacherMethodReuseResultProofReceiptTemplate.teacherDecision === "needs_teacher_review" &&
      teacherMethodReuseResultProofReceiptTemplate.forbiddenTeacherDecisions.includes("accepted") &&
      teacherMethodReuseResultProofReceiptTemplate.evidenceRows.length >= 4 &&
      teacherMethodReuseResultProofBuilder.locks.builderDoesNotRunCommands === true &&
      teacherMethodReuseResultProofBuilder.locks.builderDoesNotExecuteTargetSoftware === true &&
      teacherMethodReuseResultProofBuilder.locks.builderDoesNotWriteMemory === true &&
      teacherMethodReuseResultProofBuilder.locks.goalComplete === false &&
      refresh.refreshedEvidence.teacherMethodReuseResultProofBuilderReady === true &&
      refresh.refreshedEvidence.teacherMethodReuseResultProofValidationCommandReady === true &&
      refresh.refreshedEvidence.teacherMethodReuseResultProofBuilderReviewOnly === true &&
      refresh.paths.teacherMethodReuseResultProofValidationCommandTemplate.includes(
        "<teacher-filled-teacher-method-reuse-result-proof-receipt.json>"
      ) &&
      refresh.directReviewEntryPoints.some(
        (link) =>
          link.id === "teacher_method_reuse_result_proof_builder" &&
          link.path === refresh.paths.teacherMethodReuseResultProofBuilderHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("teacher method reuse result proof builder") &&
          row.command === refresh.paths.teacherMethodReuseResultProofBuilderHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher-filled teacher method reuse result proof receipt") &&
          row.command.includes("validate-teacher-method-reuse-result-proof-receipt.mjs")
      ) &&
      teacherMethodReuseResultProofBuilderHtml.includes("Teacher Method Reuse Result Proof") &&
      readme.includes("Teacher method reuse result proof builder") &&
      dashboard.includes("Teacher method reuse result proof builder"),
    evidence: refresh.paths.teacherMethodReuseResultProofBuilderHtml
  },
  {
    name: "Current status refresh surfaces knowledge-augmented low-token learning evidence line",
    pass:
      refresh.paths.knowledgeAugmentedLowTokenLearningSmokeCommandTemplate ===
        "npm.cmd run smoke:plugin-knowledge-augmented-low-token-learning" &&
      refresh.refreshedEvidence.knowledgeAugmentedLowTokenLearningStatus ===
        "available_review_only_rag_evidence_layer_for_compact_low_token_events" &&
      refresh.refreshedEvidence.knowledgeAugmentedLowTokenLearningSmokeCommandReady === true &&
      refresh.paths.knowledgeCorpusIngestCommandTemplate.includes("knowledge\\ingest-local-corpus.mjs") &&
      refresh.paths.knowledgeCorpusIngestCommandTemplate.includes(
        "<teacher-approved-manuals-standards-docs-folder-or-file>"
      ) &&
      refresh.paths.knowledgeAugmentedLowTokenLearningCommandTemplate.includes(
        "knowledge\\augment-low-token-learning-with-retrieval.mjs"
      ) &&
      refresh.paths.knowledgeAugmentedLowTokenLearningCommandTemplate.includes("--corpus-index") &&
      refresh.paths.knowledgeAugmentedLowTokenLearningCommandTemplate.includes("--learning-cycle") &&
      refresh.refreshedEvidence.knowledgeCorpusIngestCommandReady === true &&
      refresh.refreshedEvidence.knowledgeAugmentedLowTokenLearningCommandReady === true &&
      refresh.refreshedEvidence.knowledgeAugmentedLowTokenLearningRejectsSmokeAsFinalGoalEvidence === true &&
      refresh.paths.ragResearchIntakeQueue.endsWith("rag-research-intake-queue.json") &&
      refresh.paths.ragResearchIntakeReceiptBuilder.endsWith("rag-research-intake-receipt-builder.json") &&
      refresh.paths.ragResearchIntakeReceiptTemplate.endsWith("rag-research-intake-receipt-template.json") &&
      refresh.paths.ragResearchIntakeReceiptValidationCommandTemplate.includes(
        "knowledge\\validate-rag-research-intake-receipt.mjs"
      ) &&
      refresh.paths.ragConfirmedSourceRegistryCommandTemplate.includes(
        "knowledge\\create-rag-confirmed-source-registry-package.mjs"
      ) &&
      refresh.paths.ragConfirmedLocalIngestRunnerCommandTemplate.includes(
        "knowledge\\run-rag-confirmed-local-ingest.mjs"
      ) &&
      refresh.paths.knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate.includes(
        "knowledge\\create-knowledge-augmented-low-token-learning-from-confirmed-ingest.mjs"
      ) &&
      refresh.paths.knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate.includes(
        "<teacher-reviewed-rag-confirmed-local-ingest-run.json>"
      ) &&
      refresh.paths.knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate.includes("--teacher-reviewed") &&
      refresh.paths.knowledgeAugmentedLowTokenFromConfirmedIngestCommandTemplate.includes("<retained-rollback-point-dir>") &&
      refresh.refreshedEvidence.ragResearchIntakeQueueReady === true &&
      refresh.refreshedEvidence.ragResearchIntakeReceiptBuilderReady === true &&
      refresh.refreshedEvidence.ragResearchIntakeReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence.ragConfirmedSourceRegistryCommandReady === true &&
      refresh.refreshedEvidence.ragConfirmedLocalIngestRunnerCommandReady === true &&
      refresh.refreshedEvidence.knowledgeAugmentedLowTokenFromConfirmedIngestCommandReady === true &&
      refresh.refreshedEvidence.knowledgeAugmentedLowTokenFromConfirmedIngestRequiresTeacherReviewedRun === true &&
      refresh.refreshedEvidence.knowledgeAugmentedLowTokenFromConfirmedIngestKeepsExecutionLocked === true &&
      refresh.refreshedEvidence.ragTeacherSourceIntakeReviewOnly === true &&
      refresh.refreshedEvidence.ragTeacherSourceIntakeBlocksUnverifiedCitations === true &&
      refresh.directReviewEntryPoints.some((entry) => entry.id === "rag_teacher_source_intake_queue") &&
      refresh.directReviewEntryPoints.some((entry) => entry.id === "rag_teacher_source_intake_receipt_builder") &&
      refresh.nextCommands.some(
        (row) => row.label === "Open RAG teacher source intake queue before building the knowledge corpus"
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label === "Inspect confirmed local RAG ingest runner template before any teacher-approved ingest" &&
          row.command === refresh.paths.ragResearchIntakeReceiptBuilderReadme
      ) &&
      refresh.refreshedEvidence.knowledgeAugmentedLowTokenLearningRulesEnabled === 0 &&
      refresh.refreshedEvidence.knowledgeAugmentedLowTokenLearningExecutesSoftware === false &&
      refresh.refreshedEvidence.knowledgeAugmentedLowTokenLearningReadsFullLogs === false &&
      refresh.refreshedEvidence.knowledgeAugmentedLowTokenLearningCapturesScreenshots === false &&
      refresh.nextCommands.some(
        (row) =>
          row.label === "Run knowledge-augmented low-token learning smoke before treating RAG as goal evidence" &&
          row.command === "npm.cmd run smoke:plugin-knowledge-augmented-low-token-learning"
      ) &&
      readme.includes("Knowledge-augmented low-token learning evidence status") &&
      readme.includes("Knowledge corpus ingest command for real teacher-approved sources") &&
      readme.includes("Knowledge-augmented low-token learning command for real compact events") &&
      readme.includes("RAG teacher source intake queue") &&
      readme.includes("RAG confirmed local ingest runner command") &&
      readme.includes("Knowledge-augmented low-token packet from confirmed ingest command") &&
      readme.includes("available_review_only_rag_evidence_layer_for_compact_low_token_events") &&
      dashboard.includes("Knowledge-augmented low-token learning") &&
      dashboard.includes("Real knowledge corpus ingest command") &&
      dashboard.includes("Real low-token RAG augmentation command") &&
      dashboard.includes("RAG teacher source intake queue") &&
      dashboard.includes("RAG confirmed source registry/local ingest") &&
      dashboard.includes("Confirmed RAG ingest to knowledge-augmented low-token packet") &&
      dashboard.includes("smoke:plugin-knowledge-augmented-low-token-learning"),
    evidence: refresh.paths.knowledgeAugmentedLowTokenLearningSmokeCommandTemplate
  },
  {
    name: "Current status refresh surfaces TLCL RAG evidence to high-reasoning repair chain audit",
    pass:
      refresh.paths.tlclRagEvidenceToHighReasoningRepairChainAuditCommandTemplate ===
        "npm.cmd run smoke:plugin-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit" &&
      refresh.discoveredEvidence.tlclRagEvidenceToHighReasoningRepairChainAuditCommandTemplate ===
        refresh.paths.tlclRagEvidenceToHighReasoningRepairChainAuditCommandTemplate &&
      refresh.refreshedEvidence.tlclRagEvidenceToHighReasoningRepairChainAuditStatus ===
        "available_review_only_audit_for_rag_evidence_to_high_reasoning_repair_chain" &&
      refresh.refreshedEvidence.tlclRagEvidenceToHighReasoningRepairChainAuditCommandReady === true &&
      refresh.refreshedEvidence.tlclRagEvidenceToHighReasoningRepairChainAuditReviewOnly === true &&
      refresh.refreshedEvidence.tlclRagEvidenceToHighReasoningRepairChainAuditExecutesSoftware === false &&
      refresh.refreshedEvidence.tlclRagEvidenceToHighReasoningRepairChainAuditUsesRagAsAuthority === false &&
      refresh.refreshedEvidence.tlclRagEvidenceToHighReasoningRepairChainAuditMediumRuntimeContinuationBlockedUntilReview ===
        true &&
      refresh.refreshedEvidence.statusLanes.some(
        (lane) =>
          lane.id === "status_lane_tlcl_rag_evidence_to_high_reasoning_repair_chain_audit" &&
          lane.status === "available_review_only" &&
          lane.detail.includes("RAG evidence remains non-authoritative")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label ===
            "Run TLCL RAG evidence to high-reasoning repair chain audit before treating retrieved knowledge as repair evidence" &&
          row.command === "npm.cmd run smoke:plugin-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit"
      ) &&
      readme.includes("TLCL RAG evidence to high-reasoning repair chain audit command") &&
      readme.includes("available_review_only_audit_for_rag_evidence_to_high_reasoning_repair_chain") &&
      dashboard.includes("TLCL RAG evidence to high-reasoning repair chain audit") &&
      dashboard.includes("smoke:plugin-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit"),
    evidence: refresh.paths.tlclRagEvidenceToHighReasoningRepairChainAuditCommandTemplate
  },
  {
    name: "Current status refresh wires final completion gate to Rule DSL delivery-gate audit evidence",
    pass:
      refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes(
        "validate-original-goal-final-completion-gate.mjs"
      ) &&
      refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes("--completion-blocker-matrix") &&
      refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes(
        refresh.paths.originalGoalLowTokenCoverageCompletionGate
      ) &&
      refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes(
        refresh.paths.allSoftwareUnattendedLearningAudit
      ) &&
      refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes(
        refresh.paths.sketchDemonstrationImplementationAudit
      ) &&
      refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes(
        refresh.paths.spatialIntentEvidenceReceiptValidation
      ) &&
      refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes(refresh.paths.executionConvergence) &&
      refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes("--rule-dsl-delivery-gate-audit") &&
      refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes("<rag-delivery-gate-audit-trail.json>") &&
      !refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes(
        "<original-goal-low-token-coverage-completion-gate.json>"
      ) &&
      !refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes(
        "<all-software-unattended-learning-audit.json>"
      ) &&
      !refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes(
        "<sketch-demonstration-implementation-audit.json>"
      ) &&
      !refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes(
        "<spatial-intent-evidence-receipt-validation.json>"
      ) &&
      !refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes(
        "<all-software-execution-capability-convergence-audit.json>"
      ) &&
      refresh.paths.originalGoalFinalCompletionGateCommandTemplate.includes(
        "<original-goal-final-teacher-acceptance-receipt-validation.json>"
      ) &&
      refresh.refreshedEvidence.originalGoalFinalCompletionGateCommandReady === true &&
      refresh.refreshedEvidence.ruleDslDeliveryGateAuditReady === false &&
      refresh.refreshedEvidence.ruleDslDeliveryGateAuditStatus === "missing_rule_dsl_delivery_gate_audit_trail" &&
      refresh.discoveredEvidence.originalGoalFinalCompletionGateCommandTemplate ===
        refresh.paths.originalGoalFinalCompletionGateCommandTemplate &&
      refresh.nextCommands.some(
        (row) =>
          row.label ===
            "Run final completion gate only after all evidence chains, including Rule DSL delivery-gate audit, are ready" &&
          row.command === refresh.paths.originalGoalFinalCompletionGateCommandTemplate
      ) &&
      readme.includes("Original-goal final completion gate command") &&
      readme.includes("Original-goal final completion Rule DSL delivery-gate audit evidence") &&
      dashboard.includes("Final completion gate command") &&
      dashboard.includes("Final completion Rule DSL delivery-gate audit evidence"),
    evidence: refresh.paths.originalGoalFinalCompletionGateCommandTemplate
  },
  {
    name: "Current status refresh routes existing Rule DSL delivery-gate audit to teacher review receipt",
    pass:
      readyRuleDslAuditRefresh.paths.ruleDslDeliveryGateAudit === readyRuleDslAuditFixturePath &&
      readyRuleDslAuditRefresh.discoveredEvidence?.ruleDslDeliveryGateAudit === readyRuleDslAuditFixturePath &&
      readyRuleDslAuditRefresh.refreshedEvidence?.ruleDslDeliveryGateAuditReady === true &&
      readyRuleDslAuditRefresh.refreshedEvidence?.ruleDslDeliveryGateAuditStatus ===
        "audit_trail_ready_for_teacher_review" &&
      readyRuleDslAuditRefresh.paths.ruleDslDeliveryGateAuditReviewReceiptBuilder === readyRuleDslAuditReviewBuilderPath &&
      readyRuleDslAuditRefresh.paths.ruleDslDeliveryGateAuditReviewReceiptBuilderHtml ===
        readyRuleDslAuditReviewWorkbenchHtmlPath &&
      readyRuleDslAuditRefresh.paths.ruleDslDeliveryGateAuditReviewReceiptTemplate ===
        readyRuleDslAuditReviewTemplatePath &&
      readyRuleDslAuditRefresh.paths.ruleDslDeliveryGateAuditReviewReceiptValidationCommandTemplate.includes(
        "validate-rag-delivery-gate-audit-review-receipt.mjs"
      ) &&
      readyRuleDslAuditRefresh.paths.ruleDslDeliveryGateAuditReviewReceiptValidation ===
        readyRuleDslAuditReviewValidationPath &&
      readyRuleDslAuditRefresh.discoveredEvidence?.ruleDslDeliveryGateAuditReviewReceiptValidation ===
        readyRuleDslAuditReviewValidationPath &&
      readyRuleDslAuditRefresh.refreshedEvidence?.ruleDslDeliveryGateAuditReviewReceiptValidationStatus ===
        "waiting_for_teacher_review" &&
      readyRuleDslAuditRefresh.refreshedEvidence
        ?.ruleDslDeliveryGateAuditReviewReceiptValidationWaitingForTeacher === true &&
      readyRuleDslAuditRefresh.refreshedEvidence
        ?.ruleDslDeliveryGateAuditReviewReceiptValidationReadyForFollowUpQueue === false &&
      readyRuleDslAuditRefresh.refreshedEvidence?.ruleDslDeliveryGateAuditReviewReceiptBuilderReady === true &&
      readyRuleDslAuditRefresh.refreshedEvidence?.ruleDslDeliveryGateAuditReviewReceiptTemplateReady === true &&
      readyRuleDslAuditRefresh.refreshedEvidence?.ruleDslDeliveryGateAuditReviewReceiptValidationCommandReady === true &&
      readyRuleDslAuditRefresh.directReviewEntryPoints.some(
        (row) =>
          row.id === "rule_dsl_delivery_gate_audit_review_receipt_builder" &&
          row.path === readyRuleDslAuditReviewWorkbenchHtmlPath
      ) &&
      readyRuleDslAuditRefresh.nextCommands.some(
        (row) =>
          row.label === "Open Rule DSL delivery-gate audit review receipt workbench" &&
          row.command === readyRuleDslAuditReviewWorkbenchHtmlPath
      ) &&
      readyRuleDslAuditQueueItem?.status === "ready_for_review_only_manual_follow_up" &&
      readyRuleDslAuditQueueItem?.commandTemplate.includes(
        "knowledge\\create-rag-delivery-gate-audit-review-receipt-builder.mjs"
      ) &&
      readyRuleDslAuditQueueItem?.commandTemplate.includes(readyRuleDslAuditFixturePath) &&
      !readyRuleDslAuditQueueItem?.commandTemplate.includes("<rag-validation-report-delivery-gate.json>") &&
      !readyRuleDslAuditQueueItem?.commandTemplate.includes("<retained-rollback-point-dir>") &&
      readyRuleDslAuditLaneItem?.commandTemplate.includes(
        "knowledge\\create-rag-delivery-gate-audit-review-receipt-builder.mjs"
      ) &&
      readyRuleDslAuditLaneItem?.commandTemplate.includes(readyRuleDslAuditFixturePath),
    evidence: readyRuleDslAuditQueueItem?.commandTemplate ?? "missing ready Rule DSL audit queue item"
  },
  {
    name: "Current status refresh surfaces original-goal capability matrix coverage audit",
    pass:
      existsSync(refresh.paths.originalGoalCapabilityMatrixCoverageAudit) &&
      existsSync(refresh.paths.originalGoalCapabilityMatrixCoverageAuditHtml) &&
      originalGoalCapabilityMatrixCoverageAudit.smoke ===
        "transparent_ai_original_goal_capability_matrix_coverage_audit_smoke_v1" &&
      originalGoalCapabilityMatrixCoverageAuditHtml.includes("Original Goal Capability Matrix Coverage Audit") &&
      originalGoalCapabilityMatrixCoverageAuditHtml.includes("knowledge_augmented_rag") &&
      originalGoalCapabilityMatrixCoverageAuditHtml.includes("voice_text_numbered_engineering_control") &&
      originalGoalCapabilityMatrixCoverageAuditHtml.includes("This page is for teacher review only") &&
      originalGoalCapabilityMatrixCoverageAudit.ok === true &&
      originalGoalCapabilityMatrixCoverageAudit.capabilityCount === 7 &&
      originalGoalCapabilityMatrixCoverageAudit.coveredCapabilityIds.includes("knowledge_augmented_rag") &&
      originalGoalCapabilityMatrixCoverageAudit.coveredCapabilityIds.includes("low_token_visual_escalation") &&
      originalGoalCapabilityMatrixCoverageAudit.coveredCapabilityIds.includes("voice_text_numbered_engineering_control") &&
      originalGoalCapabilityMatrixCoverageAudit.coveredCapabilityIds.includes("spatial_numbered_target_confirmation") &&
      originalGoalCapabilityMatrixCoverageAudit.coveredCapabilityIds.includes("universal_detail_logic") &&
      originalGoalCapabilityMatrixCoverageAudit.coveredCapabilityIds.includes("existing_tool_first_feasibility") &&
      originalGoalCapabilityMatrixCoverageAudit.coveredCapabilityIds.includes("rollback_and_approval_safety") &&
      originalGoalCapabilityMatrixCoverageAudit.missingCapabilityIds.length === 0 &&
      originalGoalCapabilityMatrixCoverageAudit.locks.softwareActionsExecuted === false &&
      originalGoalCapabilityMatrixCoverageAudit.locks.memoryWritten === false &&
      originalGoalCapabilityMatrixCoverageAudit.locks.packagingUnlocked === false &&
      refresh.paths.originalGoalCapabilityMatrixCoverageAuditCommandTemplate ===
        "npm.cmd run smoke:plugin-original-goal-capability-matrix-coverage-audit" &&
      refresh.refreshedEvidence.originalGoalCapabilityMatrixCoverageStatus ===
        "covered_review_only_capability_matrix" &&
      refresh.refreshedEvidence.originalGoalCapabilityMatrixTotalCapabilities === 7 &&
      refresh.refreshedEvidence.originalGoalCapabilityMatrixCoveredCapabilities === 7 &&
      refresh.refreshedEvidence.originalGoalCapabilityMatrixMissingCapabilityIds.length === 0 &&
      refresh.refreshedEvidence.originalGoalCapabilityMatrixReviewOnly === true &&
      refresh.refreshedEvidence.originalGoalCapabilityMatrixExecutesSoftware === false &&
      refresh.refreshedEvidence.originalGoalCapabilityMatrixWritesMemory === false &&
      refresh.refreshedEvidence.originalGoalCapabilityMatrixUnlocksPackaging === false &&
      refresh.refreshedEvidence.statusLanes.some(
        (lane) =>
          lane.id === "status_lane_original_goal_capability_matrix_coverage" &&
          lane.status === "covered_review_only"
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label === "Open original-goal capability matrix coverage audit" &&
          row.command === refresh.paths.originalGoalCapabilityMatrixCoverageAuditHtml
      ) &&
      refresh.directReviewEntryPoints.some(
        (entry) =>
          entry.id === "original_goal_capability_matrix_coverage_audit" &&
          entry.path === refresh.paths.originalGoalCapabilityMatrixCoverageAuditHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label === "Rerun original-goal capability matrix coverage audit" &&
          row.command === "npm.cmd run smoke:plugin-original-goal-capability-matrix-coverage-audit"
      ) &&
      readme.includes("Original-goal capability matrix coverage status") &&
      readme.includes("covered_review_only_capability_matrix") &&
      dashboard.includes("Original-goal capability matrix coverage") &&
      dashboard.includes("smoke:plugin-original-goal-capability-matrix-coverage-audit"),
    evidence: refresh.paths.originalGoalCapabilityMatrixCoverageAuditHtml
  },
  {
    name: "Current status refresh adds adviser RAG research direction to the knowledge-augmented spatial bridge",
    pass:
      existsSync(refresh.paths.knowledgeAugmentedSpatialExecutionBridgeCommandReview) &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.format ===
        "transparent_ai_knowledge_augmented_spatial_execution_bridge_command_review_v1" &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.adviserSuggestionExtract?.addedToGoal === true &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.adviserSuggestionExtract?.extractedDirection?.includes(
        "use RAG as an external knowledge-base retriever for the large model"
      ) &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.commandTemplate.includes(
        "create-knowledge-augmented-spatial-execution-bridge.mjs"
      ) &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.smokeCommandTemplate ===
        "npm.cmd run smoke:plugin-knowledge-augmented-spatial-execution-bridge" &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.realInputCommandTemplates?.ingestTeacherApprovedCorpus.includes(
        "knowledge\\ingest-local-corpus.mjs"
      ) &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.realInputCommandTemplates?.augmentRealLowTokenLearningWithRetrieval.includes(
        "knowledge\\augment-low-token-learning-with-retrieval.mjs"
      ) &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.missingInputs.includes(
        "teacher_reviewed_knowledge_augmented_low_token_learning_packet"
      ) &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.evidenceBoundary?.smokeEvidenceIsNeverFinalGoalProof === true &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.evidenceBoundary
        ?.syntheticSmokeKnowledgePacketMayNotSatisfyOriginalGoal === true &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.locks?.reviewOnly === true &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.locks?.accepted === false &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.locks?.ruleEnabled === false &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.locks?.packagingGated === true &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.locks?.softwareActionsExecuted === false &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.locks?.fullLogRead === false &&
      knowledgeAugmentedSpatialExecutionBridgeCommandReview.locks?.screenshotsCaptured === false &&
      refresh.paths.knowledgeAugmentedSpatialExecutionBridgeSmokeCommandTemplate ===
        "npm.cmd run smoke:plugin-knowledge-augmented-spatial-execution-bridge" &&
      refresh.paths.knowledgeAugmentedSpatialExecutionBridgeCommandTemplate.includes(
        "create-knowledge-augmented-spatial-execution-bridge.mjs"
      ) &&
      refresh.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgeCommandReady === true &&
      refresh.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgeRealInputCommandsReady === true &&
      refresh.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgeRejectsSmokeAsFinalGoalEvidence === true &&
      refresh.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgeMissingInputs.includes(
        "teacher_reviewed_knowledge_augmented_low_token_learning_packet"
      ) &&
      refresh.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgeExecutesSoftware === false &&
      refresh.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgeReadsFullLogs === false &&
      refresh.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgeCapturesScreenshots === false &&
      refresh.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgeRulesEnabled === 0 &&
      refresh.refreshedEvidence.knowledgeAugmentedSpatialExecutionBridgePackagingGated === true &&
      refresh.directReviewEntryPoints.some(
        (entry) =>
          entry.id === "knowledge_augmented_spatial_execution_bridge_command" &&
          entry.path === refresh.paths.knowledgeAugmentedSpatialExecutionBridgeCommandReview
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label ===
            "Run knowledge-augmented spatial execution bridge smoke before treating RAG plus sketch route as execution evidence" &&
          row.command === "npm.cmd run smoke:plugin-knowledge-augmented-spatial-execution-bridge"
      ) &&
      refresh.nextCommands.some((row) =>
        row.command.includes("create-knowledge-augmented-spatial-execution-bridge.mjs")
      ) &&
      readme.includes("Knowledge-augmented spatial execution bridge review packet") &&
      readme.includes("Knowledge-augmented spatial execution bridge missing inputs") &&
      dashboard.includes("Knowledge-augmented spatial execution bridge"),
    evidence: refresh.paths.knowledgeAugmentedSpatialExecutionBridgeCommandReview
  },
  {
    name: "Current status refresh surfaces all-software log source discovery ledger",
    pass:
      logSourceDiscoveryLedger.format === "transparent_ai_all_software_log_source_discovery_ledger_v1" &&
      refresh.paths.logSourceDiscoveryLedger === logSourceDiscoveryLedgerFixturePath &&
      refresh.paths.logSourceDiscoveryLedgerReadme === logSourceDiscoveryLedgerReadmeFixturePath &&
      refresh.paths.logSourceDiscoveryLedgerCommandTemplate.includes("create-all-software-log-source-discovery-ledger.mjs") &&
      refresh.refreshedEvidence.logSourceDiscoveryLedgerReady === true &&
      refresh.refreshedEvidence.logSourceDiscoveryStatus === "needs_teacher_log_source_review" &&
      refresh.refreshedEvidence.logSourceDiscoveryLedgerRows === 3 &&
      refresh.refreshedEvidence.logSourceDiscoveryMissingRows === 1 &&
      refresh.refreshedEvidence.logSourceDiscoveryNextReviewQueueCount === 1 &&
      refresh.refreshedEvidence.allSoftwareLogSourceDiscoveryComplete === false &&
      refresh.refreshedEvidence.logSourceDiscoveryReviewOnly === true &&
      refresh.discoveredEvidence.logSourceDiscoveryLedger === logSourceDiscoveryLedgerFixturePath &&
      statusConsole.operationalProof.logSourceDiscoveryLedgerReady === true &&
      statusConsole.operationalProof.allSoftwareLogSourceDiscoveryComplete === false &&
      statusConsole.lanes.some((lane) => lane.id === "log_source_discovery") &&
      refresh.directReviewEntryPoints.some((entry) => entry.id === "all_software_log_source_discovery_ledger") &&
      refresh.nextCommands.some(
        (row) =>
          row.label === "Open all-software log source discovery ledger before broad coverage claims" &&
          row.command === logSourceDiscoveryLedgerReadmeFixturePath
      ) &&
      readme.includes("All-software log source discovery ledger") &&
      readme.includes("needs_teacher_log_source_review") &&
      dashboard.includes("All-software log source discovery") &&
      dashboard.includes("missing source rows: 1"),
    evidence: refresh.paths.logSourceDiscoveryLedger
  },
  {
    name: "Current status refresh surfaces objective fulfillment low-token monitor bridge",
    pass:
      objectiveFulfillmentAudit.format === "transparent_ai_original_goal_objective_fulfillment_audit_v1" &&
      objectiveFulfillmentAudit.status === "objective_not_fulfilled_yet" &&
      objectiveFulfillmentAudit.completionAllowed === false &&
      objectiveFulfillmentNextStepQueue.format ===
        "transparent_ai_original_goal_objective_fulfillment_next_step_queue_v1" &&
      objectiveFulfillmentNextStepQueue.queueItems.some(
        (item) => item.requirementId === "all_software_low_token_learning"
      ) &&
      lowTokenMonitorCommandBridge.format === "transparent_ai_original_goal_low_token_monitor_command_bridge_v1" &&
      lowTokenMonitorCommandBridge.status === "low_token_monitor_command_bridge_ready_for_teacher_review" &&
      lowTokenMonitorCommandBridge.completionAllowed === false &&
      lowTokenMonitorCommandBridge.recommendedRouteOrder.some(
        (route) => route.routeId === "existing_recurring_monitor_teacher_confirmation"
      ) &&
      lowTokenMonitorCommandBridge.recommendedRouteOrder.some(
        (route) => route.routeId === "existing_recurring_monitor_registration_runner_template"
      ) &&
      lowTokenMonitorCommandBridge.recommendedRouteOrder.some(
        (route) => route.routeId === "existing_recurring_monitor_status_verifier"
      ) &&
      typeof lowTokenMonitorCommandBridge.recommendedTeacherRouteId === "string" &&
      typeof lowTokenMonitorCommandBridge.nextEvidenceAwareAction === "string" &&
      typeof lowTokenMonitorCommandBridge.evidenceContext?.coverageArtifactsReady === "boolean" &&
      typeof lowTokenMonitorCommandBridge.evidenceContext?.readinessPackageReady === "boolean" &&
      lowTokenMonitorCommandBridge.recommendedRouteOrder.some(
        (route) => route.routeId === "existing_low_token_coverage_review" && typeof route.routeStatus === "string"
      ) &&
      lowTokenMonitorCommandBridge.locks?.bridgeDoesNotRegisterTask === true &&
      lowTokenMonitorCommandBridge.locks?.bridgeDoesNotReadFullLogs === true &&
      lowTokenMonitorCommandBridge.locks?.bridgeDoesNotCaptureScreenshots === true &&
      lowTokenMonitorCommandBridge.locks?.bridgeDoesNotWriteMemory === true &&
      lowTokenMonitorBridgeReceiptBuilder.format ===
        "transparent_ai_original_goal_low_token_monitor_bridge_receipt_builder_v1" &&
      lowTokenMonitorBridgeReceiptBuilder.status === "waiting_for_teacher_low_token_monitor_bridge_receipt" &&
      lowTokenMonitorBridgeReceiptBuilder.routeRows.some(
        (route) =>
          route.id === "existing_recurring_monitor_teacher_confirmation" &&
          typeof route.routeStatus === "string" &&
          typeof route.evidenceAlreadyAvailable === "object"
      ) &&
      lowTokenMonitorBridgeReceiptBuilder.locks?.builderDoesNotRegisterTask === true &&
      lowTokenMonitorBridgeReceiptBuilder.locks?.builderDoesNotReadFullLogs === true &&
      lowTokenMonitorBridgeReceiptBuilder.locks?.builderDoesNotWriteMemory === true &&
      lowTokenMonitorBridgeReceiptTemplate.format ===
        "transparent_ai_original_goal_low_token_monitor_bridge_receipt_v1" &&
      lowTokenMonitorBridgeReceiptTemplate.teacherDecision === "needs_teacher_review" &&
      lowTokenMonitorBridgeReceiptTemplate.executeNow === false &&
      lowTokenMonitorBridgeReceiptTemplate.locks?.goalComplete === false &&
      refresh.refreshedEvidence?.originalGoalObjectiveFulfillmentAuditReady === true &&
      refresh.refreshedEvidence?.originalGoalObjectiveFulfillmentCompletionAllowed === false &&
      refresh.refreshedEvidence?.originalGoalObjectiveFulfillmentNextStepQueueReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorCommandBridgeReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorCommandBridgeRoutes >= 5 &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorEvidenceAwareRecommendedRoute ===
        lowTokenMonitorCommandBridge.recommendedTeacherRouteId &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorNextEvidenceAwareAction ===
        lowTokenMonitorCommandBridge.nextEvidenceAwareAction &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorCoverageArtifactsReady ===
        lowTokenMonitorCommandBridge.evidenceContext.coverageArtifactsReady &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorReadinessPackageReady ===
        lowTokenMonitorCommandBridge.evidenceContext.readinessPackageReady &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorLogSourceMissingRows ===
        lowTokenMonitorCommandBridge.evidenceContext.logSourceMissingRows &&
      typeof refresh.refreshedEvidence?.originalGoalLowTokenMonitorCoverageRouteStatus === "string" &&
      typeof refresh.refreshedEvidence?.originalGoalLowTokenMonitorTeacherConfirmationRouteStatus === "string" &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorCommandBridgeCompletionAllowed === false &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorCommandBridgeNoSystemChange === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorBridgeReceiptBuilderReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorBridgeReceiptBuilderRoutes >= 5 &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorBridgeReceiptBuilderNoSystemChange === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorBridgeReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandReady === true &&
      refresh.directReviewEntryPoints?.some(
        (entry) =>
          entry.id === "original_goal_low_token_monitor_command_bridge" &&
          entry.path === refresh.paths.originalGoalLowTokenMonitorCommandBridgeHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (entry) =>
          entry.id === "original_goal_low_token_monitor_bridge_receipt_builder" &&
          entry.path === refresh.paths.originalGoalLowTokenMonitorBridgeReceiptBuilderHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label === "Open low-token monitor command bridge before any recurring monitor registration" &&
          row.command === refresh.paths.originalGoalLowTokenMonitorCommandBridgeHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label === "Open low-token monitor bridge receipt builder so teacher can choose one low-token route" &&
          row.command === refresh.paths.originalGoalLowTokenMonitorBridgeReceiptBuilderHtml
      ) &&
      refresh.paths.originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate.includes(
        "validate-original-goal-low-token-monitor-bridge-receipt.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenMonitorBridgeReceiptValidationCommandTemplate.includes(
        "<teacher-filled-low-token-monitor-bridge-receipt.json>"
      ) &&
      refresh.paths.originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate.includes(
        "create-original-goal-low-token-monitor-selected-route-command-builder.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenMonitorSelectedRouteCommandBuilderCommandTemplate.includes(
        "<low-token-monitor-bridge-receipt-validation.json>"
      ) &&
      readme.includes("Original-goal low-token monitor command bridge:") &&
      readme.includes("Original-goal low-token monitor evidence-aware route:") &&
      readme.includes("Original-goal low-token monitor evidence-aware action:") &&
      readme.includes("Original-goal low-token monitor bridge receipt validation command:") &&
      dashboard.includes("Original-goal low-token monitor bridge") &&
      dashboard.includes("Original-goal low-token monitor next evidence-aware action") &&
      dashboard.includes("Original-goal low-token monitor bridge receipt builder"),
    evidence: refresh.paths.originalGoalLowTokenMonitorBridgeReceiptBuilderHtml
  },
  {
    name: "Current status refresh inherits log-source discovery ledger from real-local readiness package",
    pass:
      readinessFallbackLogSourceDiscoveryLedger.format === "transparent_ai_all_software_log_source_discovery_ledger_v1" &&
      readinessFallbackRefresh.paths.logSourceDiscoveryLedger === readinessFallbackLedgerPath &&
      readinessFallbackRefresh.paths.logSourceDiscoveryLedgerReadme === readinessFallbackLedgerReadmePath &&
      readinessFallbackRefresh.refreshedEvidence.logSourceDiscoveryLedgerReady === true &&
      readinessFallbackRefresh.refreshedEvidence.logSourceDiscoveryLedgerRows === 1 &&
      readinessFallbackRefresh.refreshedEvidence.logSourceDiscoveryMissingRows === 0 &&
      readinessFallbackRefresh.refreshedEvidence.allRowsHaveLogSourceRoute === true &&
      readinessFallbackRefresh.refreshedEvidence.allSoftwareLogSourceDiscoveryComplete === true &&
      readinessFallbackRefresh.refreshedEvidence.logSourceDiscoveryReviewOnly === true &&
      readinessFallbackRefresh.discoveredEvidence.realLocalAllSoftwareLowTokenReadinessPackage === readinessFallbackPackagePath &&
      readinessFallbackRefresh.discoveredEvidence.logSourceDiscoveryLedger === readinessFallbackLedgerPath &&
      readinessFallbackRefresh.nextCommands.some(
        (row) =>
          row.label === "Open all-software log source discovery ledger before broad coverage claims" &&
          row.command === readinessFallbackLedgerReadmePath
      ),
    evidence: readinessFallbackRefresh.paths.logSourceDiscoveryLedger
  },
  {
    name: "Current status refresh generates an integrated control flow entrypoint",
    pass:
      existsSync(refresh.paths.originalGoalIntegratedControlFlow) &&
      existsSync(refresh.paths.originalGoalIntegratedControlFlowHtml) &&
      existsSync(refresh.paths.originalGoalIntegratedControlFlowReadme) &&
      refresh.paths.originalGoalIntegratedControlFlowCommandTemplate?.includes(
        "create-original-goal-integrated-control-flow.mjs"
      ) &&
      refresh.paths.originalGoalIntegratedControlFlowCommandTemplate?.includes("--refresh") &&
      integratedControlFlow.format === "transparent_ai_original_goal_integrated_control_flow_v1" &&
      integratedControlFlow.paths.sourceRefresh === result.refreshPath &&
      integratedControlFlow.stages.length === 9 &&
      integratedControlFlow.stages.some((stage) => stage.id === "tlcl_rag_contract_repair_loop") &&
      integratedControlFlow.requirementCoverage.length === 10 &&
      integratedControlFlow.requirementCoverage.some((row) => row.requirement.includes("RAG is an external knowledge retriever")) &&
      integratedControlFlow.locks.reviewOnly === true &&
      integratedControlFlow.locks.integratedFlowDoesNotCaptureScreenshots === true &&
      integratedControlFlow.locks.integratedFlowDoesNotReadFullLogs === true &&
      integratedControlFlow.locks.integratedFlowDoesNotExecuteSoftware === true &&
      integratedControlFlow.locks.integratedFlowDoesNotSendUiEvents === true &&
      integratedControlFlow.locks.integratedFlowDoesNotWriteMemory === true &&
      integratedControlFlow.locks.goalComplete === false &&
      refresh.refreshedEvidence.originalGoalIntegratedControlFlowReviewOnly === true &&
      refresh.directReviewEntryPoints?.some((entry) => entry.id === "original_goal_integrated_control_flow") &&
      refresh.nextCommands?.some((entry) => entry.label === "Open original-goal integrated control flow before choosing the next lane") &&
      readme.includes("Original-goal integrated control flow:") &&
      dashboard.includes("Original-goal integrated control flow") &&
      integratedControlFlowHtml.includes("Requirement Coverage") &&
      integratedControlFlowHtml.includes("TLCL RAG evidence and high-reasoning contract repair loop") &&
      integratedControlFlowReadme.includes("Locked defaults"),
    evidence: refresh.paths.originalGoalIntegratedControlFlowHtml
  },
  {
    name: "Current status refresh keeps completion boundary honest",
    pass:
      refresh.completionDecision.includes("not_complete") &&
      refresh.blockedClaims.includes("claim_original_goal_complete_from_current_status_refresh") &&
      refresh.refreshedEvidence.statusLaneCount > 0 &&
      refresh.refreshedEvidence.nextActionTriageRows > 0 &&
      refresh.refreshedEvidence.lowTokenOperationPreflightBlockerCount >= 1 &&
      refresh.nextCommands.some((row) => row.command.includes("create-original-goal-current-status-refresh.mjs")) &&
      readme.includes("does not register scheduled tasks"),
    evidence: refresh.completionDecision
  },
  {
    name: "Current status refresh writes an ordered next-action triage for remaining blockers",
    pass:
      triage.status === "waiting_for_teacher_reviewed_next_action" &&
      triage.rows.length >= 3 &&
      triage.rows[0].reviewEntryId === "activation_receipt_builder" &&
      triage.rows[0].rollbackPointManifestPath === refresh.paths.rollbackPointManifest &&
      triage.rows[0].validationTool === "validate_all_software_operational_activation_review_receipt" &&
      triage.rows[0].validationCommand.includes("validate-all-software-operational-activation-review-receipt.mjs") &&
      triage.rows[0].validationCommand.includes("--packet") &&
      triage.rows[0].validationCommand.includes("--receipt") &&
      triage.rows[0].validationCommand.includes("<teacher-filled-operational-activation-review-receipt.json>") &&
      !triage.rows[0].validationCommand.includes("create-all-software-operational-learning-workbench.mjs") &&
      triage.rows.some(
        (row) =>
          row.reviewEntryId === "coverage_rollout_receipt_builder" &&
          row.validationTool === "validate_all_software_coverage_rollout_receipt" &&
          row.validationCommand.includes("validate-all-software-coverage-rollout-receipt.mjs") &&
          row.validationCommand.includes("--plan") &&
          row.validationCommand.includes("--receipt") &&
          row.validationCommand.includes("<teacher-filled-coverage-rollout-receipt.json>") &&
          !row.validationCommand.includes("all-software-coverage-rollout-receipt-builder.html")
      ) &&
      triage.rows.some(
        (row) =>
          row.id === "status_lane_automatic_learning_activation_path" &&
          row.reviewEntryId === "activation_receipt_builder" &&
          row.validationTool === "validate_all_software_operational_activation_review_receipt" &&
          row.validationCommand.includes("validate-all-software-operational-activation-review-receipt.mjs") &&
          row.validationCommand.includes("--packet") &&
          row.validationCommand.includes("--receipt") &&
          row.validationCommand.includes("<teacher-filled-operational-activation-review-receipt.json>") &&
          !row.validationCommand.startsWith("Review activation receipt validation")
      ) &&
      triage.rows.some(
        (row) =>
          row.id === "execution_action_logic_source_missing" &&
          row.reviewEntryId === "execution_gap_review_cockpit" &&
          row.openPath === refresh.paths.executionGapReviewCockpitHtml &&
          row.validationTool === "teacher_combined_execution_gap_review_then_validate_control_and_action_logic_receipts" &&
          row.validationCommand.includes("validate-all-software-action-logic-source-contract-receipt.mjs") &&
          row.validationCommand.includes("--package") &&
          row.validationCommand.includes(refresh.paths.actionLogicSourceContractPackage) &&
          !row.validationCommand.includes("<action-logic-source-contract-package.json>") &&
          row.validationCommand.includes("--receipt") &&
          row.validationCommand.includes("<teacher-filled-action-logic-source-contract-receipt.json>") &&
          row.instruction.includes("control route evidence") &&
          row.instruction.includes("action logic")
      ) &&
      triage.rows.some(
        (row) =>
          row.reviewEntryId === "execution_gap_review_cockpit" &&
          row.openPath === refresh.paths.executionGapReviewCockpitHtml &&
          row.validationTool === "teacher_combined_execution_gap_review_then_validate_control_and_execution_receipts" &&
          row.validationCommand.includes("validate-all-software-execution-follow-up-receipt.mjs") &&
          row.validationCommand.includes("--batch") &&
          row.validationCommand.includes("--receipt") &&
          row.validationCommand.includes("<teacher-filled-execution-follow-up-receipt.json>") &&
          !row.validationCommand.includes("create-all-software-execution-follow-up-receipt-builder.mjs")
      ) &&
      !triage.rows.some((row) => row.id === "spatial_spatial_intent_evidence_missing") &&
      refresh.refreshedEvidence?.spatialIntentEvidenceReceiptValidationReady === true &&
      triage.rollbackPoint?.deleteOnlyAfterTeacherConfirmation === true &&
      rollbackPoint.status === "waiting_for_teacher_confirmation" &&
      triage.rows[0].blockedTeacherDecisions.includes("register_now") &&
      triage.blockedActions.includes("register_scheduled_task_from_triage") &&
      triage.locks.goalComplete === false &&
      triageHtml.includes("Original Goal Next Action Triage") &&
      triageHtml.includes("Rollback evidence") &&
      triageHtml.includes("Ordered Review Rows") &&
      triageHtml.includes("does not register tasks") &&
      dashboard.includes("Ordered triage") &&
      dashboard.includes("Teacher action router") &&
      dashboard.includes("Teacher action router receipt builder") &&
      dashboard.includes("Retained rollback point") &&
      dashboard.includes("Low-token operation preflight") &&
      readme.includes("Teacher action router:") &&
      readme.includes("Teacher action router receipt builder:") &&
      readme.includes("Ordered next-action triage:"),
    evidence: refresh.paths.nextActionTriageHtml
  },
  {
    name: "Current status refresh embeds a low-token teacher action shortlist",
    pass:
      refresh.paths.teacherActionShortlist &&
      existsSync(refresh.paths.teacherActionShortlist) &&
      refresh.teacherActionShortlist?.format === "transparent_ai_original_goal_teacher_action_shortlist_v1" &&
      teacherActionShortlist.format === "transparent_ai_original_goal_teacher_action_shortlist_v1" &&
      teacherActionShortlist.status === "waiting_for_teacher_shortlist_review" &&
      teacherActionShortlist.actions.length >= 3 &&
      teacherActionShortlist.actions.length <= 5 &&
      teacherActionShortlist.actions[0].reviewEntryId === "activation_receipt_builder" &&
      teacherActionShortlist.actions[0].routerRowMatched === true &&
      teacherActionShortlist.actions[0].routerRowId &&
      teacherActionShortlist.actions[0].validationCommand.includes(
        "validate-all-software-operational-activation-review-receipt.mjs"
      ) &&
      !teacherActionShortlist.actions.some((row) => row.reviewEntryId === "spatial_intent_evidence_request") &&
      refresh.refreshedEvidence?.formalSpatialIntentEvidencePresent === true &&
      teacherActionShortlist.actions.some((row) => row.reviewEntryId === "coverage_rollout_receipt_builder") &&
      teacherActionShortlist.actions.some((row) => row.id === "execution_action_logic_source_missing") &&
      teacherActionShortlist.actions.some((row) => row.reviewEntryId === "teacher_review_cockpit") &&
      teacherActionShortlist.routerReceipt.status === "ready_for_teacher_to_fill_shortlist_router_receipt" &&
      teacherActionShortlist.routerReceipt.mappedActions === teacherActionShortlist.actions.length &&
      teacherActionShortlist.routerReceipt.unmappedActions === 0 &&
      teacherActionShortlist.routerReceipt.validationCommand.includes(
        "validate-original-goal-teacher-action-router-receipt.mjs"
      ) &&
      !teacherActionShortlist.routerReceipt.validationCommand.includes("--execute") &&
      teacherActionShortlistReceiptTemplate.format === "transparent_ai_original_goal_teacher_action_router_receipt_v1" &&
      teacherActionShortlistReceiptTemplate.rowDecisions.length === teacherActionShortlist.actions.length &&
      teacherActionShortlistReceiptTemplate.rowDecisions[0].id === teacherActionShortlist.actions[0].routerRowId &&
      teacherActionShortlistReceiptTemplate.rowDecisions[0].teacherDecision === "needs_teacher_review" &&
      teacherActionShortlistReceiptTemplate.blockedActions.includes("execute_now") &&
      teacherActionShortlist.blockedActions.includes("execute_shortlist_command_automatically") &&
      teacherActionShortlist.blockedActions.includes("register_scheduled_task_from_shortlist") &&
      teacherActionShortlist.blockedActions.includes("write_memory_from_shortlist") &&
      teacherActionShortlist.locks.goalComplete === false &&
      refresh.refreshedEvidence.teacherActionShortlistStatus === "waiting_for_teacher_shortlist_review" &&
      refresh.refreshedEvidence.teacherActionShortlistActions === teacherActionShortlist.actions.length &&
      refresh.refreshedEvidence.teacherActionShortlistFirstReviewEntry === "activation_receipt_builder" &&
      refresh.refreshedEvidence.teacherActionShortlistReviewOnly === true &&
      refresh.refreshedEvidence.teacherActionShortlistRouterReceiptReady === true &&
      refresh.refreshedEvidence.teacherActionShortlistRouterReceiptMappedActions === teacherActionShortlist.actions.length &&
      refresh.refreshedEvidence.teacherActionShortlistRouterReceiptUnmappedActions === 0 &&
      refresh.paths.teacherActionShortlistRouterReceiptValidationCommandTemplate.includes(
        "validate-original-goal-teacher-action-router-receipt.mjs"
      ) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.teacherActionShortlistRouterReceiptTemplate) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.teacherActionShortlistRouterReceiptValidationCommandTemplate) &&
      readme.includes("Teacher action shortlist JSON:") &&
      readme.includes("Teacher action shortlist router receipt template:") &&
      dashboard.includes("Teacher action shortlist"),
    evidence: refresh.paths.teacherActionShortlist
  },
  {
    name: "Current status refresh writes a direct HTML dashboard",
    pass:
      dashboard.includes("<title>Original Goal Current Status</title>") &&
      dashboard.includes("Direct Review Entry Points") &&
      dashboard.includes("Current Lanes") &&
      dashboard.includes("Next Commands And Files") &&
      dashboard.includes("original_goal_teacher_action_router") &&
      dashboard.includes("original_goal_teacher_action_router_receipt_builder") &&
      dashboard.includes("original_goal_teacher_action_router_receipt_template") &&
      dashboard.includes("activation_receipt_builder") &&
      dashboard.includes("coverage_rollout_receipt_builder") &&
      dashboard.includes("coverage_enrollment_follow_up_receipt_builder") &&
      dashboard.includes("execution_follow_up_receipt_builder") &&
      dashboard.includes("action_logic_source_contract_package") &&
      dashboard.includes("transparent_sketch_overlay") &&
      dashboard.includes("engineering_voice_control_workbench") &&
      dashboard.includes("parametric_feature_data_logic_learning_kit") &&
      dashboard.includes("operational_post_activation_witness_receipt_builder") &&
      dashboard.includes("low_token_operation_preflight_policy") &&
      dashboard.includes("low_token_trigger_budget_plan") &&
      dashboard.includes("does not register scheduled tasks") &&
      readme.includes("Post-activation witness receipt builder:") &&
      readme.includes("Low-token trigger budget plan:") &&
      readme.includes("Current status dashboard:"),
    evidence: result.dashboardPath
  },
  {
    name: "Current status refresh preserves no system change and no execution locks",
    pass:
      refresh.locks.refreshDoesNotRegisterTask === true &&
      refresh.locks.refreshDoesNotLaunchRunner === true &&
      refresh.locks.refreshDoesNotExecuteTargetSoftware === true &&
      refresh.locks.refreshDoesNotCaptureScreenshots === true &&
      refresh.locks.refreshDoesNotWriteMemory === true &&
      refresh.locks.softwareActionsExecuted === false &&
      refresh.locks.targetSoftwareCommandsExecuted === false &&
      refresh.locks.nativeUniversalExecution === false &&
      commandCenter.locks.commandCenterDoesNotExecuteSoftware === true &&
      statusConsole.locks.statusConsoleReadOnly === true &&
      gapBoard.locks.boardDoesNotExecuteTargetSoftware === true &&
      lowTokenOperationPreflight.locks.screenshotsCaptured === false &&
      lowTokenOperationPreflight.locks.softwareActionsExecuted === false &&
      lowTokenOperationPreflight.locks.longTermMemoryWritten === false &&
      lowTokenOperationPreflight.locks.rollbackPointRequiredBeforeExecution === true &&
      teacherActionRouter.locks.routerDoesNotValidateReceipts === true &&
      teacherActionRouter.locks.routerDoesNotRegisterTask === true &&
      teacherActionRouter.locks.routerDoesNotExecuteTargetSoftware === true &&
      teacherActionRouter.locks.routerDoesNotCaptureScreenshots === true &&
      teacherActionRouter.locks.goalComplete === false &&
      teacherActionRouterReceiptBuilder.locks.builderDoesNotRunCommands === true &&
      teacherActionRouterReceiptBuilder.locks.builderDoesNotRegisterTask === true &&
      teacherActionRouterReceiptBuilder.locks.builderDoesNotExecuteTargetSoftware === true &&
      teacherActionRouterReceiptBuilder.locks.builderDoesNotCaptureScreenshots === true &&
      teacherActionRouterReceiptBuilder.locks.builderDoesNotWriteMemory === true &&
      teacherActionRouterReceiptBuilder.locks.goalComplete === false &&
      lowTokenTriggerBudgetPlan.locks.screenshotsCaptured === false &&
      lowTokenTriggerBudgetPlan.locks.fullContinuousRecording === false &&
      lowTokenTriggerBudgetPlan.locks.softwareActionsExecuted === false &&
      lowTokenTriggerBudgetPlan.locks.targetSoftwareCommandsExecuted === false &&
      lowTokenTriggerBudgetPlan.locks.longTermMemoryWritten === false &&
      lowTokenTriggerBudgetPlan.locks.teacherConfirmationRequiredBeforeCapture === true &&
      eventTriggeredObservationPolicy.locks.eventTriggeredOnly === true &&
      eventTriggeredObservationPolicy.locks.continuousRecording === false &&
      eventTriggeredObservationPolicy.locks.fullLogsRead === false &&
      eventTriggeredObservationPolicy.locks.screenshotAllowedWithoutTeacher === false &&
      eventTriggeredObservationPolicy.locks.maxScreenshotsPerTrigger === 1 &&
      eventTriggeredObservationPolicy.locks.softwareActionsExecuted === false &&
      eventTriggeredObservationPolicy.locks.teacherConfirmationRequiredBeforeCapture === true,
    evidence: JSON.stringify(refresh.locks)
  },
  {
    name: "Current status refresh exposes event-triggered low-token policy for log-change visual escalation",
    pass:
      refresh.paths.eventTriggeredObservationPolicy &&
      refresh.paths.eventTriggeredObservationPolicyHtml &&
      refresh.paths.eventTriggeredObservationPolicyReceiptBuilder &&
      refresh.paths.eventTriggeredObservationPolicyReceiptBuilderHtml &&
      refresh.paths.eventTriggeredObservationPolicyReceiptTemplate &&
      refresh.paths.eventTriggeredObservationPolicyReceiptBuilderCommandTemplate?.includes(
        "create-event-triggered-low-token-observation-policy-receipt-builder.mjs"
      ) &&
      refresh.paths.eventTriggeredObservationPolicyReceiptValidationCommandTemplate?.includes(
        "validate-event-triggered-low-token-observation-policy-receipt.mjs"
      ) &&
      refresh.paths.eventTriggeredObservationPolicyReceiptValidationCommandTemplate?.includes(
        "<teacher-filled-event-triggered-low-token-observation-policy-receipt.json>"
      ) &&
      existsSync(refresh.paths.eventTriggeredObservationPolicyHtml) &&
      eventTriggeredObservationPolicy.format === "transparent_ai_event_triggered_low_token_observation_policy_v1" &&
      eventTriggeredObservationPolicy.decisionLadder.some((row) => row.stage === "metadata_only_watch") &&
      eventTriggeredObservationPolicy.decisionLadder.some((row) => row.stage === "bounded_tail_or_compact_event") &&
      eventTriggeredObservationPolicy.decisionLadder.some((row) => row.stage === "teacher_review_before_visual") &&
      eventTriggeredObservationPolicy.decisionLadder.some((row) => row.stage === "one_bounded_screenshot") &&
      eventTriggeredObservationPolicy.triggerRows.some((row) => row.maxScreenshots === 0) &&
      eventTriggeredObservationPolicy.triggerRows.some((row) => row.maxScreenshots === 1 && row.screenshotAllowedNow === false) &&
      eventTriggeredObservationPolicyReceiptTemplate.format ===
        "transparent_ai_event_triggered_low_token_observation_policy_receipt_v1" &&
      eventTriggeredObservationPolicyReceiptTemplate.nextValidationCommandTemplate.includes(
        "validate-event-triggered-low-token-observation-policy-receipt.mjs"
      ) &&
      eventTriggeredObservationPolicyReceiptTemplate.forbiddenDecisions.includes("capture_now") &&
      eventTriggeredObservationPolicyReceiptTemplate.forbiddenDecisions.includes("execute_now") &&
      eventTriggeredObservationPolicyReceiptBuilder.format ===
        "transparent_ai_event_triggered_low_token_observation_policy_receipt_builder_v1" &&
      eventTriggeredObservationPolicyReceiptBuilder.locks.builderDoesNotWriteTeacherFilledReceipt === true &&
      eventTriggeredObservationPolicyReceiptBuilder.locks.builderDoesNotCaptureScreenshots === true &&
      eventTriggeredObservationPolicyReceiptBuilder.locks.builderDoesNotExecuteSoftware === true &&
      eventTriggeredObservationPolicyReceiptBuilderHtml.includes("Download Receipt JSON") &&
      eventTriggeredObservationPolicyReceiptBuilderHtml.includes("Generate Receipt JSON") &&
      eventTriggeredObservationPolicyHtml.includes("Event Triggered Low Token Observation Policy") &&
      refresh.refreshedEvidence.eventTriggeredObservationPolicyReady === true &&
      refresh.refreshedEvidence.eventTriggeredObservationPolicyReceiptTemplateReady === true &&
      refresh.refreshedEvidence.eventTriggeredObservationPolicyReceiptBuilderReady === true &&
      refresh.refreshedEvidence.eventTriggeredObservationPolicyReceiptValidationCommandReady === true,
    evidence: refresh.paths.eventTriggeredObservationPolicyHtml
  },
  {
    name: "Current status refresh links ordered teacher-review follow-up instead of direct activation",
    pass:
      refresh.paths.gapActionBoardHtml &&
      refresh.paths.nextActionTriageHtml &&
      refresh.paths.teacherActionRouterHtml &&
      refresh.paths.teacherActionRouterReceiptBuilderHtml &&
      refresh.paths.teacherActionRouterReceiptTemplate &&
      refresh.paths.lowTokenOperationPreflightPolicyHtml &&
      refresh.paths.lowTokenTriggerBudgetPlanHtml &&
      refresh.paths.eventTriggeredObservationPolicyHtml &&
      refresh.paths.eventTriggeredObservationPolicyReceiptBuilderHtml &&
      refresh.paths.eventTriggeredObservationPolicyReceiptTemplate &&
      refresh.paths.eventTriggeredObservationPolicyReceiptValidationCommandTemplate &&
      refresh.nextSafeAction.includes("original-goal-teacher-action-router.html") &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.nextActionTriageHtml) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.teacherActionRouterHtml) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.teacherActionRouterReceiptBuilderHtml) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.teacherActionRouterReceiptTemplate) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher-filled teacher action router receipt") &&
          row.command.includes("validate-original-goal-teacher-action-router-receipt.mjs") &&
          row.command.includes("<teacher-filled-action-router-receipt.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("manual handoff queue") &&
          row.command.includes("create-original-goal-teacher-action-router-handoff-queue.mjs") &&
          row.command.includes("<teacher-action-router-receipt-validation.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("browser command page for one teacher-confirmed original-goal review handoff item") &&
          row.command.includes("create-original-goal-review-handoff-item-command-builder.mjs") &&
          row.command.includes("<teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json>")
      ) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.lowTokenOperationPreflightPolicyHtml) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.lowTokenTriggerBudgetPlanHtml) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.eventTriggeredObservationPolicyHtml) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.eventTriggeredObservationPolicyReceiptBuilderHtml) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Regenerate event-triggered low-token policy receipt builder") &&
          row.command === refresh.paths.eventTriggeredObservationPolicyReceiptBuilderCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher-filled event-triggered low-token observation policy receipt") &&
          row.command === refresh.paths.eventTriggeredObservationPolicyReceiptValidationCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Regenerate event-triggered low-token observation policy") &&
          row.command.includes("create-event-triggered-low-token-observation-policy.mjs") &&
          row.command.includes("--budget-plan")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Regenerate low-token trigger budget plan") &&
          row.command.includes("create-low-token-trigger-budget-plan.mjs") &&
          row.command.includes("--token-budget") &&
          row.command.includes("--visual-check-queue")
      ) &&
      refresh.nextCommands.some((row) => row.command === coverageEnrollmentReceiptBuilderHtmlFixturePath) &&
      refresh.nextCommands.some((row) => row.command === coverageEnrollmentReceiptTemplateFixturePath) &&
      refresh.nextCommands.some((row) => row.command === coverageEnrollmentLedgerReadmeFixturePath) &&
      refresh.nextCommands.some((row) => row.command === coverageEnrollmentFollowUpPlanReadmeFixturePath) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.coverageEnrollmentFollowUpBatchReadme) &&
      refresh.nextCommands.some((row) => row.command === coverageEnrollmentFollowUpReconciliationReadmeFixturePath) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Review coverage enrollment receipt builder packet") &&
          row.command === coverageEnrollmentReceiptBuilderFixturePath
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher-filled coverage enrollment follow-up receipt") &&
          row.command.includes("validate-all-software-coverage-enrollment-follow-up-receipt.mjs") &&
          row.command.includes("<teacher-filled-coverage-enrollment-follow-up-receipt.json>") &&
          row.command.includes(coverageEnrollmentFollowUpPlanFixturePath)
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("manual handoff queue from validated coverage enrollment follow-up receipt") &&
          row.command.includes("create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs") &&
          row.command.includes("<coverage-enrollment-follow-up-receipt-validation.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("teacher-confirmed coverage rollout handoff item") &&
          row.command.includes("run-all-software-coverage-rollout-handoff-queue-item.mjs") &&
          row.command.includes("<coverage-rollout-handoff-queue.json>") &&
          row.command.includes("<teacher-reviewed-item-number>") &&
          row.command.includes("--run-reviewed-handoff") &&
          row.command.includes("--allow-runner") &&
          row.command.includes("--rollback-point-created")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("manual handoff queue from validated execution follow-up receipt") &&
          row.command.includes("create-all-software-execution-follow-up-handoff-queue.mjs") &&
          row.command.includes("<execution-follow-up-receipt-validation.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("teacher-reviewed execution follow-up handoff item") &&
          row.command.includes("run-all-software-execution-follow-up-handoff-queue-item.mjs") &&
          row.command.includes("<execution-follow-up-handoff-queue.json>") &&
          row.command.includes("<teacher-reviewed-row-id>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("receipt builder for one dry-run execution handoff item") &&
          row.command.includes("create-all-software-execution-follow-up-handoff-item-receipt-builder.mjs") &&
          row.command.includes("<execution-follow-up-handoff-item-run.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("dry-run execution handoff item receipt before any approval gate") &&
          row.command.includes("validate-all-software-execution-follow-up-handoff-item-receipt.mjs") &&
          row.command.includes("<teacher-filled-execution-handoff-item-review-receipt.json>")
      ) &&
      refresh.nextCommands.some((row) => row.command.includes("validate-original-goal-gap-action-board-receipt.mjs")) &&
      !refresh.nextCommands.some((row) => row.command.includes("Register-ScheduledTask")) &&
      !refresh.nextCommands.some((row) => /--teacher-reviewed(?:\s|$|")/.test(String(row.command || ""))),
    evidence: refresh.nextSafeAction
  },
  {
    name: "Current status refresh auto-links execution follow-up receipt builder when a batch exists",
    pass:
      refresh.discoveredEvidence?.executionFollowUpBatch === executionFollowUpBatchPath &&
      commandCenter.paths?.executionFollowUpReceiptBuilder &&
      commandCenter.paths?.executionFollowUpReceiptBuilderHtml &&
      existsSync(commandCenter.paths.executionFollowUpReceiptBuilderHtml) &&
      refresh.paths?.executionFollowUpReceiptBuilder === commandCenter.paths.executionFollowUpReceiptBuilder &&
      refresh.paths?.executionFollowUpReceiptBuilderHtml === commandCenter.paths.executionFollowUpReceiptBuilderHtml &&
      refresh.discoveredEvidence?.executionFollowUpReceiptBuilder === refresh.paths.executionFollowUpReceiptBuilder &&
      refresh.discoveredEvidence?.executionFollowUpReceiptBuilderHtml === refresh.paths.executionFollowUpReceiptBuilderHtml &&
      result.executionFollowUpReceiptBuilder === refresh.paths.executionFollowUpReceiptBuilder &&
      result.executionFollowUpReceiptBuilderHtml === refresh.paths.executionFollowUpReceiptBuilderHtml &&
      refresh.paths?.controlChannelRepairReceiptBuilder &&
      refresh.paths?.controlChannelRepairReceiptBuilderHtml &&
      refresh.paths?.controlChannelRepairReceiptTemplate &&
      existsSync(refresh.paths.controlChannelRepairReceiptBuilderHtml) &&
      existsSync(refresh.paths.controlChannelRepairReceiptTemplate) &&
      controlChannelRepairReceiptBuilder.format === "transparent_ai_all_software_control_channel_repair_receipt_builder_v1" &&
      controlChannelRepairReceiptBuilder.locks?.builderDoesNotExecuteTargetSoftware === true &&
      controlChannelRepairReceiptBuilder.counts?.totalRows === 1 &&
      refresh.paths?.actionLogicSourceContractPackage &&
      refresh.paths?.actionLogicSourceContractPackageHtml &&
      refresh.paths?.actionLogicSourceContractReceiptTemplate &&
      existsSync(refresh.paths.actionLogicSourceContractPackageHtml) &&
      existsSync(refresh.paths.actionLogicSourceContractReceiptTemplate) &&
      refresh.refreshedEvidence?.actionLogicSourceContractPackage === refresh.paths.actionLogicSourceContractPackage &&
      refresh.refreshedEvidence?.actionLogicSourceContractPackageHtml === refresh.paths.actionLogicSourceContractPackageHtml &&
      refresh.refreshedEvidence?.actionLogicSourceContractPackageStatus === "waiting_for_teacher_action_logic_source_review" &&
      result.actionLogicSourceContractPackage === refresh.paths.actionLogicSourceContractPackage &&
      result.actionLogicSourceContractPackageHtml === refresh.paths.actionLogicSourceContractPackageHtml &&
      result.actionLogicSourceContractReceiptTemplate === refresh.paths.actionLogicSourceContractReceiptTemplate &&
      refresh.paths?.actionLogicSourceShortlist &&
      refresh.paths?.actionLogicSourceShortlistHtml &&
      refresh.paths?.actionLogicSourceShortlistReceiptTemplate &&
      existsSync(refresh.paths.actionLogicSourceShortlistHtml) &&
      existsSync(refresh.paths.actionLogicSourceShortlistReceiptTemplate) &&
      refresh.refreshedEvidence?.actionLogicSourceShortlist === refresh.paths.actionLogicSourceShortlist &&
      refresh.refreshedEvidence?.actionLogicSourceShortlistHtml === refresh.paths.actionLogicSourceShortlistHtml &&
      refresh.refreshedEvidence?.actionLogicSourceShortlistStatus ===
        "waiting_for_teacher_action_logic_source_shortlist_review" &&
      refresh.refreshedEvidence?.actionLogicSourceShortlistDefaultReadyPatchRows === 0 &&
      refresh.refreshedEvidence?.actionLogicSourceShortlistReviewOnly === true &&
      refresh.refreshedEvidence?.actionLogicSourceShortlistKeepsExecutionLocked === true &&
      refresh.refreshedEvidence?.actionLogicSourceShortlistKeepsRulesAndMemoryLocked === true &&
      actionLogicSourceShortlist.format === "transparent_ai_all_software_action_logic_source_shortlist_v1" &&
      actionLogicSourceShortlist.status === "waiting_for_teacher_action_logic_source_shortlist_review" &&
      actionLogicSourceShortlist.counts?.recommendedRows === 1 &&
      actionLogicSourceShortlist.counts?.defaultReadyPatchRows === 0 &&
      actionLogicSourceShortlist.locks?.reviewOnly === true &&
      actionLogicSourceShortlist.locks?.softwareActionsExecuted === false &&
      actionLogicSourceShortlist.locks?.targetSoftwareCommandsExecuted === false &&
      actionLogicSourceShortlist.locks?.shortlistDoesNotEnableRules === true &&
      actionLogicSourceShortlist.locks?.shortlistDoesNotWriteMemory === true &&
      actionLogicSourceShortlistHtml.includes("All-Software Action Logic Source Shortlist") &&
      actionLogicSourceShortlistReceiptTemplate.rowDecisions?.[0]?.teacherDecision === "needs_teacher_review" &&
      result.actionLogicSourceShortlist === refresh.paths.actionLogicSourceShortlist &&
      result.actionLogicSourceShortlistHtml === refresh.paths.actionLogicSourceShortlistHtml &&
      result.actionLogicSourceShortlistReceiptTemplate === refresh.paths.actionLogicSourceShortlistReceiptTemplate &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "action_logic_source_contract_package" && link.path === refresh.paths.actionLogicSourceContractPackageHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "action_logic_source_contract_receipt_template" && link.path === refresh.paths.actionLogicSourceContractReceiptTemplate
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "action_logic_source_shortlist" && link.path === refresh.paths.actionLogicSourceShortlistHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "action_logic_source_shortlist_receipt_template" &&
          link.path === refresh.paths.actionLogicSourceShortlistReceiptTemplate
      ) &&
      refresh.paths?.executionGapReviewCockpit &&
      refresh.paths?.executionGapReviewCockpitHtml &&
      refresh.paths?.executionGapReviewCockpitReceiptTemplate &&
      existsSync(refresh.paths.executionGapReviewCockpitHtml) &&
      existsSync(refresh.paths.executionGapReviewCockpitReceiptTemplate) &&
      refresh.paths?.executionGapReviewCockpitShortlist &&
      refresh.paths?.executionGapReviewCockpitShortlistHtml &&
      refresh.paths?.executionGapReviewCockpitShortlistReceiptTemplate &&
      existsSync(refresh.paths.executionGapReviewCockpitShortlistHtml) &&
      existsSync(refresh.paths.executionGapReviewCockpitShortlistReceiptTemplate) &&
      executionGapReviewCockpitShortlist.format ===
        "transparent_ai_all_software_execution_gap_review_cockpit_shortlist_v1" &&
      executionGapReviewCockpitShortlist.counts?.recommendedRows === 1 &&
      executionGapReviewCockpitShortlist.counts?.defaultReadyRows === 0 &&
      executionGapReviewCockpitShortlist.locks?.shortlistDoesNotExecuteSoftware === true &&
      executionGapReviewCockpitShortlist.locks?.shortlistDoesNotWriteMemory === true &&
      executionGapReviewCockpitShortlistHtml.includes("Execution Gap Review Cockpit Shortlist") &&
      executionGapReviewCockpitShortlistReceiptTemplate.rowDecisions?.length === 1 &&
      executionGapReviewCockpitShortlistReceiptTemplate.rowDecisions?.[0]?.teacherDecision === "needs_teacher_review" &&
      refresh.refreshedEvidence?.executionGapReviewCockpitShortlist ===
        refresh.paths.executionGapReviewCockpitShortlist &&
      refresh.refreshedEvidence?.executionGapReviewCockpitShortlistStatus ===
        "waiting_for_teacher_execution_gap_shortlist_review" &&
      refresh.refreshedEvidence?.executionGapReviewCockpitShortlistDefaultReadyRows === 0 &&
      refresh.refreshedEvidence?.executionGapReviewCockpitShortlistReviewOnly === true &&
      refresh.refreshedEvidence?.executionGapReviewCockpitShortlistKeepsExecutionLocked === true &&
      refresh.refreshedEvidence?.executionGapReviewCockpitShortlistKeepsRulesAndMemoryLocked === true &&
      refresh.paths?.executionGapReviewCockpitReceiptValidationCommandTemplate?.includes(
        "validate-all-software-execution-gap-review-cockpit-receipt.mjs"
      ) &&
      refresh.paths?.executionGapReviewCockpitReceiptValidationCommandTemplate?.includes(
        "<teacher-filled-execution-gap-review-cockpit-receipt.json>"
      ) &&
      refresh.paths?.executionGapReviewCockpitHandoffQueueCommandTemplate?.includes(
        "create-all-software-execution-gap-review-cockpit-handoff-queue.mjs"
      ) &&
      refresh.paths?.executionGapReviewCockpitHandoffQueueCommandTemplate?.includes(
        "<all-software-execution-gap-review-cockpit-receipt-validation.json>"
      ) &&
      refresh.paths?.executionGapReviewCockpitHandoffQueueItemRunnerCommandTemplate?.includes(
        "run-original-goal-review-handoff-queue-item.mjs"
      ) &&
      refresh.paths?.executionGapReviewCockpitHandoffQueueItemRunnerCommandTemplate?.includes(
        "<teacher-reviewed-item-number>"
      ) &&
      refresh.paths?.executionGapReviewDownstreamValidationSummaryCommandTemplate?.includes(
        "create-all-software-execution-gap-downstream-validation-summary.mjs"
      ) &&
      refresh.paths?.executionGapReviewDownstreamValidationSummaryCommandTemplate?.includes(
        "<control-channel-handoff-item-run.json>"
      ) &&
      refresh.paths?.executionGapReviewMatrixReconciliationPackageCommandTemplate?.includes(
        "create-all-software-execution-gap-matrix-reconciliation-package.mjs"
      ) &&
      refresh.paths?.executionGapReviewMatrixReconciliationPackageCommandTemplate?.includes(
        "<all-software-execution-gap-downstream-validation-summary.json>"
      ) &&
      refresh.paths?.executionGapReviewMatrixReconciliationReceiptBuilderCommandTemplate?.includes(
        "create-all-software-execution-gap-matrix-reconciliation-receipt-builder.mjs"
      ) &&
      refresh.paths?.executionGapReviewMatrixReconciliationReceiptBuilderCommandTemplate?.includes(
        "<all-software-execution-gap-matrix-reconciliation-package.json>"
      ) &&
      refresh.paths?.executionGapReviewMatrixReconciliationReceiptValidationCommandTemplate?.includes(
        "validate-all-software-execution-gap-matrix-reconciliation-receipt.mjs"
      ) &&
      refresh.paths?.executionGapReviewMatrixReconciliationReceiptValidationCommandTemplate?.includes(
        "<teacher-filled-execution-gap-matrix-reconciliation-receipt.json>"
      ) &&
      refresh.paths?.executionGapReviewMatrixReconciliationReviewedRunnerCommandTemplate?.includes(
        "run-all-software-execution-gap-matrix-reconciliation-reviewed-runner.mjs"
      ) &&
      refresh.paths?.executionGapReviewMatrixReconciliationReviewedRunnerCommandTemplate?.includes(
        "<all-software-execution-gap-matrix-reconciliation-receipt-validation.json>"
      ) &&
      refresh.paths?.executionGapReviewMatrixReconciliationReviewedRunnerCommandTemplate?.includes(
        "<teacher-confirmed-execution-gap-matrix-reconciliation-runner-text>"
      ) &&
      refresh.paths?.executionGapReviewMatrixReconciliationReviewedRunnerCommandTemplate?.includes(
        "<retained-rollback-point-path-or-label>"
      ) &&
      refresh.refreshedEvidence?.executionGapReviewCockpitReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.executionGapReviewCockpitHandoffQueueCommandReady === true &&
      refresh.refreshedEvidence?.executionGapReviewCockpitHandoffQueueItemRunnerCommandReady === true &&
      refresh.refreshedEvidence?.executionGapReviewDownstreamValidationSummaryCommandReady === true &&
      refresh.refreshedEvidence?.executionGapReviewMatrixReconciliationPackageCommandReady === true &&
      refresh.refreshedEvidence?.executionGapReviewMatrixReconciliationReceiptBuilderCommandReady === true &&
      refresh.refreshedEvidence?.executionGapReviewMatrixReconciliationReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.executionGapReviewMatrixReconciliationReviewedRunnerCommandReady === true &&
      refresh.discoveredEvidence?.executionGapReviewCockpitReceiptValidationCommandTemplate?.includes(
        "validate-all-software-execution-gap-review-cockpit-receipt.mjs"
      ) &&
      refresh.discoveredEvidence?.executionGapReviewCockpitHandoffQueueCommandTemplate?.includes(
        "create-all-software-execution-gap-review-cockpit-handoff-queue.mjs"
      ) &&
      refresh.discoveredEvidence?.executionGapReviewCockpitHandoffQueueItemRunnerCommandTemplate?.includes(
        "run-original-goal-review-handoff-queue-item.mjs"
      ) &&
      refresh.discoveredEvidence?.executionGapReviewDownstreamValidationSummaryCommandTemplate?.includes(
        "create-all-software-execution-gap-downstream-validation-summary.mjs"
      ) &&
      refresh.discoveredEvidence?.executionGapReviewMatrixReconciliationPackageCommandTemplate?.includes(
        "create-all-software-execution-gap-matrix-reconciliation-package.mjs"
      ) &&
      refresh.discoveredEvidence?.executionGapReviewMatrixReconciliationReceiptBuilderCommandTemplate?.includes(
        "create-all-software-execution-gap-matrix-reconciliation-receipt-builder.mjs"
      ) &&
      refresh.discoveredEvidence?.executionGapReviewMatrixReconciliationReceiptValidationCommandTemplate?.includes(
        "validate-all-software-execution-gap-matrix-reconciliation-receipt.mjs"
      ) &&
      refresh.discoveredEvidence?.executionGapReviewMatrixReconciliationReviewedRunnerCommandTemplate?.includes(
        "run-all-software-execution-gap-matrix-reconciliation-reviewed-runner.mjs"
      ) &&
      executionGapReviewCockpit.format === "transparent_ai_all_software_execution_gap_review_cockpit_v1" &&
      executionGapReviewCockpit.locks?.cockpitDoesNotExecuteTargetSoftware === true &&
      executionGapReviewCockpit.counts?.rowsWithBothReviews === 1 &&
      executionGapReviewCockpitHtml.includes("Execution Gap Review Cockpit") &&
      executionGapReviewCockpitReceiptTemplate.defaultDecision === "needs_teacher_review" &&
      refresh.refreshedEvidence?.controlChannelRepairReceiptBuilderRows === 1 &&
      refresh.refreshedEvidence?.executionGapReviewCockpitRowsWithBothReviews === 1 &&
      refresh.refreshedEvidence?.executionGapReviewCockpitReviewOnly === true &&
      refresh.refreshedEvidence?.executionGapReviewCockpitDoesNotExecuteSoftware === true &&
      result.executionGapReviewCockpit === refresh.paths.executionGapReviewCockpit &&
      result.executionGapReviewCockpitHtml === refresh.paths.executionGapReviewCockpitHtml &&
      result.executionGapReviewCockpitReceiptTemplate === refresh.paths.executionGapReviewCockpitReceiptTemplate &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "execution_gap_review_cockpit" && link.path === refresh.paths.executionGapReviewCockpitHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "execution_gap_review_cockpit_shortlist" &&
          link.path === refresh.paths.executionGapReviewCockpitShortlistHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "execution_gap_review_cockpit_shortlist_receipt_template" &&
          link.path === refresh.paths.executionGapReviewCockpitShortlistReceiptTemplate
      ) &&
      teacherActionRouter.routeRows.some(
        (row) =>
          row.reviewEntryId === "execution_gap_review_cockpit" &&
          row.openPath === refresh.paths.executionGapReviewCockpitHtml &&
          row.teacherInstruction.includes("control route evidence") &&
          row.teacherInstruction.includes("action logic")
      ) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.executionGapReviewCockpitHtml) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.actionLogicSourceContractPackageHtml) &&
      refresh.paths?.executionFollowUpHandoffQueueCommandTemplate?.includes(
        "create-all-software-execution-follow-up-handoff-queue.mjs"
      ) &&
      refresh.paths?.executionFollowUpHandoffQueueCommandTemplate?.includes("<execution-follow-up-receipt-validation.json>") &&
      refresh.paths?.executionFollowUpHandoffItemCommandBuilderHtml &&
      existsSync(refresh.paths.executionFollowUpHandoffItemCommandBuilderHtml) &&
      refresh.paths?.executionFollowUpHandoffItemCommandBuilderCommandTemplate?.includes(
        "create-all-software-execution-follow-up-handoff-item-command-builder.mjs"
      ) &&
      refresh.paths?.executionFollowUpHandoffItemCommandBuilderCommandTemplate?.includes("<execution-follow-up-handoff-queue.json>") &&
      refresh.paths?.executionFollowUpHandoffQueueItemRunnerCommandTemplate?.includes(
        "run-all-software-execution-follow-up-handoff-queue-item.mjs"
      ) &&
      refresh.paths?.executionFollowUpHandoffQueueItemRunnerCommandTemplate?.includes(
        "<execution-follow-up-handoff-queue.json>"
      ) &&
      refresh.paths?.executionFollowUpHandoffQueueItemRunnerCommandTemplate?.includes("<teacher-reviewed-row-id>") &&
      refresh.paths?.executionFollowUpHandoffItemReceiptBuilderCommandTemplate?.includes(
        "create-all-software-execution-follow-up-handoff-item-receipt-builder.mjs"
      ) &&
      refresh.paths?.executionFollowUpHandoffItemReceiptBuilderCommandTemplate?.includes(
        "<execution-follow-up-handoff-item-run.json>"
      ) &&
      refresh.paths?.executionFollowUpHandoffItemReceiptValidationCommandTemplate?.includes(
        "validate-all-software-execution-follow-up-handoff-item-receipt.mjs"
      ) &&
      refresh.paths?.executionFollowUpHandoffItemReceiptValidationCommandTemplate?.includes(
        "<teacher-filled-execution-handoff-item-review-receipt.json>"
      ) &&
      refresh.paths?.executionApprovalGatePrepRunnerCommandTemplate?.includes(
        "run-all-software-execution-approval-gate-prep-runner.mjs"
      ) &&
      refresh.paths?.executionApprovalGatePrepRunnerCommandTemplate?.includes(
        "<execution-handoff-item-receipt-validation.json>"
      ) &&
      refresh.paths?.executionApprovalGatePrepRunnerCommandTemplate?.includes(
        "<reviewed-existing-cli-command-manifest.json>"
      ) &&
      refresh.paths?.executionApprovedGateRunnerCommandTemplate?.includes(
        "run-all-software-execution-approved-gate-runner.mjs"
      ) &&
      refresh.paths?.executionApprovedGateRunnerCommandTemplate?.includes(
        "<ready-real-local-execution-approval-gate.json>"
      ) &&
      refresh.paths?.executionApprovedGateRunnerCommandTemplate?.includes("--execute-approved-gate") &&
      refresh.paths?.executionApprovedGateCommandBuilderHtml &&
      existsSync(refresh.paths.executionApprovedGateCommandBuilderHtml) &&
      refresh.paths?.executionApprovedGateCommandBuilderCommandTemplate?.includes(
        "create-all-software-execution-approved-gate-command-builder.mjs"
      ) &&
      refresh.paths?.executionApprovedGateCommandBuilderCommandTemplate?.includes(
        "<ready-real-local-execution-approval-gate.json>"
      ) &&
      refresh.paths?.operationalRegistrationApprovedRunnerCommandTemplate?.includes(
        "run-all-software-operational-learning-registration-approved-runner.mjs"
      ) &&
      refresh.paths?.operationalRegistrationApprovedRunnerCommandTemplate?.includes(
        "<ready-operational-registration-execute-gate.json>"
      ) &&
      refresh.paths?.operationalRegistrationApprovedRunnerCommandTemplate?.includes("--execute-approved-registration") &&
      refresh.paths?.operationalRegistrationApprovedRunnerCommandTemplate?.includes("--allow-system-change") &&
      refresh.paths?.operationalRegistrationApprovedCommandBuilderHtml &&
      existsSync(refresh.paths.operationalRegistrationApprovedCommandBuilderHtml) &&
      refresh.paths?.operationalRegistrationApprovedCommandBuilderCommandTemplate?.includes(
        "create-all-software-operational-registration-approved-command-builder.mjs"
      ) &&
      refresh.paths?.operationalRegistrationApprovedCommandBuilderCommandTemplate?.includes(
        "<ready-operational-registration-execute-gate.json>"
      ) &&
      refresh.paths?.operationalPostRegistrationOutputWitnessCommandBuilderHtml &&
      existsSync(refresh.paths.operationalPostRegistrationOutputWitnessCommandBuilderHtml) &&
      refresh.paths?.operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate?.includes(
        "create-all-software-operational-post-registration-output-witness-command-builder.mjs"
      ) &&
      refresh.paths?.operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate?.includes(
        "<registered-and-matching-recurring-monitor-status.json>"
      ) &&
      refresh.paths?.operationalPostRegistrationOutputWitnessReceiptBuilderHtml &&
      existsSync(refresh.paths.operationalPostRegistrationOutputWitnessReceiptBuilderHtml) &&
      refresh.paths?.operationalPostRegistrationOutputWitnessReceiptTemplate &&
      existsSync(refresh.paths.operationalPostRegistrationOutputWitnessReceiptTemplate) &&
      refresh.paths?.operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate?.includes(
        "create-all-software-operational-post-registration-output-witness-receipt-builder.mjs"
      ) &&
      refresh.paths?.operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate?.includes(
        "<post-registration-output-witness-runner.json>"
      ) &&
      refresh.paths?.operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate?.includes(
        "validate-all-software-operational-post-registration-output-witness-receipt.mjs"
      ) &&
      refresh.paths?.operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate?.includes(
        "<teacher-filled-post-registration-output-witness-review-receipt.json>"
      ) &&
      refresh.paths?.operationalPostRegistrationOutputWitnessRunnerCommandTemplate?.includes(
        "run-all-software-operational-learning-post-registration-output-witness-runner.mjs"
      ) &&
      refresh.paths?.operationalPostRegistrationOutputWitnessRunnerCommandTemplate?.includes(
        "<registered-and-matching-recurring-monitor-status.json>"
      ) &&
      refresh.paths?.operationalPostRegistrationOutputWitnessRunnerCommandTemplate?.includes("--trigger-reviewed-output") &&
      refresh.paths?.operationalPostRegistrationOutputWitnessRunnerCommandTemplate?.includes("--allow-runner-trigger") &&
      refresh.paths?.allSoftwareUnattendedLearningAudit &&
      existsSync(refresh.paths.allSoftwareUnattendedLearningAudit) &&
      refresh.paths?.allSoftwareUnattendedLearningAuditReadme &&
      existsSync(refresh.paths.allSoftwareUnattendedLearningAuditReadme) &&
      refresh.paths?.allSoftwareUnattendedLearningAuditReceipt &&
      existsSync(refresh.paths.allSoftwareUnattendedLearningAuditReceipt) &&
      refresh.paths?.allSoftwareUnattendedLearningAuditCommandTemplate?.includes(
        "create-all-software-unattended-learning-audit.mjs"
      ) &&
      refresh.paths?.allSoftwareUnattendedLearningAuditCommandTemplate?.includes("--registration-status") &&
      refresh.paths?.allSoftwareUnattendedLearningAuditCommandTemplate?.includes("--run-output-audit") &&
      refresh.refreshedEvidence?.allSoftwareUnattendedLearningAuditReady === true &&
      refresh.refreshedEvidence?.allSoftwareUnattendedLearningAuditNoSystemChange === true &&
      refresh.refreshedEvidence?.unattendedAllAppMonitoringComplete === false &&
      Number(refresh.refreshedEvidence?.allSoftwareUnattendedLearningAuditRemainingGaps) >= 1 &&
      refresh.paths?.recurringMonitorTeacherConfirmationPackage &&
      existsSync(refresh.paths.recurringMonitorTeacherConfirmationPackage) &&
      refresh.paths?.recurringMonitorTeacherConfirmationPackageHtml &&
      existsSync(refresh.paths.recurringMonitorTeacherConfirmationPackageHtml) &&
      refresh.paths?.recurringMonitorTeacherConfirmationReceiptTemplate &&
      existsSync(refresh.paths.recurringMonitorTeacherConfirmationReceiptTemplate) &&
      refresh.paths?.recurringMonitorTeacherConfirmationReceiptValidation ===
        recurringMonitorReceiptValidationFixturePath &&
      refresh.paths?.recurringMonitorTeacherConfirmationReceiptValidationReadme ===
        recurringMonitorReceiptValidationReadmeFixturePath &&
      existsSync(refresh.paths.recurringMonitorTeacherConfirmationReceiptValidationReadme) &&
      refresh.paths?.recurringMonitorTeacherConfirmationReceiptValidationCommandTemplate?.includes(
        "validate-all-software-recurring-monitor-teacher-confirmation-receipt.mjs"
      ) &&
      refresh.paths?.recurringMonitorRegistrationRunnerDryRunCommandTemplate?.includes(
        "run-all-software-recurring-monitor-registration-runner.mjs"
      ) &&
      refresh.paths?.recurringMonitorRegistrationRunnerDryRunCommandTemplate?.includes(
        "<teacher-confirmed-recurring-monitor-approval-gate.json>"
      ) &&
      !refresh.paths?.recurringMonitorRegistrationRunnerDryRunCommandTemplate?.includes("--execute") &&
      !refresh.paths?.recurringMonitorRegistrationRunnerDryRunCommandTemplate?.includes("--allow-system-change") &&
      refresh.paths?.recurringMonitorRegistrationStatusVerifierCommandTemplate?.includes(
        "verify-all-software-recurring-monitor-registration-status.mjs"
      ) &&
      refresh.paths?.recurringMonitorRegistrationStatusVerifierCommandTemplate?.includes(
        "<teacher-reviewed-recurring-monitor-registration-runner.json>"
      ) &&
      refresh.refreshedEvidence?.recurringMonitorTeacherConfirmationPackageReady === true &&
      refresh.refreshedEvidence?.recurringMonitorTeacherConfirmationNoSystemChange === true &&
      refresh.refreshedEvidence?.recurringMonitorTeacherConfirmationReceiptValidationReady === true &&
      refresh.refreshedEvidence?.recurringMonitorTeacherConfirmationReceiptValidationStatus ===
        "receipt_validation_waiting_for_teacher_confirmation" &&
      refresh.refreshedEvidence?.recurringMonitorTeacherConfirmationReceiptValidationDecision ===
        "needs_teacher_review" &&
      refresh.refreshedEvidence?.recurringMonitorTeacherConfirmationReceiptValidationMissingRows === 3 &&
      refresh.refreshedEvidence?.recurringMonitorTeacherConfirmationReceiptReadyToRerunApprovalGate === false &&
      refresh.refreshedEvidence?.recurringMonitorTeacherConfirmationReceiptValidationNoSystemChange === true &&
      readme.includes("Recurring monitor teacher confirmation receipt validation status: receipt_validation_waiting_for_teacher_confirmation") &&
      readme.includes("Recurring monitor teacher confirmation receipt missing rows: 3") &&
      dashboard.includes("ready to rerun approval gate: false") &&
      refresh.refreshedEvidence?.unattendedApprovalGapsHaveTeacherConfirmationEntryPoint === true &&
      refresh.refreshedEvidence?.recurringMonitorRegistrationDryRunCommandReady === true &&
      refresh.refreshedEvidence?.recurringMonitorRegistrationStatusVerifierCommandReady === true &&
      refresh.refreshedEvidence?.recurringMonitorPostConfirmationChainReviewOnly === true &&
      refresh.directReviewEntryPoints?.some((entry) => entry.id === "all_software_unattended_learning_audit") &&
      refresh.directReviewEntryPoints?.some((entry) => entry.id === "recurring_monitor_teacher_confirmation_package") &&
      refresh.nextCommands.some(
        (row) =>
          row.label === "Open all-software unattended learning audit before any operational completion claim" &&
          row.command === refresh.paths.allSoftwareUnattendedLearningAuditReadme
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label === "Validate teacher-filled recurring monitor confirmation receipt before rerunning approval gate" &&
          row.command === refresh.paths.recurringMonitorTeacherConfirmationReceiptValidationCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label === "Dry-run recurring monitor registration runner after confirmed approval gate" &&
          row.command === refresh.paths.recurringMonitorRegistrationRunnerDryRunCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label === "Verify recurring monitor scheduled-task status after teacher-executed registration" &&
          row.command === refresh.paths.recurringMonitorRegistrationStatusVerifierCommandTemplate
      ) &&
      refresh.paths?.coverageRolloutHandoffQueueItemRunnerCommandTemplate?.includes(
        "run-all-software-coverage-rollout-handoff-queue-item.mjs"
      ) &&
      refresh.paths?.coverageRolloutHandoffQueueItemRunnerCommandTemplate?.includes("<coverage-rollout-handoff-queue.json>") &&
      refresh.paths?.coverageRolloutHandoffQueueItemRunnerCommandTemplate?.includes("<teacher-confirmed-coverage-rollout-handoff-item-text>") &&
      refresh.paths?.coverageRolloutHandoffItemRunReviewReceiptBuilderCommandTemplate?.includes(
        "create-all-software-coverage-rollout-handoff-item-run-review-receipt-builder.mjs"
      ) &&
      refresh.paths?.coverageRolloutHandoffItemRunReviewReceiptValidationCommandTemplate?.includes(
        "validate-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs"
      ) &&
      refresh.paths?.originalGoalReviewHandoffQueueItemRunnerCommandTemplate?.includes(
        "run-original-goal-review-handoff-queue-item.mjs"
      ) &&
      refresh.paths?.originalGoalReviewHandoffQueueItemRunnerCommandTemplate?.includes(
        "<teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json>"
      ) &&
      refresh.paths?.originalGoalReviewHandoffQueueItemRunnerCommandTemplate?.includes(
        "<teacher-confirmed-original-goal-review-handoff-item-text>"
      ) &&
      refresh.discoveredEvidence?.coverageRolloutHandoffQueueCommandTemplate ===
        refresh.paths.coverageRolloutHandoffQueueCommandTemplate &&
      refresh.discoveredEvidence?.coverageRolloutHandoffQueueItemRunnerCommandTemplate ===
        refresh.paths.coverageRolloutHandoffQueueItemRunnerCommandTemplate &&
      refresh.discoveredEvidence?.coverageRolloutHandoffItemRunReviewReceiptBuilderCommandTemplate ===
        refresh.paths.coverageRolloutHandoffItemRunReviewReceiptBuilderCommandTemplate &&
      refresh.discoveredEvidence?.coverageRolloutHandoffItemRunReviewReceiptValidationCommandTemplate ===
        refresh.paths.coverageRolloutHandoffItemRunReviewReceiptValidationCommandTemplate &&
      refresh.discoveredEvidence?.originalGoalReviewHandoffQueueItemRunnerCommandTemplate ===
        refresh.paths.originalGoalReviewHandoffQueueItemRunnerCommandTemplate &&
      refresh.discoveredEvidence?.executionFollowUpHandoffQueueCommandTemplate ===
        refresh.paths.executionFollowUpHandoffQueueCommandTemplate &&
      refresh.discoveredEvidence?.executionFollowUpHandoffItemCommandBuilderHtml ===
        refresh.paths.executionFollowUpHandoffItemCommandBuilderHtml &&
      refresh.discoveredEvidence?.executionFollowUpHandoffItemCommandBuilderCommandTemplate ===
        refresh.paths.executionFollowUpHandoffItemCommandBuilderCommandTemplate &&
      refresh.discoveredEvidence?.executionFollowUpHandoffQueueItemRunnerCommandTemplate ===
        refresh.paths.executionFollowUpHandoffQueueItemRunnerCommandTemplate &&
      refresh.discoveredEvidence?.executionFollowUpHandoffItemReceiptBuilderCommandTemplate ===
        refresh.paths.executionFollowUpHandoffItemReceiptBuilderCommandTemplate &&
      refresh.discoveredEvidence?.executionFollowUpHandoffItemReceiptValidationCommandTemplate ===
        refresh.paths.executionFollowUpHandoffItemReceiptValidationCommandTemplate &&
      refresh.discoveredEvidence?.executionApprovalGatePrepRunnerCommandTemplate ===
        refresh.paths.executionApprovalGatePrepRunnerCommandTemplate &&
      refresh.discoveredEvidence?.executionApprovedGateCommandBuilderHtml ===
        refresh.paths.executionApprovedGateCommandBuilderHtml &&
      refresh.discoveredEvidence?.executionApprovedGateCommandBuilderCommandTemplate ===
        refresh.paths.executionApprovedGateCommandBuilderCommandTemplate &&
      refresh.discoveredEvidence?.executionApprovedGateRunnerCommandTemplate ===
        refresh.paths.executionApprovedGateRunnerCommandTemplate &&
      refresh.discoveredEvidence?.operationalRegistrationApprovedCommandBuilderHtml ===
        refresh.paths.operationalRegistrationApprovedCommandBuilderHtml &&
      refresh.discoveredEvidence?.operationalRegistrationApprovedCommandBuilderCommandTemplate ===
        refresh.paths.operationalRegistrationApprovedCommandBuilderCommandTemplate &&
      refresh.discoveredEvidence?.operationalRegistrationApprovedRunnerCommandTemplate ===
        refresh.paths.operationalRegistrationApprovedRunnerCommandTemplate &&
      refresh.discoveredEvidence?.operationalPostRegistrationOutputWitnessCommandBuilderHtml ===
        refresh.paths.operationalPostRegistrationOutputWitnessCommandBuilderHtml &&
      refresh.discoveredEvidence?.operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate ===
        refresh.paths.operationalPostRegistrationOutputWitnessCommandBuilderCommandTemplate &&
      refresh.discoveredEvidence?.operationalPostRegistrationOutputWitnessReceiptBuilderHtml ===
        refresh.paths.operationalPostRegistrationOutputWitnessReceiptBuilderHtml &&
      refresh.discoveredEvidence?.operationalPostRegistrationOutputWitnessReceiptTemplate ===
        refresh.paths.operationalPostRegistrationOutputWitnessReceiptTemplate &&
      refresh.discoveredEvidence?.operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate ===
        refresh.paths.operationalPostRegistrationOutputWitnessReceiptBuilderCommandTemplate &&
      refresh.discoveredEvidence?.operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate ===
        refresh.paths.operationalPostRegistrationOutputWitnessReceiptValidationCommandTemplate &&
      refresh.discoveredEvidence?.operationalPostRegistrationOutputWitnessRunnerCommandTemplate ===
        refresh.paths.operationalPostRegistrationOutputWitnessRunnerCommandTemplate &&
      refresh.refreshedEvidence?.coverageRolloutHandoffQueueCommandReady === true &&
      refresh.refreshedEvidence?.coverageRolloutHandoffQueueItemRunnerCommandReady === true &&
      refresh.refreshedEvidence?.coverageRolloutHandoffItemRunReviewReceiptBuilderCommandReady === true &&
      refresh.refreshedEvidence?.coverageRolloutHandoffItemRunReviewReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.originalGoalReviewHandoffQueueItemRunnerCommandReady === true &&
      refresh.refreshedEvidence?.executionFollowUpHandoffQueueCommandReady === true &&
      refresh.refreshedEvidence?.executionFollowUpHandoffItemCommandBuilderReady === true &&
      refresh.refreshedEvidence?.executionFollowUpHandoffItemCommandBuilderCommandReady === true &&
      refresh.refreshedEvidence?.executionFollowUpHandoffQueueItemRunnerCommandReady === true &&
      refresh.refreshedEvidence?.executionFollowUpHandoffItemReceiptBuilderCommandReady === true &&
      refresh.refreshedEvidence?.executionFollowUpHandoffItemReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.executionApprovalGatePrepRunnerCommandReady === true &&
      refresh.refreshedEvidence?.executionApprovedGateCommandBuilderReady === true &&
      refresh.refreshedEvidence?.executionApprovedGateCommandBuilderCommandReady === true &&
      refresh.refreshedEvidence?.executionApprovedGateRunnerCommandReady === true &&
      refresh.refreshedEvidence?.operationalRegistrationApprovedCommandBuilderReady === true &&
      refresh.refreshedEvidence?.operationalRegistrationApprovedCommandBuilderCommandReady === true &&
      refresh.refreshedEvidence?.operationalRegistrationApprovedRunnerCommandReady === true &&
      refresh.refreshedEvidence?.operationalPostRegistrationOutputWitnessCommandBuilderReady === true &&
      refresh.refreshedEvidence?.operationalPostRegistrationOutputWitnessCommandBuilderCommandReady === true &&
      refresh.refreshedEvidence?.operationalPostRegistrationOutputWitnessReceiptBuilderReady === true &&
      refresh.refreshedEvidence?.operationalPostRegistrationOutputWitnessReceiptBuilderCommandReady === true &&
      refresh.refreshedEvidence?.operationalPostRegistrationOutputWitnessReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.operationalPostRegistrationOutputWitnessRunnerCommandReady === true &&
      refresh.nextCommands.some((row) =>
        row.command.includes("run-all-software-execution-approval-gate-prep-runner.mjs")
      ) &&
      refresh.nextCommands.some((row) =>
        row.command.includes("run-all-software-execution-approved-gate-runner.mjs")
      ) &&
      refresh.nextCommands.some((row) =>
        row.command.includes("create-all-software-execution-approved-gate-command-builder.mjs")
      ) &&
      refresh.nextCommands.some((row) =>
        row.command.includes("run-all-software-operational-learning-registration-approved-runner.mjs")
      ) &&
      refresh.nextCommands.some((row) =>
        row.command.includes("create-all-software-operational-post-registration-output-witness-command-builder.mjs")
      ) &&
      refresh.nextCommands.some((row) =>
        row.command.includes("create-all-software-operational-post-registration-output-witness-receipt-builder.mjs")
      ) &&
      refresh.nextCommands.some((row) =>
        row.command.includes("validate-all-software-operational-post-registration-output-witness-receipt.mjs")
      ) &&
      refresh.nextCommands.some((row) =>
        row.command.includes("create-all-software-operational-registration-approved-command-builder.mjs")
      ) &&
      refresh.nextCommands.some((row) =>
        row.command.includes("run-all-software-operational-learning-post-registration-output-witness-runner.mjs")
      ) &&
      refresh.nextCommands.some((row) =>
        row.command.includes("run-original-goal-review-handoff-queue-item.mjs")
      ) &&
      commandCenter.stages.some(
        (stage) =>
          stage.id === "execution_follow_up_receipt_builder" &&
          stage.status === "ready_for_teacher_review" &&
          stage.existingTool === "create_all_software_execution_follow_up_receipt_builder"
      ) &&
      refresh.nextCommands.some((row) => row.command === commandCenter.paths.executionFollowUpReceiptBuilderHtml),
    evidence: commandCenter.paths?.executionFollowUpReceiptBuilderHtml || "missing execution builder"
  },
  {
    name: "Current status refresh auto-feeds low-token evidence and uses formal visual preflight evidence",
    pass:
      refresh.discoveredEvidence?.lowTokenPreflightRunner === runnerFixturePath &&
      refresh.discoveredEvidence?.lowTokenPreflightLearningCycle === learningCycleFixturePath &&
      reusedOrGeneratedVisualCheckQueue &&
      existsSync(effectiveVisualCheckQueue) &&
      refresh.discoveredEvidence?.lowTokenPreflightTargetConfirmation === commandCenterVoiceWorkbench.generated?.activeTargetConfirmation &&
      existsSync(refresh.discoveredEvidence.lowTokenPreflightTargetConfirmation) &&
      lowTokenOperationPreflight.paths?.runner === runnerFixturePath &&
      lowTokenOperationPreflight.paths?.learningCycle === learningCycleFixturePath &&
      lowTokenOperationPreflight.paths?.visualCheckQueue === effectiveVisualCheckQueue &&
      lowTokenOperationPreflight.paths?.targetConfirmation === commandCenterVoiceWorkbench.generated?.activeTargetConfirmation &&
      lowTokenTriggerBudgetPlan.format === "transparent_ai_low_token_trigger_budget_plan_v1" &&
      lowTokenTriggerBudgetPlan.status === "waiting_for_teacher_low_token_trigger_budget_review" &&
      lowTokenTriggerBudgetPlan.sourceEvidence?.runnerPath === runnerFixturePath &&
      lowTokenTriggerBudgetPlan.sourceEvidence?.learningCyclePath === learningCycleFixturePath &&
      lowTokenTriggerBudgetPlan.sourceEvidence?.visualCheckQueuePath === effectiveVisualCheckQueue &&
      lowTokenTriggerBudgetPlan.sourceEvidence?.preflightPolicyPath === refresh.paths.lowTokenOperationPreflightPolicy &&
      lowTokenTriggerBudgetPlan.selectedActions.some((row) => row.route === "bounded_tail_review_before_visual_check") &&
      lowTokenTriggerBudgetPlan.selectedActions.some((row) => row.route === "compact_learning_review_only") &&
      lowTokenTriggerBudgetPlan.candidateActionCount >= lowTokenTriggerBudgetPlan.selectedActionCount &&
      lowTokenTriggerBudgetPlan.blockedActions.includes("continuous_recording") &&
      lowTokenTriggerBudgetPlan.blockedActions.includes("screenshot_without_teacher_confirmation") &&
      lowTokenTriggerBudgetPlanHtml.includes("Low Token Trigger Budget Plan") &&
      teacherActionRouter.format === "transparent_ai_original_goal_teacher_action_router_v1" &&
      teacherActionRouter.status === "waiting_for_teacher_action_route_review" &&
      teacherActionRouter.routeRows.some((row) => row.reviewEntryId === "activation_receipt_builder" && row.order === 1) &&
      teacherActionRouter.routeRows.some((row) => row.reviewEntryId === "coverage_rollout_receipt_builder" && row.coveredRowCount >= 1) &&
      teacherActionRouter.routeRows.some(
        (row) =>
          row.reviewEntryId === "execution_gap_review_cockpit" &&
          row.openPath === refresh.paths.executionGapReviewCockpitHtml &&
          row.teacherInstruction.includes("control route evidence") &&
          row.teacherInstruction.includes("action logic") &&
          row.doneCondition.includes("route evidence plus action logic") &&
          row.stopCondition.includes("medium runtime")
      ) &&
      teacherActionRouter.routeRows.some((row) => row.source === "low_token_trigger_budget_plan") &&
      teacherActionRouterHtml.includes("Original Goal Teacher Action Router") &&
      teacherActionRouterReceiptBuilderHtml.includes("Original Goal Teacher Action Router Receipt Builder") &&
      teacherActionRouterReceiptTemplate.rowDecisions.every((row) => row.teacherDecision === "needs_teacher_review") &&
      refresh.paths?.teacherActionRouter === teacherActionRouter.paths.router &&
      refresh.discoveredEvidence?.teacherActionRouter === refresh.paths.teacherActionRouter &&
      refresh.paths?.teacherActionRouterReceiptBuilder === teacherActionRouterReceiptBuilder.paths.builder &&
      refresh.paths?.teacherActionRouterReceiptBuilderHtml === teacherActionRouterReceiptBuilder.paths.html &&
      refresh.paths?.teacherActionRouterReceiptTemplate === teacherActionRouterReceiptBuilder.paths.receiptTemplate &&
      refresh.discoveredEvidence?.teacherActionRouterReceiptBuilder === refresh.paths.teacherActionRouterReceiptBuilder &&
      refresh.discoveredEvidence?.teacherActionRouterReceiptTemplate === refresh.paths.teacherActionRouterReceiptTemplate &&
      refresh.discoveredEvidence?.teacherActionRouterHandoffQueueCommandTemplate.includes("create-original-goal-teacher-action-router-handoff-queue.mjs") &&
      refresh.refreshedEvidence?.teacherActionRouterStatus === "waiting_for_teacher_action_route_review" &&
      refresh.refreshedEvidence?.teacherActionRouterRouteRowCount >= 1 &&
      refresh.refreshedEvidence?.teacherActionRouterReceiptBuilderStatus === "waiting_for_teacher_router_receipt" &&
      refresh.refreshedEvidence?.teacherActionRouterReceiptBuilderRowCount >= 1 &&
      refresh.refreshedEvidence?.teacherActionRouterReceiptBuilderReviewOnly === true &&
      existsSync(refresh.paths?.originalGoalRemainingGatesPacket || "") &&
      existsSync(refresh.paths?.originalGoalRemainingGatesPacketHtml || "") &&
      existsSync(refresh.paths?.originalGoalRemainingGatesPacketReadme || "") &&
      result.originalGoalRemainingGatesPacket === refresh.paths.originalGoalRemainingGatesPacket &&
      result.originalGoalRemainingGatesPacketHtml === refresh.paths.originalGoalRemainingGatesPacketHtml &&
      result.originalGoalRemainingGatesPacketStatus === "waiting_for_teacher_remaining_gate_review" &&
      originalGoalRemainingGatesPacket.format === "transparent_ai_original_goal_remaining_gates_packet_v1" &&
      originalGoalRemainingGatesPacket.status === "waiting_for_teacher_remaining_gate_review" &&
      originalGoalRemainingGatesPacket.counts?.gapRows === refresh.refreshedEvidence?.gapActionRows &&
      originalGoalRemainingGatesPacket.counts?.teacherRouteRows === refresh.refreshedEvidence?.teacherActionRouterRouteRowCount &&
      originalGoalRemainingGatesPacket.counts?.lowTokenSelectedActions ===
        refresh.refreshedEvidence?.lowTokenTriggerBudgetPlanSelectedActionCount &&
      originalGoalRemainingGatesPacket.completionBoundary?.completionDecision === refresh.completionDecision &&
      originalGoalRemainingGatesPacket.locks?.packetDoesNotRunCommands === true &&
      originalGoalRemainingGatesPacket.locks?.packetDoesNotExecuteTargetSoftware === true &&
      originalGoalRemainingGatesPacket.locks?.packetDoesNotCaptureScreenshots === true &&
      originalGoalRemainingGatesPacket.locks?.packetDoesNotWriteMemory === true &&
      originalGoalRemainingGatesPacketHtml.includes("Original Goal Remaining Gates Packet") &&
      existsSync(refresh.paths?.originalGoalRemainingGatesReceiptBuilder || "") &&
      existsSync(refresh.paths?.originalGoalRemainingGatesReceiptBuilderHtml || "") &&
      existsSync(refresh.paths?.originalGoalRemainingGatesReceiptBuilderReadme || "") &&
      existsSync(refresh.paths?.originalGoalRemainingGatesReceiptTemplate || "") &&
      result.originalGoalRemainingGatesReceiptBuilder === refresh.paths.originalGoalRemainingGatesReceiptBuilder &&
      result.originalGoalRemainingGatesReceiptBuilderHtml === refresh.paths.originalGoalRemainingGatesReceiptBuilderHtml &&
      result.originalGoalRemainingGatesReceiptTemplate === refresh.paths.originalGoalRemainingGatesReceiptTemplate &&
      result.originalGoalRemainingGatesReceiptBuilderStatus === "waiting_for_teacher_remaining_gates_receipt" &&
      result.originalGoalRemainingGatesReceiptValidationCommandTemplate.includes(
        "validate-original-goal-remaining-gates-receipt.mjs"
      ) &&
      result.originalGoalRemainingGatesReceiptValidationCommandTemplate.includes(
        "<teacher-filled-remaining-gates-receipt.json>"
      ) &&
      originalGoalRemainingGatesReceiptBuilder.format === "transparent_ai_original_goal_remaining_gates_receipt_builder_v1" &&
      originalGoalRemainingGatesReceiptBuilder.status === "waiting_for_teacher_remaining_gates_receipt" &&
      originalGoalRemainingGatesReceiptBuilder.counts?.reviewRows >= originalGoalRemainingGatesPacket.counts?.gateGroups &&
      originalGoalRemainingGatesReceiptBuilder.counts?.teacherRouteRows ===
        originalGoalRemainingGatesPacket.shortestTeacherRoute?.length &&
      originalGoalRemainingGatesReceiptBuilder.counts?.lowTokenActionRows ===
        originalGoalRemainingGatesPacket.counts?.lowTokenSelectedActions &&
      originalGoalRemainingGatesReceiptBuilder.locks?.builderDoesNotRunCommands === true &&
      originalGoalRemainingGatesReceiptBuilder.locks?.builderDoesNotExecuteTargetSoftware === true &&
      originalGoalRemainingGatesReceiptBuilder.locks?.builderDoesNotCaptureScreenshots === true &&
      originalGoalRemainingGatesReceiptBuilder.locks?.builderDoesNotWriteMemory === true &&
      originalGoalRemainingGatesReceiptBuilderHtml.includes("Original Goal Remaining Gates Receipt Builder") &&
      originalGoalRemainingGatesReceiptBuilderHtml.includes("Generate reviewed receipt JSON") &&
      originalGoalRemainingGatesReceiptBuilderHtml.includes("Download receipt JSON") &&
      originalGoalRemainingGatesReceiptBuilderHtml.includes("Copy validation command") &&
      originalGoalRemainingGatesReceiptBuilderHtml.includes("original_goal_remaining_gates_browser_receipt_builder") &&
      originalGoalRemainingGatesReceiptBuilder.browserReceiptBuilder?.generatesReceiptJsonInBrowser === true &&
      originalGoalRemainingGatesReceiptBuilder.browserReceiptBuilder?.downloadsReceiptJsonOnly === true &&
      originalGoalRemainingGatesReceiptBuilder.browserReceiptBuilder?.doesNotWriteReceiptToDisk === true &&
      originalGoalRemainingGatesReceiptBuilder.receiptTemplate?.format ===
        "transparent_ai_original_goal_remaining_gates_receipt_v1" &&
      originalGoalRemainingGatesReceiptTemplate.format === "transparent_ai_original_goal_remaining_gates_receipt_v1" &&
      originalGoalRemainingGatesReceiptTemplate.defaultDecision === "needs_teacher_review" &&
      originalGoalRemainingGatesReceiptTemplate.blockedActions.includes("claim_complete") &&
      refresh.paths?.originalGoalRemainingGatesReceiptValidationCommandTemplate.includes(
        "validate-original-goal-remaining-gates-receipt.mjs"
      ) &&
      existsSync(refresh.paths?.originalGoalReviewHandoffItemCommandBuilder || "") &&
      existsSync(refresh.paths?.originalGoalReviewHandoffItemCommandBuilderHtml || "") &&
      existsSync(refresh.paths?.originalGoalReviewHandoffItemCommandBuilderReadme || "") &&
      result.originalGoalReviewHandoffItemCommandBuilder === refresh.paths.originalGoalReviewHandoffItemCommandBuilder &&
      result.originalGoalReviewHandoffItemCommandBuilderHtml === refresh.paths.originalGoalReviewHandoffItemCommandBuilderHtml &&
      result.originalGoalReviewHandoffItemCommandBuilderStatus === "waiting_for_teacher_handoff_queue_path" &&
      result.originalGoalReviewHandoffItemCommandBuilderCommandTemplate.includes(
        "create-original-goal-review-handoff-item-command-builder.mjs"
      ) &&
      result.originalGoalReviewHandoffItemCommandBuilderCommandTemplate.includes(
        "<teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json>"
      ) &&
      originalGoalReviewHandoffItemCommandBuilder.format ===
        "transparent_ai_original_goal_review_handoff_item_command_builder_v1" &&
      originalGoalReviewHandoffItemCommandBuilder.status === "waiting_for_teacher_handoff_queue_path" &&
      originalGoalReviewHandoffItemCommandBuilder.queueKind === "queue_not_loaded_yet" &&
      originalGoalReviewHandoffItemCommandBuilderHtml.includes("Original Goal Review Handoff Item Command Builder") &&
      originalGoalReviewHandoffItemCommandBuilderHtml.includes("Generate single-item runner command") &&
      originalGoalReviewHandoffItemCommandBuilderHtml.includes("Download run request JSON") &&
      originalGoalReviewHandoffItemCommandBuilderHtml.includes("original_goal_review_handoff_item_command_builder") &&
      originalGoalReviewHandoffItemCommandBuilderHtml.includes(
        "&lt;teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json&gt;"
      ) &&
      originalGoalReviewHandoffItemCommandBuilder.locks?.builderDoesNotRunHandoffItem === true &&
      originalGoalReviewHandoffItemCommandBuilder.locks?.builderDoesNotExecuteTargetSoftware === true &&
      originalGoalReviewHandoffItemCommandBuilder.locks?.builderDoesNotCaptureScreenshots === true &&
      originalGoalReviewHandoffItemCommandBuilder.locks?.builderDoesNotWriteMemory === true &&
      existsSync(refresh.paths?.originalGoalCompletionBlockerMatrix || "") &&
      existsSync(refresh.paths?.originalGoalCompletionBlockerMatrixHtml || "") &&
      existsSync(refresh.paths?.originalGoalCompletionBlockerMatrixReadme || "") &&
      result.originalGoalCompletionBlockerMatrix === refresh.paths.originalGoalCompletionBlockerMatrix &&
      result.originalGoalCompletionBlockerMatrixHtml === refresh.paths.originalGoalCompletionBlockerMatrixHtml &&
      result.originalGoalCompletionBlockerMatrixStatus === "waiting_for_teacher_completion_blocker_review" &&
      result.originalGoalCompletionBlockerMatrixRows >= 7 &&
      completionBlockerMatrix.format === "transparent_ai_original_goal_completion_blocker_matrix_v1" &&
      completionBlockerMatrix.status === "waiting_for_teacher_completion_blocker_review" &&
      completionBlockerMatrix.rows.some((row) => row.lane === "all_software_low_token_coverage_evidence") &&
      completionBlockerMatrix.rows.some(
        (row) =>
          row.lane === "all_software_low_token_coverage_evidence" &&
          row.currentEvidence.includes("log-source discovery ledger linked") &&
          row.currentEvidence.includes("logSourceDiscoveryMissingRows=1") &&
          row.missingProof.includes("mapped log source") &&
          row.nextSafeAction.includes("Open the log-source discovery ledger") &&
          row.reviewCommandTemplates?.some((command) =>
            command.includes("create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs")
          ) &&
          row.reviewCommandTemplates?.some((command) =>
            command.includes("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs")
          ) &&
          row.reviewCommandTemplates?.some((command) =>
            command.includes("validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs")
          ) &&
          row.reviewCommandTemplates?.some((command) =>
            command.includes("validate-original-goal-low-token-coverage-completion-gate.mjs")
          ) &&
          row.sourcePaths.includes(logSourceDiscoveryLedgerFixturePath) &&
          row.sourcePaths.includes(logSourceDiscoveryLedgerReadmeFixturePath) &&
          row.sourcePaths.some((source) =>
            source.includes("validate-original-goal-low-token-coverage-completion-gate.mjs")
          )
      ) &&
      completionBlockerMatrix.rows.some((row) => row.lane === "unattended_operational_monitor_evidence") &&
      completionBlockerMatrix.rows.some((row) => row.lane === "universal_native_execution_control_channel") &&
      completionBlockerMatrix.rows.some((row) => row.lane === "teacher_reviewed_triggered_visual_evidence_path") &&
      completionBlockerMatrix.rows.some((row) => row.lane === "transparent_sketch_spatial_intent_teacher_export") &&
      completionBlockerMatrix.rows.some(
        (row) =>
          row.lane === "transparent_sketch_spatial_intent_teacher_export" &&
          row.currentEvidence.includes("has2D=true") &&
          row.currentEvidence.includes("hasPerspective=true") &&
          row.currentEvidence.includes("has3DDepth=true") &&
          row.currentEvidence.includes("detailLogicReady=true") &&
          row.currentEvidence.includes("existing spatial receipt validation linked") &&
          row.currentEvidence.includes("spatial route pilot-selection receipt command linked") &&
          row.currentEvidence.includes("spatial route pilot-selection receipt validation command linked") &&
          row.verifierCommand.includes("create-spatial-route-pilot-selection-receipt.mjs") &&
          row.verifierCommand.includes("<transparent_ai_spatial_route_execution_approval_prep_handoff_v1 path>") &&
          row.nextSafeAction.includes("spatial route pilot-selection receipt") &&
          row.sourcePaths.includes(refresh.paths.spatialIntentEvidenceReceiptValidation) &&
          row.sourcePaths.includes(refresh.paths.spatialRoutePilotSelectionReceiptCommandTemplate) &&
          row.sourcePaths.includes(refresh.paths.spatialRoutePilotSelectionReceiptValidationCommandTemplate) &&
          row.sourcePaths.includes(refresh.paths.spatialToSoftwareFirstBlockerHandoff)
      ) &&
      completionBlockerMatrix.rows.some((row) => row.lane === "voice_text_numbered_confirmation_supervised_execution_gate") &&
      completionBlockerMatrix.rows.some(
        (row) =>
          row.lane === "rule_dsl_delivery_gate_audit" &&
          row.verifierCommand.includes("knowledge\\create-rag-delivery-gate-audit-trail.mjs") &&
          row.verifierCommand.includes("<rag-validation-report-delivery-gate.json>") &&
          row.verifierCommand.includes("--teacher-reviewed")
      ) &&
      completionBlockerMatrix.rows.some((row) => row.lane === "rollback_evidence_before_system_change") &&
      completionBlockerMatrix.locks?.matrixDoesNotRegisterTask === true &&
      completionBlockerMatrix.locks?.matrixDoesNotExecuteTargetSoftware === true &&
      completionBlockerMatrix.locks?.matrixDoesNotCaptureScreenshots === true &&
      completionBlockerMatrix.locks?.matrixDoesNotWriteMemory === true &&
      completionBlockerMatrixHtml.includes("Original Goal Completion Blocker Matrix") &&
      completionBlockerMatrixHtml.includes("all_software_low_token_coverage_evidence") &&
      completionBlockerMatrixHtml.includes("rule_dsl_delivery_gate_audit") &&
      completionBlockerMatrixHtml.includes("log-source discovery ledger linked") &&
      completionBlockerMatrixHtml.includes("Open the log-source discovery ledger") &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerMatrix === refresh.paths.originalGoalCompletionBlockerMatrix &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerMatrixStatus ===
        "waiting_for_teacher_completion_blocker_review" &&
      refresh.refreshedEvidence?.originalGoalCompletionBlockerMatrixReady === true &&
      refresh.refreshedEvidence?.originalGoalCompletionBlockerMatrixRows >= 7 &&
      Array.isArray(refresh.refreshedEvidence?.openCompletionBlockerLanes) &&
      refresh.refreshedEvidence.openCompletionBlockerLanes.length >= 7 &&
      refresh.refreshedEvidence.openCompletionBlockerLaneCount ===
        refresh.refreshedEvidence.openCompletionBlockerLanes.length &&
      refresh.refreshedEvidence.openCompletionBlockerLanesWaitingForTeacher === true &&
      refresh.refreshedEvidence.openCompletionBlockerLanes.some(
        (lane) =>
          lane.lane === "voice_text_numbered_confirmation_supervised_execution_gate" &&
          lane.missingInputs?.includes("__SELECTED_NUMBER__") &&
          lane.commandHasPlaceholders === true
      ) &&
      refresh.refreshedEvidence.openCompletionBlockerLanes.some(
        (lane) =>
          lane.lane === "universal_native_execution_control_channel" &&
          lane.commandReviewOnlySafeToCopy === false &&
          lane.highRiskMarkers?.includes("--execute-approved-gate")
      ) &&
      result.openCompletionBlockerLaneCount === refresh.refreshedEvidence.openCompletionBlockerLaneCount &&
      result.openCompletionBlockerLanesWaitingForTeacher === true &&
      result.openCompletionBlockerLaneNumbers.some(
        (lane) =>
          lane.lane === "voice_text_numbered_confirmation_supervised_execution_gate" &&
          lane.missingInputs?.includes("__SELECTED_NUMBER__")
      ) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.originalGoalCompletionBlockerMatrixHtml) &&
      existsSync(refresh.paths?.originalGoalCompletionBlockerNextStepQueue || "") &&
      existsSync(refresh.paths?.originalGoalCompletionBlockerNextStepQueueHtml || "") &&
      existsSync(refresh.paths?.originalGoalCompletionBlockerNextStepQueueReadme || "") &&
      result.originalGoalCompletionBlockerNextStepQueue === refresh.paths.originalGoalCompletionBlockerNextStepQueue &&
      result.originalGoalCompletionBlockerNextStepQueueHtml === refresh.paths.originalGoalCompletionBlockerNextStepQueueHtml &&
      result.originalGoalCompletionBlockerNextStepQueueStatus ===
        "waiting_for_teacher_to_choose_one_completion_blocker_lane" &&
      result.originalGoalCompletionBlockerNextStepQueueItems >= 7 &&
      completionBlockerNextStepQueue.format === "transparent_ai_original_goal_completion_blocker_next_step_queue_v1" &&
      completionBlockerNextStepQueue.status === "waiting_for_teacher_to_choose_one_completion_blocker_lane" &&
      completionBlockerNextStepQueue.queueItems.some((row) => row.lane === "all_software_low_token_coverage_evidence") &&
      completionBlockerNextStepQueue.queueItems.some(
        (row) =>
          row.lane === "all_software_low_token_coverage_evidence" &&
          row.status === "ready_for_review_only_manual_follow_up" &&
          row.commandTemplate.includes("create-original-goal-low-token-coverage-evidence-dossier.mjs") &&
          row.reviewCommandTemplates?.some((command) =>
            command.includes("create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs")
          ) &&
          row.reviewCommandTemplates?.some((command) =>
            command.includes("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs")
          ) &&
          row.reviewCommandTemplates?.some((command) =>
            command.includes("validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs")
          ) &&
          row.reviewCommandTemplates?.some((command) =>
            command.includes("validate-original-goal-low-token-coverage-completion-gate.mjs")
          ) &&
          row.reviewCommandTemplates?.some((command) =>
            command.includes(refresh.paths.originalGoalLowTokenCoverageEvidenceDossier)
          ) &&
          row.reviewCommandTemplates?.some((command) =>
            command.includes(refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpit)
          ) &&
          row.reviewCommandTemplates?.some((command) =>
            command.includes(refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilder)
          ) &&
          row.reviewCommandTemplates?.some((command) =>
            command.includes(refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidation)
          ) &&
          row.missingInputs.length === 0 &&
          row.reviewCommandMissingInputs?.includes("<teacher-filled-low-token-waiting-row-cockpit-receipt.json>") &&
          row.reviewCommandMissingInputs?.includes("<teacher-filled-low-token-coverage-dossier-receipt.json>") &&
          !row.reviewCommandMissingInputs?.includes("<original-goal-low-token-coverage-evidence-dossier.json>") &&
          !row.reviewCommandMissingInputs?.includes("<original-goal-low-token-coverage-waiting-row-cockpit.json>") &&
          !row.reviewCommandMissingInputs?.includes("<original-goal-low-token-coverage-dossier-receipt-builder.json>") &&
          !row.reviewCommandMissingInputs?.includes(
            "<original-goal-low-token-coverage-dossier-receipt-validation.json>"
          ) &&
          row.reviewCommandMissingInputs.length === 2 &&
          row.commandRisk?.reviewOnlySafeToCopy === true &&
          row.reviewCommandRisk?.reviewOnlySafeToCopy === true
      ) &&
      completionBlockerNextStepQueue.queueItems.some((row) => row.lane === "rule_dsl_delivery_gate_audit") &&
      completionBlockerNextStepQueue.queueItems.some((row) => row.lane === "teacher_reviewed_triggered_visual_evidence_path") &&
      completionBlockerNextStepQueue.queueItems.some(
        (row) =>
          row.lane === "transparent_sketch_spatial_intent_teacher_export" &&
          row.status === "waiting_for_placeholder_replacement" &&
          row.commandTemplate === refresh.paths.spatialRoutePilotSelectionReceiptCommandTemplate &&
          row.missingInputs.includes("<transparent_ai_spatial_route_execution_approval_prep_handoff_v1 path>") &&
          row.missingInputs.includes("<transparent_ai_real_local_execution_pilot_selector_v1 path>") &&
          row.missingInputs.length === 2 &&
          row.commandRisk?.reviewOnlySafeToCopy === true &&
          row.evidenceLinks?.some(
            (link) => link.kind === "existing_file" && link.value === refresh.paths.spatialIntentEvidenceReceiptValidation
          ) &&
          row.evidenceLinks?.some(
            (link) =>
              link.kind === "command_template" &&
              link.value === refresh.paths.spatialRoutePilotSelectionReceiptCommandTemplate
          )
      ) &&
      completionBlockerNextStepQueue.queueItems.some((row) => row.status === "gated_until_teacher_receipt_and_rollback") &&
      completionBlockerNextStepQueue.queueItems.some(
        (row) =>
          row.lane === "voice_text_numbered_confirmation_supervised_execution_gate" &&
          row.status === "waiting_for_placeholder_replacement" &&
          row.missingInputs?.includes("__SELECTED_NUMBER__")
      ) &&
      completionBlockerNextStepQueue.counts?.placeholderItems >= 2 &&
      completionBlockerNextStepQueue.locks?.queueDoesNotRunCommands === true &&
      completionBlockerNextStepQueue.locks?.queueDoesNotExecuteTargetSoftware === true &&
      completionBlockerNextStepQueue.locks?.queueDoesNotCaptureScreenshots === true &&
      completionBlockerNextStepQueue.locks?.queueDoesNotWriteMemory === true &&
      completionBlockerNextStepQueueHtml.includes("Original Goal Completion Blocker Next-Step Queue") &&
      completionBlockerNextStepQueueHtml.includes("all_software_low_token_coverage_evidence") &&
      completionBlockerNextStepQueueHtml.includes("rule_dsl_delivery_gate_audit") &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerNextStepQueue ===
        refresh.paths.originalGoalCompletionBlockerNextStepQueue &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerNextStepQueueStatus ===
        "waiting_for_teacher_to_choose_one_completion_blocker_lane" &&
      refresh.refreshedEvidence?.originalGoalCompletionBlockerNextStepQueueReady === true &&
      refresh.refreshedEvidence?.originalGoalCompletionBlockerNextStepQueueItems >= 7 &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.originalGoalCompletionBlockerNextStepQueueHtml) &&
      existsSync(refresh.paths?.originalGoalCompletionBlockerLaneCommandBuilder || "") &&
      existsSync(refresh.paths?.originalGoalCompletionBlockerLaneCommandBuilderHtml || "") &&
      existsSync(refresh.paths?.originalGoalCompletionBlockerLaneCommandBuilderReadme || "") &&
      result.originalGoalCompletionBlockerLaneCommandBuilder ===
        refresh.paths.originalGoalCompletionBlockerLaneCommandBuilder &&
      result.originalGoalCompletionBlockerLaneCommandBuilderHtml ===
        refresh.paths.originalGoalCompletionBlockerLaneCommandBuilderHtml &&
      result.originalGoalCompletionBlockerLaneCommandBuilderStatus ===
        "waiting_for_teacher_single_completion_blocker_lane_command_generation" &&
      result.originalGoalCompletionBlockerLaneCommandBuilderItems >= 7 &&
      result.originalGoalCompletionBlockerLaneCommandBuilderOfflineRequestPackets >= 7 &&
      existsSync(result.originalGoalCompletionBlockerLaneCommandBuilderRequestPacketsDir || "") &&
      completionBlockerLaneCommandBuilder.format ===
        "transparent_ai_original_goal_completion_blocker_lane_command_builder_v1" &&
      completionBlockerLaneCommandBuilder.status ===
        "waiting_for_teacher_single_completion_blocker_lane_command_generation" &&
      completionBlockerLaneCommandBuilder.counts?.offlineRequestPackets >=
        completionBlockerLaneCommandBuilder.counts?.queueItems &&
      existsSync(completionBlockerLaneCommandBuilder.paths?.requestPacketsDir || "") &&
      completionBlockerLaneCommandBuilder.items.every((row) => existsSync(row.requestPath || "")) &&
      completionBlockerLaneCommandBuilder.items.some((row) => row.lane === "all_software_low_token_coverage_evidence") &&
      completionBlockerLaneCommandBuilder.recommendedGoalLane === "all_software_low_token_coverage_evidence" &&
      completionBlockerLaneCommandBuilder.counts?.goalProgressLanePackets === 1 &&
      completionBlockerLaneCommandBuilder.items.some(
        (row) =>
          row.lane === "all_software_low_token_coverage_evidence" &&
          row.defaultSelected === true &&
          row.goalProgressLane === true &&
          readJson(row.requestPath || "").goalProgressLane === true
      ) &&
      completionBlockerLaneCommandBuilder.items.some(
        (row) =>
          row.lane === "rule_dsl_delivery_gate_audit" &&
          row.commandTemplate.includes("knowledge\\create-rag-delivery-gate-audit-trail.mjs") &&
          row.missingInputs?.includes("<rag-validation-report-delivery-gate.json>")
      ) &&
      completionBlockerLaneCommandBuilder.items.some((row) => row.status === "gated_until_teacher_receipt_and_rollback") &&
      completionBlockerLaneCommandBuilder.items.some(
        (row) =>
          row.lane === "voice_text_numbered_confirmation_supervised_execution_gate" &&
          row.status === "waiting_for_placeholder_replacement" &&
          row.missingInputs?.includes("__SELECTED_NUMBER__")
      ) &&
      completionBlockerLaneCommandBuilder.counts?.missingInputItems >= 3 &&
      readJson(
        completionBlockerLaneCommandBuilder.items.find(
          (row) => row.lane === "voice_text_numbered_confirmation_supervised_execution_gate"
        )?.requestPath || ""
      ).placeholderReplacementRequired === true &&
      completionBlockerLaneCommandBuilder.locks?.builderDoesNotRunCommands === true &&
      completionBlockerLaneCommandBuilder.locks?.builderDoesNotExecuteTargetSoftware === true &&
      completionBlockerLaneCommandBuilder.locks?.builderDoesNotCaptureScreenshots === true &&
      completionBlockerLaneCommandBuilder.locks?.builderDoesNotWriteMemory === true &&
      completionBlockerLaneCommandBuilderHtml.includes("Original Goal Completion Blocker Lane Command Builder") &&
      completionBlockerLaneCommandBuilderHtml.includes("Generate lane command/request") &&
      completionBlockerLaneCommandBuilderHtml.includes("Recommended goal-progress lane") &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerLaneCommandBuilder ===
        refresh.paths.originalGoalCompletionBlockerLaneCommandBuilder &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerLaneCommandBuilderStatus ===
        "waiting_for_teacher_single_completion_blocker_lane_command_generation" &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerLaneCommandBuilderRequestPacketsDir ===
        completionBlockerLaneCommandBuilder.paths?.requestPacketsDir &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerLaneCommandBuilderOfflineRequestPackets >= 7 &&
      refresh.refreshedEvidence?.originalGoalCompletionBlockerLaneCommandBuilderReady === true &&
      refresh.refreshedEvidence?.originalGoalCompletionBlockerLaneCommandBuilderOfflineRequestPacketsReady === true &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.originalGoalCompletionBlockerLaneCommandBuilderHtml) &&
      refresh.nextCommands.some(
        (row) => row.command === completionBlockerLaneCommandBuilder.paths?.requestPacketsDir
      ) &&
      result.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate ===
        refresh.paths.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate &&
      result.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate ===
        refresh.paths.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate &&
      refresh.paths?.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate.includes(
        "create-original-goal-completion-blocker-lane-request-receipt-builder.mjs"
      ) &&
      refresh.paths?.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate.includes(
        "validate-original-goal-completion-blocker-lane-request-receipt.mjs"
      ) &&
      refresh.paths?.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate.includes(
        "<teacher-downloaded-completion-blocker-lane-command-request.json>"
      ) &&
      refresh.paths?.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate.includes(
        "<teacher-filled-completion-blocker-lane-request-receipt.json>"
      ) &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate ===
        refresh.paths.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate ===
        refresh.paths.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate &&
      refresh.refreshedEvidence?.originalGoalCompletionBlockerLaneRequestReceiptGateReady === true &&
      refresh.nextCommands.some(
        (row) => row.command === refresh.paths.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) => row.command === refresh.paths.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate
      ) &&
      result.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate ===
        refresh.paths.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate &&
      refresh.paths?.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate.includes(
        "run-original-goal-completion-blocker-lane-request.mjs"
      ) &&
      refresh.paths?.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate.includes("--run-reviewed-lane") &&
      refresh.paths?.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate.includes("--allow-safe-lane-runner") &&
      refresh.paths?.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate.includes("--rollback-point-created") &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate ===
        refresh.paths.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate &&
      refresh.refreshedEvidence?.originalGoalCompletionBlockerLaneRequestRunnerCommandReady === true &&
      refresh.nextCommands.some(
        (row) => row.command === refresh.paths.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate
      ) &&
      refresh.paths?.originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommandTemplate?.includes(
        "create-original-goal-completion-blocker-lane-run-review-receipt-builder.mjs"
      ) &&
      refresh.paths?.originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommandTemplate.includes(
        "<completion-blocker-lane-request-run.json>"
      ) &&
      refresh.paths?.originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate?.includes(
        "validate-original-goal-completion-blocker-lane-run-review-receipt.mjs"
      ) &&
      refresh.paths?.originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate.includes(
        "<teacher-filled-completion-blocker-lane-run-review-receipt.json>"
      ) &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommandTemplate ===
        refresh.paths.originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommandTemplate &&
      refresh.discoveredEvidence?.originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate ===
        refresh.paths.originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate &&
      refresh.refreshedEvidence?.originalGoalCompletionBlockerLaneRunReviewReceiptGateReady === true &&
      refresh.nextCommands.some(
        (row) => row.command === refresh.paths.originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) => row.command === refresh.paths.originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate
      ) &&
      readme.includes("completion blocker lane request receipt builder command") &&
      readme.includes("completion blocker lane request receipt validation command") &&
      readme.includes("Original-goal completion blocker lane request runner command") &&
      readme.includes("completion blocker lane run review receipt builder command") &&
      readme.includes("completion blocker lane run review receipt validation command") &&
      refresh.paths?.lowTokenTriggerBudgetPlanCommandTemplate.includes("create-low-token-trigger-budget-plan.mjs") &&
      refresh.paths?.triggeredVisualCheckCommandBuilder &&
      existsSync(refresh.paths.triggeredVisualCheckCommandBuilder) &&
      refresh.paths?.triggeredVisualCheckCommandBuilderHtml &&
      existsSync(refresh.paths.triggeredVisualCheckCommandBuilderHtml) &&
      refresh.paths?.triggeredVisualCheckCommandBuilderReadme &&
      existsSync(refresh.paths.triggeredVisualCheckCommandBuilderReadme) &&
      result.triggeredVisualCheckCommandBuilder === refresh.paths.triggeredVisualCheckCommandBuilder &&
      result.triggeredVisualCheckCommandBuilderHtml === refresh.paths.triggeredVisualCheckCommandBuilderHtml &&
      result.triggeredVisualCheckCommandBuilderStatus === "waiting_for_teacher_single_visual_check_command_generation" &&
      result.triggeredVisualCheckCommandBuilderCommandTemplate.includes("create-triggered-visual-check-command-builder.mjs") &&
      triggeredVisualCheckCommandBuilder.format === "transparent_ai_triggered_visual_check_command_builder_v1" &&
      triggeredVisualCheckCommandBuilder.status === "waiting_for_teacher_single_visual_check_command_generation" &&
      triggeredVisualCheckCommandBuilder.requestKind === "automatic_triggered_visual_check_queue" &&
      triggeredVisualCheckCommandBuilderHtml.includes("Triggered Visual Check Command Builder") &&
      triggeredVisualCheckCommandBuilderHtml.includes("Generate capture command") &&
      triggeredVisualCheckCommandBuilderHtml.includes("Generate learning handoff command") &&
      triggeredVisualCheckCommandBuilderHtml.includes("Generate voice-control workbench command") &&
      triggeredVisualCheckCommandBuilderHtml.includes("Download visual check command request JSON") &&
      triggeredVisualCheckCommandBuilder.locks?.builderDoesNotRunCapture === true &&
      triggeredVisualCheckCommandBuilder.locks?.builderDoesNotCaptureScreenshots === true &&
      triggeredVisualCheckCommandBuilder.locks?.builderDoesNotExecuteTargetSoftware === true &&
      triggeredVisualCheckCommandBuilder.locks?.screenshotsCaptured === false &&
      refresh.paths?.triggeredVisualCaptureCommandTemplate.includes("capture-triggered-visual-check.mjs") &&
      refresh.paths?.triggeredVisualCaptureCommandTemplate.includes("--selected-request-id") &&
      refresh.paths?.triggeredVisualCaptureCommandTemplate.includes("--teacher-confirmed") &&
      refresh.paths?.triggeredVisualCaptureCommandTemplate.includes("--reviewed-source-image") &&
      refresh.paths?.triggeredVisualLearningHandoffCommandTemplate.includes("create-triggered-visual-evidence-learning-handoff.mjs") &&
      refresh.paths?.triggeredVisualLearningHandoffCommandTemplate.includes("--capture-receipt") &&
      refresh.paths?.triggeredVisualLearningHandoffCommandTemplate.includes("--request") &&
      refresh.paths?.triggeredVisualLearningHandoffCommandTemplate.includes("<triggered-visual-check-capture-receipt.json>") &&
      refresh.paths?.triggeredVisualLearningHandoffReviewCommandTemplate.includes("run-triggered-visual-evidence-learning-handoff-review.mjs") &&
      refresh.paths?.triggeredVisualLearningHandoffReviewCommandTemplate.includes("--handoff") &&
      refresh.paths?.triggeredVisualLearningHandoffReviewCommandTemplate.includes("<triggered-visual-evidence-learning-handoff.json>") &&
      refresh.paths?.triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate.includes(
        "validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs"
      ) &&
      refresh.paths?.triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate.includes("--review") &&
      refresh.paths?.triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate.includes(
        "<teacher-filled-triggered-visual-learning-review-receipt.json>"
      ) &&
      refresh.paths?.triggeredVisualVoiceControlWorkbenchCommandTemplate.includes("create-triggered-visual-evidence-voice-control-workbench.mjs") &&
      refresh.paths?.triggeredVisualVoiceControlWorkbenchCommandTemplate.includes("--handoff") &&
      refresh.paths?.triggeredVisualVoiceControlWorkbenchCommandTemplate.includes("--command") &&
      refresh.paths?.transparentSketchDepthDemonstrationRehearsalCommandTemplate.includes("create-transparent-sketch-depth-demonstration-rehearsal.mjs") &&
      refresh.paths?.transparentSketchDepthDemonstrationRehearsalCommandTemplate.includes("--goal") &&
      refresh.paths?.transparentSketchDepthDemonstrationRehearsalCommandTemplate.includes("--software") &&
      refresh.paths?.transparentSketchDepthDemonstrationRehearsal &&
      existsSync(refresh.paths.transparentSketchDepthDemonstrationRehearsal) &&
      refresh.paths?.transparentSketchDepthDemonstrationRehearsalHtml &&
      existsSync(refresh.paths.transparentSketchDepthDemonstrationRehearsalHtml) &&
      refresh.paths?.transparentSketchDepthDemonstrationRehearsalReadme &&
      existsSync(refresh.paths.transparentSketchDepthDemonstrationRehearsalReadme) &&
      result.transparentSketchDepthDemonstrationRehearsal === refresh.paths.transparentSketchDepthDemonstrationRehearsal &&
      result.transparentSketchDepthDemonstrationRehearsalHtml === refresh.paths.transparentSketchDepthDemonstrationRehearsalHtml &&
      result.transparentSketchDepthDemonstrationRehearsalStatus === "waiting_for_teacher_numbered_spatial_target_confirmation" &&
      transparentSketchDepthDemonstrationRehearsal.format === "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1" &&
      transparentSketchDepthDemonstrationRehearsal.status === "waiting_for_teacher_numbered_spatial_target_confirmation" &&
      transparentSketchDepthDemonstrationRehearsal.capabilitiesRehearsed?.transparentDrawingMask === true &&
      transparentSketchDepthDemonstrationRehearsal.capabilitiesRehearsed?.teacher2DSketchUnderstood === true &&
      transparentSketchDepthDemonstrationRehearsal.capabilitiesRehearsed?.teacherPerspectiveSketchUnderstood === true &&
      transparentSketchDepthDemonstrationRehearsal.capabilitiesRehearsed?.teacher3DDepthSketchUnderstood === true &&
      transparentSketchDepthDemonstrationRehearsal.locks?.rehearsalDoesNotExecuteSoftware === true &&
      transparentSketchDepthDemonstrationRehearsal.locks?.rehearsalDoesNotCaptureScreenshots === true &&
      transparentSketchDepthDemonstrationRehearsal.locks?.rehearsalDoesNotWriteMemory === true &&
      transparentSketchDepthDemonstrationRehearsalHtml.includes("Transparent Sketch Depth Demonstration Rehearsal") &&
      refresh.discoveredEvidence?.lowTokenTriggerBudgetPlan === refresh.paths.lowTokenTriggerBudgetPlan &&
      refresh.discoveredEvidence?.lowTokenTriggerBudgetPlanHtml === refresh.paths.lowTokenTriggerBudgetPlanHtml &&
      refresh.discoveredEvidence?.lowTokenTriggerBudgetPlanCommandTemplate.includes("create-low-token-trigger-budget-plan.mjs") &&
      refresh.discoveredEvidence?.triggeredVisualCheckCommandBuilder === refresh.paths.triggeredVisualCheckCommandBuilder &&
      refresh.discoveredEvidence?.triggeredVisualCheckCommandBuilderHtml === refresh.paths.triggeredVisualCheckCommandBuilderHtml &&
      refresh.discoveredEvidence?.triggeredVisualCheckCommandBuilderStatus ===
        "waiting_for_teacher_single_visual_check_command_generation" &&
      refresh.discoveredEvidence?.triggeredVisualCheckCommandBuilderCommandTemplate.includes(
        "create-triggered-visual-check-command-builder.mjs"
      ) &&
      refresh.discoveredEvidence?.triggeredVisualCaptureCommandTemplate.includes("capture-triggered-visual-check.mjs") &&
      refresh.discoveredEvidence?.triggeredVisualLearningHandoffCommandTemplate.includes("create-triggered-visual-evidence-learning-handoff.mjs") &&
      refresh.discoveredEvidence?.triggeredVisualLearningHandoffReviewCommandTemplate.includes("run-triggered-visual-evidence-learning-handoff-review.mjs") &&
      refresh.discoveredEvidence?.triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate.includes(
        "validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs"
      ) &&
      refresh.discoveredEvidence?.triggeredVisualVoiceControlWorkbenchCommandTemplate.includes("create-triggered-visual-evidence-voice-control-workbench.mjs") &&
      refresh.discoveredEvidence?.transparentSketchDepthDemonstrationRehearsalCommandTemplate.includes(
        "create-transparent-sketch-depth-demonstration-rehearsal.mjs"
      ) &&
      refresh.discoveredEvidence?.transparentSketchDepthDemonstrationRehearsal === refresh.paths.transparentSketchDepthDemonstrationRehearsal &&
      refresh.discoveredEvidence?.transparentSketchDepthDemonstrationRehearsalHtml === refresh.paths.transparentSketchDepthDemonstrationRehearsalHtml &&
      refresh.discoveredEvidence?.transparentSketchDepthDemonstrationRehearsalStatus ===
        "waiting_for_teacher_numbered_spatial_target_confirmation" &&
      refresh.discoveredEvidence?.transparentSketchDepthDemonstrationRehearsalChecksPassed >= 1 &&
      refresh.discoveredEvidence?.transparentSketchDepthDemonstrationRehearsalChecksPassed ===
        refresh.discoveredEvidence?.transparentSketchDepthDemonstrationRehearsalChecksTotal &&
      refresh.refreshedEvidence?.lowTokenTriggerBudgetPlanStatus === "waiting_for_teacher_low_token_trigger_budget_review" &&
      refresh.refreshedEvidence?.lowTokenTriggerBudgetPlanSelectedActionCount >= 1 &&
      refresh.refreshedEvidence?.triggeredVisualCheckCommandBuilderReady === true &&
      refresh.refreshedEvidence?.triggeredVisualCheckCommandBuilderCommandReady === true &&
      refresh.refreshedEvidence?.triggeredVisualCaptureCommandReady === true &&
      refresh.refreshedEvidence?.triggeredVisualLearningHandoffCommandReady === true &&
      refresh.refreshedEvidence?.triggeredVisualLearningHandoffReviewCommandReady === true &&
      refresh.refreshedEvidence?.triggeredVisualLearningHandoffReviewReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.triggeredVisualVoiceControlWorkbenchCommandReady === true &&
      refresh.refreshedEvidence?.transparentSketchDepthDemonstrationRehearsalCommandReady === true &&
      refresh.refreshedEvidence?.transparentSketchDepthDemonstrationRehearsalReady === true &&
      refresh.refreshedEvidence?.originalGoalRemainingGatesPacketReady === true &&
      refresh.discoveredEvidence?.originalGoalRemainingGatesPacket === refresh.paths.originalGoalRemainingGatesPacket &&
      refresh.discoveredEvidence?.originalGoalRemainingGatesPacketStatus === "waiting_for_teacher_remaining_gate_review" &&
      refresh.discoveredEvidence?.originalGoalRemainingGatesReceiptBuilder ===
        refresh.paths.originalGoalRemainingGatesReceiptBuilder &&
      refresh.discoveredEvidence?.originalGoalRemainingGatesReceiptBuilderStatus ===
        "waiting_for_teacher_remaining_gates_receipt" &&
      refresh.discoveredEvidence?.originalGoalRemainingGatesReceiptTemplate ===
        refresh.paths.originalGoalRemainingGatesReceiptTemplate &&
      refresh.discoveredEvidence?.originalGoalRemainingGatesReceiptValidationCommandTemplate.includes(
        "validate-original-goal-remaining-gates-receipt.mjs"
      ) &&
      refresh.refreshedEvidence?.originalGoalRemainingGatesReceiptBuilderReady === true &&
      refresh.refreshedEvidence?.originalGoalRemainingGatesReceiptBuilderRowCount >= 1 &&
      refresh.refreshedEvidence?.originalGoalRemainingGatesReceiptValidationCommandReady === true &&
      refresh.discoveredEvidence?.originalGoalReviewHandoffItemCommandBuilder ===
        refresh.paths.originalGoalReviewHandoffItemCommandBuilder &&
      refresh.discoveredEvidence?.originalGoalReviewHandoffItemCommandBuilderHtml ===
        refresh.paths.originalGoalReviewHandoffItemCommandBuilderHtml &&
      refresh.discoveredEvidence?.originalGoalReviewHandoffItemCommandBuilderStatus ===
        "waiting_for_teacher_handoff_queue_path" &&
      refresh.discoveredEvidence?.originalGoalReviewHandoffItemCommandBuilderCommandTemplate.includes(
        "create-original-goal-review-handoff-item-command-builder.mjs"
      ) &&
      refresh.discoveredEvidence?.originalGoalReviewHandoffItemCommandBuilderCommandTemplate.includes(
        "<teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json>"
      ) &&
      refresh.refreshedEvidence?.originalGoalReviewHandoffItemCommandBuilderReady === true &&
      refresh.refreshedEvidence?.originalGoalReviewHandoffItemCommandBuilderCommandReady === true &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.triggeredVisualCaptureCommandTemplate) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.triggeredVisualLearningHandoffCommandTemplate) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.triggeredVisualLearningHandoffReviewCommandTemplate) &&
      refresh.nextCommands.some(
        (row) => row.command === refresh.paths.triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate
      ) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.triggeredVisualVoiceControlWorkbenchCommandTemplate) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.transparentSketchDepthDemonstrationRehearsalCommandTemplate) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.originalGoalRemainingGatesReceiptValidationCommandTemplate) &&
      refresh.nextCommands.some((row) => row.command === refresh.paths.originalGoalReviewHandoffItemCommandBuilderHtml) &&
      refresh.nextCommands.some(
        (row) => row.command === refresh.paths.originalGoalReviewHandoffItemCommandBuilderCommandTemplate
      ) &&
      !lowTokenOperationPreflight.blockers.includes("missing_low_token_runner_or_learning_cycle_evidence") &&
      !lowTokenOperationPreflight.blockers.includes("missing_triggered_visual_check_queue_policy"),
    evidence: JSON.stringify({
      preflightRunnerMatches: refresh.discoveredEvidence?.lowTokenPreflightRunner === runnerFixturePath,
      preflightLearningCycleMatches: refresh.discoveredEvidence?.lowTokenPreflightLearningCycle === learningCycleFixturePath,
      visualQueueReusedOrGenerated: Boolean(reusedOrGeneratedVisualCheckQueue),
      effectiveVisualCheckQueueExists: existsSync(effectiveVisualCheckQueue),
      targetConfirmationMatches:
        refresh.discoveredEvidence?.lowTokenPreflightTargetConfirmation ===
        commandCenterVoiceWorkbench.generated?.activeTargetConfirmation,
      preflightPolicyPathsMatch:
        lowTokenOperationPreflight.paths?.runner === runnerFixturePath &&
        lowTokenOperationPreflight.paths?.learningCycle === learningCycleFixturePath &&
        lowTokenOperationPreflight.paths?.visualCheckQueue === effectiveVisualCheckQueue &&
        lowTokenOperationPreflight.paths?.targetConfirmation ===
          commandCenterVoiceWorkbench.generated?.activeTargetConfirmation,
      triggerBudgetPlanReady:
        lowTokenTriggerBudgetPlan.format === "transparent_ai_low_token_trigger_budget_plan_v1" &&
        lowTokenTriggerBudgetPlan.status === "waiting_for_teacher_low_token_trigger_budget_review",
      teacherActionRouterReady:
        teacherActionRouter.status === "waiting_for_teacher_action_route_review" &&
        teacherActionRouterReceiptTemplate.rowDecisions.every((row) => row.teacherDecision === "needs_teacher_review"),
      remainingGatesReady:
        originalGoalRemainingGatesPacket.status === "waiting_for_teacher_remaining_gate_review" &&
        originalGoalRemainingGatesReceiptBuilder.status === "waiting_for_teacher_remaining_gates_receipt",
      reviewHandoffItemBuilderReady:
        originalGoalReviewHandoffItemCommandBuilder.status === "waiting_for_teacher_handoff_queue_path",
      completionBlockerMatrixReady:
        completionBlockerMatrix.status === "waiting_for_teacher_completion_blocker_review" &&
        completionBlockerMatrix.rows.some((row) => row.lane === "transparent_sketch_spatial_intent_teacher_export"),
      completionBlockerNextStepQueueReady:
        completionBlockerNextStepQueue.status === "waiting_for_teacher_to_choose_one_completion_blocker_lane" &&
        completionBlockerNextStepQueue.queueItems.some(
          (row) =>
            row.lane === "transparent_sketch_spatial_intent_teacher_export" &&
            row.status === "waiting_for_placeholder_replacement"
        ),
      completionBlockerLaneCommandBuilderReady:
        completionBlockerLaneCommandBuilder.status ===
          "waiting_for_teacher_single_completion_blocker_lane_command_generation" &&
        completionBlockerLaneCommandBuilder.counts?.missingInputItems >= 3,
      triggeredVisualAndDepthReady:
        triggeredVisualCheckCommandBuilder.status ===
          "waiting_for_teacher_single_visual_check_command_generation" &&
        transparentSketchDepthDemonstrationRehearsal.status ===
          "waiting_for_teacher_numbered_spatial_target_confirmation",
      refreshEvidenceReady:
        refresh.refreshedEvidence?.triggeredVisualCheckCommandBuilderReady === true &&
        refresh.refreshedEvidence?.transparentSketchDepthDemonstrationRehearsalReady === true &&
        refresh.refreshedEvidence?.originalGoalCompletionBlockerLaneRequestRunnerCommandReady === true,
      nextCommandsReady:
        refresh.nextCommands.some((row) => row.command === refresh.paths.triggeredVisualCaptureCommandTemplate) &&
        refresh.nextCommands.some(
          (row) => row.command === refresh.paths.transparentSketchDepthDemonstrationRehearsalCommandTemplate
        ) &&
        refresh.nextCommands.some(
          (row) => row.command === refresh.paths.originalGoalReviewHandoffItemCommandBuilderCommandTemplate
        ),
      resultRemainingGatesReady:
        result.originalGoalRemainingGatesPacket === refresh.paths.originalGoalRemainingGatesPacket &&
        result.originalGoalRemainingGatesReceiptBuilder === refresh.paths.originalGoalRemainingGatesReceiptBuilder &&
        result.originalGoalRemainingGatesReceiptValidationCommandTemplate?.includes(
          "validate-original-goal-remaining-gates-receipt.mjs"
        ),
      resultCompletionBlockerReady:
        result.originalGoalCompletionBlockerMatrix === refresh.paths.originalGoalCompletionBlockerMatrix &&
        result.originalGoalCompletionBlockerNextStepQueue ===
          refresh.paths.originalGoalCompletionBlockerNextStepQueue &&
        result.originalGoalCompletionBlockerLaneCommandBuilder ===
          refresh.paths.originalGoalCompletionBlockerLaneCommandBuilder &&
        result.originalGoalCompletionBlockerLaneCommandBuilderOfflineRequestPackets >= 7,
      resultVisualAndDepthReady:
        result.triggeredVisualCheckCommandBuilder === refresh.paths.triggeredVisualCheckCommandBuilder &&
        result.transparentSketchDepthDemonstrationRehearsal ===
          refresh.paths.transparentSketchDepthDemonstrationRehearsal &&
        result.transparentSketchDepthDemonstrationRehearsalStatus ===
          "waiting_for_teacher_numbered_spatial_target_confirmation",
      completionBlockerLaneItemDetailsReady:
        completionBlockerLaneCommandBuilder.items.some(
          (row) =>
            row.lane === "rule_dsl_delivery_gate_audit" &&
            row.commandTemplate.includes("knowledge\\create-rag-delivery-gate-audit-trail.mjs") &&
            row.missingInputs?.includes("<rag-validation-report-delivery-gate.json>")
        ) &&
        completionBlockerLaneCommandBuilder.items.some(
          (row) =>
            row.lane === "voice_text_numbered_confirmation_supervised_execution_gate" &&
            row.status === "waiting_for_placeholder_replacement" &&
            row.missingInputs?.includes("__SELECTED_NUMBER__")
        ),
      generatedHtmlTextReady:
        originalGoalRemainingGatesReceiptBuilderHtml.includes("Generate reviewed receipt JSON") &&
        originalGoalReviewHandoffItemCommandBuilderHtml.includes("Generate single-item runner command") &&
        completionBlockerLaneCommandBuilderHtml.includes("Recommended goal-progress lane") &&
        triggeredVisualCheckCommandBuilderHtml.includes("Generate capture command") &&
        transparentSketchDepthDemonstrationRehearsalHtml.includes(
          "Transparent Sketch Depth Demonstration Rehearsal"
        ),
      generatedCommandTemplatesReady:
        refresh.paths?.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate.includes(
          "run-original-goal-completion-blocker-lane-request.mjs"
        ) &&
        refresh.paths?.triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate.includes(
          "validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs"
        ) &&
        refresh.paths?.transparentSketchDepthDemonstrationRehearsalCommandTemplate.includes(
          "create-transparent-sketch-depth-demonstration-rehearsal.mjs"
        ),
      triggerBudgetPlanDetailsReady:
        lowTokenTriggerBudgetPlan.sourceEvidence?.runnerPath === runnerFixturePath &&
        lowTokenTriggerBudgetPlan.sourceEvidence?.learningCyclePath === learningCycleFixturePath &&
        lowTokenTriggerBudgetPlan.sourceEvidence?.visualCheckQueuePath === effectiveVisualCheckQueue &&
        lowTokenTriggerBudgetPlan.sourceEvidence?.preflightPolicyPath === refresh.paths.lowTokenOperationPreflightPolicy &&
        lowTokenTriggerBudgetPlan.selectedActions.some(
          (row) => row.route === "bounded_tail_review_before_visual_check"
        ) &&
        lowTokenTriggerBudgetPlan.selectedActions.some((row) => row.route === "compact_learning_review_only") &&
        lowTokenTriggerBudgetPlan.candidateActionCount >= lowTokenTriggerBudgetPlan.selectedActionCount &&
        lowTokenTriggerBudgetPlan.blockedActions.includes("continuous_recording") &&
        lowTokenTriggerBudgetPlan.blockedActions.includes("screenshot_without_teacher_confirmation") &&
        lowTokenTriggerBudgetPlanHtml.includes("Low Token Trigger Budget Plan"),
      teacherActionRouterDetailsReady:
        teacherActionRouter.routeRows.some((row) => row.reviewEntryId === "activation_receipt_builder" && row.order === 1) &&
        teacherActionRouter.routeRows.some(
          (row) => row.reviewEntryId === "coverage_rollout_receipt_builder" && row.coveredRowCount >= 1
        ) &&
        teacherActionRouter.routeRows.some(
          (row) =>
            row.reviewEntryId === "execution_gap_review_cockpit" &&
            row.openPath === refresh.paths.executionGapReviewCockpitHtml &&
            row.teacherInstruction.includes("control route evidence") &&
            row.teacherInstruction.includes("action logic") &&
            row.doneCondition.includes("route evidence plus action logic") &&
            row.stopCondition.includes("medium runtime")
        ) &&
        teacherActionRouter.routeRows.some((row) => row.source === "low_token_trigger_budget_plan") &&
        teacherActionRouterHtml.includes("Original Goal Teacher Action Router") &&
        teacherActionRouterReceiptBuilderHtml.includes("Original Goal Teacher Action Router Receipt Builder"),
      remainingGateDetailsReady:
        originalGoalRemainingGatesPacket.counts?.gapRows === refresh.refreshedEvidence?.gapActionRows &&
        originalGoalRemainingGatesPacket.counts?.teacherRouteRows ===
          refresh.refreshedEvidence?.teacherActionRouterRouteRowCount &&
        originalGoalRemainingGatesPacket.counts?.lowTokenSelectedActions ===
          refresh.refreshedEvidence?.lowTokenTriggerBudgetPlanSelectedActionCount &&
        originalGoalRemainingGatesPacket.completionBoundary?.completionDecision === refresh.completionDecision &&
        originalGoalRemainingGatesPacket.locks?.packetDoesNotRunCommands === true &&
        originalGoalRemainingGatesReceiptBuilder.counts?.reviewRows >=
          originalGoalRemainingGatesPacket.counts?.gateGroups &&
        originalGoalRemainingGatesReceiptTemplate.defaultDecision === "needs_teacher_review" &&
        originalGoalRemainingGatesReceiptTemplate.blockedActions.includes("claim_complete"),
      completionBlockerMatrixDetailsReady:
        completionBlockerMatrix.rows.some(
          (row) =>
            row.lane === "all_software_low_token_coverage_evidence" &&
            row.currentEvidence.includes("log-source discovery ledger linked") &&
            row.currentEvidence.includes("logSourceDiscoveryMissingRows=1") &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes("validate-original-goal-low-token-coverage-completion-gate.mjs")
            )
        ) &&
        completionBlockerMatrix.rows.some(
          (row) =>
            row.lane === "transparent_sketch_spatial_intent_teacher_export" &&
            row.currentEvidence.includes("spatial route pilot-selection receipt command linked") &&
            row.verifierCommand.includes("create-spatial-route-pilot-selection-receipt.mjs")
        ) &&
        refresh.refreshedEvidence?.openCompletionBlockerLaneCount ===
          refresh.refreshedEvidence?.openCompletionBlockerLanes?.length,
      laneBuilderRequestDetailsReady:
        existsSync(completionBlockerLaneCommandBuilder.paths?.requestPacketsDir || "") &&
        completionBlockerLaneCommandBuilder.items.every((row) => existsSync(row.requestPath || "")) &&
        completionBlockerLaneCommandBuilder.recommendedGoalLane === "all_software_low_token_coverage_evidence" &&
        completionBlockerLaneCommandBuilder.counts?.goalProgressLanePackets === 1 &&
        readJson(
          completionBlockerLaneCommandBuilder.items.find(
            (row) => row.lane === "voice_text_numbered_confirmation_supervised_execution_gate"
          )?.requestPath || ""
        ).placeholderReplacementRequired === true &&
        completionBlockerLaneCommandBuilder.locks?.builderDoesNotRunCommands === true &&
        completionBlockerLaneCommandBuilderHtml.includes("Original Goal Completion Blocker Lane Command Builder"),
      laneReceiptAndRunnerCommandsReady:
        refresh.paths?.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate.includes(
          "create-original-goal-completion-blocker-lane-request-receipt-builder.mjs"
        ) &&
        refresh.paths?.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate.includes(
          "validate-original-goal-completion-blocker-lane-request-receipt.mjs"
        ) &&
        refresh.paths?.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate.includes("--allow-safe-lane-runner") &&
        refresh.paths?.originalGoalCompletionBlockerLaneRunReviewReceiptBuilderCommandTemplate?.includes(
          "create-original-goal-completion-blocker-lane-run-review-receipt-builder.mjs"
        ) &&
        refresh.paths?.originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate?.includes(
          "validate-original-goal-completion-blocker-lane-run-review-receipt.mjs"
        ) &&
        readme.includes("completion blocker lane request receipt builder command") &&
        readme.includes("completion blocker lane run review receipt validation command"),
      triggeredVisualTemplateDetailsReady:
        triggeredVisualCheckCommandBuilder.locks?.builderDoesNotRunCapture === true &&
        refresh.paths?.triggeredVisualCaptureCommandTemplate.includes("--teacher-confirmed") &&
        refresh.paths?.triggeredVisualLearningHandoffCommandTemplate.includes(
          "<triggered-visual-check-capture-receipt.json>"
        ) &&
        refresh.paths?.triggeredVisualLearningHandoffReviewCommandTemplate.includes(
          "<triggered-visual-evidence-learning-handoff.json>"
        ) &&
        refresh.paths?.triggeredVisualVoiceControlWorkbenchCommandTemplate.includes(
          "create-triggered-visual-evidence-voice-control-workbench.mjs"
        ),
      refreshDiscoveryFieldsReady:
        refresh.discoveredEvidence?.lowTokenTriggerBudgetPlan === refresh.paths.lowTokenTriggerBudgetPlan &&
        refresh.discoveredEvidence?.triggeredVisualCheckCommandBuilder ===
          refresh.paths.triggeredVisualCheckCommandBuilder &&
        refresh.discoveredEvidence?.transparentSketchDepthDemonstrationRehearsal ===
          refresh.paths.transparentSketchDepthDemonstrationRehearsal &&
        refresh.discoveredEvidence?.transparentSketchDepthDemonstrationRehearsalChecksPassed ===
          refresh.discoveredEvidence?.transparentSketchDepthDemonstrationRehearsalChecksTotal &&
        refresh.refreshedEvidence?.lowTokenTriggerBudgetPlanSelectedActionCount >= 1,
      openCompletionBlockerLaneResultReady:
        Array.isArray(refresh.refreshedEvidence?.openCompletionBlockerLanes) &&
        refresh.refreshedEvidence.openCompletionBlockerLanes.length >= 7 &&
        refresh.refreshedEvidence.openCompletionBlockerLanesWaitingForTeacher === true &&
        refresh.refreshedEvidence.openCompletionBlockerLanes.some(
          (lane) =>
            lane.lane === "universal_native_execution_control_channel" &&
            lane.commandReviewOnlySafeToCopy === false &&
            lane.highRiskMarkers?.includes("--execute-approved-gate")
        ) &&
        result.openCompletionBlockerLaneCount === refresh.refreshedEvidence.openCompletionBlockerLaneCount &&
        result.openCompletionBlockerLanesWaitingForTeacher === true &&
        result.openCompletionBlockerLaneNumbers.some(
          (lane) =>
            lane.lane === "voice_text_numbered_confirmation_supervised_execution_gate" &&
            lane.missingInputs?.includes("__SELECTED_NUMBER__")
        ),
      nextStepQueueDetailsReady:
        result.originalGoalCompletionBlockerNextStepQueue ===
          refresh.paths.originalGoalCompletionBlockerNextStepQueue &&
        result.originalGoalCompletionBlockerNextStepQueueStatus ===
          "waiting_for_teacher_to_choose_one_completion_blocker_lane" &&
        completionBlockerNextStepQueue.queueItems.some(
          (row) =>
            row.lane === "all_software_low_token_coverage_evidence" &&
            row.reviewCommandMissingInputs?.includes(
              "<teacher-filled-low-token-coverage-dossier-receipt.json>"
            ) &&
            row.reviewCommandMissingInputs.length === 2
        ) &&
        completionBlockerNextStepQueue.queueItems.some((row) => row.status === "gated_until_teacher_receipt_and_rollback") &&
        completionBlockerNextStepQueue.counts?.placeholderItems >= 2 &&
        completionBlockerNextStepQueue.locks?.queueDoesNotRunCommands === true &&
        refresh.refreshedEvidence?.originalGoalCompletionBlockerNextStepQueueReady === true,
      laneBuilderResultAndDiscoveryReady:
        result.originalGoalCompletionBlockerLaneCommandBuilder ===
          refresh.paths.originalGoalCompletionBlockerLaneCommandBuilder &&
        result.originalGoalCompletionBlockerLaneCommandBuilderRequestPacketsDir ===
          completionBlockerLaneCommandBuilder.paths?.requestPacketsDir &&
        refresh.discoveredEvidence?.originalGoalCompletionBlockerLaneCommandBuilderRequestPacketsDir ===
          completionBlockerLaneCommandBuilder.paths?.requestPacketsDir &&
        refresh.refreshedEvidence?.originalGoalCompletionBlockerLaneCommandBuilderOfflineRequestPacketsReady === true &&
        refresh.nextCommands.some((row) => row.command === refresh.paths.originalGoalCompletionBlockerLaneCommandBuilderHtml) &&
        refresh.nextCommands.some((row) => row.command === completionBlockerLaneCommandBuilder.paths?.requestPacketsDir),
      laneRequestResultCommandsReady:
        result.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate ===
          refresh.paths.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate &&
        result.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate ===
          refresh.paths.originalGoalCompletionBlockerLaneRequestReceiptValidationCommandTemplate &&
        result.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate ===
          refresh.paths.originalGoalCompletionBlockerLaneRequestRunnerCommandTemplate &&
        refresh.discoveredEvidence?.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate ===
          refresh.paths.originalGoalCompletionBlockerLaneRequestReceiptBuilderCommandTemplate &&
        refresh.discoveredEvidence?.originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate ===
          refresh.paths.originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate &&
        refresh.refreshedEvidence?.originalGoalCompletionBlockerLaneRunReviewReceiptGateReady === true &&
        refresh.nextCommands.some(
          (row) => row.command === refresh.paths.originalGoalCompletionBlockerLaneRunReviewReceiptValidationCommandTemplate
        ),
      rawTeacherRouterPathBlockReady:
        refresh.paths?.teacherActionRouter === teacherActionRouter.paths.router &&
        refresh.discoveredEvidence?.teacherActionRouter === refresh.paths.teacherActionRouter &&
        refresh.paths?.teacherActionRouterReceiptBuilder === teacherActionRouterReceiptBuilder.paths.builder &&
        refresh.paths?.teacherActionRouterReceiptBuilderHtml === teacherActionRouterReceiptBuilder.paths.html &&
        refresh.paths?.teacherActionRouterReceiptTemplate === teacherActionRouterReceiptBuilder.paths.receiptTemplate &&
        refresh.discoveredEvidence?.teacherActionRouterReceiptBuilder === refresh.paths.teacherActionRouterReceiptBuilder &&
        refresh.discoveredEvidence?.teacherActionRouterReceiptTemplate === refresh.paths.teacherActionRouterReceiptTemplate &&
        refresh.discoveredEvidence?.teacherActionRouterHandoffQueueCommandTemplate.includes(
          "create-original-goal-teacher-action-router-handoff-queue.mjs"
        ) &&
        refresh.refreshedEvidence?.teacherActionRouterStatus === "waiting_for_teacher_action_route_review" &&
        refresh.refreshedEvidence?.teacherActionRouterRouteRowCount >= 1 &&
        refresh.refreshedEvidence?.teacherActionRouterReceiptBuilderStatus === "waiting_for_teacher_router_receipt" &&
        refresh.refreshedEvidence?.teacherActionRouterReceiptBuilderRowCount >= 1 &&
        refresh.refreshedEvidence?.teacherActionRouterReceiptBuilderReviewOnly === true,
      rawRemainingGateBlockReady:
        existsSync(refresh.paths?.originalGoalRemainingGatesPacket || "") &&
        existsSync(refresh.paths?.originalGoalRemainingGatesPacketHtml || "") &&
        existsSync(refresh.paths?.originalGoalRemainingGatesPacketReadme || "") &&
        result.originalGoalRemainingGatesPacket === refresh.paths.originalGoalRemainingGatesPacket &&
        result.originalGoalRemainingGatesPacketHtml === refresh.paths.originalGoalRemainingGatesPacketHtml &&
        result.originalGoalRemainingGatesPacketStatus === "waiting_for_teacher_remaining_gate_review" &&
        originalGoalRemainingGatesPacket.format === "transparent_ai_original_goal_remaining_gates_packet_v1" &&
        originalGoalRemainingGatesPacket.status === "waiting_for_teacher_remaining_gate_review" &&
        originalGoalRemainingGatesPacket.counts?.gapRows === refresh.refreshedEvidence?.gapActionRows &&
        originalGoalRemainingGatesPacket.counts?.teacherRouteRows ===
          refresh.refreshedEvidence?.teacherActionRouterRouteRowCount &&
        originalGoalRemainingGatesPacket.counts?.lowTokenSelectedActions ===
          refresh.refreshedEvidence?.lowTokenTriggerBudgetPlanSelectedActionCount &&
        originalGoalRemainingGatesPacket.completionBoundary?.completionDecision === refresh.completionDecision &&
        originalGoalRemainingGatesPacket.locks?.packetDoesNotRunCommands === true &&
        originalGoalRemainingGatesPacket.locks?.packetDoesNotExecuteTargetSoftware === true &&
        originalGoalRemainingGatesPacket.locks?.packetDoesNotCaptureScreenshots === true &&
        originalGoalRemainingGatesPacket.locks?.packetDoesNotWriteMemory === true &&
        originalGoalRemainingGatesPacketHtml.includes("Original Goal Remaining Gates Packet") &&
        existsSync(refresh.paths?.originalGoalRemainingGatesReceiptBuilder || "") &&
        existsSync(refresh.paths?.originalGoalRemainingGatesReceiptBuilderHtml || "") &&
        existsSync(refresh.paths?.originalGoalRemainingGatesReceiptBuilderReadme || "") &&
        existsSync(refresh.paths?.originalGoalRemainingGatesReceiptTemplate || "") &&
        result.originalGoalRemainingGatesReceiptBuilder === refresh.paths.originalGoalRemainingGatesReceiptBuilder &&
        result.originalGoalRemainingGatesReceiptBuilderHtml ===
          refresh.paths.originalGoalRemainingGatesReceiptBuilderHtml &&
        result.originalGoalRemainingGatesReceiptTemplate === refresh.paths.originalGoalRemainingGatesReceiptTemplate &&
        result.originalGoalRemainingGatesReceiptBuilderStatus === "waiting_for_teacher_remaining_gates_receipt" &&
        result.originalGoalRemainingGatesReceiptValidationCommandTemplate.includes(
          "validate-original-goal-remaining-gates-receipt.mjs"
        ) &&
        result.originalGoalRemainingGatesReceiptValidationCommandTemplate.includes(
          "<teacher-filled-remaining-gates-receipt.json>"
        ) &&
        originalGoalRemainingGatesReceiptBuilder.format ===
          "transparent_ai_original_goal_remaining_gates_receipt_builder_v1" &&
        originalGoalRemainingGatesReceiptBuilder.status === "waiting_for_teacher_remaining_gates_receipt" &&
        originalGoalRemainingGatesReceiptBuilder.counts?.reviewRows >=
          originalGoalRemainingGatesPacket.counts?.gateGroups &&
        originalGoalRemainingGatesReceiptBuilder.counts?.teacherRouteRows ===
          originalGoalRemainingGatesPacket.shortestTeacherRoute?.length &&
        originalGoalRemainingGatesReceiptBuilder.counts?.lowTokenActionRows ===
          originalGoalRemainingGatesPacket.counts?.lowTokenSelectedActions &&
        originalGoalRemainingGatesReceiptBuilder.locks?.builderDoesNotRunCommands === true &&
        originalGoalRemainingGatesReceiptBuilder.locks?.builderDoesNotExecuteTargetSoftware === true &&
        originalGoalRemainingGatesReceiptBuilder.locks?.builderDoesNotCaptureScreenshots === true &&
        originalGoalRemainingGatesReceiptBuilder.locks?.builderDoesNotWriteMemory === true &&
        originalGoalRemainingGatesReceiptBuilderHtml.includes("Original Goal Remaining Gates Receipt Builder") &&
        originalGoalRemainingGatesReceiptBuilderHtml.includes("Generate reviewed receipt JSON") &&
        originalGoalRemainingGatesReceiptBuilderHtml.includes("Download receipt JSON") &&
        originalGoalRemainingGatesReceiptBuilderHtml.includes("Copy validation command") &&
        originalGoalRemainingGatesReceiptBuilderHtml.includes(
          "original_goal_remaining_gates_browser_receipt_builder"
        ) &&
        originalGoalRemainingGatesReceiptBuilder.browserReceiptBuilder?.generatesReceiptJsonInBrowser === true &&
        originalGoalRemainingGatesReceiptBuilder.browserReceiptBuilder?.downloadsReceiptJsonOnly === true &&
        originalGoalRemainingGatesReceiptBuilder.browserReceiptBuilder?.doesNotWriteReceiptToDisk === true &&
        originalGoalRemainingGatesReceiptBuilder.receiptTemplate?.format ===
          "transparent_ai_original_goal_remaining_gates_receipt_v1" &&
        originalGoalRemainingGatesReceiptTemplate.format ===
          "transparent_ai_original_goal_remaining_gates_receipt_v1" &&
        originalGoalRemainingGatesReceiptTemplate.defaultDecision === "needs_teacher_review" &&
        originalGoalRemainingGatesReceiptTemplate.blockedActions.includes("claim_complete") &&
        refresh.paths?.originalGoalRemainingGatesReceiptValidationCommandTemplate.includes(
          "validate-original-goal-remaining-gates-receipt.mjs"
        ),
      rawReviewHandoffBlockReady:
        existsSync(refresh.paths?.originalGoalReviewHandoffItemCommandBuilder || "") &&
        existsSync(refresh.paths?.originalGoalReviewHandoffItemCommandBuilderHtml || "") &&
        existsSync(refresh.paths?.originalGoalReviewHandoffItemCommandBuilderReadme || "") &&
        result.originalGoalReviewHandoffItemCommandBuilder ===
          refresh.paths.originalGoalReviewHandoffItemCommandBuilder &&
        result.originalGoalReviewHandoffItemCommandBuilderHtml ===
          refresh.paths.originalGoalReviewHandoffItemCommandBuilderHtml &&
        result.originalGoalReviewHandoffItemCommandBuilderStatus === "waiting_for_teacher_handoff_queue_path" &&
        result.originalGoalReviewHandoffItemCommandBuilderCommandTemplate.includes(
          "create-original-goal-review-handoff-item-command-builder.mjs"
        ) &&
        result.originalGoalReviewHandoffItemCommandBuilderCommandTemplate.includes(
          "<teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json>"
        ) &&
        originalGoalReviewHandoffItemCommandBuilder.format ===
          "transparent_ai_original_goal_review_handoff_item_command_builder_v1" &&
        originalGoalReviewHandoffItemCommandBuilder.status === "waiting_for_teacher_handoff_queue_path" &&
        originalGoalReviewHandoffItemCommandBuilder.queueKind === "queue_not_loaded_yet" &&
        originalGoalReviewHandoffItemCommandBuilderHtml.includes(
          "Original Goal Review Handoff Item Command Builder"
        ) &&
        originalGoalReviewHandoffItemCommandBuilderHtml.includes("Generate single-item runner command") &&
        originalGoalReviewHandoffItemCommandBuilderHtml.includes("Download run request JSON") &&
        originalGoalReviewHandoffItemCommandBuilderHtml.includes("original_goal_review_handoff_item_command_builder") &&
        originalGoalReviewHandoffItemCommandBuilderHtml.includes(
          "&lt;teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json&gt;"
        ) &&
        originalGoalReviewHandoffItemCommandBuilder.locks?.builderDoesNotRunHandoffItem === true &&
        originalGoalReviewHandoffItemCommandBuilder.locks?.builderDoesNotExecuteTargetSoftware === true &&
        originalGoalReviewHandoffItemCommandBuilder.locks?.builderDoesNotCaptureScreenshots === true &&
        originalGoalReviewHandoffItemCommandBuilder.locks?.builderDoesNotWriteMemory === true,
      rawCompletionBlockerMatrixAndOpenLaneBlockReady:
        existsSync(refresh.paths?.originalGoalCompletionBlockerMatrix || "") &&
        existsSync(refresh.paths?.originalGoalCompletionBlockerMatrixHtml || "") &&
        existsSync(refresh.paths?.originalGoalCompletionBlockerMatrixReadme || "") &&
        result.originalGoalCompletionBlockerMatrix === refresh.paths.originalGoalCompletionBlockerMatrix &&
        result.originalGoalCompletionBlockerMatrixHtml === refresh.paths.originalGoalCompletionBlockerMatrixHtml &&
        result.originalGoalCompletionBlockerMatrixStatus === "waiting_for_teacher_completion_blocker_review" &&
        result.originalGoalCompletionBlockerMatrixRows >= 7 &&
        completionBlockerMatrix.format === "transparent_ai_original_goal_completion_blocker_matrix_v1" &&
        completionBlockerMatrix.status === "waiting_for_teacher_completion_blocker_review" &&
        completionBlockerMatrix.rows.some((row) => row.lane === "all_software_low_token_coverage_evidence") &&
        completionBlockerMatrix.rows.some(
          (row) =>
            row.lane === "all_software_low_token_coverage_evidence" &&
            row.currentEvidence.includes("log-source discovery ledger linked") &&
            row.currentEvidence.includes("logSourceDiscoveryMissingRows=1") &&
            row.missingProof.includes("mapped log source") &&
            row.nextSafeAction.includes("Open the log-source discovery ledger") &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes("create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs")
            ) &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs")
            ) &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes("validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs")
            ) &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes("validate-original-goal-low-token-coverage-completion-gate.mjs")
            ) &&
            row.sourcePaths.includes(logSourceDiscoveryLedgerFixturePath) &&
            row.sourcePaths.includes(logSourceDiscoveryLedgerReadmeFixturePath) &&
            row.sourcePaths.some((source) =>
              source.includes("validate-original-goal-low-token-coverage-completion-gate.mjs")
            )
        ) &&
        completionBlockerMatrix.rows.some((row) => row.lane === "unattended_operational_monitor_evidence") &&
        completionBlockerMatrix.rows.some((row) => row.lane === "universal_native_execution_control_channel") &&
        completionBlockerMatrix.rows.some((row) => row.lane === "teacher_reviewed_triggered_visual_evidence_path") &&
        completionBlockerMatrix.rows.some((row) => row.lane === "transparent_sketch_spatial_intent_teacher_export") &&
        completionBlockerMatrix.rows.some(
          (row) =>
            row.lane === "transparent_sketch_spatial_intent_teacher_export" &&
            row.currentEvidence.includes("has2D=true") &&
            row.currentEvidence.includes("hasPerspective=true") &&
            row.currentEvidence.includes("has3DDepth=true") &&
            row.currentEvidence.includes("detailLogicReady=true") &&
            row.currentEvidence.includes("existing spatial receipt validation linked") &&
            row.currentEvidence.includes("spatial route pilot-selection receipt command linked") &&
            row.currentEvidence.includes("spatial route pilot-selection receipt validation command linked") &&
            row.verifierCommand.includes("create-spatial-route-pilot-selection-receipt.mjs") &&
            row.verifierCommand.includes("<transparent_ai_spatial_route_execution_approval_prep_handoff_v1 path>") &&
            row.nextSafeAction.includes("spatial route pilot-selection receipt") &&
            row.sourcePaths.includes(refresh.paths.spatialIntentEvidenceReceiptValidation) &&
            row.sourcePaths.includes(refresh.paths.spatialRoutePilotSelectionReceiptCommandTemplate) &&
            row.sourcePaths.includes(refresh.paths.spatialRoutePilotSelectionReceiptValidationCommandTemplate) &&
            row.sourcePaths.includes(refresh.paths.spatialToSoftwareFirstBlockerHandoff)
        ) &&
        completionBlockerMatrix.rows.some(
          (row) => row.lane === "voice_text_numbered_confirmation_supervised_execution_gate"
        ) &&
        completionBlockerMatrix.rows.some(
          (row) =>
            row.lane === "rule_dsl_delivery_gate_audit" &&
            row.verifierCommand.includes("knowledge\\create-rag-delivery-gate-audit-trail.mjs") &&
            row.verifierCommand.includes("<rag-validation-report-delivery-gate.json>") &&
            row.verifierCommand.includes("--teacher-reviewed")
        ) &&
        completionBlockerMatrix.rows.some((row) => row.lane === "rollback_evidence_before_system_change") &&
        completionBlockerMatrix.locks?.matrixDoesNotRegisterTask === true &&
        completionBlockerMatrix.locks?.matrixDoesNotExecuteTargetSoftware === true &&
        completionBlockerMatrix.locks?.matrixDoesNotCaptureScreenshots === true &&
        completionBlockerMatrix.locks?.matrixDoesNotWriteMemory === true &&
        completionBlockerMatrixHtml.includes("Original Goal Completion Blocker Matrix") &&
        completionBlockerMatrixHtml.includes("all_software_low_token_coverage_evidence") &&
        completionBlockerMatrixHtml.includes("rule_dsl_delivery_gate_audit") &&
        completionBlockerMatrixHtml.includes("log-source discovery ledger linked") &&
        completionBlockerMatrixHtml.includes("Open the log-source discovery ledger") &&
        refresh.discoveredEvidence?.originalGoalCompletionBlockerMatrix ===
          refresh.paths.originalGoalCompletionBlockerMatrix &&
        refresh.discoveredEvidence?.originalGoalCompletionBlockerMatrixStatus ===
          "waiting_for_teacher_completion_blocker_review" &&
        refresh.refreshedEvidence?.originalGoalCompletionBlockerMatrixReady === true &&
        refresh.refreshedEvidence?.originalGoalCompletionBlockerMatrixRows >= 7 &&
        Array.isArray(refresh.refreshedEvidence?.openCompletionBlockerLanes) &&
        refresh.refreshedEvidence.openCompletionBlockerLanes.length >= 7 &&
        refresh.refreshedEvidence.openCompletionBlockerLaneCount ===
          refresh.refreshedEvidence.openCompletionBlockerLanes.length &&
        refresh.refreshedEvidence.openCompletionBlockerLanesWaitingForTeacher === true &&
        refresh.refreshedEvidence.openCompletionBlockerLanes.some(
          (lane) =>
            lane.lane === "voice_text_numbered_confirmation_supervised_execution_gate" &&
            lane.missingInputs?.includes("__SELECTED_NUMBER__") &&
            lane.commandHasPlaceholders === true
        ) &&
        refresh.refreshedEvidence.openCompletionBlockerLanes.some(
          (lane) =>
            lane.lane === "universal_native_execution_control_channel" &&
            lane.commandReviewOnlySafeToCopy === false &&
            lane.highRiskMarkers?.includes("--execute-approved-gate")
        ) &&
        result.openCompletionBlockerLaneCount === refresh.refreshedEvidence.openCompletionBlockerLaneCount &&
        result.openCompletionBlockerLanesWaitingForTeacher === true &&
        result.openCompletionBlockerLaneNumbers.some(
          (lane) =>
            lane.lane === "voice_text_numbered_confirmation_supervised_execution_gate" &&
            lane.missingInputs?.includes("__SELECTED_NUMBER__")
        ) &&
        refresh.nextCommands.some((row) => row.command === refresh.paths.originalGoalCompletionBlockerMatrixHtml),
      rawNextStepQueueBlockReady:
        existsSync(refresh.paths?.originalGoalCompletionBlockerNextStepQueue || "") &&
        existsSync(refresh.paths?.originalGoalCompletionBlockerNextStepQueueHtml || "") &&
        existsSync(refresh.paths?.originalGoalCompletionBlockerNextStepQueueReadme || "") &&
        result.originalGoalCompletionBlockerNextStepQueue ===
          refresh.paths.originalGoalCompletionBlockerNextStepQueue &&
        result.originalGoalCompletionBlockerNextStepQueueHtml ===
          refresh.paths.originalGoalCompletionBlockerNextStepQueueHtml &&
        result.originalGoalCompletionBlockerNextStepQueueStatus ===
          "waiting_for_teacher_to_choose_one_completion_blocker_lane" &&
        result.originalGoalCompletionBlockerNextStepQueueItems >= 7 &&
        completionBlockerNextStepQueue.format ===
          "transparent_ai_original_goal_completion_blocker_next_step_queue_v1" &&
        completionBlockerNextStepQueue.status === "waiting_for_teacher_to_choose_one_completion_blocker_lane" &&
        completionBlockerNextStepQueue.queueItems.some(
          (row) => row.lane === "all_software_low_token_coverage_evidence"
        ) &&
        completionBlockerNextStepQueue.queueItems.some(
          (row) =>
            row.lane === "all_software_low_token_coverage_evidence" &&
            row.status === "ready_for_review_only_manual_follow_up" &&
            row.commandTemplate.includes("create-original-goal-low-token-coverage-evidence-dossier.mjs") &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes("create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs")
            ) &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs")
            ) &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes("validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs")
            ) &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes("validate-original-goal-low-token-coverage-completion-gate.mjs")
            ) &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes(refresh.paths.originalGoalLowTokenCoverageEvidenceDossier)
            ) &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes(refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpit)
            ) &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes(refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilder)
            ) &&
            row.reviewCommandTemplates?.some((command) =>
              command.includes(refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidation)
            ) &&
            row.missingInputs.length === 0 &&
            row.reviewCommandMissingInputs?.includes("<teacher-filled-low-token-waiting-row-cockpit-receipt.json>") &&
            row.reviewCommandMissingInputs?.includes("<teacher-filled-low-token-coverage-dossier-receipt.json>") &&
            !row.reviewCommandMissingInputs?.includes("<original-goal-low-token-coverage-evidence-dossier.json>") &&
            !row.reviewCommandMissingInputs?.includes("<original-goal-low-token-coverage-waiting-row-cockpit.json>") &&
            !row.reviewCommandMissingInputs?.includes(
              "<original-goal-low-token-coverage-dossier-receipt-builder.json>"
            ) &&
            !row.reviewCommandMissingInputs?.includes(
              "<original-goal-low-token-coverage-dossier-receipt-validation.json>"
            ) &&
            row.reviewCommandMissingInputs.length === 2 &&
            row.commandRisk?.reviewOnlySafeToCopy === true &&
            row.reviewCommandRisk?.reviewOnlySafeToCopy === true
        ) &&
        completionBlockerNextStepQueue.queueItems.some((row) => row.lane === "rule_dsl_delivery_gate_audit") &&
        completionBlockerNextStepQueue.queueItems.some(
          (row) => row.lane === "teacher_reviewed_triggered_visual_evidence_path"
        ) &&
        completionBlockerNextStepQueue.queueItems.some(
          (row) =>
            row.lane === "transparent_sketch_spatial_intent_teacher_export" &&
            row.status === "waiting_for_placeholder_replacement" &&
            row.commandTemplate === refresh.paths.spatialRoutePilotSelectionReceiptCommandTemplate &&
            row.missingInputs.includes("<transparent_ai_spatial_route_execution_approval_prep_handoff_v1 path>") &&
            row.missingInputs.includes("<transparent_ai_real_local_execution_pilot_selector_v1 path>") &&
            row.missingInputs.length === 2 &&
            row.commandRisk?.reviewOnlySafeToCopy === true &&
            row.evidenceLinks?.some(
              (link) =>
                link.kind === "existing_file" && link.value === refresh.paths.spatialIntentEvidenceReceiptValidation
            ) &&
            row.evidenceLinks?.some(
              (link) =>
                link.kind === "command_template" &&
                link.value === refresh.paths.spatialRoutePilotSelectionReceiptCommandTemplate
            )
        ) &&
        completionBlockerNextStepQueue.queueItems.some(
          (row) => row.status === "gated_until_teacher_receipt_and_rollback"
        ) &&
        completionBlockerNextStepQueue.queueItems.some(
          (row) =>
            row.lane === "voice_text_numbered_confirmation_supervised_execution_gate" &&
            row.status === "waiting_for_placeholder_replacement" &&
            row.missingInputs?.includes("__SELECTED_NUMBER__")
        ) &&
        completionBlockerNextStepQueue.counts?.placeholderItems >= 2 &&
        completionBlockerNextStepQueue.locks?.queueDoesNotRunCommands === true &&
        completionBlockerNextStepQueue.locks?.queueDoesNotExecuteTargetSoftware === true &&
        completionBlockerNextStepQueue.locks?.queueDoesNotCaptureScreenshots === true &&
        completionBlockerNextStepQueue.locks?.queueDoesNotWriteMemory === true &&
        completionBlockerNextStepQueueHtml.includes("Original Goal Completion Blocker Next-Step Queue") &&
        completionBlockerNextStepQueueHtml.includes("all_software_low_token_coverage_evidence") &&
        completionBlockerNextStepQueueHtml.includes("rule_dsl_delivery_gate_audit") &&
        refresh.discoveredEvidence?.originalGoalCompletionBlockerNextStepQueue ===
          refresh.paths.originalGoalCompletionBlockerNextStepQueue &&
        refresh.discoveredEvidence?.originalGoalCompletionBlockerNextStepQueueStatus ===
          "waiting_for_teacher_to_choose_one_completion_blocker_lane" &&
        refresh.refreshedEvidence?.originalGoalCompletionBlockerNextStepQueueReady === true &&
        refresh.refreshedEvidence?.originalGoalCompletionBlockerNextStepQueueItems >= 7 &&
        refresh.nextCommands.some((row) => row.command === refresh.paths.originalGoalCompletionBlockerNextStepQueueHtml),
      preflightBlockers: lowTokenOperationPreflight.blockers
    })
  },
  {
    name: "Current status refresh routes remaining teacher confirmations through a shortest review-only action router",
    pass:
      teacherActionRouter.format === "transparent_ai_original_goal_teacher_action_router_v1" &&
      teacherActionRouter.status === "waiting_for_teacher_action_route_review" &&
      teacherActionRouter.locks.routerDoesNotValidateReceipts === true &&
      teacherActionRouter.locks.routerDoesNotRegisterTask === true &&
      teacherActionRouter.locks.routerDoesNotExecuteTargetSoftware === true &&
      teacherActionRouter.locks.routerDoesNotCaptureScreenshots === true &&
      teacherActionRouter.locks.goalComplete === false &&
      teacherActionRouter.routeRows.some((row) => row.reviewEntryId === "activation_receipt_builder" && row.order === 1) &&
      teacherActionRouter.routeRows.some((row) => row.reviewEntryId === "coverage_rollout_receipt_builder" && row.coveredRowCount >= 1) &&
      teacherActionRouter.routeRows.some((row) => row.source === "low_token_trigger_budget_plan") &&
      teacherActionRouterHtml.includes("Original Goal Teacher Action Router") &&
      teacherActionRouterReceiptBuilderHtml.includes("Original Goal Teacher Action Router Receipt Builder") &&
      teacherActionRouterReceiptTemplate.rowDecisions.every((row) => row.teacherDecision === "needs_teacher_review") &&
      refresh.paths?.teacherActionRouter === teacherActionRouter.paths.router &&
      refresh.paths?.teacherActionRouterHtml === teacherActionRouter.paths.html &&
      refresh.paths?.teacherActionRouterReceiptBuilder === teacherActionRouterReceiptBuilder.paths.builder &&
      refresh.paths?.teacherActionRouterReceiptBuilderHtml === teacherActionRouterReceiptBuilder.paths.html &&
      refresh.paths?.teacherActionRouterReceiptTemplate === teacherActionRouterReceiptBuilder.paths.receiptTemplate &&
      refresh.discoveredEvidence?.teacherActionRouter === refresh.paths.teacherActionRouter &&
      refresh.discoveredEvidence?.teacherActionRouterReceiptBuilder === refresh.paths.teacherActionRouterReceiptBuilder &&
      refresh.discoveredEvidence?.teacherActionRouterReceiptTemplate === refresh.paths.teacherActionRouterReceiptTemplate &&
      refresh.discoveredEvidence?.teacherActionRouterHandoffQueueCommandTemplate.includes("create-original-goal-teacher-action-router-handoff-queue.mjs") &&
      refresh.refreshedEvidence?.teacherActionRouterStatus === "waiting_for_teacher_action_route_review" &&
      refresh.refreshedEvidence?.teacherActionRouterRouteRowCount >= 1 &&
      refresh.refreshedEvidence?.teacherActionRouterReceiptBuilderStatus === "waiting_for_teacher_router_receipt" &&
      refresh.refreshedEvidence?.teacherActionRouterReceiptBuilderReviewOnly === true,
    evidence: refresh.paths?.teacherActionRouterHtml || "missing teacher action router"
  },
  {
    name: "Current status refresh audits review entrypoints after pages are written",
    pass:
      reviewEntrypointHealthAudit.format === "transparent_ai_original_goal_review_entrypoint_health_audit_v1" &&
      reviewEntrypointHealthAudit.status === "all_required_review_entrypoints_openable" &&
      reviewEntrypointHealthAudit.counts.failedRequired === 0 &&
      refresh.paths.reviewEntrypointHealthAuditHtml === reviewEntrypointHealthAudit.paths.html &&
      refresh.refreshedEvidence.reviewEntrypointHealthAuditStatus === "all_required_review_entrypoints_openable" &&
      refresh.refreshedEvidence.reviewEntrypointHealthAuditFailedRequired === 0 &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "review_entrypoint_health_audit" && link.path === refresh.paths.reviewEntrypointHealthAuditHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "original_goal_capability_matrix_coverage_audit" &&
          link.path === refresh.paths.originalGoalCapabilityMatrixCoverageAuditHtml
      ) &&
      reviewEntrypointHealthAudit.entries?.some(
        (entry) =>
          entry.label === "Original goal capability matrix coverage audit" &&
          entry.status === "openable"
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label === "Open review entrypoint health audit before trying linked teacher pages" &&
          row.command === refresh.paths.reviewEntrypointHealthAuditHtml
      ) &&
      reviewEntrypointHealthAuditHtml.includes("Original Goal Review Entrypoint Health") &&
      readme.includes("Review entrypoint health audit:") &&
      dashboard.includes("Review entrypoint health"),
    evidence: refresh.paths.reviewEntrypointHealthAuditHtml
  },
  {
    name: "Current status refresh surfaces transparent sketch implementation audit separately from teacher intent evidence",
    pass:
      refresh.paths?.sketchDemonstrationImplementationAudit === sketchImplementationAuditFixturePath &&
      refresh.discoveredEvidence?.sketchDemonstrationImplementationAudit === sketchImplementationAuditFixturePath &&
      refresh.discoveredEvidence?.sketchDemonstrationImplementationAuditStatus === "passed" &&
      refresh.discoveredEvidence?.sketchDemonstrationImplementationAuditSummary?.teacher2DSketchUnderstood === true &&
      refresh.discoveredEvidence?.sketchDemonstrationImplementationAuditSummary?.teacherPerspectiveSketchUnderstood === true &&
      refresh.discoveredEvidence?.sketchDemonstrationImplementationAuditSummary?.teacher3DDepthSketchUnderstood === true &&
      refresh.discoveredEvidence?.sketchDemonstrationImplementationAuditSummary?.unattendedNativeUniversalExecutionProven === false &&
      refresh.refreshedEvidence?.sketchDemonstrationImplementationAuditReady === true &&
      refresh.refreshedEvidence?.sketchDemonstrationImplementationAuditStatus === "passed" &&
      refresh.refreshedEvidence?.sketchDemonstrationImplementationAuditSummary?.transparentDrawingMaskImplemented === true &&
      refresh.refreshedEvidence?.sketchDemonstrationImplementationAuditBoundary ===
        "transparent_2d_perspective_3d_teacher_evidence_ready_but_unattended_native_universal_execution_unproven" &&
      refresh.refreshedEvidence?.transparentSketch2DPerspective3DImplemented === true &&
      refresh.refreshedEvidence?.transparentSketchImplementationAuditReviewOnly === true &&
      refresh.refreshedEvidence?.formalSpatialIntentEvidencePresent === true &&
      refresh.refreshedEvidence?.spatialIntentEvidenceReceiptValidationReady === true &&
      refresh.refreshedEvidence?.spatialIntentEvidenceRequestReady === false &&
      result.sketchDemonstrationImplementationAudit === sketchImplementationAuditFixturePath &&
      result.sketchDemonstrationImplementationAuditStatus === "passed" &&
      result.transparentSketch2DPerspective3DImplemented === true &&
      result.formalSpatialIntentEvidencePresent === true &&
      result.spatialIntentEvidenceReceiptValidationReady === true &&
      result.transparentSketch2DPerspective3DBoundary ===
        "transparent_2d_perspective_3d_teacher_evidence_ready_but_unattended_native_universal_execution_unproven" &&
      readme.includes("Transparent sketch 2D perspective 3D implementation audit status: passed") &&
      readme.includes("Transparent sketch 2D perspective 3D implementation summary:") &&
      dashboard.includes("Transparent sketch implementation status") &&
      dashboard.includes("universal unattended native execution remains unproven"),
    evidence: JSON.stringify({
      implementationAudit: refresh.discoveredEvidence?.sketchDemonstrationImplementationAudit,
      formalSpatialIntentEvidencePresent: refresh.refreshedEvidence?.formalSpatialIntentEvidencePresent
    })
  },
  {
    name: "Current status refresh indexes operational activation evidence chain without claiming registration",
    pass:
      refresh.paths?.operationalActivationGate === operationalActivationGateFixturePath &&
      refresh.paths?.operationalActivationGateReadme === operationalActivationGateReadmeFixturePath &&
      refresh.paths?.operationalActivationDryRunRehearsal === operationalDryRunFixturePath &&
      refresh.paths?.operationalRegistrationExecuteGate === operationalExecuteGateFixturePath &&
      refresh.paths?.operationalPostActivationWitness === operationalWitnessFixturePath &&
      existsSync(refresh.paths?.operationalPostActivationWitnessReceiptBuilder) &&
      existsSync(refresh.paths?.operationalPostActivationWitnessReceiptBuilderHtml) &&
      operationalPostActivationWitnessReceiptBuilderHtml.includes("Post-Activation Witness Receipt Builder") &&
      refresh.refreshedEvidence?.operationalActivationChainEvidenceCount === 4 &&
      refresh.refreshedEvidence?.operationalActivationGateReady === true &&
      refresh.refreshedEvidence?.operationalActivationGateReviewOnly === true &&
      refresh.refreshedEvidence?.operationalActivationDryRunRehearsalReady === true &&
      refresh.refreshedEvidence?.operationalActivationDryRunRehearsalNoSystemChange === true &&
      refresh.refreshedEvidence?.operationalRegistrationExecuteGateReady === true &&
      refresh.refreshedEvidence?.operationalRegistrationExecuteGatePreparedNotExecuted === true &&
      refresh.refreshedEvidence?.operationalPostActivationWitnessReady === true &&
      refresh.refreshedEvidence?.operationalPostActivationWitnessRemainingGapCount === 1 &&
      refresh.refreshedEvidence?.operationalPostActivationWitnessReceiptBuilderReady === true &&
      refresh.refreshedEvidence?.operationalPostActivationWitnessReceiptBuilderReviewOnly === true &&
      refresh.discoveredEvidence?.operationalPostActivationWitnessReceiptBuilder ===
        refresh.paths?.operationalPostActivationWitnessReceiptBuilder &&
      refresh.discoveredEvidence?.operationalPostActivationWitnessReceiptValidationCommandTemplate.includes(
        "validate-all-software-operational-post-activation-witness-receipt.mjs"
      ) &&
      refresh.discoveredEvidence?.operationalPostActivationWitnessReceiptValidationCommandTemplate.includes(
        "<teacher-filled-post-activation-witness-evidence-receipt.json>"
      ) &&
      operationalPostActivationWitnessReceiptBuilder.locks.builderDoesNotRegisterTask === true &&
      operationalPostActivationWitnessReceiptBuilder.locks.builderDoesNotRerunWitness === true &&
      operationalPostActivationWitnessReceiptBuilder.locks.softwareActionsExecuted === false &&
      refresh.discoveredEvidence?.operationalActivationGateStatus === "activation_dry_run_ready_for_teacher_registration_review" &&
      refresh.discoveredEvidence?.operationalActivationDryRunRehearsalStatus === "passed_no_system_change" &&
      refresh.discoveredEvidence?.operationalRegistrationExecuteGateStatus === "ready_for_teacher_registration_execute_review" &&
      refresh.discoveredEvidence?.operationalPostActivationWitnessStatus === "waiting_for_post_activation_registration_status" &&
      refresh.locks?.scheduledTaskRegistered === false &&
      refresh.locks?.goalComplete === false,
    evidence: JSON.stringify({
      activationChainEvidenceCount: refresh.refreshedEvidence?.operationalActivationChainEvidenceCount,
      witnessStatus: refresh.discoveredEvidence?.operationalPostActivationWitnessStatus,
      locks: {
        scheduledTaskRegistered: refresh.locks?.scheduledTaskRegistered,
        goalComplete: refresh.locks?.goalComplete
      }
    })
  },
  {
    name: "Current status refresh carries coverage and execution convergence evidence into the gap board",
    pass:
      refresh.discoveredEvidence?.coverageConvergence === coverageConvergenceFixturePath &&
      refresh.discoveredEvidence?.coverageRolloutReceiptBuilderDiscoveredBeforeRefresh === coverageReceiptBuilderFixturePath &&
      refresh.discoveredEvidence?.coverageRolloutReceiptBuilderHtml &&
      refresh.paths?.coverageRolloutReceiptBuilder === refresh.discoveredEvidence?.coverageRolloutReceiptBuilder &&
      refresh.paths?.coverageRolloutReceiptBuilderHtml === refresh.discoveredEvidence?.coverageRolloutReceiptBuilderHtml &&
      refresh.paths?.coverageRolloutReceiptBuilderDiscoveredBeforeRefresh === coverageReceiptBuilderFixturePath &&
      result.coverageRolloutReceiptBuilder === refresh.paths?.coverageRolloutReceiptBuilder &&
      result.coverageRolloutReceiptBuilderHtml === refresh.paths?.coverageRolloutReceiptBuilderHtml &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpReceiptBuilder === coverageEnrollmentReceiptBuilderFixturePath &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpReceiptBuilderHtml === coverageEnrollmentReceiptBuilderHtmlFixturePath &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpReceiptTemplate === coverageEnrollmentReceiptTemplateFixturePath &&
      refresh.discoveredEvidence?.coverageRolloutHandoffQueueCommandTemplate.includes(
        "create-all-software-coverage-rollout-handoff-queue.mjs"
      ) &&
      refresh.discoveredEvidence?.coverageRolloutHandoffItemRunReviewReceiptBuilderCommandTemplate.includes(
        "create-all-software-coverage-rollout-handoff-item-run-review-receipt-builder.mjs"
      ) &&
      refresh.discoveredEvidence?.coverageRolloutHandoffItemRunReviewReceiptValidationCommandTemplate.includes(
        "validate-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs"
      ) &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpHandoffQueueCommandTemplate.includes(
        "create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs"
      ) &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpHandoffQueueItemRunnerCommandTemplate.includes(
        "run-all-software-coverage-enrollment-follow-up-handoff-queue-item.mjs"
      ) &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpHandoffItemCommandBuilderHtml &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate.includes(
        "create-all-software-coverage-enrollment-follow-up-handoff-item-command-builder.mjs"
      ) &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate.includes(
        "create-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt-builder.mjs"
      ) &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate.includes(
        "validate-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs"
      ) &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpRowCount === 1 &&
      refresh.discoveredEvidence?.coverageEnrollmentLedger === coverageEnrollmentLedgerFixturePath &&
      refresh.discoveredEvidence?.coverageEnrollmentLedgerReadme === coverageEnrollmentLedgerReadmeFixturePath &&
      refresh.discoveredEvidence?.coverageEnrollmentLedgerRowCount === 3 &&
      refresh.discoveredEvidence?.coverageEnrollmentLedgerNextReviewQueueCount === 2 &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpPlan === coverageEnrollmentFollowUpPlanFixturePath &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpPlanReadme === coverageEnrollmentFollowUpPlanReadmeFixturePath &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpPlanItemCount === 2 &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpBatch &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpBatch !== coverageEnrollmentFollowUpBatchFixturePath &&
      existsSync(refresh.discoveredEvidence.coverageEnrollmentFollowUpBatch) &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpBatchReadme &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpBatchReadme !== coverageEnrollmentFollowUpBatchReadmeFixturePath &&
      existsSync(refresh.discoveredEvidence.coverageEnrollmentFollowUpBatchReadme) &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpBatchTeacherReviewed === false &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpBatchRanToolCount === 0 &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpBatchSelectedItemCount === 2 &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpBatchAutoPreviewed === true &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpBatchPreviewRefreshReason ===
        "coverage_enrollment_follow_up_batch_preview_older_than_plan" &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpBatchCoversCurrentPlan === true &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpReconciliation === coverageEnrollmentFollowUpReconciliationFixturePath &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpReconciliationReadme === coverageEnrollmentFollowUpReconciliationReadmeFixturePath &&
      refresh.discoveredEvidence?.coverageEnrollmentFollowUpReconciliationStatus === "waiting_for_teacher_review" &&
      refresh.paths?.coverageEnrollmentFollowUpReceiptBuilder === coverageEnrollmentReceiptBuilderFixturePath &&
      refresh.paths?.coverageRolloutHandoffQueueCommandTemplate.includes(
        "create-all-software-coverage-rollout-handoff-queue.mjs"
      ) &&
      refresh.paths?.coverageRolloutHandoffItemRunReviewReceiptBuilderCommandTemplate.includes(
        "create-all-software-coverage-rollout-handoff-item-run-review-receipt-builder.mjs"
      ) &&
      refresh.paths?.coverageRolloutHandoffItemRunReviewReceiptValidationCommandTemplate.includes(
        "validate-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs"
      ) &&
      refresh.paths?.coverageEnrollmentFollowUpHandoffQueueCommandTemplate.includes(
        "create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs"
      ) &&
      refresh.paths?.coverageEnrollmentFollowUpHandoffQueueItemRunnerCommandTemplate.includes(
        "run-all-software-coverage-enrollment-follow-up-handoff-queue-item.mjs"
      ) &&
      refresh.paths?.coverageEnrollmentFollowUpHandoffItemCommandBuilderHtml &&
      refresh.paths?.coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandTemplate.includes(
        "create-all-software-coverage-enrollment-follow-up-handoff-item-command-builder.mjs"
      ) &&
      refresh.paths?.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandTemplate.includes(
        "create-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt-builder.mjs"
      ) &&
      refresh.paths?.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandTemplate.includes(
        "validate-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs"
      ) &&
      refresh.paths?.coverageEnrollmentLedger === coverageEnrollmentLedgerFixturePath &&
      refresh.paths?.coverageEnrollmentFollowUpPlan === coverageEnrollmentFollowUpPlanFixturePath &&
      refresh.paths?.coverageEnrollmentFollowUpBatch === refresh.discoveredEvidence?.coverageEnrollmentFollowUpBatch &&
      refresh.paths?.coverageEnrollmentFollowUpReconciliation === coverageEnrollmentFollowUpReconciliationFixturePath &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpReceiptBuilderReady === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpReceiptBuilderReviewOnly === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpReceiptBuilderDoesNotRunBatch === true &&
      refresh.refreshedEvidence?.coverageRolloutHandoffQueueCommandReady === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpHandoffQueueCommandReady === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpHandoffItemCommandBuilderReady === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpHandoffItemCommandBuilderCommandReady === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpHandoffQueueItemRunnerCommandReady === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilderCommandReady === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.coverageEnrollmentEvidenceChainCount === 5 &&
      refresh.refreshedEvidence?.coverageEnrollmentLedgerReady === true &&
      refresh.refreshedEvidence?.coverageEnrollmentLedgerReviewOnly === true &&
      refresh.refreshedEvidence?.coverageEnrollmentLedgerRowCount === 3 &&
      refresh.refreshedEvidence?.coverageEnrollmentLedgerNextReviewQueueCount === 2 &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpPlanReady === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpPlanItemCount === 2 &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpPlanReviewOnly === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpBatchReady === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpBatchTeacherReviewed === false &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpBatchRanToolCount === 0 &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpBatchSelectedItemCount === 2 &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpBatchAutoPreviewed === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpBatchPreviewRefreshReason ===
        "coverage_enrollment_follow_up_batch_preview_older_than_plan" &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpBatchCoversCurrentPlan === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpBatchNoTargetSoftwareExecution === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpReconciliationReady === true &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpReconciliationStatus === "waiting_for_teacher_review" &&
      refresh.refreshedEvidence?.coverageEnrollmentFollowUpReconciliationReviewOnly === true &&
      refresh.discoveredEvidence?.executionConvergence === originalGoalExecutionConvergenceFixturePath &&
      refresh.discoveredEvidence?.executionConvergence !== executionConvergenceFixturePath &&
      gapBoard.sourceEvidence?.coverageConvergence === coverageConvergenceFixturePath &&
      gapBoard.sourceEvidence?.coverageRolloutReceiptBuilder === coverageReceiptBuilderFixturePath &&
      gapBoard.sourceEvidence?.executionConvergence === originalGoalExecutionConvergenceFixturePath &&
      gapBoard.sourceEvidence?.executionFollowUpBatch === executionFollowUpBatchPath &&
      gapBoard.sourceEvidence?.spatialIntentEvidenceRequest === refresh.paths.spatialIntentEvidenceRequest &&
      gapBoard.actionRows.some((row) => row.id === "coverage_coverage-batch-1" && row.lane === "all_software_low_token_coverage") &&
      executionReconciliationReviewRow?.lane === "all_software_execution_capability" &&
      executionReconciliationReviewRow?.teacherDecision === "needs_teacher_review" &&
      executionReconciliationReviewRow?.locks?.reviewOnly === true &&
      executionReconciliationReviewRow?.locks?.softwareActionsExecuted === false &&
      executionReconciliationReviewRow?.blockedTeacherDecisions?.includes("accepted") &&
      executionReconciliationReviewRow?.nextSafeCommand?.includes(executionFollowUpBatchPath) &&
      gapBoard.actionRows.some(
        (row) =>
          row.id === "coverage_coverage-batch-1" &&
          row.nextSafeCommand === coverageReceiptBuilderHtmlFixturePath &&
          row.nextSafeActionLabel.includes("existing coverage rollout receipt builder") &&
          row.evidencePath === coverageReceiptBuilderFixturePath &&
          !row.nextSafeCommand.includes("--teacher-reviewed")
      ) &&
      executionReconciliationReviewRow?.nextSafeCommand?.includes("create-all-software-execution-follow-up-receipt-builder.mjs") &&
      executionReconciliationReviewRow?.nextSafeCommand?.includes(executionFollowUpBatchPath) &&
      !executionReconciliationReviewRow?.nextSafeCommand?.includes("--teacher-reviewed") &&
      executionActionLogicSourceReviewRow?.lane === "all_software_execution_capability" &&
      executionActionLogicSourceReviewRow?.teacherDecision === "needs_teacher_review" &&
      executionActionLogicSourceReviewRow?.locks?.reviewOnly === true &&
      executionActionLogicSourceReviewRow?.locks?.targetSoftwareCommandsExecuted === false &&
      executionActionLogicSourceReviewRow?.nextSafeActionLabel?.includes("action logic source contract package") &&
      executionActionLogicSourceReviewRow?.nextSafeCommand?.includes("create-all-software-action-logic-source-contract-package.mjs") &&
      executionActionLogicSourceReviewRow?.nextSafeCommand?.includes(executionFollowUpBatchPath) &&
      !executionActionLogicSourceReviewRow?.nextSafeCommand?.includes("create-all-software-execution-follow-up-receipt-builder.mjs") &&
      gapBoard.actionRows.some(
        (row) =>
          row.id === "status_lane_execution_capability" &&
          row.nextSafeCommand.includes("create-all-software-execution-follow-up-receipt-builder.mjs") &&
          row.nextSafeCommand.includes(executionFollowUpBatchPath) &&
          !row.nextSafeCommand.includes("--teacher-reviewed")
      ) &&
      spatialIntentGapRow === undefined &&
      commandCenter.paths?.originalGoalGapActionBoard &&
      existsSync(commandCenter.paths.originalGoalGapActionBoard),
    evidence: JSON.stringify({
      sourceEvidence: gapBoard.sourceEvidence,
      rows: gapBoard.actionRows.map((row) => row.id)
    })
  },
  {
    name: "Current status refresh surfaces direct teacher review entry points",
    pass:
      result.teacherReviewCockpit === refresh.paths.teacherReviewCockpit &&
      result.teacherReviewCockpitHtml === refresh.paths.teacherReviewCockpitHtml &&
      result.teacherReviewCockpitReadme === refresh.paths.teacherReviewCockpitReadme &&
      result.teacherReviewCockpitReceiptTemplate === refresh.paths.teacherReviewCockpitReceiptTemplate &&
      result.teacherReviewCockpitReceiptValidationCommandTemplate === refresh.paths.teacherReviewCockpitReceiptValidationCommandTemplate &&
      result.teacherReviewCockpitHandoffQueueCommandTemplate === refresh.paths.teacherReviewCockpitHandoffQueueCommandTemplate &&
      result.originalGoalReviewHandoffQueueItemRunnerCommandTemplate ===
        refresh.paths.originalGoalReviewHandoffQueueItemRunnerCommandTemplate &&
      refresh.paths.teacherReviewCockpit === commandCenter.paths.teacherReviewCockpit &&
      refresh.paths.teacherReviewCockpitHtml === commandCenter.paths.teacherReviewCockpitHtml &&
      refresh.paths.teacherReviewCockpitReceiptTemplate === commandCenter.paths.teacherReviewCockpitReceiptTemplate &&
      teacherReviewCockpit.format === "transparent_ai_goal_teacher_review_cockpit_v1" &&
      teacherReviewCockpit.locks?.reviewOnly === true &&
      teacherReviewCockpit.locks?.cockpitDoesNotRunCommands === true &&
      teacherReviewCockpitHtml.includes("goal_teacher_review_cockpit_browser_receipt_builder") &&
      teacherReviewCockpitReceiptTemplate.format === "transparent_ai_goal_teacher_review_cockpit_receipt_v1" &&
      refresh.refreshedEvidence?.teacherReviewCockpitReady === true &&
      refresh.refreshedEvidence?.teacherReviewCockpitHtmlReady === true &&
      refresh.refreshedEvidence?.teacherReviewCockpitReviewOnly === true &&
      refresh.refreshedEvidence?.teacherReviewCockpitHandoffQueueCommandReady === true &&
      refresh.refreshedEvidence?.originalGoalReviewHandoffQueueItemRunnerCommandReady === true &&
      refresh.discoveredEvidence?.teacherReviewCockpit === refresh.paths.teacherReviewCockpit &&
      refresh.discoveredEvidence?.teacherReviewCockpitHtml === refresh.paths.teacherReviewCockpitHtml &&
      refresh.discoveredEvidence?.teacherReviewCockpitReceiptValidationCommandTemplate.includes("validate-goal-teacher-review-cockpit-receipt.mjs") &&
      refresh.discoveredEvidence?.teacherReviewCockpitHandoffQueueCommandTemplate.includes("create-goal-teacher-review-cockpit-handoff-queue.mjs") &&
      refresh.paths.currentGoalStartHere === currentGoalStartHereFixturePath &&
      refresh.paths.currentGoalStartHereHtml === currentGoalStartHereHtmlFixturePath &&
      refresh.paths.currentGoalRealLocalTrialPackage === currentGoalRealLocalTrialFixturePath &&
      refresh.paths.currentGoalRealLocalTrialPackageHtml === currentGoalRealLocalTrialHtmlFixturePath &&
      refresh.refreshedEvidence?.currentGoalStartHereStatus === "stable_start_here_ready_review_only_goal_not_complete" &&
      refresh.refreshedEvidence?.currentGoalStartHereEntryLinks === 2 &&
      refresh.refreshedEvidence?.currentGoalStartHereGoalComplete === false &&
      refresh.refreshedEvidence?.currentGoalRealLocalTrialPackageStatus ===
        "real_local_trial_evidence_ready_review_only_goal_not_complete" &&
      refresh.refreshedEvidence?.currentGoalRealLocalTrialPackageChecksPassed === 10 &&
      refresh.refreshedEvidence?.currentGoalRealLocalTrialPackageChecksTotal === 10 &&
      refresh.refreshedEvidence?.currentGoalRealLocalTrialPackageSampleSoftware === "FixtureApp" &&
      refresh.refreshedEvidence?.currentGoalRealLocalTrialPackageGoalComplete === false &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "current_goal_start_here" && link.path === currentGoalStartHereHtmlFixturePath
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "current_goal_real_local_trial_package" && link.path === currentGoalRealLocalTrialHtmlFixturePath
      ) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "teacher_review_cockpit" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "activation_receipt_builder" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "coverage_rollout_receipt_builder" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "coverage_enrollment_follow_up_receipt_builder" && link.path === coverageEnrollmentReceiptBuilderHtmlFixturePath
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "coverage_enrollment_follow_up_receipt_template" && link.path === coverageEnrollmentReceiptTemplateFixturePath
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "coverage_enrollment_follow_up_handoff_item_command_builder" &&
          link.path === refresh.paths.coverageEnrollmentFollowUpHandoffItemCommandBuilderHtml &&
          existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "coverage_enrollment_ledger" && link.path === coverageEnrollmentLedgerReadmeFixturePath) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "coverage_enrollment_follow_up_plan" && link.path === coverageEnrollmentFollowUpPlanReadmeFixturePath
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "coverage_enrollment_follow_up_batch" &&
          link.path === refresh.paths.coverageEnrollmentFollowUpBatchReadme &&
          existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "coverage_enrollment_follow_up_reconciliation" &&
          link.path === coverageEnrollmentFollowUpReconciliationReadmeFixturePath
      ) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "execution_follow_up_receipt_builder" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "execution_gap_review_cockpit" && link.path === refresh.paths.executionGapReviewCockpitHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "execution_gap_review_cockpit_receipt_template" && link.path === refresh.paths.executionGapReviewCockpitReceiptTemplate
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "control_channel_repair_receipt_builder" && link.path === refresh.paths.controlChannelRepairReceiptBuilderHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "control_channel_repair_receipt_template" && link.path === refresh.paths.controlChannelRepairReceiptTemplate
      ) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "action_logic_source_contract_package" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "action_logic_source_contract_receipt_template" && link.path === refresh.paths.actionLogicSourceContractReceiptTemplate
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "execution_follow_up_handoff_item_command_builder" &&
          link.path === refresh.paths.executionFollowUpHandoffItemCommandBuilderHtml &&
          existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "execution_approved_gate_command_builder" &&
          link.path === refresh.paths.executionApprovedGateCommandBuilderHtml &&
          existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "operational_registration_approved_command_builder" &&
          link.path === refresh.paths.operationalRegistrationApprovedCommandBuilderHtml &&
          existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "operational_post_registration_output_witness_command_builder" &&
          link.path === refresh.paths.operationalPostRegistrationOutputWitnessCommandBuilderHtml &&
          existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "operational_post_registration_output_witness_receipt_builder" &&
          link.path === refresh.paths.operationalPostRegistrationOutputWitnessReceiptBuilderHtml &&
          existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "operational_post_registration_output_witness_receipt_template" &&
          link.path === refresh.paths.operationalPostRegistrationOutputWitnessReceiptTemplate &&
          existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "transparent_sketch_overlay" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "engineering_voice_control_workbench" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "non_expert_engineering_voice_control_capability" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "original_goal_remaining_gates_receipt_builder" && link.path === refresh.paths.originalGoalRemainingGatesReceiptBuilderHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "original_goal_remaining_gates_receipt_template" && link.path === refresh.paths.originalGoalRemainingGatesReceiptTemplate
      ) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "spatial_intent_evidence_request" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "spatial_intent_evidence_receipt_template" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "transparent_sketch_2d_perspective_3d_implementation_audit" && link.path === sketchImplementationAuditFixturePath
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "transparent_sketch_depth_demonstration_rehearsal" &&
          link.path === refresh.paths.transparentSketchDepthDemonstrationRehearsalHtml &&
          existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "parametric_feature_data_logic_learning_kit" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "parametric_feature_data_logic_teacher_receipt_template" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "universal_detail_logic_application_dry_run_command" && link.path.includes("apply-universal-detail-logic-rule-package-dry-run.mjs")
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "universal_detail_logic_existing_tool_preview_command" && link.path.includes("create-universal-detail-logic-existing-tool-preview-package.mjs")
      ) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "real_local_all_software_low_token_readiness_package" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "real_local_all_software_low_token_readiness_receipt" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "operational_activation_gate" && link.path === operationalActivationGateReadmeFixturePath) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "operational_activation_dry_run_rehearsal" && link.path === operationalDryRunReadmeFixturePath) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "operational_registration_execute_gate" && link.path === operationalExecuteGateReadmeFixturePath) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "operational_post_activation_witness" && link.path === operationalWitnessReadmeFixturePath) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "operational_post_activation_witness_receipt_builder" && existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "low_token_operation_preflight_policy" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "event_triggered_low_token_observation_policy" && link.path === refresh.paths.eventTriggeredObservationPolicyHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "event_triggered_low_token_observation_policy_receipt_builder" &&
          link.path === refresh.paths.eventTriggeredObservationPolicyReceiptBuilderHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "event_triggered_low_token_observation_policy_receipt_validation" &&
          link.path === refresh.paths.eventTriggeredObservationPolicyReceiptValidationCommandTemplate
      ) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "original_goal_teacher_action_router" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "original_goal_teacher_action_router_receipt_builder" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "original_goal_teacher_action_router_receipt_template" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "original_goal_remaining_gates_packet" && link.path === refresh.paths.originalGoalRemainingGatesPacketHtml && existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "low_token_trigger_budget_plan" && existsSync(link.path)) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "original_goal_low_token_coverage_evidence_dossier" &&
          link.path === refresh.paths.originalGoalLowTokenCoverageEvidenceDossierHtml &&
          existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "original_goal_low_token_coverage_dossier_receipt_builder" &&
          link.path === refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilderHtml &&
          existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "original_goal_low_token_metadata_gate_preflight" &&
          link.path === refresh.paths.originalGoalLowTokenMetadataGatePreflightHtml &&
          existsSync(link.path)
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "original_goal_low_token_metadata_gate_preflight_receipt_builder" &&
          link.path === refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilderHtml &&
          existsSync(link.path)
      ) &&
      refresh.nextCommands.some((row) => row.label.includes("activation receipt builder") && existsSync(row.command)) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher-filled teacher review cockpit receipt") &&
          row.command.includes("validate-goal-teacher-review-cockpit-receipt.mjs") &&
          row.command.includes("<teacher-filled-goal-teacher-review-cockpit-receipt.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("manual handoff queue from the validated teacher review cockpit receipt") &&
          row.command.includes("create-goal-teacher-review-cockpit-handoff-queue.mjs") &&
          row.command.includes("<goal-teacher-review-cockpit-receipt-validation.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher-filled activation receipt") &&
          row.command.includes("validate-all-software-operational-activation-review-receipt.mjs") &&
          row.command.includes("<teacher-filled-operational-activation-review-receipt.json>")
      ) &&
      refresh.nextCommands.some((row) => row.label.includes("coverage rollout receipt builder") && existsSync(row.command)) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher-filled coverage rollout receipt") &&
          row.command.includes("validate-all-software-coverage-rollout-receipt.mjs") &&
          row.command.includes("<teacher-filled-coverage-rollout-receipt.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("manual handoff queue from validated coverage rollout receipt") &&
          row.command.includes("create-all-software-coverage-rollout-handoff-queue.mjs") &&
          row.command.includes("<coverage-rollout-receipt-validation.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher-filled execution follow-up receipt") &&
          row.command.includes("validate-all-software-execution-follow-up-receipt.mjs") &&
          row.command.includes("<teacher-filled-execution-follow-up-receipt.json>")
      ) &&
      refresh.nextCommands.some((row) => row.label.includes("low-token operation preflight") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("teacher action router") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("teacher action router receipt builder") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("teacher action router receipt template") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("low-token trigger budget plan") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("event-triggered low-token observation policy") && existsSync(row.command)) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("low-token coverage evidence dossier") &&
          row.command === refresh.paths.originalGoalLowTokenCoverageEvidenceDossierHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("teacher receipt for original-goal low-token coverage dossier") &&
          row.command === refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilderHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("low-token metadata gate preflight") &&
          row.command === refresh.paths.originalGoalLowTokenMetadataGatePreflightHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("teacher receipt for original-goal low-token metadata gate preflight") &&
          row.command === refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilderHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher receipt for original-goal low-token metadata gate preflight") &&
          row.command.includes("validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher receipt for original-goal low-token coverage dossier") &&
          row.command.includes("validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Open discovered original-goal low-token coverage dossier receipt validation") &&
          row.command === lowTokenCoverageDossierReceiptValidationReadmeFixturePath
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Open discovered original-goal low-token coverage completion gate") &&
          row.command === lowTokenCoverageCompletionGateReadmeFixturePath
      ) &&
      refresh.nextCommands.some((row) => row.label.includes("transparent sketch overlay") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("voice/text engineering control workbench") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("non-expert engineering voice/text control capability") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("spatial intent evidence request") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("transparent sketch 2D perspective 3D implementation audit") && row.command === sketchImplementationAuditFixturePath) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("transparent sketch 2D perspective 3D depth demonstration rehearsal") &&
          row.command.includes("create-transparent-sketch-depth-demonstration-rehearsal.mjs")
      ) &&
      refresh.nextCommands.some((row) => row.label.includes("universal detail logic learning kit") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("universal detail logic teacher receipt") && existsSync(row.command)) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher-filled universal detail logic receipt") &&
          row.command.includes("validate-parametric-drawing-logic-receipt.mjs") &&
          row.command.includes("<teacher-filled-parametric-drawing-logic-receipt.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Compile teacher-reviewed universal detail logic") &&
          row.command.includes("compile-parametric-drawing-logic-rule-package.mjs") &&
          row.command.includes("<teacher-reviewed-parametric-drawing-logic-receipt-validation.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Apply reviewed universal detail logic rule package") &&
          row.command.includes("apply-universal-detail-logic-rule-package-dry-run.mjs") &&
          row.command.includes("<teacher-reviewed-universal-detail-logic-rule-package.json>") &&
          row.command.includes("<new-data.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Create existing-tool SVG and JSON preview") &&
          row.command.includes("create-universal-detail-logic-existing-tool-preview-package.mjs") &&
          row.command.includes("<reviewed-universal-detail-logic-application-dry-run.json>")
      ) &&
      refresh.nextCommands.some((row) => row.label.includes("real-local all-software low-token readiness package") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("real-local all-software low-token readiness receipt") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("operational activation gate evidence") && row.command === operationalActivationGateReadmeFixturePath) &&
      refresh.nextCommands.some((row) => row.label.includes("operational activation dry-run rehearsal evidence") && row.command === operationalDryRunReadmeFixturePath) &&
      refresh.nextCommands.some((row) => row.label.includes("operational registration execute gate evidence") && row.command === operationalExecuteGateReadmeFixturePath) &&
      refresh.nextCommands.some((row) => row.label.includes("operational post-activation witness evidence") && row.command === operationalWitnessReadmeFixturePath) &&
      refresh.nextCommands.some((row) => row.label.includes("post-activation witness receipt builder") && existsSync(row.command)) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher-filled post-activation witness receipt") &&
          row.command.includes("validate-all-software-operational-post-activation-witness-receipt.mjs") &&
          row.command.includes("<teacher-filled-post-activation-witness-evidence-receipt.json>")
      ) &&
      refresh.nextCommands.some((row) => row.label.includes("spatial intent evidence receipt") && existsSync(row.command)) &&
      refresh.nextCommands.some((row) => row.label.includes("Validate teacher-filled spatial intent receipt") && row.command.includes("validate-spatial-intent-evidence-receipt.mjs")) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("triggered visual check command builder") &&
          row.command === refresh.paths.triggeredVisualCheckCommandBuilderHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Regenerate triggered visual check command builder") &&
          row.command.includes("create-triggered-visual-check-command-builder.mjs")
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "triggered_visual_check_command_builder" && link.path === refresh.paths.triggeredVisualCheckCommandBuilderHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "original_goal_review_handoff_item_command_builder" &&
          link.path === refresh.paths.originalGoalReviewHandoffItemCommandBuilderHtml
      ) &&
      readme.includes("Direct review entry points:") &&
      readme.includes("Original goal teacher action router:") &&
      readme.includes("Open teacher action router for the shortest human confirmation path") &&
      readme.includes("Low-token operation preflight policy:") &&
      readme.includes("Low-token trigger budget plan:") &&
      readme.includes("Original-goal low-token coverage evidence dossier:") &&
      readme.includes("Original-goal low-token coverage dossier receipt builder:") &&
      readme.includes("Original-goal low-token coverage dossier receipt validation command:") &&
      readme.includes("Original-goal low-token coverage dossier receipt validation:") &&
      readme.includes("Original-goal low-token coverage completion gate:") &&
      readme.includes("Original-goal low-token metadata gate preflight:") &&
      readme.includes("Original-goal low-token metadata gate preflight receipt builder:") &&
      readme.includes("Original-goal low-token metadata gate preflight receipt template:") &&
      readme.includes("Original-goal low-token metadata gate preflight receipt validation command:") &&
      readme.includes("Original-goal low-token compact evidence teacher launchpad:") &&
      readme.includes("run requires retained rollback manifest contract: true") &&
      dashboard.includes("Low-token compact evidence teacher launchpad") &&
      dashboard.includes("run requires retained rollback manifest contract: true") &&
      lowTokenCompactEvidenceTeacherLaunchpadHtml.includes("Low-token Compact Evidence Teacher Launchpad") &&
      readme.includes("Triggered visual check command builder:") &&
      readme.includes("Triggered visual check command builder command:") &&
      readme.includes("Triggered visual learning card review receipt validation command:") &&
      readme.includes("Open low-token trigger budget plan before any screenshot-heavy follow-up") &&
      readme.includes("Non-expert engineering voice/text control capability:") &&
      readme.includes("Spatial intent evidence request:") &&
      readme.includes("Spatial intent evidence receipt template:") &&
      readme.includes("Universal detail logic learning kit:") &&
      readme.includes("Universal detail logic teacher receipt template:") &&
      readme.includes("Validate teacher-filled universal detail logic receipt") &&
      readme.includes("Compile reviewed universal detail logic into disabled rule package") &&
      readme.includes("Apply reviewed universal detail logic rule package to new data in dry-run") &&
      readme.includes("Create existing-tool preview from reviewed universal detail logic dry-run") &&
      readme.includes("Real-local all-software low-token readiness package:") &&
      readme.includes("Real-local all-software low-token readiness receipt:") &&
      readme.includes("Real-local non-CAD/SolidWorks candidates: 2") &&
      readme.includes("Real-local non-CAD/SolidWorks ledger rows: 2") &&
      readme.includes("Real-local non-CAD/SolidWorks scope claim: real_local_bounded_all_software_not_cad_solidworks_only") &&
      dashboard.includes("Real-local non-CAD/SolidWorks readiness scope") &&
      dashboard.includes("not CAD/SolidWorks only=true") &&
      refresh.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessScopeClaim ===
        "real_local_bounded_all_software_not_cad_solidworks_only" &&
      refresh.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessNonCadSolidWorksCandidates === 2 &&
      refresh.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessNonCadSolidWorksLedgerRows === 2 &&
      refresh.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessNotCadSolidWorksOnly === true &&
      refresh.refreshedEvidence.realLocalAllSoftwareLowTokenReadinessBoundedNotComplete === true &&
      readme.includes("Original-goal review handoff item command builder:") &&
      readme.includes("Original-goal review handoff item command builder command:") &&
      readme.includes("Operational post-activation witness receipt builder") &&
      readme.includes("Open activation receipt builder for automatic low-token monitor confirmations"),
    evidence: JSON.stringify(refresh.directReviewEntryPoints?.map((link) => link.id))
  },
  {
    name: "Current status refresh creates low-token coverage evidence dossier without running coverage tools",
    pass:
      lowTokenCoverageEvidenceDossier.format === "transparent_ai_original_goal_low_token_coverage_evidence_dossier_v1" &&
      lowTokenCoverageEvidenceDossier.status === "waiting_for_low_token_coverage_evidence" &&
      lowTokenCoverageEvidenceDossier.counts.ledgerRows === 3 &&
      lowTokenCoverageEvidenceDossier.counts.waitingForLowTokenEvidence >= 1 &&
      lowTokenCoverageEvidenceDossier.locks.dossierDoesNotRunCoverageTools === true &&
      lowTokenCoverageEvidenceDossier.locks.dossierDoesNotExecuteTargetSoftware === true &&
      lowTokenCoverageEvidenceDossier.locks.dossierDoesNotCaptureScreenshots === true &&
      lowTokenCoverageEvidenceDossier.locks.dossierDoesNotWriteMemory === true &&
      lowTokenCoverageEvidenceDossier.completionBoundary.allSoftwareCoverageComplete === false &&
      refresh.paths.originalGoalLowTokenCoverageEvidenceDossier &&
      refresh.paths.originalGoalLowTokenCoverageEvidenceDossierHtml &&
      refresh.paths.originalGoalLowTokenCoverageEvidenceDossierReadme &&
      refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilder &&
      refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilderHtml &&
      refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilderReadme &&
      refresh.paths.originalGoalLowTokenCoverageDossierReceiptTemplate &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflight &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightHtml &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightReadme &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilder &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilderHtml &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilderReadme &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptTemplate &&
      refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpit &&
      refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitHtml &&
      refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReadme &&
      refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate &&
      refresh.paths.originalGoalLowTokenReadyMetadataGateShortlist &&
      refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistHtml &&
      refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistReadme &&
      refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt &&
      refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate?.includes(
        "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate?.includes(
        "teacher-draft-low-token-waiting-row-cockpit-receipt.json"
      ) &&
      refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlan &&
      refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanHtml &&
      refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReadme &&
      refresh.paths.originalGoalLowTokenFallbackRouteEvidencePack &&
      refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackHtml &&
      refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReadme &&
      refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder &&
      refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderHtml &&
      refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptTemplate &&
      refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderReadme &&
      refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandTemplate?.includes(
        "validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate?.includes(
        "create-original-goal-low-token-fallback-route-evidence-plan-receipt-draft.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder &&
      refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderHtml &&
      refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptTemplate &&
      refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderReadme &&
      refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidationCommandTemplate?.includes(
        "validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate?.includes(
        "create-original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate?.includes(
        "<ready-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-validation.json>"
      ) &&
      refresh.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate?.includes(
        "run-original-goal-low-token-evidence-return-cockpit-receipt-validation.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate?.includes(
        "<true-after-teacher-review>"
      ) &&
      refresh.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate?.includes(
        "<true-with-retained-rollback-point>"
      ) &&
      refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate?.includes(
        "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate?.includes(
        "<teacher-filled-low-token-waiting-row-cockpit-receipt.json>"
      ) &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate?.includes(
        "validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate?.includes(
        refresh.paths.originalGoalLowTokenMetadataGatePreflight
      ) &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate?.includes(
        "--receipt"
      ) &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandTemplate?.includes(
        "metadata-gate-preflight-receipt.json"
      ) &&
      refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate?.includes(
        "validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidation ===
        lowTokenCoverageDossierReceiptValidationFixturePath &&
      refresh.paths.originalGoalLowTokenCoverageDossierReceiptValidationReadme ===
        lowTokenCoverageDossierReceiptValidationReadmeFixturePath &&
      refresh.paths.originalGoalLowTokenCoverageCompletionGate === lowTokenCoverageCompletionGateFixturePath &&
      refresh.paths.originalGoalLowTokenCoverageCompletionGateReadme ===
        lowTokenCoverageCompletionGateReadmeFixturePath &&
      refresh.discoveredEvidence?.originalGoalLowTokenCoverageEvidenceDossier ===
        refresh.paths.originalGoalLowTokenCoverageEvidenceDossier &&
      refresh.discoveredEvidence?.originalGoalLowTokenCoverageDossierReceiptBuilder ===
        refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilder &&
      refresh.discoveredEvidence?.originalGoalLowTokenCoverageDossierReceiptValidation ===
        lowTokenCoverageDossierReceiptValidationFixturePath &&
      refresh.discoveredEvidence?.originalGoalLowTokenCoverageDossierReceiptValidationStatus ===
        "waiting_for_teacher_low_token_coverage_review" &&
      refresh.discoveredEvidence?.originalGoalLowTokenCoverageDossierReceiptValidationDecision ===
        "needs_teacher_review" &&
      refresh.discoveredEvidence?.originalGoalLowTokenCoverageCompletionGate === lowTokenCoverageCompletionGateFixturePath &&
      refresh.discoveredEvidence?.originalGoalLowTokenCoverageCompletionGateStatus ===
        "blocked_before_all_software_low_token_coverage_completion_claim" &&
      Array.isArray(refresh.discoveredEvidence?.originalGoalLowTokenCoverageCompletionGateBlockers) &&
      refresh.discoveredEvidence.originalGoalLowTokenCoverageCompletionGateBlockers.includes(
        "teacher_dossier_validation_has_waiting_rows"
      ) &&
      refresh.discoveredEvidence?.originalGoalLowTokenMetadataGatePreflight ===
        refresh.paths.originalGoalLowTokenMetadataGatePreflight &&
      refresh.discoveredEvidence?.originalGoalLowTokenMetadataGatePreflightReceiptBuilder ===
        refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilder &&
      refresh.discoveredEvidence?.originalGoalLowTokenCoverageWaitingRowCockpit ===
        refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpit &&
      refresh.discoveredEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate ===
        refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate &&
      refresh.discoveredEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate ===
        refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate &&
      refresh.discoveredEvidence?.originalGoalLowTokenReadyMetadataGateShortlist ===
        refresh.paths.originalGoalLowTokenReadyMetadataGateShortlist &&
      refresh.discoveredEvidence?.originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt ===
        refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt &&
      refresh.discoveredEvidence?.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate ===
        refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate &&
      refresh.discoveredEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlan ===
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlan &&
      refresh.discoveredEvidence?.originalGoalLowTokenFallbackRouteEvidencePack ===
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePack &&
      refresh.discoveredEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder ===
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilder &&
      refresh.discoveredEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReceiptTemplate ===
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptTemplate &&
      refresh.discoveredEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandTemplate ===
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandTemplate &&
      refresh.discoveredEvidence?.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate ===
        refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate &&
      refresh.discoveredEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder ===
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder &&
      refresh.discoveredEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptTemplate ===
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptTemplate &&
      refresh.discoveredEvidence?.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate ===
        refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate &&
      refresh.discoveredEvidence?.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate ===
        refresh.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageEvidenceDossierReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageDossierReceiptBuilderReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageDossierReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageDossierReceiptValidationReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageDossierReceiptValidationStatus ===
        "waiting_for_teacher_low_token_coverage_review" &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageDossierReceiptValidationDecision ===
        "needs_teacher_review" &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageDossierReceiptValidationReadyFollowUpRows === 0 &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageCompletionGateCommandReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageCompletionGateReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageCompletionGateStatus ===
        "blocked_before_all_software_low_token_coverage_completion_claim" &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageCompletionGateCoverageReadyForFinalTeacherReview === false &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageCompletionGateCanClaimOriginalGoalComplete === false &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageCompletionGateBlockerCount === 3 &&
      refresh.refreshedEvidence?.originalGoalLowTokenMetadataGatePreflightReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenMetadataGatePreflightReceiptBuilderReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandReady === true &&
      refresh.paths.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate?.includes(
        "run-original-goal-low-token-metadata-gate-validation-command.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate?.includes(
        "--allow-validation-command-runner"
      ) &&
      refresh.paths.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate?.includes(
        "--rollback-point"
      ) &&
      refresh.discoveredEvidence?.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate ===
        refresh.paths.originalGoalLowTokenMetadataGateValidationCommandRunnerCommandTemplate &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenMetadataGatePreflightReadyRows) &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenMetadataGatePreflightBlockedRows) &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenMetadataGatePreflightReceiptBuilderReadyRows) &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenMetadataGatePreflightReceiptBuilderBlockedRows) &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRows >= 1 &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageNextReviewRows >= 1 &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitRows >= 1 &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitReadyRows) &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitBlockedRows) &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitReviewOnly === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitUsesSafeTextRendering === true &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithLogSourceLedgerRoute) &&
      Number.isInteger(
        refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithInheritedProofFallbackRoute
      ) &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithMetadataGatePreflight) &&
      Number.isInteger(
        refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithCoverageContractReadyForMetadataGate
      ) &&
      Number.isInteger(
        refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithoutCurrentLogSourceLedgerMatch
      ) &&
      typeof refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitScopeMismatchLikely === "boolean" &&
      typeof refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitScopeDiagnostic === "string" &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitDoesNotReadLogs === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitDoesNotRunMetadataGate === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenReadyMetadataGateShortlistReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenReadyMetadataGateShortlistReadyRows ===
        lowTokenCoverageWaitingRowCockpit.counts.readyForTeacherConfirmedMetadataGateRows &&
      refresh.refreshedEvidence?.originalGoalLowTokenReadyMetadataGateShortlistBlockedRows ===
        lowTokenCoverageWaitingRowCockpit.counts.blockedRows &&
      refresh.refreshedEvidence?.originalGoalLowTokenReadyMetadataGateShortlistDraftRowsStillRequireTeacherFlags ===
        lowTokenCoverageWaitingRowCockpit.counts.readyForTeacherConfirmedMetadataGateRows &&
      refresh.refreshedEvidence?.originalGoalLowTokenReadyMetadataGateShortlistRowsThatWouldValidateWithoutTeacherEdits === 0 &&
      refresh.refreshedEvidence?.originalGoalLowTokenReadyMetadataGateShortlistReviewOnly === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenReadyMetadataGateShortlistDoesNotRunMetadataGate === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenReadyMetadataGateShortlistDoesNotReadLogs === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenReadyMetadataGateShortlistDoesNotExecuteTargetSoftware === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenReadyMetadataGateShortlistDraftIsNotTeacherConfirmation === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlanReady === true &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlanRows) &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlanRowsNeedingLogSourceRoute) &&
      refresh.refreshedEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlanDoesNotReadLogs === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlanDoesNotRunMetadataGate === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReady === true &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackRows) &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackCandidateRoutes >=
        refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackRows &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackRowsRequiringTeacherRouteSelection) &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackDoesNotReadLogs === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackDoesNotCaptureScreenshots === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackDoesNotExecuteTargetSoftware === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackDoesNotClaimCoverage === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReceiptTemplateReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandReady === true &&
      Number.isInteger(refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderRows) &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderCandidateRoutes >=
        refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderRows &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderDoesNotReadLogs === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderDoesNotExecuteTargetSoftware === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderRouteSelectionIsNotCoverage === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptTemplateReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderDoesNotReadLogs === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderDoesNotRunMetadataGate === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandReady === true &&
      refresh.refreshedEvidence?.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandReady === true &&
      result.originalGoalLowTokenCoverageEvidenceDossier === refresh.paths.originalGoalLowTokenCoverageEvidenceDossier &&
      result.originalGoalLowTokenCoverageDossierReceiptBuilder === refresh.paths.originalGoalLowTokenCoverageDossierReceiptBuilder &&
      result.originalGoalLowTokenMetadataGatePreflight === refresh.paths.originalGoalLowTokenMetadataGatePreflight &&
      result.originalGoalLowTokenMetadataGatePreflightReceiptBuilder ===
        refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptBuilder &&
      lowTokenCoverageDossierReceiptBuilder.format ===
        "transparent_ai_original_goal_low_token_coverage_dossier_receipt_builder_v1" &&
      lowTokenCoverageDossierReceiptBuilder.locks.builderDoesNotReadLogs === true &&
      lowTokenCoverageDossierReceiptBuilder.locks.builderDoesNotRunFollowUpPlan === true &&
      lowTokenCoverageDossierReceiptBuilder.locks.goalComplete === false &&
      lowTokenMetadataGatePreflight.format === "transparent_ai_original_goal_low_token_metadata_gate_preflight_v1" &&
      lowTokenMetadataGatePreflight.locks.preflightDoesNotRunMetadataGate === true &&
      lowTokenMetadataGatePreflight.locks.preflightDoesNotReadLogs === true &&
      lowTokenMetadataGatePreflight.locks.preflightDoesNotCaptureScreenshots === true &&
      lowTokenMetadataGatePreflight.locks.preflightDoesNotExecuteTargetSoftware === true &&
      lowTokenMetadataGatePreflight.locks.preflightDoesNotWriteMemory === true &&
      lowTokenMetadataGatePreflight.locks.goalComplete === false &&
      lowTokenMetadataGatePreflightReceiptBuilder.format ===
        "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_builder_v1" &&
      lowTokenMetadataGatePreflightReceiptBuilder.locks.builderDoesNotRunMetadataGate === true &&
      lowTokenMetadataGatePreflightReceiptBuilder.locks.builderDoesNotReadLogs === true &&
      lowTokenMetadataGatePreflightReceiptBuilder.locks.builderDoesNotExecuteTargetSoftware === true &&
      lowTokenMetadataGatePreflightReceiptBuilder.locks.builderDoesNotWriteMemory === true &&
      lowTokenMetadataGatePreflightReceiptBuilder.locks.goalComplete === false &&
      lowTokenMetadataGatePreflightReceiptTemplate.format ===
        "transparent_ai_original_goal_low_token_metadata_gate_preflight_review_receipt_v1" &&
      lowTokenMetadataGatePreflightReceiptTemplate.rollbackPointCreated === false &&
      lowTokenMetadataGatePreflightReceiptTemplate.allowCommandGeneration === false &&
      lowTokenCoverageWaitingRowCockpit.format ===
        "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1" &&
      lowTokenCoverageWaitingRowCockpit.counts.totalRows >= 1 &&
      Number.isInteger(lowTokenCoverageWaitingRowCockpit.counts.rowsWithoutCurrentLogSourceLedgerMatch) &&
      typeof lowTokenCoverageWaitingRowCockpit.scopeDiagnostics?.likelyCoverageLedgerScopeMismatch === "boolean" &&
      typeof lowTokenCoverageWaitingRowCockpit.scopeDiagnostics?.explanation === "string" &&
      lowTokenCoverageWaitingRowCockpit.counts.readyForTeacherConfirmedMetadataGateRows +
        lowTokenCoverageWaitingRowCockpit.counts.blockedRows ===
        lowTokenCoverageWaitingRowCockpit.counts.totalRows &&
      lowTokenCoverageWaitingRowCockpit.locks.cockpitDoesNotRunMetadataGate === true &&
      lowTokenCoverageWaitingRowCockpit.locks.cockpitUsesSafeTextRendering === true &&
      lowTokenCoverageWaitingRowCockpit.locks.cockpitDoesNotReadLogs === true &&
      lowTokenCoverageWaitingRowCockpit.locks.cockpitDoesNotCaptureScreenshots === true &&
      lowTokenCoverageWaitingRowCockpit.locks.cockpitDoesNotExecuteTargetSoftware === true &&
      lowTokenCoverageWaitingRowCockpit.locks.goalComplete === false &&
      fileIsAscii(refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpit) &&
      fileIsAscii(refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate) &&
      lowTokenCoverageWaitingRowCockpitHtml.includes("appendCodeLine") &&
      !lowTokenCoverageWaitingRowCockpitHtml.includes("card.innerHTML") &&
      lowTokenCoverageWaitingRowCockpitReceiptTemplate.format ===
        "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_v1" &&
      lowTokenCoverageWaitingRowCockpitReceiptTemplate.defaultDecision === "needs_teacher_review" &&
      lowTokenReadyMetadataGateShortlist.format ===
        "transparent_ai_original_goal_low_token_ready_metadata_gate_shortlist_v1" &&
      lowTokenReadyMetadataGateShortlist.counts.readyRows ===
        lowTokenCoverageWaitingRowCockpit.counts.readyForTeacherConfirmedMetadataGateRows &&
      lowTokenReadyMetadataGateShortlist.counts.rowsThatWouldValidateWithoutTeacherEdits === 0 &&
      lowTokenReadyMetadataGateShortlist.locks.shortlistDoesNotRunMetadataGate === true &&
      lowTokenReadyMetadataGateShortlist.locks.shortlistDoesNotReadLogs === true &&
      lowTokenReadyMetadataGateShortlist.locks.shortlistDoesNotExecuteTargetSoftware === true &&
      lowTokenReadyMetadataGateShortlist.locks.draftReceiptIsNotTeacherConfirmation === true &&
      lowTokenReadyMetadataGateShortlistDraftReceipt.draftOnly === true &&
      lowTokenReadyMetadataGateShortlistDraftReceipt.teacherMustEditBeforeValidation === true &&
      lowTokenReadyMetadataGateShortlistDraftReceipt.rowDecisions.filter(
        (row) => row.teacherDecision === "teacher_ready_for_metadata_gate_receipt"
      ).length === lowTokenCoverageWaitingRowCockpit.counts.readyForTeacherConfirmedMetadataGateRows &&
      lowTokenReadyMetadataGateShortlistDraftReceipt.rowDecisions
        .filter((row) => row.teacherDecision === "teacher_ready_for_metadata_gate_receipt")
        .every((row) => row.evidenceReviewed === false && row.allowMetadataGatePreparation === false) &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate.includes(
        "create-original-goal-low-token-metadata-gate-preflight-receipt-draft.mjs"
      ) &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate.includes(
        "<passed-low-token-waiting-row-cockpit-receipt-validation.json>"
      ) &&
      refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate.includes(
        refresh.paths.originalGoalLowTokenMetadataGatePreflight
      ) &&
      refresh.discoveredEvidence.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate ===
        refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate &&
      refresh.refreshedEvidence.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandReady === true &&
      lowTokenBlockedWaitingRowEvidencePlan.format ===
        "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_v1" &&
      Number.isInteger(lowTokenBlockedWaitingRowEvidencePlan.counts.blockedRows) &&
      Number.isInteger(lowTokenBlockedWaitingRowEvidencePlan.counts.rowsNeedingLogSourceRoute) &&
      lowTokenBlockedWaitingRowEvidencePlan.locks.planDoesNotReadLogs === true &&
      lowTokenBlockedWaitingRowEvidencePlan.locks.planDoesNotRunMetadataGate === true &&
      lowTokenBlockedWaitingRowEvidencePlan.locks.planDoesNotCaptureScreenshots === true &&
      lowTokenBlockedWaitingRowEvidencePlan.locks.planDoesNotExecuteTargetSoftware === true &&
      lowTokenBlockedWaitingRowEvidencePlan.locks.goalComplete === false &&
      lowTokenFallbackRouteEvidencePack.format ===
        "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_v1" &&
      Number.isInteger(lowTokenFallbackRouteEvidencePack.counts.rows) &&
      lowTokenFallbackRouteEvidencePack.counts.candidateRoutes >= lowTokenFallbackRouteEvidencePack.counts.rows &&
      lowTokenFallbackRouteEvidencePack.teacherReviewContract.selectedRouteIsStillNotCoverage === true &&
      lowTokenFallbackRouteEvidencePack.locks.packDoesNotReadLogs === true &&
      lowTokenFallbackRouteEvidencePack.locks.packDoesNotCaptureScreenshots === true &&
      lowTokenFallbackRouteEvidencePack.locks.packDoesNotExecuteTargetSoftware === true &&
      lowTokenFallbackRouteEvidencePack.locks.packDoesNotClaimAllSoftwareCoverage === true &&
      lowTokenFallbackRouteEvidencePack.locks.goalComplete === false &&
      lowTokenFallbackRouteEvidencePackReceiptBuilder.format ===
        "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_builder_v1" &&
      Number.isInteger(lowTokenFallbackRouteEvidencePackReceiptBuilder.rowCount) &&
      lowTokenFallbackRouteEvidencePackReceiptBuilder.candidateRouteCount >=
        lowTokenFallbackRouteEvidencePackReceiptBuilder.rowCount &&
      lowTokenFallbackRouteEvidencePackReceiptBuilder.nextValidationCommand.includes(
        "validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs"
      ) &&
      lowTokenFallbackRouteEvidencePackReceiptBuilder.locks.builderDoesNotReadLogs === true &&
      lowTokenFallbackRouteEvidencePackReceiptBuilder.locks.builderDoesNotExecuteTargetSoftware === true &&
      lowTokenFallbackRouteEvidencePackReceiptBuilder.locks.routeSelectionIsNotCoverage === true &&
      lowTokenFallbackRouteEvidencePackReceiptTemplate.format ===
        "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_v1" &&
      lowTokenFallbackRouteEvidencePackReceiptTemplate.blockedTeacherDecisions.includes("execute_now") &&
      lowTokenFallbackRouteEvidencePackReceiptTemplate.blockedTeacherDecisions.includes("claim_goal_complete") &&
      lowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.format ===
        "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_builder_v1" &&
      Number.isInteger(lowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.actionRowCount) &&
      lowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.nextValidationCommand.includes(
        "validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs"
      ) &&
      lowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.locks.builderDoesNotReadLogs === true &&
      lowTokenBlockedWaitingRowEvidencePlanReceiptBuilder.locks.builderDoesNotRunMetadataGate === true &&
      lowTokenBlockedWaitingRowEvidencePlanReceiptTemplate.format ===
        "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_v1" &&
      lowTokenBlockedWaitingRowEvidencePlanReceiptTemplate.blockedTeacherDecisions.includes("execute_now") &&
      lowTokenCoverageEvidenceDossierHtml.includes("Original Goal Low-Token Coverage Evidence Dossier") &&
      lowTokenCoverageDossierReceiptBuilderHtml.includes("Low-Token Coverage Dossier Receipt Builder") &&
      lowTokenCoverageWaitingRowCockpitHtml.includes("Low-Token Coverage Waiting Row Cockpit") &&
      lowTokenReadyMetadataGateShortlistHtml.includes("Ready Metadata Gate Shortlist") &&
      lowTokenReadyMetadataGateShortlistHtml.includes("draft is not teacher confirmation") &&
      lowTokenReadyMetadataGateShortlistHtml.includes("no metadata gate run") &&
      lowTokenBlockedWaitingRowEvidencePlanHtml.includes("Blocked Waiting Row Evidence Plan") &&
      lowTokenFallbackRouteEvidencePackHtml.includes("Low-Token Fallback Route Evidence Pack") &&
      lowTokenFallbackRouteEvidencePackReceiptBuilderHtml.includes("Fallback Route Receipt Builder") &&
      lowTokenFallbackRouteEvidencePackReceiptBuilderHtml.includes("Generate Receipt JSON") &&
      lowTokenFallbackRouteEvidencePackReceiptBuilderHtml.includes("Mark All Selected Routes Reviewed") &&
      lowTokenFallbackRouteEvidencePackReceiptBuilderHtml.includes("Copy JSON") &&
      lowTokenMetadataGatePreflightHtml.includes("Original Goal Low-Token Metadata Gate Preflight") &&
      lowTokenMetadataGatePreflightReceiptBuilderHtml.includes("Low-Token Metadata Gate Receipt Builder") &&
      lowTokenMetadataGatePreflightReceiptBuilderHtml.includes("Generate Receipt JSON") &&
      lowTokenMetadataGatePreflightReceiptBuilderHtml.includes("Mark Ready Rows Confirmed") &&
      lowTokenMetadataGatePreflightReceiptBuilderHtml.includes("Retained rollback point path") &&
      dashboard.includes("Low-token coverage evidence dossier") &&
      dashboard.includes("Low-token coverage dossier receipt builder") &&
      dashboard.includes("Low-token coverage waiting row cockpit") &&
      dashboard.includes("Low-token coverage waiting row cockpit receipt validation command") &&
      dashboard.includes("Ready metadata-gate shortlist") &&
      dashboard.includes("Ready metadata-gate draft receipt") &&
      dashboard.includes("Metadata-gate preflight receipt draft from passed waiting-row validation") &&
      dashboard.includes("Low-token blocked waiting row evidence plan") &&
      dashboard.includes("Low-token fallback route evidence pack") &&
      dashboard.includes("Low-token fallback route receipt builder") &&
      dashboard.includes("Low-token fallback route receipt validation command") &&
      dashboard.includes("Low-token fallback route evidence-plan receipt draft command") &&
      dashboard.includes("Low-token blocked waiting row evidence plan receipt builder") &&
      dashboard.includes("Low-token evidence return cockpit receipt builder command") &&
      dashboard.includes("Low-token evidence return cockpit receipt validation runner command") &&
      dashboard.includes("Low-token metadata gate preflight") &&
      dashboard.includes("Low-token metadata gate receipt builder") &&
      readme.includes("Original-goal low-token coverage waiting row cockpit:") &&
      readme.includes("Original-goal low-token coverage waiting row cockpit ready rows:") &&
      readme.includes("Original-goal low-token coverage waiting row cockpit receipt validation command:") &&
      readme.includes("Original-goal ready metadata-gate shortlist:") &&
      readme.includes("Original-goal ready metadata-gate draft receipt validation command:") &&
      readme.includes("Original-goal metadata-gate preflight receipt draft command from passed waiting-row validation:") &&
      readme.includes("Original-goal low-token blocked waiting row evidence plan:") &&
      readme.includes("Original-goal low-token fallback route evidence pack:") &&
      readme.includes("Original-goal low-token fallback route evidence pack receipt builder:") &&
      readme.includes("Original-goal low-token fallback route evidence pack receipt validation command:") &&
      readme.includes("Original-goal low-token fallback route evidence-plan receipt draft command:") &&
      readme.includes("Original-goal low-token blocked waiting row evidence plan receipt builder:") &&
      readme.includes("Original-goal low-token blocked waiting row evidence plan receipt validation command:") &&
      readme.includes("Original-goal low-token evidence return cockpit receipt builder command:") &&
      readme.includes("Original-goal low-token evidence return cockpit receipt validation runner command:") &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "original_goal_low_token_coverage_waiting_row_cockpit" &&
          link.path === refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "original_goal_low_token_ready_metadata_gate_shortlist" &&
          link.path === refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "original_goal_low_token_ready_metadata_gate_shortlist_draft_receipt" &&
          link.path === refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "original_goal_low_token_metadata_gate_preflight_receipt_draft_command" &&
          link.path === refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("low-token coverage waiting row cockpit") &&
          row.command === refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("ready metadata-gate shortlist") &&
          row.command === refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("ready metadata-gate draft receipt") &&
          row.command === refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftReceipt
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate edited ready metadata-gate draft receipt") &&
          row.command === refresh.paths.originalGoalLowTokenReadyMetadataGateShortlistDraftValidationCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Build metadata-gate preflight receipt draft from passed waiting-row validation") &&
          row.command === refresh.paths.originalGoalLowTokenMetadataGatePreflightReceiptDraftCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("low-token coverage waiting row cockpit") &&
          row.command === refresh.paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "original_goal_low_token_fallback_route_evidence_pack_receipt_builder" &&
          link.path === refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptBuilderHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("low-token fallback route receipt") &&
          row.command === refresh.paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Draft blocked waiting-row evidence-plan receipt") &&
          row.command === refresh.paths.originalGoalLowTokenFallbackRouteEvidencePlanReceiptDraftCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("blocked waiting row evidence plan") &&
          row.command === refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("blocked waiting row evidence plan") &&
          row.label.includes("receipt") &&
          row.command === refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher receipt for original-goal low-token blocked waiting row evidence plan") &&
          row.command === refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidationCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Build teacher-review cockpit receipt draft from validated blocked waiting row evidence") &&
          row.command === refresh.paths.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Run teacher-reviewed evidence return cockpit receipt validation") &&
          row.command === refresh.paths.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate
      ) &&
      readme.includes("Original-goal low-token coverage waiting rows"),
    evidence: refresh.paths.originalGoalLowTokenCoverageEvidenceDossierHtml
  },
  {
    name: "Current status refresh surfaces universal detail logic before visual similarity generation",
    pass:
      existsSync(refresh.paths.parametricDrawingLogicLearningKit) &&
      existsSync(refresh.paths.parametricDrawingLogicLearningKitHtml) &&
      parametricDrawingLogicKit.format === "transparent_ai_parametric_drawing_logic_learning_kit_v1" &&
      parametricDrawingLogicKit.optimizedTeacherPrompt.includes("Do not imitate the surface of the drawing/model/sketch/software output") &&
      parametricDrawingLogicKit.logicLearningPrinciples.some((rule) => rule.includes("Rigor comes from feature-data logic")) &&
      parametricDrawingLogicKit.logicLearningPrinciples.some((rule) => rule.includes("All data logicized means every consequential detail")) &&
      parametricDrawingLogicKit.logicLearningPrinciples.some((rule) => rule.includes("starting point, not the scope boundary")) &&
      parametricDrawingLogicKit.universalDetailLogicContract.fullDetailCoverageRequired === true &&
      parametricDrawingLogicKit.universalDetailLogicContract.implicitDerivedLogicRequired === true &&
      parametricDrawingLogicKit.blockedActions.includes("generate_visually_similar_output_without_feature_logic") &&
      parametricDrawingLogicKit.blockedActions.includes("stop_after_teacher_example_without_full_detail_coverage") &&
      parametricDrawingLogicKit.blockedActions.includes("ignore_hidden_or_derived_constraints_that_control_output_details") &&
      parametricDrawingLogicKit.blockedActions.includes("generate_any_output_detail_as_plausible_guess_without_logic_source") &&
      parametricDrawingLogicKit.locks.reviewOnly === true &&
      parametricDrawingLogicKit.locks.accepted === false &&
      parametricDrawingLogicKit.locks.ruleEnabled === false &&
      parametricDrawingLogicKit.locks.targetCadGenerated === false &&
      parametricDrawingLogicKit.locks.cadSoftwareExecuted === false &&
      parametricDrawingLogicKit.locks.surfaceSimilarityOnlyAccepted === false &&
      refresh.refreshedEvidence?.parametricFeatureDataLogicLearningReady === true &&
      refresh.refreshedEvidence?.parametricFeatureDataLogicReviewOnly === true &&
      refresh.refreshedEvidence?.parametricFeatureDataLogicBlocksSurfaceSimilarityOnly === true &&
      refresh.discoveredEvidence?.parametricDrawingLogicLearningKit === refresh.paths.parametricDrawingLogicLearningKit &&
      refresh.discoveredEvidence?.parametricDrawingLogicOptimizedTeacherPrompt.includes("length, angle, radius, spacing, count") &&
      refresh.discoveredEvidence?.parametricDrawingLogicOptimizedTeacherPrompt.includes("implicit, hidden, and derived output detail") &&
      refresh.discoveredEvidence?.parametricDrawingLogicOptimizedTeacherPrompt.includes("target-software action route") &&
      refresh.paths?.parametricDrawingLogicReceiptValidationCommandTemplate?.includes("validate-parametric-drawing-logic-receipt.mjs") &&
      refresh.paths?.parametricDrawingLogicReceiptValidationCommandTemplate?.includes("<teacher-filled-parametric-drawing-logic-receipt.json>") &&
      refresh.discoveredEvidence?.parametricDrawingLogicReceiptValidationCommandTemplate.includes("validate-parametric-drawing-logic-receipt.mjs") &&
      refresh.discoveredEvidence?.parametricDrawingLogicReceiptValidationCommandTemplate.includes(
        "<teacher-filled-parametric-drawing-logic-receipt.json>"
      ) &&
      refresh.discoveredEvidence?.parametricDrawingLogicRulePackageCommandTemplate.includes("compile-parametric-drawing-logic-rule-package.mjs") &&
      refresh.discoveredEvidence?.parametricDrawingLogicRulePackageCommandTemplate.includes("<teacher-reviewed-parametric-drawing-logic-receipt-validation.json>") &&
      refresh.discoveredEvidence?.universalDetailLogicApplicationDryRunCommandTemplate.includes("apply-universal-detail-logic-rule-package-dry-run.mjs") &&
      refresh.discoveredEvidence?.universalDetailLogicApplicationDryRunCommandTemplate.includes("<new-data.json>") &&
      refresh.paths?.universalDetailLogicExistingToolPreviewCommandTemplate?.includes("create-universal-detail-logic-existing-tool-preview-package.mjs") &&
      refresh.discoveredEvidence?.universalDetailLogicExistingToolPreviewCommandTemplate.includes("create-universal-detail-logic-existing-tool-preview-package.mjs") &&
      refresh.discoveredEvidence?.universalDetailLogicExistingToolPreviewCommandTemplate.includes("<reviewed-universal-detail-logic-application-dry-run.json>") &&
      parametricDrawingLogicHtml.includes("Teacher Logic Relationship Drafts") &&
      parametricDrawingLogicHtml.includes("New Drawing Generation Plan"),
    evidence: refresh.paths.parametricDrawingLogicLearningKitHtml
  },
  {
    name: "Current status refresh packages non-expert engineering voice/text control as a review-only capability",
    pass:
      existsSync(refresh.paths.nonExpertEngineeringVoiceControlCapability) &&
      existsSync(refresh.paths.nonExpertEngineeringVoiceControlCapabilityHtml) &&
      nonExpertVoiceControlCapability.status === "ready_for_teacher_reviewed_non_expert_voice_or_text_control" &&
      nonExpertVoiceControlCapability.entryPoints.workbench === commandCenter.paths.voiceWorkbench &&
      nonExpertVoiceControlCapability.entryPoints.workbenchHtml === commandCenter.paths.voiceWorkbenchHtml &&
      nonExpertVoiceControlCapability.entryPoints.numberedTargetConfirmationPacket === commandCenterVoiceWorkbench.generated?.activeTargetConfirmation &&
      nonExpertVoiceControlCapability.workflowSteps.some((step) => step.label === "mark_numbered_possible_targets") &&
      nonExpertVoiceControlCapability.workflowSteps.some((step) => step.label === "teacher_confirms_one_number" && step.status === "teacher_confirmation_required") &&
      nonExpertVoiceControlCapability.nextCommands.some((row) => row.command.includes("__SELECTED_NUMBER__")) &&
      nonExpertVoiceControlCapability.locks.canExecuteNow === false &&
      nonExpertVoiceControlCapability.locks.teacherMustConfirmExactlyOneNumber === true &&
      nonExpertVoiceControlCapability.locks.softwareActionsExecuted === false &&
      nonExpertVoiceControlCapability.locks.targetSoftwareCommandsExecuted === false &&
      nonExpertVoiceControlCapability.blockedActions.includes("execute_from_voice_or_text_without_numbered_target_confirmation") &&
      refresh.refreshedEvidence?.nonExpertEngineeringVoiceControlCapabilityReady === true &&
      refresh.refreshedEvidence?.nonExpertNumberedTargetConfirmationReady === true &&
      refresh.refreshedEvidence?.nonExpertExecutionStillRequiresTeacherConfirmedNumber === true &&
      refresh.discoveredEvidence?.nonExpertEngineeringVoiceControlCapability === refresh.paths.nonExpertEngineeringVoiceControlCapability &&
      refresh.discoveredEvidence?.nonExpertEngineeringVoiceControlPromptTemplate?.includes("mark likely locations with numbers") &&
      nonExpertVoiceControlCapabilityHtml.includes("Non-Expert Engineering Voice Control Capability") &&
      !nonExpertVoiceControlCapabilityHtml.includes("--teacher-reviewed") &&
      !nonExpertVoiceControlCapabilityHtml.includes("--execute"),
    evidence: refresh.paths.nonExpertEngineeringVoiceControlCapabilityHtml
  },
  {
    name: "Current status refresh direct voice workbench uses UTF-8 command-file input",
    pass:
      existsSync(commandCenter.paths.voiceWorkbenchCommandInput) &&
      commandCenter.paths.voiceWorkbenchCommandInput.endsWith("command.txt") &&
      commandCenterVoiceCommandInput === "Use the teacher's current instruction only after numbered target confirmation." &&
      commandCenterVoiceWorkbench.generated?.activeTargetConfirmation === commandCenterVoiceWorkbench.generated?.targetConfirmation &&
      commandCenterVoiceWorkbench.targetCandidates.length >= 1 &&
      commandCenterVoiceWorkbench.locks.softwareActionsExecuted === false &&
      commandCenterVoiceWorkbench.locks.targetSoftwareCommandsExecuted === false,
    evidence: commandCenter.paths.voiceWorkbenchCommandInput
  },
  {
    name: "Current status refresh exposes the numbered target confirmation bridge without choosing for the teacher",
    pass:
      refresh.discoveredEvidence?.lowTokenPreflightTargetConfirmation === commandCenterVoiceWorkbench.generated?.activeTargetConfirmation &&
      refresh.discoveredEvidence?.numberedTargetConfirmCommandTemplate?.includes("confirm-engineering-command-target.mjs") &&
      refresh.discoveredEvidence?.numberedTargetConfirmCommandTemplate?.includes("__SELECTED_NUMBER__") &&
      !refresh.discoveredEvidence?.numberedTargetConfirmCommandTemplate?.includes("--selected-number '1'") &&
      !refresh.discoveredEvidence?.numberedTargetConfirmCommandTemplate?.includes('--selected-number "1"') &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "voice_text_numbered_target_confirmation_packet" && link.path === commandCenterVoiceWorkbench.generated?.activeTargetConfirmation
      ) &&
      refresh.nextCommands.some((row) => row.label.includes("replace __SELECTED_NUMBER__") && row.command.includes("__SELECTED_NUMBER__")) &&
      refresh.nextCommands.some((row) => row.label.includes("numbered target confirmation packet") && row.command === commandCenterVoiceWorkbench.generated?.activeTargetConfirmation),
    evidence: refresh.discoveredEvidence?.numberedTargetConfirmCommandTemplate || "missing confirm bridge"
  },
  {
    name: "Current status refresh exposes transparent sketch export to spatial target bridge without fabricating teacher sketch intent",
    pass:
      refresh.discoveredEvidence?.transparentSketchOverlay === commandCenter.paths.transparentOverlay &&
      existsSync(refresh.discoveredEvidence.transparentSketchOverlay) &&
      refresh.discoveredEvidence?.teacherExportedOverlayPacketPlaceholder === "<teacher-exported-transparent-sketch-packet.json>" &&
      refresh.discoveredEvidence?.spatialTargetConfirmationCommandTemplate?.includes("create-spatial-target-confirmation-kit.mjs") &&
      refresh.discoveredEvidence?.spatialTargetConfirmationCommandTemplate?.includes("<teacher-exported-transparent-sketch-packet.json>") &&
      refresh.discoveredEvidence?.lowTokenPreflightSpatialIntent === "" &&
      refresh.refreshedEvidence?.transparentSketchOverlayReady === true &&
      refresh.refreshedEvidence?.spatialTargetBridgeReadyForTeacherExportedPacket === true &&
      refresh.refreshedEvidence?.transparentSketchDepthDemonstrationRehearsalCommandReady === true &&
      refresh.refreshedEvidence?.transparentSketchDepthRehearsalReviewReceiptBuilderReady === true &&
      refresh.refreshedEvidence?.transparentSketchDepthRehearsalReviewReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.spatialIntentEvidenceRequestReady === false &&
      refresh.refreshedEvidence?.formalSpatialIntentEvidencePresent === true &&
      refresh.refreshedEvidence?.spatialIntentEvidenceReceiptValidationReady === true &&
      refresh.directReviewEntryPoints?.some(
        (link) => link.id === "transparent_sketch_export_to_spatial_target_bridge" && link.path === commandCenter.paths.transparentOverlay
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("teacher exports transparent sketch packet") &&
          row.command.includes("<teacher-exported-transparent-sketch-packet.json>")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("transparent sketch 2D perspective 3D depth demonstration rehearsal") &&
          row.command.includes("create-transparent-sketch-depth-demonstration-rehearsal.mjs")
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "transparent_sketch_depth_rehearsal_review_receipt_builder" &&
          link.path === refresh.paths.transparentSketchDepthRehearsalReviewReceiptBuilderHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("depth rehearsal review receipt builder") &&
          row.command === refresh.paths.transparentSketchDepthRehearsalReviewReceiptBuilderHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Validate teacher-filled transparent sketch depth rehearsal review receipt") &&
          row.command.includes("validate-transparent-sketch-depth-rehearsal-review-receipt.mjs") &&
          row.command.includes("<teacher-filled-transparent-sketch-depth-rehearsal-review-receipt.json>")
      ) &&
      transparentSketchDepthRehearsalReviewReceiptBuilder.format ===
        "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_builder_v1" &&
      transparentSketchDepthRehearsalReviewReceiptBuilder.reviewRows.length ===
        transparentSketchDepthDemonstrationRehearsal.checks.length &&
      transparentSketchDepthRehearsalReviewReceiptBuilder.locks.builderDoesNotExecuteSoftware === true &&
      transparentSketchDepthRehearsalReviewReceiptBuilder.locks.goalComplete === false &&
      transparentSketchDepthRehearsalReviewReceiptBuilderHtml.includes(
        "Transparent Sketch Depth Rehearsal Review Receipt Builder"
      ) &&
      transparentSketchDepthRehearsalReviewReceiptTemplate.format ===
        "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_v1" &&
      transparentSketchDepthRehearsalReviewReceiptTemplate.locks.builderDoesNotExecuteSoftware === true &&
      refresh.paths.transparentSketchDepthRehearsalReviewReceiptValidation === depthRehearsalValidationFixturePath &&
      refresh.discoveredEvidence?.transparentSketchDepthRehearsalReviewReceiptValidation ===
        depthRehearsalValidationFixturePath &&
      refresh.refreshedEvidence?.transparentSketchDepthRehearsalReviewReceiptValidationStatus === "needs_teacher_review" &&
      refresh.refreshedEvidence?.transparentSketchDepthRehearsalReviewReceiptValidationWaitingForTeacher === true &&
      refresh.refreshedEvidence?.transparentSketchDepthRehearsalReviewReceiptTeacherConfirmedReviewOnly === false &&
      transparentSketchDepthRehearsalReviewReceiptValidation.format ===
        "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_validation_v1" &&
      transparentSketchDepthRehearsalReviewReceiptValidation.readyForExecution === false &&
      transparentSketchDepthRehearsalReviewReceiptValidation.goalComplete === false &&
      spatialToSoftwareExecutionGatePackage.format ===
        "transparent_ai_spatial_to_software_execution_gate_package_v1" &&
      spatialToSoftwareExecutionGatePackage.status === "blocked_before_spatial_software_execution" &&
      spatialToSoftwareExecutionGatePackage.readyForDryRunRouteBridge === false &&
      spatialToSoftwareExecutionGatePackage.firstBlocker?.id === "depth_rehearsal_teacher_review" &&
      spatialToSoftwareExecutionGatePackage.gates.some((gate) => gate.id === "teacher_exported_overlay_validation") &&
      spatialToSoftwareExecutionGatePackage.gates.some((gate) => gate.id === "depth_rehearsal_teacher_review") &&
      spatialToSoftwareExecutionGatePackage.gates.some((gate) => gate.id === "numbered_spatial_target_confirmation") &&
      spatialToSoftwareExecutionGatePackage.gates.some((gate) => gate.id === "software_execution_route_bridge") &&
      spatialToSoftwareExecutionGatePackage.locks?.packageDoesNotExecuteSoftware === true &&
      spatialToSoftwareExecutionGatePackage.locks?.softwareActionsExecuted === false &&
      spatialToSoftwareExecutionGatePackage.locks?.goalComplete === false &&
      spatialToSoftwareExecutionGatePackageHtml.includes("Spatial To Software Execution Gate Package") &&
      spatialToSoftwareFirstBlockerHandoff.format ===
        "transparent_ai_spatial_to_software_first_blocker_handoff_v1" &&
      spatialToSoftwareFirstBlockerHandoff.status ===
        "waiting_for_teacher_to_resolve_spatial_execution_first_blocker" &&
      spatialToSoftwareFirstBlockerHandoff.firstBlocker?.id === "depth_rehearsal_teacher_review" &&
      spatialToSoftwareFirstBlockerHandoff.firstTeacherAction?.id === "open_depth_rehearsal" &&
      spatialToSoftwareFirstBlockerHandoff.teacherSteps.some((step) => step.id === "validate_depth_rehearsal_receipt") &&
      spatialToSoftwareFirstBlockerHandoff.nextGateHandoff?.format ===
        "transparent_ai_spatial_to_software_first_blocker_next_gate_handoff_v1" &&
      spatialToSoftwareFirstBlockerHandoff.nextGateHandoff?.completionBlockerLane ===
        "transparent_sketch_spatial_intent_teacher_export" &&
      spatialToSoftwareFirstBlockerHandoff.nextGateHandoff?.nextGate ===
        "validate_transparent_sketch_depth_rehearsal_review_receipt" &&
      spatialToSoftwareFirstBlockerHandoff.nextGateHandoff?.returnToCompletionBlockerMatrixAfterNextGate === true &&
      spatialToSoftwareFirstBlockerHandoff.nextGateHandoff?.locks?.handoffDoesNotExecuteSoftware === true &&
      spatialToSoftwareFirstBlockerHandoff.locks?.handoffDoesNotExecuteSoftware === true &&
      spatialToSoftwareFirstBlockerHandoff.locks?.softwareActionsExecuted === false &&
      spatialToSoftwareFirstBlockerHandoff.locks?.goalComplete === false &&
      spatialToSoftwareFirstBlockerHandoffHtml.includes("Spatial To Software First Blocker Handoff") &&
      spatialToSoftwareFirstBlockerHandoffHtml.includes("Completion blocker lane") &&
      spatialSoftwareExecutionRouteBridge.nextExecutionGateHandoff?.format ===
        "transparent_ai_spatial_route_to_execution_approval_handoff_v1" &&
      spatialSoftwareExecutionRouteBridge.nextExecutionGateHandoff?.status ===
        "ready_for_real_local_execution_approval_gate_prep" &&
      spatialSoftwareExecutionRouteBridge.nextExecutionGateHandoff?.nextGate ===
        "create_real_local_execution_approval_gate" &&
      spatialSoftwareExecutionRouteBridge.nextExecutionGateHandoff?.prerequisiteGate ===
        "create_real_local_execution_pilot_selector" &&
      spatialSoftwareExecutionRouteBridge.nextExecutionGateHandoff?.nextGateAfterReadyGate ===
        "create_all_software_execution_approved_gate_command_builder" &&
      spatialSoftwareExecutionRouteBridge.nextExecutionGateHandoff?.finalRunnerGate ===
        "run_all_software_execution_approved_gate_runner" &&
      spatialSoftwareExecutionRouteBridge.nextExecutionGateHandoff?.readyForExecutionApprovalGatePrep === true &&
      spatialSoftwareExecutionRouteBridge.nextExecutionGateHandoff?.returnToCompletionBlockerMatrixAfterNextGate ===
        true &&
      spatialSoftwareExecutionRouteBridge.nextExecutionGateHandoff?.locks?.routeBridgeDoesNotCreateApprovalGate ===
        true &&
      spatialSoftwareExecutionRouteBridge.nextExecutionGateHandoff?.locks?.routeBridgeDoesNotRunApprovedGateRunner ===
        true &&
      spatialSoftwareExecutionRouteBridge.nextExecutionGateHandoff?.locks?.routeBridgeDoesNotInvokeAdapter === true &&
      result.spatialToSoftwareExecutionGatePackage === refresh.paths.spatialToSoftwareExecutionGatePackage &&
      result.spatialToSoftwareExecutionGatePackageHtml === refresh.paths.spatialToSoftwareExecutionGatePackageHtml &&
      result.spatialToSoftwareExecutionGatePackageStatus === "blocked_before_spatial_software_execution" &&
      result.spatialToSoftwareExecutionGateReadyForDryRunRouteBridge === false &&
      result.spatialToSoftwareExecutionGateFirstBlocker?.id === "depth_rehearsal_teacher_review" &&
      result.spatialToSoftwareFirstBlockerHandoff === refresh.paths.spatialToSoftwareFirstBlockerHandoff &&
      result.spatialToSoftwareFirstBlockerHandoffHtml === refresh.paths.spatialToSoftwareFirstBlockerHandoffHtml &&
      result.spatialToSoftwareFirstBlockerFirstTeacherAction?.id === "open_depth_rehearsal" &&
      result.spatialToSoftwareFirstBlockerNextGateHandoffFormat ===
        "transparent_ai_spatial_to_software_first_blocker_next_gate_handoff_v1" &&
      result.spatialToSoftwareFirstBlockerCompletionBlockerLane ===
        "transparent_sketch_spatial_intent_teacher_export" &&
      result.spatialToSoftwareFirstBlockerNextGate ===
        "validate_transparent_sketch_depth_rehearsal_review_receipt" &&
      result.spatialToSoftwareFirstBlockerReturnToCompletionBlockerMatrixAfterNextGate === true &&
      result.spatialToSoftwareFirstBlockerNextGateHandoffBlocksExecution === true &&
      result.spatialFirstBlockerOverlayResolverMcpTool === "resolve_spatial_first_blocker_overlay_packet" &&
      result.spatialFirstBlockerOverlayResolverAvailable === true &&
      result.spatialFirstBlockerOverlayResolverReviewOnly === true &&
      result.spatialFirstBlockerOverlayResolverExecutesSoftware === false &&
      result.spatialFirstBlockerOverlayResolverAppliesToCurrentBlocker === false &&
      result.spatialFirstBlockerOverlayResolverCommandTemplate.includes(
        "resolve_spatial_first_blocker_overlay_packet"
      ) &&
      result.spatialFirstBlockerOverlayResolverCommandTemplate.includes(
        "<teacher-exported-transparent-sketch-packet.json>"
      ) &&
      result.spatialRouteToExecutionApprovalHandoffFormat ===
        "transparent_ai_spatial_route_to_execution_approval_handoff_v1" &&
      result.spatialRouteToExecutionApprovalHandoffStatus ===
        "ready_for_real_local_execution_approval_gate_prep" &&
      result.spatialRouteToExecutionApprovalNextGate === "create_real_local_execution_approval_gate" &&
      result.spatialRouteToExecutionApprovalPrerequisiteGate === "create_real_local_execution_pilot_selector" &&
      result.spatialRouteToExecutionApprovalCommandBuilder ===
        "create_all_software_execution_approved_gate_command_builder" &&
      result.spatialRouteToExecutionApprovalFinalRunnerGate === "run_all_software_execution_approved_gate_runner" &&
      result.spatialRouteToExecutionApprovalReadyForApprovalPrep === true &&
      result.spatialRouteToExecutionApprovalReturnToCompletionBlockerMatrix === true &&
      result.spatialRouteBridgeDoesNotCreateApprovalGate === true &&
      result.spatialRouteBridgeDoesNotRunApprovedGateRunner === true &&
      result.spatialRouteBridgeDoesNotInvokeAdapter === true &&
      refresh.refreshedEvidence?.spatialToSoftwareExecutionGatePackagePresent === true &&
      refresh.refreshedEvidence?.spatialToSoftwareExecutionGatePackageStatus ===
        "blocked_before_spatial_software_execution" &&
      refresh.refreshedEvidence?.spatialToSoftwareExecutionGateReadyForDryRunRouteBridge === false &&
      refresh.refreshedEvidence?.spatialToSoftwareExecutionGateFirstBlocker?.id ===
        "depth_rehearsal_teacher_review" &&
      refresh.refreshedEvidence?.spatialToSoftwareExecutionGatePackageBlocksExecution === true &&
      refresh.refreshedEvidence?.spatialToSoftwareFirstBlockerHandoffPresent === true &&
      refresh.refreshedEvidence?.spatialToSoftwareFirstBlockerFirstTeacherAction?.id === "open_depth_rehearsal" &&
      refresh.refreshedEvidence?.spatialToSoftwareFirstBlockerHandoffBlocksExecution === true &&
      refresh.refreshedEvidence?.spatialToSoftwareFirstBlockerNextGateHandoffFormat ===
        "transparent_ai_spatial_to_software_first_blocker_next_gate_handoff_v1" &&
      refresh.refreshedEvidence?.spatialToSoftwareFirstBlockerCompletionBlockerLane ===
        "transparent_sketch_spatial_intent_teacher_export" &&
      refresh.refreshedEvidence?.spatialToSoftwareFirstBlockerNextGate ===
        "validate_transparent_sketch_depth_rehearsal_review_receipt" &&
      refresh.refreshedEvidence?.spatialToSoftwareFirstBlockerReturnToCompletionBlockerMatrixAfterNextGate === true &&
      refresh.refreshedEvidence?.spatialToSoftwareFirstBlockerNextGateHandoffBlocksExecution === true &&
      refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverMcpTool ===
        "resolve_spatial_first_blocker_overlay_packet" &&
      refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverAvailable === true &&
      refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverReviewOnly === true &&
      refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverExecutesSoftware === false &&
      refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverAppliesToCurrentBlocker === false &&
      refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverCommandTemplate.includes(
        "resolve_spatial_first_blocker_overlay_packet"
      ) &&
      refresh.refreshedEvidence?.spatialRouteToExecutionApprovalHandoffFormat ===
        "transparent_ai_spatial_route_to_execution_approval_handoff_v1" &&
      refresh.refreshedEvidence?.spatialRouteToExecutionApprovalNextGate === "create_real_local_execution_approval_gate" &&
      refresh.refreshedEvidence?.spatialRouteToExecutionApprovalPrerequisiteGate ===
        "create_real_local_execution_pilot_selector" &&
      refresh.refreshedEvidence?.spatialRouteToExecutionApprovalCommandBuilder ===
        "create_all_software_execution_approved_gate_command_builder" &&
      refresh.refreshedEvidence?.spatialRouteToExecutionApprovalFinalRunnerGate ===
        "run_all_software_execution_approved_gate_runner" &&
      refresh.refreshedEvidence?.spatialRouteToExecutionApprovalReadyForApprovalPrep === true &&
      refresh.refreshedEvidence?.spatialRouteBridgeDoesNotCreateApprovalGate === true &&
      refresh.refreshedEvidence?.spatialRouteBridgeDoesNotRunApprovedGateRunner === true &&
      refresh.refreshedEvidence?.spatialRouteBridgeDoesNotInvokeAdapter === true &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "spatial_to_software_execution_gate_package" &&
          link.path === refresh.paths.spatialToSoftwareExecutionGatePackageHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "spatial_to_software_first_blocker_handoff" &&
          link.path === refresh.paths.spatialToSoftwareFirstBlockerHandoffHtml
      ) &&
      refresh.directReviewEntryPoints?.some(
        (link) =>
          link.id === "spatial_first_blocker_overlay_resolver_mcp_tool" &&
          link.path === refresh.paths.spatialToSoftwareFirstBlockerHandoffHtml &&
          link.command.includes("resolve_spatial_first_blocker_overlay_packet") &&
          link.reviewOnly === true &&
          link.executesSoftware === false &&
          link.appliesToCurrentBlocker === false
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("spatial-to-software execution gate package") &&
          row.command === refresh.paths.spatialToSoftwareExecutionGatePackageHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("spatial-to-software first blocker handoff") &&
          row.command === refresh.paths.spatialToSoftwareFirstBlockerHandoffHtml
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Resolve teacher-exported overlay first blocker") &&
          row.command.includes("resolve_spatial_first_blocker_overlay_packet")
      ) &&
      readme.includes("Transparent sketch depth rehearsal review receipt builder") &&
      readme.includes("Transparent sketch depth rehearsal review receipt validation") &&
      readme.includes("Spatial-to-software execution gate package") &&
      readme.includes("Spatial-to-software first blocker handoff") &&
      readme.includes("Spatial route execution approval handoff") &&
      dashboard.includes("Transparent sketch depth rehearsal review receipt builder") &&
      dashboard.includes("Spatial-to-software execution gate package") &&
      dashboard.includes("Spatial-to-software first blocker handoff") &&
      dashboard.includes("Spatial route execution approval handoff"),
    evidence: refresh.discoveredEvidence?.spatialTargetConfirmationCommandTemplate || "missing spatial bridge"
  },
  {
    name: "Current status refresh exposes spatial-to-software execution gate package",
    pass:
      existsSync(refresh.paths.spatialToSoftwareExecutionGatePackage) &&
      existsSync(refresh.paths.spatialToSoftwareExecutionGatePackageHtml) &&
      spatialToSoftwareExecutionGatePackage.format ===
        "transparent_ai_spatial_to_software_execution_gate_package_v1" &&
      spatialToSoftwareExecutionGatePackage.status === "blocked_before_spatial_software_execution" &&
      spatialToSoftwareExecutionGatePackage.firstBlocker?.id === "depth_rehearsal_teacher_review" &&
      spatialToSoftwareExecutionGatePackage.locks?.packageDoesNotExecuteSoftware === true &&
      spatialToSoftwareExecutionGatePackage.locks?.softwareActionsExecuted === false &&
      refresh.refreshedEvidence?.spatialToSoftwareExecutionGatePackageBlocksExecution === true &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "spatial_to_software_execution_gate_package"),
    evidence: JSON.stringify({
      package: refresh.paths.spatialToSoftwareExecutionGatePackage,
      status: spatialToSoftwareExecutionGatePackage.status,
      firstBlocker: spatialToSoftwareExecutionGatePackage.firstBlocker
    })
  },
  {
    name: "Current status refresh exposes spatial-to-software first blocker teacher handoff",
    pass:
      existsSync(refresh.paths.spatialToSoftwareFirstBlockerHandoff) &&
      existsSync(refresh.paths.spatialToSoftwareFirstBlockerHandoffHtml) &&
      spatialToSoftwareFirstBlockerHandoff.format ===
        "transparent_ai_spatial_to_software_first_blocker_handoff_v1" &&
      spatialToSoftwareFirstBlockerHandoff.firstBlocker?.id === "depth_rehearsal_teacher_review" &&
      spatialToSoftwareFirstBlockerHandoff.firstTeacherAction?.id === "open_depth_rehearsal" &&
      spatialToSoftwareFirstBlockerHandoff.nextGateHandoff?.format ===
        "transparent_ai_spatial_to_software_first_blocker_next_gate_handoff_v1" &&
      spatialToSoftwareFirstBlockerHandoff.nextGateHandoff?.completionBlockerLane ===
        "transparent_sketch_spatial_intent_teacher_export" &&
      spatialToSoftwareFirstBlockerHandoff.nextGateHandoff?.returnToCompletionBlockerMatrixAfterNextGate === true &&
      spatialToSoftwareFirstBlockerHandoff.locks?.handoffDoesNotExecuteSoftware === true &&
      spatialToSoftwareFirstBlockerHandoff.locks?.softwareActionsExecuted === false &&
      refresh.refreshedEvidence?.spatialToSoftwareFirstBlockerNextGateHandoffBlocksExecution === true &&
      refresh.refreshedEvidence?.spatialToSoftwareFirstBlockerHandoffBlocksExecution === true &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "spatial_to_software_first_blocker_handoff"),
    evidence: JSON.stringify({
      handoff: refresh.paths.spatialToSoftwareFirstBlockerHandoff,
      firstTeacherAction: spatialToSoftwareFirstBlockerHandoff.firstTeacherAction
    })
  },
  {
    name: "Current status refresh exposes spatial route execution approval handoff",
    pass:
      existsSync(refresh.paths.spatialSoftwareExecutionRouteBridge) &&
      spatialSoftwareExecutionRouteBridge.nextExecutionGateHandoff?.format ===
        "transparent_ai_spatial_route_to_execution_approval_handoff_v1" &&
      refresh.refreshedEvidence?.spatialRouteToExecutionApprovalHandoffFormat ===
        "transparent_ai_spatial_route_to_execution_approval_handoff_v1" &&
      refresh.refreshedEvidence?.spatialRouteToExecutionApprovalNextGate === "create_real_local_execution_approval_gate" &&
      refresh.refreshedEvidence?.spatialRouteToExecutionApprovalPrerequisiteGate ===
        "create_real_local_execution_pilot_selector" &&
      refresh.refreshedEvidence?.spatialRouteToExecutionApprovalCommandBuilder ===
        "create_all_software_execution_approved_gate_command_builder" &&
      refresh.refreshedEvidence?.spatialRouteToExecutionApprovalFinalRunnerGate ===
        "run_all_software_execution_approved_gate_runner" &&
      refresh.refreshedEvidence?.spatialRouteToExecutionApprovalReadyForApprovalPrep === true &&
      refresh.refreshedEvidence?.spatialRouteBridgeDoesNotCreateApprovalGate === true &&
      refresh.refreshedEvidence?.spatialRouteBridgeDoesNotRunApprovedGateRunner === true &&
      refresh.refreshedEvidence?.spatialRouteBridgeDoesNotInvokeAdapter === true &&
      result.spatialRouteToExecutionApprovalHandoffFormat ===
        refresh.refreshedEvidence.spatialRouteToExecutionApprovalHandoffFormat &&
      result.spatialRouteToExecutionApprovalNextGate ===
        refresh.refreshedEvidence.spatialRouteToExecutionApprovalNextGate &&
      result.spatialRouteBridgeDoesNotRunApprovedGateRunner === true &&
      readme.includes("Spatial route execution approval handoff") &&
      dashboard.includes("Spatial route execution approval handoff"),
    evidence: JSON.stringify({
      routeBridge: refresh.paths.spatialSoftwareExecutionRouteBridge,
      nextGate: refresh.refreshedEvidence?.spatialRouteToExecutionApprovalNextGate,
      finalRunner: refresh.refreshedEvidence?.spatialRouteToExecutionApprovalFinalRunnerGate,
      doesNotRunRunner: refresh.refreshedEvidence?.spatialRouteBridgeDoesNotRunApprovedGateRunner
    })
  },
  {
    name: "Current status refresh exposes review-only MCP resolver for teacher-exported overlay first blocker",
    pass:
      refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverMcpTool ===
        "resolve_spatial_first_blocker_overlay_packet" &&
      refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverAvailable === true &&
      refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverReviewOnly === true &&
      refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverExecutesSoftware === false &&
      refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverAppliesToCurrentBlocker === false &&
      refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverCommandTemplate.includes(
        "<teacher-exported-transparent-sketch-packet.json>"
      ) &&
      result.spatialFirstBlockerOverlayResolverMcpTool ===
        refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverMcpTool &&
      result.spatialFirstBlockerOverlayResolverCommandTemplate ===
        refresh.refreshedEvidence.spatialFirstBlockerOverlayResolverCommandTemplate &&
      refresh.directReviewEntryPoints?.some(
        (entry) =>
          entry.id === "spatial_first_blocker_overlay_resolver_mcp_tool" &&
          entry.reviewOnly === true &&
          entry.executesSoftware === false &&
          entry.command.includes("resolve_spatial_first_blocker_overlay_packet")
      ) &&
      refresh.nextCommands.some(
        (row) =>
          row.label.includes("Resolve teacher-exported overlay first blocker") &&
          row.command.includes("resolve_spatial_first_blocker_overlay_packet")
      ),
    evidence: JSON.stringify({
      tool: refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverMcpTool,
      appliesToCurrentBlocker:
        refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverAppliesToCurrentBlocker,
      command: refresh.refreshedEvidence?.spatialFirstBlockerOverlayResolverCommandTemplate
    })
  },
  {
    name: "Current status refresh indexes validated spatial intent evidence while preserving the request and receipt gates",
    pass:
      existsSync(refresh.paths.spatialIntentEvidenceRequest) &&
      existsSync(refresh.paths.spatialIntentEvidenceRequestHtml) &&
      spatialIntentEvidenceRequest.status === "formal_spatial_intent_evidence_validated_prepare_numbered_confirmation" &&
      spatialIntentEvidenceRequest.transparentSketchOverlayPath === commandCenter.paths.transparentOverlay &&
      spatialIntentEvidenceRequest.expectedPacketFormat === "transparent_ai_sketch_overlay_packet_v1" &&
      spatialIntentEvidenceRequest.teacherExportedOverlayPacketPlaceholder === "<teacher-exported-transparent-sketch-packet.json>" &&
      spatialIntentEvidenceRequest.spatialTargetConfirmationCommandTemplate.includes("create-spatial-target-confirmation-kit.mjs") &&
      spatialIntentEvidenceRequest.spatialTargetConfirmationCommandTemplate.includes("<teacher-exported-transparent-sketch-packet.json>") &&
      spatialIntentEvidenceRequest.teacherHandoffSteps.some((step) => step.action.includes("Draw the intended 2D position")) &&
      spatialIntentEvidenceRequest.teacherHandoffSteps.some((step) => step.evidenceExpected.includes("z/depth hints")) &&
      spatialIntentEvidenceRequest.locks.reviewOnly === true &&
      spatialIntentEvidenceRequest.locks.accepted === false &&
      spatialIntentEvidenceRequest.locks.ruleEnabled === false &&
      spatialIntentEvidenceRequest.locks.packagingGated === true &&
      spatialIntentEvidenceRequest.locks.formalSpatialIntentEvidencePresent === true &&
      spatialIntentEvidenceRequest.locks.formalSpatialIntentEvidenceValidationRequired === false &&
      spatialIntentEvidenceRequest.locks.doesNotInterpretWithoutTeacherPacket === true &&
      spatialIntentEvidenceRequest.locks.doesNotExecuteSoftware === true &&
      spatialIntentEvidenceRequest.blockedActions.includes("fabricate_spatial_intent_without_teacher_exported_packet") &&
      spatialIntentEvidenceRequest.blockedActions.includes("treat_placeholder_as_teacher_evidence") &&
      refresh.discoveredEvidence?.spatialIntentEvidenceRequest === refresh.paths.spatialIntentEvidenceRequest &&
      refresh.discoveredEvidence?.spatialIntentEvidenceReceiptTemplate === refresh.paths.spatialIntentEvidenceReceiptTemplate &&
      refresh.discoveredEvidence?.spatialIntentEvidenceReceiptValidationCommandTemplate?.includes("validate-spatial-intent-evidence-receipt.mjs") &&
      refresh.paths.spatialIntentEvidenceReceiptValidation === spatialIntentEvidenceValidationFixturePath &&
      refresh.discoveredEvidence?.spatialIntentEvidenceReceiptValidation === spatialIntentEvidenceValidationFixturePath &&
      refresh.discoveredEvidence?.spatialIntentEvidenceReceiptValidationStatus === "validated_with_ready_spatial_target_confirmation" &&
      refresh.discoveredEvidence?.spatialIntentEvidenceReceiptValidationDecision === "ready_for_reviewed_spatial_target_confirmation" &&
      refresh.refreshedEvidence?.spatialIntentEvidenceReceiptValidationHas2D === true &&
      refresh.refreshedEvidence?.spatialIntentEvidenceReceiptValidationHasPerspective === true &&
      refresh.refreshedEvidence?.spatialIntentEvidenceReceiptValidationHas3DDepth === true &&
      refresh.refreshedEvidence?.spatialIntentEvidenceReceiptValidationDetailLogicReady === true &&
      refresh.refreshedEvidence?.spatialIntentEvidenceReceiptValidationDetailLogicReceiptReady === true &&
      refresh.refreshedEvidence?.spatialRoutePilotSelectionReceiptCommandReady === true &&
      refresh.refreshedEvidence?.spatialRoutePilotSelectionReceiptValidationCommandReady === true &&
      refresh.refreshedEvidence?.spatialRoutePilotSelectionRequiredBeforeApprovalPrepReuse === true &&
      refresh.refreshedEvidence?.spatialRouteApprovalPrepReuseBlockedUntilTeacherPilotSelectionReceipt === true &&
      spatialIntentEvidenceReceiptValidation.format === "transparent_ai_spatial_intent_evidence_receipt_validation_v1" &&
      spatialIntentEvidenceReceiptValidation.validationRow.spatialEvidence.ready === true &&
      spatialIntentEvidenceReceiptValidation.validationRow.detailLogicReadyForAction === true &&
      spatialIntentEvidenceReceiptValidation.validationRow.detailLogicValidationReadyForAction === true &&
      spatialIntentEvidenceReceiptValidation.locks.validationDoesNotRunSpatialTargetConfirmation === true &&
      spatialIntentEvidenceReceiptValidation.locks.softwareActionsExecuted === false &&
      spatialIntentEvidenceReceiptValidation.locks.memoryWritten === false &&
      existsSync(refresh.paths.spatialIntentEvidenceReceiptBuilder) &&
      existsSync(refresh.paths.spatialIntentEvidenceReceiptBuilderHtml) &&
      spatialIntentEvidenceReceiptBuilder.format === "transparent_ai_spatial_intent_evidence_receipt_builder_v1" &&
      spatialIntentEvidenceReceiptBuilder.nextValidationCommand.includes("validate-spatial-intent-evidence-receipt.mjs") &&
      spatialIntentEvidenceReceiptBuilder.nextValidationCommand.includes("<teacher-filled-spatial-intent-evidence-receipt.json>") &&
      spatialIntentEvidenceReceiptBuilder.locks.builderDoesNotRunSpatialTargetConfirmation === true &&
      spatialIntentEvidenceReceiptBuilder.locks.softwareActionsExecuted === false &&
      spatialIntentEvidenceReceiptBuilderHtml.includes("Spatial Intent Evidence Receipt Builder") &&
      spatialIntentEvidenceReceiptTemplate.format === "transparent_ai_spatial_intent_evidence_receipt_v1" &&
      spatialIntentEvidenceReceiptTemplate.teacherDecision === "needs_teacher_review" &&
      spatialIntentEvidenceReceiptTemplate.teacherExportedOverlayPacketPath === "<teacher-exported-transparent-sketch-packet.json>" &&
      spatialIntentEvidenceReceiptTemplate.blockedTeacherDecisions.includes("execute_now") &&
      spatialIntentEvidenceReceiptTemplate.nextValidationCommandTemplate.includes("validate-spatial-intent-evidence-receipt.mjs") &&
      spatialIntentEvidenceReceiptTemplate.locks.receiptTemplateDoesNotInterpretSketch === true &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "spatial_intent_evidence_request" && link.path === refresh.paths.spatialIntentEvidenceRequestHtml) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "spatial_intent_evidence_receipt_builder" && link.path === refresh.paths.spatialIntentEvidenceReceiptBuilderHtml) &&
      refresh.directReviewEntryPoints?.some((link) => link.id === "spatial_intent_evidence_receipt_template" && link.path === refresh.paths.spatialIntentEvidenceReceiptTemplate) &&
      refresh.nextCommands.some((row) => row.label.includes("spatial intent evidence receipt builder") && row.command === refresh.paths.spatialIntentEvidenceReceiptBuilderHtml) &&
      spatialIntentEvidenceRequestHtml.includes("Spatial Intent Evidence Request") &&
      spatialIntentEvidenceRequestHtml.includes("No spatial intent is accepted until a real teacher-exported packet replaces the placeholder") &&
      !spatialIntentEvidenceRequestHtml.includes("--teacher-reviewed") &&
      !spatialIntentEvidenceRequestHtml.includes("--execute"),
    evidence: refresh.paths.spatialIntentEvidenceRequestHtml
  },
  {
    name: "MCP advanced mode exposes and runs current status refresh",
    pass:
      mcpAdvanced.list.mode === "advanced" &&
      mcpAdvancedNames.includes("create_original_goal_current_status_refresh") &&
      mcpAdvancedNames.includes("create_original_goal_integrated_control_flow") &&
      mcpAdvanced.result.format === "transparent_ai_original_goal_current_status_refresh_result_v1" &&
      mcpAdvancedRefresh.format === "transparent_ai_original_goal_current_status_refresh_v1" &&
      mcpAdvancedRefresh.locks.refreshDoesNotRegisterTask === true &&
      mcpAdvancedRefresh.locks.refreshDoesNotExecuteTargetSoftware === true &&
      mcpAdvancedRefresh.locks.refreshDoesNotWriteMemory === true &&
      mcpAdvancedRefresh.locks.goalComplete === false,
    evidence: mcpAdvanced.result.refreshPath
  },
  {
    name: "Default teach_apprentice routes original-goal current-status refresh to review card",
    pass:
      mcpDefaultCard.format === "transparent_ai_teach_apprentice_card_v1" &&
      mcpDefaultCard.status === "waiting_for_original_goal_current_status_refresh_review" &&
      mcpDefaultCard.originalGoalCurrentStatusRefresh?.openFirst &&
      mcpDefaultCard.originalGoalCurrentStatusRefresh?.refreshDoesNotRegisterTask === true &&
      mcpDefaultCard.originalGoalCurrentStatusRefresh?.refreshDoesNotExecuteTargetSoftware === true &&
      mcpDefaultCard.originalGoalCurrentStatusRefresh?.refreshDoesNotWriteMemory === true &&
      mcpDefaultCard.reviewLocks?.packagingGated === true,
    evidence: mcpDefaultCard.originalGoalCurrentStatusRefresh?.openFirst ?? "missing default refresh card"
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_original_goal_current_status_refresh_smoke_v1",
  smokeRoot,
  paths: {
    refresh: result.refreshPath,
    readme: result.readmePath,
    readiness: result.originalGoalReadinessAudit,
    statusConsole: result.operationalStatusConsole,
    gapActionBoard: result.gapActionBoard,
    eventTriggeredObservationPolicy: refresh.paths.eventTriggeredObservationPolicy,
    eventTriggeredObservationPolicyHtml: refresh.paths.eventTriggeredObservationPolicyHtml,
    eventTriggeredObservationPolicyReceiptBuilderHtml: refresh.paths.eventTriggeredObservationPolicyReceiptBuilderHtml,
    eventTriggeredObservationPolicyReceiptValidationCommandTemplate:
      refresh.paths.eventTriggeredObservationPolicyReceiptValidationCommandTemplate,
    goalCommandCenter: result.goalCommandCenter,
    originalGoalIntegratedControlFlow: refresh.paths.originalGoalIntegratedControlFlow,
    originalGoalIntegratedControlFlowHtml: refresh.paths.originalGoalIntegratedControlFlowHtml,
    dashboard: result.dashboardPath,
    mcpAdvancedRefresh: mcpAdvanced.result.refreshPath,
    mcpDefaultRefresh: mcpDefaultCard.originalGoalCurrentStatusRefresh?.refreshPath ?? ""
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
