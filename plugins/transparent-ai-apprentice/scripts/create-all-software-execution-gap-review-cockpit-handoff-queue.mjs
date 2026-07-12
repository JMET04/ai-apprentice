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
    String(value || "all-software-execution-gap-review-cockpit-handoff-queue")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-execution-gap-review-cockpit-handoff-queue"
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
  return path ? pathToFileURL(path).href : "";
}

function commandPlaceholders(command) {
  return Array.from(new Set(String(command || "").match(/<[^<>]+>/g) || []));
}

function commandSafety(command) {
  const lower = String(command || "").toLowerCase();
  const forbiddenMarkers = [
    "--teacher-reviewed",
    "--teacher-confirmed",
    "--execute",
    "-execute",
    "run_execute_mode",
    "register-scheduledtask",
    "schtasks /create",
    "start-process"
  ];
  const requiredValidator =
    lower.includes("validate-all-software-control-channel-repair-receipt.mjs") ||
    lower.includes("validate-all-software-action-logic-source-contract-receipt.mjs");
  const matchedForbiddenMarkers = forbiddenMarkers.filter((marker) => lower.includes(marker));
  return {
    safeForManualReviewHandoff: requiredValidator && matchedForbiddenMarkers.length === 0,
    requiredValidator,
    matchedForbiddenMarkers
  };
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    queueDoesNotExecuteCommands: true,
    queueDoesNotRunDownstreamValidators: true,
    queueDoesNotRunProbe: true,
    queueDoesNotCreateProfile: true,
    queueDoesNotExecuteTargetSoftware: true,
    queueDoesNotCaptureScreenshots: true,
    queueDoesNotWriteMemory: true,
    queueDoesNotEnableRules: true,
    queueDoesNotAllowMediumRuntime: true,
    downstreamValidatorsRun: false,
    probeRan: false,
    controlProfileCreated: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function commandRows(validation) {
  const commands = validation.nextValidationCommands || {};
  return [
    {
      kind: "control_channel_receipt_validation",
      command: commands.controlChannel || "",
      sourceReceiptDraft: validation.paths?.controlChannelReceiptDraft || "",
      purpose: "Validate teacher-derived control-channel repair receipt with the existing deterministic validator."
    },
    {
      kind: "action_logic_receipt_validation",
      command: commands.actionLogic || "",
      sourceReceiptDraft: validation.paths?.actionLogicReceiptDraft || "",
      purpose: "Validate teacher-derived action-logic contract receipt and produce matrix patch rows when complete."
    }
  ].filter((row) => row.command || row.sourceReceiptDraft);
}

function writeReadme(path, queue) {
  const lines = [
    "# Execution Gap Review Cockpit Handoff Queue",
    "",
    `Status: ${queue.status}`,
    `Decision: ${queue.queueDecision}`,
    `Queue items: ${queue.counts.queueItems}`,
    "",
    "This queue is the low-token handoff after a teacher confirms one combined execution-gap cockpit row.",
    "",
    "Safety boundary:",
    "- It does not execute commands.",
    "- It does not run downstream validators.",
    "- It does not run probes, create profiles, execute target software, capture screenshots, write memory, enable rules, allow medium runtime, or claim completion.",
    "",
    "Queue:",
    ...queue.queueItems.map(
      (item) =>
        `- ${item.id}: ${item.status}; kind=${item.handoffKind}; placeholders=${item.missingInputs.length}; command=${item.command || ""}`
    )
  ];
  if (!queue.queueItems.length) lines.push("- none");
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, queue) {
  const rows = queue.queueItems
    .map((item) => {
      const receiptLink = item.sourceReceiptDraft
        ? `<a href="${htmlEscape(fileHref(item.sourceReceiptDraft))}">${htmlEscape(basename(item.sourceReceiptDraft))}</a>`
        : "";
      return `<tr>
        <td>${item.order}</td>
        <td>${htmlEscape(item.handoffKind)}</td>
        <td>${htmlEscape(item.status)}</td>
        <td>${receiptLink}</td>
        <td><code>${htmlEscape(item.command || "")}</code></td>
        <td>${htmlEscape(item.missingInputs.join(", "))}</td>
      </tr>`;
    })
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Execution Gap Review Cockpit Handoff Queue</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1220px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Execution Gap Review Cockpit Handoff Queue</h1>
    <p><strong>Status:</strong> ${htmlEscape(queue.status)}</p>
    <p><strong>Decision:</strong> ${htmlEscape(queue.queueDecision)}</p>
    <p class="lock">Manual review queue only. It does not execute commands, run downstream validators, run probes, create profiles, execute target software, write memory, enable rules, allow medium runtime, or claim completion.</p>
    <table>
      <thead><tr><th>Order</th><th>Kind</th><th>Status</th><th>Receipt Draft</th><th>Manual Command</th><th>Missing Inputs</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Create manual downstream handoff queue from execution-gap cockpit validation.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--receipt-validation", "")),
  "--validation",
  "transparent_ai_all_software_execution_gap_review_cockpit_receipt_validation_v1"
);
if (!validationInput.value) throw new Error("--validation is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-gap-review-cockpit-handoff-queues"))
);
mkdirSync(outputRoot, { recursive: true });
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const queueDir = join(outputRoot, queueId);
mkdirSync(queueDir, { recursive: true });

