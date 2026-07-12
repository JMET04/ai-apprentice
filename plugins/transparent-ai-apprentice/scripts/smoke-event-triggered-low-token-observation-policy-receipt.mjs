#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "event-triggered-low-token-observation-policy-receipt-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args, options = {}) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (options.expectFailure) return result;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const cyclePath = join(smokeRoot, "all-software-low-token-learning-cycle.json");
const visualQueuePath = join(smokeRoot, "automatic-triggered-visual-check-queue.json");

writeFileSync(
  cyclePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_low_token_learning_cycle_v1",
      metadataGateRuns: [
        {
          software: "SpreadsheetDesigner",
          changedLogMetadata: 2,
          scannedLogMetadata: 6,
          gatePath: "D:\\example\\spreadsheet-metadata-gate.json"
        }
      ],
      watchRuns: [
        {
          watchCyclePath: "D:\\example\\watch-cycle.json",
          changedItems: [
            {
              software: "MeshViewer",
              classifications: ["ambiguous_or_teacher_marker"],
              screenshotRecommended: true
            }
          ]
        }
      ],
      learningRuns: [
        {
          software: "SpreadsheetDesigner",
          compactEventCount: 3,
          classifications: ["success_state_change"],
          compactLearningEventsPath: "D:\\example\\compact-events.json"
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

writeFileSync(
  visualQueuePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_automatic_triggered_visual_check_queue_v1",
      requests: [
        {
          id: "meshviewer-ambiguous-1",
          software: "MeshViewer",
          triggerReason: "ambiguous_or_teacher_marker",
          learningCyclePath: cyclePath
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

const budgetResult = runNodeScript("create-low-token-trigger-budget-plan.mjs", [
  "--goal",
  "Use changed logs to decide whether a visual check is worth the token cost.",
  "--learning-cycle",
  cyclePath,
  "--visual-check-queue",
  visualQueuePath,
  "--token-budget",
  "6",
  "--output-dir",
  join(smokeRoot, "budget")
]);

const policyResult = runNodeScript("create-event-triggered-low-token-observation-policy.mjs", [
  "--budget-plan",
  budgetResult.planPath,
  "--goal",
  "Convert all-software changed evidence into event-triggered low-token observation policy.",
  "--output-dir",
  join(smokeRoot, "policy")
]);
const policy = readJson(policyResult.policyPath);
const receipt = readJson(policyResult.receiptTemplatePath);
const visualRowIndexes = policy.triggerRows
  .map((row, index) => (Number(row.maxScreenshots || 0) > 0 ? index : -1))
  .filter((index) => index >= 0);
const firstVisualRowIndex = visualRowIndexes[0] ?? -1;

const confirmedReceiptPath = join(smokeRoot, "teacher-confirmed-policy-receipt.json");
const confirmedReceipt = {
  ...receipt,
  rollbackPointReviewed: true,
  rollbackPointPath: join(smokeRoot, "teacher-retained-rollback-point"),
  rowReceipts: receipt.rowReceipts.map((row, index) => ({
    ...row,
    teacherDecision: "teacher_confirms_policy",
    teacherNote: "Teacher confirms this low-token row as a review-only next step.",
    approvedVisualCheckRequestId: visualRowIndexes.includes(index) ? "meshviewer-ambiguous-1" : ""
  }))
};
mkdirSync(confirmedReceipt.rollbackPointPath, { recursive: true });
writeFileSync(confirmedReceiptPath, `${JSON.stringify(confirmedReceipt, null, 2)}\n`, "utf8");

const validationResult = runNodeScript("validate-event-triggered-low-token-observation-policy-receipt.mjs", [
  "--policy",
  policyResult.policyPath,
  "--receipt",
  confirmedReceiptPath,
  "--output-dir",
  join(smokeRoot, "confirmed-validation")
]);
const validation = readJson(validationResult.validationPath);
const followUpQueue = readJson(validationResult.followUpQueuePath);
const visualCaptureItem = followUpQueue.items.find((row) => row.route === "prepare_teacher_confirmed_single_visual_check_command");

const lowerTokenReceiptPath = join(smokeRoot, "teacher-lower-token-policy-receipt.json");
const lowerTokenReceipt = {
  ...receipt,
  rowReceipts: receipt.rowReceipts.map((row) => ({
    ...row,
    teacherDecision: "teacher_requests_lower_token_cost",
    lowerTokenAlternative: "Use metadata and compact events only; no visual check on this pass."
  }))
};
writeFileSync(lowerTokenReceiptPath, `${JSON.stringify(lowerTokenReceipt, null, 2)}\n`, "utf8");
const lowerTokenResult = runNodeScript("validate-event-triggered-low-token-observation-policy-receipt.mjs", [
  "--policy",
  policyResult.policyPath,
  "--receipt",
  lowerTokenReceiptPath,
  "--output-dir",
  join(smokeRoot, "lower-token-validation")
]);
const lowerTokenValidation = readJson(lowerTokenResult.validationPath);

const forbiddenReceiptPath = join(smokeRoot, "teacher-forbidden-policy-receipt.json");
const forbiddenReceipt = {
  ...receipt,
  rowReceipts: receipt.rowReceipts.map((row, index) => ({
    ...row,
    teacherDecision: index === 0 ? "execute_now" : "needs_teacher_review"
  }))
};
writeFileSync(forbiddenReceiptPath, `${JSON.stringify(forbiddenReceipt, null, 2)}\n`, "utf8");
const forbiddenResult = runNodeScript(
  "validate-event-triggered-low-token-observation-policy-receipt.mjs",
  ["--policy", policyResult.policyPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(smokeRoot, "forbidden-validation")],
  { expectFailure: true }
);

const placeholderVisualReceiptPath = join(smokeRoot, "teacher-placeholder-visual-policy-receipt.json");
const placeholderVisualReceipt = {
  ...receipt,
  rollbackPointReviewed: true,
  rollbackPointPath: confirmedReceipt.rollbackPointPath,
  rowReceipts: receipt.rowReceipts.map((row, index) => ({
    ...row,
    teacherDecision: "teacher_confirms_policy",
    teacherNote: "Teacher clicked confirm, but the visual request id is still a placeholder.",
    approvedVisualCheckRequestId: visualRowIndexes.includes(index)
      ? index === firstVisualRowIndex
        ? "<teacher-reviewed-request-id>"
        : "meshviewer-ambiguous-1"
      : ""
  }))
};
writeFileSync(placeholderVisualReceiptPath, `${JSON.stringify(placeholderVisualReceipt, null, 2)}\n`, "utf8");
const placeholderVisualResult = runNodeScript(
  "validate-event-triggered-low-token-observation-policy-receipt.mjs",
  [
    "--policy",
    policyResult.policyPath,
    "--receipt",
    placeholderVisualReceiptPath,
    "--output-dir",
    join(smokeRoot, "placeholder-visual-validation")
  ],
  { expectFailure: true }
);
const placeholderVisualResultJson = JSON.parse(placeholderVisualResult.stdout);
const placeholderVisualValidation = readJson(placeholderVisualResultJson.validationPath);
const placeholderVisualFollowUpQueue = readJson(placeholderVisualResultJson.followUpQueuePath);

const missingRollbackReceiptPath = join(smokeRoot, "teacher-missing-rollback-policy-receipt.json");
const missingRollbackReceipt = {
  ...confirmedReceipt,
  rollbackPointReviewed: false,
  rollbackPointPath: ""
};
writeFileSync(missingRollbackReceiptPath, `${JSON.stringify(missingRollbackReceipt, null, 2)}\n`, "utf8");
const missingRollbackResult = runNodeScript(
  "validate-event-triggered-low-token-observation-policy-receipt.mjs",
  [
    "--policy",
    policyResult.policyPath,
    "--receipt",
    missingRollbackReceiptPath,
    "--output-dir",
    join(smokeRoot, "missing-rollback-validation")
  ],
  { expectFailure: true }
);
const missingRollbackResultJson = JSON.parse(missingRollbackResult.stdout);
const missingRollbackValidation = readJson(missingRollbackResultJson.validationPath);
const missingRollbackFollowUpQueue = readJson(missingRollbackResultJson.followUpQueuePath);

const checks = [
  {
    name: "Policy receipt validation converts teacher-confirmed rows into review-only follow-up queue",
    pass:
      validation.format === "transparent_ai_event_triggered_low_token_observation_policy_receipt_validation_v1" &&
      validation.validationDecision === "teacher_confirmed_event_trigger_policy_review_only" &&
      validation.confirmedRowCount === policy.triggerRows.length &&
      followUpQueue.format === "transparent_ai_event_triggered_low_token_observation_policy_follow_up_queue_v1" &&
      followUpQueue.items.length === policy.triggerRows.length &&
      followUpQueue.items.every((row) => row.locks.validationDoesNotCaptureScreenshots === true && row.locks.validationDoesNotExecuteSoftware === true),
    evidence: validationResult.validationPath
  },
  {
    name: "Policy receipt validation blocks follow-up queue until rollback point is reviewed",
    pass:
      missingRollbackResult.status !== 0 &&
      missingRollbackValidation.validationDecision === "blocked_rollback_point_not_reviewed" &&
      missingRollbackValidation.rollbackBlockedRowCount === policy.triggerRows.length &&
      missingRollbackValidation.confirmedRowCount === 0 &&
      missingRollbackFollowUpQueue.items.length === 0 &&
      missingRollbackValidation.locks.screenshotsCaptured === false &&
      missingRollbackValidation.locks.captureInvoked === false,
    evidence: missingRollbackResultJson.validationPath
  },
  {
    name: "Policy receipt validation prepares visual capture only as a separate teacher-confirmed command template",
    pass:
      visualCaptureItem?.commandTemplate.includes("capture-triggered-visual-check.mjs") &&
      visualCaptureItem?.commandTemplate.includes("--teacher-confirmed") &&
      visualCaptureItem?.commandTemplate.includes(visualQueuePath) &&
      visualCaptureItem?.commandTemplate.includes("meshviewer-ambiguous-1") &&
      visualCaptureItem?.commandPlaceholders.length === 0 &&
      visualCaptureItem?.readyForCaptureCommand === true &&
      visualCaptureItem?.postCaptureLearningHandoffCommandTemplate.includes("create-triggered-visual-evidence-learning-handoff.mjs") &&
      visualCaptureItem?.postCaptureLearningHandoffStatus === "waiting_for_real_capture_receipt_path" &&
      visualCaptureItem?.postLearningHandoffVoiceControlWorkbenchCommandTemplate.includes(
        "create-triggered-visual-evidence-voice-control-workbench.mjs"
      ) &&
      validation.locks.screenshotsCaptured === false &&
      validation.locks.captureInvoked === false &&
      validation.locks.learningHandoffInvoked === false &&
      validation.locks.voiceWorkbenchInvoked === false,
    evidence: validationResult.followUpQueuePath
  },
  {
    name: "Policy receipt validation keeps voice workbench behind triggered visual handoff and numbered confirmation",
    pass:
      followUpQueue.blockedActions.includes("create_voice_workbench_without_triggered_visual_handoff") &&
      followUpQueue.blockedActions.includes("execute_from_voice_without_numbered_target_confirmation") &&
      followUpQueue.items.some(
        (row) =>
          row.route === "prepare_teacher_confirmed_single_visual_check_command" &&
          row.nextInstruction.includes("voice/text numbered-target workbench") &&
          row.locks.validationDoesNotRunVoiceWorkbench === true &&
          row.locks.validationDoesNotExecuteSoftware === true
      ),
    evidence: validationResult.followUpQueuePath
  },
  {
    name: "Policy receipt validation blocks placeholder visual request ids before capture commands",
    pass:
      placeholderVisualResult.status !== 0 &&
      placeholderVisualValidation.validationDecision === "blocked_visual_check_request_placeholder_or_missing_path" &&
      placeholderVisualValidation.visualRequestBlockedRowCount === 1 &&
      placeholderVisualValidation.validationRows.some(
        (row) =>
          row.status === "blocked_visual_check_request_placeholder_or_missing_path" &&
          row.visualRequestPlaceholderBlockers.includes("approved_visual_check_request_id_contains_placeholder") &&
          row.confirmed === false
      ) &&
      placeholderVisualFollowUpQueue.items.some(
        (row) =>
          row.route === "waiting_for_teacher_visual_check_request_placeholder_replacement" &&
          row.readyForCaptureCommand === false &&
          row.commandTemplate === ""
      ) &&
      placeholderVisualValidation.locks.screenshotsCaptured === false &&
      placeholderVisualValidation.locks.captureInvoked === false,
    evidence: placeholderVisualResultJson.validationPath
  },
  {
    name: "Policy receipt validation routes lower-token teacher feedback without running replans",
    pass:
      lowerTokenValidation.validationDecision === "teacher_requested_lower_token_policy_follow_up" &&
      lowerTokenValidation.followUpQueue.every((row) => row.route === "regenerate_lower_token_budget_plan") &&
      lowerTokenValidation.locks.budgetPlanInvoked === false,
    evidence: lowerTokenResult.validationPath
  },
  {
    name: "Policy receipt validation blocks forbidden execute capture memory packaging decisions",
    pass:
      forbiddenResult.status !== 0 &&
      (forbiddenResult.stdout.includes("blocked_invalid_policy_receipt") || forbiddenResult.stdout.includes("blocked_forbidden_teacher_decision")),
    evidence: forbiddenReceiptPath
  },
  {
    name: "Policy receipt template advertises validation before follow-up",
    pass:
      receipt.nextValidationCommandTemplate.includes("validate-event-triggered-low-token-observation-policy-receipt.mjs") &&
      receipt.nextValidationCommandTemplate.includes("<teacher-filled-event-triggered-low-token-observation-policy-receipt.json>"),
    evidence: policyResult.receiptTemplatePath
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_event_triggered_low_token_observation_policy_receipt_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    policy: policyResult.policyPath,
    confirmedReceipt: confirmedReceiptPath,
    validation: validationResult.validationPath,
    followUpQueue: validationResult.followUpQueuePath,
    placeholderVisualValidation: placeholderVisualResultJson.validationPath
  }
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
