#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "current-goal-shortest-teacher-evidence-pack", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const launchpadResult = runNodeScript("create-current-goal-start-here-launchpad.mjs", [
  "--output-dir",
  join(smokeRoot, "start-here")
]);
const result = runNodeScript("create-current-goal-shortest-teacher-evidence-pack.mjs", [
  "--launchpad",
  launchpadResult.launchpadPath,
  "--output-dir",
  smokeRoot
]);

const pack = readJson(result.packPath);
const receiptTemplate = readJson(result.receiptTemplatePath);
const html = readFileSync(result.htmlPath, "utf8");
const receiptBuilderHtml = readFileSync(result.receiptBuilderHtmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");
const stepIds = new Set(pack.teacherSteps.map((item) => item.id));

const dummyEvidenceDir = join(smokeRoot, "dummy-evidence");
mkdirSync(dummyEvidenceDir, { recursive: true });
function dummyFile(name) {
  const path = join(dummyEvidenceDir, name);
  writeFileSync(path, JSON.stringify({ smoke: true, name }, null, 2) + "\n", "utf8");
  return path;
}
const validReceiptPath = join(smokeRoot, "teacher-filled-shortest-evidence-receipt.json");
writeFileSync(
  validReceiptPath,
  JSON.stringify(
    {
      ...receiptTemplate,
      teacherDecision: "ready_for_trial_receipt_routing",
      selectedSoftware: "Smoke software",
      selectedLowTokenRouteId: "smoke-low-token-route",
      validatedLowTokenRouteReceiptPath: dummyFile("validated-low-token-route-receipt.json"),
      teacherOverlayPacketPath: dummyFile("teacher-overlay-packet.json"),
      teacherOverlayPacketValidationPath: dummyFile("overlay-packet-validation.json"),
      teacherReviewedSpatialIntentPath: dummyFile("teacher-reviewed-spatial-intent.json"),
      teacherReviewedMethodProfile: true,
      teacherMethodContractPath: dummyFile("teacher-method-contract.json"),
      confirmedRollbackPoint: "retained-smoke-rollback-point",
      teacherNotes: "Smoke valid shortest evidence receipt."
    },
    null,
    2
  ) + "\n",
  "utf8"
);
const validReceiptValidationResult = runNodeScript("validate-current-goal-shortest-teacher-evidence-receipt.mjs", [
  "--pack",
  result.packPath,
  "--receipt",
  validReceiptPath,
  "--validate-derived-trial",
  "--output-dir",
  join(smokeRoot, "validations")
]);
const validReceiptValidation = readJson(validReceiptValidationResult.validationPath);
const derivedTrialValidationResult = validReceiptValidation.derivedTeacherTrialReceiptValidationResult;
const derivedTrialValidation = readJson(validReceiptValidation.derivedTeacherTrialReceiptValidationPath);

const forbiddenReceiptPath = join(smokeRoot, "forbidden-shortest-evidence-receipt.json");
writeFileSync(
  forbiddenReceiptPath,
  JSON.stringify(
    {
      ...receiptTemplate,
      teacherDecision: "execute_now",
      locks: { ...receiptTemplate.locks, teacherReceiptDoesNotExecuteTargetSoftware: false, softwareActionsExecuted: true }
    },
    null,
    2
  ) + "\n",
  "utf8"
);
const forbiddenReceiptValidationResult = runNodeScript("validate-current-goal-shortest-teacher-evidence-receipt.mjs", [
  "--pack",
  result.packPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "validations")
]);
const forbiddenReceiptValidation = readJson(forbiddenReceiptValidationResult.validationPath);

