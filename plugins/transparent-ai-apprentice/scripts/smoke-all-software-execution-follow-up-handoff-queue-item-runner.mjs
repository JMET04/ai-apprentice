#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "execution-follow-up-handoff-queue-item-runner-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) {
    throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

function writeValidationReadme(name) {
  const path = join(smokeRoot, `${name}-EXECUTION_VALIDATION_START_HERE.md`);
  writeFileSync(path, `# ${name} execution validation\n`, "utf8");
  return path;
}

function validationFixture(overrides = {}) {
  return {
    ok: true,
    format: "transparent_ai_all_software_execution_follow_up_receipt_validation_v1",
    validationId: "smoke-execution-validation",
    status: "validated_with_ready_dry_run_review_rows",
    validationDecision: "some_rows_ready_for_dry_run_runner_review",
    readyRowCount: 1,
    waitingRowCount: 0,
    nextDryRunReviewCommands: [],
    paths: {
      validation: "D:\\example\\validation.json",
      readme: writeValidationReadme(overrides.name || "safe"),
      sourceBatch: "D:\\example\\execution-follow-up-batch.json"
    },
    locks: {
      reviewOnly: true,
      validationDoesNotInvokeRunner: true,
      dryRunRunnerInvoked: false,
      screenshotsCaptured: false,
      targetSoftwareCommandsExecuted: false,
      nativeUniversalExecution: false,
      goalComplete: false
    },
    ...overrides
  };
}

const goal = "Smoke one execution follow-up handoff queue item through the dry-run pilot runner.";
const profilePath = join(smokeRoot, "node-local-cli-control-profile.json");
writeJson(profilePath, {
  format: "transparent_ai_software_control_channel_profile_v1",
  software: "Node.js local dry-run route proof",
  reviewedControlRoutes: [
    {
      kind: "cli",
      route: "teacher-reviewed node-script command",
      evidence: "Local Node runtime is used only as an existing CLI/script route for this dry-run proof."
    }
  ],
  locks: { accepted: false, ruleEnabled: false, packagingGated: true, nativeUniversalExecution: false }
});

