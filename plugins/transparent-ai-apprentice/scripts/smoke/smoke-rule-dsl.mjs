#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { loadRuleCard, validateRuleCard, readJson } from "../rules/rule-dsl-core.mjs";
import { evaluateRulePackage } from "../rules/evaluate-rule-package.mjs";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "rule-dsl-smoke", String(Date.now()));
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

const validRulePath = join(repoRoot, "plugins", "transparent-ai-apprentice", "rules", "examples", "packaging", "pkg.glue_tab.min_width.rule.yaml");
const validRule = loadRuleCard(validRulePath);
const missingRulePath = join(smokeRoot, "missing-rule-id.rule.yaml");
writeFileSync(missingRulePath, JSON.stringify({ ...validRule, rule_id: "" }, null, 2), "utf8");
const unknownValidatorPath = join(smokeRoot, "unknown-validator.rule.yaml");
writeFileSync(unknownValidatorPath, JSON.stringify({ ...validRule, rule_id: "demo.unknown.validator", constraint: { type: "magic_ai_validator" } }, null, 2), "utf8");
const draftRulePath = join(smokeRoot, "draft.rule.yaml");
writeFileSync(draftRulePath, JSON.stringify({ ...validRule, rule_id: "demo.draft.rule", lifecycle: "draft_disabled", owner: { teacher_id: "teacher.local", reviewer_id: null, approved_at: null } }, null, 2), "utf8");

const validArtifact = node("scripts/artifacts/create-packaging-dieline-artifact.mjs", ["--variant", "valid", "--out-dir", join(smokeRoot, "artifacts")]);
const invalidArtifact = node("scripts/artifacts/create-packaging-dieline-artifact.mjs", ["--variant", "invalid", "--out-dir", join(smokeRoot, "artifacts")]);
const unknownArtifact = node("scripts/artifacts/create-packaging-dieline-artifact.mjs", ["--variant", "unknown", "--out-dir", join(smokeRoot, "artifacts")]);
const compiled = node("scripts/rules/compile-rule-package.mjs", [
  "--rules",
  join(repoRoot, "plugins", "transparent-ai-apprentice", "rules", "examples", "packaging"),
  "--package-id",
  "ruleset.packaging.demo.001",
  "--out-dir",
  join(smokeRoot, "rule-package")
]);
const validReportPath = join(smokeRoot, "valid-report.json");
const invalidReportPath = join(smokeRoot, "invalid-report.json");
const unknownReportPath = join(smokeRoot, "unknown-report.json");
const validReport = await evaluateRulePackage({ rulesPath: compiled.packagePath, artifactPath: validArtifact.artifactPath, outPath: validReportPath });
const invalidReport = await evaluateRulePackage({ rulesPath: compiled.packagePath, artifactPath: invalidArtifact.artifactPath, outPath: invalidReportPath });
const unknownReport = await evaluateRulePackage({ rulesPath: compiled.packagePath, artifactPath: unknownArtifact.artifactPath, outPath: unknownReportPath });
const draftPackagePath = join(smokeRoot, "draft-package.json");
writeFileSync(
  draftPackagePath,
  JSON.stringify({ rule_package_id: "ruleset.draft.demo", dsl_version: "0.1", created_at: new Date().toISOString(), rules: [loadRuleCard(draftRulePath)], hashes: {} }, null, 2),
  "utf8"
);
const draftReport = await evaluateRulePackage({ rulesPath: draftPackagePath, artifactPath: invalidArtifact.artifactPath, outPath: join(smokeRoot, "draft-report.json") });

const checks = [
  check("Valid Rule Card passes schema validation", validateRuleCard(validRule).ok, validRule.rule_id),
  check("Missing rule_id fails schema validation", !validateRuleCard(loadRuleCard(missingRulePath)).ok, missingRulePath),
  check("Unknown validator fails schema validation", !validateRuleCard(loadRuleCard(unknownValidatorPath)).ok, unknownValidatorPath),
  check("draft_disabled rule does not block delivery", draftReport.delivery_allowed === true && draftReport.summary.skipped === 1, "draft_disabled skipped"),
  check("active blocking fail blocks delivery", invalidReport.delivery_allowed === false && invalidReport.status === "fail", invalidReportPath),
  check("active blocking unknown blocks delivery", unknownReport.delivery_allowed === false && unknownReport.status === "unknown", unknownReportPath),
  check("valid packaging artifact passes active blocking rules", validReport.delivery_allowed === true && validReport.status === "pass", validReportPath),
  check("evaluate-rule-package writes machine-readable JSON reports", readJson(invalidReportPath).results.some((result) => result.rule_id === "pkg.glue_tab.min_width"), invalidReportPath)
];

const passed = checks.filter((item) => item.pass).length;
const result = { status: passed === checks.length ? "passed" : "failed", smoke: "transparent_ai_rule_dsl_smoke_v1", smokeRoot, checks };
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
