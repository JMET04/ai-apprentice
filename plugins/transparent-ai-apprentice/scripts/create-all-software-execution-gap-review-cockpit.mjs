#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-execution-gap-review-cockpit")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-execution-gap-review-cockpit"
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

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    cockpitWritesDefaultReceiptTemplate: true,
    cockpitDoesNotWriteTeacherFilledReceipt: true,
    defaultReceiptTemplateIsApproval: false,
    cockpitDoesNotValidateReceipt: true,
    cockpitDoesNotRunProbe: true,
    cockpitDoesNotCreateControlProfile: true,
    cockpitDoesNotExecuteTargetSoftware: true,
    cockpitDoesNotEnableRules: true,
    cockpitDoesNotWriteMemory: true,
    cockpitDoesNotTreatRagAsAuthority: true,
    cockpitDoesNotAllowMediumRuntime: true,
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
    allSoftwareControlComplete: false,
    goalComplete: false
  };
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function controlRows(builder) {
  if (Array.isArray(builder?.reviewRows)) return builder.reviewRows;
  if (Array.isArray(builder?.items)) return builder.items;
  return [];
}

function logicRows(pkg) {
  if (Array.isArray(pkg?.reviewRows)) return pkg.reviewRows;
  if (Array.isArray(pkg?.contractRows)) return pkg.contractRows;
  if (Array.isArray(pkg?.rows)) return pkg.rows;
  return [];
}

function rowKey(row, fallback) {
  return String(row?.sourceRowId || row?.rowId || row?.itemId || row?.id || fallback || "").trim();
}

function softwareKey(row) {
  return String(row?.software || row?.name || "").trim().toLowerCase();
}

function controlReview(row) {
  if (!row) {
    return {
      present: false,
      currentStatus: "missing_control_channel_review_row",
      evidencePath: "",
      probePlanPath: "",
      nextTool: "",
      missingBeforeExecute: ["teacher-reviewed control-channel route evidence is missing"]
    };
  }
  return {
    present: true,
    itemId: row.itemId || "",
    sourceRowId: row.sourceRowId || "",
    currentStatus: row.currentStatus || row.status || "",
    evidencePath: row.evidencePath || "",
    probePlanPath: row.probePlanPath || "",
    probeResultTemplatePath: row.probeResultTemplatePath || "",
    teacherReadmePath: row.teacherReadmePath || "",
    nextProfileRequestPath: row.nextProfileRequestPath || "",
    nextTool: row.nextTool || row.nextCall || "",
    missingBeforeExecute: row.missingBeforeExecute || []
  };
}

function actionLogicReview(row) {
  if (!row) {
    return {
      present: false,
      currentStatus: "missing_action_logic_contract_row",
      evidenceSummary: {},
      draftContract: {},
      teacherMustConfirmOrReplaceDraft: true
    };
  }
  return {
    present: true,
    rowId: row.rowId || "",
    currentStatus: row.currentStatus || row.actionLogicSourceStatus || row.status || "",
    lane: row.lane || "",
    evidenceSummary: row.evidenceSummary || {},
    draftPrefillSource: row.draftPrefillSource || "",
    teacherMustConfirmOrReplaceDraft: row.teacherMustConfirmOrReplaceDraft !== false,
    highReasoningRole: row.highReasoningRole || "compile_or_repair_action_logic_contract",
    mediumRuntimeRole: row.mediumRuntimeRole || "blocked_until_teacher_confirmed_logic_contract_validation",
    requiredLogicSourceTypes: row.requiredLogicSourceTypes || [],
    teacherLogicPrompt:
      row.teacherLogicPrompt ||
      "Confirm the intended action, data/state relationship, geometry relationship, target binding, rollback, and verifier before execution.",
    draftContract: row.draftContract || {}
  };
}

function mergeRows(controlBuilder, actionPackage) {
  const controls = controlRows(controlBuilder);
  const logic = logicRows(actionPackage);
  const logicByKey = new Map();
  const logicBySoftware = new Map();
  for (const row of logic) {
    const key = rowKey(row, "");
    if (key) logicByKey.set(key, row);
    const sw = softwareKey(row);
    if (sw && !logicBySoftware.has(sw)) logicBySoftware.set(sw, row);
  }
  const seenLogicKeys = new Set();
  const rows = controls.map((controlRow, index) => {
    const key = rowKey(controlRow, `control-${index + 1}`);
    const logicRow = logicByKey.get(key) || logicBySoftware.get(softwareKey(controlRow)) || null;
    if (logicRow) seenLogicKeys.add(rowKey(logicRow, ""));
    return buildCockpitRow(key, controlRow, logicRow, index);
  });
  for (const logicRow of logic) {
    const key = rowKey(logicRow, "");
    if (key && seenLogicKeys.has(key)) continue;
    if (!key && rows.some((row) => row.software.toLowerCase() === softwareKey(logicRow))) continue;
    rows.push(buildCockpitRow(key || `logic-only-${rows.length + 1}`, null, logicRow, rows.length));
  }
  return rows;
}

