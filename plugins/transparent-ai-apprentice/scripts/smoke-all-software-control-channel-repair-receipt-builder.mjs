#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-control-channel-repair-receipt-builder-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${scriptName} was expected to fail`);
    return { ...JSON.parse(result.stdout), failedAsExpected: true, exitStatus: result.status };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return { ...JSON.parse(result.stdout), exitStatus: result.status };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const queuePath = join(smokeRoot, "fixture-control-channel-repair-queue.json");
writeFileSync(
  queuePath,
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_control_channel_repair_queue_v1",
      auditPath: "D:\\example\\control-audit.json",
      createdAt: new Date().toISOString(),
      items: [
        {
          itemId: "control-repair-001",
          software: "ExampleCAD",
          status: "structured_control_route_reviewable",
          missingBeforeExecute: ["review exact command and dry-run receipt before execution"],
          nextCall: "create_software_control_channel_profile",
          blockedTransitions: ["execute_now", "enable_rule", "accept_native_control", "unlock_packaging"]
        },
        {
          itemId: "control-repair-002",
          software: "NeedsProbe",
          status: "observation_only_needs_control_evidence",
          missingBeforeExecute: ["teacher supplies API/CLI/file/browser evidence or confirms UI fallback"],
          nextCall: "create_software_control_channel_probe",
          blockedTransitions: ["execute_now", "enable_rule", "accept_native_control", "unlock_packaging"]
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  ),
  "utf8"
);

const builderResult = runNodeScript("create-all-software-control-channel-repair-receipt-builder.mjs", [
  "--goal",
  "Create a teacher receipt builder for control-channel repair rows.",
  "--repair-queue",
  queuePath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const html = readFileSync(builderResult.htmlPath, "utf8");
const builderReceiptTemplate = readJson(builderResult.receiptTemplatePath);

const followUpBatchPath = join(smokeRoot, "fixture-execution-follow-up-batch-with-probe-packages.json");
writeFileSync(
  followUpBatchPath,
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1",
      status: "created_probe_packages_waiting_for_teacher_review",
      rowResults: [
        {
          rowId: "control-row-101",
          software: "ProbeFromFollowUp",
          lane: "collect_control_channel_evidence",
          status: "control_channel_probe_package_created_waiting_for_teacher_review",
          evidencePath: "D:\\example\\probe\\software-control-channel-probe-plan.json",
          probeResult: {
            teacherReadme: "D:\\example\\probe\\SOFTWARE_CONTROL_CHANNEL_PROBE_START_HERE.md",
            probePlan: "D:\\example\\probe\\software-control-channel-probe-plan.json",
            resultTemplate: "D:\\example\\probe\\software-control-channel-probe-result-template.json",
            nextProfileRequest: "D:\\example\\probe\\next-control-channel-profile-request.json"
          }
        },
        {
          rowId: "control-row-102",
          software: "BlockedPilotReceipt",
          lane: "review_and_run_one_dry_run_pilot",
          status: "blocked_before_adapter_runner",
          evidencePath: "D:\\example\\pilot\\all-software-execution-pilot-runner-receipt.json"
        }
      ],
      locks: {
        reviewOnly: true,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false
      }
    },
    null,
    2
  ),
  "utf8"
);
const followUpBuilderResult = runNodeScript("create-all-software-control-channel-repair-receipt-builder.mjs", [
  "--goal",
  "Create a teacher receipt builder from execution follow-up probe package evidence.",
  "--follow-up-batch",
  followUpBatchPath,
  "--output-dir",
  join(smokeRoot, "follow-up-builder")
]);
const followUpBuilder = readJson(followUpBuilderResult.builderPath);
const derivedQueue = readJson(followUpBuilder.paths.derivedRepairQueue);
const followUpReceiptTemplate = readJson(followUpBuilderResult.receiptTemplatePath);
const followUpHtml = readFileSync(followUpBuilderResult.htmlPath, "utf8");

const followUpReviewedReceiptPath = join(smokeRoot, "follow-up-reviewed-receipt.json");
writeFileSync(
  followUpReviewedReceiptPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_control_channel_repair_review_receipt_v1",
      builderId: followUpBuilder.builderId,
      sourceRepairQueue: followUpBuilder.paths.derivedRepairQueue,
      decision: "needs_teacher_review",
      itemDecisions: [
        {
          itemId: derivedQueue.items[0].itemId,
          software: derivedQueue.items[0].software,
          sourceRowId: derivedQueue.items[0].sourceRowId,
          probePlanPath: derivedQueue.items[0].probePlanPath,
          probeResultTemplatePath: derivedQueue.items[0].probeResultTemplatePath,
          teacherReadmePath: derivedQueue.items[0].teacherReadmePath,
          nextProfileRequestPath: derivedQueue.items[0].nextProfileRequestPath,
          teacherDecision: "teacher_reviewed_prepare_control_profile",
          evidenceReviewed: true
        }
      ],
      locks: followUpBuilder.locks
    },
    null,
    2
  ),
  "utf8"
);
const followUpReviewedValidation = runNodeScript("validate-all-software-control-channel-repair-receipt.mjs", [
  "--repair-queue",
  followUpBuilder.paths.derivedRepairQueue,
  "--receipt",
  followUpReviewedReceiptPath,
  "--output-dir",
  join(smokeRoot, "follow-up-reviewed-validation")
]);
const followUpReviewedValidationPacket = readJson(followUpReviewedValidation.validationPath);

