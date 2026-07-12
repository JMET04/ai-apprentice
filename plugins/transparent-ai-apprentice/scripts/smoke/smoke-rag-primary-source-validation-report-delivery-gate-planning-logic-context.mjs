#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-validation-report-delivery-gate-planning-logic-context");
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

const validationReportSmoke = runScript(
  join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-disabled-package-validation-report-planning-logic-context.mjs"),
  []
);
const validationReportSmokeResult = JSON.parse(validationReportSmoke.stdout);
const validationReportPacket = readJson(validationReportSmokeResult.packetPath);

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-primary-source-validation-report-delivery-gate-planning-logic-context",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const gateRun = runKnowledge("create-rag-validation-report-delivery-gate.mjs", [
  "--validation-report-packet",
  validationReportSmokeResult.packetPath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "gate")
]);
const gateResult = JSON.parse(gateRun.stdout);
const gate = readJson(gateResult.gatePath);

if (!validationReportPacket.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source Validation Report packet fixture should expose upstream planning logic hints.");
}
if (!gate.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source delivery gate should preserve upstream planning logic hints.");
}
if (gate.planningLogicEvidence?.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source delivery gate should preserve confirmed planning logic evidence reviews.");
}
if (!gate.planningLogicEvidenceHash || gate.planningLogicEvidenceHash !== validationReportPacket.planningLogicEvidenceHash) {
  throw new Error("Primary-source delivery gate should preserve the upstream planning logic evidence hash.");
}
if (gate.nextReview.planningLogicEvidenceHash !== gate.planningLogicEvidenceHash) {
  throw new Error("Primary-source delivery gate should expose the planning logic evidence hash for next review.");
}
if (gate.summary.reportDeliveryAllowed !== true || gate.summary.gateAllowsPackaging !== false || gate.summary.gateAllowsExecution !== false) {
  throw new Error("Primary-source delivery gate must not turn delivery_allowed into packaging or execution permission.");
}
if (
  gate.locks.ruleEnabled !== false ||
  gate.locks.memoryEnabled !== false ||
  gate.locks.softwareActionsExecuted !== false ||
  gate.locks.externalFetchPerformed !== false ||
  gate.locks.packagingUnlocked !== false ||
  gate.locks.deliveryGateOpen !== false
) {
  throw new Error("Primary-source delivery gate planning logic flow must keep rule, memory, execution, fetch, packaging, and gate locks.");
}

const tampered = readJson(validationReportSmokeResult.packetPath);
tampered.planningLogicEvidence.logicExtractionHints = [];
const tamperedPath = join(root, "tampered-validation-report-planning-logic-packet.json");
writeJson(tamperedPath, tampered);
const tamperedRun = runKnowledge(
  "create-rag-validation-report-delivery-gate.mjs",
  ["--validation-report-packet", tamperedPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "tampered-gate")],
  false
);
if (!`${tamperedRun.stdout}\n${tamperedRun.stderr}`.includes("RAG_DELIVERY_GATE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source delivery gate must reject tampered planning logic evidence.");
}

const tamperedNextReview = readJson(validationReportSmokeResult.packetPath);
tamperedNextReview.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedNextReviewPath = join(root, "tampered-next-review-validation-report-planning-logic-packet.json");
writeJson(tamperedNextReviewPath, tamperedNextReview);
const tamperedNextReviewRun = runKnowledge(
  "create-rag-validation-report-delivery-gate.mjs",
  [
    "--validation-report-packet",
    tamperedNextReviewPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "tampered-next-review-gate")
  ],
  false
);
if (
  !`${tamperedNextReviewRun.stdout}\n${tamperedNextReviewRun.stderr}`.includes(
    "RAG_DELIVERY_GATE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source delivery gate must reject tampered next-review planning logic evidence.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_validation_report_delivery_gate_planning_logic_context_smoke_v1",
      validationReportPacketPath: validationReportSmokeResult.packetPath,
      gatePath: gateResult.gatePath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      rejectedTamperedPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidence: true,
      gateAllowsPackaging: gate.summary.gateAllowsPackaging,
      gateAllowsExecution: gate.summary.gateAllowsExecution,
      locks: gate.locks
    },
    null,
    2
  )
);
