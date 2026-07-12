#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-validated-route-request-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-validated-route-request-receipt-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
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
    builderDoesNotValidateReceipt: true,
    builderDoesNotExecuteDownstreamTool: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    downstreamToolInvoked: false,
    targetSoftwareCommandsExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const builderInput = readJsonInput(argValue("--builder", argValue("--command-builder", "")), "--builder");
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue(
      "--out-dir",
      join(process.cwd(), ".transparent-apprentice", "tlcl-apprentice-session-validated-route-request-receipt-builders")
    )
  )
);
mkdirSync(outputRoot, { recursive: true });

const sourceBuilder = builderInput.value;
const downstreamRequest = sourceBuilder?.downstreamRequest || null;
const blockerRows = [];
function block(code, message) {
  blockerRows.push({ code, message });
}

if (!sourceBuilder) block("builder_missing", "A validated route command builder packet is required.");
if (sourceBuilder && sourceBuilder.format !== "transparent_ai_tlcl_apprentice_session_validated_route_command_builder_v1") {
  block("builder_format_invalid", "Builder must be transparent_ai_tlcl_apprentice_session_validated_route_command_builder_v1.");
}
if (sourceBuilder && sourceBuilder.ok !== true) block("builder_not_ok", "Builder must be ok=true.");
if (sourceBuilder && sourceBuilder.status !== "tlcl_validated_route_command_builder_waiting_for_teacher_copy") {
  block("builder_status_not_ready", "Builder is not waiting for teacher copy/review.");
}
if (!downstreamRequest) block("downstream_request_missing", "Builder must contain downstreamRequest.");
if (downstreamRequest?.format !== "transparent_ai_tlcl_apprentice_session_validated_route_downstream_request_v1") {
  block("downstream_request_format_invalid", "downstreamRequest format is not the expected TLCL downstream request format.");
}
if (downstreamRequest?.executeNow !== false) block("downstream_execute_lock_missing", "downstreamRequest must keep executeNow=false.");
if (sourceBuilder?.locks?.builderDoesNotExecuteDownstreamTool !== true) {
  block("source_builder_lock_missing", "Source builder must prove it did not execute the downstream tool.");
}

const receiptBuilderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(downstreamRequest?.route || "blocked")}`;
const builderDir = join(outputRoot, receiptBuilderId);
mkdirSync(builderDir, { recursive: true });
const receiptBuilderPath = join(builderDir, "tlcl-apprentice-session-validated-route-request-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "tlcl-apprentice-session-validated-route-request-receipt-template.json");
const htmlPath = join(builderDir, "tlcl-apprentice-session-validated-route-request-receipt-builder.html");
const readmePath = join(builderDir, "TLCL_VALIDATED_ROUTE_REQUEST_RECEIPT_BUILDER_START_HERE.md");
const receiptLocks = locks();
const ok = blockerRows.length === 0;
const status = ok
  ? "tlcl_validated_route_request_receipt_builder_waiting_for_teacher_review"
  : "blocked_before_tlcl_validated_route_request_receipt_builder";

const receiptTemplate = ok
  ? {
      format: "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_v1",
      sourceBuilderId: sourceBuilder.builderId,
      sourceBuilderPath: builderInput.path || "<inline-builder>",
      teacherDecision: "needs_teacher_review",
      allowedTeacherDecisions: [
        "teacher_reviewed_downstream_request_ready_for_manual_use",
        "needs_more_evidence",
        "correction_to_high_reasoning_repair"
      ],
      forbiddenTeacherDecisions: [
        "execute_now",
        "accepted",
        "enable_rule",
        "write_memory",
        "unlock_packaging",
        "claim_complete",
        "invoke_model",
        "fetch_rag"
      ],
      reviewedRoute: downstreamRequest.route || "",
      reviewedNextTool: downstreamRequest.nextTool || "",
      reviewedArgs: downstreamRequest.args || {},
      reviewedCommandTemplate: downstreamRequest.commandTemplate || "",
      reviewedNoOpLocks: sourceBuilder.locks || {},
      confirmedRollbackPoint: "",
      downstreamRequestReviewed: false,
      commandTemplateReviewed: false,
      noOpLocksReviewed: false,
      separateManualStepConfirmed: false,
      blockedActionsConfirmed: true,
      executeNow: false,
      reviewOnly: true,
      teacherNotes: "",
      locks: receiptLocks
    }
  : null;

const receiptBuilder = {
  ok,
  format: "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_builder_v1",
  receiptBuilderId,
  createdAt: new Date().toISOString(),
  status,
  sourceBuilderPath: builderInput.path,
  sourceBuilderId: sourceBuilder?.builderId || "",
  downstreamRequest,
  receiptTemplate,
  blockers: blockerRows,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-apprentice-session-validated-route-request-receipt.mjs --builder "' +
    (builderInput.path || "<tlcl-apprentice-session-validated-route-command-builder.json>") +
    '" --receipt "<teacher-filled-tlcl-validated-route-request-receipt.json>"',
  blockedActions: [
    "execute_downstream_tool_from_route_request_receipt_builder",
    "auto_run_command_from_route_request_receipt_builder",
    "invoke_model_from_route_request_receipt_builder",
    "fetch_rag_from_route_request_receipt_builder",
    "write_memory_from_route_request_receipt_builder",
    "enable_rule_from_route_request_receipt_builder",
    "unlock_packaging_from_route_request_receipt_builder",
    "claim_completion_from_route_request_receipt_builder"
  ],
  locks: receiptLocks,
  paths: {
    receiptBuilder: receiptBuilderPath,
    receiptTemplate: receiptTemplatePath,
    html: htmlPath,
    readme: readmePath,
    sourceBuilder: builderInput.path
  }
};

writeJson(receiptBuilderPath, receiptBuilder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Validated Route Request Receipt Builder",
    "",
    `- Status: ${status}`,
    `- Source builder: ${builderInput.path || "<inline builder>"}`,
    `- Next tool: ${downstreamRequest?.nextTool || "<blocked>"}`,
    `- Execute now: false`,
    "",
    "This builder creates a teacher receipt template for the copy-only downstream request. It does not validate the receipt, run the downstream tool, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    `Next validation command: ${receiptBuilder.nextValidationCommand}`,
    "",
    "Receipt template:",
    "",
    "```json",
    JSON.stringify(receiptTemplate, null, 2),
    "```"
  ].join("\n") + "\n",
  "utf8"
);

writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TLCL Validated Route Request Receipt Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; background: #f7f9fc; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 22px; }
    h1 { font-size: 25px; margin: 0 0 8px; letter-spacing: 0; }
    section { background: #fff; border: 1px solid #d8e0ec; border-radius: 8px; padding: 15px; margin-top: 12px; }
    label { display: block; margin-top: 10px; }
    input, select, textarea, button { font: inherit; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; }
    textarea { min-height: 180px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 8px 12px; cursor: pointer; margin-top: 8px; }
    code { word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Validated Route Request Receipt Builder</h1>
    <p>Status: <code>${htmlEscape(status)}</code></p>
    <p>This page creates a teacher receipt only. It does not execute downstream tools, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.</p>
    <section>
      <p>Receipt builder: <a href="${htmlEscape(pathToFileURL(receiptBuilderPath).href)}">${htmlEscape(receiptBuilderPath)}</a></p>
      <p>Next tool: <code>${htmlEscape(downstreamRequest?.nextTool || "<blocked>")}</code></p>
      <p>Validation command: <code>${htmlEscape(receiptBuilder.nextValidationCommand)}</code></p>
    </section>
    <section>
      <h2>Teacher Receipt</h2>
      <div class="row">
        <label>Decision
          <select id="decision">
            <option value="needs_teacher_review">needs_teacher_review</option>
            <option value="teacher_reviewed_downstream_request_ready_for_manual_use">teacher_reviewed_downstream_request_ready_for_manual_use</option>
            <option value="needs_more_evidence">needs_more_evidence</option>
            <option value="correction_to_high_reasoning_repair">correction_to_high_reasoning_repair</option>
          </select>
        </label>
        <label>Confirmed rollback point
          <input id="rollback" type="text" placeholder="rollback id or rollback-point.json path">
        </label>
      </div>
      <label><input id="requestReviewed" type="checkbox"> Downstream request reviewed</label>
      <label><input id="commandReviewed" type="checkbox"> Command template reviewed</label>
      <label><input id="locksReviewed" type="checkbox"> No-op locks reviewed</label>
      <label><input id="manualStep" type="checkbox"> Separate manual step confirmed</label>
      <label>Teacher notes<input id="notes" type="text"></label>
      <button id="generate">Generate Receipt JSON</button>
      <textarea id="receiptJson" spellcheck="false"></textarea>
    </section>
    <section>
      <h2>Downstream Request Evidence</h2>
      <textarea id="requestJson" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(receiptBuilder)};
    const receiptEl = document.getElementById("receiptJson");
    const requestEl = document.getElementById("requestJson");
    requestEl.value = JSON.stringify(builder.downstreamRequest, null, 2);
    function buildReceipt() {
      return {
        ...builder.receiptTemplate,
        teacherDecision: document.getElementById("decision").value,
        confirmedRollbackPoint: document.getElementById("rollback").value,
        downstreamRequestReviewed: document.getElementById("requestReviewed").checked,
        commandTemplateReviewed: document.getElementById("commandReviewed").checked,
        noOpLocksReviewed: document.getElementById("locksReviewed").checked,
        separateManualStepConfirmed: document.getElementById("manualStep").checked,
        teacherNotes: document.getElementById("notes").value
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
      ok,
      format: "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_builder_result_v1",
      status,
      receiptBuilderId,
      sourceBuilderId: sourceBuilder?.builderId || "",
      nextTool: downstreamRequest?.nextTool || "",
      receiptBuilderPath,
      receiptTemplatePath,
      htmlPath,
      readmePath,
      blockers: blockerRows,
      locks: receiptLocks
    },
    null,
    2
  )
);
