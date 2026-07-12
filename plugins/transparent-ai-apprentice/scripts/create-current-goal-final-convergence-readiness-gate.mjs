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
  const slug =
    String(value || "current-goal-final-convergence-readiness-gate")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84)
      .replace(/[.\s-]+$/g, "") || "current-goal-final-convergence-readiness-gate";
  return slug.replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, `${slug}-gate`);
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
    gateDoesNotRunCommands: true,
    gateDoesNotValidateReceipts: true,
    gateDoesNotCollectNewEvidence: true,
    gateDoesNotReadLogs: true,
    gateDoesNotCaptureScreenshots: true,
    gateDoesNotRegisterSchedule: true,
    gateDoesNotLaunchRunner: true,
    gateDoesNotExecuteTargetSoftware: true,
    gateDoesNotWriteMemory: true,
    gateDoesNotEnableRules: true,
    gateDoesNotDeleteRollbackPoints: true,
    finalTeacherAcceptanceRequired: true,
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

function laneReadiness(lane) {
  const evidence = lane.reviewEvidence || {};
  const hasEvidence = evidence.exists === true;
  const status = String(evidence.status || "");
  const reviewReadyStatus =
    status.includes("ready_for_teacher_review") ||
    status.includes("ready_for_final_teacher_acceptance_review") ||
    status.includes("ready_for_teacher_operational_review") ||
    status.includes("not_completion") ||
    status.includes("not_execution") ||
    status.includes("not_medium_runtime_reuse") ||
    status.includes("not_unattended_completion") ||
    status.includes("current_goal_not_complete");
  const explicitAcceptance = lane.id === "explicit_final_teacher_acceptance";
  return {
    laneId: lane.id,
    finalGateStatus: lane.status || "",
    finalGateReady: lane.ready === true,
    evidencePath: evidence.path || "",
    evidenceFormat: evidence.format || "",
    evidenceStatus: status,
    evidenceExists: hasEvidence,
    reviewEvidenceReady: explicitAcceptance ? false : hasEvidence && (lane.ready === true || reviewReadyStatus),
    completionReady: false,
    blocker: explicitAcceptance
      ? "Final teacher acceptance receipt is still missing."
      : hasEvidence
        ? "Evidence is ready for teacher review, but this gate cannot treat review evidence as final acceptance."
        : lane.blocker || "Missing review evidence."
  };
}

function writeReadme(path, gate) {
  const lines = [
    "# Current Goal Final Convergence Readiness Gate",
    "",
    `Status: ${gate.status}`,
    `Review evidence ready lanes: ${gate.summary.reviewEvidenceReadyLanes}/${gate.summary.totalLanes}`,
    `Completion ready lanes: ${gate.summary.completionReadyLanes}/${gate.summary.totalLanes}`,
    `Final completion allowed: ${gate.summary.finalGoalCompletionAllowed}`,
    "",
    "This gate re-evaluates the latest final review index after convergence audits. It is not an acceptance gate and does not weaken the original final completion gate.",
    "",
    "Lane readiness:",
    ...gate.lanes.map(
      (lane) =>
        `- ${lane.laneId}: reviewEvidenceReady=${lane.reviewEvidenceReady}; completionReady=${lane.completionReady}; evidence=${lane.evidenceFormat || "missing"}; status=${lane.evidenceStatus || lane.finalGateStatus}`
    ),
    "",
    "Remaining completion blockers:",
    ...gate.lanes.filter((lane) => !lane.completionReady).map((lane) => `- ${lane.laneId}: ${lane.blocker}`),
    "",
    "Locks:",
    ...Object.entries(gate.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, gate) {
  const rows = gate.lanes
    .map((lane) => {
      const href = fileHref(lane.evidencePath);
      return `<tr><td>${htmlEscape(lane.laneId)}</td><td>${lane.reviewEvidenceReady}</td><td>${lane.completionReady}</td><td>${htmlEscape(lane.evidenceFormat)}</td><td>${htmlEscape(lane.evidenceStatus)}</td><td>${href ? `<a href="${htmlEscape(href)}">open</a>` : ""}</td><td>${htmlEscape(lane.blocker)}</td></tr>`;
    })
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html><html><head><meta charset="utf-8"><title>Final Convergence Readiness Gate</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:1220px;margin:32px auto;padding:0 20px;line-height:1.45}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}code{background:#f3f3f3;padding:2px 4px}</style></head><body><h1>Current Goal Final Convergence Readiness Gate</h1><p>Status: <code>${htmlEscape(gate.status)}</code></p><p>Review evidence ready lanes: ${gate.summary.reviewEvidenceReadyLanes}/${gate.summary.totalLanes}. Completion ready lanes: ${gate.summary.completionReadyLanes}/${gate.summary.totalLanes}.</p><table><thead><tr><th>Lane</th><th>Review evidence ready</th><th>Completion ready</th><th>Evidence format</th><th>Evidence status</th><th>Evidence</th><th>Blocker</th></tr></thead><tbody>${rows}</tbody></table></body></html>\n`,
    "utf8"
  );
}

