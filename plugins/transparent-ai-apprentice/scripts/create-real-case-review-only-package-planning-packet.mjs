#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { listRuleFiles, loadRuleCard, sha256Object, validateRuleCard } from "./rules/rule-dsl-core.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function hashText(text) {
  return `sha256:${createHash("sha256").update(String(text)).digest("hex")}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  let parsed = null;
  let sourcePath = "";
  if (existsSync(text)) {
    sourcePath = resolve(text);
    parsed = readJson(sourcePath);
  } else if (text.startsWith("{")) {
    parsed = JSON.parse(text);
  }
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return { value: parsed, path: sourcePath };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function locks({ candidateCount = 0 } = {}) {
  return {
    reviewOnly: true,
    planningOnly: true,
    evidenceOnly: true,
    candidateRuleCount: candidateCount,
    transitionApplied: false,
    ruleFilesModified: false,
    reviewOnlyRulePackageCompiled: false,
    activeRulePackageCompiled: false,
    activePromotionAllowed: false,
    ruleEnabled: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const validationInput = readJsonInput(
  argValue("--lifecycle-validation", argValue("--review-validation", argValue("--validation", ""))),
  "--lifecycle-validation",
  "transparent_ai_real_case_lifecycle_candidate_review_validation_v1"
);
const rollbackPoint = resolve(argValue("--rollback-point", ""));
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-review-only-package-planning"))
);
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!teacherReviewed) throw new Error("REAL_CASE_REVIEW_ONLY_PACKAGE_PLANNING_REQUIRES_TEACHER_REVIEWED_FLAG");
if (!rollbackPoint || !existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint || "<missing>"}`);

const validation = validationInput.value;
const handoff = validation.reviewOnlyPackagePlanningHandoff;
if (
  validation.status !== "real_case_lifecycle_candidate_review_ready_for_review_only_package_planning" ||
  validation.readyForReviewOnlyPlanning !== true ||
  !handoff ||
  handoff.format !== "transparent_ai_real_case_review_only_lifecycle_candidate_handoff_v1" ||
  handoff.reviewOnlyLifecycleCandidateApproved !== true ||
  handoff.activePromotionAllowed !== false ||
  handoff.separateActiveGateRequired !== true ||
  handoff.executeNow !== false ||
  handoff.reviewOnly !== true ||
  validation.locks?.ruleEnabled !== false ||
  validation.locks?.activeRulePackageCompiled !== false ||
  validation.locks?.packagingUnlocked !== false
) {
  throw new Error("Lifecycle candidate review validation is not a locked handoff for review_only package planning.");
}

const ruleDir = resolve(handoff.ruleDir || "");
if (!ruleDir || !existsSync(ruleDir)) throw new Error(`REAL_CASE_REVIEW_ONLY_RULE_DIR_NOT_FOUND: ${handoff.ruleDir || ""}`);

const sourceCompiledPackage = handoff.compiledRulePackagePath && existsSync(handoff.compiledRulePackagePath)
  ? readJson(handoff.compiledRulePackagePath)
  : null;
const sourceCompiledRules = Array.isArray(sourceCompiledPackage?.rules) ? sourceCompiledPackage.rules : [];
const ruleFiles = listRuleFiles(ruleDir);
const errors = [];
const candidateRules = [];

for (const rulePath of ruleFiles) {
  try {
    const rule = loadRuleCard(rulePath);
    const validationResult = validateRuleCard(rule);
    const ruleHash = sha256Object(rule);
    if (!validationResult.ok) {
      errors.push(`RULE_DSL_VALIDATION_FAILED:${rule.rule_id || rulePath}`);
    }
    if (rule.lifecycle !== "draft_disabled") {
      errors.push(`RULE_MUST_REMAIN_DRAFT_DISABLED_BEFORE_REVIEW_ONLY_PLANNING:${rule.rule_id || rulePath}`);
    }
    candidateRules.push({
      ruleId: rule.rule_id,
      title: rule.title,
      sourceRulePath: rulePath,
      sourceRuleHash: ruleHash,
      sourceLifecycle: rule.lifecycle,
      proposedLifecycle: "review_only",
      transitionApplied: false,
      requiresSeparateTeacherReview: true,
      requiresSeparateActiveGate: true,
      severity: rule.severity,
      domain: rule.domain,
      evidenceRefs: rule.source?.evidence_refs || [],
      validatorType: rule.constraint?.type || "",
      dslValidationOk: validationResult.ok,
      dslValidationErrors: validationResult.errors || []
    });
  } catch (error) {
    errors.push(`RULE_LOAD_FAILED:${rulePath}:${error.message}`);
  }
}

