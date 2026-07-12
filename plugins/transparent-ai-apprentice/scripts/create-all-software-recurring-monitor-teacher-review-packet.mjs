#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "recurring-monitor-teacher-review-packet")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "recurring-monitor-teacher-review-packet"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label, optional = false) {
  const text = String(value || "").trim();
  if (!text) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function compact(value, max = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function profileSignals(profile, teacherStyle) {
  const modeTexts = (profile?.preferredTeachingModes || [])
    .map((mode) => [mode.mode, mode.recommendedTool, mode.detectedFrom].filter(Boolean).join(" "))
    .join(" ");
  const preferenceTexts = [
    ...(profile?.evidencePreferenceOrder || []),
    ...(profile?.teacherSignalSummary?.evidencePreferences || []),
    ...(profile?.teacherSignalSummary?.preferredTools || [])
  ].join(" ");
  const combined = [teacherStyle, modeTexts, preferenceTexts].join(" ").toLowerCase();
  return {
    prefersVisual:
      /visual|screenshot|screen|sketch|overlay|mask|transparent|2d|3d|depth|perspective|draw|截图|屏幕|绘|草图|蒙版|透明|二维|三维|透视|深度/i.test(
        combined
      ),
    prefersLogs: /log|delta|metadata|low token|event|日志|变化|低 token|低token|事件/i.test(combined),
    prefersCorrectionFirst: /correction|wrong|boundary|counterexample|纠正|不对|边界|反例/i.test(combined),
    inferredPrimaryMode: profile?.teacherSignalSummary?.inferredPrimaryMode || "",
    defaultNextTool: profile?.nextSuggestedTools?.[0] || profile?.routeOrder?.[0] || ""
  };
}

function rowNeedsVisual(row, signals, forceVisual) {
  if (forceVisual || signals.prefersVisual) return true;
  if (row.screenshotRequests > 0) return true;
  const calls = JSON.stringify(row.nextTeachingCalls || []).toLowerCase();
  if (/screenshot|visual|screen|overlay|sketch|spatial/.test(calls)) return true;
  if (!row.nextTeachingCalls || row.nextTeachingCalls.length === 0) return true;
  if (row.changedItems > 0 && row.compactLearningEvents === 0) return true;
  return false;
}

function classifyReviewItem(row, signals, options) {
  if (row.lockMismatch || row.status === "journal_parse_error" || /blocked|parse|mismatch/i.test(row.status || "")) {
    return {
      action: "blocked_until_lock_or_parse_issue_reviewed",
      recommendedTool: "manual_blocker_review",
      reason: "This run has a lock mismatch, parse issue, or blocked status. Do not trust it as learning evidence yet."
    };
  }
  if (rowNeedsVisual(row, signals, options.forceVisual)) {
    return {
      action: "needs_triggered_visual_check_review",
      recommendedTool: "create_automatic_triggered_visual_check_queue",
      reason: "The changed signal needs visual grounding or the teacher method prefers visual/sketch evidence."
    };
  }
  return {
    action: "ready_for_teacher_teach_apprentice_review",
    recommendedTool: "teach_apprentice",
    reason: "Compact changed evidence is ready for teacher review without screenshot capture or memory write."
  };
}

function nextMcpCallFor(row, classification, goal, software) {
  if (classification.recommendedTool === "create_automatic_triggered_visual_check_queue") {
    return {
      tool: "create_automatic_triggered_visual_check_queue",
      arguments: {
        goal: `Review one triggered visual check after recurring low-token monitor output for ${software || row.runId}.`,
        runner: row.journalPath,
        maxRequests: 1,
        forceRequest: row.compactLearningEvents > 0
      },
      blockedUntil: "teacher confirms a bounded visual check request; this packet captures no screenshot"
    };
  }
  if (classification.recommendedTool === "teach_apprentice") {
    return {
      tool: "teach_apprentice",
      arguments: {
        goal,
        message:
          `Review recurring monitor compact learning evidence for ${software || "the changed software"}.\n` +
          `Journal: ${row.journalPath}\nReceipt: ${row.receiptPath}\n` +
          "Do not save memory until the teacher approves the replayed rule."
      },
      blockedUntil: "teacher reviews the compact learning event and approves or corrects the reusable rule"
    };
  }
  return {
    tool: "manual_blocker_review",
    arguments: {
      journalPath: row.journalPath,
      receiptPath: row.receiptPath,
      status: row.status
    },
    blockedUntil: "lock, parse, or receipt mismatch is resolved by a teacher or maintainer"
  };
}

function writeReadme(path, packet) {
  const lines = [
    "# Recurring Monitor Teacher Review Packet",
    "",
    `Status: ${packet.status}`,
    `Review items: ${packet.reviewItemCount}`,
    "",
    "This packet turns existing recurring low-token monitor output into teacher-review actions. It does not launch runners, register tasks, capture screenshots, execute target software, write memory, or unlock packaging.",
    "",
    "Review queue:"
  ];
  for (const item of packet.reviewItems) {
    lines.push(
      `- ${item.reviewItemId}: ${item.nextReviewAction}; tool=${item.recommendedTool}; run=${compact(item.runId, 96)}`
    );
  }
  if (!packet.reviewItems.length) lines.push("- none");
  lines.push(
    "",
    "Teacher flow:",
    "1. Review blocker rows first.",
    "2. For direct rows, call teach_apprentice with the compact journal/receipt evidence.",
    "3. For visual rows, create only a triggered visual-check request; capture remains behind teacher confirmation.",
    "4. Save no long-term memory until the teacher approves the replayed rule.",
    "",
    "Generated files:",
    `- ${basename(packet.files.packet)}`,
    `- ${basename(packet.files.receipt)}`,
    `- ${basename(packet.files.readme)}`
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Create a teacher review packet from recurring low-token monitor output.");
const auditInput = readJsonInput(
  argValue("--run-output-audit", argValue("--audit", argValue("--audit-path", ""))),
  "--run-output-audit"
);
const profileInput = readJsonInput(
  argValue("--teacher-method-profile", argValue("--profile", argValue("--teacher-profile", ""))),
  "--teacher-method-profile",
  true
);
const teacherStyle = argValue("--teacher-style", argValue("--style", ""));
const software = argValue("--software", "");
const maxItems = Math.max(1, Number(argValue("--max-review-items", argValue("--max-items", "12"))));
const forceVisual = hasFlag("--force-visual-review") || hasFlag("--force-visual");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-recurring-monitor-teacher-review-packets"))
);

const audit = auditInput.value;
if (!audit || audit.format !== "transparent_ai_all_software_recurring_monitor_run_output_audit_v1") {
  throw new Error("--run-output-audit must be transparent_ai_all_software_recurring_monitor_run_output_audit_v1");
}
if (profileInput.value && profileInput.value.format !== "transparent_ai_teacher_learning_method_profile_v1") {
  throw new Error("--teacher-method-profile must be transparent_ai_teacher_learning_method_profile_v1");
}

mkdirSync(outputRoot, { recursive: true });
const packetId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(audit.taskName || goal)}`;
const packetDir = join(outputRoot, packetId);
mkdirSync(packetDir, { recursive: true });

const signals = profileSignals(profileInput.value, teacherStyle);
const queueRows = (audit.teacherReviewQueue || []).slice(0, maxItems);
const latestByJournal = new Map((audit.latestRuns || []).map((row) => [row.journalPath, row]));
const reviewItems = queueRows.map((item, index) => {
  const row = { ...(latestByJournal.get(item.journalPath) || {}), ...item };
  const classification = classifyReviewItem(row, signals, { forceVisual });
  return {
    reviewItemId: `recurring-monitor-review-${String(index + 1).padStart(3, "0")}`,
    runId: row.runId,
    status: row.status,
    compactLearningEvents: Number(row.compactLearningEvents || 0),
    changedItems: Number(row.changedItems || 0),
    changedLogs: Number(row.changedLogs || 0),
    evidencePaths: {
      journalPath: row.journalPath,
      receiptPath: row.receiptPath
    },
    nextTeachingCalls: Array.isArray(row.nextTeachingCalls) ? row.nextTeachingCalls.slice(0, 3) : [],
    nextReviewAction: classification.action,
    recommendedTool: classification.recommendedTool,
    reason: classification.reason,
    nextMcpCall: nextMcpCallFor(row, classification, goal, software || audit.taskName || ""),
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true
    }
  };
});

const counts = reviewItems.reduce(
  (acc, item) => {
    acc[item.nextReviewAction] = (acc[item.nextReviewAction] || 0) + 1;
    return acc;
  },
  {
    ready_for_teacher_teach_apprentice_review: 0,
    needs_triggered_visual_check_review: 0,
    blocked_until_lock_or_parse_issue_reviewed: 0
  }
);

let status = "no_recurring_monitor_learning_events_to_review";
if (counts.blocked_until_lock_or_parse_issue_reviewed > 0) status = "blocked_items_waiting_for_teacher_or_maintainer_review";
else if (counts.needs_triggered_visual_check_review > 0) status = "visual_check_requests_waiting_for_teacher_review";
else if (counts.ready_for_teacher_teach_apprentice_review > 0) status = "compact_learning_events_waiting_for_teacher_review";

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  packetDoesNotChangeSystem: true,
  runnerLaunched: false,
  scheduledTaskRegistered: false,
  scheduledTaskUnregistered: false,
  screenshotsCaptured: false,
  visualCheckRequestedOnly: counts.needs_triggered_visual_check_review > 0,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false
};

const packetPath = join(packetDir, "recurring-monitor-teacher-review-packet.json");
const receiptPath = join(packetDir, "recurring-monitor-teacher-review-packet-receipt.json");
const readmePath = join(packetDir, "RECURRING_MONITOR_TEACHER_REVIEW_PACKET_START_HERE.md");

const packet = {
  ok: true,
  format: "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1",
  packetId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceAuditPath: auditInput.path,
  sourceAuditStatus: audit.status,
  sourceAuditTotals: audit.totals || {},
  teacherMethodInfluence: {
    teacherMethodProfilePath: profileInput.path,
    teacherStyle,
    inferredPrimaryMode: signals.inferredPrimaryMode,
    defaultNextTool: signals.defaultNextTool,
    prefersVisual: signals.prefersVisual,
    prefersLogs: signals.prefersLogs,
    prefersCorrectionFirst: signals.prefersCorrectionFirst,
    forceVisualReview: forceVisual
  },
  reviewItemCount: reviewItems.length,
  counts,
  reviewItems,
  blockedActions: [
    "launch automatic runner from this teacher review packet",
    "register or unregister a scheduled task from this teacher review packet",
    "capture screenshots from this teacher review packet",
    "read raw full logs from this teacher review packet",
    "write long-term memory from recurring monitor output",
    "enable rules or packaging without teacher approval",
    "execute target software from recurring monitor output"
  ],
  locks,
  files: {
    packet: packetPath,
    receipt: receiptPath,
    readme: readmePath
  }
};

const receipt = {
  format: "transparent_ai_all_software_recurring_monitor_teacher_review_packet_receipt_v1",
  packetId,
  status,
  sourceAuditPath: auditInput.path,
  reviewItemCount: reviewItems.length,
  counts,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "blocked", "ready_for_follow_up"],
  blockedDecisions: ["accepted"],
  runnerLaunched: false,
  scheduledTaskRegistered: false,
  scheduledTaskUnregistered: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  locks
};

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_recurring_monitor_teacher_review_packet_result_v1",
      status,
      packetId,
      packetPath,
      receiptPath,
      readmePath,
      reviewItemCount: reviewItems.length,
      counts,
      teacherMethodInfluence: packet.teacherMethodInfluence,
      runnerLaunched: false,
      scheduledTaskRegistered: false,
      scheduledTaskUnregistered: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      longTermMemoryWritten: false,
      nativeUniversalExecution: false,
      locks
    },
    null,
    2
  )
);
