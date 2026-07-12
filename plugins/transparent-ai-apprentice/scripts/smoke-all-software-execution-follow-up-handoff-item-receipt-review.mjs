#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "execution-handoff-item-receipt-review-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (options.expectFailure) {
    if (result.status === 0) {
      throw new Error(`${script} was expected to fail`);
    }
    return { ...JSON.parse(result.stdout), failedAsExpected: true, exitStatus: result.status };
  }
  if (result.status !== 0) {
    throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return { ...JSON.parse(result.stdout), exitStatus: result.status };
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

const priorSmoke = runNode("smoke-all-software-execution-follow-up-handoff-queue-item-runner.mjs");
if (priorSmoke.status !== "passed") throw new Error("prerequisite handoff item runner smoke did not pass");
const itemRunPath = priorSmoke.paths.safeItemRun;
const itemRun = readJson(itemRunPath);

const builder = runNode("create-all-software-execution-follow-up-handoff-item-receipt-builder.mjs", [
  "--goal",
  "Smoke teacher review of one dry-run execution handoff item.",
  "--run",
  itemRunPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builderPacket = readJson(builder.builderPath);
const template = readJson(builder.receiptTemplatePath);

const matchedReceiptPath = writeJson(join(smokeRoot, "matched-receipt.json"), {
  ...template,
  teacherDecision: "dry_run_matched_expected",
  evidenceReviewed: true,
  pilotRunnerReceiptReviewed: true,
  outcomeVerificationReviewed: true,
  postActionCheckpointReviewed: true,
  teacherMatchedExpected: true,
  teacherNote: "Dry-run evidence matches the intended route."
});
const matchedValidation = runNode("validate-all-software-execution-follow-up-handoff-item-receipt.mjs", [
  "--run",
  itemRunPath,
  "--receipt",
  matchedReceiptPath,
  "--output-dir",
  join(smokeRoot, "matched-validation")
]);
const matchedPacket = readJson(matchedValidation.validationPath);

const mismatchReceiptPath = writeJson(join(smokeRoot, "mismatch-receipt.json"), {
  ...template,
  teacherDecision: "dry_run_mismatch_blocked",
  evidenceReviewed: true,
  pilotRunnerReceiptReviewed: true,
  outcomeVerificationReviewed: true,
  postActionCheckpointReviewed: true,
  teacherMatchedExpected: false,
  teacherNote: "The route did not match intent."
});
const mismatchValidation = runNode("validate-all-software-execution-follow-up-handoff-item-receipt.mjs", [
  "--run",
  itemRunPath,
  "--receipt",
  mismatchReceiptPath,
  "--output-dir",
  join(smokeRoot, "mismatch-validation")
]);

const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-receipt.json"), {
  ...template,
  teacherDecision: "execute_now",
  evidenceReviewed: true,
  pilotRunnerReceiptReviewed: true,
  outcomeVerificationReviewed: true,
  postActionCheckpointReviewed: true,
  teacherMatchedExpected: true
});
const forbiddenValidation = runNode("validate-all-software-execution-follow-up-handoff-item-receipt.mjs", [
  "--run",
  itemRunPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
], { expectFailure: true });

const incompleteReceiptPath = writeJson(join(smokeRoot, "incomplete-receipt.json"), {
  ...template,
  teacherDecision: "dry_run_matched_expected",
  evidenceReviewed: true,
  pilotRunnerReceiptReviewed: false,
  outcomeVerificationReviewed: true,
  postActionCheckpointReviewed: true,
  teacherMatchedExpected: true
});
const incompleteValidation = runNode("validate-all-software-execution-follow-up-handoff-item-receipt.mjs", [
  "--run",
  itemRunPath,
  "--receipt",
  incompleteReceiptPath,
  "--output-dir",
  join(smokeRoot, "incomplete-validation")
]);
const incompletePacket = readJson(incompleteValidation.validationPath);

const checks = [
  check(
    "Handoff item receipt builder creates teacher review template from a real dry-run item run",
    builderPacket.format === "transparent_ai_all_software_execution_follow_up_handoff_item_receipt_builder_v1" &&
      template.format === "transparent_ai_all_software_execution_follow_up_handoff_item_review_receipt_v1" &&
      builderPacket.reviewItem.itemRunId === itemRun.runId &&
      builderPacket.reviewItem.allowedTeacherDecisions.includes("dry_run_matched_expected") &&
      readFileSync(builder.htmlPath, "utf8").includes("Execution Handoff Item Review"),
    builder.builderPath
  ),
  check(
    "Matched teacher receipt becomes approval-gate planning only, not execution",
    matchedValidation.status === "validated_ready_for_next_gate_review" &&
      matchedPacket.validationDecision === "ready_for_execution_approval_gate_planning" &&
      matchedPacket.nextReviewCommands.length === 1 &&
      matchedPacket.nextReviewCommands[0].command.includes("create-real-local-execution-approval-gate.mjs") &&
      matchedPacket.nextReviewCommands[0].command.includes("<real-local-execution-pilot-selector.json>") &&
      matchedPacket.locks.validationDoesNotCreateApprovalGate === true &&
      matchedPacket.locks.validationDoesNotExecuteTargetSoftware === true,
    matchedValidation.validationPath
  ),
  check(
    "Mismatched teacher receipt blocks follow-up without next gate command",
    mismatchValidation.status === "blocked" && mismatchValidation.nextReviewCommandCount === 0,
    mismatchValidation.receiptPath
  ),
  check(
    "Forbidden execute-now decision fails closed before approval gate planning",
    forbiddenValidation.failedAsExpected === true &&
      forbiddenValidation.exitStatus !== 0 &&
      forbiddenValidation.status === "blocked" &&
      forbiddenValidation.validationDecision === "blocked_for_forbidden_decision" &&
      forbiddenValidation.nextReviewCommandCount === 0,
    forbiddenValidation.receiptPath
  ),
  check(
    "Matched decision without complete evidence review stays waiting",
    incompleteValidation.status === "waiting_for_teacher_review" &&
      incompletePacket.reviewRow.status === "missing_required_review_evidence" &&
      incompleteValidation.nextReviewCommandCount === 0,
    incompleteValidation.validationPath
  ),
  check(
    "Handoff item receipt review keeps screenshots memory rules packaging native execution and completion locked",
    matchedPacket.locks.reviewOnly === true &&
      matchedPacket.locks.validationDoesNotInvokeRunner === true &&
      matchedPacket.locks.validationDoesNotCaptureScreenshots === true &&
      matchedPacket.locks.validationDoesNotWriteMemory === true &&
      matchedPacket.locks.accepted === false &&
      matchedPacket.locks.ruleEnabled === false &&
      matchedPacket.locks.packagingGated === true &&
      matchedPacket.locks.nativeUniversalExecution === false &&
      matchedPacket.locks.goalComplete === false,
    JSON.stringify(matchedPacket.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_all_software_execution_follow_up_handoff_item_receipt_review_smoke_v1",
  smokeRoot,
  passed,
  total: checks.length,
  paths: {
    itemRun: itemRunPath,
    builder: builder.builderPath,
    receiptTemplate: builder.receiptTemplatePath,
    matchedValidation: matchedValidation.validationPath,
    mismatchValidation: mismatchValidation.validationPath,
    forbiddenValidation: forbiddenValidation.validationPath,
    incompleteValidation: incompleteValidation.validationPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
