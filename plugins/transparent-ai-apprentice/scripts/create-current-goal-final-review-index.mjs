#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function newestFile(root, fileName) {
  if (!existsSync(root)) return "";
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(root);
  return found.sort((a, b) => b.time - a.time)[0]?.path || "";
}

function slugify(value) {
  const slug = (
    String(value || "current-goal-final-review-index")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84)
      .replace(/[.\s-]+$/g, "") || "current-goal-final-review-index"
  );
  return slug.replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, `${slug}-index`);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    indexDoesNotRunCommands: true,
    indexDoesNotValidateReceipts: true,
    indexDoesNotReadLogs: true,
    indexDoesNotReadFullLogs: true,
    indexDoesNotCaptureScreenshots: true,
    indexDoesNotRegisterSchedule: true,
    indexDoesNotLaunchRunner: true,
    indexDoesNotExecuteTargetSoftware: true,
    indexDoesNotWriteMemory: true,
    indexDoesNotEnableRules: true,
    indexDoesNotDeleteRollbackPoints: true,
    logContentsRead: false,
    screenshotsCaptured: false,
    scheduledTaskInstalled: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function loadOptional(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return readJson(path);
  } catch {
    return null;
  }
}

function laneById(finalGate, id) {
  return (Array.isArray(finalGate?.lanes) ? finalGate.lanes : []).find((lane) => lane.id === id) || null;
}

function packSummary(path, statusField = "status") {
  const packet = loadOptional(path);
  return {
    path: path || "",
    exists: Boolean(packet),
    format: packet?.format || "",
    status: packet?.[statusField] || packet?.status || "",
    readme: packet?.paths?.readme || packet?.readmePath || "",
    html: packet?.paths?.html || packet?.htmlPath || "",
    receiptTemplate: packet?.paths?.receiptTemplate || packet?.receiptTemplatePath || "",
    goalComplete: packet?.locks?.goalComplete === true,
    executesTargetSoftware: packet?.locks?.softwareActionsExecuted === true || packet?.locks?.targetSoftwareCommandsExecuted === true
  };
}

function mapLaneToEvidence(lane, evidence) {
  const mapping = {
    all_software_low_token_coverage_final_review: evidence.lowTokenCoverageConvergenceAudit.exists
      ? evidence.lowTokenCoverageConvergenceAudit
      : evidence.lowTokenCoverageFinalReviewPack,
    teacher_method_adaptation_reuse_result_proof: evidence.teacherMethodConvergenceAudit.exists
      ? evidence.teacherMethodConvergenceAudit
      : evidence.teacherMethodFinalReviewPack,
    unattended_all_software_operational_evidence: evidence.operationalConvergenceAudit.exists
      ? evidence.operationalConvergenceAudit
      : evidence.operationalFinalReviewPack,
    teacher_validated_spatial_intent_and_detail_logic: evidence.spatialConvergenceAudit.exists
      ? evidence.spatialConvergenceAudit
      : evidence.spatialFinalReviewPack,
    voice_text_numbered_execution_capability_convergence: evidence.voiceNumberedConvergenceAudit.exists
      ? evidence.voiceNumberedConvergenceAudit
      : evidence.voiceControlSession,
    explicit_final_teacher_acceptance: evidence.finalTeacherAcceptanceReceipt.exists
      ? evidence.finalTeacherAcceptanceReceipt
      : evidence.finalTeacherAcceptanceReviewPack,
    transparent_2d_perspective_3d_sketch_implementation: evidence.spatialConvergenceAudit.exists
      ? evidence.spatialConvergenceAudit
      : evidence.spatialFinalReviewPack,
    real_local_non_cad_solidworks_scope_evidence: evidence.integratedEvidenceGate,
    rule_dsl_validation_report_delivery_gate_audit: evidence.integratedEvidenceGate,
    completion_blocker_matrix_present: evidence.finalCompletionGate
  };
  return mapping[lane?.id] || { path: "", exists: false, status: "" };
}

