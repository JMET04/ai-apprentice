import crypto from "node:crypto";

const CATEGORY_PREFIX = {
  edge: "E",
  face: "F",
  special: "S",
  dimension: "D",
};

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(round(value, 2));
}

function interpolateAxis(value, points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error("Registration axis requires at least two control points");
  }
  const sorted = [...points].sort((a, b) => a.mm - b.mm);
  let left = sorted[0];
  let right = sorted[1];
  if (value >= sorted.at(-1).mm) {
    left = sorted.at(-2);
    right = sorted.at(-1);
  } else if (value > sorted[0].mm) {
    for (let index = 1; index < sorted.length; index += 1) {
      if (value <= sorted[index].mm) {
        left = sorted[index - 1];
        right = sorted[index];
        break;
      }
    }
  }
  const span = right.mm - left.mm;
  if (span === 0) throw new Error("Registration control points cannot share the same mm coordinate");
  return left.px + ((value - left.mm) / span) * (right.px - left.px);
}

export function transformPoint(pointMm, profile) {
  if (!Array.isArray(pointMm) || pointMm.length !== 2) {
    throw new Error("Expected [x, y] engineering coordinate");
  }
  return [
    Math.round(interpolateAxis(Number(pointMm[0]), profile.xAxis)),
    Math.round(interpolateAxis(Number(pointMm[1]), profile.yAxis)),
  ];
}

function lineLength(endpoints) {
  if (!Array.isArray(endpoints) || endpoints.length !== 4) return null;
  return round(Math.hypot(endpoints[2] - endpoints[0], endpoints[3] - endpoints[1]));
}

function engineeringValue(object) {
  if (Number.isFinite(object.value_mm)) {
    const value = round(Number(object.value_mm));
    return { kind: "length", value, unit: "mm", display: `${formatNumber(value)} mm` };
  }
  if (Array.isArray(object.bounds_mm) && object.bounds_mm.length === 4) {
    const width = round(Math.abs(object.bounds_mm[2] - object.bounds_mm[0]));
    const height = round(Math.abs(object.bounds_mm[3] - object.bounds_mm[1]));
    return {
      kind: "bounds",
      width,
      height,
      unit: "mm",
      display: `${formatNumber(width)} x ${formatNumber(height)} mm`,
    };
  }
  const length = lineLength(object.endpoints_mm);
  if (length !== null) {
    return { kind: "length", value: length, unit: "mm", display: `${formatNumber(length)} mm` };
  }
  return null;
}

function relatedObjectIds(object) {
  const ids = [];
  for (const key of ["face_id", "edge_id", "dimension_id"]) {
    if (typeof object[key] === "string") ids.push(object[key]);
  }
  for (const key of ["face_ids", "edge_ids", "dimension_ids"]) {
    if (Array.isArray(object[key])) ids.push(...object[key].filter((item) => typeof item === "string"));
  }
  return [...new Set(ids)];
}

function displayGroupDescriptor(label) {
  const valueKey = label.engineeringValue?.display || "no-value";
  const semantic = label.semanticKey || "";

  if (label.category === "dimension") {
    if (/^(?:opening_width_panel_\d+|panel_length_panel_\d+|panel_\d+_width)$/u.test(semantic)) {
      return { key: `dimension:panel-width:${valueKey}`, title: "同宽面板" };
    }
    if (/^(?:top|bottom)_flap_depth_panel_\d+$/u.test(semantic)) {
      return { key: `dimension:flap-depth:${valueKey}`, title: "上下摇盖深度" };
    }
  }

  if (label.category === "face") {
    if (/^body_panel_\d+$/u.test(semantic)) {
      return { key: `face:body-panel:${valueKey}`, title: "同尺寸箱体面" };
    }
    if (/^(?:top|bottom)_flap_panel_\d+$/u.test(semantic)) {
      return { key: `face:flap-panel:${valueKey}`, title: "同尺寸摇盖面" };
    }
  }

  if (label.category === "special") {
    if (/^glue_line_\d+$/u.test(semantic)) {
      return { key: `special:glue-line:${valueKey}`, title: "同规格胶线" };
    }
    if (/^(?:top|bottom)_opposing_long_flaps$/u.test(semantic)) {
      return { key: "special:opposing-long-flaps", title: "上下对合长摇盖" };
    }
  }

  if (label.category === "edge" && label.engineeringValue) {
    const lineTitle = label.lineType === "crease" ? "同长度压线" : "同长度刀线";
    return {
      key: `edge:${label.lineType || "line"}:${valueKey}`,
      title: lineTitle,
    };
  }

  return { key: `${label.category}:single:${label.id}`, title: label.label };
}

