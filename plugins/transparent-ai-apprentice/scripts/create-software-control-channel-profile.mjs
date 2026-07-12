#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "software-control-channel-profile")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "software-control-channel-profile";
}

function readOptionalJson(input) {
  if (!input) return null;
  const text = String(input).trim();
  if (!text) return null;
  if (existsSync(text)) return JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, ""));
  if (text.startsWith("{")) return JSON.parse(text);
  return { reference: text };
}

function includesAny(text, markers) {
  const normalized = String(text || "").toLowerCase();
  return markers.some((marker) => normalized.includes(marker));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function scoreChannel(channel) {
  let score = 0;
  score += channel.evidence.length * 12;
  if (channel.adapterId !== "existing-windows-ui-automation") score += 8;
  if (channel.adapterId === "existing-application-api") score += 10;
  if (channel.adapterId === "existing-cli-or-script") score += 8;
  if (channel.adapterId === "existing-file-import-export") score += 7;
  if (channel.adapterId === "existing-browser-automation") score += 6;
  if (channel.adapterId === "existing-windows-ui-automation") score -= 4;
  return score;
}

function channelConfidence(score) {
  if (score >= 32) return "high";
  if (score >= 18) return "medium";
  return "low";
}

function channel(adapterId, label, evidence, requiredEvidenceBeforeExecute, lowTokenVerifier, blockers = []) {
  const scored = {
    adapterId,
    label,
    evidence: unique(evidence),
    requiredEvidenceBeforeExecute,
    lowTokenVerifier,
    executeBlockersUntilReviewed: blockers,
    dryRunFirst: true,
    teacherConfirmationRequired: true,
    nativeUniversalExecution: false
  };
  const score = scoreChannel(scored);
  return {
    ...scored,
    score,
    confidence: channelConfidence(score)
  };
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

const goal = argValue("--goal", argValue("--task", "Discover reusable control channels for this software before UI automation."));
const software = argValue("--software", argValue("--app", "target software"));
const processName = argValue("--process-name", "");
const windowTitle = argValue("--window-title", "");
const installPath = argValue("--install-path", "");
const executable = argValue("--executable", "");
const url = argValue("--url", "");
const commandHelp = argValue("--command-help", "");
const apiHint = argValue("--api-hint", "");
const macroHint = argValue("--macro-hint", "");
const probeResult = readOptionalJson(argValue("--probe-result", argValue("--control-channel-probe", "")));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "software-control-channel-profiles")));
const createAdapterSelection = hasFlag("--create-adapter-selection");
const actionPlan = readOptionalJson(argValue("--action-plan", ""));
const overlayPacket = readOptionalJson(argValue("--overlay-packet", ""));
const spatialIntent = readOptionalJson(argValue("--spatial-intent", ""));
const fileExtensions = argValues("--file-extension");
const importFormats = argValues("--import-format");
const exportFormats = argValues("--export-format");
const commandNames = argValues("--command-name");
const apiMethods = argValues("--api-method");
const macroNames = argValues("--macro-name");
const preferredAdapters = argValues("--preferred-adapter");

mkdirSync(outputRoot, { recursive: true });
const profileId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const profileDir = join(outputRoot, profileId);
mkdirSync(profileDir, { recursive: true });

const combinedText = [
  goal,
  software,
  processName,
  windowTitle,
  installPath,
  executable,
  url,
  commandHelp,
  apiHint,
  macroHint,
  fileExtensions.join(" "),
  importFormats.join(" "),
  exportFormats.join(" "),
  commandNames.join(" "),
  apiMethods.join(" "),
  macroNames.join(" "),
  JSON.stringify(probeResult || {}),
  JSON.stringify(actionPlan || {}),
  JSON.stringify(overlayPacket || {}),
  JSON.stringify(spatialIntent || {})
].join(" ");

const probeSignals = probeResult?.discoveredSignals || {};

