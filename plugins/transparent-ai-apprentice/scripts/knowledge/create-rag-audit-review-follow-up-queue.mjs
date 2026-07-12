#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const validationPath = resolve(arg("--audit-review-validation", arg("--validation", "")));
const rollbackPoint = resolve(arg("--rollback-point", ""));
const outDir = resolve(arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-audit-review-follow-up-queue")));

if (!validationPath || !rollbackPoint) {
  throw new Error(
    "Usage: node create-rag-audit-review-follow-up-queue.mjs --audit-review-validation <rag-delivery-gate-audit-review-receipt-validation.json> --rollback-point <rollback-point-dir> [--out-dir <dir>]"
  );
}
if (!existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint}`);

const validation = readJson(validationPath);
if (validation.format !== "transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1") {
  throw new Error("Expected transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1.");
}
if (validation.status !== "ready_for_review_only_follow_up_queue") {
  throw new Error("RAG_FOLLOW_UP_QUEUE_REQUIRES_READY_AUDIT_REVIEW_VALIDATION");
}
if (
  validation.nextReview?.mayPrepareReviewOnlyFollowUpQueue !== true ||
  validation.nextReview?.mayAcceptTechnology !== false ||
  validation.nextReview?.mayEnableRules !== false ||
  validation.nextReview?.mayWriteMemory !== false ||
  validation.nextReview?.mayExecuteSoftware !== false ||
  validation.nextReview?.mayFetchExternalSources !== false ||
  validation.nextReview?.mayOpenDeliveryGate !== false ||
  validation.nextReview?.mayUnlockPackaging !== false ||
  validation.nextReview?.mayClaimGoalComplete !== false ||
  validation.locks?.reviewOnly !== true ||
  validation.locks?.accepted !== false ||
  validation.locks?.ruleEnabled !== false ||
  validation.locks?.memoryEnabled !== false ||
  validation.locks?.softwareActionsExecuted !== false ||
  validation.locks?.externalFetchPerformed !== false ||
  validation.locks?.packagingUnlocked !== false ||
  validation.locks?.deliveryGateOpen !== false
) {
  throw new Error("RAG_FOLLOW_UP_QUEUE_REQUIRES_LOCKED_AUDIT_REVIEW_VALIDATION");
}
if (!validation.auditTrailPath || !existsSync(validation.auditTrailPath)) {
  throw new Error("RAG_FOLLOW_UP_QUEUE_AUDIT_TRAIL_NOT_FOUND");
}

const auditTrail = readJson(validation.auditTrailPath);
if (auditTrail.format !== "transparent_ai_rag_delivery_gate_audit_trail_v1") {
  throw new Error("RAG_FOLLOW_UP_QUEUE_REQUIRES_AUDIT_TRAIL_PACKET");
}

const queueId = stableId("rag_audit_review_follow_up_queue", `${validationPath}:${rollbackPoint}`);
const queueDir = join(outDir, queueId);
mkdirSync(queueDir, { recursive: true });
const logicExtractionHints = Array.isArray(validation.nextReview?.logicExtractionHints)
  ? validation.nextReview.logicExtractionHints
  : [];
const planningLogicEvidence = validation.planningLogicEvidence || null;
const planningLogicEvidenceHash = validation.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = validation.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = validation.nextReview?.planningLogicEvidenceHash || "";
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("RAG_FOLLOW_UP_QUEUE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("RAG_FOLLOW_UP_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  throw new Error("RAG_FOLLOW_UP_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}

const queueItems = [
  {
    order: 1,
    itemId: "review_audit_evidence_chain",
    kind: "manual_review",
    label: "Review the hashed audit evidence chain before choosing any next step.",
    sourcePath: validation.auditTrailPath,
    sourceHash: hashText(JSON.stringify(auditTrail)),
    action: "Open the audit trail and verify the evidence chain remains complete and review-only.",
    commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-delivery-gate-audit-review-receipt-builder.mjs --audit-trail "${validation.auditTrailPath}"`,
    status: "ready_for_manual_review",
    allowedNextDecisions: ["needs_teacher_review", "request_more_evidence", "prepare_rule_rewrite_review", "blocked"],
    blockedActions: ["execute_command", "enable_rule", "write_memory", "open_delivery_gate", "unlock_packaging", "claim_goal_complete"]
  },
  {
    order: 2,
    itemId: "review_forbidden_interpretations",
    kind: "manual_safety_review",
    label: "Confirm delivery_allowed still means visibility-only evidence.",
    sourcePath: validation.auditTrailPath,
    sourceHash: hashText(JSON.stringify(auditTrail.replay || {})),
    action: "Check that forbidden interpretations still include acceptance, execution, memory write, packaging unlock, and goal completion.",
    commandTemplate: "",
    status: "ready_for_manual_review",
    allowedNextDecisions: ["needs_teacher_review", "request_safety_note", "blocked"],
    blockedActions: ["accept_technology", "execute_software", "write_memory", "unlock_packaging", "claim_goal_complete"]
  },
  ...(logicExtractionHints.length
    ? [
        {
          order: 3,
          itemId: "review_primary_source_logic_evidence",
          kind: "logic_evidence_review",
          label: "Review the teacher-confirmed primary-source data-to-output logic evidence.",
          sourcePath: validation.auditTrailPath,
          sourceHash: hashText(JSON.stringify(logicExtractionHints)),
          action:
            "Check that each logic hint and logic-fit decision still matches the teacher-reviewed audit evidence before selecting any next RAG lane.",
          commandTemplate: "",
          status: "ready_for_manual_review",
          logicExtractionHints,
          allowedNextDecisions: ["logic_evidence_confirmed", "request_logic_recheck", "request_more_primary_sources", "blocked"],
          blockedActions: [
            "enable_rule",
            "write_memory",
            "execute_software",
            "fetch_external_source_without_review",
            "unlock_packaging",
            "claim_goal_complete"
          ]
        }
      ]
    : []),
  {
    order: logicExtractionHints.length ? 4 : 3,
    itemId: "confirm_rollback_retained",
    kind: "rollback_review",
    label: "Confirm rollback point remains retained before any further planning.",
    sourcePath: rollbackPoint,
    sourceHash: hashText(rollbackPoint),
    action: "Keep this rollback point until the teacher confirms the direction is correct.",
    commandTemplate: "",
    status: "ready_for_manual_review",
    allowedNextDecisions: ["rollback_retained", "needs_new_rollback", "blocked"],
    blockedActions: ["delete_rollback_without_teacher_confirmation", "package_release", "claim_goal_complete"]
  },
  {
    order: logicExtractionHints.length ? 5 : 4,
    itemId: "choose_next_review_only_rag_step",
    kind: "next_step_planning",
    label: "Choose the next review-only RAG follow-up lane.",
    sourcePath: validationPath,
    sourceHash: hashText(JSON.stringify(validation)),
    action:
      "Pick one safe follow-up lane: request more primary-source evidence, rewrite disabled Rule Cards, add validator coverage, or prepare another teacher review receipt.",
    commandTemplate: "",
    status: "waiting_for_teacher_selection",
    allowedNextDecisions: [
      "request_more_primary_sources",
      "prepare_disabled_rule_rewrite_review",
      "add_validator_coverage_review",
      "prepare_next_teacher_receipt",
      "blocked"
    ],
    blockedActions: ["enable_rule", "write_memory", "execute_software", "fetch_external_source_without_review", "unlock_packaging"]
  }
];

