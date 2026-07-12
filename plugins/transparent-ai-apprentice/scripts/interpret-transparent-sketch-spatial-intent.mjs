#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return String(value || "spatial-intent")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "spatial-intent";
}

function readOverlayPacket(packetInput) {
  if (!packetInput) throw new Error("Missing --overlay-packet.");
  const trimmed = String(packetInput).trim();
  if (existsSync(trimmed)) return { packet: JSON.parse(readFileSync(trimmed, "utf8")), source: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { packet: JSON.parse(trimmed), source: "inline_json" };
  throw new Error(`Overlay packet was not a file path or JSON object: ${packetInput}`);
}

function firstPoint(stroke) {
  return Array.isArray(stroke?.points) && stroke.points.length > 0 ? stroke.points[0] : { x: 0.5, y: 0.5, zHint: 0 };
}

function lastPoint(stroke) {
  return Array.isArray(stroke?.points) && stroke.points.length > 0
    ? stroke.points[stroke.points.length - 1]
    : firstPoint(stroke);
}

function clamp01(value) {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function normalizedPoint(point) {
  return {
    xNormalized: clamp01(Number(point?.x ?? 0.5)),
    yNormalized: clamp01(Number(point?.y ?? 0.5)),
    zHint: Number(point?.zHint ?? 0),
    planeId: point?.planeId ?? ""
  };
}

function distance(a, b) {
  const dx = Number(a.x ?? 0) - Number(b.x ?? 0);
  const dy = Number(a.y ?? 0) - Number(b.y ?? 0);
  return Math.sqrt(dx * dx + dy * dy);
}

function directionName(start, end) {
  const dx = Number(end.x ?? 0) - Number(start.x ?? 0);
  const dy = Number(end.y ?? 0) - Number(start.y ?? 0);
  const horizontal = Math.abs(dx) > 0.04 ? (dx > 0 ? "right" : "left") : "";
  const vertical = Math.abs(dy) > 0.04 ? (dy > 0 ? "down" : "up") : "";
  return [vertical, horizontal].filter(Boolean).join("_") || "tap_or_point";
}

function centerOfBox(box) {
  if (!Array.isArray(box) || box.length < 4) return null;
  return {
    x: (Number(box[0]) + Number(box[2])) / 2,
    y: (Number(box[1]) + Number(box[3])) / 2
  };
}

function nearestAnchor(point, anchors) {
  let best = null;
  for (const anchor of anchors) {
    const center = centerOfBox(anchor.box);
    if (!center) continue;
    const d = distance(point, center);
    if (!best || d < best.distance) best = { anchor, distance: d };
  }
  return best;
}

function strokeKind(stroke, movement, zDelta) {
  const mode = String(stroke.mode ?? "screen_2d");
  const label = String(stroke.semanticLabel ?? "").toLowerCase();
  if (label.includes("click") || label.includes("tap")) return "click_target";
  if (label.includes("drag") || label.includes("move")) return "move_or_drag";
  if (Math.abs(zDelta) > 0.12 || mode === "depth_axis_3d") return "depth_axis_move";
  if (mode === "perspective_grid") return "perspective_alignment";
  if (movement > 0.08) return "move_or_drag";
  return "click_target";
}

function depthRelation(zDelta) {
  if (zDelta > 0.08) return "nearer_than_start";
  if (zDelta < -0.08) return "farther_than_start";
  return "same_depth_or_unspecified";
}

function confidenceFor(stroke, movement, nearestEndAnchor) {
  let score = 0.35;
  if (stroke.semanticLabel) score += 0.15;
  if (movement > 0.08) score += 0.15;
  if (nearestEndAnchor && nearestEndAnchor.distance < 0.18) score += 0.15;
  if (String(stroke.mode ?? "").includes("3d") || String(stroke.mode ?? "").includes("perspective")) score += 0.1;
  return Math.min(0.9, Number(score.toFixed(2)));
}

function suggestedActionFromStroke(geometry) {
  const base = {
    sourceStrokeId: geometry.strokeId,
    semanticLabel: geometry.semanticLabel,
    teacherReviewRequired: true,
    confidence: geometry.confidence,
    spatialReason: geometry.intentSummary
  };
  if (geometry.intentKind === "click_target") {
    return {
      ...base,
      kind: "click",
      at: geometry.end,
      reviewQuestion: "Did the teacher intend this mark as a click/tap target?"
    };
  }
  return {
    ...base,
    kind: "drag",
    from: geometry.start,
    to: geometry.end,
    reviewQuestion:
      geometry.intentKind === "depth_axis_move"
        ? "Does this drag preserve the teacher's intended depth direction?"
        : "Does this drag preserve the teacher's intended position/perspective relation?"
    };
}

function makeDetailLogicRow({ id, sourceElementId, detailCategory, classification, logicSource, sourceEvidence, teacherReviewRequired = true, blocksExecutionIfMissing = true }) {
  return {
    id,
    sourceElementId,
    detailCategory,
    classification,
    logicSource,
    sourceEvidence,
    teacherReviewRequired,
    blocksExecutionIfMissing,
    status:
      classification === "missing_evidence_blocks_execution"
        ? "blocked_missing_logic_source"
        : "ready_for_teacher_review"
  };
}

const overlayPacketInput = argValue("--overlay-packet", "");
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, ".transparent-apprentice", "spatial-intent-interpretations")));
const { packet: overlayPacket, source } = readOverlayPacket(overlayPacketInput);
if (overlayPacket.format !== "transparent_ai_sketch_overlay_packet_v1") {
  throw new Error(`Unsupported overlay packet format: ${overlayPacket.format}`);
}

