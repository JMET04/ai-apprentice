import { resultFor } from "../rules/rule-dsl-core.mjs";

function hasForbiddenSyntax(expr) {
  return /\beval\b|\bFunction\b|require\s*\(|import\s*\(|process\.|fs\.|fetch\s*\(|XMLHttpRequest|Date\.now|Math\.random/.test(expr || "");
}

function glueTabs(artifact) {
  return Array.isArray(artifact.objects) ? artifact.objects.filter((object) => object.kind === "glue_tab") : [];
}

function validateGlueTabWidth(rule, artifact) {
  const tabs = glueTabs(artifact);
  const thickness = artifact.context?.material?.board_thickness_mm;
  if (tabs.length === 0) {
    return { status: "unknown", message: "No glue_tab objects found.", observed: { glue_tab_count: 0 }, evidence_paths: ["artifact.objects"] };
  }
  if (typeof thickness !== "number") {
    return {
      status: "unknown",
      message: "Missing numeric board_thickness_mm.",
      observed: { board_thickness_mm: thickness ?? null },
      evidence_paths: ["context.material.board_thickness_mm"]
    };
  }
  const required = Math.max(12, thickness * 8);
  const failing = tabs.filter((tab) => typeof tab.width_mm !== "number" || tab.width_mm < required);
  if (failing.length) {
    return {
      status: "fail",
      message: rule.failure.message,
      expected: `width_mm >= ${required}`,
      observed: {
        required_min_width_mm: required,
        failing_tabs: failing.map((tab) => ({ object_id: tab.id || "", width_mm: tab.width_mm ?? null }))
      },
      evidence_paths: failing.map((tab) => `artifact.objects[id=${tab.id || "unknown"}].width_mm`).concat(["context.material.board_thickness_mm"])
    };
  }
  return {
    status: "pass",
    message: "All glue tabs meet minimum width.",
    expected: `width_mm >= ${required}`,
    observed: { required_min_width_mm: required, checked_tabs: tabs.map((tab) => tab.id || "") },
    evidence_paths: tabs.map((tab) => `artifact.objects[id=${tab.id || "unknown"}].width_mm`).concat(["context.material.board_thickness_mm"])
  };
}

function validateSourceRefs(rule, artifact) {
  const count = Array.isArray(artifact.source_refs) ? artifact.source_refs.length : null;
  if (count === null) {
    return { status: "unknown", message: "source_refs is missing.", observed: { source_refs: null }, evidence_paths: ["artifact.source_refs"] };
  }
  if (count <= 0) {
    return { status: "fail", message: rule.failure.message, observed: { source_refs_count: count }, evidence_paths: ["artifact.source_refs"] };
  }
  return { status: "pass", message: "Artifact has source evidence refs.", observed: { source_refs_count: count }, evidence_paths: ["artifact.source_refs"] };
}

export async function validate({ rule, artifact }) {
  const expr = String(rule.constraint?.expr || "");
  if (hasForbiddenSyntax(expr)) {
    return resultFor({ rule, artifact, status: "error", validator: "expression-validator", message: "Forbidden expression syntax.", expected: "safe taa-expr-0.1 subset", evidence_paths: ["constraint.expr"] });
  }
  let raw;
  if (expr.includes("glue_tab") && expr.includes("width_mm") && expr.includes("board_thickness_mm")) raw = validateGlueTabWidth(rule, artifact);
  else if (expr === "artifact.source_refs.count() > 0") raw = validateSourceRefs(rule, artifact);
  else raw = { status: "unknown", message: "Expression is not supported by taa-expr-0.1 MVP.", expected: "supported expression subset", observed: { expr }, evidence_paths: ["constraint.expr"] };
  return resultFor({
    rule,
    artifact,
    validator: "expression-validator",
    expected: raw.expected || rule.constraint?.expr || "",
    remediation_hint: rule.failure?.remediation_hint || "",
    ...raw
  });
}
