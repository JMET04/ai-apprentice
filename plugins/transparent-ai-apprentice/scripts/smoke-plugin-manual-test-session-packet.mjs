#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRepoRoot = resolve(pluginRoot, "..", "..");
const sourceServerScript = join(sourceRepoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const runsFromSourceTree = existsSync(sourceServerScript);
const repoRoot = runsFromSourceTree ? sourceRepoRoot : resolve(process.cwd());
const serverScript = runsFromSourceTree ? sourceServerScript : packagedServerScript;
const outRoot = join(repoRoot, ".ta-smoke", "plugin-manual-test-session-packet");
const sessionOutDir = join(outRoot, "session");
const mcpSessionOutDir = join(outRoot, "mcp-session");
const validationOutDir = join(outRoot, "validation");

const checks = [];

function check(name, pass, evidence = "") {
  checks.push({ name, pass, evidence });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function runScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`${scriptName} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function withTimeout(promise, ms, label) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

function startServer() {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" }
  });
  let nextId = 1;
  let stdoutBuffer = "";
  let stderr = "";
  const pending = new Map();

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
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
  child.on("exit", () => {
    for (const request of pending.values()) request.reject(new Error(stderr || "MCP server exited before replying"));
    pending.clear();
  });

  function rpc(method, params = {}) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return withTimeout(new Promise((resolve, reject) => pending.set(id, { resolve, reject })), 15000, method);
  }

  async function stop() {
    if (!child.killed) child.kill();
    await withTimeout(new Promise((resolve) => child.once("exit", resolve)), 5000, "mcp-server-stop").catch(() => {});
  }

  return { rpc, stop };
}

async function withServer(fn) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    return await fn(server);
  } finally {
    await server.stop();
  }
}

function parseToolResult(result) {
  return JSON.parse(result.content[0].text);
}

const sessionResult = runScript("create-plugin-manual-test-session-packet.mjs", [
  "--goal",
  "Smoke-test one-pass manual test session packet.",
  "--out-dir",
  sessionOutDir
]);
const sessionPacket = readJson(sessionResult.sessionPacketPath);
const receipt = readJson(sessionPacket.sessionPaths.fillableReceiptPath);
const filledReceipt = {
  ...receipt,
  scenarioReceipts: receipt.scenarioReceipts.map((row, index) =>
    index === 0
      ? {
          ...row,
          observedStatus: "matched_expected",
          observedEvidencePaths: [sessionPacket.sessionPaths.sessionPacketPath],
          observedNotes: "Observed expected teacher-facing setup and manual test handoff.",
          testerInitials: "SMK",
          testedAt: "2026-06-30T00:00:00.000Z"
        }
      : row
  ),
  reviewerSummary: {
    overallDecision: "needs_teacher_review",
    readyForFollowUpPlanning: true,
    productAcceptanceClaimed: false,
    notes: "Smoke leaves unrun scenarios for follow-up queue verification."
  }
};
writeJson(sessionPacket.sessionPaths.fillableReceiptPath, filledReceipt);
const validationResult = runScript("validate-plugin-manual-test-result-receipt.mjs", [
  "--readiness",
  sessionPacket.sessionPaths.readinessPackPath,
  "--receipt",
  sessionPacket.sessionPaths.fillableReceiptPath,
  "--out-dir",
  validationOutDir
]);
const validation = readJson(validationResult.validationPath);

check(
  "Manual test session packet creates a single tester handoff",
  sessionPacket.responseMode === "transparent_ai_apprentice_manual_test_session_packet_v1" &&
    sessionPacket.status === "ready_for_human_manual_test_session" &&
    existsSync(sessionPacket.sessionPaths.startHereMarkdownPath) &&
    existsSync(sessionPacket.sessionPaths.fillableReceiptPath),
  `status=${sessionPacket.status}; scenarios=${sessionPacket.scenarios.length}`
);

check(
  "Session packet bundles readiness, result receipt, and return validation flow",
  existsSync(sessionPacket.sessionPaths.readinessPackPath) &&
    existsSync(sessionPacket.sessionPaths.receiptTemplatePath) &&
    sessionPacket.testerFlow.some((item) => item.step === "validate_return") &&
    sessionPacket.commandSequence.includes("npm run smoke:plugin-manual-test-result-receipt"),
  sessionPacket.testerFlow.map((item) => item.step).join(",")
);

check(
  "Filled session receipt validates into a follow-up queue without acceptance",
  validation.responseMode === "transparent_ai_apprentice_manual_test_result_receipt_validation_v1" &&
    validation.status === "manual_test_results_validated_for_follow_up" &&
    validation.counts.matchedExpected === 1 &&
    validation.followUpQueue.length >= 1 &&
    validation.safetyBoundary.claimsProductAcceptance === false,
  `counts=${JSON.stringify(validation.counts)}; followUp=${validation.followUpQueue.length}`
);

check(
  "Manual test session keeps product locks closed",
  sessionPacket.safetyBoundary.reviewOnly === true &&
    sessionPacket.safetyBoundary.executesTargetSoftware === false &&
    sessionPacket.safetyBoundary.writesMemory === false &&
    sessionPacket.safetyBoundary.enablesRules === false &&
    sessionPacket.safetyBoundary.unlocksPackaging === false &&
    sessionPacket.safetyBoundary.claimsProductAcceptance === false &&
    sessionPacket.safetyBoundary.claimsCompletion === false,
  JSON.stringify(sessionPacket.safetyBoundary)
);

const mcpResult = await withServer(async (server) => {
  const toolsResult = await server.rpc("tools/list", {});
  const mcpSession = parseToolResult(
    await server.rpc("tools/call", {
      name: "create_plugin_manual_test_session_packet",
      arguments: {
        goal: "MCP smoke manual test session packet.",
        outDir: mcpSessionOutDir
      }
    })
  );
  return { tools: toolsResult.tools || [], session: mcpSession };
});

check(
  "MCP advanced mode exposes and runs manual test session packet",
  mcpResult.tools.some((tool) => tool.name === "create_plugin_manual_test_session_packet") &&
    mcpResult.session.status === "ready_for_human_manual_test_session" &&
    existsSync(mcpResult.session.sessionPacketPath || ""),
  `listed=${mcpResult.tools.length}; session=${mcpResult.session.status}`
);

const passed = checks.filter((item) => item.pass).length;
const output = {
  responseMode: "transparent_ai_apprentice_manual_test_session_packet_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  command: "npm run smoke:plugin-manual-test-session-packet",
  passed,
  total: checks.length,
  checks,
  nextAction: "Hand MANUAL_TEST_SESSION_START_HERE.md to a tester, then validate the returned receipt."
};

console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") process.exit(1);
