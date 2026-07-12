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
    : join(process.cwd(), ".transparent-apprentice", "original-goal-teacher-action-router-receipt-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const activationHtml = join(smokeRoot, "activation-receipt-builder.html");
const spatialHtml = join(smokeRoot, "spatial-intent-request.html");
const compactJson = join(smokeRoot, "compact-learning-events.json");
const actionLogicPackagePath = join(smokeRoot, "action-logic-source-contract-package", "all-software-action-logic-source-contract-package.json");
const actionLogicHtml = join(smokeRoot, "action-logic-source-contract-package", "all-software-action-logic-source-contract-package.html");
writeFileSync(activationHtml, "<!doctype html><html><title>activation</title></html>\n", "utf8");
writeFileSync(spatialHtml, "<!doctype html><html><title>spatial</title></html>\n", "utf8");
writeJson(compactJson, { format: "fixture_compact_learning_events_v1" });
writeJson(actionLogicPackagePath, { format: "transparent_ai_all_software_action_logic_source_contract_package_v1" });
mkdirSync(dirname(actionLogicHtml), { recursive: true });
writeFileSync(actionLogicHtml, "<!doctype html><html><title>action logic source contract</title></html>\n", "utf8");

const routerFixturePath = join(smokeRoot, "router", "original-goal-teacher-action-router.json");
const routerPath = writeJson(routerFixturePath, {
  format: "transparent_ai_original_goal_teacher_action_router_v1",
  routerId: "smoke-router",
  status: "waiting_for_teacher_action_route_review",
  routeRows: [
    {
      order: 1,
      id: "teacher-action-1",
      lane: "automatic_learning_activation",
      reviewEntryId: "activation_receipt_builder",
      openPath: activationHtml,
      validationCommand:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-operational-activation-review-receipt.mjs --receipt <teacher-filled.json>",
      teacherInstruction: "Open activation builder and validate receipt."
    },
    {
      order: 2,
      id: "teacher-action-2",
      lane: "transparent_spatial_intent",
      reviewEntryId: "spatial_intent_evidence_request",
      openPath: spatialHtml,
      validationCommand:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-spatial-intent-evidence-receipt.mjs --receipt <teacher-filled.json>",
      teacherInstruction: "Open spatial request and validate exported sketch evidence."
    },
    {
      order: 3,
      id: "teacher-action-3",
      lane: "low_token_budget_review",
      reviewEntryId: "compact_learning_review_only",
      openPath: compactJson,
      validationCommand: "",
      teacherInstruction: "Review compact learning evidence first."
    },
    {
      order: 4,
      id: "teacher-action-4",
      lane: "all_software_execution_capability",
      reviewEntryId: "action_logic_source_contract_package",
      openPath: actionLogicHtml,
      validationCommand:
        `node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-action-logic-source-contract-receipt.mjs --package "${actionLogicPackagePath}" --receipt <teacher-filled-action-logic-source-contract-receipt.json>`,
      teacherInstruction: "Open action logic contract package and validate teacher-filled receipt."
    },
    {
      order: 5,
      id: "teacher-action-5",
      lane: "all_software_execution_capability",
      reviewEntryId: "unsafe_execution_runner",
      openPath: activationHtml,
      validationCommand:
        "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-execution-pilot-runner.mjs --teacher-reviewed --execute",
      teacherInstruction: "Unsafe fixture that must remain blocked."
    }
  ],
  blockedActions: ["validate_receipt_from_router"],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  },
  paths: {
    router: routerFixturePath
  }
});

const builderResult = runScript("create-original-goal-teacher-action-router-receipt-builder.mjs", [
  "--goal",
  "smoke build router receipt",
  "--router",
  routerPath,
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
      id: "teacher-action-1",
      teacherDecision: "ready_for_downstream_validation",
      evidenceReviewed: true,
      observedEvidencePath: activationHtml,
      teacherNote: "activation evidence reviewed"
    },
    {
      id: "teacher-action-4",
      teacherDecision: "ready_for_downstream_validation",
      evidenceReviewed: true,
      observedEvidencePath: actionLogicHtml,
      teacherNote: "action logic source contract reviewed"
    },
    {
      id: "teacher-action-3",
      teacherDecision: "ready_for_downstream_validation",
      evidenceReviewed: true,
      observedEvidencePath: compactJson,
      teacherNote: "compact evidence reviewed"
    }
  ]
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "receipts", "forbidden-receipt.json"), {
  ...template,
  rowDecisions: [
    {
      id: "teacher-action-1",
      teacherDecision: "claim_complete",
      evidenceReviewed: true,
      observedEvidencePath: activationHtml
    }
  ]
});
const unsafeReceiptPath = writeJson(join(smokeRoot, "receipts", "unsafe-receipt.json"), {
  ...template,
  rowDecisions: [
    {
      id: "teacher-action-5",
      teacherDecision: "ready_for_downstream_validation",
      evidenceReviewed: true,
      observedEvidencePath: activationHtml
    }
  ]
});
const missingEvidenceReceiptPath = writeJson(join(smokeRoot, "receipts", "missing-evidence-receipt.json"), {
  ...template,
  rowDecisions: [
    {
      id: "teacher-action-2",
      teacherDecision: "ready_for_downstream_validation",
      evidenceReviewed: false,
      observedEvidencePath: ""
    }
  ]
});

