#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "low-token-monitor-bridge-receipt", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
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
const queueResult = runNodeScript("create-original-goal-objective-fulfillment-next-step-queue.mjs", [
  "--audit",
  auditResult.auditPath,
  "--output-dir",
  join(smokeRoot, "queue")
]);
const bridgeResult = runNodeScript("create-original-goal-low-token-monitor-command-bridge.mjs", [
  "--queue",
  queueResult.queuePath,
  "--output-dir",
  join(smokeRoot, "bridge")
]);
const builderResult = runNodeScript("create-original-goal-low-token-monitor-bridge-receipt-builder.mjs", [
  "--bridge",
  bridgeResult.bridgePath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builderPacket = readJson(builderResult.builderPath);
const template = readJson(builderResult.receiptTemplatePath);
const coverageRouteRow = builderPacket.routeRows.find((row) => row.id === "existing_low_token_coverage_review");
const teacherConfirmationRouteRow = builderPacket.routeRows.find(
  (row) => row.id === "existing_recurring_monitor_teacher_confirmation"
);

const validReceiptPath = writeJson(join(smokeRoot, "valid-low-token-monitor-bridge-receipt.json"), {
  ...template,
  teacherDecision: "teacher_selects_route",
  selectedRouteId: "existing_recurring_monitor_teacher_confirmation",
  routeReviewed: true,
  retainedRollbackPoint: "rollback-point-for-low-token-monitor-smoke",
  readinessPackagePath: "real-local-all-software-low-token-readiness-package.json",
  coverageReviewReceiptValidationPath: "teacher-reviewed-low-token-coverage-dossier-receipt-validation.json",
  teacherNotes: "Teacher wants recurring low-token observation after reviewing coverage."
});
const validResult = runNodeScript("validate-original-goal-low-token-monitor-bridge-receipt.mjs", [
  "--bridge",
  bridgeResult.bridgePath,
  "--receipt",
  validReceiptPath,
  "--output-dir",
  join(smokeRoot, "valid-validation")
]);
const validValidation = readJson(validResult.validationPath);

const missingReceiptPath = writeJson(join(smokeRoot, "missing-low-token-monitor-bridge-receipt.json"), {
  ...template,
  teacherDecision: "teacher_selects_route",
  selectedRouteId: "existing_recurring_monitor_teacher_confirmation",
  routeReviewed: true,
  retainedRollbackPoint: "",
  readinessPackagePath: ""
});
const missingResult = runNodeScript("validate-original-goal-low-token-monitor-bridge-receipt.mjs", [
  "--bridge",
  bridgeResult.bridgePath,
  "--receipt",
  missingReceiptPath,
  "--output-dir",
  join(smokeRoot, "missing-validation")
]);
const missingValidation = readJson(missingResult.validationPath);

const missingCoverageReviewReceiptPath = writeJson(join(smokeRoot, "missing-coverage-review-low-token-monitor-bridge-receipt.json"), {
  ...template,
  teacherDecision: "teacher_selects_route",
  selectedRouteId: "existing_recurring_monitor_teacher_confirmation",
  routeReviewed: true,
  retainedRollbackPoint: "rollback-point-for-low-token-monitor-smoke",
  readinessPackagePath: "real-local-all-software-low-token-readiness-package.json",
  teacherExclusionsOrCoverageNote: ""
});
const missingCoverageReviewResult = runNodeScript("validate-original-goal-low-token-monitor-bridge-receipt.mjs", [
  "--bridge",
  bridgeResult.bridgePath,
  "--receipt",
  missingCoverageReviewReceiptPath,
  "--output-dir",
  join(smokeRoot, "missing-coverage-review-validation")
]);
const missingCoverageReviewValidation = readJson(missingCoverageReviewResult.validationPath);

const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-low-token-monitor-bridge-receipt.json"), {
  ...template,
  teacherDecision: "read_full_logs",
  selectedRouteId: "existing_recurring_monitor_run_output_audit",
  routeReviewed: true,
  executeNow: true,
  teacherNotes: "Forbidden smoke path."
});
const forbiddenResult = runNodeScript("validate-original-goal-low-token-monitor-bridge-receipt.mjs", [
  "--bridge",
  bridgeResult.bridgePath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
]);
const forbiddenValidation = readJson(forbiddenResult.validationPath);

const checks = [
  {
    name: "Low-token monitor bridge receipt builder creates teacher route-selection template",
    pass:
      builderResult.format === "transparent_ai_original_goal_low_token_monitor_bridge_receipt_builder_result_v1" &&
      builderResult.routeCount === 5 &&
      coverageRouteRow?.routeStatus === "ready_for_teacher_coverage_review_receipt" &&
      coverageRouteRow?.evidenceAlreadyAvailable?.coverageEvidenceDossierPath &&
      teacherConfirmationRouteRow?.routeStatus === "ready_after_teacher_coverage_review_and_retained_rollback" &&
      teacherConfirmationRouteRow?.evidenceAlreadyAvailable?.readinessPackagePath &&
      template.format === "transparent_ai_original_goal_low_token_monitor_bridge_receipt_v1" &&
      template.executeNow === false &&
      template.reviewOnly === true,
    evidence: { builderResult, coverageRouteRow, teacherConfirmationRouteRow, templateLocks: template.locks }
  },
  {
    name: "Low-token monitor bridge receipt validation selects one recurring monitor route for later gate",
    pass:
      validValidation.format === "transparent_ai_original_goal_low_token_monitor_bridge_receipt_validation_v1" &&
      validValidation.status === "low_token_monitor_bridge_route_selected_for_later_gate" &&
      validValidation.routeReadyForLaterGate === true &&
      validValidation.selectedRouteHandoff.selectedRouteId === "existing_recurring_monitor_teacher_confirmation" &&
      validValidation.selectedRouteHandoff.coverageReviewReceiptValidationPath ===
        "teacher-reviewed-low-token-coverage-dossier-receipt-validation.json" &&
      validValidation.selectedRouteHandoff.executeNow === false &&
      validValidation.locks.validationDoesNotRegisterTask === true &&
      validValidation.locks.validationDoesNotReadFullLogs === true,
    evidence: validValidation.selectedRouteHandoff
  },
  {
    name: "Low-token monitor bridge receipt validation blocks missing route evidence",
    pass:
      missingValidation.routeReadyForLaterGate === false &&
      missingValidation.blockers.includes("readiness_package_path_required") &&
      missingValidation.blockers.includes("retained_rollback_point_required"),
    evidence: missingValidation.blockers
  },
  {
    name: "Low-token monitor bridge receipt validation blocks recurring monitor route before coverage review",
    pass:
      missingCoverageReviewValidation.routeReadyForLaterGate === false &&
      missingCoverageReviewValidation.blockers.includes(
        "coverage_review_receipt_validation_or_teacher_exclusion_required"
      ),
    evidence: missingCoverageReviewValidation.blockers
  },
  {
    name: "Low-token monitor bridge receipt validation blocks forbidden log-reading decisions",
    pass:
      forbiddenValidation.ok === false &&
      forbiddenValidation.status === "blocked_for_forbidden_low_token_monitor_bridge_decision" &&
      forbiddenValidation.blockers.includes("forbidden_teacher_decision") &&
      forbiddenValidation.blockers.includes("receipt_execute_now_forbidden") &&
      forbiddenValidation.locks.fullLogsRead === false,
    evidence: forbiddenValidation
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_low_token_monitor_bridge_receipt_smoke_v1",
      smokeRoot,
      builderPath: builderResult.builderPath,
      validValidationPath: validResult.validationPath,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
