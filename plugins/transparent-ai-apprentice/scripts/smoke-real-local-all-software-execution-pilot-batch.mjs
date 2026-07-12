#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-execution-pilot-batch-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 240000
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

const goal = "Run two reviewed all-software execution pilots as a bounded batch.";
const profilePath = join(smokeRoot, "batch-cli-control-profile.json");
writeFileSync(
  profilePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_software_control_channel_profile_v1",
      software: "Node.js batch controlled route proof",
      reviewedControlRoutes: [{ kind: "cli", route: "teacher-reviewed node-script command" }],
      notes: ["command", "cli", "script"],
      locks: { accepted: false, ruleEnabled: false, packagingGated: true, nativeUniversalExecution: false }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const rows = ["alpha", "beta"].map((name, index) => ({
  rowId: `row-${String(index + 1).padStart(3, "0")}`,
  software: `Node.js batch controlled route proof ${name}`,
  processName: "node.exe",
  windowTitle: "",
  status: "structured_control_route_reviewable",
  recommendedAdapters: ["existing-cli-or-script"],
  profilePath
}));
const coveragePath = join(smokeRoot, "control-channel-coverage-audit.json");
writeFileSync(
  coveragePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_control_channel_coverage_audit_v1",
      goal,
      rows,
      locks: { accepted: false, ruleEnabled: false, packagingGated: true, softwareActionsExecuted: false, nativeUniversalExecution: false }
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
  "2",
  "--create-adapter-packages",
  "--output-dir",
  join(smokeRoot, "execution-pilot-queue")
]);

const reviewedScriptPath = join(smokeRoot, "reviewed-batch-cli-route.mjs");
writeFileSync(
  reviewedScriptPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "writeFileSync(outputPath, JSON.stringify({ ok: true, proof: 'teacher-reviewed controlled batch cli route', createdAt: new Date().toISOString() }, null, 2) + '\\n', 'utf8');"
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
      targetOutputFileName: "controlled-batch-cli-output.json"
    },
    null,
    2
  )}\n`,
  "utf8"
);

const batchRun = runNodeScript("run-all-software-execution-pilot-batch.mjs", [
  "--queue",
  pilotQueue.queuePath,
  "--max-pilots",
  "2",
  "--adapter-id",
  "existing-cli-or-script",
  "--execute",
  "--teacher-confirmation",
  "teacher confirmed all-software execution pilot",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-marker",
  "teacher reviewed controlled batch output",
  "--output-dir",
  join(smokeRoot, "execution-pilot-batch")
]);

const batch = readJson(batchRun.batchPath);
const receipt = readJson(batchRun.receiptPath);
const completedRows = batch.pilotResults.filter((row) => row.controlledRouteActionExecuted);
const adapterReceipts = completedRows.map((row) => readJson(row.adapterReceiptPath));

const checks = [
  check(
    "Batch runner consumes one execution pilot queue and invokes multiple pilot runners",
    batch.format === "transparent_ai_all_software_execution_pilot_batch_v1" &&
      batch.counts.selectedPilots === 2 &&
      batch.counts.runnerInvocations === 2 &&
      batch.pilotResults.every((row) => row.runPath && existsSync(row.runPath)),
    batchRun.batchPath
  ),
  check(
    "Batch runner can complete two teacher-reviewed CLI pilot routes inside their execution packages",
    batch.counts.completedControlledRoutes === 2 &&
      adapterReceipts.every((item) => item.status === "teacher_confirmed_cli_script_executed" && item.commandExecuted === true),
    adapterReceipts.map((item) => item.cliOutputPath).join("; ")
  ),
  check(
    "Batch runner creates outcome verification and post-action checkpoint for every selected pilot",
    batch.counts.outcomeVerificationCount === 2 &&
      batch.counts.postActionCheckpointCount === 2 &&
      batch.pilotResults.every((row) => existsSync(row.outcomeVerificationPath) && existsSync(row.postActionCheckpointPath)),
    JSON.stringify(batch.counts)
  ),
  check(
    "Batch runner keeps all-software completion and native execution claims locked",
    receipt.locks.nativeUniversalExecution === false &&
      receipt.locks.allSoftwareExecutionComplete === false &&
      receipt.accepted === false &&
      receipt.ruleEnabled === false &&
      receipt.packagingGated === true,
    JSON.stringify(receipt.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_execution_pilot_batch_smoke_v1",
  smokeRoot,
  counts: batch.counts,
  paths: {
    coverageAudit: coveragePath,
    pilotQueue: pilotQueue.queuePath,
    reviewedCommand: reviewedCommandPath,
    batch: batchRun.batchPath,
    receipt: batchRun.receiptPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
