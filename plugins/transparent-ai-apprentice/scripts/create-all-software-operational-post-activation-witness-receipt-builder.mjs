#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-operational-post-activation-witness-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-operational-post-activation-witness-receipt-builder"
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

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotWriteReceipt: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotRerunWitness: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotStartTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotReadLogs: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotExecuteSoftware: true,
    scheduledTaskRegistered: false,
    scheduledTaskStarted: false,
    runnerLaunched: false,
    logContentsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    longTermMemoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (!value) continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function evidencePath(witness, key) {
  return witness.paths?.[key] || witness.evidence?.[key]?.path || "";
}

function writeReadme(path, builder) {
  const lines = [
    "# Post-Activation Witness Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Goal: ${builder.goal}`,
    `Source witness: ${builder.paths.sourceWitness}`,
    "",
    "Use the HTML page to paste the post-activation evidence paths after the teacher has executed registration outside this builder.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder packet: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Source witness: ${builder.paths.sourceWitness}`,
    "",
    "Safety boundary:",
    "- This builder only creates JSON and a command string in the browser.",
    "- It does not save the generated receipt.",
    "- It does not rerun the witness.",
    "- It does not register or start scheduled tasks, launch runners, read full logs, capture screenshots, execute software, write memory, enable rules, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher-facing post-activation witness evidence receipt generator.");
const witnessInput = readJsonInput(
  argValue("--witness", argValue("--post-activation-witness", "")),
  "--witness",
  "transparent_ai_all_software_operational_learning_post_activation_witness_v1"
);
if (!witnessInput.value) throw new Error("--witness is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-operational-post-activation-witness-receipt-builders")
  )
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const witness = witnessInput.value;
const lockState = locks();
const htmlPath = join(builderDir, "all-software-operational-post-activation-witness-receipt-builder.html");
const builderPath = join(builderDir, "all-software-operational-post-activation-witness-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "teacher-post-activation-witness-evidence-receipt-template.json");
const readmePath = join(builderDir, "ALL_SOFTWARE_OPERATIONAL_POST_ACTIVATION_WITNESS_RECEIPT_BUILDER_START_HERE.md");
const placeholders = {
  dryRunRehearsal: evidencePath(witness, "dryRunRehearsal") || "<passed-activation-dry-run-rehearsal.json>",
  registrationExecuteGate: evidencePath(witness, "registrationExecuteGate") || "<registration-execute-gate.json>",
  registrationStatus: evidencePath(witness, "registrationStatus") || "<post-activation-registration-status.json>",
  runOutputAudit: evidencePath(witness, "runOutputAudit") || "<post-activation-run-output-audit.json>",
  teacherReviewPacket: evidencePath(witness, "teacherReviewPacket") || "<post-activation-teacher-review-packet.json>",
  reviewDecisionReplayQueue:
    evidencePath(witness, "reviewDecisionReplayQueue") || "<post-activation-review-decision-replay-queue.json>",
  unattendedAudit: evidencePath(witness, "unattendedAudit") || "<post-activation-unattended-learning-audit.json>"
};
const nextWitnessCommandTemplate = commandLine("create-all-software-operational-learning-post-activation-witness.mjs", [
  ["--goal", goal],
  ["--dry-run-rehearsal", placeholders.dryRunRehearsal],
  ["--registration-execute-gate", placeholders.registrationExecuteGate],
  ["--registration-status", placeholders.registrationStatus],
  ["--run-output-audit", placeholders.runOutputAudit],
  ["--teacher-review-packet", placeholders.teacherReviewPacket],
  ["--review-decision-replay-queue", placeholders.reviewDecisionReplayQueue],
  ["--unattended-audit", placeholders.unattendedAudit],
  ["--output-dir", join(builderDir, "post-activation-witness-rerun")]
]);

const receiptTemplate = {
  format: "transparent_ai_all_software_operational_post_activation_witness_evidence_receipt_v1",
  builderId,
  sourceWitness: witnessInput.path,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "teacher_reviewed_rerun_post_activation_witness", "blocked_needs_more_evidence"],
  blockedTeacherDecisions: ["accepted", "execute_now", "register_now", "start_runner", "enable_memory", "claim_complete"],
  evidenceReviewed: false,
  evidencePaths: placeholders,
  nextWitnessCommandTemplate,
  locks: lockState
};

