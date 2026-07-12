#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function run(args, expectOk = true) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 180000 });
  if (expectOk && result.status !== 0) {
    throw new Error(`command failed\nargs=${args.join(" ")}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`command unexpectedly passed\nargs=${args.join(" ")}\nstdout=${result.stdout}`);
  }
  return result;
}

function runJson(args, expectOk = true) {
  const result = run(args, expectOk);
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-teacher-method-contract-"));
const rollbackPoint = join(root, "rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-teacher-method-execution-learning-contract",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const profileResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-teacher-learning-method-profile.mjs",
  "--goal",
  "Adapt to teacher method, learn from low-token software evidence, and execute only after transparent sketch confirmation.",
  "--software",
  "arbitrary desktop engineering software",
  "--teacher-message",
  "I draw on a transparent mask first, then you should watch log metadata changes. Ask fewer questions, learn from my corrections, and use a stronger model only to build or repair the rules.",
  "--teacher-style",
  "transparent overlay sketch, spatial intent review, log deltas, correction-first, ask less",
  "--evidence-preference",
  "log metadata first",
  "--preferred-tool",
  "transparent drawing overlay",
  "--output-dir",
  join(root, "profile")
]);

const lowTokenHandoffPath = join(root, "low-token-handoff.json");
writeJson(lowTokenHandoffPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_evidence_learning_handoff_v1",
  handoffId: "smoke-low-token-handoff",
  createdAt: "2026-06-19T00:00:00.000Z",
  status: "waiting_for_teacher_learning_event_review",
  counts: {
    evidenceRows: 1,
    compactLearningEvents: 1,
    reviewRows: 1
  },
  paths: {
    handoff: lowTokenHandoffPath,
    compactLearningEvents: join(root, "compact-learning-events.json")
  },
  locks: {
    reviewOnly: true,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const rehearsal = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-depth-demonstration-rehearsal.mjs",
  "--goal",
  "Smoke teacher method contract with transparent 2D perspective 3D depth route.",
  "--software",
  "arbitrary desktop engineering software",
  "--selected-number",
  "1",
  "--teacher-confirmed-number",
  "--preferred-adapter",
  "existing-windows-ui-automation",
  "--output-dir",
  join(root, "rehearsal")
]);

const sketchRuleDraft = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-logic-contract-rule-draft.mjs",
  "--spatial-intent",
  rehearsal.spatialIntent,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed-spatial-intent",
  "--output-dir",
  join(root, "sketch-rule-draft")
]);

const missingFlag = run(
  [
    "plugins/transparent-ai-apprentice/scripts/create-teacher-method-execution-learning-contract.mjs",
    "--profile",
    profileResult.profilePath,
    "--rollback-point",
    rollbackPoint,
    "--output-dir",
    join(root, "missing-flag")
  ],
  false
);

const contractResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-teacher-method-execution-learning-contract.mjs",
  "--profile",
  profileResult.profilePath,
  "--low-token-learning-handoff",
  lowTokenHandoffPath,
  "--transparent-sketch-rule-draft",
  sketchRuleDraft.packagePath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed-method",
  "--output-dir",
  join(root, "contract")
]);
const contract = readJson(contractResult.contractPath);
const routeIds = new Set(contract.routeContracts.map((route) => route.id));

const checks = [
  {
    name: "Missing teacher-reviewed method flag is rejected",
    pass:
      missingFlag.status !== 0 &&
      missingFlag.stderr.includes("TEACHER_METHOD_CONTRACT_REQUIRES_TEACHER_REVIEWED_METHOD_FLAG")
  },
  {
    name: "Teacher method profile is bridged to low-token metadata-first learning",
    pass:
      routeIds.has("low_token_log_metadata_first") &&
      contract.coverage.lowTokenMetadataFirst === true &&
      contract.routeContracts.some((route) => route.policy?.fullLogPolicy === "blocked_by_default")
  },
  {
    name: "Transparent overlay sketch route requires numbered spatial confirmation and logic contract",
    pass:
      routeIds.has("transparent_overlay_spatial_intent") &&
      contract.coverage.transparentOverlaySpatialIntent === true &&
      contract.routeContracts.some(
        (route) =>
          route.id === "transparent_overlay_spatial_intent" &&
          route.policy?.confirmationPolicy === "teacher_confirms_numbered_target_before_execution" &&
          route.policy?.visualSimilarityPolicy === "blocked_without_logic_contract"
      )
  },
  {
    name: "Correction-first route returns mismatches to high-reasoning rule repair",
    pass:
      routeIds.has("correction_boundary_counterexample") &&
      contract.coverage.correctionBoundaryCounterexample === true &&
      contract.routeContracts.some((route) => route.policy?.repairPolicy === "return_to_high_reasoning_for_rule_repair_on_mismatch")
  },
  {
    name: "High-to-medium reasoning tier policy is explicit",
    pass:
      contract.coverage.highToMediumModelTierPolicy === true &&
      contract.modelTierPolicy.downgradeCondition.includes("teacher-reviewed contract") &&
      contract.modelTierPolicy.escalationCondition.includes("teacher correction")
  },
  {
    name: "Every detected teacher mode has a route or extension lane",
    pass: contract.coverage.everyTeacherModeHasRoute === true && contract.coverage.teacherModes.length >= 4
  },
  {
    name: "Contract remains review-only and cannot execute software or write memory",
    pass:
      contract.locks.reviewOnly === true &&
      contract.locks.ruleEnabled === false &&
      contract.locks.memoryWritten === false &&
      contract.locks.softwareActionsExecuted === false &&
      contract.locks.screenshotsCaptured === false &&
      contract.locks.fullContinuousRecording === false &&
      contract.locks.goalComplete === false &&
      contract.executeNow === false
  }
];
const failed = checks.filter((check) => !check.pass);

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      smoke: "transparent_ai_teacher_method_execution_learning_contract_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        profile: profileResult.profilePath,
        lowTokenHandoff: lowTokenHandoffPath,
        rehearsal: rehearsal.rehearsalPath,
        sketchRuleDraft: sketchRuleDraft.packagePath,
        contract: contractResult.contractPath
      },
      coverage: contract.coverage,
      locks: contract.locks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
