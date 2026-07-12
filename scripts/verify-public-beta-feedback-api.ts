import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const tempRoot = path.join(artifactsDir, "public-beta-feedback-api-verification-tmp");
const receiptPath = path.join(artifactsDir, "public-beta-feedback-api-verification.json");

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function validReceipt(betaDecision: "ready_for_next_beta_tester" | "needs_fix_before_more_testers" | "blocked") {
  return {
    responseMode: "public_beta_feedback_receipt_template_json_v1",
    status: "submitted",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    betaDecisionAllowedValues: ["ready_for_next_beta_tester", "needs_fix_before_more_testers", "blocked"],
    defaultBetaDecision: "needs_fix_before_more_testers",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    tester: {
      name: "Beta API Tester",
      role: "verification",
      date: "2026-06-24",
      environment: "temporary product artifacts directory"
    },
    setup: {
      couldStartProductRuntime: true,
      healthEndpointHealthy: true,
      liveHandoffChecked: true,
      notes: "API behavior verification."
    },
    coreLoop: {
      firstRunClear: true,
      traceUnderstandable: true,
      correctionSubmitted: true,
      ruleProvenanceVisible: true,
      rerunChangedBehavior: true,
      notes: "API behavior verification."
    },
    trustAndBoundaries: {
      learnedBehaviorClear: true,
      reviewOnlyBoundaryClear: true,
      noReleaseOrAllSoftwareClaim: true,
      notes: "API behavior verification."
    },
    blockers: {
      blockingIssue: betaDecision === "blocked" ? "A blocker was verified." : "",
      confusingWording: "The evidence path wording was hard to follow.",
      missingProductBehavior: "The tester wanted a clearer saved receipt history path.",
      screenshotOrEvidencePath: "artifacts/productization/public-beta-feedback-example.png"
    },
    betaDecision,
    nextActionRecommendation:
      betaDecision === "ready_for_next_beta_tester"
        ? "Proceed to one more bounded tester."
        : betaDecision === "blocked"
          ? "Stop and review the blocker."
          : "Fix issues before more testers.",
    locks: {
      mustNotSaveAcceptance: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotResumeAllSoftwareObjective: true
    }
  };
}

function locked(result: {
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
}) {
  return (
    result.releaseDecision === "do_not_release" &&
    result.reviewOnly === true &&
    result.accepted === false &&
    result.packagingGated === true
  );
}