function representativeLabel(labels) {
  const center = labels.reduce((sum, label) => [sum[0] + label.anchorPx[0], sum[1] + label.anchorPx[1]], [0, 0])
    .map((value) => value / labels.length);
  return [...labels].sort((a, b) => {
    const distanceA = Math.hypot(a.anchorPx[0] - center[0], a.anchorPx[1] - center[1]);
    const distanceB = Math.hypot(b.anchorPx[0] - center[0], b.anchorPx[1] - center[1]);
    return distanceA - distanceB || a.id.localeCompare(b.id);
  })[0];
}

function contextualGroupTitle(descriptor, labels) {
  if (descriptor.title === "同宽面板") {
    const panelNumbers = labels.map((label) => /面板(\d+)/u.exec(label.label)?.[1]).filter(Boolean);
    if (panelNumbers.length === labels.length) return `面板${panelNumbers.join("/")}宽度`;
  }
  if (descriptor.title === "同尺寸箱体面") {
    const panelNumbers = labels.map((label) => /面板(\d+)/u.exec(label.label)?.[1]).filter(Boolean);
    if (panelNumbers.length === labels.length) return `面板${panelNumbers.join("/")}箱体面`;
  }
  return descriptor.title;
}

export function buildDisplayGroups(labels) {
  const buckets = new Map();
  for (const label of labels) {
    const descriptor = displayGroupDescriptor(label);
    if (!buckets.has(descriptor.key)) buckets.set(descriptor.key, { descriptor, labels: [] });
    buckets.get(descriptor.key).labels.push(label);
  }

  return [...buckets.values()].map(({ descriptor, labels: members }) => {
    const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
    const representative = representativeLabel(sorted);
    const memberObjectIds = sorted.map((label) => label.id);
    const values = [...new Set(sorted.map((label) => label.engineeringValue?.display).filter(Boolean))];
    const title = sorted.length === 1 ? representative.label : contextualGroupTitle(descriptor, sorted);
    return {
      id: `G:${memberObjectIds.join("+")}`,
      category: representative.category,
      title,
      relation: sorted.length === 1 ? "single_object" : "equivalent_engineering_value",
      representativeObjectId: representative.id,
      memberObjectIds,
      memberCount: sorted.length,
      anchorPx: representative.anchorPx,
      memberAnchors: sorted.map((label) => ({ objectId: label.id, anchorPx: label.anchorPx })),
      engineeringValue: values.length === 1 ? representative.engineeringValue : null,
      defaultVisible: representative.defaultVisible,
    };
  });
}

export function buildOverlayManifest({ caseId, baseImage, catalogFile, catalog, profile }) {
  if (!caseId || !baseImage?.sha256 || !Array.isArray(catalog?.objects)) {
    throw new Error("Overlay manifest requires a case, immutable base image, and object catalog");
  }
  const labels = catalog.objects.map((object) => {
    const value = engineeringValue(object);
    const prefix = CATEGORY_PREFIX[object.category] || object.id?.[0] || "?";
    if (!object.id?.startsWith(prefix)) {
      throw new Error(`Object ${object.id || "<missing>"} does not match category ${object.category}`);
    }
    return {
      id: object.id,
      category: object.category,
      semanticKey: object.semantic_key || "",
      label: object.label || object.id,
      lineType: object.line_type || null,
      sourceAnchorMm: object.anchor_mm,
      anchorPx: transformPoint(object.anchor_mm, profile),
      engineeringValue: value,
      displayText: value ? `${object.id} · ${value.display}` : object.id,
      relatedObjectIds: relatedObjectIds(object),
      defaultVisible: object.category !== "edge",
    };
  });
  const displayGroups = buildDisplayGroups(labels);
  return {
    schema: "packaging_annotation_overlay_manifest_v2",
    caseId,
    generatedAt: new Date().toISOString(),
    baseImage: {
      ...baseImage,
      immutable: true,
    },
    catalog: {
      path: catalogFile,
      schema: catalog.schema,
      objectCount: labels.length,
    },
    registration: {
      method: "piecewise_engineering_to_raster_v1",
      canvas: profile.canvas,
      xAxis: profile.xAxis,
      yAxis: profile.yAxis,
      reviewStatus: profile.reviewStatus || "manually_registered",
    },
    labels,
    displayGroups,
    displayDefaults: {
      mode: "compact",
      edge: false,
      face: false,
      special: false,
      dimension: true,
      engineeringValues: true,
    },
    policy: {
      labelsOnly: true,
      redrawBaseGeometry: false,
      outsideBaseMutationAllowed: false,
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
    },
  };
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("毫米", "mm")
    .replace(/[\s·，。、“”‘’：:；;（）()【】\[\]]/gu, "");
}

