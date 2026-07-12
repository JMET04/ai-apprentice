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
const smokeRoot = join(
  tmpdir(),
  "transparent-ai-apprentice-smoke",
  "original-goal-proof-gap-teacher-queue-receipt-builder",
  String(Date.now())
);
rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });

const touch = (name) => {
  const path = join(smokeRoot, name);
  writeFileSync(path, `${name}\n`, "utf8");
  return path;
};

const closurePackPath = join(smokeRoot, "original-goal-proof-gap-closure-pack.json");
writeJson(closurePackPath, {
  format: "transparent_ai_original_goal_proof_gap_closure_pack_v1",
  status: "waiting_for_teacher_to_close_proof_gaps",
  sourceEvidence: {
    statusRefresh: touch("refresh.json"),
    proofLedger: touch("ledger.json")
  },
  closureRoutes: [
    {
      requirementId: "all_software_low_token_learning",
      missingProof: "unattended all-software learning audit still has remaining gaps",
      routeId: "unattended_monitor_audit_route",
      title: "Unattended route",
      teacherAction: "Review low-token route.",
      evidence: [{ key: "audit", label: "Audit", value: touch("audit.md"), exists: true, basename: "audit.md" }],
      commandTemplate: "node validate-recurring.js --receipt \"<teacher-filled.json>\"",
      requiredTeacherInputs: ["teacher-filled recurring monitor confirmation receipt"],
      blockedUntilTeacher: true,
      risk: { matchedHighRiskMarkers: [], safeToRunAutomatically: false }
    },
    {
      requirementId: "transparent_mask_spatial_depth_understanding",
      missingProof: "teacher-confirmed selected target must still feed a later execution gate before software action",
      routeId: "spatial_target_to_execution_gate_route",
      title: "Spatial route",
      teacherAction: "Confirm one spatial target.",
      evidence: [{ key: "spatial", label: "Spatial", value: touch("spatial.json"), exists: true, basename: "spatial.json" }],
      commandTemplate: "node validate-spatial.js --receipt \"<teacher-filled.json>\"",
      requiredTeacherInputs: ["teacher-exported overlay/spatial intent receipt", "one confirmed numbered target"],
      blockedUntilTeacher: true,
      risk: { matchedHighRiskMarkers: [], safeToRunAutomatically: false }
    },
    {
      requirementId: "execute_in_target_software_after_confirmation",
      missingProof: "teacher must select one numbered target and approve one execution gate",
      routeId: "teacher_confirmed_execution_gate_route",
      title: "Execution route",
      teacherAction: "Approve one execution gate.",
      evidence: [{ key: "gate", label: "Gate", value: touch("gate.html"), exists: true, basename: "gate.html" }],
      commandTemplate:
        "node run-all-software-execution-approved-gate-runner.mjs --execute-approved-gate true --teacher-confirmation \"<teacher>\"",
      requiredTeacherInputs: ["one selected numbered target", "teacher-approved execution gate", "retained rollback point"],
      blockedUntilTeacher: true,
      risk: { matchedHighRiskMarkers: ["--execute-approved-gate", "--teacher-confirmation"], safeToRunAutomatically: false }
    }
  ],
  locks: { reviewOnly: true, packDoesNotRunCommands: true, goalComplete: false }
});

const queueRun = spawnSync(
  process.execPath,
  [
    join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-original-goal-proof-gap-teacher-queue.mjs"),
    "--closure-pack",
    closurePackPath,
    "--output-dir",
    join(smokeRoot, "queue")
  ],
  { cwd: repoRoot, encoding: "utf8" }
);
if (queueRun.status !== 0) throw new Error(queueRun.stderr || queueRun.stdout || "queue generation failed");
const queueOutput = JSON.parse(queueRun.stdout);
const queue = readJson(queueOutput.queuePath);
const prefillPath = join(smokeRoot, "original-goal-proof-gap-evidence-prefill.json");
writeJson(prefillPath, {
  format: "transparent_ai_original_goal_proof_gap_evidence_prefill_v1",
  status: "candidate_only_waiting_for_teacher_review",
  paths: {
    sourceQueue: queueOutput.queuePath
  },
  counts: {
    rows: queue.queueItems.length,
    rowsWithCandidateEvidence: queue.queueItems.length
  },
  nextProofGapEvidencePrefillSummary: {
    status: "candidate_evidence_prefilled_waiting_for_teacher_review",
    itemNumber: queue.queueItems[0].itemNumber,
    routeId: queue.queueItems[0].routeId,
    candidateObservedEvidencePath: queue.queueItems[0].evidence[0].value,
    candidateEvidenceExists: true,
    teacherStillMustConfirm: ["teacher must review the candidate evidence"]
  },
  rows: queue.queueItems.map((item) => ({
    itemNumber: item.itemNumber,
    phase: item.phase,
    routeId: item.routeId,
    requirementId: item.requirementId,
    candidateEvidence: item.evidence,
    primaryCandidateEvidence: item.evidence[0],
    candidateObservedEvidencePath: item.evidence[0]?.value || "",
    teacherStillMustConfirm: ["teacher must review the candidate evidence"]
  })),
  locks: {
    reviewOnly: true,
    accepted: false,
    goalComplete: false
  }
});

