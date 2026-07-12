#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");

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
  return String(value || "spatial-software-execution-route")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "spatial-software-execution-route";
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
    teacherConfirmationRequired: true,
    selectedNumberRequired: true,
    selectedTargetOnly: true,
    dryRunFirst: true,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    nativeUniversalExecution: false,
    memoryWritten: false,
    outcomeAccepted: false,
    privateChainOfThoughtExposed: false
  };
}

function adapterCatalog() {
  const catalogPath = join(pluginRoot, "assets", "templates", "tool-adapters.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  return Array.isArray(catalog.adapters) ? catalog.adapters : [];
}

function candidatePoint(candidate) {
  const target = candidate?.normalizedTarget || candidate?.target || candidate?.at || {};
  return {
    x: Number(target.x ?? 0),
    y: Number(target.y ?? 0),
    zHint: Number(target.zHint ?? target.z ?? 0),
    coordinateSource: target.coordinateSource || "numbered_target_confirmation"
  };
}

function selectedCandidateFromInputs({ confirmation, receipt, selectedNumber }) {
  const receiptCandidate = receipt?.selectedCandidate;
  if (receiptCandidate && Number(receiptCandidate.number) === Number(receipt?.selectedCandidateNumber || selectedNumber || receiptCandidate.number)) {
    return { candidate: receiptCandidate, selectedNumber: Number(receiptCandidate.number), source: "confirmation_receipt" };
  }

  const explicitNumber = Number(selectedNumber || receipt?.selectedCandidateNumber || confirmation?.selectedCandidateNumber || confirmation?.selectedCandidate?.number || "");
  if (!Number.isInteger(explicitNumber) || explicitNumber < 1) return { candidate: null, selectedNumber: 0, source: "" };

  const candidates = Array.isArray(confirmation?.candidates) ? confirmation.candidates : [];
  const candidate = candidates.find((row) => Number(row.number) === explicitNumber) || confirmation?.selectedCandidate || null;
  if (!candidate) return { candidate: null, selectedNumber: explicitNumber, source: "missing_candidate" };
  return { candidate, selectedNumber: explicitNumber, source: "numbered_target_confirmation" };
}

function recommendedAdapters(profile, preferredAdapters) {
  const fromProfile = Array.isArray(profile?.recommendedRoute?.recommendedAdapters) ? profile.recommendedRoute.recommendedAdapters : [];
  const primary = profile?.recommendedRoute?.primaryAdapterId ? [profile.recommendedRoute.primaryAdapterId] : [];
  const all = [...preferredAdapters, ...primary, ...fromProfile, "existing-windows-ui-automation"];
  return [...new Set(all.filter(Boolean))].slice(0, 5);
}

function adapterRecord(adapterId, context) {
  const adapter = context.catalog.find((row) => row.id === adapterId) || { id: adapterId, proofNeeded: [] };
  const channel = Array.isArray(context.profile?.channels)
    ? context.profile.channels.find((row) => row.adapterId === adapterId)
    : null;
  const score = channel?.score ?? (adapterId === context.primaryAdapterId ? 50 : 10);
  const routeEvidence = Array.isArray(channel?.evidence) ? channel.evidence : [];
  const blockers = Array.isArray(channel?.blockers) ? channel.blockers : [];
  const requiredEvidence = Array.isArray(channel?.requiredEvidenceBeforeExecute)
    ? channel.requiredEvidenceBeforeExecute
    : Array.isArray(adapter.proofNeeded)
      ? adapter.proofNeeded
      : [];

  return {
    adapterId,
    label: channel?.label || adapter.toolExamples?.[0] || adapterId,
    score,
    routeEvidence,
    requiredEvidenceBeforeDryRun: [
      "teacher-confirmed numbered spatial target",
      "transparent overlay packet or narrowed selected-target overlay",
      "spatial intent interpretation evidence",
      "universal detail logic contract with zero missing consequential detail sources",
      ...requiredEvidence.slice(0, 5)
    ],
    blockersBeforeExecute: [
      ...blockers,
      "missing or unreviewed detail logic blocks any visually similar execution route",
      "no real execution until dry-run receipt, target-window or route preflight, and post-action evidence checkpoint are reviewed"
    ],
    dryRunHandoff: {
      tool: "create_existing_software_execution_adapter",
      arguments: {
        goal: context.goal,
        software: context.software,
        preferredAdapter: adapterId,
        overlayPacket: context.overlayPacketPath || "<pass transparent overlay packet>",
        spatialIntent: context.spatialIntentPath || "<pass spatial interpretation>",
        capabilityProfile: context.profilePath || "<pass software control-channel profile when available>",
        actionPlan: "<optional supervised action plan path after create_supervised_software_action_kit>"
      }
    },
    verificationHandoff: {
      tool: "create_post_action_evidence_checkpoint",
      reason: "After a teacher-confirmed dry run or supervised execution receipt, compare cheap state and log metadata before screenshots or memory.",
      arguments: {
        goal: context.goal,
        software: context.software,
        executionReceipt: "<execution receipt path>",
        beforeState: "<before-state snapshot path>",
        afterState: "<after-state paths or snapshot path>",
        maxScreenshots: 1
      }
    },
    locks: locks()
  };
}

function executionApprovalHandoff({ candidate, selectedNumber, detailLogicGate, routeCandidateCount, paths }) {
  const readyForApprovalPrep = Boolean(candidate && detailLogicGate.ready && routeCandidateCount > 0);
  const status = !candidate
    ? "waiting_for_numbered_spatial_target_confirmation_before_execution_approval_gate"
    : detailLogicGate.ready
      ? "ready_for_real_local_execution_approval_gate_prep_after_route_review"
      : "blocked_missing_detail_logic_before_execution_approval_gate";

  return {
    format: "transparent_ai_spatial_route_to_execution_approval_handoff_v1",
    objectiveRequirementId: "execute_in_target_software_after_teacher_confirmation",
    completionBlockerLane: "universal_native_execution_control_channel",
    sourceBridgeFormat: "transparent_ai_spatial_software_execution_route_bridge_v1",
    status,
    selectedNumber: Number.isInteger(Number(selectedNumber)) ? Number(selectedNumber) : 0,
    routeCandidateCount,
    readyForExecutionApprovalGatePrep: readyForApprovalPrep,
    nextGate: readyForApprovalPrep
      ? "create_real_local_execution_approval_gate"
      : candidate
        ? "teacher_detail_logic_review"
        : "teacher_numbered_target_confirmation",
    prerequisiteGate: "create_real_local_execution_pilot_selector",
    nextGateAfterReadyGate: "create_all_software_execution_approved_gate_command_builder",
    finalRunnerGate: "run_all_software_execution_approved_gate_runner",
    returnToCompletionBlockerMatrixAfterNextGate: true,
    sourceEvidence: {
      routeBridgePath: paths.bridgePath,
      routeReceiptPath: paths.receiptPath,
      selectedTargetPath: paths.selectedTargetPath,
      routeCandidateEvidence: "bridge.routeCandidates[*].dryRunHandoff and verificationHandoff"
    },
    requiredEvidenceBeforeManualUse: [
      "teacher-confirmed numbered spatial target receipt",
      "validated transparent sketch overlay packet or spatial intent receipt",
      "transparent_ai_universal_detail_logic_contract_v1 with missingDetailLogicCount=0",
      "reviewed single route candidate from routeCandidates",
      "real-local execution pilot selector and queue for the target software",
      "adapter-specific reviewed evidence such as mapping, API request, command manifest, browser target, or target window title",
      "retained rollback point for this execute attempt",
      "explicit teacher confirmation accepted by create-real-local-execution-approval-gate.mjs"
    ],
    recommendedBridgeSequence: [
      "create_existing_software_execution_adapter",
      "create_real_local_execution_pilot_selector",
      "create_real_local_execution_approval_gate",
      "create_all_software_execution_approved_gate_command_builder",
      "run_all_software_execution_approved_gate_runner",
      "create_post_action_evidence_checkpoint"
    ],
    blockedActions: [
      "create_real_local_execution_approval_gate_without_reviewed_route_candidate",
      "skip_real_local_execution_pilot_selector",
      "run_approved_gate_runner_from_route_bridge",
      "invoke_adapter_or_send_ui_events_from_route_bridge",
      "execute_without_retained_rollback_point",
      "execute_without_explicit_teacher_confirmation",
      "write_memory_or_enable_rules_before_post_action_checkpoint",
      "claim_goal_complete_from_route_bridge"
    ],
    locks: {
      ...locks(),
      routeBridgeDoesNotCreateApprovalGate: true,
      routeBridgeDoesNotRunApprovedGateRunner: true,
      routeBridgeDoesNotInvokeAdapter: true,
      approvalGateRequiresTeacherConfirmation: true,
      retainedRollbackPointRequired: true,
      goalComplete: false
    }
  };
}

function detailLogicContractFromInputs({ overlayPacket, spatialIntent }) {
  const contract =
    spatialIntent?.detailLogicContract ||
    spatialIntent?.universalDetailLogicContract ||
    overlayPacket?.universalDetailLogicContract ||
    null;
  if (!contract || contract.format !== "transparent_ai_universal_detail_logic_contract_v1") {
    return {
      ready: false,
      status: "blocked_missing_universal_detail_logic_contract",
      contractFormat: contract?.format || "",
      source: "",
      consequentialDetailCount: 0,
      missingDetailLogicCount: 1,
      missingDetailLogicRows: [
        {
          id: "missing-universal-detail-logic-contract",
          detailCategory: "unknown",
          classification: "missing_evidence_blocks_execution",
          logicSource: "missing transparent_ai_universal_detail_logic_contract_v1",
          blocksExecutionIfMissing: true
        }
      ],
      missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review"
    };
  }
  const rows = Array.isArray(contract.consequentialDetailRows) ? contract.consequentialDetailRows : [];
  const missingRows = Array.isArray(contract.missingDetailLogicRows)
    ? contract.missingDetailLogicRows
    : rows.filter((row) => row.classification === "missing_evidence_blocks_execution" || row.status === "blocked_missing_logic_source");
  const explicitMissingCount = Number(contract.missingDetailLogicCount ?? missingRows.length);
  const missingDetailLogicCount = Math.max(missingRows.length, Number.isFinite(explicitMissingCount) ? explicitMissingCount : 0);
  return {
    ready: missingDetailLogicCount === 0 && rows.length > 0,
    status:
      missingDetailLogicCount === 0 && rows.length > 0
        ? "ready_for_dry_run_route_review"
        : "blocked_missing_detail_logic_before_execution_route",
    contractFormat: contract.format,
    source: spatialIntent?.detailLogicContract || spatialIntent?.universalDetailLogicContract ? "spatial_intent_interpretation" : "transparent_overlay_packet",
    consequentialDetailCount: rows.length,
    missingDetailLogicCount,
    missingDetailLogicRows: missingRows,
    missingLogicSourceBehavior: contract.missingLogicSourceBehavior || "block_execute_and_route_to_teacher_review",
    blockedActions: Array.isArray(contract.blockedActions) ? contract.blockedActions : []
  };
}

const goal = argValue("--goal", argValue("--task", "Route a teacher-confirmed spatial sketch target into software execution planning."));
const software = argValue("--software", argValue("--app", "target software"));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "spatial-software-execution-routes")));
const overlayInput = argValue("--overlay-packet", argValue("--transparent-sketch-packet", ""));
const spatialIntentInput = argValue("--spatial-intent", argValue("--interpretation", ""));
const confirmationInput = argValue("--target-confirmation", argValue("--numbered-confirmation", ""));
const receiptInput = argValue("--confirmation-receipt", argValue("--target-receipt", ""));
const profileInput = argValue("--control-channel-profile", argValue("--software-profile", ""));
const probeInput = argValue("--control-channel-probe", "");
const selectedNumberArg = argValue("--selected-number", argValue("--number", ""));
const preferredAdapters = argValues("--preferred-adapter");

