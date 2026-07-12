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

function runScript(script, args, options = {}) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${script} unexpectedly succeeded`);
    const parsed = JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
    return { ...parsed, failedAsExpected: true, exitStatus: result.status };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "original-goal-remaining-gates-receipt-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const gapBoardPath = writeJson(join(smokeRoot, "gap-board", "original-goal-gap-action-board.json"), {
  format: "fixture_gap_board_v1",
  actionRows: []
});
const routerHtmlPath = join(smokeRoot, "router", "original-goal-teacher-action-router.html");
mkdirSync(dirname(routerHtmlPath), { recursive: true });
writeFileSync(routerHtmlPath, "<!doctype html><title>router</title>\n", "utf8");
const lowTokenEvidencePath = writeJson(join(smokeRoot, "low-token", "compact-learning-events.json"), {
  format: "fixture_compact_low_token_evidence_v1"
});

const packetPath = writeJson(join(smokeRoot, "packet", "original-goal-remaining-gates-packet.json"), {
  ok: true,
  format: "transparent_ai_original_goal_remaining_gates_packet_v1",
  packetId: "smoke-remaining-gates-packet",
  status: "waiting_for_teacher_remaining_gate_review",
  sourceEvidence: {
    statusRefresh: join(smokeRoot, "refresh.json"),
    gapActionBoard: gapBoardPath,
    teacherActionRouter: join(smokeRoot, "router", "original-goal-teacher-action-router.json"),
    lowTokenBudgetPlan: join(smokeRoot, "low-token", "low-token-trigger-budget-plan.json")
  },
  completionBoundary: {
    completionDecision: "not_complete_full_objective_because_universal_native_control_and_unattended_all_app_coverage_are_not_proven"
  },
  counts: {
    statusLanes: 2,
    blockedOrWaitingLanes: 2,
    gapRows: 2,
    gateGroups: 1,
    teacherRouteRows: 2,
    lowTokenSelectedActions: 1,
    lowTokenEstimatedCost: 5
  },
  gateGroups: [
    {
      lane: "coverage_convergence",
      rowCount: 2,
      firstStatus: "waiting_for_teacher_review",
      firstNextAction: "Open the gap board and choose one coverage follow-up lane."
    }
  ],
  shortestTeacherRoute: [
    {
      order: 1,
      id: "route-activation",
      lane: "automatic_learning_activation",
      reviewEntryId: "activation_receipt_builder",
      openPath: routerHtmlPath,
      validationCommand:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-operational-activation-review-receipt.mjs --receipt <teacher-filled-activation-receipt.json>",
      teacherInstruction: "Validate the activation receipt after teacher review."
    },
    {
      order: 2,
      id: "route-unsafe",
      lane: "all_software_execution_capability",
      reviewEntryId: "unsafe_execution_runner",
      openPath: routerHtmlPath,
      validationCommand: "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-execution-pilot-runner.mjs --execute",
      teacherInstruction: "Unsafe fixture that must remain blocked."
    }
  ],
  nextLowTokenActions: [
    {
      id: "compact-review-1",
      route: "compact_learning_review",
      status: "ready_for_compact_review",
      estimatedTokenCost: 5,
      screenshotCostClass: "no_screenshot",
      software: "ExampleCAD",
      evidencePath: lowTokenEvidencePath,
      nextInstruction: "Review compact evidence before any visual capture."
    }
  ],
  blockedActions: ["claim_original_goal_complete_from_remaining_gates_packet"],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  }
});

const builderResult = runScript("create-original-goal-remaining-gates-receipt-builder.mjs", [
  "--goal",
  "smoke build remaining gates receipt",
  "--packet",
  packetPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const template = readJson(builderResult.receiptTemplatePath);
const builderHtml = readFileSync(builderResult.htmlPath, "utf8");

const goodReceiptPath = writeJson(join(smokeRoot, "receipts", "good-receipt.json"), {
  ...template,
  rowDecisions: [
    {
      id: "teacher_route_001",
      sourceKind: "teacher_route",
      teacherDecision: "ready_for_next_review_queue",
      evidenceReviewed: true,
      observedEvidencePath: routerHtmlPath,
      teacherNote: "activation route reviewed"
    },
    {
      id: "low_token_action_compact-review-1",
      sourceKind: "low_token_action",
      teacherDecision: "ready_for_next_review_queue",
      evidenceReviewed: true,
      observedEvidencePath: lowTokenEvidencePath,
      teacherNote: "compact evidence reviewed"
    }
  ]
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "receipts", "forbidden-receipt.json"), {
  ...template,
  rowDecisions: [
    {
      id: "gate_group_coverage-convergence",
      sourceKind: "gate_group",
      teacherDecision: "claim_complete",
      evidenceReviewed: true,
      observedEvidencePath: gapBoardPath
    }
  ]
});
const unsafeReceiptPath = writeJson(join(smokeRoot, "receipts", "unsafe-receipt.json"), {
  ...template,
  rowDecisions: [
    {
      id: "teacher_route_002",
      sourceKind: "teacher_route",
      teacherDecision: "ready_for_next_review_queue",
      evidenceReviewed: true,
      observedEvidencePath: routerHtmlPath,
      teacherNote: "unsafe route reviewed"
    }
  ]
});
const missingEvidenceReceiptPath = writeJson(join(smokeRoot, "receipts", "missing-evidence-receipt.json"), {
  ...template,
  rowDecisions: [
    {
      id: "low_token_action_compact-review-1",
      sourceKind: "low_token_action",
      teacherDecision: "ready_for_next_review_queue",
      evidenceReviewed: false,
      observedEvidencePath: "",
      teacherNote: ""
    }
  ]
});

const goodResult = runScript("validate-original-goal-remaining-gates-receipt.mjs", [
  "--goal",
  "smoke validate remaining gates receipt",
  "--packet",
  packetPath,
  "--receipt",
  goodReceiptPath,
  "--output-dir",
  join(smokeRoot, "good-validation")
]);
const goodValidation = readJson(goodResult.validationPath);
const goodReadme = readFileSync(goodResult.readmePath, "utf8");

const forbiddenResult = runScript("validate-original-goal-remaining-gates-receipt.mjs", [
  "--packet",
  packetPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
], { expectFailure: true });
const forbiddenValidation = readJson(forbiddenResult.validationPath);

const unsafeResult = runScript("validate-original-goal-remaining-gates-receipt.mjs", [
  "--packet",
  packetPath,
  "--receipt",
  unsafeReceiptPath,
  "--output-dir",
  join(smokeRoot, "unsafe-validation")
], { expectFailure: true });
const unsafeValidation = readJson(unsafeResult.validationPath);

const missingEvidenceResult = runScript("validate-original-goal-remaining-gates-receipt.mjs", [
  "--packet",
  packetPath,
  "--receipt",
  missingEvidenceReceiptPath,
  "--output-dir",
  join(smokeRoot, "missing-evidence-validation")
]);
const missingEvidenceValidation = readJson(missingEvidenceResult.validationPath);

const checks = [
  check(
    "Remaining gates receipt builder creates review-only template across gate route and low-token rows",
    builder.format === "transparent_ai_original_goal_remaining_gates_receipt_builder_v1" &&
      builder.status === "waiting_for_teacher_remaining_gates_receipt" &&
      builder.counts.gateGroupRows === 1 &&
      builder.counts.teacherRouteRows === 2 &&
      builder.counts.lowTokenActionRows === 1 &&
      template.format === "transparent_ai_original_goal_remaining_gates_receipt_v1" &&
      template.rowDecisions.every((row) => row.teacherDecision === "needs_teacher_review") &&
      existsSync(builderResult.htmlPath) &&
      builderHtml.includes("Original Goal Remaining Gates Receipt Builder") &&
      builderHtml.includes("Generate reviewed receipt JSON") &&
      builderHtml.includes("Download receipt JSON") &&
      builderHtml.includes("Copy validation command") &&
      builderHtml.includes("original_goal_remaining_gates_browser_receipt_builder") &&
      builder.browserReceiptBuilder?.generatesReceiptJsonInBrowser === true &&
      builder.browserReceiptBuilder?.downloadsReceiptJsonOnly === true &&
      builder.browserReceiptBuilder?.doesNotWriteReceiptToDisk === true &&
      builder.receiptTemplate?.format === "transparent_ai_original_goal_remaining_gates_receipt_v1" &&
      builder.locks.builderDoesNotWriteReceipt === true &&
      builder.locks.builderDoesNotRunCommands === true &&
      builder.locks.goalComplete === false,
    builderResult.builderPath
  ),
  check(
    "Remaining gates receipt validation emits next review queue only after teacher evidence",
    goodValidation.format === "transparent_ai_original_goal_remaining_gates_receipt_validation_v1" &&
      goodValidation.validationDecision === "all_rows_ready_for_next_review_queue" &&
      goodValidation.counts.readyRows === 2 &&
      goodValidation.nextReviewQueue.length === 2 &&
      goodValidation.nextReviewQueue.every((item) => item.executesNow === false && item.commandExecutableNow === false) &&
      goodValidation.nextReviewQueue.every(
        (item) => item.order > 0 && item.number > 0 && item.handoffKind && item.status && Array.isArray(item.missingInputs)
      ) &&
      goodValidation.nextReviewQueue.some(
        (item) =>
          item.handoffKind === "downstream_receipt_validation" &&
          item.status === "waiting_for_teacher_downstream_receipt_or_placeholder_replacement"
      ) &&
      goodValidation.nextReviewQueue.some(
        (item) => item.handoffKind === "open_review_entry" && item.status === "ready_for_manual_review_handoff"
      ) &&
      goodValidation.nextReviewQueue.some((item) => item.command.includes("validate-all-software-operational-activation-review-receipt.mjs")) &&
      goodValidation.nextReviewQueue.some((item) => item.openPath === lowTokenEvidencePath),
    goodResult.validationPath
  ),
  check(
    "Remaining gates receipt validation fails closed on forbidden completion decisions",
    forbiddenValidation.validationDecision === "blocked_for_forbidden_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenResult.failedAsExpected === true &&
      forbiddenResult.exitStatus !== 0 &&
      forbiddenValidation.locks.goalComplete === false,
    forbiddenResult.validationPath
  ),
  check(
    "Remaining gates receipt validation fails closed on unsafe execute queue items",
    unsafeValidation.validationDecision === "blocked_for_unsafe_next_review_queue_item" &&
      unsafeValidation.unsafeQueueItemUsed === true &&
      unsafeResult.failedAsExpected === true &&
      unsafeResult.exitStatus !== 0 &&
      unsafeValidation.nextReviewQueue.length === 0 &&
      unsafeValidation.validationRows.some((row) => row.queueSafety?.matchedForbiddenMarkers?.includes("--execute")),
    unsafeResult.validationPath
  ),
  check(
    "Remaining gates receipt validation keeps missing teacher evidence in review",
    missingEvidenceValidation.validationDecision === "needs_teacher_review" &&
      missingEvidenceValidation.counts.readyRows === 0 &&
      missingEvidenceValidation.nextReviewQueue.length === 0,
    missingEvidenceResult.validationPath
  ),
  check(
    "Remaining gates receipt validation keeps system-change locks closed",
    goodValidation.locks.validationDoesNotExecuteCommands === true &&
      goodValidation.locks.validationDoesNotExecuteTargetSoftware === true &&
      goodValidation.locks.validationDoesNotCaptureScreenshots === true &&
      goodValidation.locks.validationDoesNotWriteMemory === true &&
      goodValidation.locks.nativeUniversalExecution === false &&
      goodReadme.includes("does not execute generated commands"),
    goodResult.readmePath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_original_goal_remaining_gates_receipt_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    builder: builderResult.builderPath,
    template: builderResult.receiptTemplatePath,
    goodValidation: goodResult.validationPath
  }
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
