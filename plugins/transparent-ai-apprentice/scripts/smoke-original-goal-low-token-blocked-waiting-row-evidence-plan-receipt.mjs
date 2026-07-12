#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "original-goal-low-token-blocked-waiting-row-evidence-plan-receipt");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runScript(script, args, { expectFailure = false } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
      cwd: repoRoot,
      encoding: "utf8"
    });
    const parsed = JSON.parse(stdout);
    if (expectFailure) throw new Error(`Expected ${script} to fail`);
    return parsed;
  } catch (error) {
    if (!expectFailure) throw error;
    const stdout = error.stdout ? String(error.stdout) : "";
    return JSON.parse(stdout);
  }
}

function basePlan() {
  const cockpitPath = join(smokeRoot, "original-goal-low-token-coverage-waiting-row-cockpit.json");
  return {
    ok: true,
    format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_v1",
    planId: "smoke-blocked-waiting-row-plan",
    status: "blocked_waiting_rows_need_reviewed_low_token_evidence",
    sourceEvidence: {
      cockpit: cockpitPath
    },
    counts: {
      cockpitRows: 2,
      readyRows: 0,
      blockedRows: 2,
      rowsNeedingLogSourceRoute: 2,
      rowsNeedingCompactWatchEvidence: 2,
      rowsNeedingTeacherReview: 2
    },
    actionRows: [
      {
        rowId: "low-token-waiting-001",
        ledgerNumber: 1,
        software: "ExampleCAD",
        reviewStatus: "blocked_needs_more_low_token_evidence",
        blockers: [
          "log_source_route_not_found_in_ledger",
          "missing_watch_or_compact_learning_evidence",
          "blocked_until_teacher_review"
        ],
        missingEvidenceKinds: [
          "log_source_route_or_reviewed_fallback",
          "compact_watch_or_learning_evidence",
          "teacher_review_receipt"
        ],
        coverageContractReview: {
          present: true,
          status: "coverage_contract_metadata_gate_ready_pending_teacher_review",
          missingRequirements: [],
          allowsMetadataGateReview: true
        },
        lowTokenRouteGap: {
          logSourceLedgerRoutePresent: false,
          coverageContractAllowsMetadataGateReview: true,
          missingLedgerRouteBlocksReturn: true,
          reason: "coverage contract ready but log-source ledger route is missing"
        }
      },
      {
        rowId: "low-token-waiting-002",
        ledgerNumber: 2,
        software: "ExampleNoLogUtility",
        reviewStatus: "blocked_needs_more_low_token_evidence",
        blockers: [
          "log_source_route_not_found_in_ledger",
          "missing_watch_or_compact_learning_evidence",
          "blocked_until_teacher_review"
        ],
        missingEvidenceKinds: [
          "log_source_route_or_reviewed_fallback",
          "compact_watch_or_learning_evidence",
          "teacher_review_receipt"
        ],
        coverageContractReview: {
          present: true,
          status: "coverage_contract_metadata_gate_ready_pending_teacher_review",
          missingRequirements: [],
          allowsMetadataGateReview: true
        },
        lowTokenRouteGap: {
          logSourceLedgerRoutePresent: false,
          coverageContractAllowsMetadataGateReview: true,
          missingLedgerRouteBlocksReturn: true,
          reason: "coverage contract ready but reviewed fallback route is missing"
        }
      }
    ],
    paths: {
      sourceCockpit: cockpitPath
    },
    locks: {
      reviewOnly: true,
      planDoesNotReadLogs: true,
      planDoesNotRunMetadataGate: true,
      planDoesNotExecuteTargetSoftware: true,
      planDoesNotWriteMemory: true,
      goalComplete: false
    }
  };
}

function fillReceipt(template, decision = "evidence_collected_return_to_cockpit_review") {
  return {
    ...template,
    teacherDecision: decision,
    blockedShortcutsReviewed: true,
    noFullLogReadConfirmed: true,
    noScreenshotConfirmed: true,
    noSoftwareExecutionConfirmed: true,
    rollbackRetained: true,
    receiptRows: (template.receiptRows || []).map((row, index) => ({
      ...row,
      teacherDecision: decision,
      logSourceOrFallbackReviewed: true,
      compactWatchEvidenceReviewed: true,
      teacherReviewCompleted: true,
      sourceRouteOrFallbackSummary:
        index === 0
          ? "Teacher reviewed direct log source route metadata."
          : "Teacher reviewed non-log fallback route through process/window metadata.",
      compactEvidenceSummary: "Teacher reviewed compact low-token watch evidence; no full log read.",
      reviewedEvidencePathOrSignal: join(smokeRoot, `reviewed-low-token-evidence-${index + 1}.json`),
      reviewerNote: "Smoke evidence keeps screenshots, software execution, and memory locked."
    }))
  };
}

rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });

