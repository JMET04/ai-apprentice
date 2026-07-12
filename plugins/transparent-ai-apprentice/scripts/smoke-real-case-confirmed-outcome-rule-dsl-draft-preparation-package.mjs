#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const lifecycleSmokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-rule-dsl-lifecycle-gate");
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-rule-dsl-draft-preparation-package");
const expectedSourceReviewFormat = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";
mkdirSync(smokeRoot, { recursive: true });

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
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function findFiles(rootDir, fileName) {
  const output = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    let stat = null;
    try {
      stat = statSync(current);
    } catch {
      continue;
    }
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

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const lifecycleSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-rule-dsl-lifecycle-gate.mjs"]).stdout
);
const readyLifecycleGatePath = latestFile(join(lifecycleSmokeRoot, "approved"), "real-case-confirmed-outcome-rule-dsl-lifecycle-gate.json");
const readyLifecycleGate = readJson(readyLifecycleGatePath);

const prep = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-rule-dsl-draft-preparation-package.mjs",
    "--lifecycle-gate",
    readyLifecycleGatePath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "prep")
  ]).stdout
);
const prepPacket = readJson(prep.packagePath);
const draftRule = readJson(prep.candidateRows[0].rulePath);
check(
  "Confirmed outcome Rule DSL draft prep creates draft_disabled Rule Card from lifecycle planning",
  prep.ok === true &&
    prepPacket.format === "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_preparation_package_v1" &&
    prepPacket.status === "confirmed_outcome_rule_dsl_draft_preparation_waiting_for_teacher_rule_review" &&
    prepPacket.proposedLifecycle === "draft_disabled" &&
    prepPacket.confirmedOutcomeBranch === true &&
    prepPacket.sourceReviewFormat === expectedSourceReviewFormat &&
    prepPacket.sourceConfirmedOutcomeReviewId === readyLifecycleGate.sourceConfirmedOutcomeReviewId &&
    prepPacket.sourceConfirmedOutcomeSourceRunId === readyLifecycleGate.sourceConfirmedOutcomeSourceRunId &&
    prepPacket.sourceRunId === readyLifecycleGate.sourceRunId &&
    prepPacket.candidateRuleCount === 1 &&
    draftRule.lifecycle === "draft_disabled" &&
    draftRule.source.confirmed_outcome?.confirmedOutcomeBranch === true &&
    draftRule.source.confirmed_outcome?.sourceReviewFormat === expectedSourceReviewFormat &&
    draftRule.source.confirmed_outcome?.sourceConfirmedOutcomeReviewId === readyLifecycleGate.sourceConfirmedOutcomeReviewId &&
    draftRule.source.confirmed_outcome?.sourceConfirmedOutcomeSourceRunId === readyLifecycleGate.sourceConfirmedOutcomeSourceRunId &&
    draftRule.source.confirmed_outcome?.sourceRunId === readyLifecycleGate.sourceRunId &&
    prep.candidateRows[0].sourceReviewFormat === expectedSourceReviewFormat &&
    prep.candidateRows[0].sourceConfirmedOutcomeReviewId === readyLifecycleGate.sourceConfirmedOutcomeReviewId &&
    prep.candidateRows[0].sourceConfirmedOutcomeSourceRunId === readyLifecycleGate.sourceConfirmedOutcomeSourceRunId &&
    prep.candidateRows[0].sourceRunId === readyLifecycleGate.sourceRunId &&
    prep.candidateRows[0].dslValidationOk === true,
  JSON.stringify({ packagePath: prep.packagePath, rulePath: prep.candidateRows[0].rulePath })
);
check(
  "Confirmed outcome Rule DSL draft prep keeps registry package execution RAG and packaging locked",
  prepPacket.locks.draftRuleFilesWritten === true &&
    prepPacket.locks.sourceRuleFilesModified === false &&
    prepPacket.locks.rulePackageCompiled === false &&
    prepPacket.locks.productionRuleRegistryMutated === false &&
    prepPacket.locks.ruleEnabled === false &&
    prepPacket.locks.ragFetched === false &&
    prepPacket.locks.targetSoftwareCommandsExecuted === false &&
    prepPacket.locks.packagingUnlocked === false &&
    prepPacket.nextTeacherReview.forbiddenDecisions.includes("enable_rule"),
  JSON.stringify(prepPacket.locks)
);

const missingFlag = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-rule-dsl-draft-preparation-package.mjs",
    "--lifecycle-gate",
    readyLifecycleGatePath,
    "--out-dir",
    join(smokeRoot, "missing-flag")
  ],
  { expectOk: false }
);
check(
  "Confirmed outcome Rule DSL draft prep requires explicit teacher-reviewed flag",
  /CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_REQUIRES_TEACHER_REVIEWED_FLAG/.test(missingFlag.stderr || missingFlag.stdout),
  (missingFlag.stderr || missingFlag.stdout).slice(0, 240)
);

