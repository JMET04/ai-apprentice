#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-objective-execution-bridge")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-objective-execution-bridge"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function latestJsonUnder(root, fileName) {
  if (!existsSync(root)) return "";
  const entries = [];
  for (const name of readdirSync(root, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const candidate = join(root, name.name, fileName);
    if (existsSync(candidate)) entries.push(candidate);
  }
  entries.sort().reverse();
  return entries[0] || "";
}

function resolveQueuePath(input) {
  if (input && existsSync(input)) return resolve(input);
  const latest = latestJsonUnder(
    join(process.cwd(), ".transparent-apprentice", "original-goal-objective-fulfillment-next-step-queues"),
    "original-goal-objective-fulfillment-next-step-queue.json"
  );
  if (latest) return latest;
  throw new Error("--queue is required when no latest objective fulfillment next-step queue exists");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function command(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replaceAll('"', '\\"')}"`);
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    bridgeDoesNotRunCommands: true,
    bridgeDoesNotRegisterTask: true,
    bridgeDoesNotLaunchRunner: true,
    bridgeDoesNotExecuteTargetSoftware: true,
    bridgeDoesNotSendUiEvents: true,
    bridgeDoesNotCaptureScreenshots: true,
    bridgeDoesNotReadLogs: true,
    bridgeDoesNotWriteMemory: true,
    bridgeDoesNotEnableRules: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function findExecutionItem(queue) {
  return (Array.isArray(queue.queueItems) ? queue.queueItems : []).find(
    (item) => item.requirementId === "execute_in_target_software_after_confirmation"
  );
}

function buildBridge(queue, queuePath) {
  if (queue.format !== "transparent_ai_original_goal_objective_fulfillment_next_step_queue_v1") {
    throw new Error("--queue must be transparent_ai_original_goal_objective_fulfillment_next_step_queue_v1");
  }
  const item = findExecutionItem(queue);
  if (!item) throw new Error("Queue is missing execute_in_target_software_after_confirmation item");
  const blockerEvidence = Array.isArray(item.missingBeforeCompletion) ? item.missingBeforeCompletion : [];
  const sharedMissing = [
    "teacher selected exactly one numbered target",
    "teacher approved one execution gate",
    "retained rollback point exists for this exact run",
    "adapter/control-channel evidence is reviewed",
    "post-action evidence review receipt is planned"
  ];
  return {
    sourceQueuePath: queuePath,
    executionObjective: item,
    status: "execution_bridge_ready_for_teacher_review",
    bridgeDoesNotSatisfyExecution: true,
    completionAllowed: false,
    recommendedRouteOrder: [
      {
        routeId: "existing_real_case_controlled_execution_chain",
        whenToUse: "Use when the teacher has a real case artifact or software action intent that must travel through rule/validation/delivery gates first.",
        startCommand: command("create-real-case-pilot-intake.mjs", [
          ["--goal", "<teacher-described-real-case-execution-intent>"],
          ["--target-software", "<target-software-name>"],
          ["--rollback-evidence", "<retained-rollback-point>"]
        ]),
        downstreamEvidence:
          "real-case delivery gate -> active execution gate receipt -> controlled execution dry-run -> adapter-specific runner approval -> separate real runner -> outcome review",
        missingBeforeUse: [
          "real case intake artifacts",
          "teacher-reviewed logic constraints",
          "reviewed delivery gate evidence",
          ...sharedMissing
        ]
      },
      {
        routeId: "existing_all_software_execution_approval_gate_prep_runner",
        whenToUse: "Use when a dry-run handoff item validation already says ready_for_execution_approval_gate_planning.",
        startCommand: command("run-all-software-execution-approval-gate-prep-runner.mjs", [
          ["--validation", "<teacher-reviewed-dry-run-handoff-item-validation.json>"],
          ["--selector", "<real-local-execution-pilot-selector.json>"],
          ["--queue", "<execution-pilot-queue.json>"],
          ["--selected-pilot-id", "<pilot-id>"],
          ["--adapter-id", "<adapter-id>"],
          ["--teacher-confirmation", "teacher confirmed all-software execution pilot"]
        ]),
        downstreamEvidence:
          "real-local execution approval gate -> approved gate command builder -> supervised approved gate runner -> outcome review",
        missingBeforeUse: [
          "validated dry-run handoff item",
          "real-local selector and pilot queue",
          "reviewed adapter route evidence",
          ...sharedMissing
        ]
      },
      {
        routeId: "existing_real_local_execution_approval_gate",
        whenToUse: "Use only when the teacher has already selected a numbered candidate and provided reviewed route evidence.",
        startCommand: command("create-real-local-execution-approval-gate.mjs", [
          ["--selector", "<real-local-execution-pilot-selector.json>"],
          ["--selected-number", "<teacher-selected-number>"],
          ["--reviewed-command", "<reviewed-command-manifest-or-adapter-evidence.json>"],
          ["--teacher-confirmation", "teacher confirmed all-software execution pilot"]
        ]),
        downstreamEvidence:
          "approval gate packet with readyForExecuteRequest=true; still requires separate runner command and outcome review",
        missingBeforeUse: ["selector", "teacher-selected number", "reviewed command/API/file/browser evidence", ...sharedMissing]
      }
    ],
    missingBeforeCompletion: [...new Set([...blockerEvidence, ...sharedMissing])],
    blockedActions: [
      "execute_target_software_from_objective_bridge",
      "register_task_from_objective_bridge",
      "launch_runner_from_objective_bridge",
      "send_ui_events_from_objective_bridge",
      "capture_screenshot_from_objective_bridge",
      "read_logs_from_objective_bridge",
      "write_memory_from_objective_bridge",
      "enable_rule_from_objective_bridge",
      "claim_goal_complete_from_objective_bridge"
    ],
    locks: locks()
  };
}

function writeReadme(path, packet) {
  const lines = [
    "# Original Goal Objective Execution Bridge",
    "",
    `Status: ${packet.status}`,
    `Source queue: ${packet.sourceQueuePath}`,
    "",
    "This bridge maps the original objective execution lane to existing controlled execution gates.",
    "It is not an execution runner and does not prove software execution.",
    "",
    "Recommended route order:"
  ];
  for (const route of packet.recommendedRouteOrder) {
    lines.push("", `## ${route.routeId}`, route.whenToUse, "", "Command template:", route.startCommand, "", "Missing before use:");
    for (const missing of route.missingBeforeUse) lines.push(`- ${missing}`);
  }
  lines.push("", "Still missing before objective completion:");
  for (const missing of packet.missingBeforeCompletion) lines.push(`- ${missing}`);
  lines.push(
    "",
    "Locked boundary: this bridge does not run commands, register tasks, launch runners, execute target software, send UI events, capture screenshots, read logs, write memory, enable rules, unlock packaging, or claim completion."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  const routes = packet.recommendedRouteOrder
    .map(
      (route) => `<section class="panel">
  <h2>${htmlEscape(route.routeId)}</h2>
  <p>${htmlEscape(route.whenToUse)}</p>
  <p><strong>Downstream evidence:</strong> ${htmlEscape(route.downstreamEvidence)}</p>
  <pre>${htmlEscape(route.startCommand)}</pre>
  <ul>${route.missingBeforeUse.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
</section>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Original Goal Objective Execution Bridge</title>
  <style>
    body { margin: 0; font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f8fafc; }
    main { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .panel { background: white; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; margin: 12px 0; }
    pre { white-space: pre-wrap; background: #eef2f7; border-radius: 6px; padding: 10px; }
    a { color: #174d89; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Objective Execution Bridge</h1>
  <p>Status: <code>${htmlEscape(packet.status)}</code></p>
  <p>Source queue: <a href="${htmlEscape(fileHref(packet.sourceQueuePath))}">${htmlEscape(basename(packet.sourceQueuePath))}</a></p>
  <p>This bridge chooses existing controlled execution routes. It does not execute software or complete the goal.</p>
  ${routes}
</main>
</body>
</html>`,
    "utf8"
  );
}

const queuePath = resolveQueuePath(argValue("--queue", argValue("--queue-path", "")));
const queue = readJson(queuePath);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-objective-execution-bridges"))
);
const bridgeId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(queue.queueId || "objective-execution-bridge")}`;
const bridgeDir = join(outputRoot, bridgeId);
mkdirSync(bridgeDir, { recursive: true });

const packet = {
  ok: true,
  format: "transparent_ai_original_goal_objective_execution_bridge_v1",
  bridgeId,
  ...buildBridge(queue, queuePath),
  paths: {}
};
packet.paths.bridge = join(bridgeDir, "original-goal-objective-execution-bridge.json");
packet.paths.html = join(bridgeDir, "original-goal-objective-execution-bridge.html");
packet.paths.readme = join(bridgeDir, "ORIGINAL_GOAL_OBJECTIVE_EXECUTION_BRIDGE_START_HERE.md");

writeReadme(packet.paths.readme, packet);
writeHtml(packet.paths.html, packet);
writeFileSync(packet.paths.bridge, `${JSON.stringify(packet, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_objective_execution_bridge_result_v1",
      bridgePath: packet.paths.bridge,
      htmlPath: packet.paths.html,
      readmePath: packet.paths.readme,
      status: packet.status,
      routes: packet.recommendedRouteOrder.length,
      completionAllowed: packet.completionAllowed
    },
    null,
    2
  )
);
