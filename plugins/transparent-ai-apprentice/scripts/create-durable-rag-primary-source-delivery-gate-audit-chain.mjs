#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "./knowledge/knowledge-core.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function runNode(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) {
    throw new Error(`${scriptPath} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function runKnowledge(scriptName, args = []) {
  return runNode(join(pluginRoot, "scripts", "knowledge", scriptName), args);
}

function requireExists(label, path) {
  if (!path || !existsSync(path)) throw new Error(`${label}_NOT_FOUND: ${path || "<empty>"}`);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

const goal = argValue("--goal", "Create durable primary-source RAG delivery-gate audit evidence.");
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "durable-rag-primary-source-delivery-gate-audit-chain")
  )
);
const rollbackPoint = resolve(
  argValue("--rollback-point", join(process.cwd(), ".transparent-apprentice", "rollback-points", "missing-rollback-point"))
);
mkdirSync(outputRoot, { recursive: true });
requireExists("ROLLBACK_POINT", rollbackPoint);

const reviewSmoke = runNode(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-rule-dsl-review-receipt.mjs"));
const reviewValidationPath = reviewSmoke.validationPath;
requireExists("REVIEW_VALIDATION", reviewValidationPath);

const disabledPackage = runKnowledge("create-rag-reviewed-disabled-rule-package.mjs", [
  "--review-validation",
  reviewValidationPath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(outputRoot, "disabled-rule-package")
]);
requireExists("DISABLED_RULE_PACKAGE", disabledPackage.packagePath);

const validationReport = runKnowledge("create-rag-disabled-package-validation-report.mjs", [
  "--disabled-rule-package",
  disabledPackage.packagePath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(outputRoot, "validation-report")
]);
requireExists("VALIDATION_REPORT_PACKET", validationReport.packetPath);

const deliveryGate = runKnowledge("create-rag-validation-report-delivery-gate.mjs", [
  "--validation-report-packet",
  validationReport.packetPath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(outputRoot, "delivery-gate")
]);
requireExists("DELIVERY_GATE", deliveryGate.gatePath);

const audit = runKnowledge("create-rag-delivery-gate-audit-trail.mjs", [
  "--delivery-gate",
  deliveryGate.gatePath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(outputRoot, "audit-trail")
]);
requireExists("AUDIT_TRAIL", audit.auditPath);

const auditJson = readJson(audit.auditPath);
const deliveryGateJson = readJson(deliveryGate.gatePath);
const validationPacketJson = readJson(validationReport.packetPath);
const disabledPackageJson = readJson(disabledPackage.packagePath);

const checks = [
  {
    name: "Durable audit uses formal RAG delivery-gate audit format",
    pass: auditJson.format === "transparent_ai_rag_delivery_gate_audit_trail_v1",
    evidence: audit.auditPath
  },
  {
    name: "Durable delivery gate stays closed and review-only",
    pass:
      deliveryGateJson.format === "transparent_ai_rag_validation_report_delivery_gate_v1" &&
      deliveryGateJson.status === "review_only_delivery_gate_closed" &&
      deliveryGateJson.locks?.deliveryGateOpen === false &&
      deliveryGateJson.locks?.packagingUnlocked === false &&
      deliveryGateJson.locks?.softwareActionsExecuted === false,
    evidence: deliveryGate.gatePath
  },
  {
    name: "Durable validation packet preserves primary-source logic hints",
    pass:
      validationPacketJson.format === "transparent_ai_rag_disabled_package_validation_report_v1" &&
      validationPacketJson.summary?.primarySourceLogicHintCount >= 1 &&
      validationPacketJson.disabledRuleLogicRows?.[0]?.logicFitDecision === "matches_intended_logic",
    evidence: validationReport.packetPath
  },
  {
    name: "Durable disabled package remains draft-disabled",
    pass:
      disabledPackageJson.format === "transparent_ai_rag_reviewed_disabled_rule_package_v1" &&
      disabledPackageJson.locks?.ruleEnabled === false &&
      disabledPackageJson.locks?.activeRulePackageCompiled === false &&
      disabledPackageJson.locks?.softwareActionsExecuted === false,
    evidence: disabledPackage.packagePath
  },
  {
    name: "Durable audit retained rollback point path exists",
    pass:
      auditJson.evidenceChain?.some(
        (row) => row.step === "retained_rollback_point" && row.path === rollbackPoint && existsSync(row.path)
      ) === true,
    evidence: rollbackPoint
  }
];

if (checks.some((check) => !check.pass)) {
  throw new Error(`DURABLE_RAG_AUDIT_CHAIN_FAILED:${JSON.stringify(checks.filter((check) => !check.pass), null, 2)}`);
}

const result = {
  ok: true,
  format: "transparent_ai_durable_rag_primary_source_delivery_gate_audit_chain_result_v1",
  createdAt: new Date().toISOString(),
  goal,
  status: "durable_rag_delivery_gate_audit_ready_for_teacher_review",
  reviewValidationPath,
  disabledPackagePath: disabledPackage.packagePath,
  compiledRulePackagePath: disabledPackage.compiledRulePackagePath,
  validationReportPacketPath: validationReport.packetPath,
  validationReportPath: validationReport.validationReportPath,
  deliveryGatePath: deliveryGate.gatePath,
  auditPath: audit.auditPath,
  rollbackPoint,
  checks,
  locks: auditJson.locks
};
const resultPath = join(outputRoot, "durable-rag-primary-source-delivery-gate-audit-chain-result.json");
writeJson(resultPath, result);

console.log(JSON.stringify({ ...result, resultPath }, null, 2));
