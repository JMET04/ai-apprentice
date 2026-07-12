#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const serverScript = "plugins/transparent-ai-apprentice/scripts/mcp-server.mjs";
const smokeRoot = join(repoRoot, ".transparent-apprentice", "software-profile-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });
writeFileSync(join(smokeRoot, "generic-editor.log"), "INFO saved design\nWARN export preset changed\n", "utf8");

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
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }
  async function stop() {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
  return { rpc, stop };
}

async function callAdvancedProfile() {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_software_capability_profile",
      arguments: {
        goal: "Discover low-token observation sources before teaching a browser app workflow.",
        software: "generic browser app",
        processName: "chrome",
        logRoots: [smokeRoot],
        outputDir: join(smokeRoot, "mcp-profile")
      }
    });
    return { list, profile: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachProfile() {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        goal: "Help me automatically discover logs and learn this unknown software with low token usage.",
        message: "Please auto discover the software logs first, do not record continuously.",
        software: "generic video editor",
        processName: "genericvideo",
        logRoots: [smokeRoot],
        autoDiscoverSoftware: true
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const direct = runNodeScript("create-software-capability-profile.mjs", [
  "--goal",
  "Discover how a generic editor can be observed before teaching.",
  "--software",
  "generic editor",
  "--process-name",
  "generic-editor",
  "--log-root",
  smokeRoot,
  "--output-dir",
  join(smokeRoot, "direct-profile")
]);
const directProfile = JSON.parse(readFileSync(direct.profilePath, "utf8"));
const directPlan = JSON.parse(readFileSync(direct.observationPlan, "utf8"));
const directProbe = readFileSync(direct.probe, "utf8");
const advanced = await callAdvancedProfile();
const defaultCard = await callDefaultTeachProfile();
const advancedNames = advanced.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Software capability profile creates a low-token read-only probe package",
    pass:
      direct.format === "transparent_ai_software_capability_profile_result_v1" &&
      directProfile.format === "transparent_ai_software_capability_profile_v1" &&
      existsSync(direct.probe) &&
      directProbe.includes("Get-Process") &&
      directProbe.includes("Get-WinEvent") &&
      directProfile.locks?.fullContinuousRecording === false,
    evidence: direct.profilePath
  },
  {
    name: "Profile maps unknown software to observer, workalong, overlay, and supervised action next steps",
    pass:
      directPlan.format === "transparent_ai_software_observation_plan_v1" &&
      directPlan.stages.some((stage) => stage.id === "create_universal_observer") &&
      directPlan.stages.some((stage) => stage.id === "workalong_learning") &&
      directPlan.stages.some((stage) => stage.id === "overlay_to_supervised_action"),
    evidence: direct.observationPlan
  },
  {
    name: "MCP advanced mode exposes software capability profiles",
    pass:
      advanced.list.mode === "advanced" &&
      advancedNames.includes("create_software_capability_profile") &&
      advanced.profile.format === "transparent_ai_software_capability_profile_result_v1",
    evidence: `mode=${advanced.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes software discovery intent to the profile bridge",
    pass:
      defaultCard.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultCard.status === "waiting_for_software_profile_review" &&
      defaultCard.softwareCapabilityProfile?.defaultNextTool === "create_universal_software_observer_kit" &&
      defaultCard.softwareCapabilityProfile?.fullContinuousRecording === false,
    evidence: defaultCard.softwareCapabilityProfile?.profilePath ?? ""
  },
  {
    name: "Software profile keeps universal native execution unclaimed",
    pass:
      direct.nativeUniversalExecution === false &&
      directProfile.locks?.nativeUniversalExecution === false &&
      defaultCard.softwareCapabilityProfile?.nativeUniversalExecution === false,
    evidence: JSON.stringify(direct.reviewLocks)
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_software_capability_profile_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
