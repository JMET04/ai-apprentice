#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: JSON.parse(readFileSync(resolve(text), "utf8").replace(/^\uFEFF/, "")), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function slug(value) {
  return (
    String(value || "tlcl-dry-run-only-post-run-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-dry-run-only-post-run-receipt-builder"
  );
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
    receiptBuilderOnly: true,
    doesNotValidateReceipt: true,
    doesNotCreateExecutionApprovalGate: true,
    noSoftwareExecution: true,
    noTargetSoftwareCommands: true,
    noUiEvents: true,
    noScreenshots: true,
    noFullLogs: true,
    noRuleEnablement: true,
    noMemoryWrite: true,
    noPackagingUnlock: true,
    noCompletionClaim: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher post-run receipt for a TLCL dry-run-only run.");
const runInput = readJsonInput(
  argValue("--run", argValue("--dry-run-only-run", "")),
  "--run",
  "transparent_ai_tlcl_medium_runtime_dry_run_only_run_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-dry-run-only-post-run-receipt-builders"))
);
const run = runInput.value;
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "tlcl-medium-runtime-dry-run-only-post-run-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "tlcl-medium-runtime-dry-run-only-post-run-receipt-template.json");
const htmlPath = join(builderDir, "tlcl-medium-runtime-dry-run-only-post-run-receipt-builder.html");
const readmePath = join(builderDir, "TLCL_MEDIUM_RUNTIME_DRY_RUN_ONLY_POST_RUN_RECEIPT_BUILDER_START_HERE.md");

const receiptTemplate = {
  format: "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_v1",
  builderId,
  sourceRunPath: runInput.path,
  runId: run.runId || "",
  teacherDecision: "needs_teacher_review",
  dryRunEvidenceReviewed: false,
  commandTemplateReviewed: false,
  noExecutionLocksReviewed: false,
  rollbackPointStillRetained: false,
  teacherMatchedExpected: false,
  teacherCorrection: "",
  teacherNote: "",
  blockedActionsConfirmed: true,
  locks: locks()
};
const builder = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "post_run_receipt_builder_ready_for_teacher_use",
  sourceRunStatus: run.status || "",
  sourceEvidenceSummary: {
    simulatedDryRunEvidencePresent: Boolean(run.simulatedDryRunEvidence),
    adapterInvoked: run.simulatedDryRunEvidence?.adapterInvoked === true,
    targetSoftwareCommandsExecuted: run.simulatedDryRunEvidence?.targetSoftwareCommandsExecuted === true
  },
  defaultReceipt: receiptTemplate,
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "dry_run_matched_expected",
    "dry_run_mismatch_blocked",
    "correction_to_senior_compile"
  ],
  blockedTeacherDecisions: ["accepted", "execute_now", "run_execute_mode", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"],
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-medium-runtime-dry-run-only-post-run-receipt.mjs --run "' +
    (runInput.path || "<tlcl-medium-runtime-dry-run-only-run.json>") +
    '" --receipt "<teacher-filled-tlcl-medium-runtime-dry-run-only-post-run-receipt.json>"',
  blockedActions: [
    "create_execution_approval_gate_from_builder",
    "execute_target_software_from_builder",
    "send_ui_events_from_builder",
    "enable_rule_from_builder",
    "write_memory_from_builder",
    "unlock_packaging_from_builder",
    "claim_completion_from_builder"
  ],
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    html: htmlPath,
    readme: readmePath,
    sourceRun: runInput.path
  },
  locks: locks()
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Dry-Run-Only Post-Run Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Source run: ${runInput.path || "<inline>"}`,
    "",
    "Use this builder after a TLCL dry-run-only runner has produced review evidence.",
    "The teacher can mark the dry-run as matching expected intent, block it as a mismatch, or send a correction back to senior compile.",
    "",
    "The builder does not validate the receipt, create execution approval gates, execute target software, send UI events, enable rules, write memory, unlock packaging, or claim completion.",
    "",
    `Next validation command: ${builder.nextValidationCommand}`
  ].join("\n"),
  "utf8"
);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TLCL Dry-Run-Only Post-Run Review</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Arial, sans-serif; background: #f7f8fb; color: #17202a; }
    main { max-width: 980px; margin: 0 auto; padding: 24px; }
    section { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; margin-top: 14px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 17px; margin: 0 0 10px; }
    select, input, textarea, button { font: inherit; }
    select, input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 8px; }
    textarea { min-height: 220px; font-family: Consolas, monospace; font-size: 13px; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Dry-Run-Only Post-Run Review</h1>
    <p>This page builds a teacher receipt only. It does not create an execution approval gate.</p>
    <section>
      <h2>Source Run</h2>
      <p>Status: <code>${htmlEscape(run.status || "")}</code></p>
      <p>Run id: <code>${htmlEscape(run.runId || "")}</code></p>
    </section>
    <section>
      <h2>Teacher Decision</h2>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="dry_run_matched_expected">dry_run_matched_expected</option>
          <option value="dry_run_mismatch_blocked">dry_run_mismatch_blocked</option>
          <option value="correction_to_senior_compile">correction_to_senior_compile</option>
        </select>
      </label>
      <label><input id="evidenceReviewed" type="checkbox"> Dry-run evidence reviewed</label>
      <label><input id="commandReviewed" type="checkbox"> Command template reviewed</label>
      <label><input id="locksReviewed" type="checkbox"> No-execution locks reviewed</label>
      <label><input id="rollbackRetained" type="checkbox"> Rollback point is still retained</label>
      <label><input id="matchedExpected" type="checkbox"> Dry-run matched expected intent</label>
      <label>Teacher correction<input id="correction" type="text"></label>
      <label>Teacher note<input id="note" type="text"></label>
      <p><button id="generate">Generate Receipt JSON</button></p>
      <textarea id="receipt" spellcheck="false"></textarea>
      <p class="muted">Next validation command: <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const receiptEl = document.getElementById("receipt");
    function buildReceipt() {
      return {
        ...builder.defaultReceipt,
        teacherDecision: document.getElementById("decision").value,
        dryRunEvidenceReviewed: document.getElementById("evidenceReviewed").checked,
        commandTemplateReviewed: document.getElementById("commandReviewed").checked,
        noExecutionLocksReviewed: document.getElementById("locksReviewed").checked,
        rollbackPointStillRetained: document.getElementById("rollbackRetained").checked,
        teacherMatchedExpected: document.getElementById("matchedExpected").checked,
        teacherCorrection: document.getElementById("correction").value,
        teacherNote: document.getElementById("note").value
      };
    }
    function render() { receiptEl.value = JSON.stringify(buildReceipt(), null, 2); }
    document.getElementById("generate").addEventListener("click", render);
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
      format: "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      receiptTemplatePath,
      htmlPath,
      readmePath,
      dryRunExecuted: false,
      executionApprovalGateCreated: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      ruleEnabled: false,
      packagingGated: true
    },
    null,
    2
  )
);
