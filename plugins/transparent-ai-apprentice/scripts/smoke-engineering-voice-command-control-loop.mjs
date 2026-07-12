#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const sourceServerScript = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const serverScript = existsSync(sourceServerScript) ? sourceServerScript : packagedServerScript;
const outputRoot = existsSync(sourceServerScript) ? repoRoot : resolve(process.cwd());
const serverCwd = existsSync(sourceServerScript) ? repoRoot : outputRoot;
const smokeRoot = join(outputRoot, ".transparent-apprentice", "engineering-voice-command-control-loop-smoke", String(Date.now()));
const fakeInstallRoot = join(smokeRoot, "fake-engineering-app");
mkdirSync(fakeInstallRoot, { recursive: true });

writeFileSync(join(fakeInstallRoot, "EngineeringApp.exe"), "metadata only smoke placeholder\n", "utf8");
writeFileSync(join(fakeInstallRoot, "AutomationApi.dll"), "metadata only smoke placeholder\n", "utf8");
writeFileSync(join(fakeInstallRoot, "macro-recorder.addin"), "metadata only smoke placeholder\n", "utf8");

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: outputRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
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
      name: "run_engineering_voice_command_control_loop",
      arguments: {
        goal: "Let a non-expert create a reviewed hole feature by voice.",
        software: "generic engineering software",
        command: "Create a hole on the upper right face.",
        voiceTranscript: "Create a hole on the upper right face.",
        windowTitle: "Engineering App",
        installPath: fakeInstallRoot,
        noPortScan: true,
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

const waiting = runNodeScript("run-engineering-voice-command-control-loop.mjs", [
  "--goal",
  "Let a non-expert control engineering software by voice.",
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
  "--no-port-scan",
  "--output-dir",
  join(smokeRoot, "waiting")
]);

const waitingLoop = readJson(waiting.controlLoopPath);
const waitingReceipt = readJson(waiting.receiptPath);
const waitingReadme = readFileSync(waiting.teacherReadme, "utf8");

const blocked = runNodeScript("run-engineering-voice-command-control-loop.mjs", [
  "--goal",
  "Let a non-expert control engineering software by voice.",
  "--software",
  "generic engineering software",
  "--command",
  "Create a hole on the upper right face.",
  "--candidate",
  "face-upper-right|upper right face|0.78|0.24|0.2|voice command points to the upper right face",
  "--selected-number",
  "1",
  "--no-port-scan",
  "--output-dir",
  join(smokeRoot, "blocked")
]);
const blockedLoop = readJson(blocked.controlLoopPath);

const confirmed = runNodeScript("run-engineering-voice-command-control-loop.mjs", [
  "--goal",
  "Let a non-expert control engineering software by voice.",
  "--software",
  "generic engineering software",
  "--window-title",
  "Engineering App",
  "--install-path",
  fakeInstallRoot,
  "--command",
  "Create a hole on the upper right face.",
  "--candidate",
  "face-upper-right|upper right face|0.78|0.24|0.2|voice command points to the upper right face",
  "--candidate",
  "feature-tree-hole|hole feature command|0.18|0.38|0|alternative feature tree command location",
  "--selected-number",
  "1",
  "--teacher-confirmed-number",
  "--no-port-scan",
  "--preferred-adapter",
  "existing-cli-or-script",
  "--output-dir",
  join(smokeRoot, "confirmed")
]);
const confirmedLoop = readJson(confirmed.controlLoopPath);
const confirmedReceipt = readJson(confirmed.receiptPath);
const confirmationReceipt = readJson(confirmed.confirmationResult);
const mcp = await callAdvancedTool();
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Control loop waits with numbered candidates before teacher confirmation",
    pass:
      waiting.format === "transparent_ai_engineering_voice_command_control_loop_result_v1" &&
      waiting.status === "waiting_for_numbered_target_confirmation" &&
      waitingLoop.format === "transparent_ai_engineering_voice_command_control_loop_v1" &&
      waitingLoop.targetCandidates.length === 2 &&
      waitingLoop.selectedCandidateNumber === null &&
      waitingLoop.locks.softwareActionsExecuted === false &&
      waitingLoop.locks.targetSoftwareCommandsExecuted === false &&
      waitingLoop.locks.fullContinuousRecording === false &&
      waitingReceipt.teacherDecision === "needs_number_confirmation" &&
      waitingReadme.includes("Confirm exactly one number"),
    evidence: waiting.controlLoopPath
  },
  {
    name: "Selected number without explicit teacher confirmation stays blocked",
    pass:
      blocked.status === "blocked_selected_number_without_teacher_confirmation" &&
      blockedLoop.blockedReason.includes("--teacher-confirmed-number") &&
      !blocked.confirmationResult &&
      blockedLoop.locks.softwareActionsExecuted === false,
    evidence: blocked.controlLoopPath
  },
  {
    name: "Teacher-confirmed number creates single-target dry-run execution package only",
    pass:
      confirmed.status === "number_confirmed_dry_run_execution_package_ready" &&
      confirmedLoop.selectedCandidateNumber === 1 &&
      confirmedLoop.generated.confirmationResult &&
      confirmedLoop.generated.confirmedSingleTargetOverlay &&
      confirmationReceipt.format === "transparent_ai_engineering_command_target_confirmation_receipt_v1" &&
      confirmationReceipt.selectedCandidateNumber === 1 &&
      confirmationReceipt.locks.softwareActionsExecuted === false &&
      confirmedReceipt.teacherDecision === "needs_execution_review" &&
      confirmed.softwareActionsExecuted === false &&
      confirmed.targetSoftwareCommandsExecuted === false &&
      confirmed.nativeUniversalExecution === false,
    evidence: confirmed.controlLoopPath
  },
  {
    name: "MCP advanced mode exposes voice command control loop",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("run_engineering_voice_command_control_loop") &&
      mcp.result.format === "transparent_ai_engineering_voice_command_control_loop_result_v1" &&
      mcp.result.status === "waiting_for_numbered_target_confirmation" &&
      mcp.result.softwareActionsExecuted === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_engineering_voice_command_control_loop_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
