#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "current-goal-start-here-launchpad", String(Date.now()));
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

const physicalSourceRoot = join(smokeRoot, "UnityPhysicalWorldUnderstanding");
mkdirSync(physicalSourceRoot, { recursive: true });
writeFileSync(
  join(smokeRoot, "deep-research-report.md"),
  [
    "# Physical report",
    "Real readiness requires calibrated real evidence, sim-to-real trace parity, RGB-D, force, tactile, and unseen geometry."
  ].join("\n"),
  "utf8"
);
writeFileSync(
  join(physicalSourceRoot, "README.md"),
  [
    "# Physical World Understanding in Unity",
    "RGB and raycast-depth proxy capture from Camera.main are exported.",
    "Camera calibration includes intrinsics, extrinsics, and calibrated_rgbd_observation.",
    "RGB-D point-cloud observation intake validates point cloud, panel poses, fold angles, and contact observations.",
    "ObservationStateEstimator compares fold angles and reports under-fold and over-fold errors.",
    "Sim-to-real trace parity compares pose, fold angle, and force error.",
    "Physical unseen geometry benchmark evaluates held-out same-topology variants.",
    "ClosedLoopCorrectionPlanner turns observed under-fold states into corrective delta-angle actions."
  ].join("\n"),
  "utf8"
);
const physicalGrounding = runNodeScript("create-physical-world-spatial-grounding-pack.mjs", [
  "--source-root",
  physicalSourceRoot,
  "--output-dir",
  join(smokeRoot, "physical-world-spatial-grounding")
]);
const initialLaunchpadResult = runNodeScript("create-current-goal-start-here-launchpad.mjs", [
  "--physical-world-spatial-grounding-pack",
  physicalGrounding.packPath,
  "--output-dir",
  join(smokeRoot, "initial-start-here")
]);
const nextTeacherConfirmationCockpit = runNodeScript("create-current-goal-next-teacher-confirmation-cockpit.mjs", [
  "--launchpad",
  initialLaunchpadResult.launchpadPath,
  "--output-dir",
  join(smokeRoot, "next-teacher-confirmation-cockpit")
]);
const shortestTeacherEvidencePack = runNodeScript("create-current-goal-shortest-teacher-evidence-pack.mjs", [
  "--launchpad",
  initialLaunchpadResult.launchpadPath,
  "--output-dir",
  join(smokeRoot, "shortest-teacher-evidence")
]);
const proofGapEvidencePath = join(smokeRoot, "proof-gap-evidence.html");
writeFileSync(proofGapEvidencePath, "proof gap evidence\n", "utf8");
const proofGapClosurePackPath = join(smokeRoot, "proof-gap-closure-pack.json");
writeFileSync(
  proofGapClosurePackPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_original_goal_proof_gap_closure_pack_v1",
      sourceEvidence: {},
      closureRoutes: [
        {
          requirementId: "all_software_low_token_learning",
          missingProof: "teacher must confirm low-token monitor witness",
          routeId: "post_registration_output_witness_route",
          title: "Review bounded low-token witness",
          teacherAction: "Review one bounded output witness before any monitor claim.",
          evidence: [{ key: "proofGapEvidence", label: "Proof gap evidence", value: proofGapEvidencePath, exists: true }],
          commandTemplate: "node validate-proof-gap.js --receipt \"<teacher-filled.json>\"",
          requiredTeacherInputs: ["teacher-filled proof gap receipt"],
          blockedUntilTeacher: true,
          risk: { matchedHighRiskMarkers: ["--teacher-confirmation"], safeToRunAutomatically: false }
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);
const proofGapTeacherQueue = runNodeScript("create-original-goal-proof-gap-teacher-queue.mjs", [
  "--closure-pack",
  proofGapClosurePackPath,
  "--output-dir",
  join(smokeRoot, "proof-gap-teacher-queue")
]);
const proofGapEvidencePrefill = runNodeScript("create-original-goal-proof-gap-evidence-prefill.mjs", [
  "--queue",
  proofGapTeacherQueue.queuePath,
  "--output-dir",
  join(smokeRoot, "proof-gap-evidence-prefill")
]);
const proofGapTeacherQueueReceiptBuilder = runNodeScript("create-original-goal-proof-gap-teacher-queue-receipt-builder.mjs", [
  "--queue",
  proofGapTeacherQueue.queuePath,
  "--prefill",
  proofGapEvidencePrefill.prefillPath,
  "--output-dir",
  join(smokeRoot, "proof-gap-teacher-queue-receipt-builder")
]);
const proofGapNextFocusedReceiptBuilder = runNodeScript(
  "create-original-goal-next-proof-gap-focused-receipt-builder.mjs",
  [
    "--queue",
    proofGapTeacherQueue.queuePath,
    "--prefill",
    proofGapEvidencePrefill.prefillPath,
    "--output-dir",
    join(smokeRoot, "next-proof-gap-focused-receipt-builder")
  ]
);
const proofGapTeacherQueueReceiptValidation = runNodeScript("validate-original-goal-proof-gap-teacher-queue-receipt.mjs", [
  "--queue",
  proofGapTeacherQueue.queuePath,
  "--receipt",
  proofGapTeacherQueueReceiptBuilder.receiptTemplatePath,
  "--output-dir",
  join(smokeRoot, "proof-gap-teacher-queue-receipt-validation")
]);
const proofGapReceiptIntakeRouter = runNodeScript("create-original-goal-proof-gap-receipt-intake-router.mjs", [
  "--queue",
  proofGapTeacherQueue.queuePath,
  "--output-dir",
  join(smokeRoot, "proof-gap-receipt-intake-router")
]);
const allSoftwareObserverBootstrap = runNodeScript("create-all-software-observer-bootstrap.mjs", [
  "--goal",
  "Bootstrap low-token learning from all software on this computer without continuous recording.",
  "--no-initialize-watch",
  "--output-dir",
  join(smokeRoot, "all-software-observer-bootstrap")
]);
const allSoftwareInventoryFixturePath = join(smokeRoot, "all-software-inventory-fixture.json");
writeFileSync(
  allSoftwareInventoryFixturePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_software_observer_inventory_v1",
      source: "current_goal_start_here_smoke_fixture",
      discoveryScope: {
        logContentsRead: false,
        fullContinuousRecording: false,
        nativeUniversalExecution: false
      },
      softwareCandidates: [
        {
          software: "VectorEditor",
          processName: "VectorEditor",
          candidateLogFiles: [{ path: join(smokeRoot, "vector.log"), bytes: 12 }],
          candidateLogRoots: [smokeRoot],
          windowsEventLogs: ["Application"],
          reason: "non_cad_vector_editor_fixture"
        },
        {
          software: "PrivateMessenger",
          processName: "PrivateMessenger",
          candidateLogFiles: [],
          candidateLogRoots: [],
          windowsEventLogs: ["Application"],
          reason: "private_app_fixture"
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);
const allSoftwareInventoryReviewBuilder = runNodeScript("create-all-software-observer-inventory-review-builder.mjs", [
  "--inventory",
  allSoftwareInventoryFixturePath,
  "--bootstrap",
  allSoftwareObserverBootstrap.bootstrapPath,
  "--output-dir",
  join(smokeRoot, "all-software-inventory-review-builder")
]);
const allSoftwareInventoryBatchReviewBuilder = runNodeScript(
  "create-all-software-observer-inventory-batch-review-builder.mjs",
  [
    "--inventory",
    allSoftwareInventoryFixturePath,
    "--batch-size",
    "2",
    "--output-dir",
    join(smokeRoot, "all-software-inventory-batch-review-builder")
  ]
);
const allSoftwareInventoryReviewReceiptPath = join(smokeRoot, "teacher-all-software-inventory-review-receipt.json");
writeFileSync(
  allSoftwareInventoryReviewReceiptPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_observer_inventory_review_receipt_v1",
      builderId: "start-here-smoke-builder",
      status: "teacher_completed_inventory_review",
      teacherConfirmationText: "teacher confirmed private exclusions and read-only observation only",
      teacherConfirmedPrivateAppsExcluded: true,
      teacherConfirmedReadOnlyObservationOnly: true,
      rows: [
        {
          rowNumber: 1,
          rowId: "vectoreditor",
          software: "VectorEditor",
          decision: "priority_observe",
          teachingStyle: "transparent_overlay_annotations",
          teacherLogSourceHint: "vector.log metadata first",
          teacherNote: "approved non-CAD target",
          approvedForReviewedObservation: true
        },
        {
          rowNumber: 2,
          rowId: "privatemessenger",
          software: "PrivateMessenger",
          decision: "exclude_private_or_out_of_scope",
          teachingStyle: "ask_teacher_when_ambiguous",
          teacherLogSourceHint: "private app",
          teacherNote: "",
          approvedForReviewedObservation: false
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);
const allSoftwareReviewedQueueBridge = runNodeScript("create-all-software-observer-reviewed-queue-from-receipt.mjs", [
  "--inventory",
  allSoftwareInventoryFixturePath,
  "--receipt",
  allSoftwareInventoryReviewReceiptPath,
  "--output-dir",
  join(smokeRoot, "all-software-reviewed-queue-bridge")
]);
const teachExecuteReviewedObservation = runNodeScript("start-teach-execute-reviewed-observation.mjs", [
  "--goal",
  "Run teacher-confirmed read-only all-software observation after excluding private software.",
  "--software",
  "all local software",
  "--output-dir",
  join(smokeRoot, "teach-execute-reviewed-observation")
]);
const allSoftwareCoverageEnrollmentFollowUpPlanPath = newestDirectoryWithFile(
  join(repoRoot, "artifacts", "current-goal-all-software-coverage-enrollment-follow-up-plans"),
  "all-software-coverage-enrollment-follow-up-plan.json"
);
const allSoftwareCoverageEnrollmentFollowUpReceiptBuilderPath = newestDirectoryWithFile(
  join(repoRoot, "artifacts", "current-goal-all-software-coverage-enrollment-follow-up-receipt-builders"),
  "all-software-coverage-enrollment-follow-up-receipt-builder.json"
);
const allSoftwareCoverageEnrollmentFollowUpReceiptBuilder = readJson(
  allSoftwareCoverageEnrollmentFollowUpReceiptBuilderPath
);
const allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder = runNodeScript(
  "create-all-software-coverage-enrollment-follow-up-receipt-builder.mjs",
  [
    "--plan",
    allSoftwareCoverageEnrollmentFollowUpPlanPath,
    "--max-rows",
    "12",
    "--output-dir",
    join(smokeRoot, "coverage-enrollment-follow-up-small-batch-receipt-builder")
  ]
);
const allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation = runNodeScript(
  "validate-all-software-coverage-enrollment-follow-up-receipt.mjs",
  [
    "--plan",
    allSoftwareCoverageEnrollmentFollowUpPlanPath,
    "--receipt",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder.receiptTemplatePath,
    "--output-dir",
    join(smokeRoot, "coverage-enrollment-follow-up-small-batch-receipt-validation")
  ]
);
const allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue = runNodeScript(
  "create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs",
  [
    "--validation",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation.validationPath,
    "--output-dir",
    join(smokeRoot, "coverage-enrollment-follow-up-small-batch-handoff-queue")
  ]
);
const allSoftwareCoverageEnrollmentFollowUpReceiptValidation = runNodeScript(
  "validate-all-software-coverage-enrollment-follow-up-receipt.mjs",
  [
    "--plan",
    allSoftwareCoverageEnrollmentFollowUpPlanPath,
    "--receipt",
    allSoftwareCoverageEnrollmentFollowUpReceiptBuilder.paths.receiptTemplate,
    "--output-dir",
    join(smokeRoot, "coverage-enrollment-follow-up-receipt-validation")
  ]
);
const allSoftwareCoverageEnrollmentFollowUpHandoffQueue = runNodeScript(
  "create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs",
  [
    "--validation",
    allSoftwareCoverageEnrollmentFollowUpReceiptValidation.validationPath,
    "--output-dir",
    join(smokeRoot, "coverage-enrollment-follow-up-handoff-queue")
  ]
);
const allSoftwareCoverageEnrollmentFollowUpBatchIndex = runNodeScript(
  "create-all-software-coverage-enrollment-follow-up-batch-index.mjs",
  [
    "--plan",
    allSoftwareCoverageEnrollmentFollowUpPlanPath,
    "--batch-size",
    "12",
    "--known-generated-rows",
    "12",
    "--current-offset",
    "0",
    "--latest-builder",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder.builderPath,
    "--latest-validation",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation.validationPath,
    "--latest-handoff-queue",
    allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue.queuePath,
    "--output-dir",
    join(smokeRoot, "coverage-enrollment-follow-up-batch-index")
  ]
);
const result = runNodeScript("create-current-goal-start-here-launchpad.mjs", [
  "--physical-world-spatial-grounding-pack",
  physicalGrounding.packPath,
  "--shortest-teacher-evidence-pack",
  shortestTeacherEvidencePack.packPath,
  "--proof-gap-teacher-queue",
  proofGapTeacherQueue.queuePath,
  "--proof-gap-evidence-prefill",
  proofGapEvidencePrefill.prefillPath,
  "--proof-gap-teacher-queue-receipt-builder",
  proofGapTeacherQueueReceiptBuilder.builderPath,
  "--proof-gap-next-focused-receipt-builder",
  proofGapNextFocusedReceiptBuilder.builderPath,
  "--proof-gap-teacher-queue-receipt-validation",
  proofGapTeacherQueueReceiptValidation.validationPath,
  "--proof-gap-receipt-intake-router",
  proofGapReceiptIntakeRouter.routerPath,
  "--all-software-observer-bootstrap",
  allSoftwareObserverBootstrap.bootstrapPath,
  "--all-software-observer-inventory-review-builder",
  allSoftwareInventoryReviewBuilder.builderPath,
  "--all-software-observer-inventory-batch-review-builder",
  allSoftwareInventoryBatchReviewBuilder.builderPath,
  "--all-software-observer-reviewed-queue-bridge",
  allSoftwareReviewedQueueBridge.bridgePath,
  "--teach-execute-reviewed-observation",
  teachExecuteReviewedObservation.observationPath,
  "--all-software-coverage-enrollment-follow-up-small-batch-receipt-builder",
  allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder.builderPath,
  "--all-software-coverage-enrollment-follow-up-batch-index",
  allSoftwareCoverageEnrollmentFollowUpBatchIndex.jsonPath,
  "--all-software-coverage-enrollment-follow-up-small-batch-receipt-validation",
  allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation.validationPath,
  "--all-software-coverage-enrollment-follow-up-small-batch-handoff-queue",
  allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue.queuePath,
  "--all-software-coverage-enrollment-follow-up-receipt-validation",
  allSoftwareCoverageEnrollmentFollowUpReceiptValidation.validationPath,
  "--all-software-coverage-enrollment-follow-up-handoff-queue",
  allSoftwareCoverageEnrollmentFollowUpHandoffQueue.queuePath,
  "--next-teacher-confirmation-cockpit",
  nextTeacherConfirmationCockpit.cockpitPath,
  "--output-dir",
  join(smokeRoot, "final-start-here")
]);
const launchpad = readJson(result.launchpadPath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");
const linkIds = new Set(launchpad.entryLinks.map((item) => item.id));
const actionIds = new Set(launchpad.safeNextActions.map((item) => item.id));
const buildProofGapValidationHandoffAction = launchpad.safeNextActions.find(
  (item) => item.id === "build_proof_gap_validation_handoff_builder"
);
const latestLowTokenHandoff = newestDirectoryWithFile(
  join(repoRoot, "artifacts", "current-goal-all-software-low-token-learning-handoffs"),
  "current-goal-all-software-low-token-learning-handoff.json"
);
const latestSpatialHandoff = newestDirectoryWithFile(
  join(repoRoot, "artifacts", "current-goal-teacher-spatial-drawing-handoffs"),
  "current-goal-teacher-spatial-drawing-handoff.json"
);
const latestMethodHandoff = newestDirectoryWithFile(
  join(repoRoot, "artifacts", "current-goal-teacher-method-adaptation-handoffs"),
  "current-goal-teacher-method-adaptation-handoff.json"
);

const checks = [
  {
    name: "Launchpad writes stable JSON HTML and README files",
    pass:
      launchpad.format === "transparent_ai_current_goal_start_here_launchpad_v1" &&
      existsSync(launchpad.paths.launchpad) &&
      existsSync(launchpad.paths.html) &&
      existsSync(launchpad.paths.readme) &&
      launchpad.paths.launchpad === result.launchpadPath,
    evidence: launchpad.paths
  },
  {
    name: "Launchpad links latest teacher trial, receipt, integrated gate, low-token, overlay, and method entries",
    pass:
      linkIds.has("final_teacher_acceptance_review_pack_html") &&
      linkIds.has("proof_gap_teacher_queue_html") &&
      linkIds.has("proof_gap_teacher_queue_receipt_template") &&
      linkIds.has("proof_gap_teacher_queue_receipt_builder_html") &&
      linkIds.has("next_proof_gap_focused_receipt_builder_html") &&
      linkIds.has("proof_gap_evidence_prefill_html") &&
      linkIds.has("proof_gap_candidate_receipt_draft") &&
      linkIds.has("proof_gap_receipt_intake_router_html") &&
      linkIds.has("all_software_observer_bootstrap_readme") &&
      linkIds.has("all_software_observer_teacher_template") &&
      linkIds.has("all_software_observer_bootstrap_receipt") &&
      linkIds.has("all_software_observer_inventory_probe_output") &&
      linkIds.has("all_software_log_source_discovery_ledger") &&
      linkIds.has("all_software_coverage_enrollment_ledger") &&
      linkIds.has("all_software_coverage_enrollment_follow_up_plan") &&
      linkIds.has("all_software_coverage_enrollment_follow_up_receipt_builder_html") &&
      linkIds.has("all_software_coverage_enrollment_follow_up_receipt_template") &&
      linkIds.has("all_software_coverage_enrollment_follow_up_batch_index_html") &&
      linkIds.has("all_software_coverage_enrollment_follow_up_batch_index_readme") &&
      linkIds.has("all_software_coverage_enrollment_follow_up_small_batch_receipt_builder_html") &&
      linkIds.has("all_software_coverage_enrollment_follow_up_small_batch_receipt_template") &&
      linkIds.has("all_software_coverage_enrollment_follow_up_receipt_validation_readme") &&
      linkIds.has("all_software_coverage_enrollment_follow_up_handoff_queue_html") &&
      linkIds.has("all_software_coverage_enrollment_follow_up_small_batch_receipt_validation_readme") &&
      linkIds.has("all_software_coverage_enrollment_follow_up_small_batch_handoff_queue_html") &&
      linkIds.has("all_software_observer_inventory_review_builder_html") &&
      linkIds.has("next_teacher_confirmation_cockpit_html") &&
      linkIds.has("all_software_observer_inventory_batch_review_builder_html") &&
      linkIds.has("all_software_observer_inventory_review_receipt_template") &&
      linkIds.has("all_software_observer_reviewed_queue_bridge_readme") &&
      linkIds.has("all_software_observer_reviewed_queue_bridge_json") &&
      linkIds.has("all_software_observer_reviewed_queue") &&
      linkIds.has("teach_execute_reviewed_observation_readme") &&
      linkIds.has("teach_execute_reviewed_observation_receipt") &&
      linkIds.has("teach_execute_reviewed_inventory") &&
      linkIds.has("teach_execute_reviewed_observer_queue") &&
      linkIds.has("shortest_teacher_evidence_pack_html") &&
      linkIds.has("shortest_teacher_evidence_pack_readme") &&
      linkIds.has("shortest_teacher_evidence_receipt_builder_html") &&
      linkIds.has("shortest_teacher_evidence_receipt_validation") &&
      linkIds.has("final_teacher_acceptance_review_pack_readme") &&
      linkIds.has("final_review_index_html") &&
      linkIds.has("final_convergence_readiness_gate_html") &&
      linkIds.has("teacher_trial_workbench_html") &&
      linkIds.has("teacher_trial_preflight_html") &&
      linkIds.has("teacher_trial_intake_router_html") &&
      linkIds.has("real_local_trial_package_html") &&
      linkIds.has("teacher_trial_receipt_builder_html") &&
      linkIds.has("integrated_evidence_gate_html") &&
      linkIds.has("low_token_route_receipt_builder_html") &&
      linkIds.has("transparent_overlay_browser_html") &&
      linkIds.has("transparent_overlay_powershell") &&
      linkIds.has("physical_world_spatial_grounding_html") &&
      linkIds.has("physical_world_spatial_grounding_start_here") &&
      linkIds.has("teacher_method_profile_readme") &&
      launchpad.entryLinks
        .filter((item) =>
          [
            "teacher_trial_workbench_html",
            "next_teacher_confirmation_cockpit_html",
            "proof_gap_teacher_queue_html",
            "proof_gap_teacher_queue_receipt_template",
            "proof_gap_teacher_queue_receipt_builder_html",
            "next_proof_gap_focused_receipt_builder_html",
            "proof_gap_evidence_prefill_html",
            "proof_gap_candidate_receipt_draft",
            "proof_gap_receipt_intake_router_html",
            "all_software_observer_bootstrap_readme",
            "all_software_observer_teacher_template",
            "all_software_observer_bootstrap_receipt",
            "all_software_log_source_discovery_ledger",
            "all_software_coverage_enrollment_ledger",
            "all_software_coverage_enrollment_follow_up_plan",
            "all_software_observer_inventory_batch_review_builder_html",
            "all_software_observer_reviewed_queue_bridge_readme",
            "all_software_observer_reviewed_queue_bridge_json",
            "all_software_observer_reviewed_queue",
            "shortest_teacher_evidence_pack_html",
            "shortest_teacher_evidence_pack_readme",
            "shortest_teacher_evidence_receipt_builder_html",
            "final_teacher_acceptance_review_pack_html",
            "final_teacher_acceptance_review_pack_readme",
            "final_review_index_html",
            "final_convergence_readiness_gate_html",
            "teacher_trial_preflight_html",
            "teacher_trial_intake_router_html",
            "real_local_trial_package_html",
            "next_teacher_confirmation_cockpit_receipt_template",
            "teacher_trial_receipt_builder_html",
            "integrated_evidence_gate_html",
            "low_token_route_receipt_builder_html",
            "transparent_overlay_browser_html",
            "physical_world_spatial_grounding_html",
            "physical_world_spatial_grounding_start_here",
            "teacher_method_profile_readme"
          ].includes(item.id)
        )
        .every((item) => item.exists === true),
    evidence: launchpad.entryLinks
  },
  {
    name: "Launchpad exposes one current-goal next teacher confirmation cockpit",
    pass:
      launchpad.statusSummary.nextTeacherConfirmationCockpitStatus ===
        "waiting_for_teacher_confirmation_across_current_goal_next_actions" &&
      launchpad.statusSummary.nextTeacherConfirmationCockpitHtmlReady === true &&
      launchpad.statusSummary.nextTeacherConfirmationCockpitCardCount === 5 &&
      launchpad.statusSummary.nextTeacherConfirmationCockpitReceiptTemplateReady === true &&
      launchpad.statusSummary.nextTeacherConfirmationCockpitReceiptValidationStatus ===
        "waiting_for_teacher_review" &&
      launchpad.statusSummary.nextTeacherConfirmationCockpitReceiptValidationReadyRows === 0 &&
      launchpad.statusSummary.nextTeacherConfirmationCockpitReceiptValidationNextSafeCommands === 0 &&
      launchpad.paths.nextTeacherConfirmationCockpit === nextTeacherConfirmationCockpit.cockpitPath &&
      launchpad.paths.nextTeacherConfirmationCockpitHtml.endsWith(
        "current-goal-next-teacher-confirmation-cockpit.html"
      ) &&
      launchpad.paths.nextTeacherConfirmationCockpitReceiptTemplate.endsWith(
        "current-goal-next-teacher-confirmation-cockpit-receipt-template.json"
      ) &&
      launchpad.paths.nextTeacherConfirmationCockpitReceiptValidation.endsWith(
        "current-goal-next-teacher-confirmation-cockpit-receipt-validation.json"
      ) &&
      launchpad.entryLinks.some(
        (item) =>
          item.id === "next_teacher_confirmation_cockpit_html" &&
          item.exists === true &&
          item.path === launchpad.paths.nextTeacherConfirmationCockpitHtml
      ) &&
      launchpad.entryLinks.some(
        (item) =>
          item.id === "next_teacher_confirmation_cockpit_receipt_template" &&
          item.exists === true &&
          item.path === launchpad.paths.nextTeacherConfirmationCockpitReceiptTemplate
      ) &&
      actionIds.has("build_next_teacher_confirmation_cockpit") &&
      actionIds.has("open_next_teacher_confirmation_cockpit") &&
      actionIds.has("validate_next_teacher_confirmation_cockpit_receipt") &&
      launchpad.safeNextActions.some(
        (item) =>
          item.id === "validate_next_teacher_confirmation_cockpit_receipt" &&
          item.commandOrPath.includes("validate-current-goal-next-teacher-confirmation-cockpit-receipt.mjs") &&
          item.commandOrPath.includes("current-goal-next-teacher-confirmation-cockpit-receipt-validations")
      ) &&
      html.includes("Next Teacher Confirmation Cockpit") &&
      readme.includes("Next teacher confirmation cockpit") &&
      launchpad.goalComplete === false,
    evidence: {
      statusSummary: launchpad.statusSummary,
      paths: launchpad.paths,
      actions: launchpad.safeNextActions.filter((item) => item.id.includes("next_teacher_confirmation_cockpit"))
    }
  },
  {
    name: "Launchpad prefers latest current-goal handoffs over older integrated-gate pointers",
    pass:
      launchpad.paths.lowTokenHandoff === latestLowTokenHandoff &&
      launchpad.paths.teacherSpatialDrawingHandoff === latestSpatialHandoff &&
      launchpad.paths.teacherMethodAdaptationHandoff === latestMethodHandoff &&
      launchpad.paths.teacherSpatialOverlayHtml &&
      launchpad.paths.teacherSpatialOverlayPowershell &&
      launchpad.paths.teacherSpatialSampleOverlayPacket &&
      launchpad.entryLinks.some((item) => item.id === "low_token_handoff_html" && item.path.includes(latestLowTokenHandoff.replace(/\.json$/, ".html"))) &&
      launchpad.entryLinks.some((item) => item.id === "spatial_handoff_html" && item.path.includes(latestSpatialHandoff.replace(/\.json$/, ".html"))) &&
      launchpad.entryLinks.some((item) => item.id === "teacher_method_handoff_html" && item.path.includes(latestMethodHandoff.replace(/\.json$/, ".html"))),
    evidence: {
      launchpadPaths: launchpad.paths,
      latestLowTokenHandoff,
      latestSpatialHandoff,
      latestMethodHandoff
    }
  },
  {
    name: "Launchpad exposes all-software low-token observer bootstrap",
    pass:
      launchpad.statusSummary.allSoftwareObserverBootstrapMode === "inventory_probe_waiting_for_teacher_review" &&
      launchpad.statusSummary.allSoftwareObserverBootstrapQueueReady === false &&
      launchpad.statusSummary.allSoftwareObserverBootstrapWatchBaselineReady === false &&
      launchpad.statusSummary.allSoftwareObserverBootstrapScreenshotPolicy ===
        "only_after_log_event_file_delta_or_teacher_marker_is_ambiguous" &&
      launchpad.statusSummary.allSoftwareObserverBootstrapContinuousRecording === false &&
      launchpad.statusSummary.allSoftwareObserverBootstrapNativeUniversalExecution === false &&
      launchpad.statusSummary.allSoftwareObserverInventoryProbeOutputReady === false &&
      launchpad.statusSummary.allSoftwareObserverInventoryCandidateCount === null &&
      launchpad.statusSummary.allSoftwareObserverInventoryProbeSource === "missing_or_not_generated_yet" &&
      launchpad.statusSummary.allSoftwareLogSourceDiscoveryLedgerRows === 188 &&
      launchpad.statusSummary.allSoftwareLogSourceDiscoveryRowsWithSourceRoute === 188 &&
      launchpad.statusSummary.allSoftwareLogSourceDiscoveryNeedsTeacherRows === 0 &&
      launchpad.statusSummary.allSoftwareLogSourceDiscoveryLogContentsRead === false &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentRows === 188 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentRowsWithLogSourceRoute === 188 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentWaitingForWatchEvidence === 188 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentComplete === false &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpItems === 188 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptBuilderStatus ===
        "coverage_enrollment_follow_up_receipt_builder_ready_for_teacher_use" &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptBuilderRows === 188 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptBuilderHtmlReady === true &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptTemplateReady === true &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptBuilderGoalComplete === false &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptBuilderLogContentsRead === false &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptBuilderScreenshotsCaptured === false &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptBuilderSoftwareActionsExecuted === false &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderStatus ===
        "coverage_enrollment_follow_up_receipt_builder_ready_for_teacher_use" &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderRows === 12 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderTotalRows === 188 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderOmittedRows === 176 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderHtmlReady === true &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptTemplateReady === true &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderGoalComplete === false &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpBatchIndexStatus ===
        "review_only_all_software_batch_index_ready_goal_not_complete" &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpBatchIndexTotalRows === 188 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpBatchIndexBatchSize === 12 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpBatchIndexTotalBatches === 16 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpBatchIndexKnownGeneratedRows === 12 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpBatchIndexRemainingRows === 176 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpBatchIndexNextOffset === 12 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpBatchIndexNextRange === "13-24" &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpBatchIndexHtmlReady === true &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpBatchIndexGoalComplete === false &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationStatus ===
        "waiting_for_teacher_enrollment_follow_up_review" &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationDecision ===
        "needs_teacher_review" &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationReadyRows === 0 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationWaitingRows === 12 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationOmittedRows === 176 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationNextBatchCommands === 0 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueStatus ===
        "waiting_for_teacher_review" &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueDecision ===
        "waiting_for_teacher_enrollment_follow_up_review" &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueItems === 1 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueReadyItems === 0 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueOmittedRows === 176 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueBatchRunnerInvoked === false &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptValidationStatus ===
        "waiting_for_teacher_enrollment_follow_up_review" &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptValidationDecision ===
        "needs_teacher_review" &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptValidationReadyRows === 0 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptValidationWaitingRows === 188 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptValidationForbiddenDecisionUsed === false &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpReceiptValidationNextBatchCommands === 0 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpHandoffQueueStatus ===
        "waiting_for_teacher_review" &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpHandoffQueueDecision ===
        "waiting_for_teacher_enrollment_follow_up_review" &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpHandoffQueueItems === 1 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpHandoffQueueReadyItems === 0 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpHandoffQueueUnsafeItems === 0 &&
      launchpad.statusSummary.allSoftwareCoverageEnrollmentFollowUpHandoffQueueBatchRunnerInvoked === false &&
      launchpad.statusSummary.allSoftwareObserverInventoryReviewBuilderStatus ===
        "waiting_for_teacher_inventory_review_receipt" &&
      launchpad.statusSummary.allSoftwareObserverInventoryReviewBuilderRows === 2 &&
      launchpad.statusSummary.allSoftwareObserverInventoryReviewBuilderRowsWithLogMetadata === 1 &&
      launchpad.statusSummary.allSoftwareObserverInventoryReviewBuilderHtmlReady === true &&
      launchpad.statusSummary.allSoftwareObserverInventoryBatchReviewBuilderStatus ===
        "waiting_for_teacher_inventory_batch_review_receipt" &&
      launchpad.statusSummary.allSoftwareObserverInventoryBatchReviewBuilderRows === 2 &&
      launchpad.statusSummary.allSoftwareObserverInventoryBatchReviewBuilderRowsWithLogMetadata === 1 &&
      launchpad.statusSummary.allSoftwareObserverInventoryBatchReviewBuilderHtmlReady === true &&
      launchpad.statusSummary.allSoftwareObserverReviewedQueueBridgeStatus ===
        "reviewed_inventory_queue_ready_waiting_for_metadata_delta_watch" &&
      launchpad.statusSummary.allSoftwareObserverReviewedQueueBridgeApprovedRows === 1 &&
      launchpad.statusSummary.allSoftwareObserverReviewedQueueBridgeExcludedRows === 1 &&
      launchpad.statusSummary.allSoftwareObserverReviewedQueueBridgeQueuedCount === 1 &&
      launchpad.statusSummary.allSoftwareObserverReviewedQueueBridgeDidCreateQueue === true &&
      launchpad.statusSummary.allSoftwareObserverReviewedQueueBridgeReadLogContents === false &&
      launchpad.statusSummary.allSoftwareObserverReviewedQueueBridgeScreenshotsCaptured === false &&
      launchpad.statusSummary.allSoftwareObserverReviewedQueueBridgeSoftwareActionsExecuted === false &&
      launchpad.statusSummary.teachExecuteReviewedObservationStatus ===
        "blocked_waiting_for_teacher_confirmation" &&
      launchpad.statusSummary.teachExecuteReviewedObservationDidRunReadOnlyProbe === false &&
      launchpad.statusSummary.teachExecuteReviewedObservationDidCreateQueue === false &&
      launchpad.statusSummary.teachExecuteReviewedObservationDidInitializeWatchBaseline === false &&
      launchpad.statusSummary.teachExecuteReviewedObservationScreenshotsCaptured === false &&
      launchpad.statusSummary.teachExecuteReviewedObservationSoftwareActionsExecuted === false &&
      launchpad.paths.allSoftwareObserverBootstrap === allSoftwareObserverBootstrap.bootstrapPath &&
      launchpad.paths.allSoftwareObserverBootstrapReadme.endsWith("ALL_SOFTWARE_OBSERVER_START_HERE.md") &&
      launchpad.paths.allSoftwareObserverBootstrapReceipt.endsWith("all-software-observer-bootstrap-receipt.json") &&
      launchpad.paths.allSoftwareObserverTeacherTemplate.endsWith("teacher-exclusion-and-style-template.json") &&
      launchpad.paths.allSoftwareObserverInventoryProbeOutput.endsWith("software-observer-inventory.json") &&
      launchpad.paths.allSoftwareLogSourceDiscoveryLedger.endsWith("all-software-log-source-discovery-ledger.json") &&
      launchpad.paths.allSoftwareCoverageEnrollmentLedger.endsWith("all-software-coverage-enrollment-ledger.json") &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpPlan.endsWith(
        "all-software-coverage-enrollment-follow-up-plan.json"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpReceiptBuilder.endsWith(
        "all-software-coverage-enrollment-follow-up-receipt-builder.json"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpReceiptBuilderHtml.endsWith(
        "all-software-coverage-enrollment-follow-up-receipt-builder.html"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpReceiptTemplate.endsWith(
        "teacher-coverage-enrollment-follow-up-receipt-template.json"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpReceiptBuilderReadme.endsWith(
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_RECEIPT_BUILDER_START_HERE.md"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpBatchIndex.endsWith(
        "all-software-coverage-enrollment-follow-up-batch-index.json"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpBatchIndexHtml.endsWith(
        "all-software-coverage-enrollment-follow-up-batch-index.html"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpBatchIndexReadme.endsWith(
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_BATCH_INDEX.md"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilder.endsWith(
        "all-software-coverage-enrollment-follow-up-receipt-builder.json"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderHtml.endsWith(
        "all-software-coverage-enrollment-follow-up-receipt-builder.html"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptTemplate.endsWith(
        "teacher-coverage-enrollment-follow-up-receipt-template.json"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptBuilderReadme.endsWith(
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_RECEIPT_BUILDER_START_HERE.md"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidation.endsWith(
        "all-software-coverage-enrollment-follow-up-receipt-validation.json"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationReadme.endsWith(
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_RECEIPT_VALIDATION_START_HERE.md"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpSmallBatchReceiptValidationReceipt.endsWith(
        "all-software-coverage-enrollment-follow-up-receipt-validation-receipt.json"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueue.endsWith(
        "all-software-coverage-enrollment-follow-up-handoff-queue.json"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueHtml.endsWith(
        "all-software-coverage-enrollment-follow-up-handoff-queue.html"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpSmallBatchHandoffQueueReadme.endsWith(
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_HANDOFF_QUEUE_START_HERE.md"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpReceiptValidation.endsWith(
        "all-software-coverage-enrollment-follow-up-receipt-validation.json"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpReceiptValidationReadme.endsWith(
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_RECEIPT_VALIDATION_START_HERE.md"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpReceiptValidationReceipt.endsWith(
        "all-software-coverage-enrollment-follow-up-receipt-validation-receipt.json"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpHandoffQueue.endsWith(
        "all-software-coverage-enrollment-follow-up-handoff-queue.json"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpHandoffQueueHtml.endsWith(
        "all-software-coverage-enrollment-follow-up-handoff-queue.html"
      ) &&
      launchpad.paths.allSoftwareCoverageEnrollmentFollowUpHandoffQueueReadme.endsWith(
        "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_HANDOFF_QUEUE_START_HERE.md"
      ) &&
      launchpad.paths.allSoftwareObserverInventoryReviewBuilder === allSoftwareInventoryReviewBuilder.builderPath &&
      launchpad.paths.allSoftwareObserverInventoryReviewBuilderHtml.endsWith(
        "all-software-observer-inventory-review-builder.html"
      ) &&
      launchpad.paths.allSoftwareObserverInventoryBatchReviewBuilder ===
        allSoftwareInventoryBatchReviewBuilder.builderPath &&
      launchpad.paths.allSoftwareObserverInventoryBatchReviewBuilderHtml.endsWith(
        "all-software-observer-inventory-batch-review-builder.html"
      ) &&
      launchpad.paths.allSoftwareObserverInventoryReviewReceiptTemplate.endsWith(
        "teacher-all-software-observer-inventory-review-receipt-template.json"
      ) &&
      launchpad.paths.allSoftwareObserverReviewedQueueBridge === allSoftwareReviewedQueueBridge.bridgePath &&
      launchpad.paths.allSoftwareObserverReviewedQueueBridgeReadme.endsWith("ALL_SOFTWARE_REVIEWED_QUEUE_BRIDGE.md") &&
      launchpad.paths.allSoftwareObserverReviewedQueueBridgeValidation.endsWith(
        "all-software-observer-inventory-review-receipt-validation.json"
      ) &&
      launchpad.paths.allSoftwareObserverReviewedInventory.endsWith("software-observer-inventory-teacher-reviewed.json") &&
      launchpad.paths.allSoftwareObserverReviewedQueue.endsWith("software-observer-queue.json") &&
      launchpad.paths.teachExecuteReviewedObservation === teachExecuteReviewedObservation.observationPath &&
      launchpad.paths.teachExecuteReviewedObservationReadme.endsWith(
        "TEACH_EXECUTE_REVIEWED_OBSERVATION_START_HERE.md"
      ) &&
      launchpad.paths.teachExecuteReviewedObservationReceipt.endsWith(
        "teach-execute-reviewed-observation-receipt.json"
      ) &&
      actionIds.has("create_all_software_observer_bootstrap") &&
      actionIds.has("run_all_software_read_only_inventory_probe") &&
      actionIds.has("build_all_software_log_source_discovery_ledger") &&
      actionIds.has("build_all_software_coverage_enrollment_ledger") &&
      actionIds.has("build_all_software_coverage_enrollment_follow_up_plan") &&
      actionIds.has("build_all_software_coverage_enrollment_follow_up_receipt_builder") &&
      actionIds.has("build_all_software_coverage_enrollment_follow_up_small_batch_receipt_builder") &&
      actionIds.has("open_all_software_coverage_enrollment_follow_up_small_batch_receipt_builder") &&
      actionIds.has("open_all_software_coverage_enrollment_follow_up_receipt_builder") &&
      actionIds.has("validate_all_software_coverage_enrollment_follow_up_receipt") &&
      actionIds.has("validate_all_software_coverage_enrollment_follow_up_small_batch_receipt") &&
      actionIds.has("build_all_software_coverage_enrollment_follow_up_handoff_queue") &&
      actionIds.has("build_all_software_coverage_enrollment_follow_up_small_batch_handoff_queue") &&
      actionIds.has("open_all_software_coverage_enrollment_follow_up_small_batch_handoff_queue") &&
      actionIds.has("open_all_software_coverage_enrollment_follow_up_handoff_queue") &&
      actionIds.has("build_all_software_inventory_review_builder") &&
      actionIds.has("build_all_software_inventory_batch_review_builder") &&
      actionIds.has("open_all_software_inventory_batch_review_builder") &&
      actionIds.has("build_all_software_reviewed_queue_from_receipt") &&
      actionIds.has("start_teacher_confirmed_reviewed_observation"),
    evidence: {
      statusSummary: launchpad.statusSummary,
      paths: launchpad.paths
    }
  },
  {
    name: "Launchpad exposes machine-readable next proof gap queue",
    pass:
      launchpad.paths.proofGapTeacherQueue === proofGapTeacherQueue.queuePath &&
      launchpad.statusSummary.proofGapTeacherQueueStatus === "waiting_for_teacher_evidence_queue_receipt" &&
      launchpad.statusSummary.proofGapTeacherQueueItems === 1 &&
      launchpad.statusSummary.nextProofGapStatus === "next_teacher_evidence_required" &&
      launchpad.statusSummary.nextProofGapPhase === "all_software_low_token_log_learning" &&
      launchpad.statusSummary.nextProofGapRouteId === "post_registration_output_witness_route" &&
      launchpad.statusSummary.nextProofGapReceiptValidationCommandReady === true &&
      launchpad.statusSummary.proofGapEvidencePrefillStatus === "candidate_only_waiting_for_teacher_review" &&
      launchpad.statusSummary.proofGapEvidencePrefillRows === 1 &&
      launchpad.statusSummary.proofGapEvidencePrefillRowsWithCandidateEvidence === 1 &&
      launchpad.statusSummary.proofGapTeacherQueueReceiptBuilderStatus ===
        "waiting_for_teacher_to_fill_proof_gap_queue_receipt" &&
      launchpad.statusSummary.proofGapTeacherQueueReceiptBuilderRows === 1 &&
      launchpad.statusSummary.proofGapTeacherQueueReceiptBuilderRowsWithCandidatePrefill === 1 &&
      launchpad.statusSummary.proofGapTeacherQueueReceiptBuilderHtmlReady === true &&
      launchpad.statusSummary.nextProofGapFocusedReceiptBuilderStatus ===
        "waiting_for_teacher_to_fill_next_proof_gap_focused_receipt" &&
      launchpad.statusSummary.nextProofGapFocusedReceiptBuilderHtmlReady === true &&
      launchpad.statusSummary.nextProofGapFocusedReceiptBuilderRouteId === "post_registration_output_witness_route" &&
      launchpad.statusSummary.nextProofGapFocusedReceiptBuilderRequiresRollbackPoint === true &&
      launchpad.statusSummary.proofGapTeacherQueueReceiptValidationStatus === "waiting_for_teacher_evidence" &&
      launchpad.statusSummary.proofGapTeacherQueueReceiptValidationReadyRows === 0 &&
      launchpad.statusSummary.proofGapTeacherQueueReceiptValidationNextReviewQueue === 0 &&
      launchpad.statusSummary.proofGapReceiptValidationHandoffBuilderReady === false &&
      launchpad.statusSummary.proofGapReceiptIntakeRouterStatus === "blocked_waiting_for_teacher_proof_gap_receipt" &&
      launchpad.statusSummary.proofGapReceiptIntakeRouterReadyForManualHandoffBuilder === false &&
      launchpad.statusSummary.proofGapReceiptIntakeRouterBlockerCount === 1 &&
      launchpad.statusSummary.nextProofGapCandidateEvidenceExists === true &&
      launchpad.statusSummary.nextProofGapStillNeedsTeacherConfirmation > 0 &&
      launchpad.paths.proofGapEvidencePrefill === proofGapEvidencePrefill.prefillPath &&
      launchpad.paths.proofGapTeacherQueueReceiptBuilder === proofGapTeacherQueueReceiptBuilder.builderPath &&
      launchpad.paths.proofGapNextFocusedReceiptBuilder === proofGapNextFocusedReceiptBuilder.builderPath &&
      launchpad.paths.proofGapNextFocusedReceiptBuilderHtml.endsWith(
        "original-goal-next-proof-gap-focused-receipt-builder.html"
      ) &&
      launchpad.paths.proofGapTeacherQueueReceiptValidation === proofGapTeacherQueueReceiptValidation.validationPath &&
      launchpad.paths.proofGapReceiptIntakeRouter === proofGapReceiptIntakeRouter.routerPath &&
      launchpad.nextProofGapSummary.receiptValidationCommandTemplate.includes(
        "validate-original-goal-proof-gap-teacher-queue-receipt.mjs"
      ) &&
      launchpad.nextProofGapEvidencePrefillSummary.candidateObservedEvidencePath === proofGapEvidencePath &&
      actionIds.has("open_next_proof_gap_teacher_queue") &&
      actionIds.has("open_proof_gap_teacher_queue_receipt_builder") &&
      actionIds.has("build_next_proof_gap_focused_receipt_builder") &&
      actionIds.has("open_next_proof_gap_focused_receipt_builder") &&
      actionIds.has("validate_proof_gap_teacher_queue_receipt") &&
      actionIds.has("build_proof_gap_validation_handoff_builder") &&
      buildProofGapValidationHandoffAction?.commandOrPath === "" &&
      buildProofGapValidationHandoffAction?.detail.includes("use Route Proof Gap Teacher Receipt first") &&
      actionIds.has("route_proof_gap_teacher_receipt") &&
      actionIds.has("open_proof_gap_evidence_prefill") &&
      actionIds.has("open_proof_gap_candidate_receipt_draft"),
    evidence: {
      statusSummary: launchpad.statusSummary,
      nextProofGapSummary: launchpad.nextProofGapSummary
    }
  },
  {
    name: "Launchpad summarizes transparent overlay 2D perspective 3D capability and execution boundary",
    pass:
      launchpad.statusSummary.transparentOverlayAvailable === true &&
      launchpad.statusSummary.spatialBrowserOverlayAvailable === true &&
      launchpad.statusSummary.spatialWindowsTopMostOverlayAvailable === true &&
      launchpad.statusSummary.spatialHas2DPositionEvidence === true &&
      launchpad.statusSummary.spatialHasPerspectiveEvidence === true &&
      launchpad.statusSummary.spatialHas3DDepthEvidence === true &&
      launchpad.statusSummary.spatialHasDetailLogicContract === true &&
      launchpad.statusSummary.spatialRequiresTeacherExportedPacket === true &&
      launchpad.statusSummary.spatialRequiresNumberedTargetConfirmation === true &&
      launchpad.statusSummary.spatialTargetSoftwareExecutedHere === false &&
      launchpad.statusSummary.spatialExecutionBoundary ===
        "teacher_packet_spatial_receipt_depth_review_and_numbered_target_required_before_execution",
    evidence: launchpad.statusSummary
  },
  {
    name: "Launchpad exposes safe next actions without execution",
    pass:
      actionIds.has("open_teacher_trial_workbench") &&
      actionIds.has("open_shortest_teacher_evidence_pack") &&
      actionIds.has("create_shortest_teacher_evidence_pack") &&
      actionIds.has("build_shortest_teacher_evidence_receipt") &&
      actionIds.has("validate_shortest_teacher_evidence_receipt") &&
      actionIds.has("open_teacher_trial_preflight") &&
      actionIds.has("build_teacher_trial_receipt") &&
      actionIds.has("validate_trial_receipt") &&
      actionIds.has("regenerate_teacher_trial_preflight_after_receipt") &&
      actionIds.has("route_teacher_trial_receipt") &&
      actionIds.has("create_real_local_trial_package") &&
      actionIds.has("open_final_teacher_acceptance_review_pack") &&
      actionIds.has("create_final_teacher_acceptance_review_pack") &&
      actionIds.has("validate_final_teacher_acceptance_receipt") &&
      actionIds.has("select_low_token_route") &&
      actionIds.has("open_transparent_overlay") &&
      actionIds.has("validate_teacher_overlay_packet") &&
      actionIds.has("bridge_teacher_overlay_packet_to_rule_draft") &&
      actionIds.has("create_physical_world_spatial_grounding_pack") &&
      actionIds.has("open_physical_world_spatial_grounding") &&
      actionIds.has("prepare_execution_approval_gate") &&
      launchpad.safeNextActions.some((item) =>
        item.commandOrPath.includes("create-transparent-sketch-overlay-packet-rule-draft-bridge.mjs")
      ) &&
      launchpad.safeNextActions.some((item) => item.commandOrPath.includes("validate-current-goal-teacher-trial-workbench-receipt.mjs")),
    evidence: launchpad.safeNextActions
  },
  {
    name: "Launchpad exposes final teacher acceptance review without claiming completion",
    pass:
      launchpad.statusSummary.finalTeacherAcceptanceReviewPackStatus ===
        "ready_for_final_teacher_acceptance_review_not_completion" &&
      launchpad.statusSummary.finalTeacherAcceptanceReviewPackReady === true &&
      launchpad.statusSummary.finalConvergenceReadinessGateStatus ===
        "convergence_evidence_ready_for_final_teacher_review_not_completion" &&
      launchpad.statusSummary.finalConvergenceReviewEvidenceReadyLanes === 9 &&
      launchpad.statusSummary.finalConvergenceTotalLanes === 10 &&
      launchpad.statusSummary.finalConvergenceCompletionReadyLanes === 0 &&
      launchpad.safeNextActions.some((item) =>
        item.commandOrPath.includes("validate-current-goal-final-teacher-acceptance-receipt.mjs")
      ),
    evidence: launchpad.statusSummary
  },
  {
    name: "Launchpad exposes physical-world spatial grounding for transparent overlay review",
    pass:
      launchpad.statusSummary.physicalWorldSpatialGroundingPackStatus ===
        "source_project_grounding_ready_for_transparent_overlay_review" &&
      launchpad.statusSummary.physicalWorldSpatialGroundingPresentRows >= 5 &&
      launchpad.statusSummary.physicalWorldSpatialGroundingTotalRows >= 7 &&
      launchpad.paths.physicalWorldSpatialGroundingPack === physicalGrounding.packPath &&
      launchpad.entryLinks.some((item) => item.id === "physical_world_spatial_grounding_html" && item.exists === true) &&
      launchpad.safeNextActions.some((item) =>
        item.commandOrPath.includes("create-physical-world-spatial-grounding-pack.mjs")
      ),
    evidence: {
      statusSummary: launchpad.statusSummary,
      physicalGrounding
    }
  },
  {
    name: "Launchpad exposes one-step receipt intake routing",
    pass:
      launchpad.statusSummary.teacherTrialIntakeRouterStatus === "blocked_waiting_for_teacher_trial_receipt" &&
      launchpad.statusSummary.teacherTrialIntakeRouterReadyForNextManualCommand === false &&
      launchpad.statusSummary.teacherTrialIntakeRouterBlockerCount === 1 &&
      launchpad.statusSummary.shortestTeacherEvidencePackStatus ===
        "shortest_teacher_evidence_path_ready_review_only_goal_not_complete" &&
      launchpad.statusSummary.shortestTeacherEvidenceStepCount === 6 &&
      launchpad.statusSummary.shortestTeacherEvidenceReceiptBuilderReady === true &&
      launchpad.statusSummary.shortestTeacherEvidenceReceiptValidationStatus ===
        "waiting_for_teacher_to_collect_shortest_evidence" &&
      launchpad.statusSummary.shortestTeacherEvidenceReceiptValidationReadyForTrial === false &&
      launchpad.statusSummary.shortestTeacherEvidenceReceiptValidationReadyForNextManualCommand === false &&
      launchpad.statusSummary.shortestTeacherEvidenceReceiptValidationNextManualCommands === 1 &&
      launchpad.paths.shortestTeacherEvidenceReceiptValidation.endsWith(
        "shortest-teacher-evidence-receipt-validation.json"
      ) &&
      launchpad.safeNextActions.some((item) =>
        item.commandOrPath.includes("create-current-goal-teacher-trial-intake-router.mjs")
      ) &&
      launchpad.safeNextActions.some((item) =>
        item.commandOrPath.includes("create-current-goal-shortest-teacher-evidence-pack.mjs")
      ) &&
      launchpad.safeNextActions.some((item) =>
        item.commandOrPath.includes("validate-current-goal-shortest-teacher-evidence-receipt.mjs")
      ),
    evidence: launchpad.safeNextActions
  },
  {
    name: "Launchpad exposes bounded real-local full-goal trial package",
    pass:
      launchpad.statusSummary.realLocalTrialPackageStatus === "real_local_trial_evidence_ready_review_only_goal_not_complete" &&
      launchpad.statusSummary.realLocalTrialPackageChecksPassed === 10 &&
      launchpad.statusSummary.realLocalTrialPackageChecksTotal === 10 &&
      Boolean(launchpad.statusSummary.realLocalTrialPackageSampleSoftware) &&
      launchpad.safeNextActions.some((item) =>
        item.commandOrPath.includes("create-current-goal-real-local-trial-package.mjs")
      ),
    evidence: launchpad.statusSummary
  },
  {
    name: "Launchpad preserves current-goal incompletion boundary",
    pass:
      launchpad.goalComplete === false &&
      launchpad.statusSummary.goalComplete === false &&
      launchpad.statusSummary.totalRequirements >= 9 &&
      launchpad.statusSummary.completionProvenCount === 0 &&
      launchpad.statusSummary.teacherTrialPhaseCount >= 8,
    evidence: launchpad.statusSummary
  },
  {
    name: "Launchpad keeps all side-effect locks closed",
    pass:
      launchpad.locks.reviewOnly === true &&
      launchpad.locks.launchpadDoesNotReadLogs === true &&
      launchpad.locks.launchpadDoesNotCaptureScreenshots === true &&
      launchpad.locks.launchpadDoesNotExecuteTargetSoftware === true &&
      launchpad.locks.launchpadDoesNotWriteMemory === true &&
      launchpad.locks.launchpadDoesNotEnableRules === true &&
      launchpad.locks.launchpadDoesNotDeleteRollbackPoints === true &&
      launchpad.locks.goalComplete === false,
    evidence: launchpad.locks
  },
  {
    name: "HTML and README include teacher-facing entry phrases",
    pass:
      html.includes("Teacher Trial Workbench") &&
      html.includes("All Software Inventory Batch Review Builder") &&
      html.includes("Proof Gap Teacher Queue") &&
      html.includes("Proof Gap Evidence Prefill") &&
      html.includes("Next Proof Gap Focused Receipt Builder") &&
      html.includes("Shortest Teacher Evidence Pack") &&
      html.includes("Shortest Evidence Receipt Builder") &&
      html.includes("Final Teacher Acceptance Review Pack") &&
      html.includes("Final Review Index") &&
      html.includes("Teacher Trial Preflight") &&
      html.includes("Teacher Trial Intake Router") &&
      html.includes("Real Local Trial Package") &&
      html.includes("Receipt Builder") &&
      html.includes("Transparent Overlay") &&
      html.includes("Physical World Spatial Grounding") &&
      html.includes("Validate Trial Receipt") &&
      html.includes("Blocked Actions") &&
      readme.includes("Current Goal Start Here") &&
      readme.includes("All-software inventory batch review builder") &&
      readme.includes("Next proof gap") &&
      readme.includes("Next proof gap focused receipt builder") &&
      readme.includes("Next proof gap candidate evidence") &&
      readme.includes("Shortest Teacher Evidence Pack") &&
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
      smoke: "transparent_ai_current_goal_start_here_launchpad_smoke_v1",
      checks,
      tempCleaned: true
    },
    null,
    2
  )
);

