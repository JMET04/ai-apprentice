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
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "original-goal-proof-gap-teacher-queue", String(Date.now()));
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
    statusRefresh: touch("original-goal-current-status-refresh.json"),
    proofLedger: touch("original-goal-proof-ledger.json")
  },
  counts: {
    closureRoutes: 4,
    highRiskGatedRoutes: 2
  },
  closureRoutes: [
    {
      requirementId: "all_software_low_token_learning",
      missingProof: "unattended all-software learning audit still has remaining gaps",
      routeId: "unattended_monitor_audit_route",
      title: "Close unattended all-software monitor audit gaps",
      teacherAction: "Review the unattended audit before registration.",
      evidence: [{ key: "audit", label: "Audit", value: touch("audit.md"), exists: true, basename: "audit.md" }],
      commandTemplate: "node validate-recurring.js --receipt \"<teacher-filled.json>\"",
      requiredTeacherInputs: ["teacher-filled recurring monitor confirmation receipt"],
      blockedUntilTeacher: true,
      risk: { matchedHighRiskMarkers: [], safeToRunAutomatically: false }
    },
    {
      requirementId: "adapt_any_teacher_learning_method",
      missingProof: "a teacher-filled method/profile receipt for the current teacher",
      routeId: "current_teacher_method_receipt_route",
      title: "Validate teacher method",
      teacherAction: "Confirm the teacher method.",
      evidence: [{ key: "profile", label: "Profile", value: touch("profile.json"), exists: true, basename: "profile.json" }],
      commandTemplate: "node validate-teacher-method.js --receipt \"<teacher-filled.json>\"",
      requiredTeacherInputs: ["teacher-filled method/profile receipt"],
      blockedUntilTeacher: true,
      risk: { matchedHighRiskMarkers: [], safeToRunAutomatically: false }
    },
    {
      requirementId: "transparent_mask_spatial_depth_understanding",
      missingProof: "teacher has not filled and validated the depth rehearsal review receipt",
      routeId: "transparent_depth_rehearsal_receipt_route",
      title: "Validate depth rehearsal",
      teacherAction: "Review 2D, perspective, and 3D rows.",
      evidence: [{ key: "depth", label: "Depth", value: touch("depth.html"), exists: true, basename: "depth.html" }],
      commandTemplate: "node validate-depth.js --receipt \"<teacher-filled.json>\"",
      requiredTeacherInputs: ["teacher-filled transparent sketch depth rehearsal receipt"],
      blockedUntilTeacher: true,
      risk: { matchedHighRiskMarkers: [], safeToRunAutomatically: false }
    },
    {
      requirementId: "execute_in_target_software_after_confirmation",
      missingProof: "teacher must select one numbered target and approve one execution gate",
      routeId: "teacher_confirmed_execution_gate_route",
      title: "Close execution proof",
      teacherAction: "Advance one reviewed target through execution approval.",
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
    packDoesNotExecuteTargetSoftware: true,
    goalComplete: false
  }
});

const result = spawnSync(
  process.execPath,
  [
    join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-original-goal-proof-gap-teacher-queue.mjs"),
    "--closure-pack",
    closurePackPath,
    "--output-dir",
    join(smokeRoot, "out")
  ],
  { cwd: repoRoot, encoding: "utf8" }
);
if (result.status !== 0) throw new Error(result.stderr || result.stdout || "teacher queue failed");
const output = JSON.parse(result.stdout);
const queue = readJson(output.queuePath);
const receipt = readJson(output.receiptTemplatePath);
const html = readFileSync(output.htmlPath, "utf8");
const readme = readFileSync(output.readmePath, "utf8");

assert(output.format === "transparent_ai_original_goal_proof_gap_teacher_queue_result_v1", "bad result format");
assert(queue.format === "transparent_ai_original_goal_proof_gap_teacher_queue_v1", "bad queue format");
assert(queue.status === "waiting_for_teacher_evidence_queue_receipt", "status should wait for teacher evidence");
assert(queue.counts.queueItems === 4, "expected one queue item per closure route");
assert(queue.counts.receiptRows === 4, "receipt rows should match queue items");
assert(queue.counts.highRiskGatedItems >= 1, "expected high-risk gated item");
assert(queue.nextProofGapSummary.status === "next_teacher_evidence_required", "next proof gap summary missing");
assert(queue.nextProofGapSummary.itemNumber === 1, "next proof gap summary should point to the first queue item");
assert(queue.nextProofGapSummary.routeId === "unattended_monitor_audit_route", "next proof gap summary route mismatch");
assert(
  queue.nextProofGapSummary.receiptValidationCommandTemplate.includes(
    "validate-original-goal-proof-gap-teacher-queue-receipt.mjs"
  ),
  "next proof gap summary should expose receipt validation command"
);
assert(queue.nextProofGapSummary.queuePath === output.queuePath, "next proof gap summary queue path mismatch");
assert(
  queue.nextProofGapSummary.blockedTransitions.includes("execute_target_software"),
  "next summary must keep execution blocked"
);
assert(queue.queueItems[0].itemNumber === 1, "queue should be numbered");
assert(queue.queueItems.some((item) => item.phase === "all_software_low_token_log_learning"), "missing low-token phase");
assert(queue.queueItems.some((item) => item.phase === "adaptive_teacher_method"), "missing teacher method phase");
assert(queue.queueItems.some((item) => item.phase === "transparent_overlay_spatial_depth"), "missing depth phase");
assert(queue.queueItems.some((item) => item.phase === "teacher_confirmed_target_software_execution"), "missing execution phase");
assert(queue.queueItems.every((item) => item.blockedTransitions.includes("goal_complete_claim")), "goal completion must be blocked");
assert(queue.queueItems.some((item) => item.blockedTransitions.includes("execute_target_software")), "execution must be blocked");
assert(receipt.format === "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_v1", "bad receipt format");
assert(receipt.defaultDecision === "needs_teacher_evidence", "receipt default must not accept");
assert(receipt.forbiddenDecisions.includes("accepted"), "accepted must be forbidden");
assert(queue.locks.queueDoesNotRunCommands === true, "run-command lock missing");
assert(queue.locks.queueDoesNotRegisterTask === true, "register lock missing");
assert(queue.locks.queueDoesNotCaptureScreenshots === true, "screenshot lock missing");
assert(queue.locks.queueDoesNotExecuteTargetSoftware === true, "execution lock missing");
assert(queue.locks.goalComplete === false, "goal complete lock missing");
assert(html.includes("Original Goal Proof Gap Teacher Queue"), "html title missing");
assert(readme.includes("Queue items"), "readme summary missing");
assert(existsSync(output.receiptTemplatePath), "receipt template missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_teacher_queue_smoke_v1",
      queue: output.queuePath,
      html: output.htmlPath,
      receiptTemplate: output.receiptTemplatePath,
      queueItems: queue.counts.queueItems,
      highRiskGatedItems: queue.counts.highRiskGatedItems
    },
    null,
    2
  )
);
