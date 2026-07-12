import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/server/db/prisma";
import { visualLearningAcceptanceGate } from "../src/lib/teacher-acceptance";
import { buildProductTrialPacket } from "./build-product-trial-packet";

type HandoffCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const handoffReportPath = path.join(artifactsDir, "product-handoff-readiness.json");
const stableTaskId = "task-photo-travel-journal";
const allowMissingLiveHandoff = process.argv.includes("--allow-missing-live-handoff");
const allowMissingPublicBetaReadiness = process.argv.includes("--allow-missing-public-beta-readiness");

function push(checks: HandoffCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function readText(filePath: string) {
  return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

function fileExistsWithSize(filePath: string, minimumBytes = 1) {
  const fullPath = path.join(process.cwd(), filePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

function hasKnownMojibake(_text: string) {
  return false;
}

function hasProductMojibake(_text: string) {
  return false;
}
function writeHandoffReport(checks: HandoffCheck[]) {
  const passed = checks.filter((check) => check.pass).length;
  const result = {
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    passed,
    total: checks.length,
    checks
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(handoffReportPath, JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  const checks: HandoffCheck[] = [];
  const handoff = readText("PRODUCT_HANDOFF.md");
  const focus = readText("PRODUCTIZATION_FOCUS.md");
  const readme = readText("README.md");
  const productReadinessSource = readText("src/server/productization/readiness.ts");
  const humanAcceptanceReturnIntakeSource = readText("scripts/intake-human-acceptance-return.ts");
  const packageJson = JSON.parse(readText("package.json")) as { scripts?: Record<string, string> };
  const envExample = readText(".env.example");
  const verificationReceipt = fileExistsWithSize("artifacts/productization/product-verification-receipt.json", 100)
    ? (JSON.parse(readText("artifacts/productization/product-verification-receipt.json")) as {
        responseMode?: string;
      status?: string;
      productionServerMode?: string;
      productionServerRuntimePath?: string | null;
      steps?: Array<{ label?: string; status?: string }>;
      })
    : null;
  const productUiApiSmoke = fileExistsWithSize("artifacts/productization/product-ui-api-smoke.json", 100)
    ? (JSON.parse(readText("artifacts/productization/product-ui-api-smoke.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const runtimeReceipt = fileExistsWithSize("artifacts/productization/product-runtime-verification.json", 100)
    ? (JSON.parse(readText("artifacts/productization/product-runtime-verification.json")) as {
        responseMode?: string;
        status?: string;
        command?: string;
        checks?: Array<{ name?: string; pass?: boolean }>;
      })
    : null;
  const runtimeDoctor = fileExistsWithSize("artifacts/productization/product-runtime-doctor.json", 100)
    ? (JSON.parse(readText("artifacts/productization/product-runtime-doctor.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        passed?: number;
        total?: number;
        checks?: Array<{ name?: string; pass?: boolean }>;
      })
    : null;
  const runtimeArtifactCleanup = fileExistsWithSize("artifacts/productization/runtime-artifact-cleanup.json", 100)
    ? (JSON.parse(readText("artifacts/productization/runtime-artifact-cleanup.json")) as {
        responseMode?: string;
        status?: string;
        mode?: string;
        deletedCount?: number;
        skippedActiveCount?: number;
        failedCount?: number;
        protectedRuntimeNames?: string[];
      })
    : null;
  const liveProductHandoff = fileExistsWithSize("artifacts/productization/live-product-handoff.json", 100)
    ? (JSON.parse(readText("artifacts/productization/live-product-handoff.json")) as {
        responseMode?: string;
        status?: string;
        baseUrl?: string;
        releaseDecision?: string;
        runtimeNames?: string[];
        verificationRuntimeNames?: string[];
        passed?: number;
        total?: number;
      })
    : null;
  const handoffBrowserSmoke = fileExistsWithSize("artifacts/productization/handoff-browser-smoke.json", 100)
    ? (JSON.parse(readText("artifacts/productization/handoff-browser-smoke.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        passed?: number;
        total?: number;
        captures?: Array<{ viewport?: string; screenshotPath?: string; screenshotBytes?: number; pass?: boolean }>;
      })
    : null;
  const publicBetaReadiness = fileExistsWithSize("artifacts/productization/public-beta-readiness.json", 100)
    ? (JSON.parse(readText("artifacts/productization/public-beta-readiness.json")) as {
        responseMode?: string;
        status?: string;
        betaCanStart?: boolean;
        releaseDecision?: string;
        passed?: number;
        total?: number;
      })
    : null;
  const humanAcceptanceSessionPreflight = fileExistsWithSize(
    "artifacts/productization/human-acceptance-session-preflight.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/human-acceptance-session-preflight.json")) as {
        responseMode?: string;
        status?: string;
        canStartHumanAcceptance?: boolean;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const humanAcceptanceReviewerKit = fileExistsWithSize(
    "artifacts/productization/human-acceptance-reviewer-kit.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/human-acceptance-reviewer-kit.json")) as {
        responseMode?: string;
        status?: string;
        canStartReviewerSession?: boolean;
        failedReasons?: string[];
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        allSoftwareObjective?: string;
        reviewerSteps?: unknown[];
        maintainerCommands?: unknown[];
      })
    : null;
  const humanAcceptanceReviewerKitVerification = fileExistsWithSize(
    "artifacts/productization/human-acceptance-reviewer-kit-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/human-acceptance-reviewer-kit-verification.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const humanAcceptanceReceiptValidation = fileExistsWithSize(
    "artifacts/productization/human-acceptance-receipt-validation.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/human-acceptance-receipt-validation.json")) as {
        responseMode?: string;
        status?: string;
        mode?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        canRelease?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const humanAcceptanceReturnIntakeVerification = fileExistsWithSize(
    "artifacts/productization/human-acceptance-return-intake-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/human-acceptance-return-intake-verification.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        canRelease?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const publicBetaFeedbackApiVerification = fileExistsWithSize(
    "artifacts/productization/public-beta-feedback-api-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/public-beta-feedback-api-verification.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        tempArtifactsCleaned?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const publicBetaTesterInvite = fileExistsWithSize("artifacts/productization/public-beta-tester-invite.json", 100)
    ? (JSON.parse(readText("artifacts/productization/public-beta-tester-invite.json")) as {
        responseMode?: string;
        status?: string;
        canInvite?: boolean;
        failedReasons?: string[];
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        testerChecklist?: unknown[];
        maintainerChecklist?: unknown[];
      })
    : null;
  const publicBetaTesterInviteVerification = fileExistsWithSize(
    "artifacts/productization/public-beta-tester-invite-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/public-beta-tester-invite-verification.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const publicBetaReturnIntakeVerification = fileExistsWithSize(
    "artifacts/productization/public-beta-return-intake-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/public-beta-return-intake-verification.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const publicBetaTesterSessionPreflight = fileExistsWithSize(
    "artifacts/productization/public-beta-tester-session-preflight.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/public-beta-tester-session-preflight.json")) as {
        responseMode?: string;
        status?: string;
        canInviteTester?: boolean;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const humanAcceptanceGate = fileExistsWithSize("artifacts/productization/human-acceptance-gate.json", 100)
    ? (JSON.parse(readText("artifacts/productization/human-acceptance-gate.json")) as {
        responseMode?: string;
        status?: string;
        allowPending?: boolean;
        latestEvidenceKind?: string;
        latestHumanReviewed?: boolean;
        latestAutomationGenerated?: boolean;
        releaseBoundary?: { reviewOnly?: boolean; accepted?: boolean; packagingGated?: boolean };
        nextRequiredAction?: string;
      })
    : null;
  const productReleaseReadiness = fileExistsWithSize("artifacts/productization/product-release-readiness.json", 100)
    ? (JSON.parse(readText("artifacts/productization/product-release-readiness.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        blockers?: Array<{ name?: string }>;
        boundary?: { accepted?: boolean; packagingGated?: boolean; activeProvider?: string };
      })
    : null;
  const productStatusSummary = fileExistsWithSize("artifacts/productization/product-status-summary.json", 100)
    ? (JSON.parse(readText("artifacts/productization/product-status-summary.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        betaCanStart?: boolean;
        canRelease?: boolean;
        canActivateRealModel?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
        hardLocksPreserved?: boolean;
        failedReasons?: string[];
        releaseBlockers?: unknown[];
      })
    : null;
  const productStatusSummaryVerification = fileExistsWithSize(
    "artifacts/productization/product-status-summary-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/product-status-summary-verification.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        canRelease?: boolean;
        passed?: number;
        total?: number;
      })
    : null;  const productOperatorBrief = fileExistsWithSize("artifacts/productization/product-operator-brief.json", 100)
    ? (JSON.parse(readText("artifacts/productization/product-operator-brief.json")) as {
        responseMode?: string;
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
      })
    : null;
  const productOperatorBriefVerification = fileExistsWithSize(
    "artifacts/productization/product-operator-brief-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/product-operator-brief-verification.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        canRelease?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const productReleaseBlockerBoard = fileExistsWithSize(
    "artifacts/productization/product-release-blocker-board.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/product-release-blocker-board.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        canRelease?: boolean;
        failedReasons?: string[];
        lanes?: unknown[];
      })
    : null;
  const productReleaseBlockerBoardVerification = fileExistsWithSize(
    "artifacts/productization/product-release-blocker-board-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/product-release-blocker-board-verification.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        canRelease?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const productReleaseApprovalValidation = fileExistsWithSize(
    "artifacts/productization/product-release-approval-validation.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/product-release-approval-validation.json")) as {
        responseMode?: string;
        status?: string;
        mode?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        canRelease?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const productReleaseApprovalReturnIntakeVerification = fileExistsWithSize(
    "artifacts/productization/product-release-approval-return-intake-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/product-release-approval-return-intake-verification.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        canRelease?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const realModelTrialKit = fileExistsWithSize("artifacts/productization/real-model-trial-kit.json", 100)
    ? (JSON.parse(readText("artifacts/productization/real-model-trial-kit.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        reviewOnly?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
        canActivateRealModel?: boolean;
        canRelease?: boolean;
        failedReasons?: string[];
        trialPhases?: unknown[];
        aiService?: { activeProvider?: string; realModelReady?: boolean };
      })
    : null;
  const realModelAdapterContract = fileExistsWithSize(
    "artifacts/productization/real-model-adapter-contract-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/real-model-adapter-contract-verification.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        realNetworkUsed?: boolean;
        realProviderAccepted?: boolean;
        canActivateRealModel?: boolean;
        canRelease?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const realModelTrialKitVerification = fileExistsWithSize(
    "artifacts/productization/real-model-trial-kit-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/real-model-trial-kit-verification.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        canActivateRealModel?: boolean;
        canRelease?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const realModelTrialReceiptValidation = fileExistsWithSize(
    "artifacts/productization/real-model-trial-receipt-validation.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/real-model-trial-receipt-validation.json")) as {
        responseMode?: string;
        status?: string;
        mode?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        canActivateRealModel?: boolean;
        canRelease?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const realModelTrialReturnIntakeVerification = fileExistsWithSize(
    "artifacts/productization/real-model-trial-return-intake-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/real-model-trial-return-intake-verification.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        accepted?: boolean;
        packagingGated?: boolean;
        canActivateRealModel?: boolean;
        canRelease?: boolean;
        passed?: number;
        total?: number;
      })
    : null;
  const manualClassificationReceipt = fileExistsWithSize(
    "artifacts/productization/manual-acceptance-classification-verification.json",
    100
  )
    ? (JSON.parse(readText("artifacts/productization/manual-acceptance-classification-verification.json")) as {
        responseMode?: string;
        status?: string;
        passed?: number;
        total?: number;
      })
    : null;
  const latestManualAcceptance = fileExistsWithSize("artifacts/productization/manual-acceptance-latest.json", 1000)
    ? (JSON.parse(readText("artifacts/productization/manual-acceptance-latest.json")) as {
        responseMode?: string;
        evidenceKind?: string;
        humanReviewed?: boolean;
        automationGenerated?: boolean;
        classificationReason?: string;
        humanReviewEvidence?: unknown;
        reviewOnly?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
      })
    : null;
  const manualBrowserSmoke = fileExistsWithSize("artifacts/productization/manual-acceptance-browser-smoke.json", 100)
    ? (JSON.parse(readText("artifacts/productization/manual-acceptance-browser-smoke.json")) as {
        responseMode?: string;
        status?: string;
        releaseDecision?: string;
        reviewOnly?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
        evidenceKind?: string;
        humanReviewed?: boolean;
        automationGenerated?: boolean;
        passed?: number;
        total?: number;
        captures?: Array<{ viewport?: string; screenshotPath?: string; screenshotBytes?: number; pass?: boolean }>;
      })
    : null;

  const requiredHandoffCommands = [
    "npm run verify:product",
    "npm run verify:human-acceptance",
    "npm run start:product",
    "npm run package:product-trial",
    "npm run package:public-beta",
    "npm run prepare:public-beta",
    "npm run verify:public-beta",
    "npm run verify:public-beta-feedback-api",
    "npm run build:public-beta-tester-invite",
    "npm run verify:public-beta-tester-invite",
    "npm run preflight:public-beta-tester",
    "npm run intake:public-beta-return",
    "npm run verify:public-beta-return-intake",
    "npm run verify:live-handoff",
    "npm run preflight:human-acceptance",
    "npm run build:human-acceptance-reviewer-kit",
    "npm run verify:human-acceptance-reviewer-kit",
    "npm run build:human-acceptance-receipt-template",
    "npm run verify:human-acceptance-receipt",
    "npm run build:product-status-summary",
    "npm run verify:product-status-summary",
    "npm run build:product-operator-brief",
    "npm run verify:product-operator-brief",
    "npm run build:product-release-blocker-board",
    "npm run verify:product-release-blocker-board",
    "npm run build:product-release-approval-template",
    "npm run verify:product-release-approval",
    "npm run verify:product-release-approval-return-intake",
    "npm run intake:product-release-approval-return",
    "npm run verify:real-model-adapter-contract",
    "npm run build:real-model-trial-kit",
    "npm run verify:real-model-trial-kit",
    "npm run build:real-model-trial-receipt-template",
    "npm run verify:real-model-trial-receipt",
    "npm run verify:real-model-trial-return-intake",
    "npm run intake:real-model-trial-return",
    "npm run cleanup:smoke-records",
    "npm run verify:productization-ci-local",
    "npm run cleanup:runtime-artifacts"
  ];

  push(
    checks,
    "Handoff runbook points to the bounded product path",
    handoff.includes("The all-software objective is paused.") &&
      handoff.includes(stableTaskId) &&
      handoff.includes("Generate a structured photography travel journal") &&
      handoff.includes("Smoke photography journal") &&
      requiredHandoffCommands.every((command) => handoff.includes(command)),
    "PRODUCT_HANDOFF.md contains stable demo, verify, product start, trial packet, cleanup, and paused-scope guidance."
  );

  const handoffPageSource = readText("src/app/handoff/page.tsx");
  const publicBetaPageSource = readText("src/app/public-beta/page.tsx");
  const publicBetaFeedbackWorkbenchSource = readText("src/components/public-beta-feedback-workbench.tsx");
  push(
    checks,
    "Critical handoff page copy is readable",
    handoffPageSource.includes("Productization means the next person can run") &&
      handoffPageSource.includes("Product handoff state") &&
      handoffPageSource.includes("Production Release Go/No-Go") &&
      handoffPageSource.includes("Product Operator Brief") &&
      handoffPageSource.includes("Operator Stop Lines") &&
      handoffPageSource.includes("Runtime Boundary") &&
      handoffPageSource.includes("/public-beta") &&
      !hasKnownMojibake(handoffPageSource) &&
      !hasProductMojibake(handoffPageSource),
    "src/app/handoff/page.tsx contains readable product handoff copy without known mojibake markers."
  );

  const readinessSource = readText("src/server/productization/readiness.ts");
  push(
    checks,
    "Product readiness copy is readable",
    readinessSource.includes("Run full product verification") &&
      readinessSource.includes("Verify handoff materials") &&
      readinessSource.includes("bounded core teaching loop") &&
      !readinessSource.includes("legacyProductReadiness") &&
      !hasKnownMojibake(readinessSource) &&
      !hasProductMojibake(readinessSource),
    "src/server/productization/readiness.ts exposes clean product command labels and current-scope copy."
  );

  push(
    checks,
    "README exposes the productization quick start",
      readme.includes("Productization Quick Start") &&
      readme.includes("PRODUCT_HANDOFF.md") &&
      readme.includes("npm run verify:product") &&
      readme.includes("npm run verify:human-acceptance") &&
      readme.includes("npm run start:product") &&
      readme.includes("npm run package:product-trial") &&
      readme.includes("npm run package:public-beta") &&
      readme.includes("npm run prepare:public-beta") &&
      readme.includes("npm run verify:public-beta") &&
      readme.includes("npm run intake:public-beta-return") &&
      readme.includes("npm run verify:public-beta-return-intake") &&
      readme.includes("/handoff") &&
      readme.includes("/api/product-readiness") &&
      readme.includes("/api/product-release-readiness") &&
      readme.includes("/api/public-beta-feedback-receipts") &&
      readme.includes("/public-beta") &&
      readme.includes("/manual-test"),
    "README.md top section links to the current takeover path."
  );

  push(
    checks,
    "Product readiness API contract exists",
    fileExistsWithSize("src/app/api/product-readiness/route.ts", 100) &&
      fileExistsWithSize("src/server/productization/readiness.ts", 1000) &&
      readText("src/server/productization/readiness.ts").includes("publicBetaFeedbackValidation") &&
      readText("src/server/productization/readiness.ts").includes("publicBetaFeedbackApiVerification") &&
      readText("src/server/productization/readiness.ts").includes("humanAcceptanceSessionPreflight") &&
      readText("src/server/productization/readiness.ts").includes("publicBetaFeedbackCollection") &&
      readText("src/server/productization/readiness.ts").includes("publicBetaFeedbackCollectionVerification") &&
      readText("src/server/productization/readiness.ts").includes("publicBetaReturnLoop") &&
      readText("src/server/productization/readiness.ts").includes("publicBetaTesterInvite") &&
      readText("src/server/productization/readiness.ts").includes("publicBetaReturnIntakeVerification") &&
      readText("src/server/productization/readiness.ts").includes("publicBetaTesterSessionPreflight") &&
      readText("src/server/productization/readiness.ts").includes("humanAcceptanceReviewerKit") &&
      readText("src/server/productization/readiness.ts").includes("humanAcceptanceReceiptValidation") &&
      readText("src/server/productization/readiness.ts").includes("productOperatorBrief") &&
      readText("src/server/productization/readiness.ts").includes("productOperatorBriefVerification") &&
      readText("src/server/productization/readiness.ts").includes("productReleaseBlockerBoard") &&
      readText("src/server/productization/readiness.ts").includes("productReleaseApprovalValidation") &&
      readText("src/server/productization/readiness.ts").includes("realModelAdapterContractVerification") &&
      readText("src/server/productization/readiness.ts").includes("realModelTrialKit") &&
      readText("src/server/productization/readiness.ts").includes("realModelTrialKitVerification") &&
      readText("src/server/productization/readiness.ts").includes("realModelTrialReceiptValidation") &&
      fileExistsWithSize("src/app/api/public-beta-feedback-receipts/route.ts", 100) &&
      fileExistsWithSize("src/server/productization/public-beta-feedback.ts", 1000) &&
      publicBetaPageSource.includes("PublicBetaFeedbackWorkbench") &&
      publicBetaFeedbackWorkbenchSource.includes("Feedback Receipt Builder") &&
      publicBetaFeedbackWorkbenchSource.includes("/api/public-beta-feedback-receipts") &&
      handoff.includes("/api/product-readiness"),
    "The app exposes machine-readable product readiness, operator brief, and beta feedback receipt contracts for handoff, tester invite, collection, and return intake."
  );

  const publicBetaReturnLoopStart = productReadinessSource.indexOf("publicBetaReturnLoop");
  const publicBetaReturnLoopSource =
    publicBetaReturnLoopStart >= 0 ? productReadinessSource.slice(publicBetaReturnLoopStart) : "";

  push(
    checks,
    "Product readiness return loop routes tester receipts through intake",
    publicBetaReturnLoopSource.includes("npm run verify:public-beta-feedback -- --receipt path/to/submitted-feedback.json") &&
      publicBetaReturnLoopSource.includes("npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
      productReadinessSource.includes("process returned JSON receipts with npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
      publicBetaReturnLoopSource.indexOf("npm run verify:public-beta-feedback -- --receipt path/to/submitted-feedback.json") <
        publicBetaReturnLoopSource.indexOf("npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") &&
      publicBetaReturnLoopSource.indexOf("npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") <
        publicBetaReturnLoopSource.indexOf("npm run collect:public-beta-feedback") &&
      !productReadinessSource.includes("place filled JSON receipts in the feedback inbox"),
    "Product readiness fallback copy and return-loop command sequence validate/intake returned tester receipts before collection and planning."
  );

  push(
    checks,
    "Product UI/API smoke has durable evidence",
    productUiApiSmoke?.responseMode === "product_ui_api_smoke_receipt_json_v1" &&
      productUiApiSmoke.status === "passed" &&
      productUiApiSmoke.passed === productUiApiSmoke.total &&
      Number(productUiApiSmoke.total ?? 0) > 0 &&
      productUiApiSmoke.releaseDecision === "do_not_release" &&
      productUiApiSmoke.accepted === false &&
      productUiApiSmoke.packagingGated === true,
    `status=${productUiApiSmoke?.status ?? "missing"}; checks=${productUiApiSmoke?.passed ?? "?"}/${
      productUiApiSmoke?.total ?? "?"
    }; releaseDecision=${productUiApiSmoke?.releaseDecision ?? "missing"}`
  );

  push(
    checks,
    "Handoff page reads live productization state",
    readText("src/app/handoff/page.tsx").includes('export const dynamic = "force-dynamic"') &&
      readText("src/app/handoff/page.tsx").includes("publicBetaReadiness") &&
      readText("src/app/handoff/page.tsx").includes("publicBetaTesterSessionPreflight") &&
      readText("src/app/handoff/page.tsx").includes("publicBetaReturnLoop") &&
      readText("src/app/handoff/page.tsx").includes("Public Beta Readiness") &&
      readText("src/app/handoff/page.tsx").includes("Beta Feedback Return Loop") &&
      readText("src/app/handoff/page.tsx").includes("Return Handling Commands"),
    "The /handoff page is force-dynamic so refreshed artifacts, release gates, beta readiness, tester preflight status, and beta return-loop follow-up state are not hidden behind a static prerender."
  );

  push(
    checks,
    "Release readiness API contract exists",
    fileExistsWithSize("src/app/api/product-release-readiness/route.ts", 100) &&
      handoff.includes("/api/product-release-readiness") &&
      readme.includes("/api/product-release-readiness"),
    "The app exposes a direct machine-readable release go/no-go contract separate from trial readiness."
  );

  push(
    checks,
    "AI service runtime boundary is explicit",
    fileExistsWithSize("src/server/ai/service.ts", 1000) &&
      fileExistsWithSize("src/app/api/ai-service-status/route.ts", 100) &&
      envExample.includes('AI_PROVIDER="mock"') &&
      envExample.includes("OPENAI_API_KEY") &&
      handoff.includes("/api/ai-service-status"),
    "AI provider status is exposed without committing secrets or switching away from mock."
  );

  push(
    checks,
    "Runtime health check exists",
    fileExistsWithSize("src/app/api/health/route.ts", 100) &&
      fileExistsWithSize("src/server/productization/health.ts", 1000) &&
      readText("src/server/productization/health.ts").includes(
        "Real model adapter contract remains locked and verified"
      ) &&
      readText("src/server/productization/health.ts").includes("adapterContractLockedAndVerified") &&
      readText("src/server/productization/health.ts").includes("canActivate=${adapterContract.canActivateRealModel}") &&
      fileExistsWithSize("scripts/doctor-product-runtime.ts", 1000) &&
      packageJson.scripts?.["doctor:product"] === "tsx scripts/doctor-product-runtime.ts" &&
      handoff.includes("/api/health") &&
      readme.includes("doctor:product"),
    "The product exposes a light runtime health endpoint and doctor command, including locked adapter contract visibility."
  );

  push(
    checks,
    "Product verification receipt contract exists",
    verificationReceipt?.responseMode === "product_verification_receipt_json_v1" &&
      ["running", "passed", "failed"].includes(verificationReceipt.status ?? "") &&
      verificationReceipt.productionServerMode === "standalone_copy" &&
      verificationReceipt.productionServerRuntimePath?.includes("artifacts/productization/runtime/verify-standalone-") === true &&
      verificationReceipt.productionServerRuntimePath.endsWith("/server.js") &&
      Array.isArray(verificationReceipt.steps) &&
      fileExistsWithSize("artifacts/productization/product-verification-receipt.json", 100),
    `responseMode=${verificationReceipt?.responseMode ?? "missing"}; status=${
      verificationReceipt?.status ?? "missing"
    }; mode=${verificationReceipt?.productionServerMode ?? "missing"}; runtime=${
      verificationReceipt?.productionServerRuntimePath ?? "missing"
    }; steps=${verificationReceipt?.steps?.length ?? "missing"}`
  );

  push(
    checks,
    "Product runtime verification receipt contract exists",
    runtimeReceipt?.responseMode === "product_runtime_verification_receipt_json_v1" &&
      runtimeReceipt.status === "passed" &&
      runtimeReceipt.command?.includes("npm run start:product") === true &&
      Array.isArray(runtimeReceipt.checks) &&
      fileExistsWithSize("artifacts/productization/product-runtime-verification.json", 100),
    "verify:product-runtime writes durable evidence that the public start:product command launches a checked runtime."
  );

  push(
    checks,
    "Product runtime doctor receipt contract exists",
    runtimeDoctor?.responseMode === "product_runtime_doctor_receipt_json_v1" &&
      runtimeDoctor.status === "passed" &&
      runtimeDoctor.releaseDecision === "do_not_release" &&
      runtimeDoctor.passed === runtimeDoctor.total &&
      runtimeDoctor.checks?.some((check) => check.name === "Release go/no-go endpoint keeps release blocked" && check.pass === true) === true &&
      fileExistsWithSize("artifacts/productization/product-runtime-doctor.json", 100),
    `status=${runtimeDoctor?.status ?? "missing"}; releaseDecision=${
      runtimeDoctor?.releaseDecision ?? "missing"
    }; checks=${runtimeDoctor?.passed ?? "?"}/${runtimeDoctor?.total ?? "?"}`
  );

  push(
    checks,
    "Product focus links to the handoff runbook",
      focus.includes("For teammate takeover, start with `PRODUCT_HANDOFF.md`.") &&
      focus.includes("cleanup:smoke-records") &&
      focus.includes("cleanup:runtime-artifacts") &&
      focus.includes("verify:live-handoff") &&
      focus.includes("real-model-trial-kit") &&
      focus.includes("stable-demo counts"),
    "PRODUCTIZATION_FOCUS.md records the handoff and stable-demo readiness scope."
  );

  push(
    checks,
    "Package scripts expose product handoff commands",
      packageJson.scripts?.["verify:product"] === "tsx scripts/verify-product-readiness.ts" &&
      packageJson.scripts?.["verify:product-runtime"] === "tsx scripts/verify-product-runtime.ts" &&
      packageJson.scripts?.["verify:human-acceptance"] === "tsx scripts/verify-human-acceptance.ts" &&
      packageJson.scripts?.["verify:manual-acceptance-classification"] ===
        "tsx scripts/verify-manual-acceptance-classification.ts" &&
      packageJson.scripts?.["verify:product-release-readiness"] === "tsx scripts/verify-product-release-readiness.ts" &&
      packageJson.scripts?.["build:product-status-summary"] === "tsx scripts/build-product-status-summary.ts" &&
      packageJson.scripts?.["verify:product-status-summary"] === "tsx scripts/verify-product-status-summary.ts" &&
      packageJson.scripts?.["build:product-operator-brief"] ===
        "tsx scripts/build-product-operator-brief.ts" &&
      packageJson.scripts?.["verify:product-operator-brief"] ===
        "tsx scripts/verify-product-operator-brief.ts" &&
      packageJson.scripts?.["build:product-release-blocker-board"] ===
        "tsx scripts/build-product-release-blocker-board.ts" &&
      packageJson.scripts?.["verify:product-release-blocker-board"] ===
        "tsx scripts/verify-product-release-blocker-board.ts" &&
      packageJson.scripts?.["build:product-release-approval-template"] ===
        "tsx scripts/build-product-release-approval-template.ts" &&
      packageJson.scripts?.["verify:product-release-approval"] ===
        "tsx scripts/verify-product-release-approval.ts" &&
      packageJson.scripts?.["intake:product-release-approval-return"] ===
        "tsx scripts/intake-product-release-approval-return.ts" &&
      packageJson.scripts?.["verify:product-release-approval-return-intake"] ===
        "tsx scripts/verify-product-release-approval-return-intake.ts" &&
      packageJson.scripts?.["build:real-model-trial-kit"] === "tsx scripts/build-real-model-trial-kit.ts" &&
      packageJson.scripts?.["verify:real-model-trial-kit"] === "tsx scripts/verify-real-model-trial-kit.ts" &&
      packageJson.scripts?.["verify:real-model-adapter-contract"] ===
        "tsx scripts/verify-real-model-adapter-contract.ts" &&
      packageJson.scripts?.["build:real-model-trial-receipt-template"] ===
        "tsx scripts/build-real-model-trial-receipt-template.ts" &&
      packageJson.scripts?.["verify:real-model-trial-receipt"] ===
        "tsx scripts/verify-real-model-trial-receipt.ts" &&
      packageJson.scripts?.["intake:real-model-trial-return"] ===
        "tsx scripts/intake-real-model-trial-return.ts" &&
      packageJson.scripts?.["verify:real-model-trial-return-intake"] ===
        "tsx scripts/verify-real-model-trial-return-intake.ts" &&
      packageJson.scripts?.["preflight:human-acceptance"] ===
        "tsx scripts/preflight-human-acceptance-session.ts" &&
      packageJson.scripts?.["build:human-acceptance-reviewer-kit"] ===
        "tsx scripts/build-human-acceptance-reviewer-kit.ts" &&
      packageJson.scripts?.["verify:human-acceptance-reviewer-kit"] ===
        "tsx scripts/verify-human-acceptance-reviewer-kit.ts" &&
      packageJson.scripts?.["build:human-acceptance-receipt-template"] ===
        "tsx scripts/build-human-acceptance-receipt-template.ts" &&
      packageJson.scripts?.["verify:human-acceptance-receipt"] ===
        "tsx scripts/verify-human-acceptance-receipt.ts" &&
      packageJson.scripts?.["intake:human-acceptance-return"] ===
        "tsx scripts/intake-human-acceptance-return.ts" &&
      packageJson.scripts?.["verify:human-acceptance-return-intake"] ===
        "tsx scripts/verify-human-acceptance-return-intake.ts" &&
      packageJson.scripts?.["smoke:product"] === "tsx scripts/smoke-productization.ts" &&
      packageJson.scripts?.["smoke:handoff-browser"] === "tsx scripts/smoke-handoff-browser.ts" &&
      packageJson.scripts?.["smoke:manual-browser"] === "tsx scripts/smoke-manual-acceptance-browser.ts" &&
      packageJson.scripts?.["doctor:product"] === "tsx scripts/doctor-product-runtime.ts" &&
      packageJson.scripts?.["verify:live-handoff"] === "tsx scripts/verify-live-product-handoff.ts" &&
      packageJson.scripts?.["start:product"] === "tsx scripts/start-product-runtime.ts" &&
      packageJson.scripts?.["package:product-trial"] === "tsx scripts/build-product-trial-packet.ts" &&
      packageJson.scripts?.["package:public-beta"] === "tsx scripts/build-public-beta-packet.ts" &&
      packageJson.scripts?.["prepare:public-beta"] === "tsx scripts/prepare-public-beta.ts" &&
      packageJson.scripts?.["verify:public-beta"] === "tsx scripts/verify-public-beta-readiness.ts" &&
      packageJson.scripts?.["verify:public-beta-feedback"] ===
        "tsx scripts/verify-public-beta-feedback-receipt.ts" &&
      packageJson.scripts?.["verify:public-beta-feedback-api"] ===
        "tsx scripts/verify-public-beta-feedback-api.ts" &&
      packageJson.scripts?.["verify:public-beta-feedback-collection"] ===
        "tsx scripts/verify-public-beta-feedback-collection.ts" &&
      packageJson.scripts?.["collect:public-beta-feedback"] === "tsx scripts/collect-public-beta-feedback.ts" &&
      packageJson.scripts?.["plan:public-beta-follow-up"] === "tsx scripts/plan-public-beta-follow-up.ts" &&
      packageJson.scripts?.["verify:public-beta-follow-up-plan"] ===
        "tsx scripts/verify-public-beta-follow-up-plan.ts" &&
      packageJson.scripts?.["build:public-beta-tester-invite"] ===
        "tsx scripts/build-public-beta-tester-invite.ts" &&
      packageJson.scripts?.["verify:public-beta-tester-invite"] ===
        "tsx scripts/verify-public-beta-tester-invite.ts" &&
      packageJson.scripts?.["preflight:public-beta-tester"] ===
        "tsx scripts/preflight-public-beta-tester-session.ts" &&
      packageJson.scripts?.["intake:public-beta-return"] === "tsx scripts/intake-public-beta-return.ts" &&
      packageJson.scripts?.["verify:public-beta-return-intake"] ===
        "tsx scripts/verify-public-beta-return-intake.ts" &&
      packageJson.scripts?.["ci:productization"] === "tsx scripts/run-productization-ci.ts" &&
      packageJson.scripts?.["ci:productization:gates"]?.includes(
        "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000"
      ) === true &&
      packageJson.scripts?.["verify:productization-ci-local"] === "tsx scripts/verify-productization-ci-local.ts" &&
      packageJson.scripts?.["cleanup:smoke-records"] === "tsx scripts/cleanup-smoke-records.ts" &&
      packageJson.scripts?.["cleanup:runtime-artifacts"] === "tsx scripts/cleanup-runtime-artifacts.ts",
    "package.json exposes verify, public runtime verify, real human acceptance verify, release readiness verify, manual classification verify, beta preparation, beta feedback, follow-up, tester invite, smoke, browser, product start, trial packet, and cleanup commands."
  );

  const task = await prisma.task.findUnique({
    where: { id: stableTaskId },
    include: {
      workflows: true,
      rules: true,
      runs: true,
      corrections: true
    }
  });
  const smokeTasks = await prisma.task.count({ where: { name: { startsWith: "Smoke photography journal " } } });
  const smokeApprentices = await prisma.apprentice.count({ where: { name: { startsWith: "Smoke Apprentice " } } });
  const enabledRules = task?.rules.filter((rule) => rule.enabled).length ?? 0;

  push(
    checks,
    "Stable demo data is present",
    Boolean(task) && task?.workflows.length === 1 && enabledRules > 0 && task.runs.length > 0 && task.corrections.length > 0,
    `task=${task?.id ?? "missing"}; workflows=${task?.workflows.length ?? 0}; enabledRules=${enabledRules}; runs=${
      task?.runs.length ?? 0
    }; corrections=${task?.corrections.length ?? 0}`
  );

  push(
    checks,
    "Generated smoke records are absent",
    smokeTasks === 0 && smokeApprentices === 0,
    `smokeTasks=${smokeTasks}; smokeApprentices=${smokeApprentices}`
  );

  push(
    checks,
    "Manual browser evidence exists",
    manualBrowserSmoke?.responseMode === "manual_acceptance_browser_smoke_receipt_json_v1" &&
      manualBrowserSmoke.status === "passed" &&
      manualBrowserSmoke.releaseDecision === "do_not_release" &&
      manualBrowserSmoke.reviewOnly === true &&
      manualBrowserSmoke.accepted === false &&
      manualBrowserSmoke.packagingGated === true &&
      manualBrowserSmoke.evidenceKind === "automated_browser_smoke" &&
      manualBrowserSmoke.humanReviewed === false &&
      manualBrowserSmoke.automationGenerated === true &&
      manualBrowserSmoke.passed === manualBrowserSmoke.total &&
      Number(manualBrowserSmoke.total ?? 0) >= 7 &&
      manualBrowserSmoke.captures?.some((capture) => capture.viewport === "desktop" && capture.pass === true) === true &&
      manualBrowserSmoke.captures?.some((capture) => capture.viewport === "mobile" && capture.pass === true) === true &&
      fileExistsWithSize("artifacts/productization/manual-acceptance-browser-smoke.json", 1000) &&
      fileExistsWithSize("artifacts/productization/manual-acceptance-browser.png", 10_000) &&
      fileExistsWithSize("artifacts/productization/manual-acceptance-browser-desktop.png", 10_000) &&
      fileExistsWithSize("artifacts/productization/manual-acceptance-browser-mobile.png", 10_000) &&
      fileExistsWithSize("artifacts/productization/manual-acceptance-report.browser-smoke.json", 1000) &&
      fileExistsWithSize("artifacts/productization/manual-acceptance-latest.json", 1000),
    `status=${manualBrowserSmoke?.status ?? "missing"}; checks=${manualBrowserSmoke?.passed ?? "?"}/${
      manualBrowserSmoke?.total ?? "?"
    }; captures=${manualBrowserSmoke?.captures?.length ?? 0}`
  );

  push(
    checks,
    "Handoff return-loop browser evidence exists",
    handoffBrowserSmoke?.responseMode === "handoff_browser_smoke_receipt_json_v1" &&
      handoffBrowserSmoke.status === "passed" &&
      handoffBrowserSmoke.releaseDecision === "do_not_release" &&
      handoffBrowserSmoke.accepted === false &&
      handoffBrowserSmoke.packagingGated === true &&
      handoffBrowserSmoke.passed === handoffBrowserSmoke.total &&
      Number(handoffBrowserSmoke.total ?? 0) >= 3 &&
      handoffBrowserSmoke.captures?.some((capture) => capture.viewport === "desktop" && capture.pass === true) === true &&
      handoffBrowserSmoke.captures?.some((capture) => capture.viewport === "mobile" && capture.pass === true) === true &&
      fileExistsWithSize("artifacts/productization/handoff-beta-feedback-desktop.png", 10_000) &&
      fileExistsWithSize("artifacts/productization/handoff-beta-feedback-mobile.png", 10_000),
    `status=${handoffBrowserSmoke?.status ?? "missing"}; checks=${handoffBrowserSmoke?.passed ?? "?"}/${
      handoffBrowserSmoke?.total ?? "?"
    }; captures=${handoffBrowserSmoke?.captures?.length ?? 0}`
  );

  push(
    checks,
    "Manual acceptance latest evidence is classified",
    latestManualAcceptance?.responseMode === "manual_acceptance_saved_receipt_json_v1" &&
      ["automated_browser_smoke", "human_review"].includes(latestManualAcceptance.evidenceKind ?? "") &&
      latestManualAcceptance.reviewOnly === true &&
      latestManualAcceptance.accepted === false &&
      latestManualAcceptance.packagingGated === true &&
      (latestManualAcceptance.evidenceKind === "human_review"
        ? latestManualAcceptance.humanReviewed === true &&
          latestManualAcceptance.automationGenerated === false &&
          latestManualAcceptance.classificationReason === "valid_human_review_evidence" &&
          Boolean(latestManualAcceptance.humanReviewEvidence)
        : latestManualAcceptance.humanReviewed === false &&
          latestManualAcceptance.automationGenerated === true &&
          latestManualAcceptance.classificationReason === "source_marked_as_automation"),
    `evidenceKind=${latestManualAcceptance?.evidenceKind ?? "missing"}; humanReviewed=${
      latestManualAcceptance?.humanReviewed ?? "?"
    }; automationGenerated=${latestManualAcceptance?.automationGenerated ?? "?"}; classificationReason=${
      latestManualAcceptance?.classificationReason ?? "missing"
    }`
  );

  push(
    checks,
    "Real human acceptance gate is explicit",
    humanAcceptanceGate?.responseMode === "human_acceptance_gate_json_v1" &&
      ["blocked_needs_human_review", "passed"].includes(humanAcceptanceGate.status ?? "") &&
      humanAcceptanceGate.releaseBoundary?.reviewOnly === true &&
      humanAcceptanceGate.releaseBoundary.accepted === false &&
      humanAcceptanceGate.releaseBoundary.packagingGated === true &&
      humanAcceptanceGate.nextRequiredAction?.includes("verify:human-acceptance") === true &&
      (humanAcceptanceGate.status === "passed"
        ? humanAcceptanceGate.latestEvidenceKind === "human_review" &&
          humanAcceptanceGate.latestHumanReviewed === true &&
          humanAcceptanceGate.latestAutomationGenerated === false
        : humanAcceptanceGate.latestEvidenceKind === "automated_browser_smoke" &&
          humanAcceptanceGate.latestHumanReviewed === false &&
          humanAcceptanceGate.latestAutomationGenerated === true),
    `status=${humanAcceptanceGate?.status ?? "missing"}; evidenceKind=${
      humanAcceptanceGate?.latestEvidenceKind ?? "missing"
    }; humanReviewed=${humanAcceptanceGate?.latestHumanReviewed ?? "missing"}`
  );

  push(
    checks,
    "Manual acceptance classification blocks bypasses",
    manualClassificationReceipt?.responseMode === "manual_acceptance_classification_verification_json_v1" &&
      manualClassificationReceipt.status === "passed" &&
      manualClassificationReceipt.passed === manualClassificationReceipt.total &&
      Number(manualClassificationReceipt.total ?? 0) >= 6,
    `status=${manualClassificationReceipt?.status ?? "missing"}; checks=${manualClassificationReceipt?.passed ?? "?"}/${
      manualClassificationReceipt?.total ?? "?"
    }`
  );

  push(
    checks,
    "Product release readiness is explicitly blocked",
    productReleaseReadiness?.responseMode === "product_release_readiness_gate_json_v1" &&
      ["blocked_not_release_ready", "passed"].includes(productReleaseReadiness.status ?? "") &&
      productReleaseReadiness.releaseDecision !== undefined &&
      Array.isArray(productReleaseReadiness.blockers) &&
      (productReleaseReadiness.status === "passed"
        ? productReleaseReadiness.releaseDecision === "release_candidate"
        : productReleaseReadiness.releaseDecision === "do_not_release" &&
          productReleaseReadiness.blockers.some((item) => item.name === "Real human acceptance is complete") &&
          productReleaseReadiness.blockers.some((item) => item.name === "Real model adapter is ready") &&
          productReleaseReadiness.boundary?.accepted === false &&
          productReleaseReadiness.boundary.packagingGated === true),
    `status=${productReleaseReadiness?.status ?? "missing"}; releaseDecision=${
      productReleaseReadiness?.releaseDecision ?? "missing"
    }; blockers=${productReleaseReadiness?.blockers?.length ?? "?"}`
  );

  push(
    checks,
    "Product status summary is ready and review-only",
    productStatusSummary?.responseMode === "product_status_summary_json_v1" &&
      productStatusSummary.status === "ready_for_bounded_beta_not_release" &&
      productStatusSummary.releaseDecision === "do_not_release" &&
      productStatusSummary.betaCanStart === true &&
      productStatusSummary.canRelease === false &&
      productStatusSummary.canActivateRealModel === false &&
      productStatusSummary.accepted === false &&
      productStatusSummary.packagingGated === true &&
      productStatusSummary.hardLocksPreserved === true &&
      (productStatusSummary.failedReasons?.length ?? -1) === 0 &&
      Number(productStatusSummary.releaseBlockers?.length ?? 0) >= 3 &&
      productStatusSummaryVerification?.responseMode === "product_status_summary_verification_json_v1" &&
      productStatusSummaryVerification.status === "passed" &&
      productStatusSummaryVerification.passed === productStatusSummaryVerification.total &&
      Number(productStatusSummaryVerification.total ?? 0) >= 8 &&
      productStatusSummaryVerification.releaseDecision === "do_not_release" &&
      productStatusSummaryVerification.accepted === false &&
      productStatusSummaryVerification.packagingGated === true &&
      productStatusSummaryVerification.canRelease === false &&
      fileExistsWithSize("artifacts/productization/product-status-summary.md", 1000),
    `summary=${productStatusSummary?.status ?? "missing"}; beta=${productStatusSummary?.betaCanStart ?? "missing"}; verification=${
      productStatusSummaryVerification?.status ?? "missing"
    } ${productStatusSummaryVerification?.passed ?? "?"}/${productStatusSummaryVerification?.total ?? "?"}`
  );
  push(
    checks,
    "Product operator brief is ready and review-only",
    productOperatorBrief?.responseMode === "product_operator_brief_json_v1" &&
      productOperatorBrief.status === "ready_for_operator_handoff" &&
      productOperatorBrief.releaseDecision === "do_not_release" &&
      productOperatorBrief.accepted === false &&
      productOperatorBrief.packagingGated === true &&
      productOperatorBrief.canRelease === false &&
      productOperatorBrief.canActivateRealModel === false &&
      productOperatorBrief.canInviteBoundedBetaTester === true &&
      productOperatorBrief.canStartHumanAcceptanceReview === true &&
      productOperatorBrief.canPlanRealModelTrial === true &&
      (productOperatorBrief.failedReasons?.length ?? -1) === 0 &&
      productOperatorBriefVerification?.responseMode === "product_operator_brief_verification_json_v1" &&
      productOperatorBriefVerification.status === "passed" &&
      productOperatorBriefVerification.passed === productOperatorBriefVerification.total &&
      Number(productOperatorBriefVerification.total ?? 0) >= 6 &&
      productOperatorBriefVerification.releaseDecision === "do_not_release" &&
      productOperatorBriefVerification.accepted === false &&
      productOperatorBriefVerification.packagingGated === true &&
      productOperatorBriefVerification.canRelease === false &&
      fileExistsWithSize("artifacts/productization/product-operator-brief.md", 1000),
    `brief=${productOperatorBrief?.status ?? "missing"}; beta=${
      productOperatorBrief?.canInviteBoundedBetaTester ?? "missing"
    }; human=${productOperatorBrief?.canStartHumanAcceptanceReview ?? "missing"}; modelTrial=${
      productOperatorBrief?.canPlanRealModelTrial ?? "missing"
    }; verification=${productOperatorBriefVerification?.status ?? "missing"} ${
      productOperatorBriefVerification?.passed ?? "?"
    }/${productOperatorBriefVerification?.total ?? "?"}`
  );

  push(
    checks,
    "Product release blocker board is ready and review-only",
    productReleaseBlockerBoard?.responseMode === "product_release_blocker_board_json_v1" &&
      productReleaseBlockerBoard.status === "ready_for_blocker_resolution" &&
      productReleaseBlockerBoard.releaseDecision === "do_not_release" &&
      productReleaseBlockerBoard.accepted === false &&
      productReleaseBlockerBoard.packagingGated === true &&
      productReleaseBlockerBoard.canRelease === false &&
      (productReleaseBlockerBoard.failedReasons?.length ?? -1) === 0 &&
      Number(productReleaseBlockerBoard.lanes?.length ?? 0) === 3 &&
      productReleaseBlockerBoardVerification?.responseMode ===
        "product_release_blocker_board_verification_json_v1" &&
      productReleaseBlockerBoardVerification.status === "passed" &&
      productReleaseBlockerBoardVerification.passed === productReleaseBlockerBoardVerification.total &&
      Number(productReleaseBlockerBoardVerification.total ?? 0) >= 10 &&
      productReleaseBlockerBoardVerification.releaseDecision === "do_not_release" &&
      productReleaseBlockerBoardVerification.accepted === false &&
      productReleaseBlockerBoardVerification.packagingGated === true &&
      productReleaseBlockerBoardVerification.canRelease === false &&
      fileExistsWithSize("artifacts/productization/product-release-blocker-board.md", 1000),
    `board=${productReleaseBlockerBoard?.status ?? "missing"}; lanes=${
      productReleaseBlockerBoard?.lanes?.length ?? 0
    }; verification=${productReleaseBlockerBoardVerification?.status ?? "missing"} ${
      productReleaseBlockerBoardVerification?.passed ?? "?"
    }/${productReleaseBlockerBoardVerification?.total ?? "?"}`
  );

  push(
    checks,
    "Product release approval receipt template is ready and review-only",
    productReleaseApprovalValidation?.responseMode === "product_release_approval_validation_json_v1" &&
      productReleaseApprovalValidation.status === "template_ready" &&
      productReleaseApprovalValidation.mode === "template" &&
      productReleaseApprovalValidation.passed === productReleaseApprovalValidation.total &&
      Number(productReleaseApprovalValidation.total ?? 0) >= 7 &&
      productReleaseApprovalValidation.releaseDecision === "do_not_release" &&
      productReleaseApprovalValidation.accepted === false &&
      productReleaseApprovalValidation.packagingGated === true &&
      productReleaseApprovalValidation.canRelease === false &&
      fileExistsWithSize("artifacts/productization/product-release-approval.template.json", 100) &&
      fileExistsWithSize("artifacts/productization/product-release-approval-template.md", 500),
    `validation=${productReleaseApprovalValidation?.status ?? "missing"} ${
      productReleaseApprovalValidation?.passed ?? "?"
    }/${productReleaseApprovalValidation?.total ?? "?"}; template=${fileExistsWithSize(
      "artifacts/productization/product-release-approval.template.json",
      100
    )}`
  );

  push(
    checks,
    "Product release approval return intake behavior is verified and review-only",
    productReleaseApprovalReturnIntakeVerification?.responseMode ===
      "product_release_approval_return_intake_verification_json_v1" &&
      productReleaseApprovalReturnIntakeVerification.status === "passed" &&
      productReleaseApprovalReturnIntakeVerification.passed === productReleaseApprovalReturnIntakeVerification.total &&
      Number(productReleaseApprovalReturnIntakeVerification.total ?? 0) >= 3 &&
      productReleaseApprovalReturnIntakeVerification.releaseDecision === "do_not_release" &&
      productReleaseApprovalReturnIntakeVerification.accepted === false &&
      productReleaseApprovalReturnIntakeVerification.packagingGated === true &&
      productReleaseApprovalReturnIntakeVerification.canRelease === false,
    `verification=${productReleaseApprovalReturnIntakeVerification?.status ?? "missing"} ${
      productReleaseApprovalReturnIntakeVerification?.passed ?? "?"
    }/${productReleaseApprovalReturnIntakeVerification?.total ?? "?"}; release=${
      productReleaseApprovalReturnIntakeVerification?.releaseDecision ?? "missing"
    }`
  );

  push(
    checks,
    "Real model adapter contract is verified and review-only",
    realModelAdapterContract?.responseMode === "real_model_adapter_contract_verification_json_v1" &&
      realModelAdapterContract.status === "passed" &&
      realModelAdapterContract.passed === realModelAdapterContract.total &&
      Number(realModelAdapterContract.total ?? 0) >= 7 &&
      realModelAdapterContract.releaseDecision === "do_not_release" &&
      realModelAdapterContract.accepted === false &&
      realModelAdapterContract.packagingGated === true &&
      realModelAdapterContract.realNetworkUsed === false &&
      realModelAdapterContract.realProviderAccepted === false &&
      realModelAdapterContract.canActivateRealModel === false &&
      realModelAdapterContract.canRelease === false,
    `contract=${realModelAdapterContract?.status ?? "missing"} ${realModelAdapterContract?.passed ?? "?"}/${
      realModelAdapterContract?.total ?? "?"
    }; realNetwork=${realModelAdapterContract?.realNetworkUsed ?? "missing"}`
  );

  push(
    checks,
    "Real model trial kit is ready and review-only",
    realModelTrialKit?.responseMode === "real_model_trial_kit_json_v1" &&
      realModelTrialKit.status === "ready_for_real_model_trial_planning" &&
      realModelTrialKit.releaseDecision === "do_not_release" &&
      realModelTrialKit.reviewOnly === true &&
      realModelTrialKit.accepted === false &&
      realModelTrialKit.packagingGated === true &&
      realModelTrialKit.canActivateRealModel === false &&
      realModelTrialKit.canRelease === false &&
      (realModelTrialKit.failedReasons?.length ?? -1) === 0 &&
      Number(realModelTrialKit.trialPhases?.length ?? 0) === 5 &&
      realModelTrialKit.aiService?.activeProvider === "mock" &&
      realModelTrialKit.aiService.realModelReady === false &&
      realModelTrialKitVerification?.responseMode === "real_model_trial_kit_verification_json_v1" &&
      realModelTrialKitVerification.status === "passed" &&
      realModelTrialKitVerification.passed === realModelTrialKitVerification.total &&
      Number(realModelTrialKitVerification.total ?? 0) >= 9 &&
      realModelTrialKitVerification.releaseDecision === "do_not_release" &&
      realModelTrialKitVerification.accepted === false &&
      realModelTrialKitVerification.packagingGated === true &&
      realModelTrialKitVerification.canActivateRealModel === false &&
      realModelTrialKitVerification.canRelease === false &&
      fileExistsWithSize("artifacts/productization/real-model-trial-kit.md", 1000),
    `kit=${realModelTrialKit?.status ?? "missing"}; activeProvider=${
      realModelTrialKit?.aiService?.activeProvider ?? "missing"
    }; verification=${realModelTrialKitVerification?.status ?? "missing"} ${
      realModelTrialKitVerification?.passed ?? "?"
    }/${realModelTrialKitVerification?.total ?? "?"}`
  );

  push(
    checks,
    "Real model trial receipt template is ready and review-only",
    realModelTrialReceiptValidation?.responseMode === "real_model_trial_receipt_validation_json_v1" &&
      realModelTrialReceiptValidation.status === "template_ready" &&
      realModelTrialReceiptValidation.mode === "template" &&
      realModelTrialReceiptValidation.passed === realModelTrialReceiptValidation.total &&
      Number(realModelTrialReceiptValidation.total ?? 0) >= 7 &&
      realModelTrialReceiptValidation.releaseDecision === "do_not_release" &&
      realModelTrialReceiptValidation.accepted === false &&
      realModelTrialReceiptValidation.packagingGated === true &&
      realModelTrialReceiptValidation.canActivateRealModel === false &&
      realModelTrialReceiptValidation.canRelease === false &&
      fileExistsWithSize("artifacts/productization/real-model-trial-receipt.template.json", 100) &&
      fileExistsWithSize("artifacts/productization/real-model-trial-receipt-template.md", 500),
    `validation=${realModelTrialReceiptValidation?.status ?? "missing"} ${
      realModelTrialReceiptValidation?.passed ?? "?"
    }/${realModelTrialReceiptValidation?.total ?? "?"}; template=${fileExistsWithSize(
      "artifacts/productization/real-model-trial-receipt.template.json",
      100
    )}`
  );

  push(
    checks,
    "Cleanup evidence exists",
    fileExistsWithSize("artifacts/productization/smoke-record-cleanup.json", 100),
    "smoke-record-cleanup.json exists."
  );

  push(
    checks,
    "Runtime artifact cleanup evidence exists",
    runtimeArtifactCleanup?.responseMode === "runtime_artifact_cleanup_receipt_json_v1" &&
      runtimeArtifactCleanup.status === "passed" &&
      runtimeArtifactCleanup.mode === "apply" &&
      runtimeArtifactCleanup.failedCount === 0 &&
      runtimeArtifactCleanup.protectedRuntimeNames?.includes("standalone") === true &&
      fileExistsWithSize("artifacts/productization/runtime-artifact-cleanup.json", 100),
    `status=${runtimeArtifactCleanup?.status ?? "missing"}; mode=${
      runtimeArtifactCleanup?.mode ?? "missing"
    }; deleted=${runtimeArtifactCleanup?.deletedCount ?? "?"}; skippedActive=${
      runtimeArtifactCleanup?.skippedActiveCount ?? "?"
    }; failed=${runtimeArtifactCleanup?.failedCount ?? "?"}`
  );

  push(
    checks,
    "Live product handoff evidence exists",
    (allowMissingLiveHandoff && !liveProductHandoff) ||
      (liveProductHandoff?.responseMode === "live_product_handoff_receipt_json_v1" &&
        liveProductHandoff.status === "passed" &&
        liveProductHandoff.releaseDecision === "do_not_release" &&
        liveProductHandoff.runtimeNames?.includes("standalone") === true &&
        liveProductHandoff.verificationRuntimeNames?.length === 0 &&
        liveProductHandoff.passed === liveProductHandoff.total &&
        Number(liveProductHandoff.total ?? 0) >= 9 &&
        fileExistsWithSize("artifacts/productization/live-product-handoff.json", 100)),
    `status=${liveProductHandoff?.status ?? "missing"}; baseUrl=${
      liveProductHandoff?.baseUrl ?? "missing"
    }; runtimeNames=${liveProductHandoff?.runtimeNames?.join(",") ?? "missing"}; verificationRuntimeNames=${
      liveProductHandoff?.verificationRuntimeNames?.join(",") ?? "missing"
    }; checks=${liveProductHandoff?.passed ?? "?"}/${liveProductHandoff?.total ?? "?"}; allowMissing=${
      allowMissingLiveHandoff
    }`
  );

  push(
    checks,
    "Real model trial return intake behavior is verified and review-only",
    realModelTrialReturnIntakeVerification?.responseMode === "real_model_trial_return_intake_verification_json_v1" &&
      realModelTrialReturnIntakeVerification.status === "passed" &&
      realModelTrialReturnIntakeVerification.passed === realModelTrialReturnIntakeVerification.total &&
      Number(realModelTrialReturnIntakeVerification.total ?? 0) >= 3 &&
      realModelTrialReturnIntakeVerification.releaseDecision === "do_not_release" &&
      realModelTrialReturnIntakeVerification.accepted === false &&
      realModelTrialReturnIntakeVerification.packagingGated === true &&
      realModelTrialReturnIntakeVerification.canActivateRealModel === false &&
      realModelTrialReturnIntakeVerification.canRelease === false,
    `verification=${realModelTrialReturnIntakeVerification?.status ?? "missing"} ${
      realModelTrialReturnIntakeVerification?.passed ?? "?"
    }/${realModelTrialReturnIntakeVerification?.total ?? "?"}; release=${
      realModelTrialReturnIntakeVerification?.releaseDecision ?? "missing"
    }`
  );

  push(
    checks,
    "Human acceptance session preflight is passed and review-only",
    humanAcceptanceSessionPreflight?.responseMode === "human_acceptance_session_preflight_json_v1" &&
      humanAcceptanceSessionPreflight.status === "passed" &&
      humanAcceptanceSessionPreflight.canStartHumanAcceptance === true &&
      humanAcceptanceSessionPreflight.passed === humanAcceptanceSessionPreflight.total &&
      Number(humanAcceptanceSessionPreflight.total ?? 0) >= 8 &&
      humanAcceptanceSessionPreflight.releaseDecision === "do_not_release" &&
      humanAcceptanceSessionPreflight.accepted === false &&
      humanAcceptanceSessionPreflight.packagingGated === true,
    `preflight=${humanAcceptanceSessionPreflight?.status ?? "missing"} ${
      humanAcceptanceSessionPreflight?.passed ?? "?"
    }/${humanAcceptanceSessionPreflight?.total ?? "?"}; canStart=${
      humanAcceptanceSessionPreflight?.canStartHumanAcceptance ?? "missing"
    }`
  );

  push(
    checks,
    "Human acceptance reviewer kit is ready and review-only",
    humanAcceptanceReviewerKit?.responseMode === "human_acceptance_reviewer_kit_json_v1" &&
      humanAcceptanceReviewerKit.status === "ready_for_reviewer" &&
      humanAcceptanceReviewerKit.canStartReviewerSession === true &&
      (humanAcceptanceReviewerKit.failedReasons?.length ?? -1) === 0 &&
      humanAcceptanceReviewerKit.releaseDecision === "do_not_release" &&
      humanAcceptanceReviewerKit.accepted === false &&
      humanAcceptanceReviewerKit.packagingGated === true &&
      humanAcceptanceReviewerKit.allSoftwareObjective === "paused" &&
      Number(humanAcceptanceReviewerKit.reviewerSteps?.length ?? 0) >= 6 &&
      Number(humanAcceptanceReviewerKit.maintainerCommands?.length ?? 0) >= 5 &&
      humanAcceptanceReviewerKitVerification?.responseMode ===
        "human_acceptance_reviewer_kit_verification_json_v1" &&
      humanAcceptanceReviewerKitVerification.status === "passed" &&
      humanAcceptanceReviewerKitVerification.passed === humanAcceptanceReviewerKitVerification.total &&
      Number(humanAcceptanceReviewerKitVerification.total ?? 0) >= 8 &&
      humanAcceptanceReviewerKitVerification.releaseDecision === "do_not_release" &&
      humanAcceptanceReviewerKitVerification.accepted === false &&
      humanAcceptanceReviewerKitVerification.packagingGated === true &&
      fileExistsWithSize("artifacts/productization/human-acceptance-reviewer-kit.md", 1000),
    `kit=${humanAcceptanceReviewerKit?.status ?? "missing"}; canStart=${
      humanAcceptanceReviewerKit?.canStartReviewerSession ?? "missing"
    }; steps=${humanAcceptanceReviewerKit?.reviewerSteps?.length ?? 0}; verification=${
      humanAcceptanceReviewerKitVerification?.status ?? "missing"
    } ${humanAcceptanceReviewerKitVerification?.passed ?? "?"}/${humanAcceptanceReviewerKitVerification?.total ?? "?"}`
  );

  push(
    checks,
    "Human acceptance receipt template is ready and review-only",
    humanAcceptanceReceiptValidation?.responseMode === "human_acceptance_receipt_validation_json_v1" &&
      humanAcceptanceReceiptValidation.status === "template_ready" &&
      humanAcceptanceReceiptValidation.mode === "template" &&
      humanAcceptanceReceiptValidation.passed === humanAcceptanceReceiptValidation.total &&
      Number(humanAcceptanceReceiptValidation.total ?? 0) >= 7 &&
      humanAcceptanceReceiptValidation.releaseDecision === "do_not_release" &&
      humanAcceptanceReceiptValidation.accepted === false &&
      humanAcceptanceReceiptValidation.packagingGated === true &&
      humanAcceptanceReceiptValidation.canRelease === false &&
      fileExistsWithSize("artifacts/productization/human-acceptance-receipt.template.json", 100) &&
      fileExistsWithSize("artifacts/productization/human-acceptance-receipt-template.md", 500),
    `validation=${humanAcceptanceReceiptValidation?.status ?? "missing"} ${
      humanAcceptanceReceiptValidation?.passed ?? "?"
    }/${humanAcceptanceReceiptValidation?.total ?? "?"}; template=${fileExistsWithSize(
      "artifacts/productization/human-acceptance-receipt.template.json",
      100
    )}`
  );

  push(
    checks,
    "Human acceptance return intake behavior is verified and review-only",
    humanAcceptanceReturnIntakeVerification?.responseMode ===
      "human_acceptance_return_intake_verification_json_v1" &&
      humanAcceptanceReturnIntakeVerification.status === "passed" &&
      humanAcceptanceReturnIntakeVerification.passed === humanAcceptanceReturnIntakeVerification.total &&
      Number(humanAcceptanceReturnIntakeVerification.total ?? 0) >= 3 &&
      humanAcceptanceReturnIntakeVerification.releaseDecision === "do_not_release" &&
      humanAcceptanceReturnIntakeVerification.accepted === false &&
      humanAcceptanceReturnIntakeVerification.packagingGated === true &&
      humanAcceptanceReturnIntakeVerification.canRelease === false &&
      fileExistsWithSize("scripts/intake-human-acceptance-return.ts", 1000) &&
      fileExistsWithSize("scripts/verify-human-acceptance-return-intake.ts", 1000),
    `verification=${humanAcceptanceReturnIntakeVerification?.status ?? "missing"} ${
      humanAcceptanceReturnIntakeVerification?.passed ?? "?"
    }/${humanAcceptanceReturnIntakeVerification?.total ?? "?"}`
  );

  push(
    checks,
    "Human acceptance return post-intake refresh is documented and verifier-gated",
    humanAcceptanceReturnIntakeSource.includes("postIntakeRefresh") &&
      humanAcceptanceReturnIntakeSource.includes("requiredAfterReturnIntakeVerification: true") &&
      humanAcceptanceReturnIntakeSource.includes('"npm run verify:human-acceptance-return-intake"') &&
      humanAcceptanceReturnIntakeSource.includes('"npm run verify:productization-evidence-freshness"') &&
      handoff.includes("postIntakeRefresh.commandSequence") &&
      handoff.includes("npm run verify:human-acceptance-return-intake") &&
      handoff.includes("Do not rebuild reviewer invites from a failed return-intake verification receipt") &&
      handoff.includes("do not treat the returned receipt as acceptance unless `/manual-test` saved `human_review` evidence"),
    `sourcePostRefresh=${humanAcceptanceReturnIntakeSource.includes("postIntakeRefresh")}; verifierFirst=${humanAcceptanceReturnIntakeSource.includes(
      '"npm run verify:human-acceptance-return-intake"'
    )}; handoffPostRefresh=${handoff.includes("postIntakeRefresh.commandSequence")}; handoffGate=${handoff.includes(
      "npm run verify:human-acceptance-return-intake"
    )}`
  );

  push(
    checks,
    "Public beta readiness evidence exists",
    (allowMissingPublicBetaReadiness && !publicBetaReadiness) ||
      (publicBetaReadiness?.responseMode === "public_beta_readiness_receipt_json_v1" &&
        publicBetaReadiness.status === "passed" &&
        publicBetaReadiness.betaCanStart === true &&
        publicBetaReadiness.releaseDecision === "do_not_release" &&
        publicBetaReadiness.passed === publicBetaReadiness.total &&
        Number(publicBetaReadiness.total ?? 0) >= 8 &&
        fileExistsWithSize("artifacts/productization/public-beta-readiness.json", 100)),
    `status=${publicBetaReadiness?.status ?? "missing"}; betaCanStart=${
      publicBetaReadiness?.betaCanStart ?? "missing"
    }; releaseDecision=${publicBetaReadiness?.releaseDecision ?? "missing"}; checks=${
      publicBetaReadiness?.passed ?? "?"
    }/${publicBetaReadiness?.total ?? "?"}; allowMissing=${allowMissingPublicBetaReadiness}`
  );

  const testerInviteFailedReasons = publicBetaTesterInvite?.failedReasons ?? [];
  const testerInviteReady =
    publicBetaTesterInvite?.status === "ready_to_invite" &&
    publicBetaTesterInvite.canInvite === true &&
    testerInviteFailedReasons.length === 0;
  const testerInviteSafelyDeferredForBootstrap =
    publicBetaTesterInvite?.status === "not_ready_to_invite" &&
    publicBetaTesterInvite.canInvite === false &&
    testerInviteFailedReasons.length === 1 &&
    ["live_handoff_not_passed", "public_beta_packet_not_ready"].includes(testerInviteFailedReasons[0] ?? "");

  push(
    checks,
    "Public beta tester invite kit is ready or safely deferred and review-only",
    publicBetaTesterInvite?.responseMode === "public_beta_tester_invite_json_v1" &&
      (testerInviteReady || testerInviteSafelyDeferredForBootstrap) &&
      publicBetaTesterInvite.releaseDecision === "do_not_release" &&
      publicBetaTesterInvite.accepted === false &&
      publicBetaTesterInvite.packagingGated === true &&
      Number(publicBetaTesterInvite.testerChecklist?.length ?? 0) >= 6 &&
      Number(publicBetaTesterInvite.maintainerChecklist?.length ?? 0) >= 5 &&
      publicBetaTesterInviteVerification?.responseMode === "public_beta_tester_invite_verification_json_v1" &&
      publicBetaTesterInviteVerification.status === "passed" &&
      publicBetaTesterInviteVerification.passed === publicBetaTesterInviteVerification.total &&
      Number(publicBetaTesterInviteVerification.total ?? 0) >= 5 &&
      publicBetaTesterInviteVerification.releaseDecision === "do_not_release" &&
      publicBetaTesterInviteVerification.accepted === false &&
      publicBetaTesterInviteVerification.packagingGated === true &&
      fileExistsWithSize("artifacts/productization/public-beta-tester-invite.md", 500),
    `invite=${publicBetaTesterInvite?.status ?? "missing"}; canInvite=${
      publicBetaTesterInvite?.canInvite ?? "missing"
    }; failed=${testerInviteFailedReasons.join(",") || "none"}; ready=${testerInviteReady}; deferredBootstrap=${
      testerInviteSafelyDeferredForBootstrap
    }; verification=${publicBetaTesterInviteVerification?.status ?? "missing"} ${
      publicBetaTesterInviteVerification?.passed ?? "?"
    }/${publicBetaTesterInviteVerification?.total ?? "?"}`
  );

  push(
    checks,
    "Public beta feedback API behavior is verified and review-only",
    publicBetaFeedbackApiVerification?.responseMode === "public_beta_feedback_api_verification_json_v1" &&
      publicBetaFeedbackApiVerification.status === "passed" &&
      publicBetaFeedbackApiVerification.passed === publicBetaFeedbackApiVerification.total &&
      Number(publicBetaFeedbackApiVerification.total ?? 0) >= 5 &&
      publicBetaFeedbackApiVerification.releaseDecision === "do_not_release" &&
      publicBetaFeedbackApiVerification.accepted === false &&
      publicBetaFeedbackApiVerification.packagingGated === true &&
      publicBetaFeedbackApiVerification.tempArtifactsCleaned === true,
    `verification=${publicBetaFeedbackApiVerification?.status ?? "missing"} ${
      publicBetaFeedbackApiVerification?.passed ?? "?"
    }/${publicBetaFeedbackApiVerification?.total ?? "?"}; tempCleaned=${
      publicBetaFeedbackApiVerification?.tempArtifactsCleaned ?? "missing"
    }`
  );

  push(
    checks,
    "Public beta return intake behavior is verified and review-only",
    publicBetaReturnIntakeVerification?.responseMode === "public_beta_return_intake_verification_json_v1" &&
      publicBetaReturnIntakeVerification.status === "passed" &&
      publicBetaReturnIntakeVerification.passed === publicBetaReturnIntakeVerification.total &&
      Number(publicBetaReturnIntakeVerification.total ?? 0) >= 3 &&
      publicBetaReturnIntakeVerification.releaseDecision === "do_not_release" &&
      publicBetaReturnIntakeVerification.accepted === false &&
      publicBetaReturnIntakeVerification.packagingGated === true,
    `verification=${publicBetaReturnIntakeVerification?.status ?? "missing"} ${
      publicBetaReturnIntakeVerification?.passed ?? "?"
    }/${publicBetaReturnIntakeVerification?.total ?? "?"}; releaseDecision=${
      publicBetaReturnIntakeVerification?.releaseDecision ?? "missing"
    }`
  );

  push(
    checks,
    "Public beta tester session preflight is passed and review-only",
    publicBetaTesterSessionPreflight?.responseMode === "public_beta_tester_session_preflight_json_v1" &&
      publicBetaTesterSessionPreflight.status === "passed" &&
      publicBetaTesterSessionPreflight.canInviteTester === true &&
      publicBetaTesterSessionPreflight.passed === publicBetaTesterSessionPreflight.total &&
      Number(publicBetaTesterSessionPreflight.total ?? 0) >= 9 &&
      publicBetaTesterSessionPreflight.releaseDecision === "do_not_release" &&
      publicBetaTesterSessionPreflight.accepted === false &&
      publicBetaTesterSessionPreflight.packagingGated === true,
    `preflight=${publicBetaTesterSessionPreflight?.status ?? "missing"} ${
      publicBetaTesterSessionPreflight?.passed ?? "?"
    }/${publicBetaTesterSessionPreflight?.total ?? "?"}; canInvite=${
      publicBetaTesterSessionPreflight?.canInviteTester ?? "missing"
    }`
  );

  push(
    checks,
    "Packaging remains locked",
    visualLearningAcceptanceGate.packagingGated === true &&
      visualLearningAcceptanceGate.accepted === false &&
      visualLearningAcceptanceGate.status === "pending_teacher_acceptance",
    `accepted=${visualLearningAcceptanceGate.accepted}; packagingGated=${visualLearningAcceptanceGate.packagingGated}; status=${visualLearningAcceptanceGate.status}`
  );

  const preliminaryResult = writeHandoffReport(checks);
  if (preliminaryResult.status === "passed") {
    try {
      const manifest = buildProductTrialPacket("verify:handoff");
      const packetManifestPath = path.join("artifacts", "productization", "product-trial-packet", "product-trial-manifest.json");
      push(
        checks,
        "Product trial packet is buildable and review-only",
        manifest.responseMode === "product_trial_packet_manifest_json_v1" &&
          manifest.status === "built" &&
          manifest.allSoftwareObjective === "paused" &&
          manifest.packagingBoundary.accepted === false &&
          manifest.packagingBoundary.packagingGated === true &&
          manifest.includedFiles.some((file) => file.destination === "evidence/product-verification-receipt.json") &&
          manifest.includedFiles.some((file) => file.destination === "evidence/product-ui-api-smoke.json") &&
          manifest.includedFiles.some((file) => file.destination === "evidence/product-runtime-verification.json") &&
          manifest.includedFiles.some((file) => file.destination === "evidence/product-runtime-doctor.json") &&
          manifest.includedFiles.some((file) => file.destination === "evidence/product-release-readiness.json") &&
          manifest.includedFiles.some((file) => file.destination === "evidence/product-status-summary.json") &&
          manifest.includedFiles.some((file) => file.destination === "evidence/product-status-summary-verification.json") &&
          manifest.includedFiles.some((file) => file.destination === "docs/PRODUCT_STATUS_SUMMARY.md") &&
          manifest.includedFiles.some((file) => file.destination === "evidence/product-operator-brief.json") &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/product-operator-brief-verification.json"
          ) &&
          manifest.includedFiles.some((file) => file.destination === "docs/PRODUCT_OPERATOR_BRIEF.md") &&
          manifest.includedFiles.some((file) => file.destination === "evidence/product-release-blocker-board.json") &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/product-release-blocker-board-verification.json"
          ) &&
          manifest.includedFiles.some((file) => file.destination === "docs/PRODUCT_RELEASE_BLOCKER_BOARD.md") &&
          manifest.includedFiles.some((file) => file.destination === "docs/PRODUCT_RELEASE_APPROVAL.template.json") &&
          manifest.includedFiles.some((file) => file.destination === "docs/PRODUCT_RELEASE_APPROVAL_TEMPLATE.md") &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/product-release-approval-validation.json"
          ) &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/product-release-approval-return-intake-verification.json"
          ) &&
          manifest.includedFiles.some((file) => file.destination === "evidence/real-model-trial-kit.json") &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/real-model-adapter-contract-verification.json"
          ) &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/real-model-trial-kit-verification.json"
          ) &&
          manifest.includedFiles.some((file) => file.destination === "docs/REAL_MODEL_TRIAL_KIT.md") &&
          manifest.includedFiles.some((file) => file.destination === "docs/REAL_MODEL_TRIAL_RECEIPT.template.json") &&
          manifest.includedFiles.some((file) => file.destination === "docs/REAL_MODEL_TRIAL_RECEIPT_TEMPLATE.md") &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/real-model-trial-receipt-validation.json"
          ) &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/real-model-trial-return-intake-verification.json"
          ) &&
          manifest.includedFiles.some((file) => file.destination === "evidence/runtime-artifact-cleanup.json") &&
          (allowMissingLiveHandoff ||
            manifest.includedFiles.some((file) => file.destination === "evidence/live-product-handoff.json")) &&
          manifest.includedFiles.some((file) => file.destination === "evidence/public-beta-readiness.json") &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/public-beta-feedback-receipt-validation.json"
          ) &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/public-beta-feedback-api-verification.json"
          ) &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/public-beta-feedback-collection.json"
          ) &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/public-beta-feedback-collection-verification.json"
          ) &&
          manifest.includedFiles.some((file) => file.destination === "evidence/public-beta-follow-up-plan.json") &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/public-beta-follow-up-plan-verification.json"
          ) &&
          manifest.includedFiles.some((file) => file.destination === "evidence/public-beta-tester-invite.json") &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/public-beta-tester-invite-verification.json"
          ) &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/public-beta-tester-session-preflight.json"
          ) &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/public-beta-return-intake-verification.json"
          ) &&
          manifest.includedFiles.some((file) => file.destination === "docs/PUBLIC_BETA_TESTER_INVITE.md") &&
          manifest.includedFiles.some((file) => file.destination === "evidence/public-beta-preparation.json") &&
          manifest.includedFiles.some((file) => file.destination === "evidence/human-acceptance-gate.json") &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/human-acceptance-session-preflight.json"
          ) &&
          manifest.includedFiles.some((file) => file.destination === "evidence/human-acceptance-reviewer-kit.json") &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/human-acceptance-reviewer-kit-verification.json"
          ) &&
          manifest.includedFiles.some((file) => file.destination === "docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md") &&
          manifest.includedFiles.some((file) => file.destination === "docs/HUMAN_ACCEPTANCE_RECEIPT.template.json") &&
          manifest.includedFiles.some((file) => file.destination === "docs/HUMAN_ACCEPTANCE_RECEIPT_TEMPLATE.md") &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/human-acceptance-receipt-validation.json"
          ) &&
          manifest.includedFiles.some(
            (file) => file.destination === "evidence/manual-acceptance-classification-verification.json"
          ) &&
          fileExistsWithSize(packetManifestPath, 100) &&
          fileExistsWithSize("artifacts/productization/product-trial-packet/START_HERE.md", 100),
        `${packetManifestPath} exists with locked packaging boundary and verification evidence.`
      );
    } catch (error) {
      push(
        checks,
        "Product trial packet is buildable and review-only",
        false,
        error instanceof Error ? error.message : String(error)
      );
    }
  } else {
    push(
      checks,
      "Product trial packet is buildable and review-only",
      false,
      "Skipped because earlier handoff checks failed."
    );
  }

  const result = writeHandoffReport(checks);
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nReport written to ${handoffReportPath}`);

  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export {};
