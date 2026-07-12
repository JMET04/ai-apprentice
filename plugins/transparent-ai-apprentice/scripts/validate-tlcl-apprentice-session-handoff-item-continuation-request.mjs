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
    String(value || "tlcl-handoff-item-continuation-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-handoff-item-continuation-validation"
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

function jsonForHtml(value) {
  return htmlEscape(JSON.stringify(value, null, 2));
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

function sameJson(a, b) {
  return stableJson(a ?? null) === stableJson(b ?? null);
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    validatorDoesNotExecuteNextCall: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    targetSoftwareCommandsExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    ruleEnabledByValidator: false,
    goalComplete: false
  };
}

function isPlaceholder(value) {
  const text = String(value ?? "").trim();
  return !text || /^<.*>$/.test(text);
}

function itemByRequest(builder, request) {
  const items = Array.isArray(builder?.items) ? builder.items : [];
  const number = Number(request?.itemNumber);
  return (
    items.find((item) => request?.itemId && item.id === request.itemId) ||
    items.find((item) => Number(item.order) === number) ||
    null
  );
}

const builderInput = readJsonInput(argValue("--builder", argValue("--command-builder", "")), "--builder");
const requestInput = readJsonInput(argValue("--request", argValue("--continuation-request", "")), "--request");
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-apprentice-session-handoff-item-continuation-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });

const builder = builderInput.value;
const request = requestInput.value;
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(request?.itemId || request?.selectedRoute)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const validationPath = join(validationDir, "tlcl-apprentice-session-handoff-item-continuation-validation.json");
const handoffPath = join(validationDir, "tlcl-apprentice-session-handoff-item-continuation-next-step.md");
const htmlPath = join(validationDir, "tlcl-apprentice-session-handoff-item-continuation-next-step.html");
const blockerRows = [];
const warningRows = [];
const item = itemByRequest(builder, request);
const validationLocks = locks();

function block(code, message) {
  blockerRows.push({ code, message });
}

if (!builder) block("builder_missing", "A command-builder packet is required.");
if (builder && builder.format !== "transparent_ai_tlcl_apprentice_session_handoff_item_command_builder_v1") {
  block("builder_format_invalid", "Builder must be transparent_ai_tlcl_apprentice_session_handoff_item_command_builder_v1.");
}
if (!request) block("request_missing", "A continuation request is required.");
if (request && request.format !== "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_v1") {
  block("request_format_invalid", "Request must be transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_v1.");
}
if (request?.executeNow !== false) block("execute_now_forbidden", "Continuation request must keep executeNow=false.");
if (request?.reviewOnly !== true) block("review_only_missing", "Continuation request must keep reviewOnly=true.");
if (request && isPlaceholder(request.teacherConfirmation)) {
  block("teacher_confirmation_missing", "Teacher confirmation must be explicit and cannot be a placeholder.");
}
if (request && isPlaceholder(request.retainedRollbackPoint)) {
  block("rollback_point_missing", "A retained rollback point must be named before continuing.");
}
if (request && !item) block("queue_item_not_found", "The requested itemNumber or itemId was not found in the builder packet.");

if (item) {
  if (request.selectedRoute !== item.selectedRoute) block("selected_route_mismatch", "Request selectedRoute must match the builder item.");
  if (request.commandTemplate !== item.commandTemplate) {
    block("command_template_mismatch", "Request commandTemplate must match the builder item.");
  }
  if (!sameJson(request.nextCall, item.nextCall)) block("next_call_mismatch", "Request nextCall must match the builder item.");
  if (!sameJson(request.handoffInputs || {}, item.handoffInputs || {})) {
    block("handoff_inputs_mismatch", "Request handoffInputs must match the builder item.");
  }
  if (item.executesNow !== false) block("builder_item_execute_lock_missing", "Builder item must keep executesNow=false.");
}

for (const [key, expected] of Object.entries(validationLocks)) {
  if (request?.locks && key in request.locks && request.locks[key] !== expected) {
    block("request_lock_mismatch", `Request lock ${key} must remain ${expected}.`);
  }
}

