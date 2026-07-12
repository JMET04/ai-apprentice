#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-runtime-gate-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const status = runNode("scripts/create-tlcl-status-refresh.mjs", [
  "--goal",
  "smoke-tlcl-runtime-gate",
  "--out-dir",
  join(smokeRoot, "status")
]);

const passingReportPath = writeJson(join(smokeRoot, "passing-validation-report.json"), {
  validation_id: "val.smoke.pass",
  artifact_id: "artifact.smoke",
  rule_package_id: "ruleset.smoke",
  status: "pass",
  delivery_allowed: true,
  created_at: new Date().toISOString(),
  summary: { pass: 1, fail: 0, unknown: 0, skipped: 0, error: 0 },
  results: [
    {
      rule_id: "rule.smoke.active",
      rule_version: "0.1.0",
      lifecycle: "active",
      severity: "blocking",
      status: "pass",
      validator: "expression",
      message: "passed",
      artifact_id: "artifact.smoke"
    }
  ],
  hashes: { artifact_hash: "sha256:pass", rule_package_hash: "sha256:rules" }
});

const unknownReportPath = writeJson(join(smokeRoot, "unknown-validation-report.json"), {
  validation_id: "val.smoke.unknown",
  artifact_id: "artifact.smoke",
  rule_package_id: "ruleset.smoke",
  status: "unknown",
  delivery_allowed: false,
  created_at: new Date().toISOString(),
  summary: { pass: 0, fail: 0, unknown: 1, skipped: 0, error: 0 },
  results: [
    {
      rule_id: "rule.smoke.active",
      rule_version: "0.1.0",
      lifecycle: "active",
      severity: "blocking",
      status: "unknown",
      validator: "expression",
      message: "missing evidence",
      artifact_id: "artifact.smoke"
    }
  ],
  hashes: { artifact_hash: "sha256:unknown", rule_package_hash: "sha256:rules" }
});

const allowedResult = runNode("scripts/create-tlcl-runtime-gate.mjs", [
  "--goal",
  "allowed-medium-runtime",
  "--status-refresh",
  status.refreshPath,
  "--validation-report",
  passingReportPath,
  "--out-dir",
  join(smokeRoot, "gates")
]);
const correctionResult = runNode("scripts/create-tlcl-runtime-gate.mjs", [
  "--goal",
  "teacher-correction-escalates",
  "--status-refresh",
  status.refreshPath,
  "--validation-report",
  passingReportPath,
  "--teacher-correction",
  "The dry-run followed the wrong data relationship; repair the rule.",
  "--out-dir",
  join(smokeRoot, "gates")
]);
const unknownResult = runNode("scripts/create-tlcl-runtime-gate.mjs", [
  "--goal",
  "unknown-validator-escalates",
  "--status-refresh",
  status.refreshPath,
  "--validation-report",
  unknownReportPath,
  "--out-dir",
  join(smokeRoot, "gates")
]);

const allowedGate = readJson(allowedResult.gatePath);
const correctionGate = readJson(correctionResult.gatePath);
const unknownGate = readJson(unknownResult.gatePath);

const checks = [
  check("Passing validation allows only medium reviewed dry-run", allowedGate.decision === "medium_runtime_allowed" && allowedGate.runtimePermission.canPrepareReviewedDryRun === true, allowedResult.gatePath),
  check("Medium runtime still cannot execute software or enable rules", allowedGate.runtimePermission.canExecuteTargetSoftware === false && allowedGate.runtimePermission.canEnableRules === false, allowedResult.gatePath),
  check("Teacher correction escalates back to senior compile", correctionGate.decision === "escalate_to_senior_compile" && correctionGate.escalationPacket.triggers.includes("teacher_correction"), correctionResult.gatePath),
  check("Validator unknown escalates back to senior compile", unknownGate.decision === "escalate_to_senior_compile" && unknownGate.escalationPacket.triggers.includes("validator_unknown"), unknownResult.gatePath),
  check("Runtime gate is review-only and cannot claim completion", unknownGate.locks.reviewOnly === true && unknownGate.locks.noCompletionClaim === true && unknownGate.runtimePermission.canClaimCompletion === false, unknownResult.gatePath)
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_runtime_gate_smoke_v1",
  smokeRoot,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
