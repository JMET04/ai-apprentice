#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "objective-fulfillment-receipt", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${scriptName} unexpectedly succeeded`);
    return JSON.parse(result.stdout);
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

const auditResult = runNodeScript("create-original-goal-objective-fulfillment-audit.mjs", [
  "--output-dir",
  join(smokeRoot, "audit")
]);
const builderResult = runNodeScript("create-original-goal-objective-fulfillment-receipt-builder.mjs", [
  "--audit",
  auditResult.auditPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const template = readJson(builderResult.receiptTemplatePath);
const html = readFileSync(builderResult.htmlPath, "utf8");

const selectedReceiptPath = writeJson(join(smokeRoot, "selected-receipt.json"), {
  ...template,
  rowDecisions: template.rowDecisions.map((row) => ({
    ...row,
    teacherDecision:
      row.id === "transparent_mask_2d_perspective_3d_depth_understanding"
        ? "teacher_selects_next_lane"
        : "teacher_confirms_audit_status",
    auditRowReviewed: true,
    teacherNote: row.id === "transparent_mask_2d_perspective_3d_depth_understanding" ? "review depth rehearsal next" : "status confirmed"
  }))
});
const selectedResult = runNodeScript("validate-original-goal-objective-fulfillment-receipt.mjs", [
  "--audit",
  auditResult.auditPath,
  "--receipt",
  selectedReceiptPath,
  "--output-dir",
  join(smokeRoot, "selected-validation")
]);
const selectedValidation = readJson(selectedResult.validationPath);

const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-receipt.json"), {
  ...template,
  rowDecisions: [
    {
      id: "execute_in_target_software_after_confirmation",
      teacherDecision: "claim_complete",
      auditRowReviewed: true,
      teacherNote: "forbidden"
    }
  ]
});
const forbiddenResult = runNodeScript(
  "validate-original-goal-objective-fulfillment-receipt.mjs",
  ["--audit", auditResult.auditPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(smokeRoot, "forbidden-validation")],
  { expectFailure: true }
);
const forbiddenValidation = readJson(forbiddenResult.validationPath);

const correctionReceiptPath = writeJson(join(smokeRoot, "correction-receipt.json"), {
  ...template,
  rowDecisions: [
    {
      id: "all_software_low_token_learning",
      teacherDecision: "teacher_requests_correction",
      auditRowReviewed: true,
      teacherNote: "the log route status needs revision",
      correctionRequest: "mark one software as teacher-excluded before completion audit"
    }
  ]
});
const correctionResult = runNodeScript("validate-original-goal-objective-fulfillment-receipt.mjs", [
  "--audit",
  auditResult.auditPath,
  "--receipt",
  correctionReceiptPath,
  "--output-dir",
  join(smokeRoot, "correction-validation")
]);
const correctionValidation = readJson(correctionResult.validationPath);

const checks = [
  {
    name: "Builder creates a teacher-fillable receipt for all four objective lanes",
    pass:
      builder.format === "transparent_ai_original_goal_objective_fulfillment_receipt_builder_v1" &&
      builder.reviewRows.length === 4 &&
      template.format === "transparent_ai_original_goal_objective_fulfillment_receipt_v1" &&
      html.includes("Original Goal Objective Fulfillment Receipt Builder"),
    evidence: builderResult.builderPath
  },
  {
    name: "Valid receipt selects exactly one next lane without execution",
    pass:
      selectedValidation.ok === true &&
      selectedValidation.validationDecision === "one_next_lane_selected_for_review_only_follow_up" &&
      selectedValidation.nextLaneQueue.length === 1 &&
      selectedValidation.nextLaneQueue[0].requirementId === "transparent_mask_2d_perspective_3d_depth_understanding" &&
      selectedValidation.readyForExecution === false &&
      selectedValidation.locks.validationDoesNotExecuteTargetSoftware === true,
    evidence: selectedResult.validationPath
  },
  {
    name: "Forbidden completion or execute-style decision is rejected",
    pass:
      forbiddenValidation.ok === false &&
      forbiddenValidation.errors.includes("INVALID_RECEIPT_ROWS_PRESENT") &&
      forbiddenValidation.validationRows[0].errors.includes("FORBIDDEN_DECISION") &&
      forbiddenValidation.locks.goalComplete === false,
    evidence: forbiddenResult.validationPath
  },
  {
    name: "Teacher correction routes to a repair queue without writing memory",
    pass:
      correctionValidation.ok === true &&
      correctionValidation.validationDecision === "teacher_correction_requested_for_objective_audit" &&
      correctionValidation.correctionQueue.length === 1 &&
      correctionValidation.locks.validationDoesNotWriteMemory === true,
    evidence: correctionResult.validationPath
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_objective_fulfillment_receipt_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
