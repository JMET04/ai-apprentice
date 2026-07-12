#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(args, options = {}) {
  const result = spawnSync(process.execPath, [join(__dirname, "validate-original-goal-gap-action-board-receipt.mjs"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error("gap board receipt validation unexpectedly succeeded");
    const parsed = JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
    return { ...parsed, failedAsExpected: true, exitStatus: result.status };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "gap board receipt validation failed");
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "original-goal-gap-action-board-receipt-validation-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const boardPath = writeJson(join(smokeRoot, "board", "original-goal-gap-action-board.json"), {
  format: "transparent_ai_original_goal_gap_action_board_v1",
  boardId: "smoke-board",
  sourceEvidence: {
    activationReceiptValidation: "D:\\example\\activation-validation.json"
  },
  actionRows: [
    {
      id: "activation_recurring_monitor_teacher_confirmation",
      lane: "automatic_learning_activation",
      nextAction: "Teacher may confirm this row in the activation receipt builder, then rerun receipt validation.",
      blockedTeacherDecisions: ["accepted", "execute_now", "register_now", "memory_enabled", "claim_complete"]
    },
    {
      id: "coverage_batch-001",
      lane: "all_software_low_token_coverage",
      downstreamLane: "all_software_low_token_coverage",
      nextAction: "teacher_review_required_before_runner",
      nextSafeCommand: "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-coverage-rollout-receipt.mjs --plan D:\\example\\coverage-plan.json --receipt <teacher-filled-coverage-rollout-receipt.json>",
      blockedTeacherDecisions: ["accepted", "execute_now", "register_now", "memory_enabled", "claim_complete"]
    },
    {
      id: "execution_dry_run_receipts_missing",
      lane: "all_software_execution_capability",
      downstreamLane: "all_software_execution_capability",
      nextAction: "Review latest matrix gaps, confirm routes, then rerun a bounded supervisor pass.",
      nextSafeCommand: "node plugins\\transparent-ai-apprentice\\scripts\\create-all-software-execution-follow-up-receipt-builder.mjs --batch D:\\example\\execution-follow-up-batch.json",
      blockedTeacherDecisions: ["accepted", "execute_now", "register_now", "memory_enabled", "claim_complete"]
    },
    {
      id: "execution_unsafe_direct_runner",
      lane: "all_software_execution_capability",
      downstreamLane: "all_software_execution_capability",
      nextAction: "Unsafe fixture row that must be blocked by validation.",
      nextSafeCommand: "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-execution-capability-supervisor.mjs --matrix D:\\example\\matrix.json --teacher-reviewed",
      blockedTeacherDecisions: ["accepted", "execute_now", "register_now", "memory_enabled", "claim_complete"]
    }
  ],
  blockedActions: ["claim_original_goal_complete_from_gap_board"]
});

const goodReceiptPath = writeJson(join(smokeRoot, "receipt", "good-receipt.json"), {
  format: "transparent_ai_original_goal_gap_action_board_receipt_v1",
  boardId: "smoke-board",
  rowDecisions: [
    {
      id: "coverage_batch-001",
      teacherDecision: "teacher_reviewed_continue",
      evidenceReviewed: true,
      teacherNote: "reviewed coverage batch evidence"
    },
    {
      id: "execution_dry_run_receipts_missing",
      teacherDecision: "teacher_reviewed_continue",
      evidenceReviewed: true,
      teacherNote: "reviewed execution follow-up handoff"
    }
  ]
});

const badReceiptPath = writeJson(join(smokeRoot, "receipt", "bad-receipt.json"), {
  format: "transparent_ai_original_goal_gap_action_board_receipt_v1",
  boardId: "smoke-board",
  rowDecisions: [
    {
      id: "coverage_batch-001",
      teacherDecision: "claim_complete",
      evidenceReviewed: true,
      teacherNote: "forbidden"
    }
  ]
});

const unsafeCommandReceiptPath = writeJson(join(smokeRoot, "receipt", "unsafe-command-receipt.json"), {
  format: "transparent_ai_original_goal_gap_action_board_receipt_v1",
  boardId: "smoke-board",
  rowDecisions: [
    {
      id: "execution_unsafe_direct_runner",
      teacherDecision: "teacher_reviewed_continue",
      evidenceReviewed: true,
      teacherNote: "this must not pass through because the command contains --teacher-reviewed"
    }
  ]
});

