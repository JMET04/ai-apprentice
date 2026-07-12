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
    String(value || "six-remaining-teacher-review-handoff")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "six-remaining-teacher-review-handoff"
  );
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function sourceRowId(row) {
  return String(row?.sourceRowId || row?.rowId || "").trim();
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

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    doesNotRunProbe: true,
    doesNotCreateProfile: true,
    doesNotValidateTeacherReceipt: true,
    doesNotExecuteTargetSoftware: true,
    doesNotSendUiEvents: true,
    doesNotCaptureScreenshots: true,
    doesNotWriteMemory: true,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, handoff) {
  const lines = [
    "# Six Remaining Teacher Review Handoff",
    "",
    `Status: ${handoff.status}`,
    `Rows: ${handoff.rows.length}`,
    "",
    "Rows:",
    ...handoff.rows.map((row) => `- ${row.rowId}: ${row.software}`),
    "",
    "Review order:",
    ...handoff.reviewOrder.map((step) => `${step.step}. ${step.id}: ${step.instruction}\n   HTML: ${step.html || ""}`),
    "",
    "After teacher-filled receipts:",
    ...handoff.afterTeacherReceipts.map((item) => `- ${item}`),
    "",
    "Locks:",
    ...Object.entries(handoff.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, handoff) {
  const rowHtml = handoff.rows
    .map((row) => `<tr><td>${htmlEscape(row.rowId)}</td><td>${htmlEscape(row.software)}</td></tr>`)
    .join("");
  const stepHtml = handoff.reviewOrder
    .map(
      (step) => `<tr>
        <td>${htmlEscape(step.step)}</td>
        <td>${htmlEscape(step.id)}</td>
        <td>${htmlEscape(step.instruction)}</td>
        <td>${step.html ? `<a href="${htmlEscape(fileHref(step.html))}">${htmlEscape(basename(step.html))}</a>` : ""}</td>
      </tr>`
    )
    .join("");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Six Remaining Teacher Review Handoff</title>
  <style>
    :root { color: #17202a; background: #f6f8fb; font: 14px/1.45 "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: 0; }
    section, table { background: #fff; border: 1px solid #d9e2ef; border-radius: 8px; }
    section { padding: 14px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; margin: 14px 0; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 9px; text-align: left; vertical-align: top; }
    th { background: #edf3f8; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Six Remaining Teacher Review Handoff</h1>
  <section>
    <p><strong>Status:</strong> ${htmlEscape(handoff.status)}</p>
    <p>This handoff only orders teacher review. It does not validate a receipt, run probes, create profiles, execute target software, enable rules, write memory, or unlock packaging.</p>
  </section>
  <h2>Rows</h2>
  <table><thead><tr><th>Row</th><th>Software</th></tr></thead><tbody>${rowHtml}</tbody></table>
  <h2>Review Order</h2>
  <table><thead><tr><th>Step</th><th>ID</th><th>Instruction</th><th>HTML</th></tr></thead><tbody>${stepHtml}</tbody></table>
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

const goal = argValue("--goal", "Create a focused teacher handoff for the six remaining all-software execution rows.");
const controlBuilderInput = readJsonInput(
  argValue("--control-channel-builder", argValue("--control-builder", "")),
  "--control-channel-builder",
  "transparent_ai_all_software_control_channel_repair_receipt_builder_v1"
);
const actionPackageInput = readJsonInput(
  argValue("--action-logic-package", argValue("--logic-package", "")),
  "--action-logic-package",
  "transparent_ai_all_software_action_logic_source_contract_package_v1"
);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "current-goal-six-remaining-teacher-review-handoffs"))
);

mkdirSync(outputRoot, { recursive: true });
const handoffId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const handoffDir = join(outputRoot, handoffId);
mkdirSync(handoffDir, { recursive: true });

const controlBuilder = controlBuilderInput.value;
const actionPackage = actionPackageInput.value;
const controlRows = Array.isArray(controlBuilder.reviewRows) ? controlBuilder.reviewRows : [];
const contractRows = Array.isArray(actionPackage.contractRows) ? actionPackage.contractRows : [];
const controlByRowId = new Map(controlRows.map((row) => [sourceRowId(row), row]).filter(([id]) => id));
const rows = contractRows
  .map((row) => {
    const rowId = sourceRowId(row);
    const controlRow = controlByRowId.get(rowId);
    return controlRow
      ? {
          rowId,
          software: row.software || controlRow.software || "",
          controlItemId: controlRow.itemId || "",
          actionLogicStatus: row.currentStatus || row.actionLogicSourceStatus || "",
          controlEvidencePath: controlRow.evidencePath || "",
          probePlanPath: controlRow.probePlanPath || "",
          probeResultTemplatePath: controlRow.probeResultTemplatePath || ""
        }
      : null;
  })
  .filter(Boolean);

if (rows.length === 0) {
  throw new Error("No shared sourceRowId/rowId values found between the control-channel builder and action-logic package.");
}

const lockState = locks();
const handoffPath = join(handoffDir, "six-remaining-teacher-review-handoff.json");
const htmlPath = join(handoffDir, "six-remaining-teacher-review-handoff.html");
const readmePath = join(handoffDir, "SIX_REMAINING_TEACHER_REVIEW_HANDOFF_START_HERE.md");

const handoff = {
  ok: true,
  format: "transparent_ai_current_goal_six_remaining_teacher_review_handoff_v1",
  handoffId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_review_before_control_profile_action_logic_or_execution",
  scope: "shared rows from a focused control-channel builder and action-logic source contract package",
  sourceEvidence: {
    controlChannelBuilderPath: controlBuilderInput.path,
    actionLogicPackagePath: actionPackageInput.path,
    controlChannelReceiptTemplatePath: controlBuilder.paths?.receiptTemplate || "",
    actionLogicReceiptTemplatePath: actionPackage.paths?.receiptTemplate || actionPackage.receiptTemplatePath || ""
  },
  counts: {
    controlRows: controlRows.length,
    actionLogicRows: contractRows.length,
    sharedRows: rows.length
  },
  rows,
  reviewOrder: [
    {
      step: 1,
      id: "control_channel_probe_package_review",
      instruction:
        "Teacher reviews read-only probe plans/templates and either confirms a route to prepare a control profile, asks for more evidence, or keeps it blocked.",
      html: controlBuilder.paths?.html || "",
      builder: controlBuilderInput.path,
      receiptTemplate: controlBuilder.paths?.receiptTemplate || "",
      defaultValidation: ""
    },
    {
      step: 2,
      id: "action_logic_source_contract_review",
      instruction:
        "Teacher reviews or fills action-level logic-source contracts. Only teacher-reviewed source-backed contracts can become matrix patches; templates are not approval.",
      html: actionPackage.paths?.html || actionPackage.htmlPath || "",
      package: actionPackageInput.path,
      receiptTemplate: actionPackage.paths?.receiptTemplate || actionPackage.receiptTemplatePath || "",
      defaultValidation: ""
    }
  ],
  afterTeacherReceipts: [
    "validate-all-software-control-channel-repair-receipt.mjs on teacher-filled control receipt",
    "validate-all-software-action-logic-source-contract-receipt.mjs on teacher-filled action logic receipt",
    "regenerate execution capability matrix with approved validations only",
    "rerun bounded execution convergence audit and final completion gate"
  ],
  paths: {
    handoff: handoffPath,
    html: htmlPath,
    readme: readmePath
  },
  locks: lockState
};

writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
writeReadme(readmePath, handoff);
writeHtml(htmlPath, handoff);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_six_remaining_teacher_review_handoff_result_v1",
      handoffId,
      status: handoff.status,
      handoffPath,
      htmlPath,
      readmePath,
      counts: handoff.counts,
      locks: lockState
    },
    null,
    2
  )
);