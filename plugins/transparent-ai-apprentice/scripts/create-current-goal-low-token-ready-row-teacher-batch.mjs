#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function newestFile(root, fileName) {
  const resolvedRoot = resolve(root);
  if (!existsSync(resolvedRoot)) return "";
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(resolvedRoot);
  return found.sort((a, b) => b.time - a.time)[0]?.path || "";
}

function newestRollbackPoint(root) {
  return newestFile(join(root, ".transparent-apprentice", "rollback-points"), "rollback-point.json");
}

function slugify(value) {
  return (
    String(value || "low-token-ready-row-teacher-batch")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 84) || "low-token-ready-row-teacher-batch"
  );
}

function q(value) {
  const text = String(value ?? "");
  return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function commandLine(scriptName, args = []) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map(q)
    .join(" ");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    batchDoesNotValidateReceipt: true,
    batchDoesNotRunMetadataGate: true,
    batchDoesNotReadLogs: true,
    batchDoesNotReadFullLogs: true,
    batchDoesNotCaptureScreenshots: true,
    batchDoesNotExecuteTargetSoftware: true,
    batchDoesNotRegisterSchedule: true,
    batchDoesNotWriteMemory: true,
    batchDoesNotDeleteRollbackPoint: true,
    fullContinuousRecording: false,
    metadataGateRunnerInvoked: false,
    boundedTailReadInvoked: false,
    logContentsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    allSoftwareCoverageComplete: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function rowEvidenceKinds(row) {
  return Array.isArray(row?.proofSnapshotReview?.lowTokenEvidenceKinds)
    ? row.proofSnapshotReview.lowTokenEvidenceKinds
    : [];
}

function writeHtml(path, batch) {
  const rows = batch.readyRows
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.ledgerNumber)}</td>
        <td>${htmlEscape(row.software)}</td>
        <td>${htmlEscape(row.processName)}</td>
        <td>${htmlEscape(row.discoveryStatus)}</td>
        <td>${htmlEscape(row.lowTokenEvidenceKinds.join(", "))}</td>
        <td><code>${htmlEscape(row.defaultTeacherDecision)}</code></td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Low-Token Ready Row Teacher Batch</title>
  <style>
    body { margin: 0; font: 14px/1.45 Segoe UI, Arial, sans-serif; color: #182433; background: #f6f8fb; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    section { background: #fff; border: 1px solid #d8e2ec; border-radius: 8px; padding: 16px; margin: 12px 0; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border-top: 1px solid #e5ebf2; padding: 8px; text-align: left; vertical-align: top; }
    pre, code { background: #edf3f8; border-radius: 5px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; }
    .lock { color: #8a3b00; font-weight: 700; }
  </style>
</head>
<body>
<main>
  <h1>Low-Token Ready Row Teacher Batch</h1>
  <section>
    <p>Status: <code>${htmlEscape(batch.status)}</code></p>
    <p>Rows in batch: <code>${htmlEscape(batch.readyRows.length)}</code></p>
    <p class="lock">Review-only. This page does not run metadata gates, read logs, capture screenshots, execute software, write memory, or claim completion.</p>
    <p>Receipt template: <a href="${htmlEscape(fileHref(batch.paths.receiptTemplate))}">${htmlEscape(batch.paths.receiptTemplate)}</a></p>
  </section>
  <section>
    <h2>Ready Rows</h2>
    <table>
      <thead><tr><th>#</th><th>Software</th><th>Process</th><th>Source Route</th><th>Low-Token Evidence Kinds</th><th>Default Decision</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
  <section>
    <h2>Next Validation Command</h2>
    <pre>${htmlEscape(batch.nextValidationCommand)}</pre>
  </section>
</main>
</body>
</html>
`,
    "utf8"
  );
}

function writeReadme(path, batch) {
  const lines = [
    "# Current Goal Low-Token Ready Row Teacher Batch",
    "",
    `Status: ${batch.status}`,
    `Rows in batch: ${batch.readyRows.length}`,
    "",
    "This batch converts the ready low-token metadata rows into a teacher-fillable receipt template.",
    "It is review-only: no metadata gate is run, no logs are read, no screenshots are captured, no target software is executed, no memory is written, and no completion is claimed.",
    "",
    "## Teacher Choices Per Row",
    "",
    "- `teacher_ready_for_metadata_gate_receipt`: teacher confirms this row may proceed to the next metadata-only gate later.",
    "- `blocked_needs_more_low_token_evidence`: keep the row blocked and state the missing evidence.",
    "- `teacher_excluded_or_private`: exclude or mark private with a teacher reason.",
    "- `needs_teacher_review`: leave unchanged.",
    "",
    "## Next Validation Command",
    "",
    "```powershell",
    batch.nextValidationCommand,
    "```"
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const repoRoot = process.cwd();
const goal = argValue("--goal", "Build first ready low-token row teacher batch.");
const batchSize = Math.max(1, Number(argValue("--batch-size", "10")) || 10);
const cockpitPath = resolve(
  argValue(
    "--waiting-row-cockpit",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-waiting-row-cockpits"), "original-goal-low-token-coverage-waiting-row-cockpit.json")
  )
);
const coverageBridgePath = resolve(
  argValue(
    "--coverage-bridge",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-final-review-bridges"), "current-goal-low-token-coverage-final-review-bridge.json")
  )
);
const rollbackPath = resolve(argValue("--rollback-point", newestRollbackPoint(repoRoot)));
const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-low-token-ready-row-teacher-batches"))
);
mkdirSync(outputRoot, { recursive: true });

const cockpit = existsSync(cockpitPath) ? readJson(cockpitPath) : null;
const coverageBridge = existsSync(coverageBridgePath) ? readJson(coverageBridgePath) : null;
const rollback = existsSync(rollbackPath) ? readJson(rollbackPath) : null;
const readyRows = (Array.isArray(cockpit?.reviewRows) ? cockpit.reviewRows : [])
  .filter((row) => row?.reviewStatus === "ready_for_teacher_confirmed_metadata_gate_receipt")
  .slice(0, batchSize)
  .map((row) => ({
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber,
    software: row.software || "",
    processName: row.processName || "",
    reviewStatus: row.reviewStatus,
    discoveryStatus: row.logSourceLedgerReview?.discoveryStatus || "",
    matchedBy: row.logSourceLedgerReview?.matchedBy || "",
    directLogCandidateCount: Number(row.logSourceLedgerReview?.directLogCandidateCount || 0),
    candidateLogRootCount: Number(row.logSourceLedgerReview?.candidateLogRootCount || 0),
    windowsEventLogCount: Number(row.logSourceLedgerReview?.windowsEventLogCount || 0),
    lowTokenEvidenceKinds: rowEvidenceKinds(row),
    defaultTeacherDecision: "needs_teacher_review",
    allowedTeacherDecisions: [
      "needs_teacher_review",
      "teacher_ready_for_metadata_gate_receipt",
      "blocked_needs_more_low_token_evidence",
      "teacher_excluded_or_private"
    ],
    blockedTeacherDecisions: row.blockedTeacherDecisions || [
      "accepted",
      "run_metadata_gate_now",
      "read_logs_now",
      "read_full_logs",
      "capture_screenshot_now",
      "execute_now",
      "memory_enabled",
      "claim_complete",
      "native_universal_execution"
    ],
    teacherNoteRequiredWhenDecision: [
      "teacher_ready_for_metadata_gate_receipt",
      "blocked_needs_more_low_token_evidence",
      "teacher_excluded_or_private"
    ]
  }));

const blockers = [];
if (!cockpit) blockers.push("waiting_row_cockpit_missing");
if (!coverageBridge) blockers.push("coverage_final_review_bridge_missing");
if (!rollback) blockers.push("rollback_point_missing");
if (readyRows.length === 0) blockers.push("no_ready_rows_found");

const batchId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const batchDir = join(outputRoot, batchId);
mkdirSync(batchDir, { recursive: true });
const batchPath = join(batchDir, "current-goal-low-token-ready-row-teacher-batch.json");
const receiptTemplatePath = join(batchDir, "current-goal-low-token-ready-row-teacher-batch-receipt-template.json");
const htmlPath = join(batchDir, "current-goal-low-token-ready-row-teacher-batch.html");
const readmePath = join(batchDir, "CURRENT_GOAL_LOW_TOKEN_READY_ROW_TEACHER_BATCH.md");

const receiptTemplate = {
  format: "transparent_ai_current_goal_low_token_ready_row_teacher_batch_receipt_v1",
  batchId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "teacher_batch_reviewed",
    "blocked",
    "needs_teacher_review"
  ],
  forbiddenTeacherDecisions: [
    "accepted",
    "run_metadata_gate_now",
    "read_logs_now",
    "read_full_logs",
    "capture_screenshot_now",
    "execute_now",
    "write_memory",
    "claim_complete"
  ],
  rowDecisions: readyRows.map((row) => ({
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber,
    software: row.software,
    teacherDecision: "needs_teacher_review",
    allowedTeacherDecisions: row.allowedTeacherDecisions,
    teacherEvidenceNote: "",
    keepRollbackPoint: true
  })),
  locks: locks()
};

const nextValidationCommand = commandLine("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
  "--cockpit",
  cockpitPath,
  "--receipt",
  receiptTemplatePath,
  "--output-dir",
  join("artifacts", "current-goal-low-token-coverage-waiting-row-cockpit-receipt-validations"),
  "--goal",
  "Validate teacher-filled ready-row batch receipt."
]);

