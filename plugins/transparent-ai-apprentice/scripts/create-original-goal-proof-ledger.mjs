#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-proof-ledger")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-proof-ledger"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function readOptionalJson(path) {
  return path && existsSync(path) ? readJson(path) : null;
}

function evidenceValue(refresh, key) {
  return refresh.refreshedEvidence?.[key] ?? refresh.paths?.[key] ?? refresh.locks?.[key] ?? null;
}

function findRequirement(audit, id) {
  return (audit?.requirements || []).find((row) => row.id === id) || null;
}

function findConfirmation(pack, itemId) {
  return (pack?.confirmationItems || []).find((item) => item.itemId === itemId) || null;
}

function proofState({ requiredTrue = [], requiredExecuted = [], missing = [] }) {
  if (requiredExecuted.some((value) => value !== true)) return "not_proven_requires_teacher_confirmed_execution";
  if (requiredTrue.every((value) => value === true) && missing.length === 0) return "proven_for_current_gate";
  if (requiredTrue.some((value) => value === true)) return "partially_proven_review_only";
  return "missing_required_evidence";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    ledgerDoesNotReadLogs: true,
    ledgerDoesNotCaptureScreenshots: true,
    ledgerDoesNotExecuteTargetSoftware: true,
    ledgerDoesNotRegisterSchedule: true,
    ledgerDoesNotLaunchRunner: true,
    ledgerDoesNotWriteMemory: true,
    ledgerDoesNotEnableRules: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    fullLogsRead: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function buildRows(refresh, audit, nextConfirmationPack) {
  const r = refresh.refreshedEvidence || {};
  const locksValue = refresh.locks || {};
  const lowTokenRequirement = findRequirement(audit, "all_software_low_token_learning");
  const teacherMethodRequirement = findRequirement(audit, "adapt_any_teacher_learning_method");
  const sketchRequirement = findRequirement(audit, "transparent_mask_2d_perspective_3d_depth_understanding");
  const executionRequirement = findRequirement(audit, "execute_in_target_software_after_confirmation");

  return [
    {
      id: "all_software_low_token_learning",
      requested:
        "电脑上所有软件都能自动读取日志或低 token fallback 信号学习，不能只覆盖 CAD/SolidWorks。",
      proofState: proofState({
        requiredTrue: [
          r.realLocalAllSoftwareLowTokenReadinessPackageReady === true,
          r.logSourceDiscoveryLedgerReady === true,
          r.allRowsHaveLogSourceRoute === true,
          r.originalGoalCapabilityMatrixCoverageStatus === "covered_review_only_capability_matrix"
        ],
        missing: lowTokenRequirement?.missingBeforeCompletion || []
      }),
      currentEvidence: {
        readinessPackageReady: r.realLocalAllSoftwareLowTokenReadinessPackageReady === true,
        logSourceDiscoveryLedgerReady: r.logSourceDiscoveryLedgerReady === true,
        allRowsHaveLogSourceRoute: r.allRowsHaveLogSourceRoute === true,
        capabilityMatrixCoverageStatus: r.originalGoalCapabilityMatrixCoverageStatus || "",
        allSoftwareLogSourceDiscoveryComplete: r.allSoftwareLogSourceDiscoveryComplete === true,
        unattendedLearningRemainingGaps: r.allSoftwareUnattendedLearningAuditRemainingGaps ?? null,
        compactMetadataRows: nextConfirmationPack?.counts?.compactMetadataRows ?? null,
        sensitiveManualRows: nextConfirmationPack?.counts?.sensitiveManualRows ?? null
      },
      missingProof: lowTokenRequirement?.missingBeforeCompletion || [],
      nextTeacherConfirmation:
        findConfirmation(nextConfirmationPack, "low-token-compact-evidence-metadata-only-rows") ||
        findConfirmation(nextConfirmationPack, "low-token-compact-evidence-10-metadata-only-rows"),
      completionEvidenceRequired: [
        "all reachable software either has a log source, privacy-safe metadata route, or teacher-approved exclusion",
        "recurring monitor registration/output witness is teacher-confirmed",
        "compact learning outputs are reviewed and converted only through approved rules or memory"
      ]
    },
    {
      id: "adapt_any_teacher_learning_method",
      requested: "系统能适应不同人的教学方式，而不是固定一种提示词或固定流程。",
      proofState: proofState({
        requiredTrue: [
          r.originalGoalIntegratedControlFlowReviewOnly === true,
          r.teacherActionShortlistRouterReceiptReady === true,
          r.nonExpertEngineeringVoiceControlCapabilityReady === true,
          r.parametricFeatureDataLogicLearningReady === true
        ],
        missing: teacherMethodRequirement?.missingBeforeCompletion || []
      }),
      currentEvidence: {
        integratedControlFlowReviewOnly: r.originalGoalIntegratedControlFlowReviewOnly === true,
        teacherActionShortlistRouterReceiptReady: r.teacherActionShortlistRouterReceiptReady === true,
        nonExpertEngineeringVoiceControlCapabilityReady: r.nonExpertEngineeringVoiceControlCapabilityReady === true,
        parametricFeatureDataLogicLearningReady: r.parametricFeatureDataLogicLearningReady === true,
        reasoningBudgetGovernorReady: r.tlclReasoningBudgetGovernorReady ?? null
      },
      missingProof: teacherMethodRequirement?.missingBeforeCompletion || [],
      nextTeacherConfirmation: findConfirmation(nextConfirmationPack, "teacher-action-router-5-current-gates"),
      completionEvidenceRequired: [
        "teacher-filled method/profile receipt for the current teacher",
        "validated correction proves the next run improved under that teacher's method",
        "wrong or uncertain workflow routes back to high-reasoning repair before medium-runtime reuse"
      ]
    },
    {
      id: "transparent_mask_spatial_depth_understanding",
      requested: "老师能在透明蒙版上画想法，系统能理解位置、透视、角度、二维/三维深度关系。",
      proofState: proofState({
        requiredTrue: [
          r.transparentSketchDepthDemonstrationRehearsalReady === true,
          r.transparentSketch2DPerspective3DImplemented === true,
          r.formalSpatialIntentEvidencePresent === true
        ],
        missing: sketchRequirement?.missingBeforeCompletion || []
      }),
      currentEvidence: {
        transparentSketchDepthDemonstrationRehearsalReady:
          r.transparentSketchDepthDemonstrationRehearsalReady === true,
        transparentSketch2DPerspective3DImplemented: r.transparentSketch2DPerspective3DImplemented === true,
        formalSpatialIntentEvidencePresent: r.formalSpatialIntentEvidencePresent === true,
        spatialIntentEvidenceReceiptValidationStatus: r.spatialIntentEvidenceReceiptValidationStatus || "",
        depthReceiptWaitingForTeacher:
          r.transparentSketchDepthRehearsalReviewReceiptValidationWaitingForTeacher === true
      },
      missingProof: sketchRequirement?.missingBeforeCompletion || [],
      nextTeacherConfirmation: findConfirmation(nextConfirmationPack, "transparent-overlay-real-teacher-packet"),
      completionEvidenceRequired: [
        "real teacher-exported transparent sketch packet, not a placeholder",
        "validated spatial intent receipt with teacher-confirmed selected numbered target",
        "detail/data logic validation blocks visual similarity-only generation"
      ]
    },
    {
      id: "execute_in_target_software_after_confirmation",
      requested: "理解老师意图后，必须在老师确认目标和回滚点后，才到目标软件里执行。",
      proofState: proofState({
        requiredTrue: [
          r.executionApprovedGateCommandBuilderReady === true,
          r.operationalRegistrationApprovedCommandBuilderReady === true
        ],
        requiredExecuted: [
          locksValue.softwareActionsExecuted === true,
          locksValue.targetSoftwareCommandsExecuted === true
        ],
        missing: executionRequirement?.missingBeforeCompletion || []
      }),
      currentEvidence: {
        executionApprovedGateCommandBuilderReady: r.executionApprovedGateCommandBuilderReady === true,
        operationalRegistrationApprovedCommandBuilderReady:
          r.operationalRegistrationApprovedCommandBuilderReady === true,
        scheduledTaskRegistered: locksValue.scheduledTaskRegistered === true,
        runnerLaunched: locksValue.runnerLaunched === true,
        softwareActionsExecuted: locksValue.softwareActionsExecuted === true,
        targetSoftwareCommandsExecuted: locksValue.targetSoftwareCommandsExecuted === true,
        rollbackPointRequiredBeforeExecution: true
      },
      missingProof: executionRequirement?.missingBeforeCompletion || [],
      nextTeacherConfirmation: findConfirmation(nextConfirmationPack, "action-logic-source-contract-review"),
      completionEvidenceRequired: [
        "teacher explicitly selects one numbered target",
        "teacher approves one execution gate with a retained rollback point",
        "separate runner output and post-action witness prove the software action matched intent",
        "one successful route still does not prove every software supports native universal execution"
      ]
    }
  ];
}

function writeHtml(path, ledger) {
  const rows = ledger.requirements
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.id)}</td>
        <td>${htmlEscape(row.requested)}</td>
        <td><code>${htmlEscape(row.proofState)}</code></td>
        <td>${htmlEscape(row.missingProof.join("; ") || "none")}</td>
        <td>${row.nextTeacherConfirmation?.openPath ? `<a href="${htmlEscape(fileHref(row.nextTeacherConfirmation.openPath))}">${htmlEscape(basename(row.nextTeacherConfirmation.openPath))}</a>` : ""}</td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Proof Ledger</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    code { background: #eef3f9; border-radius: 5px; padding: 2px 5px; }
  </style>
</head>
<body>
  <main>
    <h1>Original Goal Proof Ledger</h1>
    <p>Status: <code>${htmlEscape(ledger.status)}</code>; completion allowed: <code>${htmlEscape(ledger.completionAllowed)}</code></p>
    <p>This ledger maps the user's original requirements to current proof, missing proof, and the next teacher confirmation entry. It does not execute software, read logs, capture screenshots, register schedules, write memory, enable rules, or claim completion.</p>
    <table>
      <thead><tr><th>Requirement</th><th>Requested Meaning</th><th>Proof State</th><th>Missing Proof</th><th>Next Teacher Entry</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

function writeReadme(path, ledger) {
  const lines = [
    "# Original Goal Proof Ledger",
    "",
    `Status: ${ledger.status}`,
    `Completion allowed: ${ledger.completionAllowed}`,
    "",
    "This is a review-only proof ledger for the original user objective.",
    "It turns the broad goal into proof rows, missing evidence, and next teacher confirmation entries.",
    "",
    "Locked defaults: no log reads, no screenshots, no target software execution, no schedule registration, no runner launch, no memory writes, no rule enablement, no packaging unlock, no completion claim."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const statusRefreshPath = resolve(argValue("--status-refresh", ""));
if (!statusRefreshPath || !existsSync(statusRefreshPath)) throw new Error("--status-refresh is required");
const refresh = readJson(statusRefreshPath);
const objectiveAuditPath = resolve(argValue("--objective-audit", refresh.paths?.originalGoalObjectiveFulfillmentAudit || ""));
const nextConfirmationPackPath = resolve(argValue("--next-confirmation-pack", refresh.paths?.originalGoalNextConfirmationPack || ""));
const audit = readOptionalJson(objectiveAuditPath);
const nextConfirmationPack = readOptionalJson(nextConfirmationPackPath);
const goal = argValue("--goal", refresh.goal || "Original goal proof ledger.");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), "artifacts", "original-goal-proof-ledgers")));
mkdirSync(outputRoot, { recursive: true });
const ledgerId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const outDir = join(outputRoot, ledgerId);
mkdirSync(outDir, { recursive: true });

