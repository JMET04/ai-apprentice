#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return String(value || "transparent-sketch-overlay")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "transparent-sketch-overlay";
}

function writeUtf8Bom(path, text) {
  writeFileSync(path, `\uFEFF${text}`, "utf8");
}

const goal = argValue("--goal", "Let the teacher draw over software to explain intent.");
const software = argValue("--software", argValue("--app", "target software"));
const mode = argValue("--mode", "2d_3d");
const contentType = argValue("--content-type", "text");
const demoPreset = argValue("--demo-preset", "");
const apiEndpoint = argValue("--api-endpoint", "http://127.0.0.1:4317/api/mask-corrections");
if (!["text", "engineering"].includes(contentType)) {
  throw new Error(`Unsupported --content-type: ${contentType}. This separate workbench supports text or engineering only.`);
}
const backdropPath = argValue("--backdrop");
const outputRoot = argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "transparent-overlay-kits"));
mkdirSync(outputRoot, { recursive: true });
const kitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const kitDir = join(outputRoot, kitId);
mkdirSync(kitDir, { recursive: true });

const readmePath = join(kitDir, "TRANSPARENT_OVERLAY_START_HERE.md");
const browserOverlayPath = join(kitDir, "transparent-sketch-overlay.html");
const powershellOverlayPath = join(kitDir, "transparent-sketch-overlay.ps1");
const manifestPath = join(kitDir, "transparent-sketch-overlay-manifest.json");
const schemaPath = join(kitDir, "transparent-sketch-packet-schema.json");
const samplePacketPath = join(kitDir, "sample-transparent-sketch-packet.json");

const backdropMimeTypes = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};
const backdropExtension = extname(backdropPath).toLowerCase();
const backdropMimeType = backdropMimeTypes[backdropExtension] || "";
const initialBackdropName = backdropPath && existsSync(backdropPath) && backdropMimeType
  ? basename(backdropPath)
  : "";
const initialBackdropDataUrl = initialBackdropName
  ? `data:${backdropMimeType};base64,${readFileSync(backdropPath).toString("base64")}`
  : "";
const initialBackdropSha256 = initialBackdropName
  ? createHash("sha256").update(readFileSync(backdropPath)).digest("hex")
  : "";

const demoTimestamp = new Date().toISOString();
const engineeringDemoIntent = {
  kind: "engineering_edit",
  objectType: "dimension",
  objectId: "D04",
  action: "change_dimension",
  expectedValue: "450",
  unit: "mm",
  constraintNote: "只修改 D04 对应的箱口宽度；保持 D08、D10、面板拓扑、切线、折线和其他已确认尺寸不变。",
  objectIdentityConfirmedByTeacher: true,
  dimensionsMayNotBeInferredFromPixels: true
};
const textDemoIntent = {
  kind: "text_edit",
  documentType: "word_docx",
  locator: "paragraph:2",
  operation: "replace",
  sourceText: "周五",
  replacementText: "周一",
  typographyNote: "保持字号、颜色、字体和段落对齐方式不变",
  sourceTextConfirmedByTeacher: true,
  requiresExactTextMatch: true
};
const initialTextDocument = demoPreset === "office_text_replace"
  ? "项目说明\n\n本方案将在周五提交审核。\n\n其他段落保持不变。"
  : "";
const initialFields = demoPreset === "engineering_dimension_change" ? {
  maskRole: "change",
  editScopePolicy: "surgical_only",
  globalPreserveNote: "仅修改对象 D04；D08、D10、所有未标注对象、线型、颜色、面板拓扑和文字必须保持不变。",
  engineeringObjectType: "dimension",
  engineeringObjectId: "D04",
  engineeringAction: "change_dimension",
  engineeringValue: "450",
  engineeringUnit: "mm",
  engineeringConstraint: engineeringDemoIntent.constraintNote,
  issueType: "尺寸错误",
  workflowStep: "CAD 工程图生成",
  spatialMode: "screen_2d",
  correctionNote: "将 D04 对应尺寸精确改为 450 mm。不要重画整张图，也不要改变 D08、D10 或其他对象。"
} : demoPreset === "office_text_replace" ? {
  maskRole: "change",
  editScopePolicy: "surgical_only",
  globalPreserveNote: "保持其他段落、样式、表格、公式和文档结构不变。",
  textDocumentType: "word_docx",
  textLocator: "paragraph:2",
  textOperation: "replace",
  sourceText: "周五",
  replacementText: "周一",
  typographyNote: textDemoIntent.typographyNote,
  issueType: "文字与排版错误",
  workflowStep: "Word 文字修改",
  spatialMode: "screen_2d",
  correctionNote: "只把第 2 段中的“周五”替换为“周一”，其他文字和格式保持不变。"
} : {};
const engineeringAnnotations = demoPreset === "engineering_dimension_change" ? [
  {
    id: "engineering-change-D04",
    tool: "rect",
    role: "change",
    contentType: "engineering",
    editIntent: engineeringDemoIntent,
    mode: "screen_2d",
    semanticLabel: "D04 · change_dimension 450 mm",
    color: "#d4463a",
    width: 6,
    depthHint: 0,
    createdAt: demoTimestamp,
    points: [{ x: 0.49, y: 0.84, t: 0, pressure: 0.5, zHint: 0, planeId: "screen_2d" }, { x: 0.61, y: 0.96, t: 1, pressure: 0.5, zHint: 0, planeId: "screen_2d" }]
  },
  {
    id: "engineering-protect-approved-layout",
    tool: "rect",
    role: "protect",
    contentType: "engineering",
    editIntent: engineeringDemoIntent,
    mode: "screen_2d",
    semanticLabel: "保护已确认的面板与对象编号",
    color: "#26734a",
    width: 4,
    depthHint: 0,
    createdAt: demoTimestamp,
    points: [{ x: 0.035, y: 0.08, t: 0, pressure: 0.5, zHint: 0, planeId: "screen_2d" }, { x: 0.47, y: 0.82, t: 1, pressure: 0.5, zHint: 0, planeId: "screen_2d" }]
  },
  {
    id: "engineering-reference-D04",
    tool: "arrow",
    role: "reference",
    contentType: "engineering",
    editIntent: engineeringDemoIntent,
    mode: "screen_2d",
    semanticLabel: "尺寸值只绑定到对象 D04",
    color: "#1769a6",
    width: 5,
    depthHint: 0,
    createdAt: demoTimestamp,
    points: [{ x: 0.69, y: 0.76, t: 0, pressure: 0.5, zHint: 0, planeId: "screen_2d" }, { x: 0.55, y: 0.88, t: 1, pressure: 0.5, zHint: 0, planeId: "screen_2d" }]
  }
] : [];
const textAnnotations = demoPreset === "office_text_replace" ? [
  {
    id: "text-change-paragraph-2",
    tool: "rect",
    role: "change",
    contentType: "text",
    editIntent: textDemoIntent,
    mode: "screen_2d",
    semanticLabel: "paragraph:2 · 周五 → 周一",
    color: "#d4463a",
    width: 6,
    depthHint: 0,
    createdAt: demoTimestamp,
    points: [{ x: 0.2, y: 0.35, t: 0, pressure: 0.5, zHint: 0, planeId: "screen_2d" }, { x: 0.58, y: 0.48, t: 1, pressure: 0.5, zHint: 0, planeId: "screen_2d" }]
  },
  {
    id: "text-protect-other-content",
    tool: "rect",
    role: "protect",
    contentType: "text",
    editIntent: textDemoIntent,
    mode: "screen_2d",
    semanticLabel: "保护其他段落和文档结构",
    color: "#26734a",
    width: 4,
    depthHint: 0,
    createdAt: demoTimestamp,
    points: [{ x: 0.08, y: 0.12, t: 0, pressure: 0.5, zHint: 0, planeId: "screen_2d" }, { x: 0.88, y: 0.82, t: 1, pressure: 0.5, zHint: 0, planeId: "screen_2d" }]
  }
] : [];
const initialAnnotations = contentType === "engineering" ? engineeringAnnotations : textAnnotations;

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  nativeExecutionImplemented: false,
  teacherReviewRequired: true,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  memoryWritten: false
};

