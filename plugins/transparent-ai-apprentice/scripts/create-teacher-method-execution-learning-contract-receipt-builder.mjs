#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
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
    String(value || "teacher-method-execution-learning-contract-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84) || "teacher-method-execution-learning-contract-receipt-builder"
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
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function routeRows(contract) {
  return (Array.isArray(contract.routeContracts) ? contract.routeContracts : []).map((route, index) => ({
    rowNumber: index + 1,
    routeId: route.id || "",
    teacherMode: route.teacherMode || "",
    summary: route.summary || "",
    defaultDecision: "needs_teacher_review",
    teacherReviewed: false,
    matchesTeacherMethod: false,
    missingOrWrongLogic: "",
    boundaryExample: "",
    counterexample: "",
    teacherNotes: ""
  }));
}

function writeReadme(path, builder) {
  const lines = [
    "# Teacher Method Execution Learning Contract Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Contract: ${builder.sourceContractPath}`,
    `Route rows: ${builder.counts.routeRows}`,
    "",
    "This builder gives the teacher a structured receipt for confirming whether the method contract truly matches how they teach.",
    "",
    "Next validation command:",
    "",
    "```powershell",
    builder.nextValidationCommand,
    "```",
    "",
    "Safety boundary:",
    "- This builder does not validate the receipt.",
    "- It does not run commands, register tasks, launch runners, execute target software, capture screenshots, read full logs, write memory, enable rules, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder, receiptTemplate) {
  const rows = receiptTemplate.routeRows
    .map(
      (row) => `<tr>
        <td>${row.rowNumber}</td>
        <td>${htmlEscape(row.routeId)}</td>
        <td>${htmlEscape(row.teacherMode)}</td>
        <td>${htmlEscape(row.summary)}</td>
        <td>${htmlEscape(row.defaultDecision)}</td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Teacher Method Contract Receipt Builder</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    code, pre { background: #eef2f7; padding: 2px 5px; border-radius: 4px; overflow-wrap: anywhere; }
    a { color: #174d89; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <h1>Teacher Method Contract Receipt Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Contract:</strong> <a href="${htmlEscape(fileHref(builder.sourceContractPath))}">${htmlEscape(basename(builder.sourceContractPath))}</a></p>
    <p>Fill the JSON receipt template. Confirm every route only when it truly matches the teacher's method.</p>
    <table>
      <thead><tr><th>#</th><th>Route</th><th>Teacher Mode</th><th>Contract Summary</th><th>Default Decision</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Next Validation Command</h2>
    <pre>${htmlEscape(builder.nextValidationCommand)}</pre>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build teacher receipt for teacher method execution learning contract.");
const contractInput = readJsonInput(
  argValue("--contract", argValue("--teacher-method-contract", "")),
  "--contract",
  "transparent_ai_teacher_method_execution_learning_contract_v1"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "teacher-method-execution-learning-contract-receipt-builders")
  )
);
const contract = contractInput.value;
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(contract.contractId || goal)}`;
const builderDir = join(outputRoot, builderId);
const builderPath = join(builderDir, "teacher-method-execution-learning-contract-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "teacher-method-execution-learning-contract-receipt-template.json");
const readmePath = join(builderDir, "TEACHER_METHOD_EXECUTION_LEARNING_CONTRACT_RECEIPT_BUILDER_START_HERE.md");
const htmlPath = join(builderDir, "teacher-method-execution-learning-contract-receipt-builder.html");
const lockState = locks();
const receiptTemplate = {
  format: "transparent_ai_teacher_method_execution_learning_contract_receipt_v1",
  builderId,
  sourceContractPath: contractInput.path,
  contractId: contract.contractId || "",
  profilePath: contract.profilePath || "",
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_method_contract_confirmed",
    "request_contract_repair",
    "blocked"
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
  routeRows: routeRows(contract),
  teacherConfirmationText: "",
  rollbackPointRetained: false,
  reuseResultProofPlan: {
    requiredBeforeGoalCompletion: true,
    status: "not_provided_yet",
    expectedEvidence:
      "After this contract is confirmed, run one reviewed reuse trial and provide before/after evidence showing the method reduced ambiguity or improved the next run."
  },
  locks: lockState
};
const nextValidationCommand = commandLine("validate-teacher-method-execution-learning-contract-receipt.mjs", [
  ["--contract", contractInput.path || "<teacher-method-execution-learning-contract.json>"],
  ["--receipt", "<teacher-filled-teacher-method-execution-learning-contract-receipt.json>"],
  ["--output-dir", join(builderDir, "receipt-validation")]
]);
const builder = {
  format: "transparent_ai_teacher_method_execution_learning_contract_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_method_contract_receipt",
  sourceContractPath: contractInput.path,
  contractStatus: contract.status || "",
  routeContractCount: Array.isArray(contract.routeContracts) ? contract.routeContracts.length : 0,
  counts: {
    routeRows: receiptTemplate.routeRows.length
  },
  nextValidationCommand,
  blockedActions: [
    "validate_receipt_from_teacher_method_contract_builder",
    "execute_software_from_teacher_method_contract_builder",
    "write_memory_from_teacher_method_contract_builder",
    "enable_rule_from_teacher_method_contract_builder",
    "claim_goal_complete_from_teacher_method_contract_builder"
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
      format: "transparent_ai_teacher_method_execution_learning_contract_receipt_builder_result_v1",
      status: builder.status,
      builderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      nextValidationCommand,
      routeRows: receiptTemplate.routeRows.length,
      locks: lockState
    },
    null,
    2
  )
);
