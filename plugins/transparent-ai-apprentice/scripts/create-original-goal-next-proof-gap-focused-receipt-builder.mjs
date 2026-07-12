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
    String(value || "original-goal-next-proof-gap-focused-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-next-proof-gap-focused-receipt-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
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

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function rowKey(row) {
  return [row.itemNumber, row.routeId, row.requirementId].map((part) => String(part ?? "")).join("::");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotRunCommands: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRules: true,
    builderDoesNotDeleteRollbackPoints: true,
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

function findFocusedRow(queue) {
  const items = array(queue.queueItems);
  const itemNumber = argValue("--item-number");
  const routeId = argValue("--route-id");
  const requirementId = argValue("--requirement-id");
  if (itemNumber) {
    const row = items.find((item) => Number(item.itemNumber) === Number(itemNumber));
    if (row) return row;
  }
  if (routeId) {
    const row = items.find((item) => item.routeId === routeId);
    if (row) return row;
  }
  if (requirementId) {
    const row = items.find((item) => item.requirementId === requirementId);
    if (row) return row;
  }
  const next = queue.nextProofGapSummary || {};
  return (
    items.find(
      (item) =>
        Number(item.itemNumber) === Number(next.itemNumber) ||
        (next.routeId && item.routeId === next.routeId) ||
        (next.requirementId && item.requirementId === next.requirementId)
    ) ||
    items[0] ||
    null
  );
}

function evidenceLinks(entries) {
  return array(entries)
    .map((entry) => {
      const path = entry.value || entry.path || "";
      const label = entry.label || entry.key || basename(path || "evidence");
      return {
        key: entry.key || "",
        label,
        path,
        exists: entry.exists === true || Boolean(path && existsSync(path))
      };
    })
    .filter((entry) => entry.path || entry.label);
}

function commandLine(scriptName, args = []) {
  const q = (value) => {
    const text = String(value ?? "");
    return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
  };
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map(q)
    .join(" ");
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Next Proof Gap Focused Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Focused row: ${builder.focusedRow.itemNumber}. ${builder.focusedRow.routeId}`,
    "",
    "This is a one-row teacher receipt builder for the current next proof gap. It reduces teacher review load by showing only the next missing proof row and its candidate evidence.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- Candidate evidence stays candidate-only until the teacher fills the receipt.",
    "- The teacher must provide confirmation text and a retained rollback point.",
    "- This builder does not validate receipts, run commands, register monitors, launch runners, execute software, capture screenshots, read full logs, write memory, enable rules, delete rollback points, accept technology, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const row = builder.focusedRow;
  const candidateLink = row.candidateObservedEvidencePath
    ? `<a href="${htmlEscape(fileHref(row.candidateObservedEvidencePath))}">${htmlEscape(
        basename(row.candidateObservedEvidencePath)
      )}</a>`
    : "<span>missing</span>";
  const evidence = evidenceLinks(row.evidence)
    .map((entry) =>
      entry.exists
        ? `<a href="${htmlEscape(fileHref(entry.path))}">${htmlEscape(entry.label)}</a>`
        : `<code>${htmlEscape(entry.path || entry.label)}</code>`
    )
    .join("<br>");
  const candidateEvidence = evidenceLinks(row.candidateEvidence)
    .map((entry) =>
      entry.exists
        ? `<a href="${htmlEscape(fileHref(entry.path))}">${htmlEscape(entry.label)}</a>`
        : `<code>${htmlEscape(entry.path || entry.label)}</code>`
    )
    .join("<br>");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Next Proof Gap Focused Receipt Builder</title>
  <style>
    :root { color: #18212f; background: #f6f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 980px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    section { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; padding: 16px; margin: 14px 0; }
    label { display: block; margin: 10px 0; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px; font: 14px "Segoe UI", Arial, sans-serif; }
    textarea { min-height: 250px; font-family: Consolas, monospace; }
    button { border: 1px solid #1f5f8b; background: #1f5f8b; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #1f5f8b; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .candidate { border-left: 4px solid #c47f17; background: #fff9ed; padding: 12px; }
    .lock { color: #7a2d12; font-weight: 600; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #1f5f8b; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>Next Proof Gap Focused Receipt Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Focused route:</strong> ${htmlEscape(row.routeId)} / ${htmlEscape(row.requirementId)}</p>
    <p class="lock">This page creates a one-row teacher receipt only. It does not validate, execute, register, capture, read full logs, write memory, enable rules, delete rollback points, unlock packaging, or claim completion.</p>
    <section>
      <h2>Teacher Question</h2>
      <p>${htmlEscape(row.teacherQuestion || row.teacherAction || "Review this next proof gap.")}</p>
      <p><strong>Required:</strong> ${htmlEscape(array(row.requiredTeacherInputs).join(", ") || "teacher evidence")}</p>
      <p>${evidence}</p>
    </section>
    <section class="candidate">
      <h2>Candidate Evidence Only</h2>
      <p>${candidateLink}</p>
      ${candidateEvidence ? `<p>${candidateEvidence}</p>` : ""}
      <p class="lock">${htmlEscape(array(row.teacherStillMustConfirm).join("; "))}</p>
      <button type="button" id="useCandidate" class="secondary">Use candidate path after teacher review</button>
    </section>
    <section>
      <h2>Fill Focused Receipt</h2>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_evidence">needs_teacher_evidence</option>
          <option value="teacher_evidence_attached">teacher_evidence_attached</option>
          <option value="blocked">blocked</option>
        </select>
      </label>
      <label>Observed evidence path
        <input id="observedEvidencePath" placeholder="Path to reviewed evidence or receipt">
      </label>
      <label>Teacher confirmation text
        <input id="teacherConfirmationText" placeholder="What exactly did the teacher confirm?">
      </label>
      <label>Selected numbered target
        <input id="selectedNumberedTarget" value="not_applicable">
      </label>
      <label>Retained rollback point
        <input id="retainedRollbackPoint" placeholder="Rollback point kept until teacher confirms the direction is correct">
      </label>
      <label>Teacher notes
        <input id="teacherNotes" placeholder="Blockers, corrections, or follow-up notes">
      </label>
      <div class="controls">
        <button id="generateReceipt">Generate receipt JSON</button>
        <button id="downloadReceipt" class="secondary">Download receipt JSON</button>
        <button id="copyValidation" class="secondary">Copy validation command</button>
      </div>
      <textarea id="output" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const output = document.getElementById("output");
    function buildReceipt() {
      const receipt = JSON.parse(JSON.stringify(builder.receiptTemplate));
      const row = receipt.rows[0];
      row.decision = document.getElementById("decision").value;
      row.observedEvidencePath = document.getElementById("observedEvidencePath").value.trim();
      row.teacherConfirmationText = document.getElementById("teacherConfirmationText").value.trim();
      row.selectedNumberedTarget = document.getElementById("selectedNumberedTarget").value.trim();
      row.retainedRollbackPoint = document.getElementById("retainedRollbackPoint").value.trim();
      row.teacherNotes = document.getElementById("teacherNotes").value.trim();
      receipt.generatedBy = "original_goal_next_proof_gap_focused_receipt_builder";
      receipt.builderLocks = builder.locks;
      return receipt;
    }
    function render() { output.value = JSON.stringify(buildReceipt(), null, 2); }
    document.getElementById("useCandidate").addEventListener("click", () => {
      document.getElementById("observedEvidencePath").value = builder.focusedRow.candidateObservedEvidencePath || "";
      render();
    });
    document.getElementById("generateReceipt").addEventListener("click", render);
    document.getElementById("downloadReceipt").addEventListener("click", () => {
      render();
      const blob = new Blob([output.value + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "teacher-filled-next-proof-gap-focused-receipt.json";
      link.click();
      URL.revokeObjectURL(url);
    });
    document.getElementById("copyValidation").addEventListener("click", () => {
      if (navigator.clipboard) navigator.clipboard.writeText(builder.nextValidationCommand);
      output.value = builder.nextValidationCommand;
    });
    render();
  </script>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

const goal = argValue("--goal", "Build a focused teacher receipt for the current next proof gap.");
const queueInput = readJsonInput(
  argValue("--queue", argValue("--teacher-queue", "")),
  "--queue",
  "transparent_ai_original_goal_proof_gap_teacher_queue_v1"
);
if (!queueInput.value) throw new Error("--queue is required");
const prefillInput = readJsonInput(
  argValue("--prefill", argValue("--evidence-prefill", "")),
  "--prefill",
  "transparent_ai_original_goal_proof_gap_evidence_prefill_v1"
);

const queue = queueInput.value;
const prefill = prefillInput.value;
const focused = findFocusedRow(queue);
if (!focused) throw new Error("No proof gap rows available");

const prefillRows = new Map(array(prefill?.rows).map((row) => [rowKey(row), row]));
const prefillRow = prefillRows.get(rowKey(focused)) || null;
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-next-proof-gap-focused-receipt-builders")
  )
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const builderPath = join(builderDir, "original-goal-next-proof-gap-focused-receipt-builder.json");
const htmlPath = join(builderDir, "original-goal-next-proof-gap-focused-receipt-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_NEXT_PROOF_GAP_FOCUSED_RECEIPT_BUILDER_START_HERE.md");
const receiptTemplatePath = join(builderDir, "teacher-next-proof-gap-focused-receipt-template.json");
const lockState = locks();
const focusedRow = {
  ...focused,
  candidateEvidence: array(prefillRow?.candidateEvidence),
  primaryCandidateEvidence: prefillRow?.primaryCandidateEvidence || null,
  candidateObservedEvidencePath: prefillRow?.candidateObservedEvidencePath || "",
  candidateEvidenceExists: prefillRow?.primaryCandidateEvidence?.exists === true,
  candidateEvidenceKey: prefillRow?.primaryCandidateEvidence?.key || "",
  teacherStillMustConfirm:
    array(prefillRow?.teacherStillMustConfirm).length > 0
      ? prefillRow.teacherStillMustConfirm
      : [
          "teacher must review the candidate evidence before using it",
          "teacher must provide explicit confirmation text",
          "teacher must provide a retained rollback point"
        ],
  requiresRetainedRollbackPoint: true
};

const receiptTemplate = {
  format: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_v1",
  sourceQueue: queueInput.path,
  builderId,
  focusedOnly: true,
  defaultDecision: "needs_teacher_evidence",
  allowedDecisions: ["needs_teacher_evidence", "teacher_evidence_attached", "blocked"],
  forbiddenDecisions: ["accepted", "rule_enabled", "technology_accepted", "goal_complete"],
  rows: [
    {
      itemNumber: focusedRow.itemNumber,
      routeId: focusedRow.routeId,
      requirementId: focusedRow.requirementId,
      decision: "needs_teacher_evidence",
      allowedDecisions: ["needs_teacher_evidence", "teacher_evidence_attached", "blocked"],
      observedEvidencePath: "",
      teacherConfirmationText: "",
      selectedNumberedTarget: "not_applicable",
      retainedRollbackPoint: "",
      requiresRetainedRollbackPoint: true,
      teacherNotes: "",
      candidateObservedEvidencePath: focusedRow.candidateObservedEvidencePath || "",
      candidateEvidenceKey: focusedRow.candidateEvidenceKey || "",
      mustNotClaimAcceptance: true,
      mustNotRunAutomatically: true
    }
  ],
  locks: lockState
};

const nextValidationCommand = commandLine("validate-original-goal-proof-gap-teacher-queue-receipt.mjs", [
  "--queue",
  queueInput.path || "<original-goal-proof-gap-teacher-queue.json>",
  "--receipt",
  "<teacher-filled-next-proof-gap-focused-receipt.json>",
  "--output-dir",
  join("artifacts", "original-goal-proof-gap-teacher-queue-receipt-validations")
]);

const builder = {
  ok: true,
  format: "transparent_ai_original_goal_next_proof_gap_focused_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_to_fill_next_proof_gap_focused_receipt",
  sourceQueueStatus: queue.status || "",
  focusedRouteId: focusedRow.routeId,
  focusedRequirementId: focusedRow.requirementId,
  candidateEvidenceExists: focusedRow.candidateEvidenceExists,
  counts: {
    sourceQueueRows: array(queue.queueItems).length,
    focusedRows: 1,
    rowsWithCandidatePrefill: focusedRow.candidateObservedEvidencePath ? 1 : 0,
    rowsRequiringRetainedRollbackPoint: 1
  },
  focusedRow,
  receiptTemplate,
  nextValidationCommand,
  browserReceiptBuilder: {
    outputFormat: "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_v1",
    focusedOnly: true,
    generatesReceiptJsonInBrowser: true,
    downloadsReceiptJsonOnly: true,
    doesNotWriteReceiptToDisk: true,
    doesNotValidateReceipt: true,
    doesNotRunCommands: true
  },
  locks: lockState,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceQueue: queueInput.path,
    evidencePrefill: prefillInput.path
  },
  completionBoundary: {
    goalComplete: false,
    reason: "A one-row receipt can make the next manual proof route reviewable, but it cannot prove the full objective complete."
  }
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeHtml(htmlPath, builder);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_next_proof_gap_focused_receipt_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      status: builder.status,
      focusedRouteId: builder.focusedRouteId,
      focusedRequirementId: builder.focusedRequirementId,
      candidateEvidenceExists: builder.candidateEvidenceExists,
      nextValidationCommand,
      locks: lockState
    },
    null,
    2
  )
);
