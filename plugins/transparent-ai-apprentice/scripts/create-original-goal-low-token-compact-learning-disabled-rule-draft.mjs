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
    String(value || "compact-learning-disabled-rule-draft")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90) || "compact-learning-disabled-rule-draft"
  );
}

function ruleIdFor(row, index) {
  const base = slugify(`${row.software || "software"}-${row.rowId || index + 1}-${row.selectedTeacherLabel || "label"}`);
  const shortHash = hashText(JSON.stringify(row)).slice("sha256:".length, "sha256:".length + 8);
  return `original_goal.low_token.compact_learning.${base}.${shortHash}`;
}

function severityFor(label) {
  if (label === "failure_or_blocker") return "blocking";
  if (label === "warning") return "warning";
  return "info";
}

function labelMeaning(label) {
  return {
    success_or_completion: "Treat this compact metadata signal as a teacher-reviewed success or completion indicator within the stated boundary.",
    failure_or_blocker: "Treat this compact metadata signal as a teacher-reviewed failure or blocker indicator within the stated boundary.",
    warning: "Treat this compact metadata signal as a teacher-reviewed warning indicator within the stated boundary.",
    normal_state_change: "Treat this compact metadata signal as a teacher-reviewed normal state change indicator within the stated boundary."
  }[label] || "Teacher-reviewed compact metadata signal.";
}

function buildRule(row, validation, index) {
  const ruleId = ruleIdFor(row, index);
  return {
    dsl_version: "0.1",
    rule_id: ruleId,
    title: `Disabled compact learning draft: ${row.software || "software"} ${row.selectedTeacherLabel}`,
    domain: "all-software-low-token-learning",
    lifecycle: "draft_disabled",
    severity: severityFor(row.selectedTeacherLabel),
    owner: {
      teacher_id: "teacher.local",
      reviewer_id: null,
      approved_at: null
    },
    source: {
      type: "teacher_reviewed_compact_metadata_learning_event",
      evidence_refs: [
        validation.handoffPath || "",
        validation.sourceCompactLearningEventsPath || "",
        validation.receiptPath || "",
        validation.validationPath || ""
      ].filter(Boolean),
      natural_language: [
        labelMeaning(row.selectedTeacherLabel),
        `Boundary: ${row.ruleBoundaryNote}`,
        `Counterexample: ${row.counterexampleNote}`
      ].join("\n")
    },
    scope: {
      artifact_types: ["low_token_compact_evidence_event"],
      applies_when: {
        software: row.software || "",
        evidenceMode: row.evidenceMode || "",
        compactEvidenceHash: row.compactEvidenceHash || ""
      }
    },
    inputs_required: ["software", "evidenceMode", "compactEvidenceHash", "teacherReviewedBoundary"],
    constraint: {
      type: "policy_gate",
      gate: "teacher_reviewed_compact_metadata_logic_contract",
      sourceRowId: row.rowId || "",
      selectedTeacherLabel: row.selectedTeacherLabel,
      expectedBoundary: row.ruleBoundaryNote,
      counterexample: row.counterexampleNote,
      highReasoningReviewRequiredBeforeActivation: true
    },
    failure: {
      message: "Compact metadata learning draft is not satisfied or is outside the teacher-reviewed boundary.",
      action: "request_teacher_review",
      remediation_hint: "Send the row back to high-reasoning repair with teacher counterexamples before any activation or memory write."
    },
    audit: {
      created_by: "ai",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rule_version: "0.1.0"
    }
  };
}

const validationPath = resolve(argValue("--validation", ""));
const rollbackPoint = resolve(argValue("--rollback-point", ""));
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-compact-learning-disabled-rule-drafts")
  )
);
const teacherReviewedLearningEvents = hasFlag("--teacher-reviewed-learning-events");

