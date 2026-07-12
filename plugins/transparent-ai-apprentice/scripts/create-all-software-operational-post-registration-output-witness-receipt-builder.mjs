#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "operational-post-registration-output-witness-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "operational-post-registration-output-witness-receipt-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "", optional = false) {
  const text = String(input || "").trim();
  if (!text) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
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

function quote(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    if (value === true) {
      parts.push(flag);
      continue;
    }
    parts.push(flag, quote(value));
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
    builderDoesNotWriteReceipt: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotRerunOutputWitness: true,
    builderDoesNotInvokeReviewedScheduledRunner: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotStartTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotWriteMemory: true,
    scheduledTaskRegisteredByBuilder: false,
    scheduledTaskStartedByBuilder: false,
    runnerLaunchedByBuilder: false,
    logContentsReadByBuilder: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    longTermMemoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareUnattendedCoverageProven: false,
    goalComplete: false
  };
}

function writeReadme(path, builder) {
  const lines = [
    "# Operational Post-Registration Output Witness Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Source output witness runner: ${builder.paths.sourceOutputWitnessRunner}`,
    `Operational scope: ${builder.operationalScope?.scopeKind || "unspecified"}`,
    "",
    "Use the HTML page to generate a teacher-filled receipt after reviewing the post-registration output witness runner evidence.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    "",
    "Safety boundary:",
    "- This builder only creates JSON and command text in the browser.",
    "- It does not save the generated receipt, validate it, rerun the output witness, invoke the reviewed scheduled runner, register/start/stop tasks, read full logs, capture screenshots, execute software, write memory, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher-facing receipt generator for a post-registration output witness run.");
const witnessInput = readJsonInput(
  argValue("--witness-runner", argValue("--output-witness", argValue("--runner", ""))),
  "--witness-runner",
  "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_v1",
  true
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "operational-post-registration-output-witness-receipt-builders")
  )
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const witness = witnessInput.value || {};
const operationalScope = witness.operationalScope || null;
const lockState = locks();
const htmlPath = join(builderDir, "operational-post-registration-output-witness-receipt-builder.html");
const builderPath = join(builderDir, "operational-post-registration-output-witness-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "teacher-post-registration-output-witness-review-receipt-template.json");
const readmePath = join(builderDir, "OPERATIONAL_POST_REGISTRATION_OUTPUT_WITNESS_RECEIPT_BUILDER_START_HERE.md");
const evidencePaths = {
  outputWitnessRunner: witnessInput.path || "<post-registration-output-witness-runner.json>",
  outputWitnessReceipt: witness.paths?.receipt || "<post-registration-output-witness-runner-receipt.json>",
  registrationStatus: witness.paths?.registrationStatus || "<registered-and-matching-recurring-monitor-status.json>",
  runOutputAudit: witness.paths?.runOutputAudit || "<post-registration-run-output-audit.json>",
  teacherReviewPacket: witness.paths?.teacherReviewPacket || "<post-registration-teacher-review-packet.json>",
  reviewDecisionReplayQueue: witness.paths?.reviewDecisionReplayQueue || "<post-registration-review-decision-replay-queue.json>",
  unattendedAudit: witness.paths?.unattendedAudit || "<post-registration-unattended-learning-audit.json>",
  dryRunRehearsal: witness.paths?.dryRunRehearsal || "<passed-operational-activation-dry-run-rehearsal.json>",
  registrationExecuteGate: witness.paths?.registrationExecuteGate || "<ready-operational-registration-execute-gate.json>"
};
const validationCommandTemplate = commandLine("validate-all-software-operational-post-registration-output-witness-receipt.mjs", [
  ["--builder", builderPath],
  ["--receipt", "<teacher-filled-post-registration-output-witness-review-receipt.json>"],
  ["--output-dir", join(builderDir, "receipt-validation")]
]);
const nextPostActivationWitnessCommandTemplate = commandLine("create-all-software-operational-learning-post-activation-witness.mjs", [
  ["--goal", goal],
  ["--dry-run-rehearsal", evidencePaths.dryRunRehearsal],
  ["--registration-execute-gate", evidencePaths.registrationExecuteGate],
  ["--registration-status", evidencePaths.registrationStatus],
  ["--run-output-audit", evidencePaths.runOutputAudit],
  ["--teacher-review-packet", evidencePaths.teacherReviewPacket],
  ["--review-decision-replay-queue", evidencePaths.reviewDecisionReplayQueue],
  ["--unattended-audit", evidencePaths.unattendedAudit],
  ["--output-dir", join(builderDir, "post-activation-witness")]
]);

const receiptTemplate = {
  format: "transparent_ai_all_software_operational_post_registration_output_witness_review_receipt_v1",
  builderId,
  sourceOutputWitnessRunner: witnessInput.path,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_reviewed_output_witness",
    "teacher_reviewed_prepare_post_activation_witness",
    "blocked_needs_more_evidence"
  ],
  blockedTeacherDecisions: ["accepted", "execute_now", "register_now", "start_runner", "enable_memory", "claim_complete"],
  evidenceReviewed: false,
  operationalScope,
  evidencePaths,
  validationCommandTemplate,
  nextPostActivationWitnessCommandTemplate,
  teacherNotes: "",
  locks: lockState
};

