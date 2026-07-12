#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "tlcl-rag-informed-high-reasoning-repair-intake-smoke",
  String(Date.now())
);
mkdirSync(smokeRoot, { recursive: true });

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const tlclPacketPath = writeJson(join(smokeRoot, "tlcl-repair-packet.json"), {
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_validation_v1",
  status: "repaired_reusable_workflow_invocation_reuse_review_to_high_reasoning_contract_repair",
  decision: "correction_to_high_reasoning_repair",
  mediumRuntimeWorkflowEnabled: false,
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const planningLogicEvidence = {
  query: "packaging dieline fold allowance rule",
  logicExtractionHint: "fold allowance depends on material thickness, print-side orientation, and scored fold angle"
};
const readyRagValidationPath = writeJson(join(smokeRoot, "ready-rag-validation.json"), {
  format: "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1",
  status: "ready_for_review_only_rule_dsl_validation",
  planningLogicEvidence,
  planningLogicEvidenceHash: sha256Object(planningLogicEvidence),
  approvedDisabledDrafts: [
    {
      sourceId: "manual.packaging.001",
      retrievalPath: join(smokeRoot, "retrieval-evidence-packet.json"),
      rulePath: join(smokeRoot, "draft-disabled-rule-card.json"),
      ruleLifecycle: "draft_disabled",
      logicExtractionHint: planningLogicEvidence.logicExtractionHint,
      logicFitDecision: "matches_intended_logic",
      evidenceRefs: ["retrieval://manual.packaging.001/chunk.001"],
      reviewerNote: "Use as evidence for high-reasoning contract repair only."
    }
  ],
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false
  }
});

const attachmentResult = runNode("scripts/create-tlcl-rag-evidence-attachment.mjs", [
  "--tlcl-packet",
  tlclPacketPath,
  "--rag-validation",
  readyRagValidationPath,
  "--out-dir",
  join(smokeRoot, "attachment")
]);
const unsafeAttachmentPath = writeJson(join(smokeRoot, "unsafe-attachment.json"), {
  ...readJson(attachmentResult.attachmentPath),
  locks: {
    ...readJson(attachmentResult.attachmentPath).locks,
    ragDoesNotEnableRules: false
  }
});
const continuedAttachmentPath = writeJson(join(smokeRoot, "continued-attachment.json"), {
  ...readJson(attachmentResult.attachmentPath),
  highReasoningReviewHandoff: {
    ...readJson(attachmentResult.attachmentPath).highReasoningReviewHandoff,
    mediumRuntimeContinuationAllowed: true
  }
});

const ready = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-intake.mjs", [
  "--attachment",
  attachmentResult.attachmentPath,
  "--out-dir",
  join(smokeRoot, "intakes")
]);
const unsafe = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-intake.mjs", [
  "--attachment",
  unsafeAttachmentPath,
  "--out-dir",
  join(smokeRoot, "intakes")
]);
const continued = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-intake.mjs", [
  "--attachment",
  continuedAttachmentPath,
  "--out-dir",
  join(smokeRoot, "intakes")
]);
const readyPacket = readJson(ready.intakePath);
const readyPrompt = readFileSync(ready.promptPath, "utf8");

const checks = [
  check(
    "RAG evidence attachment becomes high-reasoning repair intake only",
    ready.status === "tlcl_rag_informed_high_reasoning_repair_intake_waiting_for_teacher_review" &&
      ready.readyForTeacherReview === true &&
      ready.readyForMediumRuntime === false &&
      ready.evidenceReviewRowCount === 1 &&
      ready.teacherQuestionCount >= 3 &&
      ready.highReasoningRepairTaskCount >= 5,
    ready.intakePath
  ),
  check(
    "RAG-informed repair intake optimizes prompt around explicit logic extraction",
    readyPrompt.includes("highest-reasoning TLCL contract compiler") &&
      readyPrompt.includes("dimensions, angles, line relationships, tolerances, formulas") &&
      readyPacket.evidenceReviewRows[0].repairQuestions.some((question) => question.includes("deterministic validator")),
    ready.promptPath
  ),
  check(
    "RAG-informed repair intake blocks rule enablement and keeps all side effects false",
    unsafe.status === "blocked_before_tlcl_rag_informed_high_reasoning_repair_intake" &&
      unsafe.blockerCount >= 1 &&
      unsafe.ruleEnabled === false &&
      unsafe.memoryWritten === false &&
      unsafe.packagingUnlocked === false &&
      unsafe.goalComplete === false,
    unsafe.intakePath
  ),
  check(
    "RAG-informed repair intake rejects medium-runtime continuation before teacher review",
    continued.status === "blocked_before_tlcl_rag_informed_high_reasoning_repair_intake" &&
      continued.readyForMediumRuntime === false &&
      continued.mediumRuntimeContinued === false &&
      continued.targetSoftwareCommandsExecuted === false,
    continued.intakePath
  ),
  check(
    "RAG-informed repair intake preserves deterministic locks and forbidden transitions",
    readyPacket.locks.reviewOnly === true &&
      readyPacket.locks.evidenceOnly === true &&
      readyPacket.locks.mediumRuntimeContinuationBlocked === true &&
      readyPacket.forbiddenTransitions.includes("treat_rag_as_authority_from_rag_informed_repair_intake") &&
      readyPacket.mediumRuntimeRetryGate.requiresDeterministicValidation === true,
    JSON.stringify(readyPacket.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_intake_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  readyIntakePath: ready.intakePath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
