#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-coverage-evidence-dossier")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-coverage-evidence-dossier"
  );
}

function readJson(path, required = false) {
  if (!path || !existsSync(path)) {
    if (required) throw new Error(`JSON file is required: ${path || "(missing)"}`);
    return null;
  }
  if (!statSync(path).isFile()) {
    if (required) throw new Error(`JSON path is not a file: ${path}`);
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJsonFile(path, value) {
  writeFileSync(path, `\uFEFF${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    dossierDoesNotRunCoverageTools: true,
    dossierDoesNotRegisterTask: true,
    dossierDoesNotLaunchRunner: true,
    dossierDoesNotExecuteTargetSoftware: true,
    dossierDoesNotCaptureScreenshots: true,
    dossierDoesNotReadFullLogs: true,
    dossierDoesNotWriteMemory: true,
    allSoftwareCoverageComplete: false,
    teacherAcceptanceRequired: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function statusBucket(status) {
  const text = String(status || "");
  if (text.includes("with_watch_evidence")) return "ready_for_teacher_coverage_review";
  if (text.includes("waiting_for_watch_evidence")) return "waiting_for_low_token_watch_evidence";
  if (text.includes("waiting_for_queue_enrollment")) return "waiting_for_queue_enrollment";
  if (text.includes("teacher_excluded")) return "teacher_excluded_or_private";
  return "needs_teacher_signal_or_exclusion";
}

function nextActionFor(row, paths) {
  const bucket = statusBucket(row.status);
  if (bucket === "ready_for_teacher_coverage_review") {
    return "Review this row in the coverage receipt before accepting coverage.";
  }
  if (bucket === "waiting_for_low_token_watch_evidence") {
    return "Run one reviewed metadata-delta or observer-queue item check for this row; do not read full logs.";
  }
  if (bucket === "waiting_for_queue_enrollment") {
    return "Promote this inventory row into the observer queue, then rerun coverage audit and ledger.";
  }
  if (bucket === "teacher_excluded_or_private") {
    return "Keep the exclusion unless the teacher changes scope.";
  }
  return "Ask the teacher for a log path, export folder, event source, manual marker, or exclusion.";
}

function coverageProofGrade(row) {
  const bucket = statusBucket(row.status);
  if (bucket === "ready_for_teacher_coverage_review" || row.readyForTeacherCoverageReview === true) {
    return "teacher_review_ready";
  }
  if (bucket === "waiting_for_low_token_watch_evidence" && row.queueItemPresent === true) {
    return "metadata_gate_ready";
  }
  if (bucket === "waiting_for_queue_enrollment") return "queue_enrollment_needed";
  if (bucket === "teacher_excluded_or_private") return "teacher_excluded_or_private";
  return "teacher_signal_needed";
}

function coverageProofQuestion(row) {
  const grade = coverageProofGrade(row);
  if (grade === "teacher_review_ready") {
    return "Does the existing compact watch evidence prove this software's low-token learning route?";
  }
  if (grade === "metadata_gate_ready") {
    return "May I run one teacher-reviewed metadata gate for this software instead of reading full logs or taking screenshots?";
  }
  if (grade === "queue_enrollment_needed") {
    return "Should this software be enrolled into the observer queue, or should it be excluded from the current scope?";
  }
  if (grade === "teacher_excluded_or_private") {
    return "Should this exclusion stay in place for the current all-software coverage claim?";
  }
  return "Which low-token signal should represent this software: log path, export folder, Windows event source, manual marker, or exclusion?";
}

function lowTokenCoverageContract(row, evidence = {}) {
  const lowTokenEvidenceKinds = array(evidence.lowTokenEvidenceKinds);
  const hasLowTokenSignal =
    lowTokenEvidenceKinds.length > 0 ||
    row.candidateLogFileCount > 0 ||
    row.candidateLogRootCount > 0 ||
    row.windowsEventLogCount > 0 ||
    row.nonLogFallbackSignalCount > 0;
  const hasQueueBinding = row.queueItemPresent === true || Boolean(evidence.queueRow);
  const hasCompactWatchEvidence = row.watchEvidenceCount > 0 || evidence.batchResult?.ranTool === true;
  const teacherReviewReady = row.readyForTeacherCoverageReview === true;
  const teacherExcluded = statusBucket(row.status) === "teacher_excluded_or_private";
  const checks = [
    {
      id: "low_token_signal_metadata",
      pass: hasLowTokenSignal,
      evidence: lowTokenEvidenceKinds
    },
    {
      id: "observer_queue_or_teacher_scope_binding",
      pass: hasQueueBinding || teacherExcluded,
      evidence: evidence.queueRow?.queueItemId || (row.queueItemPresent ? "ledger_queue_item_present" : "")
    },
    {
      id: "compact_watch_or_metadata_gate_evidence",
      pass: hasCompactWatchEvidence,
      evidence: row.watchEvidenceCount || evidence.batchResult?.status || ""
    },
    {
      id: "teacher_coverage_review_path",
      pass: teacherReviewReady || teacherExcluded,
      evidence: teacherReviewReady ? "ready_for_teacher_coverage_review" : teacherExcluded ? "teacher_excluded_or_private" : ""
    },
    {
      id: "teacher_receipt_before_completion_claim",
      pass: false,
      evidence: "required_in_separate_receipt_validation"
    },
    {
      id: "low_token_safety_locks_preserved",
      pass: true,
      evidence: "no_full_logs_no_screenshots_no_execution_no_memory"
    }
  ];
  const missingRequirements = checks.filter((check) => !check.pass).map((check) => check.id);
  let status = "coverage_contract_incomplete";
  if (teacherExcluded) status = "coverage_contract_excluded_by_teacher_scope";
  else if (hasLowTokenSignal && hasQueueBinding && hasCompactWatchEvidence && teacherReviewReady) {
    status = "coverage_contract_satisfied_pending_teacher_receipt";
  } else if (hasLowTokenSignal && hasQueueBinding && !hasCompactWatchEvidence) {
    status = "coverage_contract_metadata_gate_ready_pending_teacher_review";
  } else if (hasLowTokenSignal && !hasQueueBinding) {
    status = "coverage_contract_waiting_for_queue_binding";
  } else if (!hasLowTokenSignal) {
    status = "coverage_contract_waiting_for_teacher_signal_or_exclusion";
  }
  return {
    status,
    satisfiedBeforeTeacherReceipt: status === "coverage_contract_satisfied_pending_teacher_receipt",
    teacherExcluded,
    missingRequirements,
    checks,
    nextContractAction:
      status === "coverage_contract_satisfied_pending_teacher_receipt"
        ? "Collect or validate the teacher coverage receipt before any completion claim."
        : status === "coverage_contract_metadata_gate_ready_pending_teacher_review"
          ? "Run only a teacher-reviewed metadata gate or compact watch step; do not read full logs or capture screenshots."
          : status === "coverage_contract_waiting_for_queue_binding"
            ? "Bind this software to the observer queue or record a teacher exclusion."
            : status === "coverage_contract_excluded_by_teacher_scope"
              ? "Keep the teacher exclusion unless the teacher changes scope."
              : "Ask the teacher for a low-token source route or explicit exclusion."
  };
}

function proofLevelCounts(rows) {
  const counts = {};
  for (const row of rows) counts[row.coverageProofGrade] = (counts[row.coverageProofGrade] || 0) + 1;
  return counts;
}

function coverageContractStatusCounts(rows) {
  const counts = {};
  for (const row of rows) {
    const status = row.coverageContract?.status || "missing_coverage_contract";
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

function summarizeRows(ledger) {
  const rows = array(ledger?.rows);
  return rows.map((row) => {
    const summary = {
      ledgerNumber: row.ledgerNumber || 0,
      software: row.software || "unknown software",
      processName: row.processName || "",
      status: row.status || "",
      bucket: statusBucket(row.status),
      readyForTeacherCoverageReview: row.readyForTeacherCoverageReview === true,
      queueItemPresent: row.queueItemPresent === true,
      coverageAuditStatus: row.coverageAuditStatus || "",
      candidateLogFileCount: row.candidateLogFileCount || 0,
      candidateLogRootCount: row.candidateLogRootCount || 0,
      windowsEventLogCount: row.windowsEventLogCount || 0,
      nonLogFallbackSignalCount: row.nonLogFallbackSignalCount || 0,
      watchEvidenceCount: row.watchEvidenceCount || 0,
      nextAction: nextActionFor(row),
      coverageProofGrade: coverageProofGrade(row),
      coverageProofQuestion: coverageProofQuestion(row),
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    };
    summary.coverageContract = lowTokenCoverageContract(summary);
    return summary;
  });
}

function bucketCounts(rows) {
  const counts = {};
  for (const row of rows) counts[row.bucket] = (counts[row.bucket] || 0) + 1;
  return counts;
}

function firstRows(rows, bucket, limit) {
  return rows.filter((row) => row.bucket === bucket).slice(0, limit);
}

function realPath(value) {
  const text = String(value || "").trim();
  return text && !text.includes("<") && existsSync(text) ? resolve(text) : "";
}

function readOptionalJson(path) {
  const resolved = realPath(path);
  return resolved ? { path: resolved, value: readJson(resolved) } : { path: "", value: null };
}

function buildProofSnapshot({ dossierId, rows, sourceEvidence }) {
  const planInput = readOptionalJson(sourceEvidence.coverageEnrollmentFollowUpPlan);
  const batchInput = readOptionalJson(sourceEvidence.coverageEnrollmentFollowUpBatch);
  const planItems = array(planInput.value?.followUpItems);
  const batchResults = array(batchInput.value?.runResults);
  const queueCache = new Map();

  function queueFor(item) {
    const queuePath = realPath(item?.arguments?.queue);
    if (!queuePath) return { path: "", value: null };
    if (!queueCache.has(queuePath)) queueCache.set(queuePath, readJson(queuePath));
    return { path: queuePath, value: queueCache.get(queuePath) };
  }

  function findQueueRow(queue, item, row) {
    const rows = array(queue?.queue);
    const requested = String(item?.arguments?.item || "").trim();
    return (
      rows.find((candidate) => requested && String(candidate.queueItemId || "") === requested) ||
      rows.find((candidate) => row.software && String(candidate.software || "") === String(row.software || "")) ||
      rows.find((candidate) => row.processName && String(candidate.processName || "") === String(row.processName || "")) ||
      null
    );
  }

  const waitingRows = rows.filter(
    (row) =>
      row.bucket === "waiting_for_low_token_watch_evidence" ||
      row.bucket === "waiting_for_queue_enrollment" ||
      row.bucket === "needs_teacher_signal_or_exclusion"
  );

  const proofRows = waitingRows.map((row) => {
    const planItem =
      planItems.find((item) => item.ledgerNumber === row.ledgerNumber) ||
      planItems.find((item) => item.software === row.software) ||
      null;
    const batchResult =
      batchResults.find((item) => item.followUpId === planItem?.followUpId) ||
      batchResults.find((item) => item.software === row.software) ||
      null;
    const queueInput = queueFor(planItem);
    const queueRow = findQueueRow(queueInput.value, planItem, row);
    const lowTokenEvidenceKinds = [
      row.candidateLogFileCount > 0 ? "log_file_metadata" : "",
      row.candidateLogRootCount > 0 ? "log_root_or_folder_mtime_metadata" : "",
      row.windowsEventLogCount > 0 ? "windows_event_count_preview" : "",
      row.nonLogFallbackSignalCount > 0 ? "non_log_fallback_signal_metadata" : "",
      queueRow?.processName ? "process_window_metadata" : ""
    ].filter(Boolean);
    const blockers = [
      row.watchEvidenceCount > 0 ? "" : "missing_watch_or_compact_learning_evidence",
      batchResult?.status === "dry_run_only" ? batchResult.reason || "dry_run_only" : "",
      planItem ? "" : "missing_follow_up_plan_item",
      queueRow ? "" : "missing_matching_observer_queue_row",
      lowTokenEvidenceKinds.length > 0 ? "" : "missing_low_token_signal_metadata"
    ].filter(Boolean);
    const coverageContract = lowTokenCoverageContract(row, {
      lowTokenEvidenceKinds,
      queueRow,
      planItem,
      batchResult
    });
    return {
      ledgerNumber: row.ledgerNumber,
      software: row.software,
      processName: row.processName,
      bucket: row.bucket,
      followUpId: planItem?.followUpId || "",
      route: planItem?.route || "",
      tool: planItem?.tool || "",
      metadataGateReady: planItem?.tool === "watch_log_source_metadata_deltas" && Boolean(queueInput.path && queueRow),
      reviewedBatchRan: Boolean(batchResult?.ranTool),
      batchStatus: batchResult?.status || "not_run",
      batchReason: batchResult?.reason || "",
      queuePath: queueInput.path,
      queueItemId: queueRow?.queueItemId || "",
      queueItemMatched: Boolean(queueRow),
      coverageProofGrade: row.coverageProofGrade,
      coverageProofQuestion: row.coverageProofQuestion,
      coverageContract,
      lowTokenEvidenceKinds,
      candidateCounts: {
        candidateLogFileCount: row.candidateLogFileCount,
        candidateLogRootCount: row.candidateLogRootCount,
        windowsEventLogCount: row.windowsEventLogCount,
        nonLogFallbackSignalCount: row.nonLogFallbackSignalCount,
        watchEvidenceCount: row.watchEvidenceCount
      },
      blockers,
      nextSafeAction:
        blockers.includes("dry_run_only") || blockers.includes("blocked_until_teacher_review")
          ? "Get teacher receipt before running the metadata gate."
          : blockers.length
            ? "Resolve blockers, then rerun this proof snapshot."
            : "Ready for teacher-reviewed metadata gate or final coverage receipt.",
      proofLadder: [
        {
          step: "identify_low_token_signal",
          status: lowTokenEvidenceKinds.length > 0 ? "present" : "missing",
          evidence: lowTokenEvidenceKinds
        },
        {
          step: "bind_to_observer_queue",
          status: queueRow ? "present" : "missing",
          evidence: queueRow?.queueItemId || ""
        },
        {
          step: "collect_metadata_gate_evidence",
          status: row.watchEvidenceCount > 0 ? "present" : "waiting_for_teacher_review",
          evidence: row.watchEvidenceCount
        },
        {
          step: "teacher_coverage_receipt",
          status: "required_before_any_completion_claim",
          evidence: ""
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        proofSnapshotDoesNotRunMetadataGate: true,
        proofSnapshotDoesNotReadLogs: true,
        proofSnapshotDoesNotExecuteTargetSoftware: true,
        proofSnapshotDoesNotWriteMemory: true,
        nativeUniversalExecution: false
      }
    };
  });

  const counts = {
    waitingRows: waitingRows.length,
    proofRows: proofRows.length,
    metadataGateReadyRows: proofRows.filter((row) => row.metadataGateReady).length,
    reviewedBatchRanRows: proofRows.filter((row) => row.reviewedBatchRan).length,
    dryRunBlockedRows: proofRows.filter((row) => row.batchStatus === "dry_run_only").length,
    rowsWithQueueMatch: proofRows.filter((row) => row.queueItemMatched).length,
    rowsWithAnyLowTokenSignalMetadata: proofRows.filter((row) => row.lowTokenEvidenceKinds.length > 0).length,
    coverageContractsSatisfiedBeforeTeacherReceipt: proofRows.filter(
      (row) => row.coverageContract.satisfiedBeforeTeacherReceipt
    ).length,
    coverageContractsStillIncomplete: proofRows.filter(
      (row) => !row.coverageContract.satisfiedBeforeTeacherReceipt && !row.coverageContract.teacherExcluded
    ).length
  };

  return {
    format: "transparent_ai_original_goal_low_token_coverage_proof_snapshot_v1",
    dossierId,
    status:
      counts.waitingRows > 0 && counts.reviewedBatchRanRows === 0
        ? "waiting_for_teacher_reviewed_metadata_gate_runs"
        : counts.waitingRows > 0
          ? "waiting_for_low_token_coverage_review"
          : "all_bounded_rows_have_low_token_coverage_evidence_pending_teacher_review",
    purpose:
      "Explain the remaining all-software low-token coverage gaps using existing metadata only, so the teacher can review exact next evidence without continuous recording.",
    sourceEvidence: {
      coverageEnrollmentFollowUpPlan: planInput.path,
      coverageEnrollmentFollowUpBatch: batchInput.path,
      queuePathsRead: [...queueCache.keys()]
    },
    counts,
    proofLevelCounts: proofLevelCounts(rows),
    coverageContractStatusCounts: coverageContractStatusCounts(proofRows),
    proofRows,
    completionBoundary: {
      allSoftwareCoverageComplete: false,
      reason:
        "This proof snapshot reads only existing metadata and dry-run evidence. It does not run metadata gates, accept teacher review, or prove all software coverage complete."
    },
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      technologyAccepted: false,
      packagingGated: true,
      proofSnapshotDoesNotRunCoverageTools: true,
      proofSnapshotDoesNotRunMetadataGate: true,
      proofSnapshotDoesNotReadLogs: true,
      proofSnapshotDoesNotCaptureScreenshots: true,
      proofSnapshotDoesNotExecuteTargetSoftware: true,
      proofSnapshotDoesNotWriteMemory: true,
      allSoftwareCoverageComplete: false,
      nativeUniversalExecution: false,
      goalComplete: false
    }
  };
}

function writeHtml(path, dossier) {
  const reviewRows = dossier.nextReviewRows
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.ledgerNumber)}</td>
        <td>${htmlEscape(row.software)}</td>
        <td>${htmlEscape(row.status)}</td>
        <td>${htmlEscape(row.coverageProofGrade)}</td>
        <td>${htmlEscape(row.coverageContract?.status || "")}</td>
        <td>${htmlEscape(array(row.coverageContract?.missingRequirements).join(", "))}</td>
        <td>${htmlEscape(row.watchEvidenceCount)}</td>
        <td>${htmlEscape(row.coverageProofQuestion)}</td>
        <td>${htmlEscape(row.nextAction)}</td>
      </tr>`
    )
    .join("\n");
  const evidenceLinks = Object.entries(dossier.sourceEvidence)
    .filter(([, value]) => value)
    .map(([key, value]) => `<li>${htmlEscape(key)}: <a href="${htmlEscape(fileHref(value))}">${htmlEscape(basename(value))}</a></li>`)
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Low-Token Coverage Evidence Dossier</title>
  <style>
    :root { color: #17202a; background: #f6f8fb; font: 14px/1.45 "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1160px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 27px; letter-spacing: 0; }
    .summary, table { background: #fff; border: 1px solid #d9e2ef; border-radius: 8px; }
    .summary { padding: 15px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 9px; text-align: left; vertical-align: top; }
    th { background: #edf3f8; }
    code { background: #eef3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
    .lock { color: #596779; font-size: 13px; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Low-Token Coverage Evidence Dossier</h1>
  <section class="summary">
    <p><strong>Status:</strong> ${htmlEscape(dossier.status)}</p>
    <p><strong>Rows:</strong> ${htmlEscape(dossier.counts.ledgerRows)}; ready for teacher review: ${htmlEscape(dossier.counts.readyForTeacherCoverageReview)}; waiting for low-token evidence: ${htmlEscape(dossier.counts.waitingForLowTokenEvidence)}</p>
    <p><strong>Coverage proof grades:</strong> <code>${htmlEscape(JSON.stringify(dossier.coverageProofGradeCounts))}</code></p>
    <p><strong>Coverage contracts:</strong> <code>${htmlEscape(JSON.stringify(dossier.coverageContractStatusCounts))}</code></p>
    <p><strong>Completion boundary:</strong> ${htmlEscape(dossier.completionBoundary.reason)}</p>
    <p class="lock">This dossier reads existing metadata evidence only. It does not run coverage tools, read full logs, capture screenshots, execute software, write memory, accept coverage, unlock packaging, or claim completion.</p>
  </section>
  <h2>Source Evidence</h2>
  <ul>${evidenceLinks || "<li>No source evidence linked.</li>"}</ul>
  <h2>Next Review Rows</h2>
  <table>
    <thead><tr><th>#</th><th>Software</th><th>Status</th><th>Proof Grade</th><th>Coverage Contract</th><th>Missing Contract Requirements</th><th>Watch Evidence</th><th>Teacher Question</th><th>Next Action</th></tr></thead>
    <tbody>${reviewRows || "<tr><td colspan=\"9\">No waiting rows in this bounded ledger.</td></tr>"}</tbody>
  </table>
  <h2>Proof Snapshot</h2>
  <p><strong>Status:</strong> ${htmlEscape(dossier.proofSnapshot.status)}</p>
  <p><strong>Metadata gate ready rows:</strong> ${htmlEscape(dossier.proofSnapshot.counts.metadataGateReadyRows)} / ${htmlEscape(dossier.proofSnapshot.counts.waitingRows)}; dry-run blocked rows: ${htmlEscape(dossier.proofSnapshot.counts.dryRunBlockedRows)}</p>
  <p><strong>Contract incomplete rows:</strong> ${htmlEscape(dossier.proofSnapshot.counts.coverageContractsStillIncomplete)}</p>
  <p><a href="${htmlEscape(fileHref(dossier.paths.proofSnapshot))}">Open proof snapshot JSON</a></p>
  <h2>Next Commands</h2>
  <p><code>${htmlEscape(dossier.nextCommands.coverageEnrollmentFollowUpPlanCommand || "")}</code></p>
  <p><code>${htmlEscape(dossier.nextCommands.coverageEnrollmentFollowUpReceiptValidationCommand || "")}</code></p>
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, dossier) {
  const lines = [
    "# Original Goal Low-Token Coverage Evidence Dossier",
    "",
    `Status: ${dossier.status}`,
    `Ledger rows: ${dossier.counts.ledgerRows}`,
    `Ready for teacher coverage review: ${dossier.counts.readyForTeacherCoverageReview}`,
    `Waiting for low-token watch evidence: ${dossier.counts.waitingForLowTokenEvidence}`,
    `Coverage proof grade counts: ${JSON.stringify(dossier.coverageProofGradeCounts)}`,
    `Coverage contract status counts: ${JSON.stringify(dossier.coverageContractStatusCounts)}`,
    `Coverage contract incomplete rows: ${dossier.counts.coverageContractIncompleteRows}`,
    "",
    "This dossier consolidates existing all-software low-token coverage evidence for the original goal.",
    "",
    "It does not run coverage tools, read full logs, capture screenshots, execute target software, write memory, accept coverage, unlock packaging, or claim completion.",
    "",
    "Next commands:",
    `- Follow-up plan: ${dossier.nextCommands.coverageEnrollmentFollowUpPlanCommand || ""}`,
    `- Receipt validation: ${dossier.nextCommands.coverageEnrollmentFollowUpReceiptValidationCommand || ""}`,
    "",
    "Locks:",
    ...Object.entries(dossier.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const statusRefreshInput = argValue("--status-refresh", argValue("--refresh", ""));
if (!statusRefreshInput) {
  throw new Error("Usage: node create-original-goal-low-token-coverage-evidence-dossier.mjs --status-refresh <original-goal-current-status-refresh.json>");
}

const statusRefreshPath = resolve(statusRefreshInput);
const refresh = readJson(statusRefreshPath, true);
const paths = refresh.paths || {};
const discovered = refresh.discoveredEvidence || {};
const goal = argValue("--goal", refresh.goal || "Summarize original-goal low-token coverage evidence.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-coverage-evidence-dossiers"))
);
const dossierId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const dossierDir = join(outputRoot, dossierId);
mkdirSync(dossierDir, { recursive: true });

const ledgerInput = argValue("--ledger", paths.coverageEnrollmentLedger || discovered.coverageEnrollmentLedger || "");
const ledgerPath = ledgerInput ? resolve(ledgerInput) : "";
const ledger = ledgerPath && existsSync(ledgerPath) ? readJson(ledgerPath) : null;
const rows = summarizeRows(ledger);
const buckets = bucketCounts(rows);
const waitingRows = [
  ...firstRows(rows, "waiting_for_low_token_watch_evidence", 20),
  ...firstRows(rows, "waiting_for_queue_enrollment", 10),
  ...firstRows(rows, "needs_teacher_signal_or_exclusion", 10)
].slice(0, 40);
const readyRows = firstRows(rows, "ready_for_teacher_coverage_review", 10);
const nextReviewRows = waitingRows.length > 0 ? waitingRows : readyRows;
const dossierPath = join(dossierDir, "original-goal-low-token-coverage-evidence-dossier.json");
const proofSnapshotPath = join(dossierDir, "original-goal-low-token-coverage-proof-snapshot.json");
const htmlPath = join(dossierDir, "original-goal-low-token-coverage-evidence-dossier.html");
const readmePath = join(dossierDir, "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_EVIDENCE_DOSSIER_START_HERE.md");
const dossierLocks = locks();
const counts = {
  ledgerRows: rows.length,
  totalInventoryRows: ledger?.counts?.totalInventoryRows || rows.length,
  readyForTeacherCoverageReview: rows.filter((row) => row.readyForTeacherCoverageReview).length,
  waitingForLowTokenEvidence: buckets.waiting_for_low_token_watch_evidence || 0,
  waitingForQueueEnrollment: buckets.waiting_for_queue_enrollment || 0,
  needsTeacherSignalOrExclusion: buckets.needs_teacher_signal_or_exclusion || 0,
  teacherExcludedOrPrivate: buckets.teacher_excluded_or_private || 0,
  nextReviewRows: nextReviewRows.length,
  coverageContractSatisfiedBeforeTeacherReceipt: rows.filter(
    (row) => row.coverageContract.satisfiedBeforeTeacherReceipt
  ).length,
  coverageContractIncompleteRows: rows.filter(
    (row) => !row.coverageContract.satisfiedBeforeTeacherReceipt && !row.coverageContract.teacherExcluded
  ).length
};
const allBoundedRowsHaveCoverageEvidence =
  counts.ledgerRows > 0 &&
  counts.waitingForLowTokenEvidence === 0 &&
  counts.waitingForQueueEnrollment === 0 &&
  counts.needsTeacherSignalOrExclusion === 0;
const sourceEvidence = {
  statusRefresh: statusRefreshPath,
  coverageEnrollmentLedger: ledgerPath || "",
  coverageEnrollmentFollowUpPlan: paths.coverageEnrollmentFollowUpPlan || "",
  coverageEnrollmentFollowUpBatch: paths.coverageEnrollmentFollowUpBatch || "",
  coverageEnrollmentFollowUpReconciliation: paths.coverageEnrollmentFollowUpReconciliation || "",
  realLocalAllSoftwareLowTokenReadinessPackage: paths.realLocalAllSoftwareLowTokenReadinessPackage || "",
  coverageRolloutReceiptBuilder: paths.coverageRolloutReceiptBuilder || ""
};
const proofSnapshot = buildProofSnapshot({ dossierId, rows, sourceEvidence });

const dossier = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_coverage_evidence_dossier_v1",
  dossierId,
  createdAt: new Date().toISOString(),
  goal,
  status: allBoundedRowsHaveCoverageEvidence
    ? "bounded_rows_ready_for_teacher_coverage_review"
    : "waiting_for_low_token_coverage_evidence",
  sourceEvidence,
  counts,
  bucketCounts: buckets,
  coverageProofGradeCounts: proofLevelCounts(rows),
  coverageContractStatusCounts: coverageContractStatusCounts(rows),
  coverageContracts: rows.map((row) => ({
    ledgerNumber: row.ledgerNumber,
    software: row.software,
    processName: row.processName,
    bucket: row.bucket,
    coverageContract: row.coverageContract
  })),
  proofSnapshot,
  nextReviewRows,
  sampleReadyRows: readyRows,
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    reason:
      "This dossier summarizes bounded current evidence. Teacher review and unresolved waiting rows must close before any all-software low-token coverage claim.",
    stillRequired: [
      "resolve every waiting_for_low_token_watch_evidence row or record a teacher exclusion",
      "validate teacher-filled coverage receipts",
      "rerun coverage audit and enrollment ledger after each reviewed follow-up batch",
      "keep native universal execution as a separate proof lane"
    ]
  },
  nextCommands: {
    coverageEnrollmentFollowUpPlanCommand: paths.coverageEnrollmentLedger
      ? commandLine("create-all-software-coverage-enrollment-follow-up-plan.mjs", [
          ["--ledger", paths.coverageEnrollmentLedger],
          ["--output-dir", join(dossierDir, "coverage-enrollment-follow-up-plan")]
        ])
      : "",
    coverageEnrollmentFollowUpReceiptValidationCommand: commandLine(
      "validate-all-software-coverage-enrollment-follow-up-receipt.mjs",
      [
        ["--plan", paths.coverageEnrollmentFollowUpPlan || "<coverage-enrollment-follow-up-plan.json>"],
        ["--receipt", "<teacher-filled-coverage-enrollment-follow-up-receipt.json>"],
        ["--output-dir", join(dossierDir, "coverage-enrollment-follow-up-receipt-validation")]
      ]
    ),
    rerunDossierCommand: commandLine("create-original-goal-low-token-coverage-evidence-dossier.mjs", [
      ["--status-refresh", statusRefreshPath],
      ["--output-dir", outputRoot]
    ])
  },
  blockedClaims: [
    "claim_all_software_low_token_coverage_complete_from_dossier",
    "claim_original_goal_complete_from_dossier",
    "accept_coverage_without_teacher_receipt",
    "unlock_packaging_from_dossier"
  ],
  paths: {
    dossier: dossierPath,
    proofSnapshot: proofSnapshotPath,
    html: htmlPath,
    readme: readmePath
  },
  locks: dossierLocks
};

writeJsonFile(proofSnapshotPath, proofSnapshot);
writeJsonFile(dossierPath, dossier);
writeHtml(htmlPath, dossier);
writeReadme(readmePath, dossier);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_coverage_evidence_dossier_result_v1",
      dossierPath,
      proofSnapshotPath,
      htmlPath,
      readmePath,
      status: dossier.status,
      counts,
      completionBoundary: dossier.completionBoundary,
      locks: dossierLocks
    },
    null,
    2
  )
);