const universalDetailLogicContract = {
  format: "transparent_ai_universal_detail_logic_contract_v1",
  principle: "All consequential sketch details must be logicized before execution; visual similarity alone is insufficient.",
  detailLogicScope: [
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
  requiredClassifications: [
    "data_or_formula_backed",
    "constraint_or_relationship_backed",
    "teacher_exception_or_design_rule",
    "decorative_or_non_parametric",
    "missing_evidence_blocks_execution"
  ],
  missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
  blockedActions: [
    "execute_or_generate_output_that_only_looks_similar_without_detail_logic",
    "treat_line_or_angle_examples_as_complete_scope",
    "generate_any_consequential_detail_without_logic_source"
  ],
  locks
};

const packetSchema = {
  format: "transparent_ai_sketch_overlay_packet_schema_v1",
  supportedModes: ["screen_2d", "plane_2d", "perspective_grid", "depth_axis_3d"],
  supportedContentTypes: [contentType],
  supportedMaskRoles: ["change", "protect", "reference"],
  modificationFormat: "mingtu_multimodal_surgical_mask_correction_v1",
  strokeFields: ["id", "mode", "points", "color", "width", "semanticLabel", "targetAnchorId", "depthHint"],
  pointFields: ["x", "y", "t", "pressure", "zHint", "planeId"],
  relationshipFields: [
    "above",
    "below",
    "left_of",
    "right_of",
    "inside",
    "aligned_with",
    "parallel_to",
    "perspective_to",
    "nearer_than",
    "farther_than",
    "attached_to"
  ],
  perspectiveFields: ["vanishingPoint", "horizonLine", "depthAxis", "planeNormalHint"],
  detailLogicContractFields: [
    "format",
    "principle",
    "detailLogicScope",
    "requiredClassifications",
    "consequentialDetailRows",
    "missingLogicSourceBehavior",
    "blockedActions"
  ],
  outputFormat: "transparent_ai_sketch_overlay_packet_v1",
  universalDetailLogicContract,
  locks
};

const samplePacket = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  modificationFormat: "mingtu_multimodal_surgical_mask_correction_v1",
  kitId,
  software,
  goal,
  createdAt: new Date().toISOString(),
  fullContinuousRecording: false,
  overlayMode: mode,
  coordinateSpace: {
    origin: "top_left_screen_or_screenshot",
    units: "normalized_0_to_1",
    supports2D: true,
    supports3DDepthHints: true,
    supportsPerspectiveRelationships: true
  },
  anchors: [
    { id: "target-region", type: "teacher_marked_region", label: "2D target area the teacher points at", box: [0.25, 0.25, 0.55, 0.55] },
    { id: "perspective-plane", type: "teacher_marked_plane", label: "plane that should receive the moved feature", box: [0.56, 0.22, 0.84, 0.46] },
    { id: "near-depth-pocket", type: "teacher_marked_depth_target", label: "nearer 3D depth target", box: [0.62, 0.12, 0.82, 0.3] }
  ],
  strokes: [
    {
      id: "stroke-2d-position",
      mode: "screen_2d",
      semanticLabel: "move this result here",
      color: "#ff3b30",
      width: 4,
      targetAnchorId: "target-region",
      depthHint: "same_plane",
      points: [
        { x: 0.2, y: 0.7, t: 0, zHint: 0, planeId: "screen" },
        { x: 0.55, y: 0.35, t: 80, zHint: 0, planeId: "screen" }
      ]
    },
    {
      id: "stroke-perspective-plane",
      mode: "perspective_grid",
      semanticLabel: "align this face to the perspective plane",
      color: "#ff9500",
      width: 4,
      targetAnchorId: "perspective-plane",
      depthHint: "same_plane_perspective",
      points: [
        { x: 0.3, y: 0.72, t: 0, zHint: 0.05, planeId: "screen" },
        { x: 0.68, y: 0.34, t: 120, zHint: 0.18, planeId: "perspective_plane" }
      ]
    },
    {
      id: "stroke-3d-depth",
      mode: "depth_axis_3d",
      semanticLabel: "bring this feature forward in depth",
      color: "#007aff",
      width: 4,
      targetAnchorId: "near-depth-pocket",
      depthHint: "nearer_than_start",
      points: [
        { x: 0.64, y: 0.48, t: 0, zHint: 0.08, planeId: "far_depth" },
        { x: 0.72, y: 0.2, t: 140, zHint: 0.46, planeId: "near_depth" }
      ]
    }
  ],
  spatialIntent: {
    relationships: [
      { subject: "stroke-2d-position", relation: "attached_to", object: "target-region" },
      { subject: "stroke-perspective-plane", relation: "perspective_to", object: "perspective-plane" },
      { subject: "stroke-3d-depth", relation: "nearer_than", object: "near-depth-pocket" }
    ],
    perspectiveCues: [
      { strokeId: "stroke-perspective-plane", cue: "perspective_grid" },
      { strokeId: "stroke-3d-depth", cue: "depth_axis_3d" }
    ],
    inferredTeacherIntent: "review_only: teacher drew 2D position, perspective-plane, and 3D depth cues to explain where and how the operation should affect the software state"
  },
  proposedSoftwareAction: {
    executionMode: "teacher_review_only",
    nativeExecutionImplemented: false,
    requiresToolAdapter: true,
    draftAction: "Map the marked region and arrow to a candidate software action only after teacher review."
  },
  universalDetailLogicContract: {
    ...universalDetailLogicContract,
    consequentialDetailRows: [
      {
        id: "sample-stroke-2d-position",
        sourceElementId: "stroke-2d-position",
        detailCategory: "position/alignment/relation",
        classification: "constraint_or_relationship_backed",
        logicSource: "normalized start/end points plus attached target-region anchor",
        teacherReviewRequired: true,
        blocksExecutionIfMissing: true
      },
      {
        id: "sample-stroke-2d-direction",
        sourceElementId: "stroke-2d-position",
        detailCategory: "angular/curvature",
        classification: "data_or_formula_backed",
        logicSource: "direction vector from first point to last point",
        teacherReviewRequired: true,
        blocksExecutionIfMissing: true
      },
      {
        id: "sample-stroke-perspective-plane",
        sourceElementId: "stroke-perspective-plane",
        detailCategory: "view/depth/perspective",
        classification: "constraint_or_relationship_backed",
        logicSource: "perspective_grid mode plus perspective-plane anchor and zHint delta",
        teacherReviewRequired: true,
        blocksExecutionIfMissing: true
      },
      {
        id: "sample-stroke-3d-depth",
        sourceElementId: "stroke-3d-depth",
        detailCategory: "view/depth/perspective",
        classification: "constraint_or_relationship_backed",
        logicSource: "depth_axis_3d mode plus nearer_than relationship and zHint delta",
        teacherReviewRequired: true,
        blocksExecutionIfMissing: true
      }
    ]
  },
  locks
};

