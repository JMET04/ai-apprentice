#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const EXECUTION_ADAPTER_IDS = new Set([
  "existing-browser-automation",
  "existing-cli-or-script",
  "existing-application-api",
  "existing-file-import-export",
  "existing-windows-ui-automation"
]);

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function multiArg(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return String(value || "execution-adapter")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "execution-adapter";
}

function readOptionalJson(input) {
  if (!input) return null;
  const text = String(input).trim();
  if (!text) return null;
  if (existsSync(text)) return JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, ""));
  if (text.startsWith("{") || text.startsWith("[")) return JSON.parse(text);
  return { reference: text };
}

function words(...values) {
  return values
    .flatMap((value) => String(value || "").toLowerCase().split(/[^a-z0-9]+/g))
    .filter(Boolean);
}

function includesAny(text, needles) {
  const normalized = String(text || "").toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function actionKinds(actionPlan) {
  const actions = Array.isArray(actionPlan?.actions) ? actionPlan.actions : [];
  return actions.map((action) => String(action.kind || "")).filter(Boolean);
}

function scoreAdapter(adapter, context) {
  const haystack = [
    adapter.id,
    ...(adapter.toolExamples || []),
    ...(adapter.bestFor || []),
    ...(adapter.acceptedInputs || [])
  ].join(" ").toLowerCase();
  let score = 0;
  for (const word of context.tokens) {
    if (haystack.includes(word)) score += 1;
  }
  if (context.preferredAdapters.includes(adapter.id)) score += 100;
  if (adapter.id === "existing-browser-automation" && includesAny(context.softwareText, ["browser", "chrome", "edge", "web", "url", "网页"])) score += 8;
  if (adapter.id === "existing-cli-or-script" && includesAny(context.softwareText, ["cli", "terminal", "shell", "command", "script", "powershell", "命令"])) score += 8;
  if (adapter.id === "existing-application-api" && includesAny(context.goalText, ["api", "sdk", "macro", "com", "接口", "宏"])) score += 7;
  if (adapter.id === "existing-file-import-export" && includesAny(context.goalText, ["import", "export", "csv", "json", "dxf", "svg", "file", "导入", "导出", "文件"])) score += 7;
  if (adapter.id === "existing-windows-ui-automation" && context.actionKinds.some((kind) => ["click", "drag", "type_text", "hotkey"].includes(kind))) score += 6;
  if (adapter.id === "existing-windows-ui-automation" && context.hasOverlayOrSpatialIntent) score += 5;
  if (adapter.nativeIntegrationRequired === false) score += 2;
  return score;
}

function adapterNextCall(adapter, selectionPath, actionPlanPath) {
  if (adapter.id === "existing-browser-automation") {
    return {
      tool: "create_supervised_software_action_kit",
      reason: "Use teacher-reviewed overlay/action evidence to generate browser-safe click/type candidates before any Playwright or browser recorder replay.",
      arguments: { actionAdapterSelection: selectionPath, actionPlan: actionPlanPath || undefined }
    };
  }
  if (adapter.id === "existing-cli-or-script" || adapter.id === "existing-application-api" || adapter.id === "existing-file-import-export") {
    return {
      tool: "verify_supervised_action_outcome",
      reason: "Prefer dry-run command/API/file evidence, then verify output files, logs, or receipts before memory.",
      arguments: { actionAdapterSelection: selectionPath }
    };
  }
  return {
    tool: "create_supervised_software_action_kit",
    reason: "Fall back to dry-run-first supervised UI actions only after existing API/file/CLI routes are reviewed.",
    arguments: { actionAdapterSelection: selectionPath, actionPlan: actionPlanPath || undefined }
  };
}

function jsString(value) {
  return JSON.stringify(String(value || ""));
}

function psSingle(value) {
  return String(value || "").replace(/'/g, "''");
}

function writeUtf8Bom(path, text) {
  writeFileSync(path, `\uFEFF${text}`, "utf8");
}

function actionSummary(actionPlan) {
  const actions = Array.isArray(actionPlan?.actions) ? actionPlan.actions : [];
  return actions.slice(0, 12).map((action, index) => ({
    index,
    id: action.id || `action-${index + 1}`,
    kind: action.kind || "unknown",
    at: action.at || null,
    textPreview: action.text ? String(action.text).slice(0, 80) : ""
  }));
}

function routeReadiness(adapterId, { actionPlan, capabilityProfile, observerQueue }) {
  const targetSoftware = actionPlan?.targetSoftware || {};
  const profileText = JSON.stringify(capabilityProfile || {}).toLowerCase();
  const queueText = JSON.stringify(observerQueue || {}).toLowerCase();
  const hasUrl = Boolean(targetSoftware.url || actionPlan?.url || profileText.includes("http"));
  const hasSelectors = JSON.stringify(actionPlan || {}).toLowerCase().includes("selector");
  const hasCommand = profileText.includes("command") || profileText.includes("cli") || profileText.includes("powershell");
  const hasApi = profileText.includes("api") || profileText.includes("sdk") || profileText.includes("com automation") || profileText.includes("rest");
  const hasFileRoute =
    profileText.includes("import") ||
    profileText.includes("export") ||
    profileText.includes("csv") ||
    profileText.includes("json") ||
    profileText.includes("dxf") ||
    profileText.includes("svg");
  const hasWindowTitle = Boolean(targetSoftware.windowTitle || actionPlan?.windowTitle);
  const hasLowTokenVerifier = queueText.includes("log") || queueText.includes("event") || queueText.includes("file");

  const base = {
    adapterId,
    readyForDryRun: true,
    readyForExecution: false,
    teacherReviewRequired: true,
    executeBlocker: "",
    requiredEvidenceBeforeExecute: [],
    lowTokenVerificationSignals: [
      "execution receipt",
      "preflight status",
      "metadata-only log or file delta",
      "teacher marker",
      "triggered screenshot only after cheap evidence is ambiguous"
    ]
  };

  if (adapterId === "existing-browser-automation") {
    base.readyForExecution = hasUrl && hasSelectors;
    base.executeBlocker = base.readyForExecution ? "" : "missing_reviewed_browser_url_or_selectors";
    base.requiredEvidenceBeforeExecute = ["reviewed target URL", "reviewed selector map", "dry-run browser receipt", "post-action page-state verifier"];
  } else if (adapterId === "existing-cli-or-script") {
    base.readyForExecution = hasCommand;
    base.executeBlocker = base.readyForExecution ? "" : "missing_reviewed_command_or_script";
    base.requiredEvidenceBeforeExecute = ["reviewed command", "non-destructive dry-run", "expected exit code", "output-file or log verifier"];
  } else if (adapterId === "existing-application-api") {
    base.readyForExecution = hasApi;
    base.executeBlocker = base.readyForExecution ? "" : "missing_reviewed_api_or_macro_contract";
    base.requiredEvidenceBeforeExecute = ["reviewed API or macro method", "payload schema", "auth boundary", "structured response verifier"];
  } else if (adapterId === "existing-file-import-export") {
    base.readyForExecution = hasFileRoute;
    base.executeBlocker = base.readyForExecution ? "" : "missing_reviewed_file_import_export_mapping";
    base.requiredEvidenceBeforeExecute = ["source save-copy", "reviewed import/export schema", "dry-run diff", "rollback path"];
  } else {
    base.readyForExecution = hasWindowTitle && hasLowTokenVerifier;
    base.executeBlocker = base.readyForExecution ? "" : "missing_target_window_or_low_token_verifier";
    base.requiredEvidenceBeforeExecute = ["reviewed target window title", "coordinate preflight", "dry-run UI receipt", "log/file/event verifier"];
  }

  return base;
}

function writeExecutionRunner(adapterId, packageDir, executionPackagePath, receiptPath, context) {
  if (adapterId === "existing-browser-automation") {
    const runnerPath = join(packageDir, "run-existing-browser-automation.mjs");
    const script = `#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^$(){}|[\\]\\\\]/g, "\\\\$&");
}
function isPlainFileName(value) {
  return Boolean(value) && basename(String(value)) === String(value);
}
function applySetText(html, selector, value) {
  if (!String(selector || "").startsWith("#")) throw new Error("only_id_selector_supported_for_local_dom_proof");
  const id = escapeRegExp(String(selector).slice(1));
  const escapedValue = escapeHtml(value);
  const textareaPattern = new RegExp("(<textarea\\\\b[^>]*\\\\bid=[\\\"']" + id + "[\\\"'][^>]*>)([\\\\s\\\\S]*?)(<\\\\/textarea>)", "i");
  if (textareaPattern.test(html)) return html.replace(textareaPattern, "$1" + escapedValue + "$3");
  const valuePattern = new RegExp("(<input\\\\b[^>]*\\\\bid=[\\\"']" + id + "[\\\"'][^>]*\\\\bvalue=[\\\"'])(.*?)([\\\"'][^>]*>)", "i");
  if (valuePattern.test(html)) return html.replace(valuePattern, "$1" + escapedValue + "$3");
  const inputPattern = new RegExp("(<input\\\\b[^>]*\\\\bid=[\\\"']" + id + "[\\\"'][^>]*)(>)", "i");
  if (inputPattern.test(html)) return html.replace(inputPattern, "$1 value=\\"" + escapedValue + "\\"$2");
  const elementPattern = new RegExp("(<([a-z0-9-]+)\\\\b[^>]*\\\\bid=[\\\"']" + id + "[\\\"'][^>]*>)([\\\\s\\\\S]*?)(<\\\\/\\\\2>)", "i");
  if (elementPattern.test(html)) return html.replace(elementPattern, "$1" + escapedValue + "$4");
  throw new Error("reviewed_selector_not_found_in_local_html");
}
function assertLoopbackUrl(value, allowedProtocols) {
  const parsed = new URL(String(value || ""));
  const host = parsed.hostname.toLowerCase();
  const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  if (!isLoopback) throw new Error("cdp_endpoint_must_be_localhost_or_loopback");
  if (!allowedProtocols.includes(parsed.protocol)) throw new Error("cdp_endpoint_protocol_not_allowed");
  if (parsed.username || parsed.password) throw new Error("cdp_endpoint_must_not_include_credentials");
  return parsed;
}
async function resolveCdpWebSocketUrl(target) {
  if (target.webSocketDebuggerUrl) {
    return assertLoopbackUrl(target.webSocketDebuggerUrl, ["ws:"]).toString();
  }
  if (!target.cdpEndpoint) throw new Error("cdpEndpoint_or_webSocketDebuggerUrl_required");
  const endpoint = assertLoopbackUrl(target.cdpEndpoint, ["http:"]);
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("cdp_endpoint_http_status_" + response.status);
  const body = await response.json();
  const candidate = Array.isArray(body) ? body[0]?.webSocketDebuggerUrl : body.webSocketDebuggerUrl;
  if (!candidate) throw new Error("cdp_webSocketDebuggerUrl_missing_from_endpoint");
  return assertLoopbackUrl(candidate, ["ws:"]).toString();
}
function cdpSetTextExpression(selector, value) {
  return [
    "(() => {",
    "const selector = " + JSON.stringify(selector) + ";",
    "const value = " + JSON.stringify(String(value ?? "")) + ";",
    "const element = document.querySelector(selector);",
    "if (!element) throw new Error('reviewed_selector_not_found_in_live_browser');",
    "if ('value' in element) {",
    "element.value = value;",
    "element.dispatchEvent(new Event('input', { bubbles: true }));",
    "element.dispatchEvent(new Event('change', { bubbles: true }));",
    "return { ok: true, mode: 'value', selector, valueLength: value.length };",
    "}",
    "element.textContent = value;",
    "return { ok: true, mode: 'textContent', selector, valueLength: value.length };",
    "})()"
  ].join("\\n");
}
function sendCdpCommand(webSocketUrl, method, params) {
  return new Promise((resolvePromise, rejectPromise) => {
    const ws = new WebSocket(webSocketUrl);
    const id = 1;
    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      rejectPromise(new Error("cdp_command_timeout"));
    }, 5000);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.id !== id) return;
        clearTimeout(timer);
        try { ws.close(); } catch {}
        if (message.error) rejectPromise(new Error("cdp_error_" + (message.error.message || message.error.code || "unknown")));
        else resolvePromise(message.result || {});
      } catch (error) {
        clearTimeout(timer);
        try { ws.close(); } catch {}
        rejectPromise(error);
      }
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      rejectPromise(new Error("cdp_websocket_error"));
    });
  });
}

const teacherConfirmed = args.has("--teacher-confirmed");
const execute = args.has("--execute");
const reviewedBrowserTargetPath = argValue("--reviewed-browser-target", "");
const receiptPath = ${jsString(receiptPath)};
const executionPackagePath = ${jsString(executionPackagePath)};
const packageDir = ${jsString(packageDir)};
const domOutputDir = join(packageDir, "browser-dom-output");
const cdpOutputDir = join(packageDir, "browser-cdp-output");

const receipt = {
  format: "transparent_ai_existing_software_execution_receipt_v1",
  adapterId: "existing-browser-automation",
  executionPackagePath,
  mode: teacherConfirmed && execute ? "execute_requested" : "dry_run",
  teacherConfirmed,
  execute,
  uiEventsSent: false,
  browserAutomationAttempted: false,
  reviewedBrowserTargetPath,
  browserDomOperationApplied: false,
  browserCdpOperationApplied: false,
  targetHtmlFile: "",
  targetSelector: "",
  browserDomOutputPath: "",
  cdpWebSocketUrl: "",
  cdpResponsePath: "",
  cdpResultSha256: "",
  sourceSha256: "",
  outputSha256: "",
  status: "dry_run_no_browser_events",
  notes: [
    "Dry-run default: review selectors, URL, and action summary before any browser automation.",
    "Execute mode supports reviewed local HTML DOM copy operations or reviewed localhost Chrome DevTools Protocol setText operations."
  ],
  locks: {
    ruleEnabled: false,
    accepted: false,
    technologyAccepted: false,
    packagingGated: true,
    nativeUniversalExecution: false
  },
  createdAt: new Date().toISOString()
};

if (teacherConfirmed && execute) {
  if (!reviewedBrowserTargetPath) {
    receipt.status = "blocked_missing_reviewed_browser_target";
  } else {
    try {
      const target = JSON.parse(readFileSync(reviewedBrowserTargetPath, "utf8").replace(/^\\uFEFF/, ""));
      if (target.teacherReviewed !== true) throw new Error("browser_target_teacherReviewed_must_be_true");
      if (target.targetKind !== "local-html-dom" && target.targetKind !== "local-browser-cdp") throw new Error("only_local_html_dom_or_local_browser_cdp_targetKind_supported");
      if (!target.selector) throw new Error("selector_required");
      if (target.operation !== "setText") throw new Error("only_setText_operation_supported");
      if (target.targetKind === "local-browser-cdp") {
        const targetName = String(target.targetResponseFileName || "browser-cdp-result.json");
        if (!isPlainFileName(targetName)) throw new Error("targetResponseFileName_must_be_plain_file_name");
        const webSocketUrl = await resolveCdpWebSocketUrl(target);
        const result = await sendCdpCommand(webSocketUrl, "Runtime.evaluate", {
          expression: cdpSetTextExpression(target.selector, target.value ?? ""),
          awaitPromise: true,
          returnByValue: true,
          userGesture: true
        });
        mkdirSync(cdpOutputDir, { recursive: true });
        const outputPath = join(cdpOutputDir, targetName);
        writeFileSync(outputPath, JSON.stringify({ method: "Runtime.evaluate", result }, null, 2) + "\\n", "utf8");
        receipt.browserAutomationAttempted = true;
        receipt.browserCdpOperationApplied = true;
        receipt.targetSelector = String(target.selector);
        receipt.cdpWebSocketUrl = webSocketUrl;
        receipt.cdpResponsePath = outputPath;
        receipt.cdpResultSha256 = sha256(outputPath);
        receipt.status = "teacher_confirmed_browser_cdp_setText_applied";
        receipt.mode = "teacher_confirmed_execute";
        receipt.notes.push("Applied a teacher-reviewed setText operation through a localhost Chrome DevTools Protocol endpoint.");
      } else {
      if (!target.targetHtmlFile) throw new Error("targetHtmlFile_required");
      const targetName = String(target.targetOutputFileName || "browser-dom-output.html");
      if (!isPlainFileName(targetName)) throw new Error("targetOutputFileName_must_be_plain_file_name");
      const targetHtmlFile = resolve(String(target.targetHtmlFile));
      if (!existsSync(targetHtmlFile)) throw new Error("target_html_file_missing");
      const sourceHash = sha256(targetHtmlFile);
      if (target.expectedSourceSha256 && sourceHash !== String(target.expectedSourceSha256).toLowerCase()) throw new Error("expected_source_sha256_mismatch");
      const html = readFileSync(targetHtmlFile, "utf8").replace(/^\\uFEFF/, "");
      const outputHtml = applySetText(html, target.selector, target.value ?? "");
      mkdirSync(domOutputDir, { recursive: true });
      const outputPath = join(domOutputDir, targetName);
      writeFileSync(outputPath, outputHtml, "utf8");
      receipt.browserAutomationAttempted = true;
      receipt.browserDomOperationApplied = true;
      receipt.targetHtmlFile = targetHtmlFile;
      receipt.targetSelector = String(target.selector);
      receipt.browserDomOutputPath = outputPath;
      receipt.sourceSha256 = sourceHash;
      receipt.outputSha256 = sha256(outputPath);
      receipt.status = "teacher_confirmed_browser_dom_operation_applied";
      receipt.mode = "teacher_confirmed_execute";
      receipt.notes.push("Applied a teacher-reviewed local DOM operation to a local HTML copy; no live browser UI events were sent.");
      }
    } catch (error) {
      receipt.status = "blocked_reviewed_browser_target_invalid:" + (error?.message || String(error));
      receipt.browserAutomationAttempted = false;
      receipt.browserDomOperationApplied = false;
      receipt.browserCdpOperationApplied = false;
    }
  }
}

writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\\n", "utf8");
console.log(JSON.stringify({ ok: true, receiptPath, status: receipt.status }, null, 2));
`;
    writeFileSync(runnerPath, script, "utf8");
    return runnerPath;
  }

  if (adapterId === "existing-cli-or-script") {
    const runnerPath = join(packageDir, "run-existing-cli-or-script.ps1");
    const script = `param(
  [switch]$TeacherConfirmed,
  [switch]$Execute,
  [string]$ReviewedCommand = ""
)

$ReceiptPath = '${psSingle(receiptPath)}'
$ExecutionPackagePath = '${psSingle(executionPackagePath)}'
$PackageDir = '${psSingle(packageDir)}'
$CliOutputDir = Join-Path $PackageDir 'cli-output'
$NodePath = '${psSingle(process.execPath)}'
$Receipt = [pscustomobject]@{
  format = "transparent_ai_existing_software_execution_receipt_v1"
  adapterId = "existing-cli-or-script"
  executionPackagePath = $ExecutionPackagePath
  mode = if ($TeacherConfirmed -and $Execute) { "execute_requested" } else { "dry_run" }
  teacherConfirmed = [bool]$TeacherConfirmed
  execute = [bool]$Execute
  commandExecuted = $false
  reviewedCommandPath = $ReviewedCommand
  cliOutputPath = ""
  scriptSha256 = ""
  outputSha256 = ""
  exitCode = $null
  status = "dry_run_no_command_executed"
  notes = @(
    "Dry-run default: add a teacher-reviewed command manifest before running a CLI/script route.",
    "Execute mode is limited to a reviewed Node script and writes only inside this execution package's cli-output directory."
  )
  locks = [pscustomobject]@{ ruleEnabled = $false; accepted = $false; technologyAccepted = $false; packagingGated = $true; nativeUniversalExecution = $false }
}
if ($TeacherConfirmed -and $Execute) {
  if (-not $ReviewedCommand) {
    $Receipt.status = "blocked_missing_reviewed_command"
  } else {
    try {
      if (-not (Test-Path -LiteralPath $ReviewedCommand)) { throw "reviewed_command_manifest_missing" }
      $Command = Get-Content -LiteralPath $ReviewedCommand -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($Command.teacherReviewed -ne $true) { throw "command_teacherReviewed_must_be_true" }
      if ($Command.commandKind -ne "node-script") { throw "only_node_script_commandKind_supported" }
      if (-not $Command.scriptSourceFile) { throw "scriptSourceFile_required" }
      if (-not $Command.targetOutputFileName) { throw "targetOutputFileName_required" }
      $TargetName = [string]$Command.targetOutputFileName
      if ([IO.Path]::GetFileName($TargetName) -ne $TargetName) { throw "targetOutputFileName_must_be_plain_file_name" }
      $ScriptPath = [IO.Path]::GetFullPath([string]$Command.scriptSourceFile)
      if (-not (Test-Path -LiteralPath $ScriptPath)) { throw "script_source_missing" }
      if (-not $Command.expectedScriptSha256) { throw "expectedScriptSha256_required" }
      $ScriptHash = (Get-FileHash -LiteralPath $ScriptPath -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($ScriptHash -ne ([string]$Command.expectedScriptSha256).ToLowerInvariant()) { throw "expected_script_sha256_mismatch" }
      New-Item -ItemType Directory -Force -Path $CliOutputDir | Out-Null
      $OutputPath = Join-Path $CliOutputDir $TargetName
      & $NodePath $ScriptPath $OutputPath
      $ExitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
      $Receipt.exitCode = $ExitCode
      if ($ExitCode -ne 0) { throw "reviewed_node_script_failed_exit_$ExitCode" }
      if (-not (Test-Path -LiteralPath $OutputPath)) { throw "expected_cli_output_missing" }
      $Receipt.commandExecuted = $true
      $Receipt.cliOutputPath = $OutputPath
      $Receipt.scriptSha256 = $ScriptHash
      $Receipt.outputSha256 = (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash.ToLowerInvariant()
      $Receipt.status = "teacher_confirmed_cli_script_executed"
      $Receipt.mode = "teacher_confirmed_execute"
      $Receipt.notes += "Executed a teacher-reviewed Node script with hash verification and wrote output inside the execution package."
    } catch {
      $Receipt.status = "blocked_reviewed_command_invalid:$($_.Exception.Message)"
      $Receipt.commandExecuted = $false
    }
  }
}
$Receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReceiptPath -Encoding UTF8
$Receipt | ConvertTo-Json -Depth 8
`;
    writeUtf8Bom(runnerPath, script);
    return runnerPath;
  }

  if (adapterId === "existing-application-api") {
    const runnerPath = join(packageDir, "run-existing-application-api-request.mjs");
    const script = `#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const args = new Set(process.argv.slice(2));
function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}
function isPlainFileName(value) {
  return Boolean(value) && basename(String(value)) === String(value);
}
function isAllowedLocalApiUrl(value) {
  const url = new URL(value);
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  );
}
function reviewedHeaders(headers) {
  const output = {};
  for (const [name, value] of Object.entries(headers || {})) {
    const normalized = String(name).toLowerCase();
    if (["authorization", "cookie", "set-cookie", "x-api-key", "api-key"].includes(normalized)) {
      throw new Error("secret_or_session_header_not_allowed_in_reviewed_api_manifest");
    }
    output[name] = String(value);
  }
  return output;
}

const teacherConfirmed = args.has("--teacher-confirmed");
const execute = args.has("--execute");
const reviewedApiRequestPath = argValue("--reviewed-api-request", "");
const receiptPath = ${jsString(receiptPath)};
const executionPackagePath = ${jsString(executionPackagePath)};
const packageDir = ${jsString(packageDir)};
const responseDir = join(packageDir, "api-responses");
const receipt = {
  format: "transparent_ai_existing_software_execution_receipt_v1",
  adapterId: "existing-application-api",
  executionPackagePath,
  mode: teacherConfirmed && execute ? "execute_requested" : "dry_run",
  teacherConfirmed,
  execute,
  reviewedApiRequestPath,
  apiRequestSent: false,
  requestUrl: "",
  requestMethod: "",
  responseStatus: null,
  responseBodyPath: "",
  responseSha256: "",
  status: "dry_run_no_api_request_sent",
  notes: [
    "Dry-run default: add a teacher-reviewed local API request manifest before running an application API route.",
    "Execute mode is limited to localhost/loopback URLs and writes the response only inside this execution package's api-responses directory."
  ],
  locks: { ruleEnabled: false, accepted: false, technologyAccepted: false, packagingGated: true, nativeUniversalExecution: false },
  createdAt: new Date().toISOString()
};
if (teacherConfirmed && execute) {
  if (!reviewedApiRequestPath) {
    receipt.status = "blocked_missing_reviewed_api_request";
  } else {
    try {
      const manifest = JSON.parse(readFileSync(reviewedApiRequestPath, "utf8").replace(/^\\uFEFF/, ""));
      if (manifest.teacherReviewed !== true) throw new Error("api_request_teacherReviewed_must_be_true");
      if (!manifest.url) throw new Error("api_url_required");
      if (!isAllowedLocalApiUrl(manifest.url)) throw new Error("api_url_must_be_localhost_or_loopback_for_controlled_execute");
      const method = String(manifest.method || "GET").toUpperCase();
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) throw new Error("api_method_not_allowed");
      const targetName = String(manifest.targetResponseFileName || "api-response.json");
      if (!isPlainFileName(targetName)) throw new Error("targetResponseFileName_must_be_plain_file_name");
      const headers = reviewedHeaders(manifest.headers || {});
      let body;
      if (manifest.bodyJson !== undefined) {
        body = JSON.stringify(manifest.bodyJson);
        if (!headers["content-type"] && !headers["Content-Type"]) headers["content-type"] = "application/json";
      } else if (manifest.bodyText !== undefined) {
        body = String(manifest.bodyText);
      }
      const controller = new AbortController();
      const timeoutMs = Math.min(Math.max(Number(manifest.timeoutMs || 5000), 250), 30000);
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      receipt.requestUrl = manifest.url;
      receipt.requestMethod = method;
      const response = await fetch(manifest.url, { method, headers, body, signal: controller.signal });
      clearTimeout(timeout);
      receipt.apiRequestSent = true;
      receipt.responseStatus = response.status;
      const responseText = await response.text();
      mkdirSync(responseDir, { recursive: true });
      const responseBodyPath = join(responseDir, targetName);
      writeFileSync(responseBodyPath, responseText + (responseText.endsWith("\\n") ? "" : "\\n"), "utf8");
      receipt.responseBodyPath = responseBodyPath;
      receipt.responseSha256 = sha256Text(responseText + (responseText.endsWith("\\n") ? "" : "\\n"));
      const expectedStatus = Number(manifest.expectedStatus || 200);
      if (response.status !== expectedStatus) {
        receipt.status = "api_response_status_mismatch_waiting_for_teacher_review";
        receipt.notes.push("API request was sent, but the reviewed expectedStatus did not match the response status.");
      } else {
        receipt.status = "teacher_confirmed_api_request_completed";
        receipt.mode = "teacher_confirmed_execute";
        receipt.notes.push("Executed a teacher-reviewed local API request and stored the response in the execution package.");
      }
    } catch (error) {
      receipt.status = "blocked_reviewed_api_request_invalid:" + (error?.message || String(error));
      receipt.apiRequestSent = false;
    }
  }
}
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\\n", "utf8");
console.log(JSON.stringify({ ok: true, receiptPath, status: receipt.status }, null, 2));
`;
    writeFileSync(runnerPath, script, "utf8");
    return runnerPath;
  }

  if (adapterId === "existing-file-import-export") {
    const runnerPath = join(packageDir, "prepare-existing-file-import-export.mjs");
    const script = `#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, join, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const teacherConfirmed = args.has("--teacher-confirmed");
const execute = args.has("--execute");
const reviewedMappingPath = argValue("--reviewed-mapping", "");
const receiptPath = ${jsString(receiptPath)};
const executionPackagePath = ${jsString(executionPackagePath)};
const packageDir = ${jsString(packageDir)};
const preparedDir = join(packageDir, "prepared-import-files");

const receipt = {
  format: "transparent_ai_existing_software_execution_receipt_v1",
  adapterId: "existing-file-import-export",
  executionPackagePath,
  mode: teacherConfirmed && execute ? "execute_requested" : "dry_run",
  teacherConfirmed,
  execute,
  reviewedMappingPath,
  filesWrittenForImport: false,
  preparedImportFilePath: "",
  backupFilePath: "",
  sourceSha256: "",
  preparedFileSha256: "",
  status: teacherConfirmed && execute ? "blocked_missing_reviewed_file_mapping" : "dry_run_no_files_written",
  notes: [
    "Dry-run default: add a teacher-reviewed mapping before preparing import/export files.",
    "Execute mode writes only inside this execution package's prepared-import-files directory."
  ],
  locks: { ruleEnabled: false, accepted: false, technologyAccepted: false, packagingGated: true, nativeUniversalExecution: false },
  createdAt: new Date().toISOString()
};

if (teacherConfirmed && execute && reviewedMappingPath) {
  try {
    const mapping = JSON.parse(readFileSync(reviewedMappingPath, "utf8").replace(/^\\uFEFF/, ""));
    const sourceFile = resolve(String(mapping.sourceFile || ""));
    const targetFileName = String(mapping.targetFileName || "");
    if (mapping.teacherReviewed !== true) throw new Error("mapping_teacherReviewed_must_be_true");
    if (!existsSync(sourceFile)) throw new Error("source_file_missing");
    if (!targetFileName || basename(targetFileName) !== targetFileName) throw new Error("targetFileName_must_be_plain_file_name");
    mkdirSync(preparedDir, { recursive: true });
    const targetPath = join(preparedDir, targetFileName);
    if (existsSync(targetPath)) {
      const backupPath = join(preparedDir, \`\${targetFileName}.rollback-\${Date.now()}.bak\`);
      copyFileSync(targetPath, backupPath);
      receipt.backupFilePath = backupPath;
    }
    const sourceDigest = sha256(sourceFile);
    if (mapping.expectedSourceSha256 && String(mapping.expectedSourceSha256) !== sourceDigest) {
      throw new Error("expected_source_sha256_mismatch");
    }
    copyFileSync(sourceFile, targetPath);
    receipt.filesWrittenForImport = true;
    receipt.preparedImportFilePath = targetPath;
    receipt.sourceSha256 = sourceDigest;
    receipt.preparedFileSha256 = sha256(targetPath);
    receipt.status = "teacher_confirmed_file_prepared_for_import";
    receipt.mode = "teacher_confirmed_execute";
    receipt.notes.push("Prepared a reviewed import/export file inside the execution package; teacher still must import it into target software and verify the outcome.");
  } catch (error) {
    receipt.status = \`blocked_reviewed_file_mapping_invalid:\${error.message}\`;
    receipt.filesWrittenForImport = false;
  }
}

writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\\n", "utf8");
console.log(JSON.stringify({ ok: true, receiptPath, status: receipt.status }, null, 2));
`;
    writeFileSync(runnerPath, script, "utf8");
    return runnerPath;
  }

  const runnerPath = join(packageDir, "run-existing-windows-ui-automation.ps1");
  const script = `param(
  [switch]$TeacherConfirmed,
  [switch]$Execute,
  [string]$ReviewedActionPlan = '${psSingle(context.reviewedActionPlanPath || "")}',
  [string]$TargetWindowTitle = ""
)

$ReceiptPath = '${psSingle(receiptPath)}'
$ExecutionPackagePath = '${psSingle(executionPackagePath)}'
$PackageDir = Split-Path -Parent $ReceiptPath
$PreflightPath = Join-Path $PackageDir "existing-windows-ui-automation-preflight.json"

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class TaaExistingRouteWindow {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@

function Get-ActiveWindowSummary {
  $Handle = [TaaExistingRouteWindow]::GetForegroundWindow()
  $Builder = New-Object System.Text.StringBuilder 512
  [void][TaaExistingRouteWindow]::GetWindowText($Handle, $Builder, $Builder.Capacity)
  [pscustomobject]@{ handle = $Handle.ToInt64(); title = $Builder.ToString() }
}

function Test-NormalizedCoordinateBounds {
  param($Plan)
  foreach ($Action in $Plan.actions) {
    foreach ($Name in @("at", "from", "to")) {
      $Point = $Action.$Name
      if ($null -eq $Point) { continue }
      if ($Point.xNormalized -lt 0 -or $Point.xNormalized -gt 1 -or $Point.yNormalized -lt 0 -or $Point.yNormalized -gt 1) {
        return $false
      }
    }
  }
  return $true
}

function Write-RoutePreflight {
  param(
    [string]$Status,
    [string]$Reason,
    [object]$Plan,
    [string]$ExpectedTitle
  )
  $ActiveWindow = Get-ActiveWindowSummary
  $TitleMatched = $false
  if (-not [string]::IsNullOrWhiteSpace($ExpectedTitle)) {
    $TitleMatched = $ActiveWindow.title -like "*$ExpectedTitle*"
  }
  $CoordinateBoundsOk = if ($null -ne $Plan) { Test-NormalizedCoordinateBounds $Plan } else { $false }
  $Preflight = [pscustomobject]@{
    format = "transparent_ai_existing_windows_ui_preflight_v1"
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    status = $Status
    reason = $Reason
    reviewedActionPlanPath = $ReviewedActionPlan
    teacherConfirmed = [bool]$TeacherConfirmed
    executeSwitchPresent = [bool]$Execute
    expectedWindowTitle = $ExpectedTitle
    activeWindow = $ActiveWindow
    activeWindowTitleMatched = [bool]$TitleMatched
    coordinateBoundsOk = [bool]$CoordinateBoundsOk
    executeAllowed = [bool]($TeacherConfirmed -and $Execute -and $TitleMatched -and $CoordinateBoundsOk)
    blockReasons = @(
      if (-not $TeacherConfirmed) { "missing TeacherConfirmed switch" }
      if (-not $Execute) { "missing Execute switch" }
      if ([string]::IsNullOrWhiteSpace($ExpectedTitle)) { "missing reviewed target window title" }
      if (-not $TitleMatched) { "active window title mismatch" }
      if (-not $CoordinateBoundsOk) { "normalized coordinate outside 0..1 bounds or plan missing" }
    )
    lowTokenPostActionVerification = [pscustomobject]@{
      preferredSignals = @("execution receipt", "preflight status", "target software log delta", "file modified-time delta", "manual teacher marker", "triggered screenshot only if ambiguous")
      nextSuggestedTools = @("verify_supervised_action_outcome", "watch_log_source_metadata_deltas", "teach_apprentice", "correct_last_result")
    }
    locks = [pscustomobject]@{ ruleEnabled = $false; accepted = $false; technologyAccepted = $false; packagingGated = $true; nativeUniversalExecution = $false }
  }
  $Preflight | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $PreflightPath -Encoding UTF8
  $Preflight
}

function Write-RouteReceipt {
  param(
    [string]$Status,
    [string]$Reason,
    [object[]]$ExecutedActionIds,
    [object]$Preflight,
    [bool]$UiEventsSent
  )
  $Receipt = [pscustomobject]@{
    format = "transparent_ai_existing_software_execution_receipt_v1"
    adapterId = "existing-windows-ui-automation"
    executionPackagePath = $ExecutionPackagePath
    mode = if ($TeacherConfirmed -and $Execute) { "teacher_confirmed_execute" } else { "dry_run" }
    teacherConfirmed = [bool]$TeacherConfirmed
    execute = [bool]$Execute
    reviewedActionPlanPath = $ReviewedActionPlan
    preflightPath = $PreflightPath
    preflightStatus = $Preflight.status
    activeWindowTitleMatched = $Preflight.activeWindowTitleMatched
    coordinateBoundsOk = $Preflight.coordinateBoundsOk
    uiEventsSent = [bool]$UiEventsSent
    status = $Status
    reason = $Reason
    actionSummary = @(${context.actionSummary.map((action) => `"${psSingle(`${action.id}:${action.kind}`)}"`).join(", ")})
    executedActionIds = @($ExecutedActionIds)
    lowTokenPostActionVerification = [pscustomobject]@{
      preferredSignals = @("execution receipt", "preflight status", "target software log delta", "file modified-time delta", "manual teacher marker", "triggered screenshot only if ambiguous")
    }
    teacherReviewFields = [pscustomobject]@{
      targetWindowWasCorrect = "needs_teacher_review"
      visibleResultMatchedTeacherIntent = "needs_teacher_review"
      nextDecision = "needs_teacher_review"
      teacherNote = ""
    }
    locks = [pscustomobject]@{ ruleEnabled = $false; accepted = $false; technologyAccepted = $false; packagingGated = $true; nativeUniversalExecution = $false }
  }
  $Receipt | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReceiptPath -Encoding UTF8
  $Receipt
}

function Convert-NormalizedPoint {
  param($Point)
  Add-Type -AssemblyName System.Windows.Forms
  $Bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  [pscustomobject]@{
    X = [int]($Bounds.Left + ($Point.xNormalized * $Bounds.Width))
    Y = [int]($Bounds.Top + ($Point.yNormalized * $Bounds.Height))
  }
}

$Plan = $null
if (-not [string]::IsNullOrWhiteSpace($ReviewedActionPlan) -and (Test-Path -LiteralPath $ReviewedActionPlan)) {
  $Plan = Get-Content -LiteralPath $ReviewedActionPlan -Raw -Encoding UTF8 | ConvertFrom-Json
}
$ExpectedTitle = $TargetWindowTitle
if ([string]::IsNullOrWhiteSpace($ExpectedTitle) -and $null -ne $Plan) {
  $ExpectedTitle = [string]$Plan.targetSoftware.windowTitle
}

if (-not $TeacherConfirmed -or -not $Execute) {
  $Preflight = Write-RoutePreflight -Status "dry_run_preflight" -Reason "No mouse or keyboard events will be sent without both TeacherConfirmed and Execute." -Plan $Plan -ExpectedTitle $ExpectedTitle
  Write-RouteReceipt -Status "dry_run_no_ui_events" -Reason "TeacherConfirmed and Execute are both required before UI events are sent." -ExecutedActionIds @() -Preflight $Preflight -UiEventsSent $false | ConvertTo-Json -Depth 12
  exit 0
}

if ($null -eq $Plan) {
  $Preflight = Write-RoutePreflight -Status "blocked_missing_reviewed_action_plan" -Reason "Execute mode requires a reviewed supervised action plan path." -Plan $null -ExpectedTitle $ExpectedTitle
  Write-RouteReceipt -Status "blocked_missing_reviewed_action_plan" -Reason "No reviewed action plan was available for Windows UI execution." -ExecutedActionIds @() -Preflight $Preflight -UiEventsSent $false | ConvertTo-Json -Depth 12
  exit 0
}

$Preflight = Write-RoutePreflight -Status "execute_preflight" -Reason "Teacher supplied execution switches; checking active window and coordinate bounds before sending UI events." -Plan $Plan -ExpectedTitle $ExpectedTitle
if (-not $Preflight.executeAllowed) {
  Write-RouteReceipt -Status "blocked_by_preflight" -Reason "Preflight blocked Windows UI execution before mouse or keyboard events." -ExecutedActionIds @() -Preflight $Preflight -UiEventsSent $false | ConvertTo-Json -Depth 12
  exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class TaaExistingRouteMouse {
  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@

$MOUSEEVENTF_LEFTDOWN = 0x0002
$MOUSEEVENTF_LEFTUP = 0x0004
$Executed = New-Object System.Collections.ArrayList

foreach ($Action in $Plan.actions) {
  if ($Action.kind -eq "click") {
    $P = Convert-NormalizedPoint $Action.at
    [TaaExistingRouteMouse]::SetCursorPos($P.X, $P.Y) | Out-Null
    Start-Sleep -Milliseconds 80
    [TaaExistingRouteMouse]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 80
    [TaaExistingRouteMouse]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
    [void]$Executed.Add($Action.id)
  } elseif ($Action.kind -eq "drag") {
    $From = Convert-NormalizedPoint $Action.from
    $To = Convert-NormalizedPoint $Action.to
    [TaaExistingRouteMouse]::SetCursorPos($From.X, $From.Y) | Out-Null
    Start-Sleep -Milliseconds 80
    [TaaExistingRouteMouse]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 120
    [TaaExistingRouteMouse]::SetCursorPos($To.X, $To.Y) | Out-Null
    Start-Sleep -Milliseconds 120
    [TaaExistingRouteMouse]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
    [void]$Executed.Add($Action.id)
  } elseif ($Action.kind -eq "type_text") {
    [System.Windows.Forms.SendKeys]::SendWait($Action.text)
    [void]$Executed.Add($Action.id)
  } elseif ($Action.kind -eq "hotkey") {
    [System.Windows.Forms.SendKeys]::SendWait($Action.hotkey)
    [void]$Executed.Add($Action.id)
  } else {
    throw "Unsupported action kind: $($Action.kind)"
  }
}

Write-RouteReceipt -Status "teacher_confirmed_windows_ui_actions_sent" -Reason "Teacher confirmed visible target window, preflight passed, and execution switch was present." -ExecutedActionIds @($Executed) -Preflight $Preflight -UiEventsSent $true | ConvertTo-Json -Depth 12
`;
  writeUtf8Bom(runnerPath, script);
  return runnerPath;
}

function writeExecutionPackage(selectionDir, selectedAdapters, selectionPath, actionPlan, goal, software, locks, routeContext) {
  const packageDir = join(selectionDir, "existing-execution-package");
  mkdirSync(packageDir, { recursive: true });
  const executionPackagePath = join(packageDir, "execution-package.json");
  const packageReceiptTemplatePath = join(packageDir, "execution-package-receipt-template.json");
  const actionSummaryItems = actionSummary(actionPlan);
  const packageActionPlanPath = actionPlan ? join(packageDir, "reviewed-supervised-action-plan.json") : "";
  if (actionPlan) writeFileSync(packageActionPlanPath, `${JSON.stringify(actionPlan, null, 2)}\n`, "utf8");
  const runnerEntries = selectedAdapters.map((adapter) => {
    const receiptPath = join(packageDir, `${adapter.id}-execution-receipt.json`);
    const runnerPath = writeExecutionRunner(adapter.id, packageDir, executionPackagePath, receiptPath, { actionSummary: actionSummaryItems, reviewedActionPlanPath: packageActionPlanPath });
    const readiness = routeReadiness(adapter.id, routeContext);
    return {
      adapterId: adapter.id,
      runnerPath,
      receiptPath,
      defaultMode: "dry_run",
      teacherConfirmationRequired: true,
      executeFlagRequired: true,
      routeReadiness: readiness,
      executeBlocker: readiness.executeBlocker,
      proofChecklist: readiness.requiredEvidenceBeforeExecute
    };
  });
  const executionPackage = {
    format: "transparent_ai_existing_software_execution_package_v1",
    createdAt: new Date().toISOString(),
    goal,
    software,
    selectionPath,
    actionSummary: actionSummaryItems,
    runnerEntries,
    existingTechnologyPolicy: {
      routeOrder: ["browser automation", "CLI/script", "application API or macro", "file import/export", "supervised Windows UI automation"],
      preferStructuredRoutesBeforeUiEvents: true,
      routeReadinessRequiredBeforeExecute: true,
      noGuessingSelectorsCommandsPayloadsOrWindows: true
    },
    reviewOrder: [
      "Review the chosen existing route and action summary.",
      "Run the generated runner without execute flags to create a dry-run receipt.",
      "Fill the routeReadiness evidence for the chosen adapter; do not execute while executeBlocker is non-empty.",
      "Only after teacher review, add explicit confirmation flags for any real route-specific execution.",
      "Verify the receipt, logs, file deltas, event counts, or teacher marker before screenshots or learning."
    ],
    locks: {
      ...locks,
      runnerGenerated: true,
      executionPackageGenerated: true,
      dryRunDefault: true
    }
  };
  const receiptTemplate = {
    format: "transparent_ai_existing_software_execution_package_receipt_template_v1",
    defaultStatus: "not_run_yet",
    allowedStatuses: ["not_run_yet", "dry_run_verified", "blocked", "ready_for_teacher_confirmed_execution"],
    blockedStatuses: ["accepted", "rule_enabled", "packaging_unlocked"],
    runnerEntries: runnerEntries.map((entry) => ({ adapterId: entry.adapterId, receiptPath: entry.receiptPath, observedStatus: "not_run_yet", teacherNote: "" })),
    locks: executionPackage.locks
  };
  writeFileSync(executionPackagePath, `${JSON.stringify(executionPackage, null, 2)}\n`, "utf8");
  writeFileSync(packageReceiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
  return { executionPackagePath, packageReceiptTemplatePath, runnerEntries };
}

const goal = argValue("--goal", argValue("--task", "Choose an existing execution adapter for teacher-reviewed software actions."));
const software = argValue("--software", argValue("--app", "target software"));
const preferredAdapters = multiArg("--preferred-adapter");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "execution-adapter-selections")));
const actionPlan = readOptionalJson(argValue("--action-plan", ""));
const spatialIntent = readOptionalJson(argValue("--spatial-intent", ""));
const overlayPacket = readOptionalJson(argValue("--overlay-packet", ""));
const capabilityProfile = readOptionalJson(argValue("--capability-profile", ""));
const observerQueue = readOptionalJson(argValue("--observer-queue", argValue("--queue", "")));

