#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = process.cwd();
const root = mkdtempSync(join(tmpdir(), "ta-post-registration-witness-entry-"));

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNodeScript(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${script} failed`);
  }
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

const sourceHtml = writeJson(join(root, "source-html-placeholder.json"), { placeholder: true });
const sourceBuilderPath = writeJson(join(root, "source-witness-builder.json"), {
  format: "transparent_ai_operational_post_registration_output_witness_command_builder_v1",
  status: "operational_post_registration_output_witness_command_builder_waiting_for_matching_status",
  registrationStatus: {
    status: "verified_not_registered_yet",
    blockers: ["registration_status_not_registered_and_matching_reviewed_runner"]
  },
  approvedRunner: {
    blockers: ["missing_final_teacher_registration_confirmation"]
  },
  operationalScopeSummary: {
    blockers: ["operational_scope_not_teacher_reviewed"]
  },
  commandTemplate:
    "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-operational-learning-post-registration-output-witness-runner.mjs --registration-status \"<registered-and-matching-recurring-monitor-status.json>\" --trigger-reviewed-output --allow-runner-trigger --teacher-confirmation \"<teacher-confirmation>\"",
  paths: {
    builder: join(root, "source-witness-builder.json"),
    html: sourceHtml,
    readme: ""
  }
});

const result = runNodeScript("create-current-goal-post-registration-witness-teacher-confirmation-entry.mjs", [
  "--witness-command-builder",
  sourceBuilderPath,
  "--output-dir",
  join(root, "entry"),
  "--goal",
  "Smoke post-registration witness teacher confirmation entry"
]);
const entry = readJson(result.entryPath);
const html = readFileSync(result.htmlPath, "utf8");
const receiptTemplate = readJson(result.receiptTemplatePath);

const checks = [
  {
    name: "Post-registration witness teacher confirmation entry points to the supplied latest witness builder",
    pass: entry.paths.sourceWitnessCommandBuilder === sourceBuilderPath && entry.paths.sourceWitnessCommandBuilderHtml === sourceHtml,
    evidence: entry.paths.sourceWitnessCommandBuilder
  },
  {
    name: "Post-registration witness teacher confirmation entry exposes current blockers without running the runner",
    pass:
      entry.blockers.includes("registration_status_not_registered_and_matching_reviewed_runner") &&
      entry.blockers.includes("missing_final_teacher_registration_confirmation") &&
      entry.locks.entryDoesNotRunCommands === true &&
      entry.locks.runnerLaunched === false,
    evidence: entry.blockers
  },
  {
    name: "Post-registration witness teacher confirmation entry writes browser receipt template and keeps completion locked",
    pass:
      existsSync(result.htmlPath) &&
      html.includes("Post-Registration Witness Teacher Confirmation") &&
      receiptTemplate.defaultDecision === "needs_teacher_review" &&
      receiptTemplate.blockedDecisions.includes("goal_complete") &&
      entry.locks.goalComplete === false,
    evidence: result.htmlPath
  },
  {
    name: "Post-registration witness teacher confirmation entry blocks registration, screenshots, target execution, memory, rules, and packaging",
    pass:
      entry.locks.entryDoesNotRegisterTask === true &&
      entry.locks.entryDoesNotCaptureScreenshots === true &&
      entry.locks.entryDoesNotExecuteTargetSoftware === true &&
      entry.locks.entryDoesNotWriteMemory === true &&
      entry.locks.entryDoesNotEnableRules === true &&
      entry.locks.packagingGated === true,
    evidence: entry.locks
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(JSON.stringify({ status: "failed", checks }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      smoke: "transparent_ai_current_goal_post_registration_witness_teacher_confirmation_entry_smoke_v1",
      entryPath: result.entryPath,
      checks
    },
    null,
    2
  )
);