function writeReadme(path, index) {
  const lines = [
    "# Current Goal Final Review Index",
    "",
    `Status: ${index.status}`,
    `Final gate status: ${index.finalGate.status}`,
    `Ready lanes: ${index.summary.readyLanes}/${index.summary.totalLanes}`,
    `Blocked lanes: ${index.summary.blockedLanes}`,
    "",
    "This is the single index for the current goal. It points to the latest review packs and gates, but it is not completion evidence by itself.",
    "",
    "Open first:",
    "",
    ...index.primaryOpenOrder.map((item, indexNumber) => `${indexNumber + 1}. ${item.label}: ${item.openPath || item.path || "missing"}`),
    "",
    "Lane index:",
    "",
    ...index.lanes.map((lane) => `- ${lane.id}: ${lane.status}; ready=${lane.ready}; evidence=${lane.reviewEvidence.openPath || lane.reviewEvidence.path || "missing"}`),
    "",
    "Safety locks:",
    "",
    "- Does not run commands, validate receipts, read logs, capture screenshots, register schedules, launch runners, execute target software, write memory, enable rules, delete rollback points, or claim completion.",
    ""
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, index) {
  const laneRows = index.lanes
    .map(
      (lane) => `<tr>
        <td><code>${htmlEscape(lane.id)}</code></td>
        <td>${htmlEscape(lane.status)}</td>
        <td>${htmlEscape(String(lane.ready))}</td>
        <td>${lane.reviewEvidence.openPath ? `<a href="${htmlEscape(fileHref(lane.reviewEvidence.openPath))}">Open</a>` : htmlEscape(lane.reviewEvidence.path || "missing")}</td>
        <td>${htmlEscape(lane.blocker || "")}</td>
      </tr>`
    )
    .join("\n");
  const cardRows = index.primaryOpenOrder
    .map(
      (item) => `<article>
        <h2>${htmlEscape(item.label)}</h2>
        <p>Status: <code>${htmlEscape(item.status || "")}</code></p>
        <p>${item.openPath ? `<a href="${htmlEscape(fileHref(item.openPath))}">${htmlEscape(item.openPath)}</a>` : htmlEscape(item.path || "missing")}</p>
      </article>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Current Goal Final Review Index</title>
  <style>
    body { margin: 0; font: 14px/1.45 Segoe UI, Arial, sans-serif; color: #182433; background: #f6f8fb; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    section, article { background: #fff; border: 1px solid #d8e2ec; border-radius: 8px; padding: 16px; margin: 12px 0; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border-top: 1px solid #e5ebf2; padding: 8px; text-align: left; vertical-align: top; }
    pre, code { background: #edf3f8; border-radius: 5px; }
    a { overflow-wrap: anywhere; }
    .lock { color: #8a3b00; font-weight: 700; }
  </style>
</head>
<body>
<main>
  <h1>Current Goal Final Review Index</h1>
  <section>
    <p>Status: <code>${htmlEscape(index.status)}</code></p>
    <p>Ready lanes: ${htmlEscape(index.summary.readyLanes)} / ${htmlEscape(index.summary.totalLanes)}. Blocked lanes: ${htmlEscape(index.summary.blockedLanes)}.</p>
    <p class="lock">Review-only. This page does not execute, validate, read logs, write memory, enable rules, or claim completion.</p>
  </section>
  <section>
    <h2>Open First</h2>
    ${cardRows}
  </section>
  <section>
    <h2>Final Gate Lanes</h2>
    <table><thead><tr><th>Lane</th><th>Status</th><th>Ready</th><th>Review Evidence</th><th>Blocker</th></tr></thead><tbody>${laneRows}</tbody></table>
  </section>
</main>
</body>
</html>
`,
    "utf8"
  );
}

const repoRoot = process.cwd();
const goal = argValue("--goal", "Index the current goal final review packs without claiming completion.");
const finalGatePath = resolve(
  argValue(
    "--final-completion-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-final-completion-gates"), "original-goal-final-completion-gate.json")
  )
);
const integratedGatePath = resolve(
  argValue(
    "--integrated-evidence-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-integrated-evidence-gates"), "current-goal-integrated-evidence-gate.json")
  )
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-final-review-indexes")));
if (!existsSync(finalGatePath)) throw new Error(`Missing final completion gate: ${finalGatePath}`);

