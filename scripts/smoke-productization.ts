import fs from "node:fs";
import path from "node:path";

type SmokeCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const baseUrl = getArg("--base-url") ?? process.env.PRODUCT_SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "product-ui-api-smoke.json");

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function readText(route: string) {
  const response = await fetch(new URL(route, baseUrl));
  const text = await response.text();
  return { response, text };
}

async function readJson<T>(route: string) {
  const response = await fetch(new URL(route, baseUrl));
  const json = (await response.json()) as T;
  return { response, json };
}

function push(checks: SmokeCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function writeSmokeReceipt(checks: SmokeCheck[], statusOverride?: "running" | "passed" | "failed") {
  const passed = checks.filter((check) => check.pass).length;
  const status = statusOverride ?? (passed === checks.length ? "passed" : "failed");
  const receipt = {
    responseMode: "product_ui_api_smoke_receipt_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: `npm run smoke:product -- --base-url ${baseUrl}`,
    baseUrl,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    passed,
    total: checks.length,
    checks
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  return receipt;
}

function hasMojibake(text: string) {
  return /浠庢|涓€|浜у|浜哄|楠屶|楠屾|鐪熼|鐪熸|鎺ユ|杩愯|妫€|璇佹|鐘舶|鐘舵|鍏ㄨ|绋冲|鎵撳|瀛﹀|寰掓|瑙勫|绾犻|鍙戝|淇濆|瀹℃|鐢ㄦ|鏌ョ|鍒涘|娴嬭|鏈€|娑撯偓|鐎涳箑|閹|閺|閸|鐠|鐟|閻|娴|濡|瀹|锟|�/.test(
    text
  );
}

function hasAll(text: string, markers: string[]) {
  return markers.every((marker) => text.includes(marker));
}

async function main() {
  const checks: SmokeCheck[] = [];
  writeSmokeReceipt(checks, "running");

  const health = await readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    checks?: Array<{ name?: string; status?: string; evidence?: string }>;
    links?: { readiness?: string; releaseReadiness?: string; aiServiceStatus?: string; handoff?: string };
  }>("/api/health");
  const healthHasLockedAdapterContract =
    health.json.checks?.some(
      (item) =>
        item.name === "Real model adapter contract remains locked and verified" &&
        item.status === "pass" &&
        item.evidence?.includes("realNetwork=false") === true &&
        item.evidence.includes("canActivate=false")
    ) === true;
  push(
    checks,
    "Health endpoint reports product runtime status",
    health.response.status === 200 &&
      health.json.responseMode === "product_health_json_v1" &&
      health.json.status === "healthy" &&
      health.json.passed === health.json.total &&
      healthHasLockedAdapterContract &&
      health.json.links?.readiness === "/api/product-readiness" &&
      health.json.links.releaseReadiness === "/api/product-release-readiness" &&
      health.json.links.aiServiceStatus === "/api/ai-service-status" &&
      health.json.links.handoff === "/handoff",
    `status=${health.response.status}; health=${health.json.status}; checks=${health.json.passed}/${health.json.total}; adapterContractHealth=${healthHasLockedAdapterContract}`
  );

  const dashboard = await readText("/");
  push(
    checks,
    "Dashboard exposes bounded beta product path",
    dashboard.response.status === 200 &&
      hasAll(dashboard.text, [
        "Start beta session",
        "Bounded public beta path",
        "All-software goal paused",
        "Stable demo evidence",
        "task-photo-travel-journal"
      ]),
    `status=${dashboard.response.status}; bytes=${dashboard.text.length}`
  );

  const publicBeta = await readText("/public-beta");
  push(
    checks,
    "Public beta entry renders tester session",
    publicBeta.response.status === 200 &&
      hasAll(publicBeta.text, [
        "Bounded beta session for the core teaching loop",
        "Live Readiness",
        "Tester Steps",
        "Feedback Receipt Builder",
        "Save to inbox",
        "What to Return",
        "Release Boundary"
      ]),
    `status=${publicBeta.response.status}; bytes=${publicBeta.text.length}`
  );

  const manualTest = await readText("/manual-test");
  push(
    checks,
    "Manual acceptance workbench renders",
    manualTest.response.status === 200 &&
      hasAll(manualTest.text, [
        "Manual Review Status",
        "Manual test entry",
        "Saves human_review evidence",
        "automated_browser_smoke",
        "Start beta session"
      ]),
    `status=${manualTest.response.status}; bytes=${manualTest.text.length}`
  );

  const handoff = await readText("/handoff");
  push(
    checks,
    "Handoff page exposes takeover state",
    handoff.response.status === 200 &&
      hasAll(handoff.text, [
        "Product handoff state",
        "Productization means",
        "/api/product-readiness",
        "/api/product-release-readiness",
        "Production Release Go/No-Go",
        "releaseDecision",
        "Product Operator Brief",
        "operatorBrief=",
        "Operator Stop Lines",
        "Beta Feedback Return Loop",
        "returnLoop=",
        "Return Handling Commands",
        "adapterContract",
        "realNetwork=",
        "fake-fetch evidence",
        "Commands to Trust",
        "Public Beta Readiness"
      ]),
    `status=${handoff.response.status}; bytes=${handoff.text.length}`
  );

  const productReadiness = await readJson<{
    responseMode?: string;
    status?: string;
    currentScope?: { id?: string; allSoftwareObjective?: string };
    stableAcceptanceObject?: { id?: string };
    handoffGate?: { status?: string; passed?: number; total?: number };
    missingArtifacts?: string[];
    manualAcceptance?: {
      latestSaved?: boolean;
      latestEvidenceKind?: string;
      latestClassificationReason?: string;
      latestHasHumanReviewEvidence?: boolean;
      humanAcceptanceStatus?: string;
    };
    humanAcceptanceGate?: {
      status?: string;
      latestEvidenceKind?: string;
      nextRequiredAction?: string;
    };
    productReleaseReadiness?: {
      status?: string;
      releaseDecision?: string;
      blockers?: Array<{ name?: string }>;
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
      immediateActions?: Array<{ id?: string; allowed?: boolean }>;
      blockedActions?: Array<{ id?: string; blocked?: boolean }>;
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
    publicBetaReadiness?: { status?: string; betaCanStart?: boolean };
    publicBetaTesterSessionPreflight?: { status?: string; canInviteTester?: boolean };
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
      decisionCounts?: Record<string, number>;
      releaseDecision?: string;
      reviewOnly?: boolean;
      accepted?: boolean;
      packagingGated?: boolean;
      actionCount?: number;
      actions?: Array<{ id?: string; lane?: string; title?: string; command?: string }>;
      commandSequence?: string[];
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
    commands?: Array<{ command?: string }>;
    routes?: Array<{ href?: string }>;
    aiService?: {
      activeProvider?: string;
      requestedProvider?: string;
      realModelReady?: boolean;
      status?: string;
      safetyBoundary?: { accepted?: boolean; packagingGated?: boolean };
    };
    packagingBoundary?: { accepted?: boolean; packagingGated?: boolean; status?: string };
  }>("/api/product-readiness");
  push(
    checks,
    "Product readiness API exposes product contract",
    productReadiness.response.status === 200 &&
      productReadiness.json.responseMode === "product_readiness_json_v1" &&
      productReadiness.json.currentScope?.id === "bounded_core_teaching_loop" &&
      productReadiness.json.currentScope.allSoftwareObjective === "paused" &&
      productReadiness.json.stableAcceptanceObject?.id === "task-photo-travel-journal" &&
      ["passed", "failed", "not_run_yet"].includes(productReadiness.json.handoffGate?.status ?? "") &&
      Number(productReadiness.json.handoffGate?.total ?? 0) >= 0 &&
      productReadiness.json.missingArtifacts?.length === 0 &&
      productReadiness.json.manualAcceptance?.latestSaved === true &&
      ["automated_browser_smoke", "human_review"].includes(productReadiness.json.manualAcceptance.latestEvidenceKind ?? "") &&
      ["source_marked_as_automation", "valid_human_review_evidence"].includes(
        productReadiness.json.manualAcceptance.latestClassificationReason ?? ""
      ) &&
      productReadiness.json.manualAcceptance.latestHasHumanReviewEvidence ===
        (productReadiness.json.manualAcceptance.latestEvidenceKind === "human_review") &&
      ["needs_real_human_review", "human_review_saved"].includes(
        productReadiness.json.manualAcceptance.humanAcceptanceStatus ?? ""
      ) &&
      ["blocked_needs_human_review", "passed"].includes(productReadiness.json.humanAcceptanceGate?.status ?? "") &&
      ["automated_browser_smoke", "human_review"].includes(productReadiness.json.humanAcceptanceGate?.latestEvidenceKind ?? "") &&
      productReadiness.json.humanAcceptanceGate?.nextRequiredAction?.includes("verify:human-acceptance") === true &&
      ["blocked_not_release_ready", "passed"].includes(productReadiness.json.productReleaseReadiness?.status ?? "") &&
      ["do_not_release", "release_candidate"].includes(productReadiness.json.productReleaseReadiness?.releaseDecision ?? "") &&
      Array.isArray(productReadiness.json.productReleaseReadiness?.blockers) &&
      productReadiness.json.productOperatorBrief?.status === "ready_for_operator_handoff" &&
      productReadiness.json.productOperatorBrief.releaseDecision === "do_not_release" &&
      productReadiness.json.productOperatorBrief.accepted === false &&
      productReadiness.json.productOperatorBrief.packagingGated === true &&
      productReadiness.json.productOperatorBrief.canRelease === false &&
      productReadiness.json.productOperatorBrief.canInviteBoundedBetaTester === true &&
      productReadiness.json.productOperatorBrief.canStartHumanAcceptanceReview === true &&
      productReadiness.json.productOperatorBrief.canPlanRealModelTrial === true &&
      productReadiness.json.productOperatorBrief.canActivateRealModel === false &&
      productReadiness.json.productOperatorBrief.failedReasons?.length === 0 &&
      productReadiness.json.productOperatorBrief.immediateActions?.some(
        (item) => item.id === "invite_one_bounded_beta_tester" && item.allowed === true
      ) === true &&
      productReadiness.json.productOperatorBrief.blockedActions?.some(
        (item) => item.id === "release_product" && item.blocked === true
      ) === true &&
      productReadiness.json.productOperatorBriefVerification?.status === "passed" &&
      productReadiness.json.productOperatorBriefVerification.passed ===
        productReadiness.json.productOperatorBriefVerification.total &&
      Number(productReadiness.json.productOperatorBriefVerification.total ?? 0) >= 6 &&
      productReadiness.json.productOperatorBriefVerification.releaseDecision === "do_not_release" &&
      productReadiness.json.productOperatorBriefVerification.accepted === false &&
      productReadiness.json.productOperatorBriefVerification.packagingGated === true &&
      productReadiness.json.productOperatorBriefVerification.canRelease === false &&
      productReadiness.json.publicBetaReadiness?.status === "passed" &&
      productReadiness.json.publicBetaReadiness.betaCanStart === true &&
      productReadiness.json.publicBetaTesterSessionPreflight?.status === "passed" &&
      productReadiness.json.publicBetaTesterSessionPreflight.canInviteTester === true &&
      productReadiness.json.publicBetaReturnLoop?.status === "waiting_for_first_tester_return" &&
      productReadiness.json.publicBetaReturnLoop.collectionStatus === "waiting_for_feedback" &&
      productReadiness.json.publicBetaReturnLoop.feedbackApiStatus === "passed" &&
      productReadiness.json.publicBetaReturnLoop.followUpPlanStatus === "waiting_for_feedback" &&
      productReadiness.json.publicBetaReturnLoop.followUpVerificationStatus === "passed" &&
      productReadiness.json.publicBetaReturnLoop.returnIntakeVerificationStatus === "passed" &&
      productReadiness.json.publicBetaReturnLoop.canInviteNextTester === true &&
      productReadiness.json.publicBetaReturnLoop.totalReceipts === 0 &&
      productReadiness.json.publicBetaReturnLoop.validReceipts === 0 &&
      productReadiness.json.publicBetaReturnLoop.invalidReceipts === 0 &&
      productReadiness.json.publicBetaReturnLoop.releaseDecision === "do_not_release" &&
      productReadiness.json.publicBetaReturnLoop.reviewOnly === true &&
      productReadiness.json.publicBetaReturnLoop.accepted === false &&
      productReadiness.json.publicBetaReturnLoop.packagingGated === true &&
      Number(productReadiness.json.publicBetaReturnLoop.actionCount ?? 0) >= 2 &&
      productReadiness.json.publicBetaReturnLoop.actions?.some((item) => item.id === "invite-first-bounded-beta-tester") ===
        true &&
      productReadiness.json.publicBetaReturnLoop.actions?.some((item) => item.id === "preserve-release-and-packaging-locks") ===
        true &&
      productReadiness.json.publicBetaReturnLoop.commandSequence?.includes("npm run collect:public-beta-feedback") === true &&
      productReadiness.json.publicBetaReturnLoop.commandSequence?.includes("npm run plan:public-beta-follow-up") === true &&
      productReadiness.json.publicBetaReturnLoop.commandSequence?.some((item) =>
        item.includes("npm run intake:public-beta-return")
      ) === true &&
      productReadiness.json.realModelAdapterContractVerification?.status === "passed" &&
      productReadiness.json.realModelAdapterContractVerification.passed ===
        productReadiness.json.realModelAdapterContractVerification.total &&
      Number(productReadiness.json.realModelAdapterContractVerification.total ?? 0) >= 7 &&
      productReadiness.json.realModelAdapterContractVerification.releaseDecision === "do_not_release" &&
      productReadiness.json.realModelAdapterContractVerification.accepted === false &&
      productReadiness.json.realModelAdapterContractVerification.packagingGated === true &&
      productReadiness.json.realModelAdapterContractVerification.realNetworkUsed === false &&
      productReadiness.json.realModelAdapterContractVerification.realProviderAccepted === false &&
      productReadiness.json.realModelAdapterContractVerification.canActivateRealModel === false &&
      productReadiness.json.realModelAdapterContractVerification.canRelease === false &&
      productReadiness.json.commands?.some((item) => item.command === "npm run verify:product") === true &&
      productReadiness.json.commands?.some((item) => item.command === "npm run verify:real-model-adapter-contract") ===
        true &&
      productReadiness.json.commands?.some((item) => item.command === "npm run build:product-operator-brief") === true &&
      productReadiness.json.commands?.some((item) => item.command === "npm run verify:product-operator-brief") === true &&
      productReadiness.json.commands?.some((item) => item.command === "npm run verify:human-acceptance") === true &&
      productReadiness.json.commands?.some((item) => item.command === "npm run verify:product-release-readiness") === true &&
      productReadiness.json.routes?.some((item) => item.href === "/handoff") === true &&
      productReadiness.json.routes?.some((item) => item.href === "/public-beta") === true &&
      productReadiness.json.aiService?.activeProvider === "mock" &&
      productReadiness.json.aiService.requestedProvider === "mock" &&
      productReadiness.json.aiService.realModelReady === false &&
      productReadiness.json.aiService.safetyBoundary?.accepted === false &&
      productReadiness.json.aiService.safetyBoundary.packagingGated === true &&
      productReadiness.json.packagingBoundary?.accepted === false &&
      productReadiness.json.packagingBoundary.packagingGated === true &&
      productReadiness.json.packagingBoundary.status === "pending_teacher_acceptance",
    `status=${productReadiness.response.status}; readiness=${productReadiness.json.status}; handoff=${productReadiness.json.handoffGate?.status}; beta=${productReadiness.json.publicBetaReadiness?.status}; testerPreflight=${productReadiness.json.publicBetaTesterSessionPreflight?.status}; returnLoop=${productReadiness.json.publicBetaReturnLoop?.status}; operatorBrief=${productReadiness.json.productOperatorBrief?.status}; adapterContract=${productReadiness.json.realModelAdapterContractVerification?.status}`
  );

  const feedbackReceipt = {
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
      name: "Smoke Tester",
      role: "automation",
      date: "2026-06-23",
      environment: "product smoke dry run"
    },
    setup: {
      couldStartProductRuntime: true,
      healthEndpointHealthy: true,
      liveHandoffChecked: true,
      notes: "Dry-run validation only."
    },
    coreLoop: {
      firstRunClear: true,
      traceUnderstandable: true,
      correctionSubmitted: true,
      ruleProvenanceVisible: true,
      rerunChangedBehavior: true,
      notes: "Dry-run validation only."
    },
    trustAndBoundaries: {
      learnedBehaviorClear: true,
      reviewOnlyBoundaryClear: true,
      noReleaseOrAllSoftwareClaim: true,
      notes: "Dry-run validation only."
    },
    blockers: {
      blockingIssue: "",
      confusingWording: "",
      missingProductBehavior: "",
      screenshotOrEvidencePath: ""
    },
    betaDecision: "ready_for_next_beta_tester",
    nextActionRecommendation: "Continue with bounded beta dry-run validation.",
    locks: {
      mustNotSaveAcceptance: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotResumeAllSoftwareObjective: true
    }
  };
  const feedbackApi = await fetch(new URL("/api/public-beta-feedback-receipts", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receipt: feedbackReceipt, dryRun: true })
  });
  const feedbackApiJson = (await feedbackApi.json()) as {
    responseMode?: string;
    status?: string;
    saved?: boolean;
    dryRun?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    releaseDecision?: string;
    failedChecks?: string[];
  };
  push(
    checks,
    "Public beta feedback receipt API validates without saving",
    feedbackApi.status === 200 &&
      feedbackApiJson.responseMode === "public_beta_feedback_save_receipt_json_v1" &&
      feedbackApiJson.status === "validated_dry_run" &&
      feedbackApiJson.saved === false &&
      feedbackApiJson.dryRun === true &&
      feedbackApiJson.releaseDecision === "do_not_release" &&
      feedbackApiJson.accepted === false &&
      feedbackApiJson.packagingGated === true &&
      (feedbackApiJson.failedChecks?.length ?? 0) === 0,
    `status=${feedbackApi.status}; result=${feedbackApiJson.status}; saved=${feedbackApiJson.saved}; failed=${
      feedbackApiJson.failedChecks?.join(",") || "none"
    }`
  );

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
  push(
    checks,
    "Release readiness API exposes current go/no-go",
    releaseReadiness.response.status === 200 &&
      releaseReadiness.json.responseMode === "product_release_readiness_latest_json_v1" &&
      releaseReadiness.json.status === "saved" &&
      releaseReadiness.json.latest?.responseMode === "product_release_readiness_gate_json_v1" &&
      releaseReadiness.json.latest.status === "blocked_not_release_ready" &&
      releaseReadiness.json.latest.releaseDecision === "do_not_release" &&
      releaseReadiness.json.trialReadinessIsReleaseReadiness === false &&
      Array.isArray(releaseReadiness.json.latest.blockers) &&
      releaseReadiness.json.latest.blockers.some((item) => item.name === "Real human acceptance is complete"),
    `status=${releaseReadiness.response.status}; gate=${releaseReadiness.json.latest?.status}; decision=${releaseReadiness.json.latest?.releaseDecision}`
  );

  const aiStatus = await readJson<{
    responseMode?: string;
    activeProvider?: string;
    requestedProvider?: string;
    status?: string;
    realModelReady?: boolean;
    safetyBoundary?: { mockFallback?: boolean; accepted?: boolean; packagingGated?: boolean };
  }>("/api/ai-service-status");
  push(
    checks,
    "AI service status keeps real-model switch explicit",
    aiStatus.response.status === 200 &&
      aiStatus.json.responseMode === "ai_service_runtime_status_json_v1" &&
      aiStatus.json.activeProvider === "mock" &&
      aiStatus.json.requestedProvider === "mock" &&
      aiStatus.json.status === "mock_active" &&
      aiStatus.json.realModelReady === false &&
      aiStatus.json.safetyBoundary?.mockFallback === true &&
      aiStatus.json.safetyBoundary.accepted === false &&
      aiStatus.json.safetyBoundary.packagingGated === true,
    `status=${aiStatus.response.status}; provider=${aiStatus.json.activeProvider}; requested=${aiStatus.json.requestedProvider}; realModelReady=${aiStatus.json.realModelReady}`
  );

  const taskReview = await readText("/tasks/task-photo-travel-journal/review");
  push(
    checks,
    "Task review page keeps evidence approachable",
    taskReview.response.status === 200 &&
      hasAll(taskReview.text, [
        "Tester review view",
        "Current Review Scope",
        "Recent Learning Evidence",
        "Open full evidence page"
      ]),
    `status=${taskReview.response.status}; bytes=${taskReview.text.length}`
  );

  const runPage = await readText("/tasks/task-photo-travel-journal/run");
  push(
    checks,
    "Run page guides the first teaching loop",
    runPage.response.status === 200 &&
      hasAll(runPage.text, [
        "First run guide",
        "Generate transparent run",
        "Teacher Correction",
        "Structured Output",
        "Open checklist"
      ]),
    `status=${runPage.response.status}; bytes=${runPage.text.length}`
  );

  push(
    checks,
    "Product-facing pages avoid mojibake",
    !hasMojibake(dashboard.text) &&
      !hasMojibake(publicBeta.text) &&
      !hasMojibake(manualTest.text) &&
      !hasMojibake(handoff.text) &&
      !hasMojibake(taskReview.text) &&
      !hasMojibake(runPage.text),
    `dashboard=${hasMojibake(dashboard.text)}; publicBeta=${hasMojibake(publicBeta.text)}; manualTest=${hasMojibake(
      manualTest.text
    )}; handoff=${hasMojibake(handoff.text)}; taskReview=${hasMojibake(taskReview.text)}; runPage=${hasMojibake(
      runPage.text
    )}`
  );

  const qualification = await readJson<{
    status?: string;
    responseMode?: string;
    packaging?: { gated?: boolean; accepted?: boolean; status?: string };
    summary?: { requirementsPassed?: number; requirementsTotal?: number };
  }>("/api/tasks/task-photo-travel-journal/qualification");
  push(
    checks,
    "Qualification API remains teacher-review only",
    qualification.response.status === 200 &&
      qualification.json.responseMode === "qualification_summary_json_v1" &&
      qualification.json.status === "qualified_for_teacher_review" &&
      qualification.json.packaging?.gated === true &&
      qualification.json.packaging.accepted === false &&
      qualification.json.packaging.status === "pending_teacher_acceptance",
    `status=${qualification.json.status}; responseMode=${qualification.json.responseMode}; packaging=${JSON.stringify(
      qualification.json.packaging
    )}`
  );

  push(
    checks,
    "Qualification requirements are complete",
    qualification.json.summary?.requirementsPassed === qualification.json.summary?.requirementsTotal &&
      Number(qualification.json.summary?.requirementsTotal ?? 0) > 0,
    `requirements=${qualification.json.summary?.requirementsPassed}/${qualification.json.summary?.requirementsTotal}`
  );

  const result = writeSmokeReceipt(checks);

  console.log(JSON.stringify(result, null, 2));
  console.log(`\nProduct UI/API smoke receipt written to ${receiptPath}`);

  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
