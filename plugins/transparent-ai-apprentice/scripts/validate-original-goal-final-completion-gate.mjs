#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-final-completion-gate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-final-completion-gate"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  const allowedFormats = Array.isArray(expectedFormat) ? expectedFormat : expectedFormat ? [expectedFormat] : [];
  if (allowedFormats.length > 0 && !allowedFormats.includes(parsed.value?.format)) {
    throw new Error(`${label} must be one of: ${allowedFormats.join(", ")}`);
  }
  return parsed;
}

function newestDirectoryWithFile(root, fileName) {
  if (!existsSync(root)) return "";
  return (
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const dir = join(root, entry.name);
        const file = join(dir, fileName);
        return existsSync(file) ? { file, time: statSync(dir).mtimeMs } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.time - a.time)[0]?.file || ""
  );
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function locks() {
  return {
    reviewOnly: true,
    gateDoesNotCollectEvidence: true,
    gateDoesNotRunCommands: true,
    gateDoesNotRegisterTask: true,
    gateDoesNotLaunchRunner: true,
    gateDoesNotCaptureScreenshots: true,
    gateDoesNotReadLogs: true,
    gateDoesNotExecuteTargetSoftware: true,
    gateDoesNotSendUiEvents: true,
    gateDoesNotWriteMemory: true,
    gateDoesNotEnableRules: true,
    packagingGated: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false
  };
}

function lane({ id, requirement, ready, evidence, blocker, sourcePath }) {
  return {
    id,
    requirement,
    status: ready ? "ready_for_final_teacher_acceptance_review" : "blocked_before_goal_completion_claim",
    ready: Boolean(ready),
    evidence,
    blocker: ready ? "" : blocker,
    sourcePath: sourcePath || ""
  };
}