const browserEvidence = [];
if (Array.isArray(probeSignals.browserOrLocalServiceRoutes) && probeSignals.browserOrLocalServiceRoutes.length > 0) {
  browserEvidence.push("read_only_probe_found_browser_or_local_service_route");
}
if (url || includesAny(combinedText, ["browser", "chrome", "edge", "web", "localhost", "http", "url", "selector", "dom"])) {
  browserEvidence.push("browser_or_web_surface_hint");
}
if (includesAny(combinedText, ["selector", "dom", "cdp", "devtools", "playwright"])) browserEvidence.push("reviewed_selector_or_browser_automation_hint");

const cliEvidence = [];
if (Array.isArray(probeSignals.cliRoutes) && probeSignals.cliRoutes.length > 0) {
  cliEvidence.push("read_only_probe_found_cli_or_script_route");
}
if (executable || commandHelp || commandNames.length > 0 || includesAny(combinedText, ["cli", "command", "powershell", "script", "--help", "batch"])) {
  cliEvidence.push("command_or_script_surface_hint");
}
if (commandHelp) cliEvidence.push("command_help_text_supplied");
if (commandNames.length > 0) cliEvidence.push("candidate_command_names_supplied");

const apiEvidence = [];
if (Array.isArray(probeSignals.apiRoutes) && probeSignals.apiRoutes.length > 0) {
  apiEvidence.push("read_only_probe_found_api_sdk_or_com_route");
}
if (apiHint || apiMethods.length > 0 || includesAny(combinedText, ["api", "sdk", "rest", "com automation", "macro recorder", "plugin sdk"])) {
  apiEvidence.push("application_api_or_sdk_hint");
}
if (Array.isArray(probeSignals.macroRoutes) && probeSignals.macroRoutes.length > 0) {
  apiEvidence.push("read_only_probe_found_macro_or_addin_route");
}
if (macroHint || macroNames.length > 0 || includesAny(combinedText, ["macro", "vba", "automation", "recorded macro"])) {
  apiEvidence.push("macro_or_automation_hint");
}

const fileEvidence = [];
if (Array.isArray(probeSignals.fileImportExportRoutes) && probeSignals.fileImportExportRoutes.length > 0) {
  fileEvidence.push("read_only_probe_found_file_import_export_route");
}
if (fileExtensions.length > 0 || importFormats.length > 0 || exportFormats.length > 0) fileEvidence.push("known_file_format_surface");
if (includesAny(combinedText, ["import", "export", "csv", "json", "dxf", "svg", "project file", "config file"])) fileEvidence.push("file_import_export_hint");

const uiEvidence = [];
if (Array.isArray(probeSignals.windowsUiFallbackRoutes) && probeSignals.windowsUiFallbackRoutes.length > 0) {
  uiEvidence.push("read_only_probe_found_visible_window_fallback");
}
if (windowTitle || processName || includesAny(combinedText, ["window", "click", "drag", "type", "hotkey", "overlay", "spatial"])) {
  uiEvidence.push("visible_window_or_supervised_ui_hint");
}
if (overlayPacket || spatialIntent || actionPlan?.spatialIntentInterpretation) uiEvidence.push("transparent_overlay_or_spatial_intent_supplied");

const channels = [
  channel(
    "existing-browser-automation",
    "Browser automation or reviewed browser DOM/CDP route",
    browserEvidence,
    ["reviewed URL or localhost CDP endpoint", "reviewed selector map", "dry-run browser receipt", "page-state or DOM-output verifier"],
    ["browser receipt", "DOM output hash", "CDP response hash", "page-state delta"],
    ["missing_reviewed_url_or_selectors"]
  ),
  channel(
    "existing-cli-or-script",
    "CLI, command, script, or vendor batch processor",
    cliEvidence,
    ["reviewed command or script", "non-destructive dry run", "expected exit code", "output-file or log verifier"],
    ["exit code", "stdout/stderr receipt", "output file hash", "log/file delta"],
    ["missing_reviewed_command_or_script"]
  ),
  channel(
    "existing-application-api",
    "Documented API, SDK, COM automation, macro, or local REST route",
    apiEvidence,
    ["reviewed API or macro method", "payload schema", "auth boundary", "structured response verifier"],
    ["API receipt", "response status", "response body hash", "target document copy or rollback file"],
    ["missing_reviewed_api_or_macro_contract"]
  ),
  channel(
    "existing-file-import-export",
    "File import/export, project-file, configuration, or format conversion route",
    fileEvidence,
    ["source save-copy", "reviewed import/export schema", "dry-run diff", "rollback path"],
    ["prepared file hash", "diff receipt", "modified-time delta", "import/export log"],
    ["missing_reviewed_file_import_export_mapping"]
  ),
  channel(
    "existing-windows-ui-automation",
    "Supervised Windows UI automation fallback",
    uiEvidence.length > 0 ? uiEvidence : ["fallback_when_no_structured_control_channel_is_known"],
    ["reviewed target window title", "coordinate preflight", "dry-run UI receipt", "log/file/event verifier"],
    ["active-window preflight", "execution receipt", "file/log/event delta", "teacher marker", "triggered screenshot only if ambiguous"],
    ["missing_target_window_or_low_token_verifier"]
  )
].sort((a, b) => b.score - a.score || a.adapterId.localeCompare(b.adapterId));

