#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { hashText, writeJson } from "./knowledge/knowledge-core.mjs";
import { validateRuleCard } from "./rules/rule-dsl-core.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function slug(value) {
  return (
    String(value || "real-case-rule")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "real-case-rule"
  );
}

function locks() {
  return {
    reviewOnly: true,
    preparationOnly: true,
    teacherReviewedInputRequired: true,
    candidateRulesDraftDisabled: true,
    activeRulePackageCompiled: false,
    ruleEnabled: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

function evidenceRefsFromHandoff(handoff) {
  const refs = [];
  for (const artifact of handoff.artifacts || []) refs.push(`artifact://${artifact}`);
  for (const source of handoff.knowledgeSources || []) refs.push(`knowledge://${source}`);
  for (const [index, constraint] of (handoff.constraints || []).entries()) {
    refs.push(`teacher_constraint://${index + 1}/${hashText(constraint).slice(7, 19)}`);
  }
  if (handoff.rollbackPoint) refs.push(`rollback://${handoff.rollbackPoint}`);
  return refs.length ? refs : ["teacher_case://missing-evidence-ref"];
}

function expressionForConstraint(caseType, text) {
  const lower = String(text).toLowerCase();
  if (caseType === "packaging_box" && /glue|粘|糊|flap|tab/.test(lower)) {
    return {
      artifactTypes: ["packaging_dieline"],
      inputsRequired: [
        "artifact.objects[*].kind",
        "artifact.objects[*].width_mm",
        "context.material.board_thickness_mm"
      ],
      expr:
        "artifact.objects.filter(o, o.kind == 'glue_tab').all(o, o.width_mm >= max(12, context.material.board_thickness_mm * 8))",
      failureMessage: "Glue tab width does not satisfy the teacher-confirmed production constraint.",
      remediationHint: "Review each glue_tab width and board thickness before drawing or exporting the dieline."
    };
  }
  if (caseType === "packaging_box" && /fold|折|crease|cut|刀|overlap|重叠/.test(lower)) {
    return {
      artifactTypes: ["packaging_dieline"],
      inputsRequired: [
        "artifact.objects[*].kind",
        "artifact.objects[*].x_mm",
        "artifact.objects[*].y_mm",
        "artifact.objects[*].width_mm",
        "artifact.objects[*].height_mm"
      ],
      expr:
        "artifact.objects.filter(o, o.kind == 'fold_line').all(f, artifact.objects.filter(o, o.kind == 'cut_line').all(c, f.id != c.id))",
      failureMessage: "Fold and cut line logic still needs teacher review before delivery.",
      remediationHint: "Bind every fold/cut line to a reviewed feature id and data source before execution."
    };
  }
  if (caseType === "cad_drawing" && /angle|角|degree|offset|偏移|dimension|尺寸/.test(lower)) {
    return {
      artifactTypes: ["cad_drawing"],
      inputsRequired: ["artifact.objects[*].kind", "artifact.objects[*].angle_deg", "artifact.objects[*].dimension_refs"],
      expr: "artifact.objects.all(o, o.dimension_refs.exists(r, r.teacher_reviewed == true))",
      failureMessage: "CAD feature dimensions or angles are not fully bound to reviewed data.",
      remediationHint: "Ask the teacher to map each angle, offset, and dimension to a source variable or formula."
    };
  }
  return {
    artifactTypes: caseType === "cad_drawing" ? ["cad_drawing"] : ["engineering_case_artifact"],
    inputsRequired: ["artifact.source_refs", "artifact.objects[*].teacher_logic_refs"],
    expr: "artifact.objects.all(o, o.teacher_logic_refs.exists(r, r.reviewed == true))",
    failureMessage: "A real-case feature is not yet tied to reviewed logic evidence.",
    remediationHint: "Convert the teacher note into feature-to-data, angle, dimension, tolerance, or source-evidence relationships."
  };
}

function buildRuleCard({ handoff, constraint, index, evidenceRefs }) {
  const caseType = handoff.caseType || "engineering_software_case";
  const expression = expressionForConstraint(caseType, constraint);
  const idBase = slug(`${caseType}.${constraint || `constraint-${index + 1}`}`);
  return {
    dsl_version: "0.1",
    rule_id: `real_case.${idBase}.draft.${String(index + 1).padStart(2, "0")}`,
    title: `Draft real-case logic rule ${index + 1}`,
    domain: caseType === "packaging_box" ? "packaging.dieline" : caseType === "cad_drawing" ? "cad.drawing" : "engineering.software",
    lifecycle: "draft_disabled",
    severity: "warning",
    owner: {
      teacher_id: "teacher.local",
      reviewer_id: null,
      approved_at: null
    },
    source: {
      type: "real_case_pilot_intake",
      evidence_refs: evidenceRefs,
      natural_language: String(constraint || "Teacher-supplied real-case constraint requiring review.")
    },
    scope: {
      artifact_types: expression.artifactTypes,
      applies_when: null
    },
    inputs_required: expression.inputsRequired,
    constraint: {
      type: "expression",
      language: "taa-expr-0.1",
      expr: expression.expr
    },
    failure: {
      message: expression.failureMessage,
      action: "request_teacher_review",
      remediation_hint: expression.remediationHint
    },
    audit: {
      created_by: "real_case_rule_dsl_preparation",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rule_version: "0.1.0"
    }
  };
}

const validationInput = String(argValue("--pilot-validation", argValue("--validation", ""))).trim();
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-rule-dsl-preparation-packages"))
);
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!validationInput) {
  throw new Error(
    "Usage: node create-real-case-rule-dsl-preparation-package.mjs --pilot-validation <real-case-pilot-intake-receipt-validation.json> --teacher-reviewed [--out-dir <dir>]"
  );
}
if (!teacherReviewed) throw new Error("REAL_CASE_RULE_DSL_PREPARATION_REQUIRES_TEACHER_REVIEWED_FLAG");

