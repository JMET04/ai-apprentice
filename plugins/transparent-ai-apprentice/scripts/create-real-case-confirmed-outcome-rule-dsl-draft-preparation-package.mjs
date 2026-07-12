#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { validateRuleCard } from "./rules/rule-dsl-core.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Text(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  let parsed = null;
  let sourcePath = "";
  try {
    sourcePath = resolve(text);
    parsed = readJson(sourcePath);
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

function slug(value) {
  return (
    String(value || "confirmed-outcome-rule")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "confirmed-outcome-rule"
  );
}

function locks({ draftRuleFilesWritten = false } = {}) {
  return {
    reviewOnly: true,
    draftPreparationOnly: true,
    teacherReviewedInputRequired: true,
    candidateRulesDraftDisabled: true,
    draftRuleFilesWritten,
    sourceRuleFilesModified: false,
    activeRulePackageCompiled: false,
    rulePackageCompiled: false,
    ruleEnabled: false,
    productionRuleRegistryMutated: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    ragEvidenceTreatedAsAuthority: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false,
    requiresTeacherRuleReviewGate: true,
    requiresDeterministicValidationGate: true
  };
}

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function buildDraftRule({ lifecycleGate, handoff, ruleCandidate, sourceContext, controlledOutput, controlledOutputHash, index }) {
  const operation = controlledOutput.operation || "confirmed_real_case_operation";
  const ruleId = `confirmed_outcome.${slug(operation)}.draft.${String(index + 1).padStart(2, "0")}`;
  const naturalLanguage =
    handoff.teacherNotes ||
    `Teacher-confirmed controlled output ${operation} must remain bound to the reviewed runner output hash before any rule activation.`;
  return {
    dsl_version: "0.1",
    rule_id: ruleId,
    title: `Draft confirmed-outcome rule ${index + 1}`,
    domain: operation.includes("packaging") ? "packaging.dieline" : "engineering.software",
    lifecycle: "draft_disabled",
    severity: "warning",
    owner: {
      teacher_id: "teacher.local",
      reviewer_id: null,
      approved_at: null
    },
    source: {
      type: "confirmed_real_case_outcome",
      confirmed_outcome: {
        confirmedOutcomeBranch: sourceContext.confirmedOutcomeBranch,
        sourceReviewFormat: sourceContext.sourceReviewFormat,
        sourceConfirmedOutcomeReviewId: sourceContext.sourceConfirmedOutcomeReviewId,
        sourceConfirmedOutcomeSourceRunId: sourceContext.sourceConfirmedOutcomeSourceRunId,
        sourceRunId: sourceContext.sourceRunId,
        sourceLifecycleGateId: lifecycleGate.gateId,
        sourceCandidateLedgerReviewId: handoff.sourceReviewId || lifecycleGate.sourceReviewId || ""
      },
      evidence_refs: [
        `lifecycle_gate://${lifecycleGate.gateId}`,
        `confirmed_outcome_review://${sourceContext.sourceConfirmedOutcomeReviewId}`,
        `confirmed_outcome_source_run://${sourceContext.sourceConfirmedOutcomeSourceRunId}`,
        `current_lifecycle_source_run://${sourceContext.sourceRunId}`,
        `candidate_ledger_review://${handoff.sourceReviewId || lifecycleGate.sourceReviewId}`,
        `rule_activation_candidate://${sha256Text(JSON.stringify(ruleCandidate)).slice(0, 16)}`,
        `controlled_output_sha256:${controlledOutputHash}`,
        `rollback://${handoff.rollbackPoint || ""}`
      ],
      natural_language: naturalLanguage
    },
    scope: {
      artifact_types: ["confirmed_real_case_outcome"],
      applies_when: null
    },
    inputs_required: [
      "artifact.source_refs",
      "artifact.context.teacher_reviewed",
      "artifact.context.controlled_output_sha256",
      "artifact.context.lifecycle_gate_id"
    ],
    constraint: {
      type: "expression",
      language: "taa-expr-0.1",
      expr: `artifact.context.teacher_reviewed == true && artifact.context.controlled_output_sha256 == '${controlledOutputHash}' && artifact.context.lifecycle_gate_id == '${lifecycleGate.gateId}'`
    },
    failure: {
      message: "Confirmed outcome evidence is not bound to the reviewed lifecycle gate and controlled output hash.",
      action: "request_teacher_review",
      remediation_hint:
        "Return to high-reasoning repair or teacher review before promoting this draft-disabled rule."
    },
    audit: {
      created_by: "real_case_confirmed_outcome_rule_dsl_draft_preparation",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rule_version: "0.1.0"
    }
  };
}

const lifecycleInput = readJsonInput(
  argValue("--lifecycle-gate", argValue("--gate", "")),
  "--lifecycle-gate",
  "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_gate_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-rule-dsl-draft-preparation-packages")
  )
);
const teacherReviewed = hasFlag("--teacher-reviewed");
if (!teacherReviewed) throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_REQUIRES_TEACHER_REVIEWED_FLAG");

