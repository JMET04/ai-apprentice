#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
    String(value || "low-token-compact-evidence-request-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "low-token-compact-evidence-request-receipt-validation"
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

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (
    [
      "needs_teacher_review",
      "compact_metadata_request_confirmed",
      "blocked_needs_manual_teacher_marker",
      "teacher_excluded_from_monitoring",
      "correction_to_high_reasoning_repair"
    ].includes(decision)
  ) {
    return decision;
  }
  if (
    [
      "accepted",
      "run_metadata_gate_now",
      "run_watch_cycle_now",
      "read_logs_now",
      "read_full_logs",
      "capture_screenshot_now",
      "execute_now",
      "write_memory",
      "register_schedule",
      "unlock_packaging",
      "claim_complete"
    ].includes(decision)
  ) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    commandTemplateOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRunMetadataCollection: true,
    validationDoesNotRunWatchCycle: true,
    validationDoesNotReadLogs: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotRegisterSchedule: true,
    validationDoesNotWriteMemory: true,
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

function writeHtml(path, validation) {
  const rows = validation.validationRows
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.ledgerNumber)}</td>
        <td>${htmlEscape(row.software)}</td>
        <td>${htmlEscape(row.evidenceMode)}</td>
        <td>${htmlEscape(row.normalizedDecision)}</td>
        <td>${htmlEscape(row.status)}</td>
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
  <title>Compact Evidence Request Receipt Validation</title>
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
  <h1>Compact Evidence Request Receipt Validation</h1>
  <section class="panel">
    <p><strong>Status:</strong> ${htmlEscape(validation.status)}</p>
    <p><strong>Ready rows:</strong> ${htmlEscape(validation.counts.readyRows)}; <strong>invalid rows:</strong> ${htmlEscape(validation.counts.invalidRows)}</p>
    <p><strong>Next command:</strong> <code>${htmlEscape(validation.nextPreparedCommand?.commandLine || "")}</code></p>
  </section>
  <table>
    <thead><tr><th>#</th><th>Software</th><th>Evidence mode</th><th>Decision</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>
`,
    "utf8"
  );
}

const requestInput = readJsonInput(
  argValue("--request-pack", argValue("--pack", "")),
  "--request-pack",
  "transparent_ai_original_goal_low_token_compact_evidence_request_pack_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_v1"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue(
      "--out-dir",
      join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-compact-evidence-request-receipt-validations")
    )
  )
);

const requestPack = requestInput.value;
const receipt = receiptInput.value;
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(requestPack.packId || "compact-evidence-request")}`;
const validationDir = join(outputRoot, validationId);
const validationPath = join(validationDir, "original-goal-low-token-compact-evidence-request-receipt-validation.json");
const htmlPath = join(validationDir, "original-goal-low-token-compact-evidence-request-receipt-validation.html");
const readmePath = join(validationDir, "ORIGINAL_GOAL_LOW_TOKEN_COMPACT_EVIDENCE_REQUEST_RECEIPT_VALIDATION_START_HERE.md");
const lockState = locks();
const forbidden = new Set([
  "accepted",
  "run_metadata_gate_now",
  "run_watch_cycle_now",
  "read_logs_now",
  "read_full_logs",
  "capture_screenshot_now",
  "execute_now",
  "write_memory",
  "register_schedule",
  "unlock_packaging",
  "claim_complete"
]);

const requestRowsById = new Map((requestPack.requestRows || []).map((row) => [String(row.rowId || ""), row]));
const receiptRows = Array.isArray(receipt.requestRows) ? receipt.requestRows : [];
const receiptRowsById = new Map(receiptRows.map((row) => [String(row.rowId || ""), row]));
const blockers = [];
const topDecision = normalizeDecision(receipt.teacherDecision);
if (receipt.sourceRequestPackPath && requestInput.path && resolve(receipt.sourceRequestPackPath) !== resolve(requestInput.path)) {
  blockers.push("receipt_source_request_pack_path_mismatch");
}
if (forbidden.has(topDecision)) blockers.push("forbidden_top_level_decision");
if (receipt.rollbackRetained !== true) blockers.push("rollback_not_retained");
if (receipt.noFullLogReadConfirmed !== true) blockers.push("no_full_log_read_not_confirmed");
if (receipt.noScreenshotConfirmed !== true) blockers.push("no_screenshot_not_confirmed");
if (receipt.noSoftwareExecutionConfirmed !== true) blockers.push("no_software_execution_not_confirmed");