const overlay = readJsonInput(overlayInput, "--overlay-packet", true);
const spatialIntent = readJsonInput(spatialIntentInput, "--spatial-intent", true);
const confirmation = readJsonInput(confirmationInput, "--target-confirmation", true);
const receipt = readJsonInput(receiptInput, "--confirmation-receipt", true);
const profile = readJsonInput(profileInput, "--control-channel-profile", true);
const probe = readJsonInput(probeInput, "--control-channel-probe", true);
const { candidate, selectedNumber, source } = selectedCandidateFromInputs({
  confirmation: confirmation.value,
  receipt: receipt.value,
  selectedNumber: selectedNumberArg
});
const detailLogicGate = detailLogicContractFromInputs({
  overlayPacket: overlay.value,
  spatialIntent: spatialIntent.value
});

mkdirSync(outputRoot, { recursive: true });
const routeId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const routeDir = join(outputRoot, routeId);
mkdirSync(routeDir, { recursive: true });

const bridgePath = join(routeDir, "spatial-software-execution-route-bridge.json");
const receiptPath = join(routeDir, "spatial-software-execution-route-receipt.json");
const readmePath = join(routeDir, "SPATIAL_SOFTWARE_EXECUTION_ROUTE_START_HERE.md");
const selectedTargetPath = join(routeDir, "selected-spatial-target.json");

