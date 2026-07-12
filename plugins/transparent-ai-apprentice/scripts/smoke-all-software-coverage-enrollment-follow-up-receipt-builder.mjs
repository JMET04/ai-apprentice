#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(
  tmpdir(),
  "transparent-ai-apprentice-smoke",
  "all-software-coverage-enrollment-follow-up-receipt-builder-smoke",
  String(Date.now())
);
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const planPath = join(smokeRoot, "fixture-enrollment-follow-up-plan.json");
writeFileSync(
  planPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
      planId: "fixture-enrollment-plan",
      status: "coverage_follow_up_plan_ready",
      goal: "Review two remaining low-token evidence gaps.",
      sourceLedgerPath: "D:\\example\\reviewed-subset-ledger.json",
      reviewScope: {
        scopeKind: "teacher_reviewed_subset_ledger",
        sourceLedgerPath: "D:\\example\\source-ledger.json",
        currentLedgerPath: "D:\\example\\reviewed-subset-ledger.json",
        subsetPurpose: "Contains only rows the teacher reviewed for low-token follow-up.",
        reviewedFollowUpRows: 2,
        unreviewedRowsExcluded: 9,
        requiresTeacherReviewedSubset: false
      },
      followUpItems: [
        {
          followUpId: "enrollment-follow-up-001",
          ledgerNumber: 7,
          software: "Example Log App",
          status: "enrolled_log_route_waiting_for_watch_evidence",
          route: "collect_watch_or_queue_item_evidence",
          instruction: "Run metadata gate after teacher review.",
          tool: "watch_log_source_metadata_deltas",
          fallbackTool: "run_software_observer_queue_item",
          expectedEvidence: "metadata gate receipt",
          stopIf: ["teacher marks this private", "route would require screenshots"]
        },
        {
          followUpId: "enrollment-follow-up-002",
          ledgerNumber: 8,
          software: "Example No Log App",
          status: "enrolled_non_log_fallback_waiting_for_watch_evidence",
          route: "collect_watch_or_queue_item_evidence",
          instruction: "Collect non-log fallback evidence after teacher review.",
          tool: "watch_log_source_metadata_deltas",
          fallbackTool: "",
          expectedEvidence: "non-log fallback receipt",
          stopIf: ["teacher marks this private"]
        }
      ],
      counts: {
        followUpItems: 2
      },
      routeCounts: {
        collect_watch_or_queue_item_evidence: 2
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        softwareActionsExecuted: false
      }
    },
    null,
    2
  ),
  "utf8"
);

const batchPath = join(smokeRoot, "fixture-dry-run-batch.json");
writeFileSync(
  batchPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1",
      batchId: "fixture-dry-run-batch",
      status: "waiting_for_teacher_review",
      sourcePlanPath: planPath,
      teacherReviewed: false,
      selectedItemCount: 2,
      ranToolCount: 0,
      runResults: [
        {
          followUpId: "enrollment-follow-up-001",
          software: "Example Log App",
          status: "dry_run_only",
          ranTool: false
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        screenshotsCaptured: false,
        softwareActionsExecuted: false
      }
    },
    null,
    2
  ),
  "utf8"
);

