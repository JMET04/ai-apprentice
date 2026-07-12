#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-rag-informed-repair-approved-gate-runner-smoke", String(Date.now()));

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

const builderSmoke = runNode("smoke-tlcl-rag-informed-high-reasoning-repair-approved-gate-command-builder.mjs");
const readyBuilderPath = builderSmoke.readyWrapperPath || builderSmoke.readyPackagePath;

const noFlag = runNode("run-tlcl-rag-informed-high-reasoning-repair-approved-gate-runner.mjs", [
  "--builder",
  readyBuilderPath,
  "--teacher-confirmation",
  "teacher confirmed rag informed tlcl repair approved gate runner",
  "--rollback-point-created",
  "--out-dir",
  join(smokeRoot, "no-flag")
]);
const noFlagPacket = readJson(noFlag.packetPath);

const readyRun = runNode("run-tlcl-rag-informed-high-reasoning-repair-approved-gate-runner.mjs", [
  "--builder",
  readyBuilderPath,
  "--execute-approved-gate",
  "--teacher-confirmation",
  "teacher confirmed rag informed tlcl repair approved gate runner",
  "--rollback-point-created",
  "--out-dir",
  join(smokeRoot, "ready")
]);
const readyPacket = readJson(readyRun.packetPath);
const readyReceipt = readJson(readyRun.receiptPath);

const blockedBuilderPath = writeJson(join(smokeRoot, "blocked-rag-informed-command-builder.json"), {
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_command_builder_v1",
  status: "blocked_before_rag_informed_repair_approved_gate_command_builder",
  reusableWorkflowCommandBuilderInvoked: false,
  readyForTeacherFinalConfirmation: false,
  approvedGateRunnerInvoked: false,
  ragEvidenceTreatedAsAuthority: false,
  generatedEvidence: {},
  blockers: ["smoke_blocked_before_rag_informed_command_builder"],
  locks: {
    reviewOnly: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    doesNotRunApprovedGateRunner: true,
    freshOutcomeReviewStillRequired: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const blockedBuilder = runNode("run-tlcl-rag-informed-high-reasoning-repair-approved-gate-runner.mjs", [
  "--builder",
  blockedBuilderPath,
  "--execute-approved-gate",
  "--teacher-confirmation",
  "teacher confirmed rag informed tlcl repair approved gate runner",
  "--rollback-point-created",
  "--out-dir",
  join(smokeRoot, "blocked")
]);
const blockedPacket = readJson(blockedBuilder.packetPath);

const checks = [
  {
    name: "RAG-informed repair approved-gate runner blocks without explicit execute flag",
    pass:
      noFlag.status === "blocked_before_rag_informed_repair_approved_gate_runner" &&
      noFlag.runnerInvoked === false &&
      noFlagPacket.blockers.includes("missing_execute_approved_gate_flag"),
    evidence: noFlag.packetPath
  },
  {
    name: "RAG-informed repair approved-gate runner reuses the existing approved-gate runner without overclaiming completion",
    pass:
      readyRun.status === "rag_informed_repair_approved_gate_runner_invoked_but_blocked" &&
      readyRun.runnerInvoked === true &&
      readyRun.controlledRouteActionExecuted === false &&
      existsSync(readyRun.reusableWorkflowRunnerPacketPath || "") &&
      readyPacket.generatedEvidence.reusableWorkflowRunnerResult?.runnerInvoked === true &&
      readyPacket.blockers.includes("reusable_workflow_runner_blocker:reusable_workflow_approved_gate_runner_did_not_complete_controlled_route"),
    evidence: readyRun.reusableWorkflowRunnerPacketPath
  },
  {
    name: "RAG-informed runner keeps RAG evidence non-authoritative and requires fresh outcome review",
    pass:
      readyRun.ragEvidenceTreatedAsAuthority === false &&
      readyPacket.sourceEvidence.ragEvidenceNonAuthoritative === true &&
      readyPacket.locks.ragEvidenceNonAuthoritative === true &&
      readyPacket.locks.doesNotTreatRagAsAuthority === true &&
      readyPacket.locks.freshOutcomeReviewStillRequired === true,
    evidence: JSON.stringify(readyPacket.locks)
  },
  {
    name: "RAG-informed runner keeps memory rule packaging and completion locked after a controlled route",
    pass:
      readyReceipt.memoryWritten === false &&
      readyReceipt.accepted === false &&
      readyReceipt.ruleEnabled === false &&
      readyReceipt.packagingGated === true &&
      readyReceipt.packagingUnlocked === false &&
      readyReceipt.goalComplete === false &&
      readyPacket.completionBoundary.goalComplete === false,
    evidence: readyRun.receiptPath
  },
  {
    name: "RAG-informed repair approved-gate runner blocks unready builders before invocation",
    pass:
      blockedBuilder.status === "blocked_before_rag_informed_repair_approved_gate_runner" &&
      blockedBuilder.runnerInvoked === false &&
      blockedPacket.blockers.includes("rag_informed_repair_command_builder_not_ready_for_final_confirmation"),
    evidence: blockedBuilder.packetPath
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_runner_smoke_v1",
  passed,
  total: checks.length,
  readyBuilderPath,
  noFlagPacketPath: noFlag.packetPath,
  readyPacketPath: readyRun.packetPath,
  blockedPacketPath: blockedBuilder.packetPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
