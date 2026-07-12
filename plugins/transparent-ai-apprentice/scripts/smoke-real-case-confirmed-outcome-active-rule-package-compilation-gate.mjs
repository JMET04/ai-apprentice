#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const activePromotionSmokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-active-promotion-review-gate");
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-active-rule-package-compilation-gate");
mkdirSync(smokeRoot, { recursive: true });
const expectedSourceReviewFormat = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function runNode(args, { expectOk = true } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (expectOk && result.status !== 0) throw new Error(result.stderr || result.stdout || args.join(" "));
  if (!expectOk && result.status === 0) throw new Error(`Expected failure: ${args.join(" ")}`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function findFiles(rootDir, fileName) {
  const output = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!existsSync(current)) continue;
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) stack.push(join(current, entry));
    } else if (current.endsWith(fileName)) {
      output.push(current);
    }
  }
  output.sort();
  return output;
}

function latestFile(rootDir, fileName) {
  const files = findFiles(rootDir, fileName);
  if (!files.length) throw new Error(`Missing ${fileName} under ${rootDir}`);
  files.sort((left, right) => statSync(left).mtimeMs - statSync(right).mtimeMs || left.localeCompare(right));
  return files[files.length - 1];
}

function listJsonFiles(rootDir) {
  return findFiles(rootDir, ".json");
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const activePromotionSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-active-promotion-review-gate.mjs"]).stdout
);
const validationPath = latestFile(
  join(activePromotionSmokeRoot, "approve-validation"),
  "real-case-confirmed-outcome-active-promotion-review-validation.json"
);
const validation = readJson(validationPath);
const transitionPackagePath = validation.activePromotionPlanningHandoff.transitionPackagePath;
const transitionPackage = readJson(transitionPackagePath);
const rollbackPoint = transitionPackage.rollbackPoint;

const compilation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-rule-package-compilation-gate.mjs",
    "--active-promotion-validation",
    validationPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "compilation")
  ]).stdout
);
const compilationPacket = readJson(compilation.compilationPath);
const activeRulePackage = readJson(compilation.compiledActiveRulePackagePath);
const reviewOnlyRulesAfter = listJsonFiles(transitionPackage.stagedRulesDir).map(readJson);

check(
  "Real-case confirmed outcome active rule package compilation gate compiles active copies only",
  compilation.format === "transparent_ai_real_case_confirmed_outcome_active_rule_package_compilation_result_v1" &&
    compilation.status === "ready_for_teacher_active_rule_package_validation_report_review" &&
    compilation.confirmedOutcomeBranch === true &&
    compilation.sourceReviewFormat === expectedSourceReviewFormat &&
    compilation.sourceConfirmedOutcomeReviewId === validation.sourceConfirmedOutcomeReviewId &&
    compilation.sourceConfirmedOutcomeSourceRunId === validation.sourceConfirmedOutcomeSourceRunId &&
    compilation.sourceRunId === validation.sourceRunId &&
    compilation.locks?.activeRulePackageCompiled === true &&
    compilation.locks?.ruleEnabled === false &&
    compilation.locks?.targetSoftwareCommandsExecuted === false &&
    compilation.locks?.packagingUnlocked === false &&
    compilationPacket.format === "transparent_ai_real_case_confirmed_outcome_active_rule_package_compilation_v1" &&
    compilationPacket.confirmedOutcomeBranch === true &&
    compilationPacket.sourceReviewFormat === expectedSourceReviewFormat &&
    compilationPacket.sourceConfirmedOutcomeReviewId === validation.sourceConfirmedOutcomeReviewId &&
    compilationPacket.sourceConfirmedOutcomeSourceRunId === validation.sourceConfirmedOutcomeSourceRunId &&
    compilationPacket.sourceRunId === validation.sourceRunId &&
    compilationPacket.activeRuleCount >= 1,
  JSON.stringify({ compilationPath: compilation.compilationPath, compiledActiveRulePackagePath: compilation.compiledActiveRulePackagePath })
);

