#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-control-channel-repair-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-control-channel-repair-receipt-builder"
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

function hasProbeEvidence(row) {
  return Boolean(row?.probeResult?.probePlan || row?.probeResult?.resultTemplate || String(row?.status || "").includes("control_channel_probe"));
}

function needsControlChannelReview(row) {
  const text = [
    row?.status,
    row?.lane,
    row?.nextLane,
    row?.nextActionLane,
    row?.executionCapabilityStage,
    row?.actionLogicSourceStatus
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    hasProbeEvidence(row) ||
    text.includes("control_channel") ||
    text.includes("control route") ||
    text.includes("observation_ready_control_evidence_missing") ||
    text.includes("blocked_before_adapter_runner")
  );
}

function repairItemFromFollowUpRow(row, index) {
  const probeResult = row.probeResult || {};
  const hasProbe = hasProbeEvidence(row);
  return {
    itemId: `follow-up-probe-${row.rowId || index + 1}`,
    sourceRowId: row.rowId || "",
    software: row.software || `unknown-software-${index + 1}`,
    processName: row.processName || "",
    windowTitle: row.windowTitle || "",
    status: row.status || "control_channel_probe_package_created_waiting_for_teacher_review",
    lane: hasProbe ? row.lane || "collect_control_channel_evidence" : "review_dry_run_receipt_before_control_profile",
    missingBeforeExecute: [
      hasProbe
        ? "teacher reviews read-only probe plan and result template before any control profile or execution route is trusted"
        : "teacher reviews the blocked dry-run or pilot receipt before treating this as control-channel evidence",
      "teacher supplies or confirms API/CLI/file/browser/macro route evidence, or explicitly preserves supervised UI fallback",
      "action logic source remains missing until the control-channel evidence is reviewed"
    ],
    nextCall: "create_software_control_channel_profile",
    evidencePath: row.evidencePath || probeResult.probePlan || "",
    probePlanPath: probeResult.probePlan || row.evidencePath || "",
    probeResultTemplatePath: probeResult.resultTemplate || "",
    teacherReadmePath: probeResult.teacherReadme || "",
    nextProfileRequestPath: probeResult.nextProfileRequest || "",
    actionLogicSourceStatus: "observation_ready_but_action_logic_source_missing",
    blockedTransitions: ["execute_now", "run_probe_now", "enable_rule", "accept_native_control", "unlock_packaging"],
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      nativeUniversalExecution: false,
      packagingGated: true
    }
  };
}

function deriveRepairQueueFromFollowUpBatch(followUpBatch, followUpBatchPath, derivedQueuePath) {
  const probeRows = (followUpBatch.rowResults || []).filter(needsControlChannelReview);
  return {
    ok: true,
    format: "transparent_ai_all_software_control_channel_repair_queue_v1",
    sourceFormat: followUpBatch.format,
    sourceFollowUpBatch: followUpBatchPath,
    sourceFollowUpBatchStatus: followUpBatch.status || "",
    createdAt: new Date().toISOString(),
    status: "derived_from_execution_follow_up_probe_packages_waiting_for_teacher_review",
    items: probeRows.map(repairItemFromFollowUpRow),
    counts: {
      totalFollowUpRows: (followUpBatch.rowResults || []).length,
      derivedProbeRows: probeRows.length,
      derivedBlockedDryRunRows: probeRows.filter((row) => String(row?.status || "").includes("blocked_before_adapter_runner")).length,
      reviewRowsNeedingTeacherControlEvidence: probeRows.length
    },
    derivedQueuePath,
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      probeRan: false,
      controlProfileCreated: false,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      nativeUniversalExecution: false,
      packagingGated: true,
      goalComplete: false
    }
  };
}

function buildDefaultReceiptTemplate(builderId, sourceRepairQueue, reviewRows, locks) {
  return {
    format: "transparent_ai_all_software_control_channel_repair_review_receipt_v1",
    templateOnly: true,
    defaultDecision: "needs_teacher_review",
    builderId,
    sourceRepairQueue,
    decision: "needs_teacher_review",
    itemDecisions: reviewRows.map((row) => ({
      itemId: row.itemId,
      software: row.software,
      sourceRowId: row.sourceRowId,
      evidencePath: row.evidencePath,
      probePlanPath: row.probePlanPath,
      probeResultTemplatePath: row.probeResultTemplatePath,
      teacherReadmePath: row.teacherReadmePath,
      nextProfileRequestPath: row.nextProfileRequestPath,
      actionLogicSourceStatus: row.actionLogicSourceStatus,
      teacherDecision: "needs_teacher_review",
      evidenceReviewed: false,
      teacherNote: ""
    })),
    blockedTeacherDecisions: ["accepted", "execute_now", "run_probe_now", "run_execute_mode", "memory_enabled", "claim_complete", "native_universal_execution"],
    locks
  };
}