const status = blockers.length
  ? "low_token_ready_row_teacher_batch_needs_source_evidence"
  : "low_token_ready_row_teacher_batch_waiting_for_teacher_receipt";
const batch = {
  ok: blockers.length === 0,
  format: "transparent_ai_current_goal_low_token_ready_row_teacher_batch_v1",
  batchId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  blockers,
  batchSize,
  sourceEvidence: {
    waitingRowCockpit: existsSync(cockpitPath) ? cockpitPath : "",
    coverageFinalReviewBridge: existsSync(coverageBridgePath) ? coverageBridgePath : "",
    rollbackPoint: existsSync(rollbackPath) ? rollbackPath : ""
  },
  cockpitCounts: cockpit?.counts || {},
  coverageBridgeStatus: coverageBridge?.status || "",
  rollbackStatus: rollback?.status || "",
  readyRows,
  nextValidationCommand,
  paths: {
    batch: batchPath,
    receiptTemplate: receiptTemplatePath,
    html: htmlPath,
    readme: readmePath
  },
  locks: locks()
};

writeJson(batchPath, batch);
writeJson(receiptTemplatePath, receiptTemplate);
writeHtml(htmlPath, batch);
writeReadme(readmePath, batch);

console.log(
  JSON.stringify(
    {
      ok: true,
      batchPath,
      receiptTemplatePath,
      htmlPath,
      readmePath,
      status: batch.status,
      blockers: batch.blockers,
      readyRows: batch.readyRows.length,
      firstSoftware: batch.readyRows[0]?.software || ""
    },
    null,
    2
  )
);
