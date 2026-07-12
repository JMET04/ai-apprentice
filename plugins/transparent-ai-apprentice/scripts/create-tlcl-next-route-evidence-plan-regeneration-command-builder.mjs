#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (
    parsed.value?.format === "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_validation_result_v1" &&
    parsed.value?.validationPath &&
    existsSync(parsed.value.validationPath)
  ) {
    return { value: readJson(resolve(parsed.value.validationPath)), path: resolve(parsed.value.validationPath) };
  }
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function slug(value) {
  return (
    String(value || "tlcl-next-route-evidence-plan-regeneration-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-evidence-plan-regeneration-command-builder"
  );
}

function locks() {
  return {
    reviewOnly: true,
    copyOnly: true,
    builderDoesNotRegenerateInputContract: true,
    builderDoesNotRunCommand: true,
    builderDoesNotRunNextTool: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    accepted: false,
    ruleEnabled: false,
    packagingUnlocked: false,
    inputContractRegenerated: false,
    commandExecuted: false,
    nextToolExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    goalComplete: false
  };
}

const goal = argValue("--goal", "Build a copy-only regeneration command from a validated TLCL evidence plan receipt.");
const validationInput = readJsonInput(argValue("--validation", argValue("--receipt-validation", "")), "--validation");
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-next-route-evidence-plan-regeneration-command-builders"))
);
const validation = validationInput.value;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (validation.format !== "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_validation_v1") {
  block("validation_format_invalid", "Validation must be transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_validation_v1.");
}
if (validation.status !== "evidence_plan_receipt_ready_for_input_contract_regeneration") {
  block("validation_status_not_ready", "Validation must be ready for input-contract regeneration.");
}
if (validation.readyForInputContractRegeneration !== true) {
  block("validation_not_ready_for_regeneration", "readyForInputContractRegeneration must be true.");
}
if (!validation.regenerationHandoff || validation.regenerationHandoff.format !== "transparent_ai_tlcl_next_route_evidence_plan_input_contract_regeneration_handoff_v1") {
  block("regeneration_handoff_missing_or_invalid", "Validation must include the evidence-plan input-contract regeneration handoff.");
}
if (validation.regenerationHandoff?.executeNow !== false) {
  block("regeneration_handoff_execute_lock_missing", "Regeneration handoff must keep executeNow=false.");
}
if (!String(validation.regenerationHandoff?.suggestedRegenerationCommand || "").trim()) {
  block("suggested_regeneration_command_missing", "Regeneration handoff must include a suggested command.");
}
if (validation.locks?.doesNotRegenerateInputContract !== true || validation.locks?.doesNotRunNextTool !== true) {
  block("source_validation_locks_missing", "Source validation must prove it did not regenerate the input contract or run the next tool.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(validation.regenerationHandoff?.routeId || goal)}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "tlcl-next-route-evidence-plan-regeneration-command-builder.json");
const requestPath = join(builderDir, "tlcl-next-route-evidence-plan-regeneration-request.json");
const readmePath = join(builderDir, "TLCL_NEXT_ROUTE_EVIDENCE_PLAN_REGENERATION_COMMAND_BUILDER_START_HERE.md");
const htmlPath = join(builderDir, "tlcl-next-route-evidence-plan-regeneration-command-builder.html");
const ok = blockers.length === 0;
const status = ok
  ? "evidence_plan_regeneration_command_builder_waiting_for_teacher_copy"
  : "blocked_before_evidence_plan_regeneration_command_builder";
const request = ok
  ? {
      format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_v1",
      sourceValidationPath: validationInput.path || "<inline-validation>",
      routeId: validation.regenerationHandoff.routeId || "",
      nextTool: validation.regenerationHandoff.nextTool || "create_tlcl_next_route_input_contract",
      suggestedRegenerationCommand: validation.regenerationHandoff.suggestedRegenerationCommand,
      teacherConfirmation: "<teacher-reviewed-evidence-plan-regeneration-command>",
      evidenceRowsUsed: validation.regenerationHandoff.evidenceRowsUsed || [],
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;

const builder = {
  ok,
  format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceValidationPath: validationInput.path,
  routeId: validation.regenerationHandoff?.routeId || "",
  nextTool: validation.regenerationHandoff?.nextTool || "create_tlcl_next_route_input_contract",
  request,
  blockers,
  blockedActions: [
    "execute_regeneration_command_from_builder",
    "regenerate_input_contract_from_builder",
    "run_next_tool_from_builder",
    "invoke_model_from_builder",
    "fetch_rag_from_builder",
    "execute_target_software_from_builder",
    "write_memory_from_builder",
    "enable_rule_from_builder",
    "unlock_packaging_from_builder",
    "claim_completion_from_builder"
  ],
  paths: {
    builder: builderPath,
    request: requestPath,
    readme: readmePath,
    html: htmlPath,
    sourceValidation: validationInput.path
  },
  locks: locks()
};

writeJson(builderPath, builder);
if (request) writeJson(requestPath, request);
writeFileSync(
  readmePath,
  [
    "# TLCL Next-Route Evidence Plan Regeneration Command Builder",
    "",
    `Status: ${status}`,
    `Source validation: ${validationInput.path || "<inline validation>"}`,
    `Next tool: ${builder.nextTool}`,
    "Execute now: false",
    "",
    "This command builder is copy-only. It does not regenerate the input contract, run next tools, invoke models, fetch RAG, execute software, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "## Suggested Regeneration Command",
    "",
    "```powershell",
    request?.suggestedRegenerationCommand || "<blocked>",
    "```",
    "",
    "## Request JSON",
    "",
    "```json",
    JSON.stringify(request, null, 2),
    "```"
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
  <title>TLCL Evidence Plan Regeneration Command Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; background: #f7f9fc; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 22px; }
    h1 { font-size: 25px; margin: 0 0 8px; letter-spacing: 0; }
    section { background: #fff; border: 1px solid #d8e0ec; border-radius: 8px; padding: 15px; margin-top: 12px; }
    textarea { width: 100%; box-sizing: border-box; min-height: 160px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 8px 12px; cursor: pointer; margin: 6px 6px 0 0; }
    code { word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Evidence Plan Regeneration Command Builder</h1>
    <p>Status: <code>${htmlEscape(status)}</code></p>
    <p>This page is copy-only and keeps execution locked.</p>
    <section>
      <p>Builder: <a href="${htmlEscape(pathToFileURL(builderPath).href)}">${htmlEscape(builderPath)}</a></p>
      <p>Request: <a href="${htmlEscape(pathToFileURL(requestPath).href)}">${htmlEscape(requestPath)}</a></p>
      <p>Next tool: <code>${htmlEscape(builder.nextTool)}</code></p>
    </section>
    <section>
      <h2>Suggested Command</h2>
      <textarea id="commandText" spellcheck="false"></textarea>
      <button id="copyCommand">Copy command</button>
    </section>
    <section>
      <h2>Request JSON</h2>
      <textarea id="requestJson" spellcheck="false"></textarea>
      <button id="copyRequest">Copy request JSON</button>
    </section>
    <section>
      <h2>Locks</h2>
      <textarea id="locksJson" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    document.getElementById("commandText").value = builder.request?.suggestedRegenerationCommand || "";
    document.getElementById("requestJson").value = JSON.stringify(builder.request, null, 2);
    document.getElementById("locksJson").value = JSON.stringify(builder.locks, null, 2);
    document.getElementById("copyCommand").addEventListener("click", async () => {
      await navigator.clipboard.writeText(document.getElementById("commandText").value);
    });
    document.getElementById("copyRequest").addEventListener("click", async () => {
      await navigator.clipboard.writeText(document.getElementById("requestJson").value);
    });
  </script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_result_v1",
      status,
      ok,
      builderPath,
      requestPath: request ? requestPath : "",
      readmePath,
      htmlPath,
      routeId: builder.routeId,
      nextTool: builder.nextTool,
      executeNow: false,
      blockers,
      locks: builder.locks
    },
    null,
    2
  )
);