function writeReadme(path, builder) {
  const lines = [
    "# All-Software Control Channel Repair Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Goal: ${builder.goal}`,
    `Source repair queue: ${builder.paths.sourceRepairQueue}`,
    `Source execution follow-up batch: ${builder.paths.sourceFollowUpBatch || ""}`,
    `Derived repair queue: ${builder.paths.derivedRepairQueue || ""}`,
    "",
    "Use the HTML page to generate a teacher review receipt for control-channel repair rows.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder packet: ${builder.paths.builder}`,
    `- Default teacher receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder writes only a default needs-teacher-review receipt template.",
    "- It does not save a teacher-filled receipt or treat the template as approval.",
    "- It does not validate the receipt.",
    "- It does not run probes, execute target software, send UI events, capture screenshots, write memory, or claim native control."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher-facing control-channel repair receipt generator.");
const queueInput = readJsonInput(
  argValue("--repair-queue", argValue("--queue", "")),
  "--repair-queue",
  "transparent_ai_all_software_control_channel_repair_queue_v1"
);
const followUpBatchInput = readJsonInput(
  argValue("--follow-up-batch", argValue("--execution-follow-up-batch", "")),
  "--follow-up-batch",
  "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1"
);
if (!queueInput.value && !followUpBatchInput.value) throw new Error("--repair-queue or --follow-up-batch is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-control-channel-repair-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const htmlPath = join(builderDir, "all-software-control-channel-repair-receipt-builder.html");
const builderPath = join(builderDir, "all-software-control-channel-repair-receipt-builder.json");
const readmePath = join(builderDir, "ALL_SOFTWARE_CONTROL_CHANNEL_REPAIR_RECEIPT_BUILDER_START_HERE.md");
const derivedRepairQueuePath = join(builderDir, "control-channel-repair-queue-from-follow-up.json");
const receiptTemplatePath = join(builderDir, "control-channel-repair-review-receipt-template.json");
const queue = queueInput.value || deriveRepairQueueFromFollowUpBatch(followUpBatchInput.value, followUpBatchInput.path, derivedRepairQueuePath);
const activeRepairQueuePath = queueInput.path || derivedRepairQueuePath;
if (!queueInput.value) writeFileSync(derivedRepairQueuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  builderWritesDefaultReceiptTemplate: true,
  builderDoesNotWriteTeacherFilledReceipt: true,
  defaultReceiptTemplateIsApproval: false,
  builderDoesNotValidateReceipt: true,
  builderDoesNotRunProbe: true,
  builderDoesNotExecuteTargetSoftware: true,
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

const reviewRows = (queue.items || []).map((item) => ({
  itemId: item.itemId,
  sourceRowId: item.sourceRowId || "",
  software: item.software,
  currentStatus: item.status,
  missingBeforeExecute: item.missingBeforeExecute || [],
  nextTool: item.nextCall || "create_software_control_channel_profile",
  evidencePath: item.evidencePath || "",
  probePlanPath: item.probePlanPath || "",
  probeResultTemplatePath: item.probeResultTemplatePath || "",
  teacherReadmePath: item.teacherReadmePath || "",
  nextProfileRequestPath: item.nextProfileRequestPath || "",
  actionLogicSourceStatus: item.actionLogicSourceStatus || "",
  defaultDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_reviewed_prepare_control_profile",
    "teacher_reviewed_prepare_read_only_probe",
    "blocked_needs_more_evidence"
  ],
  blockedTeacherDecisions: ["accepted", "execute_now", "run_probe_now", "run_execute_mode", "memory_enabled", "claim_complete", "native_universal_execution"]
}));

const builder = {
  ok: true,
  format: "transparent_ai_all_software_control_channel_repair_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "receipt_builder_ready_for_teacher_use",
  sourceQueueStatus: queue.status || "waiting_for_teacher_review",
  counts: {
    totalRows: reviewRows.length,
    profileReviewRows: reviewRows.filter((row) => row.nextTool === "create_software_control_channel_profile").length,
    probeReviewRows: reviewRows.filter((row) => row.nextTool === "create_software_control_channel_probe").length
  },
  reviewRows,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceRepairQueue: activeRepairQueuePath,
    sourceFollowUpBatch: followUpBatchInput.path,
    derivedRepairQueue: queueInput.value ? "" : derivedRepairQueuePath,
    sourceAudit: queue.auditPath || ""
  },
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-control-channel-repair-receipt.mjs --repair-queue "' +
    (activeRepairQueuePath || "<control-channel-repair-queue.json>") +
    '" --receipt "<teacher-filled-control-channel-repair-receipt.json>"',
  defaultTemplateValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-control-channel-repair-receipt.mjs --repair-queue "' +
    (activeRepairQueuePath || "<control-channel-repair-queue.json>") +
    '" --receipt "' +
    receiptTemplatePath +
    '"',
  blockedActions: [
    "run_probe_from_receipt_builder",
    "execute_target_software_from_receipt_builder",
    "send_ui_events_from_receipt_builder",
    "capture_screenshot_from_receipt_builder",
    "write_memory_from_receipt_builder",
    "claim_native_control_from_receipt_builder"
  ],
  locks
};
const defaultReceiptTemplate = buildDefaultReceiptTemplate(builderId, activeRepairQueuePath, reviewRows, locks);

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(defaultReceiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Control Channel Repair Receipt Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { line-height: 1.55; }
    .panel, .row { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 14px; margin-top: 16px; }
    label { display: block; margin: 8px 0; }
    select { min-height: 34px; width: 100%; border: 1px solid #cfd7e4; border-radius: 6px; padding: 4px 8px; }
    textarea { width: 100%; min-height: 260px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Control Channel Repair Receipt Builder</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span></p>
    <section class="panel">
      <h2>Generate Receipt JSON</h2>
      <p>Choose the next review-only route for each control-channel repair row. This page only builds JSON in your browser. A default needs-teacher-review template is also saved on disk; neither path runs probes or executes software.</p>
      <p class="muted">Default receipt template: <code>${htmlEscape(builder.paths.receiptTemplate)}</code></p>
      <div id="rows" class="grid"></div>
      <p>
        <button id="generate">Generate Receipt JSON</button>
        <button id="copy" class="secondary">Copy JSON</button>
      </p>
      <textarea id="receipt" spellcheck="false"></textarea>
      <p class="muted">Next validation command: <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const rowsEl = document.getElementById("rows");
    const receiptEl = document.getElementById("receipt");
    for (const row of builder.reviewRows) {
      const card = document.createElement("article");
      card.className = "row";
      card.innerHTML =
        '<label>' + row.software + '</label><select data-item-id="' + row.itemId + '">' +
        row.allowedTeacherDecisions.map((decision) => '<option value="' + decision + '">' + decision + '</option>').join('') +
        '</select><p class="muted">Status: <code>' + row.currentStatus +
        '</code></p><p>Next tool: <code>' + row.nextTool + '</code></p>' +
        '<p class="muted">Probe plan: <code>' + (row.probePlanPath || '') + '</code></p>' +
        '<p class="muted">Result template: <code>' + (row.probeResultTemplatePath || '') + '</code></p>' +
        '<p class="muted">Teacher readme: <code>' + (row.teacherReadmePath || '') + '</code></p>' +
        '<p class="muted">Evidence path: <code>' + (row.evidencePath || '') + '</code></p>';
      rowsEl.appendChild(card);
    }
    function buildReceipt() {
      const decisions = new Map(Array.from(document.querySelectorAll("select[data-item-id]")).map((select) => [select.dataset.itemId, select.value]));
      return {
        format: "transparent_ai_all_software_control_channel_repair_review_receipt_v1",
        builderId: builder.builderId,
        sourceRepairQueue: builder.paths.sourceRepairQueue,
        decision: "needs_teacher_review",
        itemDecisions: builder.reviewRows.map((row) => {
          const decision = decisions.get(row.itemId) || "needs_teacher_review";
          return {
            itemId: row.itemId,
            software: row.software,
            sourceRowId: row.sourceRowId,
            probePlanPath: row.probePlanPath,
            probeResultTemplatePath: row.probeResultTemplatePath,
            teacherReadmePath: row.teacherReadmePath,
            teacherDecision: decision,
            evidenceReviewed: decision !== "needs_teacher_review",
            teacherNote: decision === "needs_teacher_review" ? "" : "teacher selected review-only control-channel follow-up"
          };
        }),
        locks: builder.locks
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
      format: "transparent_ai_all_software_control_channel_repair_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      rowCount: reviewRows.length,
      locks
    },
    null,
    2
  )
);
