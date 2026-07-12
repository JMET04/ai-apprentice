#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "execution-follow-up-handoff-item-command-builder-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

const queuePath = writeJson(join(smokeRoot, "execution-follow-up-handoff-queue.json"), {
  ok: true,
  format: "transparent_ai_all_software_execution_follow_up_handoff_queue_v1",
  status: "ready_for_manual_review",
  queueDecision: "manual_dry_run_runner_handoffs_ready",
  counts: { queueItems: 2, readyItems: 1 },
  queueItems: [
    {
      number: 1,
      id: "open_validation_readme",
      kind: "open_review_entry",
      label: "Open validation README",
      status: "ready_for_manual_review",
      safeForManualReviewHandoff: true,
      command: join(smokeRoot, "README.md")
    },
    {
      number: 2,
      id: "execution_follow_up_dry_run_002",
      rowId: "row-001",
      kind: "reviewed_dry_run_runner_command",
      label: "Run one reviewed execution dry-run",
      status: "ready_for_manual_review_handoff",
      safeForManualReviewHandoff: true,
      command: "Write-Output DISPLAY_ONLY_COMMAND_SHOULD_NOT_RUN",
      arguments: {
        queue: join(smokeRoot, "execution-pilot-queue.json"),
        pilotId: "pilot-001",
        adapterId: "existing-cli-or-script",
        execute: false,
        maxItems: 1
      },
      placeholders: []
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});

const builderResult = runScript("create-all-software-execution-follow-up-handoff-item-command-builder.mjs", [
  "--queue",
  queuePath,
  "--goal",
  "Smoke execution follow-up handoff item command builder.",
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.paths.builder);
const html = readFileSync(builderResult.paths.html, "utf8");
const readme = readFileSync(builderResult.paths.readme, "utf8");

const placeholderResult = runScript("create-all-software-execution-follow-up-handoff-item-command-builder.mjs", [
  "--goal",
  "Smoke placeholder execution follow-up handoff item command builder.",
  "--output-dir",
  join(smokeRoot, "placeholder-builder")
]);

const checks = [
  {
    name: "Execution follow-up handoff item command builder loads ready dry-run rows",
    pass:
      builder.format === "transparent_ai_execution_follow_up_handoff_item_command_builder_v1" &&
      builder.sourceQueueStatus === "ready_for_manual_review" &&
      builder.counts.readyDryRunItems === 1 &&
      builder.items.some((item) => item.number === 2 && item.rowId === "row-001"),
    evidence: builderResult.paths.builder
  },
  {
    name: "Execution follow-up handoff item command builder generates the structured dry-run item command",
    pass:
      builder.commandTemplate.includes("run-all-software-execution-follow-up-handoff-queue-item.mjs") &&
      builder.commandTemplate.includes("--row-id") &&
      builder.commandTemplate.includes("teacher-confirmed-execution-follow-up-dry-run-item-text") &&
      !builder.commandTemplate.includes("--execute") &&
      !builder.commandTemplate.includes("DISPLAY_ONLY_COMMAND_SHOULD_NOT_RUN"),
    evidence: builder.commandTemplate
  },
  {
    name: "Execution follow-up handoff item command builder writes a browser page and request generator",
    pass:
      html.includes("Execution Follow-Up Handoff Item Command Builder") &&
      html.includes("Download run request JSON") &&
      html.includes("run-all-software-execution-follow-up-handoff-queue-item.mjs") &&
      html.includes("teacher confirmed execution follow-up dry-run item") &&
      readme.includes("does not run the command") &&
      readme.includes("does not execute the queue display command string"),
    evidence: builderResult.paths.html
  },
  {
    name: "Execution follow-up handoff item command builder keeps all execution locks closed",
    pass:
      builder.locks.reviewOnly === true &&
      builder.locks.builderDoesNotRunHandoffItem === true &&
      builder.locks.builderDoesNotInvokeRunner === true &&
      builder.locks.builderDoesNotReadLogs === true &&
      builder.locks.builderDoesNotCaptureScreenshots === true &&
      builder.locks.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks.builderDoesNotSendUiEvents === true &&
      builder.locks.builderDoesNotWriteMemory === true &&
      builder.locks.allSoftwareExecutionComplete === false &&
      builder.locks.goalComplete === false,
    evidence: JSON.stringify(builder.locks)
  },
  {
    name: "Execution follow-up handoff item command builder can render before a queue path is available",
    pass:
      placeholderResult.status === "waiting_for_handoff_queue_path" &&
      placeholderResult.counts.readyDryRunItems === 0 &&
      placeholderResult.items[0].placeholders.includes("<execution-follow-up-handoff-queue.json>"),
    evidence: placeholderResult.paths.html
  }
];

const failed = checks.filter((check) => !check.pass);
const result = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_execution_follow_up_handoff_item_command_builder_smoke_v1",
  smokeRoot,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exit(1);
