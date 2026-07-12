#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "low-token-trigger-budget-plan", String(Date.now()));
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

const cyclePath = join(smokeRoot, "controlled-learning-cycle.json");
const visualQueuePath = join(smokeRoot, "automatic-triggered-visual-check-queue.json");
const preflightPath = join(smokeRoot, "low-token-operation-preflight-policy.json");

writeFileSync(
  cyclePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_low_token_learning_cycle_v1",
      metadataGateRuns: [
        {
          software: "ExampleCAD",
          changedLogMetadata: 1,
          scannedLogMetadata: 4,
          gatePath: "D:\\example\\metadata-gate.json"
        },
        {
          software: "QuietTool",
          changedLogMetadata: 0,
          scannedLogMetadata: 3,
          gatePath: "D:\\example\\quiet-metadata-gate.json"
        }
      ],
      watchRuns: [
        {
          watchCyclePath: "D:\\example\\watch-cycle.json",
          changedItems: [
            {
              software: "ExampleCAD",
              classifications: ["changed_low_token_signal"],
              screenshotRecommended: false
            },
            {
              software: "ExampleSim",
              classifications: ["ambiguous_state"],
              screenshotRecommended: true
            }
          ]
        }
      ],
      learningRuns: [
        {
          software: "ExampleCAD",
          compactEventCount: 2,
          classifications: ["changed_low_token_signal"],
          compactLearningEventsPath: "D:\\example\\compact-events.json"
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

writeFileSync(
  visualQueuePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_automatic_triggered_visual_check_queue_v1",
      requestCount: 1,
      requests: [
        {
          id: "automatic-visual-check-1",
          software: "ExampleSim",
          triggerReason: "ambiguous_state",
          learningCyclePath: cyclePath
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

writeFileSync(
  preflightPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_low_token_operation_preflight_policy_v1",
      preflightLanes: [
        {
          id: "low_token_observation_first",
          status: "evidence_present",
          evidencePath: cyclePath,
          nextReviewAction: "Review the low-token cycle."
        },
        {
          id: "voice_text_numbered_target_confirmation",
          status: "waiting_for_one_numbered_target",
          evidencePath: "",
          nextReviewAction: "Ask teacher to confirm exactly one number."
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

const planResult = runNodeScript("create-low-token-trigger-budget-plan.mjs", [
  "--goal",
  "Keep screenshots token-cheap after changed all-software evidence.",
  "--software",
  "ExampleCAD",
  "--learning-cycle",
  cyclePath,
  "--visual-check-queue",
  visualQueuePath,
  "--preflight-policy",
  preflightPath,
  "--token-budget",
  "5",
  "--output-dir",
  join(smokeRoot, "plans")
]);
const plan = readJson(planResult.planPath);
const html = readFileSync(planResult.htmlPath, "utf8");

const blockedResult = runNodeScript("create-low-token-trigger-budget-plan.mjs", [
  "--goal",
  "Blocked missing low-token evidence",
  "--output-dir",
  join(smokeRoot, "blocked")
]);
const blockedPlan = readJson(blockedResult.planPath);

const checks = [
  {
    name: "Low-token trigger budget plan selects compact evidence before screenshots",
    pass:
      plan.format === "transparent_ai_low_token_trigger_budget_plan_v1" &&
      plan.status === "waiting_for_teacher_low_token_trigger_budget_review" &&
      plan.selectedActions.some((row) => row.route === "bounded_tail_review_before_visual_check") &&
      plan.selectedActions.some((row) => row.route === "compact_learning_review_only") &&
      new Set(plan.selectedActions.map((row) => row.id)).size === plan.selectedActions.length &&
      plan.selectedEstimatedTokenCost <= 5,
    evidence: planResult.planPath
  },
  {
    name: "Low-token trigger budget plan keeps visual checks teacher-confirmed and bounded",
    pass:
      plan.deferredActions.some((row) => row.route === "one_screenshot_after_teacher_confirmation") &&
      plan.locks.screenshotsCaptured === false &&
      plan.locks.teacherConfirmationRequiredBeforeCapture === true &&
      plan.blockedActions.includes("screenshot_without_teacher_confirmation") &&
      html.includes("Low Token Trigger Budget Plan"),
    evidence: planResult.htmlPath
  },
  {
    name: "Low-token trigger budget plan blocks when there is no low-token evidence",
    pass:
      blockedPlan.status === "blocked_waiting_for_low_token_runner_cycle_visual_queue_or_preflight_policy" &&
      blockedPlan.selectedActionCount === 0 &&
      blockedPlan.locks.softwareActionsExecuted === false,
    evidence: blockedResult.planPath
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_low_token_trigger_budget_plan_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    plan: planResult.planPath,
    blockedPlan: blockedResult.planPath
  }
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
