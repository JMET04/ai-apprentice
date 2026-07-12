#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function run(args, expectOk = true) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 180000 });
  if (expectOk && result.status !== 0) {
    throw new Error(`command failed\nargs=${args.join(" ")}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`command unexpectedly passed\nargs=${args.join(" ")}\nstdout=${result.stdout}`);
  }
  return result;
}

function runJson(args, expectOk = true) {
  const result = run(args, expectOk);
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-transparent-sketch-rule-draft-"));
const rollbackPoint = join(root, "rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-transparent-sketch-logic-contract-rule-draft",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const rehearsal = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-depth-demonstration-rehearsal.mjs",
  "--goal",
  "Smoke transparent sketch logic contract rule draft from 2D perspective 3D depth demonstration.",
  "--software",
  "target engineering software",
  "--selected-number",
  "1",
  "--teacher-confirmed-number",
  "--preferred-adapter",
  "existing-windows-ui-automation",
  "--output-dir",
  join(root, "rehearsal")
]);
const spatialIntent = readJson(rehearsal.spatialIntent);
if (spatialIntent.format !== "transparent_ai_spatial_intent_interpretation_v1") {
  throw new Error("Rehearsal did not produce spatial intent interpretation.");
}

const missingFlag = run(
  [
    "plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-logic-contract-rule-draft.mjs",
    "--spatial-intent",
    rehearsal.spatialIntent,
    "--rollback-point",
    rollbackPoint,
    "--output-dir",
    join(root, "missing-flag")
  ],
  false
);
if (!missingFlag.stderr.includes("TRANSPARENT_SKETCH_RULE_DRAFT_REQUIRES_TEACHER_REVIEWED_SPATIAL_INTENT_FLAG")) {
  throw new Error("Missing teacher-reviewed flag should be rejected.");
}

const draftResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-logic-contract-rule-draft.mjs",
  "--spatial-intent",
  rehearsal.spatialIntent,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed-spatial-intent",
  "--output-dir",
  join(root, "draft")
]);
const draft = readJson(draftResult.packagePath);
const compiled = readJson(draft.compiledRulePackagePath);
const compiledScopes = new Set(compiled.rules.map((rule) => rule.scope?.applies_when?.scope).filter(Boolean));

const incomplete = {
  format: "transparent_ai_spatial_intent_interpretation_v1",
  interpretationId: "incomplete-smoke",
  createdAt: "2026-06-19T00:00:00.000Z",
  sourceOverlayPacket: "",
  software: "target engineering software",
  goal: "Incomplete transparent sketch logic contract",
  summary: {
    supports2D: true,
    supports3DDepthHints: false
  },
  detailLogicContract: {
    format: "transparent_ai_universal_detail_logic_contract_v1",
    consequentialDetailRows: [
      {
        id: "only-position",
        sourceElementId: "only-position",
        detailCategory: "position/alignment/relation",
        classification: "constraint_or_relationship_backed",
        logicSource: "normalized point",
        sourceEvidence: { x: 0.5, y: 0.5 },
        blocksExecutionIfMissing: true
      }
    ],
    missingDetailLogicRows: [],
    missingDetailLogicCount: 0,
    missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review"
  }
};
const incompletePath = join(root, "incomplete-spatial-intent.json");
writeJson(incompletePath, incomplete);
const incompleteRun = runJson(
  [
    "plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-logic-contract-rule-draft.mjs",
    "--spatial-intent",
    incompletePath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed-spatial-intent",
    "--output-dir",
    join(root, "incomplete-draft")
  ],
  false
);

const checks = [
  {
    name: "Reuses existing transparent sketch depth rehearsal as source evidence",
    pass:
      rehearsal.status === "depth_demonstration_rehearsed_waiting_for_dry_run_route_review" &&
      spatialIntent.summary?.supports2D === true &&
      spatialIntent.summary?.supports3DDepthHints === true &&
      spatialIntent.detailLogicContract?.missingLogicSourceBehavior === "block_execute_and_route_to_teacher_review"
  },
  {
    name: "Missing teacher-reviewed spatial intent flag is rejected",
    pass: missingFlag.status !== 0
  },
  {
    name: "Draft package compiles only disabled Rule DSL cards for 2D angle perspective depth logic",
    pass:
      draft.status === "ready_for_teacher_transparent_sketch_logic_contract_rule_draft_review" &&
      draft.disabledRuleCount >= 3 &&
      compiled.rules.length === draft.disabledRuleCount &&
      compiled.rules.every((rule) => rule.lifecycle === "draft_disabled") &&
      compiledScopes.has("position_alignment_relation") &&
      compiledScopes.has("angle_direction_curvature") &&
      compiledScopes.has("view_depth_perspective")
  },
  {
    name: "Locks forbid visual-similarity execution memory activation screenshots packaging and completion",
    pass:
      draft.locks.ruleEnabled === false &&
      draft.locks.memoryEnabled === false &&
      draft.locks.softwareActionsExecuted === false &&
      draft.locks.screenshotsCaptured === false &&
      draft.locks.packagingUnlocked === false &&
      draft.locks.goalComplete === false
  },
  {
    name: "Incomplete spatial logic scopes are blocked",
    pass:
      incompleteRun.status === "blocked_transparent_sketch_logic_contract_rule_draft_validation_failed" &&
      incompleteRun.errors.some((error) => error.error_code === "MISSING_REQUIRED_TRANSPARENT_SKETCH_LOGIC_SCOPE")
  }
];
const failed = checks.filter((check) => !check.pass);

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      smoke: "transparent_ai_transparent_sketch_logic_contract_rule_draft_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        rehearsal: rehearsal.rehearsalPath,
        spatialIntent: rehearsal.spatialIntent,
        ruleDraft: draftResult.packagePath,
        compiledRulePackage: draft.compiledRulePackagePath
      },
      requiredScopes: draft.detailLogicContractSummary.requiredScopes,
      locks: draft.locks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
