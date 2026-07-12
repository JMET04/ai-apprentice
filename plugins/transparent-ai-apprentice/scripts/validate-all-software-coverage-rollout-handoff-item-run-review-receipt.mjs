#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "coverage-rollout-handoff-item-run-review-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "coverage-rollout-handoff-item-run-review-receipt-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonOptional(path) {
  if (!path || !existsSync(path)) return null;
  return readJson(path);
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
  if (["item_run_matched_expected", "matched_expected", "ready_for_convergence_audit", "reviewed_for_convergence"].includes(text)) {
    return "item_run_matched_expected";
  }
  if (["item_run_mismatch_blocked", "mismatch_blocked", "blocked", "blocked_needs_more_evidence"].includes(text)) {
    return "item_run_mismatch_blocked";
  }
  if (
    [
      "accepted",
      "execute_now",
      "read_full_logs",
      "capture_screenshot_now",
      "write_memory",
      "claim_coverage_complete",
      "native_universal_execution",
      "unlock_packaging"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function q(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, q(value));
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
    validationDoesNotRerunItem: true,
    validationDoesNotRunCommands: true,
    validationDoesNotRegisterTask: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotReadLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Coverage Rollout Handoff Item Run Review Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Selected batch: ${validation.selectedBatchId || ""}`,
    "",
    "Validation checks:",
    ...validation.validationRows.map((row) => `- ${row.name}: ${row.status}`),
    "",
    "Prepared next review commands:",
    ...(validation.nextReviewCommands.length
      ? validation.nextReviewCommands.map((command, index) => `${index + 1}. ${command.label}: ${command.command}`)
      : ["- <none>"]),
    "",
    "Safety boundary:",
    "- This validation only checks the teacher review receipt for one coverage rollout handoff item run.",
    "- It does not rerun the item, execute commands, register tasks, launch runners, read logs, capture screenshots, write memory, accept coverage, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate teacher review for one coverage rollout handoff item run.");
const builderInput = readJsonInput(
  argValue("--builder", argValue("--run-review-builder", "")),
  "--builder",
  "transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_builder_v1"
);
if (!builderInput.value) throw new Error("--builder is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-coverage-rollout-handoff-item-run-review-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const builder = builderInput.value;
const receipt = receiptInput.value;
const runSummary = builder.runSummary || {};
const supervisor = readJsonOptional(runSummary.supervisorPath);
const supervisorReceipt = readJsonOptional(runSummary.supervisorReceiptPath);
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecision = [
  "accepted",
  "execute_now",
  "read_full_logs",
  "capture_screenshot_now",
  "write_memory",
  "claim_coverage_complete",
  "native_universal_execution",
  "unlock_packaging"
].includes(decision);
const batchMatches = String(receipt.selectedBatchId || "") === String(runSummary.selectedBatchId || "");
const runStatusMatches = String(receipt.itemRunStatus || "") === String(runSummary.status || "");
const evidenceReviewed = receipt.evidenceReviewed === true;
const supervisorReceiptReviewed = receipt.supervisorReceiptReviewed === true;
const postBatchAuditReviewed = receipt.postBatchAuditReviewed === true;
const lowTokenOutcomeReviewed = receipt.lowTokenOutcomeReviewed === true;
const matchedExpected = receipt.teacherMatchedExpected === true && decision === "item_run_matched_expected";
const rollbackRetained = receipt.rollbackPointStillRetained === true;
const preserveBlockerIfMismatch = receipt.preserveBlockerIfMismatch !== false;
const teacherConfirmation = String(receipt.teacherConfirmation || "").trim();
const supervisorEvidencePresent =
  runSummary.runnerInvoked === true &&
  runSummary.status === "reviewed_coverage_rollout_handoff_item_advanced" &&
  Boolean(runSummary.supervisorPath) &&
  supervisor?.format === "transparent_ai_all_software_coverage_rollout_supervisor_v1" &&
  Array.isArray(supervisor.selectedBatches) &&
  supervisor.selectedBatches.includes(runSummary.selectedBatchId) &&
  Number(supervisor.completedBatchPackets || 0) >= 1 &&
  (supervisorReceipt === null || supervisorReceipt?.format === "transparent_ai_all_software_coverage_rollout_supervisor_receipt_v1");
const reviewed =
  !forbiddenDecision &&
  matchedExpected &&
  batchMatches &&
  runStatusMatches &&
  evidenceReviewed &&
  supervisorReceiptReviewed &&
  postBatchAuditReviewed &&
  lowTokenOutcomeReviewed &&
  rollbackRetained &&
  preserveBlockerIfMismatch &&
  Boolean(teacherConfirmation) &&
  supervisorEvidencePresent;

const validationRows = [
  { name: "decision", status: forbiddenDecision ? "blocked_for_forbidden_decision" : decision },
  { name: "selected_batch_matches_builder", status: batchMatches ? "matched" : "blocked_for_batch_mismatch" },
  { name: "run_status_matches_builder", status: runStatusMatches ? "matched" : "blocked_for_run_status_mismatch" },
  { name: "supervisor_evidence_present", status: supervisorEvidencePresent ? "present" : "blocked_for_missing_supervisor_evidence" },
  { name: "evidence_reviewed", status: evidenceReviewed ? "reviewed" : "needs_teacher_review" },
  { name: "supervisor_receipt_reviewed", status: supervisorReceiptReviewed ? "reviewed" : "needs_teacher_review" },
  { name: "post_batch_audit_reviewed", status: postBatchAuditReviewed ? "reviewed" : "needs_teacher_review" },
  { name: "low_token_outcome_reviewed", status: lowTokenOutcomeReviewed ? "reviewed" : "needs_teacher_review" },
  { name: "teacher_matched_expected", status: matchedExpected ? "matched" : "needs_teacher_review_or_mismatch" },
  { name: "rollback_point_still_retained", status: rollbackRetained ? "retained" : "blocked_for_missing_rollback" },
  { name: "preserve_blocker_if_mismatch", status: preserveBlockerIfMismatch ? "preserved" : "blocked_for_unlocked_mismatch" },
  { name: "teacher_confirmation", status: teacherConfirmation ? "present" : "blocked_for_missing_confirmation" }
];
const convergenceAuditCommand = reviewed
  ? commandLine("create-all-software-coverage-convergence-audit.mjs", [
      ["--plan", runSummary.planPath || "<coverage-expansion-plan.json>"],
      ["--supervisor", runSummary.supervisorPath],
      ["--output-dir", join(validationDir, "coverage-convergence-audit")]
    ])
  : "";
const nextReviewCommands = convergenceAuditCommand
  ? [
      {
        label: "Review-only coverage convergence audit after matched rollout handoff item run",
        tool: "create_all_software_coverage_convergence_audit",
        command: convergenceAuditCommand,
        executesNow: false,
        blockedUntil: "teacher confirms the rollout run review receipt remains accurate and rollback evidence is retained"
      }
    ]
  : [];
const validationDecision = forbiddenDecision
  ? "blocked_for_forbidden_decision"
  : reviewed
    ? "coverage_rollout_handoff_item_run_reviewed_for_convergence_audit"
    : decision === "item_run_mismatch_blocked"
      ? "blocked_by_teacher_mismatch"
      : "needs_teacher_review_or_missing_evidence";
const status = reviewed
  ? "validated_ready_for_review_only_convergence_audit"
  : forbiddenDecision || decision === "item_run_mismatch_blocked"
    ? "blocked"
    : "waiting_for_teacher_review";
const validationPath = join(validationDir, "coverage-rollout-handoff-item-run-review-receipt-validation.json");
const receiptPath = join(validationDir, "coverage-rollout-handoff-item-run-review-receipt-validation-receipt.json");
const readmePath = join(validationDir, "COVERAGE_ROLLOUT_HANDOFF_ITEM_RUN_REVIEW_RECEIPT_VALIDATION_START_HERE.md");
const reviewLocks = locks();
const validation = {
  ok: true,
  format: "transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  selectedBatchId: runSummary.selectedBatchId || "",
  sourceBuilder: builderInput.path,
  sourceReceipt: receiptInput.path,
  validationRows,
  nextReviewCommands,
  blockedTransitions: [
    "rerun_coverage_rollout_handoff_item_from_validation",
    "run_convergence_audit_from_validation",
    "read_logs_from_validation",
    "capture_screenshot_from_validation",
    "execute_target_software_from_validation",
    "write_memory_from_validation",
    "claim_all_software_coverage_complete_from_validation",
    "claim_native_universal_execution_from_validation",
    "unlock_packaging_from_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceBuilder: builderInput.path,
    sourceTeacherReceipt: receiptInput.path,
    supervisor: runSummary.supervisorPath || "",
    supervisorReceipt: runSummary.supervisorReceiptPath || "",
    validationDir
  },
  locks: reviewLocks
};
const validationReceipt = {
  format: "transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  nextReviewCommandCount: nextReviewCommands.length,
  scheduledTaskRegistered: false,
  runnerLaunched: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  goalComplete: false,
  locks: reviewLocks
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);
console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      selectedBatchId: validation.selectedBatchId,
      validationPath,
      receiptPath,
      readmePath,
      nextReviewCommandCount: nextReviewCommands.length,
      scheduledTaskRegistered: false,
      runnerLaunched: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareCoverageComplete: false,
      goalComplete: false,
      locks: reviewLocks
    },
    null,
    2
  )
);

if (forbiddenDecision) process.exit(1);
