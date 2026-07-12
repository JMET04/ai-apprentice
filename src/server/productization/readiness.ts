import fs from "node:fs";
import path from "node:path";
import { visualLearningAcceptanceGate } from "@/lib/teacher-acceptance";
import { getAIServiceRuntimeStatus } from "@/server/ai/service";
import { memoryStore } from "@/server/memory/memory-store";
import {
  manualAcceptanceLatestReportName,
  readLatestManualAcceptanceEnvelope
} from "@/server/productization/manual-acceptance";

export const stableProductTaskId = "task-photo-travel-journal";
export const productArtifactsDir = process.env.PRODUCT_ARTIFACTS_DIR ?? path.join(process.cwd(), "artifacts", "productization");
export const handoffReportPath = path.join(productArtifactsDir, "product-handoff-readiness.json");
export const productVerificationReceiptName = "product-verification-receipt.json";
export const productVerificationReceiptPath = path.join(productArtifactsDir, productVerificationReceiptName);
export const productUiApiSmokeReceiptName = "product-ui-api-smoke.json";
export const productUiApiSmokeReceiptPath = path.join(productArtifactsDir, productUiApiSmokeReceiptName);
export const productRuntimeVerificationReceiptName = "product-runtime-verification.json";
export const productRuntimeVerificationReceiptPath = path.join(productArtifactsDir, productRuntimeVerificationReceiptName);
export const productRuntimeDoctorReceiptName = "product-runtime-doctor.json";
export const productRuntimeDoctorReceiptPath = path.join(productArtifactsDir, productRuntimeDoctorReceiptName);
export const runtimeArtifactCleanupReceiptName = "runtime-artifact-cleanup.json";
export const runtimeArtifactCleanupReceiptPath = path.join(productArtifactsDir, runtimeArtifactCleanupReceiptName);
export const liveProductHandoffReceiptName = "live-product-handoff.json";
export const liveProductHandoffReceiptPath = path.join(productArtifactsDir, liveProductHandoffReceiptName);
export const productReleaseReadinessReceiptName = "product-release-readiness.json";
export const productReleaseReadinessReceiptPath = path.join(productArtifactsDir, productReleaseReadinessReceiptName);
export const productOperatorBriefReceiptName = "product-operator-brief.json";
export const productOperatorBriefReceiptPath = path.join(productArtifactsDir, productOperatorBriefReceiptName);
export const productOperatorBriefVerificationReceiptName = "product-operator-brief-verification.json";
export const productOperatorBriefVerificationReceiptPath = path.join(
  productArtifactsDir,
  productOperatorBriefVerificationReceiptName
);
export const productReleaseBlockerBoardReceiptName = "product-release-blocker-board.json";
export const productReleaseBlockerBoardReceiptPath = path.join(productArtifactsDir, productReleaseBlockerBoardReceiptName);
export const productReleaseBlockerBoardVerificationReceiptName = "product-release-blocker-board-verification.json";
export const productReleaseBlockerBoardVerificationReceiptPath = path.join(
  productArtifactsDir,
  productReleaseBlockerBoardVerificationReceiptName
);
export const productReleaseApprovalValidationReceiptName = "product-release-approval-validation.json";
export const productReleaseApprovalValidationReceiptPath = path.join(
  productArtifactsDir,
  productReleaseApprovalValidationReceiptName
);
export const realModelAdapterContractVerificationReceiptName = "real-model-adapter-contract-verification.json";
export const realModelAdapterContractVerificationReceiptPath = path.join(
  productArtifactsDir,
  realModelAdapterContractVerificationReceiptName
);
export const realModelTrialKitReceiptName = "real-model-trial-kit.json";
export const realModelTrialKitReceiptPath = path.join(productArtifactsDir, realModelTrialKitReceiptName);
export const realModelTrialKitVerificationReceiptName = "real-model-trial-kit-verification.json";
export const realModelTrialKitVerificationReceiptPath = path.join(
  productArtifactsDir,
  realModelTrialKitVerificationReceiptName
);
export const realModelTrialReceiptValidationReceiptName = "real-model-trial-receipt-validation.json";
export const realModelTrialReceiptValidationReceiptPath = path.join(
  productArtifactsDir,
  realModelTrialReceiptValidationReceiptName
);
export const humanAcceptanceGateReceiptName = "human-acceptance-gate.json";
export const humanAcceptanceGateReceiptPath = path.join(productArtifactsDir, humanAcceptanceGateReceiptName);
export const humanAcceptanceSessionPreflightReceiptName = "human-acceptance-session-preflight.json";
export const humanAcceptanceSessionPreflightReceiptPath = path.join(
  productArtifactsDir,
  humanAcceptanceSessionPreflightReceiptName
);
export const humanAcceptanceReviewerKitReceiptName = "human-acceptance-reviewer-kit.json";
export const humanAcceptanceReviewerKitReceiptPath = path.join(productArtifactsDir, humanAcceptanceReviewerKitReceiptName);
export const humanAcceptanceReviewerKitVerificationReceiptName = "human-acceptance-reviewer-kit-verification.json";
export const humanAcceptanceReviewerKitVerificationReceiptPath = path.join(
  productArtifactsDir,
  humanAcceptanceReviewerKitVerificationReceiptName
);
export const humanAcceptanceReceiptValidationReceiptName = "human-acceptance-receipt-validation.json";
export const humanAcceptanceReceiptValidationReceiptPath = path.join(
  productArtifactsDir,
  humanAcceptanceReceiptValidationReceiptName
);
export const productTrialPacketManifestName = "product-trial-packet/product-trial-manifest.json";
export const productTrialPacketManifestPath = path.join(productArtifactsDir, productTrialPacketManifestName);
export const publicBetaPacketManifestName = "public-beta-packet/public-beta-manifest.json";
export const publicBetaPacketManifestPath = path.join(productArtifactsDir, publicBetaPacketManifestName);
export const publicBetaReadinessReceiptName = "public-beta-readiness.json";
export const publicBetaReadinessReceiptPath = path.join(productArtifactsDir, publicBetaReadinessReceiptName);
export const publicBetaFeedbackValidationReceiptName = "public-beta-feedback-receipt-validation.json";
export const publicBetaFeedbackValidationReceiptPath = path.join(
  productArtifactsDir,
  publicBetaFeedbackValidationReceiptName
);
export const publicBetaFeedbackApiVerificationReceiptName = "public-beta-feedback-api-verification.json";
export const publicBetaFeedbackApiVerificationReceiptPath = path.join(
  productArtifactsDir,
  publicBetaFeedbackApiVerificationReceiptName
);
export const publicBetaFeedbackCollectionReceiptName = "public-beta-feedback-collection.json";
export const publicBetaFeedbackCollectionReceiptPath = path.join(
  productArtifactsDir,
  publicBetaFeedbackCollectionReceiptName
);
export const publicBetaFeedbackCollectionVerificationReceiptName =
  "public-beta-feedback-collection-verification.json";
export const publicBetaFeedbackCollectionVerificationReceiptPath = path.join(
  productArtifactsDir,
  publicBetaFeedbackCollectionVerificationReceiptName
);
export const publicBetaFollowUpPlanReceiptName = "public-beta-follow-up-plan.json";
export const publicBetaFollowUpPlanReceiptPath = path.join(productArtifactsDir, publicBetaFollowUpPlanReceiptName);
export const publicBetaFollowUpPlanVerificationReceiptName = "public-beta-follow-up-plan-verification.json";
export const publicBetaFollowUpPlanVerificationReceiptPath = path.join(
  productArtifactsDir,
  publicBetaFollowUpPlanVerificationReceiptName
);
export const publicBetaTesterInviteReceiptName = "public-beta-tester-invite.json";
export const publicBetaTesterInviteReceiptPath = path.join(productArtifactsDir, publicBetaTesterInviteReceiptName);
export const publicBetaTesterInviteVerificationReceiptName = "public-beta-tester-invite-verification.json";
export const publicBetaTesterInviteVerificationReceiptPath = path.join(
  productArtifactsDir,
  publicBetaTesterInviteVerificationReceiptName
);
export const publicBetaReturnIntakeVerificationReceiptName = "public-beta-return-intake-verification.json";
export const publicBetaReturnIntakeVerificationReceiptPath = path.join(
  productArtifactsDir,
  publicBetaReturnIntakeVerificationReceiptName
);
export const publicBetaTesterSessionPreflightReceiptName = "public-beta-tester-session-preflight.json";
export const publicBetaTesterSessionPreflightReceiptPath = path.join(
  productArtifactsDir,
  publicBetaTesterSessionPreflightReceiptName
);
export const publicBetaPreparationReceiptName = "public-beta-preparation.json";
export const publicBetaPreparationReceiptPath = path.join(productArtifactsDir, publicBetaPreparationReceiptName);

export type HandoffReport = {
  status: string;
  generatedAt?: string;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
};

type ProductVerificationReceipt = {
  responseMode?: string;
  status?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  baseUrl?: string;
  steps?: Array<{ label: string; status: string; durationMs?: number }>;
};

type ProductUiApiSmokeReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  baseUrl?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
};

type ProductRuntimeVerificationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  baseUrl?: string;
  command?: string;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
};

type ProductRuntimeDoctorReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  baseUrl?: string;
  command?: string;
  releaseDecision?: string;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
};

type RuntimeArtifactCleanupReceipt = {
  responseMode?: string;
  status?: string;
  mode?: string;
  generatedAt?: string;
  command?: string;
  deletedCount?: number;
  skippedActiveCount?: number;
  failedCount?: number;
  reclaimedBytes?: number;
  protectedRuntimeNames?: string[];
};

type LiveProductHandoffReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  baseUrl?: string;
  releaseDecision?: string;
  runtimeNames?: string[];
  verificationRuntimeNames?: string[];
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
};

type ProductReleaseReadinessReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  releaseDecision?: string;
  passed?: number;
  total?: number;
  requiredPassed?: number;
  requiredTotal?: number;
  blockers?: Array<{ name: string; evidence: string; nextAction?: string }>;
};

type ProductOperatorBriefReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  canInviteBoundedBetaTester?: boolean;
  canStartHumanAcceptanceReview?: boolean;
  canPlanRealModelTrial?: boolean;
  canActivateRealModel?: boolean;
  failedReasons?: string[];
  immediateActions?: Array<{
    id?: string;
    title?: string;
    allowed?: boolean;
    command?: string;
    evidencePath?: string;
    stopCondition?: string;
  }>;
  blockedActions?: Array<{ id?: string; title?: string; blocked?: boolean; reason?: string }>;
  nextAction?: string;
};

type ProductOperatorBriefVerificationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type ProductReleaseBlockerBoardReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  failedReasons?: string[];
  lanes?: Array<{ id?: string; title?: string; status?: string; currentEvidence?: string }>;
  nextAction?: string;
};

type ProductReleaseBlockerBoardVerificationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type ProductReleaseApprovalValidationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  inputPath?: string;
  mode?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type RealModelAdapterContractVerificationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  realNetworkUsed?: boolean;
  realProviderAccepted?: boolean;
  canActivateRealModel?: boolean;
  canRelease?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type RealModelTrialKitReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canActivateRealModel?: boolean;
  canRelease?: boolean;
  failedReasons?: string[];
  aiService?: {
    activeProvider?: string;
    requestedProvider?: string;
    status?: string;
    realModelReady?: boolean;
  };
  trialPhases?: Array<{ id?: string; title?: string; reviewerAction?: string }>;
  maintainerCommands?: string[];
  nextAction?: string;
};

type RealModelTrialKitVerificationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canActivateRealModel?: boolean;
  canRelease?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type RealModelTrialReceiptValidationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  inputPath?: string;
  mode?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canActivateRealModel?: boolean;
  canRelease?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type HumanAcceptanceGateReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  allowPending?: boolean;
  latestEvidenceKind?: string;
  latestHumanReviewed?: boolean;
  latestAutomationGenerated?: boolean;
  passed?: number;
  total?: number;
  nextRequiredAction?: string;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
};

type HumanAcceptanceSessionPreflightReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  baseUrl?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canStartHumanAcceptance?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string; nextAction?: string }>;
  nextAction?: string;
};

type HumanAcceptanceReviewerKitReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  productScope?: string;
  stableTaskId?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canStartReviewerSession?: boolean;
  failedReasons?: string[];
  reviewerSteps?: Array<{ id?: string; instruction?: string }>;
  maintainerCommands?: string[];
  sourceEvidence?: Record<string, unknown>;
  nextAction?: string;
};

type HumanAcceptanceReviewerKitVerificationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type HumanAcceptanceReceiptValidationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  inputPath?: string;
  mode?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canRelease?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type ProductTrialPacketManifest = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  packetDir?: string;
  includedFiles?: Array<{ destination: string; bytes: number; required: boolean }>;
  packagingBoundary?: { accepted?: boolean; packagingGated?: boolean; status?: string };
};

type PublicBetaPacketManifest = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  packetDir?: string;
  betaCanStart?: boolean;
  requiredPassed?: number;
  requiredTotal?: number;
  releaseDecision?: string;
  includedFiles?: Array<{ destination: string; bytes: number; required: boolean }>;
  packagingBoundary?: { accepted?: boolean; packagingGated?: boolean; status?: string };
};

type PublicBetaReadinessReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  betaCanStart?: boolean;
  releaseDecision?: string;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
};

type PublicBetaFeedbackValidationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  inputPath?: string;
  mode?: string;
  betaDecision?: string;
  betaCanContinue?: boolean;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
};

type PublicBetaFeedbackApiVerificationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  tempArtifactsDir?: string;
  tempArtifactsCleaned?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type PublicBetaFeedbackCollectionReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  inboxDir?: string;
  totalReceipts?: number;
  validReceipts?: number;
  invalidReceipts?: number;
  decisionCounts?: Record<string, number>;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  nextAction?: string;
};

type PublicBetaFeedbackCollectionVerificationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type PublicBetaFollowUpPlanReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  sourceCollectionPath?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canInviteNextTester?: boolean;
  counts?: Record<string, number>;
  actions?: Array<{ id?: string; lane?: string; title?: string; command?: string }>;
  nextAction?: string;
};

type PublicBetaFollowUpPlanVerificationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type PublicBetaTesterInviteReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canInvite?: boolean;
  failedReasons?: string[];
  maintainerChecklist?: string[];
  testerChecklist?: string[];
  testerEntryPoints?: Record<string, string>;
  nextAction?: string;
};

type PublicBetaTesterInviteVerificationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type PublicBetaReturnIntakeVerificationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type PublicBetaTesterSessionPreflightReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  baseUrl?: string;
  productScope?: string;
  allSoftwareObjective?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  canInviteTester?: boolean;
  passed?: number;
  total?: number;
  checks?: Array<{ name: string; pass: boolean; evidence: string }>;
  nextAction?: string;
};

type PublicBetaPreparationReceipt = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  baseUrl?: string;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  passed?: number;
  total?: number;
  steps?: Array<{ label: string; command: string; status: string; exitCode: number | null; durationMs: number }>;
  nextAction?: string;
};

export const optionalProductArtifactNames = new Set([
  "human-acceptance-return-intake.json"
]);

const productArtifactNames = [
  "product-handoff-readiness.json",
  productUiApiSmokeReceiptName,
  "manual-acceptance-browser-smoke.json",
  "manual-acceptance-browser.png",
  "manual-acceptance-browser-desktop.png",
  "manual-acceptance-browser-mobile.png",
  "manual-acceptance-report.browser-smoke.json",
  "dashboard-product-entry.png",
  "dashboard-demo-metrics.png",
  "manual-acceptance-demo-metrics.png",
  "smoke-record-cleanup.json",
  runtimeArtifactCleanupReceiptName,
  productRuntimeVerificationReceiptName,
  productRuntimeDoctorReceiptName,
  productReleaseReadinessReceiptName,
  productOperatorBriefReceiptName,
  productOperatorBriefVerificationReceiptName,
  productReleaseBlockerBoardReceiptName,
  productReleaseBlockerBoardVerificationReceiptName,
  productReleaseApprovalValidationReceiptName,
  realModelAdapterContractVerificationReceiptName,
  realModelTrialKitReceiptName,
  realModelTrialKitVerificationReceiptName,
  realModelTrialReceiptValidationReceiptName,
  humanAcceptanceGateReceiptName,
  humanAcceptanceSessionPreflightReceiptName,
  humanAcceptanceReviewerKitReceiptName,
  humanAcceptanceReviewerKitVerificationReceiptName,
  humanAcceptanceReceiptValidationReceiptName,
  "human-acceptance-return-intake.json",
  "human-acceptance-return-intake-verification.json",
  productTrialPacketManifestName,
  publicBetaPacketManifestName,
  publicBetaReadinessReceiptName,
  publicBetaFeedbackValidationReceiptName,
  publicBetaFeedbackApiVerificationReceiptName,
  publicBetaFeedbackCollectionReceiptName,
  publicBetaFeedbackCollectionVerificationReceiptName,
  publicBetaFollowUpPlanReceiptName,
  publicBetaFollowUpPlanVerificationReceiptName,
  publicBetaTesterInviteReceiptName,
  publicBetaTesterInviteVerificationReceiptName,
  publicBetaReturnIntakeVerificationReceiptName,
  publicBetaTesterSessionPreflightReceiptName,
  publicBetaPreparationReceiptName
];

export const productReadinessCommands = [
  {
    label: "Prepare public beta",
    command: "npm run prepare:public-beta -- --base-url http://127.0.0.1:3000",
    detail:
      "Runs the ordered beta-preparation chain: feedback verification, feedback collection, handoff, live handoff, beta packet build, and beta readiness sync; writes public-beta-preparation.json."
  },
  {
    label: "Run full product verification",
    command: "npm run verify:product",
    detail:
      "Runs typecheck, production build, product smoke, manual-acceptance browser smoke, core loop smoke, and handoff gate."
  },
  {
    label: "Verify handoff materials",
    command: "npm run verify:handoff",
    detail: "Checks README, PRODUCT_HANDOFF, stable demo data, evidence files, cleanup receipts, and packaging locks."
  },
  {
    label: "Build product trial packet",
    command: "npm run package:product-trial",
    detail:
      "Collects docs, verification receipts, browser evidence, and locked review-only boundaries under artifacts/productization/product-trial-packet/."
  },
  {
    label: "Build public beta packet",
    command: "npm run package:public-beta",
    detail:
      "Builds a bounded tester packet only when product, live handoff, runtime cleanup, release-blocked, and classification evidence are green."
  },
  {
    label: "Verify public beta packet",
    command: "npm run verify:public-beta",
    detail:
      "Checks the public beta packet manifest, required evidence, feedback template, live handoff, and locked release boundary; writes public-beta-readiness.json."
  },
  {
    label: "Build product operator brief",
    command: "npm run build:product-operator-brief",
    detail:
      "Builds a concise next-step handoff for beta invitation, human acceptance, and real-model trial planning while release and packaging stay locked."
  },
  {
    label: "Verify product operator brief",
    command: "npm run verify:product-operator-brief",
    detail:
      "Checks the operator brief exposes allowed next actions, blocks release-only transitions, and preserves do_not_release boundaries."
  },
  {
    label: "Verify real model adapter contract",
    command: "npm run verify:real-model-adapter-contract",
    detail:
      "Runs a fake-fetch OpenAI-compatible adapter contract check without real network, real secrets, model acceptance, release approval, or packaging unlock."
  },
  {
    label: "Build real model trial kit",
    command: "npm run build:real-model-trial-kit",
    detail:
      "Builds a review-only trial guide for configuring and accepting a real AI provider without activating it, saving acceptance, or unlocking release."
  },
  {
    label: "Verify real model trial kit",
    command: "npm run verify:real-model-trial-kit",
    detail:
      "Checks the real-model trial guide, provider controls, returned evidence list, and locked do_not_release boundary."
  },
  {
    label: "Build real model trial receipt template",
    command: "npm run build:real-model-trial-receipt-template",
    detail:
      "Builds the structured reviewer receipt template for returning real-provider trial evidence without accepting release."
  },
  {
    label: "Verify real model trial receipt",
    command: "npm run verify:real-model-trial-receipt",
    detail:
      "Checks the generated template, or a filled receipt with -- --receipt <path>, while preserving release and packaging locks."
  },
  {
    label: "Verify public beta feedback receipt",
    command: "npm run verify:public-beta-feedback",
    detail:
      "Checks the generated beta feedback receipt template, or a filled tester receipt with -- --receipt <path>, without accepting release or packaging."
  },
  {
    label: "Verify public beta feedback API",
    command: "npm run verify:public-beta-feedback-api",
    detail:
      "Checks dry-run validation, valid browser-submitted saves, invalid receipt rejection, and blocked-feedback safeguards in a temporary artifacts directory."
  },
  {
    label: "Collect public beta feedback",
    command: "npm run collect:public-beta-feedback",
    detail:
      "Scans artifacts/productization/public-beta-feedback-inbox/ and writes a review-only follow-up queue in public-beta-feedback-collection.json."
  },
  {
    label: "Verify public beta feedback collection",
    command: "npm run verify:public-beta-feedback-collection",
    detail:
      "Checks empty, ready, needs-fix, blocked, and invalid beta feedback collection behavior without changing the real inbox."
  },
  {
    label: "Plan public beta follow-up",
    command: "npm run plan:public-beta-follow-up",
    detail: "Turns the current feedback collection into tester-intake, fix-planning, blocker-review, and release-lock actions."
  },
  {
    label: "Verify public beta follow-up plan",
    command: "npm run verify:public-beta-follow-up-plan",
    detail:
      "Checks that feedback follow-up planning blocks invalid, blocked, and needs-fix feedback while preserving release locks."
  },
  {
    label: "Build public beta tester invite",
    command: "npm run build:public-beta-tester-invite",
    detail:
      "Builds a review-only tester invite Markdown and JSON decision from current beta readiness, follow-up, live handoff, and release-lock evidence."
  },
  {
    label: "Verify public beta tester invite",
    command: "npm run verify:public-beta-tester-invite",
    detail: "Checks that the invite kit is actionable for one bounded beta tester without claiming acceptance or release readiness."
  },
  {
    label: "Preflight public beta tester session",
    command: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
    detail:
      "Checks the live URL, tester entry pages, invite readiness, feedback-return path, and release lock immediately before contacting one beta tester."
  },
  {
    label: "Intake public beta return",
    command:
      "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
    detail:
      "Validates a returned tester receipt against the bound first-send receipt, copies only valid feedback into the inbox, refreshes collection, and refreshes the follow-up plan."
  },
  {
    label: "Verify public beta return intake",
    command: "npm run verify:public-beta-return-intake",
    detail:
      "Checks that ready, needs-fix, and invalid returned receipts are processed without acceptance, packaging, release, or all-software scope changes."
  },
  {
    label: "Start local product runtime",
    command: "npm run start:product -- --hostname 127.0.0.1 --port 3000",
    detail:
      "Starts the built app with the standalone server when available and pins the demo SQLite database unless DATABASE_URL is set."
  },
  {
    label: "Verify local product runtime",
    command: "npm run verify:product-runtime",
    detail:
      "Builds, starts the public product runtime command, checks health/readiness/AI provider, and writes product-runtime-verification.json."
  },
  {
    label: "Run local product doctor",
    command: "npm run doctor:product -- --base-url http://127.0.0.1:3000",
    detail:
      "Checks a running product server for health, trial readiness, release go/no-go, and AI provider boundary; writes product-runtime-doctor.json."
  },
  {
    label: "Verify live product handoff",
    command: "npm run verify:live-handoff -- --base-url http://127.0.0.1:3000",
    detail:
      "Checks the currently running handoff server, runtime artifact cleanup, release lock, and trial packet evidence; writes live-product-handoff.json."
  },
  {
    label: "Verify product release readiness",
    command: "npm run verify:product-release-readiness",
    detail:
      "Fails until human acceptance, real model readiness, and release/packaging approval are complete; writes product-release-readiness.json."
  },
  {
    label: "Build product release blocker board",
    command: "npm run build:product-release-blocker-board",
    detail:
      "Turns the current release blockers into maintainer lanes with evidence paths, commands, continue conditions, stop conditions, and locked release boundaries."
  },
  {
    label: "Verify product release blocker board",
    command: "npm run verify:product-release-blocker-board",
    detail:
      "Checks the blocker board covers human acceptance, real-model acceptance, and packaging approval without claiming release readiness."
  },
  {
    label: "Build product release approval receipt template",
    command: "npm run build:product-release-approval-template",
    detail:
      "Builds the structured release-review return template without saving acceptance, unlocking packaging, or changing release readiness."
  },
  {
    label: "Verify product release approval receipt",
    command: "npm run verify:product-release-approval",
    detail:
      "Verifies the generated release approval template, or validates a filled copy with -- --receipt <path>, while keeping release locked."
  },
  {
    label: "Read latest release go/no-go",
    command: "GET /api/product-release-readiness",
    detail: "Returns the latest release readiness receipt separately from trial readiness, including releaseDecision and blockers."
  },
  {
    label: "Verify real human acceptance",
    command: "npm run verify:human-acceptance",
    detail: "Fails until /manual-test has saved real evidenceKind=human_review evidence; writes human-acceptance-gate.json."
  },
  {
    label: "Preflight real human acceptance session",
    command: "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000",
    detail:
      "Checks /manual-test, the manual acceptance save API, current human gate, release lock, and AI boundary before asking a reviewer to save human_review evidence."
  },
  {
    label: "Build human acceptance reviewer kit",
    command: "npm run build:human-acceptance-reviewer-kit",
    detail:
      "Builds Markdown and JSON instructions for one real reviewer from current preflight, human gate, product smoke, beta readiness, and release-lock evidence."
  },
  {
    label: "Verify human acceptance reviewer kit",
    command: "npm run verify:human-acceptance-reviewer-kit",
    detail:
      "Checks the reviewer kit is actionable, backed by current evidence, and still cannot claim acceptance, release, packaging, real-model approval, or all-software scope."
  },
  {
    label: "Build human acceptance receipt template",
    command: "npm run build:human-acceptance-receipt-template",
    detail:
      "Builds the structured reviewer return template for real human acceptance evidence without saving acceptance or unlocking release."
  },
  {
    label: "Verify human acceptance receipt",
    command: "npm run verify:human-acceptance-receipt",
    detail:
      "Verifies the generated template, or validates a filled copy with -- --receipt <path>, while keeping release and packaging locked."
  },
  {
    label: "Clean historical smoke records",
    command: "npm run cleanup:smoke-records -- --apply",
    detail: "Deletes only automation-generated smoke data so it is not mistaken for the product acceptance object."
  },
  {
    label: "Clean verification runtime artifacts",
    command: "npm run cleanup:runtime-artifacts -- --apply",
    detail:
      "Deletes inactive product verification runtime copies while preserving the active standalone product runtime; writes runtime-artifact-cleanup.json."
  }
];

