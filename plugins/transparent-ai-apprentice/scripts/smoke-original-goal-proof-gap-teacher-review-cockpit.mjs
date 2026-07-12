#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "smoke", "original-goal-proof-gap-teacher-review-cockpit", String(Date.now()));
rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });

const touch = (name) => {
  const path = join(smokeRoot, name);
  writeFileSync(path, `${name}\n`, "utf8");
  return path;
};

const queuePath = join(smokeRoot, "queue.json");
writeJson(queuePath, {
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_v1",
  status: "waiting_for_teacher_evidence_queue_receipt",
  paths: {
    receiptValidationCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-proof-gap-teacher-queue-receipt.mjs --queue \"<queue>\" --receipt \"<teacher-filled.json>\""
  },
  counts: { queueItems: 2, receiptRows: 2, highRiskGatedItems: 1 },
  queueItems: [
    {
      itemNumber: 1,
      phase: "all_software_low_token_log_learning",
      requirementId: "all_software_low_token_learning",
      routeId: "unattended_monitor_audit_route",
      title: "Low-token audit",
      teacherQuestion: "Review candidate low-token evidence?",
      receiptRequirement: { decision: "needs_teacher_evidence" },
      blockedTransitions: ["accepted", "auto_run_command"]
    },
    {
      itemNumber: 2,
      phase: "teacher_confirmed_target_software_execution",
      requirementId: "execute_in_target_software_after_confirmation",
      routeId: "teacher_confirmed_execution_gate_route",
      title: "Execution gate",
      teacherQuestion: "Approve one target with rollback?",
      receiptRequirement: { decision: "needs_teacher_evidence" },
      blockedTransitions: ["accepted", "execute_target_software"]
    }
  ],
  locks: { reviewOnly: true, queueDoesNotRunCommands: true, goalComplete: false }
});

const prefillHtml = touch("prefill.html");
const prefillPath = join(smokeRoot, "prefill.json");
writeJson(prefillPath, {
  format: "transparent_ai_original_goal_proof_gap_evidence_prefill_v1",
  status: "candidate_only_waiting_for_teacher_review",
  paths: { html: prefillHtml },
  counts: { rows: 2, rowsWithCandidateEvidence: 2, rowsStillNeedTeacherConfirmation: 2 },
  rows: [
    {
      itemNumber: 1,
      candidateObservedEvidencePath: touch("audit.md"),
      primaryCandidateEvidence: { key: "audit", label: "Audit" },
      needsNumberedTarget: false,
      needsRollbackPoint: false,
      teacherStillMustConfirm: ["teacher must review audit evidence"]
    },
    {
      itemNumber: 2,
      candidateObservedEvidencePath: touch("gate.html"),
      primaryCandidateEvidence: { key: "gate", label: "Gate" },
      needsNumberedTarget: true,
      needsRollbackPoint: true,
      teacherStillMustConfirm: ["teacher must provide one selected numbered target", "teacher must provide a retained rollback point"]
    }
  ],
  locks: { reviewOnly: true, prefillDoesNotRunCommands: true, goalComplete: false }
});

const receiptBuilderHtml = touch("receipt-builder.html");
const receiptTemplate = touch("receipt-template.json");
const receiptBuilderPath = join(smokeRoot, "receipt-builder.json");
writeJson(receiptBuilderPath, {
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_builder_v1",
  status: "waiting_for_teacher_to_fill_proof_gap_queue_receipt",
  paths: { html: receiptBuilderHtml, receiptTemplate },
  nextValidationCommand:
    "node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-proof-gap-teacher-queue-receipt.mjs --queue \"<queue>\" --receipt \"<teacher-filled.json>\"",
  counts: { reviewRows: 2 },
  locks: { reviewOnly: true, builderDoesNotRunCommands: true, goalComplete: false }
});

const run = spawnSync(
  process.execPath,
  [
    join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-original-goal-proof-gap-teacher-review-cockpit.mjs"),
    "--queue",
    queuePath,
    "--prefill",
    prefillPath,
    "--receipt-builder",
    receiptBuilderPath,
    "--output-dir",
    join(smokeRoot, "cockpit")
  ],
  { cwd: repoRoot, encoding: "utf8" }
);
if (run.status !== 0) throw new Error(run.stderr || run.stdout || "cockpit generation failed");
const output = JSON.parse(run.stdout);
const cockpit = readJson(output.cockpitPath);
const html = readFileSync(output.htmlPath, "utf8");
const readme = readFileSync(output.readmePath, "utf8");

assert(output.format === "transparent_ai_original_goal_proof_gap_teacher_review_cockpit_result_v1", "bad output format");
assert(cockpit.format === "transparent_ai_original_goal_proof_gap_teacher_review_cockpit_v1", "bad cockpit format");
assert(cockpit.status === "waiting_for_teacher_to_review_candidates_and_fill_receipt", "bad status");
assert(cockpit.counts.rows === 2, "row count mismatch");
assert(cockpit.counts.rowsWithCandidateEvidence === 2, "candidate evidence count mismatch");
assert(cockpit.counts.rowsStillNeedTeacherConfirmation === 2, "teacher confirmation count mismatch");
assert(cockpit.counts.rowsNeedingNumberedTarget === 1, "numbered target count mismatch");
assert(cockpit.counts.rowsNeedingRollback === 1, "rollback count mismatch");
assert(cockpit.reviewOrder.length === 3, "review order should have three steps");
assert(cockpit.reviewOrder[0].path === prefillHtml, "first step should open prefill");
assert(cockpit.reviewOrder[1].path === receiptBuilderHtml, "second step should open receipt builder");
assert(cockpit.reviewOrder[2].command.includes("validate-original-goal-proof-gap-teacher-queue-receipt.mjs"), "third step should be validation command");
assert(cockpit.rows[1].needsNumberedTarget === true, "execution row should need numbered target");
assert(cockpit.rows[1].needsRollbackPoint === true, "execution row should need rollback");
assert(cockpit.locks.cockpitDoesNotFillReceipt === true, "fill receipt lock missing");
assert(cockpit.locks.cockpitDoesNotValidateReceipt === true, "validate receipt lock missing");
assert(cockpit.locks.cockpitDoesNotRunCommands === true, "run command lock missing");
assert(cockpit.locks.cockpitDoesNotExecuteTargetSoftware === true, "target software lock missing");
assert(cockpit.locks.cockpitDoesNotWriteMemory === true, "memory lock missing");
assert(cockpit.locks.goalComplete === false, "goal complete lock missing");
assert(html.includes("Original Goal Proof Gap Teacher Review Cockpit"), "html title missing");
assert(html.includes("This cockpit organizes review only"), "html safety boundary missing");
assert(readme.includes("Review order"), "readme review order missing");
assert(existsSync(output.htmlPath), "html missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_teacher_review_cockpit_smoke_v1",
      cockpit: output.cockpitPath,
      html: output.htmlPath,
      rows: cockpit.counts.rows,
      rowsWithCandidateEvidence: cockpit.counts.rowsWithCandidateEvidence,
      rowsStillNeedTeacherConfirmation: cockpit.counts.rowsStillNeedTeacherConfirmation
    },
    null,
    2
  )
);
