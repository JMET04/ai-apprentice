import fs from "node:fs";
import path from "node:path";

type VerificationCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const kitJsonPath = path.join(artifactsDir, "real-model-trial-kit.json");
const kitMarkdownPath = path.join(artifactsDir, "real-model-trial-kit.md");
const receiptPath = path.join(artifactsDir, "real-model-trial-kit-verification.json");

function push(checks: VerificationCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function readJson<T>(targetPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function readRepoJson<T>(relativePath: string): T | null {
  return readJson<T>(path.join(process.cwd(), relativePath));
}

function fileSize(targetPath: string) {
  return fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0;
}

function main() {
  const checks: VerificationCheck[] = [];
  const kit = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    allSoftwareObjective?: string;
    canActivateRealModel?: boolean;
    canRelease?: boolean;
    failedReasons?: string[];
    aiService?: {
      activeProvider?: string;
      requestedProvider?: string;
      status?: string;
      realModelReady?: boolean;
      switchRequires?: string[];
      configured?: {
        openAICompatible?: boolean;
        openAIModel?: string;
        openAIBaseUrl?: string;
        openAIAdapterImplemented?: boolean;
        manualProviderAcceptance?: boolean;
      };
      safetyBoundary?: { mockFallback?: boolean; accepted?: boolean; packagingGated?: boolean };
    };
    sourceEvidence?: {
      envExample?: { documentsProviderControls?: boolean };
      releaseReadiness?: {
        status?: string;
        releaseDecision?: string;
        realModelBlockerPresent?: boolean;
        activeProvider?: string;
      };
      releaseBlockerBoard?: {
        status?: string;
        realModelLanePresent?: boolean;
        verificationStatus?: string;
      };
      productSmoke?: { status?: string; passed?: number; total?: number };
      adapterContract?: {
        status?: string;
        passed?: number;
        total?: number;
        realNetworkUsed?: boolean | null;
        realProviderAccepted?: boolean | null;
      };
    };
    trialPhases?: Array<{ id?: string; reviewerAction?: string; continueCondition?: string; stopCondition?: string }>;
    credentialRedactionChecklist?: Array<{
      id?: string;
      reviewerAction?: string;
      evidence?: string;
      stopCondition?: string;
    }>;
    maintainerCommands?: string[];
    forbiddenTransitions?: string[];
    evidenceToReturn?: string[];
    locks?: {
      mustNotCommitSecrets?: boolean;
      mustNotSetManualAcceptanceFromKit?: boolean;
      mustNotActivateRealModelFromKit?: boolean;
      mustNotSaveAcceptanceFromKit?: boolean;
      mustNotEnableRules?: boolean;
      mustNotUnlockPackaging?: boolean;
      mustNotClaimReleaseReady?: boolean;
      mustNotResumeAllSoftwareObjective?: boolean;
    };
  }>(kitJsonPath);
  const markdown = fs.existsSync(kitMarkdownPath) ? fs.readFileSync(kitMarkdownPath, "utf8") : "";
  const packageJson = readRepoJson<{ scripts?: Record<string, string> }>("package.json");
  const phaseIds = new Set((kit?.trialPhases ?? []).map((phase) => phase.id));
  const redactionIds = new Set((kit?.credentialRedactionChecklist ?? []).map((item) => item.id));

  push(
    checks,
    "Real model trial kit JSON is ready",
    kit?.responseMode === "real_model_trial_kit_json_v1" &&
      kit.status === "ready_for_real_model_trial_planning" &&
      (kit.failedReasons?.length ?? -1) === 0,
    `status=${kit?.status ?? "missing"}; failed=${kit?.failedReasons?.join(",") || "none"}`
  );

  push(
    checks,
    "Real model trial kit preserves release and activation locks",
    kit?.releaseDecision === "do_not_release" &&
      kit.reviewOnly === true &&
      kit.accepted === false &&
      kit.packagingGated === true &&
      kit.allSoftwareObjective === "paused" &&
      kit.canActivateRealModel === false &&
      kit.canRelease === false &&
      kit.locks?.mustNotCommitSecrets === true &&
      kit.locks.mustNotSetManualAcceptanceFromKit === true &&
      kit.locks.mustNotActivateRealModelFromKit === true &&
      kit.locks.mustNotSaveAcceptanceFromKit === true &&
      kit.locks.mustNotEnableRules === true &&
      kit.locks.mustNotUnlockPackaging === true &&
      kit.locks.mustNotClaimReleaseReady === true &&
      kit.locks.mustNotResumeAllSoftwareObjective === true,
    `release=${kit?.releaseDecision ?? "missing"}; accepted=${kit?.accepted ?? "missing"}; packagingGated=${
      kit?.packagingGated ?? "missing"
    }; canActivate=${kit?.canActivateRealModel ?? "missing"}; canRelease=${kit?.canRelease ?? "missing"}`
  );

  push(
    checks,
    "Real model adapter is implemented but still safely inactive",
    kit?.aiService?.configured?.openAIAdapterImplemented === true &&
      kit.aiService.activeProvider === "mock" &&
      kit.aiService.realModelReady === false &&
      kit.aiService.safetyBoundary?.mockFallback === true &&
      kit.aiService.safetyBoundary.accepted === false &&
      kit.aiService.safetyBoundary.packagingGated === true &&
      kit.aiService.switchRequires?.some((item) => item.includes("AI_PROVIDER_MANUAL_ACCEPTED=false")) === true,
    `activeProvider=${kit?.aiService?.activeProvider ?? "missing"}; status=${
      kit?.aiService?.status ?? "missing"
    }; realModelReady=${kit?.aiService?.realModelReady ?? "missing"}`
  );

  push(
    checks,
    "Real model trial kit is backed by current release evidence",
    kit?.sourceEvidence?.releaseReadiness?.status === "blocked_not_release_ready" &&
      kit.sourceEvidence.releaseReadiness.releaseDecision === "do_not_release" &&
      kit.sourceEvidence.releaseReadiness.realModelBlockerPresent === true &&
      kit.sourceEvidence.releaseReadiness.activeProvider === "mock" &&
      kit.sourceEvidence.releaseBlockerBoard?.status === "ready_for_blocker_resolution" &&
      kit.sourceEvidence.releaseBlockerBoard.realModelLanePresent === true &&
      kit.sourceEvidence.releaseBlockerBoard.verificationStatus === "passed" &&
      kit.sourceEvidence.productSmoke?.status === "passed" &&
      kit.sourceEvidence.productSmoke.passed === kit.sourceEvidence.productSmoke.total &&
      kit.sourceEvidence.adapterContract?.status === "passed" &&
      kit.sourceEvidence.adapterContract.passed === kit.sourceEvidence.adapterContract.total &&
      kit.sourceEvidence.adapterContract.realNetworkUsed === false &&
      kit.sourceEvidence.adapterContract.realProviderAccepted === false,
    `release=${kit?.sourceEvidence?.releaseReadiness?.status ?? "missing"}; realModelBlocker=${
      kit?.sourceEvidence?.releaseReadiness?.realModelBlockerPresent ?? "missing"
    }; board=${kit?.sourceEvidence?.releaseBlockerBoard?.status ?? "missing"}; smoke=${
      kit?.sourceEvidence?.productSmoke?.status ?? "missing"
    }; adapterContract=${kit?.sourceEvidence?.adapterContract?.status ?? "missing"}`
  );

  push(
    checks,
    "Real model trial phases cover configuration, dry-run, trial, acceptance, and recheck",
    phaseIds.has("configure_without_source_control") &&
      phaseIds.has("pre_acceptance_dry_run") &&
      phaseIds.has("separate_real_model_trial") &&
      phaseIds.has("human_acceptance_for_model") &&
      phaseIds.has("release_gate_recheck") &&
      (kit?.trialPhases?.length ?? 0) === 5 &&
      kit?.trialPhases?.some((phase) => phase.reviewerAction?.includes("AI_PROVIDER=openai")) === true &&
      kit?.trialPhases?.some((phase) => phase.continueCondition?.includes("AI_PROVIDER_MANUAL_ACCEPTED=false")) ===
        true &&
      kit?.trialPhases?.some((phase) => phase.stopCondition?.includes("packaging")) === true,
    `phases=${Array.from(phaseIds).join(",") || "missing"}`
  );

  push(
    checks,
    "Real model trial kit includes credential redaction and rollback checks",
    redactionIds.has("redacted_environment_summary") &&
      redactionIds.has("artifact_secret_scan_before_return") &&
      redactionIds.has("trial_log_minimization") &&
      redactionIds.has("rollback_to_mock_after_trial") &&
      (kit?.credentialRedactionChecklist?.length ?? 0) === 4 &&
      kit?.credentialRedactionChecklist?.some(
        (item) => item.reviewerAction?.includes("OPENAI_API_KEY") && item.stopCondition?.includes("secret")
      ) === true &&
      kit.credentialRedactionChecklist.some(
        (item) => item.reviewerAction?.includes("sk-*") && item.stopCondition?.includes("rotate credentials")
      ) &&
      kit.credentialRedactionChecklist.some(
        (item) => item.reviewerAction?.includes("AI_PROVIDER_MANUAL_ACCEPTED=false") && item.stopCondition?.includes("releaseDecision")
      ) &&
      kit.evidenceToReturn?.some((item) => item.includes("Completed credential redaction checklist")) === true &&
      markdown.includes("Credential Redaction Checklist") &&
      markdown.includes("redacted_environment_summary") &&
      markdown.includes("rollback_to_mock_after_trial"),
    `redaction=${Array.from(redactionIds).join(",") || "missing"}`
  );

  push(
    checks,
    "Real model trial kit gives maintainer commands and returned evidence",
      kit?.maintainerCommands?.includes("GET /api/ai-service-status") === true &&
      kit.maintainerCommands.includes("npm run verify:real-model-adapter-contract") &&
      kit.maintainerCommands.includes("npm run build:real-model-trial-receipt-template") &&
      kit.maintainerCommands.includes("npm run verify:real-model-trial-receipt") &&
      kit.maintainerCommands.includes("npm run verify:product") &&
      kit.maintainerCommands.includes("npm run smoke:product -- --base-url http://127.0.0.1:3000") &&
      kit.maintainerCommands.includes("npm run verify:product-release-readiness -- --allow-blocked") &&
      kit.evidenceToReturn?.some((item) => item.includes("/api/ai-service-status")) === true &&
      kit.evidenceToReturn.some((item) => item.includes("real-model-adapter-contract-verification.json")) &&
      kit.evidenceToReturn.some((item) => item.includes("real-model trial receipt")) &&
      kit.evidenceToReturn.some((item) => item.includes("no OPENAI_API_KEY value")),
    `commands=${kit?.maintainerCommands?.length ?? 0}; evidenceToReturn=${kit?.evidenceToReturn?.length ?? 0}`
  );

  push(
    checks,
    "Real model trial kit Markdown is actionable and explicit",
    markdown.includes("Real Model Trial Kit") &&
      markdown.includes("OPENAI_API_KEY") &&
      markdown.includes("AI_PROVIDER_MANUAL_ACCEPTED=false") &&
      markdown.includes("/api/ai-service-status") &&
      markdown.includes("real-model-adapter-contract-verification.json") &&
      markdown.includes("real-model-trial-receipt.template.json") &&
      markdown.includes("npm run verify:real-model-trial-receipt -- --receipt") &&
      markdown.includes("npm run verify:product-release-readiness -- --allow-blocked") &&
      markdown.includes("do_not_release") &&
      markdown.includes("accepted=false") &&
      markdown.includes("packagingGated=true") &&
      markdown.includes("allSoftwareObjective=paused") &&
      fileSize(kitMarkdownPath) > 1000,
    `markdownBytes=${fileSize(kitMarkdownPath)}`
  );

  push(
    checks,
    "Real model trial kit package scripts are registered",
      packageJson?.scripts?.["build:real-model-trial-kit"] === "tsx scripts/build-real-model-trial-kit.ts" &&
      packageJson.scripts?.["verify:real-model-trial-kit"] === "tsx scripts/verify-real-model-trial-kit.ts" &&
      packageJson.scripts?.["verify:real-model-adapter-contract"] ===
        "tsx scripts/verify-real-model-adapter-contract.ts" &&
      packageJson.scripts?.["build:real-model-trial-receipt-template"] ===
        "tsx scripts/build-real-model-trial-receipt-template.ts" &&
      packageJson.scripts?.["verify:real-model-trial-receipt"] ===
        "tsx scripts/verify-real-model-trial-receipt.ts",
    `buildScript=${packageJson?.scripts?.["build:real-model-trial-kit"] ?? "missing"}; verifyScript=${
      packageJson?.scripts?.["verify:real-model-trial-kit"] ?? "missing"
    }`
  );

  push(
    checks,
    "Real model trial kit does not claim forbidden outcomes",
    kit?.forbiddenTransitions?.some((item) => item.includes("commit real provider secrets")) === true &&
      kit.forbiddenTransitions.some((item) => item.includes("AI_PROVIDER_MANUAL_ACCEPTED=true")) &&
      kit.forbiddenTransitions.some((item) => item.includes("release readiness")) &&
      kit.releaseDecision === "do_not_release" &&
      kit.accepted === false &&
      kit.packagingGated === true &&
      kit.canActivateRealModel === false &&
      kit.canRelease === false &&
      !markdown.includes("Release decision: `release_candidate`") &&
      !markdown.includes("Can activate real model: `true`") &&
      !markdown.includes("Can release: `true`"),
    `forbiddenTransitions=${kit?.forbiddenTransitions?.length ?? 0}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "real_model_trial_kit_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:real-model-trial-kit",
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
        ? "Use real-model-trial-kit.md to plan a separate real-model trial without enabling release or packaging."
        : "Fix the real-model trial kit before attempting a real-provider trial."
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nReal model trial kit verification written to ${receiptPath}`);

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
