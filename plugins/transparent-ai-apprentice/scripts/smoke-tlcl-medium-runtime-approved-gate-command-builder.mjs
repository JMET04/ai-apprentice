#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-medium-runtime-approved-gate-command-builder-smoke", String(Date.now()));
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

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const runnerPath = join(smokeRoot, "teacher-reviewed-tlcl-command-builder-target.mjs");
writeFileSync(
  runnerPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "writeFileSync(outputPath, JSON.stringify({ ok: true, proof: 'tlcl command builder route' }, null, 2) + '\\n', 'utf8');"
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
  targetOutputFileName: "tlcl-command-builder-output.json"
});

const adapterPackagePath = join(smokeRoot, "adapter-package.json");
writeJson(adapterPackagePath, {
  format: "transparent_ai_execution_adapter_package_v1",
  runnerEntries: [{ adapterId: "existing-cli-or-script", runnerPath }]
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
      pilotId: "tlcl-command-builder-pilot-001",
      software: "TLCL command builder reviewed CLI software",
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
  pilotId: "tlcl-command-builder-pilot-001",
  software: "TLCL command builder reviewed CLI software",
  routeMode: "existing-cli-or-script",
  primaryAdapterId: "existing-cli-or-script",
  adapterPackagePath,
  actionPlanPath,
  score: 200
};
writeJson(selectorPath, {
  ok: true,
  format: "transparent_ai_real_local_execution_pilot_selector_v1",
  selectorId: "tlcl-command-builder-selector",
  sourceEvidence: { executionPilotQueuePath: queuePath },
  numberedCandidates: [selectedCandidate],
  selectedCandidate,
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});

const readyValidationPath = join(smokeRoot, "ready-tlcl-post-run-validation.json");
writeJson(readyValidationPath, {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_validation_v1",
  validationId: "ready-tlcl-post-run-validation",
  status: "ready_for_execution_approval_gate_planning",
  decision: "dry_run_matched_expected",
  readyForExecutionApprovalGatePlanning: true,
  forbiddenDecisionUsed: false,
  blockers: [],
  executionApprovalGateCreated: false,
  targetSoftwareCommandsExecuted: false,
  executionApprovalGatePlanningHandoff: {
    kind: "execution_approval_gate_planning_handoff",
    executesNow: false,
    sourceRunId: "tlcl-command-builder-run",
    routeIndex: 1,
    handoffItemId: "tlcl-command-builder-handoff",
    reviewedCommandTemplate: "node teacher-reviewed-tlcl-command-builder-target.mjs <output>",
    requiredBeforeGate: ["teacher provides explicit execute approval text", "retained rollback point is confirmed again"],
    blockedUntil: "separate execution approval gate is created and reviewed"
  },
  locks: {
    reviewOnly: true,
    validationOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});

const readyPrep = runNode("run-tlcl-medium-runtime-execution-approval-gate-prep-runner.mjs", [
  "--validation",
  readyValidationPath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-pilot-id",
  "tlcl-command-builder-pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-confirmation",
  "teacher confirmed all-software execution pilot",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready-prep")
]);

const readyWrapper = runNode("create-tlcl-medium-runtime-approved-gate-command-builder.mjs", [
  "--goal",
  "Build a TLCL approved-gate command builder from ready prep.",
  "--prep",
  readyPrep.packetPath,
  "--output-dir",
  join(smokeRoot, "ready-wrapper")
]);
const readyWrapperPacket = readJson(readyWrapper.wrapperPath);
const readyReceipt = readJson(readyWrapper.receiptPath);
const existingBuilder = readJson(readyWrapper.existingBuilderPath);
const existingHtml = readFileSync(readyWrapper.existingBuilderHtmlPath, "utf8");

const blockedPrepPath = join(smokeRoot, "blocked-tlcl-prep.json");
writeJson(blockedPrepPath, {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_execution_approval_gate_prep_runner_v1",
  prepId: "blocked-prep",
  status: "blocked_before_execution_approval_gate",
  validationReady: false,
  approvalGateInvoked: false,
  readyForExecuteRequest: false,
  generatedEvidence: {
    approvalGatePath: ""
  },
  blockers: ["post_run_validation_not_ready_for_execution_approval_gate_planning"],
  locks: {
    reviewOnly: true,
    prepRunnerDoesNotInvokeExecutionRunner: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});
const blockedWrapper = runNode("create-tlcl-medium-runtime-approved-gate-command-builder.mjs", [
  "--goal",
  "Block TLCL approved-gate command builder from non-ready prep.",
  "--prep",
  blockedPrepPath,
  "--output-dir",
  join(smokeRoot, "blocked-wrapper")
]);
const blockedWrapperPacket = readJson(blockedWrapper.wrapperPath);

const checks = [
  {
    name: "Ready TLCL approval prep reuses the existing approved-gate command builder",
    pass:
      readyWrapper.status === "tlcl_approved_gate_command_builder_ready_for_teacher_final_confirmation" &&
      readyWrapper.existingCommandBuilderInvoked === true &&
      readyWrapper.existingCommandBuilderStatus === "approval_gate_command_builder_ready_for_teacher_final_confirmation" &&
      readyWrapper.commandTemplate.includes("run-all-software-execution-approved-gate-runner.mjs") &&
      readyWrapper.commandTemplate.includes("--execute-approved-gate") &&
      existsSync(readyWrapper.existingBuilderHtmlPath),
    evidence: readyWrapper.existingBuilderHtmlPath
  },
  {
    name: "TLCL approved-gate command builder preserves final teacher confirmation and rollback requirements",
    pass:
      existingBuilder.commandTemplate.includes("--teacher-confirmation") &&
      existingBuilder.commandTemplate.includes("<teacher-confirmed-approved-gate-runner-text>") &&
      existingBuilder.commandTemplate.includes("--rollback-point-created") &&
      existingBuilder.commandTemplate.includes("<retained-rollback-point-path-or-label>") &&
      existingHtml.includes("transparent_ai_execution_approved_gate_run_request_v1"),
    evidence: existingBuilder.commandTemplate
  },
  {
    name: "Non-ready TLCL approval prep is blocked before command-builder reuse",
    pass:
      blockedWrapper.status === "blocked_before_tlcl_approved_gate_command_builder" &&
      blockedWrapper.existingCommandBuilderInvoked === false &&
      blockedWrapperPacket.blockers.includes("tlcl_prep_status_not_ready_for_teacher_execute_review") &&
      blockedWrapperPacket.blockers.includes("approval_gate_path_missing"),
    evidence: blockedWrapperPacket.blockers.join(",")
  },
  {
    name: "TLCL approved-gate command builder keeps execution memory rule packaging and completion locks",
    pass:
      readyWrapperPacket.locks.reviewOnly === true &&
      readyWrapperPacket.locks.wrapperDoesNotRunApprovedGate === true &&
      readyWrapperPacket.locks.wrapperDoesNotInvokeRunner === true &&
      readyWrapperPacket.locks.wrapperDoesNotExecuteTargetSoftware === true &&
      readyWrapperPacket.locks.wrapperDoesNotSendUiEvents === true &&
      readyWrapperPacket.locks.wrapperDoesNotCaptureScreenshots === true &&
      readyWrapperPacket.locks.wrapperDoesNotWriteMemory === true &&
      readyWrapperPacket.locks.generatedCommandRequiresTeacherConfirmation === true &&
      readyWrapperPacket.locks.generatedCommandRequiresRollback === true &&
      readyReceipt.targetSoftwareCommandsExecutedByWrapper === false &&
      readyReceipt.memoryWritten === false &&
      readyReceipt.ruleEnabled === false &&
      readyReceipt.packagingGated === true &&
      readyReceipt.goalComplete === false,
    evidence: JSON.stringify(readyWrapperPacket.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_approved_gate_command_builder_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  readyPrepPath: readyPrep.packetPath,
  readyWrapperPath: readyWrapper.wrapperPath,
  existingBuilderPath: readyWrapper.existingBuilderPath,
  blockedWrapperPath: blockedWrapper.wrapperPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
