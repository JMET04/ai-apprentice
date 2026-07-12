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
    String(value || "objective-execution-bridge-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "objective-execution-bridge-receipt-builder"
  );
}

function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function latestBridgePath() {
  const root = join(process.cwd(), ".transparent-apprentice", "original-goal-objective-execution-bridges");
  if (!existsSync(root)) throw new Error("No objective execution bridge directory found.");
  const latest = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, "original-goal-objective-execution-bridge.json"))
    .filter((path) => existsSync(path))
    .sort()
    .at(-1);
  if (!latest) throw new Error("No original-goal-objective-execution-bridge.json found.");
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
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotSendUiEvents: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotReadLogs: true,
    builderDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (!value) continue;
    parts.push(flag, `"${String(value).replaceAll('"', '\\"')}"`);
  }
  return parts.join(" ");
}

function routeRows(bridge) {
  return (bridge.recommendedRouteOrder || []).map((route, index) => ({
    id: route.routeId,
    order: index + 1,
    whenToUse: route.whenToUse || "",
    downstreamEvidence: route.downstreamEvidence || "",
    startCommand: route.startCommand || "",
    missingBeforeUse: route.missingBeforeUse || [],
    allowedDecisions: ["needs_teacher_review", "teacher_selects_route", "teacher_requests_more_evidence", "teacher_requests_high_reasoning_repair"],
    blockedDecisions: ["execute_now", "register_now", "launch_runner", "send_ui_events", "write_memory", "enable_rule", "unlock_packaging", "accepted", "claim_complete"]
  }));
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Objective Execution Bridge Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Bridge: ${builder.paths.sourceBridge}`,
    "",
    "The teacher uses this receipt to choose exactly one existing controlled execution route, request more evidence, or route back to high-reasoning repair.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder does not validate the receipt.",
    "- It does not run commands, register tasks, launch runners, execute target software, send UI events, capture screenshots, read logs, write memory, enable rules, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const rows = builder.routeRows
    .map(
      (row) => `<article class="row" data-route-id="${htmlEscape(row.id)}">
        <header><strong>${row.order}. ${htmlEscape(row.id)}</strong></header>
        <p>${htmlEscape(row.whenToUse)}</p>
        <p><strong>Downstream evidence:</strong> ${htmlEscape(row.downstreamEvidence)}</p>
        <pre>${htmlEscape(row.startCommand)}</pre>
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
  <title>Objective Execution Bridge Receipt Builder</title>
  <style>
    body { margin: 0; font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f8fafc; }
    main { max-width: 1080px; margin: 0 auto; padding: 24px; }
    .row, .panel { background: white; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; margin: 12px 0; }
    pre { white-space: pre-wrap; background: #eef2f7; border-radius: 6px; padding: 10px; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd8e5; border-radius: 6px; padding: 8px; }
    textarea { min-height: 260px; font: 13px Consolas, monospace; }
    label { display: block; margin: 10px 0; }
    button { min-height: 36px; border: 1px solid #174d89; background: #174d89; color: white; border-radius: 6px; padding: 0 12px; }
  </style>
</head>
<body>
<main>
  <h1>Objective Execution Bridge Receipt Builder</h1>
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
    <label>Teacher selected numbered target <input id="targetSelection"></label>
    <label>Retained rollback point <input id="rollbackPoint"></label>
    <label>Adapter/control-channel evidence <input id="adapterEvidence"></label>
    <label>Post-action evidence plan <input id="postActionEvidencePlan"></label>
    <label>Teacher notes <input id="teacherNotes"></label>
    <button id="build">Build receipt JSON</button>
    <textarea id="receipt"></textarea>
  </section>
</main>
<script>
const template = ${JSON.stringify(builder.receiptTemplate).replace(/</g, "\\u003c")};
function build() {
  const receipt = {
    ...template,
    teacherDecision: document.getElementById("decision").value,
    selectedRouteId: document.getElementById("selectedRoute").value,
    routeReviewed: true,
    teacherSelectedNumberedTarget: document.getElementById("targetSelection").value,
    retainedRollbackPoint: document.getElementById("rollbackPoint").value,
    adapterEvidencePath: document.getElementById("adapterEvidence").value,
    postActionEvidencePlan: document.getElementById("postActionEvidencePlan").value,
    teacherNotes: document.getElementById("teacherNotes").value
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

const bridgePath = resolve(argValue("--bridge", argValue("--execution-bridge", "")) || latestBridgePath());
const bridge = readJson(bridgePath);
if (bridge.format !== "transparent_ai_original_goal_objective_execution_bridge_v1") {
  throw new Error("--bridge must be transparent_ai_original_goal_objective_execution_bridge_v1");
}
const bridgeHash = sha256Text(JSON.stringify(bridge));
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-objective-execution-bridge-receipt-builders"))
);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(bridge.bridgeId || "objective-execution-bridge")}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });
const builderPath = join(builderDir, "original-goal-objective-execution-bridge-receipt-builder.json");
const htmlPath = join(builderDir, "original-goal-objective-execution-bridge-receipt-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_OBJECTIVE_EXECUTION_BRIDGE_RECEIPT_BUILDER_START_HERE.md");
const receiptTemplatePath = join(builderDir, "teacher-objective-execution-bridge-receipt-template.json");
const rows = routeRows(bridge);
const nextValidationCommand = commandLine("validate-original-goal-objective-execution-bridge-receipt.mjs", [
  ["--bridge", bridgePath],
  ["--receipt", "<teacher-filled-objective-execution-bridge-receipt.json>"]
]);
const receiptTemplate = {
  format: "transparent_ai_original_goal_objective_execution_bridge_receipt_v1",
  sourceBridgeId: bridge.bridgeId,
  sourceBridgePath: bridgePath,
  sourceBridgeHash: bridgeHash,
  teacherDecision: "needs_teacher_review",
  selectedRouteId: "",
  routeReviewed: false,
  teacherSelectedNumberedTarget: "",
  retainedRollbackPoint: "",
  adapterEvidencePath: "",
  postActionEvidencePlan: "",
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true,
  locks: locks()
};
const builder = {
  ok: true,
  format: "transparent_ai_original_goal_objective_execution_bridge_receipt_builder_v1",
  builderId,
  status: "waiting_for_teacher_objective_execution_bridge_receipt",
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
      format: "transparent_ai_original_goal_objective_execution_bridge_receipt_builder_result_v1",
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
