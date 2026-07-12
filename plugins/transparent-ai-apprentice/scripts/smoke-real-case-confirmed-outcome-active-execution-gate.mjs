#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const deliverySmokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-active-validation-report-delivery-gate");
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-active-execution-gate");
mkdirSync(smokeRoot, { recursive: true });
const expectedSourceReviewFormat = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function runNode(args, { expectOk = true } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (expectOk && result.status !== 0) throw new Error(result.stderr || result.stdout || args.join(" "));
  if (!expectOk && result.status === 0) throw new Error(`Expected failure: ${args.join(" ")}`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function findFiles(rootDir, fileName) {
  const output = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!existsSync(current)) continue;
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) stack.push(join(current, entry));
    } else if (current.endsWith(fileName)) {
      output.push(current);
    }
  }
  output.sort();
  return output;
}

function latestFile(rootDir, fileName) {
  const files = findFiles(rootDir, fileName);
  if (!files.length) throw new Error(`Missing ${fileName} under ${rootDir}`);
  files.sort((left, right) => statSync(left).mtimeMs - statSync(right).mtimeMs || left.localeCompare(right));
  return files[files.length - 1];
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const deliverySmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs"]).stdout
);
const gatePath = latestFile(join(deliverySmokeRoot, "valid-gate"), "real-case-confirmed-outcome-active-validation-report-delivery-gate.json");
const deliveryGate = readJson(gatePath);
const builderResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-execution-gate-receipt-builder.mjs",
    "--delivery-gate",
    gatePath,
    "--out-dir",
    join(smokeRoot, "builder")
  ]).stdout
);
const template = readJson(builderResult.receiptTemplatePath);
check(
  "Real-case confirmed outcome active execution gate receipt builder prepares no-execution teacher review",
  builderResult.format === "transparent_ai_real_case_confirmed_outcome_active_execution_gate_receipt_builder_result_v1" &&
    builderResult.status === "ready_for_teacher_real_case_confirmed_outcome_active_execution_gate_review" &&
    builderResult.confirmedOutcomeBranch === true &&
    builderResult.sourceReviewFormat === expectedSourceReviewFormat &&
    builderResult.sourceConfirmedOutcomeReviewId === deliveryGate.sourceConfirmedOutcomeReviewId &&
    builderResult.sourceConfirmedOutcomeSourceRunId === deliveryGate.sourceConfirmedOutcomeSourceRunId &&
    builderResult.sourceRunId === deliveryGate.sourceRunId &&
    builderResult.executeNow === false &&
    builderResult.locks?.targetSoftwareCommandsExecuted === false &&
    builderResult.locks?.controlledExecutionRequestCreated === false &&
    template.teacherDecision === "needs_teacher_review" &&
    template.confirmedOutcomeBranch === true &&
    template.sourceReviewFormat === expectedSourceReviewFormat &&
    template.sourceConfirmedOutcomeReviewId === deliveryGate.sourceConfirmedOutcomeReviewId &&
    template.sourceConfirmedOutcomeSourceRunId === deliveryGate.sourceConfirmedOutcomeSourceRunId &&
    template.sourceRunId === deliveryGate.sourceRunId &&
    template.executeNow === false &&
    template.locks?.executionGateReceiptOnly === true,
  JSON.stringify({ receiptTemplatePath: builderResult.receiptTemplatePath })
);