mkdirSync(outputRoot, { recursive: true });
const catalog = JSON.parse(readFileSync(join(pluginRoot, "assets", "templates", "tool-adapters.json"), "utf8"));
const selectionId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const selectionDir = join(outputRoot, selectionId);
mkdirSync(selectionDir, { recursive: true });

const selectionPath = join(selectionDir, "execution-adapter-selection.json");
const receiptTemplatePath = join(selectionDir, "execution-adapter-receipt-template.json");
const readmePath = join(selectionDir, "EXECUTION_ADAPTER_START_HERE.md");
const actionPlanPath = actionPlan ? join(selectionDir, "source-supervised-action-plan.json") : "";
const spatialIntentPath = spatialIntent ? join(selectionDir, "source-spatial-intent.json") : "";
const overlayPacketPath = overlayPacket ? join(selectionDir, "source-transparent-overlay-packet.json") : "";
const profilePath = capabilityProfile ? join(selectionDir, "source-software-capability-profile.json") : "";
const queuePath = observerQueue ? join(selectionDir, "source-observer-queue.json") : "";

if (actionPlan) writeFileSync(actionPlanPath, `${JSON.stringify(actionPlan, null, 2)}\n`, "utf8");
if (spatialIntent) writeFileSync(spatialIntentPath, `${JSON.stringify(spatialIntent, null, 2)}\n`, "utf8");
if (overlayPacket) writeFileSync(overlayPacketPath, `${JSON.stringify(overlayPacket, null, 2)}\n`, "utf8");
if (capabilityProfile) writeFileSync(profilePath, `${JSON.stringify(capabilityProfile, null, 2)}\n`, "utf8");
if (observerQueue) writeFileSync(queuePath, `${JSON.stringify(observerQueue, null, 2)}\n`, "utf8");

