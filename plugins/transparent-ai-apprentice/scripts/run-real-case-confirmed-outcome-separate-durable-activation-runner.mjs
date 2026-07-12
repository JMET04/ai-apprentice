#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const EXPECTED_CONFIRMED_OUTCOME_REVIEW_FORMAT =
  "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function hashText(text) {
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

function finalConfirmationMatches(value) {
  const text = String(value || "").trim().toLowerCase();
  return [
    "teacher confirmed separate durable activation runner",
    "teacher confirmed durable activation runner",
    "approve separate durable activation runner",
    "i confirm separate durable activation runner"
  ].some((marker) => text.includes(marker));
}

function activationLocks({ runnerInvoked = false } = {}) {
  return {
    reviewOnly: false,
    separateDurableActivationRunner: true,
    runnerInvoked,
    candidateLedgerWritten: runnerInvoked,
    memoryCandidateWritten: runnerInvoked,
    ruleActivationCandidateWritten: runnerInvoked,
    productionMemoryWritten: false,
    productionRuleRegistryMutated: false,
    memoryWritten: false,
    ruleEnabled: false,
    modelInvoked: false,
    ragFetched: false,
    ragEvidenceTreatedAsAuthority: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false,
    requiresLaterRuleDslOrMemoryLifecycleGate: true
  };
}

const gateInput = readJsonInput(
  argValue("--activation-gate", argValue("--gate", "")),
  "--activation-gate",
  "transparent_ai_real_case_confirmed_outcome_durable_activation_gate_v1"
);
const manifestInputRaw = argValue("--activation-manifest", argValue("--manifest", ""));
const freshRollbackPoint = resolve(argValue("--fresh-rollback-point", argValue("--rollback-point", "")) || ".");
const executeRunner = hasFlag("--execute-durable-activation-runner") || hasFlag("--execute");
const finalConfirmation = finalConfirmationMatches(argValue("--teacher-confirmation", argValue("--confirmation", "")));
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-separate-durable-activations"))
);

const gate = gateInput.value;
const request = gate.durableActivationRequest;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (gate.status !== "real_case_confirmed_outcome_durable_activation_gate_ready_for_separate_activation_runner") {
  block("activation_gate_not_ready", "Activation gate must be ready for the separate durable activation runner.");
}
if (!request || request.format !== "transparent_ai_real_case_confirmed_outcome_durable_activation_request_v1") {
  block("durable_activation_request_missing", "Gate must include a durable activation request.");
}
if (request?.executeNow !== false) block("request_execute_now_forbidden", "durableActivationRequest.executeNow must remain false.");
if (request?.requiresSeparateDurableActivationRunner !== true) {
  block("separate_runner_contract_missing", "Request must require a separate durable activation runner.");
}
if (request?.requiresFinalTeacherActivationConfirmation !== true) {
  block("final_teacher_activation_confirmation_missing", "Request must require final teacher activation confirmation.");
}
if (request?.confirmedOutcomeBranch !== true) {
  block("confirmed_outcome_branch_missing", "Confirmed-outcome durable activation runner requires confirmedOutcomeBranch=true.");
}
if (request?.sourceReviewFormat !== EXPECTED_CONFIRMED_OUTCOME_REVIEW_FORMAT) {
  block(
    "source_review_format_not_confirmed_outcome",
    "Confirmed-outcome durable activation runner requires the confirmed-outcome separate real-runner outcome review format."
  );
}
if (!request?.sourceConfirmedOutcomeReviewId || !request?.sourceConfirmedOutcomeSourceRunId) {
  block(
    "confirmed_outcome_source_ids_missing",
    "Confirmed-outcome durable activation runner requires sourceConfirmedOutcomeReviewId and sourceConfirmedOutcomeSourceRunId."
  );
}
if (!request?.sourceRunId) {
  block("confirmed_outcome_source_run_id_missing", "Confirmed-outcome durable activation runner requires sourceRunId.");
}
if (gate.confirmedOutcomeBranch !== true || gate.sourceReviewFormat !== request?.sourceReviewFormat) {
  block("source_gate_confirmed_outcome_lineage_mismatch", "Source gate must retain the same confirmed-outcome source lineage.");
}
if (
  gate.sourceConfirmedOutcomeReviewId !== request?.sourceConfirmedOutcomeReviewId ||
  gate.sourceConfirmedOutcomeSourceRunId !== request?.sourceConfirmedOutcomeSourceRunId ||
  gate.sourceRunId !== request?.sourceRunId
) {
  block("source_gate_confirmed_outcome_ids_mismatch", "Source gate confirmed-outcome source ids must match the activation request.");
}
if (gate.locks?.memoryWritten !== false || gate.locks?.ruleEnabled !== false || gate.locks?.packagingUnlocked !== false) {
  block("source_gate_locks_not_closed", "Source durable activation gate must keep memory, rules, and packaging locked.");
}
if (!freshRollbackPoint || !existsSync(freshRollbackPoint)) block("fresh_rollback_point_not_found", "A fresh rollback point must exist.");
if (!executeRunner) block("missing_execute_durable_activation_runner_flag", "Runner requires --execute-durable-activation-runner.");
if (!finalConfirmation) block("missing_final_teacher_activation_confirmation", "Runner requires final teacher activation confirmation text.");
if (!manifestInputRaw) block("activation_manifest_required", "A teacher-reviewed durable activation manifest is required.");

