#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value) {
  return (
    String(value || "low-token-compact-evidence-learning-handoff")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "low-token-compact-evidence-learning-handoff"
  );
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
    handoffOnly: true,
    commandTemplateOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    handoffDoesNotReadLogs: true,
    handoffDoesNotReadFullLogs: true,
    handoffDoesNotCaptureScreenshots: true,
    handoffDoesNotExecuteTargetSoftware: true,
    handoffDoesNotRegisterSchedule: true,
    handoffDoesNotWriteMemory: true,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function summarizeEvidence(row) {
  const collected = row.collected || {};
  const compact = collected.compactEvidence || collected;
  return {
    rowId: row.rowId || "",
    software: row.software || "",
    sourceType: row.evidenceMode || "compact_metadata_only",
    sources: [
      row.routeId || "",
      row.evidenceMode || "",
      row.compactEvidenceHash || ""
    ].filter(Boolean),
    lowTokenUse: "metadata_only_learning_signal",
    reviewedEvidenceHash: row.compactEvidenceHash || "",
    reviewQuestion:
      "Teacher should label whether this metadata signal means success, warning, failure, normal state change, or should route to high-reasoning correction.",
    compactEvidence: compact,
    contentBoundary: row.contentBoundary || {}
  };
}

function writeHtml(path, handoff) {
  const rows = handoff.learningEventReviewReceiptTemplate.reviewRows
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.rowId)}</td>
        <td>${htmlEscape(row.software)}</td>
        <td>${htmlEscape(row.evidenceMode)}</td>
        <td>${htmlEscape(row.teacherDecision)}</td>
        <td>${htmlEscape(row.compactEvidenceHash)}</td>
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
  <title>Compact Evidence Learning Handoff</title>
  <style>
    :root { color: #17202a; background: #f6f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    .panel, table { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; box-shadow: 0 1px 2px rgba(16,32,56,.06); }
    .panel { padding: 16px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; }
    code { background: #eef3f9; border-radius: 5px; padding: 2px 5px; word-break: break-all; }
  </style>
</head>
<body>
<main>
  <h1>Compact Evidence Learning Handoff</h1>
  <section class="panel">
    <p><strong>Status:</strong> ${htmlEscape(handoff.status)}</p>
    <p><strong>Learning events:</strong> ${htmlEscape(handoff.counts.compactLearningEvents)}</p>
    <p><strong>Compact learning packet:</strong> <code>${htmlEscape(handoff.paths.compactLearningEvents)}</code></p>
    <p>This handoff converts metadata-only evidence into teacher-reviewable learning events. It does not enable rules or write memory.</p>
  </section>
  <table>
    <thead><tr><th>Row</th><th>Software</th><th>Evidence mode</th><th>Default decision</th><th>Evidence hash</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>
`,
    "utf8"
  );
}

const runInput = readJsonInput(
  argValue("--run", argValue("--compact-evidence-run", "")),
  "--run",
  "transparent_ai_original_goal_low_token_compact_evidence_run_v1"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-compact-evidence-learning-handoffs")
  )
);
const run = runInput.value;
const lockState = locks();
const handoffId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(run.runId || "compact-evidence-run")}`;
const handoffDir = join(outputRoot, handoffId);
const observationPath = join(handoffDir, "compact-evidence-learning-observation.json");
const handoffPath = join(handoffDir, "original-goal-low-token-compact-evidence-learning-handoff.json");
const receiptTemplatePath = join(handoffDir, "teacher-compact-evidence-learning-event-review-receipt-template.json");
const htmlPath = join(handoffDir, "original-goal-low-token-compact-evidence-learning-handoff.html");
const readmePath = join(handoffDir, "ORIGINAL_GOAL_LOW_TOKEN_COMPACT_EVIDENCE_LEARNING_HANDOFF_START_HERE.md");
const compactLearningOutputDir = join(handoffDir, "compact-learning-events");

const evidenceRows = Array.isArray(run.evidenceRows) ? run.evidenceRows : [];
const observation = {
  format: "transparent_ai_original_goal_low_token_compact_evidence_learning_observation_v1",
  kitId: handoffId,
  software: "all-software compact metadata evidence",
  processName: "",
  windowTitle: "",
  sourceRunPath: runInput.path,
  teacherNotes: [
    "This observation was produced from metadata-only compact evidence. Teacher must label the learning meaning before any rule is enabled."
  ],
  nonLogFallbackSummaries: evidenceRows.map(summarizeEvidence),
  needsTeacherQuestion: true,
  locks: lockState
};
writeJson(observationPath, observation);

const compactResult = spawnSync(
  process.execPath,
  [
    join(__dirname, "compact-universal-observation-learning-events.mjs"),
    "--observation",
    observationPath,
    "--teacher-style",
    "metadata evidence review, correction-first, high-reasoning repair for wrong labels",
    "--output-dir",
    compactLearningOutputDir
  ],
  { cwd: process.cwd(), encoding: "utf8", timeout: 120000 }
);
if (compactResult.status !== 0) {
  throw new Error(`compact learning event conversion failed\nstdout=${compactResult.stdout}\nstderr=${compactResult.stderr}`);
}
const compactResultJson = JSON.parse(compactResult.stdout);
const compactPacket = compactResultJson.packetPath && existsSync(compactResultJson.packetPath)
  ? readJson(compactResultJson.packetPath)
  : {};
const compactEvents = Array.isArray(compactPacket.compactLearningEvents) ? compactPacket.compactLearningEvents : [];

const reviewReceipt = {
  format: "transparent_ai_original_goal_low_token_compact_evidence_learning_event_review_receipt_v1",
  sourceHandoffPath: handoffPath,
  sourceCompactLearningEventsPath: compactResultJson.packetPath || "",
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "learning_events_reviewed_return_to_high_reasoning_rule_draft",
    "blocked_needs_more_evidence",
    "correction_to_high_reasoning_repair"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "enable_rule_now",
    "write_memory_now",
    "execute_software_now",
    "register_schedule_now",
    "unlock_packaging",
    "claim_complete"
  ],
  rollbackRetained: false,
  reviewRows: evidenceRows.map((row) => ({
    rowId: row.rowId || "",
    software: row.software || "",
    evidenceMode: row.evidenceMode || "",
    compactEvidenceHash: row.compactEvidenceHash || "",
    teacherDecision: "needs_teacher_review",
    allowedTeacherLabels: [
      "success_or_completion",
      "failure_or_blocker",
      "warning",
      "normal_state_change",
      "irrelevant_background_noise",
      "needs_counterexample",
      "correction_to_high_reasoning_repair"
    ],
    selectedTeacherLabel: "",
    reviewedLearningEvent: false,
    ruleBoundaryNote: "",
    counterexampleNote: ""
  })),
  locks: lockState
};

const handoff = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_evidence_learning_handoff_v1",
  handoffId,
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_learning_event_review",
  sourceRunPath: runInput.path,
  counts: {
    evidenceRows: evidenceRows.length,
    compactLearningEvents: compactEvents.length,
    reviewRows: reviewReceipt.reviewRows.length
  },
  paths: {
    handoff: handoffPath,
    observation: observationPath,
    compactLearningEvents: compactResultJson.packetPath || "",
    compactLearningReadme: compactResultJson.teacherReadme || "",
    reviewReceiptTemplate: receiptTemplatePath,
    html: htmlPath,
    readme: readmePath
  },
  nextTeachingCall: {
    tool: "teach_apprentice",
    message:
      "Use the compact learning events and teacher review receipt to draft disabled rules only after the teacher labels the event meaning and counterexamples."
  },
  blockedTransitions: [
    "auto_enable_rule_from_compact_metadata",
    "write_memory_without_teacher_review",
    "execute_software_from_learning_handoff",
    "register_schedule_from_learning_handoff",
    "claim_goal_complete_from_learning_handoff"
  ],
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    nativeUniversalExecution: false,
    goalComplete: false,
    reason:
      "This handoff only converts metadata evidence into teacher-reviewable learning events. Rule extraction, memory write, execution, and completion remain gated."
  },
  learningEventReviewReceiptTemplate: reviewReceipt,
  locks: lockState,
  executeNow: false,
  goalComplete: false
};

writeJson(receiptTemplatePath, reviewReceipt);
writeJson(handoffPath, handoff);
writeHtml(htmlPath, handoff);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Compact Evidence Learning Handoff",
    "",
    `Status: ${handoff.status}`,
    `Evidence rows: ${evidenceRows.length}`,
    `Compact learning events: ${compactEvents.length}`,
    "",
    "This handoff reuses compact-universal-observation-learning-events.mjs to convert metadata-only evidence into teacher-reviewable learning events.",
    "It does not read logs, capture screenshots, execute target software, register schedules, write memory, enable rules, or claim completion.",
    "",
    `Compact learning events: ${handoff.paths.compactLearningEvents}`,
    `Teacher review receipt: ${receiptTemplatePath}`
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      handoffPath,
      observationPath,
      compactLearningEventsPath: handoff.paths.compactLearningEvents,
      reviewReceiptTemplatePath: receiptTemplatePath,
      htmlPath,
      readmePath,
      counts: handoff.counts,
      status: handoff.status,
      locks: lockState,
      executeNow: false,
      goalComplete: false
    },
    null,
    2
  )
);
