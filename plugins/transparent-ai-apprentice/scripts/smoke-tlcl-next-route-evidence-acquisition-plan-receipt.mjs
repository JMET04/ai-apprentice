#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "tlcl-next-route-evidence-plan-receipt");

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

function basePlan(overrides = {}) {
  return {
    format: "transparent_ai_tlcl_next_route_evidence_acquisition_plan_v1",
    planId: "smoke-evidence-plan",
    status: "evidence_acquisition_plan_ready_for_teacher_review",
    routeId: "route_to_highest_reasoning_contract_repair",
    nextTool: "create_tlcl_next_route_input_contract",
    regenerationCommandTemplate:
      'node plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-next-route-input-contract.mjs --direction-console ".ta-smoke\\tlcl-direction-operational-console.json"',
    actionRows: [
      {
        missingInputId: "reviewed_tlcl_rag_evidence_attachment",
        label: "Reviewed TLCL RAG evidence attachment",
        purpose: "Provide evidence-only RAG context for high-reasoning repair.",
        requiredEvidence: ["reviewed attachment path"],
        existingToolsToReuse: ["create-tlcl-rag-evidence-attachment.mjs"]
      },
      {
        missingInputId: "rollback_point_retained",
        label: "Retained rollback point",
        purpose: "Keep a rollback point before high-reasoning repair.",
        requiredEvidence: ["rollback manifest path"],
        existingToolsToReuse: ["confirm-rollback-point.mjs"]
      }
    ],
    ...overrides
  };
}

function fillReceipt(template, decision = "provide_evidence_for_input_contract_regeneration") {
  return {
    ...template,
    teacherDecision: decision,
    blockedShortcutsReviewed: true,
    ragEvidenceOnlyConfirmed: true,
    rollbackRetained: true,
    evidenceRows: (template.evidenceRows || []).map((row) => ({
      ...row,
      teacherReviewed: true,
      boundaryReviewed: true,
      suppliedValueForInputContract:
        row.missingInputId === "reviewed_tlcl_rag_evidence_attachment"
          ? join(smokeRoot, "reviewed-tlcl-rag-evidence-attachment.json")
          : row.missingInputId === "rollback_point_retained"
            ? join(repoRoot, ".rollback-points", "smoke-retained-rollback")
            : "teacher-reviewed-value",
      suppliedEvidenceSummary: "Teacher-reviewed smoke evidence.",
      reviewerNote: "Smoke route keeps RAG evidence-only and execution locked."
    }))
  };
}

rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });

const checks = [];

const repairPlanPath = join(smokeRoot, "repair-plan.json");
writeJson(repairPlanPath, basePlan());
const builderResult = runScript("create-tlcl-next-route-evidence-acquisition-plan-receipt-builder.mjs", [
  "--plan",
  repairPlanPath,
  "--out-dir",
  join(smokeRoot, "builder")
]);
const template = readJson(builderResult.receiptTemplatePath);
const readyReceiptPath = join(smokeRoot, "teacher-ready-receipt.json");
writeJson(readyReceiptPath, fillReceipt(template));
const readyValidation = runScript("validate-tlcl-next-route-evidence-acquisition-plan-receipt.mjs", [
  "--plan",
  repairPlanPath,
  "--receipt",
  readyReceiptPath,
  "--out-dir",
  join(smokeRoot, "ready-validation")
]);
checks.push({
  name: "Receipt builder creates teacher-fillable evidence plan receipt",
  pass:
    builderResult.format === "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_builder_result_v1" &&
    builderResult.status === "evidence_acquisition_plan_receipt_builder_ready_for_teacher_use" &&
    builderResult.actionRowCount === 2 &&
    builderResult.locks?.doesNotRunNextTool === true &&
    builderResult.locks?.modelInvoked === false &&
    template.format === "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_v1" &&
    template.blockedTeacherDecisions.includes("execute_now") &&
    existsSync(builderResult.receiptTemplatePath),
  evidence: JSON.stringify(builderResult).slice(0, 700)
});
checks.push({
  name: "Validator prepares input-contract regeneration handoff from reviewed evidence",
  pass:
    readyValidation.format === "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_validation_result_v1" &&
    readyValidation.status === "evidence_plan_receipt_ready_for_input_contract_regeneration" &&
    readyValidation.readyForInputContractRegeneration === true &&
    readyValidation.regenerationHandoff?.executeNow === false &&
    readyValidation.regenerationHandoff?.suggestedRegenerationCommand.includes("--attachment") &&
    readyValidation.regenerationHandoff?.suggestedRegenerationCommand.includes("--rollback-point") &&
    readyValidation.locks?.doesNotRegenerateInputContract === true &&
    readyValidation.locks?.ragFetched === false &&
    readyValidation.locks?.modelInvoked === false,
  evidence: JSON.stringify(readyValidation).slice(0, 700)
});

const forbiddenReceiptPath = join(smokeRoot, "teacher-forbidden-receipt.json");
writeJson(forbiddenReceiptPath, fillReceipt(template, "execute_now"));
const forbiddenValidation = runScript("validate-tlcl-next-route-evidence-acquisition-plan-receipt.mjs", [
  "--plan",
  repairPlanPath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(smokeRoot, "forbidden-validation")
]);
checks.push({
  name: "Validator fails closed on forbidden execute decisions",
  pass:
    forbiddenValidation.status === "blocked_for_forbidden_decision" &&
    forbiddenValidation.forbiddenDecisionUsed === true &&
    forbiddenValidation.executeNow === false &&
    forbiddenValidation.locks?.doesNotRunNextTool === true &&
    forbiddenValidation.locks?.targetSoftwareCommandsExecuted === false,
  evidence: JSON.stringify(forbiddenValidation).slice(0, 700)
});

const noMissingPlanPath = join(smokeRoot, "no-missing-plan.json");
writeJson(noMissingPlanPath, basePlan({ planId: "smoke-no-missing-plan", actionRows: [] }));
const noMissingBuilder = runScript("create-tlcl-next-route-evidence-acquisition-plan-receipt-builder.mjs", [
  "--plan",
  noMissingPlanPath,
  "--out-dir",
  join(smokeRoot, "no-missing-builder")
]);
const noMissingTemplate = readJson(noMissingBuilder.receiptTemplatePath);
const noMissingReceiptPath = join(smokeRoot, "teacher-no-missing-receipt.json");
writeJson(noMissingReceiptPath, {
  ...noMissingTemplate,
  teacherDecision: "acknowledge_no_missing_inputs",
  blockedShortcutsReviewed: true,
  ragEvidenceOnlyConfirmed: false,
  rollbackRetained: false,
  evidenceRows: []
});
const noMissingValidation = runScript("validate-tlcl-next-route-evidence-acquisition-plan-receipt.mjs", [
  "--plan",
  noMissingPlanPath,
  "--receipt",
  noMissingReceiptPath,
  "--out-dir",
  join(smokeRoot, "no-missing-validation")
]);
checks.push({
  name: "Validator acknowledges no missing inputs without executing next tool",
  pass:
    noMissingValidation.status === "evidence_plan_receipt_acknowledges_no_missing_inputs" &&
    noMissingValidation.acknowledgedNoMissingInputs === true &&
    noMissingValidation.executeNow === false &&
    noMissingValidation.regenerationHandoff === null &&
    noMissingValidation.locks?.doesNotRunNextTool === true,
  evidence: JSON.stringify(noMissingValidation).slice(0, 700)
});

const passed = checks.filter((check) => check.pass).length;
const result = {
  format: "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  smokeRoot,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
