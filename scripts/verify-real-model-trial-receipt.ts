import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

type RealModelTrialReceipt = {
  responseMode?: string;
  status?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canActivateRealModel?: boolean;
  canRelease?: boolean;
  modelTrialDecisionAllowedValues?: string[];
  defaultModelTrialDecision?: string;
  reviewer?: {
    name?: string;
    role?: string;
    date?: string;
    environment?: string;
  };
  redactedProviderConfig?: {
    aiProvider?: string;
    openAIModel?: string;
    openAIBaseUrl?: string;
    apiKeyRedacted?: boolean | null;
    noSecretsCommitted?: boolean | null;
    configSource?: string;
  };
  preTrialStatus?: {
    aiServiceStatusPath?: string;
    activeProviderBeforeTrial?: string;
    manualProviderAcceptanceBeforeTrial?: boolean | null;
    releaseDecisionBeforeTrial?: string;
    packagingGatedBeforeTrial?: boolean | null;
  };
  postTrialStatus?: {
    aiServiceStatusAfterRollbackPath?: string;
    activeProviderAfterRollback?: string;
    manualProviderAcceptanceAfterRollback?: boolean | null;
    releaseDecisionAfterTrial?: string;
    packagingGatedAfterTrial?: boolean | null;
  };
  trialEvidence?: {
    aiServiceStatusDuringTrialPath?: string;
    boundedTaskRunPath?: string;
    traceOrScreenshotPath?: string;
    modelOutputEvidencePath?: string;
    mockComparisonNotes?: string;
    rollbackNotes?: string;
  };
  trialChecks?: {
    providerConfiguredOutsideSourceControl?: boolean | null;
    realProviderActivationWasExplicitForTrial?: boolean | null;
    outputTraceVisible?: boolean | null;
    modelOutputComparedToMock?: boolean | null;
    noSecretsInArtifacts?: boolean | null;
    noRulesEnabledByTrial?: boolean | null;
    noLongTermAcceptanceSaved?: boolean | null;
    packagingStillGated?: boolean | null;
    releaseStillDoNotRelease?: boolean | null;
    allSoftwareStillPaused?: boolean | null;
    rollbackToMockConfirmed?: boolean | null;
  };
  blockers?: {
    blockingIssue?: string;
    confusingOutput?: string;
    missingEvidence?: string;
    unsafeOrUnexpectedBehavior?: string;
    evidencePath?: string;
  };
  modelTrialDecision?: string;
  nextActionRecommendation?: string;
  locks?: {
    mustNotCommitSecrets?: boolean;
    mustNotSaveAcceptance?: boolean;
    mustNotEnableRules?: boolean;
    mustNotUnlockPackaging?: boolean;
    mustNotClaimReleaseReady?: boolean;
    mustNotResumeAllSoftwareObjective?: boolean;
  };
};


type AIServiceRuntimeStatusEvidence = {
  responseMode?: string;
  activeProvider?: string;
  requestedProvider?: string;
  status?: string;
  realModelReady?: boolean;
  configured?: {
    openAICompatible?: boolean;
    openAIModel?: string;
    openAIBaseUrl?: string;
    manualProviderAcceptance?: boolean;
  };
  safetyBoundary?: {
    mockFallback?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
  };
};

