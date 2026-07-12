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
    : join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-lane-command-builder-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const evidencePath = writeJson(join(smokeRoot, "evidence", "coverage-ledger.json"), {
  format: "fixture_coverage_ledger_v1"
});
const queuePath = writeJson(join(smokeRoot, "queue", "original-goal-completion-blocker-next-step-queue.json"), {
  ok: true,
  format: "transparent_ai_original_goal_completion_blocker_next_step_queue_v1",
  status: "waiting_for_teacher_to_choose_one_completion_blocker_lane",
  queueItems: [
    {
      id: "completion_blocker_next_step_all_software_low_token_coverage_evidence",
      number: 1,
      order: 1,
      lane: "all_software_low_token_coverage_evidence",
      status: "ready_for_review_only_manual_follow_up",
      nextSafeAction: "Open compact coverage evidence.",
      commandTemplate:
        "node plugins\\transparent-ai-apprentice\\scripts\\create-original-goal-current-status-refresh.mjs --goal \"refresh\"",
      missingInputs: [],
      evidenceLinks: [
        {
          kind: "existing_file",
          value: evidencePath,
          exists: true,
          basename: "coverage-ledger.json"
        }
      ],
      blockedClaims: ["claim_all_software_low_token_coverage_complete"]
    },
    {
      id: "completion_blocker_next_step_teacher_reviewed_triggered_visual_evidence_path",
      number: 2,
      order: 2,
      lane: "teacher_reviewed_triggered_visual_evidence_path",
      status: "gated_until_teacher_receipt_and_rollback",
      nextSafeAction: "Open visual command builder.",
      commandTemplate:
        "node plugins\\transparent-ai-apprentice\\scripts\\capture-triggered-visual-check.mjs --selected-request-id \"<teacher-reviewed-request-id>\" --teacher-confirmed \"true\"",
      missingInputs: ["<teacher-reviewed-request-id>"],
      evidenceLinks: [],
      blockedClaims: ["capture_screenshots_without_teacher_confirmation"]
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    goalComplete: false
  }
});

const result = runScript("create-original-goal-completion-blocker-lane-command-builder.mjs", [
  "--queue",
  queuePath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(result.builderPath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");
const firstOfflineRequest = readJson(builder.items[0].requestPath);
const firstOfflineCommand = readFileSync(builder.items[0].commandSnippetPath, "utf8");
const recommendedOfflineRequest = readJson(builder.items.find((item) => item.goalProgressLane).requestPath);

const checks = [
  check(
    "Completion blocker lane command builder reads a next-step queue and preserves lane ordering",
    result.format === "transparent_ai_original_goal_completion_blocker_lane_command_builder_result_v1" &&
      builder.format === "transparent_ai_original_goal_completion_blocker_lane_command_builder_v1" &&
      builder.status === "waiting_for_teacher_single_completion_blocker_lane_command_generation" &&
      builder.counts.queueItems === 2 &&
      builder.counts.offlineRequestPackets === 2 &&
      builder.recommendedGoalLane === "all_software_low_token_coverage_evidence" &&
      builder.counts.goalProgressLanePackets === 1 &&
      builder.items[0].defaultSelected === true &&
      builder.items[0].goalProgressLane === true &&
      builder.items[0].lane === "all_software_low_token_coverage_evidence" &&
      builder.items[1].status === "gated_until_teacher_receipt_and_rollback",
    result.builderPath
  ),
  check(
    "Completion blocker lane command builder writes a browser request generator",
    existsSync(result.htmlPath) &&
      existsSync(result.readmePath) &&
      html.includes("Original Goal Completion Blocker Lane Command Builder") &&
      html.includes("Generate lane command/request") &&
      html.includes("Recommended goal-progress lane") &&
      html.includes("goalProgressLane") &&
      html.includes("original_goal_completion_blocker_lane_command_request_v1") &&
      html.includes("teacher_reviewed_triggered_visual_evidence_path") &&
      html.includes("Offline Request") &&
      readme.includes("only creates command text and request JSON"),
    result.htmlPath
  ),
  check(
    "Completion blocker lane command builder writes offline request packets for low-token handoff",
    existsSync(builder.paths.requestPacketsDir) &&
      existsSync(builder.items[0].requestPath) &&
      existsSync(builder.items[0].commandSnippetPath) &&
      firstOfflineRequest.format === "transparent_ai_original_goal_completion_blocker_lane_command_request_v1" &&
      firstOfflineRequest.generatedMode === "offline_request_packet" &&
      firstOfflineRequest.recommendedGoalLane === "all_software_low_token_coverage_evidence" &&
      firstOfflineRequest.goalProgressLane === true &&
      recommendedOfflineRequest.priorityReason.includes("original objective") &&
      firstOfflineRequest.nextReceiptBuilderCommand.includes(
        "create-original-goal-completion-blocker-lane-request-receipt-builder.mjs"
      ) &&
      firstOfflineRequest.nextReceiptBuilderCommand.includes(builder.items[0].requestPath) &&
      firstOfflineCommand.includes("# Next review-only receipt-builder command:") &&
      builder.items[0].receiptBuilderCommand === firstOfflineRequest.nextReceiptBuilderCommand,
    builder.items[0].requestPath
  ),
  check(
    "Completion blocker lane command builder keeps execution and acceptance locks closed",
    builder.locks.builderDoesNotRunCommands === true &&
      builder.locks.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks.builderDoesNotCaptureScreenshots === true &&
      builder.locks.builderDoesNotWriteMemory === true &&
      builder.locks.accepted === false &&
      builder.locks.ruleEnabled === false &&
      builder.locks.packagingGated === true &&
      builder.locks.goalComplete === false,
    JSON.stringify(builder.locks)
  ),
  check(
    "Completion blocker lane command builder can render before a queue path is available",
    (() => {
      const empty = runScript("create-original-goal-completion-blocker-lane-command-builder.mjs", [
        "--output-dir",
        join(smokeRoot, "builder-empty")
      ]);
      const emptyBuilder = readJson(empty.builderPath);
      const emptyHtml = readFileSync(empty.htmlPath, "utf8");
      return (
        emptyBuilder.status === "waiting_for_completion_blocker_next_step_queue_path" &&
        emptyBuilder.items[0].missingInputs.includes("<original-goal-completion-blocker-next-step-queue.json>") &&
        existsSync(emptyBuilder.items[0].requestPath || "") &&
        emptyHtml.includes("waiting_for_completion_blocker_next_step_queue")
      );
    })(),
    "empty builder rendered"
  )
];

const passed = checks.filter((item) => item.pass).length;
const summary = {
  ok: passed === checks.length,
  format: "transparent_ai_original_goal_completion_blocker_lane_command_builder_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  builderPath: result.builderPath,
  htmlPath: result.htmlPath,
  readmePath: result.readmePath,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
