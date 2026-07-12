#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function newestFile(root, fileName) {
  if (!existsSync(root)) return "";
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(root);
  return found.sort((a, b) => b.time - a.time)[0]?.path || "";
}

function slugify(value) {
  return (
    String(value || "operational-final-review-pack")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84) || "operational-final-review-pack"
  );
}

function q(value) {
  const text = String(value ?? "");
  return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function commandLine(scriptName, args = []) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map(q)
    .join(" ");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function laneStatus(consolePacket, id) {
  return (Array.isArray(consolePacket?.lanes) ? consolePacket.lanes : []).find((lane) => lane.id === id) || null;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packDoesNotRegisterTask: true,
    packDoesNotStartTask: true,
    packDoesNotLaunchRunner: true,
    packDoesNotReadLogs: true,
    packDoesNotReadFullLogs: true,
    packDoesNotCaptureScreenshots: true,
    packDoesNotExecuteTargetSoftware: true,
    packDoesNotWriteMemory: true,
    fullContinuousRecording: false,
    scheduledTaskRegistered: false,
    scheduledTaskStarted: false,
    runnerLaunched: false,
    logContentsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    longTermMemoryWritten: false,
    unattendedAllAppMonitoringComplete: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, pack) {
  const lines = [
    "# Operational Final Review Pack",
    "",
    `Status: ${pack.status}`,
    `Unattended monitoring complete: ${pack.operationalSummary.unattendedAllAppMonitoringComplete}`,
    `Reviewed runs: ${pack.operationalSummary.reviewedRunCount}`,
    `Compact learning events: ${pack.operationalSummary.compactLearningEvents}`,
    `Remaining audit gaps: ${pack.operationalSummary.remainingGapCount}`,
    "",
    "This pack summarizes the operational evidence for unattended all-software low-token learning.",
    "It is review-only. It does not register scheduled tasks, start tasks, launch runners, read logs, capture screenshots, execute target software, write memory, enable rules, or claim completion.",
    "",
    "Start here:",
    "",
    `1. Open the latest operational status console: ${pack.sourceEvidence.statusConsoleReadme || pack.sourceEvidence.statusConsole}`,
    `2. Open the unattended audit: ${pack.sourceEvidence.unattendedAuditReadme || pack.sourceEvidence.unattendedAudit}`,
    "3. Resolve approval gate, registration runner, scheduled-task registration, and teacher replay gaps.",
    "4. Re-run the unattended audit and final completion gate only after real teacher confirmation and observed registered-run evidence.",
    "",
    "Next commands:",
    ""
  ];
  for (const command of pack.nextReviewCommands) {
    lines.push(`## ${command.id}`, "", command.purpose, "", "```powershell", command.command, "```", "");
  }
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, pack, receiptTemplate) {
  const laneRows = pack.statusConsoleLanes
    .map((lane) => `<tr><td><code>${htmlEscape(lane.id)}</code></td><td>${htmlEscape(lane.status)}</td><td>${htmlEscape(lane.detail)}</td></tr>`)
    .join("\n");
  const gapRows = pack.remainingGaps
    .map((gap) => `<tr><td><code>${htmlEscape(gap.kind)}</code></td><td>${htmlEscape(gap.detail)}</td></tr>`)
    .join("\n");
  const receiptRows = receiptTemplate.reviewRows
    .map((row) => `<tr><td><code>${htmlEscape(row.id)}</code></td><td>${htmlEscape(row.question)}</td><td>${htmlEscape(row.defaultAnswer)}</td></tr>`)
    .join("\n");
  const commands = pack.nextReviewCommands
    .map((command) => `<section><h2>${htmlEscape(command.id)}</h2><p>${htmlEscape(command.purpose)}</p><pre>${htmlEscape(command.command)}</pre></section>`)
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Operational Final Review Pack</title>
  <style>
    body { margin: 0; font: 14px/1.45 Segoe UI, Arial, sans-serif; color: #182433; background: #f6f8fb; }
    main { max-width: 1100px; margin: 0 auto; padding: 24px; }
    section { background: #fff; border: 1px solid #d8e2ec; border-radius: 8px; padding: 16px; margin: 12px 0; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border-top: 1px solid #e5ebf2; padding: 8px; text-align: left; vertical-align: top; }
    pre, code { background: #edf3f8; border-radius: 5px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; }
    .lock { color: #8a3b00; font-weight: 700; }
  </style>
</head>
<body>
<main>
  <h1>Operational Final Review Pack</h1>
  <section>
    <p>Status: <code>${htmlEscape(pack.status)}</code></p>
    <p class="lock">Review-only. No task registration, runner launch, log read, screenshot, software execution, memory write, packaging unlock, or completion claim.</p>
    <p>Status console: <a href="${htmlEscape(fileHref(pack.sourceEvidence.statusConsole))}">${htmlEscape(pack.sourceEvidence.statusConsole)}</a></p>
    <p>Unattended audit: <a href="${htmlEscape(fileHref(pack.sourceEvidence.unattendedAudit))}">${htmlEscape(pack.sourceEvidence.unattendedAudit)}</a></p>
  </section>
  <section><h2>Status Console Lanes</h2><table><thead><tr><th>Lane</th><th>Status</th><th>Detail</th></tr></thead><tbody>${laneRows}</tbody></table></section>
  <section><h2>Remaining Gaps</h2><table><thead><tr><th>Gap</th><th>Detail</th></tr></thead><tbody>${gapRows}</tbody></table></section>
  <section><h2>Teacher Receipt Rows</h2><table><thead><tr><th>Row</th><th>Question</th><th>Default</th></tr></thead><tbody>${receiptRows}</tbody></table></section>
  ${commands}
</main>
</body>
</html>
`,
    "utf8"
  );
}

const repoRoot = process.cwd();
const goal = argValue("--goal", "Prepare unattended all-software operational evidence for final teacher review without claiming completion.");
const statusConsolePath = resolve(
  argValue(
    "--status-console",
    newestFile(join(repoRoot, "artifacts", "current-goal-operational-status-consoles"), "all-software-operational-status-console.json") ||
      newestFile(join(repoRoot, "artifacts", "all-software-operational-status-consoles"), "all-software-operational-status-console.json")
  )
);
const unattendedAuditPath = resolve(
  argValue(
    "--unattended-audit",
    newestFile(join(repoRoot, "artifacts", "all-software-unattended-learning-audits"), "all-software-unattended-learning-audit.json")
  )
);
const finalGatePath = resolve(
  argValue(
    "--final-completion-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-final-completion-gates"), "original-goal-final-completion-gate.json")
  )
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-operational-final-review-packs")));
if (!existsSync(statusConsolePath)) throw new Error(`Missing status console: ${statusConsolePath}`);
if (!existsSync(unattendedAuditPath)) throw new Error(`Missing unattended audit: ${unattendedAuditPath}`);

const statusConsole = readJson(statusConsolePath);
const unattendedAudit = readJson(unattendedAuditPath);
const finalGate = existsSync(finalGatePath) ? readJson(finalGatePath) : null;
const lockState = locks();
const remainingGaps = Array.isArray(unattendedAudit.remainingGaps) ? unattendedAudit.remainingGaps : [];
const operationalLane = laneStatus(statusConsole, "operational_learning");
const activationLane = laneStatus(statusConsole, "automatic_learning_activation_path");
const voiceLane = laneStatus(statusConsole, "non_expert_engineering_voice_control");
const finalOperationalLane = (Array.isArray(finalGate?.lanes) ? finalGate.lanes : []).find(
  (lane) => lane.id === "unattended_all_software_operational_evidence"
);

const blockers = [];
if (statusConsole.completionBoundary?.goalComplete !== false) blockers.push("status_console_goal_completion_lock_missing");
if (statusConsole.locks?.registerTaskCalled !== false) blockers.push("status_console_register_task_lock_missing");
if (statusConsole.locks?.logContentsRead !== false) blockers.push("status_console_log_read_lock_missing");
if (unattendedAudit.unattendedAllAppMonitoringComplete !== false) blockers.push("unattended_audit_claims_complete");
if (unattendedAudit.locks?.auditDoesNotChangeSystem !== true) blockers.push("unattended_audit_change_system_lock_missing");
if (unattendedAudit.locks?.scheduledTaskRegistered !== false) blockers.push("unattended_audit_registration_lock_missing");
if (remainingGaps.length <= 0) blockers.push("unattended_audit_missing_remaining_gap_explanation");
if (finalOperationalLane && finalOperationalLane.ready !== false) blockers.push("final_gate_operational_lane_not_blocked");

const packId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packDir = join(outputRoot, packId);
mkdirSync(packDir, { recursive: true });
const packPath = join(packDir, "operational-final-review-pack.json");
const receiptTemplatePath = join(packDir, "operational-final-review-receipt-template.json");
const readmePath = join(packDir, "OPERATIONAL_FINAL_REVIEW_START_HERE.md");
const htmlPath = join(packDir, "operational-final-review-pack.html");

const receiptTemplate = {
  format: "transparent_ai_operational_final_review_receipt_template_v1",
  packId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "ready_for_registration_review", "ready_for_replay_review", "blocked"],
  forbiddenTeacherDecisions: [
    "accepted",
    "claim_complete",
    "register_now",
    "start_task_now",
    "launch_runner_now",
    "read_logs_now",
    "capture_screenshot_now",
    "execute_target_software",
    "write_memory",
    "enable_rule",
    "unlock_packaging"
  ],
  reviewRows: [
    {
      id: "approval_gate_review",
      question: "Has the teacher explicitly confirmed recurring monitor scope and registration prerequisites?",
      defaultAnswer: "not_reviewed_yet"
    },
    {
      id: "registration_runner_review",
      question: "Is the dry-run-first registration runner ready and tied to a retained rollback point?",
      defaultAnswer: "not_reviewed_yet"
    },
    {
      id: "registered_run_output_review",
      question: "After real registration, does a matching scheduled run produce reviewed compact learning events?",
      defaultAnswer: "not_registered_yet"
    },
    {
      id: "teacher_replay_review",
      question: "Have recurring monitor review/replay decisions been resolved without enabling memory or rules prematurely?",
      defaultAnswer: "needs_teacher_review"
    }
  ],
  locks: lockState
};

const pack = {
  ok: blockers.length === 0,
  format: "transparent_ai_operational_final_review_pack_v1",
  packId,
  createdAt: new Date().toISOString(),
  goal,
  status: blockers.length
    ? "blocked_waiting_for_valid_operational_review_inputs"
    : "waiting_for_teacher_operational_review_before_unattended_completion",
  blockers,
  operationalSummary: {
    statusConsoleStatus: statusConsole.status,
    unattendedAuditStatus: unattendedAudit.status,
    unattendedAllAppMonitoringComplete: unattendedAudit.unattendedAllAppMonitoringComplete === true,
    reviewedRunCount: Number(unattendedAudit.evidenceCounts?.reviewedRunCount || 0),
    compactLearningEvents: Number(unattendedAudit.evidenceCounts?.compactLearningEvents || 0),
    teacherReviewItems: Number(unattendedAudit.evidenceCounts?.teacherReviewItems || 0),
    replayItems: Number(unattendedAudit.evidenceCounts?.replayItems || 0),
    readyForFollowUpItems: Number(unattendedAudit.evidenceCounts?.readyForFollowUpItems || 0),
    remainingGapCount: remainingGaps.length,
    operationalLaneStatus: operationalLane?.status || "missing",
    activationLaneStatus: activationLane?.status || "missing",
    voiceLaneStatus: voiceLane?.status || "missing"
  },
  statusConsoleLanes: Array.isArray(statusConsole.lanes) ? statusConsole.lanes : [],
  remainingGaps,
  sourceEvidence: {
    statusConsole: statusConsolePath,
    statusConsoleReadme: statusConsole.readmePath || statusConsole.paths?.readme || "",
    unattendedAudit: unattendedAuditPath,
    unattendedAuditReadme: unattendedAudit.readmePath || "",
    finalCompletionGate: existsSync(finalGatePath) ? finalGatePath : "",
    finalOperationalLaneStatus: finalOperationalLane?.status || "missing",
    finalOperationalLaneEvidence: finalOperationalLane?.evidence || ""
  },
  nextReviewCommands: [
    {
      id: "open_operational_status_console",
      purpose: "Review current operational lanes and blocked claims before any registration or runner action.",
      command: statusConsole.readmePath || statusConsolePath
    },
    {
      id: "open_unattended_audit",
      purpose: "Review the evidence chain and remaining gaps for recurring low-token monitoring.",
      command: unattendedAudit.readmePath || unattendedAuditPath
    },
    {
      id: "prepare_activation_review_packet",
      purpose: "Prepare or revisit activation review before any real registration.",
      command: commandLine("create-all-software-operational-activation-review-packet.mjs", [
        "--goal",
        goal,
        "--output-dir",
        "artifacts\\current-goal-operational-activation-review-packets"
      ])
    },
    {
      id: "rerun_unattended_audit_after_teacher_registration_review",
      purpose: "After real teacher review and observed registered-run evidence, re-run the unattended audit.",
      command: commandLine("create-all-software-unattended-learning-audit.mjs", [
        "--schedule",
        "<automatic-low-token-learning-schedule.json>",
        "--approval-gate",
        "<recurring-monitor-approval-gate.json>",
        "--registration-runner",
        "<recurring-monitor-registration-runner.json>",
        "--registration-status",
        "<recurring-monitor-registration-status.json>",
        "--run-output-audit",
        "<recurring-monitor-run-output-audit.json>",
        "--teacher-review-packet",
        "<recurring-monitor-teacher-review-packet.json>",
        "--review-decision-replay-queue",
        "<recurring-monitor-review-decision-replay-queue.json>",
        "--output-dir",
        "artifacts\\current-goal-unattended-learning-audits"
      ])
    }
  ],
  completionBoundary: {
    unattendedAllAppMonitoringComplete: false,
    finalGoalCompletionAllowed: false,
    reason: "This pack organizes operational review. Completion still requires teacher-confirmed registration, matching scheduled run evidence, reviewed run output, and resolved replay decisions."
  },
  paths: {
    pack: packPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  },
  locks: lockState
};

writeJson(packPath, pack);
writeJson(receiptTemplatePath, receiptTemplate);
writeReadme(readmePath, pack);
writeHtml(htmlPath, pack, receiptTemplate);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_operational_final_review_pack_result_v1",
      status: pack.status,
      packPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      blockers,
      operationalSummary: pack.operationalSummary,
      locks: lockState
    },
    null,
    2
  )
);
