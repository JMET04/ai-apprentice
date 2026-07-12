#!/usr/bin/env node
import { resolve } from "node:path";
import { readJson, writeJson, buildValidationReport, resultFor, scopeMatches, validateArtifactEnvelope } from "./rule-dsl-core.mjs";
import { validatorRegistry } from "../validators/registry.mjs";
import { printValidationReport } from "../reports/print-validation-report.mjs";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

export async function evaluateRulePackage({ rulesPath, artifactPath, outPath }) {
  const rulePackage = readJson(rulesPath);
  const artifact = readJson(artifactPath);
  const artifactValidation = validateArtifactEnvelope(artifact);
  const results = [];
  if (!artifactValidation.ok) {
    for (const error of artifactValidation.errors) {
      results.push({
        rule_id: "artifact-envelope",
        rule_version: "0.1.0",
        lifecycle: "active",
        severity: "blocking",
        status: "unknown",
        validator: "artifact-envelope-schema",
        message: error.error_code,
        expected: "complete artifact envelope",
        observed: error,
        evidence_paths: [error.path],
        remediation_hint: "Normalize the artifact envelope before validation.",
        responsibility: { rule_owner: "system", reviewer: null, approved_at: null },
        artifact_id: artifact.artifact_id || ""
      });
    }
  }
  for (const rule of rulePackage.rules || []) {
    if (["draft_disabled", "review_only", "deprecated", "revoked"].includes(rule.lifecycle)) {
      results.push(resultFor({ rule, artifact, status: "skipped", validator: "lifecycle-gate", message: `${rule.lifecycle} rules do not block delivery.` }));
      continue;
    }
    if (!scopeMatches(rule, artifact)) {
      results.push(resultFor({ rule, artifact, status: "skipped", validator: "scope-gate", message: "Rule scope does not match artifact type." }));
      continue;
    }
    const validator = validatorRegistry[rule.constraint?.type];
    if (!validator) {
      results.push(resultFor({ rule, artifact, status: "error", validator: "registry", message: `Unknown validator: ${rule.constraint?.type}` }));
      continue;
    }
    try {
      results.push(await validator.validate({ rule, artifact, context: artifact.context || {} }));
    } catch (error) {
      results.push(resultFor({ rule, artifact, status: "error", validator: rule.constraint?.type, message: String(error.message || error) }));
    }
  }
  const report = buildValidationReport({ artifact, rulePackage, results });
  writeJson(outPath, report);
  return report;
}

const rulesPath = arg("--rules", "");
const artifactPath = arg("--artifact", "");
const outPath = arg("--out", "");
if (rulesPath && artifactPath && outPath) {
  const report = await evaluateRulePackage({ rulesPath: resolve(rulesPath), artifactPath: resolve(artifactPath), outPath: resolve(outPath) });
  printValidationReport(report);
  if (report.status === "error") process.exit(1);
  if (!report.delivery_allowed) process.exit(2);
}