function instructionObjectIds(instruction, catalog) {
  const valid = new Set(catalog.objects.map((object) => object.id.toUpperCase()));
  return [...String(instruction || "").toUpperCase().matchAll(/\b([EFSD]\d{2,3})\b/gu)]
    .map((match) => match[1])
    .filter((id, index, all) => valid.has(id) && all.indexOf(id) === index);
}

const SEMANTIC_TERMS = [
  "面板1", "面板2", "面板3", "面板4", "上摇盖", "下摇盖", "摇盖", "插舌", "防尘翼",
  "自锁底", "锁底", "搭接舌", "胶口", "糊口", "开槽", "切口", "压线", "折线", "外边",
  "深度", "高度", "宽度", "横向尺寸", "总长", "总宽", "长度", "面", "上", "下", "左", "右",
];

function scoreObject(instruction, object) {
  const text = normalizeText(instruction);
  const label = normalizeText(object.label);
  let score = 0;
  if (label && text.includes(label)) score += 200 + label.length;
  for (const term of SEMANTIC_TERMS) {
    const normalizedTerm = normalizeText(term);
    if (text.includes(normalizedTerm) && label.includes(normalizedTerm)) score += normalizedTerm.length * 3;
  }
  const requestedPanel = /面板([1-4])/u.exec(text)?.[1];
  const objectPanel = /面板([1-4])/u.exec(label)?.[1];
  if (requestedPanel && objectPanel) score += requestedPanel === objectPanel ? 60 : -120;
  if (text.includes("尺寸") || text.includes("深度") || text.includes("宽度") || text.includes("高度")) {
    score += object.category === "dimension" ? 20 : -10;
  }
  return score;
}

