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
const smokeRoot = join(repoRoot, ".transparent-apprentice", "smoke", "original-goal-proof-gap-closure-pack", String(Date.now()));
rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });

const touch = (name) => {
  const path = join(smokeRoot, name);
  writeFileSync(path, `${name}\n`, "utf8");
  return path;
};

const proofLedgerPath = join(smokeRoot, "original-goal-proof-ledger.json");
const refreshPath = join(smokeRoot, "original-goal-current-status-refresh.json");
writeJson(proofLedgerPath, {
  format: "transparent_ai_original_goal_proof_ledger_v1",
  status: "objective_not_proven_complete",
  completionAllowed: false,
  requirements: [
    {
      id: "all_software_low_token_learning",
      proofState: "partially_proven_review_only",
      missingProof: [
        "unattended all-software learning audit still has remaining gaps",
        "no teacher-confirmed recurring monitor registration is proven",
        "no runner launch/output witness is proven"
      ]
    },
    {
      id: "adapt_any_teacher_learning_method",
      proofState: "partially_proven_review_only",
      missingProof: [
        "a teacher-filled method/profile receipt for the current teacher",
        "a confirmed reuse result proving the chosen method improved the next run"
      ]
    },
    {
      id: "transparent_mask_spatial_depth_understanding",
      proofState: "partially_proven_review_only",
      missingProof: [
        "teacher has not filled and validated the depth rehearsal review receipt",
        "teacher-confirmed selected target must still feed a later execution gate before software action"
      ]
    },
    {
      id: "execute_in_target_software_after_confirmation",
      proofState: "not_proven_requires_teacher_confirmed_execution",
      missingProof: ["teacher must select one numbered target and approve one execution gate"]
    }
  ]
});
writeJson(refreshPath, {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  goal: "Smoke proof gap closure pack.",
  paths: {
    originalGoalProofLedger: proofLedgerPath,
    allSoftwareUnattendedLearningAuditReadme: touch("unattended.md"),
    recurringMonitorTeacherConfirmationPackageHtml: touch("recurring.html"),
    recurringMonitorTeacherConfirmationReceiptTemplate: touch("recurring-receipt.json"),
    recurringMonitorTeacherConfirmationValidationCommandTemplate: "node validate-recurring.js --receipt \"<teacher-filled.json>\"",
    operationalRegistrationApprovedCommandBuilderHtml: touch("registration.html"),
    operationalRegistrationApprovedRunnerCommandTemplate:
      "node run-all-software-operational-learning-registration-approved-runner.mjs --execute-approved-registration true --allow-system-change true --teacher-confirmation \"<teacher>\"",
    operationalPostRegistrationOutputWitnessCommandBuilderHtml: touch("witness-command.html"),
    operationalPostRegistrationOutputWitnessReceiptBuilderHtml: touch("witness-receipt.html"),
    operationalPostRegistrationOutputWitnessReceiptTemplate: touch("witness-template.json"),
    operationalPostRegistrationOutputWitnessRunnerCommandTemplate:
      "node run-all-software-operational-learning-post-registration-output-witness-runner.mjs --allow-runner-trigger true --teacher-confirmation \"<teacher>\"",
    teacherLearningMethodProfile: touch("teacher-profile.json"),
    teacherReviewCockpitHtml: touch("teacher-cockpit.html"),
    teacherReviewCockpitReceiptTemplate: touch("teacher-cockpit-receipt.json"),
    teacherReviewCockpitReceiptValidationCommandTemplate: "node validate-teacher-cockpit.js --receipt \"<teacher-filled.json>\"",
    teacherMethodExecutionLearningContractReadme: touch("teacher-method-contract.md"),
    teacherMethodExecutionLearningContractCommandTemplate: "node create-teacher-method-execution-learning-contract.mjs --teacher-reviewed-method true",
    teacherActionRouterHtml: touch("teacher-router.html"),
    transparentSketchDepthDemonstrationRehearsalHtml: touch("depth.html"),
    transparentSketchDepthRehearsalReviewReceiptBuilderHtml: touch("depth-receipt-builder.html"),
    transparentSketchDepthRehearsalReviewReceiptTemplate: touch("depth-receipt.json"),
    transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate:
      "node validate-transparent-sketch-depth-rehearsal-review-receipt.mjs --receipt \"<teacher-filled.json>\"",
    spatialIntentEvidenceReceiptBuilderHtml: touch("spatial-receipt.html"),
    spatialIntentEvidenceReceiptTemplate: touch("spatial-receipt.json"),
    spatialIntentEvidenceReceiptValidationCommandTemplate: "node validate-spatial-intent-evidence-receipt.mjs --receipt \"<teacher-filled.json>\"",
    executionApprovedGateCommandBuilderHtml: touch("execution-gate.html"),
    executionApprovedGateRunnerCommandTemplate:
      "node run-all-software-execution-approved-gate-runner.mjs --execute-approved-gate true --teacher-confirmation \"<teacher>\"",
    executionFollowUpHandoffItemReceiptBuilderCommandTemplate: "node create-execution-receipt.js",
    executionFollowUpHandoffItemReceiptValidationCommandTemplate: "node validate-execution-receipt.js"
  }
});

