import { resultFor } from "../rules/rule-dsl-core.mjs";

export async function validate({ rule, artifact }) {
  const params = rule.constraint?.params || {};
  const risky = (params.high_risk_levels || ["medium", "high"]).includes(artifact.risk_level);
  if (!risky) {
    return resultFor({ rule, artifact, status: "pass", validator: "policy-gate-validator", message: "Risk level does not require blocking approval gate.", observed: { risk_level: artifact.risk_level }, evidence_paths: ["artifact.risk_level"] });
  }
  const teacherConfirmed = artifact.approval?.teacher_confirmed === true;
  const rollbackExists = artifact.rollback_point?.exists === true;
  const missing = [];
  if (params.require_teacher_confirmed && !teacherConfirmed) missing.push("approval.teacher_confirmed");
  if (params.require_rollback_point && !rollbackExists) missing.push("rollback_point.exists");
  return resultFor({
    rule,
    artifact,
    status: missing.length ? "fail" : "pass",
    validator: "policy-gate-validator",
    message: missing.length ? rule.failure.message : "Teacher approval and rollback point are present.",
    expected: "teacher approval and rollback point for medium/high risk execution",
    observed: { risk_level: artifact.risk_level, teacher_confirmed: teacherConfirmed, rollback_exists: rollbackExists, missing },
    evidence_paths: missing.map((field) => `artifact.${field}`)
  });
}
