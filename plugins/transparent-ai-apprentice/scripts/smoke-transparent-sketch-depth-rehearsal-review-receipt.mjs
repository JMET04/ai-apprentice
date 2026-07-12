#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "transparent-sketch-depth-rehearsal-review-receipt-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], expectFailure = false) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (expectFailure) {
    if (result.status === 0) throw new Error(`${scriptName} unexpectedly passed`);
    return { failedAsExpected: true, stdout: result.stdout, stderr: result.stderr };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const rehearsalResult = runNodeScript("create-transparent-sketch-depth-demonstration-rehearsal.mjs", [
  "--goal",
  "Smoke teacher review of transparent 2D perspective 3D depth rehearsal.",
  "--software",
  "target engineering software",
  "--selected-number",
  "1",
  "--teacher-confirmed-number",
  "--output-dir",
  join(smokeRoot, "rehearsal")
]);

const builder = runNodeScript("create-transparent-sketch-depth-rehearsal-review-receipt-builder.mjs", [
  "--rehearsal",
  rehearsalResult.rehearsalPath,
  "--goal",
  "Smoke depth rehearsal review receipt builder.",
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builderJson = readJson(builder.paths.builder);
const receiptTemplate = readJson(builder.paths.receiptTemplate);
const builderHtml = readFileSync(builder.paths.html, "utf8");

const confirmedReceiptPath = join(smokeRoot, "teacher-confirmed-depth-rehearsal-receipt.json");
const confirmedReceipt = {
  ...receiptTemplate,
  decision: "teacher_confirms_understanding",
  rowDecisions: receiptTemplate.rowDecisions.map((row) => ({
    ...row,
    teacherDecision: "teacher_confirms_understanding",
    evidenceReviewed: true,
    teacherNote: "Reviewed in smoke."
  }))
};
writeJson(confirmedReceiptPath, confirmedReceipt);
const confirmedValidation = runNodeScript("validate-transparent-sketch-depth-rehearsal-review-receipt.mjs", [
  "--builder",
  builder.paths.builder,
  "--receipt",
  confirmedReceiptPath,
  "--output-dir",
  join(smokeRoot, "confirmed-validation")
]);

const incompleteReceiptPath = join(smokeRoot, "teacher-incomplete-depth-rehearsal-receipt.json");
const incompleteReceipt = {
  ...receiptTemplate,
  rowDecisions: receiptTemplate.rowDecisions.map((row, index) => ({
    ...row,
    teacherDecision: index === 0 ? "teacher_confirms_understanding" : "needs_teacher_review",
    evidenceReviewed: index === 0
  }))
};
writeJson(incompleteReceiptPath, incompleteReceipt);
const incompleteValidation = runNodeScript("validate-transparent-sketch-depth-rehearsal-review-receipt.mjs", [
  "--builder",
  builder.paths.builder,
  "--receipt",
  incompleteReceiptPath,
  "--output-dir",
  join(smokeRoot, "incomplete-validation")
]);

const correctionReceiptPath = join(smokeRoot, "teacher-correction-depth-rehearsal-receipt.json");
const correctionReceipt = {
  ...receiptTemplate,
  rowDecisions: receiptTemplate.rowDecisions.map((row, index) => ({
    ...row,
    teacherDecision: index === 1 ? "teacher_requests_correction" : "teacher_confirms_understanding",
    evidenceReviewed: true,
    correctionRequest: index === 1 ? "Depth relation is reversed." : ""
  }))
};
writeJson(correctionReceiptPath, correctionReceipt);
const correctionValidation = runNodeScript("validate-transparent-sketch-depth-rehearsal-review-receipt.mjs", [
  "--builder",
  builder.paths.builder,
  "--receipt",
  correctionReceiptPath,
  "--output-dir",
  join(smokeRoot, "correction-validation")
]);

const forbiddenReceiptPath = join(smokeRoot, "teacher-forbidden-depth-rehearsal-receipt.json");
const forbiddenReceipt = {
  ...receiptTemplate,
  rowDecisions: receiptTemplate.rowDecisions.map((row, index) => ({
    ...row,
    teacherDecision: index === 0 ? "execute_now" : "teacher_confirms_understanding",
    evidenceReviewed: true
  }))
};
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenValidation = runNodeScript(
  "validate-transparent-sketch-depth-rehearsal-review-receipt.mjs",
  ["--builder", builder.paths.builder, "--receipt", forbiddenReceiptPath, "--output-dir", join(smokeRoot, "forbidden-validation")],
  true
);

const checks = [
  {
    name: "Builder creates teacher review rows for every depth rehearsal check",
    pass:
      builderJson.format === "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_builder_v1" &&
      builderJson.reviewRows.length === readJson(rehearsalResult.rehearsalPath).checks.length &&
      builderJson.reviewRows.some((row) => row.requirement.includes("2D perspective and 3D depth")) &&
      builderJson.locks.builderDoesNotExecuteSoftware === true &&
      builderJson.locks.goalComplete === false &&
      builderHtml.includes("Transparent Sketch Depth Rehearsal Review Receipt Builder"),
    evidence: builder.paths.builder
  },
  {
    name: "Confirmed receipt remains review-only and never becomes execution approval",
    pass:
      confirmedValidation.format === "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_validation_v1" &&
      confirmedValidation.validationDecision === "teacher_confirmed_depth_rehearsal_review_only" &&
      confirmedValidation.allConfirmed === true &&
      confirmedValidation.readyForExecution === false &&
      confirmedValidation.accepted === false &&
      confirmedValidation.ruleEnabled === false &&
      confirmedValidation.locks.validationDoesNotExecuteSoftware === true,
    evidence: confirmedValidation.paths.validation
  },
  {
    name: "Incomplete receipt stays in teacher review",
    pass:
      incompleteValidation.validationDecision === "needs_teacher_review" &&
      incompleteValidation.missingReviewRowCount >= 1 &&
      incompleteValidation.allConfirmed === false,
    evidence: incompleteValidation.paths.validation
  },
  {
    name: "Correction receipt blocks route review until the teacher correction is handled",
    pass:
      correctionValidation.validationDecision === "teacher_correction_required_before_route_review" &&
      correctionValidation.correctionRowCount === 1 &&
      correctionValidation.nextReviewCommands.some((row) => row.label.includes("correction")),
    evidence: correctionValidation.paths.validation
  },
  {
    name: "Forbidden execute-now receipt is rejected",
    pass: forbiddenValidation.failedAsExpected === true,
    evidence: forbiddenReceiptPath
  }
];

const failed = checks.filter((check) => !check.pass);
const result = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_smoke_v1",
  smokeRoot,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (failed.length > 0) process.exit(1);