const result = spawnSync(
  process.execPath,
  [
    join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-original-goal-proof-gap-closure-pack.mjs"),
    "--status-refresh",
    refreshPath,
    "--proof-ledger",
    proofLedgerPath,
    "--output-dir",
    join(smokeRoot, "out")
  ],
  { cwd: repoRoot, encoding: "utf8" }
);
if (result.status !== 0) throw new Error(result.stderr || result.stdout || "closure pack failed");
const output = JSON.parse(result.stdout);
const pack = readJson(output.packPath);
const html = readFileSync(output.htmlPath, "utf8");
const readme = readFileSync(output.readmePath, "utf8");

assert(output.format === "transparent_ai_original_goal_proof_gap_closure_pack_result_v1", "bad result format");
assert(pack.format === "transparent_ai_original_goal_proof_gap_closure_pack_v1", "bad pack format");
assert(pack.status === "waiting_for_teacher_to_close_proof_gaps", "status should wait for teacher");
assert(pack.counts.closureRoutes === 8, "expected one route per missing proof");
assert(pack.counts.highRiskGatedRoutes >= 3, "expected high-risk gated routes");
assert(pack.closureRoutes.some((row) => row.routeId === "unattended_monitor_audit_route"), "missing unattended route");
assert(pack.closureRoutes.some((row) => row.routeId === "current_teacher_method_receipt_route"), "missing teacher method receipt route");
assert(pack.closureRoutes.some((row) => row.routeId === "transparent_depth_rehearsal_receipt_route"), "missing depth route");
assert(pack.closureRoutes.some((row) => row.routeId === "teacher_confirmed_execution_gate_route"), "missing execution gate route");
assert(pack.closureRoutes.every((row) => row.risk.safeToRunAutomatically === false), "routes must not autorun");
assert(pack.locks.packDoesNotRunCommands === true, "run-command lock missing");
assert(pack.locks.packDoesNotRegisterTask === true, "register lock missing");
assert(pack.locks.packDoesNotCaptureScreenshots === true, "screenshot lock missing");
assert(pack.locks.packDoesNotExecuteTargetSoftware === true, "execution lock missing");
assert(pack.locks.goalComplete === false, "goal complete lock missing");
assert(html.includes("Original Goal Proof Gap Closure Pack"), "html title missing");
assert(readme.includes("Closure routes"), "readme summary missing");
assert(existsSync(output.htmlPath), "html missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_closure_pack_smoke_v1",
      pack: output.packPath,
      html: output.htmlPath,
      closureRoutes: pack.counts.closureRoutes,
      highRiskGatedRoutes: pack.counts.highRiskGatedRoutes
    },
    null,
    2
  )
);
