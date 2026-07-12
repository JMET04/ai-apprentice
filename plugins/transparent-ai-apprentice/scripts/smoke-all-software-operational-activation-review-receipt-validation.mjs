#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function runScript(args, options = {}) {
  const result = spawnSync(process.execPath, [join(__dirname, "validate-all-software-operational-activation-review-receipt.mjs"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error("activation receipt validation was expected to fail");
    if (!result.stdout) throw new Error(result.stderr || "activation receipt validation failed without JSON output");
    return {
      ...JSON.parse(result.stdout),
      failedAsExpected: true,
      exitStatus: result.status
    };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "activation receipt validation script failed");
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
    : join(process.cwd(), ".transparent-apprentice", "all-software-operational-activation-review-receipt-validation-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const operationalScope = {
  scopeKind: "teacher_reviewed_operational_low_token_monitor_scope",
  sourceTrialPath: "D:\\example\\trial.json",
  sourceSchedulePath: "D:\\example\\schedule.json",
  sourceReadinessPackage: "D:\\example\\readiness.json",
  sourceRunOutputAudit: "D:\\example\\run-output-audit.json",
  sourceUnattendedAudit: "D:\\example\\unattended-audit.json",
  sourceReviewedRunCount: 1,
  sourceTrialStatus: "operational_trial_ready_for_review",
  teacherReviewedScope: true,
  scopeConfirmationPhrase: "teacher_reviewed_monitor_scope",
  rollbackPointCreated: true,
  requiresTeacherReviewedScope: false
};

const packetPath = writeJson(join(smokeRoot, "packet", "all-software-operational-activation-review-packet.json"), {
  format: "transparent_ai_all_software_operational_activation_review_packet_v1",
  status: "waiting_for_teacher_activation_confirmations",
  operationalScope,
  lowTokenSourceRouteEvidence: {
    ledgerReady: true,
    reviewOnly: true,
    logContentsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    sourceLogSourceDiscoveryLedger: "D:\\example\\trial\\log-source-discovery-ledger.json",
    sourceLogSourceDiscoveryLedgerReadme: "D:\\example\\trial\\LOG_SOURCE_DISCOVERY_LEDGER_START_HERE.md",
    counts: {
      logSourceDiscoveryRows: 3,
      logSourceDiscoveryMissingRows: 0
    }
  },
  confirmationRows: [
    {
      id: "recurring_monitor_teacher_confirmation",
      current: "missing",
      requiredPhrase: "teacher_confirmed_recurring_low_token_monitor_review"
    },
    {
      id: "reviewed_monitor_scope_confirmation",
      current: "missing",
      requiredPhrase: "teacher_reviewed_monitor_scope"
    },
    {
      id: "registration_review_confirmation",
      current: "missing",
      requiredPhrase: "teacher_confirmed_registration_dry_run_review_only"
    },
    {
      id: "low_token_source_route_ledger_reviewed",
      current: "ready_for_teacher_review",
      requiredPhrase: "teacher_reviewed_low_token_source_route_ledger"
    },
    {
      id: "rollback_point_retained",
      current: "confirmed",
      requiredPhrase: "rollback_point_created_and_retained"
    }
  ],
  blockedActions: [
    "register_scheduled_task_from_review_packet",
    "execute_target_software_from_review_packet",
    "claim_goal_complete_from_review_packet"
  ],
  paths: {
    sourceActivationGate: "D:\\example\\activation-gate.json",
    sourceTrial: "D:\\example\\trial.json",
    sourceLogSourceDiscoveryLedger: "D:\\example\\trial\\log-source-discovery-ledger.json",
    sourceLogSourceDiscoveryLedgerReadme: "D:\\example\\trial\\LOG_SOURCE_DISCOVERY_LEDGER_START_HERE.md"
  },
  locks: {
    packetDoesNotRegisterTask: true,
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false
  }
});

const partialReceiptPath = writeJson(join(smokeRoot, "receipts", "partial.json"), {
  format: "transparent_ai_all_software_operational_activation_review_receipt_template_v1",
  decision: "ready_to_rerun_activation_gate",
  operationalScope,
  confirmationRows: [
    {
      id: "recurring_monitor_teacher_confirmation",
      teacherDecision: "confirmed",
      teacherObservedEvidence: "teacher_confirmed_recurring_low_token_monitor_review"
    },
    {
      id: "reviewed_monitor_scope_confirmation",
      teacherDecision: "needs_teacher_review",
      teacherObservedEvidence: ""
    },
    {
      id: "registration_review_confirmation",
      teacherDecision: "needs_teacher_review",
      teacherObservedEvidence: ""
    },
    {
      id: "low_token_source_route_ledger_reviewed",
      teacherDecision: "needs_teacher_review",
      teacherObservedEvidence: ""
    }
  ]
});

const readyReceiptPath = writeJson(join(smokeRoot, "receipts", "ready.json"), {
  format: "transparent_ai_all_software_operational_activation_review_receipt_template_v1",
  decision: "ready_to_rerun_activation_gate",
  operationalScope,
  confirmationRows: [
    {
      id: "recurring_monitor_teacher_confirmation",
      teacherDecision: "confirmed",
      teacherObservedEvidence: "teacher_confirmed_recurring_low_token_monitor_review"
    },
    {
      id: "reviewed_monitor_scope_confirmation",
      teacherDecision: "confirmed",
      teacherObservedEvidence: "teacher_reviewed_monitor_scope"
    },
    {
      id: "registration_review_confirmation",
      teacherDecision: "confirmed",
      teacherObservedEvidence: "teacher_confirmed_registration_dry_run_review_only"
    },
    {
      id: "low_token_source_route_ledger_reviewed",
      teacherDecision: "confirmed",
      teacherObservedEvidence: "teacher_reviewed_low_token_source_route_ledger"
    },
    {
      id: "rollback_point_retained",
      teacherDecision: "already_confirmed",
      teacherObservedEvidence: "rollback_point_created_and_retained"
    }
  ]
});

const forbiddenReceiptPath = writeJson(join(smokeRoot, "receipts", "forbidden.json"), {
  format: "transparent_ai_all_software_operational_activation_review_receipt_template_v1",
  decision: "accepted",
  operationalScope,
  confirmationRows: [
    {
      id: "recurring_monitor_teacher_confirmation",
      teacherDecision: "confirmed",
      teacherObservedEvidence: "teacher_confirmed_recurring_low_token_monitor_review"
    },
    {
      id: "reviewed_monitor_scope_confirmation",
      teacherDecision: "confirmed",
      teacherObservedEvidence: "teacher_reviewed_monitor_scope"
    },
    {
      id: "registration_review_confirmation",
      teacherDecision: "confirmed",
      teacherObservedEvidence: "teacher_confirmed_registration_dry_run_review_only"
    },
    {
      id: "low_token_source_route_ledger_reviewed",
      teacherDecision: "confirmed",
      teacherObservedEvidence: "teacher_reviewed_low_token_source_route_ledger"
    }
  ]
});

const partial = runScript([
  "--goal",
  "smoke partial activation receipt validation",
  "--review-packet",
  packetPath,
  "--receipt",
  partialReceiptPath,
  "--output-dir",
  join(smokeRoot, "partial-output")
]);
const partialReplay = readJson(partial.validationPath);
const partialReadme = readFileSync(partial.readmePath, "utf8");

const ready = runScript([
  "--goal",
  "smoke ready activation receipt validation",
  "--review-packet",
  packetPath,
  "--receipt",
  readyReceiptPath,
  "--output-dir",
  join(smokeRoot, "ready-output")
]);
const readyReplay = readJson(ready.validationPath);
const readyReceipt = readJson(ready.receiptPath);

const forbidden = runScript([
  "--goal",
  "smoke forbidden activation receipt validation",
  "--review-packet",
  packetPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-output")
], { expectFailure: true });
const forbiddenReplay = readJson(forbidden.validationPath);

const checks = [
  check(
    "Activation receipt validation preserves missing teacher confirmations",
    partialReplay.status === "receipt_validation_waiting_for_teacher_confirmation" &&
      partialReplay.validationDecision === "needs_teacher_review" &&
      partialReplay.readyToRerunActivationGate === false &&
      partialReplay.missingConfirmationCount === 3 &&
      partialReplay.validationRows.some((row) => row.id === "reviewed_monitor_scope_confirmation" && row.status === "missing_teacher_confirmation"),
    partial.validationPath
  ),
  check(
    "Activation receipt validation replays complete confirmations into one safe rerun command",
    readyReplay.status === "receipt_validated_ready_to_rerun_activation_gate" &&
      readyReplay.validationDecision === "ready_to_rerun_activation_gate_review_only" &&
      readyReplay.readyToRerunActivationGate === true &&
      readyReplay.nextSafeCommands[0].enabled === true &&
      readyReplay.operationalScopeVerified === true &&
      readyReplay.lowTokenSourceRouteEvidence?.sourceLogSourceDiscoveryLedger &&
      readyReplay.operationalScope?.sourceTrialPath === operationalScope.sourceTrialPath &&
      readyReplay.nextSafeCommands[0].command.includes("create-all-software-operational-learning-activation-gate.mjs") &&
      !readyReplay.nextSafeCommands[0].command.includes("-Execute"),
    ready.validationPath
  ),
  check(
    "Activation receipt validation keeps registration, execution, memory, and completion locks closed",
    readyReceipt.locks.validationDoesNotRegisterTask === true &&
      readyReceipt.locks.validationDoesNotExecuteWrapper === true &&
      readyReceipt.locks.scheduledTaskRegistered === false &&
      readyReceipt.locks.targetSoftwareCommandsExecuted === false &&
      readyReceipt.locks.longTermMemoryWritten === false &&
      readyReceipt.locks.goalComplete === false,
    ready.receiptPath
  ),
  check(
    "Activation receipt validation fails closed on forbidden acceptance or registration decisions",
    forbiddenReplay.validationDecision === "blocked_for_forbidden_decision" &&
      forbiddenReplay.readyToRerunActivationGate === false &&
      forbiddenReplay.forbiddenDecisionUsed === true &&
      forbiddenReplay.blockedTransitions.includes("register_scheduled_task_from_receipt_validation") &&
      forbidden.failedAsExpected === true &&
      forbidden.exitStatus !== 0,
    forbidden.validationPath
  ),
  check(
    "Activation receipt validation writes start-here replay guide",
    partialReadme.includes("Validation rows:") &&
      partialReadme.includes("Next safe commands:") &&
      partialReadme.includes("Blocked transitions:"),
    partial.readmePath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_all_software_operational_activation_review_receipt_validation_smoke_v1",
  smokeRoot,
  checks
};
console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