function buildCockpitRow(key, controlRow, logicRow, index) {
  const software = String(controlRow?.software || logicRow?.software || `unknown-software-${index + 1}`);
  const control = controlReview(controlRow);
  const logic = actionLogicReview(logicRow);
  return {
    rowId: `execution-gap-${String(index + 1).padStart(3, "0")}`,
    sourceRowId: key,
    software,
    processName: controlRow?.processName || logicRow?.processName || "",
    windowTitle: controlRow?.windowTitle || logicRow?.windowTitle || "",
    reviewStatus:
      control.present && logic.present
        ? "control_channel_and_action_logic_ready_for_teacher_combined_review"
        : control.present
          ? "action_logic_contract_missing_from_combined_review"
          : "control_channel_review_missing_from_combined_review",
    controlChannelReview: control,
    actionLogicReview: logic,
    teacherChecklist: {
      controlChannelEvidenceReviewed: false,
      actionIntentReviewed: false,
      targetBindingReviewed: false,
      dataToActionLogicReviewed: false,
      dataRelationshipMapReviewed: false,
      geometryAnglePositionDepthReviewed: false,
      targetSelectionLogicReviewed: false,
      rollbackPolicyReviewed: false,
      outcomeVerifierReviewed: false,
      reasoningTierBoundaryReviewed: false
    },
    optimizedTeacherPrompt:
      "Before any execution, confirm the exact target software route, intended action, numbered target or exact route, data-to-action relationship, geometry/angle/position/depth relationship if applicable, rollback point, and post-action verifier. If any item is uncertain, choose blocked_needs_more_evidence.",
    defaultDecision: "needs_teacher_review",
    allowedTeacherDecisions: [
      "needs_teacher_review",
      "teacher_ready_for_control_and_logic_receipts",
      "blocked_needs_more_evidence"
    ],
    blockedTeacherDecisions: [
      "accepted",
      "execute_now",
      "run_execute_mode",
      "run_probe_now",
      "create_control_profile_now",
      "memory_enabled",
      "claim_complete",
      "native_universal_execution",
      "allow_medium_runtime_without_contract"
    ],
    nextCommands: {
      validateControlChannelReceipt: control.present
        ? commandLine("validate-all-software-control-channel-repair-receipt.mjs", [
            ["--repair-queue", "<control-channel-repair-queue.json>"],
            ["--receipt", "<teacher-filled-control-channel-repair-receipt.json>"]
          ])
        : "",
      validateActionLogicReceipt: logic.present
        ? commandLine("validate-all-software-action-logic-source-contract-receipt.mjs", [
            ["--package", "<all-software-action-logic-source-contract-package.json>"],
            ["--receipt", "<teacher-filled-action-logic-source-contract-receipt.json>"]
          ])
        : ""
    },
    locks: locks()
  };
}

function buildReceiptTemplate(cockpit) {
  return {
    format: "transparent_ai_all_software_execution_gap_review_cockpit_receipt_v1",
    templateOnly: true,
    defaultDecision: "needs_teacher_review",
    cockpitId: cockpit.cockpitId,
    sourceControlChannelBuilder: cockpit.paths.sourceControlChannelBuilder,
    sourceActionLogicPackage: cockpit.paths.sourceActionLogicPackage,
    decision: "needs_teacher_review",
    rowDecisions: cockpit.reviewRows.map((row) => ({
      rowId: row.rowId,
      sourceRowId: row.sourceRowId,
      software: row.software,
      teacherDecision: "needs_teacher_review",
      checklist: row.teacherChecklist,
      evidenceReviewed: false,
      teacherCorrectedActionLogicContract: row.actionLogicReview.draftContract,
      teacherNote: ""
    })),
    blockedTeacherDecisions: ["accepted", "execute_now", "run_execute_mode", "memory_enabled", "claim_complete", "native_universal_execution"],
    locks: cockpit.locks
  };
}

