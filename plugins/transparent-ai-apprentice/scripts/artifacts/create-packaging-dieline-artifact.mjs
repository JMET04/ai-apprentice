#!/usr/bin/env node
import { join, resolve } from "node:path";
import { writeJson } from "../rules/rule-dsl-core.mjs";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const variant = arg("--variant", "valid");
const outDir = resolve(arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "artifacts")));
const width = variant === "invalid" ? 8 : 14;
const omitThickness = variant === "unknown";
const artifact = {
  artifact_id: `artifact.pkg.${variant}`,
  artifact_type: "packaging_dieline",
  schema_version: "0.1",
  units: "mm",
  created_at: new Date().toISOString(),
  source_refs: ["evidence://demo/packaging-dieline"],
  context: omitThickness ? { material: {} } : { material: { board_thickness_mm: 1.5 }, customer: { standard: "internal_demo" } },
  objects: [
    { id: "face.front", kind: "face", role: "front", polygon: [[0, 0], [100, 0], [100, 80], [0, 80]] },
    { id: "face.side.right", kind: "face", role: "side", polygon: [[100, 0], [130, 0], [130, 80], [100, 80]] },
    { id: "tab.glue.1", kind: "glue_tab", width_mm: width, attached_to: "face.side.right" }
  ],
  relations: [{ type: "adjacent", a: "face.front", b: "face.side.right", via: "edge.fold.1" }],
  topology: { vertices: [], edges: [], faces: [] },
  geometry: {
    cut_lines: [{ id: "line.cut.1" }],
    fold_lines: [{ id: "line.fold.1" }],
    safe_zones: []
  }
};
const out = join(outDir, `${variant}-packaging-artifact.json`);
writeJson(out, artifact);
console.log(JSON.stringify({ ok: true, variant, artifactPath: out, width_mm: width }, null, 2));
