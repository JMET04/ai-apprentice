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
const outRoot = join(repoRoot, ".ta-smoke", "plugin-manual-test-result-receipt");
const readinessOutDir = join(outRoot, "readiness");
const templateOutDir = join(outRoot, "template");
const validationOutDir = join(outRoot, "validation");
const mcpTemplateOutDir = join(outRoot, "mcp-template");
const mcpValidationOutDir = join(outRoot, "mcp-validation");

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

const readinessResult = runScript("create-plugin-manual-test-readiness-pack.mjs", [
  "--goal",
  "Smoke-test manual result receipt validation.",
  "--out-dir",
  readinessOutDir
]);
const templateResult = runScript("create-plugin-manual-test-result-receipt-template.mjs", [
  "--readiness",
  readinessResult.packPath,
  "--out-dir",
  templateOutDir
]);
const template = readJson(templateResult.templatePath);
const filledReceipt = {
  ...template,
  scenarioReceipts: template.scenarioReceipts.map((row, index) => {
    if (index === 0) {
      return {
        ...row,
        observedStatus: "matched_expected",
        observedEvidencePaths: [readinessResult.packPath],
        observedNotes: "Default tool surface and installed plugin handoff were checked.",
        testerInitials: "SMK",
        testedAt: "2026-06-30T00:00:00.000Z"
      };
    }
    if (index === 1) {
      return {
        ...row,
        observedStatus: "blocker_found",
        observedNotes: "Teacher entry wording needs a follow-up copy review before a non-technical tester pass.",
        blockerQuestions: ["Should the first prompt show one recommended artifact type or all artifact types?"],
        nextReviewNotes: "Route to copy/UX review before acceptance.",
        testerInitials: "SMK",
        testedAt: "2026-06-30T00:00:00.000Z"
      };
    }
    if (index === 2) {
      return {
        ...row,
        observedStatus: "needs_follow_up",
        observedNotes: "Visual demonstration should be checked with a real tester-supplied screenshot.",
        nextReviewNotes: "Ask next tester for one real screenshot path.",
        testerInitials: "SMK",
        testedAt: "2026-06-30T00:00:00.000Z"
      };
    }
    return row;
  }),
  reviewerSummary: {
    overallDecision: "needs_teacher_review",
    readyForFollowUpPlanning: true,
    productAcceptanceClaimed: false,
    notes: "Smoke receipt intentionally leaves blockers and follow-up rows for validation."
  }
};
const receiptPath = writeJson(join(outRoot, "filled-manual-test-result-receipt.json"), filledReceipt);
const validationResult = runScript("validate-plugin-manual-test-result-receipt.mjs", [
  "--readiness",
  readinessResult.packPath,
  "--receipt",
  receiptPath,
  "--out-dir",
  validationOutDir
]);
const validation = readJson(validationResult.validationPath);

check(
  "Manual test result receipt template is created from readiness scenarios",
  template.responseMode === "transparent_ai_apprentice_manual_test_result_receipt_template_v1" &&
    template.scenarioReceipts.length === readJson(readinessResult.packPath).scenarios.length &&
    template.allowedStatuses.includes("matched_expected") &&
    template.defaultDecision === "needs_teacher_review",
  `rows=${template.scenarioReceipts.length}; statuses=${template.allowedStatuses.join(",")}`
);

check(
  "Manual test result validation accepts reviewed rows and preserves follow-up blockers",
  validation.responseMode === "transparent_ai_apprentice_manual_test_result_receipt_validation_v1" &&
    validation.status === "manual_test_results_validated_for_follow_up" &&
    validation.counts.matchedExpected === 1 &&
    validation.counts.blockerFound === 1 &&
    validation.counts.needsFollowUp === 1 &&
    validation.followUpQueue.length >= 2,
  `counts=${JSON.stringify(validation.counts)}; followUp=${validation.followUpQueue.length}`
);

check(
  "Manual test result validation keeps product locks closed",
  validation.safetyBoundary.reviewOnly === true &&
    validation.safetyBoundary.executesTargetSoftware === false &&
    validation.safetyBoundary.writesMemory === false &&
    validation.safetyBoundary.enablesRules === false &&
    validation.safetyBoundary.unlocksPackaging === false &&
    validation.safetyBoundary.claimsProductAcceptance === false &&
    validation.safetyBoundary.claimsCompletion === false,
  JSON.stringify(validation.safetyBoundary)
);

const mcpResult = await withServer(async (server) => {
  const toolsResult = await server.rpc("tools/list", {});
  const mcpTemplate = parseToolResult(
    await server.rpc("tools/call", {
      name: "create_plugin_manual_test_result_receipt_template",
      arguments: {
        readinessPack: readinessResult.packPath,
        outDir: mcpTemplateOutDir
      }
    })
  );
  const mcpValidation = parseToolResult(
    await server.rpc("tools/call", {
      name: "validate_plugin_manual_test_result_receipt",
      arguments: {
        readinessPack: readinessResult.packPath,
        receipt: receiptPath,
        outDir: mcpValidationOutDir
      }
    })
  );
  return { tools: toolsResult.tools || [], template: mcpTemplate, validation: mcpValidation };
});

check(
  "MCP advanced mode exposes and runs manual result receipt tools",
  mcpResult.tools.some((tool) => tool.name === "create_plugin_manual_test_result_receipt_template") &&
    mcpResult.tools.some((tool) => tool.name === "validate_plugin_manual_test_result_receipt") &&
    mcpResult.template.status === "ready_for_manual_test_result_collection" &&
    mcpResult.validation.status === "manual_test_results_validated_for_follow_up",
  `listed=${mcpResult.tools.length}; template=${mcpResult.template.status}; validation=${mcpResult.validation.status}`
);

const passed = checks.filter((item) => item.pass).length;
const output = {
  responseMode: "transparent_ai_apprentice_manual_test_result_receipt_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  command: "npm run smoke:plugin-manual-test-result-receipt",
  passed,
  total: checks.length,
  checks,
  nextAction:
    passed === checks.length
      ? "Use the receipt template after human testing, then validate filled results before follow-up planning."
      : "Fix failed manual test result receipt checks before relying on returned test evidence."
};

console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") {
  process.exit(1);
}
