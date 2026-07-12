#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const serverScript = join(pluginRoot, "scripts", "mcp-server.mjs");

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let nextId = 1;
  const pending = new Map();
  let stdoutBuffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });
  function rpc(method, params = {}) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolvePromise, rejectPromise) => pending.set(id, { resolve: resolvePromise, reject: rejectPromise }));
  }
  async function stop() {
    child.kill();
    await new Promise((resolvePromise) => child.once("exit", resolvePromise));
  }
  return { rpc, stop };
}

async function callAdvancedFinalCompletionGate() {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "validate_original_goal_final_completion_gate",
      arguments: {
        completionBlockerMatrix: matrixPath,
        lowTokenCoverageGate: coverageGatePath,
        realLocalReadinessPackage: readinessPackagePath,
        teacherMethodContractReceiptValidation: teacherMethodContractReceiptValidationPath,
        teacherMethodReuseResultProofValidation: teacherMethodReuseResultProofValidationPath,
        unattendedAudit: unattendedAuditPath,
        sketchImplementationAudit: sketchAuditPath,
        spatialIntentReceiptValidation: spatialValidationPath,
        executionConvergenceAudit: executionAuditPath,
        ruleDslDeliveryGateAudit: ruleDslDeliveryGateAuditWithRollbackPathPath,
        finalTeacherReceiptValidation: finalTeacherReceiptValidationPath,
        outputDir: join(smokeRoot, "mcp-ready-final-completion-gate")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachApprenticeFinalCompletionGate() {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        whatToTeach:
          "Run the final completion gate to check whether the original goal can be claimed complete from supplied evidence.",
        validateOriginalGoalFinalCompletionGate: true,
        completionBlockerMatrix: matrixPath,
        lowTokenCoverageGate: coverageGatePath,
        realLocalReadinessPackage: readinessPackagePath,
        teacherMethodContractReceiptValidation: teacherMethodContractReceiptValidationPath,
        teacherMethodReuseResultProofValidation: teacherMethodReuseResultProofValidationPath,
        unattendedAudit: unattendedAuditPath,
        sketchImplementationAudit: sketchAuditPath,
        spatialIntentReceiptValidation: spatialValidationPath,
        executionConvergenceAudit: executionAuditPath,
        ruleDslDeliveryGateAudit: ruleDslDeliveryGateAuditWithRollbackPathPath,
        finalTeacherReceiptValidation: finalTeacherReceiptValidationPath,
        outputDir: join(smokeRoot, "default-teach-apprentice-final-completion-gate")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "original-goal-final-completion-gate-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const requiredMatrixLanes = [
  "all_software_low_token_coverage_evidence",
  "unattended_operational_monitor_evidence",
  "universal_native_execution_control_channel",
  "teacher_reviewed_triggered_visual_evidence_path",
  "transparent_sketch_spatial_intent_teacher_export",
  "voice_text_numbered_confirmation_supervised_execution_gate",
  "rollback_evidence_before_system_change"
];

const matrixPath = writeJson(join(smokeRoot, "matrix", "original-goal-completion-blocker-matrix.json"), {
  ok: true,
  format: "transparent_ai_original_goal_completion_blocker_matrix_v1",
  matrixId: "smoke-final-completion-gate",
  status: "waiting_for_teacher_completion_blocker_review",
  rows: requiredMatrixLanes.map((lane) => ({
    id: lane,
    lane,
    status: "blocked_or_waiting_for_teacher_reviewed_evidence",
    requirement: `Fixture requirement for ${lane}`,
    locks: {
      goalComplete: false,
      nativeUniversalExecution: false
    }
  })),
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false,
    nativeUniversalExecution: false
  }
});

const coverageGatePath = writeJson(join(smokeRoot, "coverage", "low-token-coverage-completion-gate.json"), {
  ok: true,
  format: "transparent_ai_original_goal_low_token_coverage_completion_gate_v1",
  status: "coverage_evidence_ready_for_final_teacher_review_not_completion",
  coverageEvidenceReadyForFinalTeacherReview: true,
  logSourceDiscoveryReadyForCoverage: true,
  allSoftwareCoverageComplete: false,
  locks: {
    reviewOnly: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const readinessPackagePath = writeJson(join(smokeRoot, "readiness", "real-local-all-software-low-token-readiness-package.json"), {
  ok: true,
  format: "transparent_ai_real_local_all_software_low_token_readiness_package_v1",
  status: "waiting_for_teacher_review_before_registration_or_learning_memory",
  counts: {
    realLocalCandidates: 4,
    cadOrSolidWorksCandidates: 1,
    nonCadSolidWorksCandidates: 3,
    nonCadSolidWorksLedgerRows: 3,
    logSourceDiscoveryRows: 4,
    logSourceDiscoveryMissingRows: 0
  },
  scopeEvidence: {
    scopeClaim: "real_local_bounded_all_software_not_cad_solidworks_only",
    realLocalCandidateRows: 4,
    cadOrSolidWorksCandidateRows: 1,
    nonCadSolidWorksCandidateRows: 3,
    nonCadSolidWorksLedgerRows: 3,
    allRowsHaveCurrentSourceRoute: true,
    sampledNonCadSolidWorksRows: [
      { software: "FixtureBrowser", processName: "fixturebrowser.exe", discoveryStatus: "windows_event_log_fallback_ready_for_review" },
      { software: "FixtureEditor", processName: "fixtureeditor.exe", discoveryStatus: "non_log_low_token_fallback_ready_for_review" }
    ],
    boundedNotComplete: true
  },
  boundaries: {
    allRowsHaveCurrentSourceRoute: true,
    broadAllInstalledSoftwareComplete: false
  },
  locks: {
    reviewOnly: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});
const missingRouteReadinessPackagePath = writeJson(join(smokeRoot, "readiness", "missing-route-readiness-package.json"), {
  ok: true,
  format: "transparent_ai_real_local_all_software_low_token_readiness_package_v1",
  status: "waiting_for_teacher_review_before_registration_or_learning_memory",
  counts: {
    realLocalCandidates: 4,
    cadOrSolidWorksCandidates: 1,
    nonCadSolidWorksCandidates: 3,
    nonCadSolidWorksLedgerRows: 3,
    logSourceDiscoveryRows: 3,
    logSourceDiscoveryMissingRows: 1
  },
  scopeEvidence: {
    scopeClaim: "real_local_bounded_all_software_not_cad_solidworks_only",
    realLocalCandidateRows: 4,
    cadOrSolidWorksCandidateRows: 1,
    nonCadSolidWorksCandidateRows: 3,
    nonCadSolidWorksLedgerRows: 3,
    allRowsHaveCurrentSourceRoute: false,
    sampledNonCadSolidWorksRows: [
      { software: "FixtureBrowser", processName: "fixturebrowser.exe", discoveryStatus: "windows_event_log_fallback_ready_for_review" }
    ],
    boundedNotComplete: true
  },
  boundaries: {
    allRowsHaveCurrentSourceRoute: false,
    broadAllInstalledSoftwareComplete: false
  },
  locks: {
    reviewOnly: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});
const cadOnlyReadinessPackagePath = writeJson(join(smokeRoot, "readiness", "cad-only-readiness-package.json"), {
  ok: true,
  format: "transparent_ai_real_local_all_software_low_token_readiness_package_v1",
  status: "waiting_for_teacher_review_before_registration_or_learning_memory",
  counts: {
    realLocalCandidates: 1,
    cadOrSolidWorksCandidates: 1,
    nonCadSolidWorksCandidates: 0,
    nonCadSolidWorksLedgerRows: 0,
    logSourceDiscoveryRows: 1,
    logSourceDiscoveryMissingRows: 0
  },
  scopeEvidence: {
    scopeClaim: "cad_solidworks_only_sample_not_enough_for_original_goal",
    realLocalCandidateRows: 1,
    cadOrSolidWorksCandidateRows: 1,
    nonCadSolidWorksCandidateRows: 0,
    nonCadSolidWorksLedgerRows: 0,
    allRowsHaveCurrentSourceRoute: true,
    sampledNonCadSolidWorksRows: [],
    boundedNotComplete: true
  },
  boundaries: {
    allRowsHaveCurrentSourceRoute: true,
    broadAllInstalledSoftwareComplete: false
  },
  locks: {
    reviewOnly: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const teacherMethodContractReceiptValidationPath = writeJson(
  join(smokeRoot, "teacher-method", "teacher-method-execution-learning-contract-receipt-validation.json"),
  {
    ok: true,
    format: "transparent_ai_teacher_method_execution_learning_contract_receipt_validation_v1",
    status: "teacher_method_contract_confirmed_waiting_for_reuse_result_proof",
    decision: "teacher_method_contract_confirmed",
    readyForReuseResultProof: true,
    blockers: [],
    counts: {
      contractRouteRows: 4,
      receiptRouteRows: 4,
      confirmedMatchingRows: 4,
      blockers: 0
    },
    sourceEvidence: {
      contract: join(smokeRoot, "teacher-method", "teacher-method-execution-learning-contract.json"),
      receipt: join(smokeRoot, "teacher-method", "teacher-method-contract-receipt.json"),
      rollbackPoint: "retained-teacher-method-smoke-rollback"
    },
    locks: {
      reviewOnly: true,
      validationDoesNotExecuteTargetSoftware: true,
      validationDoesNotWriteMemory: true,
      nativeUniversalExecution: false,
      goalComplete: false
    }
  }
);
const teacherMethodReuseResultProofValidationPath = writeJson(
  join(smokeRoot, "teacher-method", "teacher-method-reuse-result-proof-validation.json"),
  {
    ok: true,
    format: "transparent_ai_teacher_method_reuse_result_proof_validation_v1",
    status: "teacher_method_reuse_result_confirmed_ready_for_medium_runtime_reuse_gate",
    decision: "teacher_reuse_result_confirmed",
    readyForMediumRuntimeReuseGate: true,
    repairRequired: false,
    blockers: [],
    sourceEvidence: {
      contractReceiptValidation: teacherMethodContractReceiptValidationPath,
      previousRunEvidencePath: join(smokeRoot, "teacher-method", "previous-run-evidence.json"),
      reuseRunEvidencePath: join(smokeRoot, "teacher-method", "reuse-run-evidence.json"),
      rollbackPoint: "retained-teacher-method-smoke-rollback"
    },
    proofSummary: {
      teacherReviewedBeforeAfter: true,
      teacherObservedImprovement: true,
      ambiguityReducedOrAccuracyImproved: true,
      improvementSummary: "The reused teacher method followed the teacher's preferred evidence order and reduced ambiguity.",
      remainingMismatchOrCorrection: ""
    },
    locks: {
      reviewOnly: true,
      validationDoesNotExecuteTargetSoftware: true,
      validationDoesNotWriteMemory: true,
      mediumRuntimeReuseEnabled: false,
      nativeUniversalExecution: false,
      goalComplete: false
    }
  }
);
const missingImprovementTeacherMethodReuseValidationPath = writeJson(
  join(smokeRoot, "teacher-method", "teacher-method-reuse-result-proof-validation-missing-improvement.json"),
  {
    ok: true,
    format: "transparent_ai_teacher_method_reuse_result_proof_validation_v1",
    status: "teacher_method_reuse_result_needs_teacher_review_or_more_evidence",
    decision: "needs_teacher_review",
    readyForMediumRuntimeReuseGate: false,
    repairRequired: false,
    blockers: ["teacher_observed_improvement_missing"],
    proofSummary: {
      teacherReviewedBeforeAfter: true,
      teacherObservedImprovement: false,
      ambiguityReducedOrAccuracyImproved: false,
      improvementSummary: "",
      remainingMismatchOrCorrection: ""
    },
    locks: {
      reviewOnly: true,
      validationDoesNotExecuteTargetSoftware: true,
      validationDoesNotWriteMemory: true,
      mediumRuntimeReuseEnabled: false,
      nativeUniversalExecution: false,
      goalComplete: false
    }
  }
);

const unattendedAuditPath = writeJson(join(smokeRoot, "unattended", "all-software-unattended-learning-audit.json"), {
  ok: true,
  format: "transparent_ai_all_software_unattended_learning_audit_v1",
  status: "unattended_learning_ready_for_teacher_operational_review",
  unattendedAllAppMonitoringComplete: true,
  remainingGaps: [],
  evidenceCounts: {
    reviewedRunCount: 2,
    compactLearningEvents: 3
  },
  locks: {
    reviewOnly: true,
    nativeUniversalExecution: false
  }
});

const sketchAuditPath = writeJson(join(smokeRoot, "sketch", "sketch-demonstration-implementation-audit.json"), {
  format: "transparent_ai_sketch_demonstration_implementation_audit_v1",
  status: "passed",
  requirementSummary: {
    transparentDrawingMaskImplemented: true,
    existingDrawingSoftwareReused: true,
    teacher2DSketchUnderstood: true,
    teacherPerspectiveSketchUnderstood: true,
    teacher3DDepthSketchUnderstood: true,
    universalDetailLogicContractImplemented: true,
    visualSimilarityRejectedWithoutDetailLogic: true,
    numberedTargetConfirmationImplemented: true,
    softwareExecutionBridgeImplemented: true,
    realLocalSoftwareContextProven: true,
    unattendedNativeUniversalExecutionProven: false
  },
  locks: {
    reviewOnly: true,
    nativeUniversalExecution: false
  }
});
const sketchAuditPackagePath = writeJson(join(smokeRoot, "sketch", "sketch-demonstration-implementation-audit-package.json"), {
  ok: true,
  format: "transparent_ai_sketch_demonstration_implementation_audit_package_v1",
  status: "sketch_demonstration_implemented_waiting_for_teacher_real_overlay_review",
  requirementSummary: {
    transparentDrawingMaskImplemented: true,
    existingDrawingSoftwareReused: true,
    teacher2DSketchUnderstood: true,
    teacherPerspectiveSketchUnderstood: true,
    teacher3DDepthSketchUnderstood: true,
    universalDetailLogicContractImplemented: true,
    visualSimilarityRejectedWithoutDetailLogic: true,
    numberedTargetConfirmationImplemented: true,
    softwareExecutionBridgeImplemented: true,
    realLocalSoftwareContextProven: true,
    unattendedNativeUniversalExecutionProven: false
  },
  completionBoundary: [
    {
      requirement: "Real teacher exported overlay packet and teacher receipt",
      status: "not_yet_proved",
      evidence: "requires teacher-supplied overlay export and review receipt"
    }
  ],
  locks: {
    reviewOnly: true,
    nativeUniversalExecution: false,
    formalAuditDoesNotExecuteSoftware: true
  }
});

const spatialValidationPath = writeJson(join(smokeRoot, "spatial", "spatial-intent-evidence-receipt-validation.json"), {
  ok: true,
  format: "transparent_ai_spatial_intent_evidence_receipt_validation_v1",
  status: "validated_with_ready_spatial_target_confirmation",
  validationDecision: "ready_for_reviewed_spatial_target_confirmation",
  validationRow: {
    canPrepareSpatialConfirmation: true,
    detailLogicValidationReadyForAction: true,
    spatialEvidence: {
      has2DPosition: true,
      hasPerspective: true,
      has3DDepth: true
    }
  },
  locks: {
    reviewOnly: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});
const missingSpatialDimensionsValidationPath = writeJson(
  join(smokeRoot, "spatial", "spatial-intent-evidence-receipt-validation-missing-dimensions.json"),
  {
    ok: true,
    format: "transparent_ai_spatial_intent_evidence_receipt_validation_v1",
    status: "validated_with_ready_spatial_target_confirmation",
    validationDecision: "ready_for_reviewed_spatial_target_confirmation",
    validationRow: {
      canPrepareSpatialConfirmation: true,
      detailLogicValidationReadyForAction: true,
      spatialEvidence: {
        has2DPosition: true,
        hasPerspective: false,
        has3DDepth: false
      }
    },
    locks: {
      reviewOnly: true,
      nativeUniversalExecution: false,
      goalComplete: false
    }
  }
);

const executionAuditPath = writeJson(join(smokeRoot, "execution", "execution-capability-convergence-audit.json"), {
  ok: true,
  format: "transparent_ai_all_software_execution_capability_convergence_audit_v1",
  status: "bounded_execution_capability_ready_for_teacher_completion_review",
  executionConvergedForTeacherReview: true,
  allSoftwareExecutionComplete: false,
  nativeUniversalExecution: false,
  locks: {
    reviewOnly: true,
    nativeUniversalExecution: false
  }
});

const integratedEvidenceGatePath = writeJson(join(smokeRoot, "integrated", "current-goal-integrated-evidence-gate.json"), {
  ok: true,
  format: "transparent_ai_current_goal_integrated_evidence_gate_v1",
  status: "current_goal_not_complete_waiting_for_teacher_evidence_and_real_software_run",
  goalComplete: false,
  requirements: [
    {
      id: "teacher_method_adaptation",
      status: "partial_review_ready",
      implementationEvidenceProven: true,
      completionProven: false,
      evidenceSummary: {
        supportedMethodLaneCount: 9,
        inferredTeacherModes: [
          "transparent_overlay_sketch",
          "software_log_deltas",
          "before_after_examples",
          "spatial_intent_review",
          "ordered_steps",
          "correction_first",
          "voice_explanation",
          "silent_workalong_until_trigger",
          "triggered_screenshot"
        ]
      }
    },
    {
      id: "high_to_medium_reasoning_cost_control",
      status: "policy_review_ready",
      implementationEvidenceProven: true,
      completionProven: false,
      evidenceSummary: {
        mediumRuntimeReuseEnabled: false,
        downgradeAllowedOnlyAfter:
          "teacher-reviewed method contract, low-token evidence gate, spatial logic contract, retained rollback, and dry-run validation all pass",
        escalationBackToHighReasoningWhen:
          "teacher correction, missing logic source, ambiguous overlay/spatial intent, failed validator, or unexpected software evidence appears"
      }
    },
    {
      id: "voice_text_numbered_execution_control",
      status: "implementation_review_ready_waiting_for_teacher_number",
      implementationEvidenceProven: true,
      completionProven: false,
      evidenceSummary: {
        candidateNumbers: [1, 2, 3],
        nextCalls: [
          "confirm_engineering_command_target",
          "create_software_control_channel_profile",
          "start_teach_execute_supervised_execution"
        ],
        softwareActionsExecuted: false,
        targetSoftwareCommandsExecuted: false
      },
      strictLocks: [
        "voice_text_cannot_execute_without_confirmed_number",
        "voice_text_confirmation_not_teacher_acceptance",
        "dry_run_first_before_target_software_execution"
      ]
    }
  ],
  locks: {
    reviewOnly: true,
    mediumRuntimeReuseEnabled: false,
    gateDoesNotExecuteTargetSoftware: true,
    gateDoesNotCaptureScreenshots: true,
    gateDoesNotRecordScreen: true,
    goalComplete: false
  }
});
const missingVoiceIntegratedEvidenceGatePath = writeJson(
  join(smokeRoot, "integrated", "current-goal-integrated-evidence-gate-missing-voice.json"),
  {
    ok: true,
    format: "transparent_ai_current_goal_integrated_evidence_gate_v1",
    status: "current_goal_not_complete_waiting_for_teacher_evidence_and_real_software_run",
    goalComplete: false,
    requirements: [],
    locks: {
      reviewOnly: true,
      gateDoesNotExecuteTargetSoftware: true,
      gateDoesNotCaptureScreenshots: true,
      gateDoesNotRecordScreen: true,
      goalComplete: false
    }
  }
);
const missingTeacherMethodIntegratedEvidenceGatePath = writeJson(
  join(smokeRoot, "integrated", "current-goal-integrated-evidence-gate-missing-teacher-method.json"),
  {
    ok: true,
    format: "transparent_ai_current_goal_integrated_evidence_gate_v1",
    status: "current_goal_not_complete_waiting_for_teacher_evidence_and_real_software_run",
    goalComplete: false,
    requirements: [
      {
        id: "voice_text_numbered_execution_control",
        status: "implementation_review_ready_waiting_for_teacher_number",
        implementationEvidenceProven: true,
        completionProven: false,
        evidenceSummary: {
          candidateNumbers: [1, 2, 3],
          nextCalls: ["confirm_engineering_command_target"],
          softwareActionsExecuted: false,
          targetSoftwareCommandsExecuted: false
        }
      }
    ],
    locks: {
      reviewOnly: true,
      mediumRuntimeReuseEnabled: false,
      gateDoesNotExecuteTargetSoftware: true,
      gateDoesNotCaptureScreenshots: true,
      gateDoesNotRecordScreen: true,
      goalComplete: false
    }
  }
);

const ruleDslDeliveryGateAuditPath = writeJson(join(smokeRoot, "rules", "rag-delivery-gate-audit-trail.json"), {
  ok: true,
  format: "transparent_ai_rag_delivery_gate_audit_trail_v1",
  status: "audit_trail_ready_for_teacher_review",
  evidenceChain: [
    { step: "rag_disabled_validation_report_packet", status: "validation_report_ready_for_review" },
    { step: "validation_report", status: "skipped", deliveryAllowed: true },
    { step: "closed_delivery_gate", status: "review_only_delivery_gate_closed", deliveryGateOpen: false },
    { step: "retained_rollback_point", status: "waiting_for_teacher_confirmation" }
  ],
  blockedTransitions: [
    "validation_report_delivery_allowed_to_packaging_unlock",
    "validation_report_delivery_allowed_to_software_execution"
  ],
  replay: {
    forbiddenInterpretations: [
      "rule_activation",
      "memory_write",
      "software_execution",
      "external_fetch",
      "technology_acceptance",
      "packaging_unlock",
      "goal_completion"
    ]
  },
  locks: {
    reviewOnly: true,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    packagingUnlocked: false,
    deliveryGateOpen: false
  }
});
const ruleDslRollbackPointPath = join(smokeRoot, "rules", "retained-rule-dsl-rollback-point");
mkdirSync(ruleDslRollbackPointPath, { recursive: true });
const ruleDslDeliveryGateAuditWithRollbackPath = readJson(ruleDslDeliveryGateAuditPath);
ruleDslDeliveryGateAuditWithRollbackPath.evidenceChain = ruleDslDeliveryGateAuditWithRollbackPath.evidenceChain.map((item) =>
  item.step === "retained_rollback_point"
    ? {
        ...item,
        path: ruleDslRollbackPointPath,
        format: "transparent_ai_rollback_point_result_v1",
        hash: "smoke-retained-rule-dsl-rollback-point"
      }
    : item
);
const ruleDslDeliveryGateAuditWithRollbackPathPath = writeJson(
  join(smokeRoot, "rules", "rag-delivery-gate-audit-trail-with-rollback-path.json"),
  ruleDslDeliveryGateAuditWithRollbackPath
);

const finalTeacherReceiptValidationPath = writeJson(join(smokeRoot, "teacher", "final-teacher-acceptance-receipt-validation.json"), {
  ok: true,
  format: "transparent_ai_original_goal_final_teacher_acceptance_receipt_validation_v1",
  status: "validated_ready_for_final_completion_gate",
  validationDecision: "teacher_acceptance_ready_for_final_completion_gate",
  readyForFinalCompletionGate: true,
  blockers: [],
  locks: {
    reviewOnly: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

function runGate(name, extraArgs = [], options = {}) {
  const includeRuleDslAudit = options.includeRuleDslAudit !== false;
  const ruleDslAuditPath = options.ruleDslAuditPath || ruleDslDeliveryGateAuditWithRollbackPathPath;
  const selectedSketchAuditPath = options.sketchAuditPath || sketchAuditPath;
  const selectedSpatialValidationPath = options.spatialValidationPath || spatialValidationPath;
  const selectedReadinessPackagePath = options.readinessPackagePath || readinessPackagePath;
  const selectedTeacherMethodContractValidationPath =
    options.teacherMethodContractValidationPath || teacherMethodContractReceiptValidationPath;
  const selectedTeacherMethodReuseValidationPath =
    options.teacherMethodReuseValidationPath || teacherMethodReuseResultProofValidationPath;
  const selectedIntegratedEvidenceGatePath = options.integratedEvidenceGatePath || integratedEvidenceGatePath;
  return runScript("validate-original-goal-final-completion-gate.mjs", [
    "--completion-blocker-matrix",
    matrixPath,
    "--low-token-coverage-gate",
    coverageGatePath,
    ...(options.includeReadinessPackage === false
      ? []
      : ["--real-local-readiness-package", selectedReadinessPackagePath]),
    ...(options.includeTeacherMethodEvidence === false
      ? []
      : [
          "--teacher-method-contract-receipt-validation",
          selectedTeacherMethodContractValidationPath,
          "--teacher-method-reuse-result-proof-validation",
          selectedTeacherMethodReuseValidationPath
        ]),
    "--unattended-audit",
    unattendedAuditPath,
    "--sketch-implementation-audit",
    selectedSketchAuditPath,
    "--spatial-intent-receipt-validation",
    selectedSpatialValidationPath,
    "--execution-convergence-audit",
    executionAuditPath,
    "--integrated-evidence-gate",
    selectedIntegratedEvidenceGatePath,
    ...(includeRuleDslAudit ? ["--rule-dsl-delivery-gate-audit", ruleDslAuditPath] : []),
    "--output-dir",
    join(smokeRoot, name),
    ...extraArgs
  ]);
}

const missingTeacherGateResult = runGate("missing-final-teacher-receipt-validation");
const missingTeacherGate = readJson(missingTeacherGateResult.gatePath);
const missingRuleDslAuditGateResult = runGate(
  "missing-rule-dsl-delivery-gate-audit",
  ["--final-teacher-receipt-validation", finalTeacherReceiptValidationPath],
  { includeRuleDslAudit: false }
);
const missingRuleDslAuditGate = readJson(missingRuleDslAuditGateResult.gatePath);
const missingRuleDslRollbackPathGateResult = runGate(
  "missing-rule-dsl-retained-rollback-path",
  ["--final-teacher-receipt-validation", finalTeacherReceiptValidationPath],
  { ruleDslAuditPath: ruleDslDeliveryGateAuditPath }
);
const missingRuleDslRollbackPathGate = readJson(missingRuleDslRollbackPathGateResult.gatePath);
const missingReadinessPackageGateResult = runGate(
  "missing-real-local-non-cad-readiness-package",
  ["--final-teacher-receipt-validation", finalTeacherReceiptValidationPath],
  { includeReadinessPackage: false }
);
const missingReadinessPackageGate = readJson(missingReadinessPackageGateResult.gatePath);
const cadOnlyReadinessGateResult = runGate(
  "cad-only-readiness-package-blocked",
  ["--final-teacher-receipt-validation", finalTeacherReceiptValidationPath],
  { readinessPackagePath: cadOnlyReadinessPackagePath }
);
const cadOnlyReadinessGate = readJson(cadOnlyReadinessGateResult.gatePath);
const missingRouteReadinessGateResult = runGate(
  "missing-real-local-source-route-blocked",
  ["--final-teacher-receipt-validation", finalTeacherReceiptValidationPath],
  { readinessPackagePath: missingRouteReadinessPackagePath }
);
const missingRouteReadinessGate = readJson(missingRouteReadinessGateResult.gatePath);
const missingTeacherMethodEvidenceGateResult = runGate(
  "missing-teacher-method-adaptation-proof",
  ["--final-teacher-receipt-validation", finalTeacherReceiptValidationPath],
  { includeTeacherMethodEvidence: false }
);
const missingTeacherMethodEvidenceGate = readJson(missingTeacherMethodEvidenceGateResult.gatePath);
const missingIntegratedTeacherMethodGateResult = runGate(
  "missing-integrated-teacher-method-evidence",
  ["--final-teacher-receipt-validation", finalTeacherReceiptValidationPath],
  { integratedEvidenceGatePath: missingTeacherMethodIntegratedEvidenceGatePath }
);
const missingIntegratedTeacherMethodGate = readJson(missingIntegratedTeacherMethodGateResult.gatePath);
const missingTeacherMethodReuseImprovementGateResult = runGate(
  "missing-teacher-method-reuse-improvement-proof",
  ["--final-teacher-receipt-validation", finalTeacherReceiptValidationPath],
  { teacherMethodReuseValidationPath: missingImprovementTeacherMethodReuseValidationPath }
);
const missingTeacherMethodReuseImprovementGate = readJson(missingTeacherMethodReuseImprovementGateResult.gatePath);
const missingSpatialDimensionsGateResult = runGate(
  "missing-spatial-2d-perspective-3d-dimensions",
  ["--final-teacher-receipt-validation", finalTeacherReceiptValidationPath],
  { spatialValidationPath: missingSpatialDimensionsValidationPath }
);
const missingSpatialDimensionsGate = readJson(missingSpatialDimensionsGateResult.gatePath);
const missingIntegratedVoiceGateResult = runGate(
  "missing-integrated-voice-text-numbered-requirement",
  ["--final-teacher-receipt-validation", finalTeacherReceiptValidationPath],
  { integratedEvidenceGatePath: missingVoiceIntegratedEvidenceGatePath }
);
const missingIntegratedVoiceGate = readJson(missingIntegratedVoiceGateResult.gatePath);
const readyGateResult = runGate("ready-with-final-teacher-receipt-validation", [
  "--final-teacher-receipt-validation",
  finalTeacherReceiptValidationPath
]);
const readyGate = readJson(readyGateResult.gatePath);
const readyGateWithSketchPackageResult = runGate(
  "ready-with-formal-sketch-audit-package",
  ["--final-teacher-receipt-validation", finalTeacherReceiptValidationPath],
  { sketchAuditPath: sketchAuditPackagePath }
);
const readyGateWithSketchPackage = readJson(readyGateWithSketchPackageResult.gatePath);
const readyHtml = readFileSync(readyGateResult.htmlPath, "utf8");
const readyReadme = readFileSync(readyGateResult.readmePath, "utf8");
const mcpReadyGateResult = await callAdvancedFinalCompletionGate();
const mcpReadyGate = readJson(mcpReadyGateResult.result.gatePath);
const advancedNames = mcpReadyGateResult.list.tools.map((tool) => tool.name);
const defaultTeachApprenticeGateCard = await callDefaultTeachApprenticeFinalCompletionGate();
const defaultTeachApprenticeGate = readJson(defaultTeachApprenticeGateCard.originalGoalFinalCompletionGate.gatePath);

const checks = [
  check(
    "Final completion gate blocks when final teacher acceptance validation is missing",
    missingTeacherGate.status === "blocked_before_original_goal_completion_claim" &&
      missingTeacherGate.readyForCompletionClaim === false &&
      missingTeacherGate.blockers.includes("explicit_final_teacher_acceptance") &&
      missingTeacherGate.counts.blockedLanes === 1,
    missingTeacherGateResult.gatePath
  ),
  check(
    "Final completion gate blocks when Rule DSL delivery-gate audit trail is missing",
    missingRuleDslAuditGate.status === "blocked_before_original_goal_completion_claim" &&
      missingRuleDslAuditGate.readyForCompletionClaim === false &&
      missingRuleDslAuditGate.blockers.includes("rule_dsl_validation_report_delivery_gate_audit") &&
      missingRuleDslAuditGate.counts.blockedLanes === 1,
    missingRuleDslAuditGateResult.gatePath
  ),
  check(
    "Final completion gate blocks when Rule DSL audit lacks an existing retained rollback point path",
    missingRuleDslRollbackPathGate.status === "blocked_before_original_goal_completion_claim" &&
      missingRuleDslRollbackPathGate.readyForCompletionClaim === false &&
      missingRuleDslRollbackPathGate.blockers.includes("rule_dsl_validation_report_delivery_gate_audit") &&
      missingRuleDslRollbackPathGate.lanes.some(
        (item) =>
          item.id === "rule_dsl_validation_report_delivery_gate_audit" &&
          item.ready === false &&
          item.evidence.includes("rollbackPathExists=false")
      ),
    missingRuleDslRollbackPathGateResult.gatePath
  ),
  check(
    "Final completion gate blocks when bounded real-local non-CAD/SolidWorks readiness evidence is missing",
    missingReadinessPackageGate.status === "blocked_before_original_goal_completion_claim" &&
      missingReadinessPackageGate.readyForCompletionClaim === false &&
      missingReadinessPackageGate.blockers.includes("real_local_non_cad_solidworks_scope_evidence") &&
      missingReadinessPackageGate.counts.blockedLanes === 1,
    missingReadinessPackageGateResult.gatePath
  ),
  check(
    "Final completion gate blocks when readiness evidence is CAD/SolidWorks only",
    cadOnlyReadinessGate.status === "blocked_before_original_goal_completion_claim" &&
      cadOnlyReadinessGate.readyForCompletionClaim === false &&
      cadOnlyReadinessGate.blockers.includes("real_local_non_cad_solidworks_scope_evidence") &&
      cadOnlyReadinessGate.lanes.some(
        (item) =>
          item.id === "real_local_non_cad_solidworks_scope_evidence" &&
          item.ready === false &&
          item.evidence.includes("nonCadSolidWorksCandidates=0") &&
          item.evidence.includes("scopeClaim=cad_solidworks_only_sample_not_enough_for_original_goal")
      ),
    cadOnlyReadinessGateResult.gatePath
  ),
  check(
    "Final completion gate blocks when real-local inventory rows are not fully routed to low-token sources",
    missingRouteReadinessGate.status === "blocked_before_original_goal_completion_claim" &&
      missingRouteReadinessGate.readyForCompletionClaim === false &&
      missingRouteReadinessGate.blockers.includes("real_local_non_cad_solidworks_scope_evidence") &&
      missingRouteReadinessGate.lanes.some(
        (item) =>
          item.id === "real_local_non_cad_solidworks_scope_evidence" &&
          item.ready === false &&
          item.evidence.includes("realLocalCandidateRows=4") &&
          item.evidence.includes("logSourceDiscoveryRows=3") &&
          item.evidence.includes("logSourceDiscoveryMissingRows=1") &&
          item.evidence.includes("allRowsHaveCurrentSourceRoute=false")
      ),
    missingRouteReadinessGateResult.gatePath
  ),
  check(
    "Final completion gate blocks when teacher-method adaptation proof is missing",
    missingTeacherMethodEvidenceGate.status === "blocked_before_original_goal_completion_claim" &&
      missingTeacherMethodEvidenceGate.readyForCompletionClaim === false &&
      missingTeacherMethodEvidenceGate.blockers.includes("teacher_method_adaptation_reuse_result_proof") &&
      missingTeacherMethodEvidenceGate.counts.blockedLanes === 1,
    missingTeacherMethodEvidenceGateResult.gatePath
  ),
  check(
    "Final completion gate blocks when integrated evidence gate lacks teacher-method adaptation evidence",
    missingIntegratedTeacherMethodGate.status === "blocked_before_original_goal_completion_claim" &&
      missingIntegratedTeacherMethodGate.readyForCompletionClaim === false &&
      missingIntegratedTeacherMethodGate.blockers.includes("teacher_method_adaptation_reuse_result_proof") &&
      missingIntegratedTeacherMethodGate.lanes.some(
        (item) =>
          item.id === "teacher_method_adaptation_reuse_result_proof" &&
          item.ready === false &&
          item.evidence.includes("integratedMethodStatus=missing")
      ),
    missingIntegratedTeacherMethodGateResult.gatePath
  ),
  check(
    "Final completion gate blocks when teacher-method reuse proof lacks observed improvement",
    missingTeacherMethodReuseImprovementGate.status === "blocked_before_original_goal_completion_claim" &&
      missingTeacherMethodReuseImprovementGate.readyForCompletionClaim === false &&
      missingTeacherMethodReuseImprovementGate.blockers.includes("teacher_method_adaptation_reuse_result_proof") &&
      missingTeacherMethodReuseImprovementGate.lanes.some(
        (item) =>
          item.id === "teacher_method_adaptation_reuse_result_proof" &&
          item.ready === false &&
          item.evidence.includes("teacherObservedImprovement=false") &&
          item.evidence.includes("readyForMediumRuntimeReuseGate=false")
      ),
    missingTeacherMethodReuseImprovementGateResult.gatePath
  ),
  check(
    "Final completion gate blocks when spatial receipt lacks reviewed 2D perspective or 3D depth evidence",
    missingSpatialDimensionsGate.status === "blocked_before_original_goal_completion_claim" &&
      missingSpatialDimensionsGate.readyForCompletionClaim === false &&
      missingSpatialDimensionsGate.blockers.includes("teacher_validated_spatial_intent_and_detail_logic") &&
      missingSpatialDimensionsGate.lanes.some(
        (item) =>
          item.id === "teacher_validated_spatial_intent_and_detail_logic" &&
          item.ready === false &&
          item.evidence.includes("hasPerspective=false") &&
          item.evidence.includes("has3DDepth=false")
      ),
    missingSpatialDimensionsGateResult.gatePath
  ),
  check(
    "Final completion gate blocks when integrated evidence gate lacks voice/text numbered target evidence",
    missingIntegratedVoiceGate.status === "blocked_before_original_goal_completion_claim" &&
      missingIntegratedVoiceGate.readyForCompletionClaim === false &&
      missingIntegratedVoiceGate.blockers.includes("voice_text_numbered_execution_capability_convergence") &&
      missingIntegratedVoiceGate.lanes.some(
        (item) =>
          item.id === "voice_text_numbered_execution_capability_convergence" &&
          item.ready === false &&
          item.evidence.includes("integratedVoiceStatus=missing")
      ),
    missingIntegratedVoiceGateResult.gatePath
  ),
  check(
    "Final completion gate only becomes ready when every objective lane and teacher receipt validation are ready",
    readyGate.status === "ready_for_goal_completion_claim_after_teacher_acceptance" &&
      readyGate.readyForCompletionClaim === true &&
      readyGate.completionDecision === "full_original_goal_evidence_ready_for_completion_claim" &&
      readyGate.counts.readyLanes === 10 &&
      readyGate.lanes.some((item) => item.id === "real_local_non_cad_solidworks_scope_evidence" && item.ready === true) &&
      readyGate.lanes.some((item) => item.id === "teacher_method_adaptation_reuse_result_proof" && item.ready === true) &&
      readyGate.lanes.some((item) => item.id === "rule_dsl_validation_report_delivery_gate_audit" && item.ready === true) &&
      readyGate.lanes.some(
        (item) =>
          item.id === "rule_dsl_validation_report_delivery_gate_audit" &&
          item.evidence.includes("rollbackPathExists=true")
      ) &&
      readyGate.blockers.length === 0,
    readyGateResult.gatePath
  ),
  check(
    "Final completion gate accepts the formal sketch implementation audit package format",
    readyGateWithSketchPackage.status === "ready_for_goal_completion_claim_after_teacher_acceptance" &&
      readyGateWithSketchPackage.readyForCompletionClaim === true &&
      readyGateWithSketchPackage.lanes.some(
        (item) =>
          item.id === "transparent_2d_perspective_3d_sketch_implementation" &&
          item.ready === true &&
          item.evidence.includes("status=sketch_demonstration_implemented_waiting_for_teacher_real_overlay_review")
      ) &&
      readyGateWithSketchPackage.locks.gateDoesNotRunCommands === true &&
      readyGateWithSketchPackage.locks.gateDoesNotExecuteTargetSoftware === true,
    readyGateWithSketchPackageResult.gatePath
  ),
  check(
    "Final completion gate preserves no-action locks and readable review artifacts",
    readyGate.locks.gateDoesNotRunCommands === true &&
      readyGate.locks.gateDoesNotExecuteTargetSoftware === true &&
      readyGate.locks.gateDoesNotCaptureScreenshots === true &&
      readyGate.locks.gateDoesNotWriteMemory === true &&
      readyGate.locks.nativeUniversalExecution === false &&
      existsSync(readyGateResult.htmlPath) &&
      existsSync(readyGateResult.readmePath) &&
      readyHtml.includes("Original Goal Final Completion Gate") &&
      readyHtml.includes("does not gather evidence, run commands") &&
      readyHtml.includes("rule_dsl_validation_report_delivery_gate_audit") &&
      readyReadme.includes("low-token all-software coverage"),
    readyGateResult.htmlPath
  ),
  check(
    "MCP advanced mode exposes and runs final completion gate with retained rollback evidence",
    mcpReadyGateResult.list.mode === "advanced" &&
      advancedNames.includes("validate_original_goal_final_completion_gate") &&
      mcpReadyGateResult.result.format === "transparent_ai_original_goal_final_completion_gate_result_v1" &&
      mcpReadyGateResult.result.status === "ready_for_goal_completion_claim_after_teacher_acceptance" &&
      mcpReadyGateResult.result.readyForCompletionClaim === true &&
      mcpReadyGate.lanes.some(
        (item) =>
          item.id === "rule_dsl_validation_report_delivery_gate_audit" &&
          item.ready === true &&
          item.evidence.includes("rollbackPathExists=true")
      ) &&
      mcpReadyGate.locks.gateDoesNotRunCommands === true &&
      mcpReadyGate.locks.gateDoesNotExecuteTargetSoftware === true &&
      mcpReadyGate.locks.gateDoesNotWriteMemory === true,
    mcpReadyGateResult.result.gatePath
  ),
  check(
    "Default teach_apprentice routes final completion gate without claiming completion",
    defaultTeachApprenticeGateCard.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultTeachApprenticeGateCard.status === "waiting_for_final_completion_gate_review" &&
      defaultTeachApprenticeGateCard.whatHappened.includes("final anti-false-completion gate") &&
      defaultTeachApprenticeGateCard.originalGoalFinalCompletionGate.readyForCompletionClaim === true &&
      defaultTeachApprenticeGateCard.originalGoalFinalCompletionGate.goalCompleteClaimedByThisTool === false &&
      defaultTeachApprenticeGateCard.originalGoalFinalCompletionGate.gateDoesNotRunCommands === true &&
      defaultTeachApprenticeGateCard.originalGoalFinalCompletionGate.gateDoesNotExecuteTargetSoftware === true &&
      defaultTeachApprenticeGateCard.originalGoalFinalCompletionGate.gateDoesNotWriteMemory === true &&
      defaultTeachApprenticeGate.readyForCompletionClaim === true &&
      defaultTeachApprenticeGate.locks.gateDoesNotRunCommands === true,
    defaultTeachApprenticeGateCard.originalGoalFinalCompletionGate.gatePath
  )
];

const passed = checks.filter((item) => item.pass).length;
const summary = {
  ok: passed === checks.length,
  format: "transparent_ai_original_goal_final_completion_gate_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  missingTeacherGatePath: missingTeacherGateResult.gatePath,
  missingReadinessPackageGatePath: missingReadinessPackageGateResult.gatePath,
  cadOnlyReadinessGatePath: cadOnlyReadinessGateResult.gatePath,
  missingTeacherMethodEvidenceGatePath: missingTeacherMethodEvidenceGateResult.gatePath,
  missingTeacherMethodReuseImprovementGatePath: missingTeacherMethodReuseImprovementGateResult.gatePath,
  missingSpatialDimensionsGatePath: missingSpatialDimensionsGateResult.gatePath,
  readyGatePath: readyGateResult.gatePath,
  readyGateWithSketchPackagePath: readyGateWithSketchPackageResult.gatePath,
  mcpReadyGatePath: mcpReadyGateResult.result.gatePath,
  defaultTeachApprenticeGatePath: defaultTeachApprenticeGateCard.originalGoalFinalCompletionGate.gatePath,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