export const productReadinessRoutes = [
  {
    label: "Public beta session",
    href: "/public-beta",
    purpose: "Give one bounded tester a clear entrypoint for running, correcting, reviewing, and returning beta evidence."
  },
  {
    label: "Product handoff status",
    href: "/handoff",
    purpose: "View current scope, verification commands, evidence files, and release boundary."
  },
  {
    label: "Manual acceptance form",
    href: "/manual-test",
    purpose: "Record pass, blocker, notes, and exported evidence step by step."
  },
  {
    label: "Run core demo",
    href: `/tasks/${stableProductTaskId}/run`,
    purpose: "Execute the photography journal task and inspect structured output, trace, and correction entry points."
  },
  {
    label: "Review task evidence",
    href: `/tasks/${stableProductTaskId}/review`,
    purpose: "Inspect learning evidence, rule sources, acceptance boundaries, and complete evidence entry points."
  }
];

export function readHandoffReport(): HandoffReport | null {
  try {
    return JSON.parse(fs.readFileSync(handoffReportPath, "utf8")) as HandoffReport;
  } catch {
    return null;
  }
}

export function readProductVerificationReceipt(): ProductVerificationReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(productVerificationReceiptPath, "utf8")) as ProductVerificationReceipt;
  } catch {
    return null;
  }
}

export function readProductUiApiSmokeReceipt(): ProductUiApiSmokeReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(productUiApiSmokeReceiptPath, "utf8")) as ProductUiApiSmokeReceipt;
  } catch {
    return null;
  }
}

export function readProductRuntimeVerificationReceipt(): ProductRuntimeVerificationReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(productRuntimeVerificationReceiptPath, "utf8")) as ProductRuntimeVerificationReceipt;
  } catch {
    return null;
  }
}

export function readProductRuntimeDoctorReceipt(): ProductRuntimeDoctorReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(productRuntimeDoctorReceiptPath, "utf8")) as ProductRuntimeDoctorReceipt;
  } catch {
    return null;
  }
}

export function readRuntimeArtifactCleanupReceipt(): RuntimeArtifactCleanupReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(runtimeArtifactCleanupReceiptPath, "utf8")) as RuntimeArtifactCleanupReceipt;
  } catch {
    return null;
  }
}

export function readLiveProductHandoffReceipt(): LiveProductHandoffReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(liveProductHandoffReceiptPath, "utf8")) as LiveProductHandoffReceipt;
  } catch {
    return null;
  }
}

export function readProductReleaseReadinessReceipt(): ProductReleaseReadinessReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(productReleaseReadinessReceiptPath, "utf8")) as ProductReleaseReadinessReceipt;
  } catch {
    return null;
  }
}

export function readProductOperatorBriefReceipt(): ProductOperatorBriefReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(productOperatorBriefReceiptPath, "utf8")) as ProductOperatorBriefReceipt;
  } catch {
    return null;
  }
}

export function readProductOperatorBriefVerificationReceipt(): ProductOperatorBriefVerificationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(productOperatorBriefVerificationReceiptPath, "utf8")
    ) as ProductOperatorBriefVerificationReceipt;
  } catch {
    return null;
  }
}

export function readProductReleaseBlockerBoardReceipt(): ProductReleaseBlockerBoardReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(productReleaseBlockerBoardReceiptPath, "utf8")) as ProductReleaseBlockerBoardReceipt;
  } catch {
    return null;
  }
}

export function readProductReleaseBlockerBoardVerificationReceipt(): ProductReleaseBlockerBoardVerificationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(productReleaseBlockerBoardVerificationReceiptPath, "utf8")
    ) as ProductReleaseBlockerBoardVerificationReceipt;
  } catch {
    return null;
  }
}

export function readProductReleaseApprovalValidationReceipt(): ProductReleaseApprovalValidationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(productReleaseApprovalValidationReceiptPath, "utf8")
    ) as ProductReleaseApprovalValidationReceipt;
  } catch {
    return null;
  }
}

export function readRealModelAdapterContractVerificationReceipt(): RealModelAdapterContractVerificationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(realModelAdapterContractVerificationReceiptPath, "utf8")
    ) as RealModelAdapterContractVerificationReceipt;
  } catch {
    return null;
  }
}

export function readRealModelTrialKitReceipt(): RealModelTrialKitReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(realModelTrialKitReceiptPath, "utf8")) as RealModelTrialKitReceipt;
  } catch {
    return null;
  }
}

export function readRealModelTrialKitVerificationReceipt(): RealModelTrialKitVerificationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(realModelTrialKitVerificationReceiptPath, "utf8")
    ) as RealModelTrialKitVerificationReceipt;
  } catch {
    return null;
  }
}

export function readRealModelTrialReceiptValidationReceipt(): RealModelTrialReceiptValidationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(realModelTrialReceiptValidationReceiptPath, "utf8")
    ) as RealModelTrialReceiptValidationReceipt;
  } catch {
    return null;
  }
}

export function readHumanAcceptanceGateReceipt(): HumanAcceptanceGateReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(humanAcceptanceGateReceiptPath, "utf8")) as HumanAcceptanceGateReceipt;
  } catch {
    return null;
  }
}

export function readHumanAcceptanceSessionPreflightReceipt(): HumanAcceptanceSessionPreflightReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(humanAcceptanceSessionPreflightReceiptPath, "utf8")
    ) as HumanAcceptanceSessionPreflightReceipt;
  } catch {
    return null;
  }
}

export function readHumanAcceptanceReviewerKitReceipt(): HumanAcceptanceReviewerKitReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(humanAcceptanceReviewerKitReceiptPath, "utf8")) as HumanAcceptanceReviewerKitReceipt;
  } catch {
    return null;
  }
}

export function readHumanAcceptanceReviewerKitVerificationReceipt(): HumanAcceptanceReviewerKitVerificationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(humanAcceptanceReviewerKitVerificationReceiptPath, "utf8")
    ) as HumanAcceptanceReviewerKitVerificationReceipt;
  } catch {
    return null;
  }
}

export function readHumanAcceptanceReceiptValidationReceipt(): HumanAcceptanceReceiptValidationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(humanAcceptanceReceiptValidationReceiptPath, "utf8")
    ) as HumanAcceptanceReceiptValidationReceipt;
  } catch {
    return null;
  }
}

export function readProductTrialPacketManifest(): ProductTrialPacketManifest | null {
  try {
    return JSON.parse(fs.readFileSync(productTrialPacketManifestPath, "utf8")) as ProductTrialPacketManifest;
  } catch {
    return null;
  }
}

export function readPublicBetaPacketManifest(): PublicBetaPacketManifest | null {
  try {
    return JSON.parse(fs.readFileSync(publicBetaPacketManifestPath, "utf8")) as PublicBetaPacketManifest;
  } catch {
    return null;
  }
}

export function readPublicBetaReadinessReceipt(): PublicBetaReadinessReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(publicBetaReadinessReceiptPath, "utf8")) as PublicBetaReadinessReceipt;
  } catch {
    return null;
  }
}

