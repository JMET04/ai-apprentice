import { resultFor } from "../rules/rule-dsl-core.mjs";

function idSet(items) {
  return new Set((Array.isArray(items) ? items : []).map((item) => (typeof item === "string" ? item : item.id)).filter(Boolean));
}

export async function validate({ rule, artifact }) {
  const cutIds = idSet(artifact.geometry?.cut_lines);
  const foldIds = idSet(artifact.geometry?.fold_lines);
  const overlap = [...cutIds].filter((id) => foldIds.has(id));
  return resultFor({
    rule,
    artifact,
    status: overlap.length ? "fail" : "pass",
    validator: "geometry-validator",
    message: overlap.length ? rule.failure.message : "Cut lines and fold lines do not overlap.",
    expected: "cut line ids and fold line ids are disjoint",
    observed: overlap.length ? { overlapping_line_ids: overlap } : { cut_line_count: cutIds.size, fold_line_count: foldIds.size },
    evidence_paths: overlap.length ? ["artifact.geometry.cut_lines", "artifact.geometry.fold_lines"] : ["artifact.geometry"]
  });
}
