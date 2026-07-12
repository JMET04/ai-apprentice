#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-objective-fulfillment-audit")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-objective-fulfillment-audit"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function refreshDirsUnder(root) {
  if (!existsSync(root)) return [];
  const found = [];
  const stack = [{ path: root, depth: 0 }];
  let visited = 0;
  while (stack.length && visited < 5000) {
    const current = stack.pop();
    visited += 1;
    const entries = readdirSync(current.path, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = join(current.path, entry.name);
      if (existsSync(join(dir, "original-goal-current-status-refresh.json"))) found.push(dir);
      if (current.depth < 4) stack.push({ path: dir, depth: current.depth + 1 });
    }
  }
  return found;
}

function latestRefreshPath() {
  const roots = [
    join(repoRoot, ".transparent-apprentice", "original-goal-current-status-refreshes"),
    join(repoRoot, "artifacts", "original-goal-current-status-refreshes")
  ];
  const candidates = roots.flatMap((root) => refreshDirsUnder(root));
  const latest = candidates.sort().at(-1);
  if (!latest) throw new Error("No original-goal-current-status-refresh.json found.");
  return join(latest, "original-goal-current-status-refresh.json");
}

function evidence(refreshedEvidence, paths, key, label) {
  return {
    key,
    label,
    value: refreshedEvidence?.[key] ?? paths?.[key] ?? null
  };
}

function allTrue(rows) {
  return rows.every((row) => row.value === true);
}