export function readPublicBetaFeedbackValidationReceipt(): PublicBetaFeedbackValidationReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(publicBetaFeedbackValidationReceiptPath, "utf8")) as PublicBetaFeedbackValidationReceipt;
  } catch {
    return null;
  }
}

export function readPublicBetaFeedbackApiVerificationReceipt(): PublicBetaFeedbackApiVerificationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(publicBetaFeedbackApiVerificationReceiptPath, "utf8")
    ) as PublicBetaFeedbackApiVerificationReceipt;
  } catch {
    return null;
  }
}

export function readPublicBetaFeedbackCollectionReceipt(): PublicBetaFeedbackCollectionReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(publicBetaFeedbackCollectionReceiptPath, "utf8")) as PublicBetaFeedbackCollectionReceipt;
  } catch {
    return null;
  }
}

export function readPublicBetaFeedbackCollectionVerificationReceipt(): PublicBetaFeedbackCollectionVerificationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(publicBetaFeedbackCollectionVerificationReceiptPath, "utf8")
    ) as PublicBetaFeedbackCollectionVerificationReceipt;
  } catch {
    return null;
  }
}

export function readPublicBetaFollowUpPlanReceipt(): PublicBetaFollowUpPlanReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(publicBetaFollowUpPlanReceiptPath, "utf8")) as PublicBetaFollowUpPlanReceipt;
  } catch {
    return null;
  }
}

export function readPublicBetaFollowUpPlanVerificationReceipt(): PublicBetaFollowUpPlanVerificationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(publicBetaFollowUpPlanVerificationReceiptPath, "utf8")
    ) as PublicBetaFollowUpPlanVerificationReceipt;
  } catch {
    return null;
  }
}

export function readPublicBetaTesterInviteReceipt(): PublicBetaTesterInviteReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(publicBetaTesterInviteReceiptPath, "utf8")) as PublicBetaTesterInviteReceipt;
  } catch {
    return null;
  }
}

export function readPublicBetaTesterInviteVerificationReceipt(): PublicBetaTesterInviteVerificationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(publicBetaTesterInviteVerificationReceiptPath, "utf8")
    ) as PublicBetaTesterInviteVerificationReceipt;
  } catch {
    return null;
  }
}

export function readPublicBetaReturnIntakeVerificationReceipt(): PublicBetaReturnIntakeVerificationReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(publicBetaReturnIntakeVerificationReceiptPath, "utf8")
    ) as PublicBetaReturnIntakeVerificationReceipt;
  } catch {
    return null;
  }
}

export function readPublicBetaTesterSessionPreflightReceipt(): PublicBetaTesterSessionPreflightReceipt | null {
  try {
    return JSON.parse(
      fs.readFileSync(publicBetaTesterSessionPreflightReceiptPath, "utf8")
    ) as PublicBetaTesterSessionPreflightReceipt;
  } catch {
    return null;
  }
}

export function readPublicBetaPreparationReceipt(): PublicBetaPreparationReceipt | null {
  try {
    return JSON.parse(fs.readFileSync(publicBetaPreparationReceiptPath, "utf8")) as PublicBetaPreparationReceipt;
  } catch {
    return null;
  }
}

function artifactStatus(name: string) {
  const fullPath = path.join(productArtifactsDir, name);
  const exists = fs.existsSync(fullPath);
  return {
    name,
    path: path.join("artifacts", "productization", name),
    exists,
    bytes: exists ? fs.statSync(fullPath).size : 0
  };
}