mkdirSync(outputRoot, { recursive: true });
const interpretationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${overlayPacket.software}-${overlayPacket.goal}`)}`;
const interpretationDir = join(outputRoot, interpretationId);
mkdirSync(interpretationDir, { recursive: true });

const anchors = Array.isArray(overlayPacket.anchors) ? overlayPacket.anchors : [];
const strokes = Array.isArray(overlayPacket.strokes) ? overlayPacket.strokes : [];
const declaredRelationships = Array.isArray(overlayPacket.spatialIntent?.relationships)
  ? overlayPacket.spatialIntent.relationships
  : [];
const perspectiveCues = Array.isArray(overlayPacket.spatialIntent?.perspectiveCues)
  ? overlayPacket.spatialIntent.perspectiveCues
  : [];
const upstreamDetailRows = Array.isArray(overlayPacket.universalDetailLogicContract?.consequentialDetailRows)
  ? overlayPacket.universalDetailLogicContract.consequentialDetailRows
  : [];

const strokeGeometry = strokes.map((stroke, index) => {
  const startRaw = firstPoint(stroke);
  const endRaw = lastPoint(stroke);
  const movement = Number(distance(startRaw, endRaw).toFixed(4));
  const zDelta = Number((Number(endRaw.zHint ?? 0) - Number(startRaw.zHint ?? 0)).toFixed(4));
  const nearestStartAnchor = nearestAnchor(startRaw, anchors);
  const nearestEndAnchor = nearestAnchor(endRaw, anchors);
  const intentKind = strokeKind(stroke, movement, zDelta);
  const direction = directionName(startRaw, endRaw);
  const confidence = confidenceFor(stroke, movement, nearestEndAnchor);
  return {
    strokeId: stroke.id ?? `stroke-${index + 1}`,
    mode: stroke.mode ?? "screen_2d",
    semanticLabel: stroke.semanticLabel ?? "",
    start: normalizedPoint(startRaw),
    end: normalizedPoint(endRaw),
    movement,
    direction,
    zDelta,
    depthRelation: depthRelation(zDelta),
    nearestStartAnchorId: nearestStartAnchor?.anchor?.id ?? "",
    nearestEndAnchorId: nearestEndAnchor?.anchor?.id ?? "",
    targetAnchorId: stroke.targetAnchorId ?? nearestEndAnchor?.anchor?.id ?? "",
    intentKind,
    confidence,
    intentSummary: [
      intentKind,
      `direction=${direction}`,
      `depth=${depthRelation(zDelta)}`,
      nearestEndAnchor?.anchor?.id ? `near=${nearestEndAnchor.anchor.id}` : "no_near_anchor"
    ].join("; ")
  };
});

