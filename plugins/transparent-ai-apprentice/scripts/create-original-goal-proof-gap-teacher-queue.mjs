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
    String(value || "original-goal-proof-gap-teacher-queue")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-proof-gap-teacher-queue"
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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    queueDoesNotValidateReceipts: true,
    queueDoesNotRunCommands: true,
    queueDoesNotRegisterTask: true,
    queueDoesNotLaunchRunner: true,
    queueDoesNotExecuteTargetSoftware: true,
    queueDoesNotCaptureScreenshots: true,
    queueDoesNotReadFullLogs: true,
    queueDoesNotWriteMemory: true,
    queueDoesNotEnableRules: true,
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

function phaseForRoute(routeId) {
  if (routeId.includes("unattended") || routeId.includes("registration") || routeId.includes("witness")) {
    return "all_software_low_token_log_learning";
  }
  if (routeId.includes("teacher_method")) return "adaptive_teacher_method";
  if (routeId.includes("depth") || routeId.includes("spatial")) return "transparent_overlay_spatial_depth";
  return "teacher_confirmed_target_software_execution";
}

function teacherQuestion(row) {
  if (row.routeId === "unattended_monitor_audit_route") {
    return "Can this all-software low-token monitor route be reviewed for the listed software rows, or should a row stay blocked/excluded?";
  }
  if (row.routeId === "teacher_confirmed_registration_route") {
    return "Do you confirm registering the recurring monitor for the reviewed rows, with a retained rollback point?";
  }
  if (row.routeId === "post_registration_output_witness_route") {
    return "Does the bounded runner/output witness prove the monitor ran without reading full logs or capturing screenshots unnecessarily?";
  }
  if (row.routeId === "current_teacher_method_receipt_route") {
    return "Is this teacher method/profile correct for how this person teaches, including correction style and confirmation rhythm?";
  }
  if (row.routeId === "teacher_method_reuse_result_route") {
    return "Did the reused method improve the next run, or should the correction return to high-reasoning repair?";
  }
  if (row.routeId === "transparent_depth_rehearsal_receipt_route") {
    return "Does the transparent sketch depth rehearsal correctly cover 2D, perspective, and 3D depth intent?";
  }
  if (row.routeId === "spatial_target_to_execution_gate_route") {
    return "Which single numbered overlay/spatial target is confirmed for later execution-gate preparation?";
  }
  return "Do you approve exactly one reviewed target for a gated target-software execution attempt with rollback retained?";
}

function blockedTransitions(row) {
  const base = [
    "accepted",
    "rule_enabled",
    "technology_accepted",
    "packaging_unlocked",
    "goal_complete_claim"
  ];
  if (row.risk?.matchedHighRiskMarkers?.length > 0 || row.blockedUntilTeacher) {
    return [
      ...base,
      "auto_run_command",
      "register_schedule",
      "launch_runner",
      "capture_screenshot",
      "execute_target_software",
      "write_long_term_memory"
    ];
  }
  return base;
}

function receiptRow(row, index) {
  return {
    itemNumber: index + 1,
    routeId: row.routeId,
    requirementId: row.requirementId,
    decision: "needs_teacher_evidence",
    allowedDecisions: ["needs_teacher_evidence", "teacher_evidence_attached", "blocked"],
    observedEvidencePath: "",
    teacherConfirmationText: "",
    selectedNumberedTarget: row.routeId.includes("spatial") || row.routeId.includes("execution") ? "" : "not_applicable",
    retainedRollbackPoint: row.routeId.includes("execution") || row.routeId.includes("registration") ? "" : "not_applicable",
    teacherNotes: "",
    mustNotClaimAcceptance: true,
    mustNotRunAutomatically: true
  };
}

