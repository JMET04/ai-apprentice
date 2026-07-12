#!/usr/bin/env node
import crypto from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getMaskCorrection, recordMaskCorrectionResult } from "./mask-correction-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const runtimeRoot = join(pluginRoot, "integrations", "aicad-agent-v1", "plugin", "aicad-agent", "runtime");
const locks = { reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true };

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function shaFile(path) {
  return crypto.createHash("sha256").update(readFileSync(path)).digest("hex");
}

function shaValue(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, path);
}

function requireFile(path, label) {
  if (!path || !existsSync(path)) throw new Error(`${label} not found: ${path || "missing"}`);
}

function patchLineLength(step, targetValue) {
  if (step.type !== "line") throw new Error(`Adapter v1 supports line dimensions only: ${step.id}`);
  const construction = step.construction;
  if (construction.kind === "vector") {
    const currentLength = Math.hypot(construction.dx, construction.dy);
    if (!Number.isFinite(currentLength) || currentLength <= 0) throw new Error(`${step.id} has invalid vector length.`);
    const scale = targetValue / currentLength;
    construction.dx *= scale;
    construction.dy *= scale;
  } else if (["polar", "parallel", "perpendicular"].includes(construction.kind)) {
    construction.length = targetValue;
  } else {
    throw new Error(`${step.id} construction kind cannot be dimension-edited: ${construction.kind}`);
  }
  const lengthConstraints = step.constraints.filter(item => item.kind === "length");
  if (lengthConstraints.length !== 1) throw new Error(`${step.id} must have exactly one length constraint.`);
  lengthConstraints[0].value = targetValue;
}

function compileAicad(planPath, outputDir, name) {
  const python = process.env.PYTHON || "python";
  const pythonTemp = resolve(".ta-smoke", "python-temp");
  mkdirSync(pythonTemp, { recursive: true });
  const result = spawnSync(python, ["-B", "-m", "aicad.cli", "compile", planPath, "--out", outputDir, "--name", name], {
    cwd: runtimeRoot,
    encoding: "utf8",
    timeout: 120000,
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      PYTHONDONTWRITEBYTECODE: "1",
      PYTHONPATH: join(runtimeRoot, "src"),
      TEMP: pythonTemp,
      TMP: pythonTemp
    }
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "AICAD compile failed.");
  const expected = ["aicad", "scr", "dxf", "audit.md", "manifest.json"].map(extension => join(outputDir, `${name}.${extension}`));
  for (const path of expected) requireFile(path, "Compiled AICAD artifact");
  return { stdout: result.stdout.trim(), artifacts: expected };
}

