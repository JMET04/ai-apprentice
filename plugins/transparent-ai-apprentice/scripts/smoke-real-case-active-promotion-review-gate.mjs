#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const transitionSmokeRoot = join(root, ".ta-smoke", "real-case-review-only-transition-package");
const smokeRoot = join(root, ".ta-smoke", "real-case-active-promotion-review-gate");
mkdirSync(smokeRoot, { recursive: true });

function runNode(args, { expectOk = true } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (expectOk && result.status !== 0) throw new Error(result.stderr || result.stdout || args.join(" "));
  if (!expectOk && result.status === 0) throw new Error(`Expected failure: ${args.join(" ")}`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function findFiles(rootDir, fileName) {
  const output = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!existsSync(current)) continue;
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) stack.push(join(current, entry));
    } else if (current.endsWith(fileName)) {
      output.push(current);
    }
  }
  output.sort();
  return output;
}

function latestFile(rootDir, fileName) {
  const files = findFiles(rootDir, fileName);
  if (!files.length) throw new Error(`Missing ${fileName} under ${rootDir}`);
  return files[files.length - 1];
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const transitionSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-review-only-transition-package.mjs"]).stdout
);
const transitionPackagePath = latestFile(
  join(transitionSmokeRoot, "transition"),
  "real-case-review-only-transition-package.json"
);

const builder = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-active-promotion-review-receipt-builder.mjs",
    "--transition-package",
    transitionPackagePath,
    "--out-dir",
    join(smokeRoot, "builder")
  ]).stdout
);
const template = readJson(builder.receiptTemplatePath);
check(
  "Real-case active promotion review builder creates planning-only receipt template",
  builder.format === "transparent_ai_real_case_active_promotion_review_receipt_builder_result_v1" &&
    builder.status === "ready_for_teacher_real_case_active_promotion_review" &&
    template.format === "transparent_ai_real_case_active_promotion_review_receipt_v1" &&
    template.teacherDecision === "needs_teacher_review" &&
    template.forbiddenTeacherDecisions.includes("compile_active_package") &&
    template.transitionSummary.activePromotionAllowedHere === false &&
    template.transitionSummary.activeRulePackageCompiled === false,
  JSON.stringify({ builderPath: builder.builderPath, receiptTemplatePath: builder.receiptTemplatePath })
);

const approveReceipt = {
  ...template,
  teacherDecision: "approve_active_promotion_planning",
  transitionPackageReviewed: true,
  reviewOnlyRulesReviewed: true,
  sourceDraftDisabledPreservationReviewed: true,
  activePromotionPlanningOnlyConfirmed: true,
  activeCompilationStillSeparateConfirmed: true,
  separateExecutionGateRequiredConfirmed: true,
  teacherConfirmedNoExecution: true,
  rollbackRetained: true,
  blockedActionsConfirmed: true,
  teacherNotes: "Approve active promotion planning only."
};
const approveReceiptPath = writeJson(join(smokeRoot, "approve-active-promotion-receipt.json"), approveReceipt);
const approveValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-active-promotion-review-receipt.mjs",
    "--transition-package",
    transitionPackagePath,
    "--receipt",
    approveReceiptPath,
    "--out-dir",
    join(smokeRoot, "approve-validation")
  ]).stdout
);
check(
  "Real-case active promotion review prepares active package planning without active compilation",
  approveValidation.format === "transparent_ai_real_case_active_promotion_review_validation_result_v1" &&
    approveValidation.status === "real_case_active_promotion_review_ready_for_active_package_planning" &&
    approveValidation.readyForActivePromotionPlanning === true &&
    approveValidation.activePromotionPlanningHandoff?.format ===
      "transparent_ai_real_case_active_promotion_planning_handoff_v1" &&
    approveValidation.activePromotionPlanningHandoff?.activePackageCompilationAllowedHere === false &&
    approveValidation.activePromotionPlanningHandoff?.requiresSeparateActiveCompilationGate === true &&
    approveValidation.activePromotionPlanningHandoff?.requiresSeparateExecutionGate === true &&
    approveValidation.locks?.activeRulePackageCompiled === false &&
    approveValidation.locks?.ruleEnabled === false &&
    approveValidation.locks?.targetSoftwareCommandsExecuted === false &&
    approveValidation.locks?.packagingUnlocked === false,
  JSON.stringify(approveValidation.activePromotionPlanningHandoff)
);

const repairReceipt = {
  ...template,
  teacherDecision: "request_high_reasoning_repair",
  transitionPackageReviewed: true,
  teacherNotes: "Review-only package misses a production-risk exception."
};
const repairReceiptPath = writeJson(join(smokeRoot, "repair-active-promotion-receipt.json"), repairReceipt);
const repairValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-active-promotion-review-receipt.mjs",
    "--transition-package",
    transitionPackagePath,
    "--receipt",
    repairReceiptPath,
    "--out-dir",
    join(smokeRoot, "repair-validation")
  ]).stdout
);
check(
  "Real-case active promotion review routes corrections to high reasoning repair",
  repairValidation.status === "real_case_active_promotion_review_routes_to_high_reasoning_repair" &&
    repairValidation.highReasoningRepairHandoff?.format ===
      "transparent_ai_real_case_active_promotion_high_reasoning_repair_handoff_v1" &&
    repairValidation.locks?.ruleEnabled === false,
  JSON.stringify(repairValidation.highReasoningRepairHandoff)
);

const forbiddenReceipt = { ...template, teacherDecision: "compile_active_package", transitionPackageReviewed: true };
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-active-promotion-receipt.json"), forbiddenReceipt);
const forbiddenValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-active-promotion-review-receipt.mjs",
    "--transition-package",
    transitionPackagePath,
    "--receipt",
    forbiddenReceiptPath,
    "--out-dir",
    join(smokeRoot, "forbidden-validation")
  ]).stdout
);
check(
  "Real-case active promotion review blocks forbidden active compilation decisions",
  forbiddenValidation.status === "blocked_for_forbidden_real_case_active_promotion_review_decision" &&
    forbiddenValidation.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenValidation.locks?.activeRulePackageCompiled === false,
  JSON.stringify(forbiddenValidation.blockers)
);

const summary = {
  format: "transparent_ai_real_case_active_promotion_review_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  transitionSmokeStatus: transitionSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