const inferredRelationships = strokeGeometry.flatMap((geometry) => {
  const rows = [];
  if (geometry.targetAnchorId) {
    rows.push({
      subject: geometry.strokeId,
      relation: geometry.movement > 0.08 ? "moves_toward" : "points_at",
      object: geometry.targetAnchorId,
      source: "nearest_anchor_or_target_anchor",
      confidence: geometry.confidence
    });
  }
  if (geometry.depthRelation === "nearer_than_start") {
    rows.push({
      subject: geometry.strokeId,
      relation: "nearer_than",
      object: geometry.targetAnchorId || "stroke_start",
      source: "zHint_delta",
      confidence: geometry.confidence
    });
  } else if (geometry.depthRelation === "farther_than_start") {
    rows.push({
      subject: geometry.strokeId,
      relation: "farther_than",
      object: geometry.targetAnchorId || "stroke_start",
      source: "zHint_delta",
      confidence: geometry.confidence
    });
  }
  if (String(geometry.mode).includes("perspective")) {
    rows.push({
      subject: geometry.strokeId,
      relation: "perspective_to",
      object: geometry.targetAnchorId || "drawn_perspective_axis",
      source: "stroke_mode",
      confidence: geometry.confidence
    });
  }
  return rows;
});

const derivedDetailLogicRows = [
  ...anchors.map((anchor) =>
    makeDetailLogicRow({
      id: `${anchor.id ?? "anchor"}-region-logic`,
      sourceElementId: anchor.id ?? "anchor",
      detailCategory: "position/alignment/relation",
      classification: Array.isArray(anchor.box) && anchor.box.length >= 4 ? "constraint_or_relationship_backed" : "missing_evidence_blocks_execution",
      logicSource: Array.isArray(anchor.box) && anchor.box.length >= 4 ? "teacher marked normalized anchor box" : "missing normalized anchor box",
      sourceEvidence: anchor,
      blocksExecutionIfMissing: true
    })
  ),
  ...strokeGeometry.flatMap((geometry) => {
    const rows = [
      makeDetailLogicRow({
        id: `${geometry.strokeId}-position-relation-logic`,
        sourceElementId: geometry.strokeId,
        detailCategory: "position/alignment/relation",
        classification: geometry.targetAnchorId ? "constraint_or_relationship_backed" : "missing_evidence_blocks_execution",
        logicSource: geometry.targetAnchorId
          ? "normalized start/end points plus teacher/nearest target anchor"
          : "missing teacher-confirmed target anchor",
        sourceEvidence: {
          start: geometry.start,
          end: geometry.end,
          targetAnchorId: geometry.targetAnchorId,
          nearestStartAnchorId: geometry.nearestStartAnchorId,
          nearestEndAnchorId: geometry.nearestEndAnchorId
        }
      }),
      makeDetailLogicRow({
        id: `${geometry.strokeId}-angle-direction-logic`,
        sourceElementId: geometry.strokeId,
        detailCategory: "angular/curvature",
        classification: "data_or_formula_backed",
        logicSource: "direction vector and movement distance derived from normalized first/last stroke points",
        sourceEvidence: {
          direction: geometry.direction,
          movement: geometry.movement,
          start: geometry.start,
          end: geometry.end
        }
      })
    ];
    if (String(geometry.mode).includes("perspective") || String(geometry.mode).includes("3d") || Math.abs(geometry.zDelta) > 0) {
      rows.push(
        makeDetailLogicRow({
          id: `${geometry.strokeId}-view-depth-perspective-logic`,
          sourceElementId: geometry.strokeId,
          detailCategory: "view/depth/perspective",
          classification: "constraint_or_relationship_backed",
          logicSource: "stroke mode plus zHint delta/depth relation",
          sourceEvidence: {
            mode: geometry.mode,
            zDelta: geometry.zDelta,
            depthRelation: geometry.depthRelation
          }
        })
      );
    }
    if (geometry.semanticLabel) {
      rows.push(
        makeDetailLogicRow({
          id: `${geometry.strokeId}-semantic-rule-logic`,
          sourceElementId: geometry.strokeId,
          detailCategory: "annotation/semantic/standard",
          classification: "teacher_exception_or_design_rule",
          logicSource: "teacher-provided semantic label",
          sourceEvidence: { semanticLabel: geometry.semanticLabel },
          blocksExecutionIfMissing: false
        })
      );
    }
    return rows;
  })
];