const goodResult = runScript([
  "--goal",
  "smoke validate reviewed gap board rows",
  "--board",
  boardPath,
  "--receipt",
  goodReceiptPath,
  "--output-dir",
  join(smokeRoot, "good-output")
]);
const goodValidation = readJson(goodResult.validationPath);
const goodReadme = readFileSync(goodResult.readmePath, "utf8");

const badResult = runScript([
  "--goal",
  "smoke block forbidden gap board receipt",
  "--board",
  boardPath,
  "--receipt",
  badReceiptPath,
  "--output-dir",
  join(smokeRoot, "bad-output")
], { expectFailure: true });
const badValidation = readJson(badResult.validationPath);

const unsafeCommandResult = runScript([
  "--goal",
  "smoke block unsafe downstream command",
  "--board",
  boardPath,
  "--receipt",
  unsafeCommandReceiptPath,
  "--output-dir",
  join(smokeRoot, "unsafe-command-output")
], { expectFailure: true });
const unsafeCommandValidation = readJson(unsafeCommandResult.validationPath);

const checks = [
  check(
    "Gap board receipt validation enables only reviewed continue rows",
    goodValidation.format === "transparent_ai_original_goal_gap_action_board_receipt_validation_v1" &&
      goodValidation.validationDecision === "all_rows_ready_for_downstream_gate_review" &&
      goodValidation.readyRowCount === 2 &&
      goodValidation.nextSafeCommands.length === 2 &&
      goodValidation.nextSafeCommands.some((row) => row.command.includes("validate-all-software-coverage-rollout-receipt.mjs")) &&
      goodValidation.nextSafeCommands.some((row) => row.command.includes("create-all-software-execution-follow-up-receipt-builder.mjs")) &&
      goodValidation.nextSafeCommands.every((row) => row.executesNow === false),
    goodResult.validationPath
  ),
  check(
    "Gap board receipt validation fails closed on forbidden completion decisions",
    badValidation.forbiddenDecisionUsed === true &&
      badValidation.validationDecision === "blocked_for_forbidden_decision" &&
      badResult.failedAsExpected === true &&
      badResult.exitStatus !== 0 &&
      badValidation.locks.goalComplete === false,
    badResult.validationPath
  ),
  check(
    "Gap board receipt validation fails closed on unsafe direct downstream commands",
    unsafeCommandValidation.unsafeDownstreamCommandUsed === true &&
      unsafeCommandValidation.validationDecision === "blocked_for_unsafe_downstream_command" &&
      unsafeCommandResult.failedAsExpected === true &&
      unsafeCommandResult.exitStatus !== 0 &&
      unsafeCommandValidation.nextSafeCommands.length === 0 &&
      unsafeCommandValidation.validationRows.some(
        (row) =>
          row.id === "execution_unsafe_direct_runner" &&
          row.status === "blocked_for_unsafe_downstream_command" &&
          row.nextCommandSafety?.matchedForbiddenMarkers?.includes("--teacher-reviewed")
      ) &&
      unsafeCommandValidation.locks.validationDoesNotExecuteCommands === true,
    unsafeCommandResult.validationPath
  ),
  check(
    "Gap board receipt validation keeps system-change locks closed",
    goodValidation.locks.validationDoesNotExecuteCommands === true &&
      goodValidation.locks.validationDoesNotRegisterTask === true &&
      goodValidation.locks.validationDoesNotExecuteTargetSoftware === true &&
      goodValidation.locks.validationDoesNotWriteMemory === true &&
      goodValidation.locks.nativeUniversalExecution === false,
    goodResult.validationPath
  ),
  check(
    "Gap board receipt validation documents downstream gate requirement",
    goodReadme.includes("does not execute generated commands") &&
      goodReadme.includes("Next safe commands:"),
    goodResult.readmePath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_original_goal_gap_action_board_receipt_validation_smoke_v1",
  smokeRoot,
  checks
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
