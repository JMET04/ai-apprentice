#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "tlcl-next-route-regenerated-input-contract-review-router");

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

function readyManualResultValidation() {
  const contractPath = join(smokeRoot, "regenerated-input-contract.json");
  writeJson(contractPath, {
    format: "transparent_ai_tlcl_next_route_input_contract_v1",
    contractId: "smoke-regenerated-input-contract",
    routeId: "route_to_highest_reasoning_contract_repair",
    nextTool: "create_tlcl_next_route_input_contract",
    status: "next_route_inputs_ready_for_teacher_reviewed_manual_use",
    readyForNextTool: true,
    missingInputs: [],
    requiredArtifacts: [
      {
        id: "reviewed_tlcl_rag_evidence_attachment",
        label: "Reviewed TLCL RAG evidence attachment",
        required: true,
        satisfied: true,
        path: join(smokeRoot, "reviewed-tlcl-rag-evidence-attachment.json")
      },
      {
        id: "rollback_point_retained",
        label: "Retained rollback point",
        required: true,
        satisfied: true,
        path: join(repoRoot, ".rollback-points", "smoke-retained-rollback")
      }
    ],
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
  });
  return {
    ok: true,
    format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_validation_v1",
    validationId: "smoke-manual-result-validation",
    status: "regeneration_manual_result_reviewed_waiting_for_next_route_contract_review",
    decision: "manual_regeneration_result_reviewed_ready_for_next_route_contract_review",
    readyForNextRouteContractReview: true,
    correctionToHighReasoningRepair: false,
    reviewedRegeneratedInputContract: {
      format: "transparent_ai_tlcl_next_route_reviewed_regenerated_input_contract_v1",
      sourceValidationId: "smoke-request-validation",
      routeId: "route_to_highest_reasoning_contract_repair",
      nextTool: "create_tlcl_next_route_input_contract",
      inputContractPath: contractPath,
      inputContractReadyForNextTool: true,
      status: "next_route_inputs_ready_for_teacher_reviewed_manual_use",
      resultEvidencePaths: [contractPath],
      confirmedRetainedRollbackPoint: join(repoRoot, ".rollback-points", "smoke-retained-rollback"),
      nextGate: "review_regenerated_input_contract_before_manual_next_route_use",
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    },
    highReasoningCorrectionHandoff: null,
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
      ruleEnabled: false,
      accepted: false,
      packagingUnlocked: false,
      goalComplete: false
    }
  };
}

function correctionManualResultValidation() {
  return {
    ...readyManualResultValidation(),
    validationId: "smoke-manual-result-correction-validation",
    status: "regeneration_manual_result_routes_to_high_reasoning_correction",
    decision: "correction_to_high_reasoning_repair",
    readyForNextRouteContractReview: false,
    correctionToHighReasoningRepair: true,
    reviewedRegeneratedInputContract: null,
    highReasoningCorrectionHandoff: {
      route: "high_reasoning_logic_contract_repair_after_regeneration_result",
      sourceValidationId: "smoke-request-validation",
      teacherNotes: "The regenerated input contract still misunderstands the data-to-output logic.",
      instruction: "Return to the high-reasoning compile layer."
    }
  };
}

function fillSelectionReceipt(template, route, decision = "route_selected_for_manual_preparation") {
  return {
    ...template,
    teacherDecision: decision,
    selectedRoute: route,
    selectedRouteReviewed: true,
    sourceValidationReviewed: true,
    resultEvidenceStillValid: true,
    retainedRollbackStillAvailable: true,
    teacherConfirmedNoExecution: true,
    blockedActionsConfirmed: true,
    teacherNotes:
      decision === "correction_to_high_reasoning_repair"
        ? "Teacher sends regenerated contract result back to high reasoning repair."
        : "Teacher selects the normal regenerated input-contract receipt gate."
  };
}

rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });
const checks = [];

