#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const scriptPath = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-tlcl-reasoning-budget-governor.mjs");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reasoning-budget-governor-smoke");

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function run(args) {
  const output = execFileSync(process.execPath, [scriptPath, "--out-dir", outRoot, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return JSON.parse(output);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const validationPassPath = writeJson(join(outRoot, "validation-pass.json"), {
  format: "transparent_ai_validation_report_v1",
  status: "pass",
  delivery_allowed: true,
  results: []
});
const validationUnknownPath = writeJson(join(outRoot, "validation-unknown.json"), {
  format: "transparent_ai_validation_report_v1",
  status: "unknown",
  delivery_allowed: false,
  results: [{ id: "rule.missing", status: "unknown", lifecycle: "active", severity: "blocking" }]
});
const ragEvidencePath = writeJson(join(outRoot, "rag-evidence.json"), {
  format: "transparent_ai_tlcl_rag_evidence_attachment_v1",
  ragEvidenceNonAuthoritative: true,
  ragEvidenceTreatedAsAuthority: false,
  evidenceRows: [{ id: "rag-1", logicExtractionHint: "Only informs high reasoning repair." }]
});

const checks = [];

function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

const medium = run([
  "--goal",
  "reuse teacher confirmed workflow cheaply",
  "--operation",
  "medium_runtime_reuse",
  "--tier",
  "medium_reasoning_runtime",
  "--validation-report",
  validationPassPath,
  "--workflow-confirmed",
  "--deterministic-validators-passed",
  "--teacher-reviewed",
  "--rollback-point-retained",
  "--fresh-outcome-review-planned"
]);
const mediumPacket = readJson(medium.governorPath);
check("Confirmed workflow can use medium reasoning runtime", medium.decision === "allow_medium_reasoning_runtime_reuse", {
  decision: medium.decision,
  recommendedTier: medium.recommendedTier
});
check("Medium runtime governor keeps execution and memory locked", mediumPacket.locks.doesNotExecuteTargetSoftware === true && mediumPacket.locks.doesNotWriteMemory === true, {
  locks: mediumPacket.locks
});

const correction = run([
  "--goal",
  "teacher found a contract error",
  "--operation",
  "medium_runtime_reuse",
  "--tier",
  "medium_reasoning_runtime",
  "--validation-report",
  validationUnknownPath,
  "--teacher-correction",
  "The angle relation should be derived from parameter A, not copied visually.",
  "--workflow-confirmed",
  "--deterministic-validators-passed",
  "--teacher-reviewed",
  "--rollback-point-retained",
  "--fresh-outcome-review-planned"
]);
check("Teacher correction and validator unknown escalate back to high reasoning", correction.decision === "route_to_highest_reasoning_contract_compile_or_repair", {
  repairTriggers: correction.repairTriggers
});

const highMisuse = run([
  "--goal",
  "avoid expensive model for confirmed reuse",
  "--operation",
  "medium_runtime_reuse",
  "--tier",
  "senior_reasoning_compile",
  "--validation-report",
  validationPassPath,
  "--workflow-confirmed",
  "--deterministic-validators-passed",
  "--teacher-reviewed",
  "--rollback-point-retained",
  "--fresh-outcome-review-planned"
]);
check("High reasoning cannot be used as a direct runtime shortcut", highMisuse.decision === "blocked_before_reasoning_tier_use", {
  blockers: highMisuse.blockers
});

const mediumCompile = run([
  "--goal",
  "block cheap model from editing rules",
  "--operation",
  "compile_logic_contract",
  "--tier",
  "medium_reasoning_runtime",
  "--validation-report",
  validationPassPath
]);
check("Medium reasoning cannot compile or repair the normative contract", mediumCompile.decision === "route_to_highest_reasoning_contract_compile_or_repair", {
  requestedOperation: mediumCompile.requestedOperation,
  requestedTier: mediumCompile.requestedTier,
  recommendedTier: mediumCompile.recommendedTier,
  blockers: mediumCompile.blockers
});

const ragAuthority = run([
  "--goal",
  "block RAG authority shortcut",
  "--operation",
  "medium_runtime_reuse",
  "--tier",
  "medium_reasoning_runtime",
  "--rag-evidence",
  ragEvidencePath,
  "--rag-evidence-authoritative",
  "--workflow-confirmed",
  "--deterministic-validators-passed",
  "--teacher-reviewed",
  "--rollback-point-retained",
  "--fresh-outcome-review-planned"
]);
check("RAG evidence cannot authorize medium runtime", ragAuthority.decision === "route_to_highest_reasoning_contract_compile_or_repair", {
  blockers: ragAuthority.blockers
});

const sourceText = readFileSync(scriptPath, "utf8");
check(
  "Reasoning budget governor exposes the explicit cost-control policy",
  sourceText.includes("highest_cost_only_when_learning_or_repairing") &&
    sourceText.includes("allowed_for_confirmed_workflow_reuse_only") &&
    sourceText.includes("rag_authority_to_runtime") &&
    sourceText.includes("medium_reasoning_rule_compilation"),
  {}
);

const passed = checks.filter((item) => item.passed).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_reasoning_budget_governor_smoke_v1",
  passed,
  total: checks.length,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