function buildRequirementRows(refresh) {
  const r = refresh.refreshedEvidence || {};
  const paths = refresh.paths || {};
  const locks = refresh.locks || {};

  const lowTokenEvidence = [
    evidence(r, paths, "realLocalAllSoftwareLowTokenReadinessPackageReady", "real local low-token readiness package exists"),
    evidence(r, paths, "logSourceDiscoveryLedgerReady", "log source discovery ledger exists"),
    evidence(r, paths, "allRowsHaveLogSourceRoute", "current rows have log or fallback source route"),
    evidence(r, paths, "originalGoalCapabilityMatrixCoverageStatus", "capability matrix covers low-token lane")
  ];
  const lowTokenRouteEvidenceReady =
    allTrue(lowTokenEvidence.slice(0, 3)) &&
    r.originalGoalCapabilityMatrixCoverageStatus === "covered_review_only_capability_matrix";
  const lowTokenCoverageGateComplete =
    r.originalGoalLowTokenCoverageCompletionGateCanClaimOriginalGoalComplete === true &&
    r.originalGoalLowTokenCoverageCompletionGateCoverageReadyForFinalTeacherReview === true;
  const lowTokenOperationalCompletionProven =
    lowTokenRouteEvidenceReady &&
    lowTokenCoverageGateComplete &&
    Number(r.allSoftwareUnattendedLearningAuditRemainingGaps || 0) === 0 &&
    locks.scheduledTaskRegistered === true &&
    locks.runnerLaunched === true;

  const teacherMethodEvidence = [
    evidence(r, paths, "originalGoalIntegratedControlFlowReviewOnly", "integrated flow keeps teacher-method review-only route"),
    evidence(r, paths, "teacherActionShortlistRouterReceiptReady", "short teacher action router receipt is ready"),
    evidence(r, paths, "nonExpertEngineeringVoiceControlCapabilityReady", "non-expert voice/text control workbench is ready"),
    evidence(r, paths, "parametricFeatureDataLogicLearningReady", "teacher-taught detail/data logic kit is ready")
  ];

  const transparentSketchEvidence = [
    evidence(r, paths, "transparentSketch2DPerspective3DImplemented", "2D perspective 3D sketch implementation audit is present"),
    evidence(r, paths, "transparentSketchDepthDemonstrationRehearsalReady", "transparent sketch depth rehearsal is ready"),
    evidence(r, paths, "transparentSketchDepthRehearsalReviewReceiptBuilderReady", "teacher review receipt builder is ready"),
    evidence(
      r,
      paths,
      "transparentSketchDepthRehearsalReviewReceiptValidationWaitingForTeacher",
      "depth rehearsal review is waiting for teacher decision"
    )
  ];
  const transparentSketchImplementationEvidenceReady = allTrue(transparentSketchEvidence.slice(0, 3));
  const teacherSpatialEvidenceRows = [
    evidence(r, paths, "spatialIntentEvidenceReceiptValidationReady", "teacher-exported spatial intent receipt validation is ready"),
    evidence(r, paths, "spatialIntentEvidenceReceiptValidationHas2D", "teacher-exported spatial evidence has reviewed 2D position"),
    evidence(r, paths, "spatialIntentEvidenceReceiptValidationHasPerspective", "teacher-exported spatial evidence has reviewed perspective relation"),
    evidence(r, paths, "spatialIntentEvidenceReceiptValidationHas3DDepth", "teacher-exported spatial evidence has reviewed 3D depth"),
    evidence(r, paths, "spatialIntentEvidenceReceiptValidationDetailLogicReady", "teacher-exported spatial evidence has reviewed detail logic")
  ];
  const teacherSpatialEvidenceReady = allTrue(teacherSpatialEvidenceRows);

  const executionEvidence = [
    evidence(r, paths, "executionApprovedGateCommandBuilderReady", "approved execution command builder is ready"),
    evidence(r, paths, "executionApprovedGateRunnerCommandReady", "approved execution runner command template exists"),
    { key: "scheduledTaskRegistered", label: "scheduled task registered", value: locks.scheduledTaskRegistered === true },
    { key: "runnerLaunched", label: "runner launched", value: locks.runnerLaunched === true },
    { key: "softwareActionsExecuted", label: "software actions executed", value: locks.softwareActionsExecuted === true },
    {
      key: "targetSoftwareCommandsExecuted",
      label: "target software commands executed",
      value: locks.targetSoftwareCommandsExecuted === true
    },
    { key: "memoryWritten", label: "durable memory written from reviewed outcome", value: locks.memoryWritten === true }
  ];

  return [
    {
      id: "all_software_low_token_learning",
      requested:
        "All software on this computer can learn from logs or low-token fallback signals, not only CAD/SolidWorks.",
      status:
        lowTokenOperationalCompletionProven
          ? "operational_completion_proven"
          : lowTokenRouteEvidenceReady
            ? "review_only_route_evidence_ready_waiting_for_coverage_contracts_teacher_receipts_and_runner"
            : "review_only_partial_waiting_for_full_coverage_or_teacher_exclusions",
      provenNow: lowTokenOperationalCompletionProven,
      missingBeforeCompletion: [
        r.allSoftwareLogSourceDiscoveryComplete === true
          ? ""
          : "allSoftwareLogSourceDiscoveryComplete is not true for the current refresh",
        lowTokenCoverageGateComplete
          ? ""
          : `low-token coverage completion gate is not satisfied: ${
              r.originalGoalLowTokenCoverageCompletionGateStatus || "missing_or_not_ready"
            }`,
        Number(r.originalGoalLowTokenCoverageWaitingRowCockpitBlockedRows || 0) === 0
          ? ""
          : `${Number(r.originalGoalLowTokenCoverageWaitingRowCockpitBlockedRows || 0)} low-token coverage rows still need compact evidence or teacher review`,
        r.originalGoalLowTokenCoverageDossierReceiptValidationDecision === "ready_for_follow_up" ||
        r.originalGoalLowTokenCoverageDossierReceiptValidationDecision === "ready_for_final_review"
          ? ""
          : "teacher low-token coverage dossier receipt is not ready for follow-up or final review",
        Number(r.allSoftwareUnattendedLearningAuditRemainingGaps || 0) === 0
          ? ""
          : "unattended all-software learning audit still has remaining gaps",
        locks.scheduledTaskRegistered === true ? "" : "no teacher-confirmed recurring monitor registration is proven",
        locks.runnerLaunched === true ? "" : "no runner launch/output witness is proven"
      ].filter(Boolean),
      evidence: lowTokenEvidence
    },
    {
      id: "adapt_any_teacher_learning_method",
      requested: "The apprentice adapts to different teachers' learning methods instead of using one fixed workflow.",
      status: allTrue(teacherMethodEvidence.slice(0, 3))
        ? "review_only_method_route_ready_waiting_for_teacher_receipts"
        : "missing_teacher_method_route_evidence",
      provenNow: allTrue(teacherMethodEvidence.slice(0, 3)),
      missingBeforeCompletion: [
        "a teacher-filled method/profile receipt for the current teacher",
        "a confirmed reuse result proving the chosen method improved the next run"
      ],
      evidence: teacherMethodEvidence
    },
    {
      id: "transparent_mask_2d_perspective_3d_depth_understanding",
      requested:
        "Teacher can draw on a transparent mask, and the apprentice understands position, perspective, and 3D depth before action.",
      status: transparentSketchImplementationEvidenceReady && teacherSpatialEvidenceReady
        ? "teacher_validated_spatial_understanding_ready_for_later_execution_gate"
        : transparentSketchImplementationEvidenceReady
          ? "implementation_ready_but_waiting_for_teacher_exported_spatial_evidence"
        : "missing_transparent_sketch_depth_evidence",
      provenNow: transparentSketchImplementationEvidenceReady && teacherSpatialEvidenceReady,
      missingBeforeCompletion: [
        transparentSketchImplementationEvidenceReady
          ? ""
          : "transparent sketch implementation/rehearsal evidence is not fully present",
        teacherSpatialEvidenceReady
          ? ""
          : "teacher-exported spatial evidence validation has not proven 2D position, perspective relation, 3D depth, and detail logic",
        r.transparentSketchDepthRehearsalReviewReceiptValidationWaitingForTeacher === true
          ? "teacher has not filled and validated the depth rehearsal review receipt"
          : "",
        "teacher-confirmed selected target must still feed a later execution gate before software action"
      ].filter(Boolean),
      evidence: [...transparentSketchEvidence, ...teacherSpatialEvidenceRows]
    },
    {
      id: "execute_in_target_software_after_confirmation",
      requested: "After understanding the teacher intent, execute the reviewed action in the target software.",
      status: locks.softwareActionsExecuted === true ? "one_controlled_execution_proven" : "not_executed_yet_by_design",
      provenNow: locks.softwareActionsExecuted === true && locks.targetSoftwareCommandsExecuted === true,
      missingBeforeCompletion: [
        "teacher must select one numbered target and approve one execution gate",
        "a retained rollback point must be cited by the approved runner",
        "post-action evidence and teacher outcome review must prove the action matched intent",
        "successful single-route execution still would not prove arbitrary native control of every software"
      ],
      evidence: executionEvidence
    }
  ];
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function writeHtml(path, audit) {
  const rows = audit.requirements
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.id)}</td>
        <td>${htmlEscape(row.status)}</td>
        <td>${htmlEscape(row.provenNow)}</td>
        <td>${htmlEscape(row.missingBeforeCompletion.join("; ") || "none")}</td>
      </tr>`
    )
    .join("\n");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Original Goal Objective Fulfillment Audit</title>
  <style>
    body { margin: 0; font: 14px/1.45 system-ui, sans-serif; color: #17202a; background: #f8fafc; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #d8e0ea; }
    th, td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid #e6ebf1; }
    code { background: #eef2f6; padding: 1px 4px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Original Goal Objective Fulfillment Audit</h1>
    <p>Status: <code>${htmlEscape(audit.status)}</code></p>
    <p>Completion allowed: <code>${htmlEscape(audit.completionAllowed)}</code></p>
    <p>Source refresh: <code>${htmlEscape(audit.sourceRefreshPath)}</code></p>
    <table>
      <thead><tr><th>Requirement</th><th>Status</th><th>Proven now</th><th>Missing before completion</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

const refreshPath = resolve(argValue("--refresh", "") || latestRefreshPath());
const refresh = readJson(refreshPath);
const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, ".transparent-apprentice", "original-goal-objective-fulfillment-audits"))
);
mkdirSync(outputRoot, { recursive: true });
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(refresh.refreshId || "original-goal")}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });

const requirements = buildRequirementRows(refresh);
const completeRequirements = requirements.filter((row) => row.provenNow && row.missingBeforeCompletion.length === 0);
const completionAllowed =
  requirements.length > 0 &&
  completeRequirements.length === requirements.length &&
  refresh.locks?.goalComplete === true &&
  refresh.locks?.accepted === true;
const audit = {
  format: "transparent_ai_original_goal_objective_fulfillment_audit_v1",
  auditId,
  sourceRefreshPath: refreshPath,
  status: completionAllowed ? "objective_fulfilled" : "objective_not_fulfilled_yet",
  completionAllowed,
  completeRequirementCount: completeRequirements.length,
  requirementCount: requirements.length,
  requirements,
  nextBestAction:
    "Use the teacher action shortlist receipt to choose exactly one review lane, then validate the teacher-filled receipt before any runner, registration, screenshot, memory, or target-software execution.",
  locks: {
    reviewOnly: true,
    auditDoesNotReadLogs: true,
    auditDoesNotCaptureScreenshots: true,
    auditDoesNotExecuteSoftware: true,
    auditDoesNotRegisterTask: true,
    auditDoesNotWriteMemory: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
};

const auditPath = join(auditDir, "original-goal-objective-fulfillment-audit.json");
const htmlPath = join(auditDir, "original-goal-objective-fulfillment-audit.html");
writeJson(auditPath, audit);
writeHtml(htmlPath, audit);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_objective_fulfillment_audit_result_v1",
      auditPath,
      htmlPath,
      status: audit.status,
      completionAllowed: audit.completionAllowed,
      completeRequirementCount: audit.completeRequirementCount,
      requirementCount: audit.requirementCount
    },
    null,
    2
  )
);
