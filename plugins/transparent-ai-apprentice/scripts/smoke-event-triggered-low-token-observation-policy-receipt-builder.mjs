#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "event-triggered-low-token-observation-policy-receipt-builder-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
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
const builderResult = runNodeScript("create-event-triggered-low-token-observation-policy-receipt-builder.mjs", [
  "--policy",
  policyResult.policyPath,
  "--goal",
  "Build teacher-facing browser receipt page for event-triggered low-token policy.",
  "--output-dir",
  join(smokeRoot, "builder")
]);

const builder = readJson(builderResult.builderPath);
const receiptTemplate = readJson(builderResult.receiptTemplatePath);
const policy = readJson(policyResult.policyPath);
const visualRowIds = new Set(
  policy.triggerRows.filter((row) => Number(row.maxScreenshots || 0) > 0).map((row) => row.rowId)
);
const html = readFileSync(builderResult.htmlPath, "utf8");
const teacherReceiptPath = join(smokeRoot, "teacher-filled-receipt-from-builder.json");
const teacherReceipt = {
  ...receiptTemplate,
  rollbackPointReviewed: true,
  rollbackPointPath: join(smokeRoot, "teacher-retained-rollback-point"),
  rowReceipts: receiptTemplate.rowReceipts.map((row) => ({
    ...row,
    teacherDecision: "teacher_confirms_policy",
    teacherNote: "Smoke teacher confirms this review-only policy row.",
    approvedVisualCheckRequestId: visualRowIds.has(row.rowId) ? "meshviewer-ambiguous-1" : ""
  }))
};
mkdirSync(teacherReceipt.rollbackPointPath, { recursive: true });
writeFileSync(teacherReceiptPath, `${JSON.stringify(teacherReceipt, null, 2)}\n`, "utf8");
const validationResult = runNodeScript("validate-event-triggered-low-token-observation-policy-receipt.mjs", [
  "--policy",
  policyResult.policyPath,
  "--receipt",
  teacherReceiptPath,
  "--output-dir",
  join(smokeRoot, "validation")
]);
const validation = readJson(validationResult.validationPath);

const checks = [
  {
    name: "Receipt builder writes browser page packet and default template",
    pass:
      builder.format === "transparent_ai_event_triggered_low_token_observation_policy_receipt_builder_v1" &&
      existsSync(builderResult.htmlPath) &&
      existsSync(builderResult.readmePath) &&
      receiptTemplate.format === "transparent_ai_event_triggered_low_token_observation_policy_receipt_v1" &&
      receiptTemplate.defaultDecision === "needs_teacher_review",
    evidence: builderResult.htmlPath
  },
  {
    name: "Receipt builder generates browser-only JSON and validation command without running follow-up",
    pass:
      html.includes("Download Receipt JSON") &&
      html.includes("Generate Receipt JSON") &&
      builder.nextValidationCommand.includes("validate-event-triggered-low-token-observation-policy-receipt.mjs") &&
      builder.nextValidationCommand.includes("<teacher-filled-event-triggered-low-token-observation-policy-receipt.json>") &&
      builder.locks.builderDoesNotWriteTeacherFilledReceipt === true &&
      builder.locks.builderDoesNotValidateReceipt === true,
    evidence: builderResult.builderPath
  },
  {
    name: "Receipt builder locks screenshots logs execution memory rules and packaging",
    pass:
      builder.locks.builderDoesNotCaptureScreenshots === true &&
      builder.locks.builderDoesNotReadFullLogs === true &&
      builder.locks.builderDoesNotExecuteSoftware === true &&
      builder.locks.builderDoesNotWriteMemory === true &&
      builder.locks.nativeUniversalExecution === false &&
      builder.locks.goalComplete === false,
    evidence: builderResult.builderPath
  },
  {
    name: "Receipt builder template validates through the existing policy receipt validator",
    pass:
      validation.validationDecision === "teacher_confirmed_event_trigger_policy_review_only" &&
      validation.followUpQueue.length === receiptTemplate.rowReceipts.length &&
      validation.locks.screenshotsCaptured === false &&
      validation.locks.softwareActionsExecuted === false,
    evidence: validationResult.validationPath
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_event_triggered_low_token_observation_policy_receipt_builder_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    policy: policyResult.policyPath,
    builder: builderResult.builderPath,
    html: builderResult.htmlPath,
    receiptTemplate: builderResult.receiptTemplatePath,
    validation: validationResult.validationPath
  }
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
