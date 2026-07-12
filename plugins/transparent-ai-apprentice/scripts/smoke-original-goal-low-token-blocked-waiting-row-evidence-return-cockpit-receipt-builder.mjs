#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder");

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args, { expectFailure = false } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
      cwd: repoRoot,
      encoding: "utf8"
    });
    if (expectFailure) throw new Error(`Expected ${script} to fail`);
    return JSON.parse(stdout);
  } catch (error) {
    if (!expectFailure) throw error;
    const stdout = String(error.stdout || "");
    return JSON.parse(stdout);
  }
}

rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });

const cockpitPath = join(smokeRoot, "original-goal-low-token-coverage-waiting-row-cockpit.json");
const cockpit = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1",
  cockpitId: "smoke-return-cockpit",
  status: "waiting_for_teacher_low_token_waiting_row_review",
  counts: {
    totalRows: 2,
    readyForTeacherConfirmedMetadataGateRows: 0,
    blockedRows: 2
  },
  reviewRows: [
    {
      rowId: "low-token-waiting-001",
      ledgerNumber: "001",
      software: "BlockedCAD",
      reviewStatus: "blocked_needs_more_low_token_evidence"
    },
    {
      rowId: "low-token-waiting-002",
      ledgerNumber: "002",
      software: "BlockedSpreadsheet",
      reviewStatus: "blocked_needs_more_low_token_evidence"
    }
  ],
  paths: {
    sourceMetadataGatePreflight: join(smokeRoot, "metadata-gate-preflight.json")
  },
  locks: {
    reviewOnly: true,
    cockpitDoesNotRunMetadataGate: true,
    cockpitDoesNotReadLogs: true,
    cockpitDoesNotExecuteTargetSoftware: true,
    goalComplete: false
  }
};
writeJson(cockpitPath, cockpit);

const readyValidationPath = join(smokeRoot, "ready-evidence-plan-receipt-validation.json");
writeJson(readyValidationPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_validation_v1",
  validationId: "smoke-ready-evidence-plan-receipt-validation",
  status: "evidence_plan_receipt_ready_to_return_to_waiting_row_cockpit",
  sourceEvidence: {
    sourceCockpit: cockpitPath
  },
  counts: {
    planRows: 2,
    receiptRows: 2,
    readyRows: 2,
    invalidRows: 0
  },
  validationRows: cockpit.reviewRows.map((row) => ({
    rowId: row.rowId,
    software: row.software,
    status: "ready_to_return_to_waiting_row_cockpit_review",
    readyToReturnToCockpitReview: true
  })),
  locks: {
    validationDoesNotRunMetadataGate: true,
    validationDoesNotReadLogs: true,
    validationDoesNotExecuteTargetSoftware: true,
    goalComplete: false
  }
});

const blockedValidationPath = join(smokeRoot, "blocked-evidence-plan-receipt-validation.json");
writeJson(blockedValidationPath, {
  ok: false,
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_validation_v1",
  validationId: "smoke-blocked-evidence-plan-receipt-validation",
  status: "evidence_plan_receipt_needs_more_teacher_review_or_low_token_evidence",
  sourceEvidence: {
    sourceCockpit: cockpitPath
  },
  counts: {
    planRows: 2,
    receiptRows: 2,
    readyRows: 1,
    invalidRows: 1
  },
  validationRows: [
    {
      rowId: "low-token-waiting-001",
      status: "ready_to_return_to_waiting_row_cockpit_review",
      readyToReturnToCockpitReview: true
    },
    {
      rowId: "low-token-waiting-002",
      status: "needs_teacher_review_or_missing_reviewed_evidence",
      readyToReturnToCockpitReview: false
    }
  ],
  locks: {
    validationDoesNotRunMetadataGate: true,
    validationDoesNotReadLogs: true,
    validationDoesNotExecuteTargetSoftware: true,
    goalComplete: false
  }
});

