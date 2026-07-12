#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-ready-metadata-gate-shortlist")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-ready-metadata-gate-shortlist"
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

function writeJsonFile(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
    shortlistDoesNotRunMetadataGate: true,
    shortlistDoesNotReadLogs: true,
    shortlistDoesNotReadFullLogs: true,
    shortlistDoesNotCaptureScreenshots: true,
    shortlistDoesNotExecuteTargetSoftware: true,
    shortlistDoesNotRegisterSchedule: true,
    shortlistDoesNotWriteMemory: true,
    draftReceiptIsNotTeacherConfirmation: true,
    draftReceiptRequiresTeacherEvidenceReviewFlags: true,
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

function readyRows(cockpit) {
  return (Array.isArray(cockpit.reviewRows) ? cockpit.reviewRows : []).filter(
    (row) =>
      row.reviewStatus === "ready_for_teacher_confirmed_metadata_gate_receipt" &&
      row.coverageContractReview?.allowsMetadataGateReview === true &&
      row.coverageContractReview?.status === "coverage_contract_metadata_gate_ready_pending_teacher_review"
  );
}

function blockedRows(cockpit) {
  const ready = new Set(readyRows(cockpit).map((row) => String(row.rowId)));
  return (Array.isArray(cockpit.reviewRows) ? cockpit.reviewRows : []).filter((row) => !ready.has(String(row.rowId)));
}

function draftReceipt(cockpit, ready, blocked, lockState) {
  return {
    format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_v1",
    draftOnly: true,
    templateOnly: true,
    defaultDecision: "needs_teacher_review",
    cockpitId: cockpit.cockpitId,
    sourceDossier: cockpit.paths?.sourceDossier || "",
    sourceMetadataGatePreflight: cockpit.paths?.sourceMetadataGatePreflight || "",
    sourceLogSourceDiscoveryLedger: cockpit.paths?.sourceLogSourceDiscoveryLedger || "",
    decision: "needs_teacher_review",
    teacherMustEditBeforeValidation: true,
    draftSafetyNote:
      "Ready rows are suggested only. This draft intentionally keeps evidenceReviewed=false and allowMetadataGatePreparation=false so validation fails until the teacher explicitly reviews and flips both fields.",
    rowDecisions: [
      ...ready.map((row) => ({
        rowId: row.rowId,
        software: row.software,
        coverageContractStatus: row.coverageContractReview?.status || "",
        coverageContractMissingRequirements: row.coverageContractReview?.missingRequirements || [],
        teacherDecision: "teacher_ready_for_metadata_gate_receipt",
        evidenceReviewed: false,
        allowMetadataGatePreparation: false,
        requireMoreEvidence: false,
        draftSuggestedByShortlist: true,
        teacherNote: "Teacher must review this row and set evidenceReviewed=true plus allowMetadataGatePreparation=true."
      })),
      ...blocked.map((row) => ({
        rowId: row.rowId,
        software: row.software,
        coverageContractStatus: row.coverageContractReview?.status || "",
        coverageContractMissingRequirements: row.coverageContractReview?.missingRequirements || [],
        teacherDecision: "blocked_needs_more_low_token_evidence",
        evidenceReviewed: false,
        allowMetadataGatePreparation: false,
        requireMoreEvidence: true,
        draftSuggestedByShortlist: true,
        teacherNote: "Still blocked; keep collecting compact evidence or route proof before metadata-gate preparation."
      }))
    ],
    blockedTeacherDecisions: [
      "accepted",
      "run_metadata_gate_now",
      "read_logs_now",
      "read_full_logs",
      "capture_screenshot_now",
      "execute_now",
      "memory_enabled",
      "claim_complete",
      "native_universal_execution",
      "unlock_packaging"
    ],
    locks: lockState
  };
}

function writeReadme(path, packet) {
  const lines = [
    "# Original Goal Low-Token Ready Metadata Gate Shortlist",
    "",
    `Status: ${packet.status}`,
    `Ready rows: ${packet.counts.readyRows}`,
    `Blocked rows kept visible: ${packet.counts.blockedRows}`,
    "",
    "Teacher workflow:",
    "1. Open the shortlist HTML and review the ready rows.",
    "2. Open the draft cockpit receipt JSON.",
    "3. For each row the teacher truly approves, keep teacherDecision=teacher_ready_for_metadata_gate_receipt and change evidenceReviewed plus allowMetadataGatePreparation to true.",
    "4. Run the waiting-row cockpit receipt validation command.",
    "5. Only after that validator passes may the separate metadata-gate preflight receipt be reviewed.",
    "",
    "Safety boundary:",
    "- This shortlist is review-only.",
    "- The draft receipt is not teacher confirmation.",
    "- It does not run metadata gates, read logs, capture screenshots, execute target software, register schedules, write memory, enable rules, accept coverage, or claim completion.",
    "",
    `- Shortlist packet: ${packet.paths.shortlist}`,
    `- Shortlist HTML: ${packet.paths.html}`,
    `- Draft cockpit receipt: ${packet.paths.draftReceipt}`,
    `- Waiting-row cockpit validation command template: ${packet.paths.waitingRowCockpitReceiptValidationCommandTemplate}`,
    `- Metadata-gate preflight receipt template: ${packet.paths.metadataGatePreflightReceiptTemplate}`,
    `- Metadata-gate preflight validation command template: ${packet.paths.metadataGatePreflightReceiptValidationCommandTemplate}`
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  const readyRowsHtml = packet.readyRows
    .map(
      (row) => `<tr><td>${htmlEscape(row.rowId)}</td><td>${htmlEscape(row.software)}</td><td>${htmlEscape(
        row.ledgerNumber
      )}</td><td>${htmlEscape(row.reviewReason)}</td><td>${htmlEscape(row.teacherEditRequired)}</td></tr>`
    )
    .join("\n");
  const blockedRowsHtml = packet.blockedRows
    .map(
      (row) => `<tr><td>${htmlEscape(row.rowId)}</td><td>${htmlEscape(row.software)}</td><td>${htmlEscape(
        row.blockers.join(", ")
      )}</td><td>${htmlEscape(row.nextSafeAction)}</td></tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ready Metadata Gate Shortlist</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 10px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); margin-top: 16px; }
    .badges { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .warn { background: #fff7df; color: #795400; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; border-bottom: 1px solid #e6ebf2; padding: 8px; vertical-align: top; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #155aa8; }
  </style>
</head>
<body>
  <main>
    <h1>Ready Metadata Gate Shortlist</h1>
    <div class="badges">
      <span class="badge">review only</span>
      <span class="badge warn">draft is not teacher confirmation</span>
      <span class="badge warn">no metadata gate run</span>
    </div>
    <section class="panel">
      <p>Status: <code>${htmlEscape(packet.status)}</code></p>
      <p>Ready rows: <code>${htmlEscape(packet.counts.readyRows)}</code>; blocked rows kept visible: <code>${htmlEscape(
        packet.counts.blockedRows
      )}</code></p>
      <p>Draft receipt: <a href="${htmlEscape(packet.paths.draftReceipt)}">${htmlEscape(packet.paths.draftReceipt)}</a></p>
      <p>Validate after teacher edits: <code>${htmlEscape(packet.paths.draftReceiptValidationCommand)}</code></p>
    </section>
    <section class="panel">
      <h2>Ready Rows</h2>
      <table>
        <thead><tr><th>Row</th><th>Software</th><th>Ledger</th><th>Why ready</th><th>Teacher edit required</th></tr></thead>
        <tbody>${readyRowsHtml}</tbody>
      </table>
    </section>
    <section class="panel">
      <h2>Blocked Rows</h2>
      <table>
        <thead><tr><th>Row</th><th>Software</th><th>Blockers</th><th>Next safe action</th></tr></thead>
        <tbody>${blockedRowsHtml}</tbody>
      </table>
    </section>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build a review-only shortlist for ready low-token metadata-gate rows.");
const cockpitInput = readJsonInput(
  argValue("--cockpit", argValue("--waiting-row-cockpit", "")),
  "--cockpit",
  "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1"
);
if (!cockpitInput.value) throw new Error("--cockpit is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-ready-metadata-gate-shortlists")
  )
);
mkdirSync(outputRoot, { recursive: true });
const shortlistId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const shortlistDir = join(outputRoot, shortlistId);
mkdirSync(shortlistDir, { recursive: true });

const shortlistPath = join(shortlistDir, "original-goal-low-token-ready-metadata-gate-shortlist.json");
const htmlPath = join(shortlistDir, "original-goal-low-token-ready-metadata-gate-shortlist.html");
const readmePath = join(shortlistDir, "ORIGINAL_GOAL_LOW_TOKEN_READY_METADATA_GATE_SHORTLIST_START_HERE.md");
const draftReceiptPath = join(shortlistDir, "teacher-draft-low-token-waiting-row-cockpit-receipt.json");
const lockState = locks();
const cockpit = cockpitInput.value;
const ready = readyRows(cockpit);
const blocked = blockedRows(cockpit);
const waitingRowValidationCommand = commandLine("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
  ["--cockpit", cockpitInput.path || "<original-goal-low-token-coverage-waiting-row-cockpit.json>"],
  ["--receipt", "<teacher-filled-low-token-waiting-row-cockpit-receipt.json>"],
  ["--output-dir", join(shortlistDir, "receipt-validation")]
]);
const draftReceiptValidationCommand = commandLine("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
  ["--cockpit", cockpitInput.path || "<original-goal-low-token-coverage-waiting-row-cockpit.json>"],
  ["--receipt", draftReceiptPath],
  ["--output-dir", join(shortlistDir, "draft-receipt-validation")]
]);
const metadataGateValidationCommand =
  argValue("--metadata-gate-validation-command", argValue("--metadata-gate-preflight-validation-command", "")) ||
  commandLine("validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs", [
    ["--preflight", cockpit.paths?.sourceMetadataGatePreflight || "<original-goal-low-token-metadata-gate-preflight.json>"],
    ["--receipt", "<teacher-filled-low-token-metadata-gate-preflight-receipt.json>"],
    ["--output-dir", join(shortlistDir, "metadata-gate-preflight-receipt-validation")]
  ]);
const metadataGateReceiptTemplate = argValue("--metadata-gate-receipt-template", argValue("--metadata-gate-preflight-receipt-template", ""));
const receipt = draftReceipt(cockpit, ready, blocked, lockState);
const packet = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_ready_metadata_gate_shortlist_v1",
  shortlistId,
  createdAt: new Date().toISOString(),
  goal,
  status:
    ready.length > 0
      ? "waiting_for_teacher_to_review_ready_metadata_gate_shortlist"
      : "blocked_no_ready_metadata_gate_rows",
  sourceEvidence: {
    cockpit: cockpitInput.path,
    metadataGatePreflight: cockpit.paths?.sourceMetadataGatePreflight || "",
    metadataGatePreflightReceiptTemplate: metadataGateReceiptTemplate
  },
  counts: {
    totalRows: Array.isArray(cockpit.reviewRows) ? cockpit.reviewRows.length : 0,
    readyRows: ready.length,
    blockedRows: blocked.length,
    draftReadyRowsWithTeacherDecisionSuggestion: ready.length,
    draftRowsStillRequiringTeacherEvidenceFlags: ready.length,
    rowsThatWouldValidateWithoutTeacherEdits: 0
  },
  readyRows: ready.map((row) => ({
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber || "",
    software: row.software || "",
    processName: row.processName || "",
    reviewReason:
      "coverage contract, metadata-gate preflight, and current log-source route are all ready for teacher review",
    teacherEditRequired: "set evidenceReviewed=true and allowMetadataGatePreparation=true only after review",
    nextSafeAction: "teacher edits the draft cockpit receipt, then runs the waiting-row receipt validator",
    sourceCoverageContractStatus: row.coverageContractReview?.status || "",
    sourceMetadataGatePreflightStatus: row.metadataGatePreflightReview?.status || "",
    sourceLogSourceLedgerStatus: row.logSourceLedgerReview?.discoveryStatus || "",
    locks: lockState
  })),
  blockedRows: blocked.map((row) => ({
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber || "",
    software: row.software || "",
    processName: row.processName || "",
    reviewStatus: row.reviewStatus || "",
    blockers: Array.isArray(row.blockers) ? row.blockers : [],
    nextSafeAction:
      row.coverageContractReview?.nextContractAction ||
      row.metadataGatePreflightReview?.nextSafeAction ||
      "collect more compact evidence before metadata-gate receipt review",
    locks: lockState
  })),
  paths: {
    shortlist: shortlistPath,
    html: htmlPath,
    readme: readmePath,
    draftReceipt: draftReceiptPath,
    sourceCockpit: cockpitInput.path,
    metadataGatePreflightReceiptTemplate: metadataGateReceiptTemplate,
    waitingRowCockpitReceiptValidationCommandTemplate: waitingRowValidationCommand,
    draftReceiptValidationCommand,
    metadataGatePreflightReceiptValidationCommandTemplate: metadataGateValidationCommand
  },
  nextSafeCommand: {
    label: "After teacher edits the draft receipt, validate the waiting-row cockpit receipt.",
    commandLine: waitingRowValidationCommand,
    draftCommandLine: draftReceiptValidationCommand,
    executesNow: false,
    blockedUntil:
      "teacher explicitly reviews rows and sets evidenceReviewed=true plus allowMetadataGatePreparation=true for approved rows"
  },
  blockedTransitions: [
    "run_metadata_gate_from_shortlist",
    "read_logs_from_shortlist",
    "read_full_logs_from_shortlist",
    "capture_screenshot_from_shortlist",
    "execute_target_software_from_shortlist",
    "register_schedule_from_shortlist",
    "write_memory_from_shortlist",
    "claim_all_software_coverage_complete_from_shortlist",
    "claim_original_goal_complete_from_shortlist"
  ],
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    goalComplete: false,
    reason: "This shortlist only reduces teacher review cost for ready metadata-gate rows. It does not prove coverage or execute any software."
  },
  locks: lockState
};

writeJsonFile(draftReceiptPath, receipt);
writeJsonFile(shortlistPath, packet);
writeHtml(htmlPath, packet);
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_ready_metadata_gate_shortlist_result_v1",
      shortlistPath,
      htmlPath,
      readmePath,
      draftReceiptPath,
      status: packet.status,
      counts: packet.counts,
      nextSafeCommand: packet.nextSafeCommand,
      locks: lockState
    },
    null,
    2
  )
);
