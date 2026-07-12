#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { evaluateRulePackage } from "../rules/evaluate-rule-package.mjs";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "packaging-validator-smoke", String(Date.now()));
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

const artifactsDir = join(smokeRoot, "artifacts");
const valid = node("scripts/artifacts/create-packaging-dieline-artifact.mjs", ["--variant", "valid", "--out-dir", artifactsDir]);
const invalid = node("scripts/artifacts/create-packaging-dieline-artifact.mjs", ["--variant", "invalid", "--out-dir", artifactsDir]);
const compiled = node("scripts/rules/compile-rule-package.mjs", [
  "--rules",
  join(repoRoot, "plugins", "transparent-ai-apprentice", "rules", "examples", "packaging"),
  "--package-id",
  "ruleset.packaging.demo.001",
  "--out-dir",
  join(smokeRoot, "rule-package")
]);
const validReport = await evaluateRulePackage({ rulesPath: compiled.packagePath, artifactPath: valid.artifactPath, outPath: join(smokeRoot, "valid-report.json") });
const invalidReport = await evaluateRulePackage({ rulesPath: compiled.packagePath, artifactPath: invalid.artifactPath, outPath: join(smokeRoot, "invalid-report.json") });
const invalidGlue = invalidReport.results.find((result) => result.rule_id === "pkg.glue_tab.min_width");

const checks = [
  check("valid packaging artifact => pass", validReport.delivery_allowed === true && validReport.status === "pass", valid.artifactPath),
  check("invalid packaging artifact => fail", invalidReport.delivery_allowed === false && invalidReport.status === "fail", invalid.artifactPath),
  check("fail report points to concrete object", invalidGlue?.observed?.failing_tabs?.[0]?.object_id === "tab.glue.1", JSON.stringify(invalidGlue?.observed || {}))
];
const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_packaging_validator_smoke_v1",
  smokeRoot,
  artifacts: { valid: valid.artifactPath, invalid: invalid.artifactPath },
  reports: { valid: join(smokeRoot, "valid-report.json"), invalid: join(smokeRoot, "invalid-report.json") },
  rulePackage: compiled.packagePath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
