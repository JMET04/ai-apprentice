import fs from "node:fs";
import path from "node:path";
import { intakeRealModelTrialReturn } from "./intake-real-model-trial-return";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const tempRoot = path.join(artifactsDir, "real-model-trial-return-intake-verification-tmp");
const receiptPath = path.join(artifactsDir, "real-model-trial-return-intake-verification.json");

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function submittedReceipt(decision: "needs_follow_up" | "blocked" | "ready_for_separate_acceptance_review") {
  return {
    responseMode: "real_model_trial_receipt_json_v1",
    status: "submitted",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canActivateRealModel: false,
    canRelease: false,
    modelTrialDecisionAllowedValues: ["needs_follow_up", "blocked", "ready_for_separate_acceptance_review"],
    defaultModelTrialDecision: "needs_follow_up",
    reviewer: {
      name: "Model Reviewer",
      role: "model trial reviewer",
      date: "2026-06-24",
      environment: "local product runtime"
    },
    redactedProviderConfig: {
      aiProvider: "openai",
      openAIModel: "gpt-test-model",
      openAIBaseUrl: "https://api.example.test/v1",
      apiKeyRedacted: true,
      noSecretsCommitted: true,
      configSource: ".env.local outside source control"
    },
    preTrialStatus: {
      aiServiceStatusPath: "artifacts/productization/ai-service-status-before.json",
      activeProviderBeforeTrial: "mock",
      manualProviderAcceptanceBeforeTrial: false,
      releaseDecisionBeforeTrial: "do_not_release",
      packagingGatedBeforeTrial: true
    },
    postTrialStatus: {
      aiServiceStatusAfterRollbackPath: "artifacts/productization/ai-service-status-after-rollback.json",
      activeProviderAfterRollback: "mock",
      manualProviderAcceptanceAfterRollback: false,
      releaseDecisionAfterTrial: "do_not_release",
      packagingGatedAfterTrial: true
    },
    trialEvidence: {
      aiServiceStatusDuringTrialPath: "artifacts/productization/ai-service-status-during-real-model-trial.json",
      boundedTaskRunPath: "artifacts/productization/real-model-trial-run.json",
      traceOrScreenshotPath: "artifacts/productization/real-model-trial-trace.png",
      modelOutputEvidencePath: "artifacts/productization/real-model-trial-output.json",
      mockComparisonNotes: "Reviewer compared real-model output against the mock baseline.",
      rollbackNotes: "Runtime was returned to AI_PROVIDER=mock after the trial."
    },
    trialChecks: {
      providerConfiguredOutsideSourceControl: true,
      realProviderActivationWasExplicitForTrial: true,
      outputTraceVisible: true,
      modelOutputComparedToMock: true,
      noSecretsInArtifacts: true,
      noRulesEnabledByTrial: true,
      noLongTermAcceptanceSaved: true,
      packagingStillGated: true,
      releaseStillDoNotRelease: true,
      allSoftwareStillPaused: true,
      rollbackToMockConfirmed: true
    },
    blockers: {
      blockingIssue: decision === "blocked" ? "Reviewer found a model quality blocker." : "",
      confusingOutput: "",
      missingEvidence: "",
      unsafeOrUnexpectedBehavior: "",
      evidencePath: decision === "blocked" ? "artifacts/productization/real-model-trial-output.json" : ""
    },
    modelTrialDecision: decision,
    nextActionRecommendation:
      decision === "ready_for_separate_acceptance_review"
        ? "Send the archived evidence to a separate model acceptance reviewer."
        : decision === "blocked"
          ? "Stop real-model rollout and resolve the blocker."
          : "Plan follow-up before another model trial.",
    locks: {
      mustNotCommitSecrets: true,
      mustNotSaveAcceptance: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotResumeAllSoftwareObjective: true
    }
  };
}


type RealModelTrialFixture = ReturnType<typeof submittedReceipt>;
function writeJson(targetPath: string, body: unknown) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(body, null, 2));
}


