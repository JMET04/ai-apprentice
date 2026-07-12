import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDisplayGroups,
  buildEditContract,
  buildOverlayManifest,
  compositeMaskedRgba,
  transformPoint,
  validateOutsideMaskExact,
} from "./packaging_precision_core.mjs";

const catalog = {
  schema: "carton_dieline_object_catalog_v1",
  objects: [
    {
      id: "F07",
      category: "face",
      semantic_key: "top_flap_panel_2",
      label: "面板2上摇盖",
      bounds_mm: [370, 429.5, 805, 597],
      anchor_mm: [587.5, 513.25],
    },
    {
      id: "D08",
      category: "dimension",
      semantic_key: "top_flap_depth_panel_2",
      label: "面板2上摇盖深度",
      value_mm: 167.5,
      face_id: "F07",
      anchor_mm: [599.5, 513.25],
    },
    {
      id: "D10",
      category: "dimension",
      semantic_key: "top_flap_depth_panel_4",
      label: "面板4上摇盖深度",
      value_mm: 167.5,
      anchor_mm: [1369.5, 513.25],
    },
    {
      id: "D15",
      category: "dimension",
      semantic_key: "blank_length",
      label: "展开下料总长",
      value_mm: 167.5,
      anchor_mm: [787.5, -42],
    },
  ],
};

const profile = {
  canvas: { width: 1680, height: 945 },
  xAxis: [
    { mm: 0, px: 87 },
    { mm: 1575, px: 1035 },
  ],
  yAxis: [
    { mm: 0, px: 755 },
    { mm: 167.5, px: 695 },
    { mm: 429.5, px: 507 },
    { mm: 597, px: 451 },
  ],
};

test("piecewise registration maps engineering coordinates onto the untouched review sheet", () => {
  assert.deepEqual(transformPoint([0, 0], profile), [87, 755]);
  assert.deepEqual(transformPoint([1575, 597], profile), [1035, 451]);
  assert.deepEqual(transformPoint([787.5, 298.5], profile), [561, 601]);
});

test("overlay manifest preserves every object and exposes exact engineering values", () => {
  const manifest = buildOverlayManifest({
    caseId: "case_01_transport_box",
    baseImage: {
      path: "standard.png",
      sha256: "abc123",
      width: 1680,
      height: 945,
    },
    catalogFile: "object_catalog.json",
    catalog,
    profile,
  });

  assert.equal(manifest.schema, "packaging_annotation_overlay_manifest_v2");
  assert.equal(manifest.baseImage.immutable, true);
  assert.equal(manifest.labels.length, catalog.objects.length);
  assert.deepEqual(manifest.labels.map((item) => item.id), ["F07", "D08", "D10", "D15"]);
  assert.equal(manifest.labels.find((item) => item.id === "D08").engineeringValue.display, "167.5 mm");
  assert.equal(manifest.labels.find((item) => item.id === "F07").engineeringValue.display, "435 x 167.5 mm");
  assert.equal(manifest.displayDefaults.mode, "compact");
  assert.equal(manifest.displayDefaults.face, false);
});

test("compact display groups merge related repeated values without losing object identity", () => {
  const manifest = buildOverlayManifest({
    caseId: "case_01_transport_box",
    baseImage: { path: "standard.png", sha256: "abc123", width: 1680, height: 945 },
    catalogFile: "object_catalog.json",
    catalog,
    profile,
  });
  const flapGroup = manifest.displayGroups.find((group) => group.title === "上下摇盖深度");
  assert.deepEqual(flapGroup.memberObjectIds, ["D08", "D10"]);
  assert.equal(flapGroup.memberCount, 2);
  assert.equal(flapGroup.engineeringValue.display, "167.5 mm");
  assert.equal(flapGroup.relation, "equivalent_engineering_value");

  const ungrouped = manifest.displayGroups.find((group) => group.memberObjectIds.includes("D15"));
  assert.deepEqual(ungrouped.memberObjectIds, ["D15"]);
  assert.equal(ungrouped.title, "展开下料总长");

  const groupedIds = manifest.displayGroups.flatMap((group) => group.memberObjectIds).sort();
  assert.deepEqual(groupedIds, catalog.objects.map((object) => object.id).sort());
  assert.equal(new Set(groupedIds).size, catalog.objects.length);
});

