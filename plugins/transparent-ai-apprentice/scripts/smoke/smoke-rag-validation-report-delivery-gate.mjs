#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-validation-report-delivery-gate");
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

const validationReportSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-disabled-package-validation-report.mjs"), []);
const validationReportSmokeResult = JSON.parse(validationReportSmoke.stdout);
const validationReportPacketPath = validationReportSmokeResult.packetPath;

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-validation-report-delivery-gate",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const gateRun = runKnowledge("create-rag-validation-report-delivery-gate.mjs", [
  "--validation-report-packet",
  validationReportPacketPath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "gate")
]);
const gateResult = JSON.parse(gateRun.stdout);
const gate = readJson(gateResult.gatePath);

if (gate.format !== "transparent_ai_rag_validation_report_delivery_gate_v1") {
  throw new Error("RAG validation report delivery gate should use the expected format.");
}
if (gate.status !== "review_only_delivery_gate_closed") {
  throw new Error("RAG validation report delivery gate must remain closed and review-only.");
}
if (gate.summary.reportDeliveryAllowed !== true || gate.summary.gateAllowsPackaging !== false || gate.summary.gateAllowsExecution !== false) {
  throw new Error("RAG validation report delivery gate must not turn delivery_allowed into packaging or execution permission.");
}
if (
  !gate.blockedTransitions.includes("validation_report_delivery_allowed_to_packaging_unlock") ||
  !gate.blockedTransitions.includes("validation_report_delivery_allowed_to_software_execution")
) {
  throw new Error("RAG validation report delivery gate must list blocked transitions from delivery_allowed.");
}
if (
  gate.locks.ruleEnabled !== false ||
  gate.locks.memoryEnabled !== false ||
  gate.locks.softwareActionsExecuted !== false ||
  gate.locks.externalFetchPerformed !== false ||
  gate.locks.packagingUnlocked !== false ||
  gate.locks.deliveryGateOpen !== false
) {
  throw new Error("RAG validation report delivery gate must keep rule, memory, execution, fetch, packaging, and gate locks.");
}

const noTeacherRun = runKnowledge(
  "create-rag-validation-report-delivery-gate.mjs",
  ["--validation-report-packet", validationReportPacketPath, "--rollback-point", rollbackPoint, "--out-dir", join(root, "no-teacher-gate")],
  false
);
if (!noTeacherRun.stderr.includes("RAG_DELIVERY_GATE_REQUIRES_TEACHER_REVIEWED_FLAG")) {
  throw new Error("RAG validation report delivery gate must reject missing teacher-reviewed flag.");
}

const unlockedPacket = readJson(validationReportPacketPath);
unlockedPacket.locks.packagingUnlocked = true;
const unlockedPacketPath = join(root, "forbidden-unlocked-validation-packet.json");
writeJson(unlockedPacketPath, unlockedPacket);
const unlockedRun = runKnowledge(
  "create-rag-validation-report-delivery-gate.mjs",
  ["--validation-report-packet", unlockedPacketPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "unlocked-gate")],
  false
);
if (!unlockedRun.stderr.includes("RAG_DELIVERY_GATE_REQUIRES_LOCKED_VALIDATION_PACKET")) {
  throw new Error("RAG validation report delivery gate must reject an unlocked validation packet.");
}

const failingPacket = readJson(validationReportPacketPath);
const failingReport = readJson(failingPacket.validationReportPath);
failingReport.delivery_allowed = false;
failingReport.status = "fail";
const failingReportPath = join(root, "forbidden-failing-validation-report.json");
writeJson(failingReportPath, failingReport);
failingPacket.validationReportPath = failingReportPath;
const failingPacketPath = join(root, "forbidden-failing-validation-packet.json");
writeJson(failingPacketPath, failingPacket);
const failingRun = runKnowledge(
  "create-rag-validation-report-delivery-gate.mjs",
  ["--validation-report-packet", failingPacketPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "failing-gate")],
  false
);
if (!failingRun.stderr.includes("RAG_DELIVERY_GATE_REJECTS_NON_ALLOWED_OR_NON_SKIPPED_REPORT")) {
  throw new Error("RAG validation report delivery gate must reject non-allowed reports.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_validation_report_delivery_gate_smoke_v1",
      gatePath: gateResult.gatePath,
      reportDeliveryAllowed: gate.summary.reportDeliveryAllowed,
      gateAllowsPackaging: gate.summary.gateAllowsPackaging,
      gateAllowsExecution: gate.summary.gateAllowsExecution,
      rejectedMissingTeacherReviewedFlag: true,
      rejectedUnlockedValidationPacket: true,
      rejectedNonAllowedReport: true,
      locks: gate.locks
    },
    null,
    2
  )
);
