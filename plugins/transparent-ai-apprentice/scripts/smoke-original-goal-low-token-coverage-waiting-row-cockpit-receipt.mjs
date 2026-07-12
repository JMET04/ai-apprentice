#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = resolve(process.cwd());
const tmpRoot = join(tmpdir(), `transparent-ai-waiting-row-cockpit-receipt-${Date.now()}`);
mkdirSync(tmpRoot, { recursive: true });

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runValidator(receiptPath, label, expectFailure = false) {
  const outputDir = join(tmpRoot, label);
  try {
    const stdout = execFileSync(
      "node",
      [
        join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs"),
        "--cockpit",
        cockpitPath,
        "--receipt",
        receiptPath,
        "--output-dir",
        outputDir
      ],
      { cwd: repoRoot, encoding: "utf8" }
    );
    if (expectFailure) throw new Error(`${label} should have failed`);
    const result = JSON.parse(stdout);
    return readJson(result.validationPath);
  } catch (error) {
    if (!expectFailure) throw error;
    const stdout = String(error.stdout || "");
    const result = stdout.trim() ? JSON.parse(stdout) : null;
    if (!result?.validationPath) throw error;
    return readJson(result.validationPath);
  }
}

const cockpit = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1",
  cockpitId: "smoke-cockpit",
  status: "waiting_for_teacher_low_token_waiting_row_review",
  counts: {
    totalRows: 2,
    readyForTeacherConfirmedMetadataGateRows: 1,
    blockedRows: 1
  },
  reviewRows: [
    {
      rowId: "low-token-waiting-001",
      ledgerNumber: "001",
      software: "ReadyApp",
      reviewStatus: "ready_for_teacher_confirmed_metadata_gate_receipt",
      coverageContractReview: {
        present: true,
        status: "coverage_contract_metadata_gate_ready_pending_teacher_review",
        missingRequirements: [
          "compact_watch_or_metadata_gate_evidence",
          "teacher_coverage_review_path",
          "teacher_receipt_before_completion_claim"
        ],
        allowsMetadataGateReview: true
      },
      allowedTeacherDecisions: [
        "needs_teacher_review",
        "teacher_ready_for_metadata_gate_receipt",
        "blocked_needs_more_low_token_evidence"
      ]
    },
    {
      rowId: "low-token-waiting-002",
      ledgerNumber: "002",
      software: "BlockedApp",
      reviewStatus: "blocked_needs_more_low_token_evidence",
      coverageContractReview: {
        present: true,
        status: "coverage_contract_waiting_for_queue_binding",
        missingRequirements: [
          "observer_queue_or_teacher_scope_binding",
          "compact_watch_or_metadata_gate_evidence",
          "teacher_coverage_review_path",
          "teacher_receipt_before_completion_claim"
        ],
        allowsMetadataGateReview: false
      },
      allowedTeacherDecisions: [
        "needs_teacher_review",
        "teacher_ready_for_metadata_gate_receipt",
        "blocked_needs_more_low_token_evidence"
      ]
    }
  ],
  paths: {
    sourceMetadataGatePreflight: join(tmpRoot, "original-goal-low-token-metadata-gate-preflight.json")
  },
  locks: {
    reviewOnly: true,
    cockpitDoesNotRunMetadataGate: true,
    cockpitDoesNotReadLogs: true,
    cockpitDoesNotCaptureScreenshots: true,
    cockpitDoesNotExecuteTargetSoftware: true,
    goalComplete: false
  }
};

const validReceipt = {
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_v1",
  cockpitId: "smoke-cockpit",
  decision: "needs_teacher_review",
  rowDecisions: [
    {
      rowId: "low-token-waiting-001",
      software: "ReadyApp",
      teacherDecision: "teacher_ready_for_metadata_gate_receipt",
      evidenceReviewed: true,
      allowMetadataGatePreparation: true,
      teacherNote: "reviewed the low-token evidence route"
    },
    {
      rowId: "low-token-waiting-002",
      software: "BlockedApp",
      teacherDecision: "blocked_needs_more_low_token_evidence",
      evidenceReviewed: true,
      allowMetadataGatePreparation: false,
      teacherNote: "needs more source evidence"
    }
  ],
  locks: cockpit.locks
};