const validationRows = (requestPack.requestRows || []).map((requestRow) => {
  const receiptRow = receiptRowsById.get(String(requestRow.rowId || ""));
  const decision = normalizeDecision(receiptRow?.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const sourceReady = requestRow.readyForTeacherConfirmedCompactEvidenceRequest === true;
  const reviewed = receiptRow?.reviewedCompactEvidenceRequest === true;
  const notAlreadyCollected = receiptRow?.compactEvidenceCollected !== true;
  const notePresent = Boolean(String(receiptRow?.teacherNote || "").trim());
  const ready =
    sourceReady &&
    !forbiddenDecision &&
    decision === "compact_metadata_request_confirmed" &&
    reviewed &&
    notAlreadyCollected;
  const status = !receiptRow
    ? "blocked_missing_receipt_row"
    : forbiddenDecision
      ? "blocked_for_forbidden_decision"
      : decision === "teacher_excluded_from_monitoring"
        ? "teacher_excluded_from_monitoring"
        : decision === "correction_to_high_reasoning_repair"
          ? "correction_routes_to_high_reasoning_repair"
          : decision === "blocked_needs_manual_teacher_marker"
            ? "blocked_needs_manual_teacher_marker"
            : ready
              ? "ready_for_confirmed_metadata_only_collection"
              : "needs_teacher_review_or_confirmed_metadata_request";
  return {
    rowId: requestRow.rowId || "",
    ledgerNumber: requestRow.ledgerNumber || "",
    software: requestRow.software || "",
    routeId: requestRow.routeId || "",
    routeKind: requestRow.routeKind || "",
    evidenceMode: requestRow.evidenceMode || "",
    compactFields: requestRow.compactFields || [],
    forbiddenFields: requestRow.forbiddenFields || [],
    receiptDecision: receiptRow?.teacherDecision || "",
    normalizedDecision: decision,
    reviewedCompactEvidenceRequest: reviewed,
    compactEvidenceCollected: receiptRow?.compactEvidenceCollected === true,
    teacherNotePresent: notePresent,
    status,
    readyForMetadataOnlyCollection: ready,
    blockers: ready
      ? []
      : [
          sourceReady ? "" : "source_request_row_not_ready",
          reviewed ? "" : "compact_evidence_request_not_reviewed",
          notAlreadyCollected ? "" : "compact_evidence_already_collected_or_claimed",
          forbiddenDecision ? "forbidden_decision" : ""
        ].filter(Boolean),
    locks: lockState
  };
});

const extraRows = receiptRows
  .filter((row) => !requestRowsById.has(String(row.rowId || "")))
  .map((row) => ({
    rowId: row.rowId || "",
    software: row.software || "",
    status: "blocked_unknown_request_row",
    readyForMetadataOnlyCollection: false,
    locks: lockState
  }));
if (extraRows.length) blockers.push("unknown_receipt_rows_present");

const readyRows = validationRows.filter((row) => row.readyForMetadataOnlyCollection);
const invalidRows = validationRows.filter(
  (row) =>
    row.status.startsWith("blocked_") ||
    row.status === "needs_teacher_review_or_confirmed_metadata_request"
);
const correctionRows = validationRows.filter((row) => row.status === "correction_routes_to_high_reasoning_repair");
const hardBlocked = blockers.length > 0 || extraRows.length > 0 || validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const status = hardBlocked
  ? "blocked_for_invalid_or_forbidden_compact_evidence_request_receipt"
  : readyRows.length > 0 && invalidRows.length === 0
    ? "validated_with_prepared_compact_metadata_collection_command"
    : readyRows.length > 0
      ? "partially_validated_ready_rows_remaining_rows_need_teacher_review"
      : correctionRows.length > 0
        ? "correction_routes_to_high_reasoning_repair"
        : "needs_teacher_review_before_compact_metadata_collection";

const nextPreparedCommand =
  readyRows.length > 0 && !hardBlocked
    ? {
        tool: "run_original_goal_low_token_compact_evidence_request",
        commandLine: commandLine("run-original-goal-low-token-compact-evidence-request.mjs", [
          ["--validation", validationPath],
          ["--run-confirmed-metadata-only", "true"],
          ["--allow-compact-evidence-runner", "true"],
          ["--teacher-confirmation", "<teacher-confirmed-compact-evidence-request-text>"],
          ["--rollback-point", "<retained-rollback-point-path-or-label>"],
          ["--output-dir", join(validationDir, "confirmed-compact-evidence-run")]
        ]),
        executesNow: false,
        readyRowIds: readyRows.map((row) => row.rowId),
        requiresTeacherConfirmation: true,
        requiresRetainedRollbackPoint: true
      }
    : null;

const validation = {
  ok: !hardBlocked && readyRows.length > 0 && invalidRows.length === 0,
  format: "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  sourceRequestPackPath: requestInput.path,
  sourceReceiptPath: receiptInput.path,
  counts: {
    requestRows: (requestPack.requestRows || []).length,
    readyRows: readyRows.length,
    invalidRows: invalidRows.length,
    correctionRows: correctionRows.length,
    extraRows: extraRows.length,
    blockers: blockers.length
  },
  blockers,
  validationRows,
  extraRows,
  nextPreparedCommand,
  paths: {
    validation: validationPath,
    html: htmlPath,
    readme: readmePath,
    sourceRequestPack: requestInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: lockState,
  executeNow: false,
  goalComplete: false
};

writeJson(validationPath, validation);
writeHtml(htmlPath, validation);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Compact Evidence Request Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Ready rows: ${readyRows.length}`,
    `Invalid rows: ${invalidRows.length}`,
    "",
    "This validation does not collect metadata, read logs, run watch cycles, capture screenshots, execute target software, register schedules, write memory, enable rules, or claim completion.",
    "",
    nextPreparedCommand ? `Next prepared command: ${nextPreparedCommand.commandLine}` : "No prepared command is ready."
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      validationPath,
      htmlPath,
      readmePath,
      status: validation.status,
      counts: validation.counts,
      nextPreparedCommand: nextPreparedCommand?.commandLine || "",
      locks: lockState,
      executeNow: false,
      goalComplete: false
    },
    null,
    2
  )
);
if (!validation.ok) process.exit(1);
