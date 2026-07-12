#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-execution-gap-review-cockpit-shortlist")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-execution-gap-review-cockpit-shortlist"
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

function fileHref(path) {
  return `file:///${String(path).replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    shortlistDoesNotValidateReceipt: true,
    shortlistDoesNotRunDownstreamValidators: true,
    shortlistDoesNotRunProbe: true,
    shortlistDoesNotCreateProfile: true,
    shortlistDoesNotExecuteSoftware: true,
    shortlistDoesNotInvokeRunner: true,
    shortlistDoesNotEnableRules: true,
    shortlistDoesNotWriteMemory: true,
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

function oneRowReceipt(cockpit, selected, lockState) {
  return {
    format: "transparent_ai_all_software_execution_gap_review_cockpit_receipt_v1",
    templateOnly: true,
    defaultDecision: "needs_teacher_review",
    cockpitId: cockpit.cockpitId,
    sourceControlChannelBuilder: cockpit.paths?.sourceControlChannelBuilder || "",
    sourceActionLogicPackage: cockpit.paths?.sourceActionLogicPackage || "",
    source: {
      shortlist: true,
      fullCockpit: cockpit.paths?.cockpit || "",
      selectedRowId: selected.rowId,
      selectedSourceRowId: selected.sourceRowId
    },
    decision: "needs_teacher_review",
    rowDecisions: [
      {
        rowId: selected.rowId,
        sourceRowId: selected.sourceRowId,
        software: selected.software,
        teacherDecision: "needs_teacher_review",
        checklist: selected.teacherChecklist,
        evidenceReviewed: false,
        teacherCorrectedActionLogicContract: selected.actionLogicReview?.draftContract || {},
        teacherNote: ""
      }
    ],
    blockedTeacherDecisions: [
      "accepted",
      "execute_now",
      "run_execute_mode",
      "memory_enabled",
      "claim_complete",
      "native_universal_execution"
    ],
    locks: lockState
  };
}

function writeHtml(path, shortlist) {
  const row = shortlist.recommendedRows[0];
  const checks = shortlist.safetyChecks
    .map((check) => `<tr><td>${check.pass ? "pass" : "fail"}</td><td>${htmlEscape(check.name)}</td><td>${htmlEscape(check.evidence)}</td></tr>`)
    .join("\n");
  const links = Object.entries(shortlist.paths)
    .filter(([, value]) => value)
    .map(([key, value]) => `<li><a href="${htmlEscape(fileHref(value))}">${htmlEscape(key)}</a></li>`)
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Execution Gap Review Cockpit Shortlist</title>
  <style>
    body { margin: 0; font: 14px/1.45 system-ui, sans-serif; color: #17202a; background: #f7f9fb; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 17px; margin-top: 22px; }
    .panel { background: #fff; border: 1px solid #d6dde5; border-radius: 6px; padding: 14px; }
    .badge { display: inline-block; padding: 4px 8px; border: 1px solid #7c8a99; border-radius: 999px; background: #fff; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d6dde5; }
    th, td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid #e3e8ef; }
    code { background: #edf1f5; padding: 1px 4px; border-radius: 4px; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>Execution Gap Review Cockpit Shortlist</h1>
    <p><span class="badge">${htmlEscape(shortlist.status)}</span></p>
    <p>Goal: ${htmlEscape(shortlist.goal)}</p>
    <section class="panel">
      <h2>Recommended First Combined Row</h2>
      <p><strong>${htmlEscape(row.rowId)}</strong> / <code>${htmlEscape(row.sourceRowId)}</code> / ${htmlEscape(row.software)}</p>
      <p>${htmlEscape(row.teacherPrompt)}</p>
      <p>Control route status: <code>${htmlEscape(row.controlChannelStatus)}</code></p>
      <p>Action logic status: <code>${htmlEscape(row.actionLogicStatus)}</code></p>
    </section>
    <h2>Safety Checks</h2>
    <table><thead><tr><th>Result</th><th>Check</th><th>Evidence</th></tr></thead><tbody>${checks}</tbody></table>
    <h2>Review Files</h2>
    <ul>${links}</ul>
    <h2>Next Gate</h2>
    <p><code>${htmlEscape(shortlist.validatorCommand)}</code></p>
  </main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

const goal = argValue("--goal", "Select one combined execution-gap cockpit row for low-token teacher review.");
const cockpitInput = readJsonInput(
  argValue("--cockpit", ""),
  "--cockpit",
  "transparent_ai_all_software_execution_gap_review_cockpit_v1"
);
if (!cockpitInput.value) throw new Error("--cockpit is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-gap-review-cockpit-shortlists"))
);
mkdirSync(outputRoot, { recursive: true });
const shortlistId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const shortlistDir = join(outputRoot, shortlistId);
mkdirSync(shortlistDir, { recursive: true });

const cockpit = cockpitInput.value;
const rows = Array.isArray(cockpit.reviewRows) ? cockpit.reviewRows : [];
if (!rows.length) throw new Error("Cockpit has no reviewRows.");
const selectedRowId = argValue("--row-id", "");
const selected =
  (selectedRowId ? rows.find((row) => row.rowId === selectedRowId || row.sourceRowId === selectedRowId) : null) ||
  rows.find((row) => row.controlChannelReview?.present === true && row.actionLogicReview?.present === true) ||
  rows[0];
if (!selected) throw new Error(`No cockpit row found for --row-id ${selectedRowId}`);

const lockState = locks();
const shortlistPath = join(shortlistDir, "all-software-execution-gap-review-cockpit-shortlist.json");
const htmlPath = join(shortlistDir, "all-software-execution-gap-review-cockpit-shortlist.html");
const receiptTemplatePath = join(shortlistDir, "teacher-execution-gap-review-cockpit-shortlist-receipt-template.json");
const readmePath = join(shortlistDir, "ALL_SOFTWARE_EXECUTION_GAP_REVIEW_COCKPIT_SHORTLIST_START_HERE.md");
const receipt = oneRowReceipt(cockpit, selected, lockState);
const validatorCommand = commandLine("validate-all-software-execution-gap-review-cockpit-receipt.mjs", [
  ["--cockpit", cockpitInput.path],
  ["--receipt", receiptTemplatePath],
  ["--output-dir", join(shortlistDir, "cockpit-shortlist-receipt-validation")]
]);
const recommendedRows = [
  {
    rowId: selected.rowId,
    sourceRowId: selected.sourceRowId,
    software: selected.software,
    processName: selected.processName || "",
    reviewStatus: selected.reviewStatus || "",
    controlChannelStatus: selected.controlChannelReview?.currentStatus || "",
    actionLogicStatus: selected.actionLogicReview?.currentStatus || "",
    teacherPrompt: selected.optimizedTeacherPrompt || "",
    defaultDecision: "needs_teacher_review",
    blockedUntilTeacherDecision: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
];
const safetyChecks = [
  {
    name: "Shortlist selects exactly one combined row",
    pass: recommendedRows.length === 1,
    evidence: `${selected.rowId} / ${selected.sourceRowId}`
  },
  {
    name: "Default one-row receipt stays waiting",
    pass: receipt.rowDecisions.length === 1 && receipt.rowDecisions[0].teacherDecision === "needs_teacher_review",
    evidence: "teacherDecision=needs_teacher_review"
  },
  {
    name: "Selected row has both control-channel and action-logic reviews",
    pass: selected.controlChannelReview?.present === true && selected.actionLogicReview?.present === true,
    evidence: `control=${selected.controlChannelReview?.present === true} actionLogic=${selected.actionLogicReview?.present === true}`
  },
  {
    name: "Execution, memory, rules, and medium runtime remain locked",
    pass:
      lockState.targetSoftwareCommandsExecuted === false &&
      lockState.memoryWritten === false &&
      lockState.ruleEnabled === false &&
      lockState.shortlistDoesNotAllowMediumRuntime === true,
    evidence: "no execution, no memory, no rules, no medium runtime"
  }
];
const shortlist = {
  ok: true,
  format: "transparent_ai_all_software_execution_gap_review_cockpit_shortlist_v1",
  shortlistId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_execution_gap_shortlist_review",
  source: {
    cockpitPath: cockpitInput.path,
    cockpitStatus: cockpit.status || "",
    cockpitRows: rows.length
  },
  counts: {
    cockpitRows: rows.length,
    recommendedRows: recommendedRows.length,
    defaultReadyRows: 0
  },
  recommendedRows,
  nextRequiredGate: "teacher_fills_one_row_shortlist_receipt_then_execution_gap_cockpit_bridge_validator_runs",
  validatorCommand,
  paths: {
    shortlist: shortlistPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceCockpit: cockpitInput.path
  },
  safetyChecks,
  locks: lockState
};

writeFileSync(shortlistPath, `${JSON.stringify(shortlist, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeHtml(htmlPath, shortlist);
writeFileSync(
  readmePath,
  [
    "# All-Software Execution Gap Review Cockpit Shortlist",
    "",
    `Status: ${shortlist.status}`,
    `Recommended row: ${selected.rowId} / ${selected.sourceRowId} / ${selected.software}`,
    "",
    "This is the low-token first review entrypoint for the combined control-channel and action-logic execution gap.",
    "It does not validate, execute software, run probes, create profiles, enable rules, write memory, or allow medium-runtime reuse.",
    "",
    `Shortlist: ${shortlistPath}`,
    `HTML: ${htmlPath}`,
    `Receipt template: ${receiptTemplatePath}`,
    `Validator command: ${validatorCommand}`
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_gap_review_cockpit_shortlist_result_v1",
      shortlistId,
      status: shortlist.status,
      shortlistPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      recommendedRowId: selected.rowId,
      recommendedSourceRowId: selected.sourceRowId,
      recommendedSoftware: selected.software,
      defaultReadyRows: 0,
      validatorCommand,
      locks: lockState
    },
    null,
    2
  )
);
