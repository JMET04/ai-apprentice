#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "goal-command-center-trial")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "goal-command-center-trial";
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowerShellProbe(probePath, inventoryPath, limits) {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      probePath,
      "-OutputPath",
      inventoryPath,
      "-MaxProcesses",
      String(limits.maxProcesses),
      "-MaxInstalled",
      String(limits.maxInstalled),
      "-MaxLogFilesPerCandidate",
      String(limits.maxLogFilesPerCandidate)
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 180000
    }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "read-only software inventory probe failed");
  }
  return {
    stdoutBytes: Buffer.byteLength(result.stdout || "", "utf8"),
    stderrBytes: Buffer.byteLength(result.stderr || "", "utf8")
  };
}

const goal = argValue(
  "--goal",
  "Run a teacher-confirmed low-token trial from the goal command center without screenshots, software execution, or memory writes."
);
const software = argValue("--software", argValue("--app", "all local software"));
const command = argValue("--command", argValue("--text-command", ""));
const voiceTranscript = argValue("--voice-transcript", "");
const teacherStyle = argValue("--teacher-style", argValue("--teaching-style", "low-token logs, transparent sketch, and numbered confirmation"));
const commandCenterArg = argValue("--command-center", argValue("--center", ""));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "goal-command-center-trials")));
const teacherReviewed =
  hasFlag("--teacher-reviewed") || hasFlag("--teacher-confirmed") || hasFlag("--confirmed-by-teacher");
const noPortScan = hasFlag("--no-port-scan");
const maxProcesses = Number(argValue("--max-processes", "12"));
const maxInstalled = Number(argValue("--max-installed", "12"));
const maxCandidates = Number(argValue("--max-candidates", "6"));
const maxItems = Number(argValue("--max-items", String(maxCandidates)));
const maxLogFilesPerCandidate = Number(argValue("--max-log-files-per-candidate", "2"));
const maxLogsPerItem = Number(argValue("--max-logs-per-item", String(maxLogFilesPerCandidate)));
const maxTailLines = Number(argValue("--max-tail-lines", "24"));
const maxTailBytes = Number(argValue("--max-tail-bytes", "8192"));
const maxSnippetChars = Number(argValue("--max-snippet-chars", "220"));
const maxLearningItems = Number(argValue("--max-learning-items", "2"));
const candidates = argValues("--candidate");

