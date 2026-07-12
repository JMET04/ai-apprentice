#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJsonInput(input, label, optional = false) {
  const text = String(input || "").trim();
  if (!text) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  if (existsSync(text)) {
    const path = resolve(text);
    return { value: JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")), path };
  }
  if (text.startsWith("{") || text.startsWith("[")) return { value: JSON.parse(text), path: "" };
  if (optional) return { value: { reference: text }, path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function slug(value) {
  return (
    String(value || "tlcl-medium-runtime-dry-run-prep")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-medium-runtime-dry-run-prep"
  );
}

function locks() {
  return {
    reviewOnly: true,
    mediumRuntimeOnly: true,
    teacherReviewRequired: true,
    seniorCompileOnCorrection: true,
    dryRunFirst: true,
    noSoftwareExecution: true,
    noTargetSoftwareCommands: true,
    noUiEvents: true,
    noScreenshots: true,
    noFullLogs: true,
    noRuleEnablement: true,
    noMemoryWrite: true,
    noPackagingUnlock: true,
    noCompletionClaim: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  };
}

function routeEvidenceFromSpatialRoute(routeBridge) {
  if (!routeBridge) return { ready: false, blockers: ["missing_spatial_route_bridge"], routeCandidates: [] };
  const candidates = Array.isArray(routeBridge.routeCandidates) ? routeBridge.routeCandidates : [];
  const ready =
    routeBridge.format === "transparent_ai_spatial_software_execution_route_bridge_v1" &&
    routeBridge.status === "spatial_target_bound_to_execution_routes_waiting_for_dry_run_review" &&
    routeBridge.detailLogicGate?.ready === true &&
    routeBridge.selectedTarget?.selectedTargetOnly === true &&
    candidates.length > 0 &&
    routeBridge.locks?.softwareActionsExecuted === false;
  const blockers = [];
  if (routeBridge.format !== "transparent_ai_spatial_software_execution_route_bridge_v1") blockers.push("spatial_route_format_mismatch");
  if (routeBridge.status !== "spatial_target_bound_to_execution_routes_waiting_for_dry_run_review") blockers.push("spatial_route_not_waiting_for_dry_run_review");
  if (routeBridge.detailLogicGate?.ready !== true) blockers.push("spatial_route_detail_logic_not_ready");
  if (routeBridge.selectedTarget?.selectedTargetOnly !== true) blockers.push("spatial_route_selected_target_not_single");
  if (!candidates.length) blockers.push("spatial_route_has_no_route_candidates");
  if (routeBridge.locks?.softwareActionsExecuted !== false) blockers.push("spatial_route_execution_lock_mismatch");
  return { ready, blockers, routeCandidates: candidates };
}

function routeEvidenceFromKnowledgeBridge(knowledgeBridge) {
  if (!knowledgeBridge) return { ready: false, blockers: ["missing_knowledge_augmented_spatial_bridge"], reviewRows: [] };
  const reviewRows = Array.isArray(knowledgeBridge.reviewRows) ? knowledgeBridge.reviewRows : [];
  const ready =
    knowledgeBridge.format === "transparent_ai_knowledge_augmented_spatial_execution_bridge_v1" &&
    knowledgeBridge.status === "ready_for_teacher_reviewed_dry_run_route" &&
    reviewRows.length > 0 &&
    knowledgeBridge.counts?.rulesEnabled === 0 &&
    knowledgeBridge.locks?.softwareActionsExecuted === false &&
    knowledgeBridge.locks?.packagingGated === true;
  const blockers = [];
  if (knowledgeBridge.format !== "transparent_ai_knowledge_augmented_spatial_execution_bridge_v1") blockers.push("knowledge_bridge_format_mismatch");
  if (knowledgeBridge.status !== "ready_for_teacher_reviewed_dry_run_route") blockers.push("knowledge_bridge_not_ready_for_reviewed_dry_run");
  if (!reviewRows.length) blockers.push("knowledge_bridge_has_no_review_rows");
  if (knowledgeBridge.counts?.rulesEnabled !== 0) blockers.push("knowledge_bridge_rules_enabled");
  if (knowledgeBridge.locks?.softwareActionsExecuted !== false) blockers.push("knowledge_bridge_execution_lock_mismatch");
  if (knowledgeBridge.locks?.packagingGated !== true) blockers.push("knowledge_bridge_packaging_lock_mismatch");
  return { ready, blockers, reviewRows };
}

function evidenceSummary(input) {
  const value = input?.value;
  if (!value) return { path: input?.path || "", format: "", hash: "" };
  return { path: input.path || "", format: value.format || "", hash: sha256Object(value) };
}

function providerRoleUseTrace(runtimeGateValue) {
  const permission = runtimeGateValue?.runtimePermission || {};
  const evidence = runtimeGateValue?.evidence || {};
  const hashes = evidence.hashes || {};
  const required = permission.providerRoleUsePlanRequiredForScopedProvider === true;
  return {
    requiredForScopedProvider: required,
    accepted: permission.providerRoleUsePlanAccepted === true,
    providerRole: permission.providerRole || "",
    providerRoleUsePlanPath: evidence.providerRoleUsePlanPath || "",
    providerRoleUsePlanHash: hashes.providerRoleUsePlanHash || "",
    inheritedFromRuntimeGate: Boolean(evidence.providerRoleUsePlanPath || hashes.providerRoleUsePlanHash),
    nextGateSatisfied: !required || permission.providerRoleUsePlanAccepted === true
  };
}

const goal = argValue("--goal", argValue("--task", "Prepare a TLCL-approved medium-runtime dry-run handoff."));
const software = argValue("--software", argValue("--app", "target engineering software"));
const outRoot = resolve(argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-medium-runtime-dry-run-prep")));
const runtimeGate = readJsonInput(argValue("--runtime-gate", argValue("--tlcl-runtime-gate", "")), "--runtime-gate");
const spatialRouteBridge = readJsonInput(argValue("--spatial-route-bridge", argValue("--route-bridge", "")), "--spatial-route-bridge", true);
const knowledgeBridge = readJsonInput(
  argValue("--knowledge-augmented-spatial-bridge", argValue("--knowledge-spatial-bridge", "")),
  "--knowledge-augmented-spatial-bridge",
  true
);
const voiceApprovalGate = readJsonInput(
  argValue("--voice-execution-approval-gate", argValue("--engineering-voice-execution-approval-gate", "")),
  "--voice-execution-approval-gate",
  true
);
const teacherCorrection = argValue("--teacher-correction", argValue("--correction", ""));

const spatialRoute = routeEvidenceFromSpatialRoute(spatialRouteBridge.value);
const knowledgeRoute = routeEvidenceFromKnowledgeBridge(knowledgeBridge.value);
const providerRoleUse = providerRoleUseTrace(runtimeGate.value);
const tlclAllowed =
  runtimeGate.value?.format === "transparent_ai_tlcl_runtime_gate_v1" &&
  runtimeGate.value?.decision === "medium_runtime_allowed" &&
  runtimeGate.value?.runtimePermission?.canPrepareReviewedDryRun === true &&
  runtimeGate.value?.runtimePermission?.canExecuteTargetSoftware === false &&
  runtimeGate.value?.locks?.noSoftwareExecution === true;

const blockers = [];
if (!tlclAllowed) blockers.push("tlcl_runtime_gate_not_medium_runtime_allowed");
if (providerRoleUse.requiredForScopedProvider && !providerRoleUse.accepted) {
  blockers.push("provider_role_use_plan_not_accepted_by_runtime_gate");
}
if (teacherCorrection.trim()) blockers.push("teacher_correction_requires_senior_compile");
if (!spatialRoute.ready && !knowledgeRoute.ready && !voiceApprovalGate.value) {
  blockers.push("missing_teacher_confirmed_dry_run_route_evidence");
}
if (spatialRouteBridge.value && !spatialRoute.ready) blockers.push(...spatialRoute.blockers);
if (knowledgeBridge.value && !knowledgeRoute.ready) blockers.push(...knowledgeRoute.blockers);

const routeCandidates = spatialRoute.ready ? spatialRoute.routeCandidates : [];
const knowledgeReviewRows = knowledgeRoute.ready ? knowledgeRoute.reviewRows : [];
const ready = tlclAllowed && blockers.length === 0;
const status = !tlclAllowed || teacherCorrection.trim()
  ? "blocked_escalate_to_senior_compile"
  : ready
    ? "medium_runtime_dry_run_prep_ready_for_teacher_review"
    : "waiting_for_teacher_confirmed_route_evidence";

const prepId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const prepDir = join(outRoot, prepId);
const prepPath = join(prepDir, "tlcl-medium-runtime-dry-run-prep.json");
const receiptPath = join(prepDir, "tlcl-medium-runtime-dry-run-prep-receipt.json");
const readmePath = join(prepDir, "TLCL_MEDIUM_RUNTIME_DRY_RUN_PREP_START_HERE.md");

const packet = {
  format: "transparent_ai_tlcl_medium_runtime_dry_run_prep_v1",
  prepId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  status,
  runtimeTier: "medium_reasoning_runtime",
  compileTierOnCorrection: "senior_reasoning_compile",
  sourceEvidence: {
    runtimeGate: evidenceSummary(runtimeGate),
    providerRoleUsePlan: providerRoleUse,
    spatialRouteBridge: evidenceSummary(spatialRouteBridge),
    knowledgeAugmentedSpatialBridge: evidenceSummary(knowledgeBridge),
    voiceExecutionApprovalGate: evidenceSummary(voiceApprovalGate)
  },
  dryRunPreparation: {
    canPrepareDryRun: ready,
    providerRoleUsePlanAccepted: providerRoleUse.accepted,
    providerRole: providerRoleUse.providerRole,
    providerRoleUsePlanHash: providerRoleUse.providerRoleUsePlanHash,
    canExecuteTargetSoftware: false,
    canSendUiEvents: false,
    canEnableRules: false,
    canWriteMemory: false,
    routeCandidateCount: routeCandidates.length,
    knowledgeReviewRowCount: knowledgeReviewRows.length,
    routeCandidates: routeCandidates.map((candidate, index) => ({
      index: index + 1,
      adapterId: candidate.adapterId || "",
      label: candidate.label || candidate.adapterId || `route-${index + 1}`,
      dryRunHandoff: candidate.dryRunHandoff || null,
      requiredEvidenceBeforeDryRun: candidate.requiredEvidenceBeforeDryRun || [],
      blockersBeforeExecute: candidate.blockersBeforeExecute || []
    })),
    knowledgeReviewRows: knowledgeReviewRows.map((row, index) => ({
      index: index + 1,
      retrievedChunkRefs: row.retrievedChunkRefs || row.chunkRefs || [],
      nextAllowedAction: row.nextAllowedAction || "teacher_review_then_dry_run_route_only",
      blockedUntilTeacherReview: row.blockedUntilTeacherReview || ["execute_software", "enable_rule", "write_memory"]
    }))
  },
  mediumRuntimeInstructions: ready
    ? [
        "Restate the selected numbered target and dry-run route in public structured terms.",
        "Prepare only dry-run adapter arguments or a teacher review handoff.",
        "Stop if the teacher corrects target, logic, evidence, or route; send correction back to senior_reasoning_compile.",
        "Do not execute target software, send UI events, enable rules, write memory, capture screenshots, or unlock packaging."
      ]
    : [
        status === "blocked_escalate_to_senior_compile"
          ? "Return to senior_reasoning_compile before any medium runtime dry-run preparation."
          : "Collect teacher-confirmed route evidence before medium runtime dry-run preparation."
      ],
  escalationPacket: {
    escalates_to: "senior_reasoning_compile",
    triggers: blockers,
    teacherCorrection,
    repairTasks: blockers.length
      ? [
          "Repair or regenerate the TLCL runtime gate, spatial route bridge, knowledge bridge, or teacher confirmation evidence.",
          "Rerun deterministic validation before medium runtime prepares another dry-run.",
          "Keep route evidence review-only until teacher confirmation closes the relevant gate."
        ]
      : []
  },
  nextTeacherActions: ready
    ? [
        "Review the medium-runtime dry-run preparation packet.",
        "Choose one dry-run route candidate or ask for correction.",
        "If the dry-run is wrong, provide a teacher correction so the next pass escalates to senior compile.",
        "Use separate execution approval gates before any target software command."
      ]
    : [
        "Resolve blockers listed in escalationPacket.triggers.",
        "Confirm exactly one numbered target and detail-logic evidence before retrying.",
        "Do not ask medium runtime to improvise missing route evidence."
      ],
  completionBoundary: {
    provesFinalProduct: false,
    reason: "This packet proves only that medium reasoning may prepare a reviewed dry-run handoff under TLCL. It is not execution approval or final teacher acceptance."
  },
  locks: locks(),
  paths: { prep: prepPath, receipt: receiptPath, readme: readmePath }
};

const receipt = {
  format: "transparent_ai_tlcl_medium_runtime_dry_run_prep_receipt_v1",
  prepId,
  status,
  readyForTeacherReview: ready,
  canPrepareDryRun: ready,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullLogRead: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  blockers,
  locks: locks()
};

writeJson(prepPath, packet);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Dry-Run Prep",
    "",
    `Status: ${status}`,
    `Goal: ${goal}`,
    `Software: ${software}`,
    "",
    "This packet is the bridge from TLCL Runtime Gate to existing teacher-confirmed dry-run route tools.",
    "",
    "Allowed for medium reasoning:",
    "- restate the selected target and route evidence",
    "- prepare reviewed dry-run handoff arguments",
    "- ask the teacher to choose or correct one route",
    "",
    "Forbidden here: target software execution, UI events, screenshots, full-log reads, rule enablement, memory writes, packaging unlock, final completion claims.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"])
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_medium_runtime_dry_run_prep_result_v1",
      status,
      prepPath,
      receiptPath,
      readmePath,
      canPrepareDryRun: ready,
      routeCandidateCount: routeCandidates.length,
      knowledgeReviewRowCount: knowledgeReviewRows.length,
      blockers,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true
    },
    null,
    2
  )
);