function writeReadme(path, cockpit) {
  const lines = [
    "# All-Software Execution Gap Review Cockpit",
    "",
    `Status: ${cockpit.status}`,
    `Goal: ${cockpit.goal}`,
    `Rows: ${cockpit.counts.totalRows}`,
    "",
    "This cockpit merges control-channel repair evidence and action-logic contract drafts into one teacher review surface.",
    "",
    `- Cockpit HTML: ${cockpit.paths.html}`,
    `- Cockpit packet: ${cockpit.paths.cockpit}`,
    `- Default teacher receipt template: ${cockpit.paths.receiptTemplate}`,
    `- Source control-channel builder: ${cockpit.paths.sourceControlChannelBuilder}`,
    `- Source action-logic package: ${cockpit.paths.sourceActionLogicPackage}`,
    "",
    "Safety boundary:",
    "- This cockpit is review-only and writes only a default needs-teacher-review receipt template.",
    "- It does not save a teacher-filled receipt, validate receipts, run probes, create profiles, execute target software, send UI events, capture screenshots, write memory, enable rules, or claim native universal execution.",
    "- Medium-runtime reuse stays blocked until both the control-channel receipt and the action-logic contract receipt are teacher-reviewed and validated by their separate gates."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Merge control-channel evidence and action-logic contracts into one teacher review cockpit.");
const controlInput = readJsonInput(
  argValue("--control-channel-builder", argValue("--control", "")),
  "--control-channel-builder",
  "transparent_ai_all_software_control_channel_repair_receipt_builder_v1"
);
const logicInput = readJsonInput(
  argValue("--action-logic-package", argValue("--logic", "")),
  "--action-logic-package",
  "transparent_ai_all_software_action_logic_source_contract_package_v1"
);
if (!controlInput.value && !logicInput.value) throw new Error("--control-channel-builder or --action-logic-package is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-gap-review-cockpits"))
);
mkdirSync(outputRoot, { recursive: true });
const cockpitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const cockpitDir = join(outputRoot, cockpitId);
mkdirSync(cockpitDir, { recursive: true });

const htmlPath = join(cockpitDir, "all-software-execution-gap-review-cockpit.html");
const cockpitPath = join(cockpitDir, "all-software-execution-gap-review-cockpit.json");
const readmePath = join(cockpitDir, "ALL_SOFTWARE_EXECUTION_GAP_REVIEW_COCKPIT_START_HERE.md");
const receiptTemplatePath = join(cockpitDir, "execution-gap-review-cockpit-receipt-template.json");
const cockpitLocks = locks();
const reviewRows = mergeRows(controlInput.value || {}, logicInput.value || {});
const cockpit = {
  ok: true,
  format: "transparent_ai_all_software_execution_gap_review_cockpit_v1",
  cockpitId,
  createdAt: new Date().toISOString(),
  goal,
  status: "teacher_review_cockpit_ready",
  counts: {
    totalRows: reviewRows.length,
    rowsWithControlChannelReview: reviewRows.filter((row) => row.controlChannelReview.present).length,
    rowsWithActionLogicReview: reviewRows.filter((row) => row.actionLogicReview.present).length,
    rowsWithBothReviews: reviewRows.filter((row) => row.controlChannelReview.present && row.actionLogicReview.present).length,
    rowsNeedingMoreEvidence: reviewRows.filter((row) => !row.controlChannelReview.present || !row.actionLogicReview.present).length
  },
  reviewRows,
  paths: {
    cockpit: cockpitPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceControlChannelBuilder: controlInput.path,
    sourceActionLogicPackage: logicInput.path
  },
  nextValidationCommands: [
    commandLine("validate-all-software-control-channel-repair-receipt.mjs", [
      ["--repair-queue", "<control-channel-repair-queue.json>"],
      ["--receipt", "<teacher-filled-control-channel-repair-receipt.json>"]
    ]),
    commandLine("validate-all-software-action-logic-source-contract-receipt.mjs", [
      ["--package", controlInput.path ? logicInput.path || "<all-software-action-logic-source-contract-package.json>" : "<all-software-action-logic-source-contract-package.json>"],
      ["--receipt", "<teacher-filled-action-logic-source-contract-receipt.json>"]
    ])
  ],
  blockedActions: [
    "run_probe_from_execution_gap_cockpit",
    "create_control_profile_from_execution_gap_cockpit",
    "execute_target_software_from_execution_gap_cockpit",
    "send_ui_events_from_execution_gap_cockpit",
    "capture_screenshot_from_execution_gap_cockpit",
    "write_memory_from_execution_gap_cockpit",
    "enable_rule_from_execution_gap_cockpit",
    "claim_native_universal_execution_from_execution_gap_cockpit"
  ],
  locks: cockpitLocks
};
const receiptTemplate = buildReceiptTemplate(cockpit);

