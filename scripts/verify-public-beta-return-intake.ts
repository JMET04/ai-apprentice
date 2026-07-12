import fs from "node:fs";
import path from "node:path";
import { intakePublicBetaReturn } from "./intake-public-beta-return";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const tempRoot = path.join(artifactsDir, "public-beta-return-intake-verification-tmp");
const receiptPath = path.join(artifactsDir, "public-beta-return-intake-verification.json");

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
      name: "Beta Tester",
      role: "trial reviewer",
      date: "2026-06-24",
      environment: "local product runtime"
    },
    setup: {
      couldStartProductRuntime: true,
      healthEndpointHealthy: true,
      liveHandoffChecked: true,
      notes: "Checked before return intake."
    },
    coreLoop: {
      firstRunClear: true,
      traceUnderstandable: true,
      correctionSubmitted: true,
      ruleProvenanceVisible: true,
      rerunChangedBehavior: true,
      notes: "Core teaching loop was reviewed."
    },
    trustAndBoundaries: {
      learnedBehaviorClear: true,
      reviewOnlyBoundaryClear: true,
      noReleaseOrAllSoftwareClaim: true,
      notes: "Release and all-software boundaries remained clear."
    },
    blockers: {
      blockingIssue: betaDecision === "blocked" ? "A blocking issue was found." : "",
      confusingWording: "",
      missingProductBehavior: "",
      screenshotOrEvidencePath: ""
    },
    betaDecision,
    nextActionRecommendation:
      betaDecision === "ready_for_next_beta_tester"
        ? "Proceed to one more bounded tester."
        : betaDecision === "blocked"
          ? "Stop tester intake and review the blocker."
          : "Fix wording before more testers.",
    locks: {
      mustNotSaveAcceptance: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotResumeAllSoftwareObjective: true
    }
  };
}

function validManualAcceptanceEvidence() {
  return {
    responseMode: "manual_acceptance_saved_receipt_json_v1",
    savedAt: "2026-06-24T10:00:00.000Z",
    source: "manual-test-workbench",
    evidenceKind: "human_review",
    humanReviewed: true,
    automationGenerated: false,
    classificationReason: "valid_human_review_evidence",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    humanReviewEvidence: {
      responseMode: "manual_test_workbench_human_review_evidence_v1",
      reviewerName: "Beta Tester",
      attestation: "human-reviewed-manual-test-workbench",
      savedFrom: "manual-test-workbench"
    },
    report: {
      summary: {
        readyForHumanTrial: true,
        passed: 2,
        failed: 0,
        notRun: 0
      },
      steps: [
        { id: "run-once", status: "passed", note: "Tester observed a completed run and visible trace." },
        { id: "review-evidence", status: "passed", note: "Tester confirmed review evidence and locks stayed visible." }
      ]
    }
  };
}

function noNoteManualAcceptanceEvidence() {
  const evidence: any = validManualAcceptanceEvidence();
  evidence.report.steps = evidence.report.steps.map(({ id, status }: { id: string; status: string }) => ({ id, status }));
  return evidence;
}

