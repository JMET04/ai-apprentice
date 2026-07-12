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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "engineering-command-target-confirmation-smoke", String(Date.now()));
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
  return JSON.parse(readFileSync(path, "utf8"));
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

async function callAdvancedTargetConfirmation(confirmationPath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "confirm_engineering_command_target",
      arguments: {
        confirmation: confirmationPath,
        selectedCandidateNumber: 2,
        createExecutionAdapter: true,
        preferredAdapter: "existing-windows-ui-automation",
        outputDir: join(smokeRoot, "mcp-confirm")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachApprenticeTargetConfirmation(reviewPacket) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        whatToTeach: "Confirm one numbered engineering software target after voice command review.",
        message: "确认 2 号目标，然后只把 2 号送进 dry-run 执行桥。",
        engineeringCommandTargetConfirmation: true,
        engineeringCommandReview: reviewPacket,
        selectedCandidateNumber: 2,
        createExecutionAdapter: true,
        preferredAdapter: "existing-windows-ui-automation",
        outputDir: join(smokeRoot, "default-confirm")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const directKit = runNodeScript("create-engineering-command-confirmation-kit.mjs", [
  "--goal",
  "Let a non-expert choose where to create a hole by voice.",
  "--software",
  "generic engineering software",
  "--window-title",
  "Engineering App",
  "--command",
  "Create a hole on the upper right face.",
  "--candidate",
  "face-upper-right|upper right face|0.78|0.24|0.2|voice command points to the upper right face",
  "--candidate",
  "feature-tree-hole|hole feature command|0.18|0.38|0|alternative feature tree command location",
  "--candidate",
  "canvas-center|model canvas center|0.52|0.48|0.1|fallback canvas target",
  "--output-dir",
  join(smokeRoot, "source-kit")
]);
const confirmed = runNodeScript("confirm-engineering-command-target.mjs", [
  "--confirmation",
  directKit.targetConfirmation,
  "--selected-number",
  "2",
  "--create-action-kit",
  "--create-execution-adapter",
  "--preferred-adapter",
  "existing-windows-ui-automation",
  "--output-dir",
  join(smokeRoot, "direct-confirm")
]);
const receipt = readJson(confirmed.receipt);
const narrowedOverlay = readJson(confirmed.narrowedOverlayPacket);
const actionManifest = readJson(confirmed.supervisedActionKit);
const actionPlan = readJson(actionManifest.files.actionPlan);
const bridgeRequest = readJson(confirmed.supervisedActionBridgeRequest);
const adapterRequest = readJson(confirmed.existingExecutionAdapterRequest);
const adapterSelection = readJson(confirmed.existingExecutionAdapterSelection);
const mcp = await callAdvancedTargetConfirmation(directKit.targetConfirmation);
const confirmationReviewPacket = {
  format: "transparent_ai_engineering_command_confirmation_review_v1",
  manifest: readJson(directKit.kitPath),
  commandIntent: readJson(directKit.commandIntent),
  targetConfirmation: {
    ...readJson(directKit.targetConfirmation),
    status: "teacher_selected_candidate_number",
    selectedCandidateNumber: 2
  },
  nextAllowedTool: "confirm_engineering_command_target",
  softwareActionsExecuted: false
};
const defaultRoute = await callDefaultTeachApprenticeTargetConfirmation(confirmationReviewPacket);
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Confirmed engineering command target narrows numbered candidates to one selected overlay",
    pass:
      confirmed.format === "transparent_ai_engineering_command_target_confirmation_result_v1" &&
      confirmed.selectedCandidateNumber === 2 &&
      confirmed.selectedTargetOnly === true &&
      confirmed.candidateCountBeforeConfirmation === 3 &&
      narrowedOverlay.overlayMode === "voice_text_confirmed_single_target" &&
      narrowedOverlay.anchors.length === 1 &&
      narrowedOverlay.strokes.length === 1 &&
      narrowedOverlay.anchors[0].number === 2 &&
      narrowedOverlay.strokes[0].targetAnchorId === "feature-tree-hole",
    evidence: confirmed.narrowedOverlayPacket
  },
  {
    name: "Confirmed target receipt keeps execution locked and records selected-only evidence",
    pass:
      receipt.format === "transparent_ai_engineering_command_target_confirmation_receipt_v1" &&
      receipt.status === "teacher_confirmed_single_target_ready_for_supervised_dry_run" &&
      receipt.voiceOrTextControlWorkflow === "transparent_ai_engineering_voice_or_text_control_workflow_v1" &&
      receipt.evidence.voiceOrTextControlWorkflowLoaded === true &&
      receipt.evidence.selectedTargetOnly === true &&
      receipt.locks.softwareActionsExecuted === false &&
      receipt.locks.nativeUniversalExecution === false &&
      receipt.locks.packagingGated === true,
    evidence: confirmed.receipt
  },
  {
    name: "Confirmed single target compiles into one supervised action instead of all candidates",
    pass:
      bridgeRequest.tool === "create_supervised_software_action_kit" &&
      bridgeRequest.selectedTargetOnly === true &&
      bridgeRequest.sourceVoiceOrTextControlWorkflow === "transparent_ai_engineering_voice_or_text_control_workflow_v1" &&
      bridgeRequest.sourceCommandIntent.interpretedOperation === "create_or_add" &&
      actionManifest.format === "transparent_ai_supervised_software_action_kit_v1" &&
      actionPlan.actions.length === 1 &&
      actionPlan.actions[0].sourceStrokeId === "confirmed-number-2-target-mark",
    evidence: confirmed.supervisedActionKit
  },
  {
    name: "Confirmed single target selects an existing execution adapter before any real software execution",
    pass:
      adapterRequest.tool === "create_existing_software_execution_adapter" &&
      adapterRequest.selectedTargetOnly === true &&
      adapterRequest.arguments.actionPlan === actionManifest.files.actionPlan &&
      adapterSelection.format === "transparent_ai_existing_software_execution_adapter_selection_v1" &&
      adapterSelection.recommendedRoute.primaryAdapterId === "existing-windows-ui-automation" &&
      adapterSelection.executionPackage.format === "transparent_ai_existing_software_execution_package_v1" &&
      adapterSelection.locks.noAutonomousExecution === true &&
      adapterSelection.locks.nativeUniversalExecution === false,
    evidence: confirmed.existingExecutionAdapterSelection
  },
  {
    name: "MCP advanced mode exposes and runs selected engineering target confirmation",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("confirm_engineering_command_target") &&
      mcp.result.format === "transparent_ai_engineering_command_target_confirmation_result_v1" &&
      mcp.result.selectedCandidateNumber === 2 &&
      mcp.result.narrowedOverlayAnchorCount === 1 &&
      mcp.result.existingExecutionAdapterSelection &&
      mcp.result.softwareActionsExecuted === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes confirmed number review to selected-target action bridge card",
    pass:
      defaultRoute.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultRoute.status === "waiting_for_confirmed_engineering_command_action_review" &&
      defaultRoute.engineeringCommandTargetConfirmation?.selectedCandidateNumber === 2 &&
      defaultRoute.engineeringCommandTargetConfirmation?.selectedTargetOnly === true &&
      defaultRoute.engineeringCommandTargetConfirmation?.nextBridge === "create_supervised_software_action_kit" &&
      defaultRoute.engineeringCommandTargetConfirmation?.nextExistingAdapterBridge === "create_existing_software_execution_adapter" &&
      defaultRoute.engineeringCommandTargetConfirmation?.existingExecutionAdapterSelection &&
      defaultRoute.engineeringCommandTargetConfirmation?.softwareActionsExecuted === false,
    evidence: `status=${defaultRoute.status}; selected=${defaultRoute.engineeringCommandTargetConfirmation?.selectedCandidateNumber ?? ""}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_engineering_command_target_confirmation_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