const structuredChannels = channels.filter((item) => item.adapterId !== "existing-windows-ui-automation" && item.evidence.length > 0);
const recommendedAdapters = unique([
  ...preferredAdapters,
  ...(structuredChannels.length > 0 ? structuredChannels : channels).map((item) => item.adapterId)
]).slice(0, 4);
const primaryAdapterId = recommendedAdapters[0] || channels[0]?.adapterId || "existing-windows-ui-automation";

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true,
  dryRunFirst: true
};

const profilePath = join(profileDir, "software-control-channel-profile.json");
const adapterRequestPath = join(profileDir, "next-existing-execution-adapter-request.json");
const receiptTemplatePath = join(profileDir, "software-control-channel-review-receipt-template.json");
const readmePath = join(profileDir, "SOFTWARE_CONTROL_CHANNEL_START_HERE.md");

const profile = {
  format: "transparent_ai_software_control_channel_profile_v1",
  profileId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  processName,
  windowTitle,
  installPath,
  executable,
  url,
  suppliedHints: {
    commandHelp: commandHelp ? "supplied" : "",
    apiHint,
    macroHint,
    commandNames,
    apiMethods,
    macroNames,
    fileExtensions,
    importFormats,
    exportFormats
  },
  sourceProbeResult: probeResult
    ? {
        format: probeResult.format || "",
        source: probeResult.source || "",
        matchedProcessCount: Array.isArray(probeResult.matchedProcesses) ? probeResult.matchedProcesses.length : 0,
        candidateRootCount: Array.isArray(probeResult.candidateRoots) ? probeResult.candidateRoots.length : 0,
        candidateFileCount: Array.isArray(probeResult.candidateFiles) ? probeResult.candidateFiles.length : 0,
        apiRouteCount: Array.isArray(probeSignals.apiRoutes) ? probeSignals.apiRoutes.length : 0,
        macroRouteCount: Array.isArray(probeSignals.macroRoutes) ? probeSignals.macroRoutes.length : 0,
        cliRouteCount: Array.isArray(probeSignals.cliRoutes) ? probeSignals.cliRoutes.length : 0,
        fileRouteCount: Array.isArray(probeSignals.fileImportExportRoutes) ? probeSignals.fileImportExportRoutes.length : 0,
        browserRouteCount: Array.isArray(probeSignals.browserOrLocalServiceRoutes) ? probeSignals.browserOrLocalServiceRoutes.length : 0,
        windowsUiFallbackCount: Array.isArray(probeSignals.windowsUiFallbackRoutes) ? probeSignals.windowsUiFallbackRoutes.length : 0,
        lowTokenPolicy: probeResult.lowTokenPolicy || {}
      }
    : null,
  principle: "Prefer reviewed existing control channels before supervised UI automation.",
  channels,
  recommendedRoute: {
    primaryAdapterId,
    recommendedAdapters,
    structuredRouteFound: structuredChannels.length > 0,
    fallbackAdapterId: "existing-windows-ui-automation",
    dryRunFirst: true,
    teacherConfirmationRequired: true,
    routeReadinessRequiredBeforeExecute: true,
    outcomeVerificationRequired: true,
    noContinuousRecordingRequired: true
  },
  lowTokenPolicy: {
    preferReceiptsBeforeScreenshots: true,
    preferLogsEventsAndFileDeltasBeforeScreenshots: true,
    triggerScreenshotsOnlyWhenCheapEvidenceIsAmbiguous: true,
    noFullScreenRecordingByDefault: true
  },
  nextBridge: "create_existing_software_execution_adapter",
  adapterRequestPath,
  locks
};

