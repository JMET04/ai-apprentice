#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = resolve(process.cwd());
const gateSmokeRoot = join(root, ".ta-smoke", "real-case-adapter-specific-runner-approval-gate");
const smokeRoot = join(root, ".ta-smoke", "real-case-separate-real-runner");
mkdirSync(smokeRoot, { recursive: true });

function runNode(args, { expectOk = true } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (expectOk && result.status !== 0) throw new Error(result.stderr || result.stdout || args.join(" "));
  if (!expectOk && result.status === 0) throw new Error(`Expected failure: ${args.join(" ")}`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function findFiles(rootDir, fileName) {
  const output = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!existsSync(current)) continue;
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) stack.push(join(current, entry));
    } else if (current.endsWith(fileName)) {
      output.push(current);
    }
  }
  output.sort();
  return output;
}

function latestFile(rootDir, fileName) {
  const files = findFiles(rootDir, fileName);
  if (!files.length) throw new Error(`Missing ${fileName} under ${rootDir}`);
  return files[files.length - 1];
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const gateSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-adapter-specific-runner-approval-gate.mjs"]).stdout
);
const gatePath = latestFile(join(gateSmokeRoot, "approved-gate"), "real-case-adapter-specific-runner-approval-gate.json");
const freshRollbackPoint = join(smokeRoot, "fresh-rollback-point");
mkdirSync(freshRollbackPoint, { recursive: true });
writeJson(join(freshRollbackPoint, "rollback-anchor.json"), {
  format: "transparent_ai_real_case_separate_real_runner_smoke_rollback_anchor_v1",
  createdAt: new Date().toISOString()
});

const reviewedScriptPath = join(smokeRoot, "reviewed-real-case-runner-script.mjs");
writeFileSync(
  reviewedScriptPath,
  [
    "#!/usr/bin/env node",
    "import { mkdirSync, writeFileSync } from 'node:fs';",
    "import { dirname } from 'node:path';",
    "const outputIndex = process.argv.indexOf('--output');",
    "const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : '';",
    "if (!output) throw new Error('missing --output');",
    "mkdirSync(dirname(output), { recursive: true });",
    "writeFileSync(output, JSON.stringify({ format: 'transparent_ai_real_case_controlled_output_v1', operation: 'packaging_dieline_update_proof', ok: true }, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);
const reviewedManifestPath = writeJson(join(smokeRoot, "reviewed-runner-manifest.json"), {
  format: "transparent_ai_real_case_reviewed_node_runner_manifest_v1",
  teacherReviewed: true,
  commandKind: "node-script",
  scriptSourceFile: reviewedScriptPath,
  expectedScriptSha256: hashFile(reviewedScriptPath),
  targetOutputFileName: "controlled-real-case-output.json",
  timeoutMs: 30000
});

const blockedResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/run-real-case-separate-real-runner.mjs",
      "--approval-gate",
      gatePath,
      "--fresh-rollback-point",
      freshRollbackPoint,
      "--reviewed-runner-manifest",
      reviewedManifestPath,
      "--out-dir",
      join(smokeRoot, "blocked-run")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Real-case separate real runner blocks without final execute confirmation",
  blockedResult.status === "blocked_before_real_case_separate_real_runner" &&
    blockedResult.blockers.some((row) => row.code === "missing_execute_final_run_flag") &&
    blockedResult.blockers.some((row) => row.code === "missing_final_teacher_confirmation") &&
    blockedResult.runnerInvoked === false,
  JSON.stringify({ blockers: blockedResult.blockers })
);

const readyResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/run-real-case-separate-real-runner.mjs",
    "--approval-gate",
    gatePath,
    "--fresh-rollback-point",
    freshRollbackPoint,
    "--reviewed-runner-manifest",
    reviewedManifestPath,
    "--execute-final-run",
    "--teacher-confirmation",
    "teacher confirmed real-case separate real runner",
    "--out-dir",
    join(smokeRoot, "ready-run")
  ]).stdout
);
const readyPacket = readJson(readyResult.runPath);
const readyReceipt = readJson(readyResult.receiptPath);
const controlledOutput = readyResult.outputPath && existsSync(readyResult.outputPath) ? readJson(readyResult.outputPath) : null;
check(
  "Real-case separate real runner executes one reviewed local manifest into controlled output",
  readyResult.format === "transparent_ai_real_case_separate_real_runner_result_v1" &&
    readyResult.status === "real_case_separate_real_runner_completed_waiting_for_teacher_outcome_review" &&
    readyResult.runnerInvoked === true &&
    readyResult.adapterInvoked === true &&
    readyResult.controlledRouteActionExecuted === true &&
    readyResult.targetSoftwareCommandsExecuted === true &&
    readyResult.uiEventsSent === false &&
    readyResult.memoryWritten === false &&
    readyResult.ragFetched === false &&
    readyResult.packagingUnlocked === false &&
    readyResult.goalComplete === false &&
    controlledOutput?.format === "transparent_ai_real_case_controlled_output_v1" &&
    readyPacket.locks?.filesWrittenOutsideRunDir === false &&
    readyReceipt.teacherReview?.nextDecision === "needs_teacher_review",
  JSON.stringify({ outputPath: readyResult.outputPath })
);

const missingRollbackResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/run-real-case-separate-real-runner.mjs",
      "--approval-gate",
      gatePath,
      "--fresh-rollback-point",
      join(smokeRoot, "missing-rollback"),
      "--reviewed-runner-manifest",
      reviewedManifestPath,
      "--execute-final-run",
      "--teacher-confirmation",
      "teacher confirmed real-case separate real runner",
      "--out-dir",
      join(smokeRoot, "missing-rollback-run")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Real-case separate real runner requires fresh rollback point",
  missingRollbackResult.status === "blocked_before_real_case_separate_real_runner" &&
    missingRollbackResult.blockers.some((row) => row.code === "fresh_rollback_point_not_found") &&
    missingRollbackResult.runnerInvoked === false,
  JSON.stringify({ blockers: missingRollbackResult.blockers })
);

const tamperedManifestPath = writeJson(join(smokeRoot, "tampered-reviewed-runner-manifest.json"), {
  ...readJson(reviewedManifestPath),
  expectedScriptSha256: "0".repeat(64)
});
const tamperedResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/run-real-case-separate-real-runner.mjs",
      "--approval-gate",
      gatePath,
      "--fresh-rollback-point",
      freshRollbackPoint,
      "--reviewed-runner-manifest",
      tamperedManifestPath,
      "--execute-final-run",
      "--teacher-confirmation",
      "teacher confirmed real-case separate real runner",
      "--out-dir",
      join(smokeRoot, "tampered-run")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Real-case separate real runner rejects tampered reviewed runner manifest hash",
  tamperedResult.status === "blocked_before_real_case_separate_real_runner" &&
    tamperedResult.blockers.some((row) => row.code === "reviewed_runner_manifest_execution_blocked") &&
    tamperedResult.runnerInvoked === false &&
    tamperedResult.controlledRouteActionExecuted === false,
  JSON.stringify({ blockers: tamperedResult.blockers })
);

const summary = {
  format: "transparent_ai_real_case_separate_real_runner_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  gateSmokeStatus: gateSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
