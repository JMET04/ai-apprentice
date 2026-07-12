#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const dryRunSmokeRoot = join(root, ".ta-smoke", "real-case-controlled-execution-dry-run");
const smokeRoot = join(root, ".ta-smoke", "real-case-adapter-specific-runner-approval-gate");
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

const dryRunSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-controlled-execution-request-dry-run.mjs"]).stdout
);
const dryRunPath = latestFile(join(dryRunSmokeRoot, "approved-dry-run"), "real-case-controlled-execution-dry-run.json");
const receiptTemplatePath = latestFile(
  join(dryRunSmokeRoot, "approved-dry-run"),
  "real-case-controlled-execution-dry-run-receipt-template.json"
);
const dryRun = readJson(dryRunPath);
const template = readJson(receiptTemplatePath);

const approvedReceiptPath = writeJson(join(smokeRoot, "approved-dry-run-receipt.json"), {
  ...template,
  teacherDecision: "ready_for_separate_real_runner_gate",
  dryRunReviewed: true,
  rollbackPointReviewed: true,
  executionScopeReviewed: true,
  adapterSelectionReviewed: true,
  noOpLocksReviewed: true,
  blockedActionsConfirmed: true,
  adapterSelection: {
    ...template.adapterSelection,
    adapterId: "drawio-manual-existing-tool-adapter",
    adapterKind: "existing_tool_adapter",
    controlChannel: dryRun.executionScope.allowedControlChannel || "manual_or_existing_adapter_after_separate_runner_gate",
    targetSoftware: dryRun.executionScope.targetSoftware,
    allowedOperationSummary: dryRun.executionScope.operationSummary,
    allowedArtifacts: dryRun.executionScope.allowedArtifacts || [],
    forbiddenActions: dryRun.executionScope.forbiddenActions || []
  },
  teacherNotes: "Approve only the adapter-specific gate for a later separate real runner."
});
const approvedResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-controlled-execution-dry-run-receipt.mjs",
    "--dry-run",
    dryRunPath,
    "--receipt",
    approvedReceiptPath,
    "--out-dir",
    join(smokeRoot, "approved-gate")
  ]).stdout
);
const approvedGate = readJson(approvedResult.gatePath);
check(
  "Real-case adapter-specific runner approval gate creates separate real-runner request without execution",
  approvedResult.format === "transparent_ai_real_case_adapter_specific_runner_approval_gate_result_v1" &&
    approvedResult.status === "real_case_adapter_specific_runner_approval_gate_ready_for_separate_real_runner" &&
    approvedResult.approvedForSeparateRealRunner === true &&
    approvedResult.separateRealRunnerRequest?.format === "transparent_ai_real_case_separate_real_runner_request_v1" &&
    approvedResult.separateRealRunnerRequest?.executeNow === false &&
    approvedResult.separateRealRunnerRequest?.requiresFinalTeacherExecuteConfirmation === true &&
    approvedResult.adapterInvoked === false &&
    approvedResult.targetSoftwareCommandsExecuted === false &&
    approvedResult.uiEventsSent === false &&
    approvedGate.locks?.requiresSeparateRealRunner === true &&
    approvedGate.locks?.requiresFinalTeacherExecuteConfirmation === true,
  JSON.stringify({ gatePath: approvedResult.gatePath })
);

const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-execute-now-receipt.json"), {
  ...template,
  teacherDecision: "execute_now",
  executeNow: true
});
const forbiddenResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-controlled-execution-dry-run-receipt.mjs",
      "--dry-run",
      dryRunPath,
      "--receipt",
      forbiddenReceiptPath,
      "--out-dir",
      join(smokeRoot, "forbidden-gate")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Real-case adapter-specific runner approval gate blocks execute-now decisions",
  forbiddenResult.status === "blocked_for_forbidden_real_case_runner_gate_decision" &&
    forbiddenResult.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenResult.adapterInvoked === false,
  JSON.stringify({ blockers: forbiddenResult.blockers })
);

const missingAdapterReceiptPath = writeJson(join(smokeRoot, "missing-adapter-receipt.json"), {
  ...template,
  teacherDecision: "ready_for_separate_real_runner_gate",
  dryRunReviewed: true,
  rollbackPointReviewed: true,
  executionScopeReviewed: true,
  adapterSelectionReviewed: true,
  noOpLocksReviewed: true,
  blockedActionsConfirmed: true,
  adapterSelection: {
    ...template.adapterSelection,
    adapterId: "",
    controlChannel: ""
  }
});
const missingAdapterResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-controlled-execution-dry-run-receipt.mjs",
      "--dry-run",
      dryRunPath,
      "--receipt",
      missingAdapterReceiptPath,
      "--out-dir",
      join(smokeRoot, "missing-adapter-gate")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Real-case adapter-specific runner approval gate requires adapter id and control channel",
  missingAdapterResult.status === "real_case_adapter_specific_runner_gate_needs_teacher_review" &&
    missingAdapterResult.blockers.some((row) => row.code === "adapter_id_missing") &&
    missingAdapterResult.blockers.some((row) => row.code === "adapter_control_channel_missing"),
  JSON.stringify({ blockers: missingAdapterResult.blockers })
);

const tamperedReceiptPath = writeJson(join(smokeRoot, "tampered-hash-receipt.json"), {
  ...readJson(approvedReceiptPath),
  sourceDryRunHash: "tampered"
});
const tamperedResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-controlled-execution-dry-run-receipt.mjs",
      "--dry-run",
      dryRunPath,
      "--receipt",
      tamperedReceiptPath,
      "--out-dir",
      join(smokeRoot, "tampered-gate")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Real-case adapter-specific runner approval gate rejects tampered dry-run hash",
  tamperedResult.status === "real_case_adapter_specific_runner_gate_needs_teacher_review" &&
    tamperedResult.blockers.some((row) => row.code === "source_dry_run_hash_mismatch"),
  JSON.stringify({ blockers: tamperedResult.blockers })
);

const repairReceiptPath = writeJson(join(smokeRoot, "repair-receipt.json"), {
  ...template,
  teacherDecision: "request_high_reasoning_repair",
  teacherNotes: "Adapter choice is not precise enough; repair the gate before real runner."
});
const repairResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-controlled-execution-dry-run-receipt.mjs",
    "--dry-run",
    dryRunPath,
    "--receipt",
    repairReceiptPath,
    "--out-dir",
    join(smokeRoot, "repair-gate")
  ]).stdout
);
check(
  "Real-case adapter-specific runner approval gate routes corrections to high-reasoning repair",
  repairResult.status === "real_case_adapter_specific_runner_gate_routes_to_high_reasoning_repair" &&
    repairResult.approvedForSeparateRealRunner === false &&
    repairResult.separateRealRunnerRequest === null,
  JSON.stringify({ status: repairResult.status })
);

const summary = {
  format: "transparent_ai_real_case_adapter_specific_runner_approval_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  dryRunSmokeStatus: dryRunSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
