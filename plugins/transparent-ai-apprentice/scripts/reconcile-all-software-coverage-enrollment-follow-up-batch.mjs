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

function hasFlag(name) {
  return process.argv.includes(name);
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return String(value || "all-software-coverage-enrollment-follow-up-reconciliation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-coverage-enrollment-follow-up-reconciliation";
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, optional = false) {
  const text = String(input || "").trim();
  if (!text) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  if (optional) return { value: null, path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function runNodeScript(scriptName, args, timeout = 240000) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function locks(extra = {}) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    allSoftwareCoverageComplete: false,
    teacherAcceptanceRequired: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    screenshotsCapturedByThisTool: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    scheduledTaskInstalled: false,
    nativeUniversalExecution: false,
    ...extra
  };
}

function realPath(value) {
  const text = String(value || "").trim();
  return text && !text.includes("<") && existsSync(text) ? resolve(text) : "";
}

function maybeReadSourcePlan(batch, explicitPlanPath) {
  const planPath = realPath(explicitPlanPath) || realPath(batch.sourcePlanPath);
  return planPath ? { value: readJson(planPath), path: planPath } : { value: null, path: "" };
}

function maybeReadSourceLedger(plan, explicitLedgerPath) {
  const ledgerPath = realPath(explicitLedgerPath) || realPath(plan?.sourceLedgerPath);
  return ledgerPath ? { value: readJson(ledgerPath), path: ledgerPath } : { value: null, path: "" };
}

function uniqueExisting(paths) {
  const seen = new Set();
  const result = [];
  for (const item of paths) {
    const path = realPath(item);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    result.push(path);
  }
  return result;
}

function collectEvidencePaths(batch, extraEvidence) {
  const runResults = Array.isArray(batch.runResults) ? batch.runResults : [];
  return uniqueExisting([
    ...extraEvidence,
    ...runResults.map((item) => item.evidencePath),
    ...runResults.map((item) => item.result?.gatePath),
    ...runResults.map((item) => item.result?.receiptPath),
    ...runResults.map((item) => item.result?.queuePath),
    ...runResults.map((item) => item.result?.observationPath),
    ...runResults.map((item) => item.result?.compactEventPath),
    ...runResults.map((item) => item.result?.learningCyclePath)
  ]);
}

function classifyBatch(batch, evidencePaths) {
  if (batch.teacherReviewed !== true) return "waiting_for_teacher_review";
  if (evidencePaths.length === 0) return "missing_batch_evidence_for_reledger";
  return "ready_for_next_coverage_audit_and_enrollment_ledger";
}

function commandLine(scriptName, args) {
  const rendered = args.map((arg) => `"${String(arg).replace(/"/g, '\\"')}"`).join(" ");
  return `node plugins/transparent-ai-apprentice/scripts/${scriptName} ${rendered}`;
}

const batchInput = readJsonInput(argValue("--batch", argValue("--batch-run", "")), "--batch");
const batch = batchInput.value;
if (batch.format !== "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1") {
  throw new Error("Expected transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1");
}

const planInput = maybeReadSourcePlan(batch, argValue("--plan", argValue("--follow-up-plan", "")));
const ledgerInput = maybeReadSourceLedger(planInput.value, argValue("--ledger", argValue("--enrollment-ledger", "")));
const reviewScope = planInput.value?.reviewScope || batch.reviewScope || null;
const inventoryPath =
  realPath(argValue("--inventory", argValue("--inventory-path", ""))) ||
  realPath(ledgerInput.value?.sourceEvidence?.inventoryPath);
const queuePath =
  realPath(argValue("--queue", argValue("--queue-path", ""))) ||
  realPath(ledgerInput.value?.sourceEvidence?.queuePath);
const priorCoverageAuditPath =
  realPath(argValue("--coverage-audit", argValue("--audit", ""))) ||
  realPath(ledgerInput.value?.sourceEvidence?.coverageAuditPath);
const teacherReviewedRerun = hasFlag("--teacher-reviewed-rerun") || hasFlag("--rerun-reviewed");
const maxRows = Math.max(1, Number(argValue("--max-rows", "80")));
const evidencePaths = collectEvidencePaths(batch, argValues("--evidence"));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-reconciliations")));

mkdirSync(outputRoot, { recursive: true });
const reconciliationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(batch.goal || batch.sourcePlanId || batch.batchId)}`;
const reconciliationDir = join(outputRoot, reconciliationId);
mkdirSync(reconciliationDir, { recursive: true });

const sourceStatus = classifyBatch(batch, evidencePaths);
const sourcePathsReady = Boolean(inventoryPath && queuePath);
const auditArgs = [
  "--inventory",
  inventoryPath || "<inventory path>",
  "--queue",
  queuePath || "<queue path>",
  "--max-rows",
  String(maxRows),
  "--output-dir",
  join(reconciliationDir, "next-coverage-audit")
];
for (const evidence of evidencePaths) auditArgs.push("--evidence", evidence);
const ledgerArgsBase = [
  "--inventory",
  inventoryPath || "<inventory path>",
  "--queue",
  queuePath || "<queue path>",
  "--coverage-audit",
  "<new coverage audit path>",
  "--max-rows",
  String(maxRows),
  "--output-dir",
  join(reconciliationDir, "next-enrollment-ledger")
];
for (const evidence of evidencePaths) ledgerArgsBase.push("--evidence", evidence);

let nextCoverageAudit = null;
let nextEnrollmentLedger = null;
let status = sourceStatus;
let blockedReason = "";

if (teacherReviewedRerun) {
  if (batch.teacherReviewed !== true) {
    status = "blocked_unreviewed_batch_cannot_rerun";
    blockedReason = "The source batch was not teacher-reviewed.";
  } else if (!sourcePathsReady) {
    status = "missing_source_paths_for_rerun";
    blockedReason = "Inventory and queue paths are required to rerun audit and ledger.";
  } else {
    nextCoverageAudit = runNodeScript("create-all-software-observer-coverage-audit.mjs", auditArgs);
    const ledgerArgs = ledgerArgsBase.map((arg) => (arg === "<new coverage audit path>" ? nextCoverageAudit.auditPath : arg));
    nextEnrollmentLedger = runNodeScript("create-all-software-coverage-enrollment-ledger.mjs", ledgerArgs);
    status = "reconciled_next_ledger_ready_for_review";
  }
}

const plannedCommands = {
  nextCoverageAuditCommand: sourcePathsReady ? commandLine("create-all-software-observer-coverage-audit.mjs", auditArgs) : "",
  nextEnrollmentLedgerCommand:
    sourcePathsReady
      ? commandLine(
          "create-all-software-coverage-enrollment-ledger.mjs",
          ledgerArgsBase.map((arg) => (arg === "<new coverage audit path>" ? "<path from nextCoverageAudit.auditPath>" : arg))
        )
      : "",
  priorCoverageAuditPath
};

const reconciliationPath = join(reconciliationDir, "all-software-coverage-enrollment-follow-up-reconciliation.json");
const receiptPath = join(reconciliationDir, "all-software-coverage-enrollment-follow-up-reconciliation-receipt.json");
const readmePath = join(reconciliationDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_RECONCILIATION_START_HERE.md");
const lockState = locks();

const reconciliation = {
  ok: true,
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_v1",
  reconciliationId,
  createdAt: new Date().toISOString(),
  status,
  blockedReason,
  sourceEvidence: {
    batchPath: batchInput.path,
    batchFormat: batch.format,
    sourcePlanPath: planInput.path,
    sourcePlanFormat: planInput.value?.format || "",
    sourceLedgerPath: ledgerInput.path,
    sourceLedgerFormat: ledgerInput.value?.format || "",
    reviewScope,
    inventoryPath,
    queuePath,
    priorCoverageAuditPath,
    batchTeacherReviewed: batch.teacherReviewed === true,
    evidencePaths
  },
  batchSummary: {
    batchId: batch.batchId || "",
    selectedItemCount: batch.selectedItemCount || 0,
    ranToolCount: batch.ranToolCount || 0,
    routeCounts: batch.routeCounts || {},
    evidencePathCount: evidencePaths.length
  },
  plannedCommands,
  generated: {
    nextCoverageAuditPath: nextCoverageAudit?.auditPath || "",
    nextCoverageAuditReceiptPath: nextCoverageAudit?.receiptPath || "",
    nextEnrollmentLedgerPath: nextEnrollmentLedger?.ledgerPath || "",
    nextEnrollmentLedgerReceiptPath: nextEnrollmentLedger?.receiptPath || ""
  },
  nextTeacherActions:
    status === "reconciled_next_ledger_ready_for_review"
      ? [
          "Review the regenerated coverage audit receipt.",
          "Review the regenerated enrollment ledger nextReviewQueue.",
          "Continue with create_all_software_coverage_enrollment_follow_up_plan if gaps remain."
        ]
      : [
          "Review the source batch receipt.",
          "Confirm whether to rerun audit and ledger with --teacher-reviewed-rerun.",
          "Provide inventory and queue paths if the source ledger did not preserve them."
        ],
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    reason: "This reconciliation only loops reviewed batch evidence back into coverage audit and enrollment ledger evidence. It is not proof that every in-scope app is covered or controllable.",
    stillNeeded: [
      "review regenerated audit and ledger receipts",
      "repeat follow-up batches until no in-scope ledger rows are waiting for evidence",
      "record explicit teacher exclusions for private/out-of-scope software",
      "keep native semantic execution proof separate from low-token observation coverage"
    ]
  },
  locks: lockState
};

const receipt = {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_receipt_v1",
  reconciliationId,
  reconciliationPath,
  status,
  blockedReason,
  sourceBatchPath: batchInput.path,
  reviewScope,
  teacherReviewedRerun,
  evidencePathCount: evidencePaths.length,
  nextCoverageAuditPath: reconciliation.generated.nextCoverageAuditPath,
  nextEnrollmentLedgerPath: reconciliation.generated.nextEnrollmentLedgerPath,
  allSoftwareCoverageComplete: false,
  screenshotsCaptured: false,
  screenshotsCapturedByThisTool: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  logContentsRead: false,
  fullLogsRead: false,
  fileContentsRead: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  scheduledTaskInstalled: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: lockState
};

writeFileSync(reconciliationPath, `${JSON.stringify(reconciliation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# All-Software Coverage Enrollment Follow-Up Reconciliation",
    "",
    `Status: ${status}`,
    `Source batch: ${batchInput.path}`,
    `Review scope: ${reviewScope?.scopeKind || "unspecified"}`,
    "",
    "This reconciles a reviewed follow-up batch back into the next coverage audit and enrollment ledger.",
    "",
    "Default behavior only writes commands and receipts. Use `--teacher-reviewed-rerun` only after reviewing the batch receipt and source paths.",
    "",
    "Locked defaults:",
    "- No screenshots are captured.",
    "- No target software commands or UI events are executed.",
    "- No full logs are read or retained.",
    "- No memory, rules, schedules, acceptance, native universal execution, or packaging are enabled.",
    "",
    sourcePathsReady ? `Next audit command: ${plannedCommands.nextCoverageAuditCommand}` : "Next audit command is blocked until inventory and queue paths are supplied.",
    sourcePathsReady ? `Next ledger command: ${plannedCommands.nextEnrollmentLedgerCommand}` : "Next ledger command is blocked until inventory and queue paths are supplied."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_result_v1",
      reconciliationId,
      status,
      reconciliationPath,
      receiptPath,
      teacherReadme: readmePath,
      evidencePathCount: evidencePaths.length,
      nextCoverageAuditPath: reconciliation.generated.nextCoverageAuditPath,
      nextEnrollmentLedgerPath: reconciliation.generated.nextEnrollmentLedgerPath,
      allSoftwareCoverageComplete: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false,
      memoryWritten: false,
      locks: lockState
    },
    null,
    2
  )
);
