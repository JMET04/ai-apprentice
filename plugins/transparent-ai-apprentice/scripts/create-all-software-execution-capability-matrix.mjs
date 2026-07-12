#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJsonInput(input) {
  if (!input) return null;
  const text = String(input).trim();
  if (!text) return null;
  if (existsSync(text)) return JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, ""));
  if (text.startsWith("{")) return JSON.parse(text);
  return null;
}

function sourcePath(input) {
  const text = String(input || "").trim();
  if (!text) return "";
  return existsSync(text) ? resolve(text) : text;
}
function slugify(value) {
  return (
    String(value || "execution-capability-matrix")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-capability-matrix"
  );
}

function safeText(value, fallback = "") {
  return String(value ?? fallback ?? "").trim();
}

function softwareKey(row = {}) {
  const softwareIdentity = safeText(
    row.software || row.softwareName || row.name || row.displayName || row.processName || row.softwareId,
    "software"
  );
  return [
    softwareIdentity.toLowerCase(),
    safeText(row.softwareId).toLowerCase(),
    safeText(row.executableName).toLowerCase(),
    safeText(row.processName).toLowerCase(),
    safeText(row.windowTitle).toLowerCase()
  ].join("|");
}

function softwareDisplayName(row = {}) {
  return safeText(row.software || row.softwareName || row.name || row.displayName || row.processName || row.softwareId, "software");
}

function sourceRows(source) {
  if (!source) return [];
  if (Array.isArray(source.softwareCandidates)) return source.softwareCandidates;
  if (Array.isArray(source.queue)) return source.queue;
  if (Array.isArray(source.rows)) return source.rows;
  if (Array.isArray(source.pilots)) return source.pilots;
  return [];
}

function logCount(row = {}) {
  if (Array.isArray(row.candidateLogFiles)) return row.candidateLogFiles.length;
  if (Array.isArray(row.recentLogCandidates)) return row.recentLogCandidates.length;
  return Number(row.candidateLogFileCount || row.logRouteCount || 0);
}

function eventCount(row = {}) {
  if (Array.isArray(row.windowsEventLogs)) return row.windowsEventLogs.length;
  return Number(row.windowsEventLogCount || 0);
}

function nextLaneFor(row) {
  if (row.dryRunPilotReady) return "review_and_run_one_dry_run_pilot";
  if (row.controlStatus === "structured_control_route_reviewable") return "confirm_numbered_target_or_exact_route";
  if (row.controlStatus === "supervised_ui_fallback_reviewable") return "confirm_visible_window_and_numbered_target";
  if (row.lowTokenObservationReady) return "collect_control_channel_evidence";
  return "ask_teacher_for_signal_or_exclusion";
}

function readinessFor(row) {
  if (row.dryRunPilotReady) return "dry_run_pilot_package_ready";
  if (["structured_control_route_reviewable", "supervised_ui_fallback_reviewable"].includes(row.controlStatus)) {
    return "control_route_reviewable_before_pilot";
  }
  if (row.lowTokenObservationReady) return "observation_ready_control_evidence_missing";
  return "needs_teacher_signal_or_control_evidence";
}

function actionLogicSourceStatusFor(row) {
  if (row.actionLogicSourceContract?.unbackedActionDetailsBlocked === true) return "logic_source_contract_ready_for_review";
  if (
    row.actionLogicSourceContract?.format === "transparent_ai_action_logic_source_contract_v1" &&
    row.actionLogicSourceContract?.highReasoningCompiled === true &&
    row.actionLogicSourceContract?.mediumRuntimeAllowed === false &&
    row.actionLogicSourceContract?.ragEvidenceRole === "evidence_only_not_authority"
  ) {
    return "logic_source_contract_ready_for_review";
  }
  if (row.dryRunPilotReady) return "pilot_package_missing_explicit_logic_source_review";
  if (["structured_control_route_reviewable", "supervised_ui_fallback_reviewable"].includes(row.controlStatus)) {
    return "control_route_needs_action_logic_source_contract";
  }
  if (row.lowTokenObservationReady) return "observation_ready_but_action_logic_source_missing";
  return "teacher_signal_needed_before_action_logic_source";
}

function statusFor(pass, readyLabel, missingLabel) {
  return pass ? readyLabel : missingLabel;
}

