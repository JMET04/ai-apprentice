#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-completion-blocker-next-step-queue")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-completion-blocker-next-step-queue"
  );
}

function readJson(path, required = false) {
  if (!path || !existsSync(path)) {
    if (required) throw new Error(`JSON file is required: ${path || "(missing)"}`);
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function commandPlaceholders(command) {
  const text = String(command || "");
  return Array.from(new Set([...(text.match(/<[^<>]+>/g) || []), ...(text.match(/__[A-Z0-9_]+__/g) || [])]));
}

function looksLikeCommand(value) {
  const text = String(value || "").trim().toLowerCase();
  return text.startsWith("node ") || text.startsWith("npm ") || text.startsWith("python ") || text.startsWith("powershell ");
}

function commandRisk(command) {
  const lower = String(command || "").toLowerCase();
  const highRiskMarkers = [
    "--execute-approved-gate",
    "--execute-approved-registration",
    "--allow-system-change",
    "--allow-runner-trigger",
    "--teacher-confirmed",
    "--teacher-confirmed",
    "--teacher-confirmation",
    "--execute",
    "register-scheduledtask",
    "schtasks /create",
    "capture-triggered-visual-check.mjs",
    "run-all-software-execution-approved-gate-runner.mjs",
    "run-all-software-operational-learning-registration-approved-runner.mjs",
    "run-all-software-operational-learning-post-registration-output-witness-runner.mjs"
  ];
  const matchedHighRiskMarkers = highRiskMarkers.filter((marker) => lower.includes(marker));
  return {
    hasPlaceholders: commandPlaceholders(command).length > 0,
    placeholders: commandPlaceholders(command),
    matchedHighRiskMarkers,
    reviewOnlySafeToCopy: matchedHighRiskMarkers.length === 0
  };
}

function combinedCommandRisk(commands) {
  const risks = array(commands).map((command) => commandRisk(command));
  const placeholders = Array.from(new Set(risks.flatMap((risk) => risk.placeholders)));
  const matchedHighRiskMarkers = Array.from(new Set(risks.flatMap((risk) => risk.matchedHighRiskMarkers)));
  return {
    hasPlaceholders: placeholders.length > 0,
    placeholders,
    matchedHighRiskMarkers,
    reviewOnlySafeToCopy: matchedHighRiskMarkers.length === 0
  };
}

function lanePriority(lane) {
  const priorities = new Map([
    ["rollback_evidence_before_system_change", 5],
    ["rule_dsl_delivery_gate_audit", 8],
    ["all_software_low_token_coverage_evidence", 10],
    ["teacher_reviewed_triggered_visual_evidence_path", 20],
    ["transparent_sketch_spatial_intent_teacher_export", 30],
    ["voice_text_numbered_confirmation_supervised_execution_gate", 40],
    ["unattended_operational_monitor_evidence", 50],
    ["universal_native_execution_control_channel", 60]
  ]);
  return priorities.get(lane) ?? 90;
}

function evidenceLinks(sourcePaths) {
  return array(sourcePaths)
    .filter(Boolean)
    .map((value) => {
      const text = String(value);
      if (looksLikeCommand(text)) {
        return {
          kind: "command_template",
          value: text,
          exists: false,
          basename: ""
        };
      }
      return {
        kind: existsSync(text) ? "existing_file" : "missing_file_or_placeholder",
        value: text,
        exists: existsSync(text),
        basename: existsSync(text) ? basename(text) : ""
      };
    });
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    queueDoesNotValidateReceipts: true,
    queueDoesNotRunCommands: true,
    queueDoesNotRegisterTask: true,
    queueDoesNotLaunchRunner: true,
    queueDoesNotExecuteTargetSoftware: true,
    queueDoesNotCaptureScreenshots: true,
    queueDoesNotReadFullLogs: true,
    queueDoesNotWriteMemory: true,
    queueDoesNotEnableRules: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function queueStatusFor(row, risk) {
  if (risk.matchedHighRiskMarkers.length > 0) return "gated_until_teacher_receipt_and_rollback";
  if (risk.hasPlaceholders) return "waiting_for_placeholder_replacement";
  return "ready_for_review_only_manual_follow_up";
}

function writeHtml(path, queue) {
  const rows = queue.queueItems
    .map((item) => {
      const links = item.evidenceLinks
        .map((link) =>
          link.kind === "existing_file"
            ? `<a href="${htmlEscape(fileHref(link.value))}">${htmlEscape(link.basename)}</a>`
            : `<code>${htmlEscape(link.value)}</code>`
        )
        .join("<br>");
      return `<tr>
        <td>${htmlEscape(item.order)}</td>
        <td>${htmlEscape(item.lane)}</td>
        <td>${htmlEscape(item.status)}</td>
        <td>${htmlEscape(item.nextSafeAction)}</td>
        <td>${links}</td>
        <td><code>${htmlEscape(item.commandTemplate)}</code></td>
        <td>${item.reviewCommandTemplates
          .map((command) => `<code>${htmlEscape(command)}</code>`)
          .join("<br>")}</td>
        <td>${htmlEscape(item.missingInputs.join(", "))}</td>
        <td>${htmlEscape(item.blockedClaims.join(", "))}</td>
      </tr>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Completion Blocker Next-Step Queue</title>
  <style>
    :root { color: #17202a; background: #f6f8fb; font: 14px/1.45 "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1260px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 27px; letter-spacing: 0; }
    p { line-height: 1.5; }
    .summary, table { background: #fff; border: 1px solid #d9e2ef; border-radius: 8px; }
    .summary { padding: 15px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 9px; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #edf3f8; }
    code { display: inline-block; max-width: 100%; background: #eef3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
    .lock { color: #596779; font-size: 13px; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Completion Blocker Next-Step Queue</h1>
  <section class="summary">
    <p><strong>Status:</strong> ${htmlEscape(queue.status)}</p>
    <p><strong>Queue decision:</strong> ${htmlEscape(queue.queueDecision)}</p>
    <p><strong>Source matrix:</strong> <a href="${htmlEscape(fileHref(queue.sourceEvidence.matrix))}">${htmlEscape(queue.sourceEvidence.matrix)}</a></p>
    <p class="lock">This queue only orders blocker follow-up. It does not validate receipts, run commands, register tasks, launch runners, capture screenshots, write memory, execute target software, unlock packaging, or claim completion.</p>
  </section>
  <table>
    <thead><tr><th>#</th><th>Lane</th><th>Status</th><th>Next safe action</th><th>Evidence</th><th>Command template</th><th>Review commands</th><th>Missing inputs</th><th>Blocked claims</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, queue) {
  const lines = [
    "# Original Goal Completion Blocker Next-Step Queue",
    "",
    `Status: ${queue.status}`,
    `Queue decision: ${queue.queueDecision}`,
    `Items: ${queue.counts.queueItems}`,
    "",
    "This queue orders completion-blocker lanes into low-token, review-only next steps.",
    "",
    "Recommended order:",
    ...queue.queueItems.map(
      (item) => `- ${item.order}. ${item.lane}: ${item.status}; ${item.nextSafeAction}`
    ),
    "",
    "Locks:",
    ...Object.entries(queue.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const matrixInput = argValue("--matrix", argValue("--completion-blocker-matrix", ""));
if (!matrixInput) {
  throw new Error(
    "Usage: node create-original-goal-completion-blocker-next-step-queue.mjs --matrix <original-goal-completion-blocker-matrix.json>"
  );
}

const matrixPath = resolve(matrixInput);
const matrix = readJson(matrixPath, true);
if (matrix.format !== "transparent_ai_original_goal_completion_blocker_matrix_v1") {
  throw new Error("--matrix must be transparent_ai_original_goal_completion_blocker_matrix_v1");
}

const goal = argValue("--goal", matrix.goal || "Create next steps from original-goal completion blockers.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-next-step-queues"))
);
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const queueDir = join(outputRoot, queueId);
mkdirSync(queueDir, { recursive: true });

const queueLocks = locks();
const queueItems = array(matrix.rows)
  .map((matrixRow) => {
    const reviewCommandTemplates = array(matrixRow.reviewCommandTemplates);
    const risk = commandRisk(matrixRow.verifierCommand || "");
    const reviewCommandRisk = combinedCommandRisk(reviewCommandTemplates);
    return {
      id: `completion_blocker_next_step_${matrixRow.id || slugify(matrixRow.lane)}`,
      sourceRowId: matrixRow.id || "",
      order: 0,
      priority: lanePriority(matrixRow.lane),
      lane: matrixRow.lane || "",
      status: queueStatusFor(matrixRow, risk),
      requirement: matrixRow.requirement || "",
      currentEvidence: matrixRow.currentEvidence || "",
      missingProof: matrixRow.missingProof || "",
      nextSafeAction: matrixRow.nextSafeAction || "",
      commandTemplate: matrixRow.verifierCommand || "",
      reviewCommandTemplates,
      commandRisk: risk,
      reviewCommandRisk,
      missingInputs: risk.placeholders,
      reviewCommandMissingInputs: reviewCommandRisk.placeholders,
      evidenceLinks: evidenceLinks(matrixRow.sourcePaths),
      blockedClaims: array(matrixRow.blockedClaims),
      blockedActions: [
        "auto_execute_completion_blocker_command",
        "register_task_from_completion_blocker_queue",
        "launch_runner_from_completion_blocker_queue",
        "capture_screenshot_from_completion_blocker_queue",
        "write_memory_from_completion_blocker_queue",
        "claim_goal_complete_from_completion_blocker_queue"
      ],
      locks: queueLocks
    };
  })
  .sort((a, b) => a.priority - b.priority || a.lane.localeCompare(b.lane))
  .map((item, index) => ({ ...item, order: index + 1, number: index + 1 }));

const queuePath = join(queueDir, "original-goal-completion-blocker-next-step-queue.json");
const htmlPath = join(queueDir, "original-goal-completion-blocker-next-step-queue.html");
const readmePath = join(queueDir, "ORIGINAL_GOAL_COMPLETION_BLOCKER_NEXT_STEP_QUEUE_START_HERE.md");
const gatedCount = queueItems.filter((item) => item.status === "gated_until_teacher_receipt_and_rollback").length;
const placeholderCount = queueItems.filter((item) => item.status === "waiting_for_placeholder_replacement").length;
const readyCount = queueItems.filter((item) => item.status === "ready_for_review_only_manual_follow_up").length;

const queue = {
  ok: true,
  format: "transparent_ai_original_goal_completion_blocker_next_step_queue_v1",
  queueId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_to_choose_one_completion_blocker_lane",
  queueDecision:
    gatedCount > 0
      ? "review_low_token_lanes_first_and_keep_gated_commands_blocked_until_receipts_and_rollback"
      : placeholderCount > 0
        ? "replace_placeholders_before_manual_follow_up"
        : "ready_for_review_only_manual_follow_up",
  purpose:
    "Order completion-blocker lanes into one-at-a-time review steps without running commands or weakening the not-complete boundary.",
  sourceEvidence: {
    matrix: matrixPath,
    statusRefresh: matrix.sourceEvidence?.statusRefresh || ""
  },
  counts: {
    queueItems: queueItems.length,
    readyReviewOnlyItems: readyCount,
    placeholderItems: placeholderCount,
    gatedItems: gatedCount,
    existingEvidenceLinks: queueItems.flatMap((item) => item.evidenceLinks).filter((link) => link.kind === "existing_file").length
  },
  queueItems,
  blockedClaims: [
    "claim_original_goal_complete_from_completion_blocker_next_step_queue",
    "accept_technology_from_completion_blocker_next_step_queue",
    "enable_rules_from_completion_blocker_next_step_queue",
    "unlock_packaging_from_completion_blocker_next_step_queue",
    "register_or_launch_runner_from_completion_blocker_next_step_queue",
    "execute_target_software_from_completion_blocker_next_step_queue",
    "capture_screenshots_from_completion_blocker_next_step_queue",
    "write_memory_from_completion_blocker_next_step_queue"
  ],
  paths: {
    queue: queuePath,
    html: htmlPath,
    readme: readmePath
  },
  locks: queueLocks
};

writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
writeHtml(htmlPath, queue);
writeReadme(readmePath, queue);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_completion_blocker_next_step_queue_result_v1",
      queueId,
      status: queue.status,
      queueDecision: queue.queueDecision,
      queuePath,
      htmlPath,
      readmePath,
      queueItems: queueItems.length,
      gatedItems: gatedCount,
      locks: queueLocks
    },
    null,
    2
  )
);
