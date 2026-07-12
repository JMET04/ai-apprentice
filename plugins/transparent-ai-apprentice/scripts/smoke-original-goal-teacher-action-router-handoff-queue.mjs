#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
    timeout: 60000
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
    : join(process.cwd(), ".transparent-apprentice", "original-goal-teacher-action-router-handoff-queue-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const compactReviewPath = join(smokeRoot, "compact-learning-review.json");
const actionLogicPackagePath = join(smokeRoot, "action-logic-source-contract-package", "all-software-action-logic-source-contract-package.json");
const actionLogicReceiptTemplatePath = join(
  smokeRoot,
  "action-logic-source-contract-package",
  "teacher-action-logic-source-contract-receipt-template.json"
);
const actionLogicHtmlPath = join(
  smokeRoot,
  "action-logic-source-contract-package",
  "all-software-action-logic-source-contract-package.html"
);
writeJson(compactReviewPath, { format: "fixture_compact_learning_review_v1" });
mkdirSync(dirname(actionLogicHtmlPath), { recursive: true });
writeFileSync(actionLogicHtmlPath, "<!doctype html><html><title>Action Logic Source Contract</title></html>\n", "utf8");
writeJson(actionLogicReceiptTemplatePath, {
  format: "transparent_ai_all_software_action_logic_source_contract_receipt_v1",
  rowDecisions: []
});
writeJson(actionLogicPackagePath, {
  format: "transparent_ai_all_software_action_logic_source_contract_package_v1",
  paths: {
    html: actionLogicHtmlPath,
    receiptTemplate: actionLogicReceiptTemplatePath
  }
});

const validationPath = writeJson(join(smokeRoot, "validation", "router-receipt-validation.json"), {
  format: "transparent_ai_original_goal_teacher_action_router_receipt_validation_v1",
  validationId: "smoke-router-receipt-validation",
  validationDecision: "some_rows_ready_for_downstream_validation",
  status: "validated_with_review_handoffs",
  sourceEvidence: {
    router: "fixture-router.json",
    receipt: "fixture-receipt.json"
  },
  nextReviewHandoffs: [
    {
      id: "router_handoff_activation",
      label: "Validate downstream activation receipt",
      command:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-operational-activation-review-receipt.mjs --receipt <teacher-filled-operational-activation-review-receipt.json>",
      openPath: "",
      sourceRouteRowId: "teacher-action-1",
      reviewEntryId: "activation_receipt_builder",
      lane: "automatic_learning_activation",
      executesNow: false
    },
    {
      id: "router_handoff_compact",
      label: "Open compact learning review",
      command: compactReviewPath,
      openPath: compactReviewPath,
      sourceRouteRowId: "teacher-action-2",
      reviewEntryId: "compact_learning_review_only",
      lane: "low_token_budget_review",
      executesNow: false
    },
    {
      id: "router_handoff_action_logic_source_contract",
      label: "Validate downstream action logic source contract receipt",
      command:
        `node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-action-logic-source-contract-receipt.mjs --package "${actionLogicPackagePath}" --receipt <teacher-filled-action-logic-source-contract-receipt.json>`,
      openPath: "",
      sourceRouteRowId: "teacher-action-4",
      reviewEntryId: "action_logic_source_contract_package",
      lane: "all_software_execution_capability",
      executesNow: false
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  }
});

const unsafeValidationPath = writeJson(join(smokeRoot, "validation", "unsafe-router-receipt-validation.json"), {
  format: "transparent_ai_original_goal_teacher_action_router_receipt_validation_v1",
  validationId: "smoke-router-receipt-validation-unsafe",
  validationDecision: "some_rows_ready_for_downstream_validation",
  status: "validated_with_review_handoffs",
  nextReviewHandoffs: [
    {
      id: "router_handoff_unsafe",
      label: "Unsafe execute handoff",
      command: "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-execution-pilot-runner.mjs --teacher-reviewed --execute",
      openPath: compactReviewPath,
      sourceRouteRowId: "teacher-action-unsafe",
      reviewEntryId: "unsafe_execution_runner",
      lane: "all_software_execution_capability",
      executesNow: false
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  }
});

const emptyValidationPath = writeJson(join(smokeRoot, "validation", "empty-router-receipt-validation.json"), {
  format: "transparent_ai_original_goal_teacher_action_router_receipt_validation_v1",
  validationId: "smoke-router-receipt-validation-empty",
  validationDecision: "needs_teacher_review",
  status: "waiting_for_teacher_router_review",
  nextReviewHandoffs: [],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  }
});

const queueResult = runScript("create-original-goal-teacher-action-router-handoff-queue.mjs", [
  "--goal",
  "smoke router handoff queue",
  "--validation",
  validationPath,
  "--output-dir",
  join(smokeRoot, "queue")
]);
const queue = readJson(queueResult.queuePath);
const html = readFileSync(queueResult.htmlPath, "utf8");
const readme = readFileSync(queueResult.readmePath, "utf8");

const unsafeResult = runScript("create-original-goal-teacher-action-router-handoff-queue.mjs", [
  "--validation",
  unsafeValidationPath,
  "--output-dir",
  join(smokeRoot, "unsafe-queue")
]);
const unsafeQueue = readJson(unsafeResult.queuePath);

const emptyResult = runScript("create-original-goal-teacher-action-router-handoff-queue.mjs", [
  "--validation",
  emptyValidationPath,
  "--output-dir",
  join(smokeRoot, "empty-queue")
]);
const emptyQueue = readJson(emptyResult.queuePath);

const checks = [
  check(
    "Teacher action router handoff queue classifies validated review handoffs",
    queue.format === "transparent_ai_original_goal_teacher_action_router_handoff_queue_v1" &&
      queue.status === "waiting_for_teacher_downstream_receipts" &&
      queue.counts.queueItems === 3 &&
      queue.queueItems.some(
        (item) =>
          item.handoffKind === "downstream_receipt_validation" &&
          item.missingInputs.includes("<teacher-filled-operational-activation-review-receipt.json>") &&
          item.commandExecutableNow === false
      ) &&
      queue.queueItems.some(
        (item) =>
          item.reviewEntryId === "action_logic_source_contract_package" &&
          item.handoffKind === "downstream_receipt_validation" &&
          item.command.includes("validate-all-software-action-logic-source-contract-receipt.mjs") &&
          item.command.includes(actionLogicPackagePath) &&
          item.missingInputs.includes("<teacher-filled-action-logic-source-contract-receipt.json>") &&
          item.downstreamReviewStartPath === actionLogicHtmlPath &&
          item.downstreamReviewStartExists === true &&
          item.downstreamReceiptTemplatePath === actionLogicReceiptTemplatePath &&
          item.downstreamReceiptTemplateExists === true &&
          item.teacherAction.includes("Open the downstream review start page") &&
          item.status === "waiting_for_teacher_downstream_receipt_or_placeholder_replacement" &&
          item.commandExecutableNow === false
      ) &&
      queue.queueItems.some(
        (item) =>
          item.handoffKind === "open_review_entry" &&
          item.openPath === compactReviewPath &&
          item.openPathExists === true &&
          item.status === "ready_for_manual_review_handoff"
      ),
    queueResult.queuePath
  ),
  check(
    "Teacher action router handoff queue writes visible start files",
      existsSync(queueResult.htmlPath) &&
      existsSync(queueResult.readmePath) &&
      html.includes("Original Goal Teacher Action Router Handoff Queue") &&
      html.includes("all-software-action-logic-source-contract-package.html") &&
      html.includes("teacher-action-logic-source-contract-receipt-template.json") &&
      readme.includes("does not execute commands"),
    queueResult.htmlPath
  ),
  check(
    "Teacher action router handoff queue blocks unsafe execute handoffs",
    unsafeQueue.status === "blocked" &&
      unsafeQueue.queueDecision === "blocked_until_unsafe_handoffs_are_removed" &&
      unsafeQueue.counts.blockedCount === 1 &&
      unsafeQueue.queueItems[0].safety.matchedForbiddenMarkers.includes("--execute") &&
      unsafeQueue.locks.goalComplete === false,
    unsafeResult.queuePath
  ),
  check(
    "Teacher action router handoff queue waits when receipt validation has no ready handoffs",
    emptyQueue.status === "waiting_for_validated_router_receipt" &&
      emptyQueue.queueDecision === "waiting_for_validated_router_receipt_handoffs" &&
      emptyQueue.counts.queueItems === 0,
    emptyResult.queuePath
  ),
  check(
    "Teacher action router handoff queue keeps all system-change locks closed",
    queue.locks.queueDoesNotExecuteCommands === true &&
      queue.locks.queueDoesNotValidateDownstreamReceipts === true &&
      queue.locks.queueDoesNotExecuteTargetSoftware === true &&
      queue.locks.queueDoesNotCaptureScreenshots === true &&
      queue.locks.queueDoesNotWriteMemory === true &&
      queue.locks.nativeUniversalExecution === false,
    JSON.stringify(queue.locks)
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_original_goal_teacher_action_router_handoff_queue_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    queue: queueResult.queuePath,
    unsafeQueue: unsafeResult.queuePath,
    emptyQueue: emptyResult.queuePath
  }
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
