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
    String(value || "original-goal-objective-fulfillment-next-step-queue")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-objective-fulfillment-next-step-queue"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function latestAuditPath() {
  const root = join(process.cwd(), ".transparent-apprentice", "original-goal-objective-fulfillment-audits");
  if (!existsSync(root)) throw new Error("No original-goal-objective-fulfillment-audits directory found.");
  const latest = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name))
    .filter((dir) => existsSync(join(dir, "original-goal-objective-fulfillment-audit.json")))
    .sort()
    .at(-1);
  if (!latest) throw new Error("No original-goal-objective-fulfillment-audit.json found.");
  return join(latest, "original-goal-objective-fulfillment-audit.json");
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

function q(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, q(value));
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
    queueDoesNotValidateReceipts: true,
    queueDoesNotRunCommands: true,
    queueDoesNotRegisterTask: true,
    queueDoesNotLaunchRunner: true,
    queueDoesNotExecuteTargetSoftware: true,
    queueDoesNotCaptureScreenshots: true,
    queueDoesNotReadLogs: true,
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

function laneForRequirement(requirementId) {
  const routes = {
    all_software_low_token_learning: {
      priority: 10,
      routeKind: "low_token_coverage_review",
      nextSafeAction:
        "Review low-token coverage, recurring monitor registration readiness, and runner-output evidence before any all-software learning claim."
    },
    adapt_any_teacher_learning_method: {
      priority: 20,
      routeKind: "teacher_method_review",
      nextSafeAction:
        "Collect a teacher-filled method/profile receipt and prove the selected method improves a later reuse run."
    },
    transparent_mask_2d_perspective_3d_depth_understanding: {
      priority: 30,
      routeKind: "transparent_sketch_depth_review",
      nextSafeAction:
        "Have the teacher review the transparent 2D/perspective/3D depth rehearsal receipt before route follow-up."
    },
    execute_in_target_software_after_confirmation: {
      priority: 40,
      routeKind: "execution_gate_review",
      nextSafeAction:
        "Prepare exactly one teacher-confirmed execution gate with rollback and post-action evidence review."
    }
  };
  return routes[requirementId] || {
    priority: 90,
    routeKind: "unknown_objective_lane",
    nextSafeAction: "Return to the objective audit and correct this unknown requirement row."
  };
}

function buildQueueItems(audit) {
  return (audit.requirements || [])
    .filter((row) => row.provenNow !== true || (row.missingBeforeCompletion || []).length > 0)
    .map((row) => {
      const lane = laneForRequirement(row.id);
      const teacherSelectionReceiptPatch = {
        rowId: row.id,
        teacherDecision: "teacher_selects_next_lane",
        auditRowReviewed: true,
        teacherNote: `Select ${row.id} for review-only follow-up.`
      };
      return {
        id: `objective_fulfillment_next_step_${row.id}`,
        requirementId: row.id,
        requested: row.requested || "",
        currentStatus: row.status || "",
        provenNow: row.provenNow === true,
        priority: lane.priority,
        routeKind: lane.routeKind,
        missingBeforeCompletion: row.missingBeforeCompletion || [],
        nextSafeAction: lane.nextSafeAction,
        teacherSelectionReceiptPatch,
        receiptBuilderCommand: commandLine("create-original-goal-objective-fulfillment-receipt-builder.mjs", [
          ["--audit", audit.sourceAuditPath || ""]
        ]),
        validationCommandTemplate: commandLine("validate-original-goal-objective-fulfillment-receipt.mjs", [
          ["--audit", audit.sourceAuditPath || ""],
          ["--receipt", "<teacher-filled-objective-fulfillment-receipt.json>"]
        ]),
        nextLaneCommandBuilderTemplate: commandLine("create-original-goal-objective-next-lane-command-builder.mjs", [
          ["--validation", "<objective-fulfillment-receipt-validation.json>"]
        ]),
        blockedActions: [
          "claim_goal_complete_from_queue",
          "execute_target_software_from_queue",
          "register_task_from_queue",
          "launch_runner_from_queue",
          "capture_screenshot_from_queue",
          "write_memory_from_queue",
          "enable_rule_from_queue",
          "unlock_packaging_from_queue"
        ]
      };
    })
    .sort((a, b) => a.priority - b.priority || a.requirementId.localeCompare(b.requirementId))
    .map((row, index) => ({ ...row, order: index + 1 }));
}

