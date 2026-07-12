import fs from "node:fs";
import path from "node:path";

type Check = { name: string; pass: boolean; evidence: string };

type SessionReceipt = {
  responseMode?: string;
  status?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  defaultSessionDecision?: string;
  sessionDecisionAllowedValues?: string[];
  facilitator?: { name?: string; role?: string; date?: string; environment?: string };
  tester?: { name?: string; role?: string; date?: string; environment?: string };
  sessionMaterials?: {
    sessionPlanPath?: string;
    testerRunbookPath?: string;
    feedbackReceiptTemplatePath?: string;
    startHerePath?: string;
  };
  launchPreflight?: {
    command?: string;
    evidencePath?: string;
    ranImmediatelyBeforeContact?: boolean | null;
    status?: string;
    passed?: number | null;
    total?: number | null;
  };
  sessionEvidence?: {
    publicBetaUrlOpened?: boolean | null;
    stableTaskRunCompleted?: boolean | null;
    publicTraceReviewed?: boolean | null;
    correctionSubmitted?: boolean | null;
    ruleProvenanceReviewed?: boolean | null;
    rerunCompleted?: boolean | null;
    manualTestHumanReviewSaved?: boolean | null;
    manualTestEvidencePath?: string;
    feedbackReceiptPath?: string;
    screenshotOrNotesPath?: string;
  };
  returnPipeline?: {
    verifyFeedbackCommand?: string;
    intakeFeedbackCommand?: string;
    verifyCollectionCommand?: string;
    followUpPlanCommand?: string;
    verifyFollowUpPlanCommand?: string;
    releaseReadinessCommand?: string;
    feedbackReceiptValidated?: boolean | null;
    feedbackReceiptIntaked?: boolean | null;
    followUpPlanRefreshed?: boolean | null;
  };
  blockers?: {
    blockingIssue?: string;
    confusingUx?: string;
    missingEvidence?: string;
    unsafeOrUnexpectedBehavior?: string;
    evidencePath?: string;
  };
  sessionDecision?: string;
  nextActionRecommendation?: string;
  locks?: {
    mustNotSaveAcceptanceFromReceipt?: boolean;
    mustNotEnableRules?: boolean;
    mustNotUnlockPackaging?: boolean;
    mustNotClaimReleaseReady?: boolean;
    mustNotAcceptRealModel?: boolean;
    mustNotResumeAllSoftwareObjective?: boolean;
  };
};
type ManualAcceptanceEvidence = {
  responseMode?: string;
  evidenceKind?: string;
  humanReviewed?: boolean;
  automationGenerated?: boolean;
  classificationReason?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  humanReviewEvidence?: {
    responseMode?: string;
    reviewerName?: string;
    attestation?: string;
    savedFrom?: string;
  };
  report?: {
    summary?: {
      readyForHumanTrial?: boolean;
      failed?: number;
      notRun?: number;
    };
    steps?: Array<{ status?: string; note?: string }>;
  };
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const defaultReceiptPath = path.join(artifactsDir, "public-beta-session-receipt.template.json");
const validationPath = path.join(artifactsDir, "public-beta-session-receipt-validation.json");
const allowedDecisions = ["ready_for_feedback_intake", "needs_fix_before_more_testers", "blocked"];

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseReceiptPath() {
  const receiptFlagIndex = process.argv.indexOf("--receipt");
  if (receiptFlagIndex >= 0) {
    const value = process.argv[receiptFlagIndex + 1];
    if (!value || value.startsWith("--")) throw new Error("Missing value for --receipt.");
    return path.resolve(process.cwd(), value);
  }
  const positional = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  return positional ? path.resolve(process.cwd(), positional) : defaultReceiptPath;
}

function parseOutputPath() {
  const outputFlagIndex = process.argv.indexOf("--out");
  if (outputFlagIndex >= 0) {
    const value = process.argv[outputFlagIndex + 1];
    if (!value || value.startsWith("--")) throw new Error("Missing value for --out.");
    return path.resolve(process.cwd(), value);
  }
  return validationPath;
}

function readReceipt(receiptPath: string): SessionReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(receiptPath, "utf8").replace(/^\uFEFF/, "")) as SessionReceipt;
  } catch {
    return null;
  }
}

function readJsonFile<T>(targetPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8").replace(/^\uFEFF/, "")) as T;
  } catch {
    return null;
  }
}

