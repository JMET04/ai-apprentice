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
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "smoke",
  "original-goal-proof-gap-teacher-queue-receipt-validation",
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
      title: "Close unattended all-software monitor audit gaps",
      teacherAction: "Review unattended monitor audit.",
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
      title: "Feed target to execution gate",
      teacherAction: "Confirm one numbered spatial target.",
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
      title: "Execution gate",
      teacherAction: "Approve one execution gate.",
      evidence: [{ key: "gate", label: "Gate", value: touch("gate.html"), exists: true, basename: "gate.html" }],
      commandTemplate:
        "node run-all-software-execution-approved-gate-runner.mjs --execute-approved-gate true --teacher-confirmation \"<teacher>\"",
      requiredTeacherInputs: ["one selected numbered target", "teacher-approved execution gate", "retained rollback point"],
      blockedUntilTeacher: true,
      risk: { matchedHighRiskMarkers: ["--execute-approved-gate", "--teacher-confirmation"], safeToRunAutomatically: false }
    }
  ],
  locks: {
    reviewOnly: true,
    packDoesNotRunCommands: true,
    goalComplete: false
  }
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
const receipt = readJson(queueOutput.receiptTemplatePath);
receipt.rows[0].decision = "teacher_evidence_attached";
receipt.rows[0].observedEvidencePath = touch("teacher-unattended-evidence.json");
receipt.rows[0].teacherConfirmationText = "Teacher reviewed unattended monitor evidence.";
receipt.rows[1].decision = "teacher_evidence_attached";
receipt.rows[1].observedEvidencePath = touch("teacher-spatial-target.json");
receipt.rows[1].selectedNumberedTarget = "2";
receipt.rows[1].teacherConfirmationText = "Teacher selected target 2.";
receipt.rows[2].decision = "teacher_evidence_attached";
receipt.rows[2].observedEvidencePath = touch("teacher-execution-gate.json");
receipt.rows[2].selectedNumberedTarget = "1";
receipt.rows[2].retainedRollbackPoint = touch("rollback-point.json");
receipt.rows[2].teacherConfirmationText = "Teacher approved the execution gate for later manual review only.";
const receiptPath = join(smokeRoot, "teacher-filled-proof-gap-queue-receipt.json");
writeJson(receiptPath, receipt);

const validationRun = spawnSync(
  process.execPath,
  [
    join(
      repoRoot,
      "plugins",
      "transparent-ai-apprentice",
      "scripts",
      "validate-original-goal-proof-gap-teacher-queue-receipt.mjs"
    ),
    "--queue",
    queueOutput.queuePath,
    "--receipt",
    receiptPath,
    "--output-dir",
    join(smokeRoot, "validation")
  ],
  { cwd: repoRoot, encoding: "utf8" }
);
if (validationRun.status !== 0) {
  throw new Error(validationRun.stderr || validationRun.stdout || "receipt validation failed");
}
const validationOutput = JSON.parse(validationRun.stdout);
const validation = readJson(validationOutput.validationPath);
const readme = readFileSync(validationOutput.readmePath, "utf8");

assert(validation.format === "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_validation_v1", "bad validation format");
assert(validation.status === "validated_with_manual_next_review_queue", "status should expose manual next review queue");
assert(validation.counts.readyRows === 3, "all three rows should be ready");
assert(validation.counts.nextReviewQueue === 3, "next review queue should match ready rows");
assert(validation.nextReviewQueue.every((row) => row.canRunAutomatically === false), "next review rows must not auto-run");
assert(validation.nextReviewQueue.some((row) => row.phase === "transparent_overlay_spatial_depth"), "spatial phase missing");
assert(validation.nextReviewQueue.some((row) => row.phase === "teacher_confirmed_target_software_execution"), "execution phase missing");
assert(validation.locks.validationDoesNotRunCommands === true, "run-command lock missing");
assert(validation.locks.validationDoesNotRegisterTask === true, "register lock missing");
assert(validation.locks.validationDoesNotCaptureScreenshots === true, "screenshot lock missing");
assert(validation.locks.validationDoesNotExecuteTargetSoftware === true, "execution lock missing");
assert(validation.locks.validationDoesNotWriteMemory === true, "memory lock missing");
assert(validation.locks.goalComplete === false, "goal complete lock missing");
assert(readme.includes("Original Goal Proof Gap Teacher Queue Receipt Validation"), "readme title missing");

const forbiddenReceipt = readJson(receiptPath);
forbiddenReceipt.rows[0].decision = "accepted";
const forbiddenReceiptPath = join(smokeRoot, "forbidden-proof-gap-queue-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenRun = spawnSync(
  process.execPath,
  [
    join(
      repoRoot,
      "plugins",
      "transparent-ai-apprentice",
      "scripts",
      "validate-original-goal-proof-gap-teacher-queue-receipt.mjs"
    ),
    "--queue",
    queueOutput.queuePath,
    "--receipt",
    forbiddenReceiptPath,
    "--output-dir",
    join(smokeRoot, "forbidden-validation")
  ],
  { cwd: repoRoot, encoding: "utf8" }
);
assert(forbiddenRun.status !== 0, "forbidden accepted decision should fail closed");
const forbiddenOutput = JSON.parse(forbiddenRun.stdout);
const forbiddenValidation = readJson(forbiddenOutput.validationPath);
assert(forbiddenValidation.validationDecision === "blocked_for_forbidden_decision", "forbidden decision not blocked");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_validation_smoke_v1",
      validation: validationOutput.validationPath,
      readyRows: validation.counts.readyRows,
      nextReviewQueue: validation.counts.nextReviewQueue,
      forbiddenDecisionBlocked: true
    },
    null,
    2
  )
);
