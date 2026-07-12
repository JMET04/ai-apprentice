#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arg, stableId, writeJson } from "./knowledge/knowledge-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readJsonInput(value, label, optional = false) {
  if (!value) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8").replace(/^\uFEFF/, "")), path: resolve(trimmed) };
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return { value: JSON.parse(trimmed), path: "" };
  if (optional) return { value: { reference: trimmed }, path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function lockState() {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    memoryEnabled: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    fullLogRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    nativeUniversalExecution: false,
    teacherConfirmationRequired: true,
    selectedNumberRequired: true,
    dryRunFirst: true
  };
}

function compact(value, max = 280) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function eventRows(knowledgePacket) {
  const rows = Array.isArray(knowledgePacket?.augmentedEvents) ? knowledgePacket.augmentedEvents : [];
  return rows.map((event, index) => ({
    number: index + 1,
    eventId: event.eventId || `augmented-event-${index + 1}`,
    classification: event.classification || "state_change",
    sourceType: event.sourceType || "unknown",
    compactEvidenceSnippet: compact(event.compactEvidenceSnippet || event.query || ""),
    retrievalStatus: event.retrievalStatus || "unknown",
    retrievedChunkCount: Number(event.retrievedChunkCount || 0),
    retrievalPacketPath: event.retrievalPacketPath || "",
    ruleDraftPath: event.ruleDraftPath || "",
    sourceEvidenceRefs: Array.isArray(event.sourceEvidenceRefs) ? event.sourceEvidenceRefs : [],
    ruleLifecycle: event.ruleLifecycle || "",
    teacherReviewRequired: true
  }));
}

function routeRows(routeBridge) {
  const rows = Array.isArray(routeBridge?.routeCandidates) ? routeBridge.routeCandidates : [];
  return rows.map((route, index) => ({
    number: index + 1,
    adapterId: route.adapterId || `adapter-${index + 1}`,
    label: route.label || route.adapterId || `adapter-${index + 1}`,
    score: Number(route.score || 0),
    dryRunHandoff: route.dryRunHandoff || null,
    verificationHandoff: route.verificationHandoff || null,
    requiredEvidenceBeforeDryRun: Array.isArray(route.requiredEvidenceBeforeDryRun) ? route.requiredEvidenceBeforeDryRun : [],
    blockersBeforeExecute: Array.isArray(route.blockersBeforeExecute) ? route.blockersBeforeExecute : [],
    teacherReviewRequired: true
  }));
}

function selectedTargetSummary(routeBridge) {
  const selected = routeBridge?.selectedTarget || null;
  const candidate = selected?.selectedCandidate || routeBridge?.selectedTarget?.candidate || null;
  return {
    selectedNumber: Number(selected?.selectedNumber || routeBridge?.selectedNumber || candidate?.number || 0),
    selectedTargetOnly: Boolean(routeBridge?.selectedTargetOnly || selected?.selectedTargetOnly || selected),
    candidateId: candidate?.id || "",
    candidateLabel: candidate?.label || "",
    normalizedTarget: candidate?.normalizedTarget || selected?.selectedPoint || null
  };
}

function evidenceStatus(knowledgeRows, routes, selectedTarget, routeBridge) {
  const failures = [];
  if (!knowledgeRows.length) failures.push("missing_knowledge_augmented_events");
  if (knowledgeRows.some((row) => row.retrievalStatus !== "evidence_found")) failures.push("retrieval_evidence_missing_for_some_events");
  if (!routes.length) failures.push("missing_spatial_execution_route_candidates");
  if (!selectedTarget.selectedNumber) failures.push("missing_teacher_confirmed_spatial_target_number");
  if (routeBridge?.detailLogicGate?.ready !== true) failures.push("spatial_detail_logic_not_ready");
  if (routeBridge?.locks?.softwareActionsExecuted !== false) failures.push("route_bridge_lock_mismatch");
  return {
    ready: failures.length === 0,
    failures,
    status: failures.length ? "blocked_waiting_for_teacher_review" : "ready_for_teacher_reviewed_dry_run_route"
  };
}

