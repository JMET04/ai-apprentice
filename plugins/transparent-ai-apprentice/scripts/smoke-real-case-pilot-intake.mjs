#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "real-case-pilot-intake");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function runScript(script, args) {
  const stdout = execFileSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return JSON.parse(stdout);
}

function reviewedReceipt(template, selectedRoute, decision = "pilot_route_selected_for_manual_preparation") {
  return {
    ...template,
    teacherDecision: decision,
    selectedRoute,
    selectedRouteReviewed: true,
    rollbackRetained: true,
    teacherConfirmedNoExecution: true,
    blockedActionsConfirmed: true,
    reviewedEvidenceRows: template.reviewedEvidenceRows.map((row) => ({
      ...row,
      teacherReviewed: Boolean(row.present),
      reviewerNote: row.present ? "Reviewed in smoke." : "Missing in smoke."
    })),
    teacherNotes:
      decision === "correction_to_high_reasoning_repair"
        ? "Teacher wants high reasoning to repair the real-case logic."
        : "Teacher reviewed the real packaging pilot intake."
  };
}

rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });
const checks = [];

const sourceDrawing = writeJson(join(smokeRoot, "packaging-dieline-example.json"), {
  format: "smoke_packaging_dieline_example_v1",
  dimensions: { width: 120, height: 80, depth: 35 },
  logicHints: ["fold angle depends on material thickness", "glue flap width depends on depth"]
});
const rollbackPoint = join(repoRoot, ".rollback-points", "smoke-real-case-retained-rollback");
mkdirSync(rollbackPoint, { recursive: true });
const readyIntake = runScript("create-real-case-pilot-intake.mjs", [
  "--case-type",
  "packaging_box",
  "--goal",
  "Learn the logic of one packaging dieline and prepare a similar box from new dimensions.",
  "--software",
  "draw.io",
  "--artifact",
  sourceDrawing,
  "--knowledge-source",
  "local packaging standard notes",
  "--constraint",
  "fold angle and glue flap width must be derived from material thickness and depth",
  "--rollback-point",
  rollbackPoint,
  "--out-dir",
  join(smokeRoot, "ready-intake")
]);
const readyTemplate = readJson(readyIntake.receiptTemplatePath);
const readyReceiptPath = writeJson(
  join(smokeRoot, "ready-real-case-receipt.json"),
  reviewedReceipt(readyTemplate, "prepare_universal_detail_logic")
);
const readyValidation = runScript("validate-real-case-pilot-intake-receipt.mjs", [
  "--intake",
  readyIntake.intakePath,
  "--receipt",
  readyReceiptPath,
  "--out-dir",
  join(smokeRoot, "ready-validation")
]);
checks.push({
  name: "Packaging real-case pilot intake prepares universal detail logic route",
  pass:
    readyIntake.status === "real_case_pilot_intake_waiting_for_teacher_route_choice" &&
    readyIntake.caseType === "packaging_box" &&
    readyIntake.recommendedRoutes.some((route) => route.route === "prepare_universal_detail_logic") &&
    readyValidation.status === "real_case_pilot_intake_ready_for_manual_route_preparation" &&
    readyValidation.manualPreparationHandoff?.nextTool === "create_parametric_drawing_logic_learning_kit" &&
    readyValidation.manualPreparationHandoff?.executeNow === false &&
    readyValidation.locks?.validatorDoesNotRunNextTool === true &&
    existsSync(readyIntake.htmlPath),
  evidence: JSON.stringify(readyValidation).slice(0, 700)
});

const missingIntake = runScript("create-real-case-pilot-intake.mjs", [
  "--case-type",
  "cad_drawing",
  "--goal",
  "Prepare a CAD drawing pilot with missing evidence.",
  "--software",
  "AutoCAD",
  "--out-dir",
  join(smokeRoot, "missing-intake")
]);
const missingTemplate = readJson(missingIntake.receiptTemplatePath);
const missingReceiptPath = writeJson(
  join(smokeRoot, "missing-real-case-receipt.json"),
  reviewedReceipt(missingTemplate, "prepare_universal_detail_logic", "provide_missing_case_evidence")
);
const missingValidation = runScript("validate-real-case-pilot-intake-receipt.mjs", [
  "--intake",
  missingIntake.intakePath,
  "--receipt",
  missingReceiptPath,
  "--out-dir",
  join(smokeRoot, "missing-validation")
]);
checks.push({
  name: "Real-case pilot intake blocks route preparation when required evidence is missing",
  pass:
    missingIntake.status === "real_case_pilot_intake_waiting_for_required_evidence" &&
    missingIntake.missingRequiredEvidence.includes("source_artifacts") &&
    missingValidation.status === "real_case_pilot_intake_waiting_for_missing_evidence_collection" &&
    missingValidation.manualPreparationHandoff === null &&
    missingValidation.missingEvidenceHandoff?.executeNow === false,
  evidence: JSON.stringify(missingValidation).slice(0, 700)
});

const forbiddenReceiptPath = writeJson(
  join(smokeRoot, "forbidden-real-case-receipt.json"),
  reviewedReceipt(readyTemplate, "prepare_universal_detail_logic", "execute_now")
);
const forbiddenValidation = runScript("validate-real-case-pilot-intake-receipt.mjs", [
  "--intake",
  readyIntake.intakePath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(smokeRoot, "forbidden-validation")
]);
checks.push({
  name: "Real-case pilot intake receipt blocks execute-now decisions",
  pass:
    forbiddenValidation.status === "blocked_for_forbidden_real_case_pilot_intake_decision" &&
    forbiddenValidation.manualPreparationHandoff === null &&
    forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision") &&
    forbiddenValidation.locks?.targetSoftwareCommandsExecuted === false,
  evidence: JSON.stringify(forbiddenValidation).slice(0, 700)
});

const passed = checks.filter((check) => check.pass).length;
const result = {
  format: "transparent_ai_real_case_pilot_intake_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  smokeRoot,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