const checks = [];
const readyBuilder = runScript("create-original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.mjs", [
  "--validation",
  readyValidationPath,
  "--cockpit",
  cockpitPath,
  "--output-dir",
  join(smokeRoot, "ready-builder")
]);
const receiptDraft = readJson(readyBuilder.receiptDraftPath);
const cockpitValidation = runScript("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
  "--cockpit",
  cockpitPath,
  "--receipt",
  readyBuilder.receiptDraftPath,
  "--output-dir",
  join(smokeRoot, "cockpit-validation")
]);
const cockpitValidationJson = readJson(cockpitValidation.validationPath);
checks.push({
  name: "Validated evidence-plan receipt builds a teacher-review cockpit receipt draft",
  pass:
    readyBuilder.format ===
      "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_return_cockpit_receipt_builder_result_v1" &&
    readyBuilder.status === "return_cockpit_receipt_draft_ready_for_teacher_review" &&
    readyBuilder.counts?.draftedReadyRows === 2 &&
    readyBuilder.nextValidationCommand.includes("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs") &&
    receiptDraft.format === "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_v1" &&
    receiptDraft.rowDecisions.every((row) => row.teacherDecision === "teacher_ready_for_metadata_gate_receipt") &&
    receiptDraft.rowDecisions.every((row) => row.evidencePlanReceiptValidationPath === readyValidationPath) &&
    readyBuilder.locks?.builderDoesNotValidateCockpitReceipt === true &&
    readyBuilder.locks?.builderDoesNotRunMetadataGate === true &&
    readyBuilder.locks?.builderDoesNotReadLogs === true &&
    readyBuilder.locks?.builderDoesNotExecuteTargetSoftware === true &&
    readyBuilder.locks?.goalComplete === false,
  evidence: JSON.stringify(readyBuilder).slice(0, 700)
});
checks.push({
  name: "Cockpit receipt validator accepts blocked rows only through the validated evidence return bridge",
  pass:
    cockpitValidationJson.ok === true &&
    cockpitValidationJson.status === "waiting_for_metadata_gate_preflight_receipt_after_cockpit_review" &&
    cockpitValidationJson.counts.readyRows === 2 &&
    cockpitValidationJson.validationRows.every((row) => row.sourceReadyFromEvidencePlanReturn === true) &&
    cockpitValidationJson.nextSafeCommand?.commandLine.includes("validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs") &&
    cockpitValidationJson.locks?.validationDoesNotReadLogs === true &&
    cockpitValidationJson.locks?.validationDoesNotRunMetadataGate === true &&
    cockpitValidationJson.locks?.validationDoesNotExecuteTargetSoftware === true &&
    cockpitValidationJson.locks?.goalComplete === false,
  evidence: JSON.stringify(cockpitValidationJson).slice(0, 700)
});

const blockedBuilder = runScript(
  "create-original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.mjs",
  ["--validation", blockedValidationPath, "--cockpit", cockpitPath, "--output-dir", join(smokeRoot, "blocked-builder")],
  { expectFailure: true }
);
checks.push({
  name: "Blocked evidence-plan validation cannot create a cockpit receipt validation command",
  pass:
    blockedBuilder.ok === false &&
    blockedBuilder.status === "blocked_until_evidence_plan_validation_and_source_cockpit_are_ready" &&
    blockedBuilder.receiptDraftPath === "" &&
    blockedBuilder.nextValidationCommand === "" &&
    blockedBuilder.locks?.builderDoesNotRunMetadataGate === true &&
    blockedBuilder.locks?.builderDoesNotReadLogs === true,
  evidence: JSON.stringify(blockedBuilder).slice(0, 700)
});

const missingCockpitBuilder = runScript(
  "create-original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.mjs",
  ["--validation", readyValidationPath, "--cockpit", join(smokeRoot, "missing-cockpit.json"), "--output-dir", join(smokeRoot, "missing-cockpit-builder")],
  { expectFailure: true }
);
checks.push({
  name: "Missing cockpit path fails closed without a next command",
  pass:
    missingCockpitBuilder.ok === false &&
    missingCockpitBuilder.nextSafeCommand === null &&
    missingCockpitBuilder.locks?.builderDoesNotExecuteTargetSoftware === true &&
    missingCockpitBuilder.locks?.goalComplete === false,
  evidence: JSON.stringify(missingCockpitBuilder).slice(0, 700)
});

const passed = checks.filter((check) => check.pass).length;
const result = {
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_return_cockpit_receipt_builder_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  smokeRoot: existsSync(smokeRoot) ? smokeRoot : "",
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
