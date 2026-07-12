#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const serverScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const smokeRoot = join(repoRoot, ".ta-smoke", "mcp-original-goal-objective-fulfillment-route", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function startServer() {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: process.env,
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
  return { rpc, stop, get stderr() { return stderr; } };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

async function callTeach(server, args) {
  const result = await server.rpc("tools/call", { name: "teach_apprentice", arguments: args });
  return JSON.parse(result.content[0].text);
}

const refreshResult = runNodeScript("create-original-goal-current-status-refresh.mjs", [
  "--goal",
  "Refresh original goal current status before objective fulfillment MCP route smoke.",
  "--software",
  "ExampleCAD",
  "--command",
  "Confirm one numbered target before execution.",
  "--scan-root",
  smokeRoot,
  "--output-dir",
  join(smokeRoot, "refresh")
]);

const server = startServer();
let auditResult;
let builderResult;
let validationResult;
let commandBuilderResult;
let queueResult;
let lowTokenMonitorCommandBridgeResult;
let lowTokenMonitorBridgeReceiptBuilderResult;
let lowTokenMonitorBridgeReceiptValidationResult;
let lowTokenMonitorSelectedRouteCommandBuilderResult;
let executionBridgeResult;
let executionBridgeReceiptBuilderResult;
let executionBridgeReceiptValidationResult;
let executionSelectedRouteCommandBuilderResult;
try {
  await server.rpc("initialize", {});
  server.rpc("notifications/initialized", {}).catch(() => {});

  auditResult = await callTeach(server, {
    whatToTeach: "Run objective fulfillment audit for the full original goal.",
    createOriginalGoalObjectiveFulfillmentAudit: true,
    statusRefresh: refreshResult.refreshPath,
    outputDir: join(smokeRoot, "audit")
  });

  builderResult = await callTeach(server, {
    whatToTeach: "Create teacher receipt builder for objective fulfillment audit.",
    createOriginalGoalObjectiveFulfillmentReceiptBuilder: true,
    objectiveAudit: auditResult.originalGoalObjectiveFulfillmentAudit.auditPath,
    outputDir: join(smokeRoot, "receipt-builder")
  });

  const template = readJson(builderResult.originalGoalObjectiveFulfillmentReceiptBuilder.receiptTemplatePath);
  const receiptPath = writeJson(join(smokeRoot, "teacher-selected-objective-lane-receipt.json"), {
    ...template,
    rowDecisions: template.rowDecisions.map((row) => ({
      ...row,
      teacherDecision:
        row.id === "transparent_mask_2d_perspective_3d_depth_understanding"
          ? "teacher_selects_next_lane"
          : "teacher_confirms_audit_status",
      auditRowReviewed: true,
      teacherNote:
        row.id === "transparent_mask_2d_perspective_3d_depth_understanding"
          ? "MCP smoke selects transparent sketch depth review as the next lane."
          : "MCP smoke confirms this audit row for routing only."
    }))
  });

  validationResult = await callTeach(server, {
    whatToTeach: "Validate teacher-filled objective fulfillment receipt.",
    validateOriginalGoalObjectiveFulfillmentReceipt: true,
    objectiveAudit: auditResult.originalGoalObjectiveFulfillmentAudit.auditPath,
    objectiveReceipt: receiptPath,
    outputDir: join(smokeRoot, "receipt-validation")
  });

  commandBuilderResult = await callTeach(server, {
    whatToTeach: "Create objective next-lane command builder from validated teacher-selected lane.",
    createOriginalGoalObjectiveNextLaneCommandBuilder: true,
    objectiveValidation: validationResult.originalGoalObjectiveFulfillmentReceiptValidation.validationPath,
    outputDir: join(smokeRoot, "next-lane-command-builder")
  });

  queueResult = runNodeScript("create-original-goal-objective-fulfillment-next-step-queue.mjs", [
    "--audit",
    auditResult.originalGoalObjectiveFulfillmentAudit.auditPath,
    "--output-dir",
    join(smokeRoot, "objective-next-step-queue")
  ]);

  lowTokenMonitorCommandBridgeResult = await callTeach(server, {
    whatToTeach: "Bridge original all-software low-token learning lane to recurring monitor gates.",
    createOriginalGoalLowTokenMonitorCommandBridge: true,
    objectiveQueue: queueResult.queuePath,
    outputDir: join(smokeRoot, "low-token-monitor-command-bridge")
  });

  lowTokenMonitorBridgeReceiptBuilderResult = await callTeach(server, {
    whatToTeach: "Create teacher route-selection receipt for low-token monitor bridge.",
    createOriginalGoalLowTokenMonitorBridgeReceiptBuilder: true,
    lowTokenMonitorBridgePath: lowTokenMonitorCommandBridgeResult.originalGoalLowTokenMonitorCommandBridge.bridgePath,
    outputDir: join(smokeRoot, "low-token-monitor-bridge-receipt-builder")
  });

  const lowTokenRouteTemplate = readJson(
    lowTokenMonitorBridgeReceiptBuilderResult.originalGoalLowTokenMonitorBridgeReceiptBuilder.receiptTemplatePath
  );
  const lowTokenRouteReceiptPath = writeJson(join(smokeRoot, "teacher-selected-low-token-monitor-route-receipt.json"), {
    ...lowTokenRouteTemplate,
    teacherDecision: "teacher_selects_route",
    selectedRouteId: "existing_recurring_monitor_teacher_confirmation",
    routeReviewed: true,
    retainedRollbackPoint: "rollback-point-for-low-token-monitor-mcp-smoke",
    readinessPackagePath: "real-local-all-software-low-token-readiness-package.json",
    teacherNotes: "MCP smoke selects recurring monitor teacher confirmation as the next low-token route."
  });

  lowTokenMonitorBridgeReceiptValidationResult = await callTeach(server, {
    whatToTeach: "Validate teacher selected low-token monitor bridge route receipt.",
    validateOriginalGoalLowTokenMonitorBridgeReceipt: true,
    lowTokenMonitorBridgePath: lowTokenMonitorCommandBridgeResult.originalGoalLowTokenMonitorCommandBridge.bridgePath,
    lowTokenMonitorBridgeReceipt: lowTokenRouteReceiptPath,
    outputDir: join(smokeRoot, "low-token-monitor-bridge-receipt-validation")
  });

  lowTokenMonitorSelectedRouteCommandBuilderResult = await callTeach(server, {
    whatToTeach: "Create selected low-token monitor route command builder from validated teacher route receipt.",
    createOriginalGoalLowTokenMonitorSelectedRouteCommandBuilder: true,
    lowTokenMonitorBridgeReceiptValidationPath:
      lowTokenMonitorBridgeReceiptValidationResult.originalGoalLowTokenMonitorBridgeReceiptValidation.validationPath,
    outputDir: join(smokeRoot, "low-token-monitor-selected-route-command-builder")
  });

  executionBridgeResult = await callTeach(server, {
    whatToTeach: "Bridge original execution objective lane to existing controlled execution gates.",
    createOriginalGoalObjectiveExecutionBridge: true,
    objectiveQueue: queueResult.queuePath,
    outputDir: join(smokeRoot, "execution-bridge")
  });

  executionBridgeReceiptBuilderResult = await callTeach(server, {
    whatToTeach: "Create teacher route-selection receipt for objective execution bridge.",
    createOriginalGoalObjectiveExecutionBridgeReceiptBuilder: true,
    objectiveExecutionBridgePath: executionBridgeResult.originalGoalObjectiveExecutionBridge.bridgePath,
    outputDir: join(smokeRoot, "execution-bridge-receipt-builder")
  });

  const routeTemplate = readJson(
    executionBridgeReceiptBuilderResult.originalGoalObjectiveExecutionBridgeReceiptBuilder.receiptTemplatePath
  );
  const routeReceiptPath = writeJson(join(smokeRoot, "teacher-selected-execution-route-receipt.json"), {
    ...routeTemplate,
    teacherDecision: "teacher_selects_route",
    selectedRouteId: "existing_all_software_execution_approval_gate_prep_runner",
    routeReviewed: true,
    teacherSelectedNumberedTarget: "candidate-1",
    retainedRollbackPoint: "rollback-point-for-mcp-smoke",
    adapterEvidencePath: "reviewed-adapter-evidence.json",
    postActionEvidencePlan: "review separate-runner outcome receipt",
    teacherNotes: "MCP smoke chooses existing all-software prep route."
  });

  executionBridgeReceiptValidationResult = await callTeach(server, {
    whatToTeach: "Validate teacher selected execution bridge route receipt.",
    validateOriginalGoalObjectiveExecutionBridgeReceipt: true,
    objectiveExecutionBridgePath: executionBridgeResult.originalGoalObjectiveExecutionBridge.bridgePath,
    objectiveExecutionBridgeReceipt: routeReceiptPath,
    outputDir: join(smokeRoot, "execution-bridge-receipt-validation")
  });

  executionSelectedRouteCommandBuilderResult = await callTeach(server, {
    whatToTeach: "Create selected route command builder from validated execution bridge route.",
    createOriginalGoalObjectiveExecutionSelectedRouteCommandBuilder: true,
    objectiveExecutionBridgeReceiptValidationPath:
      executionBridgeReceiptValidationResult.originalGoalObjectiveExecutionBridgeReceiptValidation.validationPath,
    outputDir: join(smokeRoot, "execution-selected-route-command-builder")
  });
} finally {
  await server.stop();
}