const builderResult = runNodeScript("create-all-software-coverage-enrollment-follow-up-receipt-builder.mjs", [
  "--goal",
  "Build a teacher receipt builder for enrollment follow-up rows.",
  "--plan",
  planPath,
  "--batch",
  batchPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const smallBatchBuilderResult = runNodeScript("create-all-software-coverage-enrollment-follow-up-receipt-builder.mjs", [
  "--goal",
  "Build a small-batch teacher receipt builder for enrollment follow-up rows.",
  "--plan",
  planPath,
  "--max-rows",
  "1",
  "--output-dir",
  join(smokeRoot, "small-batch-builder")
]);
const builder = readJson(builderResult.builderPath);
const smallBatchBuilder = readJson(smallBatchBuilderResult.builderPath);
const smallBatchReceiptTemplate = readJson(smallBatchBuilderResult.receiptTemplatePath);
const smallBatchHtml = readFileSync(smallBatchBuilderResult.htmlPath, "utf8");
const receiptTemplate = readJson(builderResult.receiptTemplatePath);
const html = readFileSync(builderResult.htmlPath, "utf8");
const mcpServerText = readFileSync(join(pluginRoot, "scripts", "mcp-server.mjs"), "utf8");

const checks = [
  check(
    "Enrollment follow-up receipt builder writes HTML, packet, and receipt template without running tools",
    builder.format === "transparent_ai_all_software_coverage_enrollment_follow_up_receipt_builder_v1" &&
      builder.reviewRows.length === 2 &&
      existsSync(builderResult.htmlPath) &&
      html.includes("Coverage Enrollment Follow-Up Receipt Builder") &&
      html.includes("teacher_reviewed_run_metadata_gate") &&
      html.includes("teacher_reviewed_subset_ledger") &&
      builder.locks.builderDoesNotRunBatch === true &&
      builder.locks.softwareActionsExecuted === false &&
      builder.locks.screenshotsCapturedByThisTool === false &&
      builder.reviewScope.scopeKind === "teacher_reviewed_subset_ledger" &&
      receiptTemplate.reviewScope.scopeKind === "teacher_reviewed_subset_ledger" &&
      receiptTemplate.format === "transparent_ai_all_software_coverage_enrollment_follow_up_review_receipt_v1",
    builderResult.builderPath
  ),
  check(
    "Enrollment follow-up receipt builder preserves teacher-reviewed subset scope",
    builder.reviewScope.sourceLedgerPath === "D:\\example\\source-ledger.json" &&
      builder.reviewScope.reviewedFollowUpRows === 2 &&
      builder.reviewScope.unreviewedRowsExcluded === 9 &&
      receiptTemplate.reviewScope.currentLedgerPath === "D:\\example\\reviewed-subset-ledger.json" &&
      html.includes("unreviewed rows excluded: 9"),
    builderResult.htmlPath
  ),
  check(
    "Enrollment follow-up receipt builder can produce a small teacher review batch without accepting omitted rows",
    smallBatchBuilder.reviewRows.length === 1 &&
      smallBatchBuilder.counts.totalFollowUpRows === 2 &&
      smallBatchBuilder.counts.omittedFollowUpRows === 1 &&
      smallBatchBuilder.reviewBatchScope.mode === "small_batch_teacher_review" &&
      smallBatchBuilder.reviewBatchScope.omittedRowsRemainWaitingForLaterReview === true &&
      smallBatchReceiptTemplate.reviewBatchScope.includedRows === 1 &&
      smallBatchReceiptTemplate.rowDecisions.length === 1 &&
      smallBatchHtml.includes("small_batch_teacher_review") &&
      smallBatchBuilder.locks.builderDoesNotRunBatch === true &&
      smallBatchBuilder.locks.softwareActionsExecuted === false,
    smallBatchBuilderResult.htmlPath
  ),
  check(
    "Enrollment follow-up receipt builder blocks bounded tail screenshots execution memory and completion claims",
    builder.blockedActions.includes("read_bounded_tail_from_receipt_builder") &&
      builder.blockedActions.includes("capture_screenshot_from_receipt_builder") &&
      builder.blockedActions.includes("execute_software_from_receipt_builder") &&
      builder.blockedActions.includes("claim_all_software_coverage_complete_from_receipt_builder") &&
      builder.locks.allSoftwareCoverageComplete === false &&
      builder.locks.memoryWritten === false &&
      builder.locks.nativeUniversalExecution === false,
    builderResult.builderPath
  ),
  check(
    "MCP advanced surface exposes enrollment follow-up receipt builder",
    mcpServerText.includes("create_all_software_coverage_enrollment_follow_up_receipt_builder") &&
      mcpServerText.includes("create-all-software-coverage-enrollment-follow-up-receipt-builder.mjs"),
    "mcp-server.mjs contains create_all_software_coverage_enrollment_follow_up_receipt_builder"
  )
];

const failed = checks.filter((item) => !item.pass);
const result = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_all_software_coverage_enrollment_follow_up_receipt_builder_smoke_v1",
  smokeRoot,
  paths: {
    builder: builderResult.builderPath,
    html: builderResult.htmlPath,
    receiptTemplate: builderResult.receiptTemplatePath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (failed.length > 0) process.exit(1);
