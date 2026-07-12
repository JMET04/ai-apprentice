#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-delivery-gate-audit-trail-planning-logic-context");
mkdirSync(root, { recursive: true });

function runScript(scriptPath, args, expectOk = true) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (expectOk && result.status !== 0) {
    throw new Error(`${scriptPath} failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`${scriptPath} unexpectedly passed:\nSTDOUT:\n${result.stdout}`);
  }
  return result;
}

function runKnowledge(script, args, expectOk = true) {
  return runScript(join(pluginRoot, "scripts", "knowledge", script), args, expectOk);
}

const deliveryGateSmoke = runScript(
  join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-validation-report-delivery-gate-planning-logic-context.mjs"),
  []
);
const deliveryGateSmokeResult = JSON.parse(deliveryGateSmoke.stdout);
const deliveryGate = readJson(deliveryGateSmokeResult.gatePath);

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-primary-source-delivery-gate-audit-trail-planning-logic-context",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const auditRun = runKnowledge("create-rag-delivery-gate-audit-trail.mjs", [
  "--delivery-gate",
  deliveryGateSmokeResult.gatePath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "audit")
]);
const auditResult = JSON.parse(auditRun.stdout);
const audit = readJson(auditResult.auditPath);

if (!deliveryGate.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source delivery gate fixture should expose upstream planning logic hints.");
}
if (!audit.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source audit trail should preserve upstream planning logic hints.");
}
if (audit.planningLogicEvidence?.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source audit trail should preserve confirmed planning logic evidence reviews.");
}
if (!audit.planningLogicEvidenceHash || audit.planningLogicEvidenceHash !== deliveryGate.planningLogicEvidenceHash) {
  throw new Error("Primary-source audit trail should preserve the upstream planning logic evidence hash.");
}
if (!audit.evidenceChain.some((entry) => entry.step === "primary_source_planning_logic_evidence")) {
  throw new Error("Primary-source audit trail should add planning logic evidence to the evidence chain.");
}
if (audit.nextReview.planningLogicEvidenceHash !== audit.planningLogicEvidenceHash) {
  throw new Error("Primary-source audit trail should expose the planning logic evidence hash for next review.");
}
if (!audit.replay.forbiddenInterpretations.includes("packaging_unlock") || !audit.replay.forbiddenInterpretations.includes("software_execution")) {
  throw new Error("Primary-source audit trail must replay forbidden interpretations.");
}
if (
  audit.locks.ruleEnabled !== false ||
  audit.locks.memoryEnabled !== false ||
  audit.locks.softwareActionsExecuted !== false ||
  audit.locks.externalFetchPerformed !== false ||
  audit.locks.packagingUnlocked !== false ||
  audit.locks.deliveryGateOpen !== false
) {
  throw new Error("Primary-source audit trail planning logic flow must keep all no-action locks.");
}

const tampered = readJson(deliveryGateSmokeResult.gatePath);
tampered.planningLogicEvidence.logicExtractionHints = [];
const tamperedPath = join(root, "tampered-delivery-gate-planning-logic.json");
writeJson(tamperedPath, tampered);
const tamperedRun = runKnowledge(
  "create-rag-delivery-gate-audit-trail.mjs",
  ["--delivery-gate", tamperedPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "tampered-audit")],
  false
);
if (!`${tamperedRun.stdout}\n${tamperedRun.stderr}`.includes("RAG_DELIVERY_GATE_AUDIT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source audit trail must reject tampered planning logic evidence.");
}

const tamperedNextReview = readJson(deliveryGateSmokeResult.gatePath);
tamperedNextReview.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedNextReviewPath = join(root, "tampered-next-review-delivery-gate-planning-logic.json");
writeJson(tamperedNextReviewPath, tamperedNextReview);
const tamperedNextReviewRun = runKnowledge(
  "create-rag-delivery-gate-audit-trail.mjs",
  [
    "--delivery-gate",
    tamperedNextReviewPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "tampered-next-review-audit")
  ],
  false
);
if (
  !`${tamperedNextReviewRun.stdout}\n${tamperedNextReviewRun.stderr}`.includes(
    "RAG_DELIVERY_GATE_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source audit trail must reject tampered next-review planning logic evidence.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_delivery_gate_audit_trail_planning_logic_context_smoke_v1",
      deliveryGatePath: deliveryGateSmokeResult.gatePath,
      auditPath: auditResult.auditPath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      addedPlanningLogicEvidenceStep: true,
      rejectedTamperedPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidence: true,
      locks: audit.locks
    },
    null,
    2
  )
);