mkdirSync(outputRoot, { recursive: true });
const trialId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(commandCenterArg ? basename(commandCenterArg) : `${software}-${goal}`)}`;
const trialDir = join(outputRoot, trialId);
mkdirSync(trialDir, { recursive: true });

let centerResult = null;
let centerPath = "";
if (commandCenterArg) {
  centerPath = resolve(commandCenterArg);
  if (!existsSync(centerPath)) throw new Error(`Command center does not exist: ${centerPath}`);
} else {
  const args = [
    "--goal",
    goal,
    "--software",
    software,
    "--teacher-style",
    teacherStyle,
    "--output-dir",
    join(trialDir, "command-center")
  ];
  if (command) args.push("--command", command);
  if (voiceTranscript) args.push("--voice-transcript", voiceTranscript);
  if (noPortScan) args.push("--no-port-scan");
  args.push("--max-processes", String(maxProcesses));
  args.push("--max-installed", String(maxInstalled));
  args.push("--max-candidates", String(maxCandidates));
  for (const candidate of candidates) args.push("--candidate", candidate);
  centerResult = runNodeScript("create-goal-command-center.mjs", args);
  centerPath = centerResult.centerPath;
}

const center = readJson(centerPath);

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequiredBeforeTrial: true,
  teacherConfirmationRequiredBeforeExecution: true,
  numberedTargetConfirmationRequired: true
};

const trialPath = join(trialDir, "goal-command-center-trial.json");
const receiptPath = join(trialDir, "goal-command-center-trial-receipt.json");
const readmePath = join(trialDir, "GOAL_COMMAND_CENTER_TRIAL_START_HERE.md");

function writeTrial({ status, trialRan, inventoryKit = null, inventoryPath = "", inventoryProbe = null, learningCycle = null }) {
  const trial = {
    format: "transparent_ai_goal_command_center_trial_v1",
    trialId,
    createdAt: new Date().toISOString(),
    status,
    goal: center.goal || goal,
    software: center.software || software,
    commandCenterPath: centerPath,
    teacherReviewed,
    trialRan,
    purpose:
      "Connect the goal command center to one bounded, read-only, metadata-first all-software low-token learning trial.",
    paths: {
      commandCenter: centerPath,
      inventoryKit: inventoryKit?.manifest ?? "",
      inventoryReadOnlyProbe: inventoryKit?.readOnlyProbe ?? "",
      inventory: inventoryPath,
      learningCycle: learningCycle?.learningCyclePath ?? "",
      learningReceipt: learningCycle?.receiptPath ?? "",
      teacherReadme: readmePath,
      receipt: receiptPath,
      trial: trialPath
    },
    counts: {
      inventorySoftwareCandidates: inventoryPath && existsSync(inventoryPath) ? (readJson(inventoryPath).softwareCandidates?.length ?? 0) : 0,
      learningMetadataGateRuns: learningCycle?.metadataGateRuns ?? 0,
      changedItems: learningCycle?.changedItems ?? 0,
      compactLearningEvents: learningCycle?.compactLearningEvents ?? 0,
      screenshotRequests: learningCycle?.screenshotRequests ?? 0
    },
    nextCalls: {
      blockedUntilReviewed: teacherReviewed
        ? null
        : {
            command: `node ${join(__dirname, "run-goal-command-center-trial.mjs")} --command-center "${centerPath}" --teacher-reviewed --output-dir "${outputRoot}"`
          },
      triggeredVisualCheck:
        learningCycle && (learningCycle.changedItems > 0 || learningCycle.compactLearningEvents > 0)
          ? {
              tool: "create_automatic_triggered_visual_check_queue",
              blockedUntil: "teacher reviews the compact learning-cycle receipt and agrees a visual check is worth the token cost"
            }
          : null,
      teacherReview:
        learningCycle?.receiptPath
          ? {
              tool: "teach_apprentice",
              arguments: {
                goal: "Review the command-center low-token trial receipt before any screenshot, action, or memory.",
                message: `Review this receipt only; do not accept, execute, or save memory yet: ${learningCycle.receiptPath}`
              }
            }
          : null
    },
    inventoryProbe,
    generatedCommandCenter: centerResult,
    learningCycle,
    blockedActions: [
      "run_trial_without_teacher_review",
      "capture_screenshot_during_trial",
      "execute_target_software_during_trial",
      "send_ui_events_during_trial",
      "write_memory_from_trial",
      "enable_rule_from_trial",
      "claim_native_universal_execution",
      "unlock_packaging"
    ],
    locks
  };

  const receipt = {
    format: "transparent_ai_goal_command_center_trial_receipt_v1",
    trialId,
    status,
    trialPath,
    commandCenterPath: centerPath,
    teacherReviewed,
    trialRan,
    defaultDecision: "needs_teacher_review",
    allowedDecisions: ["needs_teacher_review", "ready_for_follow_up", "blocked"],
    blockedDecisions: ["accepted", "execute_now", "enable_memory", "native_universal_execution", "unlock_packaging"],
    evidenceToReview: [
      centerPath,
      inventoryKit?.manifest ?? "",
      inventoryPath,
      learningCycle?.receiptPath ?? "",
      learningCycle?.learningCyclePath ?? ""
    ].filter(Boolean),
    locks
  };

  writeFileSync(trialPath, JSON.stringify(trial, null, 2), "utf8");
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
  writeFileSync(
    readmePath,
    [
      "# Goal Command Center Trial",
      "",
      `Status: ${status}`,
      `Command center: ${centerPath}`,
      `Trial receipt: ${receiptPath}`,
      "",
      "This trial is intentionally narrow:",
      "",
      "- It requires teacher review before running.",
      "- It runs only a read-only software inventory probe.",
      "- It sends the inventory to the metadata-first low-token learning cycle.",
      "- It does not capture screenshots, execute target software, send UI events, save memory, enable rules, or unlock packaging.",
      "",
      teacherReviewed
        ? "Next: review the receipt and learning cycle output, then decide whether a single triggered visual check is worth the token cost."
        : "Next: if the teacher approves this direction, rerun with `--teacher-reviewed`."
    ].join("\n") + "\n",
    "utf8"
  );
  return { trial, receipt };
}

if (!teacherReviewed) {
  const { trial } = writeTrial({
    status: "blocked_waiting_for_teacher_review",
    trialRan: false
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        format: "transparent_ai_goal_command_center_trial_result_v1",
        trialId,
        status: trial.status,
        trialRan: false,
        trialPath,
        receiptPath,
        teacherReadme: readmePath,
        commandCenterPath: centerPath,
        teacherConfirmationRequired: true,
        locks
      },
      null,
      2
    )
  );
  process.exit(0);
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  center.goal || goal,
  "--output-dir",
  join(trialDir, "inventory-kit"),
  "--max-processes",
  String(maxProcesses),
  "--max-installed",
  String(maxInstalled),
  "--max-log-files-per-candidate",
  String(maxLogFilesPerCandidate)
]);
const inventoryPath = join(trialDir, "software-observer-inventory.json");
const inventoryProbe = runPowerShellProbe(inventoryKit.readOnlyProbe, inventoryPath, {
  maxProcesses,
  maxInstalled,
  maxLogFilesPerCandidate
});
const learningCycle = runNodeScript("run-all-software-low-token-learning-cycle.mjs", [
  "--inventory",
  inventoryPath,
  "--output-dir",
  join(trialDir, "learning-cycle"),
  "--state-dir",
  join(trialDir, "watch-state"),
  "--metadata-state-dir",
  join(trialDir, "metadata-state"),
  "--max-items",
  String(maxItems),
  "--max-logs-per-item",
  String(maxLogsPerItem),
  "--max-tail-lines",
  String(maxTailLines),
  "--max-tail-bytes",
  String(maxTailBytes),
  "--max-snippet-chars",
  String(maxSnippetChars),
  "--max-learning-items",
  String(maxLearningItems),
  "--teacher-style",
  teacherStyle
]);
const status =
  learningCycle.compactLearningEvents > 0
    ? "trial_completed_compact_events_waiting_for_teacher_review"
    : "trial_completed_baseline_or_no_delta_waiting_for_next_trigger";
writeTrial({
  status,
  trialRan: true,
  inventoryKit,
  inventoryPath,
  inventoryProbe,
  learningCycle
});

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_goal_command_center_trial_result_v1",
      trialId,
      status,
      trialRan: true,
      trialPath,
      receiptPath,
      teacherReadme: readmePath,
      commandCenterPath: centerPath,
      inventoryPath,
      learningCyclePath: learningCycle.learningCyclePath,
      learningReceiptPath: learningCycle.receiptPath,
      compactLearningEvents: learningCycle.compactLearningEvents,
      changedItems: learningCycle.changedItems,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      memoryWritten: false,
      nativeUniversalExecution: false,
      locks
    },
    null,
    2
  )
);