const allDetailLogicRows = [...upstreamDetailRows, ...derivedDetailLogicRows];
const missingDetailLogicRows = allDetailLogicRows.filter((row) => row.classification === "missing_evidence_blocks_execution");
const detailLogicContract = {
  format: "transparent_ai_universal_detail_logic_contract_v1",
  principle:
    overlayPacket.universalDetailLogicContract?.principle ||
    "All consequential sketch details must be logicized before execution; visual similarity alone is insufficient.",
  detailLogicScope: overlayPacket.universalDetailLogicContract?.detailLogicScope || [
    "measurable geometry",
    "angular/curvature",
    "pattern/spacing/count",
    "position/alignment/relation",
    "view/depth/perspective",
    "tolerance/fit/clearance",
    "annotation/semantic/standard",
    "material/process/manufacturing",
    "teacher exception/design rule",
    "decorative/non-parametric"
  ],
  requiredClassifications: overlayPacket.universalDetailLogicContract?.requiredClassifications || [
    "data_or_formula_backed",
    "constraint_or_relationship_backed",
    "teacher_exception_or_design_rule",
    "decorative_or_non_parametric",
    "missing_evidence_blocks_execution"
  ],
  consequentialDetailRows: allDetailLogicRows,
  missingDetailLogicRows,
  missingDetailLogicCount: missingDetailLogicRows.length,
  missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
  blockedActions: [
    "execute_or_generate_output_that_only_looks_similar_without_detail_logic",
    "treat_line_or_angle_examples_as_complete_scope",
    "generate_any_consequential_detail_without_logic_source"
  ]
};

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  teacherReviewRequired: true,
  nativeUniversalExecution: false
};

const interpretation = {
  format: "transparent_ai_spatial_intent_interpretation_v1",
  interpretationId,
  createdAt: new Date().toISOString(),
  sourceOverlayPacket: source,
  software: overlayPacket.software ?? "",
  goal: overlayPacket.goal ?? "",
  overlayMode: overlayPacket.overlayMode ?? "",
  coordinateSpace: overlayPacket.coordinateSpace ?? null,
  summary: {
    strokeCount: strokes.length,
    anchorCount: anchors.length,
    declaredRelationshipCount: declaredRelationships.length,
    inferredRelationshipCount: inferredRelationships.length,
    perspectiveCueCount: perspectiveCues.length,
    supports2D: overlayPacket.coordinateSpace?.supports2D === true,
    supports3DDepthHints: overlayPacket.coordinateSpace?.supports3DDepthHints === true,
    detailLogicItemCount: allDetailLogicRows.length,
    missingDetailLogicCount: missingDetailLogicRows.length,
    missingDetailLogicBlocksExecution: missingDetailLogicRows.length > 0,
    nativeUniversalExecution: false
  },
  strokeGeometry,
  declaredRelationships,
  inferredRelationships,
  perspectiveCues,
  detailLogicContract,
  suggestedActions: strokeGeometry.map(suggestedActionFromStroke),
  teacherReviewQuestions: [
    "Which suggested action preserves the teacher's intended position or perspective relation?",
    "Does any depth-axis stroke mean nearer/farther in the target software, or only visual emphasis?",
    "Which generated detail is backed by data, formula, constraint, teacher exception, or explicit non-parametric classification?",
    "Are any details only visually similar but missing a reviewed logic source?",
    "Should this spatial intent become a reusable rule, or remain a one-time supervised action?"
  ],
  nextTool: "create_supervised_software_action_kit",
  reviewLocks: locks
};

const interpretationPath = join(interpretationDir, "spatial-intent-interpretation.json");
writeFileSync(interpretationPath, `${JSON.stringify(interpretation, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_intent_interpretation_result_v1",
      interpretationId,
      interpretationPath,
      sourceOverlayPacket: source,
      strokeCount: strokes.length,
      inferredRelationshipCount: inferredRelationships.length,
      suggestedActionCount: interpretation.suggestedActions.length,
      perspectiveCueCount: perspectiveCues.length,
      detailLogicItemCount: allDetailLogicRows.length,
      missingDetailLogicCount: missingDetailLogicRows.length,
      missingLogicSourceBehavior: detailLogicContract.missingLogicSourceBehavior,
      nextTool: "create_supervised_software_action_kit",
      nativeUniversalExecution: false,
      reviewLocks: locks,
      openFirst: interpretationPath,
      note: `Review ${basename(interpretationPath)} before compiling any action plan.`
    },
    null,
    2
  )
);
