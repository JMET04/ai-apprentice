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

function hasFlag(name) {
  return process.argv.includes(name);
}

function readOptionalJson(input) {
  if (!input) return null;
  const text = String(input).trim();
  if (!text) return null;
  if (existsSync(text)) return JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, ""));
  if (text.startsWith("{")) return JSON.parse(text);
  return null;
}

function slugify(value) {
  return (
    String(value || "software")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "software"
  );
}

function safeText(value, fallback = "") {
  return String(value ?? fallback ?? "").trim();
}

function includesAny(text, markers) {
  const normalized = String(text || "").toLowerCase();
  return markers.some((marker) => normalized.includes(marker));
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function candidateRows(source) {
  if (!source) return [];
  if (Array.isArray(source.softwareCandidates)) return source.softwareCandidates;
  if (Array.isArray(source.queue)) return source.queue;
  if (Array.isArray(source.rows)) return source.rows;
  return [];
}

function controlHints(row) {
  const software = safeText(row.software || row.name || row.processName, "software");
  const processName = safeText(row.processName);
  const windowTitle = safeText(row.windowTitle);
  const installPath = safeText(row.installPath || row.executable || row.path);
  const executable = safeText(row.executable);
  const joined = [
    software,
    processName,
    windowTitle,
    installPath,
    executable,
    ...(Array.isArray(row.fileExtensions) ? row.fileExtensions : []),
    ...(Array.isArray(row.importFormats) ? row.importFormats : []),
    ...(Array.isArray(row.exportFormats) ? row.exportFormats : []),
    ...(Array.isArray(row.commandNames) ? row.commandNames : []),
    ...(Array.isArray(row.apiMethods) ? row.apiMethods : []),
    ...(Array.isArray(row.macroNames) ? row.macroNames : [])
  ].join(" ");
  const candidateLogFileCount = Array.isArray(row.candidateLogFiles)
    ? row.candidateLogFiles.length
    : Array.isArray(row.recentLogCandidates)
    ? row.recentLogCandidates.length
    : Number(row.candidateLogFileCount || 0);
  const windowsEventLogCount = Array.isArray(row.windowsEventLogs) ? row.windowsEventLogs.length : 0;
  const hints = {
    browser: includesAny(joined, ["browser", "chrome", "edge", "web", "localhost", "http", "url", "dom", "selector"]),
    cli: Boolean(executable || installPath) && includesAny(joined, [".exe", ".cmd", ".bat", "cli", "command", "powershell", "script"]),
    api: includesAny(joined, ["api", "sdk", "com", "rest", "macro", "vba", "automation", "addin", "plugin"]),
    file: includesAny(joined, ["import", "export", ".csv", ".json", ".xml", ".dxf", ".dwg", ".step", ".stp", ".svg", "project", "config"]),
    visibleWindow: Boolean(windowTitle || processName),
    lowTokenObservation: candidateLogFileCount > 0 || windowsEventLogCount > 0
  };
  return {
    software,
    processName,
    windowTitle,
    installPath,
    executable,
    candidateLogFileCount,
    windowsEventLogCount,
    hints
  };
}

function classify(hints) {
  const structured = [];
  if (hints.api) structured.push("existing-application-api");
  if (hints.cli) structured.push("existing-cli-or-script");
  if (hints.browser) structured.push("existing-browser-automation");
  if (hints.file) structured.push("existing-file-import-export");
  if (structured.length > 0) return { status: "structured_control_route_reviewable", adapters: structured };
  if (hints.visibleWindow) return { status: "supervised_ui_fallback_reviewable", adapters: ["existing-windows-ui-automation"] };
  if (hints.lowTokenObservation) return { status: "observation_only_needs_control_evidence", adapters: [] };
  return { status: "needs_teacher_control_evidence", adapters: [] };
}

function buildProfileArgs(goal, hints, outputDir) {
  const args = ["--goal", goal, "--software", hints.software, "--output-dir", outputDir];
  if (hints.processName) args.push("--process-name", hints.processName);
  if (hints.windowTitle) args.push("--window-title", hints.windowTitle);
  if (hints.installPath) args.push("--install-path", hints.installPath);
  if (hints.executable) args.push("--executable", hints.executable);
  if (hints.hints.api) args.push("--api-hint", "candidate API, SDK, COM, macro, add-in, or automation evidence requires teacher review");
  if (hints.hints.cli) args.push("--command-name", "candidate reviewed CLI/script route");
  if (hints.hints.browser) args.push("--url", "reviewed browser/local service route required");
  if (hints.hints.file) args.push("--file-extension", "reviewed import/export format required");
  return args;
}

function writeReadme(path, audit) {
  const lines = [
    "# All-Software Control Channel Coverage Audit",
    "",
    `Goal: ${audit.goal}`,
    "",
    "This is a review-only coverage map for controlling local software.",
    "",
    `Audited software rows: ${audit.counts.totalRows}`,
    `Structured route rows: ${audit.counts.structuredControlRouteReviewable}`,
    `Supervised UI fallback rows: ${audit.counts.supervisedUiFallbackReviewable}`,
    `Observation-only rows needing control evidence: ${audit.counts.observationOnlyNeedsControlEvidence}`,
    `Rows needing teacher evidence: ${audit.counts.needsTeacherControlEvidence}`,
    "",
    "Next steps:",
    "1. Review private/excluded software before widening scope.",
    "2. For each row, prefer API, CLI/script, browser, file import/export, or macro evidence before UI fallback.",
    "3. Run `create_software_control_channel_probe` only when more bounded metadata is needed.",
    "4. Use `create_existing_software_execution_adapter` only after one numbered target and one route are teacher-reviewed.",
    "",
    "Locked boundaries:",
    "- No target software commands executed.",
    "- No screenshots captured.",
    "- No memory written.",
    "- No rule or technology accepted.",
    "- No packaging unlocked.",
    "- No universal native execution claim."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", argValue("--task", "Audit control-channel coverage across local software before claiming native execution."));
const inventoryInput = argValue("--inventory", argValue("--inventory-path", ""));
const queueInput = argValue("--queue", argValue("--queue-path", ""));
const maxSoftware = Number(argValue("--max-software", "24"));
const createProfiles = hasFlag("--create-profiles") || hasFlag("--create-control-profiles");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-control-channel-coverage-audits")));

const source = readOptionalJson(inventoryInput) || readOptionalJson(queueInput);
if (!source) {
  throw new Error("Provide --inventory or --queue with transparent AI software evidence.");
}

mkdirSync(outputRoot, { recursive: true });
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const auditDir = join(outputRoot, auditId);
const profileDir = join(auditDir, "control-channel-profiles");
mkdirSync(auditDir, { recursive: true });
if (createProfiles) mkdirSync(profileDir, { recursive: true });

const sourceRows = candidateRows(source).slice(0, maxSoftware);
const seen = new Set();
const rows = [];
for (const [index, row] of sourceRows.entries()) {
  const hints = controlHints(row);
  const key = `${hints.software}|${hints.processName}|${hints.windowTitle}`.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  const classification = classify(hints.hints);
  let profileResult = null;
  if (createProfiles) {
    profileResult = runNodeScript(
      "create-software-control-channel-profile.mjs",
      buildProfileArgs(goal, hints, join(profileDir, `row-${String(index + 1).padStart(3, "0")}-${slugify(hints.software)}`))
    );
  }
  const needs = [];
  if (classification.status === "observation_only_needs_control_evidence") {
    needs.push("teacher supplies API/CLI/file/browser/macro evidence or confirms UI fallback");
  }
  if (classification.status === "needs_teacher_control_evidence") {
    needs.push("teacher identifies target app, visible window, file format, API, CLI, browser route, or manual marker");
  }
  if (classification.status === "supervised_ui_fallback_reviewable") {
    needs.push("target-window title, coordinate preflight, dry-run receipt, and low-token verifier before execution");
  }
  if (classification.status === "structured_control_route_reviewable") {
    needs.push("review exact method/command/selector/file mapping and dry-run receipt before execution");
  }
  rows.push({
    rowId: `control-row-${String(rows.length + 1).padStart(3, "0")}`,
    software: hints.software,
    processName: hints.processName,
    windowTitle: hints.windowTitle,
    installPathKnown: Boolean(hints.installPath),
    candidateLogFileCount: hints.candidateLogFileCount,
    windowsEventLogCount: hints.windowsEventLogCount,
    status: classification.status,
    recommendedAdapters: classification.adapters,
    structuredControlRouteFound: classification.status === "structured_control_route_reviewable",
    visibleUiFallbackFound: classification.status === "supervised_ui_fallback_reviewable",
    lowTokenObservationAvailable: hints.hints.lowTokenObservation,
    nextCalls: [
      "create_software_control_channel_probe",
      "create_software_control_channel_profile",
      "confirm_engineering_command_target",
      "create_existing_software_execution_adapter",
      "verify_supervised_action_outcome",
      "create_post_action_evidence_checkpoint"
    ],
    missingBeforeExecute: needs,
    profilePath: profileResult?.profilePath || "",
    adapterRequestPath: profileResult?.adapterRequestPath || ""
  });
}

const counts = {
  totalRows: rows.length,
  structuredControlRouteReviewable: rows.filter((row) => row.status === "structured_control_route_reviewable").length,
  supervisedUiFallbackReviewable: rows.filter((row) => row.status === "supervised_ui_fallback_reviewable").length,
  observationOnlyNeedsControlEvidence: rows.filter((row) => row.status === "observation_only_needs_control_evidence").length,
  needsTeacherControlEvidence: rows.filter((row) => row.status === "needs_teacher_control_evidence").length,
  profilePacketsCreated: rows.filter((row) => row.profilePath).length
};

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareControlComplete: false,
  teacherConfirmationRequiredBeforeExecution: true,
  dryRunFirst: true
};

const auditPath = join(auditDir, "all-software-control-channel-coverage-audit.json");
const repairQueuePath = join(auditDir, "all-software-control-channel-repair-queue.json");
const receiptPath = join(auditDir, "all-software-control-channel-coverage-audit-receipt.json");
const readmePath = join(auditDir, "ALL_SOFTWARE_CONTROL_CHANNEL_COVERAGE_START_HERE.md");

const audit = {
  ok: true,
  format: "transparent_ai_all_software_control_channel_coverage_audit_v1",
  auditId,
  createdAt: new Date().toISOString(),
  goal,
  sourceFormat: source.format || "",
  sourcePath: inventoryInput || queueInput || "",
  counts,
  rows,
  completionBoundary: {
    allSoftwareControlComplete: false,
    nativeUniversalExecution: false,
    reason:
      "This audit widens reviewed control-channel coverage across local software, but every executable route still needs teacher-reviewed evidence, dry-run receipt, and outcome verification before any real action."
  },
  nextBestWork: [
    "Review rows needing teacher control evidence.",
    "Run read-only control-channel probes for high-value unknown software.",
    "Promote only reviewed structured routes or confirmed UI fallback rows into existing execution adapter packages.",
    "Use post-action evidence checkpoints before screenshots or learning."
  ],
  locks
};

const repairQueue = {
  ok: true,
  format: "transparent_ai_all_software_control_channel_repair_queue_v1",
  auditPath,
  createdAt: new Date().toISOString(),
  items: rows
    .filter((row) => row.status !== "structured_control_route_reviewable")
    .map((row, index) => ({
      itemId: `control-repair-${String(index + 1).padStart(3, "0")}`,
      software: row.software,
      status: row.status,
      missingBeforeExecute: row.missingBeforeExecute,
      nextCall: row.status === "needs_teacher_control_evidence" ? "create_software_control_channel_probe" : "create_software_control_channel_profile",
      blockedTransitions: ["execute_now", "enable_rule", "accept_native_control", "unlock_packaging"]
    })),
  locks
};

const receipt = {
  ok: true,
  format: "transparent_ai_all_software_control_channel_coverage_audit_receipt_v1",
  auditPath,
  repairQueuePath,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "ready_for_targeted_adapter_trial", "blocked"],
  blockedDecisions: ["accepted", "native_universal_execution_proven", "execute_now", "unlock_packaging"],
  locks
};

writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
writeFileSync(repairQueuePath, `${JSON.stringify(repairQueue, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, audit);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: audit.format,
      auditPath,
      repairQueuePath,
      receiptPath,
      readmePath,
      counts,
      locks
    },
    null,
    2
  )
);
