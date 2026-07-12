#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "universal-detail-logic-application-dry-run")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "universal-detail-logic-application-dry-run"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function lockState() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    dryRunDoesNotGenerateOutput: true,
    dryRunDoesNotExecuteSoftware: true,
    dryRunDoesNotWriteMemory: true,
    dryRunDoesNotEnableRules: true,
    targetCadGenerated: false,
    targetOutputGenerated: false,
    cadSoftwareExecuted: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    surfaceSimilarityOnlyAccepted: false,
    goalComplete: false
  };
}

function tokenize(input) {
  const tokens = [];
  const text = String(input || "").replace(/\b(deg|mm|cm|m|px)\b/gi, "");
  const re = /\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[()+\-*/,])\s*/g;
  let match;
  let cursor = 0;
  while ((match = re.exec(text))) {
    if (match.index !== cursor && text.slice(cursor, match.index).trim()) {
      throw new Error(`Unsupported expression token near ${text.slice(cursor, match.index).trim()}`);
    }
    tokens.push(match[1]);
    cursor = re.lastIndex;
  }
  if (text.slice(cursor).trim()) throw new Error(`Unsupported expression token near ${text.slice(cursor).trim()}`);
  return tokens;
}

function evaluateExpression(expression, data) {
  const tokens = tokenize(expression);
  let index = 0;
  function peek() {
    return tokens[index];
  }
  function take() {
    return tokens[index++];
  }
  function parsePrimary() {
    const token = take();
    if (token === "(") {
      const value = parseExpression();
      if (take() !== ")") throw new Error("Missing closing parenthesis");
      return value;
    }
    if (token === "-") return -parsePrimary();
    if (/^\d/.test(token)) return Number(token);
    if (/^[A-Za-z_]/.test(token)) {
      if (peek() === "(") {
        take();
        const args = [];
        if (peek() !== ")") {
          while (true) {
            args.push(parseExpression());
            if (peek() !== ",") break;
            take();
          }
        }
        if (take() !== ")") throw new Error("Missing function closing parenthesis");
        if (token === "clamp") return Math.min(Math.max(args[0], args[1]), args[2]);
        if (token === "min") return Math.min(...args);
        if (token === "max") return Math.max(...args);
        throw new Error(`Unsupported function ${token}`);
      }
      if (!Object.prototype.hasOwnProperty.call(data, token)) throw new Error(`Missing data field ${token}`);
      const value = Number(data[token]);
      if (!Number.isFinite(value)) throw new Error(`Data field ${token} is not numeric`);
      return value;
    }
    throw new Error(`Unexpected token ${token}`);
  }
  function parseTerm() {
    let value = parsePrimary();
    while (peek() === "*" || peek() === "/") {
      const op = take();
      const right = parsePrimary();
      value = op === "*" ? value * right : value / right;
    }
    return value;
  }
  function parseExpression() {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = take();
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }
  const value = parseExpression();
  if (index !== tokens.length) throw new Error(`Unexpected trailing token ${peek()}`);
  return value;
}

function splitAssignments(formula) {
  return String(formula || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const eq = part.indexOf("=");
      if (eq < 0) return { name: `value_${index + 1}`, expression: part };
      return { name: part.slice(0, eq).trim() || `value_${index + 1}`, expression: part.slice(eq + 1).trim() };
    });
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function writeHtml(path, dryRun) {
  const rows = dryRun.appliedFeatureRows
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.featureId)}</td>
        <td>${htmlEscape(row.status)}</td>
        <td><code>${htmlEscape(JSON.stringify(row.computedValues))}</code></td>
        <td>${htmlEscape(row.blocker)}</td>
      </tr>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Universal Detail Logic Application Dry Run</title>
