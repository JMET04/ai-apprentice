#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    cwd: process.cwd(),
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

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(tmpdir(), "transparent-ai-apprentice-smoke", "original-goal-review-handoff-item-runner", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const cockpitPath = writeJson(join(smokeRoot, "fixtures", "goal-teacher-review-cockpit.json"), {
  format: "transparent_ai_goal_teacher_review_cockpit_v1",
  cockpitId: "smoke-cockpit",
  reviewItems: [
    {
      id: "coverage_rollout_receipt",
      title: "Coverage rollout receipt",
      command: "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-coverage-rollout-receipt.mjs --receipt <teacher-filled-coverage-rollout-receipt.json>",
      blockedActions: ["execute_now", "claim_complete"]
    }
  ],
  blockedActions: ["accepted", "execute_now", "enable_memory", "claim_complete", "unlock_packaging"],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  }
});

const cockpitReceiptPath = writeJson(join(smokeRoot, "fixtures", "teacher-filled-goal-cockpit-receipt.json"), {
  format: "transparent_ai_goal_teacher_review_cockpit_receipt_v1",
  cockpitId: "smoke-cockpit",
  rowDecisions: [
    {
      id: "coverage_rollout_receipt",
      teacherDecision: "teacher_reviewed_continue",
      evidenceReviewed: true,
      teacherNote: "Reviewed in smoke."
    }
  ],
  blockedActions: ["accepted", "execute_now", "enable_memory", "claim_complete", "unlock_packaging"]
});

const reviewFilePath = join(smokeRoot, "fixtures", "review-start-here.md");
writeFileSync(reviewFilePath, "# Review\n\nOpen-only fixture.\n", "utf8");

