#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "all-software-execution-gap-matrix-reconciliation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-execution-gap-matrix-reconciliation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormats = [], optional = false) {
  const text = String(input || "").trim();
  if (!text) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} must be a JSON path or JSON object string`);
  }
  if (expectedFormats.length && !expectedFormats.includes(parsed.value?.format)) {
    throw new Error(`${label} must be one of ${expectedFormats.join(", ")}`);
  }
  return parsed;
}

function realPath(value) {
  const text = String(value || "").trim();
  return text && !text.includes("<") && existsSync(text) ? resolve(text) : "";
}

function commandLine(scriptName, args) {
  const rendered = args.map((arg) => `"${String(arg).replace(/"/g, '\\"')}"`).join(" ");
  return `node plugins/transparent-ai-apprentice/scripts/${scriptName} ${rendered}`;
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

function locks(extra = {}) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    teacherMatrixReconciliationRequired: true,
    matrixPatchedByDefault: false,
    packageDoesNotRunValidators: true,
    packageDoesNotRunProbe: true,
    packageDoesNotCreateProfile: true,
    packageDoesNotExecuteTargetSoftware: true,
    packageDoesNotWriteMemory: true,
    packageDoesNotEnableRules: true,
    packageDoesNotAllowMediumRuntime: true,
    validatorsRunByPackage: false,
    probeRan: false,
    controlProfileCreated: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fileContentsRead: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false,
    ...extra
  };
}

function sourceEvidencePath(summary, key, laneKey = "") {
  const direct = realPath(summary.sourceEvidence?.[key]);
  if (direct) return direct;
  if (laneKey) return realPath(summary.lanes?.[laneKey]?.evidencePath);
  return "";
}