function nextProofGapSummary(queueItems, queuePath, htmlPath, receiptTemplatePath, receiptValidationCommandTemplate) {
  const next = queueItems[0] || null;
  if (!next) {
    return {
      status: "no_missing_proof_queue_items",
      itemNumber: null,
      phase: "",
      requirementId: "",
      routeId: "",
      teacherQuestion: "",
      requiredTeacherInputs: [],
      evidencePaths: [],
      verificationCommandTemplate: "",
      receiptValidationCommandTemplate,
      queuePath,
      htmlPath,
      receiptTemplatePath,
      blockedTransitions: []
    };
  }
  return {
    status: "next_teacher_evidence_required",
    itemNumber: next.itemNumber,
    phase: next.phase,
    requirementId: next.requirementId,
    routeId: next.routeId,
    title: next.title,
    teacherQuestion: next.teacherQuestion,
    requiredTeacherInputs: next.requiredTeacherInputs,
    evidencePaths: next.evidence
      .filter((entry) => entry.exists && entry.value)
      .map((entry) => ({
        key: entry.key,
        label: entry.label,
        path: entry.value,
        basename: entry.basename
      })),
    verificationCommandTemplate: next.verificationCommandTemplate,
    receiptValidationCommandTemplate,
    queuePath,
    htmlPath,
    receiptTemplatePath,
    blockedUntilTeacher: next.blockedUntilTeacher,
    highRiskMarkers: next.highRiskMarkers,
    blockedTransitions: next.blockedTransitions,
    locks: {
      reviewOnly: true,
      executeNow: false,
      registerNow: false,
      captureNow: false,
      writeMemoryNow: false,
      claimGoalCompleteNow: false
    }
  };
}