const status = !candidate
  ? "waiting_for_numbered_spatial_target_confirmation"
  : detailLogicGate.ready
    ? "spatial_target_bound_to_execution_routes_waiting_for_dry_run_review"
    : "blocked_missing_detail_logic_before_execution_route";
const selectedTarget = candidate
  ? {
      format: "transparent_ai_selected_spatial_execution_target_v1",
      selectedNumber,
      selectedCandidate: candidate,
      selectedPoint: candidatePoint(candidate),
      source,
      selectedTargetOnly: true,
      teacherReviewRequired: true,
      locks: locks()
    }
  : null;
if (selectedTarget) writeFileSync(selectedTargetPath, `${JSON.stringify(selectedTarget, null, 2)}\n`, "utf8");

const adapters = recommendedAdapters(profile.value, preferredAdapters);
const context = {
  goal,
  software,
  catalog: adapterCatalog(),
  profile: profile.value,
  primaryAdapterId: adapters[0] || "existing-windows-ui-automation",
  overlayPacketPath: overlay.path,
  spatialIntentPath: spatialIntent.path,
  profilePath: profile.path
};
const routeCandidates = candidate ? adapters.map((adapterId) => adapterRecord(adapterId, context)) : [];
const gatedRouteCandidates = candidate && detailLogicGate.ready ? routeCandidates : [];
const nextExecutionGateHandoff = executionApprovalHandoff({
  candidate,
  selectedNumber,
  detailLogicGate,
  routeCandidateCount: gatedRouteCandidates.length,
  paths: {
    bridgePath,
    receiptPath,
    selectedTargetPath: selectedTarget ? selectedTargetPath : ""
  }
});