if (request?.nextCall?.tool && typeof request.nextCall.tool !== "string") {
  block("next_call_tool_invalid", "nextCall.tool must be a string when present.");
}
if (!request?.nextCall?.tool) warningRows.push({ code: "next_call_tool_missing", message: "No nextCall.tool was present." });

const passed = blockerRows.length === 0;
const status = passed
  ? "tlcl_handoff_item_continuation_request_validated_waiting_for_manual_next_call"
  : "blocked_before_tlcl_handoff_item_continuation";
const nextManualHandoff = passed
  ? {
      status: "manual_next_call_ready_after_teacher_review",
      tool: request.nextCall?.tool || "",
      args: request.nextCall?.arguments || request.nextCall?.args || {},
      commandTemplate: request.commandTemplate || "",
      handoffInputs: request.handoffInputs || {},
      executesNow: false,
      instruction:
        "A human or next agent may use this nextCall only as a separate manual step. This validator did not run it."
    }
  : null;

const validation = {
  ok: passed,
  format: "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  builderPath: builderInput.path,
  requestPath: requestInput.path,
  selectedItem: item
    ? {
        id: item.id,
        order: item.order,
        selectedRoute: item.selectedRoute,
        commandKind: item.commandKind,
        executesNow: false
      }
    : null,
  nextManualHandoff,
  blockers: blockerRows,
  warnings: warningRows,
  blockedActions: [
    "execute_next_call_from_validator",
    "auto_run_downstream_tool_from_validator",
    "invoke_model_from_validator",
    "fetch_rag_from_validator",
    "write_memory_from_validator",
    "enable_rule_from_validator",
    "unlock_packaging_from_validator",
    "claim_completion_from_validator"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    handoffMarkdown: handoffPath,
    handoffHtml: htmlPath
  }
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(
  handoffPath,
  [
    "# TLCL Handoff Item Continuation Validation",
    "",
    `- Status: ${validation.status}`,
    `- Passed: ${validation.ok}`,
    `- Builder: ${builderInput.path || "<inline builder>"}`,
    `- Request: ${requestInput.path || "<inline request>"}`,
    `- Next tool: ${nextManualHandoff?.tool || "<blocked>"}`,
    `- Executes now: false`,
    "",
    "Blocked actions:",
    ...validation.blockedActions.map((action) => `- ${action}`),
    "",
    "Next manual handoff JSON:",
    "",
    "```json",
    JSON.stringify(nextManualHandoff, null, 2),
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
  <title>TLCL Continuation Validation</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 22px; }
    h1 { font-size: 25px; margin: 0 0 8px; letter-spacing: 0; }
    section { background: #fff; border: 1px solid #d8e0ec; border-radius: 8px; padding: 15px; margin-top: 12px; }
    pre { white-space: pre-wrap; word-break: break-word; background: #f1f5f9; border: 1px solid #d8e0ec; border-radius: 6px; padding: 12px; }
    code { word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Handoff Item Continuation Validation</h1>
    <p>Status: <code>${htmlEscape(validation.status)}</code></p>
    <p>This page is a validation receipt only. It does not run nextCall, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.</p>
    <section>
      <h2>Evidence</h2>
      <p>Validation: <a href="${htmlEscape(pathToFileURL(validationPath).href)}">${htmlEscape(validationPath)}</a></p>
      <p>Passed: <code>${validation.ok}</code></p>
      <p>Next tool: <code>${htmlEscape(nextManualHandoff?.tool || "<blocked>")}</code></p>
    </section>
    <section>
      <h2>Next Manual Handoff</h2>
      <pre>${jsonForHtml(nextManualHandoff)}</pre>
    </section>
    <section>
      <h2>Blockers</h2>
      <pre>${jsonForHtml(blockerRows)}</pre>
    </section>
    <section>
      <h2>Locks</h2>
      <pre>${jsonForHtml(validationLocks)}</pre>
    </section>
  </main>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: passed,
      format: "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_validation_result_v1",
      status,
      selectedRoute: validation.selectedItem?.selectedRoute || "",
      nextTool: nextManualHandoff?.tool || "",
      blockers: blockerRows,
      validationPath,
      handoffPath,
      htmlPath,
      locks: validationLocks
    },
    null,
    2
  )
);