const checks = [];
const planPath = join(smokeRoot, "blocked-waiting-row-evidence-plan.json");
writeJson(planPath, basePlan());
const builder = runScript("create-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-builder.mjs", [
  "--plan",
  planPath,
  "--out-dir",
  join(smokeRoot, "builder")
]);
const template = readJson(builder.receiptTemplatePath);
const readyReceiptPath = join(smokeRoot, "ready-receipt.json");
writeJson(readyReceiptPath, fillReceipt(template));
const readyValidation = runScript("validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs", [
  "--plan",
  planPath,
  "--receipt",
  readyReceiptPath,
  "--out-dir",
  join(smokeRoot, "ready-validation")
]);
const readyValidationPacket = readJson(readyValidation.validationPath);
checks.push({
  name: "Receipt builder creates teacher-fillable blocked waiting-row evidence receipt",
  pass:
    builder.format === "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_builder_result_v1" &&
    builder.status === "blocked_waiting_row_evidence_plan_receipt_builder_ready_for_teacher_use" &&
    builder.actionRowCount === 2 &&
    builder.nextValidationCommand.includes("validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs") &&
    template.format === "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_v1" &&
    template.blockedTeacherDecisions.includes("execute_now") &&
    template.receiptRows[0].sourceCoverageContractStatus ===
      "coverage_contract_metadata_gate_ready_pending_teacher_review" &&
    template.receiptRows[0].sourceLowTokenRouteGap.missingLedgerRouteBlocksReturn === true &&
    template.locks?.builderDoesNotReadLogs === true &&
    existsSync(builder.receiptTemplatePath),
  evidence: JSON.stringify(builder).slice(0, 700)
});
checks.push({
  name: "Reviewed evidence receipt returns only to waiting-row cockpit validation",
  pass:
    readyValidation.format ===
      "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_validation_result_v1" &&
    readyValidation.status === "evidence_plan_receipt_ready_to_return_to_waiting_row_cockpit" &&
    readyValidation.counts?.readyRows === 2 &&
    readyValidation.nextSafeCommand?.readyRowIds?.length === 2 &&
    readyValidationPacket.validationRows[0].sourceCoverageContractStatus ===
      "coverage_contract_metadata_gate_ready_pending_teacher_review" &&
    readyValidationPacket.validationRows[0].sourceLowTokenRouteGap.missingLedgerRouteBlocksReturn === true &&
    readyValidation.nextSafeCommand?.executeNow === false &&
    readyValidation.nextSafeCommand?.commandLine.includes(
      "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs"
    ) &&
    readyValidation.locks?.validationDoesNotReadLogs === true &&
    readyValidation.locks?.validationDoesNotRunMetadataGate === true &&
    readyValidation.locks?.validationDoesNotExecuteTargetSoftware === true &&
    readyValidation.locks?.goalComplete === false,
  evidence: JSON.stringify(readyValidation).slice(0, 700)
});

const forbiddenReceiptPath = join(smokeRoot, "forbidden-receipt.json");
writeJson(forbiddenReceiptPath, fillReceipt(template, "execute_now"));
const forbiddenValidation = runScript(
  "validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs",
  ["--plan", planPath, "--receipt", forbiddenReceiptPath, "--out-dir", join(smokeRoot, "forbidden-validation")],
  { expectFailure: true }
);
checks.push({
  name: "Evidence receipt validation fails closed on forbidden execute decisions",
  pass:
    forbiddenValidation.ok === false &&
    forbiddenValidation.status === "blocked_for_invalid_or_forbidden_receipt" &&
    forbiddenValidation.executeNow === false &&
    forbiddenValidation.locks?.validationDoesNotExecuteTargetSoftware === true &&
    forbiddenValidation.locks?.validationDoesNotReadLogs === true,
  evidence: JSON.stringify(forbiddenValidation).slice(0, 700)
});

const missingEvidenceReceiptPath = join(smokeRoot, "missing-evidence-receipt.json");
const missingEvidenceReceipt = fillReceipt(template);
missingEvidenceReceipt.receiptRows[0].compactWatchEvidenceReviewed = false;
missingEvidenceReceipt.receiptRows[0].compactEvidenceSummary = "";
writeJson(missingEvidenceReceiptPath, missingEvidenceReceipt);
const missingEvidenceValidation = runScript(
  "validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs",
  [
    "--plan",
    planPath,
    "--receipt",
    missingEvidenceReceiptPath,
    "--out-dir",
    join(smokeRoot, "missing-evidence-validation")
  ],
  { expectFailure: true }
);
checks.push({
  name: "Evidence receipt validation blocks missing compact low-token evidence",
  pass:
    missingEvidenceValidation.ok === false &&
    missingEvidenceValidation.status === "evidence_plan_receipt_needs_more_teacher_review_or_low_token_evidence" &&
    missingEvidenceValidation.counts?.invalidRows === 1 &&
    missingEvidenceValidation.nextSafeCommand === null &&
    missingEvidenceValidation.locks?.validationDoesNotReadFullLogs === true &&
    missingEvidenceValidation.locks?.goalComplete === false,
  evidence: JSON.stringify(missingEvidenceValidation).slice(0, 700)
});

const passed = checks.filter((check) => check.pass).length;
const result = {
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  smokeRoot,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
