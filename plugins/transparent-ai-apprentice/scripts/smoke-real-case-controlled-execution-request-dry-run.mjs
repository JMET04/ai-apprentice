#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const activeExecutionGateSmokeRoot = join(root, ".ta-smoke", "real-case-active-execution-gate");
const smokeRoot = join(root, ".ta-smoke", "real-case-controlled-execution-dry-run");
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

const activeExecutionGateSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-active-execution-gate.mjs"]).stdout
);
const approvedValidationPath = latestFile(
  join(activeExecutionGateSmokeRoot, "approved-validation"),
  "real-case-active-execution-gate-validation.json"
);
const approvedDryRunResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/run-real-case-controlled-execution-request-dry-run.mjs",
    "--execution-gate-validation",
    approvedValidationPath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "approved-dry-run")
  ]).stdout
);
const approvedDryRun = readJson(approvedDryRunResult.dryRunPath);
const approvedReceiptTemplate = readJson(approvedDryRunResult.receiptTemplatePath);
check(
  "Real-case controlled execution dry-run accepts approved request without invoking adapter",
  approvedDryRunResult.format === "transparent_ai_real_case_controlled_execution_dry_run_result_v1" &&
    approvedDryRunResult.status === "real_case_controlled_execution_dry_run_ready_for_teacher_runner_review" &&
    approvedDryRunResult.dryRunOnly === true &&
    approvedDryRunResult.executeNow === false &&
    approvedDryRunResult.adapterInvoked === false &&
    approvedDryRunResult.targetSoftwareCommandsExecuted === false &&
    approvedDryRunResult.uiEventsSent === false &&
    approvedDryRun.format === "transparent_ai_real_case_controlled_execution_dry_run_v1" &&
    approvedDryRun.locks?.adapterInvoked === false &&
    approvedDryRun.locks?.targetSoftwareCommandsExecuted === false &&
    approvedDryRun.locks?.uiEventsSent === false &&
    approvedDryRun.locks?.memoryWritten === false &&
    approvedDryRun.locks?.ragFetched === false &&
    approvedReceiptTemplate.teacherDecision === "needs_teacher_review" &&
    approvedReceiptTemplate.executeNow === false,
  JSON.stringify({ dryRunPath: approvedDryRunResult.dryRunPath })
);

const missingScopeValidationPath = latestFile(
  join(activeExecutionGateSmokeRoot, "missing-scope-validation"),
  "real-case-active-execution-gate-validation.json"
);
const nonReadyResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/run-real-case-controlled-execution-request-dry-run.mjs",
      "--execution-gate-validation",
      missingScopeValidationPath,
      "--teacher-reviewed",
      "--out-dir",
      join(smokeRoot, "non-ready-dry-run")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Real-case controlled execution dry-run rejects non-ready execution gate validation",
  nonReadyResult.status === "real_case_controlled_execution_dry_run_blocked" &&
    nonReadyResult.blockers.some((row) => row.code === "execution_gate_not_ready_for_controlled_request") &&
    nonReadyResult.locks?.targetSoftwareCommandsExecuted === false,
  JSON.stringify({ blockers: nonReadyResult.blockers })
);

const tamperedExecuteNowPath = writeJson(join(smokeRoot, "tampered-execute-now-validation.json"), {
  ...readJson(approvedValidationPath),
  controlledExecutionRequest: {
    ...readJson(approvedValidationPath).controlledExecutionRequest,
    executeNow: true
  }
});
const tamperedExecuteNowResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/run-real-case-controlled-execution-request-dry-run.mjs",
      "--execution-gate-validation",
      tamperedExecuteNowPath,
      "--teacher-reviewed",
      "--out-dir",
      join(smokeRoot, "tampered-execute-now-dry-run")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Real-case controlled execution dry-run rejects executeNow tampering",
  tamperedExecuteNowResult.status === "real_case_controlled_execution_dry_run_blocked" &&
    tamperedExecuteNowResult.blockers.some((row) => row.code === "controlled_request_execute_now_forbidden") &&
    tamperedExecuteNowResult.locks?.adapterInvoked === false,
  JSON.stringify({ blockers: tamperedExecuteNowResult.blockers })
);

const missingRollbackPath = writeJson(join(smokeRoot, "missing-rollback-validation.json"), {
  ...readJson(approvedValidationPath),
  controlledExecutionRequest: {
    ...readJson(approvedValidationPath).controlledExecutionRequest,
    rollbackPoint: join(smokeRoot, "does-not-exist-rollback")
  }
});
const missingRollbackResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/run-real-case-controlled-execution-request-dry-run.mjs",
      "--execution-gate-validation",
      missingRollbackPath,
      "--teacher-reviewed",
      "--out-dir",
      join(smokeRoot, "missing-rollback-dry-run")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Real-case controlled execution dry-run requires retained rollback point",
  missingRollbackResult.status === "real_case_controlled_execution_dry_run_blocked" &&
    missingRollbackResult.blockers.some((row) => row.code === "rollback_point_not_found") &&
    missingRollbackResult.locks?.filesWrittenOutsideRunDir === false,
  JSON.stringify({ blockers: missingRollbackResult.blockers })
);

check(
  "Real-case controlled execution dry-run preserves execution scope and no-op locks",
  approvedDryRun.executionScope?.targetSoftware === "draw.io" &&
    approvedDryRun.executionScope?.operationSummary.includes("controlled packaging dieline") &&
    approvedDryRun.plannedNoOpRunnerSteps.length >= 5 &&
    approvedDryRun.blockedActions.includes("invoke_adapter_from_dry_run") &&
    approvedDryRun.blockedActions.includes("execute_target_software_command_from_dry_run") &&
    approvedDryRun.nextReview?.requiresAdapterSpecificGate === true &&
    approvedDryRun.nextReview?.requiresNewRollbackConfirmation === true &&
    approvedDryRun.locks?.requiresSeparateRealRunnerReview === true,
  JSON.stringify({ executionScope: approvedDryRun.executionScope })
);

const summary = {
  format: "transparent_ai_real_case_controlled_execution_dry_run_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  activeExecutionGateSmokeStatus: activeExecutionGateSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