const evidence = {
  finalCompletionGate: packSummary(finalGatePath),
  integratedEvidenceGate: packSummary(integratedGatePath),
  lowTokenCoverageFinalReviewPack: packSummary(
    argValue(
      "--low-token-final-review-pack",
      newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-final-review-packs"), "low-token-coverage-final-review-pack.json")
    )
  ),
  lowTokenCoverageConvergenceAudit: packSummary(
    argValue(
      "--low-token-coverage-convergence-audit",
      newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-convergence-audits"), "low-token-coverage-convergence-audit.json")
    )
  ),
  teacherMethodFinalReviewPack: packSummary(
    argValue(
      "--teacher-method-final-review-pack",
      newestFile(join(repoRoot, "artifacts", "current-goal-teacher-method-final-review-packs"), "teacher-method-final-review-pack.json")
    )
  ),
  teacherMethodConvergenceAudit: packSummary(
    argValue(
      "--teacher-method-convergence-audit",
      newestFile(join(repoRoot, "artifacts", "current-goal-teacher-method-convergence-audits"), "teacher-method-convergence-audit.json")
    )
  ),
  operationalFinalReviewPack: packSummary(
    argValue(
      "--operational-final-review-pack",
      newestFile(join(repoRoot, "artifacts", "current-goal-operational-final-review-packs"), "operational-final-review-pack.json")
    )
  ),
  operationalConvergenceAudit: packSummary(
    argValue(
      "--operational-convergence-audit",
      newestFile(join(repoRoot, "artifacts", "current-goal-operational-convergence-audits"), "operational-convergence-audit.json")
    )
  ),
  spatialFinalReviewPack: packSummary(
    argValue(
      "--spatial-final-review-pack",
      newestFile(join(repoRoot, "artifacts", "current-goal-spatial-final-review-packs"), "spatial-final-review-pack.json")
    )
  ),
  spatialConvergenceAudit: packSummary(
    argValue(
      "--spatial-convergence-audit",
      newestFile(join(repoRoot, "artifacts", "current-goal-spatial-convergence-audits"), "spatial-convergence-audit.json")
    )
  ),
  physicalWorldSpatialGroundingPack: packSummary(
    argValue(
      "--physical-world-spatial-grounding-pack",
      newestFile(join(repoRoot, "artifacts", "physical-world-spatial-grounding-packs"), "physical-world-spatial-grounding-pack.json")
    )
  ),
  voiceControlSession: packSummary(
    argValue(
      "--voice-control-session",
      newestFile(join(repoRoot, "artifacts", "current-goal-voice-text-numbered-execution-sessions"), "engineering-voice-control-session.json")
    )
  ),
  voiceNumberedConvergenceAudit: packSummary(
    argValue(
      "--voice-numbered-convergence-audit",
      newestFile(join(repoRoot, "artifacts", "current-goal-voice-numbered-convergence-audits"), "voice-numbered-execution-convergence-audit.json")
    )
  ),
  finalTeacherAcceptanceReceipt: packSummary(
    argValue(
      "--final-teacher-acceptance-receipt",
      newestFile(join(repoRoot, "artifacts", "original-goal-final-teacher-acceptance-receipt-validations"), "original-goal-final-teacher-acceptance-receipt-validation.json")
    )
  ),
  finalTeacherAcceptanceReviewPack: packSummary(
    argValue(
      "--final-teacher-acceptance-review-pack",
      newestFile(join(repoRoot, "artifacts", "current-goal-final-teacher-acceptance-review-packs"), "current-goal-final-teacher-acceptance-review-pack.json")
    )
  ),
  sixRemainingTeacherReviewHandoff: packSummary(
    argValue(
      "--six-remaining-teacher-review-handoff",
      newestFile(join(repoRoot, "artifacts", "current-goal-six-remaining-teacher-review-handoffs"), "six-remaining-teacher-review-handoff.json")
    )
  ),
  executionGapReviewCockpit: packSummary(
    argValue(
      "--execution-gap-review-cockpit",
      newestFile(join(repoRoot, "artifacts", "all-software-execution-gap-review-cockpits"), "all-software-execution-gap-review-cockpit.json")
    )
  ),
  executionGapReviewCockpitShortlist: packSummary(
    argValue(
      "--execution-gap-review-cockpit-shortlist",
      newestFile(join(repoRoot, "artifacts", "all-software-execution-gap-review-cockpit-shortlists"), "all-software-execution-gap-review-cockpit-shortlist.json")
    )
  ),
  executionGapReviewCockpitReceiptValidation: packSummary(
    argValue(
      "--execution-gap-review-cockpit-receipt-validation",
      newestFile(join(repoRoot, "artifacts", "all-software-execution-gap-review-cockpit-receipt-validations"), "all-software-execution-gap-review-cockpit-receipt-validation.json")
    )
  ),
  executionGapReviewCockpitHandoffQueue: packSummary(
    argValue(
      "--execution-gap-review-cockpit-handoff-queue",
      newestFile(join(repoRoot, "artifacts", "all-software-execution-gap-review-cockpit-handoff-queues"), "all-software-execution-gap-review-cockpit-handoff-queue.json")
    )
  )
};

