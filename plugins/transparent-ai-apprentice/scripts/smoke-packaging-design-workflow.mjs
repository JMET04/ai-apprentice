#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const workflow = join(root, "scripts", "packaging-design-workflow.mjs");
const smokeParent = resolve(root, "..", "..", ".ta-smoke");
mkdirSync(smokeParent, { recursive: true });
const temp = mkdtempSync(join(smokeParent, "ai-apprentice-packaging-workflow-"));

function run(argumentsList, expected = 0) {
  const result = spawnSync(process.execPath, [workflow, ...argumentsList], { cwd: root, encoding: "utf8", env: { ...process.env, TEMP: smokeParent, TMP: smokeParent } });
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result.stdout ? JSON.parse(result.stdout) : JSON.parse(result.stderr);
}

const incomplete = run(["--action", "create", "--request", "设计一个包装", "--output-dir", temp]);
assert.equal(incomplete.stage, "requirements_clarification");
assert.ok(incomplete.missingRequirements.includes("productType"));
assert.equal(incomplete.locks.accepted, false);

const created = run([
  "--action", "create",
  "--request", "设计插舌锁合折叠盒",
  "--product-type", "插舌锁合折叠盒",
  "--length", "200", "--width", "120", "--height", "60",
  "--material", "0.5 mm 白卡纸", "--thickness", "0.5 mm",
  "--output-dir", temp
]);
assert.equal(created.stage, "solution_planning");
const sessionPath = created.sessionPath;

const sample = join(temp, "sample.png");
writeFileSync(sample, "sample", "utf8");
const skipped = spawnSync(process.execPath, [workflow, "--action", "record-sample", "--session", sessionPath, "--artifact", sample], { cwd: root, encoding: "utf8" });
assert.notEqual(skipped.status, 0);
assert.match(skipped.stderr, /Stage skipping is blocked/);

const plan = join(temp, "plan.json");
writeFileSync(plan, JSON.stringify({ format: "transparent_ai_apprentice_packaging_solution_plan_v1" }), "utf8");
const planned = run(["--action", "record-plan", "--session", sessionPath, "--artifact", plan]);
assert.equal(planned.stage, "image2_sample_generation");
assert.ok(planned.artifacts.initialPromptGuidance);
assert.match(planned.artifacts.initialPromptGuidanceSha256, /^[a-f0-9]{64}$/);
const initialPromptGuidance = JSON.parse(readFileSync(planned.artifacts.initialPromptGuidance, "utf8"));
assert.equal(initialPromptGuidance.format, "transparent_ai_apprentice_image2_initial_prompt_guidance_v1");
assert.equal(initialPromptGuidance.readyForGeneration, true);
assert.equal(initialPromptGuidance.route.domain, "packaging");
assert.match(initialPromptGuidance.prompt, /200 × 120 × 60 mm/);
assert.equal(initialPromptGuidance.provenance.sourceThreadId, "019f09a9-90ab-76b2-aa1f-b7c9bddf93e8");
const originalPromptGuidance = readFileSync(planned.artifacts.initialPromptGuidance, "utf8");
writeFileSync(planned.artifacts.initialPromptGuidance, `${originalPromptGuidance}\n`, "utf8");
const tamperedPrompt = spawnSync(process.execPath, [workflow, "--action", "record-sample", "--session", sessionPath, "--artifact", sample], { cwd: root, encoding: "utf8" });
assert.notEqual(tamperedPrompt.status, 0);
assert.match(tamperedPrompt.stderr, /initial prompt guidance hash mismatch/);
writeFileSync(planned.artifacts.initialPromptGuidance, originalPromptGuidance, "utf8");
assert.equal(run(["--action", "record-sample", "--session", sessionPath, "--artifact", sample]).stage, "sample_self_check");

const session = JSON.parse(readFileSync(sessionPath, "utf8"));
const selfCheck = join(temp, "self-check.json");
const requiredIds = [
  "dimension_completeness",
  "unit_consistency",
  "shape_and_panel_topology",
  "cut_crease_slot_conflicts",
  "closure_and_clearance",
  "manufacturing_feasibility",
  "annotation_legibility",
  "image2_pixels_not_dimension_truth"
];
writeFileSync(selfCheck, JSON.stringify({
  format: "transparent_ai_apprentice_packaging_sample_self_check_v1",
  sessionId: session.id,
  dimensionTruthSource: "teacher_or_engineering_data_only",
  checks: requiredIds.map((id) => ({ id, status: "pass", evidence: "fixture" }))
}), "utf8");
assert.equal(run(["--action", "record-self-check", "--session", sessionPath, "--artifact", selfCheck]).stage, "teacher_mask_correction");

const correction = join(temp, "correction.json");
writeFileSync(correction, JSON.stringify({ format: "transparent_ai_sketch_overlay_packet_v1", strokes: [{ id: "stroke-1" }], anchors: [] }), "utf8");
assert.equal(run(["--action", "record-correction", "--session", sessionPath, "--artifact", correction]).stage, "image2_local_edit");

const edited = join(temp, "edited.png");
writeFileSync(edited, "edited", "utf8");
assert.equal(run(["--action", "record-local-edit", "--session", sessionPath, "--artifact", edited]).stage, "cad_handoff");
const handoffResult = run(["--action", "prepare-cad-handoff", "--session", sessionPath]);
const handoff = JSON.parse(readFileSync(handoffResult.artifacts.cadHandoff, "utf8"));
assert.equal(handoff.format, "transparent_ai_apprentice_aicad_request_v1");
assert.equal(handoff.engineeringTruth.imagePixelsUsedAsDimensions, false);
assert.equal(handoff.evidence.image2Sample.pixelMeasurementsAllowed, false);
assert.equal(handoff.safety.packagingGated, true);
assert.match(handoff.evidence.solutionPlan.sha256, /^[a-f0-9]{64}$/);

const cadResult = join(temp, "cad-result.json");
writeFileSync(cadResult, JSON.stringify({
  format: "transparent_ai_apprentice_aicad_result_v1",
  handoffId: handoff.handoffId,
  requestSha256: handoffResult.artifacts.cadHandoff ? (await import("node:crypto")).createHash("sha256").update(readFileSync(handoffResult.artifacts.cadHandoff)).digest("hex") : "",
  status: "pass_with_host_skips",
  provenance: { producer: "aicad-agent", version: "1.2.0", imagePixelsUsedAsDimensions: false },
  artifacts: [],
  validation: { aicadDeterministicValidation: { status: "passed" }, mainRuleDslValidation: { status: "not_run" } },
  hostExecutions: [],
  errors: [],
  preventionRuleDrafts: [],
  safety: { reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true, productionApprovalClaimed: false }
}), "utf8");
assert.equal(run(["--action", "record-cad-result", "--session", sessionPath, "--artifact", cadResult]).stage, "final_teacher_review");

console.log(JSON.stringify({ ok: true, checks: 29, finalStage: "final_teacher_review", sessionPath }, null, 2));