const repoRoot = resolve(argValue("--repo-root", process.cwd()));
const goal = argValue("--goal", "Re-evaluate current goal convergence audits for final teacher review readiness without claiming completion.");
const finalReviewIndexPath = resolve(
  argValue(
    "--final-review-index",
    newestFile(join(repoRoot, "artifacts", "current-goal-final-review-indexes"), "current-goal-final-review-index.json")
  )
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-final-convergence-readiness-gates")));
if (!finalReviewIndexPath || !existsSync(finalReviewIndexPath)) {
  throw new Error("Missing final review index. Generate current-goal-final-review-index first.");
}

const index = readJson(finalReviewIndexPath);
const lanes = (Array.isArray(index.lanes) ? index.lanes : []).map(laneReadiness);
const reviewEvidenceReadyLanes = lanes.filter((lane) => lane.reviewEvidenceReady).length;
const completionReadyLanes = lanes.filter((lane) => lane.completionReady).length;
const finalAcceptanceReady = lanes.find((lane) => lane.laneId === "explicit_final_teacher_acceptance")?.completionReady === true;
const gateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const gateDir = join(outputRoot, gateId);
mkdirSync(gateDir, { recursive: true });
const gatePath = join(gateDir, "current-goal-final-convergence-readiness-gate.json");
const receiptTemplatePath = join(gateDir, "current-goal-final-convergence-readiness-gate-receipt-template.json");
const readmePath = join(gateDir, "CURRENT_GOAL_FINAL_CONVERGENCE_READINESS_GATE_START_HERE.md");
const htmlPath = join(gateDir, "current-goal-final-convergence-readiness-gate.html");
const lockState = locks();
const gate = {
  ok: true,
  format: "transparent_ai_current_goal_final_convergence_readiness_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  goal,
  status: finalAcceptanceReady
    ? "unexpected_final_acceptance_present_still_requires_original_completion_gate"
    : "convergence_evidence_ready_for_final_teacher_review_not_completion",
  sourceFinalReviewIndex: finalReviewIndexPath,
  summary: {
    totalLanes: lanes.length,
    reviewEvidenceReadyLanes,
    missingReviewEvidenceLanes: lanes.length - reviewEvidenceReadyLanes,
    completionReadyLanes,
    finalTeacherAcceptanceReady: finalAcceptanceReady,
    finalGoalCompletionAllowed: false
  },
  lanes,
  blockedActions: [
    "claim_goal_complete_from_readiness_gate",
    "treat_convergence_audit_as_teacher_acceptance",
    "run_commands_from_readiness_gate",
    "validate_receipts_from_readiness_gate",
    "read_logs_from_readiness_gate",
    "capture_screenshots_from_readiness_gate",
    "register_schedule_from_readiness_gate",
    "execute_target_software_from_readiness_gate",
    "write_memory_from_readiness_gate",
    "enable_rules_from_readiness_gate",
    "delete_rollback_points_from_readiness_gate",
    "unlock_packaging_from_readiness_gate"
  ],
  completionBoundary: {
    goalComplete: false,
    finalGoalCompletionAllowed: false,
    reason:
      "Convergence audits can make lanes ready for teacher review, but final completion still requires explicit teacher acceptance and the original strict final completion gate."
  },
  paths: {
    gate: gatePath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  },
  locks: lockState
};

const receiptTemplate = {
  format: "transparent_ai_current_goal_final_convergence_readiness_gate_receipt_template_v1",
  gateId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "ready_for_lane_by_lane_review", "blocked"],
  forbiddenTeacherDecisions: [
    "accepted",
    "claim_complete",
    "execute_target_software",
    "read_logs_now",
    "capture_screenshot_now",
    "register_schedule",
    "write_memory",
    "enable_rule",
    "delete_rollback_points",
    "unlock_packaging"
  ],
  reviewRows: lanes.map((lane) => ({
    laneId: lane.laneId,
    reviewEvidenceReady: lane.reviewEvidenceReady,
    completionReady: lane.completionReady,
    teacherReviewed: false,
    teacherNote: ""
  })),
  locks: lockState
};

writeJson(gatePath, gate);
writeJson(receiptTemplatePath, receiptTemplate);
writeReadme(readmePath, gate);
writeHtml(htmlPath, gate);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_final_convergence_readiness_gate_result_v1",
      status: gate.status,
      gatePath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      summary: gate.summary,
      locks: gate.locks
    },
    null,
    2
  )
);
