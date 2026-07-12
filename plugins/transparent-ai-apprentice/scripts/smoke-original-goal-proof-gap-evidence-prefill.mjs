#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "original-goal-proof-gap-evidence-prefill", String(Date.now()));
rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });

const touch = (name) => {
  const path = join(smokeRoot, name);
  writeFileSync(path, `${name}\n`, "utf8");
  return path;
};

const queuePath = join(smokeRoot, "original-goal-proof-gap-teacher-queue.json");
writeJson(queuePath, {
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_v1",
  status: "waiting_for_teacher_evidence_queue_receipt",
  paths: {
    receiptValidationCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-proof-gap-teacher-queue-receipt.mjs --queue \"<queue>\" --receipt \"<teacher-filled.json>\""
  },
  counts: { queueItems: 3, receiptRows: 3, highRiskGatedItems: 1 },
  queueItems: [
    {
      itemNumber: 1,
      phase: "all_software_low_token_log_learning",
      requirementId: "all_software_low_token_learning",
      routeId: "unattended_monitor_audit_route",
      title: "Unattended route",
      teacherQuestion: "Review low-token route?",
      requiredTeacherInputs: ["teacher-filled recurring monitor confirmation receipt"],
      evidence: [{ key: "audit", label: "Audit", value: touch("audit.md"), exists: true, basename: "audit.md" }],
      receiptRequirement: {
        itemNumber: 1,
        routeId: "unattended_monitor_audit_route",
        requirementId: "all_software_low_token_learning",
        decision: "needs_teacher_evidence",
        observedEvidencePath: "",
        selectedNumberedTarget: "not_applicable",
        retainedRollbackPoint: "not_applicable"
      },
      blockedTransitions: ["accepted", "auto_run_command"]
    },
    {
      itemNumber: 2,
      phase: "transparent_overlay_spatial_depth",
      requirementId: "transparent_mask_spatial_depth_understanding",
      routeId: "spatial_target_to_execution_gate_route",
      title: "Spatial route",
      teacherQuestion: "Which numbered target?",
      requiredTeacherInputs: ["one confirmed numbered target"],
      evidence: [{ key: "spatial", label: "Spatial", value: touch("spatial.json"), exists: true, basename: "spatial.json" }],
      receiptRequirement: {
        itemNumber: 2,
        routeId: "spatial_target_to_execution_gate_route",
        requirementId: "transparent_mask_spatial_depth_understanding",
        decision: "needs_teacher_evidence",
        observedEvidencePath: "",
        selectedNumberedTarget: "",
        retainedRollbackPoint: "not_applicable"
      },
      blockedTransitions: ["accepted", "execute_target_software"]
    },
    {
      itemNumber: 3,
      phase: "teacher_confirmed_target_software_execution",
      requirementId: "execute_in_target_software_after_confirmation",
      routeId: "teacher_confirmed_execution_gate_route",
      title: "Execution route",
      teacherQuestion: "Approve one execution gate?",
      requiredTeacherInputs: ["one selected numbered target", "retained rollback point"],
      evidence: [{ key: "gate", label: "Gate", value: touch("gate.html"), exists: true, basename: "gate.html" }],
      receiptRequirement: {
        itemNumber: 3,
        routeId: "teacher_confirmed_execution_gate_route",
        requirementId: "execute_in_target_software_after_confirmation",
        decision: "needs_teacher_evidence",
        observedEvidencePath: "",
        selectedNumberedTarget: "",
        retainedRollbackPoint: ""
      },
      blockedTransitions: ["accepted", "execute_target_software", "write_long_term_memory"]
    }
  ],
  locks: { reviewOnly: true, queueDoesNotRunCommands: true, goalComplete: false }
});

const refreshPath = join(smokeRoot, "original-goal-current-status-refresh.json");
writeJson(refreshPath, {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  paths: {
    originalGoalProofLedger: touch("ledger.json"),
    originalGoalProofGapTeacherQueueReceiptBuilderHtml: touch("receipt-builder.html"),
    originalGoalProofGapTeacherQueueReceiptValidationCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-proof-gap-teacher-queue-receipt.mjs --queue \"<queue>\" --receipt \"<teacher-filled.json>\""
  }
});

