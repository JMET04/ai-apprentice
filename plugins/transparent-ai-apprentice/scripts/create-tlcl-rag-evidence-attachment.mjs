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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function slug(value) {
  return (
    String(value || "tlcl-rag-evidence-attachment")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-evidence-attachment"
  );
}

function locks() {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    attachmentOnly: true,
    tlclStateUnmodified: true,
    ragDoesNotAuthorizeExecution: true,
    ragDoesNotEnableRules: true,
    ragDoesNotWriteMemory: true,
    ragDoesNotUnlockPackaging: true,
    doesNotRunWorkflow: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotFetchExternalSources: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    memoryWritten: false,
    packagingGated: true,
    packagingUnlocked: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

const goal = argValue("--goal", "Attach reviewed RAG evidence to one TLCL packet for high-reasoning review.");
const tlclInput = readJsonInput(argValue("--tlcl-packet", argValue("--tlcl", "")), "--tlcl-packet");
const ragInput = readJsonInput(
  argValue("--rag-validation", argValue("--retrieval-review-validation", "")),
  "--rag-validation",
  "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1"
);
const outRoot = resolve(argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-evidence-attachments")));
const tlclPacket = tlclInput.value;
const ragValidation = ragInput.value;
const attachmentId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const attachmentDir = join(outRoot, attachmentId);
const attachmentPath = join(attachmentDir, "tlcl-rag-evidence-attachment.json");
const readmePath = join(attachmentDir, "TLCL_RAG_EVIDENCE_ATTACHMENT_START_HERE.md");

const blockers = [];
if (!String(tlclPacket.format || "").startsWith("transparent_ai_tlcl_")) {
  blockers.push("tlcl_packet_format_not_recognized");
}
if (ragValidation.status !== "ready_for_review_only_rule_dsl_validation") {
  blockers.push("rag_validation_not_ready_for_review_only_rule_dsl_validation");
}
if (ragValidation.locks?.reviewOnly !== true) blockers.push("rag_validation_review_only_lock_missing");
if (ragValidation.locks?.evidenceOnly !== true) blockers.push("rag_validation_evidence_only_lock_missing");
if (ragValidation.locks?.ruleEnabled !== false) blockers.push("rag_validation_rule_lock_missing");
if (ragValidation.locks?.memoryEnabled !== false) blockers.push("rag_validation_memory_lock_missing");
if (ragValidation.locks?.softwareActionsExecuted !== false) blockers.push("rag_validation_software_execution_lock_missing");
if (ragValidation.locks?.packagingUnlocked !== false) blockers.push("rag_validation_packaging_unlock_lock_missing");
if (!Array.isArray(ragValidation.approvedDisabledDrafts) || ragValidation.approvedDisabledDrafts.length === 0) {
  blockers.push("rag_validation_has_no_teacher_reviewed_disabled_drafts");
}
if (ragValidation.planningLogicEvidenceHash) {
  const actual = sha256Object(ragValidation.planningLogicEvidence || null);
  if (actual !== ragValidation.planningLogicEvidenceHash) blockers.push("rag_planning_logic_evidence_hash_mismatch");
}

const status =
  blockers.length === 0
    ? "tlcl_rag_evidence_attached_waiting_for_high_reasoning_review"
    : "blocked_before_tlcl_rag_evidence_attachment";
const approvedDraftRefs = (ragValidation.approvedDisabledDrafts || []).map((row) => ({
  sourceId: row.sourceId || "",
  retrievalPath: row.retrievalPath || "",
  rulePath: row.rulePath || "",
  ruleLifecycle: row.ruleLifecycle || "draft_disabled",
  logicExtractionHint: row.logicExtractionHint || "",
  logicFitDecision: row.logicFitDecision || "",
  evidenceRefs: row.evidenceRefs || [],
  reviewerNote: row.reviewerNote || ""
}));
const attachment = {
  ok: true,
  format: "transparent_ai_tlcl_rag_evidence_attachment_v1",
  attachmentId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  blockers,
  tlclPacketFormat: tlclPacket.format || "",
  tlclPacketStatus: tlclPacket.status || "",
  ragValidationStatus: ragValidation.status || "",
  approvedDisabledDraftCount: approvedDraftRefs.length,
  approvedDraftRefs,
  planningLogicEvidence: ragValidation.planningLogicEvidence || null,
  planningLogicEvidenceHash: ragValidation.planningLogicEvidenceHash || "",
  highReasoningReviewHandoff: {
    kind: "tlcl_rag_evidence_high_reasoning_review_handoff",
    nextRequiredReview:
      "Use highest-reasoning review to decide whether retrieved evidence changes the TLCL contract, validators, workflow fingerprint, or teacher questions.",
    allowedUse: [
      "cite reviewed retrieval chunks as evidence while drafting disabled rule or contract repairs",
      "compare logicExtractionHint against the current TLCL packet",
      "ask the teacher for missing evidence before changing reusable workflow boundaries"
    ],
    forbiddenUse: [
      "execute target software from retrieved knowledge",
      "enable rules from RAG evidence",
      "write long-term memory from RAG evidence",
      "unlock packaging from RAG evidence",
      "claim completion or technology acceptance"
    ],
    mediumRuntimeContinuationAllowed: false
  },
  sourceEvidence: {
    tlclPacketPath: tlclInput.path,
    tlclPacketHash: sha256Object(tlclPacket),
    ragValidationPath: ragInput.path,
    ragValidationHash: sha256Object(ragValidation)
  },
  blockedTransitions: [
    "execute_target_software_from_tlcl_rag_attachment",
    "enable_rule_from_tlcl_rag_attachment",
    "write_memory_from_tlcl_rag_attachment",
    "unlock_packaging_from_tlcl_rag_attachment",
    "claim_goal_complete_from_tlcl_rag_attachment",
    "bypass_teacher_review_from_tlcl_rag_attachment"
  ],
  paths: {
    attachment: attachmentPath,
    readme: readmePath,
    sourceTlclPacket: tlclInput.path,
    sourceRagValidation: ragInput.path
  },
  locks: locks()
};

writeJson(attachmentPath, attachment);
writeFileSync(
  readmePath,
  [
    "# TLCL RAG Evidence Attachment",
    "",
    `Status: ${status}`,
    `TLCL packet: ${tlclInput.path || "<inline>"}`,
    `RAG validation: ${ragInput.path || "<inline>"}`,
    "",
    "This attachment lets high-reasoning review inspect teacher-reviewed retrieval evidence next to a TLCL packet.",
    "It does not modify the TLCL packet, execute software, enable rules, write memory, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"])
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_rag_evidence_attachment_result_v1",
      attachmentId,
      status,
      blockers,
      attachmentPath,
      readmePath,
      approvedDisabledDraftCount: approvedDraftRefs.length,
      tlclStateModified: false,
      softwareActionsExecuted: false,
      memoryWritten: false,
      ruleEnabled: false,
      packagingUnlocked: false,
      goalComplete: false
    },
    null,
    2
  )
);