const validationPath = validationInput.startsWith("{") ? "" : resolve(validationInput);
if (validationPath && !existsSync(validationPath)) throw new Error(`PILOT_VALIDATION_NOT_FOUND: ${validationPath}`);
const validation = validationPath ? readJson(validationPath) : JSON.parse(validationInput);
const validationSource = validationPath || "inline-json";
if (validation.format !== "transparent_ai_real_case_pilot_intake_receipt_validation_v1") {
  throw new Error("Expected transparent_ai_real_case_pilot_intake_receipt_validation_v1.");
}
if (
  validation.status !== "real_case_pilot_intake_ready_for_manual_route_preparation" ||
  validation.readyForManualPreparation !== true ||
  !validation.manualPreparationHandoff
) {
  throw new Error("Real-case pilot validation must be ready for manual route preparation.");
}
if (validation.locks?.ruleEnabled !== false || validation.locks?.targetSoftwareCommandsExecuted !== false) {
  throw new Error("Real-case pilot validation locks must keep rules and software execution disabled.");
}

const handoff = validation.manualPreparationHandoff;
const allowedRoutes = new Set(["prepare_universal_detail_logic", "prepare_rag_evidence", "start_with_tlcl_launcher"]);
if (!allowedRoutes.has(handoff.selectedRoute)) {
  throw new Error(`REAL_CASE_RULE_DSL_PREPARATION_ROUTE_NOT_ALLOWED:${handoff.selectedRoute}`);
}

const packageId = `real_case_rule_dsl_preparation.${hashText(`${validationSource}:${JSON.stringify(handoff)}`).slice(7, 19)}`;
const packageDir = join(outRoot, packageId);
const ruleDir = join(packageDir, "draft-disabled-rule-cards");
mkdirSync(ruleDir, { recursive: true });

const evidenceRefs = evidenceRefsFromHandoff(handoff);
const constraints = Array.isArray(handoff.constraints) && handoff.constraints.length ? handoff.constraints : ["Teacher must provide at least one reviewed feature-to-data logic relationship."];
const candidateRows = [];
const errors = [];