const checks = [
  {
    name: "MCP teach_apprentice can create objective fulfillment audit",
    pass:
      auditResult?.format === "transparent_ai_teach_apprentice_card_v1" &&
      auditResult?.advancedDetails?.route === "create_original_goal_objective_fulfillment_audit" &&
      existsSync(auditResult?.originalGoalObjectiveFulfillmentAudit?.auditPath || "") &&
      auditResult?.originalGoalObjectiveFulfillmentAudit?.completionAllowed === false &&
      auditResult?.originalGoalObjectiveFulfillmentAudit?.auditDoesNotExecuteTargetSoftware === true,
    evidence: auditResult?.originalGoalObjectiveFulfillmentAudit
  },
  {
    name: "MCP teach_apprentice can create objective fulfillment teacher receipt builder",
    pass:
      builderResult?.advancedDetails?.route === "create_original_goal_objective_fulfillment_receipt_builder" &&
      existsSync(builderResult?.originalGoalObjectiveFulfillmentReceiptBuilder?.receiptTemplatePath || "") &&
      builderResult?.originalGoalObjectiveFulfillmentReceiptBuilder?.builderDoesNotRunCommands === true &&
      builderResult?.originalGoalObjectiveFulfillmentReceiptBuilder?.builderDoesNotWriteMemory === true,
    evidence: builderResult?.originalGoalObjectiveFulfillmentReceiptBuilder
  },
  {
    name: "MCP teach_apprentice can validate objective fulfillment receipt into one next lane",
    pass:
      validationResult?.advancedDetails?.route === "validate_original_goal_objective_fulfillment_receipt" &&
      validationResult?.originalGoalObjectiveFulfillmentReceiptValidation?.nextLaneCount === 1 &&
      validationResult?.originalGoalObjectiveFulfillmentReceiptValidation?.validationDoesNotRunCommands === true &&
      validationResult?.originalGoalObjectiveFulfillmentReceiptValidation?.validationDoesNotExecuteTargetSoftware === true,
    evidence: validationResult?.originalGoalObjectiveFulfillmentReceiptValidation
  },
  {
    name: "MCP teach_apprentice can build safe command page for selected objective lane",
    pass:
      commandBuilderResult?.advancedDetails?.route === "create_original_goal_objective_next_lane_command_builder" &&
      commandBuilderResult?.originalGoalObjectiveNextLaneCommandBuilder?.routeKind === "transparent_sketch_depth_review" &&
      existsSync(commandBuilderResult?.originalGoalObjectiveNextLaneCommandBuilder?.builderPath || "") &&
      commandBuilderResult?.originalGoalObjectiveNextLaneCommandBuilder?.builderDoesNotRunCommands === true &&
      commandBuilderResult?.originalGoalObjectiveNextLaneCommandBuilder?.builderDoesNotExecuteTargetSoftware === true &&
      commandBuilderResult?.originalGoalObjectiveNextLaneCommandBuilder?.goalComplete === false,
    evidence: commandBuilderResult?.originalGoalObjectiveNextLaneCommandBuilder
  },
  {
    name: "MCP teach_apprentice can bridge original all-software low-token lane to existing recurring monitor gates",
    pass:
      lowTokenMonitorCommandBridgeResult?.advancedDetails?.route ===
        "create_original_goal_low_token_monitor_command_bridge" &&
      existsSync(lowTokenMonitorCommandBridgeResult?.originalGoalLowTokenMonitorCommandBridge?.bridgePath || "") &&
      lowTokenMonitorCommandBridgeResult?.originalGoalLowTokenMonitorCommandBridge?.completionAllowed === false &&
      lowTokenMonitorCommandBridgeResult?.originalGoalLowTokenMonitorCommandBridge?.bridgeDoesNotRunCommands === true &&
      lowTokenMonitorCommandBridgeResult?.originalGoalLowTokenMonitorCommandBridge?.bridgeDoesNotRegisterTask === true &&
      lowTokenMonitorCommandBridgeResult?.originalGoalLowTokenMonitorCommandBridge?.bridgeDoesNotReadFullLogs === true &&
      lowTokenMonitorCommandBridgeResult?.originalGoalLowTokenMonitorCommandBridge?.bridgeDoesNotWriteMemory === true &&
      lowTokenMonitorCommandBridgeResult?.originalGoalLowTokenMonitorCommandBridge?.goalComplete === false,
    evidence: lowTokenMonitorCommandBridgeResult?.originalGoalLowTokenMonitorCommandBridge
  },
  {
    name: "MCP teach_apprentice can create low-token monitor bridge receipt builder",
    pass:
      lowTokenMonitorBridgeReceiptBuilderResult?.advancedDetails?.route ===
        "create_original_goal_low_token_monitor_bridge_receipt_builder" &&
      existsSync(lowTokenMonitorBridgeReceiptBuilderResult?.originalGoalLowTokenMonitorBridgeReceiptBuilder?.receiptTemplatePath || "") &&
      lowTokenMonitorBridgeReceiptBuilderResult?.originalGoalLowTokenMonitorBridgeReceiptBuilder?.routeCount === 5 &&
      lowTokenMonitorBridgeReceiptBuilderResult?.originalGoalLowTokenMonitorBridgeReceiptBuilder?.builderDoesNotRunCommands === true &&
      lowTokenMonitorBridgeReceiptBuilderResult?.originalGoalLowTokenMonitorBridgeReceiptBuilder?.builderDoesNotRegisterTask === true &&
      lowTokenMonitorBridgeReceiptBuilderResult?.originalGoalLowTokenMonitorBridgeReceiptBuilder?.builderDoesNotReadFullLogs === true,
    evidence: lowTokenMonitorBridgeReceiptBuilderResult?.originalGoalLowTokenMonitorBridgeReceiptBuilder
  },
  {
    name: "MCP teach_apprentice can validate selected low-token monitor bridge route",
    pass:
      lowTokenMonitorBridgeReceiptValidationResult?.advancedDetails?.route ===
        "validate_original_goal_low_token_monitor_bridge_receipt" &&
      lowTokenMonitorBridgeReceiptValidationResult?.originalGoalLowTokenMonitorBridgeReceiptValidation?.routeReadyForLaterGate ===
        true &&
      lowTokenMonitorBridgeReceiptValidationResult?.originalGoalLowTokenMonitorBridgeReceiptValidation?.selectedRouteId ===
        "existing_recurring_monitor_teacher_confirmation" &&
      lowTokenMonitorBridgeReceiptValidationResult?.originalGoalLowTokenMonitorBridgeReceiptValidation?.validationDoesNotRegisterTask === true &&
      lowTokenMonitorBridgeReceiptValidationResult?.originalGoalLowTokenMonitorBridgeReceiptValidation?.validationDoesNotReadFullLogs === true &&
      lowTokenMonitorBridgeReceiptValidationResult?.originalGoalLowTokenMonitorBridgeReceiptValidation?.goalComplete === false,
    evidence: lowTokenMonitorBridgeReceiptValidationResult?.originalGoalLowTokenMonitorBridgeReceiptValidation
  },
  {
    name: "MCP teach_apprentice can create selected low-token monitor route command builder",
    pass:
      lowTokenMonitorSelectedRouteCommandBuilderResult?.advancedDetails?.route ===
        "create_original_goal_low_token_monitor_selected_route_command_builder" &&
      existsSync(
        lowTokenMonitorSelectedRouteCommandBuilderResult?.originalGoalLowTokenMonitorSelectedRouteCommandBuilder
          ?.builderPath || ""
      ) &&
      lowTokenMonitorSelectedRouteCommandBuilderResult?.originalGoalLowTokenMonitorSelectedRouteCommandBuilder
        ?.selectedRouteId === "existing_recurring_monitor_teacher_confirmation" &&
      lowTokenMonitorSelectedRouteCommandBuilderResult?.originalGoalLowTokenMonitorSelectedRouteCommandBuilder?.nextGate ===
        "create_all_software_recurring_monitor_teacher_confirmation_package" &&
      lowTokenMonitorSelectedRouteCommandBuilderResult?.originalGoalLowTokenMonitorSelectedRouteCommandBuilder
        ?.builderDoesNotRegisterTask === true &&
      lowTokenMonitorSelectedRouteCommandBuilderResult?.originalGoalLowTokenMonitorSelectedRouteCommandBuilder
        ?.builderDoesNotReadFullLogs === true &&
      lowTokenMonitorSelectedRouteCommandBuilderResult?.originalGoalLowTokenMonitorSelectedRouteCommandBuilder
        ?.goalComplete === false,
    evidence: lowTokenMonitorSelectedRouteCommandBuilderResult?.originalGoalLowTokenMonitorSelectedRouteCommandBuilder
  },
  {
    name: "MCP teach_apprentice can bridge original execution lane to existing controlled gates",
    pass:
      executionBridgeResult?.advancedDetails?.route === "create_original_goal_objective_execution_bridge" &&
      existsSync(executionBridgeResult?.originalGoalObjectiveExecutionBridge?.bridgePath || "") &&
      executionBridgeResult?.originalGoalObjectiveExecutionBridge?.completionAllowed === false &&
      executionBridgeResult?.originalGoalObjectiveExecutionBridge?.bridgeDoesNotRunCommands === true &&
      executionBridgeResult?.originalGoalObjectiveExecutionBridge?.bridgeDoesNotExecuteTargetSoftware === true &&
      executionBridgeResult?.originalGoalObjectiveExecutionBridge?.goalComplete === false,
    evidence: executionBridgeResult?.originalGoalObjectiveExecutionBridge
  },
  {
    name: "MCP teach_apprentice can create objective execution bridge receipt builder",
    pass:
      executionBridgeReceiptBuilderResult?.advancedDetails?.route ===
        "create_original_goal_objective_execution_bridge_receipt_builder" &&
      existsSync(
        executionBridgeReceiptBuilderResult?.originalGoalObjectiveExecutionBridgeReceiptBuilder?.receiptTemplatePath || ""
      ) &&
      executionBridgeReceiptBuilderResult?.originalGoalObjectiveExecutionBridgeReceiptBuilder?.routeCount === 3 &&
      executionBridgeReceiptBuilderResult?.originalGoalObjectiveExecutionBridgeReceiptBuilder?.builderDoesNotRunCommands === true &&
      executionBridgeReceiptBuilderResult?.originalGoalObjectiveExecutionBridgeReceiptBuilder
        ?.builderDoesNotExecuteTargetSoftware === true,
    evidence: executionBridgeReceiptBuilderResult?.originalGoalObjectiveExecutionBridgeReceiptBuilder
  },
  {
    name: "MCP teach_apprentice can validate selected objective execution bridge route",
    pass:
      executionBridgeReceiptValidationResult?.advancedDetails?.route ===
        "validate_original_goal_objective_execution_bridge_receipt" &&
      executionBridgeReceiptValidationResult?.originalGoalObjectiveExecutionBridgeReceiptValidation?.routeReadyForLaterGate ===
        true &&
      executionBridgeReceiptValidationResult?.originalGoalObjectiveExecutionBridgeReceiptValidation?.selectedRouteId ===
        "existing_all_software_execution_approval_gate_prep_runner" &&
      executionBridgeReceiptValidationResult?.originalGoalObjectiveExecutionBridgeReceiptValidation
        ?.validationDoesNotExecuteTargetSoftware === true &&
      executionBridgeReceiptValidationResult?.originalGoalObjectiveExecutionBridgeReceiptValidation?.goalComplete === false,
    evidence: executionBridgeReceiptValidationResult?.originalGoalObjectiveExecutionBridgeReceiptValidation
  },
  {
    name: "MCP teach_apprentice can create selected execution route command builder",
    pass:
      executionSelectedRouteCommandBuilderResult?.advancedDetails?.route ===
        "create_original_goal_objective_execution_selected_route_command_builder" &&
      executionSelectedRouteCommandBuilderResult?.originalGoalObjectiveExecutionSelectedRouteCommandBuilder
        ?.selectedRouteId === "existing_all_software_execution_approval_gate_prep_runner" &&
      executionSelectedRouteCommandBuilderResult?.originalGoalObjectiveExecutionSelectedRouteCommandBuilder?.nextGate ===
        "run_all_software_execution_approval_gate_prep_runner" &&
      executionSelectedRouteCommandBuilderResult?.originalGoalObjectiveExecutionSelectedRouteCommandBuilder?.executeNow ===
        false &&
      executionSelectedRouteCommandBuilderResult?.originalGoalObjectiveExecutionSelectedRouteCommandBuilder
        ?.builderDoesNotExecuteTargetSoftware === true,
    evidence: executionSelectedRouteCommandBuilderResult?.originalGoalObjectiveExecutionSelectedRouteCommandBuilder
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_objective_fulfillment_mcp_route_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