const cockpitQueuePath = writeJson(join(smokeRoot, "queues", "cockpit-handoff-queue.json"), {
  format: "transparent_ai_goal_teacher_review_cockpit_handoff_queue_v1",
  queueId: "smoke-cockpit-handoff-queue",
  status: "waiting_for_teacher_downstream_receipts",
  queueDecision: "waiting_for_teacher_downstream_receipts",
  counts: { queueItems: 2, readyManualCount: 1, placeholderCount: 1, blockedCount: 0 },
  queueItems: [
    {
      id: "cockpit_handoff_queue_001",
      order: 1,
      sourceItemId: "coverage_rollout_receipt",
      handoffKind: "downstream_receipt_validation",
      status: "waiting_for_teacher_downstream_receipt_or_placeholder_replacement",
      command: `node plugins\\transparent-ai-apprentice\\scripts\\validate-goal-teacher-review-cockpit-receipt.mjs --cockpit "${cockpitPath}" --receipt <teacher-filled-goal-teacher-review-cockpit-receipt.json>`,
      missingInputs: ["<teacher-filled-goal-teacher-review-cockpit-receipt.json>"],
      safety: { safeForManualReviewHandoff: true, matchedForbiddenMarkers: [] }
    },
    {
      id: "cockpit_handoff_queue_002",
      order: 2,
      sourceItemId: "open_review_file",
      handoffKind: "open_review_entry",
      status: "ready_for_manual_review_handoff",
      command: reviewFilePath,
      missingInputs: [],
      safety: { safeForManualReviewHandoff: true, matchedForbiddenMarkers: [] }
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  }
});

const routerQueuePath = writeJson(join(smokeRoot, "queues", "router-handoff-queue.json"), {
  format: "transparent_ai_original_goal_teacher_action_router_handoff_queue_v1",
  queueId: "smoke-router-handoff-queue",
  status: "ready_for_manual_review_handoff",
  queueDecision: "ready_for_manual_review_handoff",
  counts: { queueItems: 1, readyManualCount: 1, placeholderCount: 0, blockedCount: 0 },
  queueItems: [
    {
      id: "router_handoff_queue_001",
      order: 1,
      reviewEntryId: "open_review_file",
      handoffKind: "open_review_entry",
      status: "ready_for_manual_review_handoff",
      command: reviewFilePath,
      openPath: reviewFilePath,
      missingInputs: [],
      safety: { safeForManualReviewHandoff: true, matchedForbiddenMarkers: [] }
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  }
});

const remainingGatesValidationQueuePath = writeJson(join(smokeRoot, "queues", "remaining-gates-validation-queue.json"), {
  format: "transparent_ai_original_goal_remaining_gates_receipt_validation_v1",
  validationId: "smoke-remaining-gates-validation",
  status: "validated_with_next_review_queue",
  validationDecision: "some_rows_ready_for_next_review_queue",
  counts: { nextReviewQueue: 1, readyRows: 1, waitingRows: 0, blockedRows: 0 },
  nextReviewQueue: [
    {
      id: "remaining_gate_next_low_token_action_smoke",
      order: 1,
      number: 1,
      sourceItemId: "low_token_action_smoke",
      sourceReceiptRowId: "low_token_action_smoke",
      sourceKind: "low_token_action",
      label: "Review compact low-token evidence",
      lane: "compact_learning_review",
      handoffKind: "open_review_entry",
      status: "ready_for_manual_review_handoff",
      command: reviewFilePath,
      openPath: reviewFilePath,
      missingInputs: [],
      safety: { safeForReviewQueue: true, matchedForbiddenMarkers: [] },
      executesNow: false,
      commandExecutableNow: false
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const nextConfirmationValidationQueuePath = writeJson(join(smokeRoot, "queues", "next-confirmation-validation-queue.json"), {
  format: "transparent_ai_original_goal_next_confirmation_pack_receipt_validation_v1",
  validationId: "smoke-next-confirmation-validation",
  status: "validated_with_next_confirmation_review_queue",
  validationDecision: "some_items_ready_for_source_receipt_validation",
  counts: { nextReviewQueue: 1, readyRows: 1, waitingRows: 0, blockedRows: 0 },
  nextReviewQueue: [
    {
      id: "next_confirmation_source_receipt_validation_smoke",
      order: 1,
      number: 1,
      sourceItemId: "teacher-action-router-5-current-gates",
      sourceKind: "next_confirmation_pack_item",
      label: "Validate a next-confirmation downstream source receipt",
      handoffKind: "source_receipt_validation",
      status: "ready_for_manual_source_receipt_validation",
      command: `node plugins\\transparent-ai-apprentice\\scripts\\validate-goal-teacher-review-cockpit-receipt.mjs --cockpit "${cockpitPath}" --receipt <teacher-filled-next-confirmation-source-receipt.json>`,
      openPath: reviewFilePath,
      missingInputs: ["<teacher-filled-next-confirmation-source-receipt.json>"],
      safety: { safeForReviewHandoff: true, matchedForbiddenMarkers: [] },
      executesNow: false,
      commandExecutableNow: false
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const proofGapValidationQueuePath = writeJson(join(smokeRoot, "queues", "proof-gap-validation-queue.json"), {
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_validation_v1",
  validationId: "smoke-proof-gap-validation",
  status: "validated_with_manual_next_review_queue",
  validationDecision: "some_rows_ready_for_manual_next_review",
  counts: { nextReviewQueue: 1, readyRows: 1, waitingRows: 0, blockedRows: 0 },
  nextReviewQueue: [
    {
      order: 1,
      itemNumber: 1,
      phase: "all_software_low_token_log_learning",
      routeId: "post_registration_output_witness_route",
      requirementId: "all_software_low_token_learning",
      teacherQuestion: "Does this bounded witness prove the low-token route?",
      verificationCommandTemplate:
        "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-operational-learning-post-registration-output-witness-runner.mjs --teacher-confirmation <teacher-confirmed-post-registration-output-witness-text>",
      commandPlaceholders: ["<teacher-confirmed-post-registration-output-witness-text>"],
      observedEvidencePath: reviewFilePath,
      status: "ready_for_manual_next_review_route",
      canRunAutomatically: false,
      blockedActions: ["launch_runner", "execute_target_software", "claim_goal_complete"]
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const unsafeQueuePath = writeJson(join(smokeRoot, "queues", "unsafe-handoff-queue.json"), {
  format: "transparent_ai_goal_teacher_review_cockpit_handoff_queue_v1",
  queueId: "smoke-unsafe-handoff-queue",
  status: "ready_for_manual_review_handoff",
  queueDecision: "ready_for_manual_review_handoff",
  queueItems: [
    {
      id: "cockpit_handoff_queue_unsafe",
      order: 1,
      handoffKind: "downstream_receipt_validation",
      status: "ready_for_manual_review_handoff",
      command:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-goal-teacher-review-cockpit-receipt.mjs --cockpit fixture.json --receipt fixture.json --execute",
      missingInputs: [],
      safety: { safeForManualReviewHandoff: false, matchedForbiddenMarkers: ["--execute"] }
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  }
});

const missingConfirmation = runScript("run-original-goal-review-handoff-queue-item.mjs", [
  "--queue",
  cockpitQueuePath,
  "--item-number",
  "1",
  "--receipt",
  cockpitReceiptPath,
  "--output-dir",
  join(smokeRoot, "missing-confirmation")
]);
const missingRun = readJson(missingConfirmation.runPath);

const validatedResult = runScript("run-original-goal-review-handoff-queue-item.mjs", [
  "--queue",
  cockpitQueuePath,
  "--item-number",
  "1",
  "--receipt",
  cockpitReceiptPath,
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed original goal review handoff item",
  "--rollback-point-created",
  "--rollback-point",
  "retained-smoke-rollback-point",
  "--output-dir",
  join(smokeRoot, "validated")
]);
const validatedRun = readJson(validatedResult.runPath);
const downstreamValidation = readJson(validatedRun.generatedEvidence.downstreamValidationPath);

const openCockpitResult = runScript("run-original-goal-review-handoff-queue-item.mjs", [
  "--queue",
  cockpitQueuePath,
  "--item-number",
  "2",
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed original goal review handoff item",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "open-cockpit")
]);
const openCockpitRun = readJson(openCockpitResult.runPath);

const openRouterResult = runScript("run-original-goal-review-handoff-queue-item.mjs", [
  "--queue",
  routerQueuePath,
  "--item-number",
  "1",
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed original goal review handoff item",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "open-router")
]);
const openRouterRun = readJson(openRouterResult.runPath);

const openRemainingGatesResult = runScript("run-original-goal-review-handoff-queue-item.mjs", [
  "--queue",
  remainingGatesValidationQueuePath,
  "--item-number",
  "1",
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed original goal review handoff item",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "open-remaining-gates")
]);
const openRemainingGatesRun = readJson(openRemainingGatesResult.runPath);

const openProofGapResult = runScript("run-original-goal-review-handoff-queue-item.mjs", [
  "--queue",
  proofGapValidationQueuePath,
  "--item-number",
  "1",
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed original goal review handoff item",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "open-proof-gap")
]);
const openProofGapRun = readJson(openProofGapResult.runPath);

const nextConfirmationSourceValidationResult = runScript("run-original-goal-review-handoff-queue-item.mjs", [
  "--queue",
  nextConfirmationValidationQueuePath,
  "--item-number",
  "1",
  "--receipt",
  cockpitReceiptPath,
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed original goal review handoff item",
  "--rollback-point-created",
  "--rollback-point",
  "retained-smoke-rollback-point",
  "--output-dir",
  join(smokeRoot, "next-confirmation-source-validation")
]);
const nextConfirmationSourceValidationRun = readJson(nextConfirmationSourceValidationResult.runPath);
const nextConfirmationDownstreamValidation = readJson(
  nextConfirmationSourceValidationRun.generatedEvidence.downstreamValidationPath
);

const unsafeResult = runScript("run-original-goal-review-handoff-queue-item.mjs", [
  "--queue",
  unsafeQueuePath,
  "--item-number",
  "1",
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed original goal review handoff item",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "unsafe")
]);
const unsafeRun = readJson(unsafeResult.runPath);

const checks = [
  check(
    "Original goal review handoff item runner blocks before teacher confirmation and rollback",
    missingRun.status === "blocked_before_original_goal_review_handoff_runner" &&
      missingRun.blockReason.includes("missing_run_reviewed_handoff_flag") &&
      missingRun.blockReason.includes("missing_allow_runner_flag") &&
      missingRun.blockReason.includes("missing_teacher_original_goal_review_handoff_confirmation") &&
      missingRun.blockReason.includes("rollback_point_not_confirmed_for_original_goal_review_handoff_item") &&
      missingRun.locks.reviewHandoffItemRunnerUsesStructuredArgumentsOnly === true,
    missingConfirmation.runPath
  ),
  check(
    "Original goal review handoff item runner invokes one allowlisted downstream validation with structured args",
    validatedRun.status === "reviewed_downstream_validation_completed" &&
      validatedRun.queueKind === "teacher_review_cockpit" &&
      validatedRun.validationScriptInvoked === true &&
      validatedRun.selectedItem.structuredValidationScript === "validate-goal-teacher-review-cockpit-receipt.mjs" &&
      downstreamValidation.format === "transparent_ai_goal_teacher_review_cockpit_receipt_validation_v1" &&
      downstreamValidation.status === "validated_with_reviewed_cockpit_rows" &&
      validatedRun.locks.commandsExecuted === false &&
      validatedRun.locks.reviewHandoffItemRunnerDoesNotRunArbitraryCommandString === true,
    validatedResult.runPath
  ),
  check(
    "Original goal review handoff item runner converts open-review cockpit item into evidence without opening GUI",
    openCockpitRun.status === "review_entry_ready_to_open" &&
      openCockpitRun.validationScriptInvoked === false &&
      openCockpitRun.generatedEvidence.openReviewPath === reviewFilePath &&
      openCockpitRun.locks.reviewHandoffItemRunnerDoesNotOpenGui === true,
    openCockpitResult.runPath
  ),
  check(
    "Original goal review handoff item runner supports teacher action router handoff queues",
    openRouterRun.status === "review_entry_ready_to_open" &&
      openRouterRun.queueKind === "teacher_action_router" &&
      openRouterRun.generatedEvidence.openReviewPath === reviewFilePath &&
      openRouterRun.locks.nativeUniversalExecution === false,
    openRouterResult.runPath
  ),
  check(
    "Original goal review handoff item runner supports remaining-gates validation next review queues",
    openRemainingGatesRun.status === "review_entry_ready_to_open" &&
      openRemainingGatesRun.queueKind === "remaining_gates_validation" &&
      openRemainingGatesRun.generatedEvidence.openReviewPath === reviewFilePath &&
      openRemainingGatesRun.selectedItem.sourceKind === "low_token_action" &&
      openRemainingGatesRun.locks.reviewHandoffItemRunnerDoesNotRunArbitraryCommandString === true &&
      openRemainingGatesRun.locks.nativeUniversalExecution === false,
    openRemainingGatesResult.runPath
  ),
  check(
    "Original goal review handoff item runner supports proof-gap validation next review queues without invoking runner commands",
    openProofGapRun.status === "review_entry_ready_to_open" &&
      openProofGapRun.queueKind === "proof_gap_teacher_queue_receipt_validation" &&
      openProofGapRun.generatedEvidence.openReviewPath === reviewFilePath &&
      openProofGapRun.generatedEvidence.verificationCommandTemplateForSeparateGate.includes(
        "post-registration-output-witness-runner"
      ) &&
      openProofGapRun.validationScriptInvoked === false &&
      openProofGapRun.locks.commandsExecuted === false &&
      openProofGapRun.locks.nativeUniversalExecution === false,
    openProofGapResult.runPath
  ),
  check(
    "Original goal review handoff item runner supports next-confirmation source receipt validation queues",
    nextConfirmationSourceValidationRun.status === "reviewed_downstream_validation_completed" &&
      nextConfirmationSourceValidationRun.queueKind === "next_confirmation_pack_validation" &&
      nextConfirmationSourceValidationRun.selectedItem.handoffKind === "source_receipt_validation" &&
      nextConfirmationSourceValidationRun.selectedItem.structuredValidationScript ===
        "validate-goal-teacher-review-cockpit-receipt.mjs" &&
      nextConfirmationDownstreamValidation.format === "transparent_ai_goal_teacher_review_cockpit_receipt_validation_v1" &&
      nextConfirmationSourceValidationRun.locks.reviewHandoffItemRunnerUsesStructuredArgumentsOnly === true &&
      nextConfirmationSourceValidationRun.locks.nativeUniversalExecution === false,
    nextConfirmationSourceValidationResult.runPath
  ),
  check(
    "Original goal review handoff item runner blocks unsafe execute markers",
    unsafeRun.status === "blocked_before_original_goal_review_handoff_runner" &&
      unsafeRun.blockReason.includes("selected_item_has_unsafe_command_markers") &&
      unsafeRun.selectedItem.matchedForbiddenMarkers.includes("--execute") &&
      unsafeRun.validationScriptInvoked === false &&
      unsafeRun.locks.goalComplete === false,
    unsafeResult.runPath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_original_goal_review_handoff_queue_item_runner_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    missingConfirmation: missingConfirmation.runPath,
    validated: validatedResult.runPath,
    openCockpit: openCockpitResult.runPath,
    openRouter: openRouterResult.runPath,
    openRemainingGates: openRemainingGatesResult.runPath,
    openProofGap: openProofGapResult.runPath,
    nextConfirmationSourceValidation: nextConfirmationSourceValidationResult.runPath,
    unsafe: unsafeResult.runPath
  }
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