function attachTrialEvidence(dir: string, body: RealModelTrialFixture) {
  const preTrialStatusPath = path.join(dir, "ai-service-status-before.json");
  const duringTrialStatusPath = path.join(dir, "ai-service-status-during-real-model-trial.json");
  const postTrialStatusPath = path.join(dir, "ai-service-status-after-rollback.json");
  const boundedTaskRunPath = path.join(dir, "real-model-trial-run.json");
  const traceOrScreenshotPath = path.join(dir, "real-model-trial-trace.txt");
  const modelOutputEvidencePath = path.join(dir, "real-model-trial-output.json");

  body.preTrialStatus.aiServiceStatusPath = preTrialStatusPath;
  body.trialEvidence.aiServiceStatusDuringTrialPath = duringTrialStatusPath;
  body.postTrialStatus.aiServiceStatusAfterRollbackPath = postTrialStatusPath;
  body.trialEvidence.boundedTaskRunPath = boundedTaskRunPath;
  body.trialEvidence.traceOrScreenshotPath = traceOrScreenshotPath;
  body.trialEvidence.modelOutputEvidencePath = modelOutputEvidencePath;

  writeJson(preTrialStatusPath, {
    responseMode: "ai_service_runtime_status_json_v1",
    activeProvider: "mock",
    requestedProvider: "openai",
    status: "real_provider_configured_waiting_manual_acceptance",
    realModelReady: false,
    configured: {
      openAICompatible: true,
      openAIModel: body.redactedProviderConfig.openAIModel,
      openAIBaseUrl: body.redactedProviderConfig.openAIBaseUrl,
      manualProviderAcceptance: false
    },
    safetyBoundary: {
      mockFallback: true,
      accepted: false,
      packagingGated: true
    }
  });
  writeJson(duringTrialStatusPath, {
    responseMode: "ai_service_runtime_status_json_v1",
    activeProvider: "openai",
    requestedProvider: "openai",
    status: "real_provider_active_after_manual_acceptance",
    realModelReady: true,
    configured: {
      openAICompatible: true,
      openAIModel: body.redactedProviderConfig.openAIModel,
      openAIBaseUrl: body.redactedProviderConfig.openAIBaseUrl,
      manualProviderAcceptance: true
    },
    safetyBoundary: {
      mockFallback: false,
      accepted: true,
      packagingGated: true
    }
  });
  writeJson(postTrialStatusPath, {
    responseMode: "ai_service_runtime_status_json_v1",
    activeProvider: "mock",
    requestedProvider: "openai",
    status: "mock_active_after_trial_rollback",
    realModelReady: false,
    configured: {
      openAICompatible: true,
      openAIModel: body.redactedProviderConfig.openAIModel,
      openAIBaseUrl: body.redactedProviderConfig.openAIBaseUrl,
      manualProviderAcceptance: false
    },
    safetyBoundary: {
      mockFallback: true,
      accepted: false,
      packagingGated: true
    }
  });

  writeJson(boundedTaskRunPath, {
    responseMode: "real_model_trial_bounded_task_run_json_v1",
    provider: "openai",
    traceVisible: true,
    comparedToMock: true,
    noSecretsInArtifacts: true,
    noRulesEnabledByTrial: true,
    noLongTermAcceptanceSaved: true,
    accepted: false,
    packagingGated: true,
    releaseDecision: "do_not_release"
  });
  fs.writeFileSync(traceOrScreenshotPath, "real model trial trace was visible; no secrets recorded");
  writeJson(modelOutputEvidencePath, {
    responseMode: "real_model_trial_output_evidence_json_v1",
    provider: "openai",
    traceVisible: true,
    comparedToMock: true,
    noSecretsInArtifacts: true,
    noRulesEnabledByTrial: true,
    noLongTermAcceptanceSaved: true,
    accepted: false,
    packagingGated: true,
    releaseDecision: "do_not_release"
  });
}
function runScenario(name: string, body: RealModelTrialFixture, options: { attachEvidence?: boolean } = {}) {
  const dir = path.join(tempRoot, name);
  const sourceReceipt = path.join(dir, "submitted.json");
  const inboxDir = path.join(dir, "inbox");
  const outputPath = path.join(dir, "intake.json");
  fs.rmSync(dir, { recursive: true, force: true });
  if (options.attachEvidence !== false) {
    attachTrialEvidence(dir, body);
  }
  writeJson(sourceReceipt, body);

  return intakeRealModelTrialReturn({
    receiptPath: sourceReceipt,
    inboxDir,
    outputPath
  });
}