if (initialAnnotations.length) {
  const modificationTargets = initialAnnotations.map((annotation) => {
    const xs = annotation.points.map((point) => point.x);
    const ys = annotation.points.map((point) => point.y);
    return {
      id: annotation.id,
      contentType: annotation.contentType,
      role: annotation.role,
      label: annotation.semanticLabel,
      maskGeometry: {
        kind: annotation.tool,
        box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        points: annotation.points,
        coordinateUnits: "normalized_0_to_1"
      },
      editIntent: annotation.editIntent,
      preserveOutsideThisMask: true,
      teacherReviewRequired: true,
      completeness: {
        complete: true,
        reason: annotation.role === "change"
          ? contentType === "engineering" ? "engineering_object_action_and_parameter_present" : "exact_source_and_text_operation_present"
          : `${annotation.role}_relationship_present`
      }
    };
  });
  const changeTargets = modificationTargets.filter((target) => target.role === "change");
  const protectionRegions = modificationTargets.filter((target) => target.role === "protect");
  const referenceRelations = modificationTargets.filter((target) => target.role === "reference");
  Object.assign(samplePacket, {
    workbenchFormat: "mingtu_teacher_mask_correction_v1",
    activeContentType: contentType,
    supportedContentTypes: [contentType],
    modificationTargets,
    changeTargets,
    preservationRegions: protectionRegions,
    referenceRelations,
    surgicalEditContract: {
      format: "mingtu_surgical_edit_contract_v1",
      policy: "surgical_only",
      selectedChangeTargetIds: changeTargets.map((target) => target.id),
      explicitProtectionRegionIds: protectionRegions.map((target) => target.id),
      globalPreserveInstruction: initialFields.globalPreserveNote,
      changeOnlyInsideSelectedTargets: true,
      preserveAllUnmarkedContent: true,
      fullRegenerationAllowed: false,
      localEditFailureBehavior: "block_and_return_to_teacher_without_regenerating",
      validation: {
        textOutsideTargets: contentType === "text" ? "exact_text_and_style_match_required" : "not_applicable",
        imageOutsideTargets: "not_applicable",
        engineeringOutsideTargets: contentType === "engineering" ? "unselected_entity_ids_parameters_constraints_and_topology_must_match_before_state" : "not_applicable",
        beforeAfterComparisonRequired: true,
        rejectIfUnmarkedContentChanged: true
      }
    },
    teacherCorrection: {
      requestedEditMode: contentType === "engineering" ? "engineering_object_edit_only" : "text_region_edit_only",
      editScopePolicy: "surgical_only",
      preserveUnmarkedRegions: true,
      rejectWholeArtifactReplacementForLocalIssue: true
    },
    proposedSoftwareAction: {
      executionMode: "teacher_review_only",
      nativeExecutionImplemented: false,
      requiresToolAdapter: true,
      targetIds: changeTargets.map((target) => target.id),
      fullArtifactReplacementPrepared: false,
      draftAction: contentType === "engineering"
        ? "Change only the confirmed D04 dimension through a reviewed engineering adapter."
        : "Replace only the confirmed native Word paragraph text through the Office adapter."
    }
  });
}

