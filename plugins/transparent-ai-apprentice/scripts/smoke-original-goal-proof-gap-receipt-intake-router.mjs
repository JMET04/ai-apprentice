#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "original-goal-proof-gap-receipt-intake-router", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const evidencePath = join(smokeRoot, "bounded-output-witness.html");
writeFileSync(evidencePath, "bounded low-token witness\n", "utf8");

const closurePackPath = writeJson(join(smokeRoot, "proof-gap-closure-pack.json"), {
  format: "transparent_ai_original_goal_proof_gap_closure_pack_v1",
  status: "waiting_for_teacher_to_close_proof_gaps",
  sourceEvidence: {},
  closureRoutes: [
    {
      requirementId: "all_software_low_token_learning",
      missingProof: "teacher must confirm bounded low-token witness",
      routeId: "post_registration_output_witness_route",
      title: "Review bounded output witness",
      teacherAction: "Review one bounded output witness.",
      evidence: [{ key: "witness", label: "Bounded witness", value: evidencePath, exists: true }],
      commandTemplate:
        "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-operational-learning-post-registration-output-witness-runner.mjs --teacher-confirmation <teacher-confirmed-post-registration-output-witness-text>",
      requiredTeacherInputs: ["teacher confirmation text", "output witness receipt"],
      blockedUntilTeacher: true,
      risk: { matchedHighRiskMarkers: [], safeToRunAutomatically: false }
    }
  ],
  locks: { reviewOnly: true, accepted: false, goalComplete: false }
});

const queueResult = runScript("create-original-goal-proof-gap-teacher-queue.mjs", [
  "--closure-pack",
  closurePackPath,
  "--output-dir",
  join(smokeRoot, "queue")
]);
const queue = readJson(queueResult.queuePath);

const missingResult = runScript("create-original-goal-proof-gap-receipt-intake-router.mjs", [
  "--queue",
  queueResult.queuePath,
  "--output-dir",
  join(smokeRoot, "missing")
]);
const missingRouter = readJson(missingResult.routerPath);

const receiptPath = writeJson(join(smokeRoot, "teacher-filled-proof-gap-receipt.json"), {
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_v1",
  sourceQueue: queueResult.queuePath,
  defaultDecision: "needs_teacher_evidence",
  allowedDecisions: ["needs_teacher_evidence", "teacher_evidence_attached", "blocked"],
  forbiddenDecisions: ["accepted", "rule_enabled", "technology_accepted", "goal_complete"],
  rows: [
    {
      itemNumber: queue.queueItems[0].itemNumber,
      routeId: queue.queueItems[0].routeId,
      requirementId: queue.queueItems[0].requirementId,
      decision: "teacher_evidence_attached",
      allowedDecisions: ["needs_teacher_evidence", "teacher_evidence_attached", "blocked"],
      observedEvidencePath: evidencePath,
      teacherConfirmationText: "teacher confirmed this bounded output witness proves the row",
      selectedNumberedTarget: "not_applicable",
      retainedRollbackPoint: "not_applicable",
      teacherNotes: "Smoke teacher confirmation.",
      mustNotClaimAcceptance: true,
      mustNotRunAutomatically: true
    }
  ],
  locks: { reviewOnly: true, accepted: false, goalComplete: false }
});

const readyResult = runScript("create-original-goal-proof-gap-receipt-intake-router.mjs", [
  "--queue",
  queueResult.queuePath,
  "--receipt",
  receiptPath,
  "--output-dir",
  join(smokeRoot, "ready")
]);
const readyRouter = readJson(readyResult.routerPath);
const validation = readJson(readyRouter.paths.validation);
const handoffBuilder = readJson(readyRouter.paths.handoffBuilder);

const checks = [
  check(
    "Proof gap receipt intake router blocks when teacher receipt is missing",
    missingRouter.status === "blocked_waiting_for_teacher_proof_gap_receipt" &&
      missingRouter.blockers.includes("proof_gap_teacher_receipt_missing") &&
      missingRouter.readyForManualHandoffBuilder === false &&
      missingRouter.locks.routerDoesNotRunNextManualCommand === true,
    missingResult.routerPath
  ),
  check(
    "Proof gap receipt intake router validates teacher receipt and creates copy-only handoff builder",
    readyRouter.status === "ready_for_manual_proof_gap_handoff_builder_review_only" &&
      readyRouter.readyForManualHandoffBuilder === true &&
      readyRouter.readyRows === 1 &&
      readyRouter.nextReviewQueue === 1 &&
      existsSync(readyRouter.paths.handoffBuilderHtml) &&
      handoffBuilder.queueKind === "proof_gap_teacher_queue_receipt_validation" &&
      validation.status === "validated_with_manual_next_review_queue" &&
      readyRouter.nextManualCommand.includes("run-original-goal-review-handoff-queue-item.mjs") &&
      readyRouter.locks.routerDoesNotRunHandoffItem === true &&
      readyRouter.locks.softwareActionsExecuted === false,
    readyResult.routerPath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_original_goal_proof_gap_receipt_intake_router_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    queue: queueResult.queuePath,
    missingRouter: missingResult.routerPath,
    readyRouter: readyResult.routerPath,
    receipt: receiptPath
  }
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