function buildEvidenceChain(row) {
  const lowTokenEvidenceReady = row.lowTokenObservationReady === true;
  const structuredControlReady = row.controlStatus === "structured_control_route_reviewable";
  const supervisedUiFallbackReady = row.controlStatus === "supervised_ui_fallback_reviewable";
  const controlEvidenceReady = structuredControlReady || supervisedUiFallbackReady;
  const dryRunPilotReady = row.dryRunPilotReady === true;
  const logicSourceReady = row.actionLogicSourceStatus === "logic_source_contract_ready_for_review";
  const numberedTargetReady = dryRunPilotReady && supervisedUiFallbackReady === false;
  const routeOnlyTargetReady = dryRunPilotReady && structuredControlReady === true;
  const rollbackEvidenceReady = Boolean(row.readinessEvidencePath);
  const beforeExecuteMissing = [];

  if (!lowTokenEvidenceReady) beforeExecuteMissing.push("low_token_observation_signal_or_teacher_exclusion");
  if (!controlEvidenceReady) beforeExecuteMissing.push("control_channel_route_or_visible_window_evidence");
  if (!logicSourceReady) beforeExecuteMissing.push("reviewed_action_logic_source_contract");
  if (!dryRunPilotReady) beforeExecuteMissing.push("dry_run_pilot_package");
  if (!numberedTargetReady && !routeOnlyTargetReady) beforeExecuteMissing.push("teacher_confirmed_numbered_target_or_exact_route");
  if (!rollbackEvidenceReady) beforeExecuteMissing.push("retained_rollback_or_readiness_evidence_path");

  const evidenceChain = [
    {
      step: "low_token_observation",
      status: statusFor(lowTokenEvidenceReady, "ready_from_metadata_or_event_signal", "missing_signal_or_teacher_exclusion"),
      evidence: {
        candidateLogFileCount: row.candidateLogFileCount,
        windowsEventLogCount: row.windowsEventLogCount
      },
      nextLowTokenAction: lowTokenEvidenceReady ? "reuse_metadata_delta_gate" : "ask_teacher_for_signal_or_exclusion"
    },
    {
      step: "control_channel",
      status: statusFor(controlEvidenceReady, row.controlStatus, "missing_control_channel_evidence"),
      evidence: {
        controlStatus: row.controlStatus,
        recommendedAdapters: row.recommendedAdapters
      },
      nextLowTokenAction: controlEvidenceReady ? "review_exact_route_or_visible_window" : "create_software_control_channel_probe"
    },
    {
      step: "teacher_intent_binding",
      status: statusFor(
        numberedTargetReady || routeOnlyTargetReady,
        routeOnlyTargetReady ? "exact_route_reviewable" : "numbered_target_reviewable",
        "missing_numbered_target_or_exact_route"
      ),
      evidence: {
        pilotRouteMode: row.pilotRouteMode,
        pilotId: row.pilotId
      },
      nextLowTokenAction:
        numberedTargetReady || routeOnlyTargetReady ? "validate_single_target_or_exact_route_receipt" : "confirm_numbered_target_or_exact_route"
    },
    {
      step: "action_logic_source",
      status: statusFor(logicSourceReady, "reviewable_logic_source_contract_present", row.actionLogicSourceStatus),
      evidence: {
        logicSourceRequiredBeforeExecution: true,
        missingLogicSourceBehavior: row.missingLogicSourceBehavior
      },
      nextLowTokenAction: logicSourceReady ? "teacher_review_logic_contract" : "route_to_teacher_logic_source_review"
    },
    {
      step: "dry_run_execution_package",
      status: statusFor(dryRunPilotReady, "dry_run_pilot_ready", "missing_dry_run_pilot_package"),
      evidence: {
        adapterPackagePath: row.adapterPackagePath,
        readinessEvidencePath: row.readinessEvidencePath
      },
      nextLowTokenAction: dryRunPilotReady ? "run_dry_run_pilot_after_teacher_review" : row.nextActionLane
    },
    {
      step: "rollback_and_post_action_checkpoint",
      status: statusFor(rollbackEvidenceReady, "readiness_or_rollback_evidence_linked", "rollback_evidence_still_required"),
      evidence: {
        readinessEvidencePath: row.readinessEvidencePath
      },
      nextLowTokenAction: rollbackEvidenceReady ? "preserve_rollback_until_teacher_confirms" : "create_or_link_retained_rollback_point"
    }
  ];

  return {
    rowId: row.rowId,
    software: row.software,
    processName: row.processName,
    windowTitle: row.windowTitle,
    executionCapabilityStage: row.executionCapabilityStage,
    nextActionLane: row.nextActionLane,
    evidenceChain,
    beforeExecuteMissing,
    readyForDryRunReview: dryRunPilotReady && logicSourceReady && (numberedTargetReady || routeOnlyTargetReady),
    readyForExecuteRequest: false,
    executeRequestBlockedReason:
      beforeExecuteMissing.length > 0
        ? "execute_request_blocked_until_all_evidence_chain_gaps_are_teacher_reviewed"
        : "execute_request_still_requires_explicit_teacher_execute_confirmation_and_preflight",
    lowTokenNextBestAction: row.nextActionLane,
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  };
}

