#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const serverScript = "plugins/transparent-ai-apprentice/scripts/mcp-server.mjs";
const smokeRoot = join(repoRoot, ".transparent-apprentice", "learning-workflow-smoke", String(Date.now()));

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
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
  let stderr = "";
  let stdoutBuffer = "";

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

async function callAdvancedLearningWorkflow() {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_learning_workflow",
      arguments: {
        goal:
          "Teach a digital office helper to triage refund tickets from policy evidence, ask only when boundary evidence is missing, and reproduce after approval.",
        domain: "office operations",
        futureInput: "A refund ticket mentions warranty exception text but no policy note.",
        outputDir: smokeRoot
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const direct = runNodeScript("create-learning-workflow.mjs", [
  "--goal",
  "Teach an apprentice to recover a failed CAD export using log deltas before screenshots.",
  "--domain",
  "CAD workalong",
  "--future-input",
  "A new export fails with an unknown rollback warning.",
  "--example",
  "Log shows export failed after rebuild warning and teacher confirms rollback step.",
  "--counterexample",
  "Log shows normal completed rebuild, so do not interrupt the teacher.",
  "--output-dir",
  smokeRoot
]);

const { list, result: mcpResult } = await callAdvancedLearningWorkflow();
const workflow = JSON.parse(readFileSync(mcpResult.workflowPath, "utf8"));
const directWorkflow = JSON.parse(readFileSync(direct.workflowPath, "utf8"));
const advancedNames = list.tools.map((tool) => tool.name);

function hasPhase(item, id) {
  return item.phases.some((phase) => phase.id === id);
}

const requiredPhases = [
  "rollback_checkpoint",
  "teacher_method_profile",
  "observe",
  "decompose",
  "causal_model",
  "boundaries_counterexamples",
  "practice_replay",
  "evaluation_gates",
  "approval_memory",
  "deployment_monitor"
];

const checks = [
  {
    name: "Script creates a durable learning workflow artifact",
    pass:
      direct.format === "transparent_ai_learning_workflow_result_v1" &&
      existsSync(direct.workflowPath) &&
      existsSync(direct.teacherReadme) &&
      directWorkflow.format === "transparent_ai_learning_workflow_v1",
    evidence: direct.workflowPath
  },
  {
    name: "MCP advanced tool exposes create_learning_workflow",
    pass:
      list.mode === "advanced" &&
      advancedNames.includes("create_learning_workflow") &&
      mcpResult.format === "transparent_ai_learning_workflow_result_v1",
    evidence: `mode=${list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Workflow contains the full closed learning loop",
    pass: requiredPhases.every((phase) => hasPhase(workflow, phase)),
    evidence: workflow.phases.map((phase) => phase.id).join(",")
  },
  {
    name: "Low-token observation avoids continuous recording",
    pass:
      workflow.lowTokenObservationPolicy?.strategy === "event_driven_low_token_observation" &&
      workflow.lowTokenObservationPolicy?.fullContinuousRecording === false &&
      workflow.lowTokenObservationPolicy?.observeCheapSignalsFirst?.includes("log tail delta") &&
      workflow.lowTokenObservationPolicy?.escalateToScreenshotOnlyWhen?.some((item) => item.includes("error")) &&
      workflow.lowTokenObservationPolicy?.askTeacherOnlyWhen?.some((item) => item.includes("boundary")),
    evidence: workflow.lowTokenObservationPolicy?.strategy
  },
  {
    name: "Workflow requires rollback points before hard-to-undo changes",
    pass:
      workflow.rollbackPolicy?.strategy === "periodic_teacher_confirmed_rollback_points" &&
      workflow.rollbackPolicy?.deleteOnlyAfterTeacherConfirmation === true &&
      workflow.rollbackPolicy?.recommendedTools?.includes("create_rollback_point") &&
      workflow.rollbackPolicy?.recommendedTools?.includes("confirm_rollback_point") &&
      workflow.phases?.some((phase) => phase.id === "rollback_checkpoint"),
    evidence: workflow.rollbackPolicy?.strategy
  },
  {
    name: "Anti-parrot checks require causal, counterexample, transfer, and failure evidence",
    pass:
      workflow.antiParrotChecks?.some((check) => check.id === "causal_explanation_required") &&
      workflow.antiParrotChecks?.some((check) => check.id === "counterexample_gate_required") &&
      workflow.antiParrotChecks?.some((check) => check.id === "transfer_reproduction_required") &&
      workflow.antiParrotChecks?.some((check) => check.id === "failure_recovery_required"),
    evidence: workflow.antiParrotChecks?.map((check) => check.id).join(",")
  },
  {
    name: "Mastery gates block memory until reproduction and teacher approval",
    pass:
      workflow.masteryGates?.requiresTeacherApproval === true &&
      workflow.masteryGates?.requiresReproduction === true &&
      workflow.masteryGates?.requiresFailureRecovery === true &&
      workflow.masteryGates?.minimumCounterexamples >= 1 &&
      workflow.masteryGates?.memorySaveBlockedUntil?.some((item) => item.includes("counterexample")),
    evidence: JSON.stringify(workflow.masteryGates)
  },
  {
    name: "Practice plan includes positive examples, counterexamples, and transfer tasks",
    pass:
      workflow.practicePlan?.positiveExamples?.length >= 2 &&
      workflow.practicePlan?.counterexamples?.length >= 2 &&
      workflow.practicePlan?.transferTasks?.length >= 2,
    evidence: `positive=${workflow.practicePlan?.positiveExamples?.length}; counter=${workflow.practicePlan?.counterexamples?.length}; transfer=${workflow.practicePlan?.transferTasks?.length}`
  },
  {
    name: "Workflow reuses existing teaching and correction tools",
    pass:
      workflow.nextMcpCalls?.some((call) => call.tool === "teach_apprentice") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "create_rollback_point") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "confirm_rollback_point") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "create_teacher_learning_method_profile") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "create_workalong_teaching_kit") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "create_all_software_observer_bootstrap") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "run_all_software_observer_supervisor") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "create_automatic_observer_schedule") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "create_software_observer_inventory") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "create_software_capability_profile") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "watch_log_source_metadata_deltas") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "monitor_software_observation_deltas") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "run_software_observer_watch_cycle") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "create_adaptive_software_observer_from_profile") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "create_universal_software_observer_kit") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "create_transparent_sketch_overlay_kit") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "interpret_transparent_sketch_spatial_intent") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "create_existing_software_execution_adapter") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "create_supervised_software_action_kit") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "verify_supervised_action_outcome") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "run_apprentice_profile") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "correct_last_result") &&
      workflow.nextMcpCalls?.some((call) => call.tool === "review_apprentice_profile"),
    evidence: workflow.nextMcpCalls?.map((call) => call.tool).join(",")
  },
  {
    name: "Workflow keeps review locks closed",
    pass:
      workflow.reviewLocks?.accepted === false &&
      workflow.reviewLocks?.ruleEnabled === false &&
      workflow.reviewLocks?.technologyAccepted === false &&
      workflow.reviewLocks?.packagingGated === true &&
      mcpResult.reviewLocks?.packagingGated === true,
    evidence: JSON.stringify(workflow.reviewLocks)
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_learning_workflow_smoke_v1",
  checks,
  directWorkflowPath: direct.workflowPath,
  mcpWorkflowPath: mcpResult.workflowPath,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
