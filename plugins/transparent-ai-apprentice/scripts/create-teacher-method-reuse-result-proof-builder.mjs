#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readOptionalJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(value) {
  return (
    String(value || "teacher-method-reuse-result-proof-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84) || "teacher-method-reuse-result-proof-builder"
  );
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    if (value === true) parts.push(flag);
    else parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    receiptBuilderOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotRunCommands: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRules: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    highReasoningRepairTriggered: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function nonPlaceholder(value) {
  const text = String(value || "").trim();
  return text && !text.includes("<") && !text.includes("__");
}

function writeReadme(path, builder) {
  const lines = [
    "# Teacher Method Reuse Result Proof Builder",
    "",
    `Status: ${builder.status}`,
    `Contract receipt validation: ${builder.sourceEvidence.contractReceiptValidation || ""}`,
    "",
    "This builder prepares the teacher-filled receipt that proves whether the confirmed teaching method actually improved one later reuse run.",
    "It is review-only: it does not run software, read logs, capture screenshots, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Next validation command:",
    "",
    "```powershell",
    builder.nextValidationCommand,
    "```"
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder, receiptTemplate) {
  const rows = receiptTemplate.evidenceRows
    .map(
      (row) => `<tr><td>${htmlEscape(row.id)}</td><td>${htmlEscape(row.required)}</td><td>${htmlEscape(row.teacherField)}</td></tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Teacher Method Reuse Result Proof</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; line-height: 1.45; color: #172033; }
    main { max-width: 980px; margin: 0 auto; }
    code, pre { background: #f3f5f7; padding: 2px 4px; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #d8dee8; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #eef3f8; }
    .lock { color: #8a3b00; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>Teacher Method Reuse Result Proof</h1>
    <p>Status: <code>${htmlEscape(builder.status)}</code></p>
    <p class="lock">This page only prepares teacher review. It does not execute target software, write memory, enable rules, unlock packaging, or claim the goal complete.</p>
    <p>Receipt template: <a href="${htmlEscape(fileHref(builder.paths.receiptTemplate))}">${htmlEscape(builder.paths.receiptTemplate)}</a></p>
    <table>
      <thead><tr><th>Evidence</th><th>Required</th><th>Receipt Field</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Validation command</h2>
    <pre>${htmlEscape(builder.nextValidationCommand)}</pre>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build teacher method reuse result proof receipt.");
const validationInput = readOptionalJsonInput(
  argValue("--contract-receipt-validation", argValue("--validation", "")),
  "--contract-receipt-validation",
  "transparent_ai_teacher_method_execution_learning_contract_receipt_validation_v1"
);
const contractInput = readOptionalJsonInput(
  argValue("--contract", argValue("--teacher-method-contract", "")),
  "--contract",
  "transparent_ai_teacher_method_execution_learning_contract_v1"
);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "teacher-method-reuse-result-proof-builders"))
);
mkdirSync(outputRoot, { recursive: true });

const validation = validationInput.value;
const contract = contractInput.value;
const readyForReuseResultProof = validation?.readyForReuseResultProof === true;
const contractPath = validation?.sourceEvidence?.contract || contractInput.path || "";
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });
const builderPath = join(builderDir, "teacher-method-reuse-result-proof-builder.json");
const receiptTemplatePath = join(builderDir, "teacher-method-reuse-result-proof-receipt-template.json");
const readmePath = join(builderDir, "TEACHER_METHOD_REUSE_RESULT_PROOF_START_HERE.md");
const htmlPath = join(builderDir, "teacher-method-reuse-result-proof-builder.html");
const lockState = locks();
const preconditionBlockers = [];
if (!validation) preconditionBlockers.push("teacher_method_contract_receipt_validation_missing");
if (validation && !readyForReuseResultProof) preconditionBlockers.push("contract_receipt_validation_not_ready_for_reuse_result_proof");
if (!nonPlaceholder(contractPath)) preconditionBlockers.push("source_teacher_method_contract_path_missing");

const receiptTemplate = {
  format: "transparent_ai_teacher_method_reuse_result_proof_receipt_v1",
  builderId,
  goal,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "teacher_reuse_result_confirmed",
    "teacher_reuse_result_needs_repair",
    "blocked",
    "needs_teacher_review"
  ],
  forbiddenTeacherDecisions: [
    "accepted",
    "execute_now",
    "run_now",
    "enable_rule",
    "write_memory",
    "unlock_packaging",
    "claim_complete"
  ],
  sourceContractPath: contractPath,
  sourceContractReceiptValidationPath: validationInput.path,
  evidenceRows: [
    {
      id: "before_run",
      required: "Attach or cite the previous run evidence before the confirmed teacher method was reused.",
      teacherField: "previousRunEvidencePath"
    },
    {
      id: "reuse_run",
      required: "Attach or cite the later reuse run evidence produced under the confirmed teacher method.",
      teacherField: "reuseRunEvidencePath"
    },
    {
      id: "teacher_comparison",
      required: "Teacher explicitly compares the two runs and marks whether ambiguity was reduced or accuracy improved.",
      teacherField: "teacherObservedImprovement"
    },
    {
      id: "repair_route",
      required: "If there is a mismatch, route to high-reasoning repair instead of medium-runtime reuse.",
      teacherField: "remainingMismatchOrCorrection"
    }
  ],
  teacherReviewedBeforeAfter: false,
  teacherObservedImprovement: false,
  ambiguityReducedOrAccuracyImproved: false,
  previousRunEvidencePath: "",
  reuseRunEvidencePath: "",
  improvementSummary: "",
  remainingMismatchOrCorrection: "",
  rollbackPointRetained: false,
  contractStillMatchesTeacherMethod: false,
  mediumRuntimeReuseScopeReviewed: false,
  highReasoningRepairRouteForFailures: true,
  ragEvidenceNonAuthoritativeConfirmed: true,
  teacherConfirmationText: "",
  locks: lockState
};

const nextValidationCommand = commandLine("validate-teacher-method-reuse-result-proof-receipt.mjs", [
  ["--contract-receipt-validation", validationInput.path || "<teacher-method-contract-receipt-validation.json>"],
  ["--receipt", "<teacher-filled-teacher-method-reuse-result-proof-receipt.json>"],
  ["--contract", contractPath || "<teacher-method-execution-learning-contract.json>"],
  ["--output-dir", join(builderDir, "reuse-result-proof-validation")]
]);

const builder = {
  format: "transparent_ai_teacher_method_reuse_result_proof_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: preconditionBlockers.length
    ? "waiting_for_confirmed_teacher_method_contract_receipt_validation"
    : "waiting_for_teacher_reuse_result_proof_receipt",
  readyForTeacherReuseResultReceipt: preconditionBlockers.length === 0,
  preconditionBlockers,
  sourceEvidence: {
    contract: contractPath,
    contractReceiptValidation: validationInput.path,
    contractReceiptValidationStatus: validation?.status || "",
    readyForReuseResultProof
  },
  nextValidationCommand,
  blockedActions: [
    "validate_receipt_from_reuse_result_builder",
    "enable_medium_runtime_reuse_from_builder",
    "execute_software_from_reuse_result_builder",
    "write_memory_from_reuse_result_builder",
    "enable_rule_from_reuse_result_builder",
    "claim_goal_complete_from_reuse_result_builder"
  ],
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  },
  locks: lockState
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeReadme(readmePath, builder);
writeHtml(htmlPath, builder, receiptTemplate);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_teacher_method_reuse_result_proof_builder_result_v1",
      builderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      status: builder.status,
      readyForTeacherReuseResultReceipt: builder.readyForTeacherReuseResultReceipt,
      nextValidationCommand,
      locks: lockState
    },
    null,
    2
  )
);
