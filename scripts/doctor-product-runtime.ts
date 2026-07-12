import fs from "node:fs";
import path from "node:path";

type DoctorCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const baseUrl = getArg("--base-url") ?? process.env.PRODUCT_DOCTOR_BASE_URL ?? "http://127.0.0.1:3000";
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "product-runtime-doctor.json");

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function readJson<T>(path: string) {
  const response = await fetch(new URL(path, baseUrl));
  const text = await response.text();
  let json: T | null = null;

  try {
    json = JSON.parse(text) as T;
  } catch {
    // The final check will report the non-JSON response.
  }

  return { response, text, json };
}

function push(checks: DoctorCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

async function main() {
  const checks: DoctorCheck[] = [];
  const health = await readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
  }>("/api/health");
  const readiness = await readJson<{
    responseMode?: string;
    status?: string;
    missingArtifacts?: string[];
    productUiApiSmoke?: {
      status?: string;
      passed?: number;
      total?: number;
      releaseDecision?: string;
      accepted?: boolean;
      packagingGated?: boolean;
    };
    realModelAdapterContractVerification?: {
      status?: string;
      passed?: number;
      total?: number;
      releaseDecision?: string;
      accepted?: boolean;
      packagingGated?: boolean;
      realNetworkUsed?: boolean;
      realProviderAccepted?: boolean;
      canActivateRealModel?: boolean;
      canRelease?: boolean;
    };
    productOperatorBrief?: {
      status?: string;
      releaseDecision?: string;
      accepted?: boolean;
      packagingGated?: boolean;
      canRelease?: boolean;
      canInviteBoundedBetaTester?: boolean;
      canStartHumanAcceptanceReview?: boolean;
      canPlanRealModelTrial?: boolean;
      canActivateRealModel?: boolean;
      failedReasons?: string[];
    };
    productOperatorBriefVerification?: {
      status?: string;
      passed?: number;
      total?: number;
      releaseDecision?: string;
      accepted?: boolean;
      packagingGated?: boolean;
      canRelease?: boolean;
    };
    publicBetaReturnLoop?: {
      status?: string;
      collectionStatus?: string;
      feedbackApiStatus?: string;
      followUpPlanStatus?: string;
      followUpVerificationStatus?: string;
      returnIntakeVerificationStatus?: string;
      canInviteNextTester?: boolean;
      totalReceipts?: number;
      validReceipts?: number;
      invalidReceipts?: number;
      releaseDecision?: string;
      reviewOnly?: boolean;
      accepted?: boolean;
      packagingGated?: boolean;
      actionCount?: number;
      commandSequence?: string[];
    };
    manualAcceptance?: { latestSaved?: boolean; latestHumanReviewed?: boolean; humanAcceptanceStatus?: string };
  }>("/api/product-readiness");
  const releaseReadiness = await readJson<{
    responseMode?: string;
    status?: string;
    latest?: {
      responseMode?: string;
      status?: string;
      releaseDecision?: string;
      blockers?: Array<{ name?: string }>;
    };
    trialReadinessIsReleaseReadiness?: boolean;
  }>("/api/product-release-readiness");
  const ai = await readJson<{
    responseMode?: string;
    activeProvider?: string;
    realModelReady?: boolean;
  }>("/api/ai-service-status");

  push(
    checks,
    "Health endpoint is healthy",
    health.response.status === 200 &&
      health.json?.responseMode === "product_health_json_v1" &&
      health.json.status === "healthy",
    `status=${health.response.status}; health=${health.json?.status ?? "non_json"}; checks=${health.json?.passed ?? "?"}/${
      health.json?.total ?? "?"
    }`
  );

  push(
    checks,
    "Readiness endpoint exposes human acceptance state",
    readiness.response.status === 200 &&
      readiness.json?.responseMode === "product_readiness_json_v1" &&
      readiness.json.missingArtifacts?.length === 0 &&
      readiness.json.manualAcceptance?.latestSaved === true &&
      ["needs_real_human_review", "human_review_saved"].includes(
        readiness.json.manualAcceptance.humanAcceptanceStatus ?? ""
      ),
    `status=${readiness.response.status}; readiness=${readiness.json?.status ?? "non_json"}; missingArtifacts=${
      readiness.json?.missingArtifacts?.length ?? "?"
    }; latestSaved=${readiness.json?.manualAcceptance?.latestSaved ?? "?"}; humanAcceptance=${
      readiness.json?.manualAcceptance?.humanAcceptanceStatus ?? "?"
    }`
  );

  push(
    checks,
    "Product UI/API smoke receipt is green",
    readiness.response.status === 200 &&
      readiness.json?.productUiApiSmoke?.status === "passed" &&
      readiness.json.productUiApiSmoke.passed === readiness.json.productUiApiSmoke.total &&
      Number(readiness.json.productUiApiSmoke.total ?? 0) > 0 &&
      readiness.json.productUiApiSmoke.releaseDecision === "do_not_release" &&
      readiness.json.productUiApiSmoke.accepted === false &&
      readiness.json.productUiApiSmoke.packagingGated === true,
    `status=${readiness.json?.productUiApiSmoke?.status ?? "missing"}; checks=${
      readiness.json?.productUiApiSmoke?.passed ?? "?"
    }/${readiness.json?.productUiApiSmoke?.total ?? "?"}; releaseDecision=${
      readiness.json?.productUiApiSmoke?.releaseDecision ?? "missing"
    }`
  );

  push(
    checks,
    "Real model adapter contract is verified without network",
    readiness.response.status === 200 &&
      readiness.json?.realModelAdapterContractVerification?.status === "passed" &&
      readiness.json.realModelAdapterContractVerification.passed ===
        readiness.json.realModelAdapterContractVerification.total &&
      Number(readiness.json.realModelAdapterContractVerification.total ?? 0) >= 7 &&
      readiness.json.realModelAdapterContractVerification.releaseDecision === "do_not_release" &&
      readiness.json.realModelAdapterContractVerification.accepted === false &&
      readiness.json.realModelAdapterContractVerification.packagingGated === true &&
      readiness.json.realModelAdapterContractVerification.realNetworkUsed === false &&
      readiness.json.realModelAdapterContractVerification.realProviderAccepted === false &&
      readiness.json.realModelAdapterContractVerification.canActivateRealModel === false &&
      readiness.json.realModelAdapterContractVerification.canRelease === false,
    `status=${readiness.json?.realModelAdapterContractVerification?.status ?? "missing"}; checks=${
      readiness.json?.realModelAdapterContractVerification?.passed ?? "?"
    }/${readiness.json?.realModelAdapterContractVerification?.total ?? "?"}; realNetwork=${
      readiness.json?.realModelAdapterContractVerification?.realNetworkUsed ?? "?"
    }`
  );

  push(
    checks,
    "Product operator brief is ready and locked",
    readiness.response.status === 200 &&
      readiness.json?.productOperatorBrief?.status === "ready_for_operator_handoff" &&
      readiness.json.productOperatorBrief.releaseDecision === "do_not_release" &&
      readiness.json.productOperatorBrief.accepted === false &&
      readiness.json.productOperatorBrief.packagingGated === true &&
      readiness.json.productOperatorBrief.canRelease === false &&
      readiness.json.productOperatorBrief.canInviteBoundedBetaTester === true &&
      readiness.json.productOperatorBrief.canStartHumanAcceptanceReview === true &&
      readiness.json.productOperatorBrief.canPlanRealModelTrial === true &&
      readiness.json.productOperatorBrief.canActivateRealModel === false &&
      readiness.json.productOperatorBrief.failedReasons?.length === 0 &&
      readiness.json.productOperatorBriefVerification?.status === "passed" &&
      readiness.json.productOperatorBriefVerification.passed ===
        readiness.json.productOperatorBriefVerification.total &&
      Number(readiness.json.productOperatorBriefVerification.total ?? 0) >= 6 &&
      readiness.json.productOperatorBriefVerification.releaseDecision === "do_not_release" &&
      readiness.json.productOperatorBriefVerification.accepted === false &&
      readiness.json.productOperatorBriefVerification.packagingGated === true &&
      readiness.json.productOperatorBriefVerification.canRelease === false,
    `status=${readiness.json?.productOperatorBrief?.status ?? "missing"}; beta=${
      readiness.json?.productOperatorBrief?.canInviteBoundedBetaTester ?? "?"
    }; human=${readiness.json?.productOperatorBrief?.canStartHumanAcceptanceReview ?? "?"}; modelTrial=${
      readiness.json?.productOperatorBrief?.canPlanRealModelTrial ?? "?"
    }; verification=${readiness.json?.productOperatorBriefVerification?.status ?? "missing"}`
  );

  push(
    checks,
    "Public beta return loop is visible and locked",
    readiness.response.status === 200 &&
      readiness.json?.publicBetaReturnLoop?.status === "waiting_for_first_tester_return" &&
      readiness.json.publicBetaReturnLoop.collectionStatus === "waiting_for_feedback" &&
      readiness.json.publicBetaReturnLoop.feedbackApiStatus === "passed" &&
      readiness.json.publicBetaReturnLoop.followUpPlanStatus === "waiting_for_feedback" &&
      readiness.json.publicBetaReturnLoop.followUpVerificationStatus === "passed" &&
      readiness.json.publicBetaReturnLoop.returnIntakeVerificationStatus === "passed" &&
      readiness.json.publicBetaReturnLoop.canInviteNextTester === true &&
      readiness.json.publicBetaReturnLoop.totalReceipts === 0 &&
      readiness.json.publicBetaReturnLoop.validReceipts === 0 &&
      readiness.json.publicBetaReturnLoop.invalidReceipts === 0 &&
      readiness.json.publicBetaReturnLoop.releaseDecision === "do_not_release" &&
      readiness.json.publicBetaReturnLoop.reviewOnly === true &&
      readiness.json.publicBetaReturnLoop.accepted === false &&
      readiness.json.publicBetaReturnLoop.packagingGated === true &&
      Number(readiness.json.publicBetaReturnLoop.actionCount ?? 0) >= 2 &&
      readiness.json.publicBetaReturnLoop.commandSequence?.includes("npm run collect:public-beta-feedback") === true &&
      readiness.json.publicBetaReturnLoop.commandSequence?.includes("npm run plan:public-beta-follow-up") === true &&
      readiness.json.publicBetaReturnLoop.commandSequence?.some((item) =>
        item.includes("npm run intake:public-beta-return")
      ) === true,
    `status=${readiness.json?.publicBetaReturnLoop?.status ?? "missing"}; collection=${
      readiness.json?.publicBetaReturnLoop?.collectionStatus ?? "missing"
    }; followUp=${readiness.json?.publicBetaReturnLoop?.followUpVerificationStatus ?? "missing"}; receipts=${
      readiness.json?.publicBetaReturnLoop?.totalReceipts ?? "?"
    }; release=${readiness.json?.publicBetaReturnLoop?.releaseDecision ?? "missing"}`
  );

  push(
    checks,
    "Release go/no-go endpoint keeps release blocked",
    releaseReadiness.response.status === 200 &&
      releaseReadiness.json?.responseMode === "product_release_readiness_latest_json_v1" &&
      releaseReadiness.json.status === "saved" &&
      releaseReadiness.json.latest?.responseMode === "product_release_readiness_gate_json_v1" &&
      releaseReadiness.json.latest.status === "blocked_not_release_ready" &&
      releaseReadiness.json.latest.releaseDecision === "do_not_release" &&
      releaseReadiness.json.trialReadinessIsReleaseReadiness === false &&
      releaseReadiness.json.latest.blockers?.some((blocker) => blocker.name === "Real human acceptance is complete") === true,
    `status=${releaseReadiness.response.status}; gate=${
      releaseReadiness.json?.latest?.status ?? "non_json"
    }; decision=${releaseReadiness.json?.latest?.releaseDecision ?? "?"}; blockers=${
      releaseReadiness.json?.latest?.blockers?.length ?? "?"
    }`
  );

  push(
    checks,
    "AI provider remains explicit mock",
    ai.response.status === 200 &&
      ai.json?.responseMode === "ai_service_runtime_status_json_v1" &&
      ai.json.activeProvider === "mock" &&
      ai.json.realModelReady === false,
    `status=${ai.response.status}; activeProvider=${ai.json?.activeProvider ?? "non_json"}; realModelReady=${
      ai.json?.realModelReady ?? "?"
    }`
  );

  const passed = checks.filter((item) => item.pass).length;
  const result = {
    responseMode: "product_runtime_doctor_receipt_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: `npm run doctor:product -- --base-url ${baseUrl}`,
    baseUrl,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: releaseReadiness.json?.latest?.releaseDecision ?? "unknown",
    passed,
    total: checks.length,
    checks
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nProduct runtime doctor receipt written to ${receiptPath}`);

  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
