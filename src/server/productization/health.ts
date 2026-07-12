import { visualLearningAcceptanceGate } from "@/lib/teacher-acceptance";
import { getAIServiceRuntimeStatus } from "@/server/ai/service";
import { prisma } from "@/server/db/prisma";
import { buildProductReadiness, stableProductTaskId } from "@/server/productization/readiness";

type HealthCheck = {
  name: string;
  status: "pass" | "fail";
  evidence: string;
};

function check(name: string, pass: boolean, evidence: string): HealthCheck {
  return {
    name,
    status: pass ? "pass" : "fail",
    evidence
  };
}

export async function buildProductHealth() {
  const checks: HealthCheck[] = [];
  let stableTaskCount = 0;
  let dbReachable = false;

  try {
    stableTaskCount = await prisma.task.count({ where: { id: stableProductTaskId } });
    dbReachable = true;
  } catch (error) {
    checks.push(
      check(
        "Database reachable",
        false,
        error instanceof Error ? error.message : "Database query failed."
      )
    );
  }

  if (dbReachable) {
    checks.push(check("Database reachable", true, `stableTaskCount=${stableTaskCount}`));
  }

  const readiness = await buildProductReadiness();
  const aiService = getAIServiceRuntimeStatus();
  const adapterContract = readiness.realModelAdapterContractVerification;
  const adapterContractLockedAndVerified =
    adapterContract.status === "passed" &&
    adapterContract.passed === adapterContract.total &&
    Number(adapterContract.total ?? 0) >= 7 &&
    adapterContract.releaseDecision === "do_not_release" &&
    adapterContract.accepted === false &&
    adapterContract.packagingGated === true &&
    adapterContract.realNetworkUsed === false &&
    adapterContract.realProviderAccepted === false &&
    adapterContract.canActivateRealModel === false &&
    adapterContract.canRelease === false;
  const packagingLocked =
    visualLearningAcceptanceGate.accepted === false &&
    visualLearningAcceptanceGate.packagingGated === true &&
    visualLearningAcceptanceGate.status === "pending_teacher_acceptance";

  checks.push(
    check("Stable product task exists", stableTaskCount === 1, `task=${stableProductTaskId}; count=${stableTaskCount}`),
    check(
      "Product readiness contract is reachable",
      Array.isArray(readiness.missingArtifacts) && readiness.missingArtifacts.length === 0,
      `readiness=${readiness.status}; missingArtifacts=${readiness.missingArtifacts.length}`
    ),
    check(
      "Product UI/API smoke receipt is visible",
      ["running", "passed"].includes(readiness.productUiApiSmoke.status),
      `status=${readiness.productUiApiSmoke.status}; checks=${readiness.productUiApiSmoke.passed}/${readiness.productUiApiSmoke.total}`
    ),
    check(
      "Real model adapter contract remains locked and verified",
      adapterContractLockedAndVerified,
      `status=${adapterContract.status}; checks=${adapterContract.passed}/${adapterContract.total}; realNetwork=${adapterContract.realNetworkUsed}; canActivate=${adapterContract.canActivateRealModel}`
    ),
    check("AI service boundary is mock", aiService.activeProvider === "mock", `activeProvider=${aiService.activeProvider}`),
    check(
      "Packaging boundary remains locked",
      packagingLocked,
      `accepted=${visualLearningAcceptanceGate.accepted}; packagingGated=${visualLearningAcceptanceGate.packagingGated}; status=${visualLearningAcceptanceGate.status}`
    )
  );

  const passed = checks.filter((item) => item.status === "pass").length;

  return {
    responseMode: "product_health_json_v1",
    status: passed === checks.length ? "healthy" : "degraded",
    generatedAt: new Date().toISOString(),
    passed,
    total: checks.length,
    checks,
    links: {
      readiness: "/api/product-readiness",
      releaseReadiness: "/api/product-release-readiness",
      aiServiceStatus: "/api/ai-service-status",
      manualAcceptanceReports: "/api/manual-acceptance-reports",
      handoff: "/handoff"
    }
  };
}
