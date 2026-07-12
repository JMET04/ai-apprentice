#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNode(scriptPath, args, label, cwd) {
  const run = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf8"
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || `${label} failed`);
  return JSON.parse(run.stdout);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const scriptRoot = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts");
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "smoke",
  "original-goal-proof-gap-validation-handoff-queue",
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
      missingProof: "unattended all-software learning still needs proof",
      routeId: "unattended_monitor_audit_route",
      title: "Close unattended monitor gaps",
      teacherAction: "Review unattended monitor audit.",
      evidence: [{ key: "audit", label: "Audit", value: touch("audit.md"), exists: true, basename: "audit.md" }],
      commandTemplate: "node validate-recurring.js --receipt \"<teacher-filled.json>\"",
      requiredTeacherInputs: ["teacher-filled recurring monitor confirmation receipt"],
      blockedUntilTeacher: true,
      risk: { matchedHighRiskMarkers: [], safeToRunAutomatically: false }
    },
    {
      requirementId: "transparent_mask_spatial_depth_understanding",
      missingProof: "selected spatial target still needs teacher confirmation",
      routeId: "spatial_target_to_execution_gate_route",
      title: "Confirm one numbered spatial target",
      teacherAction: "Confirm one numbered spatial target.",
      evidence: [{ key: "spatial", label: "Spatial", value: touch("spatial.json"), exists: true, basename: "spatial.json" }],
      commandTemplate: "node validate-spatial.js --receipt \"<teacher-filled.json>\"",
      requiredTeacherInputs: ["teacher-exported overlay/spatial intent receipt", "one confirmed numbered target"],
      blockedUntilTeacher: true,
      risk: { matchedHighRiskMarkers: [], safeToRunAutomatically: false }
    },
    {
      requirementId: "execute_in_target_software_after_confirmation",
      missingProof: "teacher must retain rollback and approve one execution gate",
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

const queueOutput = runNode(
  join(scriptRoot, "create-original-goal-proof-gap-teacher-queue.mjs"),
  ["--closure-pack", closurePackPath, "--output-dir", join(smokeRoot, "queue")],
  "queue generation",
  repoRoot
);
const receipt = readJson(queueOutput.receiptTemplatePath);
receipt.rows[0].decision = "teacher_evidence_attached";
receipt.rows[0].observedEvidencePath = touch("teacher-unattended-evidence.json");
receipt.rows[0].teacherConfirmationText = "Teacher reviewed unattended monitor evidence.";
receipt.rows[1].decision = "blocked";
receipt.rows[1].teacherNotes = "Teacher says spatial evidence is wrong and must be repaired.";
receipt.rows[2].decision = "needs_teacher_evidence";
const receiptPath = join(smokeRoot, "mixed-proof-gap-queue-receipt.json");
writeJson(receiptPath, receipt);

const validationOutput = runNode(
  join(scriptRoot, "validate-original-goal-proof-gap-teacher-queue-receipt.mjs"),
  ["--queue", queueOutput.queuePath, "--receipt", receiptPath, "--output-dir", join(smokeRoot, "validation")],
  "receipt validation",
  repoRoot
);
const validation = readJson(validationOutput.validationPath);
assert(validation.counts.readyRows === 1, "fixture should have one ready row");
assert(validation.counts.blockedRows === 1, "fixture should have one blocked row");
assert(validation.counts.waitingRows === 1, "fixture should have one waiting row");

const handoffOutput = runNode(
  join(scriptRoot, "create-original-goal-proof-gap-validation-handoff-queue.mjs"),
  ["--validation", validationOutput.validationPath, "--output-dir", join(smokeRoot, "handoff")],
  "handoff queue",
  repoRoot
);
const handoff = readJson(handoffOutput.queuePath);
const html = readFileSync(handoffOutput.htmlPath, "utf8");
const readme = readFileSync(handoffOutput.readmePath, "utf8");

assert(handoff.format === "transparent_ai_original_goal_proof_gap_validation_handoff_queue_v1", "bad handoff format");
assert(handoff.status === "blocked_or_partially_ready_for_manual_follow_up", "mixed status should be partially ready and blocked");
assert(handoff.queueDecision === "partial_ready_waiting_for_teacher_repair_or_evidence", "bad mixed decision");
assert(handoff.counts.queueItems === 3, "queue item count mismatch");
assert(handoff.counts.readyForManualFollowUpRows === 1, "ready count mismatch");
assert(handoff.counts.blockedRows === 1, "blocked count mismatch");
assert(handoff.counts.waitingForTeacherEvidenceRows === 1, "waiting count mismatch");
assert(handoff.queueItems.some((item) => item.lane === "ready_for_manual_follow_up"), "ready lane missing");
assert(handoff.queueItems.some((item) => item.lane === "blocked"), "blocked lane missing");
assert(handoff.queueItems.some((item) => item.lane === "waiting_for_teacher_evidence"), "waiting lane missing");
assert(handoff.queueItems.every((item) => item.canRunAutomatically === false), "handoff item must not auto-run");
assert(handoff.queueItems.every((item) => item.commandExecutableNow === false), "handoff item must not be executable now");
assert(handoff.locks.queueDoesNotRunCommands === true, "run-command lock missing");
assert(handoff.locks.queueDoesNotValidateReceipt === true, "validate lock missing");
assert(handoff.locks.queueDoesNotRegisterTask === true, "register lock missing");
assert(handoff.locks.queueDoesNotLaunchRunner === true, "launch lock missing");
assert(handoff.locks.queueDoesNotExecuteTargetSoftware === true, "target execution lock missing");
assert(handoff.locks.queueDoesNotCaptureScreenshots === true, "screenshot lock missing");
assert(handoff.locks.queueDoesNotReadFullLogs === true, "full-log lock missing");
assert(handoff.locks.queueDoesNotWriteMemory === true, "memory lock missing");
assert(handoff.locks.queueDoesNotEnableRules === true, "rule lock missing");
assert(handoff.locks.goalComplete === false, "goal completion lock missing");
assert(handoff.completionBoundary.completionAllowed === false, "completion boundary missing");
assert(html.includes("Original Goal Proof Gap Validation Handoff Queue"), "html title missing");
assert(readme.includes("does not run verification commands"), "readme safety boundary missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_validation_handoff_queue_smoke_v1",
      validation: validationOutput.validationPath,
      handoffQueue: handoffOutput.queuePath,
      counts: handoff.counts,
      reviewOnly: handoff.locks.reviewOnly,
      goalComplete: handoff.locks.goalComplete
    },
    null,
    2
  )
);