const bridge = {
  format: "transparent_ai_spatial_software_execution_route_bridge_v1",
  routeId,
  createdAt: new Date().toISOString(),
  status,
  goal,
  software,
  inputEvidence: {
    overlayPacketPath: overlay.path,
    overlayFormat: overlay.value?.format || "",
    spatialIntentPath: spatialIntent.path,
    spatialIntentFormat: spatialIntent.value?.format || "",
    targetConfirmationPath: confirmation.path,
    targetConfirmationFormat: confirmation.value?.format || "",
    confirmationReceiptPath: receipt.path,
    confirmationReceiptFormat: receipt.value?.format || "",
    controlChannelProfilePath: profile.path,
    controlChannelProfileFormat: profile.value?.format || "",
    controlChannelProbePath: probe.path,
    controlChannelProbeFormat: probe.value?.format || "",
    detailLogicContractFormat: detailLogicGate.contractFormat,
    detailLogicContractSource: detailLogicGate.source,
    detailLogicReady: detailLogicGate.ready,
    consequentialDetailCount: detailLogicGate.consequentialDetailCount,
    missingDetailLogicCount: detailLogicGate.missingDetailLogicCount,
    missingLogicSourceBehavior: detailLogicGate.missingLogicSourceBehavior
  },
  detailLogicGate,
  selectedTargetPath: selectedTarget ? selectedTargetPath : "",
  selectedTarget,
  routeCandidates: gatedRouteCandidates,
  nextExecutionGateHandoff,
  nextTeacherActions: candidate && detailLogicGate.ready
    ? [
        "Review that the selected numbered target matches the teacher sketch intent.",
        "Confirm every consequential sketch detail is backed by data, formula, constraint, teacher exception, or explicit non-parametric classification.",
        "Pick one route candidate, then run create_existing_software_execution_adapter in dry-run mode.",
        "Use nextExecutionGateHandoff to prepare create_real_local_execution_approval_gate only after route and dry-run evidence are reviewed.",
        "Review dry-run receipt, real-local execution approval gate, retained rollback point, and final teacher confirmation before any execute mode.",
        "After execution, run create_post_action_evidence_checkpoint before screenshots, memory, rule enablement, or packaging."
      ]
    : candidate
      ? [
          "Review missingDetailLogicRows and ask the teacher to provide the missing data, formula, constraint, relationship, exception, or non-parametric/decorative classification.",
          "Regenerate or update the transparent overlay packet / spatial intent interpretation with transparent_ai_universal_detail_logic_contract_v1.",
          "Run this bridge again only after detailLogicGate.ready=true; do not create dry-run route candidates while details are only visually similar."
        ]
    : [
        "Run create_spatial_target_confirmation_kit to mark possible targets with numbers.",
        "Ask the teacher to confirm exactly one number.",
        "Run this bridge again with --selected-number or --confirmation-receipt before any dry-run execution route."
      ],
  blockedActions: [
    "execute_without_selected_number",
    "create_dry_run_route_with_missing_detail_logic",
    "execute_or_generate_output_that_only_looks_similar_without_detail_logic",
    "execute_without_dry_run_receipt",
    "create_real_local_execution_approval_gate_without_reviewed_route_candidate",
    "run_approved_gate_runner_from_route_bridge",
    "use_unselected_targets",
    "continuous_recording_by_default",
    "accept_outcome_without_post_action_checkpoint",
    "enable_rule",
    "unlock_packaging",
    "claim_universal_native_execution"
  ],
  locks: locks()
};

