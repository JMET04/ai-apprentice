#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "current-goal-teacher-trial-preflight", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const missingResult = runNodeScript("create-current-goal-teacher-trial-preflight.mjs", [
  "--output-dir",
  join(smokeRoot, "missing")
]);
const missingPreflight = readJson(missingResult.preflightPath);
const missingHtml = readFileSync(missingResult.htmlPath, "utf8");

const evidenceDir = join(smokeRoot, "evidence");
mkdirSync(evidenceDir, { recursive: true });
const evidencePaths = Object.fromEntries(
  [
    "validated-low-token-route-receipt.json",
    "teacher-overlay-packet-validation.json",
    "teacher-reviewed-spatial-intent.json",
    "teacher-method-contract.json",
    "retained-rollback-point.json"
  ].map((name) => {
    const path = join(evidenceDir, name);
    writeJson(path, { smoke: true, name });
    return [name, path];
  })
);
const readyReceipt = {
  format: "transparent_ai_current_goal_teacher_trial_workbench_receipt_v1",
  teacherDecision: "ready_for_execution_gate_prep",
  selectedSoftware: "Smoke software",
  selectedLowTokenRouteId: "existing_low_token_coverage_review",
  validatedLowTokenRouteReceiptPath: evidencePaths["validated-low-token-route-receipt.json"],
  teacherOverlayPacketValidationPath: evidencePaths["teacher-overlay-packet-validation.json"],
  teacherReviewedSpatialIntentPath: evidencePaths["teacher-reviewed-spatial-intent.json"],
  teacherMethodContractPath: evidencePaths["teacher-method-contract.json"],
  confirmedRollbackPoint: evidencePaths["retained-rollback-point.json"],
  locks: {
    accepted: false,
    ruleEnabled: false,
    softwareActionsExecuted: false,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    goalComplete: false
  }
};
const readyReceiptPath = join(smokeRoot, "ready-receipt.json");
writeJson(readyReceiptPath, readyReceipt);
const readyResult = runNodeScript("create-current-goal-teacher-trial-preflight.mjs", [
  "--receipt",
  readyReceiptPath,
  "--output-dir",
  join(smokeRoot, "ready")
]);
const readyPreflight = readJson(readyResult.preflightPath);

const forbiddenReceipt = {
  ...readyReceipt,
  teacherDecision: "accepted",
  locks: { ...readyReceipt.locks, softwareActionsExecuted: true, goalComplete: true }
};
const forbiddenReceiptPath = join(smokeRoot, "forbidden-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenResult = runNodeScript("create-current-goal-teacher-trial-preflight.mjs", [
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden")
]);
const forbiddenPreflight = readJson(forbiddenResult.preflightPath);

const checks = [
  {
    name: "Missing teacher receipt keeps preflight blocked without failing process",
    pass:
      missingPreflight.status === "blocked_waiting_for_teacher_trial_evidence" &&
      missingPreflight.readyForNextManualGate === false &&
      missingPreflight.blockers.includes("teacher_trial_receipt_missing") &&
      missingPreflight.goalComplete === false,
    evidence: missingPreflight
  },
  {
    name: "Preflight HTML is teacher-facing and explicitly side-effect free",
    pass:
      missingHtml.includes("Current Goal Teacher Trial Preflight") &&
      missingHtml.includes("does not read logs") &&
      missingHtml.includes("does not execute software") &&
      missingHtml.includes("Evidence Checks"),
    evidence: missingResult.htmlPath
  },
  {
    name: "Ready execution-gate receipt requires all reviewed evidence paths and routes one manual command",
    pass:
      readyPreflight.status === "ready_for_next_manual_gate_review_only" &&
      readyPreflight.readyForNextManualGate === true &&
      readyPreflight.blockers.length === 0 &&
      readyPreflight.nextManualRoute === "prepare_separate_execution_approval_gate_after_all_evidence" &&
      readyPreflight.nextManualCommand.includes("create-spatial-to-software-execution-gate-package.mjs"),
    evidence: readyPreflight
  },
  {
    name: "Forbidden acceptance or execution claims stay blocked",
    pass:
      forbiddenPreflight.status === "blocked_waiting_for_teacher_trial_evidence" &&
      forbiddenPreflight.blockers.includes("forbidden_teacher_decision:accepted") &&
      forbiddenPreflight.blockers.includes("receipt_claims_software_execution") &&
      forbiddenPreflight.blockers.includes("receipt_claims_goal_complete") &&
      forbiddenPreflight.readyForNextManualGate === false,
    evidence: forbiddenPreflight
  },
  {
    name: "Preflight keeps all locks closed",
    pass:
      readyPreflight.locks.reviewOnly === true &&
      readyPreflight.locks.preflightDoesNotReadLogs === true &&
      readyPreflight.locks.preflightDoesNotCaptureScreenshots === true &&
      readyPreflight.locks.preflightDoesNotExecuteTargetSoftware === true &&
      readyPreflight.locks.preflightDoesNotWriteMemory === true &&
      readyPreflight.locks.preflightDoesNotEnableRules === true &&
      readyPreflight.locks.preflightDoesNotDeleteRollbackPoints === true &&
      readyPreflight.locks.goalComplete === false,
    evidence: readyPreflight.locks
  },
  {
    name: "Preflight writes JSON HTML README",
    pass: existsSync(missingResult.preflightPath) && existsSync(missingResult.htmlPath) && existsSync(missingResult.readmePath),
    evidence: missingResult
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed, smokeRoot }, null, 2));
  process.exit(1);
}

rmSync(smokeRoot, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_current_goal_teacher_trial_preflight_smoke_v1",
      checks,
      tempCleaned: true
    },
    null,
    2
  )
);
