#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNode(args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
  assert(result.status === 0, `command failed: node ${args.join(" ")}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function completeContract() {
  return {
    actionIntent: "Adjust FixtureCAD parameter only after teacher confirms the numbered target.",
    targetBinding: "Use the teacher-confirmed target number and the active FixtureCAD document route.",
    dataToActionLogic: "Map measured width and offset values to the reviewed command parameters.",
    dataRelationshipMap: "width -> command.width, offset -> command.offset, target id -> selected object id.",
    geometryRelationshipLogic: "Preserve angle, position anchor, perspective plane, and depth relation from the teacher sketch.",
    targetSelectionLogic: "Select exactly one target from the numbered confirmation list.",
    uncertaintyAndBlockers: "Block execution when the target, route, depth relation, or data mapping is unknown or missing.",
    controlRouteEvidence: "Use the teacher-reviewed control-channel profile request and dry-run receipt references.",
    rollbackPolicy: "Retain a rollback point snapshot before any execution-capable runner and restore from that point on mismatch.",
    outcomeVerifier: "Compare post-action FixtureCAD state with the expected parameter and geometry evidence.",
    validationEvidencePlan: "Run the matrix patch validation first, then require teacher approval gate evidence before execution.",
    ragEvidenceRole: "evidence_only_not_authority",
    reasoningTierBoundary:
      "High reasoning compiles and repairs the contract; medium runtime may execute only after teacher gate and validation matrix pass.",
    mediumRuntimeReuseConditions:
      "Medium runtime requires teacher confirmation, validation matrix pass, rollback point, and execution approval gate.",
    providerRoleUsePlanTrace: "high_reasoning_contract_compile -> validator -> medium_runtime_blocked_until_gate"
  };
}

const tmp = mkdtempSync(join(tmpdir(), "ta-execution-gap-receipt-validation-"));
const queuePath = join(tmp, "control-queue.json");
const controlBuilderPath = join(tmp, "control-builder.json");
const actionPackagePath = join(tmp, "action-logic-package.json");
const cockpitOut = join(tmp, "cockpit");
const defaultValidationOut = join(tmp, "default-validation");
const reviewedValidationOut = join(tmp, "reviewed-validation");
const downstreamControlOut = join(tmp, "downstream-control-validation");
const downstreamLogicOut = join(tmp, "downstream-logic-validation");

writeFileSync(
  queuePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_control_channel_repair_queue_v1",
      status: "derived_from_execution_follow_up_probe_packages_waiting_for_teacher_review",
      items: [
        {
          itemId: "follow-up-probe-row-001",
          sourceRowId: "row-001",
          software: "FixtureCAD",
          processName: "fixturecad.exe",
          windowTitle: "FixtureCAD drawing",
          status: "blocked_before_adapter_runner",
          evidencePath: "evidence/row-001-dry-run-receipt.json",
          probePlanPath: "evidence/row-001-probe-plan.json",
          probeResultTemplatePath: "evidence/row-001-result-template.json",
          teacherReadmePath: "evidence/row-001-readme.md",
          nextProfileRequestPath: "evidence/row-001-profile-request.json",
          actionLogicSourceStatus: "observation_ready_but_action_logic_source_missing"
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

writeFileSync(
  controlBuilderPath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_control_channel_repair_receipt_builder_v1",
      builderId: "control-builder-fixture",
      status: "receipt_builder_ready_for_teacher_use",
      reviewRows: [
        {
          itemId: "follow-up-probe-row-001",
          sourceRowId: "row-001",
          software: "FixtureCAD",
          processName: "fixturecad.exe",
          windowTitle: "FixtureCAD drawing",
          currentStatus: "blocked_before_adapter_runner",
          nextTool: "create_software_control_channel_profile",
          evidencePath: "evidence/row-001-dry-run-receipt.json",
          probePlanPath: "evidence/row-001-probe-plan.json",
          probeResultTemplatePath: "evidence/row-001-result-template.json",
          teacherReadmePath: "evidence/row-001-readme.md",
          nextProfileRequestPath: "evidence/row-001-profile-request.json",
          actionLogicSourceStatus: "observation_ready_but_action_logic_source_missing"
        }
      ],
      paths: {
        builder: controlBuilderPath,
        receiptTemplate: join(tmp, "control-receipt-template.json"),
        sourceRepairQueue: queuePath
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

writeFileSync(
  actionPackagePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_action_logic_source_contract_package_v1",
      packageId: "action-logic-fixture",
      status: "waiting_for_teacher_action_logic_source_review",
      contractRows: [
        {
          rowId: "row-001",
          software: "FixtureCAD",
          currentStatus: "blocked_before_adapter_runner",
          lane: "review_and_run_one_dry_run_pilot",
          evidenceSummary: { status: "blocked_before_adapter_runner" },
          draftPrefillSource: "local_low_token_or_dry_run_evidence_summary_requires_teacher_confirmation",
          teacherMustConfirmOrReplaceDraft: true,
          highReasoningRole: "compile_or_repair_action_logic_contract",
          mediumRuntimeRole: "blocked_until_teacher_confirmed_logic_contract_validation",
          draftContract: completeContract()
        }
      ],
      paths: {
        package: actionPackagePath
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const cockpitResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/create-all-software-execution-gap-review-cockpit.mjs",
  "--control-channel-builder",
  controlBuilderPath,
  "--action-logic-package",
  actionPackagePath,
  "--output-dir",
  cockpitOut
]);
const cockpit = readJson(cockpitResult.paths.cockpit);
const defaultReceiptPath = cockpitResult.paths.receiptTemplate;

const defaultValidationResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/validate-all-software-execution-gap-review-cockpit-receipt.mjs",
  "--cockpit",
  cockpitResult.paths.cockpit,
  "--receipt",
  defaultReceiptPath,
  "--output-dir",
  defaultValidationOut
]);
const defaultValidation = readJson(defaultValidationResult.validationPath);
assert(defaultValidation.status === "waiting_for_teacher_execution_gap_review", "default receipt must wait for teacher review");
assert(defaultValidation.counts.rowsReadyForDownstreamReceiptValidation === 0, "default receipt must not prepare downstream drafts");
assert(defaultValidation.locks.validationDoesNotRunControlValidator === true, "bridge must not run control validator");
assert(defaultValidation.locks.validationDoesNotRunActionLogicValidator === true, "bridge must not run action logic validator");
assert(defaultValidation.locks.targetSoftwareCommandsExecuted === false, "bridge must not execute target software");

const reviewedReceipt = readJson(defaultReceiptPath);
reviewedReceipt.templateOnly = false;
reviewedReceipt.decision = "teacher_ready_for_control_and_logic_receipts";
reviewedReceipt.rowDecisions = reviewedReceipt.rowDecisions.map((row) => ({
  ...row,
  teacherDecision: "teacher_ready_for_control_and_logic_receipts",
  evidenceReviewed: true,
  checklist: Object.fromEntries(Object.keys(row.checklist).map((key) => [key, true])),
  teacherCorrectedActionLogicContract: completeContract(),
  teacherNote: "Teacher confirms this row only for downstream receipt validation, not execution."
}));
const reviewedReceiptPath = join(tmp, "teacher-filled-execution-gap-receipt.json");
writeFileSync(reviewedReceiptPath, `${JSON.stringify(reviewedReceipt, null, 2)}\n`, "utf8");

const reviewedValidationResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/validate-all-software-execution-gap-review-cockpit-receipt.mjs",
  "--cockpit",
  cockpitResult.paths.cockpit,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  reviewedValidationOut
]);
const reviewedValidation = readJson(reviewedValidationResult.validationPath);
assert(reviewedValidation.status === "validated_with_downstream_receipt_drafts", "reviewed receipt must prepare downstream drafts");
assert(reviewedValidation.counts.rowsReadyForDownstreamReceiptValidation === 1, "one row should be ready");
assert(existsSync(reviewedValidation.paths.controlChannelReceiptDraft), "control receipt draft must exist");
assert(existsSync(reviewedValidation.paths.actionLogicReceiptDraft), "action logic receipt draft must exist");
assert(reviewedValidation.nextValidationCommands.controlChannel.includes("validate-all-software-control-channel-repair-receipt.mjs"), "control validation command must be prepared");
assert(reviewedValidation.nextValidationCommands.actionLogic.includes("validate-all-software-action-logic-source-contract-receipt.mjs"), "action logic validation command must be prepared");

const controlValidationResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/validate-all-software-control-channel-repair-receipt.mjs",
  "--repair-queue",
  queuePath,
  "--receipt",
  reviewedValidation.paths.controlChannelReceiptDraft,
  "--output-dir",
  downstreamControlOut
]);
const logicValidationResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/validate-all-software-action-logic-source-contract-receipt.mjs",
  "--package",
  actionPackagePath,
  "--receipt",
  reviewedValidation.paths.actionLogicReceiptDraft,
  "--output-dir",
  downstreamLogicOut
]);
assert(controlValidationResult.readyRowCount === 1, "generated control receipt must validate one row");
assert(logicValidationResult.readyPatchRowCount === 1, "generated action logic receipt must validate one matrix patch row");
assert(cockpit.counts.rowsWithBothReviews === 1, "cockpit fixture must contain one combined row");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_all_software_execution_gap_review_cockpit_receipt_validation_smoke_v1",
      paths: {
        cockpit: cockpitResult.paths.cockpit,
        defaultValidation: defaultValidationResult.validationPath,
        reviewedValidation: reviewedValidationResult.validationPath,
        controlReceiptDraft: reviewedValidation.paths.controlChannelReceiptDraft,
        actionLogicReceiptDraft: reviewedValidation.paths.actionLogicReceiptDraft,
        downstreamControlValidation: controlValidationResult.validationPath,
        downstreamLogicValidation: logicValidationResult.validationPath
      },
      checks: [
        "default receipt remains waiting",
        "reviewed cockpit receipt prepares downstream receipt drafts",
        "control-channel draft validates with existing validator",
        "action-logic draft validates with existing validator",
        "bridge keeps execution, memory, rules, and medium runtime locked"
      ]
    },
    null,
    2
  )
);
