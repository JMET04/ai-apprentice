#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "original-goal-low-token-metadata-gate-preflight-receipt-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], timeout = 120000, expectFailure = false) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout
  });
  if (expectFailure) {
    if (result.status === 0) throw new Error(`${scriptName} unexpectedly passed`);
    return result;
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const rollbackPoint = join(smokeRoot, "rollback-points", "before-reviewed-metadata-gate");
mkdirSync(rollbackPoint, { recursive: true });
const preflightPath = join(smokeRoot, "original-goal-low-token-metadata-gate-preflight.json");
writeFileSync(
  preflightPath,
  `\uFEFF${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_v1",
      preflightId: "fixture-preflight",
      status: "ready_for_teacher_confirmed_low_token_metadata_gate_batch",
      counts: {
        proofRows: 3,
        readyMetadataGateRows: 2,
        blockedRows: 1,
        commands: 1
      },
      rows: [
        {
          ledgerNumber: 1,
          software: "alpha-app",
          processName: "alpha",
          followUpId: "enrollment-follow-up-001",
          queueItemId: "alpha-alpha",
          status: "ready_for_teacher_confirmed_metadata_gate",
          readyForTeacherConfirmedMetadataGate: true,
          blockers: [],
          locks: { preflightDoesNotRunMetadataGate: true, goalComplete: false }
        },
        {
          ledgerNumber: 2,
          software: "<img src=x onerror=alert(1)>beta-app",
          processName: "beta",
          followUpId: "enrollment-follow-up-002",
          queueItemId: "beta-beta",
          status: "ready_for_teacher_confirmed_metadata_gate",
          readyForTeacherConfirmedMetadataGate: true,
          blockers: [],
          locks: { preflightDoesNotRunMetadataGate: true, goalComplete: false }
        },
        {
          ledgerNumber: 3,
          software: "blocked-app",
          processName: "blocked",
          followUpId: "enrollment-follow-up-003",
          queueItemId: "",
          status: "blocked_before_metadata_gate",
          readyForTeacherConfirmedMetadataGate: false,
          blockers: ["missing_reviewed_queue_path_for_metadata_gate"],
          locks: { preflightDoesNotRunMetadataGate: true, goalComplete: false }
        }
      ],
      commands: [
        {
          tool: "run_all_software_coverage_enrollment_follow_up_batch",
          commandLine:
            "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-enrollment-follow-up-batch.mjs --plan \"" +
            join(smokeRoot, "coverage-enrollment-follow-up-plan.json") +
            "\" --teacher-reviewed --max-items 2 --max-queue-items 2 --max-logs-per-item 1 --max-tail-lines 16 --max-tail-bytes 1024",
          executesNow: false,
          requiresTeacherConfirmation: true,
          requiresRollbackPoint: true,
          readyFollowUpIds: ["enrollment-follow-up-001", "enrollment-follow-up-002"]
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        packagingGated: true,
        preflightDoesNotRunMetadataGate: true,
        preflightDoesNotReadLogs: true,
        preflightDoesNotCaptureScreenshots: true,
        preflightDoesNotExecuteTargetSoftware: true,
        preflightDoesNotWriteMemory: true,
        metadataGateRunnerInvoked: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const builderResult = runNodeScript("create-original-goal-low-token-metadata-gate-preflight-receipt-builder.mjs", [
  "--preflight",
  preflightPath,
  "--output-dir",
  join(smokeRoot, "receipt-builder")
]);
const builder = readJson(builderResult.builderPath);
const receiptTemplate = readJson(builderResult.receiptTemplatePath);
const html = readFileSync(builderResult.htmlPath, "utf8");

const validReceiptPath = join(smokeRoot, "valid-teacher-receipt.json");
const validReceipt = {
  ...receiptTemplate,
  decision: "teacher_confirmed_run_low_token_metadata_gate",
  teacherConfirmation: "teacher confirmed after review and rollback point retained",
  rollbackPointCreated: true,
  rollbackPoint,
  allowCommandGeneration: true,
  rowDecisions: receiptTemplate.rowDecisions.map((row) => ({
    ...row,
    teacherDecision:
      row.followUpId === "enrollment-follow-up-003"
        ? "blocked_needs_more_evidence"
        : "teacher_confirmed_run_low_token_metadata_gate",
    evidenceReviewed: true,
    teacherNote: row.followUpId === "enrollment-follow-up-003" ? "source row is blocked" : "ready row reviewed"
  }))
};
writeFileSync(validReceiptPath, `\uFEFF${JSON.stringify(validReceipt, null, 2)}\n`, "utf8");
const validationResult = runNodeScript("validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs", [
  "--preflight",
  preflightPath,
  "--receipt",
  validReceiptPath,
  "--output-dir",
  join(smokeRoot, "valid-validation")
]);
const validation = readJson(validationResult.validationPath);

const missingRollbackReceiptPath = join(smokeRoot, "missing-rollback-teacher-receipt.json");
writeFileSync(
  missingRollbackReceiptPath,
  `\uFEFF${JSON.stringify({ ...validReceipt, rollbackPointCreated: false, rollbackPoint: "" }, null, 2)}\n`,
  "utf8"
);
const missingRollbackFailure = runNodeScript(
  "validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs",
  ["--preflight", preflightPath, "--receipt", missingRollbackReceiptPath, "--output-dir", join(smokeRoot, "missing-rollback-validation")],
  120000,
  true
);

const forbiddenReceiptPath = join(smokeRoot, "forbidden-teacher-receipt.json");
writeFileSync(
  forbiddenReceiptPath,
  `\uFEFF${JSON.stringify({ ...validReceipt, decision: "accepted" }, null, 2)}\n`,
  "utf8"
);
const forbiddenFailure = runNodeScript(
  "validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs",
  ["--preflight", preflightPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(smokeRoot, "forbidden-validation")],
  120000,
  true
);

const checks = [
  {
    name: "Receipt builder creates teacher confirmation template for low-token metadata gate preflight",
    pass:
      builder.format === "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_builder_v1" &&
      builder.counts.readyRows === 2 &&
      builder.counts.blockedRows === 1 &&
      builder.nextValidationCommand.includes("validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs") &&
      builder.browserSafety.usesSafeTextRendering === true &&
      builder.blockedTransitions.includes("render_untrusted_software_names_with_inner_html") &&
      receiptTemplate.format === "transparent_ai_original_goal_low_token_metadata_gate_preflight_review_receipt_v1" &&
      receiptTemplate.rollbackPointCreated === false &&
      receiptTemplate.allowCommandGeneration === false,
    evidence: builderResult.builderPath
  },
  {
    name: "Receipt validator prepares command only after teacher confirmation and retained rollback point",
    pass:
      validation.format === "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_validation_v1" &&
      validation.status === "validated_with_prepared_metadata_gate_command" &&
      validation.counts.readyRows === 2 &&
      validation.nextPreparedCommands.length === 1 &&
      validation.nextPreparedCommands[0].executesNow === false &&
      validation.nextPreparedCommands[0].rollbackPoint === rollbackPoint,
    evidence: validationResult.validationPath
  },
  {
    name: "Receipt validation remains review-only and does not run metadata gates",
    pass:
      validation.locks.validationDoesNotRunMetadataGate === true &&
      validation.locks.validationDoesNotReadLogs === true &&
      validation.locks.validationDoesNotCaptureScreenshots === true &&
      validation.locks.validationDoesNotExecuteTargetSoftware === true &&
      validation.locks.validationDoesNotWriteMemory === true &&
      validation.locks.metadataGateRunnerInvoked === false &&
      validation.locks.goalComplete === false,
    evidence: JSON.stringify(validation.locks)
  },
  {
    name: "Missing rollback point and forbidden accepted decision fail closed",
    pass:
      missingRollbackFailure.status !== 0 &&
      missingRollbackFailure.stdout.includes("blocked_missing_teacher_confirmation_or_retained_rollback_point") &&
      forbiddenFailure.status !== 0 &&
      forbiddenFailure.stdout.includes("blocked_for_forbidden_decision"),
    evidence: "missing rollback and accepted decision both failed"
  },
  {
    name: "Receipt builder HTML generates teacher receipt JSON without running commands",
    pass:
      html.includes("Low-Token Metadata Gate Receipt Builder") &&
      html.includes("review only") &&
      html.includes("Generate Receipt JSON") &&
      html.includes("Mark Ready Rows Confirmed") &&
      html.includes("Retained rollback point path") &&
      html.includes("navigator.clipboard.writeText") &&
      html.includes("allowCommandGeneration") &&
      html.includes("textContent") &&
      !html.includes(".innerHTML") &&
      !html.includes("<img src=x") &&
      html.includes("\\u003cimg src=x onerror=alert(1)>beta-app") &&
      readFileSync(builderResult.readmePath, "utf8").includes("does not run metadata gates"),
    evidence: builderResult.htmlPath
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
