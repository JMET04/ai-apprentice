#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = resolve(process.cwd());
const tmpRoot = join(tmpdir(), `transparent-ai-metadata-gate-preflight-draft-${Date.now()}`);
mkdirSync(tmpRoot, { recursive: true });

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args, expectFailure = false) {
  const result = spawnSync("node", [join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (expectFailure) {
    if (result.status === 0) throw new Error(`${script} should have failed`);
    return { failed: true, stdout: String(result.stdout || ""), stderr: String(result.stderr || "") };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function validateWaitingReceipt(cockpitPath, receiptPath, label, expectFailure = false) {
  return runScript(
    "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs",
    ["--cockpit", cockpitPath, "--receipt", receiptPath, "--output-dir", join(tmpRoot, label)],
    expectFailure
  );
}

function validateMetadataReceipt(preflightPath, receiptPath, label, expectFailure = false) {
  return runScript(
    "validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs",
    ["--preflight", preflightPath, "--receipt", receiptPath, "--output-dir", join(tmpRoot, label)],
    expectFailure
  );
}

const rollbackPoint = join(tmpRoot, "rollback-points", "before-metadata-gate");
mkdirSync(rollbackPoint, { recursive: true });
const cockpit = {
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1",
  cockpitId: "smoke-waiting-cockpit",
  reviewRows: [
    {
      rowId: "low-token-waiting-001",
      ledgerNumber: "001",
      software: "ReadyOne",
      reviewStatus: "ready_for_teacher_confirmed_metadata_gate_receipt",
      coverageContractReview: {
        status: "coverage_contract_metadata_gate_ready_pending_teacher_review",
        allowsMetadataGateReview: true
      }
    },
    {
      rowId: "low-token-waiting-002",
      ledgerNumber: "002",
      software: "ReadyTwo",
      reviewStatus: "ready_for_teacher_confirmed_metadata_gate_receipt",
      coverageContractReview: {
        status: "coverage_contract_metadata_gate_ready_pending_teacher_review",
        allowsMetadataGateReview: true
      }
    },
    {
      rowId: "low-token-waiting-003",
      ledgerNumber: "003",
      software: "BlockedApp",
      reviewStatus: "blocked_needs_more_low_token_evidence",
      coverageContractReview: {
        status: "coverage_contract_waiting_for_queue_binding",
        allowsMetadataGateReview: false
      }
    }
  ],
  paths: {
    sourceMetadataGatePreflight: join(tmpRoot, "preflight.json")
  },
  locks: {
    reviewOnly: true,
    cockpitDoesNotRunMetadataGate: true,
    goalComplete: false
  }
};
const waitingReceipt = {
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_v1",
  cockpitId: "smoke-waiting-cockpit",
  decision: "needs_teacher_review",
  rowDecisions: [
    {
      rowId: "low-token-waiting-001",
      software: "ReadyOne",
      teacherDecision: "teacher_ready_for_metadata_gate_receipt",
      evidenceReviewed: true,
      allowMetadataGatePreparation: true
    },
    {
      rowId: "low-token-waiting-002",
      software: "ReadyTwo",
      teacherDecision: "teacher_ready_for_metadata_gate_receipt",
      evidenceReviewed: true,
      allowMetadataGatePreparation: true
    },
    {
      rowId: "low-token-waiting-003",
      software: "BlockedApp",
      teacherDecision: "blocked_needs_more_low_token_evidence",
      evidenceReviewed: true,
      allowMetadataGatePreparation: false
    }
  ],
  locks: cockpit.locks
};
const preflight = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_v1",
  preflightId: "smoke-preflight",
  status: "ready_for_teacher_confirmed_low_token_metadata_gate_batch",
  rows: [
    {
      ledgerNumber: "001",
      software: "ReadyOne",
      processName: "ready-one.exe",
      followUpId: "follow-up-001",
      queueItemId: "ready-one",
      status: "ready_for_teacher_confirmed_metadata_gate",
      readyForTeacherConfirmedMetadataGate: true,
      blockers: []
    },
    {
      ledgerNumber: "002",
      software: "ReadyTwo",
      processName: "ready-two.exe",
      followUpId: "follow-up-002",
      queueItemId: "ready-two",
      status: "ready_for_teacher_confirmed_metadata_gate",
      readyForTeacherConfirmedMetadataGate: true,
      blockers: []
    },
    {
      ledgerNumber: "003",
      software: "BlockedApp",
      processName: "blocked.exe",
      followUpId: "follow-up-003",
      queueItemId: "blocked",
      status: "blocked_before_metadata_gate",
      readyForTeacherConfirmedMetadataGate: false,
      blockers: ["metadata_gate_preflight_not_ready"]
    }
  ],
  commands: [
    {
      tool: "run_all_software_coverage_enrollment_follow_up_batch",
      commandLine: "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-enrollment-follow-up-batch.mjs --teacher-reviewed --max-items 2",
      executesNow: false,
      requiresTeacherConfirmation: true,
      requiresRollbackPoint: true
    }
  ],
  locks: {
    reviewOnly: true,
    preflightDoesNotRunMetadataGate: true,
    goalComplete: false
  }
};
const template = {
  format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_review_receipt_v1",
  builderId: "smoke-builder",
  sourcePreflight: join(tmpRoot, "preflight.json")
};

const cockpitPath = join(tmpRoot, "cockpit.json");
const waitingReceiptPath = join(tmpRoot, "waiting-receipt.json");
const preflightPath = join(tmpRoot, "preflight.json");
const templatePath = join(tmpRoot, "metadata-template.json");
writeJson(cockpitPath, cockpit);
writeJson(waitingReceiptPath, waitingReceipt);
writeJson(preflightPath, preflight);
writeJson(templatePath, template);

const waitingValidationResult = validateWaitingReceipt(cockpitPath, waitingReceiptPath, "waiting-validation");
const waitingValidation = readJson(waitingValidationResult.validationPath);
const draftResult = runScript("create-original-goal-low-token-metadata-gate-preflight-receipt-draft.mjs", [
  "--waiting-row-validation",
  waitingValidationResult.validationPath,
  "--preflight",
  preflightPath,
  "--receipt-template",
  templatePath,
  "--output-dir",
  join(tmpRoot, "metadata-draft")
]);
const draft = readJson(draftResult.draftPath);
const draftReceipt = readJson(draftResult.draftReceiptPath);
const html = readFileSync(draftResult.htmlPath, "utf8");
const draftValidationFailure = validateMetadataReceipt(preflightPath, draftResult.draftReceiptPath, "draft-validation", true);

const editedReceiptPath = join(tmpRoot, "edited-metadata-receipt.json");
const editedReceipt = {
  ...draftReceipt,
  draftOnly: false,
  templateOnly: false,
  decision: "teacher_confirmed_run_low_token_metadata_gate",
  teacherConfirmation: "teacher confirmed metadata gate preflight after review",
  rollbackPointCreated: true,
  rollbackPoint,
  allowCommandGeneration: true,
  rowDecisions: draftReceipt.rowDecisions.map((row) =>
    row.teacherDecision === "teacher_confirmed_run_low_token_metadata_gate"
      ? { ...row, evidenceReviewed: true, teacherNote: "reviewed and approved" }
      : { ...row, evidenceReviewed: true, teacherNote: "still blocked" }
  )
};
writeJson(editedReceiptPath, editedReceipt);
const editedValidationResult = validateMetadataReceipt(preflightPath, editedReceiptPath, "edited-validation");
const editedValidation = readJson(editedValidationResult.validationPath);

const failedWaitingValidation = {
  ...waitingValidation,
  ok: false,
  status: "blocked"
};
const failedWaitingValidationPath = join(tmpRoot, "failed-waiting-validation.json");
writeJson(failedWaitingValidationPath, failedWaitingValidation);
const failedDraft = runScript(
  "create-original-goal-low-token-metadata-gate-preflight-receipt-draft.mjs",
  ["--waiting-row-validation", failedWaitingValidationPath, "--preflight", preflightPath, "--output-dir", join(tmpRoot, "failed-draft")],
  true
);

const checks = [
  {
    name: "Metadata-gate preflight draft requires passed waiting-row validation",
    pass:
      waitingValidation.ok === true &&
      draft.format === "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_draft_v1" &&
      draft.counts.matchedReadyRows === 2 &&
      draft.counts.rowsThatWouldValidateWithoutTeacherEdits === 0 &&
      draft.locks.draftRequiresPassedWaitingRowValidation === true &&
      failedDraft.failed === true &&
      failedDraft.stderr.includes("waiting-row validation must be passed")
  },
  {
    name: "Draft receipt copies row intent but stays non-confirming by default",
    pass:
      draftReceipt.format === "transparent_ai_original_goal_low_token_metadata_gate_preflight_review_receipt_v1" &&
      draftReceipt.draftOnly === true &&
      draftReceipt.teacherMustEditBeforeValidation === true &&
      draftReceipt.teacherConfirmation === "" &&
      draftReceipt.rollbackPointCreated === false &&
      draftReceipt.allowCommandGeneration === false &&
      draftReceipt.rowDecisions.filter((row) => row.teacherDecision === "teacher_confirmed_run_low_token_metadata_gate").length === 2 &&
      draftReceipt.rowDecisions
        .filter((row) => row.teacherDecision === "teacher_confirmed_run_low_token_metadata_gate")
        .every((row) => row.evidenceReviewed === false)
  },
  {
    name: "Draft metadata receipt fails validation until teacher adds rollback, confirmation, command permission, and evidence flags",
    pass:
      draftValidationFailure.failed === true &&
      draftValidationFailure.stdout.includes("blocked_missing_teacher_confirmation_or_retained_rollback_point") &&
      editedValidation.ok === true &&
      editedValidation.status === "validated_with_prepared_metadata_gate_command" &&
      editedValidation.counts.readyRows === 2 &&
      editedValidation.nextPreparedCommands.length === 1 &&
      editedValidation.nextPreparedCommands[0].executesNow === false
  },
  {
    name: "Metadata-gate draft remains review-only and HTML exposes the boundary",
    pass:
      draft.locks.draftDoesNotRunMetadataGate === true &&
      draft.locks.draftDoesNotReadLogs === true &&
      draft.locks.draftDoesNotCaptureScreenshots === true &&
      draft.locks.draftDoesNotExecuteTargetSoftware === true &&
      draft.locks.draftDoesNotWriteMemory === true &&
      html.includes("Metadata Gate Preflight Receipt Draft") &&
      html.includes("not teacher confirmation") &&
      html.includes("no metadata gate run")
  }
];

const failed = checks.filter((check) => !check.pass);
rmSync(tmpRoot, { recursive: true, force: true });
if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.length, matchedReadyRows: draft.counts.matchedReadyRows }, null, 2));
