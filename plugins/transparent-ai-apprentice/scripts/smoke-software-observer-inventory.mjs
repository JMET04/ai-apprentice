#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = mkdtempSync(join(tmpdir(), "transparent-ai-software-inventory-"));

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function callMcp(name, args = {}, advanced = true) {
  const env = { ...process.env };
  if (advanced) env.TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS = "1";
  const input = `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })}\n${JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name, arguments: args }
  })}\n`;
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", "mcp-server.mjs")], {
    cwd: repoRoot,
    input,
    env,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "mcp call failed");
  const lines = result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const listed = lines.find((line) => line.id === 1)?.result;
  const called = lines.find((line) => line.id === 2)?.result;
  return {
    listed,
    result: JSON.parse(called.content[0].text)
  };
}

const direct = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Inventory all software for low-token observer setup",
  "--max-processes",
  "12",
  "--max-installed",
  "24",
  "--output-dir",
  join(smokeRoot, "direct")
]);

const manifest = JSON.parse(readFileSync(direct.manifest, "utf8"));
const batchPlan = JSON.parse(readFileSync(direct.batchPlan, "utf8"));
const probeScript = readFileSync(direct.readOnlyProbe, "utf8");
const probeOutputPath = join(smokeRoot, "probe-inventory.json");
const probeRun = spawnSync("powershell", [
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  direct.readOnlyProbe,
  "-OutputPath",
  probeOutputPath,
  "-MaxProcesses",
  "4",
  "-MaxInstalled",
  "0",
  "-MaxLogFilesPerCandidate",
  "2"
], {
  cwd: smokeRoot,
  encoding: "utf8"
});
const probeInventory = existsSync(probeOutputPath)
  ? JSON.parse(readFileSync(probeOutputPath, "utf8").replace(/^\uFEFF/, ""))
  : null;

const mcp = callMcp("create_software_observer_inventory", {
  goal: "Create all-software low-token observer inventory",
  maxProcesses: 6,
  maxInstalled: 8,
  outputDir: join(smokeRoot, "mcp")
});

const defaultTeach = callMcp(
  "teach_apprentice",
  {
    message: "请把电脑上所有软件都先做一个低token日志观察清单，不要一直录屏。",
    allSoftwareInventory: true,
    maxProcesses: 6,
    maxInstalled: 8,
    outputDir: join(smokeRoot, "default")
  },
  false
).result;

const advancedNames = mcp.listed.tools.map((tool) => tool.name);
const checks = [
  {
    name: "Inventory script creates read-only all-software observer planning artifacts",
    pass:
      direct.format === "transparent_ai_software_observer_inventory_result_v1" &&
      existsSync(direct.readOnlyProbe) &&
      existsSync(direct.inventoryTemplate) &&
      existsSync(direct.batchPlan) &&
      manifest.format === "transparent_ai_software_observer_inventory_manifest_v1" &&
      batchPlan.format === "transparent_ai_software_observer_batch_plan_v1",
    evidence: direct.manifest
  },
  {
    name: "Read-only probe inventories running and installed software before screenshots",
    pass:
      probeScript.includes("Get-Process") &&
      probeScript.includes("CurrentVersion\\Uninstall") &&
      probeScript.includes("candidateLogRoots") &&
      probeScript.includes("Get-CandidateLogFiles") &&
      probeScript.includes("transparent_ai_all_software_log_source_index_v1") &&
      probeScript.includes("metadata_first_then_tail_on_trigger") &&
      probeScript.includes("fullContinuousRecording = $false") &&
      probeScript.includes("nativeUniversalExecution = $false"),
    evidence: direct.readOnlyProbe
  },
  {
    name: "Generated probe runs with small limits and writes bounded log-source index metadata",
    pass:
      probeRun.status === 0 &&
      probeInventory?.format === "transparent_ai_software_observer_inventory_v1" &&
      probeInventory?.logSourceIndex?.format === "transparent_ai_all_software_log_source_index_v1" &&
      probeInventory?.discoveryScope?.boundedLogSourceIndex === true &&
      probeInventory?.discoveryScope?.logContentsRead === false &&
      probeInventory?.logSourceIndex?.fullLogsRead === false &&
      Array.isArray(probeInventory?.softwareCandidates),
    evidence: `status=${probeRun.status}; output=${probeOutputPath}`
  },
  {
    name: "Batch plan connects each candidate to existing profile and universal observer tools",
    pass:
      batchPlan.defaultNextTools.includes("create_software_capability_profile") &&
      batchPlan.defaultNextTools.includes("create_software_observer_queue") &&
      batchPlan.defaultNextTools.includes("create_adaptive_software_observer_from_profile") &&
      batchPlan.defaultNextTools.includes("create_universal_software_observer_kit") &&
      batchPlan.perSoftwarePlanTemplate.preferredSignals.includes("triggered screenshot only after meaningful state change"),
    evidence: batchPlan.strategy
  },
  {
    name: "Inventory capability stays honest about execution and recording limits",
    pass:
      manifest.capabilities.notHardcodedToCadOrSolidWorks === true &&
      manifest.capabilities.buildsAllSoftwareLogSourceIndex === true &&
      manifest.capabilities.readsLogContentsByDefault === false &&
      manifest.capabilities.fullContinuousRecording === false &&
      manifest.capabilities.nativeUniversalExecution === false &&
      manifest.capabilities.teacherReviewOnly === true,
    evidence: JSON.stringify(manifest.capabilities)
  },
  {
    name: "MCP advanced mode exposes software observer inventory",
    pass:
      advancedNames.includes("create_software_observer_inventory") &&
      mcp.result.format === "transparent_ai_software_observer_inventory_result_v1",
    evidence: `mode=${mcp.listed.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes all-software log requests to inventory card",
    pass:
      defaultTeach.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultTeach.status === "waiting_for_software_inventory_review" &&
      defaultTeach.softwareObserverInventory?.readOnlyProbe &&
      defaultTeach.softwareObserverInventory?.fullContinuousRecording === false &&
      defaultTeach.softwareObserverInventory?.nativeUniversalExecution === false,
    evidence: defaultTeach.status
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_software_observer_inventory_smoke_v1",
  passed,
  total: checks.length,
  advancedToolCount: advancedNames.length,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
