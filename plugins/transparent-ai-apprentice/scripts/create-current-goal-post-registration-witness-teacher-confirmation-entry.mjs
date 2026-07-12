#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "current-goal-post-registration-witness-teacher-confirmation-entry")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "current-goal-post-registration-witness-teacher-confirmation-entry"
  );
}

function readJson(path) {
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
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function commandLine(scriptName, args = []) {
  const parts = ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName)];
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
    entryDoesNotValidateReceipt: true,
    entryDoesNotRunCommands: true,
    entryDoesNotRegisterTask: true,
    entryDoesNotLaunchRunner: true,
    entryDoesNotExecuteTargetSoftware: true,
    entryDoesNotCaptureScreenshots: true,
    entryDoesNotReadLogs: true,
    entryDoesNotReadFullLogs: true,
    entryDoesNotWriteMemory: true,
    entryDoesNotEnableRules: true,
    entryDoesNotDeleteRollbackPoints: true,
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

function writeReadme(path, entry) {
  const lines = [
    "# Current Goal Post-Registration Witness Teacher Confirmation Entry",
    "",
    `Status: ${entry.status}`,
    `Source witness builder: ${entry.paths.sourceWitnessCommandBuilder}`,
    `Builder status: ${entry.sourceWitnessBuilderStatus}`,
    "",
    "This entry is a focused teacher confirmation surface for the current all-software low-token proof gap.",
    "It points to the latest post-registration output witness command builder and asks the teacher to decide whether the blocked route is ready to continue, still blocked, or needs more evidence.",
    "",
    `- HTML: ${entry.paths.html}`,
    `- Receipt template: ${entry.paths.receiptTemplate}`,
    `- Source builder HTML: ${entry.paths.sourceWitnessCommandBuilderHtml || "missing"}`,
    "",
    "Safety boundary:",
    "- It does not validate receipts, run commands, register or start Scheduled Tasks, launch runners, read logs, capture screenshots, execute target software, write memory, enable rules, delete rollback points, unlock packaging, or claim completion.",
    "- The next witness runner command remains blocked until the teacher supplies explicit confirmation text and a retained rollback point, and until the source builder is based on registered-and-matching monitor status."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, entry) {
  const sourceLink = entry.paths.sourceWitnessCommandBuilderHtml && existsSync(entry.paths.sourceWitnessCommandBuilderHtml)
    ? `<a href="${htmlEscape(fileHref(entry.paths.sourceWitnessCommandBuilderHtml))}">${htmlEscape(basename(entry.paths.sourceWitnessCommandBuilderHtml))}</a>`
    : `<code>${htmlEscape(entry.paths.sourceWitnessCommandBuilderHtml || "missing")}</code>`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Post-Registration Witness Teacher Confirmation</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 980px; margin: 0 auto; padding: 28px; }
    section { background: #fff; border: 1px solid #d9e2ef; border-radius: 8px; padding: 16px; margin: 14px 0; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    label { display: grid; gap: 5px; margin: 10px 0; }
    input, select, textarea { box-sizing: border-box; width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px; font: 14px "Segoe UI", Arial, sans-serif; }
    textarea { min-height: 230px; font-family: Consolas, monospace; }
    button { border: 1px solid #1f5f8b; background: #1f5f8b; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #1f5f8b; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .lock { color: #7a2d12; font-weight: 600; }
    code, pre { background: #eef3f8; border-radius: 5px; padding: 3px 5px; overflow-wrap: anywhere; white-space: pre-wrap; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Post-Registration Witness Teacher Confirmation</h1>
  <p><strong>Status:</strong> ${htmlEscape(entry.status)}</p>
  <p class="lock">Review-only. This page does not execute, register, launch, read logs, capture screenshots, write memory, enable rules, delete rollback points, unlock packaging, or claim completion.</p>
  <section>
    <h2>Current Proof Gap</h2>
    <p>${htmlEscape(entry.teacherQuestion)}</p>
    <p><strong>Source builder:</strong> ${sourceLink}</p>
    <p><strong>Source builder status:</strong> <code>${htmlEscape(entry.sourceWitnessBuilderStatus)}</code></p>
    <p><strong>Registration status:</strong> <code>${htmlEscape(entry.sourceRegistrationStatus)}</code></p>
    <p><strong>Blockers:</strong> ${htmlEscape(entry.blockers.join("; ") || "none")}</p>
  </section>
  <section>
    <h2>Teacher Receipt</h2>
    <label>Decision
      <select id="decision">
        <option value="needs_teacher_review">needs_teacher_review</option>
        <option value="teacher_confirms_ready_to_continue_after_registration">teacher_confirms_ready_to_continue_after_registration</option>
        <option value="blocked">blocked</option>
      </select>
    </label>
    <label>Teacher confirmation text
      <input id="teacherConfirmationText" placeholder="What exactly did the teacher confirm?">
    </label>
    <label>Observed evidence path
      <input id="observedEvidencePath" value="${htmlEscape(entry.paths.sourceWitnessCommandBuilder)}">
    </label>
    <label>Retained rollback point
      <input id="retainedRollbackPoint" placeholder="Rollback point kept until teacher confirms this direction">
    </label>
    <label>Teacher notes
      <input id="teacherNotes" placeholder="Blockers, corrections, or next-step notes">
    </label>
    <div class="controls">
      <button id="generate">Generate receipt JSON</button>
      <button id="download" class="secondary">Download receipt JSON</button>
      <button id="copyCommand" class="secondary">Copy next command template</button>
    </div>
    <textarea id="output" spellcheck="false"></textarea>
  </section>
</main>
<script>
  const entry = ${jsonForScript(entry)};
  const output = document.getElementById("output");
  function receipt() {
    const value = JSON.parse(JSON.stringify(entry.receiptTemplate));
    value.teacherDecision = document.getElementById("decision").value;
    value.teacherConfirmationText = document.getElementById("teacherConfirmationText").value;
    value.observedEvidencePath = document.getElementById("observedEvidencePath").value;
    value.retainedRollbackPoint = document.getElementById("retainedRollbackPoint").value;
    value.teacherNotes = document.getElementById("teacherNotes").value;
    value.generatedAt = new Date().toISOString();
    value.generatedBy = "current_goal_post_registration_witness_teacher_confirmation_entry";
    return value;
  }
  function render() {
    output.value = JSON.stringify(receipt(), null, 2);
    return output.value;
  }
  document.getElementById("generate").addEventListener("click", render);
  document.getElementById("download").addEventListener("click", () => {
    const blob = new Blob([render() + "\\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teacher-post-registration-witness-confirmation-receipt.json";
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById("copyCommand").addEventListener("click", () => navigator.clipboard?.writeText(entry.nextCommandTemplate || ""));
  render();
</script>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

const sourcePath = resolve(argValue("--witness-command-builder", argValue("--builder", "")));
if (!sourcePath || !existsSync(sourcePath)) {
  throw new Error("--witness-command-builder is required");
}
const witness = readJson(sourcePath);
if (witness.format !== "transparent_ai_operational_post_registration_output_witness_command_builder_v1") {
  throw new Error("--witness-command-builder must be transparent_ai_operational_post_registration_output_witness_command_builder_v1");
}

const goal = argValue("--goal", "Create a focused teacher confirmation entry for the current post-registration output witness proof gap.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), "artifacts", "current-goal-post-registration-witness-teacher-confirmation-entries"))
);
const entryId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const entryDir = join(outputRoot, entryId);
mkdirSync(entryDir, { recursive: true });

const entryPath = join(entryDir, "current-goal-post-registration-witness-teacher-confirmation-entry.json");
const htmlPath = join(entryDir, "current-goal-post-registration-witness-teacher-confirmation-entry.html");
const readmePath = join(entryDir, "CURRENT_GOAL_POST_REGISTRATION_WITNESS_TEACHER_CONFIRMATION_ENTRY.md");
const receiptTemplatePath = join(entryDir, "teacher-post-registration-witness-confirmation-receipt-template.json");
const lockState = locks();
const sourceStatus = witness.registrationStatus?.status || witness.registrationStatus || "";
const blockers = [
  ...(Array.isArray(witness.registrationStatus?.blockers) ? witness.registrationStatus.blockers : []),
  ...(Array.isArray(witness.approvedRunner?.blockers) ? witness.approvedRunner.blockers : []),
  ...(Array.isArray(witness.operationalScopeSummary?.blockers) ? witness.operationalScopeSummary.blockers : [])
].filter(Boolean);
const sourceHtml = witness.paths?.html || "";
const nextCommandTemplate = witness.commandTemplate || commandLine("run-all-software-operational-learning-post-registration-output-witness-runner.mjs", [
  ["--registration-status", "<registered-and-matching-recurring-monitor-status.json>"],
  ["--registration-approved-runner", "<registration-approved-runner.json>"],
  ["--dry-run-rehearsal", "<passed-operational-activation-dry-run-rehearsal.json>"],
  ["--registration-execute-gate", "<ready-operational-registration-execute-gate.json>"],
  ["--trigger-reviewed-output", true],
  ["--allow-runner-trigger", true],
  ["--teacher-confirmation", "<teacher-confirmed-post-registration-output-witness-text>"],
  ["--rollback-point-created", true],
  ["--rollback-point", "<retained-rollback-point-path-or-label>"]
]);

const receiptTemplate = {
  format: "transparent_ai_current_goal_post_registration_witness_teacher_confirmation_receipt_v1",
  sourceEntry: entryPath,
  sourceWitnessCommandBuilder: sourcePath,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "teacher_confirms_ready_to_continue_after_registration",
    "blocked"
  ],
  blockedDecisions: ["accepted", "execute_now", "register_now", "launch_runner", "enable_rule", "write_memory", "goal_complete"],
  teacherDecision: "needs_teacher_review",
  observedEvidencePath: "",
  teacherConfirmationText: "",
  retainedRollbackPoint: "",
  teacherNotes: "",
  mustNotClaimAcceptance: true,
  mustNotRunAutomatically: true,
  locks: lockState
};

const entry = {
  ok: true,
  format: "transparent_ai_current_goal_post_registration_witness_teacher_confirmation_entry_v1",
  entryId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_confirmation_before_post_registration_output_witness",
  teacherQuestion:
    "Does the bounded runner/output witness prove the monitor ran without reading full logs or capturing screenshots unnecessarily?",
  sourceWitnessBuilderStatus: witness.status || "",
  sourceRegistrationStatus: sourceStatus,
  blockers,
  nextCommandTemplate,
  receiptTemplate,
  locks: lockState,
  paths: {
    entry: entryPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceWitnessCommandBuilder: sourcePath,
    sourceWitnessCommandBuilderHtml: sourceHtml,
    sourceWitnessCommandBuilderReadme: witness.paths?.readme || ""
  },
  completionBoundary: {
    goalComplete: false,
    reason: "This entry only focuses teacher review on the latest witness builder. It does not validate the receipt or run the witness."
  }
};

writeFileSync(entryPath, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeHtml(htmlPath, entry);
writeReadme(readmePath, entry);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_post_registration_witness_teacher_confirmation_entry_result_v1",
      status: entry.status,
      entryPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      sourceWitnessBuilderStatus: entry.sourceWitnessBuilderStatus,
      sourceRegistrationStatus: entry.sourceRegistrationStatus,
      blockerCount: entry.blockers.length,
      locks: entry.locks
    },
    null,
    2
  )
);
