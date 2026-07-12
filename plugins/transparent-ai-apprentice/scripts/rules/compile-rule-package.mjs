#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { listRuleFiles, loadRuleCard, sha256Object, stableId, validateRuleCard, writeJson } from "./rule-dsl-core.mjs";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const rulesRoot = resolve(arg("--rules", "plugins/transparent-ai-apprentice/rules/examples"));
const packageId = arg("--package-id", "ruleset.packaging.demo.001");
const outRoot = resolve(arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rule-packages", packageId)));
if (!existsSync(rulesRoot)) throw new Error(`Rules path not found: ${rulesRoot}`);

const files = listRuleFiles(rulesRoot);
const rules = [];
const errors = [];
const seen = new Set();
for (const file of files) {
  try {
    const rule = loadRuleCard(file);
    const validation = validateRuleCard(rule);
    if (seen.has(rule.rule_id)) validation.errors.push({ error_code: "DUPLICATE_RULE_ID", path: "rule_id" });
    seen.add(rule.rule_id);
    if (!validation.ok || validation.errors.length) errors.push(...validation.errors.map((error) => ({ ...error, rule_id: rule.rule_id, file })));
    rules.push(rule);
  } catch (error) {
    errors.push({ error_code: "RULE_LOAD_ERROR", file, message: String(error.message || error) });
  }
}

const rulePackage = {
  rule_package_id: packageId,
  dsl_version: "0.1",
  created_at: new Date().toISOString(),
  rules,
  hashes: {
    package_hash: "",
    rule_hashes: Object.fromEntries(rules.map((rule) => [rule.rule_id, sha256Object(rule)]))
  }
};
rulePackage.hashes.package_hash = sha256Object(rulePackage);

const status = errors.length ? "fail" : "pass";
const packagePath = join(outRoot, "rule-package.json");
const lockPath = join(outRoot, "rule-package.lock.json");
const compileReportPath = join(outRoot, "compile-report.json");
if (!errors.length) writeJson(packagePath, rulePackage);
writeJson(lockPath, { rule_package_id: packageId, created_at: rulePackage.created_at, hashes: rulePackage.hashes, source_files: files });
writeJson(compileReportPath, {
  compile_id: stableId("compile"),
  status,
  package_id: packageId,
  rulesRoot,
  rule_count: rules.length,
  errors,
  packagePath: errors.length ? "" : packagePath,
  lockPath,
  compileReportPath
});

console.log(JSON.stringify({ ok: errors.length === 0, status, packagePath: errors.length ? "" : packagePath, lockPath, compileReportPath, errors }, null, 2));
if (errors.length) process.exit(1);