const validation = validationInput.value;
const validationBlocked = validation.forbiddenDecisionUsed === true || String(validation.status || "").toLowerCase() === "blocked";
const validationReady = Number(validation.counts?.rowsReadyForDownstreamReceiptValidation || 0) > 0 && !validationBlocked;
const queuePath = join(queueDir, "all-software-execution-gap-review-cockpit-handoff-queue.json");
const htmlPath = join(queueDir, "all-software-execution-gap-review-cockpit-handoff-queue.html");
const readmePath = join(queueDir, "ALL_SOFTWARE_EXECUTION_GAP_REVIEW_COCKPIT_HANDOFF_QUEUE_START_HERE.md");

const queueItems = validationReady
  ? commandRows(validation).map((row, index) => {
      const missingInputs = commandPlaceholders(row.command);
      const safety = commandSafety(row.command);
      const receiptExists = row.sourceReceiptDraft ? existsSync(row.sourceReceiptDraft) : false;
      const blocked = !safety.safeForManualReviewHandoff || missingInputs.length > 0 || !receiptExists;
      return {
        id: `execution_gap_handoff_${String(index + 1).padStart(3, "0")}`,
        order: index + 1,
        handoffKind: row.kind,
        purpose: row.purpose,
        command: row.command,
        sourceReceiptDraft: row.sourceReceiptDraft,
        sourceReceiptDraftExists: receiptExists,
        missingInputs,
        safety,
        commandExecutableNow: false,
        executesNow: false,
        status: blocked ? "waiting_for_safe_manual_downstream_validation_handoff" : "ready_for_manual_downstream_validation_handoff",
        teacherAction:
          "Review the derived receipt draft and command. Run the downstream validator manually only after confirming it still matches the teacher-approved row.",
        blockedActions: [
          "execute_command_from_execution_gap_handoff_queue",
          "auto_run_downstream_validator_from_execution_gap_handoff_queue",
          "run_probe_from_execution_gap_handoff_queue",
          "create_profile_from_execution_gap_handoff_queue",
          "execute_target_software_from_execution_gap_handoff_queue",
          "write_memory_from_execution_gap_handoff_queue",
          "enable_rule_from_execution_gap_handoff_queue",
          "allow_medium_runtime_from_execution_gap_handoff_queue",
          "claim_goal_complete_from_execution_gap_handoff_queue"
        ]
      };
    })
  : [];

const blockedCount = queueItems.filter((item) => item.status !== "ready_for_manual_downstream_validation_handoff").length;
const readyManualCount = queueItems.filter((item) => item.status === "ready_for_manual_downstream_validation_handoff").length;
const queueDecision = validationBlocked
  ? "blocked_by_execution_gap_validation"
  : !validationReady
    ? "waiting_for_teacher_confirmed_execution_gap_validation"
    : blockedCount > 0
      ? "waiting_for_safe_manual_downstream_validation_handoff"
      : "ready_for_manual_downstream_validation_handoff";
const status = validationBlocked
  ? "blocked"
  : !validationReady
    ? "waiting_for_validated_execution_gap_review"
    : blockedCount > 0
      ? "waiting_for_safe_manual_downstream_validation_handoff"
      : "ready_for_manual_downstream_validation_handoff";
const lockState = locks();
const queue = {
  ok: !validationBlocked,
  format: "transparent_ai_all_software_execution_gap_review_cockpit_handoff_queue_v1",
  queueId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  queueDecision,
  sourceEvidence: {
    validation: validationInput.path,
    validationId: validation.validationId || "",
    validationDecision: validation.validationDecision || "",
    cockpit: validation.paths?.sourceCockpit || "",
    receipt: validation.paths?.sourceReceipt || "",
    controlChannelReceiptDraft: validation.paths?.controlChannelReceiptDraft || "",
    actionLogicReceiptDraft: validation.paths?.actionLogicReceiptDraft || ""
  },
  counts: {
    queueItems: queueItems.length,
    readyManualCount,
    blockedCount,
    sourceReadyRows: Number(validation.counts?.rowsReadyForDownstreamReceiptValidation || 0)
  },
  queueItems,
  blockedActions: [
    "execute_execution_gap_handoff_queue",
    "auto_run_downstream_validation_queue",
    "run_probe_from_execution_gap_handoff_queue",
    "create_profile_from_execution_gap_handoff_queue",
    "execute_target_software_from_execution_gap_handoff_queue",
    "capture_screenshot_from_execution_gap_handoff_queue",
    "write_memory_from_execution_gap_handoff_queue",
    "enable_rules_from_execution_gap_handoff_queue",
    "allow_medium_runtime_from_execution_gap_handoff_queue",
    "claim_goal_complete_from_execution_gap_handoff_queue"
  ],
  locks: lockState,
  paths: {
    queue: queuePath,
    html: htmlPath,
    readme: readmePath
  }
};

writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
writeReadme(readmePath, queue);
writeHtml(htmlPath, queue);

console.log(
  JSON.stringify(
    {
      ok: !validationBlocked,
      format: "transparent_ai_all_software_execution_gap_review_cockpit_handoff_queue_result_v1",
      queuePath,
      htmlPath,
      readmePath,
      status,
      queueDecision,
      queueItems: queueItems.length,
      readyManualCount,
      locks: lockState
    },
    null,
    2
  )
);

if (validationBlocked) process.exit(1);
