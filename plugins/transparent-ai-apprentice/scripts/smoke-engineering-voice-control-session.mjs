#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(__dirname, "..", "..", "..");
const sourceServerScript = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const serverScript = existsSync(sourceServerScript) ? sourceServerScript : packagedServerScript;
const outputRoot = existsSync(sourceServerScript) ? repoRoot : resolve(process.cwd());
const serverCwd = existsSync(sourceServerScript) ? repoRoot : outputRoot;
const smokeRoot = join(outputRoot, ".transparent-apprentice", "engineering-voice-control-session-smoke", String(Date.now()));
const fakeInstallRoot = join(smokeRoot, "fake-engineering-app");
mkdirSync(fakeInstallRoot, { recursive: true });

writeFileSync(join(fakeInstallRoot, "EngineeringApp.exe"), "metadata only smoke placeholder\n", "utf8");
writeFileSync(join(fakeInstallRoot, "AutomationApi.dll"), "metadata only smoke placeholder\n", "utf8");
writeFileSync(join(fakeInstallRoot, "macro-recorder.addin"), "metadata only smoke placeholder\n", "utf8");
writeFileSync(join(fakeInstallRoot, "engineering-app-cli.exe"), "metadata only smoke placeholder\n", "utf8");
writeFileSync(join(fakeInstallRoot, "sample-project.cadproj"), "metadata only smoke placeholder\n", "utf8");

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: outputRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: serverCwd,
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let nextId = 1;
  const pending = new Map();
  let stdoutBuffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });
  function rpc(method, params = {}) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolvePromise, rejectPromise) => pending.set(id, { resolve: resolvePromise, reject: rejectPromise }));
  }
  async function stop() {
    child.kill();
    await new Promise((resolvePromise) => child.once("exit", resolvePromise));
  }
  return { rpc, stop };
}