if (!validationPath) {
  throw new Error(
    "Usage: node create-original-goal-low-token-compact-learning-disabled-rule-draft.mjs --validation <validation.json> --rollback-point <rollback-point-dir> --teacher-reviewed-learning-events [--output-dir <dir>]"
  );
}
if (!teacherReviewedLearningEvents) throw new Error("COMPACT_LEARNING_DISABLED_RULE_DRAFT_REQUIRES_TEACHER_REVIEWED_LEARNING_EVENTS_FLAG");
if (!existsSync(validationPath)) throw new Error(`VALIDATION_NOT_FOUND: ${validationPath}`);
if (!rollbackPoint || !existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint}`);

const validation = readJson(validationPath);
if (validation.format !== "transparent_ai_original_goal_low_token_compact_evidence_learning_review_receipt_validation_v1") {
  throw new Error("Expected transparent_ai_original_goal_low_token_compact_evidence_learning_review_receipt_validation_v1.");
}
if (
  validation.status !== "validated_for_disabled_rule_draft_or_high_reasoning_repair" ||
  validation.readyForDisabledRuleDraft !== true ||
  validation.locks?.ruleEnabled !== false ||
  validation.locks?.memoryEnabled !== false ||
  validation.locks?.targetSoftwareCommandsExecuted !== false ||
  validation.locks?.goalComplete !== false
) {
  throw new Error("Learning review validation is not ready for locked disabled rule draft generation.");
}

const readyRows = Array.isArray(validation.readyRuleDraftRows) ? validation.readyRuleDraftRows : [];
if (!readyRows.length) throw new Error("NO_READY_RULE_DRAFT_ROWS");

const packageId = stableId("original_goal_low_token_compact_learning_disabled_rule_draft", `${validationPath}:${rollbackPoint}`);
const packageDir = join(outputRoot, packageId);
const stagedRulesDir = join(packageDir, "staged-draft-disabled-rules");
const compileOutDir = join(packageDir, "compiled-disabled-rule-package");
mkdirSync(stagedRulesDir, { recursive: true });

const errors = [];
const stagedRules = [];
for (const [index, row] of readyRows.entries()) {
  const rule = buildRule(row, { ...validation, validationPath }, index);
  const ruleValidation = validateRuleCard(rule);
  if (!ruleValidation.ok) {
    errors.push(...ruleValidation.errors.map((error) => ({ ...error, sourceRowId: row.rowId || "", ruleId: rule.rule_id })));
    continue;
  }
  if (rule.lifecycle !== "draft_disabled") errors.push({ error_code: "RULE_MUST_REMAIN_DRAFT_DISABLED", ruleId: rule.rule_id });
  const rulePath = join(stagedRulesDir, `${slugify(rule.rule_id)}.json`);
  writeJson(rulePath, rule);
  stagedRules.push({
    sourceRowId: row.rowId || "",
    software: row.software || "",
    teacherLabel: row.selectedTeacherLabel || "",
    ruleId: rule.rule_id,
    rulePath,
    ruleHash: hashText(JSON.stringify(rule)),
    lifecycle: rule.lifecycle,
    severity: rule.severity,
    requiresHighReasoningReview: true,
    requiresTeacherAcceptance: true,
    draftEnabled: false,
    memoryWriteAllowed: false,
    executionAllowed: false,
    packagingGated: true
  });
}

if (errors.length) {
  const blockedPath = join(packageDir, "original-goal-low-token-compact-learning-disabled-rule-draft.json");
  const blocked = {
    format: "transparent_ai_original_goal_low_token_compact_learning_disabled_rule_draft_v1",
    packageId,
    createdAt: new Date().toISOString(),
    status: "blocked_rule_draft_validation_failed",
    validationPath,
    rollbackPoint,
    errors,
    stagedRules,
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      draftRulesEnabled: false,
      memoryEnabled: false,
      softwareActionsExecuted: false,
      activeRulePackageCompiled: false,
      packagingGated: true,
      packagingUnlocked: false,
      goalComplete: false
    }
  };
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
const activeRules = (compiledPackage.rules || []).filter((rule) => rule.lifecycle === "active");
const nonDisabledRules = (compiledPackage.rules || []).filter((rule) => rule.lifecycle !== "draft_disabled");
if (activeRules.length || nonDisabledRules.length) throw new Error("COMPACT_LEARNING_DRAFT_PACKAGE_MUST_CONTAIN_ONLY_DRAFT_DISABLED_RULES");

const packet = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_learning_disabled_rule_draft_v1",
  packageId,
  createdAt: new Date().toISOString(),
  status: "ready_for_teacher_disabled_rule_draft_review",
  validationPath,
  validationHash: hashText(JSON.stringify(validation)),
  rollbackPoint,
  teacherReviewedLearningEvents,
  stagedRules,
  disabledRuleCount: stagedRules.length,
  highReasoningRepairQueue: Array.isArray(validation.highReasoningRepairRows) ? validation.highReasoningRepairRows : [],
  ignoredRows: Array.isArray(validation.ignoredRows) ? validation.ignoredRows : [],
  compiledRulePackagePath: compileResult.packagePath,
  compileReportPath: compileResult.compileReportPath,
  lockPath: compileResult.lockPath,
  executedCommand: {
    kind: "node_spawn_no_shell",
    executable: process.execPath,
    argv: compileArgs
  },
  nextReview: {
    instruction:
      "Review these draft_disabled rules with high reasoning before any separate lifecycle promotion, memory write, or software execution request.",
    mayPromoteRules: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteSoftware: false,
    mayRegisterSchedule: false,
    mayUnlockPackaging: false,
    highReasoningRepairQueueCount: Array.isArray(validation.highReasoningRepairRows) ? validation.highReasoningRepairRows.length : 0
  },
  locks: {
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
    scheduledTaskInstalled: false,
    packagingGated: true,
    packagingUnlocked: false,
    goalComplete: false
  },
  executeNow: false,
  goalComplete: false
};

const packetPath = join(packageDir, "original-goal-low-token-compact-learning-disabled-rule-draft.json");
writeJson(packetPath, packet);
writeFileSync(
  join(packageDir, "ORIGINAL_GOAL_LOW_TOKEN_COMPACT_LEARNING_DISABLED_RULE_DRAFT_START_HERE.md"),
  [
    "# Original Goal Low-Token Compact Learning Disabled Rule Draft",
    "",
    `Status: ${packet.status}`,
    `Disabled rule drafts: ${packet.disabledRuleCount}`,
    `High-reasoning repair queue: ${packet.nextReview.highReasoningRepairQueueCount}`,
    "",
    "The compiled package contains only draft_disabled rules. It does not enable rules, write memory, execute software, register schedules, unlock packaging, or claim completion.",
    `Rule package: ${packet.compiledRulePackagePath}`
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
      highReasoningRepairQueueCount: packet.nextReview.highReasoningRepairQueueCount,
      locks: packet.locks,
      executeNow: false,
      goalComplete: false
    },
    null,
    2
  )
);