const builder = {
  ok: true,
  format: "transparent_ai_all_software_operational_post_activation_witness_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "post_activation_witness_receipt_builder_ready_for_teacher_use",
  sourceWitnessStatus: witness.status,
  sourceRemainingGapCount: Array.isArray(witness.remainingGaps) ? witness.remainingGaps.length : 0,
  sourceRemainingGaps: witness.remainingGaps || [],
  requiredEvidenceFormats: {
    dryRunRehearsal: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
    registrationExecuteGate: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
    registrationStatus: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
    runOutputAudit: "transparent_ai_all_software_recurring_monitor_run_output_audit_v1",
    teacherReviewPacket: "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1",
    reviewDecisionReplayQueue: "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1",
    unattendedAudit: "transparent_ai_all_software_unattended_learning_audit_v1"
  },
  evidencePaths: placeholders,
  nextWitnessCommandTemplate,
  paths: {
    builder: builderPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceWitness: witnessInput.path
  },
  blockedActions: [
    "treat_receipt_builder_as_post_activation_witness",
    "rerun_post_activation_witness_from_builder",
    "register_or_start_scheduled_task_from_builder",
    "launch_runner_from_builder",
    "read_full_logs_from_builder",
    "capture_screenshot_from_builder",
    "execute_target_software_from_builder",
    "write_memory_from_builder",
    "claim_goal_complete_from_builder"
  ],
  locks: lockState
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Post-Activation Witness Receipt Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { line-height: 1.55; }
    .panel { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); margin-top: 14px; }
    label { display: block; margin: 10px 0; font-weight: 600; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 9px; font: 14px "Segoe UI", Arial, sans-serif; }
    input[type="checkbox"] { width: 18px; height: 18px; vertical-align: middle; margin-right: 6px; }
    textarea { min-height: 220px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Post-Activation Witness Receipt Builder</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span></p>
    <section class="panel">
      <h2>Evidence paths</h2>
      <p class="muted">Paste paths after the teacher has executed registration and reviewed the resulting low-token evidence. This page does not save, validate, register, run, screenshot, or execute software.</p>
      <label>Dry-run rehearsal
        <input id="dryRunRehearsal" value="${htmlEscape(placeholders.dryRunRehearsal)}">
      </label>
      <label>Registration execute gate
        <input id="registrationExecuteGate" value="${htmlEscape(placeholders.registrationExecuteGate)}">
      </label>
      <label>Read-only registration status
        <input id="registrationStatus" value="${htmlEscape(placeholders.registrationStatus)}">
      </label>
      <label>Run-output audit
        <input id="runOutputAudit" value="${htmlEscape(placeholders.runOutputAudit)}">
      </label>
      <label>Teacher review packet
        <input id="teacherReviewPacket" value="${htmlEscape(placeholders.teacherReviewPacket)}">
      </label>
      <label>Review decision replay queue
        <input id="reviewDecisionReplayQueue" value="${htmlEscape(placeholders.reviewDecisionReplayQueue)}">
      </label>
      <label>Unattended learning audit
        <input id="unattendedAudit" value="${htmlEscape(placeholders.unattendedAudit)}">
      </label>
      <label><input id="evidenceReviewed" type="checkbox"> I reviewed these evidence paths and want to rerun only the read-only post-activation witness.</label>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="teacher_reviewed_rerun_post_activation_witness">teacher_reviewed_rerun_post_activation_witness</option>
          <option value="blocked_needs_more_evidence">blocked_needs_more_evidence</option>
        </select>
      </label>
      <p>
        <button id="generate">Generate Receipt JSON</button>
        <button id="copy" class="secondary">Copy JSON</button>
      </p>
      <textarea id="receipt" spellcheck="false"></textarea>
      <p class="muted">Rerun command appears inside the receipt JSON after generation.</p>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const receiptEl = document.getElementById("receipt");
    const ids = ["dryRunRehearsal", "registrationExecuteGate", "registrationStatus", "runOutputAudit", "teacherReviewPacket", "reviewDecisionReplayQueue", "unattendedAudit"];
    function q(value) { return '"' + String(value || "").replace(/"/g, "\\\\\\"") + '"'; }
    function buildCommand(paths) {
      return [
        "node plugins\\\\transparent-ai-apprentice\\\\scripts\\\\create-all-software-operational-learning-post-activation-witness.mjs",
        "--goal", q(builder.goal),
        "--dry-run-rehearsal", q(paths.dryRunRehearsal),
        "--registration-execute-gate", q(paths.registrationExecuteGate),
        "--registration-status", q(paths.registrationStatus),
        "--run-output-audit", q(paths.runOutputAudit),
        "--teacher-review-packet", q(paths.teacherReviewPacket),
        "--review-decision-replay-queue", q(paths.reviewDecisionReplayQueue),
        "--unattended-audit", q(paths.unattendedAudit),
        "--output-dir", q(builder.paths.builder.replace(/all-software-operational-post-activation-witness-receipt-builder\\.json$/, "post-activation-witness-rerun"))
      ].join(" ");
    }
    function currentPaths() {
      return Object.fromEntries(ids.map((id) => [id, document.getElementById(id).value.trim()]));
    }
    function buildReceipt() {
      const paths = currentPaths();
      return {
        format: "transparent_ai_all_software_operational_post_activation_witness_evidence_receipt_v1",
        builderId: builder.builderId,
        sourceWitness: builder.paths.sourceWitness,
        teacherDecision: document.getElementById("decision").value,
        evidenceReviewed: document.getElementById("evidenceReviewed").checked,
        evidencePaths: paths,
        nextWitnessCommand: buildCommand(paths),
        locks: builder.locks
      };
    }
    function render() {
      receiptEl.value = JSON.stringify(buildReceipt(), null, 2);
    }
    document.getElementById("generate").addEventListener("click", render);
    document.getElementById("copy").addEventListener("click", async () => {
      render();
      await navigator.clipboard.writeText(receiptEl.value);
    });
    render();
  </script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_post_activation_witness_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      nextWitnessCommandTemplate,
      locks: lockState
    },
    null,
    2
  )
);
