#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const serverScript = "plugins/transparent-ai-apprentice/scripts/mcp-server.mjs";
const smokeRoot = join(repoRoot, ".transparent-apprentice", "adaptive-observer-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });
const logPath = join(smokeRoot, "unknown-design-app.log");
writeFileSync(logPath, "INFO open\nWARN export preset changed\n", "utf8");

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

async function callAdvancedAdaptive(profilePath, probePath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_adaptive_software_observer_from_profile",
      arguments: {
        profile: profilePath,
        probeResult: probePath,
        outputDir: join(smokeRoot, "mcp-adaptive")
      }
    });
    return { list, adaptive: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachProbe(profile, probe) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        goal: "Continue from the software capability probe and create the low-token observer.",
        message:
          "transparent_ai_software_capability_probe_result_v1\n```json\n" +
          JSON.stringify(probe, null, 2) +
          "\n```",
        softwareProfile: profile
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const profileResult = runNodeScript("create-software-capability-profile.mjs", [
  "--goal",
  "Discover low-token observation sources for an unknown design app.",
  "--software",
  "unknown design app",
  "--process-name",
  "unknown-design-app",
  "--log-path",
  logPath,
  "--log-root",
  smokeRoot,
  "--output-dir",
  join(smokeRoot, "profile")
]);
const profile = JSON.parse(readFileSync(profileResult.profilePath, "utf8"));
const probe = {
  format: "transparent_ai_software_capability_probe_result_v1",
  profileId: profile.profileId,
  software: profile.software,
  createdAt: new Date().toISOString(),
  fullContinuousRecording: false,
  readOnlyProbe: true,
  processMatches: [{ processName: "unknown-design-app", id: 1234, mainWindowTitle: "Unknown Design App", path: "" }],
  candidateLogs: [{ path: logPath, lastWriteTimeUtc: new Date().toISOString(), bytes: 38, extension: ".log" }],
  eventSummaries: [{ logName: "Application", recentCount: 1, latest: [] }],
  recommendedNextTool: "create_universal_software_observer_kit",
  needsTeacherQuestion: false,
  locks: profile.locks
};
const probePath = join(dirname(profileResult.profilePath), "software-capability-probe-result.json");
writeFileSync(probePath, `${JSON.stringify(probe, null, 2)}\n`, "utf8");

const direct = runNodeScript("create-adaptive-software-observer-from-profile.mjs", [
  "--profile",
  profileResult.profilePath,
  "--probe-result",
  probePath,
  "--output-dir",
  join(smokeRoot, "direct-adaptive")
]);
const setup = JSON.parse(readFileSync(direct.setupPath, "utf8"));
const observerManifest = JSON.parse(readFileSync(direct.observerKitPath, "utf8"));
const advanced = await callAdvancedAdaptive(profileResult.profilePath, probePath);
const defaultCard = await callDefaultTeachProbe(profile, probe);
const advancedNames = advanced.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Adaptive observer bridge creates a universal observer from profile and probe result",
    pass:
      direct.format === "transparent_ai_adaptive_software_observer_setup_result_v1" &&
      setup.format === "transparent_ai_adaptive_software_observer_setup_v1" &&
      existsSync(direct.observerKitPath) &&
      existsSync(direct.observerCollector) &&
      observerManifest.sourceCatalog?.explicitLogPaths?.includes(logPath),
    evidence: direct.setupPath
  },
  {
    name: "Adaptive setup keeps low-token and no native execution locks",
    pass:
      direct.fullContinuousRecording === false &&
      direct.nativeUniversalExecution === false &&
      setup.locks?.ruleEnabled === false &&
      setup.locks?.packagingGated === true,
    evidence: JSON.stringify(direct.reviewLocks)
  },
  {
    name: "MCP advanced mode exposes adaptive observer bridge",
    pass:
      advanced.list.mode === "advanced" &&
      advancedNames.includes("create_adaptive_software_observer_from_profile") &&
      advanced.adaptive.format === "transparent_ai_adaptive_software_observer_setup_result_v1" &&
      advanced.adaptive.selectedLogPathCount >= 1,
    evidence: `mode=${advanced.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes pasted software probe result to adaptive observer setup",
    pass:
      defaultCard.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultCard.status === "waiting_for_adaptive_observer_review" &&
      defaultCard.adaptiveObserverSetup?.observerKitPath &&
      defaultCard.adaptiveObserverSetup?.fullContinuousRecording === false,
    evidence: defaultCard.adaptiveObserverSetup?.setupPath ?? ""
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_adaptive_software_observer_from_profile_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
