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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "coverage-repair-queue-smoke", String(Date.now()));
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
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(name, value) {
  const path = join(smokeRoot, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
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

async function callAdvanced(auditPath, repairPlanPath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_all_software_coverage_repair_queue",
      arguments: {
        goal: "Turn coverage audit gaps into reviewed next repair actions.",
        audit: auditPath,
        repairPlan: repairPlanPath,
        outputDir: join(smokeRoot, "mcp-repair-queue")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefault(auditPath, repairPlanPath) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        whatToTeach: "Create a repair queue for all software coverage gaps.",
        message: "Use the coverage audit and repair plan to prioritize the next low-token repair actions.",
        allSoftwareCoverageRepairQueue: true,
        audit: auditPath,
        repairPlan: repairPlanPath,
        outputDir: join(smokeRoot, "default-repair-queue")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const audit = {
  format: "transparent_ai_all_software_observer_coverage_audit_v1",
  auditId: "coverage-repair-smoke-audit",
  coverageRows: [
    {
      software: "CoveredBrowser",
      processName: "coveredbrowser",
      coverageStatus: "covered_with_log_metadata_route",
      routeType: "log_metadata_then_tail_on_trigger",
      candidateLogFileCount: 1,
      queueItemPresent: true,
      watchEvidenceCount: 0,
      gaps: ["no_watch_or_learning_cycle_evidence_yet"],
      nextRepairCalls: []
    },
    {
      software: "InventoryOnlyCAD",
      processName: "inventorycad",
      coverageStatus: "inventory_logs_waiting_for_queue",
      routeType: "queue_not_built_yet",
      candidateLogFileCount: 2,
      queueItemPresent: false,
      watchEvidenceCount: 0,
      gaps: ["missing_observer_queue_item", "inventory_log_sources_not_promoted_to_queue", "no_watch_or_learning_cycle_evidence_yet"],
      nextRepairCalls: []
    },
    {
      software: "UnknownPrivateApp",
      processName: "unknownprivate",
      coverageStatus: "needs_teacher_review_or_manual_signal",
      routeType: "coverage_gap",
      candidateLogFileCount: 0,
      queueItemPresent: false,
      watchEvidenceCount: 0,
      gaps: ["missing_observer_queue_item", "missing_log_or_non_log_signal", "no_watch_or_learning_cycle_evidence_yet"],
      nextRepairCalls: []
    },
    {
      software: "PrivateCoveredApp",
      processName: "privatecovered",
      coverageStatus: "covered_with_non_log_fallback_and_watch_evidence",
      routeType: "windows_event_process_file_delta_or_teacher_marker",
      nonLogFallbackSignalCount: 2,
      queueItemPresent: true,
      watchEvidenceCount: 1,
      gaps: [],
      nextRepairCalls: []
    },
    {
      software: "NoLogModeler",
      processName: "nologmodeler",
      coverageStatus: "covered_with_non_log_fallback_route",
      routeType: "windows_event_process_file_delta_or_teacher_marker",
      nonLogFallbackSignalCount: 2,
      queueItemPresent: true,
      watchEvidenceCount: 0,
      gaps: ["no_watch_or_learning_cycle_evidence_yet"],
      nextRepairCalls: []
    }
  ],
  locks: { accepted: false, ruleEnabled: false, packagingGated: true }
};

const repairPlan = {
  format: "transparent_ai_all_software_observer_coverage_repair_plan_v1",
  auditId: audit.auditId,
  repairItems: audit.coverageRows.filter((row) => row.gaps.length > 0),
  locks: { accepted: false, ruleEnabled: false, packagingGated: true }
};

const auditPath = writeJson("audit.json", audit);
const repairPlanPath = writeJson("repair-plan.json", repairPlan);
const direct = runNodeScript("create-all-software-coverage-repair-queue.mjs", [
  "--goal",
  "Turn all software coverage gaps into reviewed repair actions.",
  "--audit",
  auditPath,
  "--repair-plan",
  repairPlanPath,
  "--output-dir",
  join(smokeRoot, "direct")
]);
const directQueue = readJson(direct.queuePath);
const directReceiptTemplate = readJson(direct.receiptTemplatePath);
const mcp = await callAdvanced(auditPath, repairPlanPath);
const mcpQueue = readJson(mcp.result.queuePath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const defaultRoute = await callDefault(auditPath, repairPlanPath);

const queuedSoftware = directQueue.repairItems.map((item) => item.software);
const inventoryOnly = directQueue.repairItems.find((item) => item.software === "InventoryOnlyCAD");
const unknownPrivate = directQueue.repairItems.find((item) => item.software === "UnknownPrivateApp");
const noLog = directQueue.repairItems.find((item) => item.software === "NoLogModeler");
const privateCovered = directQueue.repairItems.find((item) => item.software === "PrivateCoveredApp");

const checks = [
  {
    name: "Coverage repair queue includes real gaps without re-queuing already covered log routes",
    pass:
      directQueue.format === "transparent_ai_all_software_coverage_repair_queue_v1" &&
      directQueue.counts.repairItems === 4 &&
      !queuedSoftware.includes("CoveredBrowser") &&
      queuedSoftware.includes("InventoryOnlyCAD") &&
      queuedSoftware.includes("UnknownPrivateApp") &&
      queuedSoftware.includes("PrivateCoveredApp") &&
      queuedSoftware.includes("NoLogModeler"),
    evidence: direct.queuePath
  },
  {
    name: "Repair queue maps gaps to existing low-token tools instead of new native execution",
    pass:
      inventoryOnly.actionKind === "promote_inventory_candidate_to_observer_queue" &&
      inventoryOnly.nextRepairCalls.some((call) => call.tool === "create_software_observer_queue") &&
      unknownPrivate.actionKind === "teacher_exclusion_review" &&
      privateCovered.actionKind === "teacher_exclusion_review" &&
      privateCovered.gaps.includes("teacher_exclusion_review_required_for_private_or_unknown_software") &&
      privateCovered.reviewReason.includes("teacher_exclusion_review_required") &&
      noLog.actionKind === "validate_non_log_fallback_signal" &&
      noLog.nextRepairCalls.some((call) => call.tool === "create_triggered_visual_check_request") &&
      noLog.nextRepairCalls.some((call) => call.arguments?.maxScreenshots === 1),
    evidence: direct.queuePath
  },
  {
    name: "Repair queue receipt template stays teacher-review-only",
    pass:
      directReceiptTemplate.format === "transparent_ai_all_software_coverage_repair_queue_receipt_template_v1" &&
      directReceiptTemplate.defaultDecision === "needs_teacher_review" &&
      directReceiptTemplate.blockedDecisions.includes("accepted") &&
      directReceiptTemplate.rows.every((row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true) &&
      directQueue.locks.logContentsRead === false &&
      directQueue.locks.screenshotsCaptured === false &&
      directQueue.locks.softwareActionsExecuted === false &&
      directQueue.locks.memoryWritten === false,
    evidence: direct.receiptTemplatePath
  },
  {
    name: "MCP advanced mode exposes and runs coverage repair queue",
    pass:
      advancedNames.includes("create_all_software_coverage_repair_queue") &&
      advancedNames.length >= 71 &&
      mcp.result.format === "transparent_ai_all_software_coverage_repair_queue_result_v1" &&
      mcpQueue.counts.repairItems === 4,
    evidence: mcp.result.queuePath
  },
  {
    name: "Default teach_apprentice routes explicit repair-queue requests to the queue card",
    pass:
      defaultRoute.status === "waiting_for_all_software_coverage_repair_queue_review" &&
      defaultRoute.allSoftwareCoverageRepairQueue?.repairItems === 4 &&
      defaultRoute.reviewLocks.packagingGated === true,
    evidence: defaultRoute.allSoftwareCoverageRepairQueue?.queuePath || ""
  }
];

const failed = checks.filter((check) => !check.pass);
const result = {
  smoke: "transparent_ai_all_software_coverage_repair_queue_smoke_v1",
  ok: failed.length === 0,
  checks,
  outputRoot: smokeRoot,
  direct,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(result, null, 2));
if (failed.length > 0) process.exit(1);
