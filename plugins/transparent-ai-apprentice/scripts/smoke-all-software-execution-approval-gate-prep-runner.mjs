#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-execution-approval-gate-prep-runner-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const runnerPath = join(smokeRoot, "teacher-reviewed-prep-runner-target.mjs");
writeFileSync(
  runnerPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "writeFileSync(outputPath, JSON.stringify({ ok: true, proof: 'prep runner reviewed command' }, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);

const reviewedCommandPath = join(smokeRoot, "reviewed-command-manifest.json");
writeJson(reviewedCommandPath, {
  format: "transparent_ai_reviewed_cli_command_manifest_v1",
  teacherReviewed: true,
  commandKind: "node-script",
  scriptSourceFile: runnerPath,
  expectedScriptSha256: sha256(runnerPath),
  targetOutputFileName: "prep-runner-controlled-output.json"
});

const adapterPackagePath = join(smokeRoot, "adapter-package.json");
writeJson(adapterPackagePath, {
  format: "transparent_ai_execution_adapter_package_v1",
  runnerEntries: [
    {
      adapterId: "existing-cli-or-script",
      runnerPath
    }
  ]
});

const actionPlanPath = join(smokeRoot, "action-plan.json");
writeJson(actionPlanPath, {
  format: "transparent_ai_execution_action_plan_v1",
  teacherReviewed: true,
  routeMode: "existing-cli-or-script"
});

const queuePath = join(smokeRoot, "execution-pilot-queue.json");
writeJson(queuePath, {
  format: "transparent_ai_all_software_execution_pilot_queue_v1",
  pilots: [
    {
      pilotId: "smoke-cli-pilot-001",
      software: "Smoke reviewed CLI software",
      routeMode: "existing-cli-or-script",
      primaryAdapterId: "existing-cli-or-script",
      adapterPackagePath,
      actionPlanPath,
      status: "dry_run_runner_ready_for_teacher_review"
    }
  ]
});

const selectorPath = join(smokeRoot, "real-local-execution-pilot-selector.json");
const selectedCandidate = {
  number: 1,
  pilotId: "smoke-cli-pilot-001",
  software: "Smoke reviewed CLI software",
  routeMode: "existing-cli-or-script",
  primaryAdapterId: "existing-cli-or-script",
  adapterPackagePath,
  actionPlanPath,
  score: 200
};
writeJson(selectorPath, {
  ok: true,
  format: "transparent_ai_real_local_execution_pilot_selector_v1",
  selectorId: "smoke-selector",
  sourceEvidence: {
    executionPilotQueuePath: queuePath
  },
  numberedCandidates: [selectedCandidate],
  selectedCandidate,
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});

const readyValidationPath = join(smokeRoot, "ready-validation.json");
writeJson(readyValidationPath, {
  ok: true,
  format: "transparent_ai_all_software_execution_follow_up_handoff_item_receipt_validation_v1",
  validationId: "ready-validation",
  status: "validated_ready_for_next_gate_review",
  validationDecision: "ready_for_execution_approval_gate_planning",
  selected: {
    rowId: "row-001",
    pilotId: "smoke-cli-pilot-001",
    adapterId: "existing-cli-or-script",
    software: "Smoke reviewed CLI software"
  },
  reviewRow: {
    status: "ready_for_execution_approval_gate_planning",
    allEvidenceReviewed: true,
    dryRunEvidencePresent: true,
    reason: "teacher reviewed all dry-run evidence"
  },
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});

const waitingValidationPath = join(smokeRoot, "waiting-validation.json");
writeJson(waitingValidationPath, {
  ok: true,
  format: "transparent_ai_all_software_execution_follow_up_handoff_item_receipt_validation_v1",
  validationId: "waiting-validation",
  status: "waiting_for_teacher_review",
  validationDecision: "needs_teacher_review",
  selected: {
    rowId: "row-002",
    pilotId: "smoke-cli-pilot-001",
    adapterId: "existing-cli-or-script",
    software: "Smoke reviewed CLI software"
  },
  reviewRow: {
    status: "needs_teacher_review",
    allEvidenceReviewed: false,
    dryRunEvidencePresent: true,
    reason: "teacher did not mark matched"
  },
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});

const ready = runNode("run-all-software-execution-approval-gate-prep-runner.mjs", [
  "--validation",
  readyValidationPath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-pilot-id",
  "smoke-cli-pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-confirmation",
  "teacher confirmed all-software execution pilot",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready")
]);
const readyPacket = readJson(ready.packetPath);
const readyReceipt = readJson(ready.receiptPath);
const readyGatePacket = readJson(ready.approvalGatePath);

const nonReady = runNode("run-all-software-execution-approval-gate-prep-runner.mjs", [
  "--validation",
  waitingValidationPath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-pilot-id",
  "smoke-cli-pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-confirmation",
  "teacher confirmed all-software execution pilot",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "non-ready")
]);
const nonReadyPacket = readJson(nonReady.packetPath);