const finalGate = readJson(finalGatePath);
const finalGateLanes = Array.isArray(finalGate.lanes) ? finalGate.lanes : [];
const lockState = locks();
const reviewPackKeys = [
  "lowTokenCoverageFinalReviewPack",
  "teacherMethodFinalReviewPack",
  "operationalFinalReviewPack",
  "spatialFinalReviewPack"
];
const blockers = [];
for (const key of reviewPackKeys) {
  if (!evidence[key].exists) blockers.push(`${key}_missing`);
  if (evidence[key].goalComplete) blockers.push(`${key}_claims_goal_complete`);
  if (evidence[key].executesTargetSoftware) blockers.push(`${key}_executes_target_software`);
}

const lanes = finalGateLanes.map((lane) => {
  const reviewEvidence = mapLaneToEvidence(lane, evidence);
  const openPath = reviewEvidence.readme || reviewEvidence.html || reviewEvidence.path || "";
  return {
    id: lane.id,
    status: lane.status,
    ready: lane.ready === true,
    evidence: lane.evidence || "",
    blocker: lane.blocker || "",
    reviewEvidence: {
      path: reviewEvidence.path || "",
      openPath,
      exists: reviewEvidence.exists === true,
      status: reviewEvidence.status || "",
      format: reviewEvidence.format || ""
    }
  };
});

const readyLanes = lanes.filter((lane) => lane.ready).length;
const blockedLanes = lanes.filter((lane) => !lane.ready).length;
const indexId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const indexDir = join(outputRoot, indexId);
mkdirSync(indexDir, { recursive: true });
const indexPath = join(indexDir, "current-goal-final-review-index.json");
const receiptTemplatePath = join(indexDir, "current-goal-final-review-index-receipt-template.json");
const readmePath = join(indexDir, "CURRENT_GOAL_FINAL_REVIEW_INDEX_START_HERE.md");
const htmlPath = join(indexDir, "current-goal-final-review-index.html");

const primaryOpenOrder = [
  { label: "Final Completion Gate", ...evidence.finalCompletionGate },
  { label: "Six Remaining Teacher Review Handoff", ...evidence.sixRemainingTeacherReviewHandoff },
  { label: "Execution Gap Review Cockpit", ...evidence.executionGapReviewCockpit },
  { label: "Execution Gap Review Cockpit Shortlist", ...evidence.executionGapReviewCockpitShortlist },
  { label: "Execution Gap Review Cockpit Receipt Validation", ...evidence.executionGapReviewCockpitReceiptValidation },
  { label: "Execution Gap Review Cockpit Handoff Queue", ...evidence.executionGapReviewCockpitHandoffQueue },
  { label: "Low-Token Coverage Convergence Audit", ...evidence.lowTokenCoverageConvergenceAudit },
  { label: "Low-Token Coverage Review Pack", ...evidence.lowTokenCoverageFinalReviewPack },
  { label: "Operational Convergence Audit", ...evidence.operationalConvergenceAudit },
  { label: "Operational Review Pack", ...evidence.operationalFinalReviewPack },
  { label: "Spatial Convergence Audit", ...evidence.spatialConvergenceAudit },
  { label: "Spatial Review Pack", ...evidence.spatialFinalReviewPack },
  { label: "Physical World Spatial Grounding", ...evidence.physicalWorldSpatialGroundingPack },
  { label: "Teacher Method Convergence Audit", ...evidence.teacherMethodConvergenceAudit },
  { label: "Teacher Method Review Pack", ...evidence.teacherMethodFinalReviewPack },
  { label: "Voice/Text Numbered Convergence Audit", ...evidence.voiceNumberedConvergenceAudit },
  { label: "Voice/Text Numbered Control Session", ...evidence.voiceControlSession },
  { label: "Final Teacher Acceptance Review Pack", ...evidence.finalTeacherAcceptanceReviewPack },
  { label: "Final Teacher Acceptance Receipt Validation", ...evidence.finalTeacherAcceptanceReceipt }
].map((item) => ({ ...item, openPath: item.readme || item.html || item.path || "" }));

