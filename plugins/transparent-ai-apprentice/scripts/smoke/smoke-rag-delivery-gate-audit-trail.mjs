#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-delivery-gate-audit-trail");
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

const deliveryGateSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-validation-report-delivery-gate.mjs"), []);
const deliveryGateSmokeResult = JSON.parse(deliveryGateSmoke.stdout);
const deliveryGatePath = deliveryGateSmokeResult.gatePath;

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-delivery-gate-audit-trail",
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
  throw new Error("RAG delivery gate audit trail should use the expected format.");
}
if (audit.status !== "audit_trail_ready_for_teacher_review") {
  throw new Error("RAG delivery gate audit trail must remain teacher-review-only.");
}
if (!Array.isArray(audit.evidenceChain) || audit.evidenceChain.length !== 4) {
  throw new Error("RAG delivery gate audit trail must include the expected evidence chain.");
}
if (
  !audit.evidenceChain.some((entry) => entry.step === "rag_disabled_validation_report_packet") ||
  !audit.evidenceChain.some((entry) => entry.step === "closed_delivery_gate")
) {
  throw new Error("RAG delivery gate audit trail must cite validation packet and closed gate evidence.");
}
if (!audit.replay.forbiddenInterpretations.includes("packaging_unlock") || !audit.replay.forbiddenInterpretations.includes("software_execution")) {
  throw new Error("RAG delivery gate audit trail must replay forbidden interpretations.");
}
if (
  audit.locks.ruleEnabled !== false ||
  audit.locks.memoryEnabled !== false ||
  audit.locks.softwareActionsExecuted !== false ||
  audit.locks.externalFetchPerformed !== false ||
  audit.locks.packagingUnlocked !== false ||
  audit.locks.deliveryGateOpen !== false
) {
  throw new Error("RAG delivery gate audit trail must keep all no-action locks.");
}

const noTeacherRun = runKnowledge(
  "create-rag-delivery-gate-audit-trail.mjs",
  ["--delivery-gate", deliveryGatePath, "--rollback-point", rollbackPoint, "--out-dir", join(root, "no-teacher-audit")],
  false
);
if (!noTeacherRun.stderr.includes("RAG_DELIVERY_GATE_AUDIT_REQUIRES_TEACHER_REVIEWED_FLAG")) {
  throw new Error("RAG delivery gate audit trail must reject missing teacher-reviewed flag.");
}

const openedGate = readJson(deliveryGatePath);
openedGate.locks.deliveryGateOpen = true;
const openedGatePath = join(root, "forbidden-open-delivery-gate.json");
writeJson(openedGatePath, openedGate);
const openedRun = runKnowledge(
  "create-rag-delivery-gate-audit-trail.mjs",
  ["--delivery-gate", openedGatePath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "opened-audit")],
  false
);
if (!openedRun.stderr.includes("RAG_DELIVERY_GATE_AUDIT_REQUIRES_CLOSED_LOCKED_GATE")) {
  throw new Error("RAG delivery gate audit trail must reject an opened delivery gate.");
}

const unlockedGate = readJson(deliveryGatePath);
unlockedGate.locks.packagingUnlocked = true;
const unlockedGatePath = join(root, "forbidden-unlocked-delivery-gate.json");
writeJson(unlockedGatePath, unlockedGate);
const unlockedRun = runKnowledge(
  "create-rag-delivery-gate-audit-trail.mjs",
  ["--delivery-gate", unlockedGatePath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "unlocked-audit")],
  false
);
if (!unlockedRun.stderr.includes("RAG_DELIVERY_GATE_AUDIT_REQUIRES_CLOSED_LOCKED_GATE")) {
  throw new Error("RAG delivery gate audit trail must reject a packaging-unlocked gate.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_delivery_gate_audit_trail_smoke_v1",
      auditPath: auditResult.auditPath,
      evidenceSteps: audit.evidenceChain.map((entry) => entry.step),
      rejectedMissingTeacherReviewedFlag: true,
      rejectedOpenedDeliveryGate: true,
      rejectedPackagingUnlockedGate: true,
      locks: audit.locks
    },
    null,
    2
  )
);