const missingRoute = runNode("run-all-software-execution-approval-gate-prep-runner.mjs", [
  "--validation",
  readyValidationPath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-pilot-id",
  "smoke-cli-pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--teacher-confirmation",
  "teacher confirmed all-software execution pilot",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "missing-route")
]);
const missingRoutePacket = readJson(missingRoute.packetPath);

const placeholder = runNode("run-all-software-execution-approval-gate-prep-runner.mjs", [
  "--validation",
  readyValidationPath,
  "--selector",
  "<real-local-execution-pilot-selector.json>",
  "--queue",
  queuePath,
  "--selected-pilot-id",
  "smoke-cli-pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-confirmation",
  "teacher confirmed all-software execution pilot",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "placeholder")
]);
const placeholderPacket = readJson(placeholder.packetPath);

const checks = [
  {
    name: "Ready dry-run validation prepares an approval gate without executing the runner",
    pass:
      ready.status === "approval_gate_prepared_waiting_for_teacher_execute_review" &&
      ready.approvalGateInvoked === true &&
      ready.readyForExecuteRequest === true &&
      readyGatePacket.generatedRunnerRequest?.args?.includes("--execute") &&
      readyReceipt.prepRunnerDoesNotInvokeExecutionRunner === true &&
      readyReceipt.targetSoftwareCommandsExecuted === false &&
      readyReceipt.uiEventsSent === false,
    evidence: ready.approvalGatePath
  },
  {
    name: "Non-ready validation is blocked before approval gate",
    pass:
      nonReady.status === "blocked_before_approval_gate" &&
      nonReady.approvalGateInvoked === false &&
      nonReadyPacket.blockers.includes("validation_not_ready_for_execution_approval_gate_planning"),
    evidence: nonReadyPacket.blockers.join(",")
  },
  {
    name: "Missing route evidence is blocked before approval gate",
    pass:
      missingRoute.status === "blocked_before_approval_gate" &&
      missingRoute.approvalGateInvoked === false &&
      missingRoutePacket.blockers.includes("missing_reviewed_command_manifest"),
    evidence: missingRoutePacket.blockers.join(",")
  },
  {
    name: "Unresolved placeholders are blocked before approval gate",
    pass:
      placeholder.status === "blocked_before_approval_gate" &&
      placeholder.approvalGateInvoked === false &&
      placeholderPacket.blockers.includes("missing_or_placeholder_real_local_execution_pilot_selector"),
    evidence: placeholderPacket.blockers.join(",")
  },
  {
    name: "Prep runner locks screenshots memory rules packaging and universal completion",
    pass:
      readyPacket.locks.reviewOnly === true &&
      readyPacket.locks.accepted === false &&
      readyPacket.locks.ruleEnabled === false &&
      readyPacket.locks.packagingGated === true &&
      readyPacket.locks.prepRunnerDoesNotInvokeExecutionRunner === true &&
      readyPacket.locks.prepRunnerDoesNotExecuteTargetSoftware === true &&
      readyPacket.locks.screenshotsCaptured === false &&
      readyPacket.locks.memoryWritten === false &&
      readyPacket.locks.nativeUniversalExecution === false &&
      readyPacket.locks.allSoftwareExecutionComplete === false &&
      readyPacket.locks.goalComplete === false,
    evidence: JSON.stringify(readyPacket.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_all_software_execution_approval_gate_prep_runner_smoke_v1",
  passed,
  total: checks.length,
  readyPacketPath: ready.packetPath,
  readyApprovalGatePath: ready.approvalGatePath,
  nonReadyPacketPath: nonReady.packetPath,
  missingRoutePacketPath: missingRoute.packetPath,
  placeholderPacketPath: placeholder.packetPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