function resolveEvidencePath(receiptPath: string, evidencePath?: string) {
  if (!hasText(evidencePath)) return null;
  if (path.isAbsolute(evidencePath)) return evidencePath;

  const fromWorkspace = path.resolve(process.cwd(), evidencePath);
  if (fs.existsSync(fromWorkspace)) return fromWorkspace;

  return path.resolve(path.dirname(receiptPath), evidencePath);
}

function readManualAcceptanceEvidence(receiptPath: string, evidencePath?: string) {
  const resolvedPath = resolveEvidencePath(receiptPath, evidencePath);
  return {
    resolvedPath,
    evidence: resolvedPath ? readJsonFile<ManualAcceptanceEvidence>(resolvedPath) : null
  };
}

function sameText(left: unknown, right: unknown) {
  return hasText(left) && hasText(right) && left.trim().toLowerCase() === right.trim().toLowerCase();
}

function isRealHumanReviewEvidence(evidence: ManualAcceptanceEvidence | null, testerName: unknown) {
  const steps = evidence?.report?.steps ?? [];
  const failedSteps = steps.filter((step) => step.status === "failed");
  const notRunSteps = steps.filter((step) => !step.status || step.status === "not-run" || step.status === "not_run");

  return (
    evidence?.responseMode === "manual_acceptance_saved_receipt_json_v1" &&
    evidence.evidenceKind === "human_review" &&
    evidence.humanReviewed === true &&
    evidence.automationGenerated === false &&
    evidence.classificationReason === "valid_human_review_evidence" &&
    evidence.reviewOnly === true &&
    evidence.accepted === false &&
    evidence.packagingGated === true &&
    evidence.humanReviewEvidence?.responseMode === "manual_test_workbench_human_review_evidence_v1" &&
    evidence.humanReviewEvidence.attestation === "human-reviewed-manual-test-workbench" &&
    evidence.humanReviewEvidence.savedFrom === "manual-test-workbench" &&
    sameText(evidence.humanReviewEvidence.reviewerName, testerName) &&
    evidence.report?.summary?.readyForHumanTrial === true &&
    (evidence.report.summary.failed ?? 0) === 0 &&
    (evidence.report.summary.notRun ?? 0) === 0 &&
    steps.length > 0 &&
    failedSteps.length === 0 &&
    notRunSteps.length === 0 &&
    steps.every((step) => step.status === "passed" && hasText(step.note))
  );
}