if (!candidateRules.length) errors.push("NO_DRAFT_DISABLED_RULES_FOUND_FOR_REVIEW_ONLY_PLANNING");
if (sourceCompiledRules.some((rule) => rule.lifecycle === "active")) {
  errors.push("SOURCE_COMPILED_PACKAGE_CONTAINS_ACTIVE_RULES");
}
if (sourceCompiledRules.some((rule) => rule.lifecycle !== "draft_disabled")) {
  errors.push("SOURCE_COMPILED_PACKAGE_CONTAINS_NON_DRAFT_DISABLED_RULES");
}

const planningId = `real_case_review_only_package_plan.${new Date().toISOString().replace(/[:.]/g, "-")}`;
const planningDir = join(outRoot, planningId);
const packetPath = join(planningDir, "real-case-review-only-package-planning-packet.json");
const readmePath = join(planningDir, "REAL_CASE_REVIEW_ONLY_PACKAGE_PLANNING_START_HERE.md");
const htmlPath = join(planningDir, "real-case-review-only-package-planning.html");
const planLocks = locks({ candidateCount: candidateRules.length });
const status = errors.length
  ? "blocked_real_case_review_only_package_planning"
  : "ready_for_teacher_review_only_package_plan_review";

const packet = {
  ok: errors.length === 0,
  format: "transparent_ai_real_case_review_only_package_planning_packet_v1",
  planningId,
  createdAt: new Date().toISOString(),
  status,
  sourceLifecycleCandidateReviewValidationPath: validationInput.path,
  sourceLifecycleCandidateReviewValidationHash: hashText(JSON.stringify(validation)),
  teacherReviewed,
  rollbackPoint,
  reportId: handoff.reportId,
  caseType: handoff.caseType || "",
  plannedTransition: "draft_disabled_to_review_only_candidate",
  transitionApplied: false,
  ruleDir,
  validationReportPath: handoff.validationReportPath || "",
  sourceCompiledDraftDisabledRulePackagePath: handoff.compiledRulePackagePath || "",
  disabledRuleCountFromHandoff: handoff.disabledRuleCount || 0,
  lifecycleSkippedRowsFromHandoff: handoff.lifecycleSkippedRows || 0,
  candidateRules,
  errors,
  nextReview: {
    instruction:
      "Review this planning packet before any separate review_only lifecycle transition. This packet does not modify rule files or compile a review_only or active package.",
    mayApplyReviewOnlyLifecycleTransition: false,
    mayPromoteActiveRules: false,
    mayEnableRules: false,
    mayCompileActiveRulePackage: false,
    mayExecuteSoftware: false,
    mayFetchRag: false,
    mayWriteMemory: false,
    mayUnlockPackaging: false,
    requiresSeparateReviewOnlyTransitionGate: true,
    requiresSeparateActiveGate: true
  },
  blockedActions: [
    "apply_review_only_lifecycle_transition_from_planning_packet",
    "activate_rule_from_review_only_planning",
    "compile_active_package_from_review_only_planning",
    "execute_software_from_review_only_planning",
    "write_memory_from_review_only_planning",
    "fetch_rag_from_review_only_planning",
    "unlock_packaging_from_review_only_planning",
    "claim_completion_from_review_only_planning"
  ],
  locks: planLocks,
  paths: {
    packet: packetPath,
    readme: readmePath,
    html: htmlPath
  }
};

writeJson(packetPath, packet);
writeFileSync(
  readmePath,
  [
    "# Real-Case Review-Only Package Planning",
    "",
    `Status: ${status}`,
    `Candidate rules: ${candidateRules.length}`,
    "",
    "This packet is a planning artifact only. It does not change rule lifecycles, compile a review_only or active package, execute software, write memory, fetch RAG, unlock packaging, or claim completion.",
    "",
    `Packet JSON: ${packetPath}`,
    ""
  ].join("\n"),
  "utf8"
);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Real-Case Review-Only Package Planning</title></head>
<body>
<h1>Real-Case Review-Only Package Planning</h1>
<p>This is a planning packet only. No rule lifecycle transition has been applied.</p>
<pre>${JSON.stringify(packet, null, 2)}</pre>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: packet.ok,
      format: "transparent_ai_real_case_review_only_package_planning_packet_result_v1",
      status,
      packetPath,
      readmePath,
      htmlPath,
      candidateRuleCount: candidateRules.length,
      plannedTransition: packet.plannedTransition,
      transitionApplied: false,
      errors,
      executeNow: false,
      locks: planLocks
    },
    null,
    2
  )
);

if (errors.length) process.exit(1);
