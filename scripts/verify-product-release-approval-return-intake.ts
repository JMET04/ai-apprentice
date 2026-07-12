import fs from "node:fs";
import path from "node:path";
import { intakeProductReleaseApprovalReturn } from "./intake-product-release-approval-return";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const tempRoot = path.join(artifactsDir, "product-release-approval-return-intake-verification-tmp");
const receiptPath = path.join(artifactsDir, "product-release-approval-return-intake-verification.json");

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function submittedReceipt(decision: "needs_follow_up" | "blocked" | "ready_for_separate_release_review") {
  return {
    responseMode: "product_release_approval_receipt_json_v1",
    status: "submitted",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    releaseApprovalDecisionAllowedValues: ["needs_follow_up", "blocked", "ready_for_separate_release_review"],
    defaultReleaseApprovalDecision: "needs_follow_up",
    reviewer: {
      name: "Release Reviewer",
      role: "release reviewer",
      date: "2026-06-24",
      environment: "local product runtime"
    },
    prerequisiteEvidence: {
      productReleaseReadinessPath: "artifacts/productization/product-release-readiness.json",
      productReleaseReadinessStatus: "blocked_not_release_ready",
      blockerCountBeforeApproval: 0,
      humanAcceptanceGatePath: "artifacts/productization/human-acceptance-gate.json",
      humanAcceptanceGateStatus: "passed",
      humanAcceptanceReceiptValidationPath: "artifacts/productization/human-acceptance-receipt-validation.json",
      humanAcceptanceReceiptValidationStatus: "passed",
      aiServiceStatusPath: "artifacts/productization/ai-service-status.json",
      realModelReady: true,
      realModelTrialReceiptValidationPath: "artifacts/productization/real-model-trial-receipt-validation.json",
      realModelTrialReceiptValidationStatus: "passed",
      publicBetaReadinessPath: "artifacts/productization/public-beta-readiness.json",
      publicBetaReadinessStatus: "passed",
      githubSourcePackagePath: "artifacts/github-source-package/transparent-ai-apprentice-mcp-github-source-test.zip",
      githubSourcePackageVerificationPath: "artifacts/github-source-package/github-source-package-verification.json",
      githubSourcePackageVerificationStatus: "passed"
    },
    approvalChecks: {
      productReleaseReadinessReviewed: true,
      humanAcceptancePassed: true,
      humanAcceptanceReceiptValidated: true,
      realModelAcceptedSeparately: true,
      realModelReceiptValidated: true,
      publicBetaReadinessReviewed: true,
      sourcePackageBuiltWithoutSecrets: true,
      releaseNotesReviewed: true,
      rollbackPlanReviewed: true,
      packagingStillGated: true,
      releaseStillDoNotRelease: true,
      allSoftwareStillPaused: true
    },
    approvalSteps: [
      "review_release_readiness",
      "confirm_human_acceptance",
      "confirm_real_model_acceptance",
      "inspect_public_beta_and_source_package",
      "review_release_notes_and_rollback",
      "record_separate_release_review_decision"
    ].map((id) => ({
      id,
      status: "passed",
      note: `Reviewer completed ${id}.`,
      evidencePath: "artifacts/productization/product-release-readiness.json"
    })),
    blockers: {
      blockingIssue: decision === "blocked" ? "Reviewer found a release blocker." : "",
      missingEvidence: "",
      releaseRisk: "",
      rollbackConcern: "",
      evidencePath: decision === "blocked" ? "artifacts/productization/product-release-readiness.json" : ""
    },
    releaseApprovalDecision: decision,
    nextActionRecommendation:
      decision === "ready_for_separate_release_review"
        ? "Send the archived evidence to the separate release process."
        : decision === "blocked"
          ? "Stop release planning and resolve the blocker."
          : "Plan release follow-up.",
    locks: {
      mustNotSaveAcceptanceFromReceipt: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotAcceptRealModel: true,
      mustNotResumeAllSoftwareObjective: true
    }
  };
}


type ReleaseApprovalFixture = ReturnType<typeof submittedReceipt>;
function writeJson(targetPath: string, body: unknown) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(body, null, 2));
}