function fileExists(relativePath: string, minBytes = 1) {
  const fullPath = path.join(process.cwd(), relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minBytes;
}

function containsForbiddenClaim(value: unknown): boolean {
  if (typeof value === "string") {
    return /accepted\s*=\s*true|packagingGated\s*=\s*false|releaseDecision\s*=\s*(release_ready|release_candidate)|allSoftwareObjective\s*=\s*active/i.test(value);
  }
  if (Array.isArray(value)) return value.some((item) => containsForbiddenClaim(item));
  if (value && typeof value === "object") return Object.values(value).some((item) => containsForbiddenClaim(item));
  return false;
}

function main() {
  const receiptPath = parseReceiptPath();
  const outputPath = parseOutputPath();
  const receipt = readReceipt(receiptPath);
  const checks: Check[] = [];
  const isTemplate = path.basename(receiptPath) === "public-beta-session-receipt.template.json";

  push(checks, "Session receipt JSON exists", Boolean(receipt), `path=${path.relative(process.cwd(), receiptPath)}`);
  push(
    checks,
    "Session receipt mode is recognized",
    receipt?.responseMode === "public_beta_session_receipt_json_v1",
    `responseMode=${receipt?.responseMode ?? "missing"}`
  );
  push(
    checks,
    "Session receipt stays in bounded beta scope",
    receipt?.productScope === "bounded_core_teaching_loop" &&
      receipt.allSoftwareObjective === "paused" &&
      receipt.releaseDecision === "do_not_release",
    `scope=${receipt?.productScope ?? "missing"}; allSoftware=${receipt?.allSoftwareObjective ?? "missing"}; release=${receipt?.releaseDecision ?? "missing"}`
  );
  push(
    checks,
    "Session receipt cannot unlock release boundaries",
    receipt?.reviewOnly === true &&
      receipt.accepted === false &&
      receipt.packagingGated === true &&
      receipt.canRelease === false &&
      receipt.canActivateRealModel === false &&
      receipt.locks?.mustNotSaveAcceptanceFromReceipt === true &&
      receipt.locks.mustNotEnableRules === true &&
      receipt.locks.mustNotUnlockPackaging === true &&
      receipt.locks.mustNotClaimReleaseReady === true &&
      receipt.locks.mustNotAcceptRealModel === true &&
      receipt.locks.mustNotResumeAllSoftwareObjective === true,
    `reviewOnly=${receipt?.reviewOnly ?? "missing"}; accepted=${receipt?.accepted ?? "missing"}; packagingGated=${receipt?.packagingGated ?? "missing"}; canRelease=${receipt?.canRelease ?? "missing"}`
  );
  push(
    checks,
    "Session receipt decision is constrained",
    Array.isArray(receipt?.sessionDecisionAllowedValues) &&
      allowedDecisions.every((decision) => receipt.sessionDecisionAllowedValues?.includes(decision)) &&
      allowedDecisions.includes(receipt.sessionDecision ?? "") &&
      receipt.defaultSessionDecision === "needs_fix_before_more_testers",
    `decision=${receipt?.sessionDecision ?? "missing"}; default=${receipt?.defaultSessionDecision ?? "missing"}`
  );
  push(
    checks,
    "Session receipt points at required beta materials",
    receipt?.sessionMaterials?.sessionPlanPath === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md" &&
      receipt.sessionMaterials.testerRunbookPath === "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md" &&
      receipt.sessionMaterials.feedbackReceiptTemplatePath ===
        "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json" &&
      receipt.sessionMaterials.startHerePath === "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md" &&
      fileExists(receipt.sessionMaterials.sessionPlanPath, 1000) &&
      fileExists(receipt.sessionMaterials.testerRunbookPath, 1000),
    `sessionPlan=${receipt?.sessionMaterials?.sessionPlanPath ?? "missing"}; runbook=${receipt?.sessionMaterials?.testerRunbookPath ?? "missing"}`
  );
  push(
    checks,
    "Session receipt requires live preflight and return-intake commands",
    receipt?.launchPreflight?.command === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
      receipt.launchPreflight.evidencePath === "artifacts/productization/public-beta-tester-session-preflight.json" &&
      receipt.returnPipeline?.verifyFeedbackCommand === "npm run verify:public-beta-feedback -- --receipt path/to/submitted-feedback.json" &&
      receipt.returnPipeline.intakeFeedbackCommand === "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json" &&
      receipt.returnPipeline.verifyCollectionCommand === "npm run verify:public-beta-feedback-collection" &&
      receipt.returnPipeline.followUpPlanCommand === "npm run plan:public-beta-follow-up" &&
      receipt.returnPipeline.verifyFollowUpPlanCommand === "npm run verify:public-beta-follow-up-plan" &&
      receipt.returnPipeline.releaseReadinessCommand === "npm run verify:product-release-readiness -- --allow-blocked",
    `preflight=${receipt?.launchPreflight?.command ?? "missing"}; intake=${receipt?.returnPipeline?.intakeFeedbackCommand ?? "missing"}`
  );
  push(
    checks,
    "Session receipt does not claim forbidden outcomes",
    Boolean(receipt) && !containsForbiddenClaim(receipt),
    "Scans receipt values for release, packaging, all-software, or acceptance claims."
  );

  if (isTemplate) {
    push(
      checks,
      "Template keeps unfilled fields neutral",
      receipt?.status === "not_filled_yet" &&
        receipt.facilitator?.name === "" &&
        receipt.tester?.name === "" &&
        receipt.launchPreflight?.ranImmediatelyBeforeContact === null &&
        receipt.sessionEvidence?.publicBetaUrlOpened === null &&
        receipt.returnPipeline?.feedbackReceiptValidated === null &&
        receipt.sessionEvidence?.feedbackReceiptPath === "",
      `status=${receipt?.status ?? "missing"}; facilitator=${receipt?.facilitator?.name ?? "missing"}; tester=${receipt?.tester?.name ?? "missing"}`
    );
  } else {
    push(
      checks,
      "Submitted session receipt has facilitator and tester identity",
      receipt?.status === "submitted" &&
        hasText(receipt.facilitator?.name) &&
        hasText(receipt.facilitator?.date) &&
        hasText(receipt.tester?.name) &&
        hasText(receipt.tester?.environment),
      `status=${receipt?.status ?? "missing"}; facilitator=${receipt?.facilitator?.name ?? "missing"}; tester=${receipt?.tester?.name ?? "missing"}`
    );
    push(
      checks,
      "Submitted session receipt records passed live preflight",
      receipt?.launchPreflight?.ranImmediatelyBeforeContact === true &&
        receipt.launchPreflight.status === "passed" &&
        Number(receipt.launchPreflight.passed ?? 0) > 0 &&
        receipt.launchPreflight.passed === receipt.launchPreflight.total,
      `status=${receipt?.launchPreflight?.status ?? "missing"}; checks=${receipt?.launchPreflight?.passed ?? "?"}/${receipt?.launchPreflight?.total ?? "?"}`
    );
    const evidence = receipt?.sessionEvidence;
    const manualEvidenceResult = readManualAcceptanceEvidence(receiptPath, evidence?.manualTestEvidencePath);
    const manualReviewEvidenceSaved =
      evidence?.manualTestHumanReviewSaved === true && isRealHumanReviewEvidence(manualEvidenceResult.evidence, receipt?.tester?.name);
    const manualReviewBlockedWithReason =
      receipt?.sessionDecision !== "ready_for_feedback_intake" &&
      (hasText(receipt?.blockers?.blockingIssue) || hasText(receipt?.blockers?.missingEvidence));
    push(
      checks,
      "Submitted session receipt covers the core teaching loop",
      evidence?.publicBetaUrlOpened === true &&
        evidence.stableTaskRunCompleted === true &&
        evidence.publicTraceReviewed === true &&
        evidence.correctionSubmitted === true &&
        evidence.ruleProvenanceReviewed === true &&
        evidence.rerunCompleted === true &&
        hasText(evidence.feedbackReceiptPath) &&
        (manualReviewEvidenceSaved || manualReviewBlockedWithReason),
      `publicBeta=${evidence?.publicBetaUrlOpened ?? "missing"}; task=${evidence?.stableTaskRunCompleted ?? "missing"}; manualReview=${evidence?.manualTestHumanReviewSaved ?? "missing"}; feedback=${evidence?.feedbackReceiptPath ?? "missing"}`
    );
    push(
      checks,
      "Submitted ready session receipt requires saved human_review evidence",
      receipt?.sessionDecision === "ready_for_feedback_intake"
        ? manualReviewEvidenceSaved
        : manualReviewEvidenceSaved || manualReviewBlockedWithReason,
      `decision=${receipt?.sessionDecision ?? "missing"}; manualReview=${evidence?.manualTestHumanReviewSaved ?? "missing"}; evidence=${evidence?.manualTestEvidencePath ?? "missing"}; evidenceKind=${manualEvidenceResult.evidence?.evidenceKind ?? "missing"}; reviewer=${manualEvidenceResult.evidence?.humanReviewEvidence?.reviewerName ?? "missing"}; tester=${receipt?.tester?.name ?? "missing"}; classification=${manualEvidenceResult.evidence?.classificationReason ?? "missing"}`
    );
    push(
      checks,
      "Submitted return pipeline was validated or explicitly blocked",
      (receipt?.sessionDecision === "ready_for_feedback_intake"
        ? receipt.returnPipeline?.feedbackReceiptValidated === true &&
          receipt.returnPipeline.feedbackReceiptIntaked === true &&
          receipt.returnPipeline.followUpPlanRefreshed === true
        : hasText(receipt?.blockers?.blockingIssue) || hasText(receipt?.blockers?.missingEvidence)) &&
        hasText(receipt?.nextActionRecommendation),
      `decision=${receipt?.sessionDecision ?? "missing"}; validated=${receipt?.returnPipeline?.feedbackReceiptValidated ?? "missing"}; intaked=${receipt?.returnPipeline?.feedbackReceiptIntaked ?? "missing"}`
    );
  }

  const passed = checks.filter((check) => check.pass).length;
  const status = passed === checks.length ? (isTemplate ? "template_ready" : "passed") : "failed";
  const validation = {
    responseMode: "public_beta_session_receipt_validation_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: isTemplate
      ? "npm run verify:public-beta-session-receipt"
      : `npm run verify:public-beta-session-receipt -- --receipt ${path.relative(process.cwd(), receiptPath)}`,
    inputPath: path.relative(process.cwd(), receiptPath),
    mode: isTemplate ? "template" : "submitted_receipt",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      status === "template_ready"
        ? "Use this template to record one full bounded beta session and validate the filled copy with -- --receipt <path>."
        : status === "passed"
          ? "Use this session receipt as review-only beta evidence, then rely on public-beta return intake and follow-up planning for the next action."
          : "Fix or block the beta session receipt before inviting another tester."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(validation, null, 2));
  console.log(JSON.stringify(validation, null, 2));
  console.log(`\nPublic beta session receipt validation written to ${outputPath}`);

  if (validation.status === "failed") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