const coveragePath = writeJson(join(smokeRoot, "control-channel-coverage-audit.json"), {
  ok: true,
  format: "transparent_ai_all_software_control_channel_coverage_audit_v1",
  goal,
  rows: [
    {
      rowId: "row-001",
      software: "Node.js local dry-run route proof",
      processName: "node.exe",
      windowTitle: "",
      status: "structured_control_route_reviewable",
      recommendedAdapters: ["existing-cli-or-script"],
      profilePath
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false
  }
});

const pilotQueue = runNode("create-all-software-execution-pilot-queue.mjs", [
  "--goal",
  goal,
  "--coverage-audit",
  coveragePath,
  "--max-pilots",
  "1",
  "--create-adapter-packages",
  "--output-dir",
  join(smokeRoot, "execution-pilot-queue")
]);

const safeValidationPath = writeJson(
  join(smokeRoot, "safe-validation.json"),
  validationFixture({
    name: "safe",
    nextDryRunReviewCommands: [
      {
        rowId: "row-001",
        tool: "run_all_software_execution_pilot_runner",
        arguments: {
          queue: pilotQueue.queuePath,
          pilotId: "pilot-001",
          adapterId: "existing-cli-or-script",
          execute: false,
          maxItems: 1,
          maxLogsPerItem: 1
        },
        executesNow: false,
        blockedUntil: "teacher explicitly runs a separate dry-run-only runner review command"
      }
    ]
  })
);
const safeQueue = runNode("create-all-software-execution-follow-up-handoff-queue.mjs", [
  "--goal",
  goal,
  "--validation",
  safeValidationPath,
  "--output-dir",
  join(smokeRoot, "safe-handoff-queue")
]);
const safeRun = runNode("run-all-software-execution-follow-up-handoff-queue-item.mjs", [
  "--queue",
  safeQueue.queuePath,
  "--row-id",
  "row-001",
  "--output-dir",
  join(smokeRoot, "safe-item-run")
]);
const safePacket = readJson(safeRun.runPath);
const safeReceipt = readJson(safeRun.receiptPath);
const pilotRunnerReceipt = readJson(safeRun.pilotRunnerReceiptPath);

const unsafeValidationPath = writeJson(
  join(smokeRoot, "unsafe-validation.json"),
  validationFixture({
    name: "unsafe",
    nextDryRunReviewCommands: [
      {
        rowId: "row-unsafe",
        tool: "run_all_software_execution_pilot_runner",
        arguments: {
          queue: pilotQueue.queuePath,
          pilotId: "pilot-001",
          execute: true
        },
        executesNow: false
      }
    ]
  })
);
const unsafeQueue = runNode("create-all-software-execution-follow-up-handoff-queue.mjs", [
  "--validation",
  unsafeValidationPath,
  "--output-dir",
  join(smokeRoot, "unsafe-handoff-queue")
]);
const unsafeRun = runNode("run-all-software-execution-follow-up-handoff-queue-item.mjs", [
  "--queue",
  unsafeQueue.queuePath,
  "--row-id",
  "row-unsafe",
  "--output-dir",
  join(smokeRoot, "unsafe-item-run")
]);

const placeholderValidationPath = writeJson(
  join(smokeRoot, "placeholder-validation.json"),
  validationFixture({
    name: "placeholder",
    nextDryRunReviewCommands: [
      {
        rowId: "row-placeholder",
        tool: "run_all_software_execution_pilot_runner",
        arguments: {
          queue: "<teacher-reviewed-execution-pilot-queue.json>",
          pilotId: "pilot-001",
          execute: false
        },
        executesNow: false
      }
    ]
  })
);
const placeholderQueue = runNode("create-all-software-execution-follow-up-handoff-queue.mjs", [
  "--validation",
  placeholderValidationPath,
  "--output-dir",
  join(smokeRoot, "placeholder-handoff-queue")
]);
const placeholderRun = runNode("run-all-software-execution-follow-up-handoff-queue-item.mjs", [
  "--queue",
  placeholderQueue.queuePath,
  "--row-id",
  "row-placeholder",
  "--output-dir",
  join(smokeRoot, "placeholder-item-run")
]);

const nonRunnerRun = runNode("run-all-software-execution-follow-up-handoff-queue-item.mjs", [
  "--queue",
  safeQueue.queuePath,
  "--item-number",
  "1",
  "--output-dir",
  join(smokeRoot, "non-runner-item-run")
]);

const missingRun = runNode("run-all-software-execution-follow-up-handoff-queue-item.mjs", [
  "--queue",
  safeQueue.queuePath,
  "--row-id",
  "row-missing",
  "--output-dir",
  join(smokeRoot, "missing-item-run")
]);

const checks = [
  check(
    "Handoff queue item runner consumes one ready dry-run runner item and invokes the existing pilot runner",
    safePacket.format === "transparent_ai_all_software_execution_follow_up_handoff_queue_item_run_v1" &&
      safePacket.status === "dry_run_pilot_runner_completed_waiting_for_teacher_review" &&
      safePacket.runnerInvoked === true &&
      safePacket.executeRequested === false &&
      safePacket.selectedItem.rowId === "row-001" &&
      safePacket.generatedEvidence.pilotRunnerRunPath === safeRun.pilotRunnerRunPath,
    safeRun.runPath
  ),
  check(
    "Handoff queue item runner stays dry-run and produces pilot runner review evidence",
    existsSync(safeRun.pilotRunnerRunPath) &&
      existsSync(safeRun.pilotRunnerReceiptPath) &&
      pilotRunnerReceipt.format === "transparent_ai_all_software_execution_pilot_runner_receipt_v1" &&
      pilotRunnerReceipt.nativeUniversalExecution === false &&
      pilotRunnerReceipt.allSoftwareExecutionComplete === false,
    safeRun.pilotRunnerReceiptPath
  ),
  check(
    "Handoff queue item runner keeps target software, screenshots, memory, acceptance, rules, packaging, and completion locked",
    safeReceipt.runnerInvoked === true &&
      safeReceipt.dryRunOnly === true &&
      safeReceipt.executeRequested === false &&
      safeReceipt.targetSoftwareCommandsExecuted === false &&
      safeReceipt.screenshotsCaptured === false &&
      safeReceipt.memoryWritten === false &&
      safeReceipt.accepted === false &&
      safeReceipt.ruleEnabled === false &&
      safeReceipt.packagingGated === true &&
      safeReceipt.nativeUniversalExecution === false &&
      safeReceipt.goalComplete === false &&
      safeReceipt.locks.queueItemRunnerDoesNotPassExecuteFlag === true,
    JSON.stringify(safeReceipt.locks)
  ),
  check(
    "Handoff queue item runner blocks unsafe execute handoffs before invoking the pilot runner",
    unsafeRun.status === "blocked_before_pilot_runner" && unsafeRun.runnerInvoked === false,
    unsafeRun.receiptPath
  ),
  check(
    "Handoff queue item runner blocks unresolved placeholders before invoking the pilot runner",
    placeholderRun.status === "blocked_before_pilot_runner" && placeholderRun.runnerInvoked === false,
    placeholderRun.receiptPath
  ),
  check(
    "Handoff queue item runner blocks non-runner review items and missing selections",
    nonRunnerRun.status === "blocked_before_pilot_runner" &&
      nonRunnerRun.runnerInvoked === false &&
      missingRun.status === "blocked_before_pilot_runner" &&
      missingRun.runnerInvoked === false,
    `${nonRunnerRun.receiptPath}; ${missingRun.receiptPath}`
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_all_software_execution_follow_up_handoff_queue_item_runner_smoke_v1",
  smokeRoot,
  passed,
  total: checks.length,
  paths: {
    pilotQueue: pilotQueue.queuePath,
    safeHandoffQueue: safeQueue.queuePath,
    safeItemRun: safeRun.runPath,
    safeItemReceipt: safeRun.receiptPath,
    pilotRunnerRun: safeRun.pilotRunnerRunPath,
    pilotRunnerReceipt: safeRun.pilotRunnerReceiptPath,
    unsafeItemReceipt: unsafeRun.receiptPath,
    placeholderItemReceipt: placeholderRun.receiptPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