function locked(intake: ReturnType<typeof intakeRealModelTrialReturn>) {
  return (
    intake.releaseDecision === "do_not_release" &&
    intake.reviewOnly === true &&
    intake.accepted === false &&
    intake.packagingGated === true &&
    intake.canActivateRealModel === false &&
    intake.canRelease === false &&
    intake.locks.mustNotCommitSecrets === true &&
    intake.locks.mustNotSaveAcceptanceFromReceipt === true &&
    intake.locks.mustNotActivateRealModel === true &&
    intake.locks.mustNotUnlockPackaging === true &&
    intake.locks.mustNotClaimReleaseReady === true &&
    intake.locks.mustNotResumeAllSoftwareObjective === true
  );
}

function main() {
  const checks: VerificationCheck[] = [];
  const selfReportedOnly = runScenario(
    "self-reported-only",
    submittedReceipt("ready_for_separate_acceptance_review"),
    { attachEvidence: false }
  );
  push(
    checks,
    "Self-reported real-model trial evidence without artifacts is rejected",
    selfReportedOnly.status === "rejected" && selfReportedOnly.copiedReceiptPath === null && locked(selfReportedOnly),
    `status=${selfReportedOnly.status}; copied=${Boolean(selfReportedOnly.copiedReceiptPath)}; validation=${selfReportedOnly.receiptValidation.status}`
  );
  fs.rmSync(tempRoot, { recursive: true, force: true });

  const ready = runScenario("ready", submittedReceipt("ready_for_separate_acceptance_review"));
  push(
    checks,
    "Ready real-model receipt is archived without accepting the model",
    ready.status === "recorded_ready_for_separate_acceptance_review" &&
      ready.copiedReceiptPath !== null &&
      ready.receiptValidation.status === "passed" &&
      ready.releaseReadiness.releaseDecision === "do_not_release" &&
      locked(ready),
    `status=${ready.status}; copied=${Boolean(ready.copiedReceiptPath)}; validation=${ready.receiptValidation.status}; release=${ready.releaseReadiness.releaseDecision}`
  );

  const blocked = runScenario("blocked", submittedReceipt("blocked"));
  push(
    checks,
    "Blocked real-model receipt is archived as follow-up evidence",
    blocked.status === "recorded_blocked" &&
      blocked.copiedReceiptPath !== null &&
      blocked.releaseReadiness.releaseDecision === "do_not_release" &&
      locked(blocked),
    `status=${blocked.status}; copied=${Boolean(blocked.copiedReceiptPath)}; release=${blocked.releaseReadiness.releaseDecision}`
  );

  const invalidReceipt = submittedReceipt("ready_for_separate_acceptance_review");
  invalidReceipt.reviewer.name = "";
  invalidReceipt.locks.mustNotUnlockPackaging = false;
  const invalid = runScenario("invalid", invalidReceipt);
  push(
    checks,
    "Invalid real-model receipt is rejected and not copied",
    invalid.status === "rejected" && invalid.copiedReceiptPath === null && locked(invalid),
    `status=${invalid.status}; copied=${Boolean(invalid.copiedReceiptPath)}`
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "real_model_trial_return_intake_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:real-model-trial-return-intake",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canActivateRealModel: false,
    canRelease: false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Use intake:real-model-trial-return when a real-model trial reviewer returns a filled receipt."
        : "Fix real-model trial return intake behavior before relying on returned model evidence."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nReal-model trial return intake verification written to ${receiptPath}`);

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
