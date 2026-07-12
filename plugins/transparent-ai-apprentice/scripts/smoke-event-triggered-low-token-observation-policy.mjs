#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "event-triggered-low-token-observation-policy", String(Date.now()));
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

const cyclePath = join(smokeRoot, "all-software-low-token-learning-cycle.json");
const visualQueuePath = join(smokeRoot, "automatic-triggered-visual-check-queue.json");

writeFileSync(
  cyclePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_low_token_learning_cycle_v1",
      metadataGateRuns: [
        {
          software: "SpreadsheetDesigner",
          changedLogMetadata: 2,
          scannedLogMetadata: 6,
          gatePath: "D:\\example\\spreadsheet-metadata-gate.json"
        }
      ],
      watchRuns: [
        {
          watchCyclePath: "D:\\example\\watch-cycle.json",
          changedItems: [
            {
              software: "MeshViewer",
              classifications: ["ambiguous_or_teacher_marker"],
              screenshotRecommended: true
            }
          ]
        }
      ],
      learningRuns: [
        {
          software: "SpreadsheetDesigner",
          compactEventCount: 3,
          classifications: ["success_state_change"],
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
      requests: [
        {
          id: "meshviewer-ambiguous-1",
          software: "MeshViewer",
          triggerReason: "ambiguous_or_teacher_marker",
          learningCyclePath: cyclePath
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

const budgetResult = runNodeScript("create-low-token-trigger-budget-plan.mjs", [
  "--goal",
  "Use changed logs to decide whether a visual check is worth the token cost.",
  "--learning-cycle",
  cyclePath,
  "--visual-check-queue",
  visualQueuePath,
  "--token-budget",
  "6",
  "--output-dir",
  join(smokeRoot, "budget")
]);
const budgetPlan = readJson(budgetResult.planPath);

const policyResult = runNodeScript("create-event-triggered-low-token-observation-policy.mjs", [
  "--budget-plan",
  budgetResult.planPath,
  "--goal",
  "Convert all-software changed evidence into event-triggered low-token observation policy.",
  "--output-dir",
  join(smokeRoot, "policy")
]);
const policy = readJson(policyResult.policyPath);
const receipt = readJson(policyResult.receiptTemplatePath);
const html = readFileSync(policyResult.htmlPath, "utf8");

const blockedResult = runNodeScript("create-event-triggered-low-token-observation-policy.mjs", [
  "--goal",
  "Blocked without a budget plan.",
  "--output-dir",
  join(smokeRoot, "blocked")
]);
const blockedPolicy = readJson(blockedResult.policyPath);

const checks = [
  {
    name: "Event-triggered policy reuses low-token budget plan instead of continuous recording",
    pass:
      policy.format === "transparent_ai_event_triggered_low_token_observation_policy_v1" &&
      policy.status === "waiting_for_teacher_event_trigger_policy_review" &&
      policy.decisionLadder.some((row) => row.stage === "metadata_only_watch" && row.existingTool === "watch_log_source_metadata_deltas") &&
      policy.decisionLadder.some((row) => row.stage === "one_bounded_screenshot" && row.existingTool === "capture_triggered_visual_check") &&
      policy.decisionLadder.some(
        (row) =>
          row.stage === "voice_text_numbered_target_workbench" &&
          row.existingTool === "create_triggered_visual_evidence_voice_control_workbench"
      ) &&
      policy.locks.continuousRecording === false &&
      policy.locks.fullContinuousRecording === false,
    evidence: policyResult.policyPath
  },
  {
    name: "Event-triggered policy keeps compact evidence before screenshots",
    pass:
      budgetPlan.selectedActions.some((row) => row.route === "bounded_tail_review_before_visual_check") &&
      policy.triggerRows.some((row) => row.lowTokenDecision === "review_compact_evidence_before_visual_tokens" && row.maxScreenshots === 0) &&
      policy.compactRowsCount > 0,
    evidence: budgetResult.planPath
  },
  {
    name: "Event-triggered policy allows only teacher-confirmed single visual checks",
    pass:
      policy.triggerRows.some(
        (row) =>
          row.lowTokenDecision === "ask_teacher_before_one_bounded_screenshot" &&
          row.maxScreenshots === 1 &&
          row.screenshotAllowedNow === false
      ) &&
      policy.locks.screenshotAllowedWithoutTeacher === false &&
      policy.locks.maxScreenshotsPerTrigger === 1 &&
      policy.blockedActions.includes("periodic_screenshot_stream") &&
      policy.blockedActions.includes("execute_from_voice_without_numbered_target_confirmation") &&
      policy.nextCaptureCommandTemplate.includes("capture-triggered-visual-check.mjs"),
    evidence: policyResult.htmlPath
  },
  {
    name: "Event-triggered policy bridges one visual trigger into voice text numbered-target workbench",
    pass:
      policy.nextTriggeredVisualVoiceControlWorkbenchCommandTemplate.includes(
        "create-triggered-visual-evidence-voice-control-workbench.mjs"
      ) &&
      policy.nextTriggeredVisualVoiceControlWorkbenchCommandTemplate.includes("<triggered-visual-evidence-learning-handoff.json>") &&
      policy.paths.triggeredVisualVoiceControlWorkbenchCommandTemplate === policy.nextTriggeredVisualVoiceControlWorkbenchCommandTemplate &&
      receipt.nextTriggeredVisualVoiceControlWorkbenchCommandTemplate === policy.nextTriggeredVisualVoiceControlWorkbenchCommandTemplate &&
      policy.decisionLadder.some(
        (row) =>
          row.stage === "triggered_visual_learning_handoff" &&
          row.nextWhenActionNeeded === "voice_text_numbered_target_workbench"
      ) &&
      policy.decisionLadder.some(
        (row) =>
          row.stage === "voice_text_numbered_target_workbench" &&
          row.nextWhenTeacherConfirmsOneNumber === "separate_execution_gate"
      ),
    evidence: policyResult.policyPath
  },
  {
    name: "Event-triggered policy receipt cannot accept execute capture memory or packaging",
    pass:
      receipt.format === "transparent_ai_event_triggered_low_token_observation_policy_receipt_v1" &&
      receipt.defaultDecision === "needs_teacher_review" &&
      receipt.rollbackPointReviewed === false &&
      receipt.forbiddenDecisions.includes("execute_now") &&
      receipt.forbiddenDecisions.includes("capture_now") &&
      receipt.forbiddenDecisions.includes("write_memory") &&
      receipt.forbiddenDecisions.includes("unlock_packaging") &&
      receipt.nextReceiptBuilderCommandTemplate.includes("create-event-triggered-low-token-observation-policy-receipt-builder.mjs") &&
      receipt.nextValidationCommandTemplate.includes("validate-event-triggered-low-token-observation-policy-receipt.mjs") &&
      receipt.nextValidationCommandTemplate.includes("<teacher-filled-event-triggered-low-token-observation-policy-receipt.json>") &&
      receipt.rowReceipts.every((row) => row.locks.captureNow === false && row.locks.executeNow === false),
    evidence: policyResult.receiptTemplatePath
  },
  {
    name: "Event-triggered policy blocks when no budget plan is available",
    pass:
      blockedPolicy.status === "blocked_waiting_for_low_token_trigger_budget_plan" &&
      blockedPolicy.triggerRows.length === 0 &&
      blockedPolicy.locks.softwareActionsExecuted === false,
    evidence: blockedResult.policyPath
  },
  {
    name: "Event-triggered policy HTML states the low-token decision ladder",
    pass:
      html.includes("metadata-only watch") &&
      html.includes("at most one teacher-confirmed screenshot") &&
      html.includes("optional voice/text numbered-target workbench") &&
      html.includes("No continuous recording"),
    evidence: policyResult.htmlPath
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_event_triggered_low_token_observation_policy_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    budgetPlan: budgetResult.planPath,
    policy: policyResult.policyPath,
    receiptTemplate: policyResult.receiptTemplatePath
  }
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
