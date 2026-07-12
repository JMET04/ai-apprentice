#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "goal-command-center-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });
const fixtureStatusPath = join(smokeRoot, "fixture-operational-status-console.json");
const fixtureReadinessPath = join(smokeRoot, "fixture-original-goal-readiness-audit.json");
const fixtureActivationReviewPacketPath = join(smokeRoot, "fixture-activation-review-packet.json");
const fixtureActivationReceiptValidationPath = join(smokeRoot, "fixture-activation-receipt-validation.json");
const fixtureCoverageExpansionPlanPath = join(smokeRoot, "fixture-coverage-expansion-plan.json");
const fixtureCoverageConvergencePath = join(smokeRoot, "fixture-coverage-convergence.json");
const fixtureCoverageEnrollmentLedgerPath = join(smokeRoot, "fixture-coverage-enrollment-ledger.json");
const fixtureCoverageEnrollmentFollowUpPlanPath = join(smokeRoot, "fixture-coverage-enrollment-follow-up-plan.json");
const fixtureCoverageEnrollmentFollowUpBatchPath = join(smokeRoot, "fixture-coverage-enrollment-follow-up-batch.json");
const fixtureCoverageEnrollmentFollowUpReconciliationPath = join(smokeRoot, "fixture-coverage-enrollment-follow-up-reconciliation.json");
const fixtureExecutionConvergencePath = join(smokeRoot, "fixture-execution-convergence.json");
const fixtureExecutionFollowUpBatchPath = join(smokeRoot, "fixture-execution-follow-up-batch.json");
const fixtureExecutionFollowUpReadmePath = join(smokeRoot, "ALL_SOFTWARE_EXECUTION_CAPABILITY_MATRIX_FOLLOW_UP_BATCH_START_HERE.md");
const fixtureControlProbePlanPath = join(smokeRoot, "fixture-control-channel-probe-plan.json");
const fixtureControlProbeResultTemplatePath = join(smokeRoot, "fixture-control-channel-probe-result-template.json");
const fixtureControlProbeReadmePath = join(smokeRoot, "FIXTURE_CONTROL_CHANNEL_PROBE_START_HERE.md");
const fixtureControlChannelRepairQueuePath = join(smokeRoot, "fixture-control-channel-repair-queue.json");
const fixtureVisualEvidencePath = join(smokeRoot, "fixture-reviewed-engineering-window.svg");
writeFileSync(
  fixtureVisualEvidencePath,
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">',
    '<rect width="960" height="540" fill="#f8fafc"/>',
    '<rect x="32" y="32" width="180" height="476" fill="#e2e8f0" stroke="#94a3b8"/>',
    '<rect x="240" y="72" width="650" height="390" fill="#ffffff" stroke="#64748b"/>',
    '<circle cx="748" cy="132" r="42" fill="#bfdbfe" stroke="#2563eb" stroke-width="4"/>',
    '<text x="265" y="112" font-family="Arial" font-size="24" fill="#0f172a">ExampleCAD reviewed visual evidence</text>',
    '<text x="690" y="210" font-family="Arial" font-size="20" fill="#1d4ed8">upper right target</text>',
    '</svg>'
  ].join(""),
  "utf8"
);
writeFileSync(
  fixtureStatusPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_operational_status_console_v1",
      status: "fixture_ready_for_teacher_review",
      lanes: [
        {
          id: "coverage_convergence",
          status: "coverage_still_bounded_or_missing",
          detail: "coverage rollout still needs teacher review"
        },
        {
          id: "execution_capability",
          status: "execution_capability_still_bounded_or_missing",
          detail: "execution capability still needs route evidence"
        }
      ],
      locks: { targetSoftwareCommandsExecuted: false, memoryWritten: false }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  fixtureActivationReceiptValidationPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_operational_activation_review_receipt_validation_v1",
      status: "receipt_validation_waiting_for_teacher_confirmation",
      validationRows: [
        {
          id: "recurring_monitor_teacher_confirmation",
          requiredPhrase: "teacher_confirmed_recurring_low_token_monitor_review",
          status: "missing_teacher_confirmation",
          canAdvance: false
        }
      ],
      paths: {
        validation: "D:\\example\\activation-validation.json"
      }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  fixtureCoverageExpansionPlanPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_expansion_plan_v1",
      planId: "goal-command-center-coverage-plan",
      status: "waiting_for_teacher_review",
      batches: [
        {
          batchId: "batch-001",
          status: "waiting_for_teacher_review",
          batchSize: 2,
          rows: [
            { software: "ExampleCAD", processName: "ExampleCAD", signalStatus: "has_log_metadata_route" },
            { software: "ExampleCAM", processName: "ExampleCAM", signalStatus: "has_log_metadata_route" }
          ]
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        softwareActionsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  fixtureCoverageConvergencePath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_convergence_audit_v1",
      status: "coverage_rollout_still_has_remaining_batches_or_audit_gaps",
      sourceExpansionPlanPath: fixtureCoverageExpansionPlanPath,
      remainingBatches: [
        {
          batchId: "batch-001",
          status: "prepared_waiting_for_teacher_review",
          plannedRows: 8,
          nextAction: "teacher_review_required_before_runner"
        }
      ],
      nextCommand: "node run-all-software-coverage-rollout-supervisor.mjs"
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  fixtureCoverageEnrollmentLedgerPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_ledger_v1",
      ledgerId: "goal-command-center-enrollment-ledger",
      status: "coverage_enrollment_waiting_for_teacher_review",
      rows: [
        {
          ledgerNumber: 1,
          software: "ExampleCAD",
          processName: "ExampleCAD.exe",
          status: "inventory_signal_waiting_for_queue_enrollment",
          readyForTeacherCoverageReview: false,
          teacherExcluded: false,
          nextActions: [
            {
              tool: "create_software_observer_queue",
              arguments: { inventory: "fixture-inventory.json" }
            }
          ]
        },
        {
          ledgerNumber: 2,
          software: "AlreadyReviewed",
          processName: "AlreadyReviewed.exe",
          status: "ready_with_watch_evidence",
          readyForTeacherCoverageReview: true,
          teacherExcluded: false
        }
      ],
      nextReviewQueue: [{ ledgerNumber: 1, software: "ExampleCAD" }],
      sourceEvidence: {
        inventoryPath: "fixture-inventory.json",
        queuePath: "fixture-queue.json",
        coverageAuditPath: fixtureCoverageConvergencePath
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
  ),
  "utf8"
);
writeFileSync(
  fixtureCoverageEnrollmentFollowUpPlanPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
      planId: "goal-command-center-enrollment-follow-up-plan",
      status: "coverage_enrollment_follow_up_plan_waiting_for_teacher_review",
      sourceLedgerPath: fixtureCoverageEnrollmentLedgerPath,
      followUpItems: [
        {
          followUpId: "enrollment-follow-up-001",
          ledgerNumber: 1,
          software: "ExampleCAD",
          processName: "ExampleCAD.exe",
          status: "inventory_signal_waiting_for_queue_enrollment",
          route: "promote_inventory_row_to_observer_queue",
          priority: 20,
          instruction: "Create or extend an observer queue before claiming ExampleCAD coverage.",
          tool: "create_software_observer_queue",
          fallbackTool: "",
          arguments: { inventory: "fixture-inventory.json" },
          expectedEvidence: "observer queue item appears for this software in the next enrollment ledger",
          stopIf: ["the route would require screenshots, software execution, memory write, or scheduled task registration"]
        }
      ],
      counts: {
        sourceRows: 2,
        sourceNextReviewQueue: 1,
        followUpItems: 1,
        readyRowsSkipped: 1,
        teacherExcludedRowsSkipped: 0
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
  ),
  "utf8"
);
writeFileSync(
  fixtureCoverageEnrollmentFollowUpBatchPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1",
      batchId: "goal-command-center-enrollment-follow-up-batch",
      status: "dry_run_waiting_for_teacher_review",
      sourcePlanPath: fixtureCoverageEnrollmentFollowUpPlanPath,
      selectedItemCount: 1,
      ranToolCount: 0,
      rowResults: [
        {
          followUpId: "enrollment-follow-up-001",
          software: "ExampleCAD",
          status: "dry_run_prepared_waiting_for_teacher_review",
          ranTool: false
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
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  fixtureCoverageEnrollmentFollowUpReconciliationPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_v1",
      status: "waiting_for_teacher_review",
      paths: {
        batchPath: fixtureCoverageEnrollmentFollowUpBatchPath,
        sourcePlanPath: fixtureCoverageEnrollmentFollowUpPlanPath,
        sourceLedgerPath: fixtureCoverageEnrollmentLedgerPath
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
  ),
  "utf8"
);
writeFileSync(
  fixtureExecutionConvergencePath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_execution_capability_convergence_audit_v1",
      status: "execution_capability_still_has_remaining_lanes_or_review_gaps",
      sourceEvidence: {
        latestMatrixPath: "D:\\example\\matrix.json"
      },
      remainingReviewGaps: [
        {
          kind: "dry_run_receipts_missing",
          detail: "4 rows are dry-run-pilot candidates but only 0 dry-run runner invocations are aggregated."
        }
      ],
      nextCommand: "Review latest matrix gaps, confirm routes, then rerun a bounded supervisor pass."
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  fixtureControlProbePlanPath,
  JSON.stringify(
    {
      format: "transparent_ai_software_control_channel_probe_plan_v1",
      software: "NeedsControlProbe",
      status: "fixture_read_only_probe_plan_waiting_for_teacher_review",
      locks: {
        reviewOnly: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  fixtureControlProbeResultTemplatePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_control_channel_probe_result_template_v1",
      software: "NeedsControlProbe",
      defaultDecision: "needs_teacher_review",
      locks: {
        reviewOnly: true,
        softwareActionsExecuted: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  fixtureControlProbeReadmePath,
  [
    "# Fixture Control Channel Probe",
    "",
    "This is read-only fixture evidence for the command center smoke."
  ].join("\n"),
  "utf8"
);
writeFileSync(
  fixtureExecutionFollowUpBatchPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1",
      status: "waiting_for_teacher_review",
      counts: {
        totalMatrixRows: 24,
        selectedRows: 4,
        dryRunRunnerInvocations: 0,
        preparedRunnerCalls: 4
      },
      rowResults: [
        {
          rowId: "fixture-row-1",
          software: "ExampleCAD",
          lane: "review_and_run_one_dry_run_pilot",
          status: "dry_run_runner_call_prepared_waiting_for_teacher_review",
          runnerInvoked: false
        },
        {
          rowId: "fixture-control-row-1",
          software: "NeedsControlProbe",
          lane: "collect_control_channel_evidence",
          status: "control_channel_probe_package_created_waiting_for_teacher_review",
          runnerInvoked: false,
          probeResult: {
            probePlan: fixtureControlProbePlanPath,
            resultTemplate: fixtureControlProbeResultTemplatePath,
            teacherReadme: fixtureControlProbeReadmePath
          }
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        targetSoftwareCommandsExecuted: false,
        uiEventsSent: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        allSoftwareExecutionComplete: false
      }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  fixtureExecutionFollowUpReadmePath,
  [
    "# All-Software Execution Capability Matrix Follow-Up Batch",
    "",
    "Fixture readme for command center link packaging.",
    "No target software is executed by this fixture."
  ].join("\n"),
  "utf8"
);
writeFileSync(
  fixtureControlChannelRepairQueuePath,
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_control_channel_repair_queue_v1",
      auditPath: "D:\\example\\control-audit.json",
      createdAt: new Date().toISOString(),
      items: [
        {
          itemId: "control-repair-001",
          software: "ExampleCAD",
          status: "structured_control_route_reviewable",
          missingBeforeExecute: ["review exact command and dry-run receipt before execution"],
          nextCall: "create_software_control_channel_profile",
          blockedTransitions: ["execute_now", "enable_rule", "accept_native_control", "unlock_packaging"]
        },
        {
          itemId: "control-repair-002",
          software: "NeedsProbe",
          status: "observation_only_needs_control_evidence",
          missingBeforeExecute: ["teacher supplies API/CLI/file/browser evidence or confirms UI fallback"],
          nextCall: "create_software_control_channel_probe",
          blockedTransitions: ["execute_now", "enable_rule", "accept_native_control", "unlock_packaging"]
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  fixtureReadinessPath,
  JSON.stringify(
    {
      format: "transparent_ai_original_goal_readiness_audit_v1",
      decision: "fixture_not_complete_until_teacher_review_and_live_execution_evidence",
      locks: { accepted: false, packagingGated: true }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  fixtureActivationReviewPacketPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_operational_activation_review_packet_v1",
      status: "waiting_for_teacher_activation_confirmations",
      missingConfirmationCount: 3,
      confirmationRows: [
        {
          id: "recurring_monitor_teacher_confirmation",
          label: "Teacher confirms recurring low-token monitoring may be reviewed",
          current: "missing",
          requiredPhrase: "teacher_confirmed_recurring_low_token_monitor_review"
        },
        {
          id: "reviewed_monitor_scope_confirmation",
          label: "Teacher reviewed the monitored software scope",
          current: "missing",
          requiredPhrase: "teacher_reviewed_monitor_scope"
        },
        {
          id: "registration_review_confirmation",
          label: "Teacher confirms registration may proceed only to dry-run review",
          current: "missing",
          requiredPhrase: "teacher_confirmed_registration_dry_run_review_only"
        }
      ],
      paths: {
        sourceActivationGate: "D:\\example\\activation-gate.json",
        sourceTrial: "D:\\example\\trial.json"
      },
      locks: {
        packetDoesNotRegisterTask: true,
        scheduledTaskRegistered: false,
        targetSoftwareCommandsExecuted: false
      }
    },
    null,
    2
  ),
  "utf8"
);

function runNodeScript(scriptName, args = [], env = {}, cwd = repoRoot) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, ...env }
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function callMcpTool(name, args = {}) {
  const request = [
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } })
  ].join("\n");
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", "mcp-server.mjs")], {
    cwd: repoRoot,
    encoding: "utf8",
    input: `${request}\n`,
    timeout: 120000,
    env: { ...process.env, TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" }
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `MCP ${name} failed`);
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const response = lines.find((line) => line.id === 2);
  if (response?.error) throw new Error(response.error.message);
  return JSON.parse(response.result.content[0].text);
}

const commonArgs = [
  "--goal",
  "Verify one unified command center for all-software low-token learning, transparent 2D perspective 3D sketch intent, voice target confirmation, and supervised execution gates.",
  "--software",
  "ExampleCAD",
  "--command",
  "Place the reviewed pocket on the upper right target after I confirm the number.",
  "--teacher-style",
  "voice plus transparent sketch and correction-first",
  "--candidate",
  "upper-right-reviewed-pocket|upper right reviewed pocket|0.78|0.22|0.2|teacher likely means this engineering target",
  "--candidate",
  "left-tool-panel|left tool panel|0.16|0.44|0|alternative tool panel target",
  "--no-port-scan",
  "--operational-status-console",
  fixtureStatusPath,
  "--original-goal-readiness-audit",
  fixtureReadinessPath,
  "--activation-review-packet",
  fixtureActivationReviewPacketPath,
  "--activation-receipt-validation",
  fixtureActivationReceiptValidationPath,
  "--coverage-expansion-plan",
  fixtureCoverageExpansionPlanPath,
  "--coverage-convergence",
  fixtureCoverageConvergencePath,
  "--coverage-enrollment-ledger",
  fixtureCoverageEnrollmentLedgerPath,
  "--coverage-enrollment-follow-up-plan",
  fixtureCoverageEnrollmentFollowUpPlanPath,
  "--coverage-enrollment-follow-up-batch",
  fixtureCoverageEnrollmentFollowUpBatchPath,
  "--coverage-enrollment-follow-up-reconciliation",
  fixtureCoverageEnrollmentFollowUpReconciliationPath,
  "--execution-convergence",
  fixtureExecutionConvergencePath,
  "--execution-follow-up-batch",
  fixtureExecutionFollowUpBatchPath,
  "--control-channel-repair-queue",
  fixtureControlChannelRepairQueuePath,
  "--visual-evidence",
  fixtureVisualEvidencePath,
  "--output-dir",
  join(smokeRoot, "direct")
];

const direct = runNodeScript("create-goal-command-center.mjs", commonArgs);
const center = readJson(direct.centerPath);
const voiceWorkbenchState = readJson(center.paths.voiceWorkbench);
const controlChannelRepairBuilder = readJson(center.paths.controlChannelRepairReceiptBuilder);
const controlChannelDerivedRepairQueue = readJson(controlChannelRepairBuilder.paths.derivedRepairQueue);
const voiceWorkbenchGoalInput = readFileSync(center.paths.voiceWorkbenchGoalInput, "utf8").trim();
const voiceWorkbenchCommandInput = readFileSync(center.paths.voiceWorkbenchCommandInput, "utf8").trim();
const receipt = readJson(direct.receiptTemplatePath);
const htmlText = readFileSync(direct.htmlPath, "utf8");
const directCenterDir = dirname(direct.htmlPath);

const autoDiscoveryCwd = join(smokeRoot, "auto-discovery-cwd");
const autoCurrentStatusDir = join(autoDiscoveryCwd, ".transparent-apprentice", "current-operational-status-console", "latest-current");
const autoHistoricalStatusDir = join(autoDiscoveryCwd, ".transparent-apprentice", "all-software-operational-status-consoles", "older-historical");
mkdirSync(autoCurrentStatusDir, { recursive: true });
mkdirSync(autoHistoricalStatusDir, { recursive: true });
writeFileSync(
  join(autoCurrentStatusDir, "all-software-operational-status-console.json"),
  JSON.stringify(
    {
      format: "transparent_ai_all_software_operational_status_console_v1",
      status: "auto_current_status_console_fixture",
      lanes: [{ id: "current_status_marker", status: "current_should_win" }],
      locks: { targetSoftwareCommandsExecuted: false }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  join(autoHistoricalStatusDir, "all-software-operational-status-console.json"),
  JSON.stringify(
    {
      format: "transparent_ai_all_software_operational_status_console_v1",
      status: "auto_historical_status_console_fixture",
      lanes: [{ id: "historical_status_marker", status: "historical_should_not_win" }],
      locks: { targetSoftwareCommandsExecuted: false }
    },
    null,
    2
  ),
  "utf8"
);
const autoDiscoveryArgs = commonArgs.filter((value, index, values) => {
  if (value === "--operational-status-console" || values[index - 1] === "--operational-status-console") return false;
  if (value === "--output-dir" || values[index - 1] === "--output-dir") return false;
  return true;
});
autoDiscoveryArgs.push("--output-dir", join(autoDiscoveryCwd, "command-center-output"));
const autoDiscovery = runNodeScript("create-goal-command-center.mjs", autoDiscoveryArgs, {}, autoDiscoveryCwd);
const autoDiscoveryCenter = readJson(autoDiscovery.centerPath);

function packageLinkExists(link) {
  if (!link?.url || /^[a-z]+:|^[\\/]/i.test(link.url)) return false;
  return existsSync(join(directCenterDir, ...link.url.split("/").map((part) => decodeURIComponent(part))));
}

const mcp = callMcpTool("create_goal_command_center", {
  goal: "Create a unified command center from all-software low-token observation through numbered target confirmation and dry-run execution gates.",
  software: "ExampleCAD",
  command: "Mark the upper right target and wait for my number confirmation.",
  teacherStyle: "voice sketch logs",
  candidates: [
    "upper-right-reviewed-pocket|upper right reviewed pocket|0.78|0.22|0.2|teacher likely means this engineering target"
  ],
  noPortScan: true,
  visualEvidence: fixtureVisualEvidencePath,
  operationalStatusConsole: fixtureStatusPath,
  originalGoalReadinessAudit: fixtureReadinessPath,
  coverageExpansionPlan: fixtureCoverageExpansionPlanPath,
  coverageConvergence: fixtureCoverageConvergencePath,
  coverageEnrollmentLedger: fixtureCoverageEnrollmentLedgerPath,
  coverageEnrollmentFollowUpPlan: fixtureCoverageEnrollmentFollowUpPlanPath,
  coverageEnrollmentFollowUpBatch: fixtureCoverageEnrollmentFollowUpBatchPath,
  coverageEnrollmentFollowUpReconciliation: fixtureCoverageEnrollmentFollowUpReconciliationPath,
  executionFollowUpBatch: fixtureExecutionFollowUpBatchPath,
  controlChannelRepairQueue: fixtureControlChannelRepairQueuePath,
  outputDir: join(smokeRoot, "mcp")
});
const mcpCenter = readJson(mcp.centerPath);
const mcpVoiceWorkbenchState = readJson(mcpCenter.paths.voiceWorkbench);

const requiredPaths = [
  center.paths.teacherMethodProfile,
  center.paths.observerBootstrap,
  center.paths.transparentOverlay,
  center.paths.voiceWorkbenchGoalInput,
  center.paths.voiceWorkbenchCommandInput,
  center.paths.voiceWorkbench,
  center.paths.voiceWorkbenchHtml,
  center.paths.voiceWorkbenchVisualTargetConfirmation,
  center.paths.voiceWorkbenchVisualTargetConfirmationHtml,
  center.paths.voiceWorkbenchVisualOverlayPacket,
  center.paths.voiceWorkbenchVisualEvidence,
  center.paths.teachExecuteLoop,
  center.paths.operationalStatusConsole,
  center.paths.teacherReviewCockpit,
  center.paths.teacherReviewCockpitHtml,
  center.paths.teacherReviewCockpitReceiptTemplate,
  center.paths.originalGoalReadinessAudit,
  center.paths.activationReceiptBuilder,
  center.paths.activationReceiptBuilderHtml,
  center.paths.originalGoalGapActionBoard,
  center.paths.originalGoalGapActionBoardHtml,
  center.paths.originalGoalGapActionBoardReceiptTemplate,
  center.paths.coverageExpansionPlan,
  center.paths.coverageRolloutReceiptBuilder,
  center.paths.coverageRolloutReceiptBuilderHtml,
  center.paths.coverageRolloutReceiptBuilderReadme,
  center.paths.coverageEnrollmentLedger,
  center.paths.coverageEnrollmentFollowUpPlan,
  center.paths.coverageEnrollmentFollowUpBatch,
  center.paths.coverageEnrollmentFollowUpReconciliation,
  center.paths.coverageEnrollmentFollowUpReceiptBuilder,
  center.paths.coverageEnrollmentFollowUpReceiptBuilderHtml,
  center.paths.coverageEnrollmentFollowUpReceiptTemplate,
  center.paths.executionFollowUpBatch,
  center.paths.executionFollowUpReadme,
  center.paths.executionFollowUpReceiptBuilder,
  center.paths.executionFollowUpReceiptBuilderHtml,
  center.paths.executionFollowUpReceiptBuilderReadme,
  center.paths.controlChannelRepairQueue,
  center.paths.controlChannelRepairReceiptBuilder,
  center.paths.controlChannelRepairReceiptBuilderHtml,
  center.paths.controlChannelRepairReceiptBuilderReadme,
  direct.htmlPath,
  direct.receiptTemplatePath,
  mcp.centerPath
];

const checks = [
  {
    name: "Command center writes a unified machine-readable state and local HTML first screen",
    pass:
      center.format === "transparent_ai_goal_command_center_v1" &&
      htmlText.includes("Transparent AI Goal Command Center") &&
      existsSync(direct.centerPath) &&
      existsSync(direct.htmlPath)
  },
  {
    name: "Command center reuses existing low-token observation, overlay, voice workbench, voice approval gate, and teach-execute tools",
    pass:
      center.stages.some((stage) => stage.existingTool === "create_all_software_observer_bootstrap") &&
      center.stages.some((stage) => stage.existingTool === "create_transparent_sketch_overlay_kit") &&
      center.stages.some((stage) => stage.existingTool === "create_engineering_voice_control_workbench") &&
      center.stages.some((stage) => stage.existingTool === "create_visual_engineering_target_confirmation_kit") &&
      center.stages.some((stage) => stage.existingTool === "create_engineering_voice_execution_approval_gate") &&
      center.stages.some((stage) => stage.existingTool === "create_all_software_coverage_rollout_receipt_builder") &&
      center.stages.some((stage) => stage.existingTool === "create_all_software_coverage_enrollment_follow_up_receipt_builder") &&
      center.stages.some((stage) => stage.existingTool === "run_all_software_execution_capability_matrix_follow_up_batch") &&
      center.stages.some((stage) => stage.existingTool === "create_all_software_execution_follow_up_receipt_builder") &&
      center.stages.some((stage) => stage.existingTool === "create_all_software_control_channel_repair_receipt_builder") &&
      center.stages.some((stage) => stage.existingTool === "create_teach_execute_learning_loop") &&
      requiredPaths.every((path) => path && existsSync(path))
  },
  {
    name: "Command center feeds voice/text workbench through UTF-8 input files",
    pass:
      center.paths.voiceWorkbenchGoalInput.endsWith("goal.txt") &&
      center.paths.voiceWorkbenchCommandInput.endsWith("command.txt") &&
      voiceWorkbenchGoalInput === center.goal &&
      voiceWorkbenchCommandInput === "Place the reviewed pocket on the upper right target after I confirm the number." &&
      voiceWorkbenchState.goal === center.goal &&
      voiceWorkbenchState.targetCandidates.length >= 1 &&
      voiceWorkbenchState.locks.softwareActionsExecuted === false,
    evidence: `${center.paths.voiceWorkbenchGoalInput}; ${center.paths.voiceWorkbenchCommandInput}`
  },
  {
    name: "Command center exposes next calls for teacher method, read-only observation, numbered confirmation, voice approval gate, rehearsal, and supervised gate",
    pass:
      center.nextCalls.reviewTeacherMethod?.tool === "continue_teaching" &&
      center.nextCalls.readOnlyObservation?.tool === "start_teach_execute_reviewed_observation" &&
      center.nextCalls.confirmNumberedTarget?.tool === "confirm_engineering_command_target" &&
      center.nextCalls.voiceExecutionApprovalGate?.tool === "create_engineering_voice_execution_approval_gate" &&
      center.nextCalls.voiceExecutionApprovalGate?.blockedUntil?.includes("rollback point") &&
      center.nextCalls.executionCapabilityFollowUpBatch?.tool === "run_all_software_execution_capability_matrix_follow_up_batch" &&
      center.nextCalls.executionCapabilityFollowUpBatch?.currentEvidencePath === center.paths.executionFollowUpBatch &&
      center.nextCalls.executionFollowUpReceiptValidation?.tool === "validate_all_software_execution_follow_up_receipt" &&
      center.nextCalls.executionFollowUpReceiptValidation?.currentBuilderPath === center.paths.executionFollowUpReceiptBuilder &&
      center.nextCalls.controlChannelRepairReceiptValidation?.tool === "validate_all_software_control_channel_repair_receipt" &&
      center.nextCalls.controlChannelRepairReceiptValidation?.currentBuilderPath === center.paths.controlChannelRepairReceiptBuilder &&
      center.nextCalls.coverageRolloutReceiptValidation?.tool === "validate_all_software_coverage_rollout_receipt" &&
      center.nextCalls.coverageRolloutReceiptValidation?.currentBuilderPath === center.paths.coverageRolloutReceiptBuilder &&
      center.nextCalls.coverageEnrollmentFollowUpReceiptValidation?.tool ===
        "validate_all_software_coverage_enrollment_follow_up_receipt" &&
      center.nextCalls.coverageEnrollmentFollowUpReceiptValidation?.currentBuilderPath ===
        center.paths.coverageEnrollmentFollowUpReceiptBuilder &&
      center.nextCalls.coverageEnrollmentFollowUpReceiptValidation?.arguments?.plan ===
        center.paths.coverageEnrollmentFollowUpPlan &&
      center.nextCalls.coverageEnrollmentFollowUpReceiptValidation?.arguments?.receipt ===
        "<teacher-filled-coverage-enrollment-follow-up-receipt.json>" &&
      center.nextCalls.teacherReviewCockpit?.tool === "create_goal_teacher_review_cockpit" &&
      center.nextCalls.teacherReviewCockpit?.currentEvidencePath === center.paths.teacherReviewCockpit &&
      center.nextCalls.teacherReviewCockpitReceiptValidation?.tool === "validate_goal_teacher_review_cockpit_receipt" &&
      center.nextCalls.teacherReviewCockpitReceiptValidation?.currentCockpitPath === center.paths.teacherReviewCockpit &&
      center.nextCalls.visualGroundedConfirmNumberedTarget?.tool === "confirm_engineering_command_target" &&
      center.nextCalls.actionRehearsal?.tool === "start_teach_execute_action_rehearsal" &&
      center.nextCalls.supervisedExecutionGate?.tool === "start_teach_execute_supervised_execution"
  },
  {
    name: "Command center prefers execution follow-up probe packages for control-channel repair review",
    pass:
      controlChannelRepairBuilder.paths.sourceFollowUpBatch === fixtureExecutionFollowUpBatchPath &&
      controlChannelRepairBuilder.paths.derivedRepairQueue &&
      controlChannelRepairBuilder.counts?.totalRows === 1 &&
      controlChannelDerivedRepairQueue.sourceFollowUpBatch === fixtureExecutionFollowUpBatchPath &&
      controlChannelDerivedRepairQueue.counts?.totalFollowUpRows === 2 &&
      controlChannelDerivedRepairQueue.counts?.derivedProbeRows === 1 &&
      center.nextCalls.controlChannelRepairReceiptValidation?.arguments?.repairQueue ===
        controlChannelRepairBuilder.paths.derivedRepairQueue,
    evidence: controlChannelRepairBuilder.paths.derivedRepairQueue
  },
  {
    name: "Command center grounds voice/text numbered confirmation on one reviewed visual evidence file when supplied",
    pass:
      (center.paths.voiceWorkbenchVisualEvidence === fixtureVisualEvidencePath ||
        center.paths.voiceWorkbenchVisualEvidence.endsWith("fixture-reviewed-engineering-window.svg")) &&
      Boolean(center.paths.voiceWorkbenchVisualTargetConfirmation) &&
      Boolean(center.paths.voiceWorkbenchVisualTargetConfirmationHtml) &&
      Boolean(center.paths.voiceWorkbenchVisualOverlayPacket) &&
      center.entryLinks.some((link) => link.id === "visual_grounded_voice_control_workbench") &&
      center.stages.some((stage) => stage.id === "visual_evidence_voice_text_numbered_target_confirmation" && stage.status === "ready_for_teacher_review") &&
      Boolean(voiceWorkbenchState.generated?.visualTargetConfirmation) &&
      Boolean(voiceWorkbenchState.generated?.visualEvidencePath) &&
      Boolean(mcpVoiceWorkbenchState.generated?.visualTargetConfirmation),
    evidence: center.paths.voiceWorkbenchVisualTargetConfirmation
  },
  {
    name: "Command center exposes package-local links that open through the static preview server",
    pass:
      Array.isArray(center.entryLinks) &&
      center.entryLinks.length >= 7 &&
      center.entryLinks.some((link) => link.id === "teacher_review_cockpit") &&
      center.entryLinks.some((link) => link.id === "current_operational_status") &&
      center.entryLinks.some((link) => link.id === "original_goal_readiness_audit") &&
      center.entryLinks.some((link) => link.id === "activation_receipt_builder") &&
      center.entryLinks.some((link) => link.id === "original_goal_gap_action_board") &&
      center.entryLinks.some((link) => link.id === "coverage_rollout_receipt_builder") &&
      center.entryLinks.some((link) => link.id === "coverage_enrollment_ledger") &&
      center.entryLinks.some((link) => link.id === "coverage_enrollment_follow_up_plan") &&
      center.entryLinks.some((link) => link.id === "coverage_enrollment_follow_up_receipt_builder") &&
      center.entryLinks.some((link) => link.id === "execution_capability_follow_up_batch") &&
      center.entryLinks.some((link) => link.id === "execution_follow_up_receipt_builder") &&
      center.entryLinks.some((link) => link.id === "control_channel_repair_receipt_builder") &&
      center.entryLinks.every((link) => link.path && packageLinkExists(link)) &&
      center.stages.every((stage) => stage.openPath && packageLinkExists({ url: stage.openUrl })) &&
      htmlText.includes("Open package artifacts") &&
      htmlText.includes("Copy path") &&
      htmlText.includes("Primary artifact")
  },
  {
    name: "Command center creates a unified teacher review cockpit for current gates",
    pass:
      center.paths.teacherReviewCockpit &&
      center.paths.teacherReviewCockpitHtml &&
      center.stages.some(
        (stage) =>
          stage.id === "teacher_review_cockpit" &&
          stage.existingTool === "create_goal_teacher_review_cockpit" &&
          stage.status === "ready_for_teacher_review"
      ) &&
      readJson(center.paths.teacherReviewCockpit).reviewItems.some((item) => item.id === "coverage_rollout_receipt") &&
      readJson(center.paths.teacherReviewCockpit).reviewItems.some((item) => item.id === "coverage_enrollment_follow_up") &&
      readJson(center.paths.teacherReviewCockpit).nextValidationCommand.includes("validate-goal-teacher-review-cockpit-receipt.mjs") &&
      readJson(center.paths.teacherReviewCockpit).locks.cockpitDoesNotRunCommands === true,
    evidence: center.paths.teacherReviewCockpit
  },
  {
    name: "Command center exposes coverage enrollment follow-up as teacher-reviewed receipt validation",
    pass:
      readJson(center.paths.coverageEnrollmentLedger).format === "transparent_ai_all_software_coverage_enrollment_ledger_v1" &&
      readJson(center.paths.coverageEnrollmentFollowUpPlan).format ===
        "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1" &&
      readJson(center.paths.coverageEnrollmentFollowUpBatch).format ===
        "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1" &&
      readJson(center.paths.coverageEnrollmentFollowUpReconciliation).format ===
        "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_v1" &&
      existsSync(center.paths.coverageEnrollmentFollowUpReceiptBuilder) &&
      existsSync(center.paths.coverageEnrollmentFollowUpReceiptBuilderHtml) &&
      existsSync(center.paths.coverageEnrollmentFollowUpReceiptTemplate) &&
      readJson(center.paths.coverageEnrollmentFollowUpReceiptBuilder).locks.builderDoesNotRunBatch === true &&
      center.stages.some(
        (stage) =>
          stage.id === "coverage_enrollment_follow_up_receipt_builder" &&
          stage.status === "ready_for_teacher_review" &&
          stage.existingTool === "create_all_software_coverage_enrollment_follow_up_receipt_builder"
      ) &&
      center.nextCalls.coverageEnrollmentFollowUpReceiptValidation?.blockedUntil?.includes("--teacher-reviewed enrollment batch") &&
      htmlText.includes("Coverage enrollment follow-up receipt builder") &&
      mcpCenter.nextCalls.coverageEnrollmentFollowUpReceiptValidation?.tool ===
        "validate_all_software_coverage_enrollment_follow_up_receipt",
    evidence: center.paths.coverageEnrollmentFollowUpReceiptBuilder
  },
  {
    name: "Command center auto-discovers current operational status before historical status",
    pass:
      Boolean(autoDiscoveryCenter.paths.operationalStatusConsole) &&
      readJson(autoDiscoveryCenter.paths.operationalStatusConsole).status === "auto_current_status_console_fixture" &&
      readJson(autoDiscoveryCenter.paths.operationalStatusConsole).lanes.some((lane) => lane.id === "current_status_marker"),
    evidence: autoDiscoveryCenter.paths.operationalStatusConsole
  },
  {
    name: "Command center keeps execution, screenshots, memory, acceptance, and packaging locked",
    pass:
      center.locks.commandCenterDoesNotExecuteSoftware === true &&
      center.locks.softwareActionsExecuted === false &&
      center.locks.targetSoftwareCommandsExecuted === false &&
      center.locks.uiEventsSent === false &&
      center.locks.screenshotsCaptured === false &&
      center.locks.memoryWritten === false &&
      center.locks.nativeUniversalExecution === false &&
      center.locks.engineeringVoiceExecutionApprovalGateRequired === true &&
      center.locks.accepted === false &&
      center.locks.packagingGated === true
  },
  {
    name: "Receipt template blocks acceptance, unattended execution, memory, native universal execution, and packaging unlock",
    pass:
      receipt.format === "transparent_ai_goal_command_center_receipt_template_v1" &&
      receipt.defaultDecision === "needs_teacher_review" &&
      receipt.blockedDecisions.includes("accepted") &&
      receipt.blockedDecisions.includes("execute_unattended") &&
      receipt.blockedDecisions.includes("execute_without_engineering_voice_execution_approval_gate") &&
      receipt.blockedDecisions.includes("enable_memory") &&
      receipt.blockedDecisions.includes("native_universal_execution") &&
      receipt.blockedDecisions.includes("unlock_packaging")
  },
  {
    name: "MCP advanced tool exposes the same command center",
    pass:
      mcp.status === "created" &&
      mcpCenter.format === "transparent_ai_goal_command_center_v1" &&
      mcpCenter.locks.commandCenterDoesNotExecuteSoftware === true
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(JSON.stringify({ status: "failed", smoke: "transparent_ai_goal_command_center_smoke_v1", failed, direct, mcp }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      smoke: "transparent_ai_goal_command_center_smoke_v1",
      smokeRoot,
      direct,
      mcp,
      checks
    },
    null,
    2
  )
);
