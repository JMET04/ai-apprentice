#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hashText(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  let parsed = null;
  let sourcePath = "";
  try {
    sourcePath = resolve(text);
    parsed = readJson(sourcePath);
  } catch {
    try {
      parsed = JSON.parse(text);
      sourcePath = "";
    } catch {
      parsed = null;
    }
  }
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return { value: parsed, path: sourcePath };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function locks() {
  return {
    reviewOnly: true,
    executionGateReceiptOnly: true,
    activeDeliveryGateReviewed: false,
    controlledExecutionRequestApproved: false,
    controlledExecutionRequestCreated: false,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    ruleEnabled: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const gateInput = readJsonInput(
  argValue("--delivery-gate", argValue("--gate", "")),
  "--delivery-gate",
  "transparent_ai_real_case_active_validation_report_delivery_gate_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-active-execution-gate-receipt-builders"))
);
const gate = gateInput.value;

if (
  gate.status !== "active_delivery_gate_closed_ready_for_teacher_execution_gate_review" ||
  gate.summary?.reportDeliveryAllowed !== true ||
  gate.summary?.gateAllowsExecution !== false ||
  gate.summary?.gateRequiresTeacherExecutionGate !== true ||
  gate.nextReview?.requiresSeparateExecutionGate !== true ||
  gate.decision?.mayOpenExecutionGateHere !== false ||
  gate.decision?.mayExecuteSoftware !== false ||
  gate.locks?.activeRulePackageCompiled !== true ||
  gate.locks?.activeValidationReportEvaluated !== true ||
  gate.locks?.deliveryGateOpen !== false ||
  gate.locks?.ruleEnabled !== false ||
  gate.locks?.targetSoftwareCommandsExecuted !== false ||
  gate.locks?.memoryWritten !== false ||
  gate.locks?.ragFetched !== false ||
  gate.locks?.packagingUnlocked !== false ||
  gate.locks?.requiresSeparateExecutionGate !== true
) {
  throw new Error("REAL_CASE_ACTIVE_EXECUTION_GATE_BUILDER_REQUIRES_CLOSED_ACTIVE_DELIVERY_GATE");
}
if (!gate.rollbackPoint || !existsSync(gate.rollbackPoint)) {
  throw new Error("REAL_CASE_ACTIVE_EXECUTION_GATE_BUILDER_REQUIRES_RETAINED_ROLLBACK_POINT");
}
if (!gate.compiledActiveRulePackagePath || !existsSync(gate.compiledActiveRulePackagePath)) {
  throw new Error("REAL_CASE_ACTIVE_EXECUTION_GATE_BUILDER_REQUIRES_ACTIVE_RULE_PACKAGE");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${gate.caseType || "real_case_active_execution_gate"}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "real-case-active-execution-gate-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "real-case-active-execution-gate-receipt-template.json");
const readmePath = join(builderDir, "REAL_CASE_ACTIVE_EXECUTION_GATE_REVIEW_START_HERE.md");
const htmlPath = join(builderDir, "real-case-active-execution-gate-review.html");
const gateHash = hashText(JSON.stringify(gate));
const builderLocks = locks();
const allowedTeacherDecisions = [
  "approve_controlled_execution_request",
  "request_high_reasoning_repair",
  "request_more_evidence",
  "blocked",
  "needs_teacher_review"
];
const forbiddenTeacherDecisions = [
  "execute_now",
  "execute_software",
  "send_ui_events",
  "enable_rule",
  "write_memory",
  "fetch_rag",
  "unlock_packaging",
  "accepted",
  "claim_complete",
  "package_release"
];

const receiptTemplate = {
  format: "transparent_ai_real_case_active_execution_gate_receipt_v1",
  sourceDeliveryGateId: gate.gateId,
  sourceDeliveryGatePath: gateInput.path,
  sourceDeliveryGateHash: gateHash,
  sourceValidationReportPath: gate.validationReportPath,
  sourceCompiledActiveRulePackagePath: gate.compiledActiveRulePackagePath,
  activeRuleCount: gate.activeRuleCount,
  rollbackPoint: gate.rollbackPoint,
  caseType: gate.caseType || "",
  teacherDecision: "needs_teacher_review",
  deliveryGateReviewed: false,
  validationReportReviewed: false,
  activeRulePackageReviewed: false,
  warningEvidenceReviewed: false,
  rollbackRetained: false,
  executionScopeReviewed: false,
  controlledExecutionOnlyConfirmed: false,
  separateRunnerRequiredConfirmed: false,
  teacherConfirmedNoImmediateExecution: false,
  blockedTransitionsConfirmed: true,
  executionScope: {
    targetSoftware: "",
    operationSummary: "",
    allowedControlChannel: "manual_or_existing_adapter_after_separate_runner_gate",
    allowedArtifacts: [],
    forbiddenActions: ["native_unbounded_control", "background_autonomy", "unreviewed_file_write", "packaging_unlock"]
  },
  teacherNotes: "",
  allowedTeacherDecisions,
  forbiddenTeacherDecisions,
  executeNow: false,
  reviewOnly: true,
  locks: builderLocks
};

const builder = {
  ok: true,
  format: "transparent_ai_real_case_active_execution_gate_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  status: "ready_for_teacher_real_case_active_execution_gate_review",
  sourceDeliveryGateId: gate.gateId,
  sourceDeliveryGatePath: gateInput.path,
  sourceDeliveryGateHash: gateHash,
  allowedTeacherDecisions,
  forbiddenTeacherDecisions,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-real-case-active-execution-gate-receipt.mjs --delivery-gate "' +
    (gateInput.path || "<real-case-active-delivery-gate.json>") +
    '" --receipt "<teacher-filled-real-case-active-execution-gate-receipt.json>"',
  locks: builderLocks,
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  }
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# Real-Case Active Execution Gate Review",
    "",
    "This is the teacher checkpoint after a closed active delivery gate. It may approve only a controlled execution request for a later separate runner.",
    "",
    "It does not execute software, enable rules, write memory, fetch RAG, unlock packaging, accept technology, or claim completion.",
    "",
    `Receipt template: ${receiptTemplatePath}`,
    `Next validator: ${builder.nextValidationCommand}`,
    ""
  ].join("\n"),
  "utf8"
);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Real-Case Active Execution Gate Review</title></head>
<body>
<h1>Real-Case Active Execution Gate Review</h1>
<p>Approve only a controlled execution request. This page does not run software.</p>
<pre>${JSON.stringify(receiptTemplate, null, 2)}</pre>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_case_active_execution_gate_receipt_builder_result_v1",
      status: builder.status,
      builderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      executeNow: false,
      locks: builderLocks
    },
    null,
    2
  )
);