const run = spawnSync(
  process.execPath,
  [
    join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-original-goal-proof-gap-evidence-prefill.mjs"),
    "--queue",
    queuePath,
    "--refresh",
    refreshPath,
    "--output-dir",
    join(smokeRoot, "prefill")
  ],
  { cwd: repoRoot, encoding: "utf8" }
);
if (run.status !== 0) throw new Error(run.stderr || run.stdout || "prefill generation failed");
const output = JSON.parse(run.stdout);
const packet = readJson(output.prefillPath);
const draft = readJson(output.candidateReceiptDraftPath);
const html = readFileSync(output.htmlPath, "utf8");
const readme = readFileSync(output.readmePath, "utf8");

assert(output.format === "transparent_ai_original_goal_proof_gap_evidence_prefill_result_v1", "bad output format");
assert(packet.format === "transparent_ai_original_goal_proof_gap_evidence_prefill_v1", "bad packet format");
assert(packet.status === "candidate_only_waiting_for_teacher_review", "status should wait for teacher review");
assert(packet.counts.rows === 3, "expected one row per queue item");
assert(packet.counts.rowsWithCandidateEvidence === 3, "all rows should have candidate evidence");
assert(packet.counts.rowsStillNeedTeacherConfirmation === 3, "all rows still need teacher confirmation");
assert(packet.counts.rowsNeedingNumberedTarget === 2, "spatial and execution rows should need target");
assert(packet.counts.rowsNeedingRollback === 1, "execution row should need rollback");
assert(
  packet.nextProofGapEvidencePrefillSummary.status === "candidate_evidence_prefilled_waiting_for_teacher_review",
  "next proof gap prefill summary missing"
);
assert(packet.nextProofGapEvidencePrefillSummary.itemNumber === 1, "next proof gap prefill should point to first row");
assert(
  packet.nextProofGapEvidencePrefillSummary.routeId === "unattended_monitor_audit_route",
  "next proof gap prefill route mismatch"
);
assert(
  packet.nextProofGapEvidencePrefillSummary.candidateObservedEvidencePath.endsWith("audit.md"),
  "next proof gap candidate evidence path missing"
);
assert(
  packet.nextProofGapEvidencePrefillSummary.teacherStillMustConfirm.length > 0,
  "teacher confirmation boundary missing"
);
assert(packet.rows.every((row) => row.draftReceiptRow.decision === "needs_teacher_evidence"), "draft rows must not attach evidence");
assert(packet.rows.every((row) => row.draftReceiptRow.observedEvidencePath === ""), "observed evidence must remain blank");
assert(packet.rows[0].candidateObservedEvidencePath.endsWith("audit.md"), "primary candidate evidence missing");
assert(draft.format === "transparent_ai_original_goal_proof_gap_teacher_queue_candidate_receipt_draft_v1", "bad draft format");
assert(draft.forbiddenDecisions.includes("accepted"), "accepted must be forbidden");
assert(packet.locks.prefillDoesNotClaimEvidenceAccepted === true, "claim lock missing");
assert(packet.locks.prefillDoesNotValidateReceipt === true, "validation lock missing");
assert(packet.locks.prefillDoesNotRunCommands === true, "run command lock missing");
assert(packet.locks.prefillDoesNotExecuteTargetSoftware === true, "execution lock missing");
assert(packet.locks.prefillDoesNotWriteMemory === true, "memory lock missing");
assert(packet.locks.goalComplete === false, "goal complete lock missing");
assert(html.includes("Original Goal Proof Gap Evidence Prefill"), "html title missing");
assert(html.includes("Candidates are not proof acceptance"), "html boundary missing");
assert(readme.includes("Rows with candidate evidence"), "readme count missing");
assert(existsSync(output.htmlPath), "html missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_evidence_prefill_smoke_v1",
      prefill: output.prefillPath,
      html: output.htmlPath,
      candidateReceiptDraft: output.candidateReceiptDraftPath,
      rows: packet.counts.rows,
      rowsWithCandidateEvidence: packet.counts.rowsWithCandidateEvidence,
      rowsStillNeedTeacherConfirmation: packet.counts.rowsStillNeedTeacherConfirmation
    },
    null,
    2
  )
);
