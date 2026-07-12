#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "operational-post-registration-output-witness-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "operational-post-registration-output-witness-receipt-validation"
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
    if (value === undefined || value === null || value === "") continue;
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
    validationDoesNotRerunOutputWitness: true,
    validationDoesNotInvokeReviewedScheduledRunner: true,
    validationDoesNotRegisterTask: true,
    validationDoesNotStartTask: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteSoftware: true,
    validationDoesNotWriteMemory: true,
    scheduledTaskRegisteredByValidation: false,
    scheduledTaskStartedByValidation: false,
    runnerLaunchedByValidation: false,
    logContentsReadByValidation: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    longTermMemoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareUnattendedCoverageProven: false,
    goalComplete: false
  };
}

const POSITIVE_DECISIONS = new Set(["teacher_reviewed_output_witness", "teacher_reviewed_prepare_post_activation_witness"]);
const POST_ACTIVATION_DECISIONS = new Set(["teacher_reviewed_prepare_post_activation_witness"]);
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
const CORE_EVIDENCE = [
  "outputWitnessRunner",
  "outputWitnessReceipt",
  "registrationStatus",
  "runOutputAudit",
  "teacherReviewPacket",
  "reviewDecisionReplayQueue",
  "unattendedAudit"
];
const POST_ACTIVATION_EVIDENCE = ["dryRunRehearsal", "registrationExecuteGate"];

function isPlaceholder(value) {
  const text = String(value || "").trim();
  return !text || /^<.*>$/.test(text);
}

function operationalScopeMatches(builderScope, receiptScope) {
  if (!builderScope && !receiptScope) return true;
  if (!builderScope || !receiptScope) return false;
  const sameKind = builderScope.scopeKind === receiptScope.scopeKind;
  const sameTrial =
    !builderScope.sourceTrialPath ||
    !receiptScope.sourceTrialPath ||
    resolve(builderScope.sourceTrialPath) === resolve(receiptScope.sourceTrialPath);
  const sameSchedule =
    !builderScope.sourceSchedulePath ||
    !receiptScope.sourceSchedulePath ||
    resolve(builderScope.sourceSchedulePath) === resolve(receiptScope.sourceSchedulePath);
  return sameKind && sameTrial && sameSchedule && receiptScope.teacherReviewedScope === true;
}

