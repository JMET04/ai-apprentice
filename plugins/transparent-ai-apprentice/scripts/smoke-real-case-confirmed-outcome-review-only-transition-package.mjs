#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const planningSmokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-review-only-package-planning");
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-review-only-transition-package");
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

const planningSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-review-only-package-planning.mjs"]).stdout
);
const planningPacketPath = latestFile(
  join(planningSmokeRoot, "planning"),
  "real-case-confirmed-outcome-review-only-package-planning-packet.json"
);
const planningPacket = readJson(planningPacketPath);
const rollbackPoint = planningPacket.rollbackPoint;

const transitionResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-review-only-transition-package.mjs",
    "--planning-packet",
    planningPacketPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "transition")
  ]).stdout
);
const transitionPacket = readJson(transitionResult.packagePath);
const compiledReviewOnlyPackage = readJson(transitionResult.compiledReviewOnlyRulePackagePath);

check(
  "Real-case confirmed outcome review-only transition package compiles review-only copies only",
  transitionResult.format === "transparent_ai_real_case_confirmed_outcome_review_only_transition_package_result_v1" &&
    transitionResult.status === "ready_for_teacher_review_only_transition_package_review" &&
    transitionResult.confirmedOutcomeBranch === true &&
    transitionResult.sourceReviewFormat === expectedSourceReviewFormat &&
    transitionResult.sourceConfirmedOutcomeReviewId === planningPacket.sourceConfirmedOutcomeReviewId &&
    transitionResult.sourceConfirmedOutcomeSourceRunId === planningPacket.sourceConfirmedOutcomeSourceRunId &&
    transitionResult.sourceRunId === planningPacket.sourceRunId &&
    transitionPacket.confirmedOutcomeBranch === true &&
    transitionPacket.sourceReviewFormat === expectedSourceReviewFormat &&
    transitionPacket.sourceConfirmedOutcomeReviewId === planningPacket.sourceConfirmedOutcomeReviewId &&
    transitionPacket.sourceConfirmedOutcomeSourceRunId === planningPacket.sourceConfirmedOutcomeSourceRunId &&
    transitionPacket.sourceRunId === planningPacket.sourceRunId &&
    transitionResult.reviewOnlyRuleCount >= 1 &&
    transitionResult.sourceRuleFilesModified === false &&
    transitionResult.locks?.reviewOnlyTransitionAppliedToCopies === true &&
    transitionResult.locks?.reviewOnlyRulePackageCompiled === true &&
    transitionResult.locks?.activeRulePackageCompiled === false &&
    transitionResult.locks?.ruleEnabled === false &&
    transitionResult.locks?.packagingUnlocked === false &&
    compiledReviewOnlyPackage.rules.every((rule) => rule.lifecycle === "review_only"),
  JSON.stringify({
    packagePath: transitionResult.packagePath,
    compiledReviewOnlyRulePackagePath: transitionResult.compiledReviewOnlyRulePackagePath,
    ruleCount: transitionResult.reviewOnlyRuleCount
  })
);

const sourceRulesAfterTransition = transitionPacket.stagedRules.map((row) => readJson(row.sourceRulePath));
check(
  "Real-case confirmed outcome review-only transition package leaves source draft-disabled rules unchanged",
  transitionPacket.appliedTransitionScope === "staged_rule_copies_only" &&
    transitionPacket.sourceRuleFilesModified === false &&
    transitionPacket.stagedRules.every(
      (row) =>
        row.sourceLifecycle === "draft_disabled" &&
        row.stagedLifecycle === "review_only" &&
        row.transitionAppliedToCopyOnly === true &&
        row.activePromotionAllowed === false &&
        row.requiresSeparateActiveGate === true
    ) &&
    sourceRulesAfterTransition.every((rule) => rule.lifecycle === "draft_disabled"),
  JSON.stringify(transitionPacket.stagedRules.slice(0, 2))
);

const sourceTamperedPacket = {
  ...planningPacket,
  sourceReviewFormat: "transparent_ai_real_case_unconfirmed_outcome_review_v1",
  sourceConfirmedOutcomeSourceRunId: "lost-confirmed-outcome-source-run-id"
};
const sourceTamperedPacketPath = writeJson(join(smokeRoot, "source-tampered-planning-packet.json"), sourceTamperedPacket);
const sourceTamperedRun = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-review-only-transition-package.mjs",
    "--planning-packet",
    sourceTamperedPacketPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "source-tampered")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome review-only transition package blocks lost confirmed-outcome source continuity",
  /REVIEW_ONLY_TRANSITION_SOURCE_FORMAT_MISMATCH/.test(sourceTamperedRun.stderr + sourceTamperedRun.stdout),
  (sourceTamperedRun.stderr + sourceTamperedRun.stdout).slice(0, 500)
);

const missingSourceRunPacket = {
  ...planningPacket,
  sourceConfirmedOutcomeSourceRunId: ""
};
const missingSourceRunPacketPath = writeJson(join(smokeRoot, "missing-source-run-planning-packet.json"), missingSourceRunPacket);
const missingSourceRun = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-review-only-transition-package.mjs",
    "--planning-packet",
    missingSourceRunPacketPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "missing-source-run")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome review-only transition package blocks missing confirmed-outcome source run id",
  /REVIEW_ONLY_TRANSITION_SOURCE_IDS_MISSING/.test(missingSourceRun.stderr + missingSourceRun.stdout),
  (missingSourceRun.stderr + missingSourceRun.stdout).slice(0, 500)
);

const missingSourceRunIdPacket = {
  ...planningPacket,
  sourceRunId: ""
};
const missingSourceRunIdPacketPath = writeJson(join(smokeRoot, "missing-source-run-id-planning-packet.json"), missingSourceRunIdPacket);
const missingSourceRunId = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-review-only-transition-package.mjs",
    "--planning-packet",
    missingSourceRunIdPacketPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "missing-source-run-id")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome review-only transition package blocks missing sourceRunId",
  /REVIEW_ONLY_TRANSITION_SOURCE_IDS_MISSING/.test(missingSourceRunId.stderr + missingSourceRunId.stdout),
  (missingSourceRunId.stderr + missingSourceRunId.stdout).slice(0, 500)
);

const missingTeacherReviewed = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-review-only-transition-package.mjs",
    "--planning-packet",
    planningPacketPath,
    "--rollback-point",
    rollbackPoint,
    "--out-dir",
    join(smokeRoot, "missing-teacher-reviewed")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome review-only transition package requires teacher-reviewed flag",
  /REQUIRES_TEACHER_REVIEWED_FLAG/.test(missingTeacherReviewed.stderr + missingTeacherReviewed.stdout),
  (missingTeacherReviewed.stderr + missingTeacherReviewed.stdout).slice(0, 500)
);

const tamperedPacket = {
  ...planningPacket,
  status: "needs_teacher_review",
  nextReview: {
    ...planningPacket.nextReview,
    requiresSeparateReviewOnlyTransitionGate: false
  }
};
const tamperedPacketPath = writeJson(join(smokeRoot, "tampered-planning-packet.json"), tamperedPacket);
const tamperedRun = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-review-only-transition-package.mjs",
    "--planning-packet",
    tamperedPacketPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "tampered")
  ],
  { expectOk: false }
);
check(
  "Real-case confirmed outcome review-only transition package rejects unlocked planning packet",
  /not a locked review_only transition handoff/.test(tamperedRun.stderr + tamperedRun.stdout),
  (tamperedRun.stderr + tamperedRun.stdout).slice(0, 500)
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_review_only_transition_package_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  planningSmokeStatus: planningSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);