const routeReceipt = {
  format: "transparent_ai_spatial_software_execution_route_receipt_v1",
  routeId,
  status,
  selectedNumber,
  selectedTargetOnly: Boolean(candidate),
  routeCandidateCount: gatedRouteCandidates.length,
  detailLogicGateReady: detailLogicGate.ready,
  missingDetailLogicCount: detailLogicGate.missingDetailLogicCount,
  nextExecutionGateHandoffFormat: nextExecutionGateHandoff.format,
  nextExecutionGate: nextExecutionGateHandoff.nextGate,
  nextExecutionGateReadyForApprovalPrep: nextExecutionGateHandoff.readyForExecutionApprovalGatePrep,
  nextExecutionGateReturnToCompletionBlockerMatrix: nextExecutionGateHandoff.returnToCompletionBlockerMatrixAfterNextGate,
  routeBridgeDoesNotCreateApprovalGate: nextExecutionGateHandoff.locks.routeBridgeDoesNotCreateApprovalGate,
  routeBridgeDoesNotRunApprovedGateRunner: nextExecutionGateHandoff.locks.routeBridgeDoesNotRunApprovedGateRunner,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  nextRequiredGate: !candidate
    ? "teacher_numbered_target_confirmation"
    : detailLogicGate.ready
      ? "teacher_reviewed_dry_run_route"
      : "teacher_detail_logic_review",
  locks: locks()
};