const context = {
  goalText: goal,
  softwareText: software,
  preferredAdapters,
  actionKinds: actionKinds(actionPlan),
  hasOverlayOrSpatialIntent: Boolean(overlayPacket || spatialIntent || actionPlan?.spatialIntentInterpretation),
  tokens: words(goal, software, JSON.stringify(actionPlan || {}), JSON.stringify(spatialIntent || {}), JSON.stringify(capabilityProfile || {}))
};

const rankedAdapters = catalog.adapters
  .map((adapter) => ({
    ...adapter,
    score: scoreAdapter(adapter, context),
    selectionReason:
      adapter.nativeIntegrationRequired === false
        ? "Existing-tool adapter; no custom native integration is required for this review package."
        : "Requires extra teacher review before any native integration work."
  }))
  .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

const selectedAdapters = rankedAdapters.filter((adapter) => EXECUTION_ADAPTER_IDS.has(adapter.id)).slice(0, 3);
const primaryAdapter = selectedAdapters[0];
const routeOrder = [
  "Try documented API, CLI, browser automation, or file import/export first when the target software exposes them.",
  "Use supervised Windows UI automation only after teacher confirms no cheaper structured route is available.",
  "Run dry-run/preflight first, then verify receipt/log/file deltas before screenshots or learning."
];

