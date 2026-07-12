#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "teach-execute-loop-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: outputRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
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
      name: "create_teach_execute_learning_loop",
      arguments: {
        goal: "Learn from all software logs, teacher sketches, and supervised execution receipts.",
        software: "generic desktop app",
        teacherStyle: "teacher may use logs, overlay sketches, voice, or corrections",
        outputDir: join(smokeRoot, "mcp-loop")
      }
    });
    return {
      list,
      result: JSON.parse(result.content[0].text)
    };
  } finally {
    await server.stop();
  }
}

const direct = runNodeScript("create-teach-execute-learning-loop.mjs", [
  "--goal",
  "Learn arbitrary software workflows from cheap evidence, visual intent, and execution receipts.",
  "--software",
  "generic desktop app",
  "--teacher-style",
  "mixed: logs, overlay, voice, examples, corrections",
  "--output-dir",
  join(smokeRoot, "direct-loop")
]);
const mcp = await callAdvancedTool();
const runbook = JSON.parse(readFileSync(direct.runbookPath, "utf8"));
const receiptTemplate = JSON.parse(readFileSync(direct.verificationReceiptTemplate, "utf8"));
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const stageIds = runbook.stages.map((stage) => stage.id);
const toolChain = runbook.stages.map((stage) => stage.tool);

const checks = [
  {
    name: "Direct loop runbook connects observation, compact learning, overlay, execution, and memory",
    pass:
      direct.format === "transparent_ai_teach_execute_learning_loop_result_v1" &&
      runbook.format === "transparent_ai_teach_execute_learning_loop_v1" &&
      stageIds.includes("teacher_method_profile") &&
      stageIds.includes("all_software_observer_bootstrap") &&
      stageIds.includes("all_software_observer_supervisor") &&
      stageIds.includes("all_software_low_token_learning_cycle") &&
      stageIds.includes("automatic_observer_schedule") &&
      stageIds.includes("all_software_inventory") &&
      stageIds.includes("software_observer_queue") &&
      stageIds.includes("all_software_observer_coverage_audit") &&
      stageIds.includes("log_source_metadata_delta_gate") &&
      stageIds.includes("software_observation_delta_monitor") &&
      stageIds.includes("software_observer_watch_cycle") &&
      stageIds.includes("compact_learning_events") &&
      stageIds.includes("transparent_overlay") &&
      stageIds.includes("spatial_intent") &&
      stageIds.includes("software_control_channel_profile") &&
      stageIds.includes("execution_adapter_selection") &&
      stageIds.includes("supervised_action_plan") &&
      stageIds.includes("action_rehearsal") &&
      stageIds.includes("supervised_execution_gate") &&
      stageIds.includes("supervised_action_outcome_verification") &&
      stageIds.includes("approve_or_correct"),
    evidence: direct.runbookPath
  },
  {
    name: "Loop reuses existing tools instead of inventing a separate automation stack",
    pass:
      toolChain.includes("create_all_software_observer_bootstrap") &&
      toolChain.includes("create_teacher_learning_method_profile") &&
      toolChain.includes("run_all_software_observer_supervisor") &&
      toolChain.includes("run_all_software_low_token_learning_cycle") &&
      toolChain.includes("create_all_software_observer_coverage_audit") &&
      toolChain.includes("create_automatic_observer_schedule") &&
      toolChain.includes("create_software_observer_inventory") &&
      toolChain.includes("create_software_observer_queue") &&
      toolChain.includes("watch_log_source_metadata_deltas") &&
      toolChain.includes("run_software_observer_queue_item") &&
      toolChain.includes("monitor_software_observation_deltas") &&
      toolChain.includes("run_software_observer_watch_cycle") &&
      toolChain.includes("create_software_capability_profile") &&
      toolChain.includes("create_adaptive_software_observer_from_profile") &&
      toolChain.includes("create_universal_software_observer_kit") &&
      toolChain.includes("compact_universal_observation_learning_events") &&
      toolChain.includes("create_transparent_sketch_overlay_kit") &&
      toolChain.includes("interpret_transparent_sketch_spatial_intent") &&
      toolChain.includes("create_spatial_software_execution_route_bridge") &&
      toolChain.includes("create_software_control_channel_profile") &&
      toolChain.includes("create_existing_software_execution_adapter") &&
      toolChain.includes("create_supervised_software_action_kit") &&
      toolChain.includes("start_teach_execute_action_rehearsal") &&
      toolChain.includes("start_teach_execute_supervised_execution") &&
      toolChain.includes("verify_supervised_action_outcome") &&
      toolChain.includes("teach_apprentice") &&
      toolChain.some((tool) => tool.includes("correct_last_result")),
    evidence: toolChain.join(" -> ")
  },
  {
    name: "Loop keeps safety and honesty gates closed",
    pass:
      runbook.lowTokenPolicy.fullContinuousRecording === false &&
      runbook.lowTokenPolicy.retainedEvidenceLimits.fullLogs === false &&
      runbook.lowTokenPolicy.retainedEvidenceLimits.screenshotsByDefault === false &&
      runbook.lowTokenPolicy.evidencePreference.includes("software control channel profile before execution adapter selection") &&
      runbook.lowTokenPolicy.evidencePreference.includes("existing software execution adapter selection") &&
      runbook.locks.nativeUniversalExecution === false &&
      runbook.locks.packagingGated === true &&
      runbook.blockedClaims.includes("universal native app control is proven"),
    evidence: JSON.stringify(runbook.lowTokenPolicy)
  },
  {
    name: "Loop supports different teacher methods and visual depth teaching",
    pass:
      runbook.teacherAdaptation.supportedTeachingMethods.includes("transparent overlay sketch") &&
      runbook.teacherAdaptation.supportedTeachingMethods.includes("teacher learning method profile") &&
      runbook.teacherAdaptation.supportedTeachingMethods.includes("2D plane sketch") &&
      runbook.teacherAdaptation.supportedTeachingMethods.includes("perspective drawing") &&
      runbook.teacherAdaptation.supportedTeachingMethods.includes("3D depth sketch") &&
      runbook.teacherAdaptation.supportedTeachingMethods.includes("existing software execution adapter choice") &&
      runbook.requiredTeacherReviewPoints.includes("overlay spatial interpretation") &&
      runbook.requiredTeacherReviewPoints.includes("existing software execution adapter selection") &&
      runbook.requiredTeacherReviewPoints.includes("supervised action outcome verification before learning"),
    evidence: runbook.teacherAdaptation.supportedTeachingMethods.join(",")
  },
  {
    name: "Verification receipt template covers every stage before acceptance",
    pass:
      receiptTemplate.format === "transparent_ai_teach_execute_learning_loop_verification_receipt_v1" &&
      receiptTemplate.stageResults.length === runbook.stages.length &&
      receiptTemplate.finalDecision === "needs_teacher_review" &&
      receiptTemplate.locks.accepted === false,
    evidence: direct.verificationReceiptTemplate
  },
  {
    name: "MCP advanced mode exposes teach-execute learning loop",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_teach_execute_learning_loop") &&
      mcp.result.format === "transparent_ai_teach_execute_learning_loop_result_v1" &&
      mcp.result.stageCount === runbook.stages.length,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_teach_execute_learning_loop_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
