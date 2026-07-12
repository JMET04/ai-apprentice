#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-validated-route-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-validated-route-command-builder"
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
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
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
    goalComplete: false
  };
}

function stableRequest(route, routerPath) {
  return {
    format: "transparent_ai_tlcl_apprentice_session_validated_route_downstream_request_v1",
    sourceRouterPath: routerPath || "<inline-router>",
    route: route?.route || "",
    nextTool: route?.nextTool || "",
    args: route?.args || {},
    commandTemplate: route?.commandTemplate || "",
    commandHint: route?.commandHint || "",
    handoffInputs: route?.handoffInputs || {},
    teacherConfirmation: "<teacher-reviewed-downstream-route>",
    executeNow: false,
    reviewOnly: true
  };
}

const routerInput = readJsonInput(argValue("--router", argValue("--route", "")), "--router");
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-apprentice-session-validated-route-command-builders")
  )
);
mkdirSync(outputRoot, { recursive: true });

const router = routerInput.value;
const route = router?.preparedRoute || null;
const blockerRows = [];
function block(code, message) {
  blockerRows.push({ code, message });
}

if (!router) block("router_missing", "A validated continuation router packet is required.");
if (router && router.format !== "transparent_ai_tlcl_apprentice_session_validated_continuation_router_v1") {
  block("router_format_invalid", "Router must be transparent_ai_tlcl_apprentice_session_validated_continuation_router_v1.");
}
if (router && router.ok !== true) block("router_not_ok", "Router must be ok=true.");
if (router && router.status !== "tlcl_validated_continuation_route_prepared_waiting_for_manual_downstream_review") {
  block("router_status_not_ready", "Router is not ready for manual downstream command building.");
}
if (!route) block("prepared_route_missing", "Router must contain preparedRoute.");
if (route?.executesNow !== false) block("route_execute_lock_missing", "preparedRoute must keep executesNow=false.");
if (!route?.nextTool) block("next_tool_missing", "preparedRoute.nextTool is required.");
if (router?.locks?.routerDoesNotInvokeDownstreamTool !== true) {
  block("source_router_lock_missing", "Source router must prove it did not invoke the downstream tool.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(route?.route || "blocked")}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });
const builderPath = join(builderDir, "tlcl-apprentice-session-validated-route-command-builder.json");
const htmlPath = join(builderDir, "tlcl-apprentice-session-validated-route-command-builder.html");
const readmePath = join(builderDir, "TLCL_VALIDATED_ROUTE_COMMAND_BUILDER_START_HERE.md");
const builderLocks = locks();
const ok = blockerRows.length === 0;
const status = ok
  ? "tlcl_validated_route_command_builder_waiting_for_teacher_copy"
  : "blocked_before_tlcl_validated_route_command_builder";
const downstreamRequest = ok ? stableRequest(route, routerInput.path) : null;

const builder = {
  ok,
  format: "transparent_ai_tlcl_apprentice_session_validated_route_command_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceRouterPath: routerInput.path,
  routeSummary: route
    ? {
        route: route.route,
        nextGate: route.nextGate,
        nextTool: route.nextTool,
        executesNow: false
      }
    : null,
  downstreamRequest,
  blockers: blockerRows,
  blockedActions: [
    "execute_downstream_tool_from_command_builder",
    "auto_run_command_from_command_builder",
    "invoke_model_from_command_builder",
    "fetch_rag_from_command_builder",
    "write_memory_from_command_builder",
    "enable_rule_from_command_builder",
    "unlock_packaging_from_command_builder",
    "claim_completion_from_command_builder"
  ],
  locks: builderLocks,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath
  }
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# TLCL Validated Route Command Builder",
    "",
    `- Status: ${status}`,
    `- Source router: ${routerInput.path || "<inline router>"}`,
    `- Next tool: ${downstreamRequest?.nextTool || "<blocked>"}`,
    `- Execute now: false`,
    "",
    "This builder gives a copyable downstream request and command template. It does not run the downstream tool.",
    "",
    "Downstream request:",
    "",
    "```json",
    JSON.stringify(downstreamRequest, null, 2),
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
  <title>TLCL Validated Route Command Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; background: #f7f9fc; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 22px; }
    h1 { font-size: 25px; margin: 0 0 8px; letter-spacing: 0; }
    section { background: #fff; border: 1px solid #d8e0ec; border-radius: 8px; padding: 15px; margin-top: 12px; }
    textarea { width: 100%; box-sizing: border-box; min-height: 180px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 8px 12px; cursor: pointer; margin: 6px 6px 0 0; }
    code { word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Validated Route Command Builder</h1>
    <p>Status: <code>${htmlEscape(status)}</code></p>
    <p>This page is copy-only. It does not execute downstream tools, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.</p>
    <section>
      <p>Builder: <a href="${htmlEscape(pathToFileURL(builderPath).href)}">${htmlEscape(builderPath)}</a></p>
      <p>Next tool: <code>${htmlEscape(downstreamRequest?.nextTool || "<blocked>")}</code></p>
    </section>
    <section>
      <h2>Downstream Request</h2>
      <textarea id="requestJson" spellcheck="false"></textarea>
      <button id="copyRequest">Copy downstream request JSON</button>
      <button id="copyCommand">Copy command template</button>
    </section>
    <section>
      <h2>Locks</h2>
      <textarea id="locksJson" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const requestArea = document.getElementById("requestJson");
    const locksArea = document.getElementById("locksJson");
    requestArea.value = JSON.stringify(builder.downstreamRequest, null, 2);
    locksArea.value = JSON.stringify(builder.locks, null, 2);
    document.getElementById("copyRequest").addEventListener("click", async () => {
      await navigator.clipboard.writeText(requestArea.value);
    });
    document.getElementById("copyCommand").addEventListener("click", async () => {
      await navigator.clipboard.writeText(builder.downstreamRequest?.commandTemplate || builder.downstreamRequest?.commandHint || "");
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
      ok,
      format: "transparent_ai_tlcl_apprentice_session_validated_route_command_builder_result_v1",
      status,
      route: route?.route || "",
      nextTool: route?.nextTool || "",
      builderPath,
      htmlPath,
      readmePath,
      blockers: blockerRows,
      locks: builderLocks
    },
    null,
    2
  )
);