function writeHtml(path, gate) {
  const rows = gate.lanes
    .map(
      (item) => `<tr>
        <td>${htmlEscape(item.id)}</td>
        <td>${htmlEscape(item.status)}</td>
        <td>${htmlEscape(item.requirement)}</td>
        <td>${htmlEscape(item.evidence)}</td>
        <td>${htmlEscape(item.blocker)}</td>
        <td>${item.sourcePath ? `<a href="${htmlEscape(fileHref(item.sourcePath))}">${htmlEscape(basename(item.sourcePath))}</a>` : ""}</td>
      </tr>`
    )
    .join("");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Final Completion Gate</title>
  <style>
    :root { color: #17202a; background: #f6f8fb; font: 14px/1.45 "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1220px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 27px; letter-spacing: 0; }
    .summary, table { background: #fff; border: 1px solid #d9e2ef; border-radius: 8px; }
    .summary { padding: 15px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 9px; text-align: left; vertical-align: top; }
    th { background: #edf3f8; }
    a { color: #145f8f; overflow-wrap: anywhere; }
    .lock { color: #596779; font-size: 13px; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Final Completion Gate</h1>
  <section class="summary">
    <p><strong>Status:</strong> ${htmlEscape(gate.status)}</p>
    <p><strong>Decision:</strong> ${htmlEscape(gate.completionDecision)}</p>
    <p><strong>Ready lanes:</strong> ${htmlEscape(gate.counts.readyLanes)} / ${htmlEscape(gate.counts.totalLanes)}</p>
    <p class="lock">This final gate validates supplied evidence only. It does not gather evidence, run commands, register tasks, capture screenshots, execute target software, write memory, enable rules, unlock packaging, or itself accept the technology.</p>
  </section>
  <table>
    <thead><tr><th>Lane</th><th>Status</th><th>Requirement</th><th>Evidence</th><th>Blocker</th><th>Source</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, gate) {
  const lines = [
    "# Original Goal Final Completion Gate",
    "",
    `Status: ${gate.status}`,
    `Completion decision: ${gate.completionDecision}`,
    `Ready lanes: ${gate.counts.readyLanes}/${gate.counts.totalLanes}`,
    "",
    "This gate is the final anti-false-completion check for the user's full objective.",
    "It requires low-token all-software coverage, bounded real-local non-CAD/SolidWorks scope evidence, teacher-method adaptation plus before/after reuse-result proof, unattended operational evidence, transparent 2D/perspective/3D sketch implementation, teacher-validated spatial intent evidence, voice/text numbered target confirmation, execution capability convergence, Rule DSL / Validation Report / closed Delivery Gate audit evidence, and explicit final teacher acceptance.",
    "",
    "Blocked lanes:",
    ...gate.lanes.filter((item) => !item.ready).map((item) => `- ${item.id}: ${item.blocker}`),
    "",
    "Locks:",
    ...Object.entries(gate.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "Validate whether the full original objective can be claimed complete from current evidence."
);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-final-completion-gates"))
);
mkdirSync(outputRoot, { recursive: true });
const gateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const gateDir = join(outputRoot, gateId);
mkdirSync(gateDir, { recursive: true });

const blockerMatrixInput = readJsonInput(
  argValue("--completion-blocker-matrix", argValue("--matrix", "")),
  "--completion-blocker-matrix",
  "transparent_ai_original_goal_completion_blocker_matrix_v1"
);
const lowTokenCoverageGateInput = readJsonInput(
  argValue("--low-token-coverage-gate", argValue("--coverage-gate", "")),
  "--low-token-coverage-gate",
  "transparent_ai_original_goal_low_token_coverage_completion_gate_v1"
);
const realLocalReadinessPackageInput = readJsonInput(
  argValue("--real-local-readiness-package", argValue("--readiness-package", "")),
  "--real-local-readiness-package",
  "transparent_ai_real_local_all_software_low_token_readiness_package_v1"
);
const teacherMethodContractReceiptValidationInput = readJsonInput(
  argValue("--teacher-method-contract-receipt-validation", argValue("--teacher-method-validation", "")),
  "--teacher-method-contract-receipt-validation",
  "transparent_ai_teacher_method_execution_learning_contract_receipt_validation_v1"
);
const teacherMethodReuseResultProofValidationInput = readJsonInput(
  argValue("--teacher-method-reuse-result-proof-validation", argValue("--teacher-method-reuse-validation", "")),
  "--teacher-method-reuse-result-proof-validation",
  "transparent_ai_teacher_method_reuse_result_proof_validation_v1"
);
const unattendedAuditInput = readJsonInput(
  argValue("--unattended-audit", ""),
  "--unattended-audit",
  "transparent_ai_all_software_unattended_learning_audit_v1"
);
const sketchAuditInput = readJsonInput(
  argValue("--sketch-implementation-audit", argValue("--sketch-audit", "")),
  "--sketch-implementation-audit",
  [
    "transparent_ai_sketch_demonstration_implementation_audit_v1",
    "transparent_ai_sketch_demonstration_implementation_audit_package_v1"
  ]
);
const spatialReceiptValidationInput = readJsonInput(
  argValue("--spatial-intent-receipt-validation", argValue("--spatial-validation", "")),
  "--spatial-intent-receipt-validation",
  "transparent_ai_spatial_intent_evidence_receipt_validation_v1"
);
const executionConvergenceInput = readJsonInput(
  argValue("--execution-convergence-audit", argValue("--execution-audit", "")),
  "--execution-convergence-audit",
  "transparent_ai_all_software_execution_capability_convergence_audit_v1"
);
const integratedEvidenceGateInput = readJsonInput(
  argValue("--integrated-evidence-gate", argValue("--current-goal-integrated-evidence-gate", "")) ||
    newestDirectoryWithFile(
      join(process.cwd(), "artifacts", "current-goal-integrated-evidence-gates"),
      "current-goal-integrated-evidence-gate.json"
    ),
  "--integrated-evidence-gate",
  "transparent_ai_current_goal_integrated_evidence_gate_v1"
);
const ruleDslDeliveryGateAuditInput = readJsonInput(
  argValue("--rule-dsl-delivery-gate-audit", argValue("--rule-dsl-audit", "")),
  "--rule-dsl-delivery-gate-audit",
  "transparent_ai_rag_delivery_gate_audit_trail_v1"
);
const finalTeacherReceiptValidationInput = readJsonInput(
  argValue("--final-teacher-receipt-validation", argValue("--teacher-final-receipt-validation", "")),
  "--final-teacher-receipt-validation",
  "transparent_ai_original_goal_final_teacher_acceptance_receipt_validation_v1"
);

const matrix = blockerMatrixInput.value;
const coverageGate = lowTokenCoverageGateInput.value;
const realLocalReadinessPackage = realLocalReadinessPackageInput.value;
const teacherMethodContractReceiptValidation = teacherMethodContractReceiptValidationInput.value;
const teacherMethodReuseResultProofValidation = teacherMethodReuseResultProofValidationInput.value;
const unattendedAudit = unattendedAuditInput.value;
const sketchAudit = sketchAuditInput.value;
const spatialValidation = spatialReceiptValidationInput.value;
const executionAudit = executionConvergenceInput.value;
const integratedEvidenceGate = integratedEvidenceGateInput.value;
const ruleDslAudit = ruleDslDeliveryGateAuditInput.value;
const finalTeacherReceiptValidation = finalTeacherReceiptValidationInput.value;
const ruleDslAuditEvidenceChain = array(ruleDslAudit?.evidenceChain);
const ruleDslRetainedRollbackPoint = ruleDslAuditEvidenceChain.find((item) => item.step === "retained_rollback_point") || null;
const ruleDslRetainedRollbackPath = ruleDslRetainedRollbackPoint?.path ? resolve(ruleDslRetainedRollbackPoint.path) : "";
const ruleDslRetainedRollbackPathExists = Boolean(ruleDslRetainedRollbackPath && existsSync(ruleDslRetainedRollbackPath));
const spatialEvidence = spatialValidation?.validationRow?.spatialEvidence || {};
const spatialEvidenceHas2D =
  spatialEvidence.has2DPositionEvidence === true || spatialEvidence.has2DPosition === true || spatialEvidence.has2D === true;
const spatialEvidenceHasPerspective =
  spatialEvidence.hasPerspectiveEvidence === true ||
  spatialEvidence.hasPerspective === true ||
  spatialEvidence.hasPerspectiveRelation === true;
const spatialEvidenceHas3DDepth =
  spatialEvidence.has3DDepthEvidence === true || spatialEvidence.has3DDepth === true || spatialEvidence.hasDepth === true;
const integratedRequirements = array(integratedEvidenceGate?.requirements);
const integratedTeacherMethodRequirement =
  integratedRequirements.find((item) => item.id === "teacher_method_adaptation") || null;
const integratedReasoningRequirement =
  integratedRequirements.find((item) => item.id === "high_to_medium_reasoning_cost_control") || null;
const integratedVoiceRequirement =
  integratedRequirements.find((item) => item.id === "voice_text_numbered_execution_control") || null;
const integratedVoiceCandidateNumbers = array(integratedVoiceRequirement?.evidenceSummary?.candidateNumbers);
const integratedVoiceNextCalls = array(integratedVoiceRequirement?.evidenceSummary?.nextCalls);

const matrixRows = array(matrix?.rows);
const realLocalReadinessScopeEvidence = realLocalReadinessPackage?.scopeEvidence || {};
const realLocalReadinessCounts = realLocalReadinessPackage?.counts || {};
const nonCadSolidWorksCandidates = Number(
  realLocalReadinessCounts.nonCadSolidWorksCandidates ??
    realLocalReadinessScopeEvidence.nonCadSolidWorksCandidateRows ??
    0
);
const nonCadSolidWorksLedgerRows = Number(
  realLocalReadinessCounts.nonCadSolidWorksLedgerRows ??
    realLocalReadinessScopeEvidence.nonCadSolidWorksLedgerRows ??
    0
);
const cadOrSolidWorksCandidates = Number(
  realLocalReadinessCounts.cadOrSolidWorksCandidates ??
    realLocalReadinessScopeEvidence.cadOrSolidWorksCandidateRows ??
    0
);
const realLocalCandidateRows = Number(
  realLocalReadinessCounts.realLocalCandidates ??
    realLocalReadinessScopeEvidence.realLocalCandidateRows ??
    0
);
const logSourceDiscoveryRows = Number(realLocalReadinessCounts.logSourceDiscoveryRows ?? 0);
const logSourceDiscoveryMissingRows = Number(realLocalReadinessCounts.logSourceDiscoveryMissingRows ?? 0);
const allReadinessRowsHaveCurrentSourceRoute =
  realLocalReadinessPackage?.boundaries?.allRowsHaveCurrentSourceRoute === true ||
  realLocalReadinessScopeEvidence.allRowsHaveCurrentSourceRoute === true;
const realLocalReadinessScopeClaim = realLocalReadinessScopeEvidence.scopeClaim || "";
const matrixReady =
  Boolean(matrix) &&
  matrix.locks?.goalComplete === false &&
  matrix.locks?.nativeUniversalExecution === false &&
  matrixRows.length >= 6 &&
  matrixRows.some((item) => item.lane === "all_software_low_token_coverage_evidence") &&
  matrixRows.some((item) => item.lane === "transparent_sketch_spatial_intent_teacher_export") &&
  matrixRows.some((item) => item.lane === "unattended_operational_monitor_evidence") &&
  matrixRows.some((item) => item.lane === "universal_native_execution_control_channel");
const coverageReady =
  Boolean(coverageGate) &&
  coverageGate.status === "coverage_evidence_ready_for_final_teacher_review_not_completion" &&
  coverageGate.coverageEvidenceReadyForFinalTeacherReview === true &&
  coverageGate.logSourceDiscoveryReadyForCoverage === true &&
  coverageGate.allSoftwareCoverageComplete === false;
const realLocalNonCadReadinessReady =
  Boolean(realLocalReadinessPackage) &&
  realLocalReadinessPackage.status === "waiting_for_teacher_review_before_registration_or_learning_memory" &&
  realLocalReadinessScopeClaim === "real_local_bounded_all_software_not_cad_solidworks_only" &&
  realLocalCandidateRows > 0 &&
  nonCadSolidWorksCandidates > 0 &&
  nonCadSolidWorksLedgerRows > 0 &&
  logSourceDiscoveryRows >= realLocalCandidateRows &&
  logSourceDiscoveryMissingRows === 0 &&
  allReadinessRowsHaveCurrentSourceRoute &&
  realLocalReadinessScopeEvidence.boundedNotComplete === true &&
  realLocalReadinessPackage.boundaries?.broadAllInstalledSoftwareComplete === false &&
  realLocalReadinessPackage.locks?.reviewOnly === true &&
  realLocalReadinessPackage.locks?.nativeUniversalExecution === false;
const teacherMethodAdaptationReady =
  Boolean(teacherMethodContractReceiptValidation) &&
  teacherMethodContractReceiptValidation.status === "teacher_method_contract_confirmed_waiting_for_reuse_result_proof" &&
  teacherMethodContractReceiptValidation.readyForReuseResultProof === true &&
  teacherMethodContractReceiptValidation.counts?.confirmedMatchingRows ===
    teacherMethodContractReceiptValidation.counts?.contractRouteRows &&
  teacherMethodContractReceiptValidation.locks?.validationDoesNotExecuteTargetSoftware === true &&
  teacherMethodContractReceiptValidation.locks?.validationDoesNotWriteMemory === true &&
  teacherMethodContractReceiptValidation.locks?.goalComplete === false &&
  Boolean(teacherMethodReuseResultProofValidation) &&
  teacherMethodReuseResultProofValidation.status ===
    "teacher_method_reuse_result_confirmed_ready_for_medium_runtime_reuse_gate" &&
  teacherMethodReuseResultProofValidation.readyForMediumRuntimeReuseGate === true &&
  teacherMethodReuseResultProofValidation.repairRequired === false &&
  teacherMethodReuseResultProofValidation.proofSummary?.teacherObservedImprovement === true &&
  teacherMethodReuseResultProofValidation.proofSummary?.ambiguityReducedOrAccuracyImproved === true &&
  teacherMethodReuseResultProofValidation.locks?.validationDoesNotExecuteTargetSoftware === true &&
  teacherMethodReuseResultProofValidation.locks?.validationDoesNotWriteMemory === true &&
  teacherMethodReuseResultProofValidation.locks?.mediumRuntimeReuseEnabled === false &&
  teacherMethodReuseResultProofValidation.locks?.goalComplete === false;
const integratedTeacherMethodReady =
  Boolean(integratedEvidenceGate) &&
  integratedEvidenceGate.status === "current_goal_not_complete_waiting_for_teacher_evidence_and_real_software_run" &&
  integratedEvidenceGate.locks?.mediumRuntimeReuseEnabled === false &&
  integratedEvidenceGate.locks?.gateDoesNotExecuteTargetSoftware === true &&
  integratedEvidenceGate.goalComplete === false &&
  integratedTeacherMethodRequirement?.implementationEvidenceProven === true &&
  integratedTeacherMethodRequirement?.completionProven === false &&
  integratedTeacherMethodRequirement?.status === "partial_review_ready" &&
  Number(integratedTeacherMethodRequirement?.evidenceSummary?.supportedMethodLaneCount || 0) >= 9 &&
  integratedReasoningRequirement?.implementationEvidenceProven === true &&
  integratedReasoningRequirement?.completionProven === false &&
  integratedReasoningRequirement?.status === "policy_review_ready" &&
  integratedReasoningRequirement?.evidenceSummary?.mediumRuntimeReuseEnabled === false;
const unattendedReady =
  Boolean(unattendedAudit) &&
  unattendedAudit.status === "unattended_learning_ready_for_teacher_operational_review" &&
  unattendedAudit.unattendedAllAppMonitoringComplete === true &&
  unattendedAudit.locks?.nativeUniversalExecution === false;
const sketchReady =
  Boolean(sketchAudit) &&
  (sketchAudit.status === "passed" ||
    sketchAudit.status === "sketch_demonstration_implemented_waiting_for_teacher_real_overlay_review") &&
  sketchAudit.requirementSummary?.transparentDrawingMaskImplemented === true &&
  sketchAudit.requirementSummary?.teacher2DSketchUnderstood === true &&
  sketchAudit.requirementSummary?.teacherPerspectiveSketchUnderstood === true &&
  sketchAudit.requirementSummary?.teacher3DDepthSketchUnderstood === true &&
  sketchAudit.requirementSummary?.universalDetailLogicContractImplemented === true &&
  sketchAudit.requirementSummary?.unattendedNativeUniversalExecutionProven === false;
const spatialReady =
  Boolean(spatialValidation) &&
  spatialValidation.status === "validated_with_ready_spatial_target_confirmation" &&
  spatialValidation.validationDecision === "ready_for_reviewed_spatial_target_confirmation" &&
  spatialValidation.validationRow?.canPrepareSpatialConfirmation === true &&
  spatialValidation.validationRow?.detailLogicValidationReadyForAction === true &&
  spatialEvidenceHas2D &&
  spatialEvidenceHasPerspective &&
  spatialEvidenceHas3DDepth;
const executionReady =
  Boolean(executionAudit) &&
  executionAudit.status === "bounded_execution_capability_ready_for_teacher_completion_review" &&
  executionAudit.executionConvergedForTeacherReview === true &&
  executionAudit.allSoftwareExecutionComplete === false &&
  executionAudit.nativeUniversalExecution === false;
const integratedVoiceReady =
  Boolean(integratedEvidenceGate) &&
  integratedEvidenceGate.status === "current_goal_not_complete_waiting_for_teacher_evidence_and_real_software_run" &&
  integratedEvidenceGate.locks?.gateDoesNotExecuteTargetSoftware === true &&
  integratedEvidenceGate.locks?.gateDoesNotCaptureScreenshots === true &&
  integratedEvidenceGate.locks?.gateDoesNotRecordScreen === true &&
  integratedEvidenceGate.goalComplete === false &&
  integratedVoiceRequirement?.implementationEvidenceProven === true &&
  integratedVoiceRequirement?.completionProven === false &&
  integratedVoiceRequirement?.status === "implementation_review_ready_waiting_for_teacher_number" &&
  integratedVoiceCandidateNumbers.length > 0 &&
  integratedVoiceNextCalls.includes("confirm_engineering_command_target") &&
  integratedVoiceRequirement?.evidenceSummary?.softwareActionsExecuted === false &&
  integratedVoiceRequirement?.evidenceSummary?.targetSoftwareCommandsExecuted === false;
const ruleDslAuditReady =
  Boolean(ruleDslAudit) &&
  ruleDslAudit.status === "audit_trail_ready_for_teacher_review" &&
  Array.isArray(ruleDslAudit.evidenceChain) &&
  ruleDslAuditEvidenceChain.some((item) => item.step === "rag_disabled_validation_report_packet") &&
  ruleDslAuditEvidenceChain.some((item) => item.step === "validation_report") &&
  ruleDslAuditEvidenceChain.some((item) => item.step === "closed_delivery_gate") &&
  ruleDslRetainedRollbackPoint?.format === "transparent_ai_rollback_point_result_v1" &&
  ruleDslRetainedRollbackPoint?.status === "waiting_for_teacher_confirmation" &&
  ruleDslRetainedRollbackPathExists &&
  Array.isArray(ruleDslAudit.blockedTransitions) &&
  ruleDslAudit.blockedTransitions.includes("validation_report_delivery_allowed_to_packaging_unlock") &&
  ruleDslAudit.blockedTransitions.includes("validation_report_delivery_allowed_to_software_execution") &&
  ruleDslAudit.replay?.forbiddenInterpretations?.includes("rule_activation") &&
  ruleDslAudit.replay?.forbiddenInterpretations?.includes("memory_write") &&
  ruleDslAudit.replay?.forbiddenInterpretations?.includes("software_execution") &&
  ruleDslAudit.locks?.reviewOnly === true &&
  ruleDslAudit.locks?.ruleEnabled === false &&
  ruleDslAudit.locks?.memoryEnabled === false &&
  ruleDslAudit.locks?.softwareActionsExecuted === false &&
  ruleDslAudit.locks?.packagingUnlocked === false &&
  ruleDslAudit.locks?.deliveryGateOpen === false;
const teacherAccepted =
  Boolean(finalTeacherReceiptValidation) &&
  finalTeacherReceiptValidation.status === "validated_ready_for_final_completion_gate" &&
  finalTeacherReceiptValidation.validationDecision === "teacher_acceptance_ready_for_final_completion_gate" &&
  finalTeacherReceiptValidation.readyForFinalCompletionGate === true;

const gateLanes = [
  lane({
    id: "completion_blocker_matrix_present",
    requirement: "The full objective must be decomposed into explicit blocker lanes before any completion claim.",
    ready: matrixReady,
    evidence: matrix ? `rows=${matrixRows.length}; status=${matrix.status}` : "missing matrix",
    blocker:
      "Need a current transparent_ai_original_goal_completion_blocker_matrix_v1 with all major lanes and locked false-completion state.",
    sourcePath: blockerMatrixInput.path
  }),
  lane({
    id: "all_software_low_token_coverage_final_review",
    requirement: "Every in-scope software row must have low-token source/fallback/exclusion evidence and teacher coverage validation.",
    ready: coverageReady,
    evidence: coverageGate
      ? `status=${coverageGate.status}; logSourceDiscoveryReadyForCoverage=${coverageGate.logSourceDiscoveryReadyForCoverage}; allSoftwareCoverageComplete=${coverageGate.allSoftwareCoverageComplete}`
      : "missing low-token coverage gate",
    blocker:
      "Need low-token coverage completion gate status coverage_evidence_ready_for_final_teacher_review_not_completion with log-source discovery ready.",
    sourcePath: lowTokenCoverageGateInput.path
  }),
  lane({
    id: "real_local_non_cad_solidworks_scope_evidence",
    requirement:
      "The all-software low-token claim must include bounded real-local evidence outside CAD/SolidWorks, and every discovered local row must have a current low-token source route or reviewed fallback before any final completion claim.",
    ready: realLocalNonCadReadinessReady,
    evidence: realLocalReadinessPackage
      ? `status=${realLocalReadinessPackage.status}; scopeClaim=${realLocalReadinessScopeClaim}; realLocalCandidateRows=${realLocalCandidateRows}; logSourceDiscoveryRows=${logSourceDiscoveryRows}; logSourceDiscoveryMissingRows=${logSourceDiscoveryMissingRows}; allRowsHaveCurrentSourceRoute=${allReadinessRowsHaveCurrentSourceRoute}; nonCadSolidWorksCandidates=${nonCadSolidWorksCandidates}; nonCadSolidWorksLedgerRows=${nonCadSolidWorksLedgerRows}; cadOrSolidWorksCandidates=${cadOrSolidWorksCandidates}; boundedNotComplete=${realLocalReadinessScopeEvidence.boundedNotComplete}`
      : "missing real-local all-software low-token readiness package",
    blocker:
      "Need transparent_ai_real_local_all_software_low_token_readiness_package_v1 proving every bounded real-local inventory row is mapped to a low-token log/event/file/process route or reviewed fallback, includes non-CAD/SolidWorks candidates, has zero missing source rows, and still marks broad completion as bounded/not complete.",
    sourcePath: realLocalReadinessPackageInput.path
  }),
  lane({
    id: "teacher_method_adaptation_reuse_result_proof",
    requirement:
      "The system must prove it can adapt to the teacher's method, then reuse that reviewed method with before/after improvement evidence before any final completion claim.",
    ready: teacherMethodAdaptationReady && integratedTeacherMethodReady,
    evidence:
      teacherMethodContractReceiptValidation || teacherMethodReuseResultProofValidation || integratedTeacherMethodRequirement
        ? `contractStatus=${teacherMethodContractReceiptValidation?.status || "missing"}; readyForReuseResultProof=${teacherMethodContractReceiptValidation?.readyForReuseResultProof}; confirmedRows=${teacherMethodContractReceiptValidation?.counts?.confirmedMatchingRows ?? 0}/${teacherMethodContractReceiptValidation?.counts?.contractRouteRows ?? 0}; reuseStatus=${teacherMethodReuseResultProofValidation?.status || "missing"}; readyForMediumRuntimeReuseGate=${teacherMethodReuseResultProofValidation?.readyForMediumRuntimeReuseGate}; teacherObservedImprovement=${teacherMethodReuseResultProofValidation?.proofSummary?.teacherObservedImprovement}; ambiguityReducedOrAccuracyImproved=${teacherMethodReuseResultProofValidation?.proofSummary?.ambiguityReducedOrAccuracyImproved}; repairRequired=${teacherMethodReuseResultProofValidation?.repairRequired}; integratedMethodStatus=${integratedTeacherMethodRequirement?.status || "missing"}; integratedMethodImpl=${integratedTeacherMethodRequirement?.implementationEvidenceProven}; supportedMethodLaneCount=${integratedTeacherMethodRequirement?.evidenceSummary?.supportedMethodLaneCount ?? 0}; integratedReasoningStatus=${integratedReasoningRequirement?.status || "missing"}; integratedMediumRuntimeReuseEnabled=${integratedReasoningRequirement?.evidenceSummary?.mediumRuntimeReuseEnabled}`
        : "missing teacher-method contract, reuse-result proof validations, and integrated teacher-method evidence",
    blocker:
      "Need current integrated teacher-method evidence plus teacher-method contract receipt validation and teacher-reviewed before/after reuse-result proof showing the method improved the next run, with medium-runtime reuse still gated and failures routed back to high-reasoning repair.",
    sourcePath:
      teacherMethodReuseResultProofValidationInput.path ||
      teacherMethodContractReceiptValidationInput.path ||
      integratedEvidenceGateInput.path
  }),
  lane({
    id: "unattended_all_software_operational_evidence",
    requirement: "Recurring low-token monitoring must have registered matching schedule evidence, reviewed run output, and teacher review replay.",
    ready: unattendedReady,
    evidence: unattendedAudit
      ? `status=${unattendedAudit.status}; unattendedAllAppMonitoringComplete=${unattendedAudit.unattendedAllAppMonitoringComplete}; gaps=${array(unattendedAudit.remainingGaps).length}`
      : "missing unattended audit",
    blocker:
      "Need unattended audit ready for teacher operational review, including matching registration and reviewed run-output evidence.",
    sourcePath: unattendedAuditInput.path
  }),
  lane({
    id: "transparent_2d_perspective_3d_sketch_implementation",
    requirement: "Transparent drawing mask, existing drawing-tool reuse, 2D position, perspective, 3D depth, and detail-logic checks must pass.",
    ready: sketchReady,
    evidence: sketchAudit
      ? `status=${sketchAudit.status}; 2d=${sketchAudit.requirementSummary?.teacher2DSketchUnderstood}; perspective=${sketchAudit.requirementSummary?.teacherPerspectiveSketchUnderstood}; depth=${sketchAudit.requirementSummary?.teacher3DDepthSketchUnderstood}`
      : "missing sketch implementation audit",
    blocker:
      "Need passed sketch demonstration implementation audit proving transparent mask, 2D/perspective/3D, target confirmation, and detail logic.",
    sourcePath: sketchAuditInput.path
  }),
  lane({
    id: "teacher_validated_spatial_intent_and_detail_logic",
    requirement: "A real teacher-exported overlay/spatial packet must be validated with universal detail logic before target execution.",
    ready: spatialReady,
    evidence: spatialValidation
      ? `status=${spatialValidation.status}; decision=${spatialValidation.validationDecision}; canPrepare=${spatialValidation.validationRow?.canPrepareSpatialConfirmation}; has2D=${spatialEvidenceHas2D}; hasPerspective=${spatialEvidenceHasPerspective}; has3DDepth=${spatialEvidenceHas3DDepth}`
      : "missing spatial receipt validation",
    blocker:
      "Need validated spatial intent evidence receipt tied to teacher-exported overlay, detail-logic contract, passed receipt validation, reviewed 2D position, perspective relation, and 3D depth.",
    sourcePath: spatialReceiptValidationInput.path
  }),
  lane({
    id: "voice_text_numbered_execution_capability_convergence",
    requirement:
      "Voice/text commands, numbered target confirmation, route profiling, dry-run receipts, and execution capability lanes must converge for teacher review.",
    ready: executionReady && integratedVoiceReady,
    evidence:
      executionAudit || integratedVoiceRequirement
        ? `executionStatus=${executionAudit?.status || "missing"}; converged=${executionAudit?.executionConvergedForTeacherReview}; nativeUniversalExecution=${executionAudit?.nativeUniversalExecution}; integratedVoiceStatus=${integratedVoiceRequirement?.status || "missing"}; integratedVoiceImpl=${integratedVoiceRequirement?.implementationEvidenceProven}; integratedVoiceCompletion=${integratedVoiceRequirement?.completionProven}; candidateNumbers=${integratedVoiceCandidateNumbers.join(",")}; nextCalls=${integratedVoiceNextCalls.join(",")}; integratedGateExecutesTargetSoftware=${integratedEvidenceGate?.locks?.gateDoesNotExecuteTargetSoftware === false}`
        : "missing execution convergence audit and integrated voice/text numbered evidence",
    blocker:
      "Need bounded execution capability convergence audit plus current integrated evidence gate showing voice/text numbered target confirmation is implemented, review-only, and blocked until teacher confirms one number.",
    sourcePath: integratedEvidenceGateInput.path || executionConvergenceInput.path
  }),
  lane({
    id: "rule_dsl_validation_report_delivery_gate_audit",
    requirement:
      "Teacher-taught reusable logic must pass through Rule DSL, Validation Report, a closed Delivery Gate, and an audit trail before any completion claim.",
    ready: ruleDslAuditReady,
    evidence: ruleDslAudit
      ? `status=${ruleDslAudit.status}; evidenceSteps=${array(ruleDslAudit.evidenceChain)
          .map((item) => item.step)
          .join(",")}; deliveryGateOpen=${ruleDslAudit.locks?.deliveryGateOpen}; rollbackPathExists=${ruleDslRetainedRollbackPathExists}`
      : "missing Rule DSL delivery-gate audit trail",
    blocker:
      "Need transparent_ai_rag_delivery_gate_audit_trail_v1 proving disabled Rule Card evidence reached Validation Report and a closed delivery gate with blocked activation, memory, execution, packaging transitions, and an existing retained rollback point path.",
    sourcePath: ruleDslDeliveryGateAuditInput.path
  }),
  lane({
    id: "explicit_final_teacher_acceptance",
    requirement: "The teacher must explicitly accept the full original scope and remaining honest boundaries through a validated final acceptance receipt.",
    ready: teacherAccepted,
    evidence: finalTeacherReceiptValidation
      ? `status=${finalTeacherReceiptValidation.status}; decision=${finalTeacherReceiptValidation.validationDecision}; ready=${finalTeacherReceiptValidation.readyForFinalCompletionGate}`
      : "missing final teacher acceptance receipt validation",
    blocker:
      "Need transparent_ai_original_goal_final_teacher_acceptance_receipt_validation_v1 with readyForFinalCompletionGate=true.",
    sourcePath: finalTeacherReceiptValidationInput.path
  })
];

const blockers = gateLanes.filter((item) => !item.ready).map((item) => item.id);
const readyForCompletionClaim = blockers.length === 0;
const status = readyForCompletionClaim
  ? "ready_for_goal_completion_claim_after_teacher_acceptance"
  : "blocked_before_original_goal_completion_claim";
const completionDecision = readyForCompletionClaim
  ? "full_original_goal_evidence_ready_for_completion_claim"
  : "not_complete_full_original_goal_missing_required_evidence";
const lockState = locks();
const gatePath = join(gateDir, "original-goal-final-completion-gate.json");
const htmlPath = join(gateDir, "original-goal-final-completion-gate.html");
const readmePath = join(gateDir, "ORIGINAL_GOAL_FINAL_COMPLETION_GATE_START_HERE.md");
const gate = {
  ok: true,
  format: "transparent_ai_original_goal_final_completion_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  completionDecision,
  readyForCompletionClaim,
  counts: {
    totalLanes: gateLanes.length,
    readyLanes: gateLanes.filter((item) => item.ready).length,
    blockedLanes: blockers.length
  },
  blockers,
  lanes: gateLanes,
  sourceEvidence: {
    completionBlockerMatrix: blockerMatrixInput.path,
    lowTokenCoverageGate: lowTokenCoverageGateInput.path,
    realLocalReadinessPackage: realLocalReadinessPackageInput.path,
    teacherMethodContractReceiptValidation: teacherMethodContractReceiptValidationInput.path,
    teacherMethodReuseResultProofValidation: teacherMethodReuseResultProofValidationInput.path,
    unattendedAudit: unattendedAuditInput.path,
    sketchImplementationAudit: sketchAuditInput.path,
    spatialIntentReceiptValidation: spatialReceiptValidationInput.path,
    executionConvergenceAudit: executionConvergenceInput.path,
    currentGoalIntegratedEvidenceGate: integratedEvidenceGateInput.path,
    ruleDslDeliveryGateAudit: ruleDslDeliveryGateAuditInput.path,
    finalTeacherReceiptValidation: finalTeacherReceiptValidationInput.path
  },
  blockedClaims: readyForCompletionClaim
    ? []
    : [
        "claim_original_goal_complete_without_all_lanes",
        "claim_all_software_coverage_without_log_source_closure",
        "claim_all_software_scope_from_cad_solidworks_only",
        "claim_all_real_local_inventory_rows_routed_without_zero_missing_source_rows",
        "claim_teacher_method_adaptation_without_reuse_result_proof",
        "claim_unattended_learning_without_registered_matching_run_output",
        "claim_spatial_understanding_without_teacher_exported_overlay_and_detail_logic",
        "claim_voice_control_execution_without_numbered_target_and_convergence",
        "claim_reusable_learning_without_rule_dsl_validation_report_delivery_gate_audit",
        "claim_final_acceptance_without_teacher_receipt"
      ],
  paths: {
    gate: gatePath,
    html: htmlPath,
    readme: readmePath
  },
  locks: lockState
};

writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`, "utf8");
writeHtml(htmlPath, gate);
writeReadme(readmePath, gate);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_final_completion_gate_result_v1",
      gateId,
      status,
      completionDecision,
      readyForCompletionClaim,
      gatePath,
      htmlPath,
      readmePath,
      counts: gate.counts,
      blockers,
      locks: lockState
    },
    null,
    2
  )
);