function automatedManualAcceptanceEvidence() {
  return {
    ...validManualAcceptanceEvidence(),
    source: "manual-browser-smoke",
    evidenceKind: "automated_browser_smoke",
    humanReviewed: false,
    automationGenerated: true,
    classificationReason: "source_marked_as_automation",
    humanReviewEvidence: undefined
  };
}
function validSessionReceipt(sessionDecision: "ready_for_feedback_intake" | "needs_fix_before_more_testers" | "blocked" = "ready_for_feedback_intake") {
  return {
    responseMode: "public_beta_session_receipt_json_v1",
    status: "submitted",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    defaultSessionDecision: "needs_fix_before_more_testers",
    sessionDecisionAllowedValues: ["ready_for_feedback_intake", "needs_fix_before_more_testers", "blocked"],
    facilitator: {
      name: "Beta Facilitator",
      role: "maintainer",
      date: "2026-06-24",
      environment: "local product runtime"
    },
    tester: {
      name: "Beta Tester",
      role: "trial reviewer",
      date: "2026-06-24",
      environment: "local product runtime"
    },
    sessionMaterials: {
      sessionPlanPath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md",
      testerRunbookPath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md",
      feedbackReceiptTemplatePath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json",
      startHerePath: "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md"
    },
    launchPreflight: {
      command: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
      evidencePath: "artifacts/productization/public-beta-tester-session-preflight.json",
      ranImmediatelyBeforeContact: true,
      status: "passed",
      passed: 12,
      total: 12
    },
    sessionEvidence: {
      publicBetaUrlOpened: true,
      stableTaskRunCompleted: true,
      publicTraceReviewed: true,
      correctionSubmitted: true,
      ruleProvenanceReviewed: true,
      rerunCompleted: true,
      manualTestHumanReviewSaved: true,
      manualTestEvidencePath: "",
      feedbackReceiptPath: "submitted.json",
      screenshotOrNotesPath: ""
    },
    returnPipeline: {
      verifyFeedbackCommand: "npm run verify:public-beta-feedback -- --receipt path/to/submitted-feedback.json",
      intakeFeedbackCommand: "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
      verifyCollectionCommand: "npm run verify:public-beta-feedback-collection",
      followUpPlanCommand: "npm run plan:public-beta-follow-up",
      verifyFollowUpPlanCommand: "npm run verify:public-beta-follow-up-plan",
      releaseReadinessCommand: "npm run verify:product-release-readiness -- --allow-blocked",
      feedbackReceiptValidated: sessionDecision === "ready_for_feedback_intake",
      feedbackReceiptIntaked: sessionDecision === "ready_for_feedback_intake",
      followUpPlanRefreshed: sessionDecision === "ready_for_feedback_intake"
    },
    blockers: {
      blockingIssue:
        sessionDecision === "blocked"
          ? "A blocking issue was found."
          : sessionDecision === "needs_fix_before_more_testers"
            ? "A non-blocking fix is required before inviting another tester."
            : "",
      confusingUx: "",
      missingEvidence: sessionDecision === "needs_fix_before_more_testers" ? "Follow-up wording needs review before more testers." : "",
      unsafeOrUnexpectedBehavior: "",
      evidencePath: ""
    },
    sessionDecision,
    nextActionRecommendation:
      sessionDecision === "ready_for_feedback_intake"
        ? "Use feedback intake and follow-up plan before inviting another tester."
        : "Stop and review the session blocker before inviting another tester.",
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

function writeJson(targetPath: string, body: unknown) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(body, null, 2));
}

function validFirstRealTesterSendReceiptValidation() {
  return {
    responseMode: "first_real_tester_send_receipt_template_verification_json_v1",
    status: "passed",
    command: "npm run verify:first-real-tester-send-receipt-template -- --receipt filled-first-real-send-receipt.json",
    inputPath: "filled-first-real-send-receipt.json",
    mode: "submitted",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    decision: "sent_manually",
    passed: 9,
    total: 9,
    checks: []
  };
}

type SessionBodyFixture = ReturnType<typeof validSessionReceipt>;

function attachManualEvidenceIfNeeded(dir: string, sessionBody?: unknown) {
  const candidate = sessionBody as SessionBodyFixture | undefined;
  if (candidate?.sessionEvidence?.manualTestHumanReviewSaved !== true) return;
  if (candidate.sessionEvidence.manualTestEvidencePath) return;

  const manualEvidencePath = path.join(dir, "manual-acceptance-latest.json");
  candidate.sessionEvidence.manualTestEvidencePath = manualEvidencePath;
  writeJson(manualEvidencePath, validManualAcceptanceEvidence());
}

function runScenario(
  name: string,
  body: unknown,
  sessionBody?: unknown,
  options: { includeSendReceiptValidation?: boolean } = {}
) {
  const dir = path.join(tempRoot, name);
  const sourceReceipt = path.join(dir, "submitted.json");
  const sessionReceipt = path.join(dir, "session.json");
  const inboxDir = path.join(dir, "inbox");
  const sessionInboxDir = path.join(dir, "session-inbox");
  const outputPath = path.join(dir, "intake.json");
  const collectionPath = path.join(dir, "collection.json");
  const followUpPlanPath = path.join(dir, "follow-up-plan.json");
  const sendReceiptValidationPath = path.join(dir, "first-real-tester-send-receipt-validation.json");
  fs.rmSync(dir, { recursive: true, force: true });
  if (options.includeSendReceiptValidation !== false) {
    writeJson(sendReceiptValidationPath, validFirstRealTesterSendReceiptValidation());
  }
  writeJson(sourceReceipt, body);
  attachManualEvidenceIfNeeded(dir, sessionBody);
  if (sessionBody) writeJson(sessionReceipt, sessionBody);

  return intakePublicBetaReturn({
    receiptPath: sourceReceipt,
    sessionReceiptPath: sessionBody ? sessionReceipt : null,
    inboxDir,
    sessionInboxDir,
    outputPath,
    collectionPath,
    followUpPlanPath,
    sendReceiptValidationPath
  });
}