writeFileSync(bridgePath, `${JSON.stringify(bridge, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(routeReceipt, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Spatial Software Execution Route",
    "",
    `Status: ${status}`,
    "",
    !candidate
      ? "No selected number was provided. Confirm exactly one numbered spatial target before route planning."
      : detailLogicGate.ready
        ? `Selected target number ${selectedNumber} is bound to ${gatedRouteCandidates.length} dry-run-first route candidate(s).`
        : `Selected target number ${selectedNumber} is blocked before route planning because ${detailLogicGate.missingDetailLogicCount} consequential detail logic item(s) are missing.`,
    "",
    "Review order:",
    "1. Confirm the selected numbered target matches the teacher's 2D, perspective, or 3D depth sketch.",
    "2. Confirm every consequential detail has a reviewed logic source, or classify it as decorative/non-parametric before route planning.",
    "3. Prefer API, CLI, browser, or file import/export routes before supervised Windows UI automation.",
    "4. Run only dry-run adapter receipts first.",
    "5. Prepare create_real_local_execution_approval_gate only from a reviewed route candidate, retained rollback point, adapter evidence, and explicit teacher confirmation.",
    "6. After any supervised execution, run the post-action evidence checkpoint before screenshots or memory.",
    "",
    "Execution approval handoff:",
    `- Format: ${nextExecutionGateHandoff.format}`,
    `- Next gate: ${nextExecutionGateHandoff.nextGate}`,
    `- Ready for approval prep: ${nextExecutionGateHandoff.readyForExecutionApprovalGatePrep}`,
    `- Approval gate then command builder: ${nextExecutionGateHandoff.nextGateAfterReadyGate}`,
    `- Final runner remains separate: ${nextExecutionGateHandoff.finalRunnerGate}`,
    "",
    "Blocked actions: execute without selected number, create a dry-run route with missing detail logic, execute without dry-run receipt, continuous recording by default, memory writes, rule enablement, packaging unlock, and universal native-execution claims."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_software_execution_route_bridge_result_v1",
      routeId,
      status,
      bridgePath,
      receiptPath,
      readme: readmePath,
      selectedTargetPath: selectedTarget ? selectedTargetPath : "",
      selectedNumber,
      detailLogicGateReady: detailLogicGate.ready,
      missingDetailLogicCount: detailLogicGate.missingDetailLogicCount,
      routeCandidateCount: gatedRouteCandidates.length,
      primaryAdapterId: gatedRouteCandidates[0]?.adapterId || "",
      nextExecutionGateHandoffFormat: nextExecutionGateHandoff.format,
      nextExecutionGate: nextExecutionGateHandoff.nextGate,
      nextExecutionGateReadyForApprovalPrep: nextExecutionGateHandoff.readyForExecutionApprovalGatePrep,
      nextExecutionGateAfterReadyGate: nextExecutionGateHandoff.nextGateAfterReadyGate,
      finalRunnerGate: nextExecutionGateHandoff.finalRunnerGate,
      returnToCompletionBlockerMatrixAfterNextGate: nextExecutionGateHandoff.returnToCompletionBlockerMatrixAfterNextGate,
      routeBridgeDoesNotCreateApprovalGate: nextExecutionGateHandoff.locks.routeBridgeDoesNotCreateApprovalGate,
      routeBridgeDoesNotRunApprovedGateRunner: nextExecutionGateHandoff.locks.routeBridgeDoesNotRunApprovedGateRunner,
      softwareActionsExecuted: false,
      reviewLocks: locks()
    },
    null,
    2
  )
);
