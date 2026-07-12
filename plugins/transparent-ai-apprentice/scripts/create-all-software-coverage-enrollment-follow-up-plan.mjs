#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return String(value || "all-software-coverage-enrollment-follow-up-plan")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-coverage-enrollment-follow-up-plan";
}

function readJsonInput(input, label) {
  if (!input) throw new Error(`${label} is required`);
  const text = String(input).trim();
  if (existsSync(text)) return { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    allSoftwareCoverageComplete: false,
    teacherAcceptanceRequired: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    screenshotsCapturedByThisTool: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    scheduledTaskInstalled: false,
    nativeUniversalExecution: false
  };
}

function firstToolAction(nextActions = [], toolName) {
  return nextActions.find((item) => item && typeof item === "object" && item.tool === toolName) || null;
}

function hasPlaceholder(value) {
  return typeof value === "string" && /<[^>]+>/.test(value);
}

function resolveReviewedPath(value, fallback) {
  const text = String(value || "").trim();
  if (text && !hasPlaceholder(text)) return text;
  return fallback || text;
}

function resolvedToolArguments(action, ledger) {
  if (!action || typeof action !== "object") return null;
  const args = { ...(action?.arguments || {}) };
  if ("queue" in args) {
    args.queue = resolveReviewedPath(args.queue, ledger.sourceEvidence?.queuePath || "");
  }
  if ("inventory" in args) {
    args.inventory = resolveReviewedPath(args.inventory, ledger.sourceEvidence?.inventoryPath || "");
  }
  if ("coverageAudit" in args || "coverageAuditPath" in args) {
    const key = "coverageAudit" in args ? "coverageAudit" : "coverageAuditPath";
    args[key] = resolveReviewedPath(args[key], ledger.sourceEvidence?.coverageAuditPath || "");
  }
  return args;
}

function actionForRow(row, ledger) {
  const status = String(row.status || "");
  const nextActions = Array.isArray(row.nextActions) ? row.nextActions : [];
  const software = row.software || "unknown software";
  if (status === "teacher_excluded_or_private") {
    return {
      route: "preserve_teacher_exclusion",
      priority: 90,
      instruction: "Keep this software excluded unless the teacher changes scope.",
      tool: "none_review_only",
      arguments: {},
      expectedEvidence: "teacher exclusion remains present in the next ledger"
    };
  }
  if (row.readyForTeacherCoverageReview || status.endsWith("_with_watch_evidence")) {
    return {
      route: "teacher_review_coverage_receipt",
      priority: 80,
      instruction: "Review this row with the teacher before treating it as covered.",
      tool: "review_teaching_session",
      arguments: { note: `Review low-token coverage evidence for ${software}` },
      expectedEvidence: "teacher reviewed row and either accepted evidence or requested correction"
    };
  }
  if (status.includes("waiting_for_watch_evidence")) {
    const metadataAction = firstToolAction(nextActions, "watch_log_source_metadata_deltas");
    const queueItemAction = firstToolAction(nextActions, "run_software_observer_queue_item");
    return {
      route: "collect_watch_or_queue_item_evidence",
      priority: 30,
      instruction: "Run a metadata gate or one reviewed queue item to produce low-token watch evidence.",
      tool: "watch_log_source_metadata_deltas",
      arguments:
        resolvedToolArguments(metadataAction || queueItemAction, ledger) ||
        { queue: ledger.sourceEvidence?.queuePath || "<queue path>", item: row.software },
      fallbackTool: "run_software_observer_queue_item",
      expectedEvidence: "watch-cycle, queue-item receipt, or compact learning event for this software"
    };
  }
  if (status === "inventory_signal_waiting_for_queue_enrollment") {
    const queueAction = firstToolAction(nextActions, "create_software_observer_queue");
    return {
      route: "promote_inventory_row_to_observer_queue",
      priority: 20,
      instruction: "Create or extend an observer queue so this inventory row has concrete low-token next calls.",
      tool: "create_software_observer_queue",
      arguments:
        resolvedToolArguments(queueAction, ledger) ||
        { inventory: ledger.sourceEvidence?.inventoryPath || "<inventory path>" },
      expectedEvidence: "observer queue item appears for this software in the next enrollment ledger"
    };
  }
  return {
    route: "ask_teacher_for_signal_or_exclusion",
    priority: 10,
    instruction: "Ask the teacher for a log path, export folder, event source, manual marker, or explicit exclusion.",
    tool: "teach_apprentice",
    arguments:
      firstToolAction(nextActions, "teach_apprentice")?.arguments || {
        whatToTeach: `Need a low-token signal or exclusion for ${software}`,
        message: "Please choose a log path, export folder, Windows Event source, manual marker, or mark this software private/out of scope."
      },
    expectedEvidence: "teacher supplied low-token signal or explicit exclusion"
  };
}

const ledgerInput = readJsonInput(argValue("--ledger", argValue("--enrollment-ledger", "")), "--ledger");
const ledger = ledgerInput.value;
if (ledger.format !== "transparent_ai_all_software_coverage_enrollment_ledger_v1") {
  throw new Error("Expected transparent_ai_all_software_coverage_enrollment_ledger_v1");
}

const goal = argValue("--goal", "Plan the next low-token follow-up actions from an all-software coverage enrollment ledger.");
const maxItems = Number(argValue("--max-items", "80"));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-plans")));
mkdirSync(outputRoot, { recursive: true });
const planId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const planDir = join(outputRoot, planId);
mkdirSync(planDir, { recursive: true });

const sourceRows = Array.isArray(ledger.rows) ? ledger.rows : [];
const rowsNeedingWork = sourceRows
  .filter((row) => !(row.readyForTeacherCoverageReview || row.teacherExcluded))
  .slice(0, maxItems);