const adapterRequest = {
  format: "transparent_ai_software_control_channel_existing_adapter_request_v1",
  tool: "create_existing_software_execution_adapter",
  arguments: {
    goal,
    software,
    capabilityProfile: profilePath,
    preferredAdapters: recommendedAdapters,
    ...(actionPlan ? { actionPlan: "<pass original action plan path/object when available>" } : {}),
    ...(overlayPacket ? { overlayPacket: "<pass original overlay packet path/object when available>" } : {}),
    ...(spatialIntent ? { spatialIntent: "<pass original spatial intent path/object when available>" } : {})
  },
  routeOrder: recommendedAdapters,
  blockedActions: ["execute_now", "enable_rule", "unlock_packaging", "claim_universal_native_execution"],
  locks
};

const receiptTemplate = {
  format: "transparent_ai_software_control_channel_review_receipt_template_v1",
  profileId,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "ready_for_adapter_selection", "blocked"],
  blockedDecisions: ["accepted", "execute_now", "enable_rule", "unlock_packaging"],
  reviewerFields: {
    selectedAdapterId: primaryAdapterId,
    reviewedEvidencePath: "",
    missingControlChannelQuestion: "",
    nextReviewNote: ""
  },
  locks
};

writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
writeFileSync(adapterRequestPath, `${JSON.stringify(adapterRequest, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Software Control Channel Profile",
    "",
    `Goal: ${goal}`,
    `Software: ${software}`,
    `Primary adapter: ${primaryAdapterId}`,
    "",
    "Use this before executing a teacher-confirmed numbered target in real software.",
    "",
    "Review order:",
    "1. Check whether API, macro, CLI, browser, or file import/export evidence is available.",
    "2. Prefer the first structured route that has reviewed evidence.",
    "3. Use Windows UI automation only as the fallback after the teacher confirms no cheaper route is available.",
    "4. Feed this profile into create_existing_software_execution_adapter and run only dry-run receipts first.",
    "5. Verify receipts, logs, file deltas, event counts, or teacher markers before screenshots or memory.",
    "",
    "Locked defaults: accepted=false, ruleEnabled=false, packagingGated=true, fullContinuousRecording=false, screenshotsCaptured=false, softwareActionsExecuted=false, nativeUniversalExecution=false."
  ].join("\n"),
  "utf8"
);

let adapterSelection = null;
if (createAdapterSelection) {
  const args = ["--goal", goal, "--software", software, "--capability-profile", profilePath, "--output-dir", join(profileDir, "existing-adapter-selection")];
  if (actionPlan) args.push("--action-plan", JSON.stringify(actionPlan));
  if (overlayPacket) args.push("--overlay-packet", JSON.stringify(overlayPacket));
  if (spatialIntent) args.push("--spatial-intent", JSON.stringify(spatialIntent));
  for (const adapterId of recommendedAdapters) args.push("--preferred-adapter", adapterId);
  adapterSelection = runNodeScript("create-existing-software-execution-adapter.mjs", args);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_software_control_channel_profile_result_v1",
      profileId,
      profilePath,
      adapterRequestPath,
      receiptTemplatePath,
      readmePath,
      primaryAdapterId,
      recommendedAdapterIds: recommendedAdapters,
      structuredRouteFound: structuredChannels.length > 0,
      channelCount: channels.length,
      adapterSelectionPath: adapterSelection?.selectionPath || "",
      executionPackagePath: adapterSelection?.executionPackagePath || "",
      fullContinuousRecording: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false,
      reviewLocks: locks
    },
    null,
    2
  )
);