const builderRun = spawnSync(
  process.execPath,
  [
    join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-original-goal-proof-gap-teacher-queue-receipt-builder.mjs"),
    "--queue",
    queueOutput.queuePath,
    "--prefill",
    prefillPath,
    "--output-dir",
    join(smokeRoot, "builder")
  ],
  { cwd: repoRoot, encoding: "utf8" }
);
if (builderRun.status !== 0) throw new Error(builderRun.stderr || builderRun.stdout || "receipt builder failed");
const output = JSON.parse(builderRun.stdout);
const builder = readJson(output.builderPath);
const receiptTemplate = readJson(output.receiptTemplatePath);
const html = readFileSync(output.htmlPath, "utf8");
const readme = readFileSync(output.readmePath, "utf8");

assert(output.format === "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_builder_result_v1", "bad result format");
assert(builder.format === "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_builder_v1", "bad builder format");
assert(builder.status === "waiting_for_teacher_to_fill_proof_gap_queue_receipt", "status should wait for teacher");
assert(builder.counts.reviewRows === 3, "expected one builder row per queue item");
assert(builder.counts.rowsNeedingNumberedTarget === 2, "spatial and execution rows should need target");
assert(builder.counts.rowsNeedingRollback === 1, "execution row should need rollback");
assert(builder.counts.rowsWithCandidatePrefill === 3, "candidate prefill count missing");
assert(builder.counts.rowsWithExistingCandidateEvidence === 3, "existing candidate evidence count missing");
assert(builder.paths.evidencePrefill === prefillPath, "prefill path missing");
assert(builder.nextValidationCommand.includes("validate-original-goal-proof-gap-teacher-queue-receipt.mjs"), "validation command missing");
assert(builder.browserReceiptBuilder.generatesReceiptJsonInBrowser === true, "browser generator missing");
assert(builder.browserReceiptBuilder.doesNotRunCommands === true, "browser generator command lock missing");
assert(receiptTemplate.format === "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_v1", "bad receipt template format");
assert(receiptTemplate.rows.length === 3, "receipt rows should match builder rows");
assert(receiptTemplate.rows[0].candidateObservedEvidencePath, "candidate path should be present but not teacher-confirmed");
assert(receiptTemplate.rows[0].decision === "needs_teacher_evidence", "candidate prefill must not attach evidence automatically");
assert(receiptTemplate.forbiddenDecisions.includes("accepted"), "accepted must be forbidden");
assert(builder.locks.builderDoesNotWriteReceipt === true, "write receipt lock missing");
assert(builder.locks.builderDoesNotValidateReceipt === true, "validate receipt lock missing");
assert(builder.locks.builderDoesNotRunCommands === true, "run-command lock missing");
assert(builder.locks.builderDoesNotRegisterTask === true, "register lock missing");
assert(builder.locks.builderDoesNotCaptureScreenshots === true, "screenshot lock missing");
assert(builder.locks.builderDoesNotExecuteTargetSoftware === true, "execution lock missing");
assert(builder.locks.goalComplete === false, "goal complete lock missing");
assert(html.includes("Original Goal Proof Gap Teacher Queue Receipt Builder"), "html title missing");
assert(html.includes("Candidate evidence only"), "candidate evidence warning missing");
assert(html.includes("Use candidate path after teacher review"), "candidate path helper button missing");
assert(html.includes("Download receipt JSON"), "download button missing");
assert(readme.includes("Next validation command"), "readme validation command missing");
assert(existsSync(output.htmlPath), "html missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_builder_smoke_v1",
      builder: output.builderPath,
      html: output.htmlPath,
      receiptTemplate: output.receiptTemplatePath,
      reviewRows: builder.counts.reviewRows,
      rowsNeedingNumberedTarget: builder.counts.rowsNeedingNumberedTarget,
      rowsNeedingRollback: builder.counts.rowsNeedingRollback
    },
    null,
    2
  )
);