type TrialJsonEvidence = {
  responseMode?: string;
  provider?: string;
  traceVisible?: boolean;
  comparedToMock?: boolean;
  noSecretsInArtifacts?: boolean;
  noRulesEnabledByTrial?: boolean;
  noLongTermAcceptanceSaved?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  releaseDecision?: string;
};
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const defaultReceiptPath = path.join(artifactsDir, "real-model-trial-receipt.template.json");
const defaultValidationPath = path.join(artifactsDir, "real-model-trial-receipt-validation.json");
const allowedDecisions = ["needs_follow_up", "blocked", "ready_for_separate_acceptance_review"];

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFilledBoolean(value: unknown) {
  return typeof value === "boolean";
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
function readReceipt(receiptPath: string): RealModelTrialReceipt | null {
  try {
    const raw = fs.readFileSync(receiptPath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw) as RealModelTrialReceipt;
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

function evidenceFileExists(receiptPath: string, evidencePath: unknown) {
  const resolvedPath = resolveEvidencePath(receiptPath, evidencePath);
  return Boolean(resolvedPath && fs.existsSync(resolvedPath));
}

function evidenceFileHasNoSecrets(receiptPath: string, evidencePath: unknown) {
  const resolvedPath = resolveEvidencePath(receiptPath, evidencePath);
  if (!resolvedPath || !fs.existsSync(resolvedPath)) return false;
  const extension = path.extname(resolvedPath).toLowerCase();
  if (![".json", ".txt", ".md", ".log"].includes(extension)) return true;

  try {
    return !containsSecretLikeText(fs.readFileSync(resolvedPath, "utf8"));
  } catch {
    return false;
  }
}

function isLockedTrialEvidence(evidence: TrialJsonEvidence | null) {
  return (
    evidence?.provider === "openai" &&
    evidence.traceVisible === true &&
    evidence.noSecretsInArtifacts === true &&
    evidence.noRulesEnabledByTrial === true &&
    evidence.noLongTermAcceptanceSaved === true &&
    evidence.accepted === false &&
    evidence.packagingGated === true &&
    evidence.releaseDecision === "do_not_release"
  );
}
function containsSecretLikeText(value: unknown): boolean {
  if (typeof value === "string") {
    return /sk-[A-Za-z0-9_-]{8,}|OPENAI_API_KEY\s*=/.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsSecretLikeText(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsSecretLikeText(item));
  }
  return false;
}

function main() {
  const receiptPath = parseReceiptPath();
  const validationPath = parseOutputPath();
  const receipt = readReceipt(receiptPath);
  const checks: VerificationCheck[] = [];
  const isTemplate = path.basename(receiptPath) === "real-model-trial-receipt.template.json";

  push(checks, "Real model trial receipt JSON exists", Boolean(receipt), `path=${path.relative(process.cwd(), receiptPath)}`);

  push(
    checks,
    "Real model trial receipt mode is recognized",
    receipt?.responseMode === "real_model_trial_receipt_json_v1",
    `responseMode=${receipt?.responseMode ?? "missing"}`
  );

  push(
    checks,
    "Real model trial receipt stays in bounded product scope",
    receipt?.productScope === "bounded_core_teaching_loop" &&
      receipt.allSoftwareObjective === "paused" &&
      receipt.releaseDecision === "do_not_release",
    `scope=${receipt?.productScope ?? "missing"}; allSoftware=${
      receipt?.allSoftwareObjective ?? "missing"
    }; release=${receipt?.releaseDecision ?? "missing"}`
  );

  push(
    checks,
    "Real model trial receipt cannot unlock release boundaries",
    receipt?.reviewOnly === true &&
      receipt.accepted === false &&
      receipt.packagingGated === true &&
      receipt.canActivateRealModel === false &&
      receipt.canRelease === false &&
      receipt.locks?.mustNotCommitSecrets === true &&
      receipt.locks.mustNotSaveAcceptance === true &&
      receipt.locks.mustNotEnableRules === true &&
      receipt.locks.mustNotUnlockPackaging === true &&
      receipt.locks.mustNotClaimReleaseReady === true &&
      receipt.locks.mustNotResumeAllSoftwareObjective === true,
    `reviewOnly=${receipt?.reviewOnly ?? "missing"}; accepted=${receipt?.accepted ?? "missing"}; packagingGated=${
      receipt?.packagingGated ?? "missing"
    }; canActivate=${receipt?.canActivateRealModel ?? "missing"}; canRelease=${receipt?.canRelease ?? "missing"}`
  );

  push(
    checks,
    "Real model trial decision is constrained",
    Array.isArray(receipt?.modelTrialDecisionAllowedValues) &&
      allowedDecisions.every((decision) => receipt.modelTrialDecisionAllowedValues?.includes(decision)) &&
      allowedDecisions.includes(receipt.modelTrialDecision ?? "") &&
      receipt.defaultModelTrialDecision === "needs_follow_up",
    `decision=${receipt?.modelTrialDecision ?? "missing"}; default=${
      receipt?.defaultModelTrialDecision ?? "missing"
    }`
  );

  push(
    checks,
    "Real model trial receipt does not contain secret-like text",
    Boolean(receipt) && !containsSecretLikeText(receipt),
    "Scans receipt values for sk-* style tokens and OPENAI_API_KEY assignments."
  );

  if (isTemplate) {
    push(
      checks,
      "Template keeps unfilled fields neutral",
      receipt?.status === "not_filled_yet" &&
        receipt.reviewer?.name === "" &&
        receipt.redactedProviderConfig?.apiKeyRedacted === null &&
        receipt.preTrialStatus?.manualProviderAcceptanceBeforeTrial === null &&
        receipt.postTrialStatus?.manualProviderAcceptanceAfterRollback === null &&
        receipt.postTrialStatus?.aiServiceStatusAfterRollbackPath === '' &&
        receipt.trialChecks?.providerConfiguredOutsideSourceControl === null &&
        receipt.trialChecks?.rollbackToMockConfirmed === null &&
        receipt.trialEvidence?.modelOutputEvidencePath === "",
      `status=${receipt?.status ?? "missing"}; reviewer=${receipt?.reviewer?.name ?? "missing"}; apiKeyRedacted=${
        evidenceValue(receipt?.redactedProviderConfig?.apiKeyRedacted)
      }`
    );
  } else {
    push(
      checks,
      "Submitted real model trial receipt has reviewer identity",
      receipt?.status === "submitted" &&
        hasText(receipt.reviewer?.name) &&
        hasText(receipt.reviewer?.role) &&
        hasText(receipt.reviewer?.date) &&
        hasText(receipt.reviewer?.environment),
      `status=${receipt?.status ?? "missing"}; reviewer=${receipt?.reviewer?.name ?? "missing"}; date=${
        receipt?.reviewer?.date ?? "missing"
      }`
    );

    push(
      checks,
      "Submitted provider config is redacted and source-controlled safely",
      receipt?.redactedProviderConfig?.aiProvider === "openai" &&
        hasText(receipt.redactedProviderConfig.openAIModel) &&
        hasText(receipt.redactedProviderConfig.openAIBaseUrl) &&
        receipt.redactedProviderConfig.apiKeyRedacted === true &&
        receipt.redactedProviderConfig.noSecretsCommitted === true &&
        hasText(receipt.redactedProviderConfig.configSource),
      `provider=${receipt?.redactedProviderConfig?.aiProvider ?? "missing"}; apiKeyRedacted=${
        receipt?.redactedProviderConfig?.apiKeyRedacted ?? "missing"
      }; noSecrets=${receipt?.redactedProviderConfig?.noSecretsCommitted ?? "missing"}`
    );

    const preTrialStatus = readEvidence<AIServiceRuntimeStatusEvidence>(
      receiptPath,
      receipt?.preTrialStatus?.aiServiceStatusPath
    );
    const duringTrialStatus = readEvidence<AIServiceRuntimeStatusEvidence>(
      receiptPath,
      receipt?.trialEvidence?.aiServiceStatusDuringTrialPath
    );
    const postTrialStatus = readEvidence<AIServiceRuntimeStatusEvidence>(
      receiptPath,
      receipt?.postTrialStatus?.aiServiceStatusAfterRollbackPath
    );
    const boundedTaskRun = readEvidence<TrialJsonEvidence>(receiptPath, receipt?.trialEvidence?.boundedTaskRunPath);
    const modelOutputEvidence = readEvidence<TrialJsonEvidence>(
      receiptPath,
      receipt?.trialEvidence?.modelOutputEvidencePath
    );
    const traceEvidenceExists = evidenceFileExists(receiptPath, receipt?.trialEvidence?.traceOrScreenshotPath);
    const evidenceFilesHaveNoSecrets = [
      receipt?.preTrialStatus?.aiServiceStatusPath,
      receipt?.trialEvidence?.aiServiceStatusDuringTrialPath,
      receipt?.trialEvidence?.boundedTaskRunPath,
      receipt?.trialEvidence?.traceOrScreenshotPath,
      receipt?.trialEvidence?.modelOutputEvidencePath,
      receipt?.postTrialStatus?.aiServiceStatusAfterRollbackPath
    ].every((evidencePath) => evidenceFileHasNoSecrets(receiptPath, evidencePath));

    push(
      checks,
      "Submitted pre-trial status is backed by mock-provider runtime evidence",
      receipt?.preTrialStatus?.activeProviderBeforeTrial === "mock" &&
        receipt?.preTrialStatus?.manualProviderAcceptanceBeforeTrial === false &&
        receipt?.preTrialStatus?.releaseDecisionBeforeTrial === "do_not_release" &&
        receipt?.preTrialStatus?.packagingGatedBeforeTrial === true &&
        preTrialStatus.evidence?.responseMode === "ai_service_runtime_status_json_v1" &&
        preTrialStatus.evidence.activeProvider === "mock" &&
        preTrialStatus.evidence.realModelReady === false &&
        preTrialStatus.evidence.configured?.manualProviderAcceptance === false &&
        preTrialStatus.evidence.safetyBoundary?.mockFallback === true &&
        preTrialStatus.evidence.safetyBoundary.packagingGated === true,
      `activeBefore=${receipt?.preTrialStatus?.activeProviderBeforeTrial ?? "missing"}; evidenceProvider=${
        preTrialStatus.evidence?.activeProvider ?? "missing"
      }; realReady=${preTrialStatus.evidence?.realModelReady ?? "missing"}; manualAccepted=${
        preTrialStatus.evidence?.configured?.manualProviderAcceptance ?? "missing"
      }`
    );

    push(
      checks,
      "Submitted real-model trial evidence is backed by runtime, trace, and output artifacts",
      duringTrialStatus.evidence?.responseMode === "ai_service_runtime_status_json_v1" &&
        duringTrialStatus.evidence.activeProvider === "openai" &&
        duringTrialStatus.evidence.realModelReady === true &&
        duringTrialStatus.evidence.configured?.openAICompatible === true &&
        duringTrialStatus.evidence.configured.manualProviderAcceptance === true &&
        duringTrialStatus.evidence.configured.openAIModel === receipt?.redactedProviderConfig?.openAIModel &&
        duringTrialStatus.evidence.configured.openAIBaseUrl === receipt?.redactedProviderConfig?.openAIBaseUrl &&
        duringTrialStatus.evidence.safetyBoundary?.packagingGated === true &&
        isLockedTrialEvidence(boundedTaskRun.evidence) &&
        isLockedTrialEvidence(modelOutputEvidence.evidence) &&
        modelOutputEvidence.evidence?.comparedToMock === true &&
        traceEvidenceExists &&
        hasText(receipt?.trialEvidence?.mockComparisonNotes) &&
        hasText(receipt?.trialEvidence?.rollbackNotes) &&
        evidenceFilesHaveNoSecrets,
      `duringProvider=${duringTrialStatus.evidence?.activeProvider ?? "missing"}; realReady=${
        duringTrialStatus.evidence?.realModelReady ?? "missing"
      }; run=${boundedTaskRun.evidence?.responseMode ?? "missing"}; output=${
        modelOutputEvidence.evidence?.responseMode ?? "missing"
      }; trace=${traceEvidenceExists}; noSecrets=${evidenceFilesHaveNoSecrets}`
    );
    push(
      checks,
      'Submitted post-trial status proves rollback to mock fallback',
      receipt?.postTrialStatus?.activeProviderAfterRollback === 'mock' &&
        receipt.postTrialStatus.manualProviderAcceptanceAfterRollback === false &&
        receipt.postTrialStatus.releaseDecisionAfterTrial === 'do_not_release' &&
        receipt.postTrialStatus.packagingGatedAfterTrial === true &&
        postTrialStatus.evidence?.responseMode === 'ai_service_runtime_status_json_v1' &&
        postTrialStatus.evidence.activeProvider === 'mock' &&
        postTrialStatus.evidence.realModelReady === false &&
        postTrialStatus.evidence.configured?.manualProviderAcceptance === false &&
        postTrialStatus.evidence.safetyBoundary?.mockFallback === true &&
        postTrialStatus.evidence.safetyBoundary.accepted === false &&
        postTrialStatus.evidence.safetyBoundary.packagingGated === true,
      'activeAfter=' + (receipt?.postTrialStatus?.activeProviderAfterRollback ?? 'missing') +
        '; evidenceProvider=' +
        (postTrialStatus.evidence?.activeProvider ?? 'missing') +
        '; realReady=' +
        (postTrialStatus.evidence?.realModelReady ?? 'missing') +
        '; manualAccepted=' +
        (postTrialStatus.evidence?.configured?.manualProviderAcceptance ?? 'missing')
    );


    const trialChecks = receipt?.trialChecks;
    push(
      checks,
      "Submitted trial checks are complete and locked",
      isFilledBoolean(trialChecks?.providerConfiguredOutsideSourceControl) &&
        trialChecks?.providerConfiguredOutsideSourceControl === true &&
        trialChecks.realProviderActivationWasExplicitForTrial === true &&
        trialChecks.outputTraceVisible === true &&
        trialChecks.modelOutputComparedToMock === true &&
        trialChecks.noSecretsInArtifacts === true &&
        trialChecks.noRulesEnabledByTrial === true &&
        trialChecks.noLongTermAcceptanceSaved === true &&
        trialChecks.packagingStillGated === true &&
        trialChecks.releaseStillDoNotRelease === true &&
        trialChecks.allSoftwareStillPaused === true &&
        trialChecks.rollbackToMockConfirmed === true,
      `outsideSource=${trialChecks?.providerConfiguredOutsideSourceControl ?? "missing"}; noSecrets=${
        trialChecks?.noSecretsInArtifacts ?? "missing"
      }; packaging=${trialChecks?.packagingStillGated ?? "missing"}; release=${
        trialChecks?.releaseStillDoNotRelease ?? "missing"
      }`
    );

    push(
      checks,
      "Submitted real model trial receipt has an actionable next step",
      hasText(receipt?.nextActionRecommendation) &&
        (receipt?.modelTrialDecision !== "blocked" || hasText(receipt.blockers?.blockingIssue)) &&
        (receipt?.modelTrialDecision !== "ready_for_separate_acceptance_review" ||
          receipt.trialChecks?.releaseStillDoNotRelease === true),
      `decision=${receipt?.modelTrialDecision ?? "missing"}; nextAction=${hasText(
        receipt?.nextActionRecommendation
      )}; blocker=${hasText(receipt?.blockers?.blockingIssue)}`
    );
  }

  const passed = checks.filter((check) => check.pass).length;
  const validationStatus = passed === checks.length ? (isTemplate ? "template_ready" : "passed") : "failed";
  const validation = {
    responseMode: "real_model_trial_receipt_validation_json_v1",
    status: validationStatus,
    generatedAt: new Date().toISOString(),
    command: isTemplate
      ? "npm run verify:real-model-trial-receipt"
      : `npm run verify:real-model-trial-receipt -- --receipt ${path.relative(process.cwd(), receiptPath)}`,
    inputPath: path.relative(process.cwd(), receiptPath),
    mode: isTemplate ? "template" : "submitted_receipt",
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
      validationStatus === "template_ready"
        ? "Give a copy of the template to the real-model trial reviewer; validate the filled copy with -- --receipt <path>."
        : validationStatus === "passed"
          ? "Use the submitted receipt as follow-up evidence only; it still does not unlock release or packaging."
          : "Fix the real-model trial receipt before using it for model follow-up planning."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2));
  console.log(JSON.stringify(validation, null, 2));
  console.log(`\nReal model trial receipt validation written to ${validationPath}`);

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
