#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-next-step-queue-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const evidencePath = writeJson(join(smokeRoot, "evidence", "compact-learning-events.json"), {
  format: "fixture_compact_low_token_evidence_v1"
});
const rollbackPath = writeJson(join(smokeRoot, "rollback", "rollback-point.json"), {
  format: "transparent_ai_rollback_point_v1",
  status: "waiting_for_teacher_confirmation"
});
const matrixPath = writeJson(join(smokeRoot, "matrix", "original-goal-completion-blocker-matrix.json"), {
  ok: true,
  format: "transparent_ai_original_goal_completion_blocker_matrix_v1",
  matrixId: "smoke-completion-blocker-next-step-queue",
  goal: "Smoke completion blocker next-step queue.",
  status: "waiting_for_teacher_completion_blocker_review",
  completionDecision: "not_complete_full_objective_because_universal_native_control_and_unattended_all_app_coverage_are_not_proven",
  sourceEvidence: {
    statusRefresh: join(smokeRoot, "refresh.json")
  },
  rows: [
    {
      id: "all_software_low_token_coverage_evidence",
      lane: "all_software_low_token_coverage_evidence",
      requirement: "Prove low-token coverage.",
      currentEvidence: "budgetActions=1",
      missingProof: "Need reviewed per-software coverage evidence.",
      nextSafeAction: "Open compact evidence first.",
      verifierCommand:
        "node plugins\\transparent-ai-apprentice\\scripts\\create-original-goal-current-status-refresh.mjs --goal \"refresh\"",
      sourcePaths: [evidencePath],
      blockedClaims: ["claim_all_software_low_token_coverage_complete"]
    },
    {
      id: "teacher_reviewed_triggered_visual_evidence_path",
      lane: "teacher_reviewed_triggered_visual_evidence_path",
      requirement: "Capture one teacher-confirmed visual check.",
      currentEvidence: "requestCount=1",
      missingProof: "Need capture receipt.",
      nextSafeAction: "Open visual command builder.",
      verifierCommand:
        "node plugins\\transparent-ai-apprentice\\scripts\\capture-triggered-visual-check.mjs --request \"queue.json\" --selected-request-id \"<teacher-reviewed-request-id>\" --teacher-confirmed \"true\"",
      sourcePaths: ["node plugins\\transparent-ai-apprentice\\scripts\\capture-triggered-visual-check.mjs --request \"queue.json\""],
      blockedClaims: ["capture_screenshots_without_teacher_confirmation"]
    },
    {
      id: "rollback_evidence_before_system_change",
      lane: "rollback_evidence_before_system_change",
      requirement: "Keep rollback.",
      currentEvidence: "rollback exists",
      missingProof: "Retain rollback.",
      nextSafeAction: "Keep rollback point.",
      verifierCommand:
        "node plugins\\transparent-ai-apprentice\\scripts\\create-rollback-point.mjs --label \"before-next\" --path \"package.json\"",
      sourcePaths: [rollbackPath],
      blockedClaims: ["delete_rollback_without_teacher_confirmation"]
    },
    {
      id: "transparent_sketch_spatial_intent_teacher_export",
      lane: "transparent_sketch_spatial_intent_teacher_export",
      requirement: "Validate spatial intent receipt.",
      currentEvidence: "request linked",
      missingProof: "Need teacher-exported overlay packet.",
      nextSafeAction: "Validate teacher-filled spatial intent receipt.",
      verifierCommand:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-spatial-intent-evidence-receipt.mjs --receipt \"<teacher-filled-spatial-intent-evidence-receipt.json>\"",
      sourcePaths: [],
      blockedClaims: ["claim_spatial_intent_understood_without_teacher_export"]
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});

const result = runScript("create-original-goal-completion-blocker-next-step-queue.mjs", [
  "--matrix",
  matrixPath,
  "--output-dir",
  join(smokeRoot, "queue")
]);
const queue = readJson(result.queuePath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");

const firstLane = queue.queueItems[0]?.lane;
const visualItem = queue.queueItems.find((item) => item.lane === "teacher_reviewed_triggered_visual_evidence_path");
const spatialItem = queue.queueItems.find((item) => item.lane === "transparent_sketch_spatial_intent_teacher_export");

const checks = [
  check(
    "Completion blocker next-step queue sorts low-token and rollback lanes before gated execution-like follow-up",
    result.format === "transparent_ai_original_goal_completion_blocker_next_step_queue_result_v1" &&
      queue.format === "transparent_ai_original_goal_completion_blocker_next_step_queue_v1" &&
      queue.status === "waiting_for_teacher_to_choose_one_completion_blocker_lane" &&
      firstLane === "rollback_evidence_before_system_change" &&
      queue.queueItems.some((item) => item.lane === "all_software_low_token_coverage_evidence") &&
      queue.counts.queueItems === 4,
    result.queuePath
  ),
  check(
    "Completion blocker next-step queue keeps risky visual capture gated and placeholders explicit",
    visualItem?.status === "gated_until_teacher_receipt_and_rollback" &&
      visualItem?.commandRisk?.matchedHighRiskMarkers?.includes("capture-triggered-visual-check.mjs") &&
      visualItem?.missingInputs?.includes("<teacher-reviewed-request-id>") &&
      spatialItem?.status === "waiting_for_placeholder_replacement",
    JSON.stringify({ visualStatus: visualItem?.status, spatialStatus: spatialItem?.status })
  ),
  check(
    "Completion blocker next-step queue preserves review-only locks and readable handoff pages",
    queue.locks.queueDoesNotRunCommands === true &&
      queue.locks.queueDoesNotExecuteTargetSoftware === true &&
      queue.locks.queueDoesNotCaptureScreenshots === true &&
      queue.locks.queueDoesNotWriteMemory === true &&
      queue.locks.goalComplete === false &&
      existsSync(result.htmlPath) &&
      existsSync(result.readmePath) &&
      html.includes("Original Goal Completion Blocker Next-Step Queue") &&
      html.includes("does not validate receipts, run commands") &&
      readme.includes("review-only next steps"),
    result.htmlPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const summary = {
  ok: passed === checks.length,
  format: "transparent_ai_original_goal_completion_blocker_next_step_queue_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  queuePath: result.queuePath,
  htmlPath: result.htmlPath,
  readmePath: result.readmePath,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