function writeHtml(path, queue) {
  const rows = queue.queueItems
    .map((item) => {
      const evidence = item.evidence
        .map((entry) =>
          entry.exists
            ? `<a href="${htmlEscape(fileHref(entry.value))}">${htmlEscape(entry.label)}</a>`
            : `<code>${htmlEscape(entry.value || entry.label)}</code>`
        )
        .join("<br>");
      return `<tr>
        <td>${htmlEscape(item.itemNumber)}</td>
        <td>${htmlEscape(item.phase)}</td>
        <td>${htmlEscape(item.routeId)}</td>
        <td>${htmlEscape(item.teacherQuestion)}</td>
        <td>${htmlEscape(item.requiredTeacherInputs.join(", "))}</td>
        <td>${evidence}</td>
        <td><code>${htmlEscape(item.verificationCommandTemplate)}</code></td>
        <td>${htmlEscape(item.blockedTransitions.join(", "))}</td>
      </tr>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Proof Gap Teacher Queue</title>
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
  <h1>Original Goal Proof Gap Teacher Queue</h1>
  <p>Status: <code>${htmlEscape(queue.status)}</code>; queue items: <code>${htmlEscape(queue.counts.queueItems)}</code>; high-risk gated items: <code>${htmlEscape(queue.counts.highRiskGatedItems)}</code>.</p>
  <p class="lock">This queue tells the teacher what evidence to provide next. It does not validate receipts, run commands, register schedules, launch runners, capture screenshots, execute software, write memory, enable rules, unlock packaging, or claim completion.</p>
  <p>Receipt template: <a href="${htmlEscape(fileHref(queue.paths.receiptTemplate))}">${htmlEscape(queue.paths.receiptTemplate)}</a></p>
  <table>
    <thead><tr><th>#</th><th>Phase</th><th>Route</th><th>Teacher Question</th><th>Required Inputs</th><th>Evidence</th><th>Verification Template</th><th>Blocked Transitions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, queue) {
  const lines = [
    "# Original Goal Proof Gap Teacher Queue",
    "",
    `Status: ${queue.status}`,
    `Queue items: ${queue.counts.queueItems}`,
    `High-risk gated items: ${queue.counts.highRiskGatedItems}`,
    "",
    "Use this after the proof gap closure pack. It turns each missing-proof route into a numbered teacher question, required evidence fields, and a verification command template.",
    "",
    "Queue:",
    ...queue.queueItems.map(
      (item) => `- ${item.itemNumber}. ${item.phase}: ${item.routeId}; ${item.teacherQuestion}`
    ),
    "",
    `Receipt template: ${queue.paths.receiptTemplate}`,
    "",
    "Locks:",
    ...Object.entries(queue.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const closurePackInput = argValue("--closure-pack", "");
if (!closurePackInput) {
  throw new Error("Usage: node create-original-goal-proof-gap-teacher-queue.mjs --closure-pack <closure-pack.json> [--output-dir <dir>]");
}

const closurePackPath = resolve(closurePackInput);
const closurePack = readJson(closurePackPath, true);
const goal = argValue("--goal", "Original goal proof gap teacher queue.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-proof-gap-teacher-queues"))
);
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const queueDir = join(outputRoot, queueId);
mkdirSync(queueDir, { recursive: true });

const queueItems = array(closurePack.closureRoutes).map((row, index) => ({
  itemNumber: index + 1,
  phase: phaseForRoute(row.routeId || ""),
  requirementId: row.requirementId || "",
  missingProof: row.missingProof || "",
  routeId: row.routeId || "",
  title: row.title || "",
  teacherAction: row.teacherAction || "",
  teacherQuestion: teacherQuestion(row),
  requiredTeacherInputs: array(row.requiredTeacherInputs),
  evidence: array(row.evidence).map((entry) => ({
    key: entry.key || "",
    label: entry.label || entry.key || "",
    value: entry.value || "",
    exists: entry.exists === true,
    basename: entry.basename || (entry.value && existsSync(entry.value) ? basename(entry.value) : "")
  })),
  verificationCommandTemplate: row.commandTemplate || "",
  blockedUntilTeacher: row.blockedUntilTeacher === true,
  highRiskMarkers: array(row.risk?.matchedHighRiskMarkers),
  blockedTransitions: blockedTransitions(row),
  receiptRequirement: receiptRow(row, index)
}));

const queuePath = join(queueDir, "original-goal-proof-gap-teacher-queue.json");
const htmlPath = join(queueDir, "original-goal-proof-gap-teacher-queue.html");
const readmePath = join(queueDir, "ORIGINAL_GOAL_PROOF_GAP_TEACHER_QUEUE_START_HERE.md");
const receiptTemplatePath = join(queueDir, "original-goal-proof-gap-teacher-queue-receipt.template.json");
const receiptValidationCommandTemplate = `node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-proof-gap-teacher-queue-receipt.mjs --queue "${queuePath}" --receipt "<teacher-filled-original-goal-proof-gap-teacher-queue-receipt.json>" --output-dir "${join(queueDir, "receipt-validation")}"`;

const receiptTemplate = {
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_v1",
  sourceQueue: queuePath,
  defaultDecision: "needs_teacher_evidence",
  allowedDecisions: ["needs_teacher_evidence", "teacher_evidence_attached", "blocked"],
  forbiddenDecisions: ["accepted", "rule_enabled", "technology_accepted", "goal_complete"],
  rows: queueItems.map((item) => item.receiptRequirement),
  locks: locks()
};

const queue = {
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_v1",
  queueId,
  status: queueItems.length > 0 ? "waiting_for_teacher_evidence_queue_receipt" : "no_missing_proof_queue_items",
  sourceEvidence: {
    closurePack: closurePackPath,
    statusRefresh: closurePack.sourceEvidence?.statusRefresh || "",
    proofLedger: closurePack.sourceEvidence?.proofLedger || ""
  },
  paths: {
    queue: queuePath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    receiptValidationCommandTemplate
  },
  counts: {
    queueItems: queueItems.length,
    highRiskGatedItems: queueItems.filter((item) => item.highRiskMarkers.length > 0).length,
    blockedUntilTeacherItems: queueItems.filter((item) => item.blockedUntilTeacher).length,
    receiptRows: receiptTemplate.rows.length
  },
  nextProofGapSummary: nextProofGapSummary(
    queueItems,
    queuePath,
    htmlPath,
    receiptTemplatePath,
    receiptValidationCommandTemplate
  ),
  queueItems,
  completionBoundary: {
    completionAllowed: false,
    reason: "The queue asks for teacher evidence and preserves command templates; it does not supply receipts, validate them, execute commands, or prove completion."
  },
  locks: locks()
};

writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeHtml(htmlPath, queue);
writeReadme(readmePath, queue);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_gap_teacher_queue_result_v1",
      queueId,
      queuePath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      receiptValidationCommandTemplate,
      status: queue.status,
      counts: queue.counts,
      locks: queue.locks
    },
    null,
    2
  )
);
