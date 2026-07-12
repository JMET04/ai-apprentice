#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "objective-next-lane-command-builder", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${scriptName} unexpectedly succeeded`);
    return { failedAsExpected: true, stdout: result.stdout, stderr: result.stderr };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function selectedReceipt(template, selectedId) {
  return {
    ...template,
    rowDecisions: template.rowDecisions.map((row) => ({
      ...row,
      teacherDecision: row.id === selectedId ? "teacher_selects_next_lane" : "teacher_confirms_audit_status",
      auditRowReviewed: true,
      teacherNote: row.id === selectedId ? `select ${selectedId}` : "confirm audit status"
    }))
  };
}

const auditResult = runNodeScript("create-original-goal-objective-fulfillment-audit.mjs", [
  "--output-dir",
  join(smokeRoot, "audit")
]);
const receiptBuilderResult = runNodeScript("create-original-goal-objective-fulfillment-receipt-builder.mjs", [
  "--audit",
  auditResult.auditPath,
  "--output-dir",
  join(smokeRoot, "receipt-builder")
]);
const template = readJson(receiptBuilderResult.receiptTemplatePath);
const expected = {
  all_software_low_token_learning: "low_token_coverage_review",
  adapt_any_teacher_learning_method: "teacher_method_review",
  transparent_mask_2d_perspective_3d_depth_understanding: "transparent_sketch_depth_review",
  execute_in_target_software_after_confirmation: "execution_gate_review"
};

const commandBuilders = [];
for (const [requirementId, routeKind] of Object.entries(expected)) {
  const receiptPath = writeJson(join(smokeRoot, `${requirementId}-receipt.json`), selectedReceipt(template, requirementId));
  const validationResult = runNodeScript("validate-original-goal-objective-fulfillment-receipt.mjs", [
    "--audit",
    auditResult.auditPath,
    "--receipt",
    receiptPath,
    "--output-dir",
    join(smokeRoot, `${requirementId}-validation`)
  ]);
  const commandResult = runNodeScript("create-original-goal-objective-next-lane-command-builder.mjs", [
    "--validation",
    validationResult.validationPath,
    "--output-dir",
    join(smokeRoot, `${requirementId}-command-builder`)
  ]);
  const packet = readJson(commandResult.builderPath);
  commandBuilders.push({ requirementId, routeKind, commandResult, packet });
}

const noSelectionReceiptPath = writeJson(join(smokeRoot, "no-selection-receipt.json"), {
  ...template,
  rowDecisions: template.rowDecisions.map((row) => ({
    ...row,
    teacherDecision: "teacher_confirms_audit_status",
    auditRowReviewed: true,
    teacherNote: "confirm only"
  }))
});
const noSelectionValidation = runNodeScript("validate-original-goal-objective-fulfillment-receipt.mjs", [
  "--audit",
  auditResult.auditPath,
  "--receipt",
  noSelectionReceiptPath,
  "--output-dir",
  join(smokeRoot, "no-selection-validation")
]);
const noSelectionFailure = runNodeScript(
  "create-original-goal-objective-next-lane-command-builder.mjs",
  ["--validation", noSelectionValidation.validationPath, "--output-dir", join(smokeRoot, "no-selection-command-builder")],
  { expectFailure: true }
);

const checks = [
  {
    name: "Command builder maps all four objective lanes to existing review routes",
    pass:
      commandBuilders.length === 4 &&
      commandBuilders.every((row) => row.packet.format === "transparent_ai_original_goal_objective_next_lane_command_builder_v1") &&
      commandBuilders.every((row) => row.packet.command.routeKind === row.routeKind) &&
      commandBuilders.every((row) => row.packet.command.teacherInstruction) &&
      commandBuilders.every((row) => row.packet.command.openPath || row.packet.command.validationCommand),
    evidence: commandBuilders.map((row) => ({ requirementId: row.requirementId, routeKind: row.packet.command.routeKind }))
  },
  {
    name: "Command builder remains no-op and review-only",
    pass:
      commandBuilders.every((row) => row.packet.command.executeNow === false) &&
      commandBuilders.every((row) => row.packet.command.registerNow === false) &&
      commandBuilders.every((row) => row.packet.command.writeMemoryNow === false) &&
      commandBuilders.every((row) => row.packet.command.claimCompleteNow === false) &&
      commandBuilders.every((row) => row.packet.locks.builderDoesNotExecuteTargetSoftware === true) &&
      commandBuilders.every((row) => row.packet.locks.goalComplete === false),
    evidence: commandBuilders[0]?.packet.locks
  },
  {
    name: "No selected lane is rejected before command building",
    pass:
      noSelectionFailure.failedAsExpected === true &&
      String(noSelectionFailure.stderr || noSelectionFailure.stdout).includes("requires exactly one selected lane"),
    evidence: noSelectionFailure.stderr || noSelectionFailure.stdout
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_objective_next_lane_command_builder_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
