#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRuleCard } from "./rules/rule-dsl-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormats = []) {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormats.length && !expectedFormats.includes(parsed.value?.format)) {
    throw new Error(`${label} must be one of ${expectedFormats.join(", ")}`);
  }
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashText(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function stableId(prefix, seed = "") {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = hashText(seed || stamp).slice("sha256:".length, "sha256:".length + 10);
  return `${prefix}.${stamp}.${suffix}`;
}

function slugify(value) {
  return (
    String(value || "transparent-sketch-logic-contract")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 96) || "transparent-sketch-logic-contract"
  );
}

function locks() {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    draftRulesEnabled: false,
    disabledRulePackageCompiled: true,
    activeRulePackageCompiled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    scheduledTaskInstalled: false,
    packagingGated: true,
    packagingUnlocked: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function severityForCategory(category) {
  const text = String(category || "").toLowerCase();
  if (text.includes("depth") || text.includes("perspective") || text.includes("position")) return "blocking";
  if (text.includes("angular") || text.includes("curvature")) return "warning";
  return "info";
}

function categoryToScope(category) {
  const text = String(category || "").toLowerCase();
  if (text.includes("position") || text.includes("alignment") || text.includes("relation")) return "position_alignment_relation";
  if (text.includes("angular") || text.includes("angle") || text.includes("curvature")) return "angle_direction_curvature";
  if (text.includes("depth") || text.includes("perspective") || text.includes("view")) return "view_depth_perspective";
  if (text.includes("semantic") || text.includes("annotation") || text.includes("standard")) return "semantic_annotation_standard";
  return "universal_detail_logic";
}

function sourceEvidenceSummary(row) {
  const evidence = row.sourceEvidence || {};
  return JSON.stringify(evidence).slice(0, 900);
}

function buildRule({ row, interpretation, sourcePath, index }) {
  const scope = categoryToScope(row.detailCategory);
  const ruleId = `transparent_sketch.logic_contract.${scope}.${slugify(row.id || row.sourceElementId || index + 1)}.${hashText(JSON.stringify(row)).slice("sha256:".length, "sha256:".length + 8)}`;
  const classification = row.classification || "missing_evidence_blocks_execution";
  const missingBlocks = classification === "missing_evidence_blocks_execution" || row.blocksExecutionIfMissing === true && !row.logicSource;
  return {
    dsl_version: "0.1",
    rule_id: ruleId,
    title: `Draft transparent sketch logic contract: ${scope}`,
    domain: "transparent-sketch-spatial-intent",
    lifecycle: "draft_disabled",
    severity: missingBlocks ? "blocking" : severityForCategory(row.detailCategory),
    owner: {
      teacher_id: "teacher.local",
      reviewer_id: null,
      approved_at: null
    },
    source: {
      type: "teacher_reviewed_transparent_sketch_spatial_intent",
      evidence_refs: [sourcePath, interpretation.sourceOverlayPacket || ""].filter(Boolean),
      natural_language: [
        "Transparent sketch details must be logicized before any software execution.",
        `Software: ${interpretation.software || ""}`,
        `Goal: ${interpretation.goal || ""}`,
        `Detail category: ${row.detailCategory || ""}`,
        `Classification: ${classification}`,
        `Logic source: ${row.logicSource || ""}`,
        `Source evidence: ${sourceEvidenceSummary(row)}`
      ].join("\n")
    },
    scope: {
      artifact_types: ["transparent_sketch_spatial_intent", "spatial_execution_route"],
      applies_when: {
        sourceElementId: row.sourceElementId || "",
        detailCategory: row.detailCategory || "",
        scope
      }
    },
    inputs_required: [
      "teacherReviewedTransparentSketchPacket",
      "spatialIntentInterpretation",
      "universalDetailLogicContract",
      "teacherConfirmedNumberedTarget"
    ],
    constraint: {
      type: "policy_gate",
      gate: "transparent_sketch_detail_logic_contract_before_execution",
      sourceElementId: row.sourceElementId || "",
      detailCategory: row.detailCategory || "",
      classification,
      logicSource: row.logicSource || "",
      blocksExecutionIfMissing: row.blocksExecutionIfMissing !== false,
      visualSimilarityAloneAllowed: false,
      requiresTeacherReviewBeforeActivation: true,
      requiresHighReasoningRepairBeforeExecutionIfMissing: true
    },
    failure: {
      message: "Transparent sketch spatial intent has a consequential detail without a reviewed logic source.",
      action: "block_execute_and_route_to_teacher_review",
      remediation_hint:
        "Ask the teacher to provide data, formula, constraint, reference, exception, or decorative/non-parametric classification for this detail."
    },
    audit: {
      created_by: "ai",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rule_version: "0.1.0"
    }
  };
}

const interpretationInput =
  argValue("--spatial-intent", "") ||
  argValue("--interpretation", "");
const rehearsalInput = argValue("--rehearsal", "");
const rollbackPoint = resolve(argValue("--rollback-point", ""));
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "transparent-sketch-logic-contract-rule-drafts")
  )
);
const teacherReviewedSpatialIntent = hasFlag("--teacher-reviewed-spatial-intent");

