#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "original-goal-low-token-coverage-dossier-receipt-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args, options = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (options.expectFailure) return result;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function hasUtf8Bom(path) {
  const bytes = readFileSync(path);
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function powershellDefaultCanParseJson(path) {
  if (process.platform !== "win32") return true;
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "$p=$env:TRANSPARENT_AI_JSON_PATH; try { Get-Content -LiteralPath $p -Raw | ConvertFrom-Json | Out-Null; 'ok' } catch { Write-Error $_.Exception.Message; exit 1 }"
    ],
    { encoding: "utf8", timeout: 30000, env: { ...process.env, TRANSPARENT_AI_JSON_PATH: path } }
  );
  return result.status === 0;
}

const ledgerPath = join(smokeRoot, "all-software-coverage-enrollment-ledger.json");
const refreshPath = join(smokeRoot, "original-goal-current-status-refresh.json");
writeFileSync(
  ledgerPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_ledger_v1",
      counts: {
        totalInventoryRows: 5,
        ledgerRows: 5,
        enrolledWithWatchEvidence: 1,
        enrolledWaitingForWatchEvidence: 3,
        waitingForQueueEnrollment: 1
      },
      rows: [
        {
          ledgerNumber: 1,
          software: "ReadyApp",
          processName: "ReadyApp",
          status: "enrolled_log_route_with_watch_evidence",
          readyForTeacherCoverageReview: true,
          queueItemPresent: true,
          coverageAuditStatus: "covered_with_log_route_and_watch_evidence",
          candidateLogFileCount: 1,
          watchEvidenceCount: 1
        },
        {
          ledgerNumber: 2,
          software: "WaitingLogApp",
          processName: "WaitingLogApp",
          status: "enrolled_log_route_waiting_for_watch_evidence",
          readyForTeacherCoverageReview: false,
          queueItemPresent: true,
          coverageAuditStatus: "covered_with_log_route",
          candidateLogFileCount: 1,
          watchEvidenceCount: 0
        },
        {
          ledgerNumber: 3,
          software: "WaitingQueueApp",
          processName: "WaitingQueueApp",
          status: "waiting_for_queue_enrollment",
          readyForTeacherCoverageReview: false,
          queueItemPresent: false,
          coverageAuditStatus: "waiting_for_queue_enrollment",
          candidateLogRootCount: 1,
          watchEvidenceCount: 0
        },
        {
          ledgerNumber: 4,
          software: "NeedsSignalApp",
          processName: "NeedsSignalApp",
          status: "needs_teacher_signal_or_exclusion",
          readyForTeacherCoverageReview: false,
          queueItemPresent: false,
          coverageAuditStatus: "needs_teacher_signal_or_exclusion",
          nonLogFallbackSignalCount: 1,
          watchEvidenceCount: 0
        },
        {
          ledgerNumber: 5,
          software: "极智浏览器",
          processName: "",
          status: "enrolled_non_log_fallback_waiting_for_watch_evidence",
          readyForTeacherCoverageReview: false,
          queueItemPresent: true,
          coverageAuditStatus: "covered_with_non_log_fallback_route",
          nonLogFallbackSignalCount: 1,
          watchEvidenceCount: 0
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  refreshPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_original_goal_current_status_refresh_v1",
      goal: "Review low-token all-software coverage dossier receipts.",
      paths: {
        coverageEnrollmentLedger: ledgerPath,
        coverageEnrollmentFollowUpPlan: join(smokeRoot, "follow-up-plan.json"),
        realLocalAllSoftwareLowTokenReadinessPackage: join(smokeRoot, "readiness.json")
      },
      discoveredEvidence: {},
      refreshedEvidence: {},
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const dossierResult = runNodeScript("create-original-goal-low-token-coverage-evidence-dossier.mjs", [
  "--status-refresh",
  refreshPath,
  "--output-dir",
  join(smokeRoot, "dossier")
]);
const builderResult = runNodeScript("create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs", [
  "--dossier",
  dossierResult.dossierPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const html = readFileSync(builderResult.htmlPath, "utf8");
const template = readJson(builderResult.receiptTemplatePath);

const matchedReceiptPath = join(smokeRoot, "matched-receipt.json");
const matchedReceipt = {
  ...template,
  decision: "teacher_reviewed_low_token_coverage_dossier",
  rowDecisions: template.rowDecisions.map((row) => ({
    ...row,
    teacherDecision:
      row.bucket === "waiting_for_queue_enrollment"
        ? "teacher_reviewed_promote_to_observer_queue"
        : row.bucket === "needs_teacher_signal_or_exclusion"
          ? "teacher_reviewed_prepare_signal_question"
          : row.bucket === "ready_for_teacher_coverage_review"
            ? "teacher_reviewed_ready_coverage_row"
            : "teacher_reviewed_collect_metadata_follow_up",
    evidenceReviewed: true,
    teacherNote: "reviewed in smoke"
  }))
};
writeFileSync(matchedReceiptPath, `${JSON.stringify(matchedReceipt, null, 2)}\n`, "utf8");
const matchedResult = runNodeScript("validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  matchedReceiptPath,
  "--output-dir",
  join(smokeRoot, "matched-validation")
]);
const matchedValidation = readJson(matchedResult.validationPath);
const matchedSubsetLedger = readJson(matchedValidation.paths.reviewedFollowUpLedger);

const forbiddenReceiptPath = join(smokeRoot, "forbidden-receipt.json");
const forbiddenReceipt = {
  ...template,
  decision: "teacher_reviewed_low_token_coverage_dossier",
  rowDecisions: template.rowDecisions.map((row, index) => ({
    ...row,
    teacherDecision: index === 0 ? "claim_complete" : row.teacherDecision,
    evidenceReviewed: true
  }))
};
writeFileSync(forbiddenReceiptPath, `${JSON.stringify(forbiddenReceipt, null, 2)}\n`, "utf8");
const forbiddenResult = runNodeScript(
  "validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs",
  [
    "--builder",
    builderResult.builderPath,
    "--receipt",
    forbiddenReceiptPath,
    "--output-dir",
    join(smokeRoot, "forbidden-validation")
  ],
  { expectFailure: true }
);
const forbiddenResultJson = JSON.parse(forbiddenResult.stdout);
const forbiddenValidation = readJson(forbiddenResultJson.validationPath);

const incompleteReceiptPath = join(smokeRoot, "incomplete-receipt.json");
writeFileSync(incompleteReceiptPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
const incompleteResult = runNodeScript("validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  incompleteReceiptPath,
  "--output-dir",
  join(smokeRoot, "incomplete-validation")
]);
const incompleteValidation = readJson(incompleteResult.validationPath);

const checks = [
  {
    name: "Low-token coverage dossier receipt builder creates teacher review rows without running tools",
    pass:
      builder.format === "transparent_ai_original_goal_low_token_coverage_dossier_receipt_builder_v1" &&
      builder.counts.reviewRows >= 4 &&
      builder.reviewRows.some((row) => row.software === "WaitingLogApp") &&
      builder.reviewRows.some((row) => row.software === "极智浏览器") &&
      existsSync(builderResult.htmlPath) &&
      html.includes("Low-Token Coverage Dossier Receipt Builder") &&
      builder.locks.builderDoesNotRunFollowUpPlan === true &&
      builder.locks.builderDoesNotReadLogs === true &&
      builder.locks.browserCanDownloadGeneratedReceipt === true &&
      builder.locks.browserCanCopyGeneratedReceipt === true &&
      builder.locks.builderUsesSafeTextRendering === true &&
      builder.locks.browserCanBulkApplyRecommendedReviewDecisions === true &&
      builder.locks.browserCanResetRowsToNeedsTeacherReview === true &&
      builder.locks.browserCanCaptureTeacherNotes === true &&
      builder.locks.nativeUniversalExecution === false,
    evidence: builderResult.builderPath
  },
  {
    name: "Low-token coverage receipt builder supports browser download/copy and safe text rendering",
    pass:
      html.includes("Download receipt JSON") &&
      html.includes("Copy JSON") &&
      html.includes("textContent") &&
      !html.includes(".innerHTML") &&
      builder.blockedActions.includes("render_untrusted_software_names_with_inner_html"),
    evidence: builderResult.htmlPath
  },
  {
    name: "Low-token coverage receipt builder supports teacher-controlled bulk review helpers",
    pass:
      html.includes("Set waiting rows to metadata follow-up") &&
      html.includes("Set ready rows to coverage review") &&
      html.includes("Reset all rows to needs teacher review") &&
      html.includes("data-ledger-note") &&
      html.includes("setRowsByBucket") &&
      builder.blockedActions.includes("auto_apply_bulk_decisions_without_teacher_click") &&
      builder.blockedActions.includes("save_bulk_decisions_without_receipt_validation"),
    evidence: builderResult.htmlPath
  },
  {
    name: "Receipt builder JSON and template are UTF-8 BOM safe for default Windows PowerShell parsing",
    pass:
      hasUtf8Bom(builderResult.builderPath) &&
      hasUtf8Bom(builderResult.receiptTemplatePath) &&
      powershellDefaultCanParseJson(builderResult.builderPath) &&
      powershellDefaultCanParseJson(builderResult.receiptTemplatePath),
    evidence: JSON.stringify({
      builder: builderResult.builderPath,
      template: builderResult.receiptTemplatePath
    })
  },
  {
    name: "Matched dossier receipt prepares only review-only follow-up commands",
    pass:
      matchedValidation.format === "transparent_ai_original_goal_low_token_coverage_dossier_receipt_validation_v1" &&
      matchedValidation.status === "validated_ready_for_review_only_low_token_follow_up" &&
      matchedValidation.readyFollowUpRowCount >= 3 &&
      matchedValidation.paths.reviewedFollowUpLedger &&
      matchedSubsetLedger.rows.length === matchedValidation.readyFollowUpRowCount &&
      matchedSubsetLedger.counts.unreviewedRowsExcluded >= 1 &&
      matchedSubsetLedger.subsetPurpose.includes("teacher reviewed") &&
      matchedValidation.nextReviewCommands.some((command) =>
        command.commandLine.includes("create-all-software-coverage-enrollment-follow-up-plan.mjs") &&
        command.commandLine.includes(matchedValidation.paths.reviewedFollowUpLedger) &&
        !command.commandLine.includes(`${ledgerPath}"`)
      ) &&
      matchedValidation.locks.followUpPlanInvoked === false &&
      matchedValidation.locks.batchRunnerInvoked === false &&
      matchedValidation.locks.goalComplete === false,
    evidence: matchedResult.validationPath
  },
  {
    name: "Forbidden dossier receipt decisions fail closed before follow-up commands",
    pass:
      forbiddenResult.status !== 0 &&
      forbiddenValidation.status === "blocked" &&
      forbiddenValidation.validationDecision === "blocked_for_forbidden_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blocked === true &&
      forbiddenValidation.locks.allSoftwareCoverageComplete === false,
    evidence: forbiddenResultJson.validationPath
  },
  {
    name: "Incomplete dossier receipt stays in teacher review",
    pass:
      incompleteValidation.status === "waiting_for_teacher_low_token_coverage_review" &&
      incompleteValidation.validationDecision === "needs_teacher_review" &&
      incompleteValidation.nextReviewCommands.length === 0 &&
      incompleteValidation.locks.memoryWritten === false,
    evidence: incompleteResult.validationPath
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_low_token_coverage_dossier_receipt_smoke_v1",
      smokeRoot,
      paths: {
        dossier: dossierResult.dossierPath,
        builder: builderResult.builderPath,
        matchedValidation: matchedResult.validationPath,
        forbiddenValidation: forbiddenResult.validationPath,
        incompleteValidation: incompleteResult.validationPath
      },
      checks
    },
    null,
    2
  )
);

if (failed.length > 0) process.exit(1);