function semanticCandidates(instruction, catalog) {
  return catalog.objects
    .map((object) => ({ object, score: scoreObject(instruction, object) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.object.id.localeCompare(b.object.id));
}

function candidateSummary(item) {
  const value = engineeringValue(item.object);
  return {
    id: item.object.id,
    label: item.object.label,
    category: item.object.category,
    score: item.score,
    engineeringValue: value?.display || null,
  };
}

function extractValueMm(instruction) {
  const matches = [...String(instruction || "").matchAll(/(-?\d+(?:\.\d+)?)\s*(?:mm|毫米)/giu)];
  if (matches.length === 0) return null;
  return Number(matches.at(-1)[1]);
}

function operationFor(instruction, selectedObjects) {
  const valueMm = extractValueMm(instruction);
  const text = normalizeText(instruction);
  if (valueMm !== null && selectedObjects.length > 0 && selectedObjects.every((object) => object.category === "dimension")) {
    return { type: "set_dimension", params: { valueMm, unit: "mm" } };
  }
  if (/移动|左移|右移|上移|下移|拖动/u.test(text)) {
    return { type: "move_feature", params: { instruction: String(instruction) } };
  }
  if (/删除|去掉|移除/u.test(text)) {
    return { type: "remove_feature", params: {} };
  }
  if (/文字|文案|标注|标签/u.test(text)) {
    return { type: "replace_text", params: { instruction: String(instruction) } };
  }
  return { type: "edit_object", params: { instruction: String(instruction) } };
}

function executionRoute(operation, objects, hasMask) {
  if (operation.type === "replace_text") return "vector_overlay";
  if (objects.some((object) => ["dimension", "edge", "face", "special"].includes(object.category))) {
    return "parametric_cad";
  }
  return hasMask ? "masked_raster_composite" : "needs_target_confirmation";
}

function proposedPatch(operation, objects) {
  if (operation.type !== "set_dimension") return [];
  return objects.map((object) => ({
    objectId: object.id,
    semanticKey: object.semantic_key || "",
    field: "value_mm",
    from: Number(object.value_mm),
    to: operation.params.valueMm,
    unit: "mm",
  }));
}

export function buildEditContract({
  instruction,
  catalog,
  baseImageSha256,
  selectedObjectIds = [],
  mask = null,
}) {
  if (!instruction || !Array.isArray(catalog?.objects) || !baseImageSha256) {
    throw new Error("Edit contract requires instruction, catalog, and immutable base hash");
  }
  const byId = new Map(catalog.objects.map((object) => [object.id.toUpperCase(), object]));
  const directIds = instructionObjectIds(instruction, catalog);
  const explicitIds = [...new Set([...selectedObjectIds.map((id) => String(id).toUpperCase()), ...directIds])]
    .filter((id) => byId.has(id));

  const ranked = semanticCandidates(instruction, catalog);
  let resolvedIds = explicitIds;
  let groundingMethod = explicitIds.length > 0 ? (selectedObjectIds.length > 0 ? "teacher_object_selection" : "explicit_object_id") : "semantic_catalog";
  let confidence = explicitIds.length > 0 ? 1 : 0;
  let candidateRows = [];

  if (resolvedIds.length === 0 && ranked.length > 0) {
    const topScore = ranked[0].score;
    const tiedTop = ranked.filter((item) => item.score === topScore);
    const nextScore = ranked.find((item) => item.score < topScore)?.score ?? -Infinity;
    if (tiedTop.length === 1 && topScore - nextScore >= 25) {
      resolvedIds = [tiedTop[0].object.id];
      confidence = Math.min(0.99, 0.7 + Math.min(0.29, (topScore - Math.max(0, nextScore)) / 300));
    } else {
      candidateRows = ranked
        .filter((item) => item.score >= Math.max(1, topScore - 12))
        .slice(0, 6)
        .map(candidateSummary);
    }
  }

  const selectedObjects = resolvedIds.map((id) => byId.get(id)).filter(Boolean);
  const operation = operationFor(instruction, selectedObjects);
  const ready = selectedObjects.length > 0;
  const status = ready ? "ready_for_teacher_review" : "needs_target_confirmation";
  return {
    schema: "packaging_precise_edit_contract_v1",
    editId: `edit_${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    sourceBaseSha256: baseImageSha256,
    instruction: String(instruction),
    status,
    target: {
      objectIds: resolvedIds,
      candidates: candidateRows,
      mask,
      grounding: {
        method: groundingMethod,
        confidence: round(confidence, 3),
        evidence: directIds.length > 0 ? directIds : selectedObjectIds,
      },
    },
    operation,
    proposedPatch: proposedPatch(operation, selectedObjects),
    executionRoute: executionRoute(operation, selectedObjects, Boolean(mask)),
    preserve: {
      baseImageImmutable: true,
      outsideTargetExact: true,
      lockedObjectIds: catalog.objects.map((object) => object.id).filter((id) => !resolvedIds.includes(id)),
    },
    verification: {
      sourceBaseHashMustMatch: baseImageSha256,
      outsideMaskPixelDiffMax: 0,
      nonTargetObjectChangesMax: 0,
      targetValueMustMatch: operation.type === "set_dimension" ? operation.params.valueMm : null,
      requireGeometryValidation: executionRoute(operation, selectedObjects, Boolean(mask)) === "parametric_cad",
      requireTeacherReview: true,
    },
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
  };
}

export function compositeMaskedRgba(baseRgba, editedRgba, maskAlpha) {
  if (baseRgba.length !== editedRgba.length || baseRgba.length !== maskAlpha.length * 4) {
    throw new Error("RGBA buffers and one-byte-per-pixel mask must describe the same image");
  }
  const output = Uint8Array.from(baseRgba);
  for (let pixel = 0; pixel < maskAlpha.length; pixel += 1) {
    if (maskAlpha[pixel] === 0) continue;
    for (let channel = 0; channel < 4; channel += 1) {
      output[pixel * 4 + channel] = editedRgba[pixel * 4 + channel];
    }
  }
  return output;
}

export function validateOutsideMaskExact(beforeRgba, afterRgba, maskAlpha) {
  if (beforeRgba.length !== afterRgba.length || beforeRgba.length !== maskAlpha.length * 4) {
    throw new Error("RGBA buffers and one-byte-per-pixel mask must describe the same image");
  }
  let changedOutsidePixels = 0;
  let maxChannelDelta = 0;
  for (let pixel = 0; pixel < maskAlpha.length; pixel += 1) {
    if (maskAlpha[pixel] !== 0) continue;
    let changed = false;
    for (let channel = 0; channel < 4; channel += 1) {
      const index = pixel * 4 + channel;
      const delta = Math.abs(afterRgba[index] - beforeRgba[index]);
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      if (delta !== 0) changed = true;
    }
    if (changed) changedOutsidePixels += 1;
  }
  return {
    passed: changedOutsidePixels === 0,
    changedOutsidePixels,
    maxChannelDelta,
  };
}