function attachPrerequisiteEvidence(dir: string, body: ReleaseApprovalFixture) {
  const productReleaseReadinessPath = path.join(dir, "product-release-readiness.json");
  const humanAcceptanceGatePath = path.join(dir, "human-acceptance-gate.json");
  const humanAcceptanceReceiptValidationPath = path.join(dir, "human-acceptance-receipt-validation.json");
  const realModelTrialReceiptValidationPath = path.join(dir, "real-model-trial-receipt-validation.json");
  const aiServiceStatusPath = path.join(dir, "ai-service-status.json");
  const publicBetaReadinessPath = path.join(dir, "public-beta-readiness.json");
  const githubSourcePackagePath = path.join(dir, "transparent-ai-apprentice-mcp-github-source-test.zip");
  const githubSourcePackageVerificationPath = path.join(dir, "github-source-package-verification.json");

  body.prerequisiteEvidence.productReleaseReadinessPath = productReleaseReadinessPath;
  body.prerequisiteEvidence.humanAcceptanceGatePath = humanAcceptanceGatePath;
  body.prerequisiteEvidence.humanAcceptanceReceiptValidationPath = humanAcceptanceReceiptValidationPath;
  body.prerequisiteEvidence.realModelTrialReceiptValidationPath = realModelTrialReceiptValidationPath;
  body.prerequisiteEvidence.aiServiceStatusPath = aiServiceStatusPath;
  body.prerequisiteEvidence.publicBetaReadinessPath = publicBetaReadinessPath;
  body.prerequisiteEvidence.githubSourcePackagePath = githubSourcePackagePath;
  body.prerequisiteEvidence.githubSourcePackageVerificationPath = githubSourcePackageVerificationPath;

  writeJson(productReleaseReadinessPath, {
    responseMode: "product_release_readiness_gate_json_v1",
    status: body.prerequisiteEvidence.productReleaseReadinessStatus,
    releaseDecision: "do_not_release",
    blockers: []
  });
  writeJson(humanAcceptanceGatePath, {
    responseMode: "human_acceptance_gate_json_v1",
    status: "passed",
    latestEvidenceKind: "human_review",
    latestHumanReviewed: true,
    latestAutomationGenerated: false,
    releaseBoundary: {
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    }
  });
  writeJson(humanAcceptanceReceiptValidationPath, {
    responseMode: "human_acceptance_receipt_validation_json_v1",
    status: "passed",
    mode: "submitted_receipt",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    passed: 7,
    total: 7
  });
  writeJson(realModelTrialReceiptValidationPath, {
    responseMode: "real_model_trial_receipt_validation_json_v1",
    status: "passed",
    mode: "submitted_receipt",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canActivateRealModel: false,
    canRelease: false,
    passed: 11,
    total: 11
  });
  writeJson(aiServiceStatusPath, {
    responseMode: "ai_service_runtime_status_json_v1",
    activeProvider: "mock",
    requestedProvider: "mock",
    status: "mock_active",
    realModelReady: false,
    configured: {
      manualProviderAcceptance: false
    },
    safetyBoundary: {
      mockFallback: true,
      accepted: false,
      packagingGated: true
    }
  });
  writeJson(publicBetaReadinessPath, {
    responseMode: "public_beta_readiness_json_v1",
    status: "passed",
    betaCanStart: true,
    releaseDecision: "do_not_release",
    accepted: false,
    packagingGated: true,
    passed: 56,
    total: 56
  });
  fs.writeFileSync(githubSourcePackagePath, "fake zip for release approval intake verifier");
  writeJson(githubSourcePackageVerificationPath, {
    responseMode: "github_source_package_verification_json_v1",
    status: "passed",
    archivePath: githubSourcePackagePath,
    uploadReady: true,
    includesSecrets: false,
    includesDependencies: false,
    includesLocalDatabase: false,
    includesBuildCache: false,
    passed: 26,
    total: 26
  });
}
function runScenario(
  name: string,
  body: ReleaseApprovalFixture,
  options: { attachEvidence?: boolean; mutateEvidence?: (dir: string, body: ReleaseApprovalFixture) => void } = {}
) {
  const dir = path.join(tempRoot, name);
  const sourceReceipt = path.join(dir, "submitted.json");
  const inboxDir = path.join(dir, "inbox");
  const outputPath = path.join(dir, "intake.json");
  fs.rmSync(dir, { recursive: true, force: true });
  if (options.attachEvidence !== false) {
    attachPrerequisiteEvidence(dir, body);
  }
  options.mutateEvidence?.(dir, body);
  writeJson(sourceReceipt, body);

  return intakeProductReleaseApprovalReturn({
    receiptPath: sourceReceipt,
    inboxDir,
    outputPath
  });
}

function locked(intake: ReturnType<typeof intakeProductReleaseApprovalReturn>) {
  return (
    intake.releaseDecision === "do_not_release" &&
    intake.reviewOnly === true &&
    intake.accepted === false &&
    intake.packagingGated === true &&
    intake.canRelease === false &&
    intake.locks.mustNotSaveAcceptanceFromReceipt === true &&
    intake.locks.mustNotAcceptRealModel === true &&
    intake.locks.mustNotUnlockPackaging === true &&
    intake.locks.mustNotClaimReleaseReady === true &&
    intake.locks.mustNotResumeAllSoftwareObjective === true
  );
}

