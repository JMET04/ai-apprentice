#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "goal-teacher-review-cockpit-receipt-validation-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runValidation(args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", "validate-goal-teacher-review-cockpit-receipt.mjs"), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 60000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error("cockpit receipt validation unexpectedly succeeded");
    const parsed = JSON.parse(result.stdout);
    return { ...parsed, failedAsExpected: true, exitStatus: result.status };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "cockpit receipt validation failed");
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const cockpitPath = writeJson(join(smokeRoot, "fixture-cockpit.json"), {
  format: "transparent_ai_goal_teacher_review_cockpit_v1",
  cockpitId: "fixture-cockpit",
  status: "waiting_for_teacher_review",
  reviewItems: [
    {
      id: "activation_confirmations",
      title: "Activation confirmations",
      command: "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-operational-activation-review-receipt.mjs --review-packet \"packet.json\" --receipt \"activation-receipt.json\""
    },
    {
      id: "coverage_rollout_receipt",
      title: "Coverage rollout receipt",
      command: "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-coverage-rollout-receipt.mjs --plan \"plan.json\" --receipt \"coverage-receipt.json\""
    },
    {
      id: "voice_text_numbered_target",
      title: "Voice/text numbered target",
      command: "node plugins\\transparent-ai-apprentice\\scripts\\confirm-engineering-command-target.mjs --selected-number \"1\""
    }
  ],
  blockedActions: ["execute_from_cockpit", "claim_goal_complete_from_cockpit"],
  locks: {
    cockpitDoesNotRunCommands: true,
    targetSoftwareCommandsExecuted: false
  }
});

const defaultReceiptPath = writeJson(join(smokeRoot, "default-receipt.json"), {
  format: "transparent_ai_goal_teacher_review_cockpit_receipt_v1",
  cockpitId: "fixture-cockpit",
  defaultDecision: "needs_teacher_review",
  rowDecisions: [
    { id: "activation_confirmations", teacherDecision: "needs_teacher_review", evidenceReviewed: false },
    { id: "coverage_rollout_receipt", teacherDecision: "needs_teacher_review", evidenceReviewed: false }
  ]
});
const defaultResult = runValidation([
  "--cockpit",
  cockpitPath,
  "--receipt",
  defaultReceiptPath,
  "--output-dir",
  join(smokeRoot, "default")
]);
const defaultValidation = readJson(defaultResult.validationPath);

const reviewedReceiptPath = writeJson(join(smokeRoot, "reviewed-receipt.json"), {
  format: "transparent_ai_goal_teacher_review_cockpit_receipt_v1",
  cockpitId: "fixture-cockpit",
  defaultDecision: "needs_teacher_review",
  rowDecisions: [
    { id: "coverage_rollout_receipt", teacherDecision: "teacher_reviewed_continue", evidenceReviewed: true },
    { id: "voice_text_numbered_target", teacherDecision: "blocked_needs_more_evidence", evidenceReviewed: true }
  ]
});
const reviewedResult = runValidation([
  "--cockpit",
  cockpitPath,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  join(smokeRoot, "reviewed")
]);
const reviewedValidation = readJson(reviewedResult.validationPath);

const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-receipt.json"), {
  format: "transparent_ai_goal_teacher_review_cockpit_receipt_v1",
  cockpitId: "fixture-cockpit",
  defaultDecision: "needs_teacher_review",
  rowDecisions: [{ id: "coverage_rollout_receipt", teacherDecision: "execute_now", evidenceReviewed: true }]
});
const forbiddenResult = runValidation([
  "--cockpit",
  cockpitPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden")
], { expectFailure: true });

const checks = [
  check(
    "Default cockpit receipt stays waiting for teacher review",
    defaultResult.status === "waiting_for_teacher_review" &&
      defaultResult.readyRowCount === 0 &&
      defaultValidation.nextSafeCommands.length === 0,
    defaultResult.validationPath
  ),
  check(
    "Reviewed cockpit row becomes downstream review command without execution",
    reviewedResult.status === "validated_with_reviewed_cockpit_rows" &&
      reviewedResult.readyRowCount === 1 &&
      reviewedValidation.nextSafeCommands.length === 1 &&
      reviewedValidation.nextSafeCommands[0].command.includes("validate-all-software-coverage-rollout-receipt.mjs") &&
      reviewedValidation.nextSafeCommands[0].executesNow === false &&
      reviewedValidation.locks.commandsExecuted === false,
    reviewedResult.validationPath
  ),
  check(
    "Forbidden cockpit decision fails closed",
    forbiddenResult.status === "blocked" &&
      forbiddenResult.forbiddenDecisionUsed === true &&
      forbiddenResult.failedAsExpected === true &&
      forbiddenResult.exitStatus !== 0 &&
      forbiddenResult.locks.targetSoftwareCommandsExecuted === false,
    forbiddenResult.validationPath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_goal_teacher_review_cockpit_receipt_validation_smoke_v1",
  smokeRoot,
  paths: {
    cockpit: cockpitPath,
    defaultValidation: defaultResult.validationPath,
    reviewedValidation: reviewedResult.validationPath,
    forbiddenValidation: forbiddenResult.validationPath
  },
  checks
};
console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
