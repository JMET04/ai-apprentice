#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-metadata-gate-preflight")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-metadata-gate-preflight"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJsonFile(path, value) {
  writeFileSync(path, `\uFEFF${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function quote(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    preflightDoesNotRunMetadataGate: true,
    preflightDoesNotReadLogs: true,
    preflightDoesNotCaptureScreenshots: true,
    preflightDoesNotExecuteTargetSoftware: true,
    preflightDoesNotRegisterSchedule: true,
    preflightDoesNotWriteMemory: true,
    metadataGateRunnerInvoked: false,
    allSoftwareCoverageComplete: false,
    teacherAcceptanceRequired: true,
    rollbackPointRequiredBeforeRun: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, preflight) {
  const lines = [
    "# Original Goal Low-Token Metadata Gate Preflight",
    "",
    `Status: ${preflight.status}`,
    `Ready metadata gate rows: ${preflight.counts.readyMetadataGateRows}`,
    `Blocked rows: ${preflight.counts.blockedRows}`,
    "",
    "Purpose:",
    "- Convert the low-token coverage proof snapshot into exact teacher-review run candidates.",
    "- Keep the existing metadata gate runner as the only execution path.",
    "- Require a retained rollback point and explicit teacher confirmation before any command is run.",
    "",
    "Safety boundary:",
    "- This preflight does not run metadata gates.",
    "- It does not read logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "",
    "Prepared commands:",
    ...preflight.commands.map((command, index) => `${index + 1}. ${command.commandLine}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, preflight) {
  const rows = preflight.rows
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.ledgerNumber)}</td>
        <td>${htmlEscape(row.software)}</td>
        <td>${htmlEscape(row.followUpId)}</td>
        <td>${htmlEscape(row.status)}</td>
        <td>${htmlEscape(row.queueItemId)}</td>
        <td>${htmlEscape(row.nextSafeAction)}</td>
      </tr>`
    )
    .join("\n");
  const commands = preflight.commands
    .map((command) => `<li><code>${htmlEscape(command.commandLine)}</code></li>`)
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Low-Token Metadata Gate Preflight</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 18px 0 10px; }
    p, li { line-height: 1.55; }
    .panel { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d8dee8; }
    th, td { text-align: left; vertical-align: top; padding: 10px; border-bottom: 1px solid #e6ebf2; }
    th { background: #eef3f8; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Low-Token Metadata Gate Preflight</h1>
  <p><span class="badge">review only</span></p>
  <section class="panel">
    <p><strong>Status:</strong> ${htmlEscape(preflight.status)}</p>
    <p><strong>Ready rows:</strong> ${htmlEscape(preflight.counts.readyMetadataGateRows)} / ${htmlEscape(preflight.counts.proofRows)}; blocked rows: ${htmlEscape(preflight.counts.blockedRows)}</p>
    <p class="muted">This page prepares exact metadata-gate candidates only. It does not run tools, read logs, capture screenshots, execute software, write memory, register schedules, accept coverage, or claim completion.</p>
  </section>
  <section class="panel">
    <h2>Teacher-Confirmed Commands</h2>
    <ol>${commands}</ol>
  </section>
  <h2>Rows</h2>
  <table>
    <thead><tr><th>#</th><th>Software</th><th>Follow-up</th><th>Status</th><th>Queue item</th><th>Next safe action</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Prepare teacher-reviewed low-token metadata gate preflight for original-goal coverage rows.");
const dossierInput = readJsonInput(
  argValue("--dossier", argValue("--coverage-dossier", "")),
  "--dossier",
  "transparent_ai_original_goal_low_token_coverage_evidence_dossier_v1"
);
const proofInput = readJsonInput(
  argValue("--proof-snapshot", dossierInput.value?.paths?.proofSnapshot || ""),
  "--proof-snapshot",
  "transparent_ai_original_goal_low_token_coverage_proof_snapshot_v1"
);
if (!dossierInput.value) throw new Error("--dossier is required");
if (!proofInput.value) throw new Error("--proof-snapshot or dossier.paths.proofSnapshot is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-metadata-gate-preflights"))
);
mkdirSync(outputRoot, { recursive: true });
const preflightId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const preflightDir = join(outputRoot, preflightId);
mkdirSync(preflightDir, { recursive: true });

const dossier = dossierInput.value;
const proof = proofInput.value;
const lockState = locks();
const maxItems = Math.max(1, Number(argValue("--max-items", String(proof.counts?.metadataGateReadyRows || 1))));
const batchOutputDir = join(preflightDir, "teacher-reviewed-metadata-gate-batch");
const planPath = proof.sourceEvidence?.coverageEnrollmentFollowUpPlan || dossier.sourceEvidence?.coverageEnrollmentFollowUpPlan || "";
const rollbackPlaceholder = "<retained-rollback-point-path-or-label>";

const rows = (proof.proofRows || []).map((row) => {
  const ready =
    row.metadataGateReady === true &&
    row.queueItemMatched === true &&
    row.reviewedBatchRan === false &&
    String(row.batchStatus || "") === "dry_run_only";
  return {
    ledgerNumber: row.ledgerNumber || "",
    software: row.software || "",
    processName: row.processName || "",
    followUpId: row.followUpId || "",
    queuePath: row.queuePath || "",
    queueItemId: row.queueItemId || "",
    lowTokenEvidenceKinds: row.lowTokenEvidenceKinds || [],
    candidateCounts: row.candidateCounts || {},
    status: ready ? "ready_for_teacher_confirmed_metadata_gate" : "blocked_before_metadata_gate",
    readyForTeacherConfirmedMetadataGate: ready,
    blockers: ready ? [] : row.blockers || ["metadata_gate_not_ready"],
    nextSafeAction: ready
      ? "Create or retain a rollback point, then run only after explicit teacher confirmation."
      : row.nextSafeAction || "Resolve blockers before any metadata gate command.",
    locks: lockState
  };
});
const readyRows = rows.filter((row) => row.readyForTeacherConfirmedMetadataGate);
const blockedRows = rows.filter((row) => !row.readyForTeacherConfirmedMetadataGate);
const commandLine =
  readyRows.length > 0 && planPath
    ? `node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-enrollment-follow-up-batch.mjs --plan ${quote(planPath)} --teacher-reviewed --max-items ${Math.min(maxItems, readyRows.length)} --max-queue-items ${Math.min(maxItems, readyRows.length)} --max-logs-per-item 1 --max-tail-lines 16 --max-tail-bytes 1024 --output-dir ${quote(batchOutputDir)}`
    : "";
const commands = commandLine
  ? [
      {
        tool: "run_all_software_coverage_enrollment_follow_up_batch",
        commandLine,
        executesNow: false,
        requiresTeacherConfirmation: true,
        requiresRollbackPoint: true,
        rollbackPoint: rollbackPlaceholder,
        readyFollowUpIds: readyRows.map((row) => row.followUpId),
        blockedUntil: "teacher explicitly confirms this metadata-gate batch and keeps a rollback point"
      }
    ]
  : [];

const preflightPath = join(preflightDir, "original-goal-low-token-metadata-gate-preflight.json");
const htmlPath = join(preflightDir, "original-goal-low-token-metadata-gate-preflight.html");
const readmePath = join(preflightDir, "ORIGINAL_GOAL_LOW_TOKEN_METADATA_GATE_PREFLIGHT_START_HERE.md");
const preflight = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_v1",
  preflightId,
  createdAt: new Date().toISOString(),
  goal,
  status:
    readyRows.length > 0 && commands.length > 0
      ? "ready_for_teacher_confirmed_low_token_metadata_gate_batch"
      : "blocked_before_low_token_metadata_gate_batch",
  purpose:
    "Prepare exact low-token metadata gate candidates from the original-goal proof snapshot without running gates, reading logs, screenshots, software actions, schedules, memory, or completion claims.",
  sourceEvidence: {
    dossier: dossierInput.path,
    proofSnapshot: proofInput.path,
    coverageEnrollmentFollowUpPlan: planPath,
    coverageEnrollmentFollowUpBatch: proof.sourceEvidence?.coverageEnrollmentFollowUpBatch || ""
  },
  counts: {
    proofRows: rows.length,
    readyMetadataGateRows: readyRows.length,
    blockedRows: blockedRows.length,
    commands: commands.length
  },
  rows,
  commands,
  blockedTransitions: [
    "run_metadata_gate_from_preflight",
    "read_logs_from_preflight",
    "capture_screenshot_from_preflight",
    "execute_target_software_from_preflight",
    "register_schedule_from_preflight",
    "write_memory_from_preflight",
    "claim_all_software_coverage_complete_from_preflight",
    "claim_original_goal_complete_from_preflight"
  ],
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    goalComplete: false,
    reason:
      "This preflight only prepares teacher-confirmed metadata gate candidates. Batch receipts, reconciliation, refreshed coverage audit, teacher review, and native execution proof are still required."
  },
  paths: {
    preflight: preflightPath,
    html: htmlPath,
    readme: readmePath,
    sourceDossier: dossierInput.path,
    sourceProofSnapshot: proofInput.path
  },
  locks: lockState
};

writeJsonFile(preflightPath, preflight);
writeHtml(htmlPath, preflight);
writeReadme(readmePath, preflight);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_result_v1",
      preflightPath,
      htmlPath,
      readmePath,
      status: preflight.status,
      counts: preflight.counts,
      commands,
      locks: lockState
    },
    null,
    2
  )
);