const approvedReceiptPath = writeJson(join(smokeRoot, "approved-execution-gate-receipt.json"), {
  ...template,
  teacherDecision: "approve_controlled_execution_request",
  deliveryGateReviewed: true,
  validationReportReviewed: true,
  activeRulePackageReviewed: true,
  warningEvidenceReviewed: true,
  rollbackRetained: true,
  executionScopeReviewed: true,
  controlledExecutionOnlyConfirmed: true,
  separateRunnerRequiredConfirmed: true,
  teacherConfirmedNoImmediateExecution: true,
  blockedTransitionsConfirmed: true,
  executionScope: {
    ...template.executionScope,
    targetSoftware: "draw.io",
    operationSummary: "Create a controlled packaging dieline update from the reviewed active rule package.",
    allowedControlChannel: "manual_or_existing_adapter_after_separate_runner_gate",
    allowedArtifacts: ["validated_packaging_dieline_artifact"]
  },
  teacherNotes: "Approve a controlled request only; do not run it here."
});
const approvedResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-active-execution-gate-receipt.mjs",
    "--delivery-gate",
    gatePath,
    "--receipt",
    approvedReceiptPath,
    "--out-dir",
    join(smokeRoot, "approved-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome active execution gate validates controlled execution request without running",
  approvedResult.format === "transparent_ai_real_case_confirmed_outcome_active_execution_gate_validation_result_v1" &&
    approvedResult.status === "real_case_confirmed_outcome_active_execution_gate_ready_for_controlled_execution_request" &&
    approvedResult.readyForControlledExecutionRequest === true &&
    approvedResult.confirmedOutcomeBranch === true &&
    approvedResult.sourceReviewFormat === expectedSourceReviewFormat &&
    approvedResult.sourceConfirmedOutcomeReviewId === deliveryGate.sourceConfirmedOutcomeReviewId &&
    approvedResult.sourceConfirmedOutcomeSourceRunId === deliveryGate.sourceConfirmedOutcomeSourceRunId &&
    approvedResult.sourceRunId === deliveryGate.sourceRunId &&
    approvedResult.controlledExecutionRequest?.format === "transparent_ai_real_case_controlled_execution_request_v1" &&
    approvedResult.controlledExecutionRequest?.sourceReviewFormat === expectedSourceReviewFormat &&
    approvedResult.controlledExecutionRequest?.sourceConfirmedOutcomeReviewId === deliveryGate.sourceConfirmedOutcomeReviewId &&
    approvedResult.controlledExecutionRequest?.sourceConfirmedOutcomeSourceRunId === deliveryGate.sourceConfirmedOutcomeSourceRunId &&
    approvedResult.controlledExecutionRequest?.sourceRunId === deliveryGate.sourceRunId &&
    approvedResult.controlledExecutionRequest?.executeNow === false &&
    approvedResult.controlledExecutionRequest?.requiresSeparateControlledRunner === true &&
    approvedResult.locks?.controlledExecutionRequestApproved === true &&
    approvedResult.locks?.targetSoftwareCommandsExecuted === false &&
    approvedResult.locks?.ruleEnabled === false &&
    approvedResult.locks?.memoryWritten === false &&
    approvedResult.locks?.ragFetched === false &&
    approvedResult.locks?.packagingUnlocked === false,
  JSON.stringify({ validationPath: approvedResult.validationPath })
);

const sourceTamperReceiptPath = writeJson(join(smokeRoot, "source-tamper-execution-gate-receipt.json"), {
  ...readJson(approvedReceiptPath),
  sourceReviewFormat: "transparent_ai_real_case_unconfirmed_outcome_review_v1",
  sourceConfirmedOutcomeSourceRunId: "tampered-source-run-id",
  sourceRunId: "tampered-current-source-run-id"
});
const sourceTamperResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-active-execution-gate-receipt.mjs",
    "--delivery-gate",
    gatePath,
    "--receipt",
    sourceTamperReceiptPath,
    "--out-dir",
    join(smokeRoot, "source-tamper-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome active execution gate blocks lost confirmed-outcome source continuity",
  sourceTamperResult.status === "real_case_confirmed_outcome_active_execution_gate_needs_teacher_review" &&
    sourceTamperResult.readyForControlledExecutionRequest === false &&
    sourceTamperResult.blockers.some((row) => row.code === "receipt_source_review_format_mismatch") &&
    sourceTamperResult.blockers.some((row) => row.code === "receipt_source_confirmed_outcome_source_run_id_mismatch") &&
    sourceTamperResult.blockers.some((row) => row.code === "receipt_source_run_id_mismatch") &&
    sourceTamperResult.locks?.targetSoftwareCommandsExecuted === false,
  JSON.stringify({ blockers: sourceTamperResult.blockers })
);

const missingSourceRunGatePath = writeJson(join(smokeRoot, "missing-source-run-delivery-gate.json"), {
  ...deliveryGate,
  sourceConfirmedOutcomeSourceRunId: ""
});
const missingSourceRunBuilder = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-execution-gate-receipt-builder.mjs",
    "--delivery-gate",
    missingSourceRunGatePath,
    "--out-dir",
    join(smokeRoot, "missing-source-run-builder")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active execution gate builder blocks missing source run continuity",
  missingSourceRunBuilder.stderr.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_EXECUTION_GATE_SOURCE_IDS_MISSING") ||
    missingSourceRunBuilder.stdout.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_EXECUTION_GATE_SOURCE_IDS_MISSING"),
  missingSourceRunBuilder.stderr || missingSourceRunBuilder.stdout
);

const missingCurrentSourceRunGatePath = writeJson(join(smokeRoot, "missing-current-source-run-delivery-gate.json"), {
  ...deliveryGate,
  sourceRunId: ""
});
const missingCurrentSourceRunBuilder = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-execution-gate-receipt-builder.mjs",
    "--delivery-gate",
    missingCurrentSourceRunGatePath,
    "--out-dir",
    join(smokeRoot, "missing-current-source-run-builder")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active execution gate builder blocks missing current sourceRunId",
  missingCurrentSourceRunBuilder.stderr.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_EXECUTION_GATE_SOURCE_IDS_MISSING") ||
    missingCurrentSourceRunBuilder.stdout.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_EXECUTION_GATE_SOURCE_IDS_MISSING"),
  missingCurrentSourceRunBuilder.stderr || missingCurrentSourceRunBuilder.stdout
);

