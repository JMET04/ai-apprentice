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

const tmp = mkdtempSync(join(tmpdir(), "ta-execution-gap-cockpit-"));
const controlPath = join(tmp, "control-builder.json");
const logicPath = join(tmp, "action-logic-package.json");
const outDir = join(tmp, "out");

writeFileSync(
  controlPath,
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
          missingBeforeExecute: ["teacher-reviewed control route evidence"],
          nextTool: "create_software_control_channel_profile",
          evidencePath: "evidence/row-001-dry-run-receipt.json",
          probePlanPath: "evidence/row-001-probe-plan.json",
          probeResultTemplatePath: "evidence/row-001-result-template.json",
          teacherReadmePath: "evidence/row-001-readme.md",
          nextProfileRequestPath: "evidence/row-001-profile-request.json",
          actionLogicSourceStatus: "observation_ready_but_action_logic_source_missing",
          defaultDecision: "needs_teacher_review"
        }
      ],
      paths: {
        builder: controlPath,
        receiptTemplate: join(tmp, "control-receipt-template.json"),
        sourceRepairQueue: join(tmp, "control-queue.json")
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        packagingGated: true,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

writeFileSync(
  logicPath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_action_logic_source_contract_package_v1",
      packageId: "action-logic-fixture",
      status: "action_logic_source_contract_package_ready_for_teacher_review",
      contractRows: [
        {
          rowId: "row-001",
          software: "FixtureCAD",
          currentStatus: "blocked_before_adapter_runner",
          lane: "review_and_run_one_dry_run_pilot",
          evidenceSummary: {
            status: "blocked_before_adapter_runner",
            lane: "review_and_run_one_dry_run_pilot",
            evidenceKind: "blocked_dry_run_or_pilot_receipt",
            evidenceConfidence: "low_requires_teacher_confirmation"
          },
          draftPrefillSource: "local_low_token_or_dry_run_evidence_summary_requires_teacher_confirmation",
          teacherMustConfirmOrReplaceDraft: true,
          highReasoningRole: "compile_or_repair_action_logic_contract",
          mediumRuntimeRole: "blocked_until_teacher_confirmed_logic_contract_validation",
          draftContract: {
            actionIntent: "Teacher must confirm the intended action for FixtureCAD.",
            targetBinding: "Bind FixtureCAD only to a teacher-confirmed numbered target.",
            dataToActionLogic: "Teacher maps datum to command parameter.",
            dataRelationshipMap: "Teacher must map each source datum to output parameter.",
            geometryRelationshipLogic: "Teacher confirms angle, position, relative anchor, and depth.",
            targetSelectionLogic: "Select exactly one teacher-confirmed numbered target.",
            rollbackPolicy: "retained rollback point required before execution-capable runner",
            outcomeVerifier: "post-action evidence checkpoint required",
            reasoningTierBoundary: "highest reasoning compiles contract; medium runtime waits"
          }
        }
      ],
      paths: {
        package: logicPath
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false,
        packagingGated: true,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const result = spawnSync(
  process.execPath,
  [
    "plugins/transparent-ai-apprentice/scripts/create-all-software-execution-gap-review-cockpit.mjs",
    "--control-channel-builder",
    controlPath,
    "--action-logic-package",
    logicPath,
    "--output-dir",
    outDir
  ],
  { cwd: process.cwd(), encoding: "utf8" }
);
assert(result.status === 0, `cockpit builder failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
const output = JSON.parse(result.stdout);
assert(output.ok === true, "builder result must be ok");
assert(output.format === "transparent_ai_all_software_execution_gap_review_cockpit_result_v1", "unexpected result format");
assert(existsSync(output.paths.cockpit), "cockpit JSON must exist");
assert(existsSync(output.paths.html), "cockpit HTML must exist");
assert(existsSync(output.paths.receiptTemplate), "receipt template must exist");

const cockpit = readJson(output.paths.cockpit);
assert(cockpit.format === "transparent_ai_all_software_execution_gap_review_cockpit_v1", "unexpected cockpit format");
assert(cockpit.counts.totalRows === 1, "fixture should merge into one review row");
assert(cockpit.counts.rowsWithBothReviews === 1, "merged row must contain both control and action logic reviews");
const row = cockpit.reviewRows[0];
assert(row.controlChannelReview.present === true, "control review must be present");
assert(row.actionLogicReview.present === true, "action logic review must be present");
assert(row.actionLogicReview.teacherMustConfirmOrReplaceDraft === true, "teacher confirmation flag must be preserved");
assert(row.actionLogicReview.draftContract.geometryRelationshipLogic.includes("angle"), "geometry/depth logic draft must be carried forward");
assert(row.allowedTeacherDecisions.includes("teacher_ready_for_control_and_logic_receipts"), "combined review decision must be available");
assert(row.blockedTeacherDecisions.includes("execute_now"), "execute_now must be blocked");
assert(row.blockedTeacherDecisions.includes("claim_complete"), "claim_complete must be blocked");
assert(row.nextCommands.validateControlChannelReceipt.includes("validate-all-software-control-channel-repair-receipt.mjs"), "control receipt validation command must be shown");
assert(row.nextCommands.validateActionLogicReceipt.includes("validate-all-software-action-logic-source-contract-receipt.mjs"), "action logic receipt validation command must be shown");
assert(cockpit.locks.reviewOnly === true, "cockpit must remain review-only");
assert(cockpit.locks.accepted === false, "cockpit must not accept");
assert(cockpit.locks.ruleEnabled === false, "cockpit must not enable rules");
assert(cockpit.locks.softwareActionsExecuted === false, "cockpit must not execute software");
assert(cockpit.locks.targetSoftwareCommandsExecuted === false, "cockpit must not execute target commands");
assert(cockpit.locks.memoryWritten === false, "cockpit must not write memory");
assert(cockpit.locks.nativeUniversalExecution === false, "cockpit must not claim universal execution");
assert(cockpit.locks.goalComplete === false, "cockpit must not claim goal completion");

const receiptTemplate = readJson(output.paths.receiptTemplate);
assert(receiptTemplate.format === "transparent_ai_all_software_execution_gap_review_cockpit_receipt_v1", "unexpected receipt template format");
assert(receiptTemplate.templateOnly === true, "receipt template must be template-only");
assert(receiptTemplate.decision === "needs_teacher_review", "default receipt decision must remain needs_teacher_review");
assert(receiptTemplate.rowDecisions[0].teacherCorrectedActionLogicContract.actionIntent, "receipt template must carry draft contract for teacher correction");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "all-software-execution-gap-review-cockpit",
      cockpit: output.paths.cockpit,
      html: output.paths.html,
      receiptTemplate: output.paths.receiptTemplate
    },
    null,
    2
  )
);
