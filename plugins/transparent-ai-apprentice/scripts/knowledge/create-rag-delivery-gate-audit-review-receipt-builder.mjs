#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function writeReviewWorkbenchHtml(path, packet, receipt) {
  const evidenceRows = receipt.evidenceChainReviews
    .map(
      (entry) => `<tr>
        <td>${htmlEscape(entry.step)}</td>
        <td>${entry.path ? `<a href="${htmlEscape(fileHref(entry.path))}">${htmlEscape(basename(entry.path))}</a>` : ""}</td>
        <td>${htmlEscape(entry.status || "")}</td>
        <td>${htmlEscape(entry.decision)}</td>
        <td>${entry.evidenceReviewed ? "true" : "false"}</td>
        <td>${entry.hashReviewed ? "true" : "false"}</td>
      </tr>`
    )
    .join("\n");
  const logicRows = receipt.logicEvidenceReviews
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.sourceId)}</td>
        <td>${htmlEscape(row.ruleId)}</td>
        <td>${htmlEscape(row.logicFitDecision)}</td>
        <td>${htmlEscape(row.decision)}</td>
        <td>${row.logicEvidenceReviewed ? "true" : "false"}</td>
        <td>${row.logicFitReviewed ? "true" : "false"}</td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RAG Delivery Gate Audit Review Workbench</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 26px 0 10px; font-size: 18px; letter-spacing: 0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    a { color: #174d89; word-break: break-all; }
    code { background: #eef3f9; padding: 2px 4px; border-radius: 4px; }
    .lock { color: #4d5b70; font-size: 13px; line-height: 1.5; }
    .status { display: inline-block; margin: 8px 0 14px; padding: 5px 8px; border: 1px solid #d9e1ec; background: #fff; border-radius: 6px; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>RAG Delivery Gate Audit Review Workbench</h1>
    <p class="status">Decision: ${htmlEscape(receipt.decision)}</p>
    <p class="lock">This workbench is a teacher-review surface only. It does not accept the technology, enable rules, write memory, execute software, fetch external sources, open the delivery gate, unlock packaging, or claim goal completion.</p>
    <h2>Start Here</h2>
    <p>Review the audit trail, evidence rows, disabled rule logic rows, blocked transitions, forbidden interpretations, no-action locks, and retained rollback point. Then fill the receipt template and run the validation command.</p>
    <p><strong>Audit trail:</strong> <a href="${htmlEscape(fileHref(packet.auditTrailPath))}">${htmlEscape(packet.auditTrailPath)}</a></p>
    <p><strong>Receipt template:</strong> <a href="${htmlEscape(fileHref(packet.receiptTemplatePath))}">${htmlEscape(packet.receiptTemplatePath)}</a></p>
    <p><strong>Validation command:</strong> <code>${htmlEscape(packet.validationCommand)}</code></p>
    <h2>Evidence Chain Reviews</h2>
    <table>
      <thead><tr><th>Step</th><th>Evidence</th><th>Status</th><th>Decision</th><th>Evidence reviewed</th><th>Hash reviewed</th></tr></thead>
      <tbody>${evidenceRows}</tbody>
    </table>
    <h2>Disabled Logic Evidence Reviews</h2>
    <table>
      <thead><tr><th>Source</th><th>Rule</th><th>Fit</th><th>Decision</th><th>Logic reviewed</th><th>Fit reviewed</th></tr></thead>
      <tbody>${logicRows}</tbody>
    </table>
    <h2>Locks</h2>
    <p class="lock">reviewOnly=${receipt.locks.reviewOnly}; evidenceOnly=${receipt.locks.evidenceOnly}; accepted=${receipt.locks.accepted}; ruleEnabled=${receipt.locks.ruleEnabled}; memoryEnabled=${receipt.locks.memoryEnabled}; softwareActionsExecuted=${receipt.locks.softwareActionsExecuted}; packagingGated=${receipt.locks.packagingGated}; packagingUnlocked=${receipt.locks.packagingUnlocked}; deliveryGateOpen=${receipt.locks.deliveryGateOpen}</p>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const auditTrailPath = resolve(arg("--audit-trail", ""));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-delivery-gate-audit-review-receipt-builder"))
);

if (!auditTrailPath) {
  throw new Error(
    "Usage: node create-rag-delivery-gate-audit-review-receipt-builder.mjs --audit-trail <rag-delivery-gate-audit-trail.json> [--out-dir <dir>]"
  );
}

const audit = readJson(auditTrailPath);
if (audit.format !== "transparent_ai_rag_delivery_gate_audit_trail_v1") {
  throw new Error("Expected transparent_ai_rag_delivery_gate_audit_trail_v1.");
}
if (
  audit.status !== "audit_trail_ready_for_teacher_review" ||
  audit.locks?.reviewOnly !== true ||
  audit.locks?.evidenceOnly !== true ||
  audit.locks?.accepted !== false ||
  audit.locks?.ruleEnabled !== false ||
  audit.locks?.memoryEnabled !== false ||
  audit.locks?.softwareActionsExecuted !== false ||
  audit.locks?.externalFetchPerformed !== false ||
  audit.locks?.packagingUnlocked !== false ||
  audit.locks?.deliveryGateOpen !== false
) {
  throw new Error("Audit trail is not a locked review-only packet.");
}

const auditHash = hashText(JSON.stringify(audit));
const planningLogicEvidence = audit.planningLogicEvidence || null;
const planningLogicEvidenceHash = audit.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = audit.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = audit.nextReview?.planningLogicEvidenceHash || "";

if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("RAG_AUDIT_REVIEW_BUILDER_AUDIT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("RAG_AUDIT_REVIEW_BUILDER_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash) {
  throw new Error("RAG_AUDIT_REVIEW_BUILDER_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}

const builderId = stableId("rag_delivery_gate_audit_review_receipt_builder", auditTrailPath);
const builderDir = join(outDir, builderId);
mkdirSync(builderDir, { recursive: true });

const receiptTemplate = {
  format: "transparent_ai_rag_delivery_gate_audit_review_receipt_v1",
  auditId: audit.auditId,
  auditTrailPath,
  auditHash,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  decision: "needs_teacher_review",
  allowedTopLevelDecisions: ["needs_teacher_review", "teacher_reviewed_audit_trail_for_follow_up", "blocked"],
  forbiddenDecisions: [
    "accepted",
    "accept_technology",
    "enable_rule",
    "activate_rule",
    "write_memory",
    "execute_software",
    "fetch_external_source",
    "open_delivery_gate",
    "unlock_packaging",
    "claim_goal_complete"
  ],
  evidenceChainReviews: (audit.evidenceChain || []).map((entry) => ({
    step: entry.step,
    path: entry.path,
    hash: entry.hash,
    status: entry.status || null,
    decision: "needs_teacher_review",
    allowedDecisions: ["needs_teacher_review", "reviewed_evidence_chain_step", "blocked"],
    evidenceReviewed: false,
    hashReviewed: false,
    reviewerNote: ""
  })),
  logicEvidenceReviews: (audit.disabledRuleLogicRows || []).map((row) => ({
    sourceId: row.sourceId,
    ruleId: row.ruleId,
    logicExtractionHint: row.logicExtractionHint,
    logicFitDecision: row.logicFitDecision,
    decision: "needs_teacher_review",
    allowedDecisions: ["needs_teacher_review", "reviewed_logic_evidence", "request_logic_recheck", "blocked"],
    logicEvidenceReviewed: false,
    logicFitReviewed: false,
    reviewerNote: ""
  })),
  blockedTransitionsReviewed: false,
  forbiddenInterpretationsReviewed: false,
  noActionLocksReviewed: false,
  rollbackPointRetained: false,
  reviewerNote: "",
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
    deliveryGateOpen: false
  }
};

const builderPacket = {
  format: "transparent_ai_rag_delivery_gate_audit_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  auditTrailPath,
  auditHash,
  receiptTemplatePath: join(builderDir, "rag-delivery-gate-audit-review-receipt-template.json"),
  reviewWorkbenchHtmlPath: join(builderDir, "rag-delivery-gate-audit-review-workbench.html"),
  validationCommand: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\validate-rag-delivery-gate-audit-review-receipt.mjs --audit-trail "${auditTrailPath}" --receipt <teacher-filled-receipt.json>`,
  locks: receiptTemplate.locks
};

writeJson(builderPacket.receiptTemplatePath, receiptTemplate);
writeReviewWorkbenchHtml(builderPacket.reviewWorkbenchHtmlPath, builderPacket, receiptTemplate);
writeJson(join(builderDir, "rag-delivery-gate-audit-review-receipt-builder.json"), builderPacket);

const readmePath = join(builderDir, "RAG_DELIVERY_GATE_AUDIT_REVIEW_START_HERE.md");
writeFileSync(
  readmePath,
  [
    "# RAG Delivery Gate Audit Review",
    "",
    "Fill this receipt after reviewing the audit evidence chain, blocked transitions, forbidden interpretations, no-action locks, and retained rollback point.",
    "",
    `- Audit trail: ${auditTrailPath}`,
    `- Review workbench: ${builderPacket.reviewWorkbenchHtmlPath}`,
    `- Receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "Allowed decisions can only keep review open, mark the audit trail ready for a separate review-only follow-up queue, or block. They cannot accept the technology, enable rules, write memory, execute software, fetch external sources, open the delivery gate, unlock packaging, or claim goal completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: builderPacket.format,
      builderPath: join(builderDir, "rag-delivery-gate-audit-review-receipt-builder.json"),
      reviewWorkbenchHtmlPath: builderPacket.reviewWorkbenchHtmlPath,
      templatePath: builderPacket.receiptTemplatePath,
      readmePath,
      evidenceReviewRows: receiptTemplate.evidenceChainReviews.length,
      locks: builderPacket.locks
    },
    null,
    2
  )
);