function apply() {
  const correctionId = argValue("--correction-id");
  const storePath = argValue("--store");
  const sourcePlanPath = resolve(argValue("--source-plan"));
  const outputDir = resolve(argValue("--output-dir", ".transparent-apprentice/aicad-object-edits"));
  if (!correctionId) throw new Error("--correction-id is required.");
  requireFile(sourcePlanPath, "Source AICAD plan");
  const correction = getMaskCorrection({ id: correctionId, storePath });
  if (!correction) throw new Error(`Mask correction not found: ${correctionId}`);
  if (correction.status !== "reviewed_ready_for_separate_execution") {
    throw new Error(`Correction must be teacher-reviewed before AICAD execution: ${correction.status}`);
  }
  const packet = correction.packet;
  if (packet.surfaceKind !== "engineering_native_object") throw new Error("AICAD adapter requires an engineering object packet.");
  if (!["set_dimension", "change_dimension"].includes(packet.target?.action)) {
    throw new Error(`AICAD object adapter does not support action: ${packet.target?.action}`);
  }
  if (packet.reviewOnly !== true || packet.accepted !== false || packet.ruleEnabled !== false || packet.packagingGated !== true) {
    throw new Error("Correction safety locks are invalid.");
  }
  const targetValue = Number(packet.target.targetValue);
  if (!Number.isFinite(targetValue) || targetValue <= 0) throw new Error("Target dimension must be positive and finite.");

  const source = JSON.parse(readFileSync(sourcePlanPath, "utf8"));
  if (source.drawing?.units !== packet.target.unit) {
    throw new Error(`Unit mismatch: plan=${source.drawing?.units}; correction=${packet.target.unit}`);
  }
  const targetIndex = source.steps.findIndex(step => step.id === packet.target.objectId);
  if (targetIndex < 0) throw new Error(`Target object not found in AICAD plan: ${packet.target.objectId}`);
  const protectedIds = packet.invariants?.protectObjectIds ?? [];
  for (const id of protectedIds) {
    if (!source.steps.some(step => step.id === id)) throw new Error(`Protected object not found in AICAD plan: ${id}`);
  }

  mkdirSync(outputDir, { recursive: true });
  const rollbackDir = join(outputDir, "rollback");
  mkdirSync(rollbackDir, { recursive: true });
  const rollbackPath = join(rollbackDir, basename(sourcePlanPath));
  copyFileSync(sourcePlanPath, rollbackPath);
  const sourceSha256 = shaFile(sourcePlanPath);
  if (shaFile(rollbackPath) !== sourceSha256) throw new Error("Rollback copy hash mismatch.");

  const edited = structuredClone(source);
  const beforeTarget = structuredClone(edited.steps[targetIndex]);
  patchLineLength(edited.steps[targetIndex], targetValue);
  const afterTarget = edited.steps[targetIndex];
  const changedIds = edited.steps
    .filter((step, index) => shaValue(step) !== shaValue(source.steps[index]))
    .map(step => step.id);
  if (changedIds.length !== 1 || changedIds[0] !== packet.target.objectId) {
    throw new Error(`Surgical edit changed unexpected plan objects: ${changedIds.join(",")}`);
  }
  const protectedProof = protectedIds.map(id => {
    const before = source.steps.find(step => step.id === id);
    const after = edited.steps.find(step => step.id === id);
    return { id, beforeSha256: shaValue(before), afterSha256: shaValue(after), unchanged: shaValue(before) === shaValue(after) };
  });
  if (protectedProof.some(item => !item.unchanged)) throw new Error("Protected AICAD object changed.");

  const editedPlanPath = join(outputDir, "edited.plan.json");
  writeJsonAtomic(editedPlanPath, edited);
  const compile = compileAicad(editedPlanPath, join(outputDir, "compiled"), "edited");
  const reportPath = join(outputDir, "aicad-object-edit-report.json");
  const report = {
    format: "ai_apprentice_aicad_object_mask_result_v1",
    correctionId,
    adapter: "aicad_plan_v1",
    sourcePlanPath,
    editedPlanPath,
    rollbackPath,
    sourceSha256,
    rollbackSha256: shaFile(rollbackPath),
    editedSha256: shaFile(editedPlanPath),
    target: { objectId: packet.target.objectId, before: beforeTarget, after: afterTarget, targetValue, unit: packet.target.unit },
    changedObjectIds: changedIds,
    protectedProof,
    compiledArtifacts: compile.artifacts.map(path => ({ path, sha256: shaFile(path) })),
    verification: {
      sourcePreserved: shaFile(sourcePlanPath) === sourceSha256,
      rollbackExact: shaFile(rollbackPath) === sourceSha256,
      onlySelectedObjectChanged: changedIds.length === 1 && changedIds[0] === packet.target.objectId,
      protectedObjectsUnchanged: protectedProof.every(item => item.unchanged),
      nativeCadArtifactsGenerated: true,
      teacherVerificationRequired: true
    },
    locks
  };
  writeJsonAtomic(reportPath, report);
  const recorded = recordMaskCorrectionResult({
    id: correctionId,
    status: "succeeded",
    evidence: { reportPath, editedPlanPath, rollbackPath, compiledArtifacts: compile.artifacts },
    note: `AICAD native plan object ${packet.target.objectId} changed to ${targetValue} ${packet.target.unit}; teacher verification remains required.`,
    storePath
  });
  return { ok: true, reportPath, report, correctionStatus: recorded.status };
}

function verify() {
  const reportPath = resolve(argValue("--report"));
  requireFile(reportPath, "AICAD object edit report");
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const checks = {
    sourcePreserved: shaFile(report.sourcePlanPath) === report.sourceSha256,
    rollbackExact: shaFile(report.rollbackPath) === report.sourceSha256,
    editedHashMatches: shaFile(report.editedPlanPath) === report.editedSha256,
    onlySelectedObjectChanged: report.changedObjectIds.length === 1 && report.changedObjectIds[0] === report.target.objectId,
    protectedObjectsUnchanged: report.protectedProof.every(item => item.unchanged),
    compiledArtifactsMatch: report.compiledArtifacts.every(item => existsSync(item.path) && shaFile(item.path) === item.sha256),
    locksClosed: report.locks.accepted === false && report.locks.ruleEnabled === false && report.locks.packagingGated === true
  };
  return { ok: Object.values(checks).every(Boolean), format: "ai_apprentice_aicad_object_mask_verification_v1", reportPath, checks };
}

function rollback() {
  const reportPath = resolve(argValue("--report"));
  const restorePath = resolve(argValue("--restore-to", join(dirname(reportPath), "restored.plan.json")));
  requireFile(reportPath, "AICAD object edit report");
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  requireFile(report.rollbackPath, "Rollback point");
  copyFileSync(report.rollbackPath, restorePath);
  const restoredSha256 = shaFile(restorePath);
  if (restoredSha256 !== report.sourceSha256) throw new Error("Restored plan hash does not match original source.");
  return { ok: true, format: "ai_apprentice_aicad_object_mask_rollback_v1", reportPath, restorePath, restoredSha256, exactOriginalRestored: true, locks };
}

const action = argValue("--action", "apply");
const result = action === "apply" ? apply() : action === "verify" ? verify() : action === "rollback" ? rollback() : null;
if (!result) throw new Error(`Unsupported --action: ${action}`);
console.log(JSON.stringify(result, null, 2));