const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-execute-now-receipt.json"), {
  ...template,
  teacherDecision: "execute_now",
  executeNow: true,
  blockedTransitionsConfirmed: true
});
const forbiddenResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-active-execution-gate-receipt.mjs",
    "--delivery-gate",
    gatePath,
    "--receipt",
    forbiddenReceiptPath,
    "--out-dir",
    join(smokeRoot, "forbidden-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome active execution gate blocks execute-now decisions",
  forbiddenResult.status === "blocked_for_forbidden_real_case_confirmed_outcome_active_execution_gate_decision" &&
    forbiddenResult.readyForControlledExecutionRequest === false &&
    forbiddenResult.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenResult.locks?.targetSoftwareCommandsExecuted === false,
  JSON.stringify({ blockers: forbiddenResult.blockers })
);

const missingScopeReceiptPath = writeJson(join(smokeRoot, "missing-scope-receipt.json"), {
  ...template,
  teacherDecision: "approve_controlled_execution_request",
  deliveryGateReviewed: true,
  validationReportReviewed: true,
  activeRulePackageReviewed: true,
  warningEvidenceReviewed: true,
  rollbackRetained: true,
  executionScopeReviewed: true,
  controlledExecutionOnlyConfirmed: true,
  separateRunnerRequiredConfirmed: true,
  teacherConfirmedNoImmediateExecution: true,
  blockedTransitionsConfirmed: true
});
const missingScopeResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-active-execution-gate-receipt.mjs",
    "--delivery-gate",
    gatePath,
    "--receipt",
    missingScopeReceiptPath,
    "--out-dir",
    join(smokeRoot, "missing-scope-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome active execution gate requires explicit execution scope",
  missingScopeResult.status === "real_case_confirmed_outcome_active_execution_gate_needs_teacher_review" &&
    missingScopeResult.readyForControlledExecutionRequest === false &&
    missingScopeResult.blockers.some((row) => row.code === "execution_scope_operation_missing") &&
    missingScopeResult.blockers.some((row) => row.code === "execution_scope_target_software_missing"),
  JSON.stringify({ blockers: missingScopeResult.blockers })
);

const repairReceiptPath = writeJson(join(smokeRoot, "repair-receipt.json"), {
  ...template,
  teacherDecision: "request_high_reasoning_repair",
  teacherNotes: "The execution scope is too broad; repair the contract before any runner.",
  blockedTransitionsConfirmed: true
});
const repairResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-active-execution-gate-receipt.mjs",
    "--delivery-gate",
    gatePath,
    "--receipt",
    repairReceiptPath,
    "--out-dir",
    join(smokeRoot, "repair-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome active execution gate routes teacher corrections to high-reasoning repair",
  repairResult.status === "real_case_confirmed_outcome_active_execution_gate_routes_to_high_reasoning_repair" &&
    repairResult.highReasoningRepairHandoff?.format ===
      "transparent_ai_real_case_confirmed_outcome_active_execution_gate_high_reasoning_repair_handoff_v1" &&
    repairResult.highReasoningRepairHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    repairResult.highReasoningRepairHandoff?.sourceConfirmedOutcomeReviewId === deliveryGate.sourceConfirmedOutcomeReviewId &&
    repairResult.highReasoningRepairHandoff?.sourceConfirmedOutcomeSourceRunId ===
      deliveryGate.sourceConfirmedOutcomeSourceRunId &&
    repairResult.highReasoningRepairHandoff?.sourceRunId === deliveryGate.sourceRunId &&
    repairResult.highReasoningRepairHandoff?.executeNow === false,
  JSON.stringify({ highReasoningRepairHandoff: repairResult.highReasoningRepairHandoff })
);

const tamperedReceiptPath = writeJson(join(smokeRoot, "tampered-hash-receipt.json"), {
  ...readJson(approvedReceiptPath),
  sourceDeliveryGateHash: "sha256:tampered"
});
const tamperedResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-active-execution-gate-receipt.mjs",
    "--delivery-gate",
    gatePath,
    "--receipt",
    tamperedReceiptPath,
    "--out-dir",
    join(smokeRoot, "tampered-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome active execution gate rejects tampered delivery gate hash",
  tamperedResult.status === "real_case_confirmed_outcome_active_execution_gate_needs_teacher_review" &&
    tamperedResult.readyForControlledExecutionRequest === false &&
    tamperedResult.blockers.some((row) => row.code === "source_delivery_gate_hash_mismatch"),
  JSON.stringify({ blockers: tamperedResult.blockers })
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_active_execution_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  deliverySmokeStatus: deliverySmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