const locks = {
  reviewOnly: true,
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  nativeUniversalExecution: false,
  noAutonomousExecution: true
};

const executionPackage = writeExecutionPackage(selectionDir, selectedAdapters, selectionPath, actionPlan, goal, software, locks, {
  actionPlan,
  capabilityProfile,
  observerQueue
});

const selection = {
  format: "transparent_ai_existing_software_execution_adapter_selection_v1",
  selectionId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  principle: "Reuse existing software execution technology before generic UI automation.",
  inputs: {
    actionPlanPath: actionPlanPath || null,
    spatialIntentPath: spatialIntentPath || null,
    overlayPacketPath: overlayPacketPath || null,
    capabilityProfilePath: profilePath || null,
    observerQueuePath: queuePath || null,
    preferredAdapters
  },
  selectedAdapters,
  rankedAdapterIds: rankedAdapters.map((adapter) => adapter.id),
  recommendedRoute: {
    primaryAdapterId: primaryAdapter?.id,
    orderedPolicy: routeOrder,
    fallbackAdapterId: "existing-windows-ui-automation",
    dryRunFirst: true,
    teacherConfirmationRequired: true,
    outcomeVerificationRequired: true
  },
  executionPackage: {
    format: "transparent_ai_existing_software_execution_package_v1",
    executionPackagePath: executionPackage.executionPackagePath,
    receiptTemplatePath: executionPackage.packageReceiptTemplatePath,
    runnerEntries: executionPackage.runnerEntries
  },
  nextMcpCalls: selectedAdapters.map((adapter) => adapterNextCall(adapter, selectionPath, actionPlanPath)),
  locks
};

