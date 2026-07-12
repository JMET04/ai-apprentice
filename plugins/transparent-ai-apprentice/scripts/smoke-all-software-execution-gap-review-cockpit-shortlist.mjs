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

function runNode(args) {
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: "utf8" });
  assert(result.status === 0, `command failed: node ${args.join(" ")}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function completeContract() {
  return {
    actionIntent: "Adjust FixtureCAD only after teacher confirms the numbered target.",
    targetBinding: "Bind to the reviewed FixtureCAD document and teacher-selected target.",
    dataToActionLogic: "Map width and offset to reviewed command parameters.",
    dataRelationshipMap: "width -> command.width, offset -> command.offset, selected target -> object id.",
    geometryRelationshipLogic: "Preserve angle, position anchor, perspective plane, and depth relation from the teacher sketch.",
    targetSelectionLogic: "Use exactly one teacher-confirmed numbered target.",
    uncertaintyAndBlockers: "Block execution when target, route, depth relation, or data mapping is unknown or missing.",
    controlRouteEvidence: "Use the reviewed control route evidence from the cockpit.",
    rollbackPolicy: "Retain a rollback point snapshot before any execution-capable runner and restore from that point on mismatch.",
    outcomeVerifier: "Compare post-action state with expected parameter and geometry evidence.",
    validationEvidencePlan: "Run downstream validations first, then require teacher approval gate evidence before execution.",
    ragEvidenceRole: "evidence_only_not_authority",
    reasoningTierBoundary:
      "High reasoning compiles and repairs the contract; medium runtime may execute only after teacher gate and validation matrix pass.",
    mediumRuntimeReuseConditions:
      "Medium runtime requires teacher confirmation, validation matrix pass, rollback point, and execution approval gate.",
    providerRoleUsePlanTrace: "high_reasoning_contract_compile -> validator -> medium_runtime_blocked_until_gate"
  };
}

const tmp = mkdtempSync(join(tmpdir(), "ta-execution-gap-shortlist-"));
const queuePath = join(tmp, "control-queue.json");
const controlBuilderPath = join(tmp, "control-builder.json");
const actionPackagePath = join(tmp, "action-logic-package.json");
const cockpitOut = join(tmp, "cockpit");
const shortlistOut = join(tmp, "shortlist");
const defaultValidationOut = join(tmp, "default-validation");
const reviewedValidationOut = join(tmp, "reviewed-validation");

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
          status: "blocked_before_adapter_runner",
          evidencePath: "evidence/row-001-dry-run-receipt.json",
          probePlanPath: "evidence/row-001-probe-plan.json",
          probeResultTemplatePath: "evidence/row-001-result-template.json",
          teacherReadmePath: "evidence/row-001-readme.md",
          nextProfileRequestPath: "evidence/row-001-profile-request.json"
        }
      ],
      locks: { reviewOnly: true, accepted: false, ruleEnabled: false, targetSoftwareCommandsExecuted: false, goalComplete: false }
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
          currentStatus: "blocked_before_adapter_runner",
          nextTool: "create_software_control_channel_profile",
          evidencePath: "evidence/row-001-dry-run-receipt.json",
          probePlanPath: "evidence/row-001-probe-plan.json",
          probeResultTemplatePath: "evidence/row-001-result-template.json",
          teacherReadmePath: "evidence/row-001-readme.md",
          nextProfileRequestPath: "evidence/row-001-profile-request.json"
        }
      ],
      paths: { builder: controlBuilderPath, receiptTemplate: join(tmp, "control-receipt.json"), sourceRepairQueue: queuePath },
      locks: { reviewOnly: true, accepted: false, ruleEnabled: false, targetSoftwareCommandsExecuted: false, goalComplete: false }
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
          draftContract: completeContract()
        }
      ],
      paths: { package: actionPackagePath },
      locks: { reviewOnly: true, accepted: false, ruleEnabled: false, targetSoftwareCommandsExecuted: false, goalComplete: false }
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
const shortlistResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/create-all-software-execution-gap-review-cockpit-shortlist.mjs",
  "--cockpit",
  cockpitResult.paths.cockpit,
  "--output-dir",
  shortlistOut
]);
const shortlist = readJson(shortlistResult.shortlistPath);
const receipt = readJson(shortlistResult.receiptTemplatePath);
assert(shortlist.format === "transparent_ai_all_software_execution_gap_review_cockpit_shortlist_v1", "unexpected shortlist format");
assert(shortlist.counts.recommendedRows === 1, "shortlist must recommend one row");
assert(shortlist.counts.defaultReadyRows === 0, "default ready rows must stay zero");
assert(shortlist.locks.shortlistDoesNotExecuteSoftware === true, "shortlist must not execute software");
assert(receipt.rowDecisions.length === 1, "receipt template must contain one row");
assert(receipt.rowDecisions[0].teacherDecision === "needs_teacher_review", "default receipt must wait");
assert(existsSync(shortlistResult.htmlPath), "shortlist HTML must exist");

const defaultValidation = runNode([
  "plugins/transparent-ai-apprentice/scripts/validate-all-software-execution-gap-review-cockpit-receipt.mjs",
  "--cockpit",
  cockpitResult.paths.cockpit,
  "--receipt",
  shortlistResult.receiptTemplatePath,
  "--output-dir",
  defaultValidationOut
]);
assert(defaultValidation.readyRowCount === 0, "default shortlist receipt must not prepare downstream rows");
assert(defaultValidation.waitingRowCount === 1, "default shortlist receipt should wait on one row");

receipt.templateOnly = false;
receipt.decision = "teacher_ready_for_control_and_logic_receipts";
receipt.rowDecisions = receipt.rowDecisions.map((row) => ({
  ...row,
  teacherDecision: "teacher_ready_for_control_and_logic_receipts",
  evidenceReviewed: true,
  checklist: Object.fromEntries(Object.keys(row.checklist).map((key) => [key, true])),
  teacherCorrectedActionLogicContract: completeContract(),
  teacherNote: "Teacher confirms the one shortlisted combined row for downstream validation only."
}));
const reviewedReceiptPath = join(tmp, "teacher-filled-one-row-cockpit-receipt.json");
writeFileSync(reviewedReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
const reviewedValidation = runNode([
  "plugins/transparent-ai-apprentice/scripts/validate-all-software-execution-gap-review-cockpit-receipt.mjs",
  "--cockpit",
  cockpitResult.paths.cockpit,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  reviewedValidationOut
]);
assert(reviewedValidation.readyRowCount === 1, "reviewed one-row receipt should prepare one downstream row");
assert(reviewedValidation.locks.targetSoftwareCommandsExecuted === false, "reviewed bridge validation must not execute target software");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_all_software_execution_gap_review_cockpit_shortlist_smoke_v1",
      paths: {
        cockpit: cockpitResult.paths.cockpit,
        shortlist: shortlistResult.shortlistPath,
        receiptTemplate: shortlistResult.receiptTemplatePath,
        defaultValidation: defaultValidation.validationPath,
        reviewedValidation: reviewedValidation.validationPath
      },
      checks: [
        "shortlist selects exactly one combined row",
        "default receipt stays waiting",
        "reviewed one-row receipt produces one downstream validation row",
        "execution, memory, rules, and medium runtime remain locked"
      ]
    },
    null,
    2
  )
);
