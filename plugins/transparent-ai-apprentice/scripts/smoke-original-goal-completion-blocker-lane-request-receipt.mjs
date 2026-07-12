#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "completion-blocker-lane-request-receipt");
mkdirSync(smokeRoot, { recursive: true });

function runScript(script, args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (options.expectFailure) {
    if (result.status === 0) {
      throw new Error(`${script} unexpectedly succeeded`);
    }
    const parsed = JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
    return { ...parsed, failedAsExpected: true, exitStatus: result.status };
  }
  if (result.status !== 0) {
    throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const requestPath = join(smokeRoot, "safe-lane-request.json");
writeFileSync(
  requestPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_original_goal_completion_blocker_lane_command_request_v1",
      generatedBy: "receipt_smoke",
      queuePath: join(smokeRoot, "queue.json"),
      lane: "rollback_evidence_before_system_change",
      itemNumber: 1,
      status: "ready_for_review_only_manual_follow_up",
      nextSafeAction: "Create or retain a rollback point before the next change.",
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-rollback-point.mjs --label "receipt-smoke" --path "package.json"',
      command:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-rollback-point.mjs --label "receipt-smoke" --path "package.json"',
      missingInputs: [],
      replacements: {},
      teacherNote: "teacher confirmed this safe completion blocker lane",
      rollbackPoint: "retained-smoke-rollback-point",
      gated: false,
      evidenceLinks: [],
      blockedClaims: ["claim_original_goal_complete"],
      locks: {
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const builder = runScript("create-original-goal-completion-blocker-lane-request-receipt-builder.mjs", [
  "--request",
  requestPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const template = readJson(builder.receiptTemplatePath);
const approvedReceiptPath = join(smokeRoot, "approved-receipt.json");
writeFileSync(
  approvedReceiptPath,
  `${JSON.stringify(
    {
      ...template,
      teacherDecision: "ready_for_safe_lane_runner",
      evidenceReviewed: true,
      missingInputsResolved: true,
      rollbackPointRetained: true,
      teacherConfirmation: "teacher explicitly confirmed safe completion blocker lane",
      observedEvidencePath: requestPath,
      nextReviewNote: "ready to prepare the safe lane runner command"
    },
    null,
    2
  )}\n`,
  "utf8"
);
const validation = runScript("validate-original-goal-completion-blocker-lane-request-receipt.mjs", [
  "--request",
  requestPath,
  "--receipt",
  approvedReceiptPath,
  "--output-dir",
  join(smokeRoot, "validation")
]);

const forbiddenReceiptPath = join(smokeRoot, "forbidden-receipt.json");
writeFileSync(
  forbiddenReceiptPath,
  `${JSON.stringify(
    {
      ...template,
      teacherDecision: "accepted",
      evidenceReviewed: true,
      missingInputsResolved: true,
      rollbackPointRetained: true,
      teacherConfirmation: "teacher accepted everything",
      observedEvidencePath: requestPath
    },
    null,
    2
  )}\n`,
  "utf8"
);
const forbiddenValidation = runScript("validate-original-goal-completion-blocker-lane-request-receipt.mjs", [
  "--request",
  requestPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
], { expectFailure: true });

const placeholderRequestPath = join(smokeRoot, "numbered-placeholder-lane-request.json");
writeFileSync(
  placeholderRequestPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_original_goal_completion_blocker_lane_command_request_v1",
      generatedBy: "receipt_smoke",
      queuePath: join(smokeRoot, "queue.json"),
      lane: "voice_text_numbered_confirmation_supervised_execution_gate",
      itemNumber: 5,
      status: "waiting_for_placeholder_replacement",
      nextSafeAction: "Teacher must choose one numbered target before any runner command is prepared.",
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\confirm-engineering-command-target.mjs --confirmation "numbered-target-confirmation.json" --selected-number "__SELECTED_NUMBER__"',
      command:
        'node plugins\\transparent-ai-apprentice\\scripts\\confirm-engineering-command-target.mjs --confirmation "numbered-target-confirmation.json" --selected-number "__SELECTED_NUMBER__"',
      missingInputs: ["__SELECTED_NUMBER__"],
      hasPlaceholders: true,
      placeholderReplacementRequired: true,
      replacements: {},
      teacherNote: "teacher still must select a target number",
      rollbackPoint: "retained-smoke-rollback-point",
      gated: false,
      evidenceLinks: [],
      blockedClaims: ["execute_without_numbered_confirmation"],
      locks: {
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const placeholderBuilder = runScript("create-original-goal-completion-blocker-lane-request-receipt-builder.mjs", [
  "--request",
  placeholderRequestPath,
  "--output-dir",
  join(smokeRoot, "placeholder-builder")
]);
const placeholderTemplate = readJson(placeholderBuilder.receiptTemplatePath);
const placeholderReceiptPath = join(smokeRoot, "placeholder-approved-receipt.json");
writeFileSync(
  placeholderReceiptPath,
  `${JSON.stringify(
    {
      ...placeholderTemplate,
      teacherDecision: "ready_for_safe_lane_runner",
      evidenceReviewed: true,
      missingInputsResolved: true,
      rollbackPointRetained: true,
      teacherConfirmation: "teacher explicitly confirmed safe completion blocker lane",
      observedEvidencePath: placeholderRequestPath
    },
    null,
    2
  )}\n`,
  "utf8"
);
const placeholderValidation = runScript("validate-original-goal-completion-blocker-lane-request-receipt.mjs", [
  "--request",
  placeholderRequestPath,
  "--receipt",
  placeholderReceiptPath,
  "--output-dir",
  join(smokeRoot, "placeholder-validation")
]);
const placeholderValidationPacket = readJson(placeholderValidation.validationPath);

const checks = [
  {
    name: "Receipt builder creates teacher template without running lane runner",
    pass:
      builder.format ===
        "transparent_ai_original_goal_completion_blocker_lane_request_receipt_builder_result_v1" &&
      existsSync(builder.receiptTemplatePath || "") &&
      builder.locks?.builderDoesNotRunCommands === true &&
      builder.locks?.builderDoesNotInvokeLaneRunner === true &&
      builder.locks?.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks?.builderDoesNotWriteMemory === true &&
      builder.locks?.goalComplete === false,
    evidence: JSON.stringify(builder).slice(0, 700)
  },
  {
    name: "Receipt validation prepares safe lane runner command only after teacher evidence",
    pass:
      validation.format ===
        "transparent_ai_original_goal_completion_blocker_lane_request_receipt_validation_result_v1" &&
      validation.validationDecision === "ready_for_safe_lane_runner_command" &&
      validation.nextRunnerCommandReady === true &&
      validation.nextRunnerCommand.includes("run-original-goal-completion-blocker-lane-request.mjs") &&
      validation.nextRunnerCommand.includes("--allow-safe-lane-runner") &&
      validation.locks?.validationDoesNotRunLaneRunner === true &&
      validation.locks?.validationDoesNotExecuteTargetSoftware === true &&
      validation.locks?.validationDoesNotWriteMemory === true &&
      validation.locks?.goalComplete === false,
    evidence: JSON.stringify(validation).slice(0, 700)
  },
  {
    name: "Receipt validation blocks acceptance and completion-like decisions",
    pass:
      forbiddenValidation.validationDecision === "blocked_for_forbidden_decision" &&
      forbiddenValidation.failedAsExpected === true &&
      forbiddenValidation.exitStatus !== 0 &&
      forbiddenValidation.nextRunnerCommandReady === false &&
      forbiddenValidation.locks?.accepted === false &&
      forbiddenValidation.locks?.packagingGated === true &&
      forbiddenValidation.locks?.goalComplete === false,
    evidence: JSON.stringify(forbiddenValidation).slice(0, 700)
  },
  {
    name: "Receipt validation blocks numbered placeholder requests even when receipt claims inputs are resolved",
    pass:
      placeholderValidation.validationDecision === "needs_teacher_review_or_missing_evidence" &&
      placeholderValidation.nextRunnerCommandReady === false &&
      placeholderValidationPacket.validationRows.some(
        (row) =>
          row.name === "request_placeholders_resolved" &&
          row.status.includes("request_placeholder_replacement_required") &&
          row.status.includes("request_command_contains_unresolved_placeholders")
      ) &&
      placeholderValidation.locks?.validationDoesNotRunLaneRunner === true &&
      placeholderValidation.locks?.goalComplete === false,
    evidence: JSON.stringify(placeholderValidationPacket.validationRows).slice(0, 900)
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  requestPath,
  builderPath: builder.builderPath,
  validationPath: validation.validationPath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
