#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hashText(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  let parsed = null;
  let sourcePath = "";
  try {
    sourcePath = resolve(text);
    parsed = JSON.parse(readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    try {
      parsed = JSON.parse(text);
      sourcePath = "";
    } catch {
      parsed = null;
    }
  }
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return { value: parsed, path: sourcePath };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function locks() {
  return {
    reviewOnly: true,
    activePromotionReviewOnly: true,
    activePromotionPlanningApproved: false,
    activePromotionApplied: false,
    activeRulePackageCompiled: false,
    activePromotionAllowedHere: false,
    ruleEnabled: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const transitionInput = readJsonInput(
  argValue("--transition-package", argValue("--package", "")),
  "--transition-package",
  "transparent_ai_real_case_review_only_transition_package_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-active-promotion-review-builders"))
);
const transitionPackage = transitionInput.value;

if (
  transitionPackage.status !== "ready_for_teacher_review_only_transition_package_review" ||
  transitionPackage.ok !== true ||
  transitionPackage.appliedTransitionScope !== "staged_rule_copies_only" ||
  transitionPackage.sourceRuleFilesModified !== false ||
  transitionPackage.reviewOnlyRuleCount < 1 ||
  !transitionPackage.compiledReviewOnlyRulePackagePath ||
  transitionPackage.nextReview?.requiresSeparateActiveGate !== true ||
  transitionPackage.nextReview?.mayPromoteActiveRules !== false ||
  transitionPackage.nextReview?.mayCompileActiveRulePackage !== false ||
  transitionPackage.locks?.reviewOnlyRulePackageCompiled !== true ||
  transitionPackage.locks?.activeRulePackageCompiled !== false ||
  transitionPackage.locks?.ruleEnabled !== false ||
  transitionPackage.locks?.packagingUnlocked !== false
) {
  throw new Error("Transition package is not a locked review_only package ready for active promotion review.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${transitionPackage.caseType || "real_case"}`;
const builderDir = join(outRoot, builderId);
const builderPath = join(builderDir, "real-case-active-promotion-review-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "real-case-active-promotion-review-receipt-template.json");
const readmePath = join(builderDir, "REAL_CASE_ACTIVE_PROMOTION_REVIEW_START_HERE.md");
const htmlPath = join(builderDir, "real-case-active-promotion-review.html");
const transitionHash = hashText(JSON.stringify(transitionPackage));
const builderLocks = locks();

const allowedTeacherDecisions = [
  "approve_active_promotion_planning",
  "request_high_reasoning_repair",
  "request_more_evidence",
  "blocked",
  "needs_teacher_review"
];
const forbiddenTeacherDecisions = [
  "accepted",
  "activate_rule",
  "enable_rule",
  "promote_rule",
  "compile_active_package",
  "execute_software",
  "write_memory",
  "fetch_rag",
  "unlock_packaging",
  "claim_complete",
  "package_release"
];

const receiptTemplate = {
  format: "transparent_ai_real_case_active_promotion_review_receipt_v1",
  sourceTransitionPackageId: transitionPackage.transitionId,
  sourceTransitionPackagePath: transitionInput.path,
  sourceTransitionPackageHash: transitionHash,
  reportId: transitionPackage.reportId || "",
  caseType: transitionPackage.caseType || "",
  teacherDecision: "needs_teacher_review",
  transitionPackageReviewed: false,
  reviewOnlyRulesReviewed: false,
  sourceDraftDisabledPreservationReviewed: false,
  activePromotionPlanningOnlyConfirmed: false,
  activeCompilationStillSeparateConfirmed: false,
  separateExecutionGateRequiredConfirmed: false,
  teacherConfirmedNoExecution: false,
  rollbackRetained: false,
  blockedActionsConfirmed: true,
  teacherNotes: "",
  allowedTeacherDecisions,
  forbiddenTeacherDecisions,
  transitionSummary: {
    reviewOnlyRuleCount: transitionPackage.reviewOnlyRuleCount,
    stagedRulesDir: transitionPackage.stagedRulesDir,
    compiledReviewOnlyRulePackagePath: transitionPackage.compiledReviewOnlyRulePackagePath,
    sourceRuleFilesModified: false,
    activePromotionAllowedHere: false,
    activeRulePackageCompiled: false,
    requiresSeparateActiveGate: true
  },
  executeNow: false,
  reviewOnly: true,
  locks: builderLocks
};

const builder = {
  ok: true,
  format: "transparent_ai_real_case_active_promotion_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  status: "ready_for_teacher_real_case_active_promotion_review",
  sourceTransitionPackageId: transitionPackage.transitionId,
  sourceTransitionPackagePath: transitionInput.path,
  sourceTransitionPackageHash: transitionHash,
  allowedTeacherDecisions,
  forbiddenTeacherDecisions,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-real-case-active-promotion-review-receipt.mjs --transition-package "' +
    (transitionInput.path || "<real-case-review-only-transition-package.json>") +
    '" --receipt "<teacher-filled-real-case-active-promotion-review-receipt.json>"',
  locks: builderLocks,
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  }
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# Real-Case Active Promotion Review",
    "",
    "This is a teacher gate after a review_only transition package. It can only prepare active promotion planning for a later separate active compilation gate.",
    "",
    "Blocked outcomes: active package compilation, rule enablement, software execution, RAG fetch, memory write, packaging unlock, acceptance, and completion claims.",
    "",
    `Receipt template: ${receiptTemplatePath}`,
    `Next validator: ${builder.nextValidationCommand}`,
    ""
  ].join("\n"),
  "utf8"
);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Real-Case Active Promotion Review</title></head>
<body>
<h1>Real-Case Active Promotion Review</h1>
<p>This gate prepares active promotion planning only. It cannot compile active packages or execute software.</p>
<pre>${JSON.stringify(receiptTemplate, null, 2)}</pre>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_case_active_promotion_review_receipt_builder_result_v1",
      status: builder.status,
      builderPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      executeNow: false,
      locks: builderLocks
    },
    null,
    2
  )
);