function locked(intake: ReturnType<typeof intakePublicBetaReturn>) {
  return (
    intake.releaseDecision === "do_not_release" &&
    intake.reviewOnly === true &&
    intake.accepted === false &&
    intake.packagingGated === true &&
    intake.locks.mustNotSaveAcceptance === true &&
    intake.locks.mustNotUnlockPackaging === true &&
    intake.locks.mustNotClaimReleaseReady === true &&
    intake.locks.mustNotResumeAllSoftwareObjective === true
  );
}

function main() {
  const checks: VerificationCheck[] = [];
  fs.rmSync(tempRoot, { recursive: true, force: true });

  const ready = runScenario("ready", validReceipt("ready_for_next_beta_tester"), validSessionReceipt());
  push(
    checks,
    "Valid ready feedback is copied, collected, and planned",
    ready.status === "processed" &&
      ready.copiedReceiptPath !== null &&
      ready.copiedSessionReceiptPath !== null &&
      ready.collection.status === "ready_for_next_beta_tester" &&
      ready.collection.validReceipts === 1 &&
      ready.followUpPlan.status === "ready_for_next_beta_tester" &&
      ready.followUpPlan.canInviteNextTester === true &&
      locked(ready),
    `status=${ready.status}; feedbackCopied=${Boolean(ready.copiedReceiptPath)}; sessionCopied=${Boolean(ready.copiedSessionReceiptPath)}; collection=${ready.collection.status}; plan=${ready.followUpPlan.status}`
  );

  const needsFix = runScenario("needs-fix", validReceipt("needs_fix_before_more_testers"), validSessionReceipt("needs_fix_before_more_testers"));
  push(
    checks,
    "Needs-fix feedback is processed but blocks next tester intake",
    needsFix.status === "processed" &&
      needsFix.collection.status === "needs_fix_before_more_testers" &&
      needsFix.followUpPlan.status === "needs_fix_before_more_testers" &&
      needsFix.followUpPlan.canInviteNextTester === false &&
      locked(needsFix),
    `status=${needsFix.status}; collection=${needsFix.collection.status}; invite=${needsFix.followUpPlan.canInviteNextTester}`
  );

  const invalidSessionReceipt = validSessionReceipt();
  invalidSessionReceipt.facilitator.name = "";
  const invalidSession = runScenario("invalid-session", validReceipt("ready_for_next_beta_tester"), invalidSessionReceipt);
  push(
    checks,
    "Invalid session receipt rejects the whole beta return and copies nothing",
    invalidSession.status === "rejected" &&
      invalidSession.copiedReceiptPath === null &&
      invalidSession.copiedSessionReceiptPath === null &&
      invalidSession.collection.status === "not_refreshed" &&
      invalidSession.followUpPlan.status === "not_refreshed" &&
      locked(invalidSession),
    `status=${invalidSession.status}; feedbackCopied=${Boolean(invalidSession.copiedReceiptPath)}; sessionCopied=${Boolean(
      invalidSession.copiedSessionReceiptPath
    )}`
  );

  const missingHumanReviewSessionReceipt = validSessionReceipt("ready_for_feedback_intake");
  missingHumanReviewSessionReceipt.sessionEvidence.manualTestHumanReviewSaved = false;
  missingHumanReviewSessionReceipt.sessionEvidence.manualTestEvidencePath = "";
  const missingHumanReview = runScenario(
    "missing-human-review",
    validReceipt("ready_for_next_beta_tester"),
    missingHumanReviewSessionReceipt
  );
  push(
    checks,
    "Missing manual-test human_review evidence rejects otherwise valid beta return",
    missingHumanReview.status === "rejected" &&
      missingHumanReview.copiedReceiptPath === null &&
      missingHumanReview.copiedSessionReceiptPath === null &&
      missingHumanReview.collection.status === "not_refreshed" &&
      missingHumanReview.followUpPlan.status === "not_refreshed" &&
      locked(missingHumanReview),
    `status=${missingHumanReview.status}; manualReview=${missingHumanReviewSessionReceipt.sessionEvidence.manualTestHumanReviewSaved}; feedbackCopied=${Boolean(
      missingHumanReview.copiedReceiptPath
    )}`
  );

  const automatedEvidenceDir = path.join(tempRoot, "external-automated-manual-evidence");
  const automatedEvidencePath = path.join(automatedEvidenceDir, "manual-acceptance-latest.json");
  const automatedManualReviewSessionReceipt = validSessionReceipt("ready_for_feedback_intake");
  automatedManualReviewSessionReceipt.sessionEvidence.manualTestHumanReviewSaved = true;
  automatedManualReviewSessionReceipt.sessionEvidence.manualTestEvidencePath = automatedEvidencePath;
  writeJson(automatedEvidencePath, automatedManualAcceptanceEvidence());
  const automatedManualReview = runScenario(
    "automated-manual-evidence",
    validReceipt("ready_for_next_beta_tester"),
    automatedManualReviewSessionReceipt
  );
  push(
    checks,
    "Automation-backed manual-test evidence rejects otherwise valid beta return",
    automatedManualReview.status === "rejected" &&
      automatedManualReview.copiedReceiptPath === null &&
      automatedManualReview.copiedSessionReceiptPath === null &&
      automatedManualReview.collection.status === "not_refreshed" &&
      automatedManualReview.followUpPlan.status === "not_refreshed" &&
      locked(automatedManualReview),
    `status=${automatedManualReview.status}; evidenceKind=automated_browser_smoke; feedbackCopied=${Boolean(
      automatedManualReview.copiedReceiptPath
    )}`
  );

  const noNoteEvidenceDir = path.join(tempRoot, "external-no-note-manual-evidence");
  const noNoteEvidencePath = path.join(noNoteEvidenceDir, "manual-acceptance-latest.json");
  const noNoteSessionReceipt = validSessionReceipt("ready_for_feedback_intake");
  noNoteSessionReceipt.sessionEvidence.manualTestHumanReviewSaved = true;
  noNoteSessionReceipt.sessionEvidence.manualTestEvidencePath = noNoteEvidencePath;
  writeJson(noNoteEvidencePath, noNoteManualAcceptanceEvidence());
  const noNoteManualReview = runScenario(
    "no-note-manual-evidence",
    validReceipt("ready_for_next_beta_tester"),
    noNoteSessionReceipt
  );
  push(
    checks,
    "Human-review evidence without per-step notes rejects otherwise valid beta return",
    noNoteManualReview.status === "rejected" &&
      noNoteManualReview.copiedReceiptPath === null &&
      noNoteManualReview.copiedSessionReceiptPath === null &&
      noNoteManualReview.collection.status === "not_refreshed" &&
      noNoteManualReview.followUpPlan.status === "not_refreshed" &&
      locked(noNoteManualReview),
    `status=${noNoteManualReview.status}; evidenceKind=human_review; feedbackCopied=${Boolean(noNoteManualReview.copiedReceiptPath)}`
  );

  const missingSendReceiptValidation = runScenario(
    "missing-send-receipt-validation",
    validReceipt("ready_for_next_beta_tester"),
    validSessionReceipt(),
    { includeSendReceiptValidation: false }
  );
  push(
    checks,
    "Missing first-real tester send receipt validation rejects otherwise valid beta return",
    missingSendReceiptValidation.status === "rejected" &&
      missingSendReceiptValidation.copiedReceiptPath === null &&
      missingSendReceiptValidation.copiedSessionReceiptPath === null &&
      missingSendReceiptValidation.collection.status === "not_refreshed" &&
      missingSendReceiptValidation.followUpPlan.status === "not_refreshed" &&
      missingSendReceiptValidation.firstRealTesterSendReceiptValidation.passed === false &&
      missingSendReceiptValidation.steps.some(
        (step) =>
          step.label === "Verify first-real tester manual send receipt before return intake" && step.status === "failed"
      ) &&
      locked(missingSendReceiptValidation),
    `status=${missingSendReceiptValidation.status}; sendReceipt=${missingSendReceiptValidation.firstRealTesterSendReceiptValidation.status}; feedbackCopied=${Boolean(
      missingSendReceiptValidation.copiedReceiptPath
    )}`
  );

  const missingSession = runScenario("missing-session", validReceipt("ready_for_next_beta_tester"));
  push(
    checks,
    "Missing session receipt rejects otherwise valid feedback and copies nothing",
    missingSession.status === "rejected" &&
      missingSession.copiedReceiptPath === null &&
      missingSession.copiedSessionReceiptPath === null &&
      missingSession.collection.status === "not_refreshed" &&
      missingSession.followUpPlan.status === "not_refreshed" &&
      missingSession.command.includes("--session-receipt <missing>") &&
      locked(missingSession),
    `status=${missingSession.status}; command=${missingSession.command}; feedbackCopied=${Boolean(missingSession.copiedReceiptPath)}`
  );

  const mismatchedFeedback = validReceipt('ready_for_next_beta_tester');
  mismatchedFeedback.tester.name = 'Different Beta Tester';
  const mismatchedSession = runScenario('mismatched-session', mismatchedFeedback, validSessionReceipt());
  push(
    checks,
    'Mismatched feedback and session receipts reject the beta return and copy nothing',
    mismatchedSession.status === 'rejected' &&
      mismatchedSession.copiedReceiptPath === null &&
      mismatchedSession.copiedSessionReceiptPath === null &&
      mismatchedSession.collection.status === 'not_refreshed' &&
      mismatchedSession.followUpPlan.status === 'not_refreshed' &&
      mismatchedSession.steps.some((step) => step.label === 'Bind feedback receipt to the same tester session and submitted feedback path' && step.status === 'failed') &&
      locked(mismatchedSession),
    `status=${mismatchedSession.status}; feedbackCopied=${Boolean(mismatchedSession.copiedReceiptPath)}; sessionCopied=${Boolean(
      mismatchedSession.copiedSessionReceiptPath
    )}`
  );

  const mismatchedFeedbackPathSessionReceipt = validSessionReceipt();
  mismatchedFeedbackPathSessionReceipt.sessionEvidence.feedbackReceiptPath = 'wrong-submitted.json';
  const mismatchedFeedbackPath = runScenario(
    'mismatched-feedback-path',
    validReceipt('ready_for_next_beta_tester'),
    mismatchedFeedbackPathSessionReceipt
  );
  push(
    checks,
    'Mismatched session feedbackReceiptPath rejects the beta return and copies nothing',
    mismatchedFeedbackPath.status === 'rejected' &&
      mismatchedFeedbackPath.copiedReceiptPath === null &&
      mismatchedFeedbackPath.copiedSessionReceiptPath === null &&
      mismatchedFeedbackPath.collection.status === 'not_refreshed' &&
      mismatchedFeedbackPath.followUpPlan.status === 'not_refreshed' &&
      mismatchedFeedbackPath.steps.some(
        (step) =>
          step.label === 'Bind feedback receipt to the same tester session and submitted feedback path' &&
          step.status === 'failed' &&
          step.outputTail.includes('matchedSubmittedFeedback=false')
      ) &&
      locked(mismatchedFeedbackPath),
    `status=${mismatchedFeedbackPath.status}; feedbackCopied=${Boolean(
      mismatchedFeedbackPath.copiedReceiptPath
    )}; sessionCopied=${Boolean(mismatchedFeedbackPath.copiedSessionReceiptPath)}`
  );

  const invalidReceipt = validReceipt("ready_for_next_beta_tester");
  invalidReceipt.tester.name = "";
  invalidReceipt.locks.mustNotUnlockPackaging = false;
  const invalid = runScenario("invalid", invalidReceipt, validSessionReceipt());
  push(
    checks,
    "Invalid feedback is rejected and not copied into the inbox",
    invalid.status === "rejected" &&
      invalid.copiedReceiptPath === null &&
      invalid.copiedSessionReceiptPath === null &&
      invalid.collection.status === "not_refreshed" &&
      invalid.followUpPlan.status === "not_refreshed" &&
      locked(invalid),
    `status=${invalid.status}; copied=${Boolean(invalid.copiedReceiptPath)}; sessionCopied=${Boolean(
      invalid.copiedSessionReceiptPath
    )}; collection=${invalid.collection.status}`
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "public_beta_return_intake_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:public-beta-return-intake",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Return intake behavior is verified; use intake:public-beta-return when a tester sends a filled receipt."
        : "Fix return intake behavior before processing tester feedback."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nPublic beta return intake verification written to ${receiptPath}`);

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