function matrixSourceArgs(matrix, actionLogicValidationPath, outputDir) {
  const source = matrix?.sourceEvidence || {};
  const args = ["--goal", matrix?.goal || "Regenerate execution capability matrix from reviewed execution-gap downstream evidence."];
  const inventoryPath = realPath(source.inventoryPath);
  const coveragePath = realPath(source.coverageAuditPath);
  const pilotPath = realPath(source.pilotQueuePath);
  const readinessPath = realPath(source.readinessBatchPath);
  if (inventoryPath) args.push("--inventory", inventoryPath);
  if (coveragePath) args.push("--coverage-audit", coveragePath);
  if (pilotPath) args.push("--pilot-queue", pilotPath);
  if (readinessPath) args.push("--readiness-batch", readinessPath);
  if (actionLogicValidationPath) args.push("--action-logic-validation", actionLogicValidationPath);
  args.push("--output-dir", outputDir);
  return args;
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 240000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function writeReadme(path, pkg) {
  const lines = [
    "# Execution Gap Matrix Reconciliation Package",
    "",
    `Status: ${pkg.status}`,
    `Decision: ${pkg.reconciliationDecision}`,
    "",
    "This package connects reviewed execution-gap downstream results back into the execution capability matrix lane.",
    "",
    `Control validation: ${pkg.sourceEvidence.controlValidation || "(missing)"}`,
    `Action-logic validation: ${pkg.sourceEvidence.actionLogicValidation || "(missing)"}`,
    `Current matrix: ${pkg.sourceEvidence.currentMatrix || "(missing)"}`,
    "",
    "Prepared command:",
    pkg.plannedCommands.nextMatrixCommand || "(not ready)",
    "",
    "Generated evidence:",
    pkg.generated.nextMatrixPath || "(none; teacher-reviewed reconciliation was not requested or prerequisites were missing)",
    "",
    "Safety boundary:",
    "- Default mode does not patch or regenerate the matrix.",
    "- Teacher-reviewed mode only regenerates a review-only matrix package.",
    "- This package does not run validators, probes, profiles, target software, UI actions, memory writes, rule enablement, medium runtime, or completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, pkg) {
  const rows = [
    ["Control validation", pkg.sourceEvidence.controlValidation],
    ["Action-logic validation", pkg.sourceEvidence.actionLogicValidation],
    ["Current matrix", pkg.sourceEvidence.currentMatrix],
    ["Next matrix", pkg.generated.nextMatrixPath]
  ]
    .map(([label, value]) => {
      const link = value ? `<a href="${htmlEscape(fileHref(value))}">${htmlEscape(basename(value))}</a>` : "";
      return `<tr><td>${htmlEscape(label)}</td><td>${link}</td></tr>`;
    })
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Execution Gap Matrix Reconciliation Package</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    a { color: #174d89; word-break: break-all; }
    code { white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>Execution Gap Matrix Reconciliation Package</h1>
    <p><strong>Status:</strong> ${htmlEscape(pkg.status)}</p>
    <p><strong>Decision:</strong> ${htmlEscape(pkg.reconciliationDecision)}</p>
    <table><thead><tr><th>Evidence</th><th>Path</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>Prepared Command</h2>
    <code>${htmlEscape(pkg.plannedCommands.nextMatrixCommand || "(not ready)")}</code>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Reconcile execution-gap downstream validation evidence into the next matrix package.");
const summaryInput = readJsonInput(
  argValue("--downstream-summary", argValue("--summary", "")),
  "--downstream-summary",
  ["transparent_ai_all_software_execution_gap_downstream_validation_summary_v1"]
);
const matrixInput = readJsonInput(
  argValue("--matrix", argValue("--current-matrix", "")),
  "--matrix",
  ["transparent_ai_all_software_execution_capability_matrix_v1"],
  true
);
const explicitActionValidation = readJsonInput(
  argValue("--action-logic-validation", ""),
  "--action-logic-validation",
  ["transparent_ai_all_software_action_logic_source_contract_validation_v1"],
  true
);
const explicitControlValidation = readJsonInput(
  argValue("--control-validation", ""),
  "--control-validation",
  ["transparent_ai_all_software_control_channel_repair_receipt_validation_v1"],
  true
);

const summary = summaryInput.value;
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-gap-matrix-reconciliation-packages"))
);
mkdirSync(outputRoot, { recursive: true });
const packageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packageDir = join(outputRoot, packageId);
mkdirSync(packageDir, { recursive: true });

const actionLogicValidationPath =
  explicitActionValidation.path || sourceEvidencePath(summary, "actionLogicValidation", "actionLogic");
const controlValidationPath = explicitControlValidation.path || sourceEvidencePath(summary, "controlValidation", "control");
const readyForReconciliation =
  summary.summaryDecision === "downstream_validations_ready_for_teacher_matrix_reconciliation" &&
  Number(summary.lanes?.control?.readyCount || 0) > 0 &&
  Number(summary.lanes?.actionLogic?.readyPatchRows || 0) > 0 &&
  Boolean(actionLogicValidationPath);
const teacherReviewedReconciliation = hasFlag("--teacher-reviewed-reconciliation") || hasFlag("--teacher-reviewed");
const matrixOutputDir = join(packageDir, "next-execution-capability-matrix");
const nextMatrixArgs = matrixSourceArgs(matrixInput.value, actionLogicValidationPath, matrixOutputDir);
const canGenerateNextMatrix = readyForReconciliation && teacherReviewedReconciliation && Boolean(matrixInput.value) && Boolean(actionLogicValidationPath);
let nextMatrixResult = null;
let status = "";
let blockedReason = "";

if (!readyForReconciliation) {
  status = "waiting_for_ready_downstream_validation_summary";
  blockedReason = "Both reviewed control-channel validation and action-logic matrix patch evidence are required.";
} else if (!matrixInput.value) {
  status = "waiting_for_current_execution_matrix";
  blockedReason = "A current execution capability matrix is required before a reviewed next matrix package can be generated.";
} else if (!teacherReviewedReconciliation) {
  status = "ready_for_teacher_matrix_reconciliation_review";
  blockedReason = "Teacher-reviewed reconciliation flag is required before generating the next matrix package.";
} else {
  nextMatrixResult = runNodeScript("create-all-software-execution-capability-matrix.mjs", nextMatrixArgs);
  status = "teacher_reviewed_matrix_reconciliation_generated_next_matrix_execution_still_blocked";
}

const lockState = locks({
  teacherReviewedReconciliation,
  matrixRegenerated: Boolean(nextMatrixResult?.matrixPath),
  matrixPatchedByDefault: false,
  matrixPatchedOnlyAfterTeacherReviewedReconciliation: Boolean(nextMatrixResult?.matrixPath),
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false
});
const packagePath = join(packageDir, "all-software-execution-gap-matrix-reconciliation-package.json");
const receiptPath = join(packageDir, "all-software-execution-gap-matrix-reconciliation-receipt.json");
const readmePath = join(packageDir, "ALL_SOFTWARE_EXECUTION_GAP_MATRIX_RECONCILIATION_START_HERE.md");
const htmlPath = join(packageDir, "all-software-execution-gap-matrix-reconciliation-package.html");

const pkg = {
  ok: true,
  format: "transparent_ai_all_software_execution_gap_matrix_reconciliation_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  blockedReason,
  reconciliationDecision: readyForReconciliation
    ? "ready_for_teacher_reviewed_next_matrix_generation"
    : "waiting_for_downstream_validation_evidence",
  sourceEvidence: {
    downstreamSummary: summaryInput.path,
    controlValidation: controlValidationPath,
    actionLogicValidation: actionLogicValidationPath,
    currentMatrix: matrixInput.path,
    downstreamSummaryDecision: summary.summaryDecision || "",
    downstreamSummaryStatus: summary.status || ""
  },
  counts: {
    controlReadyRows: Number(summary.lanes?.control?.readyCount || 0),
    actionLogicReadyPatchRows: Number(summary.lanes?.actionLogic?.readyPatchRows || 0),
    readyForReconciliation: readyForReconciliation ? 1 : 0,
    nextMatrixGenerated: nextMatrixResult?.matrixPath ? 1 : 0
  },
  plannedCommands: {
    nextMatrixCommand: readyForReconciliation && matrixInput.value ? commandLine("create-all-software-execution-capability-matrix.mjs", nextMatrixArgs) : "",
    teacherReviewedNextMatrixCommand:
      readyForReconciliation && matrixInput.value
        ? commandLine("create-all-software-execution-gap-matrix-reconciliation-package.mjs", [
            "--downstream-summary",
            summaryInput.path || "<downstream-summary.json>",
            "--matrix",
            matrixInput.path || "<current-execution-capability-matrix.json>",
            "--teacher-reviewed-reconciliation",
            "--output-dir",
            outputRoot
          ])
        : ""
  },
  generated: {
    nextMatrixPath: nextMatrixResult?.matrixPath || "",
    nextMatrixReceiptPath: nextMatrixResult?.receiptPath || "",
    nextMatrixEvidenceChainLedgerPath: nextMatrixResult?.evidenceChainLedgerPath || ""
  },
  nextSafeActions: [
    "Teacher reviews this reconciliation package and confirms whether to regenerate the next matrix.",
    "If generated, review the new matrix evidence chain before any dry-run or execute gate.",
    "Use control-channel validation as review evidence only; it does not prove native control by itself.",
    "Keep execution approval, rollback, target confirmation, and outcome verification gates closed until separately satisfied."
  ],
  blockedTransitions: [
    "run_validators_from_matrix_reconciliation_package",
    "run_probe_from_matrix_reconciliation_package",
    "create_profile_from_matrix_reconciliation_package",
    "execute_target_software_from_matrix_reconciliation_package",
    "write_memory_from_matrix_reconciliation_package",
    "enable_rule_from_matrix_reconciliation_package",
    "allow_medium_runtime_from_matrix_reconciliation_package",
    "claim_goal_complete_from_matrix_reconciliation_package"
  ],
  locks: lockState,
  paths: {
    package: packagePath,
    receipt: receiptPath,
    readme: readmePath,
    html: htmlPath
  }
};

writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
writeFileSync(
  receiptPath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_gap_matrix_reconciliation_receipt_v1",
      packageId,
      status,
      blockedReason,
      packagePath,
      readmePath,
      htmlPath,
      generated: pkg.generated,
      accepted: false,
      ruleEnabled: false,
      technologyAccepted: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      locks: lockState
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeReadme(readmePath, pkg);
writeHtml(htmlPath, pkg);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_gap_matrix_reconciliation_package_result_v1",
      status,
      packagePath,
      receiptPath,
      readmePath,
      htmlPath,
      generated: pkg.generated,
      locks: lockState
    },
    null,
    2
  )
);
