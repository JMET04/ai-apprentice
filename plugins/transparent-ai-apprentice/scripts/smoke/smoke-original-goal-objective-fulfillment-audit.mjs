#!/usr/bin/env node
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = mkdtempSync(join(tmpdir(), "transparent-ai-objective-fulfillment-audit-"));

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

const result = runNodeScript("create-original-goal-objective-fulfillment-audit.mjs", [
  "--output-dir",
  smokeRoot
]);
const audit = readJson(result.auditPath);
const html = readFileSync(result.htmlPath, "utf8");

const requirementIds = new Set(audit.requirements.map((row) => row.id));
const executionRow = audit.requirements.find((row) => row.id === "execute_in_target_software_after_confirmation");
const sketchRow = audit.requirements.find((row) => row.id === "transparent_mask_2d_perspective_3d_depth_understanding");
const lowTokenRow = audit.requirements.find((row) => row.id === "all_software_low_token_learning");

const checks = [
  {
    name: "Audit covers the four explicit user objective lanes",
    pass:
      audit.format === "transparent_ai_original_goal_objective_fulfillment_audit_v1" &&
      requirementIds.has("all_software_low_token_learning") &&
      requirementIds.has("adapt_any_teacher_learning_method") &&
      requirementIds.has("transparent_mask_2d_perspective_3d_depth_understanding") &&
      requirementIds.has("execute_in_target_software_after_confirmation"),
    evidence: result.auditPath
  },
  {
    name: "Audit refuses to treat review-only rehearsal as completed execution",
    pass:
      audit.status === "objective_not_fulfilled_yet" &&
      audit.completionAllowed === false &&
      executionRow?.status === "not_executed_yet_by_design" &&
      executionRow?.provenNow === false &&
      executionRow?.missingBeforeCompletion?.some((item) => item.includes("teacher must select one numbered target")),
    evidence: executionRow
  },
  {
    name: "Audit blocks transparent 2D perspective 3D depth proof until teacher-exported spatial evidence is validated",
    pass:
      sketchRow?.status === "implementation_ready_but_waiting_for_teacher_exported_spatial_evidence" &&
      sketchRow?.provenNow === false &&
      sketchRow?.missingBeforeCompletion?.some((item) =>
        item.includes("teacher-exported spatial evidence validation has not proven 2D position")
      ) &&
      sketchRow?.evidence?.some(
        (item) => item.key === "spatialIntentEvidenceReceiptValidationHas2D" && item.value === false
      ) &&
      sketchRow?.evidence?.some(
        (item) => item.key === "spatialIntentEvidenceReceiptValidationHasPerspective" && item.value === false
      ) &&
      sketchRow?.evidence?.some(
        (item) => item.key === "spatialIntentEvidenceReceiptValidationHas3DDepth" && item.value === false
      ),
    evidence: sketchRow
  },
  {
    name: "Audit distinguishes low-token readiness from all-software operational completion",
    pass:
      lowTokenRow?.provenNow === false &&
      lowTokenRow?.status ===
        "review_only_route_evidence_ready_waiting_for_coverage_contracts_teacher_receipts_and_runner" &&
      lowTokenRow?.missingBeforeCompletion?.some((item) => item.includes("low-token coverage completion gate")) &&
      lowTokenRow?.missingBeforeCompletion?.some((item) => item.includes("teacher")) &&
      lowTokenRow?.missingBeforeCompletion?.some((item) => item.includes("runner")),
    evidence: lowTokenRow
  },
  {
    name: "Audit remains read-only and no-op",
    pass:
      audit.locks.auditDoesNotReadLogs === true &&
      audit.locks.auditDoesNotCaptureScreenshots === true &&
      audit.locks.auditDoesNotExecuteSoftware === true &&
      audit.locks.auditDoesNotRegisterTask === true &&
      audit.locks.auditDoesNotWriteMemory === true &&
      audit.locks.goalComplete === false,
    evidence: audit.locks
  },
  {
    name: "Teacher-readable HTML is generated",
    pass: html.includes("Original Goal Objective Fulfillment Audit") && html.includes("Completion allowed"),
    evidence: result.htmlPath
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_objective_fulfillment_audit_smoke_v1",
      smokeRoot,
      auditPath: result.auditPath,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