const receiptTemplate = {
  format: "transparent_ai_current_goal_final_review_index_receipt_template_v1",
  indexId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "ready_for_lane_review", "blocked"],
  forbiddenTeacherDecisions: [
    "accepted",
    "claim_complete",
    "run_now",
    "execute_target_software",
    "read_logs_now",
    "capture_screenshot_now",
    "register_schedule",
    "write_memory",
    "enable_rule",
    "delete_rollback_points",
    "unlock_packaging"
  ],
  laneReviewRows: lanes.map((lane) => ({
    laneId: lane.id,
    status: lane.status,
    ready: lane.ready,
    teacherDecision: "needs_teacher_review",
    evidenceReviewed: false,
    teacherNote: ""
  })),
  locks: lockState
};

const index = {
  ok: blockers.length === 0,
  format: "transparent_ai_current_goal_final_review_index_v1",
  indexId,
  createdAt: new Date().toISOString(),
  goal,
  status: blockers.length
    ? "blocked_waiting_for_review_pack_index_inputs"
    : "waiting_for_teacher_final_review_across_open_lanes",
  blockers,
  finalGate: {
    path: finalGatePath,
    status: finalGate.status || "",
    goalComplete: false
  },
  summary: {
    totalLanes: lanes.length,
    readyLanes,
    blockedLanes,
    reviewPackCount: reviewPackKeys.filter((key) => evidence[key].exists).length,
    requiredReviewPackCount: reviewPackKeys.length,
    sixRemainingTeacherReviewHandoffExists: evidence.sixRemainingTeacherReviewHandoff.exists === true,
    executionGapReviewCockpitExists: evidence.executionGapReviewCockpit.exists === true,
    executionGapReviewCockpitShortlistExists: evidence.executionGapReviewCockpitShortlist.exists === true,
    executionGapReviewCockpitReceiptValidationExists: evidence.executionGapReviewCockpitReceiptValidation.exists === true,
    executionGapReviewCockpitHandoffQueueExists: evidence.executionGapReviewCockpitHandoffQueue.exists === true,
    finalGoalCompletionAllowed: false
  },
  evidence,
  primaryOpenOrder,
  lanes,
  blockedActions: [
    "claim_goal_complete_from_index",
    "treat_review_pack_as_teacher_acceptance",
    "run_commands_from_index",
    "validate_receipts_from_index",
    "read_logs_from_index",
    "capture_screenshots_from_index",
    "register_schedule_from_index",
    "execute_target_software_from_index",
    "write_memory_from_index",
    "enable_rules_from_index",
    "delete_rollback_points_from_index",
    "unlock_packaging_from_index"
  ],
  completionBoundary: {
    goalComplete: false,
    finalGoalCompletionAllowed: false,
    reason:
      "This index only points to current evidence and review packs, including the six-remaining-software teacher handoff, execution-gap cockpit, execution-gap shortlist, default receipt validation, safe handoff queue, and physical-world spatial grounding as review evidence. The original goal still requires teacher-reviewed lane receipts, operational proof, spatial detail logic review, voice/numbered execution convergence, and final teacher acceptance."
  },
  paths: {
    index: indexPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  },
  locks: lockState
};

writeJson(indexPath, index);
writeJson(receiptTemplatePath, receiptTemplate);
writeReadme(readmePath, index);
writeHtml(htmlPath, index);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_final_review_index_result_v1",
      status: index.status,
      indexPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      summary: index.summary,
      blockers,
      locks: lockState
    },
    null,
    2
  )
);
