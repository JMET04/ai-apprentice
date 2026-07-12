#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "low-token-operation-preflight-policy-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(name, value) {
  const path = join(smokeRoot, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

const runnerPath = writeJson("automatic-low-token-learning-runner.json", {
  format: "transparent_ai_automatic_low_token_learning_runner_v1",
  runnerId: "preflight-policy-smoke-runner",
  status: "learning_events_waiting_for_teacher_review",
  totals: {
    metadataGateRuns: 2,
    tailReadSkippedByMetadataGate: 1,
    changedItems: 1,
    compactLearningEvents: 1,
    screenshotRequests: 0
  },
  locks: {
    accepted: false,
    ruleEnabled: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    longTermMemoryWritten: false
  }
});

const visualQueuePath = writeJson("automatic-triggered-visual-check-queue.json", {
  format: "transparent_ai_automatic_triggered_visual_check_queue_v1",
  status: "waiting_for_teacher_visual_check_review",
  requestCount: 1,
  requests: [
    {
      id: "automatic-visual-check-1",
      software: "UniversalDesignTool",
      triggerReason: "error",
      captureOnlyAfterReview: true,
      maxScreenshots: 1
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    longTermMemoryWritten: false
  }
});

const targetConfirmationPath = writeJson("confirmed-numbered-target.json", {
  format: "transparent_ai_engineering_command_target_confirmation_v1",
  status: "target_confirmed_waiting_for_dry_run_planning",
  selectedCandidateNumber: 2,
  confirmedTarget: {
    selectedCandidateNumber: 2,
    label: "top right sketch constraint"
  },
  locks: {
    accepted: false,
    ruleEnabled: false,
    softwareActionsExecuted: false
  }
});

const spatialIntentPath = writeJson("transparent-sketch-spatial-intent.json", {
  format: "transparent_ai_spatial_intent_v1",
  status: "ready_for_teacher_review",
  intent: {
    relation: "top-right",
    depthHint: "front face",
    perspective: "isometric"
  },
  locks: {
    accepted: false,
    ruleEnabled: false,
    softwareActionsExecuted: false
  }
});

const rollback = runNodeScript("create-rollback-point.mjs", [
  "--label",
  "low token policy smoke rollback",
  "--reason",
  "Smoke-test retained rollback evidence for preflight policy.",
  "--path",
  "plugins\\transparent-ai-apprentice\\scripts\\create-low-token-operation-preflight-policy.mjs",
  "--output-dir",
  join(smokeRoot, "rollback")
]);

const withEvidence = runNodeScript("create-low-token-operation-preflight-policy.mjs", [
  "--goal",
  "Unify low-token observation, one visual check, voice target confirmation, sketch intent, and rollback before execution.",
  "--software",
  "UniversalDesignTool",
  "--command",
  "Move the top right constrained hole after I confirm number 2.",
  "--runner",
  runnerPath,
  "--visual-check-queue",
  visualQueuePath,
  "--target-confirmation",
  targetConfirmationPath,
  "--spatial-intent",
  spatialIntentPath,
  "--rollback-point",
  rollback.manifestPath,
  "--output-dir",
  join(smokeRoot, "with-evidence")
]);
const policy = readJson(withEvidence.policyPath);

const missing = runNodeScript("create-low-token-operation-preflight-policy.mjs", [
  "--goal",
  "Show missing preflight evidence stays blocked.",
  "--software",
  "AnySoftware",
  "--command",
  "Do the thing by voice.",
  "--output-dir",
  join(smokeRoot, "missing-evidence")
]);
const missingPolicy = readJson(missing.policyPath);
const html = readFileSync(withEvidence.htmlPath, "utf8");

const checks = [
  {
    name: "Preflight policy unifies low-token, visual, voice target, sketch, and rollback evidence",
    pass:
      withEvidence.format === "transparent_ai_low_token_operation_preflight_policy_result_v1" &&
      policy.format === "transparent_ai_low_token_operation_preflight_policy_v1" &&
      policy.preflightLanes.length === 5 &&
      policy.preflightLanes.some((lane) => lane.id === "low_token_observation_first" && lane.status === "evidence_present") &&
      policy.preflightLanes.some((lane) => lane.id === "visual_check_only_after_changed_signal" && lane.status === "waiting_for_teacher_visual_review") &&
      policy.preflightLanes.some((lane) => lane.id === "voice_text_numbered_target_confirmation" && lane.status === "one_numbered_target_selected") &&
      policy.preflightLanes.some((lane) => lane.id === "transparent_sketch_spatial_intent" && lane.status === "spatial_intent_reviewable"),
    evidence: withEvidence.policyPath
  },
  {
    name: "Preflight policy preserves no screenshot, no execution, no memory, and rollback locks",
    pass:
      policy.locks.reviewOnly === true &&
      policy.locks.accepted === false &&
      policy.locks.ruleEnabled === false &&
      policy.locks.screenshotsCaptured === false &&
      policy.locks.softwareActionsExecuted === false &&
      policy.locks.targetSoftwareCommandsExecuted === false &&
      policy.locks.longTermMemoryWritten === false &&
      policy.locks.nativeUniversalExecution === false &&
      policy.locks.rollbackPointRequiredBeforeExecution === true &&
      policy.executionPolicy.executeFromThisPolicy === false,
    evidence: JSON.stringify(policy.locks)
  },
  {
    name: "Preflight policy stays blocked when low-token and numbered-target evidence are missing",
    pass:
      missingPolicy.status === "waiting_for_preflight_evidence_or_teacher_review" &&
      missingPolicy.blockers.includes("missing_low_token_runner_or_learning_cycle_evidence") &&
      missingPolicy.blockers.includes("missing_triggered_visual_check_queue_policy") &&
      missingPolicy.blockers.includes("voice_or_text_command_has_no_confirmed_numbered_target"),
    evidence: missing.policyPath
  },
  {
    name: "Preflight policy writes teacher-readable HTML without changing software",
    pass:
      existsSync(withEvidence.htmlPath) &&
      html.includes("Low Token Operation Preflight Policy") &&
      html.includes("execution_gate_and_rollback") &&
      withEvidence.screenshotsCaptured === false &&
      withEvidence.softwareActionsExecuted === false,
    evidence: withEvidence.htmlPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_low_token_operation_preflight_policy_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    policy: withEvidence.policyPath,
    html: withEvidence.htmlPath,
    missingPolicy: missing.policyPath,
    rollback: rollback.manifestPath
  }
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);
