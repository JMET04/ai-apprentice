#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "spatial-target-confirmation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "spatial-target-confirmation";
}

function clamp01(value, fallback = 0.5) {
  const number = Number(value);
  if (Number.isNaN(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function readJsonInput(input, label) {
  if (!input) return { value: null, sourcePath: "", baseDir: process.cwd() };
  const text = String(input).trim();
  if (existsSync(text)) {
    const sourcePath = resolve(text);
    return { value: JSON.parse(readFileSync(sourcePath, "utf8")), sourcePath, baseDir: dirname(sourcePath) };
  }
  if (text.startsWith("{")) return { value: JSON.parse(text), sourcePath: "", baseDir: process.cwd() };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function centerOfBox(box) {
  if (!Array.isArray(box) || box.length < 4) return null;
  return {
    x: clamp01((Number(box[0]) + Number(box[2])) / 2),
    y: clamp01((Number(box[1]) + Number(box[3])) / 2),
    zHint: Number(box[4] || 0)
  };
}

function pointFromAction(action) {
  if (action?.kind === "click" && action.at) return action.at;
  if (action?.to) return action.to;
  if (action?.from) return action.from;
  return null;
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function uniqueCandidates(candidates, max) {
  const seen = new Set();
  const rows = [];
  for (const candidate of candidates) {
    const key = `${candidate.label}|${Math.round(candidate.normalizedTarget.x * 100)}|${Math.round(candidate.normalizedTarget.y * 100)}|${Math.round(Number(candidate.normalizedTarget.zHint || 0) * 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ ...candidate, number: rows.length + 1 });
    if (rows.length >= max) break;
  }
  return rows;
}

function relationshipReason(interpretation, id) {
  const relationships = [
    ...(Array.isArray(interpretation.declaredRelationships) ? interpretation.declaredRelationships : []),
    ...(Array.isArray(interpretation.inferredRelationships) ? interpretation.inferredRelationships : [])
  ].filter((row) => row.subject === id || row.object === id);
  if (relationships.length === 0) return "";
  return relationships
    .slice(0, 3)
    .map((row) => `${row.subject || "mark"} ${row.relation || "relates_to"} ${row.object || "target"}`)
    .join("; ");
}

function candidatesFromOverlay(overlayPacket, interpretation, maxCandidates) {
  const candidates = [];
  const anchors = Array.isArray(overlayPacket.anchors) ? overlayPacket.anchors : [];
  for (const anchor of anchors) {
    const center = centerOfBox(anchor.box);
    if (!center) continue;
    candidates.push({
      id: `spatial-anchor-${slugify(anchor.id || anchor.label)}`,
      label: anchor.label || anchor.id || "teacher marked region",
      normalizedTarget: {
        x: center.x,
        y: center.y,
        zHint: center.zHint,
        coordinateSource: "transparent_overlay_anchor_center"
      },
      reason: [
        "Teacher marked this region as an anchor on the transparent overlay.",
        relationshipReason(interpretation, anchor.id)
      ].filter(Boolean).join(" "),
      teacherReviewRequired: true,
      confidence: "medium",
      source: {
        kind: "overlay_anchor",
        id: anchor.id || "",
        relationshipEvidence: relationshipReason(interpretation, anchor.id)
      }
    });
  }

  const actions = Array.isArray(interpretation.suggestedActions) ? interpretation.suggestedActions : [];
  for (const action of actions) {
    const point = pointFromAction(action);
    if (!point) continue;
    const label = action.semanticLabel || `${action.kind || "spatial"} target from ${action.sourceStrokeId || "teacher stroke"}`;
    candidates.push({
      id: `spatial-action-${slugify(action.sourceStrokeId || label)}`,
      label,
      normalizedTarget: {
        x: clamp01(point.x),
        y: clamp01(point.y),
        zHint: Number(point.zHint || 0),
        coordinateSource: "spatial_intent_suggested_action"
      },
      reason: [
        `Spatial interpreter suggested a ${action.kind || "reviewed"} action here.`,
        action.spatialReason || "",
        relationshipReason(interpretation, action.sourceStrokeId)
      ].filter(Boolean).join(" "),
      teacherReviewRequired: true,
      confidence: action.confidence >= 0.65 ? "medium" : "low",
      source: {
        kind: "spatial_suggested_action",
        sourceStrokeId: action.sourceStrokeId || "",
        suggestedActionKind: action.kind || "",
        reviewQuestion: action.reviewQuestion || ""
      }
    });
  }

  const geometry = Array.isArray(interpretation.strokeGeometry) ? interpretation.strokeGeometry : [];
  for (const stroke of geometry) {
    if (!stroke.end) continue;
    candidates.push({
      id: `spatial-stroke-end-${slugify(stroke.strokeId)}`,
      label: stroke.semanticLabel || `${stroke.intentKind || "stroke"} endpoint`,
      normalizedTarget: {
        x: clamp01(stroke.end.x),
        y: clamp01(stroke.end.y),
        zHint: Number(stroke.end.zHint || 0),
        coordinateSource: "spatial_interpreted_stroke_endpoint"
      },
      reason: [
        "Fallback candidate from the interpreted stroke endpoint.",
        stroke.intentSummary || "",
        relationshipReason(interpretation, stroke.strokeId)
      ].filter(Boolean).join(" "),
      teacherReviewRequired: true,
      confidence: stroke.confidence >= 0.65 ? "medium" : "low",
      source: {
        kind: "spatial_stroke_geometry",
        strokeId: stroke.strokeId || "",
        mode: stroke.mode || "",
        depthRelation: stroke.depthRelation || ""
      }
    });
  }

  return uniqueCandidates(candidates, maxCandidates);
}

function jsonScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const overlayInput = argValue("--overlay-packet", argValue("--overlay", ""));
const interpretationInput = argValue("--spatial-intent", argValue("--interpretation", ""));
const goalOverride = argValue("--goal", argValue("--task", ""));
const softwareOverride = argValue("--software", argValue("--app", ""));
const command = argValue("--command", argValue("--text-command", ""));
const windowTitle = argValue("--window-title", "");
const processName = argValue("--process-name", "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "spatial-target-confirmation-kits")));
const maxCandidates = Number(argValue("--max-candidates", "6"));
const createActionKit = hasFlag("--create-action-kit");
const createExecutionAdapter = hasFlag("--create-execution-adapter");

const overlayParsed = readJsonInput(overlayInput, "--overlay-packet");
let overlayPacket = overlayParsed.value;
let overlayPath = overlayParsed.sourcePath;
let interpretationParsed = readJsonInput(interpretationInput, "--spatial-intent");
let interpretation = interpretationParsed.value;
let interpretationPath = interpretationParsed.sourcePath;

if (!overlayPacket && interpretation?.sourceOverlayPacket) {
  const source = interpretation.sourceOverlayPacket;
  if (existsSync(source)) {
    overlayPacket = JSON.parse(readFileSync(source, "utf8"));
    overlayPath = resolve(source);
  }
}

if (!overlayPacket || overlayPacket.format !== "transparent_ai_sketch_overlay_packet_v1") {
  throw new Error("--overlay-packet must provide transparent_ai_sketch_overlay_packet_v1 evidence");
}

mkdirSync(outputRoot, { recursive: true });
const kitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${softwareOverride || overlayPacket.software}-${goalOverride || overlayPacket.goal}`)}`;
const kitDir = join(outputRoot, kitId);
mkdirSync(kitDir, { recursive: true });

if (!interpretation || interpretation.format !== "transparent_ai_spatial_intent_interpretation_v1") {
  const result = runNodeScript("interpret-transparent-sketch-spatial-intent.mjs", [
    "--overlay-packet",
    overlayPath || JSON.stringify(overlayPacket),
    "--output-dir",
    join(kitDir, "spatial-intent")
  ]);
  interpretationPath = result.interpretationPath;
  interpretation = JSON.parse(readFileSync(interpretationPath, "utf8"));
}

const goal = goalOverride || overlayPacket.goal || interpretation.goal || "Confirm the teacher's transparent sketch target before software execution.";
const software = softwareOverride || overlayPacket.software || interpretation.software || "target software";
const candidates = candidatesFromOverlay(overlayPacket, interpretation, maxCandidates);
if (candidates.length === 0) {
  throw new Error("No spatial target candidates could be derived from overlay anchors, suggested actions, or stroke geometry");
}

const locks = {
  reviewOnly: true,
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  teacherConfirmationRequired: true,
  nativeUniversalExecution: false,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  selectedTargetOnly: false
};

const commandIntent = {
  format: "transparent_ai_spatial_target_command_intent_v1",
  sourceModalities: {
    transparentSketchProvided: true,
    spatialIntentInterpretationProvided: true,
    textCommandProvided: Boolean(command)
  },
  commandText: command || goal,
  interpretedOperation: "spatial_overlay_target_confirmation",
  targetUnderstandingStatus: "needs_numbered_candidate_confirmation",
  confidence: candidates.length === 1 ? "medium" : "low",
  publicReasoningTrace: [
    "Read the teacher's transparent overlay sketch and spatial interpretation.",
    "Derive possible target locations from anchors, action endpoints, and 2D/perspective/3D depth relationships.",
    "Mark those possible targets with numbers for teacher confirmation.",
    "Only the confirmed number may enter the existing supervised action bridge and execution adapter."
  ],
  unsupportedWithoutMoreEvidence: [
    "unconfirmed spatial target execution",
    "semantic native feature creation in arbitrary engineering software",
    "saving reusable memory before teacher approval"
  ]
};

const voiceControlWorkflow = {
  format: "transparent_ai_spatial_numbered_target_confirmation_workflow_v1",
  kitId,
  goal,
  software,
  sourceOverlayPacket: overlayPath || "",
  sourceSpatialIntentInterpretation: interpretationPath || "",
  workflow: [
    {
      step: 1,
      id: "read_teacher_spatial_evidence",
      publicTrace: "Use transparent overlay anchors, strokes, perspective cues, and depth hints as review evidence."
    },
    {
      step: 2,
      id: "derive_numbered_spatial_candidates",
      publicTrace: "Convert likely spatial targets into numbered candidates instead of executing immediately.",
      candidateCount: candidates.length
    },
    {
      step: 3,
      id: "teacher_confirms_number",
      publicTrace: "Wait for the teacher to confirm exactly one number or redraw/correct the target.",
      blocksExecutionUntilConfirmed: true
    },
    {
      step: 4,
      id: "reuse_existing_confirmation_bridge",
      publicTrace: "Pass the confirmed number through confirm_engineering_command_target, then dry-run action planning.",
      nextTool: "confirm_engineering_command_target"
    }
  ],
  lowTokenPolicy: {
    fullContinuousRecording: false,
    useExistingSpatialPacket: true,
    screenshotOnlyWhenTeacherAsksOrSignalsAreAmbiguous: true
  },
  locks
};

const commandIntentPath = join(kitDir, "spatial-target-command-intent.json");
const workflowPath = join(kitDir, "spatial-numbered-target-workflow.json");
const confirmationPath = join(kitDir, "spatial-numbered-target-confirmation.json");
const overlayPacketPath = join(kitDir, "spatial-numbered-target-overlay-packet.json");
const manifestPath = join(kitDir, "spatial-target-confirmation-manifest.json");
const htmlPath = join(kitDir, "spatial-target-confirmation.html");
const readmePath = join(kitDir, "SPATIAL_TARGET_CONFIRMATION_START_HERE.md");

const targetConfirmation = {
  format: "transparent_ai_numbered_target_confirmation_v1",
  kitId,
  goal,
  software,
  commandIntent: commandIntentPath,
  voiceControlWorkflow: workflowPath,
  sourceOverlayPacket: overlayPath || "",
  sourceSpatialIntentInterpretation: interpretationPath || "",
  status: "waiting_for_teacher_target_number",
  instructionToTeacher: "Confirm one numbered spatial target from the teacher sketch, or correct/redraw before any software action is compiled.",
  selectedCandidate: null,
  candidates,
  confirmationRequiredBefore: [
    "confirm_engineering_command_target",
    "create_supervised_software_action_kit",
    "create_existing_software_execution_adapter",
    "any mouse or keyboard event"
  ],
  executionAfterConfirmationPolicy: {
    nextTool: "confirm_engineering_command_target",
    selectedTargetOnly: true,
    dryRunFirst: true,
    requiresTargetWindowOrRoutePreflight: true,
    requiresSpatialReadinessConfirmation: true,
    requiresOutcomeVerification: true
  },
  spatialEvidenceSummary: {
    anchorCount: overlayPacket.anchors?.length ?? 0,
    strokeCount: overlayPacket.strokes?.length ?? 0,
    suggestedActionCount: interpretation.suggestedActions?.length ?? 0,
    inferredRelationshipCount: interpretation.inferredRelationships?.length ?? 0,
    supports2D: interpretation.summary?.supports2D === true,
    supportsPerspectiveRelationships: Number(interpretation.summary?.perspectiveCueCount || 0) > 0,
    supports3DDepthHints: interpretation.summary?.supports3DDepthHints === true
  },
  supportedSpatialRelations: ["moves_toward", "points_at", "perspective_to", "nearer_than", "farther_than"],
  locks
};

const numberedOverlayPacket = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  goal,
  software,
  overlayMode: "spatial_intent_numbered_target_confirmation",
  coordinateSpace: {
    origin: "top_left_screen_or_screenshot",
    units: "normalized_0_to_1",
    supports2D: interpretation.summary?.supports2D === true || overlayPacket.coordinateSpace?.supports2D === true,
    supports3DDepthHints: interpretation.summary?.supports3DDepthHints === true || overlayPacket.coordinateSpace?.supports3DDepthHints === true,
    targetNumbersRequireTeacherConfirmation: true
  },
  anchors: candidates.map((candidate) => ({
    id: candidate.id,
    type: "numbered_spatial_teacher_confirmation_candidate",
    number: candidate.number,
    label: `${candidate.number}. ${candidate.label}`,
    box: [
      clamp01(candidate.normalizedTarget.x - 0.035),
      clamp01(candidate.normalizedTarget.y - 0.035),
      clamp01(candidate.normalizedTarget.x + 0.035),
      clamp01(candidate.normalizedTarget.y + 0.035)
    ],
    reason: candidate.reason,
    source: candidate.source
  })),
  strokes: candidates.map((candidate) => ({
    id: `spatial-number-${candidate.number}-target-mark`,
    mode: Number(candidate.normalizedTarget.zHint || 0) !== 0 ? "depth_axis_3d" : "screen_2d",
    semanticLabel: `spatial candidate ${candidate.number}: ${candidate.label}`,
    targetAnchorId: candidate.id,
    points: [
      {
        x: candidate.normalizedTarget.x,
        y: candidate.normalizedTarget.y,
        zHint: Number(candidate.normalizedTarget.zHint || 0),
        t: 0,
        planeId: "screen_or_model_view"
      },
      {
        x: clamp01(candidate.normalizedTarget.x + 0.004),
        y: clamp01(candidate.normalizedTarget.y + 0.004),
        zHint: Number(candidate.normalizedTarget.zHint || 0),
        t: 30,
        planeId: "screen_or_model_view"
      }
    ]
  })),
  spatialIntent: {
    relationships: candidates.map((candidate) => ({
      subject: `spatial-number-${candidate.number}-target-mark`,
      relation: "candidate_target_for",
      object: "teacher_spatial_overlay_intent",
      teacherMustConfirmNumber: candidate.number
    })),
    perspectiveCues: interpretation.perspectiveCues ?? [],
    inferredTeacherIntent: "review_only: transparent sketch spatial intent becomes numbered target candidates before supervised action planning"
  },
  commandIntent: commandIntentPath,
  voiceControlWorkflow: workflowPath,
  targetConfirmation: confirmationPath,
  locks
};

const manifest = {
  ok: true,
  format: "transparent_ai_spatial_target_confirmation_kit_v1",
  kitId,
  goal,
  software,
  targetSoftware: {
    software,
    processName,
    windowTitle,
    requiresActiveTargetWindow: true
  },
  files: {
    teacherReadme: readmePath,
    browserHtml: htmlPath,
    commandIntent: commandIntentPath,
    spatialNumberedTargetWorkflow: workflowPath,
    targetConfirmation: confirmationPath,
    overlayPacket: overlayPacketPath,
    sourceOverlayPacket: overlayPath || "",
    spatialIntentInterpretation: interpretationPath || "",
    manifest: manifestPath
  },
  capabilities: {
    derivesCandidatesFromTransparentOverlay: true,
    derivesCandidatesFromSpatialIntent: true,
    preserves2DPositionPerspectiveAndDepthEvidence: true,
    supportedSpatialRelations: ["moves_toward", "points_at", "perspective_to", "nearer_than", "farther_than"],
    proposesNumberedTargets: true,
    requiresTeacherCandidateNumber: true,
    reusesConfirmationBridge: "confirm_engineering_command_target",
    nextBridge: "create_supervised_software_action_kit",
    existingAdapterBridge: "create_existing_software_execution_adapter",
    defaultMode: "review_only_no_execution",
    nativeUniversalExecution: false,
    softwareActionsExecuted: false
  },
  nextMcpCalls: [
    {
      when: "The teacher confirms exactly one spatial target number.",
      tool: "confirm_engineering_command_target",
      arguments: {
        confirmation: confirmationPath,
        selectedCandidateNumber: "<teacher confirmed number>",
        createActionKit,
        createExecutionAdapter
      }
    }
  ],
  locks
};

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Spatial Target Confirmation</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, Segoe UI, Arial, sans-serif; color: #17202a; background: #f8fafc; }
    main { max-width: 1100px; margin: 0 auto; padding: 20px; display: grid; gap: 14px; }
    section { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; background: #fff; }
    .workspace { position: relative; aspect-ratio: 16/9; border: 1px dashed #94a3b8; border-radius: 8px; background: #eef2f7; overflow: hidden; }
    .marker { position: absolute; transform: translate(-50%, -50%); width: 34px; height: 34px; border-radius: 50%; background: #7c3aed; color: #fff; display: grid; place-items: center; font-weight: 800; border: 0; }
    .marker.selected { outline: 4px solid rgba(124, 58, 237, .22); }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: left; background: #fff; }
    textarea { width: 100%; min-height: 140px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px; font: inherit; }
    button { cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <h1>Spatial Target Confirmation</h1>
    <section>
      <p>The teacher's transparent sketch has been converted into numbered target candidates. Confirm exactly one number before dry-run action planning.</p>
      <p>2D: ${targetConfirmation.spatialEvidenceSummary.supports2D}; perspective: ${targetConfirmation.spatialEvidenceSummary.supportsPerspectiveRelationships}; 3D depth: ${targetConfirmation.spatialEvidenceSummary.supports3DDepthHints}</p>
    </section>
    <section>
      <div class="workspace" id="workspace"></div>
      <div class="cards" id="cards"></div>
    </section>
    <section>
      <textarea id="jsonOut" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const confirmation = ${jsonScript(targetConfirmation)};
    const manifest = ${jsonScript(manifest)};
    let selected = null;
    const workspace = document.getElementById('workspace');
    const cards = document.getElementById('cards');
    const out = document.getElementById('jsonOut');
    function buildJson() {
      out.value = JSON.stringify({
        format: 'transparent_ai_spatial_target_confirmation_review_v1',
        manifest,
        targetConfirmation: { ...confirmation, status: selected ? 'teacher_selected_candidate_number' : 'waiting_for_teacher_target_number', selectedCandidateNumber: selected },
        nextAllowedTool: selected ? 'confirm_engineering_command_target' : 'none_until_teacher_confirms_number',
        softwareActionsExecuted: false,
        locks: confirmation.locks
      }, null, 2);
    }
    function render() {
      workspace.innerHTML = '';
      cards.innerHTML = '';
      for (const candidate of confirmation.candidates) {
        const marker = document.createElement('button');
        marker.className = 'marker' + (selected === candidate.number ? ' selected' : '');
        marker.style.left = (candidate.normalizedTarget.x * 100) + '%';
        marker.style.top = (candidate.normalizedTarget.y * 100) + '%';
        marker.textContent = candidate.number;
        marker.onclick = () => { selected = candidate.number; render(); buildJson(); };
        workspace.appendChild(marker);
        const card = document.createElement('button');
        card.className = 'card';
        card.innerHTML = '<strong>' + candidate.number + '. ' + candidate.label + '</strong><p>' + candidate.reason + '</p>';
        card.onclick = () => { selected = candidate.number; render(); buildJson(); };
        cards.appendChild(card);
      }
    }
    render();
    buildJson();
  </script>
</body>
</html>`;

writeFileSync(commandIntentPath, `${JSON.stringify(commandIntent, null, 2)}\n`, "utf8");
writeFileSync(workflowPath, `${JSON.stringify(voiceControlWorkflow, null, 2)}\n`, "utf8");
writeFileSync(confirmationPath, `${JSON.stringify(targetConfirmation, null, 2)}\n`, "utf8");
writeFileSync(overlayPacketPath, `${JSON.stringify(numberedOverlayPacket, null, 2)}\n`, "utf8");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
writeFileSync(htmlPath, html, "utf8");
writeFileSync(readmePath, [
  "# Spatial Target Confirmation Kit",
  "",
  `Goal: ${goal}`,
  `Software: ${software}`,
  "",
  "This bridge converts a teacher's transparent drawing mask evidence into numbered possible target locations.",
  "",
  "Workflow:",
  "",
  `1. Review ${basename(confirmationPath)} or open ${basename(htmlPath)}.`,
  "2. Confirm exactly one numbered target, or redraw/correct the candidates.",
  "3. Run confirm_engineering_command_target with the confirmed number.",
  "4. Continue into create_supervised_software_action_kit and create_existing_software_execution_adapter in dry-run-first mode.",
  "",
  "Locked defaults: softwareActionsExecuted=false, nativeUniversalExecution=false, fullContinuousRecording=false, ruleEnabled=false, accepted=false, packagingGated=true."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_spatial_target_confirmation_kit_result_v1",
  kitId,
  kitPath: manifestPath,
  teacherReadme: readmePath,
  browserHtml: htmlPath,
  commandIntent: commandIntentPath,
  spatialNumberedTargetWorkflow: workflowPath,
  targetConfirmation: confirmationPath,
  overlayPacket: overlayPacketPath,
  sourceOverlayPacket: overlayPath || "",
  spatialIntentInterpretation: interpretationPath || "",
  candidateCount: candidates.length,
  candidateNumbers: candidates.map((candidate) => candidate.number),
  nextConfirmationBridge: "confirm_engineering_command_target",
  nextBridge: "create_supervised_software_action_kit",
  existingAdapterBridge: "create_existing_software_execution_adapter",
  teacherConfirmationRequired: true,
  spatialEvidenceSummary: targetConfirmation.spatialEvidenceSummary,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false,
  reviewLocks: locks
}, null, 2));
