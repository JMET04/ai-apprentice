#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-delivery-gate-audit-trail");
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

const deliveryGateSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-validation-report-delivery-gate.mjs"), []);
const deliveryGateSmokeResult = JSON.parse(deliveryGateSmoke.stdout);
const deliveryGatePath = deliveryGateSmokeResult.gatePath;

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-primary-source-delivery-gate-audit-trail",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const auditRun = runKnowledge("create-rag-delivery-gate-audit-trail.mjs", [
  "--delivery-gate",
  deliveryGatePath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "audit")
]);
const auditResult = JSON.parse(auditRun.stdout);
const audit = readJson(auditResult.auditPath);

if (audit.format !== "transparent_ai_rag_delivery_gate_audit_trail_v1") {
  throw new Error("Primary-source audit trail should use the existing audit trail format.");
}
if (audit.status !== "audit_trail_ready_for_teacher_review") {
  throw new Error("Primary-source audit trail must remain teacher-review-only.");
}
if (!audit.disabledRuleLogicRows[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source audit trail should preserve the logic extraction hint.");
}
if (audit.disabledRuleLogicRows[0].logicFitDecision !== "matches_intended_logic") {
  throw new Error("Primary-source audit trail should preserve the logic-fit decision.");
}
if (!audit.evidenceChain.some((entry) => entry.step === "primary_source_logic_evidence")) {
  throw new Error("Primary-source audit trail should add logic evidence to the evidence chain.");
}
if (!audit.nextReview.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source audit trail should expose logic hints for next review.");
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
  throw new Error("Primary-source audit trail must keep all no-action locks.");
}

const tampered = readJson(deliveryGatePath);
tampered.nextReview.logicExtractionHints[0].logicExtractionHint = "tampered different logic";
const tamperedPath = join(root, "tampered-delivery-gate.json");
writeJson(tamperedPath, tampered);
const tamperedRun = runKnowledge(
  "create-rag-delivery-gate-audit-trail.mjs",
  ["--delivery-gate", tamperedPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "tampered-audit")],
  false
);
if (!tamperedRun.stderr.includes("RAG_DELIVERY_GATE_AUDIT_LOGIC_EXTRACTION_HINT_MISMATCH")) {
  throw new Error("Primary-source audit trail must reject tampered logic hints.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_delivery_gate_audit_trail_smoke_v1",
      deliveryGatePath,
      auditPath: auditResult.auditPath,
      preservedLogicExtractionHint: true,
      preservedLogicFitDecision: true,
      addedLogicEvidenceStep: true,
      rejectedTamperedLogicHint: true,
      locks: audit.locks
    },
    null,
    2
  )
);
