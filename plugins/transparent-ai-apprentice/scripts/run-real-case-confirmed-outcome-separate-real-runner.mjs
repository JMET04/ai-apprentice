#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

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
    "teacher confirmed confirmed-outcome separate real runner",
    "teacher confirmed real-case confirmed outcome separate real runner",
    "approve confirmed-outcome separate real runner",
    "i confirm confirmed-outcome separate real runner"
  ].some((marker) => text.includes(marker));
}

function safeFileName(value, fallback) {
  const name = String(value || fallback || "").trim();
  if (!name || basename(name) !== name || /[\\/:*?"<>|]/.test(name)) throw new Error("targetOutputFileName must be a plain file name");
  return name;
}

function locks({ runnerInvoked = false } = {}) {
  return {
    reviewOnly: false,
    confirmedOutcomeBranch: true,
    separateRealRunner: true,
    runnerInvoked,
    adapterInvoked: runnerInvoked,
    oneControlledAttemptOnly: true,
    finalTeacherConfirmationRequired: true,
    freshRollbackPointRequired: true,
    filesWrittenOutsideRunDir: false,
    uiEventsSent: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    ruleEnabled: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

function runReviewedNodeManifest(manifest, outputDir) {
  if (manifest.format !== "transparent_ai_real_case_reviewed_node_runner_manifest_v1") {
    throw new Error("reviewed runner manifest format is required");
  }
  if (manifest.teacherReviewed !== true) throw new Error("runner manifest teacherReviewed must be true");
  if (manifest.commandKind !== "node-script") throw new Error("only node-script runner manifests are supported");
  if (!manifest.scriptSourceFile || !existsSync(manifest.scriptSourceFile)) throw new Error("scriptSourceFile not found");
  const scriptPath = resolve(manifest.scriptSourceFile);
  const scriptHash = hashFile(scriptPath);
  if (manifest.expectedScriptSha256 && scriptHash !== String(manifest.expectedScriptSha256).toLowerCase()) {
    throw new Error("expectedScriptSha256 mismatch");
  }
  const targetOutputFileName = safeFileName(manifest.targetOutputFileName, "real-case-confirmed-outcome-runner-output.json");
  const outputPath = join(outputDir, targetOutputFileName);
  const args = Array.isArray(manifest.args) ? manifest.args.map(String) : [];
  const result = spawnSync(process.execPath, [scriptPath, "--output", outputPath, ...args], {
    cwd: dirname(scriptPath),
    encoding: "utf8",
    timeout: Number(manifest.timeoutMs || 30000)
  });
  const outputExists = existsSync(outputPath);
  return {
    commandKind: manifest.commandKind,
    scriptPath,
    scriptSha256: scriptHash,
    args,
    exitCode: result.status,
    stdout: String(result.stdout || "").slice(0, 4000),
    stderr: String(result.stderr || "").slice(0, 4000),
    outputPath,
    outputExists,
    outputSha256: outputExists ? hashFile(outputPath) : "",
    ok: result.status === 0 && outputExists
  };
}

const gateInput = readJsonInput(
  argValue("--approval-gate", argValue("--gate", "")),
  "--approval-gate",
  "transparent_ai_real_case_confirmed_outcome_adapter_specific_runner_approval_gate_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-separate-real-runs"))
);
const freshRollbackPoint = resolve(argValue("--fresh-rollback-point", argValue("--rollback-point", "")) || ".");
const executeFinalRun = hasFlag("--execute-final-run") || hasFlag("--execute");
const finalConfirmation = finalConfirmationMatches(argValue("--teacher-confirmation", argValue("--confirmation", "")));
const reviewedRunnerManifestInput = argValue("--reviewed-runner-manifest", "");
const gate = gateInput.value;
const request = gate.separateRealRunnerRequest;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (gate.status !== "real_case_confirmed_outcome_adapter_specific_runner_approval_gate_ready_for_separate_real_runner") {
  block("approval_gate_not_ready", "Confirmed-outcome approval gate must be ready for separate real runner.");
}
if (gate.approvedForSeparateRealRunner !== true) block("approval_gate_not_approved", "Confirmed-outcome approval gate must be approved for separate real runner.");
if (!request || request.format !== "transparent_ai_real_case_confirmed_outcome_separate_real_runner_request_v1") {
  block("separate_real_runner_request_missing", "Gate must include a confirmed-outcome separate real-runner request.");
}
if (gate.confirmedOutcomeBranch !== true) block("approval_gate_confirmed_outcome_branch_missing", "Approval gate must retain confirmedOutcomeBranch=true.");
if (gate.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  block("approval_gate_source_review_format_mismatch", "Approval gate sourceReviewFormat must remain the confirmed-outcome runner outcome review format.");
}
if (!gate.sourceConfirmedOutcomeReviewId || !gate.sourceConfirmedOutcomeSourceRunId || !gate.sourceRunId) {
  block(
    "approval_gate_source_ids_missing",
    "Approval gate must retain sourceConfirmedOutcomeReviewId, sourceConfirmedOutcomeSourceRunId, and sourceRunId."
  );
}
if (request?.confirmedOutcomeBranch !== true) block("confirmed_outcome_branch_missing", "Request must retain confirmedOutcomeBranch=true.");
if (request?.sourceReviewFormat !== gate.sourceReviewFormat) {
  block("request_source_review_format_mismatch", "separateRealRunnerRequest.sourceReviewFormat must match the approval gate.");
}
if (request?.sourceConfirmedOutcomeReviewId !== gate.sourceConfirmedOutcomeReviewId) {
  block("request_source_review_id_mismatch", "separateRealRunnerRequest.sourceConfirmedOutcomeReviewId must match the approval gate.");
}
if (request?.sourceConfirmedOutcomeSourceRunId !== gate.sourceConfirmedOutcomeSourceRunId) {
  block(
    "request_source_confirmed_outcome_source_run_id_mismatch",
    "separateRealRunnerRequest.sourceConfirmedOutcomeSourceRunId must match the approval gate."
  );
}
if (request?.sourceRunId !== gate.sourceRunId) {
  block("request_source_run_id_mismatch", "separateRealRunnerRequest.sourceRunId must match the approval gate.");
}
if (request?.executeNow !== false) block("request_execute_now_forbidden", "separateRealRunnerRequest.executeNow must remain false.");
if (request?.requiresFinalTeacherExecuteConfirmation !== true) {
  block("final_teacher_confirmation_contract_missing", "Request must require final teacher execute confirmation.");
}
if (request?.requiresFreshRollbackPointBeforeRun !== true) {
  block("fresh_rollback_contract_missing", "Request must require a fresh rollback point before run.");
}
if (!freshRollbackPoint || !existsSync(freshRollbackPoint)) block("fresh_rollback_point_not_found", "A fresh rollback point must exist.");
if (!executeFinalRun) block("missing_execute_final_run_flag", "Runner requires --execute-final-run for the one controlled attempt.");
if (!finalConfirmation) block("missing_final_teacher_confirmation", "Runner requires final teacher confirmation text.");
if (!reviewedRunnerManifestInput) block("reviewed_runner_manifest_required", "A teacher-reviewed runner manifest is required.");
if (
  gate.locks?.confirmedOutcomeBranch !== true ||
  gate.locks?.adapterInvoked !== false ||
  gate.locks?.targetSoftwareCommandsExecuted !== false ||
  gate.locks?.uiEventsSent !== false ||
  gate.locks?.memoryWritten !== false ||
  gate.locks?.ragFetched !== false ||
  gate.locks?.packagingUnlocked !== false
) {
  block("source_gate_locks_not_closed", "Source confirmed-outcome approval gate must have closed execution locks.");
}

const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${request?.adapterSelection?.adapterId || "confirmed-outcome-real-case-runner"}`;
const runDir = join(outRoot, runId.replace(/[\\/:*?"<>|]/g, "_"));
const controlledOutputDir = join(runDir, "controlled-output");
mkdirSync(controlledOutputDir, { recursive: true });
const runPath = join(runDir, "real-case-confirmed-outcome-separate-real-runner.json");
const receiptPath = join(runDir, "real-case-confirmed-outcome-separate-real-runner-receipt.json");
const readmePath = join(runDir, "REAL_CASE_CONFIRMED_OUTCOME_SEPARATE_REAL_RUNNER_START_HERE.md");

let reviewedRunnerManifest = null;
let reviewedRunnerManifestPath = "";
let reviewedRunnerManifestHash = "";
let adapterRun = null;
if (reviewedRunnerManifestInput) {
  try {
    const manifestInput = readJsonInput(reviewedRunnerManifestInput, "--reviewed-runner-manifest");
    reviewedRunnerManifest = manifestInput.value;
    reviewedRunnerManifestPath = manifestInput.path;
    reviewedRunnerManifestHash = hashText(JSON.stringify(reviewedRunnerManifest));
  } catch (error) {
    block("reviewed_runner_manifest_invalid", error?.message || String(error));
  }
}

const canInvoke = blockers.length === 0;
if (canInvoke) {
  try {
    adapterRun = runReviewedNodeManifest(reviewedRunnerManifest, controlledOutputDir);
    if (!adapterRun.ok) block("reviewed_runner_manifest_execution_failed", "Reviewed runner manifest did not exit 0 with output.");
  } catch (error) {
    block("reviewed_runner_manifest_execution_blocked", error?.message || String(error));
  }
}

const runnerInvoked = Boolean(adapterRun);
const controlledRouteActionExecuted = Boolean(adapterRun?.ok);
const status =
  blockers.length > 0 && !runnerInvoked
    ? "blocked_before_real_case_confirmed_outcome_separate_real_runner"
    : controlledRouteActionExecuted
      ? "real_case_confirmed_outcome_separate_real_runner_completed_waiting_for_teacher_outcome_review"
      : runnerInvoked
        ? "real_case_confirmed_outcome_separate_real_runner_invoked_waiting_for_teacher_review"
        : "blocked";
const runnerLocks = locks({ runnerInvoked });
const sourceContext = {
  confirmedOutcomeBranch: gate.confirmedOutcomeBranch === true,
  sourceReviewFormat: gate.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: gate.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: gate.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: gate.sourceRunId
};
const packet = {
  ok: blockers.length === 0,
  format: "transparent_ai_real_case_confirmed_outcome_separate_real_runner_v1",
  runId,
  createdAt: new Date().toISOString(),
  status,
  ...sourceContext,
  sourceApprovalGatePath: gateInput.path,
  sourceApprovalGateHash: hashText(JSON.stringify(gate)),
  separateRealRunnerRequest: request || null,
  reviewedRunnerManifestPath,
  reviewedRunnerManifestHash,
  freshRollbackPoint,
  executeFinalRun,
  finalConfirmationMatched: finalConfirmation,
  runnerInvoked,
  adapterInvoked: runnerInvoked,
  controlledRouteActionExecuted,
  targetSoftwareCommandsExecuted: controlledRouteActionExecuted,
  uiEventsSent: false,
  adapterRun,
  blockers,
  controlledOutputDir,
  nextTeacherActions: controlledRouteActionExecuted
    ? [
        "Review the confirmed-outcome separate runner packet and receipt.",
        "Inspect the controlled output file and hash.",
        "If the confirmed outcome is wrong, route the correction to high-reasoning repair before memory or rule enablement."
      ]
    : [
        "Resolve every blocker before any confirmed-outcome separate runner attempt.",
        "Keep the fresh rollback point until the teacher confirms the run direction is correct."
      ],
  completionBoundary: {
    goalComplete: false,
    accepted: false,
    reason:
      "This is one controlled confirmed-outcome real-case runner attempt. It does not accept technology, write memory, unlock packaging, or complete the whole apprentice objective."
  },
  locks: runnerLocks,
  paths: {
    run: runPath,
    receipt: receiptPath,
    readme: readmePath
  }
};
const receipt = {
  format: "transparent_ai_real_case_confirmed_outcome_separate_real_runner_receipt_v1",
  runId,
  status,
  ...sourceContext,
  sourceApprovalGatePath: gateInput.path,
  freshRollbackPoint,
  runnerInvoked,
  adapterInvoked: runnerInvoked,
  controlledRouteActionExecuted,
  targetSoftwareCommandsExecuted: controlledRouteActionExecuted,
  uiEventsSent: false,
  outputPath: adapterRun?.outputPath || "",
  outputSha256: adapterRun?.outputSha256 || "",
  blockers,
  teacherReview: {
    outputMatchedIntent: "needs_teacher_review",
    nextDecision: "needs_teacher_review",
    teacherNote: ""
  },
  locks: runnerLocks
};

writeJson(runPath, packet);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Real-Case Confirmed-Outcome Separate Real Runner",
    "",
    `Status: ${status}`,
    `Runner invoked: ${runnerInvoked}`,
    `Controlled route action executed: ${controlledRouteActionExecuted}`,
    "",
    "This runner consumes one confirmed-outcome adapter-specific approval gate, a fresh rollback point, final teacher confirmation, and a teacher-reviewed runner manifest.",
    "It writes all controlled output inside the run directory and keeps memory, RAG, packaging, acceptance, and goal completion locked.",
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
      format: "transparent_ai_real_case_confirmed_outcome_separate_real_runner_result_v1",
      status,
      ...sourceContext,
      runPath,
      receiptPath,
      readmePath,
      sourceApprovalGatePath: gateInput.path,
      freshRollbackPoint,
      runnerInvoked,
      adapterInvoked: runnerInvoked,
      controlledRouteActionExecuted,
      targetSoftwareCommandsExecuted: controlledRouteActionExecuted,
      uiEventsSent: false,
      outputPath: adapterRun?.outputPath || "",
      outputSha256: adapterRun?.outputSha256 || "",
      blockers,
      memoryWritten: false,
      ragFetched: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      packagingUnlocked: false,
      goalComplete: false,
      locks: runnerLocks
    },
    null,
    2
  )
);

if (!packet.ok) process.exitCode = 1;