const defaultReceiptPath = join(smokeRoot, "default-receipt.json");
writeFileSync(
  defaultReceiptPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_control_channel_repair_review_receipt_v1",
      builderId: builder.builderId,
      sourceRepairQueue: queuePath,
      decision: "needs_teacher_review",
      itemDecisions: builder.reviewRows.map((row) => ({
        itemId: row.itemId,
        software: row.software,
        teacherDecision: "needs_teacher_review",
        evidenceReviewed: false,
        teacherNote: ""
      })),
      locks: builder.locks
    },
    null,
    2
  ),
  "utf8"
);
const defaultValidation = runNodeScript("validate-all-software-control-channel-repair-receipt.mjs", [
  "--repair-queue",
  queuePath,
  "--receipt",
  defaultReceiptPath,
  "--output-dir",
  join(smokeRoot, "default-validation")
]);

const defaultTemplateValidation = runNodeScript("validate-all-software-control-channel-repair-receipt.mjs", [
  "--repair-queue",
  queuePath,
  "--receipt",
  builder.paths.receiptTemplate,
  "--output-dir",
  join(smokeRoot, "default-template-validation")
]);
const followUpTemplateValidation = runNodeScript("validate-all-software-control-channel-repair-receipt.mjs", [
  "--repair-queue",
  followUpBuilder.paths.derivedRepairQueue,
  "--receipt",
  followUpBuilder.paths.receiptTemplate,
  "--output-dir",
  join(smokeRoot, "follow-up-template-validation")
]);
const followUpTemplateValidationPacket = readJson(followUpTemplateValidation.validationPath);

const reviewedReceiptPath = join(smokeRoot, "reviewed-receipt.json");
writeFileSync(
  reviewedReceiptPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_control_channel_repair_review_receipt_v1",
      builderId: builder.builderId,
      sourceRepairQueue: queuePath,
      decision: "needs_teacher_review",
      itemDecisions: [
        {
          itemId: "control-repair-001",
          software: "ExampleCAD",
          teacherDecision: "teacher_reviewed_prepare_control_profile",
          evidenceReviewed: true
        },
        {
          itemId: "control-repair-002",
          software: "NeedsProbe",
          teacherDecision: "teacher_reviewed_prepare_read_only_probe",
          evidenceReviewed: true
        }
      ],
      locks: builder.locks
    },
    null,
    2
  ),
  "utf8"
);
const reviewedValidation = runNodeScript("validate-all-software-control-channel-repair-receipt.mjs", [
  "--repair-queue",
  queuePath,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  join(smokeRoot, "reviewed-validation")
]);
const reviewedValidationPacket = readJson(reviewedValidation.validationPath);

