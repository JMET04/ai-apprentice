#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const smokeRoot = join(repoRoot, ".transparent-apprentice", "triggered-visual-check-command-builder-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runScript(script, args = []) {
  const result = spawnSync("node", [join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const learningCyclePath = join(smokeRoot, "all-software-low-token-learning-cycle.json");
writeFileSync(
  learningCyclePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_low_token_learning_cycle_v1",
      counts: { compactLearningEvents: 1, screenshotRequests: 0 },
      watchRuns: [
        {
          watchCyclePath: join(smokeRoot, "watch-cycle.json"),
          changedItems: [
            {
              queueItemId: "cad-json-editor",
              software: "ExampleCAD",
              processName: "examplecad.exe",
              changedLogCount: 2,
              classifications: ["warning_changed_geometry_state"],
              screenshotRecommended: true
            }
          ]
        }
      ],
      metadataGateRuns: [],
      learningRuns: []
    },
    null,
    2
  )}\n`,
  "utf8"
);

const queueResult = runScript("create-automatic-triggered-visual-check-queue.mjs", [
  "--learning-cycle",
  learningCyclePath,
  "--goal",
  "smoke visual command builder queue",
  "--output-dir",
  join(smokeRoot, "queue")
]);
const queue = readJson(queueResult.queuePath);

const builderResult = runScript("create-triggered-visual-check-command-builder.mjs", [
  "--queue",
  queueResult.queuePath,
  "--goal",
  "smoke build one low-token visual check command page",
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const html = readFileSync(builderResult.htmlPath, "utf8");
const readme = readFileSync(builderResult.readmePath, "utf8");

const placeholderResult = runScript("create-triggered-visual-check-command-builder.mjs", [
  "--goal",
  "smoke build placeholder visual check command page",
  "--output-dir",
  join(smokeRoot, "placeholder-builder")
]);
const placeholderBuilder = readJson(placeholderResult.builderPath);
const placeholderHtml = readFileSync(placeholderResult.htmlPath, "utf8");

const checks = [
  check(
    "Triggered visual check command builder supports automatic low-token visual queues",
    builder.format === "transparent_ai_triggered_visual_check_command_builder_v1" &&
      builder.requestKind === "automatic_triggered_visual_check_queue" &&
      builder.status === "waiting_for_teacher_single_visual_check_command_generation" &&
      builder.requests.some((request) => request.id === "automatic-visual-check-1") &&
      builder.commandTemplates.captureReviewedSourceImage.includes("capture-triggered-visual-check.mjs") &&
      builder.commandTemplates.captureReviewedSourceImage.includes("--reviewed-source-image") &&
      builder.commandTemplates.captureActiveScreenOnce.includes("--capture-active-screen") &&
      builder.commandTemplates.learningHandoffAfterCapture.includes("create-triggered-visual-evidence-learning-handoff.mjs") &&
      builder.commandTemplates.voiceWorkbenchAfterHandoff.includes("create-triggered-visual-evidence-voice-control-workbench.mjs"),
    builderResult.builderPath
  ),
  check(
    "Triggered visual check command builder writes a browser command page",
    html.includes("Triggered Visual Check Command Builder") &&
      html.includes("Generate capture command") &&
      html.includes("Generate learning handoff command") &&
      html.includes("Generate voice-control workbench command") &&
      html.includes("Download visual check command request JSON") &&
      html.includes("capture-triggered-visual-check.mjs") &&
      readme.includes("This builder only creates command text"),
    builderResult.htmlPath
  ),
  check(
    "Triggered visual check command builder keeps screenshots and execution locked",
    builder.locks.builderDoesNotRunCapture === true &&
      builder.locks.builderDoesNotCaptureScreenshots === true &&
      builder.locks.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks.screenshotsCaptured === false &&
      builder.locks.fullContinuousRecording === false &&
      builder.locks.memoryWritten === false &&
      builder.locks.goalComplete === false,
    builderResult.builderPath
  ),
  check(
    "Triggered visual check command builder can render before a queue path is available",
    placeholderBuilder.status === "waiting_for_teacher_visual_check_queue_path" &&
      placeholderBuilder.requestKind === "queue_not_loaded_yet" &&
      placeholderBuilder.requests[0].status === "waiting_for_queue_path" &&
      placeholderHtml.includes("&lt;automatic-triggered-visual-check-queue.json&gt;"),
    placeholderResult.builderPath
  ),
  check(
    "Automatic queue fixture remains low-token before visual capture",
    queue.locks.screenshotsCaptured === false &&
      queue.locks.fullContinuousRecording === false &&
      queue.requests[0].captureOnlyAfterReview === true,
    queueResult.queuePath
  )
];

const failed = checks.filter((row) => !row.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_triggered_visual_check_command_builder_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    queue: queueResult.queuePath,
    builder: builderResult.builderPath,
    html: builderResult.htmlPath,
    placeholderBuilder: placeholderResult.builderPath
  }
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
