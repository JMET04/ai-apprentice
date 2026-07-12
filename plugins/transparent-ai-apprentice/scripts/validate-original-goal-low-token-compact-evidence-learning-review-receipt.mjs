#!/usr/bin/env node
import { createHash } from "node:crypto";
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

function slugify(value) {
  return (
    String(value || "compact-evidence-learning-review")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84) || "compact-evidence-learning-review"
  );
}

function hashText(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (
    [
      "needs_teacher_review",
      "learning_events_reviewed_return_to_high_reasoning_rule_draft",
      "blocked_needs_more_evidence",
      "correction_to_high_reasoning_repair"
    ].includes(text)
  ) {
    return text;
  }
  if (["ready", "reviewed", "draft_rules", "learning_events_reviewed"].includes(text)) {
    return "learning_events_reviewed_return_to_high_reasoning_rule_draft";
  }
  if (["blocked", "needs_more_evidence"].includes(text)) return "blocked_needs_more_evidence";
  if (["correction", "repair", "high_reasoning_repair"].includes(text)) return "correction_to_high_reasoning_repair";
  if (
    [
      "accepted",
      "accept",
      "approved",
      "approve",
      "enable_rule",
      "enable_rule_now",
      "write_memory",
      "write_memory_now",
      "execute_software",
      "execute_software_now",
      "register_schedule",
      "register_schedule_now",
      "unlock_packaging",
      "claim_complete"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    accepted: false,
    ruleEnabled: false,
    memoryEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packagingUnlocked: false,
    validationDoesNotReadLogs: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteSoftware: true,
    validationDoesNotRegisterSchedule: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotEnableRules: true,
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

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function rowKey(row) {
  return `${row.rowId || ""}::${row.compactEvidenceHash || ""}`;
}

const handoffInput = readJsonInput(
  argValue("--handoff", argValue("--learning-handoff", "")),
  "--handoff",
  "transparent_ai_original_goal_low_token_compact_evidence_learning_handoff_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_low_token_compact_evidence_learning_event_review_receipt_v1"
);
const rollbackPoint = resolve(argValue("--rollback-point", ""));
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-compact-evidence-learning-review-receipt-validations")
  )
);

const handoff = handoffInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const outputId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(handoff.handoffId || "compact-learning-review")}`;
const outputDir = join(outputRoot, outputId);
const validationPath = join(outputDir, "original-goal-low-token-compact-evidence-learning-review-receipt-validation.json");
const readmePath = join(outputDir, "ORIGINAL_GOAL_LOW_TOKEN_COMPACT_EVIDENCE_LEARNING_REVIEW_RECEIPT_VALIDATION_START_HERE.md");
const lockState = locks();

const allowedDecisions = new Set([
  "needs_teacher_review",
  "learning_events_reviewed_return_to_high_reasoning_rule_draft",
  "blocked_needs_more_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecision = !allowedDecisions.has(decision);
const sourceRows = Array.isArray(handoff.learningEventReviewReceiptTemplate?.reviewRows)
  ? handoff.learningEventReviewReceiptTemplate.reviewRows
  : [];
const receiptRows = Array.isArray(receipt.reviewRows) ? receipt.reviewRows : [];
const sourceByKey = new Map(sourceRows.map((row) => [rowKey(row), row]));
const allowedLabels = new Set([
  "success_or_completion",
  "failure_or_blocker",
  "warning",
  "normal_state_change",
  "irrelevant_background_noise",
  "needs_counterexample",
  "correction_to_high_reasoning_repair"
]);

const rowResults = [];
const readyRuleDraftRows = [];
const highReasoningRepairRows = [];
const ignoredRows = [];
for (const row of receiptRows) {
  const source = sourceByKey.get(rowKey(row));
  const label = String(row.selectedTeacherLabel || "").trim();
  const rowDecision = normalizeDecision(row.teacherDecision || decision);
  const errors = [];
  if (!source) errors.push("ROW_NOT_IN_SOURCE_HANDOFF");
  if (!allowedLabels.has(label)) errors.push("INVALID_OR_MISSING_SELECTED_TEACHER_LABEL");
  if (row.reviewedLearningEvent !== true) errors.push("LEARNING_EVENT_NOT_REVIEWED");
  if (!String(row.ruleBoundaryNote || "").trim()) errors.push("MISSING_RULE_BOUNDARY_NOTE");
  if (label !== "irrelevant_background_noise" && !String(row.counterexampleNote || "").trim()) {
    errors.push("MISSING_COUNTEREXAMPLE_NOTE");
  }
  if (["accepted", "enable_rule_now", "write_memory_now", "execute_software_now", "register_schedule_now"].includes(rowDecision)) {
    errors.push("FORBIDDEN_ROW_DECISION");
  }
  const normalized = {
    rowId: row.rowId || "",
    software: row.software || source?.software || "",
    evidenceMode: row.evidenceMode || source?.evidenceMode || "",
    compactEvidenceHash: row.compactEvidenceHash || "",
    selectedTeacherLabel: label,
    reviewedLearningEvent: row.reviewedLearningEvent === true,
    ruleBoundaryNote: String(row.ruleBoundaryNote || "").trim(),
    counterexampleNote: String(row.counterexampleNote || "").trim(),
    rowDecision,
    errors
  };
  rowResults.push(normalized);
  if (errors.length) continue;
  if (label === "irrelevant_background_noise") ignoredRows.push(normalized);
  else if (label === "needs_counterexample" || label === "correction_to_high_reasoning_repair") highReasoningRepairRows.push(normalized);
  else readyRuleDraftRows.push(normalized);
}

const checks = [
  {
    name: "handoff waits for teacher learning event review",
    pass: handoff.status === "waiting_for_teacher_learning_event_review" && handoff.locks?.ruleEnabled === false
  },
  {
    name: "receipt belongs to handoff when path is declared",
    pass:
      !receipt.sourceHandoffPath ||
      !handoffInput.path ||
      resolve(receipt.sourceHandoffPath) === resolve(handoff.paths?.handoff || handoffInput.path)
  },
  {
    name: "teacher decision is allowed and review-only",
    pass: allowedDecisions.has(decision) && !forbiddenDecision
  },
  {
    name: "receipt keeps locked defaults",
    pass:
      receipt.locks?.accepted === false &&
      receipt.locks?.ruleEnabled === false &&
      receipt.locks?.memoryWritten === false &&
      receipt.locks?.targetSoftwareCommandsExecuted === false &&
      receipt.locks?.goalComplete === false
  },
  {
    name: "ready rule draft route retains rollback point",
    pass:
      decision !== "learning_events_reviewed_return_to_high_reasoning_rule_draft" ||
      (receipt.rollbackRetained === true && Boolean(rollbackPoint) && existsSync(rollbackPoint))
  },
  {
    name: "ready rule draft route reviews every non-source-excluded row",
    pass:
      decision !== "learning_events_reviewed_return_to_high_reasoning_rule_draft" ||
      (receiptRows.length === sourceRows.length && rowResults.every((row) => row.errors.length === 0))
  }
];
const failedChecks = checks.filter((check) => !check.pass);
const rowErrors = rowResults.filter((row) => row.errors.length > 0);

let status = "needs_teacher_review_before_rule_draft";
if (forbiddenDecision) status = "blocked_forbidden_teacher_decision";
else if (decision === "blocked_needs_more_evidence") status = "blocked_needs_more_evidence";
else if (decision === "correction_to_high_reasoning_repair") status = "correction_routes_to_high_reasoning_repair";
else if (failedChecks.length > 0 || rowErrors.length > 0) status = "blocked_for_invalid_or_forbidden_learning_review_receipt";
else if (decision === "learning_events_reviewed_return_to_high_reasoning_rule_draft") {
  status = readyRuleDraftRows.length > 0
    ? "validated_for_disabled_rule_draft_or_high_reasoning_repair"
    : "correction_routes_to_high_reasoning_repair";
}

const readyForDisabledRuleDraft = status === "validated_for_disabled_rule_draft_or_high_reasoning_repair";
const validation = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_evidence_learning_review_receipt_validation_v1",
  validationId: outputId,
  createdAt: new Date().toISOString(),
  status,
  normalizedDecision: decision,
  handoffPath: handoffInput.path,
  handoffHash: hashText(JSON.stringify(handoff)),
  receiptPath: receiptInput.path,
  receiptHash: hashText(JSON.stringify(receipt)),
  rollbackPoint: rollbackPoint && existsSync(rollbackPoint) ? rollbackPoint : "",
  sourceCompactLearningEventsPath: handoff.paths?.compactLearningEvents || receipt.sourceCompactLearningEventsPath || "",
  counts: {
    sourceRows: sourceRows.length,
    receiptRows: receiptRows.length,
    readyRuleDraftRows: readyRuleDraftRows.length,
    highReasoningRepairRows: highReasoningRepairRows.length,
    ignoredRows: ignoredRows.length,
    invalidRows: rowErrors.length
  },
  checks,
  failedChecks,
  reviewedRows: rowResults,
  readyRuleDraftRows,
  highReasoningRepairRows,
  ignoredRows,
  readyForDisabledRuleDraft,
  nextPreparedCommand: readyForDisabledRuleDraft
    ? commandLine("create-original-goal-low-token-compact-learning-disabled-rule-draft.mjs", [
        ["--validation", validationPath],
        ["--rollback-point", rollbackPoint],
        ["--teacher-reviewed-learning-events"],
        ["--output-dir", join(dirname(outputDir), "disabled-rule-drafts")]
      ])
    : "",
  nextAllowedActions: readyForDisabledRuleDraft
    ? ["prepare_disabled_rule_draft_package", "route_uncertain_rows_to_high_reasoning_repair"]
    : status === "correction_routes_to_high_reasoning_repair"
      ? ["send_corrections_to_high_reasoning_repair", "ask_teacher_for_counterexamples"]
      : ["continue_teacher_review_or_repair_receipt"],
  blockedActions: [
    "enable_rule_from_learning_review",
    "write_memory_from_learning_review",
    "execute_software_from_learning_review",
    "register_schedule_from_learning_review",
    "unlock_packaging",
    "claim_original_goal_complete"
  ],
  locks: lockState,
  executeNow: false,
  goalComplete: false
};

writeJson(validationPath, validation);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Compact Evidence Learning Review Receipt Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    `Ready rule draft rows: ${readyRuleDraftRows.length}`,
    `High-reasoning repair rows: ${highReasoningRepairRows.length}`,
    `Ignored rows: ${ignoredRows.length}`,
    "",
    "This validation is deterministic and review-only. It does not read logs, capture screenshots, execute target software, register schedules, write memory, enable rules, unlock packaging, or claim completion.",
    validation.nextPreparedCommand ? `Next prepared command: ${validation.nextPreparedCommand}` : "Next prepared command: not ready"
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      status,
      validationPath,
      readyForDisabledRuleDraft,
      counts: validation.counts,
      nextPreparedCommand: validation.nextPreparedCommand,
      locks: lockState,
      executeNow: false,
      goalComplete: false
    },
    null,
    2
  )
);
