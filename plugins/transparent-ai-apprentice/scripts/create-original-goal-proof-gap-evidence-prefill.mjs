#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-proof-gap-evidence-prefill")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-proof-gap-evidence-prefill"
  );
}

function readJson(path, required = false) {
  if (!path || !existsSync(path)) {
    if (required) throw new Error(`JSON file is required: ${path || "(missing)"}`);
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
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

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    prefillDoesNotClaimEvidenceAccepted: true,
    prefillDoesNotValidateReceipt: true,
    prefillDoesNotRunCommands: true,
    prefillDoesNotRegisterTask: true,
    prefillDoesNotLaunchRunner: true,
    prefillDoesNotExecuteTargetSoftware: true,
    prefillDoesNotCaptureScreenshots: true,
    prefillDoesNotReadFullLogs: true,
    prefillDoesNotWriteMemory: true,
    prefillDoesNotEnableRules: true,
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

function rowNeedsNumberedTarget(row) {
  return (
    row.receiptRequirement?.selectedNumberedTarget === "" ||
    row.routeId === "spatial_target_to_execution_gate_route" ||
    row.routeId === "teacher_confirmed_execution_gate_route"
  );
}

function rowNeedsRollback(row) {
  return (
    row.receiptRequirement?.retainedRollbackPoint === "" ||
    row.routeId === "teacher_confirmed_registration_route" ||
    row.routeId === "teacher_confirmed_execution_gate_route" ||
    row.phase === "teacher_confirmed_target_software_execution"
  );
}

function rankEvidence(entries) {
  return [...(Array.isArray(entries) ? entries : [])].sort((a, b) => {
    const aExists = a.exists ? 0 : 1;
    const bExists = b.exists ? 0 : 1;
    if (aExists !== bExists) return aExists - bExists;
    return String(a.label || a.key || "").localeCompare(String(b.label || b.key || ""));
  });
}

function teacherStillMustConfirm(row, candidateEvidence) {
  const needs = [
    "teacher must review the candidate evidence and explicitly confirm whether it proves this row"
  ];
  if (rowNeedsNumberedTarget(row)) needs.push("teacher must provide one selected numbered target");
  if (rowNeedsRollback(row)) needs.push("teacher must provide a retained rollback point");
  if (!candidateEvidence.some((entry) => entry.exists)) needs.push("teacher must attach an observed evidence path");
  return needs;
}

function candidateRow(row) {
  const candidateEvidence = rankEvidence(row.evidence);
  const primary = candidateEvidence.find((entry) => entry.exists) || candidateEvidence[0] || null;
  const draftReceiptRow = {
    ...(row.receiptRequirement || {}),
    decision: "needs_teacher_evidence",
    observedEvidencePath: "",
    candidateObservedEvidencePath: primary?.exists ? primary.value : "",
    candidateEvidenceKey: primary?.key || "",
    teacherConfirmationText: "",
    selectedNumberedTarget: rowNeedsNumberedTarget(row) ? "" : "not_applicable",
    retainedRollbackPoint: rowNeedsRollback(row) ? "" : "not_applicable",
    teacherNotes: "",
    mustNotClaimAcceptance: true,
    mustNotRunAutomatically: true
  };
  return {
    itemNumber: row.itemNumber,
    phase: row.phase,
    requirementId: row.requirementId,
    routeId: row.routeId,
    title: row.title,
    missingProof: row.missingProof,
    teacherQuestion: row.teacherQuestion,
    requiredTeacherInputs: row.requiredTeacherInputs || [],
    candidateEvidence,
    primaryCandidateEvidence: primary,
    candidateObservedEvidencePath: primary?.exists ? primary.value : "",
    teacherStillMustConfirm: teacherStillMustConfirm(row, candidateEvidence),
    needsNumberedTarget: rowNeedsNumberedTarget(row),
    needsRollbackPoint: rowNeedsRollback(row),
    draftReceiptRow,
    blockedTransitions: row.blockedTransitions || []
  };
}

function nextPrefillSummary(rows, packetPath, htmlPath, draftPath) {
  const first = rows[0] || null;
  if (!first) {
    return {
      status: "no_prefill_rows",
      itemNumber: null,
      phase: "",
      requirementId: "",
      routeId: "",
      candidateObservedEvidencePath: "",
      candidateEvidenceExists: false,
      teacherStillMustConfirm: [],
      prefillPath: packetPath,
      htmlPath,
      candidateReceiptDraftPath: draftPath
    };
  }
  return {
    status: "candidate_evidence_prefilled_waiting_for_teacher_review",
    itemNumber: first.itemNumber,
    phase: first.phase,
    requirementId: first.requirementId,
    routeId: first.routeId,
    title: first.title,
    teacherQuestion: first.teacherQuestion,
    candidateObservedEvidencePath: first.candidateObservedEvidencePath,
    candidateEvidenceExists: Boolean(first.candidateObservedEvidencePath && existsSync(first.candidateObservedEvidencePath)),
    candidateEvidenceKey: first.primaryCandidateEvidence?.key || "",
    teacherStillMustConfirm: first.teacherStillMustConfirm,
    needsNumberedTarget: first.needsNumberedTarget,
    needsRollbackPoint: first.needsRollbackPoint,
    prefillPath: packetPath,
    htmlPath,
    candidateReceiptDraftPath: draftPath,
    boundary:
      "Candidate evidence only. The teacher must still review the path, fill the real receipt, and run the receipt validator before any follow-up command."
  };
}

function writeReadme(path, packet) {
  const lines = [
    "# Original Goal Proof Gap Evidence Prefill",
    "",
    `Status: ${packet.status}`,
    `Rows: ${packet.counts.rows}`,
    `Rows with candidate evidence: ${packet.counts.rowsWithCandidateEvidence}`,
    `Rows still needing teacher confirmation: ${packet.counts.rowsStillNeedTeacherConfirmation}`,
    "",
    `Source queue: ${packet.paths.sourceQueue}`,
    `Prefill HTML: ${packet.paths.html}`,
    `Candidate receipt draft: ${packet.paths.candidateReceiptDraft}`,
    "",
    "This package reduces teacher effort by showing the best existing evidence path for each proof gap row.",
    "It does not mark evidence as accepted. The teacher must still review the evidence, fill the real receipt, and run the existing receipt validator.",
    "",
    "Locks:",
    ...Object.entries(packet.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  const rows = packet.rows
    .map((row) => {
      const evidence = row.candidateEvidence
        .map((entry) =>
          entry.exists
            ? `<a href="${htmlEscape(fileHref(entry.value))}">${htmlEscape(entry.label || entry.key || basename(entry.value))}</a>`
            : `<code>${htmlEscape(entry.value || entry.label || entry.key || "")}</code>`
        )
        .join("<br>");
      return `<tr>
        <td>${htmlEscape(row.itemNumber)}</td>
        <td>${htmlEscape(row.phase)}</td>
        <td>${htmlEscape(row.routeId)}</td>
        <td>${htmlEscape(row.teacherQuestion)}</td>
        <td>${evidence || "No candidate evidence found"}</td>
        <td><code>${htmlEscape(row.candidateObservedEvidencePath || "")}</code></td>
        <td>${htmlEscape(row.teacherStillMustConfirm.join("; "))}</td>
      </tr>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Proof Gap Evidence Prefill</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1320px; margin: 0 auto; padding: 26px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e2ef; }
    th, td { padding: 9px; border-bottom: 1px solid #e3eaf3; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #edf3f8; color: #2d4058; }
    code { background: #eef3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
    .lock { color: #58677a; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Proof Gap Evidence Prefill</h1>
  <p>Status: <code>${htmlEscape(packet.status)}</code>; rows: <code>${htmlEscape(packet.counts.rows)}</code>; rows with candidate evidence: <code>${htmlEscape(packet.counts.rowsWithCandidateEvidence)}</code>.</p>
  <p class="lock">Candidates are not proof acceptance. This page does not validate, run commands, register tasks, execute software, capture screenshots, read full logs, write memory, enable rules, unlock packaging, or claim completion.</p>
  <p>Candidate receipt draft: <a href="${htmlEscape(fileHref(packet.paths.candidateReceiptDraft))}">${htmlEscape(packet.paths.candidateReceiptDraft)}</a></p>
  <table>
    <thead><tr><th>#</th><th>Phase</th><th>Route</th><th>Teacher Question</th><th>Candidate Evidence</th><th>Suggested Path</th><th>Still Needed</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

const goal = argValue("--goal", "Original goal proof gap evidence prefill");
const queuePath = resolve(argValue("--queue", ""));
const refreshPath = argValue("--refresh", "");
const outDir = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-proof-gap-evidence-prefills")));
const queue = readJson(queuePath, true);
if (queue.format !== "transparent_ai_original_goal_proof_gap_teacher_queue_v1") {
  throw new Error("queue must be transparent_ai_original_goal_proof_gap_teacher_queue_v1");
}
const refresh = refreshPath ? readJson(resolve(refreshPath), false) : null;

const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const runDir = join(outDir, runId);
mkdirSync(runDir, { recursive: true });

const rows = (queue.queueItems || []).map(candidateRow);
const candidateReceiptDraft = {
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_candidate_receipt_draft_v1",
  status: "candidate_only_waiting_for_teacher_review",
  sourceQueue: queuePath,
  rows: rows.map((row) => row.draftReceiptRow),
  note: "Candidate fields are not teacher evidence. Copy only after teacher review.",
  forbiddenDecisions: ["accepted", "execute_now", "register_now", "enable_rule", "unlock_packaging", "goal_complete"]
};

const packetPath = join(runDir, "original-goal-proof-gap-evidence-prefill.json");
const htmlPath = join(runDir, "original-goal-proof-gap-evidence-prefill.html");
const readmePath = join(runDir, "ORIGINAL_GOAL_PROOF_GAP_EVIDENCE_PREFILL_START_HERE.md");
const draftPath = join(runDir, "candidate-original-goal-proof-gap-teacher-queue-receipt-draft.json");

const packet = {
  format: "transparent_ai_original_goal_proof_gap_evidence_prefill_v1",
  status: "candidate_only_waiting_for_teacher_review",
  goal,
  sourceEvidence: {
    queue: queuePath,
    refresh: refreshPath ? resolve(refreshPath) : "",
    proofLedger: refresh?.paths?.originalGoalProofLedger || ""
  },
  paths: {
    sourceQueue: queuePath,
    sourceRefresh: refreshPath ? resolve(refreshPath) : "",
    prefill: packetPath,
    html: htmlPath,
    readme: readmePath,
    candidateReceiptDraft: draftPath,
    realReceiptBuilder: refresh?.paths?.originalGoalProofGapTeacherQueueReceiptBuilderHtml || "",
    realReceiptValidationCommandTemplate: refresh?.paths?.originalGoalProofGapTeacherQueueReceiptValidationCommandTemplate || queue.paths?.receiptValidationCommandTemplate || ""
  },
  counts: {
    rows: rows.length,
    rowsWithCandidateEvidence: rows.filter((row) => row.candidateEvidence.some((entry) => entry.exists)).length,
    rowsStillNeedTeacherConfirmation: rows.length,
    rowsNeedingNumberedTarget: rows.filter((row) => row.needsNumberedTarget).length,
    rowsNeedingRollback: rows.filter((row) => row.needsRollbackPoint).length
  },
  nextProofGapEvidencePrefillSummary: nextPrefillSummary(rows, packetPath, htmlPath, draftPath),
  rows,
  locks: locks()
};

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(draftPath, `${JSON.stringify(candidateReceiptDraft, null, 2)}\n`, "utf8");
writeHtml(htmlPath, packet);
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_evidence_prefill_result_v1",
      prefillPath: packetPath,
      htmlPath,
      readmePath,
      candidateReceiptDraftPath: draftPath,
      rows: packet.counts.rows,
      rowsWithCandidateEvidence: packet.counts.rowsWithCandidateEvidence,
      rowsStillNeedTeacherConfirmation: packet.counts.rowsStillNeedTeacherConfirmation
    },
    null,
    2
  )
);
