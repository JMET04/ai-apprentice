#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const lifecycleSmokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-lifecycle-candidate-review-gate");
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-review-only-package-planning");
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
  return files[files.length - 1];
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const lifecycleSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-lifecycle-candidate-review-gate.mjs"]).stdout
);
const approveValidationPath = latestFile(
  join(lifecycleSmokeRoot, "approve-validation"),
  "real-case-confirmed-outcome-lifecycle-candidate-review-validation.json"
);
const approveValidation = readJson(approveValidationPath);
const repairValidationPath = latestFile(
  join(lifecycleSmokeRoot, "repair-validation"),
  "real-case-confirmed-outcome-lifecycle-candidate-review-validation.json"
);
const rollbackDir = join(smokeRoot, "rollback");
mkdirSync(rollbackDir, { recursive: true });
writeJson(join(rollbackDir, "rollback-anchor.json"), {
  format: "transparent_ai_real_case_confirmed_outcome_review_only_package_planning_smoke_rollback_anchor_v1",
  createdAt: new Date().toISOString()
});

const planningResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-review-only-package-planning-packet.mjs",
    "--lifecycle-validation",
    approveValidationPath,
    "--rollback-point",
    rollbackDir,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "planning")
  ]).stdout
);
const packet = readJson(planningResult.packetPath);

check(
  "Real-case confirmed outcome review-only package planning packet stages lifecycle candidates without applying transition",
  planningResult.format === "transparent_ai_real_case_confirmed_outcome_review_only_package_planning_packet_result_v1" &&
    planningResult.status === "ready_for_teacher_review_only_package_plan_review" &&
    planningResult.confirmedOutcomeBranch === true &&
    planningResult.sourceReviewFormat === expectedSourceReviewFormat &&
    planningResult.sourceConfirmedOutcomeReviewId === approveValidation.sourceConfirmedOutcomeReviewId &&
    planningResult.sourceConfirmedOutcomeSourceRunId === approveValidation.sourceConfirmedOutcomeSourceRunId &&
    planningResult.sourceRunId === approveValidation.sourceRunId &&
    planningResult.candidateRuleCount >= 1 &&
    planningResult.transitionApplied === false &&
    planningResult.locks?.transitionApplied === false &&
    planningResult.locks?.ruleFilesModified === false &&
    planningResult.locks?.reviewOnlyRulePackageCompiled === false &&
    planningResult.locks?.activeRulePackageCompiled === false &&
    planningResult.locks?.ruleEnabled === false &&
    planningResult.locks?.packagingUnlocked === false,
  JSON.stringify({ packetPath: planningResult.packetPath, candidateRuleCount: planningResult.candidateRuleCount })
);

check(
  "Real-case confirmed outcome review-only package planning preserves draft-disabled source rules",
  packet.format === "transparent_ai_real_case_confirmed_outcome_review_only_package_planning_packet_v1" &&
    packet.confirmedOutcomeBranch === true &&
    packet.sourceReviewFormat === expectedSourceReviewFormat &&
    packet.sourceConfirmedOutcomeReviewId === planningResult.sourceConfirmedOutcomeReviewId &&
    packet.sourceConfirmedOutcomeSourceRunId === planningResult.sourceConfirmedOutcomeSourceRunId &&
    packet.sourceRunId === planningResult.sourceRunId &&
    packet.candidateRules.every(
      (row) =>
        row.sourceLifecycle === "draft_disabled" &&
        row.proposedLifecycle === "review_only" &&
        row.transitionApplied === false &&
        row.requiresSeparateTeacherReview === true &&
        row.requiresSeparateActiveGate === true &&
        row.dslValidationOk === true
    ) &&
    packet.nextReview?.mayApplyReviewOnlyLifecycleTransition === false &&
    packet.nextReview?.requiresSeparateReviewOnlyTransitionGate === true,
  JSON.stringify(packet.candidateRules.slice(0, 2))
);

const tamperedSourceValidation = readJson(approveValidationPath);
tamperedSourceValidation.sourceReviewFormat = "transparent_ai_real_case_unconfirmed_outcome_review_v1";
tamperedSourceValidation.sourceConfirmedOutcomeSourceRunId = "lost-confirmed-outcome-source-run-id";
tamperedSourceValidation.reviewOnlyPackagePlanningHandoff.sourceConfirmedOutcomeSourceRunId = "lost-confirmed-outcome-source-run-id";
const sourceTamper = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-review-only-package-planning-packet.mjs",
    "--lifecycle-validation",
    JSON.stringify(tamperedSourceValidation),
    "--rollback-point",
    rollbackDir,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "source-tamper")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome review-only package planning blocks lost confirmed-outcome source continuity",
  /REVIEW_ONLY_PLANNING_SOURCE_FORMAT_MISMATCH/.test(sourceTamper.stderr + sourceTamper.stdout),
  (sourceTamper.stderr + sourceTamper.stdout).slice(0, 500)
);

const missingSourceRunValidation = readJson(approveValidationPath);
missingSourceRunValidation.sourceConfirmedOutcomeSourceRunId = "";
missingSourceRunValidation.reviewOnlyPackagePlanningHandoff.sourceConfirmedOutcomeSourceRunId = "";
const missingSourceRun = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-review-only-package-planning-packet.mjs",
    "--lifecycle-validation",
    JSON.stringify(missingSourceRunValidation),
    "--rollback-point",
    rollbackDir,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "missing-source-run")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome review-only package planning blocks missing confirmed-outcome source run id",
  /REVIEW_ONLY_PLANNING_SOURCE_IDS_MISSING_OR_MISMATCHED/.test(missingSourceRun.stderr + missingSourceRun.stdout),
  (missingSourceRun.stderr + missingSourceRun.stdout).slice(0, 500)
);

const mismatchedSourceRunValidation = readJson(approveValidationPath);
mismatchedSourceRunValidation.reviewOnlyPackagePlanningHandoff.sourceRunId = "wrong-source-run-id";
const mismatchedSourceRun = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-review-only-package-planning-packet.mjs",
    "--lifecycle-validation",
    JSON.stringify(mismatchedSourceRunValidation),
    "--rollback-point",
    rollbackDir,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "mismatched-source-run")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome review-only package planning blocks sourceRunId mismatch",
  /REVIEW_ONLY_PLANNING_SOURCE_IDS_MISSING_OR_MISMATCHED/.test(mismatchedSourceRun.stderr + mismatchedSourceRun.stdout),
  (mismatchedSourceRun.stderr + mismatchedSourceRun.stdout).slice(0, 500)
);

const missingTeacherReviewed = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-review-only-package-planning-packet.mjs",
    "--lifecycle-validation",
    approveValidationPath,
    "--rollback-point",
    rollbackDir,
    "--out-dir",
    join(smokeRoot, "missing-teacher-reviewed")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome review-only package planning requires teacher-reviewed flag",
  /REQUIRES_TEACHER_REVIEWED_FLAG/.test(missingTeacherReviewed.stderr + missingTeacherReviewed.stdout),
  (missingTeacherReviewed.stderr + missingTeacherReviewed.stdout).slice(0, 500)
);

const repairSource = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-review-only-package-planning-packet.mjs",
    "--lifecycle-validation",
    repairValidationPath,
    "--rollback-point",
    rollbackDir,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "repair-source")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome review-only package planning rejects non-approved lifecycle validation",
  /not a locked handoff for review_only package planning/.test(repairSource.stderr + repairSource.stdout),
  (repairSource.stderr + repairSource.stdout).slice(0, 500)
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_review_only_package_planning_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  lifecycleSmokeStatus: lifecycleSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);

