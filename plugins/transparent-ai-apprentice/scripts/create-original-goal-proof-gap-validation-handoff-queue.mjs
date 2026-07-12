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
    String(value || "original-goal-proof-gap-validation-handoff-queue")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-proof-gap-validation-handoff-queue"
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

function array(value) {
  return Array.isArray(value) ? value : [];
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

function baseBlockedActions() {
  return [
    "execute_command_from_proof_gap_validation_handoff_queue",
    "auto_run_validation_from_proof_gap_validation_handoff_queue",
    "register_task_from_proof_gap_validation_handoff_queue",
    "launch_runner_from_proof_gap_validation_handoff_queue",
    "execute_target_software_from_proof_gap_validation_handoff_queue",
    "capture_screenshot_from_proof_gap_validation_handoff_queue",
    "read_full_logs_from_proof_gap_validation_handoff_queue",
    "write_memory_from_proof_gap_validation_handoff_queue",
    "enable_rule_from_proof_gap_validation_handoff_queue",
    "claim_goal_complete_from_proof_gap_validation_handoff_queue",
    "unlock_packaging_from_proof_gap_validation_handoff_queue"
  ];
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    queueDoesNotRunCommands: true,
    queueDoesNotValidateReceipt: true,
    queueDoesNotRegisterTask: true,
    queueDoesNotLaunchRunner: true,
    queueDoesNotExecuteTargetSoftware: true,
    queueDoesNotCaptureScreenshots: true,
    queueDoesNotReadFullLogs: true,
    queueDoesNotWriteMemory: true,
    queueDoesNotEnableRules: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function readyItem(row, index) {
  const command = row.verificationCommandTemplate || "";
  return {
    id: `proof_gap_validation_handoff_${String(index + 1).padStart(3, "0")}`,
    order: index + 1,
    lane: "ready_for_manual_follow_up",
    status: "ready_for_manual_follow_up_route",
    sourceStatus: row.status || "",
    itemNumber: row.itemNumber,
    phase: row.phase || "",
    routeId: row.routeId || "",
    requirementId: row.requirementId || "",
    teacherQuestion: row.teacherQuestion || "",
    observedEvidencePath: row.observedEvidencePath || "",
    observedEvidenceExists: row.observedEvidencePath ? existsSync(row.observedEvidencePath) : false,
    selectedNumberedTarget: row.selectedNumberedTarget || "",
    retainedRollbackPoint: row.retainedRollbackPoint || "",
    teacherConfirmationText: row.teacherConfirmationText || "",
    teacherNotes: row.teacherNotes || "",
    verificationCommandTemplate: command,
    commandPlaceholders: commandPlaceholders(command),
    canRunAutomatically: false,
    commandExecutableNow: false,
    nextReviewerAction:
      "Review the attached teacher evidence and route details, then decide the next manual follow-up. This queue must not run the verification command automatically.",
    blockedActions: Array.from(new Set([...(row.blockedActions || []), ...baseBlockedActions()]))
  };
}

function validationRowItem(row, index, lane) {
  return {
    id: `proof_gap_validation_handoff_${String(index + 1).padStart(3, "0")}`,
    order: index + 1,
    lane,
    status:
      lane === "blocked"
        ? "blocked_until_teacher_repairs_receipt_or_evidence"
        : "waiting_for_teacher_evidence",
    sourceStatus: row.status || "",
    itemNumber: row.itemNumber,
    phase: row.phase || "",
    routeId: row.routeId || "",
    requirementId: row.requirementId || "",
    normalizedDecision: row.normalizedDecision || "",
    observedEvidencePath: row.observedEvidencePath || "",
    observedEvidenceExists: row.observedEvidencePath ? existsSync(row.observedEvidencePath) : false,
    selectedNumberedTarget: row.selectedNumberedTarget || "",
    retainedRollbackPoint: row.retainedRollbackPoint || "",
    teacherConfirmationText: row.teacherConfirmationText || "",
    teacherNotes: row.teacherNotes || "",
    evidence: row.evidence || {},
    canRunAutomatically: false,
    commandExecutableNow: false,
    nextReviewerAction:
      lane === "blocked"
        ? "Keep this row blocked. Ask the teacher to repair the receipt or provide the missing required evidence before any follow-up route."
        : "Ask the teacher for the missing evidence, selected numbered target, rollback point, or confirmation text before validation can advance.",
    blockedActions: Array.from(new Set([...(row.blockedActions || []), ...baseBlockedActions()]))
  };
}

function writeReadme(path, queue) {
  const lines = [
    "# Original Goal Proof Gap Validation Handoff Queue",
    "",
    `Status: ${queue.status}`,
    `Decision: ${queue.queueDecision}`,
    `Ready rows: ${queue.counts.readyForManualFollowUpRows}`,
    `Blocked rows: ${queue.counts.blockedRows}`,
    `Waiting rows: ${queue.counts.waitingForTeacherEvidenceRows}`,
    "",
    "This queue consumes the proof-gap teacher queue receipt validation result and sorts it into the next manual handoff lanes.",
    "",
    "Safety boundary:",
    "- It does not run verification commands.",
    "- It does not validate receipts.",
    "- It does not register scheduled tasks, launch runners, execute target software, capture screenshots, read full logs, write memory, enable rules, accept technology, unlock packaging, or claim completion.",
    "",
    "Queue:",
    ...queue.queueItems.map(
      (item) =>
        `- ${item.order}. ${item.lane}: ${item.routeId || item.requirementId || item.itemNumber}; ${item.status}; placeholders=${(item.commandPlaceholders || []).length}`
    )
  ];
  if (!queue.queueItems.length) lines.push("- none");
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, queue) {
  const rows = queue.queueItems
    .map(
      (item) => `<tr>
        <td>${item.order}</td>
        <td>${htmlEscape(item.lane)}</td>
        <td>${htmlEscape(item.status)}</td>
        <td>${htmlEscape(item.phase)}</td>
        <td>${htmlEscape(item.routeId)}</td>
        <td>${item.observedEvidencePath ? `<a href="${htmlEscape(fileHref(item.observedEvidencePath))}">${htmlEscape(basename(item.observedEvidencePath))}</a>` : ""}</td>
        <td>${htmlEscape(item.selectedNumberedTarget)}</td>
        <td>${htmlEscape(item.nextReviewerAction)}</td>
        <td><code>${htmlEscape(item.verificationCommandTemplate || "")}</code></td>
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
  <title>Original Goal Proof Gap Validation Handoff Queue</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1240px; margin: 0 auto; padding: 28px; }
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
    <h1>Original Goal Proof Gap Validation Handoff Queue</h1>
    <p><strong>Status:</strong> ${htmlEscape(queue.status)}</p>
    <p><strong>Decision:</strong> ${htmlEscape(queue.queueDecision)}</p>
    <p class="lock">Review-only handoff. It does not run commands, register tasks, launch runners, execute target software, capture screenshots, read full logs, write memory, enable rules, accept technology, unlock packaging, or claim completion.</p>
    <table>
      <thead><tr><th>Order</th><th>Lane</th><th>Status</th><th>Phase</th><th>Route</th><th>Evidence</th><th>Target</th><th>Next Reviewer Action</th><th>Command Template</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Create a review-only handoff queue from proof-gap receipt validation.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--receipt-validation", "")),
  "--validation",
  "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_validation_v1"
);
if (!validationInput.value) throw new Error("--validation is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-proof-gap-validation-handoff-queues")
  )
);
mkdirSync(outputRoot, { recursive: true });
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const queueDir = join(outputRoot, queueId);
mkdirSync(queueDir, { recursive: true });

const validation = validationInput.value;
const queuePath = join(queueDir, "original-goal-proof-gap-validation-handoff-queue.json");
const htmlPath = join(queueDir, "original-goal-proof-gap-validation-handoff-queue.html");
const readmePath = join(queueDir, "ORIGINAL_GOAL_PROOF_GAP_VALIDATION_HANDOFF_QUEUE_START_HERE.md");

const readyRows = array(validation.nextReviewQueue);
const blockedRows = array(validation.validationRows).filter((row) => String(row.status || "").startsWith("blocked_"));
const waitingRows = array(validation.validationRows).filter(
  (row) => row.ready !== true && !String(row.status || "").startsWith("blocked_")
);
const queueItems = [
  ...readyRows.map((row, index) => readyItem(row, index)),
  ...blockedRows.map((row, index) => validationRowItem(row, readyRows.length + index, "blocked")),
  ...waitingRows.map((row, index) =>
    validationRowItem(row, readyRows.length + blockedRows.length + index, "waiting_for_teacher_evidence")
  )
];

const queueDecision =
  blockedRows.length > 0 || waitingRows.length > 0
    ? readyRows.length > 0
      ? "partial_ready_waiting_for_teacher_repair_or_evidence"
      : "waiting_for_teacher_repair_or_evidence"
    : readyRows.length > 0
      ? "ready_for_manual_follow_up_review"
      : "waiting_for_validated_proof_gap_receipt";
const status =
  blockedRows.length > 0
    ? "blocked_or_partially_ready_for_manual_follow_up"
    : waitingRows.length > 0
      ? "waiting_for_teacher_evidence"
      : readyRows.length > 0
        ? "ready_for_manual_follow_up_review"
        : "waiting_for_validated_proof_gap_receipt";
const lockState = locks();
const queue = {
  ok: true,
  format: "transparent_ai_original_goal_proof_gap_validation_handoff_queue_v1",
  queueId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  queueDecision,
  sourceEvidence: {
    validation: validationInput.path,
    validationId: validation.validationId || "",
    validationDecision: validation.validationDecision || "",
    queue: validation.sourceEvidence?.queue || "",
    receipt: validation.sourceEvidence?.receipt || "",
    proofLedger: validation.sourceEvidence?.proofLedger || ""
  },
  counts: {
    queueItems: queueItems.length,
    readyForManualFollowUpRows: readyRows.length,
    blockedRows: blockedRows.length,
    waitingForTeacherEvidenceRows: waitingRows.length
  },
  queueItems,
  completionBoundary: {
    completionAllowed: false,
    reason:
      "This handoff queue only organizes validated proof-gap rows for manual review. It does not prove the original goal complete."
  },
  blockedActions: baseBlockedActions(),
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
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_validation_handoff_queue_result_v1",
      queuePath,
      htmlPath,
      readmePath,
      status,
      queueDecision,
      counts: queue.counts,
      locks: lockState
    },
    null,
    2
  )
);