let manifest = null;
let manifestPath = "";
let manifestHash = "";
if (manifestInputRaw) {
  try {
    const parsedManifest = readJsonInput(
      manifestInputRaw,
      "--activation-manifest",
      "transparent_ai_real_case_confirmed_outcome_durable_activation_manifest_v1"
    );
    manifest = parsedManifest.value;
    manifestPath = parsedManifest.path;
    manifestHash = hashText(JSON.stringify(manifest));
  } catch (error) {
    block("activation_manifest_invalid", error?.message || String(error));
  }
}

if (manifest) {
  if (manifest.teacherReviewed !== true) block("activation_manifest_not_teacher_reviewed", "Activation manifest must be teacherReviewed=true.");
  if (manifest.sourceGateId && manifest.sourceGateId !== gate.gateId) block("source_gate_id_mismatch", "Manifest sourceGateId does not match gate.");
  if (manifest.sourceGateHash && manifest.sourceGateHash !== hashText(JSON.stringify(gate))) {
    block("source_gate_hash_mismatch", "Manifest sourceGateHash does not match the activation gate.");
  }
  const mode = String(manifest.activationMode || "").trim();
  if (mode !== "candidate_ledger_only") {
    block("activation_mode_not_candidate_ledger_only", "Activation manifest must use activationMode=candidate_ledger_only.");
  }
  const forbiddenOperations = new Set([
    "write_memory",
    "enable_rule",
    "activate_rule",
    "mutate_rule_registry",
    "fetch_rag",
    "treat_rag_as_authority",
    "execute_software",
    "unlock_packaging",
    "accepted",
    "claim_complete"
  ]);
  for (const operation of manifest.requestedOperations || []) {
    if (forbiddenOperations.has(String(operation).trim())) {
      block("forbidden_activation_operation", `Activation manifest requested forbidden operation ${operation}.`);
    }
  }
  if (manifest.productionMemoryWrite === true) block("production_memory_write_forbidden", "Production memory writes are forbidden here.");
  if (manifest.productionRuleEnable === true) block("production_rule_enable_forbidden", "Production rule enablement is forbidden here.");
  if (manifest.ragAuthority === true) block("rag_authority_forbidden", "RAG evidence cannot become authority in this runner.");
}

const outputPath = request?.controlledOutputPath || gate.controlledOutputPath || "";
if (!outputPath || !existsSync(outputPath)) block("controlled_output_missing", "Controlled output must still exist.");
if (outputPath && existsSync(outputPath) && request?.controlledOutputSha256 && request.controlledOutputSha256 !== hashFile(outputPath)) {
  block("request_output_hash_mismatch", "Durable activation request controlled output hash no longer matches.");
}
if (outputPath && existsSync(outputPath) && gate.controlledOutputSha256 && gate.controlledOutputSha256 !== hashFile(outputPath)) {
  block("gate_output_hash_mismatch", "Gate controlled output hash no longer matches.");
}

const activationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${gate.sourceRunId || "durable-activation"}`;
const activationDir = join(outRoot, activationId.replace(/[\\/:*?"<>|]/g, "_"));
const candidateDir = join(activationDir, "durable-candidates");
const ledgerPath = join(activationDir, "durable-activation-ledger.json");
const runnerPath = join(activationDir, "real-case-confirmed-outcome-separate-durable-activation-runner.json");
const receiptPath = join(activationDir, "real-case-confirmed-outcome-separate-durable-activation-receipt.json");
const readmePath = join(activationDir, "REAL_CASE_CONFIRMED_OUTCOME_SEPARATE_DURABLE_ACTIVATION_START_HERE.md");
const memoryCandidatePath = join(candidateDir, "memory-candidate.json");
const ruleActivationCandidatePath = join(candidateDir, "rule-activation-candidate.json");
mkdirSync(candidateDir, { recursive: true });
const sourceContext = {
  confirmedOutcomeBranch: request?.confirmedOutcomeBranch === true,
  sourceReviewFormat: request?.sourceReviewFormat || "",
  sourceReviewId: request?.sourceReviewId || "",
  sourceRunId: request?.sourceRunId || "",
  sourceConfirmedOutcomeReviewId: request?.sourceConfirmedOutcomeReviewId || "",
  sourceConfirmedOutcomeSourceRunId: request?.sourceConfirmedOutcomeSourceRunId || ""
};

let ledger = null;
let memoryCandidate = null;
let ruleActivationCandidate = null;
const canWriteCandidates = blockers.length === 0;
if (canWriteCandidates) {
  const requestedDurableArtifacts = Array.isArray(request.requestedDurableArtifacts)
    ? request.requestedDurableArtifacts
    : ["memory_candidate", "rule_activation_candidate"];
  memoryCandidate = {
    format: "transparent_ai_real_case_confirmed_outcome_memory_candidate_v1",
    ...sourceContext,
    sourceGateId: gate.gateId,
    controlledOutputPath: outputPath,
    controlledOutputSha256: outputPath && existsSync(outputPath) ? hashFile(outputPath) : "",
    teacherNotes: request.teacherNotes || manifest?.teacherNotes || "",
    activationScope: request.activationScope || "memory_or_rule_candidate",
    enabled: false,
    productionMemoryWritten: false,
    requiresLaterMemoryLifecycleGate: true
  };
  ruleActivationCandidate = {
    format: "transparent_ai_real_case_confirmed_outcome_rule_activation_candidate_v1",
    ...sourceContext,
    sourceGateId: gate.gateId,
    controlledOutputPath: outputPath,
    controlledOutputSha256: outputPath && existsSync(outputPath) ? hashFile(outputPath) : "",
    requestedLifecycleTarget: "active_candidate_pending_rule_dsl_validation_or_memory_lifecycle_gate",
    ruleEnabled: false,
    productionRuleRegistryMutated: false,
    requiresLaterRuleDslLifecycleGate: true
  };
  writeJson(memoryCandidatePath, memoryCandidate);
  writeJson(ruleActivationCandidatePath, ruleActivationCandidate);
  ledger = {
    format: "transparent_ai_real_case_confirmed_outcome_durable_activation_ledger_v1",
    activationId,
    createdAt: new Date().toISOString(),
    ...sourceContext,
    sourceGatePath: gateInput.path,
    sourceGateHash: hashText(JSON.stringify(gate)),
    manifestPath,
    manifestHash,
    freshRollbackPoint,
    requestedDurableArtifacts,
    candidateFiles: {
      memoryCandidate: memoryCandidatePath,
      ruleActivationCandidate: ruleActivationCandidatePath
    },
    controlledOutputPath: outputPath,
    controlledOutputSha256: outputPath && existsSync(outputPath) ? hashFile(outputPath) : "",
    productionMemoryWritten: false,
    productionRuleRegistryMutated: false,
    ruleEnabled: false,
    memoryWritten: false,
    ragFetched: false,
    ragEvidenceTreatedAsAuthority: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false,
    nextRequiredGate: "teacher_reviewed_memory_or_rule_lifecycle_gate"
  };
  writeJson(ledgerPath, ledger);
}

const runnerInvoked = Boolean(ledger);
const locks = activationLocks({ runnerInvoked });
const status =
  blockers.length > 0
    ? "blocked_before_real_case_confirmed_outcome_separate_durable_activation_runner"
    : "real_case_confirmed_outcome_separate_durable_activation_runner_completed_waiting_for_lifecycle_review";

const packet = {
  ok: blockers.length === 0,
  format: "transparent_ai_real_case_confirmed_outcome_separate_durable_activation_runner_v1",
  activationId,
  createdAt: new Date().toISOString(),
  status,
  ...sourceContext,
  sourceGateId: gate.gateId,
  sourceGatePath: gateInput.path,
  sourceGateHash: hashText(JSON.stringify(gate)),
  durableActivationRequest: request || null,
  activationManifestPath: manifestPath,
  activationManifestHash: manifestHash,
  freshRollbackPoint,
  executeDurableActivationRunner: executeRunner,
  finalTeacherActivationConfirmationMatched: finalConfirmation,
  runnerInvoked,
  candidateLedgerWritten: runnerInvoked,
  ledgerPath: runnerInvoked ? ledgerPath : "",
  memoryCandidatePath: runnerInvoked ? memoryCandidatePath : "",
  ruleActivationCandidatePath: runnerInvoked ? ruleActivationCandidatePath : "",
  blockers,
  nextTeacherActions: runnerInvoked
    ? [
        "Review the durable activation ledger and candidate files.",
        "Route memory candidates to the memory lifecycle gate or rule candidates to the Rule DSL lifecycle gate.",
        "Keep the rollback point until the teacher confirms this durable direction is correct."
      ]
    : ["Resolve blockers before any durable candidate files are written."],
  completionBoundary: {
    goalComplete: false,
    accepted: false,
    reason:
      "This runner writes only candidate ledger files after final teacher confirmation. It does not write production memory, enable rules, unlock packaging, or complete the whole apprentice objective."
  },
  locks,
  paths: {
    runner: runnerPath,
    receipt: receiptPath,
    ledger: runnerInvoked ? ledgerPath : "",
    memoryCandidate: runnerInvoked ? memoryCandidatePath : "",
    ruleActivationCandidate: runnerInvoked ? ruleActivationCandidatePath : "",
    readme: readmePath
  }
};

const receipt = {
  format: "transparent_ai_real_case_confirmed_outcome_separate_durable_activation_receipt_v1",
  activationId,
  status,
  ...sourceContext,
  sourceGatePath: gateInput.path,
  freshRollbackPoint,
  runnerInvoked,
  candidateLedgerWritten: runnerInvoked,
  ledgerPath: runnerInvoked ? ledgerPath : "",
  memoryCandidatePath: runnerInvoked ? memoryCandidatePath : "",
  ruleActivationCandidatePath: runnerInvoked ? ruleActivationCandidatePath : "",
  blockers,
  teacherReview: {
    candidateLedgerMatchedIntent: "needs_teacher_review",
    nextDecision: "needs_teacher_review",
    teacherNote: ""
  },
  locks
};

writeJson(runnerPath, packet);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Real-Case Confirmed Outcome Separate Durable Activation Runner",
    "",
    `Status: ${status}`,
    `Runner invoked: ${runnerInvoked}`,
    `Candidate ledger written: ${runnerInvoked}`,
    "",
    "This runner consumes a confirmed-outcome durable activation gate, a teacher-reviewed activation manifest, final teacher confirmation, and a fresh rollback point.",
    "It writes only durable candidate ledger files. It does not write production memory, enable rules, fetch RAG, execute target software, unlock packaging, accept technology, or complete the whole apprentice objective.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((row) => `- ${row.code}: ${row.message}`) : ["- none"]),
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: packet.ok,
      format: "transparent_ai_real_case_confirmed_outcome_separate_durable_activation_runner_result_v1",
      status,
      ...sourceContext,
      runnerPath,
      receiptPath,
      readmePath,
      ledgerPath: runnerInvoked ? ledgerPath : "",
      memoryCandidatePath: runnerInvoked ? memoryCandidatePath : "",
      ruleActivationCandidatePath: runnerInvoked ? ruleActivationCandidatePath : "",
      sourceGatePath: gateInput.path,
      freshRollbackPoint,
      runnerInvoked,
      candidateLedgerWritten: runnerInvoked,
      memoryCandidateWritten: runnerInvoked,
      ruleActivationCandidateWritten: runnerInvoked,
      blockers,
      productionMemoryWritten: false,
      productionRuleRegistryMutated: false,
      memoryWritten: false,
      ruleEnabled: false,
      ragFetched: false,
      ragEvidenceTreatedAsAuthority: false,
      accepted: false,
      packagingGated: true,
      packagingUnlocked: false,
      goalComplete: false,
      locks
    },
    null,
    2
  )
);

if (!packet.ok) process.exitCode = 1;
