#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceRepoRoot = resolve(__dirname, "..", "..", "..");
const sourceServerScript = join(sourceRepoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(resolve(__dirname, ".."), "scripts", "mcp-server.mjs");
const runsFromSourceTree = existsSync(sourceServerScript);
const repoRoot = runsFromSourceTree ? sourceRepoRoot : resolve(process.cwd());
const serverScript = runsFromSourceTree ? sourceServerScript : packagedServerScript;
const smokeRoot = join(repoRoot, ".transparent-apprentice", "software-control-channel-probe-smoke", String(Date.now()));
const fakeInstallRoot = join(smokeRoot, "MockProbeEngineeringApp");
mkdirSync(join(fakeInstallRoot, "automation", "macros"), { recursive: true });
mkdirSync(join(fakeInstallRoot, "formats"), { recursive: true });
mkdirSync(join(fakeInstallRoot, "local-service"), { recursive: true });

writeFileSync(join(fakeInstallRoot, "mock-api-sdk-com.dll"), "metadata smoke placeholder\n", "utf8");
writeFileSync(join(fakeInstallRoot, "automation", "macros", "macro-addin-recorder.bas"), "metadata smoke placeholder\n", "utf8");
writeFileSync(join(fakeInstallRoot, "run-script-cli.ps1"), "metadata smoke placeholder\n", "utf8");
writeFileSync(join(fakeInstallRoot, "formats", "import-export-schema.json"), "{}\n", "utf8");
writeFileSync(join(fakeInstallRoot, "local-service", "localhost-rest-config.xml"), "<config />\n", "utf8");

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
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

async function callAdvancedProbe() {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_software_control_channel_probe",
      arguments: {
        goal: "Find reusable control channels for a mock engineering app before UI automation.",
        software: "Mock Probe Engineering App",
        processName: "mock-probe-engineering",
        installPath: fakeInstallRoot,
        runReadOnlyProbe: true,
        noPortScan: true,
        maxFiles: 80,
        maxDepth: 4,
        outputDir: join(smokeRoot, "mcp-probe")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachProbe() {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        goal: "For voice control of this engineering software, probe API macro script and import/export control channels first.",
        message: "先只读探测控制通道，不要录屏，不要点击软件；看看有没有 API、宏、脚本或文件导入导出。",
        software: "Mock Probe Engineering App",
        processName: "mock-probe-engineering",
        installPath: fakeInstallRoot,
        softwareControlChannelProbe: true,
        noPortScan: true,
        outputDir: join(smokeRoot, "default-card")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const directProbe = runNodeScript("create-software-control-channel-probe.mjs", [
  "--goal",
  "Let a non-expert control engineering software by voice after read-only channel discovery.",
  "--software",
  "Mock Probe Engineering App",
  "--process-name",
  "mock-probe-engineering",
  "--install-path",
  fakeInstallRoot,
  "--run-read-only-probe",
  "--no-port-scan",
  "--max-files",
  "80",
  "--max-depth",
  "4",
  "--import-format",
  "DXF",
  "--export-format",
  "STEP",
  "--file-extension",
  ".mockcad",
  "--output-dir",
  join(smokeRoot, "direct-probe")
]);
const probePlan = readJson(directProbe.probePlanPath);
const probeResult = readJson(directProbe.probeResultPath);
const nextProfileRequest = readJson(directProbe.nextProfileRequestPath);
const profile = runNodeScript("create-software-control-channel-profile.mjs", [
  "--goal",
  "Choose a reusable control route for the confirmed numbered voice command target.",
  "--software",
  "Mock Probe Engineering App",
  "--probe-result",
  directProbe.probeResultPath,
  "--create-adapter-selection",
  "--output-dir",
  join(smokeRoot, "profile-from-probe")
]);
const profileJson = readJson(profile.profilePath);
const advanced = await callAdvancedProbe();
const advancedNames = advanced.list.tools.map((tool) => tool.name);
const defaultCard = await callDefaultTeachProbe();

const checks = [
  {
    name: "Read-only probe discovers reusable route clues from bounded metadata",
    pass:
      directProbe.format === "transparent_ai_software_control_channel_probe_result_wrapper_v1" &&
      probePlan.format === "transparent_ai_software_control_channel_probe_plan_v1" &&
      probeResult.format === "transparent_ai_software_control_channel_probe_result_v1" &&
      probeResult.lowTokenPolicy?.fileContentsRead === false &&
      probeResult.locks?.targetSoftwareCommandsExecuted === false &&
      probeResult.locks?.softwareActionsExecuted === false &&
      probeResult.discoveredSignals.apiRoutes.length > 0 &&
      probeResult.discoveredSignals.macroRoutes.length > 0 &&
      probeResult.discoveredSignals.cliRoutes.length > 0 &&
      probeResult.discoveredSignals.fileImportExportRoutes.length > 0 &&
      probeResult.discoveredSignals.browserOrLocalServiceRoutes.length > 0 &&
      Array.isArray(probeResult.discoveredSignals.windowsUiFallbackRoutes),
    evidence: directProbe.probeResultPath
  },
  {
    name: "Probe result feeds the software control-channel profile before adapter selection",
    pass:
      nextProfileRequest.tool === "create_software_control_channel_profile" &&
      nextProfileRequest.arguments.probeResult === directProbe.probeResultPath &&
      profileJson.sourceProbeResult?.format === "transparent_ai_software_control_channel_probe_result_v1" &&
      profileJson.sourceProbeResult.apiRouteCount > 0 &&
      profileJson.recommendedRoute.structuredRouteFound === true &&
      profile.primaryAdapterId !== "existing-windows-ui-automation",
    evidence: profile.profilePath
  },
  {
    name: "MCP advanced mode exposes and runs software control-channel probe",
    pass:
      advanced.list.mode === "advanced" &&
      advancedNames.includes("create_software_control_channel_probe") &&
      advanced.result.format === "transparent_ai_software_control_channel_probe_result_wrapper_v1" &&
      advanced.result.softwareActionsExecuted === false &&
      advanced.result.targetSoftwareCommandsExecuted === false,
    evidence: `mode=${advanced.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes probe intent to the read-only probe card",
    pass:
      defaultCard.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultCard.status === "waiting_for_software_control_channel_probe_review" &&
      defaultCard.softwareControlChannelProbe?.probePlan &&
      defaultCard.softwareControlChannelProbe?.nextProfileRequest &&
      defaultCard.softwareControlChannelProbe?.softwareActionsExecuted === false &&
      defaultCard.softwareControlChannelProbe?.nativeUniversalExecution === false,
    evidence: defaultCard.softwareControlChannelProbe?.probePlan || "missing"
  },
  {
    name: "Probe keeps recording, screenshots, target commands, acceptance, memory, and packaging locked",
    pass:
      directProbe.fullContinuousRecording === false &&
      directProbe.screenshotsCaptured === false &&
      directProbe.softwareActionsExecuted === false &&
      directProbe.targetSoftwareCommandsExecuted === false &&
      directProbe.nativeUniversalExecution === false &&
      probeResult.locks?.accepted === false &&
      probeResult.locks?.ruleEnabled === false &&
      probeResult.locks?.packagingGated === true,
    evidence: JSON.stringify(probeResult.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const summary = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_software_control_channel_probe_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
