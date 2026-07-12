#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-rag-informed-repair-approved-gate-command-builder-smoke", String(Date.now()));

function runNode(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

const rebuildSmoke = runNode("smoke-tlcl-rag-informed-high-reasoning-repair-approval-gate-rebuild-package.mjs");
const ready = runNode("create-tlcl-rag-informed-high-reasoning-repair-approved-gate-command-builder.mjs", [
  "--rebuild-package",
  rebuildSmoke.readyPackagePath,
  "--out-dir",
  join(smokeRoot, "ready")
]);
const readyWrapper = readJson(ready.wrapperPath);
const readyReceipt = readJson(ready.receiptPath);

const blockedRebuildPath = writeJson(join(smokeRoot, "blocked-rag-informed-rebuild-package.json"), {
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approval_gate_rebuild_package_v1",
  status: "blocked_before_rag_informed_repair_approval_gate_rebuild",
  approvalGateRebuilt: false,
  approvalGatePrepRunnerInvoked: false,
  readyForTeacherExecuteReview: false,
  mediumRuntimeRetryAllowed: false,
  approvedGateRunnerInvoked: false,
  ragEvidenceTreatedAsAuthority: false,
  generatedEvidence: {},
  blockers: ["smoke_blocked_before_rag_informed_rebuild"],
  locks: {
    reviewOnly: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    doesNotRunApprovedGateRunner: true,
    doesNotRunMediumRuntimeWorkflow: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const blocked = runNode("create-tlcl-rag-informed-high-reasoning-repair-approved-gate-command-builder.mjs", [
  "--rebuild-package",
  blockedRebuildPath,
  "--out-dir",
  join(smokeRoot, "blocked")
]);
const blockedWrapper = readJson(blocked.wrapperPath);

const checks = [
  {
    name: "RAG-informed repair approved-gate command builder reuses only the existing command builder",
    pass:
      ready.status === "rag_informed_repair_approved_gate_command_builder_ready_for_teacher_final_confirmation" &&
      ready.approvalGateRebuilt === true &&
      ready.reusableWorkflowCommandBuilderInvoked === true &&
      ready.readyForTeacherFinalConfirmation === true &&
      ready.approvedGateRunnerInvoked === false &&
      existsSync(ready.reusedExistingBuilderHtmlPath || "") &&
      ready.commandTemplate.includes("--execute-approved-gate") &&
      readyWrapper.generatedEvidence.reusedCommandBuilderWrapperPath === ready.reusedCommandBuilderWrapperPath,
    evidence: ready.reusedExistingBuilderHtmlPath
  },
  {
    name: "RAG-informed repair approved-gate command builder keeps RAG evidence non-authoritative",
    pass:
      ready.ragEvidenceTreatedAsAuthority === false &&
      readyWrapper.sourceEvidence.ragEvidenceNonAuthoritative === true &&
      readyWrapper.locks.ragEvidenceNonAuthoritative === true &&
      readyWrapper.locks.doesNotTreatRagAsAuthority === true,
    evidence: JSON.stringify(readyWrapper.locks)
  },
  {
    name: "RAG-informed repair approved-gate command builder blocks unready rebuild packages",
    pass:
      blocked.status === "blocked_before_rag_informed_repair_approved_gate_command_builder" &&
      blocked.reusableWorkflowCommandBuilderInvoked === false &&
      blockedWrapper.blockers.includes("rag_informed_repair_approval_gate_rebuild_package_not_ready_for_teacher_execute_review"),
    evidence: blockedWrapper.blockers.join(",")
  },
  {
    name: "RAG-informed command builder keeps runner medium runtime execution memory rule packaging and completion locks",
    pass:
      readyWrapper.locks.reviewOnly === true &&
      readyWrapper.locks.finalTeacherExecuteConfirmationStillRequired === true &&
      readyWrapper.locks.doesNotRunApprovedGateRunner === true &&
      readyWrapper.locks.doesNotRunMediumRuntimeWorkflow === true &&
      readyWrapper.locks.doesNotExecuteTargetSoftware === true &&
      readyWrapper.locks.doesNotWriteMemory === true &&
      readyWrapper.locks.doesNotEnableRules === true &&
      readyReceipt.targetSoftwareCommandsExecuted === false &&
      readyReceipt.memoryWritten === false &&
      readyReceipt.ruleEnabled === false &&
      readyReceipt.goalComplete === false,
    evidence: JSON.stringify(readyWrapper.locks)
  },
  {
    name: "RAG-informed command builder output remains review-only and packaging gated",
    pass:
      readyWrapper.format === "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_command_builder_v1" &&
      readyWrapper.locks.accepted === false &&
      readyWrapper.locks.ruleEnabled === false &&
      readyWrapper.locks.packagingGated === true &&
      readyWrapper.locks.nativeUniversalExecution === false &&
      readyWrapper.locks.allSoftwareExecutionComplete === false &&
      readyWrapper.locks.goalComplete === false,
    evidence: ready.wrapperPath
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_command_builder_smoke_v1",
  passed,
  total: checks.length,
  readyWrapperPath: ready.wrapperPath,
  readyPackagePath: ready.wrapperPath,
  blockedWrapperPath: blocked.wrapperPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
