#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "smoke", "original-goal-proof-ledger", String(Date.now()));
rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });

const statusRefreshPath = join(smokeRoot, "original-goal-current-status-refresh.json");
const objectiveAuditPath = join(smokeRoot, "original-goal-objective-fulfillment-audit.json");
const nextConfirmationPackPath = join(smokeRoot, "original-goal-next-confirmation-pack.json");
writeJson(statusRefreshPath, {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  goal: "Make all software learn from low-token logs and transparent sketch confirmation.",
  paths: {
    originalGoalObjectiveFulfillmentAudit: objectiveAuditPath,
    originalGoalNextConfirmationPack: nextConfirmationPackPath
  },
  refreshedEvidence: {
    realLocalAllSoftwareLowTokenReadinessPackageReady: true,
    logSourceDiscoveryLedgerReady: true,
    allRowsHaveLogSourceRoute: true,
    originalGoalCapabilityMatrixCoverageStatus: "covered_review_only_capability_matrix",
    allSoftwareLogSourceDiscoveryComplete: false,
    allSoftwareUnattendedLearningAuditRemainingGaps: 2,
    originalGoalIntegratedControlFlowReviewOnly: true,
    teacherActionShortlistRouterReceiptReady: true,
    nonExpertEngineeringVoiceControlCapabilityReady: true,
    parametricFeatureDataLogicLearningReady: true,
    transparentSketchDepthDemonstrationRehearsalReady: true,
    transparentSketch2DPerspective3DImplemented: true,
    formalSpatialIntentEvidencePresent: true,
    spatialIntentEvidenceReceiptValidationStatus: "blocked_waiting_for_teacher_packet",
    transparentSketchDepthRehearsalReviewReceiptValidationWaitingForTeacher: true,
    executionApprovedGateCommandBuilderReady: true,
    operationalRegistrationApprovedCommandBuilderReady: true
  },
  locks: {
    reviewOnly: true,
    accepted: false,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    goalComplete: false
  }
});
writeJson(objectiveAuditPath, {
  format: "transparent_ai_original_goal_objective_fulfillment_audit_v1",
  status: "objective_not_fulfilled_yet",
  requirements: [
    {
      id: "all_software_low_token_learning",
      missingBeforeCompletion: [
        "allSoftwareLogSourceDiscoveryComplete is not true for the current refresh",
        "unattended all-software learning audit still has remaining gaps"
      ]
    },
    {
      id: "adapt_any_teacher_learning_method",
      missingBeforeCompletion: ["a teacher-filled method/profile receipt for the current teacher"]
    },
    {
      id: "transparent_mask_2d_perspective_3d_depth_understanding",
      missingBeforeCompletion: ["teacher has not filled and validated the depth rehearsal review receipt"]
    },
    {
      id: "execute_in_target_software_after_confirmation",
      missingBeforeCompletion: ["teacher must select one numbered target and approve one execution gate"]
    }
  ]
});
const confirmationItems = [
  {
    itemId: "low-token-compact-evidence-10-metadata-only-rows",
    openPath: join(smokeRoot, "compact.html"),
    validationCommand: "node validate-compact.js"
  },
  {
    itemId: "teacher-action-router-5-current-gates",
    openPath: join(smokeRoot, "router.html"),
    validationCommand: "node validate-router.js"
  },
  {
    itemId: "transparent-overlay-real-teacher-packet",
    openPath: join(smokeRoot, "sketch.html"),
    validationCommand: "node validate-sketch.js"
  },
  {
    itemId: "action-logic-source-contract-review",
    openPath: join(smokeRoot, "logic.html"),
    validationCommand: "node validate-logic.js"
  }
];
writeJson(nextConfirmationPackPath, {
  format: "transparent_ai_original_goal_next_confirmation_pack_v1",
  counts: {
    compactMetadataRows: 10,
    sensitiveManualRows: 3
  },
  confirmationItems
});

const result = spawnSync(
  process.execPath,
  [
    join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-original-goal-proof-ledger.mjs"),
    "--status-refresh",
    statusRefreshPath,
    "--objective-audit",
    objectiveAuditPath,
    "--next-confirmation-pack",
    nextConfirmationPackPath,
    "--output-dir",
    join(smokeRoot, "out")
  ],
  { cwd: repoRoot, encoding: "utf8" }
);
if (result.status !== 0) throw new Error(result.stderr || result.stdout || "proof ledger failed");
const output = JSON.parse(result.stdout);
const ledger = readJson(output.ledgerPath);
const html = readFileSync(output.htmlPath, "utf8");
const readme = readFileSync(output.readmePath, "utf8");

assert(output.format === "transparent_ai_original_goal_proof_ledger_result_v1", "bad result format");
assert(ledger.format === "transparent_ai_original_goal_proof_ledger_v1", "bad ledger format");
assert(ledger.status === "objective_not_proven_complete", "ledger must not claim completion");
assert(ledger.completionAllowed === false, "completion must stay false");
assert(ledger.requirements.length === 4, "expected four original-goal requirement rows");
assert(ledger.counts.nextTeacherConfirmationCount === 4, "all rows should link next teacher confirmation");
assert(
  ledger.requirements.some(
    (row) =>
      row.id === "all_software_low_token_learning" &&
      row.currentEvidence.compactMetadataRows === 10 &&
      row.currentEvidence.sensitiveManualRows === 3 &&
      row.missingProof.some((item) => item.includes("allSoftwareLogSourceDiscoveryComplete"))
  ),
  "low-token proof row missing"
);
assert(
  ledger.requirements.some(
    (row) =>
      row.id === "transparent_mask_spatial_depth_understanding" &&
      row.proofState === "partially_proven_review_only" &&
      row.nextTeacherConfirmation.itemId === "transparent-overlay-real-teacher-packet"
  ),
  "transparent sketch proof row missing"
);
assert(
  ledger.requirements.some(
    (row) =>
      row.id === "execute_in_target_software_after_confirmation" &&
      row.proofState === "not_proven_requires_teacher_confirmed_execution"
  ),
  "execution proof row should remain unproven"
);
assert(ledger.locks.ledgerDoesNotExecuteTargetSoftware === true, "execution lock missing");
assert(ledger.locks.goalComplete === false, "goal lock missing");
assert(html.includes("Original Goal Proof Ledger"), "html title missing");
assert(readme.includes("Locked defaults"), "readme lock note missing");
assert(existsSync(output.htmlPath), "html missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_ledger_smoke_v1",
      ledger: output.ledgerPath,
      html: output.htmlPath,
      requirementCount: ledger.requirements.length,
      missingProofCount: ledger.counts.missingProofCount
    },
    null,
    2
  )
);