function sortRows(rows) {
  const rank = {
    dry_run_pilot_package_ready: 0,
    control_route_reviewable_before_pilot: 1,
    observation_ready_control_evidence_missing: 2,
    needs_teacher_signal_or_control_evidence: 3
  };
  return rows.sort((a, b) => {
    const routeDiff = (rank[a.executionCapabilityStage] ?? 9) - (rank[b.executionCapabilityStage] ?? 9);
    if (routeDiff) return routeDiff;
    return a.software.localeCompare(b.software);
  });
}

function mergeRow(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === "" || value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    target[key] = value;
  }
}

function writeReadme(path, matrix) {
  const lines = [
    "# All-Software Execution Capability Matrix",
    "",
    `Goal: ${matrix.goal}`,
    "",
    "This is a teacher-review-only map from low-token observation evidence to possible execution routes for local software.",
    "",
    `Rows: ${matrix.counts.totalRows}`,
    `Dry-run pilot package ready: ${matrix.counts.dryRunPilotPackageReady}`,
    `Control route reviewable before pilot: ${matrix.counts.controlRouteReviewableBeforePilot}`,
    `Observation ready but control evidence missing: ${matrix.counts.observationReadyControlEvidenceMissing}`,
    `Needs teacher signal or control evidence: ${matrix.counts.needsTeacherSignalOrControlEvidence}`,
    `Evidence-chain ledger rows: ${matrix.evidenceChainLedgerSummary.totalRows}`,
    `Evidence-chain rows blocked before execute: ${matrix.evidenceChainLedgerSummary.blockedBeforeExecute}`,
    "",
    "Use it like this:",
    "1. Start with rows in `review_and_run_one_dry_run_pilot`.",
    "2. For route-ready rows, confirm one numbered target or exact API/CLI/file/browser route.",
    "3. For observation-only rows, ask the teacher for API, CLI, macro, import/export, browser, or visible-window evidence.",
    "4. Review `all-software-execution-evidence-chain-ledger.json` before any dry-run or execute request.",
    "5. Rerun control coverage and pilot queue after new teacher-reviewed evidence.",
    "",
    "Locked boundaries:",
    "- No target software commands executed.",
    "- No UI events sent.",
    "- No screenshots captured.",
    "- No full logs read or retained.",
    "- No memory written.",
    "- No universal native execution claim.",
    "- No all-software completion claim.",
    "- No packaging unlocked."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", argValue("--task", "Create an all-software execution capability matrix before claiming universal native control."));
const inventoryInput = argValue("--inventory", argValue("--inventory-path", ""));
const coverageInput = argValue("--coverage-audit", argValue("--control-channel-coverage-audit", argValue("--audit", "")));
const pilotQueueInput = argValue("--pilot-queue", argValue("--execution-pilot-queue", argValue("--queue", "")));
const readinessInput = argValue("--readiness-batch", argValue("--execution-readiness-batch", ""));
const actionLogicValidationInput = argValue(
  "--action-logic-validation",
  argValue("--action-logic-source-contract-validation", argValue("--action-logic-patch", ""))
);
const maxRows = Number(argValue("--max-rows", "80"));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-capability-matrices")));

const inventory = readJsonInput(inventoryInput);
const coverage = readJsonInput(coverageInput);
const pilotQueue = readJsonInput(pilotQueueInput);
const readinessBatch = readJsonInput(readinessInput);
const actionLogicValidation = readJsonInput(actionLogicValidationInput);

if (!inventory && !coverage && !pilotQueue && !readinessBatch && !actionLogicValidation) {
  throw new Error("Provide at least one of --inventory, --coverage-audit, --pilot-queue, --readiness-batch, or --action-logic-validation.");
}

mkdirSync(outputRoot, { recursive: true });
const matrixId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const matrixDir = join(outputRoot, matrixId);
mkdirSync(matrixDir, { recursive: true });

const rowsByKey = new Map();
function ensureRow(sourceRow = {}) {
  const key = softwareKey(sourceRow);
  if (!rowsByKey.has(key)) {
    rowsByKey.set(key, {
      rowId: "",
      software: softwareDisplayName(sourceRow),
      softwareId: safeText(sourceRow.softwareId),
      executableName: safeText(sourceRow.executableName),
      processName: safeText(sourceRow.processName),
      windowTitle: safeText(sourceRow.windowTitle),
      lowTokenObservationReady: false,
      candidateLogFileCount: 0,
      windowsEventLogCount: 0,
      controlStatus: "not_audited",
      recommendedAdapters: [],
      dryRunPilotReady: false,
      pilotId: "",
      pilotRouteMode: "",
      adapterPackagePath: "",
      readinessEvidencePath: "",
      actionLogicSourceContract: null,
      actionLogicSourceStatus: "teacher_signal_needed_before_action_logic_source",
      logicSourceRequiredBeforeExecution: true,
      missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
      executionCapabilityStage: "needs_teacher_signal_or_control_evidence",
      nextActionLane: "ask_teacher_for_signal_or_exclusion",
      nextCalls: []
    });
  }
  return rowsByKey.get(key);
}

for (const row of sourceRows(inventory).slice(0, maxRows)) {
  const target = ensureRow(row);
  mergeRow(target, {
    software: softwareDisplayName(row),
    softwareId: safeText(row.softwareId),
    executableName: safeText(row.executableName),
    processName: safeText(row.processName),
    windowTitle: safeText(row.windowTitle),
    candidateLogFileCount: Math.max(target.candidateLogFileCount, logCount(row)),
    windowsEventLogCount: Math.max(target.windowsEventLogCount, eventCount(row))
  });
  target.lowTokenObservationReady = target.lowTokenObservationReady || target.candidateLogFileCount > 0 || target.windowsEventLogCount > 0;
}

for (const row of sourceRows(coverage).slice(0, maxRows)) {
  const target = ensureRow(row);
  mergeRow(target, {
    software: softwareDisplayName(row),
    softwareId: safeText(row.softwareId),
    executableName: safeText(row.executableName),
    rowId: safeText(row.rowId),
    processName: safeText(row.processName),
    windowTitle: safeText(row.windowTitle),
    controlStatus: safeText(row.status, "not_audited"),
    recommendedAdapters: Array.isArray(row.recommendedAdapters) ? row.recommendedAdapters : [],
    candidateLogFileCount: Math.max(target.candidateLogFileCount, logCount(row)),
    windowsEventLogCount: Math.max(target.windowsEventLogCount, eventCount(row))
  });
  target.lowTokenObservationReady = target.lowTokenObservationReady || target.candidateLogFileCount > 0 || target.windowsEventLogCount > 0;
}

for (const pilot of sourceRows(pilotQueue).slice(0, maxRows)) {
  const target = ensureRow(pilot);
  mergeRow(target, {
    software: softwareDisplayName(pilot),
    softwareId: safeText(pilot.softwareId),
    executableName: safeText(pilot.executableName),
    pilotId: safeText(pilot.pilotId),
    pilotRouteMode: safeText(pilot.routeMode),
    adapterPackagePath: safeText(pilot.adapterPackagePath),
    actionLogicSourceContract: pilot.actionLogicSourceContract || null,
    logicSourceRequiredBeforeExecution: pilot.logicSourceRequiredBeforeExecution !== false,
    missingLogicSourceBehavior: safeText(pilot.missingLogicSourceBehavior, target.missingLogicSourceBehavior),
    recommendedAdapters: Array.isArray(pilot.recommendedAdapters) ? pilot.recommendedAdapters : target.recommendedAdapters
  });
  target.dryRunPilotReady = Boolean(pilot.adapterPackagePath || pilot.actionPlanPath || pilot.dryRunFirst);
}

for (const result of sourceRows(readinessBatch).concat(readinessBatch?.runResults || []).slice(0, maxRows)) {
  const target = ensureRow(result);
  mergeRow(target, {
    readinessEvidencePath: safeText(result.receiptPath || result.evidencePath || result.outputPath)
  });
}

function actionLogicPatchRows(source) {
  if (!source) return [];
  if (source.format === "transparent_ai_all_software_action_logic_source_contract_validation_v1") {
    return Array.isArray(source.matrixPatch?.rows) ? source.matrixPatch.rows : [];
  }
  if (source.format === "transparent_ai_all_software_action_logic_source_contract_matrix_patch_v1") {
    return Array.isArray(source.rows) ? source.rows : [];
  }
  return [];
}

const actionLogicPatchesByRowId = new Map();
const actionLogicPatchesBySoftware = new Map();
for (const patch of actionLogicPatchRows(actionLogicValidation).slice(0, maxRows)) {
  if (patch.rowId) actionLogicPatchesByRowId.set(String(patch.rowId), patch);
  const patchSoftwareName = softwareDisplayName(patch);
  if (patchSoftwareName) actionLogicPatchesBySoftware.set(String(patchSoftwareName).toLowerCase(), patch);
  const target = ensureRow(patch);
  mergeRow(target, {
    rowId: safeText(patch.rowId, target.rowId),
    software: softwareDisplayName(patch),
    softwareId: safeText(patch.softwareId, target.softwareId),
    executableName: safeText(patch.executableName, target.executableName),
    actionLogicSourceContract: patch.actionLogicSourceContract || target.actionLogicSourceContract,
    actionLogicSourceStatus: patch.actionLogicSourceStatus || "logic_source_contract_ready_for_review",
    missingLogicSourceBehavior: safeText(patch.missingLogicSourceBehavior, target.missingLogicSourceBehavior)
  });
}

const rows = sortRows(
  Array.from(rowsByKey.values()).map((row, index) => {
    const rowId = row.rowId || `capability-row-${String(index + 1).padStart(3, "0")}`;
    const actionLogicPatch = actionLogicPatchesByRowId.get(rowId) || actionLogicPatchesBySoftware.get(String(row.software).toLowerCase()) || actionLogicPatchesBySoftware.get(String(row.softwareId).toLowerCase());
    const patchedRow = actionLogicPatch
      ? {
          ...row,
          actionLogicSourceContract: actionLogicPatch.actionLogicSourceContract || row.actionLogicSourceContract,
          actionLogicSourceStatus: actionLogicPatch.actionLogicSourceStatus || "logic_source_contract_ready_for_review",
          logicSourceRequiredBeforeExecution: true,
          missingLogicSourceBehavior: actionLogicPatch.missingLogicSourceBehavior || row.missingLogicSourceBehavior
        }
      : row;
    const executionCapabilityStage = readinessFor(patchedRow);
    const nextActionLane = nextLaneFor({ ...patchedRow, executionCapabilityStage });
    const nextCalls = [];
    if (nextActionLane === "review_and_run_one_dry_run_pilot") nextCalls.push("run_all_software_execution_pilot_runner");
    if (nextActionLane === "confirm_numbered_target_or_exact_route") nextCalls.push("create_all_software_execution_pilot_queue");
    if (nextActionLane === "confirm_visible_window_and_numbered_target") nextCalls.push("create_visual_engineering_target_confirmation_kit");
    if (nextActionLane === "collect_control_channel_evidence") nextCalls.push("create_software_control_channel_probe");
    if (nextActionLane === "ask_teacher_for_signal_or_exclusion") nextCalls.push("teach_apprentice");
    return {
      ...patchedRow,
      rowId,
      executionCapabilityStage,
      nextActionLane,
      nextCalls,
      actionLogicSourceStatus: actionLogicSourceStatusFor(patchedRow),
      logicSourceRequiredBeforeExecution: true,
      missingLogicSourceBehavior: patchedRow.missingLogicSourceBehavior || "block_execute_and_route_to_teacher_review",
      accepted: false,
      ruleEnabled: false,
      packagingGated: true
    };
  })
);

const counts = {
  totalRows: rows.length,
  dryRunPilotPackageReady: rows.filter((row) => row.executionCapabilityStage === "dry_run_pilot_package_ready").length,
  controlRouteReviewableBeforePilot: rows.filter((row) => row.executionCapabilityStage === "control_route_reviewable_before_pilot").length,
  observationReadyControlEvidenceMissing: rows.filter((row) => row.executionCapabilityStage === "observation_ready_control_evidence_missing").length,
  needsTeacherSignalOrControlEvidence: rows.filter((row) => row.executionCapabilityStage === "needs_teacher_signal_or_control_evidence").length,
  logicSourceContractReadyForReview: rows.filter((row) => row.actionLogicSourceStatus === "logic_source_contract_ready_for_review").length,
  actionLogicSourceMissing: rows.filter((row) => row.actionLogicSourceStatus !== "logic_source_contract_ready_for_review").length
};

const evidenceChainLedger = rows.map((row) => buildEvidenceChain(row));
const evidenceChainLedgerSummary = {
  format: "transparent_ai_all_software_execution_evidence_chain_ledger_summary_v1",
  totalRows: evidenceChainLedger.length,
  readyForDryRunReview: evidenceChainLedger.filter((row) => row.readyForDryRunReview).length,
  blockedBeforeExecute: evidenceChainLedger.filter((row) => row.beforeExecuteMissing.length > 0).length,
  missingLowTokenObservation: evidenceChainLedger.filter((row) =>
    row.beforeExecuteMissing.includes("low_token_observation_signal_or_teacher_exclusion")
  ).length,
  missingControlChannel: evidenceChainLedger.filter((row) =>
    row.beforeExecuteMissing.includes("control_channel_route_or_visible_window_evidence")
  ).length,
  missingLogicSource: evidenceChainLedger.filter((row) =>
    row.beforeExecuteMissing.includes("reviewed_action_logic_source_contract")
  ).length,
  missingNumberedTargetOrRoute: evidenceChainLedger.filter((row) =>
    row.beforeExecuteMissing.includes("teacher_confirmed_numbered_target_or_exact_route")
  ).length,
  missingRollbackEvidence: evidenceChainLedger.filter((row) =>
    row.beforeExecuteMissing.includes("retained_rollback_or_readiness_evidence_path")
  ).length,
  readyForExecuteRequest: 0
};

const matrix = {
  format: "transparent_ai_all_software_execution_capability_matrix_v1",
  goal,
  createdAt: new Date().toISOString(),
  sourceEvidence: {
    inventoryPath: sourcePath(inventoryInput),
    coverageAuditPath: sourcePath(coverageInput),
    pilotQueuePath: sourcePath(pilotQueueInput),
    readinessBatchPath: sourcePath(readinessInput),
    actionLogicValidationPath: sourcePath(actionLogicValidationInput)
  },
  counts,
  evidenceChainLedgerSummary,
  rows,
  evidenceChainLedger,
  nextReviewQueue: rows.slice(0, Math.min(rows.length, 12)).map((row) => ({
    rowId: row.rowId,
    software: row.software,
    lane: row.nextActionLane,
    nextCalls: row.nextCalls,
    actionLogicSourceStatus: row.actionLogicSourceStatus,
    logicSourceRequiredBeforeExecution: true,
    missingLogicSourceBehavior: row.missingLogicSourceBehavior,
    requiredTeacherReview: true,
    ruleEnabled: false,
    accepted: false,
    packagingGated: true
  })),
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    allSoftwareCoverageComplete: false,
    nativeUniversalExecution: false,
    reason: "This matrix routes real local software toward reviewed execution trials; it does not prove every app is covered or that arbitrary native semantic control exists."
  },
  locks: {
    screenshotsCaptured: false,
    screenshotsCapturedByThisTool: false,
    uiEventsSent: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fileContentsRead: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    allSoftwareExecutionComplete: false,
    ruleEnabled: false,
    accepted: false,
    technologyAccepted: false,
    packagingGated: true
  }
};

const matrixPath = join(matrixDir, "all-software-execution-capability-matrix.json");
const evidenceChainLedgerPath = join(matrixDir, "all-software-execution-evidence-chain-ledger.json");
const receiptPath = join(matrixDir, "all-software-execution-capability-matrix-receipt.json");
const readmePath = join(matrixDir, "ALL_SOFTWARE_EXECUTION_CAPABILITY_MATRIX_START_HERE.md");

matrix.sourceEvidence.evidenceChainLedgerPath = evidenceChainLedgerPath;
writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
writeFileSync(
  evidenceChainLedgerPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_execution_evidence_chain_ledger_v1",
      matrixPath,
      createdAt: matrix.createdAt,
      goal,
      summary: evidenceChainLedgerSummary,
      rows: evidenceChainLedger,
      completionBoundary: matrix.completionBoundary,
      locks: matrix.locks
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeReadme(readmePath, matrix);
writeFileSync(
  receiptPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_execution_capability_matrix_receipt_v1",
      matrixPath,
      evidenceChainLedgerPath,
      readmePath,
      counts,
      evidenceChainLedgerSummary,
      locks: matrix.locks,
      status: "waiting_for_teacher_review",
      deleteOnlyAfterTeacherConfirmation: false
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_capability_matrix_result_v1",
      matrixPath,
      evidenceChainLedgerPath,
      receiptPath,
      readmePath,
      counts,
      evidenceChainLedgerSummary,
      locks: matrix.locks,
      status: "waiting_for_teacher_review"
    },
    null,
    2
  )
);

