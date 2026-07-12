import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

type ProductReleaseApprovalReceipt = {
  responseMode?: string;
  status?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  releaseApprovalDecisionAllowedValues?: string[];
  defaultReleaseApprovalDecision?: string;
  reviewer?: {
    name?: string;
    role?: string;
    date?: string;
    environment?: string;
  };
  prerequisiteEvidence?: {
    productReleaseReadinessPath?: string;
    productReleaseReadinessStatus?: string;
    blockerCountBeforeApproval?: number | null;
    humanAcceptanceGatePath?: string;
    humanAcceptanceGateStatus?: string;
    humanAcceptanceReceiptValidationPath?: string;
    humanAcceptanceReceiptValidationStatus?: string;
    aiServiceStatusPath?: string;
    realModelReady?: boolean | null;
    realModelTrialReceiptValidationPath?: string;
    realModelTrialReceiptValidationStatus?: string;
    publicBetaReadinessPath?: string;
    publicBetaReadinessStatus?: string;
    githubSourcePackagePath?: string;
    githubSourcePackageVerificationPath?: string;
    githubSourcePackageVerificationStatus?: string;
  };
  approvalChecks?: {
    productReleaseReadinessReviewed?: boolean | null;
    humanAcceptancePassed?: boolean | null;
    humanAcceptanceReceiptValidated?: boolean | null;
    realModelAcceptedSeparately?: boolean | null;
    realModelReceiptValidated?: boolean | null;
    publicBetaReadinessReviewed?: boolean | null;
    sourcePackageBuiltWithoutSecrets?: boolean | null;
    releaseNotesReviewed?: boolean | null;
    rollbackPlanReviewed?: boolean | null;
    packagingStillGated?: boolean | null;
    releaseStillDoNotRelease?: boolean | null;
    allSoftwareStillPaused?: boolean | null;
  };
  approvalSteps?: Array<{
    id?: string;
    status?: string;
    note?: string;
    evidencePath?: string;
  }>;
  blockers?: {
    blockingIssue?: string;
    missingEvidence?: string;
    releaseRisk?: string;
    rollbackConcern?: string;
    evidencePath?: string;
  };
  releaseApprovalDecision?: string;
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


type ProductReleaseReadinessEvidence = {
  responseMode?: string;
  status?: string;
  releaseDecision?: string;
  blockers?: unknown[];
};

type HumanAcceptanceGateEvidence = {
  responseMode?: string;
  status?: string;
  latestEvidenceKind?: string;
  latestHumanReviewed?: boolean;
  latestAutomationGenerated?: boolean;
  releaseBoundary?: {
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
  };
};

type ValidationEvidence = {
  responseMode?: string;
  status?: string;
  mode?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canActivateRealModel?: boolean;
  passed?: number;
  total?: number;
};

type PublicBetaEvidence = {
  responseMode?: string;
  status?: string;
  betaCanStart?: boolean;
  releaseDecision?: string;
  accepted?: boolean;
  packagingGated?: boolean;
  passed?: number;
  total?: number;
};

type AIServiceStatusEvidence = {
  responseMode?: string;
  activeProvider?: string;
  requestedProvider?: string;
  realModelReady?: boolean;
  configured?: {
    manualProviderAcceptance?: boolean;
  };
  safetyBoundary?: {
    mockFallback?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
  };
};

type GithubSourcePackageVerificationEvidence = {
  responseMode?: string;
  status?: string;
  archivePath?: string;
  uploadReady?: boolean;
  includesSecrets?: boolean;
  includesDependencies?: boolean;
  includesLocalDatabase?: boolean;
  includesBuildCache?: boolean;
  passed?: number;
  total?: number;
};
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const defaultReceiptPath = path.join(artifactsDir, "product-release-approval.template.json");
const defaultValidationPath = path.join(artifactsDir, "product-release-approval-validation.json");
const allowedDecisions = ["needs_follow_up", "blocked", "ready_for_separate_release_review"];
const requiredStepIds = [
  "review_release_readiness",
  "confirm_human_acceptance",
  "confirm_real_model_acceptance",
  "inspect_public_beta_and_source_package",
  "review_release_notes_and_rollback",
  "record_separate_release_review_decision"
];

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function evidenceValue(value: unknown) {
  return value === null ? "null" : String(value ?? "missing");
}

function parseReceiptPath() {
  const receiptFlagIndex = process.argv.indexOf("--receipt");

  if (receiptFlagIndex >= 0) {
    const value = process.argv[receiptFlagIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for --receipt.");
    }
    return path.resolve(process.cwd(), value);
  }

  const positional = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  return positional ? path.resolve(process.cwd(), positional) : defaultReceiptPath;
}

function parseOutputPath() {
  const outFlagIndex = process.argv.indexOf("--out");

  if (outFlagIndex >= 0) {
    const value = process.argv[outFlagIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for --out.");
    }
    return path.resolve(process.cwd(), value);
  }

  return defaultValidationPath;
}
function readReceipt(receiptPath: string): ProductReleaseApprovalReceipt | null {
  try {
    const raw = fs.readFileSync(receiptPath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw) as ProductReleaseApprovalReceipt;
  } catch {
    return null;
  }
}


function readJsonFile<T>(targetPath: string): T | null {
  try {
    const raw = fs.readFileSync(targetPath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function resolveEvidencePath(receiptPath: string, evidencePath: unknown) {
  if (!hasText(evidencePath)) return null;
  if (path.isAbsolute(evidencePath)) return evidencePath;

  const cwdRelative = path.resolve(process.cwd(), evidencePath);
  if (fs.existsSync(cwdRelative)) return cwdRelative;

  return path.resolve(path.dirname(receiptPath), evidencePath);
}

function readEvidence<T>(receiptPath: string, evidencePath: unknown) {
  const resolvedPath = resolveEvidencePath(receiptPath, evidencePath);
  if (!resolvedPath) return { resolvedPath: null, evidence: null };
  return { resolvedPath, evidence: readJsonFile<T>(resolvedPath) };
}

function fileExists(receiptPath: string, evidencePath: unknown) {
  const resolvedPath = resolveEvidencePath(receiptPath, evidencePath);
  return Boolean(resolvedPath && fs.existsSync(resolvedPath));
}

function sameResolvedEvidencePath(receiptPath: string, left: unknown, right: unknown) {
  const leftPath = resolveEvidencePath(receiptPath, left);
  const rightPath = resolveEvidencePath(receiptPath, right);
  return Boolean(leftPath && rightPath && path.resolve(leftPath) === path.resolve(rightPath));
}

function isVerifiedSourcePackage(
  receiptPath: string,
  packagePath: unknown,
  verification: GithubSourcePackageVerificationEvidence | null
) {
  return (
    fileExists(receiptPath, packagePath) &&
    verification?.responseMode === "github_source_package_verification_json_v1" &&
    verification.status === "passed" &&
    verification.uploadReady === true &&
    verification.includesSecrets === false &&
    verification.includesDependencies === false &&
    verification.includesLocalDatabase === false &&
    verification.includesBuildCache === false &&
    typeof verification.passed === "number" &&
    verification.passed === verification.total &&
    sameResolvedEvidencePath(receiptPath, packagePath, verification.archivePath)
  );
}

function isLockedValidationEvidence(evidence: ValidationEvidence | null) {
  return (
    evidence?.status === "passed" &&
    evidence.reviewOnly === true &&
    evidence.accepted === false &&
    evidence.packagingGated === true &&
    evidence.releaseDecision === "do_not_release"
  );
}

function isRealHumanAcceptanceEvidence(evidence: HumanAcceptanceGateEvidence | null) {
  return (
    evidence?.responseMode === "human_acceptance_gate_json_v1" &&
    evidence.status === "passed" &&
    evidence.latestEvidenceKind === "human_review" &&
    evidence.latestHumanReviewed === true &&
    evidence.latestAutomationGenerated === false &&
    evidence.releaseBoundary?.reviewOnly === true &&
    evidence.releaseBoundary.accepted === false &&
    evidence.releaseBoundary.packagingGated === true
  );
}
function isPostTrialMockRollbackEvidence(evidence: AIServiceStatusEvidence | null) {
  return (
    evidence?.responseMode === "ai_service_runtime_status_json_v1" &&
    evidence.activeProvider === "mock" &&
    evidence.realModelReady === false &&
    evidence.configured?.manualProviderAcceptance === false &&
    evidence.safetyBoundary?.mockFallback === true &&
    evidence.safetyBoundary.accepted === false &&
    evidence.safetyBoundary.packagingGated === true
  );
}

function containsForbiddenClaim(value: unknown): boolean {
  if (typeof value === "string") {
    return /accepted\s*=\s*true|packagingGated\s*=\s*false|releaseDecision\s*=\s*release_ready|canRelease\s*=\s*true/i.test(
      value
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenClaim(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsForbiddenClaim(item));
  }
  return false;
}

function main() {
  const receiptPath = parseReceiptPath();
  const validationPath = parseOutputPath();
  const receipt = readReceipt(receiptPath);
  const checks: VerificationCheck[] = [];
  const isTemplate = path.basename(receiptPath) === "product-release-approval.template.json";

  push(checks, "Product release approval receipt JSON exists", Boolean(receipt), `path=${path.relative(process.cwd(), receiptPath)}`);

  push(
    checks,
    "Product release approval receipt mode is recognized",
    receipt?.responseMode === "product_release_approval_receipt_json_v1",
    `responseMode=${receipt?.responseMode ?? "missing"}`
  );

  push(
    checks,
    "Product release approval receipt stays in bounded product scope",
    receipt?.productScope === "bounded_core_teaching_loop" &&
      receipt.allSoftwareObjective === "paused" &&
      receipt.releaseDecision === "do_not_release",
    `scope=${receipt?.productScope ?? "missing"}; allSoftware=${
      receipt?.allSoftwareObjective ?? "missing"
    }; release=${receipt?.releaseDecision ?? "missing"}`
  );

  push(
    checks,
    "Product release approval receipt cannot unlock release boundaries",
    receipt?.reviewOnly === true &&
      receipt.accepted === false &&
      receipt.packagingGated === true &&
      receipt.canRelease === false &&
      receipt.locks?.mustNotSaveAcceptanceFromReceipt === true &&
      receipt.locks.mustNotEnableRules === true &&
      receipt.locks.mustNotUnlockPackaging === true &&
      receipt.locks.mustNotClaimReleaseReady === true &&
      receipt.locks.mustNotAcceptRealModel === true &&
      receipt.locks.mustNotResumeAllSoftwareObjective === true,
    `reviewOnly=${receipt?.reviewOnly ?? "missing"}; accepted=${receipt?.accepted ?? "missing"}; packagingGated=${
      receipt?.packagingGated ?? "missing"
    }; canRelease=${receipt?.canRelease ?? "missing"}`
  );

  push(
    checks,
    "Product release approval decision is constrained",
    Array.isArray(receipt?.releaseApprovalDecisionAllowedValues) &&
      allowedDecisions.every((decision) => receipt.releaseApprovalDecisionAllowedValues?.includes(decision)) &&
      allowedDecisions.includes(receipt.releaseApprovalDecision ?? "") &&
      receipt.defaultReleaseApprovalDecision === "needs_follow_up",
    `decision=${receipt?.releaseApprovalDecision ?? "missing"}; default=${
      receipt?.defaultReleaseApprovalDecision ?? "missing"
    }`
  );

  push(
    checks,
    "Product release approval receipt does not claim forbidden outcomes",
    Boolean(receipt) && !containsForbiddenClaim(receipt),
    "Scans receipt values for accepted=true, packagingGated=false, canRelease=true, or release-ready claims."
  );

  if (isTemplate) {
    push(
      checks,
      "Template keeps unfilled fields neutral",
      receipt?.status === "not_filled_yet" &&
        receipt.reviewer?.name === "" &&
        receipt.prerequisiteEvidence?.blockerCountBeforeApproval === null &&
        receipt.prerequisiteEvidence?.realModelReady === null &&
        receipt.approvalChecks?.productReleaseReadinessReviewed === null &&
        receipt.approvalSteps?.every((step) => step.status === "not_run" && step.note === "") === true,
      `status=${receipt?.status ?? "missing"}; reviewer=${receipt?.reviewer?.name ?? "missing"}; realModelReady=${evidenceValue(
        receipt?.prerequisiteEvidence?.realModelReady
      )}`
    );
  } else {
    push(
      checks,
      "Submitted product release approval receipt has reviewer identity",
      receipt?.status === "submitted" &&
        hasText(receipt.reviewer?.name) &&
        hasText(receipt.reviewer?.role) &&
        hasText(receipt.reviewer?.date) &&
        hasText(receipt.reviewer?.environment),
      `status=${receipt?.status ?? "missing"}; reviewer=${receipt?.reviewer?.name ?? "missing"}; date=${
        receipt?.reviewer?.date ?? "missing"
      }`
    );

    const prerequisiteEvidence = receipt?.prerequisiteEvidence;
    const releaseReadiness = readEvidence<ProductReleaseReadinessEvidence>(
      receiptPath,
      prerequisiteEvidence?.productReleaseReadinessPath
    );
    const humanAcceptanceGate = readEvidence<HumanAcceptanceGateEvidence>(
      receiptPath,
      prerequisiteEvidence?.humanAcceptanceGatePath
    );
    const humanReceiptValidation = readEvidence<ValidationEvidence>(
      receiptPath,
      prerequisiteEvidence?.humanAcceptanceReceiptValidationPath
    );
    const realModelReceiptValidation = readEvidence<ValidationEvidence>(
      receiptPath,
      prerequisiteEvidence?.realModelTrialReceiptValidationPath
    );
    const aiServiceStatus = readEvidence<AIServiceStatusEvidence>(receiptPath, prerequisiteEvidence?.aiServiceStatusPath);
    const publicBetaReadiness = readEvidence<PublicBetaEvidence>(
      receiptPath,
      prerequisiteEvidence?.publicBetaReadinessPath
    );
    const githubSourcePackageVerification = readEvidence<GithubSourcePackageVerificationEvidence>(
      receiptPath,
      prerequisiteEvidence?.githubSourcePackageVerificationPath
    );
    const sourcePackageVerified = isVerifiedSourcePackage(
      receiptPath,
      prerequisiteEvidence?.githubSourcePackagePath,
      githubSourcePackageVerification.evidence
    );
    const blockerCountMatches =
      typeof prerequisiteEvidence?.blockerCountBeforeApproval === "number" &&
      releaseReadiness.evidence?.blockers?.length === prerequisiteEvidence.blockerCountBeforeApproval;

    push(
      checks,
      "Submitted prerequisite evidence is backed by current artifact contents",
      releaseReadiness.evidence?.releaseDecision === "do_not_release" &&
        releaseReadiness.evidence?.status === prerequisiteEvidence?.productReleaseReadinessStatus &&
        blockerCountMatches &&
        isRealHumanAcceptanceEvidence(humanAcceptanceGate.evidence) &&
        prerequisiteEvidence.humanAcceptanceGateStatus === humanAcceptanceGate.evidence?.status &&
        humanReceiptValidation.evidence?.responseMode === "human_acceptance_receipt_validation_json_v1" &&
        isLockedValidationEvidence(humanReceiptValidation.evidence) &&
        prerequisiteEvidence.humanAcceptanceReceiptValidationStatus === humanReceiptValidation.evidence.status &&
        realModelReceiptValidation.evidence?.responseMode === "real_model_trial_receipt_validation_json_v1" &&
        isLockedValidationEvidence(realModelReceiptValidation.evidence) &&
        realModelReceiptValidation.evidence.canActivateRealModel === false &&
        isPostTrialMockRollbackEvidence(aiServiceStatus.evidence) &&
        prerequisiteEvidence.realModelReady === true &&
        prerequisiteEvidence.realModelTrialReceiptValidationStatus === realModelReceiptValidation.evidence.status &&
        publicBetaReadiness.evidence?.responseMode === "public_beta_readiness_json_v1" &&
        publicBetaReadiness.evidence.status === "passed" &&
        publicBetaReadiness.evidence.betaCanStart === true &&
        publicBetaReadiness.evidence.releaseDecision === "do_not_release" &&
        publicBetaReadiness.evidence.accepted === false &&
        publicBetaReadiness.evidence.packagingGated === true &&
        prerequisiteEvidence.publicBetaReadinessStatus === publicBetaReadiness.evidence.status &&
        prerequisiteEvidence.githubSourcePackageVerificationStatus === githubSourcePackageVerification.evidence?.status &&
        sourcePackageVerified,
      `release=${releaseReadiness.evidence?.status ?? "missing"}; blockers=${
        releaseReadiness.evidence?.blockers?.length ?? "missing"
      }/${prerequisiteEvidence?.blockerCountBeforeApproval ?? "missing"}; human=${
        humanAcceptanceGate.evidence?.status ?? "missing"
      }/${humanAcceptanceGate.evidence?.latestEvidenceKind ?? "missing"}; humanReceipt=${
        humanReceiptValidation.evidence?.status ?? "missing"
      }; modelReceipt=${realModelReceiptValidation.evidence?.status ?? "missing"}; beta=${
        publicBetaReadiness.evidence?.status ?? "missing"
      }; sourceVerification=${githubSourcePackageVerification.evidence?.status ?? "missing"}; sourceZip=${sourcePackageVerified}`
    );

    const approvalChecks = receipt?.approvalChecks;
    push(
      checks,
      "Submitted release approval checks are complete, locked, and evidence-backed",
      approvalChecks?.productReleaseReadinessReviewed === true &&
        approvalChecks.humanAcceptancePassed === true &&
        approvalChecks.humanAcceptanceReceiptValidated === true &&
        approvalChecks.realModelAcceptedSeparately === true &&
        approvalChecks.realModelReceiptValidated === true &&
        approvalChecks.publicBetaReadinessReviewed === true &&
        approvalChecks.sourcePackageBuiltWithoutSecrets === true &&
        approvalChecks.releaseNotesReviewed === true &&
        approvalChecks.rollbackPlanReviewed === true &&
        approvalChecks.packagingStillGated === true &&
        approvalChecks.releaseStillDoNotRelease === true &&
        approvalChecks.allSoftwareStillPaused === true &&
        isRealHumanAcceptanceEvidence(humanAcceptanceGate.evidence) &&
        isLockedValidationEvidence(humanReceiptValidation.evidence) &&
        isLockedValidationEvidence(realModelReceiptValidation.evidence) &&
        isPostTrialMockRollbackEvidence(aiServiceStatus.evidence) &&
        publicBetaReadiness.evidence?.status === "passed" &&
        sourcePackageVerified,
      `human=${approvalChecks?.humanAcceptancePassed ?? "missing"}; model=${
        approvalChecks?.realModelAcceptedSeparately ?? "missing"
      }; package=${approvalChecks?.sourcePackageBuiltWithoutSecrets ?? "missing"}; packaging=${
        approvalChecks?.packagingStillGated ?? "missing"
      }; release=${approvalChecks?.releaseStillDoNotRelease ?? "missing"}; artifactBacked=${
        isRealHumanAcceptanceEvidence(humanAcceptanceGate.evidence) &&
        isLockedValidationEvidence(humanReceiptValidation.evidence) &&
        isLockedValidationEvidence(realModelReceiptValidation.evidence) &&
        isPostTrialMockRollbackEvidence(aiServiceStatus.evidence) &&
        publicBetaReadiness.evidence?.status === "passed" &&
        sourcePackageVerified
      }`
    );
    const approvalSteps = receipt?.approvalSteps ?? [];
    const everyRequiredStep = requiredStepIds.every((id) =>
      approvalSteps.some((step) => step.id === id && step.status === "passed" && hasText(step.note))
    );
    push(
      checks,
      "Submitted approval step results cover the full release review",
      approvalSteps.length >= requiredStepIds.length && everyRequiredStep,
      `steps=${approvalSteps.length}; requiredMatched=${requiredStepIds.filter((id) =>
        approvalSteps.some((step) => step.id === id && step.status === "passed" && hasText(step.note))
      ).length}/${requiredStepIds.length}`
    );

    push(
      checks,
      "Submitted product release approval receipt has an actionable next step",
      hasText(receipt?.nextActionRecommendation) &&
        (receipt?.releaseApprovalDecision !== "blocked" || hasText(receipt.blockers?.blockingIssue)) &&
        (receipt?.releaseApprovalDecision !== "ready_for_separate_release_review" ||
          approvalChecks?.releaseStillDoNotRelease === true),
      `decision=${receipt?.releaseApprovalDecision ?? "missing"}; nextAction=${hasText(
        receipt?.nextActionRecommendation
      )}; blocker=${hasText(receipt?.blockers?.blockingIssue)}`
    );
  }

  const passed = checks.filter((check) => check.pass).length;
  const validationStatus = passed === checks.length ? (isTemplate ? "template_ready" : "passed") : "failed";
  const validation = {
    responseMode: "product_release_approval_validation_json_v1",
    status: validationStatus,
    generatedAt: new Date().toISOString(),
    command: isTemplate
      ? "npm run verify:product-release-approval"
      : `npm run verify:product-release-approval -- --receipt ${path.relative(process.cwd(), receiptPath)}`,
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
      validationStatus === "template_ready"
        ? "Keep this template with the release blocker board; validate a filled copy only after human and model acceptance evidence exists."
        : validationStatus === "passed"
          ? "Use the submitted receipt as separate release-review evidence only; release and packaging remain locked until an explicit release process changes them."
          : "Fix the product release approval receipt before using it for release follow-up."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2));
  console.log(JSON.stringify(validation, null, 2));
  console.log(`\nProduct release approval validation written to ${validationPath}`);

  if (validation.status === "failed") {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