const forbiddenReceipt = {
  ...validReceipt,
  rowDecisions: [
    {
      rowId: "low-token-waiting-001",
      software: "ReadyApp",
      teacherDecision: "run_metadata_gate_now",
      evidenceReviewed: true,
      allowMetadataGatePreparation: true
    },
    {
      rowId: "low-token-waiting-002",
      software: "BlockedApp",
      teacherDecision: "teacher_ready_for_metadata_gate_receipt",
      evidenceReviewed: true,
      allowMetadataGatePreparation: true
    }
  ]
};

const missingEvidenceReceipt = {
  ...validReceipt,
  rowDecisions: [
    {
      rowId: "low-token-waiting-001",
      software: "ReadyApp",
      teacherDecision: "teacher_ready_for_metadata_gate_receipt",
      evidenceReviewed: false,
      allowMetadataGatePreparation: true
    },
    validReceipt.rowDecisions[1]
  ]
};

const cockpitPath = join(tmpRoot, "cockpit.json");
const validReceiptPath = join(tmpRoot, "valid-receipt.json");
const forbiddenReceiptPath = join(tmpRoot, "forbidden-receipt.json");
const missingEvidenceReceiptPath = join(tmpRoot, "missing-evidence-receipt.json");
writeJson(cockpitPath, cockpit);
writeJson(validReceiptPath, validReceipt);
writeJson(forbiddenReceiptPath, forbiddenReceipt);
writeJson(missingEvidenceReceiptPath, missingEvidenceReceipt);

const validValidation = runValidator(validReceiptPath, "valid");
const forbiddenValidation = runValidator(forbiddenReceiptPath, "forbidden", true);
const missingEvidenceValidation = runValidator(missingEvidenceReceiptPath, "missing-evidence", true);

const assertions = [
  {
    name: "Matched waiting-row cockpit receipt prepares only the next metadata preflight receipt validation command",
    pass:
      validValidation.format ===
        "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_validation_v1" &&
      validValidation.status === "waiting_for_metadata_gate_preflight_receipt_after_cockpit_review" &&
      validValidation.counts.readyRows === 1 &&
      validValidation.validationRows.find((row) => row.software === "ReadyApp")
        ?.sourceCoverageContractAllowsMetadataGate === true &&
      validValidation.validationRows.find((row) => row.software === "BlockedApp")
        ?.sourceCoverageContractStatus === "coverage_contract_waiting_for_queue_binding" &&
      validValidation.nextSafeCommand?.commandLine.includes("validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs") &&
      validValidation.nextSafeCommand.executesNow === false &&
      validValidation.locks.validationDoesNotRunMetadataGate === true &&
      validValidation.locks.validationDoesNotReadLogs === true &&
      validValidation.locks.validationDoesNotCaptureScreenshots === true &&
      validValidation.locks.validationDoesNotExecuteTargetSoftware === true &&
      validValidation.locks.validationDoesNotWriteMemory === true &&
      validValidation.locks.goalComplete === false
  },
  {
    name: "Forbidden waiting-row cockpit receipt decisions fail closed",
    pass:
      forbiddenValidation.ok === false &&
      forbiddenValidation.status === "blocked" &&
      forbiddenValidation.validationDecision === "blocked_for_forbidden_or_unready_decision" &&
      forbiddenValidation.counts.forbiddenDecisionRows >= 1 &&
      forbiddenValidation.validationRows.some(
        (row) => row.status === "blocked_coverage_contract_not_ready_for_metadata_gate_receipt"
      ) &&
      forbiddenValidation.nextSafeCommand === null
  },
  {
    name: "Ready decision without evidence review stays blocked",
    pass:
      missingEvidenceValidation.ok === false &&
      missingEvidenceValidation.status === "blocked" &&
      missingEvidenceValidation.validationRows.some(
        (row) => row.status === "blocked_missing_evidence_review_or_metadata_preparation_flag"
      )
  }
];

if (process.env.TRANSPARENT_AI_KEEP_SMOKE_TMP !== "1") {
  rmSync(tmpRoot, { recursive: true, force: true });
}

const failed = assertions.filter((assertion) => !assertion.pass);
console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_smoke_v1",
      assertions,
      tmpRoot: existsSync(tmpRoot) ? tmpRoot : "",
      locks: {
        smokeDoesNotRunMetadataGate: true,
        smokeDoesNotReadLogs: true,
        smokeDoesNotCaptureScreenshots: true,
        smokeDoesNotExecuteTargetSoftware: true,
        smokeDoesNotWriteMemory: true,
        goalComplete: false
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