function main() {
  const checks: VerificationCheck[] = [];
  const selfReportedOnly = runScenario(
    "self-reported-only",
    submittedReceipt("ready_for_separate_release_review"),
    { attachEvidence: false }
  );
  push(
    checks,
    "Self-reported release prerequisites without artifact backing are rejected",
    selfReportedOnly.status === "rejected" && selfReportedOnly.copiedReceiptPath === null && locked(selfReportedOnly),
    `status=${selfReportedOnly.status}; copied=${Boolean(selfReportedOnly.copiedReceiptPath)}; validation=${selfReportedOnly.receiptValidation.status}`
  );
  fs.rmSync(tempRoot, { recursive: true, force: true });

  const unverifiedSourcePackage = runScenario(
    "unverified-source-package",
    submittedReceipt("ready_for_separate_release_review"),
    {
      mutateEvidence: (_dir, body) => {
        body.prerequisiteEvidence.githubSourcePackageVerificationPath = "";
        body.prerequisiteEvidence.githubSourcePackageVerificationStatus = "";
      }
    }
  );
  push(
    checks,
    "Release approval with an unverified source package is rejected",
    unverifiedSourcePackage.status === "rejected" &&
      unverifiedSourcePackage.copiedReceiptPath === null &&
      locked(unverifiedSourcePackage),
    `status=${unverifiedSourcePackage.status}; copied=${Boolean(unverifiedSourcePackage.copiedReceiptPath)}; validation=${unverifiedSourcePackage.receiptValidation.status}`
  );

  const tamperedRuntimeRollback = runScenario(
    "tampered-runtime-rollback",
    submittedReceipt("ready_for_separate_release_review"),
    {
      mutateEvidence: (dir) => {
        writeJson(path.join(dir, "ai-service-status.json"), {
          responseMode: "ai_service_runtime_status_json_v1",
          activeProvider: "openai",
          requestedProvider: "openai",
          status: "real_provider_active_after_manual_acceptance",
          realModelReady: true,
          configured: {
            manualProviderAcceptance: true
          },
          safetyBoundary: {
            mockFallback: false,
            accepted: true,
            packagingGated: true
          }
        });
      }
    }
  );
  push(
    checks,
    "Release approval with a still-active real model runtime is rejected",
    tamperedRuntimeRollback.status === "rejected" &&
      tamperedRuntimeRollback.copiedReceiptPath === null &&
      locked(tamperedRuntimeRollback),
    "status=" + tamperedRuntimeRollback.status + "; copied=" + Boolean(tamperedRuntimeRollback.copiedReceiptPath) + "; validation=" + tamperedRuntimeRollback.receiptValidation.status
  );

  const ready = runScenario("ready", submittedReceipt("ready_for_separate_release_review"));
  push(
    checks,
    "Ready release approval receipt is archived without unlocking release",
    ready.status === "recorded_ready_for_separate_release_review" &&
      ready.copiedReceiptPath !== null &&
      ready.receiptValidation.status === "passed" &&
      ready.releaseReadiness.releaseDecision === "do_not_release" &&
      locked(ready),
    `status=${ready.status}; copied=${Boolean(ready.copiedReceiptPath)}; validation=${ready.receiptValidation.status}; release=${ready.releaseReadiness.releaseDecision}`
  );

  const blocked = runScenario("blocked", submittedReceipt("blocked"));
  push(
    checks,
    "Blocked release approval receipt is archived as follow-up evidence",
    blocked.status === "recorded_blocked" &&
      blocked.copiedReceiptPath !== null &&
      blocked.releaseReadiness.releaseDecision === "do_not_release" &&
      locked(blocked),
    `status=${blocked.status}; copied=${Boolean(blocked.copiedReceiptPath)}; release=${blocked.releaseReadiness.releaseDecision}`
  );

  const invalidReceipt = submittedReceipt("ready_for_separate_release_review");
  invalidReceipt.reviewer.name = "";
  invalidReceipt.locks.mustNotUnlockPackaging = false;
  const invalid = runScenario("invalid", invalidReceipt);
  push(
    checks,
    "Invalid release approval receipt is rejected and not copied",
    invalid.status === "rejected" && invalid.copiedReceiptPath === null && locked(invalid),
    `status=${invalid.status}; copied=${Boolean(invalid.copiedReceiptPath)}`
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "product_release_approval_return_intake_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:product-release-approval-return-intake",
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
      passed === checks.length
        ? "Use intake:product-release-approval-return when a separate release reviewer returns a filled receipt."
        : "Fix release approval return intake behavior before relying on returned release-review evidence."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nProduct release approval return intake verification written to ${receiptPath}`);

  if (verification.status !== "passed") {
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
