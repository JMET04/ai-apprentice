#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-coverage-waiting-row-cockpit-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-coverage-waiting-row-cockpit-receipt-validation"
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
    validationDoesNotRunMetadataGate: true,
    validationDoesNotReadLogs: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotRegisterSchedule: true,
    validationDoesNotWriteMemory: true,
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

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_ready_for_metadata_gate_receipt", "ready_for_metadata_gate_receipt"].includes(text)) {
    return "teacher_ready_for_metadata_gate_receipt";
  }
  if (["blocked", "blocked_needs_more_evidence", "blocked_needs_more_low_token_evidence"].includes(text)) {
    return "blocked_needs_more_low_token_evidence";
  }
  if (
    [
      "accepted",
      "run_metadata_gate_now",
      "read_logs_now",
      "read_full_logs",
      "capture_screenshot_now",
      "execute_now",
      "memory_enabled",
      "claim_complete",
      "native_universal_execution",
      "run_now",
      "execute_software",
      "write_memory",
      "register_schedule",
      "unlock_packaging"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function writeReadme(path, validation) {
  const lines = [
    "# Original Goal Low-Token Coverage Waiting Row Cockpit Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.rowId}: ${row.status}`),
    "",
    "Next safe command:",
    validation.nextSafeCommand?.commandLine || "- None",
    "",
    "Safety boundary:",
    "- This validation only checks a teacher-filled waiting-row cockpit receipt.",
    "- It does not run metadata gates, read logs, read full logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "- Rows marked ready here must still pass the separate metadata-gate preflight receipt validator before any allowlisted command can be prepared."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, validation) {
  const rows = validation.validationRows
    .map(
      (row) => `<tr><td>${htmlEscape(row.rowId)}</td><td>${htmlEscape(row.software)}</td><td>${htmlEscape(
        row.normalizedDecision
      )}</td><td>${htmlEscape(row.status)}</td><td>${htmlEscape(row.nextAction)}</td></tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Waiting Row Cockpit Receipt Validation</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); margin-top: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; border-bottom: 1px solid #e6ebf2; padding: 8px; vertical-align: top; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .warn { background: #fff7df; color: #795400; }
  </style>
</head>
<body>
  <main>
    <h1>Waiting Row Cockpit Receipt Validation</h1>
    <p><span class="badge">review only</span> <span class="badge warn">no metadata gate run</span></p>
    <section class="panel">
      <p>Status: <code>${htmlEscape(validation.status)}</code></p>
      <p>Decision: <code>${htmlEscape(validation.validationDecision)}</code></p>
      <p>Next safe command: <code>${htmlEscape(validation.nextSafeCommand?.commandLine || "")}</code></p>
    </section>
    <section class="panel">
      <table>
        <thead><tr><th>Row</th><th>Software</th><th>Decision</th><th>Status</th><th>Next action</th></tr></thead>
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

const goal = argValue("--goal", "Validate teacher receipt for original-goal low-token coverage waiting row cockpit.");
const cockpitInput = readJsonInput(
  argValue("--cockpit", argValue("--waiting-row-cockpit", "")),
  "--cockpit",
  "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1"
);
if (!cockpitInput.value) throw new Error("--cockpit is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-coverage-waiting-row-cockpit-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const cockpit = cockpitInput.value;
const receipt = receiptInput.value;
const lockState = locks();
const forbidden = new Set([
  "accepted",
  "run_metadata_gate_now",
  "read_logs_now",
  "read_full_logs",
  "capture_screenshot_now",
  "execute_now",
  "memory_enabled",
  "claim_complete",
  "native_universal_execution",
  "run_now",
  "execute_software",
  "write_memory",
  "register_schedule",
  "unlock_packaging"
]);
const allowed = new Set([
  "needs_teacher_review",
  "teacher_ready_for_metadata_gate_receipt",
  "blocked_needs_more_low_token_evidence"
]);
const receiptRows = new Map((Array.isArray(receipt.rowDecisions) ? receipt.rowDecisions : []).map((row) => [String(row.rowId), row]));
const extraReceiptRows = (Array.isArray(receipt.rowDecisions) ? receipt.rowDecisions : []).filter(
  (row) => !cockpit.reviewRows?.some((sourceRow) => String(sourceRow.rowId) === String(row.rowId))
);
const cockpitIdMatches = String(receipt.cockpitId || "") === String(cockpit.cockpitId || "");
const topLevelDecision = normalizeDecision(receipt.decision);
const topLevelForbidden = forbidden.has(topLevelDecision);
const evidencePlanReturnCache = new Map();

function samePath(left, right) {
  if (!left || !right) return false;
  try {
    return resolve(left) === resolve(right);
  } catch {
    return String(left) === String(right);
  }
}

function evidencePlanReturnForRow(rowId, receiptRow) {
  const evidencePath =
    receiptRow.evidencePlanReceiptValidationPath ||
    receiptRow.reviewedEvidencePlanReceiptValidationPath ||
    receipt.evidencePlanReceiptValidationPath ||
    receipt.sourceEvidence?.evidencePlanReceiptValidation ||
    "";
  if (!evidencePath) {
    return {
      path: "",
      ready: false,
      status: "evidence_plan_return_validation_not_provided"
    };
  }
  if (!existsSync(evidencePath)) {
    return {
      path: evidencePath,
      ready: false,
      status: "evidence_plan_return_validation_path_missing"
    };
  }
  if (!evidencePlanReturnCache.has(evidencePath)) {
    evidencePlanReturnCache.set(evidencePath, readJson(evidencePath));
  }
  const validation = evidencePlanReturnCache.get(evidencePath);
  const sourceCockpit = validation?.sourceEvidence?.sourceCockpit || "";
  const row = (validation?.validationRows || []).find((candidate) => String(candidate.rowId) === String(rowId));
  const cockpitMatches = sourceCockpit ? samePath(sourceCockpit, cockpitInput.path) : false;
  const ready =
    validation?.format === "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_validation_v1" &&
    validation?.ok === true &&
    validation?.status === "evidence_plan_receipt_ready_to_return_to_waiting_row_cockpit" &&
    cockpitMatches &&
    row?.readyToReturnToCockpitReview === true;
  return {
    path: evidencePath,
    ready,
    status: ready
      ? "ready_from_validated_blocked_waiting_row_evidence_plan_receipt"
      : "evidence_plan_return_validation_not_ready_for_this_cockpit_row"
  };
}

const validationRows = (cockpit.reviewRows || []).map((sourceRow) => {
  const receiptRow = receiptRows.get(String(sourceRow.rowId)) || {};
  const missingReceiptRow = !receiptRows.has(String(sourceRow.rowId));
  const normalizedDecision = normalizeDecision(receiptRow.teacherDecision);
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const allowMetadataGatePreparation = receiptRow.allowMetadataGatePreparation === true;
  const sourceReady = sourceRow.reviewStatus === "ready_for_teacher_confirmed_metadata_gate_receipt";
  const coverageContractStatus = sourceRow.coverageContractReview?.status || "";
  const coverageContractAllowsMetadataGate =
    sourceRow.coverageContractReview?.allowsMetadataGateReview === true &&
    coverageContractStatus === "coverage_contract_metadata_gate_ready_pending_teacher_review";
  const evidencePlanReturn = evidencePlanReturnForRow(sourceRow.rowId, receiptRow);
  const sourceReadyFromEvidencePlanReturn = evidencePlanReturn.ready === true;
  const sourceReadyForReceipt = (sourceReady && coverageContractAllowsMetadataGate) || sourceReadyFromEvidencePlanReturn;
  const forbiddenDecision = forbidden.has(normalizedDecision) || topLevelForbidden;
  const allowedDecision = allowed.has(normalizedDecision);
  const canProceedToMetadataGateReceipt =
    cockpitIdMatches &&
    !missingReceiptRow &&
    !forbiddenDecision &&
    allowedDecision &&
    sourceReadyForReceipt &&
    normalizedDecision === "teacher_ready_for_metadata_gate_receipt" &&
    evidenceReviewed &&
    allowMetadataGatePreparation;
  const status = !cockpitIdMatches
    ? "blocked_cockpit_id_mismatch"
    : missingReceiptRow
      ? "needs_teacher_review_missing_receipt_row"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : !allowedDecision
          ? "blocked_for_unknown_decision"
        : normalizedDecision === "teacher_ready_for_metadata_gate_receipt" && !coverageContractAllowsMetadataGate && !sourceReadyFromEvidencePlanReturn
          ? "blocked_coverage_contract_not_ready_for_metadata_gate_receipt"
        : normalizedDecision === "teacher_ready_for_metadata_gate_receipt" && !sourceReadyForReceipt
          ? "blocked_source_row_not_ready_or_missing_evidence_plan_return_validation"
          : normalizedDecision === "teacher_ready_for_metadata_gate_receipt" && (!evidenceReviewed || !allowMetadataGatePreparation)
            ? "blocked_missing_evidence_review_or_metadata_preparation_flag"
              : canProceedToMetadataGateReceipt
                ? "ready_for_metadata_gate_preflight_receipt_review"
                : normalizedDecision === "blocked_needs_more_low_token_evidence"
                  ? "blocked_needs_more_low_token_evidence"
                  : "needs_teacher_review";
  return {
    rowId: sourceRow.rowId,
    ledgerNumber: sourceRow.ledgerNumber || receiptRow.ledgerNumber || "",
    software: sourceRow.software || receiptRow.software || "",
    sourceReviewStatus: sourceRow.reviewStatus || "",
    sourceCoverageContractStatus: coverageContractStatus,
    sourceCoverageContractAllowsMetadataGate: coverageContractAllowsMetadataGate,
    sourceCoverageContractMissingRequirements: sourceRow.coverageContractReview?.missingRequirements || [],
    sourceReady,
    sourceReadyFromEvidencePlanReturn,
    evidencePlanReturnStatus: evidencePlanReturn.status,
    evidencePlanReceiptValidationPath: evidencePlanReturn.path,
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision,
    evidenceReviewed,
    allowMetadataGatePreparation,
    status,
    canProceedToMetadataGateReceipt,
    nextAction: canProceedToMetadataGateReceipt
      ? "fill_and_validate_metadata_gate_preflight_receipt"
      : status.startsWith("blocked")
        ? "repair_teacher_receipt_or_collect_more_low_token_evidence"
        : "continue_teacher_review",
    locks: lockState
  };
});

const extraRows = extraReceiptRows.map((row) => ({
  rowId: row.rowId || "",
  software: row.software || "",
  receiptDecision: row.teacherDecision || "",
  normalizedDecision: normalizeDecision(row.teacherDecision),
  status: "blocked_unknown_cockpit_row",
  canProceedToMetadataGateReceipt: false,
  nextAction: "remove_unknown_receipt_row",
  locks: lockState
}));

const forbiddenDecisionRows = validationRows.filter((row) => row.status === "blocked_for_forbidden_decision").length;
const blockedRows = validationRows.filter((row) => row.status.startsWith("blocked")).length + extraRows.length;
const readyRows = validationRows.filter((row) => row.canProceedToMetadataGateReceipt);
const severeBlockedRows = validationRows.filter(
  (row) =>
    row.status.startsWith("blocked") &&
    row.status !== "blocked_needs_more_low_token_evidence"
);
const invalidRows =
  severeBlockedRows.length +
  validationRows.filter((row) => row.status === "needs_teacher_review_missing_receipt_row").length +
  extraRows.length;
const blocked = !cockpitIdMatches || topLevelForbidden || forbiddenDecisionRows > 0 || extraRows.length > 0 || invalidRows > 0;
const nextSafeCommand =
  readyRows.length > 0 && !blocked
    ? {
        tool: "validate_original_goal_low_token_metadata_gate_preflight_receipt",
        commandLine: commandLine("validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs", [
          ["--preflight", cockpit.paths?.sourceMetadataGatePreflight || "<original-goal-low-token-metadata-gate-preflight.json>"],
          ["--receipt", "<teacher-filled-low-token-metadata-gate-preflight-receipt.json>"],
          ["--output-dir", join(validationDir, "metadata-gate-preflight-receipt-validation")]
        ]),
        executesNow: false,
        readyRowIds: readyRows.map((row) => row.rowId),
        blockedUntil: "teacher fills and validates the separate metadata-gate preflight receipt"
      }
    : null;
const validationDecision = blocked
  ? "blocked_for_forbidden_or_unready_decision"
  : readyRows.length > 0
    ? "ready_for_metadata_gate_preflight_receipt_review"
    : "needs_teacher_review";
const status = blocked
  ? "blocked"
  : readyRows.length > 0
    ? "waiting_for_metadata_gate_preflight_receipt_after_cockpit_review"
    : "waiting_for_teacher_low_token_waiting_row_review";

const validationPath = join(validationDir, "original-goal-low-token-coverage-waiting-row-cockpit-receipt-validation.json");
const htmlPath = join(validationDir, "original-goal-low-token-coverage-waiting-row-cockpit-receipt-validation.html");
const readmePath = join(
  validationDir,
  "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_WAITING_ROW_COCKPIT_RECEIPT_VALIDATION_START_HERE.md"
);
const validation = {
  ok: !blocked,
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  sourceEvidence: {
    cockpit: cockpitInput.path,
    receipt: receiptInput.path
  },
  counts: {
    cockpitRows: cockpit.reviewRows?.length || 0,
    receiptRows: Array.isArray(receipt.rowDecisions) ? receipt.rowDecisions.length : 0,
    readyRows: readyRows.length,
    blockedRows,
    invalidRows,
    forbiddenDecisionRows,
    unknownReceiptRows: extraRows.length
  },
  receiptGate: {
    cockpitIdMatches,
    decision: receipt.decision || "",
    normalizedDecision: topLevelDecision
  },
  validationRows,
  extraRows,
  nextSafeCommand,
  blockedTransitions: [
    "run_metadata_gate_from_cockpit_receipt_validation",
    "read_logs_from_cockpit_receipt_validation",
    "read_full_logs_from_cockpit_receipt_validation",
    "capture_screenshot_from_cockpit_receipt_validation",
    "execute_target_software_from_cockpit_receipt_validation",
    "register_schedule_from_cockpit_receipt_validation",
    "write_memory_from_cockpit_receipt_validation",
    "claim_all_software_coverage_complete_from_cockpit_receipt_validation",
    "claim_original_goal_complete_from_cockpit_receipt_validation"
  ],
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    goalComplete: false,
    reason:
      "Waiting-row cockpit receipt validation is only a review gate before the separate metadata-gate preflight receipt. It never runs software or claims coverage."
  },
  paths: {
    validation: validationPath,
    html: htmlPath,
    readme: readmePath,
    sourceCockpit: cockpitInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: lockState
};

writeJsonFile(validationPath, validation);
writeHtml(htmlPath, validation);
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_validation_result_v1",
      validationPath,
      htmlPath,
      readmePath,
      status,
      validationDecision,
      counts: validation.counts,
      nextSafeCommand,
      locks: lockState
    },
    null,
    2
  )
);
if (!validation.ok) process.exit(1);
