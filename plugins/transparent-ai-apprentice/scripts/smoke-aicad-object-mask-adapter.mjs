#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewMaskCorrection, submitMaskCorrection } from "./mask-correction-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".ta-smoke", "aicad-object-mask-adapter");
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const storePath = join(root, "store.json");
const sourcePlan = join(pluginRoot, "assets", "examples", "aicad-object-mask-source.plan.json");
const adapter = join(__dirname, "aicad-object-mask-adapter.mjs");
const checks = [];
const check = (name, pass, evidence = "") => checks.push({ name, pass: Boolean(pass), evidence });

function packet(overrides = {}) {
  return {
    format: "mingtu_multimodal_surgical_mask_correction_v1",
    surfaceKind: "engineering_native_object",
    target: { objectType: "尺寸标注", objectId: "D04", action: "set_dimension", targetValue: 450, unit: "mm", constraints: "只修改 D04" },
    maskSemantics: { modify: [{ id: "D04-change" }], protect: [{ id: "D08-D10-protect" }], reference: [] },
    invariants: { protectObjectIds: ["D08", "D10"], preserveOtherEntities: true, preserveConstraintsTopologyText: true },
    execution: { mode: "teacher_review_only", nativeExecutionImplemented: false, requiresSoftwareAdapter: true },
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    ...overrides
  };
}

function run(args, expectedSuccess = true) {
  const result = spawnSync(process.execPath, [adapter, ...args], { cwd: repoRoot, encoding: "utf8", timeout: 120000 });
  if (expectedSuccess && result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result;
}

const pending = submitMaskCorrection({ packet: packet(), storePath });
const blockedPending = run(["--action", "apply", "--correction-id", pending.id, "--store", storePath, "--source-plan", sourcePlan, "--output-dir", join(root, "pending")], false);
check("Unreviewed engineering correction cannot execute", blockedPending.status !== 0 && /teacher-reviewed/.test(blockedPending.stderr));

reviewMaskCorrection({ id: pending.id, decision: "approved_for_separate_execution", note: "D04 身份和数值已确认", storePath });
const appliedProcess = run(["--action", "apply", "--correction-id", pending.id, "--store", storePath, "--source-plan", sourcePlan, "--output-dir", join(root, "applied")]);
const applied = JSON.parse(appliedProcess.stdout);
const report = applied.report;
check("Reviewed D04 correction compiles through the native AICAD runtime", applied.ok && report.verification.nativeCadArtifactsGenerated, applied.reportPath);
check("Only selected AICAD object changes", JSON.stringify(report.changedObjectIds) === JSON.stringify(["D04"]));
check("D04 is changed from 420 to 450 mm", report.target.before.construction.dx === 420 && report.target.after.construction.dx === 450 && report.target.targetValue === 450);
check("D08 and D10 hashes remain identical", report.protectedProof.length === 2 && report.protectedProof.every(item => item.unchanged));
check("Original source plan stays untouched", report.verification.sourcePreserved === true);
check("Rollback point is an exact source copy", report.verification.rollbackExact === true && report.sourceSha256 === report.rollbackSha256);
check("AICAD, AutoCAD script, DXF, audit, and manifest artifacts are generated", report.compiledArtifacts.length === 5 && report.compiledArtifacts.every(item => existsSync(item.path)));
const dxf = readFileSync(report.compiledArtifacts.find(item => item.path.endsWith(".dxf")).path, "ascii");
check("Generated DXF contains the edited 450 mm endpoint", /\n11\n450\n/.test(dxf));
check("Correction result returns to task store for teacher verification", applied.correctionStatus === "result_succeeded_pending_teacher_verification");

const verified = JSON.parse(run(["--action", "verify", "--report", applied.reportPath]).stdout);
check("Independent result verifier checks every artifact hash", verified.ok && Object.values(verified.checks).every(Boolean));
const rolledBack = JSON.parse(run(["--action", "rollback", "--report", applied.reportPath, "--restore-to", join(root, "restored.plan.json")]).stdout);
check("Rollback restores an exact original plan", rolledBack.exactOriginalRestored && rolledBack.restoredSha256 === report.sourceSha256);

const missingProtected = submitMaskCorrection({ packet: packet({ invariants: { protectObjectIds: ["D99"] } }), storePath });
reviewMaskCorrection({ id: missingProtected.id, decision: "approved_for_separate_execution", storePath });
const missingResult = run(["--action", "apply", "--correction-id", missingProtected.id, "--store", storePath, "--source-plan", sourcePlan, "--output-dir", join(root, "missing-protected")], false);
check("Missing protected object blocks execution", missingResult.status !== 0 && /Protected object not found/.test(missingResult.stderr));

const wrongUnit = submitMaskCorrection({ packet: packet({ target: { objectType: "尺寸标注", objectId: "D04", action: "set_dimension", targetValue: 450, unit: "cm" } }), storePath });
reviewMaskCorrection({ id: wrongUnit.id, decision: "approved_for_separate_execution", storePath });
const unitResult = run(["--action", "apply", "--correction-id", wrongUnit.id, "--store", storePath, "--source-plan", sourcePlan, "--output-dir", join(root, "wrong-unit")], false);
check("Unit mismatch blocks engineering execution", unitResult.status !== 0 && /Unit mismatch/.test(unitResult.stderr));

const failed = checks.filter(item => !item.pass);
console.log(JSON.stringify({
  format: "ai_apprentice_aicad_object_mask_adapter_smoke_v1",
  status: failed.length ? "failed" : "passed",
  passed: checks.length - failed.length,
  total: checks.length,
  root,
  reportPath: applied.reportPath,
  checks
}, null, 2));
if (failed.length) process.exit(1);