const lifecycleGate = lifecycleInput.value;
const handoff = lifecycleGate.ruleDslDraftPlanningHandoff;
if (lifecycleGate.ok !== true || lifecycleGate.status !== "real_case_confirmed_outcome_rule_dsl_lifecycle_ready_for_draft_disabled_planning") {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_REQUIRES_READY_LIFECYCLE_GATE");
}
if (!handoff || handoff.format !== "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_planning_handoff_v1") {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_MISSING_DRAFT_PLANNING_HANDOFF");
}
if (handoff.proposedLifecycle !== "draft_disabled" || handoff.executeNow !== false || handoff.ruleEnableAllowedHere !== false) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_SOURCE_HANDOFF_NOT_LOCKED");
}
if (lifecycleGate.confirmedOutcomeBranch !== true) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_SOURCE_GATE_CONFIRMED_OUTCOME_BRANCH_MISSING");
}
if (lifecycleGate.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_SOURCE_GATE_REVIEW_FORMAT_MISMATCH");
}
if (!lifecycleGate.sourceConfirmedOutcomeReviewId) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_SOURCE_GATE_CONFIRMED_OUTCOME_REVIEW_ID_MISSING");
}
if (!lifecycleGate.sourceConfirmedOutcomeSourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_SOURCE_GATE_CONFIRMED_OUTCOME_SOURCE_RUN_ID_MISSING");
}
if (!lifecycleGate.sourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_SOURCE_GATE_SOURCE_RUN_ID_MISSING");
}
if (handoff.confirmedOutcomeBranch !== true) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_HANDOFF_CONFIRMED_OUTCOME_BRANCH_MISSING");
}
if (handoff.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_HANDOFF_SOURCE_REVIEW_FORMAT_MISMATCH");
}
if (handoff.sourceConfirmedOutcomeReviewId !== lifecycleGate.sourceConfirmedOutcomeReviewId) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_HANDOFF_CONFIRMED_OUTCOME_REVIEW_ID_MISMATCH");
}
if (handoff.sourceConfirmedOutcomeSourceRunId !== lifecycleGate.sourceConfirmedOutcomeSourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_HANDOFF_CONFIRMED_OUTCOME_SOURCE_RUN_ID_MISMATCH");
}
if (handoff.sourceRunId !== lifecycleGate.sourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_HANDOFF_SOURCE_RUN_ID_MISMATCH");
}
const sourceLocks = lifecycleGate.locks || {};
if (
  (lifecycleGate.ruleEnabled ?? sourceLocks.ruleEnabled) !== false ||
  (lifecycleGate.productionRuleRegistryMutated ?? sourceLocks.productionRuleRegistryMutated) !== false ||
  (lifecycleGate.rulePackageCompiled ?? sourceLocks.rulePackageCompiled) !== false ||
  (lifecycleGate.ragFetched ?? sourceLocks.ragFetched) !== false ||
  (lifecycleGate.packagingUnlocked ?? sourceLocks.packagingUnlocked) !== false ||
  (lifecycleGate.goalComplete ?? sourceLocks.goalComplete) !== false
) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_SOURCE_LOCKS_NOT_CLOSED");
}
if (!handoff.rollbackPoint || !existsSync(handoff.rollbackPoint)) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_ROLLBACK_POINT_NOT_FOUND");
}

const ruleCandidatePath = handoff.ruleActivationCandidatePath;
if (!ruleCandidatePath || !existsSync(ruleCandidatePath)) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_RULE_ACTIVATION_CANDIDATE_NOT_FOUND");
}
if (handoff.ruleActivationCandidateSha256 && handoff.ruleActivationCandidateSha256 !== sha256File(ruleCandidatePath)) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_RULE_ACTIVATION_CANDIDATE_HASH_MISMATCH");
}
const ruleCandidate = readJson(ruleCandidatePath);
if (ruleCandidate.format !== "transparent_ai_real_case_confirmed_outcome_rule_activation_candidate_v1") {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_RULE_ACTIVATION_CANDIDATE_FORMAT_MISMATCH");
}
if (ruleCandidate.ruleEnabled !== false || ruleCandidate.productionRuleRegistryMutated !== false) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_RULE_ACTIVATION_CANDIDATE_NOT_DISABLED");
}
if (ruleCandidate.confirmedOutcomeBranch !== true) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_RULE_CANDIDATE_CONFIRMED_OUTCOME_BRANCH_MISSING");
}
if (ruleCandidate.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_RULE_CANDIDATE_SOURCE_REVIEW_FORMAT_MISMATCH");
}
if (ruleCandidate.sourceConfirmedOutcomeReviewId !== lifecycleGate.sourceConfirmedOutcomeReviewId) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_RULE_CANDIDATE_CONFIRMED_OUTCOME_REVIEW_ID_MISMATCH");
}
if (ruleCandidate.sourceConfirmedOutcomeSourceRunId !== lifecycleGate.sourceConfirmedOutcomeSourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_RULE_CANDIDATE_CONFIRMED_OUTCOME_SOURCE_RUN_ID_MISMATCH");
}
if (ruleCandidate.sourceRunId !== lifecycleGate.sourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_RULE_CANDIDATE_SOURCE_RUN_ID_MISMATCH");
}