const checks = [
  {
    name: "Shortest teacher evidence pack writes JSON HTML README",
    pass:
      pack.format === "transparent_ai_current_goal_shortest_teacher_evidence_pack_v1" &&
      existsSync(pack.paths.pack) &&
      existsSync(pack.paths.html) &&
      existsSync(pack.paths.readme) &&
      existsSync(pack.paths.receiptTemplate) &&
      existsSync(pack.paths.receiptBuilderHtml) &&
      pack.paths.pack === result.packPath &&
      result.teacherStepCount === 6,
    evidence: pack.paths
  },
  {
    name: "Pack contains the minimum ordered teacher evidence route",
    pass:
      stepIds.has("pick_one_low_token_route") &&
      stepIds.has("draw_and_validate_overlay_packet") &&
      stepIds.has("ground_spatial_intent_with_physical_world_pack") &&
      stepIds.has("review_teacher_method_profile") &&
      stepIds.has("build_validate_and_route_teacher_trial_receipt") &&
      stepIds.has("final_acceptance_only_after_real_evidence") &&
      pack.teacherSteps[0].id === "pick_one_low_token_route" &&
      pack.teacherSteps[pack.teacherSteps.length - 1].id === "final_acceptance_only_after_real_evidence",
    evidence: pack.teacherSteps.map((item) => item.id)
  },
  {
    name: "Pack reuses existing workbench, overlay, method, physical grounding, router, and final acceptance paths",
    pass:
      pack.teacherSteps.some((item) => item.openPath.includes("receipt-builder")) &&
      pack.teacherSteps.some((item) => item.openPath.includes("transparent") || item.openPath.includes("overlay")) &&
      pack.teacherSteps.some((item) => item.openPath.includes("physical-world-spatial-grounding")) &&
      pack.teacherSteps.some((item) => item.openPath.includes("teacher-method")) &&
      pack.paths.teacherTrialWorkbench.includes("current-goal-teacher-trial-workbench") &&
      pack.paths.finalTeacherAcceptanceReviewPack.includes("current-goal-final-teacher-acceptance-review-pack"),
    evidence: pack.teacherSteps.map((item) => ({ id: item.id, openPath: item.openPath }))
  },
  {
    name: "Pack exposes verifier commands for receipt, router, overlay, method, and final acceptance",
    pass:
      pack.teacherSteps.some((item) => item.verifyCommand.includes("validate-current-goal-teacher-trial-workbench-receipt.mjs")) &&
      pack.teacherSteps.some((item) => item.verifyCommand.includes("create-current-goal-teacher-trial-intake-router.mjs")) &&
      pack.teacherSteps.some((item) => item.verifyCommand.includes("validate-current-goal-final-teacher-acceptance-receipt.mjs")) &&
      pack.receiptValidationCommandTemplate.includes("validate-current-goal-shortest-teacher-evidence-receipt.mjs") &&
      pack.teacherSteps.some((item) => item.verifyCommand.includes("create-physical-world-spatial-grounding-pack.mjs")) &&
      pack.teacherSteps.some((item) => item.requiredReceiptField === "teacherOverlayPacketValidationPath") &&
      pack.teacherSteps.some((item) => item.requiredReceiptField === "teacherReviewedMethodProfile"),
    evidence: pack.teacherSteps.map((item) => ({ id: item.id, verifyCommand: item.verifyCommand }))
  },
  {
    name: "Unified receipt builder writes a shortest evidence receipt without execution controls",
    pass:
      receiptTemplate.format === "transparent_ai_current_goal_shortest_teacher_evidence_receipt_v1" &&
      receiptTemplate.teacherDecision === "needs_teacher_review" &&
      receiptTemplate.allowedTeacherDecisions.includes("ready_for_trial_receipt_routing") &&
      receiptTemplate.forbiddenDecisions.includes("execute_now") &&
      receiptBuilderHtml.includes("Shortest Teacher Evidence Receipt Builder") &&
      receiptBuilderHtml.includes("Download Receipt JSON") &&
      receiptBuilderHtml.includes("teacherReceiptDoesNotExecuteTargetSoftware: true") &&
      receiptBuilderHtml.includes("goalComplete: false"),
    evidence: { receiptTemplate: pack.paths.receiptTemplate, receiptBuilderHtml: pack.paths.receiptBuilderHtml }
  },
  {
    name: "Unified receipt validator creates an existing-workbench-compatible derived receipt",
    pass:
      validReceiptValidation.ok === true &&
      validReceiptValidation.status === "ready_for_separate_execution_approval_gate_manual_command" &&
      validReceiptValidation.readyForTeacherTrialReceiptValidation === true &&
      validReceiptValidation.derivedTeacherTrialReceiptPath &&
      existsSync(validReceiptValidation.derivedTeacherTrialReceiptPath) &&
      validReceiptValidation.derivedTeacherTrialReceiptValidationPath &&
      existsSync(validReceiptValidation.derivedTeacherTrialReceiptValidationPath) &&
      readJson(validReceiptValidation.derivedTeacherTrialReceiptPath).format ===
        "transparent_ai_current_goal_teacher_trial_workbench_receipt_v1" &&
      validReceiptValidation.nextManualCommands.some((command) =>
        command.includes("validate-current-goal-teacher-trial-workbench-receipt.mjs")
      ),
    evidence: validReceiptValidation
  },
  {
    name: "Derived teacher trial receipt validates through existing workbench gate",
    pass:
      derivedTrialValidationResult.ok === true &&
      derivedTrialValidation.ok === true &&
      derivedTrialValidation.status === "ready_for_separate_execution_approval_gate_manual_command" &&
      derivedTrialValidation.readyForNextManualCommand === true &&
      derivedTrialValidation.locks.validationDoesNotExecuteTargetSoftware === true &&
      derivedTrialValidation.locks.goalComplete === false &&
      derivedTrialValidation.nextManualCommand.includes("create-spatial-to-software-execution-gate-package.mjs") &&
      derivedTrialValidation.nextManualCommand.includes("--spatial-validation") &&
      derivedTrialValidation.nextManualCommand.includes("teacher-reviewed-spatial-intent.json") &&
      derivedTrialValidation.nextManualCommand.includes("--rollback-point") &&
      derivedTrialValidation.nextManualCommand.includes("retained-smoke-rollback-point") &&
      derivedTrialValidation.nextManualCommand.includes("--software") &&
      derivedTrialValidation.nextManualCommand.includes("\"Smoke software\"") &&
      !derivedTrialValidation.nextManualCommand.includes("--spatial-receipt"),
    evidence: {
      validationResult: derivedTrialValidationResult,
      validationPath: derivedTrialValidationResult.validationPath,
      nextManualCommand: derivedTrialValidation.nextManualCommand
    }
  },
  {
    name: "Unified receipt validator fails closed on forbidden execution claims",
    pass:
      forbiddenReceiptValidation.ok === false &&
      forbiddenReceiptValidation.status === "blocked_for_invalid_or_forbidden_shortest_teacher_evidence_receipt" &&
      forbiddenReceiptValidation.reasons.includes("unsupported_teacher_decision:execute_now") &&
      forbiddenReceiptValidation.reasons.includes("forbidden_teacher_decision:execute_now") &&
      forbiddenReceiptValidation.reasons.includes("receipt_claims_software_execution") &&
      forbiddenReceiptValidation.locks.validationDoesNotExecuteTargetSoftware === true,
    evidence: forbiddenReceiptValidation
  },
  {
    name: "Pack keeps all side-effect and completion locks closed",
    pass:
      pack.goalComplete === false &&
      pack.locks.reviewOnly === true &&
      pack.locks.packDoesNotReadLogs === true &&
      pack.locks.packDoesNotCaptureScreenshots === true &&
      pack.locks.packDoesNotRegisterMonitor === true &&
      pack.locks.packDoesNotExecuteTargetSoftware === true &&
      pack.locks.packDoesNotWriteMemory === true &&
      pack.locks.packDoesNotEnableRules === true &&
      pack.locks.packDoesNotDowngradeRuntime === true &&
      pack.locks.packDoesNotDeleteRollbackPoints === true &&
      pack.locks.goalComplete === false,
    evidence: pack.locks
  },
  {
    name: "HTML and README are teacher-facing and preserve incompletion boundary",
    pass:
      html.includes("Shortest Teacher Evidence Pack") &&
      html.includes("Goal complete:</strong> false") &&
      html.includes("does not read logs") &&
      html.includes("Unified shortest evidence receipt builder") &&
      html.includes("Final acceptance only after real evidence exists") &&
      readme.includes("Current Goal Shortest Teacher Evidence Pack") &&
      readme.includes("Unified receipt builder") &&
      readme.includes("Goal complete: false"),
    evidence: { htmlPath: result.htmlPath, readmePath: result.readmePath }
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed, smokeRoot }, null, 2));
  process.exit(1);
}

rmSync(smokeRoot, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_current_goal_shortest_teacher_evidence_pack_smoke_v1",
      checks,
      tempCleaned: true
    },
    null,
    2
  )
);
