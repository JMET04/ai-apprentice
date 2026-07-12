#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-action-logic-source-shortlist")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-action-logic-source-shortlist"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileHref(path) {
  return `file:///${String(path).replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or inline JSON object.`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}.`);
  return parsed;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    shortlistDoesNotExecuteSoftware: true,
    shortlistDoesNotInvokeRunner: true,
    shortlistDoesNotEnableRules: true,
    shortlistDoesNotWriteMemory: true,
    shortlistDoesNotTreatRagAsAuthority: true,
    shortlistDoesNotAllowMediumRuntime: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function buildReceiptRow(row, priorityRank) {
  return {
    rowId: row.rowId,
    software: row.software,
    priorityRank,
    teacherDecision: "needs_teacher_review",
    evidenceReviewed: false,
    actionIntentReviewed: false,
    targetBindingReviewed: false,
    dataToActionLogicReviewed: false,
    dataRelationshipsReviewed: false,
    geometryRelationshipsReviewed: false,
    targetSelectionLogicReviewed: false,
    uncertaintyBlockersReviewed: false,
    executionBoundaryReviewed: false,
    rollbackPolicyReviewed: false,
    rollbackPointReviewed: false,
    outcomeVerifierReviewed: false,
    validationEvidencePlanReviewed: false,
    ragEvidenceRoleReviewedAsEvidenceOnly: false,
    reasoningTierBoundaryReviewed: false,
    providerRoleUsePlanTraceReviewed: false,
    correctedContract: row.draftContract || {},
    teacherNote: ""
  };
}

function writeHtml(path, shortlist) {
  const row = shortlist.recommendedRows[0];
  const checks = shortlist.safetyChecks
    .map(
      (check) =>
        `<tr><td>${htmlEscape(check.pass ? "pass" : "fail")}</td><td>${htmlEscape(check.name)}</td><td>${htmlEscape(check.evidence)}</td></tr>`
    )
    .join("\n");
  const contract = Object.entries(row?.draftContract || {})
    .map(([key, value]) => `<dt>${htmlEscape(key)}</dt><dd>${htmlEscape(value)}</dd>`)
    .join("\n");
  const links = Object.entries(shortlist.paths)
    .filter(([, value]) => value)
    .map(([key, value]) => `<li><a href="${htmlEscape(fileHref(value))}">${htmlEscape(key)}</a></li>`)
    .join("\n");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>All-Software Action Logic Source Shortlist</title>
  <style>
    body { margin: 0; font: 14px/1.45 system-ui, sans-serif; color: #17202a; background: #f7f9fb; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 17px; margin-top: 24px; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #7c8a99; border-radius: 6px; background: white; }
    .panel { background: white; border: 1px solid #d6dde5; border-radius: 6px; padding: 12px; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #d6dde5; }
    th, td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid #e3e8ef; }
    dt { font-weight: 700; margin-top: 8px; }
    dd { margin: 2px 0 8px 0; }
    code { background: #edf1f5; padding: 1px 4px; border-radius: 4px; }
    a { color: #0b5cad; }
  </style>
</head>
<body>
  <main>
    <h1>All-Software Action Logic Source Shortlist</h1>
    <p class="status">${htmlEscape(shortlist.status)}</p>
    <p>Goal: ${htmlEscape(shortlist.goal)}</p>
    <h2>Recommended First Row</h2>
    <div class="panel">
      <p><strong>${htmlEscape(row?.rowId || "")}</strong> ${htmlEscape(row?.software || "")}</p>
      <p>${htmlEscape(row?.teacherLogicPrompt || "")}</p>
      <dl>${contract}</dl>
    </div>
    <h2>Safety Checks</h2>
    <table><thead><tr><th>Result</th><th>Check</th><th>Evidence</th></tr></thead><tbody>${checks}</tbody></table>
    <h2>Evidence</h2>
    <ul>${links}</ul>
    <h2>Next Gate</h2>
    <p>${htmlEscape(shortlist.nextRequiredGate)}</p>
  </main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

const goal = argValue("--goal", "Create the shortest teacher review path for one all-software action logic source contract.");
const packageInput = readJsonInput(
  argValue("--package", argValue("--contract-package", "")),
  "--package",
  "transparent_ai_all_software_action_logic_source_contract_package_v1"
);
if (!packageInput.value) throw new Error("--package is required");
const validationInput = readJsonInput(argValue("--validation", ""), "--validation");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-action-logic-source-shortlists"))
);
mkdirSync(outputRoot, { recursive: true });
const shortlistId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const shortlistDir = join(outputRoot, shortlistId);
mkdirSync(shortlistDir, { recursive: true });

const pkg = packageInput.value;
const rows = Array.isArray(pkg.contractRows) ? pkg.contractRows : [];
if (!rows.length) throw new Error("Contract package has no contractRows.");

const selectedRowId = argValue("--row-id", "");
const selected = selectedRowId ? rows.find((row) => row.rowId === selectedRowId) : rows[0];
if (!selected) throw new Error(`No contract row found for --row-id ${selectedRowId}`);

const shortlistPath = join(shortlistDir, "all-software-action-logic-source-shortlist.json");
const htmlPath = join(shortlistDir, "all-software-action-logic-source-shortlist.html");
const receiptTemplatePath = join(shortlistDir, "teacher-action-logic-source-shortlist-receipt-template.json");
const readmePath = join(shortlistDir, "ALL_SOFTWARE_ACTION_LOGIC_SOURCE_SHORTLIST_START_HERE.md");

const receipt = {
  format: "transparent_ai_all_software_action_logic_source_contract_receipt_v1",
  packageId: pkg.packageId || pkg.actionLogicSourceContractPackageId || "",
  decision: "needs_teacher_review",
  source: {
    shortlistId,
    packagePath: packageInput.path,
    validationPath: validationInput.path || ""
  },
  rowDecisions: [buildReceiptRow(selected, 1)],
  locks: locks()
};

const recommendedRows = [
  {
    rowId: selected.rowId,
    software: selected.software,
    processName: selected.processName || "",
    lane: selected.lane || "",
    currentStatus: selected.currentStatus || "",
    evidenceSummary: selected.evidenceSummary || {},
    teacherLogicPrompt: selected.teacherLogicPrompt || "",
    draftContract: selected.draftContract || {},
    defaultDecision: "needs_teacher_review",
    requiredTeacherAction:
      "Confirm or replace the action intent, target binding, data relationship map, geometry/angle/position/depth logic, uncertainty blockers, rollback policy, verifier, and reasoning-tier boundary.",
    blockedUntilTeacherDecision: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
];

const safetyChecks = [
  {
    name: "Shortlist keeps review-only locks closed",
    pass: true,
    evidence: "accepted=false ruleEnabled=false packagingGated=true"
  },
  {
    name: "Default receipt cannot patch matrix or execute",
    pass: receipt.rowDecisions[0].teacherDecision === "needs_teacher_review",
    evidence: "teacherDecision=needs_teacher_review"
  },
  {
    name: "One recommended row reduces teacher review cost",
    pass: recommendedRows.length === 1 && rows.length >= 1,
    evidence: `${recommendedRows.length} of ${rows.length} contract rows selected`
  },
  {
    name: "RAG remains evidence-only and medium runtime remains blocked",
    pass:
      selected.draftContract?.ragEvidenceRole === "evidence_only_not_authority" &&
      String(selected.draftContract?.reasoningTierBoundary || "").toLowerCase().includes("medium"),
    evidence: "draft contract preserves evidence-only RAG and high/medium reasoning boundary"
  }
];

const shortlist = {
  format: "transparent_ai_all_software_action_logic_source_shortlist_v1",
  shortlistId,
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_action_logic_source_shortlist_review",
  goal,
  source: {
    packagePath: packageInput.path,
    validationPath: validationInput.path || "",
    packageStatus: pkg.status || "",
    validationStatus: validationInput.value?.status || "",
    validationReadyPatchRowCount: validationInput.value?.readyPatchRowCount ?? null
  },
  counts: {
    packageRows: rows.length,
    recommendedRows: recommendedRows.length,
    defaultReadyPatchRows: 0
  },
  recommendedRows,
  nextRequiredGate: "teacher_fills_shortlist_receipt_then_existing_contract_validator_runs",
  validatorCommand: `node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-action-logic-source-contract-receipt.mjs --package "${packageInput.path}" --receipt "${receiptTemplatePath}"`,
  paths: {
    shortlist: shortlistPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourcePackage: packageInput.path,
    sourceValidation: validationInput.path || ""
  },
  safetyChecks,
  locks: locks()
};

writeJson(shortlistPath, shortlist);
writeJson(receiptTemplatePath, receipt);
writeHtml(htmlPath, shortlist);
writeFileSync(
  readmePath,
  [
    "# All-Software Action Logic Source Shortlist",
    "",
    `Status: ${shortlist.status}`,
    `Recommended row: ${selected.rowId} / ${selected.software}`,
    "",
    "This is the shortest teacher review entrypoint for the all-software action logic source blocker.",
    "It does not execute software, send UI events, enable rules, write memory, unlock packaging, or authorize medium-runtime execution.",
    "",
    "Teacher workflow:",
    "1. Open the HTML or receipt template.",
    "2. Confirm or replace the one recommended row's action logic contract.",
    "3. Change the row decision to `teacher_confirmed_logic_contract` only if every review flag is true and the corrected contract is complete.",
    "4. Run the existing validator command shown in the JSON.",
    "",
    `Shortlist: ${shortlistPath}`,
    `Receipt template: ${receiptTemplatePath}`,
    `Validator command: ${shortlist.validatorCommand}`
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: shortlist.format,
      status: shortlist.status,
      shortlistId,
      shortlistPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      recommendedRowId: selected.rowId,
      recommendedSoftware: selected.software,
      defaultReadyPatchRows: 0,
      locks: shortlist.locks
    },
    null,
    2
  )
);