const legacyHtml = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>包装图纸蒙版纠错</title>
  <style>
    html, body { margin: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.02); overflow: hidden; font-family: system-ui, sans-serif; }
    #backdrop { position: fixed; inset: 0; width: 100vw; height: 100vh; object-fit: contain; opacity: 0.72; pointer-events: none; }
    #bar { position: fixed; left: 12px; top: 12px; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; max-width: min(980px, calc(100vw - 24px)); background: rgba(255,255,255,0.94); border: 1px solid rgba(15,23,42,0.18); padding: 10px; border-radius: 8px; box-shadow: 0 8px 28px rgba(15,23,42,0.14); }
    button, select, input { min-height: 36px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; padding: 0 10px; font: inherit; }
    button { cursor: pointer; font-weight: 650; }
    button:hover { background: #f1f5f9; }
    #export { border-color: #0f766e; background: #0f766e; color: #fff; }
    #export:hover { background: #115e59; }
    .field { display: inline-flex; align-items: center; gap: 6px; color: #334155; font-size: 13px; }
    #sessionStatus { color: #475569; font-size: 12px; }
    canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; cursor: crosshair; touch-action: none; }
    #preview { position: fixed; right: 12px; bottom: 12px; width: 360px; max-height: 34vh; overflow: auto; background: rgba(255,255,255,0.92); border: 1px solid rgba(15,23,42,0.16); padding: 8px; border-radius: 8px; font: 12px ui-monospace, monospace; white-space: pre-wrap; }
  </style>
</head>
<body>
  <img id="backdrop" alt="" />
  <canvas id="canvas"></canvas>
  <div id="bar">
    <label class="field">更换底图 <input id="backdropFile" type="file" accept="image/*" title="选择包装图纸底图" /></label>
    <select id="kind">
      <option value="stroke">画线 / 圈选 / 箭头</option>
      <option value="anchor">框选区域</option>
    </select>
    <select id="mode">
      <option value="screen_2d">二维图纸纠错</option>
      <option value="plane_2d">二维平面关系</option>
      <option value="perspective_grid">透视关系</option>
      <option value="depth_axis_3d">三维深度关系</option>
    </select>
    <input id="label" placeholder="写下修改要求" aria-label="修改要求" />
    <label class="field">深度 <input id="depth" type="range" min="-1" max="1" step="0.05" value="0" /></label>
    <button id="undo" type="button">撤销</button>
    <button id="clear" type="button">清空标注</button>
    <button id="export" type="button">提交纠错</button>
    <span id="sessionStatus">底图和标注仅保存在本次本地纠错会话</span>
  </div>
  <pre id="preview"></pre>
  <script>
    const kitId = "__KIT_ID__";
    const software = "__SOFTWARE__";
    const goal = "__GOAL__";
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const preview = document.getElementById("preview");
    const backdrop = document.getElementById("backdrop");
    const initialBackdropName = "__BACKDROP_NAME__";
    const initialBackdropDataUrl = "__BACKDROP_DATA_URL__";
    const strokes = [];
    const anchors = [];
    let current = null;
    let backgroundName = initialBackdropName;
    if (initialBackdropDataUrl) backdrop.src = initialBackdropDataUrl;
    function resize() { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); redraw(); }
    addEventListener("resize", resize); resize();
    function point(e) { return { x: e.clientX / innerWidth, y: e.clientY / innerHeight, t: Date.now(), pressure: e.pressure || 0.5, zHint: Number(document.getElementById("depth").value), planeId: document.getElementById("mode").value }; }
    function boxFromPoints(a, b) { return [Math.min(a.x,b.x), Math.min(a.y,b.y), Math.max(a.x,b.x), Math.max(a.y,b.y)]; }
    function redraw() {
      ctx.clearRect(0,0,innerWidth,innerHeight);
      ctx.lineWidth = 2; ctx.strokeStyle = "#34c759"; ctx.setLineDash([6,4]);
      for (const anchor of anchors) {
        const [x1,y1,x2,y2] = anchor.box;
        ctx.strokeRect(x1 * innerWidth, y1 * innerHeight, (x2-x1) * innerWidth, (y2-y1) * innerHeight);
        ctx.fillStyle = "rgba(52,199,89,0.14)";
        ctx.fillRect(x1 * innerWidth, y1 * innerHeight, (x2-x1) * innerWidth, (y2-y1) * innerHeight);
      }
      ctx.setLineDash([]);
      for (const stroke of strokes) drawStroke(stroke);
      if (current) drawStroke(current);
      preview.textContent = JSON.stringify(packet(), null, 2);
    }
    function drawStroke(stroke) {
      if (stroke.points.length < 2) return;
      ctx.lineWidth = stroke.width; ctx.strokeStyle = stroke.color; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      stroke.points.forEach((p, i) => { const x = p.x * innerWidth, y = p.y * innerHeight; if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
      ctx.stroke();
    }
    function packet() {
      const detailRows = [
        ...anchors.map(anchor => ({
          id: anchor.id + "-region",
          sourceElementId: anchor.id,
          detailCategory: "position/alignment/relation",
          classification: "constraint_or_relationship_backed",
          logicSource: "teacher marked normalized anchor box",
          teacherReviewRequired: true,
          blocksExecutionIfMissing: true
        })),
        ...strokes.flatMap(stroke => {
          const first = stroke.points[0] || {};
          const last = stroke.points[stroke.points.length - 1] || first;
          const rows = [
            {
              id: stroke.id + "-position",
              sourceElementId: stroke.id,
              detailCategory: "position/alignment/relation",
              classification: stroke.targetAnchorId ? "constraint_or_relationship_backed" : "missing_evidence_blocks_execution",
              logicSource: stroke.targetAnchorId ? "stroke targetAnchorId plus normalized start/end points" : "missing target anchor or teacher-confirmed object",
              teacherReviewRequired: true,
              blocksExecutionIfMissing: true
            },
            {
              id: stroke.id + "-angle-direction",
              sourceElementId: stroke.id,
              detailCategory: "angular/curvature",
              classification: "data_or_formula_backed",
              logicSource: "direction vector from normalized first point to last point",
              values: { dx: Number(((last.x || 0) - (first.x || 0)).toFixed(4)), dy: Number(((last.y || 0) - (first.y || 0)).toFixed(4)) },
              teacherReviewRequired: true,
              blocksExecutionIfMissing: true
            }
          ];
          if (stroke.mode === "perspective_grid" || stroke.mode === "depth_axis_3d") {
            rows.push({
              id: stroke.id + "-view-depth-perspective",
              sourceElementId: stroke.id,
              detailCategory: "view/depth/perspective",
              classification: "constraint_or_relationship_backed",
              logicSource: "stroke mode plus zHint/depthHint evidence",
              teacherReviewRequired: true,
              blocksExecutionIfMissing: true
            });
          }
          if (stroke.semanticLabel) {
            rows.push({
              id: stroke.id + "-semantic",
              sourceElementId: stroke.id,
              detailCategory: "annotation/semantic/standard",
              classification: "teacher_exception_or_design_rule",
              logicSource: "teacher intent label",
              teacherReviewRequired: true,
              blocksExecutionIfMissing: false
            });
          }
          return rows;
        })
      ];
      return {
        format: "transparent_ai_sketch_overlay_packet_v1",
        kitId, software, goal,
        createdAt: new Date().toISOString(),
        fullContinuousRecording: false,
        overlayMode: document.getElementById("mode").value,
        background: { kind: backgroundName ? "teacher_supplied_screenshot" : "transparent_screen_overlay", fileName: backgroundName },
        coordinateSpace: { origin: "top_left_screen_or_screenshot", units: "normalized_0_to_1", supports2D: true, supports3DDepthHints: true, supportsPerspectiveRelationships: true },
        anchors,
        strokes,
        spatialIntent: {
          relationships: strokes.map(s => ({ subject: s.id, relation: s.mode === "depth_axis_3d" ? "nearer_than" : s.mode === "perspective_grid" ? "perspective_to" : "position_hint", object: s.targetAnchorId || s.semanticLabel || "teacher-mark" })),
          perspectiveCues: strokes.filter(s => s.mode.includes("perspective") || s.mode.includes("3d")).map(s => ({ strokeId: s.id, cue: s.mode })),
          inferredTeacherIntent: "review_only: use stroke positions, relative relationships, and depth hints as teacher intent evidence"
        },
        proposedSoftwareAction: { executionMode: "teacher_review_only", nativeExecutionImplemented: false, requiresToolAdapter: true },
        universalDetailLogicContract: {
          format: "transparent_ai_universal_detail_logic_contract_v1",
          principle: "All consequential sketch details must be logicized before execution; visual similarity alone is insufficient.",
          detailLogicScope: ["measurable geometry", "angular/curvature", "pattern/spacing/count", "position/alignment/relation", "view/depth/perspective", "tolerance/fit/clearance", "annotation/semantic/standard", "material/process/manufacturing", "teacher exception/design rule", "decorative/non-parametric"],
          requiredClassifications: ["data_or_formula_backed", "constraint_or_relationship_backed", "teacher_exception_or_design_rule", "decorative_or_non_parametric", "missing_evidence_blocks_execution"],
          consequentialDetailRows: detailRows,
          missingDetailLogicCount: detailRows.filter(row => row.classification === "missing_evidence_blocks_execution").length,
          missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
          blockedActions: ["execute_or_generate_output_that_only_looks_similar_without_detail_logic", "treat_line_or_angle_examples_as_complete_scope", "generate_any_consequential_detail_without_logic_source"]
        },
        locks: { ruleEnabled: false, accepted: false, technologyAccepted: false, packagingGated: true }
      };
    }
    canvas.addEventListener("pointerdown", e => { current = { id: "stroke-" + (strokes.length + 1), kind: kind.value, mode: mode.value, semanticLabel: label.value, color: mode.value.includes("3d") ? "#007aff" : mode.value.includes("perspective") ? "#ff9500" : "#ff3b30", width: 4, targetAnchorId: anchors.at(-1)?.id || "", points: [point(e)] }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => { if (!current) return; current.points.push(point(e)); redraw(); });
    function finishPointer(e) { if (!current) return; current.points.push(point(e)); if (current.kind === "anchor") { const anchor = { id: "anchor-" + (anchors.length + 1), type: "teacher_marked_region", label: current.semanticLabel || "老师框选区域", box: boxFromPoints(current.points[0], current.points.at(-1)) }; anchors.push(anchor); } else { strokes.push(current); } current = null; redraw(); }
    canvas.addEventListener("pointerup", finishPointer);
    canvas.addEventListener("pointercancel", () => { current = null; redraw(); });
    addEventListener("blur", () => { current = null; redraw(); });
    undo.onclick = () => { if (strokes.length) strokes.pop(); else anchors.pop(); redraw(); };
    clear.onclick = () => { strokes.length = 0; anchors.length = 0; redraw(); };
    backdropFile.onchange = () => { const file = backdropFile.files?.[0]; if (!file) return; backgroundName = file.name; backdrop.src = URL.createObjectURL(file); redraw(); };
    document.getElementById("export").onclick = async () => {
      const text = JSON.stringify(packet(), null, 2);
      await navigator.clipboard?.writeText(text).catch(() => {});
      const link = document.createElement("a");
      link.download = "transparent-sketch-packet.json";
      link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      link.click();
      preview.textContent = text + "\n\n纠错已导出为 transparent-sketch-packet.json，可交给学徒继续修改图纸。";
    };
  </script>
</body>
</html>`;

const workbenchRoot = resolve(
  __dirname,
  "..",
  "assets",
  contentType === "text" ? "text-mask-workbench" : "engineering-software-mask-workbench"
);
const workbenchTemplatePath = join(workbenchRoot, "index.template.html");
const workbenchStylesPath = join(workbenchRoot, "styles.css");
const workbenchScriptPath = join(workbenchRoot, "app.js");
const submissionClientPath = resolve(__dirname, "..", "assets", "mask-submission-client.js");
if (![workbenchTemplatePath, workbenchStylesPath, workbenchScriptPath, submissionClientPath].every(existsSync)) {
  throw new Error(`AI Apprentice mask workbench assets are incomplete under ${workbenchRoot}`);
}

function replaceToken(text, token, value) {
  return text.split(token).join(String(value));
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inlineJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

const workbenchConfig = {
  format: contentType === "text" ? "mingtu_office_text_mask_workbench_config_v1" : "mingtu_engineering_software_mask_workbench_config_v1",
  kitId,
  software,
  goal,
  mode,
  contentType,
  demoPreset,
  apiEndpoint,
  initialBackdropName,
  initialBackdropDataUrl,
  initialBackdropSha256,
  initialTextDocument,
  initialFields,
  initialAnnotations,
  canvasWidth: 1344,
  canvasHeight: 756,
  reviewLocks: locks
};

let html = readFileSync(workbenchTemplatePath, "utf8");
html = replaceToken(html, "__INLINE_STYLES__", readFileSync(workbenchStylesPath, "utf8"));
html = replaceToken(html, "__INLINE_SCRIPT__", readFileSync(workbenchScriptPath, "utf8"));
html = replaceToken(html, "__MASK_SUBMISSION_CLIENT__", readFileSync(submissionClientPath, "utf8"));
html = replaceToken(html, "__OVERLAY_CONFIG__", inlineJson(workbenchConfig));
html = replaceToken(html, "__KIT_ID__", htmlEscape(kitId));
html = replaceToken(html, "__SOFTWARE__", htmlEscape(software));
html = replaceToken(html, "__GOAL__", htmlEscape(goal));
html = replaceToken(html, "__BACKDROP_NAME__", htmlEscape(initialBackdropName || "尚未加载底图"));

const powershellOverlay = String.raw`Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$Out = Join-Path $PSScriptRoot "transparent-sketch-packet.json"
$KitId = "__KIT_ID__"
$Software = "__SOFTWARE__"
$Goal = "__GOAL__"
$Form = New-Object System.Windows.Forms.Form
$Form.Text = "Transparent AI Apprentice Overlay - 1:2D 2:Perspective 3:3D Depth Up/Down:Depth S:Save Esc:Close"
$Form.TopMost = $true
$Form.WindowState = "Maximized"
$Form.Opacity = 0.32
$Form.BackColor = [System.Drawing.Color]::White
$Form.FormBorderStyle = "None"
$Form.KeyPreview = $true
$Strokes = New-Object System.Collections.ArrayList
$Current = New-Object System.Collections.ArrayList
$Drawing = $false
$script:CurrentMode = "screen_2d"
$script:CurrentDepth = 0.0
$script:CurrentPlane = "screen"

function Get-ModeColor($Mode) {
  if ($Mode -eq "depth_axis_3d") { return [System.Drawing.Color]::Blue }
  if ($Mode -eq "perspective_grid") { return [System.Drawing.Color]::Orange }
  return [System.Drawing.Color]::Red
}

function Get-DepthHint($Depth) {
  if ($Depth -gt 0.08) { return "nearer_than_start" }
  if ($Depth -lt -0.08) { return "farther_than_start" }
  return "same_plane"
}

function New-OverlayPoint($X, $Y) {
  return @{
    x = $X
    y = $Y
    t = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    zHint = [Math]::Round([double]$script:CurrentDepth, 3)
    planeId = $script:CurrentPlane
  }
}

$Form.Add_MouseDown({
  $script:Drawing = $true
  $script:Current.Clear()
  [void]$script:Current.Add((New-OverlayPoint $_.X $_.Y))
})
$Form.Add_MouseMove({
  if ($script:Drawing) {
    [void]$script:Current.Add((New-OverlayPoint $_.X $_.Y))
    $Form.Invalidate()
  }
})
$Form.Add_MouseUp({
  if ($script:Drawing) {
    $script:Drawing = $false
    [void]$script:Current.Add((New-OverlayPoint $_.X $_.Y))
    [void]$script:Strokes.Add(@{
      id = "stroke-$($script:Strokes.Count+1)"
      mode = $script:CurrentMode
      semanticLabel = "teacher overlay stroke ($script:CurrentMode depth=$script:CurrentDepth)"
      color = if ($script:CurrentMode -eq "depth_axis_3d") { "#007aff" } elseif ($script:CurrentMode -eq "perspective_grid") { "#ff9500" } else { "#ff3b30" }
      width = 4
      depthHint = (Get-DepthHint $script:CurrentDepth)
      points = @($script:Current)
    })
    $script:Current = New-Object System.Collections.ArrayList
    $Form.Invalidate()
  }
})
$Form.Add_Paint({
  $Graphics = $_.Graphics
  foreach ($Stroke in $script:Strokes) {
    $Pen = New-Object System.Drawing.Pen((Get-ModeColor $Stroke.mode), 4)
    if ($Stroke.mode -eq "perspective_grid") { $Pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash }
    for ($i=1; $i -lt $Stroke.points.Count; $i++) {
      $Graphics.DrawLine($Pen, $Stroke.points[$i-1].x, $Stroke.points[$i-1].y, $Stroke.points[$i].x, $Stroke.points[$i].y)
    }
    $Pen.Dispose()
  }
  if ($script:Current.Count -gt 1) {
    $Pen = New-Object System.Drawing.Pen((Get-ModeColor $script:CurrentMode), 4)
    for ($i=1; $i -lt $script:Current.Count; $i++) {
      $Graphics.DrawLine($Pen, $script:Current[$i-1].x, $script:Current[$i-1].y, $script:Current[$i].x, $script:Current[$i].y)
    }
    $Pen.Dispose()
  }
  $Status = "Mode=$script:CurrentMode Depth=$script:CurrentDepth  1:2D 2:Perspective 3:3D Up/Down depth S save Esc close"
  $Graphics.DrawString($Status, (New-Object System.Drawing.Font("Segoe UI", 14)), [System.Drawing.Brushes]::Black, 20, 20)
})
$Form.Add_KeyDown({
  if ($_.KeyCode -eq "Escape") { $Form.Close() }
  if ($_.KeyCode -eq "D1") { $script:CurrentMode = "screen_2d"; $script:CurrentPlane = "screen"; $script:CurrentDepth = 0.0; $Form.Invalidate() }
  if ($_.KeyCode -eq "D2") { $script:CurrentMode = "perspective_grid"; $script:CurrentPlane = "perspective_plane"; $Form.Invalidate() }
  if ($_.KeyCode -eq "D3") { $script:CurrentMode = "depth_axis_3d"; $script:CurrentPlane = "depth_axis"; $Form.Invalidate() }
  if ($_.KeyCode -eq "Up") { $script:CurrentDepth = [Math]::Min(1.0, [Math]::Round($script:CurrentDepth + 0.05, 2)); $Form.Invalidate() }
  if ($_.KeyCode -eq "Down") { $script:CurrentDepth = [Math]::Max(-1.0, [Math]::Round($script:CurrentDepth - 0.05, 2)); $Form.Invalidate() }
  if ($_.KeyCode -eq "S") {
    $Width = [Math]::Max(1, $Form.ClientSize.Width)
    $Height = [Math]::Max(1, $Form.ClientSize.Height)
    $NormalizedStrokes = @($script:Strokes | ForEach-Object {
      $Stroke = $_
      [pscustomobject]@{
        id = $Stroke.id
        mode = $Stroke.mode
        semanticLabel = $Stroke.semanticLabel
        color = $Stroke.color
        width = $Stroke.width
        depthHint = $Stroke.depthHint
        points = @($Stroke.points | ForEach-Object {
          [pscustomobject]@{
            x = [Math]::Round(([double]$_.x / $Width), 6)
            y = [Math]::Round(([double]$_.y / $Height), 6)
            t = $_.t
            zHint = $_.zHint
            planeId = $_.planeId
          }
        })
      }
    })
    $Relationships = @($NormalizedStrokes | ForEach-Object {
      $Relation = if ($_.mode -eq "depth_axis_3d") { "nearer_than" } elseif ($_.mode -eq "perspective_grid") { "perspective_to" } else { "position_hint" }
      [pscustomobject]@{ subject=$_.id; relation=$Relation; object="teacher_marked_live_software_region" }
    })
    $PerspectiveCues = @($NormalizedStrokes | Where-Object { $_.mode -eq "perspective_grid" -or $_.mode -eq "depth_axis_3d" } | ForEach-Object {
      [pscustomobject]@{ strokeId=$_.id; cue=$_.mode; depthHint=$_.depthHint }
    })
    $Packet = [pscustomobject]@{
      format="transparent_ai_sketch_overlay_packet_v1"; kitId=$KitId; software=$Software; goal=$Goal; createdAt=(Get-Date).ToUniversalTime().ToString("o"); fullContinuousRecording=$false; overlayMode="live_topmost_2d_perspective_3d";
      coordinateSpace=[pscustomobject]@{ origin="top_left_screen_or_screenshot"; units="normalized_0_to_1"; supports2D=$true; supports3DDepthHints=$true; supportsPerspectiveRelationships=$true };
      anchors=@(); strokes=$NormalizedStrokes;
      spatialIntent=[pscustomobject]@{ relationships=$Relationships; perspectiveCues=$PerspectiveCues; inferredTeacherIntent="review_only: live top-most overlay strokes encode position, perspective, and depth hints over visible software" };
      proposedSoftwareAction=[pscustomobject]@{ executionMode="teacher_review_only"; nativeExecutionImplemented=$false; requiresToolAdapter=$true };
      universalDetailLogicContract=[pscustomobject]@{
        format="transparent_ai_universal_detail_logic_contract_v1";
        principle="All consequential sketch details must be logicized before execution; visual similarity alone is insufficient.";
        detailLogicScope=@("measurable geometry","angular/curvature","pattern/spacing/count","position/alignment/relation","view/depth/perspective","tolerance/fit/clearance","annotation/semantic/standard","material/process/manufacturing","teacher exception/design rule","decorative/non-parametric");
        requiredClassifications=@("data_or_formula_backed","constraint_or_relationship_backed","teacher_exception_or_design_rule","decorative_or_non_parametric","missing_evidence_blocks_execution");
        consequentialDetailRows=@($NormalizedStrokes | ForEach-Object {
          [pscustomobject]@{
            id="$($_.id)-position-angle-depth";
            sourceElementId=$_.id;
            detailCategory=if ($_.mode -eq "depth_axis_3d" -or $_.mode -eq "perspective_grid") { "view/depth/perspective" } else { "position/alignment/relation" };
            classification="constraint_or_relationship_backed";
            logicSource="normalized live stroke coordinates plus mode, direction, and zHint/depthHint";
            teacherReviewRequired=$true;
            blocksExecutionIfMissing=$true
          }
        });
        missingDetailLogicCount=0;
        missingLogicSourceBehavior="block_execute_and_route_to_teacher_review";
        blockedActions=@("execute_or_generate_output_that_only_looks_similar_without_detail_logic","treat_line_or_angle_examples_as_complete_scope","generate_any_consequential_detail_without_logic_source")
      };
      locks=[pscustomobject]@{ ruleEnabled=$false; accepted=$false; technologyAccepted=$false; packagingGated=$true }
    }
    $Packet | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Out -Encoding UTF8
  }
})
[void]$Form.ShowDialog()
`;

const manifest = {
  format: contentType === "text" ? "mingtu_office_text_mask_workbench_v1" : "mingtu_engineering_software_mask_workbench_v1",
  kitId,
  goal,
  software,
  mode,
  contentType,
  demoPreset: demoPreset || null,
  files: {
    readme: readmePath,
    browserOverlay: browserOverlayPath,
    powershellOverlay: powershellOverlayPath,
    packetSchema: schemaPath,
    samplePacket: samplePacketPath,
    manifest: manifestPath
  },
  capabilities: {
    transparentDrawingMask: true,
    browserOverlay: true,
    browserBackdropImage: true,
    responsiveMaskWorkbench: true,
    freehandEllipseRectangleArrowAndText: true,
    textContentRegionReplacement: true,
    plainTextMarkdownCsvAndJsonBackdropRendering: true,
    imageLocalEditMask: false,
    engineeringObjectDimensionAnnotationAndCommandTargetMask: true,
    changeProtectAndReferenceMaskRoles: true,
    surgicalEditOutsideMaskPreservationContract: true,
    fullRegenerationRequiresSeparateTeacherChoice: true,
    undoRedoAndDraftRestore: true,
    annotationListAndReadonlyPlayback: true,
    zoomFitTouchAndKeyboard: true,
    submitLoadingSuccessAndFailureStates: true,
    downloadablePacketExport: true,
    windowsTopMostOverlayScript: true,
    normalizedPowerShellCoordinates: true,
    supports2DPlaneSketch: true,
    supports3DDepthHints: true,
    supportsPerspectiveRelationships: true,
    exportsStructuredSpatialIntent: true,
    exportsUniversalDetailLogicContract: true,
    rejectsVisualSimilarityWithoutLogic: true,
    nativeSoftwareExecutionImplemented: false,
    executionMode: "teacher_review_only"
  },
  nextTeachingCall: {
    tool: "teach_apprentice",
    message: "Paste transparent_ai_sketch_overlay_packet_v1 after drawing. Use it as spatial teaching evidence."
  },
  locks
};

writeFileSync(readmePath, [
  contentType === "text" ? "# AI 学徒办公文字修改蒙版" : "# AI 学徒工程软件修改蒙版",
  "",
  `任务：${goal}`,
  `目标工具：${software}`,
  "",
  contentType === "text"
    ? "打开 `transparent-sketch-overlay.html` 后，用框选和文字标出 Word 或 Excel 中需要修改的原生文字，并填写段落或单元格定位器、原文、新文和排版约束。它是独立的办公文字工作台，不会改变原来的工程图片蒙版。"
    : "打开 `transparent-sketch-overlay.html` 后，在工程软件截图上标出修改对象、保护对象和参考关系，并填写对象编号、动作、目标值、单位和约束。它是独立的工程软件工作台，不会改变原来的工程图片蒙版。",
  "",
  "默认策略是只修改选中的目标，并保持未标注内容不变。导出的 `mingtu_multimodal_surgical_mask_correction_v1` 兼容包包含修改目标、保护区域、参考关系和外部零改动验证；局部修改不可行时也必须先停下，由老师决定是否查看单独的整体重生成候选。",
  "",
  "Image2 像素不是工程尺寸真值。所有重要细节都会进入 `transparent_ai_universal_detail_logic_contract_v1`；位置、方向、透视、深度、尺寸、材料与工艺必须绑定已确认的数据、约束或老师规则。缺少逻辑来源时，系统会停止执行并返回人工复核。",
  "",
  "Windows 顶层蒙版备用路线：运行 `transparent-sketch-overlay.ps1`。按 1 选择二维，按 2 选择透视，按 3 选择三维深度，方向键上/下调整深度，按 S 保存，按 Esc 关闭。",
  "",
  "默认边界：仅供老师审校；未技术验收；规则未启用；包装投产仍锁定。"
].join("\n"), "utf8");
writeFileSync(
  browserOverlayPath,
  html,
  "utf8"
);
writeUtf8Bom(
  powershellOverlayPath,
  powershellOverlay.replaceAll("__KIT_ID__", kitId).replaceAll("__SOFTWARE__", software).replaceAll("__GOAL__", goal)
);
writeFileSync(schemaPath, JSON.stringify(packetSchema, null, 2), "utf8");
writeFileSync(samplePacketPath, JSON.stringify(samplePacket, null, 2), "utf8");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: contentType === "text" ? "mingtu_office_text_mask_workbench_result_v1" : "mingtu_engineering_software_mask_workbench_result_v1",
  kitId,
  kitPath: manifestPath,
  teacherReadme: readmePath,
  browserOverlay: browserOverlayPath,
  initialBackdrop: initialBackdropName || null,
  initialBackdropSha256: initialBackdropSha256 || null,
  contentType,
  demoPreset: demoPreset || null,
  powershellOverlay: powershellOverlayPath,
  packetSchema: schemaPath,
  samplePacket: samplePacketPath,
  transparentDrawingMask: true,
  responsiveMaskWorkbench: true,
  supportsFreehandEllipseRectangleArrowAndText: true,
  dedicatedMaskType: contentType,
  supportsTextImageAndEngineeringMasks: false,
  supportsChangeProtectAndReferenceRoles: true,
  enforcesSurgicalEditAndOutsideMaskPreservation: true,
  supportsUndoRedoDraftRestoreAndReadonlyPlayback: true,
  supports2DPlaneSketch: true,
  supports3DDepthHints: true,
  exportsUniversalDetailLogicContract: true,
  rejectsVisualSimilarityWithoutLogic: true,
  nativeSoftwareExecutionImplemented: false,
  reviewLocks: locks
}, null, 2));
