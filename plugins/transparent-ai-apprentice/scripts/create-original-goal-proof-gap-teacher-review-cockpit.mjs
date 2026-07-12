#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PROOF_GAP_RECEIPT_VALIDATOR = "validate-original-goal-proof-gap-teacher-queue-receipt.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-proof-gap-teacher-review-cockpit")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-proof-gap-teacher-review-cockpit"
  );
}

function readJson(path, required = false) {
  if (!path || !existsSync(path)) {
    if (required) throw new Error(`JSON file is required: ${path || "(missing)"}`);
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
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
    cockpitDoesNotFillReceipt: true,
    cockpitDoesNotValidateReceipt: true,
    cockpitDoesNotRunCommands: true,
    cockpitDoesNotRegisterTask: true,
    cockpitDoesNotLaunchRunner: true,
    cockpitDoesNotExecuteTargetSoftware: true,
    cockpitDoesNotCaptureScreenshots: true,
    cockpitDoesNotReadFullLogs: true,
    cockpitDoesNotWriteMemory: true,
    cockpitDoesNotEnableRules: true,
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

function rowByItem(rows) {
  const map = new Map();
  for (const row of rows || []) map.set(row.itemNumber, row);
  return map;
}

function cockpitRows(queue, prefill) {
  const prefillByItem = rowByItem(prefill.rows);
  return (queue.queueItems || []).map((item) => {
    const candidate = prefillByItem.get(item.itemNumber);
    const stillNeeded = candidate?.teacherStillMustConfirm || [
      "teacher must review the proof-gap row and attach evidence"
    ];
    return {
      itemNumber: item.itemNumber,
      phase: item.phase,
      routeId: item.routeId,
      requirementId: item.requirementId,
      title: item.title,
      teacherQuestion: item.teacherQuestion,
      candidateEvidencePath: candidate?.candidateObservedEvidencePath || "",
      candidateEvidenceKey: candidate?.primaryCandidateEvidence?.key || "",
      candidateEvidenceLabel: candidate?.primaryCandidateEvidence?.label || "",
      needsNumberedTarget: Boolean(candidate?.needsNumberedTarget),
      needsRollbackPoint: Boolean(candidate?.needsRollbackPoint),
      stillNeeded,
      receiptDecisionDefault: item.receiptRequirement?.decision || "needs_teacher_evidence",
      blockedTransitions: item.blockedTransitions || []
    };
  });
}

function writeReadme(path, cockpit) {
  const lines = [
    "# Original Goal Proof Gap Teacher Review Cockpit",
    "",
    `Status: ${cockpit.status}`,
    `Rows: ${cockpit.counts.rows}`,
    `Rows with candidate evidence: ${cockpit.counts.rowsWithCandidateEvidence}`,
    `Rows still needing teacher confirmation: ${cockpit.counts.rowsStillNeedTeacherConfirmation}`,
    "",
    "Use this as the single teacher-facing start page for the current proof gaps.",
    "",
    "Review order:",
    ...cockpit.reviewOrder.map((step) => `- ${step.step}. ${step.label}: ${step.path || step.command}`),
    "",
    "Safety boundary:",
    "- This cockpit only links existing evidence, the browser receipt builder, and the validation command template.",
    "- It does not fill the receipt, validate it, run commands, register tasks, launch runners, execute target software, capture screenshots, read full logs, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Locks:",
    ...Object.entries(cockpit.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, cockpit) {
  const stepCards = cockpit.reviewOrder
    .map((step) => {
      const content = step.path
        ? `<a href="${htmlEscape(fileHref(step.path))}">${htmlEscape(step.path)}</a>`
        : `<code>${htmlEscape(step.command || "")}</code>`;
      return `<article class="step">
        <strong>${htmlEscape(step.step)}. ${htmlEscape(step.label)}</strong>
        <p>${content}</p>
        <p>${htmlEscape(step.teacherAction)}</p>
      </article>`;
    })
    .join("\n");
  const rows = cockpit.rows
    .map((row) => {
      const candidate = row.candidateEvidencePath
        ? `<a href="${htmlEscape(fileHref(row.candidateEvidencePath))}">${htmlEscape(row.candidateEvidenceLabel || basename(row.candidateEvidencePath))}</a>`
        : "No candidate evidence";
      return `<tr>
        <td>${htmlEscape(row.itemNumber)}</td>
        <td>${htmlEscape(row.phase)}</td>
        <td>${htmlEscape(row.routeId)}</td>
        <td>${htmlEscape(row.teacherQuestion)}</td>
        <td>${candidate}</td>
        <td>${htmlEscape(row.needsNumberedTarget ? "yes" : "no")}</td>
        <td>${htmlEscape(row.needsRollbackPoint ? "yes" : "no")}</td>
        <td>${htmlEscape(row.stillNeeded.join("; "))}</td>
      </tr>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Proof Gap Teacher Review Cockpit</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1360px; margin: 0 auto; padding: 26px; }
    .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin: 16px 0; }
    .step { background: #fff; border: 1px solid #d9e2ef; border-radius: 8px; padding: 12px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e2ef; }
    th, td { padding: 9px; border-bottom: 1px solid #e3eaf3; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #edf3f8; color: #2d4058; }
    code { background: #eef3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
    .lock { color: #58677a; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Proof Gap Teacher Review Cockpit</h1>
  <p>Status: <code>${htmlEscape(cockpit.status)}</code>; rows: <code>${htmlEscape(cockpit.counts.rows)}</code>; candidate evidence rows: <code>${htmlEscape(cockpit.counts.rowsWithCandidateEvidence)}</code>; rows still needing teacher confirmation: <code>${htmlEscape(cockpit.counts.rowsStillNeedTeacherConfirmation)}</code>.</p>
  <p class="lock">This cockpit organizes review only. It does not fill receipts, validate, run commands, register tasks, execute software, capture screenshots, read full logs, write memory, enable rules, unlock packaging, or claim completion.</p>
  <section class="steps">${stepCards}</section>
  <table>
    <thead><tr><th>#</th><th>Phase</th><th>Route</th><th>Teacher Question</th><th>Candidate Evidence</th><th>Needs Target</th><th>Needs Rollback</th><th>Still Needed</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

const goal = argValue("--goal", "Original goal proof gap teacher review cockpit");
const queuePath = resolve(argValue("--queue", ""));
const prefillPath = resolve(argValue("--prefill", ""));
const receiptBuilderPath = resolve(argValue("--receipt-builder", ""));
const outDir = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-proof-gap-teacher-review-cockpits")));

const queue = readJson(queuePath, true);
const prefill = readJson(prefillPath, true);
const receiptBuilder = readJson(receiptBuilderPath, true);
if (queue.format !== "transparent_ai_original_goal_proof_gap_teacher_queue_v1") {
  throw new Error("queue must be transparent_ai_original_goal_proof_gap_teacher_queue_v1");
}
if (prefill.format !== "transparent_ai_original_goal_proof_gap_evidence_prefill_v1") {
  throw new Error("prefill must be transparent_ai_original_goal_proof_gap_evidence_prefill_v1");
}
if (receiptBuilder.format !== "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_builder_v1") {
  throw new Error("receipt builder must be transparent_ai_original_goal_proof_gap_teacher_queue_receipt_builder_v1");
}

const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const runDir = join(outDir, runId);
mkdirSync(runDir, { recursive: true });

const cockpitPath = join(runDir, "original-goal-proof-gap-teacher-review-cockpit.json");
const htmlPath = join(runDir, "original-goal-proof-gap-teacher-review-cockpit.html");
const readmePath = join(runDir, "ORIGINAL_GOAL_PROOF_GAP_TEACHER_REVIEW_COCKPIT_START_HERE.md");
const rows = cockpitRows(queue, prefill);
const reviewOrder = [
  {
    step: 1,
    label: "Review candidate evidence for each proof gap",
    path: prefill.paths?.html || "",
    command: "",
    teacherAction: "Open the candidate evidence page and decide whether the suggested path is enough or a new evidence path is needed."
  },
  {
    step: 2,
    label: "Generate teacher-filled proof-gap receipt JSON",
    path: receiptBuilder.paths?.html || "",
    command: "",
    teacherAction: "Open the browser receipt builder, fill teacher confirmations, selected numbered targets, rollback points, and blockers."
  },
  {
    step: 3,
    label: "Validate only the teacher-filled receipt",
    path: "",
    command:
      receiptBuilder.nextValidationCommand ||
      queue.paths?.receiptValidationCommandTemplate ||
      `node plugins\\transparent-ai-apprentice\\scripts\\${PROOF_GAP_RECEIPT_VALIDATOR} --queue "${queuePath}" --receipt "<teacher-filled-original-goal-proof-gap-teacher-queue-receipt.json>"`,
    teacherAction: "Run this command only after the teacher provides the receipt JSON; validation prepares review-only follow-up rows."
  }
];

const cockpit = {
  format: "transparent_ai_original_goal_proof_gap_teacher_review_cockpit_v1",
  status: "waiting_for_teacher_to_review_candidates_and_fill_receipt",
  goal,
  sourceEvidence: {
    queue: queuePath,
    prefill: prefillPath,
    receiptBuilder: receiptBuilderPath
  },
  paths: {
    cockpit: cockpitPath,
    html: htmlPath,
    readme: readmePath,
    queue: queuePath,
    prefill: prefillPath,
    prefillHtml: prefill.paths?.html || "",
    receiptBuilder: receiptBuilderPath,
    receiptBuilderHtml: receiptBuilder.paths?.html || "",
    receiptTemplate: receiptBuilder.paths?.receiptTemplate || "",
    validationCommandTemplate: receiptBuilder.nextValidationCommand || queue.paths?.receiptValidationCommandTemplate || ""
  },
  counts: {
    rows: rows.length,
    rowsWithCandidateEvidence: rows.filter((row) => row.candidateEvidencePath).length,
    rowsStillNeedTeacherConfirmation: rows.length,
    rowsNeedingNumberedTarget: rows.filter((row) => row.needsNumberedTarget).length,
    rowsNeedingRollback: rows.filter((row) => row.needsRollbackPoint).length
  },
  reviewOrder,
  rows,
  locks: locks()
};

writeFileSync(cockpitPath, `${JSON.stringify(cockpit, null, 2)}\n`, "utf8");
writeHtml(htmlPath, cockpit);
writeReadme(readmePath, cockpit);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_teacher_review_cockpit_result_v1",
      cockpitPath,
      htmlPath,
      readmePath,
      rows: cockpit.counts.rows,
      rowsWithCandidateEvidence: cockpit.counts.rowsWithCandidateEvidence,
      rowsStillNeedTeacherConfirmation: cockpit.counts.rowsStillNeedTeacherConfirmation
    },
    null,
    2
  )
);