async function callAdvancedTool() {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_engineering_voice_control_session",
      arguments: {
        goal: "Let a non-expert create a reviewed hole feature by voice.",
        software: "generic engineering software",
        command: "Create a hole on the upper right face.",
        voiceTranscript: "Please create a hole on the upper right face.",
        windowTitle: "Engineering App",
        installPath: fakeInstallRoot,
        runReadOnlyProbe: true,
        noPortScan: true,
        fileExtensions: [".cadproj"],
        importFormats: ["STEP"],
        exportFormats: ["DXF"],
        candidates: [
          "face-upper-right|upper right face|0.78|0.24|0.2|voice command names the upper right face",
          "feature-tree-hole|hole feature command|0.18|0.38|0|alternative feature tree command location"
        ],
        outputDir: join(smokeRoot, "mcp")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachApprenticeRoute() {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        engineeringVoiceControlSession: true,
        whatToTeach: "Package a full voice/text control session for engineering software.",
        message:
          "Create a one-stop workflow so a non-expert can use voice or typed text, see numbered possible target positions, confirm one number, then dry-run execution in engineering software.",
        software: "generic engineering software",
        command: "Create a hole on the upper right face.",
        voiceTranscript: "Create a hole on the upper right face.",
        windowTitle: "Engineering App",
        installPath: fakeInstallRoot,
        runReadOnlyProbe: true,
        noPortScan: true,
        candidate: "face-upper-right|upper right face|0.78|0.24|0.2|teacher supplied likely target"
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const direct = runNodeScript("create-engineering-voice-control-session.mjs", [
  "--goal",
  "Let a non-expert control engineering software by voice or text.",
  "--software",
  "generic engineering software",
  "--window-title",
  "Engineering App",
  "--install-path",
  fakeInstallRoot,
  "--voice-transcript",
  "Please select the upper right face and create a hole there.",
  "--command",
  "Create a hole on the upper right face.",
  "--candidate",
  "face-upper-right|upper right face|0.78|0.24|0.2|voice command points to the upper right face",
  "--candidate",
  "feature-tree-hole|hole feature command|0.18|0.38|0|alternative feature tree command location",
  "--run-read-only-probe",
  "--no-port-scan",
  "--file-extension",
  ".cadproj",
  "--import-format",
  "STEP",
  "--export-format",
  "DXF",
  "--create-adapter-selection",
  "--output-dir",
  join(smokeRoot, "direct")
]);

const session = readJson(direct.sessionPath);
const confirmation = readJson(direct.targetConfirmation);
const probeResult = readJson(direct.probeResult);
const profile = readJson(direct.softwareControlChannelProfile);
const readmeText = readFileSync(direct.teacherReadme, "utf8");
const mcp = await callAdvancedTool();
const defaultRoute = await callDefaultTeachApprenticeRoute();
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Voice control session chains voice kit, numbered targets, read-only probe, and profile",
    pass:
      direct.format === "transparent_ai_engineering_voice_control_session_result_v1" &&
      direct.nonExpertControlMode === "voice_or_text_numbered_target_confirmation" &&
      direct.teacherMustConfirmExactlyOneNumber === true &&
      session.format === "transparent_ai_engineering_voice_control_session_v1" &&
      session.nonExpertVoiceTextNumberedControlLoop?.format === "transparent_ai_non_expert_voice_text_numbered_control_loop_v1" &&
      session.nonExpertVoiceTextNumberedControlLoop?.confirmationContract?.teacherMustConfirmExactlyOneNumber === true &&
      session.nonExpertVoiceTextNumberedControlLoop?.executionContract?.dryRunFirst === true &&
      session.nonExpertVoiceTextNumberedControlLoop?.optimizedPromptTemplate.includes("mark the possible target positions with numbers") &&
      session.generated.voiceKit?.html &&
      confirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      confirmation.candidates.length === 2 &&
      probeResult.format === "transparent_ai_software_control_channel_probe_result_v1" &&
      profile.format === "transparent_ai_software_control_channel_profile_v1" &&
      profile.sourceProbeResult?.format === "transparent_ai_software_control_channel_probe_result_v1",
    evidence: direct.sessionPath
  },
  {
    name: "Session keeps execution and recording locks closed",
    pass:
      session.locks.reviewOnly === true &&
      session.locks.accepted === false &&
      session.locks.ruleEnabled === false &&
      session.locks.packagingGated === true &&
      session.locks.fullContinuousRecording === false &&
      session.locks.screenshotsCaptured === false &&
      session.locks.softwareActionsExecuted === false &&
      session.locks.targetSoftwareCommandsExecuted === false &&
      session.locks.nativeUniversalExecution === false &&
      probeResult.lowTokenPolicy.fileContentsRead === false &&
      probeResult.lowTokenPolicy.targetSoftwareCommandsExecuted === false,
    evidence: JSON.stringify(session.locks)
  },
  {
    name: "Session writes next-call handoff for confirmed target, profile, and supervised execution gate",
    pass:
      session.nextCalls.some((call) => call.tool === "confirm_engineering_command_target") &&
      session.nextCalls.some((call) => call.tool === "create_software_control_channel_profile") &&
      session.nextCalls.some((call) => call.tool === "start_teach_execute_supervised_execution") &&
      session.nonExpertVoiceTextNumberedControlLoop.userFacingLoop.some((step) => step.id === "mark_numbered_possible_positions") &&
      session.nonExpertVoiceTextNumberedControlLoop.userFacingLoop.some((step) => step.id === "wait_for_confirmed_number" && step.blocksExecution === true) &&
      readmeText.includes("Confirm exactly one number") &&
      readmeText.includes("supervised execution gate") &&
      readmeText.includes("targetSoftwareCommandsExecuted=false"),
    evidence: direct.teacherReadme
  },
  {
    name: "MCP advanced mode exposes and runs engineering voice control session",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_engineering_voice_control_session") &&
      mcp.result.format === "transparent_ai_engineering_voice_control_session_result_v1" &&
      mcp.result.nextConfirmationBridge === "confirm_engineering_command_target" &&
      mcp.result.softwareActionsExecuted === false &&
      mcp.result.nativeUniversalExecution === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes non-expert voice-control request to the workbench first screen",
    pass:
      defaultRoute.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultRoute.status === "waiting_for_engineering_voice_control_workbench_review" &&
      defaultRoute.engineeringVoiceControlWorkbench?.targetConfirmation &&
      defaultRoute.engineeringVoiceControlWorkbench?.sessionPath &&
      defaultRoute.engineeringVoiceControlWorkbench?.nextConfirmationBridge === "confirm_engineering_command_target" &&
      defaultRoute.engineeringVoiceControlWorkbench?.softwareActionsExecuted === false &&
      defaultRoute.engineeringVoiceControlWorkbench?.nativeUniversalExecution === false,
    evidence: `status=${defaultRoute.status}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_engineering_voice_control_session_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
