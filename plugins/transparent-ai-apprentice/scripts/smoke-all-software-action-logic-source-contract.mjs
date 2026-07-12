#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function makeSmokeRoot(preferredRoot = "") {
  const id = String(Date.now());
  const candidates = [
    preferredRoot ? join(resolve(preferredRoot), id) : "",
    join(repoRoot, ".transparent-apprentice", "all-software-action-logic-source-contract-smoke", id),
    join(tmpdir(), "transparent-ai-apprentice-smoke", "all-software-action-logic-source-contract", id)
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      // Try the next bounded smoke directory.
    }
  }
  throw new Error("Unable to create an action logic source contract smoke directory.");
}

const smokeRoot = makeSmokeRoot(argValue("--output-dir", argValue("--out-dir", "")));

function runNodeScript(scriptName, args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${scriptName} was expected to fail`);
    return { ...JSON.parse(result.stdout), failedAsExpected: true, exitStatus: result.status };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return { ...JSON.parse(result.stdout), exitStatus: result.status };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const matrixPath = join(smokeRoot, "fixture-execution-matrix.json");
writeFileSync(
  matrixPath,
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_capability_matrix_v1",
      goal: "Prove action logic source contracts before dry-run execution.",
      counts: { totalRows: 2 },
      rows: [
        {
          rowId: "row-001",
          software: "ExampleCAD",
          processName: "examplecad.exe",
          windowTitle: "Example CAD",
          nextActionLane: "review_and_run_one_dry_run_pilot",
          actionLogicSourceStatus: "pilot_package_missing_explicit_logic_source_review",
          readinessEvidencePath: "D:\\example\\readiness.json",
          providerRoleUsePlanTrace: "highest-reasoning compile, medium-runtime blocked"
        },
        {
          rowId: "row-002",
          software: "NeedsRoute",
          nextActionLane: "collect_control_channel_evidence",
          actionLogicSourceStatus: "observation_ready_but_action_logic_source_missing"
        }
      ],
      locks: {
        reviewOnly: true,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false
      }
    },
    null,
    2
  ),
  "utf8"
);

const packageResult = runNodeScript("create-all-software-action-logic-source-contract-package.mjs", [
  "--goal",
  "Create action logic contracts for two software rows.",
  "--matrix",
  matrixPath,
  "--output-dir",
  join(smokeRoot, "package")
]);
const contractPackage = readJson(packageResult.packagePath);
const html = readFileSync(packageResult.htmlPath, "utf8");

const defaultValidation = runNodeScript("validate-all-software-action-logic-source-contract-receipt.mjs", [
  "--package",
  packageResult.packagePath,
  "--receipt",
  packageResult.receiptTemplatePath,
  "--output-dir",
  join(smokeRoot, "default-validation")
]);

const reviewedReceiptPath = join(smokeRoot, "reviewed-receipt.json");
writeFileSync(
  reviewedReceiptPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_action_logic_source_contract_receipt_v1",
      packageId: contractPackage.packageId,
      decision: "needs_teacher_review",
      rowDecisions: [
        {
          rowId: "row-001",
          software: "ExampleCAD",
          teacherDecision: "teacher_confirmed_logic_contract",
          evidenceReviewed: true,
          actionIntentReviewed: true,
          targetBindingReviewed: true,
          dataToActionLogicReviewed: true,
          dataRelationshipsReviewed: true,
          geometryRelationshipsReviewed: true,
          targetSelectionLogicReviewed: true,
          uncertaintyBlockersReviewed: true,
          executionBoundaryReviewed: true,
          rollbackPolicyReviewed: true,
          rollbackPointReviewed: true,
          outcomeVerifierReviewed: true,
          validationEvidencePlanReviewed: true,
          ragEvidenceRoleReviewedAsEvidenceOnly: true,
          reasoningTierBoundaryReviewed: true,
          providerRoleUsePlanTraceReviewed: true,
          correctedContract: {
            actionIntent: "Create the reviewed slot from teacher-confirmed dimensions only.",
            targetBinding: "Use the confirmed CAD command route or one numbered target.",
            dataToActionLogic: "slot_width equals source_data.slot_width_mm; angle equals source_data.fold_angle_deg.",
            dataRelationshipMap:
              "source_data.slot_width_mm -> slot_width; source_data.fold_angle_deg -> fold_angle; source_data.panel_id -> selected panel.",
            geometryRelationshipLogic:
              "slot center is offset from selected panel midpoint by source_data.offset_mm; fold angle equals source_data.fold_angle_deg; line length equals source_data.slot_width_mm.",
            targetSelectionLogic:
              "Teacher must choose numbered target 1 on the visible CAD panel; if multiple panels match, stop for teacher confirmation.",
            uncertaintyAndBlockers:
              "Block execution when any source datum, selected target number, geometry relation, route evidence, rollback point, or verifier is unknown or missing.",
            controlRouteEvidence: "D:\\example\\control-route.json",
            rollbackPolicy: "Use retained rollback point before any execution-capable runner.",
            outcomeVerifier: "Compare exported geometry fields before any screenshot-based review.",
            validationEvidencePlan:
              "Validate exported slot_width, fold_angle, target panel id, and route receipt before memory, packaging, or completion.",
            ragEvidenceRole: "evidence_only_not_authority",
            reasoningTierBoundary:
              "Highest reasoning compiles and repairs this contract; medium runtime may only execute after matrix patch and teacher execution gate approval.",
            mediumRuntimeReuseConditions:
              "Medium runtime reuse requires matrix patch, teacher validation, execution gate approval, retained rollback point, and verifier plan.",
            providerRoleUsePlanTrace: "highest-reasoning compile, medium-runtime blocked"
          },
          teacherNote: "logic reviewed"
        },
        {
          rowId: "row-002",
          software: "NeedsRoute",
          teacherDecision: "needs_teacher_review",
          evidenceReviewed: false,
          actionIntentReviewed: false,
          targetBindingReviewed: false,
          dataToActionLogicReviewed: false,
          rollbackPolicyReviewed: false,
          outcomeVerifierReviewed: false,
          ragEvidenceRoleReviewedAsEvidenceOnly: false,
          correctedContract: {},
          teacherNote: ""
        }
      ],
      locks: contractPackage.locks
    },
    null,
    2
  ),
  "utf8"
);
const reviewedValidation = runNodeScript("validate-all-software-action-logic-source-contract-receipt.mjs", [
  "--package",
  packageResult.packagePath,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  join(smokeRoot, "reviewed-validation")
]);
const reviewedPatch = readJson(reviewedValidation.matrixPatchPath);

const incompleteDetailedReceiptPath = join(smokeRoot, "incomplete-detailed-receipt.json");
writeFileSync(
  incompleteDetailedReceiptPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_action_logic_source_contract_receipt_v1",
      packageId: contractPackage.packageId,
      decision: "needs_teacher_review",
      rowDecisions: [
        {
          rowId: "row-001",
          software: "ExampleCAD",
          teacherDecision: "teacher_confirmed_logic_contract",
          evidenceReviewed: true,
          actionIntentReviewed: true,
          targetBindingReviewed: true,
          dataToActionLogicReviewed: true,
          dataRelationshipsReviewed: false,
          geometryRelationshipsReviewed: false,
          targetSelectionLogicReviewed: false,
          uncertaintyBlockersReviewed: false,
          executionBoundaryReviewed: true,
          rollbackPolicyReviewed: true,
          rollbackPointReviewed: true,
          outcomeVerifierReviewed: true,
          validationEvidencePlanReviewed: false,
          ragEvidenceRoleReviewedAsEvidenceOnly: true,
          reasoningTierBoundaryReviewed: false,
          providerRoleUsePlanTraceReviewed: true,
          correctedContract: {
            actionIntent: "Create the reviewed slot.",
            targetBinding: "Use a CAD command route.",
            dataToActionLogic: "slot_width equals source width.",
            rollbackPolicy: "Use retained rollback point before any execution-capable runner.",
            outcomeVerifier: "Compare exported geometry fields.",
            ragEvidenceRole: "evidence_only_not_authority",
            providerRoleUsePlanTrace: "highest-reasoning compile, medium-runtime blocked"
          },
          teacherNote: "intentionally incomplete"
        }
      ],
      locks: contractPackage.locks
    },
    null,
    2
  ),
  "utf8"
);
const incompleteDetailedValidation = runNodeScript("validate-all-software-action-logic-source-contract-receipt.mjs", [
  "--package",
  packageResult.packagePath,
  "--receipt",
  incompleteDetailedReceiptPath,
  "--output-dir",
  join(smokeRoot, "incomplete-detailed-validation")
]);

const patchedMatrixResult = runNodeScript("create-all-software-execution-capability-matrix.mjs", [
  "--matrix",
  matrixPath,
  "--action-logic-validation",
  reviewedValidation.validationPath,
  "--output-dir",
  join(smokeRoot, "patched-matrix")
]);
const patchedMatrix = readJson(patchedMatrixResult.matrixPath);

const forbiddenReceiptPath = join(smokeRoot, "forbidden-receipt.json");
writeFileSync(
  forbiddenReceiptPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_action_logic_source_contract_receipt_v1",
      packageId: contractPackage.packageId,
      decision: "execute_now",
      rowDecisions: [
        {
          rowId: "row-001",
          software: "ExampleCAD",
          teacherDecision: "execute_now",
          evidenceReviewed: true,
          actionIntentReviewed: true,
          targetBindingReviewed: true,
          dataToActionLogicReviewed: true,
          dataRelationshipsReviewed: true,
          geometryRelationshipsReviewed: true,
          targetSelectionLogicReviewed: true,
          uncertaintyBlockersReviewed: true,
          executionBoundaryReviewed: true,
          rollbackPolicyReviewed: true,
          rollbackPointReviewed: true,
          outcomeVerifierReviewed: true,
          validationEvidencePlanReviewed: true,
          ragEvidenceRoleReviewedAsEvidenceOnly: true,
          reasoningTierBoundaryReviewed: true,
          correctedContract: {
            actionIntent: "do it",
            targetBinding: "route",
            dataToActionLogic: "logic",
            dataRelationshipMap: "x -> y",
            geometryRelationshipLogic: "angle -> line",
            targetSelectionLogic: "numbered target",
            uncertaintyAndBlockers: "block if unknown",
            rollbackPolicy: "retained rollback point",
            outcomeVerifier: "verify",
            validationEvidencePlan: "validate fields",
            ragEvidenceRole: "evidence_only_not_authority",
            reasoningTierBoundary: "highest compile, medium runtime gated",
            mediumRuntimeReuseConditions: "teacher validation gate required"
          }
        }
      ],
      locks: contractPackage.locks
    },
    null,
    2
  ),
  "utf8"
);
const forbiddenValidation = runNodeScript(
  "validate-all-software-action-logic-source-contract-receipt.mjs",
  ["--package", packageResult.packagePath, "--receipt", forbiddenReceiptPath, "--output-dir", join(smokeRoot, "forbidden-validation")],
  { expectFailure: true }
);

const checks = [
  check(
    "Action logic source contract package writes review-only HTML and receipt template",
    contractPackage.format === "transparent_ai_all_software_action_logic_source_contract_package_v1" &&
      contractPackage.contractRows.length === 2 &&
      contractPackage.contractRows[0].draftPrefillSource === "local_low_token_or_dry_run_evidence_summary_requires_teacher_confirmation" &&
      contractPackage.contractRows[0].teacherMustConfirmOrReplaceDraft === true &&
      contractPackage.contractRows[0].evidenceSummary.evidencePath === "D:\\example\\readiness.json" &&
      contractPackage.contractRows[0].evidenceSummary.stillUnknown.includes("teacher intended action") &&
      contractPackage.contractRows[0].draftContract.actionIntent.includes("Teacher must confirm the intended action") &&
      contractPackage.contractRows[0].draftContract.dataRelationshipMap.includes("Teacher must map each source datum") &&
      contractPackage.contractRows[0].draftContract.geometryRelationshipLogic.includes("2D position") &&
      contractPackage.contractRows[0].draftContract.targetSelectionLogic.includes("exactly one teacher-confirmed numbered target") &&
      contractPackage.contractRows[0].draftContract.providerRoleUsePlanTrace.includes("highest-reasoning") &&
      existsSync(packageResult.htmlPath) &&
      html.includes("Action Logic Source Contract") &&
      html.includes("Teacher must confirm the intended action") &&
      html.includes("teacherMustConfirmOrReplaceDraft") &&
      html.includes("dataToActionLogic") &&
      html.includes("teacherDecision") &&
      html.includes("reviewChecks") &&
      html.includes("Local preflight") &&
      html.includes("rowPreflight") &&
      html.includes("preflight-blocked") &&
      html.includes("download-receipt") &&
      html.includes("receipt-path") &&
      html.includes("resolved-command") &&
      html.includes("validationCommandPreview") &&
      html.includes("geometryRelationshipsReviewed") &&
      html.includes("geometryRelationshipLogic") &&
      html.includes("reasoningTierBoundary") &&
      contractPackage.locks.contractPackageDoesNotExecuteSoftware === true &&
      contractPackage.locks.contractPackageDoesNotAllowMediumRuntime === true,
    packageResult.packagePath
  ),
  check(
    "Default receipt stays waiting and emits no matrix patch rows",
    defaultValidation.format === "transparent_ai_all_software_action_logic_source_contract_validation_result_v1" &&
      defaultValidation.readyPatchRowCount === 0 &&
      defaultValidation.status === "waiting_for_teacher_action_logic_source_review",
    defaultValidation.validationPath
  ),
  check(
    "Teacher-confirmed logic contract emits one locked matrix patch row without allowing medium runtime",
    reviewedValidation.readyPatchRowCount === 1 &&
      reviewedPatch.rows.length === 1 &&
      reviewedPatch.rows[0].actionLogicSourceStatus === "logic_source_contract_ready_for_review" &&
      reviewedPatch.rows[0].actionLogicSourceContract.highReasoningCompiled === true &&
      reviewedPatch.rows[0].actionLogicSourceContract.mediumRuntimeAllowed === false &&
      reviewedPatch.rows[0].actionLogicSourceContract.dataRelationshipMap.includes("slot_width") &&
      reviewedPatch.rows[0].actionLogicSourceContract.geometryRelationshipLogic.includes("fold angle") &&
      reviewedPatch.rows[0].actionLogicSourceContract.reasoningTierBoundary.includes("Highest reasoning") &&
      reviewedPatch.locks.targetSoftwareCommandsExecuted === false,
    reviewedValidation.matrixPatchPath
  ),
  check(
    "Incomplete detailed teacher receipt stays blocked from matrix patch even when the main decision says confirmed",
    incompleteDetailedValidation.readyPatchRowCount === 0 &&
      incompleteDetailedValidation.status === "waiting_for_teacher_action_logic_source_review" &&
      readJson(incompleteDetailedValidation.validationPath).validationRows[0].missing.includes("geometry_angle_position_relationships") &&
      readJson(incompleteDetailedValidation.validationPath).validationRows[0].missing.includes("high_medium_reasoning_boundary"),
    incompleteDetailedValidation.validationPath
  ),
  check(
    "Execution capability matrix consumes the logic-source patch and clears the missing logic-source blocker for that row",
    patchedMatrix.counts.logicSourceContractReadyForReview === 1 &&
      patchedMatrix.evidenceChainLedger.some(
        (row) => row.rowId === "row-001" && !row.beforeExecuteMissing.includes("reviewed_action_logic_source_contract")
      ) &&
      patchedMatrix.sourceEvidence.actionLogicValidationPath === reviewedValidation.validationPath,
    patchedMatrixResult.matrixPath
  ),
  check(
    "Forbidden execute-now decision fails closed before patching execution",
    forbiddenValidation.failedAsExpected === true &&
      forbiddenValidation.status === "blocked" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.locks.targetSoftwareCommandsExecuted === false,
    forbiddenValidation.validationPath
  )
];

const failed = checks.filter((item) => !item.pass);
const result = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_all_software_action_logic_source_contract_smoke_v1",
  smokeRoot,
  paths: {
    package: packageResult.packagePath,
    defaultValidation: defaultValidation.validationPath,
    reviewedValidation: reviewedValidation.validationPath,
    patchedMatrix: patchedMatrixResult.matrixPath,
    forbiddenValidation: forbiddenValidation.validationPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (failed.length > 0) process.exit(1);
