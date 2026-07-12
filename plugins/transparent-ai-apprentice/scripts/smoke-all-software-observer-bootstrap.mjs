#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const sourceRepoRoot = resolve(pluginRoot, "..", "..");
const sourceServerScript = join(sourceRepoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const runsFromSourceTree = existsSync(sourceServerScript);
const repoRoot = runsFromSourceTree ? sourceRepoRoot : resolve(process.cwd());
const serverScript = runsFromSourceTree ? sourceServerScript : packagedServerScript;
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-observer-bootstrap-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function startServer() {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: { ...process.env, TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" },
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

async function callAdvancedBootstrap(inventoryPath) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_all_software_observer_bootstrap",
      arguments: {
        goal: "Learn from many desktop apps with cheap evidence first.",
        inventory: inventoryPath,
        maxCandidates: 2,
        maxFilesPerCandidate: 2,
        maxWatchItems: 2,
        maxLogsPerItem: 2,
        maxTailBytes: 512,
        outputDir: join(smokeRoot, "mcp-bootstrap")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const crmRoot = join(smokeRoot, "BrowserCRM");
const editorRoot = join(smokeRoot, "StudioEditor");
mkdirSync(crmRoot, { recursive: true });
mkdirSync(editorRoot, { recursive: true });
const crmLog = join(crmRoot, "browsercrm.log");
const editorLog = join(editorRoot, "studioeditor.log");
writeFileSync(crmLog, "startup complete\n", "utf8");
writeFileSync(editorLog, "opened project\n", "utf8");

const inventory = {
  format: "transparent_ai_software_observer_inventory_v1",
  goal: "Learn from all local software with low-token signals.",
  source: "smoke_reviewed_probe",
  softwareCandidates: [
    {
      software: "BrowserCRM",
      processName: "browsercrm.exe",
      windowTitle: "BrowserCRM - Orders",
      candidateLogRoots: [crmRoot],
      windowsEventLogs: ["Application"],
      confidence: 0.82,
      reason: "reviewed_non_cad_app"
    },
    {
      software: "StudioEditor",
      processName: "studioeditor.exe",
      windowTitle: "StudioEditor",
      candidateLogRoots: [editorRoot],
      windowsEventLogs: ["Application"],
      confidence: 0.78,
      reason: "reviewed_non_cad_app"
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    fullContinuousRecording: false,
    nativeUniversalExecution: false
  }
};
const inventoryPath = join(smokeRoot, "software-observer-inventory.json");
writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2), "utf8");

const bootstrap = runNodeScript("create-all-software-observer-bootstrap.mjs", [
  "--goal",
  "Bootstrap all software low-token learning.",
  "--inventory",
  inventoryPath,
  "--output-dir",
  join(smokeRoot, "direct-bootstrap"),
  "--max-candidates",
  "2",
  "--max-files-per-candidate",
  "2",
  "--max-watch-items",
  "2",
  "--max-logs-per-item",
  "2",
  "--max-tail-bytes",
  "512"
]);
const bootstrapPacket = JSON.parse(readFileSync(bootstrap.bootstrapPath, "utf8"));
const receipt = JSON.parse(readFileSync(bootstrap.receiptPath, "utf8"));
const reviewTemplate = JSON.parse(readFileSync(bootstrap.teacherReviewTemplate, "utf8"));
const mcp = await callAdvancedBootstrap(inventoryPath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Bootstrap creates one ordered all-software low-token runbook",
    pass:
      bootstrap.format === "transparent_ai_all_software_observer_bootstrap_result_v1" &&
      bootstrapPacket.format === "transparent_ai_all_software_observer_bootstrap_v1" &&
      bootstrapPacket.lowTokenWorkflow.includes("repeat watch cycle and inspect only changed log/event/file signals") &&
      bootstrapPacket.nextMcpCalls.includes("run_software_observer_watch_cycle"),
    evidence: bootstrap.bootstrapPath
  },
  {
    name: "Bootstrap turns reviewed non-CAD inventory into queue and watch baseline",
    pass:
      bootstrap.queuePath &&
      bootstrap.watchCyclePath &&
      receipt.queueCreatedFromProvidedInventory === true &&
      receipt.watchBaselineInitialized === true &&
      bootstrapPacket.queue.queuedCount === 2,
    evidence: JSON.stringify({ queuePath: bootstrap.queuePath, watchCyclePath: bootstrap.watchCyclePath })
  },
  {
    name: "Bootstrap keeps privacy, recording, memory, and native-execution gates locked",
    pass:
      reviewTemplate.blockedDecisions.includes("continuous_recording") &&
      reviewTemplate.blockedDecisions.includes("native_universal_execution") &&
      receipt.fullContinuousRecording === false &&
      receipt.screenshotsCaptured === false &&
      receipt.rawFullLogsRetained === false &&
      receipt.nativeUniversalExecution === false &&
      bootstrapPacket.locks.packagingGated === true,
    evidence: JSON.stringify(bootstrapPacket.locks)
  },
  {
    name: "Bootstrap emits teacher exclusion and teaching-style review template",
    pass:
      reviewTemplate.format === "transparent_ai_all_software_teacher_review_template_v1" &&
      Array.isArray(reviewTemplate.privateOrExcludedSoftware) &&
      Array.isArray(reviewTemplate.prioritySoftware) &&
      reviewTemplate.screenshotPolicy.includes("only_after"),
    evidence: bootstrap.teacherReviewTemplate
  },
  {
    name: "MCP advanced mode exposes and runs all-software observer bootstrap",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_all_software_observer_bootstrap") &&
      mcp.result.format === "transparent_ai_all_software_observer_bootstrap_result_v1" &&
      mcp.result.fullContinuousRecording === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_all_software_observer_bootstrap_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
