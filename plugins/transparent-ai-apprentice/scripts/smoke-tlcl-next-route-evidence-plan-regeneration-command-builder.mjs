#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "tlcl-next-route-evidence-plan-regeneration-command-builder");

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

function plan(actionRows) {
  return {
    format: "transparent_ai_tlcl_next_route_evidence_acquisition_plan_v1",
    planId: "smoke-regeneration-command-builder-plan",
    status: "evidence_acquisition_plan_ready_for_teacher_review",
    routeId: "route_to_highest_reasoning_contract_repair",
    nextTool: "create_tlcl_next_route_input_contract",
    regenerationCommandTemplate:
      'node plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-next-route-input-contract.mjs --direction-console ".ta-smoke\\tlcl-direction-operational-console.json"',
    actionRows
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
      reviewerNote: "Smoke route keeps command building copy-only."
    }))
  };
}

rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });
const checks = [];

const readyPlanPath = join(smokeRoot, "ready-plan.json");
writeJson(
  readyPlanPath,
  plan([
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
  ])
);
const builderResult = runScript("create-tlcl-next-route-evidence-acquisition-plan-receipt-builder.mjs", [
  "--plan",
  readyPlanPath,
  "--out-dir",
  join(smokeRoot, "receipt-builder")
]);
const readyReceiptPath = join(smokeRoot, "ready-receipt.json");
writeJson(readyReceiptPath, fillReceipt(readJson(builderResult.receiptTemplatePath)));
const readyValidation = runScript("validate-tlcl-next-route-evidence-acquisition-plan-receipt.mjs", [
  "--plan",
  readyPlanPath,
  "--receipt",
  readyReceiptPath,
  "--out-dir",
  join(smokeRoot, "ready-validation")
]);
const readyCommandBuilder = runScript("create-tlcl-next-route-evidence-plan-regeneration-command-builder.mjs", [
  "--validation",
  readyValidation.validationPath,
  "--out-dir",
  join(smokeRoot, "ready-command-builder")
]);
const readyRequest = readJson(readyCommandBuilder.requestPath);
checks.push({
  name: "Command builder creates copy-only regeneration request from ready evidence receipt validation",
  pass:
    readyCommandBuilder.format === "transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_result_v1" &&
    readyCommandBuilder.status === "evidence_plan_regeneration_command_builder_waiting_for_teacher_copy" &&
    readyCommandBuilder.ok === true &&
    readyCommandBuilder.executeNow === false &&
    readyCommandBuilder.locks?.builderDoesNotRegenerateInputContract === true &&
    readyCommandBuilder.locks?.commandExecuted === false &&
    readyRequest.format === "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_v1" &&
    readyRequest.executeNow === false &&
    readyRequest.suggestedRegenerationCommand.includes("create-tlcl-next-route-input-contract.mjs") &&
    readyRequest.suggestedRegenerationCommand.includes("--attachment") &&
    readyRequest.suggestedRegenerationCommand.includes("--rollback-point") &&
    existsSync(readyCommandBuilder.htmlPath),
  evidence: JSON.stringify(readyCommandBuilder).slice(0, 700)
});

const forbiddenReceiptPath = join(smokeRoot, "forbidden-receipt.json");
writeJson(forbiddenReceiptPath, fillReceipt(readJson(builderResult.receiptTemplatePath), "execute_now"));
const forbiddenValidation = runScript("validate-tlcl-next-route-evidence-acquisition-plan-receipt.mjs", [
  "--plan",
  readyPlanPath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(smokeRoot, "forbidden-validation")
]);
const forbiddenCommandBuilder = runScript("create-tlcl-next-route-evidence-plan-regeneration-command-builder.mjs", [
  "--validation",
  forbiddenValidation.validationPath,
  "--out-dir",
  join(smokeRoot, "forbidden-command-builder")
]);
checks.push({
  name: "Command builder blocks forbidden evidence receipt validation before command copy",
  pass:
    forbiddenCommandBuilder.status === "blocked_before_evidence_plan_regeneration_command_builder" &&
    forbiddenCommandBuilder.ok === false &&
    forbiddenCommandBuilder.requestPath === "" &&
    forbiddenCommandBuilder.blockers.some((blocker) => blocker.code === "validation_status_not_ready") &&
    forbiddenCommandBuilder.locks?.builderDoesNotRunCommand === true,
  evidence: JSON.stringify(forbiddenCommandBuilder).slice(0, 700)
});

const noMissingPlanPath = join(smokeRoot, "no-missing-plan.json");
writeJson(noMissingPlanPath, plan([]));
const noMissingBuilderResult = runScript("create-tlcl-next-route-evidence-acquisition-plan-receipt-builder.mjs", [
  "--plan",
  noMissingPlanPath,
  "--out-dir",
  join(smokeRoot, "no-missing-receipt-builder")
]);
const noMissingReceiptPath = join(smokeRoot, "no-missing-receipt.json");
writeJson(noMissingReceiptPath, {
  ...readJson(noMissingBuilderResult.receiptTemplatePath),
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
const noMissingCommandBuilder = runScript("create-tlcl-next-route-evidence-plan-regeneration-command-builder.mjs", [
  "--validation",
  noMissingValidation.validationPath,
  "--out-dir",
  join(smokeRoot, "no-missing-command-builder")
]);
checks.push({
  name: "Command builder blocks no-missing-input acknowledgement from regeneration command copy",
  pass:
    noMissingCommandBuilder.status === "blocked_before_evidence_plan_regeneration_command_builder" &&
    noMissingCommandBuilder.ok === false &&
    noMissingCommandBuilder.requestPath === "" &&
    noMissingCommandBuilder.locks?.builderDoesNotRegenerateInputContract === true &&
    noMissingCommandBuilder.locks?.nextToolExecuted === false,
  evidence: JSON.stringify(noMissingCommandBuilder).slice(0, 700)
});

const passed = checks.filter((check) => check.pass).length;
const result = {
  format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  smokeRoot,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