export async function buildProductReadiness() {
  const [stableTask, stableStats] = await Promise.all([
    memoryStore.getTaskProfile(stableProductTaskId).catch(() => null),
    memoryStore.getTaskReadinessStats(stableProductTaskId)
  ]);
  const handoffReport = readHandoffReport();
  const productVerification = readProductVerificationReceipt();
  const productUiApiSmoke = readProductUiApiSmokeReceipt();
  const productRuntimeVerification = readProductRuntimeVerificationReceipt();
  const productRuntimeDoctor = readProductRuntimeDoctorReceipt();
  const runtimeArtifactCleanup = readRuntimeArtifactCleanupReceipt();
  const liveProductHandoff = readLiveProductHandoffReceipt();
  const productReleaseReadiness = readProductReleaseReadinessReceipt();
  const productOperatorBrief = readProductOperatorBriefReceipt();
  const productOperatorBriefVerification = readProductOperatorBriefVerificationReceipt();
  const productReleaseBlockerBoard = readProductReleaseBlockerBoardReceipt();
  const productReleaseBlockerBoardVerification = readProductReleaseBlockerBoardVerificationReceipt();
  const productReleaseApprovalValidation = readProductReleaseApprovalValidationReceipt();
  const realModelAdapterContractVerification = readRealModelAdapterContractVerificationReceipt();
  const realModelTrialKit = readRealModelTrialKitReceipt();
  const realModelTrialKitVerification = readRealModelTrialKitVerificationReceipt();
  const realModelTrialReceiptValidation = readRealModelTrialReceiptValidationReceipt();
  const humanAcceptanceGate = readHumanAcceptanceGateReceipt();
  const humanAcceptanceSessionPreflight = readHumanAcceptanceSessionPreflightReceipt();
  const humanAcceptanceReviewerKit = readHumanAcceptanceReviewerKitReceipt();
  const humanAcceptanceReviewerKitVerification = readHumanAcceptanceReviewerKitVerificationReceipt();
  const humanAcceptanceReceiptValidation = readHumanAcceptanceReceiptValidationReceipt();
  const productTrialPacket = readProductTrialPacketManifest();
  const publicBetaPacket = readPublicBetaPacketManifest();
  const publicBetaReadiness = readPublicBetaReadinessReceipt();
  const publicBetaFeedbackValidation = readPublicBetaFeedbackValidationReceipt();
  const publicBetaFeedbackApiVerification = readPublicBetaFeedbackApiVerificationReceipt();
  const publicBetaFeedbackCollection = readPublicBetaFeedbackCollectionReceipt();
  const publicBetaFeedbackCollectionVerification = readPublicBetaFeedbackCollectionVerificationReceipt();
  const publicBetaFollowUpPlan = readPublicBetaFollowUpPlanReceipt();
  const publicBetaFollowUpPlanVerification = readPublicBetaFollowUpPlanVerificationReceipt();
  const publicBetaTesterInvite = readPublicBetaTesterInviteReceipt();
  const publicBetaTesterInviteVerification = readPublicBetaTesterInviteVerificationReceipt();
  const publicBetaReturnIntakeVerification = readPublicBetaReturnIntakeVerificationReceipt();
  const publicBetaTesterSessionPreflight = readPublicBetaTesterSessionPreflightReceipt();
  const publicBetaPreparation = readPublicBetaPreparationReceipt();
  const latestManualAcceptance = readLatestManualAcceptanceEnvelope();
  const artifacts = [...productArtifactNames, manualAcceptanceLatestReportName, productVerificationReceiptName].map(artifactStatus);
  const missingArtifacts = artifacts
    .filter(
      (artifact) =>
        productArtifactNames.includes(artifact.name) &&
        !optionalProductArtifactNames.has(artifact.name) &&
        !artifact.exists
    )
    .map((artifact) => artifact.name);
  const pendingOptionalArtifacts = artifacts
    .filter((artifact) => optionalProductArtifactNames.has(artifact.name) && !artifact.exists)
    .map((artifact) => artifact.name);
  const handoffPassed = handoffReport?.status === "passed";
  const stableDemoPresent = Boolean(stableTask && stableStats);
  const aiService = getAIServiceRuntimeStatus();
  const packagingLocked =
    visualLearningAcceptanceGate.accepted === false &&
    visualLearningAcceptanceGate.packagingGated === true &&
    visualLearningAcceptanceGate.status === "pending_teacher_acceptance";

  const status =
    handoffPassed && stableDemoPresent && missingArtifacts.length === 0 && packagingLocked
      ? "ready_for_human_acceptance"
      : "needs_productization_work";

  return {
    responseMode: "product_readiness_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    currentScope: {
      id: "bounded_core_teaching_loop",
      summary:
        "The bounded core teaching loop covers the stable photography journal task: teach, run, correct, review reusable rule drafts, and capture human acceptance evidence.",
      allSoftwareObjective: "paused",
      allSoftwareReason:
        "Unattended all-software learning and general native software control are outside the current product acceptance scope."
    },
    stableAcceptanceObject: stableTask
      ? {
          id: stableTask.id,
          name: stableTask.name,
          goal: stableTask.goal,
          status: stableTask.status
        }
      : {
          id: stableProductTaskId,
          name: null,
          goal: null,
          status: "missing"
        },
    stableDemoStats: stableStats ?? { apprentices: 0, workflows: 0, rules: 0, corrections: 0, runs: 0 },
    handoffGate: {
      reportPath: path.join("artifacts", "productization", "product-handoff-readiness.json"),
      status: handoffReport?.status ?? "not_run_yet",
      generatedAt: handoffReport?.generatedAt ?? null,
      passed: handoffReport?.passed ?? 0,
      total: handoffReport?.total ?? 0,
      checks: handoffReport?.checks ?? []
    },
    productVerification: {
      reportPath: path.join("artifacts", "productization", productVerificationReceiptName),
      status: productVerification?.status ?? "not_run_yet",
      startedAt: productVerification?.startedAt ?? null,
      finishedAt: productVerification?.finishedAt ?? null,
      durationMs: productVerification?.durationMs ?? null,
      stepCount: productVerification?.steps?.length ?? 0,
      passedSteps: productVerification?.steps?.filter((step) => step.status === "passed").length ?? 0
    },
    productUiApiSmoke: {
      reportPath: path.join("artifacts", "productization", productUiApiSmokeReceiptName),
      status: productUiApiSmoke?.status ?? "not_run_yet",
      generatedAt: productUiApiSmoke?.generatedAt ?? null,
      command: productUiApiSmoke?.command ?? "npm run smoke:product",
      baseUrl: productUiApiSmoke?.baseUrl ?? null,
      releaseDecision: productUiApiSmoke?.releaseDecision ?? "do_not_release",
      reviewOnly: productUiApiSmoke?.reviewOnly ?? true,
      accepted: productUiApiSmoke?.accepted ?? false,
      packagingGated: productUiApiSmoke?.packagingGated ?? true,
      passed: productUiApiSmoke?.passed ?? 0,
      total: productUiApiSmoke?.total ?? 0,
      checks: productUiApiSmoke?.checks ?? []
    },
    productRuntimeVerification: {
      reportPath: path.join("artifacts", "productization", productRuntimeVerificationReceiptName),
      status: productRuntimeVerification?.status ?? "not_run_yet",
      generatedAt: productRuntimeVerification?.generatedAt ?? null,
      baseUrl: productRuntimeVerification?.baseUrl ?? null,
      command: productRuntimeVerification?.command ?? "npm run verify:product-runtime",
      passed: productRuntimeVerification?.passed ?? 0,
      total: productRuntimeVerification?.total ?? 0,
      checks: productRuntimeVerification?.checks ?? []
    },
    productRuntimeDoctor: {
      reportPath: path.join("artifacts", "productization", productRuntimeDoctorReceiptName),
      status: productRuntimeDoctor?.status ?? "not_run_yet",
      generatedAt: productRuntimeDoctor?.generatedAt ?? null,
      baseUrl: productRuntimeDoctor?.baseUrl ?? null,
      command: productRuntimeDoctor?.command ?? "npm run doctor:product",
      releaseDecision: productRuntimeDoctor?.releaseDecision ?? "unknown",
      passed: productRuntimeDoctor?.passed ?? 0,
      total: productRuntimeDoctor?.total ?? 0,
      checks: productRuntimeDoctor?.checks ?? []
    },
    runtimeArtifactCleanup: {
      reportPath: path.join("artifacts", "productization", runtimeArtifactCleanupReceiptName),
      status: runtimeArtifactCleanup?.status ?? "not_run_yet",
      mode: runtimeArtifactCleanup?.mode ?? null,
      generatedAt: runtimeArtifactCleanup?.generatedAt ?? null,
      command: runtimeArtifactCleanup?.command ?? "npm run cleanup:runtime-artifacts",
      deletedCount: runtimeArtifactCleanup?.deletedCount ?? 0,
      skippedActiveCount: runtimeArtifactCleanup?.skippedActiveCount ?? 0,
      failedCount: runtimeArtifactCleanup?.failedCount ?? 0,
      reclaimedBytes: runtimeArtifactCleanup?.reclaimedBytes ?? 0,
      protectedRuntimeNames: runtimeArtifactCleanup?.protectedRuntimeNames ?? ["standalone"]
    },
    liveProductHandoff: {
      reportPath: path.join("artifacts", "productization", liveProductHandoffReceiptName),
      status: liveProductHandoff?.status ?? "not_run_yet",
      generatedAt: liveProductHandoff?.generatedAt ?? null,
      command: liveProductHandoff?.command ?? "npm run verify:live-handoff",
      baseUrl: liveProductHandoff?.baseUrl ?? null,
      releaseDecision: liveProductHandoff?.releaseDecision ?? "unknown",
      runtimeNames: liveProductHandoff?.runtimeNames ?? [],
      verificationRuntimeNames: liveProductHandoff?.verificationRuntimeNames ?? [],
      passed: liveProductHandoff?.passed ?? 0,
      total: liveProductHandoff?.total ?? 0,
      checks: liveProductHandoff?.checks ?? []
    },
    productReleaseReadiness: {
      reportPath: path.join("artifacts", "productization", productReleaseReadinessReceiptName),
      status: productReleaseReadiness?.status ?? "not_run_yet",
      generatedAt: productReleaseReadiness?.generatedAt ?? null,
      releaseDecision: productReleaseReadiness?.releaseDecision ?? "do_not_release",
      passed: productReleaseReadiness?.passed ?? 0,
      total: productReleaseReadiness?.total ?? 0,
      requiredPassed: productReleaseReadiness?.requiredPassed ?? 0,
      requiredTotal: productReleaseReadiness?.requiredTotal ?? 0,
      blockers: productReleaseReadiness?.blockers ?? []
    },
    productOperatorBrief: {
      reportPath: path.join("artifacts", "productization", productOperatorBriefReceiptName),
      markdownPath: path.join("artifacts", "productization", "product-operator-brief.md"),
      status: productOperatorBrief?.status ?? "not_built_yet",
      generatedAt: productOperatorBrief?.generatedAt ?? null,
      command: productOperatorBrief?.command ?? "npm run build:product-operator-brief",
      productScope: productOperatorBrief?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: productOperatorBrief?.allSoftwareObjective ?? "paused",
      releaseDecision: productOperatorBrief?.releaseDecision ?? "do_not_release",
      reviewOnly: productOperatorBrief?.reviewOnly ?? true,
      accepted: productOperatorBrief?.accepted ?? false,
      packagingGated: productOperatorBrief?.packagingGated ?? true,
      canRelease: productOperatorBrief?.canRelease ?? false,
      canInviteBoundedBetaTester: productOperatorBrief?.canInviteBoundedBetaTester ?? false,
      canStartHumanAcceptanceReview: productOperatorBrief?.canStartHumanAcceptanceReview ?? false,
      canPlanRealModelTrial: productOperatorBrief?.canPlanRealModelTrial ?? false,
      canActivateRealModel: productOperatorBrief?.canActivateRealModel ?? false,
      failedReasons: productOperatorBrief?.failedReasons ?? [],
      immediateActions: productOperatorBrief?.immediateActions ?? [],
      blockedActions: productOperatorBrief?.blockedActions ?? [],
      nextAction:
        productOperatorBrief?.nextAction ??
        "Run npm run build:product-operator-brief and npm run verify:product-operator-brief after refreshing beta preparation evidence."
    },
    productOperatorBriefVerification: {
      reportPath: path.join("artifacts", "productization", productOperatorBriefVerificationReceiptName),
      status: productOperatorBriefVerification?.status ?? "not_run_yet",
      generatedAt: productOperatorBriefVerification?.generatedAt ?? null,
      command: productOperatorBriefVerification?.command ?? "npm run verify:product-operator-brief",
      productScope: productOperatorBriefVerification?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: productOperatorBriefVerification?.allSoftwareObjective ?? "paused",
      releaseDecision: productOperatorBriefVerification?.releaseDecision ?? "do_not_release",
      reviewOnly: productOperatorBriefVerification?.reviewOnly ?? true,
      accepted: productOperatorBriefVerification?.accepted ?? false,
      packagingGated: productOperatorBriefVerification?.packagingGated ?? true,
      canRelease: productOperatorBriefVerification?.canRelease ?? false,
      passed: productOperatorBriefVerification?.passed ?? 0,
      total: productOperatorBriefVerification?.total ?? 0,
      checks: productOperatorBriefVerification?.checks ?? [],
      nextAction:
        productOperatorBriefVerification?.nextAction ??
        "Run npm run verify:product-operator-brief before using the operator brief for handoff."
    },
    productReleaseBlockerBoard: {
      reportPath: path.join("artifacts", "productization", productReleaseBlockerBoardReceiptName),
      markdownPath: path.join("artifacts", "productization", "product-release-blocker-board.md"),
      status: productReleaseBlockerBoard?.status ?? "not_built_yet",
      generatedAt: productReleaseBlockerBoard?.generatedAt ?? null,
      command: productReleaseBlockerBoard?.command ?? "npm run build:product-release-blocker-board",
      productScope: productReleaseBlockerBoard?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: productReleaseBlockerBoard?.allSoftwareObjective ?? "paused",
      releaseDecision: productReleaseBlockerBoard?.releaseDecision ?? "do_not_release",
      reviewOnly: productReleaseBlockerBoard?.reviewOnly ?? true,
      accepted: productReleaseBlockerBoard?.accepted ?? false,
      packagingGated: productReleaseBlockerBoard?.packagingGated ?? true,
      canRelease: productReleaseBlockerBoard?.canRelease ?? false,
      failedReasons: productReleaseBlockerBoard?.failedReasons ?? [],
      laneCount: productReleaseBlockerBoard?.lanes?.length ?? 0,
      lanes: productReleaseBlockerBoard?.lanes ?? [],
      nextAction:
        productReleaseBlockerBoard?.nextAction ??
        "Run npm run build:product-release-blocker-board after refreshing product release readiness."
    },
    productReleaseBlockerBoardVerification: {
      reportPath: path.join("artifacts", "productization", productReleaseBlockerBoardVerificationReceiptName),
      status: productReleaseBlockerBoardVerification?.status ?? "not_run_yet",
      generatedAt: productReleaseBlockerBoardVerification?.generatedAt ?? null,
      command: productReleaseBlockerBoardVerification?.command ?? "npm run verify:product-release-blocker-board",
      productScope: productReleaseBlockerBoardVerification?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: productReleaseBlockerBoardVerification?.allSoftwareObjective ?? "paused",
      releaseDecision: productReleaseBlockerBoardVerification?.releaseDecision ?? "do_not_release",
      reviewOnly: productReleaseBlockerBoardVerification?.reviewOnly ?? true,
      accepted: productReleaseBlockerBoardVerification?.accepted ?? false,
      packagingGated: productReleaseBlockerBoardVerification?.packagingGated ?? true,
      canRelease: productReleaseBlockerBoardVerification?.canRelease ?? false,
      passed: productReleaseBlockerBoardVerification?.passed ?? 0,
      total: productReleaseBlockerBoardVerification?.total ?? 0,
      checks: productReleaseBlockerBoardVerification?.checks ?? [],
      nextAction:
        productReleaseBlockerBoardVerification?.nextAction ??
        "Run npm run verify:product-release-blocker-board before using the release blocker board."
    },
    productReleaseApprovalValidation: {
      reportPath: path.join("artifacts", "productization", productReleaseApprovalValidationReceiptName),
      templatePath: path.join("artifacts", "productization", "product-release-approval.template.json"),
      markdownPath: path.join("artifacts", "productization", "product-release-approval-template.md"),
      status: productReleaseApprovalValidation?.status ?? "not_run_yet",
      generatedAt: productReleaseApprovalValidation?.generatedAt ?? null,
      command: productReleaseApprovalValidation?.command ?? "npm run verify:product-release-approval",
      inputPath:
        productReleaseApprovalValidation?.inputPath ??
        path.join("artifacts", "productization", "product-release-approval.template.json"),
      mode: productReleaseApprovalValidation?.mode ?? "template",
      productScope: productReleaseApprovalValidation?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: productReleaseApprovalValidation?.allSoftwareObjective ?? "paused",
      releaseDecision: productReleaseApprovalValidation?.releaseDecision ?? "do_not_release",
      reviewOnly: productReleaseApprovalValidation?.reviewOnly ?? true,
      accepted: productReleaseApprovalValidation?.accepted ?? false,
      packagingGated: productReleaseApprovalValidation?.packagingGated ?? true,
      canRelease: productReleaseApprovalValidation?.canRelease ?? false,
      passed: productReleaseApprovalValidation?.passed ?? 0,
      total: productReleaseApprovalValidation?.total ?? 0,
      checks: productReleaseApprovalValidation?.checks ?? [],
      nextAction:
        productReleaseApprovalValidation?.nextAction ??
        "Run npm run build:product-release-approval-template and npm run verify:product-release-approval before release follow-up planning."
    },
    realModelAdapterContractVerification: {
      reportPath: path.join("artifacts", "productization", realModelAdapterContractVerificationReceiptName),
      status: realModelAdapterContractVerification?.status ?? "not_run_yet",
      generatedAt: realModelAdapterContractVerification?.generatedAt ?? null,
      command: realModelAdapterContractVerification?.command ?? "npm run verify:real-model-adapter-contract",
      productScope: realModelAdapterContractVerification?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: realModelAdapterContractVerification?.allSoftwareObjective ?? "paused",
      releaseDecision: realModelAdapterContractVerification?.releaseDecision ?? "do_not_release",
      reviewOnly: realModelAdapterContractVerification?.reviewOnly ?? true,
      accepted: realModelAdapterContractVerification?.accepted ?? false,
      packagingGated: realModelAdapterContractVerification?.packagingGated ?? true,
      realNetworkUsed: realModelAdapterContractVerification?.realNetworkUsed ?? false,
      realProviderAccepted: realModelAdapterContractVerification?.realProviderAccepted ?? false,
      canActivateRealModel: realModelAdapterContractVerification?.canActivateRealModel ?? false,
      canRelease: realModelAdapterContractVerification?.canRelease ?? false,
      passed: realModelAdapterContractVerification?.passed ?? 0,
      total: realModelAdapterContractVerification?.total ?? 0,
      checks: realModelAdapterContractVerification?.checks ?? [],
      nextAction:
        realModelAdapterContractVerification?.nextAction ??
        "Run npm run verify:real-model-adapter-contract before planning any real-provider trial."
    },
    realModelTrialKit: {
      reportPath: path.join("artifacts", "productization", realModelTrialKitReceiptName),
      markdownPath: path.join("artifacts", "productization", "real-model-trial-kit.md"),
      status: realModelTrialKit?.status ?? "not_built_yet",
      generatedAt: realModelTrialKit?.generatedAt ?? null,
      command: realModelTrialKit?.command ?? "npm run build:real-model-trial-kit",
      productScope: realModelTrialKit?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: realModelTrialKit?.allSoftwareObjective ?? "paused",
      releaseDecision: realModelTrialKit?.releaseDecision ?? "do_not_release",
      reviewOnly: realModelTrialKit?.reviewOnly ?? true,
      accepted: realModelTrialKit?.accepted ?? false,
      packagingGated: realModelTrialKit?.packagingGated ?? true,
      canActivateRealModel: realModelTrialKit?.canActivateRealModel ?? false,
      canRelease: realModelTrialKit?.canRelease ?? false,
      failedReasons: realModelTrialKit?.failedReasons ?? [],
      activeProvider: realModelTrialKit?.aiService?.activeProvider ?? aiService.activeProvider,
      requestedProvider: realModelTrialKit?.aiService?.requestedProvider ?? aiService.requestedProvider,
      realModelReady: realModelTrialKit?.aiService?.realModelReady ?? aiService.realModelReady,
      phaseCount: realModelTrialKit?.trialPhases?.length ?? 0,
      trialPhases: realModelTrialKit?.trialPhases ?? [],
      maintainerCommands: realModelTrialKit?.maintainerCommands ?? [],
      nextAction:
        realModelTrialKit?.nextAction ??
        "Run npm run build:real-model-trial-kit after refreshing release readiness and the blocker board."
    },
    realModelTrialKitVerification: {
      reportPath: path.join("artifacts", "productization", realModelTrialKitVerificationReceiptName),
      status: realModelTrialKitVerification?.status ?? "not_run_yet",
      generatedAt: realModelTrialKitVerification?.generatedAt ?? null,
      command: realModelTrialKitVerification?.command ?? "npm run verify:real-model-trial-kit",
      productScope: realModelTrialKitVerification?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: realModelTrialKitVerification?.allSoftwareObjective ?? "paused",
      releaseDecision: realModelTrialKitVerification?.releaseDecision ?? "do_not_release",
      reviewOnly: realModelTrialKitVerification?.reviewOnly ?? true,
      accepted: realModelTrialKitVerification?.accepted ?? false,
      packagingGated: realModelTrialKitVerification?.packagingGated ?? true,
      canActivateRealModel: realModelTrialKitVerification?.canActivateRealModel ?? false,
      canRelease: realModelTrialKitVerification?.canRelease ?? false,
      passed: realModelTrialKitVerification?.passed ?? 0,
      total: realModelTrialKitVerification?.total ?? 0,
      checks: realModelTrialKitVerification?.checks ?? [],
      nextAction:
        realModelTrialKitVerification?.nextAction ??
        "Run npm run verify:real-model-trial-kit before planning any real-provider trial."
    },
    realModelTrialReceiptValidation: {
      reportPath: path.join("artifacts", "productization", realModelTrialReceiptValidationReceiptName),
      templatePath: path.join("artifacts", "productization", "real-model-trial-receipt.template.json"),
      markdownPath: path.join("artifacts", "productization", "real-model-trial-receipt-template.md"),
      status: realModelTrialReceiptValidation?.status ?? "not_run_yet",
      generatedAt: realModelTrialReceiptValidation?.generatedAt ?? null,
      command: realModelTrialReceiptValidation?.command ?? "npm run verify:real-model-trial-receipt",
      inputPath:
        realModelTrialReceiptValidation?.inputPath ??
        path.join("artifacts", "productization", "real-model-trial-receipt.template.json"),
      mode: realModelTrialReceiptValidation?.mode ?? "template",
      productScope: realModelTrialReceiptValidation?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: realModelTrialReceiptValidation?.allSoftwareObjective ?? "paused",
      releaseDecision: realModelTrialReceiptValidation?.releaseDecision ?? "do_not_release",
      reviewOnly: realModelTrialReceiptValidation?.reviewOnly ?? true,
      accepted: realModelTrialReceiptValidation?.accepted ?? false,
      packagingGated: realModelTrialReceiptValidation?.packagingGated ?? true,
      canActivateRealModel: realModelTrialReceiptValidation?.canActivateRealModel ?? false,
      canRelease: realModelTrialReceiptValidation?.canRelease ?? false,
      passed: realModelTrialReceiptValidation?.passed ?? 0,
      total: realModelTrialReceiptValidation?.total ?? 0,
      checks: realModelTrialReceiptValidation?.checks ?? [],
      nextAction:
        realModelTrialReceiptValidation?.nextAction ??
        "Run npm run build:real-model-trial-receipt-template and npm run verify:real-model-trial-receipt before any real-provider trial."
    },
    humanAcceptanceGate: {
      reportPath: path.join("artifacts", "productization", humanAcceptanceGateReceiptName),
      status: humanAcceptanceGate?.status ?? "not_run_yet",
      generatedAt: humanAcceptanceGate?.generatedAt ?? null,
      command: humanAcceptanceGate?.command ?? "npm run verify:human-acceptance",
      allowPending: humanAcceptanceGate?.allowPending ?? false,
      latestEvidenceKind: humanAcceptanceGate?.latestEvidenceKind ?? latestManualAcceptance?.evidenceKind ?? "not_saved_yet",
      latestHumanReviewed: humanAcceptanceGate?.latestHumanReviewed ?? latestManualAcceptance?.humanReviewed ?? false,
      latestAutomationGenerated:
        humanAcceptanceGate?.latestAutomationGenerated ?? latestManualAcceptance?.automationGenerated ?? false,
      passed: humanAcceptanceGate?.passed ?? 0,
      total: humanAcceptanceGate?.total ?? 0,
      nextRequiredAction:
        humanAcceptanceGate?.nextRequiredAction ??
        "Run a real tester pass from /manual-test, enter reviewer name, pass every step, add per-step notes, confirm the manual-review attestation, save the evidence, then rerun npm run verify:human-acceptance.",
      checks: humanAcceptanceGate?.checks ?? []
    },
    humanAcceptanceSessionPreflight: {
      reportPath: path.join("artifacts", "productization", humanAcceptanceSessionPreflightReceiptName),
      status: humanAcceptanceSessionPreflight?.status ?? "not_run_yet",
      generatedAt: humanAcceptanceSessionPreflight?.generatedAt ?? null,
      command:
        humanAcceptanceSessionPreflight?.command ??
        "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000",
      baseUrl: humanAcceptanceSessionPreflight?.baseUrl ?? null,
      productScope: humanAcceptanceSessionPreflight?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: humanAcceptanceSessionPreflight?.allSoftwareObjective ?? "paused",
      releaseDecision: humanAcceptanceSessionPreflight?.releaseDecision ?? "do_not_release",
      reviewOnly: humanAcceptanceSessionPreflight?.reviewOnly ?? true,
      accepted: humanAcceptanceSessionPreflight?.accepted ?? false,
      packagingGated: humanAcceptanceSessionPreflight?.packagingGated ?? true,
      canStartHumanAcceptance: humanAcceptanceSessionPreflight?.canStartHumanAcceptance ?? false,
      passed: humanAcceptanceSessionPreflight?.passed ?? 0,
      total: humanAcceptanceSessionPreflight?.total ?? 0,
      checks: humanAcceptanceSessionPreflight?.checks ?? [],
      nextAction:
        humanAcceptanceSessionPreflight?.nextAction ??
        "Run npm run preflight:human-acceptance before asking a real reviewer to save human_review evidence."
    },
    humanAcceptanceReviewerKit: {
      reportPath: path.join("artifacts", "productization", humanAcceptanceReviewerKitReceiptName),
      markdownPath: path.join("artifacts", "productization", "human-acceptance-reviewer-kit.md"),
      status: humanAcceptanceReviewerKit?.status ?? "not_built_yet",
      generatedAt: humanAcceptanceReviewerKit?.generatedAt ?? null,
      command: humanAcceptanceReviewerKit?.command ?? "npm run build:human-acceptance-reviewer-kit",
      productScope: humanAcceptanceReviewerKit?.productScope ?? "bounded_core_teaching_loop",
      stableTaskId: humanAcceptanceReviewerKit?.stableTaskId ?? stableProductTaskId,
      allSoftwareObjective: humanAcceptanceReviewerKit?.allSoftwareObjective ?? "paused",
      releaseDecision: humanAcceptanceReviewerKit?.releaseDecision ?? "do_not_release",
      reviewOnly: humanAcceptanceReviewerKit?.reviewOnly ?? true,
      accepted: humanAcceptanceReviewerKit?.accepted ?? false,
      packagingGated: humanAcceptanceReviewerKit?.packagingGated ?? true,
      canStartReviewerSession: humanAcceptanceReviewerKit?.canStartReviewerSession ?? false,
      failedReasons: humanAcceptanceReviewerKit?.failedReasons ?? [],
      reviewerStepCount: humanAcceptanceReviewerKit?.reviewerSteps?.length ?? 0,
      maintainerCommandCount: humanAcceptanceReviewerKit?.maintainerCommands?.length ?? 0,
      nextAction:
        humanAcceptanceReviewerKit?.nextAction ??
        "Run npm run build:human-acceptance-reviewer-kit after human acceptance preflight passes."
    },
    humanAcceptanceReviewerKitVerification: {
      reportPath: path.join("artifacts", "productization", humanAcceptanceReviewerKitVerificationReceiptName),
      status: humanAcceptanceReviewerKitVerification?.status ?? "not_run_yet",
      generatedAt: humanAcceptanceReviewerKitVerification?.generatedAt ?? null,
      command:
        humanAcceptanceReviewerKitVerification?.command ?? "npm run verify:human-acceptance-reviewer-kit",
      productScope: humanAcceptanceReviewerKitVerification?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: humanAcceptanceReviewerKitVerification?.allSoftwareObjective ?? "paused",
      releaseDecision: humanAcceptanceReviewerKitVerification?.releaseDecision ?? "do_not_release",
      reviewOnly: humanAcceptanceReviewerKitVerification?.reviewOnly ?? true,
      accepted: humanAcceptanceReviewerKitVerification?.accepted ?? false,
      packagingGated: humanAcceptanceReviewerKitVerification?.packagingGated ?? true,
      passed: humanAcceptanceReviewerKitVerification?.passed ?? 0,
      total: humanAcceptanceReviewerKitVerification?.total ?? 0,
      checks: humanAcceptanceReviewerKitVerification?.checks ?? [],
      nextAction:
        humanAcceptanceReviewerKitVerification?.nextAction ??
        "Run npm run verify:human-acceptance-reviewer-kit before giving the kit to a real reviewer."
    },
    humanAcceptanceReceiptValidation: {
      reportPath: path.join("artifacts", "productization", humanAcceptanceReceiptValidationReceiptName),
      templatePath: path.join("artifacts", "productization", "human-acceptance-receipt.template.json"),
      markdownPath: path.join("artifacts", "productization", "human-acceptance-receipt-template.md"),
      status: humanAcceptanceReceiptValidation?.status ?? "not_run_yet",
      generatedAt: humanAcceptanceReceiptValidation?.generatedAt ?? null,
      command: humanAcceptanceReceiptValidation?.command ?? "npm run verify:human-acceptance-receipt",
      inputPath:
        humanAcceptanceReceiptValidation?.inputPath ??
        path.join("artifacts", "productization", "human-acceptance-receipt.template.json"),
      mode: humanAcceptanceReceiptValidation?.mode ?? "template",
      productScope: humanAcceptanceReceiptValidation?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: humanAcceptanceReceiptValidation?.allSoftwareObjective ?? "paused",
      releaseDecision: humanAcceptanceReceiptValidation?.releaseDecision ?? "do_not_release",
      reviewOnly: humanAcceptanceReceiptValidation?.reviewOnly ?? true,
      accepted: humanAcceptanceReceiptValidation?.accepted ?? false,
      packagingGated: humanAcceptanceReceiptValidation?.packagingGated ?? true,
      canRelease: humanAcceptanceReceiptValidation?.canRelease ?? false,
      passed: humanAcceptanceReceiptValidation?.passed ?? 0,
      total: humanAcceptanceReceiptValidation?.total ?? 0,
      checks: humanAcceptanceReceiptValidation?.checks ?? [],
      nextAction:
        humanAcceptanceReceiptValidation?.nextAction ??
        "Run npm run build:human-acceptance-receipt-template and npm run verify:human-acceptance-receipt before asking for a real human acceptance return."
    },
    productTrialPacket: {
      manifestPath: path.join("artifacts", "productization", productTrialPacketManifestName),
      status: productTrialPacket?.status ?? "not_built_yet",
      generatedAt: productTrialPacket?.generatedAt ?? null,
      packetDir: productTrialPacket?.packetDir ?? path.join("artifacts", "productization", "product-trial-packet"),
      includedFileCount: productTrialPacket?.includedFiles?.length ?? 0,
      accepted: productTrialPacket?.packagingBoundary?.accepted ?? false,
      packagingGated: productTrialPacket?.packagingBoundary?.packagingGated ?? true
    },
    publicBetaPacket: {
      manifestPath: path.join("artifacts", "productization", publicBetaPacketManifestName),
      status: publicBetaPacket?.status ?? "not_built_yet",
      generatedAt: publicBetaPacket?.generatedAt ?? null,
      packetDir: publicBetaPacket?.packetDir ?? path.join("artifacts", "productization", "public-beta-packet"),
      betaCanStart: publicBetaPacket?.betaCanStart ?? false,
      releaseDecision: publicBetaPacket?.releaseDecision ?? "do_not_release",
      requiredPassed: publicBetaPacket?.requiredPassed ?? 0,
      requiredTotal: publicBetaPacket?.requiredTotal ?? 0,
      includedFileCount: publicBetaPacket?.includedFiles?.length ?? 0,
      accepted: publicBetaPacket?.packagingBoundary?.accepted ?? false,
      packagingGated: publicBetaPacket?.packagingBoundary?.packagingGated ?? true
    },
    publicBetaReadiness: {
      reportPath: path.join("artifacts", "productization", publicBetaReadinessReceiptName),
      status: publicBetaReadiness?.status ?? "not_run_yet",
      generatedAt: publicBetaReadiness?.generatedAt ?? null,
      command: publicBetaReadiness?.command ?? "npm run verify:public-beta",
      betaCanStart: publicBetaReadiness?.betaCanStart ?? false,
      releaseDecision: publicBetaReadiness?.releaseDecision ?? "do_not_release",
      passed: publicBetaReadiness?.passed ?? 0,
      total: publicBetaReadiness?.total ?? 0,
      checks: publicBetaReadiness?.checks ?? []
    },
    publicBetaPreparation: {
      reportPath: path.join("artifacts", "productization", publicBetaPreparationReceiptName),
      status: publicBetaPreparation?.status ?? "not_run_yet",
      generatedAt: publicBetaPreparation?.generatedAt ?? null,
      command:
        publicBetaPreparation?.command ??
        "npm run prepare:public-beta -- --base-url http://127.0.0.1:3000",
      baseUrl: publicBetaPreparation?.baseUrl ?? null,
      releaseDecision: publicBetaPreparation?.releaseDecision ?? "do_not_release",
      reviewOnly: publicBetaPreparation?.reviewOnly ?? true,
      accepted: publicBetaPreparation?.accepted ?? false,
      packagingGated: publicBetaPreparation?.packagingGated ?? true,
      passed: publicBetaPreparation?.passed ?? 0,
      total: publicBetaPreparation?.total ?? 0,
      steps: publicBetaPreparation?.steps ?? [],
      nextAction:
        publicBetaPreparation?.nextAction ??
        "Run npm run prepare:public-beta -- --base-url http://127.0.0.1:3000 before inviting a bounded beta tester."
    },
    publicBetaFeedbackValidation: {
      reportPath: path.join("artifacts", "productization", publicBetaFeedbackValidationReceiptName),
      status: publicBetaFeedbackValidation?.status ?? "not_run_yet",
      generatedAt: publicBetaFeedbackValidation?.generatedAt ?? null,
      command: publicBetaFeedbackValidation?.command ?? "npm run verify:public-beta-feedback",
      inputPath:
        publicBetaFeedbackValidation?.inputPath ??
        path.join("artifacts", "productization", "public-beta-packet", "docs", "PUBLIC_BETA_FEEDBACK_RECEIPT.template.json"),
      mode: publicBetaFeedbackValidation?.mode ?? "template",
      betaDecision: publicBetaFeedbackValidation?.betaDecision ?? "needs_fix_before_more_testers",
      betaCanContinue: publicBetaFeedbackValidation?.betaCanContinue ?? false,
      releaseDecision: publicBetaFeedbackValidation?.releaseDecision ?? "do_not_release",
      reviewOnly: publicBetaFeedbackValidation?.reviewOnly ?? true,
      accepted: publicBetaFeedbackValidation?.accepted ?? false,
      packagingGated: publicBetaFeedbackValidation?.packagingGated ?? true,
      passed: publicBetaFeedbackValidation?.passed ?? 0,
      total: publicBetaFeedbackValidation?.total ?? 0,
      checks: publicBetaFeedbackValidation?.checks ?? []
    },
    publicBetaFeedbackApiVerification: {
      reportPath: path.join("artifacts", "productization", publicBetaFeedbackApiVerificationReceiptName),
      status: publicBetaFeedbackApiVerification?.status ?? "not_run_yet",
      generatedAt: publicBetaFeedbackApiVerification?.generatedAt ?? null,
      command: publicBetaFeedbackApiVerification?.command ?? "npm run verify:public-beta-feedback-api",
      productScope: publicBetaFeedbackApiVerification?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: publicBetaFeedbackApiVerification?.allSoftwareObjective ?? "paused",
      releaseDecision: publicBetaFeedbackApiVerification?.releaseDecision ?? "do_not_release",
      reviewOnly: publicBetaFeedbackApiVerification?.reviewOnly ?? true,
      accepted: publicBetaFeedbackApiVerification?.accepted ?? false,
      packagingGated: publicBetaFeedbackApiVerification?.packagingGated ?? true,
      tempArtifactsDir:
        publicBetaFeedbackApiVerification?.tempArtifactsDir ??
        path.join("artifacts", "productization", "public-beta-feedback-api-verification-tmp"),
      tempArtifactsCleaned: publicBetaFeedbackApiVerification?.tempArtifactsCleaned ?? false,
      passed: publicBetaFeedbackApiVerification?.passed ?? 0,
      total: publicBetaFeedbackApiVerification?.total ?? 0,
      checks: publicBetaFeedbackApiVerification?.checks ?? [],
      nextAction:
        publicBetaFeedbackApiVerification?.nextAction ??
        "Run npm run verify:public-beta-feedback-api to prove browser-submitted beta feedback can be validated, saved, and rejected safely."
    },
    publicBetaFeedbackCollection: {
      reportPath: path.join("artifacts", "productization", publicBetaFeedbackCollectionReceiptName),
      status: publicBetaFeedbackCollection?.status ?? "not_run_yet",
      generatedAt: publicBetaFeedbackCollection?.generatedAt ?? null,
      command: publicBetaFeedbackCollection?.command ?? "npm run collect:public-beta-feedback",
      inboxDir:
        publicBetaFeedbackCollection?.inboxDir ??
        path.join("artifacts", "productization", "public-beta-feedback-inbox"),
      totalReceipts: publicBetaFeedbackCollection?.totalReceipts ?? 0,
      validReceipts: publicBetaFeedbackCollection?.validReceipts ?? 0,
      invalidReceipts: publicBetaFeedbackCollection?.invalidReceipts ?? 0,
      decisionCounts: publicBetaFeedbackCollection?.decisionCounts ?? {
        ready_for_next_beta_tester: 0,
        needs_fix_before_more_testers: 0,
        blocked: 0
      },
      releaseDecision: publicBetaFeedbackCollection?.releaseDecision ?? "do_not_release",
      reviewOnly: publicBetaFeedbackCollection?.reviewOnly ?? true,
      accepted: publicBetaFeedbackCollection?.accepted ?? false,
      packagingGated: publicBetaFeedbackCollection?.packagingGated ?? true,
      nextAction:
        publicBetaFeedbackCollection?.nextAction ??
        "Invite a bounded beta tester; process returned JSON receipts with npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json before they enter the feedback queue."
    },
    publicBetaFeedbackCollectionVerification: {
      reportPath: path.join("artifacts", "productization", publicBetaFeedbackCollectionVerificationReceiptName),
      status: publicBetaFeedbackCollectionVerification?.status ?? "not_run_yet",
      generatedAt: publicBetaFeedbackCollectionVerification?.generatedAt ?? null,
      command:
        publicBetaFeedbackCollectionVerification?.command ?? "npm run verify:public-beta-feedback-collection",
      releaseDecision: publicBetaFeedbackCollectionVerification?.releaseDecision ?? "do_not_release",
      reviewOnly: publicBetaFeedbackCollectionVerification?.reviewOnly ?? true,
      accepted: publicBetaFeedbackCollectionVerification?.accepted ?? false,
      packagingGated: publicBetaFeedbackCollectionVerification?.packagingGated ?? true,
      passed: publicBetaFeedbackCollectionVerification?.passed ?? 0,
      total: publicBetaFeedbackCollectionVerification?.total ?? 0,
      checks: publicBetaFeedbackCollectionVerification?.checks ?? [],
      nextAction:
        publicBetaFeedbackCollectionVerification?.nextAction ??
        "Run npm run verify:public-beta-feedback-collection to prove beta feedback collection behavior."
    },
    publicBetaFollowUpPlan: {
      reportPath: path.join("artifacts", "productization", publicBetaFollowUpPlanReceiptName),
      status: publicBetaFollowUpPlan?.status ?? "not_run_yet",
      generatedAt: publicBetaFollowUpPlan?.generatedAt ?? null,
      command: publicBetaFollowUpPlan?.command ?? "npm run plan:public-beta-follow-up",
      sourceCollectionPath:
        publicBetaFollowUpPlan?.sourceCollectionPath ??
        path.join("artifacts", "productization", publicBetaFeedbackCollectionReceiptName),
      releaseDecision: publicBetaFollowUpPlan?.releaseDecision ?? "do_not_release",
      reviewOnly: publicBetaFollowUpPlan?.reviewOnly ?? true,
      accepted: publicBetaFollowUpPlan?.accepted ?? false,
      packagingGated: publicBetaFollowUpPlan?.packagingGated ?? true,
      canInviteNextTester: publicBetaFollowUpPlan?.canInviteNextTester ?? false,
      counts: publicBetaFollowUpPlan?.counts ?? {
        totalReceipts: 0,
        validReceipts: 0,
        invalidReceipts: 0,
        readyForNextTester: 0,
        needsFix: 0,
        blocked: 0
      },
      actionCount: publicBetaFollowUpPlan?.actions?.length ?? 0,
      actions: publicBetaFollowUpPlan?.actions ?? [],
      nextAction:
        publicBetaFollowUpPlan?.nextAction ??
        "Run npm run plan:public-beta-follow-up after collecting public beta feedback."
    },
    publicBetaFollowUpPlanVerification: {
      reportPath: path.join("artifacts", "productization", publicBetaFollowUpPlanVerificationReceiptName),
      status: publicBetaFollowUpPlanVerification?.status ?? "not_run_yet",
      generatedAt: publicBetaFollowUpPlanVerification?.generatedAt ?? null,
      command: publicBetaFollowUpPlanVerification?.command ?? "npm run verify:public-beta-follow-up-plan",
      releaseDecision: publicBetaFollowUpPlanVerification?.releaseDecision ?? "do_not_release",
      reviewOnly: publicBetaFollowUpPlanVerification?.reviewOnly ?? true,
      accepted: publicBetaFollowUpPlanVerification?.accepted ?? false,
      packagingGated: publicBetaFollowUpPlanVerification?.packagingGated ?? true,
      passed: publicBetaFollowUpPlanVerification?.passed ?? 0,
      total: publicBetaFollowUpPlanVerification?.total ?? 0,
      checks: publicBetaFollowUpPlanVerification?.checks ?? [],
      nextAction:
        publicBetaFollowUpPlanVerification?.nextAction ??
        "Run npm run verify:public-beta-follow-up-plan to prove beta follow-up planning behavior."
    },
    publicBetaReturnLoop: {
      status:
        Number(publicBetaFeedbackCollection?.totalReceipts ?? 0) > 0
          ? publicBetaFollowUpPlan?.status ?? "needs_follow_up_plan"
          : "waiting_for_first_tester_return",
      collectionStatus: publicBetaFeedbackCollection?.status ?? "not_run_yet",
      feedbackApiStatus: publicBetaFeedbackApiVerification?.status ?? "not_run_yet",
      followUpPlanStatus: publicBetaFollowUpPlan?.status ?? "not_run_yet",
      followUpVerificationStatus: publicBetaFollowUpPlanVerification?.status ?? "not_run_yet",
      returnIntakeVerificationStatus: publicBetaReturnIntakeVerification?.status ?? "not_run_yet",
      canInviteNextTester: publicBetaFollowUpPlan?.canInviteNextTester ?? false,
      totalReceipts: publicBetaFeedbackCollection?.totalReceipts ?? 0,
      validReceipts: publicBetaFeedbackCollection?.validReceipts ?? 0,
      invalidReceipts: publicBetaFeedbackCollection?.invalidReceipts ?? 0,
      decisionCounts: publicBetaFeedbackCollection?.decisionCounts ?? {
        ready_for_next_beta_tester: 0,
        needs_fix_before_more_testers: 0,
        blocked: 0
      },
      releaseDecision: publicBetaFollowUpPlan?.releaseDecision ?? publicBetaFeedbackCollection?.releaseDecision ?? "do_not_release",
      reviewOnly: publicBetaFollowUpPlan?.reviewOnly ?? publicBetaFeedbackCollection?.reviewOnly ?? true,
      accepted: publicBetaFollowUpPlan?.accepted ?? publicBetaFeedbackCollection?.accepted ?? false,
      packagingGated: publicBetaFollowUpPlan?.packagingGated ?? publicBetaFeedbackCollection?.packagingGated ?? true,
      actionCount: publicBetaFollowUpPlan?.actions?.length ?? 0,
      actions: publicBetaFollowUpPlan?.actions ?? [],
      commandSequence: [
        "npm run verify:public-beta-feedback-api",
        "npm run verify:public-beta-feedback -- --receipt path/to/submitted-feedback.json",
        "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
        "npm run collect:public-beta-feedback",
        "npm run plan:public-beta-follow-up",
        "npm run verify:public-beta-follow-up-plan"
      ],
      nextAction:
        publicBetaFollowUpPlan?.nextAction ??
        publicBetaFeedbackCollection?.nextAction ??
        "Invite a bounded beta tester, then validate and process the returned receipt with npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json before inviting another tester."
    },
    publicBetaTesterInvite: {
      reportPath: path.join("artifacts", "productization", publicBetaTesterInviteReceiptName),
      markdownPath: path.join("artifacts", "productization", "public-beta-tester-invite.md"),
      status: publicBetaTesterInvite?.status ?? "not_run_yet",
      generatedAt: publicBetaTesterInvite?.generatedAt ?? null,
      command: publicBetaTesterInvite?.command ?? "npm run build:public-beta-tester-invite",
      releaseDecision: publicBetaTesterInvite?.releaseDecision ?? "do_not_release",
      reviewOnly: publicBetaTesterInvite?.reviewOnly ?? true,
      accepted: publicBetaTesterInvite?.accepted ?? false,
      packagingGated: publicBetaTesterInvite?.packagingGated ?? true,
      canInvite: publicBetaTesterInvite?.canInvite ?? false,
      failedReasons: publicBetaTesterInvite?.failedReasons ?? [],
      maintainerChecklistCount: publicBetaTesterInvite?.maintainerChecklist?.length ?? 0,
      testerChecklistCount: publicBetaTesterInvite?.testerChecklist?.length ?? 0,
      testerEntryPoints: publicBetaTesterInvite?.testerEntryPoints ?? {},
      nextAction:
        publicBetaTesterInvite?.nextAction ??
        "Run npm run build:public-beta-tester-invite before contacting a bounded beta tester."
    },
    publicBetaTesterInviteVerification: {
      reportPath: path.join("artifacts", "productization", publicBetaTesterInviteVerificationReceiptName),
      status: publicBetaTesterInviteVerification?.status ?? "not_run_yet",
      generatedAt: publicBetaTesterInviteVerification?.generatedAt ?? null,
      command: publicBetaTesterInviteVerification?.command ?? "npm run verify:public-beta-tester-invite",
      releaseDecision: publicBetaTesterInviteVerification?.releaseDecision ?? "do_not_release",
      reviewOnly: publicBetaTesterInviteVerification?.reviewOnly ?? true,
      accepted: publicBetaTesterInviteVerification?.accepted ?? false,
      packagingGated: publicBetaTesterInviteVerification?.packagingGated ?? true,
      passed: publicBetaTesterInviteVerification?.passed ?? 0,
      total: publicBetaTesterInviteVerification?.total ?? 0,
      checks: publicBetaTesterInviteVerification?.checks ?? [],
      nextAction:
        publicBetaTesterInviteVerification?.nextAction ??
        "Run npm run verify:public-beta-tester-invite to prove the tester invite kit is ready."
    },
    publicBetaReturnIntakeVerification: {
      reportPath: path.join("artifacts", "productization", publicBetaReturnIntakeVerificationReceiptName),
      status: publicBetaReturnIntakeVerification?.status ?? "not_run_yet",
      generatedAt: publicBetaReturnIntakeVerification?.generatedAt ?? null,
      command: publicBetaReturnIntakeVerification?.command ?? "npm run verify:public-beta-return-intake",
      productScope: publicBetaReturnIntakeVerification?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: publicBetaReturnIntakeVerification?.allSoftwareObjective ?? "paused",
      releaseDecision: publicBetaReturnIntakeVerification?.releaseDecision ?? "do_not_release",
      reviewOnly: publicBetaReturnIntakeVerification?.reviewOnly ?? true,
      accepted: publicBetaReturnIntakeVerification?.accepted ?? false,
      packagingGated: publicBetaReturnIntakeVerification?.packagingGated ?? true,
      passed: publicBetaReturnIntakeVerification?.passed ?? 0,
      total: publicBetaReturnIntakeVerification?.total ?? 0,
      checks: publicBetaReturnIntakeVerification?.checks ?? [],
      nextAction:
        publicBetaReturnIntakeVerification?.nextAction ??
        "Run npm run verify:public-beta-return-intake before processing returned tester receipts."
    },
    publicBetaTesterSessionPreflight: {
      reportPath: path.join("artifacts", "productization", publicBetaTesterSessionPreflightReceiptName),
      status: publicBetaTesterSessionPreflight?.status ?? "not_run_yet",
      generatedAt: publicBetaTesterSessionPreflight?.generatedAt ?? null,
      command:
        publicBetaTesterSessionPreflight?.command ??
        "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
      baseUrl: publicBetaTesterSessionPreflight?.baseUrl ?? null,
      productScope: publicBetaTesterSessionPreflight?.productScope ?? "bounded_core_teaching_loop",
      allSoftwareObjective: publicBetaTesterSessionPreflight?.allSoftwareObjective ?? "paused",
      releaseDecision: publicBetaTesterSessionPreflight?.releaseDecision ?? "do_not_release",
      reviewOnly: publicBetaTesterSessionPreflight?.reviewOnly ?? true,
      accepted: publicBetaTesterSessionPreflight?.accepted ?? false,
      packagingGated: publicBetaTesterSessionPreflight?.packagingGated ?? true,
      canInviteTester: publicBetaTesterSessionPreflight?.canInviteTester ?? false,
      passed: publicBetaTesterSessionPreflight?.passed ?? 0,
      total: publicBetaTesterSessionPreflight?.total ?? 0,
      checks: publicBetaTesterSessionPreflight?.checks ?? [],
      nextAction:
        publicBetaTesterSessionPreflight?.nextAction ??
        "Run npm run preflight:public-beta-tester before contacting a bounded beta tester."
    },
    artifacts,
    missingArtifacts,
    pendingOptionalArtifacts,
    manualAcceptance: {
      saveEndpoint: "/api/manual-acceptance-reports",
      latestSaved: Boolean(latestManualAcceptance),
      latestSavedAt: latestManualAcceptance?.savedAt ?? null,
      latestReportPath: latestManualAcceptance?.latestReportPath ?? path.join("artifacts", "productization", manualAcceptanceLatestReportName),
      latestEvidenceKind: latestManualAcceptance?.evidenceKind ?? "not_saved_yet",
      latestHumanReviewed: latestManualAcceptance?.humanReviewed ?? false,
      latestAutomationGenerated: latestManualAcceptance?.automationGenerated ?? false,
      latestClassificationReason: latestManualAcceptance?.classificationReason ?? "not_saved_yet",
      latestHasHumanReviewEvidence: Boolean(latestManualAcceptance?.humanReviewEvidence),
      humanAcceptanceStatus: latestManualAcceptance?.humanReviewed ? "human_review_saved" : "needs_real_human_review",
      reviewOnly: true,
      accepted: false,
      packagingGated: true
    },
    aiService,
    commands: productReadinessCommands,
    routes: productReadinessRoutes,
    packagingBoundary: {
      accepted: visualLearningAcceptanceGate.accepted,
      packagingGated: visualLearningAcceptanceGate.packagingGated,
      status: visualLearningAcceptanceGate.status,
      reason: visualLearningAcceptanceGate.reason
    }
  };
}
