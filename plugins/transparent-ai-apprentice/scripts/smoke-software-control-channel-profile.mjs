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
const smokeRoot = join(repoRoot, ".transparent-apprentice", "software-control-channel-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
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

async function callAdvancedTool() {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_software_control_channel_profile",
      arguments: {
        goal: "Choose the safest reusable control channel before executing a numbered target.",
        software: "Mock local API engineering app",
        processName: "mock-engineering",
        apiHint: "local REST API and macro recorder are available",
        commandHelp: "mock-engineering.exe --help --export --script",
        importFormats: ["DXF"],
        exportFormats: ["STEP"],
        createAdapterSelection: true,
        outputDir: join(smokeRoot, "mcp")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachControlProfile() {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        goal: "Before executing in this engineering software, discover API CLI file import routes first.",
        message: "Find the controllable channels for this app before UI automation. Prefer API or command line, then file import/export, and only last use UI clicks.",
        software: "Generic controllable engineering app",
        processName: "generic-control",
        softwareControlChannelProfile: true,
        apiHint: "COM automation and macro recorder",
        commandHelp: "generic-control.exe --help --import --export",
        importFormats: ["DXF"],
        outputDir: join(smokeRoot, "default-card")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const actionPlanPath = join(smokeRoot, "reviewed-action-plan.json");
writeFileSync(
  actionPlanPath,
  JSON.stringify(
    {
      format: "transparent_ai_supervised_software_action_plan_v1",
      targetSoftware: { windowTitle: "Mock engineering app" },
      actions: [{ id: "set-dimension", kind: "type_text", selector: "#dimension", text: "42" }],
      locks: { nativeUniversalExecution: false, accepted: false, packagingGated: true }
    },
    null,
    2
  ),
  "utf8"
);

const direct = runNodeScript("create-software-control-channel-profile.mjs", [
  "--goal",
  "Execute a teacher-confirmed sketch target in a CAD-like app using existing control channels first.",
  "--software",
  "Mock CAD API app",
  "--process-name",
  "mockcad",
  "--window-title",
  "Mock CAD",
  "--api-hint",
  "documented local API, SDK endpoint, COM automation, macro recorder",
  "--command-help",
  "mockcad.exe --help --script --export --import",
  "--file-extension",
  ".cadjson",
  "--import-format",
  "DXF",
  "--export-format",
  "STEP",
  "--action-plan",
  actionPlanPath,
  "--create-adapter-selection",
  "--output-dir",
  join(smokeRoot, "direct")
]);
const directProfile = JSON.parse(readFileSync(direct.profilePath, "utf8"));
const adapterRequest = JSON.parse(readFileSync(direct.adapterRequestPath, "utf8"));
const directAdapterSelection = direct.adapterSelectionPath ? JSON.parse(readFileSync(direct.adapterSelectionPath, "utf8")) : null;
const mcp = await callAdvancedTool();
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const defaultCard = await callDefaultTeachControlProfile();

const checks = [
  {
    name: "Control channel profile ranks structured routes before Windows UI fallback",
    pass:
      direct.format === "transparent_ai_software_control_channel_profile_result_v1" &&
      directProfile.format === "transparent_ai_software_control_channel_profile_v1" &&
      directProfile.recommendedRoute.structuredRouteFound === true &&
      directProfile.recommendedRoute.fallbackAdapterId === "existing-windows-ui-automation" &&
      directProfile.recommendedRoute.recommendedAdapters[0] !== "existing-windows-ui-automation" &&
      directProfile.channels.some((channel) => channel.adapterId === "existing-application-api" && channel.evidence.length > 0) &&
      directProfile.channels.some((channel) => channel.adapterId === "existing-cli-or-script" && channel.evidence.length > 0) &&
      directProfile.channels.some((channel) => channel.adapterId === "existing-file-import-export" && channel.evidence.length > 0),
    evidence: direct.profilePath
  },
  {
    name: "Control profile writes an adapter request compatible with existing execution adapter selection",
    pass:
      adapterRequest.format === "transparent_ai_software_control_channel_existing_adapter_request_v1" &&
      adapterRequest.tool === "create_existing_software_execution_adapter" &&
      adapterRequest.arguments.capabilityProfile === direct.profilePath &&
      adapterRequest.routeOrder.includes(direct.primaryAdapterId),
    evidence: direct.adapterRequestPath
  },
  {
    name: "Control profile can create an existing adapter package without executing software",
    pass:
      directAdapterSelection?.format === "transparent_ai_existing_software_execution_adapter_selection_v1" &&
      directAdapterSelection.locks?.noAutonomousExecution === true &&
      directAdapterSelection.locks?.nativeUniversalExecution === false &&
      directAdapterSelection.executionPackage?.runnerEntries?.length > 0 &&
      direct.softwareActionsExecuted === false,
    evidence: direct.adapterSelectionPath
  },
  {
    name: "MCP advanced mode exposes and runs software control channel profile",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_software_control_channel_profile") &&
      mcp.result.format === "transparent_ai_software_control_channel_profile_result_v1" &&
      Boolean(mcp.result.executionPackagePath),
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes control-channel intent to the profile bridge",
    pass:
      defaultCard.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultCard.status === "waiting_for_software_control_channel_review" &&
      defaultCard.softwareControlChannelProfile?.primaryAdapterId !== "existing-windows-ui-automation" &&
      defaultCard.softwareControlChannelProfile?.nativeUniversalExecution === false,
    evidence: defaultCard.softwareControlChannelProfile?.profilePath || "missing"
  },
  {
    name: "Control profile keeps execution, screenshots, memory, and packaging locked",
    pass:
      directProfile.locks?.softwareActionsExecuted === false &&
      directProfile.locks?.screenshotsCaptured === false &&
      directProfile.locks?.fullContinuousRecording === false &&
      directProfile.locks?.nativeUniversalExecution === false &&
      directProfile.locks?.accepted === false &&
      directProfile.locks?.ruleEnabled === false &&
      directProfile.locks?.packagingGated === true,
    evidence: JSON.stringify(directProfile.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const summary = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_software_control_channel_profile_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