<style>:root{font-family:"Segoe UI",Arial,sans-serif;color:#17202a;background:#f7f8fb}body{margin:0}main{max-width:1120px;margin:0 auto;padding:28px}h1{font-size:28px;letter-spacing:0}.panel,table{background:#fff;border:1px solid #d8e0ea;border-radius:8px;box-shadow:0 1px 2px rgba(16,32,56,.06)}.panel{padding:16px}table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;border-bottom:1px solid #e7edf5;text-align:left;vertical-align:top;font-size:13px}th{background:#eef3f9}code{overflow-wrap:anywhere}</style>
</head><body><main>
<h1>Universal Detail Logic Application Dry Run</h1>
<section class="panel"><p><strong>Status:</strong> ${htmlEscape(dryRun.status)}</p><p><strong>Computed:</strong> ${dryRun.counts.computedRows}/${dryRun.counts.appliedFeatureRows}</p><p>This dry run applies reviewed logic to new data only. It does not generate output or execute software.</p></section>
<h2>Applied Feature Rows</h2><table><thead><tr><th>Feature</th><th>Status</th><th>Computed Values</th><th>Blocker</th></tr></thead><tbody>${rows}</tbody></table>
</main></body></html>`;
  writeFileSync(path, html, "utf8");
}

const packageInput = readJsonInput(
  argValue("--package", argValue("--rule-package", "")),
  "--package",
  "transparent_ai_universal_detail_logic_rule_package_v1"
);
const newDataInput = readJsonInput(argValue("--new-data", argValue("--target-data", "")), "--new-data");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "universal-detail-logic-application-dry-runs"))
);
mkdirSync(outputRoot, { recursive: true });

const rulePackage = packageInput.value;
const newData = newDataInput.value;
const dryRunId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(rulePackage.packageId)}`;
const dryRunDir = join(outputRoot, dryRunId);
mkdirSync(dryRunDir, { recursive: true });
const dryRunPath = join(dryRunDir, "universal-detail-logic-application-dry-run.json");
const htmlPath = join(dryRunDir, "universal-detail-logic-application-dry-run.html");
const readmePath = join(dryRunDir, "UNIVERSAL_DETAIL_LOGIC_APPLICATION_DRY_RUN_START_HERE.md");
const locks = lockState();

const packageReady = rulePackage.status === "review_only_logic_rule_package_ready_for_dry_run_application";
const appliedFeatureRows = (rulePackage.logicRuleCandidates || []).map((rule) => {
  if (!packageReady) {
    return {
      ruleCandidateId: rule.ruleCandidateId,
      featureId: rule.featureId,
      status: "blocked_until_rule_package_ready",
      computedValues: {},
      blocker: "Rule package is not ready for review-only dry-run application."
    };
  }
  const assignments = splitAssignments(rule.formulaOrConstraint);
  const computedValues = {};
  const errors = [];
  for (const assignment of assignments) {
    try {
      computedValues[assignment.name] = evaluateExpression(assignment.expression, newData);
    } catch (error) {
      errors.push(`${assignment.name}: ${error.message}`);
    }
  }
  return {
    ruleCandidateId: rule.ruleCandidateId,
    featureId: rule.featureId,
    featureType: rule.featureType,
    detailCategory: rule.detailCategory,
    formulaOrConstraint: rule.formulaOrConstraint,
    computedValues,
    status: errors.length ? "needs_teacher_formula_normalization" : "logic_applied_to_new_data_in_dry_run",
    blocker: errors.join("; "),
    validation: rule.transferValidation,
    visualSimilarityRole: "secondary_review_signal_only_after_logic_validation_passes",
    ruleEnabled: false,
    accepted: false
  };
});
const blockedRows = appliedFeatureRows.filter((row) => row.status !== "logic_applied_to_new_data_in_dry_run");
const dryRun = {
  ok: true,
  format: "transparent_ai_universal_detail_logic_application_dry_run_v1",
  dryRunId,
  createdAt: new Date().toISOString(),
  sourceRulePackage: packageInput.path,
  sourceNewData: newDataInput.path,
  status: blockedRows.length
    ? "blocked_until_teacher_normalizes_uncalculable_logic"
    : "review_only_logic_application_dry_run_ready_for_teacher_review",
  decision: blockedRows.length ? "needs_teacher_review" : "ready_for_teacher_review_of_computed_logic",
  counts: {
    appliedFeatureRows: appliedFeatureRows.length,
    computedRows: appliedFeatureRows.length - blockedRows.length,
    blockedRows: blockedRows.length
  },
  gates: {
    sourceRulePackageReady: packageReady,
    everyFeatureComputedOrBlocked: true,
    visualSimilarityStillSecondaryOnly: true,
    noGenerationOrExecutionPerformed: true
  },
  appliedFeatureRows,
  blockedRows,
  nextReviewOnlyGenerationRoute: blockedRows.length
    ? ""
    : "After teacher review, route these computed feature values into an existing-tool preview or supervised execution adapter; do not execute target software without the existing confirmation and rollback gates.",
  blockedActions: [
    "generate_output_from_application_dry_run",
    "execute_target_software_from_application_dry_run",
    "write_memory_from_application_dry_run",
    "enable_rules_from_application_dry_run",
    "judge_by_visual_similarity_before_logic_validation",
    "claim_complete"
  ],
  locks,
  paths: {
    dryRun: dryRunPath,
    html: htmlPath,
    readme: readmePath,
    sourceRulePackage: packageInput.path,
    sourceNewData: newDataInput.path
  }
};

writeFileSync(dryRunPath, `${JSON.stringify(dryRun, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Universal Detail Logic Application Dry Run",
    "",
    `Status: ${dryRun.status}`,
    `Computed rows: ${dryRun.counts.computedRows}/${dryRun.counts.appliedFeatureRows}`,
    "",
    "This dry run applies disabled, teacher-reviewed logic candidates to new data.",
    "",
    "Safety boundary:",
    "- No output was generated.",
    "- No target software was executed.",
    "- No screenshot was captured.",
    "- No memory was written.",
    "- No rule was enabled or accepted.",
    "- Visual similarity remains secondary after logic validation."
  ].join("\n") + "\n",
  "utf8"
);
writeHtml(htmlPath, dryRun);

console.log(
  JSON.stringify(
    {
      status: dryRun.status,
      format: "transparent_ai_universal_detail_logic_application_dry_run_result_v1",
      dryRunPath,
      htmlPath,
      readmePath,
      computedRows: dryRun.counts.computedRows,
      blockedRows: dryRun.counts.blockedRows,
      locks
    },
    null,
    2
  )
);
