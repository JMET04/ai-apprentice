#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-operational-post-activation-witness-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-operational-post-activation-witness-receipt-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (!value) continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function lockState() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRerunWitness: true,
    validationDoesNotRegisterTask: true,
    validationDoesNotStartTask: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotReadLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteSoftware: true,
    validationDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    scheduledTaskStarted: false,
    runnerLaunched: false,
    logContentsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    longTermMemoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

const POSITIVE_DECISIONS = new Set(["teacher_reviewed_rerun_post_activation_witness"]);
const BLOCKED_DECISIONS = new Set([
  "accepted",
  "execute_now",
  "register_now",
  "start_runner",
  "enable_memory",
  "claim_complete",
  "unlock_packaging",
  "native_universal_execution"
]);
const REQUIRED_EVIDENCE = [
  "dryRunRehearsal",
  "registrationExecuteGate",
  "registrationStatus",
  "runOutputAudit",
  "teacherReviewPacket",
  "reviewDecisionReplayQueue",
  "unattendedAudit"
];

function isPlaceholder(value) {
  const text = String(value || "").trim();
  return !text || /^<.*>$/.test(text);
}

const goal = argValue("--goal", "Validate teacher-filled post-activation witness evidence receipt.");
const builderInput = readJsonInput(
  argValue("--builder", argValue("--receipt-builder", "")),
  "--builder",
  "transparent_ai_all_software_operational_post_activation_witness_receipt_builder_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_operational_post_activation_witness_evidence_receipt_v1"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-operational-post-activation-witness-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });

const builder = builderInput.value;
const receipt = receiptInput.value;
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });
const validationPath = join(validationDir, "all-software-operational-post-activation-witness-receipt-validation.json");
const readmePath = join(validationDir, "ALL_SOFTWARE_OPERATIONAL_POST_ACTIVATION_WITNESS_RECEIPT_VALIDATION_START_HERE.md");
const locks = lockState();

const teacherDecision = String(receipt.teacherDecision || "");
const forbiddenOverallDecision = BLOCKED_DECISIONS.has(teacherDecision);
const positiveDecision = POSITIVE_DECISIONS.has(teacherDecision);
const evidenceRows = REQUIRED_EVIDENCE.map((key) => {
  const pathValue = String(receipt.evidencePaths?.[key] || "").trim();
  const expectedFormat = builder.requiredEvidenceFormats?.[key] || "";
  const placeholder = isPlaceholder(pathValue);
  const exists = !placeholder && existsSync(pathValue);
  let actualFormat = "";
  let readError = "";
  if (exists) {
    try {
      actualFormat = readJson(pathValue)?.format || "";
    } catch (error) {
      readError = String(error?.message || error);
    }
  }
  const formatMatched = exists && actualFormat === expectedFormat;
  return {
    key,
    path: pathValue,
    expectedFormat,
    actualFormat,
    placeholder,
    exists,
    readError,
    formatMatched,
    status: placeholder
      ? "blocked_placeholder_path"
      : !exists
        ? "blocked_missing_evidence_path"
        : readError
          ? "blocked_unreadable_json"
          : formatMatched
            ? "evidence_path_format_matched"
            : "blocked_format_mismatch",
    blocker: placeholder
      ? "Replace placeholder with a real evidence JSON path."
      : !exists
        ? "Evidence path does not exist."
        : readError
          ? readError
          : formatMatched
            ? ""
            : `Expected ${expectedFormat} but found ${actualFormat || "missing format"}.`
  };
});

const blockedEvidenceRows = evidenceRows.filter((row) => row.status !== "evidence_path_format_matched");
const builderSourceMismatch =
  builder.paths?.sourceWitness && receipt.sourceWitness && builder.paths.sourceWitness !== receipt.sourceWitness;
const canPrepareWitnessRerun =
  positiveDecision &&
  receipt.evidenceReviewed === true &&
  !forbiddenOverallDecision &&
  !builderSourceMismatch &&
  blockedEvidenceRows.length === 0;
const nextWitnessCommand = canPrepareWitnessRerun
  ? commandLine("create-all-software-operational-learning-post-activation-witness.mjs", [
      ["--goal", goal],
      ["--dry-run-rehearsal", receipt.evidencePaths.dryRunRehearsal],
      ["--registration-execute-gate", receipt.evidencePaths.registrationExecuteGate],
      ["--registration-status", receipt.evidencePaths.registrationStatus],
      ["--run-output-audit", receipt.evidencePaths.runOutputAudit],
      ["--teacher-review-packet", receipt.evidencePaths.teacherReviewPacket],
      ["--review-decision-replay-queue", receipt.evidencePaths.reviewDecisionReplayQueue],
      ["--unattended-audit", receipt.evidencePaths.unattendedAudit],
      ["--output-dir", join(validationDir, "post-activation-witness-rerun")]
    ])
  : "";

const validation = {
  ok: true,
  format: "transparent_ai_all_software_operational_post_activation_witness_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status: canPrepareWitnessRerun
    ? "ready_for_review_only_post_activation_witness_rerun"
    : "blocked_until_teacher_reviews_post_activation_evidence_paths",
  decision: canPrepareWitnessRerun ? "ready_for_review_only_witness_rerun" : "needs_teacher_review",
  sourceBuilder: builderInput.path,
  sourceReceipt: receiptInput.path,
  gates: {
    teacherDecisionReadyForWitnessRerun: positiveDecision,
    noForbiddenTeacherDecision: !forbiddenOverallDecision,
    evidenceReviewed: receipt.evidenceReviewed === true,
    sourceWitnessMatchesBuilder: !builderSourceMismatch,
    allRequiredEvidencePathsPresentAndFormatMatched: blockedEvidenceRows.length === 0
  },
  counts: {
    requiredEvidenceRows: evidenceRows.length,
    matchedEvidenceRows: evidenceRows.filter((row) => row.formatMatched).length,
    blockedEvidenceRows: blockedEvidenceRows.length
  },
  evidenceRows,
  blockedEvidenceRows,
  nextReviewOnlyWitnessCommand: nextWitnessCommand,
  blockedActions: [
    "rerun_post_activation_witness_from_validation",
    "register_or_start_scheduled_task_from_validation",
    "launch_runner_from_validation",
    "read_full_logs_from_validation",
    "capture_screenshot_from_validation",
    "execute_target_software_from_validation",
    "write_memory_from_validation",
    "claim_goal_complete_from_validation"
  ],
  locks,
  paths: {
    validation: validationPath,
    readme: readmePath,
    sourceBuilder: builderInput.path,
    sourceReceipt: receiptInput.path
  }
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Post-Activation Witness Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.decision}`,
    `Blocked evidence rows: ${validation.counts.blockedEvidenceRows}`,
    "",
    "This validation checks teacher-filled evidence paths before a post-activation witness rerun command is handed off.",
    "",
    "Safety boundary:",
    "- It does not rerun the witness.",
    "- It does not register or start scheduled tasks.",
    "- It does not launch runners.",
    "- It does not read full logs, capture screenshots, execute software, write memory, enable rules, or claim completion.",
    "",
    canPrepareWitnessRerun
      ? `Next review-only witness command: ${nextWitnessCommand}`
      : "Next action: resolve blocked evidence rows in the validation JSON, then rerun this validation."
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_post_activation_witness_receipt_validation_result_v1",
      validationId,
      status: validation.status,
      validationPath,
      readmePath,
      canPrepareWitnessRerun,
      blockedEvidenceRowCount: blockedEvidenceRows.length,
      locks
    },
    null,
    2
  )
);