const followUpItems = rowsNeedingWork.map((row, index) => {
  const action = actionForRow(row, ledger);
  return {
    followUpId: `enrollment-follow-up-${String(index + 1).padStart(3, "0")}`,
    ledgerNumber: row.ledgerNumber,
    software: row.software,
    processName: row.processName,
    status: row.status,
    route: action.route,
    priority: action.priority,
    instruction: action.instruction,
    tool: action.tool,
    fallbackTool: action.fallbackTool || "",
    arguments: action.arguments,
    expectedEvidence: action.expectedEvidence,
    stopIf: [
      "teacher marks the software private or out of scope",
      "the suggested evidence source is missing or ambiguous",
      "the route would require screenshots, software execution, memory write, or scheduled task registration"
    ],
    locks: locks()
  };
}).sort((left, right) => left.priority - right.priority || left.followUpId.localeCompare(right.followUpId));

const routeCounts = followUpItems.reduce((counts, item) => {
  counts[item.route] = (counts[item.route] || 0) + 1;
  return counts;
}, {});
const reviewScope = {
  scopeKind: ledger.subsetPurpose ? "teacher_reviewed_subset_ledger" : "full_enrollment_ledger",
  sourceLedgerPath: ledger.sourceLedgerPath || "",
  currentLedgerPath: ledgerInput.path,
  subsetPurpose: ledger.subsetPurpose || "",
  reviewedFollowUpRows: Number(ledger.counts?.reviewedFollowUpRows || 0),
  unreviewedRowsExcluded: Number(ledger.counts?.unreviewedRowsExcluded || 0),
  requiresTeacherReviewedSubset:
    ledger.subsetPurpose
      ? false
      : "Use the original-goal low-token coverage dossier receipt validation to create a reviewed subset ledger before running focused follow-up."
};

const planPath = join(planDir, "all-software-coverage-enrollment-follow-up-plan.json");
const receiptPath = join(planDir, "all-software-coverage-enrollment-follow-up-plan-receipt.json");
const readmePath = join(planDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_START_HERE.md");

const plan = {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
  planId,
  createdAt: new Date().toISOString(),
  goal,
  sourceLedgerPath: ledgerInput.path,
  sourceLedgerId: ledger.ledgerId || "",
  sourceCounts: ledger.counts || {},
  reviewScope,
  followUpItems,
  routeCounts,
  counts: {
    sourceRows: sourceRows.length,
    sourceNextReviewQueue: Array.isArray(ledger.nextReviewQueue) ? ledger.nextReviewQueue.length : 0,
    followUpItems: followUpItems.length,
    readyRowsSkipped: sourceRows.filter((row) => row.readyForTeacherCoverageReview).length,
    teacherExcludedRowsSkipped: sourceRows.filter((row) => row.teacherExcluded).length
  },
  nextLedgerCommand:
    `node plugins/transparent-ai-apprentice/scripts/create-all-software-coverage-enrollment-ledger.mjs --inventory "${ledger.sourceEvidence?.inventoryPath || "<inventory path>"}" --queue "${ledger.sourceEvidence?.queuePath || "<queue path>"}" --coverage-audit "${ledger.sourceEvidence?.coverageAuditPath || "<coverage audit path>"}"`,
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    reason: "This plan only turns ledger gaps into next actions; it does not run them or prove every installed app is covered.",
    requiredBeforeCompletion: [
      "run or review each follow-up item",
      "rerun coverage audit and enrollment ledger after new evidence",
      "record teacher exclusions for private/out-of-scope rows",
      "review final ledger receipt before any coverage claim",
      "native semantic control remains a separate proof requirement"
    ]
  },
  locks: locks()
};

const receipt = {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_receipt_v1",
  planId,
  planPath,
  sourceLedgerPath: ledgerInput.path,
  reviewScope,
  routeCounts,
  followUpItemCount: followUpItems.length,
  allSoftwareCoverageComplete: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  logContentsRead: false,
  fileContentsRead: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  scheduledTaskInstalled: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: locks()
};

writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# All-Software Coverage Enrollment Follow-Up",
    "",
    `Ledger: ${ledgerInput.path}`,
    reviewScope.scopeKind === "teacher_reviewed_subset_ledger"
      ? `Review scope: teacher-reviewed subset; source ledger: ${reviewScope.sourceLedgerPath || "not supplied"}; reviewed rows: ${reviewScope.reviewedFollowUpRows}; unreviewed rows excluded: ${reviewScope.unreviewedRowsExcluded}`
      : "Review scope: full enrollment ledger; use a teacher-reviewed subset ledger for focused original-goal follow-up when available.",
    "",
    "This plan converts incomplete enrollment ledger rows into the next lowest-token action.",
    "",
    "Review order:",
    "",
    "1. Rows needing teacher signal/exclusion.",
    "2. Rows waiting for queue enrollment.",
    "3. Rows waiting for metadata/watch evidence.",
    "4. Rerun coverage audit and enrollment ledger after evidence is collected.",
    "",
    "Locked defaults: no screenshots, no full log reads, no software execution, no memory writes, no scheduled task registration, no native universal execution, no acceptance, no packaging unlock."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_result_v1",
      planId,
      planPath,
      receiptPath,
      teacherReadme: readmePath,
      followUpItemCount: followUpItems.length,
      routeCounts,
      reviewScope,
      allSoftwareCoverageComplete: false,
      screenshotsCapturedByThisTool: false,
      logContentsRead: false,
      softwareActionsExecuted: false,
      scheduledTaskInstalled: false,
      memoryWritten: false,
      nativeUniversalExecution: false,
      locks: locks()
    },
    null,
    2
  )
);