function buildReviewRows({ knowledgeRows, routes, selectedTarget, routeBridge }) {
  if (!knowledgeRows.length || !routes.length || !selectedTarget.selectedNumber || routeBridge?.detailLogicGate?.ready !== true) return [];
  const primaryRoute = routes[0];
  return knowledgeRows.map((event, index) => ({
    number: index + 1,
    eventId: event.eventId,
    classification: event.classification,
    evidenceQuestion:
      "Does the retrieved knowledge explain this compact software signal well enough to constrain the selected spatial action?",
    selectedTargetNumber: selectedTarget.selectedNumber,
    selectedTargetLabel: selectedTarget.candidateLabel,
    routeCandidateNumber: primaryRoute.number,
    adapterId: primaryRoute.adapterId,
    grounding: {
      compactEvidenceSnippet: event.compactEvidenceSnippet,
      sourceEvidenceRefs: event.sourceEvidenceRefs,
      retrievalPacketPath: event.retrievalPacketPath,
      ruleDraftPath: event.ruleDraftPath,
      spatialDetailLogicStatus: routeBridge.detailLogicGate.status,
      missingDetailLogicCount: routeBridge.detailLogicGate.missingDetailLogicCount || 0
    },
    nextAllowedAction: "teacher_review_then_dry_run_route_only",
    blockedUntilTeacherReview: [
      "execute_software",
      "enable_rule",
      "write_memory",
      "claim_outcome",
      "unlock_packaging",
      "claim_universal_native_execution"
    ],
    locks: lockState()
  }));
}

const goal =
  arg("--goal", "") ||
  arg("--task", "") ||
  "Bridge knowledge-augmented low-token software learning into a teacher-reviewed spatial execution rehearsal.";
const software = arg("--software", arg("--app", "target software"));
const knowledgeInput = readJsonInput(
  arg("--knowledge-augmented-learning", arg("--knowledge-packet", "")),
  "--knowledge-augmented-learning"
);
const routeBridgeInput = readJsonInput(arg("--spatial-route-bridge", arg("--route-bridge", "")), "--spatial-route-bridge");
const outputDir = resolve(arg("--output-dir", join(process.cwd(), ".transparent-apprentice", "knowledge-augmented-spatial-execution")));

const knowledgePacket = knowledgeInput.value;
const routeBridge = routeBridgeInput.value;
const knowledgeRows = eventRows(knowledgePacket);
const routes = routeRows(routeBridge);
const selectedTarget = selectedTargetSummary(routeBridge);
const gate = evidenceStatus(knowledgeRows, routes, selectedTarget, routeBridge);
const bridgeId = stableId(
  "knowledge_augmented_spatial_execution",
  `${knowledgeInput.path || JSON.stringify(knowledgePacket)}:${routeBridgeInput.path || JSON.stringify(routeBridge)}`
);
const bridgeDir = join(outputDir, bridgeId);
mkdirSync(bridgeDir, { recursive: true });

const reviewRows = buildReviewRows({ knowledgeRows, routes, selectedTarget, routeBridge });
const packetPath = join(bridgeDir, "knowledge-augmented-spatial-execution-bridge.json");
const receiptPath = join(bridgeDir, "knowledge-augmented-spatial-execution-bridge-receipt.json");
const readmePath = join(bridgeDir, "KNOWLEDGE_AUGMENTED_SPATIAL_EXECUTION_START_HERE.md");

