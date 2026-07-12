#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-coverage-rollout-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-coverage-rollout-receipt-validation"
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

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_reviewed_prepare_rollout", "ready_for_rollout_review"].includes(text)) return "teacher_reviewed_prepare_rollout";
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
  if (["teacher_excluded_batch", "excluded"].includes(text)) return "teacher_excluded_batch";
  if (["accepted", "execute_now", "register_schedule", "enable_memory", "claim_complete", "native_universal_execution", "unlock_packaging"].includes(text)) return text;
  return "needs_teacher_review";
}

function psQuote(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function writeReadme(path, validation) {
  const lines = [
    "# All-Software Coverage Rollout Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.batchId}: ${row.status}`),
    "",
    "Prepared next review commands:",
    ...validation.nextReviewCommands.map((command, index) => `${index + 1}. ${command.commandLine}`),
    "",
    "Safety boundary:",
    "- This validation does not invoke the rollout supervisor.",
    "- It does not run low-token runners, register schedules, start software, capture screenshots, write memory, enable rules, accept technology, or claim all-software coverage completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate all-software coverage rollout teacher receipt.");
const planInput = readJsonInput(
  argValue("--plan", argValue("--coverage-expansion-plan", "")),
  "--plan",
  "transparent_ai_all_software_coverage_expansion_plan_v1"
);
if (!planInput.value) throw new Error("--plan is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_coverage_rollout_review_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-rollout-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const plan = planInput.value;
const receipt = receiptInput.value;
const planBatches = new Map((plan.batches || []).map((batch) => [String(batch.batchId), batch]));
const forbidden = new Set(["accepted", "execute_now", "register_schedule", "enable_memory", "claim_complete", "native_universal_execution", "unlock_packaging"]);

const validationRows = (receipt.batchDecisions || []).map((receiptRow) => {
  const batch = planBatches.get(String(receiptRow.batchId));
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const canPrepareRollout = Boolean(batch) && decision === "teacher_reviewed_prepare_rollout" && evidenceReviewed && !forbiddenDecision;
  const commandLine =
    canPrepareRollout
      ? `node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-rollout-supervisor.mjs --plan ${psQuote(planInput.path || "<coverage-expansion-plan.json>")} --teacher-reviewed --start-batch ${batch.batchId} --max-batches 1`
      : "";
  return {
    batchId: receiptRow.batchId,
    batchStatus: batch?.status || "unknown",
    batchSize: batch?.batchSize || batch?.rows?.length || 0,
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    evidenceReviewed,
    status: !batch
      ? "unknown_plan_batch"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : canPrepareRollout
          ? "ready_for_reviewed_coverage_rollout_command"
          : decision === "blocked_needs_more_evidence"
            ? "blocked_needs_more_evidence"
            : decision === "teacher_excluded_batch"
              ? "teacher_excluded_batch"
              : "needs_teacher_review_or_evidence",
    canPrepareRollout,
    nextReviewCommand:
      canPrepareRollout
        ? {
            batchId: receiptRow.batchId,
            tool: "run_all_software_coverage_rollout_supervisor",
            arguments: {
              plan: planInput.path,
              teacherReviewed: true,
              startBatch: batch.batchId,
              maxBatches: 1,
              executeNow: false
            },
            commandLine,
            executesNow: false,
            blockedUntil: "teacher explicitly runs the reviewed rollout command"
          }
        : null
  };
});

const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const readyRows = validationRows.filter((row) => row.canPrepareRollout);
const waitingRows = validationRows.filter((row) => !row.canPrepareRollout && row.status !== "blocked_for_forbidden_decision");
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyRows.length > 0 && waitingRows.length === 0
    ? "all_rows_ready_for_reviewed_coverage_rollout"
    : readyRows.length > 0
      ? "some_rows_ready_for_reviewed_coverage_rollout"
      : "needs_teacher_review";
const status = forbiddenDecisionUsed ? "blocked" : readyRows.length > 0 ? "validated_with_ready_coverage_rollout_rows" : "waiting_for_teacher_coverage_rollout_review";
const nextReviewCommands = readyRows.map((row) => row.nextReviewCommand);
const validationPath = join(validationDir, "all-software-coverage-rollout-receipt-validation.json");
const receiptPath = join(validationDir, "all-software-coverage-rollout-receipt-validation-receipt.json");
const readmePath = join(validationDir, "ALL_SOFTWARE_COVERAGE_ROLLOUT_RECEIPT_VALIDATION_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  validationDoesNotInvokeRolloutSupervisor: true,
  validationDoesNotRunCoverageRunner: true,
  rolloutSupervisorInvoked: false,
  coverageRunnerInvoked: false,
  scheduledTaskRegistered: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  logContentsRead: false,
  fileContentsRead: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  goalComplete: false
};
const validation = {
  ok: true,
  format: "transparent_ai_all_software_coverage_rollout_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed,
  readyRowCount: readyRows.length,
  waitingRowCount: waitingRows.length,
  validationRows,
  nextReviewCommands,
  blockedTransitions: [
    "run_coverage_rollout_supervisor_from_validation",
    "run_automatic_low_token_learning_from_validation",
    "register_schedule_from_validation",
    "capture_screenshot_from_validation",
    "write_memory_from_validation",
    "claim_all_software_coverage_complete_from_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceExpansionPlan: planInput.path,
    sourceReceipt: receiptInput.path
  },
  locks
};
const validationReceipt = {
  format: "transparent_ai_all_software_coverage_rollout_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  readyRowCount: readyRows.length,
  forbiddenDecisionUsed,
  rolloutSupervisorInvoked: false,
  coverageRunnerInvoked: false,
  scheduledTaskRegistered: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  goalComplete: false,
  locks
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_rollout_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      readyRowCount: readyRows.length,
      waitingRowCount: waitingRows.length,
      forbiddenDecisionUsed,
      validationPath,
      receiptPath,
      readmePath,
      nextReviewCommands,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