const builder = {
  ok: true,
  format: "transparent_ai_all_software_operational_post_registration_output_witness_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: witnessInput.value
    ? "post_registration_output_witness_receipt_builder_ready_for_teacher_use"
    : "waiting_for_post_registration_output_witness_runner_path",
  sourceOutputWitnessStatus: witness.status || "waiting_for_post_registration_output_witness_runner_path",
  sourceRunnerTriggered: witness.runnerTriggered === true,
  sourceDirectRunnerExitedZero: witness.directRunnerExitedZero === true,
  sourceEvidenceCounts: witness.evidenceCounts || {},
  operationalScope,
  requiredEvidenceFormats: {
    outputWitnessRunner: "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_v1",
    outputWitnessReceipt: "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_receipt_v1",
    registrationStatus: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
    runOutputAudit: "transparent_ai_all_software_recurring_monitor_run_output_audit_v1",
    teacherReviewPacket: "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1",
    reviewDecisionReplayQueue: "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1",
    unattendedAudit: "transparent_ai_all_software_unattended_learning_audit_v1",
    dryRunRehearsal: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
    registrationExecuteGate: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1"
  },
  evidencePaths,
  validationCommandTemplate,
  nextPostActivationWitnessCommandTemplate,
  paths: {
    builder: builderPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceOutputWitnessRunner: witnessInput.path
  },
  blockedActions: [
    "treat_receipt_builder_as_output_witness_review",
    "rerun_output_witness_from_builder",
    "invoke_reviewed_scheduled_runner_from_builder",
    "register_or_start_scheduled_task_from_builder",
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
  <title>Post-Registration Output Witness Receipt Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { line-height: 1.55; }
    .panel { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); margin-top: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
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
    <h1>Post-Registration Output Witness Receipt Builder</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span></p>
    <section class="panel">
      <h2>Source summary</h2>
      <div class="grid">
        <div><strong>Status</strong><br><code>${htmlEscape(builder.sourceOutputWitnessStatus)}</code></div>
        <div><strong>Runner triggered</strong><br><code>${builder.sourceRunnerTriggered ? "true" : "false"}</code></div>
        <div><strong>Exited zero</strong><br><code>${builder.sourceDirectRunnerExitedZero ? "true" : "false"}</code></div>
      </div>
    </section>
    <section class="panel">
      <h2>Evidence paths</h2>
      <p class="muted">This page only generates a receipt JSON. Validation is a separate command, and no runner is triggered here.</p>
      ${Object.keys(evidencePaths)
        .map(
          (key) => `<label>${htmlEscape(key)}
        <input id="${htmlEscape(key)}" value="${htmlEscape(evidencePaths[key])}">
      </label>`
        )
        .join("\n")}
      <label><input id="evidenceReviewed" type="checkbox"> I reviewed the output witness evidence and want the validation step to evaluate it.</label>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="teacher_reviewed_output_witness">teacher_reviewed_output_witness</option>
          <option value="teacher_reviewed_prepare_post_activation_witness">teacher_reviewed_prepare_post_activation_witness</option>
          <option value="blocked_needs_more_evidence">blocked_needs_more_evidence</option>
        </select>
      </label>
      <label>Teacher notes
        <input id="teacherNotes" value="">
      </label>
      <p>
        <button id="generate">Generate Receipt JSON</button>
        <button id="copy" class="secondary">Copy JSON</button>
      </p>
      <textarea id="receipt" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const receiptEl = document.getElementById("receipt");
    const ids = ${jsonForScript(Object.keys(evidencePaths))};
    function q(value) { return '"' + String(value || "").replaceAll('"', '\\\\"') + '"'; }
    function currentPaths() {
      return Object.fromEntries(ids.map((id) => [id, document.getElementById(id).value.trim()]));
    }
    function buildPostActivationCommand(paths) {
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
        "--output-dir", q(builder.paths.builder.replace(/operational-post-registration-output-witness-receipt-builder\\.json$/, "post-activation-witness"))
      ].join(" ");
    }
    function buildReceipt() {
      const paths = currentPaths();
      return {
        format: "transparent_ai_all_software_operational_post_registration_output_witness_review_receipt_v1",
        builderId: builder.builderId,
        sourceOutputWitnessRunner: builder.paths.sourceOutputWitnessRunner,
        teacherDecision: document.getElementById("decision").value,
        evidenceReviewed: document.getElementById("evidenceReviewed").checked,
        operationalScope: builder.operationalScope,
        evidencePaths: paths,
        validationCommand: builder.validationCommandTemplate,
        nextPostActivationWitnessCommand: buildPostActivationCommand(paths),
        teacherNotes: document.getElementById("teacherNotes").value,
        locks: builder.locks
      };
    }
    function render() { receiptEl.value = JSON.stringify(buildReceipt(), null, 2); }
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
      format: "transparent_ai_all_software_operational_post_registration_output_witness_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      validationCommandTemplate,
      nextPostActivationWitnessCommandTemplate,
      locks: lockState
    },
    null,
    2
  )
);