async function main() {
  const checks: VerificationCheck[] = [];
  fs.rmSync(tempRoot, { recursive: true, force: true });
  process.env.PRODUCT_ARTIFACTS_DIR = tempRoot;

  const {
    readPublicBetaFeedbackInboxSummary,
    savePublicBetaFeedbackReceipt,
    validatePublicBetaFeedbackReceipt
  } = await import("../src/server/productization/public-beta-feedback");

  const dryRun = savePublicBetaFeedbackReceipt(validReceipt("ready_for_next_beta_tester"), { dryRun: true });
  const dryRunInbox = readPublicBetaFeedbackInboxSummary();
  push(
    checks,
    "Dry-run validation does not save feedback",
    dryRun.status === "validated_dry_run" &&
      dryRun.saved === false &&
      dryRun.dryRun === true &&
      dryRunInbox.totalReceipts === 0 &&
      locked(dryRun),
    `status=${dryRun.status}; saved=${dryRun.saved}; inbox=${dryRunInbox.totalReceipts}`
  );

  const saved = savePublicBetaFeedbackReceipt(validReceipt("ready_for_next_beta_tester"));
  const savedInbox = readPublicBetaFeedbackInboxSummary();
  const savedInboxPath = savedInbox.receiptFiles[0]
    ? path.join(tempRoot, "public-beta-feedback-inbox", savedInbox.receiptFiles[0])
    : "";
  const savedReceipt = savedInboxPath && fs.existsSync(savedInboxPath)
    ? (JSON.parse(fs.readFileSync(savedInboxPath, "utf8")) as ReturnType<typeof validReceipt>)
    : null;
  push(
    checks,
    "Valid ready feedback saves to temporary inbox",
    saved.status === "saved_to_feedback_inbox" &&
      saved.saved === true &&
      saved.dryRun === false &&
      savedInbox.totalReceipts === 1 &&
      saved.inboxReceiptPath?.startsWith("artifacts/productization/public-beta-feedback-inbox/") === true &&
      locked(saved),
    `status=${saved.status}; inbox=${savedInbox.totalReceipts}; path=${saved.inboxReceiptPath ?? "missing"}`
  );

  push(
    checks,
    "Saved feedback preserves tester issue detail fields",
    savedReceipt?.blockers?.confusingWording === "The evidence path wording was hard to follow." &&
      savedReceipt.blockers.missingProductBehavior === "The tester wanted a clearer saved receipt history path." &&
      savedReceipt.blockers.screenshotOrEvidencePath === "artifacts/productization/public-beta-feedback-example.png",
    `confusing=${Boolean(savedReceipt?.blockers?.confusingWording)}; missing=${Boolean(
      savedReceipt?.blockers?.missingProductBehavior
    )}; evidence=${savedReceipt?.blockers?.screenshotOrEvidencePath ?? "missing"}`
  );

  const invalid = validReceipt("ready_for_next_beta_tester");
  invalid.tester.name = "";
  invalid.locks.mustNotUnlockPackaging = false;
  const invalidSave = savePublicBetaFeedbackReceipt(invalid);
  const invalidFailedChecks = invalidSave.failedChecks as string[];
  const invalidInbox = readPublicBetaFeedbackInboxSummary();
  push(
    checks,
    "Invalid feedback is rejected without growing inbox",
    invalidSave.status === "rejected" &&
      invalidSave.saved === false &&
      invalidFailedChecks.includes("tester_identity") &&
      invalidFailedChecks.includes("locked_review_only_boundary") &&
      invalidInbox.totalReceipts === 1 &&
      locked(invalidSave),
    `status=${invalidSave.status}; failed=${invalidFailedChecks.join(",")}; inbox=${invalidInbox.totalReceipts}`
  );

  const blockedWithoutIssue = validReceipt("blocked");
  blockedWithoutIssue.blockers.blockingIssue = "";
  const blockedValidation = validatePublicBetaFeedbackReceipt(blockedWithoutIssue);
  const blockedWithoutIssueSave = savePublicBetaFeedbackReceipt(blockedWithoutIssue);
  push(
    checks,
    "Blocked feedback must include a blocking issue",
    blockedValidation.valid === false &&
      blockedValidation.failedChecks.includes("blocked_receipt_has_blocker") &&
      blockedWithoutIssueSave.status === "rejected" &&
      locked(blockedWithoutIssueSave),
    `valid=${blockedValidation.valid}; failed=${blockedValidation.failedChecks.join(",")}; status=${blockedWithoutIssueSave.status}`
  );

  const blockedSaved = savePublicBetaFeedbackReceipt(validReceipt("blocked"));
  const finalInbox = readPublicBetaFeedbackInboxSummary();
  push(
    checks,
    "Blocked feedback with blocker is saved as review-only evidence",
    blockedSaved.status === "saved_to_feedback_inbox" &&
      blockedSaved.saved === true &&
      finalInbox.totalReceipts === 2 &&
      locked(blockedSaved),
    `status=${blockedSaved.status}; inbox=${finalInbox.totalReceipts}`
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "public_beta_feedback_api_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:public-beta-feedback-api",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    tempArtifactsDir: "artifacts/productization/public-beta-feedback-api-verification-tmp",
    tempArtifactsCleaned: !fs.existsSync(tempRoot),
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "The product feedback receipt API behavior is verified; use /public-beta for bounded tester returns."
        : "Fix feedback receipt API behavior before relying on browser-submitted beta feedback."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nPublic beta feedback API verification written to ${receiptPath}`);

  if (verification.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
