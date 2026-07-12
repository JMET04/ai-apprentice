#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  let parsed = null;
  let sourcePath = "";
  try {
    sourcePath = resolve(text);
    parsed = JSON.parse(readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    try {
      parsed = JSON.parse(text);
      sourcePath = "";
    } catch {
      parsed = null;
    }
  }
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return { value: parsed, path: sourcePath };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function locks() {
  return {
    reviewOnly: true,
    lifecycleCandidateReviewOnly: true,
    reviewOnlyLifecycleCandidatePrepared: false,
    lifecycleTransitionExecuted: false,
    activeRulePackageCompiled: false,
    activePromotionAllowed: false,
    ruleEnabled: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const validationInput = readJsonInput(
  argValue("--review-validation", argValue("--validation", "")),
  "--review-validation",
  "transparent_ai_real_case_confirmed_outcome_validation_report_review_validation_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-lifecycle-candidate-review-builders"))
);
const validation = validationInput.value;
const candidate = validation.lifecycleCandidateHandoff;

if (
  validation.status !== "confirmed_outcome_validation_report_review_ready_for_lifecycle_candidate_planning" ||
  validation.readyForLifecycleCandidate !== true ||
  !candidate ||
  candidate.format !== "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_handoff_v1" ||
  candidate.deliveryAllowedEvidenceOnly !== true ||
  candidate.activePromotionAllowedHere !== false ||
  candidate.nextStepRequiresSeparateTeacherLifecycleGate !== true ||
  validation.locks?.ruleEnabled !== false ||
  validation.locks?.packagingUnlocked !== false ||
  validation.locks?.activeRulePackageCompiled !== false
) {
  throw new Error("Review validation is not a locked real-case confirmed outcome lifecycle candidate handoff.");
}
if (validation.confirmedOutcomeBranch !== true || candidate.confirmedOutcomeBranch !== true) {
  throw new Error("CONFIRMED_OUTCOME_LIFECYCLE_CANDIDATE_SOURCE_BRANCH_MISSING");
}
if (
  validation.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT ||
  candidate.sourceReviewFormat !== validation.sourceReviewFormat
) {
  throw new Error("CONFIRMED_OUTCOME_LIFECYCLE_CANDIDATE_SOURCE_FORMAT_MISMATCH");
}
if (
  !validation.sourceConfirmedOutcomeReviewId ||
  !validation.sourceConfirmedOutcomeSourceRunId ||
  !validation.sourceRunId ||
  candidate.sourceConfirmedOutcomeReviewId !== validation.sourceConfirmedOutcomeReviewId ||
  candidate.sourceConfirmedOutcomeSourceRunId !== validation.sourceConfirmedOutcomeSourceRunId ||
  candidate.sourceRunId !== validation.sourceRunId
) {
  throw new Error("CONFIRMED_OUTCOME_LIFECYCLE_CANDIDATE_SOURCE_IDS_MISSING_OR_MISMATCHED");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${candidate.caseType || "real_case"}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "real-case-confirmed-outcome-lifecycle-candidate-review-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "real-case-confirmed-outcome-lifecycle-candidate-review-receipt-template.json");
const readmePath = join(builderDir, "REAL_CASE_CONFIRMED_OUTCOME_LIFECYCLE_CANDIDATE_REVIEW_START_HERE.md");
const htmlPath = join(builderDir, "real-case-confirmed-outcome-lifecycle-candidate-review.html");
const validationHash = hashText(JSON.stringify(validation));
const builderLocks = locks();
const sourceContext = {
  confirmedOutcomeBranch: true,
  sourceReviewFormat: validation.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: validation.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: validation.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: validation.sourceRunId
};

const receiptTemplate = {
  format: "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_receipt_v1",
  sourceValidationId: validation.validationId,
  sourceReviewValidationPath: validationInput.path,
  sourceReviewValidationHash: validationHash,
  ...sourceContext,
  reportId: candidate.reportId,
  caseType: candidate.caseType || "",
  proposedTransition: "draft_disabled_to_review_only_candidate",
  teacherDecision: "needs_teacher_review",
  lifecycleCandidateReviewed: false,
  disabledLifecycleReviewed: false,
  draftDisabledToReviewOnlyOnlyConfirmed: false,
  activePromotionStillBlockedConfirmed: false,
  separateActiveGateRequiredConfirmed: false,
  teacherConfirmedNoExecution: false,
  rollbackRetained: false,
  blockedActionsConfirmed: true,
  teacherNotes: "",
  allowedTeacherDecisions: [
    "approve_review_only_lifecycle_candidate",
    "request_high_reasoning_repair",
    "request_more_evidence",
    "blocked",
    "needs_teacher_review"
  ],
  forbiddenTeacherDecisions: [
    "accepted",
    "activate_rule",
    "enable_rule",
    "promote_rule",
    "compile_active_package",
    "execute_software",
    "write_memory",
    "fetch_rag",
    "unlock_packaging",
    "claim_complete"
  ],
  candidateSummary: {
    validationReportPath: candidate.validationReportPath,
    compiledRulePackagePath: candidate.compiledRulePackagePath,
    ruleDir: candidate.ruleDir,
    disabledRuleCount: candidate.disabledRuleCount,
    lifecycleSkippedRows: candidate.lifecycleSkippedRows,
    deliveryAllowedEvidenceOnly: true,
    activePromotionAllowedHere: false,
    nextStepRequiresSeparateTeacherLifecycleGate: true
  },
  executeNow: false,
  reviewOnly: true,
  locks: builderLocks
};

const builder = {
  ok: true,
  format: "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  status: "ready_for_teacher_confirmed_outcome_lifecycle_candidate_review",
  sourceValidationId: validation.validationId,
  sourceReviewValidationPath: validationInput.path,
  sourceReviewValidationHash: validationHash,
  ...sourceContext,
  proposedTransition: "draft_disabled_to_review_only_candidate",
  allowedTeacherDecisions: receiptTemplate.allowedTeacherDecisions,
  forbiddenTeacherDecisions: receiptTemplate.forbiddenTeacherDecisions,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-real-case-confirmed-outcome-lifecycle-candidate-review-receipt.mjs --review-validation "' +
    (validationInput.path || "<real-case-validation-report-review-validation.json>") +
    '" --receipt "<teacher-filled-real-case-confirmed-outcome-lifecycle-candidate-review-receipt.json>"',
  locks: builderLocks,
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  }
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# Real-Case Confirmed Outcome Lifecycle Candidate Review",
    "",
    "This is a teacher review gate for moving a real-case rule candidate from draft_disabled evidence toward review_only lifecycle planning.",
    "",
    "Allowed outcome: prepare a review-only lifecycle planning handoff.",
    "Blocked outcomes: active rule promotion, active package compilation, software execution, RAG fetch, memory write, packaging unlock, acceptance, and completion claims.",
    "",
    `Receipt template: ${receiptTemplatePath}`,
    `Next validator: ${builder.nextValidationCommand}`,
    ""
  ].join("\n"),
  "utf8"
);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Real-Case Confirmed Outcome Lifecycle Candidate Review</title></head>
<body>
<h1>Real-Case Confirmed Outcome Lifecycle Candidate Review</h1>
<p>This gate can only prepare review_only lifecycle planning. It cannot activate rules or execute software.</p>
<pre>${JSON.stringify(receiptTemplate, null, 2)}</pre>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_receipt_builder_result_v1",
      status: builder.status,
      builderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      ...sourceContext,
      proposedTransition: "draft_disabled_to_review_only_candidate",
      executeNow: false,
      locks: builderLocks
    },
    null,
    2
  )
);
