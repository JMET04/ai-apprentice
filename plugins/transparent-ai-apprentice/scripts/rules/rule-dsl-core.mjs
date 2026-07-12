import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";

export const VALID_LIFECYCLES = ["draft_disabled", "review_only", "active", "deprecated", "revoked"];
export const VALID_SEVERITIES = ["info", "warning", "blocking"];
export const VALID_CONSTRAINT_TYPES = ["json_schema", "expression", "topology", "geometry", "policy_gate"];

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export function stableId(prefix) {
  return `${prefix}.${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

export function listRuleFiles(root) {
  const output = [];
  const stack = [resolve(root)];
  while (stack.length) {
    const current = stack.pop();
    if (!existsSync(current)) continue;
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) stack.push(join(current, entry));
    } else if ([".yaml", ".yml", ".json"].includes(extname(current).toLowerCase())) {
      output.push(current);
    }
  }
  output.sort();
  return output;
}

export function parseRuleText(text, sourcePath = "") {
  const clean = String(text).replace(/^\uFEFF/, "").trim();
  if (!clean) throw new Error(`Empty rule file: ${sourcePath}`);
  if (clean.startsWith("{")) return JSON.parse(clean);
  const result = {};
  for (const line of clean.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!match) throw new Error(`Unsupported YAML subset in ${sourcePath}: ${trimmed}`);
    const [, key, rawValue] = match;
    result[key] = rawValue.replace(/^["']|["']$/g, "");
  }
  return result;
}

export function loadRuleCard(path) {
  const card = parseRuleText(readFileSync(path, "utf8"), path);
  return normalizeRuleCard({ ...card, source_file: path });
}

export function normalizeRuleCard(rule) {
  return {
    dsl_version: rule.dsl_version || "0.1",
    rule_id: rule.rule_id || "",
    title: rule.title || "",
    domain: rule.domain || "generic",
    lifecycle: rule.lifecycle || "draft_disabled",
    severity: rule.severity || "warning",
    owner: {
      teacher_id: rule.owner?.teacher_id || "",
      reviewer_id: rule.owner?.reviewer_id ?? null,
      approved_at: rule.owner?.approved_at ?? null
    },
    source: {
      type: rule.source?.type || "unknown",
      evidence_refs: Array.isArray(rule.source?.evidence_refs) ? rule.source.evidence_refs : [],
      natural_language: rule.source?.natural_language || ""
    },
    scope: {
      artifact_types: Array.isArray(rule.scope?.artifact_types) ? rule.scope.artifact_types : [],
      applies_when: rule.scope?.applies_when || null
    },
    inputs_required: Array.isArray(rule.inputs_required) ? rule.inputs_required : [],
    constraint: rule.constraint || { type: "" },
    failure: {
      message: rule.failure?.message || "Rule failed.",
      action: rule.failure?.action || "reject_delivery",
      remediation_hint: rule.failure?.remediation_hint || "Review the artifact and rule inputs."
    },
    audit: {
      created_by: rule.audit?.created_by || "ai",
      created_at: rule.audit?.created_at || new Date().toISOString(),
      updated_at: rule.audit?.updated_at || new Date().toISOString(),
      rule_version: rule.audit?.rule_version || "0.1.0"
    },
    source_file: rule.source_file || ""
  };
}

export function validateRuleCard(rule) {
  const errors = [];
  for (const key of ["dsl_version", "rule_id", "title", "domain", "lifecycle", "severity", "owner", "source", "scope", "inputs_required", "constraint", "failure", "audit"]) {
    if (rule[key] === undefined || rule[key] === null || rule[key] === "") errors.push({ error_code: "MISSING_FIELD", path: key });
  }
  if (rule.dsl_version !== "0.1") errors.push({ error_code: "UNSUPPORTED_DSL_VERSION", path: "dsl_version" });
  if (!VALID_LIFECYCLES.includes(rule.lifecycle)) errors.push({ error_code: "INVALID_LIFECYCLE", path: "lifecycle" });
  if (!VALID_SEVERITIES.includes(rule.severity)) errors.push({ error_code: "INVALID_SEVERITY", path: "severity" });
  if (!VALID_CONSTRAINT_TYPES.includes(rule.constraint?.type)) errors.push({ error_code: "UNKNOWN_VALIDATOR", path: "constraint.type" });
  if (rule.lifecycle === "active" && (!rule.owner?.reviewer_id || !rule.owner?.approved_at)) {
    errors.push({ error_code: "ACTIVE_RULE_REQUIRES_REVIEWER_AND_APPROVED_AT", path: "owner" });
  }
  if (rule.constraint?.type === "expression") {
    const expr = String(rule.constraint.expr || "");
    if (!expr) errors.push({ error_code: "MISSING_EXPRESSION", path: "constraint.expr" });
    if (/\beval\b|\bFunction\b|require\s*\(|import\s*\(|process\.|fs\.|fetch\s*\(|XMLHttpRequest|Date\.now|Math\.random/.test(expr)) {
      errors.push({ error_code: "FORBIDDEN_EXPRESSION_SYNTAX", path: "constraint.expr" });
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateArtifactEnvelope(artifact) {
  const errors = [];
  for (const key of ["artifact_id", "artifact_type", "schema_version", "units", "created_at", "source_refs", "context", "objects"]) {
    if (artifact[key] === undefined || artifact[key] === null || artifact[key] === "") errors.push({ error_code: "MISSING_FIELD", path: key });
  }
  if (!Array.isArray(artifact.source_refs) || artifact.source_refs.length === 0) {
    errors.push({ error_code: "MISSING_SOURCE_REFS", path: "source_refs" });
  }
  if (!Array.isArray(artifact.objects)) errors.push({ error_code: "OBJECTS_MUST_BE_ARRAY", path: "objects" });
  return { ok: errors.length === 0, errors };
}

export function resultFor({ rule, artifact, status, validator, message, expected = "", observed = {}, evidence_paths = [], remediation_hint = "" }) {
  return {
    rule_id: rule.rule_id,
    rule_version: rule.audit?.rule_version || "0.1.0",
    lifecycle: rule.lifecycle,
    severity: rule.severity,
    status,
    validator,
    message,
    expected,
    observed,
    evidence_paths,
    remediation_hint: remediation_hint || rule.failure?.remediation_hint || "",
    responsibility: {
      rule_owner: rule.owner?.teacher_id || "",
      reviewer: rule.owner?.reviewer_id || null,
      approved_at: rule.owner?.approved_at || null
    },
    artifact_id: artifact.artifact_id || ""
  };
}

export function scopeMatches(rule, artifact) {
  const types = rule.scope?.artifact_types || [];
  return types.length === 0 || types.includes(artifact.artifact_type);
}

export function summarizeResults(results) {
  const summary = { pass: 0, fail: 0, unknown: 0, skipped: 0, error: 0 };
  for (const result of results) summary[result.status] = (summary[result.status] || 0) + 1;
  const delivery_allowed = !results.some(
    (result) =>
      result.status === "error" ||
      (result.lifecycle === "active" && result.severity === "blocking" && ["fail", "unknown"].includes(result.status))
  );
  let status = "pass";
  if (summary.error > 0) status = "error";
  else if (summary.fail > 0) status = "fail";
  else if (summary.unknown > 0) status = "unknown";
  else if (summary.pass === 0 && summary.skipped > 0) status = "skipped";
  return { summary, delivery_allowed, status };
}

export function buildValidationReport({ artifact, rulePackage, results, validatorVersion = "0.1.0" }) {
  const decision = summarizeResults(results);
  return {
    validation_id: stableId("val"),
    artifact_id: artifact.artifact_id || "",
    rule_package_id: rulePackage.rule_package_id || "",
    status: decision.status,
    delivery_allowed: decision.delivery_allowed,
    created_at: new Date().toISOString(),
    summary: decision.summary,
    results,
    hashes: {
      artifact_hash: sha256Object(artifact),
      rule_package_hash: sha256Object(rulePackage),
      validator_version: validatorVersion
    }
  };
}

export function artifactPathMessage(path) {
  return path ? path.replace(process.cwd(), ".") : basename(path || "");
}
