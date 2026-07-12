#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

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

function slugify(value) {
  return (
    String(value || "recurring-monitor-review-decision-replay-queue")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "recurring-monitor-review-decision-replay-queue"
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
  if (text.startsWith("{") || text.startsWith("[")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function compact(value, max = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function parseDecisionArg(value) {
  const [idPart, decisionPart, ...noteParts] = String(value || "").split("=");
  const reviewItemId = idPart?.trim();
  const decision = decisionPart?.trim();
  const note = noteParts.join("=").trim();
  return reviewItemId && decision ? { reviewItemId, decision, note } : null;
}

function normalizeDecisions(input, inlineDecisions, defaultDecision) {
  const rows = [];
  const value = input?.value;
  if (Array.isArray(value)) rows.push(...value);
  else if (Array.isArray(value?.decisions)) rows.push(...value.decisions);
  else if (value && typeof value === "object") {
    for (const [reviewItemId, decision] of Object.entries(value)) rows.push({ reviewItemId, decision });
  }
  for (const decision of inlineDecisions.map(parseDecisionArg).filter(Boolean)) rows.push(decision);
  return { rows, defaultDecision };
}

function decisionFor(item, decisions, defaultDecision) {
  const row =
    decisions.find((entry) => entry.reviewItemId === item.reviewItemId || entry.id === item.reviewItemId) ||
    decisions.find((entry) => entry.runId && entry.runId === item.runId);
  return {
    decision: String(row?.decision || row?.status || defaultDecision || "needs_teacher_review").trim(),
    reviewerNote: row?.note || row?.reviewerNote || "",
    observedEvidencePath: row?.observedEvidencePath || row?.evidencePath || ""
  };
}

function replayFor(item, decisionRecord) {
  const allowed = ["needs_teacher_review", "blocked", "ready_for_follow_up"];
  const decision = decisionRecord.decision;
  if (decision === "accepted") {
    return {
      lane: "blocked_invalid_acceptance_decision",
      status: "blocked",
      consequence: "accepted is not allowed from this review packet; rule enablement and memory writes remain blocked",
      nextAction: "replace accepted with needs_teacher_review, blocked, or ready_for_follow_up",
      nextMcpCall: {
        tool: "manual_blocker_review",
        arguments: { reviewItemId: item.reviewItemId, blockedDecision: decision },
        blockedUntil: "teacher supplies an allowed review decision"
      }
    };
  }
  if (!allowed.includes(decision)) {
    return {
      lane: "blocked_unknown_review_decision",
      status: "blocked",
      consequence: "unknown review decision cannot advance the recurring monitor learning loop",
      nextAction: "use needs_teacher_review, blocked, or ready_for_follow_up",
      nextMcpCall: {
        tool: "manual_blocker_review",
        arguments: { reviewItemId: item.reviewItemId, blockedDecision: decision },
        blockedUntil: "teacher supplies an allowed review decision"
      }
    };
  }
  if (decision === "blocked") {
    return {
      lane: "blocker_preserved",
      status: "blocked",
      consequence: "keep the row out of follow-up until the blocker is resolved",
      nextAction: "review lock, parse, evidence, or teacher blocker note",
      nextMcpCall: {
        tool: "manual_blocker_review",
        arguments: {
          reviewItemId: item.reviewItemId,
          evidencePaths: item.evidencePaths,
          reviewerNote: decisionRecord.reviewerNote
        },
        blockedUntil: "blocker is resolved and the teacher supplies a new allowed decision"
      }
    };
  }
  if (decision === "ready_for_follow_up") {
    return {
      lane: item.recommendedTool === "create_automatic_triggered_visual_check_queue" ? "visual_follow_up_ready" : "compact_teaching_follow_up_ready",
      status: "ready_for_follow_up",
      consequence: "queue the item's next MCP call for teacher-reviewed follow-up without memory write",
      nextAction: item.recommendedTool === "create_automatic_triggered_visual_check_queue"
        ? "create one triggered visual-check request; capture still requires teacher confirmation"
        : "call teach_apprentice with compact recurring monitor evidence for review-only replay",
      nextMcpCall: item.nextMcpCall
    };
  }
  return {
    lane: "teacher_evidence_still_needed",
    status: "needs_teacher_review",
    consequence: "keep the row in teacher review without advancing to follow-up",
    nextAction: "ask for a short teacher note, correction, or allowed follow-up decision",
    nextMcpCall: {
      tool: "show_teaching_card",
      arguments: {
        reviewItemId: item.reviewItemId,
        recommendedTool: item.recommendedTool,
        reason: item.reason
      },
      blockedUntil: "teacher chooses ready_for_follow_up or blocked"
    }
  };
}

function writeReadme(path, replay) {
  const lines = [
    "# Recurring Monitor Review Decision Replay Queue",
    "",
    `Status: ${replay.status}`,
    `Replay items: ${replay.replayItemCount}`,
    "",
    "This queue replays teacher decisions from a recurring monitor teacher-review packet into the next review-only actions. It does not accept rules, save memory, capture screenshots, execute software, launch runners, or change schedules.",
    "",
    "Replay lanes:"
  ];
  for (const item of replay.replayItems) {
    lines.push(`- ${item.replayItemId}: ${item.decision} -> ${item.lane}; next=${item.nextMcpCall?.tool || ""}`);
  }
  if (!replay.replayItems.length) lines.push("- none");
  lines.push("", "Generated files:", `- ${basename(replay.files.queue)}`, `- ${basename(replay.files.receipt)}`, `- ${basename(replay.files.readme)}`);
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Replay teacher review decisions from recurring monitor learning events.");
const packetInput = readJsonInput(
  argValue("--teacher-review-packet", argValue("--packet", argValue("--packet-path", ""))),
  "--teacher-review-packet"
);
const decisionsInput = readJsonInput(argValue("--decisions", argValue("--decision-receipt", "")), "--decisions", true);
const defaultDecision = argValue("--default-decision", "needs_teacher_review");
const inlineDecisionArgs = [...argValues("--decision"), ...argValues("--review-decision")];
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-recurring-monitor-review-decision-replay-queues"))
);

const packet = packetInput.value;
if (!packet || packet.format !== "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1") {
  throw new Error("--teacher-review-packet must be transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1");
}

const normalized = normalizeDecisions(decisionsInput, inlineDecisionArgs, defaultDecision);
mkdirSync(outputRoot, { recursive: true });
const replayId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(packet.packetId || goal)}`;
const replayDir = join(outputRoot, replayId);
mkdirSync(replayDir, { recursive: true });

const replayItems = (packet.reviewItems || []).map((item, index) => {
  const decisionRecord = decisionFor(item, normalized.rows, normalized.defaultDecision);
  const replay = replayFor(item, decisionRecord);
  return {
    replayItemId: `recurring-monitor-decision-replay-${String(index + 1).padStart(3, "0")}`,
    reviewItemId: item.reviewItemId,
    runId: item.runId,
    originalNextReviewAction: item.nextReviewAction,
    recommendedTool: item.recommendedTool,
    decision: decisionRecord.decision,
    reviewerNote: decisionRecord.reviewerNote,
    observedEvidencePath: decisionRecord.observedEvidencePath,
    lane: replay.lane,
    status: replay.status,
    consequence: replay.consequence,
    nextAction: replay.nextAction,
    nextMcpCall: replay.nextMcpCall,
    evidencePaths: item.evidencePaths || {},
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true
    }
  };
});

const counts = replayItems.reduce((acc, item) => {
  acc[item.lane] = (acc[item.lane] || 0) + 1;
  return acc;
}, {});
const invalidCount = replayItems.filter((item) => item.lane.startsWith("blocked_invalid") || item.lane === "blocked_unknown_review_decision").length;
const followUpCount = replayItems.filter((item) => item.status === "ready_for_follow_up").length;
const blockerCount = replayItems.filter((item) => item.status === "blocked").length;
let status = "teacher_review_decisions_waiting_for_more_evidence";
if (invalidCount > 0) status = "blocked_invalid_review_decisions";
else if (blockerCount > 0 && followUpCount === 0) status = "blocked_items_preserved";
else if (followUpCount > 0) status = "follow_up_actions_waiting_for_teacher_review";

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  replayDoesNotChangeSystem: true,
  runnerLaunched: false,
  scheduledTaskRegistered: false,
  scheduledTaskUnregistered: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false
};

const queuePath = join(replayDir, "recurring-monitor-review-decision-replay-queue.json");
const receiptPath = join(replayDir, "recurring-monitor-review-decision-replay-queue-receipt.json");
const readmePath = join(replayDir, "RECURRING_MONITOR_REVIEW_DECISION_REPLAY_QUEUE_START_HERE.md");

const queue = {
  ok: true,
  format: "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1",
  replayId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourcePacketPath: packetInput.path,
  sourcePacketStatus: packet.status,
  decisionInputPath: decisionsInput.path,
  defaultDecision,
  allowedDecisions: ["needs_teacher_review", "blocked", "ready_for_follow_up"],
  blockedDecisions: ["accepted"],
  replayItemCount: replayItems.length,
  counts,
  replayItems,
  blockedActions: [
    "accept recurring monitor output as a rule",
    "write long-term memory",
    "capture screenshots",
    "execute target software",
    "launch automatic runner",
    "register or change scheduled tasks",
    "unlock packaging"
  ],
  locks,
  files: {
    queue: queuePath,
    receipt: receiptPath,
    readme: readmePath
  }
};

const receipt = {
  format: "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_receipt_v1",
  replayId,
  status,
  replayItemCount: replayItems.length,
  counts,
  invalidDecisionCount: invalidCount,
  followUpCount,
  blockerCount,
  acceptedDecisionBlocked: replayItems.some((item) => item.decision === "accepted"),
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

writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, queue);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_result_v1",
      status,
      replayId,
      queuePath,
      receiptPath,
      readmePath,
      replayItemCount: replayItems.length,
      counts,
      invalidDecisionCount: invalidCount,
      followUpCount,
      blockerCount,
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