function writeHtml(path, queue) {
  const rows = queue.queueItems
    .map(
      (item) => `<tr>
        <td>${htmlEscape(item.order)}</td>
        <td>${htmlEscape(item.requirementId)}</td>
        <td>${htmlEscape(item.currentStatus)}</td>
        <td>${htmlEscape(item.routeKind)}</td>
        <td>${htmlEscape(item.nextSafeAction)}</td>
        <td>${htmlEscape(item.missingBeforeCompletion.join("; ") || "none")}</td>
        <td><code>${htmlEscape(item.validationCommandTemplate)}</code><br><code>${htmlEscape(item.nextLaneCommandBuilderTemplate)}</code></td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Original Goal Objective Fulfillment Next-Step Queue</title>
  <style>
    body { margin: 0; font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f8fafc; }
    main { max-width: 1260px; margin: 0 auto; padding: 24px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d8e0ea; }
    th, td { text-align: left; vertical-align: top; border-bottom: 1px solid #e6ebf1; padding: 8px; }
    code { display: block; white-space: pre-wrap; overflow-wrap: anywhere; background: #eef2f7; padding: 4px; border-radius: 5px; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Objective Fulfillment Next-Step Queue</h1>
  <p>Status: <code>${htmlEscape(queue.status)}</code></p>
  <p>Source audit: <a href="${htmlEscape(fileHref(queue.sourceAuditPath))}">${htmlEscape(basename(queue.sourceAuditPath))}</a></p>
  <table>
    <thead><tr><th>#</th><th>Requirement</th><th>Status</th><th>Route</th><th>Next safe action</th><th>Missing before completion</th><th>Command templates</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>`,
    "utf8"
  );
}

function writeReadme(path, queue) {
  const lines = [
    "# Original Goal Objective Fulfillment Next-Step Queue",
    "",
    `Status: ${queue.status}`,
    `Source audit: ${queue.sourceAuditPath}`,
    `Queue items: ${queue.queueItems.length}`,
    "",
    "This queue is generated directly from the objective fulfillment audit. It does not replace teacher selection; it only shows the safest next review lane for each unfinished requirement.",
    "",
    "Recommended order:",
    ...queue.queueItems.map((item) => `- ${item.order}. ${item.requirementId}: ${item.routeKind}; ${item.nextSafeAction}`),
    "",
    "Locks:",
    ...Object.entries(queue.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const auditPath = resolve(argValue("--audit", argValue("--objective-audit", latestAuditPath())));
const audit = readJson(auditPath);
if (audit.format !== "transparent_ai_original_goal_objective_fulfillment_audit_v1") {
  throw new Error("--audit must be transparent_ai_original_goal_objective_fulfillment_audit_v1");
}

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-objective-fulfillment-next-step-queues"))
);
mkdirSync(outputRoot, { recursive: true });
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(audit.auditId || "objective-fulfillment")}`;
const queueDir = join(outputRoot, queueId);
mkdirSync(queueDir, { recursive: true });

const queueItems = buildQueueItems({ ...audit, sourceAuditPath: auditPath });
const queue = {
  ok: true,
  format: "transparent_ai_original_goal_objective_fulfillment_next_step_queue_v1",
  queueId,
  sourceAuditPath: auditPath,
  status: queueItems.length ? "objective_follow_up_queue_ready" : "objective_audit_has_no_follow_up_items",
  completionAllowed: false,
  queueItems,
  counts: {
    queueItems: queueItems.length,
    alreadyProvenRows: (audit.requirements || []).filter((row) => row.provenNow === true).length,
    rowsStillMissingCompletionEvidence: queueItems.length
  },
  locks: locks()
};

const queuePath = join(queueDir, "original-goal-objective-fulfillment-next-step-queue.json");
const htmlPath = join(queueDir, "original-goal-objective-fulfillment-next-step-queue.html");
const readmePath = join(queueDir, "ORIGINAL_GOAL_OBJECTIVE_FULFILLMENT_NEXT_STEP_QUEUE_START_HERE.md");
writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
writeHtml(htmlPath, queue);
writeReadme(readmePath, queue);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_objective_fulfillment_next_step_queue_result_v1",
      queuePath,
      htmlPath,
      readmePath,
      status: queue.status,
      queueItems: queueItems.length,
      completionAllowed: false
    },
    null,
    2
  )
);
