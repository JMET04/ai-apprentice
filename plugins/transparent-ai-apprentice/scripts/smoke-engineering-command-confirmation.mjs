#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "engineering-command-confirmation-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

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
      name: "create_engineering_command_confirmation_kit",
      arguments: {
        goal: "Let a non-expert position a hole feature by voice.",
        software: "generic engineering software",
        command: "Create a hole on the upper right face and show me the likely target.",
        windowTitle: "Engineering App",
        candidate: "face-upper-right|upper right face|0.78|0.24|0.2|spoken command names the upper right face",
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
        whatToTeach: "Use voice or typed commands to control engineering software after target confirmation.",
        message:
          "我想语音操控工程软件。我说出或输入指令后，你先在你理解的可能位置标上序号，让用户确认之后再执行。",
        software: "generic engineering software",
        command: "Create a hole on the upper right face.",
        windowTitle: "Engineering App",
        candidate: "face-upper-right|upper right face|0.78|0.24|0.2|teacher supplied likely target"
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const direct = runNodeScript("create-engineering-command-confirmation-kit.mjs", [
  "--goal",
  "Let a non-expert control engineering software by voice or text.",
  "--software",
  "generic engineering software",
  "--window-title",
  "Engineering App",
  "--voice-transcript",
  "Please select the upper right face and create a hole there.",
  "--command",
  "Create a hole on the upper right face.",
  "--candidate",
  "face-upper-right|upper right face|0.78|0.24|0.2|voice command points to the upper right face",
  "--candidate",
  "feature-tree-hole|hole feature command|0.18|0.38|0|alternative feature tree command location",
  "--candidate",
  "model canvas center|0.52|0.48|0.1|compact candidate format for direct spoken target review",
  "--output-dir",
  join(smokeRoot, "direct")
]);
const intent = readJson(direct.commandIntent);
const voiceWorkflow = readJson(direct.voiceControlWorkflow);
const confirmation = readJson(direct.targetConfirmation);
const overlay = readJson(direct.overlayPacket);
const manifest = readJson(direct.kitPath);
const htmlText = readFileSync(direct.browserHtml, "utf8");
const mcp = await callAdvancedTool();
const defaultRoute = await callDefaultTeachApprenticeRoute();
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Engineering command kit accepts voice and text command intent",
    pass:
      direct.format === "transparent_ai_engineering_command_confirmation_kit_result_v1" &&
      intent.format === "transparent_ai_engineering_voice_text_command_intent_v1" &&
      voiceWorkflow.format === "transparent_ai_engineering_voice_or_text_control_workflow_v1" &&
      voiceWorkflow.workflow.some((step) => step.id === "mark_numbered_candidates") &&
      voiceWorkflow.workflow.some((step) => step.id === "teacher_confirms_number") &&
      intent.sourceModalities.voiceTranscriptProvided === true &&
      intent.sourceModalities.textCommandProvided === true &&
      intent.targetUnderstandingStatus === "needs_numbered_candidate_confirmation",
    evidence: direct.commandIntent
  },
  {
    name: "Engineering command kit marks possible positions with teacher-confirmed numbers",
    pass:
      confirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      confirmation.status === "waiting_for_teacher_target_number" &&
      confirmation.candidates.length === 3 &&
      confirmation.candidates.every((candidate, index) => candidate.number === index + 1) &&
      confirmation.candidates[2].normalizedTarget.coordinateSource === "teacher_reviewed_compact_candidate" &&
      confirmation.executionAfterConfirmationPolicy.nextTool === "confirm_engineering_command_target" &&
      confirmation.confirmationRequiredBefore.includes("any mouse or keyboard event"),
    evidence: direct.targetConfirmation
  },
  {
    name: "Numbered candidates compile into a transparent overlay packet for the supervised action bridge",
    pass:
      overlay.format === "transparent_ai_sketch_overlay_packet_v1" &&
      overlay.overlayMode === "voice_text_numbered_target_confirmation" &&
      overlay.anchors.every((anchor) => anchor.type === "numbered_teacher_confirmation_candidate") &&
      overlay.strokes.length === confirmation.candidates.length &&
      overlay.voiceControlWorkflow === direct.voiceControlWorkflow &&
      manifest.files.voiceControlWorkflow === direct.voiceControlWorkflow &&
      manifest.capabilities.createsVoiceOrTextControlWorkflow === true &&
      manifest.capabilities.restatesUnderstoodOperationBeforeExecution === true &&
      manifest.capabilities.nextConfirmationBridge === "confirm_engineering_command_target" &&
      manifest.capabilities.nextBridge === "create_supervised_software_action_kit" &&
      manifest.capabilities.softwareActionsExecuted === false,
    evidence: direct.overlayPacket
  },
  {
    name: "Browser helper reuses existing speech recognition with manual text fallback",
    pass:
      htmlText.includes("SpeechRecognition") &&
      htmlText.includes("webkitSpeechRecognition") &&
      htmlText.includes("Understood operation and gate") &&
      htmlText.includes("Type the command manually") &&
      htmlText.includes("selectedCandidateNumber") &&
      htmlText.includes("confirm_engineering_command_target") &&
      htmlText.includes("none_until_teacher_confirms_number"),
    evidence: direct.browserHtml
  },
  {
    name: "MCP advanced mode exposes and runs engineering command confirmation kit",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_engineering_command_confirmation_kit") &&
      mcp.result.format === "transparent_ai_engineering_command_confirmation_kit_result_v1" &&
      mcp.result.teacherConfirmationRequired === true &&
      mcp.result.nativeUniversalExecution === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes natural engineering voice/text control request to confirmation card",
    pass:
      defaultRoute.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultRoute.status === "waiting_for_engineering_command_target_confirmation" &&
      defaultRoute.engineeringCommandConfirmationKit?.candidateCount >= 1 &&
      defaultRoute.engineeringCommandConfirmationKit?.teacherConfirmationRequired === true &&
      defaultRoute.engineeringCommandConfirmationKit?.softwareActionsExecuted === false &&
      defaultRoute.engineeringCommandConfirmationKit?.voiceControlWorkflow &&
      defaultRoute.engineeringCommandConfirmationKit?.nextConfirmationBridge === "confirm_engineering_command_target" &&
      defaultRoute.engineeringCommandConfirmationKit?.nextBridge === "create_supervised_software_action_kit",
    evidence: `status=${defaultRoute.status}; candidates=${defaultRoute.engineeringCommandConfirmationKit?.candidateCount ?? 0}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_engineering_command_confirmation_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
