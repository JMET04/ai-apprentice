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
    String(value || "teacher-method-convergence-audit")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84)
      .replace(/[.\s-]+$/g, "") || "teacher-method-convergence-audit";
  return slug.replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, `${slug}-audit`);
}

function exists(path) {
  return Boolean(path && existsSync(path) && statSync(path).isFile());
}

function statusRow(id, label, passed, evidence = "", blocker = "") {
  return { id, label, passed: Boolean(passed), evidence, blocker: passed ? "" : blocker };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return exists(path) ? pathToFileURL(path).href : "";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    auditDoesNotRunCommands: true,
    auditDoesNotReviewMethodForTeacher: true,
    auditDoesNotCreateTeacherReviewedContract: true,
    auditDoesNotValidateReceipt: true,
    auditDoesNotEnableRules: true,
    auditDoesNotWriteMemory: true,
    auditDoesNotRegisterMonitor: true,
    auditDoesNotReadLogs: true,
    auditDoesNotCaptureScreenshots: true,
    auditDoesNotExecuteTargetSoftware: true,
    auditDoesNotDeleteRollbackPoints: true,
    mediumRuntimeReuseEnabled: false,
    highReasoningRepairRequiredOnFailure: true,
    fullContinuousRecording: false,
    logContentsRead: false,
    screenshotsCaptured: false,
    scheduledTaskInstalled: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function sourceSummary(path, packet) {
  return {
    path: path || "",
    exists: Boolean(packet),
    format: packet?.format || "",
    status: packet?.status || "",
    goalComplete: packet?.locks?.goalComplete === true || packet?.goalComplete === true,
    mediumRuntimeReuseEnabled: packet?.locks?.mediumRuntimeReuseEnabled === true,
    writesMemory: packet?.locks?.memoryWritten === true,
    enablesRules: packet?.locks?.ruleEnabled === true || packet?.locks?.rulesEnabled === true,
    executesTargetSoftware: packet?.locks?.softwareActionsExecuted === true || packet?.locks?.targetSoftwareCommandsExecuted === true
  };
}

function writeReadme(path, audit) {
  const lines = [
    "# Teacher Method Convergence Audit",
    "",
    `Status: ${audit.status}`,
    `Passed checks: ${audit.summary.passedChecks}/${audit.summary.totalChecks}`,
    `Completion allowed: ${audit.summary.finalGoalCompletionAllowed}`,
    "",
    "This audit proves the teacher-method evidence has converged into a reviewable high-reasoning contract and medium-runtime reuse boundary. It does not approve the method, enable medium runtime, write memory, enable rules, or claim completion.",
    "",
    "Method modes:",
    ...audit.methodModes.map((mode) => `- ${mode}`),
    "",
    "Checks:",
    ...audit.checks.map((row) => `- ${row.passed ? "PASS" : "BLOCKED"} ${row.id}: ${row.label}${row.blocker ? ` (${row.blocker})` : ""}`),
    "",
    "Next teacher action:",
    audit.nextTeacherAction,
    "",
    "Blocked actions:",
    ...audit.blockedActions.map((item) => `- ${item}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, audit) {
  const rows = audit.checks
    .map(
      (row) =>
        `<tr><td>${htmlEscape(row.id)}</td><td>${row.passed ? "PASS" : "BLOCKED"}</td><td>${htmlEscape(row.label)}</td><td>${htmlEscape(row.blocker)}</td></tr>`
    )
    .join("\n");
  const links = audit.primaryOpenOrder
    .map((item) => {
      const href = fileHref(item.path);
      return `<li>${htmlEscape(item.label)}: ${href ? `<a href="${href}">${htmlEscape(item.path)}</a>` : htmlEscape(item.path || "missing")}</li>`;
    })
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html><html><head><meta charset="utf-8"><title>Teacher Method Convergence Audit</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:1120px;margin:32px auto;padding:0 20px;line-height:1.45}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}code{background:#f3f3f3;padding:2px 4px}</style></head><body><h1>Teacher Method Convergence Audit</h1><p>Status: <code>${htmlEscape(audit.status)}</code></p><p>Passed checks: ${audit.summary.passedChecks}/${audit.summary.totalChecks}. Completion allowed: ${audit.summary.finalGoalCompletionAllowed}</p><h2>Open Evidence</h2><ol>${links}</ol><h2>Method Modes</h2><pre>${htmlEscape(JSON.stringify(audit.methodModes, null, 2))}</pre><h2>Checks</h2><table><thead><tr><th>Id</th><th>Status</th><th>Check</th><th>Blocker</th></tr></thead><tbody>${rows}</tbody></table></body></html>\n`,
    "utf8"
  );
}

const repoRoot = resolve(argValue("--repo-root", process.cwd()));
const goal = argValue("--goal", "Audit teacher-method adaptation convergence before medium-runtime reuse.");
function resolveOptional(path) {
  const value = String(path || "").trim();
  return value ? resolve(value) : "";
}

const finalReviewPackPath = resolveOptional(
  argValue(
    "--final-review-pack",
    newestFile(join(repoRoot, "artifacts", "current-goal-teacher-method-final-review-packs"), "teacher-method-final-review-pack.json")
  )
);
const handoffPath = resolveOptional(
  argValue(
    "--teacher-method-handoff",
    newestFile(join(repoRoot, "artifacts", "current-goal-teacher-method-adaptation-handoffs"), "current-goal-teacher-method-adaptation-handoff.json")
  )
);
const contractReceiptValidationPath = resolveOptional(
  argValue(
    "--contract-receipt-validation",
    newestFile(join(repoRoot, "artifacts", "current-goal-teacher-method-contract-receipt-validations"), "teacher-method-execution-learning-contract-receipt-validation.json")
  )
);
const reuseProofBuilderPath = resolveOptional(
  argValue(
    "--reuse-proof-builder",
    newestFile(join(repoRoot, "artifacts", "current-goal-teacher-method-reuse-result-proof-builders"), "teacher-method-reuse-result-proof-builder.json")
  )
);
const reuseProofValidationPath = resolveOptional(
  argValue(
    "--reuse-proof-validation",
    newestFile(join(repoRoot, "artifacts", "current-goal-teacher-method-reuse-result-proof-validations"), "teacher-method-reuse-result-proof-receipt-validation.json")
  )
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-teacher-method-convergence-audits")));

const finalReviewPack = exists(finalReviewPackPath) ? readJson(finalReviewPackPath) : null;
const handoff = exists(handoffPath) ? readJson(handoffPath) : null;
const contractReceiptValidation = exists(contractReceiptValidationPath) ? readJson(contractReceiptValidationPath) : null;
const reuseProofBuilder = exists(reuseProofBuilderPath) ? readJson(reuseProofBuilderPath) : null;
const reuseProofValidation = exists(reuseProofValidationPath) ? readJson(reuseProofValidationPath) : null;

const methodModes = Array.isArray(finalReviewPack?.teacherMethodModes)
  ? finalReviewPack.teacherMethodModes
  : Array.isArray(handoff?.inferredTeacherModes)
    ? handoff.inferredTeacherModes
    : [];
const lanes = Array.isArray(handoff?.supportedMethodLanes) ? handoff.supportedMethodLanes : [];
const policy = handoff?.reasoningTierPolicy || {};
const sources = {
  finalReviewPack: sourceSummary(finalReviewPackPath, finalReviewPack),
  teacherMethodHandoff: sourceSummary(handoffPath, handoff),
  contractReceiptValidation: sourceSummary(contractReceiptValidationPath, contractReceiptValidation),
  reuseProofBuilder: sourceSummary(reuseProofBuilderPath, reuseProofBuilder),
  reuseProofValidation: sourceSummary(reuseProofValidationPath, reuseProofValidation)
};
const unsafeSource = Object.values(sources).some(
  (source) => source.goalComplete || source.mediumRuntimeReuseEnabled || source.writesMemory || source.enablesRules || source.executesTargetSoftware
);
const contractReceiptWaiting =
  contractReceiptValidation?.status === "teacher_method_contract_receipt_needs_teacher_review" ||
  contractReceiptValidation?.readyForReuseResultProof === true;
const reuseProofReadyOrWaiting = Boolean(reuseProofValidation) || reuseProofBuilder?.status === "waiting_for_confirmed_teacher_method_contract_receipt_validation";
const reuseProofCompleted = Boolean(reuseProofValidation && reuseProofValidation?.readyForMediumRuntimeReuseGate === true);

const checks = [
  statusRow("final_review_pack_present", "Teacher-method final review pack is present.", Boolean(finalReviewPack), finalReviewPackPath, "missing_final_review_pack"),
  statusRow("handoff_present", "Teacher-method adaptation handoff is present.", Boolean(handoff), handoffPath, "missing_teacher_method_handoff"),
  statusRow("method_modes_cover_multiple_teaching_styles", "At least nine teacher method modes are captured.", methodModes.length >= 9, String(methodModes.length), "insufficient_method_modes"),
  statusRow("supported_method_lanes_route_each_mode", "Supported method lanes include route and low-token evidence fields.", lanes.length >= 9 && lanes.every((lane) => lane.route && lane.lowTokenEvidence), String(lanes.length), "supported_method_lanes_incomplete"),
  statusRow("reasoning_tier_policy_defined", "High reasoning builds or repairs logic while medium reasoning is limited to reviewed workflow application.", Array.isArray(policy.highReasoningUseCases) && policy.highReasoningUseCases.length >= 3 && Array.isArray(policy.mediumReasoningUseCases) && policy.mediumReasoningUseCases.length >= 2, "reasoning tier policy", "reasoning_tier_policy_missing"),
  statusRow("medium_runtime_reuse_locked", "Medium-runtime reuse is locked until teacher-reviewed gates pass.", handoff?.locks?.mediumRuntimeReuseEnabled === false && finalReviewPack?.locks?.mediumRuntimeReuseEnabled === false && String(policy.downgradeAllowedOnlyAfter || "").includes("teacher-reviewed"), policy.downgradeAllowedOnlyAfter || "", "medium_runtime_reuse_not_locked"),
  statusRow("high_reasoning_repair_route_defined", "Teacher corrections, ambiguity, missing evidence, and failed validation route back to high reasoning repair.", String(policy.escalationBackToHighReasoningWhen || "").includes("teacher correction") && String(policy.escalationBackToHighReasoningWhen || "").includes("failed validator"), policy.escalationBackToHighReasoningWhen || "", "high_reasoning_repair_route_missing"),
  statusRow("contract_receipt_boundary_present", "Contract receipt validation exists or is waiting for teacher review, without enabling reuse.", Boolean(contractReceiptValidation) && contractReceiptWaiting, contractReceiptValidationPath, "contract_receipt_validation_missing"),
  statusRow("reuse_result_proof_boundary_present", "Reuse-result proof material exists or an explicit proof validation exists, without claiming medium-runtime reuse.", reuseProofReadyOrWaiting, reuseProofBuilderPath || reuseProofValidationPath, "reuse_result_proof_boundary_missing"),
  statusRow("review_only_locks_closed", "Sources do not enable rules, write memory, execute software, enable medium runtime, or claim completion.", !unsafeSource, "locks", "unsafe_source_lock_detected")
];

const failed = checks.filter((row) => !row.passed);
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });
const auditPath = join(auditDir, "teacher-method-convergence-audit.json");
const receiptTemplatePath = join(auditDir, "teacher-method-convergence-audit-receipt-template.json");
const readmePath = join(auditDir, "TEACHER_METHOD_CONVERGENCE_AUDIT_START_HERE.md");
const htmlPath = join(auditDir, "teacher-method-convergence-audit.html");
const lockState = locks();

const audit = {
  ok: failed.length === 0,
  format: "transparent_ai_teacher_method_convergence_audit_v1",
  auditId,
  createdAt: new Date().toISOString(),
  goal,
  status: failed.length
    ? "blocked_waiting_for_teacher_method_convergence_evidence"
    : "teacher_method_convergence_ready_for_teacher_review_not_medium_runtime_reuse",
  summary: {
    totalChecks: checks.length,
    passedChecks: checks.length - failed.length,
    blockedChecks: failed.length,
    methodModeCount: methodModes.length,
    supportedMethodLaneCount: lanes.length,
    reuseProofCompleted,
    finalGoalCompletionAllowed: false
  },
  methodModes,
  reasoningTierPolicy: {
    highReasoningUseCases: policy.highReasoningUseCases || [],
    mediumReasoningUseCases: policy.mediumReasoningUseCases || [],
    downgradeAllowedOnlyAfter: policy.downgradeAllowedOnlyAfter || "",
    escalationBackToHighReasoningWhen: policy.escalationBackToHighReasoningWhen || "",
    mediumRuntimeReuseEnabled: false
  },
  sourceEvidence: sources,
  checks,
  blockers: failed.map((row) => `${row.id}:${row.blocker}`),
  nextTeacherAction:
    "Review the teacher method profile and contract receipt, then provide a real before/after reuse-result proof. Medium-runtime reuse remains locked until proof validation passes.",
  primaryOpenOrder: [
    { label: "Teacher Method Final Review Pack", path: finalReviewPackPath },
    { label: "Teacher Method Handoff", path: handoffPath },
    { label: "Contract Receipt Validation", path: contractReceiptValidationPath },
    { label: "Reuse Result Proof Builder", path: reuseProofBuilderPath },
    { label: "Reuse Result Proof Validation", path: reuseProofValidationPath }
  ],
  blockedActions: [
    "claim_teacher_method_adaptation_complete_from_audit",
    "enable_medium_runtime_reuse_from_audit",
    "treat_method_profile_as_teacher_approval",
    "create_teacher_reviewed_contract_from_audit",
    "validate_receipt_from_audit",
    "enable_rule_from_audit",
    "write_memory_from_audit",
    "execute_target_software_from_audit",
    "delete_rollback_points_from_audit",
    "unlock_packaging_from_audit"
  ],
  completionBoundary: {
    goalComplete: false,
    finalGoalCompletionAllowed: false,
    reason:
      "This audit proves teacher-method convergence evidence only. Completion still requires teacher-reviewed method contract, validated reuse-result proof showing improvement, and a later gate before medium-runtime reuse."
  },
  paths: {
    audit: auditPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  },
  locks: lockState
};

const receiptTemplate = {
  format: "transparent_ai_teacher_method_convergence_audit_receipt_template_v1",
  auditId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "ready_for_method_contract_review", "blocked_needs_method_correction"],
  forbiddenTeacherDecisions: [
    "accepted",
    "claim_complete",
    "enable_medium_runtime_reuse",
    "enable_rule",
    "write_memory",
    "execute_target_software",
    "delete_rollback_points",
    "unlock_packaging"
  ],
  reviewRows: checks.map((row) => ({
    checkId: row.id,
    passed: row.passed,
    teacherReviewed: false,
    teacherNote: ""
  })),
  locks: lockState
};

writeJson(auditPath, audit);
writeJson(receiptTemplatePath, receiptTemplate);
writeReadme(readmePath, audit);
writeHtml(htmlPath, audit);

console.log(
  JSON.stringify(
    {
      ok: audit.ok,
      format: "transparent_ai_teacher_method_convergence_audit_result_v1",
      status: audit.status,
      auditPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      summary: audit.summary,
      blockers: audit.blockers,
      locks: audit.locks
    },
    null,
    2
  )
);
