#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "low-token-monitor-bridge-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "low-token-monitor-bridge-receipt-builder"
  );
}

function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function latestBridgePath() {
  const roots = [
    join(process.cwd(), "artifacts", "lt-monitor-bridges"),
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-monitor-command-bridges")
  ];
  const candidates = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = join(root, entry.name, "original-goal-low-token-monitor-command-bridge.json");
      if (existsSync(candidate)) candidates.push(candidate);
    }
  }
  candidates.sort();
  const latest = candidates.at(-1);
  if (!latest) throw new Error("No original-goal-low-token-monitor-command-bridge.json found.");
  return latest;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotRunCommands: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotReadLogs: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotRecordScreen: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    logsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function routeRows(bridge) {
  return (bridge.recommendedRouteOrder || []).map((route, index) => ({
    id: route.routeId,
    order: index + 1,
    routeKind: route.routeKind || "",
    routeStatus: route.routeStatus || "waiting_for_teacher_review",
    whenToUse: route.whenToUse || "",
    downstreamEvidence: route.downstreamEvidence || "",
    commandTemplate: route.commandTemplate || "",
    validationTemplate: route.validationTemplate || "",
    missingBeforeUse: route.missingBeforeUse || [],
    evidenceAlreadyAvailable: route.evidenceAlreadyAvailable || {},
    allowedDecisions: [
      "needs_teacher_review",
      "teacher_selects_route",
      "teacher_requests_more_evidence",
      "teacher_requests_high_reasoning_repair"
    ],
    blockedDecisions: [
      "execute_now",
      "register_now",
      "launch_runner",
      "read_logs",
      "read_full_logs",
      "capture_screenshot",
      "record_screen",
      "write_memory",
      "enable_rule",
      "unlock_packaging",
      "accepted",
      "claim_complete"
    ]
  }));
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (!value) continue;
    parts.push(flag, `"${String(value).replaceAll('"', '\\"')}"`);
  }
  return parts.join(" ");
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Low-Token Monitor Bridge Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Bridge: ${builder.paths.sourceBridge}`,
    "",
    "The teacher uses this receipt to select exactly one low-token monitor route, request evidence, or route back to high-reasoning repair.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder does not validate the receipt.",
    "- It does not run commands, register tasks, launch runners, read logs, read full logs, capture screenshots, record the screen, write memory, enable rules, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const rows = builder.routeRows
    .map(
      (row) => `<article class="row" data-route-id="${htmlEscape(row.id)}">
        <header><strong>${row.order}. ${htmlEscape(row.id)}</strong></header>
        <p><strong>Route status:</strong> ${htmlEscape(row.routeStatus)}</p>
        <p>${htmlEscape(row.whenToUse)}</p>
        <p><strong>Downstream evidence:</strong> ${htmlEscape(row.downstreamEvidence)}</p>
        <p><strong>Evidence already available:</strong> ${htmlEscape(JSON.stringify(row.evidenceAlreadyAvailable || {}))}</p>
        <pre>${htmlEscape(row.commandTemplate)}</pre>
        ${row.validationTemplate ? `<pre>${htmlEscape(row.validationTemplate)}</pre>` : ""}
        <p><strong>Missing before use:</strong> ${htmlEscape(row.missingBeforeUse.join("; "))}</p>
      </article>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Low-Token Monitor Bridge Receipt Builder</title>
  <style>
    body { margin: 0; font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f8fafc; }
    main { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .row, .panel { background: white; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; margin: 12px 0; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #eef2f7; border-radius: 6px; padding: 10px; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd8e5; border-radius: 6px; padding: 8px; }
    textarea { min-height: 300px; font: 13px Consolas, monospace; }
    label { display: block; margin: 10px 0; }
    button { min-height: 36px; border: 1px solid #174d89; background: #174d89; color: white; border-radius: 6px; padding: 0 12px; }
  </style>
</head>
<body>
<main>
  <h1>Low-Token Monitor Bridge Receipt Builder</h1>
  <p>Source bridge: <a href="${htmlEscape(fileHref(builder.paths.sourceBridge))}">${htmlEscape(basename(builder.paths.sourceBridge))}</a></p>
  ${rows}
  <section class="panel">
    <label>Teacher decision
      <select id="decision">
        <option value="needs_teacher_review">needs_teacher_review</option>
        <option value="teacher_selects_route">teacher_selects_route</option>
        <option value="teacher_requests_more_evidence">teacher_requests_more_evidence</option>
        <option value="teacher_requests_high_reasoning_repair">teacher_requests_high_reasoning_repair</option>
      </select>
    </label>
    <label>Selected route id <input id="selectedRoute" value="${htmlEscape(builder.routeRows[0]?.id || "")}"></label>
    <label>Retained rollback point <input id="rollbackPoint"></label>
    <label>Coverage evidence path <input id="coverageEvidencePath"></label>
    <label>Coverage review receipt validation path <input id="coverageReviewReceiptValidationPath"></label>
    <label>Teacher exclusions or coverage note <input id="teacherExclusionsOrCoverageNote"></label>
    <label>Readiness package path <input id="readinessPackagePath"></label>
    <label>Recurring monitor confirmation receipt path <input id="recurringMonitorConfirmationReceiptPath"></label>
    <label>Validated recurring monitor confirmation path <input id="validatedRecurringMonitorConfirmationPath"></label>
    <label>Registration runner result path <input id="registrationRunnerResultPath"></label>
    <label>Registration status verification path <input id="registrationStatusVerificationPath"></label>
    <label>Recurring monitor run output path <input id="recurringMonitorRunOutputPath"></label>
    <label>Teacher notes <input id="teacherNotes"></label>
    <button id="build">Build receipt JSON</button>
    <textarea id="receipt"></textarea>
  </section>
</main>
<script>
const template = ${JSON.stringify(builder.receiptTemplate).replace(/</g, "\\u003c")};
function value(id) { return document.getElementById(id).value; }
function build() {
  const receipt = {
    ...template,
    teacherDecision: value("decision"),
    selectedRouteId: value("selectedRoute"),
    routeReviewed: true,
    retainedRollbackPoint: value("rollbackPoint"),
    coverageEvidencePath: value("coverageEvidencePath"),
    coverageReviewReceiptValidationPath: value("coverageReviewReceiptValidationPath"),
    teacherExclusionsOrCoverageNote: value("teacherExclusionsOrCoverageNote"),
    readinessPackagePath: value("readinessPackagePath"),
    recurringMonitorConfirmationReceiptPath: value("recurringMonitorConfirmationReceiptPath"),
    validatedRecurringMonitorConfirmationPath: value("validatedRecurringMonitorConfirmationPath"),
    registrationRunnerResultPath: value("registrationRunnerResultPath"),
    registrationStatusVerificationPath: value("registrationStatusVerificationPath"),
    recurringMonitorRunOutputPath: value("recurringMonitorRunOutputPath"),
    teacherNotes: value("teacherNotes")
  };
  document.getElementById("receipt").value = JSON.stringify(receipt, null, 2);
}
document.getElementById("build").addEventListener("click", build);
build();
</script>
</body>
</html>`,
    "utf8"
  );
}

const bridgePath = resolve(argValue("--bridge", argValue("--low-token-bridge", "")) || latestBridgePath());
const bridge = readJson(bridgePath);
if (bridge.format !== "transparent_ai_original_goal_low_token_monitor_command_bridge_v1") {
  throw new Error("--bridge must be transparent_ai_original_goal_low_token_monitor_command_bridge_v1");
}
const bridgeHash = sha256Text(JSON.stringify(bridge));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), "artifacts", "lt-monitor-bridge-receipt-builders")));
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(bridge.bridgeId || "low-token-monitor-bridge")}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });
const builderPath = join(builderDir, "original-goal-low-token-monitor-bridge-receipt-builder.json");
const htmlPath = join(builderDir, "original-goal-low-token-monitor-bridge-receipt-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_LOW_TOKEN_MONITOR_BRIDGE_RECEIPT_BUILDER_START_HERE.md");
const receiptTemplatePath = join(builderDir, "teacher-low-token-monitor-bridge-receipt-template.json");
const rows = routeRows(bridge);
const nextValidationCommand = commandLine("validate-original-goal-low-token-monitor-bridge-receipt.mjs", [
  ["--bridge", bridgePath],
  ["--receipt", "<teacher-filled-low-token-monitor-bridge-receipt.json>"]
]);
const receiptTemplate = {
  format: "transparent_ai_original_goal_low_token_monitor_bridge_receipt_v1",
  sourceBridgeId: bridge.bridgeId,
  sourceBridgePath: bridgePath,
  sourceBridgeHash: bridgeHash,
  teacherDecision: "needs_teacher_review",
  selectedRouteId: "",
  routeReviewed: false,
  retainedRollbackPoint: "",
  coverageEvidencePath: "",
  coverageReviewReceiptValidationPath: "",
  teacherExclusionsOrCoverageNote: "",
  readinessPackagePath: "",
  recurringMonitorConfirmationReceiptPath: "",
  validatedRecurringMonitorConfirmationPath: "",
  registrationRunnerResultPath: "",
  registrationStatusVerificationPath: "",
  recurringMonitorRunOutputPath: "",
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true,
  locks: locks()
};
const builder = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_monitor_bridge_receipt_builder_v1",
  builderId,
  status: "waiting_for_teacher_low_token_monitor_bridge_receipt",
  sourceBridgePath: bridgePath,
  sourceBridgeHash: bridgeHash,
  routeRows: rows,
  receiptTemplate,
  nextValidationCommand,
  locks: locks(),
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceBridge: bridgePath
  }
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeHtml(htmlPath, builder);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_monitor_bridge_receipt_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      status: builder.status,
      routeCount: rows.length
    },
    null,
    2
  )
);
