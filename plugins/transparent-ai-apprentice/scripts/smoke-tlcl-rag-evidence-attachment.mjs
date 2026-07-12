#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-rag-evidence-attachment-smoke", String(Date.now()));
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
  logicExtractionHint: "fold allowance depends on material thickness and print-side orientation"
};
const readyRagValidation = {
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
      reviewerNote: "Use as evidence for the next high-reasoning contract repair only."
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
};
const readyRagValidationPath = writeJson(join(smokeRoot, "ready-rag-validation.json"), readyRagValidation);
const blockedRagValidationPath = writeJson(join(smokeRoot, "blocked-rag-validation.json"), {
  ...readyRagValidation,
  status: "waiting_for_teacher_review",
  approvedDisabledDrafts: [],
  locks: {
    ...readyRagValidation.locks,
    ruleEnabled: false
  }
});
const unsafeRagValidationPath = writeJson(join(smokeRoot, "unsafe-rag-validation.json"), {
  ...readyRagValidation,
  locks: {
    ...readyRagValidation.locks,
    ruleEnabled: true
  }
});

const ready = runNode("scripts/create-tlcl-rag-evidence-attachment.mjs", [
  "--tlcl-packet",
  tlclPacketPath,
  "--rag-validation",
  readyRagValidationPath,
  "--out-dir",
  join(smokeRoot, "ready")
]);
const blocked = runNode("scripts/create-tlcl-rag-evidence-attachment.mjs", [
  "--tlcl-packet",
  tlclPacketPath,
  "--rag-validation",
  blockedRagValidationPath,
  "--out-dir",
  join(smokeRoot, "blocked")
]);
const unsafe = runNode("scripts/create-tlcl-rag-evidence-attachment.mjs", [
  "--tlcl-packet",
  tlclPacketPath,
  "--rag-validation",
  unsafeRagValidationPath,
  "--out-dir",
  join(smokeRoot, "unsafe")
]);
const readyPacket = readJson(ready.attachmentPath);

const checks = [
  check(
    "Reviewed RAG validation attaches to TLCL packet for high reasoning only",
    ready.status === "tlcl_rag_evidence_attached_waiting_for_high_reasoning_review" &&
      ready.approvedDisabledDraftCount === 1 &&
      ready.tlclStateModified === false &&
      ready.softwareActionsExecuted === false &&
      ready.memoryWritten === false &&
      ready.ruleEnabled === false &&
      ready.goalComplete === false,
    ready.attachmentPath
  ),
  check(
    "TLCL RAG attachment preserves evidence-only handoff and medium runtime block",
    readyPacket.highReasoningReviewHandoff?.mediumRuntimeContinuationAllowed === false &&
      readyPacket.locks?.ragDoesNotAuthorizeExecution === true &&
      readyPacket.locks?.tlclStateUnmodified === true &&
      readyPacket.blockedTransitions.includes("bypass_teacher_review_from_tlcl_rag_attachment"),
    ready.attachmentPath
  ),
  check(
    "Unreviewed or empty RAG validation is blocked before attachment use",
    blocked.status === "blocked_before_tlcl_rag_evidence_attachment" &&
      blocked.blockers.includes("rag_validation_not_ready_for_review_only_rule_dsl_validation") &&
      blocked.blockers.includes("rag_validation_has_no_teacher_reviewed_disabled_drafts") &&
      blocked.ruleEnabled === false,
    blocked.attachmentPath
  ),
  check(
    "Unsafe RAG rule enablement lock is fail-closed",
    unsafe.status === "blocked_before_tlcl_rag_evidence_attachment" &&
      unsafe.blockers.includes("rag_validation_rule_lock_missing") &&
      unsafe.memoryWritten === false &&
      unsafe.packagingUnlocked === false &&
      unsafe.goalComplete === false,
    unsafe.attachmentPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_rag_evidence_attachment_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  readyAttachmentPath: ready.attachmentPath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
