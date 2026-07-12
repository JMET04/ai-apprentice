#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return String(value || "all-software-coverage-repair-queue")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-coverage-repair-queue";
}

function readJsonInput(input, label, optional = false) {
  if (!input) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  const text = String(input).trim();
  if (!text) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  if (existsSync(text)) return { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{") || text.startsWith("[")) return { value: JSON.parse(text), path: "" };
  if (optional) return { value: { reference: text }, path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false,
    memoryWritten: false,
    teacherConfirmationRequired: true
  };
}

function rowId(row, index) {
  return slugify(row.software || row.processName || row.queueItemId || `software-${index + 1}`);
}

function normalizeRow(row = {}, index = 0) {
  return {
    rowId: rowId(row, index),
    software: String(row.software || row.name || row.processName || "unknown software"),
    processName: String(row.processName || ""),
    windowTitle: String(row.windowTitle || ""),
    coverageStatus: String(row.coverageStatus || row.status || "needs_teacher_review_or_manual_signal"),
    routeType: String(row.routeType || ""),
    gaps: Array.isArray(row.gaps) ? row.gaps : [],
    candidateLogFileCount: Number(row.candidateLogFileCount || 0),
    candidateLogRootCount: Number(row.candidateLogRootCount || 0),
    nonLogFallbackSignalCount: Number(row.nonLogFallbackSignalCount || 0),
    watchEvidenceCount: Number(row.watchEvidenceCount || 0),
    queueItemPresent: row.queueItemPresent === true,
    nextRepairCalls: Array.isArray(row.nextRepairCalls) ? row.nextRepairCalls : []
  };
}

function rowsFromInputs(auditInput, repairPlanInput) {
  if (Array.isArray(auditInput.value?.coverageRows)) return auditInput.value.coverageRows.map(normalizeRow);
  if (Array.isArray(repairPlanInput.value?.repairItems)) return repairPlanInput.value.repairItems.map(normalizeRow);
  return [];
}

function isPrivateReviewCandidate(row) {
  const text = `${row.software} ${row.processName} ${row.windowTitle}`.toLowerCase();
  return text.includes("private") || text.includes("unknown") || text.includes("personal") || text.includes("secret");
}

function actionKind(row) {
  if (isPrivateReviewCandidate(row)) return "teacher_exclusion_review";
  if (row.gaps.includes("missing_observer_queue_item") || row.coverageStatus === "inventory_logs_waiting_for_queue") {
    return "promote_inventory_candidate_to_observer_queue";
  }
  if (row.gaps.includes("missing_log_or_non_log_signal") || row.coverageStatus === "needs_teacher_review_or_manual_signal") {
    return "discover_or_request_low_token_signal";
  }
  if (row.coverageStatus.includes("non_log_fallback") && row.watchEvidenceCount === 0) {
    return "validate_non_log_fallback_signal";
  }
  if (row.queueItemPresent && row.watchEvidenceCount === 0) return "run_metadata_delta_gate";
  return "";
}

function priorityFor(row, kind) {
  if (kind === "teacher_exclusion_review") return 10;
  if (row.gaps.includes("missing_log_or_non_log_signal")) return 20;
  if (row.gaps.includes("missing_observer_queue_item")) return 30;
  if (row.coverageStatus === "inventory_logs_waiting_for_queue") return 40;
  if (kind === "validate_non_log_fallback_signal") return 50;
  if (kind === "run_metadata_delta_gate") return 60;
  return 90;
}

function effectiveGapsFor(row, kind) {
  if (Array.isArray(row.gaps) && row.gaps.length > 0) return row.gaps;
  if (kind === "teacher_exclusion_review") return ["teacher_exclusion_review_required_for_private_or_unknown_software"];
  return [];
}

function repairCallsFor(row, kind, auditInput, repairPlanInput, maxRows) {
  const sourceAudit = auditInput.path || "<coverage audit path>";
  const sourceRepairPlan = repairPlanInput.path || "<coverage repair plan path>";
  if (kind === "teacher_exclusion_review") {
    return [
      {
        tool: "teach_apprentice",
        arguments: {
          whatToTeach: `Review whether ${row.software} should be excluded before all-software observation.`,
          message: "Confirm whether this software is private, out of scope, or safe to observe with metadata-only signals."
        }
      }
    ];
  }
  if (kind === "promote_inventory_candidate_to_observer_queue") {
    return [
      {
        tool: "create_software_observer_queue",
        arguments: {
          inventory: "<reviewed inventory path from the audit source>",
          maxCandidates: maxRows
        }
      },
      {
        tool: "watch_log_source_metadata_deltas",
        arguments: {
          queue: "<new reviewed observer queue path>",
          maxItems: 1
        }
      }
    ];
  }
  if (kind === "discover_or_request_low_token_signal") {
    return [
      {
        tool: "create_software_capability_profile",
        arguments: {
          software: row.software,
          processName: row.processName,
          windowTitle: row.windowTitle,
          goal: "Find low-token logs, event sources, export folders, file deltas, or teacher markers before screenshots."
        }
      },
      {
        tool: "create_software_control_channel_probe",
        arguments: {
          software: row.software,
          processName: row.processName,
          windowTitle: row.windowTitle,
          runReadOnlyProbe: false
        }
      },
      {
        tool: "create_universal_software_observer_kit",
        arguments: {
          software: row.software,
          teacherMarkerRequired: true
        }
      }
    ];
  }
  if (kind === "validate_non_log_fallback_signal") {
    return [
      {
        tool: "create_universal_software_observer_kit",
        arguments: {
          software: row.software,
          teacherMarkerRequired: true,
          sourceAudit
        }
      },
      {
        tool: "create_triggered_visual_check_request",
        arguments: {
          deltaMonitor: "<metadata or non-log fallback delta result>",
          maxScreenshots: 1,
          note: "Use only after a meaningful non-log signal changes and the teacher confirms visual grounding is needed."
        }
      }
    ];
  }
  if (kind === "run_metadata_delta_gate") {
    return [
      {
        tool: "watch_log_source_metadata_deltas",
        arguments: {
          queue: "<reviewed observer queue path>",
          maxItems: 1
        }
      }
    ];
  }
  return [
    {
      tool: "teach_apprentice",
      arguments: {
        whatToTeach: `Review coverage repair plan for ${row.software}`,
        message: `Use ${sourceRepairPlan} to decide the next low-token repair action.`
      }
    }
  ];
}

function shouldQueue(row, kind) {
  if (!kind) return false;
  if (row.coverageStatus === "covered_with_log_metadata_route" && !row.gaps.includes("missing_observer_queue_item")) return false;
  if (row.coverageStatus === "covered_with_log_route_and_watch_evidence") return false;
  return true;
}

const auditInput = readJsonInput(argValue("--audit", argValue("--audit-path", "")), "--audit", true);
const repairPlanInput = readJsonInput(argValue("--repair-plan", argValue("--repair-plan-path", "")), "--repair-plan", true);
if (!auditInput.value && !repairPlanInput.value) throw new Error("--audit or --repair-plan is required");

const goal = argValue("--goal", "Turn all-software coverage audit gaps into reviewed repair actions.");
const maxItems = Number(argValue("--max-items", "40"));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-repair-queues")));
mkdirSync(outputRoot, { recursive: true });
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const queueDir = join(outputRoot, queueId);
mkdirSync(queueDir, { recursive: true });

const rows = rowsFromInputs(auditInput, repairPlanInput);
const repairItems = rows
  .map((row, index) => {
    const kind = actionKind(row);
    if (!shouldQueue(row, kind)) return null;
    const priority = priorityFor(row, kind);
    const gaps = effectiveGapsFor(row, kind);
    return {
      repairItemId: `repair-${String(index + 1).padStart(3, "0")}-${row.rowId}`,
      priority,
      actionKind: kind,
      software: row.software,
      processName: row.processName,
      windowTitle: row.windowTitle,
      coverageStatus: row.coverageStatus,
      gaps,
      reviewReason: gaps.join("; "),
      reason:
        kind === "teacher_exclusion_review"
          ? "possible private or unknown software must be reviewed before any observation"
          : kind === "promote_inventory_candidate_to_observer_queue"
            ? "inventory evidence exists but a reviewed observer queue row is missing"
            : kind === "discover_or_request_low_token_signal"
              ? "no reviewed log, event, file-delta, process/window, or teacher-marker signal is available yet"
              : kind === "validate_non_log_fallback_signal"
                ? "non-log fallback exists but still needs teacher-reviewed low-token evidence before screenshots"
                : "reviewed queue exists but the metadata delta gate has not produced evidence yet",
      nextRepairCalls: repairCallsFor(row, kind, auditInput, repairPlanInput, maxItems),
      blockedUntilTeacherReview: true,
      screenshotsAllowedNow: false,
      executionAllowedNow: false,
      locks: locks()
    };
  })
  .filter(Boolean)
  .sort((left, right) => left.priority - right.priority || left.software.localeCompare(right.software))
  .slice(0, maxItems);

const counts = {
  rowsConsidered: rows.length,
  repairItems: repairItems.length,
  teacherExclusionReview: repairItems.filter((item) => item.actionKind === "teacher_exclusion_review").length,
  missingLowTokenSignal: repairItems.filter((item) => item.actionKind === "discover_or_request_low_token_signal").length,
  missingObserverQueueItem: repairItems.filter((item) => item.actionKind === "promote_inventory_candidate_to_observer_queue").length,
  nonLogFallbackNeedsValidation: repairItems.filter((item) => item.actionKind === "validate_non_log_fallback_signal").length,
  metadataGateNeeded: repairItems.filter((item) => item.actionKind === "run_metadata_delta_gate").length
};

const queuePath = join(queueDir, "all-software-coverage-repair-queue.json");
const receiptTemplatePath = join(queueDir, "all-software-coverage-repair-queue-receipt-template.json");
const readmePath = join(queueDir, "ALL_SOFTWARE_COVERAGE_REPAIR_QUEUE_START_HERE.md");

const queue = {
  format: "transparent_ai_all_software_coverage_repair_queue_v1",
  queueId,
  createdAt: new Date().toISOString(),
  goal,
  sourceEvidence: {
    auditPath: auditInput.path,
    auditFormat: auditInput.value?.format || "",
    repairPlanPath: repairPlanInput.path,
    repairPlanFormat: repairPlanInput.value?.format || ""
  },
  counts,
  repairItems,
  policy: {
    onlyGapsQueued: true,
    logMetadataBeforeTailRead: true,
    nonLogFallbackBeforeScreenshots: true,
    teacherExclusionReviewBeforePrivateSoftwareObservation: true,
    visualCheckOnlyAfterMeaningfulSignal: true,
    maxScreenshotsPerTriggeredCheck: 1
  },
  blockedActions: [
    "claim_all_software_covered_from_repair_queue",
    "read_full_logs_by_default",
    "start_continuous_recording",
    "capture_screenshot_without_trigger",
    "execute_software",
    "write_memory_from_repair_queue",
    "enable_rules",
    "unlock_packaging"
  ],
  locks: locks()
};

const receiptTemplate = {
  format: "transparent_ai_all_software_coverage_repair_queue_receipt_template_v1",
  queueId,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: ["needs_teacher_review", "excluded_by_teacher", "ready_for_follow_up", "blocked"],
  blockedDecisions: ["accepted", "rule_enabled", "packaging_unlocked"],
  rows: repairItems.map((item) => ({
    repairItemId: item.repairItemId,
    software: item.software,
    actionKind: item.actionKind,
    reviewerDecision: "needs_teacher_review",
    observedEvidencePath: "",
    blockerQuestion: "",
    nextReviewNote: "",
    ruleEnabled: false,
    accepted: false,
    packagingGated: true
  })),
  locks: locks()
};

writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# All Software Coverage Repair Queue",
    "",
    `Queued repair items: ${counts.repairItems}`,
    "",
    "Review order:",
    "1. Exclude private or out-of-scope software first.",
    "2. Promote inventory log candidates into a reviewed observer queue.",
    "3. For missing signals, run a capability profile or control-channel probe before asking for screenshots.",
    "4. Validate non-log fallback signals with teacher markers or metadata deltas.",
    "5. Request a visual check only after a meaningful low-token signal changes.",
    "",
    "This queue reads only coverage audit or repair-plan JSON. It does not read logs, capture screenshots, execute software, write memory, enable rules, accept coverage, or unlock packaging."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_repair_queue_result_v1",
      queueId,
      status: counts.repairItems > 0 ? "coverage_repair_items_waiting_for_teacher_review" : "no_coverage_repair_items_detected",
      queuePath,
      receiptTemplatePath,
      readme: readmePath,
      counts,
      logContentsRead: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      memoryWritten: false,
      reviewLocks: locks()
    },
    null,
    2
  )
);
