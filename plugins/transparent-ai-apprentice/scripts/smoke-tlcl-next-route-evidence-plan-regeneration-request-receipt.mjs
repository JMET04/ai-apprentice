#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "tlcl-next-route-evidence-plan-regeneration-request-receipt");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runScript(script, args) {
  const stdout = execFileSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return JSON.parse(stdout);
}

function builderFixture() {
  return {
    ok: true,
    format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_v1",
    builderId: "smoke-regeneration-command-builder",
    createdAt: "2026-06-14T00:00:00.000Z",
    status: "evidence_plan_regeneration_command_builder_waiting_for_teacher_copy",
    request: {
      format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_v1",
      routeId: "route_to_highest_reasoning_contract_repair",
      nextTool: "create_tlcl_next_route_input_contract",
      suggestedRegenerationCommand:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-next-route-input-contract.mjs --attachment ".ta-smoke\\reviewed-tlcl-rag-evidence-attachment.json" --rollback-point ".rollback-points\\smoke-retained-rollback"',
      evidenceRowsUsed: [
        {
          missingInputId: "reviewed_tlcl_rag_evidence_attachment",
          suppliedValueForInputContract: join(smokeRoot, "reviewed-tlcl-rag-evidence-attachment.json"),
          suppliedEvidenceSummary: "Teacher-reviewed evidence-only RAG attachment."
        },
        {
          missingInputId: "rollback_point_retained",
          suppliedValueForInputContract: join(repoRoot, ".rollback-points", "smoke-retained-rollback"),
          suppliedEvidenceSummary: "Rollback point retained before high-reasoning repair."
        }
      ],
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    },
    blockers: [],
    locks: {
      reviewOnly: true,
      commandBuilderOnly: true,
      builderDoesNotRegenerateInputContract: true,
      builderDoesNotRunCommand: true,
      builderDoesNotRunNextTool: true,
      builderDoesNotInvokeModel: true,
      builderDoesNotFetchRag: true,
      builderDoesNotWriteMemory: true,
      builderDoesNotEnableRule: true,
      builderDoesNotUnlockPackaging: true,
      commandExecuted: false,
      nextToolExecuted: false,
      inputContractRegenerated: false,
      modelInvoked: false,
      ragFetched: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingUnlocked: false,
      goalComplete: false
    }
  };
}

function fillReceipt(template, decision = "teacher_reviewed_regeneration_request_ready_for_manual_use") {
  return {
    ...template,
    teacherDecision: decision,
    confirmedRetainedRollbackPoint: join(repoRoot, ".rollback-points", "smoke-retained-rollback"),
    regenerationRequestReviewed: true,
    commandReviewed: true,
    evidenceRowsReviewed: true,
    noOpLocksReviewed: true,
    separateManualStepConfirmed: true,
    blockedActionsConfirmed: true,
    teacherNotes:
      decision === "correction_to_high_reasoning_repair"
        ? "Teacher found the evidence route needs high-reasoning repair."
        : "Smoke review confirms separate manual use only."
  };
}

rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });
const checks = [];

const builderPath = join(smokeRoot, "command-builder.json");
writeJson(builderPath, builderFixture());
const receiptBuilderResult = runScript("create-tlcl-next-route-evidence-plan-regeneration-request-receipt-builder.mjs", [
  "--builder",
  builderPath,
  "--out-dir",
  join(smokeRoot, "receipt-builder")
]);
const receiptTemplate = readJson(receiptBuilderResult.receiptTemplatePath);

const readyReceiptPath = join(smokeRoot, "ready-receipt.json");
writeJson(readyReceiptPath, fillReceipt(receiptTemplate));
const readyValidation = runScript("validate-tlcl-next-route-evidence-plan-regeneration-request-receipt.mjs", [
  "--builder",
  builderPath,
  "--receipt",
  readyReceiptPath,
  "--out-dir",
  join(smokeRoot, "ready-validation")
]);
checks.push({
  name: "Request receipt validation allows only reviewed separate manual regeneration use",
  pass:
    receiptBuilderResult.status === "evidence_plan_regeneration_request_receipt_builder_waiting_for_teacher_review" &&
    receiptBuilderResult.ok === true &&
    readyValidation.status === "evidence_plan_regeneration_request_reviewed_waiting_for_separate_manual_use" &&
    readyValidation.readyForManualRegenerationUse === true &&
    readyValidation.manualRegenerationUse?.format ===
      "transparent_ai_tlcl_next_route_evidence_plan_manual_input_contract_regeneration_use_v1" &&
    readyValidation.manualRegenerationUse?.executeNow === false &&
    readyValidation.manualRegenerationUse?.copyOnly === true &&
    readyValidation.manualRegenerationUse?.suggestedRegenerationCommand.includes("--attachment") &&
    readyValidation.manualRegenerationUse?.suggestedRegenerationCommand.includes("--rollback-point") &&
    readyValidation.locks?.validatorDoesNotRegenerateInputContract === true &&
    readyValidation.locks?.commandExecuted === false &&
    existsSync(receiptBuilderResult.htmlPath),
  evidence: JSON.stringify(readyValidation).slice(0, 700)
});

const forbiddenReceiptPath = join(smokeRoot, "forbidden-receipt.json");
writeJson(forbiddenReceiptPath, fillReceipt(receiptTemplate, "execute_now"));
const forbiddenValidation = runScript("validate-tlcl-next-route-evidence-plan-regeneration-request-receipt.mjs", [
  "--builder",
  builderPath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(smokeRoot, "forbidden-validation")
]);
checks.push({
  name: "Request receipt validation blocks execute-now decisions",
  pass:
    forbiddenValidation.status === "blocked_for_forbidden_regeneration_request_receipt_decision" &&
    forbiddenValidation.readyForManualRegenerationUse === false &&
    forbiddenValidation.manualRegenerationUse === null &&
    forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision") &&
    forbiddenValidation.locks?.validatorDoesNotRunCommand === true,
  evidence: JSON.stringify(forbiddenValidation).slice(0, 700)
});

const mismatchReceiptPath = join(smokeRoot, "mismatch-receipt.json");
const mismatchReceipt = fillReceipt(receiptTemplate);
mismatchReceipt.reviewedSuggestedRegenerationCommand = "node changed-command.mjs";
writeJson(mismatchReceiptPath, mismatchReceipt);
const mismatchValidation = runScript("validate-tlcl-next-route-evidence-plan-regeneration-request-receipt.mjs", [
  "--builder",
  builderPath,
  "--receipt",
  mismatchReceiptPath,
  "--out-dir",
  join(smokeRoot, "mismatch-validation")
]);
checks.push({
  name: "Request receipt validation blocks reviewed command mismatches",
  pass:
    mismatchValidation.status === "evidence_plan_regeneration_request_needs_teacher_review_or_more_evidence" &&
    mismatchValidation.readyForManualRegenerationUse === false &&
    mismatchValidation.manualRegenerationUse === null &&
    mismatchValidation.blockers.some((blocker) => blocker.code === "reviewed_regeneration_command_mismatch"),
  evidence: JSON.stringify(mismatchValidation).slice(0, 700)
});

const passed = checks.filter((check) => check.pass).length;
const result = {
  format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  smokeRoot,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