const goodResult = runScript("validate-original-goal-teacher-action-router-receipt.mjs", [
  "--goal",
  "smoke validate router receipt",
  "--router",
  routerPath,
  "--receipt",
  goodReceiptPath,
  "--output-dir",
  join(smokeRoot, "good-validation")
]);
const goodValidation = readJson(goodResult.validationPath);
const goodReadme = readFileSync(goodResult.readmePath, "utf8");

const forbiddenResult = runScript("validate-original-goal-teacher-action-router-receipt.mjs", [
  "--router",
  routerPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
], { expectFailure: true });
const forbiddenValidation = readJson(forbiddenResult.validationPath);

const unsafeResult = runScript("validate-original-goal-teacher-action-router-receipt.mjs", [
  "--router",
  routerPath,
  "--receipt",
  unsafeReceiptPath,
  "--output-dir",
  join(smokeRoot, "unsafe-validation")
], { expectFailure: true });
const unsafeValidation = readJson(unsafeResult.validationPath);

const missingEvidenceResult = runScript("validate-original-goal-teacher-action-router-receipt.mjs", [
  "--router",
  routerPath,
  "--receipt",
  missingEvidenceReceiptPath,
  "--output-dir",
  join(smokeRoot, "missing-evidence-validation")
]);
const missingEvidenceValidation = readJson(missingEvidenceResult.validationPath);

const checks = [
  check(
    "Teacher action router receipt builder creates review-only receipt template",
    builder.format === "transparent_ai_original_goal_teacher_action_router_receipt_builder_v1" &&
      builder.reviewRows.length === 5 &&
      template.format === "transparent_ai_original_goal_teacher_action_router_receipt_v1" &&
      template.rowDecisions.every((row) => row.teacherDecision === "needs_teacher_review") &&
      builder.reviewRows.some(
        (row) =>
          row.reviewEntryId === "action_logic_source_contract_package" &&
          row.routeKind === "action_logic_source_contract_validation" &&
          row.validationCommand.includes(actionLogicPackagePath)
      ) &&
      template.rowDecisions.some(
        (row) =>
          row.reviewEntryId === "action_logic_source_contract_package" &&
          row.routeKind === "action_logic_source_contract_validation"
      ) &&
      existsSync(builderResult.htmlPath) &&
      builderHtml.includes("Original Goal Teacher Action Router Receipt Builder") &&
      builder.locks.builderDoesNotRunCommands === true &&
      builder.locks.goalComplete === false,
    builderResult.builderPath
  ),
  check(
    "Teacher action router receipt validation creates downstream handoffs only after review",
    goodValidation.format === "transparent_ai_original_goal_teacher_action_router_receipt_validation_v1" &&
      goodValidation.validationDecision === "all_rows_ready_for_downstream_validation" &&
      goodValidation.counts.readyRows === 3 &&
      goodValidation.nextReviewHandoffs.length === 3 &&
      goodValidation.nextReviewHandoffs.every((handoff) => handoff.executesNow === false) &&
      goodValidation.nextReviewHandoffs.some((handoff) => handoff.command.includes("validate-all-software-operational-activation-review-receipt.mjs")) &&
      goodValidation.nextReviewHandoffs.some(
        (handoff) =>
          handoff.reviewEntryId === "action_logic_source_contract_package" &&
          handoff.command.includes("validate-all-software-action-logic-source-contract-receipt.mjs") &&
          handoff.command.includes(actionLogicPackagePath) &&
          handoff.command.includes("<teacher-filled-action-logic-source-contract-receipt.json>")
      ) &&
      goodValidation.nextReviewHandoffs.some((handoff) => handoff.command === compactJson),
    goodResult.validationPath
  ),
  check(
    "Teacher action router receipt validation fails closed on forbidden completion decisions",
    forbiddenValidation.validationDecision === "blocked_for_forbidden_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenResult.failedAsExpected === true &&
      forbiddenResult.exitStatus !== 0 &&
      forbiddenValidation.locks.goalComplete === false,
    forbiddenResult.validationPath
  ),
  check(
    "Teacher action router receipt validation fails closed on unsafe execute handoffs",
    unsafeValidation.validationDecision === "blocked_for_unsafe_downstream_command" &&
      unsafeValidation.unsafeHandoffUsed === true &&
      unsafeResult.failedAsExpected === true &&
      unsafeResult.exitStatus !== 0 &&
      unsafeValidation.nextReviewHandoffs.length === 0 &&
      unsafeValidation.validationRows.some((row) => row.handoffSafety?.matchedForbiddenMarkers?.includes("--execute")),
    unsafeResult.validationPath
  ),
  check(
    "Teacher action router receipt validation keeps missing evidence in review",
    missingEvidenceValidation.validationDecision === "needs_teacher_review" &&
      missingEvidenceValidation.counts.readyRows === 0 &&
      missingEvidenceValidation.nextReviewHandoffs.length === 0,
    missingEvidenceResult.validationPath
  ),
  check(
    "Teacher action router receipt validation keeps system-change locks closed",
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
  smoke: "transparent_ai_original_goal_teacher_action_router_receipt_smoke_v1",
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
