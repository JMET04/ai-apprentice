#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readText(path) {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, "utf8");
  return path;
}

function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function includesForbiddenText(value, forbidden) {
  const text = JSON.stringify(value).toLowerCase();
  return forbidden.filter((item) => text.includes(item.toLowerCase()));
}

const defaultReadinessPath = join(pluginRoot, "artifacts", "manual-test-readiness", "manual-test-readiness-pack.json");
const readinessPackPath = resolve(argValue("--readiness", defaultReadinessPath));
const receiptPath = resolve(argValue("--receipt", ""));
const outputRoot = resolve(argValue("--out-dir", join(pluginRoot, "artifacts", "manual-test-result-validation")));

if (!existsSync(readinessPackPath)) throw new Error(`Manual test readiness pack not found: ${readinessPackPath}`);
if (!receiptPath || !existsSync(receiptPath)) throw new Error(`Manual test result receipt not found: ${receiptPath}`);

const readinessText = readText(readinessPackPath);
const readiness = JSON.parse(readinessText);
const receipt = readJson(receiptPath);
const allowedStatuses = ["not_run_yet", "matched_expected", "blocker_found", "needs_follow_up"];
const forbiddenTransitions = [
  "accepted",
  "product_accepted",
  "technology_accepted",
  "release_ready",
  "enable_rule",
  "rule_enabled",
  "write_memory",
  "memory_written",
  "unlock_packaging",
  "execute_now",
  "claim_complete"
];

const expectedScenarioIds = new Set((readiness.scenarios || []).map((scenario) => scenario.id));
const rows = Array.isArray(receipt.scenarioReceipts) ? receipt.scenarioReceipts : [];
const rowIds = new Set(rows.map((row) => row.scenarioId));
const issues = [];

if (receipt.responseMode !== "transparent_ai_apprentice_manual_test_result_receipt_template_v1") {
  issues.push("receipt_response_mode_mismatch");
}

if (receipt.sourceReadinessPackHash && receipt.sourceReadinessPackHash !== sha256Text(readinessText)) {
  issues.push("source_readiness_hash_mismatch");
}

for (const scenarioId of expectedScenarioIds) {
  if (!rowIds.has(scenarioId)) issues.push(`missing_scenario_receipt:${scenarioId}`);
}

for (const row of rows) {
  if (!expectedScenarioIds.has(row.scenarioId)) issues.push(`unknown_scenario_receipt:${row.scenarioId}`);
  if (!allowedStatuses.includes(row.observedStatus)) issues.push(`invalid_observed_status:${row.scenarioId}:${row.observedStatus}`);
  if (row.ruleEnabled !== false) issues.push(`rule_enabled_not_allowed:${row.scenarioId}`);
  if (row.accepted !== false) issues.push(`accepted_not_allowed:${row.scenarioId}`);
  if (row.productAcceptanceClaimed !== false) issues.push(`product_acceptance_not_allowed:${row.scenarioId}`);
  if (row.packagingGated !== true) issues.push(`packaging_gate_must_remain_closed:${row.scenarioId}`);

  const forbiddenHits = includesForbiddenText(
    {
      observedStatus: row.observedStatus,
      observedNotes: row.observedNotes,
      blockerQuestions: row.blockerQuestions,
      nextReviewNotes: row.nextReviewNotes
    },
    forbiddenTransitions
  );
  if (forbiddenHits.length > 0) issues.push(`forbidden_transition_text:${row.scenarioId}:${forbiddenHits.join("|")}`);

  const hasEvidence = Array.isArray(row.observedEvidencePaths) && row.observedEvidencePaths.length > 0;
  const hasNotes = typeof row.observedNotes === "string" && row.observedNotes.trim().length > 0;
  const hasBlockers = Array.isArray(row.blockerQuestions) && row.blockerQuestions.length > 0;
  if (row.observedStatus === "matched_expected" && !hasEvidence && !hasNotes) {
    issues.push(`matched_expected_requires_evidence_or_notes:${row.scenarioId}`);
  }
  if (row.observedStatus === "blocker_found" && !hasBlockers && !hasNotes) {
    issues.push(`blocker_found_requires_blocker_or_notes:${row.scenarioId}`);
  }
  if (row.observedStatus === "needs_follow_up" && !hasNotes) {
    issues.push(`needs_follow_up_requires_notes:${row.scenarioId}`);
  }
}

const counts = {
  total: rows.length,
  matchedExpected: rows.filter((row) => row.observedStatus === "matched_expected").length,
  blockerFound: rows.filter((row) => row.observedStatus === "blocker_found").length,
  needsFollowUp: rows.filter((row) => row.observedStatus === "needs_follow_up").length,
  notRunYet: rows.filter((row) => row.observedStatus === "not_run_yet").length
};

const followUpQueue = rows
  .filter((row) => row.observedStatus !== "matched_expected")
  .map((row) => ({
    scenarioId: row.scenarioId,
    title: row.title,
    observedStatus: row.observedStatus,
    nextReviewNotes: row.nextReviewNotes || row.observedNotes || "",
    blockerQuestions: Array.isArray(row.blockerQuestions) ? row.blockerQuestions : [],
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }));

const validation = {
  responseMode: "transparent_ai_apprentice_manual_test_result_receipt_validation_v1",
  status: issues.length === 0 ? "manual_test_results_validated_for_follow_up" : "invalid_manual_test_result_receipt",
  generatedAt: new Date().toISOString(),
  readinessPackPath,
  receiptPath,
  counts,
  issues,
  followUpQueue,
  safetyBoundary: {
    reviewOnly: true,
    invokesModels: false,
    executesTargetSoftware: false,
    writesMemory: false,
    enablesRules: false,
    unlocksPackaging: false,
    claimsProductAcceptance: false,
    claimsCompletion: false
  },
  nextAction:
    issues.length === 0
      ? "Review blockers and not-run scenarios before any product acceptance, packaging, memory, or rule enablement decision."
      : "Fix invalid receipt rows and rerun validation before follow-up planning."
};

const validationPath = join(outputRoot, "manual-test-result-validation.json");
const markdownPath = join(outputRoot, "MANUAL_TEST_RESULT_VALIDATION.md");
const markdown = [
  "# Manual Test Result Validation",
  "",
  `Generated: ${validation.generatedAt}`,
  `Status: ${validation.status}`,
  "",
  "## Counts",
  "",
  ...Object.entries(counts).map(([name, value]) => `- ${name}: ${value}`),
  "",
  "## Issues",
  "",
  ...(issues.length > 0 ? issues.map((issue) => `- ${issue}`) : ["- none"]),
  "",
  "## Follow-Up Queue",
  "",
  ...(followUpQueue.length > 0
    ? followUpQueue.map((item) => `- ${item.scenarioId}: ${item.observedStatus} - ${item.nextReviewNotes || "needs review"}`)
    : ["- none"]),
  "",
  "## Boundary",
  "",
  "- Product acceptance claimed: false",
  "- Memory written: false",
  "- Rules enabled: false",
  "- Packaging unlocked: false",
  "- Completion claimed: false",
  ""
].join("\n");

writeJson(validationPath, validation);
writeText(markdownPath, markdown);

console.log(
  JSON.stringify(
    {
      responseMode: "transparent_ai_apprentice_manual_test_result_receipt_validation_result_v1",
      status: validation.status,
      generatedAt: validation.generatedAt,
      validationPath,
      markdownPath,
      counts,
      issueCount: issues.length,
      followUpCount: followUpQueue.length,
      nextAction: validation.nextAction
    },
    null,
    2
  )
);

if (issues.length > 0) {
  process.exit(1);
}
