#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-rag-informed-repair-approved-gate-outcome-review-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-informed-repair-approved-gate-outcome-review-receipt-builder"
  );
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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function locks() {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    receiptBuilderOnly: true,
    reusesExistingRepairOutcomeReviewBuilder: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    ragFreshOutcomeReviewRequired: true,
    doesNotValidateReceipt: true,
    doesNotRunApprovedGate: true,
    doesNotRunMediumRuntimeWorkflow: true,
    doesNotExecuteTargetSoftware: true,
    doesNotCaptureScreenshots: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packagingUnlocked: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function runNode(scriptName, args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function adaptRagRun(ragRun) {
  const reused = ragRun.generatedEvidence?.reusableWorkflowRunnerResult || {};
  return {
    ...ragRun,
    format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_runner_v1",
    status:
      ragRun.status === "rag_informed_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review"
        ? "reusable_workflow_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review"
        : ragRun.status,
    sourceRagInformedRepairRunId: ragRun.runId || "",
    sourceRagInformedRepairRunStatus: ragRun.status || "",
    generatedEvidence: {
      ...(ragRun.generatedEvidence || {}),
      reusableWorkflowRunnerResult: reused,
      existingRunnerPacketPath: ragRun.generatedEvidence?.existingRunnerPacketPath || reused.existingRunnerPacketPath || "",
      existingRunnerReceiptPath: ragRun.generatedEvidence?.existingRunnerReceiptPath || reused.existingRunnerReceiptPath || "",
      adapterReceiptPath: ragRun.generatedEvidence?.adapterReceiptPath || reused.adapterReceiptPath || "",
      outcomeVerificationPath: ragRun.generatedEvidence?.outcomeVerificationPath || reused.outcomeVerificationPath || "",
      postActionCheckpointPath: ragRun.generatedEvidence?.postActionCheckpointPath || reused.postActionCheckpointPath || ""
    },
    locks: {
      ...(ragRun.locks || {}),
      freshOutcomeReviewRequired: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    }
  };
}

const goal = argValue(
  "--goal",
  "Build a fresh teacher outcome review receipt for one RAG-informed high-reasoning repaired TLCL run."
);
const ragRunInput = readJsonInput(
  argValue("--run", argValue("--rag-run", argValue("--approved-gate-runner", ""))),
  "--run",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_runner_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-informed-repair-approved-gate-outcome-review-receipt-builders")
  )
);
const ragRun = ragRunInput.value;
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const builderDir = join(outRoot, builderId);
const adaptedRunPath = join(builderDir, "adapted-high-reasoning-repair-approved-gate-runner.json");
writeJson(adaptedRunPath, adaptRagRun(ragRun));

const blockers = [];
if (ragRun.status !== "rag_informed_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review") {
  blockers.push("rag_informed_repair_approved_gate_runner_not_waiting_for_fresh_outcome_review");
}
if (ragRun.runnerInvoked !== true) blockers.push("rag_informed_repair_runner_not_invoked");
if (ragRun.controlledRouteActionExecuted !== true) blockers.push("rag_informed_repair_controlled_route_not_executed");
if (ragRun.ragEvidenceTreatedAsAuthority !== false) blockers.push("rag_evidence_authority_lock_missing_from_runner");
if (ragRun.locks?.ragEvidenceNonAuthoritative !== true) blockers.push("rag_non_authority_lock_missing_from_runner");
if (ragRun.locks?.doesNotTreatRagAsAuthority !== true) blockers.push("rag_authority_forbidden_lock_missing_from_runner");
if (ragRun.locks?.freshOutcomeReviewStillRequired !== true) blockers.push("rag_fresh_outcome_review_lock_missing_from_runner");
if (ragRun.locks?.goalComplete !== false) blockers.push("rag_runner_goal_completion_lock_missing");
if (ragRun.locks?.packagingGated !== true) blockers.push("rag_runner_packaging_gate_lock_missing");

const reusedBuilder =
  blockers.length === 0
    ? runNode(
        "create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt-builder.mjs",
        ["--goal", goal, "--run", adaptedRunPath, "--out-dir", join(builderDir, "reused-repair-outcome-review-builder")],
        process.cwd()
      )
    : null;
const reusedTemplate = reusedBuilder ? readJson(reusedBuilder.receiptTemplatePath) : null;
const receiptTemplatePath = join(builderDir, "tlcl-rag-informed-repair-approved-gate-outcome-review-receipt-template.json");
const builderPath = join(builderDir, "tlcl-rag-informed-repair-approved-gate-outcome-review-receipt-builder.json");
const readmePath = join(builderDir, "TLCL_RAG_INFORMED_REPAIR_APPROVED_GATE_OUTCOME_REVIEW_RECEIPT_BUILDER_START_HERE.md");
const status =
  blockers.length === 0
    ? "rag_informed_repair_approved_gate_outcome_review_receipt_builder_ready_for_teacher_use"
    : "blocked_before_rag_informed_repair_approved_gate_outcome_review_receipt_builder";
const receiptTemplate = reusedTemplate
  ? {
      ...reusedTemplate,
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_receipt_v1",
      sourceRagInformedRunPath: ragRunInput.path,
      sourceRagInformedRunId: ragRun.runId || "",
      ragEvidenceReviewed: false,
      ragEvidenceTreatedAsAuthority: false,
      ragNonAuthorityConfirmed: false,
      ragLogicSupportReviewed: false,
      teacherNote:
        "Review this fresh RAG-informed repair outcome. RAG evidence can support the logic but cannot authorize memory, rules, packaging, execution, or completion."
    }
  : {
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_receipt_v1",
      builderId,
      sourceRagInformedRunPath: ragRunInput.path,
      sourceRagInformedRunId: ragRun.runId || "",
      teacherDecision: "needs_teacher_review",
      repairRunnerPacketReviewed: false,
      reusedWorkflowRunnerPacketReviewed: false,
      repairedRouteOutcomeReviewed: false,
      repairWorkflowFingerprintReviewed: false,
      ragEvidenceReviewed: false,
      ragEvidenceTreatedAsAuthority: false,
      ragNonAuthorityConfirmed: false,
      ragLogicSupportReviewed: false,
      blockedActionsConfirmed: true,
      locks: locks()
    };
const builder = {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  blockers,
  sourceRagInformedRunStatus: ragRun.status || "",
  reusedRepairOutcomeReviewBuilderInvoked: Boolean(reusedBuilder),
  reusedRepairOutcomeReviewBuilderStatus: reusedBuilder?.status || "",
  ragOutcomeContext: {
    ragRunId: ragRun.runId || "",
    runnerInvoked: ragRun.runnerInvoked === true,
    controlledRouteActionExecuted: ragRun.controlledRouteActionExecuted === true,
    targetSoftwareCommandsExecuted: ragRun.targetSoftwareCommandsExecuted === true,
    ragEvidenceTreatedAsAuthority: false,
    workflowFingerprint: ragRun.sourceEvidence?.workflowFingerprint || ""
  },
  defaultReceipt: receiptTemplate,
  sourceEvidence: {
    ragInformedRunPath: ragRunInput.path,
    ragInformedRunHash: sha256Object(ragRun),
    adaptedRepairRunPath: adaptedRunPath,
    reusedBuilderPath: reusedBuilder?.builderPath || "",
    reusedReceiptTemplatePath: reusedBuilder?.receiptTemplatePath || ""
  },
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs --run "' +
    (ragRunInput.path || "<tlcl-rag-informed-repair-approved-gate-runner.json>") +
    '" --receipt "<teacher-filled-rag-informed-outcome-review-receipt.json>"',
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceRagInformedRun: ragRunInput.path,
    adaptedRepairRun: adaptedRunPath
  },
  locks: locks()
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL RAG-Informed Repair Approved-Gate Outcome Review Receipt Builder",
    "",
    `Status: ${status}`,
    `Source RAG-informed run: ${ragRunInput.path || "<inline>"}`,
    "",
    "Use this only after a RAG-informed high-reasoning repair approved-gate runner proves one controlled route and is waiting for fresh outcome review.",
    "A matched fresh outcome remains review-only until a later reuse review. A mismatch or teacher correction returns to high-reasoning repair again.",
    "RAG evidence remains non-authoritative throughout this review.",
    "",
    "This builder does not validate the receipt, rerun the approved gate, execute software, capture screenshots, write memory, enable rules, unlock packaging, treat RAG as authority, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    `Next validation command: ${builder.nextValidationCommand}`
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_receipt_builder_result_v1",
      builderId,
      status,
      builderPath,
      receiptTemplatePath,
      readmePath,
      adaptedRunPath,
      blockers,
      reusedRepairOutcomeReviewBuilderInvoked: Boolean(reusedBuilder),
      reusedRepairOutcomeReviewBuilderStatus: reusedBuilder?.status || "",
      controlledRouteActionExecuted: builder.ragOutcomeContext.controlledRouteActionExecuted,
      targetSoftwareCommandsExecuted: builder.ragOutcomeContext.targetSoftwareCommandsExecuted,
      ragEvidenceTreatedAsAuthority: false,
      doesNotRunApprovedGate: true,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      packagingUnlocked: false,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    },
    null,
    2
  )
);