function evidenceRows(keys, receipt, builder) {
  return keys.map((key) => {
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
}

const goal = argValue("--goal", "Validate teacher-filled post-registration output witness review receipt.");
const builderInput = readJsonInput(
  argValue("--builder", argValue("--receipt-builder", "")),
  "--builder",
  "transparent_ai_all_software_operational_post_registration_output_witness_receipt_builder_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_operational_post_registration_output_witness_review_receipt_v1"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "operational-post-registration-output-witness-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const builder = builderInput.value;
const receipt = receiptInput.value;
const locks = lockState();
const teacherDecision = String(receipt.teacherDecision || "");
const forbiddenDecision = BLOCKED_DECISIONS.has(teacherDecision);
const positiveDecision = POSITIVE_DECISIONS.has(teacherDecision);
const wantsPostActivation = POST_ACTIVATION_DECISIONS.has(teacherDecision);
const coreEvidenceRows = evidenceRows(CORE_EVIDENCE, receipt, builder);
const postActivationEvidenceRows = evidenceRows(POST_ACTIVATION_EVIDENCE, receipt, builder);
const blockedCoreRows = coreEvidenceRows.filter((row) => row.status !== "evidence_path_format_matched");
const blockedPostActivationRows = postActivationEvidenceRows.filter((row) => row.status !== "evidence_path_format_matched");
const builderSourceMismatch =
  builder.paths?.sourceOutputWitnessRunner &&
  receipt.sourceOutputWitnessRunner &&
  builder.paths.sourceOutputWitnessRunner !== receipt.sourceOutputWitnessRunner;
const operationalScopeVerified = operationalScopeMatches(builder.operationalScope, receipt.operationalScope);
const outputWitnessReviewReady =
  positiveDecision &&
  receipt.evidenceReviewed === true &&
  !forbiddenDecision &&
  !builderSourceMismatch &&
  operationalScopeVerified &&
  blockedCoreRows.length === 0;
const canPreparePostActivationWitness =
  outputWitnessReviewReady && wantsPostActivation && blockedPostActivationRows.length === 0;
const nextPostActivationWitnessCommand = canPreparePostActivationWitness
  ? commandLine("create-all-software-operational-learning-post-activation-witness.mjs", [
      ["--goal", goal],
      ["--dry-run-rehearsal", receipt.evidencePaths.dryRunRehearsal],
      ["--registration-execute-gate", receipt.evidencePaths.registrationExecuteGate],
      ["--registration-status", receipt.evidencePaths.registrationStatus],
      ["--run-output-audit", receipt.evidencePaths.runOutputAudit],
      ["--teacher-review-packet", receipt.evidencePaths.teacherReviewPacket],
      ["--review-decision-replay-queue", receipt.evidencePaths.reviewDecisionReplayQueue],
      ["--unattended-audit", receipt.evidencePaths.unattendedAudit],
      ["--output-dir", join(validationDir, "post-activation-witness")]
    ])
  : "";

const validationPath = join(validationDir, "operational-post-registration-output-witness-receipt-validation.json");
const readmePath = join(validationDir, "OPERATIONAL_POST_REGISTRATION_OUTPUT_WITNESS_RECEIPT_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format: "transparent_ai_all_software_operational_post_registration_output_witness_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status: canPreparePostActivationWitness
    ? "ready_for_review_only_post_activation_witness_command"
    : outputWitnessReviewReady
      ? "post_registration_output_witness_reviewed_waiting_for_optional_post_activation_evidence"
      : "blocked_until_teacher_reviews_post_registration_output_witness_evidence",
  decision: canPreparePostActivationWitness
    ? "ready_for_review_only_post_activation_witness"
    : outputWitnessReviewReady
      ? "output_witness_reviewed_no_system_change"
      : "needs_teacher_review",
  sourceBuilder: builderInput.path,
  sourceReceipt: receiptInput.path,
  gates: {
    teacherDecisionPositive: positiveDecision,
    teacherWantsPostActivationWitness: wantsPostActivation,
    noForbiddenTeacherDecision: !forbiddenDecision,
    evidenceReviewed: receipt.evidenceReviewed === true,
    sourceOutputWitnessMatchesBuilder: !builderSourceMismatch,
    operationalScopeVerified,
    allCoreEvidencePathsPresentAndFormatMatched: blockedCoreRows.length === 0,
    allPostActivationEvidencePathsPresentAndFormatMatched: blockedPostActivationRows.length === 0
  },
  counts: {
    coreEvidenceRows: coreEvidenceRows.length,
    matchedCoreEvidenceRows: coreEvidenceRows.filter((row) => row.formatMatched).length,
    blockedCoreEvidenceRows: blockedCoreRows.length,
    postActivationEvidenceRows: postActivationEvidenceRows.length,
    matchedPostActivationEvidenceRows: postActivationEvidenceRows.filter((row) => row.formatMatched).length,
    blockedPostActivationEvidenceRows: blockedPostActivationRows.length
  },
  coreEvidenceRows,
  postActivationEvidenceRows,
  operationalScope: builder.operationalScope || receipt.operationalScope || null,
  operationalScopeVerified,
  blockedCoreRows,
  blockedPostActivationRows,
  nextPostActivationWitnessCommand,
  blockedActions: [
    "rerun_output_witness_from_validation",
    "invoke_reviewed_scheduled_runner_from_validation",
    "register_or_start_scheduled_task_from_validation",
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
    "# Operational Post-Registration Output Witness Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.decision}`,
    `Operational scope verified: ${operationalScopeVerified}`,
    `Blocked core evidence rows: ${validation.counts.blockedCoreEvidenceRows}`,
    `Blocked post-activation evidence rows: ${validation.counts.blockedPostActivationEvidenceRows}`,
    "",
    "This validation checks teacher-filled output witness evidence before any post-activation witness handoff.",
    "",
    "Safety boundary:",
    "- It does not rerun the output witness.",
    "- It does not invoke the reviewed scheduled runner.",
    "- It does not register or start scheduled tasks.",
    "- It does not read full logs, capture screenshots, execute software, write memory, enable rules, or claim completion.",
    "",
    nextPostActivationWitnessCommand
      ? `Next review-only post-activation witness command: ${nextPostActivationWitnessCommand}`
      : "Next action: resolve blocked evidence rows or keep the reviewed output witness as review-only evidence."
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_post_registration_output_witness_receipt_validation_result_v1",
      validationId,
      status: validation.status,
      validationPath,
      readmePath,
      outputWitnessReviewReady,
      canPreparePostActivationWitness,
      operationalScopeVerified,
      blockedCoreEvidenceRows: blockedCoreRows.length,
      blockedPostActivationEvidenceRows: blockedPostActivationRows.length,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecision) process.exit(1);
