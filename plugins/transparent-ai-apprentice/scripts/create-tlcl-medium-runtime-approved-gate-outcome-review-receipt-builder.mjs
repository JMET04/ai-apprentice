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

function slug(value) {
  return (
    String(value || "tlcl-approved-gate-outcome-review-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-approved-gate-outcome-review-receipt-builder"
  );
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function locks() {
  return {
    reviewOnly: true,
    receiptBuilderOnly: true,
    doesNotValidateReceipt: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotCaptureScreenshots: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher outcome review receipt for one TLCL approved-gate run.");
const runInput = readJsonInput(
  argValue("--run", argValue("--approved-gate-runner", "")),
  "--run",
  "transparent_ai_tlcl_medium_runtime_approved_gate_runner_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-approved-gate-outcome-review-receipt-builders"))
);
const run = runInput.value;
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "tlcl-medium-runtime-approved-gate-outcome-review-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "tlcl-medium-runtime-approved-gate-outcome-review-receipt-template.json");
const readmePath = join(builderDir, "TLCL_MEDIUM_RUNTIME_APPROVED_GATE_OUTCOME_REVIEW_RECEIPT_BUILDER_START_HERE.md");

const receiptTemplate = {
  format: "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_receipt_v1",
  builderId,
  sourceRunPath: runInput.path,
  sourceRunId: run.runId || "",
  teacherDecision: "needs_teacher_review",
  runnerPacketReviewed: false,
  existingRunnerReceiptReviewed: false,
  adapterReceiptReviewed: false,
  outcomeVerificationReviewed: false,
  postActionCheckpointReviewed: false,
  rollbackPointStillRetained: false,
  teacherMatchedContract: false,
  teacherCorrection: "",
  observedIssue: "",
  affectedLogicFields: [],
  teacherNote: "",
  blockedActionsConfirmed: true,
  locks: locks()
};

const builder = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "approved_gate_outcome_review_receipt_builder_ready_for_teacher_use",
  sourceRunStatus: run.status || "",
  sourceRunSummary: {
    runnerInvoked: run.runnerInvoked === true,
    controlledRouteActionExecuted: run.controlledRouteActionExecuted === true,
    targetSoftwareCommandsExecuted: run.targetSoftwareCommandsExecuted === true,
    existingRunnerReceiptPath: run.generatedEvidence?.existingRunnerReceiptPath || "",
    adapterReceiptPath: run.generatedEvidence?.adapterReceiptPath || "",
    outcomeVerificationPath: run.generatedEvidence?.outcomeVerificationPath || "",
    postActionCheckpointPath: run.generatedEvidence?.postActionCheckpointPath || ""
  },
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "executed_route_matched_contract",
    "executed_route_mismatch_blocked",
    "correction_to_high_reasoning_repair"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "enable_rule",
    "write_memory",
    "unlock_packaging",
    "claim_goal_complete",
    "claim_all_software_complete"
  ],
  defaultReceipt: receiptTemplate,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs --run "' +
    (runInput.path || "<tlcl-medium-runtime-approved-gate-runner.json>") +
    '" --receipt "<teacher-filled-tlcl-medium-runtime-approved-gate-outcome-review-receipt.json>"',
  sourceEvidence: {
    runPath: runInput.path,
    runHash: sha256Object(run)
  },
  blockedActions: [
    "run_approved_gate_from_outcome_review_builder",
    "execute_target_software_from_outcome_review_builder",
    "enable_rule_from_outcome_review_builder",
    "write_memory_from_outcome_review_builder",
    "unlock_packaging_from_outcome_review_builder",
    "claim_goal_complete_from_outcome_review_builder"
  ],
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceRun: runInput.path
  },
  locks: locks()
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Approved-Gate Outcome Review Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Source run: ${runInput.path || "<inline>"}`,
    "",
    "Use this after a TLCL approved-gate runner has produced one controlled route outcome.",
    "The teacher may say the executed route matched the TLCL contract, block it as a mismatch, or send a correction back to high-reasoning repair.",
    "",
    "This builder does not validate the receipt, execute software, capture screenshots, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    `Next validation command: ${builder.nextValidationCommand}`
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      receiptTemplatePath,
      readmePath,
      sourceRunStatus: builder.sourceRunStatus,
      controlledRouteActionExecuted: builder.sourceRunSummary.controlledRouteActionExecuted,
      targetSoftwareCommandsExecuted: builder.sourceRunSummary.targetSoftwareCommandsExecuted,
      runnerInvoked: builder.sourceRunSummary.runnerInvoked,
      doesNotRunApprovedGate: true,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    },
    null,
    2
  )
);