const readyValidationPath = writeJson(join(smokeRoot, "ready-manual-result-validation.json"), readyManualResultValidation());
const readyRouterResult = runScript("create-tlcl-next-route-regenerated-input-contract-review-router.mjs", [
  "--validation",
  readyValidationPath,
  "--out-dir",
  join(smokeRoot, "ready-router")
]);
const readyTemplate = readJson(readyRouterResult.receiptTemplatePath);
const readyReceiptPath = writeJson(
  join(smokeRoot, "ready-selection-receipt.json"),
  fillSelectionReceipt(readyTemplate, "build_input_contract_receipt_for_regenerated_contract")
);
const readySelectionValidation = runScript("validate-tlcl-next-route-regenerated-input-contract-review-selection.mjs", [
  "--router",
  readyRouterResult.routerPath,
  "--receipt",
  readyReceiptPath,
  "--out-dir",
  join(smokeRoot, "ready-selection-validation")
]);
checks.push({
  name: "Reviewed regenerated input contract routes to normal input-contract receipt gate",
  pass:
    readyRouterResult.status === "regenerated_input_contract_review_router_waiting_for_teacher_selection" &&
    readyRouterResult.candidateRoutes.some((candidate) => candidate.route === "build_input_contract_receipt_for_regenerated_contract") &&
    readySelectionValidation.status === "regenerated_input_contract_review_selection_ready_for_manual_preparation" &&
    readySelectionValidation.readyForManualPreparation === true &&
    readySelectionValidation.manualPreparationHandoff?.nextTool === "create_tlcl_next_route_input_contract_receipt_builder" &&
    readySelectionValidation.manualPreparationHandoff?.executeNow === false &&
    readySelectionValidation.locks?.validatorDoesNotBuildInputContractReceipt === true &&
    existsSync(readyRouterResult.htmlPath),
  evidence: JSON.stringify(readySelectionValidation).slice(0, 700)
});

const forbiddenReceiptPath = writeJson(
  join(smokeRoot, "forbidden-selection-receipt.json"),
  fillSelectionReceipt(readyTemplate, "build_input_contract_receipt_for_regenerated_contract", "execute_now")
);
const forbiddenSelectionValidation = runScript("validate-tlcl-next-route-regenerated-input-contract-review-selection.mjs", [
  "--router",
  readyRouterResult.routerPath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(smokeRoot, "forbidden-selection-validation")
]);
checks.push({
  name: "Regenerated input contract review selection blocks execute-now decisions",
  pass:
    forbiddenSelectionValidation.status === "blocked_for_forbidden_regenerated_contract_review_selection" &&
    forbiddenSelectionValidation.readyForManualPreparation === false &&
    forbiddenSelectionValidation.manualPreparationHandoff === null &&
    forbiddenSelectionValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
  evidence: JSON.stringify(forbiddenSelectionValidation).slice(0, 700)
});

const correctionValidationPath = writeJson(join(smokeRoot, "correction-manual-result-validation.json"), correctionManualResultValidation());
const correctionRouterResult = runScript("create-tlcl-next-route-regenerated-input-contract-review-router.mjs", [
  "--validation",
  correctionValidationPath,
  "--out-dir",
  join(smokeRoot, "correction-router")
]);
const correctionTemplate = readJson(correctionRouterResult.receiptTemplatePath);
const correctionReceiptPath = writeJson(
  join(smokeRoot, "correction-selection-receipt.json"),
  fillSelectionReceipt(correctionTemplate, "send_regeneration_result_to_high_reasoning_contract_repair", "correction_to_high_reasoning_repair")
);
const correctionSelectionValidation = runScript("validate-tlcl-next-route-regenerated-input-contract-review-selection.mjs", [
  "--router",
  correctionRouterResult.routerPath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  join(smokeRoot, "correction-selection-validation")
]);
checks.push({
  name: "Regenerated input contract review can route correction back to high reasoning",
  pass:
    correctionRouterResult.candidateRoutes.some(
      (candidate) => candidate.route === "send_regeneration_result_to_high_reasoning_contract_repair"
    ) &&
    correctionSelectionValidation.status ===
      "regenerated_input_contract_review_selection_routes_to_high_reasoning_correction" &&
    correctionSelectionValidation.highReasoningCorrectionHandoff?.route ===
      "high_reasoning_logic_contract_repair_after_regenerated_contract_review" &&
    correctionSelectionValidation.locks?.modelInvoked === false,
  evidence: JSON.stringify(correctionSelectionValidation).slice(0, 700)
});

const passed = checks.filter((check) => check.pass).length;
const result = {
  format: "transparent_ai_tlcl_next_route_regenerated_input_contract_review_router_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  smokeRoot,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
