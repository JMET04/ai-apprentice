#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return String(value || "all-software-coverage-convergence-audit")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-coverage-convergence-audit";
}

function readJsonInput(input, label) {
  if (!input) throw new Error(`${label} is required`);
  const text = String(input).trim();
  if (existsSync(text)) return { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false,
    memoryWritten: false,
    scheduledTaskInstalled: false,
    teacherConfirmationRequired: true
  };
}

function normalizeSupervisor(input, index) {
  const parsed = readJsonInput(input, `--supervisor[${index}]`);
  const value = parsed.value;
  if (value.format !== "transparent_ai_all_software_coverage_rollout_supervisor_v1") {
    throw new Error("Expected transparent_ai_all_software_coverage_rollout_supervisor_v1");
  }
  return { value, path: parsed.path };
}

function batchMapFromSupervisors(supervisors) {
  const map = new Map();
  for (const supervisor of supervisors) {
    for (const packet of supervisor.value.batchPackets || []) {
      if (!map.has(packet.batchId)) {
        map.set(packet.batchId, {
          batchId: packet.batchId,
          rolloutPackets: [],
          auditPackets: [],
          teacherReviewed: false,
          queuedCount: 0,
          runnerRuns: 0,
          compactLearningEvents: 0
        });
      }
      const row = map.get(packet.batchId);
      row.rolloutPackets.push({
        supervisorPath: supervisor.path,
        rolloutPath: packet.rolloutPath || "",
        receiptPath: packet.receiptPath || "",
        queuePath: packet.queuePath || "",
        status: packet.status || "",
        teacherReviewed: packet.teacherReviewed === true
      });
      row.teacherReviewed = row.teacherReviewed || packet.teacherReviewed === true;
      row.queuedCount += packet.queuedCount || 0;
    }
    for (const audit of supervisor.value.auditPackets || []) {
      if (!map.has(audit.batchId)) {
        map.set(audit.batchId, {
          batchId: audit.batchId,
          rolloutPackets: [],
          auditPackets: [],
          teacherReviewed: false,
          queuedCount: 0,
          runnerRuns: 0,
          compactLearningEvents: 0
        });
      }
      map.get(audit.batchId).auditPackets.push({
        supervisorPath: supervisor.path,
        auditPath: audit.auditPath || "",
        receiptPath: audit.receiptPath || "",
        repairPlanPath: audit.repairPlanPath || "",
        status: audit.status || "",
        coverageAuditRerunAfterBatch: audit.coverageAuditRerunAfterBatch === true,
        totalAudited: audit.totalAudited || 0
      });
    }
    const counts = supervisor.value.counts || {};
    for (const batchId of supervisor.value.selectedBatches || []) {
      if (!map.has(batchId)) continue;
      const row = map.get(batchId);
      row.runnerRuns += counts.runnerRuns && (supervisor.value.selectedBatches || []).length
        ? counts.runnerRuns / supervisor.value.selectedBatches.length
        : 0;
      row.compactLearningEvents += counts.compactLearningEvents && (supervisor.value.selectedBatches || []).length
        ? counts.compactLearningEvents / supervisor.value.selectedBatches.length
        : 0;
    }
  }
  return map;
}

function statusForBatch(row) {
  if (!row || row.rolloutPackets.length === 0) return "not_started";
  if (!row.teacherReviewed) return "prepared_waiting_for_teacher_review";
  if (row.auditPackets.some((packet) => packet.coverageAuditRerunAfterBatch)) return "advanced_with_post_batch_audit";
  return "advanced_missing_post_batch_audit";
}

const planInput = readJsonInput(argValue("--plan", argValue("--plan-path", "")), "--plan");
const plan = planInput.value;
if (plan.format !== "transparent_ai_all_software_coverage_expansion_plan_v1") {
  throw new Error("Expected transparent_ai_all_software_coverage_expansion_plan_v1");
}
const supervisorInputs = [...argValues("--supervisor"), ...argValues("--supervisor-path")];
const supervisors = supervisorInputs.map(normalizeSupervisor);
const goal = argValue("--goal", "Audit convergence of all-software coverage rollout batches before claiming broad coverage.");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-convergence-audits")));
mkdirSync(outputRoot, { recursive: true });
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });

const rolloutByBatch = batchMapFromSupervisors(supervisors);
const batchRows = (plan.batches || []).map((batch, index) => {
  const evidence = rolloutByBatch.get(batch.batchId);
  const status = statusForBatch(evidence);
  const rowCount = Array.isArray(batch.rows) ? batch.rows.length : 0;
  return {
    batchId: batch.batchId,
    batchIndex: index + 1,
    plannedRows: rowCount,
    plannedSoftware: (batch.rows || []).map((row) => row.software || row.processName || "unknown software"),
    status,
    teacherReviewed: evidence?.teacherReviewed === true,
    rolloutPackets: evidence?.rolloutPackets || [],
    auditPackets: evidence?.auditPackets || [],
    queuedCount: evidence?.queuedCount || 0,
    runnerRuns: Math.round(evidence?.runnerRuns || 0),
    compactLearningEvents: Math.round(evidence?.compactLearningEvents || 0),
    nextAction:
      status === "not_started"
        ? "run_selected_batch_with_rollout_supervisor"
        : status === "prepared_waiting_for_teacher_review"
          ? "teacher_review_required_before_runner"
          : status === "advanced_missing_post_batch_audit"
            ? "rerun_post_batch_coverage_audit"
            : "review_post_batch_audit"
  };
});