test("display grouping is deterministic for direct use by the annotation UI", () => {
  const labels = [
    { id: "D04", category: "dimension", semanticKey: "opening_width_panel_3", label: "面板3横向尺寸", anchorPx: [40, 20], engineeringValue: { display: "335 mm" }, defaultVisible: true },
    { id: "D02", category: "dimension", semanticKey: "opening_width_panel_1", label: "面板1横向尺寸", anchorPx: [20, 20], engineeringValue: { display: "335 mm" }, defaultVisible: true },
  ];
  const groups = buildDisplayGroups(labels);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, "面板1/3宽度");
  assert.deepEqual(groups[0].memberObjectIds, ["D02", "D04"]);
});

test("equal numbers with different engineering meaning remain separate", () => {
  const labels = [
    { id: "D07", category: "dimension", semanticKey: "top_tuck_depth", label: "上插舌/顶部结构深度", anchorPx: [20, 20], engineeringValue: { display: "38 mm" }, defaultVisible: true },
    { id: "D08", category: "dimension", semanticKey: "bottom_lock_depth", label: "自锁底总深度", anchorPx: [40, 20], engineeringValue: { display: "38 mm" }, defaultVisible: true },
  ];
  const groups = buildDisplayGroups(labels);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.memberObjectIds), [["D07"], ["D08"]]);
});

test("direct object ID and exact value become a deterministic dimension edit", () => {
  const contract = buildEditContract({
    instruction: "把 D08 改成 170 mm，其他位置不要动",
    catalog,
    baseImageSha256: "abc123",
  });

  assert.equal(contract.status, "ready_for_teacher_review");
  assert.deepEqual(contract.target.objectIds, ["D08"]);
  assert.equal(contract.operation.type, "set_dimension");
  assert.equal(contract.operation.params.valueMm, 170);
  assert.equal(contract.preserve.outsideTargetExact, true);
  assert.equal(contract.verification.outsideMaskPixelDiffMax, 0);
  assert.deepEqual(contract.proposedPatch, [
    {
      objectId: "D08",
      semanticKey: "top_flap_depth_panel_2",
      field: "value_mm",
      from: 167.5,
      to: 170,
      unit: "mm",
    },
  ]);
  assert.equal(contract.accepted, false);
  assert.equal(contract.ruleEnabled, false);
  assert.equal(contract.packagingGated, true);
});

test("precise language resolves a unique semantic target without redrawing the sheet", () => {
  const contract = buildEditContract({
    instruction: "面板2上摇盖深度调整到 170 毫米",
    catalog,
    baseImageSha256: "abc123",
  });

  assert.equal(contract.status, "ready_for_teacher_review");
  assert.deepEqual(contract.target.objectIds, ["D08"]);
  assert.equal(contract.executionRoute, "parametric_cad");
});

test("ambiguous language returns candidates instead of guessing", () => {
  const contract = buildEditContract({
    instruction: "把上摇盖深度调整到 170 毫米",
    catalog,
    baseImageSha256: "abc123",
  });

  assert.equal(contract.status, "needs_target_confirmation");
  assert.deepEqual(contract.target.objectIds, []);
  assert.deepEqual(contract.target.candidates.map((item) => item.id), ["D08", "D10"]);
});

test("outside-mask validator rejects any unintended pixel change", () => {
  const before = Uint8Array.from([10, 20, 30, 255, 40, 50, 60, 255]);
  const insideOnly = Uint8Array.from([99, 99, 99, 255, 40, 50, 60, 255]);
  const leaked = Uint8Array.from([99, 99, 99, 255, 41, 50, 60, 255]);
  const mask = Uint8Array.from([255, 0]);

  assert.deepEqual(validateOutsideMaskExact(before, insideOnly, mask), {
    passed: true,
    changedOutsidePixels: 0,
    maxChannelDelta: 0,
  });
  assert.deepEqual(validateOutsideMaskExact(before, leaked, mask), {
    passed: false,
    changedOutsidePixels: 1,
    maxChannelDelta: 1,
  });
});

test("masked compositor copies the original exactly outside the target", () => {
  const before = Uint8Array.from([10, 20, 30, 255, 40, 50, 60, 255]);
  const generated = Uint8Array.from([99, 98, 97, 255, 88, 87, 86, 255]);
  const mask = Uint8Array.from([255, 0]);

  const composited = compositeMaskedRgba(before, generated, mask);
  assert.deepEqual([...composited], [99, 98, 97, 255, 40, 50, 60, 255]);
  assert.equal(validateOutsideMaskExact(before, composited, mask).passed, true);
});
