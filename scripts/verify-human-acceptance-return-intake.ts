import fs from "node:fs";
import path from "node:path";
import { intakeHumanAcceptanceReturn } from "./intake-human-acceptance-return";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const tempRoot = path.join(artifactsDir, "human-acceptance-return-intake-verification-tmp");
const receiptPath = path.join(artifactsDir, "human-acceptance-return-intake-verification.json");

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function submittedReceipt(decision: "ready_for_gate_verification" | "needs_follow_up" | "blocked") {
  const passed = decision !== "blocked";
  return {
    responseMode: "human_acceptance_review_receipt_json_v1",
    status: "submitted",
    productScope: "bounded_core_teaching_loop",
    stableTaskId: "task-photo-travel-journal",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    humanAcceptanceDecisionAllowedValues: ["needs_follow_up", "blocked", "ready_for_gate_verification"],
    defaultHumanAcceptanceDecision: "needs_follow_up",
    reviewer: {
      name: "Human Reviewer",
      role: "product reviewer",
      date: "2026-06-24",
      environment: "local product runtime"
    },
    reviewedFlow: {
      manualTestUrl: "http://127.0.0.1:3000/manual-test",
      runUrl: "http://127.0.0.1:3000/tasks/task-photo-travel-journal/run",
      reviewUrl: "http://127.0.0.1:3000/tasks/task-photo-travel-journal/review"
    },
    manualTestEvidence: {
      savedReceiptPath: "artifacts/productization/manual-acceptance-history/manual-acceptance-human-review.json",
      latestReportPath: "artifacts/productization/manual-acceptance-latest.json",
      historyReportPath: "artifacts/productization/manual-acceptance-history/manual-acceptance-human-review.json",
      evidenceKind: "human_review",
      humanReviewed: true,
      automationGenerated: false,
      classificationReason: "valid_human_review_evidence"
    },
    gateVerification: {
      gateReportPath: "artifacts/productization/human-acceptance-gate.json",
      command: "npm run verify:human-acceptance",
      status: passed ? "passed" : "blocked_needs_human_review",
      latestEvidenceKind: passed ? "human_review" : "automated_browser_smoke",
      latestHumanReviewed: passed,
      latestAutomationGenerated: !passed
    },
    reviewChecks: {
      manualTestOpened: passed,
      stableTaskRunCompleted: passed,
      traceVisibleWithoutPrivateCot: passed,
      correctionLoopReviewed: passed,
      allManualStepsPassedWithNotes: passed,
      manualReviewAttestationConfirmed: passed,
      savedEvidenceKindHumanReview: passed,
      savedEvidenceVerifiedByGate: passed,
      packagingStillGated: true,
      releaseStillDoNotRelease: true,
      allSoftwareStillPaused: true,
      realModelNotAcceptedByThisReview: true
    },
    stepResults: [
      "open_manual_test",
      "run_stable_task",
      "inspect_trace_and_review",
      "exercise_correction_loop",
      "save_human_review_evidence",
      "maintainer_verify_gate"
    ].map((id) => ({
      id,
      status: passed ? "passed" : "blocked",
      note: passed ? `Reviewer completed ${id}.` : `Reviewer blocked on ${id}.`,
      evidencePath: "artifacts/productization/manual-acceptance-latest.json"
    })),
    blockers: {
      blockingIssue: decision === "blocked" ? "Reviewer found a blocking issue." : "",
      confusingUx: "",
      missingEvidence: "",
      unsafeOrUnexpectedBehavior: "",
      evidencePath: ""
    },
    humanAcceptanceDecision: decision,
    nextActionRecommendation:
      decision === "ready_for_gate_verification"
        ? "Run the gate verification and continue release blocker planning."
        : decision === "blocked"
          ? "Stop and fix the blocker before relying on human acceptance."
          : "Follow up before gate verification.",
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


type HumanAcceptanceFixture = ReturnType<typeof submittedReceipt>;
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


function attachManualHumanReviewEvidence(dir: string, body: HumanAcceptanceFixture) {
  const savedReceiptPath = path.join(dir, "manual-acceptance-human-review.json");
  const latestReportPath = path.join(dir, "manual-acceptance-latest.json");
  const gateReportPath = path.join(dir, "human-acceptance-gate.json");

  body.manualTestEvidence.savedReceiptPath = savedReceiptPath;
  body.manualTestEvidence.latestReportPath = latestReportPath;
  body.manualTestEvidence.historyReportPath = savedReceiptPath;
  body.gateVerification.gateReportPath = gateReportPath;
  body.gateVerification.status = "passed";
  body.gateVerification.latestEvidenceKind = "human_review";
  body.gateVerification.latestHumanReviewed = true;
  body.gateVerification.latestAutomationGenerated = false;

  const steps = body.stepResults.map((step) => ({
    id: step.id,
    status: "passed",
    note: step.note || `Reviewer completed ${step.id}.`
  }));
  const evidence = {
    responseMode: "manual_acceptance_saved_receipt_json_v1",
    savedAt: "2026-06-24T00:00:00.000Z",
    source: "manual-test-workbench",
    evidenceKind: "human_review",
    humanReviewed: true,
    automationGenerated: false,
    classificationReason: "valid_human_review_evidence",
    latestReportPath,
    historyReportPath: savedReceiptPath,
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    humanReviewEvidence: {
      responseMode: "manual_test_workbench_human_review_evidence_v1",
      reviewerName: body.reviewer.name,
      stepCount: steps.length,
      attestation: "human-reviewed-manual-test-workbench",
      savedFrom: "manual-test-workbench"
    },
    report: {
      summary: {
        passed: steps.length,
        failed: 0,
        notRun: 0,
        readyForHumanTrial: true
      },
      steps
    }
  };

  const gate = {
    responseMode: "human_acceptance_gate_json_v1",
    status: "passed",
    latestEvidenceKind: "human_review",
    latestHumanReviewed: true,
    latestAutomationGenerated: false,
    releaseBoundary: {
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    },
    passed: steps.length,
    total: steps.length,
    checks: steps.map((step) => ({
      name: step.id,
      pass: true,
      evidence: step.note
    }))
  };

  writeJson(savedReceiptPath, evidence);
  writeJson(latestReportPath, evidence);
  writeJson(gateReportPath, gate);
}
function runScenario(
  name: string,
  body: HumanAcceptanceFixture,
  options: { attachEvidence?: boolean; includeSendReceiptValidation?: boolean } = {}
) {
  const dir = path.join(tempRoot, name);
  const sourceReceipt = path.join(dir, "submitted.json");
  const inboxDir = path.join(dir, "inbox");
  const outputPath = path.join(dir, "intake.json");
  const sendReceiptValidationPath = path.join(dir, "first-real-tester-send-receipt-validation.json");
  fs.rmSync(dir, { recursive: true, force: true });
  if (options.includeSendReceiptValidation !== false) {
    writeJson(sendReceiptValidationPath, validFirstRealTesterSendReceiptValidation());
  }
  if (options.attachEvidence !== false) {
    attachManualHumanReviewEvidence(dir, body);
  }
  writeJson(sourceReceipt, body);

  return intakeHumanAcceptanceReturn({
    receiptPath: sourceReceipt,
    inboxDir,
    outputPath,
    sendReceiptValidationPath
  });
}

function locked(intake: ReturnType<typeof intakeHumanAcceptanceReturn>) {
  return (
    intake.releaseDecision === "do_not_release" &&
    intake.reviewOnly === true &&
    intake.accepted === false &&
    intake.packagingGated === true &&
    intake.canRelease === false &&
    intake.canActivateRealModel === false &&
    intake.locks.mustNotSaveAcceptanceFromReceipt === true &&
    intake.locks.mustNotUnlockPackaging === true &&
    intake.locks.mustNotClaimReleaseReady === true &&
    intake.locks.mustNotAcceptRealModel === true &&
    intake.locks.mustNotResumeAllSoftwareObjective === true
  );
}

function refreshedHandoff(intake: ReturnType<typeof intakeHumanAcceptanceReturn>) {
  return intake.refreshedHandoffArtifacts.releaseReadiness === "passed";
}

function postIntakeRefreshIsSafe(intake: ReturnType<typeof intakeHumanAcceptanceReturn>) {
  const refresh = intake.postIntakeRefresh;
  return (
    refresh.requiredAfterReturnIntakeVerification === true &&
    refresh.commandSequence[0] === "npm run verify:human-acceptance-return-intake" &&
    refresh.commandSequence.includes("npm run build:human-acceptance-reviewer-invite") &&
    refresh.commandSequence.includes("npm run verify:human-acceptance-reviewer-invite") &&
    refresh.commandSequence.includes("npm run build:real-model-trial-kit") &&
    refresh.commandSequence.includes("npm run verify:real-model-trial-kit") &&
    refresh.commandSequence.includes("npm run build:product-status-summary") &&
    refresh.commandSequence.includes("npm run build:product-takeover-matrix") &&
    refresh.commandSequence.at(-1) === "npm run verify:productization-evidence-freshness" &&
    refresh.blockedUntilVerificationPasses.some((item) => item.includes("failed human-acceptance-return-intake")) &&
    refresh.blockedUntilVerificationPasses.some((item) => item.includes("Do not unlock packaging"))
  );
}


function main() {
  const checks: VerificationCheck[] = [];
  fs.rmSync(tempRoot, { recursive: true, force: true });

  const valid = runScenario("valid-needs-gate", submittedReceipt("ready_for_gate_verification"));
  push(
    checks,
    "Valid human acceptance receipt is archived without claiming gate pass",
    valid.status === "recorded_needs_gate_verification" &&
      valid.copiedReceiptPath !== null &&
      valid.humanAcceptanceGate.status === "blocked_needs_human_review" &&
      valid.humanAcceptanceGate.latestEvidenceKind === "automated_browser_smoke" &&
      locked(valid),
    `status=${valid.status}; copied=${Boolean(valid.copiedReceiptPath)}; gate=${valid.humanAcceptanceGate.status}; evidence=${valid.humanAcceptanceGate.latestEvidenceKind}`
  );

  const followUp = runScenario("needs-follow-up", submittedReceipt("needs_follow_up"));
  push(
    checks,
    "Needs-follow-up human receipt is archived but keeps release blocked",
    followUp.status === "recorded_needs_gate_verification" &&
      followUp.copiedReceiptPath !== null &&
      followUp.releaseReadiness.releaseDecision === "do_not_release" &&
      locked(followUp),
    `status=${followUp.status}; release=${followUp.releaseReadiness.releaseDecision}; copied=${Boolean(
      followUp.copiedReceiptPath
    )}`
  );

  push(
    checks,
    "Valid human return intake refreshes release gate and defers self-dependent material rebuilds",
    refreshedHandoff(valid) && refreshedHandoff(followUp) && postIntakeRefreshIsSafe(valid) && postIntakeRefreshIsSafe(followUp),
    `validRefresh=${JSON.stringify(valid.refreshedHandoffArtifacts)}; postSequence=${valid.postIntakeRefresh.commandSequence.length}; followUpRefresh=${JSON.stringify(
      followUp.refreshedHandoffArtifacts
    )}`
  );

  const missingSendReceiptValidation = runScenario(
    "missing-send-receipt-validation",
    submittedReceipt("ready_for_gate_verification"),
    { includeSendReceiptValidation: false }
  );
  push(
    checks,
    "Missing first-real tester send receipt validation rejects otherwise valid human return",
    missingSendReceiptValidation.status === "rejected" &&
      missingSendReceiptValidation.copiedReceiptPath === null &&
      missingSendReceiptValidation.firstRealTesterSendReceiptValidation.passed === false &&
      missingSendReceiptValidation.steps.some(
        (step) =>
          step.label === "Verify first-real tester manual send receipt before return intake" && step.status === "failed"
      ) &&
      locked(missingSendReceiptValidation),
    `status=${missingSendReceiptValidation.status}; sendReceipt=${missingSendReceiptValidation.firstRealTesterSendReceiptValidation.status}; copied=${Boolean(
      missingSendReceiptValidation.copiedReceiptPath
    )}`
  );

  const selfReportedOnly = runScenario(
    "self-reported-only",
    submittedReceipt("ready_for_gate_verification"),
    { attachEvidence: false }
  );
  push(
    checks,
    "Self-reported human_review evidence without saved artifact is rejected",
    selfReportedOnly.status === "rejected" && selfReportedOnly.copiedReceiptPath === null && locked(selfReportedOnly),
    `status=${selfReportedOnly.status}; copied=${Boolean(selfReportedOnly.copiedReceiptPath)}`
  );
  const invalidReceipt = submittedReceipt("ready_for_gate_verification");
  invalidReceipt.reviewer.name = "";
  invalidReceipt.locks.mustNotUnlockPackaging = false;
  const invalid = runScenario("invalid", invalidReceipt);
  push(
    checks,
    "Invalid human acceptance receipt is rejected and not copied",
    invalid.status === "rejected" && invalid.copiedReceiptPath === null && locked(invalid),
    `status=${invalid.status}; copied=${Boolean(invalid.copiedReceiptPath)}`
  );

  push(
    checks,
    "Invalid human return does not refresh handoff artifacts",
    Object.values(invalid.refreshedHandoffArtifacts).every((status) => status === "not_run"),
    `refresh=${JSON.stringify(invalid.refreshedHandoffArtifacts)}`
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "human_acceptance_return_intake_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:human-acceptance-return-intake",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Use intake:human-acceptance-return when a real reviewer returns a filled human acceptance receipt; then run the declared post-intake refresh sequence after this verifier passes."
        : "Fix human acceptance return intake behavior before relying on reviewer receipt returns."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nHuman acceptance return intake verification written to ${receiptPath}`);

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