check(
  "Real-case confirmed outcome active rule package contains only active rules and preserves review-only sources",
  activeRulePackage.rules.length === compilationPacket.activeRuleCount &&
    activeRulePackage.rules.every((rule) => rule.lifecycle === "active") &&
    activeRulePackage.rules.every((rule) => rule.owner?.reviewer_id && rule.owner?.approved_at) &&
    reviewOnlyRulesAfter.length === compilationPacket.activeRuleCount &&
    reviewOnlyRulesAfter.every((rule) => rule.lifecycle === "review_only") &&
    transitionPackage.sourceRuleFilesModified === false,
  JSON.stringify({
    activeLifecycles: activeRulePackage.rules.map((rule) => rule.lifecycle),
    reviewOnlyLifecycles: reviewOnlyRulesAfter.map((rule) => rule.lifecycle)
  })
);

const sourceTamperedValidationPath = writeJson(join(smokeRoot, "source-tampered-active-promotion-validation.json"), {
  ...validation,
  sourceReviewFormat: "transparent_ai_real_case_unconfirmed_outcome_review_v1"
});
const sourceTampered = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-rule-package-compilation-gate.mjs",
    "--active-promotion-validation",
    sourceTamperedValidationPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "source-tampered")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active rule package compilation blocks lost confirmed-outcome source continuity",
  sourceTampered.stderr.includes("ACTIVE_RULE_PACKAGE_SOURCE_FORMAT_MISMATCH") ||
    sourceTampered.stdout.includes("ACTIVE_RULE_PACKAGE_SOURCE_FORMAT_MISMATCH"),
  sourceTampered.stderr || sourceTampered.stdout
);

const sourceRunTamperedValidationPath = writeJson(join(smokeRoot, "source-run-tampered-active-promotion-validation.json"), {
  ...validation,
  sourceConfirmedOutcomeSourceRunId: "tampered-source-run-id"
});
const sourceRunTampered = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-rule-package-compilation-gate.mjs",
    "--active-promotion-validation",
    sourceRunTamperedValidationPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "source-run-tampered")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active rule package compilation blocks tampered source run continuity",
  sourceRunTampered.stderr.includes("ACTIVE_RULE_PACKAGE_SOURCE_IDS_MISSING_OR_MISMATCHED") ||
    sourceRunTampered.stdout.includes("ACTIVE_RULE_PACKAGE_SOURCE_IDS_MISSING_OR_MISMATCHED"),
  sourceRunTampered.stderr || sourceRunTampered.stdout
);

const missingSourceRunIdValidationPath = writeJson(join(smokeRoot, "missing-source-run-id-active-promotion-validation.json"), {
  ...validation,
  sourceRunId: ""
});
const missingSourceRunId = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-rule-package-compilation-gate.mjs",
    "--active-promotion-validation",
    missingSourceRunIdValidationPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "missing-source-run-id")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active rule package compilation blocks missing sourceRunId",
  missingSourceRunId.stderr.includes("ACTIVE_RULE_PACKAGE_SOURCE_IDS_MISSING_OR_MISMATCHED") ||
    missingSourceRunId.stdout.includes("ACTIVE_RULE_PACKAGE_SOURCE_IDS_MISSING_OR_MISMATCHED"),
  missingSourceRunId.stderr || missingSourceRunId.stdout
);

const noTeacher = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-rule-package-compilation-gate.mjs",
    "--active-promotion-validation",
    validationPath,
    "--rollback-point",
    rollbackPoint,
    "--out-dir",
    join(smokeRoot, "no-teacher")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active rule package compilation requires teacher-reviewed flag",
  noTeacher.stderr.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_RULE_PACKAGE_COMPILATION_REQUIRES_TEACHER_REVIEWED_FLAG") ||
    noTeacher.stdout.includes("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_RULE_PACKAGE_COMPILATION_REQUIRES_TEACHER_REVIEWED_FLAG"),
  noTeacher.stderr || noTeacher.stdout
);

const nonReadyValidationPath = writeJson(join(smokeRoot, "non-ready-active-promotion-validation.json"), {
  ...validation,
  status: "real_case_confirmed_outcome_active_promotion_review_needs_teacher_review",
  readyForActivePromotionPlanning: false
});
const nonReady = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-active-rule-package-compilation-gate.mjs",
    "--active-promotion-validation",
    nonReadyValidationPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "non-ready")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome active rule package compilation rejects non-approved active promotion validation",
  nonReady.stderr.includes("locked planning handoff") || nonReady.stdout.includes("locked planning handoff"),
  nonReady.stderr || nonReady.stdout
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_active_rule_package_compilation_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  activePromotionSmokeStatus: activePromotionSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);