const controlledOutputPath = ruleCandidate.controlledOutputPath || "";
if (!controlledOutputPath || !existsSync(controlledOutputPath)) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_CONTROLLED_OUTPUT_NOT_FOUND");
}
const controlledOutputHash = sha256File(controlledOutputPath);
if (ruleCandidate.controlledOutputSha256 && ruleCandidate.controlledOutputSha256 !== controlledOutputHash) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_CONTROLLED_OUTPUT_HASH_MISMATCH");
}
const controlledOutput = readJson(controlledOutputPath);
const allowedControlledOutputFormats = new Set([
  "transparent_ai_real_case_controlled_output_v1",
  "transparent_ai_real_case_confirmed_outcome_controlled_output_v1",
  "transparent_ai_mcp_real_case_controlled_output_v1"
]);
if (!allowedControlledOutputFormats.has(controlledOutput.format) || controlledOutput.ok !== true) {
  throw new Error("CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_CONTROLLED_OUTPUT_NOT_CONFIRMED");
}

const packageId = `confirmed_outcome_rule_dsl_draft_prep.${sha256Text(`${lifecycleInput.path}:${JSON.stringify(handoff)}`).slice(0, 16)}`;
const packageDir = join(outRoot, packageId);
const ruleDir = join(packageDir, "draft-disabled-rule-cards");
mkdirSync(ruleDir, { recursive: true });

const sourceContext = {
  confirmedOutcomeBranch:
    lifecycleGate.confirmedOutcomeBranch === true && handoff.confirmedOutcomeBranch === true && ruleCandidate.confirmedOutcomeBranch === true,
  sourceReviewFormat: lifecycleGate.sourceReviewFormat || handoff.sourceReviewFormat || ruleCandidate.sourceReviewFormat || "",
  sourceConfirmedOutcomeReviewId: lifecycleGate.sourceConfirmedOutcomeReviewId || "",
  sourceConfirmedOutcomeSourceRunId: lifecycleGate.sourceConfirmedOutcomeSourceRunId || "",
  sourceRunId: lifecycleGate.sourceRunId || handoff.sourceRunId || ruleCandidate.sourceRunId || ""
};

const rule = buildDraftRule({ lifecycleGate, handoff, ruleCandidate, sourceContext, controlledOutput, controlledOutputHash, index: 0 });
const validation = validateRuleCard(rule);
const rulePath = join(ruleDir, `${rule.rule_id}.json`);
writeJson(rulePath, rule);

const candidateRows = [
  {
    ruleId: rule.rule_id,
    rulePath,
    ruleHash: sha256Text(JSON.stringify(rule)),
    lifecycle: rule.lifecycle,
    severity: rule.severity,
    sourceEvidenceRefs: rule.source.evidence_refs,
    sourceConfirmedOutcomeReviewId: sourceContext.sourceConfirmedOutcomeReviewId,
    sourceConfirmedOutcomeSourceRunId: sourceContext.sourceConfirmedOutcomeSourceRunId,
    sourceReviewFormat: sourceContext.sourceReviewFormat,
    sourceRunId: sourceContext.sourceRunId,
    naturalLanguage: rule.source.natural_language,
    controlledOutputPath,
    controlledOutputSha256: controlledOutputHash,
    dslValidationOk: validation.ok,
    dslValidationErrors: validation.errors,
    teacherMustConfirmLogicFit: true,
    mayEnableRule: false,
    mayCompileRulePackage: false,
    mayExecuteSoftware: false,
    mayUnlockPackaging: false
  }
];
const errors = validation.errors.map((error) => ({ ...error, rule_id: rule.rule_id, file: rulePath }));
const status = errors.length
  ? "confirmed_outcome_rule_dsl_draft_preparation_blocked_by_rule_card_schema"
  : "confirmed_outcome_rule_dsl_draft_preparation_waiting_for_teacher_rule_review";
