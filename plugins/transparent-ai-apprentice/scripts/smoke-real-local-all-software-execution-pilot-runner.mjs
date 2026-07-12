#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-execution-pilot-runner-smoke", String(Date.now()));
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

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const goal =
  "Run one teacher-reviewed all-software execution pilot through an existing CLI route and low-token verification.";

const profilePath = join(smokeRoot, "node-local-cli-control-profile.json");
writeFileSync(
  profilePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_software_control_channel_profile_v1",
      software: "Node.js local controlled route proof",
      reviewedControlRoutes: [
        {
          kind: "cli",
          route: "teacher-reviewed node-script command",
          evidence: "Local Node runtime is used as an existing CLI/script route for this controlled proof."
        }
      ],
      notes: ["command", "cli", "script", "powershell-safe wrapper"],
      locks: { accepted: false, ruleEnabled: false, packagingGated: true, nativeUniversalExecution: false }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const coveragePath = join(smokeRoot, "control-channel-coverage-audit.json");
writeFileSync(
  coveragePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_control_channel_coverage_audit_v1",
      goal,
      rows: [
        {
          rowId: "row-001",
          software: "Node.js local controlled route proof",
          processName: "node.exe",
          windowTitle: "",
          status: "structured_control_route_reviewable",
          recommendedAdapters: ["existing-cli-or-script"],
          profilePath
        }
      ],
      locks: {
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const pilotQueue = runNodeScript("create-all-software-execution-pilot-queue.mjs", [
  "--goal",
  goal,
  "--coverage-audit",
  coveragePath,
  "--max-pilots",
  "1",
  "--create-adapter-packages",
  "--output-dir",
  join(smokeRoot, "execution-pilot-queue")
]);

const reviewedScriptPath = join(smokeRoot, "reviewed-controlled-cli-route.mjs");
writeFileSync(
  reviewedScriptPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "writeFileSync(outputPath, JSON.stringify({ ok: true, proof: 'teacher-reviewed controlled cli route', createdAt: new Date().toISOString() }, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);

const reviewedCommandPath = join(smokeRoot, "reviewed-command-manifest.json");
writeFileSync(
  reviewedCommandPath,
  `${JSON.stringify(
    {
      teacherReviewed: true,
      commandKind: "node-script",
      scriptSourceFile: reviewedScriptPath,
      expectedScriptSha256: sha256(reviewedScriptPath),
      targetOutputFileName: "controlled-cli-output.json"
    },
    null,
    2
  )}\n`,
  "utf8"
);

const pilotRun = runNodeScript("run-all-software-execution-pilot-runner.mjs", [
  "--queue",
  pilotQueue.queuePath,
  "--pilot-id",
  "pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--execute",
  "--teacher-confirmation",
  "teacher confirmed all-software execution pilot",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-marker",
  "teacher reviewed controlled cli output",
  "--output-dir",
  join(smokeRoot, "execution-pilot-run")
]);

const runPacket = readJson(pilotRun.runPath);
const runnerReceipt = readJson(pilotRun.receiptPath);
const adapterReceipt = readJson(pilotRun.adapterReceiptPath);
const outputFile = adapterReceipt.cliOutputPath;
const output = existsSync(outputFile) ? readJson(outputFile) : null;

const checks = [
  check(
    "Pilot runner consumes an all-software execution pilot queue and selects one adapter runner",
    runPacket.format === "transparent_ai_all_software_execution_pilot_runner_v1" &&
      runPacket.sourceEvidence.executionPilotQueuePath === pilotQueue.queuePath &&
      runPacket.pilotId === "pilot-001" &&
      runPacket.adapterId === "existing-cli-or-script" &&
      runPacket.runnerInvoked === true,
    pilotRun.runPath
  ),
  check(
    "Pilot runner can execute a teacher-reviewed existing CLI route inside the execution package",
    pilotRun.status === "teacher_confirmed_route_action_completed_waiting_for_teacher_review" &&
      adapterReceipt.status === "teacher_confirmed_cli_script_executed" &&
      adapterReceipt.commandExecuted === true &&
      output?.proof === "teacher-reviewed controlled cli route",
    outputFile
  ),
  check(
    "Pilot runner verifies outcome and creates a post-action checkpoint before screenshots or learning",
    existsSync(pilotRun.outcomeVerificationPath) &&
      existsSync(pilotRun.postActionCheckpointPath) &&
      runnerReceipt.outcomeStatus &&
      runnerReceipt.checkpointStatus,
    `${pilotRun.outcomeVerificationPath}; ${pilotRun.postActionCheckpointPath}`
  ),
  check(
    "Pilot runner keeps universal execution, screenshots, memory, acceptance, rules, and packaging locked",
    runnerReceipt.nativeUniversalExecution === false &&
      runnerReceipt.allSoftwareExecutionComplete === false &&
      runnerReceipt.accepted === false &&
      runnerReceipt.ruleEnabled === false &&
      runnerReceipt.packagingGated === true &&
      runnerReceipt.locks.screenshotsCaptured === false &&
      runnerReceipt.locks.memoryWritten === false,
    JSON.stringify(runnerReceipt.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_execution_pilot_runner_smoke_v1",
  smokeRoot,
  paths: {
    coverageAudit: coveragePath,
    pilotQueue: pilotQueue.queuePath,
    reviewedCommand: reviewedCommandPath,
    pilotRun: pilotRun.runPath,
    runnerReceipt: pilotRun.receiptPath,
    adapterReceipt: pilotRun.adapterReceiptPath,
    controlledOutput: outputFile,
    outcomeVerification: pilotRun.outcomeVerificationPath,
    postActionCheckpoint: pilotRun.postActionCheckpointPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