if (!teacherReviewedSpatialIntent) throw new Error("TRANSPARENT_SKETCH_RULE_DRAFT_REQUIRES_TEACHER_REVIEWED_SPATIAL_INTENT_FLAG");
if (!rollbackPoint || !existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint}`);

let source = null;
if (interpretationInput) {
  source = readJsonInput(interpretationInput, "--spatial-intent", ["transparent_ai_spatial_intent_interpretation_v1"]);
} else if (rehearsalInput) {
  const rehearsal = readJsonInput(rehearsalInput, "--rehearsal", ["transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1"]);
  const spatialPath = rehearsal.value.paths?.spatialIntent || rehearsal.value.spatialIntent || "";
  if (!spatialPath || !existsSync(spatialPath)) throw new Error("REHEARSAL_SPATIAL_INTENT_NOT_FOUND");
  source = { value: readJson(spatialPath), path: resolve(spatialPath) };
} else {
  throw new Error("Provide --spatial-intent <spatial-intent-interpretation.json> or --rehearsal <rehearsal.json>.");
}

const interpretation = source.value;
const contract = interpretation.detailLogicContract || {};
if (interpretation.format !== "transparent_ai_spatial_intent_interpretation_v1") {
  throw new Error("Expected transparent_ai_spatial_intent_interpretation_v1.");
}
if (contract.format !== "transparent_ai_universal_detail_logic_contract_v1") {
  throw new Error("SPATIAL_INTENT_MISSING_UNIVERSAL_DETAIL_LOGIC_CONTRACT");
}

const rows = Array.isArray(contract.consequentialDetailRows) ? contract.consequentialDetailRows : [];
if (!rows.length) throw new Error("NO_CONSEQUENTIAL_DETAIL_LOGIC_ROWS");
const requiredScopes = new Set(rows.map((row) => categoryToScope(row.detailCategory)));
const missingRequiredScopes = ["position_alignment_relation", "angle_direction_curvature", "view_depth_perspective"].filter(
  (scope) => !requiredScopes.has(scope)
);

const packageId = stableId("transparent_sketch_logic_contract_rule_draft", `${source.path}:${rollbackPoint}`);
const packageDir = join(outputRoot, packageId);
const stagedRulesDir = join(packageDir, "staged-draft-disabled-rules");
const compileOutDir = join(packageDir, "compiled-disabled-rule-package");
mkdirSync(stagedRulesDir, { recursive: true });

const errors = [];
if (missingRequiredScopes.length) {
  errors.push({ error_code: "MISSING_REQUIRED_TRANSPARENT_SKETCH_LOGIC_SCOPE", missingRequiredScopes });
}
if (contract.missingLogicSourceBehavior !== "block_execute_and_route_to_teacher_review") {
  errors.push({ error_code: "DETAIL_LOGIC_CONTRACT_MUST_BLOCK_MISSING_LOGIC_SOURCE" });
}

const stagedRules = [];
for (const [index, row] of rows.entries()) {
  const rule = buildRule({ row, interpretation, sourcePath: source.path, index });
  const validation = validateRuleCard(rule);
  if (!validation.ok) {
    errors.push(...validation.errors.map((error) => ({ ...error, sourceRowId: row.id || row.sourceElementId || "", ruleId: rule.rule_id })));
    continue;
  }
  if (rule.lifecycle !== "draft_disabled") errors.push({ error_code: "RULE_MUST_REMAIN_DRAFT_DISABLED", ruleId: rule.rule_id });
  const rulePath = join(stagedRulesDir, `${slugify(rule.rule_id)}.json`);
  writeJson(rulePath, rule);
  stagedRules.push({
    sourceRowId: row.id || "",
    sourceElementId: row.sourceElementId || "",
    detailCategory: row.detailCategory || "",
    classification: row.classification || "",
    scope: categoryToScope(row.detailCategory),
    ruleId: rule.rule_id,
    rulePath,
    ruleHash: hashText(JSON.stringify(rule)),
    lifecycle: rule.lifecycle,
    severity: rule.severity,
    draftEnabled: false,
    memoryWriteAllowed: false,
    executionAllowed: false,
    requiresTeacherAcceptance: true,
    requiresHighReasoningReview: true,
    packagingGated: true
  });
}

if (errors.length) {
  const blocked = {
    ok: false,
    format: "transparent_ai_transparent_sketch_logic_contract_rule_draft_v1",
    packageId,
    createdAt: new Date().toISOString(),
    status: "blocked_transparent_sketch_logic_contract_rule_draft_validation_failed",
    spatialIntentPath: source.path,
    rollbackPoint,
    errors,
    stagedRules,
    locks: { ...locks(), disabledRulePackageCompiled: false }
  };
  const blockedPath = join(packageDir, "transparent-sketch-logic-contract-rule-draft.json");
  writeJson(blockedPath, blocked);
  console.log(JSON.stringify({ ok: false, status: blocked.status, packagePath: blockedPath, errors, locks: blocked.locks }, null, 2));
  process.exit(1);
}

const compileArgs = [
  join(pluginRoot, "scripts", "rules", "compile-rule-package.mjs"),
  "--rules",
  stagedRulesDir,
  "--package-id",
  packageId,
  "--out-dir",
  compileOutDir
];
const compileRun = spawnSync(process.execPath, compileArgs, { cwd: repoRoot, encoding: "utf8", timeout: 120000 });
if (compileRun.status !== 0) {
  throw new Error(`compile-rule-package.mjs failed:\nSTDOUT:\n${compileRun.stdout}\nSTDERR:\n${compileRun.stderr}`);
}
const compileResult = JSON.parse(compileRun.stdout);
const compiledPackage = readJson(compileResult.packagePath);
if ((compiledPackage.rules || []).some((rule) => rule.lifecycle !== "draft_disabled")) {
  throw new Error("TRANSPARENT_SKETCH_RULE_DRAFT_PACKAGE_MUST_CONTAIN_ONLY_DRAFT_DISABLED_RULES");
}

const lockState = locks();
const packet = {
  ok: true,
  format: "transparent_ai_transparent_sketch_logic_contract_rule_draft_v1",
  packageId,
  createdAt: new Date().toISOString(),
  status: "ready_for_teacher_transparent_sketch_logic_contract_rule_draft_review",
  spatialIntentPath: source.path,
  spatialIntentHash: hashText(JSON.stringify(interpretation)),
  rollbackPoint,
  teacherReviewedSpatialIntent,
  detailLogicContractSummary: {
    format: contract.format,
    consequentialDetailRows: rows.length,
    missingDetailLogicRows: Array.isArray(contract.missingDetailLogicRows) ? contract.missingDetailLogicRows.length : 0,
    missingDetailLogicCount: Number(contract.missingDetailLogicCount || 0),
    missingLogicSourceBehavior: contract.missingLogicSourceBehavior,
    requiredScopes: [...requiredScopes].sort()
  },
  stagedRules,
  disabledRuleCount: stagedRules.length,
  compiledRulePackagePath: compileResult.packagePath,
  compileReportPath: compileResult.compileReportPath,
  lockPath: compileResult.lockPath,
  nextReview: {
    instruction:
      "Review these draft_disabled transparent sketch logic rules before any spatial execution route, memory write, or lifecycle promotion.",
    mayPromoteRules: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteSoftware: false,
    mayCaptureScreenshots: false,
    mayUnlockPackaging: false,
    highReasoningReviewRequired: true
  },
  blockedActions: [
    "execute_from_visual_similarity",
    "enable_transparent_sketch_rules_now",
    "write_spatial_learning_memory_now",
    "capture_screenshot_from_rule_draft",
    "claim_transparent_sketch_goal_complete",
    "unlock_packaging"
  ],
  locks: lockState,
  executeNow: false,
  goalComplete: false
};

const packetPath = join(packageDir, "transparent-sketch-logic-contract-rule-draft.json");
writeJson(packetPath, packet);
writeFileSync(
  join(packageDir, "TRANSPARENT_SKETCH_LOGIC_CONTRACT_RULE_DRAFT_START_HERE.md"),
  [
    "# Transparent Sketch Logic Contract Rule Draft",
    "",
    `Status: ${packet.status}`,
    `Disabled rule drafts: ${packet.disabledRuleCount}`,
    `Spatial intent: ${packet.spatialIntentPath}`,
    `Compiled package: ${packet.compiledRulePackagePath}`,
    "",
    "This package converts 2D position, angle/direction, perspective, 3D depth, and universal detail logic rows into draft_disabled Rule DSL cards.",
    "It does not enable rules, execute target software, capture screenshots, write memory, unlock packaging, or claim completion."
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      status: packet.status,
      packagePath: packetPath,
      compiledRulePackagePath: packet.compiledRulePackagePath,
      disabledRuleCount: packet.disabledRuleCount,
      requiredScopes: packet.detailLogicContractSummary.requiredScopes,
      locks: packet.locks,
      executeNow: false,
      goalComplete: false
    },
    null,
    2
  )
);