constraints.forEach((constraint, index) => {
  const rule = buildRuleCard({ handoff, constraint, index, evidenceRefs });
  const validationResult = validateRuleCard(rule);
  const rulePath = join(ruleDir, `${rule.rule_id}.json`);
  writeJson(rulePath, rule);
  if (!validationResult.ok) errors.push(...validationResult.errors.map((error) => ({ ...error, rule_id: rule.rule_id })));
  candidateRows.push({
    ruleId: rule.rule_id,
    rulePath,
    ruleHash: hashText(JSON.stringify(rule)),
    lifecycle: rule.lifecycle,
    severity: rule.severity,
    sourceEvidenceRefs: rule.source.evidence_refs,
    naturalLanguage: rule.source.natural_language,
    dslValidationOk: validationResult.ok,
    dslValidationErrors: validationResult.errors,
    teacherMustConfirmLogicFit: true,
    mayEnableRule: false,
    mayExecuteSoftware: false,
    mayUnlockPackaging: false
  });
});

const status = errors.length ? "blocked_by_rule_card_schema_errors" : "real_case_rule_dsl_preparation_waiting_for_teacher_rule_review";
const packetPath = join(packageDir, "real-case-rule-dsl-preparation-package.json");
const readmePath = join(packageDir, "REAL_CASE_RULE_DSL_PREPARATION_START_HERE.md");
const packetLocks = locks();
const packet = {
  ok: errors.length === 0,
  format: "transparent_ai_real_case_rule_dsl_preparation_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  status,
  teacherReviewed,
  sourcePilotValidationPath: validationSource,
  sourcePilotValidationHash: hashText(JSON.stringify(validation)),
  caseType: handoff.caseType || "",
  selectedRoute: handoff.selectedRoute || "",
  goal: handoff.goal || "",
  software: handoff.software || "",
  artifacts: handoff.artifacts || [],
  knowledgeSources: handoff.knowledgeSources || [],
  constraints,
  rollbackPoint: handoff.rollbackPoint || "",
  candidateRuleCount: candidateRows.length,
  candidateRows,
  errors,
  nextTeacherReview: {
    instruction:
      "Review each draft_disabled Rule Card and confirm whether it captures the real case's feature-to-data, dimension, angle, tolerance, and evidence logic before any active package compilation.",
    allowedDecisions: ["needs_teacher_review", "logic_matches", "logic_mismatch_repair", "request_more_evidence"],
    forbiddenDecisions: ["accepted", "enable_rule", "compile_active_package", "execute_software", "write_memory", "unlock_packaging"],
    nextPossibleManualTools: [
      "knowledge/create-rag-reviewed-rule-dsl-review-receipt-builder.mjs",
      "create-tlcl-rag-informed-high-reasoning-repair-intake.mjs",
      "scripts/rules/compile-rule-package.mjs only after a separate teacher lifecycle promotion gate"
    ]
  },
  blockedActions: [
    "compile_active_rule_package_from_real_case_prep",
    "enable_rule_from_real_case_prep",
    "execute_software_from_real_case_prep",
    "fetch_rag_from_real_case_prep",
    "write_memory_from_real_case_prep",
    "unlock_packaging_from_real_case_prep",
    "claim_completion_from_real_case_prep"
  ],
  locks: packetLocks,
  paths: {
    package: packetPath,
    ruleDir,
    readme: readmePath
  }
};

writeJson(packetPath, packet);
writeFileSync(
  readmePath,
  [
    "# Real Case Rule DSL Preparation",
    "",
    `Status: ${status}`,
    `Case type: ${packet.caseType}`,
    `Selected route: ${packet.selectedRoute}`,
    `Candidate draft-disabled rules: ${candidateRows.length}`,
    "",
    "This package converts a teacher-reviewed real-case pilot handoff into draft_disabled Rule Cards. It does not compile active packages, enable rules, execute software, fetch RAG, write memory, unlock packaging, or claim completion.",
    "",
    "## Teacher Review",
    packet.nextTeacherReview.instruction,
    "",
    "## Draft Rules",
    ...candidateRows.map((row) => `- ${row.ruleId}: ${row.rulePath}`)
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: packet.ok,
      format: "transparent_ai_real_case_rule_dsl_preparation_package_result_v1",
      status,
      packagePath: packetPath,
      ruleDir,
      readmePath,
      candidateRuleCount: candidateRows.length,
      candidateRows,
      errors,
      executeNow: false,
      locks: packetLocks
    },
    null,
    2
  )
);

if (errors.length) process.exit(1);
