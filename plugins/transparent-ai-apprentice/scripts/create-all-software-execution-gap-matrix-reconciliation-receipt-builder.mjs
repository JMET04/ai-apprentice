#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "execution-gap-matrix-reconciliation-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-gap-matrix-reconciliation-receipt-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function commandLine(scriptName, args = []) {
  const rendered = args.map((arg) => `"${String(arg).replace(/"/g, '\\"')}"`).join(" ");
  return `node plugins\\transparent-ai-apprentice\\scripts\\${scriptName} ${rendered}`;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotGenerateMatrix: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRules: true,
    builderDoesNotAllowMediumRuntime: true,
    matrixRegenerated: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function writeReadme(path, builder) {
  const lines = [
    "# Execution Gap Matrix Reconciliation Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Package: ${builder.paths.sourcePackage}`,
    "",
    "Use this after reviewing the execution-gap matrix reconciliation package.",
    "",
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Builder HTML: ${builder.paths.html}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder only creates a teacher review receipt template.",
    "- It does not validate the receipt, regenerate the matrix, execute target software, write memory, enable rules, allow medium runtime, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher review receipt for execution-gap matrix reconciliation.");
const packageInput = readJsonInput(
  argValue("--package", argValue("--reconciliation-package", "")),
  "--package",
  "transparent_ai_all_software_execution_gap_matrix_reconciliation_package_v1"
);
if (!packageInput.value) throw new Error("--package is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-gap-matrix-reconciliation-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const pkg = packageInput.value;
const builderPath = join(builderDir, "all-software-execution-gap-matrix-reconciliation-receipt-builder.json");
const htmlPath = join(builderDir, "all-software-execution-gap-matrix-reconciliation-receipt-builder.html");
const receiptTemplatePath = join(builderDir, "teacher-execution-gap-matrix-reconciliation-receipt-template.json");
const readmePath = join(builderDir, "ALL_SOFTWARE_EXECUTION_GAP_MATRIX_RECONCILIATION_RECEIPT_BUILDER_START_HERE.md");
const lockState = locks();
const receiptTemplate = {
  format: "transparent_ai_all_software_execution_gap_matrix_reconciliation_teacher_receipt_v1",
  builderId,
  sourcePackage: packageInput.path,
  teacherDecision: "needs_teacher_review",
  packageReviewed: false,
  downstreamSummaryReviewed: false,
  controlValidationReviewedAsEvidenceOnly: false,
  actionLogicPatchReviewed: false,
  currentMatrixReviewed: false,
  nextMatrixCommandReviewed: false,
  executionBoundaryReviewed: false,
  rollbackPointRetained: false,
  teacherConfirmedRegenerateNextMatrix: false,
  teacherNote: "",
  blockedTeacherDecisions: [
    "accepted",
    "execute_now",
    "run_execute_mode",
    "write_memory",
    "enable_rule",
    "allow_medium_runtime",
    "claim_complete",
    "native_universal_execution",
    "unlock_packaging"
  ]
};
const nextValidationCommand = commandLine("validate-all-software-execution-gap-matrix-reconciliation-receipt.mjs", [
  "--package",
  packageInput.path || "<all-software-execution-gap-matrix-reconciliation-package.json>",
  "--receipt",
  "<teacher-filled-execution-gap-matrix-reconciliation-receipt.json>"
]);
const builder = {
  ok: true,
  format: "transparent_ai_all_software_execution_gap_matrix_reconciliation_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "matrix_reconciliation_receipt_builder_ready_for_teacher_review",
  reviewItem: {
    packageId: pkg.packageId || "",
    packageStatus: pkg.status || "",
    packageDecision: pkg.reconciliationDecision || "",
    controlReadyRows: Number(pkg.counts?.controlReadyRows || 0),
    actionLogicReadyPatchRows: Number(pkg.counts?.actionLogicReadyPatchRows || 0),
    nextMatrixCommandPrepared: Boolean(pkg.plannedCommands?.nextMatrixCommand),
    generatedNextMatrixPath: pkg.generated?.nextMatrixPath || "",
    defaultTeacherDecision: "needs_teacher_review",
    allowedTeacherDecisions: [
      "needs_teacher_review",
      "teacher_confirmed_matrix_reconciliation",
      "blocked_needs_more_evidence"
    ],
    blockedTeacherDecisions: receiptTemplate.blockedTeacherDecisions
  },
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourcePackage: packageInput.path,
    downstreamSummary: pkg.sourceEvidence?.downstreamSummary || "",
    currentMatrix: pkg.sourceEvidence?.currentMatrix || ""
  },
  nextValidationCommand,
  blockedActions: [
    "validate_receipt_from_builder",
    "generate_next_matrix_from_builder",
    "execute_target_software_from_builder",
    "write_memory_from_builder",
    "enable_rule_from_builder",
    "allow_medium_runtime_from_builder",
    "claim_goal_complete_from_builder"
  ],
  locks: lockState
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Execution Gap Matrix Reconciliation Review</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1040px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); margin-top: 16px; }
    label { display: block; margin: 10px 0; }
    select, input[type="text"] { min-height: 34px; border: 1px solid #cfd7e4; border-radius: 6px; padding: 4px 8px; }
    textarea { width: 100%; min-height: 220px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>Execution Gap Matrix Reconciliation Review</h1>
    <p><span class="badge">review only</span></p>
    <section class="panel">
      <p>Package: <a href="${htmlEscape(fileHref(packageInput.path))}">${htmlEscape(basename(packageInput.path || "package"))}</a></p>
      <p>Status: <code>${htmlEscape(pkg.status)}</code></p>
      <p>Control ready rows: <code>${htmlEscape(pkg.counts?.controlReadyRows || 0)}</code></p>
      <p>Action logic patch rows: <code>${htmlEscape(pkg.counts?.actionLogicReadyPatchRows || 0)}</code></p>
      <p>Current matrix: <code>${htmlEscape(pkg.sourceEvidence?.currentMatrix || "missing")}</code></p>
    </section>
    <section class="panel">
      <label>Teacher decision
        <select id="decision">
          ${builder.reviewItem.allowedTeacherDecisions.map((decision) => `<option value="${htmlEscape(decision)}">${htmlEscape(decision)}</option>`).join("")}
        </select>
      </label>
      <label><input type="checkbox" id="packageReviewed"> I reviewed the reconciliation package.</label>
      <label><input type="checkbox" id="downstreamSummaryReviewed"> I reviewed the downstream summary.</label>
      <label><input type="checkbox" id="controlValidationReviewedAsEvidenceOnly"> I reviewed control validation as evidence only, not authority.</label>
      <label><input type="checkbox" id="actionLogicPatchReviewed"> I reviewed the action-logic matrix patch.</label>
      <label><input type="checkbox" id="currentMatrixReviewed"> I reviewed the current execution matrix.</label>
      <label><input type="checkbox" id="nextMatrixCommandReviewed"> I reviewed the next matrix command.</label>
      <label><input type="checkbox" id="executionBoundaryReviewed"> I understand this does not execute target software or unlock medium runtime.</label>
      <label><input type="checkbox" id="rollbackPointRetained"> A rollback point is retained.</label>
      <label><input type="checkbox" id="teacherConfirmedRegenerateNextMatrix"> Regenerate the next review-only matrix package.</label>
      <label>Teacher note <input type="text" id="teacherNote" placeholder="Optional note"></label>
      <p>
        <button id="generate">Generate Receipt JSON</button>
        <button id="copy" class="secondary">Copy JSON</button>
      </p>
      <textarea id="receipt" spellcheck="false"></textarea>
      <p>Next validation command: <code>${htmlEscape(nextValidationCommand)}</code></p>
    </section>
  </main>
  <script>
    const template = ${jsonForScript(receiptTemplate)};
    const fields = [
      "packageReviewed",
      "downstreamSummaryReviewed",
      "controlValidationReviewedAsEvidenceOnly",
      "actionLogicPatchReviewed",
      "currentMatrixReviewed",
      "nextMatrixCommandReviewed",
      "executionBoundaryReviewed",
      "rollbackPointRetained",
      "teacherConfirmedRegenerateNextMatrix"
    ];
    function buildReceipt() {
      const receipt = { ...template, teacherDecision: document.getElementById("decision").value, teacherNote: document.getElementById("teacherNote").value };
      for (const field of fields) receipt[field] = document.getElementById(field).checked;
      return receipt;
    }
    document.getElementById("generate").addEventListener("click", () => {
      document.getElementById("receipt").value = JSON.stringify(buildReceipt(), null, 2);
    });
    document.getElementById("copy").addEventListener("click", async () => {
      const value = document.getElementById("receipt").value || JSON.stringify(buildReceipt(), null, 2);
      document.getElementById("receipt").value = value;
      await navigator.clipboard.writeText(value);
    });
    document.getElementById("receipt").value = JSON.stringify(template, null, 2);
  </script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_gap_matrix_reconciliation_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      locks: lockState
    },
    null,
    2
  )
);