const blockedLifecycleGatePath = latestFile(
  join(lifecycleSmokeRoot, "missing-rollback-output"),
  "real-case-confirmed-outcome-rule-dsl-lifecycle-gate.json"
);
const blockedGate = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-rule-dsl-draft-preparation-package.mjs",
    "--lifecycle-gate",
    blockedLifecycleGatePath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "blocked-gate")
  ],
  { expectOk: false }
);
check(
  "Confirmed outcome Rule DSL draft prep rejects non-ready lifecycle gates",
  /CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_REQUIRES_READY_LIFECYCLE_GATE/.test(blockedGate.stderr || blockedGate.stdout),
  (blockedGate.stderr || blockedGate.stdout).slice(0, 240)
);

const tamperedGate = readJson(readyLifecycleGatePath);
tamperedGate.ruleDslDraftPlanningHandoff.ruleActivationCandidateSha256 = "0".repeat(64);
const tamperedGatePath = writeJson(join(smokeRoot, "tampered-lifecycle-gate.json"), tamperedGate);
const tampered = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-rule-dsl-draft-preparation-package.mjs",
    "--lifecycle-gate",
    tamperedGatePath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "tampered")
  ],
  { expectOk: false }
);
check(
  "Confirmed outcome Rule DSL draft prep blocks rule activation candidate hash mismatch",
  /CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_RULE_ACTIVATION_CANDIDATE_HASH_MISMATCH/.test(tampered.stderr || tampered.stdout),
  (tampered.stderr || tampered.stdout).slice(0, 240)
);

const badSourceGate = readJson(readyLifecycleGatePath);
badSourceGate.ruleDslDraftPlanningHandoff.sourceReviewFormat = "transparent_ai_real_case_unconfirmed_outcome_review_v1";
badSourceGate.ruleDslDraftPlanningHandoff.sourceConfirmedOutcomeReviewId = "lost-confirmed-outcome-review-id";
badSourceGate.ruleDslDraftPlanningHandoff.sourceConfirmedOutcomeSourceRunId = "lost-confirmed-outcome-source-run-id";
badSourceGate.ruleDslDraftPlanningHandoff.sourceRunId = "lost-source-run-id";
const badSourceGatePath = writeJson(join(smokeRoot, "bad-source-lifecycle-gate.json"), badSourceGate);
const badSource = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-rule-dsl-draft-preparation-package.mjs",
    "--lifecycle-gate",
    badSourceGatePath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "bad-source")
  ],
  { expectOk: false }
);
check(
  "Confirmed outcome Rule DSL draft prep blocks lost confirmed-outcome source continuity",
  /CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_HANDOFF_SOURCE_REVIEW_FORMAT_MISMATCH/.test(badSource.stderr || badSource.stdout),
  (badSource.stderr || badSource.stdout).slice(0, 240)
);

const badSourceRunGate = readJson(readyLifecycleGatePath);
badSourceRunGate.sourceConfirmedOutcomeSourceRunId = "";
const badSourceRunGatePath = writeJson(join(smokeRoot, "bad-source-run-lifecycle-gate.json"), badSourceRunGate);
const badSourceRun = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-rule-dsl-draft-preparation-package.mjs",
    "--lifecycle-gate",
    badSourceRunGatePath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "bad-source-run")
  ],
  { expectOk: false }
);
check(
  "Confirmed outcome Rule DSL draft prep blocks missing confirmed-outcome source run id",
  /CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_SOURCE_GATE_CONFIRMED_OUTCOME_SOURCE_RUN_ID_MISSING/.test(
    badSourceRun.stderr || badSourceRun.stdout
  ),
  (badSourceRun.stderr || badSourceRun.stdout).slice(0, 240)
);

const badSourceRunIdGate = readJson(readyLifecycleGatePath);
badSourceRunIdGate.ruleDslDraftPlanningHandoff.sourceRunId = "wrong-source-run-id";
const badSourceRunIdGatePath = writeJson(join(smokeRoot, "bad-source-run-id-lifecycle-gate.json"), badSourceRunIdGate);
const badSourceRunId = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-rule-dsl-draft-preparation-package.mjs",
    "--lifecycle-gate",
    badSourceRunIdGatePath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "bad-source-run-id")
  ],
  { expectOk: false }
);
check(
  "Confirmed outcome Rule DSL draft prep blocks handoff sourceRunId mismatch",
  /CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_HANDOFF_SOURCE_RUN_ID_MISMATCH/.test(
    badSourceRunId.stderr || badSourceRunId.stdout
  ),
  (badSourceRunId.stderr || badSourceRunId.stdout).slice(0, 240)
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_preparation_package_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  lifecycleSmokeStatus: lifecycleSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