const queue = {
  format: "transparent_ai_rag_audit_review_follow_up_queue_v1",
  queueId,
  createdAt: new Date().toISOString(),
  validationPath,
  validationHash: hashText(JSON.stringify(validation)),
  auditTrailPath: validation.auditTrailPath,
  rollbackPoint,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  status: "waiting_for_teacher_reviewed_follow_up_selection",
  queueDecision: "manual_review_only_follow_up_queue_ready",
  queueItems,
  counts: {
    queueItems: queueItems.length,
    readyManualReviewItems: queueItems.filter((item) => item.status === "ready_for_manual_review").length,
    waitingTeacherSelectionItems: queueItems.filter((item) => item.status === "waiting_for_teacher_selection").length,
    primarySourceLogicHintItems: logicExtractionHints.length,
    planningLogicEvidencePresent: Boolean(planningLogicEvidenceHash),
    executableItems: 0
  },
  logicExtractionHints,
  nextReview: {
    instruction:
      "Review this follow-up queue as a manual selection surface only; upstream planning logic evidence remains evidence for teacher review, not acceptance or execution permission.",
    planningLogicEvidence,
    planningLogicEvidenceHash,
    mayAcceptTechnology: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteSoftware: false,
    mayFetchExternalSources: false,
    mayOpenDeliveryGate: false,
    mayUnlockPackaging: false,
    mayClaimGoalComplete: false
  },
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    deliveryGateOpen: false,
    queueDoesNotRunCommands: true,
    queueDoesNotOpenFiles: true,
    queueDoesNotFetchSources: true,
    queueDoesNotWriteMemory: true,
    queueDoesNotClaimCompletion: true
  }
};

const queuePath = join(queueDir, "rag-audit-review-follow-up-queue.json");
const readmePath = join(queueDir, "RAG_AUDIT_REVIEW_FOLLOW_UP_QUEUE_START_HERE.md");
writeJson(queuePath, queue);
writeFileSync(
  readmePath,
  [
    "# RAG Audit Review Follow-Up Queue",
    "",
    `Status: ${queue.status}`,
    `Decision: ${queue.queueDecision}`,
    `Queue items: ${queue.counts.queueItems}`,
    "",
    "This queue only organizes manual follow-up after a teacher-reviewed RAG audit trail.",
    "",
    "Safety boundary:",
    "- It does not run commands.",
    "- It does not open files.",
    "- It does not fetch external sources.",
    "- It does not enable rules, write memory, execute software, open the delivery gate, unlock packaging, accept the technology, or claim goal completion.",
    "",
    "Items:",
    ...queueItems.map(
      (item) => `${item.order}. ${item.itemId}: ${item.status}; ${item.action} Command template: ${item.commandTemplate || "none"}`
    )
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: queue.format,
      status: queue.status,
      queuePath,
      readmePath,
      queueItems: queueItems.length,
      queueDecision: queue.queueDecision,
      locks: queue.locks
    },
    null,
    2
  )
);
