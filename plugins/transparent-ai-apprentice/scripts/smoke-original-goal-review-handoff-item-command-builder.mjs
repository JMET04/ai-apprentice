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
    : join(tmpdir(), "transparent-ai-apprentice-smoke", "original-goal-review-handoff-item-command-builder", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const reviewFilePath = join(smokeRoot, "fixtures", "review-start-here.md");
mkdirSync(dirname(reviewFilePath), { recursive: true });
writeFileSync(reviewFilePath, "# Review\n\nOpen-only fixture.\n", "utf8");

const remainingGatesValidationQueuePath = writeJson(join(smokeRoot, "queues", "remaining-gates-validation-queue.json"), {
  format: "transparent_ai_original_goal_remaining_gates_receipt_validation_v1",
  validationId: "smoke-remaining-gates-validation-command-builder",
  status: "validated_with_next_review_queue",
  validationDecision: "some_rows_ready_for_next_review_queue",
  counts: { nextReviewQueue: 2, readyRows: 2, waitingRows: 0, blockedRows: 0 },
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
    },
    {
      id: "remaining_gate_next_downstream_validation_smoke",
      order: 2,
      number: 2,
      sourceItemId: "teacher_route_smoke",
      sourceReceiptRowId: "teacher_route_smoke",
      sourceKind: "teacher_route",
      label: "Validate downstream activation receipt",
      lane: "automatic_learning_activation",
      handoffKind: "downstream_receipt_validation",
      status: "waiting_for_teacher_downstream_receipt_or_placeholder_replacement",
      command:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-operational-activation-review-receipt.mjs --receipt <teacher-filled-activation-receipt.json>",
      openPath: reviewFilePath,
      missingInputs: ["<teacher-filled-activation-receipt.json>"],
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

const nextConfirmationValidationQueuePath = writeJson(
  join(smokeRoot, "queues", "next-confirmation-validation-queue.json"),
  {
    format: "transparent_ai_original_goal_next_confirmation_pack_receipt_validation_v1",
    validationId: "smoke-next-confirmation-validation-command-builder",
    status: "validated_with_next_confirmation_review_queue",
    validationDecision: "some_items_ready_for_source_receipt_validation",
    counts: { nextReviewQueue: 1, readyRows: 1, waitingRows: 0, blockedRows: 0 },
    nextReviewQueue: [
      {
        id: "next_confirmation_low_token_compact_smoke",
        order: 1,
        number: 1,
        sourceItemId: "low-token-compact-evidence-10-metadata-only-rows",
        sourceKind: "next_confirmation_pack_item",
        label: "Validate compact low-token source receipt",
        handoffKind: "source_receipt_validation",
        status: "ready_for_manual_source_receipt_validation",
        command:
          "node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-low-token-compact-evidence-request-receipt.mjs --request-pack fixture.json --receipt <teacher-filled-compact-evidence-request-receipt.json>",
        openPath: reviewFilePath,
        missingInputs: ["<teacher-filled-compact-evidence-request-receipt.json>"],
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
  }
);
const proofGapValidationQueuePath = writeJson(join(smokeRoot, "queues", "proof-gap-validation-queue.json"), {
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_validation_v1",
  validationId: "smoke-proof-gap-validation-command-builder",
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

const builderResult = runScript("create-original-goal-review-handoff-item-command-builder.mjs", [
  "--goal",
  "smoke build remaining gates single item command page",
  "--queue",
  remainingGatesValidationQueuePath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const html = readFileSync(builderResult.htmlPath, "utf8");
const readme = readFileSync(builderResult.readmePath, "utf8");

const nextConfirmationBuilderResult = runScript("create-original-goal-review-handoff-item-command-builder.mjs", [
  "--goal",
  "smoke build next confirmation validation single item command page",
  "--queue",
  nextConfirmationValidationQueuePath,
  "--output-dir",
  join(smokeRoot, "next-confirmation-builder")
]);
const nextConfirmationBuilder = readJson(nextConfirmationBuilderResult.builderPath);
const nextConfirmationHtml = readFileSync(nextConfirmationBuilderResult.htmlPath, "utf8");

const proofGapBuilderResult = runScript("create-original-goal-review-handoff-item-command-builder.mjs", [
  "--goal",
  "smoke build proof gap validation manual handoff page",
  "--queue",
  proofGapValidationQueuePath,
  "--output-dir",
  join(smokeRoot, "proof-gap-builder")
]);
const proofGapBuilder = readJson(proofGapBuilderResult.builderPath);
const proofGapHtml = readFileSync(proofGapBuilderResult.htmlPath, "utf8");

const templateResult = runScript("create-original-goal-review-handoff-item-command-builder.mjs", [
  "--goal",
  "smoke build placeholder single item command page",
  "--output-dir",
  join(smokeRoot, "placeholder-builder")
]);
const templateBuilder = readJson(templateResult.builderPath);
const templateHtml = readFileSync(templateResult.htmlPath, "utf8");

const checks = [
  check(
    "Original goal review handoff item command builder supports remaining-gates validation queues",
    builder.format === "transparent_ai_original_goal_review_handoff_item_command_builder_v1" &&
      builder.queueKind === "remaining_gates_validation" &&
      builder.queueSupported === true &&
      builder.counts.queueItems === 2 &&
      builder.counts.missingInputItems === 1 &&
      builder.commandTemplate.includes("run-original-goal-review-handoff-queue-item.mjs") &&
      builder.commandTemplate.includes(remainingGatesValidationQueuePath) &&
      existsSync(builderResult.htmlPath),
    builderResult.builderPath
  ),
  check(
    "Original goal review handoff item command builder supports next-confirmation validation queues",
    nextConfirmationBuilder.queueKind === "next_confirmation_pack_validation" &&
      nextConfirmationBuilder.queueSupported === true &&
      nextConfirmationBuilder.counts.queueItems === 1 &&
      nextConfirmationBuilder.counts.missingInputItems === 1 &&
      nextConfirmationBuilder.items[0].handoffKind === "source_receipt_validation" &&
      nextConfirmationBuilder.items[0].status === "ready_for_manual_source_receipt_validation" &&
      nextConfirmationHtml.includes("next_confirmation_low_token_compact_smoke") &&
      nextConfirmationBuilder.locks.builderDoesNotRunHandoffItem === true &&
      nextConfirmationBuilder.locks.goalComplete === false,
    nextConfirmationBuilderResult.builderPath
  ),
  check(
    "Original goal review handoff item command builder supports proof-gap receipt validation queues",
    proofGapBuilder.format === "transparent_ai_original_goal_review_handoff_item_command_builder_v1" &&
      proofGapBuilder.queueKind === "proof_gap_teacher_queue_receipt_validation" &&
      proofGapBuilder.queueSupported === true &&
      proofGapBuilder.counts.queueItems === 1 &&
      proofGapBuilder.items[0].handoffKind === "manual_next_review_route" &&
      proofGapBuilder.items[0].openPath === reviewFilePath &&
      proofGapBuilder.items[0].verificationCommandTemplate.includes("post-registration-output-witness") &&
      proofGapHtml.includes("manual_next_review_route"),
    proofGapBuilderResult.builderPath
  ),
  check(
    "Original goal review handoff item command builder writes a browser command generator",
    html.includes("Generate single-item runner command") &&
      html.includes("Copy command") &&
      html.includes("Download run request JSON") &&
      html.includes("original_goal_review_handoff_item_command_builder") &&
      html.includes("teacher confirmed original goal review handoff item") &&
      html.includes("remaining_gate_next_downstream_validation_smoke") &&
      readme.includes("does not run the command"),
    builderResult.htmlPath
  ),
  check(
    "Original goal review handoff item command builder keeps execution locks closed",
    builder.locks.builderDoesNotRunHandoffItem === true &&
      builder.locks.builderDoesNotInvokeRunner === true &&
      builder.locks.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks.builderDoesNotCaptureScreenshots === true &&
      builder.locks.builderDoesNotWriteMemory === true &&
      builder.locks.nativeUniversalExecution === false &&
      builder.locks.goalComplete === false,
    builderResult.builderPath
  ),
  check(
    "Original goal review handoff item command builder can render before a queue path is available",
    templateBuilder.status === "waiting_for_teacher_handoff_queue_path" &&
      templateBuilder.queueKind === "queue_not_loaded_yet" &&
      templateBuilder.items[0].status === "waiting_for_queue_path" &&
      templateHtml.includes("&lt;teacher-action-router-cockpit-remaining-gates-or-next-confirmation-validation-queue.json&gt;"),
    templateResult.builderPath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_original_goal_review_handoff_item_command_builder_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    builder: builderResult.builderPath,
    html: builderResult.htmlPath,
    nextConfirmationBuilder: nextConfirmationBuilderResult.builderPath,
    placeholderBuilder: templateResult.builderPath
  }
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