writeFileSync(cockpitPath, `${JSON.stringify(cockpit, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, cockpit);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Execution Gap Review Cockpit</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { line-height: 1.55; }
    .panel, .row { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 14px; margin-top: 16px; }
    label { display: block; margin: 8px 0; }
    select, input[type="text"] { min-height: 34px; width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 4px 8px; }
    textarea { width: 100%; min-height: 280px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .warn { background: #fff7df; color: #795400; }
    .muted { color: #586579; font-size: 13px; }
    ul { padding-left: 18px; }
  </style>
</head>
<body>
  <main>
    <h1>Execution Gap Review Cockpit</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span> <span class="badge warn">no execution</span></p>
    <section class="panel">
      <h2>Generate Combined Teacher Receipt JSON</h2>
      <p>This page combines control-channel evidence and action-logic contracts so the teacher can review route, action intent, data logic, geometry/depth logic, rollback, and verifier in one place. It only builds JSON in the browser.</p>
      <p class="muted">Default receipt template: <code>${htmlEscape(cockpit.paths.receiptTemplate)}</code></p>
      <div id="rows" class="grid"></div>
      <p>
        <button id="generate">Generate Receipt JSON</button>
        <button id="copy" class="secondary">Copy JSON</button>
      </p>
      <textarea id="receipt" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const cockpit = ${jsonForScript(cockpit)};
    const rowsEl = document.getElementById("rows");
    const receiptEl = document.getElementById("receipt");
    const checklistKeys = [
      "controlChannelEvidenceReviewed",
      "actionIntentReviewed",
      "targetBindingReviewed",
      "dataToActionLogicReviewed",
      "dataRelationshipMapReviewed",
      "geometryAnglePositionDepthReviewed",
      "targetSelectionLogicReviewed",
      "rollbackPolicyReviewed",
      "outcomeVerifierReviewed",
      "reasoningTierBoundaryReviewed"
    ];
    for (const row of cockpit.reviewRows) {
      const contract = row.actionLogicReview.draftContract || {};
      const card = document.createElement("article");
      card.className = "row";
      card.innerHTML =
        '<label><strong>' + row.software + '</strong></label>' +
        '<select data-row-id="' + row.rowId + '">' +
        row.allowedTeacherDecisions.map((decision) => '<option value="' + decision + '">' + decision + '</option>').join('') +
        '</select>' +
        '<p class="muted">Status: <code>' + row.reviewStatus + '</code></p>' +
        '<p>Control evidence: <code>' + (row.controlChannelReview.evidencePath || row.controlChannelReview.probePlanPath || '') + '</code></p>' +
        '<p>Action intent draft: <code>' + (contract.actionIntent || '') + '</code></p>' +
        '<p>Target binding draft: <code>' + (contract.targetBinding || '') + '</code></p>' +
        '<p>Geometry logic draft: <code>' + (contract.geometryRelationshipLogic || '') + '</code></p>' +
        '<p class="muted">' + row.optimizedTeacherPrompt + '</p>' +
        '<ul>' + checklistKeys.map((key) => '<li><label><input type="checkbox" data-check-row="' + row.rowId + '" data-check-key="' + key + '"> ' + key + '</label></li>').join('') + '</ul>';
      rowsEl.appendChild(card);
    }
    function buildReceipt() {
      const decisions = new Map(Array.from(document.querySelectorAll("select[data-row-id]")).map((select) => [select.dataset.rowId, select.value]));
      return {
        format: "transparent_ai_all_software_execution_gap_review_cockpit_receipt_v1",
        cockpitId: cockpit.cockpitId,
        sourceControlChannelBuilder: cockpit.paths.sourceControlChannelBuilder,
        sourceActionLogicPackage: cockpit.paths.sourceActionLogicPackage,
        decision: "needs_teacher_review",
        rowDecisions: cockpit.reviewRows.map((row) => {
          const checklist = {};
          for (const key of checklistKeys) {
            const box = document.querySelector('input[data-check-row="' + row.rowId + '"][data-check-key="' + key + '"]');
            checklist[key] = Boolean(box && box.checked);
          }
          return {
            rowId: row.rowId,
            sourceRowId: row.sourceRowId,
            software: row.software,
            teacherDecision: decisions.get(row.rowId) || "needs_teacher_review",
            checklist,
            evidenceReviewed: Object.values(checklist).every(Boolean),
            teacherCorrectedActionLogicContract: row.actionLogicReview.draftContract,
            teacherNote: ""
          };
        }),
        locks: cockpit.locks
      };
    }
    function render() {
      receiptEl.value = JSON.stringify(buildReceipt(), null, 2);
    }
    document.getElementById("generate").addEventListener("click", render);
    document.getElementById("copy").addEventListener("click", async () => {
      render();
      await navigator.clipboard.writeText(receiptEl.value);
    });
    render();
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
      format: "transparent_ai_all_software_execution_gap_review_cockpit_result_v1",
      cockpitId,
      status: cockpit.status,
      counts: cockpit.counts,
      paths: cockpit.paths,
      locks: cockpit.locks
    },
    null,
    2
  )
);