const packetPath = join(packageDir, "real-case-confirmed-outcome-rule-dsl-draft-preparation-package.json");
const readmePath = join(packageDir, "REAL_CASE_CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_START_HERE.md");
const packetLocks = locks({ draftRuleFilesWritten: true });
const packet = {
  ok: errors.length === 0,
  format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_preparation_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  status,
  teacherReviewed,
  confirmedOutcomeBranch: sourceContext.confirmedOutcomeBranch,
  sourceReviewFormat: sourceContext.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: sourceContext.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: sourceContext.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: sourceContext.sourceRunId,
  sourceLifecycleGatePath: lifecycleInput.path,
  sourceLifecycleGateHash: sha256Text(JSON.stringify(lifecycleGate)),
  sourceReviewId: lifecycleGate.sourceReviewId,
  sourceActivationId: handoff.sourceActivationId || "",
  proposedLifecycle: "draft_disabled",
  candidateRuleCount: candidateRows.length,
  candidateRows,
  errors,
  nextTeacherReview: {
    instruction:
      "Review the draft_disabled Rule Card and confirm whether the controlled-output hash and lifecycle evidence represent the teacher-intended reusable logic before any separate validation or lifecycle promotion gate.",
    allowedDecisions: ["needs_teacher_review", "logic_matches", "logic_mismatch_repair", "request_more_evidence"],
    forbiddenDecisions: [
      "accepted",
      "enable_rule",
      "compile_active_package",
      "mutate_rule_registry",
      "execute_software",
      "write_memory",
      "fetch_rag",
      "unlock_packaging",
      "claim_complete"
    ],
    nextPossibleManualTools: [
      "validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs only after a separate compatible review receipt",
      "create-real-case-confirmed-outcome-disabled-package-validation-report.mjs only after teacher confirms logic match",
      "high-reasoning repair if the rule card does not capture the teacher's intended logic"
    ]
  },
  blockedActions: [
    "compile_active_rule_package_from_confirmed_outcome_draft_prep",
    "enable_rule_from_confirmed_outcome_draft_prep",
    "mutate_production_rule_registry_from_confirmed_outcome_draft_prep",
    "execute_software_from_confirmed_outcome_draft_prep",
    "fetch_rag_from_confirmed_outcome_draft_prep",
    "write_memory_from_confirmed_outcome_draft_prep",
    "unlock_packaging_from_confirmed_outcome_draft_prep",
    "claim_completion_from_confirmed_outcome_draft_prep"
  ],
  locks: packetLocks,
  paths: {
    package: packetPath,
    ruleDir,
    readme: readmePath
  }
};

writeJson(packetPath, packet);
writeFileSync(
  readmePath,
  [
    "# Real-Case Confirmed Outcome Rule DSL Draft Preparation",
    "",
    `Status: ${status}`,
    `Source lifecycle gate: ${lifecycleInput.path || lifecycleGate.gateId}`,
    `Candidate draft-disabled rules: ${candidateRows.length}`,
    "",
    "This package writes only draft_disabled Rule Card candidates from a teacher-reviewed lifecycle planning handoff.",
    "It does not compile packages, enable rules, mutate the production rule registry, execute software, fetch RAG, write memory, unlock packaging, accept technology, or claim completion.",
    "",
    "## Teacher Review",
    packet.nextTeacherReview.instruction,
    "",
    "## Draft Rules",
    ...candidateRows.map((row) => `- ${row.ruleId}: ${row.rulePath}`),
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: packet.ok,
      format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_preparation_package_result_v1",
      status,
      packagePath: packetPath,
      ruleDir,
      readmePath,
      candidateRuleCount: candidateRows.length,
      confirmedOutcomeBranch: sourceContext.confirmedOutcomeBranch,
      sourceReviewFormat: sourceContext.sourceReviewFormat,
      sourceConfirmedOutcomeReviewId: sourceContext.sourceConfirmedOutcomeReviewId,
      sourceConfirmedOutcomeSourceRunId: sourceContext.sourceConfirmedOutcomeSourceRunId,
      sourceRunId: sourceContext.sourceRunId,
      candidateRows,
      errors,
      executeNow: false,
      draftRuleFilesWritten: true,
      sourceRuleFilesModified: false,
      rulePackageCompiled: false,
      activeRulePackageCompiled: false,
      productionRuleRegistryMutated: false,
      memoryWritten: false,
      ruleEnabled: false,
      ragFetched: false,
      ragEvidenceTreatedAsAuthority: false,
      accepted: false,
      packagingGated: true,
      packagingUnlocked: false,
      goalComplete: false,
      locks: packetLocks
    },
    null,
    2
  )
);

if (errors.length) process.exit(1);
