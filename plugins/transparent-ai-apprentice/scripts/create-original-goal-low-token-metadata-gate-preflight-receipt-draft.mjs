#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-metadata-gate-preflight-receipt-draft")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-metadata-gate-preflight-receipt-draft"
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

function writeJsonFile(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    draftDoesNotValidateReceipt: true,
    draftDoesNotRunMetadataGate: true,
    draftDoesNotReadLogs: true,
    draftDoesNotReadFullLogs: true,
    draftDoesNotCaptureScreenshots: true,
    draftDoesNotExecuteTargetSoftware: true,
    draftDoesNotRegisterSchedule: true,
    draftDoesNotWriteMemory: true,
    draftRequiresPassedWaitingRowValidation: true,
    draftReceiptIsNotTeacherConfirmation: true,
    draftReceiptRequiresTeacherConfirmationText: true,
    draftReceiptRequiresRetainedRollbackPoint: true,
    draftReceiptKeepsCommandGenerationDisabled: true,
    metadataGateRunnerInvoked: false,
    boundedTailReadInvoked: false,
    screenshotsCaptured: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function keyParts(row) {
  return [
    `${norm(row.ledgerNumber)}::${norm(row.software)}`,
    norm(row.software),
    norm(row.ledgerNumber)
  ].filter(Boolean);
}

function buildReadyMap(validationRows) {
  const map = new Map();
  for (const row of validationRows) {
    if (row.canProceedToMetadataGateReceipt !== true) continue;
    for (const key of keyParts(row)) {
      if (!map.has(key)) map.set(key, row);
    }
  }
  return map;
}

function matchingReadyRow(map, preflightRow) {
  for (const key of keyParts(preflightRow)) {
    if (map.has(key)) return map.get(key);
  }
  return null;
}

function writeReadme(path, packet) {
  const lines = [
    "# Original Goal Low-Token Metadata Gate Preflight Receipt Draft",
    "",
    `Status: ${packet.status}`,
    `Matched ready rows: ${packet.counts.matchedReadyRows}`,
    `Draft rows still requiring evidenceReviewed=true: ${packet.counts.draftRowsStillRequireTeacherEvidenceFlags}`,
    "",
    "Teacher workflow:",
    "1. Open the draft receipt JSON.",
    "2. Add teacherConfirmation text, set rollbackPointCreated=true, and provide the retained rollbackPoint path.",
    "3. Set allowCommandGeneration=true only after reviewing the metadata-gate preflight rows.",
    "4. For each approved ready row, keep teacherDecision=teacher_confirmed_run_low_token_metadata_gate and change evidenceReviewed=true.",
    "5. Run the metadata-gate preflight receipt validator. The validator prepares a command only; it still does not run the metadata gate.",
    "",
    "Safety boundary:",
    "- This draft is review-only and is not teacher confirmation.",
    "- It requires a passed waiting-row cockpit receipt validation as source evidence.",
    "- It does not run metadata gates, read logs, capture screenshots, execute target software, register schedules, write memory, enable rules, accept coverage, or claim completion.",
    "",
    `- Draft packet: ${packet.paths.draftPacket}`,
    `- Draft receipt: ${packet.paths.draftReceipt}`,
    `- HTML: ${packet.paths.html}`,
    `- Validation command: ${packet.paths.metadataGatePreflightReceiptValidationCommandTemplate}`
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  const rows = packet.reviewRows
    .map(
      (row) => `<tr><td>${htmlEscape(row.followUpId)}</td><td>${htmlEscape(row.software)}</td><td>${htmlEscape(
        row.draftTeacherDecision
      )}</td><td>${htmlEscape(row.status)}</td><td>${htmlEscape(row.teacherEditRequired)}</td></tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Metadata Gate Preflight Receipt Draft</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1160px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); margin-top: 16px; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; margin-right: 8px; }
    .warn { background: #fff7df; color: #795400; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; border-bottom: 1px solid #e6ebf2; padding: 8px; vertical-align: top; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #155aa8; }
  </style>
</head>
<body>
  <main>
    <h1>Metadata Gate Preflight Receipt Draft</h1>
    <p><span class="badge">review only</span><span class="badge warn">not teacher confirmation</span><span class="badge warn">no metadata gate run</span></p>
    <section class="panel">
      <p>Status: <code>${htmlEscape(packet.status)}</code></p>
      <p>Matched ready rows: <code>${htmlEscape(packet.counts.matchedReadyRows)}</code></p>
      <p>Draft receipt: <a href="${htmlEscape(packet.paths.draftReceipt)}">${htmlEscape(packet.paths.draftReceipt)}</a></p>
      <p>Validate after teacher edits: <code>${htmlEscape(packet.paths.metadataGatePreflightReceiptValidationCommandTemplate)}</code></p>
    </section>
    <section class="panel">
      <table>
        <thead><tr><th>Follow-up</th><th>Software</th><th>Draft decision</th><th>Status</th><th>Teacher edit required</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Draft metadata-gate preflight receipt from passed waiting-row validation.");
const validationInput = readJsonInput(
  argValue("--waiting-row-validation", argValue("--validation", "")),
  "--waiting-row-validation",
  "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_validation_v1"
);
if (!validationInput.value) throw new Error("--waiting-row-validation is required");
const preflightInput = readJsonInput(
  argValue("--preflight", argValue("--metadata-gate-preflight", "")),
  "--preflight",
  "transparent_ai_original_goal_low_token_metadata_gate_preflight_v1"
);
if (!preflightInput.value) throw new Error("--preflight is required");
const templateInput = readJsonInput(
  argValue("--receipt-template", argValue("--metadata-gate-receipt-template", "")),
  "--receipt-template",
  "transparent_ai_original_goal_low_token_metadata_gate_preflight_review_receipt_v1"
);

const validation = validationInput.value;
if (validation.ok !== true || validation.status !== "waiting_for_metadata_gate_preflight_receipt_after_cockpit_review") {
  throw new Error("waiting-row validation must be passed and ready for metadata-gate preflight receipt review");
}

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-metadata-gate-preflight-receipt-drafts")
  )
);
mkdirSync(outputRoot, { recursive: true });
const draftId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const draftDir = join(outputRoot, draftId);
mkdirSync(draftDir, { recursive: true });

const draftPacketPath = join(draftDir, "original-goal-low-token-metadata-gate-preflight-receipt-draft.json");
const draftReceiptPath = join(draftDir, "teacher-draft-low-token-metadata-gate-preflight-receipt.json");
const htmlPath = join(draftDir, "original-goal-low-token-metadata-gate-preflight-receipt-draft.html");
const readmePath = join(draftDir, "ORIGINAL_GOAL_LOW_TOKEN_METADATA_GATE_PREFLIGHT_RECEIPT_DRAFT_START_HERE.md");
const lockState = locks();
const preflightRows = Array.isArray(preflightInput.value.rows) ? preflightInput.value.rows : [];
const validationRows = Array.isArray(validation.validationRows) ? validation.validationRows : [];
const readyMap = buildReadyMap(validationRows);
const reviewRows = preflightRows.map((row) => {
  const matched = matchingReadyRow(readyMap, row);
  const sourceReady = row.readyForTeacherConfirmedMetadataGate === true;
  const matchedReady = Boolean(matched && sourceReady);
  return {
    followUpId: row.followUpId || "",
    ledgerNumber: row.ledgerNumber || "",
    software: row.software || "",
    processName: row.processName || "",
    preflightStatus: row.status || "",
    sourceReady,
    waitingRowValidationMatched: Boolean(matched),
    waitingRowValidationRowId: matched?.rowId || "",
    draftTeacherDecision: matchedReady
      ? "teacher_confirmed_run_low_token_metadata_gate"
      : sourceReady
        ? "needs_teacher_review"
        : "blocked_needs_more_evidence",
    status: matchedReady
      ? "drafted_waiting_for_teacher_confirmation_rollback_and_evidence_flags"
      : sourceReady
        ? "waiting_for_teacher_review_no_matching_waiting_row_validation"
        : "blocked_source_preflight_row_not_ready",
    teacherEditRequired: matchedReady
      ? "add teacherConfirmation, retained rollbackPoint, allowCommandGeneration=true, and evidenceReviewed=true"
      : "do not run until source evidence is ready",
    locks: lockState
  };
});
const matchedReadyRows = reviewRows.filter(
  (row) => row.status === "drafted_waiting_for_teacher_confirmation_rollback_and_evidence_flags"
);
const receipt = {
  format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_review_receipt_v1",
  draftOnly: true,
  templateOnly: true,
  builderId: templateInput.value?.builderId || "",
  sourcePreflight: preflightInput.path,
  sourceWaitingRowValidation: validationInput.path,
  decision: "needs_teacher_review",
  teacherConfirmation: "",
  rollbackPointCreated: false,
  rollbackPoint: "",
  allowCommandGeneration: false,
  teacherMustEditBeforeValidation: true,
  draftSafetyNote:
    "This draft copies only row-level intent from a passed waiting-row validation. It intentionally leaves teacher confirmation, rollback point, command generation, and row evidence flags disabled.",
  rowDecisions: reviewRows.map((row) => ({
    followUpId: row.followUpId,
    ledgerNumber: row.ledgerNumber,
    software: row.software,
    teacherDecision: row.draftTeacherDecision,
    evidenceReviewed: false,
    draftSuggestedByWaitingRowValidation: row.waitingRowValidationMatched,
    teacherNote:
      row.status === "drafted_waiting_for_teacher_confirmation_rollback_and_evidence_flags"
        ? "Teacher must review metadata-gate preflight evidence before setting evidenceReviewed=true."
        : "Not confirmed by the passed waiting-row validation."
  })),
  locks: lockState
};
const validationCommand = commandLine("validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs", [
  ["--preflight", preflightInput.path || "<original-goal-low-token-metadata-gate-preflight.json>"],
  ["--receipt", draftReceiptPath],
  ["--output-dir", join(draftDir, "receipt-validation")]
]);
const packet = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_draft_v1",
  draftId,
  createdAt: new Date().toISOString(),
  goal,
  status:
    matchedReadyRows.length > 0
      ? "waiting_for_teacher_to_complete_metadata_gate_preflight_receipt"
      : "blocked_no_waiting_row_validated_metadata_gate_rows",
  sourceEvidence: {
    waitingRowValidation: validationInput.path,
    preflight: preflightInput.path,
    receiptTemplate: templateInput.path || ""
  },
  counts: {
    preflightRows: preflightRows.length,
    waitingRowValidationReadyRows: validation.counts?.readyRows || 0,
    preflightReadyRows: preflightRows.filter((row) => row.readyForTeacherConfirmedMetadataGate === true).length,
    matchedReadyRows: matchedReadyRows.length,
    draftRowsStillRequireTeacherEvidenceFlags: matchedReadyRows.length,
    rowsThatWouldValidateWithoutTeacherEdits: 0,
    rollbackPointStillRequired: true,
    teacherConfirmationStillRequired: true,
    commandGenerationStillDisabled: true
  },
  reviewRows,
  paths: {
    draftPacket: draftPacketPath,
    draftReceipt: draftReceiptPath,
    html: htmlPath,
    readme: readmePath,
    sourceWaitingRowValidation: validationInput.path,
    sourcePreflight: preflightInput.path,
    sourceReceiptTemplate: templateInput.path || "",
    metadataGatePreflightReceiptValidationCommandTemplate: validationCommand
  },
  nextSafeCommand: {
    label: "After teacher edits the metadata-gate preflight receipt draft, validate it.",
    commandLine: validationCommand,
    executesNow: false,
    blockedUntil: "teacher adds confirmation text, retained rollback point, allowCommandGeneration, and row evidenceReviewed flags"
  },
  blockedTransitions: [
    "run_metadata_gate_from_draft",
    "read_logs_from_draft",
    "read_full_logs_from_draft",
    "capture_screenshot_from_draft",
    "execute_target_software_from_draft",
    "register_schedule_from_draft",
    "write_memory_from_draft",
    "claim_all_software_coverage_complete_from_draft",
    "claim_original_goal_complete_from_draft"
  ],
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    goalComplete: false,
    reason: "This draft only bridges a passed waiting-row validation into the separate metadata-gate receipt validator."
  },
  locks: lockState
};

writeJsonFile(draftReceiptPath, receipt);
writeJsonFile(draftPacketPath, packet);
writeHtml(htmlPath, packet);
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_draft_result_v1",
      draftPath: draftPacketPath,
      draftReceiptPath,
      htmlPath,
      readmePath,
      status: packet.status,
      counts: packet.counts,
      nextSafeCommand: packet.nextSafeCommand,
      locks: lockState
    },
    null,
    2
  )
);