const forbiddenReceiptPath = join(smokeRoot, "forbidden-receipt.json");
writeFileSync(
  forbiddenReceiptPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_control_channel_repair_review_receipt_v1",
      builderId: builder.builderId,
      sourceRepairQueue: queuePath,
      decision: "execute_now",
      itemDecisions: [
        {
          itemId: "control-repair-001",
          software: "ExampleCAD",
          teacherDecision: "execute_now",
          evidenceReviewed: true
        }
      ],
      locks: builder.locks
    },
    null,
    2
  ),
  "utf8"
);
const forbiddenValidation = runNodeScript("validate-all-software-control-channel-repair-receipt.mjs", [
  "--repair-queue",
  queuePath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
], { expectFailure: true });

const checks = [
  check(
    "Control-channel repair receipt builder writes HTML and machine-readable builder without running probes",
    builder.format === "transparent_ai_all_software_control_channel_repair_receipt_builder_v1" &&
      existsSync(builderResult.htmlPath) &&
      existsSync(builderResult.receiptTemplatePath) &&
      builder.paths.receiptTemplate === builderResult.receiptTemplatePath &&
      builderReceiptTemplate.templateOnly === true &&
      builderReceiptTemplate.defaultDecision === "needs_teacher_review" &&
      builderReceiptTemplate.itemDecisions.length === 2 &&
      builder.locks.builderWritesDefaultReceiptTemplate === true &&
      builder.locks.builderDoesNotWriteTeacherFilledReceipt === true &&
      builder.locks.defaultReceiptTemplateIsApproval === false &&
      html.includes("Control Channel Repair Receipt Builder") &&
      html.includes("Default receipt template") &&
      html.includes("teacher_reviewed_prepare_control_profile") &&
      html.includes("teacher_reviewed_prepare_read_only_probe") &&
      builder.locks.builderDoesNotRunProbe === true &&
      builder.locks.targetSoftwareCommandsExecuted === false,
    builderResult.builderPath
  ),
  check(
    "Execution follow-up probe packages can become a control-channel repair receipt builder",
    followUpBuilder.format === "transparent_ai_all_software_control_channel_repair_receipt_builder_v1" &&
      followUpBuilder.paths.sourceFollowUpBatch === resolve(followUpBatchPath) &&
      followUpBuilder.paths.derivedRepairQueue.endsWith("control-channel-repair-queue-from-follow-up.json") &&
      derivedQueue.format === "transparent_ai_all_software_control_channel_repair_queue_v1" &&
      derivedQueue.sourceFollowUpBatch === resolve(followUpBatchPath) &&
      derivedQueue.items.length === 2 &&
      derivedQueue.items[0].probePlanPath.includes("software-control-channel-probe-plan.json") &&
      derivedQueue.items[0].probeResultTemplatePath.includes("software-control-channel-probe-result-template.json") &&
      derivedQueue.items[1].lane === "review_dry_run_receipt_before_control_profile" &&
      derivedQueue.items[1].evidencePath.includes("all-software-execution-pilot-runner-receipt.json") &&
      derivedQueue.items[1].missingBeforeExecute.some((item) => item.includes("blocked dry-run or pilot receipt")) &&
      followUpReceiptTemplate.templateOnly === true &&
      followUpReceiptTemplate.itemDecisions[0].probePlanPath.includes("software-control-channel-probe-plan.json") &&
      followUpReceiptTemplate.itemDecisions[0].probeResultTemplatePath.includes("software-control-channel-probe-result-template.json") &&
      followUpReceiptTemplate.itemDecisions[1].evidencePath.includes("all-software-execution-pilot-runner-receipt.json") &&
      followUpBuilder.reviewRows[0].probePlanPath.includes("software-control-channel-probe-plan.json") &&
      followUpBuilder.reviewRows[1].evidencePath.includes("all-software-execution-pilot-runner-receipt.json") &&
      followUpHtml.includes("Probe plan") &&
      followUpHtml.includes("Result template") &&
      followUpBuilder.locks.builderDoesNotRunProbe === true &&
      followUpBuilder.locks.targetSoftwareCommandsExecuted === false,
    followUpBuilderResult.builderPath
  ),
  check(
    "Default control-channel repair receipt stays waiting for teacher review",
    defaultValidation.format === "transparent_ai_all_software_control_channel_repair_receipt_validation_result_v1" &&
      defaultValidation.readyRowCount === 0 &&
      defaultValidation.status === "waiting_for_teacher_control_channel_repair_review",
    defaultValidation.validationPath
  ),
  check(
    "Default receipt templates validate as waiting and preserve probe evidence without approval",
    defaultTemplateValidation.readyRowCount === 0 &&
      defaultTemplateValidation.status === "waiting_for_teacher_control_channel_repair_review" &&
      followUpTemplateValidation.readyRowCount === 0 &&
      followUpTemplateValidationPacket.validationRows[0].evidenceReferencePresent === true &&
      followUpTemplateValidationPacket.validationRows[0].evidenceReferences.probePlanPath.includes("software-control-channel-probe-plan.json") &&
      followUpTemplateValidationPacket.validationRows[0].evidenceReviewed === false &&
      followUpTemplateValidationPacket.locks.probeRan === false &&
      followUpTemplateValidationPacket.locks.controlProfileCreated === false,
    followUpTemplateValidation.validationPath
  ),
  check(
    "Reviewed rows become review-only profile/probe commands without executing",
    reviewedValidation.readyRowCount === 2 &&
      reviewedValidationPacket.nextReviewCommands.length === 2 &&
      reviewedValidationPacket.nextReviewCommands.some((command) => command.tool === "create_software_control_channel_profile") &&
      reviewedValidationPacket.nextReviewCommands.some((command) => command.tool === "create_software_control_channel_probe") &&
      reviewedValidationPacket.locks.probeRan === false &&
      reviewedValidationPacket.locks.controlProfileCreated === false &&
      reviewedValidationPacket.locks.targetSoftwareCommandsExecuted === false,
    reviewedValidation.validationPath
  ),
  check(
    "Validation preserves follow-up probe evidence paths into next review commands",
    followUpReviewedValidation.readyRowCount === 1 &&
      followUpReviewedValidationPacket.validationRows[0].evidenceReferencePresent === true &&
      followUpReviewedValidationPacket.validationRows[0].evidenceReferences.probePlanPath.includes("software-control-channel-probe-plan.json") &&
      followUpReviewedValidationPacket.validationRows[0].evidenceReferences.probeResultTemplatePath.includes("software-control-channel-probe-result-template.json") &&
      followUpReviewedValidationPacket.nextReviewCommands[0].arguments.probePlanPath.includes("software-control-channel-probe-plan.json") &&
      followUpReviewedValidationPacket.nextReviewCommands[0].arguments.probeResultTemplatePath.includes("software-control-channel-probe-result-template.json") &&
      followUpReviewedValidationPacket.nextReviewCommands[0].arguments.requiresTeacherCompletedProbeResultBeforeProfileTrust === true &&
      followUpReviewedValidationPacket.nextReviewCommands[0].arguments.reviewInstruction.includes("template is not a completed probe result") &&
      followUpReviewedValidationPacket.locks.probeRan === false &&
      followUpReviewedValidationPacket.locks.controlProfileCreated === false,
    followUpReviewedValidation.validationPath
  ),
  check(
    "Forbidden execute-now decision fails closed before control-channel review commands",
    forbiddenValidation.failedAsExpected === true &&
      forbiddenValidation.exitStatus !== 0 &&
      forbiddenValidation.status === "blocked" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.locks.targetSoftwareCommandsExecuted === false,
    forbiddenValidation.validationPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_all_software_control_channel_repair_receipt_builder_smoke_v1",
  smokeRoot,
  paths: {
    queue: queuePath,
    builder: builderResult.builderPath,
    followUpBuilder: followUpBuilderResult.builderPath,
    derivedRepairQueue: followUpBuilder.paths.derivedRepairQueue,
    receiptTemplate: builderResult.receiptTemplatePath,
    followUpReceiptTemplate: followUpBuilderResult.receiptTemplatePath,
    html: builderResult.htmlPath,
    reviewedValidation: reviewedValidation.validationPath,
    followUpReviewedValidation: followUpReviewedValidation.validationPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
