#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "tlcl-next-route-evidence-plan-regeneration-manual-result-receipt");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function runScript(script, args) {
  const stdout = execFileSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return JSON.parse(stdout);
}

function sourceValidation() {
  return {
    ok: true,
    format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_validation_v1",
    validationId: "smoke-regeneration-request-receipt-validation",
    status: "evidence_plan_regeneration_request_reviewed_waiting_for_separate_manual_use",
    decision: "teacher_reviewed_regeneration_request_ready_for_manual_use",
    readyForManualRegenerationUse: true,
    manualRegenerationUse: {
      format: "transparent_ai_tlcl_next_route_evidence_plan_manual_input_contract_regeneration_use_v1",
      routeId: "route_to_highest_reasoning_contract_repair",
      nextTool: "create_tlcl_next_route_input_contract",
      suggestedRegenerationCommand:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-next-route-input-contract.mjs --attachment ".ta-smoke\\reviewed-tlcl-rag-evidence-attachment.json" --rollback-point ".rollback-points\\smoke-retained-rollback"',
      evidenceRowsUsed: [
        {
          missingInputId: "reviewed_tlcl_rag_evidence_attachment",
          suppliedValueForInputContract: join(smokeRoot, "reviewed-tlcl-rag-evidence-attachment.json")
        },
        {
          missingInputId: "rollback_point_retained",
          suppliedValueForInputContract: join(repoRoot, ".rollback-points", "smoke-retained-rollback")
        }
      ],
      confirmedRetainedRollbackPoint: join(repoRoot, ".rollback-points", "smoke-retained-rollback"),
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    },
    locks: {
      reviewOnly: true,
      validationOnly: true,
      validatorDoesNotRegenerateInputContract: true,
      validatorDoesNotRunCommand: true,
      validatorDoesNotRunNextTool: true,
      validatorDoesNotInvokeModel: true,
      validatorDoesNotFetchRag: true,
      validatorDoesNotWriteMemory: true,
      validatorDoesNotEnableRule: true,
      validatorDoesNotUnlockPackaging: true,
      inputContractRegenerated: false,
      commandExecuted: false,
      nextToolExecuted: false,
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

function regeneratedContract(readyForNextTool = true) {
  return {
    format: "transparent_ai_tlcl_next_route_input_contract_v1",
    contractId: "smoke-regenerated-input-contract",
    routeId: "route_to_highest_reasoning_contract_repair",
    nextTool: "create_tlcl_next_route_input_contract",
    status: readyForNextTool ? "next_route_inputs_ready_for_teacher_reviewed_manual_use" : "next_route_inputs_missing_required_evidence",
    readyForNextTool,
    missingInputs: readyForNextTool ? [] : [{ id: "reviewed_tlcl_rag_evidence_attachment" }],
    locks: {
      reviewOnly: true,
      inputContractOnly: true,
      modelInvoked: false,
      ragFetched: false,
      nextToolExecuted: false,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      ruleEnabled: false,
      accepted: false,
      packagingUnlocked: false,
      goalComplete: false
    }
  };
}

function fillReceipt(template, contractPath, decision = "manual_regeneration_result_reviewed_ready_for_next_route_contract_review") {
  return {
    ...template,
    teacherDecision: decision,
    manualRegenerationWasSeparate: true,
    regeneratedInputContractPath: contractPath,
    regeneratedInputContractReviewed: true,
    regeneratedInputContractReadyForNextTool: true,
    resultEvidenceReviewed: true,
    resultEvidencePaths: [contractPath],
    blockedActionsConfirmed: true,
    teacherNotes:
      decision === "correction_to_high_reasoning_repair"
        ? "Teacher routes the regeneration result back to high reasoning repair."
        : "Smoke teacher reviewed the regenerated input contract."
  };
}

rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });
const checks = [];

const validationPath = writeJson(join(smokeRoot, "request-receipt-validation.json"), sourceValidation());
const builderResult = runScript("create-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-builder.mjs", [
  "--validation",
  validationPath,
  "--out-dir",
  join(smokeRoot, "builder")
]);
const receiptTemplate = readJson(builderResult.receiptTemplatePath);
const readyContractPath = writeJson(join(smokeRoot, "ready-regenerated-input-contract.json"), regeneratedContract(true));
const readyReceiptPath = writeJson(join(smokeRoot, "ready-receipt.json"), fillReceipt(receiptTemplate, readyContractPath));
const readyValidation = runScript("validate-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt.mjs", [
  "--validation",
  validationPath,
  "--receipt",
  readyReceiptPath,
  "--out-dir",
  join(smokeRoot, "ready-validation")
]);
checks.push({
  name: "Manual regeneration result receipt validates reviewed ready input contract",
  pass:
    builderResult.status === "evidence_plan_regeneration_manual_result_receipt_builder_waiting_for_teacher_result_evidence" &&
    builderResult.ok === true &&
    readyValidation.status === "regeneration_manual_result_reviewed_waiting_for_next_route_contract_review" &&
    readyValidation.readyForNextRouteContractReview === true &&
    readyValidation.reviewedRegeneratedInputContract?.format ===
      "transparent_ai_tlcl_next_route_reviewed_regenerated_input_contract_v1" &&
    readyValidation.reviewedRegeneratedInputContract?.inputContractReadyForNextTool === true &&
    readyValidation.reviewedRegeneratedInputContract?.executeNow === false &&
    readyValidation.locks?.validatorDoesNotRegenerateInputContract === true &&
    readyValidation.locks?.commandExecuted === false &&
    existsSync(builderResult.htmlPath),
  evidence: JSON.stringify(readyValidation).slice(0, 700)
});

const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-receipt.json"), fillReceipt(receiptTemplate, readyContractPath, "execute_now"));
const forbiddenValidation = runScript("validate-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt.mjs", [
  "--validation",
  validationPath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(smokeRoot, "forbidden-validation")
]);
checks.push({
  name: "Manual regeneration result receipt blocks execute-now decisions",
  pass:
    forbiddenValidation.status === "blocked_for_forbidden_regeneration_manual_result_decision" &&
    forbiddenValidation.readyForNextRouteContractReview === false &&
    forbiddenValidation.reviewedRegeneratedInputContract === null &&
    forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
  evidence: JSON.stringify(forbiddenValidation).slice(0, 700)
});

const missingReceiptPath = writeJson(join(smokeRoot, "missing-contract-receipt.json"), fillReceipt(receiptTemplate, join(smokeRoot, "missing.json")));
const missingValidation = runScript("validate-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt.mjs", [
  "--validation",
  validationPath,
  "--receipt",
  missingReceiptPath,
  "--out-dir",
  join(smokeRoot, "missing-validation")
]);
checks.push({
  name: "Manual regeneration result receipt requires regenerated input contract path",
  pass:
    missingValidation.status === "regeneration_manual_result_needs_teacher_review_or_more_evidence" &&
    missingValidation.readyForNextRouteContractReview === false &&
    missingValidation.blockers.some((blocker) => blocker.code === "regenerated_input_contract_path_not_found"),
  evidence: JSON.stringify(missingValidation).slice(0, 700)
});

const notReadyContractPath = writeJson(join(smokeRoot, "not-ready-regenerated-input-contract.json"), regeneratedContract(false));
const notReadyReceiptPath = writeJson(join(smokeRoot, "not-ready-receipt.json"), fillReceipt(receiptTemplate, notReadyContractPath));
const notReadyValidation = runScript("validate-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt.mjs", [
  "--validation",
  validationPath,
  "--receipt",
  notReadyReceiptPath,
  "--out-dir",
  join(smokeRoot, "not-ready-validation")
]);
checks.push({
  name: "Manual regeneration result receipt blocks not-ready regenerated contracts",
  pass:
    notReadyValidation.status === "regeneration_manual_result_needs_teacher_review_or_more_evidence" &&
    notReadyValidation.readyForNextRouteContractReview === false &&
    notReadyValidation.blockers.some((blocker) => blocker.code === "regenerated_input_contract_not_ready_for_next_tool"),
  evidence: JSON.stringify(notReadyValidation).slice(0, 700)
});

const passed = checks.filter((check) => check.pass).length;
const result = {
  format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  smokeRoot,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
