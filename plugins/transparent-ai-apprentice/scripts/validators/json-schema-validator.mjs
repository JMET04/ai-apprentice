import { resultFor, validateArtifactEnvelope } from "../rules/rule-dsl-core.mjs";

export async function validate({ rule, artifact }) {
  const validation = validateArtifactEnvelope(artifact);
  return resultFor({
    rule,
    artifact,
    status: validation.ok ? "pass" : "unknown",
    validator: "json-schema-validator",
    message: validation.ok ? "Artifact envelope has required structure." : "Artifact envelope is missing required structure.",
    expected: "artifact envelope required fields",
    observed: validation.errors,
    evidence_paths: validation.errors.map((error) => error.path)
  });
}