const requirements = buildRows(refresh, audit, nextConfirmationPack);
const completionAllowed =
  requirements.every((row) => row.proofState === "proven_for_current_gate") &&
  refresh.locks?.goalComplete === true &&
  refresh.locks?.accepted === true;
const missingProofCount = requirements.reduce((total, row) => total + row.missingProof.length, 0);
const ledger = {
  ok: true,
  format: "transparent_ai_original_goal_proof_ledger_v1",
  ledgerId,
  goal,
  status: completionAllowed ? "objective_proven_complete" : "objective_not_proven_complete",
  completionAllowed,
  sourceEvidence: {
    statusRefresh: statusRefreshPath,
    objectiveFulfillmentAudit: audit ? objectiveAuditPath : "",
    nextConfirmationPack: nextConfirmationPack ? nextConfirmationPackPath : ""
  },
  counts: {
    requirementCount: requirements.length,
    missingProofCount,
    notProvenCount: requirements.filter((row) => row.proofState !== "proven_for_current_gate").length,
    nextTeacherConfirmationCount: requirements.filter((row) => row.nextTeacherConfirmation).length
  },
  requirements,
  nextSafeAction:
    "Open the next confirmation pack, choose one teacher confirmation row, validate the teacher-filled receipt, and retain rollback points before any runner or target software path.",
  locks: locks(),
  paths: {
    ledger: join(outDir, "original-goal-proof-ledger.json"),
    html: join(outDir, "original-goal-proof-ledger.html"),
    readme: join(outDir, "ORIGINAL_GOAL_PROOF_LEDGER_START_HERE.md")
  }
};

writeFileSync(ledger.paths.ledger, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
writeHtml(ledger.paths.html, ledger);
writeReadme(ledger.paths.readme, ledger);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_proof_ledger_result_v1",
      ledgerPath: ledger.paths.ledger,
      htmlPath: ledger.paths.html,
      readmePath: ledger.paths.readme,
      status: ledger.status,
      missingProofCount,
      completionAllowed
    },
    null,
    2
  )
);
