#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { evaluateRulePackage } from "../rules/evaluate-rule-package.mjs";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "validation-report-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function node(script, args) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const artifact = node("scripts/artifacts/create-packaging-dieline-artifact.mjs", ["--variant", "invalid", "--out-dir", join(smokeRoot, "artifacts")]);
const compiled = node("scripts/rules/compile-rule-package.mjs", [
  "--rules",
  join(repoRoot, "plugins", "transparent-ai-apprentice", "rules", "examples", "packaging"),
  "--package-id",
  "ruleset.packaging.demo.001",
  "--out-dir",
  join(smokeRoot, "rule-package")
]);
const reportPath = join(smokeRoot, "demo-validation-report.json");
const report = await evaluateRulePackage({ rulesPath: compiled.packagePath, artifactPath: artifact.artifactPath, outPath: reportPath });
const row = report.results.find((result) => result.status === "fail");
const checks = [
  check("report includes rule_id rule_version artifact_id validator status severity", Boolean(row?.rule_id && row?.rule_version && row?.artifact_id && row?.validator && row?.status && row?.severity), JSON.stringify(row || {})),
  check("report includes evidence_paths observed expected", Array.isArray(row?.evidence_paths) && row.evidence_paths.length > 0 && row.observed && row.expected, JSON.stringify(row || {})),
  check("report includes delivery_allowed and hashes", report.delivery_allowed === false && report.hashes?.artifact_hash && report.hashes?.rule_package_hash && report.hashes?.validator_version, reportPath)
];
const passed = checks.filter((item) => item.pass).length;
const result = { status: passed === checks.length ? "passed" : "failed", smoke: "transparent_ai_validation_report_smoke_v1", smokeRoot, reportPath, checks };
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