const receiptTemplate = {
  format: "transparent_ai_existing_software_execution_adapter_receipt_template_v1",
  selectionId,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "ready_for_dry_run", "blocked"],
  blockedDecisions: ["accepted", "execute_now", "enable_rule", "unlock_packaging"],
  reviewerFields: {
    observedExistingToolRoute: "",
    chosenAdapterId: primaryAdapter?.id || "",
    dryRunEvidencePath: "",
    blockerQuestion: "",
    nextReviewNote: ""
  },
  locks: selection.locks
};

const readme = [
  "# Existing Software Execution Adapter",
  "",
  "Start here before executing teacher sketch intent in real software.",
  "",
  `Goal: ${goal}`,
  `Software: ${software}`,
  `Primary adapter: ${primaryAdapter?.id || "none"}`,
  "",
  "Review order:",
  ...routeOrder.map((item, index) => `${index + 1}. ${item}`),
  "",
  "Blocked by default:",
  "- Do not execute actions from this package.",
  "- Do not enable rules or memory from this package.",
  "- Do not claim universal native app control.",
  "- Do not use screenshots until cheaper logs, files, receipts, or preflight evidence are insufficient.",
  "",
  "Files:",
  `- ${selectionPath}`,
  `- ${receiptTemplatePath}`
].join("\n");

writeFileSync(selectionPath, `${JSON.stringify(selection, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(readmePath, `${readme}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_existing_software_execution_adapter_selection_result_v1",
      selectionId,
      selectionPath,
  receiptTemplatePath,
  readmePath,
  executionPackagePath: executionPackage.executionPackagePath,
  executionPackageReceiptTemplatePath: executionPackage.packageReceiptTemplatePath,
  primaryAdapterId: primaryAdapter?.id || null,
  selectedAdapterIds: selectedAdapters.map((adapter) => adapter.id),
  runnerEntries: executionPackage.runnerEntries,
  locks: selection.locks
    },
    null,
    2
  )
);