const packet = {
  format: "transparent_ai_knowledge_augmented_spatial_execution_bridge_v1",
  bridgeId,
  createdAt: new Date().toISOString(),
  status: gate.status,
  goal,
  software,
  sourceEvidence: {
    knowledgeAugmentedLearningPath: knowledgeInput.path,
    knowledgeFormat: knowledgePacket?.format || "",
    sourceLearningPath: knowledgePacket?.sourceLearningPath || "",
    corpusIndexPath: knowledgePacket?.corpusIndexPath || "",
    spatialRouteBridgePath: routeBridgeInput.path,
    spatialRouteFormat: routeBridge?.format || "",
    spatialRouteStatus: routeBridge?.status || "",
    selectedTarget,
    detailLogicGate: routeBridge?.detailLogicGate || null
  },
  counts: {
    knowledgeAugmentedEvents: knowledgeRows.length,
    retrievalEvidenceRows: knowledgeRows.filter((row) => row.retrievalStatus === "evidence_found").length,
    routeCandidates: routes.length,
    reviewRows: reviewRows.length,
    rulesEnabled: 0,
    screenshotsCaptured: 0,
    softwareActionsExecuted: 0
  },
  knowledgeRows,
  routeRows: routes,
  reviewRows,
  readinessGate: gate,
  nextTeacherActions: gate.ready
    ? [
        "Review whether each retrieved knowledge chunk genuinely constrains the selected spatial action.",
        "Choose one dry-run route candidate and run its adapter only in dry-run mode.",
        "Review the dry-run receipt and post-action low-token checkpoint before any screenshot, memory, rule enablement, or execution claim."
      ]
    : [
        "Resolve each readinessGate failure before building a dry-run route.",
        "If retrieval evidence is missing, add local teacher/source material to the corpus and rerun augment_low_token_learning_with_retrieval.",
        "If spatial detail logic is not ready, ask the teacher to logicize the missing position, angle, depth, relation, exception, or decorative detail."
      ],
  blockedActions: [
    "execute_without_teacher_reviewed_knowledge_grounding",
    "execute_without_teacher_confirmed_spatial_target_number",
    "execute_with_missing_detail_logic",
    "treat_retrieval_as_rule_approval",
    "read_full_logs_to_fill_missing_context",
    "capture_screenshots_by_default",
    "write_memory",
    "enable_rule",
    "unlock_packaging",
    "claim_universal_native_execution"
  ],
  locks: lockState()
};

writeJson(packetPath, packet);
writeJson(receiptPath, {
  format: "transparent_ai_knowledge_augmented_spatial_execution_bridge_receipt_v1",
  bridgeId,
  status: packet.status,
  packetPath,
  knowledgeAugmentedLearningPath: knowledgeInput.path,
  spatialRouteBridgePath: routeBridgeInput.path,
  counts: packet.counts,
  readinessGate: gate,
  locks: packet.locks,
  teacherConfirmationRequired: true
});
writeFileSync(
  readmePath,
  [
    "# Knowledge-Augmented Spatial Execution Bridge",
    "",
    `Status: ${packet.status}`,
    "",
    "This bridge combines compact low-token software signals, retrieved local knowledge evidence, and a teacher-confirmed transparent sketch/spatial route.",
    "",
    "Review order:",
    "1. Check that retrieved knowledge evidence explains the compact software signal.",
    "2. Check that the selected numbered spatial target matches the teacher sketch.",
    "3. Check that every consequential position, angle, depth, perspective, and relation has logic evidence.",
    "4. Run only a dry-run route candidate, then review post-action low-token evidence.",
    "",
    "Blocked: full log reads, default screenshots, software execution, memory writes, rule enablement, packaging unlock, and universal native-execution claims."
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_knowledge_augmented_spatial_execution_bridge_result_v1",
  bridgeId,
  status: packet.status,
  packetPath,
  receiptPath,
  readmePath,
  knowledgeAugmentedEvents: packet.counts.knowledgeAugmentedEvents,
  routeCandidates: packet.counts.routeCandidates,
  reviewRows: packet.counts.reviewRows,
  readinessReady: gate.ready,
  readinessFailures: gate.failures,
  selectedNumber: selectedTarget.selectedNumber,
  softwareActionsExecuted: false,
  screenshotsCaptured: false,
  fullLogRead: false,
  rulesEnabled: 0,
  packagingGated: true,
  sourceName: basename(knowledgeInput.path || "inline-knowledge")
}, null, 2));
