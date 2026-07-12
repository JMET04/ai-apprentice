import { resultFor } from "../rules/rule-dsl-core.mjs";

export async function validate({ rule, artifact }) {
  const faces = (artifact.objects || []).filter((object) => object.kind === "face");
  const relations = Array.isArray(artifact.relations) ? artifact.relations : [];
  if (!faces.length) {
    return resultFor({ rule, artifact, status: "fail", validator: "topology-validator", message: "No face objects found.", expected: "at least one face", observed: { face_count: 0 }, evidence_paths: ["artifact.objects"] });
  }
  const ids = new Set();
  for (const face of faces) {
    if (!face.id || ids.has(face.id)) {
      return resultFor({ rule, artifact, status: "fail", validator: "topology-validator", message: "Each face must have a unique id.", expected: "unique face ids", observed: { face }, evidence_paths: ["artifact.objects"] });
    }
    ids.add(face.id);
  }
  const graph = new Map(faces.map((face) => [face.id, new Set()]));
  for (const relation of relations.filter((item) => item.type === "adjacent")) {
    if (graph.has(relation.a) && graph.has(relation.b)) {
      graph.get(relation.a).add(relation.b);
      graph.get(relation.b).add(relation.a);
    }
  }
  const start = faces[0].id;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    for (const next of graph.get(current) || []) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  const isolated = faces.map((face) => face.id).filter((id) => !seen.has(id));
  return resultFor({
    rule,
    artifact,
    status: isolated.length ? "fail" : "pass",
    validator: "topology-validator",
    message: isolated.length ? rule.failure.message : "Face graph is connected.",
    expected: "connected face graph",
    observed: isolated.length ? { isolated_faces: isolated } : { face_count: faces.length },
    evidence_paths: isolated.length ? isolated.map((id) => `artifact.objects[id=${id}]`).concat(["artifact.relations"]) : ["artifact.objects", "artifact.relations"]
  });
}
