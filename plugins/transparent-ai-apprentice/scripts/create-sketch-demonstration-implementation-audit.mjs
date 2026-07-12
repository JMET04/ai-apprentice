#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "sketch-demonstration-implementation-audit")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "sketch-demonstration-implementation-audit"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileHref(path) {
  return `file:///${String(path).replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
}

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function writeHtml(path, audit) {
  const checkRows = audit.checks
    .map(
      (check) =>
        `<tr><td>${htmlEscape(check.pass ? "pass" : "fail")}</td><td>${htmlEscape(check.name)}</td><td>${htmlEscape(check.evidence)}</td></tr>`
    )
    .join("\n");
  const evidenceLinks = Object.entries(audit.paths || {})
    .map(([key, value]) => `<li><a href="${htmlEscape(fileHref(value))}">${htmlEscape(key)}</a></li>`)
    .join("\n");
  const boundaryRows = audit.completionBoundary
    .map((row) => `<li><strong>${htmlEscape(row.status)}</strong>: ${htmlEscape(row.requirement)} - ${htmlEscape(row.evidence)}</li>`)
    .join("\n");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Sketch Demonstration Implementation Audit</title>
  <style>
    body { margin: 0; font: 14px/1.45 system-ui, sans-serif; color: #17202a; background: #f7f9fb; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 17px; margin-top: 24px; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #7c8a99; border-radius: 6px; background: white; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #d6dde5; }
    th, td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid #e3e8ef; }
    a { color: #0b5cad; }
  </style>
</head>
<body>
  <main>
    <h1>Sketch Demonstration Implementation Audit</h1>
    <p class="status">${htmlEscape(audit.status)}</p>
    <p>${htmlEscape(audit.goal)}</p>
    <h2>Completion Boundary</h2>
    <ul>${boundaryRows}</ul>
    <h2>Evidence Paths</h2>
    <ul>${evidenceLinks}</ul>
    <h2>Checks</h2>
    <table>
      <thead><tr><th>Result</th><th>Check</th><th>Evidence</th></tr></thead>
      <tbody>${checkRows}</tbody>
    </table>
  </main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

const goal = argValue(
  "--goal",
  "Audit whether transparent drawing mask, 2D perspective sketching, and 3D depth demonstration are implemented."
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "sketch-demonstration-implementation-audits")));
const createdAt = new Date().toISOString();
const auditId = `${createdAt.replace(/[:.]/g, "-")}-${slugify(goal)}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });

const sourceSmokeRoot = join(auditDir, "source-smoke");
mkdirSync(sourceSmokeRoot, { recursive: true });

const inventoryInput = argValue("--inventory", argValue("--inventory-path", ""));
const smokeArgs = ["--output-dir", sourceSmokeRoot];
if (inventoryInput) smokeArgs.push("--inventory", inventoryInput);
const smokeSummary = runNodeScript("smoke-sketch-demonstration-implementation-audit.mjs", smokeArgs);
const sourceAudit = readJson(smokeSummary.auditPath);

const completionBoundary = [
  {
    requirement: "Transparent drawing mask and reused drawing software flow",
    status: sourceAudit.requirementSummary.transparentDrawingMaskImplemented ? "proved_by_scripted_audit" : "not_proved",
    evidence: sourceAudit.paths.existingDrawingOverlay
  },
  {
    requirement: "Teacher 2D position, perspective, and 3D depth sketch understanding",
    status:
      sourceAudit.requirementSummary.teacher2DSketchUnderstood &&
      sourceAudit.requirementSummary.teacherPerspectiveSketchUnderstood &&
      sourceAudit.requirementSummary.teacher3DDepthSketchUnderstood
        ? "proved_by_scripted_audit"
        : "not_proved",
    evidence: sourceAudit.paths.realLocalSpatialIntent
  },
  {
    requirement: "Numbered target confirmation before software action",
    status: sourceAudit.requirementSummary.numberedTargetConfirmationImplemented ? "proved_by_scripted_audit" : "not_proved",
    evidence: sourceAudit.paths.realLocalTargetConfirmation
  },
  {
    requirement: "Dry-run-first route bridge to software execution",
    status: sourceAudit.requirementSummary.softwareExecutionBridgeImplemented ? "proved_by_scripted_audit" : "not_proved",
    evidence: sourceAudit.paths.realLocalRouteBridge
  },
  {
    requirement: "Real teacher exported overlay packet and teacher receipt",
    status: "not_yet_proved",
    evidence: "requires teacher-supplied overlay export and review receipt"
  },
  {
    requirement: "Unattended native universal execution across all local software",
    status: "not_yet_proved",
    evidence: "source audit keeps nativeUniversalExecution=false"
  }
];

const audit = {
  ok: sourceAudit.status === "passed",
  format: "transparent_ai_sketch_demonstration_implementation_audit_package_v1",
  auditId,
  createdAt,
  goal,
  status:
    sourceAudit.status === "passed"
      ? "sketch_demonstration_implemented_waiting_for_teacher_real_overlay_review"
      : "sketch_demonstration_implementation_audit_failed",
  purpose:
    "Persist a formal audit package for the original goal requirement: transparent drawing mask plus 2D perspective and 3D depth sketch demonstration.",
  sourceAuditPath: smokeSummary.auditPath,
  sourceSmokeRoot: smokeSummary.smokeRoot,
  requirementSummary: sourceAudit.requirementSummary,
  completionBoundary,
  sourceSmokes: sourceAudit.sourceSmokes,
  paths: sourceAudit.paths,
  checks: sourceAudit.checks,
  locks: {
    ...sourceAudit.locks,
    formalAuditDoesNotCaptureScreenshots: true,
    formalAuditDoesNotExecuteSoftware: true,
    formalAuditDoesNotWriteMemory: true,
    formalAuditDoesNotRegisterTask: true,
    requiresTeacherRealOverlayReviewBeforeClaimingOperationalCompletion: true
  },
  nextRequiredEvidence: [
    "teacher exports a real transparent overlay packet from a live target software context",
    "teacher selects one numbered target candidate or corrects the spatial interpretation",
    "dry-run route bridge is reviewed against the selected real software control route",
    "post-action low-token verifier proves the intended change after explicit execution approval"
  ]
};

const auditPath = join(auditDir, "sketch-demonstration-implementation-audit.json");
const htmlPath = join(auditDir, "sketch-demonstration-implementation-audit.html");
const readmePath = join(auditDir, "SKETCH_DEMONSTRATION_IMPLEMENTATION_AUDIT_START_HERE.md");
writeJson(auditPath, audit);
writeHtml(htmlPath, audit);
writeFileSync(
  readmePath,
  `# Sketch Demonstration Implementation Audit\n\nStatus: ${audit.status}\n\nStart with:\n\n- ${auditPath}\n- ${htmlPath}\n\nThis package proves the scripted transparent mask / 2D perspective / 3D depth rehearsal chain, but it does not claim real teacher overlay acceptance or unattended native universal execution.\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: audit.ok,
      format: audit.format,
      status: audit.status,
      auditPath,
      htmlPath,
      readmePath,
      sourceAuditPath: audit.sourceAuditPath,
      requirementSummary: audit.requirementSummary,
      nextRequiredEvidence: audit.nextRequiredEvidence
    },
    null,
    2
  )
);

if (!audit.ok) process.exit(1);
