#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-unlock-action-package")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-unlock-action-package"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function latestStatusRefreshPath(root) {
  const refreshRoot = join(root, ".transparent-apprentice", "original-goal-current-status-refreshes");
  if (!existsSync(refreshRoot)) return "";
  const candidates = readdirSync(refreshRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(refreshRoot, entry.name);
      const path = join(dir, "original-goal-current-status-refresh.json");
      return existsSync(path) ? { path, mtimeMs: statSync(path).mtimeMs } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.path || "";
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

function evidence(path, label = "") {
  const value = String(path || "");
  if (!value) {
    return { label, kind: "missing", value: "", exists: false, basename: "" };
  }
  if (value.trim().startsWith("node ") || value.includes("<teacher-filled")) {
    return { label, kind: "command_template", value, exists: false, basename: "" };
  }
  return {
    label,
    kind: existsSync(value) ? "existing_file" : "missing_file",
    value,
    exists: existsSync(value),
    basename: existsSync(value) ? basename(value) : ""
  };
}

function commandRisk(command) {
  const lower = String(command || "").toLowerCase();
  const highRiskMarkers = [
    "--execute-approved-gate",
    "--execute-approved-registration",
    "--allow-system-change",
    "--allow-runner-trigger",
    "--teacher-confirmation",
    "--teacher-confirmed",
    "capture-triggered-visual-check.mjs",
    "run-all-software-execution-approved-gate-runner.mjs",
    "run-all-software-operational-learning-registration-approved-runner.mjs",
    "register-scheduledtask",
    "schtasks /create"
  ];
  const placeholders = Array.from(new Set(lower.match(/<[^<>]+>/g) || []));
  const matchedHighRiskMarkers = highRiskMarkers.filter((marker) => lower.includes(marker));
  return {
    hasPlaceholders: placeholders.length > 0,
    placeholders,
    matchedHighRiskMarkers,
    reviewOnlySafeToCopy: matchedHighRiskMarkers.length === 0
  };
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packageDoesNotValidateReceipts: true,
    packageDoesNotRunCommands: true,
    packageDoesNotRegisterTask: true,
    packageDoesNotLaunchRunner: true,
    packageDoesNotExecuteTargetSoftware: true,
    packageDoesNotCaptureScreenshots: true,
    packageDoesNotReadFullLogs: true,
    packageDoesNotWriteMemory: true,
    packageDoesNotEnableRules: true,
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

function itemStatus(item) {
  if (item.proven === true) return "evidence_present_review_only";
  if (item.risk?.matchedHighRiskMarkers?.length > 0) return "gated_until_teacher_receipt_and_rollback";
  if (item.risk?.hasPlaceholders) return "waiting_for_teacher_filled_receipt";
  return "ready_for_teacher_review_entry";
}

function buildActionItems(refresh, refreshPath) {
  const paths = refresh.paths || {};
  const evidenceState = refresh.refreshedEvidence || {};
  const sharedLocks = locks();

  const items = [
    {
      id: "teacher_method_contract_review",
      order: 1,
      lane: "adapt_to_any_teacher_method",
      title: "Review the teacher-method execution learning contract",
      requirement:
        "Confirm that teacher methods route into low-token metadata-first learning, overlay spatial intent, correction examples, and high-to-medium reasoning reuse.",
      proven:
        evidenceState.teacherMethodContractLowTokenMetadataFirst === true &&
        evidenceState.teacherMethodContractTransparentOverlaySpatialIntent === true &&
        evidenceState.teacherMethodContractCorrectionBoundaryCounterexample === true &&
        evidenceState.teacherMethodContractHighToMediumModelTierPolicy === true,
      currentEvidence: `status=${evidenceState.teacherMethodExecutionLearningContractStatus || ""}; routes=${
        evidenceState.teacherMethodExecutionLearningContractRouteCount ?? ""
      }`,
      nextSafeAction: "Open the contract and have the teacher confirm or correct the route assumptions before any rule is enabled.",
      evidence: [
        evidence(paths.teacherMethodExecutionLearningContract, "teacher method contract"),
        evidence(paths.teacherMethodExecutionLearningContractCommandTemplate, "regenerate contract command")
      ],
      validationCommand: paths.teacherMethodExecutionLearningContractCommandTemplate || "",
      blockedClaims: ["enable_teacher_method_rule_without_review", "claim_adapts_to_any_teacher_without_contract_review"],
      locks: sharedLocks
    },
    {
      id: "low_token_waiting_rows_review",
      order: 2,
      lane: "all_software_low_token_coverage",
      title: "Resolve the remaining low-token coverage waiting rows",
      requirement:
        "Every in-scope software row needs teacher-reviewed compact log/state coverage, a metadata route, or a documented fallback route.",
      proven: Number(evidenceState.originalGoalLowTokenCoverageWaitingRows || 0) === 0,
      currentEvidence: `ledgerRows=${evidenceState.originalGoalLowTokenCoverageLedgerRows ?? ""}; waitingRows=${
        evidenceState.originalGoalLowTokenCoverageWaitingRows ?? ""
      }; fallbackRoutes=${evidenceState.originalGoalLowTokenFallbackRouteEvidencePackCandidateRoutes ?? ""}`,
      nextSafeAction:
        "Use the waiting-row cockpit receipt template to review rows one by one, then run its validation command.",
      evidence: [
        evidence(paths.originalGoalLowTokenCoverageWaitingRowCockpit, "waiting-row cockpit"),
        evidence(paths.originalGoalLowTokenCoverageWaitingRowCockpitHtml, "waiting-row cockpit html"),
        evidence(paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate, "teacher receipt template"),
        evidence(
          paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate,
          "receipt validation command"
        )
      ],
      validationCommand: paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate || "",
      blockedClaims: ["claim_all_software_low_token_coverage_complete", "read_full_logs_or_run_metadata_gate_without_teacher"],
      locks: sharedLocks
    },
    {
      id: "transparent_sketch_spatial_evidence_review",
      order: 3,
      lane: "transparent_overlay_2d_perspective_3d_depth",
      title: "Turn transparent sketch rehearsal into teacher-reviewed spatial evidence",
      requirement:
        "The teacher must confirm the 2D, perspective, and 3D-depth interpretation with numbered spatial targets before software execution.",
      proven: evidenceState.formalSpatialIntentEvidencePresent === true,
      currentEvidence: `implemented=${evidenceState.transparentSketch2DPerspective3DImplemented === true}; formalEvidence=${
        evidenceState.formalSpatialIntentEvidencePresent === true
      }; spatialValidation=${evidenceState.spatialIntentEvidenceReceiptValidationStatus || ""}`,
      nextSafeAction:
        "Open the transparent-sketch rehearsal, fill the review receipt with teacher-confirmed numbered spatial targets, then validate it.",
      evidence: [
        evidence(paths.transparentSketchDepthDemonstrationRehearsal, "transparent sketch rehearsal"),
        evidence(paths.transparentSketchDepthDemonstrationRehearsalHtml, "transparent sketch rehearsal html"),
        evidence(paths.transparentSketchDepthRehearsalReviewReceiptTemplate, "teacher review receipt template"),
        evidence(paths.transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate, "review validation command"),
        evidence(paths.spatialIntentEvidenceReceiptBuilder, "formal spatial evidence receipt builder"),
        evidence(paths.spatialIntentEvidenceReceiptValidation, "latest spatial receipt validation")
      ],
      validationCommand: paths.transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate || "",
      blockedClaims: [
        "claim_spatial_intent_understood_without_teacher_export",
        "execute_software_from_unconfirmed_overlay_target"
      ],
      locks: sharedLocks
    },
    {
      id: "unattended_monitor_teacher_confirmation",
      order: 4,
      lane: "low_token_unattended_monitoring",
      title: "Confirm the unattended low-token monitor path",
      requirement:
        "Recurring monitor registration and output witness must be teacher-approved before unattended learning can be claimed.",
      proven: evidenceState.unattendedAllAppMonitoringComplete === true,
      currentEvidence: `remainingGaps=${evidenceState.allSoftwareUnattendedLearningAuditRemainingGaps ?? ""}; status=${
        evidenceState.allSoftwareUnattendedLearningAuditStatus || ""
      }`,
      nextSafeAction:
        "Review the recurring-monitor confirmation package and validate the teacher-filled confirmation receipt before any scheduled task registration.",
      evidence: [
        evidence(paths.allSoftwareUnattendedLearningAudit, "unattended audit"),
        evidence(paths.recurringMonitorTeacherConfirmationPackage, "teacher confirmation package"),
        evidence(paths.recurringMonitorTeacherConfirmationPackageHtml, "teacher confirmation html"),
        evidence(paths.recurringMonitorTeacherConfirmationReceiptValidationCommandTemplate, "confirmation validation command")
      ],
      validationCommand: paths.recurringMonitorTeacherConfirmationReceiptValidationCommandTemplate || "",
      blockedClaims: ["register_monitor_without_teacher_receipt", "claim_unattended_learning_operational"],
      locks: sharedLocks
    },
    {
      id: "native_execution_control_channel_gate",
      order: 5,
      lane: "universal_native_execution_control_channel",
      title: "Advance one real-software execution gap through review before any native action",
      requirement:
        "At least one representative target software action must pass control-channel, action-logic, approval-gate, and outcome verification.",
      proven: refresh.locks?.nativeUniversalExecution === true,
      currentEvidence: `nativeUniversalExecution=${refresh.locks?.nativeUniversalExecution === true}; executionRowsWithBothReviews=${
        evidenceState.executionGapReviewCockpitRowsWithBothReviews ?? ""
      }; remainingGaps=${Array.isArray(evidenceState.executionCapabilityConvergenceRemainingGaps) ? evidenceState.executionCapabilityConvergenceRemainingGaps.length : ""}`,
      nextSafeAction:
        "Use the execution-gap cockpit to select one row, validate the receipt, create the handoff queue, and only then prepare an approved gate.",
      evidence: [
        evidence(paths.executionGapReviewCockpit, "execution gap cockpit"),
        evidence(paths.executionGapReviewCockpitHtml, "execution gap cockpit html"),
        evidence(paths.executionGapReviewCockpitReceiptTemplate, "execution gap receipt template"),
        evidence(paths.executionGapReviewCockpitReceiptValidationCommandTemplate, "execution gap receipt validation command"),
        evidence(paths.executionApprovedGateRunnerCommandTemplate, "approved execution runner command")
      ],
      validationCommand: paths.executionGapReviewCockpitReceiptValidationCommandTemplate || "",
      blockedClaims: ["execute_target_software_without_teacher_gate", "claim_universal_native_execution"],
      locks: sharedLocks
    }
  ];

  return items.map((item) => {
    const risk = commandRisk(
      [
        item.validationCommand,
        ...item.evidence
          .filter((entry) => entry.kind === "command_template")
          .map((entry) => entry.value)
      ].join(" ")
    );
    const merged = { ...item, risk };
    return {
      ...merged,
      status: itemStatus(merged),
      sourceStatusRefresh: refreshPath
    };
  });
}

function writeHtml(path, packet) {
  const rows = packet.actionItems
    .map((item) => {
      const links = item.evidence
        .map((link) => {
          if (link.kind === "existing_file") {
            return `<a href="${htmlEscape(fileHref(link.value))}">${htmlEscape(link.label || link.basename)}</a>`;
          }
          return `<code>${htmlEscape(link.label ? `${link.label}: ${link.value}` : link.value)}</code>`;
        })
        .join("<br>");
      return `<tr>
        <td>${htmlEscape(item.order)}</td>
        <td>${htmlEscape(item.lane)}</td>
        <td>${htmlEscape(item.status)}</td>
        <td>${htmlEscape(item.currentEvidence)}</td>
        <td>${htmlEscape(item.nextSafeAction)}</td>
        <td>${links}</td>
        <td><code>${htmlEscape(item.validationCommand)}</code></td>
        <td>${htmlEscape(item.blockedClaims.join(", "))}</td>
      </tr>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Unlock Action Package</title>
  <style>
    :root { color: #17202a; background: #f7f9fc; font: 14px/1.45 "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1280px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 27px; letter-spacing: 0; }
    .summary, table { background: #fff; border: 1px solid #dbe4ef; border-radius: 8px; }
    .summary { padding: 15px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { border-bottom: 1px solid #e3eaf3; padding: 9px; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #edf4f8; }
    code { display: inline-block; max-width: 100%; background: #eef3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Unlock Action Package</h1>
  <section class="summary">
    <p><strong>Status:</strong> ${htmlEscape(packet.status)}</p>
    <p><strong>Decision:</strong> ${htmlEscape(packet.completionDecision)}</p>
    <p><strong>Source refresh:</strong> <a href="${htmlEscape(fileHref(packet.sourceEvidence.statusRefresh))}">${htmlEscape(packet.sourceEvidence.statusRefresh)}</a></p>
    <p>This package is a compact, review-only action order. It does not validate receipts, run commands, register tasks, launch runners, capture screenshots, write memory, execute target software, enable rules, unlock packaging, or claim completion.</p>
  </section>
  <table>
    <thead><tr><th>#</th><th>Lane</th><th>Status</th><th>Current evidence</th><th>Next safe action</th><th>Evidence</th><th>Validation command</th><th>Blocked claims</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, packet) {
  const lines = [
    "# Original Goal Unlock Action Package",
    "",
    `Status: ${packet.status}`,
    `Decision: ${packet.completionDecision}`,
    `Items: ${packet.counts.actionItems}`,
    "",
    "Use this as the shortest next-review route toward the full original goal.",
    "",
    "Order:",
    ...packet.actionItems.map((item) => `- ${item.order}. ${item.title}: ${item.status}`),
    "",
    "Locks:",
    ...Object.entries(packet.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const refreshInput = argValue("--refresh", "");
const refreshPath = refreshInput ? resolve(refreshInput) : latestStatusRefreshPath(process.cwd());
if (!refreshPath || !existsSync(refreshPath)) {
  throw new Error(
    "Usage: node create-original-goal-unlock-action-package.mjs --refresh <original-goal-current-status-refresh.json>"
  );
}

const refresh = readJson(refreshPath);
if (refresh.format !== "transparent_ai_original_goal_current_status_refresh_v1") {
  throw new Error("--refresh must be transparent_ai_original_goal_current_status_refresh_v1");
}

const goal = argValue("--goal", refresh.goal || "Original goal unlock action package.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-unlock-action-packages"))
);
const packageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packageDir = join(outputRoot, packageId);
mkdirSync(packageDir, { recursive: true });

const actionItems = buildActionItems(refresh, refreshPath);
const provenItems = actionItems.filter((item) => item.proven === true).length;
const gatedItems = actionItems.filter((item) => item.status === "gated_until_teacher_receipt_and_rollback").length;
const waitingItems = actionItems.filter((item) => item.status === "waiting_for_teacher_filled_receipt").length;
const missingEvidenceLinks = actionItems.flatMap((item) => item.evidence).filter((link) => link.kind === "missing_file").length;
const sharedLocks = locks();

const packagePath = join(packageDir, "original-goal-unlock-action-package.json");
const htmlPath = join(packageDir, "original-goal-unlock-action-package.html");
const readmePath = join(packageDir, "ORIGINAL_GOAL_UNLOCK_ACTION_PACKAGE_START_HERE.md");
const completionDecision =
  refresh.completionDecision ||
  refresh.refreshedEvidence?.readinessCompletionDecision ||
  "not_complete_full_objective_because_reviewed_evidence_is_still_missing";

const packet = {
  ok: true,
  format: "transparent_ai_original_goal_unlock_action_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_reviewed_unlock_actions",
  completionDecision,
  purpose:
    "Compress the remaining original-goal blockers into one ordered, review-only action package for low-token teacher or agent follow-up.",
  sourceEvidence: {
    statusRefresh: refreshPath,
    statusDashboard: refresh.paths?.currentStatusDashboardHtml || ""
  },
  counts: {
    actionItems: actionItems.length,
    provenReviewOnlyItems: provenItems,
    waitingForTeacherReceiptItems: waitingItems,
    gatedUntilTeacherReceiptAndRollbackItems: gatedItems,
    missingEvidenceLinks
  },
  actionItems,
  blockedClaims: [
    "claim_original_goal_complete_from_unlock_action_package",
    "claim_all_software_low_token_coverage_complete_from_unlock_action_package",
    "claim_formal_spatial_intent_evidence_from_unlock_action_package",
    "claim_unattended_learning_operational_from_unlock_action_package",
    "claim_universal_native_execution_from_unlock_action_package",
    "enable_rules_from_unlock_action_package",
    "write_memory_from_unlock_action_package",
    "unlock_packaging_from_unlock_action_package"
  ],
  paths: {
    package: packagePath,
    html: htmlPath,
    readme: readmePath
  },
  locks: sharedLocks
};

writeFileSync(packagePath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeHtml(htmlPath, packet);
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_unlock_action_package_result_v1",
      packageId,
      status: packet.status,
      completionDecision,
      packagePath,
      htmlPath,
      readmePath,
      counts: packet.counts,
      locks: sharedLocks
    },
    null,
    2
  )
);
