#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function slugify(value) {
  return (
    String(value || "current-goal-start-here-post-registration-witness-bridge")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "current-goal-start-here-post-registration-witness-bridge"
  );
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    bridgeDoesNotModifyStartHere: true,
    bridgeDoesNotValidateReceipts: true,
    bridgeDoesNotRunCommands: true,
    bridgeDoesNotRegisterTask: true,
    bridgeDoesNotLaunchRunner: true,
    bridgeDoesNotExecuteTargetSoftware: true,
    bridgeDoesNotCaptureScreenshots: true,
    bridgeDoesNotReadLogs: true,
    bridgeDoesNotReadFullLogs: true,
    bridgeDoesNotWriteMemory: true,
    bridgeDoesNotEnableRules: true,
    bridgeDoesNotDeleteRollbackPoints: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeHtml(path, packet) {
  const link = (label, target) =>
    target && existsSync(target)
      ? `<a href="${htmlEscape(fileHref(target))}">${htmlEscape(label)} (${htmlEscape(basename(target))})</a>`
      : `<code>${htmlEscape(target || "missing")}</code>`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Start Here Post-Registration Witness Bridge</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 980px; margin: 0 auto; padding: 28px; }
    section { background: #fff; border: 1px solid #d9e2ef; border-radius: 8px; padding: 16px; margin: 14px 0; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    dl { display: grid; grid-template-columns: 260px 1fr; gap: 8px 14px; }
    dt { color: #4b5a6b; }
    dd { margin: 0; overflow-wrap: anywhere; }
    .lock { color: #7a2d12; font-weight: 600; }
    code { background: #eef3f8; border-radius: 5px; padding: 3px 5px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Start Here Post-Registration Witness Bridge</h1>
  <p class="lock">Review-only bridge. It does not change Start Here, validate receipts, run commands, register tasks, launch runners, read logs, capture screenshots, execute software, write memory, delete rollback points, unlock packaging, or claim completion.</p>
  <section>
    <h2>Open</h2>
    <p>${link("Stable Start Here", packet.paths.startHereHtml || packet.paths.startHere)}</p>
    <p>${link("Latest witness teacher confirmation entry", packet.paths.witnessEntryHtml)}</p>
    <p>${link("Latest witness command builder", packet.paths.sourceWitnessCommandBuilderHtml)}</p>
  </section>
  <section>
    <h2>Status</h2>
    <dl>
      <dt>Goal complete</dt><dd>${htmlEscape(String(packet.summary.goalComplete))}</dd>
      <dt>Final review lanes</dt><dd>${htmlEscape(`${packet.summary.finalReviewIndexReadyLanes}/${packet.summary.finalReviewIndexTotalLanes || "?"} ready, ${packet.summary.finalReviewIndexBlockedLanes} blocked`)}</dd>
      <dt>Next proof gap route</dt><dd>${htmlEscape(packet.summary.nextProofGapRouteId)}</dd>
      <dt>Witness entry status</dt><dd>${htmlEscape(packet.summary.witnessEntryStatus)}</dd>
      <dt>Source registration status</dt><dd>${htmlEscape(packet.summary.sourceRegistrationStatus)}</dd>
      <dt>Source witness builder status</dt><dd>${htmlEscape(packet.summary.sourceWitnessBuilderStatus)}</dd>
      <dt>Witness blocker count</dt><dd>${htmlEscape(packet.summary.witnessBlockerCount)}</dd>
      <dt>Runner launched</dt><dd>${htmlEscape(String(packet.summary.runnerLaunched))}</dd>
      <dt>Scheduled task registered</dt><dd>${htmlEscape(String(packet.summary.scheduledTaskRegistered))}</dd>
    </dl>
  </section>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, packet) {
  const lines = [
    "# Start Here Post-Registration Witness Bridge",
    "",
    `Status: ${packet.status}`,
    `Goal complete: ${packet.summary.goalComplete}`,
    `Next proof gap route: ${packet.summary.nextProofGapRouteId}`,
    `Witness entry status: ${packet.summary.witnessEntryStatus}`,
    "",
    `- Stable Start Here: ${packet.paths.startHere}`,
    `- Witness teacher confirmation entry: ${packet.paths.witnessEntry}`,
    `- Witness teacher confirmation HTML: ${packet.paths.witnessEntryHtml}`,
    "",
    "Locks:",
    ...Object.entries(packet.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const startHerePath = resolve(argValue("--start-here", join("artifacts", "current-goal-start-here", "current-goal-start-here.json")));
const witnessEntryPath = resolve(argValue("--witness-entry", ""));
if (!existsSync(startHerePath)) throw new Error("--start-here is required");
if (!existsSync(witnessEntryPath)) throw new Error("--witness-entry is required");

const startHere = readJson(startHerePath);
const witnessEntry = readJson(witnessEntryPath);
if (startHere.format !== "transparent_ai_current_goal_start_here_launchpad_v1") {
  throw new Error("--start-here must be transparent_ai_current_goal_start_here_launchpad_v1");
}
if (witnessEntry.format !== "transparent_ai_current_goal_post_registration_witness_teacher_confirmation_entry_v1") {
  throw new Error("--witness-entry must be transparent_ai_current_goal_post_registration_witness_teacher_confirmation_entry_v1");
}

const goal = argValue("--goal", "Bridge stable Start Here to the latest post-registration witness teacher confirmation entry.");
const outputRoot = resolve(argValue("--output-dir", join("artifacts", "current-goal-start-here-post-registration-witness-bridges")));
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const runDir = join(outputRoot, runId);
mkdirSync(runDir, { recursive: true });

const bridgePath = join(runDir, "current-goal-start-here-post-registration-witness-bridge.json");
const htmlPath = join(runDir, "current-goal-start-here-post-registration-witness-bridge.html");
const readmePath = join(runDir, "CURRENT_GOAL_START_HERE_POST_REGISTRATION_WITNESS_BRIDGE.md");
const lockState = locks();
const summary = startHere.statusSummary || {};
const finalReviewReady = summary.finalReviewIndexReadyLanes ?? null;
const finalReviewBlocked = summary.finalReviewIndexBlockedLanes ?? null;
const packet = {
  ok: true,
  format: "transparent_ai_current_goal_start_here_post_registration_witness_bridge_v1",
  status: "start_here_post_registration_witness_bridge_ready_review_only",
  createdAt: new Date().toISOString(),
  goal,
  summary: {
    goalComplete: summary.goalComplete === true || witnessEntry.locks?.goalComplete === true,
    finalReviewIndexReadyLanes: finalReviewReady,
    finalReviewIndexBlockedLanes: finalReviewBlocked,
    finalReviewIndexTotalLanes:
      typeof finalReviewReady === "number" && typeof finalReviewBlocked === "number"
        ? finalReviewReady + finalReviewBlocked
        : null,
    nextProofGapRouteId: summary.nextProofGapRouteId || "",
    nextProofGapQuestion: summary.nextProofGapQuestion || "",
    witnessEntryStatus: witnessEntry.status || "",
    sourceRegistrationStatus: witnessEntry.sourceRegistrationStatus || "",
    sourceWitnessBuilderStatus: witnessEntry.sourceWitnessBuilderStatus || "",
    witnessBlockerCount: Array.isArray(witnessEntry.blockers) ? witnessEntry.blockers.length : null,
    runnerLaunched: witnessEntry.locks?.runnerLaunched === true,
    scheduledTaskRegistered: witnessEntry.locks?.scheduledTaskRegistered === true
  },
  paths: {
    bridge: bridgePath,
    html: htmlPath,
    readme: readmePath,
    startHere: startHerePath,
    startHereHtml: startHere.paths?.html || "",
    witnessEntry: witnessEntryPath,
    witnessEntryHtml: witnessEntry.paths?.html || "",
    witnessEntryReceiptTemplate: witnessEntry.paths?.receiptTemplate || "",
    sourceWitnessCommandBuilder: witnessEntry.paths?.sourceWitnessCommandBuilder || "",
    sourceWitnessCommandBuilderHtml: witnessEntry.paths?.sourceWitnessCommandBuilderHtml || ""
  },
  locks: lockState
};

writeFileSync(bridgePath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeHtml(htmlPath, packet);
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_start_here_post_registration_witness_bridge_result_v1",
      status: packet.status,
      bridgePath,
      htmlPath,
      readmePath,
      summary: packet.summary,
      locks: packet.locks
    },
    null,
    2
  )
);
