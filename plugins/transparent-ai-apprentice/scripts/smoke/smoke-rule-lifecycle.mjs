#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { evaluateRulePackage } from "../rules/evaluate-rule-package.mjs";
import { loadRuleCard, validateRuleCard } from "../rules/rule-dsl-core.mjs";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "rule-lifecycle-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });
const base = loadRuleCard(join(repoRoot, "plugins", "transparent-ai-apprentice", "rules", "examples", "packaging", "pkg.glue_tab.min_width.rule.yaml"));

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

function pkgFor(rule, name) {
  const path = join(smokeRoot, `${name}-package.json`);
  writeFileSync(path, JSON.stringify({ rule_package_id: `ruleset.${name}`, dsl_version: "0.1", created_at: new Date().toISOString(), rules: [rule], hashes: {} }, null, 2), "utf8");
  return path;
}

const invalid = node("scripts/artifacts/create-packaging-dieline-artifact.mjs", ["--variant", "invalid", "--out-dir", join(smokeRoot, "artifacts")]);
const draft = { ...base, rule_id: "demo.lifecycle.draft", lifecycle: "draft_disabled", owner: { teacher_id: "teacher.local", reviewer_id: null, approved_at: null } };
const reviewOnly = { ...base, rule_id: "demo.lifecycle.review", lifecycle: "review_only", owner: { teacher_id: "teacher.local", reviewer_id: null, approved_at: null } };
const active = { ...base, rule_id: "demo.lifecycle.active", lifecycle: "active", owner: { teacher_id: "teacher.local", reviewer_id: "qa.local", approved_at: "2026-06-12T00:00:00+08:00" } };
const deprecated = { ...base, rule_id: "demo.lifecycle.deprecated", lifecycle: "deprecated" };
const revoked = { ...base, rule_id: "demo.lifecycle.revoked", lifecycle: "revoked" };
const activeNoReviewer = { ...base, rule_id: "demo.lifecycle.bad.active", lifecycle: "active", owner: { teacher_id: "teacher.local", reviewer_id: null, approved_at: null } };

const draftReport = await evaluateRulePackage({ rulesPath: pkgFor(draft, "draft"), artifactPath: invalid.artifactPath, outPath: join(smokeRoot, "draft-report.json") });
const reviewReport = await evaluateRulePackage({ rulesPath: pkgFor(reviewOnly, "review"), artifactPath: invalid.artifactPath, outPath: join(smokeRoot, "review-report.json") });
const activeReport = await evaluateRulePackage({ rulesPath: pkgFor(active, "active"), artifactPath: invalid.artifactPath, outPath: join(smokeRoot, "active-report.json") });
const deprecatedReport = await evaluateRulePackage({ rulesPath: pkgFor(deprecated, "deprecated"), artifactPath: invalid.artifactPath, outPath: join(smokeRoot, "deprecated-report.json") });
const revokedReport = await evaluateRulePackage({ rulesPath: pkgFor(revoked, "revoked"), artifactPath: invalid.artifactPath, outPath: join(smokeRoot, "revoked-report.json") });

const checks = [
  check("draft_disabled -> review_only -> active lifecycle values are valid", validateRuleCard(draft).ok && validateRuleCard(reviewOnly).ok && validateRuleCard(active).ok, "lifecycle path"),
  check("active -> deprecated is represented and deprecated skips execution", validateRuleCard(deprecated).ok && deprecatedReport.delivery_allowed === true && deprecatedReport.summary.skipped === 1, "deprecated skipped"),
  check("revoked rule does not execute", validateRuleCard(revoked).ok && revokedReport.delivery_allowed === true && revokedReport.summary.skipped === 1, "revoked skipped"),
  check("draft_disabled and review_only do not block delivery", draftReport.delivery_allowed === true && reviewReport.delivery_allowed === true, "draft/review skipped"),
  check("active blocking rule blocks failing delivery", activeReport.delivery_allowed === false && activeReport.status === "fail", "active blocks"),
  check("active rule without reviewer cannot validate", validateRuleCard(activeNoReviewer).ok === false, "missing reviewer blocked")
];
const passed = checks.filter((item) => item.pass).length;
const result = { status: passed === checks.length ? "passed" : "failed", smoke: "transparent_ai_rule_lifecycle_smoke_v1", smokeRoot, checks };
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