const counts = {
  plannedBatches: batchRows.length,
  plannedSoftwareRows: batchRows.reduce((total, row) => total + row.plannedRows, 0),
  supervisorsAudited: supervisors.length,
  advancedWithPostBatchAudit: batchRows.filter((row) => row.status === "advanced_with_post_batch_audit").length,
  preparedWaitingForTeacherReview: batchRows.filter((row) => row.status === "prepared_waiting_for_teacher_review").length,
  advancedMissingPostBatchAudit: batchRows.filter((row) => row.status === "advanced_missing_post_batch_audit").length,
  notStarted: batchRows.filter((row) => row.status === "not_started").length,
  queuedSoftware: batchRows.reduce((total, row) => total + row.queuedCount, 0),
  runnerRuns: batchRows.reduce((total, row) => total + row.runnerRuns, 0),
  compactLearningEvents: batchRows.reduce((total, row) => total + row.compactLearningEvents, 0)
};

const remainingBatches = batchRows.filter((row) => row.status !== "advanced_with_post_batch_audit");
const firstRemaining = remainingBatches[0];
const coverageConvergedForTeacherReview =
  counts.plannedBatches > 0 &&
  counts.advancedWithPostBatchAudit === counts.plannedBatches &&
  counts.advancedMissingPostBatchAudit === 0 &&
  counts.preparedWaitingForTeacherReview === 0 &&
  counts.notStarted === 0;
const nextCommand = firstRemaining
  ? `node plugins/transparent-ai-apprentice/scripts/run-all-software-coverage-rollout-supervisor.mjs --plan "${planInput.path || "<plan json>"}" --teacher-reviewed --start-batch ${firstRemaining.batchId} --max-batches 2`
  : "Review every post-batch coverage audit receipt with the teacher; do not claim completion until accepted.";

const auditPath = join(auditDir, "all-software-coverage-convergence-audit.json");
const receiptPath = join(auditDir, "all-software-coverage-convergence-audit-receipt.json");
const readmePath = join(auditDir, "ALL_SOFTWARE_COVERAGE_CONVERGENCE_AUDIT_START_HERE.md");

const audit = {
  format: "transparent_ai_all_software_coverage_convergence_audit_v1",
  auditId,
  createdAt: new Date().toISOString(),
  goal,
  status: coverageConvergedForTeacherReview
    ? "all_planned_batches_advanced_waiting_for_teacher_completion_review"
    : "coverage_rollout_still_has_remaining_batches_or_audit_gaps",
  sourceExpansionPlanPath: planInput.path,
  supervisorPaths: supervisors.map((supervisor) => supervisor.path),
  counts,
  coverageConvergedForTeacherReview,
  allSoftwareCoverageComplete: false,
  batchRows,
  remainingBatches: remainingBatches.map((row) => ({
    batchId: row.batchId,
    status: row.status,
    plannedRows: row.plannedRows,
    nextAction: row.nextAction
  })),
  nextCommand,
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    reason: coverageConvergedForTeacherReview
      ? "All planned bounded batches have post-batch audit evidence, but teacher acceptance and universal native execution remain unproven."
      : "Some planned batches still need reviewed rollout or post-batch coverage audit evidence.",
    stillNeeded: [
      "teacher reviews post-batch audit receipts",
      "teacher excludes private or out-of-scope software",
      "remaining batches are rolled out with post-batch audits",
      "universal native execution remains separately unproven"
    ]
  },
  locks: locks()
};

const receipt = {
  format: "transparent_ai_all_software_coverage_convergence_audit_receipt_v1",
  auditId,
  status: audit.status,
  auditPath,
  plannedBatches: counts.plannedBatches,
  advancedWithPostBatchAudit: counts.advancedWithPostBatchAudit,
  remainingBatchCount: remainingBatches.length,
  coverageConvergedForTeacherReview,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  memoryWritten: false,
  scheduledTaskInstalled: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: locks()
};

writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(readmePath, [
  "# All-Software Coverage Convergence Audit",
  "",
  `Status: ${audit.status}`,
  `Planned batches: ${counts.plannedBatches}`,
  `Advanced with post-batch audit: ${counts.advancedWithPostBatchAudit}`,
  `Remaining batches or audit gaps: ${remainingBatches.length}`,
  "",
  "This audit aggregates an expansion plan and one or more rollout supervisor receipts. It does not read logs, capture screenshots, execute software, write memory, register schedules, accept coverage, enable rules, or unlock packaging.",
  "",
  "Next command:",
  "",
  nextCommand
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_all_software_coverage_convergence_audit_result_v1",
  auditId,
  status: audit.status,
  auditPath,
  receiptPath,
  readmePath,
  counts,
  coverageConvergedForTeacherReview,
  remainingBatchCount: remainingBatches.length,
  allSoftwareCoverageComplete: false,
  locks: receipt.locks
}, null, 2));
