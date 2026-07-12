#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "original-goal-integrated-control-flow-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });
const serverScript = join(pluginRoot, "scripts", "mcp-server.mjs");

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
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
  let stderr = "";
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

  function rpc(method, params = {}) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function stop() {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }

  return { rpc, stop, stderr: () => stderr };
}

async function callMcpTool(name, args, extraEnv = {}) {
  const server = startServer(extraEnv);
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", { name, arguments: args });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const result = runNodeScript("create-original-goal-integrated-control-flow.mjs", [
  "--goal",
  "Smoke original goal integrated control flow.",
  "--output-dir",
  smokeRoot
]);
const flow = readJson(result.flowPath);
const html = readFileSync(result.htmlPath, "utf8");

const mcpAdvanced = await callMcpTool(
  "create_original_goal_integrated_control_flow",
  {
    goal: "MCP advanced smoke integrated control flow.",
    outputDir: join(smokeRoot, "mcp-advanced-integrated-flow")
  },
  { TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" }
);
const mcpAdvancedNames = mcpAdvanced.list.tools.map((tool) => tool.name);
const mcpAdvancedFlow = readJson(mcpAdvanced.result.flowPath);

const mcpDefault = await callMcpTool("teach_apprentice", {
  whatToTeach:
    "请把原目标整理成一个整体框架和统一流程，覆盖所有软件低 token 学习、透明蒙版、2D/透视/3D 草图演示、语音文字编号确认和回滚门控。",
  software: "all reviewed local software",
  outputDir: join(smokeRoot, "mcp-default-integrated-flow")
});
const mcpDefaultCard = mcpDefault.result;
const mcpDefaultFlow = readJson(mcpDefaultCard.originalGoalIntegratedControlFlow.flowPath);

const requiredStages = [
  "all_software_metadata_baseline",
  "event_triggered_low_token_policy",
  "one_bounded_visual_evidence",
  "learning_handoff",
  "tlcl_rag_contract_repair_loop",
  "voice_text_numbered_target",
  "transparent_sketch_depth_demo",
  "execution_approval_gate",
  "post_action_evidence"
];

const checks = [
  {
    name: "Integrated flow packet and HTML are generated",
    pass:
      result.format === "transparent_ai_original_goal_integrated_control_flow_result_v1" &&
      flow.format === "transparent_ai_original_goal_integrated_control_flow_v1" &&
      existsSync(result.htmlPath) &&
      existsSync(result.readmePath) &&
      html.includes("Original Goal Integrated Control Flow"),
    evidence: result.flowPath
  },
  {
    name: "Flow orders low-token metadata, event trigger, bounded visual evidence, learning, TLCL/RAG repair, voice, sketch, execution, and post-action stages",
    pass: requiredStages.every((stageId, index) => flow.stages[index]?.id === stageId),
    evidence: flow.stages.map((stage) => stage.id).join(", ")
  },
  {
    name: "Flow reuses existing tools instead of inventing a new executor",
    pass:
      flow.existingAbilitiesReused.includes("watch-log-source-metadata-deltas.mjs") &&
      flow.existingAbilitiesReused.includes("create-event-triggered-low-token-observation-policy.mjs") &&
      flow.existingAbilitiesReused.includes("capture-triggered-visual-check.mjs") &&
      flow.existingAbilitiesReused.includes("create-triggered-visual-evidence-learning-handoff.mjs") &&
      flow.existingAbilitiesReused.includes("create-tlcl-rag-informed-high-reasoning-repair-intake.mjs") &&
      flow.existingAbilitiesReused.includes("smoke-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit.mjs") &&
      flow.existingAbilitiesReused.includes("create-triggered-visual-evidence-voice-control-workbench.mjs") &&
      flow.existingAbilitiesReused.includes("create-transparent-sketch-depth-demonstration-rehearsal.mjs") &&
      flow.existingAbilitiesReused.includes("create-engineering-voice-execution-approval-gate.mjs"),
    evidence: `${flow.existingAbilitiesReused.length} reused tools`
  },
  {
    name: "Flow maps every original-goal requirement to coverage and remaining proof",
    pass:
      flow.requirementCoverage.length >= 7 &&
      flow.requirementCoverage.some((row) => row.requirement.includes("all software")) &&
      flow.requirementCoverage.some((row) => row.requirement.includes("transparent drawing mask")) &&
      flow.requirementCoverage.some((row) => row.requirement.includes("2D, and 3D")) &&
      flow.requirementCoverage.some((row) => row.requirement.includes("avoid wasting tokens")) &&
      flow.requirementCoverage.some((row) => row.requirement.includes("high reasoning")) &&
      flow.requirementCoverage.some((row) => row.requirement.includes("RAG is an external knowledge retriever")) &&
      flow.requirementCoverage.some((row) => row.requirement.includes("distilled skills")) &&
      flow.requirementCoverage.every((row) => row.evidenceNeededForCompletion),
    evidence: `${flow.requirementCoverage.length} requirement rows`
  },
  {
    name: "Integrated flow keeps RAG non-authoritative and medium runtime blocked until high-reasoning repair review",
    pass:
      flow.stages.some(
        (stage) =>
          stage.id === "tlcl_rag_contract_repair_loop" &&
          stage.nextCommand === "npm.cmd run smoke:plugin-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit" &&
          stage.inputEvidence.includes("<providerRoleUsePlanTrace>") &&
          stage.output.includes("medium-runtime continuation blocker") &&
          stage.gate.includes("RAG is evidence only") &&
          stage.blockedActions.includes("treat_retrieved_knowledge_as_authority") &&
          stage.blockedActions.includes("continue_medium_runtime_after_mismatch_without_high_reasoning_repair") &&
          stage.blockedActions.includes("drop_providerRoleUsePlanTrace") &&
          stage.locks.integratedFlowDoesNotEnableRules === true &&
          stage.locks.goalComplete === false
      ) &&
      html.includes("TLCL RAG evidence and high-reasoning contract repair loop") &&
      html.includes("RAG is evidence only"),
    evidence: flow.stages.find((stage) => stage.id === "tlcl_rag_contract_repair_loop")?.nextCommand || ""
  },
  {
    name: "Integrated flow keeps execution, screenshots, logs, memory, schedules, rules, packaging, and completion locked",
    pass:
      flow.locks.integratedFlowDoesNotCaptureScreenshots === true &&
      flow.locks.integratedFlowDoesNotReadFullLogs === true &&
      flow.locks.integratedFlowDoesNotExecuteSoftware === true &&
      flow.locks.integratedFlowDoesNotSendUiEvents === true &&
      flow.locks.integratedFlowDoesNotWriteMemory === true &&
      flow.locks.integratedFlowDoesNotRegisterSchedule === true &&
      flow.locks.integratedFlowDoesNotEnableRules === true &&
      flow.locks.screenshotsCaptured === false &&
      flow.locks.softwareActionsExecuted === false &&
      flow.locks.memoryWritten === false &&
      flow.locks.scheduledTaskRegistered === false &&
      flow.locks.accepted === false &&
      flow.locks.packagingGated === true &&
      flow.locks.goalComplete === false,
    evidence: JSON.stringify(flow.locks)
  },
  {
    name: "HTML tells the teacher the packet does not run commands",
    pass:
      html.includes("does not capture screenshots") &&
      html.includes("execute software") &&
      html.includes("write memory") &&
      html.includes("claim completion"),
    evidence: result.htmlPath
  },
  {
    name: "MCP advanced mode exposes and runs integrated control flow",
    pass:
      mcpAdvanced.list.mode === "advanced" &&
      mcpAdvancedNames.includes("create_original_goal_integrated_control_flow") &&
      mcpAdvanced.result.format === "transparent_ai_original_goal_integrated_control_flow_result_v1" &&
      mcpAdvancedFlow.format === "transparent_ai_original_goal_integrated_control_flow_v1" &&
      mcpAdvancedFlow.stages.length === 9 &&
      mcpAdvancedFlow.requirementCoverage.length >= 10 &&
      mcpAdvancedFlow.locks.integratedFlowDoesNotExecuteSoftware === true &&
      mcpAdvancedFlow.locks.goalComplete === false,
    evidence: mcpAdvanced.result.htmlPath
  },
  {
    name: "Default teach_apprentice routes overall framework request to integrated control flow card",
    pass:
      mcpDefaultCard.format === "transparent_ai_teach_apprentice_card_v1" &&
      mcpDefaultCard.status === "waiting_for_original_goal_integrated_control_flow_review" &&
      mcpDefaultCard.originalGoalIntegratedControlFlow?.stageCount === 9 &&
      mcpDefaultCard.originalGoalIntegratedControlFlow?.requirementCount >= 10 &&
      mcpDefaultCard.originalGoalIntegratedControlFlow?.integratedFlowDoesNotExecuteSoftware === true &&
      mcpDefaultCard.originalGoalIntegratedControlFlow?.goalComplete === false &&
      mcpDefaultFlow.format === "transparent_ai_original_goal_integrated_control_flow_v1" &&
      mcpDefaultFlow.locks.integratedFlowDoesNotCaptureScreenshots === true &&
      mcpDefaultFlow.locks.goalComplete === false,
    evidence: mcpDefaultCard.originalGoalIntegratedControlFlow?.htmlPath || ""
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_integrated_control_flow_smoke_v1",
      smokeRoot,
      flowPath: result.flowPath,
      htmlPath: result.htmlPath,
      mcpAdvancedFlowPath: mcpAdvanced.result.flowPath,
      mcpDefaultFlowPath: mcpDefaultCard.originalGoalIntegratedControlFlow?.flowPath ?? "",
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
