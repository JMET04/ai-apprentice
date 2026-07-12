#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "triggered-visual-voice-control-workbench-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const mcpServerSource = readFileSync(join(pluginRoot, "scripts", "mcp-server.mjs"), "utf8");
const monitorPath = join(smokeRoot, "delta-monitor.json");
writeFileSync(
  monitorPath,
  JSON.stringify(
    {
      format: "transparent_ai_software_observation_delta_monitor_v1",
      software: "generic engineering modeler",
      processName: "GenericModeler.exe",
      windowTitle: "Generic Modeler",
      counts: { changedLogs: 1, addedLogs: 0, removedLogs: 0 },
      delta: {
        changedLogs: [
          {
            path: join(smokeRoot, "generic-modeler.log"),
            classification: "failure_or_blocker",
            current: { retainedSnippet: "WARNING command target ambiguous after user opened upper right model area" }
          }
        ],
        addedLogs: [],
        removedLogs: []
      },
      screenshotPolicy: {
        screenshotRecommended: true,
        screenshotCaptured: false,
        fullContinuousRecording: false,
        reason: "cheap_signal_ambiguous_target"
      }
    },
    null,
    2
  ),
  "utf8"
);

const request = runNodeScript("create-triggered-visual-check-request.mjs", [
  "--delta-monitor",
  monitorPath,
  "--software",
  "generic engineering modeler",
  "--target-window-title",
  "Generic Modeler",
  "--output-dir",
  join(smokeRoot, "request")
]);

const sourceImagePath = join(smokeRoot, "teacher-reviewed-engineering-screen.png");
writeFileSync(
  sourceImagePath,
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64")
);

const capture = runNodeScript("capture-triggered-visual-check.mjs", [
  "--request",
  request.packetPath,
  "--teacher-confirmed",
  "--reviewed-source-image",
  sourceImagePath,
  "--target-window-title",
  "Generic Modeler",
  "--teacher-note",
  "teacher confirmed one bounded visual check before voice/text target confirmation",
  "--output-dir",
  join(smokeRoot, "capture")
]);

const handoff = runNodeScript("create-triggered-visual-evidence-learning-handoff.mjs", [
  "--capture-receipt",
  capture.receiptPath,
  "--request",
  request.packetPath,
  "--goal",
  "Use one teacher-confirmed visual check with a voice command before any engineering software execution.",
  "--output-dir",
  join(smokeRoot, "learning-handoff")
]);

const bridge = runNodeScript("create-triggered-visual-evidence-voice-control-workbench.mjs", [
  "--handoff",
  handoff.handoffPath,
  "--command",
  "Select the upper right model target and prepare a measurement there.",
  "--software",
  "generic engineering modeler",
  "--candidate",
  "upper right model target|0.75|0.25|0.1|visual evidence contains the likely target in the upper right model view",
  "--candidate",
  "left feature tree entry|0.16|0.42|0|alternative if the voice command refers to the feature tree",
  "--output-dir",
  join(smokeRoot, "voice-workbench")
]);

const bridgePacket = readJson(bridge.bridgePath);
const workbench = readJson(bridge.workbenchPath);
const visualTargetConfirmation = readJson(bridge.visualTargetConfirmation);

const checks = [
  {
    name: "Triggered visual evidence creates a voice/text numbered-target workbench",
    pass:
      bridge.format === "transparent_ai_triggered_visual_evidence_voice_control_workbench_result_v1" &&
      bridgePacket.format === "transparent_ai_triggered_visual_evidence_voice_control_workbench_v1" &&
      bridgePacket.status === "waiting_for_teacher_numbered_target_review" &&
      bridgePacket.existingAbilitiesReused.includes("create-engineering-voice-control-workbench.mjs") &&
      existsSync(bridge.htmlPath),
    evidence: bridge.bridgePath
  },
  {
    name: "Workbench reuses the confirmed visual evidence as the numbered-target backdrop",
    pass:
      workbench.format === "transparent_ai_engineering_voice_control_workbench_v1" &&
      workbench.visualEvidence?.source === "triggered_visual_capture_receipt" &&
      workbench.visualEvidence?.path === capture.screenshotPath &&
      workbench.generated?.visualTargetConfirmation === bridge.visualTargetConfirmation &&
      visualTargetConfirmation.visualEvidencePath === capture.screenshotPath &&
      visualTargetConfirmation.candidates.length === 2,
    evidence: bridge.workbenchPath
  },
  {
    name: "Voice/text workbench waits for exactly one teacher-confirmed number",
    pass:
      workbench.nextConfirmCall?.tool === "confirm_engineering_command_target" &&
      workbench.nextConfirmCall?.arguments?.selectedCandidateNumber === "<choose one visible number in the workbench>" &&
      workbench.targetCandidates.length === 2 &&
      bridgePacket.nextAllowedActions.includes("teacher_confirms_exactly_one_number_or_corrects_candidates"),
    evidence: JSON.stringify(workbench.nextConfirmCall)
  },
  {
    name: "Bridge does not capture screenshots execute software read full logs write memory or unlock packaging",
    pass:
      bridgePacket.locks.bridgeDoesNotCaptureScreenshots === true &&
      bridgePacket.locks.bridgeDoesNotExecuteSoftware === true &&
      bridgePacket.locks.bridgeDoesNotReadFullLogs === true &&
      bridgePacket.locks.bridgeDoesNotWriteMemory === true &&
      bridgePacket.locks.bridgeDoesNotEnableRules === true &&
      bridgePacket.locks.screenshotsCaptured === false &&
      bridgePacket.locks.softwareActionsExecuted === false &&
      bridgePacket.locks.memoryWritten === false &&
      bridgePacket.locks.accepted === false &&
      bridgePacket.locks.packagingGated === true,
    evidence: JSON.stringify(bridgePacket.locks)
  },
  {
    name: "MCP advanced tool exposes triggered visual voice-control workbench bridge",
    pass: mcpServerSource.includes('name: "create_triggered_visual_evidence_voice_control_workbench"'),
    evidence: "mcp-server.mjs contains create_triggered_visual_evidence_voice_control_workbench"
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_triggered_visual_evidence_voice_control_workbench_smoke_v1",
      smokeRoot,
      paths: {
        request: request.packetPath,
        captureReceipt: capture.receiptPath,
        learningHandoff: handoff.handoffPath,
        bridge: bridge.bridgePath,
        workbench: bridge.workbenchPath,
        html: bridge.htmlPath,
        visualTargetConfirmation: bridge.visualTargetConfirmation
      },
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
